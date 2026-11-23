import { Search, X } from 'lucide-react'
import { useDeferredValue, useId, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router'
import { IconButton, ShowMore } from '@/components/ui'
import { useDataReady, usePeople } from '@/data/hooks'
import { CATEGORY_LABEL, isOwnTag, tagKey, tagMatches, tagOf } from '@/data/tags'
import { getLang, t } from '@/lib/i18n'
import { useMoshi } from '@/lib/store'
import { PersonRow } from './PersonRow'
import { ListSkeleton } from './Skeleton'

export function InterestSearch() {
  const ready = useDataReady()
  const people = usePeople()
  const myAge = useMoshi((s) => s.me.age)
  const inputId = useId()
  const input = useRef<HTMLInputElement>(null)
  const [params, setParams] = useSearchParams()
  const text = params.get('q') ?? ''
  const query = useDeferredValue(text.trim().normalize('NFC').toLowerCase())
  const lang = getLang()

  const matches = useMemo(() => {
    if (!query) return []
    return people.flatMap((person) => {
      const labels = new Map<string, string>()
      for (const id of [...person.tags, ...person.loves]) {
        const tag = tagOf(id)
        if (!tag) continue
        const categoryMatches = !isOwnTag(id) && CATEGORY_LABEL[tag.category].toLowerCase().includes(query)
        if (tagMatches(tag, query) || categoryMatches) labels.set(tagKey(id), tag.label)
      }
      return labels.size ? [{ person, interests: [...labels.values()] }] : []
    }).sort((a, b) => a.person.name.localeCompare(b.person.name, lang))
  }, [lang, people, query])

  const setQuery = (value: string) =>
    setParams((p) => {
      if (value) p.set('q', value)
      else p.delete('q')
      return p
    }, { replace: true, preventScrollReset: true })

  return (
    <div className="mt-4 space-y-3">
      <form role="search" className="relative" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor={inputId} className="sr-only">{t('ค้นหาคนตามความสนใจ', 'Search people by interest')}</label>
        <Search size={19} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-soft" aria-hidden />
        <input
          ref={input}
          id={inputId}
          type="search"
          value={text}
          autoComplete="off"
          placeholder={t('ลองค้นหา วาโล ถ่ายรูป หรือจิบลิ', 'Try Valorant, photography, or Ghibli')}
          onChange={(event) => setQuery(event.target.value)}
          className="glass h-13 w-full rounded-full pr-13 pl-11 text-base outline-none focus-visible:ring-3 focus-visible:ring-lavender [&::-webkit-search-cancel-button]:hidden"
        />
        {text && (
          <IconButton
            label={t('ล้างคำค้นหา', 'Clear search')}
            variant="ghost"
            className="absolute top-1 right-1"
            onClick={() => {
              setQuery('')
              input.current?.focus()
            }}
          >
            <X size={18} aria-hidden />
          </IconButton>
        )}
      </form>

      {query && !ready ? (
        <ListSkeleton count={3} label={t('กำลังโหลดผลการค้นหา…', 'Loading search results…')} />
      ) : (
        <p role="status" className="px-1 text-sm text-ink-soft">
          {!query
            ? t('พิมพ์เรื่องที่สนใจเพื่อหาคนที่ชอบเหมือนกัน', 'Search for any interest to find people who like it.')
            : matches.length
              ? t(`พบ ${matches.length} คน`, `${matches.length} ${matches.length === 1 ? 'person' : 'people'} found`)
              : t('ยังไม่เจอใครที่สนใจเรื่องนี้ ลองคำอื่นดูนะ', 'Nobody lists that interest yet. Try another search.')}
        </p>
      )}

      {ready && matches.length > 0 && (
        <ShowMore
          key={query}
          items={matches}
          initial={8}
          getKey={({ person }) => person.id}
          render={({ person, interests }) => <PersonRow user={person} myAge={myAge} matchingInterests={interests} />}
          listClassName="grid gap-3 xl:grid-cols-2"
        />
      )}
    </div>
  )
}
