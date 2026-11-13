// "สร้างอีเวนต์": one question at a time (the shared Wizard) inside a sheet. Staff pick the room;
// a room's host creates from that room, so the room is already known. Times are Bangkok time.
import { motion } from 'motion/react'
import { CalendarCheck, CalendarDays, Clock, Repeat, Zap } from 'lucide-react'
import { useEffect, useId, useState, type ReactNode } from 'react'
import { Button, Chip, RoomIcon, Sheet, Wizard, type WizardStep } from '@/components/ui'
import { useRooms } from '@/data/hooks'
import { MOCHI } from '@/lib/colors'
import { checkEventDraft, EVENT_DRAFT_ISSUES, EVENT_LIMITS, eventDraftIssueText, type EventDraftIssue } from '@/lib/events'
import { useNow } from '@/lib/hooks'
import { getLang, t, tx } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import { useMoshi } from '@/lib/store'
import type { EventDraft, Room } from '@/lib/types'
import { durationLabel } from './lib'

const MIN = 60_000
const DAY = 86_400_000
const BKK = 7 * 3_600_000
const DAYS_SHOWN = 7
const TIMES = ['18:00', '19:00', '20:00', '21:00', '22:00']
const DURATIONS = [30, 60, 90, 120]

const TH_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์']
const EN_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad = (n: number) => String(n).padStart(2, '0')

/** Bangkok calendar day number of a moment (days since 1970 there) */
const bkkDay = (ms: number) => Math.floor((ms + BKK) / DAY)
/** 'YYYY-MM-DD' of a Bangkok day number (for the date field) */
const isoDay = (day: number) => {
  const d = new Date(day * DAY)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}
const dayOfIso = (value: string) => {
  const [y, m, d] = value.split('-').map(Number)
  return y && m && d ? Math.floor(Date.UTC(y, m - 1, d) / DAY) : undefined
}

/** "วันนี้", "พรุ่งนี้", "ศุกร์ 21" (English: Today, Tomorrow, Fri 21) */
function dayChip(day: number, today: number): string {
  if (day === today) return t('วันนี้', 'Today')
  if (day === today + 1) return t('พรุ่งนี้', 'Tomorrow')
  const d = new Date(day * DAY)
  return getLang() === 'en' ? `${EN_DAYS[d.getUTCDay()]} ${d.getUTCDate()}` : `${TH_DAYS[d.getUTCDay()]} ${d.getUTCDate()}`
}

/** "ทุกวันศุกร์ 21:00" for the weekly answer */
function weeklyLabel(start: number): string {
  const d = new Date(start + BKK)
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
  return getLang() === 'en' ? `Every ${EN_DAYS[d.getUTCDay()]} at ${time}` : `ทุกวัน${TH_DAYS[d.getUTCDay()]} ${time}`
}

/** "ศุกร์ 21 พ.ย." */
function longDay(day: number): string {
  const d = new Date(day * DAY)
  return getLang() === 'en'
    ? `${EN_DAYS[d.getUTCDay()]}, ${EN_MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`
    : `${TH_DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${TH_MONTHS[d.getUTCMonth()]}`
}

/** "เริ่มวันนี้ 21:00", "เริ่ม ศุกร์ 21 พ.ย. 21:00" (English: Starts today at 21:00 / Starts Fri, Nov 21 at 21:00) */
function startLabel(start: number, today: number): string {
  const day = bkkDay(start)
  const d = new Date(start + BKK)
  const hm = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
  if (day === today) return t(`เริ่มวันนี้ ${hm}`, `Starts today at ${hm}`)
  if (day === today + 1) return t(`เริ่มพรุ่งนี้ ${hm}`, `Starts tomorrow at ${hm}`)
  return t(`เริ่ม ${longDay(day)} ${hm}`, `Starts ${longDay(day)} at ${hm}`)
}

interface When {
  /** right away, or a day and a time */
  now: boolean
  /** a Bangkok day number, or 'other' (the date field) */
  day: number | 'other' | null
  date: string
  /** 'HH:MM', or 'other' (the time field) */
  time: string | null
  ownTime: string
}

/** When it starts (ms), or undefined while the day or time is still missing. */
function startOf(w: When, now: number): number | undefined {
  if (w.now) return now
  const day = w.day === 'other' ? dayOfIso(w.date) : (w.day ?? undefined)
  const hm = w.time === 'other' ? w.ownTime : w.time
  if (day === undefined || !hm || !/^\d{2}:\d{2}$/.test(hm)) return undefined
  const [h, m] = hm.split(':').map(Number)
  return day * DAY - BKK + (h * 60 + m) * MIN
}

