// "ไปด้วย" for an event: saying yes is one tap, taking it back asks first.
import { CalendarHeart, CalendarX } from 'lucide-react'
import { useState } from 'react'
import { Button, Sheet } from '@/components/ui'
import { eventWhenLabel } from '@/lib/events'
import { t } from '@/lib/i18n'
import { useMoshi } from '@/lib/store'
import type { Session } from '@/lib/types'
import { PopToggle } from '@/pages/rooms/bits'

/**
 * RSVP for any number of events on one screen: `toggle(session)` says "ไปด้วย" right away, or
 * opens the "ไม่ไปแล้วเหรอ?" sheet when I'm already going. Render `sheet` once.
 */
export function useRsvp() {
  const going = useMoshi((s) => s.going)
  const toggleGoing = useMoshi((s) => s.toggleGoing)
  const [asking, setAsking] = useState<Session | null>(null)
  const toggle = (s: Session) => (going.includes(s.id) ? setAsking(s) : toggleGoing(s.id))
  const sheet = (
    <UnRsvpSheet
      session={asking}
      onClose={() => setAsking(null)}
      onConfirm={(s) => {
        // the sheet's buttons stay live while it slides away: a second tap must not sign back up
        if (useMoshi.getState().going.includes(s.id)) toggleGoing(s.id)
        setAsking(null)
      }}
    />
  )
  return { toggle, sheet, isGoing: (id: string) => going.includes(id) }
}

/**
 * The squishy "ไปด้วย / ไปแน่!" button. Its name starts with the words on it (voice control), then
 * the event's title. `quiet` in lists and cards; the coral one is for the screen whose focus is the event.
 */
export function RsvpButton({
  session,
  going,
  onToggle,
  size,
  quiet,
  compact,
  className = '',
}: {
  session: Session
  going: boolean
  onToggle: () => void
  size?: 'md' | 'lg'
  quiet?: boolean
  compact?: boolean
  className?: string
}) {
  return (
    <PopToggle
      on={going}
      onToggle={onToggle}
      labelOn={t('ไปแน่!', "I'm in!")}
      labelOff={t('ไปด้วย', "I'm going")}
      iconOff={<CalendarHeart size={17} strokeWidth={2.4} aria-hidden />}
      srExtra={t(` ${session.title}`, `: ${session.title}`)}
      quiet={quiet}
      compact={compact}
      size={size}
      className={className}
    />
  )
}

/** "ไม่ไปแล้วเหรอ?": a stray tap on "ไปแน่!" shouldn't drop an RSVP. */
function UnRsvpSheet({ session, onClose, onConfirm }: { session: Session | null; onClose: () => void; onConfirm: (s: Session) => void }) {
  // keep the last event on screen while the sheet slides away
  const [last, setLast] = useState(session)
  if (session && session !== last) setLast(session)
  const shown = session ?? last
  return (
    <Sheet open={!!session} onClose={onClose} title={t('ไม่ไปอีเวนต์นี้แล้วเหรอ?', 'Not going anymore?')} width={460}>
      {shown && (
        <div className="space-y-4 pb-3">
          <p className="rounded-3xl border border-line bg-white p-3 [overflow-wrap:anywhere] text-ink">
            {t('จะยกเลิกไป ', 'Cancel your RSVP for ')}
            <b className="font-display font-semibold">{shown.title}</b>
            {t(
              ` (${eventWhenLabel(shown.startsAt)}) ใช่ไหม? อยากกลับมากดไปด้วยเมื่อไหร่ก็ได้นะ`,
              ` (${eventWhenLabel(shown.startsAt)})? You can say you're going again anytime`,
            )}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button variant="dark" block icon={<CalendarX size={18} aria-hidden />} onClick={() => onConfirm(shown)}>
              {t('ไม่ไปแล้ว', 'Cancel RSVP')}
            </Button>
            <Button variant="ghost" block onClick={onClose}>
              {t('ยังไปเหมือนเดิม', 'Still going')}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
