import type { BlockedPerson } from '@/data/blocked'
import { imageFromPath } from '@/data/chatImages'
import { cutText } from '@/data/tags'
import { normalizeLifeStages } from '@/lib/lifeStages'
import type {
  Chat,
  ChatMessage,
  ComparePreview,
  DailyAnswer,
  DailyQuestion,
  Intent,
  IntentRole,
  IntentTemplate,
  IntentWhen,
  IntroRequest,
  MochiColor,
  OnlineSlot,
  PairAnswer,
  PromptAnswer,
  Room,
  RoomWatch,
  Session,
  User,
  WatchProvider,
} from '@/lib/types'
import type {
  AnswerRow,
  BlockedPersonRow,
  ChatMemberRow,
  ChatMessageRow,
  ChatRow,
  ChatStatus,
  EventMessageRow,
  IntentRow,
  IntroRequestRow,
  PairAnswerRow,
  ProfileRow,
  QuestionRow,
  RoomMessageRow,
  RoomRow,
  RoomWatchRow,
  SessionRow,
} from './rows'
import { bangkokYear, dayOffset, hhmm, lastActiveLabel, messageTime, minutesAgo } from './time'

// DB row → app type. Counts and "who else" lists leave me out on purpose:
// pages add me on top when I joined / reacted / RSVP'd (same as demo data).

/** Live chats also carry their server status and who rang (see pages/chats/lib.ts). */
export type LiveChat = Chat & { status: ChatStatus; requestedBy: string }

const COLORS: readonly MochiColor[] = ['peach', 'butter', 'mint', 'lavender', 'sky', 'pink', 'cream']
const FACES: readonly NonNullable<User['face']>[] = ['smile', 'happy', 'wink', 'sleepy', 'talk', 'wow']
const ACCESSORIES: readonly NonNullable<User['accessory']>[] = ['none', 'headset', 'leaf', 'bow', 'cap']
const SLOTS: readonly OnlineSlot[] = ['morning', 'afternoon', 'evening', 'late']
const ROLES: readonly IntentRole[] = ['peer', 'seek', 'offer', 'swap', 'host']
const TEMPLATES: readonly IntentTemplate[] = ['play', 'talk', 'lang', 'event', 'newbie', 'study', 'moved', 'listen']
const WHENS: readonly IntentWhen[] = ['tonight', 'weekend', 'anytime', 'dated']

function oneOf<T extends string>(list: readonly T[], v: unknown, fallback: T): T
function oneOf<T extends string>(list: readonly T[], v: unknown): T | undefined
function oneOf<T extends string>(list: readonly T[], v: unknown, fallback?: T): T | undefined {
  return list.includes(v as T) ? (v as T) : fallback
}

const opt = <T,>(v: T | null | undefined): T | undefined => (v === null ? undefined : v)
/** A text[] column as written by anyone: one odd element must not break the page for everybody who loads that profile. */
const strings = (list: (string | null)[] | null | undefined): string[] => (list ?? []).filter((x): x is string => typeof x === 'string')

/** A user counts as online if seen in the last 5 minutes (the heartbeat runs every 2). */
export const ONLINE_WINDOW_MIN = 5
/** the database keeps prompts small (see profiles_prompts_size) */
const PROMPTS_MAX = 5
const PROMPT_TEXT_MAX = 150
const PROMPT_QUESTION_MAX = 60

export function parsePrompts(raw: unknown): PromptAnswer[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((p) => {
    if (!p || typeof p !== 'object') return []
    const { promptId, text, question } = p as Record<string, unknown>
    if (typeof promptId !== 'string' || typeof text !== 'string' || !text.trim()) return []
    return [typeof question === 'string' && question.trim() ? { promptId, text, question } : { promptId, text }]
  })
}

