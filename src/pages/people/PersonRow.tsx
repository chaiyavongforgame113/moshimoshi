import { ChevronRight, MessageCircle, MessageCircleHeart } from 'lucide-react'
import { Link } from 'react-router'
import { Avatar, ButtonLink, ReasonIcon, SignalMeter } from '@/components/ui'
import { useChats } from '@/data/hooks'
import { tagOf } from '@/data/tags'
import { known, t } from '@/lib/i18n'
import type { MatchResult, User } from '@/lib/types'
import { chatToOpen } from '@/pages/chats/lib'
import { ageLabel, statusLabel } from './lib'

/** The same compact profile summary for the daily pick and the rest of the wavelength list. */
export function PersonRow({ match, user, myAge }: { match: MatchResult; user: User; myAge: number }) {
  const chat = chatToOpen(useChats(), user.id)
  const interests = [...new Set([...user.loves, ...user.tags])].flatMap((id) => tagOf(id)?.label ?? []).slice(0, 3)
  const reasons = match.reasons.slice(0, 2)
  const profilePath = `/app/people/${user.id}`
  const chatLabel = chat ? t('ไปที่แชท', 'Go to chat') : t('ทักแชท', 'Say hi')

  return (
    <article className="card max-h-[50svh] overflow-y-auto rounded-3xl p-3 transition-shadow hover:shadow-[var(--shadow-lift)]">
      <Link
        to={profilePath}
        aria-label={t(`ดูโปรไฟล์ของ ${user.name}`, `View ${user.name}'s profile`)}
        className="group block rounded-2xl"
      >
        <div className="flex items-center gap-2.5">
          <Avatar color={user.color} size={44} online={user.isOnline} face={user.face ?? (match.level >= 4 ? 'happy' : 'smile')} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-lg leading-tight font-semibold">{user.name}</h3>
            <p className="truncate text-xs text-ink-soft">{[ageLabel(myAge, user.age), known(user.province), statusLabel(user)].filter(Boolean).join(' · ')}</p>
            <SignalMeter level={match.level} size="xs" className="mt-1" />
          </div>
          <ChevronRight size={18} className="shrink-0 text-ink-soft transition-transform group-hover:translate-x-0.5" aria-hidden />
        </div>

        {user.bio.trim() && <p className="mt-2 line-clamp-2 text-sm leading-snug [overflow-wrap:anywhere] text-ink">{user.bio}</p>}
        {interests.length > 0 && (
          <p className="mt-1 truncate text-xs text-ink-soft">
            <span className="font-semibold">{t('ชอบ', 'Interests')}</span> · {interests.join(' · ')}
          </p>
        )}
        {reasons.length > 0 && (
          <ul className="mt-2 space-y-1 border-t border-line pt-2" aria-label={t('ทำไมคลื่นตรงกัน', 'Why your waves line up')}>
            {reasons.map((reason) => (
              <li key={reason.text} className="flex min-w-0 items-start gap-1.5 text-sm leading-snug text-ink-soft">
                <ReasonIcon kind={reason.kind} size={14} />
                <span className="line-clamp-2 min-w-0 [overflow-wrap:anywhere]">{reason.text}</span>
              </li>
            ))}
          </ul>
        )}
      </Link>

      <ButtonLink
        to={chat ? `/app/chats/${chat.id}` : `${profilePath}?send=1`}
        variant="secondary"
        size="sm"
        icon={chat ? <MessageCircle size={16} aria-hidden /> : <MessageCircleHeart size={16} aria-hidden />}
        aria-label={t(`${chatLabel}กับ ${user.name}`, `${chatLabel} · ${user.name}`)}
        className="mt-2"
      >
        {chatLabel}
      </ButtonLink>
    </article>
  )
}
