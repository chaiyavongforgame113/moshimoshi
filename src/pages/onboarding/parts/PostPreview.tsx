import { AnimatePresence, motion } from 'motion/react'
import { Clock3, MapPin, Megaphone, Wifi } from 'lucide-react'
import { known, L, t, texts } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import type { IntentDraft } from '../model'

const WHEN_LABEL = texts({
  tonight: L('คืนนี้', 'Tonight'),
  weekend: L('สุดสัปดาห์นี้', 'This weekend'),
  anytime: L('ว่างเมื่อไหร่ก็ได้', 'Anytime'),
  dated: L('', ''),
})

/**
 * The board post the chosen "มาที่นี่เพื่อ…" turns into, shown before it goes up.
 * `compact` is a single line (the post's start) so the screen above it still fits a phone.
 */
export function PostPreview({ intent, province, compact = false }: { intent: IntentDraft; province: string; compact?: boolean }) {
  if (compact) {
    return (
      <p className="flex min-h-10 items-center gap-2 rounded-2xl bg-cream-2/80 px-3 py-2 text-sm text-ink">
        <Megaphone size={16} className="shrink-0 text-ink-soft" aria-hidden />
        <span className="min-w-0 truncate">
          <span className="font-semibold">{t('โมชิจะโพสต์ชวนให้ว่า', "I'll post for you:")}</span> “{intent.text}”
        </span>
      </p>
    )
  }
  return (
    <div className="rounded-3xl bg-cream-2/80 p-4">
      <p className="text-xs font-semibold text-ink-soft">
        {t('เดี๋ยวโมชิโพสต์ชวนเพื่อนให้แบบนี้นะ (แก้ทีหลังได้)', "I'll post this to the board for you (edit it anytime)")}
      </p>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={intent.text}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={spring.soft}
          className="mt-1.5 w-fit max-w-full rounded-[1.3rem] rounded-bl-md bg-white px-3.5 py-2 text-[15px] [overflow-wrap:anywhere] text-ink shadow-[var(--shadow-soft)]"
        >
          {intent.text}
        </motion.p>
      </AnimatePresence>
      <div className="mt-2.5 flex flex-wrap gap-1.5 text-xs font-semibold text-ink">
        <span className="inline-flex h-7 items-center gap-1 rounded-full bg-white/80 px-2.5">
          <Clock3 size={12} aria-hidden />
          {known(intent.whenLabel) ?? WHEN_LABEL[intent.when]}
        </span>
        <span className="inline-flex h-7 max-w-full items-center gap-1 rounded-full bg-white/80 px-2.5">
          {intent.mode === 'online' ? <Wifi size={12} aria-hidden /> : <MapPin size={12} aria-hidden />}
          <span className="min-w-0 truncate">
            {intent.mode === 'online'
              ? t('ออนไลน์', 'Online')
              : t(`เจอกันที่${intent.province ?? province}`, `Meet in ${known(intent.province ?? province)}`)}
          </span>
        </span>
      </div>
    </div>
  )
}