type StepKey = 'title' | 'room' | 'when' | 'length' | 'repeat' | 'about'
const STEP_OF_ISSUE: Record<EventDraftIssue, StepKey> = { title: 'title', description: 'about', duration: 'length', startsAt: 'when' }

/**
 * The create sheet. `roomId`: the room it's for (a host's own room); without it the first steps
 * ask which room (staff). `onCreated` gets the new event's id once the server has it.
 */
export function CreateEventSheet({ open, onClose, roomId, onCreated }: { open: boolean; onClose: () => void; roomId?: string; onCreated: (id: string) => void }) {
  const [round, setRound] = useState(0)
  const [wasOpen, setWasOpen] = useState(open)
  const [dirty, setDirty] = useState(false)
  const [asking, setAsking] = useState(false)
  // each opening starts with a blank form
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setRound((n) => n + 1)
      setDirty(false)
      setAsking(false)
    }
  }
  // leaving with answers in it asks first
  const close = () => (dirty && !asking ? setAsking(true) : onClose())
  return (
    <Sheet open={open} onClose={close} title={t('สร้างอีเวนต์', 'Create an event')} width={560}>
      <Body
        key={round}
        roomId={roomId}
        asking={asking}
        onDirty={setDirty}
        onKeepGoing={() => setAsking(false)}
        onLeave={onClose}
        onAskLeave={close}
        onCreated={onCreated}
      />
    </Sheet>
  )
}

