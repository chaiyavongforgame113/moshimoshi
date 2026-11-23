import { Bell, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ButtonLink, IconButton, Sheet } from '@/components/ui'
import { useDataReady, useEvents } from '@/data/hooks'
import { eventPhase, eventWhenLabel } from '@/lib/events'
import { t } from '@/lib/i18n'
import { useMoshi } from '@/lib/store'
import { liveOrSoon, useEventHref, useEventsNow } from '@/pages/events/lib'

export function EventNotifications() {
  const [open, setOpen] = useState(false)
  const ready = useDataReady()
  const sessions = useEvents()
  const going = useMoshi((s) => s.going)
  const saved = useMemo(() => sessions.filter((session) => going.includes(session.id)), [sessions, going])
  const now = useEventsNow(saved)
  const events = liveOrSoon(saved, now)
  const href = useEventHref()
  const close = () => setOpen(false)

  return (
    <>
      <IconButton className="relative" label={t('การแจ้งเตือนอีเวนต์', 'Event notifications')} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Bell size={19} aria-hidden />
        {events.length > 0 && <span aria-hidden className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-coral ring-2 ring-white" />}
      </IconButton>
      <Sheet open={open} onClose={close} title={t('อีเวนต์ของเรา', 'Your events')} width={400}>
        {events.length > 0 ? (
          <ul className="divide-y divide-line">
            {events.map((session) => (
              <li key={session.id}>
                <Link to={href(session, now)} onClick={close} className="flex min-h-12 items-center gap-3 rounded-xl px-1 py-3 hover:bg-white/70">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink">{session.title}</span>
                    <span className="block text-sm text-ink-soft">
                      {eventPhase(session, now) === 'open' ? t('เปิดแล้ว เข้าไปได้เลย', 'Live now · Join event') : eventWhenLabel(session.startsAt, now)}
                    </span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-ink-soft" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-soft">
            {ready ? t('ยังไม่มีอีเวนต์ที่เราจะไป', 'You have no upcoming events yet.') : t('กำลังโหลดอีเวนต์…', 'Loading events…')}
          </p>
        )}
        <ButtonLink to="/app/rooms?tab=my-events" onClick={close} variant="secondary" block className="mt-4">
          {t('ดูอีเวนต์ของเรา', 'See my events')}
        </ButtonLink>
      </Sheet>
    </>
  )
}
