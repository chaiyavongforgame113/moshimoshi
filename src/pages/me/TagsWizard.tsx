import { motion } from 'motion/react'
import { Star } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { OwnOption, TagChip, Wizard } from '@/components/ui'
import { CATEGORY_LABEL, isOwnTag, MAX_OWN_TAGS, OWN_TAG_MAX, ownTagId, sameTag, tagOf, TAGS } from '@/data/tags'
import { t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import { useMoshi } from '@/lib/store'
import type { TagCategory } from '@/lib/types'

const MIN_TAGS = 3
const MAX_LOVES = 3

const CATEGORIES = (Object.keys(CATEGORY_LABEL) as TagCategory[]).filter((c) => c !== 'other')

/** My interests in two questions: what I'm into (3 or more), then which ones I love most (up to 3 stars). */
export function TagsWizard({ start = 0, onDone }: { start?: number; onDone: () => void }) {
  const me = useMoshi((s) => s.me)
  const updateMe = useMoshi((s) => s.updateMe)
  const [tags, setTags] = useState<string[]>(me.tags)
  const [loves, setLoves] = useState<string[]>(me.loves.filter((id) => me.tags.includes(id)))
  // the stars need enough interests to pick from first
  const [step, setStep] = useState(me.tags.length >= MIN_TAGS ? Math.min(Math.max(start, 0), 1) : 0)
  const grouped = useMemo(() => CATEGORIES.map((c) => ({ c, tags: TAGS.filter((tag) => tag.category === c) })), [])
  const ids = useId()
  const own = tags.filter(isOwnTag).flatMap((id) => tagOf(id) ?? [])
  const ownFull = own.length >= MAX_OWN_TAGS
  const missing = Math.max(0, MIN_TAGS - tags.length)

  const addOwn = (text: string): boolean => {
    const id = ownTagId(text)
    if (!id) return false
    if (tags.some((x) => sameTag(x, id))) return true
    if (isOwnTag(id) && ownFull) return false
    setTags([...tags, id])
    return true
  }

  const toggleTag = (id: string) => {
    if (tags.includes(id)) {
      setTags(tags.filter((x) => x !== id))
      setLoves(loves.filter((x) => x !== id))
    } else setTags([...tags, id])
  }
  const toggleLove = (id: string) => {
    if (loves.includes(id)) setLoves(loves.filter((x) => x !== id))
    else if (loves.length < MAX_LOVES) setLoves([...loves, id])
    else setLoves([...loves.slice(1), id]) // keep the newest three
  }

  const save = () => {
    updateMe({ tags, loves })
    onDone()
  }

  return (
    <Wizard
      step={step}
      onStep={setStep}
      onFinish={save}
      finishLabel={t('บันทึก', 'Save')}
      steps={[
        {
          key: 'pick',
          title: t('ชอบเรื่องอะไรบ้าง?', 'What are you into?'),
          hint: missing
            ? t(`เลือกอย่างน้อย ${MIN_TAGS} เรื่อง (อีก ${missing} เรื่อง) ยิ่งตรงใจ ยิ่งเจอคนคลื่นเดียวกันง่าย`, `Pick at least ${MIN_TAGS} (${missing} more to go). The truer your picks, the easier it is to find your people`)
            : t(`เลือกไว้ ${tags.length} เรื่องแล้ว เลือกเพิ่มได้อีกนะ`, `${tags.length} picked. Add more if you like`),
          valid: missing === 0,
          content: (
            <div className="space-y-4">
              {grouped.map(({ c, tags: list }) => (
                <section key={c} aria-labelledby={`${ids}-${c}`}>
                  <h3 id={`${ids}-${c}`} className="mb-2 text-sm font-semibold text-ink-soft">
                    {CATEGORY_LABEL[c]}
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {list.map((tag) => (
                      <TagChip key={tag.id} tag={tag} selected={tags.includes(tag.id)} onClick={() => toggleTag(tag.id)} />
                    ))}
                  </div>
                </section>
              ))}
              <section aria-labelledby={`${ids}-other`}>
                <h3 id={`${ids}-other`} className="text-sm font-semibold text-ink-soft">
                  {CATEGORY_LABEL.other}
                </h3>
                <p className="mb-2 text-xs text-ink-soft">
                  {ownFull
                    ? t(`เพิ่มเองครบ ${MAX_OWN_TAGS} เรื่องแล้ว แตะเรื่องเดิมเพื่อเอาออกได้นะ`, `That's ${MAX_OWN_TAGS} of your own. Tap one to remove it`)
                    : t('ไม่เจอเรื่องที่ชอบในรายการ? พิมพ์เองได้เลย', "Can't find yours on the list? Type it in")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {own.map((tag) => (
                    <TagChip key={tag.id} tag={tag} selected onClick={() => toggleTag(tag.id)} />
                  ))}
                  <OwnOption
                    name={t('เพิ่มเรื่องที่ชอบเอง', 'Add your own interest')}
                    placeholder={t('เช่น ปีนผา, ทำเซรามิก', 'e.g. climbing, pottery')}
                    maxLength={OWN_TAG_MAX}
                    onAdd={addOwn}
                    stayOpen
                    blocked={ownFull}
                  />
                </div>
              </section>
            </div>
          ),
        },
        {
          key: 'love',
          title: t('เรื่องไหนที่รักมาก?', 'Which ones do you love most?'),
          hint: t(
            `ติดดาวได้ ${MAX_LOVES} เรื่อง (ติดแล้ว ${loves.length}) คนที่อินเรื่องเดียวกันจะเจอเราแม่นขึ้น`,
            `Star up to ${MAX_LOVES} (${loves.length} starred), so people who are just as into them find you`,
          ),
          content: (
            <ul aria-label={t('เรื่องที่ชอบ แตะเพื่อติดดาว', 'My interests, tap to star')} className="flex flex-wrap gap-2">
              {tags.map((id) => {
                const tag = tagOf(id)
                if (!tag) return null
                const on = loves.includes(id)
                return (
                  <li key={id} className="max-w-full">
                    <motion.button
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleLove(id)}
                      whileTap={{ scale: 0.9 }}
                      transition={spring.bouncy}
                      className={`relative inline-flex h-11 max-w-full items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium text-ink transition-colors ${
                        on ? 'border-butter bg-butter shadow-[inset_0_-2px_0_rgb(59_38_34/0.12)]' : 'border-line bg-white hover:bg-cream'
                      }`}
                    >
                      <motion.span animate={{ rotate: on ? 72 : 0, scale: on ? 1.15 : 1 }} transition={spring.bouncy} className="inline-flex shrink-0">
                        <Star size={15} strokeWidth={2.4} className={on ? 'fill-white' : ''} aria-hidden />
                      </motion.span>
                      <span className="min-w-0 truncate">{tag.label}</span>
                    </motion.button>
                  </li>
                )
              })}
            </ul>
          ),
        },
      ]}
    />
  )
}
