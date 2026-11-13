import { ArrowLeftRight, Clock3, DoorOpen, Heart, MessagesSquare, Quote, Star, type LucideIcon } from 'lucide-react'
import { useMemo } from 'react'
import { useMyWaveAnswers, useRooms } from '@/data/hooks'
import { promptLabel } from '@/data/tags'
import { t } from '@/lib/i18n'
import { useMoshi } from '@/lib/store'
import type { MochiColor, PromptAnswer, Room, User, WaveAnswers } from '@/lib/types'
import { answeredCount, WAVE_ROUND_SIZE } from '@/lib/waveQuiz'
import type { EditKind } from './EditSheets'

/*
 * "คลื่นชัดขึ้น": the pieces of my profile that the wave (src/lib/matching.ts) reads, and how
 * much of each makes it clear. The card on my profile walks through them in this order and
 * offers one at a time.
 *
 * To add a piece, add one entry to WAVE_ITEMS (see 'tune', the "จูนคลื่น" quiz) and, if it
 * needs more than my profile, the rooms and my quiz picks, a field on WaveContext (filled in useWave).
 * Text is read through functions, so it's always in the language of the moment.
 */

export interface WaveContext {
  me: User
  rooms: Room[]
  /** my "จูนคลื่น" picks */
  quiz: WaveAnswers
}

/** what the "next" button does: open one of my edit sheets (at a step), or go to a page */
export type WaveOpen = { sheet: EditKind; step?: number } | { to: string }

export interface WaveItem {
  key: string
  Icon: LucideIcon
  tone: MochiColor
  /** how many there are now */
  have: (c: WaveContext) => number
  /** how many make this piece clear */
  need: number
  /** what the piece is, e.g. "เรื่องเล่า" */
  name: () => string
  /** the button, given how many are still missing */
  cta: (left: number) => string
  /** one line on why it helps */
  why: () => string
  open: (c: WaveContext) => WaveOpen
}

/** a story that counts: it has an answer and a question we can show */
const told = (p: PromptAnswer | undefined) => !!p && p.text.trim().length > 0 && !!promptLabel(p)

