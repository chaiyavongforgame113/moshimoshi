import { AnimatePresence, motion, useAnimate, useReducedMotion, type Variants } from 'motion/react'
import { ArrowLeft, ArrowRight, Check, CircleAlert, Loader2, X } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import { Button } from './Button'
import { leaveField } from './OwnOption'

/*
 * <Wizard> — one question at a time. A controlled shell: the caller owns the answers and the
 * step number, the wizard draws "2/5" with a squishy progress bar, the question (big title),
 * a one-line hint, the step's content, then the action row:
 *   Back (or Cancel on the first step when onCancel is given) · Skip (optional steps) · Next.
 *
 *   const [step, setStep] = useState(0)
 *   <Wizard
 *     step={step} onStep={setStep} onFinish={save} finishLabel={t('โพสต์เลย', 'Post it')} busy={saving}
 *     onCancel={askBeforeLeaving}          // leaving asks first: confirm inside onCancel
 *     steps={[
 *       { key: 'what', title: t('อยากทำอะไร', 'What do you want to do?'), valid: !!what, content: <…/> },
 *       { key: 'note', title: t('เล่าเพิ่มนิดนึง', 'Anything to add?'), optional: true, onSkip: () => setNote(''), content: <…/> },
 *     ]}
 *   />
 *
 * Step fields: key (stable id), title, hint?, content, valid? (default true: Next explains
 * instead of moving on while false), error? (shown under the content), optional? (adds
 * "ข้ามไปก่อน"), onSkip? (clear that step's answer; runs before moving on).
 * Enter in a one-line input means Next (never in a textarea or while an IME is composing).
 * Each new step moves focus to its title and scrolls the wizard's top back into view.
 * The action row sticks to the bottom of the screen above the phone menu, or to the bottom
 * of a Sheet: `placement` finds out which by itself ('auto'), or say 'page' / 'sheet'.
 */

export interface WizardStep {
  /** stable id for the step (animation and focus key) */
  key: string
  /** the one question, shown big */
  title: ReactNode
  /** one short line under the question */
  hint?: ReactNode
  /** adds a "ข้ามไปก่อน / Skip for now" button */
  optional?: boolean
  /** runs when Skip is pressed, before moving on (clear the step's answer here) */
  onSkip?: () => void
  /** false: Next doesn't move on, it wiggles and says what's missing (default true) */
  valid?: boolean
  /** shown under the content, e.g. "ชื่อยาวไปนิดนึง" */
  error?: string
  content: ReactNode
}

export interface WizardProps {
  steps: WizardStep[]
  /** 0-based */
  step: number
  onStep: (n: number) => void
  onFinish: () => void
  /** the Next button on the last step (default "เสร็จแล้ว / Done") */
  finishLabel?: string
  /** saving: the buttons wait and Next shows a spinner */
  busy?: boolean
  /** shows Cancel on the first step; ask before throwing answers away */
  onCancel?: () => void
  /** where the action row sticks: above the phone menu on a page, or the bottom of a Sheet */
  placement?: 'auto' | 'page' | 'sheet'
  className?: string
}

/** inputs where Enter has nothing else to do */
const ONE_LINE = new Set(['text', 'search', 'email', 'url', 'tel', 'number', 'password'])

const slide: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 28 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -20, transition: { duration: 0.14 } }),
}
const still: Variants = { enter: { opacity: 1 }, center: { opacity: 1 }, exit: { opacity: 0 } }

