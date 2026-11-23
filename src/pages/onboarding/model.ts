// Onboarding draft: what the visitor is building step by step, plus the
// rules that turn it into a profile and a first intent.
import type { MochiAccessory, MochiExpression } from '@/components/three'
import { tagLabelTh, tagOf } from '@/data/tags'
import { known, t } from '@/lib/i18n'
import { normalizeLifeStages } from '@/lib/lifeStages'
import type { Intent, IntentTemplate, IntentWhen, MochiColor, OnlineSlot, Room, TagCategory, User } from '@/lib/types'

export interface Draft {
  name: string
  /** '1'..'12' or '' (month + year are only used for the 20+ check) */
  birthMonth: string
  /** raw digits as typed, พ.ศ. or ค.ศ. */
  birthYear: string
  /** false once the profile already has a birth year (the check never repeats) */
  needsAge: boolean
  color: MochiColor
  face: MochiExpression
  accessory: MochiAccessory
  tags: string[]
  /** up to 3 starred tags ("รักมาก"), always a subset of tags */
  loves: string[]
  /** The free-form answer shown as the profile intro. */
  bio: string
  /** Selected goals. The active intent is the one used for the first invite. */
  intents?: IntentTemplate[]
  intent: IntentTemplate | null
  /** topic for the "คุยเรื่อง…" template */
  intentTag: string | null
  /**
   * What they changed in the post น้องโมชิ wrote, per template, so trying another card and coming
   * back keeps their words. Optional: a draft from before this field existed still works.
   */
  postEdits?: Partial<Record<IntentTemplate, PostEdit>>
  online: OnlineSlot[]
  chatStyle: string[]
  /** "ช่วงชีวิต", up to LIFE_STAGE_MAX (stored Thai values, or what they typed) */
  lifeStages: string[]
}

export type DraftPatch = Partial<Draft> | ((d: Draft) => Partial<Draft>)
export type UpdateDraft = (patch: DraftPatch) => void

export const intentChoices = (d: Draft): IntentTemplate[] => d.intents ?? (d.intent ? [d.intent] : [])

export interface StepProps {
  draft: Draft
  update: UpdateDraft
  desktop: boolean
}

export const NAME_MAX = 20
export const STORY_MIN = 15
export const STORY_MAX = 150
export const BIO_MAX = 150
export const MIN_TAGS = 3
export const MAX_LOVES = 3
export const MAX_STYLES = 2

export const lookPatch = (d: Draft): Pick<User, 'face' | 'accessory'> => ({ face: d.face, accessory: d.accessory })

/** First visit starts fresh; a finished profile is loaded so revisiting edits it. */
export function initialDraft(me: User, onboarded: boolean, bio: string): Draft {
  const base = {
    birthMonth: '',
    birthYear: '',
    needsAge: false,
    color: me.color,
    face: me.face ?? 'smile',
    accessory: me.accessory ?? 'none',
    bio,
    intent: null,
    intents: [],
    intentTag: null,
  } satisfies Partial<Draft>
  if (!onboarded) {
    // someone who skipped earlier (birth year saved, before the age limit was removed) keeps the name they typed
    const name = me.birthYear ? me.name.slice(0, NAME_MAX) : ''
    return { ...base, name, tags: [], loves: [], online: [], chatStyle: [], lifeStages: [] }
  }
  return {
    ...base,
    name: me.name.slice(0, NAME_MAX),
    tags: [...me.tags],
    loves: me.loves.filter((t) => me.tags.includes(t)).slice(0, MAX_LOVES),
    online: [...me.online],
    chatStyle: me.chatStyle.slice(0, MAX_STYLES),
    lifeStages: normalizeLifeStages(me.lifeStages),
  }
}

export const textLength = (s: string) => s.trim().length

export interface StepCheck {
  ok: boolean
  /** short, kind nudge shown on the action button / announced when blocked */
  need?: string
}

