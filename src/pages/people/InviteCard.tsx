import { BookOpen, CalendarDays, Clock3, Ear, Gamepad2, Globe2, Hand, Languages, MapPin, MessageCircle, Repeat2, Sprout, Truck, Undo2, Users, type LucideIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Avatar, Button, Chip, Sheet, SignalMeter, TagChip } from '@/components/ui'
import { usePeople } from '@/data/hooks'
import { tagOf } from '@/data/tags'
import { CATEGORY_COLOR, MOCHI } from '@/lib/colors'
import { known, t } from '@/lib/i18n'
import { useMoshi } from '@/lib/store'
import type { Intent, IntentTemplate, MatchResult, User } from '@/lib/types'
import { AvatarStack, PopToggle, type StackPerson } from '@/pages/rooms/bits'
import { agoLabel } from '@/pages/rooms/roomData'
import { TEMPLATE_LABEL, WHEN_LABEL } from './lib'

const TEMPLATE_ICON: Record<IntentTemplate, LucideIcon> = {
  play: Gamepad2,
  talk: MessageCircle,
  lang: Languages,
  event: CalendarDays,
  newbie: Sprout,
  study: BookOpen,
  moved: Truck,
  listen: Ear,
}

/**
 * Someone else's "ชวนเล่น" post with the real "ฉันด้วย" toggle. The poster sees who said
 * "ฉันด้วย" on their own post, so the card says so once we're in. Joining is one tap;
 * taking it back asks first.
 * `match` adds who posted it and our signal (the board); leave it out on their own profile.
 */
