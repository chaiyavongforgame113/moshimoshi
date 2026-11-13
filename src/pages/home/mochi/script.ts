import {
  Briefcase,
  CloudDrizzle,
  Coffee,
  HandHeart,
  HeartCrack,
  Headphones,
  Leaf,
  MessageCircleHeart,
  MoonStar,
  PartyPopper,
  Smile,
  Sofa,
  Sparkles,
  Users,
  Wind,
  type LucideIcon,
} from 'lucide-react'
import { L, loc, tx, type Txt } from '@/lib/i18n'
import type { Mood } from '@/lib/types'
import { MOOD_BY_KEY } from '../moods'

/*
 * Everything Little Mochi says in "คุยกับโมชิ", in both languages.
 * The chat stores only the keys of these lines, so a saved conversation
 * reads in whichever language is on now. No AI and no network: what Mochi
 * says about feelings is written and checked ahead of time.
 */

/** a mood from the home card, or "อื่นๆ" typed in their own words */
export type MoodKey = Mood | 'other'

export type HelpId =
  | 'vent'
  | 'breathe'
  | 'company'
  | 'talk'
  | 'cheer'
  | 'chill-spot'
  | 'share'
  | 'party'
  | 'just-tell'
  | 'quiet-spot'
  | 'hobby-talk'
  | 'stay-chill'

export interface HelpOption {
  /** the quick-reply chip */
  label: string
  /** what "I" say in the thread */
  say: string
  Icon: LucideIcon
}

/** "อยากให้โมชิช่วยแบบไหน?" — the three answers for each mood */
export const MOOD_HELP: Record<MoodKey, HelpId[]> = {
  tired: ['vent', 'breathe', 'company'],
  lonely: ['talk', 'cheer', 'chill-spot'],
  happy: ['share', 'party', 'just-tell'],
  excited: ['share', 'party', 'just-tell'],
  chill: ['quiet-spot', 'hobby-talk', 'stay-chill'],
  other: ['vent', 'breathe', 'company'],
}

export const HELP: Record<HelpId, HelpOption> = {
  vent: loc<HelpOption>({ label: L('อยากระบาย', 'I need to vent'), say: L('ขอระบายหน่อยนะ', 'Can I vent for a bit?'), Icon: MessageCircleHeart }),
  breathe: loc<HelpOption>({ label: L('พักใจ 1 นาที', 'A 1-minute breather'), say: L('ขอพักใจสักนาทีนะ', 'I need a minute to breathe'), Icon: Wind }),
  company: loc<HelpOption>({ label: L('อยากมีเพื่อนคุยด้วย', 'I want some company'), say: L('อยากมีเพื่อนคุยด้วยจัง', "I'd like some company"), Icon: Users }),
  talk: loc<HelpOption>({ label: L('อยากมีคนคุยด้วย', 'I want someone to talk to'), say: L('อยากมีใครสักคนคุยด้วย', "I'd like someone to talk to"), Icon: Users }),
  cheer: loc<HelpOption>({ label: L('ขอกำลังใจหน่อย', 'Cheer me up a little'), say: L('ขอกำลังใจหน่อยได้ไหม', 'Could you cheer me up a little?'), Icon: HandHeart }),
  'chill-spot': loc<HelpOption>({ label: L('หาที่นั่งชิลๆ', 'Find a cozy spot'), say: L('อยากหาที่นั่งชิลๆ', "I'd like a cozy place to hang out"), Icon: Sofa }),
  share: loc<HelpOption>({ label: L('อยากแชร์', 'I want to share'), say: L('อยากเล่าให้ฟัง!', 'I want to tell you about it!'), Icon: Sparkles }),
  party: loc<HelpOption>({ label: L('หาตี้สนุกๆ', 'Find a fun group'), say: L('หาตี้สนุกๆ ให้หน่อย', 'Find me a fun group!'), Icon: PartyPopper }),
  'just-tell': loc<HelpOption>({ label: L('แค่อยากบอก', 'Just wanted to say'), say: L('ไม่มีอะไรหรอก แค่อยากบอกโมชิเฉยๆ', 'Nothing really, I just wanted to tell you'), Icon: Smile }),
  'quiet-spot': loc<HelpOption>({ label: L('หาที่นั่งเงียบๆ', 'Find a quiet spot'), say: L('อยากหาที่นั่งเงียบๆ', "I'd like somewhere quiet"), Icon: Headphones }),
  'hobby-talk': loc<HelpOption>({
    label: L('หาคนคุยเรื่องที่ชอบ', 'Talk about what I love'),
    say: L('อยากเจอคนคุยเรื่องที่ชอบ', "I'd like someone to talk about what I love"),
    Icon: Coffee,
  }),
  'stay-chill': loc<HelpOption>({ label: L('ชิลต่อ', 'Keep chilling'), say: L('ขอชิลต่ออีกหน่อยนะ', "I'll just keep chilling"), Icon: Leaf }),
}

