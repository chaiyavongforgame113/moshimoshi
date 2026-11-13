import { motion, useReducedMotion } from 'motion/react'
import { ChevronDown, Clock3, DoorOpen, Heart, Languages, Megaphone, MessagesSquare, Quote, Radio, Star } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { AllDayChip, Chip, ReasonIcon, RoomIcon, Section, ShowMore, SignalMeter, TagChip, WaveMatch } from '@/components/ui'
import { useIntents, useRooms } from '@/data/hooks'
import { chatStyleLabel, isAllDay, ONLINE_LABEL, promptKey, promptLabel, tagKey, tagOf } from '@/data/tags'
import { MOCHI, SIGNAL_GRADIENT } from '@/lib/colors'
import { known, L, t, tx } from '@/lib/i18n'
import { BREAKDOWN_LABEL, signalMeta } from '@/lib/matching'
import { spring } from '@/lib/motion'
import { useMoshi } from '@/lib/store'
import type { MatchBreakdown, MatchResult, User } from '@/lib/types'
import { SameButton } from '@/pages/chats/SameButton'
import { InviteCard } from '../InviteCard'
import { suggestedOpener } from '../lib'

const DOT_WORD = [
  L('ยังไม่ตรง', 'Not yet'),
  L('นิดหน่อย', 'A little'),
  L('พอใช้', 'Some'),
  L('ตรงกัน', 'A match'),
  L('ตรงมาก', 'A strong match'),
  L('ตรงเป๊ะ', 'Spot on'),
]

/** Five dots for one part of the wave (never a number). */
function PartDots({ value }: { value: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(value * 5)))
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          aria-hidden
          className="size-2 rounded-full"
          style={{ background: i < filled ? SIGNAL_GRADIENT[Math.min(4, filled - 1)] : 'rgb(59 38 34 / 0.12)' }}
        />
      ))}
      <span className="sr-only">{tx(DOT_WORD[filled])}</span>
    </span>
  )
}

/**
 * "ทำไมคลื่นตรงกัน": the signal, the top reasons, one ready first line and the page's one
 * primary action (`cta`, wrapped so the page can tell when it scrolls away). What the wave
 * is made of folds open underneath; parts with no data yet are left out.
 */
