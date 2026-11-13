import {
  Ban,
  Ear,
  Gamepad2,
  GraduationCap,
  Headphones,
  Languages,
  Laptop,
  Leaf,
  Luggage,
  MessagesSquare,
  Moon,
  Ribbon,
  Sprout,
  Sun,
  Sunrise,
  Sunset,
  Ticket,
  type LucideIcon,
} from 'lucide-react'
import type { MochiAccessory, MochiExpression } from '@/components/three'
import { tagOf } from '@/data/tags'
import { L, loc, t } from '@/lib/i18n'
import type { IntentTemplate, MochiColor, OnlineSlot } from '@/lib/types'
import { MAX_LOVES, MAX_STYLES, MIN_TAGS, STORY_MIN, textLength, type Draft, type ScreenKey } from './model'

type ScreenLabel = { key: ScreenKey; label: string }

const SCREEN_LABELS: ScreenLabel[] = [
  loc<ScreenLabel>({ key: 'name', label: L('ชื่อเล่น', 'Nickname') }),
  loc<ScreenLabel>({ key: 'rules', label: L('กติกาเบาๆ', 'Soft rules') }),
  loc<ScreenLabel>({ key: 'mochi', label: L('แต่งน้องโมชิ', 'Your Mochi') }),
  loc<ScreenLabel>({ key: 'likes', label: L('เรื่องที่ชอบ', 'Interests') }),
  loc<ScreenLabel>({ key: 'loves', label: L('เรื่องที่รักมาก', 'Favorites') }),
  loc<ScreenLabel>({ key: 'intent', label: L('มาที่นี่เพื่อ…', 'Here for…') }),
  loc<ScreenLabel>({ key: 'topic', label: L('อยากคุยเรื่องไหน', 'Topic') }),
  loc<ScreenLabel>({ key: 'online', label: L('ออนไลน์ช่วงไหน', 'Online times') }),
  loc<ScreenLabel>({ key: 'style', label: L('สไตล์การคุย', 'Chat style') }),
  loc<ScreenLabel>({ key: 'story', label: L('เรื่องเล่า', 'A little story') }),
  loc<ScreenLabel>({ key: 'rooms', label: L('ห้องที่น่าจะชอบ', 'Rooms') }),
  loc<ScreenLabel>({ key: 'done', label: L('พร้อมแล้ว', 'All set') }),
]

/** The short name of a screen for the header (follows the current language). */
export const screenLabel = (key: ScreenKey) => SCREEN_LABELS.find((s) => s.key === key)?.label ?? ''

/** id → label, read from the options on every access (so it follows the current language). */
function labelsOf<K extends string>(options: { id: K; label: string }[]): Readonly<Record<K, string>> {
  const out = {} as Record<K, string>
  for (const o of options) Object.defineProperty(out, o.id, { get: () => o.label, enumerable: true })
  return out
}

type ColorOption = { id: MochiColor; label: string }

const COLOR_OPTIONS: ColorOption[] = [
  loc<ColorOption>({ id: 'peach', label: L('พีชฉ่ำ', 'Juicy peach') }),
  loc<ColorOption>({ id: 'butter', label: L('เนยสด', 'Fresh butter') }),
  loc<ColorOption>({ id: 'mint', label: L('มินต์ชิล', 'Chill mint') }),
  loc<ColorOption>({ id: 'lavender', label: L('ลาเวนเดอร์', 'Lavender') }),
  loc<ColorOption>({ id: 'sky', label: L('ฟ้าใส', 'Clear sky') }),
  loc<ColorOption>({ id: 'pink', label: L('ชมพูซากุระ', 'Sakura pink') }),
  loc<ColorOption>({ id: 'cream', label: L('ข้าวเหนียวนุ่ม', 'Soft sticky rice') }),
]

export const COLOR_LABEL = labelsOf(COLOR_OPTIONS) as Record<MochiColor, string>

type FaceOption = { id: MochiExpression; label: string }

export const FACE_OPTIONS: FaceOption[] = [
  loc<FaceOption>({ id: 'smile', label: L('ยิ้มหวาน', 'Sweet smile') }),
  loc<FaceOption>({ id: 'happy', label: L('แฮปปี้', 'Happy') }),
  loc<FaceOption>({ id: 'wink', label: L('ขยิบตา', 'Wink') }),
  loc<FaceOption>({ id: 'talk', label: L('ช่างคุย', 'Chatty') }),
  loc<FaceOption>({ id: 'wow', label: L('ตื่นเต้น', 'Excited') }),
  loc<FaceOption>({ id: 'sleepy', label: L('ง่วงนิดๆ', 'A bit sleepy') }),
]

