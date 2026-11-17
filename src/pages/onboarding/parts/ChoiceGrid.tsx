import { AnimatePresence, motion, useAnimate, useReducedMotion } from 'motion/react'
import { Check, ChevronDown, Info, Star } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { OwnOption } from '@/components/ui'
import { MOCHI } from '@/lib/colors'
import { t } from '@/lib/i18n'
import { fadeUp, spring } from '@/lib/motion'
import type { MochiColor } from '@/lib/types'
import { keyWiggle } from './hooks'

export interface Choice {
  /** what gets stored (Thai), and the tile's key */
  value: string
  /** shown in the current language */
  label: string
  /** an emoji or an icon for the round badge (decorative: the label says it all) */
  icon?: ReactNode
  /** a short second line under the label */
  hint?: string
  /** this tile's color, instead of the grid's */
  color?: MochiColor
}

/** The "อื่นๆ ระบุเอง" tile: type your own when nothing fits. */
export interface OwnChoice {
  /** accessible name and field label */
  name: string
  placeholder: string
  maxLength: number
  /** the typed text; return false to keep the field open with it */
  onAdd: (text: string) => boolean
  /** small line under "อื่นๆ ระบุเอง" (grids with hints) */
  hint?: string
}

interface ChoiceGridProps {
  /** the group's accessible name */
  label: string
  choices: readonly Choice[]
  selected: readonly string[]
  /** called to add a value (only while there's room) or to remove one */
  onToggle: (value: string) => void
  /** most that can be picked: shows the "เลือกแล้ว 1/3" pill and dims the rest when full */
  max?: number
  color?: MochiColor
  /** show this many first, behind a quiet "ดูเพิ่มอีก N อย่าง" for the rest (picked ones always show) */
  initial?: number
  own?: OwnChoice
  /** what a picked tile wears on its corner, and the counter's marks */
  mark?: 'check' | 'star'
  /** replaces "เลือกแล้ว n/max" in the counter pill */
  countText?: string
  /** said when they tap another one while full */
  fullNote?: string
}

// "อื่นๆ" is a shared pill (OwnOption): its wrapper shapes it into a tile like the others.
// Child selectors outrank the pill's own classes, and its pencil sits in the same round badge.
const OWN_TILE = [
  '[&>button]:flex [&>button]:h-full [&>button]:min-h-15 [&>button]:w-full [&>button]:gap-2 [&>button]:rounded-[1.4rem] [&>button]:px-2 [&>button]:py-2',
  '@min-[22rem]:[&>button]:gap-2.5 @min-[22rem]:[&>button]:px-2.5',
  '[&>button]:text-left [&>button]:font-display [&>button]:text-[14px] [&>button]:leading-snug [&>button]:whitespace-normal',
  '[&>button>svg]:size-8 [&>button>svg]:shrink-0 [&>button>svg]:rounded-full [&>button>svg]:bg-cream-2 [&>button>svg]:p-2 [&>button>svg]:text-ink-soft',
  '@min-[22rem]:[&>button>svg]:size-9 @min-[22rem]:[&>button>svg]:p-2.5',
  '[&>div]:min-h-15 [&>div]:max-w-none',
].join(' ')

// 2 columns on phones, 3 once the column is wide (tablets). Tiles with a hint line need more
// room, so they go to 3 only on a wider column still.
const COLS = {
  short: '@min-[33rem]:grid-cols-3 @min-[33rem]:gap-2.5',
  hinted: '@min-[40rem]:grid-cols-3 @min-[33rem]:gap-2.5',
}

// the "อื่นๆ" tile fills what's left of the last row; opening its field takes the whole row
const SPAN_2: Record<number, string> = { 1: 'col-span-1', 2: 'col-span-2' }
const SPAN_3 = {
  short: { 1: '@min-[33rem]:col-span-1', 2: '@min-[33rem]:col-span-2', 3: '@min-[33rem]:col-span-3' } as Record<number, string>,
  hinted: { 1: '@min-[40rem]:col-span-1', 2: '@min-[40rem]:col-span-2', 3: '@min-[40rem]:col-span-3' } as Record<number, string>,
}

/**
 * Equal tiles in a calm grid: badge + label (+ hint), a tinted fill, colored border and a
 * check on the corner when picked. With `max`, a counter pill sits on top; once full, the other
 * tiles dim a little and explain themselves when tapped. "อื่นๆ ระบุเอง" is always the last tile,
 * and what they typed shows up as picked tiles just before it.
 */
