import { motion } from 'motion/react'
import { Check, Eraser } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { OwnOption, Wizard } from '@/components/ui'
import { cutText, OWN_PROMPT_ID, OWN_QUESTION_MAX, PROMPT_BY_ID, PROMPTS } from '@/data/tags'
import { t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import { useMoshi } from '@/lib/store'
import type { PromptAnswer } from '@/lib/types'
import { STORY_MAX, STORY_MIN } from '@/pages/onboarding/model'

const len = (s: string | undefined) => (s ?? '').trim().length

/** a listed question nobody else on this sheet uses */
const freePrompt = (taken: string | undefined) => (PROMPTS.find((p) => p.id !== taken) ?? PROMPTS[0]).id

/** empty is fine (no story there); otherwise long enough, and a question of their own isn't blank */
const storyOk = (a: PromptAnswer) => !len(a.text) || (len(a.text) >= STORY_MIN && (a.promptId !== OWN_PROMPT_ID || len(a.question) > 0))

/** what gets saved: trimmed, and only their own questions keep a question */
const clean = (a: PromptAnswer): PromptAnswer =>
  a.promptId === OWN_PROMPT_ID ? { promptId: a.promptId, text: a.text.trim(), question: (a.question ?? '').trim() } : { promptId: a.promptId, text: a.text.trim() }

/**
 * My first two stories, one per question screen. An empty answer means no story there.
 * Stories past the second (live profiles can hold a few more) are kept as they are.
 */
export function StoriesWizard({ start = 0, onDone }: { start?: number; onDone: () => void }) {
  const me = useMoshi((s) => s.me)
  const updateMe = useMoshi((s) => s.updateMe)
  const [original] = useState<PromptAnswer[]>(() => {
    const first = me.prompts[0] ?? { promptId: PROMPTS[0].id, text: '' }
    const second = me.prompts[1] ?? { promptId: freePrompt(first.promptId), text: '' }
    return [first, second]
  })
  const [answers, setAnswers] = useState<PromptAnswer[]>(original)
  // a question they wrote stays on the list after they pick a listed one, so it can be picked again
  const [ownQs, setOwnQs] = useState<string[]>(() => original.map((a) => (a.promptId === OWN_PROMPT_ID ? (a.question ?? '') : '')))
  const [step, setStep] = useState(Math.min(Math.max(start, 0), 1))
  const ids = useId()

  const patch = (i: number, p: Partial<PromptAnswer>) => setAnswers((list) => list.map((a, j) => (j === i ? { ...a, ...p } : a)))

  // arriving at a blank story whose question the other story already answers: offer a fresh one
  const go = (n: number) => {
    setAnswers((list) =>
      list.map((a, i) => {
        const other = list[1 - i]
        const clash = i === n && !len(a.text) && a.promptId !== OWN_PROMPT_ID && a.promptId === other.promptId && len(other.text) > 0
        return clash ? { ...a, promptId: freePrompt(other.promptId) } : a
      }),
    )
    setStep(n)
  }

  const save = () => {
    const told = answers.filter((a) => len(a.text) > 0).map(clean)
    updateMe({ prompts: [...told, ...me.prompts.slice(2)] })
    onDone()
  }

  const field = (i: number) => {
    const other = answers[1 - i]
    return (
      <StoryField
        name={`${ids}-${i}`}
        answer={answers[i]}
        ownQuestion={ownQs[i]}
        taken={len(other.text) > 0 && other.promptId !== OWN_PROMPT_ID ? other.promptId : undefined}
        onPick={(promptId) => patch(i, promptId === OWN_PROMPT_ID ? { promptId, question: ownQs[i] } : { promptId })}
        onOwn={(text) => {
          const q = cutText(text.trim(), OWN_QUESTION_MAX)
          if (!q) return false
          setOwnQs((list) => list.map((x, j) => (j === i ? q : x)))
          patch(i, { promptId: OWN_PROMPT_ID, question: q })
          return true
        }}
        onText={(text) => patch(i, { text })}
      />
    )
  }

  return (
    <Wizard
      step={step}
      onStep={go}
      onFinish={save}
      finishLabel={t('บันทึก', 'Save')}
      steps={[
        {
          key: 'first',
          title: t('เล่าเรื่องของเราสักเรื่อง', 'Share a little story'),
          hint: t('เลือกคำถามที่อยากตอบ แล้วเล่าสั้นๆ สักประโยคสองประโยค', 'Pick a question, then answer in a line or two'),
          valid: storyOk(answers[0]),
          content: field(0),
        },
        {
          key: 'second',
          title: t('อีกสักเรื่องไหม?', 'One more story?'),
          hint: t('สองเรื่องทำให้คลื่นของเราชัดขึ้นอีกนิด', 'Two stories make your wave a little clearer'),
          valid: storyOk(answers[1]),
          // with no second story yet, skipping leaves it that way
          optional: !len(original[1].text),
          onSkip: () => setAnswers((list) => [list[0], original[1]]),
          content: field(1),
        },
      ]}
    />
  )
}

function StoryField({
  name,
  answer,
  ownQuestion,
  taken,
  onPick,
  onOwn,
  onText,
}: {
  name: string
  answer: PromptAnswer
  /** the question they wrote on this sheet ('' for none) */
  ownQuestion: string
  /** a listed question the other story uses */
  taken?: string
  onPick: (promptId: string) => void
  onOwn: (text: string) => boolean
  onText: (text: string) => void
}) {
  const own = answer.promptId === OWN_PROMPT_ID
  const prompt = PROMPT_BY_ID[answer.promptId] ?? PROMPTS[0]
  const question = own ? (answer.question ?? ownQuestion) : prompt.label
  const n = len(answer.text)
  const enough = n >= STORY_MIN
  const fieldId = `${name}-answer`
  const box = useRef<HTMLTextAreaElement>(null)
  const pill = (on: boolean) =>
    `inline-flex min-h-11 max-w-full items-center rounded-2xl border px-3.5 py-2 text-left text-sm transition-colors peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-lavender ${
      on ? 'border-peach bg-peach/45 font-semibold text-ink' : 'border-line bg-white text-ink hover:bg-cream'
    }`

  return (
    <div className="space-y-4">
      <fieldset className="min-w-0">
        <legend className="mb-2 font-display text-[15px] font-semibold text-ink">{t('คำถามที่อยากตอบ', 'The question')}</legend>
        <div className="flex flex-wrap gap-2">
          {PROMPTS.filter((p) => p.id !== taken || p.id === answer.promptId).map((p) => (
            <label key={p.id} className="relative max-w-full cursor-pointer">
              <input type="radio" name={name} value={p.id} checked={answer.promptId === p.id} onChange={() => onPick(p.id)} className="peer sr-only" />
              <span className={pill(answer.promptId === p.id)}>{p.label}</span>
            </label>
          ))}
          {(own || ownQuestion) && (
            <label className="relative max-w-full cursor-pointer">
              <input type="radio" name={name} value={OWN_PROMPT_ID} checked={own} onChange={() => onPick(OWN_PROMPT_ID)} className="peer sr-only" />
              <span className={pill(own)}>{own ? question : ownQuestion}</span>
            </label>
          )}
          <OwnOption
            label={t('อื่นๆ ตั้งคำถามเอง', 'Other (ask your own)')}
            name={t('ตั้งคำถามเอง', 'Ask your own question')}
            placeholder={t('เช่น เพลงที่ฟังแล้วยิ้มได้ทุกครั้งคือ…', 'e.g. A song that always makes me smile is…')}
            maxLength={OWN_QUESTION_MAX}
            onAdd={onOwn}
          />
        </div>
      </fieldset>

      {/* the answer, on a little lined note card */}
      <div className="card p-4 transition-shadow focus-within:ring-4 focus-within:ring-peach/35 sm:p-5">
        <label htmlFor={fieldId} className="block font-display text-lg leading-snug font-semibold text-ink wrap-break-word">
          {question}
        </label>
        <textarea
          ref={box}
          id={fieldId}
          rows={3}
          value={answer.text}
          maxLength={STORY_MAX}
          onChange={(e) => onText(cutText(e.target.value, STORY_MAX))}
          placeholder={own ? t('แล้วคำตอบของเราล่ะ…', 'And your answer is…') : prompt.example}
          aria-describedby={`${fieldId}-count`}
          className="mt-1 block w-full resize-none bg-transparent text-base leading-8 text-ink outline-none placeholder:text-ink-faint"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to bottom, transparent 0, transparent calc(2rem - 1px), var(--color-line) calc(2rem - 1px), var(--color-line) 2rem)',
            backgroundAttachment: 'local',
          }}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="relative h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-ink/10" aria-hidden>
            <motion.span
              className={`absolute inset-y-0 left-0 rounded-full ${enough ? 'bg-mint' : 'bg-peach'}`}
              initial={false}
              animate={{ width: `${Math.min(100, (n / STORY_MIN) * 100)}%` }}
              transition={spring.soft}
            />
          </span>
          <span id={`${fieldId}-count`} className="flex shrink-0 items-center gap-1 text-xs font-semibold text-ink-soft">
            {enough ? (
              <>
                <Check size={13} strokeWidth={3} className="text-success" aria-hidden /> {t('กำลังดี', 'Just right')}
              </>
            ) : n ? (
              t(`อีก ${STORY_MIN - n} ตัวอักษร`, `${STORY_MIN - n} more ${STORY_MIN - n === 1 ? 'character' : 'characters'}`)
            ) : (
              t(`ว่างไว้ได้ หรือเขียนอย่างน้อย ${STORY_MIN} ตัวอักษร`, `Leave it blank, or write at least ${STORY_MIN} characters`)
            )}
            <span className="text-ink-soft/80">
              · {answer.text.length}/{STORY_MAX}
            </span>
          </span>
        </div>
        {n > 0 && (
          <button
            type="button"
            onClick={() => {
              onText('')
              // this button goes away with the answer: carry on writing in the box
              box.current?.focus()
            }}
            className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-ink-soft hover:bg-ink/5 hover:text-ink"
          >
            <Eraser size={15} aria-hidden /> {t('ลบคำตอบนี้', 'Clear this answer')}
          </button>
        )}
      </div>
    </div>
  )
}
