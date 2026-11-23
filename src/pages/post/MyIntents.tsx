import { AnimatePresence, motion } from 'motion/react'
import { Clock3, Megaphone, Pencil, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Button, IconButton, Section, ShowMore } from '@/components/ui'
import { MOCHI } from '@/lib/colors'
import { t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import { useMoshi } from '@/lib/store'
import type { Intent } from '@/lib/types'
import { ReactedBadge } from '@/pages/rooms/bits'
import { TEMPLATE_BY_KEY, whenText } from './templates'

export const MAX_ACTIVE = 3

/** My open ชวนเล่น posts (max 3): tap one to edit it, or take it down (asks first). */
export function MyIntents({ editingId }: { editingId?: string }) {
  const myIntents = useMoshi((s) => s.myIntents)
  if (!myIntents.length) return null

  return (
    <Section
      tone="butter"
      icon={<Megaphone size={18} strokeWidth={2.4} />}
      title={t('ที่เราชวนไว้', 'Your invites')}
      note={t(`เปิดได้พร้อมกัน ${MAX_ACTIVE} โพสต์`, `Up to ${MAX_ACTIVE} open at once`)}
      action={
        <span className="flex items-center gap-1" role="img" aria-label={t(`ใช้ไป ${myIntents.length} จาก ${MAX_ACTIVE}`, `${myIntents.length} of ${MAX_ACTIVE} used`)}>
          {Array.from({ length: MAX_ACTIVE }, (_, i) => (
            <motion.span
              key={i}
              aria-hidden
              className={`h-2 rounded-full ${i < myIntents.length ? 'bg-coral' : 'bg-ink/10'}`}
              animate={{ width: i < myIntents.length ? 18 : 8 }}
              transition={spring.bouncy}
            />
          ))}
        </span>
      }
    >
      <ShowMore items={myIntents} initial={2} getKey={(i) => i.id} listClassName="grid gap-2" render={(i) => <MyIntentRow intent={i} editing={editingId === i.id} />} />
    </Section>
  )
}

function MyIntentRow({ intent: i, editing }: { intent: Intent; editing: boolean }) {
  const removeIntent = useMoshi((s) => s.removeIntent)
  const [asking, setAsking] = useState(false)
  const tpl = TEMPLATE_BY_KEY[i.template]
  const p = MOCHI[tpl?.color ?? 'cream']

  return (
    <div
      className={`rounded-2xl border-2 p-2 pl-2.5 shadow-[var(--shadow-soft)] transition-colors ${
        asking ? 'border-coral/60 bg-white' : editing ? 'border-lavender bg-lavender/20' : 'border-white/80 bg-white/80'
      }`}
    >
      <div className="flex items-center gap-2">
        {tpl && (
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-ink" style={{ background: p.base }} aria-hidden>
            <tpl.Icon size={17} strokeWidth={2.4} />
          </span>
        )}
        <Link to={`/app/people/invites/compose?edit=${i.id}`} aria-label={t(`แก้ไขโพสต์ "${i.text}"`, `Edit post "${i.text}"`)} className="min-w-0 flex-1 rounded-xl outline-offset-2">
          <span className="block truncate text-sm font-semibold">{i.text}</span>
          <span className="flex items-center gap-1 text-xs text-ink-soft">
            <Clock3 size={12} aria-hidden /> {whenText(i.when, i.whenLabel)}
          </span>
          <ReactedBadge kind="metoo" ids={i.joinedBy} className="mt-1.5" />
        </Link>
        <Link to={`/app/people/invites/compose?edit=${i.id}`} aria-hidden tabIndex={-1} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-ink/5">
          <Pencil size={17} />
        </Link>
        <IconButton label={t(`เอาโพสต์ "${i.text}" ลง`, `Take down "${i.text}"`)} variant="ghost" aria-expanded={asking} onClick={() => setAsking((v) => !v)}>
          <X size={18} />
        </IconButton>
      </div>

      <AnimatePresence initial={false}>
        {asking && (
          <motion.div
            key="ask"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={spring.soft}
            className="overflow-hidden"
          >
            <div role="alert" className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-cream p-2 pl-3">
              <p className="min-w-0 flex-[1_1_10rem] text-sm text-ink">{t('เอาโพสต์นี้ลงไหม? คนที่กดฉันด้วยไว้จะไม่เห็นแล้วนะ', "Take this post down? People who tapped “Me too!” won't see it anymore")}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setAsking(false)}>
                  {t('เก็บไว้', 'Keep it')}
                </Button>
                <Button size="sm" variant="dark" onClick={() => removeIntent(i.id)}>
                  {t('เอาลง', 'Take down')}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
