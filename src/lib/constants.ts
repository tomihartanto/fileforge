// Supported conversion & compression formats
export const CONVERT_MAPPINGS = {
  // PDF -> *
  'pdf-to-docx': { from: 'pdf', to: 'docx', label: 'PDF ke Word (DOCX)' },
  'pdf-to-txt': { from: 'pdf', to: 'txt', label: 'PDF ke Text' },
  'pdf-to-png': { from: 'pdf', to: 'png', label: 'PDF ke Gambar (PNG)' },
  'pdf-to-jpg': { from: 'pdf', to: 'jpg', label: 'PDF ke JPG' },
  // Word -> *
  'docx-to-pdf': { from: 'docx', to: 'pdf', label: 'Word ke PDF' },
  'docx-to-txt': { from: 'docx', to: 'txt', label: 'Word ke Text' },
  // Image -> *
  'png-to-jpg': { from: 'png', to: 'jpg', label: 'PNG ke JPG' },
  'jpg-to-png': { from: 'jpg', to: 'png', label: 'JPG ke PNG' },
  'webp-to-png': { from: 'webp', to: 'png', label: 'WEBP ke PNG' },
  'image-to-webp': { from: 'image', to: 'webp', label: 'Gambar ke WEBP' },
  'image-to-pdf': { from: 'image', to: 'pdf', label: 'Gambar ke PDF' },
} as const

export type ConversionKey = keyof typeof CONVERT_MAPPINGS

export const COMPRESS_TARGETS = {
  image: ['jpg', 'png', 'webp'],
  pdf: ['pdf'],
} as const

// Max upload size: 100MB per file (no limit on count)
export const MAX_FILE_SIZE = 100 * 1024 * 1024

export const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/svg+xml',
]

// Upload chunk size untuk file besar
export const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB
