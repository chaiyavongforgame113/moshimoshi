import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Check } from 'lucide-react'
import { useRef } from 'react'
import { useRooms } from '@/data/hooks'
import { MOCHI } from '@/lib/colors'
import { t } from '@/lib/i18n'
import { fadeUp, spring } from '@/lib/motion'
import { useMoshi } from '@/lib/store'
import type { IntentTemplate } from '@/lib/types'
import type { StepProps } from '../model'
import { INTENT_TEMPLATES } from '../options'
import { keyWiggle } from '../parts/hooks'
import { PostPreview } from '../parts/PostPreview'

/** "คุยเรื่อง…" asks its topic (and shows its post) on the next screen */
const hasPostHere = (tpl: IntentTemplate | null) => !!tpl && tpl !== 'talk'

/**
 * 6 · what brings them here: one card. "คุยเรื่อง…" asks its topic on the next screen
 * (and shows the post there); the others show the post they'll get right here, editable.
 */
export function StepIntent({ draft, update }: StepProps) {
  const province = useMoshi((s) => s.me.province)
  const rooms = useRooms()
  const reduce = useReducedMotion()
  const postBox = useRef<HTMLDivElement>(null)
  // set when a tap reveals the post, so it slides into view once it has opened (not when coming back to this screen)
  const revealed = useRef(false)

  const showPost = () => postBox.current?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
  const pick = (tpl: IntentTemplate) => {
    const reveals = !hasPostHere(draft.intent) && hasPostHere(tpl)
    update({ intent: tpl })
    if (!reveals) return
    // reduced motion: it appears at once, so bring it into view after this render
    if (reduce) requestAnimationFrame(() => requestAnimationFrame(showPost))
    else revealed.current = true
  }

  return (
    <div className="space-y-3">
      <motion.div variants={fadeUp} role="group" aria-label={t('มาที่นี่เพื่อ', 'Here for')} className="grid grid-cols-2 gap-2">
        {INTENT_TEMPLATES.map((tpl) => {
          const on = draft.intent === tpl.id
          const p = MOCHI[tpl.color]
          return (
            <motion.button
              key={tpl.id}
              type="button"
              aria-pressed={on}
              onClick={() => pick(tpl.id)}
              whileTap={reduce ? undefined : { scale: 0.95 }}
              whileHover={reduce ? undefined : { y: -2 }}
              transition={spring.bouncy}
              className={`relative flex min-h-14 items-center gap-2.5 rounded-[1.4rem] border-2 p-2 text-left transition-colors sm:min-h-16 sm:p-3 ${on ? '' : 'border-line bg-white/85 hover:bg-white'}`}
              style={on ? { background: p.light, borderColor: p.shade } : undefined}
            >
              <motion.span
                className="grid size-9 shrink-0 place-items-center rounded-2xl sm:size-10"
                style={{
                  background: `radial-gradient(circle at 35% 30%, white 0%, ${p.light} 30%, ${p.base} 78%, ${p.shade} 100%)`,
                  boxShadow: `inset 0 -3px 0 ${p.shade}`,
                  color: p.ink,
                }}
                animate={reduce ? undefined : { rotate: on ? [0, -10, 8, 0] : 0, scale: on ? [1, 1.15, 1] : 1, transition: keyWiggle }}
                aria-hidden
              >
                <tpl.Icon size={20} strokeWidth={2.2} />
              </motion.span>
              <span className="flex min-w-0 flex-col">
                <span className="font-display text-[14px] leading-snug font-semibold wrap-break-word text-ink sm:text-[15px]">{tpl.label}</span>
                <span className="hidden text-xs leading-snug text-ink-soft sm:block">{tpl.hint}</span>
              </span>
              <AnimatePresence>
                {on && (
                  <motion.span
                    initial={reduce ? false : { scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={spring.bouncy}
                    className="absolute -top-1.5 -right-1.5 grid size-6 place-items-center rounded-full border-2 border-white bg-ink text-cream"
                    aria-hidden
                  >
                    <Check size={13} strokeWidth={3} />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          )
        })}
      </motion.div>

      <AnimatePresence initial={false}>
        {hasPostHere(draft.intent) && (
          <motion.div
            key="post"
            ref={postBox}
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={spring.soft}
            onAnimationComplete={() => {
              if (!revealed.current) return
              revealed.current = false
              showPost() // clear of the bottom action bar on phones (scroll-margin)
            }}
            className="scroll-mb-[calc(7rem+env(safe-area-inset-bottom))] overflow-hidden"
          >
            <PostPreview draft={draft} update={update} province={province} rooms={rooms} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
