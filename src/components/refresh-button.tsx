"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"

export function RefreshButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null)

  function handleRefresh() {
    startTransition(() => {
      router.refresh()
      setLastRefreshed(new Date().toLocaleTimeString())
    })
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
