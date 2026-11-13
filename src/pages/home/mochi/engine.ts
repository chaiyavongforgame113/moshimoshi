import type { LucideIcon } from 'lucide-react'
import { MessageCircleHeart, Users, Wind } from 'lucide-react'
import type { MochiFace } from '@/components/ui'
import type { MochiColor, Mood } from '@/lib/types'
import { MOOD_BY_KEY, MOOD_ROOMS, MOODS } from '../moods'
import { needsCare } from './safety'
import {
  CHEER_COUNT,
  HELP,
  MOOD_HELP,
  NEXT_COUNT,
  say,
  SHARE_COUNT,
  TOPIC_BY_ID,
  topicLength,
  TOPICS,
  VENT_COUNT,
  type HelpId,
  type MoodKey,
  type TopicId,
} from './script'

/*
 * The script as a small state machine, with no React in it: given where the
 * chat is (step + ctx) and what the person did, it says what "I" said, what
 * Mochi answers and where the chat goes next. Suggestions come back as an Ask,
 * which the chat turns into one real room, person or session.
 */

export type Step =
  | { id: 'mood' }
  | { id: 'help'; mood: MoodKey }
  | { id: 'vent' }
  | { id: 'vent-offer' }
  | { id: 'share' }
  | { id: 'breathe' }
  | { id: 'after-breathe' }
  | { id: 'topics' }
  | { id: 'topic'; topic: TopicId; at: number }
  | { id: 'topic-end'; topic: TopicId }
  | { id: 'care' }
  | { id: 'wrap' }
  | { id: 'rest' }

export interface Ctx {
  mood?: MoodKey
  /** messages vented since the last offer to pause */
  vent: number
  /** turns so far: rotates replies and chip labels */
  turn: number
}

export type Card = { kind: 'room' | 'person' | 'session'; id: string } | { kind: 'browse' } | { kind: 'hotline' }

export type Line =
  | { id: string; who: 'mochi'; key: string; sub?: string; face?: MochiFace; tip?: boolean }
  | { id: string; who: 'me'; key?: string; text?: string; tone?: MochiColor }
  | { id: string; who: 'card'; card: Card }

/** what Mochi should suggest: resolved by the chat against live data */
export type Ask = { kind: 'room'; rooms: string[] } | { kind: 'person'; pool: 'daily' | 'wave' } | { kind: 'session'; rooms: string[] }

export type Out = { say: string; sub?: string; face?: MochiFace; tip?: boolean } | { card: Card } | { ask: Ask }

export interface Turn {
  me?: { key?: string; text?: string; tone?: MochiColor }
  out: Out[]
  step: Step
  ctx: Ctx
}

export type Action =
  | { type: 'mood'; mood: Mood }
  | { type: 'own-mood'; text: string }
  | { type: 'own-topic'; text: string }
  | { type: 'text'; text: string }
  | { type: 'chip'; key: string }
  | { type: 'breathe-end'; skipped: boolean }

export const FIRST_CTX: Ctx = { vent: 0, turn: 0 }
export const MAX_TEXT = 400

const isMood = (m: MoodKey | undefined): m is Mood => !!m && m !== 'other'
const tone = (ctx: Ctx): MochiColor => (isMood(ctx.mood) ? MOOD_BY_KEY[ctx.mood].color : 'peach')
const face = (ctx: Ctx): MochiFace => (isMood(ctx.mood) ? MOOD_BY_KEY[ctx.mood].expression : 'smile')
const moodRooms = (ctx: Ctx) => MOOD_ROOMS[isMood(ctx.mood) ? ctx.mood : 'tired']

/** Where the chat goes after someone does something. Typed words are checked for self-harm first. */
export function respond(step: Step, ctx: Ctx, a: Action): Turn {
  const next = { ...ctx, turn: ctx.turn + 1 }
  if ('text' in a && needsCare(a.text)) return care(a.text.slice(0, MAX_TEXT), next)

  switch (a.type) {
    case 'mood':
      return moodTurn(a.mood, { key: `mood:${a.mood}`, tone: MOOD_BY_KEY[a.mood].color }, next)
    case 'own-mood':
      return moodTurn('other', { text: a.text.slice(0, MAX_TEXT) }, next)
    case 'own-topic':
      return { me: { text: a.text.slice(0, MAX_TEXT), tone: tone(ctx) }, out: [{ say: 'topic.own' }], step: { id: 'vent' }, ctx: { ...next, vent: 0 } }
    case 'text':
      return textTurn(step, a.text.slice(0, MAX_TEXT), next)
    case 'breathe-end':
      return a.skipped
        ? { out: [{ say: 'breathe.skip', face: 'smile' }], step: { id: 'wrap' }, ctx: next }
        : { out: [{ say: 'breathe.done', face: 'happy' }], step: { id: 'after-breathe' }, ctx: next }
    case 'chip':
      return chipTurn(step, a.key, next)
  }
}

