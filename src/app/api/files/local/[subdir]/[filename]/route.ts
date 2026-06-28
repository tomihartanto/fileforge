import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: { subdir: string; filename: string } }
) {
  try {
    const { subdir, filename } = params

    // Validasi path traversal untuk KEDUA parameter (filename DAN subdir)
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
    }
    if (subdir.includes('..') || subdir.includes('/') || subdir.includes('\\')) {
      return NextResponse.json({ error: 'Invalid directory' }, { status: 400 })
    }

    const filepath = path.join(process.cwd(), 'assets', 'uploads', subdir, filename)
    const buffer = await readFile(filepath)

    // Baca nama file download dari query param ?name=
    // Kalau tidak ada, fallback ke UUID filename
    const downloadName = request.nextUrl.searchParams.get('name') || filename

    const ext = filename.split('.').pop()?.toLowerCase()
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      doc: 'application/msword',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      gif: 'image/gif',
      txt: 'text/plain',
      csv: 'text/csv',
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeTypes[ext || ''] || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${downloadName}"`,
        'Cache-Control': 'private, max-age=0',
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 404 })
  }
}
