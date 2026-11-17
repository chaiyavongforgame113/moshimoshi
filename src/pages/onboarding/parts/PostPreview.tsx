import { animate, AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronDown, Clock3, MapPin, Megaphone, PencilLine, RotateCcw, Wifi } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { MOCHI } from '@/lib/colors'
import { known, L, t, texts } from '@/lib/i18n'
import { ease, spring } from '@/lib/motion'
import type { Room } from '@/lib/types'
import {
  buildIntent,
  editPost,
  postEditOf,
  POST_TEXT_MAX,
  suggestedIntent,
  tidyPostText,
  type Draft,
  type IntentDraft,
  type PostWhen,
  type UpdateDraft,
} from '../model'

const WHEN_OPTIONS: PostWhen[] = ['tonight', 'weekend', 'anytime']
const WHEN_LABEL = texts({
  tonight: L('คืนนี้', 'Tonight'),
  weekend: L('สุดสัปดาห์นี้', 'This weekend'),
  anytime: L('ว่างเมื่อไหร่ก็ได้', 'Anytime'),
})

/** the count shows once they're this close to the limit */
const NEAR = 20

interface PostPreviewProps {
  draft: Draft
  update: UpdateDraft
  province: string
  rooms: Room[]
}

/**
 * The board post the chosen "มาที่นี่เพื่อ…" turns into, editable right here: the words (Mochi's
 * sentence until they type their own; cleared means Mochi's again), when, and online or in person.
 * What they change is kept in the draft per template, so it survives Back, Next and a language switch.
 */
export function PostPreview({ draft, update, province, rooms }: PostPreviewProps) {
  const suggested = suggestedIntent(draft, province, rooms)
  const post = buildIntent(draft, province, rooms)
  if (!suggested || !post) return null
  return <PostCard suggested={suggested.text} post={post} typed={postEditOf(draft).text} update={update} province={province} />
}

interface PostCardProps {
  /** น้องโมชิ's sentence */
  suggested: string
  /** the post as it will go up */
  post: IntentDraft
  /** what they typed, if anything (may be blank while they're mid-edit) */
  typed: string | undefined
  update: UpdateDraft
  province: string
}

