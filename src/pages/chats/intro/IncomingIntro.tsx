import { motion, useReducedMotion } from 'motion/react'
import { ChevronRight, HeartHandshake, Hourglass, Leaf } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Avatar, Button, ButtonLink, SignalMeter } from '@/components/ui'
import { useMatch, usePerson } from '@/data/hooks'
import { MOCHI } from '@/lib/colors'
import { known, t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import { useMoshi } from '@/lib/store'
import type { IntroRequest } from '@/lib/types'
import { useMochiReasons } from '@/pages/people/intro'
import { MochiReasonList } from '@/pages/people/IntroReasons'
import { ageLabel } from '@/pages/people/lib'
import { Rings } from '@/pages/people/profile/Rings'

const MOCHI_NAME = () => t('น้องโมชิ', 'Little Mochi')

/**
 * "ยินดีรู้จัก" / "ไว้ก่อนนะ" for an intro someone asked Mochi for. Saying yes opens the chat Mochi
 * makes; "ไว้ก่อนนะ" is silent for them (no confirmation: nothing is left or lost, and the note says so).
 */
export function IntroAnswer({ intro, name, primary = true, className = '' }: { intro: IntroRequest; name: string; primary?: boolean; className?: string }) {
  const navigate = useNavigate()
  const respondIntro = useMoshi((s) => s.respondIntro)
  const notify = useMoshi((s) => s.notify)
  const [busy, setBusy] = useState(false)
  const answer = async (accept: boolean) => {
    if (busy) return
    setBusy(true)
    const res = await respondIntro(intro.id, accept)
    setBusy(false)
    if (accept && res.chatId) navigate(`/app/chats/${res.chatId}`)
    // a decline that didn't go through already showed why (and the intro is back in the list)
    if (!accept && res.ok) notify(t('ได้เลย โมชิเก็บไว้เงียบๆ นะ', "Okay. Mochi will keep it quiet"))
  }
  return (
    <div className={className}>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Button
          variant={primary ? 'primary' : 'secondary'}
          icon={<HeartHandshake size={18} aria-hidden />}
          onClick={() => answer(true)}
          disabled={busy}
          className="w-full sm:w-auto"
        >
          {t('ยินดีรู้จัก', "I'd love to")}
        </Button>
        <Button variant="ghost" onClick={() => answer(false)} disabled={busy} className="w-full sm:w-auto">
          {t('ไว้ก่อนนะ', 'Maybe later')}
        </Button>
      </div>
      <p className="mt-2 px-1 text-xs text-ink-soft">
        {t(`กด "ไว้ก่อนนะ" แล้ว${name}จะไม่ได้รับแจ้งอะไรเลย`, `If you pick "Maybe later", ${name} won't be told`)}
      </p>
    </div>
  )
}

/** Chats page, top zone: "โมชิอยากแนะนำ <A> ให้รู้จัก" with A's mochi, Mochi's reasons and the two answers. */
export function IncomingIntroCard({ intro, primary = true }: { intro: IntroRequest; primary?: boolean }) {
  const reduce = useReducedMotion()
  const u = usePerson(intro.withUserId)
  const match = useMatch(intro.withUserId)
  const myAge = useMoshi((s) => s.me.age)
  const reasons = useMochiReasons(intro.withUserId)
  if (!u) return null
  const p = MOCHI[u.color]
  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring.soft}
      aria-label={t(`โมชิอยากแนะนำ ${u.name} ให้รู้จัก`, `Mochi would like you to meet ${u.name}`)}
      className="card relative h-full overflow-hidden rounded-[2rem] p-4 sm:p-5"
    >
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-28" style={{ background: `linear-gradient(180deg, ${p.light}, transparent)` }} />

      {/* Mochi speaks first: a little bubble, like a third person in the chat */}
      <div className="relative flex items-start gap-2.5">
        <Avatar color="peach" size={40} face="wink" label={MOCHI_NAME()} className="shrink-0" />
        <div className="min-w-0 rounded-3xl rounded-tl-md bg-white px-3.5 py-2 shadow-[var(--shadow-soft)]">
          <p className="text-[11px] font-semibold text-ink-soft">{MOCHI_NAME()}</p>
          <p className="font-display text-[17px] leading-snug font-semibold break-words text-ink">
            {t(`โมชิอยากแนะนำ ${u.name} ให้รู้จัก`, `Mochi would love for you to meet ${u.name}`)}
          </p>
        </div>
      </div>

      <Link
        to={`/app/people/${u.id}`}
        data-cursor={t('ดูโปรไฟล์', 'View profile')}
        className="group relative mt-3 flex items-center gap-3 rounded-3xl bg-white/80 p-2.5 pr-2 shadow-[inset_0_0_0_1px_var(--color-line)] transition-colors hover:bg-white"
      >
        <span className="relative flex size-14 shrink-0 items-center justify-center">
          <Rings color={p.shade} size={54} count={2} speed={2.4} />
          <Avatar color={u.color} size={52} face="happy" online={u.isOnline} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-[17px] font-semibold text-ink">{u.name}</span>
          <span className="block truncate text-xs text-ink-soft">
            {ageLabel(myAge, u.age)} · {known(u.province)}
          </span>
          {match && <SignalMeter level={match.level} size="xs" short className="mt-0.5" />}
        </span>
        <ChevronRight size={18} aria-hidden className="shrink-0 text-ink-soft transition-transform group-hover:translate-x-0.5" />
        <span className="sr-only">{t('ดูโปรไฟล์', 'View profile')}</span>
      </Link>

      <h3 className="relative mt-3 text-sm font-semibold text-ink-soft">{t('ทำไมโมชิว่าคลื่นตรงกัน', 'Why Mochi thinks your waves line up')}</h3>
      <MochiReasonList reasons={reasons} className="relative mt-1.5" />

      <IntroAnswer intro={intro} name={u.name} primary={primary} className="relative mt-4" />
    </motion.article>
  )
}

