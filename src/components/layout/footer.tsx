import Link from "next/link"
import { Hammer } from "lucide-react"
import { TOOLS } from "@/lib/tools"

export function Footer() {
  const convertTools = TOOLS.filter((t) => t.category === "convert").slice(0, 6)
  const compressTools = TOOLS.filter((t) => t.category === "compress")
  const editTools = TOOLS.filter((t) => t.category === "edit").slice(0, 4)

  return (
    <footer className="border-t border-border/40 py-10 mt-16">
      <div className="container">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Hammer className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">FileForge</span>
            </div>
            <p className="text-xs text-muted-foreground max-w-xs">
              Platform gratis untuk konversi dan editing file PDF, Word, dan gambar. Tanpa login, tanpa batas.
            </p>
          </div>

          {/* Convert */}
          <div>
            <p className="text-sm font-semibold mb-2">Konversi</p>
            <div className="grid grid-cols-2 gap-1">
              {convertTools.map((t) => (
                <Link key={t.slug} href={`/tool/${t.slug}`} className="text-xs text-muted-foreground hover:text-foreground">
                  {t.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Compress */}
          <div>
            <p className="text-sm font-semibold mb-2">Kompres</p>
            <div className="grid grid-cols-1 gap-1">
              {compressTools.map((t) => (
                <Link key={t.slug} href={`/tool/${t.slug}`} className="text-xs text-muted-foreground hover:text-foreground">
                  {t.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Edit */}
          <div>
            <p className="text-sm font-semibold mb-2">Edit File</p>
            <div className="grid grid-cols-2 gap-1">
              {editTools.map((t) => (
                <Link key={t.slug} href={`/tool/${t.slug}`} className="text-xs text-muted-foreground hover:text-foreground">
                  {t.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} FileForge. Dibuat dengan Next.js.
          </p>
        </div>
      </div>
    </footer>
  )
}
