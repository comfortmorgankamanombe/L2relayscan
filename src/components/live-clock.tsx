"use client"

import { useEffect, useState } from "react"
import { Clock } from "lucide-react"

export function LiveClock() {
  const [time, setTime] = useState<string | null>(null)

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const hh = now.getUTCHours().toString().padStart(2, "0")
      const mm = now.getUTCMinutes().toString().padStart(2, "0")
      const ss = now.getUTCSeconds().toString().padStart(2, "0")
      setTime(`${hh}:${mm}:${ss} UTC`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  if (!time) return null

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Clock className="h-3.5 w-3.5" />
      <span className="font-mono tabular-nums">{time}</span>
    </div>
  )
}
