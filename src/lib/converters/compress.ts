import { ConvertResult } from './index'
import sharp from 'sharp'
import { PDFDocument } from 'pdf-lib'

export async function compressImage(
  buffer: Buffer,
  mimeType: string,
  options?: { quality?: number; maxWidth?: number; maxHeight?: number }
): Promise<ConvertResult> {
  const quality = options?.quality || 60
  const maxWidth = options?.maxWidth || 1920
  const maxHeight = options?.maxHeight || 1080
  
  let pipeline = sharp(buffer)
  
  // Resize kalau lebih besar dari max
  const metadata = await sharp(buffer).metadata()
  if (metadata.width && metadata.width > maxWidth) {
    pipeline = pipeline.resize({
      width: maxWidth,
      height: maxHeight,
      fit: 'inside',
      withoutEnlargement: true,
    })
  }
  
  // Compress berdasarkan format
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    pipeline = pipeline.jpeg({ quality, mozjpeg: true, chromaSubsampling: '4:2:0' })
  } else if (mimeType === 'image/png') {
    pipeline = pipeline.png({
      compressionLevel: 9,
    })
  } else if (mimeType === 'image/webp') {
    pipeline = pipeline.webp({ quality })
  } else {
    // Default: convert ke webp untuk kompresi maksimal
    pipeline = pipeline.webp({ quality })
  }
  
  const result = await pipeline.toBuffer()
  const ext = mimeType === 'image/png' ? 'png'
    : mimeType === 'image/webp' ? 'webp'
    : 'jpg'
  
  return {
    buffer: result,
    ext,
    mimeType,
  }
}

export async function compressPdf(
  buffer: Buffer,
  options?: { quality?: number }
): Promise<ConvertResult> {
  // Kompres PDF dengan re-save dan optimasi objek
  const pdfDoc = await PDFDocument.load(buffer)
  
  // Hapus metadata berlebih
  pdfDoc.setTitle('')
  pdfDoc.setAuthor('')
  pdfDoc.setSubject('')
  pdfDoc.setKeywords([])
  pdfDoc.setProducer('FileForge')
  pdfDoc.setCreator('FileForge')
  
  const saved = await pdfDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
  })
  
  return {
    buffer: Buffer.from(saved),
    ext: 'pdf',
    mimeType: 'application/pdf',
  }
}
