// Registry semua tools FileForge
// Format mirip FreeConvert: setiap tool punya slug, label, kategori

export type ToolCategory = "convert" | "edit" | "compress"
export type FileCategory = "pdf" | "document" | "image" | "archive"

export interface Tool {
  slug: string
  label: string
  shortLabel: string
  category: ToolCategory
  fileCategory: FileCategory
  fromFormat: string
  toFormat: string
  icon: string
  // Untuk API endpoint
  conversionKey?: string
  editAction?: string
  compressTarget?: "image" | "pdf"
  description: string
}

export const TOOLS: Tool[] = [
  // ====== PDF → Document ======
  { slug: "pdf-to-word", label: "PDF ke Word", shortLabel: "PDF → DOCX", category: "convert", fileCategory: "pdf", fromFormat: "pdf", toFormat: "docx", icon: "FileText", conversionKey: "pdf-to-docx", description: "Ubah PDF menjadi dokumen Word yang bisa diedit" },
  { slug: "pdf-to-txt", label: "PDF ke Text", shortLabel: "PDF → TXT", category: "convert", fileCategory: "pdf", fromFormat: "pdf", toFormat: "txt", icon: "FileText", conversionKey: "pdf-to-txt", description: "Ekstrak teks dari PDF" },
  { slug: "pdf-to-jpg", label: "PDF ke JPG", shortLabel: "PDF → JPG", category: "convert", fileCategory: "pdf", fromFormat: "pdf", toFormat: "jpg", icon: "ImageIcon", conversionKey: "pdf-to-jpg", description: "Konversi halaman PDF menjadi gambar JPG" },
  { slug: "pdf-to-png", label: "PDF ke PNG", shortLabel: "PDF → PNG", category: "convert", fileCategory: "pdf", fromFormat: "pdf", toFormat: "png", icon: "ImageIcon", conversionKey: "pdf-to-png", description: "Konversi halaman PDF menjadi gambar PNG" },

  // ====== Document → PDF ======
  { slug: "word-to-pdf", label: "Word ke PDF", shortLabel: "DOCX → PDF", category: "convert", fileCategory: "document", fromFormat: "docx", toFormat: "pdf", icon: "FileType", conversionKey: "docx-to-pdf", description: "Ubah dokumen Word menjadi PDF" },
  { slug: "word-to-txt", label: "Word ke Text", shortLabel: "DOCX → TXT", category: "convert", fileCategory: "document", fromFormat: "docx", toFormat: "txt", icon: "FileText", conversionKey: "docx-to-txt", description: "Ekstrak teks dari dokumen Word" },

  // ====== Image conversions ======
  { slug: "png-to-jpg", label: "PNG ke JPG", shortLabel: "PNG → JPG", category: "convert", fileCategory: "image", fromFormat: "png", toFormat: "jpg", icon: "ImageIcon", conversionKey: "png-to-jpg", description: "Ubah PNG menjadi JPG" },
  { slug: "jpg-to-png", label: "JPG ke PNG", shortLabel: "JPG → PNG", category: "convert", fileCategory: "image", fromFormat: "jpg", toFormat: "png", icon: "ImageIcon", conversionKey: "jpg-to-png", description: "Ubah JPG menjadi PNG" },
  { slug: "image-to-webp", label: "Gambar ke WEBP", shortLabel: "→ WEBP", category: "convert", fileCategory: "image", fromFormat: "image", toFormat: "webp", icon: "ImageIcon", conversionKey: "image-to-webp", description: "Ubah gambar apa pun menjadi WEBP" },
  { slug: "webp-to-png", label: "WEBP ke PNG", shortLabel: "WEBP → PNG", category: "convert", fileCategory: "image", fromFormat: "webp", toFormat: "png", icon: "ImageIcon", conversionKey: "webp-to-png", description: "Ubah WEBP menjadi PNG" },
  { slug: "image-to-pdf", label: "Gambar ke PDF", shortLabel: "IMG → PDF", category: "convert", fileCategory: "image", fromFormat: "image", toFormat: "pdf", icon: "ImageIcon", conversionKey: "image-to-pdf", description: "Gabungkan gambar menjadi satu PDF" },

  // ====== PDF Edit Tools ======
  { slug: "merge-pdf", label: "Gabungkan PDF", shortLabel: "Merge PDF", category: "edit", fileCategory: "pdf", fromFormat: "pdf", toFormat: "pdf", icon: "Combine", editAction: "merge", description: "Gabungkan beberapa PDF menjadi satu" },
  { slug: "split-pdf", label: "Pisahkan PDF", shortLabel: "Split PDF", category: "edit", fileCategory: "pdf", fromFormat: "pdf", toFormat: "pdf", icon: "Scissors", editAction: "split", description: "Pisahkan PDF menjadi beberapa file" },
  { slug: "rotate-pdf", label: "Putar PDF", shortLabel: "Rotate PDF", category: "edit", fileCategory: "pdf", fromFormat: "pdf", toFormat: "pdf", icon: "RotateCw", editAction: "rotate", description: "Putar halaman PDF 90°, 180°, atau 270°" },
  { slug: "delete-pages", label: "Hapus Halaman", shortLabel: "Delete Pages", category: "edit", fileCategory: "pdf", fromFormat: "pdf", toFormat: "pdf", icon: "Trash2", editAction: "delete_pages", description: "Hapus halaman tertentu dari PDF" },
  { slug: "reorder-pages", label: "Susun Ulang Halaman", shortLabel: "Reorder Pages", category: "edit", fileCategory: "pdf", fromFormat: "pdf", toFormat: "pdf", icon: "ArrowUpDown", editAction: "reorder", description: "Ubah urutan halaman PDF" },
  { slug: "watermark-pdf", label: "Watermark PDF", shortLabel: "Watermark", category: "edit", fileCategory: "pdf", fromFormat: "pdf", toFormat: "pdf", icon: "Stamp", editAction: "watermark", description: "Tambahkan watermark teks ke PDF" },

  // ====== Compress Tools ======
  { slug: "compress-image", label: "Kompres Gambar", shortLabel: "Compress IMG", category: "compress", fileCategory: "image", fromFormat: "image", toFormat: "image", icon: "ImageIcon", compressTarget: "image", description: "Kurangi ukuran gambar JPG, PNG, atau WEBP" },
  { slug: "compress-pdf", label: "Kompres PDF", shortLabel: "Compress PDF", category: "compress", fileCategory: "pdf", fromFormat: "pdf", toFormat: "pdf", icon: "FileText", compressTarget: "pdf", description: "Kurangi ukuran file PDF" },
]

// Helper functions
export function getToolBySlug(slug: string): Tool | undefined {
  return TOOLS.find((t) => t.slug === slug)
}

export function getToolsByCategory(category: ToolCategory): Tool[] {
  return TOOLS.filter((t) => t.category === category)
}

export function searchTools(query: string): Tool[] {
  const q = query.toLowerCase().trim()
  if (!q) return TOOLS
  return TOOLS.filter(
    (t) =>
      t.label.toLowerCase().includes(q) ||
      t.shortLabel.toLowerCase().includes(q) ||
      t.slug.includes(q) ||
      t.fromFormat.includes(q) ||
      t.toFormat.includes(q)
  )
}
