import { motion, useReducedMotion } from 'motion/react'
import { Avatar } from '@/components/ui'
import { MOCHI } from '@/lib/colors'
import { t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import { useMoshi } from '@/lib/store'
import type { User } from '@/lib/types'
import { useMochiReasons, whereLine } from '@/pages/people/intro'
import { MochiReasonList } from '@/pages/people/IntroReasons'

/**
 * Mochi's intro in an intro chat, from my side: who we both are (a mochi, a name, where each of us
 * is in life) and 2–3 reasons the waves line up. Each person's device writes its own, from what it
 * can see, so nobody can put words in Mochi's mouth.
 */
export function MochiIntroCard({ them, isNew }: { them: User; isNew: boolean }) {
  const reduce = useReducedMotion()
  const me = useMoshi((s) => s.me)
  const reasons = useMochiReasons(them.id)
  return (
    <motion.div
      initial={reduce || !isNew ? false : { opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring.bouncy}
      className="w-full rounded-[1.75rem] border border-white/80 bg-white/85 p-3.5 shadow-[var(--shadow-soft)] backdrop-blur-sm sm:p-4"
    >
      <p className="font-display text-[17px] leading-snug font-semibold break-words text-ink">
        {t(`โมชิขอแนะนำ ${them.name} ให้รู้จักนะ`, `Meet ${them.name}!`)}
      </p>
      <ul className="mt-2.5 grid gap-2 sm:grid-cols-2">
        <PersonTile user={them} title={them.name} />
        <PersonTile user={me} title={t('เธอ', 'You')} />
      </ul>
      <p className="mt-3 text-sm font-semibold text-ink-soft">{t('ทำไมโมชิว่าคลื่นตรงกัน', 'Why Mochi thinks your waves line up')}</p>
      <MochiReasonList reasons={reasons} className="mt-1.5" />
    </motion.div>
  )
}

function PersonTile({ user, title }: { user: Pick<User, 'color' | 'lifeStages' | 'province'>; title: string }) {
  const p = MOCHI[user.color]
  return (
    <li className="flex min-w-0 items-center gap-2.5 rounded-3xl px-2.5 py-2" style={{ background: p.light }}>
      <Avatar color={user.color} size={36} face="happy" />
      <span className="min-w-0">
        <span className="block truncate font-display text-sm font-semibold text-ink">{title}</span>
        <span className="block text-xs break-words text-ink-soft">{whereLine(user)}</span>
      </span>
    </li>
  )
}
