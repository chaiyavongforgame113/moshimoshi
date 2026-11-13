import { CalendarClock, DoorOpen, LifeBuoy, MapPin, MessageCircle, MessageCircleHeart, Radio, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { Avatar, ButtonLink, ReasonIcon, RoomIcon, SignalMeter, Zone } from '@/components/ui'
import { useChats, useMatch, usePerson, useRoom, useRoomStats, useSession } from '@/data/hooks'
import { MOCHI } from '@/lib/colors'
import { eventPhase, eventWhenLabel } from '@/lib/events'
import { known, t } from '@/lib/i18n'
import { MIN_LEVEL } from '@/lib/matching'
import type { MochiColor } from '@/lib/types'
import { chatToOpen } from '@/pages/chats/lib'
import { useEventHref, useEventsNow } from '@/pages/events/lib'
import type { Card } from './engine'
import { HOTLINES } from './safety'

const wrap = '[overflow-wrap:anywhere]'

/** The one thing Mochi suggests: a single card with a single button. `onGo` closes the chat on the way. */
export function SuggestionCard({ card, onGo }: { card: Card; onGo: () => void }) {
  switch (card.kind) {
    case 'room':
      return <RoomCard id={card.id} onGo={onGo} />
    case 'person':
      return <PersonCard id={card.id} onGo={onGo} />
    case 'session':
      return <SessionCard id={card.id} onGo={onGo} />
    case 'hotline':
      return <HotlineCard />
    case 'browse':
      return <BrowseCard onGo={onGo} />
  }
}

function Shell({ tone, children }: { tone: MochiColor; children: ReactNode }) {
  const p = MOCHI[tone]
  return (
    <div className="sm:pl-11">
      <article
        className="relative max-w-sm overflow-hidden rounded-[2rem] border-2 bg-white p-4 shadow-[var(--shadow-soft)]"
        style={{ borderColor: p.base, backgroundImage: `linear-gradient(180deg, ${p.light}, #fff 70%)` }}
      >
        {children}
      </article>
    </div>
  )
}

function RoomCard({ id, onGo }: { id: string; onGo: () => void }) {
  const room = useRoom(id)
  const stats = useRoomStats(id)
  if (!room) return <BrowseCard onGo={onGo} />
  const online = stats?.online ?? room.onlineCount
  return (
    <Shell tone={room.color}>
      <div className="flex items-center gap-3">
        <RoomIcon room={room} size={52} />
        <div className="min-w-0 flex-1">
          <h3 className={`font-display text-lg leading-snug font-semibold ${wrap}`}>{room.name}</h3>
          <p className="line-clamp-2 text-sm text-ink-soft">{room.tagline}</p>
        </div>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
        <span className={`size-2 shrink-0 rounded-full ${online > 0 ? 'bg-success' : 'bg-ink-faint'}`} aria-hidden />
        {online > 0
          ? t(`${online} คนอยู่ในห้องตอนนี้`, `${online} ${online === 1 ? 'person' : 'people'} in the room now`)
          : t('แวะไปเปิดไฟรอเพื่อนๆ ได้นะ', 'Pop in and switch the lights on for everyone')}
      </p>
      <ButtonLink to={`/app/rooms/${room.id}`} onClick={onGo} block className="mt-3" icon={<DoorOpen size={18} aria-hidden />}>
        {t('เข้าห้อง', 'Join the room')}
      </ButtonLink>
    </Shell>
  )
}

function PersonCard({ id, onGo }: { id: string; onGo: () => void }) {
  const u = usePerson(id)
  const match = useMatch(id)
  const chatId = chatToOpen(useChats(), id)?.id
  // only people on our wavelength are ever suggested
  if (!u || !match || match.level < MIN_LEVEL) return <BrowsePeopleCard onGo={onGo} />
  const reason = match.reasons[0]
  return (
    <Shell tone={u.color}>
      <div className="flex items-center gap-3">
        <Avatar color={u.color} size={52} face="happy" online={u.isOnline} />
        <div className="min-w-0 flex-1">
          <h3 className={`font-display text-lg leading-snug font-semibold ${wrap}`}>{u.name}</h3>
          <p className="flex items-center gap-1 text-xs text-ink-soft">
            <MapPin size={13} aria-hidden />
            <span className="truncate">{known(u.province)}</span>
          </p>
        </div>
      </div>
      <SignalMeter level={match.level} size="sm" className="mt-3" />
      {reason && (
        <p className="mt-2 flex items-start gap-2 text-sm text-ink">
          <ReasonIcon kind={reason.kind} />
          <span className="line-clamp-2">{reason.text}</span>
        </p>
      )}
      <ButtonLink
        to={chatId ? `/app/chats/${chatId}` : `/app/people/${u.id}?send=1`}
        onClick={onGo}
        block
        className="mt-3"
        icon={chatId ? <MessageCircle size={18} aria-hidden /> : <MessageCircleHeart size={18} aria-hidden />}
      >
        {chatId ? t('ไปที่แชท', 'Go to chat') : t('ทักแชท', 'Say hi')}
      </ButtonLink>
    </Shell>
  )
}

function SessionCard({ id, onGo }: { id: string; onGo: () => void }) {
  const session = useSession(id)
  const room = useRoom(session?.roomId)
  const now = useEventsNow(session ? [session] : [])
  const hrefOf = useEventHref()
  if (!session) return <BrowseCard onGo={onGo} />
  const open = eventPhase(session, now) === 'open'
  return (
    <Shell tone={room?.color ?? 'lavender'}>
      <div className="flex items-center gap-3">
        {room ? <RoomIcon room={room} size={52} /> : <Avatar color="lavender" size={52} face="happy" />}
        <div className="min-w-0 flex-1">
          <h3 className={`font-display text-lg leading-snug font-semibold ${wrap}`}>{session.title}</h3>
          {room && <p className={`text-sm text-ink-soft ${wrap}`}>{room.name}</p>}
        </div>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-ink-soft">
        <span className="inline-flex items-center gap-1">
          {open ? <Radio size={14} className="text-success" aria-hidden /> : <CalendarClock size={14} aria-hidden />}
          {open ? t('กำลังคุยกันอยู่ตอนนี้', 'Happening now') : eventWhenLabel(session.startsAt, now)}
        </span>
        {session.going > 0 && (
          <span className="inline-flex items-center gap-1">
            <Users size={14} aria-hidden />
            {t(`${session.going} คนจะไป`, `${session.going} going`)}
          </span>
        )}
      </p>
      <ButtonLink to={hrefOf(session, now)} onClick={onGo} block className="mt-3" icon={<DoorOpen size={18} aria-hidden />}>
        {open ? t('เข้าห้องเลย', 'Go in now') : t('ดูอีเวนต์', 'See the event')}
      </ButtonLink>
    </Shell>
  )
}

/** nothing fitting right now: one way on */
function BrowseCard({ onGo }: { onGo: () => void }) {
  return (
    <Shell tone="peach">
      <p className="text-sm text-ink-soft">{t('ห้องต่างๆ มีเพื่อนๆ แวะมานั่งคุยกันทั้งวัน', 'Friends drop into the rooms all day long')}</p>
      <ButtonLink to="/app/rooms" onClick={onGo} block className="mt-3" icon={<DoorOpen size={18} aria-hidden />}>
        {t('ไปดูห้องทั้งหมด', 'Browse rooms')}
      </ButtonLink>
    </Shell>
  )
}

function BrowsePeopleCard({ onGo }: { onGo: () => void }) {
  return (
    <Shell tone="pink">
      <p className="text-sm text-ink-soft">{t('ไปดูว่าใครคลื่นตรงกับเราบ้าง', "See who's on your wavelength")}</p>
      <ButtonLink to="/app/people" onClick={onGo} block className="mt-3" icon={<Users size={18} aria-hidden />}>
        {t('ดูคนคลื่นเดียวกัน', 'People on your wavelength')}
      </ButtonLink>
    </Shell>
  )
}

/**
 * Shown when someone writes about hurting themselves: Thailand's mental health
 * hotline (1323, free, 24 hours) and emergency medical services (1669).
 * A hotline really is a phone call, so this card says so plainly.
 */
export function HotlineCard() {
  return (
    <div className="sm:pl-11">
      <Zone tone="pink" icon={<LifeBuoy size={18} strokeWidth={2.4} />} title={t('มีคนพร้อมรับฟังเราอยู่นะ', 'Someone is ready to listen')} className="max-w-sm">
        <ul className="space-y-2">
          {HOTLINES.map((h) => (
            <li key={h.number}>
              <a
                href={`tel:${h.number}`}
                aria-label={t(`โทร ${h.number} ${h.name} ${h.note}`, `Call ${h.number}, ${h.name}. ${h.note}`)}
                className="flex min-h-16 items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[var(--shadow-soft)] ring-1 ring-line transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
              >
                <span className="font-display text-3xl font-bold text-coral-deep tabular-nums">{h.number}</span>
                <span className="min-w-0 flex-1">
                  <span className={`block font-semibold text-ink ${wrap}`}>{h.name}</span>
                  <span className={`block text-xs text-ink-soft ${wrap}`}>{h.note}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-soft">
          {t('แตะเบอร์เพื่อโทรได้เลย ถ้าอยู่ต่างประเทศ ติดต่อเบอร์ฉุกเฉินของที่นั่นได้นะ', "Tap a number to call. Outside Thailand? Please contact your local emergency number")}
        </p>
      </Zone>
    </div>
  )
}
