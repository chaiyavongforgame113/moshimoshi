import { motion, useReducedMotion } from 'motion/react'
import { MapPin } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui'
import { MochiStage, View3D } from '@/components/three'
import { MOCHI } from '@/lib/colors'
import { displayName, known, t } from '@/lib/i18n'
import { lifeStageEmoji, lifeStageLabel, sharedLifeStages } from '@/lib/lifeStages'
import { spring } from '@/lib/motion'
import { useMoshi } from '@/lib/store'
import type { User } from '@/lib/types'
import { COLOR_NAME, statusLabel } from '../lib'
import { Rings } from './Rings'

/** Profile avatar and intro, with inline life-stage editing for the owner. */
export function ProfileHero({ user, owner }: { user: User; owner?: { editLife?: () => void; avatarControls: ReactNode } }) {
  const reduce = useReducedMotion()
  const p = MOCHI[user.color]
  return (
    <section aria-label={owner ? t('เกี่ยวกับเรา', 'About me') : t(`เกี่ยวกับ${user.name}`, `About ${user.name}`)} className="relative grid items-center gap-3 md:grid-cols-[minmax(0,15rem)_1fr] md:gap-6">
      <div className="relative">
        {user.isOnline && <Rings color={p.shade} size={180} speed={3.2} />}
        <View3D
          className="h-52 w-full sm:h-60"
          cursor={t('ลากเล่นได้', 'Drag to play')}
          label={owner
            ? t('โมชิของเรา แตะเพื่อบีบเล่นได้', 'My Mochi. Tap to give it a squish')
            : t(`น้องโมชิสี${COLOR_NAME[user.color]}ของ${user.name} แตะเพื่อบีบเล่นได้`, `${user.name}'s ${COLOR_NAME[user.color]} Mochi. Tap to give it a squish`)}
        >
          <MochiStage color={user.color} expression={owner || user.isOnline ? 'smile' : 'sleepy'} accessory={owner ? user.accessory : undefined} />
        </View3D>
        {owner ? owner.avatarControls : (
          <span className="absolute bottom-1 left-1/2 inline-flex max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-ink shadow-[var(--shadow-soft)]">
            <span className={`size-2.5 shrink-0 rounded-full ${user.isOnline ? 'bg-success' : 'bg-ink-faint/60'}`} aria-hidden />
            <span className="truncate">{statusLabel(user)}</span>
          </span>
        )}
      </div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ ...spring.bouncy, delay: 0.15 }}
        className="relative min-w-0 rounded-3xl bg-white p-4 shadow-[var(--shadow-soft)] sm:p-5"
      >
        {/* bubble tail: points up at the mochi on phones, left on wider screens */}
        <span aria-hidden className="absolute -top-2 left-1/2 size-5 -translate-x-1/2 rotate-45 rounded-sm bg-white md:top-10 md:-left-2 md:translate-x-0" />
        {owner && (
          <div className="relative mb-3">
            <h2 className="font-display text-xl font-semibold">{displayName(user.name)}</h2>
            <p className="flex items-center gap-1 text-sm text-ink-soft"><MapPin size={14} aria-hidden /> {known(user.province)}</p>
          </div>
        )}
        <p className="relative text-xs font-semibold text-ink-soft">{owner ? t('แนะนำตัว', 'About me') : t(`${user.name}แนะนำตัว`, `${user.name}'s intro`)}</p>
        <p className="relative mt-0.5 text-[17px] break-words text-ink">
          {user.bio || (owner ? t('ยังไม่ได้เขียนแนะนำตัว', 'Add a short intro when you edit your profile.') : t(`${user.name}ยังไม่ได้เขียนแนะนำตัว ลองทักไปถามดูสิ`, `${user.name} hasn't written an intro yet. Say hi and ask!`))}
        </p>
        <LifeStages user={user} own={!!owner} onEdit={owner?.editLife} />
      </motion.div>
    </section>
  )
}

/** Life-stage chips, with shared stages highlighted on someone else's profile. */
function LifeStages({ user, own, onEdit }: { user: User; own: boolean; onEdit?: () => void }) {
  const mine = useMoshi((s) => s.me.lifeStages)
  const stages = user.lifeStages ?? []
  if (!stages.length && !onEdit) return null
  const shared = new Set(own ? [] : sharedLifeStages(stages, mine))
  const p = MOCHI[user.color]
  return (
    <div className="relative mt-3 border-t border-dashed border-line pt-2.5">
      <div className="flex flex-wrap items-center gap-x-3">
        <p className="text-xs font-semibold text-ink-soft">{own ? t('ช่วงชีวิตตอนนี้', 'Life stage') : t('ช่วงชีวิตตอนนี้', 'Where they are in life')}</p>
        {onEdit && (
          <Button size="sm" variant="ghost" onClick={onEdit} aria-label={t('แก้ช่วงชีวิต', 'Edit life stage')}>
            {stages.length ? t('แก้', 'Edit') : t('บอกช่วงชีวิต', 'Add life stage')}
          </Button>
        )}
      </div>
      {stages.length > 0 && <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {stages.map((v) => {
          const same = shared.has(v)
          return (
            <li
              key={v}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-sm text-ink [overflow-wrap:anywhere]"
              style={same ? { background: p.light, boxShadow: `inset 0 0 0 1.5px ${p.shade}` } : { background: 'var(--color-cream-2)' }}
            >
              <span aria-hidden>{lifeStageEmoji(v)}</span>
              <span className="min-w-0">{lifeStageLabel(v)}</span>
              {same && (
                <span className="shrink-0 rounded-full bg-white/90 px-1.5 text-[11px] font-semibold whitespace-nowrap">{t('เหมือนเรา', 'Same as you')}</span>
              )}
            </li>
          )
        })}
      </ul>}
    </div>
  )
}