export type TopicId = 'work' | 'love' | 'worth' | 'sleep' | 'lonely'

/** where "หาเพื่อนที่เข้าใจเรื่องนี้" leads: rooms (first that exists) or a person on my wavelength */
export type TopicFind = { kind: 'room'; rooms: string[] } | { kind: 'person' }

export interface Topic {
  id: TopicId
  label: string
  say: string
  Icon: LucideIcon
  find: TopicFind
}

/** "อยากคุยเรื่องอะไรไหม?" */
export const TOPICS: Topic[] = [
  loc<Topic>({
    id: 'work',
    label: L('งาน/เรียนเครียด', 'Work or study stress'),
    say: L('ช่วงนี้งานกับเรียนเครียดมากเลย', 'Work and study have been really stressful'),
    Icon: Briefcase,
    find: { kind: 'room', rooms: ['cowork', 'listen'] },
  }),
  loc<Topic>({
    id: 'love',
    label: L('ความสัมพันธ์', 'Relationships'),
    say: L('มีเรื่องความสัมพันธ์ที่ไม่สบายใจ', 'Something in a relationship is weighing on me'),
    Icon: HeartCrack,
    find: { kind: 'room', rooms: ['listen', 'lobby'] },
  }),
  loc<Topic>({
    id: 'worth',
    label: L('เห็นคุณค่าตัวเอง', 'Self-worth'),
    say: L('ช่วงนี้ไม่ค่อยเห็นคุณค่าตัวเองเลย', "Lately I don't feel like I'm worth much"),
    Icon: Sparkles,
    find: { kind: 'room', rooms: ['listen', 'lobby'] },
  }),
  loc<Topic>({
    id: 'sleep',
    label: L('นอนไม่หลับ', "Can't sleep"),
    say: L('ช่วงนี้นอนไม่ค่อยหลับเลย', "I can't really sleep lately"),
    Icon: MoonStar,
    find: { kind: 'room', rooms: ['listen', 'lobby'] },
  }),
  loc<Topic>({
    id: 'lonely',
    label: L('ความเหงา', 'Loneliness'),
    say: L('ช่วงนี้เหงาๆ', "I've been feeling lonely lately"),
    Icon: CloudDrizzle,
    find: { kind: 'person' },
  }),
]

export const TOPIC_BY_ID = Object.fromEntries(TOPICS.map((tp) => [tp.id, tp])) as Record<TopicId, Topic>

