import { motion } from 'motion/react'
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { spring } from '@/lib/motion'

export interface TabItem<K extends string> {
  key: K
  label: string
  icon?: ReactNode
  badge?: number
}

/** ids that tie a tab to its panel: give the panel `id={tabPanelId(base, key)}` and `aria-labelledby={tabId(base, key)}`. */
export const tabId = (base: string, key: string) => `${base}-tab-${key}`
export const tabPanelId = (base: string, key: string) => `${base}-panel-${key}`

/**
 * Segmented pill tabs with a sliding squishy indicator. Never scrolls sideways:
 * the tabs share the row in equal columns (as wide as the longest label when the
 * strip is `w-fit`, squeezing evenly when space runs out), and a label that no
 * longer fits wraps onto a second short line. Icons show from sm up, so three
 * tabs fit at 320px; there a badge sits on the tab's corner instead of beside the label. Arrow keys / Home / End move between tabs.
 */
export function Tabs<K extends string>({
  items,
  value,
  onChange,
  idBase,
  className = '',
}: {
  items: TabItem<K>[]
  value: K
  onChange: (k: K) => void
  /** pass to wire aria-controls to panels built with tabPanelId() */
  idBase?: string
  className?: string
}) {
  const id = useId()
  const refs = useRef(new Map<K, HTMLButtonElement>())

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = items.findIndex((t) => t.key === value)
    let next = -1
    if (e.key === 'ArrowRight') next = (i + 1) % items.length
    else if (e.key === 'ArrowLeft') next = (i - 1 + items.length) % items.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = items.length - 1
    if (next < 0) return
    e.preventDefault()
    const k = items[next].key
    onChange(k)
    refs.current.get(k)?.focus()
  }

  return (
    <div
      role="tablist"
      onKeyDown={onKeyDown}
      className={`grid min-w-0 auto-cols-fr grid-flow-col gap-1 rounded-[1.6rem] bg-white/70 p-1 shadow-[var(--shadow-soft)] ${className}`}
    >
      {items.map((t) => {
        const active = t.key === value
        return (
          <button
            key={t.key}
            ref={(el) => {
              if (el) refs.current.set(t.key, el)
              else refs.current.delete(t.key)
            }}
            role="tab"
            type="button"
            id={idBase ? tabId(idBase, t.key) : undefined}
            aria-controls={idBase ? tabPanelId(idBase, t.key) : undefined}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.key)}
            className={`relative flex min-h-11 min-w-0 items-center justify-center rounded-[1.35rem] px-2 py-1 font-display text-[13px] leading-tight font-semibold transition-colors sm:px-4 sm:text-sm ${active ? 'text-ink' : 'text-ink-soft hover:text-ink'}`}
          >
            {active && (
              <motion.span
                layoutId={`tab-${id}`}
                className="absolute inset-0 rounded-[1.35rem] bg-butter shadow-[inset_0_-2px_0_rgb(59_38_34/0.12)]"
                transition={spring.bouncy}
              />
            )}
            <span className="relative flex min-w-0 items-center justify-center gap-1.5">
              {t.icon && (
                <span className="hidden shrink-0 sm:inline-flex" aria-hidden>
                  {t.icon}
                </span>
              )}
              {/* words wrap at spaces (Thai at word breaks); only a single word wider than the whole tab is split */}
              <span className="line-clamp-2 min-w-0 text-center wrap-break-word">{t.label}</span>
            </span>
            {/* below sm the count sits on the tab's corner, so it never takes width from the label */}
            {!!t.badge && (
              <span className="relative inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-coral px-1.5 text-[11px] leading-none text-ink max-sm:absolute max-sm:-top-1.5 max-sm:-right-1.5 max-sm:ring-2 max-sm:ring-white sm:ml-1.5">
                {t.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
