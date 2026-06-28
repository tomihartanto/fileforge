import { ConvertResult } from './index'
import sharp from 'sharp'

// ---- DOCX ke PDF ----
// Pakai LibreOffice headless jika tersedia, fallback ke text-based approach
export async function convertDocxToPdf(buffer: Buffer): Promise<ConvertResult> {
  // Coba pakai libreoffice (paling akurat)
  const hasLibreOffice = await checkCommand('soffice')
  
  if (hasLibreOffice) {
    return convertViaLibreOffice(buffer, 'docx', 'pdf')
  }
  
  // Fallback: extract text dengan mammoth lalu generate PDF
  return convertDocxTextToPdf(buffer)
}

// ---- DOCX ke Text ----
// Pakai mammoth untuk extract text dengan formatting awareness
export async function convertDocxToText(buffer: Buffer): Promise<ConvertResult> {
  try {
    const { createRequire } = require('module')
    const nodeRequire = createRequire(typeof __filename !== 'undefined' ? __filename : process.cwd() + '/dummy.js')
    const mammoth = nodeRequire('mammoth')
    // Mammoth convert ke HTML, lalu kita strip tags untuk text bersih
    const result = await mammoth.extractRawText({ buffer })
    const text = result.value || ''
    return {
      buffer: Buffer.from(text, 'utf-8'),
      ext: 'txt',
      mimeType: 'text/plain',
    }
  } catch {
    // Fallback ke JSZip manual extraction
    return convertDocxToTextFallback(buffer)
  }
}

async function convertDocxToTextFallback(buffer: Buffer): Promise<ConvertResult> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(buffer)
  const docXml = zip.file('word/document.xml')
  if (!docXml) throw new Error('File DOCX tidak valid')
  const xmlContent = await docXml.async('string')
  const text = xmlContent
    .replace(/<w:p[ >]/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n').trim()
  return { buffer: Buffer.from(text, 'utf-8'), ext: 'txt', mimeType: 'text/plain' }
}

// ---- Helpers ----

async function checkCommand(cmd: string): Promise<boolean> {
  const { execSync } = await import('child_process')
  try {
    execSync(`which ${cmd} 2>/dev/null || where ${cmd} 2>nul`, { encoding: 'utf-8' })
    return true
  } catch {
    try {
      // Windows
      execSync(`where ${cmd}`, { encoding: 'utf-8', stdio: 'pipe' })
      return true
    } catch {
      return false
    }
  }
}

async function convertViaLibreOffice(
  buffer: Buffer,
  from: string,
  to: string
): Promise<ConvertResult> {
  const fs = await import('fs/promises')
  const path = await import('path')
  const os = await import('os')
  const { execSync } = await import('child_process')
  
  const tmpDir = path.join(os.tmpdir(), `fileforge-${Date.now()}`)
  await fs.mkdir(tmpDir, { recursive: true })
  
  const inputFile = path.join(tmpDir, `input.${from}`)
  await fs.writeFile(inputFile, buffer)
  
  try {
    execSync(
      `soffice --headless --convert-to ${to} --outdir "${tmpDir}" "${inputFile}"`,
      { timeout: 60000, stdio: 'pipe' }
    )
    
    const outputFile = path.join(tmpDir, `input.${to}`)
    const result = await fs.readFile(outputFile)
    
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      txt: 'text/plain',
    }
    
    return {
      buffer: result,
      ext: to,
      mimeType: mimeTypes[to] || 'application/octet-stream',
    }
  } finally {
    // cleanup
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
}

async function convertDocxTextToPdf(buffer: Buffer): Promise<ConvertResult> {
  // Extract text dari DOCX
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(buffer)
  const docXml = zip.file('word/document.xml')
  
  if (!docXml) throw new Error('File DOCX tidak valid')
  
  const xmlContent = await docXml.async('string')
  const text = xmlContent
    .replace(/<w:p[ >]/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
  
  // Generate PDF minimal dengan pdf-lib
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
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
    // Word wrap
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
