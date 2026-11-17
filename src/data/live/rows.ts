// Row shapes of the public schema as this client reads them. They mirror the
// database contract; '@/lib/database.types' is the generated source of truth
// for the typed client, these stay narrow so mapping code reads cleanly.
import type { ChatStatus } from '@/lib/types'

export type { ChatStatus }
export type MoshiPolicy = 'everyone' | 'rooms' | 'chatted'

export interface ProfileRow {
  id: string
  name: string
  color: string | null
  face: string | null
  accessory: string | null
  province: string | null
  bio: string | null
  birth_year: number | null
  tags: string[] | null
  loves: string[] | null
  prompts: unknown
  chat_style: string[] | null
  online: string[] | null
  languages: string[] | null
  /** 20261117000001_lifestage_intro_watch.sql (absent before it runs) */
  life_stages?: string[] | null
  is_host: boolean | null
  onboarded: boolean | null
  moshi_policy: string | null
  last_seen_at: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface RoomRow {
  id: string
  name: string
  icon: string | null
  color: string | null
  tagline: string | null
  vibe: string | null
  tags: string[] | null
  prime_time: string | null
  is_lobby: boolean | null
  sort: number | null
}

export interface RoomMemberRow {
  room_id: string
  user_id: string
  role: string | null
  joined_at?: string | null
}

export interface RoomMessageRow {
  id: string
  room_id: string
  user_id: string | null
  body: string
  kind: string | null
  created_at: string
}

export interface MessageSameRow {
  message_id: string
  user_id: string
}

/** "เหมือนกัน!" on a 1:1 message. Realtime deletes carry the id alone. */
export interface ChatSameRow extends MessageSameRow {
  id?: string
}

/** "เหมือนกัน!" on a story in a profile. Realtime deletes carry the id alone. */
export interface PromptSameRow {
  id?: string
  profile_id: string
  prompt_key: string
  user_id: string
}

export interface SessionRow {
  id: string
  room_id: string
  title: string
  starts_at: string
  duration_min: number | null
  host_id: string | null
  host_name: string | null
  /** the columns below come with 20261114000001_room_events.sql (absent before it runs) */
  description?: string | null
  cancelled_at?: string | null
  created_by?: string | null
  /** the weekly plan row that made it (null: a one-off, or the weekly repeat was stopped) */
  plan_id?: number | null
}

/** A line in an event's chat (20261114000001_room_events.sql). Realtime deletes carry the id alone. */
export interface EventMessageRow {
  id: string
  session_id: string
  user_id: string
  body: string
  created_at: string
}

/** A "จูนคลื่น" pick (20261114000002_wave_quiz.sql). */
export interface WaveAnswerRow {
  user_id: string
  question_id: string
  choice: number
  answered_at?: string | null
}

export interface RsvpRow {
  session_id: string
  user_id: string
}

export interface QuestionRow {
  id: string
  room_id: string
  body: string
  day: string
}

export interface AnswerRow {
  question_id: string
  user_id: string
  body: string
  created_at?: string | null
}

export interface AnswerSameRow {
  question_id: string
  answer_user_id: string
  user_id: string
}

export interface IntentRow {
  id: string
  user_id: string
  template: string
  role: string
  tag_id: string
  body: string
  when_kind: string
  when_label: string | null
  mode: string
  province: string | null
  slots: number | null
  give: string | null
  want: string | null
  room_id: string | null
  status: string | null
  expires_at: string | null
  created_at: string
}

export interface IntentJoinRow {
  intent_id: string
  user_id: string
}

export interface ChatRow {
  id: string
  requested_by: string
  status: string
  icebreaker: string | null
  created_at: string
  /** 'hello' | 'intro' (20261117000001_lifestage_intro_watch.sql; absent before it runs) */
  kind?: string | null
  /** intro chats: the question pair's question id */
  pair_question?: string | null
}

/**
 * "ให้โมชิแนะนำให้" (20261117000001_lifestage_intro_watch.sql). RLS shows me the ones I asked for
 * and the ones about me I haven't set aside. Realtime deletes carry the id alone.
 */
export interface IntroRequestRow {
  id: string
  from_user: string
  to_user: string
  status: string
  chat_id: string | null
  created_at: string
  expires_at: string
  responded_at?: string | null
}

/** An answer to an intro chat's question pair. RLS shows the other person's only once I answered. */
export interface PairAnswerRow {
  id: string
  chat_id: string
  user_id: string
  question_id: string
  body: string
  created_at: string
}

/** A room's clip (one row per room; ref null = nothing on). */
export interface RoomWatchRow {
  room_id: string
  provider: string | null
  ref: string | null
  title: string | null
  duration_s: number | null
  is_live: boolean | null
  playing: boolean | null
  position_s: number | null
  position_at: string
  rate: number | null
  started_by: string | null
  started_at: string | null
  anyone_can_control: boolean | null
  updated_by: string | null
  updated_at: string | null
  version: number | null
}

export interface ChatMemberRow {
  chat_id: string
  user_id: string
  last_read_at: string | null
  consent_media?: boolean | null
}

export interface ChatMessageRow {
  id: string
  chat_id: string
  user_id: string | null
  body: string
  kind: string | null
  created_at: string
}

/** One of my blocks. The client only ever reads its own rows (blocks_select: blocker = me). */
export interface BlockRow {
  blocker: string
  blocked: string
  created_at?: string | null
}

/** my_blocked_people(): someone I blocked, with what the profiles table won't show me. */
export interface BlockedPersonRow {
  user_id: string
  /** null: the database doesn't have my_blocked_people yet, only my blocks rows were read */
  name: string | null
  color: string | null
  face: string | null
  accessory: string | null
  blocked_at: string | null
}

/** Tables the client keeps a local copy of (initial load + realtime + own writes). */
export interface TableRows {
  profiles: ProfileRow
  room_members: RoomMemberRow
  room_messages: RoomMessageRow
  room_message_sames: MessageSameRow
  sessions: SessionRow
  session_rsvps: RsvpRow
  event_messages: EventMessageRow
  wave_answers: WaveAnswerRow
  daily_answers: AnswerRow
  daily_answer_sames: AnswerSameRow
  intents: IntentRow
  intent_joins: IntentJoinRow
  chats: ChatRow
  chat_members: ChatMemberRow
  chat_messages: ChatMessageRow
  chat_message_sames: ChatSameRow
  prompt_sames: PromptSameRow
  intro_requests: IntroRequestRow
  chat_pair_answers: PairAnswerRow
  room_watch: RoomWatchRow
  /** our own writes only (not streamed) */
  blocks: BlockRow
}

export type LiveTable = keyof TableRows

export type ChangeType = 'INSERT' | 'UPDATE' | 'DELETE'

/** One row-level change, from realtime or from one of our own writes. */
export type Change = {
  [T in LiveTable]: { table: T; type: ChangeType; row: TableRows[T] }
}[LiveTable]
