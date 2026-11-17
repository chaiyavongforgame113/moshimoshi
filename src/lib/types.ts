// Shared domain types for the moshimoshi prototype.
// Every page reads from these; keep them stable.

export type MochiColor = 'peach' | 'butter' | 'mint' | 'lavender' | 'sky' | 'pink' | 'cream'

export type TagCategory =
  | 'game'
  | 'anime'
  | 'music'
  | 'film'
  | 'food'
  | 'outdoor'
  | 'lang'
  | 'study'
  | 'pet'
  | 'art'
  | 'book'
  | 'life'
  /** what people typed themselves ("อื่นๆ"), see tagOf in data/tags */
  | 'other'

export interface Tag {
  id: string
  label: string
  category: TagCategory
  /** Thai / English / slang spellings that should resolve to this tag */
  aliases?: string[]
}

export type OnlineSlot = 'morning' | 'afternoon' | 'evening' | 'late'

export interface Prompt {
  id: string
  label: string
  /** placeholder / example answer shown in the composer */
  example: string
}

export interface PromptAnswer {
  promptId: string
  text: string
  /** their own question, when promptId is OWN_PROMPT_ID */
  question?: string
}

/** peer = do X together · seek = wants someone who can give X · offer = can give X · swap = trade A for B · host = has N open spots */
export type IntentRole = 'peer' | 'seek' | 'offer' | 'swap' | 'host'

export type IntentTemplate = 'play' | 'talk' | 'lang' | 'event' | 'newbie' | 'study' | 'moved' | 'listen'

export type IntentWhen = 'tonight' | 'weekend' | 'anytime' | 'dated'

export interface Intent {
  id: string
  userId: string
  template: IntentTemplate
  role: IntentRole
  /** main activity tag id */
  tagId: string
  text: string
  when: IntentWhen
  /** human label for dated / recurring intents, e.g. "เสาร์นี้ 14:00" */
  whenLabel?: string
  mode: 'online' | 'offline'
  /** province shown publicly (never finer than province) */
  province?: string
  /** open spots for host intents */
  slots?: number
  /** for swap / seek / offer: what the poster can give and wants */
  give?: string
  want?: string
  roomId?: string
  /** minutes since posted (mock clock) */
  postedMinutesAgo: number
  /** user ids who pressed "ฉันด้วย" */
  joinedBy: string[]
}

export interface User {
  id: string
  name: string
  age: number
  /** ค.ศ.; collected in onboarding for the 20+ check (profiles.birth_year) */
  birthYear?: number
  color: MochiColor
  /** mochi look picked in onboarding (3D mascot + avatar) */
  face?: 'smile' | 'happy' | 'wink' | 'sleepy' | 'talk' | 'wow'
  accessory?: 'none' | 'headset' | 'leaf' | 'bow' | 'cap'
  province: string
  /** one-line self intro */
  bio: string
  tags: string[]
  /** up to 3 starred tags ("รักมาก") */
  loves: string[]
  prompts: PromptAnswer[]
  chatStyle: string[]
  online: OnlineSlot[]
  rooms: string[]
  languages: string[]
  /**
   * "ช่วงชีวิต": up to 3 (LIFE_STAGE_MAX in lib/lifeStages). Stored in Thai: the list's values, or
   * what they typed themselves ("อื่นๆ"); show them with lifeStageLabel(). Absent before
   * profiles.life_stages exists (20261117000001_lifestage_intro_watch.sql).
   */
  lifeStages?: string[]
  isHost?: boolean
  /** e.g. "ออนไลน์อยู่", "15 นาทีที่แล้ว" */
  lastActive: string
  isOnline: boolean
}

export interface Room {
  id: string
  name: string
  /** lucide icon name rendered by <RoomIcon /> */
  icon: string
  color: MochiColor
  tagline: string
  /** longer welcoming description */
  vibe: string
  tags: string[]
  memberCount: number
  onlineCount: number
  primeTime: string
  hostIds: string[]
  /** lobby is special: not counted as a shared room for matching */
  isLobby?: boolean
}

export interface Session {
  id: string
  roomId: string
  title: string
  /** 0 = today, 1 = tomorrow ... */
  dayOffset: number
  time: string
  durationMin: number
  going: number
  /** '' when the team hosts it (no host profile) */
  hostId: string
  /** host label from sessions.host_name, for hosts without a profile */
  hostName?: string
  live?: boolean
  /** when it starts, ISO (an event's chat opens then; see eventPhase in lib/events) */
  startsAt: string
  /** when it ends, ISO: startsAt + durationMin (the chat closes then, and hides 24 hours later) */
  endsAt: string
  /** a few lines from whoever set it up (up to 300 characters) */
  description?: string
  /** called off by its host or staff ("ยกเลิกแล้ว"); stays listed so people who were going see it */
  cancelled?: boolean
  /** comes back every week (a weekly plan is still on): nextOccurrence() gives the next one */
  repeatsWeekly?: boolean
  /** the same for every week of one weekly event (findNextInSeries); absent for one-offs */
  seriesId?: string
  /** who else is going (ids of people I can see, never me); `going` is their count */
  goingIds?: string[]
  /** who set it up (a profile id), when someone did rather than the weekly plan */
  createdBy?: string
}