function Body({
  roomId,
  asking,
  onDirty,
  onKeepGoing,
  onLeave,
  onAskLeave,
  onCreated,
}: {
  roomId?: string
  asking: boolean
  onDirty: (dirty: boolean) => void
  onKeepGoing: () => void
  onLeave: () => void
  onAskLeave: () => void
  onCreated: (id: string) => void
}) {
  const rooms = useRooms()
  const createEvent = useMoshi((s) => s.createEvent)
  const now = useNow(30_000)
  const today = bkkDay(now)
  const id = useId()

  const [step, setStep] = useState(0)
  const [title, setTitle] = useState('')
  const [room, setRoom] = useState(roomId ?? '')
  const [when, setWhen] = useState<When>({ now: false, day: null, date: '', time: null, ownTime: '' })
  const [duration, setDuration] = useState(60)
  const [weekly, setWeekly] = useState(false)
  const [about, setAbout] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<{ step: StepKey; text: string } | null>(null)

  const touched = !!title.trim() || (!roomId && !!room) || when.now || when.day !== null || when.time !== null || !!about.trim()
  useEffect(() => onDirty(touched), [touched, onDirty])

  const errorAt = (key: StepKey) => (problem?.step === key ? problem.text : undefined)
  const clear = (key: StepKey) => problem?.step === key && setProblem(null)
  const editWhen = (patch: Partial<When>) => {
    clear('when')
    setWhen((w) => ({ ...w, ...patch }))
  }

  const start = startOf(when, now)
  const whenIssue =
    start === undefined
      ? undefined
      : start < now - MIN
        ? t('เวลานี้ผ่านไปแล้ว ลองเลือกเวลาหลังจากนี้นะ', "That time has passed. Pick a time after now")
        : start > now + 60 * DAY
          ? tx(EVENT_DRAFT_ISSUES.startsAt)
          : undefined

  const pickRoom = !roomId
  const steps: (WizardStep & { key: StepKey })[] = [
    {
      key: 'title',
      title: t('อีเวนต์นี้ชื่ออะไรดี?', "What's the event called?"),
      hint: t('ชื่อสั้นๆ ที่บอกว่ามาคุยเรื่องอะไรกัน', 'A short name that says what you’ll chat about'),
      valid: !!title.trim(),
      error: errorAt('title'),
      content: (
        <div>
          <label htmlFor={`${id}-title`} className="sr-only">
            {t('ชื่ออีเวนต์', 'Event name')}
          </label>
          <input
            id={`${id}-title`}
            value={title}
            maxLength={EVENT_LIMITS.titleMax}
            onChange={(e) => {
              clear('title')
              setTitle(e.target.value)
            }}
            placeholder={t('เช่น ซีซันนี้ดูอนิเมะอะไรกันบ้าง', 'e.g. What anime are we watching this season?')}
            autoComplete="off"
            enterKeyHint="next"
            className="h-14 w-full rounded-2xl border border-line bg-white px-4 text-base text-ink shadow-[var(--shadow-soft)] outline-none placeholder:text-ink-faint focus-visible:ring-3 focus-visible:ring-lavender"
          />
          <p className="mt-1.5 text-right text-xs text-ink-soft tabular-nums">
            {title.length}/{EVENT_LIMITS.titleMax}
          </p>
        </div>
      ),
    },
    ...(pickRoom
      ? [
          {
            key: 'room' as const,
            title: t('จัดในห้องไหน?', 'Which room is it in?'),
            hint: t('คนในห้องนั้นจะเห็นอีเวนต์ปักไว้บนแชท', 'People in that room see it pinned above the chat'),
            valid: !!room,
            content: <RoomPicker rooms={rooms} value={room} onChange={setRoom} />,
          },
        ]
      : []),
    {
      key: 'when',
      title: t('เริ่มเมื่อไหร่?', 'When does it start?'),
      hint: t('เวลาไทย ห้องแชทของอีเวนต์จะเปิดเองตอนถึงเวลา', 'Thailand time. The event chat opens by itself right on time'),
      valid: start !== undefined && !whenIssue,
      error: errorAt('when') ?? whenIssue,
      content: <WhenPicker when={when} onChange={editWhen} today={today} start={start} />,
    },
    {
      key: 'length',
      title: t('อีเวนต์นานเท่าไหร่?', 'How long does it run?'),
      hint: t('พอครบเวลา แชทจะปิดเอง แล้วอ่านย้อนหลังได้อีก 24 ชั่วโมง', 'When time’s up the chat closes, and stays readable for 24 hours'),
      error: errorAt('length'),
      content: (
        <Choices
          label={t('ความยาวอีเวนต์', 'Event length')}
          options={DURATIONS.map((m) => ({ value: m, title: durationLabel(m), icon: <Clock size={20} strokeWidth={2.4} /> }))}
          value={duration}
          onChange={(m) => {
            clear('length')
            setDuration(m)
          }}
        />
      ),
    },
    {
      key: 'repeat',
      title: t('ทำซ้ำทุกสัปดาห์ไหม?', 'Repeat it every week?'),
      hint: t('ทุกสัปดาห์ วันและเวลาเดิม เปลี่ยนใจทีหลังหยุดได้', 'Same day and time each week. You can stop it later'),
      error: errorAt('repeat'),
      content: (
        <Choices
          label={t('ทำซ้ำไหม', 'Repeat')}
          options={[
            { value: false, title: t('ครั้งเดียว', 'Just once'), icon: <CalendarCheck size={20} strokeWidth={2.4} /> },
            {
              value: true,
              title: t('ทุกสัปดาห์', 'Every week'),
              note: start !== undefined ? weeklyLabel(start) : undefined,
              icon: <Repeat size={20} strokeWidth={2.4} />,
            },
          ]}
          value={weekly}
          onChange={(v) => {
            clear('repeat')
            setWeekly(v)
          }}
        />
      ),
    },
    {
      key: 'about',
      title: t('อยากบอกอะไรเพิ่มไหม?', 'Anything to add?'),
      hint: t('ชวนให้คนอยากมา เช่น จะคุยเรื่องอะไร ใครมาได้บ้าง', 'Say what it’s about or who it’s for, so people want to come'),
      optional: true,
      onSkip: () => setAbout(''),
      error: errorAt('about'),
      content: (
        <div>
          <label htmlFor={`${id}-about`} className="sr-only">
            {t('คำอธิบายอีเวนต์', 'Event description')}
          </label>
          <textarea
            id={`${id}-about`}
            value={about}
            maxLength={EVENT_LIMITS.descriptionMax}
            rows={4}
            onChange={(e) => {
              clear('about')
              setAbout(e.target.value)
            }}
            placeholder={t('เช่น มาเล่าว่าซีซันนี้ดูเรื่องไหนต่อ จะสปอยล์ต้องเตือนก่อนนะ', 'e.g. Tell us what you’re still watching. Warn before spoilers!')}
            className="block w-full resize-none rounded-2xl border border-line bg-white px-4 py-3 text-base leading-relaxed text-ink shadow-[var(--shadow-soft)] outline-none placeholder:text-ink-faint focus-visible:ring-3 focus-visible:ring-lavender"
          />
          <p className="mt-1.5 text-right text-xs text-ink-soft tabular-nums">
            {about.length}/{EVENT_LIMITS.descriptionMax}
          </p>
        </div>
      ),
    },
  ]

  const goTo = (key: StepKey, text: string) => {
    setProblem({ step: key, text })
    const at = steps.findIndex((s) => s.key === key)
    if (at >= 0) setStep(at)
  }

  const finish = async () => {
    if (busy) return
    const at = startOf(when, Date.now())
    if (at === undefined) return goTo('when', t('เลือกวันและเวลาก่อนนะ', 'Pick a day and time first'))
    const draft: EventDraft = {
      roomId: room,
      title: title.trim(),
      description: about.trim() || undefined,
      startsAt: new Date(at).toISOString(),
      durationMin: duration,
      repeatWeekly: weekly,
    }
    const issue = checkEventDraft(draft)
    if (issue) return goTo(STEP_OF_ISSUE[issue], eventDraftIssueText(issue))
    setBusy(true)
    setProblem(null)
    const made = await createEvent(draft)
    setBusy(false)
    if (made) return onCreated(made)
    // the store said why in a toast, which the sheet would cover: show it under the step it's about
    const said = useMoshi.getState().notice?.text
    useMoshi.getState().clearNotice()
    const text = said ?? t('สร้างอีเวนต์ไม่สำเร็จ ลองใหม่อีกทีนะ', "Couldn't create the event. Try again")
    const known = (Object.keys(EVENT_DRAFT_ISSUES) as EventDraftIssue[]).find((k) => eventDraftIssueText(k) === text)
    if (known) return goTo(STEP_OF_ISSUE[known], text)
    // a weekly slot already taken in this room: the repeat question is where to change it
    goTo(weekly && /สัปดาห์|weekly/i.test(text) ? 'repeat' : 'about', text)
  }

  return (
    <>
      {asking && <LeaveAsk onKeepGoing={onKeepGoing} onLeave={onLeave} />}
      <div hidden={asking}>
        <Wizard
          steps={steps}
          step={step}
          onStep={setStep}
          onFinish={() => void finish()}
          finishLabel={t('สร้างอีเวนต์', 'Create event')}
          busy={busy}
          onCancel={onAskLeave}
          placement="sheet"
        />
      </div>
    </>
  )
}

