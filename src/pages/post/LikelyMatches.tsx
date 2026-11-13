import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { DoorOpen, Send, Users } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { Avatar, Button, ButtonLink, Section, SignalMeter } from '@/components/ui'
import { useChats, useDataReady, usePerson, useRoom } from '@/data/hooks'
import { sameTag, tagOf } from '@/data/tags'
import { displayName, t } from '@/lib/i18n'
import { MIN_LEVEL, signalMeta } from '@/lib/matching'
import { spring } from '@/lib/motion'
import type { Intent, MatchResult } from '@/lib/types'
import { chatToOpen } from '@/pages/chats/lib'
import { roomLabel } from '@/pages/home/greeting'

/** how many people the success screen suggests */
const LIKELY_MAX = 3

/**
 * "คนที่น่าจะสนใจ" after posting: up to 3 people at MIN_LEVEL or above, whoever is into this post's
 * topic first (`matches` from useMatchesFor, already filtered and ordered), each with a "ชวน" button
 * that opens a chat. Only the first one is the screen's primary button.
 */
export function LikelyMatches({ intent, matches }: { intent: Intent; matches: MatchResult[] }) {
  const dataReady = useDataReady()
  const room = useRoom(intent.roomId)
  const top = matches.slice(0, LIKELY_MAX)

  return (
    <Section
      tone="mint"
      icon={<Users size={18} strokeWidth={2.4} />}
      title={t('คนที่น่าจะสนใจ', 'People who might be in')}
      note={t(
        `คนที่ชอบเรื่องนี้ขึ้นก่อน ทุกคนคลื่น "${signalMeta(MIN_LEVEL).label}" ขึ้นไป`,
        `People into this come first, all "${signalMeta(MIN_LEVEL).label}" or higher`,
      )}
      className="w-full text-left"
    >
      {!dataReady ? (
        <div className="space-y-2" aria-hidden>
          {[0, 1].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-3xl bg-white/70 motion-reduce:animate-none" />
          ))}
        </div>
      ) : top.length ? (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {top.map((m, i) => (
              <InviteRow key={m.userId} match={m} intent={intent} index={i} />
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-3xl border-2 border-dashed border-line bg-white/50 p-4 sm:flex-row sm:items-center">
          <p className="min-w-0 flex-1 text-sm text-ink-soft">
            {t(
              'ตอนนี้ยังไม่มีใครคลื่นตรงกับโพสต์นี้ โมชิจะคอยดูให้นะ ระหว่างนี้แวะไปทักทายในห้องก่อนก็ได้',
              "No one's on this wavelength just yet. Mochi will keep watch. Meanwhile, drop by the room and say hi",
            )}
          </p>
          <ButtonLink to={room ? `/app/rooms/${room.id}` : '/app/rooms'} variant="secondary" size="sm" icon={<DoorOpen size={16} aria-hidden />} className="max-w-full">
            <span className="min-w-0 truncate">{room ? t(`ไปห้อง ${roomLabel(room.name)}`, `Go to ${roomLabel(room.name)}`) : t('ไปดูห้อง', 'See rooms')}</span>
          </ButtonLink>
        </div>
      )}
    </Section>
  )
}

/** One person: tap the row for their profile, "ชวน" to say hi (straight to the chat if we already talk). */
function InviteRow({ match: m, intent, index }: { match: MatchResult; intent: Intent; index: number }) {
  const reduce = useReducedMotion()
  const navigate = useNavigate()
  const chats = useChats()
  const u = usePerson(m.userId)
  if (!u) return null
  const chatId = chatToOpen(chats, u.id)?.id
  const name = displayName(u.name)
  // why them, for this post: their invite fits mine, or the topic is on their profile, or their best reason
  const tag = tagOf(intent.tagId)
  const reason =
    m.breakdown.intent > 0
      ? m.reasons.find((r) => r.kind === 'intent' || r.kind === 'swap')?.text
      : tag && u.tags.some((x) => sameTag(x, intent.tagId))
        ? t(`ชอบ ${tag.label} ตรงกับที่เราชวนอยู่พอดี`, `Into ${tag.label}, just what you're inviting people for`)
        : m.reasons[0]?.text

  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring.soft, delay: reduce ? 0 : 0.15 + index * 0.08 }}
      className="flex items-center gap-2 rounded-3xl bg-white/85 p-2 pr-2.5 shadow-[var(--shadow-soft)] sm:gap-3"
    >
      <Link to={`/app/people/${u.id}`} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl outline-offset-2 sm:gap-3">
        <Avatar color={u.color} size={44} online={u.isOnline} />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2">
            <span className="min-w-0 truncate font-display font-semibold text-ink">{name}</span>
            <SignalMeter level={m.level} size="xs" showLabel={false} className="shrink-0" />
          </span>
          {reason && <span className="block truncate text-xs text-ink-soft">{reason}</span>}
        </span>
      </Link>
      <Button
        size="sm"
        variant={index === 0 ? 'primary' : 'secondary'}
        icon={<Send size={15} strokeWidth={2.4} aria-hidden />}
        onClick={() => navigate(chatId ? `/app/chats/${chatId}` : `/app/people/${u.id}?send=1`)}
        aria-label={t(`ชวน ${name}`, `Invite ${name}`)}
        className="shrink-0"
      >
        {t('ชวน', 'Invite')}
      </Button>
    </motion.li>
  )
}
