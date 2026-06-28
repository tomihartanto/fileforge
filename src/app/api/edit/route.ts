import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { saveFile, readFileFromStorage } from "@/lib/storage"
import { PDFDocument, degrees, rgb, StandardFonts } from "pdf-lib"
import JSZip from "jszip"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    const handlers: Record<string, (body: any) => Promise<NextResponse>> = {
      rotate: handleRotate,
      delete_pages: handleDeletePages,
      merge: handleMerge,
      split: handleSplit,
      reorder: handleReorder,
      watermark: handleWatermark,
    }

    const handler = handlers[action]
    if (!handler) return NextResponse.json({ error: "Aksi tidak dikenal" }, { status: 400 })
    return await handler(body)
  } catch (error: any) {
    console.error("Edit error:", error)
    return NextResponse.json({ error: error.message || "Gagal mengedit file" }, { status: 500 })
  }
}

async function getFile(fileId: string) {
  const file = await prisma.file.findUnique({ where: { id: fileId } })
  if (!file) throw new Error("File tidak ditemukan")
  return file
}

async function saveResult(fileId: string, action: string, options: any, buffer: Buffer, ext: string, originalName: string) {
  const { key, url } = await saveFile(buffer, "edited", ext)
  const fileName = `${originalName.replace(/\.[^.]+$/, "")}-${action}.${ext}`
  const op = await prisma.fileOperation.create({
    data: { fileId, type: "edit", status: "completed", options: { action, ...options }, resultKey: key, resultUrl: url, resultSize: BigInt(buffer.length), completedAt: new Date() },
  })
  return { id: op.id, fileName, url, size: buffer.length }
}

// ===== ROTATE =====
async function handleRotate({ fileId, degrees: rotationDegrees }: { fileId: string; degrees: number }) {
  if (![90, 180, 270].includes(Number(rotationDegrees))) {
    return NextResponse.json({ error: "Derajat rotasi tidak valid (pilih 90, 180, atau 270)" }, { status: 400 })
  }
  const file = await getFile(fileId)
  const buffer = await readFileFromStorage(file.storageKey)
  const pdfDoc = await PDFDocument.load(buffer)
  for (const page of pdfDoc.getPages()) {
    const current = page.getRotation().angle
    page.setRotation(degrees((current + rotationDegrees) % 360))
  }
  const result = Buffer.from(await pdfDoc.save())
  return NextResponse.json(await saveResult(fileId, "rotate", { degrees: rotationDegrees }, result, "pdf", file.originalName))
}

// ===== DELETE PAGES =====
async function handleDeletePages({ fileId, pages }: { fileId: string; pages: string }) {
  const file = await getFile(fileId)
  if (!pages) return NextResponse.json({ error: "Halaman harus diisi" }, { status: 400 })
  const pagesToRemove = parsePageRanges(pages)
  if (pagesToRemove.length === 0) return NextResponse.json({ error: "Tidak ada halaman valid" }, { status: 400 })

  const buffer = await readFileFromStorage(file.storageKey)
  const pdfDoc = await PDFDocument.load(buffer)
  const total = pdfDoc.getPageCount()
  const invalid = pagesToRemove.filter((p) => p > total)
  if (invalid.length > 0) return NextResponse.json({ error: `Halaman ${invalid.join(", ")} tidak ada (total: ${total})` }, { status: 400 })

  const toRemove = pagesToRemove.sort((a, b) => b - a)
  for (const idx of toRemove) pdfDoc.removePage(idx - 1)
  const result = Buffer.from(await pdfDoc.save())
  return NextResponse.json(await saveResult(fileId, "delete_pages", { removed: pagesToRemove }, result, "pdf", file.originalName))
}

// ===== MERGE =====
async function handleMerge({ fileIds }: { fileIds: string[] }) {
  if (!fileIds || fileIds.length < 2) return NextResponse.json({ error: "Butuh minimal 2 file" }, { status: 400 })
  const mergedPdf = await PDFDocument.create()
  for (const fid of fileIds) {
    const file = await getFile(fid)
    const buffer = await readFileFromStorage(file.storageKey)
    const srcDoc = await PDFDocument.load(buffer)
    const pages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices())
    pages.forEach((p) => mergedPdf.addPage(p))
  }
  const result = Buffer.from(await mergedPdf.save())
  return NextResponse.json(await saveResult(fileIds[0], "merge", { sourceIds: fileIds }, result, "pdf", "merged"))
}

