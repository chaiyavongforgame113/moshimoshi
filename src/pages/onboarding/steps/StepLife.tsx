import { t } from '@/lib/i18n'
import { isListedLifeStage, LIFE_STAGE_MAX, LIFE_STAGE_TEXT_MAX, LIFE_STAGES, lifeStageEmoji, lifeStageLabel, normalizeLifeStages, sharedLifeStages } from '@/lib/lifeStages'
import type { StepProps } from '../model'
import { ChoiceGrid, type Choice } from '../parts/ChoiceGrid'

/** The ones most people pick, shown first (the rest wait behind "ดูเพิ่ม"). Values as stored. */
const FIRST = ['นักศึกษา', 'เริ่มงานแรก', 'เพิ่งย้ายมาเมืองนี้', 'ทำงานที่บ้าน', 'อยู่คนเดียวครั้งแรก', 'ฟรีแลนซ์', 'กำลังหางาน', 'ทำงานกะดึก'].filter(isListedLifeStage)

/** The list in showing order: the common ones, then the rest as listed. */
const ORDERED = [...FIRST, ...LIFE_STAGES.map((o) => o.value).filter((v) => !FIRST.includes(v))]

/** 7 · ช่วงชีวิต: where life is at right now, up to three (skippable). "อื่นๆ" says it their own way. */
export function StepLife({ draft, update }: StepProps) {
  const toggle = (v: string) => {
    if (draft.lifeStages.includes(v)) return update((d) => ({ lifeStages: d.lifeStages.filter((x) => x !== v) }))
    update((d) => ({ lifeStages: normalizeLifeStages([...d.lifeStages, v]) }))
  }

  const addOwn = (text: string): boolean => {
    const v = normalizeLifeStages([text])[0]
    if (!v) return false
    // typed the same as one already picked (a listed one included): nothing to add
    if (sharedLifeStages([v], draft.lifeStages).length) return true
    if (draft.lifeStages.length >= LIFE_STAGE_MAX) return false
    // typed exactly a listed one: pick that one
    const listed = LIFE_STAGES.find((o) => sharedLifeStages([o.value], [v]).length)?.value
    update((d) => ({ lifeStages: normalizeLifeStages([...d.lifeStages, listed ?? v]) }))
    return true
  }

  // listed stages first, then what they typed themselves (kept while it's picked)
  const choices: Choice[] = [...ORDERED, ...draft.lifeStages.filter((v) => !isListedLifeStage(v))].map((v) => ({
    value: v,
    label: lifeStageLabel(v),
    icon: lifeStageEmoji(v),
  }))

  return (
    <ChoiceGrid
      label={t('ช่วงชีวิตตอนนี้', 'Life stage right now')}
      choices={choices}
      selected={draft.lifeStages}
      onToggle={toggle}
      max={LIFE_STAGE_MAX}
      color="sky"
      initial={FIRST.length}
      own={{
        name: t('พิมพ์ช่วงชีวิตของเราเอง', 'Type your own life stage'),
        placeholder: t('เช่น กำลังเตรียมสอบ', 'e.g. Studying for exams'),
        maxLength: LIFE_STAGE_TEXT_MAX,
        onAdd: addOwn,
      }}
    />
  )
}
