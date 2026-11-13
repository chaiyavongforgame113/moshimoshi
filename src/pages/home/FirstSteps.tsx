import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight, Check, DoorOpen, MessageCircleHeart, Radio, Sparkles, Users } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Avatar, Button, ButtonLink } from '@/components/ui'
import { useDailyPick, useMyId, usePerson, useRooms, useSaidHi } from '@/data/hooks'
import { t } from '@/lib/i18n'
import { fadeUp, spring, stagger } from '@/lib/motion'
import { useProgress, useSaidInRoom } from '@/lib/progress'
import { useMoshi } from '@/lib/store'
import { useWave, waveHref } from '@/pages/me/wave'
import { roomLabel } from './greeting'

export interface FirstStepsState {
  myId: string
  /** (a) I said hi to someone myself: a hello I sent, or a line I wrote in a chat */
  chatted: boolean
  /** (b) I said something in a room */
  roomSaid: boolean
  /**
   * (c) I played "จูนคลื่น" (its piece of my wave: one round's worth of picks). With fewer than 3
   * interests nobody can reach "ถูกคอ" yet, so those come first and the step isn't done until then.
   * The rest of a clearer wave is the WaveClarity card's job on my profile.
   */
  tuned: boolean
  /** my wave, for step (c)'s pieces */
  wave: ReturnType<typeof useWave>
  done: number
  stepsSeen: boolean
  stepsClosed: boolean
}

/**
 * The three first steps, each ticked by what I've actually done after joining: nothing to tick
 * by hand, and nothing that onboarding or demo mode's ready-made chats already did for me.
 */
export function useFirstSteps(): FirstStepsState {
  const myId = useMyId()
  const chatted = useSaidHi()
  const roomSaid = useSaidInRoom(myId)
  const wave = useWave()
  const progress = useProgress(myId)
  const { interests, tune } = stepPieces(wave)
  const tuned = !!interests?.done && !!tune?.done
  return {
    myId,
    chatted,
    roomSaid,
    tuned,
    wave,
    done: [chatted, roomSaid, tuned].filter(Boolean).length,
    stepsSeen: progress.stepsSeen === true,
    stepsClosed: progress.stepsClosed === true,
  }
}

/** The two pieces of my wave (pages/me/wave.ts) step (c) looks at. */
function stepPieces(wave: ReturnType<typeof useWave>) {
  return {
    interests: wave.items.find((s) => s.item.key === 'interests'),
    tune: wave.items.find((s) => s.item.key === 'tune'),
  }
}

/**
 * "เริ่มต้น 3 ขั้น" for someone new: say hi to one person on your wavelength, say hi in a room,
 * play "จูนคลื่น" (its button opens /app/tune; it ticks once a round's worth of picks is in). Each
 * row has the one button that does it; the first open step's button is the page's main action.
 */