/** Where an event is right now (see eventPhase in lib/events). */
export type EventPhase = 'upcoming' | 'open' | 'closed' | 'cancelled'

/** What createEvent needs (the wizard's answers). */
export interface EventDraft {
  roomId: string
  title: string
  description?: string
  /** ISO; from now up to 60 days ahead */
  startsAt: string
  /** 15–240 */
  durationMin: number
  /** also every week, same weekday and time (Asia/Bangkok) */
  repeatWeekly: boolean
}

/** Server features that arrive with a later migration (live mode switches each on when it finds it; demo: all on). */
export interface ServerFeatures {
  /** sessions + event chat (20261114000001_room_events.sql) */
  events: boolean
  /** "จูนคลื่น" picks shared with everyone (20261114000002_wave_quiz.sql); off: they stay on this device */
  waveQuiz: boolean
  /** profiles.life_stages (20261117000001_lifestage_intro_watch.sql); off: hide the life stage editor */
  lifeStages: boolean
  /** Mochi's warm intros + the question pair (same file); off: hide "ให้โมชิแนะนำให้" */
  intros: boolean
  /** watching clips together in rooms (same file); off: hide the watch panel */
  watch: boolean
  /** wave_card_preview (same file): the teaser a shared wave card's link opens; off: no wave card to share */
  waveCard: boolean
}

export interface DailyAnswer {
  userId: string
  text: string
  sameCount: number
}

export interface DailyQuestion {
  id: string
  roomId: string
  text: string
  answers: DailyAnswer[]
  /** who said "เหมือนกัน!" to my answer */
  mySameBy?: string[]
}

/** A photo in a 1:1 chat (บันไดความไว้ใจ ขั้น 2). */
export interface ChatImage {
  /** live: where it lives in the chat-images bucket */
  path?: string
  /** a local copy: just picked on this device (or any demo photo) */
  url?: string
  width: number
  height: number
  /** still on its way */
  sending?: boolean
}

export interface ChatMessage {
  id: string
  userId: string
  text: string
  /** display time, e.g. "21:04" */
  at: string
  /** 'mochi': one of Mochi's lines in an intro chat (userId 'system'; see mochiStep in data/pairQuestions) */
  kind?: 'text' | 'system' | 'welcome' | 'image' | 'mochi'
  /** kind 'image' only */
  image?: ChatImage
  sameBy?: string[]
  replyTo?: string
  /**
   * The temporary id a message I sent had while it was on its way. It stays the same after the
   * server id replaces `id`, so React keys and an open viewer keep following the same message.
   */
  localId?: string
}

/** live chats only: pending = a moshi still ringing · active = talking · ended = closed */
export type ChatStatus = 'pending' | 'active' | 'ended'

export interface Chat {
  id: string
  withUserId: string
  messages: ChatMessage[]
  /** suggested opener / topic card pinned at the top */
  icebreaker?: string
  unread: number
  /** live mode: server status (demo chats have none) */
  status?: ChatStatus
  /** live mode: who sent the moshi that opened this chat */
  requestedBy?: string
  /** บันไดความไว้ใจ ขั้น 2: who said yes to photos (both = unlocked) */
  consent?: { me: boolean; them: boolean }
  /** 'intro': opened by Mochi's warm intro (a 3-person feel: Mochi's lines, the question pair) */
  kind?: 'hello' | 'intro'
  /** intro chats: the question pair's question id (PAIR_QUESTIONS in data/pairQuestions) */
  pairQuestion?: string
}

// ------------------------------------------------------------------ Mochi's warm intros

/** pending = waiting for their answer · accepted = the chat is open · expired = the time ran out */
export type IntroStatus = 'pending' | 'accepted' | 'expired'

/**
 * "ให้โมชิแนะนำให้": someone asked Mochi to introduce two people. Double opt-in: the person asked
 * says "ยินดีรู้จัก" (the 1:1 chat opens with Mochi's lines) or "ไว้ก่อนนะ" (silent for the asker:
 * theirs just waits until it expires, never "rejected").
 */
export interface IntroRequest {
  id: string
  /** who asked Mochi */
  fromUserId: string
  /** who Mochi asks */
  toUserId: string
  /** incoming = someone asked Mochi about me (I answer) · outgoing = I asked */
  direction: 'incoming' | 'outgoing'
  /** the other person (fromUserId for incoming, toUserId for outgoing) */
  withUserId: string
  /** 'expired' as soon as expiresAt passes (the server catches up within the hour) */
  status: IntroStatus
  /** ISO */
  createdAt: string
  /** ISO: 3 days after createdAt */
  expiresAt: string
  /** accepted: the chat Mochi opened */
  chatId?: string
}