export function WhyBlock({ match, user, cta, showOpener }: { match: MatchResult; user: User; cta: ReactNode; showOpener: boolean }) {
  const meta = signalMeta(match.level)
  const [open, setOpen] = useState(false)
  const id = useId()
  const parts = (Object.keys(BREAKDOWN_LABEL) as (keyof MatchBreakdown)[]).filter(
    (k) => !match.missing.includes(k) && (k !== 'intent' || match.breakdown.intent > 0),
  )
  return (
    <Section tone="lavender" icon={<Radio size={18} strokeWidth={2.4} />} title={t('ทำไมคลื่นตรงกัน', 'Why your waves line up')}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xl leading-snug font-semibold text-ink">{meta.label}</p>
          <p className="text-sm text-ink-soft">{meta.hint}</p>
        </div>
        <SignalMeter level={match.level} size="lg" showLabel={false} className="shrink-0" />
      </div>
      <WaveMatch level={match.level} height={40} className="mt-2 opacity-80" />

      {match.reasons.length ? (
        <ul className="mt-2 space-y-2">
          {match.reasons.slice(0, 3).map((r) => (
            <li key={r.text} className="flex items-start gap-2.5 text-[15px] text-ink">
              <ReasonIcon kind={r.kind} />
              <span className="min-w-0">{r.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-ink-soft">
          {t(`ยังไม่เจอเรื่องที่ตรงกันเป๊ะ ลองทักไปถามเรื่องที่${user.name}ชอบดูสิ อาจได้เปิดโลกใหม่`, `Nothing lines up exactly yet. Ask ${user.name} about what they love, it might open up a whole new world`)}
        </p>
      )}

      {showOpener && (
        <figure className="relative mt-4 rounded-3xl rounded-tl-md bg-white p-3.5 shadow-[var(--shadow-soft)]">
          <Quote size={30} strokeWidth={1.6} aria-hidden className="absolute top-2 right-3 text-ink opacity-10" />
          <figcaption className="text-xs font-semibold text-ink-soft">{t('ลองทักว่า', 'Try saying')}</figcaption>
          <blockquote className="mt-0.5 pr-6 text-[15px] leading-relaxed text-ink">{suggestedOpener(match, user)}</blockquote>
        </figure>
      )}

      <div className="mt-4">{cta}</div>

      <div className="mt-4 border-t-2 border-dashed border-lavender/50 pt-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-parts`}
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-11 w-full items-center justify-between gap-2 rounded-2xl px-1 text-left text-sm font-semibold text-ink-soft hover:text-ink"
        >
          {t('ดูว่าคลื่นคิดจากอะไร', 'See what the wave is made of')}
          <ChevronDown size={18} aria-hidden className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <dl id={`${id}-parts`} className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {parts.map((k) => (
              <div key={k} className="flex items-center justify-between gap-3 rounded-2xl bg-cream px-3 py-2">
                <dt className="min-w-0 text-sm text-ink-soft">{BREAKDOWN_LABEL[k]}</dt>
                <dd>
                  <PartDots value={match.breakdown[k]} />
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </Section>
  )
}

/** How they like to chat, which languages and when they're around. */
export function AboutBlock({ user }: { user: User }) {
  const rows = [
    {
      key: 'style',
      icon: <MessagesSquare size={15} aria-hidden />,
      label: t('สไตล์การคุย', 'Chat style'),
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
      chips: isAllDay(user.online)
        ? [<AllDayChip key="all-day" />]
        : user.online.map((o) => (
            <Chip key={o} size="sm" color="mint">
              {ONLINE_LABEL[o]}
            </Chip>
          )),
    },
  ].filter((r) => r.chips.length)
  if (!rows.length) return null
  return (
    <Section tone="mint" icon={<MessagesSquare size={18} strokeWidth={2.4} />} title={t(`สไตล์ของ${user.name}`, `${user.name}'s style`)}>
      <dl className="space-y-3">
        {rows.map((r) => (
          <div key={r.key} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <dt className="flex w-28 shrink-0 items-center gap-1.5 text-sm text-ink-soft">
              {r.icon}
              {r.label}
            </dt>
            <dd className="flex min-w-0 flex-wrap gap-1.5">{r.chips}</dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}

export function TagsBlock({ match, user }: { match: MatchResult; user: User }) {
  const shared = new Set(match.sharedTags.map((s) => tagKey(s.tag.id)))
  const others = user.tags.flatMap((id) => (shared.has(tagKey(id)) ? [] : (tagOf(id) ?? [])))
  return (
    <Section tone="pink" icon={<Heart size={18} strokeWidth={2.4} />} title={t('ชอบเหมือนกัน', 'You both like')}>
      {match.sharedTags.length ? (
        <div className="flex flex-wrap gap-2">
          {match.sharedTags.map((s) => (
            <span key={s.tag.id} className="max-w-full">
              <TagChip tag={s.tag} rare={s.rare} />
            </span>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl bg-white/70 p-4 text-ink-soft">
          {t('ยังไม่มีเรื่องที่ชอบตรงกันเป๊ะ ลองชวนคุยเรื่องใหม่ๆ ดูสิ อาจได้เปิดโลก', 'No exact matches yet. Try chatting about something new, it might open up a whole new world')}
        </p>
      )}
      {match.sharedTags.some((s) => s.rare) && (
        <p className="mt-2 text-xs text-ink-soft">
          {t('เรื่องที่มีอัญมณี คือเรื่องที่ไม่ค่อยมีใครชอบ เจอคนชอบเหมือนกันถือว่าโชคดีนะ', 'A gem marks something few people like. Finding someone who likes it too is lucky!')}
        </p>
      )}
      {others.length > 0 && (
        <>
          <h3 className="mt-5 mb-2 text-sm font-semibold text-ink-soft">{t(`เรื่องอื่นที่${user.name}ชอบ`, `Other things ${user.name} likes`)}</h3>
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
        </>
      )}
    </Section>
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
