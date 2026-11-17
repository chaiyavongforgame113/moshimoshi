import { useCatalog, type CatalogData } from '@/data/catalog'
import { BLANK_ME, useMoshi, type MoshiPolicy, type MoshiState } from '@/lib/store'
import type { ChatMessage, PairAnswer, Room, RoomWatch, WaveAnswers, WaveChoice } from '@/lib/types'
import { isTmp, pendingConsent, pendingPair, pendingWave, resolveId, unblocking, unsending } from './bus'
import { features } from './features'
import { isActiveIntent, others, pairKey, sortByTime, type Cache } from './cache'
import {
  ONLINE_WINDOW_MIN,
  toChat,
  toEventMessage,
  toIntent,
  toIntro,
  toMessage,
  toPairAnswer,
  toQuestion,
  toRoom,
  toRoomWatch,
  toSession,
  toUser,
  type LiveChat,
} from './map'
import { isSample, isServerId, SAMPLE_INTENTS, SAMPLE_PEOPLE } from './sample'
import { minutesAgo } from './time'

// Cache → stores. "Others" data goes to useCatalog; my own slices go to
// useMoshi. Each function returns a patch so a full refresh lands in one set.

type CatPatch = Partial<CatalogData>
type MinePatch = Partial<MoshiState>

const POLICIES: readonly MoshiPolicy[] = ['everyone', 'rooms', 'chatted']

export function isOnline(c: Cache, id: string, now = Date.now()) {
  const seen = c.profiles.get(id)?.last_seen_at
  return !!seen && minutesAgo(seen, now) < ONLINE_WINDOW_MIN
}

/** Other people, minus anyone in a block relation with me (their profile is hidden from us). */
const visible = (c: Cache, ids: string[]) => ids.filter((u) => !c.hidden.has(u))

function roomsByUser(c: Cache) {
  const out = new Map<string, string[]>()
  c.members.forEach((m) => {
    const list = out.get(m.user_id)
    if (list) list.push(m.room_id)
    else out.set(m.user_id, [m.room_id])
  })
  return out
}

export function mePatch(c: Cache, initial: boolean): MinePatch {
  const s = useMoshi.getState()
  // after the first load my rooms are owned by the store (optimistic joins/leaves)
  const rooms = initial ? (roomsByUser(c).get(c.me) ?? []) : s.me.rooms
  const p = c.profiles.get(c.me)
  if (!p) return { me: { ...BLANK_ME, id: c.me, rooms }, onboarded: false }
  const policy = POLICIES.find((x) => x === p.moshi_policy) ?? 'everyone'
  return { me: toUser(p, rooms, true), onboarded: !!p.onboarded, moshiPolicy: policy }
}

export function peoplePatch(c: Cache): CatPatch {
  const now = Date.now()
  const byUser = roomsByUser(c)
  const partners = new Set<string>()
  c.chatMembers.forEach((list) => list.forEach((m) => m.user_id !== c.me && partners.add(m.user_id)))
  const people = [...c.profiles.values()]
    // same rule as the route guard: finished onboarding, or passed its 20+ step and skipped the rest
    .filter((p) => p.id !== c.me && (p.onboarded || p.birth_year != null || partners.has(p.id)))
    .map((p) => toUser(p, byUser.get(p.id) ?? [], false, now))
    .sort((a, b) => Number(b.isOnline) - Number(a.isOnline))
  return { people: SAMPLE_PEOPLE.length ? [...people, ...SAMPLE_PEOPLE] : people }
}