type AccessoryOption = { id: MochiAccessory; label: string; Icon: LucideIcon }

export const ACCESSORY_OPTIONS: AccessoryOption[] = [
  loc<AccessoryOption>({ id: 'none', label: L('ตัวเปล่า', 'None'), Icon: Ban }),
  loc<AccessoryOption>({ id: 'headset', label: L('หูฟัง', 'Headset'), Icon: Headphones }),
  loc<AccessoryOption>({ id: 'leaf', label: L('ใบไม้', 'Leaf'), Icon: Leaf }),
  loc<AccessoryOption>({ id: 'bow', label: L('โบว์', 'Bow'), Icon: Ribbon }),
  loc<AccessoryOption>({ id: 'cap', label: L('หมวก', 'Cap'), Icon: GraduationCap }),
]

export const FACE_LABEL = labelsOf(FACE_OPTIONS) as Record<MochiExpression, string>
export const ACCESSORY_LABEL = labelsOf(ACCESSORY_OPTIONS) as Record<MochiAccessory, string>

type SlotOption = { id: OnlineSlot; Icon: LucideIcon; time: string }

export const SLOT_OPTIONS: SlotOption[] = [
  loc<SlotOption>({ id: 'morning', Icon: Sunrise, time: L('6–11 โมง', '6–11 am') }),
  loc<SlotOption>({ id: 'afternoon', Icon: Sun, time: L('11–17 น.', '11 am–5 pm') }),
  loc<SlotOption>({ id: 'evening', Icon: Sunset, time: L('17–21 น.', '5–9 pm') }),
  loc<SlotOption>({ id: 'late', Icon: Moon, time: L('3 ทุ่มเป็นต้นไป', '9 pm onwards') }),
]

export interface TemplateOption {
  id: IntentTemplate
  label: string
  hint: string
  Icon: LucideIcon
  color: MochiColor
  /** what น้องโมชิ says when this is picked */
  reaction: string
}

export const INTENT_TEMPLATES: TemplateOption[] = [
  loc<TemplateOption>({
    id: 'play',
    label: L('เล่นเกมด้วยกัน', 'Play games together'),
    hint: L('หาตี้ หาดูโอ้', 'Find a squad or a duo'),
    Icon: Gamepad2,
    color: 'lavender',
    reaction: L('เดี๋ยวหาเพื่อนร่วมตี้ใจดีให้นะ ไม่ toxic แน่นอน', "I'll find you a kind squad. Zero toxicity, promise"),
  }),
  loc<TemplateOption>({
    id: 'talk',
    label: L('คุยเรื่อง…', 'Talk about…'),
    hint: L('เรื่องที่ชอบแบบลึกๆ', 'Deep dives into what you love'),
    Icon: MessagesSquare,
    color: 'pink',
    reaction: L('เรื่องที่ชอบ คุยกับคนที่ชอบเหมือนกันสนุกที่สุด', 'What you love is best shared with people who love it too'),
  }),
  loc<TemplateOption>({
    id: 'lang',
    label: L('ฝึกภาษา', 'Practice a language'),
    hint: L('ผิดได้ ขำได้', 'Mistakes welcome, laughs too'),
    Icon: Languages,
    color: 'sky',
    reaction: L('ผิดได้ ขำได้ ที่นี่ไม่มีใครตัดสินนะ', 'Mistakes and laughs welcome. Nobody judges here'),
  }),
  loc<TemplateOption>({
    id: 'event',
    label: L('ไปงาน/คอนเสิร์ต', 'Events & concerts'),
    hint: L('ไปเป็นแก๊งไม่เขิน', 'Go as a gang, no awkwardness'),
    Icon: Ticket,
    color: 'peach',
    reaction: L('ไปเป็นแก๊งอุ่นใจกว่าเยอะเลย', 'Going as a gang feels so much cozier'),
  }),
  loc<TemplateOption>({
    id: 'newbie',
    label: L('มือใหม่หาเพื่อน', 'New here, making friends'),
    hint: L('เพิ่งมา ยังไม่รู้จักใคร', "Just arrived, don't know anyone"),
    Icon: Sprout,
    color: 'mint',
    reaction: L('ไม่ต้องเขินนะ ทุกคนก็เคยเป็นคนใหม่', 'No need to be shy. Everyone was new once'),
  }),
  loc<TemplateOption>({
    id: 'study',
    label: L('ทำงาน/ติวด้วยกัน', 'Work or study together'),
    hint: L('มีเพื่อนนั่งข้างๆ', 'A buddy by your side'),
    Icon: Laptop,
    color: 'butter',
    reaction: L('มีเพื่อนนั่งข้างๆ งานเสร็จไวขึ้นแน่', 'With a buddy beside you, work gets done faster'),
  }),
  loc<TemplateOption>({
    id: 'moved',
    label: L('เพิ่งย้ายมา', 'Just moved here'),
    hint: L('เมืองใหม่ เพื่อนใหม่', 'New city, new friends'),
    Icon: Luggage,
    color: 'butter',
    reaction: L('ยินดีต้อนรับสู่เมืองใหม่ เดี๋ยวพาไปรู้จักเพื่อนแถวนี้', "Welcome to your new city! Let's meet some friends nearby"),
  }),
  loc<TemplateOption>({
    id: 'listen',
    label: L('อยากมีคนรับฟัง', 'Someone to listen'),
    hint: L('แค่อยากเล่าให้ใครฟัง', 'Just want to talk to someone'),
    Icon: Ear,
    color: 'peach',
    reaction: L('เราอยู่ตรงนี้นะ จะหาคนใจดีมารับฟังให้', "I'm right here. I'll find someone kind to listen"),
  }),
]

