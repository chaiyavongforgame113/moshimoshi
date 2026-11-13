import { motion, useReducedMotion, useScroll, useTransform, type MotionValue, type Variants } from 'motion/react'
import { useRef } from 'react'
import { Quote } from 'lucide-react'
import { Avatar, Chip, RoomIcon, SignalMeter, type MochiFace } from '@/components/ui'
import { ROOM_BY_ID } from '@/data/mock'
import { MOCHI } from '@/lib/colors'
import { L, loc, t } from '@/lib/i18n'
import { roomInLang } from '@/lib/i18n/catalog'
import { useIsDesktop } from '@/lib/hooks'
import { spring } from '@/lib/motion'
import type { MochiColor, SignalLevel } from '@/lib/types'
import { TiltCard } from './fx'
import { SectionIntro } from './shared'

interface Story {
  name: string
  color: MochiColor
  face: MochiFace
  roomId: string
  level: SignalLevel
  text: string
  rotate: number
}

// Illustrative stories (clearly labelled "ตัวอย่าง" in the UI).
const STORIES: Story[] = [
  loc<Story>({
    name: 'ภูมิ',
    color: 'butter',
    face: 'happy',
    roomId: 'moved-bkk',
    level: 4,
    text: L(
      'ย้ายมากรุงเทพฯ ได้เดือนเดียว ไม่รู้จักใครเลย เข้าห้องเพิ่งย้ายมาแล้วได้แก๊งกินหมูกระทะทุกวันศุกร์',
      "A month into Bangkok, I didn't know a soul. I joined New to Bangkok, and now I've got a Friday mookata crew.",
    ),
    rotate: -2,
  }),
  loc<Story>({
    name: 'เจได',
    color: 'lavender',
    face: 'wink',
    roomId: 'game-night',
    level: 5,
    text: L(
      'นึกว่าจะไม่มีใครชอบ Hollow Knight เหมือนเรา สุดท้ายเจอคนคลื่นเดียวกันเป๊ะ ตอนนี้เล่นด้วยกันแทบทุกคืน',
      'I figured no one loved Hollow Knight like I do. Then I found someone totally on my wavelength. Now we play almost every night.',
    ),
    rotate: 1.6,
  }),
  loc<Story>({
    name: 'ไอซ์',
    color: 'sky',
    face: 'smile',
    roomId: 'listen',
    level: 2,
    text: L(
      'คืนที่เครียดเรื่องงาน แค่มีคนพิมพ์ว่า “เหนื่อยเหมือนกัน” ก็รู้สึกไม่เหงาแล้ว ไม่ต้องเก่ง ไม่ต้องมีคำตอบก็ได้',
      "One stressful night, someone just typed “I'm tired too” and suddenly I didn't feel alone. No need to be strong or have answers.",
    ),
    rotate: -1.2,
  }),
  loc<Story>({
    name: 'แพรวา',
    color: 'mint',
    face: 'happy',
    roomId: 'lang',
    level: 3,
    text: L(
      'เราสอนไทย เพื่อนสอนญี่ปุ่น พูดผิดก็หัวเราะด้วยกัน จากคู่ฝึกภาษากลายเป็นเพื่อนสนิทไปแล้ว',
      'I teach Thai, she teaches Japanese, and we laugh at every mistake. Language partners turned best friends.',
    ),
    rotate: 2,
  }),
]

function StoryCard({ story }: { story: Story }) {
  const p = MOCHI[story.color]
  const room = ROOM_BY_ID[story.roomId] && roomInLang(ROOM_BY_ID[story.roomId])
  return (
    <TiltCard rotate={story.rotate} className="h-full">
      <figure
        className="relative flex h-full flex-col rounded-[1.75rem] border border-white p-5 shadow-[var(--shadow-soft)]"
        style={{
          backgroundColor: p.light,
          // dotted notebook paper
          backgroundImage: `radial-gradient(${p.base} 1.1px, transparent 1.4px)`,
          backgroundSize: '16px 16px',
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-white/80" aria-hidden>
            <Quote size={18} strokeWidth={2.6} style={{ color: p.ink }} />
          </span>
          <Chip size="sm" color="cream">
            {t('ตัวอย่าง', 'Example')}
          </Chip>
        </div>
        <blockquote className="mt-3 flex-1 font-display text-[1.06rem] leading-[1.8] text-ink">{story.text}</blockquote>
        <figcaption className="mt-4 flex items-center gap-3 rounded-2xl bg-white/85 p-2.5">
          <Avatar color={story.color} size={40} face={story.face} />
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block font-display font-semibold">{story.name}</span>
            {room && (
              <span className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-soft">
                <RoomIcon room={room} size={18} />
                <span className="truncate">{room.name}</span>
              </span>
            )}
          </span>
        </figcaption>
        <div className="mt-2.5 flex items-center justify-between gap-2 px-1 text-xs text-ink-soft">
          <span>{t('เจอกันตอนสัญญาณ', 'Signal when they met')}</span>
          <SignalMeter level={story.level} size="xs" short />
        </div>
      </figure>
    </TiltCard>
  )
}

// desktop: the two columns drift at different speeds while the section scrolls by (a whole column moves together, so cards never run into each other)
const DRIFT = [36, -28]

// each card pops in as it scrolls into view (on phones they come one by one down the stack); the right column a beat after the left
const REVEAL: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: (col: number) => ({ opacity: 1, y: 0, transition: { ...spring.soft, delay: col * 0.1 } }),
}
const REVEAL_STILL: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
}

function StoryItem({ story, i, progress, drift, reduce }: { story: Story; i: number; progress: MotionValue<number>; drift: boolean; reduce: boolean }) {
  const d = DRIFT[i % DRIFT.length]
  const y = useTransform(progress, [0, 1], drift ? [d, -d] : [0, 0])
  return (
    <motion.li
      variants={reduce ? REVEAL_STILL : REVEAL}
      custom={i % 2}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.25 }}
      className="min-w-0"
    >
      <motion.div style={{ y }} className="h-full">
        <StoryCard story={story} />
      </motion.div>
    </motion.li>
  )
}

export function Stories() {
  const reduce = useReducedMotion()
  const desktop = useIsDesktop()
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  return (
    <section ref={ref} id="stories" aria-labelledby="stories-title" className="relative scroll-mt-24 py-20 outline-none lg:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionIntro
          id="stories-title"
          eyebrow={t('เรื่องจากวง', 'From the circle')}
          icon={<Quote size={14} />}
          tone="bg-sky/60"
          title={t('เรื่องเล็กๆ ที่เริ่มจาก “โมชิโมชิ”', 'Little stories that began with “moshi\u00A0moshi”')}
        >
          {t(
            'ตัวอย่างเรื่องที่เราอยากให้เกิดขึ้นที่นี่ทุกวัน ระดับสัญญาณไหนก็เป็นเพื่อนกันได้',
            'The kind of moments we hope happen here every day. Friendships can start at any signal level.',
          )}
        </SectionIntro>
      </div>
      {/* phones: one story under another; wider: two columns. Only ever scrolls top to bottom */}
      <ul className="mx-auto mt-8 grid max-w-xl gap-5 px-4 sm:px-6 md:max-w-4xl md:grid-cols-2 md:gap-6 lg:mt-10 lg:max-w-5xl lg:gap-8">
        {STORIES.map((s, i) => (
          <StoryItem key={s.name} story={s} i={i} progress={scrollYProgress} drift={desktop && !reduce} reduce={!!reduce} />
        ))}
      </ul>
    </section>
  )
}
