import { AnimatePresence, MotionConfig, motion, type Variants } from 'motion/react'
import { ArrowRight, Check, ChevronLeft, Radio } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import type { MochiExpression } from '@/components/three'
import { Avatar, IconButton, LangToggle } from '@/components/ui'
import { useDataMode, useDataReady, useRooms, useServerFeatures } from '@/data/hooks'
import { DEMO_ME } from '@/data/mock'
import { useIsDesktop } from '@/lib/hooks'
import { getLang, t } from '@/lib/i18n'
import { ease, spring } from '@/lib/motion'
import { useMoshi } from '@/lib/store'
import type { User } from '@/lib/types'
import {
  buildIntent,
  initialDraft,
  isOptional,
  lookPatch,
  questionCount,
  questionOf,
  SCREEN_ORDER,
  screenFlow,
  validate,
  type Draft,
  type DraftPatch,
  type FlowOptions,
  type ScreenKey,
  type StepCheck,
} from './model'
import { mascotLine, mascotReaction, reactsOn, screenLabel } from './options'
import { useDebounced, useFlash } from './parts/hooks'
import { MascotSays } from './parts/MascotSays'
import { PreviewPanel } from './parts/PreviewPanel'
import { StepActions } from './parts/StepActions'
import { StepProgress } from './parts/StepProgress'
import { StepDone } from './steps/StepDone'
import { StepIntent } from './steps/StepIntent'
import { StepLife } from './steps/StepLife'
import { StepInterests } from './steps/StepInterests'
import { StepLoves } from './steps/StepLoves'
import { StepMochi } from './steps/StepMochi'
import { StepName } from './steps/StepName'
import { StepOnline } from './steps/StepOnline'
import { StepRules } from './steps/StepRules'
import { StepStory } from './steps/StepStory'
import { StepStyle } from './steps/StepStyle'
import { StepTopic } from './steps/StepTopic'

/**
 * Switching language remounts the page (see Root in app/router), which would
 * wipe what the visitor has typed. The flow keeps a copy here and picks it up
 * on mount; leaving onboarding any other way clears it.
 */
let snapshot: { draft: Draft; screen: ScreenKey; firstTime: boolean; postedIntent: string | null } | null = null

// direction-aware slide; children using `fadeUp` stagger in after it
const slide: Variants = {
  hidden: (dir: number) => ({ opacity: 0, x: dir * 56 }),
  show: { opacity: 1, x: 0, transition: { ...spring.soft, staggerChildren: 0.055, delayChildren: 0.05 } },
  exit: (dir: number) => ({ opacity: 0, x: dir * -56, transition: { duration: 0.18, ease: ease.out } }),
}

/** Enter means Next only where it has nothing else to do: not in a textarea, on a button, link or tab. */
const ENTER_SKIP = 'button, a, select, textarea, [contenteditable="true"], [role="button"], [role="tab"], [role="dialog"]'

/** Live mode waits for the profile, so the draft starts from the real one. */
export default function OnboardingPage() {
  const ready = useDataReady()
  if (!ready) {
    return (
      <div className="relative z-10 flex min-h-dvh items-center justify-center" role="status" aria-label={t('กำลังโหลด', 'Loading')}>
        <span className="size-12 rounded-full bg-peach shadow-[var(--shadow-puffy)] motion-safe:animate-bounce" />
      </div>
    )
  }
  return <Onboarding />
}

