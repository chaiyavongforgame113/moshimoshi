import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { CalendarClock, Check, DoorOpen, MessageCircle, MessageCircleHeart, Plus, Radio } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Avatar, Button, ButtonLink, ReasonIcon, RoomIcon, SignalMeter } from '@/components/ui'
import { useChats, useDailyPick, usePerson, useRoom, useSessions } from '@/data/hooks'
import { MOCHI } from '@/lib/colors'
import { known, t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import { useMoshi } from '@/lib/store'
import type { Chat, MatchResult, MochiColor, Session } from '@/lib/types'
import { chatPhase, chatToOpen, previewText, setAside } from '@/pages/chats/lib'
import { useIsMine } from '@/pages/people/lib'
import { ageLabel, dayLabel, roomLabel } from './greeting'
import { InviteButton } from './Soft'

export type Next =
  | { kind: 'hello'; chat: Chat }
  | { kind: 'unread'; chat: Chat; others: number }
  | { kind: 'live'; session: Session; why: 'going' | 'room' }
  | { kind: 'pick'; match: MatchResult }
  | { kind: 'upcoming'; session: Session }
  | { kind: 'invite' }

/** live first, then by day and time */
const bySoonest = (a: Session, b: Session) => Number(!!b.live) - Number(!!a.live) || a.dayOffset - b.dayOffset || a.time.localeCompare(b.time)

/**
 * The one most important thing right now, in this order: someone said hi / unread messages →
 * an event I'm going to (or one in my rooms) is live → today's wavelength pick (until we're
 * chatting: the pick stays the same all day, and saying hi again isn't a next step) → the next
 * event → invite a friend. HomePage reads it too, so the zones below don't repeat what it shows.
 */
export function useNextStep(): Next {
  const chats = useChats()
  const isMine = useIsMine()
  const sessions = useSessions()
  const going = useMoshi((s) => s.going)
  const myRooms = useMoshi((s) => s.me.rooms)
  const pick = useDailyPick()

  return useMemo<Next>(() => {
    const open = chats.filter((c) => !setAside(c, isMine))
    const hello = open.find((c) => chatPhase(c) === 'incoming')
    if (hello) return { kind: 'hello', chat: hello }
    const unread = open.filter((c) => c.unread > 0)
    if (unread.length) return { kind: 'unread', chat: unread[0], others: unread.length - 1 }

    const live = sessions.filter((s) => s.live)
    const mineLive = live.find((s) => going.includes(s.id)) ?? live.find((s) => myRooms.includes(s.roomId))
    if (mineLive) return { kind: 'live', session: mineLive, why: going.includes(mineLive.id) ? 'going' : 'room' }

    if (pick && !chatToOpen(chats, pick.userId)) return { kind: 'pick', match: pick }

    const soonest = [...sessions].sort(bySoonest)[0]
    if (soonest) return { kind: 'upcoming', session: soonest }
    return { kind: 'invite' }
  }, [chats, isMine, sessions, going, myRooms, pick])
}

const keyOf = (n: Next) => {
  if (n.kind === 'hello' || n.kind === 'unread') return `${n.kind}:${n.chat.id}`
  if (n.kind === 'live' || n.kind === 'upcoming') return `${n.kind}:${n.session.id}`
  if (n.kind === 'pick') return `pick:${n.match.userId}`
  return 'invite'
}

/** Home zone 2 for people past their first steps: one card, one main button. */
export function NextStep({ next }: { next: Next }) {
  const reduce = useReducedMotion()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={keyOf(next)}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
        transition={spring.soft}
      >
        {next.kind === 'hello' && <ChatCard chat={next.chat} hello />}
        {next.kind === 'unread' && <ChatCard chat={next.chat} others={next.others} />}
        {next.kind === 'live' && <EventCard session={next.session} why={next.why} />}
        {next.kind === 'pick' && <PickCard match={next.match} />}
        {next.kind === 'upcoming' && <EventCard session={next.session} />}
        {next.kind === 'invite' && <InviteCard />}
      </motion.div>
    </AnimatePresence>
  )
}

// ------------------------------------------------------------------ the card shell

