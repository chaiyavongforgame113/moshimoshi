import type {
  AnswerRow,
  AnswerSameRow,
  ChatMemberRow,
  ChatSameRow,
  ChatMessageRow,
  ChatRow,
  EventMessageRow,
  IntentJoinRow,
  IntentRow,
  IntroRequestRow,
  MessageSameRow,
  PairAnswerRow,
  ProfileRow,
  PromptSameRow,
  QuestionRow,
  RoomMemberRow,
  RoomMessageRow,
  RoomRow,
  RoomWatchRow,
  RsvpRow,
  SessionRow,
  WaveAnswerRow,
} from './rows'

/** The client's copy of the server rows it cares about, keyed for quick updates. */
export interface Cache {
  me: string
  rooms: RoomRow[]
  /** key `${room}|${user}` */
  members: Map<string, RoomMemberRow>
  profiles: Map<string, ProfileRow>
  intents: Map<string, IntentRow>
  /** intent → user ids */
  joins: Map<string, Set<string>>
  sessions: Map<string, SessionRow>
  /** session → user ids */
  rsvps: Map<string, Set<string>>
  /** newest question per room */
  questions: Map<string, QuestionRow>
  /** key `${question}|${user}` */
  answers: Map<string, AnswerRow>
  /** key `${question}|${answerUser}` → user ids */
  answerSames: Map<string, Set<string>>
  /** loaded rooms only: room → message id → row */
  roomMsgs: Map<string, Map<string, RoomMessageRow>>
  msgRoom: Map<string, string>
  roomSames: Map<string, Set<string>>
  chats: Map<string, ChatRow>
  chatMembers: Map<string, ChatMemberRow[]>
  chatMsgs: Map<string, Map<string, ChatMessageRow>>
  msgChat: Map<string, string>
  chatSames: Map<string, Set<string>>
  /** chat reaction id → `${message}|${user}` (realtime deletes carry the id alone) */
  chatSameIds: Map<string, string>
  /** "เหมือนกัน!" on profile stories that I gave or got, key `${profile}|${prompt}|${user}` */
  promptSames: Map<string, PromptSameRow>
  /** event chats being watched: session → message id → row */
  eventMsgs: Map<string, Map<string, EventMessageRow>>
  msgEvent: Map<string, string>
  /** "จูนคลื่น" picks: user → question → 0 / 1 */
  wave: Map<string, Map<string, number>>
  /** "ให้โมชิแนะนำให้" requests I asked for or that are about me (as RLS shows them) */
  intros: Map<string, IntroRequestRow>
  /** question pair answers I can see: chat → answer id → row */
  pairAnswers: Map<string, Map<string, PairAnswerRow>>
  /** answer id → chat (realtime deletes carry the id alone) */
  pairChat: Map<string, string>
  /** rooms' clips (rooms with nothing on may be missing or have ref null) */
  roomWatch: Map<string, RoomWatchRow>
  /** people I blocked (blocks rows) */
  blocked: Set<string>
  /** ids whose profile the server won't show us (a block either way): their lines stay hidden */
  hidden: Set<string>
}

export function createCache(me: string): Cache {
  return {
    me,
    rooms: [],
    members: new Map(),
    profiles: new Map(),
    intents: new Map(),
    joins: new Map(),
    sessions: new Map(),
    rsvps: new Map(),
    questions: new Map(),
    answers: new Map(),
    answerSames: new Map(),
    roomMsgs: new Map(),
    msgRoom: new Map(),
    roomSames: new Map(),
    chats: new Map(),
    chatMembers: new Map(),
    chatMsgs: new Map(),
    msgChat: new Map(),
    chatSames: new Map(),
    chatSameIds: new Map(),
    promptSames: new Map(),
    eventMsgs: new Map(),
    msgEvent: new Map(),
    wave: new Map(),
    intros: new Map(),
    pairAnswers: new Map(),
    pairChat: new Map(),
    roomWatch: new Map(),
    blocked: new Set(),
    hidden: new Set(),
  }
}

