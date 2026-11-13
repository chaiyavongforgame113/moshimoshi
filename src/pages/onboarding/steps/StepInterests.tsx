import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronDown, Plus, Search, X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Avatar, Button, OwnOption } from '@/components/ui'
import { usePeople } from '@/data/hooks'
import { CATEGORY_LABEL, isOwnTag, MAX_OWN_TAGS, OWN_TAG_MAX, ownTagId, sameTag, tagMatches, tagOf, TAG_BY_ID, TAGS, tagsInText } from '@/data/tags'
import { CATEGORY_COLOR } from '@/lib/colors'
import { t } from '@/lib/i18n'
import { fadeUp, spring } from '@/lib/motion'
import type { Tag, TagCategory, User } from '@/lib/types'
import type { StepProps } from '../model'
import { InterestChip } from '../parts/InterestChip'
import { Pill } from '../parts/Pill'

const CATEGORIES = Object.keys(CATEGORY_LABEL) as TagCategory[]
const POPULAR_COUNT = 12
/** a friendly mix for a brand-new server where nobody has picked anything yet */
const STARTERS = ['valorant', 'genshin', 'cozygame', 'frieren', 'ghibli', 'kpop', 'concert', 'kdrama', 'cafe', 'mookata', 'cat', 'japanese', 'nightowl', 'astrology']

/** The tags most people here picked, topped up with starters. */
function popularTags(people: User[]): Tag[] {
  const count = new Map<string, number>()
  for (const u of people) for (const id of u.tags) if (TAG_BY_ID[id]) count.set(id, (count.get(id) ?? 0) + 1)
  const ranked = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
  const ids = [...new Set([...ranked, ...STARTERS])].slice(0, POPULAR_COUNT)
  return ids.flatMap((id) => TAG_BY_ID[id] ?? [])
}

/** Label, alias or free-text match ("วาโล", "ญุ่น", "stardew" all work). */
function searchTags(query: string): Tag[] {
  const q = query.trim().toLowerCase()
  if (!q) return TAGS
  const hits = new Set(tagsInText(q))
  return TAGS.filter((t) => hits.has(t.id) || tagMatches(t, q))
}

type View = 'popular' | TagCategory

/**
 * 4 · interests (at least 3). Search, or tap from the popular ones; "หมวดหมู่" opens the
 * categories as wrapping pills. Only one group of tags shows at a time, never a sideways row.
 */
