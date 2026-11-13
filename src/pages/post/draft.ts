import { tagOf } from '@/data/tags'
import { known, t } from '@/lib/i18n'
import type { Intent, IntentRole, IntentTemplate, IntentWhen, Room } from '@/lib/types'
import { giveWantFor, LANGS, NOW_LABEL, TEMPLATE_BY_KEY } from './templates'

export const TEXT_MAX = 100
export const TEXT_MIN = 8
export const SLOTS_MAX = 10

/** Everything the ชวนเล่น wizard asks, one step at a time. */
export interface Draft {
  /** step 1; null until it's answered */
  template: IntentTemplate | null
  /** the role that comes with the template (never asked; "เปิดตี้ไว้แล้ว" is `host` below) */
  role: IntentRole
  /** step 2: the main topic (on a language post: the language they want to practice) */
  tagId: string
  /** step 4: what they typed. Until `textTouched`, the post says suggestedText() instead */
  text: string
  textTouched: boolean
  when: IntentWhen
  /** "ตอนนี้เลย": saved as when 'tonight' with NOW_LABEL */
  now: boolean
  /** HH:mm, optional (tonight / dated) */
  time: string
  /** yyyy-mm-dd (dated) */
  date: string
  mode: 'online' | 'offline'
  province: string
  /** "เปิดตี้ไว้แล้ว ขาดอีกกี่คน": role 'host' with `slots` open spots */
  host: boolean
  slots: number
  /** language posts: what they can help with / want to practice (saved Thai for the one-tap languages) */
  give: string
  want: string
  /** room the post was started from (/app/post?room=…); otherwise picked from the tag */
  roomId?: string
  /** editing: the post's saved time label, kept until "when" is touched (a saved date can't be read back) */
  keptWhenLabel?: string
}

export type IntentDraft = Omit<Intent, 'id' | 'userId' | 'postedMinutesAgo' | 'joinedBy'>

export const initialDraft = (province: string): Draft => ({
  template: null,
  role: 'peer',
  tagId: '',
  text: '',
  textTouched: false,
  when: 'anytime',
  now: false,
  time: '',
  date: '',
  mode: 'online',
  province,
  host: false,
  slots: 2,
  give: '',
  want: '',
})

/** Step 1 answered: the template brings its role, format and usual time along. */
export function withTemplate(d: Draft, key: IntentTemplate): Draft {
  if (d.template === key) return d
  const tpl = TEMPLATE_BY_KEY[key]
  const lang = key === 'lang'
  // a topic doesn't carry over into a language swap, or the other way round
  const reset = lang !== (d.template === 'lang') ? { tagId: '', want: '', give: lang ? LANGS[0].value : '' } : {}
  return { ...d, ...reset, template: key, role: tpl.role, mode: tpl.mode, when: tpl.when, now: false, keptWhenLabel: undefined }
}

/** The one-tap language a saved / typed name stands for (Thai or English name, or one of its aliases). */
export function langOf(value: string): (typeof LANGS)[number] | undefined {
  const v = value.trim()
  if (!v) return undefined
  return LANGS.find((l) => l.value === v || known(l.value) === v || tagOf(l.tag)?.label === v)
}

function roleOf(d: Draft): IntentRole {
  if (d.host) return 'host'
  // a language post without anything to give is "looking for help", not a swap
  if (d.template === 'lang') return d.give.trim() ? 'swap' : 'seek'
  return d.role
}

/** Saved with the post and shown to everyone: always Thai (displayed through known()). */
export function whenLabelOf(d: Draft): string | undefined {
  if (d.keptWhenLabel) return d.keptWhenLabel
  if (d.now) return NOW_LABEL
  if (d.when === 'tonight') return d.time ? `คืนนี้ ${d.time}` : 'คืนนี้'
  if (d.when === 'weekend') return 'สุดสัปดาห์นี้'
  if (d.when === 'dated' && d.date) {
    const day = new Date(`${d.date}T00:00`).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })
    return d.time ? `${day} ${d.time}` : day
  }
  return undefined
}

