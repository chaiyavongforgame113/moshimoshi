import { AnimatePresence, motion } from 'motion/react'
import { Sparkles } from 'lucide-react'
import { useId, useState } from 'react'
import { Avatar, Button, Chip, leaveField, OwnOption, Sheet, Wizard } from '@/components/ui'
import { CHAT_STYLES, chatStyleLabel, hasChatStyle, isAllDay, ONLINE_LABEL, OWN_STYLE_MAX, ownChatStyle } from '@/data/tags'
import { displayName, t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import { useMoshi } from '@/lib/store'
import type { MochiColor, OnlineSlot } from '@/lib/types'
import { MAX_STYLES } from '@/pages/onboarding/model'
import { SLOT_OPTIONS } from '@/pages/onboarding/options'
import { ColorSwatches } from './ColorSwatches'
import { StoriesWizard } from './StoriesWizard'
import { TagsWizard } from './TagsWizard'

export type EditKind = 'basics' | 'tags' | 'stories' | 'online' | 'style'

const field =
  'mt-1.5 block w-full rounded-2xl border border-line bg-white px-4 py-3 text-ink shadow-[inset_0_2px_4px_rgb(59_38_34/0.04)] placeholder:text-ink-faint focus:border-lavender'

const NAME_MAX = 20
const BIO_MAX = 120

/**
 * Every edit sheet of my profile; each form mounts fresh on open. Sheets with several
 * questions are a Wizard (one question at a time, Save on the last); `step` opens one
 * at a later question (the "คลื่นชัดขึ้น" card points straight at what's missing).
 */
export function EditSheets({ open, step = 0, onClose }: { open: EditKind | null; step?: number; onClose: () => void }) {
  return (
    <>
      <Sheet open={open === 'basics'} onClose={onClose} title={t('แก้ไขโปรไฟล์', 'Edit profile')}>
        <BasicsWizard onDone={onClose} />
      </Sheet>
      <Sheet open={open === 'tags'} onClose={onClose} title={t('เรื่องที่ชอบ', 'My interests')} width={640}>
        <TagsWizard start={step} onDone={onClose} />
      </Sheet>
      <Sheet open={open === 'stories'} onClose={onClose} title={t('เรื่องเล่าของเรา', 'My stories')} width={580}>
        <StoriesWizard start={step} onDone={onClose} />
      </Sheet>
      <Sheet open={open === 'online'} onClose={onClose} title={t('ช่วงที่มักออนไลน์', "When I'm usually online")}>
        <OnlineForm onDone={onClose} />
      </Sheet>
      <Sheet open={open === 'style'} onClose={onClose} title={t('สไตล์การคุยของเรา', 'My chat style')}>
        <StyleForm onDone={onClose} />
      </Sheet>
    </>
  )
}

/** Name → intro → color, one at a time. */
function BasicsWizard({ onDone }: { onDone: () => void }) {
  const me = useMoshi((s) => s.me)
  const updateMe = useMoshi((s) => s.updateMe)
  const [step, setStep] = useState(0)
  // 'เรา' is the demo's stand-in name: start empty rather than make them delete it
  const [name, setName] = useState(me.name === 'เรา' ? '' : me.name)
  const [bio, setBio] = useState(me.bio)
  const [color, setColor] = useState<MochiColor>(me.color)
  const id = useId()
  const shownName = name.trim() || me.name

  const save = () => {
    updateMe({ name: shownName, bio: bio.trim(), color })
    onDone()
  }

  return (
    <Wizard
      step={step}
      onStep={setStep}
      onFinish={save}
      finishLabel={t('บันทึก', 'Save')}
      steps={[
        {
          key: 'name',
          title: t('อยากให้เพื่อนเรียกเราว่าอะไร?', "What's your nickname?"),
          hint: t('ชื่อเล่นสั้นๆ ที่อยากให้เพื่อนเรียก', "The name you'd like friends to use"),
          // left empty, the name stays as it is
          valid: shownName.trim().length > 0,
          content: (
            <div>
              <label htmlFor={`${id}-name`} className="font-display font-semibold">
                {t('ชื่อเล่น', 'Nickname')}
              </label>
              <input
                id={`${id}-name`}
                value={name}
                maxLength={NAME_MAX}
                onChange={(e) => setName(e.target.value)}
                autoComplete="nickname"
                enterKeyHint="next"
                placeholder={t('ชื่อที่อยากให้เพื่อนเรียก', 'The name friends know you by')}
                aria-describedby={`${id}-name-count`}
                className={field}
              />
              <p id={`${id}-name-count`} className="mt-1 text-right text-xs text-ink-soft">
                {t(`${name.length}/${NAME_MAX} ตัวอักษร`, `${name.length}/${NAME_MAX} characters`)}
              </p>
            </div>
          ),
        },
        {
          key: 'bio',
          title: t('แนะนำตัวสั้นๆ หน่อย', 'Say a little about yourself'),
          hint: t('ประโยคเดียวก็น่ารักแล้ว ไม่ต้องยาว', 'One line is plenty'),
          content: (
            <div>
              <label htmlFor={`${id}-bio`} className="font-display font-semibold">
                {t('แนะนำตัวสั้นๆ', 'A short intro')}
              </label>
              <textarea
                id={`${id}-bio`}
                value={bio}
                maxLength={BIO_MAX}
                rows={3}
                onChange={(e) => setBio(e.target.value)}
                placeholder={t('เช่น ชอบอนิเมะ เกมชิลๆ และคาเฟ่เงียบๆ', 'e.g. Into anime, chill games and quiet cafés')}
                aria-describedby={`${id}-bio-count`}
                className={`${field} resize-none`}
              />
              <p id={`${id}-bio-count`} className="mt-1 text-right text-xs text-ink-soft">
                {t(`${bio.length}/${BIO_MAX} ตัวอักษร`, `${bio.length}/${BIO_MAX} characters`)}
              </p>
            </div>
          ),
        },
        {
          key: 'color',
          title: t('โมชิของเราสีอะไรดี?', 'What color is your Mochi?'),
          hint: t('สีนี้จะเป็นสีประจำตัวเราในแอป', 'This becomes your color around the app'),
          content: (
            <div className="flex flex-col items-center gap-2">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={color}
                  initial={{ scale: 0.6, rotate: -10, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  transition={spring.bouncy}
                >
                  <Avatar color={color} size={96} face="happy" />
                </motion.span>
              </AnimatePresence>
              <p className="max-w-full truncate font-display text-lg font-semibold text-ink">{displayName(shownName)}</p>
              <ColorSwatches value={color} onChange={setColor} legend={t('สีโมชิของเรา', "My Mochi's color")} size={34} className="flex max-w-full justify-center" />
            </div>
          ),
        },
      ]}
    />
  )
}

/** One question: which times of day I'm usually around. The four times cover the whole day, so there's no "other". */
function OnlineForm({ onDone }: { onDone: () => void }) {
  const me = useMoshi((s) => s.me)
  const updateMe = useMoshi((s) => s.updateMe)
  const [slots, setSlots] = useState<OnlineSlot[]>(me.online)
  const id = useId()
  const toggle = (s: OnlineSlot) => setSlots(slots.includes(s) ? slots.filter((x) => x !== s) : [...slots, s])
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        // in the day's order, whatever order they were tapped in
        updateMe({ online: SLOT_OPTIONS.map((o) => o.id).filter((s) => slots.includes(s)) })
        onDone()
      }}
      className="space-y-5 pb-2"
    >
      <p id={`${id}-hint`} className="text-sm text-ink-soft">
        {t('เลือกได้หลายช่วง คนที่ออนไลน์ช่วงเดียวกันจะได้คุยกันทันใจ', 'Pick as many as you like. People around at the same times get to chat in the moment')}
      </p>
      <div role="group" aria-label={t('ช่วงที่มักออนไลน์', "When I'm usually online")} aria-describedby={`${id}-hint`} className="grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-2">
        {SLOT_OPTIONS.map(({ id: slot, Icon, time }) => {
          const on = slots.includes(slot)
          return (
            <motion.button
              key={slot}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(slot)}
              whileTap={{ scale: 0.95 }}
              transition={spring.bouncy}
              className={`flex min-h-16 min-w-0 items-center gap-2.5 rounded-2xl border-2 px-3 text-left transition-colors ${on ? 'border-sky bg-sky/45' : 'border-line bg-white hover:bg-white/80'}`}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-ink shadow-[var(--shadow-soft)]" aria-hidden>
                <Icon size={18} />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-[15px] font-semibold text-ink">{ONLINE_LABEL[slot]}</span>
                <span className="block text-xs text-ink-soft">{time}</span>
              </span>
            </motion.button>
          )
        })}
      </div>
      <AnimatePresence initial={false}>
        {isAllDay(slots) && (
          <motion.p
            key="all-day"
            role="status"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={spring.soft}
            className="rainbow-chip flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-center font-display text-[15px] font-semibold text-ink"
          >
            <Sparkles size={18} strokeWidth={2.4} aria-hidden className="shrink-0" />
            {t('ออนไลน์ได้ทั้ง 24 ชั่วโมง!', "You're around 24/7!")}
          </motion.p>
        )}
      </AnimatePresence>
      <Button type="submit" block size="lg">
        {t('บันทึก', 'Save')}
      </Button>
    </form>
  )
}

