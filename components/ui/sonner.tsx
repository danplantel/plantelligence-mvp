"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

import { usePortalLightSurface } from "@/lib/portal-light-surface"

type ToasterProps = React.ComponentProps<typeof Sonner>

/**
 * Whether the document is painted dark RIGHT NOW.
 *
 * `useTheme()` alone cannot answer this: portal pages strip the `.dark` class
 * from `<html>` so they stay light-branded, while next-themes keeps reporting
 * the advisor's dashboard preference (`"dark"`). Sonner does not read the class
 * — it reads a `theme` PROP and stamps its own `data-theme` on the list — so
 * those dark toasts floated over an otherwise light portal.
 *
 * Reading the class the page is actually rendered with keeps the toasts in step
 * with the surface underneath them: every portal page is light, so its
 * confirmations are light.
 */
function useDocumentDarkClass(): boolean {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setDark(root.classList.contains("dark"))
    sync()
    // The portal layout removes the class while a portal page is mounted, and
    // next-themes re-applies it on mount — follow both.
    const observer = new MutationObserver(sync)
    observer.observe(root, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  return dark
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  /**
   * A portal page is light whatever the dashboard preference is, and a portal
   * surface held inside another tree says the same thing explicitly.
   */
  const portalLightSurface = usePortalLightSurface()
  const documentIsDark = useDocumentDarkClass()

  const surfaceTheme: ToasterProps["theme"] =
    !portalLightSurface && documentIsDark
      ? (theme as ToasterProps["theme"])
      : "light"

  return (
    <Sonner
      theme={surfaceTheme}
      position="top-right"
      className="toaster group"
      style={{ top: "4.5rem" }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
