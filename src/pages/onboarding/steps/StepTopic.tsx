import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useRooms } from '@/data/hooks'
import { tagOf } from '@/data/tags'
import { t } from '@/lib/i18n'
import { fadeUp, spring } from '@/lib/motion'
import { useMoshi } from '@/lib/store'
import { buildIntent, type StepProps } from '../model'
import { Pill } from '../parts/Pill'
import { PostPreview } from '../parts/PostPreview'

/** 6 (continued) · "คุยเรื่อง…": which of their interests, and the post it makes. */
export function StepTopic({ draft, update }: StepProps) {
  const province = useMoshi((s) => s.me.province)
  const rooms = useRooms()
  const reduce = useReducedMotion()
  const preview = buildIntent(draft, province, rooms)
  // loved ones first: they're the likeliest pick
  const ordered = [...draft.loves.filter((id) => draft.tags.includes(id)), ...draft.tags.filter((id) => !draft.loves.includes(id))]

  return (
    <div className="space-y-4">
      <motion.div variants={fadeUp} role="group" aria-label={t('หัวข้อที่อยากคุย', 'Topic to talk about')} className="flex flex-wrap gap-2">
        {ordered.map((id) => (
          <Pill key={id} selected={preview?.tagId === id} onClick={() => update({ intentTag: id })} color="pink">
            <span className="min-w-0 truncate">{tagOf(id)?.label ?? id}</span>
          </Pill>
        ))}
      </motion.div>

      <AnimatePresence initial={false}>
        {preview && (
          <motion.div key="preview" variants={fadeUp} initial={reduce ? false : 'hidden'} animate="show" transition={spring.soft}>
            <PostPreview intent={preview} province={province} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