export const pairKey = (a: string, b: string) => `${a}|${b}`

export function toggleIn(map: Map<string, Set<string>>, key: string, user: string, on: boolean) {
  let set = map.get(key)
  if (on) {
    if (!set) map.set(key, (set = new Set()))
    set.add(user)
  } else if (set) {
    set.delete(user)
    if (!set.size) map.delete(key)
  }
}

export const others = (set: Set<string> | undefined, me: string) => (set ? [...set].filter((u) => u !== me) : [])

// ---------------------------------------------------------------- row helpers

export function putMember(c: Cache, row: RoomMemberRow, on: boolean) {
  const key = pairKey(row.room_id, row.user_id)
  if (on) c.members.set(key, { ...c.members.get(key), ...row })
  else c.members.delete(key)
}

export function putRoomMessage(c: Cache, row: RoomMessageRow) {
  const room = c.roomMsgs.get(row.room_id)
  if (!room) return false // history for this room isn't loaded: nothing to keep in sync
  room.set(row.id, row)
  c.msgRoom.set(row.id, row.room_id)
  return true
}

export function dropRoomMessage(c: Cache, id: string): string | undefined {
  const roomId = c.msgRoom.get(id)
  if (roomId) c.roomMsgs.get(roomId)?.delete(id)
  c.msgRoom.delete(id)
  c.roomSames.delete(id)
  return roomId
}

export function putChatMessage(c: Cache, row: ChatMessageRow) {
  let msgs = c.chatMsgs.get(row.chat_id)
  if (!msgs) c.chatMsgs.set(row.chat_id, (msgs = new Map()))
  msgs.set(row.id, row)
  c.msgChat.set(row.id, row.chat_id)
}

export function dropChatMessage(c: Cache, id: string): string | undefined {
  const chatId = c.msgChat.get(id)
  if (chatId) c.chatMsgs.get(chatId)?.delete(id)
  c.msgChat.delete(id)
  c.chatSames.delete(id)
  return chatId
}

export function putChatMember(c: Cache, row: ChatMemberRow, on: boolean) {
  const list = (c.chatMembers.get(row.chat_id) ?? []).filter((m) => m.user_id !== row.user_id)
  const prev = c.chatMembers.get(row.chat_id)?.find((m) => m.user_id === row.user_id)
  if (on) list.push({ ...prev, ...row })
  c.chatMembers.set(row.chat_id, list)
}

export function dropChat(c: Cache, id: string) {
  c.chats.delete(id)
  c.chatMembers.delete(id)
  c.chatMsgs.get(id)?.forEach((_, mid) => {
    c.msgChat.delete(mid)
    c.chatSames.delete(mid)
  })
  c.chatMsgs.delete(id)
}

/** Keeps a line only for an event chat that's being watched (its history loaded). */
export function putEventMessage(c: Cache, row: EventMessageRow): boolean {
  const msgs = c.eventMsgs.get(row.session_id)
  if (!msgs) return false
  msgs.set(row.id, row)
  c.msgEvent.set(row.id, row.session_id)
  return true
}

export function dropEventMessage(c: Cache, id: string): string | undefined {
  const sessionId = c.msgEvent.get(id)
  if (sessionId) c.eventMsgs.get(sessionId)?.delete(id)
  c.msgEvent.delete(id)
  return sessionId
}

export function putWave(c: Cache, row: WaveAnswerRow, on: boolean) {
  let picks = c.wave.get(row.user_id)
  if (on && (row.choice === 0 || row.choice === 1)) {
    if (!picks) c.wave.set(row.user_id, (picks = new Map()))
    picks.set(row.question_id, row.choice)
  } else if (picks) {
    picks.delete(row.question_id)
    if (!picks.size) c.wave.delete(row.user_id)
  }
}