export function roomsPatch(c: Cache): CatPatch {
  const now = Date.now()
  const mine = new Set(useMoshi.getState().me.rooms)
  const byRoom = new Map<string, { members: number; online: number; hostIds: string[] }>()
  c.rooms.forEach((r) => byRoom.set(r.id, { members: 0, online: 0, hostIds: [] }))
  c.members.forEach((m) => {
    const st = byRoom.get(m.room_id)
    if (!st) return
    if (m.role === 'host') st.hostIds.push(m.user_id)
    if (m.user_id === c.me) return // counted from the store below
    st.members++
    if (isOnline(c, m.user_id, now)) st.online++
  })
  const rooms: Room[] = []
  const roomStats: CatalogData['roomStats'] = {}
  c.rooms.forEach((r) => {
    const st = byRoom.get(r.id)!
    const me = mine.has(r.id) ? 1 : 0
    const stats = { members: st.members + me, online: st.online + me, hostIds: st.hostIds }
    rooms.push(toRoom(r, stats))
    roomStats[r.id] = { members: stats.members, online: stats.online }
  })
  return { rooms, roomStats }
}

export function intentsPatch(c: Cache): CatPatch {
  const now = Date.now()
  const list = [...c.intents.values()]
    .filter((i) => i.user_id !== c.me && !c.hidden.has(i.user_id) && isActiveIntent(i, now))
    .map((i) => toIntent(i, visible(c, others(c.joins.get(i.id), c.me)), now))
  return { intents: SAMPLE_INTENTS.length ? [...list, ...SAMPLE_INTENTS] : list }
}

export function myIntentsPatch(c: Cache): MinePatch {
  const now = Date.now()
  const pending = useMoshi.getState().myIntents.filter((i) => isTmp(i.id))
  const mine = [...c.intents.values()]
    .filter((i) => i.user_id === c.me && isActiveIntent(i, now))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .map((i) => toIntent(i, visible(c, others(c.joins.get(i.id), c.me)), now))
  return { myIntents: [...pending, ...mine] }
}

export function myJoinsPatch(c: Cache): MinePatch {
  const local = useMoshi.getState().joinedIntentIds.filter((id) => !isServerId(id))
  const server = [...c.joins.entries()].filter(([, users]) => users.has(c.me)).map(([id]) => id)
  return { joinedIntentIds: [...local, ...server] }
}

/** Every session we hold (finished and cancelled ones too: useSessions() narrows it to upcoming and live). */
export function sessionsPatch(c: Cache): CatPatch {
  const now = Date.now()
  const sessions = [...c.sessions.values()]
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
    .map((s) => {
      const going = others(c.rsvps.get(s.id), c.me)
      return toSession(s, going, visible(c, going), now)
    })
  return { sessions }
}

/** Server history for the event chats being watched; also drops my local copies the server now holds. */
export function eventMessagesPatch(c: Cache, sessionIds: Iterable<string>): { cat: CatPatch; mine: MinePatch } {
  const now = Date.now()
  const history = { ...useCatalog.getState().eventMessages }
  const local = { ...useMoshi.getState().eventMessages }
  let localChanged = false
  for (const id of sessionIds) {
    const held = c.eventMsgs.get(id)
    if (!held) continue
    history[id] = sortByTime(held.values())
      .filter((r) => !c.hidden.has(r.user_id))
      .map((r) => toEventMessage(r, now))
    const mine = local[id]
    if (mine?.some((m) => held.has(m.id))) {
      local[id] = mine.filter((m) => !held.has(m.id))
      localChanged = true
    }
  }
  return { cat: { eventMessages: history }, mine: localChanged ? { eventMessages: local } : {} }
}

const asChoice = (v: number): WaveChoice | undefined => (v === 0 || v === 1 ? v : undefined)

/** Other people's "จูนคลื่น" picks (not anyone in a block relation with me). */
export function wavePatch(c: Cache): CatPatch {
  const waveAnswers: Record<string, WaveAnswers> = {}
  c.wave.forEach((picks, userId) => {
    if (userId === c.me || c.hidden.has(userId)) return
    const out: WaveAnswers = {}
    picks.forEach((v, q) => {
      const choice = asChoice(v)
      if (choice !== undefined) out[q] = choice
    })
    waveAnswers[userId] = out
  })
  return { waveAnswers }
}

