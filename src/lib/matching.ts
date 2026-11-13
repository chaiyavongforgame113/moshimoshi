// "สัญญาณถูกคอ" — a 5-level signal scale (like phone bars) instead of a % score.
// The wave comes from the profile, so nobody has to post to be found:
// interests + loves (rare ones weigh more) · "จูนคลื่น" quiz · stories (prompt answers)
// · online times · chat styles that fit · shared rooms and events.
// Posts ("ชวนเล่น") only add a small bonus when both people are after the same thing.

import { useCatalog } from '@/data/catalog'
import { CATEGORY_LABEL, hasChatStyle, isAllDay, ONLINE_LABEL, OWN_PROMPT_ID, CHAT_STYLES, promptLabel, sameTag, TAG_BY_ID, tagKey, tagOf, tagsInText } from '@/data/tags'
import { L, loc, t, texts } from './i18n'
import { roomInLang, sessionInLang } from './i18n/catalog'
import { agreement, QUIZ_MIN_COMMON } from './waveQuiz'
import type {
  Intent,
  IntentRole,
  MatchBreakdown,
  MatchReason,
  MatchResult,
  PromptAnswer,
  SharedTag,
  SignalLevel,
  User,
  WaveAnswers,
} from './types'

export interface SignalMeta {
  level: SignalLevel
  label: string
  short: string
  hint: string
}

export const SIGNAL_LEVELS: SignalMeta[] = [
  loc<SignalMeta>({
    level: 1,
    label: L('เพิ่งจูนคลื่น', 'Tuning in'),
    short: L('จูนคลื่น', 'Tuning in'),
    hint: L('มีเรื่องให้เริ่มคุยอยู่นิดหน่อย', 'A little something to start a chat'),
  }),
  loc<SignalMeta>({
    level: 2,
    label: L('พอคุยกันได้', 'Could click'),
    short: L('พอคุยได้', 'Could click'),
    hint: L('มีเรื่องที่ชอบตรงกันบ้าง', 'You share a few interests'),
  }),
  loc<SignalMeta>({
    level: 3,
    label: L('ถูกคอ', 'Good vibes'),
    short: L('ถูกคอ', 'Good vibes'),
    hint: L('ชอบหลายอย่างคล้ายกัน คุยกันไม่เงียบแน่', 'Lots in common, so no awkward silences'),
  }),
  loc<SignalMeta>({
    level: 4,
    label: L('คอเดียวกัน', 'Kindred spirits'),
    short: L('คอเดียวกัน', 'Kindred'),
    hint: L('ทั้งเรื่องที่ชอบและจังหวะการคุยไปทางเดียวกัน', 'Same interests, and your rhythms line up too'),
  }),
  loc<SignalMeta>({
    level: 5,
    label: L('คลื่นเดียวกันเป๊ะ', 'Totally on your wavelength'),
    short: L('คลื่นเดียวกัน', 'Same wavelength'),
    hint: L('เหมือนเจอเพื่อนที่รู้จักกันมานาน', 'Like meeting an old friend'),
  }),
]