function Onboarding() {
  const me = useMoshi((s) => s.me)
  const onboarded = useMoshi((s) => s.onboarded)
  const completeOnboarding = useMoshi((s) => s.completeOnboarding)
  const postIntent = useMoshi((s) => s.postIntent)
  const removeIntent = useMoshi((s) => s.removeIntent)
  const rooms = useRooms()
  const mode = useDataMode()
  const features = useServerFeatures()
  // life stages need the server to keep them (always on in demo)
  const flowOptions: FlowOptions = { lifeStages: features.lifeStages }
  const desktop = useIsDesktop()
  const navigate = useNavigate()

  const [draft, setDraft] = useState<Draft>(() =>
    snapshot?.draft ?? initialDraft(me, onboarded, mode === 'demo' && !onboarded && me.bio === DEMO_ME.bio ? '' : me.bio),
  )
  const [firstTime] = useState(() => snapshot?.firstTime ?? !onboarded)
  const [screen, setScreen] = useState<ScreenKey>(() => snapshot?.screen ?? 'name')
  const [dir, setDir] = useState(1)
  const [navigated, setNavigated] = useState(false)
  const [nudge, setNudge] = useState(0)
  const [pulse, setPulse] = useState(0)
  const [lookChanged, setLookChanged] = useState(false)
  const [flashExpr, flash] = useFlash<MochiExpression>()
  const postedIntent = useRef<string | null>(snapshot?.postedIntent ?? null)

  // keep the copy current; drop it on unmount unless a language switch caused the unmount
  useEffect(() => {
    snapshot = { draft, screen, firstTime, postedIntent: postedIntent.current }
  }, [draft, screen, firstTime])
  useEffect(() => {
    const lang = getLang()
    return () => {
      if (getLang() === lang) snapshot = null
    }
  }, [])

  const update = useCallback((patch: DraftPatch) => {
    setDraft((d) => ({ ...d, ...(typeof patch === 'function' ? patch(d) : patch) }))
  }, [])

  // the mochi reacts: a happy boing when its look changes, chatter while you type its name
  const prev = useRef(draft)
  useEffect(() => {
    const was = prev.current
    prev.current = draft
    if (was.color !== draft.color || was.accessory !== draft.accessory || was.face !== draft.face) {
      setPulse((n) => n + 1)
      setLookChanged(true)
      if (was.face === draft.face) flash('happy', 1100)
    }
    if (was.name !== draft.name && draft.name.trim()) flash('talk', 380)
    if (was.loves.length < draft.loves.length || was.tags.length < draft.tags.length || was.lifeStages.length < draft.lifeStages.length) flash('happy', 700)
  }, [draft, flash])

  const done = screen === 'done'
  const flow = screenFlow(draft, flowOptions)
  const at = Math.max(0, flow.indexOf(screen))
  const nameOk = draft.name.trim().length > 0
  const expression: MochiExpression = done ? 'happy' : (flashExpr ?? (screen === 'name' && nameOk ? 'happy' : screen === 'rules' ? 'wink' : draft.face))

  const settledName = useDebounced(draft.name, 700)
  const settledStory = useDebounced(draft.bio, 900)
  const line = mascotLine(screen, draft)
  const reaction = mascotReaction(screen, draft, { settledName, settledStory, lookChanged })
  const optional = isOptional(screen, !firstTime)
  const check: StepCheck = validate(screen, draft)
  // In live mode Later completes a new profile, so it needs a valid story as well as a name.
  const canLeave = screen !== 'story' && (mode === 'demo' || onboarded || (nameOk && validate('story', draft).ok))
  // only saved when the screen was on offer (otherwise a profile's saved stages stay as they are)
  const lifePatch: Partial<User> = flowOptions.lifeStages ? { lifeStages: draft.lifeStages } : {}
  const leaveEarly = () => {
    if (!canLeave || mode !== 'live' || onboarded) return
    completeOnboarding({
      ...lookPatch(draft),
      name: draft.name.trim(),
      color: draft.color,
      tags: draft.tags,
      loves: draft.loves,
      bio: draft.bio.trim(),
      online: draft.online,
      chatStyle: draft.chatStyle,
      ...lifePatch,
    })
  }

  const goTo = (to: ScreenKey) => {
    setDir(SCREEN_ORDER.indexOf(to) > SCREEN_ORDER.indexOf(screen) ? 1 : -1)
    setNudge(0)
    setNavigated(true)
    if (to === 'done') setPulse((n) => n + 1) // one more sparkle pop to celebrate
    setScreen(to)
  }

  const commit = () => {
    const patch: Partial<User> = {
      ...lookPatch(draft),
      name: draft.name.trim(),
      color: draft.color,
      tags: draft.tags,
      loves: draft.loves,
      bio: draft.bio.trim(),
      online: draft.online,
      chatStyle: draft.chatStyle,
      ...lifePatch,
    }
    completeOnboarding(patch)
    // re-committing (e.g. after going back) replaces the intent instead of stacking another
    if (postedIntent.current) removeIntent(postedIntent.current)
    postedIntent.current = null
    const intent = buildIntent(draft, me.province, rooms)
    if (intent) postedIntent.current = postIntent(intent).id
  }

  /** Save the profile before Wavelength reads the new match results. */
  const advance = () => {
    if (done) {
      navigate('/app/people', { replace: true })
      return
    }
    const to = flow[at + 1]
    if (to === 'done') commit()
    if (to) goTo(to)
  }

  const next = () => {
    if (check.ok) return advance()
    // An unanswered optional screen says "ข้ามไปก่อน", so Enter skips too.
    if (optional) return advance()
    setNudge((n) => n + 1)
  }

  const back = () => (at === 0 ? navigate(onboarded ? '/app' : '/') : goTo(flow[at - 1]))

  // Give the profile a Wavelength page to go back to.
  const openProfile = (id: string) => {
    void Promise.resolve(navigate('/app/people', { replace: true })).then(() => navigate(`/app/people/${id}`))
  }

  // Enter = next on one-line fields (and when nothing in particular has focus), never mid-IME composition
  const nextRef = useRef(next)
  useEffect(() => {
    nextRef.current = next
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229 || e.repeat || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented) return
      const target = e.target as HTMLElement | null
      if (target?.closest(ENTER_SKIP)) return
      e.preventDefault()
      nextRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const cta = done
    ? t('ไปดูคนคลื่นเดียวกัน', 'Explore Wavelength')
    : screen === 'rules'
      ? t('ตกลง', 'Got it')
      : t('ไปต่อ', 'Next')
  const ctaIcon = done ? (
    <Radio size={20} aria-hidden />
  ) : screen === 'rules' ? (
    <Check size={20} strokeWidth={2.6} aria-hidden />
  ) : (
    <ArrowRight size={20} aria-hidden />
  )

  // phones: the mochi screen is tight, so น้องโมชิ's bubble shrinks and its reply floats over the 3D mochi
  const tight = !desktop && screen === 'mochi'
  const stepProps = { draft, update, desktop }
  const stepBody = (() => {
    switch (screen) {
      case 'name':
        return <StepName {...stepProps} expression={expression} pulse={pulse} />
      case 'rules':
        return <StepRules {...stepProps} expression={expression} pulse={pulse} />
      case 'mochi':
        return <StepMochi {...stepProps} expression={expression} pulse={pulse} say={tight ? reaction : null} />
      case 'likes':
        return <StepInterests {...stepProps} />
      case 'loves':
        return <StepLoves {...stepProps} />
      case 'intent':
        return <StepIntent {...stepProps} />
      case 'topic':
        return <StepTopic {...stepProps} />
      case 'life':
        return <StepLife {...stepProps} />
      case 'online':
        return <StepOnline {...stepProps} />
      case 'style':
        return <StepStyle {...stepProps} />
      case 'story':
        return <StepStory {...stepProps} />
      default:
        return <StepDone desktop={desktop} pulse={pulse} onOpenProfile={openProfile} />
    }
  })()

  const stepView = (
    <AnimatePresence mode="wait" custom={dir} onExitComplete={() => window.scrollTo({ top: 0 })}>
      <motion.div key={screen} custom={dir} variants={slide} initial="hidden" animate="show" exit="exit" className="space-y-4 sm:space-y-6">
        <MascotSays
          line={line.line}
          sub={line.sub}
          face={line.face}
          reaction={reaction}
          reacts={reactsOn(screen)}
          focusOnMount={navigated}
          compact={tight}
        />
        {stepBody}
      </motion.div>
    </AnimatePresence>
  )

  const actions = (variant: 'bar' | 'row') => (
    <StepActions
      variant={variant}
      label={cta}
      icon={ctaIcon}
      ok={check.ok}
      need={check.need}
      nudge={nudge}
      onNext={next}
      onSkip={optional ? advance : undefined}
    />
  )

  return (
    <MotionConfig reducedMotion="user">
      {/* overflow-x-clip: the sideways step slide must never cause horizontal scroll (clip keeps sticky working) */}
      <div className="relative z-10 min-h-dvh overflow-x-clip">
        <Header
          screen={screen}
          question={questionOf(screen, flowOptions)}
          questions={questionCount(flowOptions)}
          desktop={desktop}
          onBack={back}
          canLeave={canLeave}
          onLeave={leaveEarly}
        />
        {desktop ? (
          <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,5fr)_minmax(0,6fr)] items-start gap-8 px-8 pt-2 pb-12 xl:gap-12">
            <aside className="sticky top-[6.75rem]" aria-label={t('ตัวอย่างโปรไฟล์', 'Profile preview')}>
              <PreviewPanel draft={draft} expression={expression} pulse={pulse} done={done} province={me.province} />
            </aside>
            <main className="min-w-0">
              <div className="glass rounded-[2.25rem] p-7 xl:p-9">{stepView}</div>
              {actions('row')}
            </main>
          </div>
        ) : (
          <>
            <main className="mx-auto max-w-xl px-4 pt-2 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6">{stepView}</main>
            {actions('bar')}
          </>
        )}
      </div>
    </MotionConfig>
  )
}

