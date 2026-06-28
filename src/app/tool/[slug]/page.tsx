import { notFound } from "next/navigation"
import { TOOLS } from "@/lib/tools"
import { ToolWorkspace } from "@/components/tool-workspace"

export function generateStaticParams() {
  return TOOLS.map((tool) => ({ slug: tool.slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const tool = TOOLS.find((t) => t.slug === params.slug)
  if (!tool) return { title: "Tool tidak ditemukan" }
  return {
    title: `${tool.label} - FileForge`,
    description: tool.description,
  }
}

export default function ToolPage({ params }: { params: { slug: string } }) {
  const tool = TOOLS.find((t) => t.slug === params.slug)
  if (!tool) notFound()
  return <ToolWorkspace tool={tool} />
}
