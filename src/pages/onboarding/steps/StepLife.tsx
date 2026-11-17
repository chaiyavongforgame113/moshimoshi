import { motion, useAnimate, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { OwnOption } from '@/components/ui'
import { t } from '@/lib/i18n'
import { isListedLifeStage, LIFE_STAGE_MAX, LIFE_STAGE_TEXT_MAX, LIFE_STAGES, lifeStageEmoji, lifeStageLabel, normalizeLifeStages, sharedLifeStages } from '@/lib/lifeStages'
import { fadeUp } from '@/lib/motion'
import type { StepProps } from '../model'
import { Pill } from '../parts/Pill'

/** 7 · ช่วงชีวิต: where life is at right now, up to three (skippable). "อื่นๆ" says it their own way. */
export function StepLife({ draft, update }: StepProps) {
  const [scope, wiggle] = useAnimate<HTMLSpanElement>()
  const [notice, setNotice] = useState(0)
  const reduce = useReducedMotion()
  const full = draft.lifeStages.length >= LIFE_STAGE_MAX

  const stagesFull = () => {
    setNotice((n) => n + 1)
    if (!reduce && scope.current) wiggle(scope.current, { x: [0, -6, 6, -4, 4, 0], scale: [1, 1.1, 1] }, { duration: 0.4 })
  }

  const toggle = (v: string) => {
    if (draft.lifeStages.includes(v)) return update((d) => ({ lifeStages: d.lifeStages.filter((x) => x !== v) }))
    if (full) return stagesFull()
    update((d) => ({ lifeStages: normalizeLifeStages([...d.lifeStages, v]) }))
  }

  const addOwn = (text: string): boolean => {
    const v = normalizeLifeStages([text])[0]
    if (!v) return false
    // typed the same as one already picked (a listed one included): nothing to add
    if (sharedLifeStages([v], draft.lifeStages).length) return true
    if (full) {
      stagesFull()
      return false
    }
    // typed exactly a listed one: pick that one
    const listed = LIFE_STAGES.find((o) => sharedLifeStages([o.value], [v]).length)?.value
    update((d) => ({ lifeStages: normalizeLifeStages([...d.lifeStages, listed ?? v]) }))
    return true
  }

  // listed stages first, then what they typed themselves (kept while it's picked)
  const choices = [...LIFE_STAGES.map((o) => o.value), ...draft.lifeStages.filter((v) => !isListedLifeStage(v))]

  return (
    <div className="space-y-3">
      <motion.p variants={fadeUp} className="text-sm font-semibold text-ink-soft">
        {t('เลือกแล้ว', 'Picked')}{' '}
        <span ref={scope} className="inline-block text-ink">
          {draft.lifeStages.length}/{LIFE_STAGE_MAX}
        </span>
      </motion.p>

      <motion.div variants={fadeUp} role="group" aria-label={t('ช่วงชีวิตตอนนี้', 'Life stage right now')} className="flex flex-wrap gap-2">
        {choices.map((v) => (
          <Pill
            key={v}
            selected={draft.lifeStages.includes(v)}
            onClick={() => toggle(v)}
            color="sky"
            icon={
              <span aria-hidden className="shrink-0">
                {lifeStageEmoji(v)}
              </span>
            }
          >
            <span className="min-w-0 truncate">{lifeStageLabel(v)}</span>
          </Pill>
        ))}
        <OwnOption
          name={t('พิมพ์ช่วงชีวิตของเราเอง', 'Type your own life stage')}
          placeholder={t('เช่น กำลังเตรียมสอบ', 'e.g. Studying for exams')}
          maxLength={LIFE_STAGE_TEXT_MAX}
          onAdd={addOwn}
          blocked={full}
          onBlocked={stagesFull}
        />
      </motion.div>

      <div aria-live="polite">
        {notice > 0 && full && (
          <p key={notice} className="rounded-2xl bg-butter/50 px-3 py-2 text-sm text-ink">
            {t(`เลือกครบ ${LIFE_STAGE_MAX} อย่างแล้ว แตะอันเดิมเพื่อเอาออกก่อนนะ`, `That's ${LIFE_STAGE_MAX}. Tap one to remove it first`)}
          </p>
        )}
      </div>
    </div>
  )
}
