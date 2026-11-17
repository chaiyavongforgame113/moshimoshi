import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Sparkles } from 'lucide-react'
import { isAllDay, ONLINE_LABEL } from '@/data/tags'
import { t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import type { OnlineSlot } from '@/lib/types'
import type { StepProps } from '../model'
import { SLOT_OPTIONS } from '../options'
import { ChoiceGrid } from '../parts/ChoiceGrid'

/** 8 · when they're usually around (any number of slots; skippable). */
export function StepOnline({ draft, update }: StepProps) {
  const reduce = useReducedMotion()
  return (
    <div className="space-y-3">
      <ChoiceGrid
        label={t('ช่วงเวลาที่ออนไลน์', 'Times you are online')}
        choices={SLOT_OPTIONS.map(({ id, Icon, time }) => ({ value: id, label: ONLINE_LABEL[id], icon: <Icon size={18} strokeWidth={2.2} />, hint: time }))}
        selected={draft.online}
        onToggle={(value) => {
          const id = value as OnlineSlot
          update((d) => ({ online: d.online.includes(id) ? d.online.filter((s) => s !== id) : [...d.online, id] }))
        }}
        color="sky"
      />

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
