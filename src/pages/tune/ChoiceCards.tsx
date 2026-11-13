import { motion, useReducedMotion } from 'motion/react'
import { Check } from 'lucide-react'
import { forwardRef } from 'react'
import { MOCHI } from '@/lib/colors'
import { t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import type { MochiColor, WaveChoice } from '@/lib/types'
import { sideIcon, sideLabel, type WaveQuestion } from '@/lib/waveQuiz'

const SIDE_TONE: Record<WaveChoice, MochiColor> = { 0: 'peach', 1: 'sky' }

/**
 * The two big cards of one this-or-that, side by side at every width with a little "หรือ" between
 * them. A tap picks (the page saves and moves on); the side I picked before shows pressed.
 * Keys 1 / 2 and ← / → pick too (handled by the page); the number shows on devices with a mouse.
 */
export const ChoiceCards = forwardRef<HTMLButtonElement, { question: WaveQuestion; picked?: WaveChoice; onPick: (choice: WaveChoice) => void }>(
  function ChoiceCards({ question, picked, onPick }, firstRef) {
    return (
      <div role="group" aria-label={t(`${question.a} หรือ ${question.b}`, `${question.a} or ${question.b}`)} className="relative grid grid-cols-2 gap-3 sm:gap-5">
        <Card ref={firstRef} question={question} choice={0} picked={picked} onPick={onPick} />
        <Card question={question} choice={1} picked={picked} onPick={onPick} />
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 z-10 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white font-display text-sm font-semibold text-ink-soft shadow-[var(--shadow-soft)] ring-4 ring-cream sm:size-14 sm:text-base"
        >
          {t('หรือ', 'or')}
        </span>
      </div>
    )
  },
)

const Card = forwardRef<HTMLButtonElement, { question: WaveQuestion; choice: WaveChoice; picked?: WaveChoice; onPick: (choice: WaveChoice) => void }>(
  function Card({ question, choice, picked, onPick }, ref) {
    const reduce = useReducedMotion()
    const p = MOCHI[SIDE_TONE[choice]]
    const on = picked === choice
    return (
      <motion.button
        ref={ref}
        type="button"
        data-wave-choice={choice}
        aria-pressed={on}
        aria-keyshortcuts={choice === 0 ? '1 ArrowLeft' : '2 ArrowRight'}
        onClick={() => onPick(choice)}
        whileHover={reduce ? undefined : { y: -3 }}
        whileTap={reduce ? undefined : { scale: 0.95, y: 1 }}
        animate={reduce ? undefined : on ? { scale: [1, 1.05, 1] } : { scale: 1 }}
        transition={spring.bouncy}
        className={`relative flex min-h-44 min-w-0 flex-col items-center justify-center gap-3 rounded-[2rem] border-2 py-5 text-center shadow-[var(--shadow-puffy)] transition-[border-color,box-shadow] sm:min-h-56 sm:px-6 ${
          // the inner side leaves room for the "หรือ" bubble
          choice === 0 ? 'pr-5 pl-3' : 'pr-3 pl-5'
        } ${
          on ? 'border-coral ring-4 ring-coral/25' : 'border-white'
        }`}
        style={{ background: `linear-gradient(160deg, ${p.light} 0%, ${p.base} 100%)` }}
      >
        {/* glossy top light, like the mochi */}
        <span aria-hidden className="pointer-events-none absolute inset-x-5 top-2 h-6 rounded-full bg-white/45 blur-[2px]" />
        <motion.span
          aria-hidden
          className="relative text-5xl leading-none drop-shadow-[0_6px_8px_rgb(59_38_34/0.18)] sm:text-6xl"
          animate={reduce ? undefined : { y: [0, -4, 0] }}
          transition={reduce ? undefined : { duration: 2.6, repeat: Infinity, ease: 'easeInOut', delay: choice * 0.5 }}
        >
          {sideIcon(question.id, choice)}
        </motion.span>
        <span className="relative max-w-full font-display text-lg leading-snug font-semibold break-words sm:text-xl" style={{ color: p.ink }}>
          {sideLabel(question, choice)}
        </span>
        <span
          aria-hidden
          className="absolute top-3 left-3 hidden size-7 items-center justify-center rounded-full bg-white/80 font-display text-xs font-semibold text-ink-soft [@media(hover:hover)]:flex"
        >
          {choice + 1}
        </span>
        {on && (
          <motion.span
            aria-hidden
            initial={reduce ? false : { scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={spring.bouncy}
            className="absolute top-2.5 right-2.5 flex size-8 items-center justify-center rounded-full bg-coral text-ink shadow-[var(--shadow-soft)]"
          >
            <Check size={18} strokeWidth={3} />
          </motion.span>
        )}
      </motion.button>
    )
  },
)
