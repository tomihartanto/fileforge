import { ConvertResult } from './index'
import { PDFDocument, PDFName, degrees, rgb, StandardFonts } from 'pdf-lib'
import sharp from 'sharp'

// Module-level require bypass untuk library yang tidak webpack-friendly
const { createRequire } = require('module')
const _nodeRequire = createRequire(typeof __filename !== 'undefined' ? __filename : process.cwd() + '/dummy.js')

// Cache instance pdfjs supaya hanya ada SATU instance (mencegah error
// "API version does not match Worker version" saat import berkali-kali).
// Juga konfigurasi workerSrc agar pdfjs bisa render di environment Next.js/webpack
// (default-nya mencari pdf.worker.mjs di path yang tidak ada saat di-bundle).
let _pdfjsPromise: Promise<any> | null = null
function getPdfJs(): Promise<any> {
  if (!_pdfjsPromise) {
    _pdfjsPromise = (async () => {
      const m: any = await import('pdfjs-dist/legacy/build/pdf.mjs')
      const pdfjs = m.default || m
      try {
        // Set worker source ke file worker bawaan package (resolve path absolut)
        // createRequire dipakai supaya path resolve konsisten di server Next.js/webpack
        const workerPath = _nodeRequire.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')
        // pdfjs menerima path file:// untuk workerSrc di Node
        const { pathToFileURL } = _nodeRequire('url')
        pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href
      } catch {}
      return pdfjs
    })()
  }
  return _pdfjsPromise
}

// ---- PDF ke Text ----
export async function convertPdfToText(buffer: Buffer): Promise<ConvertResult> {
  const text = await extractPdfText(buffer)
  return {
    buffer: Buffer.from(text, 'utf-8'),
    ext: 'txt',
    mimeType: 'text/plain',
  }
}

