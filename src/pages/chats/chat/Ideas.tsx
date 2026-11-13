import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Lightbulb } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject, type SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'
import { MOCHI } from '@/lib/colors'
import { t } from '@/lib/i18n'
import { spring } from '@/lib/motion'

type Field = HTMLInputElement | HTMLTextAreaElement

/** where the list sits: a fixed band from the top of the visible screen down to just above the composer (or, without room there, below it) */
interface Box {
  left: number
  width: number
  top: number
  height: number
  below: boolean
}

const DOTS = [MOCHI.butter.shade, MOCHI.mint.shade, MOCHI.lavender.shade, MOCHI.pink.shade, MOCHI.sky.shade, MOCHI.peach.shade]
const GAP = 8
const MAX_WIDTH = 352
const MAX_HEIGHT = 320
/** less room than this above the composer, and more below: the list opens below it instead */
const MIN_ABOVE = 160

function measure(anchor: HTMLElement): Box {
  const a = anchor.getBoundingClientRect()
  const vw = document.documentElement.clientWidth
  // the visual viewport: with a phone keyboard up only the part above it shows
  const vv = window.visualViewport
  const viewTop = (vv?.offsetTop ?? 0) + GAP
  const viewBottom = (vv?.offsetTop ?? 0) + (vv?.height ?? window.innerHeight) - GAP
  const width = Math.min(a.width, MAX_WIDTH, vw - GAP * 2)
  const left = Math.max(GAP, Math.min(a.left, vw - GAP - width))
  const above = a.top - GAP - viewTop
  const below = viewBottom - (a.bottom + GAP)
  if (above < MIN_ABOVE && below > above) return { left, width, top: a.bottom + GAP, height: below, below: true }
  return { left, width, top: viewTop, height: Math.max(0, above), below: false }
}

const same = (a: Box | null, b: Box) =>
  !!a && a.left === b.left && a.width === b.width && a.top === b.top && a.height === b.height && a.below === b.below

/** pressing a button would take the focus off the text field (and drop a phone keyboard) */
const keepFocus = (e: SyntheticEvent) => e.preventDefault()

/**
 * The "ไอเดีย / Ideas" button of a chat composer: a short vertical list of
 * ready-made lines that opens above the composer, so it never covers the text
 * being typed (with a phone keyboard up, the list only uses the space above
 * the composer; only when that space is too small does it open below). Picking one puts it in the text field (added after what is
 * already typed) and closes the list; nothing is sent until the person sends it.
 *
 * Menu-button pattern: Enter / Space / ↓ open it on the first idea, ↑ on the
 * last (also when it is already open); ↑ ↓ Home End move, Esc closes back to
 * the button, Tab closes to the text field. A tap outside closes it. Opened by a tap while typing, the focus
 * stays in the text field so the keyboard doesn't drop.
 */