/** the kind messages for each topic, shown one at a time, then one small tip */
const TOPIC_TALK: Record<TopicId, { lines: Txt[]; tip: Txt }> = {
  work: {
    lines: [
      L('เครียดเรื่องงานหรือเรียนนี่เหนื่อยทั้งกายทั้งใจเลยเนอะ ขอบคุณที่บอกโมชินะ', 'Work or study stress wears out your body and your mind. Thank you for telling me'),
      L(
        'เวลาทุกอย่างถาโถมเข้ามาพร้อมกัน จะรู้สึกว่าทำไม่ทันก็ไม่แปลกเลย ใครเจอแบบนี้ก็หนักเหมือนกัน',
        'When everything piles up at once, of course it feels like too much. It would for anyone',
      ),
      L('คุณค่าของเราไม่ได้วัดจากงานที่เสร็จหรือเกรดที่ได้นะ เราเป็นมากกว่านั้นเยอะเลย', "Your worth isn't measured in finished tasks or grades. You're so much more than that"),
      L('วันนี้ทำได้แค่ไหนก็เก่งแล้ว ที่เหลือไว้ค่อยว่ากันพรุ่งนี้ก็ได้', 'Whatever you managed today is enough. The rest can wait until tomorrow'),
    ],
    tip: L(
      'เลือกงานที่เล็กที่สุดมาแค่ 1 อย่าง แล้วลองทำแค่ 10 นาที พอได้เริ่มแล้ว ใจจะเบาลงเยอะเลย',
      'Pick the single smallest task and give it just 10 minutes. Once you start, a lot of the weight lifts',
    ),
  },
  love: {
    lines: [
      L('เรื่องความสัมพันธ์อยู่ใกล้ใจเรามาก เลยเจ็บได้ง่ายเนอะ ขอบคุณที่เล่าให้โมชิฟังนะ', 'Relationships sit close to the heart, so they hurt easily. Thank you for telling me'),
      L('จะเป็นแฟน เพื่อน หรือครอบครัวก็ตาม การที่เราแคร์ขนาดนี้ แปลว่าเราเป็นคนใจดีนะ', "Partner, friends or family, caring this much means you have a kind heart"),
      L('ตอนนี้ยังไม่ต้องมีคำตอบทุกอย่างก็ได้ ให้เวลากับความรู้สึกตัวเองก่อนนะ', "You don't need every answer right now. Give your feelings a little time first"),
      L('และไม่ว่าเรื่องนี้จะจบแบบไหน เราสมควรได้รับความรักที่อ่อนโยนเสมอ', 'And however this turns out, you always deserve gentle love'),
    ],
    tip: L(
      'ลองเขียนสิ่งที่อยากบอกเขาลงในโน้ตก่อน ยังไม่ต้องส่งนะ แค่ได้เขียนออกมา ใจก็นิ่งขึ้นแล้ว',
      "Try writing what you want to tell them in a note. Don't send it yet. Just writing it out helps your mind settle",
    ),
  },
  worth: {
    lines: [
      L('ขอบคุณที่กล้าบอกนะ ความรู้สึกแบบนี้พูดออกมายากมากเลย', "Thank you for saying it. That's a hard feeling to put into words"),
      L('เสียงในหัวที่คอยติเรา มักจะดุกว่าความจริงเสมอเลยนะ', 'The voice in your head that criticizes you is almost always harsher than the truth'),
      L(
        'ถ้าเพื่อนสนิทรู้สึกแบบนี้ เราคงไม่ใจร้ายกับเขาใช่ไหม ลองใจดีกับตัวเองแบบนั้นบ้างนะ',
        "If your best friend felt this way, you wouldn't be harsh with them. Try being that kind to yourself",
      ),
      L('เราไม่ต้องเก่งทุกอย่างก็มีค่าได้ แค่เป็นตัวเราก็มีค่ามากพอแล้ว', "You don't have to be good at everything to matter. Being you is already enough"),
      L('โมชิดีใจจริงๆ นะที่ได้คุยกับเราวันนี้', "I'm truly glad I got to talk with you today"),
    ],
    tip: L(
      'คืนนี้ก่อนนอน ลองนึกถึงเรื่องเล็กๆ 1 อย่างที่เราทำได้ดีในวันนี้ จะเล็กแค่ไหนก็นับนะ',
      'Before bed tonight, think of one small thing you did well today. However small, it counts',
    ),
  },
  sleep: {
    lines: [
      L('นอนไม่หลับนี่ทรมานจริงๆ นะ ยิ่งอยากหลับ ตาก็ยิ่งสว่าง', 'Not being able to sleep is rough. The harder you try, the more awake you feel'),
      L('ถ้าคืนนี้ยังไม่หลับก็ไม่เป็นไรนะ แค่ได้นอนพักสายตา ร่างกายก็ได้พักแล้ว', "It's okay if sleep doesn't come yet. Just resting your eyes lets your body rest too"),
      L(
        'ถ้าในหัวมีเรื่องวนไปวนมา ลองบอกตัวเองว่า "ไว้พรุ่งนี้ค่อยคิดต่อ คืนนี้ขอพักก่อน"',
        'If your thoughts keep looping, tell yourself: "I\'ll think about it tomorrow. Tonight I rest."',
      ),
      L('โมชิอยู่เป็นเพื่อนตรงนี้นะ ไม่ต้องรีบหลับ ค่อยๆ ผ่อนคลายไปด้วยกัน', "I'm right here with you. No rush to sleep, let's just unwind together"),
    ],
    tip: L(
      'ลองวางมือถือให้ห่างตัวสัก 15 นาที หรี่ไฟลง แล้วหายใจเข้า 4 กลั้น 7 ออก 8 ช้าๆ สัก 4 รอบ',
      'Put your phone away for 15 minutes, dim the lights, and slowly breathe in for 4, hold for 7, out for 8, four times',
    ),
  },
  lonely: {
    lines: [
      L('ความเหงาแวะมาหาได้ทุกคนเลยนะ ไม่ได้แปลว่าเรามีอะไรผิดปกติ', "Loneliness visits everyone. It doesn't mean anything is wrong with you"),
      L('บางทีอยู่ท่ามกลางคนเยอะๆ ก็ยังเหงาได้ เพราะใจเราอยากเจอคนที่เข้าใจจริงๆ', 'You can feel lonely even in a crowd, because your heart wants someone who really gets you'),
      L('การที่เรามาคุยกับโมชิตรงนี้ ก็เป็นก้าวเล็กๆ ที่กล้าหาญมากแล้วนะ', 'Coming here to talk is already a brave little step'),
      L('คนที่คลื่นตรงกับเรามีอยู่จริงนะ แค่ยังไม่ได้เจอกันเท่านั้นเอง', "People on your wavelength are out there. You just haven't met yet"),
    ],
    tip: L(
      'ลองทักเพื่อนเก่าสักคนด้วยข้อความสั้นๆ แค่ "คิดถึงนะ" ก็พอ เรื่องเล็กๆ แบบนี้อุ่นใจได้ทั้งสองฝั่งเลย',
      'Message an old friend something short, even just "thinking of you." Little things like that warm both sides',
    ),
  },
}

