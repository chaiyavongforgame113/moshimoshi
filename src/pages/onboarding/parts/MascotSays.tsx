import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { MessageCircleHeart } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Avatar, type MochiFace } from '@/components/ui'
import { t } from '@/lib/i18n'
import { fadeUp, spring } from '@/lib/motion'
import { graphemes } from './hooks'
import { SignalBars, TypingDots } from './Signal'

interface MascotSaysProps {
  /** the step's question — rendered as the page <h1> */
  line: string
  sub?: string
  face: MochiFace
  /** น้องโมชิ reacting to what the visitor just did: takes the helper line's place in the bubble */
  reaction?: string | null
  /** move focus to the heading (after a step change) so screen readers follow along */
  focusOnMount?: boolean
  /** tighter bubble with no reaction, for screens that need the room (the reaction shows elsewhere) */
  compact?: boolean
  /** the screen reacts to picks: the helper keeps two lines' room, so a reply never pushes the picks down */
  reacts?: boolean
}

/**
 * น้องโมชิ asking the screen's one question: the mascot, then a bubble with the question (it types
 * itself out, space reserved up front so nothing jumps) and one short helper line. When น้องโมชิ
 * reacts to a pick, the reaction takes the helper line's place in the same bubble.
 */
export function MascotSays({ line, sub, face, reaction, focusOnMount, compact = false, reacts = false }: MascotSaysProps) {
  const reduce = useReducedMotion()
  const heading = useRef<HTMLHeadingElement>(null)
  const [typing, setTyping] = useState(!reduce)

  useEffect(() => {
    if (focusOnMount) heading.current?.focus({ preventScroll: true })
  }, [focusOnMount])

  return (
    <motion.div variants={fadeUp} className="flex items-start gap-3 sm:gap-4">
      <div className={`relative mt-1 shrink-0 rounded-full bg-white p-1.5 shadow-[var(--shadow-soft)] ${reduce ? '' : 'animate-float'}`}>
        <Avatar color="cream" size={compact ? 38 : 46} face={typing ? 'talk' : face} />
        <span className="absolute -right-1 -bottom-1 grid size-6 place-items-center rounded-full border-2 border-white bg-mint text-ink" aria-hidden>
          <MessageCircleHeart size={12} strokeWidth={2.6} />
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.86 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={spring.bouncy}
          style={{ originX: 0, originY: 0 }}
          className={`relative w-fit max-w-full rounded-[1.6rem] rounded-tl-md bg-white px-4 shadow-[var(--shadow-soft)] sm:px-5 ${compact ? 'py-2.5 sm:py-3' : 'py-3 sm:py-4'}`}
        >
          <p className="mb-0.5 flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
            {t('น้องโมชิ', 'Little Mochi')} <SignalBars tuning={typing} />
          </p>
          <h1
            ref={heading}
            tabIndex={-1}
            className={`font-display leading-[1.5] font-semibold text-ink outline-none ${compact ? 'text-[1.2rem] sm:text-[1.5rem]' : 'text-[1.3rem] sm:text-[1.65rem]'}`}
          >
            <span className="sr-only">{line}</span>
            <TypedText key={line} text={line} instant={!!reduce} onDone={() => setTyping(false)} />
          </h1>
          <HelperLine sub={sub} reaction={compact ? null : (reaction ?? null)} reserve={reacts && !compact} />
        </motion.div>
      </div>
    </motion.div>
  )
}

function TypedText({ text, instant, onDone }: { text: string; instant: boolean; onDone: () => void }) {
  const parts = useMemo(() => graphemes(text), [text])
  const [n, setN] = useState(instant ? parts.length : 0)
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })

  useEffect(() => {
    if (instant) {
      done.current()
      return
    }
    let i = 0
    let iv = 0
    const t = window.setTimeout(() => {
      iv = window.setInterval(() => {
        i += 1
        setN(i)
        if (i >= parts.length) {
          window.clearInterval(iv)
          done.current()
        }
      }, 30)
    }, 420)
    return () => {
      window.clearTimeout(t)
      window.clearInterval(iv)
    }
  }, [parts, instant])

  return (
    <span aria-hidden className="relative block">
      <span className="invisible">{text}</span>
      <span className="absolute inset-0">
        {n === 0 && !instant ? (
          <TypingDots />
        ) : (
          <>
            {parts.slice(0, n).join('')}
            {n < parts.length && <span className="ml-0.5 inline-block h-[0.9em] w-[3px] translate-y-[0.1em] rounded-full bg-coral" />}
          </>
        )}
      </span>
    </span>
  )
}

/**
 * The bubble's last line: the helper, or น้องโมชิ's reaction in its place. Both sit in one grid
 * cell; on screens that react it holds two lines from the start (replies are written to fit two),
 * so neither the typing dots nor the reply move the picks under a finger.
 */
function HelperLine({ sub, reaction, reserve }: { sub?: string; reaction: string | null; reserve: boolean }) {
  if (!sub && !reaction && !reserve) return null
  return (
    <div className={`mt-1 grid content-start text-sm sm:text-[15px] ${reserve ? 'min-h-[2lh]' : ''}`} aria-live="polite">
      {sub && (
        <p className={`col-start-1 row-start-1 text-ink-soft transition-opacity duration-200 ${reaction ? 'invisible opacity-0' : ''}`}>{sub}</p>
      )}
      <AnimatePresence initial={false}>{reaction && <Reply key={reaction} text={reaction} />}</AnimatePresence>
    </div>
  )
}

function Reply({ text }: { text: string }) {
  const reduce = useReducedMotion()
  const [ready, setReady] = useState(!!reduce)
  useEffect(() => {
    if (reduce) return
    const t = window.setTimeout(() => setReady(true), 480)
    return () => window.clearTimeout(t)
  }, [reduce])

  return (
    <motion.p
      initial={reduce ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={spring.soft}
      className="col-start-1 row-start-1 text-ink"
    >
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {ready ? (
          <>
            <MessageCircleHeart size={15} strokeWidth={2.4} className="mr-1 inline-block -translate-y-px align-middle text-coral-deep" />
            <span className="rounded-md bg-butter/45 box-decoration-clone px-1 py-0.5">{text}</span>
          </>
        ) : (
          <TypingDots />
        )}
      </span>
    </motion.p>
  )
}
