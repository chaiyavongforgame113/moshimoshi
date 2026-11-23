// "ช่วงชีวิต" (life stages): where someone is in life right now, e.g. just moved to the city, a
// first job, night shifts. Shown on the profile and a strong wave signal
// ("ช่วงชีวิตเดียวกัน") when two people share one.
//
// Values are stored in Thai (profiles.life_stages): the `value` of an option below, or text the
// person typed themselves ("อื่นๆ", via OwnOption), 1–40 characters. Never rename a value: it's
// what people already saved. English lives next to each value here (L) and in i18n/known.ts, so a
// stored value always reads in the current language with lifeStageLabel() / known().
import { known, L, tx, type Txt } from '@/lib/i18n'

/** at most this many per person (the database checks the same) */
export const LIFE_STAGE_MAX = 6
/** one stage's length, own text included (the database checks the same) */
export const LIFE_STAGE_TEXT_MAX = 40

export interface LifeStageOption {
  /** stored as is (Thai) */
  value: string
  /** decorative, always next to the words */
  emoji: string
  label: Txt
}

/** The list people pick from, in this order; "อื่นๆ" (type your own) comes after it. */
export const LIFE_STAGES: readonly LifeStageOption[] = [
  { value: 'เพิ่งย้ายมาเมืองนี้', emoji: '🧳', label: L('เพิ่งย้ายมาเมืองนี้', 'Just moved to the city') },
  { value: 'เริ่มงานแรก', emoji: '🎓', label: L('เริ่มงานแรก (First Jobber)', 'First jobber') },
  { value: 'นักศึกษา', emoji: '📚', label: L('นักศึกษา', 'Student') },
  { value: 'ทำงานกะดึก', emoji: '🌙', label: L('ทำงานกะดึก', 'Working night shifts') },
  { value: 'ทำงานที่บ้าน', emoji: '🏠', label: L('ทำงานที่บ้าน (WFH)', 'Working from home') },
  { value: 'ฟรีแลนซ์', emoji: '💻', label: L('ฟรีแลนซ์', 'Freelancer') },
  { value: 'เพิ่งเปลี่ยนงาน', emoji: '🔄', label: L('เพิ่งเปลี่ยนงาน', 'Just changed jobs') },
  { value: 'กำลังหางาน', emoji: '🔍', label: L('กำลังหางาน', 'Looking for work') },
  { value: 'อยู่คนเดียวครั้งแรก', emoji: '🔑', label: L('อยู่คนเดียวครั้งแรก', 'Living alone for the first time') },
  { value: 'พ่อแม่มือใหม่', emoji: '🍼', label: L('พ่อแม่มือใหม่', 'New parent') },
  { value: 'เพิ่งกลับจากต่างประเทศ', emoji: '✈️', label: L('เพิ่งกลับจากต่างประเทศ', 'Just back from abroad') },
  { value: 'พักเบรกชีวิต', emoji: '🌈', label: L('พักเบรกชีวิต (Gap year)', 'Taking a gap year') },
  { value: 'เพิ่งเกษียณ', emoji: '🌿', label: L('เพิ่งเกษียณ', 'Newly retired') },
]

const BY_VALUE = new Map(LIFE_STAGES.map((o) => [o.value, o]))

/** One of the list's values (not typed by the person). */
export const isListedLifeStage = (value: string): boolean => BY_VALUE.has(value)

/** The option for a stored value (undefined for one the person typed). */
export const lifeStageOption = (value: string): LifeStageOption | undefined => BY_VALUE.get(value)

/** A stored value in the current language (typed ones stay as typed). */
export function lifeStageLabel(value: string): string {
  const o = BY_VALUE.get(value)
  return o ? tx(o.label) : known(value)
}

/** Its emoji (a sparkle for typed ones). */
export const lifeStageEmoji = (value: string): string => BY_VALUE.get(value)?.emoji ?? '✨'

/** Same stage, ignoring case and spaces (typed ones are compared too). */
const keyOf = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('th')

/**
 * What the database accepts: trimmed, 1–40 characters, no repeats, up to LIFE_STAGE_MAX (the first ones
 * win). Use it before setLifeStages (the store action does it too).
 */
export function normalizeLifeStages(list: readonly string[] | undefined): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of list ?? []) {
    const v = [...raw.trim().replace(/\s+/g, ' ')].slice(0, LIFE_STAGE_TEXT_MAX).join('').trim()
    const k = keyOf(v)
    if (!v || seen.has(k)) continue
    seen.add(k)
    out.push(v)
    if (out.length >= LIFE_STAGE_MAX) break
  }
  return out
}

/** Stages both people share ("ช่วงชีวิตเดียวกัน"), in a's order, as a stored them. */
export function sharedLifeStages(a: readonly string[] | undefined, b: readonly string[] | undefined): string[] {
  if (!a?.length || !b?.length) return []
  const theirs = new Set(b.map(keyOf))
  return a.filter((v) => theirs.has(keyOf(v)))
}