export const topicLength = (id: TopicId) => TOPIC_TALK[id].lines.length

/** Mochi's answer to each mood: empathy first, before asking how to help */
const EMPATHY: Record<MoodKey, Txt> = {
  tired: L('เหนื่อยมาทั้งวันเลยสินะ เก่งมากแล้วนะที่ผ่านวันนี้มาได้', 'Sounds like a long day. You did so well just getting through it'),
  lonely: L(
    'ขอบคุณที่บอกโมชินะ ความเหงาบางทีก็หนักกว่าที่คิดเนอะ ตอนนี้โมชิอยู่ตรงนี้แล้วนะ',
    "Thank you for telling me. Loneliness can weigh more than it looks. I'm right here with you",
  ),
  happy: L('เย้! ได้ยินแล้วโมชิยิ้มตามเลย วันนี้ต้องมีเรื่องดีๆ แน่เลย', 'Yay! That makes me smile too. Something good must have happened'),
  excited: L('ว้าว พลังเต็มเปี่ยมเลย! ความตื่นเต้นนี่ติดกันได้นะ โมชิเริ่มตื่นเต้นตามแล้ว', "Wow, so much energy! It's contagious. Now I'm excited too"),
  chill: L('ชิลๆ แบบนี้ดีที่สุดแล้ว ไม่ต้องรีบอะไรเลย ค่อยๆ ไปนะ', 'Chill is the best. No rush at all, take it slow'),
  other: L('ขอบคุณที่เล่าให้โมชิฟังนะ ทุกความรู้สึกสำคัญเสมอ ไม่มีถูกไม่มีผิดเลย', "Thank you for telling me. Every feeling matters, and there's no right or wrong one"),
}

