// For whoever runs an event (a host of its room, or staff): call it off, or stop a weekly one
// from coming back. Both ask first; what the server says no to shows right in the sheet.
import { motion } from 'motion/react'
import { CalendarX, Loader2, Repeat } from 'lucide-react'
import { useId, useState } from 'react'
import { Button, Sheet } from '@/components/ui'
import { eventPhase, eventWhenLabel } from '@/lib/events'
import { t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import { useMoshi } from '@/lib/store'
import type { Session } from '@/lib/types'
import { ActionRow } from '@/pages/rooms/room/MessageActions'

type Step = 'menu' | 'cancel' | 'stop'

/** What may still be done to this event: cancel it (not over yet), stop its weekly repeat. */
export function manageOptions(s: Session, now = Date.now()) {
  const phase = eventPhase(s, now)
  return { cancel: phase === 'upcoming' || phase === 'open', stop: !!s.repeatsWeekly && !s.cancelled }
}

const FOOTER = 'sticky bottom-0 -mx-5 bg-cream/90 px-5 pt-3 pb-1 backdrop-blur'

/**
 * The manage sheet for one event. `session` null: closed. Opens on a small menu when both
 * actions are possible, straight on the one that is otherwise.
 */
export function ManageEventSheet({ session, onClose }: { session: Session | null; onClose: () => void }) {
  // keep the last event on screen while the sheet slides away; each opening starts fresh (a live
  // update to the same event while it's open doesn't)
  const [last, setLast] = useState(session)
  const [round, setRound] = useState(0)
  const [wasOpen, setWasOpen] = useState(!!session)
  if (!!session !== wasOpen) {
    setWasOpen(!!session)
    if (session) setRound((n) => n + 1)
  }
  if (session && session !== last) setLast(session)
  const shown = session ?? last
  return (
    <Sheet open={!!session} onClose={onClose} title={t('จัดการอีเวนต์', 'Manage event')} width={480}>
      {shown && <Body key={round} session={shown} onClose={onClose} />}
    </Sheet>
  )
}

function Body({ session, onClose }: { session: Session; onClose: () => void }) {
  // what could be done when the sheet opened (the event changes under it once it's cancelled)
  const [can] = useState(() => manageOptions(session))
  const [step, setStep] = useState<Step>(can.cancel && can.stop ? 'menu' : can.cancel ? 'cancel' : 'stop')
  const [alsoStop, setAlsoStop] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const cancelEvent = useMoshi((s) => s.cancelEvent)
  const stopRepeat = useMoshi((s) => s.stopRepeat)
  const notify = useMoshi((s) => s.notify)
  const id = useId()
  const open = eventPhase(session) === 'open'

  const run = async () => {
    if (busy) return
    setBusy(true)
    setProblem(null)
    const cancelling = step === 'cancel'
    const ok = cancelling ? await cancelEvent(session.id, session.repeatsWeekly ? alsoStop : false) : await stopRepeat(session.id)
    setBusy(false)
    if (ok) {
      onClose()
      notify(cancelling ? t('ยกเลิกอีเวนต์แล้ว', 'Event canceled') : t('หยุดทำซ้ำแล้ว รอบนี้ยังอยู่เหมือนเดิม', "It won't repeat anymore. This one stays as it is"))
      return
    }
    // the store said why in a toast, which the sheet would cover: show it here instead
    const said = useMoshi.getState().notice?.text
    useMoshi.getState().clearNotice()
    setProblem(said ?? t('ทำไม่สำเร็จ ลองใหม่อีกทีนะ', "That didn't work. Try again"))
  }

  if (!can.cancel && !can.stop) {
    return (
      <div className="space-y-4 pb-3">
        <p className="text-ink-soft">{t('อีเวนต์นี้จบหรือยกเลิกไปแล้ว ไม่มีอะไรให้เปลี่ยนแล้วนะ', "This event is over or canceled. There's nothing left to change")}</p>
        <Button variant="secondary" block onClick={onClose}>
          {t('ปิด', 'Close')}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <figure className="rounded-3xl border border-line bg-white px-4 py-3 shadow-[var(--shadow-soft)]">
        <figcaption className="text-xs font-semibold text-ink-soft">{eventWhenLabel(session.startsAt)}</figcaption>
        <p className="mt-0.5 font-display text-lg leading-snug font-semibold [overflow-wrap:anywhere] text-ink">{session.title}</p>
      </figure>

      {step === 'menu' && (
        <div className="space-y-2.5">
          <ActionRow
            icon={<CalendarX size={19} strokeWidth={2.4} />}
            tint="bg-coral/25"
            title={t('ยกเลิกอีเวนต์นี้', 'Cancel this event')}
            note={t('ทุกคนที่กดไปด้วยจะเห็นว่ายกเลิกแล้ว', "Everyone who's going will see it's off")}
            onClick={() => setStep('cancel')}
          />
          <ActionRow
            icon={<Repeat size={19} strokeWidth={2.4} />}
            tint="bg-lavender/35"
            title={t('หยุดทำซ้ำทุกสัปดาห์', 'Stop repeating weekly')}
            note={t('รอบนี้ยังอยู่ แต่จะไม่มีรอบใหม่แล้ว', 'This one stays, but no more weeks after it')}
            onClick={() => setStep('stop')}
          />
        </div>
      )}

      {step === 'cancel' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring.soft} className="space-y-3 rounded-3xl bg-white p-4">
          <p id={`${id}-ask`} className="font-display font-semibold text-ink">
            {t('ยกเลิกอีเวนต์นี้จริงๆ ใช่ไหม?', 'Cancel this event?')}
          </p>
          <ul className="space-y-1.5 text-sm text-ink-soft">
            <li>· {t('ทุกคนที่กดไปด้วยจะเห็นว่า “ยกเลิกแล้ว”', 'Everyone going will see “Canceled”')}</li>
            {open && <li>· {t('แชทของอีเวนต์จะปิดทันที คนที่คุยอยู่จะพิมพ์ต่อไม่ได้', "The chat closes right away. People in it can't keep writing")}</li>}
            <li>· {t('ยกเลิกแล้วเปิดกลับไม่ได้ ถ้าเปลี่ยนใจต้องสร้างใหม่นะ', "This can't be undone. If you change your mind, create a new one")}</li>
          </ul>
          {session.repeatsWeekly && (
            <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl bg-cream px-3.5 py-2">
              <input type="checkbox" checked={alsoStop} onChange={(e) => setAlsoStop(e.target.checked)} className="size-[18px] shrink-0 accent-coral-deep" />
              <span className="min-w-0 text-[15px] leading-snug text-ink">
                {t('หยุดทำซ้ำทุกสัปดาห์ด้วย (รอบต่อๆ ไปจะไม่มีแล้ว)', 'Also stop it repeating (no more weeks after this)')}
              </span>
            </label>
          )}
        </motion.div>
      )}

      {step === 'stop' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring.soft} className="space-y-3 rounded-3xl bg-white p-4">
          <p id={`${id}-ask`} className="font-display font-semibold text-ink">
            {t('หยุดทำซ้ำทุกสัปดาห์ไหม?', 'Stop repeating every week?')}
          </p>
          <ul className="space-y-1.5 text-sm text-ink-soft">
            <li>· {t('รอบนี้ยังอยู่เหมือนเดิม', 'This one stays as it is')}</li>
            <li>· {t('รอบสัปดาห์ถัดไปที่ตั้งไว้แล้วจะถูกยกเลิก', "Next week's, already listed, is canceled")}</li>
            <li>· {t('อยากให้กลับมาทุกสัปดาห์อีก สร้างอีเวนต์ใหม่ได้เลย', 'Want it weekly again? Just create a new event')}</li>
          </ul>
        </motion.div>
      )}

      {problem && (
        <p role="alert" className="rounded-2xl bg-butter/45 px-4 py-2.5 text-sm [overflow-wrap:anywhere] text-ink">
          {problem}
        </p>
      )}

      <div className={FOOTER}>
        {step === 'menu' ? (
          <Button variant="ghost" block onClick={onClose}>
            {t('ปิด', 'Close')}
          </Button>
        ) : (
          <div className="flex flex-row-reverse gap-2">
            <Button
              variant="dark"
              className="flex-1"
              disabled={busy}
              aria-busy={busy || undefined}
              icon={busy ? <Loader2 size={18} className="motion-safe:animate-spin" aria-hidden /> : step === 'cancel' ? <CalendarX size={18} aria-hidden /> : <Repeat size={18} aria-hidden />}
              onClick={() => void run()}
            >
              {step === 'cancel' ? t('ยกเลิกอีเวนต์', 'Cancel event') : t('หยุดทำซ้ำ', 'Stop repeating')}
            </Button>
            {/* the safe answer; it carries the question too (iOS VoiceOver skips group names) */}
            <Button
              variant="ghost"
              aria-describedby={`${id}-ask`}
              disabled={busy}
              onClick={() => (can.cancel && can.stop ? setStep('menu') : onClose())}
            >
              {step === 'cancel' ? t('ไม่ยกเลิก', 'Keep it') : t('ไม่ใช่ตอนนี้', 'Not now')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
