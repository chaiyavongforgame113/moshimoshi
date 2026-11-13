import { AnimatePresence, motion } from 'motion/react'
import { Heart, Plus, Search, Sparkles } from 'lucide-react'
import { useId, useMemo, useState, type ReactNode } from 'react'
import { OwnOption } from '@/components/ui'
import { CATEGORY_LABEL, isOwnTag, OWN_TAG_MAX, ownTagId, sameTag, tagMatches, tagOf, TAGS } from '@/data/tags'
import { CATEGORY_COLOR } from '@/lib/colors'
import { t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import { useMoshi } from '@/lib/store'
import type { Tag } from '@/lib/types'
import { PickChip, fieldClass } from './bits'

/** how many of my own interests show as one-tap chips */
const MINE_MAX = 10

/**
 * Step 2 "เรื่องอะไร?": my own interests first (loved ones on top) as one-tap chips,
 * then a search for anything else, with the template's ideas and "อื่นๆ" under it.
 */
export function TagPicker({ value, onChange, suggestions }: { value: string; onChange: (id: string) => void; suggestions: string[] }) {
  const [q, setQ] = useState('')
  const loves = useMoshi((s) => s.me.loves)
  const myTags = useMoshi((s) => s.me.tags)
  const searchId = useId()
  const query = q.trim().toLowerCase()

  const mine = useMemo(() => [...new Set([...loves, ...myTags])].flatMap((id) => tagOf(id) ?? []).slice(0, MINE_MAX), [loves, myTags])
  const ideas = useMemo(
    () => suggestions.filter((id) => !mine.some((tg) => sameTag(tg.id, id))).flatMap((id) => tagOf(id) ?? []).slice(0, 8),
    [suggestions, mine],
  )
  const results = useMemo(() => {
    if (!query) return []
    const own = myTags.filter(isOwnTag).flatMap((id) => tagOf(id) ?? [])
    return [
      ...own.filter((tg) => tg.label.toLowerCase().includes(query)),
      ...TAGS.filter((tg) => tagMatches(tg, query) || CATEGORY_LABEL[tg.category].toLowerCase().includes(query)),
    ].slice(0, 18)
  }, [query, myTags])

  const selected = value ? tagOf(value) : undefined
  // picked from a search (or saved on a post being edited) and not among the chips on screen
  const shown = query ? [...mine, ...results] : [...mine, ...ideas]
  const offScreen = selected && !shown.some((tg) => sameTag(tg.id, selected.id)) ? selected : undefined
  // what they typed, if it isn't one we already show
  const typedId = query ? ownTagId(q) : null
  const typed = typedId && isOwnTag(typedId) && !results.some((tg) => sameTag(tg.id, typedId)) ? tagOf(typedId) : undefined

  const pick = (id: string) => {
    onChange(value === id ? '' : id)
    setQ('')
  }
  const chip = (tg: Tag) => (
    <motion.span key={tg.id} layout className="max-w-full" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }} transition={spring.bouncy}>
      <PickChip selected={sameTag(value, tg.id)} color={CATEGORY_COLOR[tg.category]} onClick={() => pick(tg.id)}>
        <span className="min-w-0 truncate">{tg.label}</span>
      </PickChip>
    </motion.span>
  )

  return (
    <div className="flex flex-col gap-5">
      <div aria-live="polite">
        {offScreen && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-ink-soft">{t('เลือกแล้ว:', 'Picked:')}</span>
            {chip(offScreen)}
          </div>
        )}
      </div>

      {mine.length > 0 && (
        <ChipGroup icon={<Heart size={15} strokeWidth={2.6} aria-hidden />} label={t('เรื่องที่เราชอบ', 'Things you love')}>
          {mine.map(chip)}
        </ChipGroup>
      )}

      <div>
        <label htmlFor={searchId} className="mb-2 block text-sm font-semibold text-ink-soft">
          {mine.length ? t('หรือค้นหาเรื่องอื่น', 'Or search for something else') : t('ค้นหาเรื่องที่อยากชวน', 'Search for a topic')}
        </label>
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-soft" aria-hidden />
          <input
            id={searchId}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              // Enter picks the first result; on an empty search it's the wizard's Next
              if (e.key !== 'Enter' || e.nativeEvent.isComposing || !query) return
              e.preventDefault()
              if (results[0]) pick(results[0].id)
              else if (typed) pick(typed.id)
            }}
            placeholder={t('เช่น วาโล, ญี่ปุ่น, คาเฟ่', 'e.g. Valo, Japanese, café')}
            className={`${fieldClass} min-h-12 pl-11`}
            autoComplete="off"
          />
        </div>
      </div>

      {query ? (
        <ChipGroup
          label={t(`ผลการค้นหา (${results.length})`, `Results (${results.length})`)}
          extra={
            typed && (
              <PickChip selected={false} onClick={() => pick(typed.id)} icon={<Plus size={16} strokeWidth={2.8} className="shrink-0" aria-hidden />} className="max-w-full border-2 border-dashed border-ink/25">
                <span className="min-w-0 truncate">{t(`ใช้ "${typed.label}"`, `Use "${typed.label}"`)}</span>
              </PickChip>
            )
          }
        >
          {results.map(chip)}
        </ChipGroup>
      ) : (
        <ChipGroup
          icon={<Sparkles size={15} strokeWidth={2.6} aria-hidden />}
          label={t('ไอเดียสำหรับแบบนี้', 'Ideas for this one')}
          extra={
            <OwnOption
              label={t('อื่นๆ พิมพ์เอง', 'Other (type your own)')}
              name={t('พิมพ์เรื่องที่อยากชวนเอง', 'Type your own topic')}
              placeholder={t('เช่น ปีนผา, ทำเซรามิก', 'e.g. climbing, pottery')}
              maxLength={OWN_TAG_MAX}
              onAdd={(text) => {
                const id = ownTagId(text)
                if (!id) return false
                onChange(id)
              }}
            />
          }
        >
          {ideas.map(chip)}
        </ChipGroup>
      )}
    </div>
  )
}

/** A labelled row of chips that wraps (never scrolls sideways); `extra` sits at the end, unanimated. */
function ChipGroup({ label, icon, extra, children }: { label: string; icon?: ReactNode; extra?: ReactNode; children: ReactNode }) {
  const id = useId()
  return (
    <div role="group" aria-labelledby={id}>
      <p id={id} className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink-soft">
        {icon}
        {label}
      </p>
      <motion.div layout className="flex flex-wrap gap-2">
        <AnimatePresence mode="popLayout" initial={false}>
          {children}
        </AnimatePresence>
        {extra}
      </motion.div>
    </div>
  )
}
