import { motion } from 'motion/react'
import { HeartHandshake, MessageCircleHeart, MessagesSquare, Radio, Send, Sparkles } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { KineticText, Reveal } from '@/components/motion'
import { Avatar, ButtonLink, PageHeader, Section, ShowMore, SignalMeter } from '@/components/ui'
import { useChats, useDataReady, useIntroRequests, useMatches, usePeople } from '@/data/hooks'
import { MOCHI } from '@/lib/colors'
import { known, t } from '@/lib/i18n'
import { useNow } from '@/lib/hooks'
import { fadeUp, spring } from '@/lib/motion'
import type { Chat, MatchResult, User } from '@/lib/types'
import { useIsMine } from '@/pages/people/lib'
import { Rings } from '@/pages/people/profile/Rings'
import { ListSkeleton } from '@/pages/people/Skeleton'
import { FindMoreLink, IncomingIntroCard, OutgoingIntroRow } from './intro/IncomingIntro'
import { chatPhase, lastMessage, previewText, setAside } from './lib'

const MotionLink = motion.create(Link)

/** hello cards (sent or waiting for us) shown before "ดูเพิ่ม" */
const FIRST_HELLOS = 3
/** chat rows shown before "ดูเพิ่ม" (more when an unread chat sits further down) */
const FIRST_CHATS = 6
/** an intro of mine that ran out stays in the list (with its kind note) this long */
const EXPIRED_SHOWN_MS = 3 * 86_400_000

interface Row {
  chat: Chat
  user: User
  match?: MatchResult
}

type IsMine = (id: string) => boolean

