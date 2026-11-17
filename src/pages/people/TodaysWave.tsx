import { motion, useReducedMotion } from 'motion/react'
import { MessageCircle, MessageCircleHeart, Quote, Sun } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { MochiStage, View3D } from '@/components/three'
import { Button, ReasonIcon, SignalMeter, Zone } from '@/components/ui'
import { useChats } from '@/data/hooks'
import { MOCHI } from '@/lib/colors'
import { known, t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import type { MatchResult, User } from '@/lib/types'
import { chatToOpen } from '@/pages/chats/lib'
import { IntroButton } from './IntroButton'
import { ageLabel, statusLabel, suggestedOpener } from './lib'

/**
 * "คลื่นของวันนี้": one person a day (useDailyPick), big and warm: their 3D mochi, the bars,
 * why the waves line up, a ready first line and one "ทักแชท" button. Already talking → the chat.
 */
export function TodaysWave({ match, user, myAge }: { match: MatchResult; user: User; myAge: number }) {
  const reduce = useReducedMotion()
  const navigate = useNavigate()
  const chat = chatToOpen(useChats(), user.id)
  const p = MOCHI[user.color]
  const opener = suggestedOpener(match, user)

  return (
    <Zone
      tone={user.color}
      icon={<Sun size={18} strokeWidth={2.4} />}
      title={t('คลื่นของวันนี้', "Today's wave")}
      note={t('โมชิเลือกให้วันละคน พรุ่งนี้มีคนใหม่', 'Mochi picks one person a day. Someone new tomorrow')}
      className="mt-5"
    >
      <div className="grid items-center gap-4 md:grid-cols-[minmax(0,15rem)_1fr] md:gap-6">
        <div className="relative">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-6 top-6 bottom-2 rounded-full blur-2xl"
            style={{ background: `radial-gradient(circle, ${p.light} 0%, transparent 70%)` }}
          />
          <View3D className="h-52 w-full sm:h-60" label={t(`น้องโมชิของ${user.name}กำลังโบกทักทาย`, `${user.name}'s little Mochi is waving hello`)}>
            <MochiStage color={user.color} expression="happy" zoom={1.1} />
          </View3D>
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 8, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...spring.bouncy, delay: 0.2 }}
            className="absolute top-1 left-1 max-w-[70%] rounded-3xl rounded-bl-md bg-white px-3.5 py-2 font-display text-sm leading-snug font-semibold text-ink shadow-[var(--shadow-soft)]"
          >
            {t(`โมชิโมชิ~ ${user.name}เองนะ`, `Moshi moshi~ It's ${user.name}!`)}
          </motion.p>
        </div>

        <div className="min-w-0">
          <h3 className="font-display text-2xl leading-tight font-semibold break-words">
            <Link to={`/app/people/${user.id}`} className="rounded-md hover:underline hover:decoration-2 hover:underline-offset-4">
              {user.name}
            </Link>
          </h3>
          <p className="mt-0.5 text-sm text-ink-soft">
            {ageLabel(myAge, user.age)} · {known(user.province)} · {statusLabel(user)}
          </p>
          <span className="mt-2 inline-flex max-w-full rounded-full bg-white/90 px-3 py-1.5 shadow-[inset_0_0_0_1px_var(--color-line)]">
            <SignalMeter level={match.level} size="md" />
          </span>

          {match.reasons.length > 0 && (
            <>
              <h4 className="mt-4 text-sm font-semibold text-ink-soft">{t('ทำไมคลื่นตรงกัน', 'Why your waves line up')}</h4>
              <ul className="mt-1.5 space-y-1.5">
                {match.reasons.slice(0, 3).map((r) => (
                  <li key={r.text} className="flex items-start gap-2 text-sm text-ink">
                    <ReasonIcon kind={r.kind} />
                    <span className="min-w-0">{r.text}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {!chat && (
            <figure className="relative mt-4 rounded-3xl rounded-tl-md bg-white p-3.5 shadow-[var(--shadow-soft)]">
              <Quote size={30} strokeWidth={1.6} aria-hidden className="absolute top-2 right-3 text-ink opacity-10" />
              <figcaption className="text-xs font-semibold text-ink-soft">{t('ลองทักว่า', 'Try saying')}</figcaption>
              <blockquote className="mt-0.5 text-[15px] leading-relaxed text-ink">{opener}</blockquote>
            </figure>
          )}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              size="lg"
              className="w-full sm:w-auto"
              icon={chat ? <MessageCircle size={20} aria-hidden /> : <MessageCircleHeart size={20} aria-hidden />}
              onClick={() => navigate(chat ? `/app/chats/${chat.id}` : `/app/people/${user.id}?send=1`)}
            >
              {chat ? t('ไปที่แชท', 'Go to chat') : t('ทักแชท', 'Say hi')}
            </Button>
            {/* the gentle way: Mochi asks them first */}
            <IntroButton userId={user.id} />
          </div>
        </div>
      </div>
    </Zone>
  )
}
