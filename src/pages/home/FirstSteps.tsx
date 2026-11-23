import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight, DoorOpen, Radio, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { Avatar, ButtonLink } from '@/components/ui'
import { useMyId, useRooms } from '@/data/hooks'
import { t } from '@/lib/i18n'
import { fadeUp, spring } from '@/lib/motion'
import { useProgress, useSaidInRoom } from '@/lib/progress'
import { useMoshi } from '@/lib/store'
import { useWave, waveHref } from '@/pages/me/wave'
import { roomLabel } from './greeting'

export const FIRST_STEPS_TOTAL = 2

export interface FirstStepsState {
  myId: string
  /** I said something in a room. */
  roomSaid: boolean
  /**
   * I played "จูนคลื่น" (one round's worth of picks). With fewer than 3
   * interests nobody can reach "ถูกคอ" yet, so those come first and the step isn't done until then.
   * The rest of a clearer wave is the WaveClarity card's job on my profile.
   */
  tuned: boolean
  /** My wave, for the tuning step. */
  wave: ReturnType<typeof useWave>
  done: number
  stepsClosed: boolean
  followUpSeen: boolean
}

/**
 * The two first steps are ticked by what I've actually done after joining.
 */
export function useFirstSteps(): FirstStepsState {
  const myId = useMyId()
  const roomSaid = useSaidInRoom(myId)
  const wave = useWave()
  const progress = useProgress(myId)
  const { interests, tune } = stepPieces(wave)
  const tuned = !!interests?.done && !!tune?.done
  return {
    myId,
    roomSaid,
    tuned,
    wave,
    done: [roomSaid, tuned].filter(Boolean).length,
    stepsClosed: progress.stepsClosed === true,
    followUpSeen: progress.stepsFollowUpSeen === true,
  }
}

/** The two pieces of my wave the tuning step looks at. */
function stepPieces(wave: ReturnType<typeof useWave>) {
  return {
    interests: wave.items.find((s) => s.item.key === 'interests'),
    tune: wave.items.find((s) => s.item.key === 'tune'),
  }
}

/**
 * Say hi in a room and play "จูนคลื่น". Show onboarding or the first incomplete step.
 */
export function FirstSteps({ steps }: { steps: FirstStepsState }) {
  const onboarded = useMoshi((s) => s.onboarded)
  const reduce = useReducedMotion()
  const myRooms = useMoshi((s) => s.me.rooms)
  const rooms = useRooms()
  const firstRoom = myRooms.map((id) => rooms.find((r) => r.id === id)).find((r) => !!r)
  const { wave } = steps
  const { interests, tune } = stepPieces(wave)
  // fewer than 3 interests: nobody can reach "ถูกคอ" yet, so the wave step comes first and asks for those
  const thin = !!interests && !interests.done
  const piece = thin ? interests : tune

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
  const rows = thin ? [waveRow, roomRow] : [roomRow, waveRow]

  const currentIndex = rows.findIndex((r) => !r.done)
  const current = rows[currentIndex]

  return (
    <div>
      <Progress done={steps.done} />

      {(!onboarded || current) && (
        <motion.div
          key={onboarded ? current?.key : 'onboard'}
          variants={fadeUp}
          initial={reduce ? false : 'hidden'}
          animate="show"
          className="mt-3"
        >
          {!onboarded ? (
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
          ) : current && (
            <Row
              mark={<span className="font-display text-base font-bold">{currentIndex + 1}</span>}
              markLabel={t(`ขั้นที่ ${currentIndex + 1}`, `Step ${currentIndex + 1}`)}
              title={current.title}
              sub={current.sub}
              action={
                <ButtonLink to={current.action.to} icon={current.action.icon} className="w-full sm:w-auto">
                  {current.action.label}
                </ButtonLink>
              }
            />
          )}
        </motion.div>
      )}
    </div>
  )
}

interface StepRow {
  key: 'room' | 'wave'
  done: boolean
  title: string
  sub: string
  action: { to: string; label: string; icon: ReactNode }
}

function Row({
  mark,
  markLabel,
  title,
  sub,
  action,
}: {
  mark?: ReactNode
  markLabel: string
  title: string
  sub: string
  action?: ReactNode
}) {
  return (
    <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 rounded-[1.5rem] bg-white/90 p-3 shadow-[var(--shadow-soft)]">
      <span className="inline-flex size-10 items-center justify-center rounded-full bg-butter/70 text-ink shadow-[inset_0_-3px_0_rgb(59_38_34/0.08)]">
        <span className="sr-only">{markLabel}</span>
        <span aria-hidden className="inline-flex">{mark}</span>
      </span>
      <div className="min-w-0 self-center">
        <p className="font-display leading-snug font-semibold text-ink">{title}</p>
        <p className="text-sm text-ink-soft">{sub}</p>
        {action && <div className="mt-2.5">{action}</div>}
      </div>
    </div>
  )
}

/** Progress through the first steps. */
function Progress({ done }: { done: number }) {
  const reduce = useReducedMotion()
  return (
    <div className="flex items-center gap-3">
      <Avatar color="peach" size={40} face={done ? 'happy' : 'wink'} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">
          {t(`เริ่มต้น ${FIRST_STEPS_TOTAL} ขั้น · ทำแล้ว ${done} จาก ${FIRST_STEPS_TOTAL}`, `${FIRST_STEPS_TOTAL} first steps · ${done} of ${FIRST_STEPS_TOTAL} done`)}
        </p>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={FIRST_STEPS_TOTAL}
          aria-valuenow={done}
          aria-valuetext={t(`ทำแล้ว ${done} จาก ${FIRST_STEPS_TOTAL} ขั้น`, `${done} of ${FIRST_STEPS_TOTAL} steps done`)}
          aria-label={t('ความคืบหน้าการเริ่มต้น', 'First steps progress')}
          className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-cream-3"
        >
          <motion.span
            className="block h-full rounded-full bg-linear-to-r from-mint to-sky"
            initial={reduce ? false : { width: 0 }}
            animate={{ width: `${(done / FIRST_STEPS_TOTAL) * 100}%` }}
            transition={spring.soft}
          />
        </div>
      </div>
    </div>
  )
}