/** "คืนนี้" / "tonight" inside a sentence, in the person's language ('' for anytime). */
function whenWords(d: Draft): string {
  if (d.keptWhenLabel) return t(d.keptWhenLabel, known(d.keptWhenLabel))
  if (d.now) return t('ตอนนี้เลย', 'right now')
  if (d.when === 'tonight') return d.time ? t(`คืนนี้ ${d.time}`, `tonight at ${d.time}`) : t('คืนนี้', 'tonight')
  if (d.when === 'weekend') return t('เสาร์อาทิตย์นี้', 'this weekend')
  if (d.when === 'dated' && d.date) {
    const day = new Date(`${d.date}T00:00`)
    return t(
      `วันที่ ${day.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}`,
      `on ${day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`,
    )
  }
  return ''
}

/** one space between words, none before punctuation, and never longer than a post can be */
const tidy = (text: string) =>
  text
    .replace(/\s+/g, ' ')
    .replace(/ ([.,?!])/g, '$1')
    .trim()
    .slice(0, TEXT_MAX)
    .trim()

/**
 * The line step 4 starts with: a natural sentence made from the answers, written in the
 * person's language (it reads like they wrote it, same as onboarding's first post).
 */
export function suggestedText(d: Draft): string {
  if (!d.template) return ''
  const x = tagOf(d.tagId)?.label || t('เรื่องนี้', 'this')
  const when = whenWords(d)
  const where = d.mode === 'offline' && d.province ? t(`แถว${d.province}`, `around ${known(d.province)}`) : ''
  switch (d.template) {
    case 'play':
      return tidy(t(`หาเพื่อนเล่น ${x} ${when} ชิลๆ ไม่ toxic`, `Looking for friends to play ${x} ${when}. Chill, no toxicity`))
    case 'talk':
      return tidy(t(`อยากมีคนคุยเรื่อง ${x} ${when} คุยยาวๆ ได้เลย`, `Want someone to talk ${x} with ${when}. Happy to chat for hours`))
    case 'lang': {
      const want = d.want.trim()
      const give = d.give.trim()
      if (!want) return ''
      if (give) return tidy(t(`สอน${give}ให้ได้ อยากฝึก${want} แลกกันไหม`, `I can help with ${known(give)} and want to practice ${known(want)}. Swap?`))
      return tidy(t(`อยากหาเพื่อนฝึก${want} ${when} ผิดได้ ขำได้`, `Looking for a friend to practice ${known(want)} with ${when}. Mistakes and laughs welcome`))
    }
    case 'event':
      return tidy(t(`หาเพื่อนไปด้วยกัน ${when} ${where} ใครชอบ ${x} ทักมาเลย ไปคนเดียวเขิน`, `Looking for a buddy ${when} ${where}. Into ${x} too? Going solo is awkward`))
    case 'newbie':
      return tidy(t(`มือใหม่เพิ่งเริ่ม ${x} หาเพื่อนเริ่มไปด้วยกันชิลๆ ${when}`, `Just getting into ${x}. Looking for a chill buddy to start with ${when}`))
    case 'study':
      return tidy(t(`หาเพื่อนทำงานหรือติวด้วยกัน ${when} ใครชอบ ${x} มาเลย เงียบๆ แต่ไม่เหงา`, `Looking for a study buddy ${when}. Into ${x} too? Quiet, but never lonely`))
    case 'moved': {
      const city = t(d.province, known(d.province))
      if (d.tagId === 'movedbkk' || !d.tagId)
        return tidy(t(`เพิ่งย้ายมา${city} อยากมีเพื่อนแถวนี้ไว้ไปกินไปเที่ยวด้วยกัน`, `Just moved to ${city}. Looking for friends nearby to eat and explore with`))
      return tidy(t(`เพิ่งย้ายมา${city} อยากมีเพื่อนแถวนี้ ใครชอบ ${x} ทักมาเลย`, `Just moved to ${city}. Looking for friends nearby, especially if you're into ${x}`))
    }
    case 'listen':
      return tidy(t(`อยากมีคนคุยด้วย ${when} คุยเบาๆ ไม่ตัดสินกัน`, `Could use someone to talk to ${when}. Gentle chats, no judgment`))
  }
}