/** "ช่วงเช้า หัวค่ำ และดึกๆ": Thai lists read best with spaces and one และ before the last. */
const listTh = (items: string[]) => (items.length < 3 ? items.join('และ') : `${items.slice(0, -1).join(' ')} และ${items[items.length - 1]}`)
/** "mornings, evenings and late nights" */
const listEn = (items: string[]) => (items.length < 3 ? items.join(' and ') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`)

export function signalMeta(level: SignalLevel): SignalMeta {
  return SIGNAL_LEVELS[level - 1]
}

// role compatibility (row = A, column = B) from the design doc §5.4
const ROLE_COMPAT: Record<IntentRole, Record<IntentRole, number>> = {
  peer: { peer: 1, seek: 0.3, offer: 0.3, swap: 0.2, host: 0.9 },
  seek: { peer: 0.3, seek: 0.5, offer: 1, swap: 0.6, host: 0.8 },
  offer: { peer: 0.3, seek: 1, offer: 0, swap: 0.4, host: 0.2 },
  swap: { peer: 0.2, seek: 0.6, offer: 0.4, swap: 1, host: 0.1 },
  host: { peer: 0.9, seek: 0.8, offer: 0.2, swap: 0.1, host: 0.1 },
}

/** The profile parts of the wave (they add up to 1). Tune here. */
type Part = Exclude<keyof MatchBreakdown, 'intent'>
const WEIGHTS: Record<Part, number> = { interests: 0.35, quiz: 0.25, story: 0.1, rhythm: 0.1, style: 0.1, context: 0.1 }
/** The most a pair of matching posts can add on top of the profile score. */
const INTENT_BONUS = 0.08
/**
 * Score → level. Measured on the demo people (scratch check): each person sees about 2–8 others
 * at "ถูกคอ" or above, and level 5 stays rare. With the optional screens skipped (no loves,
 * stories, online times or chat style) it's about the same (2–6 each), since a part either side
 * left empty is left out of the score rather than counted as zero. The quiz doesn't shift the
 * spread: with everyone's picks in, each demo person sees 2–7 (mean 4.4, 4.0 without); the demo
 * me sees 8 before playing and 6–11 after one round of random picks (median 8, 200 runs).
 */
const LEVEL_CUTS: [number, SignalLevel][] = [
  [0.6, 5],
  [0.45, 4],
  [0.3, 3],
  [0.18, 2],
]
/** The highest a pair with nothing to talk about can reach (inside "พอคุยได้", under MIN_LEVEL). */
const NO_TOPIC_CAP = 0.25
/** A quiz reason only when the picks clearly line up (6 of 8 and up), not at chance (half). */
const QUIZ_REASON_SHARE = 0.7

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

function jaccard<T>(a: Iterable<T>, b: Iterable<T>): number {
  const A = new Set(a)
  const B = new Set(b)
  if (!A.size || !B.size) return 0
  let inter = 0
  for (const x of A) if (B.has(x)) inter++
  return inter / (A.size + B.size - inter)
}

// ---------- tag rarity (IDF over the community) ----------
interface TagStats {
  idf: Record<string, number>
  share: Record<string, number>
}

const hasTag = (list: string[], id: string) => list.some((t) => sameTag(t, id))

function tagStats(population: User[]): TagStats {
  const n = population.length
  const df: Record<string, number> = {}
  for (const u of population) for (const t of new Set(u.tags.map(tagKey))) df[t] = (df[t] ?? 0) + 1
  const idf: Record<string, number> = {}
  const share: Record<string, number> = {}
  // the catalog plus whatever people typed themselves (keys, so "BTS" and "bts" count as one)
  for (const t of new Set([...Object.keys(TAG_BY_ID), ...Object.keys(df)])) {
    const d = df[t] ?? 0
    idf[t] = Math.max(0.1, Math.log((n + 4) / (d + 1)))
    share[t] = n ? d / n : 0
  }
  return { idf, share }
}

function interestScore(a: User, b: User, stats: TagStats): { score: number; shared: SharedTag[] } {
  const w = (u: User, t: string) => (stats.idf[tagKey(t)] ?? 0.1) * (hasTag(u.loves, t) ? 1.5 : 1)
  const norm = (u: User) => Math.sqrt(u.tags.reduce((s, t) => s + w(u, t) ** 2, 0)) || 1
  const sharedIds = a.tags.filter((t) => hasTag(b.tags, t))
  const dot = sharedIds.reduce((s, t) => s + w(a, t) * w(b, t), 0)
  const shared: SharedTag[] = sharedIds
    .flatMap((t) => {
      const tag = tagOf(t)
      const part = stats.share[tagKey(t)] ?? 0
      return tag ? [{ tag, share: part, rare: part <= 0.2 }] : []
    })
    .sort((x, y) => x.share - y.share)
  // cosine of sparse vectors; a gentle sqrt lifts small overlaps so 1–2 rare tags still register
  return { score: clamp01(Math.sqrt(dot / (norm(a) * norm(b)))), shared }
}

// ---------- "จูนคลื่น" this-or-that quiz ----------
interface QuizFit {
  score: number
  same: number
  asked: number
}

/**
 * Agreement over the questions both answered (src/lib/waveQuiz.ts). null until that's at least
 * QUIZ_MIN_COMMON: then the part is left out of the wave and the rest renormalized, not counted as zero.
 */
function quizScore(a?: WaveAnswers, b?: WaveAnswers): QuizFit | null {
  const { same, common } = agreement(a, b)
  if (common < QUIZ_MIN_COMMON) return null
  // two-way picks agree half the time by chance, so chance lands near an ordinary part (~0.33) and all-same at 1
  return { score: clamp01((same / common - 0.25) / 0.75), same, asked: common }
}

// ---------- chat styles ----------
interface StyleFit {
  score: number
  /** the clearest reason the styles fit, if there is one worth saying */
  why?: string
}

const TALKER = 'คุยเก่ง'
const LISTENER = 'ฟังเก่ง'
const FAST = 'ตอบไว'
const SLOW = 'ตอบช้าแต่ตอบนะ'

/** Both said this style (listed ones by name, typed ones case-insensitively). */
const both = (a: User, b: User, style: string) => hasChatStyle(a.chatStyle, style) && hasChatStyle(b.chatStyle, style)

function styleScore(a: User, b: User): StyleFit {
  if (!a.chatStyle.length || !b.chatStyle.length) return { score: 0 }
  const fits: { v: number; why?: () => string }[] = []
  if ((hasChatStyle(a.chatStyle, TALKER) && hasChatStyle(b.chatStyle, LISTENER)) || (hasChatStyle(a.chatStyle, LISTENER) && hasChatStyle(b.chatStyle, TALKER)))
    fits.push({ v: 1, why: () => t('คนหนึ่งคุยเก่ง อีกคนฟังเก่ง ลงตัวพอดี', 'One loves to talk, the other loves to listen. A perfect fit') })
  if (both(a, b, FAST)) fits.push({ v: 0.8, why: () => t('ตอบไวทั้งคู่ คุยกันลื่นแน่', 'You both reply fast, so chats will flow') })
  if (both(a, b, SLOW)) fits.push({ v: 0.7, why: () => t('ตอบช้าแต่ตอบเหมือนกัน ไม่มีใครต้องเร่งใคร', 'You both take your time replying, so nobody feels rushed') })
  if (both(a, b, 'พิมพ์ยาว')) fits.push({ v: 0.7, why: () => t('ชอบพิมพ์ยาวๆ เหมือนกัน', 'You both love writing long messages') })
  if (both(a, b, 'สายสติกเกอร์')) fits.push({ v: 0.6, why: () => t('สายสติกเกอร์ทั้งคู่', "You're both sticker people") })
  if (both(a, b, TALKER)) fits.push({ v: 0.5, why: () => t('คุยเก่งทั้งคู่ ไม่มีเงียบแน่', 'You both love to talk, so no awkward silences') })
  if (both(a, b, LISTENER)) fits.push({ v: 0.35 })
  if (both(a, b, 'คุยเสียงได้')) fits.push({ v: 0.4 })
  // styles people typed themselves ("อื่นๆ") that match
  for (const s of a.chatStyle) {
    if (CHAT_STYLES.includes(s) || !hasChatStyle(b.chatStyle, s)) continue
    fits.push({ v: 0.5, why: () => t(`ชอบคุยแบบ "${s}" เหมือนกัน`, `You both chat "${s}"`) })
  }
  // fast meets slow: one waits, the other feels rushed
  const clash = (hasChatStyle(a.chatStyle, FAST) && hasChatStyle(b.chatStyle, SLOW)) || (hasChatStyle(a.chatStyle, SLOW) && hasChatStyle(b.chatStyle, FAST))
  const fit = 1 - fits.reduce((miss, f) => miss * (1 - f.v), 1)
  const best = fits.filter((f) => f.why).sort((x, y) => y.v - x.v)[0]
  return { score: clamp01(fit - (clash ? 0.3 : 0)), why: best?.why?.() }
}

// ---------- intent (similar or complementary) — the bonus ----------
interface IntentHit {
  score: number
  mine?: Intent
  theirs: Intent
  /** bio: their post is about something on my profile · mine-bio: my post is about something on theirs */
  kind: 'similar' | 'host' | 'teach' | 'swap' | 'bio' | 'mine-bio'
}

/** Two posts that fit together (not just a post meeting a profile): the only kind that earns the bonus. */
const postsMatch = (hit: IntentHit | null): hit is IntentHit => !!hit && hit.kind !== 'bio' && hit.kind !== 'mine-bio'

function activitySim(a: Intent, b: Intent): number {
  if (sameTag(a.tagId, b.tagId)) return 1
  const ta = tagOf(a.tagId)
  const tb = tagOf(b.tagId)
  // two different things people typed themselves aren't related just because both are "other"
  if (ta && tb && ta.category === tb.category && ta.category !== 'other') return 0.4
  return 0
}

function timeFit(a: Intent, b: Intent): number {
  if (a.when === b.when) return 1
  if (a.when === 'anytime' || b.when === 'anytime') return 0.8
  return 0.55
}

function swapFit(a: Intent, b: Intent): number {
  const give = (x?: string) => (x ? tagsInText(x) : [])
  const aGive = give(a.give)
  const aWant = give(a.want)
  const bGive = give(b.give)
  const bWant = give(b.want)
  // in people's own words: "สอนปั้นดิน" meets "อยากเรียนปั้นดิน" without any listed tag
  const close = (want?: string, have?: string) => !!want && !!have && jaccard(words(want), words(have)) >= 0.3
  const forward = aWant.some((t) => bGive.includes(t)) || close(a.want, b.give) || (a.role === 'seek' && b.role === 'offer')
  const backward = bWant.some((t) => aGive.includes(t)) || close(b.want, a.give) || (a.role === 'offer' && b.role === 'seek')
  if (a.role === 'swap' && b.role === 'swap') return forward && backward ? 1 : forward || backward ? 0.5 : 0
  return forward || backward ? 1 : 0
}

function intentScore(mine: Intent[], theirs: Intent[], me: User, them: User): IntentHit | null {
  let best: IntentHit | null = null
  for (const t of theirs) {
    for (const m of mine) {
      const act = activitySim(m, t)
      if (!act) continue
      let role = ROLE_COMPAT[m.role][t.role]
      const complementary = ['seek', 'offer', 'swap'].includes(m.role) && ['seek', 'offer', 'swap'].includes(t.role)
      if (complementary && !(m.role === 'seek' && t.role === 'seek')) role *= swapFit(m, t)
      const score = act * role * timeFit(m, t)
      if (!best || score > best.score) {
        const kind: IntentHit['kind'] =
          m.role === 'swap' && t.role === 'swap' && role > 0
            ? 'swap'
            : complementary && role > 0
              ? 'teach'
              : t.role === 'host' || m.role === 'host'
                ? 'host'
                : 'similar'
        best = { score, mine: m, theirs: t, kind }
      }
    }
    // their post vs my profile: a reason to say hi, but no bonus (only matching posts add one)
    if (hasTag(me.tags, t.tagId)) {
      const score = 0.55 * (hasTag(me.loves, t.tagId) ? 1 : 0.8)
      if (!best || score > best.score) best = { score, theirs: t, kind: 'bio' }
    }
  }
  // my posts vs their profile
  for (const m of mine) {
    if (hasTag(them.tags, m.tagId)) {
      const score = 0.5
      if (!best || score > best.score) best = { score, mine: m, theirs: m, kind: 'mine-bio' }
    }
  }
  return best
}

// ---------- story (prompt answers, Thai-aware) ----------
const STOP = new Set(['และ', 'กับ', 'ที่', 'ก็', 'แล้ว', 'จน', 'ได้', 'ไป', 'มา', 'เป็น', 'ของ', 'ให้', 'แต่', 'ยัง', 'ทุก', 'คืน', 'มาก', 'เลย', 'นะ', 'ครับ', 'ค่ะ', 'อยาก', 'ชอบ',
  'and', 'the', 'to', 'of', 'in', 'on', 'at', 'for', 'with', 'my', 'me', 'is', 'it', 'an', 'or', 'but', 'so', 'up', 'too', 'just', 'really',
  'very', 'all', 'every', 'am', 'are', 'be', "i'm", 'im', 'you', 'your', 'that', 'this', 'like', 'love', 'want', 'into', 'from', 'about',
  'then', 'also', 'some', 'get', 'go',
])
const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('th', { granularity: 'word' }) : null

function words(text: string): string[] {
  const t = text.toLowerCase()
  if (!segmenter) return t.split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w))
  const out: string[] = []
  for (const s of segmenter.segment(t)) {
    if (s.isWordLike && s.segment.length > 1 && !STOP.has(s.segment)) out.push(s.segment)
  }
  return out
}

function storyScore(a: User, b: User): { score: number; answer?: PromptAnswer } {
  let best = 0
  let answer: PromptAnswer | undefined
  for (const pa of a.prompts) {
    for (const pb of b.prompts) {
      const tagSim = jaccard(tagsInText(pa.text), tagsInText(pb.text))
      const wordSim = jaccard(words(pa.text), words(pb.text))
      const samePrompt = pa.promptId !== OWN_PROMPT_ID && pa.promptId === pb.promptId ? 0.15 : 0
      const s = clamp01(0.6 * tagSim + 0.9 * wordSim + samePrompt * (tagSim + wordSim > 0 ? 1 : 0))
      if (s > best) {
        best = s
        answer = pb
      }
    }
  }
  return { score: clamp01(best * 1.6), answer }
}

// ---------- icebreakers ----------
const ICEBREAKER_BY_CATEGORY: Record<string, (label: string, name: string) => string> = {
  game: (l, n) => t(`ชวน${n}เข้าตี้ ${l} คืนนี้ดูไหม?`, `Invite ${n} to a round of ${l} tonight?`),
  anime: (l) => t(`ฉากไหนใน ${l} ที่ลืมไม่ลงที่สุด?`, `What got you into ${l}?`),
  music: (l) => t(`ถ้าต้องเลือก 1 เพลงสาย ${l} ให้คนไม่เคยฟัง จะเลือกเพลงไหน?`, `${l}: which song would you play for someone new to it?`),
  film: (l) => t(`${l} เรื่องไหนที่ดูซ้ำได้ไม่เบื่อ?`, `${l}: which one could you rewatch forever?`),
  food: (l) => t(`ร้าน${l}ที่ชอบที่สุดอยู่แถวไหน ขอพิกัดหน่อย`, `${l}: where's your favorite spot? Drop a pin!`),
  outdoor: (l) => t(`ทริป${l}ครั้งที่ประทับใจที่สุดคือที่ไหน?`, `${l}: what's your best story so far?`),
  lang: (l) => t(`เริ่มเรียน${l}เพราะอะไรเหรอ?`, `What got you into learning ${l}?`),
  study: (l) => t(`ปกติ${l}ช่วงไหน ชวนกันมานั่งด้วยกันได้นะ`, `${l}: when are you usually at it? We could keep each other company!`),
  pet: (l) => t(`ขอดูรูปน้องหน่อย! (${l} ตัวจริงต้องอวด)`, `Pet pics, please! (A true ${l.toLowerCase()} has to show off)`),
  art: (l) => t(`ช่วงนี้${l}อะไรอยู่ อยากเห็นผลงานจัง`, `${l}: what are you working on lately? I'd love to see it`),
  book: (l) => t(`ถ้าให้ป้ายยา${l} 1 เล่ม จะเลือกเล่มไหน?`, `${l}: if you could recommend just one book, which would it be?`),
  life: (l) => t(`เรื่อง "${l}" มีเรื่องเล่าเยอะแน่ๆ เล่าให้ฟังหน่อย`, `I bet you have stories about "${l}". Tell me one!`),
  other: (l) => t(`ชอบ "${l}" เหมือนกันเลย เริ่มชอบตั้งแต่ตอนไหนเหรอ?`, `You're into "${l}" too! How did you get into it?`),
}

