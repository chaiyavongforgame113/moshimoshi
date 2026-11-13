import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronDown, ChevronRight, Radio, Sprout } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { Avatar, ReasonIcon, SignalMeter, Zone } from '@/components/ui'
import { useDailyPick, usePerson } from '@/data/hooks'
import { known, t } from '@/lib/i18n'
import { SIGNAL_LEVELS } from '@/lib/matching'
import { fadeUp, spring } from '@/lib/motion'
import { useMoshi } from '@/lib/store'
import type { MatchResult, SignalLevel } from '@/lib/types'
import { ageLabel } from '@/pages/home/greeting'
import type { StepProps } from '../model'
import { Confetti } from '../parts/Fx'
import { SignalBars, TypingDots } from '../parts/Signal'
import { StageBox } from '../parts/StageBox'

/** how long น้องโมชิ "tunes in" before the reveal */
const TUNE_MS = 1500

/**
 * The finish: น้องโมชิ reveals today's wavelength pick ("คลื่นของวันนี้", only "ถูกคอ" and up),
 * with the signal and the first reason. It's the same person home and the People tab offer
 * today, so the "ทักแชท" first step names who they just met. The single next step is the button below (home).
 */
export function StepDone({ desktop, pulse, onOpenProfile }: Pick<StepProps, 'desktop'> & { pulse: number; onOpenProfile: (userId: string) => void }) {
  const me = useMoshi((s) => s.me)
  const top = useDailyPick()
  const reduce = useReducedMotion()
  const [revealed, setRevealed] = useState(!!reduce)

  useEffect(() => {
    if (revealed) return
    const timer = window.setTimeout(() => setRevealed(true), TUNE_MS)
    return () => window.clearTimeout(timer)
  }, [revealed])

  return (
    <div className="space-y-4">
      <Confetti />

      {!desktop && (
        <motion.div variants={fadeUp}>
          <StageBox color={me.color} expression="happy" accessory={me.accessory ?? 'none'} name={me.name} pulse={pulse} heightClass="h-32" showName={false} />
        </motion.div>
      )}

      <motion.div variants={fadeUp}>
        <Zone
          tone="pink"
          icon={<Radio size={18} />}
          title={t('คลื่นของวันนี้', "Today's wavelength")}
          note={t('คนที่คลื่นตรงกับเรา โมชิเลือกมาให้วันนี้', 'Someone on your wavelength, picked by Mochi for today')}
        >
          <div aria-live="polite" aria-busy={!revealed}>
            <AnimatePresence mode="wait" initial={false}>
              {!revealed ? (
                <motion.p
                  key="tuning"
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  className="flex min-h-[5.5rem] items-center justify-center gap-2.5 text-[15px] font-semibold text-ink-soft"
                >
                  <SignalBars tuning className="scale-150" />
                  {t('โมชิกำลังจูนคลื่น', 'Mochi is tuning in')}
                  <TypingDots />
                </motion.p>
              ) : top ? (
                <motion.div key="match" initial={reduce ? false : { opacity: 0, y: 14, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={spring.bouncy}>
                  <TopMatch match={top} myAge={me.age} onOpen={() => onOpenProfile(top.userId)} />
                </motion.div>
              ) : (
                <motion.div key="none" initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring.soft} className="flex items-center gap-3">
                  <Avatar color="cream" size={52} face="wink" />
                  <p className="min-w-0 text-[15px] text-ink">
                    {t(
                      'เพื่อนๆ ยังทยอยมาอยู่นะ เจอใครถูกคอเมื่อไหร่ โมชิจะรีบบอกเลย',
                      "Friends are still arriving. As soon as someone's on your wavelength, I'll let you know",
                    )}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <ScaleLegend />
        </Zone>
      </motion.div>
    </div>
  )
}

function TopMatch({ match, myAge, onOpen }: { match: MatchResult; myAge: number; onOpen: () => void }) {
  const u = usePerson(match.userId)
  if (!u) return null
  const reason = match.reasons[0]
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-[1.6rem] bg-white/90 p-3 text-left shadow-[var(--shadow-soft)] transition-colors hover:bg-white"
      aria-label={t(
        `${u.name} สัญญาณถูกคอ ${match.label}${reason ? ` ${reason.text}` : ''} แตะเพื่อดูโปรไฟล์`,
        `${u.name}, vibe signal: ${match.label}${reason ? `. ${reason.text}` : ''}. Tap to see their profile`,
      )}
    >
      <Avatar color={u.color} size={56} face="smile" online={u.isOnline} />
      <span className="block min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="min-w-0 font-display text-lg font-semibold wrap-break-word text-ink">{u.name}</span>
          <span className="text-xs text-ink-soft">
            {ageLabel(myAge, u.age)} · {known(u.province)}
          </span>
        </span>
        <SignalMeter level={match.level} size="sm" className="mt-0.5" />
        {reason && (
          <span className="mt-1 flex items-start gap-1.5 text-sm text-ink-soft">
            <ReasonIcon kind={reason.kind} />
            <span className="line-clamp-2">{reason.text}</span>
          </span>
        )}
      </span>
      <ChevronRight size={20} className="shrink-0 text-ink-soft" aria-hidden />
    </button>
  )
}

/** The 5-step scale, folded away until asked for; it stacks or wraps, never scrolls sideways. */
function ScaleLegend() {
  const [open, setOpen] = useState(false)
  const reduce = useReducedMotion()
  const id = useId()
  return (
    <div className="mt-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-sm font-semibold text-ink-soft transition-colors hover:bg-white/70 hover:text-ink"
      >
        <Sprout size={15} aria-hidden />
        {t('สัญญาณถูกคอมี 5 ระดับ', 'The vibe signal has 5 levels')}
        <ChevronDown size={16} aria-hidden className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ol
            id={id}
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={spring.soft}
            className="flex flex-wrap gap-2 overflow-hidden pt-1"
          >
            {SIGNAL_LEVELS.map((s) => (
              <li key={s.level} className="flex min-w-0 flex-col items-start gap-1 rounded-2xl bg-white px-3 py-2">
                <SignalMeter level={s.level as SignalLevel} size="xs" showLabel={false} />
                <span className="text-xs font-semibold text-ink">{s.label}</span>
              </li>
            ))}
          </motion.ol>
        )}
      </AnimatePresence>
    </div>
  )
}
