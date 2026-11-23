import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { MessageCircle, MessageCircleHeart } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router'
import { KineticText, Reveal } from '@/components/motion'
import { Avatar, Button, ButtonLink, PageHeader } from '@/components/ui'
import { useChat, useChats, useDataReady, useMatch, usePerson } from '@/data/hooks'
import { known, t } from '@/lib/i18n'
import { useMoshi } from '@/lib/store'
import type { MatchResult, User } from '@/lib/types'
import { chatPhase, chatToOpen } from '@/pages/chats/lib'
import { ageLabel, useIsMine } from './lib'
import { IntroButton } from './IntroButton'
import { HelloSent } from './profile/HelloSent'
import { ProfileHero } from './profile/ProfileHero'
import { AboutBlock, PromptsBlock, RoomsBlock, TagsBlock } from './profile/ProfileSections'
import { QuizBlock } from './profile/QuizBlock'
import { SafetyMenu } from './profile/SafetyMenu'
import { SendMoshiSheet } from './profile/SendMoshiSheet'
import { PageSkeleton } from './Skeleton'

export default function ProfilePage() {
  const { userId = '' } = useParams()
  const ready = useDataReady()
  const isMine = useIsMine()
  const user = usePerson(userId)
  const match = useMatch(userId)
  const blocked = useMoshi((s) => s.blocked.includes(userId))
  if (isMine(userId)) return <Navigate to="/app/me" replace />
  if (!user && !ready) return <PageSkeleton label={t('กำลังเปิดโปรไฟล์…', 'Opening profile…')} />
  if (!user || !match) return <NotFound blocked={blocked} />
  return <Profile key={user.id} user={user} match={match} />
}

function Profile({ user, match }: { user: User; match: MatchResult }) {
  const reduce = useReducedMotion()
  const myAge = useMoshi((s) => s.me.age)
  const chats = useChats()
  // a hello they sent and we set aside can be answered with a new one; anything else opens the chat
  const chat = chatToOpen(chats, user.id)
  const sendMoshi = useMoshi((s) => s.sendMoshi)
  const [params, setParams] = useSearchParams()
  // "ทักแชท" from a card elsewhere lands here with ?send=1: open the sheet right away
  const [sheetOpen, setSheetOpen] = useState(() => params.get('send') === '1' && !chat)
  const closeSheet = useCallback(() => setSheetOpen(false), [])
  useEffect(() => {
    if (!params.has('send')) return
    setParams(
      (p) => {
        p.delete('send')
        return p
      },
      { replace: true },
    )
  }, [params, setParams])
  const [sent, setSent] = useState<{ chatId: string; opener: string } | null>(null)
  const sentChat = useChat(sent?.chatId)
  useEffect(() => {
    // the server said no (the toast already explains): back to the profile, not a false "sent"
    if (sent && (!sentChat || chatPhase(sentChat) === 'ended')) setSent(null)
  }, [sent, sentChat])

  // live: the id may be temporary until the server answers (useChat follows it); a refusal shows as a toast
  const send = (text: string) => {
    const chatId = sendMoshi(user.id, text)
    setSheetOpen(false)
    setSent({ chatId, opener: text })
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }

  const cta =
    chat ? (
      <ButtonLink to={`/app/chats/${chat.id}`} size="lg" className="w-full sm:w-auto" icon={<MessageCircle size={20} aria-hidden />}>
        {t('ไปที่แชท', 'Go to chat')}
      </ButtonLink>
    ) : (
      <Button size="lg" className="w-full sm:w-auto" icon={<MessageCircleHeart size={20} aria-hidden />} onClick={() => setSheetOpen(true)}>
        {t('ทักแชท', 'Say hi')}
      </Button>
    )

  return (
    <div>
      <PageHeader
        back={(window.history.state as { idx?: number } | null)?.idx ? true : '/app/people'}
        title={<KineticText text={user.name} />}
        subtitle={`${ageLabel(myAge, user.age)} · ${known(user.province)}`}
        action={<SafetyMenu user={user} />}
      />

      <AnimatePresence mode="wait" initial={false}>
        {sent ? (
          <HelloSent key="sent" user={user} chatId={sent.chatId} opener={sent.opener} onBack={() => setSent(null)} />
        ) : (
          <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <AboutBlock user={user} />
            <div className="mt-4">
              <ProfileHero user={user} />
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              {cta}
              <IntroButton userId={user.id} />
            </div>
            <Reveal>
              <TagsBlock match={match} user={user} />
            </Reveal>
            <Reveal>
              <QuizBlock user={user} />
            </Reveal>
            <Reveal>
              <RoomsBlock user={user} />
            </Reveal>
            <Reveal>
              <PromptsBlock user={user} />
            </Reveal>
          </motion.div>
        )}
      </AnimatePresence>

      <SendMoshiSheet open={sheetOpen} onClose={closeSheet} user={user} match={match} onSend={send} />
    </div>
  )
}

function NotFound({ blocked = false }: { blocked?: boolean }) {
  return (
    <div>
      <PageHeader back="/app/people" title={blocked ? t('บล็อกเรียบร้อย', 'Blocked') : t('ไม่เจอเพื่อนคนนี้', "Can't find this friend")} />
      <div className="card mt-4 flex flex-col items-center gap-3 rounded-3xl px-6 py-12 text-center">
        <Avatar color={blocked ? 'mint' : 'sky'} size={96} face={blocked ? 'smile' : 'sleepy'} />
        <h2 className="font-display text-xl font-semibold">{blocked ? t('บล็อกแล้วนะ พักใจได้เลย', 'Blocked. Take a breather') : t('หาเพื่อนคนนี้ไม่เจอแฮะ', "We couldn't find this friend")}</h2>
        <p className="max-w-sm text-ink-soft">
          {blocked
            ? t(
                'จากนี้เขาจะไม่เห็นเรา และทักแชทหาเราไม่ได้ ไปเจอคนที่คลื่นตรงกันต่อกันดีกว่า',
                "From now on they won't see you and can't message you. Let's go find people on your wavelength.",
              )
            : t(
                'เพื่อนคนนี้อาจออกไปพักก่อน หรือลิงก์อาจไม่ถูกต้อง ลองไปดูคนอื่นที่คลื่นตรงกันดีไหม',
                'This friend may be taking a break, or the link might be off. Want to check out others on your wavelength?',
              )}
        </p>
        <ButtonLink to="/app/people" className="mt-2">
          {t('ไปหาคนคลื่นเดียวกัน', 'Find people on your wavelength')}
        </ButtonLink>
      </div>
    </div>
  )
}