export function toUser(p: ProfileRow, rooms: string[], present: boolean, now = Date.now()): User {
  const isOnline = present || (!!p.last_seen_at && minutesAgo(p.last_seen_at, now) < ONLINE_WINDOW_MIN)
  return {
    id: p.id,
    name: p.name?.trim() || 'เพื่อนใหม่',
    age: p.birth_year ? bangkokYear(now) - p.birth_year : 0,
    birthYear: opt(p.birth_year),
    color: oneOf(COLORS, p.color, 'peach'),
    face: oneOf(FACES, p.face),
    accessory: oneOf(ACCESSORIES, p.accessory),
    province: p.province || 'กรุงเทพฯ',
    bio: p.bio ?? '',
    tags: strings(p.tags),
    loves: strings(p.loves),
    prompts: parsePrompts(p.prompts),
    chatStyle: strings(p.chat_style),
    online: (p.online ?? []).filter((s): s is OnlineSlot => SLOTS.includes(s as OnlineSlot)),
    rooms,
    languages: p.languages?.length ? p.languages : ['ไทย'],
    // only once the column exists: before that the field stays out (unknown, not "none")
    ...(p.life_stages !== undefined ? { lifeStages: strings(p.life_stages) } : {}),
    isHost: !!p.is_host,
    lastActive: isOnline ? 'ออนไลน์อยู่' : lastActiveLabel(p.last_seen_at, now),
    isOnline,
  }
}

/** A my_blocked_people() row → someone on my blocked list (the same fallbacks as toUser). */
export function toBlockedPerson(r: BlockedPersonRow): BlockedPerson {
  return {
    id: r.user_id,
    name: r.name?.trim() || 'เพื่อนใหม่',
    color: oneOf(COLORS, r.color, 'peach'),
    face: oneOf(FACES, r.face),
    accessory: oneOf(ACCESSORIES, r.accessory),
    ...(r.blocked_at ? { blockedAt: r.blocked_at } : {}),
  }
}

/** User → the profile columns a person may change about themselves. */
export function profilePatch(u: Partial<User>) {
  const patch: Record<string, unknown> = {}
  if (u.name !== undefined) patch.name = u.name.trim().slice(0, 40)
  if (u.color !== undefined) patch.color = u.color
  if (u.face !== undefined) patch.face = u.face
  if (u.accessory !== undefined) patch.accessory = u.accessory
  if (u.province !== undefined) patch.province = u.province
  if (u.bio !== undefined) patch.bio = u.bio
  if (u.birthYear !== undefined) patch.birth_year = u.birthYear
  if (u.tags !== undefined) patch.tags = u.tags
  if (u.loves !== undefined) patch.loves = u.loves
  if (u.prompts !== undefined) {
    patch.prompts = u.prompts.slice(0, PROMPTS_MAX).map(({ promptId, text, question }) => ({
      promptId,
      text: cutText(text, PROMPT_TEXT_MAX),
      ...(question ? { question: cutText(question, PROMPT_QUESTION_MAX) } : {}),
    }))
  }
  if (u.chatStyle !== undefined) patch.chat_style = u.chatStyle
  if (u.online !== undefined) patch.online = u.online
  if (u.languages !== undefined) patch.languages = u.languages
  if (u.lifeStages !== undefined) patch.life_stages = normalizeLifeStages(u.lifeStages)
  return patch
}

export function toRoom(r: RoomRow, stats: { members: number; online: number; hostIds: string[] }): Room {
  return {
    id: r.id,
    name: r.name,
    icon: r.icon || 'Sparkles',
    color: oneOf(COLORS, r.color, 'cream'),
    tagline: r.tagline ?? '',
    vibe: r.vibe ?? '',
    tags: r.tags ?? [],
    memberCount: stats.members,
    onlineCount: stats.online,
    primeTime: r.prime_time ?? '20:00–23:00',
    hostIds: stats.hostIds,
    isLobby: !!r.is_lobby,
  }
}

/** `joinedBy` = everyone else who pressed "ฉันด้วย"; `slots` = spots still open before me. */
export function toIntent(row: IntentRow, joinedBy: string[], now = Date.now()): Intent {
  return {
    id: row.id,
    userId: row.user_id,
    template: oneOf(TEMPLATES, row.template, 'talk'),
    role: oneOf(ROLES, row.role, 'peer'),
    tagId: row.tag_id,
    text: row.body,
    when: oneOf(WHENS, row.when_kind, 'anytime'),
    whenLabel: opt(row.when_label),
    mode: row.mode === 'offline' ? 'offline' : 'online',
    province: opt(row.province),
    slots: row.slots == null ? undefined : Math.max(0, row.slots - joinedBy.length),
    give: opt(row.give),
    want: opt(row.want),
    roomId: opt(row.room_id),
    postedMinutesAgo: minutesAgo(row.created_at, now),
    joinedBy,
  }
}