// ===== SPLIT =====
async function handleSplit({ fileId, every }: { fileId: string; every: number }) {
  const file = await getFile(fileId)
  if (!every || every < 1) every = 1
  const buffer = await readFileFromStorage(file.storageKey)
  const srcDoc = await PDFDocument.load(buffer)
  const totalPages = srcDoc.getPageCount()

  // Split jadi chunks
  const chunks: Buffer[] = []
  for (let i = 0; i < totalPages; i += every) {
    const newDoc = await PDFDocument.create()
    const end = Math.min(i + every, totalPages)
    const pageIndices = Array.from({ length: end - i }, (_, k) => i + k)
    const pages = await newDoc.copyPages(srcDoc, pageIndices)
    pages.forEach((p) => newDoc.addPage(p))
    chunks.push(Buffer.from(await newDoc.save()))
  }

  const baseName = file.originalName.replace(/\.[^.]+$/, "")

  // Kalau cuma 1 chunk, kirim langsung sebagai PDF
  if (chunks.length === 1) {
    return NextResponse.json(await saveResult(fileId, "split", { every, parts: 1 }, chunks[0], "pdf", file.originalName))
  }

  // Multiple chunks: package sebagai ZIP
  const zip = new JSZip()
  chunks.forEach((chunk, idx) => {
    const padLen = String(chunks.length).length
    const partNum = String(idx + 1).padStart(padLen, "0")
    zip.file(`${baseName}-part-${partNum}-of-${chunks.length}.pdf`, chunk)
  })
  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  })

  const fileName = `${baseName}-split-${chunks.length}-parts.zip`
  const { key, url } = await saveFile(zipBuffer, "edited", "zip")
  const op = await prisma.fileOperation.create({
    data: {
      fileId,
      type: "edit",
      status: "completed",
      options: { action: "split", every, totalParts: chunks.length },
      resultKey: key,
      resultUrl: url,
      resultSize: BigInt(zipBuffer.length),
      completedAt: new Date(),
    },
  })
  return NextResponse.json({ id: op.id, fileName, url, size: zipBuffer.length, totalParts: chunks.length })
}

// ===== REORDER =====
async function handleReorder({ fileId, order }: { fileId: string; order: string }) {
  const file = await getFile(fileId)
  if (!order) return NextResponse.json({ error: "Urutan harus diisi" }, { status: 400 })

  const newOrder = parsePageRanges(order)
  if (newOrder.length === 0) return NextResponse.json({ error: "Urutan tidak valid" }, { status: 400 })

  const buffer = await readFileFromStorage(file.storageKey)
  const srcDoc = await PDFDocument.load(buffer)
  const totalPages = srcDoc.getPageCount()
  if (newOrder.some((p) => p > totalPages || p < 1)) {
    return NextResponse.json({ error: `Nomor halaman tidak valid (total: ${totalPages})` }, { status: 400 })
  }

  const newDoc = await PDFDocument.create()
  const pageIndices = newOrder.map((p) => p - 1)
  const pages = await newDoc.copyPages(srcDoc, pageIndices)
  pages.forEach((p) => newDoc.addPage(p))

  const result = Buffer.from(await newDoc.save())
  return NextResponse.json(await saveResult(fileId, "reorder", { order: newOrder }, result, "pdf", file.originalName))
}

// ===== WATERMARK =====
async function handleWatermark({ fileId, text, opacity }: { fileId: string; text: string; opacity?: number }) {
  const file = await getFile(fileId)
  if (!text) return NextResponse.json({ error: "Teks watermark harus diisi" }, { status: 400 })

  const buffer = await readFileFromStorage(file.storageKey)
  const pdfDoc = await PDFDocument.load(buffer)
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const op = opacity ?? 0.3

  for (const page of pdfDoc.getPages()) {
    const { width, height } = page.getSize()
    const textSize = Math.min(48, Math.floor(width / 10))
    const textWidth = font.widthOfTextAtSize(text.toUpperCase(), textSize)

    // Posisi watermark diagonal terpusat.
    // Dengan rotasi 45°, kita offset dari center agar teks muncul
    // secara diagonal melintang halaman.
    page.drawText(text.toUpperCase(), {
      x: width / 2 - textWidth / 2,
      y: height / 2 - textSize / 2,
      size: textSize,
      font,
      color: rgb(0.5, 0.5, 0.5),
      opacity: op,
      rotate: degrees(45),
    })
  }

  const result = Buffer.from(await pdfDoc.save())
  return NextResponse.json(await saveResult(fileId, "watermark", { text, opacity: op }, result, "pdf", file.originalName))
}

// ===== HELPER: Parse page ranges =====
function parsePageRanges(input: string): number[] {
  return input
    .split(",")
    .flatMap((part) => {
      part = part.trim()
      const range = part.match(/^(\d+)-(\d+)$/)
      if (range) {
        const start = parseInt(range[1], 10)
        const end = parseInt(range[2], 10)
        return Array.from({ length: Math.abs(end - start) + 1 }, (_, i) => Math.min(start, end) + i)
      }
      const n = parseInt(part, 10)
      return isNaN(n) ? [] : [n]
    })
    .filter((n) => n > 0)
}