export function FirstSteps({ steps, onHide }: { steps: FirstStepsState; onHide: () => void }) {
  const onboarded = useMoshi((s) => s.onboarded)
  const pick = useDailyPick()
  const pickUser = usePerson(pick?.userId)
  const myRooms = useMoshi((s) => s.me.rooms)
  const rooms = useRooms()
  const firstRoom = myRooms.map((id) => rooms.find((r) => r.id === id)).find((r) => !!r)
  const { wave } = steps
  const { interests, tune } = stepPieces(wave)
  // fewer than 3 interests: nobody can reach "ถูกคอ" yet, so the wave step comes first and asks for those
  const thin = !!interests && !interests.done
  const piece = thin ? interests : tune

  const chatRow: StepRow = {
    key: 'chat',
    done: steps.chatted,
    title: t('ทักแชทคนคลื่นเดียวกัน 1 คน', 'Say hi to one person on your wavelength'),
    sub: pickUser
      ? t(`เริ่มจาก ${pickUser.name} คลื่นของวันนี้ก็ได้นะ`, `Start with ${pickUser.name}, today's wavelength pick`)
      : t('ไปดูกันว่าใครคลื่นตรงกับเราบ้าง', "See who's on your wavelength"),
    action: pickUser
      ? { to: `/app/people/${pickUser.id}?send=1`, label: t('ทักแชท', 'Say hi'), icon: <MessageCircleHeart size={18} /> }
      : { to: '/app/people', label: t('ไปดูคนคลื่นเดียวกัน', 'See people'), icon: <Users size={18} /> },
  }
  const roomRow: StepRow = {
    key: 'room',
    done: steps.roomSaid,
    title: t('พิมพ์ทักในห้องแรก', 'Say hi in your first room'),
    sub: firstRoom
      ? t(`พิมพ์ทักเพื่อนๆ ใน${roomLabel(firstRoom.name)} สักประโยคก็พอ`, `One line to everyone in ${firstRoom.name} is plenty`)
      : t('เลือกห้องที่ชอบ แล้วพิมพ์ทักสักประโยค', 'Pick a room you like and say a line'),
    action: firstRoom
      ? { to: `/app/rooms/${firstRoom.id}`, label: t('ไปที่ห้อง', 'Go to the room'), icon: <DoorOpen size={18} /> }
      : { to: '/app/rooms', label: t('ไปดูห้อง', 'Browse rooms'), icon: <DoorOpen size={18} /> },
  }
  const waveRow: StepRow = {
    key: 'wave',
    done: steps.tuned,
    title: thin ? t('เพิ่มเรื่องที่ชอบอีกนิด แล้วเล่นจูนคลื่น', 'Add a few interests, then play this or that') : t('เล่นจูนคลื่น', 'Play this or that'),
    sub: piece ? piece.item.why() : t('ช่วยให้โมชิจับคู่คนคลื่นเดียวกันได้แม่นขึ้น', 'It helps Mochi match you more closely'),
    action: piece
      ? { to: waveHref(piece.item.open(wave.context)), label: piece.item.cta(piece.left), icon: <Radio size={18} /> }
      : { to: '/app/tune', label: t('เล่นจูนคลื่น', 'Play this or that'), icon: <Radio size={18} /> },
  }
  const rows = thin ? [waveRow, chatRow, roomRow] : [chatRow, roomRow, waveRow]

  // the page's one main button: getting to know each other first, else the first open step
  const lead = onboarded ? rows.find((r) => !r.done)?.key : 'onboard'

  return (
    <div>
      <Progress done={steps.done} />

      <motion.ol variants={stagger(0.07)} initial="hidden" animate="show" className="mt-3 space-y-2.5">
        {!onboarded && (
          <motion.li variants={fadeUp}>
            <Row
              mark={<Sparkles size={18} strokeWidth={2.4} aria-hidden />}
              markLabel={t('ก่อนเริ่ม', 'Before you start')}
              title={t('ทำความรู้จักกันก่อน', "Let's get to know you")}
              sub={t(
                'บอกโมชิหน่อยว่าชอบอะไร จะได้ชวนคนคลื่นตรงกันมาให้ ใช้เวลาไม่ถึงนาที',
                "Tell Mochi what you're into so it can bring you people on your wavelength. Takes under a minute",
              )}
              action={
                <ButtonLink to="/onboarding" iconRight={<ArrowRight size={18} />} className="w-full sm:w-auto">
                  {t('เริ่มทำความรู้จัก', "Let's get started")}
                </ButtonLink>
              }
            />
          </motion.li>
        )}
        {rows.map((r, i) => (
          <motion.li key={r.key} variants={fadeUp}>
            <Row
              done={r.done}
              mark={r.done ? undefined : <span className="font-display text-base font-bold">{i + 1}</span>}
              markLabel={r.done ? t('ทำแล้ว', 'Done') : t(`ขั้นที่ ${i + 1}`, `Step ${i + 1}`)}
              title={r.title}
              sub={r.done ? t('เรียบร้อย เก่งมากเลย', 'Done. Nice one!') : r.sub}
              action={
                !r.done && (
                  <ButtonLink
                    to={r.action.to}
                    variant={lead === r.key ? 'primary' : 'secondary'}
                    size={lead === r.key ? 'md' : 'sm'}
                    icon={r.action.icon}
                    className={lead === r.key ? 'w-full sm:w-auto' : ''}
                  >
                    {r.action.label}
                  </ButtonLink>
                )
              }
            />
          </motion.li>
        ))}
      </motion.ol>

      <HideCard onHide={onHide} />
    </div>
  )
}

