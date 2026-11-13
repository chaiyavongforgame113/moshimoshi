import { motion, useReducedMotion } from 'motion/react'
import { ChevronRight, MessageCircle, MessageCircleHeart, Plus, Radio } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { Avatar, Button, ButtonLink, ReasonIcon, SignalMeter, TagChip } from '@/components/ui'
import { useChats, useDataReady, usePerson, useWavelengthMatches } from '@/data/hooks'
import { known, t } from '@/lib/i18n'
import { fadeUp, stagger } from '@/lib/motion'
import { useMoshi } from '@/lib/store'
import type { MatchResult } from '@/lib/types'
import { chatToOpen } from '@/pages/chats/lib'
import { useWave, waveHref } from '@/pages/me/wave'
import { Block, seeAllClass } from './Block'
import { ageLabel } from './greeting'
import { EmptyNote, InviteButton, SoftSkeleton } from './Soft'

/** people shown on home before "ดูทั้งหมด" */
const TOP = 3

/**
 * Home zone 3, "คนคลื่นเดียวกับเรา": the three best on my wavelength ("ถูกคอ" and up only),
 * leaving out `skip` (the person zone 2 already puts forward) unless they're the only one.
 * Nobody yet: one next step, the wave's missing piece first (no one reaches "ถูกคอ" without
 * it), else bringing friends along (or, with zone 2 already offering that, an invite to post).
 */
export function TopMatches({ skip, inviteAbove = false }: { skip?: string; inviteAbove?: boolean }) {
  const ready = useDataReady()
  const matches = useWavelengthMatches()
  const top = useMemo(() => {
    const rest = skip ? matches.filter((m) => m.userId !== skip) : matches
    return (rest.length ? rest : matches).slice(0, TOP)
  }, [matches, skip])
  const reduce = useReducedMotion()
  const wave = useWave()
  const missing = wave.next

  return (
    <Block
      id="home-matches"
      tone="pink"
      title={t('คนคลื่นเดียวกับเรา', 'People on your wavelength')}
      icon={<Radio size={18} strokeWidth={2.4} />}
      action={
        top.length > 0 && (
          <Link to="/app/people" className={seeAllClass}>
            <span className="max-[400px]:sr-only">{t('ดูทั้งหมด', 'See all')}</span> <ChevronRight size={16} aria-hidden />
          </Link>
        )
      }
    >
      {!ready ? (
        <SoftSkeleton rows={TOP} />
      ) : !top.length ? (
        <EmptyNote
          face="wink"
          title={t('ยังไม่มีใครคลื่นตรงพอเลย', 'No one quite on your wavelength yet')}
          sub={
            missing
              ? t(
                  'โมชิจะโชว์เฉพาะคนที่ถูกคอกับเราจริงๆ เล่าเรื่องของเราอีกนิด คลื่นจะชัดขึ้นและเจอคนที่ใช่ง่ายขึ้นนะ',
                  'Mochi only shows people you really click with. Share a little more and your wave gets clearer and easier to match',
                )
              : inviteAbove
                ? t(
                    'โมชิจะโชว์เฉพาะคนที่ถูกคอกับเราจริงๆ ลองชวนเล่นเรื่องที่ชอบดู คนคลื่นเดียวกันที่แวะมาจะเห็นก่อนใคร',
                    'Mochi only shows people you really click with. Post an invite about something you love, and people on your wavelength will see it first',
                  )
                : t(
                    'โมชิจะโชว์เฉพาะคนที่ถูกคอกับเราจริงๆ ยิ่งมีเพื่อนมาเล่นเยอะ ก็ยิ่งเจอง่ายขึ้นนะ',
                    'Mochi only shows people you really click with. The more friends join, the sooner they turn up',
                  )
          }
        >
          {missing ? (
            <ButtonLink to={waveHref(missing.item.open(wave.context))} variant="secondary" icon={<Radio size={18} aria-hidden />} className="w-full sm:w-auto">
              {missing.item.cta(missing.left)}
            </ButtonLink>
          ) : inviteAbove ? (
            <ButtonLink to="/app/post" variant="secondary" icon={<Plus size={18} strokeWidth={2.8} aria-hidden />} className="w-full sm:w-auto">
              {t('ชวนเล่น', 'Post an invite')}
            </ButtonLink>
          ) : (
            <InviteButton className="w-full sm:w-auto" />
          )}
        </EmptyNote>
      ) : (
        <motion.ul
          variants={stagger(0.07)}
          initial={reduce ? false : 'hidden'}
          whileInView="show"
          viewport={{ once: true }}
          className="space-y-2.5"
        >
          {top.map((m) => (
            <motion.li key={m.userId} variants={fadeUp}>
              <MatchRow match={m} />
            </motion.li>
          ))}
        </motion.ul>
      )}
    </Block>
  )
}

/** One person: tap the row for their profile, or the chat button to say hi (or carry on). */
function MatchRow({ match: m }: { match: MatchResult }) {
  const u = usePerson(m.userId)
  const myAge = useMoshi((s) => s.me.age)
  const navigate = useNavigate()
  const chats = useChats()
  if (!u) return null
  const chatId = chatToOpen(chats, u.id)?.id
  const reason = m.reasons[0]
  const rare = m.sharedTags.find((s) => s.rare)

  return (
    <article className="card flex items-center gap-3 p-3 transition-shadow hover:shadow-[var(--shadow-lift)] sm:p-4">
      <Link to={`/app/people/${u.id}`} className="group flex min-w-0 flex-1 items-center gap-3 rounded-2xl">
        <Avatar color={u.color} size={52} online={u.isOnline} />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2">
            <span className="min-w-0 truncate font-display text-lg font-semibold group-hover:underline group-hover:underline-offset-4">{u.name}</span>
            <SignalMeter level={m.level} size="xs" />
          </span>
          <span className="block truncate text-xs text-ink-soft">
            {ageLabel(myAge, u.age)} · {known(u.province)}
          </span>
          {reason && (
            <span className="mt-1 flex items-start gap-1.5 text-sm text-ink">
              <ReasonIcon kind={reason.kind} />
              <span className="line-clamp-1 min-w-0">{reason.text}</span>
            </span>
          )}
          {rare && !reason && (
            <span className="mt-1 block">
              <TagChip tag={rare.tag} rare size="sm" />
            </span>
          )}
        </span>
      </Link>
      <Button
        variant={chatId ? 'soft' : 'secondary'}
        size="sm"
        onClick={() => navigate(chatId ? `/app/chats/${chatId}` : `/app/people/${u.id}?send=1`)}
        icon={chatId ? <MessageCircle size={17} aria-hidden /> : <MessageCircleHeart size={17} aria-hidden />}
        aria-label={chatId ? t(`ไปที่แชทกับ ${u.name}`, `Go to your chat with ${u.name}`) : t(`ทักแชท ${u.name}`, `Say hi to ${u.name}`)}
        className="h-11 shrink-0 px-3 sm:px-4"
      >
        <span className="max-sm:sr-only">{chatId ? t('ไปที่แชท', 'Go to chat') : t('ทักแชท', 'Say hi')}</span>
      </Button>
    </article>
  )
}
