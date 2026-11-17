import { CircleAlert, Clock3, Link2, MonitorPlay, Play, RefreshCw } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { Button, Sheet } from '@/components/ui'
import { providerName } from '@/data/watch'
import { t } from '@/lib/i18n'
import { useMoshi } from '@/lib/store'
import type { RoomWatch } from '@/lib/types'
import { fetchVideoPreview, formatClock, parseVideo, toVideoPick, videoThumb, type VideoPreview, type VideoRef } from '@/lib/video'
import { giveWatchConsent } from './consent'
import { consentText, untitled } from './copy'
import { PolicyLinks } from './WatchPanel'

/**
 * "เปิดคลิปดูด้วยกัน": paste a link, see what it is, put it on for the whole room. With a clip
 * already on (`current`, for someone who may control it) this switches to the new one. Starting it
 * here counts as the person's OK to watching along (the note sits right above the button).
 */
export function StartWatchSheet({ roomId, open, onClose, current }: { roomId: string; open: boolean; onClose: () => void; current: RoomWatch | null }) {
  const title = current ? t('เปลี่ยนคลิป', 'Change the clip') : t('เปิดคลิปดูด้วยกัน', 'Watch together')
  return (
    <Sheet open={open} onClose={onClose} title={title} width={500}>
      {open && <PickClip roomId={roomId} changing={!!current} onDone={onClose} />}
    </Sheet>
  )
}

const sleep = (ms: number) => new Promise<undefined>((r) => window.setTimeout(() => r(undefined), ms))

function PickClip({ roomId, changing, onDone }: { roomId: string; changing: boolean; onDone: () => void }) {
  const id = useId()
  const watchStart = useMoshi((s) => s.watchStart)
  const input = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const parsed = useMemo(() => parseVideo(text), [text])
  const provider = parsed.ok ? parsed.provider : null
  const ref = parsed.ok ? parsed.ref : null
  const startAt = parsed.ok ? parsed.startAt : undefined
  const key = provider && ref ? `${provider}:${ref}` : ''
  const video: VideoRef | null = useMemo(() => (provider && ref ? { provider, ref, startAt } : null), [provider, ref, startAt])
  const [preview, setPreview] = useState<{ key: string; data: VideoPreview } | null>(null)
  const pending = useRef<{ key: string; promise: Promise<VideoPreview> } | null>(null)

  // the sheet focuses itself first; then straight into the link field
  useEffect(() => {
    const timer = window.setTimeout(() => input.current?.focus({ preventScroll: true }), 80)
    return () => window.clearTimeout(timer)
  }, [])

  // the same clip (only the start time changed) keeps its preview
  useEffect(() => {
    if (!provider || !ref) return
    const at = `${provider}:${ref}`
    let alive = true
    const ctrl = new AbortController()
    const timeout = window.setTimeout(() => ctrl.abort(), 5000)
    // pasting is one change; typing waits a moment
    const wait = window.setTimeout(() => {
      const promise = fetchVideoPreview({ provider, ref }, ctrl.signal)
      pending.current = { key: at, promise }
      void promise.then((data) => {
        if (alive) setPreview({ key: at, data })
      })
    }, 250)
    return () => {
      alive = false
      ctrl.abort()
      window.clearTimeout(timeout)
      window.clearTimeout(wait)
    }
  }, [provider, ref])

  const shown = preview?.key === key ? preview.data : undefined
  const blocked = shown?.status === 'blocked'
  const problem = !parsed.ok && text.trim() && touched ? parsed.reason : null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!video || blocked || busy) return
    setBusy(true)
    // a preview still on its way: give it a moment for the title, then go anyway
    const data = shown ?? (pending.current?.key === key ? await Promise.race([pending.current.promise, sleep(1500)]) : undefined)
    if (data?.status === 'blocked') {
      setPreview({ key, data })
      setBusy(false)
      return
    }
    const ok = await watchStart(roomId, toVideoPick(video, data))
    setBusy(false)
    if (!ok) return
    // the note above the button said what watching along means
    giveWatchConsent(video.provider, video.ref)
    onDone()
    // the player is at the top of the room
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }

  return (
    <form onSubmit={submit} className="space-y-4 pb-3" noValidate>
      <p className="text-[15px] text-ink-soft">
        {t(
          'วางลิงก์จาก YouTube, Vimeo หรือไฟล์ .mp4 / .webm แล้วทุกคนในห้องจะได้ดูพร้อมกัน คุยกันในแชทไปด้วยได้',
          'Paste a YouTube or Vimeo link, or an .mp4 / .webm file, and everyone in the room watches it together while you chat',
        )}
      </p>
      <div>
        <label htmlFor={`${id}-link`} className="mb-1.5 block font-display text-sm font-semibold text-ink">
          {t('ลิงก์คลิป', 'Clip link')}
        </label>
        <div className="flex min-h-12 items-center gap-2 rounded-2xl border border-line bg-white px-3 focus-within:ring-3 focus-within:ring-lavender">
          <Link2 size={18} strokeWidth={2.4} className="shrink-0 text-ink-soft" aria-hidden />
          <input
            ref={input}
            id={`${id}-link`}
            type="url"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="go"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => setTouched(true)}
            onPaste={() => setTouched(true)}
            placeholder="https://youtu.be/…"
            aria-invalid={problem ? true : undefined}
            aria-describedby={problem ? `${id}-problem` : undefined}
            className="min-h-11 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-faint"
          />
        </div>
        <div aria-live="polite">
          {problem && (
            <p id={`${id}-problem`} className="mt-2 flex items-start gap-1.5 text-sm text-ink">
              <CircleAlert size={16} strokeWidth={2.4} className="mt-0.5 shrink-0 text-coral-deep" aria-hidden />
              <span className="min-w-0">
                {problem === 'insecure'
                  ? t('ลิงก์ไฟล์ต้องขึ้นต้นด้วย https:// นะ ถึงจะเปิดในแอปได้', 'File links need to start with https:// to play in the app')
                  : t(
                      'ลิงก์นี้ยังเปิดในห้องไม่ได้นะ ลองลิงก์จาก YouTube, Vimeo หรือไฟล์ .mp4 / .webm ดูน้า',
                      "This link can't play in the room yet. Try a YouTube or Vimeo link, or an .mp4 / .webm file",
                    )}
              </span>
            </p>
          )}
        </div>
      </div>

      {video && <ClipPreview video={video} preview={shown} />}

      <div aria-live="polite">
        {blocked && (
          <p className="flex items-start gap-1.5 rounded-2xl bg-white/80 p-3 text-sm text-ink">
            <CircleAlert size={16} strokeWidth={2.4} className="mt-0.5 shrink-0 text-coral-deep" aria-hidden />
            <span className="min-w-0">
              {t(
                'คลิปนี้เปิดในแอปไม่ได้นะ เจ้าของอาจปิดการฝังไว้ หรือเป็นคลิปส่วนตัว ลองคลิปอื่นดูนะ',
                "This clip can't play in the app. The owner may have turned off embedding, or it's private. Try another one",
              )}
            </span>
          </p>
        )}
      </div>

      {video && !blocked && (
        <div className="space-y-1">
          <p className="text-xs [overflow-wrap:anywhere] text-ink-soft">
            {consentText(video.provider, video.ref)} {t('ทุกคนในห้องจะเห็นว่าเราเป็นคนเปิดนะ', "Everyone in the room sees that you put it on")}
          </p>
          <PolicyLinks provider={video.provider} />
        </div>
      )}

      <Button
        type="submit"
        block
        size="lg"
        disabled={!video || blocked || busy}
        icon={changing ? <RefreshCw size={18} strokeWidth={2.6} aria-hidden /> : <Play size={18} strokeWidth={2.6} aria-hidden />}
      >
        {busy ? t('กำลังเปิด…', 'Putting it on…') : changing ? t('เปลี่ยนเป็นคลิปนี้', 'Switch to this clip') : t('เปิดให้ทุกคนดู', 'Play it for everyone')}
      </Button>
    </form>
  )
}