/**
 * My picks. Without wave_answers: this device's, as they are. With it: the server's, plus a pick
 * still on its way, plus picks the server has never seen (made before wave_answers existed; sync
 * uploads those). A pick the server already has wins over an old copy on this device. Picks this
 * device kept for another account are dropped.
 */
export function myWavePatch(c: Cache): MinePatch {
  const s = useMoshi.getState()
  const local = !s.waveOwner || s.waveOwner === c.me ? s.wave : {}
  if (!features.waveQuiz) return { wave: local, waveOwner: c.me }
  const wave: WaveAnswers = {}
  c.wave.get(c.me)?.forEach((v, q) => {
    const choice = asChoice(v)
    if (choice !== undefined) wave[q] = choice
  })
  for (const [q, choice] of Object.entries(local)) {
    if (pendingWave.has(q) || !(q in wave)) wave[q] = choice
  }
  return { wave, waveOwner: c.me }
}

export function featuresPatch(): CatPatch {
  return {
    features: {
      events: features.events,
      waveQuiz: features.waveQuiz,
      lifeStages: features.lifeStages,
      intros: features.intros,
      watch: features.watch,
      waveCard: features.waveCard,
    },
  }
}

/** "ให้โมชิแนะนำให้": mine and the ones about me, newest first (nobody in a block relation with me). Sample people's stay local. */
export function introsPatch(c: Cache): MinePatch {
  const now = Date.now()
  const local = useMoshi.getState().intros.filter((i) => !isServerId(i.id))
  const list = [...c.intros.values()]
    .filter((r) => !c.hidden.has(r.from_user === c.me ? r.to_user : r.from_user))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .map((r) => toIntro(r, c.me, now))
  return { intros: [...local, ...list] }
}

/** Question pair answers per chat (mine; theirs once both answered), plus my answer still on its way. */
export function pairAnswersPatch(c: Cache): MinePatch {
  const out: Record<string, PairAnswer[]> = {}
  // sample chats keep theirs
  for (const [chatId, list] of Object.entries(useMoshi.getState().pairAnswers)) if (!isServerId(chatId)) out[chatId] = list
  c.pairAnswers.forEach((rows, chatId) => {
    out[chatId] = sortByTime(rows.values()).map(toPairAnswer)
  })
  pendingPair.forEach((p, chatId) => {
    const list = out[chatId] ?? []
    if (list.some((a) => a.userId === c.me && a.questionId === p.questionId)) return
    out[chatId] = [...list, { chatId, userId: c.me, questionId: p.questionId, text: p.text, at: p.at }]
  })
  return { pairAnswers: out }
}

/** Rooms' clips that are on, and which rooms a host opened up ("ให้ทุกคนคุมได้"). */
export function roomWatchPatch(c: Cache): CatPatch {
  const roomWatch: Record<string, RoomWatch> = {}
  const roomWatchOpen: Record<string, boolean> = {}
  c.roomWatch.forEach((row, roomId) => {
    const w = toRoomWatch(row)
    if (w) roomWatch[roomId] = w
    if (row.anyone_can_control) roomWatchOpen[roomId] = true
  })
  return { roomWatch, roomWatchOpen }
}

export function myGoingPatch(c: Cache): MinePatch {
  const local = useMoshi.getState().going.filter((id) => !isServerId(id))
  const server = [...c.rsvps.entries()].filter(([, users]) => users.has(c.me)).map(([id]) => id)
  return { going: [...local, ...server] }
}

export function questionsPatch(c: Cache): CatPatch {
  const answers = [...c.answers.values()]
  const questions = [...c.questions.values()].map((q) =>
    toQuestion(
      q,
      answers.filter((a) => a.question_id === q.id && a.user_id !== c.me && !c.hidden.has(a.user_id)),
      (a) => visible(c, others(c.answerSames.get(pairKey(q.id, a.user_id)), c.me)).length,
      // who said "เหมือนกัน!" to my own answer
      visible(c, others(c.answerSames.get(pairKey(q.id, c.me)), c.me)),
    ),
  )
  return { questions }
}

