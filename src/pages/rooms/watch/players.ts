// One small interface over the three players a room can watch with: YouTube's IFrame Player API,
// Vimeo's Player SDK and a plain <video> for https .mp4 / .webm files. The provider scripts load
// lazily, once, only after the viewer said OK to watching (see consent.ts). Every player plays inline
// (playsinline), never starts on its own, and nothing is ever drawn over it.
import type { WatchProvider } from '@/lib/types'

export type PlayerState = 'unstarted' | 'playing' | 'paused' | 'buffering' | 'ended' | 'cued'

/** embed: the owner doesn't allow playing it elsewhere / private · missing: gone · failed: anything else */
export type PlayerError = 'embed' | 'missing' | 'failed'

export interface PlayerEvents {
  state: (state: PlayerState) => void
  /** the browser wants a tap before this player may start (iPhone, autoplay rules) */
  blocked: () => void
  error: (error: PlayerError) => void
  /** what the player itself calls the clip (when the room has no title for it) */
  title?: (title: string) => void
}

export interface PlayerHandle {
  /** start playing; 'blocked' when the browser didn't let it start without a tap */
  play: () => Promise<'ok' | 'blocked'>
  pause: () => void
  seek: (seconds: number) => void
  /** where the clip is, seconds */
  time: () => number
  state: () => PlayerState
  setRate: (rate: number) => void
  /** seconds; 0 while unknown (during an ad YouTube reports the ad's length) */
  duration: () => number
  /** a live stream: no positions to line up */
  live: () => boolean
  destroy: () => void
}

const noop = () => {}

// ------------------------------------------------------------------ scripts, once each

const scripts = new Map<string, Promise<void>>()

function loadScript(src: string): Promise<void> {
  let p = scripts.get(src)
  if (!p) {
    p = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = src
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => {
        scripts.delete(src)
        s.remove()
        reject(new Error(`could not load ${src}`))
      }
      document.head.appendChild(s)
    })
    scripts.set(src, p)
  }
  return p
}

/** waits until `ok()` (→ 'ok'), `refused()` or the time runs out (→ 'blocked') */
function settle(ok: () => boolean, refused: () => boolean, ms: number): Promise<'ok' | 'blocked'> {
  return new Promise((resolve) => {
    const until = Date.now() + ms
    const check = () => {
      if (ok()) resolve('ok')
      else if (refused() || Date.now() > until) resolve('blocked')
      else window.setTimeout(check, 120)
    }
    window.setTimeout(check, 120)
  })
}

// ------------------------------------------------------------------ YouTube

interface YTPlayer {
  playVideo: () => void
  pauseVideo: () => void
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  getCurrentTime: () => number
  getPlayerState: () => number
  setPlaybackRate: (rate: number) => void
  getDuration: () => number
  destroy: () => void
  getVideoData?: () => { title?: string; isLive?: boolean } | undefined
}
interface YTEvent {
  data: number
  target: YTPlayer
}
interface YTNamespace {
  Player: new (el: HTMLElement, options: Record<string, unknown>) => YTPlayer
}
type YTWindow = Window & { YT?: Partial<YTNamespace>; onYouTubeIframeAPIReady?: () => void }

let ytApi: Promise<YTNamespace> | null = null

function loadYouTube(): Promise<YTNamespace> {
  const w = window as YTWindow
  if (w.YT?.Player) return Promise.resolve(w.YT as YTNamespace)
  ytApi ??= new Promise<YTNamespace>((resolve, reject) => {
    const prev = w.onYouTubeIframeAPIReady
    w.onYouTubeIframeAPIReady = () => {
      prev?.()
      if (w.YT?.Player) resolve(w.YT as YTNamespace)
    }
    loadScript('https://www.youtube.com/iframe_api').catch((err: unknown) => {
      ytApi = null
      reject(err instanceof Error ? err : new Error('youtube'))
    })
  })
  return ytApi
}

const YT_STATE: Record<number, PlayerState> = { [-1]: 'unstarted', 0: 'ended', 1: 'playing', 2: 'paused', 3: 'buffering', 5: 'cued' }

