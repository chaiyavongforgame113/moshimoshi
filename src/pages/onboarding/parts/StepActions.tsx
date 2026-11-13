import { AnimatePresence, motion, useAnimate, useReducedMotion } from 'motion/react'
import { CornerDownLeft } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { Button, leaveField } from '@/components/ui'
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
  /** optional screens: a quiet "ข้ามไปก่อน" next to the main button */
  onSkip?: () => void
  variant: 'bar' | 'row'
}

/**
 * Next button (plus Skip on optional screens). Phones: a frosted bar pinned above the home
 * indicator. Desktop: a sticky row under the form with a keyboard hint.
 * Next never goes truly disabled — pressing it explains what's missing.
 */
export function StepActions({ label, icon, ok, need, nudge, onNext, onSkip, variant }: StepActionsProps) {
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const reduce = useReducedMotion()

  useEffect(() => {
    if (nudge && !reduce && scope.current) animate(scope.current, { x: [0, -9, 9, -6, 6, 0] }, { duration: 0.42 })
  }, [nudge, reduce, animate, scope])

  const bar = variant === 'bar'
  const text = ok || !bar ? label : (need ?? label)

  const skip = onSkip && (
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

  const next = (
    <div ref={scope} className={bar ? 'min-w-0 flex-1' : 'shrink-0'}>
      <Button
        size="lg"
        block={bar}
        onPointerDown={leaveField}
        onClick={onNext}
        aria-disabled={!ok}
        iconRight={ok ? icon : undefined}
        className={`${bar ? 'px-4' : ''} ${ok ? '' : 'opacity-70 saturate-50'}`}
      >
        <span className="min-w-0 truncate">{text}</span>
      </Button>
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
          {next}
          {live}
        </div>
      </div>
    )
  }

  return (
    <div className="glass sticky bottom-5 z-20 mt-8 flex items-center justify-between gap-3 rounded-full p-2 pl-5">
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={ok ? 'tip' : 'need'}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={spring.soft}
          className="flex min-w-0 items-center gap-2 text-sm text-ink-soft"
        >
          {ok ? (
            <>
              {t('กด', 'Press')}
              <kbd className="inline-flex h-7 items-center gap-1 rounded-lg border border-line bg-white px-2 font-sans text-xs font-semibold text-ink shadow-[inset_0_-2px_0_rgb(59_38_34/0.08)]">
                Enter <CornerDownLeft size={12} aria-hidden />
              </kbd>
              {t('เพื่อไปต่อได้นะ', 'to keep going')}
            </>
          ) : (
            <span className="truncate">{need}</span>
          )}
        </motion.p>
      </AnimatePresence>
      <div className="flex shrink-0 items-center gap-1">
        {skip}
        {next}
      </div>
      {live}
    </div>
  )
}
