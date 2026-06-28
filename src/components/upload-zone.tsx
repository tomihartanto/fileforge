"use client"

import { useCallback, useState, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { UploadCloud, File as FileIcon, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn, formatBytes } from '@/lib/utils'
import { toast } from 'sonner'

export interface UploadedFile {
  id: string
  file: File
  progress: number
  status: 'uploading' | 'uploaded' | 'error' | 'retrying'
  serverId?: string
  serverUrl?: string
  originalName: string
  size: number
  mimeType: string
  ext: string
  error?: string
  retryCount?: number
}

interface UploadZoneProps {
  onFilesChange: (files: UploadedFile[]) => void
  files: UploadedFile[]
  accept?: Record<string, string[]>
  maxFiles?: number
  hint?: string
  compact?: boolean
}

// Maksimal file yang diupload bersamaan
const MAX_CONCURRENT = 3
// Maksimal retry saat gagal
const MAX_RETRIES = 3
// Timeout per upload (ms) - 2 menit per file
const UPLOAD_TIMEOUT = 120 * 1000

export function UploadZone({
  onFilesChange,
  files,
  accept,
  maxFiles = Infinity,
  hint,
  compact = false,
}: UploadZoneProps) {
  // Mutable ref untuk track files terbaru tanpa stale closure
  // Update ref SECARA LANGSUNG di setiap operasi, bukan saat render
  const filesRef = useRef(files)

  const syncFiles = useCallback(
    (next: UploadedFile[]) => {
      filesRef.current = next  // sync ref DULU sebelum render
      onFilesChange(next)      // baru trigger parent re-render
    },
    [onFilesChange]
  )

  const updateFile = useCallback(
    (id: string, patch: Partial<UploadedFile>) => {
      // Selalu baca dari ref yang sudah di-update oleh operasi sebelumnya
      const current = filesRef.current
      const next = current.map((f) => (f.id === id ? { ...f, ...patch } : f))
      filesRef.current = next  // sync ref langsung
      onFilesChange(next)
    },
    [onFilesChange]
  )

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return

      const newFiles: UploadedFile[] = acceptedFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
        progress: 0,
        status: 'uploading',
        originalName: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        ext: file.name.split('.').pop()?.toLowerCase() || 'bin',
      }))

      // Tambahkan ke daftar
      const combined = [...filesRef.current, ...newFiles]
      filesRef.current = combined
      onFilesChange(combined)

      // Upload dengan concurrency limit
      await runUploadQueue(newFiles, updateFile)
    },
    [onFilesChange, updateFile]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles: maxFiles === Infinity ? undefined : maxFiles,
    maxSize: 100 * 1024 * 1024,
  })

  const removeFile = (id: string) => {
    const next = filesRef.current.filter((f) => f.id !== id)
    filesRef.current = next
    onFilesChange(next)
  }

  const retryFile = async (id: string) => {
    const file = filesRef.current.find((f) => f.id === id)
    if (!file) return
    updateFile(id, { status: 'uploading', progress: 0, error: undefined })
    await uploadWithRetry(file, updateFile)
  }

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          'relative cursor-pointer rounded-xl border-2 border-dashed transition-all duration-200',
          isDragActive
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-border hover:border-primary/50 hover:bg-accent/50',
          compact ? 'p-6' : 'p-10 md:p-16'
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center text-center space-y-3">
          <div className={cn(
            'flex items-center justify-center rounded-full bg-primary/10 text-primary transition-transform',
            isDragActive && 'scale-110',
            compact ? 'h-12 w-12' : 'h-16 w-16'
          )}>
            <UploadCloud className={compact ? 'h-6 w-6' : 'h-8 w-8'} />
          </div>
          <div className="space-y-1">
            <p className={cn('font-semibold', compact ? 'text-base' : 'text-lg')}>
              {isDragActive ? 'Lepaskan file di sini...' : 'Tarik file ke sini atau klik untuk pilih'}
            </p>
            <p className="text-sm text-muted-foreground">
              {hint || 'Bisa upload banyak file sekaligus. Maks 100MB per file.'}
            </p>
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((uf) => (
            <div
              key={uf.id}
              className="flex items-center gap-3 rounded-lg border bg-card p-3"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                {uf.status === 'uploading' ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <FileIcon className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{uf.originalName}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatBytes(uf.size)}
                  </span>
                </div>
                {uf.status === 'uploading' && (
                  <Progress value={uf.progress} className="mt-1.5 h-1.5" />
                )}
                {uf.status === 'retrying' && (
                  <p className="mt-1 text-xs text-amber-500 flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Mencoba ulang... (attempt {(uf.retryCount || 0) + 1}/{MAX_RETRIES})
                  </p>
                )}
                {uf.status === 'error' && (
                  <div className="mt-1 flex items-center gap-2">
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {uf.error || 'Gagal upload'}
                    </p>
                    <button
                      onClick={() => retryFile(uf.id)}
                      className="text-xs text-primary hover:underline"
                    >
                      Coba lagi
                    </button>
                  </div>
                )}
              </div>
              <div className="shrink-0 flex items-center gap-1">
                {uf.status === 'uploaded' && (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => removeFile(uf.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Upload Queue: batasi concurrency supaya tidak membebani jaringan ----
async function runUploadQueue(
  files: UploadedFile[],
  updateFile: (id: string, patch: Partial<UploadedFile>) => void
) {
  let index = 0

  async function worker() {
    while (index < files.length) {
      const currentIndex = index++
      const file = files[currentIndex]
      await uploadWithRetry(file, updateFile)
    }
  }

  // Jalankan N worker secara paralel
  const workers = Array.from({ length: Math.min(MAX_CONCURRENT, files.length) }, () => worker())
  await Promise.all(workers)
}

// ---- Upload dengan auto-retry ----
async function uploadWithRetry(
  uf: UploadedFile,
  updateFile: (id: string, patch: Partial<UploadedFile>) => void
) {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        // Tandai sedang retry
        updateFile(uf.id, { status: 'retrying', retryCount: attempt, progress: 0 })
        // Exponential backoff: 1s, 2s, 4s
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)))
      }

      const result = await uploadSingleFile(uf, updateFile)
      updateFile(uf.id, {
        status: 'uploaded',
        progress: 100,
        serverId: result.id,
        serverUrl: result.url,
        error: undefined,
      })
      return // sukses
    } catch (err: any) {
      lastError = err
      // Kalau bukan error jaringan, jangan retry
      const isNetworkError = err.message.includes('jaringan') || err.message.includes('dibatalkan') || err.message.includes('timeout')
      if (!isNetworkError) break
    }
  }

  // Semua retry gagal
  updateFile(uf.id, {
    status: 'error',
    error: lastError?.message || 'Gagal upload setelah beberapa percobaan',
  })
  toast.error(`Gagal upload ${uf.originalName}`)
}

