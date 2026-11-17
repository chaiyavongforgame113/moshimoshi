// "บัตรคลื่น" (wave cards): a playful "my wave" archetype worked out from someone's "จูนคลื่น" picks,
// interests and life stage, and the shareable story-size PNG (1080 × 1920) drawn on a canvas.
//
// Everything here runs on the person's own device: the archetype is a pure function of what they
// can already see (their profile and picks), and the card is drawn client-side (no WebGL capture:
// the 2D <Avatar>'s SVG is serialized and drawn as an image). Text reads in the current language
// at call time: never call these at module load.
import { tagOf } from '@/data/tags'
import { waveQuestion } from '@/data/wave'
import { CATEGORY_COLOR, MOCHI } from '@/lib/colors'
import { getLang, L, loc, t, type Txt } from '@/lib/i18n'
import { lifeStageEmoji, lifeStageLabel, normalizeLifeStages } from '@/lib/lifeStages'
import type { MochiColor, TagCategory, WaveAnswers, WaveChoice } from '@/lib/types'

// ------------------------------------------------------------------ archetypes

export type WaveArchetypeId =
  | 'owl'
  | 'sunrise'
  | 'cat'
  | 'puppy'
  | 'wanderer'
  | 'foodie'
  | 'gamer'
  | 'binger'
  | 'artist'
  | 'bookworm'
  | 'party'
  | 'planner'
  | 'newcomer'
  | 'listener'
  | 'mochi'

export interface WaveArchetype {
  id: WaveArchetypeId
  /** decorative, always next to the title */
  emoji: string
  /** the card's colour */
  tone: MochiColor
  /** e.g. "นกฮูกสายชิล" (current language) */
  title: string
  /** one warm line about it (current language) */
  line: string
}

/** [question id, the side that fits, weight (default 1)] */
type QuizSignal = [id: string, side: WaveChoice, weight?: number]

interface Def {
  id: WaveArchetypeId
  emoji: string
  tone: MochiColor
  title: Txt
  line: Txt
  quiz: QuizSignal[]
  /** per tag in that category (loves count more) */
  cats?: Partial<Record<TagCategory, number>>
  /** per specific tag id, on top of its category */
  tags?: Record<string, number>
  /** per life stage (stored Thai value): a strong signal */
  stages?: Record<string, number>
}

