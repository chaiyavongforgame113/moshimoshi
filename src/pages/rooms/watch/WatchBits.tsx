import { MonitorPlay } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { usePeople } from '@/data/hooks'
import { MOCHI } from '@/lib/colors'
import { displayName, t } from '@/lib/i18n'
import { useMoshi } from '@/lib/store'
import type { ChatMessage, RoomWatch } from '@/lib/types'
import { untitled } from './copy'

// ------------------------------------------------------------------ the room chat's "เปิดคลิป" line

const NOTE = 'watch:'

/** A room chat line that is one of these notes (rendered with <WatchNoteLine>, not as a message). */
export const isWatchNote = (m: ChatMessage) => m.kind === 'system' && m.id.startsWith(NOTE)

/**
 * "<name> เปิดคลิป: <title>" in the room chat, where it happened: when a clip goes on while I'm
 * here (or the one already on when I arrive, after the history). Worked out from the room's watch
 * state, which everyone in the room sees, so nothing extra is stored. Notes carry the starter's id
 * (userId) and the title (text); the words are made at render time, in my language.
 */
export function useWatchNotes(watch: RoomWatch | null, messages: ChatMessage[], loading: boolean): ChatMessage[] {
  const [notes, setNotes] = useState<{ key: string; after: number; by: string; title: string }[]>([])
  const key = watch ? `${watch.provider}:${watch.ref}:${watch.startedAt ?? watch.version}` : null
  const count = messages.length
  useEffect(() => {
    if (!watch || !key || loading) return
    setNotes((list) =>
      list.some((n) => n.key === key) ? list : [...list, { key, after: count, by: watch.startedBy ?? '', title: watch.title ?? '' }],
    )
    // only when a clip goes on (count: where the line goes at that moment)
  }, [key, loading])
  return useMemo(() => {
    if (!notes.length) return messages
    const out = [...messages]
    // from the last one back, so the earlier places stay put
    for (const n of [...notes].sort((a, b) => b.after - a.after)) {
      out.splice(Math.min(n.after, out.length), 0, { id: `${NOTE}${n.key}`, userId: n.by, text: n.title, at: '', kind: 'system' })
    }
    return out
  }, [messages, notes])
}

export function WatchNoteLine({ message }: { message: ChatMessage }) {
  const people = usePeople()
  const me = useMoshi((s) => s.me)
  const by = message.userId === me.id ? me : people.find((u) => u.id === message.userId)
  // the id is watch:<provider>:<ref>:<when>
  const provider = message.id.slice(NOTE.length).split(':')[0] as RoomWatch['provider']
  const title = message.text || untitled(provider)
  const name = by ? displayName(by.name) : undefined
  return (
    <span className="inline-flex max-w-full items-start gap-1.5 rounded-2xl bg-white/80 px-3 py-1.5 text-left text-xs text-ink shadow-[var(--shadow-soft)]">
      <span aria-hidden className="mt-px inline-flex size-4 shrink-0 items-center justify-center rounded-md" style={{ background: MOCHI.lavender.base }}>
        <MonitorPlay size={11} strokeWidth={2.6} />
      </span>
      <span className="min-w-0 [overflow-wrap:anywhere]">
        {by?.id === me.id
          ? t(`เราเปิดคลิป: ${title}`, `You put on a clip: ${title}`)
          : name
            ? t(`${name} เปิดคลิป: ${title}`, `${name} put on a clip: ${title}`)
            : t(`เปิดคลิปให้ทุกคนดู: ${title}`, `A clip is on for everyone: ${title}`)}
      </span>
    </span>
  )
}

// ------------------------------------------------------------------ room cards: "กำลังดูด้วยกัน"

/** A room card's line while the room watches a clip (display only: the card itself opens the room). */
export function WatchingBadge({ watch }: { watch: RoomWatch }) {
  const title = watch.title ?? untitled(watch.provider)
  return (
    <p
      className="relative mt-3 flex min-h-11 items-center gap-2 rounded-2xl px-3 py-2 text-sm text-ink"
      style={{ background: MOCHI.lavender.light, boxShadow: `inset 0 0 0 1.5px ${MOCHI.lavender.base}` }}
    >
      <span aria-hidden className="inline-flex size-6 shrink-0 items-center justify-center rounded-lg" style={{ background: MOCHI.lavender.base }}>
        <MonitorPlay size={14} strokeWidth={2.6} />
      </span>
      <span className="min-w-0 flex-1 truncate">
        <b className="font-display">{t('กำลังดูด้วยกัน', 'Watching together')}</b> · {title}
      </span>
    </p>
  )
}

// ------------------------------------------------------------------ the room's top bar: the way in

/** "ดูคลิปด้วยกัน" in the room's top bar (members, while nothing is on). */
export function WatchEntry({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t('เปิดคลิปดูด้วยกัน', 'Watch a clip together')}
      title={t('เปิดคลิปดูด้วยกัน', 'Watch a clip together')}
      className="ml-auto inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-white/90 px-3.5 font-display text-sm font-semibold whitespace-nowrap text-ink shadow-[var(--shadow-soft)] ring-1 ring-line transition-colors hover:bg-white"
    >
      <MonitorPlay size={18} strokeWidth={2.4} aria-hidden />
      <span className="hidden min-[360px]:inline">{t('ดูด้วยกัน', 'Watch')}</span>
    </button>
  )
}
