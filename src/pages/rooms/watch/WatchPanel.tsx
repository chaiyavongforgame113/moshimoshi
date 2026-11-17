import { useReducedMotion } from 'motion/react'
import { CircleAlert, ExternalLink, MonitorPlay, Pause, Play, RefreshCw, RotateCcw, Square, Undo2, WifiLow } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Avatar, Button, Sheet } from '@/components/ui'
import { usePeople, useServerClock, useWatchViewers, type RoomWatchView } from '@/data/hooks'
import { providerName, videoLink, watchEnded, watchPositionAt } from '@/data/watch'
import { MOCHI } from '@/lib/colors'
import { useNow } from '@/lib/hooks'
import { displayName, t } from '@/lib/i18n'
import { useMoshi } from '@/lib/store'
import type { Room, RoomWatch, User } from '@/lib/types'
import { AvatarStack } from '../bits'
import { giveWatchConsent, useWatchConsent } from './consent'
import { consentText, openOn, policyLinks, untitled } from './copy'
import { createPlayer, type PlayerError, type PlayerHandle, type PlayerState } from './players'
import { WatchSync, type SyncStatus } from './sync'

/*
 * Watching a clip together, inside the room (no route of its own). Everyone runs their own player;
 * WatchSync keeps it in step with the room's state on the server. Rules from the proposal (section 5):
 * nothing is ever drawn over the player (every note, button and the consent card sit below it or in
 * its place before it loads), one player, no 3D scene beside it, paused here while the tab is hidden
 * or a sheet covers the page, and an OK from the person before the app plays and pauses for them.
 * The player frame is never under 200 × 200 px (YouTube's minimum): narrower than 16:9 allows, the
 * clip letterboxes inside it.
 *
 * Phones and tablets: the player sticks under the room's top bar (the panel must be a direct child of
 * the room page, which passes --room-bar, the top bar's height) while the chat scrolls below it. The
 * notes that need a look or a tap right now ("แตะเพื่อเริ่มดูพร้อมเพื่อน", "กลับไปดูพร้อมเพื่อน", a slow
 * connection) stick with it, under the video, and the page's scroll-padding keeps whatever has the
 * focus clear of it. `wide` (1280px and up): the room page puts the panel in a sticky column beside
 * the chat.
 */
export function WatchPanel({ room, view, wide = false, onPick }: { room: Room; view: RoomWatchView; wide?: boolean; onPick: () => void }) {
  const w = view.watch
  if (!view.enabled || !w) return null
  // a different clip (or the same one put on again) gets a fresh player
  return <WatchOn key={`${w.provider}:${w.ref}:${w.startedAt ?? ''}`} room={room} view={view} watch={w} wide={wide} onPick={onPick} />
}

type Phase = 'loading' | 'ready' | 'error'

/** A sheet is open over the page (Sheet makes #root inert while it is). */
function useCovered(): boolean {
  const [covered, setCovered] = useState(false)
  useEffect(() => {
    const root = document.getElementById('root')
    if (!root) return
    const read = () => setCovered(root.inert)
    read()
    const mo = new MutationObserver(read)
    mo.observe(root, { attributes: true, attributeFilter: ['inert'] })
    return () => mo.disconnect()
  }, [])
  return covered
}

/**
 * While `el` (the sticky player) is on: the page scrolls focused things clear of it (WCAG 2.4.11),
 * and <html data-sticky-player> tells page-wide overlays (toasts at the top) to keep off it.
 */
function useScrollPadding(el: HTMLElement | null) {
  useEffect(() => {
    if (!el) return
    const html = document.documentElement
    const set = () => {
      const top = Number.parseFloat(getComputedStyle(el).top) || 0
      html.style.scrollPaddingTop = `${Math.round(top + el.offsetHeight + 8)}px`
    }
    set()
    html.dataset.stickyPlayer = ''
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => {
      ro.disconnect()
      html.style.scrollPaddingTop = ''
      delete html.dataset.stickyPlayer
    }
  }, [el])
}

