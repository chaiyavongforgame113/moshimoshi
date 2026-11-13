import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react'
import { HeartHandshake, Lock, RotateCcw, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Avatar, Button, IconButton, type MochiFace } from '@/components/ui'
import { useChats, useDailyPick, useMyId, useRooms, useSessions, useWavelengthMatches } from '@/data/hooks'
import { t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import { useMoshi } from '@/lib/store'
import type { Mood, Room, Session } from '@/lib/types'
import { liveOrSoon } from '@/pages/events/lib'
import { MOOD_BY_KEY } from '../moods'
import { Breathe } from './Breathe'
import { bubbleIn, MeBubble, MochiBubble, TypingRow } from './Bubbles'
import { SuggestionCard } from './Cards'
import { Dock } from './Dock'
import { dockFor, type Ask, type Card, type Line, type Step } from './engine'
import { say } from './script'
import { useMochiTalk } from './useMochiTalk'

export interface MochiChatProps {
  open: boolean
  onClose: () => void
  /** the mood chip tapped on the home card, so the chat starts from it */
  initialMood?: Mood | null
}

/**
 * "คุยกับโมชิ": a scripted, supportive chat with Little Mochi. Full screen on
 * phones, a large centred panel from md up. Mochi listens first, then offers
 * a few ways to help; it suggests one room, person or session only when asked.
 * The conversation stays on this device.
 */
export function MochiChat({ open, onClose, initialMood }: MochiChatProps) {
  return createPortal(
    <MotionConfig reducedMotion="user">
      <AnimatePresence>{open && <ChatDialog key="mochi-chat" onClose={onClose} initialMood={initialMood} />}</AnimatePresence>
    </MotionConfig>,
    document.body,
  )
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const stepKey = (s: Step) => JSON.stringify(s)

function ChatDialog({ onClose, initialMood }: { onClose: () => void; initialMood?: Mood | null }) {
  const reduce = useReducedMotion()
  const titleId = useId()
  const confirmId = useId()
  const panel = useRef<HTMLDivElement>(null)
  const header = useRef<HTMLElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)
  const restartBtn = useRef<HTMLButtonElement>(null)
  const keepBtn = useRef<HTMLButtonElement>(null)
  const [confirming, setConfirming] = useState(false)
  const [epoch, setEpoch] = useState(0)

  const userId = useMyId()
  const setMood = useMoshi((s) => s.setMood)
  const resolve = useSuggest()
  const { lines, typing, step, ctx, act, restart } = useMochiTalk({ userId, initialMood, resolve })
  const dock = dockFor(step, ctx)
  const key = stepKey(step)
  const mood = ctx.mood && ctx.mood !== 'other' ? MOOD_BY_KEY[ctx.mood] : undefined
  const face: MochiFace = typing ? 'talk' : (mood?.expression ?? 'smile')

  // the mood tapped on the home card counts as today's mood, like the old mood picker
  useEffect(() => {
    if (initialMood) setMood(initialMood)
  }, [initialMood, setMood])

  // keep the latest handlers for the document listener below
  const closeRef = useRef(onClose)
  const confirmingRef = useRef(confirming)
  useEffect(() => {
    closeRef.current = onClose
    confirmingRef.current = confirming
  })

  // a modal: focus inside, Tab stays inside, Esc closes, the page behind is locked and out of reach
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    panel.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (e.defaultPrevented || e.isComposing) return
        if (confirmingRef.current) {
          setConfirming(false)
          restartBtn.current?.focus()
        } else closeRef.current()
        return
      }
      const el = panel.current
      if (e.key !== 'Tab' || !el) return
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => n.offsetParent !== null || n === document.activeElement)
      if (!items.length) {
        e.preventDefault()
        el.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === el || !el.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !el.contains(active))) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const root = document.getElementById('root')
    const wasInert = root?.inert ?? false
    if (root) root.inert = true
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      if (root) root.inert = wasInert
      prev?.focus?.({ preventScroll: true })
    }
  }, [])

  // after Mochi's turn: focus the first quick reply, or the text box when the script invites typing
  useEffect(() => {
    if (typing || step.id === 'breathe') return
    const active = document.activeElement
    // leave people where they are when they're in the header, or already typing
    if (active && (header.current?.contains(active) || active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) return
    const box = dockRef.current
    const target = box?.querySelector<HTMLElement>('[role="group"] button') ?? box?.querySelector<HTMLElement>('textarea')
    target?.focus({ preventScroll: true })
  }, [key, typing, epoch, step.id, confirmId])

  // keep the newest message in view
  const count = lines.length
  const first = useRef(true)
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const behavior = first.current || reduce ? 'auto' : 'smooth'
    first.current = false
    const frame = requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior }))
    return () => cancelAnimationFrame(frame)
  }, [count, typing, key, reduce])

  const askRestart = () => {
    setConfirming(true)
    requestAnimationFrame(() => keepBtn.current?.focus())
  }
  const keepChatting = () => {
    setConfirming(false)
    restartBtn.current?.focus()
  }
  const startOver = () => {
    // off the closing confirm bar first, so focus can land on Mochi's first question
    panel.current?.focus({ preventScroll: true })
    setConfirming(false)
    restart()
    setEpoch((n) => n + 1)
  }

  const showDock = dock.composer || (!typing && (dock.chips.length > 0 || dock.own))

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center md:items-center md:p-6">
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-ink/30 backdrop-blur-[3px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => closeRef.current()}
      />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex h-dvh w-full flex-col overflow-hidden bg-cream outline-none md:h-[min(52rem,calc(100dvh-3rem))] md:max-w-2xl md:rounded-[2rem] md:border-2 md:border-white md:shadow-[var(--shadow-lift)]"
        initial={{ opacity: 0, y: 32, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={spring.soft}
      >
        <header
          ref={header}
          className="relative shrink-0 border-b-2 border-dashed border-peach/70 bg-linear-to-b from-peach/30 to-cream px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 sm:px-6"
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="relative shrink-0 rounded-full bg-white/70 p-1 shadow-[var(--shadow-puffy)]">
              <Avatar color="peach" size={42} face={face} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="font-display text-xl leading-tight font-semibold">
                {t('คุยกับโมชิ', 'Chat with Mochi')}
              </h2>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
                <span className={`size-2 shrink-0 rounded-full ${typing ? 'bg-butter' : 'bg-success'}`} aria-hidden />
                {typing ? t('กำลังพิมพ์…', 'Typing…') : t('อยู่ตรงนี้นะ', "Right here")}
              </p>
            </div>
            <button
              ref={restartBtn}
              type="button"
              onClick={askRestart}
              aria-expanded={confirming}
              aria-controls={confirming ? confirmId : undefined}
              aria-label={t('เริ่มคุยใหม่', 'Start over')}
              title={t('เริ่มคุยใหม่', 'Start over')}
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-white/85 px-3 text-sm font-semibold text-ink ring-1 ring-line transition-colors hover:bg-white"
            >
              <RotateCcw size={16} aria-hidden />
              <span className="hidden sm:inline" aria-hidden>
                {t('เริ่มคุยใหม่', 'Start over')}
              </span>
            </button>
            <IconButton label={t('ปิด', 'Close')} onClick={() => closeRef.current()}>
              <X size={18} aria-hidden />
            </IconButton>
          </div>
          <p className="mt-2 flex items-start gap-1.5 rounded-2xl bg-white/70 px-3 py-1.5 text-xs leading-snug text-ink-soft ring-1 ring-line">
            <HeartHandshake size={14} className="mt-px shrink-0" aria-hidden />
            {t('โมชิเป็นเพื่อนรับฟัง ไม่ใช่ผู้เชี่ยวชาญ', 'Mochi is a friend who listens, not a professional')}
          </p>

          <AnimatePresence initial={false}>
            {confirming && (
              <motion.div
                id={confirmId}
                role="group"
                aria-labelledby={`${confirmId}-q`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={spring.soft}
                className="overflow-hidden"
              >
                <div className="mt-2 rounded-2xl border-2 border-peach bg-white p-3 shadow-[var(--shadow-soft)]">
                  <p id={`${confirmId}-q`} className="text-sm font-semibold text-ink">
                    {t('เริ่มคุยใหม่ไหม? ข้อความที่คุยไว้ในเครื่องนี้จะหายไปนะ', 'Start over? This chat will be cleared from this device')}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button ref={keepBtn} size="sm" variant="secondary" onClick={keepChatting}>
                      {t('คุยต่อดีกว่า', 'Keep chatting')}
                    </Button>
                    <Button size="sm" onClick={startOver} icon={<RotateCcw size={15} aria-hidden />}>
                      {t('เริ่มใหม่', 'Start over')}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        <div ref={scroller} className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
          <Intro face={face} reduce={!!reduce} />

          <div role="log" aria-live="polite" aria-relevant="additions" aria-label={t('บทสนทนากับโมชิ', 'Conversation with Mochi')} className="mt-4 space-y-3">
            <AnimatePresence initial={false}>
              {lines.map((l) => (
                <motion.div key={l.id} variants={bubbleIn} initial="hidden" animate="show">
                  <LineView line={l} onGo={onClose} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <AnimatePresence>{typing && <TypingRow key="typing" />}</AnimatePresence>

          {step.id === 'breathe' && !typing && (
            <div className="mt-4">
              <Breathe key={`${epoch}-${count}`} onEnd={(skipped) => act({ type: 'breathe-end', skipped })} />
            </div>
          )}
        </div>

        {showDock && (
          <div className="max-h-[48dvh] shrink-0 overflow-y-auto border-t-2 border-dashed border-line bg-cream-2/80 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            <Dock
              ref={dockRef}
              dock={dock}
              typing={typing}
              stepKey={`${key}-${epoch}`}
              onChip={(k) => {
                if (k.startsWith('mood:')) {
                  const m = k.slice(5) as Mood
                  setMood(m)
                  act({ type: 'mood', mood: m })
                } else act({ type: 'chip', key: k })
              }}
              onOwn={(kind, text) => act({ type: kind === 'mood' ? 'own-mood' : 'own-topic', text })}
              onText={(text) => act({ type: 'text', text })}
            />
          </div>
        )}
      </motion.div>
    </div>
  )
}

/** the top of the thread: Mochi, softly floating, and a note that this stays on the device */
function Intro({ face, reduce }: { face: MochiFace; reduce: boolean }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative grid size-32 place-items-center">
        <span aria-hidden className="absolute inset-2 rounded-full bg-[radial-gradient(circle,#FFE7DD_0%,#FFF4CF_55%,transparent_72%)]" />
        <motion.div
          className="relative"
          animate={reduce ? undefined : { y: [0, -6, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Avatar color="peach" size={88} face={face} label={t('น้องโมชิ', 'Little Mochi')} />
        </motion.div>
        <span aria-hidden className="absolute bottom-3 h-3 w-16 rounded-full bg-ink/10 blur-[3px]" />
      </div>
      <p className="mt-1 inline-flex max-w-full items-start gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-ink-soft ring-1 ring-line">
        <Lock size={13} className="mt-0.5 shrink-0" aria-hidden />
        {t('คุยกันแค่ในเครื่องนี้ ไม่ส่งขึ้นเซิร์ฟเวอร์', 'This chat stays on this device, never on a server')}
      </p>
    </div>
  )
}

function LineView({ line: l, onGo }: { line: Line; onGo: () => void }) {
  if (l.who === 'mochi') {
    const text = say(l.key)
    return text ? <MochiBubble text={text} sub={l.sub ? say(l.sub) : undefined} face={l.face} tip={l.tip} /> : null
  }
  if (l.who === 'me') {
    const text = l.text ?? (l.key ? say(l.key) : '')
    return text ? <MeBubble text={text} tone={l.tone} /> : null
  }
  return <SuggestionCard card={l.card} onGo={onGo} />
}

/**
 * Turns what Mochi wants to suggest into one real thing from the data:
 * a room from the mood's list, a person on our wavelength (never below
 * "ถูกคอ"), or a live / upcoming session.
 */
function useSuggest() {
  const rooms = useRooms()
  const sessions = useSessions()
  const daily = useDailyPick()
  const wave = useWavelengthMatches()
  const chats = useChats()
  return (ask: Ask): Card => {
    if (ask.kind === 'person') {
      const talking = new Set(chats.map((c) => c.withUserId))
      const someoneNew = wave.find((m) => !talking.has(m.userId))
      const pick = ask.pool === 'daily' ? (daily ?? someoneNew) : (someoneNew ?? daily)
      const m = pick ?? wave[0]
      if (m) return { kind: 'person', id: m.userId }
      return roomCard(rooms, ['listen', 'lobby'])
    }
    if (ask.kind === 'session') {
      const s = nextSession(sessions)
      if (s) return { kind: 'session', id: s.id }
    }
    return roomCard(rooms, ask.rooms)
  }
}

/** the first of these rooms that exists; else any room that isn't the lobby; else browse them all */
function roomCard(rooms: Room[], ids: string[]): Card {
  const room = ids.map((id) => rooms.find((r) => r.id === id)).find((r) => !!r) ?? rooms.find((r) => !r.isLobby) ?? rooms[0]
  return room ? { kind: 'room', id: room.id } : { kind: 'browse' }
}

/** happening now first, then the soonest (never one that's over or called off) */
function nextSession(sessions: Session[]): Session | undefined {
  return liveOrSoon(sessions, Date.now())[0]
}