interface HeaderProps {
  screen: ScreenKey
  /** "3/11": this screen's question number, and how many there are */
  question: number
  questions: number
  desktop: boolean
  onBack: () => void
  canLeave: boolean
  onLeave: () => void
}

function Header({ screen, question: q, questions, desktop, onBack, canLeave, onLeave }: HeaderProps) {
  const done = screen === 'done'
  const label = screenLabel(screen)
  const count = (
    <span className="shrink-0 font-display text-xs font-semibold text-ink-soft tabular-nums" aria-hidden>
      {done ? '✓' : `${q}/${questions}`}
    </span>
  )
  const animatedLabel = (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={label}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -5 }}
        transition={spring.soft}
        className="block truncate"
      >
        {label}
      </motion.span>
    </AnimatePresence>
  )
  return (
    <header className="safe-top sticky top-0 z-40 bg-cream/75 backdrop-blur-xl lg:bg-cream/40">
      {/* phones: back · step name · language · later on one row, the progress full width below it */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-1.5 px-4 pb-2.5 sm:flex-nowrap sm:gap-x-3 sm:px-6 sm:pb-3 lg:gap-6 lg:px-8 lg:pt-3">
        {desktop && (
          <Link to="/" className="flex shrink-0 items-center gap-2 rounded-full pr-2 font-display text-xl font-semibold text-ink" aria-label={t('moshimoshi หน้าแรก', 'moshimoshi home')}>
            <Avatar color="cream" size={38} face="happy" />
            moshimoshi
          </Link>
        )}
        <IconButton label={screen === 'name' ? t('กลับหน้าก่อน', 'Back to previous page') : t('ย้อนกลับ', 'Back')} onClick={onBack}>
          <ChevronLeft size={22} />
        </IconButton>

        {/* the step name sits in the top row on phones */}
        <p className="min-w-0 flex-1 font-display text-sm font-semibold text-ink sm:hidden">{animatedLabel}</p>

        <div className="order-last flex min-w-0 basis-full items-center gap-2.5 sm:order-none sm:block sm:flex-1 sm:basis-auto lg:mx-auto lg:max-w-lg">
          <div className="mb-1 hidden items-baseline justify-between gap-2 text-xs font-semibold text-ink sm:flex">
            <span className="min-w-0">{animatedLabel}</span>
            {count}
          </div>
          <StepProgress step={q - 1} total={questions} label={screenLabel(screen)} done={done} />
          <span className="sm:hidden">{count}</span>
        </div>

        <LangToggle size="sm" className="sm:ml-0" />

        {done || !canLeave ? (
          <span className="hidden w-11 shrink-0 sm:block lg:w-24" aria-hidden />
        ) : (
          <Link
            to="/app"
            replace
            onClick={onLeave}
            aria-label={t('ไว้ทีหลัง ข้ามไปหน้าหลักก่อน', 'Later: go to the app for now')}
            className="inline-flex min-h-11 shrink-0 items-center rounded-full px-2.5 text-sm font-semibold text-ink-soft transition-colors hover:bg-white/70 hover:text-ink"
          >
            {t('ไว้ทีหลัง', 'Later')}
          </Link>
        )}
      </div>
    </header>
  )
}
