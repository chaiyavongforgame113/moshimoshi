import { motion, useReducedMotion } from 'motion/react'
import { t } from '@/lib/i18n'
import { spring } from '@/lib/motion'

/**
 * Squishy segmented progress: finished segments fill with a warm gradient,
 * the current one swells longer and plumper like a mochi being pressed.
 * `step` is 0-based; `done` fills every segment with none swollen.
 */
export function StepProgress({ step, total, label, done = false }: { step: number; total: number; label: string; done?: boolean }) {
  const reduce = useReducedMotion()
  const move = reduce ? { duration: 0 } : spring.bouncy
  const now = done ? total : step + 1
  return (
    <div
      role="progressbar"
      aria-label={t('ความคืบหน้า', 'Progress')}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={now}
      aria-valuetext={done ? t('ครบทุกข้อแล้ว', 'All questions done') : t(`ข้อที่ ${now} จาก ${total}: ${label}`, `Question ${now} of ${total}: ${label}`)}
      className="flex h-3.5 min-w-0 flex-1 items-center gap-1"
    >
      {Array.from({ length: total }, (_, i) => {
        const current = !done && i === step
        return (
          <motion.span
            key={i}
            className="relative block overflow-hidden rounded-full bg-ink/10"
            style={{ flexBasis: 0 }}
            initial={false}
            animate={{ flexGrow: current ? 2.6 : 1, height: current ? 13 : 8 }}
            transition={move}
          >
            <motion.span
              className="absolute inset-0 origin-left rounded-full bg-linear-to-r from-peach to-coral"
              initial={false}
              animate={{ scaleX: done || i <= step ? 1 : 0 }}
              transition={reduce ? move : { ...spring.bouncy, delay: current ? 0.08 : 0 }}
            />
            {current && <span className="absolute inset-x-1.5 top-[2px] h-[3px] rounded-full bg-white/60" />}
          </motion.span>
        )
      })}
    </div>
  )
}