function StyleForm({ onDone }: { onDone: () => void }) {
  const me = useMoshi((s) => s.me)
  const updateMe = useMoshi((s) => s.updateMe)
  // same rule as onboarding: at most MAX_STYLES (the oldest pick makes room)
  const [styles, setStyles] = useState<string[]>(() => me.chatStyle.slice(0, MAX_STYLES))
  const toggle = (s: string) =>
    setStyles(styles.includes(s) ? styles.filter((x) => x !== s) : styles.length < MAX_STYLES ? [...styles, s] : [...styles.slice(1), s])
  // what they typed stays on the sheet even when the oldest-drop rule above unpicks it, so it can be picked again
  const [typed, setTyped] = useState<string[]>(() => me.chatStyle.filter((s) => !CHAT_STYLES.includes(s)))
  const addOwn = (text: string) => {
    const s = ownChatStyle(text)
    if (!s) return false
    if (!CHAT_STYLES.includes(s) && !hasChatStyle(typed, s)) setTyped([...typed, s])
    if (!hasChatStyle(styles, s)) toggle(s)
    return true
  }
  const choices = [...CHAT_STYLES, ...typed]
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        updateMe({ chatStyle: styles })
        onDone()
      }}
      className="space-y-5 pb-2"
    >
      <p className="text-sm text-ink-soft">
        {t(
          `บอกให้เพื่อนรู้ว่าเราคุยแบบไหน เลือกได้ไม่เกิน ${MAX_STYLES} แบบ ไม่มีแบบไหนดีกว่ากันนะ`,
          `Let friends know how you like to chat. Pick up to ${MAX_STYLES}. There's no wrong answer`,
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        {choices.map((s) => (
          <Chip key={s} color={me.color} selected={styles.includes(s)} onClick={() => toggle(s)}>
            {chatStyleLabel(s)}
          </Chip>
        ))}
        <OwnOption name={t('พิมพ์สไตล์การคุยเอง', 'Type your own chat style')} placeholder={t('เช่น ชอบส่งมีม', 'e.g. Sends lots of memes')} maxLength={OWN_STYLE_MAX} onAdd={addOwn} />
      </div>
      <Button type="submit" block size="lg" onPointerDown={leaveField}>
        {t('บันทึก', 'Save')}
      </Button>
    </form>
  )
}