/** One question of the question pair (both answer privately; answers open when both have). */
export interface PairQuestion {
  /** stable slug, stored with the answers */
  id: string
  /** in the current language */
  text: string
  /** a short example under the answer box, in the current language */
  hint: string
}

export interface PairAnswer {
  chatId: string
  userId: string
  questionId: string
  text: string
  /** ISO */
  at: string
}

/** Where an intro chat's question pair is for me. */
export interface PairState {
  /** undefined: this chat has no question pair */
  question?: PairQuestion
  mine?: PairAnswer
  /** only once both answered (the server holds it back until then) */
  theirs?: PairAnswer
  /** none = no question · ask = my turn · waiting = I answered, they haven't · revealed = both answered */
  step: 'none' | 'ask' | 'waiting' | 'revealed'
}

// ------------------------------------------------------------------ watching clips together in rooms

/** youtube: an 11-character video id · vimeo: a numeric video id · file: an https .mp4 / .webm link */
export type WatchProvider = 'youtube' | 'vimeo' | 'file'

/** What a pasted link turned into (parseVideoUrl in data/watch). */
export interface VideoPick {
  provider: WatchProvider
  /** the video id (youtube / vimeo) or the https link (file) */
  ref: string
  title?: string
  /** seconds, when known */
  durationS?: number
  /** a live stream: everyone watches the live edge, positions aren't synced */
  isLive?: boolean
  /** where to start (a ?t= in the link), seconds */
  startS?: number
}

export type WatchAction = 'play' | 'pause' | 'seek' | 'rate'

/**
 * A room's clip as the server holds it. The position is positionS at the server moment positionAt
 * (ms since epoch; may be up to a second ahead: the clip starts then). Work out where it is with
 * watchPositionAt(watch, serverNow()) from data/watch, never from Date.now() alone.
 */
export interface RoomWatch {
  roomId: string
  provider: WatchProvider
  ref: string
  title?: string
  durationS?: number
  isLive: boolean
  playing: boolean
  positionS: number
  /** server time, ms since epoch */
  positionAt: number
  /** 0.25–2 */
  rate: number
  startedBy?: string
  /** server time, ms */
  startedAt?: number
  /** a host switched on "ให้ทุกคนคุมได้" */
  anyoneCanControl: boolean
  updatedBy?: string
  /** server time, ms: the last play / pause / move / switch (a player's length report doesn't count) */
  updatedAt?: number
  /** grows with every change: ignore a state older than the one shown */
  version: number
}

// ------------------------------------------------------------------ wave cards

/** What anyone with a wave card's link sees before signing in (wave_card_preview): nothing else. */
export interface ComparePreview {
  userId: string
  name: string
  color: MochiColor
  face?: User['face']
  accessory?: User['accessory']
}

export type SignalLevel = 1 | 2 | 3 | 4 | 5

export type MatchReasonKind = 'rareTag' | 'tag' | 'intent' | 'swap' | 'prompt' | 'time' | 'room' | 'style' | 'quiz' | 'lifeStage'

export interface MatchReason {
  kind: MatchReasonKind
  text: string
  /** contribution 0..1 used for ordering */
  weight: number
}

export interface SharedTag {
  tag: Tag
  /** share of the community that has this tag, 0..1 */
  share: number
  rare: boolean
}

/**
 * What the wave is made of. Each part is 0..1 (shown as bars or dots, never as a percentage).
 * The profile parts carry the score; `intent` is a small bonus on top, not a part.
 */
export interface MatchBreakdown {
  /** shared interests and loves, rare ones weigh more */
  interests: number
  /** "จูนคลื่น" this-or-that picks in common (left out of the score until both have played) */
  quiz: number
  /** "ช่วงชีวิต" in common (left out of the score unless both have one in common; see matching.ts) */
  lifeStage: number
  /** similar answers to profile prompts */
  story: number
  /** online at the same times of day */
  rhythm: number
  /** chat styles that fit (talker + listener, same pace…) */
  style: number
  /** shared rooms, and events of theirs I'm going to */
  context: number
  /** bonus: both are inviting people to the same thing right now */
  intent: number
}

/** A "จูนคลื่น" pick: the question's first side (0) or second side (1). */
export type WaveChoice = 0 | 1

/** One person's "จูนคลื่น" picks: question id → the side they picked. */
export type WaveAnswers = Record<string, WaveChoice>

export interface MatchResult {
  userId: string
  level: SignalLevel
  /** internal 0..1 score; never render it as a number */
  score: number
  label: string
  shortLabel: string
  reasons: MatchReason[]
  sharedTags: SharedTag[]
  breakdown: MatchBreakdown
  /** parts one side has no data for yet: left out of the score (not counted as zero) and out of breakdown views */
  missing: (keyof MatchBreakdown)[]
  icebreakers: string[]
}

export type Mood = 'happy' | 'chill' | 'tired' | 'lonely' | 'excited'
