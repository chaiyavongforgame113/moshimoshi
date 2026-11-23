import { MessageCircle, Radio } from 'lucide-react'
import { Avatar, Button, ButtonLink, Sheet } from '@/components/ui'
import { useChats, usePerson, useWavelengthMatches } from '@/data/hooks'
import { t } from '@/lib/i18n'
import { dismissFirstStepsFollowUp, markWavelengthExplored } from '@/lib/progress'
import type { Chat } from '@/lib/types'
import { chatPhase } from '@/pages/chats/lib'
import { useIsMine } from '@/pages/people/lib'

function needsReply(chat: Chat, isMine: (id: string) => boolean) {
  if (chat.closedAt) return false
  const phase = chatPhase(chat)
  if (phase === 'incoming') return true
  if (phase !== 'open') return false
  const last = [...chat.messages].reverse().find(
    (message) => message.kind !== 'system' && message.kind !== 'mochi' && (isMine(message.userId) || message.userId === chat.withUserId),
  )
  return last ? last.userId === chat.withUserId : chat.unread > 0
}

export function FirstStepsFollowUp({ userId, open }: { userId: string; open: boolean }) {
  const chats = useChats()
  const isMine = useIsMine()
  const matches = useWavelengthMatches()
  const waiting = chats.find((chat) => needsReply(chat, isMine))
  const chattedWith = new Set(chats.map((chat) => chat.withUserId))
  const match = waiting ? undefined : matches.find((person) => !chattedWith.has(person.userId))
  const person = usePerson(waiting?.withUserId ?? match?.userId)
  const dismiss = () => dismissFirstStepsFollowUp(userId)

  const to = waiting ? `/app/chats/${waiting.id}` : person ? `/app/people/${person.id}` : '/app/people'
  const label = waiting ? t('เปิดแชท', 'Open chat') : person ? t('ดูโปรไฟล์', 'View profile') : t('ดูคนคลื่นเดียวกัน', 'Explore Wavelength')
  const detail = waiting
    ? person
      ? t(`${person.name} ส่งข้อความมา ลองแวะไปตอบดูไหม?`, `${person.name} sent you a message. Want to reply?`)
      : t('มีข้อความรอให้ตอบอยู่', 'You have a message waiting for a reply.')
    : person
      ? t(`ลองทำความรู้จัก ${person.name} คนที่คลื่นตรงกับเรา`, `Meet ${person.name}, someone on your wavelength.`)
      : t('แวะไปดูว่ามีใครคลื่นตรงกับเราบ้าง', 'See who’s on your wavelength.')

  return (
    <Sheet open={open} onClose={dismiss} title={t('ทำขั้นแรกครบแล้ว!', 'First steps complete!')} width={400}>
      <div className="flex items-center gap-3">
        <Avatar color={person?.color ?? 'peach'} size={48} face="happy" />
        <p className="min-w-0 text-sm text-ink-soft">{detail}</p>
      </div>
      <div className="mt-4 flex flex-col gap-1">
        <ButtonLink to={to} onClick={() => {
          dismiss()
          if (!waiting) markWavelengthExplored(userId)
        }} icon={waiting ? <MessageCircle size={18} /> : <Radio size={18} />}>
          {label}
        </ButtonLink>
        <Button variant="ghost" onClick={dismiss}>
          {t('ไว้ก่อน', 'Maybe later')}
        </Button>
      </div>
    </Sheet>
  )
}