export function myAnswersPatch(c: Cache): MinePatch {
  const current = useMoshi.getState().answers
  const out: Record<string, string> = {}
  Object.entries(current).forEach(([qid, text]) => {
    if (!isServerId(qid)) out[qid] = text
  })
  c.answers.forEach((a) => {
    if (a.user_id === c.me) out[a.question_id] = a.body
  })
  return { answers: out }
}

const isServerSame = (id: string) => {
  // prompt:<profile>:<key>: on the server once prompt_sames exists
  if (id.startsWith('prompt:')) return features.promptSames && isServerId(id.split(':')[1])
  const parts = id.split(':')
  return parts.length === 2 ? isServerId(parts[0]) && isServerId(parts[1]) : isServerId(id)
}

export function mySamesPatch(c: Cache): MinePatch {
  const local = useMoshi.getState().sames.filter((id) => !isServerSame(id))
  const server: string[] = []
  c.roomSames.forEach((users, id) => users.has(c.me) && server.push(id))
  c.chatSames.forEach((users, id) => users.has(c.me) && server.push(id))
  c.answerSames.forEach((users, key) => {
    if (!users.has(c.me)) return
    const [q, u] = key.split('|')
    server.push(`${q}:${u}`)
  })
  c.promptSames.forEach((r) => r.user_id === c.me && server.push(`prompt:${r.profile_id}:${r.prompt_key}`))
  return { sames: [...local, ...server] }
}

/** Who said "เหมือนกัน!" to each of my stories (prompt key → user ids). */
export function storySamesPatch(c: Cache): CatPatch {
  // no prototype: a key someone else wrote (e.g. "constructor") must not hit Object's members
  const storySames: Record<string, string[]> = Object.create(null)
  c.promptSames.forEach((r) => {
    if (r.profile_id !== c.me || c.hidden.has(r.user_id)) return
    ;(storySames[r.prompt_key] ??= []).push(r.user_id)
  })
  return { storySames }
}

/** Server history for loaded rooms; also drops local copies the server now holds. */
export function roomMessagesPatch(c: Cache, roomIds: Iterable<string>): { cat: CatPatch; mine: MinePatch } {
  const now = Date.now()
  const history = { ...useCatalog.getState().roomMessages }
  const local = { ...useMoshi.getState().roomMessages }
  let localChanged = false
  for (const roomId of roomIds) {
    const rows = sortByTime(c.roomMsgs.get(roomId)?.values() ?? []).filter((r) => !r.user_id || !c.hidden.has(r.user_id))
    history[roomId] = rows.map((r) => toMessage(r, visible(c, others(c.roomSames.get(r.id), c.me)), now))
    const mine = local[roomId]
    if (mine?.some((m) => c.roomMsgs.get(roomId)?.has(m.id))) {
      local[roomId] = mine.filter((m) => !c.roomMsgs.get(roomId)?.has(m.id))
      localChanged = true
    }
  }
  return { cat: { roomMessages: history }, mine: localChanged ? { roomMessages: local } : {} }
}

