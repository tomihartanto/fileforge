"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Download, Loader2, UploadCloud, File as FileIcon, X, CheckCircle2, AlertCircle, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"
import { cn, formatBytes } from "@/lib/utils"
import { toast } from "sonner"
import type { Tool } from "@/lib/tools"
import { useDropzone } from "react-dropzone"

interface UploadItem {
  id: string
  file: File
  progress: number
  status: "uploading" | "uploaded" | "error"
  serverId?: string
  serverUrl?: string
  originalName: string
  size: number
  error?: string
}

interface ResultItem {
  id: string
  fileName: string
  size: number
  url: string
  originalName: string
}

export function ToolWorkspace({ tool }: { tool: Tool }) {
  const router = useRouter()
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [processing, setProcessing] = useState(false)
  const [results, setResults] = useState<ResultItem[]>([])
  const [editOptions, setEditOptions] = useState<Record<string, any>>({})

  const uploadsRef = useRef<UploadItem[]>([])
  const syncUploads = useCallback((next: UploadItem[]) => {
    uploadsRef.current = next
    setUploads(next)
  }, [])

  const updateUpload = useCallback((id: string, patch: Partial<UploadItem>) => {
    const next = uploadsRef.current.map((u) => (u.id === id ? { ...u, ...patch } : u))
    uploadsRef.current = next
    setUploads(next)
  }, [])

  // Accept types berdasarkan tool
  const acceptMap: Record<string, Record<string, string[]>> = {
    pdf: { "application/pdf": [".pdf"] },
    docx: { "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"], "application/msword": [".doc"] },
    image: { "image/*": [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"] },
    png: { "image/png": [".png"] },
    jpg: { "image/jpeg": [".jpg", ".jpeg"] },
    webp: { "image/webp": [".webp"] },
  }

  // Edit tools bisa terima multiple files untuk merge
  const isMerge = tool.editAction === "merge"
  const accept = acceptMap[tool.fromFormat] || acceptMap.image

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return

    const newItems: UploadItem[] = acceptedFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      progress: 0,
      status: "uploading",
      originalName: file.name,
      size: file.size,
    }))

    syncUploads([...uploadsRef.current, ...newItems])

    // Upload dengan concurrency limit 3
    let idx = 0
    const worker = async () => {
      while (idx < newItems.length) {
        const current = idx++
        await uploadOne(newItems[current])
      }
    }
    await Promise.all([worker(), worker(), worker()])
  }, [syncUploads, updateUpload])

  async function uploadOne(item: UploadItem) {
    const formData = new FormData()
    formData.append("file", item.file)
    try {
      const xhr = new XMLHttpRequest()
      const result = await new Promise<{ id: string; url: string }>((resolve, reject) => {
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            updateUpload(item.id, { progress: (e.loaded / e.total) * 100 })
          }
        })
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try { resolve(JSON.parse(xhr.responseText)) } catch { reject(new Error("Response error")) }
          } else { reject(new Error("Upload gagal")) }
        })
        xhr.addEventListener("error", () => reject(new Error("Gangguan jaringan")))
        xhr.open("POST", "/api/files/upload")
        xhr.send(formData)
      })
      updateUpload(item.id, { status: "uploaded", progress: 100, serverId: result.id, serverUrl: result.url })
    } catch (err: any) {
      updateUpload(item.id, { status: "error", error: err.message })
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize: 100 * 1024 * 1024,
  })

  const handleProcess = async () => {
    const ready = uploadsRef.current.filter((u) => u.status === "uploaded" && u.serverId)
    if (ready.length === 0) {
      toast.error("Upload minimal 1 file dulu")
      return
    }

    setProcessing(true)
    setResults([])
    const newResults: ResultItem[] = []

    try {
      if (tool.category === "convert") {
        // Convert: setiap file dikonversi individually
        for (const item of ready) {
          try {
            const res = await fetch("/api/convert", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fileId: item.serverId, conversion: tool.conversionKey }),
            })
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Konversi gagal")
            const data = await res.json()
            newResults.push({
              id: data.id, fileName: data.fileName, size: data.size,
              url: data.url, originalName: item.originalName,
            })
          } catch (err: any) {
            toast.error(`Gagal: ${item.originalName} - ${err.message}`)
          }
        }
      } else if (tool.category === "edit") {
        // Edit tools
        const payload: Record<string, any> = { action: tool.editAction }

        if (tool.editAction === "merge") {
          payload.fileIds = ready.map((u) => u.serverId)
        } else {
          payload.fileId = ready[0].serverId
          Object.assign(payload, editOptions)
        }

        // Validasi sesuai action
        if (tool.editAction === "rotate" && !editOptions.degrees) {
          toast.error("Pilih derajat rotasi dulu")
          setProcessing(false)
          return
        }
        if (tool.editAction === "delete_pages" && !editOptions.pages) {
          toast.error("Isi halaman yang akan dihapus dulu")
          setProcessing(false)
          return
        }
        if (tool.editAction === "reorder" && !editOptions.order) {
          toast.error("Isi urutan halaman baru dulu")
          setProcessing(false)
          return
        }
        if (tool.editAction === "watermark" && !editOptions.text) {
          toast.error("Isi teks watermark dulu")
          setProcessing(false)
          return
        }

        const res = await fetch("/api/edit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Operasi gagal")
        const data = await res.json()
        newResults.push({
          id: data.id, fileName: data.fileName, size: data.size,
          url: data.url, originalName: ready[0].originalName,
        })
      } else if (tool.category === "compress") {
        // Compress: setiap file dikompres individually
        for (const item of ready) {
          try {
            const res = await fetch("/api/compress", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fileId: item.serverId,
                quality: editOptions.quality,
                maxWidth: tool.compressTarget === "image" ? editOptions.maxWidth : undefined,
              }),
            })
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Kompresi gagal")
            const data = await res.json()
            newResults.push({
              id: data.id, fileName: data.fileName, size: data.size,
              url: data.url, originalName: item.originalName,
            })
          } catch (err: any) {
            toast.error(`Gagal: ${item.originalName} - ${err.message}`)
          }
        }
      }
      setResults(newResults)
      toast.success(`${newResults.length} file berhasil diproses!`)
    } catch (err: any) {
      toast.error(err.message)
    }
    setProcessing(false)
  }

  const readyCount = uploads.filter((u) => u.status === "uploaded").length
  const showProcessButton = readyCount > 0

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/")} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{tool.label}</h1>
          <p className="text-sm text-muted-foreground truncate">{tool.description}</p>
        </div>
        <Badge variant="outline" className="shrink-0 uppercase">{tool.shortLabel}</Badge>
      </div>

      {/* Upload Zone */}
      {results.length === 0 && (
        <>
          <Card>
            <div
              {...getRootProps()}
              className={cn(
                "relative cursor-pointer rounded-xl border-2 border-dashed transition-all p-10 md:p-16 text-center",
                isDragActive ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/50 hover:bg-accent/30"
              )}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-3">
                <div className={cn(
                  "flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform",
                  isDragActive && "scale-110"
                )}>
                  <UploadCloud className="h-8 w-8" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-lg">
                    {isDragActive ? "Lepaskan file di sini..." : isMerge ? "Pilih file PDF untuk digabung" : "Tarik file ke sini atau klik untuk pilih"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Format: {tool.fromFormat.toUpperCase()} → {tool.toFormat.toUpperCase()} • Maks 100MB
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Upload Progress List */}
          {uploads.length > 0 && (
            <div className="space-y-2">
              {uploads.map((u) => (
                <div key={u.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                    {u.status === "uploading" ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : (
                      <FileIcon className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{u.originalName}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(u.size)}</span>
                    </div>
                    {u.status === "uploading" && <Progress value={u.progress} className="mt-1.5 h-1.5" />}
                    {u.status === "error" && (
                      <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />{u.error}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center gap-1">
                    {u.status === "uploaded" && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => syncUploads(uploadsRef.current.filter((x) => x.id !== u.id))}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Compress Options (untuk tool compress) */}
          {tool.category === "compress" && readyCount > 0 && (
            <CompressOptions tool={tool} editOptions={editOptions} setEditOptions={setEditOptions} />
          )}

          {/* Edit Options (untuk tool tertentu) */}
          {tool.editAction && tool.editAction !== "merge" && readyCount > 0 && (
            <EditOptions tool={tool} editOptions={editOptions} setEditOptions={setEditOptions} />
          )}

          {/* Process Button */}
          {showProcessButton && (
            <div className="flex justify-center pb-4">
              <Button size="lg" onClick={handleProcess} disabled={processing} className="min-w-48">
                {processing ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Memproses...</>
                ) : (
                  <><Zap className="mr-2 h-4 w-4" />{tool.category === "convert" ? "Konversi Sekarang" : tool.category === "compress" ? "Kompres Sekarang" : "Proses Sekarang"}</>
                )}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Hasil ({results.length})
            </h2>
            <Button variant="outline" size="sm" onClick={() => { setResults([]); setUploads([]); uploadsRef.current = [] }}>
              Proses Lagi
            </Button>
          </div>
          {results.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{r.fileName}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(r.size)}</p>
                </div>
                <Button asChild>
                  <a href={`${r.url}?name=${encodeURIComponent(r.fileName)}`} download>
                    <Download className="mr-2 h-4 w-4" />Download
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// =============================================
// Edit Options Component
// =============================================
function EditOptions({ tool, editOptions, setEditOptions }: {
  tool: Tool
  editOptions: Record<string, any>
  setEditOptions: (v: Record<string, any>) => void
}) {
  if (tool.editAction === "rotate") {
    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Pilih Rotasi</p>
          <div className="flex gap-2 flex-wrap">
            {[90, 180, 270].map((deg) => (
              <Button
                key={deg}
                variant={editOptions.degrees === deg ? "default" : "outline"}
                onClick={() => setEditOptions({ degrees: deg })}
              >
                {deg}°
              </Button>
            ))}
          </div>
          {editOptions.degrees && <p className="text-xs text-muted-foreground">Akan diputar {editOptions.degrees}° searah jarum jam</p>}
        </CardContent>
      </Card>
    )
  }

  if (tool.editAction === "delete_pages") {
    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Halaman yang Dihapus</p>
          <input
            type="text"
            value={editOptions.pages || ""}
            onChange={(e) => setEditOptions({ pages: e.target.value })}
            placeholder="1,3,5 (pisahkan dengan koma)"
            className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <p className="text-xs text-muted-foreground">Contoh: 1,3,5-8 untuk hapus halaman 1, 3, dan 5 sampai 8</p>
        </CardContent>
      </Card>
    )
  }

  if (tool.editAction === "split") {
    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Pisahkan Setiap</p>
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 5].map((n) => (
              <Button
                key={n}
                variant={editOptions.every === n ? "default" : "outline"}
                onClick={() => setEditOptions({ every: n })}
              >
                {n} halaman
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (tool.editAction === "reorder") {
    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Urutan Baru</p>
          <input
            type="text"
            value={editOptions.order || ""}
            onChange={(e) => setEditOptions({ order: e.target.value })}
            placeholder="3,1,2 (urutan halaman baru)"
            className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <p className="text-xs text-muted-foreground">Contoh: 3,1,2 untuk ubah urutan halaman jadi 3→1→2</p>
        </CardContent>
      </Card>
    )
  }

  if (tool.editAction === "watermark") {
    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Teks Watermark</p>
          <input
            type="text"
            value={editOptions.text || ""}
            onChange={(e) => setEditOptions({ text: e.target.value, opacity: 0.3 })}
            placeholder="Contoh: RAHASIA"
            className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </CardContent>
      </Card>
    )
  }

  return null
}

// =============================================
// Compress Options Component
// =============================================
function CompressOptions({ tool, editOptions, setEditOptions }: {
  tool: Tool
  editOptions: Record<string, any>
  setEditOptions: (v: Record<string, any>) => void
}) {
  // Default values saat first render
  const quality = editOptions.quality ?? 60
  const maxWidth = editOptions.maxWidth ?? 1920

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Kualitas</p>
            <span className="text-sm text-muted-foreground tabular-nums">{quality}%</span>
          </div>
          <Slider
            value={[quality]}
            min={10}
            max={100}
            step={5}
            onValueChange={(v) => setEditOptions({ ...editOptions, quality: v[0] })}
          />
          <p className="text-xs text-muted-foreground">Makin rendah = ukuran lebih kecil, kualitas turun</p>
        </div>

        {tool.compressTarget === "image" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Lebar Maksimal</p>
              <span className="text-sm text-muted-foreground tabular-nums">{maxWidth}px</span>
            </div>
            <Slider
              value={[maxWidth]}
              min={320}
              max={3840}
              step={160}
              onValueChange={(v) => setEditOptions({ ...editOptions, maxWidth: v[0] })}
            />
            <p className="text-xs text-muted-foreground">Resize gambar jika lebih lebar dari nilai ini</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
