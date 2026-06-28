import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { saveFile } from '@/lib/storage'
import { compressFile } from '@/lib/converters'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { fileId, quality, maxWidth } = await request.json()

    if (!fileId) {
      return NextResponse.json({ error: 'File ID diperlukan' }, { status: 400 })
    }

    const file = await prisma.file.findUnique({ where: { id: fileId } })
    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 404 })
    }

    const operation = await prisma.fileOperation.create({
      data: {
        fileId,
        type: 'compress',
        status: 'processing',
        options: { quality, maxWidth },
      },
    })

    try {
      const result = await compressFile(file.storageKey, file.mimeType, { quality, maxWidth })
      const { key, url } = await saveFile(result.buffer, 'compressed', result.ext)

      const originalName = file.originalName.replace(/\.[^.]+$/, '')
      const fileName = `${originalName}-compressed.${result.ext}`
      const originalSize = Number(file.size)
      const resultSize = result.buffer.length
      const savings = Math.round((1 - resultSize / originalSize) * 100)

      await prisma.fileOperation.update({
        where: { id: operation.id },
        data: {
          status: 'completed',
          resultKey: key,
          resultUrl: url,
          resultSize: BigInt(resultSize),
          completedAt: new Date(),
        },
      })

      return NextResponse.json({
        id: operation.id,
        fileName,
        url,
        size: resultSize,
        savings: Math.max(0, savings),
      })
    } catch (err: any) {
      await prisma.fileOperation.update({
        where: { id: operation.id },
        data: { status: 'failed', errorMessage: err.message },
      })
      throw err
    }
  } catch (error: any) {
    console.error('Compress error:', error)
    return NextResponse.json(
      { error: error.message || 'Gagal mengompres file' },
      { status: 500 }
    )
  }
}