const DEFS: readonly Def[] = [
  {
    id: 'owl',
    emoji: '🦉',
    tone: 'lavender',
    title: L('นกฮูกสายชิล', 'Chill Night Owl'),
    line: L('ยิ่งดึกยิ่งคุยเก่ง ชอบบรรยากาศเงียบๆ กับเพื่อนที่คุยกันได้ยาวๆ', 'Comes alive after dark and loves long, quiet late-night chats'),
    quiz: [['night-or-morning', 0, 2], ['home-or-out', 0, 0.8], ['sunrise-or-sunset', 1, 1], ['rain-or-sun', 0, 0.6], ['repeat-or-new-songs', 0, 0.4]],
    tags: { nightowl: 2.2 },
    stages: { ทำงานกะดึก: 3.2 },
  },
  {
    id: 'sunrise',
    emoji: '🌤️',
    tone: 'butter',
    title: L('นกน้อยตื่นเช้า', 'Bright Early Bird'),
    line: L('ตื่นมาพร้อมพลังบวก ชวนเดินเล่นรับแดดเช้าได้เสมอ', 'Up with the sun and always down for a morning stroll'),
    quiz: [['night-or-morning', 1, 2], ['sunrise-or-sunset', 0, 1.2], ['early-or-ontime', 0, 0.6], ['rain-or-sun', 1, 0.8], ['walk-or-bike', 0, 0.4]],
    cats: { outdoor: 0.4 },
    tags: { running: 1.4, plants: 0.6 },
  },
  {
    id: 'cat',
    emoji: '🐱',
    tone: 'pink',
    title: L('แมวเหมียวติดบ้าน', 'Cozy Homebody Cat'),
    line: L('บ้านคือที่ที่ดีที่สุด มีขนม ผ้าห่ม และเพื่อนรู้ใจก็ครบแล้ว', 'Home is the best place: snacks, a blanket and one good friend'),
    quiz: [['cat-or-dog', 0, 1.5], ['home-or-out', 0, 1.5], ['home-or-cafe-work', 0, 0.6], ['rain-or-sun', 0, 0.4], ['cook-or-order', 1, 0.4]],
    cats: { pet: 0.5 },
    tags: { cat: 1.6, cozygame: 1, plants: 0.6, crochet: 0.6 },
    stages: { ทำงานที่บ้าน: 2.6, อยู่คนเดียวครั้งแรก: 1 },
  },
  {
    id: 'puppy',
    emoji: '🐶',
    tone: 'peach',
    title: L('ลูกหมาพลังงานล้น', 'Golden Retriever Energy'),
    line: L('เจอใครก็ทักได้ ชวนไปไหนก็ไป ร่าเริงจนเพื่อนพลอยยิ้มตาม', 'Friendly with everyone, up for anything, and a mood booster for friends'),
    quiz: [['cat-or-dog', 1, 1.5], ['home-or-out', 1, 1.2], ['big-crew-or-few', 0, 1], ['solo-or-group-trip', 1, 0.8], ['reply-now-or-later', 0, 0.6]],
    cats: { pet: 0.5 },
    tags: { dog: 1.6, running: 0.6 },
  },
  {
    id: 'wanderer',
    emoji: '🎒',
    tone: 'mint',
    title: L('นักเดินทางสายลม', 'Free-Spirited Wanderer'),
    line: L('ไม่ต้องวางแผนเยอะ แค่มีเป้กับเพื่อนดีๆ ก็ออกเดินทางได้แล้ว', 'No big plans needed: a backpack and a good friend, and off you go'),
    quiz: [
      ['plan-or-flow', 1, 1.3],
      ['solo-or-group-trip', 0, 1],
      ['camping-or-hotel', 0, 1],
      ['sea-or-mountain', 1, 0.6],
      ['city-or-country', 1, 0.5],
      ['photos-or-moment', 1, 0.4],
    ],
    cats: { outdoor: 1.1 },
    tags: { travel: 1.4, hiking: 1, camping: 1 },
    stages: { เพิ่งกลับจากต่างประเทศ: 2.6, พักเบรกชีวิต: 2.6 },
  },
  {
    id: 'foodie',
    emoji: '🍜',
    tone: 'butter',
    title: L('สายกินตัวจริง', 'Certified Foodie'),
    line: L('รู้ว่าร้านไหนอร่อย ชวนไปกินทีไรไม่เคยผิดหวังสักครั้ง', 'Knows every good spot in town and never picks a bad one'),
    quiz: [['museum-or-market', 1, 1], ['cook-or-order', 0, 0.6], ['sweet-or-spicy', 1, 0.5], ['bubbletea-or-smoothie', 0, 0.3]],
    cats: { food: 1.4 },
    tags: { streetfood: 0.8, mookata: 0.8, baking: 0.6, cooking: 0.6 },
  },
  {
    id: 'gamer',
    emoji: '🎮',
    tone: 'lavender',
    title: L('เกมเมอร์คู่หู', 'Co-op Gamer Buddy'),
    line: L('ตี้ไหนขาดคนเรียกได้เลย เล่นได้ทั้งเกมชิลและเกมแข่ง', 'Always ready to queue up, from cozy games to ranked matches'),
    quiz: [['board-or-video-games', 1, 1.2], ['mobile-or-pc', 1, 0.4], ['night-or-morning', 0, 0.4], ['home-or-out', 0, 0.4]],
    cats: { game: 1.4 },
  },
  {
    id: 'binger',
    emoji: '📺',
    tone: 'sky',
    title: L('สายซีรีส์ใจฟู', 'Binge-Watch Buddy'),
    line: L('ดูจบทั้งซีซันได้ในคืนเดียว แล้วชวนเพื่อนมาอินด้วยกัน', 'Finishes a whole season in one night, then gets friends hooked too'),
    quiz: [['movie-or-series', 1, 1.4], ['home-or-out', 0, 0.6], ['anime-or-kdrama', 1, 0.5]],
    cats: { film: 1.4, anime: 0.8 },
  },
  {
    id: 'artist',
    emoji: '🎨',
    tone: 'pink',
    title: L('ศิลปินช่างฝัน', 'Dreamy Artist'),
    line: L('มองโลกเป็นสีพาสเทล เก็บความสวยงามเล็กๆ ไว้ในงานของตัวเอง', 'Sees the world in pastels and turns little moments into art'),
    quiz: [['photos-or-moment', 0, 0.8], ['museum-or-market', 0, 0.6], ['rain-or-sun', 0, 0.5], ['sunrise-or-sunset', 1, 0.5], ['repeat-or-new-songs', 1, 0.4]],
    cats: { art: 1.5, music: 0.3 },
    tags: { photography: 1.2, design: 1 },
  },
  {
    id: 'bookworm',
    emoji: '📚',
    tone: 'mint',
    title: L('หนอนหนังสือสายละมุน', 'Gentle Bookworm'),
    line: L('ชอบเรื่องเล่าดีๆ คุยกันลึกๆ กับคาเฟ่เงียบๆ สักที่', 'Loves a good story, deep talks and a quiet café'),
    quiz: [['books-or-podcasts', 0, 1.4], ['stickers-or-long', 1, 0.7], ['big-crew-or-few', 1, 0.6], ['home-or-cafe-work', 1, 0.5], ['coffee-or-tea', 1, 0.3]],
    cats: { book: 1.5, study: 0.4, lang: 0.4 },
    tags: { journaling: 0.8, lightnovel: 0.6 },
    stages: { นักศึกษา: 1.6 },
  },
  {
    id: 'party',
    emoji: '🎤',
    tone: 'peach',
    title: L('สายปาร์ตี้ตัวท็อป', 'Party Starter'),
    line: L('ที่ไหนมีเพลง ที่นั่นมีเรา ชวนร้องชวนเต้นได้ทั้งคืน', "Where there's music, there you are, singing and dancing all night"),
    quiz: [['home-or-out', 1, 1.2], ['big-crew-or-few', 0, 1], ['night-or-morning', 0, 0.4], ['repeat-or-new-songs', 1, 0.4]],
    cats: { music: 1.3 },
    tags: { concert: 1.4 },
  },
  {
    id: 'planner',
    emoji: '📒',
    tone: 'sky',
    title: L('นักวางแผนตัวจิ๋ว', 'Tiny Planner'),
    line: L('ตารางพร้อม เวลาเป๊ะ ไปไหนกับเราไม่มีหลงแน่นอน', 'Plans ready, always on time: nobody gets lost with you around'),
    quiz: [['plan-or-flow', 0, 1.5], ['early-or-ontime', 0, 1.1], ['reply-now-or-later', 0, 0.7], ['camping-or-hotel', 1, 0.5], ['night-or-morning', 1, 0.3]],
    cats: { study: 0.7 },
    tags: { cowork: 1, toeic: 0.8 },
    stages: { กำลังหางาน: 1.2 },
  },
  {
    id: 'newcomer',
    emoji: '🧳',
    tone: 'sky',
    title: L('ผู้มาใหม่ใจกล้า', 'Brave Newcomer'),
    line: L('กำลังเริ่มบทใหม่ของชีวิต พร้อมเจอเพื่อนใหม่และที่ใหม่ๆ', 'Starting a new chapter, ready for new friends and new places'),
    quiz: [['city-or-country', 0, 0.4], ['museum-or-market', 1, 0.3]],
    tags: { movedbkk: 2.6, firstjob: 1.6 },
    stages: { เพิ่งย้ายมาเมืองนี้: 3.6, อยู่คนเดียวครั้งแรก: 2.4, เริ่มงานแรก: 2.6, เพิ่งเปลี่ยนงาน: 2 },
  },
  {
    id: 'listener',
    emoji: '🫶',
    tone: 'mint',
    title: L('คนใจดีขี้ฟัง', 'Warm Listener'),
    line: L('ใจเย็น รับฟังเก่ง อยู่ด้วยแล้วสบายใจเหมือนได้กอดอุ่นๆ', 'Calm, a great listener, and as comforting as a warm hug'),
    quiz: [['stickers-or-long', 1, 1], ['big-crew-or-few', 1, 1], ['coffee-or-tea', 1, 0.5], ['reply-now-or-later', 0, 0.4]],
    tags: { listening: 2.6, astrology: 0.6, plants: 0.4 },
    stages: { พ่อแม่มือใหม่: 1.6, เพิ่งเกษียณ: 2 },
  },
]

