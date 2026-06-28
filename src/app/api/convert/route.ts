import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { saveFile } from '@/lib/storage'
import { convertFile } from '@/lib/converters'
import { CONVERT_MAPPINGS, ConversionKey } from '@/lib/constants'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { fileId, conversion } = await request.json()

    if (!fileId || !conversion) {
      return NextResponse.json({ error: 'Parameter tidak lengkap' }, { status: 400 })
    }

    const mapping = CONVERT_MAPPINGS[conversion as ConversionKey]
    if (!mapping) {
      return NextResponse.json({ error: 'Jenis konversi tidak valid' }, { status: 400 })
    }

    const file = await prisma.file.findUnique({ where: { id: fileId } })
    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 404 })
    }

    // Create operation record
    const operation = await prisma.fileOperation.create({
      data: {
        fileId,
        type: 'convert',
        fromFormat: mapping.from,
        toFormat: mapping.to,
        status: 'processing',
      },
    })

    try {
      const result = await convertFile(file.storageKey, mapping.from, mapping.to)

      // Save result file
      const { key, url } = await saveFile(result.buffer, 'converted', result.ext)

      const originalName = file.originalName.replace(/\.[^.]+$/, '')
      const fileName = `${originalName}-converted.${result.ext}`

      await prisma.fileOperation.update({
        where: { id: operation.id },
        data: {
          status: 'completed',
          resultKey: key,
          resultUrl: url,
          resultSize: BigInt(result.buffer.length),
          completedAt: new Date(),
        },
      })

      return NextResponse.json({
        id: operation.id,
        fileName,
        url,
        size: result.buffer.length,
      })
    } catch (err: any) {
      await prisma.fileOperation.update({
        where: { id: operation.id },
        data: {
          status: 'failed',
          errorMessage: err.message,
        },
      })
      throw err
    }
  } catch (error: any) {
    console.error('Convert error:', error)
    return NextResponse.json(
      { error: error.message || 'Gagal mengkonversi file' },
      { status: 500 }
    )
  }
}
