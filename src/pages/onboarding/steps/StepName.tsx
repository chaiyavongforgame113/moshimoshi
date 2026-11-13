import { motion } from 'motion/react'
import type { MochiExpression } from '@/components/three'
import { t } from '@/lib/i18n'
import { fadeUp } from '@/lib/motion'
import { NAME_MAX, type StepProps } from '../model'
import { StageBox } from '../parts/StageBox'

/** 1 · the nickname. The mochi below wears it on a name tag as it's typed. */
export function StepName({ draft, update, desktop, expression, pulse }: StepProps & { expression: MochiExpression; pulse: number }) {
  const len = draft.name.length
  return (
    <div className="space-y-4">
      {!desktop && (
        <motion.div variants={fadeUp}>
          <StageBox color={draft.color} expression={expression} accessory={draft.accessory} name={draft.name} pulse={pulse} heightClass="h-44" />
        </motion.div>
      )}

      <motion.div variants={fadeUp}>
        <label htmlFor="ob-name" className="sr-only">
          {t('ชื่อเล่น', 'Nickname')}
        </label>
        <div className="relative">
          <input
            id="ob-name"
            value={draft.name}
            onChange={(e) => update({ name: e.target.value.slice(0, NAME_MAX) })}
            maxLength={NAME_MAX}
            autoComplete="nickname"
            enterKeyHint="next"
            autoFocus={desktop}
            placeholder={t('เช่น ต้นข้าว, มิว, Ploy', 'e.g. Mew, Ploy, Kai')}
            aria-describedby="ob-name-hint"
            className="h-16 w-full rounded-[1.4rem] border-2 border-line bg-white pr-20 pl-5 font-display text-xl text-ink shadow-[var(--shadow-soft)] transition-colors outline-none placeholder:text-ink-faint focus:border-peach focus-visible:ring-4 focus-visible:ring-peach/40"
          />
          <span className="pointer-events-none absolute top-1/2 right-5 -translate-y-1/2 text-xs font-semibold text-ink-soft" aria-hidden>
            {len}/{NAME_MAX}
          </span>
        </div>
        <p id="ob-name-hint" className="mt-2 text-sm text-ink-soft">
          {t('ชื่อที่อยากให้เพื่อนเรียก ไม่ต้องเป็นชื่อจริงก็ได้', "The name you'd like friends to use. It doesn't have to be your real one")}
        </p>
      </motion.div>
    </div>
  )
}