/** "ทิ้งอีเวนต์ที่กำลังสร้างไหม?" */
function LeaveAsk({ onKeepGoing, onLeave }: { onKeepGoing: () => void; onLeave: () => void }) {
  const id = useId()
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring.soft} className="space-y-4 pb-3">
      <div className="rounded-3xl bg-white p-4">
        <p id={id} className="font-display text-lg font-semibold text-ink">
          {t('ทิ้งอีเวนต์ที่กำลังสร้างไหม?', 'Discard this event?')}
        </p>
        <p className="mt-1 text-sm text-ink-soft">{t('ที่กรอกไว้จะหายไปนะ', "What you've filled in will be lost")}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button block aria-describedby={id} onClick={onKeepGoing}>
          {t('สร้างต่อ', 'Keep going')}
        </Button>
        <Button variant="ghost" block onClick={onLeave}>
          {t('ทิ้งไป', 'Discard')}
        </Button>
      </div>
    </motion.div>
  )
}

/** Big tappable answers, one picked (toggle buttons in a named group, like the chips). */
function Choices<V extends string | number | boolean>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: V; title: string; note?: string; icon: ReactNode }[]
  value: V
  onChange: (v: V) => void
}) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-1 gap-2.5 min-[360px]:grid-cols-2">
      {options.map((o) => {
        const on = o.value === value
        return (
          <motion.button
            key={String(o.value)}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            whileTap={{ scale: 0.96 }}
            transition={spring.bouncy}
            className={`flex min-h-16 min-w-0 items-center gap-3 rounded-3xl border-2 px-3.5 py-3 text-left transition-colors ${
              on ? 'border-coral-deep bg-coral/15' : 'border-line bg-white hover:bg-cream-2/60'
            }`}
          >
            <span aria-hidden className={`grid size-10 shrink-0 place-items-center rounded-2xl ${on ? 'bg-coral text-ink' : 'bg-cream-3 text-ink'}`}>
              {o.icon}
            </span>
            <span className="min-w-0">
              <span className="block font-display font-semibold [overflow-wrap:anywhere] text-ink">{o.title}</span>
              {o.note && <span className="block text-xs [overflow-wrap:anywhere] text-ink-soft">{o.note}</span>}
            </span>
          </motion.button>
        )
      })}
    </div>
  )
}