// ---- PDF ke DOCX ----
// Strategi:
// 1. Coba ekstrak teks berstruktur. Kalau ada teks yang cukup, bangun DOCX berformat.
// 2. Kalau teks kosong/sangat sedikit (PDF gambar/screenshot/scan), render tiap halaman
//    jadi gambar lalu EMBED ke DOCX supaya tampilannya identik dengan PDF aslinya.
export async function convertPdfToDocx(buffer: Buffer): Promise<ConvertResult> {
  const pages = await extractPdfStructured(buffer)

  // Cek apakah hasil text extraction cukup berarti (bukan kosong / bukan hasil OCR jelek)
  const totalText = pages.reduce((sum, p) => sum + p.blocks.reduce((s, b) => s + b.text.length, 0), 0)
  const hasRealText = totalText > 50 && pages.some(p => p.blocks.length > 1)

  let docxBuf: Buffer
  if (hasRealText) {
    // PDF berbasis teks -> bangun DOCX dengan formatting
    docxBuf = await buildFormattedDocx(pages)
  } else {
    // PDF gambar/screenshot -> embed gambar halaman supaya identik visual
    docxBuf = await buildImageBasedDocx(buffer)
  }

  return {
    buffer: docxBuf,
    ext: 'docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }
}

// ---- PDF ke Images ----
export async function convertPdfToImages(
  buffer: Buffer,
  format: 'png' | 'jpg',
  _options?: { dpi?: number; scale?: number }
): Promise<ConvertResult> {
  // Render halaman 1 pakai pdfjs + @napi-rs/canvas langsung (instance yang sama via getPdfJs).
  // (unpdf.renderPageAsImage gagal: "@napi-rs/canvas is not available in this environment")
  try {
    const pdfjs = await getPdfJs()
    const { createCanvas } = _nodeRequire('@napi-rs/canvas')

    const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise
    const page = await doc.getPage(1)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = createCanvas(viewport.width, viewport.height)
    const ctx = canvas.getContext('2d')
    await page.render({ canvasContext: ctx, viewport }).promise

    const buf = canvas.toBuffer('image/png')
    if (format === 'jpg') {
      const jpgBuf = await sharp(buf).jpeg({ quality: 90 }).toBuffer()
      return { buffer: jpgBuf, ext: 'jpg', mimeType: 'image/jpeg' }
    }
    return { buffer: buf, ext: 'png', mimeType: 'image/png' }
  } catch {
    // Fallback: placeholder image
  }

  const pdfDoc = await PDFDocument.load(buffer)
  const pages = pdfDoc.getPages()
  const firstPage = pages[0]
  const { width, height } = firstPage.getSize()
  const placeholder = await sharp({
    create: { width: Math.min(Math.round(width), 2000), height: Math.min(Math.round(height), 2800), channels: 3, background: { r: 255, g: 255, b: 255 } },
  }).composite([{
    input: Buffer.from(`<svg width="${Math.min(Math.round(width), 2000)}" height="${Math.min(Math.round(height), 2800)}"><rect width="100%" height="100%" fill="white"/><text x="50%" y="50%" text-anchor="middle" font-size="24" fill="#999">PDF Preview - ${pages.length} halaman</text></svg>`),
    top: 0, left: 0,
  }])
  const imageBuffer = format === 'png' ? await placeholder.png().toBuffer() : await placeholder.jpeg({ quality: 90 }).toBuffer()
  return { buffer: imageBuffer, ext: format, mimeType: format === 'png' ? 'image/png' : 'image/jpeg' }
}

// =============================================
// TEXT EXTRACTION
// =============================================

async function extractPdfText(buffer: Buffer): Promise<string> {
  // Strategy: pdfjs text layer -> pdf2json -> pdf-lib fallback -> OCR
  let text = ''

  // 1. Coba pdfjs text layer (instance yang sama dengan OCR renderer)
  try {
    const pdfjs = await getPdfJs()
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise
    const lines: string[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      const pageText = content.items.map((it: any) => it.str).join(' ')
      if (pageText.trim()) lines.push(`--- Halaman ${i} ---\n${pageText.trim()}`)
    }
    text = lines.join('\n\n')
    if (text.trim().length < 10) text = ''
  } catch {}

  // 2. Kalau pdfjs kosong, coba pdf2json
  if (!text) {
    try {
      text = await extractWithPdf2Json(buffer)
    } catch {}
  }

  // 3. Kalau masih kosong, coba pdf-lib content stream
  if (!text) {
    try {
      text = await extractTextWithPdfLib(buffer)
    } catch {}
  }

  // 4. Kalau masih kosong → OCR fallback (PDF hasil scan / text di-convert ke outline)
  if (!text || text.trim().length < 5) {
    text = await ocrPdfPages(buffer)
  }

  return text || '(Tidak ada teks yang bisa diekstrak dari PDF ini.)'
}

// =============================================
// STRUCTURED EXTRACTION (untuk DOCX dengan formatting)
// =============================================

async function extractPdfStructured(buffer: Buffer): Promise<StructuredPage[]> {
  // 1. Coba pdfjs structured text items (punya fontSize, position, dll).
  //    Pakai instance yang sama dengan OCR (getPdfJs) supaya tidak konflik versi.
  try {
    const pdfjs = await getPdfJs()
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise
    const pages: StructuredPage[] = []
    for (let pIdx = 1; pIdx <= doc.numPages; pIdx++) {
      const page = await doc.getPage(pIdx)
      const content = await page.getTextContent()
      const blocks: TextBlock[] = content.items.map((item: any) => ({
        text: item.str || '',
        x: item.transform ? item.transform[4] : (item.x || 0),
        y: item.transform ? item.transform[5] : (item.y || 0),
        fontSize: item.height || 12,
        bold: false,
        italic: false,
        page: pIdx - 1,
      })).filter((b: TextBlock) => b.text.trim())
      pages.push({ page: pIdx - 1, blocks })
    }

    // Kalau ada konten, return
    if (pages.some(p => p.blocks.length > 0)) {
      return pages
    }
  } catch {}

  // 2. Fallback: pdf2json structured
  try {
    const pages = await extractStructuredPdf2Json(buffer)
    if (pages.length > 0) return pages
  } catch {}

  // 3. Fallback: OCR seluruh halaman
  try {
    const ocrText = await ocrPdfPages(buffer)
    if (ocrText && ocrText.trim()) {
      return [{ page: 0, blocks: [{ text: ocrText, x: 0, y: 0, fontSize: 12, bold: false, italic: false, page: 0 }] }]
    }
  } catch {}

  return []
}

// =============================================
// HELPER: pdf2json extraction
// =============================================

async function extractWithPdf2Json(buffer: Buffer): Promise<string> {
  const pages = await extractStructuredPdf2Json(buffer)
  const lines: string[] = []
  for (const page of pages) {
    const lineGroups = groupByLine(page.blocks)
    for (const line of lineGroups) {
      const lineText = line.map(b => b.text).join(' ').trim()
      if (lineText) lines.push(lineText)
    }
  }
  return lines.join('\n').trim()
}

function extractStructuredPdf2Json(buffer: Buffer): Promise<StructuredPage[]> {
  return new Promise((resolve) => {
    const PDFParser = _nodeRequire('pdf2json')
    const parser = new PDFParser()
    let settled = false

    const done = (result: StructuredPage[]) => {
      if (!settled) { settled = true; resolve(result) }
    }

    parser.on('pdfParser_dataReady', (pdfData: any) => {
      if (!pdfData || !pdfData.formImage || !pdfData.formImage.Pages) {
        done([])
        return
      }
      const pages: StructuredPage[] = []
      try {
        for (let pIdx = 0; pIdx < pdfData.formImage.Pages.length; pIdx++) {
          const page = pdfData.formImage.Pages[pIdx]
          if (!page || !page.Texts) continue
          const blocks: TextBlock[] = []
          for (const text of page.Texts) {
            if (!text || !text.R) continue
            for (const run of text.R) {
              try {
                const textContent = decodeURIComponent(run.T || '')
                if (!textContent.trim()) continue
                let fontSize = 12, bold = false, italic = false
                if (run.TS) {
                  if (run.TS[0]) fontSize = run.TS[0]
                  if (run.TS[1] && run.TS[1] >= 700) bold = true
                  if (run.TS[2] && run.TS[2] === 1) italic = true
                }
                blocks.push({ text: textContent, x: text.x || 0, y: text.y || 0, fontSize, bold, italic, page: pIdx })
              } catch {}
            }
          }
          pages.push({ page: pIdx, blocks })
        }
      } catch {}
      done(pages)
    })

    parser.on('pdfParser_dataError', () => done([]))
    setTimeout(() => done([]), 15000)
    parser.parseBuffer(buffer)
  })
}

// =============================================
// HELPER: pdf-lib content stream fallback
// =============================================

async function extractTextWithPdfLib(buffer: Buffer): Promise<string> {
  try {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true })
    const pages = pdfDoc.getPages()
    const lines: string[] = []
    for (let i = 0; i < pages.length; i++) {
      const text = extractTextFromContentStream(pages[i])
      if (text && text.trim()) {
        lines.push(`--- Halaman ${i + 1} ---`)
        lines.push(text)
        lines.push('')
      }
    }
    return lines.join('\n').trim()
  } catch {
    return ''
  }
}

