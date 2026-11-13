import { motion, useReducedMotion } from 'motion/react'
import { Lightbulb } from 'lucide-react'
import { Avatar, type MochiFace } from '@/components/ui'
import { MOCHI } from '@/lib/colors'
import { t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import type { MochiColor } from '@/lib/types'

export const bubbleIn = {
  hidden: { opacity: 0, scale: 0.85, y: 10 },
  show: { opacity: 1, scale: 1, y: 0, transition: spring.bouncy },
}

const wrap = '[overflow-wrap:anywhere]'

/** Mochi's line: avatar on the left, white bubble with a soft shadow (the old MoodHero thread). */
export function MochiBubble({ text, sub, face = 'smile', tip }: { text: string; sub?: string; face?: MochiFace; tip?: boolean }) {
  return (
    <div className="flex items-end gap-2" style={{ transformOrigin: 'left bottom' }}>
      <Avatar color="peach" size={34} face={face} />
      <div
        className={`max-w-[85%] min-w-0 rounded-3xl rounded-bl-md px-4 py-3 shadow-[var(--shadow-soft)] ${tip ? 'border-2 border-dashed border-butter bg-[#FFF8E1]' : 'bg-white'}`}
      >
        {tip && (
          <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-ink-soft">
            <Lightbulb size={14} strokeWidth={2.4} aria-hidden />
            {t('เคล็ดลับเล็กๆ', 'A small tip')}
          </p>
        )}
        <p className={`font-display text-[17px] leading-normal font-semibold text-ink ${wrap}`}>
          <span className="sr-only">{t('น้องโมชิ: ', 'Little Mochi: ')}</span>
          {text}
        </p>
        {sub && <p className={`mt-1 text-sm text-ink-soft ${wrap}`}>{sub}</p>}
      </div>
    </div>
  )
}

/** What I said: right-aligned, in my mood's colour. */
export function MeBubble({ text, tone = 'peach' }: { text: string; tone?: MochiColor }) {
  return (
    <p
      className={`ml-auto w-fit max-w-[85%] rounded-3xl rounded-br-md px-4 py-2.5 font-semibold whitespace-pre-line text-ink ${wrap}`}
      style={{ background: MOCHI[tone].base, transformOrigin: 'right bottom' }}
    >
      <span className="sr-only">{t('เรา: ', 'You: ')}</span>
      {text}
    </p>
  )
}

/** "น้องโมชิกำลังพิมพ์…" */
export function TypingRow() {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={spring.soft}
      className="mt-3 flex items-end gap-2"
    >
      <Avatar color="peach" size={34} face="talk" />
      <span className="inline-flex items-center gap-1 rounded-3xl rounded-bl-md bg-white px-4 py-3.5 shadow-[var(--shadow-soft)]" role="status">
        <span className="sr-only">{t('น้องโมชิกำลังพิมพ์', 'Little Mochi is typing')}</span>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            aria-hidden
            className="size-2 rounded-full bg-ink-faint"
            animate={reduce ? undefined : { y: [0, -4, 0], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          />
        ))}
      </span>
    </motion.div>
  )
}
