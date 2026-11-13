import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Check, ChevronDown, Lightbulb, PencilLine, Plus } from 'lucide-react'
import { useId, useRef, useState, type ReactNode } from 'react'
import { cutText, OWN_PROMPT_ID, OWN_QUESTION_MAX, PROMPT_BY_ID, PROMPTS, tagOf } from '@/data/tags'
import { t } from '@/lib/i18n'
import { fadeUp, spring } from '@/lib/motion'
import type { PromptAnswer } from '@/lib/types'
import { STORY_MAX, STORY_MIN, textLength, type StepProps } from '../model'
import { Pill } from '../parts/Pill'

/**
 * 9 · one little story (skippable). The question shows on a note card; "เปลี่ยนคำถาม" opens
 * the list (ending with "อื่นๆ" to ask their own). A second answer can be added on the profile.
 */
export function StepStory({ draft, update }: StepProps) {
  const answer = draft.prompts[0] ?? { promptId: PROMPTS[0].id, text: '' }
  const other = draft.prompts[1]?.promptId
  const own = answer.promptId === OWN_PROMPT_ID
  const prompt = PROMPT_BY_ID[answer.promptId] ?? PROMPTS[0]
  const [choosing, setChoosing] = useState(false)
  const answerBox = useRef<HTMLTextAreaElement>(null)
  const questionBox = useRef<HTMLInputElement>(null)
  const reduce = useReducedMotion()
  const listId = useId()
  const len = textLength(answer.text)
  const enough = len >= STORY_MIN

  const set = (patch: Partial<PromptAnswer>) => update((d) => ({ prompts: [{ ...(d.prompts[0] ?? answer), ...patch }, ...d.prompts.slice(1)] }))

  const pick = (promptId: string) => set({ promptId })
  // a tap (not arrow keys moving through the list) settles it: fold the list, go write
  const picked = (promptId: string) => {
    setChoosing(false)
    requestAnimationFrame(() => (promptId === OWN_PROMPT_ID ? questionBox.current : answerBox.current)?.focus({ preventScroll: true }))
  }

  const insert = (piece: string) => {
    // a second tap on the same helper shouldn't repeat the word
    if (answer.text.includes(piece)) return
    const base = answer.text.trimEnd()
    set({ text: cutText(base ? `${base} ${piece}` : piece, STORY_MAX) })
  }

  // helper chips: two of their own interests, ready to drop into the answer
  const helpers = [...draft.loves, ...draft.tags.filter((id) => !draft.loves.includes(id))].slice(0, 2).flatMap((id) => tagOf(id) ?? [])

  return (
    <motion.section variants={fadeUp} className="card p-4 transition-shadow focus-within:ring-4 focus-within:ring-peach/35 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            {own ? (
              <motion.div key="own" initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={spring.soft}>
                <label htmlFor="ob-story-q" className="block text-xs font-semibold text-ink-soft">
                  {t('คำถามของเรา', 'Your question')}
                </label>
                <div className="mt-0.5 flex items-baseline gap-2 border-b-2 border-dashed border-line pb-1 transition-colors focus-within:border-peach">
                  <input
                    ref={questionBox}
                    id="ob-story-q"
                    value={answer.question ?? ''}
                    maxLength={OWN_QUESTION_MAX}
                    onChange={(e) => set({ question: e.target.value })}
                    onKeyDown={(e) => {
                      // Enter goes on to the answer, not to the next step
                      if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return
                      e.preventDefault()
                      answerBox.current?.focus()
                    }}
                    enterKeyHint="next"
                    autoComplete="off"
                    placeholder={t('เช่น เพลงที่ฟังแล้วยิ้มได้คือ…', 'e.g. A song that makes me smile is…')}
                    className="min-w-0 flex-1 bg-transparent font-display text-lg leading-[2] font-semibold text-ink outline-none placeholder:font-body placeholder:text-base placeholder:font-normal placeholder:text-ink-faint"
                  />
                  <span className="shrink-0 text-[11px] font-semibold text-ink-faint tabular-nums" aria-hidden>
                    {(answer.question ?? '').length}/{OWN_QUESTION_MAX}
                  </span>
                </div>
              </motion.div>
            ) : (
              <motion.label
                key={prompt.id}
                htmlFor="ob-story"
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={spring.soft}
                className="block pt-2 font-display text-lg leading-snug font-semibold text-ink"
              >
                {prompt.label}
              </motion.label>
            )}
          </AnimatePresence>
        </div>
        <button
          type="button"
          aria-expanded={choosing}
          aria-controls={listId}
          onClick={() => setChoosing((c) => !c)}
          className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-white/85 px-3 text-sm font-semibold text-ink ring-1 ring-line transition-colors hover:bg-white"
        >
          {t('เปลี่ยนคำถาม', 'Change')}
          <ChevronDown size={16} aria-hidden className={`transition-transform ${choosing ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {choosing && (
          <motion.div
            key="prompts"
            id={listId}
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={spring.soft}
            className="overflow-hidden"
          >
            <div role="radiogroup" aria-label={t('เลือกคำถาม', 'Pick a question')} className="flex flex-wrap gap-2 pt-3">
              {PROMPTS.filter((p) => p.id !== other).map((p) => (
                <PromptOption key={p.id} id={p.id} on={p.id === answer.promptId} onPick={pick} onTap={picked}>
                  {p.label}
                </PromptOption>
              ))}
              <PromptOption id={OWN_PROMPT_ID} on={own} onPick={pick} onTap={picked} dashed>
                <PencilLine size={15} aria-hidden />
                {t('อื่นๆ ตั้งคำถามเอง', 'Other (ask your own)')}
              </PromptOption>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* the answer, on lined note paper */}
      <textarea
        ref={answerBox}
        id="ob-story"
        aria-label={own ? t('คำตอบของเรา', 'Your answer') : undefined}
        rows={3}
        value={answer.text}
        maxLength={STORY_MAX}
        onChange={(e) => set({ text: cutText(e.target.value, STORY_MAX) })}
        placeholder={own ? t('แล้วคำตอบของเราล่ะ…', 'And your answer is…') : prompt.example}
        aria-describedby="ob-story-count"
        className="mt-2 block w-full resize-none bg-transparent text-base leading-8 text-ink outline-none placeholder:text-ink-faint"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, transparent 0, transparent calc(2rem - 1px), var(--color-line) calc(2rem - 1px), var(--color-line) 2rem)',
          backgroundAttachment: 'local',
        }}
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-ink/10" aria-hidden>
          <motion.span
            className={`absolute inset-y-0 left-0 rounded-full ${enough ? 'bg-mint' : 'bg-peach'}`}
            initial={false}
            animate={{ width: `${Math.min(100, (len / STORY_MIN) * 100)}%` }}
            transition={reduce ? { duration: 0 } : spring.soft}
          />
        </span>
        <span id="ob-story-count" className="flex shrink-0 items-center gap-1 text-xs font-semibold text-ink-soft">
          {enough ? (
            <>
              <Check size={13} strokeWidth={3} className="text-success" aria-hidden /> {t('กำลังดี', 'Just right')}
            </>
          ) : len ? (
            t(`อีก ${STORY_MIN - len} ตัวอักษร`, `${STORY_MIN - len} more ${STORY_MIN - len === 1 ? 'character' : 'characters'}`)
          ) : (
            t(`อย่างน้อย ${STORY_MIN} ตัวอักษร`, `At least ${STORY_MIN} characters`)
          )}
          <span className="text-ink-soft/80">
            · {answer.text.length}/{STORY_MAX}
          </span>
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {!own && (
          <Pill onClick={() => set({ text: prompt.example })} icon={<Lightbulb size={15} aria-hidden />} color="butter">
            {t('ใช้ตัวอย่าง', 'Use the example')}
          </Pill>
        )}
        {helpers.map((h) => (
          <Pill key={h.id} onClick={() => insert(h.label)} ariaLabel={t(`เติมคำว่า ${h.label}`, `Add "${h.label}"`)} icon={<Plus size={14} className="shrink-0" aria-hidden />}>
            <span className="min-w-0 truncate">{h.label}</span>
          </Pill>
        ))}
      </div>
    </motion.section>
  )
}

interface PromptOptionProps {
  id: string
  on: boolean
  onPick: (id: string) => void
  /** a pointer tap (arrow keys only move the choice) */
  onTap: (id: string) => void
  dashed?: boolean
  children: ReactNode
}

function PromptOption({ id, on, onPick, onTap, dashed, children }: PromptOptionProps) {
  return (
    <label className="relative max-w-full cursor-pointer" onClick={(e) => e.detail > 0 && onTap(id)}>
      <input type="radio" name="ob-prompt" value={id} checked={on} onChange={() => onPick(id)} className="peer sr-only" />
      <span
        className={`inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-2xl border px-3.5 py-2 text-sm transition-colors peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-lavender ${
          on
            ? 'border-peach bg-peach/45 font-semibold text-ink'
            : dashed
              ? 'border-2 border-dashed border-ink/25 bg-white/70 font-semibold text-ink hover:border-peach hover:bg-white'
              : 'border-line bg-white/85 text-ink hover:bg-white'
        }`}
      >
        {children}
      </span>
    </label>
  )
}
