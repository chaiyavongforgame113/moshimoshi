import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Sparkles } from 'lucide-react'
import { isAllDay, ONLINE_LABEL } from '@/data/tags'
import { t } from '@/lib/i18n'
import { fadeUp, spring } from '@/lib/motion'
import type { StepProps } from '../model'
import { SLOT_OPTIONS } from '../options'

/** 7 · when they're usually around (any number of slots; skippable). */
export function StepOnline({ draft, update }: StepProps) {
  const reduce = useReducedMotion()
  return (
    <div className="space-y-3">
      <motion.div variants={fadeUp} role="group" aria-label={t('ช่วงเวลาที่ออนไลน์', 'Times you are online')} className="grid grid-cols-2 gap-2.5">
        {SLOT_OPTIONS.map(({ id, Icon, time }) => {
          const on = draft.online.includes(id)
          return (
            <motion.button
              key={id}
              type="button"
              aria-pressed={on}
              onClick={() => update((d) => ({ online: on ? d.online.filter((s) => s !== id) : [...d.online, id] }))}
              whileTap={reduce ? undefined : { scale: 0.93 }}
              transition={spring.bouncy}
              className={`flex min-h-[4.5rem] items-center gap-2.5 rounded-[1.4rem] border-2 px-3 text-left transition-colors ${
                on ? 'border-sky bg-sky/45' : 'border-line bg-white/85 hover:bg-white'
              }`}
            >
              <motion.span
                animate={reduce ? undefined : { rotate: on ? 360 : 0 }}
                transition={spring.gentle}
                className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-ink shadow-[var(--shadow-soft)]"
                aria-hidden
              >
                <Icon size={19} />
              </motion.span>
              <span className="min-w-0">
                <span className="block font-display text-[15px] leading-snug font-semibold text-ink">{ONLINE_LABEL[id]}</span>
                <span className="block text-xs text-ink-soft">{time}</span>
              </span>
            </motion.button>
          )
        })}
      </motion.div>

      {/* every slot on: one rainbow "24 ชั่วโมง" (the profile shows just that, not four chips) */}
      <AnimatePresence initial={false}>
        {isAllDay(draft.online) && (
          <motion.p
            key="all-day"
            role="status"
            initial={reduce ? false : { opacity: 0, height: 0, scale: 0.96 }}
            animate={{ opacity: 1, height: 'auto', scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.96 }}
            transition={spring.soft}
            className="rainbow-chip overflow-hidden rounded-2xl px-4 text-center font-display text-[15px] font-semibold text-ink"
          >
            <span className="flex flex-col items-center py-2.5">
              <span className="inline-flex items-center gap-2">
                <Sparkles size={18} strokeWidth={2.4} aria-hidden className="shrink-0" />
                {t('ออนไลน์ได้ทั้ง 24 ชั่วโมง!', "You're around 24/7!")}
              </span>
              <span className="text-xs font-medium text-ink-soft">{t('ใครทักมาตอนไหนก็เจอกัน', 'Whenever someone says hi, you’re there')}</span>
            </span>
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