/** "ซ่อนการ์ดนี้": the card never comes back, so one small question first. */
function HideCard({ onHide }: { onHide: () => void }) {
  const [asking, setAsking] = useState(false)
  const keep = useRef<HTMLButtonElement>(null)
  const hide = useRef<HTMLButtonElement>(null)
  const wasAsking = useRef(false)
  // focus follows: onto "ยังไม่ซ่อน" when the question opens, back to "ซ่อนการ์ดนี้" when it closes
  useEffect(() => {
    if (asking) keep.current?.focus()
    else if (wasAsking.current) hide.current?.focus()
    wasAsking.current = asking
  }, [asking])

  if (!asking) {
    return (
      <div className="mt-3 flex justify-end">
        <Button ref={hide} variant="ghost" size="sm" onClick={() => setAsking(true)}>
          {t('ซ่อนการ์ดนี้', 'Hide this card')}
        </Button>
      </div>
    )
  }
  return (
    <div
      role="group"
      aria-label={t('ซ่อนการ์ดเริ่มต้น 3 ขั้น', 'Hide the first steps')}
      className="mt-3 flex flex-wrap items-center justify-end gap-2 rounded-[1.5rem] bg-white/80 p-2 pl-4"
    >
      <p className="min-w-0 flex-[1_1_12rem] text-sm text-ink">
        {t('ซ่อนแล้วการ์ดนี้จะไม่กลับมาอีกนะ แต่ทุกขั้นยังทำเองได้ตลอด', "Once hidden, this card won't come back. You can still do every step on your own")}
      </p>
      <Button ref={keep} variant="secondary" size="sm" onClick={() => setAsking(false)}>
        {t('ยังไม่ซ่อน', 'Keep it')}
      </Button>
      <Button variant="ghost" size="sm" onClick={onHide}>
        {t('ซ่อนเลย', 'Hide it')}
      </Button>
    </div>
  )
}

interface StepRow {
  key: 'chat' | 'room' | 'wave'
  done: boolean
  title: string
  sub: string
  action: { to: string; label: string; icon: ReactNode }
}

function Row({
  done = false,
  mark,
  markLabel,
  title,
  sub,
  action,
}: {
  done?: boolean
  mark?: ReactNode
  markLabel: string
  title: string
  sub: string
  action?: ReactNode
}) {
  return (
    <div
      className={`grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 rounded-[1.5rem] p-3 ${
        done ? 'bg-mint/25' : 'bg-white/90 shadow-[var(--shadow-soft)]'
      }`}
    >
      <StepMark done={done} label={markLabel}>
        {mark}
      </StepMark>
      <div className="min-w-0 self-center">
        <p className={`font-display leading-snug font-semibold ${done ? 'text-ink-soft' : 'text-ink'}`}>{title}</p>
        <p className="text-sm text-ink-soft">{sub}</p>
        {action && <div className="mt-2.5">{action}</div>}
      </div>
    </div>
  )
}

/** Number bubble that turns into a mint tick once the step is done. */
function StepMark({ done, label, children }: { done: boolean; label: string; children?: ReactNode }) {
  const reduce = useReducedMotion()
  return (
    <span
      className={`relative inline-flex size-10 items-center justify-center rounded-full text-ink ${
        done ? 'bg-mint shadow-[inset_0_-3px_0_rgb(59_38_34/0.12)]' : 'bg-butter/70 shadow-[inset_0_-3px_0_rgb(59_38_34/0.08)]'
      }`}
    >
      <span className="sr-only">{label}</span>
      {done ? (
        <motion.span
          key="tick"
          initial={reduce ? false : { scale: 0, rotate: -40 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={spring.bouncy}
          className="inline-flex"
          aria-hidden
        >
          <Check size={20} strokeWidth={3} />
        </motion.span>
      ) : (
        <span aria-hidden className="inline-flex">
          {children}
        </span>
      )}
    </span>
  )
}

/** "ทำแล้ว 1 จาก 3" with a soft bar that fills as steps get ticked. */
function Progress({ done }: { done: number }) {
  const reduce = useReducedMotion()
  return (
    <div className="flex items-center gap-3">
      <Avatar color="peach" size={40} face={done ? 'happy' : 'wink'} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">
          {t(`เริ่มต้น 3 ขั้น · ทำแล้ว ${done} จาก 3`, `3 first steps · ${done} of 3 done`)}
        </p>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={3}
          aria-valuenow={done}
          aria-valuetext={t(`ทำแล้ว ${done} จาก 3 ขั้น`, `${done} of 3 steps done`)}
          aria-label={t('ความคืบหน้าเริ่มต้น 3 ขั้น', 'First steps progress')}
          className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-cream-3"
        >
          <motion.span
            className="block h-full rounded-full bg-linear-to-r from-mint to-sky"
            initial={reduce ? false : { width: 0 }}
            animate={{ width: `${(done / 3) * 100}%` }}
            transition={spring.soft}
          />
        </div>
      </div>
    </div>
  )
}