/** Intent → insert columns (user, status and expiry are added by the caller). */
export function intentColumns(i: Omit<Intent, 'id' | 'userId' | 'postedMinutesAgo' | 'joinedBy'>) {
  return {
    template: i.template,
    role: i.role,
    tag_id: i.tagId,
    body: i.text.trim().slice(0, 200),
    when_kind: i.when,
    when_label: i.whenLabel ?? null,
    mode: i.mode,
    province: i.province ?? null,
    slots: i.slots ?? null,
    give: i.give ?? null,
    want: i.want ?? null,
    room_id: i.roomId ?? null,
  }
}

/**
 * Team-hosted sessions have no host profile: `hostName` carries the label. `others` = who else is
 * going (everyone but me); `goingIds` keeps the ones I can see (a block hides the rest).
 */
export function toSession(row: SessionRow, others: string[], visibleIds: string[], now = Date.now()): Session {
  const start = Date.parse(row.starts_at)
  const duration = row.duration_min ?? 60
  const end = start + duration * 60_000
  const cancelled = !!row.cancelled_at
  return {
    id: row.id,
    roomId: row.room_id,
    title: row.title,
    dayOffset: dayOffset(row.starts_at, now),
    time: hhmm(row.starts_at),
    durationMin: duration,
    going: others.length,
    goingIds: visibleIds,
    hostId: row.host_id ?? '',
    live: !cancelled && now >= start && now < end,
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(end).toISOString(),
    ...(row.host_name ? { hostName: row.host_name } : {}),
    ...(row.description?.trim() ? { description: row.description } : {}),
    ...(cancelled ? { cancelled } : {}),
    ...(row.plan_id != null ? { repeatsWeekly: true, seriesId: `plan-${row.plan_id}` } : {}),
    ...(row.created_by ? { createdBy: row.created_by } : {}),
  }
}

/** An event chat line → a chat message (same shape as room lines, so the room chat parts can show it). */
export function toEventMessage(row: EventMessageRow, now = Date.now()): ChatMessage {
  return { id: row.id, userId: row.user_id, text: row.body, at: messageTime(row.created_at, now) }
}

export function toQuestion(q: QuestionRow, answers: AnswerRow[], sameCount: (a: AnswerRow) => number, mySameBy: string[] = []): DailyQuestion {
  const list: DailyAnswer[] = answers.map((a) => ({ userId: a.user_id, text: a.body, sameCount: sameCount(a) }))
  return { id: q.id, roomId: q.room_id, text: q.body, answers: list, ...(mySameBy.length ? { mySameBy } : {}) }
}

const KINDS: readonly NonNullable<ChatMessage['kind']>[] = ['text', 'system', 'welcome', 'image', 'mochi']

export function toMessage(row: RoomMessageRow | ChatMessageRow, sameBy: string[], now = Date.now()): ChatMessage {
  const kind = oneOf(KINDS, row.kind) ?? (row.user_id ? 'text' : 'system')
  // a photo: its body is the path in the chat-images bucket (the database checks the shape)
  const image = kind === 'image' ? imageFromPath(row.body) : undefined
  return {
    id: row.id,
    userId: row.user_id ?? 'system',
    text: row.body,
    at: messageTime(row.created_at, now),
    kind: kind === 'image' && !image ? 'text' : kind,
    ...(image ? { image } : {}),
    ...(sameBy.length ? { sameBy } : {}),
  }
}