function extractTextFromContentStream(page: any): string {
  const texts: string[] = []
  try {
    const node = page.node
    const contents = node.Contents()
    if (!contents) return ''
    const streams: any[] = []
    if (contents.array) { for (const ref of contents.array) streams.push(ref) }
    else { streams.push(contents) }
    for (const streamRef of streams) {
      const stream = page.doc.context.lookup(streamRef)
      if (stream && stream.getContents) {
        const raw = stream.getContents()
        const decoded = Buffer.from(raw).toString('latin1')
        const tjMatches = decoded.matchAll(/\(([^)]*)\)\s*Tj/g)
        for (const m of tjMatches) { if (m[1]) texts.push(decodePdfString(m[1])) }
        const tjArrayMatches = decoded.matchAll(/\[([^\]]*)\]\s*TJ/g)
        for (const m of tjArrayMatches) {
          const inner = m[1]
          const strMatches = inner.matchAll(/\(([^)]*)\)/g)
          for (const sm of strMatches) { if (sm[1]) texts.push(decodePdfString(sm[1])) }
        }
      }
    }
  } catch {}
  return texts.join(' ').replace(/\s+/g, ' ').trim()
}

function decodePdfString(s: string): string {
  return s.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(').replace(/\\\)/g, ')').replace(/\\\\/g, '\\')
}

// =============================================
// OCR: Render PDF ke gambar lalu baca teks
// =============================================