// the same objects (not copies), so their labels keep following the current language
export const TEMPLATE_BY_ID = Object.fromEntries(INTENT_TEMPLATES.map((o) => [o.id, o])) as Record<IntentTemplate, TemplateOption>

// ------------------------------------------------------------------ น้องโมชิ's lines
export interface MascotLine {
  line: string
  sub?: string
  face: MochiExpression
}

/** The question for each screen (also the page heading). */
export function mascotLine(screen: ScreenKey, d: Draft): MascotLine {
  const name = d.name.trim()
  switch (screen) {
    case 'name':
      return {
        line: t('สวัสดี! เราชื่อน้องโมชิ แล้วเธอล่ะ?', "Hi! I'm Little Mochi. What's your name?"),
        sub: t('ชื่อเล่นก็พอนะ เปลี่ยนทีหลังได้เสมอ', 'A nickname is perfect. You can always change it later'),
        face: 'smile',
      }
    case 'rules':
      return {
        line: name ? t(`${name} ก่อนเริ่ม ตกลงกันเบาๆ 3 ข้อนะ`, `${name}, 3 soft rules before we start`) : t('ก่อนเริ่ม ตกลงกันเบาๆ 3 ข้อนะ', '3 soft rules before we start'),
        sub: t('ที่นี่อบอุ่นได้ เพราะทุกคนช่วยกันแบบนี้', 'This place stays cozy because everyone does this'),
        face: 'wink',
      }
    case 'mochi':
      return {
        // no name here: it's on the mochi's name tag, and the line has to stay one row on phones
        line: t('มาแต่งน้องโมชิของเรากัน', "Let's style your Mochi"),
        sub: t('สี หน้าตา ของแต่ง เปลี่ยนได้ตลอดเลย', 'Color, face, accessory. Change them anytime'),
        face: 'wow',
      }
    case 'likes':
      return {
        line: t('ช่วงนี้ชอบอะไรอยู่บ้าง?', 'What are you into lately?'),
        sub: t(`เลือกอย่างน้อย ${MIN_TAGS} อย่าง ยิ่งเฉพาะ ยิ่งเจอคนใช่`, `Pick at least ${MIN_TAGS}. The more specific, the better the match`),
        face: 'happy',
      }
    case 'loves':
      return {
        line: t('อันไหนที่รักที่สุด?', 'Which ones do you love most?'),
        sub: t(`ติดดาวได้ ${MAX_LOVES} อย่าง จะได้เจอคนคอเดียวกันง่ายขึ้น`, `Star up to ${MAX_LOVES}. It helps me find your kindred spirits`),
        face: 'happy',
      }
    case 'intent':
      return {
        line: t('มาที่นี่เพื่ออะไร?', 'What brings you here?'),
        sub: t('เลือก 1 อย่าง เปลี่ยนทีหลังได้', 'Pick one. You can change it later'),
        face: 'wink',
      }
    case 'topic':
      return {
        line: t('อยากคุยเรื่องไหนเป็นพิเศษ?', 'What do you most want to talk about?'),
        sub: t('เลือกจากเรื่องที่ชอบมา 1 เรื่อง', 'Pick one of your interests'),
        face: 'talk',
      }
    case 'online':
      return {
        line: t('ปกติออนไลน์ช่วงไหน?', 'When are you usually online?'),
        sub: t('เลือกได้หลายช่วง จะได้เจอเพื่อนที่ว่างตรงกัน', 'Pick as many as you like, to meet people who are around too'),
        face: 'smile',
      }
    case 'style':
      return {
        line: t('คุยแบบไหนเป็นตัวเรา?', "What's your chat style?"),
        sub: t(`เลือกได้ไม่เกิน ${MAX_STYLES} แบบ`, `Pick up to ${MAX_STYLES}`),
        face: 'talk',
      }
    case 'story':
      return {
        line: t('เล่าเรื่องตัวเองให้ฟังสักข้อสิ', 'Tell me one little thing about you'),
        sub: t('ข้อเดียวพอ อยากเล่าเพิ่มไปเติมในโปรไฟล์ได้', 'One is plenty. You can add more on your profile'),
        face: 'smile',
      }
    case 'rooms':
      return {
        line: t('เราเลือกห้องที่น่าจะถูกใจไว้ให้แล้ว', 'I picked some rooms you might like'),
        sub: t('ดูแล้วกดยืนยันได้เลย เข้าออกห้องได้ตลอด', 'Have a look, then confirm. Join or leave rooms anytime'),
        face: 'happy',
      }
    default:
      return {
        line: name ? t(`เย้! ยินดีต้อนรับนะ ${name}`, `Yay! Welcome, ${name}`) : t('เย้! ยินดีต้อนรับนะ', 'Yay! Welcome aboard'),
        sub: t('โมชิจูนคลื่นหาเพื่อนให้แล้ว', "I've tuned in to find your people"),
        face: 'happy',
      }
  }
}