// ------------------------------------------------------------------ the screens, one question each
/**
 * The order people meet them in. "topic" is the second half of "intent": it only shows when they
 * picked "คุยเรื่อง…" and counts as the same question in the progress ("6/11"). "life" (ช่วงชีวิต)
 * only shows once the server keeps life stages (useServerFeatures().lifeStages; always in demo).
 */
export const SCREEN_ORDER = ['name', 'rules', 'mochi', 'likes', 'loves', 'intent', 'topic', 'life', 'online', 'style', 'story', 'done'] as const
export type ScreenKey = (typeof SCREEN_ORDER)[number]

/** What the server can keep, which decides the screens on offer. */
export interface FlowOptions {
  lifeStages: boolean
}

const offered = (k: ScreenKey, o: FlowOptions) => k !== 'life' || o.lifeStages

/** The screens this draft walks through. */
export const screenFlow = (d: Draft, o: FlowOptions): ScreenKey[] =>
  SCREEN_ORDER.filter((k) => offered(k, o) && (k !== 'topic' || (d.intent === 'talk' && d.tags.length > 0)))

/** The steps the progress counts. The topic screen shares intent's number. */
const counted = (o: FlowOptions) => SCREEN_ORDER.filter((k) => k !== 'topic' && offered(k, o))

/** How many questions the progress shows ("…/11"). */
export const questionCount = (o: FlowOptions) => counted(o).length

/** 1-based step number for "3/11". */
export function questionOf(screen: ScreenKey, o: FlowOptions): number {
  const list = counted(o)
  return Math.max(1, list.indexOf(screen === 'topic' ? 'intent' : screen) + 1)
}

/** Skippable ("ข้ามไปก่อน"): skipping moves on without asking for an answer. Someone editing a finished profile may skip "intent" too. */
export const isOptional = (screen: ScreenKey, editing: boolean) =>
  screen === 'loves' || screen === 'life' || screen === 'online' || screen === 'style' || (editing && screen === 'intent')

/** Whether Next may move on. Optional screens ask for an answer here; leaving them empty is what Skip is for. */
export function validate(screen: ScreenKey, d: Draft): StepCheck {
  switch (screen) {
    case 'name':
      return textLength(d.name) ? { ok: true } : { ok: false, need: t('บอกชื่อเล่นให้เรารู้จักหน่อยนะ', 'Tell me your nickname first') }
    case 'likes': {
      const left = MIN_TAGS - d.tags.length
      return left > 0 ? { ok: false, need: t(`เลือกอีก ${left} อย่างนะ`, `Pick ${left} more`) } : { ok: true }
    }
    case 'loves':
      return d.loves.length ? { ok: true } : { ok: false, need: t('ติดดาวสักอย่างนะ', 'Star one first') }
    case 'intent':
      return d.intent ? { ok: true } : { ok: false, need: t('เลือกอย่างน้อย 1 อย่างนะ', 'Pick at least one') }
    case 'life':
      return d.lifeStages.length ? { ok: true } : { ok: false, need: t('เลือกสัก 1 อย่างนะ', 'Pick one first') }
    case 'online':
      return d.online.length ? { ok: true } : { ok: false, need: t('เลือกสักช่วงนะ', 'Pick a time first') }
    case 'style':
      return d.chatStyle.length ? { ok: true } : { ok: false, need: t('เลือกสักแบบนะ', 'Pick a style first') }
    case 'story': {
      const first = textLength(d.bio)
      if (first < STORY_MIN) {
        const left = STORY_MIN - first
        return {
          ok: false,
          need: first
            ? t(`อีก ${left} ตัวอักษรก็ครบ`, `${left} more ${left === 1 ? 'character' : 'characters'} to go`)
            : t('เล่าให้ฟังสักนิดนะ', 'Tell me a little something'),
        }
      }
      return { ok: true }
    }
    default:
      return { ok: true }
  }
}

const label = (tagId: string) => tagOf(tagId)?.label ?? tagId

// ------------------------------------------------------------------ first intent
export type IntentDraft = Omit<Intent, 'id' | 'userId' | 'postedMinutesAgo' | 'joinedBy'>