type StatusKind = 'error' | 'blocked' | 'solo' | 'ended' | 'paused' | 'slow' | 'live' | 'with'
/** phones and tablets: these stick with the player (they need a look, or a tap, right now) */
const STICKY_KINDS: readonly StatusKind[] = ['blocked', 'solo', 'slow']

function WatchOn({ room, view, watch: w, wide, onPick }: { room: Room; view: RoomWatchView; watch: RoomWatch; wide: boolean; onPick: () => void }) {
  const consented = useWatchConsent(w.provider, w.ref)
  const clock = useServerClock()
  const watchControl = useMoshi((s) => s.watchControl)
  const watchReport = useMoshi((s) => s.watchReport)
  const covered = useCovered()
  const [status, setStatus] = useState<SyncStatus>({ mode: 'follow', blocked: false, slow: false })
  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState<PlayerError | null>(null)
  const [playerTitle, setPlayerTitle] = useState<string>()
  const [localEnd, setLocalEnd] = useState(false)
  const [stuck, setStuck] = useState<HTMLDivElement | null>(null)
  const engine = useRef<WatchSync | null>(null)
  const player = useRef<PlayerHandle | null>(null)
  const host = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const nowRef = useRef(clock.now)
  const latest = useRef(w)
  const control = useRef(view.canControl)
  const reported = useRef(false)

  useEffect(() => {
    nowRef.current = clock.now
    latest.current = w
    control.current = view.canControl
  })

  /**
   * Tell the room what my player knows and the room doesn't, once: that it's live, or its length (so
   * the room knows when it ends: YouTube's oEmbed has no length). Someone who may control it only.
   */
  const report = (s: PlayerState) => {
    const p = player.current
    const now = latest.current
    if (reported.current || !p || !control.current || now.isLive || now.durationS) return
    if (s !== 'playing' && s !== 'ended') return
    if (p.live()) {
      reported.current = true
      void watchReport(room.id, now.ref, { isLive: true })
      return
    }
    const d = p.duration()
    if (!Number.isFinite(d) || d <= 0) return
    // YouTube can give an ad's length while one plays: the clip's own counts once it has ended
    if (now.provider === 'youtube' && s !== 'ended') return
    reported.current = true
    void watchReport(room.id, now.ref, { durationS: d })
  }
  const reportRef = useRef(report)
  useEffect(() => {
    reportRef.current = report
  })

  // the engine: one per clip
  useEffect(() => {
    const e = new WatchSync(latest.current, () => nowRef.current(), setStatus, (a) => watchControl(room.id, a.action, a.positionS))
    engine.current = e
    return () => {
      e.destroy()
      engine.current = null
    }
  }, [room.id, watchControl])
  useEffect(() => engine.current?.setWatch(w), [w])
  useEffect(() => engine.current?.setControl(view.canControl), [view.canControl])
  useEffect(() => engine.current?.nudge(), [clock.offsetMs])
  useEffect(() => engine.current?.setHold('covered', covered), [covered])
  // never in the background: a hidden tab pauses here, and catches up on return
  useEffect(() => {
    const read = () => engine.current?.setHold('hidden', document.visibilityState !== 'visible')
    read()
    document.addEventListener('visibilitychange', read)
    return () => document.removeEventListener('visibilitychange', read)
  }, [])

  // the player itself: only after the person said OK
  useEffect(() => {
    const box = host.current
    if (!consented || !box) return
    let alive = true
    let made: PlayerHandle | null = null
    const mount = document.createElement('div')
    mount.className = 'absolute inset-0'
    box.appendChild(mount)
    const now = latest.current
    const start = now.isLive ? 0 : watchPositionAt(now, nowRef.current())
    createPlayer(mount, now.provider, now.ref, start, {
      state: (s) => {
        engine.current?.handleState(s)
        if (!alive) return
        setLocalEnd(s === 'ended')
        reportRef.current(s)
      },
      blocked: () => engine.current?.markBlocked(),
      error: (kind) => {
        if (!alive) return
        setError(kind)
        setPhase('error')
      },
      title: (title) => alive && setPlayerTitle(title),
    })
      .then((p) => {
        if (!alive) {
          p.destroy()
          return
        }
        made = p
        player.current = p
        setPhase((ph) => (ph === 'error' ? ph : 'ready'))
        engine.current?.attach(p)
      })
      .catch(() => {
        if (!alive) return
        setError((e) => e ?? 'failed')
        setPhase('error')
      })
    return () => {
      alive = false
      engine.current?.detach()
      made?.destroy()
      player.current = null
      mount.remove()
    }
  }, [consented])

  // start playback for someone only while over half the player is on screen
  useEffect(() => {
    const el = frame.current
    if (!consented || !el) return
    const io = new IntersectionObserver(([e]) => engine.current?.setInView(!!e && e.intersectionRatio >= 0.5), { threshold: [0, 0.5, 1] })
    io.observe(el)
    return () => io.disconnect()
  }, [consented])

  // counted as watching while the player is in and the clip hasn't ended here (once nobody is, the
  // room knows it's free for the next clip)
  const viewers = useWatchViewers(room.id, consented && phase === 'ready' && !localEnd)
  useScrollPadding(wide ? null : stuck)

  // "จบแล้ว" turns up on its own when a clip with a known length reaches its end
  const tick = useNow(4000)
  const ended = watchEnded(w, tick + clock.offsetMs) || (localEnd && !w.isLive)
  // the status line's own button is the one to tap now; then the room controls step back
  const kind: StatusKind | null =
    phase === 'error'
      ? 'error'
      : !consented || phase === 'loading'
        ? null
        : status.blocked
          ? 'blocked'
          : status.mode === 'solo'
            ? 'solo'
            : ended
              ? 'ended'
              : !w.playing
                ? 'paused'
                : status.slow
                  ? 'slow'
                  : w.isLive
                    ? 'live'
                    : 'with'
  const sticky = !wide && !!kind && STICKY_KINDS.includes(kind)
  const statusLine = kind && (
    <StatusLine
      kind={kind}
      compact={sticky}
      error={error}
      canControl={view.canControl}
      roomPlaying={w.playing && !ended}
      provider={w.provider}
      onTap={() => engine.current?.tapToPlay()}
      onRejoin={() => engine.current?.rejoin()}
      onPick={onPick}
    />
  )

  const stage = consented ? (
    <div
      ref={frame}
      role="region"
      aria-label={t('วิดีโอที่ห้องดูด้วยกัน', 'The video the room is watching')}
      className="relative mx-auto aspect-video min-h-[200px] w-full max-w-[max(356px,calc(42dvh*16/9))] overflow-hidden rounded-[1.6rem] bg-[#1d1412] shadow-[var(--shadow-lift)]"
    >
      {/* under the player (it covers this once it's in): never on top of it */}
      {phase === 'loading' && (
        <span role="status" className="absolute inset-0 flex items-center justify-center gap-2 text-sm font-semibold text-white/80">
          <MonitorPlay size={18} strokeWidth={2.4} aria-hidden />
          {t('กำลังเปิดคลิป…', 'Opening the clip…')}
        </span>
      )}
      {/* a sheet over the page: the player hides (and pauses here) rather than sit under it */}
      <div ref={host} className={`absolute inset-0 ${covered ? 'invisible' : ''}`} />
    </div>
  ) : (
    <ConsentCard room={room} watch={w} over={view.released} onOk={() => giveWatchConsent(w.provider, w.ref)} />
  )

  const deck = (
    <WatchDeck
      room={room}
      view={view}
      watch={w}
      title={w.title ?? playerTitle}
      consented={consented}
      kind={kind}
      ended={ended}
      // phones and tablets: the ones that need a tap now sit under the video instead
      statusLine={sticky ? null : statusLine}
      viewers={viewers}
      position={() => (w.isLive ? undefined : player.current?.time())}
      onPick={onPick}
    />
  )

  if (wide) {
    return (
      <div className="flex flex-col">
        {stage}
        {deck}
      </div>
    )
  }
  return (
    <>
      {consented ? (
        <div ref={setStuck} className="sticky top-[var(--room-bar,4rem)] z-20 -mx-4 bg-cream px-4 pt-1 pb-2 lg:mx-0 lg:px-0">
          {stage}
          <div aria-live="polite" className="mx-auto w-full max-w-[max(356px,calc(42dvh*16/9))] empty:hidden">
            {sticky && statusLine}
          </div>
          {/* the chat fades in under the player instead of meeting a hard edge */}
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-full h-4 bg-linear-to-b from-cream to-transparent" />
        </div>
      ) : (
        stage
      )}
      {deck}
    </>
  )
}

