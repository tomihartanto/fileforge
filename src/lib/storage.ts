import { writeFile, readFile, unlink, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

export type StorageDriver = 'local' | 'cloudinary'

export function getStorageDriver(): StorageDriver {
  const driver = process.env.STORAGE_DRIVER || 'local'
  const hasCloudinary = process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
  return driver === 'cloudinary' && hasCloudinary ? 'cloudinary' : 'local'
}

// ---- LOCAL STORAGE ----

const LOCAL_BASE = path.join(process.cwd(), 'assets', 'uploads')

export async function saveLocal(buffer: Buffer, subdir: string, ext: string): Promise<{ key: string; url: string }> {
  const dir = path.join(LOCAL_BASE, subdir)
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
  const filename = `${randomUUID()}.${ext}`
  const filepath = path.join(dir, filename)
  await writeFile(filepath, buffer)
  const key = path.join('assets', 'uploads', subdir, filename).split(path.sep).join('/')
  return { key, url: `/api/files/local/${subdir}/${filename}` }
}

export async function readLocal(key: string): Promise<Buffer> {
  const filepath = path.join(process.cwd(), key)
  return readFile(filepath)
}

export async function deleteLocal(key: string): Promise<void> {
  const filepath = path.join(process.cwd(), key)
  try {
    await unlink(filepath)
  } catch {
    // ignore
  }
}

// ---- CLOUDINARY STORAGE ----

let cloudinaryInstance: any = null

async function getCloudinary() {
  if (!cloudinaryInstance) {
    const v2 = (await import('cloudinary')).v2
    v2.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
      api_key: process.env.CLOUDINARY_API_KEY!,
      api_secret: process.env.CLOUDINARY_API_SECRET!,
    })
    cloudinaryInstance = v2
  }
  return cloudinaryInstance
}

export async function saveCloudinary(buffer: Buffer, subdir: string, ext: string): Promise<{ key: string; url: string }> {
  const cld = await getCloudinary()
  const folder = process.env.CLOUDINARY_FOLDER || 'fileforge'
  const publicId = `${folder}/${subdir}/${randomUUID()}`
  const isRaw = ext === 'pdf' || ext === 'docx' || ext === 'txt' || ext === 'csv'

  // Cloudinary v2 uploader.upload tidak menerima Buffer langsung,
  // jadi gunakan upload_stream dengan buffer yang di-pipe.
  const result = await new Promise<any>((resolve, reject) => {
    const stream = cld.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: isRaw ? 'raw' : 'auto',
      },
      (err: any, result: any) => {
        if (err) reject(err)
        else resolve(result)
      }
    )
    // Write buffer ke stream
    const { Readable } = require('stream')
    const readable = new Readable()
    readable.push(buffer)
    readable.push(null)
    readable.pipe(stream)
  })

  return { key: result.public_id, url: result.secure_url }
}

export async function deleteCloudinary(key: string, resourceType: string = 'raw'): Promise<void> {
  const cld = await getCloudinary()
  try {
    await cld.uploader.destroy(key, { resource_type: resourceType })
  } catch {
    // ignore
  }
}

// ---- UNIFIED API ----

export async function saveFile(buffer: Buffer, subdir: string, ext: string) {
  const driver = getStorageDriver()
  if (driver === 'cloudinary') {
    return saveCloudinary(buffer, subdir, ext)
  }
  return saveLocal(buffer, subdir, ext)
}

export async function readFileFromStorage(key: string) {
  // Cloudinary keys bukan path filesystem lokal (tidak diawali "assets/")
  // dan tidak mengandung ekstensi file di akhir (public_id Cloudinary tanpa ext)
  if (!key.startsWith('assets/') && !key.startsWith('assets\\')) {
    const cld = await getCloudinary()
    // Deteksi resource type: gambar vs raw (pdf/docx/txt)
    const isImage = key.includes('/uploaded/') && !key.includes('.pdf') && !key.includes('.docx')
      || /\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(key)
    const url = cld.url(key, { resource_type: isImage ? 'image' : 'raw' })
    const result = await fetch(url)
    if (!result.ok) {
      // Fallback: coba dengan resource_type 'raw'
      const url2 = cld.url(key, { resource_type: 'raw' })
      const result2 = await fetch(url2)
      return Buffer.from(await result2.arrayBuffer())
    }
    return Buffer.from(await result.arrayBuffer())
  }
  return readLocal(key)
}

export async function deleteFile(key: string) {
  if (!key.startsWith('assets/') && !key.startsWith('assets\\')) {
    return deleteCloudinary(key)
  }
  return deleteLocal(key)
}
