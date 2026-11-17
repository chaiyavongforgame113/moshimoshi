import { motion, useReducedMotion } from 'motion/react'
import { MochiStage, View3D } from '@/components/three'
import { MOCHI } from '@/lib/colors'
import { t } from '@/lib/i18n'
import { lifeStageEmoji, lifeStageLabel, sharedLifeStages } from '@/lib/lifeStages'
import { spring } from '@/lib/motion'
import { useMoshi } from '@/lib/store'
import type { User } from '@/lib/types'
import { COLOR_NAME, statusLabel } from '../lib'
import { Rings } from './Rings'

/** Big 3D mochi in their colour + a speech-bubble bio. Kept short so "why we click" sits near the top. */
export function ProfileHero({ user }: { user: User }) {
  const reduce = useReducedMotion()
  const p = MOCHI[user.color]
  return (
    <section aria-label={t(`เกี่ยวกับ${user.name}`, `About ${user.name}`)} className="relative grid items-center gap-3 md:grid-cols-[minmax(0,15rem)_1fr] md:gap-6">
      <div className="relative">
        {user.isOnline && <Rings color={p.shade} size={180} speed={3.2} />}
        <View3D
          className="h-52 w-full sm:h-60"
          cursor={t('ลากเล่นได้', 'Drag to play')}
          label={t(`น้องโมชิสี${COLOR_NAME[user.color]}ของ${user.name} แตะเพื่อบีบเล่นได้`, `${user.name}'s ${COLOR_NAME[user.color]} Mochi. Tap to give it a squish`)}
        >
          <MochiStage color={user.color} expression={user.isOnline ? 'smile' : 'sleepy'} />
        </View3D>
        <span className="absolute bottom-1 left-1/2 inline-flex max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-ink shadow-[var(--shadow-soft)]">
          <span className={`size-2.5 shrink-0 rounded-full ${user.isOnline ? 'bg-success' : 'bg-ink-faint/60'}`} aria-hidden />
          <span className="truncate">{statusLabel(user)}</span>
        </span>
      </div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ ...spring.bouncy, delay: 0.15 }}
        className="relative min-w-0 rounded-3xl bg-white p-4 shadow-[var(--shadow-soft)] sm:p-5"
      >
        {/* bubble tail: points up at the mochi on phones, left on wider screens */}
        <span aria-hidden className="absolute -top-2 left-1/2 size-5 -translate-x-1/2 rotate-45 rounded-sm bg-white md:top-10 md:-left-2 md:translate-x-0" />
        <p className="relative text-xs font-semibold text-ink-soft">{t(`${user.name}แนะนำตัว`, `${user.name}'s intro`)}</p>
        <p className="relative mt-0.5 text-[17px] break-words text-ink">{user.bio || t(`${user.name}ยังไม่ได้เขียนแนะนำตัว ลองทักไปถามดูสิ`, `${user.name} hasn't written an intro yet. Say hi and ask!`)}</p>
        <LifeStages user={user} />
      </motion.div>
    </section>
  )
}

/** "ช่วงชีวิตตอนนี้": up to 3 chips; the ones we share are lit in their colour and say so. */
function LifeStages({ user }: { user: User }) {
  const mine = useMoshi((s) => s.me.lifeStages)
  const stages = user.lifeStages ?? []
  if (!stages.length) return null
  const shared = new Set(sharedLifeStages(stages, mine))
  const p = MOCHI[user.color]
  return (
    <div className="relative mt-3 border-t border-dashed border-line pt-2.5">
      <p className="text-xs font-semibold text-ink-soft">{t('ช่วงชีวิตตอนนี้', 'Where they are in life')}</p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
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
      </ul>
    </div>
  )
}
