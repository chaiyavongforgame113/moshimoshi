import { motion } from 'motion/react'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { Avatar, ReasonIcon, SignalMeter } from '@/components/ui'
import { known, t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import type { MatchResult, User } from '@/lib/types'
import { ageLabel } from './lib'

const MotionLink = motion.create(Link)

/** One person on my wavelength: avatar, name, the five bars and the main reason. The whole row opens the profile. */
export function PersonRow({ match, user, myAge }: { match: MatchResult; user: User; myAge: number }) {
  const reason = match.reasons[0]
  return (
    <MotionLink
      to={`/app/people/${user.id}`}
      data-cursor={t('ดูโปรไฟล์', 'View profile')}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={spring.bouncy}
      className="card group flex items-center gap-3 rounded-[1.75rem] p-3 pr-2 transition-shadow hover:shadow-[var(--shadow-lift)] sm:gap-4 sm:p-4"
    >
      <Avatar color={user.color} size={52} online={user.isOnline} face={match.level >= 4 ? 'happy' : 'smile'} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="max-w-full truncate font-display text-lg leading-snug font-semibold text-ink">{user.name}</span>
          <span className="max-w-full truncate text-xs text-ink-soft">
            {ageLabel(myAge, user.age)} · {known(user.province)}
          </span>
        </span>
        <SignalMeter level={match.level} size="sm" short className="mt-0.5" />
        {reason && (
          <span className="mt-1 flex items-start gap-1.5 text-sm text-ink-soft">
            <ReasonIcon kind={reason.kind} size={15} />
            <span className="line-clamp-2 min-w-0">{reason.text}</span>
          </span>
        )}
      </span>
      <ChevronRight size={20} className="shrink-0 text-ink-soft transition-transform group-hover:translate-x-0.5" aria-hidden />
    </MotionLink>
  )
}
