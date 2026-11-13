import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { MochiStage, View3D, type MochiAccessory, type MochiExpression } from '@/components/three'
import { t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import type { MochiColor } from '@/lib/types'
import { ACCESSORY_LABEL, COLOR_LABEL, FACE_LABEL } from '../options'
import { StageFx } from './Fx'
import { NameTag } from './NameTag'

interface StageBoxProps {
  color: MochiColor
  expression: MochiExpression
  accessory: MochiAccessory
  name: string
  pulse: number
  /** must include an explicit height, e.g. "h-60" */
  heightClass: string
  showName?: boolean
  /** a little speech bubble above the mochi (its reaction), floating so nothing below moves */
  say?: string | null
}

/**
 * The 3D mochi preview. The box stays transparent on purpose: the WebGL
 * canvas sits behind the DOM, so anything opaque here would hide it.
 */
export function StageBox({ color, expression, accessory, name, pulse, heightClass, showName = true, say }: StageBoxProps) {
  const reduce = useReducedMotion()
  const acc = accessory === 'none' ? '' : t(` ใส่${ACCESSORY_LABEL[accessory]}`, `, ${ACCESSORY_LABEL[accessory].toLowerCase()}`)
  return (
    <div className="relative">
      <View3D className={`${heightClass} w-full`} label={t(`โมชิของเรา สี${COLOR_LABEL[color]} หน้า${FACE_LABEL[expression]}${acc}`, `Your Mochi: ${COLOR_LABEL[color]}, ${FACE_LABEL[expression].toLowerCase()}${acc}`)}>
        <MochiStage color={color} expression={expression} accessory={accessory} />
      </View3D>
      <StageFx pulse={pulse} color={color} />
      {say !== undefined && (
        <div aria-live="polite" className="pointer-events-none absolute inset-x-0 top-1 flex justify-center px-2">
          <AnimatePresence mode="wait" initial={false}>
            {say && (
              <motion.p
                key={say}
                initial={reduce ? false : { opacity: 0, y: 8, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
                transition={spring.bouncy}
                className="relative max-w-[88%] rounded-[1.2rem] bg-white/95 px-3.5 py-1.5 text-center text-sm font-semibold text-ink shadow-[var(--shadow-soft)]"
              >
                {say}
                <span className="absolute -bottom-1.5 left-1/2 size-3 -translate-x-1/2 rotate-45 rounded-[3px] bg-white/95" aria-hidden />
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      )}
      {showName && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
          <NameTag name={name} />
        </div>
      )}
    </div>
  )
}
