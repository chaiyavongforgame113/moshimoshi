import { motion, useReducedMotion } from 'motion/react'
import { Check } from 'lucide-react'
import { t } from '@/lib/i18n'
import { fadeUp, spring } from '@/lib/motion'
import { BIO_MAX, STORY_MIN, textLength, type StepProps } from '../model'
import { storyQuestion } from '../options'

/** A free-form profile intro. Optional prompt cards can be added from the profile. */
export function StepStory({ draft, update }: StepProps) {
  const reduce = useReducedMotion()
  const len = textLength(draft.bio)
  const remaining = STORY_MIN - len
  const maxLength = Math.max(BIO_MAX, draft.bio.length)

  return (
    <motion.section variants={fadeUp} className="card p-4 transition-shadow focus-within:ring-4 focus-within:ring-peach/35 sm:p-5">
      <textarea
        aria-label={storyQuestion()}
        aria-describedby="ob-story-count"
        rows={4}
        value={draft.bio}
        maxLength={maxLength}
        onChange={(event) => update({ bio: event.target.value })}
        placeholder={t('เขียนคำตอบของเธอตรงนี้…', 'Write your answer here…')}
        className="block w-full resize-none rounded-xl bg-transparent text-base leading-8 text-ink outline-none placeholder:text-ink-faint"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, transparent 0, transparent calc(2rem - 1px), var(--color-line) calc(2rem - 1px), var(--color-line) 2rem)',
          backgroundAttachment: 'local',
        }}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="relative h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-ink/10" aria-hidden>
          <motion.span
            className={`absolute inset-y-0 left-0 rounded-full ${remaining <= 0 ? 'bg-mint' : 'bg-peach'}`}
            initial={false}
            animate={{ width: `${Math.min(100, (len / STORY_MIN) * 100)}%` }}
            transition={reduce ? { duration: 0 } : spring.soft}
          />
        </span>
        <span id="ob-story-count" className="flex shrink-0 items-center gap-1 text-xs font-semibold text-ink-soft">
          {remaining <= 0 ? (
            <>
              <Check size={13} strokeWidth={3} className="text-success" aria-hidden /> {t('กำลังดี', 'Just right')}
            </>
          ) : len ? (
            t(`อีก ${remaining} ตัวอักษร`, `${remaining} more ${remaining === 1 ? 'character' : 'characters'}`)
          ) : (
            t(`อย่างน้อย ${STORY_MIN} ตัวอักษร`, `At least ${STORY_MIN} characters`)
          )}
          <span className="text-ink-soft/80">· {draft.bio.length}/{maxLength}</span>
        </span>
      </div>
    </motion.section>
  )
}
