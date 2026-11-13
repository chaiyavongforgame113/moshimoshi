import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Dices, Palette, Shirt, SmilePlus } from 'lucide-react'
import { useState } from 'react'
import type { MochiExpression } from '@/components/three'
import { Avatar, tabId, tabPanelId, Tabs, type TabItem } from '@/components/ui'
import { MOCHI, MOCHI_COLORS } from '@/lib/colors'
import { t } from '@/lib/i18n'
import { fadeUp, spring } from '@/lib/motion'
import type { StepProps } from '../model'
import { ACCESSORY_LABEL, ACCESSORY_OPTIONS, COLOR_LABEL, FACE_LABEL, FACE_OPTIONS } from '../options'
import { Pill } from '../parts/Pill'
import { StageBox } from '../parts/StageBox'

const pickOther = <T,>(list: readonly T[], current: T): T => {
  const rest = list.filter((x) => x !== current)
  return rest[Math.floor(Math.random() * rest.length)] ?? current
}

type Part = 'color' | 'face' | 'accessory'

/** Native radios underneath (arrow keys work), puffy visuals on top. */
const radioCls = 'peer sr-only'
const focusRing = 'peer-focus-visible:outline-3 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-lavender'

/**
 * 3 · dress up the mochi. One group of options at a time (สี / หน้า / ของแต่ง) under the
 * live 3D preview, so the whole screen fits a phone without scrolling.
 */