function buildIcebreakers(them: User, shared: SharedTag[], hit: IntentHit | null, matched?: PromptAnswer): string[] {
  const out: string[] = []
  if (postsMatch(hit)) out.push(t(`ทักเรื่อง "${hit.theirs.text}" ได้เลย เขากำลังหาอยู่พอดี`, `Say hi about "${hit.theirs.text}". They're looking for exactly that`))
  for (const s of shared.slice(0, 2)) {
    const f = ICEBREAKER_BY_CATEGORY[s.tag.category]
    if (f) out.push(f(s.tag.label, them.name))
  }
  const answer = matched ?? them.prompts[0]
  if (answer) out.push(t(`${them.name}บอกว่า "${answer.text}" ลองถามต่อดูสิ`, `${them.name} said "${answer.text}". Ask them more!`))
  return out.slice(0, 3)
}

// ---------- main ----------
/** Optional inputs beyond the profiles. */
export interface MatchExtras {
  /** "จูนคลื่น" picks by user id (the quiz phase fills this; until then the quiz part is left out) */
  quiz?: Record<string, WaveAnswers>
  /** session ids I said "ไปด้วย" to: their events I'm going to count as shared context */
  going?: string[]
}

/** Everything that depends on the whole community, worked out once per list. */
interface Ctx {
  stats: TagStats
  intents: Intent[]
  extras: MatchExtras
}