export function StepInterests({ draft, update }: StepProps) {
  const people = usePeople()
  const popular = useMemo(() => popularTags(people), [people])
  const [query, setQuery] = useState('')
  const [view, setView] = useState<View>('popular')
  const [browsing, setBrowsing] = useState(false)
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null)
  const title = useRef<HTMLHeadingElement>(null)
  const pillsId = useId()
  const reduce = useReducedMotion()

  const searching = query.trim().length > 0
  const own = useMemo(() => draft.tags.filter(isOwnTag).flatMap((id) => tagOf(id) ?? []), [draft.tags])
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? [...own.filter((t) => t.label.toLowerCase().includes(q)), ...searchTags(query)] : []
  }, [query, own])
  const shown = searching ? results : view === 'popular' ? popular : view === 'other' ? [] : TAGS.filter((t) => t.category === view)
  const heading = searching ? t(`ผลการค้นหา "${query.trim()}"`, `Results for "${query.trim()}"`) : view === 'popular' ? t('ยอดนิยม', 'Popular') : CATEGORY_LABEL[view]

  const pickedIn = (c: TagCategory) => draft.tags.filter((t) => tagOf(t)?.category === c).length
  const ownFull = own.length >= MAX_OWN_TAGS

  // what they typed in the search box, if it isn't something we already have
  const typedId = searching ? ownTagId(query) : null
  const typed = typedId && isOwnTag(typedId) && !draft.tags.some((t) => sameTag(t, typedId)) ? tagOf(typedId) : undefined

  useEffect(() => {
    if (!notice) return
    const t = window.setTimeout(() => setNotice(null), 2600)
    return () => window.clearTimeout(t)
  }, [notice])

  const toggle = (id: string) =>
    update((d) => (d.tags.includes(id) ? { tags: d.tags.filter((t) => t !== id), loves: d.loves.filter((t) => t !== id) } : { tags: [...d.tags, id] }))

  const ownLimit = () =>
    setNotice({
      id: Date.now(),
      text: t(`เพิ่มเองได้ ${MAX_OWN_TAGS} เรื่องนะ เอาเรื่องเดิมออกก่อนได้เลย`, `You can add ${MAX_OWN_TAGS} of your own. Remove one first`),
    })

  /** Their own words → a tag (or the listed one if it's already there). False when there's no room left. */
  const addOwn = (text: string): boolean => {
    const id = ownTagId(text)
    if (!id) return false
    if (draft.tags.some((t) => sameTag(t, id))) return true
    if (isOwnTag(id) && ownFull) {
      ownLimit()
      return false
    }
    update((d) => ({ tags: [...d.tags, id] }))
    return true
  }

  const choose = (v: View) => {
    setView(v)
    setBrowsing(false)
    // the pill they pressed folds away: land on the group it opened
    requestAnimationFrame(() => title.current?.focus({ preventScroll: true }))
  }

  return (
    <div className="space-y-3">
      <motion.div variants={fadeUp} className="relative">
        <label htmlFor="ob-tag-search" className="sr-only">
          {t('ค้นหาเรื่องที่ชอบ', 'Search interests')}
        </label>
        <Search size={19} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-soft" aria-hidden />
        <input
          id="ob-tag-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            // Enter picks the first match (or adds what they typed) instead of moving to the next step
            if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return
            e.preventDefault()
            if (!searching) return
            const first = results[0]
            if (first) {
              if (!draft.tags.includes(first.id)) toggle(first.id)
              setQuery('')
            } else if (addOwn(query)) setQuery('')
          }}
          enterKeyHint="search"
          autoComplete="off"
          placeholder={t('ลองพิมพ์ วาโล, ญี่ปุ่น, แมว, คาเฟ่…', 'Try Valo, Japanese, cat, café…')}
          className="h-12 w-full rounded-full border-2 border-line bg-white pr-12 pl-11 text-base text-ink shadow-[var(--shadow-soft)] outline-none placeholder:text-ink-faint focus:border-peach focus-visible:ring-4 focus-visible:ring-peach/40 [&::-webkit-search-cancel-button]:hidden"
        />
        <AnimatePresence>
          {searching && (
            <motion.button
              type="button"
              initial={reduce ? false : { scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={spring.bouncy}
              onClick={() => setQuery('')}
              aria-label={t('ล้างคำค้นหา', 'Clear search')}
              className="absolute top-1/2 right-0.5 grid size-11 -translate-y-1/2 place-items-center rounded-full text-ink-soft hover:text-ink"
            >
              <X size={18} />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>

      <motion.section variants={fadeUp} aria-labelledby="ob-tags-title">
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h2 id="ob-tags-title" ref={title} tabIndex={-1} className="min-w-0 truncate font-display text-base font-semibold text-ink outline-none">
            {heading}
          </h2>
          {!searching && (
            <button
              type="button"
              aria-expanded={browsing}
              aria-controls={pillsId}
              onClick={() => setBrowsing((b) => !b)}
              className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-white/85 px-3.5 text-sm font-semibold text-ink ring-1 ring-line transition-colors hover:bg-white"
            >
              {t('หมวดหมู่', 'Categories')}
              <ChevronDown size={16} aria-hidden className={`transition-transform ${browsing ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>

        {/* categories: wrapping pills, open on request so the tags stay in view */}
        <AnimatePresence initial={false}>
          {browsing && !searching && (
            <motion.div
              key="cats"
              id={pillsId}
              initial={reduce ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={spring.soft}
              className="overflow-hidden"
            >
              <div role="group" aria-label={t('เลือกหมวด', 'Pick a category')} className="flex flex-wrap gap-1.5 pt-1 pb-3">
                <Pill selected={view === 'popular'} onClick={() => choose('popular')} color="peach">
                  {t('ยอดนิยม', 'Popular')}
                </Pill>
                {CATEGORIES.map((c) => {
                  const picked = pickedIn(c)
                  return (
                    <Pill key={c} selected={view === c} onClick={() => choose(c)} color={CATEGORY_COLOR[c]}>
                      {CATEGORY_LABEL[c]}
                      {picked > 0 && (
                        <span className="ml-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[11px] font-bold text-cream">
                          <span className="sr-only">{t('เลือกแล้ว', 'picked')} </span>
                          {picked}
                        </span>
                      )}
                    </Pill>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {searching && !results.length && typed ? (
          <div className="space-y-3 rounded-3xl bg-white/70 p-4">
            <div className="flex items-center gap-3">
              <Avatar color="cream" size={44} face="wow" />
              <p className="min-w-0 text-[15px] [overflow-wrap:anywhere] text-ink">
                {t(`ยังไม่มี "${typed.label}" ในรายการเลย เพิ่มเองได้นะ`, `"${typed.label}" isn't on the list yet. Add it yourself!`)}
              </p>
            </div>
            <Button block icon={<Plus size={18} strokeWidth={2.8} aria-hidden />} onClick={() => addOwn(query) && setQuery('')}>
              <span className="min-w-0 truncate">{t(`เพิ่ม "${typed.label}"`, `Add "${typed.label}"`)}</span>
            </Button>
          </div>
        ) : (
          <>
            {!searching && view === 'other' && (
              <p className="mb-2 text-sm text-ink-soft">
                {ownFull
                  ? t(`เพิ่มเองครบ ${MAX_OWN_TAGS} เรื่องแล้ว แตะเรื่องเดิมเพื่อเอาออกได้นะ`, `That's ${MAX_OWN_TAGS} of your own. Tap one to remove it`)
                  : t('ไม่เจอเรื่องที่ชอบในรายการ? พิมพ์เองได้เลย', "Can't find yours on the list? Type it in")}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {shown.map((tag) => (
                <InterestChip key={tag.id} tag={tag} selected={draft.tags.includes(tag.id)} loved={draft.loves.includes(tag.id)} onToggle={() => toggle(tag.id)} />
              ))}
              {searching && typed && (
                <Pill onClick={() => addOwn(query) && setQuery('')} icon={<Plus size={15} strokeWidth={2.8} className="shrink-0" aria-hidden />} className="border-2 border-dashed border-ink/25 font-semibold">
                  <span className="min-w-0 truncate">{t(`เพิ่ม "${typed.label}" เอง`, `Add "${typed.label}" myself`)}</span>
                </Pill>
              )}
              {searching && !results.length && !typed && (
                <p className="text-sm text-ink-soft">{t('ไม่เจอเลย ลองคำอื่นดูนะ', 'Nothing found. Try another word')}</p>
              )}
              {/* the last choice: nothing fits, so say it in your own words */}
              {!searching && (
                <>
                  {own.map((tag) => (
                    <InterestChip key={tag.id} tag={tag} selected loved={draft.loves.includes(tag.id)} onToggle={() => toggle(tag.id)} />
                  ))}
                  <OwnOption
                    name={t('เพิ่มเรื่องที่ชอบเอง', 'Add your own interest')}
                    placeholder={t('เช่น ปีนผา, ทำเซรามิก', 'e.g. climbing, pottery')}
                    maxLength={OWN_TAG_MAX}
                    onAdd={addOwn}
                    stayOpen
                    blocked={ownFull}
                    onBlocked={ownLimit}
                  />
                </>
              )}
            </div>
          </>
        )}

        <div aria-live="polite">
          <AnimatePresence>
            {notice && (
              <motion.p
                key={notice.id}
                initial={reduce ? false : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-3 rounded-2xl bg-butter/50 px-3 py-2 text-sm text-ink"
              >
                {notice.text}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </motion.section>
    </div>
  )
}
