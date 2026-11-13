import { motion, useReducedMotion } from 'motion/react'
import { ArrowLeftRight, Play } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MochiStage, View3D } from '@/components/three'
import { Button, PageHeader, Wizard, Zone, type WizardStep } from '@/components/ui'
import { nextWaveRoundAt } from '@/data/wave'
import { useMyWaveAnswers } from '@/data/hooks'
import { useNow } from '@/lib/hooks'
import { t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import { useMoshi } from '@/lib/store'
import type { WaveChoice } from '@/lib/types'
import { answeredCount, currentRound, firstOpen, sideIcon, WAVE_ROUND_SIZE, type WaveRound } from '@/lib/waveQuiz'
import { ChoiceCards } from './ChoiceCards'
import { TuneResult } from './TuneResult'

type View = 'intro' | 'quiz' | 'result'

/**
 * /app/tune: "จูนคลื่น", this or that. A short hello from Mochi, then one question per screen
 * (two big cards: a tap saves the pick and moves on; Back to change one; 1 / 2 or ← / → on a
 * keyboard), then the result: who tuned in closest, and when the next round comes. The round
 * changes every Monday (Asia/Bangkok). Each pick saves the moment it's made (answerWave): in demo
 * mode and before the quiz table exists it stays on this device, so leaving halfway loses nothing.
 */
export default function TunePage() {
  // re-renders as the week turns over, so a new round shows up without a reload
  const now = useNow(null, nextWaveRoundAt())
  const week = currentRound(now).week
  // the round only changes with the week: one object per week keeps the result's lookups still
  const round = useMemo(() => currentRound(now), [week])
  const answers = useMyWaveAnswers()
  const complete = answeredCount(answers, round.questions) === round.questions.length

  const [view, setView] = useState<View>(() => (complete ? 'result' : 'intro'))
  // the round being played stays put even if Monday arrives halfway through
  const [playing, setPlaying] = useState<WaveRound>(round)
  const [step, setStep] = useState(0)
  const [fresh, setFresh] = useState(false)

  const start = (from: number) => {
    setPlaying(round)
    setStep(from)
    setFresh(false)
    setView('quiz')
  }

  // the round just played has every pick (one the server refused goes back to unanswered)
  const playedAll = answeredCount(answers, playing.questions) === playing.questions.length
  // a new week on the result screen, or a pick that didn't save after all: the round's hello,
  // which says how many are left
  const shown: View = view === 'result' && (fresh ? !playedAll : !complete) ? 'intro' : view
  // every round in the bank has its picks: the weeks only bring old rounds back
  const allPlayed = answeredCount(answers) === round.rounds * WAVE_ROUND_SIZE

  return (
    <div className="pb-10">
      <PageHeader
        back={(window.history.state as { idx?: number } | null)?.idx ? true : '/app/people'}
        title={t('จูนคลื่น', 'This or that')}
        subtitle={
          allPlayed
            ? t('ตอบครบทุกรอบแล้ว รอบเดิมจะวนกลับมาทุกวันจันทร์', "You've played every round. They come back around each Monday")
            : t('รอบใหม่ทุกวันจันทร์', 'A new round every Monday')
        }
      />

      {shown === 'intro' && <Intro round={round} answered={answeredCount(answers, round.questions)} onStart={() => start(Math.max(0, firstOpen(answers, round.questions)))} />}
      {shown === 'quiz' && (
        <Quiz
          round={playing}
          step={step}
          onStep={setStep}
          onFinish={() => {
            setFresh(true)
            setView('result')
          }}
        />
      )}
      {shown === 'result' && <TuneResult round={fresh ? playing : round} now={now} fresh={fresh} onReplay={() => start(0)} />}
    </div>
  )
}

/** Mochi says hi and explains in one breath; one button starts (or carries on from the first open question). */
function Intro({ round, answered, onStart }: { round: WaveRound; answered: number; onStart: () => void }) {
  const reduce = useReducedMotion()
  const total = round.questions.length
  const peek = round.questions.slice(0, 3)
  return (
    <Zone tone="lavender" icon={<ArrowLeftRight size={18} strokeWidth={2.4} />} title={t(`รอบที่ ${round.number}`, `Round ${round.number}`)} className="mt-4">
      <div className="grid items-center gap-4 md:grid-cols-[minmax(0,15rem)_1fr] md:gap-6">
        <div className="relative">
          <View3D className="h-44 w-full sm:h-56" label={t('น้องโมชิชวนเล่นจูนคลื่น', 'Little Mochi inviting you to play this or that')}>
            <MochiStage color="lavender" expression="talk" zoom={1.05} />
          </View3D>
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...spring.bouncy, delay: 0.2 }}
            className="absolute top-1 left-1 max-w-[78%] rounded-3xl rounded-bl-md bg-white px-3.5 py-2 font-display text-sm leading-snug font-semibold text-ink shadow-[var(--shadow-soft)]"
          >
            {t(`จูนคลื่นกัน! ตอบเร็วๆ ${total} ข้อ`, `Let's tune in! ${total} quick picks`)}
          </motion.p>
        </div>

        <div className="min-w-0">
          <h2 className="font-display text-2xl leading-tight font-semibold text-ink sm:text-3xl">{t('อันไหนใช่เรามากกว่า?', "Which one's more you?")}</h2>
          <p className="mt-1 text-ink-soft">
            {t(
              'เลือกระหว่างสองอย่าง ไม่มีถูกไม่มีผิด โมชิจะเอาไปเทียบกับเพื่อนๆ ให้เห็นว่าเราจูนตรงกับใคร และจับคู่คนคลื่นเดียวกันได้แม่นขึ้น',
              "Pick between two things. No right or wrong. Mochi compares your picks with everyone's to show who you line up with and match you more closely",
            )}
          </p>

          {/* a taste of this round */}
          <ul aria-hidden className="mt-4 flex flex-wrap gap-2">
            {peek.map((q) => (
              <li key={q.id} className="flex max-w-full items-center gap-1.5 rounded-full bg-white/85 px-3 py-1.5 text-sm text-ink shadow-[var(--shadow-soft)]">
                <span>{sideIcon(q.id, 0)}</span>
                <span className="min-w-0 truncate">{q.a}</span>
                <span className="text-ink-faint">/</span>
                <span className="min-w-0 truncate">{q.b}</span>
                <span>{sideIcon(q.id, 1)}</span>
              </li>
            ))}
          </ul>

          {answered > 0 && (
            <p className="mt-4 text-sm font-semibold text-ink-soft">
              {t(`ตอบไปแล้ว ${answered}/${total} ข้อ`, `${answered} of ${total} answered`)}
            </p>
          )}
          <Button size="lg" onClick={onStart} className="mt-4 w-full sm:w-auto" icon={<Play size={18} strokeWidth={2.6} className="fill-current" aria-hidden />}>
            {answered > 0 ? t('ตอบต่อ', 'Keep going') : t('เริ่มเลย', "Let's go")}
          </Button>
          <p className="mt-2 text-xs text-ink-faint">{t('เปลี่ยนคำตอบทีหลังได้เสมอ', 'You can change your picks anytime')}</p>
        </div>
      </div>
    </Zone>
  )
}