/** rotating replies while someone vents: validate, never fix */
const VENT_REPLIES: Txt[] = [
  L('อืม... ฟังแล้วเหนื่อยแทนเลย ไม่แปลกเลยที่จะรู้สึกแบบนี้', 'Mm... that sounds exhausting. It makes sense that you feel this way'),
  L('ขอบคุณที่เล่าให้ฟังนะ เรื่องแบบนี้ไม่ต้องแบกไว้คนเดียวก็ได้', "Thank you for telling me. You don't have to carry this alone"),
  L('โมชิฟังอยู่ตรงนี้นะ ค่อยๆ เล่า ไม่ต้องรีบ', "I'm right here listening. Take your time"),
  L('รู้สึกแบบนั้นได้เลยนะ ความรู้สึกของเราจริงและสำคัญเสมอ', "It's okay to feel that. Your feelings are real and they matter"),
  L('เข้าใจเลย ใครมาเจอแบบนี้ก็คงหนักใจเหมือนกัน', 'I get it. Anyone in your place would feel heavy too'),
  L('เก่งมากที่กล้าพูดออกมานะ แค่นี้ก็คือการดูแลใจตัวเองแล้ว', "It's brave to say it out loud. That's already taking care of yourself"),
]

/** "ขอกำลังใจหน่อย": two of these, a different pair each time */
const CHEERS: Txt[] = [
  L('เราน่ารักกว่าที่ตัวเองคิดเยอะเลยนะ', "You're lovelier than you think, by a lot"),
  L('ความเหงาไม่ได้แปลว่าเราไม่มีใคร มันแค่บอกว่าใจเราอยากเชื่อมกับใครสักคน', "Feeling lonely doesn't mean you have no one. It means your heart wants to connect"),
  L('วันนี้เราดูแลตัวเองมาได้ดีมากแล้ว อยากให้รู้ไว้นะ', 'You took good care of yourself today. I want you to know that'),
  L('ต้องมีคนที่ดีใจที่ได้รู้จักเราแน่ๆ หนึ่งในนั้นคือโมชิเอง', "Someone out there is glad to know you. I'm one of them"),
  L('ไม่ต้องรีบหายเหงาก็ได้ ค่อยๆ ไปนะ โมชิอยู่ข้างๆ เสมอ', "No need to hurry out of feeling lonely. Go slow, I'm right beside you"),
]

/** after "อยากแชร์" */
const SHARE_REPLIES: Txt[] = [
  L('เย้! ดีใจด้วยสุดๆ เลย ขอบคุณที่เอามาเล่าให้โมชิฟังนะ', "Yay! I'm so happy for you. Thank you for telling me"),
  L('ฟังแล้วยิ้มไม่หุบเลย เก็บความรู้สึกดีๆ นี้ไว้นานๆ นะ', "I can't stop smiling. Hold on to this feeling"),
  L('สุดยอดไปเลย! เรื่องดีๆ แบบนี้ต้องฉลองหน่อยแล้ว', 'Amazing! Good news like this deserves a little celebration'),
]

/** labels for "tell me more" in a topic, so it doesn't feel like one button pressed over and over */
const NEXT_LABELS: Txt[] = [L('อืม แล้วไงต่อ', 'Mm, go on'), L('ฟังอยู่นะ', "I'm listening"), L('จริงด้วย', "That's true"), L('เล่าต่อสิ', 'Tell me more')]

export const VENT_COUNT = VENT_REPLIES.length
export const CHEER_COUNT = CHEERS.length
export const SHARE_COUNT = SHARE_REPLIES.length
export const NEXT_COUNT = NEXT_LABELS.length

