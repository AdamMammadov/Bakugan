import { useEffect, useState } from 'react'
import { useActiveProfile } from './useProfiles'

/** The time for friend statuses: it moves on when the next waiting request gets accepted. */
export function useFriendClock() {
  const me = useActiveProfile()
  const [now, setNow] = useState(() => Date.now())
  const next = me?.friends
    ?.map((f) => f.since)
    .filter((t) => t > now)
    .sort((a, b) => a - b)[0]
  useEffect(() => {
    if (next === undefined) return
    const t = window.setTimeout(() => setNow(Date.now()), Math.max(0, next - Date.now()) + 50)
    return () => clearTimeout(t)
  }, [next])
  return now
}
