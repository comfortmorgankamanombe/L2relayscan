"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"

interface RefreshButtonProps {
  onRefresh?: () => Promise<void>
}

export function RefreshButton({ onRefresh }: RefreshButtonProps) {
  const [isPending, setIsPending] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null)

  async function handleRefresh() {
    try {
      setIsPending(true)
      if (onRefresh) {
        await onRefresh()
      }
      setLastRefreshed(new Date().toLocaleTimeString())
    } catch (error) {
      console.error("Refresh failed:", error)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {lastRefreshed && (
        <span className="text-xs text-muted-foreground hidden sm:block">
          Updated {lastRefreshed}
        </span>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={handleRefresh}
        disabled={isPending}
        className="gap-1.5 border-border/60"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
        {isPending ? "Refreshing…" : "Refresh"}
      </Button>
    </div>
  )
}
