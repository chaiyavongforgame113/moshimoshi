import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { MOCHI } from '@/lib/colors'
import { spring } from '@/lib/motion'
import type { MochiColor } from '@/lib/types'

/** Large (44px) toggle chip used across the ชวนเล่น steps. */
export function PickChip({
  selected,
  onClick,
  color = 'butter',
  icon,
  children,
  label,
  className = '',
}: {
  selected: boolean
  onClick: () => void
  color?: MochiColor
  icon?: ReactNode
  children: ReactNode
  /** accessible name when the visible text isn't enough */
  label?: string
  className?: string
}) {
  const p = MOCHI[color]
  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      onClick={onClick}
      whileHover={{ y: -1.5 }}
      whileTap={{ scale: 0.92 }}
      animate={{ scale: selected ? [1, 1.08, 1] : 1 }}
      transition={{ ...spring.bouncy, scale: { duration: 0.32 } }}
      className={`inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full border px-4 font-display text-[15px] font-semibold text-ink transition-colors ${
        selected ? '' : 'border-line bg-white hover:bg-cream'
      } ${className}`}
      style={selected ? { background: p.base, borderColor: p.shade, boxShadow: `inset 0 -3px 0 ${p.shade}` } : undefined}
    >
      {icon}
      {children}
    </motion.button>
  )
}

/** Shared input look: cream well that turns white on focus. */
export const fieldClass =
  'w-full rounded-2xl border border-line bg-cream px-4 py-3 text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-lavender focus:bg-white focus:ring-3 focus:ring-lavender/40'