const lobbyOf = (rooms: Room[]) => rooms.find((r) => r.isLobby)

const roomForTag = (tagId: string, rooms: Room[]) => rooms.find((r) => !r.isLobby && r.tags.includes(tagId))?.id ?? lobbyOf(rooms)?.id

function pickTag(d: Draft, cats: TagCategory[], fallback: string): string {
  const inCat = (t: string) => cats.includes(tagOf(t)?.category as TagCategory)
  return d.loves.find(inCat) ?? d.tags.find(inCat) ?? fallback
}

/** Same cap as the ชวนเล่น composer (pages/post TEXT_MAX), so editing the post there later never cuts it (intents.body allows 200). */
export const POST_TEXT_MAX = 100

/** The times the post card offers ("dated" needs a date, which only the composer asks for). */
export type PostWhen = Exclude<IntentWhen, 'dated'>

/** What the visitor changed in the post น้องโมชิ wrote. Anything missing keeps Mochi's. */
export interface PostEdit {
  /** their own words as typed; blank means Mochi's sentence */
  text?: string
  when?: PostWhen
  mode?: Intent['mode']
}

/** stored Thai like the composer's, shown with known() */
const WHEN_LABEL_TH: Record<PostWhen, string | undefined> = { tonight: 'คืนนี้', weekend: 'สุดสัปดาห์นี้', anytime: undefined }

/** One line, single spaces, never longer than a post can be. */
export const tidyPostText = (text: string) => text.replace(/\s+/g, ' ').trim().slice(0, POST_TEXT_MAX).trim()

/** The changes for the template they picked (none yet: an empty edit). */
export const postEditOf = (d: Draft): PostEdit => (d.intent ? d.postEdits?.[d.intent] : undefined) ?? {}

/** Patch that merges `change` into the picked template's edit. */
export const editPost =
  (change: PostEdit) =>
  (d: Draft): Partial<Draft> =>
    d.intent ? { postEdits: { ...d.postEdits, [d.intent]: { ...d.postEdits?.[d.intent], ...change } } } : {}

/**
 * The post น้องโมชิ writes from the chosen quick template (rooms that don't exist are left off), before
 * the visitor's own changes. The text reads like the person wrote it, so it's in their language;
 * whenLabel stays Thai (stored, shown with known()).
 */
export function suggestedIntent(d: Draft, province: string, rooms: Room[]): IntentDraft | null {
  const intent = templateIntent(d, province, rooms)
  if (!intent) return null
  const roomId = intent.roomId && rooms.some((r) => r.id === intent.roomId) ? intent.roomId : undefined
  return { ...intent, roomId }
}

/** The post that goes up: Mochi's, with the visitor's own words, time and place on top (a cleared text falls back to Mochi's). */
export function buildIntent(d: Draft, province: string, rooms: Room[]): IntentDraft | null {
  const base = suggestedIntent(d, province, rooms)
  if (!base) return null
  const edit = postEditOf(d)
  const out: IntentDraft = { ...base, text: tidyPostText(edit.text ?? '') || base.text }
  if (edit.when && edit.when !== base.when) {
    out.when = edit.when
    out.whenLabel = WHEN_LABEL_TH[edit.when]
  }
  if (edit.mode && edit.mode !== base.mode) {
    out.mode = edit.mode
    out.province = edit.mode === 'offline' ? (base.province ?? province) : undefined
  }
  return out
}

