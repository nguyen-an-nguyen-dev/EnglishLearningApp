import { useEffect, useState } from 'react'

export const SPEAKING_MUTE_KEY = 'speakingMutedUntil'
export const SPEAKING_MUTE_MS = 15 * 60 * 1000

export function speakingTimeLeft(value: string | number | null, now: number): number {
  const until = Number(value)
  return Number.isFinite(until) ? Math.max(0, until - now) : 0
}

function readDeadline(): number {
  try { return Number(localStorage.getItem(SPEAKING_MUTE_KEY)) || 0 } catch { return 0 }
}

function writeDeadline(deadline: number): void {
  try {
    if (deadline) localStorage.setItem(SPEAKING_MUTE_KEY, String(deadline))
    else localStorage.removeItem(SPEAKING_MUTE_KEY)
  } catch {
    // In-memory mode remains usable when storage is unavailable.
  }
}

export function useSpeakingMode(enabled: boolean) {
  const [deadline, setDeadline] = useState(() => enabled ? readDeadline() : 0)
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    if (!enabled) return

    function tick() {
      const current = Date.now()
      setNow(current)
      if (deadline && !speakingTimeLeft(deadline, current)) {
        if (readDeadline() === deadline) writeDeadline(0)
        setDeadline(0)
      }
    }

    function sync(event: StorageEvent) {
      if (event.key !== SPEAKING_MUTE_KEY && event.key !== null) return
      setNow(Date.now())
      setDeadline(readDeadline())
    }

    const interval = deadline ? window.setInterval(tick, 1000) : null
    const expiry = deadline ? window.setTimeout(tick, speakingTimeLeft(deadline, Date.now())) : null
    window.addEventListener('storage', sync)
    return () => {
      if (interval !== null) window.clearInterval(interval)
      if (expiry !== null) window.clearTimeout(expiry)
      window.removeEventListener('storage', sync)
    }
  }, [deadline, enabled])

  function setMuted(muted: boolean) {
    const current = Date.now()
    const until = muted ? current + SPEAKING_MUTE_MS : 0
    writeDeadline(until)
    setNow(current)
    setDeadline(until)
  }

  return { remainingMs: speakingTimeLeft(deadline, now), setMuted }
}
