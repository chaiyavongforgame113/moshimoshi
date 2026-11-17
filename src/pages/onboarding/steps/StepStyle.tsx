import { motion, useAnimate, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { OwnOption } from '@/components/ui'
import { CHAT_STYLES, chatStyleLabel, hasChatStyle, OWN_STYLE_MAX, ownChatStyle } from '@/data/tags'
import { t } from '@/lib/i18n'
import { fadeUp } from '@/lib/motion'
import { MAX_STYLES, type StepProps } from '../model'
import { Pill } from '../parts/Pill'

/** 9 · chat style, up to two (skippable). "อื่นๆ" lets them say it their own way. */
export function StepStyle({ draft, update }: StepProps) {
  const [scope, wiggle] = useAnimate<HTMLSpanElement>()
  const [notice, setNotice] = useState(0)
  const reduce = useReducedMotion()
  const full = draft.chatStyle.length >= MAX_STYLES

  const stylesFull = () => {
    setNotice((n) => n + 1)
    if (!reduce && scope.current) wiggle(scope.current, { x: [0, -6, 6, -4, 4, 0], scale: [1, 1.1, 1] }, { duration: 0.4 })
  }

  const toggle = (s: string) => {
    if (draft.chatStyle.includes(s)) return update((d) => ({ chatStyle: d.chatStyle.filter((x) => x !== s) }))
    if (full) return stylesFull()
    update((d) => ({ chatStyle: [...d.chatStyle, s] }))
  }

  const addOwn = (text: string): boolean => {
    const s = ownChatStyle(text)
    if (!s) return false
    if (hasChatStyle(draft.chatStyle, s)) return true
    if (draft.chatStyle.length >= MAX_STYLES) {
      stylesFull()
      return false
    }
    update((d) => ({ chatStyle: [...d.chatStyle, s] }))
    return true
  }

  // listed styles first, then what they typed themselves (kept while it's picked)
  const choices = [...CHAT_STYLES, ...draft.chatStyle.filter((s) => !CHAT_STYLES.includes(s))]

  return (
    <div className="space-y-3">
      <motion.p variants={fadeUp} className="text-sm font-semibold text-ink-soft">
        {t('เลือกแล้ว', 'Picked')}{' '}
        <span ref={scope} className="inline-block text-ink">
          {draft.chatStyle.length}/{MAX_STYLES}
        </span>
      </motion.p>

      <motion.div variants={fadeUp} role="group" aria-label={t('สไตล์การคุย', 'Chat style')} className="flex flex-wrap gap-2">
        {choices.map((s) => (
          <Pill key={s} selected={draft.chatStyle.includes(s)} onClick={() => toggle(s)} color="mint">
            <span className="min-w-0 truncate">{chatStyleLabel(s)}</span>
          </Pill>
        ))}
        <OwnOption
          name={t('พิมพ์สไตล์การคุยเอง', 'Type your own chat style')}
          placeholder={t('เช่น ชอบส่งมีม', 'e.g. Sends lots of memes')}
          maxLength={OWN_STYLE_MAX}
          onAdd={addOwn}
          blocked={full}
          onBlocked={stylesFull}
        />
      </motion.div>

      <div aria-live="polite">
        {notice > 0 && full && (
          <p key={notice} className="rounded-2xl bg-butter/50 px-3 py-2 text-sm text-ink">
            {t(`เลือกครบ ${MAX_STYLES} แบบแล้ว แตะอันเดิมเพื่อเอาออกก่อนนะ`, `That's ${MAX_STYLES}. Tap one to remove it first`)}
          </p>
        )}
      </div>
    </div>
  )
}