async function youTube(mount: HTMLElement, ref: string, startAt: number, ev: PlayerEvents): Promise<PlayerHandle> {
  const YT = await loadYouTube()
  return new Promise<PlayerHandle>((resolve, reject) => {
    let blocked = false
    let made = false
    const el = document.createElement('div')
    mount.appendChild(el)
    const p: YTPlayer = new YT.Player(el, {
      // the privacy-enhanced host: no YouTube cookies until the person plays
      host: 'https://www.youtube-nocookie.com',
      videoId: ref,
      width: '100%',
      height: '100%',
      playerVars: {
        playsinline: 1,
        rel: 0,
        autoplay: 0,
        iv_load_policy: 3,
        start: Math.max(0, Math.floor(startAt)),
        origin: window.location.origin,
        enablejsapi: 1,
      },
      events: {
        onReady: () => {
          made = true
          const title = p.getVideoData?.()?.title
          if (title) ev.title?.(title)
          resolve(handle)
        },
        onStateChange: (e: YTEvent) => {
          const s = YT_STATE[e.data] ?? 'unstarted'
          if (s === 'playing' || s === 'buffering') blocked = false
          ev.state(s)
        },
        onAutoplayBlocked: () => {
          blocked = true
          ev.blocked()
        },
        onError: (e: YTEvent) => {
          const kind: PlayerError = e.data === 101 || e.data === 150 ? 'embed' : e.data === 100 || e.data === 2 ? 'missing' : 'failed'
          ev.error(kind)
          if (!made) reject(new Error(kind))
        },
      },
    })
    const state = (): PlayerState => YT_STATE[p.getPlayerState?.() ?? -1] ?? 'unstarted'
    const handle: PlayerHandle = {
      play: () => {
        blocked = false
        p.playVideo()
        return settle(
          () => state() === 'playing' || state() === 'buffering',
          () => blocked,
          2600,
        )
      },
      pause: () => p.pauseVideo(),
      seek: (s) => p.seekTo(Math.max(0, s), true),
      time: () => p.getCurrentTime?.() ?? 0,
      state,
      setRate: (r) => p.setPlaybackRate(r),
      duration: () => p.getDuration?.() ?? 0,
      live: () => !!p.getVideoData?.()?.isLive,
      destroy: () => {
        try {
          p.destroy()
        } catch {
          // already gone with its iframe
        }
        el.remove()
      },
    }
  })
}

// ------------------------------------------------------------------ Vimeo

interface VimeoPlayer {
  ready: () => Promise<void>
  play: () => Promise<void>
  pause: () => Promise<void>
  setCurrentTime: (s: number) => Promise<number>
  setPlaybackRate: (r: number) => Promise<number>
  getDuration: () => Promise<number>
  getVideoTitle: () => Promise<string>
  on: (event: string, cb: (data?: { seconds?: number; duration?: number; playbackRate?: number; name?: string }) => void) => void
  destroy: () => Promise<void>
}
type VimeoWindow = Window & { Vimeo?: { Player: new (el: HTMLElement, options: Record<string, unknown>) => VimeoPlayer } }