function PostCard({ suggested, post, typed, update, province }: PostCardProps) {
  const reduce = useReducedMotion()
  const id = useId()
  const titleId = `${id}-title`
  const hintId = `${id}-hint`
  const countId = `${id}-count`
  const field = useRef<HTMLTextAreaElement>(null)
  const bubble = useRef<HTMLDivElement>(null)
  const p = MOCHI.pink

  const value = typed ?? suggested
  const own = typed !== undefined && !!tidyPostText(typed) && tidyPostText(typed) !== suggested
  const near = value.length >= POST_TEXT_MAX - NEAR

  // grow with the words: one line to three, then it scrolls (max-height caps it)
  useLayoutEffect(() => fit(field.current), [value])
  useEffect(() => {
    const el = field.current
    if (!el || typeof ResizeObserver === 'undefined') return
    let width = el.clientWidth
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === width) return
      width = el.clientWidth
      fit(el)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // a soft blink when Mochi rewrites the line (another topic or card), never while they type
  const shown = typed === undefined ? suggested : null
  const lastShown = useRef(shown)
  useEffect(() => {
    if (lastShown.current === shown) return
    const was = lastShown.current
    lastShown.current = shown
    if (shown === null || was === null || reduce || !bubble.current) return
    void animate(bubble.current, { opacity: [0.35, 1], y: [4, 0] }, { duration: 0.34, ease: ease.out })
  }, [shown, reduce])

  const setText = (text: string | undefined) => update(editPost({ text }))
  const reset = (e: MouseEvent<HTMLButtonElement>) => {
    setText(undefined)
    // keyboard users land back in the text (the button goes away); a tap shouldn't pop the keyboard
    if (e.detail === 0) field.current?.focus()
  }

  const place = post.province ?? province
  const placeLabel = t(`เจอกันที่${place}`, `Meet in ${known(place)}`)

  return (
    <section aria-labelledby={titleId} className="rounded-[1.5rem] bg-cream-2/80 p-3.5 ring-1 ring-white/70 ring-inset sm:p-4">
      <div className="flex items-center gap-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white shadow-[var(--shadow-soft)]" style={{ color: p.ink }} aria-hidden>
          <Megaphone size={13} strokeWidth={2.4} />
        </span>
        <h3 id={titleId} className="min-w-0 font-display text-[13px] leading-snug font-semibold text-ink sm:text-sm">
          {t('โมชิจะโพสต์ชวนเพื่อนให้แบบนี้', "I'll post this to invite friends")}
        </h3>
      </div>

      {/* the words: a chat bubble that is the text field itself */}
      <div
        ref={bubble}
        className="group relative mt-2.5 rounded-[1.3rem] rounded-bl-md border-2 border-transparent bg-white shadow-[var(--shadow-soft)] transition-colors hover:border-line focus-within:border-[var(--post-ring)] focus-within:hover:border-[var(--post-ring)]"
        style={{ '--post-ring': p.shade } as CSSProperties}
      >
        <textarea
          ref={field}
          rows={1}
          value={value}
          maxLength={POST_TEXT_MAX}
          placeholder={suggested}
          enterKeyHint="done"
          aria-labelledby={titleId}
          aria-describedby={`${hintId} ${countId}`}
          onChange={(e) => {
            // typed back to exactly Mochi's sentence: no edit, so it follows the topic again
            const v = e.target.value.replace(/[\r\n]+/g, ' ')
            setText(v === suggested ? undefined : v)
          }}
          onKeyDown={(e) => {
            // one line: Enter means "done", never a new line (and never mid-IME composition)
            if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.keyCode === 229) return
            e.preventDefault()
            if (!e.shiftKey) e.currentTarget.blur()
          }}
          // cleared it all, or left Mochi's sentence as it was (give or take spaces): no edit, so
          // Mochi's line comes back and keeps following the topic
          onBlur={() => {
            if (typed === undefined) return
            const v = tidyPostText(typed)
            if (!v || v === suggested) setText(undefined)
          }}
          className="block max-h-[5.75rem] w-full resize-none rounded-[inherit] bg-transparent py-2.5 pr-10 pl-3.5 text-base leading-normal [overflow-wrap:anywhere] text-ink outline-none placeholder:text-ink-faint"
        />
        <PencilLine
          size={16}
          className="pointer-events-none absolute top-3 right-3.5 text-ink-faint transition-opacity group-focus-within:opacity-0"
          aria-hidden
        />
      </div>

      <div className="mt-0.5 flex min-h-8 items-center justify-between gap-3">
        <AnimatePresence mode="wait" initial={false}>
          {own ? (
            <motion.button
              key="reset"
              type="button"
              onClick={reset}
              initial={reduce ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={spring.soft}
              className="relative inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-ink-soft transition-colors after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] hover:bg-white/80 hover:text-ink"
            >
              <RotateCcw size={13} strokeWidth={2.4} aria-hidden />
              {t('ใช้ข้อความที่โมชิเขียนให้', "Use Mochi's line")}
            </motion.button>
          ) : (
            <motion.p
              key="hint"
              id={hintId}
              initial={reduce ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={spring.soft}
              className="inline-flex items-center gap-1.5 px-2.5 text-xs text-ink-soft"
            >
              <PencilLine size={13} aria-hidden />
              {t('แตะเพื่อแก้ข้อความได้เลย', 'Tap the text to edit it')}
            </motion.p>
          )}
        </AnimatePresence>
        <span id={countId} className={near ? 'shrink-0 pr-1 text-xs font-semibold text-ink tabular-nums' : 'sr-only'}>
          <span className="sr-only">{t('จำนวนตัวอักษร ', 'Characters ')}</span>
          {value.length}/{POST_TEXT_MAX}
        </span>
      </div>

      <div role="group" aria-label={t('เวลาและที่นัด', 'When and where')} className="mt-0.5 flex flex-wrap gap-1.5">
        <ChipSelect
          icon={<Clock3 size={13} strokeWidth={2.4} aria-hidden />}
          label={t('ช่วงเวลา', 'When')}
          value={post.when as PostWhen}
          options={WHEN_OPTIONS.map((w) => ({ value: w, label: WHEN_LABEL[w] }))}
          onChange={(when) => update(editPost({ when }))}
        />
        <ChipSelect
          icon={post.mode === 'online' ? <Wifi size={13} strokeWidth={2.4} aria-hidden /> : <MapPin size={13} strokeWidth={2.4} aria-hidden />}
          label={t('ออนไลน์หรือเจอตัว', 'Online or in person')}
          value={post.mode}
          options={[
            { value: 'online', label: t('ออนไลน์', 'Online') },
            { value: 'offline', label: placeLabel },
          ]}
          onChange={(mode) => update(editPost({ mode }))}
        />
      </div>
    </section>
  )
}

function fit(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

interface ChipSelectProps<V extends string> {
  icon: ReactNode
  /** what the choice is about, for screen readers */
  label: string
  value: V
  options: { value: V; label: string }[]
  onChange: (value: V) => void
}

/**
 * A small pill that shows the current choice and opens the device's own picker (an invisible
 * native select over the pill: the iOS wheel / Android sheet, keyboard and screen readers for free).
 */
function ChipSelect<V extends string>({ icon, label, value, options, onChange }: ChipSelectProps<V>) {
  const current = options.find((o) => o.value === value)?.label ?? ''
  return (
    <span className="relative inline-flex h-8 max-w-full items-center gap-1 rounded-full border border-line bg-white/90 pr-2 pl-2.5 text-xs font-semibold text-ink transition-colors hover:bg-white has-[select:focus-visible]:outline-3 has-[select:focus-visible]:outline-offset-2 has-[select:focus-visible]:outline-lavender">
      {icon}
      <span className="min-w-0 truncate">{current}</span>
      <ChevronDown size={13} strokeWidth={2.4} className="shrink-0 text-ink-soft" aria-hidden />
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as V)}
        // 16px so iOS doesn't zoom in; a little taller than the pill for a comfy tap
        className="absolute inset-x-0 -inset-y-1.5 w-full cursor-pointer appearance-none rounded-full text-base opacity-0"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  )
}
