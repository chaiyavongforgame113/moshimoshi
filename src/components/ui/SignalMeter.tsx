import { motion, useReducedMotion } from 'motion/react'
import { SIGNAL_GRADIENT } from '@/lib/colors'
import { t } from '@/lib/i18n'
import { signalMeta } from '@/lib/matching'
import { spring } from '@/lib/motion'
import type { SignalLevel } from '@/lib/types'

type Size = 'xs' | 'sm' | 'md' | 'lg'

const SIZES: Record<Size, { bar: number; gap: number; h: number; text: string }> = {
  xs: { bar: 3, gap: 2, h: 12, text: 'text-[11px]' },
  sm: { bar: 4, gap: 2, h: 16, text: 'text-xs' },
  md: { bar: 6, gap: 3, h: 22, text: 'text-sm' },
  lg: { bar: 10, gap: 5, h: 40, text: 'text-base' },
}

interface SignalMeterProps {
  level: SignalLevel
  size?: Size
  /** show "คอเดียวกัน" next to the bars */
  showLabel?: boolean
  /** use the compact label */
  short?: boolean
  className?: string
}

/**
 * "สัญญาณถูกคอ" — phone-signal bars that rise from 1 to 5.
 * It is a graded scale, never a percentage. Bars warm up in colour as the
 * level rises (lavender → coral), so the scale also reads at a glance.
 */
export function SignalMeter({ level, size = 'md', showLabel = true, short, className = '' }: SignalMeterProps) {
  const reduce = useReducedMotion()
  const s = SIZES[size]
  const meta = signalMeta(level)
  return (
    <span
      className={`inline-flex max-w-full items-center gap-2 ${className}`}
      role="img"
      // the label alone carries the graded scale: never announce a number
      aria-label={t(`สัญญาณถูกคอ: ${meta.label}`, `Vibe signal: ${meta.label}`)}
    >
      <span className="inline-flex shrink-0 items-end" style={{ gap: s.gap, height: s.h }} aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => {
          const on = i <= level
          return (
            <motion.span
              key={i}
              className="block rounded-full"
              style={{
                width: s.bar,
                height: `${28 + i * 14.4}%`,
                background: on ? SIGNAL_GRADIENT[Math.min(level, 5) - 1] : 'rgb(59 38 34 / 0.12)',
                transformOrigin: 'bottom',
                boxShadow: on && level >= 4 ? `0 0 ${s.bar * 1.5}px ${SIGNAL_GRADIENT[level - 1]}88` : undefined,
              }}
              initial={reduce ? false : { scaleY: 0.2, opacity: 0.4 }}
              animate={{ scaleY: 1, opacity: 1 }}
              transition={{ ...spring.bouncy, delay: reduce ? 0 : i * 0.06 }}
            />
          )
        })}
      </span>
      {showLabel && (
        <span className={`min-w-0 truncate font-display font-semibold text-ink ${s.text}`}>{short ? meta.short : meta.label}</span>
      )}
    </span>
  )
}
