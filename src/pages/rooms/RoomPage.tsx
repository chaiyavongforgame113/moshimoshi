import { motion } from 'motion/react'
import { ChevronLeft, DoorClosed, Info } from 'lucide-react'
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { Avatar, ButtonLink, IconButton, RoomIcon } from '@/components/ui'
import { useDataReady, useRoom, useRoomHistoryReady, useRoomWatch } from '@/data/hooks'
import { useIsWide } from '@/lib/hooks'
import { t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import { useMoshi } from '@/lib/store'
import type { Room } from '@/lib/types'
import { PageSkeleton } from '@/pages/people/Skeleton'
import { ChatTab } from './room/ChatTab'
import type { Draft } from './room/Composer'
import { useRoomToggle } from './LeaveRoom'
import { RoomEventPin } from './room/RoomEvents'
import { RoomHero } from './room/RoomHero'
import { useRoomChat } from './room/useRoomChat'
import { StartWatchSheet } from './watch/StartWatchSheet'
import { WatchEntry } from './watch/WatchBits'
import { WatchPanel } from './watch/WatchPanel'

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
  const hasLegacyTab = params.has('tab')
  const joined = useMoshi((s) => s.me.rooms.includes(room.id))
  const { toggle, sheet } = useRoomToggle()
  const chat = useRoomChat(room)
  const historyReady = useRoomHistoryReady(room.id)
  // a hello tapped before joining (the server only takes room messages from members): it waits on
  // the chat's join panel, then in the composer
  const [draft, setDraft] = useState<Draft | null>(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const infoId = useId()
  const infoRef = useRef<HTMLDivElement>(null)
  // Watching a clip puts the player at the top, beside the chat from 1280px.
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

  useEffect(() => {
    if (infoOpen) infoRef.current?.scrollIntoView({ block: 'start' })
  }, [infoOpen])

  // after the composer that replaced the join panel has picked it up
  useEffect(() => {
    if (joined) setDraft(null)
  }, [joined])

  useEffect(() => {
    if (!hasLegacyTab) return
    setParams((p) => {
      p.delete('tab')
      return p
    }, { replace: true, preventScrollReset: true })
  }, [hasLegacyTab, setParams])

  const conversation = (
    <ChatTab
      room={room}
      messages={chat.messages}
      mine={chat.mine}
      typing={chat.typing}
      onSend={chat.send}
      onJoin={() => toggle(room)}
      draft={draft}
      onDraft={setDraft}
      loading={!historyReady}
      watch={watching ? watch.watch : null}
      ideas={!watching || wide}
    />
  )

  return (
    <div className="flex min-h-[calc(100dvh-7.5rem-env(safe-area-inset-bottom))] flex-col lg:min-h-[calc(100dvh-4rem)]" style={{ '--room-bar': `${barHeight}px` } as CSSProperties}>
      <RoomTopBar
        room={room}
        barRef={barRef}
        solid={watching}
        actions={
          <>
            <IconButton
              label={t('ข้อมูลห้อง', 'Room info')}
              aria-expanded={infoOpen}
              aria-controls={infoId}
              variant={infoOpen ? 'soft' : 'secondary'}
              onClick={() => setInfoOpen((open) => !open)}
            >
              <Info size={20} aria-hidden />
            </IconButton>
            {watch.enabled && watch.canStart && !watch.watch && <WatchEntry onClick={() => setPicking(true)} />}
          </>
        }
      />
      <div id={infoId} ref={infoRef} hidden={!infoOpen} className="mb-4 scroll-mt-[calc(var(--room-bar)+0.5rem)]">
        {infoOpen && (
          <>
            <RoomHero room={room} joined={joined} onToggleJoin={() => toggle(room)} still={watching} />
            <RoomEventPin room={room} />
          </>
        )}
      </div>
      {/* phones and tablets: straight under the top bar, sticking there while the chat scrolls */}
      {watching && !wide && <WatchPanel room={room} view={watch} onPick={() => setPicking(true)} />}
      {sheet}

      {watching && wide ? (
        // 1280px and up: the video (about 64%) beside the chat
        <div className="mt-6 grid flex-1 grid-cols-[minmax(480px,1.8fr)_minmax(0,1fr)] gap-4">
          <div className="sticky top-[calc(var(--room-bar)+0.5rem)] self-start">
            <WatchPanel room={room} view={watch} wide onPick={() => setPicking(true)} />
          </div>
          <div className="flex min-w-0 flex-col">{conversation}</div>
        </div>
      ) : (
        <div className={`flex flex-1 flex-col ${watching ? 'mt-4' : ''}`}>{conversation}</div>
      )}
      <StartWatchSheet roomId={room.id} open={picking} onClose={() => setPicking(false)} current={watch.canControl ? watch.watch : null} />
    </div>
  )
}

/** The compact, sticky room header. */
function RoomTopBar({
  room,
  barRef,
  solid = false,
  actions,
}: {
  room: Room
  barRef: RefObject<HTMLDivElement | null>
  /** always a solid bar (a video sticks right under it) */
  solid?: boolean
  actions: ReactNode
}) {
  const navigate = useNavigate()

  const back = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate('/app/rooms')
  }

  return (
    <div
      ref={barRef}
      className={`safe-top sticky top-0 z-30 -mx-4 mb-3 flex items-center gap-2 px-4 pb-2 lg:mx-0 lg:rounded-b-3xl lg:px-2 lg:pt-6 ${
        solid ? 'bg-cream' : 'bg-cream/80 backdrop-blur-xl'
      }`}
    >
      <IconButton label={t('ย้อนกลับ', 'Back')} onClick={back}>
        <ChevronLeft size={22} />
      </IconButton>
      <span className="hidden shrink-0 sm:inline-flex"><RoomIcon room={room} size={34} /></span>
      <h1 className="min-w-0 flex-1 truncate font-display text-lg font-semibold">{room.name}</h1>
      <div className="flex shrink-0 items-center gap-2">{actions}</div>
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
