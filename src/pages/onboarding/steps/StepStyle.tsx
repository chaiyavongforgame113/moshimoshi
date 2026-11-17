import { CHAT_STYLES, chatStyleLabel, hasChatStyle, OWN_STYLE_MAX, ownChatStyle } from '@/data/tags'
import { L, t, tx, type Txt } from '@/lib/i18n'
import { MAX_STYLES, type StepProps } from '../model'
import { ChoiceGrid, type Choice } from '../parts/ChoiceGrid'

/** A badge and a short "what that means" line for each listed style (keyed by the stored Thai value). */
const STYLE_LOOK: Record<string, { emoji: string; hint: Txt }> = {
  คุยเก่ง: { emoji: '🗣️', hint: L('ชวนคุยก่อนได้สบายๆ', 'Happy to break the ice') },
  ฟังเก่ง: { emoji: '👂', hint: L('ชอบฟังเรื่องของเพื่อน', 'Loves hearing your stories') },
  ตอบไว: { emoji: '⚡', hint: L('เห็นแชตแล้วตอบเลย', 'Replies right away') },
  ตอบช้าแต่ตอบนะ: { emoji: '🐢', hint: L('ไม่ได้หายไปไหน แค่ตอบตามจังหวะ', 'Not ghosting, just my own pace') },
  พิมพ์ยาว: { emoji: '📝', hint: L('เล่ายาวเป็นย่อหน้า จัดเต็มทุกเรื่อง', 'Writes whole paragraphs') },
  สายสติกเกอร์: { emoji: '🧸', hint: L('มีสติกเกอร์ทุกอารมณ์', 'A sticker for every mood') },
  คุยเสียงได้: { emoji: '🎙️', hint: L('ใช้เสียงคุยกันก็สบาย ไม่เขิน', 'Happy to talk out loud too') },
}

/** 9 · chat style, up to two (skippable). "อื่นๆ" lets them say it their own way. */
export function StepStyle({ draft, update }: StepProps) {
  const toggle = (s: string) => {
    if (draft.chatStyle.includes(s)) return update((d) => ({ chatStyle: d.chatStyle.filter((x) => x !== s) }))
    update((d) => (d.chatStyle.length >= MAX_STYLES ? {} : { chatStyle: [...d.chatStyle, s] }))
  }

  const addOwn = (text: string): boolean => {
    const s = ownChatStyle(text)
    if (!s) return false
    if (hasChatStyle(draft.chatStyle, s)) return true
    if (draft.chatStyle.length >= MAX_STYLES) return false
    update((d) => ({ chatStyle: [...d.chatStyle, s] }))
    return true
  }

  // listed styles first, then what they typed themselves (kept while it's picked)
  const choices: Choice[] = [...CHAT_STYLES, ...draft.chatStyle.filter((s) => !CHAT_STYLES.includes(s))].map((s) => {
    const look = STYLE_LOOK[s]
    return { value: s, label: chatStyleLabel(s), icon: look?.emoji ?? '✨', hint: look ? tx(look.hint) : t('แบบของเราเอง', 'In your own words') }
  })

  return (
    <ChoiceGrid
      label={t('สไตล์การคุย', 'Chat style')}
      choices={choices}
      selected={draft.chatStyle}
      onToggle={toggle}
      max={MAX_STYLES}
      color="mint"
      fullNote={t(`เลือกได้สูงสุด ${MAX_STYLES} แบบ แตะอันเดิมเพื่อเอาออกนะ`, `You can pick up to ${MAX_STYLES}. Tap one again to remove it`)}
      own={{
        name: t('พิมพ์สไตล์การคุยเอง', 'Type your own chat style'),
        placeholder: t('เช่น ชอบส่งมีม', 'e.g. Sends lots of memes'),
        maxLength: OWN_STYLE_MAX,
        onAdd: addOwn,
        hint: t('พิมพ์ในแบบของเราเอง', 'Say it your own way'),
      }}
    />
  )
}
