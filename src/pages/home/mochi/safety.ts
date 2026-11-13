import { L, loc } from '@/lib/i18n'

/*
 * A gentle safety net for the chat with Little Mochi. When someone types words
 * about hurting themselves, ending their life or wanting to disappear, Mochi
 * stops the script, answers softly and shows the hotlines below.
 * It errs on the side of showing them: a kind card on a false alarm costs nothing.
 */

/**
 * Thai phrasings, matched with spaces and zero-width marks removed ("อยาก ตาย", "อยากตายยย").
 * Words that also have an everyday meaning ("จบชีวิตโสด", "ลาโลกโซเชียล") live in THAI_RE
 * instead, with their harmless follow-ups left out.
 */
const THAI = [
  'อยากตาย',
  'อยากจะตาย',
  'อยากไปตาย',
  'ตายไปคงดี',
  'ตายไปก็ดี',
  'ตายไปดีกว่า',
  'ตายไปซะ',
  'ตายๆไปซะ',
  'ตายๆไปเถอะ',
  'ไม่อยากอยู่บนโลก',
  'ไม่อยากอยู่ในโลก',
  'ไม่อยากมีชีวิต',
  'ไม่อยากหายใจ',
  'ไม่อยากตื่นขึ้นมา',
  'ไม่อยากตื่นอีก',
  'ไม่อยากเกิดมา',
  'ไม่น่าเกิดมา',
  'ไม่ควรเกิดมา',
  'เกิดมาทำไม',
  'อยู่ไปทำไม',
  'อยู่ไปก็ไม่มีความหมาย',
  'อยู่ไปก็เท่านั้น',
  'อยากจบทุกอย่าง',
  'หลับไปไม่ตื่น',
  'หลับแล้วไม่ตื่น',
  'ฆ่าตัวตาย',
  'ฆ่าตัวเอง',
  'ทำร้ายตัวเอง',
  'ทำร้ายร่างกายตัวเอง',
  'ทำร้ายตนเอง',
  'หายไปจากโลก',
  'อยากหายไป',
  'ปลิดชีพ',
  'กรีดแขน',
  'กรีดข้อมือ',
  'กรีดตัวเอง',
  'กินยาตาย',
  'กินยาเกินขนาด',
  'โดดตึก',
  'กระโดดตึก',
  'ผูกคอ',
]

/** what follows "จบชีวิต" when it means a chapter of life ("จบชีวิตมหาลัย"), not a life */
const LIFE_CHAPTER = ['โสด', 'คนโสด', 'นักศึกษา', 'นักเรียน', 'มหาลัย', 'มหาวิทยาลัย', 'มอ', 'ม.', 'มัธยม', 'วัยเรียน', 'วัยรุ่น', 'เด็ก', 'ฝึกงาน', 'ทำงาน', 'การทำงาน', 'พนักงาน', 'ข้าราชการ', 'ในรั้ว', 'การเป็น', 'หนุ่ม', 'สาว']
/** what follows "ลาโลก" when it means logging off ("ลาโลกโซเชียลสักพัก") */
const LOG_OFF = ['โซเชียล', 'โซเชี่ยล', 'ออนไลน์', 'social', 'ไซเบอร์', 'เกม', 'ทวิต', 'เฟส', 'ไอจี', 'ig', 'อินเทอร์เน็ต', 'เน็ต']

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const notFollowedBy = (words: string[]) => `(?!${words.map(escape).join('|')})`

const THAI_RE = [
  // "ไม่อยากอยู่แล้ว", "ไม่อยากอยู่อีกต่อไปแล้ว", "ไม่อยากจะอยู่ต่อ"
  /ไม่อยาก(?:จะ|ที่จะ)?(?:มีชีวิต)?อยู่(?:อีก|ต่อ|แล้ว)/,
  // "อยากหลับไปเลยไม่ต้องตื่น"
  /อยากหลับ.{0,6}ไม่(?:ต้อง)?ตื่น/,
  new RegExp(`จบชีวิต${notFollowedBy(LIFE_CHAPTER)}`),
  new RegExp(`ลาโลก${notFollowedBy(LOG_OFF)}`),
]

/** "don't" / "dont" / "do not", and "want to" / "wanna" */
const DONT = String.raw`do\s*n[o']?t`
const WANT = String.raw`(?:want|wanna|wanted|wanting)\s+(?:to\s+)?`

/** English phrasings, matched on whole words. */
const ENGLISH = [
  /\bkill(?:ing)?\s*my\s*self\b/,
  /\bkms\b/,
  /\bsuicid(?:e|al)\b/,
  /\bunaliv/,
  new RegExp(String.raw`\b${WANT}die\b`),
  /\bend(?:ing)?\s+(?:it\s+all|my\s+life|everything)\b/,
  /\b(?:want|wanna|gonna|going\s+to|ready\s+to|about\s+to)\s+(?:to\s+)?end\s+it\b/,
  /\btake\s+my\s+(?:own\s+)?life\b/,
  /\b(?:hurt|hurting|harm|harming|cut|cutting)\s+my\s*self\b/,
  /\bself[\s-]?harm/,
  new RegExp(String.raw`\b${DONT}\s+${WANT}(?:live|be\s+alive|exist|be\s+here\s+anymore|wake\s+up)\b`),
  /\bwish\s+i\s+(?:was|were)\s+(?:dead|never\s+born)\b/,
  /\bwish\s+i\s+(?:wasn't|weren't)\s+(?:alive|born|here)\b/,
  /\bwish\s+i\s+(?:could\s+)?(?:die|disappear)\b/,
  new RegExp(String.raw`\b${WANT}disappear\b`),
  /\bdisappear\s+(?:forever|from\s+the\s+world)\b/,
  /\bno\s+reason\s+to\s+(?:live|be\s+alive)\b/,
  /\bno\s+point\s+(?:in\s+)?(?:living|being\s+alive)\b/,
  /\bnothing\s+(?:left\s+)?to\s+live\s+for\b/,
  /\bbetter\s+off\s+(?:dead|without\s+me)\b/,
  /\boverdos(?:e|ing)\b/,
]

const INVISIBLE = /[\s​-‍⁠﻿]+/g

/** True when the text sounds like someone may be thinking about harming themselves. */
export function needsCare(text: string): boolean {
  const thai = text.replace(INVISIBLE, '').replace(/ๆ+/g, 'ๆ').toLowerCase()
  if (THAI.some((p) => thai.includes(p)) || THAI_RE.some((p) => p.test(thai))) return true
  const english = text.toLowerCase().replace(/[‘’`]/g, "'").replace(/\s+/g, ' ')
  return ENGLISH.some((p) => p.test(english))
}

export interface Hotline {
  number: string
  name: string
  note: string
}

/** Thailand: the Department of Mental Health line, then emergency medical services. */
export const HOTLINES: Hotline[] = [
  loc<Hotline>({
    number: '1323',
    name: L('สายด่วนสุขภาพจิต', 'Mental health hotline'),
    note: L('ฟรี มีคนรับฟังตลอด 24 ชม.', 'Free, someone listens 24 hours a day'),
  }),
  loc<Hotline>({
    number: '1669',
    name: L('แจ้งเหตุฉุกเฉิน', 'Emergency medical help'),
    note: L('ถ้าตอนนี้กำลังอยู่ในอันตราย', "If you're in danger right now"),
  }),
]
