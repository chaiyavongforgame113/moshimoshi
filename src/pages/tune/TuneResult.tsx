import { motion, useReducedMotion } from 'motion/react'
import { CalendarHeart, ChevronRight, RotateCcw, Sparkles, Users } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router'
import { MochiStage, View3D } from '@/components/three'
import { Avatar, Button, ButtonLink, SignalMeter, Zone } from '@/components/ui'
import { useMyWaveAnswers, usePerson, useWaveAnswers, useWavelengthMatches } from '@/data/hooks'
import { dateLocale, t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import type { MatchResult, WaveAnswers } from '@/lib/types'
import { agreement, answeredCount, currentRound, QUIZ_MIN_COMMON, sideIcon, type WaveAgreement, type WaveRound } from '@/lib/waveQuiz'

const DAY = 86_400_000

/**
 * "วันจันทร์ที่ 17 พ.ย. (อีก 3 วัน)": when the next round arrives, read in Bangkok time. The bank
 * holds a few rounds that come back around: when the coming one is a round I've already answered,
 * it says so instead of promising new questions.
 */
function nextRoundText(endsAt: number, now: number, answers: WaveAnswers): string {
  const day = new Intl.DateTimeFormat(dateLocale(), { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' }).format(endsAt)
  // endsAt is midnight in Bangkok, so whole days up to it count the days left on the calendar
  const days = Math.max(1, Math.ceil((endsAt - now) / DAY))
  const coming = currentRound(endsAt)
  if (answeredCount(answers, coming.questions) === coming.questions.length) {
    const n = coming.number
    return days === 1
      ? t(`พรุ่งนี้ (${day}) รอบที่ ${n} วนกลับมา จะเปลี่ยนคำตอบหรือดูว่าใครจูนตรงกับเราก็ได้นะ`, `Round ${n} comes back tomorrow (${day}). Change your picks or see who tuned in like you`)
      : t(`รอบที่ ${n} วนกลับมา${day} (อีก ${days} วัน)`, `Round ${n} comes back in ${days} days (${day})`)
  }
  return days === 1
    ? t(`รอบใหม่มาพรุ่งนี้ (${day})`, `New questions tomorrow (${day})`)
    : t(`รอบใหม่มา${day} (อีก ${days} วัน)`, `New questions in ${days} days (${day})`)
}

/** The person on my wavelength (MIN_LEVEL and up) who picked like me most often this round. */
function useBestTuned(round: WaveRound): { match: MatchResult; fit: WaveAgreement } | undefined {
  const matches = useWavelengthMatches()
  const all = useWaveAnswers()
  const mine = useMyWaveAnswers()
  return useMemo(() => {
    let best: { match: MatchResult; fit: WaveAgreement } | undefined
    // best wave first, so a tie goes to the closer wave
    for (const match of matches) {
      const fit = agreement(mine, all[match.userId], round.questions)
      if (fit.common < QUIZ_MIN_COMMON || fit.same === 0) continue
      if (!best || fit.same / fit.common > best.fit.same / best.fit.common) best = { match, fit }
    }
    return best
  }, [matches, all, mine, round])
}

/**
 * The round is done: "คลื่นชัดขึ้นแล้ว!" right after playing (or a calm "ครบแล้ว" on a later visit),
 * the person who tuned in closest, when the next round comes, one button to the People tab and a
 * quiet "ตอบใหม่" to change my picks.
 */
export function TuneResult({ round, now, fresh, onReplay }: { round: WaveRound; now: number; fresh: boolean; onReplay: () => void }) {
  const reduce = useReducedMotion()
  const best = useBestTuned(round)
  const user = usePerson(best?.match.userId)
  const mine = useMyWaveAnswers()
  const heading = useRef<HTMLHeadingElement>(null)

  // just finished: the last card is gone, so the focus lands on the good news
  useEffect(() => {
    if (fresh) heading.current?.focus({ preventScroll: true })
  }, [fresh])

  // a later visit may be a round answered weeks ago that came back around: no "this week"
  const title = fresh ? t('คลื่นชัดขึ้นแล้ว!', 'Your wave just got clearer!') : t(`ตอบรอบที่ ${round.number} ครบแล้ว!`, `Round ${round.number}: all answered!`)

  return (
    <Zone tone="lavender" icon={<Sparkles size={18} strokeWidth={2.4} />} title={t(`รอบที่ ${round.number}`, `Round ${round.number}`)} className="mt-4">
      <div className="grid items-center gap-4 md:grid-cols-[minmax(0,15rem)_1fr] md:gap-6">
        <div className="relative">
          <View3D className="h-44 w-full sm:h-56" label={t('น้องโมชิกระโดดดีใจ', 'Little Mochi bouncing with joy')}>
            <MochiStage color="lavender" expression="happy" zoom={1.05} />
          </View3D>
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...spring.bouncy, delay: 0.2 }}
            aria-hidden
            className="absolute top-1 left-1 max-w-[75%] rounded-3xl rounded-bl-md bg-white px-3.5 py-2 font-display text-sm leading-snug font-semibold text-ink shadow-[var(--shadow-soft)]"
          >
            {fresh ? t('เย้! จูนเสร็จแล้ว~', 'Yay, all tuned in~') : t('เจอกันรอบหน้านะ~', 'See you next round~')}
          </motion.p>
        </div>

        <div className="min-w-0">
          <h2 ref={heading} tabIndex={-1} className="font-display text-2xl leading-tight font-semibold text-ink focus:outline-none sm:text-3xl">
            {title}
          </h2>
          <p className="mt-1 text-ink-soft">
            {t('โมชิเอาคำตอบไปเทียบกับเพื่อนๆ แล้ว คนที่เลือกเหมือนเราจะขยับเข้ามาใกล้ขึ้น', 'Mochi compared your picks with everyone. People who chose like you move a little closer')}
          </p>

          {best && user ? (
            <Link
              to={`/app/people/${user.id}`}
              className="group mt-4 flex items-center gap-3 rounded-3xl bg-white p-3 shadow-[var(--shadow-soft)] ring-1 ring-line transition-colors hover:bg-cream"
            >
              <Avatar color={user.color} size={52} face="happy" online={user.isOnline} />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-ink-soft">{t('จูนตรงกับเรามากที่สุด', 'Tuned in closest to you')}</span>
                <span className="block truncate font-display text-lg font-semibold text-ink">{user.name}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-display text-sm font-semibold text-ink">
                    {t('จูนตรงกัน ', 'Same pick on ')}
                    <span className="tabular-nums">
                      {best.fit.same}/{best.fit.common}
                    </span>
                    {t(' ข้อ', '')}
                  </span>
                  <SignalMeter level={best.match.level} size="xs" short />
                </span>
                <span aria-hidden className="mt-1 block truncate text-base leading-none">
                  {best.fit.agreed.map(({ question, choice }) => sideIcon(question.id, choice)).join(' ')}
                </span>
              </span>
              <ChevronRight size={20} strokeWidth={2.4} aria-hidden className="shrink-0 text-ink-soft transition-transform group-hover:translate-x-0.5" />
            </Link>
          ) : (
            <p className="mt-4 rounded-3xl bg-white/80 p-4 text-ink-soft">
              {t(
                'พอเพื่อนๆ ที่คลื่นตรงกันมาเล่นรอบนี้ด้วย โมชิจะบอกว่าใครจูนตรงกับเราที่สุดนะ',
                "Once people on your wavelength play this round too, Mochi will show who's tuned in closest",
              )}
            </p>
          )}

          <p className="mt-4 flex items-start gap-2 text-sm text-ink-soft">
            <CalendarHeart size={18} strokeWidth={2.2} aria-hidden className="mt-0.5 shrink-0" />
            <span className="min-w-0">{nextRoundText(round.endsAt, now, mine)}</span>
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <ButtonLink to="/app/people" size="lg" className="w-full sm:w-auto" icon={<Users size={20} aria-hidden />}>
              {t('ดูคนคลื่นเดียวกัน', 'See my people')}
            </ButtonLink>
            <Button variant="ghost" onClick={onReplay} className="w-full sm:w-auto" icon={<RotateCcw size={18} strokeWidth={2.4} aria-hidden />}>
              {t('ตอบใหม่', 'Change my picks')}
            </Button>
          </div>
        </div>
      </div>
    </Zone>
  )
}