// ---- Upload satu file dengan timeout ----
async function uploadSingleFile(
  uf: UploadedFile,
  updateFile: (id: string, patch: Partial<UploadedFile>) => void
): Promise<{ id: string; url: string }> {
  const formData = new FormData()
  formData.append('file', uf.file)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    let timedOut = false

    // Timeout handler
    const timeoutId = setTimeout(() => {
      timedOut = true
      xhr.abort()
      reject(new Error('Upload timeout'))
    }, UPLOAD_TIMEOUT)

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const progress = (e.loaded / e.total) * 100
        updateFile(uf.id, { progress })
      }
    })

    xhr.addEventListener('load', () => {
      clearTimeout(timeoutId)
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText)
          resolve(data)
        } catch {
          reject(new Error('Response server tidak valid'))
        }
      } else {
        let msg = 'Upload gagal'
        try {
          const errData = JSON.parse(xhr.responseText)
          msg = errData.error || msg
        } catch {}
        reject(new Error(msg))
      }
    })

    xhr.addEventListener('error', () => {
      clearTimeout(timeoutId)
      if (!timedOut) reject(new Error('Gangguan jaringan'))
    })

    xhr.addEventListener('abort', () => {
      clearTimeout(timeoutId)
      if (!timedOut) reject(new Error('Upload dibatalkan'))
    })

    xhr.open('POST', '/api/files/upload')
    xhr.send(formData)
  })
}