export function StepMochi({ draft, update, desktop, expression, pulse, say }: StepProps & { expression: MochiExpression; pulse: number; say: string | null }) {
  const [part, setPart] = useState<Part>('color')
  const reduce = useReducedMotion()

  const shuffle = () =>
    update((d) => ({
      color: pickOther(MOCHI_COLORS, d.color),
      face: pickOther(FACE_OPTIONS.map((f) => f.id), d.face),
      accessory: pickOther(ACCESSORY_OPTIONS.map((a) => a.id), d.accessory),
    }))

  const tabs: TabItem<Part>[] = [
    { key: 'color', label: t('สี', 'Color'), icon: <Palette size={16} aria-hidden /> },
    { key: 'face', label: t('หน้า', 'Face'), icon: <SmilePlus size={16} aria-hidden /> },
    { key: 'accessory', label: t('ของแต่ง', 'Accessory'), icon: <Shirt size={16} aria-hidden /> },
  ]
  const current = part === 'color' ? COLOR_LABEL[draft.color] : part === 'face' ? FACE_LABEL[draft.face] : ACCESSORY_LABEL[draft.accessory]
  const groupLabel = tabs.find((x) => x.key === part)?.label ?? ''

  return (
    <div className="space-y-3">
      {!desktop && (
        <motion.div variants={fadeUp}>
          <StageBox color={draft.color} expression={expression} accessory={draft.accessory} name={draft.name} pulse={pulse} heightClass="h-40" say={say} />
        </motion.div>
      )}

      <motion.div variants={fadeUp}>
        <Tabs items={tabs} value={part} onChange={setPart} idBase="ob-mochi" />
      </motion.div>

      <motion.div variants={fadeUp} id={tabPanelId('ob-mochi', part)} role="tabpanel" aria-labelledby={tabId('ob-mochi', part)} className="card p-3 sm:p-4">
        <div className="mb-2 flex min-h-11 items-center justify-between gap-2">
          <p className="flex min-w-0 items-baseline gap-1.5 font-display text-[15px] font-semibold text-ink">
            <span className="shrink-0">{groupLabel}</span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={current}
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={spring.soft}
                className="truncate font-body text-sm font-medium text-ink-soft"
              >
                · {current}
              </motion.span>
            </AnimatePresence>
          </p>
          <Pill onClick={shuffle} icon={<Dices size={16} aria-hidden />} color="butter">
            {t('สุ่มให้หน่อย', 'Surprise me')}
          </Pill>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={part}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={spring.soft}
          >
            {part === 'color' && (
              <div role="radiogroup" aria-label={t('สีตัว', 'Color')} className="mx-auto grid max-w-sm grid-cols-7 gap-1.5">
                {MOCHI_COLORS.map((c) => {
                  const p = MOCHI[c]
                  const on = draft.color === c
                  return (
                    <label key={c} className="relative cursor-pointer p-0.5">
                      <input type="radio" name="ob-color" value={c} checked={on} onChange={() => update({ color: c })} className={radioCls} />
                      <motion.span
                        whileTap={{ scale: 0.84 }}
                        whileHover={{ y: -2 }}
                        transition={spring.bouncy}
                        className={`block aspect-square w-full rounded-full ${focusRing}`}
                        style={{
                          background: `radial-gradient(circle at 35% 30%, white 0%, ${p.light} 26%, ${p.base} 68%, ${p.shade} 100%)`,
                          boxShadow: `inset 0 -3px 0 ${p.shade}, 0 8px 16px -8px ${p.shade}`,
                        }}
                      />
                      {on && <motion.span layoutId="ob-swatch-ring" transition={spring.bouncy} className="pointer-events-none absolute -inset-px rounded-full border-[3px] border-ink" />}
                      <span className="sr-only">{COLOR_LABEL[c]}</span>
                    </label>
                  )
                })}
              </div>
            )}

            {part === 'face' && (
              <div role="radiogroup" aria-label={t('หน้าตา', 'Face')} className="grid grid-cols-6 gap-1 max-[359px]:grid-cols-3">
                {FACE_OPTIONS.map((f) => {
                  const on = draft.face === f.id
                  return (
                    <label key={f.id} className="relative cursor-pointer" title={f.label}>
                      <input type="radio" name="ob-face" value={f.id} checked={on} onChange={() => update({ face: f.id })} className={radioCls} />
                      <motion.span whileTap={{ scale: 0.9 }} transition={spring.bouncy} className={`relative flex min-h-14 items-center justify-center rounded-2xl p-1 ${focusRing}`}>
                        {on && <motion.span layoutId="ob-face-bg" transition={spring.bouncy} className="absolute inset-0 rounded-2xl border-2 border-peach bg-peach/25" />}
                        <span className="relative">
                          <Avatar color={draft.color} size={42} face={f.id} />
                        </span>
                      </motion.span>
                      <span className="sr-only">{f.label}</span>
                    </label>
                  )
                })}
              </div>
            )}

            {part === 'accessory' && (
              <div role="radiogroup" aria-label={t('ของแต่งตัว', 'Accessory')} className="grid grid-cols-5 gap-1">
                {ACCESSORY_OPTIONS.map(({ id, label, Icon }) => {
                  const on = draft.accessory === id
                  return (
                    <label key={id} className="relative cursor-pointer">
                      <input type="radio" name="ob-accessory" value={id} checked={on} onChange={() => update({ accessory: id })} className={radioCls} />
                      <motion.span
                        whileTap={{ scale: 0.88 }}
                        transition={spring.bouncy}
                        className={`relative flex min-h-[4.75rem] flex-col items-center justify-center gap-1 rounded-2xl px-0.5 py-1.5 ${focusRing}`}
                      >
                        {on && <motion.span layoutId="ob-acc-bg" transition={spring.bouncy} className="absolute inset-0 rounded-2xl border-2 border-lavender bg-lavender/25" />}
                        <span className="relative grid size-10 place-items-center rounded-full" style={{ background: on ? MOCHI.lavender.base : MOCHI.cream.light, color: MOCHI.lavender.ink }}>
                          <Icon size={19} strokeWidth={2.2} aria-hidden />
                        </span>
                        <span className="relative w-full text-center text-[11px] leading-tight font-semibold wrap-break-word text-ink sm:text-xs">{label}</span>
                      </motion.span>
                    </label>
                  )
                })}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
