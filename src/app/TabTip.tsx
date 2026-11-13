import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { Avatar, Button, type MochiFace } from '@/components/ui'
import { t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import { markTipSeen, tipSeen, type TipKey } from '@/lib/progress'

/** the main tabs that get a first-visit line (home has its first steps instead) */
const TIP_AT: Record<string, TipKey> = {
  '/app/rooms': 'rooms',
  '/app/people': 'people',
  '/app/chats': 'chats',
  '/app/me': 'me',
}

const FACE: Record<TipKey, MochiFace> = { rooms: 'happy', people: 'wink', chats: 'smile', me: 'sparkle' }

function tipText(key: TipKey): string {
  switch (key) {
    case 'rooms':
      return t('ห้องคือที่นั่งเล่นตามเรื่องที่ชอบ เข้าไปพิมพ์ทักเพื่อนๆ ได้เลย', 'Rooms are hangouts for the things you love. Pop in and say hi')
    case 'people':
      return t('ตรงนี้คือคนที่คลื่นตรงกับเรา เรียงจากตรงมากไปน้อยเลย', 'These are people on your wavelength, closest first')
    case 'chats':
      return t('แชท 1:1 กับคนที่ทักกันอยู่ รวมไว้ตรงนี้หมดเลย', 'All your one-on-one chats live here')
    case 'me':
      return t('โปรไฟล์ของเรา ยิ่งเล่าเยอะ คลื่นยิ่งชัดนะ', 'Your profile. The more you share, the clearer your wavelength')
  }
}

/**
 * The tab whose tip shows now, and a way to close it. A tip shows on the first visit to its tab
 * (remembered on this device right away) and stays until it's closed or you move on.
 */
export function useTabTip(): [TipKey | null, () => void] {
  const { pathname } = useLocation()
  const key = TIP_AT[pathname.replace(/\/$/, '')] ?? null
  const [shown, setShown] = useState<TipKey | null>(null)

  useEffect(() => {
    if (key && !tipSeen(key)) {
      markTipSeen(key)
      setShown(key)
      return
    }
    // leaving the tab (or a tab already greeted) hides it; a re-run on the same tab keeps it
    setShown((cur) => (cur === key ? cur : null))
  }, [key])

  return [shown, () => setShown(null)]
}

/**
 * One small Mochi line above the page: what this tab is for, and "เข้าใจแล้ว".
 * It sits in the page flow (never over a button) and doesn't take focus when it appears.
 */
export function TabTip({ tip, onDismiss }: { tip: TipKey | null; onDismiss: () => void }) {
  const reduce = useReducedMotion()

  const dismiss = () => {
    onDismiss()
    // the button is going away: land on the page's title instead of the top of the document
    const title = document.querySelector<HTMLElement>('main h1')
    if (title) {
      if (!title.hasAttribute('tabindex')) title.setAttribute('tabindex', '-1')
      title.focus({ preventScroll: true })
    }
  }

  return (
    <AnimatePresence initial={false}>
      {tip && (
        <motion.aside
          key={tip}
          aria-label={t('เคล็ดลับจากน้องโมชิ', 'A tip from Little Mochi')}
          initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
          transition={reduce ? { duration: 0.15 } : { ...spring.soft, delay: 0.25 }}
          className="overflow-hidden"
        >
          {/* a little room around the card so its soft shadow isn't clipped while it opens */}
          <div className="-mx-1 px-1 pt-[max(0.75rem,env(safe-area-inset-top))] pb-1 lg:pt-6">
            <div className="glass flex items-center gap-3 rounded-[1.75rem] py-2 pr-2 pl-2.5">
              <Avatar color="peach" size={40} face={FACE[tip]} />
              <p className="min-w-0 flex-1 text-sm leading-snug text-ink">
                <span className="font-display font-semibold">{t('น้องโมชิ: ', 'Little Mochi: ')}</span>
                {tipText(tip)}
              </p>
              <Button variant="soft" size="sm" onClick={dismiss} className="h-11 shrink-0">
                {t('เข้าใจแล้ว', 'Got it')}
              </Button>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
