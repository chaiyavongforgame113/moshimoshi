// "ตกลง" before the app plays and pauses a clip for someone (YouTube's policy III.I.2), remembered on
// this device: once for YouTube, once for Vimeo, and for file links once per host (each new host
// asks again, so a link to somewhere new never loads without the person seeing where it's from).
// Until then no player (and nothing from YouTube / Vimeo / that host) loads. Storage can be off
// (private mode): then it's remembered until the page reloads.
import { useSyncExternalStore } from 'react'
import type { WatchProvider } from '@/lib/types'
import { videoHost } from '@/lib/video'

// an older plain "file" entry (one OK for every host) no longer counts: read() leaves it out
const KEY = 'moshi.watch.ok.v1'
const memory = new Set<string>()
const listeners = new Set<() => void>()

/** what an OK covers: 'youtube', 'vimeo', or 'file:<host>' */
function consentKey(provider: WatchProvider, ref: string): string {
  return provider === 'file' ? `file:${videoHost(ref).toLowerCase()}` : provider
}

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    const list: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.filter((v): v is string => typeof v === 'string' && (v === 'youtube' || v === 'vimeo' || /^file:[a-z0-9.-]+$/.test(v))) : []
  } catch {
    return []
  }
}

export function hasWatchConsent(provider: WatchProvider, ref: string): boolean {
  const key = consentKey(provider, ref)
  return memory.has(key) || read().includes(key)
}

/** `ref`: the clip's (for a file link, its host is what the OK is for) */
export function giveWatchConsent(provider: WatchProvider, ref: string) {
  const key = consentKey(provider, ref)
  memory.add(key)
  try {
    const list = read()
    if (!list.includes(key)) {
      // a short list: YouTube / Vimeo, and the newest 50 hosts
      const next = [...list, key]
      const hosts = next.filter((v) => v.startsWith('file:')).slice(-50)
      window.localStorage.setItem(KEY, JSON.stringify([...next.filter((v) => !v.startsWith('file:')), ...hosts]))
    }
  } catch {
    // remembered for this visit only
  }
  listeners.forEach((fn) => fn())
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** Has this person said OK to watching this clip here (its provider; a file link: its host)? */
export function useWatchConsent(provider: WatchProvider, ref: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => hasWatchConsent(provider, ref),
    () => false,
  )
}