async function vimeo(mount: HTMLElement, ref: string, startAt: number, ev: PlayerEvents): Promise<PlayerHandle> {
  await loadScript('https://player.vimeo.com/api/player.js')
  const V = (window as VimeoWindow).Vimeo
  if (!V) throw new Error('vimeo')
  const el = document.createElement('div')
  el.className = 'absolute inset-0'
  mount.appendChild(el)
  // dnt: Vimeo doesn't track the viewer or set cookies
  const p = new V.Player(el, { id: Number(ref), playsinline: true, dnt: true, autoplay: false, title: false, byline: false, portrait: false, width: 640 })
  let st: PlayerState = 'unstarted'
  let t = Math.max(0, startAt)
  let at = Date.now()
  let rate = 1
  let dur = 0
  const set = (s: PlayerState) => {
    st = s
    ev.state(s)
  }
  const mark = (seconds?: number) => {
    if (typeof seconds === 'number') {
      t = seconds
      at = Date.now()
    }
  }
  p.on('play', (d) => {
    mark(d?.seconds)
    set('buffering')
  })
  p.on('playing', (d) => {
    mark(d?.seconds)
    set('playing')
  })
  p.on('pause', (d) => {
    mark(d?.seconds)
    if (st !== 'ended') set('paused')
  })
  p.on('ended', (d) => {
    mark(d?.seconds)
    set('ended')
  })
  p.on('bufferstart', () => st === 'playing' && set('buffering'))
  p.on('bufferend', () => st === 'buffering' && set('playing'))
  p.on('timeupdate', (d) => {
    mark(d?.seconds)
    if (d?.duration) dur = d.duration
  })
  p.on('seeked', (d) => mark(d?.seconds))
  p.on('playbackratechange', (d) => {
    if (d?.playbackRate) rate = d.playbackRate
  })
  p.on('error', () => ev.error('failed'))
  try {
    await p.ready()
  } catch (err) {
    const name = (err as { name?: string } | null)?.name ?? ''
    ev.error(/Privacy|Password|NotFound/i.test(name) ? (name.includes('NotFound') ? 'missing' : 'embed') : 'failed')
    el.remove()
    throw err instanceof Error ? err : new Error('vimeo')
  }
  // the SDK sizes its iframe itself: make it fill the frame
  const frame = el.querySelector('iframe')
  if (frame) frame.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;border:0')
  if (t > 0) p.setCurrentTime(t).catch(noop)
  p.getDuration()
    .then((d) => {
      dur = d
    })
    .catch(noop)
  p.getVideoTitle()
    .then((title) => title && ev.title?.(title))
    .catch(noop)
  return {
    play: () =>
      p
        .play()
        .then(() => 'ok' as const)
        .catch((err: { name?: string } | null) => (err?.name === 'NotAllowedError' ? 'blocked' : 'ok')),
    pause: () => {
      p.pause().catch(noop)
    },
    seek: (s) => {
      mark(Math.max(0, s))
      p.setCurrentTime(Math.max(0, s)).catch(noop)
    },
    time: () => (st === 'playing' ? t + ((Date.now() - at) / 1000) * rate : t),
    state: () => st,
    // only clips on paid Vimeo plans may change speed; the others just stay at 1×
    setRate: (r) => {
      p.setPlaybackRate(r).catch(noop)
    },
    duration: () => dur,
    live: () => false,
    destroy: () => {
      p.destroy().catch(noop)
      el.remove()
    },
  }
}

// ------------------------------------------------------------------ a video file

function videoFile(mount: HTMLElement, ref: string, startAt: number, ev: PlayerEvents): Promise<PlayerHandle> {
  return new Promise<PlayerHandle>((resolve, reject) => {
    const v = document.createElement('video')
    v.playsInline = true
    v.setAttribute('playsinline', '')
    v.controls = true
    v.preload = 'metadata'
    v.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;background:#000')
    let made = false
    const state = (): PlayerState => (v.ended ? 'ended' : v.paused ? (v.currentTime > 0 ? 'paused' : 'unstarted') : v.readyState < 3 ? 'buffering' : 'playing')
    const handle: PlayerHandle = {
      play: () =>
        v
          .play()
          .then(() => 'ok' as const)
          .catch((err: { name?: string } | null) => {
            if (err?.name === 'NotAllowedError') {
              ev.blocked()
              return 'blocked' as const
            }
            return 'ok' as const
          }),
      pause: () => v.pause(),
      seek: (s) => {
        v.currentTime = Math.max(0, s)
      },
      time: () => v.currentTime,
      state,
      setRate: (r) => {
        v.playbackRate = r
      },
      duration: () => (Number.isFinite(v.duration) ? v.duration : 0),
      live: () => v.duration === Number.POSITIVE_INFINITY,
      destroy: () => {
        v.pause()
        v.removeAttribute('src')
        v.load()
        v.remove()
      },
    }
    v.addEventListener('playing', () => ev.state('playing'))
    v.addEventListener('pause', () => !v.ended && ev.state('paused'))
    v.addEventListener('waiting', () => ev.state('buffering'))
    v.addEventListener('ended', () => ev.state('ended'))
    v.addEventListener('error', () => {
      ev.error('failed')
      if (!made) reject(new Error('video'))
    })
    v.addEventListener(
      'loadedmetadata',
      () => {
        if (startAt > 0 && Number.isFinite(v.duration)) v.currentTime = Math.min(startAt, v.duration)
        made = true
        resolve(handle)
      },
      { once: true },
    )
    v.src = ref
    mount.appendChild(v)
  })
}

/**
 * Build the player for a clip inside `mount` (an empty element this function fills; the caller
 * removes it afterwards). Resolves once the player can take commands, starting at `startAt`.
 */
export function createPlayer(mount: HTMLElement, provider: WatchProvider, ref: string, startAt: number, ev: PlayerEvents): Promise<PlayerHandle> {
  if (provider === 'youtube') return youTube(mount, ref, startAt, ev)
  if (provider === 'vimeo') return vimeo(mount, ref, startAt, ev)
  return videoFile(mount, ref, startAt, ev)
}
