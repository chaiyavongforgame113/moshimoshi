import { motion } from 'motion/react'
import { SendHorizontal } from 'lucide-react'
import { forwardRef, useId, useLayoutEffect, useRef, useState } from 'react'
import { IconButton, OwnOption } from '@/components/ui'
import { MOCHI } from '@/lib/colors'
import { t } from '@/lib/i18n'
import { pop, spring, stagger } from '@/lib/motion'
import { MAX_TEXT, type ChipDef, type Dock as DockSpec } from './engine'

/**
 * The bottom of the chat: Mochi's quick replies (they wrap, never a sideways
 * row), "อื่นๆ" where the list is about the person, and a text box only where
 * the script invites typing.
 */
export const Dock = forwardRef<
  HTMLDivElement,
  {
    dock: DockSpec
    /** Mochi is still typing: hold the chips back until the line that leads to them lands */
    typing: boolean
    onChip: (key: string) => void
    onOwn: (kind: 'mood' | 'topic', text: string) => void
    onText: (text: string) => void
    /** changes whenever the step does, so the chips pop in again */
    stepKey: string
  }
>(function Dock({ dock, typing, onChip, onOwn, onText, stepKey }, ref) {
  const showChips = !typing && (dock.chips.length > 0 || !!dock.own)
  const showAside = !typing && !!dock.aside
  if (!showChips && !showAside && !dock.composer) return <div ref={ref} />
  return (
    <div ref={ref} className="space-y-3">
      {showChips && (
        <motion.div
          key={stepKey}
          role="group"
          aria-label={t('ตอบโมชิ', 'Reply to Mochi')}
          initial="hidden"
          animate="show"
          variants={stagger(0.05)}
          className="flex flex-wrap gap-2"
        >
          {dock.chips.map((c) => (
            <ReplyChip key={c.key} chip={c} onClick={() => onChip(c.key)} />
          ))}
          {dock.own && (
            // a direct flex child: opened, its field takes the whole row
            <OwnOption
              name={dock.own === 'mood' ? t('ความรู้สึกอื่นๆ', 'Another feeling') : t('เรื่องอื่นๆ', 'Something else')}
              placeholder={dock.own === 'mood' ? t('เช่น งงๆ กังวลนิดหน่อย', 'e.g. confused, a little worried') : t('อยากคุยเรื่องอะไร พิมพ์ได้เลย', 'What would you like to talk about?')}
              maxLength={dock.own === 'mood' ? 60 : 120}
              onAdd={(text) => onOwn(dock.own!, text.trim())}
            />
          )}
        </motion.div>
      )}

      {showAside && dock.aside && (
        <button
          type="button"
          onClick={() => onChip(dock.aside!.key)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-sm font-semibold text-ink-soft underline decoration-dotted decoration-2 underline-offset-4 transition-colors hover:text-ink"
        >
          {dock.aside.Icon && <dock.aside.Icon size={16} aria-hidden className="shrink-0" />}
          {dock.aside.label}
        </button>
      )}

      {dock.composer && <Composer placeholder={dock.composer} onSend={onText} />}
    </div>
  )
})

function ReplyChip({ chip: c, onClick }: { chip: ChipDef; onClick: () => void }) {
  const p = c.color ? MOCHI[c.color] : undefined
  return (
    <motion.button
      type="button"
      variants={pop}
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.92 }}
      transition={spring.bouncy}
      className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full border px-4 py-2 text-left font-display text-[15px] leading-snug font-semibold text-ink shadow-[var(--shadow-soft)]"
      style={p ? { background: p.light, borderColor: p.base, boxShadow: `inset 0 -3px 0 ${p.base}` } : { background: '#fff', borderColor: '#F1DDD0' }}
    >
      {c.Icon && <c.Icon size={18} strokeWidth={2.4} aria-hidden className="shrink-0" />}
      <span className="min-w-0 [overflow-wrap:anywhere]">{c.label}</span>
    </motion.button>
  )
}

function Composer({ placeholder, onSend }: { placeholder: string; onSend: (text: string) => void }) {
  const id = useId()
  const box = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState('')
  const ready = text.trim().length > 0

  // grows with the text, up to about five lines (then it scrolls inside)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 136)}px`
  }, [text])

  const send = () => {
    if (!ready) return
    onSend(text.trim())
    setText('')
    box.current?.focus({ preventScroll: true })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        send()
      }}
      className="flex items-end gap-2 rounded-[1.75rem] border-2 border-line bg-white p-1.5 pl-4 shadow-[var(--shadow-soft)] transition-shadow focus-within:border-peach focus-within:ring-4 focus-within:ring-peach/30"
    >
      <label htmlFor={id} className="sr-only">
        {t('ข้อความถึงโมชิ', 'Message to Mochi')}
      </label>
      <textarea
        ref={box}
        id={id}
        rows={1}
        value={text}
        maxLength={MAX_TEXT}
        placeholder={placeholder}
        enterKeyHint="send"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
          e.preventDefault()
          send()
        }}
        className="max-h-34 min-w-0 flex-1 resize-none bg-transparent py-2 text-base leading-normal text-ink outline-none placeholder:text-ink-faint"
      />
      <IconButton type="submit" label={t('ส่ง', 'Send')} variant="primary" disabled={!ready} className="disabled:opacity-45">
        <SendHorizontal size={18} aria-hidden />
      </IconButton>
    </form>
  )
}