export function ChoiceGrid({
  label,
  choices,
  selected,
  onToggle,
  max,
  color = 'peach',
  initial,
  own,
  mark = 'check',
  countText,
  fullNote,
}: ChoiceGridProps) {
  const reduce = useReducedMotion()
  const [pill, wiggle] = useAnimate<HTMLParagraphElement>()
  const grid = useRef<HTMLDivElement>(null)
  const [notice, setNotice] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const focusAfterExpand = useRef<string | null>(null)

  const full = max !== undefined && selected.length >= max
  const noticeOn = notice > 0 && full
  const withHints = choices.some((c) => c.hint)

  useEffect(() => {
    if (!notice) return
    const id = window.setTimeout(() => setNotice(0), 2800)
    return () => window.clearTimeout(id)
  }, [notice])

  // the first newly shown tile takes focus, so keyboard users land on what just appeared
  useEffect(() => {
    if (!expanded || !focusAfterExpand.current) return
    const value = focusAfterExpand.current
    focusAfterExpand.current = null
    const tile = [...(grid.current?.querySelectorAll<HTMLElement>('[data-choice]') ?? [])].find((el) => el.dataset.choice === value)
    tile?.focus({ preventScroll: true })
  }, [expanded])

  const showFull = () => {
    setNotice((n) => n + 1)
    if (!reduce && pill.current) wiggle(pill.current, { x: [0, -6, 6, -4, 4, 0] }, { duration: 0.4 })
  }

  const tap = (value: string) => {
    if (!selected.includes(value) && full) return showFull()
    onToggle(value)
  }

  const addOwn = (text: string) => {
    const added = own?.onAdd(text) ?? false
    if (!added && full) showFull()
    return added
  }

  // picked tiles always show; the rest wait behind "ดูเพิ่ม" until it's pressed
  const tucked = initial !== undefined && !expanded ? choices.slice(initial).filter((c) => !selected.includes(c.value)) : []
  const tuckedSet = new Set(tucked.map((c) => c.value))
  const shown = choices.filter((c) => !tuckedSet.has(c.value))

  const size = withHints ? 'hinted' : 'short'
  const cells = shown.length + (tucked.length ? 1 : 0)
  const ownSpan = `${SPAN_2[2 - (cells % 2)]} ${SPAN_3[size][3 - (cells % 3)]}`

  const count = selected.length
  const note = fullNote ?? t(`เลือกได้สูงสุด ${max} อย่าง แตะอันเดิมเพื่อเอาออกนะ`, `You can pick up to ${max}. Tap one again to remove it`)
  const counter = countText ?? t(`เลือกแล้ว ${count}/${max}`, `Picked ${count}/${max}`)
  const accent = MOCHI[color]

  return (
    <motion.div variants={fadeUp} className="@container space-y-2.5">
      {max !== undefined && (
        <div className="flex min-h-8 items-center justify-end" aria-live="polite">
          <p
            ref={pill}
            className={`inline-flex max-w-full items-center gap-2 rounded-2xl px-3 py-1.5 text-xs font-semibold transition-colors duration-200 ${
              noticeOn ? 'bg-butter/70 text-ink' : full ? 'bg-white text-ink shadow-[var(--shadow-soft)]' : 'bg-white/70 text-ink-soft'
            }`}
          >
            <AnimatePresence mode="wait" initial={false}>
              {noticeOn ? (
                <motion.span
                  key={`note-${notice}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.16 }}
                  className="inline-flex min-w-0 items-start gap-1.5"
                >
                  <Info size={14} strokeWidth={2.4} className="mt-px shrink-0" aria-hidden />
                  <span>{note}</span>
                </motion.span>
              ) : (
                <motion.span
                  key="count"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.16 }}
                  className="inline-flex items-center gap-2"
                >
                  <span className="inline-flex items-center gap-1" aria-hidden>
                    {Array.from({ length: max }, (_, i) =>
                      mark === 'star' ? (
                        <Star
                          key={i}
                          size={13}
                          strokeWidth={2.2}
                          className={i < count ? 'text-ink' : 'text-ink/25'}
                          fill={i < count ? MOCHI.butter.shade : 'none'}
                        />
                      ) : (
                        <span
                          key={i}
                          className="block size-2 rounded-full transition-colors duration-200"
                          style={{ background: i < count ? accent.shade : 'rgb(59 38 34 / 0.14)' }}
                        />
                      ),
                    )}
                  </span>
                  <span className="tabular-nums">{counter}</span>
                </motion.span>
              )}
            </AnimatePresence>
          </p>
        </div>
      )}

      <div ref={grid} role="group" aria-label={label} className={`grid grid-cols-2 gap-2 ${COLS[size]}`}>
        <AnimatePresence initial={false}>
          {shown.map((c) => (
            <Tile
              key={c.value}
              choice={c}
              color={c.color ?? color}
              on={selected.includes(c.value)}
              dim={full && !selected.includes(c.value)}
              mark={mark}
              onTap={() => tap(c.value)}
            />
          ))}
        </AnimatePresence>

        {tucked.length > 0 && (
          <button
            type="button"
            aria-expanded={false}
            onClick={() => {
              focusAfterExpand.current = tucked[0]?.value ?? null
              setExpanded(true)
            }}
            className="flex min-h-15 items-center justify-center gap-1.5 rounded-[1.4rem] px-3 text-center font-display text-sm leading-snug font-semibold text-ink-soft transition-colors hover:bg-white/70 hover:text-ink"
          >
            {t(`ดูเพิ่มอีก ${tucked.length} อย่าง`, `See ${tucked.length} more`)}
            <ChevronDown size={16} strokeWidth={2.4} className="shrink-0" aria-hidden />
          </button>
        )}

        {own && (
          <div className={`${ownSpan} has-[input]:col-span-full ${OWN_TILE} transition-opacity duration-200 ${full ? 'opacity-70' : ''}`}>
            <OwnOption
              // the pill's accessible name starts with what it shows ("tap Other" works by voice)
              name={t(`อื่นๆ ระบุเอง: ${own.name}`, `Other (type your own): ${own.name}`)}
              placeholder={own.placeholder}
              maxLength={own.maxLength}
              onAdd={addOwn}
              blocked={full}
              onBlocked={showFull}
              label={
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="wrap-break-word">{t('อื่นๆ ระบุเอง', 'Other (type your own)')}</span>
                  {withHints && (
                    <span className="font-body text-xs leading-snug font-normal text-ink-soft">{own.hint ?? t('พิมพ์ในแบบของเราเอง', 'Say it your own way')}</span>
                  )}
                </span>
              }
            />
          </div>
        )}
      </div>
    </motion.div>
  )
}

interface TileProps {
  choice: Choice
  color: MochiColor
  on: boolean
  /** full: still readable, explains itself when tapped */
  dim: boolean
  mark: 'check' | 'star'
  onTap: () => void
}

function Tile({ choice, color, on, dim, mark, onTap }: TileProps) {
  const reduce = useReducedMotion()
  const p = MOCHI[color]
  return (
    <motion.button
      type="button"
      data-choice={choice.value}
      aria-pressed={on}
      aria-disabled={dim || undefined}
      onClick={onTap}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: dim ? 0.68 : 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.14 } }}
      whileTap={reduce ? undefined : { scale: 0.96 }}
      transition={{ ...spring.bouncy, opacity: { duration: 0.2 } }}
      className={`relative flex h-full min-h-15 w-full items-center gap-2 rounded-[1.4rem] border-2 px-2 py-2 text-left @min-[22rem]:gap-2.5 @min-[22rem]:px-2.5 transition-[background-color,border-color,box-shadow] duration-200 ${
        on ? 'shadow-[var(--shadow-soft)]' : 'border-line/80 bg-white/85 hover:border-line hover:bg-white'
      }`}
      style={on ? { background: p.light, borderColor: p.shade } : undefined}
    >
      <motion.span
        initial={false}
        animate={reduce ? undefined : { rotate: on ? [0, -10, 8, 0] : 0, scale: on ? [1, 1.15, 1] : 1, transition: keyWiggle }}
        className="grid size-8 shrink-0 place-items-center rounded-full text-base leading-none transition-colors duration-200 @min-[22rem]:size-9 @min-[22rem]:text-lg"
        style={{ background: on ? '#fff' : p.light, color: p.ink, boxShadow: on ? `inset 0 -2px 0 ${p.base}` : undefined }}
        aria-hidden
      >
        {choice.icon}
      </motion.span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {/* balanced lines: "เพิ่งย้ายมา / เมืองนี้" instead of "เพิ่งย้ายมาเมือง / นี้" */}
        <span className="font-display text-[14px] leading-snug font-semibold text-balance wrap-break-word text-ink @min-[33rem]:text-[15px]">{choice.label}</span>
        {choice.hint && <span className="text-xs leading-snug text-ink-soft">{choice.hint}</span>}
      </span>

      <AnimatePresence>
        {on && (
          <motion.span
            key="mark"
            initial={reduce ? false : { scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, transition: { duration: 0.12 } }}
            transition={spring.bouncy}
            className={`absolute -top-1.5 -right-1.5 grid size-6 place-items-center rounded-full border-2 border-white shadow-[var(--shadow-soft)] ${
              mark === 'star' ? 'bg-butter text-ink' : 'bg-ink text-cream'
            }`}
            aria-hidden
          >
            {mark === 'star' ? <Star size={12} fill="currentColor" strokeWidth={0} /> : <Check size={13} strokeWidth={3} />}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  )
}
