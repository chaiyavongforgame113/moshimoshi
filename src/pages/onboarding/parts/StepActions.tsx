import { AnimatePresence, motion, useAnimate, useReducedMotion } from 'motion/react'
import { ChevronRight, CornerDownLeft } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { leaveField } from '@/components/ui'
import { t } from '@/lib/i18n'
import { spring } from '@/lib/motion'

interface StepActionsProps {
  label: string
  icon?: ReactNode
  ok: boolean
  /** what's still missing, shown instead of the label while blocked */
  need?: string
  /** bumps every time the visitor presses next while blocked → wiggle + announce */
  nudge: number
  onNext: () => void
  /** optional screens: with nothing answered yet, the one button is a calm "ข้ามไปก่อน" */
  onSkip?: () => void
  /**
   * optional screens: an answer is under way but not complete yet (a story still too short).
   * The button then explains what's missing, with a small Skip beside it.
   */
  started?: boolean
  variant: 'bar' | 'row'
}

type Tone = 'primary' | 'skip' | 'calm'

const TONE: Record<Tone, string> = {
  // coral fill + warm ink text keeps ≥4.5:1 contrast
  primary: 'border-transparent bg-coral text-ink shadow-[var(--shadow-puffy)] hover:bg-[#ff8a7c]',
  // optional and untouched: a quiet way on, not a warning
  skip: 'border-line bg-white/90 text-ink shadow-[var(--shadow-soft)] hover:bg-white',
  // required and not ready: calm, never a washed-out "broken" coral
  calm: 'border-transparent bg-ink/10 text-ink-soft',
}

/**
 * One clear button per screen. Phones: a frosted bar pinned above the home indicator.
 * Desktop: a sticky row under the form with a keyboard hint.
 * - answered → the primary "ไปต่อ"
 * - optional and untouched → a calm "ข้ามไปก่อน" that becomes "ไปต่อ" the moment something is picked
 * - required and not ready → a calm button saying what's missing; pressing it wiggles and explains
 */
export function StepActions({ label, icon, ok, need, nudge, onNext, onSkip, started = false, variant }: StepActionsProps) {
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const reduce = useReducedMotion()

  useEffect(() => {
    if (nudge && !reduce && scope.current) animate(scope.current, { x: [0, -9, 9, -6, 6, 0] }, { duration: 0.42 })
  }, [nudge, reduce, animate, scope])

  const bar = variant === 'bar'
  const skipOnly = !ok && !!onSkip && !started
  const tone: Tone = ok ? 'primary' : skipOnly ? 'skip' : 'calm'
  const text = ok ? label : skipOnly ? t('ข้ามไปก่อน', 'Skip for now') : bar ? (need ?? label) : label
  const trailing = ok ? icon : skipOnly ? <ChevronRight size={20} strokeWidth={2.4} className="text-ink-soft" aria-hidden /> : null

  // a small Skip only while a started answer isn't complete yet (otherwise the main button is Skip)
  const skip = onSkip && started && !ok && (
    <motion.button
      type="button"
      whileTap={reduce ? undefined : { scale: 0.94, y: 1 }}
      transition={spring.bouncy}
      onPointerDown={leaveField}
      onClick={onSkip}
      className="min-h-14 max-w-[6.5rem] shrink-0 rounded-full px-3 text-center font-display text-sm leading-tight font-semibold text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink"
    >
      {t('ข้ามไปก่อน', 'Skip for now')}
    </motion.button>
  )

  const main = (
    <div ref={scope} className={bar ? 'min-w-0 flex-1' : 'shrink-0'}>
      <motion.button
        type="button"
        onPointerDown={leaveField}
        onClick={skipOnly ? onSkip : onNext}
        aria-disabled={tone === 'calm' || undefined}
        whileHover={reduce || tone === 'calm' ? undefined : { y: -2 }}
        whileTap={reduce ? undefined : { scale: 0.95, y: 1 }}
        transition={spring.bouncy}
        className={`relative inline-flex h-14 items-center justify-center gap-2.5 rounded-full border font-display text-base font-semibold tracking-tight whitespace-nowrap transition-[background-color,color,box-shadow,border-color] duration-200 select-none ${
          bar ? 'w-full px-4' : 'px-7'
        } ${TONE[tone]}`}
      >
        <motion.span
          key={text}
          initial={reduce ? false : { opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="min-w-0 truncate"
        >
          {text}
        </motion.span>
        {trailing}
      </motion.button>
    </div>
  )

  // announced only after a blocked press (keyed so repeats are read again), so typing isn't noisy
  const live = (
    <span className="sr-only" aria-live="polite">
      {nudge > 0 && !ok && <span key={nudge}>{need}</span>}
    </span>
  )

  if (bar) {
    return (
      <div className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3">
        <div className="pointer-events-none absolute inset-x-0 -top-8 bottom-0 bg-linear-to-t from-cream via-cream/80 to-transparent" aria-hidden />
        <div className="glass pointer-events-auto relative mx-auto flex max-w-xl items-center gap-1.5 rounded-[1.9rem] p-2">
          {skip}
          {main}
          {live}
        </div>
      </div>
    )
  }

  // desktop: the hint on the left follows the button's state
  const tipKey = ok ? 'tip' : skipOnly && !nudge ? 'optional' : 'need'
  return (
    <div className="glass sticky bottom-5 z-20 mt-8 flex items-center justify-between gap-3 rounded-full p-2 pl-5">
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={tipKey}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={spring.soft}
          className="flex min-w-0 items-center gap-2 text-sm text-ink-soft"
        >
          {tipKey === 'tip' ? (
            <>
              {t('กด', 'Press')}
              <kbd className="inline-flex h-7 items-center gap-1 rounded-lg border border-line bg-white px-2 font-sans text-xs font-semibold text-ink shadow-[inset_0_-2px_0_rgb(59_38_34/0.08)]">
                Enter <CornerDownLeft size={12} aria-hidden />
              </kbd>
              {t('เพื่อไปต่อได้นะ', 'to keep going')}
            </>
          ) : tipKey === 'optional' ? (
            <span className="truncate">{t('ข้อนี้ข้ามได้ ไว้ค่อยกลับมาตอบทีหลังก็ได้', 'This one is optional. You can come back to it later')}</span>
          ) : (
            <span className="truncate">{need}</span>
          )}
        </motion.p>
      </AnimatePresence>
      <div className="flex shrink-0 items-center gap-1">
        {skip}
        {main}
      </div>
      {live}
    </div>
  )
}