/**
 * An intro I asked for: "รอ <B> อยู่นะ" while it waits, and a kind note once its time ran out
 * (never "turned down": a quiet "no" looks exactly like no answer).
 */
export function OutgoingIntroRow({ intro }: { intro: IntroRequest }) {
  const u = usePerson(intro.withUserId)
  if (!u) return null
  const expired = intro.status === 'expired'
  return (
    <div className={`flex items-center gap-3 rounded-[1.6rem] p-3 ${expired ? 'bg-cream-2/70' : 'bg-white/85 shadow-[var(--shadow-soft)]'}`}>
      <span className="relative shrink-0">
        <Avatar color={u.color} size={46} face={expired ? 'sleepy' : 'wow'} />
        <span className="absolute -right-1 -bottom-1 inline-flex size-5 items-center justify-center rounded-full bg-white text-ink shadow-[var(--shadow-soft)]" aria-hidden>
          {expired ? <Leaf size={11} strokeWidth={2.6} /> : <Hourglass size={11} strokeWidth={2.6} />}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-[16px] font-semibold text-ink">
          {expired ? u.name : t(`รอ ${u.name} อยู่นะ`, `Waiting on ${u.name}`)}
        </span>
        <span className="block text-xs break-words text-ink-soft">
          {expired
            ? t('รอบนี้ยังไม่ได้คำตอบ ไม่เป็นไรนะ โมชิจะลองแนะนำคนอื่นให้นะ', "No answer this time, and that's okay. Mochi will find someone else for you")
            : t('โมชิไปทักให้แล้ว ถ้ายินดีรู้จัก แชทจะเปิดเองเลย', "Mochi said hi for you. If they'd like to meet, the chat opens by itself")}
        </span>
      </span>
    </div>
  )
}

/** Under the list of intros I asked for, once one has run out: the one next step. */
export function FindMoreLink() {
  return (
    <ButtonLink to="/app/people" variant="ghost" size="sm" className="mt-2">
      {t('ไปดูคนคลื่นเดียวกันคนอื่น', 'See others on your wavelength')}
    </ButtonLink>
  )
}