export default function ChatsPage() {
  const ready = useDataReady()
  const chats = useChats()
  const people = usePeople()
  const matches = useMatches()
  const isMine = useIsMine()
  const users = useMemo(() => new Map(people.map((u) => [u.id, u])), [people])
  const intros = useIntroRequests()
  const now = useNow(60_000)
  // "โมชิอยากแนะนำ…" for people I can see; mine still waiting, or run out lately (never accepted ones: those are chats now)
  const introsIn = intros.incoming.filter((i) => users.has(i.withUserId))
  const introsOut = intros.outgoing.filter(
    (i) => users.has(i.withUserId) && (i.status === 'pending' || (i.status === 'expired' && now - Date.parse(i.expiresAt) < EXPIRED_SHOWN_MS)),
  )
  const introsRanOut = introsOut.some((i) => i.status === 'expired')

  const { incoming, waiting, talking } = useMemo(() => {
    const byUser = new Map(matches.map((m) => [m.userId, m]))
    const rows = chats.flatMap((chat): Row[] => {
      const user = users.get(chat.withUserId)
      return user && !setAside(chat, isMine) ? [{ chat, user, match: byUser.get(user.id) }] : []
    })
    return {
      incoming: rows.filter((r) => chatPhase(r.chat) === 'incoming'),
      waiting: rows.filter((r) => chatPhase(r.chat) === 'ringing'),
      talking: rows.filter((r) => ['open', 'ended'].includes(chatPhase(r.chat))),
    }
  }, [chats, users, matches, isMine])

  const total = incoming.length + waiting.length + talking.length + introsIn.length + introsOut.length
  // the chat list starts short, but never hides an unread chat behind "ดูเพิ่ม"
  const lastUnread = talking.reduce((at, r, i) => (r.chat.unread > 0 ? i : at), -1)
  const firstChats = Math.max(FIRST_CHATS, lastUnread + 1)

  return (
    <div>
      <PageHeader title={<KineticText text={t('แชท', 'Chats')} />} subtitle={t('คุยกับเพื่อนที่คลื่นตรงกัน', 'Talk with friends on your wavelength')} />

      {!ready ? (
        <ListSkeleton count={3} label={t('กำลังโหลดแชท…', 'Loading chats…')} />
      ) : total === 0 ? (
        <EmptyChats />
      ) : (
        <>
          {introsIn.length > 0 && (
            <Section
              tone="butter"
              icon={<Sparkles size={18} strokeWidth={2.4} />}
              title={t('โมชิอยากแนะนำเพื่อนให้', 'Mochi has someone for you to meet')}
              note={t('ยินดีรู้จักหรือไว้ก่อนก็ได้ ถ้าไว้ก่อน เขาจะไม่รู้นะ', "Say yes or maybe later. If it's later, they won't know")}
            >
              <ShowMore
                items={introsIn}
                initial={2}
                getKey={(i) => i.id}
                listClassName="grid gap-3 md:grid-cols-2"
                itemClassName="min-w-0"
                moreLabel={(n) => t(`ดูคำแนะนำเพิ่ม (อีก ${n})`, `Show more intros (${n} more)`)}
                render={(i, n) => <IncomingIntroCard intro={i} primary={n === 0} />}
              />
            </Section>
          )}

          {incoming.length > 0 && (
            <Section
              tone="mint"
              icon={<MessageCircleHeart size={18} strokeWidth={2.4} />}
              title={t('มีคนทักแชทมา', 'Someone said hi')}
              note={t('ตอบรับหรือไว้ก่อนก็ได้', 'Accept, or maybe later')}
            >
              <motion.div variants={fadeUp} initial="hidden" animate="show">
                <ShowMore
                  items={incoming}
                  initial={FIRST_HELLOS}
                  getKey={(r) => r.chat.id}
                  listClassName="grid gap-3 sm:grid-cols-2"
                  itemClassName="min-w-0"
                  moreLabel={(n) => t(`ดูคำทักเพิ่ม (อีก ${n})`, `Show more hellos (${n} more)`)}
                  render={(r) => <HelloCard row={r} incoming isMine={isMine} />}
                />
              </motion.div>
            </Section>
          )}

          {talking.length > 0 && (
            <Section tone="sky" icon={<MessagesSquare size={18} strokeWidth={2.4} />} title={t('คุยอยู่', 'Chatting')}>
              <motion.div variants={fadeUp} initial="hidden" animate="show">
                <ShowMore
                  items={talking}
                  initial={firstChats}
                  step={FIRST_CHATS}
                  getKey={(r) => r.chat.id}
                  listClassName="card space-y-0.5 overflow-hidden rounded-3xl p-1.5"
                  moreLabel={(n) => t(`ดูแชทเพิ่ม (อีก ${n})`, `Show more chats (${n} more)`)}
                  render={(r) => <ChatRow row={r} isMine={isMine} />}
                />
              </motion.div>
            </Section>
          )}

          {waiting.length > 0 && (
            <Reveal>
              <Section
                tone="peach"
                icon={<Send size={17} strokeWidth={2.4} />}
                title={t('คำทักที่ส่งไป', 'Hellos you sent')}
                note={t('รอเขาตอบรับอยู่', 'Waiting for them to accept')}
              >
                <ShowMore
                  items={waiting}
                  initial={FIRST_HELLOS}
                  getKey={(r) => r.chat.id}
                  listClassName="grid gap-3 sm:grid-cols-2"
                  itemClassName="min-w-0"
                  moreLabel={(n) => t(`ดูคำทักเพิ่ม (อีก ${n})`, `Show more hellos (${n} more)`)}
                  render={(r) => <HelloCard row={r} isMine={isMine} />}
                />
              </Section>
            </Reveal>
          )}

          {introsOut.length > 0 && (
            <Reveal>
              <Section
                tone="lavender"
                icon={<HeartHandshake size={18} strokeWidth={2.4} />}
                title={t('ให้โมชิแนะนำให้', 'Intros Mochi is making')}
                note={t('โมชิไปถามเขาก่อน ถ้ายินดีรู้จัก แชทจะเปิดเอง', "Mochi asks them first. If they'd like to meet, the chat opens by itself")}
              >
                <ShowMore
                  items={introsOut}
                  initial={FIRST_HELLOS}
                  getKey={(i) => i.id}
                  listClassName="grid gap-2.5 sm:grid-cols-2"
                  itemClassName="min-w-0"
                  moreLabel={(n) => t(`ดูเพิ่ม (อีก ${n})`, `Show more (${n} more)`)}
                  render={(i) => <OutgoingIntroRow intro={i} />}
                />
                {introsRanOut && <FindMoreLink />}
              </Section>
            </Reveal>
          )}
        </>
      )}
    </div>
  )
}

