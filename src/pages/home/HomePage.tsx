import { motion, useReducedMotion } from 'motion/react'
import { Download, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { InstallSheet } from '@/app/InstallSheet'
import { KineticText } from '@/components/motion'
import { Avatar, IconButton, PageHeader } from '@/components/ui'
import { useDataReady } from '@/data/hooks'
import { useInstallPrompt } from '@/lib/hooks'
import { t } from '@/lib/i18n'
import { closeFirstSteps } from '@/lib/progress'
import { useMoshi } from '@/lib/store'
import { Block } from './Block'
import { EventNotifications } from './EventNotifications'
import { FIRST_STEPS_TOTAL, FirstSteps, useFirstSteps, type FirstStepsState } from './FirstSteps'
import { FirstStepsFollowUp } from './FirstStepsFollowUp'
import { greeting } from './greeting'
import { MochiCard } from './MochiCard'
import { NextStep, useNextStep, type Next } from './NextStep'
import { SoftSkeleton } from './Soft'

/** My Moshi: a mood check-in and one next step. */
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
  const next = useNextStep(steps.myId)
  const showSteps = ready && !steps.stepsClosed && steps.done < FIRST_STEPS_TOTAL

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
          <div className="flex shrink-0 items-center gap-2">
            <EventNotifications />
            {!install.installed && (
              <IconButton className="lg:hidden" label={t('ติดตั้งแอปไว้บนหน้าจอโฮม', 'Add the app to your home screen')} onClick={() => setInstallOpen(true)}>
                <Download size={19} />
              </IconButton>
            )}
            {/* phones: the profile lives up here (the tab bar holds คลื่นเดียวกัน) */}
            <Link
              to="/app/me"
              aria-label={t('โปรไฟล์ของเรา', 'My profile')}
              className="inline-flex size-11 items-center justify-center rounded-full bg-white shadow-[var(--shadow-soft)] transition-transform active:scale-90 lg:hidden"
            >
              <Avatar color={color} size={34} face="happy" />
            </Link>
          </div>
        }
      />

      <div className="flex flex-col gap-5 md:gap-6">
        <MochiCard />
        <WhatsNext ready={ready} steps={steps} next={next} showSteps={showSteps} />
      </div>

      <InstallSheet open={installOpen} onClose={() => setInstallOpen(false)} />
      {ready && onboarded && steps.myId && steps.done === FIRST_STEPS_TOTAL && (
        <FirstStepsFollowUp userId={steps.myId} open={!steps.followUpSeen && !installOpen} />
      )}
    </>
  )
}

/** Home zone 2, "ทำอะไรต่อดี": the first steps until they're done (or hidden), then NextStep. */
function WhatsNext({ ready, steps, next, showSteps }: { ready: boolean; steps: FirstStepsState; next: Next | null; showSteps: boolean }) {
  const allDone = steps.done === FIRST_STEPS_TOTAL
  const { myId, stepsClosed } = steps

  useEffect(() => {
    if (ready && myId && allDone && !stepsClosed) closeFirstSteps(myId)
  }, [ready, myId, allDone, stepsClosed])

  if (ready && !showSteps && !next) return null

  return (
    <Block
      id="home-next"
      tone="mint"
      title={t('ทำอะไรต่อดี', "What's next")}
      note={showSteps ? t('ทำทีละขั้น เดี๋ยวโมชิติ๊กให้เอง', 'One at a time. Mochi ticks them off for you') : undefined}
      icon={<Sparkles size={18} strokeWidth={2.4} />}
    >
      {!ready ? <SoftSkeleton rows={1} /> : showSteps ? <FirstSteps steps={steps} /> : next && <NextStep next={next} userId={myId} />}
    </Block>
  )
}