export function toChat(
  chat: ChatRow,
  members: ChatMemberRow[],
  messages: ChatMessage[],
  rows: ChatMessageRow[],
  myId: string,
): LiveChat {
  const other = members.find((m) => m.user_id !== myId)
  const mine = members.find((m) => m.user_id === myId)
  const readAt = mine?.last_read_at ? Date.parse(mine.last_read_at) : 0
  // their lines, plus "picked up" on a moshi I rang (a system line, but news to me), plus Mochi's lines
  const pickedUp = chat.status === 'active' && chat.requested_by === myId
  const unread = rows.filter(
    (r) => Date.parse(r.created_at) > readAt && (r.user_id ? r.user_id !== myId : r.kind === 'mochi' || (pickedUp && r.kind === 'system')),
  ).length
  return {
    id: chat.id,
    withUserId: other?.user_id ?? '',
    messages,
    icebreaker: opt(chat.icebreaker),
    unread,
    status: chat.status === 'active' || chat.status === 'ended' ? chat.status : 'pending',
    ...(chat.closed_at ? { closedAt: chat.closed_at } : {}),
    requestedBy: chat.requested_by,
    consent: { me: !!mine?.consent_media, them: !!other?.consent_media },
    ...(chat.kind === 'intro' ? { kind: 'intro' as const } : {}),
    ...(chat.pair_question ? { pairQuestion: chat.pair_question } : {}),
  }
}

/** An intro request as I see it. Waiting past its time reads 'expired' (the server marks it within the hour). */
export function toIntro(r: IntroRequestRow, myId: string, now = Date.now()): IntroRequest {
  const outgoing = r.from_user === myId
  const expired = r.status === 'expired' || (r.status !== 'accepted' && Date.parse(r.expires_at) <= now)
  return {
    id: r.id,
    fromUserId: r.from_user,
    toUserId: r.to_user,
    direction: outgoing ? 'outgoing' : 'incoming',
    withUserId: outgoing ? r.to_user : r.from_user,
    status: r.status === 'accepted' ? 'accepted' : expired ? 'expired' : 'pending',
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    ...(r.chat_id ? { chatId: r.chat_id } : {}),
  }
}

export function toPairAnswer(r: PairAnswerRow): PairAnswer {
  return { chatId: r.chat_id, userId: r.user_id, questionId: r.question_id, text: r.body, at: r.created_at }
}

const PROVIDERS: readonly WatchProvider[] = ['youtube', 'vimeo', 'file']
const num = (v: number | string | null | undefined): number | undefined => {
  const n = typeof v === 'string' ? Number.parseFloat(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined
}
const ms = (iso: string | null | undefined): number | undefined => {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isNaN(t) ? undefined : t
}

/** A room's clip (null when nothing is on, or it's from a provider this app doesn't know). */
export function toRoomWatch(r: RoomWatchRow): RoomWatch | null {
  const provider = oneOf(PROVIDERS, r.provider)
  if (!provider || !r.ref) return null
  const duration = num(r.duration_s)
  return {
    roomId: r.room_id,
    provider,
    ref: r.ref,
    ...(r.title?.trim() ? { title: r.title } : {}),
    ...(duration ? { durationS: duration } : {}),
    isLive: !!r.is_live,
    playing: !!r.playing,
    positionS: Math.max(0, num(r.position_s) ?? 0),
    positionAt: ms(r.position_at) ?? Date.now(),
    rate: num(r.rate) ?? 1,
    ...(r.started_by ? { startedBy: r.started_by } : {}),
    ...(ms(r.started_at) ? { startedAt: ms(r.started_at) } : {}),
    anyoneCanControl: !!r.anyone_can_control,
    ...(r.updated_by ? { updatedBy: r.updated_by } : {}),
    ...(ms(r.updated_at) ? { updatedAt: ms(r.updated_at) } : {}),
    version: num(r.version) ?? 0,
  }
}

/** A wave_card_preview() row → the teaser (the same fallbacks as toUser). */
export function toComparePreview(userId: string, r: { name: string | null; color: string | null; face: string | null; accessory: string | null }): ComparePreview {
  return {
    userId,
    name: r.name?.trim() || 'เพื่อนใหม่',
    color: oneOf(COLORS, r.color, 'peach'),
    ...(oneOf(FACES, r.face) ? { face: oneOf(FACES, r.face) } : {}),
    ...(oneOf(ACCESSORIES, r.accessory) ? { accessory: oneOf(ACCESSORIES, r.accessory) } : {}),
  }
}