function care(text: string, ctx: Ctx): Turn {
  return {
    me: { text, tone: tone(ctx) },
    out: [{ say: 'care.1', face: 'smile' }, { card: { kind: 'hotline' } }, { say: 'care.2', face: 'smile' }],
    step: { id: 'care' },
    ctx: { ...ctx, vent: 0 },
  }
}

function moodTurn(mood: MoodKey, me: Turn['me'], ctx: Ctx): Turn {
  const next = { ...ctx, mood }
  return {
    me,
    out: [{ say: `empathy.${mood}`, face: face(next) }, { say: 'help.ask' }],
    step: { id: 'help', mood },
    ctx: next,
  }
}

function textTurn(step: Step, text: string, ctx: Ctx): Turn {
  const me = { text, tone: tone(ctx) }
  if (step.id === 'share') {
    return { me, out: [{ say: `share.reply.${ctx.turn % SHARE_COUNT}`, face: 'happy' }], step: { id: 'wrap' }, ctx }
  }
  const reply: Out = { say: `vent.reply.${ctx.turn % VENT_COUNT}`, face: 'smile' }
  if (step.id === 'care') return { me, out: [reply], step, ctx }
  // venting: after two messages (then every three) Mochi offers to pause, rest or find company
  const vent = ctx.vent + 1
  const offer = vent === 2 || (vent > 2 && (vent - 2) % 3 === 0)
  return offer
    ? { me, out: [reply, { say: 'vent.offer' }], step: { id: 'vent-offer' }, ctx: { ...ctx, vent } }
    : { me, out: [reply], step: { id: 'vent' }, ctx: { ...ctx, vent } }
}

function helpTurn(id: HelpId, ctx: Ctx): Turn {
  const me = { key: `help.${id}`, tone: tone(ctx) }
  const turn = (out: Out[], step: Step = { id: 'wrap' }, c: Ctx = ctx): Turn => ({ me, out, step, ctx: c })
  switch (id) {
    case 'vent':
      return turn([{ say: 'vent.open', sub: 'vent.private', face: 'smile' }], { id: 'vent' }, { ...ctx, vent: 0 })
    case 'breathe':
      return turn([{ say: 'breathe.open', face: 'smile' }], { id: 'breathe' })
    case 'company':
      return turn([{ say: 'pre.company' }, { ask: { kind: 'room', rooms: moodRooms(ctx) } }])
    case 'talk':
      return turn([{ say: 'pre.talk' }, { ask: { kind: 'person', pool: 'daily' } }])
    case 'chill-spot':
    case 'quiet-spot':
      return turn([{ say: `pre.${id}` }, { ask: { kind: 'room', rooms: moodRooms(ctx) } }])
    case 'party':
      return turn([{ say: 'pre.party', face: 'wow' }, { ask: { kind: 'session', rooms: moodRooms(ctx) } }])
    case 'hobby-talk':
      return turn([{ say: 'pre.hobby-talk' }, { ask: { kind: 'person', pool: 'wave' } }])
    case 'cheer': {
      const a = ctx.turn % CHEER_COUNT
      return turn([{ say: `cheer.${a}`, face: 'happy' }, { say: `cheer.${(a + 1) % CHEER_COUNT}`, face: 'smile' }], undefined, { ...ctx, turn: ctx.turn + 1 })
    }
    case 'share':
      return turn([{ say: 'share.open', face: 'wow' }], { id: 'share' })
    case 'just-tell':
      return turn([{ say: 'just-tell', face: 'happy' }])
    case 'stay-chill':
      return turn([{ say: 'stay-chill', face: 'wink' }])
  }
}

function chipTurn(step: Step, key: string, ctx: Ctx): Turn {
  if (key.startsWith('help:')) return helpTurn(key.slice(5) as HelpId, ctx)
  const me = (k: string) => ({ key: k, tone: tone(ctx) })

  if (key.startsWith('topic:')) {
    const id = key.slice(6) as TopicId
    return { me: me(`topic.${id}`), out: [{ say: `topic.${id}.0`, face: 'smile' }], step: { id: 'topic', topic: id, at: 0 }, ctx }
  }

  switch (key) {
    case 'topics':
      return { me: me('say.topics'), out: [{ say: 'topics.ask' }], step: { id: 'topics' }, ctx }
    case 'next': {
      if (step.id !== 'topic') break
      const at = step.at + 1
      const label = me(`next.${(ctx.turn - 1) % NEXT_COUNT}`)
      return at < topicLength(step.topic)
        ? { me: label, out: [{ say: `topic.${step.topic}.${at}`, face: 'smile' }], step: { ...step, at }, ctx }
        : { me: label, out: [{ say: `topic.${step.topic}.tip`, tip: true, face: 'wink' }], step: { id: 'topic-end', topic: step.topic }, ctx }
    }
    case 'stop':
      return { me: me('chip.stop'), out: [{ say: 'topic.stop' }], step: { id: 'wrap' }, ctx }
    case 'find': {
      if (step.id !== 'topic-end') break
      const find = TOPIC_BY_ID[step.topic].find
      const ask: Ask = find.kind === 'person' ? { kind: 'person', pool: 'daily' } : { kind: 'room', rooms: find.rooms }
      return { me: me('say.find'), out: [{ say: 'pre.find' }, { ask }], step: { id: 'wrap' }, ctx }
    }
    case 'vent-stop':
      return { me: me('chip.ventStop'), out: [{ say: 'vent.stop', face: 'smile' }], step: { id: 'wrap' }, ctx }
    case 'later':
      return { me: me('chip.later'), out: [{ say: 'later', face: 'smile' }], step: { id: 'wrap' }, ctx }
    case 'better':
      return { me: me('say.better'), out: [{ say: 'breathe.better', face: 'happy' }], step: { id: 'wrap' }, ctx }
    case 'again':
      return { me: me('say.again'), out: [{ say: 'breathe.again', face: 'smile' }], step: { id: 'breathe' }, ctx }
    case 'thanks':
      return { me: me('chip.thanks'), out: [{ say: 'bye', face: 'happy' }], step: { id: 'rest' }, ctx }
    case 'more':
      return { me: me('say.more'), out: [{ say: 'hello.again', face: 'happy' }], step: { id: 'mood' }, ctx }
  }
  // a stale chip (the step moved on): just carry on where we are
  return { out: [], step, ctx }
}