/** An intro request in or out (a realtime delete carries the id alone). */
export function putIntro(c: Cache, row: IntroRequestRow, on: boolean) {
  if (on) c.intros.set(row.id, { ...c.intros.get(row.id), ...row })
  else c.intros.delete(row.id)
}

export function putPairAnswer(c: Cache, row: PairAnswerRow) {
  let list = c.pairAnswers.get(row.chat_id)
  if (!list) c.pairAnswers.set(row.chat_id, (list = new Map()))
  list.set(row.id, row)
  c.pairChat.set(row.id, row.chat_id)
}

export function dropPairAnswer(c: Cache, id: string): string | undefined {
  const chatId = c.pairChat.get(id)
  if (chatId) c.pairAnswers.get(chatId)?.delete(id)
  c.pairChat.delete(id)
  return chatId
}

/**
 * A room's clip as the server sent it. Changes can arrive out of order (an RPC's answer and its
 * realtime echo): an older version than the one held is ignored. Returns true if it was taken.
 */
export function putRoomWatch(c: Cache, row: RoomWatchRow): boolean {
  const held = c.roomWatch.get(row.room_id)
  if (held && (held.version ?? 0) > (row.version ?? 0)) return false
  c.roomWatch.set(row.room_id, { ...held, ...row })
  return true
}

export function putJoin(c: Cache, row: IntentJoinRow, on: boolean) {
  toggleIn(c.joins, row.intent_id, row.user_id, on)
}

export function putRsvp(c: Cache, row: RsvpRow, on: boolean) {
  toggleIn(c.rsvps, row.session_id, row.user_id, on)
}

export function putAnswerSame(c: Cache, row: AnswerSameRow, on: boolean) {
  toggleIn(c.answerSames, pairKey(row.question_id, row.answer_user_id), row.user_id, on)
}

export function putMessageSame(map: Map<string, Set<string>>, row: MessageSameRow, on: boolean) {
  toggleIn(map, row.message_id, row.user_id, on)
}

/** The message + reactor a chat reaction is about; a realtime delete brings only its id. */
export function chatSameKey(c: Cache, row: ChatSameRow): MessageSameRow | undefined {
  if (row.message_id) return { message_id: row.message_id, user_id: row.user_id }
  const key = row.id ? c.chatSameIds.get(row.id) : undefined
  if (!key) return undefined
  const [message_id, user_id] = key.split('|')
  return { message_id, user_id }
}

export function putChatSame(c: Cache, row: ChatSameRow, on: boolean) {
  const key = chatSameKey(c, row)
  if (!key) return
  putMessageSame(c.chatSames, key, on)
  if (!row.id) return
  if (on) c.chatSameIds.set(row.id, `${key.message_id}|${key.user_id}`)
  else c.chatSameIds.delete(row.id)
}

/**
 * A story reaction in or out. A realtime delete carries only the row id, so it is looked up.
 * Returns the full row it touched (undefined: nothing we know about).
 */
export function putPromptSame(c: Cache, row: PromptSameRow, on: boolean): PromptSameRow | undefined {
  const full = row.profile_id ? row : [...c.promptSames.values()].find((r) => r.id && r.id === row.id)
  if (!full) return undefined
  const key = `${full.profile_id}|${full.prompt_key}|${full.user_id}`
  if (on) c.promptSames.set(key, { ...c.promptSames.get(key), ...full })
  else c.promptSames.delete(key)
  return full
}

export function isActiveIntent(row: IntentRow, now = Date.now()) {
  return (row.status ?? 'active') === 'active' && (!row.expires_at || Date.parse(row.expires_at) > now)
}

/** Newest question per room from a newest-first list. */
export function latestPerRoom(rows: QuestionRow[]): Map<string, QuestionRow> {
  const out = new Map<string, QuestionRow>()
  for (const q of rows) if (!out.has(q.room_id)) out.set(q.room_id, q)
  return out
}

export function sortByTime<T extends { created_at: string }>(rows: Iterable<T>): T[] {
  return [...rows].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
}