export function Wizard({ steps, step, onStep, onFinish, finishLabel, busy = false, onCancel, placement = 'auto', className = '' }: WizardProps) {
  const reduce = !!useReducedMotion()
  const root = useRef<HTMLDivElement>(null)
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const titleId = useId()
  const [inSheet, setInSheet] = useState(placement === 'sheet')

  // step changes: which way to slide, clip sideways while sliding, focus the new title
  const [seen, setSeen] = useState(step)
  const [dir, setDir] = useState(1)
  const [moving, setMoving] = useState(false)
  const [moved, setMoved] = useState(false)
  const [nudge, setNudge] = useState(0)
  if (seen !== step) {
    setSeen(step)
    setDir(step > seen ? 1 : -1)
    setMoved(true)
    setNudge(0)
    if (!reduce) setMoving(true)
  }

  useLayoutEffect(() => {
    setInSheet(placement === 'auto' ? !!root.current?.closest('[role="dialog"]') : placement === 'sheet')
  }, [placement])

  useEffect(() => {
    if (nudge && !reduce && scope.current) animate(scope.current, { x: [0, -9, 9, -6, 6, 0] }, { duration: 0.42 })
  }, [nudge, reduce, animate, scope])

  if (!steps.length) return null
  const i = Math.min(Math.max(step, 0), steps.length - 1)
  const cur = steps[i]
  const total = steps.length
  const last = i === total - 1
  const ok = cur.valid !== false

  const next = () => {
    if (busy) return
    if (!ok) {
      setNudge((n) => n + 1)
      return
    }
    if (last) onFinish()
    else onStep(i + 1)
  }

  const skip = () => {
    if (busy) return
    cur.onSkip?.()
    if (last) onFinish()
    else onStep(i + 1)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' || e.defaultPrevented || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return
    // Safari sends the Enter that ends a Thai/Japanese composition with keyCode 229
    if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return
    const el = e.target
    if (!(el instanceof HTMLInputElement) || !ONE_LINE.has(el.type)) return
    e.preventDefault()
    next()
  }

  const need = cur.error ?? t('ตอบข้อนี้ก่อนนะ แล้วค่อยไปต่อ', 'Answer this one first, then keep going')
  const shownError = cur.error ?? (nudge > 0 && !ok ? need : undefined)
  const back = i > 0 ? () => onStep(i - 1) : onCancel

  return (
    <div ref={root} role="group" aria-labelledby={titleId} onKeyDown={onKeyDown} className={`relative scroll-mt-24 lg:scroll-mt-8 ${className}`}>
      {total > 1 && (
        <div className="mb-4 flex items-center gap-3">
          <span className="shrink-0 font-display text-sm font-semibold text-ink-soft tabular-nums" aria-hidden>
            {i + 1}/{total}
          </span>
          <Progress step={i} total={total} reduce={reduce} />
        </div>
      )}

      <div className={moving ? 'overflow-x-clip' : undefined}>
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={cur.key}
            custom={dir}
            variants={reduce ? still : slide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={reduce ? { duration: 0 } : spring.soft}
            onAnimationComplete={(def) => def === 'center' && setMoving(false)}
          >
            <StepHead step={cur} titleId={titleId} focusOnMount={moved} root={root} reduce={reduce} />
            <div className="mt-5">{cur.content}</div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* keyed by the press too, so a blocked Next reads the message again */}
      <div aria-live="polite">
        {shownError && (
          <p key={`${cur.key}:${nudge}`} className="mt-3 flex items-start gap-1.5 text-sm font-semibold text-danger">
            <CircleAlert size={16} strokeWidth={2.4} className="mt-0.5 shrink-0" aria-hidden />
            <span className="min-w-0 wrap-break-word">{shownError}</span>
          </p>
        )}
      </div>

      <div
        className={
          inSheet
            ? 'sticky bottom-[env(safe-area-inset-bottom)] z-10 mt-6 bg-linear-to-t from-cream from-60% to-transparent pt-5 pb-3 after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-[env(safe-area-inset-bottom)] after:bg-cream'
            : 'sticky bottom-[calc(6.25rem+env(safe-area-inset-bottom))] z-20 mt-8 lg:bottom-5'
        }
      >
        <div className="glass flex flex-wrap items-center justify-between gap-2 rounded-[1.75rem] p-2">
          {back && (
            <Button
              variant="secondary"
              icon={i > 0 ? <ArrowLeft size={18} strokeWidth={2.4} aria-hidden /> : <X size={18} strokeWidth={2.4} aria-hidden />}
              onClick={back}
              disabled={busy}
              className="shrink-0 max-sm:w-12 max-sm:px-0"
            >
              <span className="max-sm:sr-only">{i > 0 ? t('ย้อนกลับ', 'Back') : t('ยกเลิก', 'Cancel')}</span>
            </Button>
          )}
          {cur.optional && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.94, y: 1 }}
              transition={spring.bouncy}
              onPointerDown={leaveField}
              onClick={skip}
              disabled={busy}
              className="min-h-12 max-w-[5.75rem] shrink-0 rounded-full px-3 text-center font-display text-sm leading-tight font-semibold text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-45"
            >
              {t('ข้ามไปก่อน', 'Skip for now')}
            </motion.button>
          )}
          <div ref={scope} className="flex min-w-0 grow basis-[7.5rem]">
            <Button
              block
              onPointerDown={leaveField}
              onClick={next}
              aria-disabled={!ok || busy}
              aria-busy={busy || undefined}
              iconRight={
                busy ? (
                  <Loader2 size={18} strokeWidth={2.6} className="shrink-0 motion-safe:animate-spin" aria-hidden />
                ) : last ? (
                  <Check size={18} strokeWidth={2.6} className="shrink-0 max-[400px]:hidden" aria-hidden />
                ) : (
                  <ArrowRight size={18} strokeWidth={2.6} className="shrink-0 max-[400px]:hidden" aria-hidden />
                )
              }
              className={`min-w-0 ${ok ? '' : 'opacity-70 saturate-50'}`}
            >
              <span className="min-w-0 truncate">{last ? (finishLabel ?? t('เสร็จแล้ว', 'Done')) : t('ถัดไป', 'Next')}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** The question and its hint. A step that replaces another takes focus and brings the wizard into view. */