/** When nothing stands out yet (a brand-new profile): soft and friendly, never "unknown". */
const FALLBACK: Def = {
  id: 'mochi',
  emoji: '🍡',
  tone: 'peach',
  title: L('โมจิใจฟู', 'Sweet Mochi'),
  line: L('นุ่มนิ่ม เป็นมิตร เข้ากับทุกคนได้ง่ายๆ', 'Soft, friendly and easy to get along with'),
  quiz: [],
}

const ALL = [...DEFS, FALLBACK]
const view = (d: Def): WaveArchetype => loc<WaveArchetype>({ id: d.id, emoji: d.emoji, tone: d.tone, title: d.title, line: d.line })
const VIEWS = new Map(ALL.map((d) => [d.id, view(d)]))

/** Every archetype (the fallback last). Read titles at render time (they follow the language). */
export const WAVE_ARCHETYPES: readonly WaveArchetype[] = ALL.map((d) => VIEWS.get(d.id)!)

/** An archetype by id (the fallback for an unknown one). */
export const waveArchetype = (id: string): WaveArchetype => VIEWS.get(id as WaveArchetypeId) ?? VIEWS.get('mochi')!

export interface WaveInput {
  /** keeps ties stable per person */
  id?: string
  tags?: readonly string[]
  loves?: readonly string[]
  lifeStages?: readonly string[]
  wave?: WaveAnswers
}