export function chatsPatch(c: Cache): MinePatch {
  const now = Date.now()
  const s = useMoshi.getState()
  const prevById = new Map(s.chats.map((ch) => [ch.id, ch]))
  const lastAt = new Map<string, number>()
  const live: LiveChat[] = []
  c.chats.forEach((row) => {
    // a message I'm taking back stays out while the delete is on its way
    const rows = sortByTime(c.chatMsgs.get(row.id)?.values() ?? []).filter((r) => !unsending.has(r.id))
    const prev = prevById.get(row.id)?.messages ?? []
    // my messages keep the temporary id they were sent under (React keys, an open photo)
    const localIds = new Map<string, string>()
    prev.forEach((m) => m.localId && !isTmp(m.id) && localIds.set(m.id, m.localId))
    const shown = new Set(prev.map((m) => m.id))
    // my messages still on their way stay at the bottom. One whose line from me shows up from the
    // server (new here, among the last few) hands it its temporary id: the realtime echo can beat
    // the write's answer, and an opener sent through the rpc never learns its id at all
    const recent = rows.slice(-10)
    const pending: ChatMessage[] = []
    for (const m of prev) {
      if (!isTmp(m.id)) continue
      const landed = recent.find((r) => r.user_id === c.me && r.body === m.text && !shown.has(r.id) && !localIds.has(r.id))
      if (landed) localIds.set(landed.id, m.localId ?? m.id)
      else pending.push(m)
    }
    const msgs = rows.map((r) => {
      const msg = toMessage(r, others(c.chatSames.get(r.id), c.me), now)
      const localId = localIds.get(r.id)
      return localId ? { ...msg, localId } : msg
    })
    const chat = toChat(row, c.chatMembers.get(row.id) ?? [], [...msgs, ...pending], rows, c.me)
    // my photo switch, while its write is out
    const tap = pendingConsent.get(row.id)
    live.push(tap ? { ...chat, consent: { me: tap.on, them: chat.consent?.them ?? false } } : chat)
    lastAt.set(row.id, Date.parse(rows.at(-1)?.created_at ?? row.created_at))
  })
  live.sort((a, b) => (lastAt.get(b.id) ?? 0) - (lastAt.get(a.id) ?? 0))
  const visible = live.filter((ch) => !c.hidden.has(ch.withUserId))
  const real = new Set(live.map((ch) => ch.id))
  // sample chats stay local; a moshi still ringing through the rpc keeps its temporary chat
  const keep = s.chats.filter((ch) => isSample(ch.withUserId) || (isTmp(ch.id) && !real.has(resolveId(ch.id))))
  const sent = [...keep, ...live].filter((ch) => ch.requestedBy === c.me).map((ch) => ch.withUserId)
  return {
    chats: [...keep, ...visible],
    sentMoshi: [...new Set([...s.sentMoshi.filter((id) => isSample(id)), ...sent])],
  }
}

export function apply(cat: CatPatch, mine: MinePatch) {
  if (Object.keys(cat).length) useCatalog.getState().set(cat)
  if (Object.keys(mine).length) useMoshi.setState(mine)
}

/** Everything at once (first load, refresh after reconnect). */
export function publishAll(c: Cache) {
  // me first: room counts read my rooms from the store. Blocks still on their way stay in; someone
  // I'm unblocking stays out (this load may have read the list before the delete went through)
  const blocked = [...new Set([...useMoshi.getState().blocked, ...c.blocked])].filter((id) => !unblocking.has(id))
  useMoshi.setState({ ...mePatch(c, true), blocked })
  const rooms = roomMessagesPatch(c, c.roomMsgs.keys())
  const events = eventMessagesPatch(c, c.eventMsgs.keys())
  apply(
    {
      ...peoplePatch(c),
      ...roomsPatch(c),
      ...intentsPatch(c),
      ...sessionsPatch(c),
      ...questionsPatch(c),
      ...storySamesPatch(c),
      ...rooms.cat,
      ...events.cat,
      ...wavePatch(c),
      ...roomWatchPatch(c),
      ...featuresPatch(),
      ready: true,
      error: null,
    },
    {
      ...events.mine,
      ...myWavePatch(c),
      ...introsPatch(c),
      ...pairAnswersPatch(c),
      ...myIntentsPatch(c),
      ...myJoinsPatch(c),
      ...myGoingPatch(c),
      ...myAnswersPatch(c),
      ...mySamesPatch(c),
      ...chatsPatch(c),
      ...rooms.mine,
    },
  )
}