// ------------------------------------------------------------------ before the first clip: an OK

/** `over`: the clip no longer holds the room (it ended, or sat paused a while) */
function ConsentCard({ room, watch: w, over, onOk }: { room: Room; watch: RoomWatch; over: boolean; onOk: () => void }) {
  const id = useId()
  const p = MOCHI[room.color]
  return (
    <section aria-labelledby={`${id}-t`} className="card relative overflow-hidden rounded-[2rem] p-5">
      <span aria-hidden className="pointer-events-none absolute -top-12 -right-10 size-40 rounded-full opacity-50 blur-2xl" style={{ background: p.base }} />
      <div className="relative flex items-start gap-3.5">
        <span
          aria-hidden
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl text-ink shadow-[var(--shadow-soft)]"
          style={{ background: `linear-gradient(150deg, ${p.light}, ${p.base})` }}
        >
          <MonitorPlay size={22} strokeWidth={2.4} />
        </span>
        <div className="min-w-0">
          <h2 id={`${id}-t`} className="font-display text-lg leading-snug font-semibold text-ink">
            {over ? t('คลิปล่าสุดที่ห้องนี้ดูด้วยกัน', 'The last clip this room watched together') : t('ห้องนี้กำลังดูคลิปด้วยกัน', 'This room is watching a clip together')}
          </h2>
          <p className="mt-1 text-sm [overflow-wrap:anywhere] text-ink-soft">{consentText(w.provider, w.ref)}</p>
          <PolicyLinks provider={w.provider} className="mt-1.5" />
        </div>
      </div>
      <Button block className="relative mt-4" icon={<Play size={18} strokeWidth={2.6} aria-hidden />} onClick={onOk}>
        {t('ตกลง เริ่มดูเลย', "OK, let's watch")}
      </Button>
    </section>
  )
}

