// Room info: the room's event when one is open or starts within a day (pinned as a
// compact card), and, for the room's hosts and staff only, a quiet "สร้างอีเวนต์".
import { CalendarPlus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useCanManageEvents, useEvents, useServerFeatures } from '@/data/hooks'
import { eventPhase } from '@/lib/events'
import { t } from '@/lib/i18n'
import { useMoshi } from '@/lib/store'
import type { Room } from '@/lib/types'
import { CreateEventSheet } from '@/pages/events/CreateEvent'
import { EventCard } from '@/pages/events/EventCard'
import { eventPath, liveOrSoon, SOON_MS, useEventsNow } from '@/pages/events/lib'

export function RoomEventPin({ room }: { room: Room }) {
  const events = useEvents({ roomId: room.id })
  const now = useEventsNow(events)
  const pinned = liveOrSoon(events, now, SOON_MS)[0]
  const features = useServerFeatures()
  const canCreate = useCanManageEvents(room.id) && features.events
  const notify = useMoshi((s) => s.notify)
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)

  if (!pinned && !canCreate) return null

  const create = (
    <button
      type="button"
      onClick={() => setCreating(true)}
      aria-haspopup="dialog"
      className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink"
    >
      <CalendarPlus size={16} strokeWidth={2.4} aria-hidden />
      {t('สร้างอีเวนต์', 'Create event')}
    </button>
  )

  return (
    <div className="mt-3">
      {pinned ? (
        <EventCard
          session={pinned}
          variant="compact"
          showRoom={false}
          eyebrow={eventPhase(pinned, now) === 'open' ? t('อีเวนต์ของห้องนี้ เปิดอยู่ตอนนี้', 'This room’s event is open now') : t('อีเวนต์ถัดไปของห้องนี้', 'Next event in this room')}
        />
      ) : (
        <p className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-[1.5rem] border-2 border-dashed border-line px-4 py-1.5 text-sm text-ink-soft">
          <span className="py-2">{t('ยังไม่มีอีเวนต์เร็วๆ นี้ในห้องนี้', 'No events coming up in this room')}</span>
          {create}
        </p>
      )}
      {pinned && canCreate && <div className="mt-1 flex justify-end">{create}</div>}
      {canCreate && (
        <CreateEventSheet
          open={creating}
          onClose={() => setCreating(false)}
          roomId={room.id}
          onCreated={(id) => {
            setCreating(false)
            notify(t('สร้างอีเวนต์แล้ว!', 'Event created!'))
            navigate(eventPath(id))
          }}
        />
      )}
    </div>
  )
}