async function ocrPdfPages(buffer: Buffer): Promise<string> {
  try {
    // Pakai instance pdfjs yang SAMA dengan text extraction (lihat getPdfJs),
    // untuk menghindari error "API version does not match Worker version".
    const pdfjs = await getPdfJs()
    const { createCanvas } = _nodeRequire('@napi-rs/canvas')

    const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise
    const totalPages = doc.numPages

    // Load tesseract.js worker sekali, reuse untuk semua halaman
    const { createWorker } = _nodeRequire('tesseract.js')
    const worker = await createWorker('ind+eng', 1, { logger: () => {} })

    let fullText = ''
    // OCR maksimal 5 halaman pertama (mencegah timeout di serverless)
    const maxPages = Math.min(totalPages, 5)

    for (let i = 1; i <= maxPages; i++) {
      try {
        const page = await doc.getPage(i)
        const viewport = page.getViewport({ scale: 2 })
        const canvas = createCanvas(viewport.width, viewport.height)
        const ctx = canvas.getContext('2d')
        await page.render({ canvasContext: ctx, viewport }).promise
        const imgBuffer = canvas.toBuffer('image/png')

        const { data } = await worker.recognize(imgBuffer)
        if (data && data.text && data.text.trim()) {
          fullText += `--- Halaman ${i} ---\n${data.text.trim()}\n\n`
        }
      } catch {}
    }

    await worker.terminate()
    return fullText.trim()
  } catch {
    return ''
  }
}

// =============================================
// TYPES
// =============================================

interface TextBlock {
  text: string
  x: number
  y: number
  fontSize: number
  bold: boolean
  italic: boolean
  page: number
}

interface StructuredPage {
  page: number
  blocks: TextBlock[]
}

// =============================================
// HELPER: Group by line
// =============================================

function groupByLine(blocks: TextBlock[]): TextBlock[][] {
  if (blocks.length === 0) return []
  const sorted = [...blocks].sort((a, b) => {
    const yDiff = Math.abs(a.y - b.y)
    if (yDiff < 1.5) return a.x - b.x
    return a.y - b.y
  })
  const lines: TextBlock[][] = []
  let currentLine: TextBlock[] = [sorted[0]]
  let lastY = sorted[0].y
  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].y - lastY) < 1.5) {
      currentLine.push(sorted[i])
    } else {
      lines.push(currentLine)
      currentLine = [sorted[i]]
      lastY = sorted[i].y
    }
  }
  if (currentLine.length > 0) lines.push(currentLine)
  return lines
}

// =============================================
// DOCX BUILDER dengan formatting
// =============================================

async function buildFormattedDocx(pages: StructuredPage[]): Promise<Buffer> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = _nodeRequire('docx')
  const children: any[] = []
  const allSizes = pages.flatMap(p => p.blocks.map(b => b.fontSize))
  const medianSize = allSizes.length > 0
    ? allSizes.sort((a, b) => a - b)[Math.floor(allSizes.length / 2)]
    : 12

  for (const page of pages) {
    const lines = groupByLine(page.blocks)
    for (const line of lines) {
      const lineText = line.map(b => b.text).join(' ').trim()
      if (!lineText) continue
      const maxFontSize = Math.max(...line.map(b => b.fontSize))
      const isHeading = maxFontSize >= medianSize * 1.3
      const isLargeHeading = maxFontSize >= medianSize * 1.6
      const textRuns = line.map(b => {
        const size = Math.round(b.fontSize * 2)
        return new TextRun({ text: b.text, bold: b.bold, italics: b.italic, size: size || 24, font: 'Calibri' })
      })
      children.push(new Paragraph({
        children: textRuns,
        heading: isLargeHeading ? HeadingLevel.HEADING_1 : isHeading ? HeadingLevel.HEADING_2 : undefined,
        spacing: { after: 120 },
      }))
    }
    if (page !== pages[pages.length - 1]) {
      children.push(new Paragraph({ children: [new TextRun({ text: '', break: 1 })], pageBreakBefore: true }))
    }
  }

  if (children.length === 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: '(Tidak ada teks yang bisa diekstrak dari PDF ini.)' })] }))
  }

  const doc = new Document({ sections: [{ properties: {}, children }] })
  return Buffer.from(await Packer.toBuffer(doc))
}

// =============================================
// DOCX BUILDER berbasis gambar (untuk PDF screenshot/scan)
// Render tiap halaman jadi PNG lalu embed ke DOCX supaya tampilannya identik
// dengan PDF aslinya. Batasi max 10 halaman untuk mencegah file terlalu besar.
// =============================================

