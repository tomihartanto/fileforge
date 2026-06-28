# FileForge

Platform all-in-one untuk konversi, kompresi, dan editing file. Dibangun dengan Next.js 14, Tailwind CSS, dan shadcn/ui.

## Fitur

- **Konversi Format**: PDF ke Word, PDF ke Text, PDF ke Image, Word ke PDF, Word ke Text, konversi gambar (PNG/JPG/WEBP/GIF), gambar ke PDF
- **Kompres File**: Kompres gambar (PNG, JPG, WEBP) dengan kontrol kualitas dan resolusi, kompres PDF
- **Edit PDF**: Rotasi halaman, hapus halaman tertentu, gabungkan multiple PDF
- **Upload Tanpa Batas**: Upload banyak file sekaligus, drag & drop, progress bar real-time
- **Responsive**: Mobile-first design, dark mode support
- **Storage Fleksibel**: Local storage (folder assets/uploads) atau Cloudinary untuk production
- **Database**: PostgreSQL dengan Prisma ORM

## Tech Stack

| Kategori | Teknologi |
|----------|-----------|
| Framework | Next.js 14 (App Router) |
| Bahasa | TypeScript |
| UI | Tailwind CSS + shadcn/ui + Radix UI |
| Database | PostgreSQL (Prisma ORM) |
| Storage | Local filesystem / Cloudinary |
| Image Processing | Sharp |
| PDF Processing | pdf-lib, pdfjs-dist |
| DOCX Processing | JSZip |

## Quick Start

### Prasyarat

- Node.js 18+
- PostgreSQL (local atau Neon)

### Instalasi

```bash
# Clone atau buka folder project
cd fileforge

# Install dependencies
npm install

# Setup database
npx prisma db push

# Jalankan dev server
npm run dev
```

Buka `http://localhost:3000` di browser.

## Environment Variables

Salin `.env.example` ke `.env` dan sesuaikan:

```env
# Database
DATABASE_URL="postgresql://admin:***@localhost:5432/db_fileforge?schema=public"

# Cloudinary (kosongkan untuk local storage)
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""
CLOUDINARY_FOLDER="FileForge"

# Storage driver: "local" atau "cloudinary"
STORAGE_DRIVER="local"
```

### Production Setup

Untuk production, ganti ke Cloudinary dan Neon DB:

```env
DATABASE_URL="postgresql://user:***@ep-xxx.region.aws.neon.tech/db_fileforge?sslmode=require"
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
STORAGE_DRIVER="cloudinary"
```

## Struktur Project

```
fileforge/
+- src/
|   +- app/
|   |   +- page.tsx              # Landing page
|   |   +- convert/page.tsx      # Halaman konversi
|   |   +- compress/page.tsx     # Halaman kompresi
|   |   +- edit/page.tsx         # Halaman edit PDF
|   |   +- api/
|   |       +- files/upload/     # Upload endpoint
|   |       +- files/local/      # Serve local files
|   |       +- convert/          # Convert endpoint
|   |       +- compress/         # Compress endpoint
|   |       +- edit/             # Edit endpoint
|   +- components/
|   |   +- upload-zone.tsx       # Multi-file upload component
|   |   +- layout/               # Navbar, Footer
|   |   +- ui/                   # shadcn/ui components
|   +- lib/
|   |   +- prisma.ts             # Prisma client
|   |   +- storage.ts            # Storage abstraction
|   |   +- constants.ts          # Config & mappings
|   |   +- converters/           # File conversion engines
|   |       +- pdf.ts            # PDF converters
|   |       +- docx.ts           # DOCX converters
|   |       +- image.ts          # Image converters
|   |       +- compress.ts       # Compression engine
+- prisma/
|   +- schema.prisma             # Database schema
+- assets/uploads/               # Local file storage
```

## API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/files/upload` | Upload file |
| GET | `/api/files/local/:subdir/:filename` | Download local file |
| POST | `/api/convert` | Konversi file |
| POST | `/api/compress` | Kompres file |
| POST | `/api/edit` | Edit PDF (rotate/delete/merge) |

## Lisensi

All Rights Reserved. Dilarang menyalin, memodifikasi, mendistribusikan, atau menggunakan code ini tanpa izin tertulis dari pemilik. Lihat file [LICENSE](LICENSE).
