import { motion, useReducedMotion } from 'motion/react'
import { HeartHandshake, Sparkles } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Avatar, Button } from '@/components/ui'
import { useIntroWith, usePerson } from '@/data/hooks'
import { t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import { useMoshi } from '@/lib/store'

interface Props {
  userId: string
  /** 'sm' on small cards; 'md' next to a page's main "ทักแชท" */
  size?: 'sm' | 'md'
  /** on the root: the parent's flex layout (an open explanation or a note takes a full row: sm:basis-full) */
  className?: string
}

/**
 * "ให้โมชิแนะนำให้": the gentle way to meet someone on my wavelength, next to "ทักแชท" (always the
 * secondary action). Tap → one line on what happens (Mochi asks them first; they only see the
 * request) → send. Then "โมชิกำลังไปทักให้นะ" until they answer. Nothing shows when they aren't on my
 * wavelength, when we already chat (the page's own button opens the chat) or when the server piece is off.
 */
export function IntroButton({ userId, size = 'md', className = '' }: Props) {
  const reduce = useReducedMotion()
  const navigate = useNavigate()
  const view = useIntroWith(userId)
  const user = usePerson(userId)
  const requestIntro = useMoshi((s) => s.requestIntro)
  const respondIntro = useMoshi((s) => s.respondIntro)
  const { state } = view
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  // "เขายินดีรู้จักแล้ว" only right after it happened here, not every visit after
  const [seen, setSeen] = useState(view.state)
  const [justMet, setJustMet] = useState(false)
  if (seen !== view.state) {
    setSeen(view.state)
    if ((seen === 'waiting' || seen === 'ready') && view.state === 'accepted') setJustMet(true)
  }
  const confirm = useRef<HTMLButtonElement>(null)
  const opener = useRef<HTMLButtonElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const waitingBox = useRef<HTMLDivElement>(null)
  const wasAsking = useRef(false)
  /** just sent: focus goes onto "โมชิกำลังไปทักให้นะ" (the buttons it replaced are gone) */
  const sentFocus = useRef(false)
  const reasonId = useId()

  // focus follows the explanation: onto "ให้โมชิไปทักเลย" when it opens, back to the button when it
  // closes, or (sent) onto the waiting note, or this box until the note turns up
  useEffect(() => {
    if (asking) confirm.current?.focus()
    else if (wasAsking.current) {
      if (sentFocus.current) (waitingBox.current ?? root.current)?.focus()
      else opener.current?.focus()
    }
    wasAsking.current = asking
  }, [asking])
  useEffect(() => {
    if (state !== 'waiting' || !sentFocus.current) return
    sentFocus.current = false
    waitingBox.current?.focus()
  }, [state])

  if (!user) return null
  const name = user.name
  const btnSize = size === 'sm' ? 'sm' : 'md'
  const enter = reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.97 }

  const send = async () => {
    if (busy) return
    setBusy(true)
    sentFocus.current = await requestIntro(userId)
    setBusy(false)
    setAsking(false)
  }

  const accept = async () => {
    if (busy || !view.intro) return
    setBusy(true)
    const { chatId } = await respondIntro(view.intro.id, true)
    setBusy(false)
    if (chatId) navigate(`/app/chats/${chatId}`)
  }

  let body: ReactNode = null
  let wide = false

  if (state === 'accepted' && justMet) {
    wide = true
    body = (
      <motion.p key="met" initial={enter} animate={{ opacity: 1, y: 0, scale: 1 }} transition={spring.bouncy} className="flex items-start gap-2 rounded-3xl bg-mint/35 px-3.5 py-2.5 text-sm text-ink">
        <Sparkles size={16} strokeWidth={2.4} aria-hidden className="mt-0.5 shrink-0" />
        <span className="min-w-0 break-words">
          {t(`${name}ยินดีรู้จักแล้ว! โมชิเปิดแชทให้ทั้งคู่แล้วนะ`, `${name} would love to meet you! Mochi opened a chat for you both`)}
        </span>
      </motion.p>
    )
  } else if (state === 'waiting') {
    wide = true
    body = (
      <motion.div
        key="waiting"
        ref={waitingBox}
        tabIndex={-1}
        initial={enter}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={spring.soft}
        className="flex items-center gap-2.5 rounded-3xl bg-white/85 px-3 py-2 shadow-[inset_0_0_0_1px_var(--color-line)] outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
      >
        <motion.span
          aria-hidden
          className="shrink-0"
          animate={reduce ? undefined : { y: [0, -3, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Avatar color="peach" size={30} face="wink" />
        </motion.span>
        <span className="min-w-0">
          <span className="block font-display text-sm font-semibold text-ink">{t('โมชิกำลังไปทักให้นะ', 'Mochi is on the way to say hi for you')}</span>
          <span className="block text-xs break-words text-ink-soft">
            {t(`ถ้า${name}ยินดีรู้จัก แชทจะเปิดให้ทั้งคู่เองเลย`, `If ${name} would like to meet you, a chat opens for you both`)}
          </span>
        </span>
      </motion.div>
    )
  } else if (state === 'incoming') {
    wide = true
    body = (
      <motion.div key="incoming" initial={enter} animate={{ opacity: 1, y: 0, scale: 1 }} transition={spring.soft} className="flex flex-wrap items-center gap-2 rounded-3xl bg-butter/35 p-2 pl-3.5">
        <p className="min-w-0 flex-[1_1_12rem] text-sm text-ink">
          {t(`${name}ให้โมชิมาแนะนำตัวกับเธออยู่นะ`, `${name} asked Mochi to introduce you two`)}
        </p>
        <Button size="sm" variant="secondary" icon={<HeartHandshake size={16} aria-hidden />} onClick={accept} disabled={busy}>
          {t('ยินดีรู้จัก', "I'd love to")}
        </Button>
      </motion.div>
    )
  } else if (state === 'limit') {
    body = (
      <span key="limit" className="flex flex-col items-stretch gap-1 sm:items-start">
        <Button size={btnSize} variant="secondary" icon={<Sparkles size={18} aria-hidden />} disabled aria-describedby={reasonId} className="w-full sm:w-auto">
          {t('ให้โมชิแนะนำให้', 'Ask Mochi to introduce us')}
        </Button>
        <span id={reasonId} className="px-1 text-xs text-ink-soft">
          {t('วันนี้โมชิแนะนำให้ครบ 3 คนแล้ว พรุ่งนี้มาให้ช่วยต่อนะ', 'Mochi made 3 intros for you today. More tomorrow')}
        </span>
      </span>
    )
  } else if (state === 'ready') {
    if (asking) {
      wide = true
      body = (
        <motion.div
          key="asking"
          role="group"
          aria-label={t('ให้โมชิแนะนำให้', 'Ask Mochi to introduce us')}
          initial={enter}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={spring.soft}
          onKeyDown={(e) => e.key === 'Escape' && setAsking(false)}
          className="flex flex-wrap items-center gap-2 rounded-[1.75rem] bg-white/90 p-2.5 pl-3 shadow-[var(--shadow-soft)]"
        >
          <span className="flex min-w-0 flex-[1_1_14rem] items-start gap-2.5">
            <Avatar color="peach" size={30} face="happy" className="shrink-0" />
            <span className="min-w-0 text-sm break-words text-ink">
              {t(
                `โมชิจะไปถาม${name}ก่อนนะ ${name}จะเห็นแค่คำขอนี้ ถ้ายินดีรู้จัก แชทจะเปิดให้ทั้งคู่เอง`,
                `Mochi asks ${name} first. They only see this request, and if they'd like to meet you, a chat opens for you both`,
              )}
            </span>
          </span>
          <span className="flex flex-wrap gap-1.5">
            <Button ref={confirm} size="sm" variant="dark" icon={<Sparkles size={16} aria-hidden />} onClick={send} disabled={busy}>
              {t('ให้โมชิไปทักเลย', 'Go ahead, Mochi')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAsking(false)} disabled={busy}>
              {t('ไว้ก่อน', 'Not now')}
            </Button>
          </span>
        </motion.div>
      )
    } else {
      body = (
        <Button
          key="ready"
          ref={opener}
          size={btnSize}
          variant="secondary"
          icon={<Sparkles size={size === 'sm' ? 16 : 18} aria-hidden />}
          onClick={() => setAsking(true)}
          className="w-full sm:w-auto"
        >
          {t('ให้โมชิแนะนำให้', 'Ask Mochi to introduce us')}
        </Button>
      )
    }
  }

  if (!body) return null
  return (
    <div ref={root} tabIndex={-1} aria-live="polite" className={`min-w-0 outline-none ${wide ? 'w-full sm:basis-full' : ''} ${className}`}>
      {body}
    </div>
  )
}
