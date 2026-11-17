import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronLeft, DoorClosed, MessageCircleQuestion, MessagesSquare, Search, Users } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { Avatar, ButtonLink, IconButton, RoomIcon, tabId, tabPanelId, Tabs, Zone, type TabItem } from '@/components/ui'
import { useDataReady, useIntents, useRoom, useRoomHistoryReady, useRoomWatch } from '@/data/hooks'
import { flags } from '@/lib/flags'
import { useIsWide } from '@/lib/hooks'
import { t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import { useMoshi } from '@/lib/store'
import type { Room, User } from '@/lib/types'
import { PageSkeleton } from '@/pages/people/Skeleton'
import { ChatTab } from './room/ChatTab'
import type { Draft } from './room/Composer'
import { useRoomToggle } from './LeaveRoom'
import { IntentsTab } from './room/IntentsTab'
import { MembersTab } from './room/MembersTab'
import { QuestionTab } from './room/QuestionTab'
import { RoomEventPin } from './room/RoomEvents'
import { RoomHero } from './room/RoomHero'
import { useRoomChat } from './room/useRoomChat'
import { StartWatchSheet } from './watch/StartWatchSheet'
import { WatchEntry } from './watch/WatchBits'
import { WatchPanel } from './watch/WatchPanel'

type RoomTab = 'chat' | 'question' | 'looking' | 'people'
// "คำถามวันนี้" is switched off (flags.dailyQuestion): without its key, ?tab=question lands on the chat
const TAB_KEYS: RoomTab[] = (['chat', 'question', 'looking', 'people'] as RoomTab[]).filter((k) => k !== 'question' || flags.dailyQuestion)

export default function RoomPage() {
  const { roomId = '' } = useParams()
  const ready = useDataReady()
  const room = useRoom(roomId)
  if (!room && !ready) return <PageSkeleton label={t('กำลังเปิดห้อง…', 'Opening the room…')} />
  if (!room) return <RoomNotFound />
  return <RoomView key={room.id} room={room} />
}

function RoomView({ room }: { room: Room }) {
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab') as RoomTab | null
  const tab: RoomTab = raw && TAB_KEYS.includes(raw) ? raw : 'chat'
  const joined = useMoshi((s) => s.me.rooms.includes(room.id))
  const { toggle, sheet } = useRoomToggle()
  const lookingCount = useIntents({ roomId: room.id }).length
  const chat = useRoomChat(room)
  const historyReady = useRoomHistoryReady(room.id)
  const [jump, setJump] = useState(false)
  // a hello tapped before joining (the server only takes room messages from members): it waits on
  // the chat's join panel, then in the composer
  const [draft, setDraft] = useState<Draft | null>(null)
  const reduce = useReducedMotion()
  const heroRef = useRef<HTMLElement>(null)
  const tabsRef = useRef<HTMLDivElement>(null)
  // watching a clip together: the player at the top (beside the chat from 1280px), no 3D in the hero
  const watch = useRoomWatch(room.id)
  const watching = watch.enabled && !!watch.watch
  const wide = useIsWide()
  const [picking, setPicking] = useState(false)
  // the top bar's height: the player sticks right under it
  const barRef = useRef<HTMLDivElement>(null)
  const [barHeight, setBarHeight] = useState(0)
  useEffect(() => {
    const el = barRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setBarHeight(el.offsetHeight))
    ro.observe(el)
    setBarHeight(el.offsetHeight)
    return () => ro.disconnect()
  }, [])

  // after the composer that replaced the join panel has picked it up
  useEffect(() => {
    if (joined) setDraft(null)
  }, [joined])

  // an old link or a tab that's switched off (?tab=question): tidy the address back to the chat
  useEffect(() => {
    if (raw && !TAB_KEYS.includes(raw)) setParams({}, { replace: true, preventScrollReset: true })
  }, [raw, setParams])

  const tabs: TabItem<RoomTab>[] = [
    { key: 'chat' as const, label: t('คุยกัน', 'Chat'), icon: <MessagesSquare size={16} strokeWidth={2.4} /> },
    { key: 'question' as const, label: t('คำถามวันนี้', 'Question'), icon: <MessageCircleQuestion size={16} strokeWidth={2.4} /> },
    { key: 'looking' as const, label: t('หาเพื่อน', 'Find friends'), icon: <Search size={16} strokeWidth={2.4} />, badge: lookingCount },
    { key: 'people' as const, label: t('คน', 'People'), icon: <Users size={16} strokeWidth={2.4} /> },
  ].filter((item) => TAB_KEYS.includes(item.key))

  const goTab = (k: RoomTab, opts: { jumpToEnd?: boolean } = {}) => {
    setJump(!!opts.jumpToEnd)
    // a waiting hello belongs to this visit to the chat only
    setDraft(null)
    setParams(k === 'chat' ? {} : { tab: k }, { replace: true, preventScrollReset: true })
  }

  /** From a tab further down: bring the tab bar back into view so the switch is visible. */
  const goTabAndShow = (k: RoomTab) => {
    goTab(k)
    tabsRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  const greetMember = (u: User) => {
    const text = t(`@${u.name} สวัสดี!`, `@${u.name} hi!`)
    if (joined) chat.send(text, u.id)
    goTab('chat', { jumpToEnd: true })
    // not in the room yet: the chat's join panel holds it (set after goTab, which clears it)
    if (!joined) setDraft({ text, to: u.name })
  }

  const zone = (
    <Zone
      tone={room.color}
      // beside the player the chat's column is narrow: a slimmer frame
      className={watching && wide ? '[--zone-pad:0.75rem]' : 'mt-6'}
      head={
        <div ref={tabsRef} className="min-w-0 flex-1 scroll-mt-24 lg:scroll-mt-8">
          <Tabs items={tabs} value={tab} onChange={(k) => goTab(k)} idBase="room" className="w-fit max-w-full" />
        </div>
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          role="tabpanel"
          id={tabPanelId('room', tab)}
          aria-labelledby={tabId('room', tab)}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6, transition: { duration: 0.14 } }}
          transition={spring.soft}
        >
          {tab === 'chat' && <RoomEventPin room={room} />}
          {tab === 'chat' && (
            <ChatTab
              room={room}
              messages={chat.messages}
              mine={chat.mine}
              typing={chat.typing}
              seeded={chat.seeded}
              onSend={chat.send}
              onOpenQuestion={() => goTabAndShow('question')}
              onJoin={() => toggle(room)}
              draft={draft}
              onDraft={setDraft}
              jump={jump}
              loading={!historyReady}
              watch={watching ? watch.watch : null}
              // the ideas list opens upward, over the sticky player on phones and tablets
              ideas={!watching || wide}
            />
          )}
          {flags.dailyQuestion && tab === 'question' && <QuestionTab room={room} />}
          {tab === 'looking' && <IntentsTab room={room} />}
          {tab === 'people' && <MembersTab room={room} onGreet={greetMember} />}
        </motion.div>
      </AnimatePresence>
    </Zone>
  )

  return (
    <div className="pb-4" style={{ '--room-bar': `${barHeight}px` } as CSSProperties}>
      <RoomTopBar
        room={room}
        heroRef={heroRef}
        barRef={barRef}
        solid={watching}
        action={watch.enabled && watch.canStart && !watch.watch ? <WatchEntry onClick={() => setPicking(true)} /> : undefined}
      />
      {/* phones and tablets: straight under the top bar, sticking there while the chat scrolls */}
      {watching && !wide && <WatchPanel room={room} view={watch} onPick={() => setPicking(true)} />}
      <div className={watching && !wide ? 'mt-5' : ''}>
        <RoomHero ref={heroRef} room={room} joined={joined} onToggleJoin={() => toggle(room)} still={watching} />
      </div>
      {sheet}

      {watching && wide ? (
        // 1280px and up: the video (about 64%) beside the chat
        <div className="mt-6 grid grid-cols-[minmax(480px,1.8fr)_minmax(0,1fr)] items-start gap-4">
          <div className="sticky top-[calc(var(--room-bar)+0.5rem)]">
            <WatchPanel room={room} view={watch} wide onPick={() => setPicking(true)} />
          </div>
          {zone}
        </div>
      ) : (
        zone
      )}
      <StartWatchSheet roomId={room.id} open={picking} onClose={() => setPicking(false)} current={watch.canControl ? watch.watch : null} />
    </div>
  )
}

