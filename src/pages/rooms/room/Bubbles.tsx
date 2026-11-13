// Chat bubbles shared by the room chat and an event's chat: someone else's line (with their
// face, name and the ⋯ for reporting or blocking) and my own line.
import { Fragment } from 'react'
import { Link } from 'react-router'
import { Avatar } from '@/components/ui'
import { MOCHI } from '@/lib/colors'
import { known, t } from '@/lib/i18n'
import type { ChatMessage, User } from '@/lib/types'
import { ReactedBadge, SameToggle, type StackPerson } from '../bits'
import { MoreButton } from './MessageActions'

/** Splits "@name" mentions out so they can be highlighted. */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(@\S+)/).map((part, i) =>
        part.startsWith('@') ? (
          <b key={i} className="rounded-md bg-butter/60 px-1 font-semibold">
            {part}
          </b>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  )
}

export function TheirBubble({
  message: m,
  author,
  byId,
  hostIds,
  head,
  me,
  same = false,
  onSame,
  onMore,
  unknownName,
}: {
  message: ChatMessage
  /** undefined: someone we can't see any more (left, or blocked) */
  author: User | undefined
  byId: Map<string, User>
  /** the room's hosts: their name carries the "พี่โมชิ" pill */
  hostIds: readonly string[]
  head: boolean
  me: User
  same?: boolean
  /** "เหมือนกัน!" on this line; left out where reactions don't reach the author yet */
  onSame?: () => void
  /** ⋯ pressed: report the message or block its author */
  onMore?: (el: HTMLButtonElement) => void
  /** the name shown for someone we can't see (default "เพื่อนในห้อง") */
  unknownName?: string
}) {
  const u = author ?? { id: m.userId, name: unknownName ?? t('เพื่อนในห้อง', 'Room member'), color: 'cream' as const, isOnline: false }
  const host = hostIds.includes(u.id)
  const people: StackPerson[] = [
    ...(same ? [{ id: 'me', color: me.color, face: 'happy' as const }] : []),
    ...(m.sameBy ?? []).map((id) => byId.get(id)).filter((p): p is User => !!p),
  ]
  return (
    // group/msg: with a mouse, the ⋯ shows while this message is hovered or has focus inside
    <div className="group/msg flex items-start gap-2.5">
      <div className="w-9 shrink-0">
        {head &&
          (author ? (
            <Link to={`/app/people/${u.id}`} aria-label={t(`ดูโปรไฟล์ ${u.name}`, `See ${u.name}'s profile`)} className="block rounded-full">
              <Avatar color={u.color} size={36} online={u.isOnline} ring={host} />
            </Link>
          ) : (
            <Avatar color={u.color} size={36} />
          ))}
      </div>
      <div className="flex max-w-[82%] min-w-0 flex-col items-start sm:max-w-[75%]">
        {head && (
          <p className="mb-1 flex flex-wrap items-center gap-x-1.5 text-xs leading-normal">
            <span className="font-display text-sm font-semibold text-ink">{u.name}</span>
            {host && <span className="rounded-full bg-butter/70 px-2 py-px font-semibold text-ink">{t('พี่โมชิ', 'Mochi host')}</span>}
            <span className="text-ink-soft">{known(m.at)}</span>
          </p>
        )}
        <p className="max-w-full rounded-3xl rounded-tl-lg border border-line bg-white px-4 py-2.5 text-[15px] leading-relaxed [overflow-wrap:anywhere] text-ink shadow-[var(--shadow-soft)]">
          <RichText text={m.text} />
        </p>
        {(onSame || onMore) && (
          // gap-2: the ⋯'s wider hit area stays clear of "เหมือนกัน!"
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {onSame && <SameToggle on={same} onToggle={onSame} people={people} />}
            {onMore && <MoreButton name={author ? u.name : undefined} onOpen={onMore} />}
          </div>
        )}
      </div>
    </div>
  )
}

export function MyBubble({ message: m, me }: { message: ChatMessage; me: User }) {
  const p = MOCHI[me.color]
  return (
    <div className="flex flex-col items-end">
      <p
        className="max-w-[82%] rounded-3xl rounded-br-lg px-4 py-2.5 text-[15px] leading-relaxed [overflow-wrap:anywhere] shadow-[var(--shadow-soft)] sm:max-w-[75%]"
        style={{ background: `linear-gradient(160deg, ${p.light}, ${p.base})`, color: p.ink }}
      >
        <RichText text={m.text} />
      </p>
      <div className="mt-1 flex max-w-[82%] flex-wrap items-center justify-end gap-x-2 gap-y-1 sm:max-w-[75%]">
        <ReactedBadge ids={m.sameBy} />
        <span className="mr-1 text-[11px] text-ink-soft">{known(m.at)}</span>
      </div>
    </div>
  )
}