/** one-off lines and chip texts, by key */
const ONE: Record<string, Txt> = {
  hello: L('หวัดดี~ โมชิเองนะ วันนี้เป็นไงบ้าง?', "Hi there, it's Mochi! How are you today?"),
  'hello.sub': L('แตะเลือกความรู้สึกด้านล่าง หรือพิมพ์เองก็ได้นะ', 'Tap a feeling below, or type your own'),
  back: L('กลับมาแล้ว~ ดีใจจัง ตอนนี้รู้สึกยังไงบ้าง?', "You're back! So glad. How are you feeling now?"),
  'hello.again': L('ได้เลย~ ตอนนี้รู้สึกยังไงบ้าง?', 'Sure! How are you feeling right now?'),
  'help.ask': L('อยากให้โมชิช่วยแบบไหน?', 'How can Mochi help?'),

  'vent.open': L('เล่ามาได้เลยนะ โมชิฟังอยู่ ยาวแค่ไหนก็ได้ ไม่ต้องเรียบเรียงก็ได้', "Go ahead, I'm listening. As long as you like, it doesn't have to be neat"),
  'vent.private': L('ที่พิมพ์ตรงนี้อยู่แค่ในเครื่องนี้ ไม่มีใครเห็นนะ', 'What you type here stays on this device. No one else sees it'),
  'vent.offer': L(
    'ขอบคุณที่ไว้ใจเล่าให้โมชิฟังนะ อยากพักตรงนี้ก่อนไหม หรือจะเล่าต่อก็ได้เลย',
    'Thank you for trusting me with this. Want to pause here, or keep going? Either is okay',
  ),
  'vent.stop': L(
    'เก่งมากเลยที่ระบายออกมา หวังว่าใจจะเบาลงนิดนึงนะ อยากเล่าอีกเมื่อไหร่ โมชิอยู่ตรงนี้เสมอ',
    "You did great letting it out. I hope your heart feels a little lighter. I'm always here when you want to talk again",
  ),
  later: L('ได้เลย ไม่ต้องรีบนะ อยากเล่าเมื่อไหร่ โมชิรอฟังอยู่ตรงนี้เสมอ', "Sure, no rush. Whenever you feel like telling me, I'm right here"),
  'topic.own': L('ขอบคุณที่เล่านะ เรื่องนี้คงอยู่ในใจมาสักพักแล้ว เล่าให้โมชิฟังต่อได้เลย', "Thank you for telling me. Sounds like it's been on your mind. Go ahead, tell me more"),

  'breathe.open': L('มาหายใจไปพร้อมโมชินะ โมชิพองตัวก็หายใจเข้า โมชิยุบลงก็หายใจออก', "Let's breathe together. Breathe in as Mochi puffs up, and out as Mochi settles"),
  'breathe.done': L('เก่งมากเลย~ เป็นไงบ้าง ใจเบาลงนิดนึงไหม', 'Nicely done! How do you feel? A little lighter?'),
  'breathe.skip': L('ไม่เป็นไรเลยนะ ไว้อยากพักใจเมื่อไหร่ ค่อยมาหายใจด้วยกันใหม่', "That's totally fine. Whenever you need a breather, we'll breathe together again"),
  'breathe.better': L('ดีใจด้วยน้า~ ดีขึ้นแค่นิดเดียวก็นับว่าเก่งแล้ว', 'So glad! Even a little better counts'),
  'breathe.again': L('ได้เลย มาหายใจไปพร้อมกันอีกรอบนะ', "Of course. Let's breathe together one more time"),

  'pre.company': L('ได้เลย เราไม่ต้องอยู่คนเดียวนะ เดี๋ยวโมชิหาเพื่อนให้', "Sure thing. You don't have to be alone. Let me find you some company"),
  'pre.talk': L('ได้เลย เดี๋ยวโมชิหาคนที่คลื่นตรงกับเราให้นะ', 'Sure! Let me find someone on your wavelength'),
  'pre.chill-spot': L('ได้เลย มีที่นั่งอุ่นๆ อยู่ ไม่ต้องพูดเก่งก็ได้นะ', "Sure. There's a cozy spot, and you don't have to say much"),
  'pre.party': L('ได้เลย ไปหาวงสนุกๆ กัน!', "Let's find a fun group!"),
  'pre.quiet-spot': L('ได้เลย เดี๋ยวโมชิหามุมสงบๆ ให้นะ', 'Sure, let me find you a calm corner'),
  'pre.hobby-talk': L('ได้เลย ไปหาคนที่ชอบอะไรคล้ายๆ เรากัน', "Sure, let's find someone who loves the same things"),
  'pre.find': L('ได้เลย ที่นี่มีเพื่อนๆ ที่เคยผ่านเรื่องแบบนี้เหมือนกันนะ', 'Sure. Some friends here have been through this too'),

  'card.room': L('ห้องนี้มีเพื่อนๆ นั่งอยู่ แวะไปนั่งด้วยกันได้เลย', 'Friends are hanging out in this room. Come sit with them'),
  'card.room.noPerson': L('ตอนนี้ยังไม่เจอคนที่คลื่นตรงกันเลย แต่ห้องนี้มีเพื่อนๆ นั่งอยู่นะ', "I haven't found someone on your wavelength yet, but friends are hanging out in this room"),
  'card.room.noSession': L('ตอนนี้ยังไม่มีอีเวนต์เลย แต่ห้องนี้กำลังสนุกอยู่นะ', 'No events right now, but this room is lively'),
  'card.person': L('คนนี้คลื่นตรงกับเรามากเลย ลองทักไปคุยดูไหม', 'This person is really on your wavelength. Want to say hi?'),
  'card.session': L('มีอีเวนต์สนุกๆ อยู่ ไปแจมกันเลย!', "There's a fun event on. Go join in!"),
  'card.browse': L('ตอนนี้โมชิยังหาให้ไม่เจอเลย ลองไปดูห้องทั้งหมดก่อนนะ', "I couldn't find one just now. Take a look around the rooms"),

  'share.open': L('เล่าเลยๆ! โมชิอยากรู้แล้ว', "Tell me, tell me! I'm all ears"),
  'just-tell': L('ขอบคุณที่มาบอกนะ แค่ได้คุยกันโมชิก็ดีใจแล้ว', 'Thank you for telling me. Just chatting with you makes me happy'),
  'stay-chill': L('ได้เลย ชิลต่อไปนะ โมชิจะนั่งเงียบๆ อยู่ตรงนี้ อยากคุยเมื่อไหร่ก็แตะโมชิได้เลย', "You got it, keep chilling. I'll sit quietly right here. Tap me whenever you want to talk"),

  'topics.ask': L('อยากคุยเรื่องอะไรไหม? เลือกได้เลย หรือพิมพ์เองก็ได้นะ', 'Anything you want to talk about? Pick one, or type your own'),
  'topic.stop': L('ได้เลย ขอบคุณที่คุยกันนะ อยากคุยต่อเมื่อไหร่ บอกโมชิได้เลย', 'Okay. Thank you for talking with me. Let me know whenever you want to continue'),

  'care.1': L(
    'ขอบคุณที่ไว้ใจบอกโมชินะ ตอนนี้คงเจ็บปวดมากเลย และเราไม่ต้องผ่านมันไปคนเดียวนะ',
    "Thank you for trusting me with this. It sounds like you're hurting a lot right now, and you don't have to go through it alone",
  ),
  'care.2': L(
    'ถ้าเป็นไปได้ ลองบอกคนที่ไว้ใจสักคนนะ จะเป็นเพื่อน คนในครอบครัว หรือใครที่อยู่ใกล้ๆ ก็ได้ โมชิเป็นห่วงเรามากนะ',
    'If you can, please reach out to someone you trust: a friend, family, or anyone nearby. Mochi cares about you a lot',
  ),
  bye: L('ยินดีเสมอเลย~ อยากคุยเมื่อไหร่ แตะโมชิได้ตลอดนะ พักผ่อนเยอะๆ น้า', 'Anytime! Tap me whenever you want to talk. Get some good rest'),

  // chips and what "I" say with them
  'chip.topics': L('อยากคุยเรื่องอื่น', 'Talk about something else'),
  'chip.topics.first': L('มีเรื่องอยากคุย', 'Something on my mind'),
  'say.topics': L('มีเรื่องอยากคุยด้วย', "There's something on my mind"),
  'chip.thanks': L('ขอบคุณนะโมชิ', 'Thanks, Mochi'),
  'chip.ventStop': L('พอแค่นี้ก่อน', "That's enough for now"),
  'chip.later': L('ไว้ก่อนนะ', 'Maybe later'),
  'chip.better': L('ดีขึ้นแล้ว', 'Feeling better'),
  'say.better': L('ดีขึ้นแล้ว ขอบคุณนะ', 'Feeling better, thanks'),
  'chip.again': L('ขออีกรอบ', 'One more round'),
  'say.again': L('ขออีกรอบนะ', 'One more round, please'),
  'chip.stop': L('พอก่อนนะ', "That's enough for now"),
  'chip.find': L('หาเพื่อนที่เข้าใจเรื่องนี้', 'Find friends who get it'),
  'say.find': L('อยากเจอเพื่อนที่เข้าใจเรื่องนี้', "I'd like to meet friends who get this"),
  'chip.other': L('คุยเรื่องอื่น', 'Something else'),
  'chip.more': L('คุยกับโมชิต่อ', 'Keep chatting'),
  'say.more': L('ขอคุยต่ออีกหน่อยนะ', "Let's keep chatting"),

  // the composer, where the script invites typing
  'composer.vent': L('พิมพ์เล่าให้โมชิฟังได้เลย…', 'Tell Mochi anything…'),
  'composer.ventMore': L('หรือจะเล่าต่อก็พิมพ์ได้เลยนะ…', 'Or keep typing if you want to say more…'),
  'composer.share': L('เล่าเรื่องดีๆ ให้โมชิฟังหน่อย…', 'Tell Mochi the good news…'),
  'composer.care': L('อยากเล่าต่อ พิมพ์ได้เลยนะ…', "If you'd like to keep talking, type here…"),
}