function Card({
  eyebrow,
  color,
  visual,
  title,
  line,
  children,
  actions,
}: {
  eyebrow: ReactNode
  color: MochiColor
  visual: ReactNode
  title: ReactNode
  line?: ReactNode
  children?: ReactNode
  actions: ReactNode
}) {
  const p = MOCHI[color]
  return (
    <article className="card relative overflow-hidden p-4 sm:p-5">
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24" style={{ background: `linear-gradient(180deg, ${p.light}, transparent)` }} />
      <p className="relative flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-soft">{eyebrow}</p>
      <div className="relative mt-2 flex items-center gap-3">
        <span className="shrink-0">{visual}</span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl leading-snug font-semibold break-words text-ink">{title}</h3>
          {line && <p className="text-sm text-ink-soft">{line}</p>}
        </div>
      </div>
      {children && <div className="relative mt-3">{children}</div>}
      <div className="relative mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">{actions}</div>
    </article>
  )
}

// ------------------------------------------------------------------ kinds

function ChatCard({ chat, hello = false, others = 0 }: { chat: Chat; hello?: boolean; others?: number }) {
  const u = usePerson(chat.withUserId)
  const isMine = useIsMine()
  const name = u?.name ?? t('เพื่อนใหม่', 'A new friend')
  const preview = previewText(chat, isMine)
  return (
    <Card
      color={u?.color ?? 'peach'}
      eyebrow={
        <>
          <MessageCircleHeart size={14} strokeWidth={2.4} aria-hidden />
          {hello ? t('มีคนทักมา', 'Someone said hi') : t('ข้อความใหม่', 'New messages')}
        </>
      }
      visual={<Avatar color={u?.color ?? 'peach'} size={52} face="happy" online={u?.isOnline} />}
      title={
        hello
          ? t(`${name} ทักแชทมา`, `${name} said hi`)
          : chat.unread > 1
            ? t(`${name} ส่งข้อความมา ${chat.unread} ข้อความ`, `${chat.unread} new messages from ${name}`)
            : t(`${name} ส่งข้อความมา`, `A new message from ${name}`)
      }
      line={others > 0 ? t(`และมีแชทอื่นรออีก ${others} แชท`, `${others} more ${others === 1 ? 'chat is' : 'chats are'} waiting too`) : undefined}
      actions={
        <ButtonLink to={`/app/chats/${chat.id}`} icon={<MessageCircle size={18} />} className="w-full sm:w-auto">
          {hello ? t('ไปตอบเลย', 'Reply') : t('เปิดแชท', 'Open chat')}
        </ButtonLink>
      }
    >
      <p className="line-clamp-2 rounded-2xl rounded-tl-md bg-cream px-3.5 py-2.5 text-sm break-words text-ink">{preview}</p>
    </Card>
  )
}

function EventCard({ session: s, why }: { session: Session; why?: 'going' | 'room' }) {
  const room = useRoom(s.roomId)
  const going = useMoshi((st) => st.going.includes(s.id))
  const toggleGoing = useMoshi((st) => st.toggleGoing)
  const count = s.going + (going ? 1 : 0)
  const eyebrow = s.live
    ? why === 'going'
      ? t('อีเวนต์ที่เราจะไปเปิดแล้ว', "An event you're going to is live")
      : why === 'room'
        ? t('ห้องของเรามีอีเวนต์เปิดอยู่', 'Live now in one of your rooms')
        : t('กำลังเปิดอยู่ตอนนี้', 'Live right now')
    : t('อีเวนต์ถัดไป', 'Next event')
  return (
    <Card
      color={room?.color ?? 'lavender'}
      eyebrow={
        <>
          {s.live ? <LivePill /> : <CalendarClock size={14} strokeWidth={2.4} aria-hidden />}
          {eyebrow}
        </>
      }
      visual={room ? <RoomIcon room={room} size={52} /> : <Avatar color="lavender" size={52} face="happy" />}
      title={s.title}
      line={
        <>
          {s.live ? t('คุยกันอยู่ตอนนี้', 'Happening now') : `${dayLabel(s.dayOffset)} ${s.time}`}
          {room && ` · ${roomLabel(room.name)}`}
          {' · '}
          {t(`${count} คนจะไป`, `${count} going`)}
        </>
      }
      actions={
        s.live ? (
          <ButtonLink to={`/app/rooms/${s.roomId}`} icon={<DoorOpen size={18} />} className="w-full sm:w-auto">
            {t('เข้าไปคุยเลย', 'Join the chat')}
          </ButtonLink>
        ) : going ? (
          <>
            <span className="inline-flex h-12 items-center justify-center gap-1.5 rounded-full bg-mint px-5 font-display text-[15px] font-semibold text-ink shadow-[inset_0_-3px_0_rgb(59_38_34/0.12)]">
              <Check size={18} strokeWidth={3} aria-hidden />
              {t('ไปด้วยแล้ว', "You're going")}
            </span>
            <ButtonLink to={`/app/rooms/${s.roomId}`} variant="secondary" icon={<DoorOpen size={18} />}>
              {t('ไปดูห้อง', 'See the room')}
            </ButtonLink>
          </>
        ) : (
          <Button onClick={() => toggleGoing(s.id)} icon={<Plus size={18} strokeWidth={2.8} />} className="w-full sm:w-auto">
            {t('ไปด้วย', "I'm going")}
            {/* the event's name, for screen readers: the visible words still start the button's name */}
            <span className="sr-only">{t(` ${s.title}`, `: ${s.title}`)}</span>
          </Button>
        )
      }
    />
  )
}

