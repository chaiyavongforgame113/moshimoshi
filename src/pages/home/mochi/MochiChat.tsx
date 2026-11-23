import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react'
import { Lock, RotateCcw } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Button, IconButton } from '@/components/ui'
import { useChats, useDailyPick, useMyId, useRooms, useSessions, useWavelengthMatches } from '@/data/hooks'
import { t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import { useMoshi } from '@/lib/store'
import type { Mood, Room, Session } from '@/lib/types'
import { liveOrSoon } from '@/pages/events/lib'
import { Breathe } from './Breathe'
import { bubbleIn, MeBubble, MochiBubble, TypingRow } from './Bubbles'
import { SuggestionCard } from './Cards'
import { Dock } from './Dock'
import { dockFor, type Ask, type Card, type Line, type Step } from './engine'
import { say } from './script'
import { useMochiTalk } from './useMochiTalk'

const stepKey = (s: Step) => JSON.stringify(s)

/** Little Mochi's on-device conversation, embedded in the home card. */
export function MochiChat({ id, onClose, initialMood }: { id: string; onClose: () => void; initialMood: Mood | null }) {
  const reduce = useReducedMotion()
  const confirmId = useId()
  const panel = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
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

  useEffect(() => {
    panel.current?.focus({ preventScroll: true })
  }, [])

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
    panel.current?.focus({ preventScroll: true })
    setConfirming(false)
    restart()
    setEpoch((n) => n + 1)
  }

  const showDock = dock.composer || (!typing && (dock.chips.length > 0 || dock.own))

  return (
    <MotionConfig reducedMotion="user">
      <div
        id={id}
        ref={panel}
        role="region"
        aria-label={t('คุยกับโมชิ', 'Chat with Mochi')}
        tabIndex={-1}
        className="min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-peach"
      >
        <header className="flex flex-wrap items-center gap-x-2">
          <p className="min-w-0 flex-1 text-xs leading-snug text-ink-soft">
            <Lock size={13} className="mr-1 inline-block align-text-bottom" aria-hidden />
            {t('แชทนี้เก็บไว้ในเครื่องนี้เท่านั้น', 'This chat stays on this device.')}
            <span className="block">
              {t('โมชิเป็นเพื่อนรับฟัง ไม่ใช่ผู้เชี่ยวชาญ', 'Mochi is a friend who listens, not a professional.')}
            </span>
          </p>
          <IconButton
            ref={restartBtn}
            onClick={askRestart}
            aria-expanded={confirming}
            aria-controls={confirming ? confirmId : undefined}
            label={t('เริ่มคุยใหม่', 'Start over')}
            variant="ghost"
            className="shrink-0"
          >
            <RotateCcw size={16} aria-hidden />
          </IconButton>

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
                className="w-full overflow-hidden"
              >
                <p id={`${confirmId}-q`} className="pt-2 text-sm font-semibold text-ink">
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
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        <div ref={scroller} className="max-h-72 overflow-x-hidden overflow-y-auto overscroll-y-contain py-2 sm:max-h-80">
          <div role="log" aria-live="polite" aria-relevant="additions" aria-label={t('บทสนทนากับโมชิ', 'Conversation with Mochi')} className="space-y-3">
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
          <Dock
            dock={dock}
            typing={typing}
            stepKey={`${key}-${epoch}`}
            onChip={(k) => {
              panel.current?.focus({ preventScroll: true })
              if (k.startsWith('mood:')) {
                const m = k.slice(5) as Mood
                setMood(m)
                act({ type: 'mood', mood: m })
              } else act({ type: 'chip', key: k })
            }}
            onOwn={(kind, text) => act({ type: kind === 'mood' ? 'own-mood' : 'own-topic', text })}
            onText={(text) => act({ type: 'text', text })}
          />
        )}
      </div>
    </MotionConfig>
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