export interface ChipDef {
  key: string
  label: string
  Icon?: LucideIcon
  color?: MochiColor
}

export interface Dock {
  chips: ChipDef[]
  /** "อื่นๆ" in their own words, at the end of the chips */
  own?: 'mood' | 'topic'
  /** a quieter way out, under the chips (or on its own above the composer): the support topics, or "not now" */
  aside?: ChipDef
  /** the script invites typing: the composer's placeholder */
  composer?: string
}

const chip = (key: string, labelKey: string, Icon?: LucideIcon): ChipDef => ({ key, label: say(labelKey), Icon })
const helpChip = (id: HelpId): ChipDef => ({ key: `help:${id}`, label: HELP[id].label, Icon: HELP[id].Icon })

/** The quick replies (and composer) for a step. Read at render time, so labels follow the language. */
export function dockFor(step: Step, ctx: Ctx): Dock {
  const topics = chip('topics', 'chip.topics', MessageCircleHeart)
  const thanks = chip('thanks', 'chip.thanks')
  switch (step.id) {
    case 'mood':
      return {
        chips: MOODS.map((m) => ({ key: `mood:${m.key}`, label: m.label, Icon: m.Icon, color: m.color })),
        own: 'mood',
        aside: chip('topics', 'chip.topics.first', MessageCircleHeart),
      }
    case 'help':
      return { chips: MOOD_HELP[step.mood].map(helpChip), aside: topics }
    case 'vent':
      // a way out before the offer to pause comes: "ไว้ก่อนนะ" before saying anything, "พอแค่นี้ก่อน" after
      return { chips: [], aside: ctx.vent ? chip('vent-stop', 'chip.ventStop') : chip('later', 'chip.later'), composer: say('composer.vent') }
    case 'vent-offer':
      return { chips: [chip('vent-stop', 'chip.ventStop'), helpChip('breathe'), helpChip('company')], composer: say('composer.ventMore') }
    case 'share':
      return { chips: [], aside: chip('later', 'chip.later'), composer: say('composer.share') }
    case 'breathe':
      return { chips: [] }
    case 'after-breathe':
      return { chips: [chip('better', 'chip.better'), chip('again', 'chip.again', Wind), helpChip('company')] }
    case 'topics':
      return { chips: TOPICS.map((tp) => ({ key: `topic:${tp.id}`, label: tp.label, Icon: tp.Icon })), own: 'topic' }
    case 'topic':
      return { chips: [chip('next', `next.${ctx.turn % NEXT_COUNT}`), chip('stop', 'chip.stop')] }
    case 'topic-end':
      return { chips: [chip('find', 'chip.find', Users), chip('topics', 'chip.other', MessageCircleHeart), thanks] }
    case 'care':
      return { chips: [helpChip('breathe'), thanks], composer: say('composer.care') }
    case 'wrap':
      return { chips: [topics, thanks] }
    case 'rest':
      return { chips: [chip('more', 'chip.more', MessageCircleHeart)] }
  }
}

/** A saved step this version still understands (else the chat starts from the mood question). */
export function validStep(s: unknown): Step | undefined {
  if (!s || typeof s !== 'object' || !('id' in s)) return undefined
  const step = s as Step
  switch (step.id) {
    case 'help':
      return step.mood in MOOD_HELP ? step : undefined
    case 'topic':
      return step.topic in TOPIC_BY_ID && step.at >= 0 && step.at < topicLength(step.topic) ? step : undefined
    case 'topic-end':
      return step.topic in TOPIC_BY_ID ? step : undefined
    case 'mood':
    case 'vent':
    case 'vent-offer':
    case 'share':
    case 'breathe':
    case 'after-breathe':
    case 'topics':
    case 'care':
    case 'wrap':
    case 'rest':
      return step
    default:
      return undefined
  }
}
