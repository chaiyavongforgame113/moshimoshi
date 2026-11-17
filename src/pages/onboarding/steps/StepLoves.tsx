import { Star } from 'lucide-react'
import { tagOf } from '@/data/tags'
import { t } from '@/lib/i18n'
import { MAX_LOVES, type StepProps } from '../model'
import { ChoiceGrid, type Choice } from '../parts/ChoiceGrid'

/** 5 · star up to three of the interests just picked as "รักมาก" (skippable). */
export function StepLoves({ draft, update }: StepProps) {
  const toggle = (id: string) => {
    if (draft.loves.includes(id)) return update((d) => ({ loves: d.loves.filter((x) => x !== id) }))
    update((d) => (d.loves.length >= MAX_LOVES ? {} : { loves: [...d.loves, id] }))
  }

  const choices: Choice[] = draft.tags.flatMap((id) => {
    const tag = tagOf(id)
    if (!tag) return []
    const loved = draft.loves.includes(id)
    return [{ value: id, label: tag.label, icon: <Star size={17} strokeWidth={2.2} fill={loved ? 'currentColor' : 'none'} /> }]
  })

  return (
    <ChoiceGrid
      label={t('เรื่องที่เลือกไว้', 'Your interests')}
      choices={choices}
      selected={draft.loves}
      onToggle={toggle}
      max={MAX_LOVES}
      color="butter"
      mark="star"
      countText={t(`รักมาก ${draft.loves.length}/${MAX_LOVES}`, `Love it ${draft.loves.length}/${MAX_LOVES}`)}
      fullNote={t(`ติดดาวได้ ${MAX_LOVES} อย่างนะ แตะดาวอันเดิมเพื่อเอาออกก่อน`, `You can star ${MAX_LOVES}. Tap a starred one to unstar it`)}
    />
  )
}