function makeCtx(me: User, population: User[], intents: Intent[], extras: MatchExtras): Ctx {
  const pop = population.some((u) => u.id === me.id) ? population : [...population, me]
  return { stats: tagStats(pop), intents, extras }
}

function scorePair(me: User, them: User, myIntents: Intent[], { stats, intents, extras }: Ctx): MatchResult {
  const catalog = useCatalog.getState()
  const roomOf = (id: string) => {
    const room = catalog.rooms.find((r) => r.id === id)
    return room && roomInLang(room)
  }
  const theirIntents = intents.filter((i) => i.userId === them.id)

  const interests = interestScore(me, them, stats)
  const quiz = quizScore(extras.quiz?.[me.id], extras.quiz?.[them.id])
  const story = storyScore(me, them)
  const rhythm = jaccard(me.online, them.online)
  const style = styleScore(me, them)
  const sharedRooms = me.rooms.filter((r) => {
    const room = them.rooms.includes(r) ? roomOf(r) : undefined
    return !!room && !room.isLobby
  })
  const going = extras.going ?? []
  const theirEvents = catalog.sessions.filter((s) => s.hostId === them.id && !s.cancelled && going.includes(s.id)).map(sessionInLang)
  const context = clamp01((sharedRooms.length + theirEvents.length) * 0.5)
  const hit = intentScore(myIntents, theirIntents, me, them)
  // only two matching posts earn the bonus; "their post is about something I like" is a reason, not a bonus
  const intentFit = postsMatch(hit) ? hit.score : 0

  const breakdown: MatchBreakdown = {
    interests: interests.score,
    quiz: quiz?.score ?? 0,
    story: story.score,
    rhythm,
    style: style.score,
    context,
    intent: intentFit,
  }

  // a part one side has no data for yet is left out and the rest renormalized (missing ≠ negative),
  // so skipping the optional onboarding screens never pushes anyone under MIN_LEVEL
  const missing: Part[] = []
  if (!quiz) missing.push('quiz')
  if (!me.prompts.length || !them.prompts.length) missing.push('story')
  if (!me.online.length || !them.online.length) missing.push('rhythm')
  if (!me.chatStyle.length || !them.chatStyle.length) missing.push('style')
  const parts = (Object.keys(WEIGHTS) as Part[]).filter((k) => !missing.includes(k))
  const wSum = parts.reduce((s, k) => s + WEIGHTS[k], 0)
  const profile = parts.reduce((s, k) => s + WEIGHTS[k] * breakdown[k], 0) / wSum
  // same hours and a fitting chat style alone aren't "ถูกคอ": without one thing to talk about, stay below it
  const topic = interests.shared.length > 0 || story.score > 0.25 || (quiz?.score ?? 0) >= 0.5 || intentFit > 0
  const score = Math.min(clamp01(profile + INTENT_BONUS * intentFit), topic ? 1 : NO_TOPIC_CAP)

  const level: SignalLevel = LEVEL_CUTS.find(([cut]) => score >= cut)?.[1] ?? 1
  const meta = signalMeta(level)

  // reasons — concrete, human, never numeric
  const reasons: MatchReason[] = []
  const rare = interests.shared.filter((s) => s.rare)
  const common = interests.shared.filter((s) => !s.rare)
  if (rare.length) {
    reasons.push({
      kind: 'rareTag',
      text: t(
        `ชอบ ${rare.slice(0, 2).map((s) => s.tag.label).join(' และ ')} เหมือนกัน (หายากนะ!)`,
        `You both picked ${rare.slice(0, 2).map((s) => s.tag.label).join(' and ')} (that's rare!)`,
      ),
      weight: 0.9,
    })
  }
  if (common.length) {
    reasons.push({
      kind: 'tag',
      text: t(`ชอบ ${common.slice(0, 3).map((s) => s.tag.label).join(', ')} เหมือนกัน`, `You both picked ${common.slice(0, 3).map((s) => s.tag.label).join(', ')}`),
      weight: 0.5 + 0.1 * common.length,
    })
  }
  if (quiz && quiz.same / quiz.asked >= QUIZ_REASON_SHARE) {
    reasons.push({
      kind: 'quiz',
      text: t(`จูนคลื่นตรงกัน ${quiz.same}/${quiz.asked} ข้อ`, `You picked the same side on ${quiz.same} of ${quiz.asked} this-or-thats`),
      weight: 0.35 + 0.5 * quiz.score,
    })
  }
  if (hit) {
    const tag = tagOf(hit.theirs.tagId)?.label ?? ''
    const text =
      hit.kind === 'swap'
        ? t(
            `แลกกันพอดี: เขาให้ ${hit.theirs.give ?? tag} ได้ และอยากได้ ${hit.theirs.want ?? 'สิ่งที่เรามี'}`,
            `A perfect swap: they can offer ${hit.theirs.give ?? tag} and want ${hit.theirs.want ?? 'what you have'}`,
          )
        : hit.kind === 'teach'
          ? hit.theirs.role === 'offer'
            ? t(`เราอยากเริ่ม ${tag} และเขายินดีช่วยมือใหม่`, `You want to get into ${tag}, and they're happy to help beginners`)
            : t(`เขาอยากเริ่ม ${tag} ซึ่งเราช่วยได้พอดี`, `They want to get into ${tag}, and you can help`)
          : hit.kind === 'host'
            ? t(`เขามีที่ว่างใน "${hit.theirs.text}"`, `They have a spot open in "${hit.theirs.text}"`)
            : hit.kind === 'bio'
              ? t(`เขากำลังชวนเล่น ${tag} ซึ่งเราก็ชอบ`, `They're inviting people for ${tag}, and you're into it too`)
              : hit.kind === 'mine-bio'
                ? t(`${them.name}ชอบ ${tag} ตรงกับที่เราชวนเล่นอยู่`, `${them.name} is into ${tag}, just what you're inviting people for`)
                : t(`กำลังชวนเล่น ${tag} เหมือนกัน`, `You're both inviting people for ${tag}`)
    reasons.push({ kind: hit.kind === 'swap' || hit.kind === 'teach' ? 'swap' : 'intent', text, weight: hit.kind === 'bio' || hit.kind === 'mine-bio' ? 0.45 * hit.score : 0.3 + 0.5 * hit.score })
  }
  const storyTopic = story.answer && promptLabel(story.answer)?.replace('…', '')
  if (story.score > 0.25 && storyTopic) {
    reasons.push({
      kind: 'prompt',
      text: t(`ตอบคล้ายกันเรื่อง "${storyTopic}"`, `Similar answers to "${storyTopic}"`),
      weight: story.score,
    })
  }
  // only a strong overlap is worth saying: at least half of the times either is around
  const sharedSlots = me.online.filter((s) => them.online.includes(s))
  if (sharedSlots.length && rhythm >= 0.5) {
    const slots = sharedSlots.map((s) => ONLINE_LABEL[s])
    reasons.push({
      kind: 'time',
      text: isAllDay(sharedSlots)
        ? t('ออนไลน์ได้ทั้ง 24 ชั่วโมงเหมือนกัน', "You're both around 24/7")
        : t(`ออนไลน์${listTh(slots)}เหมือนกัน`, `You're both online ${listEn(slots).toLowerCase()}`),
      weight: 0.25 + rhythm * 0.35,
    })
  }
  if (style.why && style.score >= 0.5) {
    reasons.push({ kind: 'style', text: style.why, weight: 0.2 + 0.35 * style.score })
  }
  if (sharedRooms.length) {
    const names = sharedRooms.map((r) => roomOf(r)?.name)
    reasons.push({
      kind: 'room',
      text: t(`อยู่ห้อง${names.join(' และ ')}ด้วยกัน`, `You're both in ${names.join(' and ')}`),
      weight: 0.3 + context * 0.3,
    })
  }
  if (theirEvents.length) {
    reasons.push({
      kind: 'room',
      text: t(`เราจะไปอีเวนต์ "${theirEvents[0].title}" ที่เขาจัด`, `You're going to their event "${theirEvents[0].title}"`),
      weight: 0.45,
    })
  }
  reasons.sort((x, y) => y.weight - x.weight)

  return {
    userId: them.id,
    level,
    score,
    label: meta.label,
    shortLabel: meta.short,
    reasons,
    sharedTags: interests.shared,
    breakdown,
    missing,
    icebreakers: buildIcebreakers(them, interests.shared, hit, story.answer),
  }
}

