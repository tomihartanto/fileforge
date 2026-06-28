"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Search, ArrowRight } from "lucide-react"
import { searchTools, type Tool } from "@/lib/tools"
import { cn } from "@/lib/utils"

export function HomeSearch() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Tool[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(0)
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (query.trim()) {
      setResults(searchTools(query).slice(0, 8))
      setIsOpen(true)
      setHighlightIdx(0)
    } else {
      setResults([])
      setIsOpen(false)
    }
  }, [query])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const handleSelect = (tool: Tool) => {
    router.push(`/tool/${tool.slug}`)
    setIsOpen(false)
    setQuery("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightIdx((prev) => (prev + 1) % results.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightIdx((prev) => (prev - 1 + results.length) % results.length)
    } else if (e.key === "Enter") {
      e.preventDefault()
      handleSelect(results[highlightIdx])
    } else if (e.key === "Escape") {
      setIsOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Cari tool... (contoh: pdf to word)"
          className="w-full h-14 rounded-xl border-2 border-border bg-background pl-12 pr-4 text-base shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          autoComplete="off"
        />
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border bg-popover shadow-lg max-h-96 overflow-y-auto">
          {results.map((tool, idx) => (
            <button
              key={tool.slug}
              onClick={() => handleSelect(tool)}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                idx === highlightIdx ? "bg-accent" : "hover:bg-accent/50"
              )}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{tool.label}</p>
                <p className="text-xs text-muted-foreground truncate">{tool.description}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}

      {isOpen && query.trim() && results.length === 0 && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border bg-popover shadow-lg p-4 text-center text-sm text-muted-foreground">
          Tidak ada tool untuk &quot;{query}&quot;
        </div>
      )}
    </div>
  )
}
