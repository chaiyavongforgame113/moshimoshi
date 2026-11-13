import { ArrowLeftRight, ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { Section, ShowMore } from '@/components/ui'
import { useMyWaveAnswers, usePersonWaveAnswers } from '@/data/hooks'
import { t } from '@/lib/i18n'
import type { User } from '@/lib/types'
import { agreement, answeredCount, QUIZ_MIN_COMMON, sideIcon, sideLabel } from '@/lib/waveQuiz'

/**
 * "จูนคลื่นตรงกัน 6/8": how our this-or-that picks line up, with the ones we agree on folding
 * open underneath. Only with at least QUIZ_MIN_COMMON questions in common; before I've played,
 * one soft link to /app/tune instead (the page's one main button stays "ทักแชท").
 */
export function QuizBlock({ user }: { user: User }) {
  const mine = useMyWaveAnswers()
  const theirs = usePersonWaveAnswers(user.id)
  const played = answeredCount(mine) > 0

  if (!played) {
    const theyPlayed = answeredCount(theirs) >= QUIZ_MIN_COMMON
    return (
      <Link
        to="/app/tune"
        className="group mt-5 flex items-center gap-3 rounded-[2rem] bg-white/75 p-4 shadow-[var(--shadow-soft)] ring-1 ring-line transition-colors hover:bg-white"
      >
        <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-lavender/40 text-xl">
          🏖️
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display font-semibold text-ink">{t('เล่นจูนคลื่น', 'Play this or that')}</span>
          <span className="block text-sm text-ink-soft">
            {theyPlayed
              ? t(`${user.name}เล่นแล้ว ลองเล่นดูว่าเราจูนตรงกันกี่ข้อ`, `${user.name} has played. See how many you pick the same`)
              : t('ตอบเร็วๆ 8 ข้อ แล้วดูว่าจูนตรงกับใครบ้าง', '8 quick picks, then see who you line up with')}
          </span>
        </span>
        <ArrowRight size={18} strokeWidth={2.4} aria-hidden className="shrink-0 text-ink-soft transition-transform group-hover:translate-x-0.5" />
      </Link>
    )
  }

  const fit = agreement(mine, theirs)
  if (fit.common < QUIZ_MIN_COMMON) return null

  return (
    <Section tone="lavender" icon={<ArrowLeftRight size={18} strokeWidth={2.4} />} title={t('จูนคลื่น', 'This or that')}>
      <p className="font-display text-xl leading-snug font-semibold text-ink">
        {t('จูนคลื่นตรงกัน ', 'You match on ')}
        <span className="tabular-nums">
          {fit.same}/{fit.common}
        </span>
        {t(' ข้อ', '')}
      </p>
      <Dots same={fit.same} common={fit.common} />

      {fit.same > 0 ? (
        <>
          <h3 className="mt-4 mb-2 text-sm font-semibold text-ink-soft">{t('ข้อที่เลือกเหมือนกัน', 'Where you picked the same side')}</h3>
          <ShowMore
            items={fit.agreed}
            initial={3}
            getKey={({ question }) => question.id}
            listClassName="grid gap-2 sm:grid-cols-2"
            render={({ question, choice }) => (
              <div className="flex h-full items-center gap-3 rounded-3xl bg-white p-3 shadow-[var(--shadow-soft)]">
                <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-lavender/30 text-xl">
                  {sideIcon(question.id, choice)}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold break-words text-ink">{sideLabel(question, choice)}</span>
                  <span className="block text-xs break-words text-ink-soft">
                    {t(`มากกว่า${sideLabel(question, choice === 0 ? 1 : 0)}`, `over ${sideLabel(question, choice === 0 ? 1 : 0)}`)}
                  </span>
                </span>
              </div>
            )}
          />
        </>
      ) : (
        <p className="mt-3 rounded-2xl bg-white/70 p-4 text-ink-soft">
          {t('ยังไม่ตรงกันสักข้อ ต่างกันแบบนี้ก็มีเรื่องให้คุยเยอะดีนะ', 'Not one the same yet. Opposites make for plenty to talk about')}
        </p>
      )}
    </Section>
  )
}

/** One dot per question in common, filled where we agree (the numbers above say it for screen readers). */
function Dots({ same, common }: { same: number; common: number }) {
  if (common > 16) return null
  return (
    <span aria-hidden className="mt-2 flex flex-wrap gap-1.5">
      {Array.from({ length: common }, (_, i) => (
        <span key={i} className={`size-2.5 rounded-full ${i < same ? 'bg-lavender' : 'bg-ink/12'}`} />
      ))}
    </span>
  )
}
