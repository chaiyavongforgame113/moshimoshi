import { motion } from 'motion/react'
import { HeartHandshake, MessageCircleHeart, ShieldCheck, Users } from 'lucide-react'
import type { MochiExpression } from '@/components/three'
import { Zone } from '@/components/ui'
import { L, loc, t } from '@/lib/i18n'
import { fadeUp, stagger } from '@/lib/motion'
import type { StepProps } from '../model'
import { StageBox } from '../parts/StageBox'

type Rule = { Icon: typeof Users; text: string; tint: string }

const RULES: Rule[] = [
  loc<Rule>({ Icon: Users, text: L('มาหาเพื่อน ไม่ได้มาหาแฟน', 'Here for friends, not dates'), tint: 'bg-mint/45' }),
  loc<Rule>({ Icon: MessageCircleHeart, text: L('คุยกันอย่างใจดี ไม่ตัดสินกัน', 'Chat kindly, no judging'), tint: 'bg-pink/45' }),
  loc<Rule>({ Icon: ShieldCheck, text: L('ค่อยๆ รู้จักกัน ไม่รีบขอช่องทางติดต่อ', 'Take it slow, no rushing to swap contacts'), tint: 'bg-sky/50' }),
]

/** 2 · three soft rules, then one tap on "ตกลง". */
export function StepRules({ draft, desktop, expression, pulse }: StepProps & { expression: MochiExpression; pulse: number }) {
  return (
    <div className="space-y-4">
      {!desktop && (
        <motion.div variants={fadeUp}>
          <StageBox color={draft.color} expression={expression} accessory={draft.accessory} name={draft.name} pulse={pulse} heightClass="h-32" showName={false} />
        </motion.div>
      )}
      <motion.div variants={fadeUp}>
        <Zone tone="mint" icon={<HeartHandshake size={18} />} title={t('ที่นี่เราตกลงกันว่า…', 'Around here, we…')}>
          <motion.ul variants={stagger(0.08, 0.15)} initial="hidden" animate="show" className="space-y-2.5">
            {RULES.map(({ Icon, text, tint }) => (
              <motion.li key={text} variants={fadeUp} className="flex items-center gap-3 text-[15px] text-ink">
                <span className={`grid size-10 shrink-0 place-items-center rounded-full ${tint}`} aria-hidden>
                  <Icon size={18} strokeWidth={2.3} />
                </span>
                <span className="min-w-0">{text}</span>
              </motion.li>
            ))}
          </motion.ul>
        </Zone>
      </motion.div>
    </div>
  )
}