function templateIntent(d: Draft, province: string, rooms: Room[]): IntentDraft | null {
  const tpl = d.intent
  if (!tpl) return null
  switch (tpl) {
    case 'play': {
      const tagId = pickTag(d, ['game'], 'cozygame')
      const text = t(`หาเพื่อนเล่น ${label(tagId)} ด้วยกัน สบายๆ ไม่ toxic`, `Looking for friends to play ${label(tagId)} with. Chill, no toxicity`)
      return { template: tpl, role: 'peer', tagId, text, when: 'tonight', whenLabel: 'คืนนี้', mode: 'online', roomId: 'game-night' }
    }
    case 'talk': {
      const tagId = (d.intentTag && d.tags.includes(d.intentTag) ? d.intentTag : null) ?? d.loves[0] ?? d.tags[0] ?? 'frieren'
      const text = t(`อยากมีคนคุยเรื่อง ${label(tagId)} ยาวๆ แบบไม่มีใครตัดสิน`, `Want someone to talk ${label(tagId)} with for hours, no judgment`)
      return { template: tpl, role: 'peer', tagId, text, when: 'anytime', mode: 'online', roomId: roomForTag(tagId, rooms) }
    }
    case 'lang': {
      const tagId = pickTag(d, ['lang'], 'japanese')
      if (tagId === 'thai') {
        const text = t('อยากหาเพื่อนฝึกภาษาไทย คุยเล่นสบายๆ ผิดได้ ขำได้', 'Looking for a friend to practice Thai with. Casual chats, mistakes and laughs welcome')
        return { template: tpl, role: 'peer', tagId, text, when: 'anytime', mode: 'online', roomId: 'lang' }
      }
      return {
        template: tpl,
        role: 'swap',
        tagId,
        text: t(`สอนภาษาไทยให้ได้ อยากฝึก${label(tagId)} แลกกันไหม`, `I can teach Thai and want to practice ${label(tagId)}. Swap?`),
        when: 'anytime',
        mode: 'online',
        // saved Thai like the ชวนเล่น flow's languages ("ภาษาญี่ปุ่น"), shown with known()
        give: 'ภาษาไทย',
        want: tagLabelTh(tagId),
        roomId: 'lang',
      }
    }
    case 'event': {
      const tagId = d.tags.includes('concert') ? 'concert' : pickTag(d, ['music'], 'concert')
      const text = t('หาเพื่อนไปคอนเสิร์ตหรืองานอีเวนต์ ไปคนเดียวเขิน ไปเป็นแก๊งกัน', "Looking for concert or event buddies. Going solo is awkward, let's go as a gang")
      return { template: tpl, role: 'peer', tagId, text, when: 'weekend', whenLabel: 'สุดสัปดาห์นี้', mode: 'offline', province, roomId: 'music' }
    }
    case 'newbie': {
      const tagId = d.loves[0] ?? d.tags[0] ?? 'cozygame'
      const text = t(`เพิ่งมาใหม่ ยังไม่รู้จักใครเลย ชอบ ${label(tagId)} ทักมาคุยกันได้นะ`, `New here and don't know anyone yet. Into ${label(tagId)}, come say hi!`)
      return { template: tpl, role: 'peer', tagId, text, when: 'anytime', mode: 'online', roomId: lobbyOf(rooms)?.id }
    }
    case 'study': {
      const tagId = pickTag(d, ['study'], 'cowork')
      const text = t('หาเพื่อนนั่งทำงานหรือติวด้วยกัน ทำเงียบๆ แต่ไม่เหงา', 'Looking for a work or study buddy. Quiet, but never lonely')
      return { template: tpl, role: 'peer', tagId, text, when: 'tonight', whenLabel: 'คืนนี้', mode: 'online', roomId: 'cowork' }
    }
    case 'moved': {
      const text = t(`เพิ่งย้ายมา${province} อยากมีเพื่อนแถวนี้ไปหาของอร่อยด้วยกัน`, `Just moved to ${known(province)}. Looking for local friends to hunt down good food with`)
      return { template: tpl, role: 'peer', tagId: 'movedbkk', text, when: 'weekend', whenLabel: 'สุดสัปดาห์นี้', mode: 'offline', province, roomId: 'moved-bkk' }
    }
    case 'listen': {
      const text = t('ช่วงนี้อยากมีคนรับฟัง คุยเบาๆ ไม่ต้องมีคำตอบก็ได้', 'Could use someone to listen lately. Gentle chats, no answers needed')
      return { template: tpl, role: 'seek', tagId: 'listening', text, when: 'anytime', mode: 'online', roomId: 'listen' }
    }
  }
}