export const WAVE_ITEMS: WaveItem[] = [
  {
    key: 'interests',
    Icon: Heart,
    tone: 'pink',
    have: ({ me }) => me.tags.length,
    need: 3,
    name: () => t('เรื่องที่ชอบ', 'Interests'),
    cta: (left) => t(`เลือกเรื่องที่ชอบอีก ${left} เรื่อง`, left === 1 ? 'Pick 1 more interest' : `Pick ${left} more interests`),
    why: () => t('เรื่องที่ชอบคือหัวใจของคลื่น ใช้หาคนที่ชอบเหมือนกัน', 'Interests are the heart of your wave. They find people who like what you like'),
    open: () => ({ sheet: 'tags', step: 0 }),
  },
  {
    // one round's worth of picks, from any week: enough for the wave to compare with most people
    key: 'tune',
    Icon: ArrowLeftRight,
    tone: 'lavender',
    have: ({ quiz }) => answeredCount(quiz),
    need: WAVE_ROUND_SIZE,
    name: () => t('จูนคลื่น', 'This or that'),
    cta: (left) =>
      left >= WAVE_ROUND_SIZE
        ? t('เล่นจูนคลื่น', 'Play this or that')
        : t(`ตอบจูนคลื่นอีก ${left} ข้อ`, left === 1 ? 'Answer 1 more this-or-that' : `Answer ${left} more this-or-thats`),
    why: () =>
      t(
        'เลือกระหว่างสองอย่าง ตอบเร็วๆ 8 ข้อ โมชิจะจับคู่คนคลื่นเดียวกันได้แม่นขึ้น',
        '8 quick picks between two things, so Mochi can match you more closely',
      ),
    open: () => ({ to: '/app/tune' }),
  },
  {
    key: 'loves',
    Icon: Star,
    tone: 'butter',
    have: ({ me }) => me.loves.filter((id) => me.tags.includes(id)).length,
    need: 1,
    name: () => t('เรื่องที่รักมาก', 'Top loves'),
    cta: () => t('ติดดาวเรื่องที่รักมาก', 'Star the ones you love most'),
    why: () => t('ติดดาวได้ 3 เรื่อง คนที่อินเรื่องเดียวกันจะเจอเราแม่นขึ้น', 'Star up to 3, so people who are just as into them find you'),
    open: ({ me }) => ({ sheet: 'tags', step: me.tags.length >= 3 ? 1 : 0 }),
  },
  {
    key: 'stories',
    Icon: Quote,
    tone: 'peach',
    have: ({ me }) => me.prompts.filter(told).length,
    need: 2,
    name: () => t('เรื่องเล่า', 'Stories'),
    cta: (left) => (left > 1 ? t('เล่าเรื่องของเราสักเรื่อง', 'Share a story') : t('เล่าอีกสักเรื่อง', 'Share one more story')),
    why: () => t('เรื่องเล่าช่วยให้คนที่คลื่นตรงกันมีเรื่องเริ่มทักแชทง่ายขึ้น', 'Stories give people on your wavelength an easy way to say hi'),
    open: ({ me }) => ({ sheet: 'stories', step: told(me.prompts[0]) ? 1 : 0 }),
  },
  {
    key: 'online',
    Icon: Clock3,
    tone: 'sky',
    have: ({ me }) => me.online.length,
    need: 1,
    name: () => t('ช่วงที่ออนไลน์', 'Online times'),
    cta: () => t('บอกช่วงที่มักออนไลน์', "Add when you're usually online"),
    why: () => t('คนที่ออนไลน์ช่วงเดียวกันได้คุยกันทันใจกว่า', 'People online at the same times get to chat in the moment'),
    open: () => ({ sheet: 'online' }),
  },
  {
    key: 'style',
    Icon: MessagesSquare,
    tone: 'lavender',
    have: ({ me }) => me.chatStyle.length,
    need: 1,
    name: () => t('สไตล์การคุย', 'Chat style'),
    cta: () => t('เลือกสไตล์การคุย', 'Pick your chat style'),
    why: () => t('สไตล์การคุยที่เข้ากัน ทำให้คุยกันสบายใจ', 'Matching chat styles make conversations feel easy'),
    open: () => ({ sheet: 'style' }),
  },
  {
    key: 'rooms',
    Icon: DoorOpen,
    tone: 'mint',
    // the lounge is everyone's room, so it doesn't say anything about us
    have: ({ me, rooms }) => me.rooms.filter((id) => !rooms.find((r) => r.id === id)?.isLobby).length,
    need: 1,
    name: () => t('ห้องที่อยู่', 'Rooms'),
    cta: () => t('เข้าห้องที่ชอบสักห้อง', 'Join a room you like'),
    why: () => t('คนที่อยู่ห้องเดียวกันจะเจอกันง่ายขึ้น', 'People in the same rooms find each other more easily'),
    open: () => ({ to: '/app/rooms' }),
  },
]

export interface WaveStatus {
  item: WaveItem
  have: number
  left: number
  done: boolean
}

export interface WaveProgress {
  items: WaveStatus[]
  done: number
  total: number
  /** the first piece still missing; undefined when the wave is clear */
  next?: WaveStatus
}

export function waveProgress(c: WaveContext, items: WaveItem[] = WAVE_ITEMS): WaveProgress {
  const list = items.map((item) => {
    const have = item.have(c)
    const left = Math.max(0, item.need - have)
    return { item, have, left, done: left === 0 }
  })
  return { items: list, done: list.filter((s) => s.done).length, total: list.length, next: list.find((s) => !s.done) }
}

/** My wave right now, for any screen (my profile, home, the People tab). */
export function useWave(): WaveProgress & { context: WaveContext } {
  const me = useMoshi((s) => s.me)
  const rooms = useRooms()
  const quiz = useMyWaveAnswers()
  return useMemo(() => {
    const context = { me, rooms, quiz }
    return { ...waveProgress(context), context }
  }, [me, rooms, quiz])
}

/** The edit sheets my profile opens from a link: /app/me?edit=tags&step=1 */
export const EDIT_KINDS: readonly EditKind[] = ['basics', 'tags', 'stories', 'online', 'style']

/** A piece's button as a link, from anywhere: a page, or my profile with that sheet open at that question. */
export function waveHref(open: WaveOpen): string {
  if ('to' in open) return open.to
  return `/app/me?edit=${open.sheet}${open.step ? `&step=${open.step}` : ''}`
}