/** One question per screen inside the shared Wizard: its progress "3/8", Back, and Next once a side is picked. */
function Quiz({ round, step, onStep, onFinish }: { round: WaveRound; step: number; onStep: (n: number) => void; onFinish: () => void }) {
  const reduce = !!useReducedMotion()
  const answers = useMyWaveAnswers()
  const answerWave = useMoshi((s) => s.answerWave)
  const questions = round.questions
  const i = Math.min(Math.max(step, 0), questions.length - 1)
  const firstCard = useRef<HTMLButtonElement>(null)
  // a pick waits a beat (so the pressed card shows) before moving on; taps in between are ignored
  const moving = useRef<number | null>(null)
  // Back pressed during that beat (or leaving the page) cancels the move
  useEffect(
    () => () => {
      if (moving.current !== null) window.clearTimeout(moving.current)
      moving.current = null
    },
    [i],
  )

  // started from a button that's now gone: the first card takes the focus
  useEffect(() => {
    firstCard.current?.focus({ preventScroll: true })
  }, [])

  const pick = useCallback(
    (choice: WaveChoice) => {
      if (moving.current !== null) return
      const q = questions[i]
      answerWave(q.id, choice)
      moving.current = window.setTimeout(
        () => {
          moving.current = null
          if (i === questions.length - 1) onFinish()
          else onStep(i + 1)
        },
        reduce ? 120 : 320,
      )
    },
    [questions, i, answerWave, onFinish, onStep, reduce],
  )

  // 1 / ← picks the first side, 2 / → the second (not while typing, in a dialog or on another control)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      const choice: WaveChoice | null = e.key === '1' || e.key === 'ArrowLeft' ? 0 : e.key === '2' || e.key === 'ArrowRight' ? 1 : null
      if (choice === null) return
      const el = e.target instanceof Element ? e.target : null
      if (el?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return
      if (el?.closest('button, a, [role="button"]') && !el.closest('[data-wave-choice]')) return
      e.preventDefault()
      pick(choice)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [pick])

  const steps: WizardStep[] = questions.map((q, n) => ({
    key: q.id,
    title: t(`${q.a} หรือ ${q.b}?`, `${q.a} or ${q.b}?`),
    hint: (
      <>
        {t('แตะอันที่ใช่เรามากกว่า', "Tap the one that's more you")}
        <span className="hidden [@media(hover:hover)]:inline">{t(' หรือกด 1 / 2', ' or press 1 / 2')}</span>
      </>
    ),
    valid: answers[q.id] !== undefined,
    content: <ChoiceCards ref={n === i ? firstCard : undefined} question={q} picked={answers[q.id]} onPick={pick} />,
  }))

  return (
    <Zone tone="lavender" className="mt-4">
      <Wizard steps={steps} step={i} onStep={onStep} onFinish={onFinish} finishLabel={t('ดูผล', 'See results')} placement="page" />
    </Zone>
  )
}
