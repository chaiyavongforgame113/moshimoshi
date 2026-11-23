import { motion, useReducedMotion } from 'motion/react'
import { Clock3, DoorOpen, Languages, Megaphone, MessagesSquare, Quote, Star } from 'lucide-react'
import { Link } from 'react-router'
import { AllDayChip, Button, Chip, RoomIcon, Section, ShowMore, TagChip } from '@/components/ui'
import { useIntents, useRooms } from '@/data/hooks'
import { chatStyleLabel, isAllDay, ONLINE_LABEL, promptKey, promptLabel, tagKey, tagOf } from '@/data/tags'
import { MOCHI } from '@/lib/colors'
import { known, t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import { useMoshi } from '@/lib/store'
import type { MatchResult, User } from '@/lib/types'
import { SameButton } from '@/pages/chats/SameButton'
import { InviteCard } from '../InviteCard'

/** How they like to chat, which languages and when they're around. */
export function AboutBlock({ user, edits }: { user: User; edits?: { style: () => void; online: () => void } }) {
  const rows = [
    {
      key: 'style',
      icon: <MessagesSquare size={15} aria-hidden />,
      label: t('สไตล์การคุย', 'Chat style'),
      edit: edits?.style,
      editLabel: t('แก้สไตล์การคุย', 'Edit chat style'),
      emptyLabel: t('เลือกสไตล์', 'Pick a style'),
      chips: user.chatStyle.map((s) => (
        <Chip key={s} size="sm" color={user.color}>
          {chatStyleLabel(s)}
        </Chip>
      )),
    },
    {
      key: 'lang',
      icon: <Languages size={15} aria-hidden />,
      label: t('ภาษา', 'Languages'),
      chips: user.languages.map((l) => (
        <Chip key={l} size="sm" color="sky">
          {known(l)}
        </Chip>
      )),
    },
    {
      key: 'online',
      icon: <Clock3 size={15} aria-hidden />,
      label: t('ออนไลน์บ่อย', 'Usually online'),
      edit: edits?.online,
      editLabel: t('แก้ช่วงที่มักออนไลน์', "Edit when I'm usually online"),
      emptyLabel: t('เลือกช่วงเวลา', 'Pick times'),
      chips: isAllDay(user.online)
        ? [<AllDayChip key="all-day" />]
        : user.online.map((o) => (
            <Chip key={o} size="sm" color="mint">
              {ONLINE_LABEL[o]}
            </Chip>
          )),
    },
  ].filter((r) => r.chips.length || r.edit)
  if (!rows.length) return null
  return (
    <Section tone="mint" icon={<MessagesSquare size={18} strokeWidth={2.4} />} title={edits ? t('สไตล์ของเรา', 'My style') : t(`สไตล์ของ${user.name}`, `${user.name}'s style`)}>
      <dl className="space-y-3">
        {rows.map((r) => (
          <div key={r.key} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <dt className="flex w-28 shrink-0 items-center gap-1.5 text-sm text-ink-soft">
              {r.icon}
              {r.label}
            </dt>
            <dd className="flex min-w-0 flex-wrap items-center gap-1.5">
              {r.chips}
              {r.edit && (
                <Button size="sm" variant="ghost" onClick={r.edit} aria-label={r.chips.length ? r.editLabel : undefined}>
                  {r.chips.length ? t('แก้', 'Edit') : r.emptyLabel}
                </Button>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}

export function TagsBlock({ match, user }: { match: MatchResult; user: User }) {
  const shared = new Set(match.sharedTags.map((s) => tagKey(s.tag.id)))
  const others = user.tags.flatMap((id) => (shared.has(tagKey(id)) ? [] : (tagOf(id) ?? [])))
  if (!shared.size && !others.length) return null

  return (
    <dl aria-label={t('เรื่องที่ชอบ', 'Interests')} className="mt-3 grid grid-cols-[max-content_minmax(0,1fr)] items-start gap-x-2.5 gap-y-1.5 px-1">
      {shared.size > 0 && (
        <>
          <dt className="pt-1.5 text-xs font-semibold text-ink-soft">{t('ชอบเหมือนกัน', 'You both like')}</dt>
          <dd className="flex min-w-0 flex-wrap gap-1.5">
            {match.sharedTags.map((s) => (
              <TagChip key={s.tag.id} tag={s.tag} rare={s.rare} size="sm" />
            ))}
          </dd>
        </>
      )}
      {others.length > 0 && (
        <>
          <dt className="pt-1.5 text-xs font-semibold text-ink-soft">
            {shared.size ? t('ชอบอีก', 'Also likes') : t('ชอบ', 'Likes')}
          </dt>
          <dd className="min-w-0">
            <ShowMore
              as="div"
              items={others}
              initial={8}
              getKey={(tag) => tag.id}
              listClassName="flex flex-wrap gap-1.5"
              itemClassName="max-w-full"
              render={(tag) => (
                <Chip size="sm" icon={user.loves.includes(tag.id) ? <Star size={12} strokeWidth={2.6} className="fill-butter" aria-label={t('รักมาก', 'Love it')} /> : undefined}>
                  {tag.label}
                </Chip>
              )}
            />
          </dd>
        </>
      )}
    </dl>
  )
}

export function PromptsBlock({ user }: { user: User }) {
  const sames = useMoshi((s) => s.sames)
  const toggleSame = useMoshi((s) => s.toggleSame)
  const reduce = useReducedMotion()
  const p = MOCHI[user.color]
  if (!user.prompts.length) return null
  return (
    <Section tone="butter" icon={<Quote size={18} strokeWidth={2.4} />} title={t(`เรื่องเล่าของ${user.name}`, `${user.name}'s stories`)}>
      <ShowMore
        items={user.prompts}
        initial={2}
        getKey={(pa, i) => `${promptKey(pa)}-${i}`}
        listClassName="grid gap-3 sm:grid-cols-2"
        render={(pa, i) => {
          // the story it belongs to (a question of their own goes by the question's fingerprint)
          const id = `prompt:${user.id}:${promptKey(pa)}`
          const textId = `story-${user.id}-${i}`
          return (
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 18, rotate: i % 2 ? 1.2 : -1.2 }}
              whileInView={{ opacity: 1, y: 0, rotate: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ ...spring.soft, delay: Math.min(i, 3) * 0.06 }}
              className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-white p-5 shadow-[var(--shadow-soft)]"
              style={{ background: `linear-gradient(150deg, ${p.light} 0%, white 80%)` }}
            >
              <Quote size={44} strokeWidth={1.6} aria-hidden className="absolute -top-1 right-3 text-ink opacity-10" />
              <p className="relative text-sm font-semibold text-ink-soft">{promptLabel(pa) ?? t('เล่าให้ฟังหน่อย', 'Tell us something')}</p>
              <p id={textId} className="relative mt-1.5 font-display text-lg leading-normal break-words text-ink">
                “{pa.text}”
              </p>
              <div className="relative mt-auto pt-2">
                <SameButton active={sames.includes(id)} onToggle={() => toggleSame(id)} describedBy={textId} />
              </div>
            </motion.div>
          )
        }}
      />
    </Section>
  )
}

/** Their "ชวนเล่น" posts, each with the real "ฉันด้วย". */
export function IntentsBlock({ user }: { user: User }) {
  const intents = useIntents({ userId: user.id })
  if (!intents.length) return null
  return (
    <Section tone="peach" icon={<Megaphone size={18} strokeWidth={2.4} />} title={t(`${user.name}กำลังชวน`, `${user.name}'s invites`)}>
      <ShowMore items={intents} initial={2} getKey={(i) => i.id} listClassName="grid gap-3 lg:grid-cols-2" render={(i) => <InviteCard intent={i} poster={user} />} />
    </Section>
  )
}

export function RoomsBlock({ user }: { user: User }) {
  const myRooms = useMoshi((s) => s.me.rooms)
  const allRooms = useRooms()
  const rooms = user.rooms.flatMap((id) => allRooms.find((r) => r.id === id) ?? [])
  if (!rooms.length) return null
  return (
    <Section tone="sky" icon={<DoorOpen size={18} strokeWidth={2.4} />} title={t(`ห้องที่${user.name}อยู่`, `${user.name}'s rooms`)}>
      <ShowMore
        items={rooms}
        initial={4}
        getKey={(room) => room.id}
        listClassName="flex flex-wrap gap-2"
        itemClassName="max-w-full"
        render={(room) => (
          <Link
            to={`/app/rooms/${room.id}`}
            className="group inline-flex min-h-14 max-w-full items-center gap-2.5 rounded-full bg-white py-1.5 pr-4 pl-1.5 shadow-[var(--shadow-soft)] transition-transform hover:-translate-y-0.5 active:scale-95"
          >
            <RoomIcon room={room} size={42} />
            <span className="min-w-0 leading-tight">
              <span className="block truncate font-display font-semibold text-ink">{room.name}</span>
              {myRooms.includes(room.id) && !room.isLobby && <span className="block text-xs text-ink-soft">{t('เราก็อยู่ห้องนี้', "You're here too")}</span>}
            </span>
          </Link>
        )}
      />
    </Section>
  )
}