export function InviteCard({ intent, poster, match }: { intent: Intent; poster: User; match?: MatchResult }) {
  const joined = useMoshi((s) => s.joinedIntentIds.includes(intent.id))
  const toggle = useMoshi((s) => s.toggleJoinIntent)
  const meColor = useMoshi((s) => s.me.color)
  const people = usePeople()
  const Icon = TEMPLATE_ICON[intent.template]
  const tag = tagOf(intent.tagId)
  const c = MOCHI[tag ? CATEGORY_COLOR[tag.category] : 'peach']
  const crowd = useMemo<StackPerson[]>(() => {
    const byId = new Map(people.map((u) => [u.id, u]))
    const others = intent.joinedBy.flatMap((id) => {
      const u = byId.get(id)
      return u ? [{ id: u.id, color: u.color }] : []
    })
    return joined ? [{ id: 'me', color: meColor, face: 'happy' as const }, ...others] : others
  }, [intent.joinedBy, people, joined, meColor])
  const left = intent.role === 'host' && intent.slots != null ? Math.max(0, intent.slots - (joined ? 1 : 0)) : undefined
  const [asking, setAsking] = useState(false)
  const withdraw = () => {
    // the sheet's buttons stay live while it slides away: a second tap must not join again
    if (useMoshi.getState().joinedIntentIds.includes(intent.id)) toggle(intent.id)
    setAsking(false)
  }

  return (
    <article className="card relative flex h-full flex-col overflow-hidden rounded-[2rem] p-4 sm:p-5">
      <span aria-hidden className="absolute inset-x-0 top-0 h-1.5" style={{ background: `linear-gradient(90deg, ${c.base}, ${c.shade})` }} />

      {match && (
        <header className="mb-3 flex items-center gap-3">
          <Link to={`/app/people/${poster.id}`} className="group flex min-w-0 flex-1 items-center gap-3 rounded-2xl">
            <Avatar color={poster.color} size={44} online={poster.isOnline} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display font-semibold text-ink group-hover:underline">{poster.name}</span>
              <span className="block text-xs text-ink-soft">{agoLabel(intent.postedMinutesAgo)}</span>
            </span>
          </Link>
          <span className="shrink-0 rounded-full bg-white/90 px-2 py-1 shadow-[inset_0_0_0_1px_var(--color-line)]">
            <SignalMeter level={match.level} size="xs" short className="max-[360px]:[&>span:last-child]:sr-only" />
          </span>
        </header>
      )}

      <div className="flex flex-wrap gap-1.5">
        <Chip size="sm" color="butter" icon={<Icon size={13} strokeWidth={2.4} aria-hidden />}>
          {TEMPLATE_LABEL[intent.template]}
        </Chip>
        {tag && <TagChip tag={tag} size="sm" />}
        <Chip size="sm" icon={<Clock3 size={13} aria-hidden />}>
          {known(intent.whenLabel) ?? WHEN_LABEL[intent.when]}
        </Chip>
        <Chip size="sm" color={intent.mode === 'online' ? 'mint' : 'peach'} icon={intent.mode === 'online' ? <Globe2 size={13} aria-hidden /> : <MapPin size={13} aria-hidden />}>
          {intent.mode === 'online' ? t('ออนไลน์', 'Online') : (known(intent.province) ?? t('เจอตัว', 'In person'))}
        </Chip>
      </div>

      <p className="mt-2.5 font-display text-[17px] leading-normal break-words text-ink">{intent.text}</p>

      {(intent.give || intent.want) && (
        <p className="mt-2 flex items-start gap-1.5 rounded-2xl bg-cream p-2.5 text-sm text-ink-soft">
          <Repeat2 size={15} strokeWidth={2.4} className="mt-0.5 shrink-0" aria-hidden />
          <span className="min-w-0 break-words">
            {intent.give && (
              <>
                {t('ให้ได้: ', 'Can offer: ')}
                <b className="font-semibold text-ink">{known(intent.give)}</b>
              </>
            )}
            {intent.give && intent.want && ' · '}
            {intent.want && (
              <>
                {t('อยากได้: ', 'Wants: ')}
                <b className="font-semibold text-ink">{known(intent.want)}</b>
              </>
            )}
          </span>
        </p>
      )}

      {left !== undefined && (
        <p className="mt-2 inline-flex items-center gap-1.5 self-start rounded-full bg-butter/60 px-3 py-1 text-xs font-semibold text-ink">
          <Users size={13} strokeWidth={2.4} aria-hidden />
          {left > 0 ? t(`ว่างอีก ${left} ที่`, `${left} ${left === 1 ? 'spot' : 'spots'} left`) : t('ครบแล้ว!', 'Full!')}
        </p>
      )}

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-4">
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {crowd.length > 0 && <AvatarStack people={crowd} size={28} max={4} className="shrink-0" />}
          <span className="min-w-0 text-sm text-ink-soft" aria-live="polite">
            {joined
              ? t(`${poster.name}เห็นแล้วว่าเราบอกว่าฉันด้วย`, `${poster.name} can see you said "Me too!"`)
              : crowd.length
                ? t(`${crowd.length} คนบอกว่าฉันด้วย`, `${crowd.length} said "Me too!"`)
                : t('ยังไม่มีใครกด เป็นคนแรกเลย', 'No one yet. Be the first!')}
          </span>
        </span>
        <PopToggle
          on={joined}
          onToggle={() => (joined ? setAsking(true) : toggle(intent.id))}
          labelOn={t('ฉันด้วยแล้ว', "You're in!")}
          labelOff={t('ฉันด้วย', 'Me too!')}
          iconOff={<Hand size={17} strokeWidth={2.4} />}
          ariaLabel={t(`ฉันด้วย ในโพสต์ของ${poster.name}`, `Me too! on ${poster.name}'s post`)}
          className="shrink-0"
        />
      </footer>

      <Sheet open={asking} onClose={() => setAsking(false)} title={t('ไม่ไปด้วยแล้วเหรอ?', 'Not joining anymore?')} width={460}>
        <div className="space-y-4 pb-3">
          <p className="rounded-3xl border border-line bg-white p-3 text-ink">
            {t(
              `${poster.name}เห็นว่าเราบอกว่าฉันด้วยอยู่ ถ้ายกเลิก ชื่อเราจะหายไปจากโพสต์นี้นะ อยากกลับมากดใหม่เมื่อไหร่ก็ได้`,
              `${poster.name} can see you said "Me too!". If you take it back, you'll drop off this post. You can join again anytime`,
            )}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button block onClick={() => setAsking(false)}>
              {t('ยังไปด้วย', 'Still in')}
            </Button>
            <Button variant="secondary" block icon={<Undo2 size={18} aria-hidden />} onClick={withdraw}>
              {t('ไม่ไปแล้ว', 'Take it back')}
            </Button>
          </div>
        </div>
      </Sheet>
    </article>
  )
}
