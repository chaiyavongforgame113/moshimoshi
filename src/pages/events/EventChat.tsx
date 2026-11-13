// An event's chat: the same bubbles, ⋯ sheet, composer and dock as a room's chat. People write
// only while the event is open (the server holds the clock too); afterwards the dock turns into
// a read-only note, and 24 hours after the end the thread is gone.
import { motion, useReducedMotion } from 'motion/react'
import { DoorOpen, Hand, LockKeyhole, MessagesSquare } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Avatar, ButtonLink, Zone } from '@/components/ui'
import { useEventHistoryReady, useEventMessages, usePeople, useServerFeatures } from '@/data/hooks'
import { EVENT_CHAT_KEEP_MS, EVENT_LIMITS, EVENT_REFUSALS, eventChatVisible, formatSpan } from '@/lib/events'
import { useIsDesktop } from '@/lib/hooks'
import { getLang, t, tx } from '@/lib/i18n'
import { fadeUp, stagger } from '@/lib/motion'
import { useMoshi } from '@/lib/store'
import type { EventPhase, MochiColor, Room, Session } from '@/lib/types'
import { useIsMine } from '@/pages/people/lib'
import { Bone } from '@/pages/people/Skeleton'
import { MyBubble, TheirBubble } from '@/pages/rooms/room/Bubbles'
import { ChatDock, Composer } from '@/pages/rooms/room/Composer'
import { MessageSheet, type MessageTarget, type ReportMessage } from '@/pages/rooms/room/MessageActions'

// quick lines I send as myself, so they're in my language
const IDEAS = {
  th: ['มาแล้ว! สวัสดีทุกคน', 'มาครั้งแรก ฝากตัวด้วยนะ', 'วันนี้ทุกคนเป็นยังไงกันบ้าง'],
  en: ["I'm here! Hi everyone", 'First time here, nice to meet you all', "How's everyone doing today?"],
}

export function EventChat({ session, room, phase, now }: { session: Session; room?: Room; phase: EventPhase; now: number }) {
  const features = useServerFeatures()
  const tone: MochiColor = room?.color ?? 'lavender'
  const visible = eventChatVisible(session, now)
  const open = phase === 'open'
  const keepFor = Date.parse(session.endsAt) + EVENT_CHAT_KEEP_MS - now

  if (!features.events) {
    return (
      <Zone tone={tone} title={t('แชทอีเวนต์', 'Event chat')} icon={<MessagesSquare size={18} strokeWidth={2.4} />} className="mt-5">
        <Note
          face="wink"
          color={tone}
          title={t('แชทอีเวนต์กำลังจะมาเร็วๆ นี้', 'Event chats are coming soon')}
          body={t('ระหว่างนี้ไปคุยกันในห้องก่อนได้เลยนะ', 'Meanwhile, the room chat is open')}
        >
          {room && (
            <ButtonLink to={`/app/rooms/${room.id}`} icon={<DoorOpen size={18} strokeWidth={2.4} aria-hidden />} className="mt-4">
              {t('ไปคุยในห้อง', 'Chat in the room')}
            </ButtonLink>
          )}
        </Note>
      </Zone>
    )
  }

  if (!visible) {
    return (
      <Zone tone="cream" title={t('แชทอีเวนต์', 'Event chat')} icon={<LockKeyhole size={18} strokeWidth={2.4} />} className="mt-5">
        <Note
          face="sleepy"
          color="cream"
          title={t('แชทของอีเวนต์นี้ปิดแล้ว', "This event's chat has closed")}
          body={t('แชทอีเวนต์อ่านย้อนหลังได้ 24 ชั่วโมงหลังจบ แล้วจะเก็บไปนะ', 'Event chats stay readable for 24 hours after the end, then they’re put away')}
        />
      </Zone>
    )
  }

  return (
    <Zone
      tone={tone}
      className="mt-5"
      icon={<MessagesSquare size={18} strokeWidth={2.4} />}
      title={open ? t('คุยกันในอีเวนต์', 'Event chat') : t('แชทของอีเวนต์', 'Event chat')}
      note={
        open
          ? t('ทุกคนที่มาอีเวนต์เห็นข้อความเดียวกัน', 'Everyone at the event sees the same chat')
          : t(`อ่านได้อย่างเดียว · ปิดแชทในอีก ${formatSpan(keepFor)}`, `Read-only · closes in ${formatSpan(keepFor)}`)
      }
    >
      <Thread session={session} room={room} open={open} />
    </Zone>
  )
}