/** One person's signal with me (a profile page). */
export function matchUser(
  me: User,
  them: User,
  myIntents: Intent[] = [],
  population: User[] = [],
  intents: Intent[] = [],
  extras: MatchExtras = {},
): MatchResult {
  return scorePair(me, them, myIntents, makeCtx(me, population, intents, extras))
}

/**
 * Everyone but me, best signal first. Returns the whole population on purpose: a profile
 * page needs a signal for anyone. Lists that suggest people go through onWavelength().
 */
export function matchAll(me: User, myIntents: Intent[] = [], population: User[] = [], intents: Intent[] = [], extras: MatchExtras = {}): MatchResult[] {
  const ctx = makeCtx(me, population, intents, extras)
  return population
    .filter((u) => u.id !== me.id)
    .map((u) => scorePair(me, u, myIntents, ctx))
    .sort((a, b) => b.score - a.score)
}

/**
 * The lowest signal we ever suggest: level 3, "ถูกคอ" (Good vibes). People below it are never
 * suggested anywhere (home, people, rooms, after posting); they only see their signal on a
 * profile they open themselves. The one place to tune how picky suggestions are.
 */
export const MIN_LEVEL: SignalLevel = 3

/** Only people at `min` or above, keeping the given (high-to-low) order. */
export function onWavelength(matches: MatchResult[], min: SignalLevel = MIN_LEVEL): MatchResult[] {
  return matches.filter((m) => m.level >= min)
}

/** Every part of the wave, in the order they're shown (`intent` last: it's the bonus). */
export const BREAKDOWN_LABEL: Readonly<Record<keyof MatchBreakdown, string>> = texts({
  interests: L('เรื่องที่ชอบ', 'Interests'),
  quiz: L('จูนคลื่น', 'This or that'),
  story: L('เรื่องเล่า', 'Stories'),
  rhythm: L('ช่วงเวลาออนไลน์', 'Online times'),
  style: L('สไตล์การคุย', 'Chat style'),
  context: L('ห้องและอีเวนต์', 'Rooms & events'),
  intent: L('ชวนเล่นเรื่องเดียวกัน (โบนัส)', 'Same invites (bonus)'),
})

export { CATEGORY_LABEL }