function StepHead({
  step,
  titleId,
  focusOnMount,
  root,
  reduce,
}: {
  step: WizardStep
  titleId: string
  focusOnMount: boolean
  root: RefObject<HTMLDivElement | null>
  reduce: boolean
}) {
  const title = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (!focusOnMount) return
    title.current?.focus({ preventScroll: true })
    bringIntoView(root.current, reduce)
    // once per step: the panel around this is keyed by the step, so it mounts fresh each time
  }, [])

  return (
    <>
      <h2
        ref={title}
        id={titleId}
        tabIndex={-1}
        className="font-display text-2xl leading-snug font-semibold text-balance wrap-break-word text-ink focus:outline-none sm:text-3xl"
      >
        {step.title}
      </h2>
      {step.hint && <p className="mt-1.5 text-[15px] text-ink-soft">{step.hint}</p>}
    </>
  )
}

/** Scroll the wizard's top into view when it's above the visible area (or far down), in a page or a Sheet. */
function bringIntoView(el: HTMLElement | null, reduce: boolean) {
  if (!el) return
  let box: HTMLElement | null = el.parentElement
  while (box) {
    const o = getComputedStyle(box).overflowY
    if ((o === 'auto' || o === 'scroll') && box.scrollHeight > box.clientHeight) break
    box = box.parentElement
  }
  const view = box ? box.getBoundingClientRect() : { top: 0, bottom: window.innerHeight }
  const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0
  const top = el.getBoundingClientRect().top
  if (top < view.top + margin - 1 || top > view.bottom - 120) {
    el.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
  }
}

/** Squishy segments like onboarding: done ones fill warm, the current one swells. */
function Progress({ step, total, reduce }: { step: number; total: number; reduce: boolean }) {
  const move = reduce ? { duration: 0 } : spring.bouncy
  return (
    <div
      role="progressbar"
      aria-label={t('ความคืบหน้า', 'Progress')}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={step + 1}
      aria-valuetext={t(`ข้อที่ ${step + 1} จาก ${total}`, `Step ${step + 1} of ${total}`)}
      className="flex h-3.5 min-w-0 flex-1 items-center gap-1.5"
    >
      {Array.from({ length: total }, (_, n) => {
        const current = n === step
        return (
          <motion.span
            key={n}
            className="relative block overflow-hidden rounded-full bg-ink/10"
            style={{ flexBasis: 0 }}
            initial={false}
            animate={{ flexGrow: current ? 2.6 : 1, height: current ? 12 : 8 }}
            transition={move}
          >
            <motion.span
              className="absolute inset-0 origin-left rounded-full bg-linear-to-r from-peach to-coral"
              initial={false}
              animate={{ scaleX: n <= step ? 1 : 0 }}
              transition={reduce ? move : { ...spring.bouncy, delay: current ? 0.08 : 0 }}
            />
            {current && <span className="absolute inset-x-2 top-[2px] h-[3px] rounded-full bg-white/60" />}
          </motion.span>
        )
      })}
    </div>
  )
}