function ClipPreview({ video, preview }: { video: VideoRef; preview?: VideoPreview }) {
  const thumb = preview?.thumbnail ?? videoThumb(video.provider, video.ref)
  const [broken, setBroken] = useState<string | null>(null)
  const title = preview?.title ?? (preview ? untitled(video.provider) : undefined)
  return (
    <div className="flex items-center gap-3 rounded-3xl border border-line bg-white p-2.5 shadow-[var(--shadow-soft)]">
      <span className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-2xl bg-cream-3 sm:w-36">
        {thumb && broken !== thumb ? (
          <img src={thumb} alt="" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" className="absolute inset-0 size-full object-cover" onError={() => setBroken(thumb)} />
        ) : (
          <span aria-hidden className="absolute inset-0 flex items-center justify-center text-ink-soft">
            <MonitorPlay size={26} strokeWidth={2.2} />
          </span>
        )}
      </span>
      <div className="min-w-0 flex-1 py-0.5">
        <p className="text-xs font-semibold text-ink-soft">{t(`จาก ${providerName(video.provider)}`, `From ${providerName(video.provider)}`)}</p>
        {title ? (
          <p className="line-clamp-2 font-display leading-snug font-semibold [overflow-wrap:anywhere] text-ink">{title}</p>
        ) : (
          <p role="status" className="mt-1 h-4 w-3/4 animate-pulse rounded-full bg-cream-3">
            <span className="sr-only">{t('กำลังดูว่าคลิปนี้คืออะไร…', 'Looking up the clip…')}</span>
          </p>
        )}
        {preview?.author && <p className="truncate text-xs text-ink-soft">{preview.author}</p>}
        {video.startAt && (
          <p className="mt-1 flex flex-wrap gap-1.5 text-xs font-semibold text-ink">
            <span className="inline-flex items-center gap-1 rounded-full bg-butter/50 px-2 py-0.5">
              <Clock3 size={12} strokeWidth={2.6} aria-hidden />
              {t(`เริ่มที่ ${formatClock(video.startAt)}`, `Starts at ${formatClock(video.startAt)}`)}
            </span>
          </p>
        )}
      </div>
    </div>
  )
}