export interface MyWave {
  archetype: WaveArchetype
  /** up to 3 "จูนคลื่น" sides they picked that fit it best (current language) */
  picks: string[]
  /** what decided it: picks + profile, the profile alone (no picks yet), or nothing yet (the fallback) */
  basis: 'quiz' | 'profile' | 'starter'
}

/** below this nothing stands out: the fallback */
const MIN_SCORE = 0.9

function hashUnit(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10_000) / 10_000
}

function score(d: Def, wave: WaveAnswers, interests: readonly string[], loves: ReadonlySet<string>, stages: readonly string[]): number {
  let quiz = 0
  for (const [id, side, w = 1] of d.quiz) {
    const v = wave[id]
    if (v === undefined) continue
    quiz += v === side ? w : -w * 0.4
  }
  let tags = 0
  for (const id of interests) {
    const tag = tagOf(id)
    if (!tag) continue
    tags += ((d.cats?.[tag.category] ?? 0) + (d.tags?.[id] ?? 0)) * (loves.has(id) ? 1.6 : 1)
  }
  // many tags in one area add up, but level off: interests alone can't drown out the picks
  const fromTags = 4 * (1 - Math.exp(-tags / 3))
  let fromStages = 0
  for (const s of stages) fromStages += d.stages?.[s] ?? 0
  return quiz + fromTags + fromStages
}

/** A side's words for a question id and pick (undefined for a question no longer in the bank). */
function sideText(id: string, side: WaveChoice): string | undefined {
  const q = waveQuestion(id)
  return q ? (side === 0 ? q.a : q.b) : undefined
}

/**
 * "My wave": the archetype that fits someone best (deterministic: the same profile and picks
 * always give the same one), plus a few of their picks that show it. Works with few answers
 * (interests and life stage decide) and with none at all (the friendly fallback).
 */
export function myWave(input: WaveInput): MyWave {
  const wave = input.wave ?? {}
  const loves = new Set(input.loves ?? [])
  const interests = [...new Set([...(input.loves ?? []), ...(input.tags ?? [])])]
  const stages = normalizeLifeStages(input.lifeStages)
  const seed = input.id ?? ''
  let best: Def = FALLBACK
  let top = -Infinity
  for (const d of DEFS) {
    // a hair of per-person noise breaks exact ties the same way every time
    const s = score(d, wave, interests, loves, stages) + hashUnit(seed + d.id) * 0.01
    if (s > top) {
      top = s
      best = d
    }
  }
  if (top < MIN_SCORE) best = FALLBACK
  const answered = Object.keys(wave).filter((id) => waveQuestion(id))
  // the picks that fit the archetype first (strongest first), then their other picks in bank order
  const fitting = [...best.quiz]
    .sort((a, b) => (b[2] ?? 1) - (a[2] ?? 1))
    .filter(([id, side]) => wave[id] === side)
    .map(([id, side]) => sideText(id, side))
  const rest = answered.map((id) => sideText(id, wave[id]))
  const picks = [...new Set([...fitting, ...rest].filter((x): x is string => !!x))].slice(0, 3)
  const basis: MyWave['basis'] = best === FALLBACK ? 'starter' : answered.length ? 'quiz' : 'profile'
  return { archetype: VIEWS.get(best.id)!, picks, basis }
}

/** The interests a card shows: loves first, then the rest, up to `max` (labels in the current language). */
export function cardInterests(user: { tags?: readonly string[]; loves?: readonly string[] }, max = 3): { id: string; label: string; category: TagCategory }[] {
  const ids = [...new Set([...(user.loves ?? []), ...(user.tags ?? [])])]
  const out: { id: string; label: string; category: TagCategory }[] = []
  for (const id of ids) {
    const tag = tagOf(id)
    if (!tag) continue
    out.push({ id, label: tag.label, category: tag.category })
    if (out.length >= max) break
  }
  return out
}

/** The life stages a card shows (labels in the current language). */
export function cardLifeStages(stages: readonly string[] | undefined, max = 2): { value: string; label: string; emoji: string }[] {
  return normalizeLifeStages(stages)
    .slice(0, max)
    .map((value) => ({ value, label: lifeStageLabel(value), emoji: lifeStageEmoji(value) }))
}

// ------------------------------------------------------------------ the card image