/** A follow-up chat bubble that reacts to what the visitor just did. */
export function mascotReaction(screen: ScreenKey, d: Draft, ctx: { settledName: string; settledStory: string; lookChanged: boolean }): string | null {
  switch (screen) {
    case 'name': {
      const n = ctx.settledName.trim()
      return n ? t(`ชื่อ ${n} น่ารักจังเลย ยินดีที่ได้รู้จักนะ`, `${n} is such a cute name! Nice to meet you`) : null
    }
    case 'mochi':
      if (!ctx.lookChanged) return null
      return t(
        `โมชิสี${COLOR_LABEL[d.color]}${d.accessory !== 'none' ? `กับ${ACCESSORY_LABEL[d.accessory]}` : ''} น่ากอดสุดๆ`,
        `${COLOR_LABEL[d.color]} Mochi${d.accessory !== 'none' ? ` + ${ACCESSORY_LABEL[d.accessory].toLowerCase()}` : ''}, so huggable!`,
      )
    case 'likes': {
      const n = d.tags.length
      if (!n) return null
      if (n < MIN_TAGS) return t(`อีก ${MIN_TAGS - n} อย่างก็ครบแล้ว สู้ๆ`, `Just ${MIN_TAGS - n} more. You've got this!`)
      return t('ครบแล้ว! เลือกเพิ่มได้อีกนะ ยิ่งเยอะยิ่งเจอคนใช่', "That's enough! Add more if you like. More picks, better matches")
    }
    case 'loves': {
      const fav = d.loves.length ? tagOf(d.loves[d.loves.length - 1]) : undefined
      return fav ? t(`${fav.label} ด้วยเหรอ! เราก็ชอบเหมือนกัน`, `${fav.label} too?! I love that one!`) : null
    }
    case 'intent':
      return d.intent ? TEMPLATE_BY_ID[d.intent].reaction : null
    case 'topic': {
      const topic = d.intentTag ? tagOf(d.intentTag) : undefined
      return topic ? t(`${topic.label} เหรอ คุยกันได้ยาวๆ เลย!`, `${topic.label}? We could talk for hours!`) : null
    }
    case 'online':
      return d.online.length ? t('จดไว้แล้ว เดี๋ยวหาเพื่อนที่ว่างตรงกันให้นะ', "Noted! I'll find friends who are around when you are") : null
    case 'style':
      return d.chatStyle.length ? t('สไตล์นี้คุยด้วยสนุกแน่เลย!', 'Sounds like fun to chat with!') : null
    case 'story': {
      const n = textLength(ctx.settledStory)
      if (!n) return null
      return n < STORY_MIN ? t('ค่อยๆ พิมพ์ได้เลย ไม่ต้องรีบนะ', 'Take your time, no rush') : t('อ่านแล้วอยากคุยด้วยเลย!', 'Reading that makes me want to chat!')
    }
    case 'rooms':
      if (!d.rooms.length) return null
      return d.rooms.includes('lobby')
        ? t('ห้องนั่งเล่นเปิดไฟรอแล้ว แวะไปทักทายได้เลยนะ', 'The Lounge lights are on. Drop by and say hi!')
        : t(`เลือกไว้ ${d.rooms.length} ห้อง เข้าออกได้ตลอดนะ`, `${d.rooms.length} ${d.rooms.length === 1 ? 'room' : 'rooms'} picked. Come and go anytime`)
    default:
      return null
  }
}
