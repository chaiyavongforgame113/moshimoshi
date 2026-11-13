// Small derived-data helpers shared by the rooms list and the room page.
import { sameTag, TAG_BY_ID, tagsInText } from '@/data/tags'
import { getLang, L, t, texts } from '@/lib/i18n'
import { isLive } from '@/lib/supabase'
import type { IntentRole, IntentWhen, Room, User } from '@/lib/types'

export const roomMembers = (roomId: string, people: User[]): User[] => people.filter((u) => u.rooms.includes(roomId))

/** Room tags I also have, loves first. */
export function sharedRoomTags(room: Room, me: User): string[] {
  return room.tags.filter((t) => me.tags.includes(t)).sort((a, b) => Number(me.loves.includes(b)) - Number(me.loves.includes(a)))
}

/** Room members who share at least one interest with me. */
export function kindredMembers(roomId: string, me: User, people: User[]): User[] {
  return roomMembers(roomId, people).filter((u) => u.tags.some((t) => me.tags.some((mine) => sameTag(mine, t))))
}

/**
 * Rooms with other people chatting now first (busiest first); quiet rooms keep their order, the lobby leading.
 * In live mode a joined room's online count includes me (`mine`), so my own +1 is left out:
 * my joined rooms don't jump ahead of rooms to discover.
 */
export function liveFirst(rooms: Room[], mine: readonly string[] = []): Room[] {
  const others = (r: Room) => r.onlineCount - (isLive && mine.includes(r.id) ? 1 : 0)
  return [...rooms].sort((a, b) => others(b) - others(a) || Number(!!b.isLobby) - Number(!!a.isLobby))
}

/** Matches name / tagline / tag labels, and Thai slang via tagsInText ("วาโล" → Valorant). */
export function roomMatches(room: Room, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (room.name.toLowerCase().includes(q) || room.tagline.toLowerCase().includes(q)) return true
  if (room.tags.some((t) => TAG_BY_ID[t]?.label.toLowerCase().includes(q))) return true
  const ids = tagsInText(q)
  return ids.some((t) => room.tags.includes(t))
}

export const ROLE_LABEL: Readonly<Record<IntentRole, string>> = texts({
  peer: L('หาเพื่อนทำด้วยกัน', 'Looking for buddies'),
  seek: L('อยากหาคนช่วย', 'Looking for help'),
  offer: L('ช่วยได้นะ', 'Happy to help'),
  swap: L('แลกกัน', 'Swap'),
  host: L('เปิดตี้', 'Squad open'),
})

export const WHEN_LABEL: Readonly<Record<IntentWhen, string>> = texts({
  tonight: L('คืนนี้', 'Tonight'),
  weekend: L('เสาร์–อาทิตย์', 'Weekend'),
  anytime: L('เมื่อไหร่ก็ได้', 'Anytime'),
  dated: L('นัดวันไว้แล้ว', 'Date set'),
})

export function agoLabel(minutes: number): string {
  const n = (v: number, one: string, many: string) => `${v} ${v === 1 ? one : many} ago`
  if (minutes < 1) return t('เมื่อกี้', 'Just now')
  if (minutes < 60) return t(`${minutes} นาทีที่แล้ว`, n(minutes, 'min', 'mins'))
  if (minutes < 1440) return t(`${Math.round(minutes / 60)} ชั่วโมงที่แล้ว`, n(Math.round(minutes / 60), 'hour', 'hours'))
  return t(`${Math.round(minutes / 1440)} วันที่แล้ว`, n(Math.round(minutes / 1440), 'day', 'days'))
}

export interface WelcomeParts {
  name: string
  /** undefined on a first visit */
  visit?: number
  /** what they said about themselves */
  hook?: string
}

/**
 * The pieces of a welcome card, written by the server (private.post_room_welcome) or the demo seed:
 * "ยินดีต้อนรับ ไอซ์ (มาครั้งแรก) มาทักทายกันหน่อยนะ" or "… ไอซ์บอกว่า "…" ใครอยากทักทายบ้าง?"
 */
export function parseWelcome(text: string): WelcomeParts | null {
  const m = /^ยินดีต้อนรับ\s+(.+?)\s+\(มาครั้ง(?:แรก|ที่\s*(\d+))\)\s*([\s\S]*)$/.exec(text)
  if (!m) return null
  const [, name, visit, rest] = m
  const said = /บอกว่า\s*"([\s\S]*)"/.exec(rest)
  return { name, visit: visit ? Number(visit) : undefined, hook: said?.[1].trim() || undefined }
}

const WELCOME_TAILS: Record<string, string> = {
  'ใครอยากทักทายบ้าง?': 'Who wants to say hi?',
  'ใครดูอยู่บ้าง?': 'Anyone else watching?',
}

/**
 * Display text of a welcome card. The card body is written in Thai by the server
 * (supabase post_room_welcome) or the demo seed; in English only the template
 * around the person's name and words is translated. Unknown shapes pass through.
 */
export function welcomeText(text: string): string {
  if (getLang() === 'th') return text
  const m = /^ยินดีต้อนรับ\s+(.+?)\s+\(มาครั้ง(?:แรก|ที่\s*(\d+))\)\s*([\s\S]*)$/.exec(text)
  if (!m) return text
  const [, who, visit, rest] = m
  // the server writes เพื่อนใหม่ when the profile has no name
  const nameOf = (n: string) => (n === 'เพื่อนใหม่' ? 'new friend' : n)
  const head = `Welcome, ${nameOf(who)} (${visit ? `visit #${visit}` : 'first visit'})`
  if (!rest || rest === 'มาทักทายกันหน่อยนะ') return rest ? `${head}. Come say hi!` : head
  const said = /^([\s\S]+?)บอกว่า\s*"([\s\S]*)"\s*([\s\S]*)$/.exec(rest)
  if (!said) return `${head}. ${rest}`
  const [, name, words, tail] = said
  const ask = tail ? (WELCOME_TAILS[tail.trim()] ?? tail) : ''
  return `${head}. ${nameOf(name.trim())} says "${words}"${ask ? ` ${ask}` : ''}`
}