export const WAVE_CARD_SIZE = { width: 1080, height: 1920 } as const
export const WAVE_CARD_FILENAME = 'moshimoshi-wave-card.png'

export interface WaveCardContent {
  name: string
  /** the mochi's colour (the person's own) */
  color: MochiColor
  /** the 2D mochi as standalone SVG markup: serializeMochi(<Avatar>'s svg) */
  mochiSvg: string
  wave: MyWave
  interests: { label: string; category: TagCategory }[]
  lifeStages: { label: string; emoji: string }[]
  /** the full link the card carries (compareLink) */
  link: string
}

/**
 * A rendered <Avatar>'s <svg> as standalone markup at `size` px, ready to draw on a canvas. Its
 * CSS blink (keyframes live in the app's stylesheet) is dropped, so the eyes are always open.
 */
export function serializeMochi(svg: SVGSVGElement, size = 560): string {
  const copy = svg.cloneNode(true) as SVGSVGElement
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  copy.setAttribute('width', String(size))
  copy.setAttribute('height', String(size))
  copy.removeAttribute('class')
  copy.querySelectorAll('[style]').forEach((n) => n.removeAttribute('style'))
  return new XMLSerializer().serializeToString(copy)
}

const EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"'
const DISPLAY = `Fredoka, Mali, ${EMOJI}, sans-serif`
const BODY = `Nunito, "IBM Plex Sans Thai Looped", ${EMOJI}, sans-serif`
const INK = '#3B2622'
const INK_SOFT = '#6E5550'
const LINE = '#F1DDD0'
const font = (weight: number, px: number, family: string) => `${weight} ${px}px ${family}`

/** The app's fonts (Thai subsets too) loaded for this text, or a few seconds passed. */
async function fontsFor(sample: string): Promise<void> {
  const fonts = document.fonts
  if (!fonts?.load) return
  const faces = [
    '600 80px Fredoka',
    '700 80px Fredoka',
    '600 80px Mali',
    '700 80px Mali',
    '500 40px Nunito',
    '700 40px Nunito',
    '500 40px "IBM Plex Sans Thai Looped"',
    '600 40px "IBM Plex Sans Thai Looped"',
  ]
  const all = Promise.all(faces.map((f) => fonts.load(f, sample).catch(() => []))).then(() => fonts.ready)
  await Promise.race([all, new Promise((ok) => window.setTimeout(ok, 4000))])
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, no) => {
    const img = new Image()
    img.onload = () => ok(img)
    img.onerror = () => no(new Error('mochi image failed'))
    img.src = src
  })
}

const segmenters = new Map<string, Intl.Segmenter | null>()
function segmenter(granularity: 'word' | 'grapheme'): Intl.Segmenter | null {
  const key = `${getLang()}:${granularity}`
  if (!segmenters.has(key)) {
    segmenters.set(key, typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(getLang(), { granularity }) : null)
  }
  return segmenters.get(key) ?? null
}

/** Word pieces (Thai has no spaces, so words come from the segmenter), spaces kept. */
function words(text: string): string[] {
  const s = segmenter('word')
  return s ? Array.from(s.segment(text), (x) => x.segment) : text.split(/(\s+)/).filter(Boolean)
}

function graphemes(text: string): string[] {
  const s = segmenter('grapheme')
  return s ? Array.from(s.segment(text), (x) => x.segment) : Array.from(text)
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text
  const g = graphemes(text)
  while (g.length && ctx.measureText(`${g.join('').trimEnd()}…`).width > maxW) g.pop()
  return `${g.join('').trimEnd()}…`
}

/** Greedy line breaks at word boundaries; the last kept line ends in "…" when it doesn't all fit. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const lines: string[] = []
  let line = ''
  const fits = (s: string) => ctx.measureText(s.trim()).width <= maxW
  for (const piece of words(text)) {
    if (fits(line + piece)) {
      line += piece
      continue
    }
    if (line.trim()) lines.push(line.trim())
    line = piece.trimStart()
    // one word wider than the line (a long name, a URL): break it by characters
    while (!fits(line)) {
      let cut = ''
      for (const g of graphemes(line)) {
        if (!fits(cut + g)) break
        cut += g
      }
      if (!cut) break
      lines.push(cut)
      line = line.slice(cut.length)
    }
  }
  if (line.trim()) lines.push(line.trim())
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  kept[maxLines - 1] = ellipsize(ctx, `${kept[maxLines - 1]} ${lines.slice(maxLines).join(' ')}`, maxW)
  return kept
}

/** The biggest size (min..max) at which `text` fits on one line. */
function fitSize(ctx: CanvasRenderingContext2D, text: string, weight: number, family: string, max: number, min: number, maxW: number): number {
  for (let px = max; px > min; px -= 2) {
    ctx.font = font(weight, px, family)
    if (ctx.measureText(text).width <= maxW) return px
  }
  ctx.font = font(weight, min, family)
  return min
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + k, y)
  ctx.arcTo(x + w, y, x + w, y + h, k)
  ctx.arcTo(x + w, y + h, x, y + h, k)
  ctx.arcTo(x, y + h, x, y, k)
  ctx.arcTo(x, y, x + w, y, k)
  ctx.closePath()
}