/** Back button; the room name slides in once the hero scrolls away. */
function RoomTopBar({
  room,
  heroRef,
  barRef,
  solid = false,
  action,
}: {
  room: Room
  heroRef: RefObject<HTMLElement | null>
  barRef: RefObject<HTMLDivElement | null>
  /** always a solid bar (a video sticks right under it) */
  solid?: boolean
  /** at the far end of the bar */
  action?: ReactNode
}) {
  const navigate = useNavigate()
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    const el = heroRef.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), { rootMargin: '-96px 0px 0px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [heroRef])

  const back = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate('/app/rooms')
  }

  return (
    <div
      ref={barRef}
      className={`safe-top sticky top-0 z-30 -mx-4 mb-3 flex items-center gap-3 px-4 pb-2 transition-[background-color,backdrop-filter] duration-300 lg:mx-0 lg:rounded-b-3xl lg:px-2 lg:pt-6 ${
        solid ? 'bg-cream' : stuck ? 'bg-cream/80 backdrop-blur-xl' : 'bg-transparent'
      }`}
    >
      <IconButton label={t('ย้อนกลับ', 'Back')} onClick={back}>
        <ChevronLeft size={22} />
      </IconButton>
      <AnimatePresence>
        {stuck && (
          <motion.div
            className="flex min-w-0 items-center gap-2.5"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={spring.soft}
          >
            <RoomIcon room={room} size={34} />
            <span className="truncate font-display text-lg font-semibold">{room.name}</span>
          </motion.div>
        )}
      </AnimatePresence>
      {action}
    </div>
  )
}

