import { ConvertResult } from './index'
import sharp from 'sharp'

export async function convertImageFormat(
  buffer: Buffer,
  fromFormat: string,
  toFormat: string,
  options?: { quality?: number }
): Promise<ConvertResult> {
  const quality = options?.quality || 90
  let pipeline = sharp(buffer)
  
  const format = toFormat.toLowerCase()
  
  if (format === 'jpg' || format === 'jpeg') {
    pipeline = pipeline.jpeg({ quality, mozjpeg: true })
  } else if (format === 'png') {
    pipeline = pipeline.png({ quality, compressionLevel: 9 })
  } else if (format === 'webp') {
    pipeline = pipeline.webp({ quality })
  } else if (format === 'gif') {
    pipeline = pipeline.gif()
  } else if (format === 'tiff') {
    pipeline = pipeline.tiff({ quality })
  } else {
    throw new Error(`Format output ${toFormat} tidak didukung`)
  }
  
  const result = await pipeline.toBuffer()
  
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    tiff: 'image/tiff',
  }
  
  return {
    buffer: result,
    ext: format === 'jpeg' ? 'jpg' : format,
    mimeType: mimeTypes[format] || 'image/png',
  }
}

export async function convertImageToWebP(buffer: Buffer): Promise<ConvertResult> {
  const result = await sharp(buffer)
    .webp({ quality: 85 })
    .toBuffer()
  
  return {
    buffer: result,
    ext: 'webp',
    mimeType: 'image/webp',
  }
}

export async function imagesToPdf(images: Buffer[]): Promise<ConvertResult> {
  const { PDFDocument } = await import('pdf-lib')
  const pdfDoc = await PDFDocument.create()
  
  for (const imgBuffer of images) {
    const img = await sharp(imgBuffer).metadata()
    let embeddedImg
    
    if (img.format === 'jpeg' || img.format === 'jpg') {
      embeddedImg = await pdfDoc.embedJpg(imgBuffer)
    } else {
      // Convert ke PNG dulu kalau bukan JPEG
      const pngBuffer = await sharp(imgBuffer).png().toBuffer()
      embeddedImg = await pdfDoc.embedPng(pngBuffer)
    }
    
    const page = pdfDoc.addPage([embeddedImg.width, embeddedImg.height])
    page.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width: embeddedImg.width,
      height: embeddedImg.height,
    })
  }
  
  const pdfBytes = await pdfDoc.save()
  
  return {
    buffer: Buffer.from(pdfBytes),
    ext: 'pdf',
    mimeType: 'application/pdf',
  }
}
