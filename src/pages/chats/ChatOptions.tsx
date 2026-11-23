import { Ellipsis, MessageCircleOff, Star } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button, IconButton, Sheet } from '@/components/ui'
import { t } from '@/lib/i18n'
import { toggleChatStar } from '@/lib/progress'
import { useMoshi } from '@/lib/store'
import type { Chat } from '@/lib/types'
import { chatPhase } from './lib'

type Step = 'options' | 'confirm' | 'final'

export function ChatOptions({ chat, name, userId, starred }: { chat: Chat; name: string; userId: string; starred: boolean }) {
  const closeChat = useMoshi((s) => s.closeChat)
  const [step, setStep] = useState<Step | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const inFlight = useRef(false)
  const cancel = useRef<HTMLButtonElement>(null)
  const canClose = chatPhase(chat) === 'open'
  const optionsLabel = t(`ตัวเลือกแชทกับ ${name}`, `Chat options for ${name}`)

  useEffect(() => {
    if (step === 'confirm' || step === 'final') cancel.current?.focus()
  }, [step])

  const dismiss = () => {
    if (inFlight.current) return
    setStep(null)
    setFailed(false)
    setAcknowledged(false)
  }

  const confirmClose = async () => {
    if (inFlight.current || step !== 'final' || !canClose || !acknowledged) return
    inFlight.current = true
    setBusy(true)
    setFailed(false)
    try {
      if (await closeChat(chat.id)) setStep(null)
      else setFailed(true)
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return (
    <>
      <IconButton label={optionsLabel} variant="ghost" onClick={() => setStep('options')} aria-haspopup="dialog">
        <Ellipsis size={20} aria-hidden />
      </IconButton>
      <Sheet
        open={step !== null}
        title={step === 'options' || step === null ? optionsLabel : t('ปิดแชทสำหรับทั้งสองคน?', 'Close chat for both people?')}
        onClose={dismiss}
        width={420}
      >
        {step === 'options' ? (
          <div className="grid gap-2 px-5 pb-2">
            <Button variant="secondary" icon={<Star size={17} fill={starred ? 'currentColor' : 'none'} aria-hidden />} onClick={() => {
              toggleChatStar(userId, chat.id)
              dismiss()
            }}>
              {starred ? t('เอาดาวออก', 'Unstar chat') : t('ติดดาวแชท', 'Star chat')}
            </Button>
            {canClose && (
              <Button variant="ghost" icon={<MessageCircleOff size={17} aria-hidden />} onClick={() => setStep('confirm')}>
                {t('ปิดแชท', 'Close chat')}
              </Button>
            )}
          </div>
        ) : step && (
          <div className="space-y-4 px-5 pb-2">
            <p className="rounded-2xl border border-line bg-white p-3 text-sm text-ink">
              {chat.closedAt
                ? t('แชทนี้ปิดสำหรับทั้งสองคนแล้ว', 'This chat is already closed for both people.')
                : step === 'confirm'
                  ? t(`ถ้าปิดแชท เธอกับ ${name} จะส่งข้อความหากันในแชทนี้ไม่ได้ ทั้งสองคนยังอ่านประวัติได้`, `If you close this chat, you and ${name} will no longer be able to message each other here. Both of you can still read the history.`)
                  : t('ปิดแล้วเปิดใหม่ไม่ได้ ยืนยันอีกครั้งเพื่อปิดแชทสำหรับทั้งสองคน', 'This can’t be undone. Confirm to permanently close the chat for both people.')}
            </p>
            {step === 'final' && canClose && (
              <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} disabled={busy} />
                {t('เข้าใจแล้วว่าปิดแชทถาวร', 'I understand this closes the chat permanently')}
              </label>
            )}
            {failed && <p role="alert" className="text-sm font-semibold text-ink">{t('ปิดแชทไม่สำเร็จ ลองใหม่อีกครั้งนะ', 'Couldn’t close the chat. Please try again.')}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <Button ref={cancel} variant="secondary" onClick={dismiss} disabled={busy}>{t('ยกเลิก', 'Cancel')}</Button>
              {canClose && (step === 'confirm' ? (
                <Button key="continue" variant="secondary" onClick={() => setStep('final')}>
                  {t('ไปต่อ', 'Continue')}
                </Button>
              ) : (
                <Button key="close" variant="dark" onClick={confirmClose} disabled={busy || !acknowledged}>
                  {busy ? t('กำลังปิด…', 'Closing…') : t('ยืนยันปิดแชท', 'Confirm close chat')}
                </Button>
              ))}
            </div>
          </div>
        )}
      </Sheet>
    </>
  )
}