function ChatRow({ row: { chat, user: u, match }, isMine }: { row: Row; isMine: IsMine }) {
  const last = lastMessage(chat)
  const unread = chat.unread > 0
  const ended = chatPhase(chat) === 'ended'
  return (
    <MotionLink
      to={`/app/chats/${chat.id}`}
      data-cursor={t('เปิดแชท', 'Open chat')}
      whileTap={{ scale: 0.98 }}
      transition={spring.bouncy}
      className={`flex items-center gap-3 rounded-[1.4rem] p-3 transition-colors hover:bg-cream ${unread ? 'bg-butter/20' : ''}`}
    >
      <Avatar color={u.color} size={54} online={u.isOnline} face={ended ? 'sleepy' : unread ? 'talk' : 'smile'} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-display text-[17px] font-semibold">{u.name}</span>
          {ended ? (
            <span className="shrink-0 rounded-full bg-cream-3 px-2 py-0.5 text-[11px] font-semibold text-ink-soft">{t('ปิดแชทแล้ว', 'Closed')}</span>
          ) : (
            match && <SignalMeter level={match.level} size="xs" showLabel={false} />
          )}
          <span className="ml-auto shrink-0 text-xs text-ink-soft">{known(last?.at)}</span>
        </span>
        <span className="mt-0.5 flex items-center gap-2">
          <span className={`truncate text-sm ${unread ? 'font-semibold text-ink' : 'text-ink-soft'}`}>{previewText(chat, isMine)}</span>
          {unread && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={spring.bouncy}
              className="ml-auto inline-flex h-5.5 min-w-5.5 shrink-0 items-center justify-center rounded-full bg-coral px-1.5 text-xs font-bold text-ink"
            >
              {chat.unread}
              <span className="sr-only">{t(' ข้อความใหม่', chat.unread === 1 ? ' new message' : ' new messages')}</span>
            </motion.span>
          )}
        </span>
      </span>
    </MotionLink>
  )
}

/** A hello still waiting: one we sent, or (incoming) one waiting for our answer. */
function HelloCard({ row: { chat, user: u, match }, incoming = false, isMine }: { row: Row; incoming?: boolean; isMine: IsMine }) {
  const opener = [...chat.messages].reverse().find((m) => (incoming ? m.userId === u.id : isMine(m.userId)))
  const p = MOCHI[u.color]
  return (
    <MotionLink
      to={`/app/chats/${chat.id}`}
      data-cursor={t('เปิดแชท', 'Open chat')}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.97 }}
      transition={spring.bouncy}
      className="card flex h-full flex-col gap-3 rounded-3xl p-4"
    >
      <span className="flex items-center gap-3">
        <span className="relative flex size-14 shrink-0 items-center justify-center">
          <Rings color={p.shade} size={52} count={2} speed={2.2} />
          <Avatar color={u.color} size={50} face={incoming ? 'talk' : 'wow'} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-[17px] font-semibold">{u.name}</span>
          <span className="flex items-center gap-1.5 text-xs text-ink-soft">
            {incoming ? <MessageCircleHeart size={13} aria-hidden /> : <Send size={12} aria-hidden />}
            {incoming ? t('ทักแชทมา แตะเพื่อตอบรับ', 'Said hi. Tap to accept') : t('รอเขาตอบรับ', 'Waiting for them to accept')}
          </span>
        </span>
        {match && <SignalMeter level={match.level} size="xs" showLabel={false} />}
      </span>
      {opener && (
        <span
          className={`line-clamp-2 max-w-full rounded-3xl px-3.5 py-2 text-sm [overflow-wrap:anywhere] text-ink ${
            incoming ? 'self-start rounded-bl-md bg-white shadow-[inset_0_0_0_1px_var(--color-line)]' : 'self-end rounded-br-md bg-peach/50'
          }`}
        >
          {opener.text}
        </span>
      )}
    </MotionLink>
  )
}

function EmptyChats() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.gentle}
      className="card relative mt-4 flex flex-col items-center gap-3 overflow-hidden rounded-3xl px-6 py-12 text-center"
    >
      {/* a dotted squiggle linking two mochi */}
      <div className="relative flex items-end gap-1">
        <Avatar color="peach" size={88} face="wink" />
        <svg width="96" height="40" viewBox="0 0 96 40" aria-hidden className="mb-6 text-ink-faint">
          <path
            d="M2 30c6 0 6-14 12-14s6 14 12 14 6-14 12-14 6 14 12 14 6-14 12-14 6 14 12 14 6-14 12-14"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="4 6"
          />
        </svg>
        <Avatar color="mint" size={72} face="sleepy" />
      </div>
      <h2 className="mt-2 font-display text-2xl font-semibold">{t('ยังไม่มีแชทเลย', 'No chats yet')}</h2>
      <p className="max-w-sm text-ink-soft">
        {t(
          'ลองทักแชทหาคนที่คลื่นตรงกันดูสิ บางทีเขาอาจรอให้ใครสักคนทักอยู่ก็ได้',
          'Try saying hi to someone on your wavelength. They might be waiting for someone to message them.',
        )}
      </p>
      <ButtonLink to="/app/people" size="lg" icon={<Radio size={20} aria-hidden />} className="mt-3">
        {t('ไปหาคนคลื่นเดียวกัน', 'Find people on your wavelength')}
      </ButtonLink>
    </motion.div>
  )
}
