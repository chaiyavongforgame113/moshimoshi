// Watching clips together in a room: turning a pasted link into something the room can play, and
// working out where the clip is right now from the server's state.
//
// Supported: YouTube (watch, youtu.be, shorts, live, embed, music / m. / nocookie hosts), Vimeo
// (vimeo.com/<id>, showcase / album / channel / group links to one video, player.vimeo.com/video/<id>;
// public videos: an unlisted link's private hash is not kept), and https links straight to an .mp4
// or .webm file on a public host name. Anything else gets a kind message (parseVideoUrl's `error`).
// The database checks the same shapes (private.watch_ref_ok).
import type { RoomWatch, VideoPick, WatchProvider } from '@/lib/types'

export type VideoLinkError = 'empty' | 'unsupported' | 'insecure'

export type ParsedVideo = { ok: true; video: VideoPick } | { ok: false; error: VideoLinkError }

const YT_ID = /^[A-Za-z0-9_-]{11}$/
const VIMEO_ID = /^\d{1,12}$/
const FILE_EXT = /\.(mp4|webm)$/i
const BAD_CHARS = /[\s"'<>\\]/
/**
 * A public host name: two labels or more and a top-level domain of letters (or punycode). Browsers
 * read a numeric last label (127.0.0.1, 0x7f.1) as an IP address, so those never pass.
 */
const PUBLIC_HOST = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+([a-z]{2,63}|xn--[a-z0-9-]{1,59})$/
/** names that only mean something on someone's own network */
const LOCAL_HOST = /\.(local|localhost|localdomain|internal|intranet|lan|home|corp|arpa)$/

const YT_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'])

/** "1h2m3s", "90", "1:30" → seconds (undefined when it isn't a time) */
function seconds(raw: string | null): number | undefined {
  if (!raw) return undefined
  const v = raw.trim()
  if (/^\d+(\.\d+)?s?$/.test(v)) return Number.parseFloat(v)
  const hms = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(v)
  if (hms && (hms[1] || hms[2] || hms[3])) return Number(hms[1] ?? 0) * 3600 + Number(hms[2] ?? 0) * 60 + Number(hms[3] ?? 0)
  const clock = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(v)
  if (clock) return Number(clock[1] ?? 0) * 3600 + Number(clock[2]) * 60 + Number(clock[3])
  return undefined
}

function youtube(u: URL): VideoPick | undefined {
  const host = u.hostname.toLowerCase()
  let id: string | undefined
  if (host === 'youtu.be') id = u.pathname.split('/')[1]
  else if (YT_HOSTS.has(host)) {
    const [, first, second] = u.pathname.split('/')
    if (first === 'watch') id = u.searchParams.get('v') ?? undefined
    // /live/<id> is also what Share gives for a stream that has ended, so it's a plain video here:
    // whether it's live right now, the player says (WatchSync, and watch_report tells the room)
    else if (first === 'shorts' || first === 'embed' || first === 'v' || first === 'e' || first === 'live') id = second
  }
  if (!id || !YT_ID.test(id)) return undefined
  const startS = seconds(u.searchParams.get('t') ?? u.searchParams.get('start'))
  return { provider: 'youtube', ref: id, ...(startS ? { startS } : {}) }
}

function vimeo(u: URL): VideoPick | undefined {
  const host = u.hostname.toLowerCase()
  const parts = u.pathname.split('/').filter(Boolean)
  let id: string | undefined
  if (host === 'player.vimeo.com' && parts[0] === 'video') id = parts[1]
  else if (host === 'vimeo.com' || host === 'www.vimeo.com') {
    // vimeo.com/<id>[/<unlisted hash>]: the first. /showcase/<n>/video/<id>, /album/<n>/video/<id>,
    // /groups/<name>/videos/<id>: the one after "video(s)". Otherwise the last number
    // (/channels/staffpicks/<id>), never a showcase's or an album's own number
    const at = parts.findIndex((p) => p === 'video' || p === 'videos')
    const collection = parts[0] === 'showcase' || parts[0] === 'album'
    if (VIMEO_ID.test(parts[0] ?? '')) id = parts[0]
    else if (at >= 0) id = parts[at + 1]
    else if (!collection) id = parts.filter((p) => VIMEO_ID.test(p)).pop()
  }
  if (!id || !VIMEO_ID.test(id)) return undefined
  // vimeo.com/123#t=90s
  const startS = seconds(/(?:^|&)t=([^&]+)/.exec(u.hash.slice(1))?.[1] ?? null)
  return { provider: 'vimeo', ref: id, ...(startS ? { startS } : {}) }
}

/**
 * A pasted link → what the room can play. Kind errors: 'empty' (nothing pasted), 'insecure' (an
 * http:// file link: only https plays inside the app), 'unsupported' (anything else, a file on an
 * IP address or a local name too).
 */
export function parseVideoUrl(input: string): ParsedVideo {
  const text = input.trim()
  if (!text) return { ok: false, error: 'empty' }
  let u: URL
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`)
  } catch {
    return { ok: false, error: 'unsupported' }
  }
  const pick = youtube(u) ?? vimeo(u)
  if (pick) return { ok: true, video: pick }
  if (FILE_EXT.test(u.pathname)) {
    if (u.protocol !== 'https:') return { ok: false, error: 'insecure' }
    const href = u.href
    if (href.length > 2000 || BAD_CHARS.test(href) || u.username || u.password) return { ok: false, error: 'unsupported' }
    const host = u.hostname.toLowerCase()
    if (!PUBLIC_HOST.test(host) || LOCAL_HOST.test(host)) return { ok: false, error: 'unsupported' }
    return { ok: true, video: { provider: 'file', ref: href } }
  }
  return { ok: false, error: 'unsupported' }
}

/** Where to open the clip itself (the link back to YouTube / Vimeo / the file). */
export function videoLink(provider: WatchProvider, ref: string): string {
  if (provider === 'youtube') return `https://www.youtube.com/watch?v=${ref}`
  if (provider === 'vimeo') return `https://vimeo.com/${ref}`
  return ref
}

/** Display name of where the clip comes from (a brand name: the same in both languages). */
export const providerName = (provider: WatchProvider): string => (provider === 'youtube' ? 'YouTube' : provider === 'vimeo' ? 'Vimeo' : 'MP4 / WebM')

/**
 * Where the clip is (seconds) at a server moment: serverNow() from useServerClock(), never the phone's
 * Date.now() alone. While playing it runs from positionS at positionAt; before positionAt (the start a
 * second ahead) it waits at positionS. Never past the end when the length is known. Live: 0.
 */
export function watchPositionAt(w: Pick<RoomWatch, 'playing' | 'positionS' | 'positionAt' | 'rate' | 'durationS' | 'isLive'>, serverNowMs: number): number {
  if (w.isLive) return 0
  const run = w.playing ? (Math.max(0, serverNowMs - w.positionAt) / 1000) * w.rate : 0
  const pos = Math.max(0, w.positionS + run)
  return w.durationS ? Math.min(pos, w.durationS) : pos
}

/** ms until a clip that was just started (or resumed / moved) begins: show "3…2…1" meanwhile (0 = now). */
export function watchStartsIn(w: Pick<RoomWatch, 'playing' | 'positionAt'>, serverNowMs: number): number {
  return w.playing ? Math.max(0, w.positionAt - serverNowMs) : 0
}

/** The clip has played to its end (known length only). */
export function watchEnded(w: Pick<RoomWatch, 'playing' | 'positionS' | 'positionAt' | 'rate' | 'durationS' | 'isLive'>, serverNowMs: number): boolean {
  return !!w.durationS && !w.isLive && watchPositionAt(w, serverNowMs) >= w.durationS - 0.25
}

/** How long a clip holds its room (the database's private.watch_free uses the same). */
export const WATCH_HOLD = {
  /** paused this long: anyone in the room may switch it */
  pausedMs: 10 * 60_000,
  /** no known end, on this long */
  noEndMs: 12 * 3_600_000,
} as const

/**
 * The server moment (ms) from which the clip on no longer holds the room by time alone: it plays to
 * its end, sits paused for 10 minutes, or (no known end) has been on for 12 hours. From then anyone
 * in the room may switch it, stop it or play it again, and room cards stop saying "กำลังดูด้วยกัน".
 * -Infinity: already; Infinity: not by time. The server also frees a room nobody has watched for 2
 * minutes, or whose clip's starter left (useRoomWatch checks that one); it is the judge either way.
 */
export function watchReleaseAt(
  w: Pick<RoomWatch, 'playing' | 'positionS' | 'positionAt' | 'rate' | 'durationS' | 'isLive' | 'startedAt' | 'updatedAt'>,
): number {
  let at = Number.POSITIVE_INFINITY
  if (w.durationS && !w.isLive) {
    const left = w.durationS - 0.25 - w.positionS
    if (left <= 0) return Number.NEGATIVE_INFINITY
    if (w.playing) at = Math.min(at, w.positionAt + (left / w.rate) * 1000)
  }
  if (!w.playing && w.updatedAt !== undefined) at = Math.min(at, w.updatedAt + WATCH_HOLD.pausedMs)
  if (!w.durationS && w.startedAt !== undefined) at = Math.min(at, w.startedAt + WATCH_HOLD.noEndMs)
  return at
}

/**
 * Best effort: a clip's title from the provider's oEmbed (YouTube / Vimeo; files: the file name).
 * This asks YouTube or Vimeo about the link, as the player will anyway. undefined on any failure.
 */
export async function fetchVideoTitle(pick: VideoPick, timeoutMs = 4000): Promise<string | undefined> {
  if (pick.provider === 'file') {
    try {
      const name = decodeURIComponent(new URL(pick.ref).pathname.split('/').pop() ?? '')
      return name.replace(FILE_EXT, '').slice(0, 200) || undefined
    } catch {
      return undefined
    }
  }
  const link = videoLink(pick.provider, pick.ref)
  const api =
    pick.provider === 'youtube'
      ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(link)}`
      : `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(link)}`
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(api, { signal: ctrl.signal, credentials: 'omit', referrerPolicy: 'strict-origin-when-cross-origin' })
    if (!res.ok) return undefined
    const data = (await res.json()) as { title?: unknown }
    return typeof data.title === 'string' && data.title.trim() ? data.title.trim().slice(0, 200) : undefined
  } catch {
    return undefined
  } finally {
    window.clearTimeout(timer)
  }
}

/** Limits the server holds (useful for the UI's own checks). */
export const WATCH_LIMITS = {
  titleMax: 200,
  /** a clip's known length, seconds */
  durationMax: 86_400,
  rateMin: 0.25,
  rateMax: 2,
  /** the database starts a clip (or resumes / moves it while playing) this far ahead */
  startLeadMs: 1000,
  /** watch_heartbeat every so often while the clip is on screen */
  heartbeatMs: 30_000,
  /** a viewer counts as watching while seen this recently */
  viewerWindowMs: 60_000,
} as const
