import { db, isLive } from '@/lib/supabase'

/*
 * The database's clock, as seen from this phone. Watching together keeps its timing on the server
 * (room_watch.position_at), and phone clocks are often off by seconds: every position is worked
 * out with serverNow(), never Date.now() alone.
 *
 * public.server_now() (20261117000001_lifestage_intro_watch.sql) is asked a few times; the answer
 * with the shortest round trip wins (offset = server time - the midpoint of the trip). Demo mode,
 * or a database without server_now: offset 0. Anyone may call it, signed in or not.
 */

let offsetMs = 0
let bestRtt = Number.POSITIVE_INFINITY
let syncing: Promise<number> | null = null
let syncedAt = 0
const listeners = new Set<() => void>()

/** a fresh measurement after this long (phone clocks drift, and a tab may sleep) */
const RESYNC_MS = 10 * 60_000
const SAMPLES = 3

/** Now on the server's clock (ms since epoch). */
export const serverNow = () => Date.now() + offsetMs

/** server time − phone time (ms) */
export const serverOffset = () => offsetMs

export function onServerClock(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

async function sample(): Promise<{ offset: number; rtt: number } | null> {
  const t0 = Date.now()
  const { data, error } = await db().rpc('server_now')
  const t1 = Date.now()
  if (error || typeof data !== 'string') return null
  const server = Date.parse(data)
  if (Number.isNaN(server)) return null
  return { offset: server - (t0 + t1) / 2, rtt: t1 - t0 }
}

/**
 * Measure (again, when the last one is older than 10 minutes or `force`). Resolves with the offset.
 * Never throws: on any failure the last offset (or 0) stays.
 */
export function syncServerClock(force = false): Promise<number> {
  if (!isLive) return Promise.resolve(0)
  if (syncing) return syncing
  if (!force && syncedAt && Date.now() - syncedAt < RESYNC_MS) return Promise.resolve(offsetMs)
  syncing = (async () => {
    try {
      // a new round: older samples don't count (the phone's clock may have been changed since)
      let best: { offset: number; rtt: number } | null = null
      for (let i = 0; i < SAMPLES; i++) {
        const s = await sample().catch(() => null)
        if (s && (!best || s.rtt < best.rtt)) best = s
      }
      if (best) {
        offsetMs = Math.round(best.offset)
        bestRtt = best.rtt
        syncedAt = Date.now()
        listeners.forEach((fn) => fn())
      }
    } finally {
      syncing = null
    }
    return offsetMs
  })()
  return syncing
}

/** How sure the offset is: half the best round trip (ms); Infinity before the first measurement. */
export const serverClockError = () => bestRtt / 2
