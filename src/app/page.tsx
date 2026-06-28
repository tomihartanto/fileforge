import Link from "next/link"
import { ArrowRight, Zap, Shield, Infinity as InfinityIcon, Search, FileText, ImageIcon, FileType, Combine, Scissors, RotateCw, Trash2, ArrowUpDown, Stamp, Minimize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TOOLS, type Tool } from "@/lib/tools"
import { HomeSearch } from "@/components/home-search"

const iconMap: Record<string, any> = {
  FileText, ImageIcon, FileType, Combine, Scissors, RotateCw, Trash2, ArrowUpDown, Stamp, Minimize2,
}

const stats = [
  { icon: InfinityIcon, label: "Upload", value: "Tanpa Batas" },
  { icon: Zap, label: "Proses", value: "Cepat & Lokal" },
  { icon: Shield, label: "Privasi", value: "Aman" },
]

export default function HomePage() {
  const convertTools = TOOLS.filter((t) => t.category === "convert")
  const editTools = TOOLS.filter((t) => t.category === "edit")
  const compressTools = TOOLS.filter((t) => t.category === "compress")

  return (
    <div>
      {/* Hero dengan Search */}
      <section className="dotted-bg border-b">
        <div className="container flex flex-col items-center justify-center gap-6 py-16 md:py-24 text-center">
          <div className="space-y-4 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border bg-background/50 px-4 py-1.5 text-sm text-muted-foreground">
              <Zap className="h-3.5 w-3.5 text-primary" />
              <span>19+ tools tersedia</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Semua Tool File dalam <span className="gradient-text">Satu Tempat</span>
            </h1>
            <p className="text-lg text-muted-foreground md:text-xl">
              Konversi dan edit file PDF, Word, dan gambar. Gratis, tanpa login, tanpa batas.
            </p>
          </div>

          {/* Search Bar */}
          <HomeSearch />

          {/* Stats */}
          <div className="flex flex-wrap items-center justify-center gap-6 pt-4">
            {stats.map((s) => (
              <div key={s.label} className="flex items-center gap-2 text-sm">
                <s.icon className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">{s.label}:</span>
                <span className="font-semibold">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Convert Tools Grid */}
      <section className="container py-14">
        <div className="flex items-center gap-2 mb-6">
          <ArrowRight className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold">Konversi File</h2>
          <Badge variant="secondary">{convertTools.length}</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {convertTools.map((tool) => (
            <ToolCard key={tool.slug} tool={tool} />
          ))}
        </div>
      </section>

      {/* Compress Tools Grid */}
      <section className="container py-14 border-t">
        <div className="flex items-center gap-2 mb-6">
          <Minimize2 className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold">Kompres File</h2>
          <Badge variant="secondary">{compressTools.length}</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {compressTools.map((tool) => (
            <ToolCard key={tool.slug} tool={tool} />
          ))}
        </div>
      </section>

      {/* Edit Tools Grid */}
      <section className="container py-14 border-t">
        <div className="flex items-center gap-2 mb-6">
          <Scissors className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold">Edit & Manipulasi File</h2>
          <Badge variant="secondary">{editTools.length}</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {editTools.map((tool) => (
            <ToolCard key={tool.slug} tool={tool} />
          ))}
        </div>
      </section>

      {/* Trust Section */}
      <section className="border-t bg-muted/30 py-14">
        <div className="container grid gap-6 md:grid-cols-3">
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
              <Zap className="h-6 w-6" />
            </div>
            <h3 className="font-semibold text-lg">Proses Instan</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              File diproses lokal di server, hasil langsung siap diunduh tanpa antri.
            </p>
          </div>
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10 text-green-500">
              <Shield className="h-6 w-6" />
            </div>
            <h3 className="font-semibold text-lg">Aman & Privat</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              File tidak dibagikan ke pihak ketiga. Semua proses dilakukan tanpa API eksternal.
            </p>
          </div>
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
              <InfinityIcon className="h-6 w-6" />
            </div>
            <h3 className="font-semibold text-lg">Gratis Selamanya</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Semua tool tersedia gratis tanpa batasan jumlah file atau ukuran (maks 100MB/file).
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

function ToolCard({ tool }: { tool: Tool }) {
  const Icon = iconMap[tool.icon] || FileText
  return (
    <Link href={`/tool/${tool.slug}`}>
      <Card className="group h-full cursor-pointer transition-all hover:shadow-md hover:border-primary/40">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">{tool.label}</p>
            <p className="text-xs text-muted-foreground truncate">{tool.description}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </CardContent>
      </Card>
    </Link>
  )
}