export function PolicyLinks({ provider, className = '' }: { provider: RoomWatch['provider']; className?: string }) {
  const links = policyLinks(provider)
  if (!links.length) return null
  return (
    <p className={`flex flex-wrap gap-x-3 gap-y-1 text-xs ${className}`}>
      {links.map((l) => (
        <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink underline decoration-ink/30 underline-offset-2 hover:decoration-ink">
          {l.label}
        </a>
      ))}
    </p>
  )
}

// ------------------------------------------------------------------ under the player

interface DeckProps {
  room: Room
  view: RoomWatchView
  watch: RoomWatch
  title?: string
  consented: boolean
  /** what the status line says (null: nothing yet) */
  kind: StatusKind | null
  /** the clip is over (by the room's clock, or my own player reached its end) */
  ended: boolean
  /** the status line to show here (null: none, or it sits under the video) */
  statusLine: ReactNode
  viewers: User[]
  /** where my own player is (seconds), for play / pause from here */
  position: () => number | undefined
  onPick: () => void
}

function WatchDeck({ room, view, watch: w, title, consented, kind, ended, statusLine, viewers, position, onPick }: DeckProps) {
  const id = useId()
  const people = usePeople()
  const me = useMoshi((s) => s.me)
  const watchControl = useMoshi((s) => s.watchControl)
  const watchStop = useMoshi((s) => s.watchStop)
  const watchSetOpen = useMoshi((s) => s.watchSetOpen)
  const [stopping, setStopping] = useState(false)
  const [busy, setBusy] = useState(false)
  const by: User | undefined = w.startedBy === me.id ? me : people.find((u) => u.id === w.startedBy)
  const byName = by ? (by.id === me.id ? t('เรา', 'You') : displayName(by.name)) : undefined

  // the status line's own button is the one to tap now (here or under the video): the room
  // controls step back
  const statusLeads = kind === 'blocked' || kind === 'solo' || (kind === 'error' && view.canControl) || !consented

  const run = async (fn: () => Promise<boolean>) => {
    if (busy) return
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }
  const playing = w.playing && !ended
  const toggle = () =>
    run(() => (playing ? watchControl(room.id, 'pause', position()) : watchControl(room.id, 'play', ended && !w.isLive ? 0 : undefined)))

  return (
    <section aria-labelledby={`${id}-title`} className="glass relative mt-3 overflow-hidden rounded-[2rem] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl text-ink"
          style={{ background: `linear-gradient(150deg, ${MOCHI[room.color].light}, ${MOCHI[room.color].base})` }}
        >
          <MonitorPlay size={20} strokeWidth={2.4} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-ink-soft">
            {t('ดูด้วยกัน', 'Watch together')} · {providerName(w.provider)}
            {w.isLive ? ` · ${t('ไลฟ์สด', 'Live')}` : ''}
          </p>
          <h2 id={`${id}-title`} className="line-clamp-2 font-display text-lg leading-snug font-semibold [overflow-wrap:anywhere] text-ink">
            {title ?? untitled(w.provider)}
          </h2>
        </div>
        <a
          href={videoLink(w.provider, w.ref)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={openOn(w.provider)}
          title={openOn(w.provider)}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-ink shadow-[var(--shadow-soft)] ring-1 ring-line transition-colors hover:bg-cream"
        >
          <ExternalLink size={18} strokeWidth={2.4} aria-hidden />
        </a>
      </div>

      {(by || viewers.length > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-soft">
          {by && byName && (
            <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
              <Avatar color={by.color} size={26} face="happy" />
              <span className="min-w-0 truncate">{by.id === me.id ? t('เราเปิดคลิปนี้', 'You put this on') : t(`${byName} เปิดคลิปนี้`, `${byName} put this on`)}</span>
            </span>
          )}
          {viewers.length > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <AvatarStack people={viewers.map((u) => ({ id: u.id, color: u.color, face: 'happy' as const }))} size={24} max={5} />
              <span>{t(`ดูอยู่ ${viewers.length} คน`, `${viewers.length} watching`)}</span>
            </span>
          )}
        </div>
      )}

      <div aria-live="polite" className="empty:hidden">
        {statusLine}
      </div>

      {view.canControl ? (
        <div className="mt-4 border-t border-dashed border-line pt-4">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={statusLeads ? 'secondary' : 'primary'}
              disabled={busy}
              icon={playing ? <Pause size={16} strokeWidth={2.6} aria-hidden /> : ended ? <RotateCcw size={16} strokeWidth={2.6} aria-hidden /> : <Play size={16} strokeWidth={2.6} aria-hidden />}
              onClick={toggle}
            >
              {playing ? t('หยุดให้ทุกคน', 'Pause for everyone') : ended ? t('เล่นอีกรอบ', 'Play again') : t('เล่นให้ทุกคน', 'Play for everyone')}
            </Button>
            <Button size="sm" variant="secondary" icon={<RefreshCw size={16} strokeWidth={2.4} aria-hidden />} onClick={onPick}>
              {t('เปลี่ยนคลิป', 'Change clip')}
            </Button>
            <Button size="sm" variant="ghost" icon={<Square size={15} strokeWidth={2.6} aria-hidden />} onClick={() => setStopping(true)}>
              {t('ปิดคลิป', 'Stop')}
            </Button>
          </div>
          {!w.isLive && (
            <p className="mt-2 text-xs text-ink-soft">
              {t('เลื่อนบนแถบของวิดีโอได้เลย ทุกคนจะไปดูตรงนั้นด้วยกัน', "Drag the video's own bar to move: everyone goes there with you")}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-ink-soft">
          {t('คนเปิดคลิปกับพี่โมชิประจำห้องเป็นคนกดเล่นและหยุดนะ', 'Whoever put it on and the room hosts play and pause it')}
        </p>
      )}

      {view.canOpen && (
        <OpenSwitch on={view.anyoneCanControl} disabled={busy} onToggle={() => run(() => watchSetOpen(room.id, !view.anyoneCanControl))} />
      )}

      <Sheet open={stopping} onClose={() => setStopping(false)} title={t('ปิดคลิปให้ทุกคน?', 'Stop the clip for everyone?')} width={460}>
        <div className="space-y-4 pb-3">
          <p className="text-ink">
            {t('คลิปจะหยุดและหายไปจากห้องสำหรับทุกคน แชทยังคุยกันต่อได้ตามปกตินะ', 'The clip stops and leaves the room for everyone. The chat carries on as usual')}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button
              variant="dark"
              block
              icon={<Square size={16} strokeWidth={2.6} aria-hidden />}
              onClick={() => {
                setStopping(false)
                void run(() => watchStop(room.id))
              }}
            >
              {t('ปิดคลิป', 'Stop the clip')}
            </Button>
            <Button variant="ghost" block onClick={() => setStopping(false)}>
              {t('ดูต่อ', 'Keep watching')}
            </Button>
          </div>
        </div>
      </Sheet>
    </section>
  )
}

function StatusLine({
  kind,
  compact = false,
  error,
  canControl,
  roomPlaying,
  provider,
  onTap,
  onRejoin,
  onPick,
}: {
  kind: StatusKind
  /** under the sticky video (phones and tablets): as small as it can be */
  compact?: boolean
  error: PlayerError | null
  canControl: boolean
  /** the room's clip is playing (not paused, not over) */
  roomPlaying: boolean
  provider: RoomWatch['provider']
  onTap: () => void
  onRejoin: () => void
  onPick: () => void
}) {
  const reduce = useReducedMotion()
  const dot = (
    <span aria-hidden className="relative inline-flex size-2.5 shrink-0">
      {!reduce && <span className="absolute inset-0 animate-ping rounded-full bg-success/50" />}
      <span className="relative inline-flex size-2.5 rounded-full bg-success" />
    </span>
  )
  const gap = compact ? 'mt-2' : 'mt-3'
  const line = (icon: ReactNode, text: string) => (
    <p className={`${gap} flex items-start gap-2 text-sm font-semibold text-ink`}>
      <span className="mt-1 inline-flex shrink-0">{icon}</span>
      <span className="min-w-0 [overflow-wrap:anywhere]">{text}</span>
    </p>
  )
  if (kind === 'error') {
    const text =
      error === 'embed'
        ? t(`เจ้าของคลิปไม่ได้เปิดให้ดูนอก ${providerName(provider)} นะ กดปุ่มลูกศรด้านบนไปดูที่นั่นได้`, `The owner doesn't allow this clip outside ${providerName(provider)}. Use the arrow button above to watch it there`)
        : error === 'missing'
          ? t('คลิปนี้ไม่มีแล้ว หรือเป็นคลิปส่วนตัวนะ', 'This clip is gone, or it’s private')
          : t('โหลดคลิปไม่ขึ้น ลองเช็กเน็ตแล้วเปิดห้องใหม่อีกทีนะ', "The clip didn't load. Check your connection, then open the room again")
    return (
      <div className="mt-3 rounded-2xl bg-white/80 p-3">
        <p className="flex items-start gap-2 text-sm text-ink">
          <CircleAlert size={17} strokeWidth={2.4} className="mt-0.5 shrink-0 text-coral-deep" aria-hidden />
          <span className="min-w-0 [overflow-wrap:anywhere]">{text}</span>
        </p>
        {canControl && (
          <Button size="sm" className="mt-2.5" icon={<RefreshCw size={16} strokeWidth={2.4} aria-hidden />} onClick={onPick}>
            {t('เปลี่ยนเป็นคลิปอื่น', 'Pick another clip')}
          </Button>
        )}
      </div>
    )
  }
  if (kind === 'blocked') {
    return (
      <div className={gap}>
        <Button block size={compact ? 'sm' : 'md'} icon={<Play size={18} strokeWidth={2.6} aria-hidden />} onClick={onTap}>
          {t('แตะเพื่อเริ่มดูพร้อมเพื่อน', 'Tap to watch with everyone')}
        </Button>
        {!compact && (
          <p className="mt-1.5 text-center text-xs text-ink-soft">{t('ถ้ายังไม่เล่น แตะปุ่มเล่นบนวิดีโอได้เลยนะ', "Still not playing? Tap the video's own play button")}</p>
        )}
      </div>
    )
  }
  if (kind === 'solo') {
    return (
      <div className={`${gap} flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-2xl bg-white/80 ${compact ? 'p-2 pl-3' : 'p-3'}`}>
        <p className="min-w-0 flex-[999_1_12rem] text-sm text-ink">
          <b className="font-display">{t('พักเฉพาะเรา', 'Watching on your own')}</b>
          {!compact && (
            <span className="text-ink-soft"> · {roomPlaying ? t('เพื่อนๆ ยังดูกันต่อนะ', 'everyone else keeps watching') : t('ห้องหยุดไว้อยู่', 'the room is paused')}</span>
          )}
        </p>
        <Button size="sm" className="flex-[1_0_auto]" icon={<Undo2 size={16} strokeWidth={2.6} aria-hidden />} onClick={onRejoin}>
          {t('กลับไปดูพร้อมเพื่อน', 'Back to watching together')}
        </Button>
      </div>
    )
  }
  if (kind === 'ended') return line(<RotateCcw size={15} strokeWidth={2.4} aria-hidden />, t('จบแล้ว! คุยกันต่อได้เลยนะ', 'That’s the end! Keep the chat going'))
  if (kind === 'paused')
    return line(
      <Pause size={15} strokeWidth={2.6} aria-hidden />,
      canControl ? t('หยุดไว้อยู่ กดเล่นให้ทุกคนได้เลย', "Paused. Play it for everyone when you're ready") : t('หยุดไว้ก่อน เดี๋ยวเล่นต่อพร้อมกันนะ', "Paused for now. It'll carry on for everyone together"),
    )
  if (kind === 'slow') return line(<WifiLow size={16} strokeWidth={2.4} aria-hidden />, t('เน็ตช้านิดนึง กำลังตามเพื่อน…', 'Slow connection, catching up with everyone…'))
  if (kind === 'live') return line(dot, t('ไลฟ์สด ดูพร้อมเพื่อนอยู่', 'Live, watching with everyone'))
  return line(dot, t('ดูพร้อมเพื่อนอยู่ เล่นและหยุดตามห้อง', 'Watching with everyone, in step with the room'))
}

function OpenSwitch({ on, disabled, onToggle }: { on: boolean; disabled: boolean; onToggle: () => void }) {
  const id = useId()
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-labelledby={`${id}-l`}
      aria-describedby={`${id}-d`}
      disabled={disabled}
      onClick={onToggle}
      className="mt-3 flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl bg-white/80 px-3 py-2.5 text-left transition-colors hover:bg-white disabled:opacity-60"
    >
      <span className="min-w-0">
        <span id={`${id}-l`} className="block font-display text-sm font-semibold text-ink">
          {t('ให้ทุกคนคุมได้', 'Let everyone control')}
        </span>
        <span id={`${id}-d`} className="block text-xs text-ink-soft">
          {t('สมาชิกทุกคนกดเล่น หยุด และเลื่อนคลิปได้', 'Every member can play, pause and move the clip')}
        </span>
      </span>
      <span aria-hidden className="relative h-7 w-12 shrink-0 rounded-full transition-colors" style={{ background: on ? MOCHI.mint.shade : 'rgb(59 38 34 / 0.15)' }}>
        <span className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow-[var(--shadow-soft)] transition-transform ${on ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  )
}
