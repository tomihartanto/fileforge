"use client"

import Link from "next/link"
import { useState } from "react"
import { Hammer, Moon, Sun, Menu, X, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "next-themes"
import { TOOLS } from "@/lib/tools"

export function Navbar() {
  const { theme, setTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  const convertTools = TOOLS.filter((t) => t.category === "convert")
  const editTools = TOOLS.filter((t) => t.category === "edit")
  const compressTools = TOOLS.filter((t) => t.category === "compress")

  const menu = [
    { key: "convert", label: "Konversi", tools: convertTools },
    { key: "compress", label: "Kompres", tools: compressTools },
    { key: "edit", label: "Edit", tools: editTools },
  ]

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-sm">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Hammer className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold">File<span className="gradient-text">Forge</span></span>
        </Link>

        {/* Desktop Menu */}
        <nav className="hidden md:flex items-center gap-1">
          {menu.map((item) => (
            <div
              key={item.key}
              className="relative"
              onMouseEnter={() => setOpenDropdown(item.key)}
              onMouseLeave={() => setOpenDropdown(null)}
            >
              <button className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                {item.label}
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {openDropdown === item.key && (
                <div className="absolute top-full left-0 pt-1 z-50">
                  <div className="w-64 rounded-lg border bg-popover shadow-lg overflow-hidden">
                    <div className="max-h-80 overflow-y-auto p-1">
                      {item.tools.map((tool) => (
                        <Link
                          key={tool.slug}
                          href={`/tool/${tool.slug}`}
                          className="block rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors"
                        >
                          <span className="font-medium">{tool.label}</span>
                          <span className="block text-xs text-muted-foreground">{tool.description}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <nav className="border-t md:hidden">
          <div className="container py-4 space-y-3">
            {menu.map((item) => (
              <div key={item.key}>
                <p className="text-xs font-semibold text-muted-foreground uppercase px-3 mb-1">{item.label}</p>
                <div className="max-h-48 overflow-y-auto">
                  {item.tools.map((tool) => (
                    <Link
                      key={tool.slug}
                      href={`/tool/${tool.slug}`}
                      onClick={() => setMobileOpen(false)}
                      className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    >
                      {tool.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </nav>
      )}
    </header>
  )
}