/** The lines themselves, then the composer (open) or the read-only note (over). */
function Thread({ session, room, open }: { session: Session; room?: Room; open: boolean }) {
  const desktop = useIsDesktop()
  const reduce = useReducedMotion()
  const messages = useEventMessages(session.id)
  const ready = useEventHistoryReady(session.id)
  const people = usePeople()
  const byId = useMemo(() => new Map(people.map((u) => [u.id, u])), [people])
  const me = useMoshi((s) => s.me)
  const isMine = useIsMine()
  const send = useMoshi((s) => s.sendEventMessage)
  const reportUser = useMoshi((s) => s.reportUser)
  const notify = useMoshi((s) => s.notify)
  const hostIds = room?.hostIds ?? []
  const saidSomething = messages.some((m) => isMine(m.userId))

  const endRef = useRef<HTMLDivElement>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const prevCount = useRef(messages.length)
  const settled = useRef(ready)

  // ⋯ on someone else's line: one sheet for the whole chat
  const [acting, setActing] = useState<MessageTarget | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  const sheetOpen = useRef(false)
  const closeActions = () => {
    sheetOpen.current = false
    setActing(null)
    // back to the ⋯ that opened it; after a block their lines (and that ⋯) are gone, so the chat itself
    requestAnimationFrame(() => {
      const el = opener.current
      if (el?.isConnected) el.focus()
      else logRef.current?.focus({ preventScroll: true })
    })
  }

  // event lines have no report column of their own yet: the report goes about the person, quoting the line
  const report: ReportMessage = (m, reason, details) => {
    const quote = `ข้อความในอีเวนต์ "${session.title}": "${m.text}"`
    reportUser(m.userId, reason, [quote, details].filter(Boolean).join('\n').slice(0, 2000))
    notify(t('ส่งรายงานแล้ว ทีมงานจะดูให้เร็วที่สุดนะ', 'Report sent. The team will look at it soon'))
  }

  // follow the conversation when something new arrives (not on first paint or when the history lands)
  useEffect(() => {
    if (!settled.current) {
      settled.current = ready
      prevCount.current = messages.length
      return
    }
    const grew = messages.length > prevCount.current
    prevCount.current = messages.length
    if (grew && !sheetOpen.current) endRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'end' })
  }, [messages.length, reduce, ready])

  return (
    <section aria-label={t(`แชทอีเวนต์ ${session.title}`, `${session.title} chat`)}>
      <div ref={logRef} role="log" tabIndex={-1} aria-label={t('ข้อความในอีเวนต์', 'Event messages')} className="outline-none">
        <motion.ol variants={stagger(0.04)} initial="hidden" animate="show" className="flex flex-col">
          {!ready && (
            <li role="status" className="flex flex-col gap-4">
              <span className="sr-only">{t('กำลังโหลดข้อความ…', 'Loading messages…')}</span>
              {['w-3/5', 'w-2/5', 'w-1/2'].map((w) => (
                <span key={w} aria-hidden className="flex items-start gap-2.5">
                  <Bone className="size-9 shrink-0" />
                  <span className={`flex flex-col gap-2 ${w}`}>
                    <Bone className="h-3 w-1/3" />
                    <Bone className="h-10 w-full" />
                  </span>
                </span>
              ))}
            </li>
          )}
          {ready && messages.length === 0 && (
            <motion.li variants={fadeUp}>
              <Note
                face={open ? 'wink' : 'sleepy'}
                color="butter"
                title={open ? t('ยังไม่มีใครพิมพ์เลย', 'Nobody has said anything yet') : t('อีเวนต์นี้ไม่มีใครพิมพ์ไว้', 'Nobody wrote in this event')}
                body={open ? t('ทักทายเป็นคนแรกเลยนะ ช่องพิมพ์อยู่ด้านล่าง', 'Be the first to say hi. The message box is just below') : undefined}
                icon={open ? <Hand size={18} strokeWidth={2.4} /> : undefined}
              />
            </motion.li>
          )}
          {messages.map((m, i) => {
            const prev = messages[i - 1]
            if (m.kind === 'system') {
              return (
                <motion.li key={m.localId ?? m.id} variants={fadeUp} className="my-3 text-center">
                  <span className="inline-block rounded-full bg-white/70 px-3 py-1 text-xs text-ink-soft">{m.text}</span>
                </motion.li>
              )
            }
            const head = !prev || prev.userId !== m.userId || prev.kind === 'system'
            const author = byId.get(m.userId)
            return (
              <motion.li key={m.localId ?? m.id} variants={fadeUp} className={head ? 'mt-4 first:mt-0' : 'mt-1.5'}>
                {isMine(m.userId) ? (
                  <MyBubble message={m} me={me} />
                ) : (
                  <TheirBubble
                    message={m}
                    author={author}
                    byId={byId}
                    hostIds={hostIds}
                    head={head}
                    me={me}
                    unknownName={t('คนในอีเวนต์', 'Event guest')}
                    // reactions on event lines don't reach the author yet, so there's no "เหมือนกัน!" here
                    onMore={
                      m.userId && m.userId !== 'system'
                        ? (el) => {
                            opener.current = el
                            sheetOpen.current = true
                            setActing({ message: m, name: author?.name, color: author?.color ?? 'cream' })
                          }
                        : undefined
                    }
                  />
                )}
              </motion.li>
            )
          })}
        </motion.ol>
      </div>
      {/* phones: room for the dock and the bottom nav below the newest line */}
      <div ref={endRef} className="h-px scroll-mb-[calc(14rem+env(safe-area-inset-bottom))] lg:scroll-mb-32" />

      {open ? (
        <Composer
          roomName={session.title}
          label={t(`พิมพ์ข้อความในอีเวนต์ ${session.title}`, `Message ${session.title}`)}
          placeholder={t('พิมพ์คุยกับทุกคนในอีเวนต์…', 'Say something to everyone here…')}
          maxLength={EVENT_LIMITS.messageMax}
          onSend={(text) => send(session.id, text)}
          suggestions={saidSomething ? [] : IDEAS[getLang()]}
          ideasTitle={t('ไอเดียทักทาย', 'Ways to say hi')}
          desktop={desktop}
        />
      ) : (
        <ChatDock desktop={desktop}>
          <p className="flex items-center gap-3 px-4 py-3 text-sm text-ink" role="note">
            <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-2xl bg-cream-3 text-ink">
              <LockKeyhole size={17} strokeWidth={2.4} />
            </span>
            <span className="min-w-0">{tx(EVENT_REFUSALS.closed)}</span>
          </p>
        </ChatDock>
      )}
      <MessageSheet target={acting} onClose={closeActions} onReport={report} />
    </section>
  )
}

/** A calm note with Little Mochi: why nothing's here, and at most one next step (children). */
export function Note({
  title,
  body,
  face,
  color,
  icon,
  children,
}: {
  title: string
  body?: string
  face: 'wink' | 'sleepy' | 'happy' | 'smile' | 'wow'
  color: MochiColor
  icon?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-3 py-6 text-center">
      <span className="relative inline-flex">
        <Avatar color={color} size={72} face={face} />
        {icon && (
          <span aria-hidden className="absolute -top-1 -right-3 flex size-9 items-center justify-center rounded-full bg-white text-ink shadow-[var(--shadow-soft)]">
            {icon}
          </span>
        )}
      </span>
      <p className="mt-3 font-display text-lg leading-snug font-semibold [overflow-wrap:anywhere] text-ink">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm [overflow-wrap:anywhere] text-ink-soft">{body}</p>}
      {children}
    </div>
  )
}
