import { AnimatePresence, motion } from 'motion/react'
import { LogOut, Mail, UserRound } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Button, Section } from '@/components/ui'
import { signOut, useAuth } from '@/lib/auth'
import { t } from '@/lib/i18n'
import { spring } from '@/lib/motion'

/** Live mode only: which account this is, and a way out (after a quick "แน่ใจไหม"). */
export function Account() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [asking, setAsking] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const email = session?.user.email
  const viaGoogle = session?.user.app_metadata?.provider === 'google'
  const ids = useId()

  // asking takes the focus to the safe answer; "ยังก่อน" hands it back to "ออกจากระบบ"
  const out = useRef<HTMLButtonElement>(null)
  const stay = useRef<HTMLButtonElement>(null)
  const focusTo = useRef<'stay' | 'out' | null>(null)
  useEffect(() => {
    const to = focusTo.current
    focusTo.current = null
    if (to === 'stay') stay.current?.focus()
    else if (to === 'out') out.current?.focus()
  }, [asking])
  const ask = (on: boolean) => {
    focusTo.current = on ? 'stay' : 'out'
    setAsking(on)
  }

  const leave = async () => {
    setLeaving(true)
    try {
      await signOut()
      navigate('/', { replace: true })
    } finally {
      setLeaving(false)
    }
  }

  return (
    <Section tone="peach" icon={<UserRound size={18} strokeWidth={2.4} />} title={t('บัญชีของเรา', 'My account')}>
      <div className="card rounded-3xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-sky/50">
            <Mail size={19} aria-hidden />
          </span>
          <span className="min-w-0 flex-[1_1_12rem]">
            <span className="block text-sm text-ink-soft">{viaGoogle ? t('เข้าสู่ระบบด้วย Google', 'Signed in with Google') : t('เข้าสู่ระบบด้วยอีเมล', 'Signed in with email')}</span>
            <span className="block truncate font-semibold text-ink">{email ?? t('บัญชีนี้', 'This account')}</span>
          </span>
          <Button
            ref={out}
            variant="soft"
            icon={<LogOut size={17} aria-hidden />}
            aria-expanded={asking}
            aria-controls={asking ? `${ids}-ask` : undefined}
            onClick={() => ask(!asking)}
          >
            {t('ออกจากระบบ', 'Sign out')}
          </Button>
        </div>

        <AnimatePresence initial={false}>
          {asking && (
            <motion.div
              key="ask"
              id={`${ids}-ask`}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={spring.soft}
              className="overflow-hidden"
            >
              <div role="group" aria-labelledby={`${ids}-q`} className="mt-3 rounded-2xl bg-peach/30 p-3">
                <p id={`${ids}-q`} className="font-display font-semibold text-ink">
                  {t('ออกจากระบบตอนนี้เลยไหม?', 'Sign out now?')}
                </p>
                <p id={`${ids}-what`} className="text-sm text-ink-soft">
                  {t('แชทและโปรไฟล์ยังอยู่ครบ กลับมาเข้าด้วยบัญชีเดิมได้ทุกเมื่อ', 'Your chats and profile stay safe. Come back with the same account any time')}
                </p>
                <div className="mt-2.5 flex flex-wrap-reverse justify-end gap-2">
                  <Button ref={stay} variant="ghost" size="sm" disabled={leaving} aria-describedby={`${ids}-q ${ids}-what`} onClick={() => ask(false)}>
                    {t('ยังก่อน', 'Not now')}
                  </Button>
                  <Button variant="dark" size="sm" icon={<LogOut size={15} aria-hidden />} disabled={leaving} onClick={leave}>
                    {leaving ? t('กำลังออก…', 'Signing out…') : t('ออกเลย', 'Sign out')}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {!asking && (
        <p className="mt-2 px-1 text-xs text-ink-soft">
          {t('ออกจากระบบแล้ว แชทและโปรไฟล์ยังอยู่ครบ กลับมาเข้าด้วยบัญชีเดิมได้ทุกเมื่อ', 'Your chats and profile stay safe when you sign out. Come back with the same account any time')}
        </p>
      )}
    </Section>
  )
}