function RoomNotFound() {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center px-4 py-12 text-center">
      <div className="relative">
        <motion.span
          className="inline-flex"
          initial={{ rotate: -8, y: 10, opacity: 0 }}
          animate={{ rotate: 0, y: 0, opacity: 1 }}
          transition={spring.bouncy}
        >
          <Avatar color="lavender" size={120} face="sleepy" />
        </motion.span>
        <motion.span
          className="absolute -top-2 -right-6 flex size-12 items-center justify-center rounded-full bg-white shadow-[var(--shadow-soft)]"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ ...spring.bouncy, delay: 0.25 }}
          aria-hidden
        >
          <DoorClosed size={22} strokeWidth={2.4} />
        </motion.span>
      </div>
      <h1 className="mt-5 font-display text-2xl font-semibold">{t('ก๊อกๆ? …ไม่เจอห้องนี้เลย', "Knock knock? …this room isn't here")}</h1>
      <p className="mt-2 max-w-sm text-ink-soft">
        {t(
          'ห้องนี้อาจย้ายไปแล้ว หรือลิงก์พิมพ์ผิดไปนิดนึง ไม่เป็นไรนะ ยังมีห้องอื่นรอเราอยู่',
          'This room may have moved, or the link has a tiny typo. No worries, other rooms are waiting for you',
        )}
      </p>
      <ButtonLink to="/app/rooms" className="mt-6" icon={<ChevronLeft size={18} strokeWidth={2.6} />}>
        {t('กลับไปดูห้องทั้งหมด', 'Back to all rooms')}
      </ButtonLink>
    </div>
  )
}