/** What the post will say: their own words once they've typed, otherwise Mochi's sentence. */
const textOf = (d: Draft): string => (d.textTouched ? d.text.trim() : suggestedText(d))

/** Draft → the intent others will see (and the one matching runs on). `rooms` picks a room from the tag. */
export function toIntent(d: Draft, rooms: Room[]): IntentDraft {
  const role = roleOf(d)
  // a language post keeps both sides even with "เปิดตี้ไว้แล้ว" on
  const gw = d.template === 'lang' ? { give: true, want: true } : giveWantFor(role)
  const tagId = d.tagId
  return {
    template: d.template ?? 'talk',
    role,
    tagId,
    text: textOf(d),
    when: d.when,
    whenLabel: whenLabelOf(d),
    mode: d.mode,
    province: d.mode === 'offline' ? d.province : undefined,
    slots: role === 'host' ? d.slots : undefined,
    give: gw.give && d.give.trim() ? d.give.trim() : undefined,
    want: gw.want && d.want.trim() ? d.want.trim() : undefined,
    // a tag no room lists (anything typed by hand) still lands on a board: the lobby's, same as onboarding
    roomId: d.roomId ?? rooms.find((r) => !r.isLobby && r.tags.includes(tagId))?.id ?? (tagId ? rooms.find((r) => r.isLobby)?.id : undefined),
  }
}

/** One of my posts back in the wizard, to edit. */
export function draftFromIntent(i: Intent, fallbackProvince: string): Draft {
  // "คืนนี้ 21:00" and "ตอนนี้เลย" read back exactly; any other saved label is kept as it is
  const now = i.when === 'tonight' && i.whenLabel === NOW_LABEL
  const tonight = i.when === 'tonight' && !now ? /^คืนนี้(?: (\d{2}:\d{2}))?$/.exec(i.whenLabel ?? 'คืนนี้') : null
  const host = i.role === 'host'
  return {
    template: i.template,
    role: host ? (TEMPLATE_BY_KEY[i.template]?.role ?? 'peer') : i.role,
    tagId: i.tagId,
    text: i.text,
    textTouched: true,
    when: i.when,
    now,
    time: tonight?.[1] ?? '',
    date: '',
    mode: i.mode,
    province: i.province ?? fallbackProvince,
    host,
    slots: i.slots ?? 2,
    give: i.give ?? '',
    want: i.want ?? '',
    roomId: i.roomId,
    keptWhenLabel: now || tonight || i.when === 'anytime' || i.when === 'weekend' ? undefined : i.whenLabel,
  }
}

export interface DraftErrors {
  tag?: string
  text?: string
  date?: string
}

export function validate(d: Draft): DraftErrors {
  const e: DraftErrors = {}
  if (d.template === 'lang' && (!d.want.trim() || !d.tagId)) e.tag = t('เลือกภาษาที่อยากฝึกก่อนนะ', 'Pick the language you want to practice first')
  else if (!d.tagId) e.tag = t('เลือกเรื่องที่อยากชวนก่อนนะ เพื่อนๆ จะได้หาเจอ', 'Pick a topic first so people can find you')
  if (textOf(d).length < TEXT_MIN) e.text = t(`เล่าอีกนิดนะ อย่างน้อย ${TEXT_MIN} ตัวอักษร`, `Tell us a bit more, at least ${TEXT_MIN} characters`)
  if (d.when === 'dated' && !d.date && !d.keptWhenLabel) e.date = t('เลือกวันด้วยนะ', 'Pick a date too')
  return e
}

export const todayISO = () => {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}