/** every line by key: "help.vent", "topic.work.2", "vent.reply.3"… */
const LINES = new Map<string, Txt | (() => string)>(Object.entries(ONE))
for (const [id, h] of Object.entries(HELP)) LINES.set(`help.${id}`, () => h.say)
for (const [m, v] of Object.entries(EMPATHY)) LINES.set(`empathy.${m}`, v)
for (const tp of TOPICS) LINES.set(`topic.${tp.id}`, () => tp.say)
for (const [id, talk] of Object.entries(TOPIC_TALK)) {
  talk.lines.forEach((v, i) => LINES.set(`topic.${id}.${i}`, v))
  LINES.set(`topic.${id}.tip`, talk.tip)
}
VENT_REPLIES.forEach((v, i) => LINES.set(`vent.reply.${i}`, v))
CHEERS.forEach((v, i) => LINES.set(`cheer.${i}`, v))
SHARE_REPLIES.forEach((v, i) => LINES.set(`share.reply.${i}`, v))
NEXT_LABELS.forEach((v, i) => LINES.set(`next.${i}`, v))

/**
 * A line in the current language; '' for a key this version doesn't know
 * (an old saved chat), which the thread then skips. "mood:tired" is what
 * "I" say when picking that mood on the home card or in the chat.
 */
export function say(key: string): string {
  if (key.startsWith('mood:')) return MOOD_BY_KEY[key.slice(5) as Mood]?.say ?? ''
  const v = LINES.get(key)
  if (!v) return ''
  return typeof v === 'function' ? v() : tx(v)
}