export function Ideas({
  ideas,
  anchor,
  input,
  onFill,
  title,
  className = '',
}: {
  ideas: string[]
  /** the composer box: the list opens above it, lined up with its left edge */
  anchor: RefObject<HTMLElement | null>
  /** the text field the picked idea goes into */
  input: RefObject<Field | null>
  /** the field's new text */
  onFill: (text: string) => void
  /** heading of the list (also its name for screen readers) */
  title: string
  className?: string
}) {
  const id = useId()
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [box, setBox] = useState<Box | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const items = useRef<(HTMLButtonElement | null)[]>([])
  /** the idea that takes the focus once the list shows (-1: the last), or none while the person keeps typing */
  const focusAt = useRef<number | null>(null)
  const shown = open && ideas.length > 0

  const show = (at: number | null) => {
    const el = anchor.current
    if (!el) return
    setBox(measure(el))
    focusAt.current = at
    setOpen(true)
  }

  useEffect(() => {
    if (!shown || focusAt.current === null) return
    const at = focusAt.current
    focusAt.current = null
    items.current[at < 0 ? ideas.length - 1 : at]?.focus({ preventScroll: true })
  }, [shown, ideas.length])

  // while open: follow the composer (page scroll, keyboard, a growing text box), close on a tap outside or Esc
  useEffect(() => {
    if (!shown) return
    let raf = 0
    const place = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const el = anchor.current
        if (!el) return
        const next = measure(el)
        setBox((prev) => (same(prev, next) ? prev : next))
      })
    }
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (panel.current?.contains(target) || button.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const inside = !!panel.current?.contains(document.activeElement)
      setOpen(false)
      if (inside) button.current?.focus()
    }
    const vv = window.visualViewport
    const ro = new ResizeObserver(place)
    if (anchor.current) ro.observe(anchor.current)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, { capture: true, passive: true })
    vv?.addEventListener('resize', place)
    vv?.addEventListener('scroll', place)
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, { capture: true })
      vv?.removeEventListener('resize', place)
      vv?.removeEventListener('scroll', place)
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [shown, anchor])

  const pick = (idea: string) => {
    const field = input.current
    const now = field?.value.trim() ?? ''
    // an untouched idea is swapped for the new one; anything the person wrote stays, the idea goes after it
    const text = !now || ideas.includes(now) ? idea : `${field!.value.trimEnd()} ${idea}`
    const max = field && field.maxLength > 0 ? field.maxLength : 1000
    onFill(text.slice(0, max))
    setOpen(false)
    if (!field) return
    field.focus({ preventScroll: true })
    // after the new text is in: caret at the end, ready to add to it or send
    requestAnimationFrame(() => {
      const f = input.current
      if (f) f.setSelectionRange(f.value.length, f.value.length)
    })
  }

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const list = items.current.slice(0, ideas.length)
    const at = list.indexOf(document.activeElement as HTMLButtonElement)
    const go = (i: number) => {
      e.preventDefault()
      list[(i + list.length) % list.length]?.focus()
    }
    if (e.key === 'ArrowDown') go(at + 1)
    else if (e.key === 'ArrowUp') go(at < 0 ? -1 : at - 1)
    else if (e.key === 'Home') go(0)
    else if (e.key === 'End') go(-1)
    else if (e.key === 'Tab') {
      e.preventDefault()
      setOpen(false)
      if (e.shiftKey) button.current?.focus()
      else input.current?.focus({ preventScroll: true })
    }
  }

  if (!ideas.length) return null

  return (
    <>
      <motion.button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={shown}
        aria-controls={shown ? `${id}-menu` : undefined}
        title={title}
        onPointerDown={keepFocus}
        onMouseDown={keepFocus}
        onClick={(e) => {
          if (shown) return setOpen(false)
          // a tap while typing leaves the focus (and the keyboard) where it is; otherwise straight into the list
          const typing = e.detail > 0 && !!input.current && document.activeElement === input.current
          show(typing ? null : 0)
        }}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
          e.preventDefault()
          const at = e.key === 'ArrowDown' ? 0 : -1
          // already open (a tap while typing left the focus in the text field): step straight into the list
          if (shown) items.current[at < 0 ? ideas.length - 1 : at]?.focus({ preventScroll: true })
          else show(at)
        }}
        whileTap={{ scale: 0.88 }}
        transition={spring.bouncy}
        className={`inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-full border font-display text-sm font-semibold text-ink shadow-[var(--shadow-soft)] transition-colors @min-[22rem]:px-3.5 ${
          shown ? 'border-butter bg-butter' : 'border-line bg-white hover:bg-cream-2'
        } ${className}`}
      >
        <Lightbulb size={19} strokeWidth={2.3} aria-hidden className="shrink-0" />
        {/* the word shows once the composer has room for it; the button keeps it as its name either way */}
        <span className="sr-only @min-[22rem]:not-sr-only">{t('ไอเดีย', 'Ideas')}</span>
      </motion.button>

      {createPortal(
        <AnimatePresence>
          {shown && box && (
            <div
              key="ideas"
              className={`pointer-events-none fixed z-50 flex flex-col ${box.below ? 'justify-start' : 'justify-end'}`}
              style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
            >
              <motion.div
                ref={panel}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: box.below ? -10 : 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: box.below ? -6 : 6, scale: 0.98, transition: { duration: 0.14 } }}
                transition={reduce ? { duration: 0 } : spring.soft}
                style={{ transformOrigin: box.below ? 'top left' : 'bottom left', maxHeight: Math.min(box.height, MAX_HEIGHT) }}
                className="pointer-events-auto flex min-h-0 flex-col overflow-hidden rounded-[1.6rem] border border-white bg-cream shadow-[var(--shadow-lift)]"
              >
                <div className="shrink-0 px-4 pt-3 pb-1">
                  <p id={`${id}-title`} className="flex items-center gap-2 font-display text-[15px] font-semibold text-ink">
                    <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-butter/70" aria-hidden>
                      <Lightbulb size={15} strokeWidth={2.4} />
                    </span>
                    <span className="min-w-0">{title}</span>
                  </p>
                  <p className="mt-1 text-xs leading-snug text-ink-soft">
                    {t('เลือกอันที่ชอบ แล้วแก้ก่อนส่งได้นะ', 'Pick one, then tweak it before you send')}
                  </p>
                </div>
                <div
                  id={`${id}-menu`}
                  role="menu"
                  aria-labelledby={`${id}-title`}
                  onKeyDown={onMenuKey}
                  className="min-h-0 overflow-y-auto overscroll-contain p-1.5"
                >
                  {ideas.map((idea, i) => (
                    <button
                      key={idea}
                      ref={(el) => {
                        items.current[i] = el
                      }}
                      type="button"
                      role="menuitem"
                      tabIndex={-1}
                      onPointerDown={keepFocus}
                      onMouseDown={keepFocus}
                      onClick={() => pick(idea)}
                      className="flex min-h-11 w-full items-start gap-2.5 rounded-2xl px-3 py-2.5 text-left text-[15px] leading-snug text-ink transition-colors hover:bg-white focus-visible:bg-white"
                    >
                      <span aria-hidden className="mt-[0.45rem] size-2 shrink-0 rounded-full" style={{ backgroundColor: DOTS[i % DOTS.length] }} />
                      <span className="min-w-0 [overflow-wrap:anywhere]">{idea}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
