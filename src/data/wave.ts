// "จูนคลื่น" (this or that): the question bank. Questions live here in both languages; the database
// keeps only which side each person picked (public.wave_answers, choice 0 = `a`, 1 = `b`). A round
// is 8 questions and a new round starts every Monday (Asia/Bangkok), going round the bank.
//
// Ids are stored with people's picks: never rename or reuse one (add new questions at the end of
// a round's block instead). Format: [a-z0-9-], up to 40 characters (the database checks it).
import { L, loc, type Txt } from '@/lib/i18n'

export interface WaveQuestion {
  id: string
  /** side 0 */
  a: string
  /** side 1 */
  b: string
}

type Def = [id: string, a: Txt, b: Txt]

const q = ([id, a, b]: Def): WaveQuestion => loc<WaveQuestion>({ id, a, b })

/** Every question, in round order (8 per round). Read the sides at render time (they follow the language). */
export const WAVE_QUESTIONS: readonly WaveQuestion[] = (
  [
    // round 1
    ['sea-or-mountain', L('ทะเล', 'The beach'), L('ภูเขา', 'The mountains')],
    ['night-or-morning', L('นอนดึก', 'Night owl'), L('ตื่นเช้า', 'Early bird')],
    ['mobile-or-pc', L('เกมมือถือ', 'Mobile games'), L('เกม PC', 'PC games')],
    ['cat-or-dog', L('ทาสแมว', 'Cat person'), L('ทาสหมา', 'Dog person')],
    ['coffee-or-tea', L('กาแฟ', 'Coffee'), L('ชา', 'Tea')],
    ['home-or-out', L('อยู่บ้านชิลๆ', 'Cozy night in'), L('ออกไปเที่ยว', 'Night out')],
    ['sweet-or-spicy', L('ของหวาน', 'Sweet'), L('ของเผ็ด', 'Spicy')],
    ['stickers-or-long', L('ส่งสติกเกอร์', 'Stickers'), L('พิมพ์ยาวๆ', 'Long messages')],
    // round 2
    ['movie-or-series', L('ดูหนังจบในเรื่อง', 'A movie'), L('ดูซีรีส์ยาวๆ', 'Binge a series')],
    ['plan-or-flow', L('วางแผนก่อน', 'Plan ahead'), L('ไปแบบไม่วางแผน', 'Go with the flow')],
    ['rain-or-sun', L('วันฝนตก', 'Rainy days'), L('วันแดดออก', 'Sunny days')],
    ['city-or-country', L('ชีวิตในเมือง', 'City life'), L('ชีวิตต่างจังหวัด', 'Countryside life')],
    ['books-or-podcasts', L('อ่านหนังสือ', 'Books'), L('ฟังพอดแคสต์', 'Podcasts')],
    ['karaoke-or-dance', L('ร้องคาราโอเกะ', 'Karaoke'), L('ออกไปเต้น', 'Dancing')],
    ['cook-or-order', L('ทำอาหารเอง', 'Cook at home'), L('สั่งเดลิเวอรี', 'Order in')],
    ['hot-or-cool', L('หน้าร้อน', 'Hot season'), L('หน้าหนาว', 'Cool season')],
    // round 3
    ['solo-or-group-trip', L('เที่ยวคนเดียว', 'Solo trips'), L('เที่ยวเป็นแก๊ง', 'Group trips')],
    ['sunrise-or-sunset', L('พระอาทิตย์ขึ้น', 'Sunrise'), L('พระอาทิตย์ตก', 'Sunset')],
    ['noodles-or-somtam', L('ก๋วยเตี๋ยว', 'Noodle soup'), L('ส้มตำ', 'Som tam')],
    ['anime-or-kdrama', L('อนิเมะ', 'Anime'), L('ซีรีส์เกาหลี', 'K-dramas')],
    ['early-or-ontime', L('ไปถึงก่อนเวลา', 'Always early'), L('ไปถึงพอดีเวลา', 'Right on time')],
    ['bubbletea-or-smoothie', L('ชานมไข่มุก', 'Bubble tea'), L('น้ำผลไม้ปั่น', 'Fruit smoothie')],
    ['horror-or-comedy', L('หนังผี', 'Horror'), L('หนังตลก', 'Comedy')],
    ['repeat-or-new-songs', L('ฟังเพลงเดิมวนไป', 'Same songs on repeat'), L('หาเพลงใหม่ตลอด', 'Always new music')],
    // round 4
    ['camping-or-hotel', L('กางเต็นท์', 'Camping'), L('นอนโรงแรม', 'Hotels')],
    ['reply-now-or-later', L('ตอบแชททันที', 'Reply right away'), L('ตอบตอนว่าง', 'Reply when free')],
    ['walk-or-bike', L('เดินเล่น', 'Walking'), L('ปั่นจักรยาน', 'Cycling')],
    ['museum-or-market', L('พิพิธภัณฑ์', 'Museums'), L('ตลาดนัดกลางคืน', 'Night markets')],
    ['home-or-cafe-work', L('ทำงานที่บ้าน', 'Work from home'), L('ทำงานที่คาเฟ่', 'Work at a café')],
    ['photos-or-moment', L('ถ่ายรูปเก็บไว้', 'Take photos'), L('เก็บไว้ในความทรงจำ', 'Just live the moment')],
    ['board-or-video-games', L('บอร์ดเกม', 'Board games'), L('วิดีโอเกม', 'Video games')],
    ['big-crew-or-few', L('แก๊งใหญ่', 'A big crew'), L('เพื่อนสนิทไม่กี่คน', 'A few close friends')],
  ] satisfies Def[]
).map(q)

export const WAVE_ROUND_SIZE = 8

const BY_ID = new Map(WAVE_QUESTIONS.map((x) => [x.id, x]))

/** A question by id (undefined for one that's no longer in the bank). */
export const waveQuestion = (id: string): WaveQuestion | undefined => BY_ID.get(id)

/** Every id in the bank (the live loader asks the server for picks on these only). */
export const WAVE_IDS: readonly string[] = WAVE_QUESTIONS.map((x) => x.id)

const DAY = 86_400_000
const BKK = 7 * 3_600_000
/** Monday 2026-01-05 00:00 in Bangkok: week 0 */
const WEEK0 = Date.UTC(2026, 0, 5) - BKK

/** This week's round number (it changes every Monday 00:00 Asia/Bangkok). */
export function waveWeek(now = Date.now()): number {
  return Math.floor((now - WEEK0) / (7 * DAY))
}

/** This week's 8 questions. */
export function waveRound(now = Date.now()): WaveQuestion[] {
  const rounds = Math.max(1, Math.floor(WAVE_QUESTIONS.length / WAVE_ROUND_SIZE))
  const r = ((waveWeek(now) % rounds) + rounds) % rounds
  return WAVE_QUESTIONS.slice(r * WAVE_ROUND_SIZE, (r + 1) * WAVE_ROUND_SIZE)
}

/** When the next round starts (ms): next Monday 00:00 Asia/Bangkok. */
export function nextWaveRoundAt(now = Date.now()): number {
  return WEEK0 + (waveWeek(now) + 1) * 7 * DAY
}
