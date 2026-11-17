// Pasted video links for watching together in a room: what a link is (YouTube, Vimeo or an https
// .mp4 / .webm file), a preview of it (title, thumbnail, whether it may play inside the app), and
// small display helpers. The link shapes themselves live in data/watch (parseVideoUrl), which mirrors
// the database's own check (private.watch_ref_ok), so the two never disagree.
import { parseVideoUrl, type VideoLinkError } from '@/data/watch'
import type { VideoPick, WatchProvider } from '@/lib/types'

export type { VideoLinkError }

/** What a link points at: youtube / vimeo take the video id, file the https link itself. */
export interface VideoRef {
  provider: WatchProvider
  ref: string
  /** seconds, from ?t= / #t= / ?start= in the link */
  startAt?: number
}

export type VideoParse = ({ ok: true } & VideoRef) | { ok: false; reason: VideoLinkError }

/**
 * A pasted link → { provider, ref, startAt? }, or why it can't play in a room:
 * 'empty' (nothing pasted), 'insecure' (an http:// file link), 'unsupported' (anything else).
 * Handles youtube.com/watch, youtu.be, /shorts, /live, /embed (also m. / music. / nocookie hosts)
 * with a start time, vimeo.com/<id> (showcase / album / channel / group links to one video too) and
 * player.vimeo.com/video/<id>, and https .mp4 / .webm links on a public host. Whether a clip is live
 * isn't in its link (a /live/ link can be a stream that ended): the player tells the room.
 */
export function parseVideo(input: string): VideoParse {
  const parsed = parseVideoUrl(input)
  if (!parsed.ok) return { ok: false, reason: parsed.error }
  const { provider, ref, startS } = parsed.video
  return { ok: true, provider, ref, ...(startS ? { startAt: startS } : {}) }
}

/** The thumbnail a link can show without asking anyone first (YouTube's image host only). */
export function videoThumb(provider: WatchProvider, ref: string): string | undefined {
  return provider === 'youtube' ? `https://i.ytimg.com/vi/${ref}/hqdefault.jpg` : undefined
}

/**
 * A preview from the provider's oEmbed (CORS-friendly for both). 'blocked': the provider says the
 * clip can't be embedded (private, removed, or the owner switched embedding off), so it won't play in
 * the room. 'unknown': no answer (offline, a slow network, or a file link): it may still play.
 */
export interface VideoPreview {
  status: 'ok' | 'blocked' | 'unknown'
  title?: string
  /** the channel / uploader */
  author?: string
  thumbnail?: string
  /** seconds (Vimeo tells; YouTube doesn't) */
  durationS?: number
}

const clean = (v: unknown, max = 200) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)

export async function fetchVideoPreview(video: VideoRef, signal?: AbortSignal): Promise<VideoPreview> {
  if (video.provider === 'file') {
    let title: string | undefined
    try {
      title = clean(decodeURIComponent(new URL(video.ref).pathname.split('/').pop() ?? '').replace(/\.(mp4|webm)$/i, ''))
    } catch {
      title = undefined
    }
    return { status: 'unknown', ...(title ? { title } : {}) }
  }
  const link = video.provider === 'youtube' ? `https://www.youtube.com/watch?v=${video.ref}` : `https://vimeo.com/${video.ref}`
  const api =
    video.provider === 'youtube'
      ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(link)}`
      : `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(link)}`
  const fallback: VideoPreview = { status: 'unknown', ...(video.provider === 'youtube' ? { thumbnail: videoThumb('youtube', video.ref) } : {}) }
  try {
    const res = await fetch(api, { signal, credentials: 'omit', referrerPolicy: 'strict-origin-when-cross-origin' })
    // YouTube: 401 = embedding switched off, 403 = private, 404 = gone. Vimeo: 403 / 404 the same
    if (res.status === 401 || res.status === 403 || res.status === 404) return { ...fallback, status: 'blocked' }
    if (!res.ok) return fallback
    const data = (await res.json()) as Record<string, unknown>
    const duration = typeof data.duration === 'number' && data.duration > 0 ? Math.round(data.duration) : undefined
    const thumbnail = clean(data.thumbnail_url, 2000)
    return {
      status: 'ok',
      title: clean(data.title),
      author: clean(data.author_name, 120),
      thumbnail: thumbnail?.startsWith('https://') ? thumbnail : fallback.thumbnail,
      ...(duration ? { durationS: duration } : {}),
    }
  } catch {
    return fallback
  }
}

/** What watchStart takes: the link plus what the preview found out. */
export function toVideoPick(video: VideoRef, preview?: VideoPreview): VideoPick {
  return {
    provider: video.provider,
    ref: video.ref,
    ...(preview?.title ? { title: preview.title } : {}),
    ...(preview?.durationS ? { durationS: preview.durationS } : {}),
    ...(video.startAt ? { startS: video.startAt } : {}),
  }
}

/** 75 → "1:15", 3725 → "1:02:05" */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** The host a file link plays from ("cdn.example.com"), for the consent note. */
export function videoHost(ref: string): string {
  try {
    return new URL(ref).hostname
  } catch {
    return ref
  }
}
