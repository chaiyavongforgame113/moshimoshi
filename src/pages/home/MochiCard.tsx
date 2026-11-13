import { motion, useReducedMotion } from 'motion/react'
import { Heart, MessageCircleHeart } from 'lucide-react'
import { useState } from 'react'
import { MochiStage, View3D } from '@/components/three'
import { zoneAction } from '@/components/ui'
import { MOCHI } from '@/lib/colors'
import { t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import { useMoshi } from '@/lib/store'
import type { Mood } from '@/lib/types'
import { Block } from './Block'
import { MochiChat } from './mochi/MochiChat'
import { MOOD_BY_KEY, MOODS } from './moods'

/**
 * Home zone 1: the 3D mascot asks "วันนี้เป็นไงบ้าง?" and five mood chips answer it.
 * A chip opens the chat with Little Mochi, starting from that mood. "คุยกับโมชิ" (always there),
 * or the mood that's already picked, opens it where we left off, without a new mood turn.
 * The zone's tray stays see-through: the 3D canvas sits behind the page, so anything
 * opaque over the mascot's box would hide it.
 */
export function MochiCard() {
  const mood = useMoshi((s) => s.mood)
  const setMood = useMoshi((s) => s.setMood)
  const [chat, setChat] = useState<{ open: boolean; mood: Mood | null }>({ open: false, mood: null })
  const def = mood ? MOOD_BY_KEY[mood] : undefined

  const openChat = (m: Mood | null) => {
    if (m) setMood(m)
    setChat({ open: true, mood: m })
  }

  return (
    <>
      <Block
        id="home-mochi"
        tone="peach"
        // see-through tray: the mascot's 3D shows from behind the page
        zoneClassName="bg-transparent"
        title={t('น้องโมชิ', 'Little Mochi')}
        note={t('อยู่ตรงนี้ เล่าให้ฟังได้ทุกเรื่องเลย', "Right here, ready to listen")}
        icon={<Heart size={18} strokeWidth={2.4} />}
        action={
          <button type="button" onClick={() => openChat(null)} className={zoneAction}>
            <MessageCircleHeart size={16} strokeWidth={2.4} aria-hidden />
            <span className="max-[400px]:sr-only">{t('คุยกับโมชิ', 'Chat with Mochi')}</span>
          </button>
        }
      >
        <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-2 gap-y-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-x-4">
          <View3D
            className="h-32 w-full sm:row-span-2 sm:h-44"
            label={t('น้องโมชิ มาสคอตของ moshimoshi กำลังทักทาย', "Little Mochi, moshimoshi's mascot, saying hi")}
          >
            <MochiStage
              color="peach"
              expression={def?.expression ?? 'talk'}
              accessory={def?.accessory ?? 'none'}
              zoom={0.9}
              deco={false}
            />
          </View3D>

          <AskBubble />

          <div role="group" aria-label={t('ความรู้สึกวันนี้', "Today's mood")} className="col-span-2 flex flex-wrap gap-2 sm:col-span-1 sm:col-start-2">
            {MOODS.map((m) => (
              <MoodChip key={m.key} mood={m.key} on={mood === m.key} onPick={() => openChat(mood === m.key ? null : m.key)} />
            ))}
          </div>
        </div>
      </Block>

      <MochiChat open={chat.open} onClose={() => setChat((c) => ({ ...c, open: false }))} initialMood={chat.mood} />
    </>
  )
}

function MoodChip({ mood, on, onPick }: { mood: Mood; on: boolean; onPick: () => void }) {
  const reduce = useReducedMotion()
  const m = MOOD_BY_KEY[mood]
  const p = MOCHI[m.color]
  return (
    <motion.button
      type="button"
      aria-pressed={on}
      onClick={onPick}
      whileHover={reduce ? undefined : { y: -2 }}
      whileTap={{ scale: 0.92 }}
      animate={reduce ? undefined : { scale: on ? [1, 1.1, 1] : 1 }}
      transition={{ ...spring.bouncy, scale: { duration: 0.35 } }}
      className="inline-flex h-11 items-center gap-1.5 rounded-full border px-4 font-display text-[15px] font-semibold text-ink shadow-[var(--shadow-soft)] transition-colors"
      style={on ? { background: p.base, borderColor: p.shade, boxShadow: `inset 0 -3px 0 ${p.shade}` } : { background: p.light, borderColor: 'transparent' }}
    >
      <m.Icon size={18} strokeWidth={2.4} aria-hidden />
      {m.label}
    </motion.button>
  )
}

/** The mascot's question, as an incoming chat bubble with its tail toward the mascot. */
function AskBubble() {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.85, x: -8 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      transition={{ ...spring.bouncy, delay: 0.3 }}
      style={{ transformOrigin: 'left center' }}
      className="relative min-w-0 self-center rounded-3xl rounded-bl-md bg-white px-4 py-3 shadow-[var(--shadow-soft)]"
    >
      <span aria-hidden className="absolute bottom-3 -left-2 size-4 rotate-45 rounded-[4px] bg-white" />
      <p className="relative font-display text-lg leading-snug font-semibold text-ink sm:text-xl">{t('วันนี้เป็นไงบ้าง?', 'How are you today?')}</p>
      <p className="relative text-sm text-ink-soft">{t('แตะเลือกได้เลย แล้วมาคุยกันนะ', "Tap one and let's talk")}</p>
    </motion.div>
  )
}