async function buildImageBasedDocx(buffer: Buffer): Promise<Buffer> {
  const { Document, Packer, Paragraph, ImageRun, PageOrientation, convertInchesToTwip } = _nodeRequire('docx')
  const pdfjs = await getPdfJs()
  const sharp = _nodeRequire('sharp')

  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise
  const totalPages = doc.numPages
  const maxPages = Math.min(totalPages, 10)
  const scale = 2 // faktor render (~144 DPI)

  const children: any[] = []
  const firstPage = await doc.getPage(1)
  const firstViewport = firstPage.getViewport({ scale: 1 })
  const pageWidthInch = firstViewport.width / 72
  const pageHeightInch = firstViewport.height / 72

  for (let i = 1; i <= maxPages; i++) {
    const page = await doc.getPage(i)
    const viewport = page.getViewport({ scale: 1 })
    const W = Math.round(viewport.width * scale)
    const H = Math.round(viewport.height * scale)

    // COMPOSE: extract gambar asli dari PDF + tempatkan sesuai posisinya.
    // Pendekatan ini lebih akurat daripada page.render() pdfjs, karena beberapa PDF
    // punya operator yang tidak bisa dirender pdfjs (warning "TT: undefined function")
    // sehingga konten hilang. Dengan compose manual, kita pakai image data asli.
    let pageImageBuffer: Buffer
    try {
      const ops = await page.getOperatorList()
      let stateStack: number[][] = []
      let currentMatrix = [1, 0, 0, 1, 0, 0]
      const layers: { input: Buffer; top: number; left: number }[] = []

      for (let j = 0; j < ops.fnArray.length; j++) {
        const fn = ops.fnArray[j]
        const args = ops.argsArray[j]
        if (fn === pdfjs.OPS.transform) {
          currentMatrix = args.slice(0, 6)
        } else if (fn === pdfjs.OPS.save) {
          stateStack.push([...currentMatrix])
        } else if (fn === pdfjs.OPS.restore) {
          currentMatrix = stateStack.pop() || currentMatrix
        } else if (fn === pdfjs.OPS.paintImageXObject) {
          try {
            const imgName = args[0]
            const imgObj = await new Promise<any>((res, rej) => {
              page.objs.get(imgName, (o: any) => (o ? res(o) : rej(new Error('null'))), true)
            })
            if (!imgObj || !imgObj.data) continue
            const channels = imgObj.kind === 1 ? 1 : imgObj.kind === 2 ? 3 : 4
            const imgBuf = Buffer.from(imgObj.data)
            const dx = Math.round(currentMatrix[4] * scale)
            const dw = Math.round(currentMatrix[0] * scale)
            const dh = Math.round(currentMatrix[3] * scale)
            // PDF: origin kiri-bawah -> convert ke origin kiri-atas
            const dy = H - Math.round(currentMatrix[5] * scale) - dh
            const resized = await sharp(imgBuf, {
              raw: { width: imgObj.width, height: imgObj.height, channels },
            }).resize(dw, dh, { fit: 'fill' }).png().toBuffer()
            layers.push({ input: resized, top: dy, left: dx })
          } catch {}
        }
      }

      // Composite semua layer di atas background putih
      let pipeline = sharp({
        create: { width: W, height: H, channels: 3, background: { r: 255, g: 255, b: 255 } },
      }).png()
      if (layers.length > 0) pipeline = pipeline.composite(layers)
      pageImageBuffer = await pipeline.jpeg({ quality: 95 }).toBuffer()
    } catch {
      // Fallback: render pdfjs biasa kalau compose gagal
      const { createCanvas } = _nodeRequire('@napi-rs/canvas')
      const vp = page.getViewport({ scale })
      const canvas = createCanvas(vp.width, vp.height)
      const ctx = canvas.getContext('2d')
      await page.render({ canvasContext: ctx, viewport: vp }).promise
      pageImageBuffer = canvas.toBuffer('image/jpeg', { quality: 92 })
    }

    children.push(new Paragraph({
      spacing: { before: 0, after: 0, line: 240, lineRule: 'exact' },
      children: [new ImageRun({
        type: 'jpg',
        data: pageImageBuffer,
        transformation: {
          width: Math.round(pageWidthInch * 96),
          height: Math.round(pageHeightInch * 96),
        },
      })],
    }))

    if (i < maxPages) {
      children.push(new Paragraph({
        spacing: { before: 0, after: 0, line: 240, lineRule: 'exact' },
        children: [],
        pageBreakBefore: true,
      }))
    }
  }

  const docDoc = new Document({
    sections: [{
      properties: {
        page: {
          size: {
            orientation: pageWidthInch > pageHeightInch ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
            width: convertInchesToTwip(pageWidthInch),
            height: convertInchesToTwip(pageHeightInch),
          },
          margin: { top: 0, right: 0, bottom: 0, left: 0, header: 0, footer: 0, gutter: 0 },
        },
      },
      children,
    }],
  })

  return Buffer.from(await Packer.toBuffer(docDoc))
}
