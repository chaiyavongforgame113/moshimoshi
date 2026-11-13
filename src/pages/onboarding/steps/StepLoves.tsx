import { AnimatePresence, motion, useAnimate, useReducedMotion } from 'motion/react'
import { Star } from 'lucide-react'
import { useEffect, useState } from 'react'
import { tagOf } from '@/data/tags'
import { CATEGORY_COLOR, MOCHI } from '@/lib/colors'
import { t } from '@/lib/i18n'
import { fadeUp, spring } from '@/lib/motion'
import { MAX_LOVES, type StepProps } from '../model'
import { keyWiggle } from '../parts/hooks'

/** 5 · star up to three of the interests just picked as "รักมาก" (skippable). */
export function StepLoves({ draft, update }: StepProps) {
  const [starScope, wiggleStars] = useAnimate<HTMLSpanElement>()
  const [notice, setNotice] = useState(0)
  const reduce = useReducedMotion()
  const full = draft.loves.length >= MAX_LOVES

  useEffect(() => {
    if (!notice) return
    const t = window.setTimeout(() => setNotice(0), 2600)
    return () => window.clearTimeout(t)
  }, [notice])

  const toggle = (id: string) => {
    if (draft.loves.includes(id)) return update((d) => ({ loves: d.loves.filter((x) => x !== id) }))
    if (full) {
      setNotice(Date.now())
      if (!reduce && starScope.current) wiggleStars(starScope.current, { rotate: [0, -10, 10, -6, 6, 0], scale: [1, 1.15, 1] }, { duration: 0.45 })
      return
    }
    update((d) => ({ loves: [...d.loves, id] }))
  }

  return (
    <div className="space-y-4">
      <motion.p variants={fadeUp} className="flex items-center gap-2 text-sm font-semibold text-ink" aria-live="polite">
        <span ref={starScope} className="inline-flex gap-0.5" aria-hidden>
          {Array.from({ length: MAX_LOVES }, (_, i) => (
            <Star key={i} size={18} className={i < draft.loves.length ? 'text-ink' : 'text-ink/25'} fill={i < draft.loves.length ? MOCHI.butter.shade : 'none'} strokeWidth={2} />
          ))}
        </span>
        {t(`รักมาก ${draft.loves.length}/${MAX_LOVES}`, `Love it ${draft.loves.length}/${MAX_LOVES}`)}
      </motion.p>

      <motion.ul variants={fadeUp} aria-label={t('เรื่องที่เลือกไว้', 'Your interests')} className="flex flex-wrap gap-2">
        {draft.tags.map((id) => {
          const tag = tagOf(id)
          if (!tag) return null
          const loved = draft.loves.includes(id)
          const p = MOCHI[CATEGORY_COLOR[tag.category]]
          return (
            <li key={id} className="max-w-full">
              <motion.button
                type="button"
                aria-pressed={loved}
                aria-label={t(`ติดดาวรักมาก ${tag.label}`, `Star ${tag.label} as Love it`)}
                onClick={() => toggle(id)}
                whileTap={reduce ? undefined : { scale: 0.9 }}
                transition={spring.bouncy}
                className={`inline-flex min-h-12 max-w-full items-center gap-2 rounded-full border-2 px-4 text-[15px] font-medium transition-colors ${
                  loved ? 'text-ink' : 'border-line bg-white/90 text-ink hover:bg-white'
                }`}
                style={loved ? { background: MOCHI.butter.base, borderColor: MOCHI.butter.shade, boxShadow: `inset 0 -3px 0 ${MOCHI.butter.shade}` } : undefined}
              >
                <motion.span
                  animate={reduce ? undefined : { rotate: loved ? 360 : 0, scale: loved ? [1, 1.35, 1] : 1, transition: keyWiggle }}
                  className="inline-flex"
                  aria-hidden
                >
                  <Star size={17} fill={loved ? 'currentColor' : 'none'} strokeWidth={2.2} style={{ color: loved ? p.ink : undefined }} />
                </motion.span>
                <span className="min-w-0 truncate">{tag.label}</span>
              </motion.button>
            </li>
          )
        })}
      </motion.ul>

      <div aria-live="polite">
        <AnimatePresence>
          {notice > 0 && (
            <motion.p
              key={notice}
              initial={reduce ? false : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl bg-butter/50 px-3 py-2 text-sm text-ink"
            >
              {t(`ติดดาวได้ ${MAX_LOVES} อย่างนะ เอาดาวอันอื่นออกก่อนได้เลย`, `You can star ${MAX_LOVES}. Unstar one first`)}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
