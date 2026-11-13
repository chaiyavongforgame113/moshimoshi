import { motion, useReducedMotion } from 'motion/react'
import { SkipForward } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Avatar, Button } from '@/components/ui'
import { MOCHI } from '@/lib/colors'
import { L, t, tx, type Txt } from '@/lib/i18n'

type Pattern = '444' | '478'
type PhaseId = 'in' | 'hold' | 'out'

const PATTERNS: Record<Pattern, { name: Txt; full: Txt; steps: { id: PhaseId; secs: number }[] }> = {
  '444': {
    name: L('สบายๆ', 'Easy'),
    full: L('หายใจเข้า 4 กลั้น 4 ออก 4', 'In for 4, hold for 4, out for 4'),
    steps: [
      { id: 'in', secs: 4 },
      { id: 'hold', secs: 4 },
      { id: 'out', secs: 4 },
    ],
  },
  '478': {
    name: L('ผ่อนคลายลึก', 'Deep calm'),
    full: L('หายใจเข้า 4 กลั้น 7 ออก 8', 'In for 4, hold for 7, out for 8'),
    steps: [
      { id: 'in', secs: 4 },
      { id: 'hold', secs: 7 },
      { id: 'out', secs: 8 },
    ],
  },
}

const PHASE: Record<PhaseId, Txt> = {
  in: L('หายใจเข้า…', 'Breathe in…'),
  hold: L('กลั้นไว้…', 'Hold…'),
  out: L('หายใจออก…', 'Breathe out…'),
}

/** how big Mochi is at the end of each phase */
const SCALE: Record<PhaseId, number> = { in: 1.28, hold: 1.28, out: 0.9 }

const TOTAL = 60

/**
 * "พักใจ 1 นาที": Mochi puffs up as you breathe in and settles as you breathe out,
 * for 60 seconds, in a 4-4-4 or 4-7-8 rhythm. With reduced motion Mochi stays
 * still and the count does the guiding. Skip any time.
 */
export function Breathe({ onEnd }: { onEnd: (skipped: boolean) => void }) {
  const reduce = useReducedMotion()
  const titleId = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  const [pattern, setPattern] = useState<Pattern>('444')
  // whole seconds since the start, and the second the current rhythm began
  const [elapsed, setElapsed] = useState(0)
  const [from, setFrom] = useState(0)
  const endRef = useRef(onEnd)
  useEffect(() => {
    endRef.current = onEnd
  })

  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    const start = performance.now()
    const timer = window.setInterval(() => {
      const s = Math.min(TOTAL, Math.floor((performance.now() - start) / 1000))
      setElapsed(s)
      if (s >= TOTAL) {
        window.clearInterval(timer)
        endRef.current(false)
      }
    }, 250)
    return () => window.clearInterval(timer)
  }, [])

  const { steps } = PATTERNS[pattern]
  const cycle = steps.reduce((sum, s) => sum + s.secs, 0)
  const into = (elapsed - from) % cycle
  let acc = 0
  let phase = steps[0]
  for (const s of steps) {
    if (into < acc + s.secs) {
      phase = s
      break
    }
    acc += s.secs
  }
  const count = phase.secs - (into - acc)
  const left = TOTAL - elapsed

  const choose = (p: Pattern) => {
    if (p === pattern) return
    setPattern(p)
    setFrom(elapsed)
  }

  return (
    <section aria-labelledby={titleId} className="glass mx-auto w-full max-w-sm rounded-[2rem] p-4 text-center sm:p-5">
      <h3 id={titleId} ref={heading} tabIndex={-1} className="font-display text-xl font-semibold outline-none">
        {t('พักใจ 1 นาที', 'A 1-minute breather')}
      </h3>

      <div role="group" aria-label={t('จังหวะหายใจ', 'Breathing rhythm')} className="mt-3 flex flex-wrap justify-center gap-2">
        {(Object.keys(PATTERNS) as Pattern[]).map((p) => {
          const on = p === pattern
          const c = MOCHI.lavender
          return (
            <button
              key={p}
              type="button"
              aria-pressed={on}
              aria-label={tx(PATTERNS[p].full)}
              onClick={() => choose(p)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 font-display text-sm font-semibold text-ink transition-colors"
              style={on ? { background: c.base, borderColor: c.shade, boxShadow: `inset 0 -3px 0 ${c.shade}` } : { background: '#fff', borderColor: '#F1DDD0' }}
            >
              <span className="tabular-nums">{p.split('').join('-')}</span>
              <span className="text-ink-soft">· {tx(PATTERNS[p].name)}</span>
            </button>
          )
        })}
      </div>

      <div className="relative mx-auto mt-4 grid size-52 place-items-center" aria-hidden>
        <motion.span
          className="absolute size-44 rounded-full"
          style={{ background: `radial-gradient(circle, ${MOCHI.lavender.light} 0%, ${MOCHI.sky.light} 60%, transparent 72%)` }}
          animate={{ scale: reduce ? 1 : SCALE[phase.id] * 0.95 }}
          transition={{ duration: reduce ? 0 : phase.secs, ease: 'easeInOut' }}
        />
        <motion.div
          className="relative drop-shadow-[0_14px_18px_rgb(201_92_64/0.22)]"
          animate={{ scale: reduce ? 1 : SCALE[phase.id] }}
          transition={{ duration: reduce ? 0 : phase.secs, ease: 'easeInOut' }}
        >
          <Avatar color="peach" size={112} face={phase.id === 'out' ? 'sleepy' : 'smile'} />
        </motion.div>
      </div>

      <p aria-live="polite" className="mt-1 font-display text-2xl font-semibold">
        {tx(PHASE[phase.id])}
      </p>
      <p aria-hidden className={`font-display font-semibold text-ink-soft tabular-nums ${reduce ? 'text-5xl' : 'text-3xl'}`}>
        {count}
      </p>

      <div
        role="progressbar"
        aria-label={t('เวลาพักใจ', 'Breather time')}
        aria-valuemin={0}
        aria-valuemax={TOTAL}
        aria-valuenow={elapsed}
        aria-valuetext={t(`เหลือ ${left} วินาที`, `${left} seconds left`)}
        className="mx-auto mt-3 h-2.5 w-full max-w-60 overflow-hidden rounded-full bg-cream-3"
      >
        <span className="block h-full rounded-full bg-lavender transition-[width] duration-300" style={{ width: `${(elapsed / TOTAL) * 100}%` }} />
      </div>
      <p className="mt-1.5 text-sm text-ink-soft tabular-nums">{t(`เหลือ ${left} วินาที`, `${left} s left`)}</p>

      <Button variant="secondary" onClick={() => onEnd(true)} icon={<SkipForward size={17} aria-hidden />} className="mt-4">
        {t('ข้ามไปก่อน', 'Skip for now')}
      </Button>
    </section>
  )
}
