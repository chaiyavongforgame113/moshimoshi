import { motion, useReducedMotion } from 'motion/react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect, useId, useRef, useState, type Key, type ReactNode } from 'react'
import { t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import { Button } from './Button'

/*
 * <ShowMore> — a list that starts short. Shows the first `initial` items (5), then a soft
 * full-width "ดูเพิ่ม (อีก N)" button that reveals `step` more at a time (default = initial).
 * Once everything shows (and there were more than `initial`), the button turns into
 * "ย่อลง" unless `showLess={false}`. Revealed items fade in, and focus moves to the first
 * of them so keyboard and screen-reader users land on what just appeared.
 *
 *   <ShowMore items={people} initial={5} getKey={(p) => p.id} render={(p) => <PersonRow person={p} />}
 *     listClassName="space-y-2" />
 *
 * Each item sits in an <li> (as="ul" | "ol", the default is "ul") or a <div> (as="div").
 * Renders nothing for an empty list: the caller shows its own empty state.
 */

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface ShowMoreProps<T> {
  items: T[]
  /** how many show at first (default 5) */
  initial?: number
  /** how many more each press reveals (default = initial) */
  step?: number
  render: (item: T, index: number) => ReactNode
  getKey: (item: T, index: number) => Key
  as?: 'ul' | 'ol' | 'div'
  /** the outer wrapper (list + button) */
  className?: string
  /** the list element itself, e.g. "space-y-2" or a grid */
  listClassName?: string
  /** classes for each item's <li>/<div> */
  itemClassName?: string
  /** the button text; gets how many are still hidden */
  moreLabel?: (remaining: number) => string
  /** offer "ย่อลง" once everything shows (default true) */
  showLess?: boolean
}

export function ShowMore<T>({
  items,
  initial = 5,
  step,
  render,
  getKey,
  as = 'ul',
  className = '',
  listClassName = '',
  itemClassName = '',
  moreLabel,
  showLess = true,
}: ShowMoreProps<T>) {
  const first = Math.max(1, initial)
  const by = Math.max(1, step ?? first)
  const [shown, setShown] = useState(first)
  const reduce = useReducedMotion()
  const listId = useId()
  const nodes = useRef(new Map<number, HTMLElement>())
  const button = useRef<HTMLButtonElement>(null)
  // index to focus after the next render (the first newly revealed item), and where new items begin
  const focusAt = useRef<number | null>(null)
  const [revealFrom, setRevealFrom] = useState<number | null>(null)

  const visible = Math.min(shown, items.length)
  const remaining = items.length - visible
  const canLess = showLess && remaining === 0 && items.length > first && visible > first

  useEffect(() => {
    const i = focusAt.current
    if (i === null) return
    focusAt.current = null
    const el = nodes.current.get(i)
    if (!el) return
    const target = el.querySelector<HTMLElement>(FOCUSABLE) ?? el
    target.focus({ preventScroll: true })
    target.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
  }, [visible, reduce])

  if (!items.length) return null

  const more = () => {
    focusAt.current = visible
    setRevealFrom(visible)
    setShown(visible + by)
  }

  const less = () => {
    setRevealFrom(null)
    setShown(first)
    // the list just got shorter: keep the button (which focus stays on) in view
    requestAnimationFrame(() => button.current?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }))
  }

  // one element type for TypeScript; the wrapper is a <div> or an <li> to match the list
  const Item = (as === 'div' ? motion.div : motion.li) as typeof motion.li
  const List = as

  return (
    <div className={className}>
      <List id={listId} className={listClassName}>
        {items.slice(0, visible).map((item, i) => {
          const fresh = revealFrom !== null && i >= revealFrom && !reduce
          return (
            <Item
              key={getKey(item, i)}
              ref={(el: HTMLElement | null) => {
                if (el) nodes.current.set(i, el)
                else nodes.current.delete(i)
              }}
              tabIndex={-1}
              className={itemClassName || undefined}
              initial={fresh ? { opacity: 0, y: 12 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={fresh ? { ...spring.soft, delay: Math.min(i - (revealFrom ?? 0), 6) * 0.04 } : { duration: 0 }}
            >
              {render(item, i)}
            </Item>
          )
        })}
      </List>
      {(remaining > 0 || canLess) && (
        <Button
          ref={button}
          variant="soft"
          block
          aria-controls={listId}
          icon={remaining > 0 ? <ChevronDown size={18} strokeWidth={2.4} aria-hidden /> : <ChevronUp size={18} strokeWidth={2.4} aria-hidden />}
          onClick={remaining > 0 ? more : less}
          className="mt-3 min-w-0"
        >
          <span className="truncate">
            {remaining > 0
              ? (moreLabel?.(remaining) ?? t(`ดูเพิ่ม (อีก ${remaining})`, `Show more (${remaining} more)`))
              : t('ย่อลง', 'Show less')}
          </span>
        </Button>
      )}
    </div>
  )
}
