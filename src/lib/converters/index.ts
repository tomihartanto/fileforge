import { readFileFromStorage } from '../storage'
import { convertPdfToDocx, convertPdfToText, convertPdfToImages } from './pdf'
import { convertDocxToPdf, convertDocxToText } from './docx'
import { convertImageFormat, imagesToPdf, convertImageToWebP } from './image'
import { compressImage, compressPdf } from './compress'
import sharp from 'sharp'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

export interface ConvertResult {
  buffer: Buffer
  ext: string
  mimeType: string
}

export interface ConvertOptions {
  quality?: number
  dpi?: number
  scale?: number
  maxWidth?: number
  maxHeight?: number
}

const TMP_DIR = path.join(process.cwd(), 'assets', 'uploads', 'tmp')

async function ensureTmp() {
  if (!existsSync(TMP_DIR)) {
    await mkdir(TMP_DIR, { recursive: true })
  }
}

export async function convertFile(
  storageKey: string,
  fromFormat: string,
  toFormat: string,
  options?: ConvertOptions
): Promise<ConvertResult> {
  const buffer = await readFileFromStorage(storageKey)

  // PDF conversions
  if (fromFormat === 'pdf') {
    if (toFormat === 'docx') return convertPdfToDocx(buffer)
    if (toFormat === 'txt') return convertPdfToText(buffer)
    if (toFormat === 'png' || toFormat === 'jpg') return convertPdfToImages(buffer, toFormat, options)
  }

  // DOCX conversions
  if (fromFormat === 'docx' || fromFormat === 'doc') {
    if (toFormat === 'pdf') return convertDocxToPdf(buffer)
    if (toFormat === 'txt') return convertDocxToText(buffer)
  }

  // Image conversions - 'image' adalah generic catch-all untuk semua format gambar
  const imageFormats = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'image']
  if (imageFormats.includes(fromFormat)) {
    if (toFormat === 'pdf') return imagesToPdf([buffer])
    if (toFormat === 'webp') return convertImageToWebP(buffer)
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(toFormat)) {
      // Detect actual format dari buffer kalau fromFormat = 'image'
      const actualFrom = fromFormat === 'image' ? toFormat : fromFormat
      return convertImageFormat(buffer, actualFrom, toFormat, options)
    }
  }

  // Text conversions
  if (fromFormat === 'txt') {
    if (toFormat === 'pdf') {
      return convertTextToPdf(buffer)
    }
  }

  throw new Error(`Konversi dari ${fromFormat} ke ${toFormat} belum didukung`)
}

// ---- Text ke PDF ----
// Generate PDF sederhana dari text menggunakan pdf-lib
async function convertTextToPdf(buffer: Buffer): Promise<ConvertResult> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const text = buffer.toString('utf-8')
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const fontSize = 11
  const lineHeight = fontSize * 1.4
  const margin = 50
  const pageWidth = 595.28 // A4
  const pageHeight = 841.89
  const maxWidth = pageWidth - margin * 2

  const paragraphs = text.split('\n')
  let page = pdfDoc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  for (const para of paragraphs) {
    const words = para.split(' ')
    let line = ''
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word
      const testWidth = font.widthOfTextAtSize(testLine, fontSize)
      if (testWidth > maxWidth && line) {
        page.drawText(line, { x: margin, y, size: fontSize, font, color: rgb(0, 0, 0) })
        y -= lineHeight
        if (y < margin) {
          page = pdfDoc.addPage([pageWidth, pageHeight])
          y = pageHeight - margin
        }
        line = word
      } else {
        line = testLine
      }
    }
    if (line) {
      page.drawText(line, { x: margin, y, size: fontSize, font, color: rgb(0, 0, 0) })
      y -= lineHeight
    }
    y -= lineHeight * 0.5
    if (y < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
    }
  }

  const pdfBuffer = await pdfDoc.save()
  return {
    buffer: Buffer.from(pdfBuffer),
    ext: 'pdf',
    mimeType: 'application/pdf',
  }
}

export async function compressFile(
  storageKey: string,
  mimeType: string,
  options?: ConvertOptions
): Promise<ConvertResult> {
  const buffer = await readFileFromStorage(storageKey)
  
  if (mimeType.startsWith('image/')) {
    return compressImage(buffer, mimeType, options)
  }
  
  if (mimeType === 'application/pdf') {
    return compressPdf(buffer, options)
  }
  
  throw new Error(`Kompresi untuk tipe ${mimeType} belum didukung`)
}