function PickCard({ match: m }: { match: MatchResult }) {
  const u = usePerson(m.userId)
  const me = useMoshi((s) => s.me)
  const chatId = chatToOpen(useChats(), m.userId)?.id
  if (!u) return <InviteCard />
  const reason = m.reasons[0]
  return (
    <Card
      color={u.color}
      eyebrow={
        <>
          <Radio size={14} strokeWidth={2.4} aria-hidden />
          {t('คลื่นของวันนี้', "Today's wavelength")}
        </>
      }
      visual={
        <Link to={`/app/people/${u.id}`} className="block rounded-full" aria-label={t(`ดูโปรไฟล์ ${u.name}`, `View ${u.name}'s profile`)}>
          <Avatar color={u.color} size={56} face="happy" online={u.isOnline} />
        </Link>
      }
      title={u.name}
      line={`${ageLabel(me.age, u.age)} · ${known(u.province)}`}
      actions={
        <>
          {chatId ? (
            <ButtonLink to={`/app/chats/${chatId}`} icon={<MessageCircle size={18} />} className="w-full sm:w-auto">
              {t('ไปที่แชท', 'Go to chat')}
            </ButtonLink>
          ) : (
            <ButtonLink to={`/app/people/${u.id}?send=1`} icon={<MessageCircleHeart size={18} />} className="w-full sm:w-auto">
              {t('ทักแชท', 'Say hi')}
            </ButtonLink>
          )}
          <ButtonLink to={`/app/people/${u.id}`} variant="ghost" className="w-full sm:w-auto">
            {t('ดูโปรไฟล์', 'View profile')}
          </ButtonLink>
        </>
      }
    >
      <SignalMeter level={m.level} size="sm" />
      {reason && (
        <p className="mt-2 flex items-start gap-2 text-sm text-ink">
          <ReasonIcon kind={reason.kind} />
          <span className="min-w-0 break-words">{reason.text}</span>
        </p>
      )}
    </Card>
  )
}

function InviteCard() {
  return (
    <Card
      color="butter"
      eyebrow={t('ตอนนี้ยังเงียบๆ อยู่', "It's quiet right now")}
      visual={<Avatar color="peach" size={52} face="wink" />}
      title={t('ชวนเพื่อนมาเล่นด้วยกันไหม', 'Invite a friend along?')}
      line={t('ยิ่งเพื่อนมาเยอะ ก็ยิ่งเจอคนคลื่นเดียวกันง่ายขึ้นนะ', 'The more friends join, the easier it is to find your wavelength')}
      actions={<InviteButton variant="primary" className="w-full sm:w-auto" />}
    />
  )
}

function LivePill() {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-coral px-2 font-display text-[11px] font-bold tracking-wide text-ink">
      <span className="relative flex size-2" aria-hidden>
        <span className="absolute inline-flex size-full rounded-full bg-white opacity-90 motion-safe:animate-ping" />
        <span className="relative inline-flex size-2 rounded-full bg-white" />
      </span>
      {t('เปิดอยู่', 'LIVE')}
    </span>
  )
}
