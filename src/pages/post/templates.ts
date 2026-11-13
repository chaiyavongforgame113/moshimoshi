import {
  CalendarDays,
  CalendarClock,
  Ear,
  Gamepad2,
  HandHelping,
  InfinityIcon,
  Languages,
  Lightbulb,
  Luggage,
  MessagesSquare,
  MoonStar,
  NotebookPen,
  Repeat2,
  Sprout,
  Ticket,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { known, L, loc } from '@/lib/i18n'
import type { IntentRole, IntentTemplate, IntentWhen, MochiColor } from '@/lib/types'

export interface TemplateDef {
  key: IntentTemplate
  label: string
  /** one line under the label on the big pick card */
  hint: string
  Icon: LucideIcon
  color: MochiColor
  role: IntentRole
  mode: 'online' | 'offline'
  when: IntentWhen
  example: string
  /** activity tags suggested first in the picker */
  tags: string[]
}

export const TEMPLATES: TemplateDef[] = [
  loc<TemplateDef>({
    key: 'play',
    label: L('เล่นเกมด้วยกัน', 'Play games together'),
    hint: L('ลงเกมด้วยกัน จะแรงค์หรือชิลก็ได้', 'Squad up, ranked or just chill'),
    Icon: Gamepad2,
    color: 'lavender',
    role: 'peer',
    mode: 'online',
    when: 'tonight',
    example: L('หาเพื่อนเล่น Valorant ตอนดึก ชิลๆ ไม่ toxic', 'Looking for late-night Valorant buddies, chill and no toxicity'),
    tags: ['valorant', 'rov', 'genshin', 'minecraft', 'cozygame', 'pokemon', 'boardgame'],
  }),
  loc<TemplateDef>({
    key: 'talk',
    label: L('คุยเรื่อง…', 'Talk about…'),
    hint: L('คุยเรื่องที่ชอบกับคนที่อินเหมือนกัน', 'Geek out with someone just as into it'),
    Icon: MessagesSquare,
    color: 'pink',
    role: 'peer',
    mode: 'online',
    when: 'anytime',
    example: L('อยากมีคนคุยเรื่องนิยายสืบสวนญี่ปุ่น ชอบฮิงาชิโนะ', 'Want someone to talk Japanese mystery novels with. Big Higashino fan'),
    tags: ['frieren', 'onepiece', 'ghibli', 'kdrama', 'mystery', 'horror', 'astrology'],
  }),
  loc<TemplateDef>({
    key: 'lang',
    label: L('ฝึก / แลกภาษา', 'Practice / swap languages'),
    hint: L('หาคู่ฝึกพูด สอนกันแลกกัน', 'Find a partner to practice and swap with'),
    Icon: Languages,
    color: 'sky',
    role: 'swap',
    mode: 'online',
    when: 'anytime',
    example: L('อยากฝึกญี่ปุ่น N4 สอนไทยแลกได้ ผิดได้ ขำได้', 'Practicing Japanese N4, happy to teach Thai back. Mistakes and laughs welcome'),
    tags: ['japanese', 'english', 'korean', 'thai'],
  }),
  loc<TemplateDef>({
    key: 'event',
    label: L('ไปงาน / คอนเสิร์ต', 'Events / concerts'),
    hint: L('มีเพื่อนไปด้วย ไม่ต้องไปคนเดียว', 'Got a buddy, no more going solo'),
    Icon: Ticket,
    color: 'peach',
    role: 'peer',
    mode: 'offline',
    when: 'dated',
    example: L('มีใครไปคอนเสาร์นี้ที่อิมแพ็คบ้าง ไปคนเดียวเขิน', 'Anyone going to the concert at Impact this Saturday? Too shy to go alone'),
    tags: ['concert', 'tpop', 'kpop', 'indie', 'jpop', 'cosplay'],
  }),
  loc<TemplateDef>({
    key: 'newbie',
    label: L('มือใหม่หาเพื่อน', 'Newbie seeks buddy'),
    hint: L('เพิ่งเริ่มอะไรใหม่ หาเพื่อนเริ่มไปด้วยกัน', 'Just starting out? Learn it together'),
    Icon: Sprout,
    color: 'mint',
    role: 'seek',
    mode: 'online',
    when: 'weekend',
    example: L('อยากเริ่มวิ่ง หาคนวิ่งชิลๆ ไม่เร็ว คุยไปวิ่งไป', 'Want to start running. Looking for a slow, chatty running buddy'),
    tags: ['running', 'guitar', 'hiking', 'baking', 'drawing', 'crochet', 'photography'],
  }),
  loc<TemplateDef>({
    key: 'study',
    label: L('ทำงาน / ติวด้วยกัน', 'Work / study together'),
    hint: L('นั่งทำงานหรือติวไปด้วยกัน ไม่เหงา', 'Work or study side by side'),
    Icon: NotebookPen,
    color: 'mint',
    role: 'peer',
    mode: 'online',
    when: 'tonight',
    example: L('หาก๊วนติว TOEIC ทุกเช้าวันเสาร์ เปิดกล้องเงียบๆ', 'Looking for a Saturday-morning TOEIC study group, cameras on, nice and quiet'),
    tags: ['cowork', 'toeic', 'coding', 'design', 'firstjob'],
  }),
  loc<TemplateDef>({
    key: 'moved',
    label: L('เพิ่งย้ายมา', 'Just moved here'),
    hint: L('มาอยู่ที่ใหม่ อยากมีเพื่อนแถวนี้', 'New in town? Meet people nearby'),
    Icon: Luggage,
    color: 'butter',
    role: 'peer',
    mode: 'online',
    when: 'anytime',
    example: L('เพิ่งย้ายมาทำงานกรุงเทพฯ อยากมีเพื่อนกินข้าวเย็น', 'Just moved to Bangkok for work. Looking for dinner buddies'),
    tags: ['movedbkk', 'firstjob', 'streetfood', 'cafe', 'mookata'],
  }),
  loc<TemplateDef>({
    key: 'listen',
    label: L('อยากมีคนคุยด้วย', 'Want someone to talk to'),
    hint: L('อยากมีใครสักคนคุยเบาๆ ด้วย', 'A gentle chat with someone kind'),
    Icon: Ear,
    color: 'peach',
    role: 'peer',
    mode: 'online',
    when: 'tonight',
    example: L('อยากมีเพื่อนคุยก่อนนอน เล่าเรื่องวันนี้ให้กันฟัง', 'Want a bedtime chat buddy to swap stories about our day'),
    tags: ['listening', 'journaling', 'nightowl', 'selfhelp'],
  }),
]

export const TEMPLATE_BY_KEY = Object.fromEntries(TEMPLATES.map((t) => [t.key, t])) as Record<IntentTemplate, TemplateDef>

export interface RoleDef {
  key: IntentRole
  label: string
  Icon: LucideIcon
  color: MochiColor
}

export const ROLES: RoleDef[] = [
  loc<RoleDef>({ key: 'peer', label: L('ทำด้วยกัน', 'Do it together'), Icon: Users, color: 'mint' }),
  loc<RoleDef>({ key: 'seek', label: L('อยากหาคนช่วย', 'Looking for help'), Icon: HandHelping, color: 'sky' }),
  loc<RoleDef>({ key: 'offer', label: L('ช่วยคนอื่นได้', 'Happy to help'), Icon: Lightbulb, color: 'butter' }),
  loc<RoleDef>({ key: 'swap', label: L('แลกกัน', 'Swap'), Icon: Repeat2, color: 'lavender' }),
  loc<RoleDef>({ key: 'host', label: L('มีที่ว่าง', 'Spots open'), Icon: UserPlus, color: 'pink' }),
]

export const ROLE_BY_KEY = Object.fromEntries(ROLES.map((r) => [r.key, r])) as Record<IntentRole, RoleDef>

export interface WhenDef {
  key: IntentWhen
  label: string
  Icon: LucideIcon
}

export const WHENS: WhenDef[] = [
  loc<WhenDef>({ key: 'tonight', label: L('คืนนี้', 'Tonight'), Icon: MoonStar }),
  loc<WhenDef>({ key: 'weekend', label: L('สุดสัปดาห์', 'Weekend'), Icon: CalendarDays }),
  loc<WhenDef>({ key: 'anytime', label: L('เมื่อไหร่ก็ได้', 'Anytime'), Icon: InfinityIcon }),
  loc<WhenDef>({ key: 'dated', label: L('ระบุวัน', 'Pick a date'), Icon: CalendarClock }),
]

/** "ตอนนี้เลย / Right now": saved as when 'tonight' with this Thai label (the database only knows tonight | weekend | anytime | dated) */
export const NOW_LABEL = 'ตอนนี้เลย'

/** One-tap languages on a language post: the catalog tag, and the name saved in give / want (Thai, shown with known()). */
export const LANGS: { tag: string; value: string }[] = [
  { tag: 'thai', value: 'ภาษาไทย' },
  { tag: 'english', value: 'ภาษาอังกฤษ' },
  { tag: 'japanese', value: 'ภาษาญี่ปุ่น' },
  { tag: 'korean', value: 'ภาษาเกาหลี' },
]

/** stored values: keep Thai, show with known() */
export const PROVINCES = [
  'กรุงเทพฯ',
  'นนทบุรี',
  'ปทุมธานี',
  'สมุทรปราการ',
  'นครปฐม',
  'ชลบุรี',
  'ระยอง',
  'เชียงใหม่',
  'เชียงราย',
  'ขอนแก่น',
  'อุดรธานี',
  'นครราชสีมา',
  'อุบลราชธานี',
  'พิษณุโลก',
  'ภูเก็ต',
  'สงขลา',
  'สุราษฎร์ธานี',
]

/** Which give / want fields a role asks for. */
export function giveWantFor(role: IntentRole): { give: boolean; want: boolean } {
  return { give: role === 'swap' || role === 'offer', want: role === 'swap' || role === 'seek' }
}

/** Human "when" text shown on the card. */
export function whenText(when: IntentWhen, whenLabel?: string): string {
  if (whenLabel) return known(whenLabel)
  return WHENS.find((w) => w.key === when)?.label ?? ''
}
