import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Lock, MessagesSquare, Send, Sparkles } from 'lucide-react'
import { useId, useState } from 'react'
import { Avatar, Button } from '@/components/ui'
import { usePairQuestion } from '@/data/hooks'
import { PAIR_ANSWER_MAX } from '@/data/pairQuestions'
import { MOCHI } from '@/lib/colors'
import { t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import { useMoshi } from '@/lib/store'
import type { MochiColor, User } from '@/lib/types'

/**
 * "คำถามคู่": Mochi asks us both the same question. Mine goes in privately; theirs stays locked
 * until both have answered (the server holds it back), then opens with a little flip.
 */
export function PairCard({ chatId, them, meColor, isNew = false, readOnly = false }: { chatId: string; them: User; meColor: MochiColor; isNew?: boolean; readOnly?: boolean }) {
  const reduce = useReducedMotion()
  const pair = usePairQuestion(chatId)
  const answerPair = useMoshi((s) => s.answerPair)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const id = useId()
  const q = pair.question
  if (pair.step === 'none' || !q) return null

  const body = draft.trim()
  const submit = async () => {
    if (!body || busy || readOnly) return
    setBusy(true)
    const ok = await answerPair(chatId, q.id, body)
    setBusy(false)
    if (ok) setDraft('')
  }

  const status =
    pair.step === 'revealed'
      ? t(`เปิดคำตอบแล้ว ${them.name}ตอบว่า ${pair.theirs?.text ?? ''}`, `Answers are open. ${them.name} said: ${pair.theirs?.text ?? ''}`)
      : pair.step === 'waiting'
        ? t(`ส่งคำตอบแล้ว รอ${them.name}ตอบอยู่นะ`, `Answer sent. Waiting for ${them.name}`)
        : ''

  return (
    <motion.section
      aria-labelledby={`${id}-q`}
      initial={reduce || !isNew ? false : { opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring.bouncy}
      className="w-full rounded-[1.75rem] border border-white/80 bg-white/90 p-3.5 shadow-[var(--shadow-soft)] sm:p-4"
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
        <MessagesSquare size={14} strokeWidth={2.4} aria-hidden />
        {t('คำถามคู่ · ตอบแล้วจะเปิดพร้อมกัน', 'Question pair · answers open together')}
      </p>
      <h3 id={`${id}-q`} className="mt-1 font-display text-lg leading-snug font-semibold break-words text-ink">
        {q.text}
      </h3>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {/* mine */}
        <div className="min-w-0 rounded-3xl p-3" style={{ background: MOCHI[meColor].light }}>
          <SlotLabel color={meColor} text={t('คำตอบของเธอ', 'Your answer')} />
          {pair.mine ? (
            <p className="mt-1.5 text-[15px] leading-relaxed break-words whitespace-pre-wrap text-ink">{pair.mine.text}</p>
          ) : readOnly ? (
            <p className="mt-1.5 text-sm text-ink-soft">{t('แชทปิดแล้ว', 'Chat closed')}</p>
          ) : (
            <form
              className="mt-1.5"
              onSubmit={(e) => {
                e.preventDefault()
                void submit()
              }}
            >
              <label htmlFor={`${id}-a`} className="sr-only">
                {t(`คำตอบของเธอ: ${q.text}`, `Your answer: ${q.text}`)}
              </label>
              <textarea
                id={`${id}-a`}
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, PAIR_ANSWER_MAX))}
                maxLength={PAIR_ANSWER_MAX}
                rows={3}
                placeholder={q.hint}
                aria-describedby={`${id}-note`}
                className="block w-full resize-none rounded-2xl border border-line bg-white px-3 py-2 text-[15px] text-ink outline-none placeholder:text-ink-soft/80 focus-visible:ring-2 focus-visible:ring-coral"
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span id={`${id}-note`} className="min-w-0 flex-[1_1_8rem] text-[11px] text-ink-soft">
                  {t('ตอบได้ครั้งเดียว ส่งแล้วแก้ไม่ได้นะ', "One answer each. It can't be changed once sent")}
                </span>
                <Button type="submit" size="sm" icon={<Send size={15} aria-hidden />} disabled={!body || busy}>
                  {t('ส่งคำตอบ', 'Send answer')}
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* theirs: locked until both answered */}
        <div className="min-w-0 rounded-3xl p-3" style={{ background: pair.theirs ? MOCHI[them.color].light : 'var(--color-cream-2)' }}>
          <SlotLabel color={them.color} text={t(`คำตอบของ${them.name}`, `${them.name}'s answer`)} />
          <AnimatePresence mode="wait" initial={false}>
            {pair.theirs ? (
              <motion.p
                key="open"
                initial={reduce ? { opacity: 0 } : { opacity: 0, rotateX: -80, scale: 0.9 }}
                animate={{ opacity: 1, rotateX: 0, scale: 1 }}
                transition={spring.bouncy}
                style={{ transformOrigin: 'top center' }}
                className="mt-1.5 text-[15px] leading-relaxed break-words whitespace-pre-wrap text-ink"
              >
                {pair.theirs.text}
              </motion.p>
            ) : (
              <motion.div key="locked" exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85 }} transition={{ duration: 0.2 }} className="mt-1.5">
                <span aria-hidden className="block space-y-1.5 blur-[2px]">
                  <span className="block h-2.5 w-11/12 rounded-full bg-ink/10" />
                  <span className="block h-2.5 w-3/4 rounded-full bg-ink/10" />
                </span>
                <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-soft">
                  <Lock size={13} strokeWidth={2.4} aria-hidden className="mt-0.5 shrink-0" />
                  <span className="min-w-0 break-words">
                    {pair.step === 'ask'
                      ? t(`ตอบก่อน แล้วจะได้เห็นของ${them.name}`, `Answer first to see ${them.name}'s`)
                      : t(`รอ${them.name}ตอบอยู่ คำตอบจะเปิดพร้อมกันนะ`, `Waiting for ${them.name}. Both answers open together`)}
                  </span>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {pair.step === 'revealed' && (
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring.soft, delay: 0.25 }}
          className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-ink-soft"
        >
          <Sparkles size={13} strokeWidth={2.4} aria-hidden />
          {t('ลองคุยต่อจากคำตอบกันดูสิ', 'Pick up the chat from your answers')}
        </motion.p>
      )}
      <p className="sr-only" aria-live="polite">
        {status}
      </p>
    </motion.section>
  )
}

function SlotLabel({ color, text }: { color: MochiColor; text: string }) {
  return (
    <p className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-ink">
      <Avatar color={color} size={20} face="smile" />
      <span className="min-w-0 truncate">{text}</span>
    </p>
  )
}
