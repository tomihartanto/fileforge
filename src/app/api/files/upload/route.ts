import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { saveFile, getStorageDriver } from '@/lib/storage'
import { ACCEPTED_MIME_TYPES, MAX_FILE_SIZE } from '@/lib/constants'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Ukuran file melebihi ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 413 }
      )
    }

    const mimeType = file.type || 'application/octet-stream'
    if (file.type && !ACCEPTED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Tipe file ${file.type} tidak didukung` },
        { status: 415 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
    const { key, url } = await saveFile(buffer, 'uploaded', ext)
    const driver = getStorageDriver()

    const record = await prisma.file.create({
      data: {
        originalName: file.name,
        storedName: key.split('/').pop() || key,
        mimeType,
        size: BigInt(file.size),
        storageKey: key,
        storageDriver: driver,
        url,
      },
    })

    return NextResponse.json({
      id: record.id,
      url,
      key,
      name: file.name,
      size: file.size,
    })
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: error.message || 'Gagal mengunggah file' },
      { status: 500 }
    )
  }
}
