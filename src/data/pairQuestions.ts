// The question pair ("คำถามคู่") in an intro chat: Mochi asks both people the same question, each
// answers privately, and the answers open for both at once (the database holds them back until
// both have answered). Also Mochi's own lines, which the database writes in Thai.
//
// Ids are stored with the answers (chat_pair_answers.question_id, chats.pair_question): never rename
// or reuse one, add new questions at the end. Format: [a-z0-9-], up to 40 characters.
import { L, loc, type Txt } from '@/lib/i18n'
import type { ChatMessage, PairQuestion } from '@/lib/types'

type Def = [id: string, text: Txt, hint: Txt, demo: string]

const DEFS: readonly Def[] = [
  ['perfect-sunday', L('วันอาทิตย์ในฝันของเธอเป็นยังไง', 'What does your perfect Sunday look like?'), L('เช่น ตื่นสาย ไปคาเฟ่ใหม่ แล้วนอนดูซีรีส์', 'e.g. sleep in, try a new café, then binge a show'), 'ตื่นสาย ทำแพนเค้กกินเอง แล้วเล่นเกมยาวๆ ทั้งบ่าย'],
  ['small-joy', L('เรื่องเล็กๆ ที่ทำให้ยิ้มได้ทั้งวันคืออะไร', "What's a small thing that makes your whole day?"), L('เช่น เจอแมวข้างทาง ได้ที่นั่งริมหน้าต่าง', 'e.g. spotting a street cat, getting the window seat'), 'ได้ยินเพลงที่ชอบในร้านกาแฟโดยไม่ได้ตั้งใจ'],
  ['recent-obsession', L('ช่วงนี้อินอะไรเป็นพิเศษ', "What are you really into lately?"), L('เช่น ซีรีส์ เกม งานอดิเรกใหม่', 'e.g. a show, a game, a new hobby'), 'ปลูกต้นไม้ในห้อง ตอนนี้มีสิบกระถางแล้ว'],
  ['dream-trip', L('ถ้าได้ไปเที่ยวที่ไหนก็ได้พรุ่งนี้ อยากไปไหน', 'If you could travel anywhere tomorrow, where would you go?'), L('บอกเหตุผลด้วยก็ได้นะ', 'Tell us why, if you like'), 'ฮอกไกโด อยากเห็นหิมะตกจริงๆ สักครั้ง'],
  ['comfort-food', L('เมนูปลอบใจเวลาเหนื่อยๆ ของเธอคืออะไร', "What's your comfort food after a long day?"), L('เช่น ข้าวไข่เจียว มาม่าใส่ไข่', 'e.g. a Thai omelet on rice, instant noodles with an egg'), 'ข้าวต้มร้อนๆ ตอนดึก'],
  ['song-on-repeat', L('เพลงที่วนฟังอยู่ตอนนี้คือเพลงอะไร', "What song do you have on repeat right now?"), L('ชื่อเพลงกับศิลปินก็พอ', 'Just the song and the artist'), 'เพลงประกอบอนิเมะที่เพิ่งดูจบ ฟังทุกเช้าเลย'],
  ['learn-next', L('ถ้ามีเวลาว่างเยอะๆ อยากลองเรียนอะไรใหม่', 'With lots of free time, what would you love to learn?'), L('เช่น ภาษา ดนตรี ทำอาหาร', 'e.g. a language, an instrument, cooking'), 'อยากเล่นอูคูเลเล่ให้เป็นสักเพลง'],
  ['cozy-place', L('ที่ไหนที่อยู่แล้วสบายใจที่สุด', 'Where do you feel most at ease?'), L('ที่จริงหรือในจินตนาการก็ได้', 'A real place or an imagined one'), 'มุมโซฟาข้างหน้าต่าง ตอนฝนตก'],
  ['childhood-snack', L('ขนมวัยเด็กที่ยังคิดถึงอยู่คืออะไร', 'Which childhood snack do you still miss?'), L('ยิ่งเฉพาะเจาะจงยิ่งดี', 'The more specific, the better'), 'ขนมปังปี๊บกับนมเย็นหน้าโรงเรียน'],
  ['proud-lately', L('เรื่องที่ภูมิใจในตัวเองเมื่อเร็วๆ นี้', "What's something you're proud of lately?"), L('เรื่องเล็กแค่ไหนก็นับนะ', 'Small wins count too'), 'ตื่นเช้าไปออกกำลังกายได้ครบอาทิตย์'],
  ['weekend-plan', L('ถ้าได้ชวนกันทำอะไรสักอย่างสุดสัปดาห์นี้ อยากชวนทำอะไร', 'If you could invite each other to one thing this weekend, what would it be?'), L('ออนไลน์หรือนอกบ้านก็ได้', 'Online or out and about'), 'ตี้เกมชิลๆ คืนวันเสาร์'],
  ['superpower', L('ถ้ามีพลังพิเศษได้หนึ่งอย่าง อยากได้อะไร', 'If you could have one superpower, what would it be?'), L('และจะเอาไปใช้ทำอะไร', 'And what would you use it for?'), 'หยุดเวลาได้ จะได้นอนต่ออีกห้านาทีทุกเช้า'],
]

/** The bank, in order. Read `text` / `hint` at render time (they follow the language). */
export const PAIR_QUESTIONS: readonly PairQuestion[] = DEFS.map(([id, text, hint]) => loc<PairQuestion>({ id, text, hint }))

const BY_ID = new Map(PAIR_QUESTIONS.map((q) => [q.id, q]))

/** A question by id (undefined for one no longer in the bank). */
export const pairQuestion = (id: string | undefined): PairQuestion | undefined => (id ? BY_ID.get(id) : undefined)

/** A question for a new intro chat (respondIntro sends its id). */
export function pickPairQuestion(seed = Math.random()): PairQuestion {
  return PAIR_QUESTIONS[Math.floor(Math.abs(seed) * PAIR_QUESTIONS.length) % PAIR_QUESTIONS.length]
}

/** Demo: what a sample person answers (Thai, like what people type). */
export const demoPairAnswer = (id: string): string => DEFS.find((d) => d[0] === id)?.[3] ?? 'อันนี้ตอบยากแฮะ แต่ชอบคำถามนี้นะ'

/** The most characters one answer may have (the database checks the same). */
export const PAIR_ANSWER_MAX = 300

// ------------------------------------------------------------------ Mochi's lines

/**
 * Mochi's lines in an intro chat, exactly as the database writes them (private.mochi_line): show
 * them with known(), which has the English. `intro` opens the chat (the app shows the intro card from
 * each person's side next to it), `ask` brings the question pair, `bye` comes once both answered.
 */
export const MOCHI_LINES = {
  intro: 'โมชิแนะนำให้ทั้งคู่รู้จักกันแล้วนะ ลองดูกันว่าคลื่นตรงกันตรงไหนบ้าง',
  ask: 'โมชิมีคำถามมาให้ทั้งคู่ตอบ คำตอบจะเปิดให้เห็นพร้อมกันตอนที่ตอบครบทั้งสองคนนะ',
  bye: 'โมชิขอตัวก่อนนะ คุยกันให้สนุก',
} as const

export type MochiStep = keyof typeof MOCHI_LINES

const STEPS = new Map<string, MochiStep>(Object.entries(MOCHI_LINES).map(([k, v]) => [v, k as MochiStep]))

/** Which of Mochi's lines a message is (undefined for anything else). */
export function mochiStep(m: Pick<ChatMessage, 'kind' | 'text'>): MochiStep | undefined {
  return m.kind === 'mochi' ? STEPS.get(m.text.trim()) : undefined
}