/** soft four-point sparkle */
function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const k = r * 0.28
  ctx.beginPath()
  ctx.moveTo(x, y - r)
  ctx.quadraticCurveTo(x + k, y - k, x + r, y)
  ctx.quadraticCurveTo(x + k, y + k, x, y + r)
  ctx.quadraticCurveTo(x - k, y + k, x - r, y)
  ctx.quadraticCurveTo(x - k, y - k, x, y - r)
  ctx.closePath()
  ctx.fill()
}

function rng(seed: string) {
  let a = Math.floor(hashUnit(seed) * 2 ** 31) || 1
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let x = Math.imul(a ^ (a >>> 15), 1 | a)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

interface Pill {
  text: string
  fill: string
  stroke: string
  ink: string
}

/** Pills in centred rows inside maxW; returns the height used. `draw` false only measures. */
function pills(ctx: CanvasRenderingContext2D, items: Pill[], cx: number, top: number, maxW: number, draw: boolean): number {
  const H = 74
  const PAD = 32
  const GAP = 16
  ctx.font = font(600, 34, BODY)
  const sized = items.map((p) => {
    const text = ellipsize(ctx, p.text, maxW - PAD * 2)
    return { ...p, text, w: Math.min(maxW, ctx.measureText(text).width + PAD * 2) }
  })
  const rows: (typeof sized)[] = []
  let row: typeof sized = []
  let width = 0
  for (const p of sized) {
    if (row.length && width + GAP + p.w > maxW) {
      rows.push(row)
      row = []
      width = 0
    }
    width += (row.length ? GAP : 0) + p.w
    row.push(p)
  }
  if (row.length) rows.push(row)
  if (draw) {
    rows.forEach((r, i) => {
      const total = r.reduce((n, p) => n + p.w, 0) + GAP * (r.length - 1)
      let x = cx - total / 2
      const y = top + i * (H + GAP)
      for (const p of r) {
        roundRect(ctx, x, y, p.w, H, H / 2)
        ctx.fillStyle = p.fill
        ctx.fill()
        ctx.lineWidth = 3
        ctx.strokeStyle = p.stroke
        ctx.stroke()
        ctx.fillStyle = p.ink
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(p.text, x + p.w / 2, y + H / 2 + 2)
        x += p.w + GAP
      }
    })
  }
  return rows.length ? rows.length * H + (rows.length - 1) * GAP : 0
}

/** The link as printed on the card: no "https://", no trailing slash. */
export const printedLink = (link: string) => link.replace(/^https?:\/\//, '').replace(/\/$/, '')

/**
 * Draws the story-size card (1080 × 1920) and returns it as a PNG. Key content stays inside the
 * middle 1080 × 1420 (Instagram / TikTok stories cover the top and bottom with their own UI).
 */
export async function renderWaveCard(card: WaveCardContent): Promise<Blob> {
  const { width: W, height: H } = WAVE_CARD_SIZE
  const { archetype } = card.wave
  const tone = MOCHI[archetype.tone]
  const texts = {
    badge: t('บัตรคลื่น', 'Wave card'),
    my: t('คลื่นของฉันคือ', 'My wave is'),
    likes: t('เรื่องที่ชอบ', 'Into'),
    stage: t('ช่วงชีวิตตอนนี้', 'Life right now'),
    picks: t('สายนี้เลย', 'Totally me'),
    cta: t('มาเทียบคลื่นกับเรากันไหม?', 'Want to compare waves with me?'),
    tagline: t('หาเพื่อนจากเรื่องที่ชอบ', 'Find friends through what you love'),
  }
  const sample = [card.name, archetype.title, archetype.line, ...Object.values(texts), ...card.interests.map((i) => i.label), ...card.lifeStages.map((s) => s.label), ...card.wave.picks, 'moshimoshi'].join(' ')
  await fontsFor(sample)
  const mochi = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(card.mochiSvg)}`)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d canvas')

  // background: the archetype's colour, soft blobs of the rest of the palette, a few sparkles
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, tone.light)
  bg.addColorStop(0.55, '#FFF7EE')
  bg.addColorStop(1, tone.base)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  const blobs: [number, number, number, MochiColor][] = [
    [140, 260, 420, 'butter'],
    [990, 620, 440, 'pink'],
    [90, 1380, 460, 'sky'],
    [1000, 1720, 420, 'mint'],
    [540, 1900, 380, archetype.tone],
  ]
  for (const [x, y, r, c] of blobs) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `${MOCHI[c].base}CC`)
    g.addColorStop(1, `${MOCHI[c].base}00`)
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  const rand = rng(card.link + archetype.id)
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  for (let i = 0; i < 16; i++) sparkle(ctx, 40 + rand() * (W - 80), 40 + rand() * (H - 80), 8 + rand() * 16)

  // top band (may sit under a story's own bar: decoration only)
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillStyle = INK
  ctx.font = font(600, 58, DISPLAY)
  ctx.fillText('moshimoshi', 84, 168)
  ctx.font = font(700, 32, BODY)
  const badge = `🌊 ${texts.badge}`
  const bw = ctx.measureText(badge).width + 56
  roundRect(ctx, W - 84 - bw, 136, bw, 66, 33)
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fill()
  ctx.fillStyle = INK
  ctx.textAlign = 'center'
  ctx.fillText(badge, W - 84 - bw / 2, 171)

  // the glass card
  const CX = 70
  const CY = 232
  const CW = W - CX * 2
  const CH = 1280
  const bottom = CY + CH
  ctx.save()
  ctx.shadowColor = 'rgba(59,38,34,0.18)'
  ctx.shadowBlur = 70
  ctx.shadowOffsetY = 28
  roundRect(ctx, CX, CY, CW, CH, 76)
  ctx.fillStyle = 'rgba(255,255,255,0.78)'
  ctx.fill()
  ctx.restore()
  roundRect(ctx, CX, CY, CW, CH, 76)
  ctx.lineWidth = 4
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'
  ctx.stroke()

  // wave rings behind the mochi (inside the card)
  const mx = W / 2
  const my = CY + 200
  ctx.save()
  roundRect(ctx, CX, CY, CW, CH, 76)
  ctx.clip()
  const halo = ctx.createRadialGradient(mx, my, 40, mx, my, 280)
  halo.addColorStop(0, `${tone.base}AA`)
  halo.addColorStop(1, `${tone.base}00`)
  ctx.fillStyle = halo
  ctx.fillRect(mx - 280, my - 280, 560, 560)
  ;[180, 226, 272].forEach((r, i) => {
    ctx.beginPath()
    ctx.arc(mx, my, r, 0, Math.PI * 2)
    ctx.lineWidth = 6 - i * 1.5
    ctx.setLineDash(i === 2 ? [4, 18] : [])
    ctx.strokeStyle = `${tone.shade}${['66', '44', '55'][i]}`
    ctx.stroke()
  })
  ctx.setLineDash([])
  ctx.restore()
  const MS = 300
  ctx.drawImage(mochi, mx - MS / 2, my - MS / 2 - 6, MS, MS)

  const inner = CW - 120
  let y = my + MS / 2 + 60

  // name
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = INK
  fitSize(ctx, card.name, 600, DISPLAY, 72, 48, inner)
  ctx.fillText(ellipsize(ctx, card.name, inner), mx, y)

  // "my wave is" + the archetype
  y += 58
  ctx.font = font(700, 32, BODY)
  ctx.fillStyle = INK_SOFT
  ctx.fillText(texts.my, mx, y)
  y += 22
  ctx.font = font(600, 76, DISPLAY)
  const title = wrap(ctx, `${archetype.emoji} ${archetype.title}`, inner - 40, 2)
  const pillH = title.length * 90 + 36
  const pillW = Math.min(inner + 40, Math.max(...title.map((l) => ctx.measureText(l).width)) + 96)
  roundRect(ctx, mx - pillW / 2, y, pillW, pillH, 50)
  ctx.fillStyle = tone.light
  ctx.fill()
  ctx.lineWidth = 4
  ctx.strokeStyle = tone.shade
  ctx.stroke()
  ctx.fillStyle = tone.ink
  ctx.textBaseline = 'middle'
  title.forEach((l, i) => ctx.fillText(l, mx, y + 18 + 45 + i * 90 + 4))
  y += pillH + 58

  // its line
  ctx.textBaseline = 'alphabetic'
  ctx.font = font(500, 38, BODY)
  ctx.fillStyle = INK_SOFT
  const line = wrap(ctx, archetype.line, inner - 20, 3)
  line.forEach((l, i) => ctx.fillText(l, mx, y + i * 52))
  y += (line.length - 1) * 52 + 40

  // dashed divider
  const divider = () => {
    ctx.beginPath()
    ctx.moveTo(CX + 90, y)
    ctx.lineTo(CX + CW - 90, y)
    ctx.lineWidth = 3
    ctx.setLineDash([14, 14])
    ctx.strokeStyle = LINE
    ctx.stroke()
    ctx.setLineDash([])
  }

  // optional blocks, in order, each only when it fits
  const blocks: { label: string; items: Pill[] }[] = []
  if (card.interests.length)
    blocks.push({
      label: texts.likes,
      items: card.interests.map((i) => {
        const c = MOCHI[CATEGORY_COLOR[i.category]]
        return { text: i.label, fill: c.light, stroke: c.base, ink: INK }
      }),
    })
  if (card.lifeStages.length)
    blocks.push({ label: texts.stage, items: card.lifeStages.map((s) => ({ text: `${s.emoji} ${s.label}`, fill: '#FFFFFF', stroke: tone.base, ink: INK })) })
  if (card.wave.picks.length)
    blocks.push({ label: texts.picks, items: card.wave.picks.map((p) => ({ text: p, fill: MOCHI.cream.light, stroke: MOCHI.cream.shade, ink: INK })) })
  let first = true
  for (const b of blocks) {
    const h = pills(ctx, b.items, mx, 0, inner, false)
    const need = (first ? 26 : 0) + 40 + 18 + h + 30
    if (y + need > bottom - 24) break
    if (first) {
      divider()
      y += 26
      first = false
    }
    y += 40
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.font = font(700, 30, BODY)
    ctx.fillStyle = INK_SOFT
    ctx.fillText(b.label, mx, y)
    y += 18
    y += pills(ctx, b.items, mx, y, inner, true) + 30
  }

  // the invitation and the link (inside the story-safe middle)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = INK
  fitSize(ctx, texts.cta, 600, DISPLAY, 50, 36, W - 140)
  ctx.fillText(texts.cta, W / 2, bottom + 64)
  const printed = printedLink(card.link)
  const lp = fitSize(ctx, printed, 700, BODY, 34, 22, W - 220)
  ctx.font = font(700, lp, BODY)
  const lw = Math.min(W - 120, ctx.measureText(printed).width + 90)
  const ly = bottom + 94
  ctx.save()
  ctx.shadowColor = 'rgba(59,38,34,0.14)'
  ctx.shadowBlur = 30
  ctx.shadowOffsetY = 10
  roundRect(ctx, W / 2 - lw / 2, ly, lw, 76, 38)
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()
  ctx.restore()
  roundRect(ctx, W / 2 - lw / 2, ly, lw, 76, 38)
  ctx.lineWidth = 4
  ctx.strokeStyle = '#FF7A6B'
  ctx.stroke()
  ctx.fillStyle = INK
  ctx.textBaseline = 'middle'
  ctx.fillText(printed, W / 2, ly + 40)

  // footer (decoration: may sit under a story's reply bar)
  ctx.textBaseline = 'alphabetic'
  ctx.font = font(600, 34, BODY)
  ctx.fillStyle = INK_SOFT
  ctx.fillText(texts.tagline, W / 2, H - 140)

  return new Promise((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error('toBlob failed'))), 'image/png'))
}

// ------------------------------------------------------------------ sharing

/** The card as a file for the Web Share API. */
export const waveCardFile = (blob: Blob) => new File([blob], WAVE_CARD_FILENAME, { type: 'image/png' })

/** This browser can share this file (Web Share level 2). */
export function canShareFile(file: File): boolean {
  try {
    return typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
  } catch {
    return false
  }
}

/** This browser has a share sheet at all (for a link). */
export const canShareLink = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function'

export type ShareOutcome = 'shared' | 'cancelled' | 'failed'

/**
 * Opens the share sheet with the card image (and the link in the text), or with the link only.
 * Call it straight from the tap (no awaits before it): Safari needs the tap to still be "fresh".
 */
export async function shareWaveCard({ file, link, text }: { file?: File; link: string; text: string }): Promise<ShareOutcome> {
  try {
    if (file && canShareFile(file)) await navigator.share({ files: [file], text: `${text} ${link}` })
    else await navigator.share({ text, url: link })
    return 'shared'
  } catch (err) {
    return err instanceof DOMException && err.name === 'AbortError' ? 'cancelled' : 'failed'
  }
}

/** Saves the card image (a download; on iPhone it opens the preview to save to Photos). */
export function downloadBlob(blob: Blob, filename = WAVE_CARD_FILENAME) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