function RoomPicker({ rooms, value, onChange }: { rooms: Room[]; value: string; onChange: (id: string) => void }) {
  return (
    <div role="group" aria-label={t('ห้อง', 'Room')} className="grid gap-2 sm:grid-cols-2">
      {rooms.map((r) => {
        const on = r.id === value
        return (
          <motion.button
            key={r.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(r.id)}
            whileTap={{ scale: 0.97 }}
            transition={spring.bouncy}
            className="flex min-h-16 min-w-0 items-center gap-3 rounded-3xl border-2 bg-white px-3 py-2.5 text-left transition-colors hover:bg-cream-2/60"
            style={{ borderColor: on ? MOCHI[r.color].shade : '#F1DDD0', background: on ? MOCHI[r.color].light : undefined }}
          >
            <RoomIcon room={r} size={40} />
            <span className="min-w-0">
              <span className="block truncate font-display font-semibold text-ink">{r.name}</span>
              <span className="block truncate text-xs text-ink-soft">{r.tagline}</span>
            </span>
          </motion.button>
        )
      })}
    </div>
  )
}

function WhenPicker({ when, onChange, today, start }: { when: When; onChange: (patch: Partial<When>) => void; today: number; start?: number }) {
  const id = useId()
  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => today + i)
  return (
    <div className="space-y-5">
      <Chip size="lg" color="mint" selected={when.now} onClick={() => onChange({ now: !when.now })} icon={<Zap size={16} strokeWidth={2.4} aria-hidden />}>
        {t('เริ่มเลยตอนนี้', 'Start right now')}
      </Chip>

      {!when.now && (
        <>
          <fieldset>
            <legend className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
              <CalendarDays size={16} strokeWidth={2.4} aria-hidden /> {t('วันไหน', 'Which day')}
            </legend>
            <div className="flex flex-wrap gap-2">
              {days.map((d) => (
                <Chip key={d} size="lg" color="lavender" selected={when.day === d} onClick={() => onChange({ day: d })}>
                  {dayChip(d, today)}
                </Chip>
              ))}
              <Chip size="lg" color="lavender" selected={when.day === 'other'} onClick={() => onChange({ day: 'other', date: when.date || isoDay(today + DAYS_SHOWN) })}>
                {t('วันอื่นๆ', 'Another day')}
              </Chip>
            </div>
            {when.day === 'other' && (
              <div className="mt-2.5">
                <label htmlFor={`${id}-date`} className="mb-1 block text-xs font-semibold text-ink-soft">
                  {t('เลือกวัน (ไม่เกิน 60 วันจากนี้)', 'Pick a day (up to 60 days ahead)')}
                </label>
                <input
                  id={`${id}-date`}
                  type="date"
                  value={when.date}
                  min={isoDay(today)}
                  max={isoDay(today + 60)}
                  onChange={(e) => onChange({ date: e.target.value })}
                  className="h-12 w-full max-w-xs rounded-2xl border border-line bg-white px-3.5 text-base text-ink outline-none focus-visible:ring-3 focus-visible:ring-lavender"
                />
              </div>
            )}
          </fieldset>

          <fieldset>
            <legend className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Clock size={16} strokeWidth={2.4} aria-hidden /> {t('กี่โมง (เวลาไทย)', 'What time (Thailand)')}
            </legend>
            <div className="flex flex-wrap gap-2">
              {TIMES.map((hm) => (
                <Chip key={hm} size="lg" color="butter" selected={when.time === hm} onClick={() => onChange({ time: hm })}>
                  {hm}
                </Chip>
              ))}
              <Chip size="lg" color="butter" selected={when.time === 'other'} onClick={() => onChange({ time: 'other' })}>
                {t('เวลาอื่นๆ', 'Another time')}
              </Chip>
            </div>
            {when.time === 'other' && (
              <div className="mt-2.5">
                <label htmlFor={`${id}-time`} className="mb-1 block text-xs font-semibold text-ink-soft">
                  {t('เลือกเวลา', 'Pick a time')}
                </label>
                <input
                  id={`${id}-time`}
                  type="time"
                  step={300}
                  value={when.ownTime}
                  onChange={(e) => onChange({ ownTime: e.target.value })}
                  className="h-12 w-full max-w-[12rem] rounded-2xl border border-line bg-white px-3.5 text-base text-ink outline-none focus-visible:ring-3 focus-visible:ring-lavender"
                />
              </div>
            )}
          </fieldset>
        </>
      )}

      {/* what was picked, read back in words */}
      <p className="rounded-2xl bg-cream-2 px-4 py-2.5 text-sm text-ink" aria-live="polite">
        {when.now
          ? t('เริ่มทันทีที่กดสร้าง', 'Starts as soon as you create it')
          : start !== undefined
            ? startLabel(start, today)
            : t('เลือกวันและเวลา หรือเริ่มเลยตอนนี้ก็ได้', 'Pick a day and a time, or start right now')}
      </p>
    </div>
  )
}
