import { motion, useReducedMotion } from 'motion/react'
import { Download, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { InstallSheet } from '@/app/InstallSheet'
import { KineticText } from '@/components/motion'
import { Avatar, IconButton, PageHeader } from '@/components/ui'
import { useDailyPick, useDataReady } from '@/data/hooks'
import { useInstallPrompt } from '@/lib/hooks'
import { t } from '@/lib/i18n'
import { closeFirstSteps, markFirstStepsSeen } from '@/lib/progress'
import { useMoshi } from '@/lib/store'
import { Block } from './Block'
import { Events } from './Events'
import { FirstSteps, useFirstSteps, type FirstStepsState } from './FirstSteps'
import { greeting } from './greeting'
import { MochiCard } from './MochiCard'
import { NextStep, useNextStep, type Next } from './NextStep'
import { SoftSkeleton } from './Soft'
import { TopMatches } from './TopMatches'

/**
 * /app — "คืนนี้": four calm zones, top to bottom: Little Mochi asks how today went, what to do
 * next (three first steps, then the one thing that matters now), people on your wavelength,
 * and events. Whoever or whatever zone 2 puts forward is left out of the lists below it.
 */
export default function HomePage() {
  const onboarded = useMoshi((s) => s.onboarded)
  const name = useMoshi((s) => s.me.name)
  const color = useMoshi((s) => s.me.color)
  const g = useMemo(() => greeting(), [])
  const install = useInstallPrompt()
  const [installOpen, setInstallOpen] = useState(false)
  const reduce = useReducedMotion()
  // 'เรา' is the stored default display name (data, not UI text), so it stays Thai here
  const showName = onboarded && name && name !== 'เรา'

  const ready = useDataReady()
  const steps = useFirstSteps()
  const next = useNextStep()
  const pick = useDailyPick()
  const showSteps = ready && !steps.stepsClosed && steps.done < 3
  // what zone 2 shows right now: the first steps name today's pick until we've said hi; the
  // "ตอนนี้" card shows one person or one event
  const featuredPerson = showSteps ? (!steps.chatted ? pick?.userId : undefined) : next.kind === 'pick' ? next.match.userId : undefined
  const featuredEvent = !showSteps && (next.kind === 'live' || next.kind === 'upcoming') ? next.session.id : undefined
  const inviteAbove = !showSteps && next.kind === 'invite'

  return (
    <>
      <PageHeader
        title={
          <span className="inline-flex max-w-full items-center gap-2 align-bottom">
            <motion.span
              aria-hidden
              initial={reduce ? false : { rotate: -30, scale: 0.6, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 12, delay: 0.15 }}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-2xl bg-butter/70 lg:size-10"
            >
              <g.Icon size={20} strokeWidth={2.4} />
            </motion.span>
            <KineticText className="min-w-0" text={`${g.hello}${showName ? t(` ${name}`, `, ${name}`) : ''}`} />
          </span>
        }
        subtitle={g.sub}
        action={
          <div className="flex shrink-0 items-center gap-2 lg:hidden">
            {!install.installed && (
              <IconButton label={t('ติดตั้งแอปไว้บนหน้าจอโฮม', 'Add the app to your home screen')} onClick={() => setInstallOpen(true)}>
                <Download size={19} />
              </IconButton>
            )}
            {/* phones: the profile lives up here (the tab bar holds คลื่นเดียวกัน) */}
            <Link
              to="/app/me"
              aria-label={t('โปรไฟล์ของเรา', 'My profile')}
              className="inline-flex size-11 items-center justify-center rounded-full bg-white shadow-[var(--shadow-soft)] transition-transform active:scale-90"
            >
              <Avatar color={color} size={34} face="happy" />
            </Link>
          </div>
        }
      />

      <div className="flex flex-col gap-5 md:gap-6">
        <MochiCard />
        <WhatsNext ready={ready} steps={steps} next={next} showSteps={showSteps} />
        <TopMatches skip={featuredPerson} inviteAbove={inviteAbove} />
        <Events skip={featuredEvent} />
      </div>

      <InstallSheet open={installOpen} onClose={() => setInstallOpen(false)} />
    </>
  )
}

/** Home zone 2, "ทำอะไรต่อดี": the first steps until they're done (or hidden), then NextStep. */
function WhatsNext({ ready, steps, next, showSteps }: { ready: boolean; steps: FirstStepsState; next: Next; showSteps: boolean }) {
  const notify = useMoshi((s) => s.notify)
  const allDone = steps.done === 3
  const { myId, stepsSeen, stepsClosed } = steps

  useEffect(() => {
    if (!ready || !myId || stepsClosed) return
    if (!allDone) {
      markFirstStepsSeen(myId)
      return
    }
    // all three ticked: the card steps aside for good (a cheer only if it was ever shown)
    closeFirstSteps(myId)
    if (stepsSeen) notify(t('ครบ 3 ขั้นแล้ว เก่งมากเลย!', 'All three first steps done. Nicely done!'))
  }, [ready, myId, allDone, stepsSeen, stepsClosed, notify])

  return (
    <Block
      id="home-next"
      tone="mint"
      title={t('ทำอะไรต่อดี', "What's next")}
      note={showSteps ? t('ทำทีละขั้น เดี๋ยวโมชิติ๊กให้เอง', 'One at a time. Mochi ticks them off for you') : t('เรื่องที่น่าทำที่สุดตอนนี้', 'The best thing to do right now')}
      icon={<Sparkles size={18} strokeWidth={2.4} />}
    >
      {!ready ? <SoftSkeleton rows={1} /> : showSteps ? <FirstSteps steps={steps} onHide={() => closeFirstSteps(myId)} /> : <NextStep next={next} />}
    </Block>
  )
}
