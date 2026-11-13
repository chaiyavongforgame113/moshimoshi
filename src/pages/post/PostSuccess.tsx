import { motion, useReducedMotion } from 'motion/react'
import { House, Plus, Sparkle } from 'lucide-react'
import { useMemo } from 'react'
import { MochiStage, View3D } from '@/components/three'
import { Button, ButtonLink } from '@/components/ui'
import { MOCHI } from '@/lib/colors'
import { t } from '@/lib/i18n'
import { fadeUp, pop, stagger } from '@/lib/motion'
import type { Intent } from '@/lib/types'
import { useMatchesFor } from '@/pages/home/matches'
import { LikelyMatches } from './LikelyMatches'

const SPARKS = [
  { left: '6%', top: '18%', size: 22, color: MOCHI.butter.shade, delay: 0.2 },
  { left: '14%', top: '68%', size: 14, color: MOCHI.pink.shade, delay: 0.35 },
  { left: '86%', top: '22%', size: 18, color: MOCHI.mint.shade, delay: 0.28 },
  { left: '92%', top: '62%', size: 24, color: MOCHI.lavender.shade, delay: 0.45 },
]

/** After posting: Mochi cheers, then up to 3 people on this post's wavelength to invite, and the way home. */
export function PostSuccess({ intent, onAgain }: { intent: Intent; onAgain: () => void }) {
  const reduce = useReducedMotion()
  const mine = useMemo(() => [intent], [intent])
  const matches = useMatchesFor(mine)

  return (
    <motion.div variants={stagger(0.09)} initial="hidden" animate="show" className="mx-auto flex max-w-xl flex-col items-center pt-2 text-center">
      <div className="relative w-full">
        <View3D className="mx-auto h-56 w-full max-w-sm sm:h-64" label={t('น้องโมชิดีใจที่โพสต์สำเร็จ', 'Little Mochi cheering for your new post')}>
          <MochiStage color="peach" expression="happy" accessory="bow" zoom={0.95} />
        </View3D>
        {/* sparkles sit at the sides so they never cover the mascot */}
        {SPARKS.map((s, i) => (
          <motion.span
            key={i}
            aria-hidden
            className="absolute"
            style={{ left: s.left, top: s.top, color: s.color }}
            initial={{ scale: 0, rotate: -90, opacity: 0 }}
            animate={reduce ? { scale: 1, rotate: 0, opacity: 1 } : { scale: [0, 1.3, 1], rotate: 0, opacity: 1, y: [0, -6, 0] }}
            transition={reduce ? { duration: 0 } : { duration: 0.9, delay: s.delay, ease: 'easeOut' }}
          >
            <Sparkle size={s.size} fill="currentColor" strokeWidth={1.5} />
          </motion.span>
        ))}
      </div>

      <motion.h2 variants={pop} className="mt-4 font-display text-3xl font-semibold text-balance sm:text-4xl" role="status">
        {t('ชวนแล้ว! ส่งคำชวนออกไปแล้วนะ', "Done! Your invite's out there")}
      </motion.h2>
      <motion.p variants={fadeUp} className="mt-2 mb-1 max-w-md text-ink-soft">
        {matches.length
          ? t('มีคนที่คลื่นตรงกับเรื่องนี้รออยู่ ลองชวนมาเล่นด้วยกันเลย', 'Some people on this wavelength are around. Invite them to join in')
          : t('เพื่อนๆ ที่คลื่นตรงกันจะเห็นโพสต์นี้ ถ้ามีใครตรงโมชิจะบอกทันที', "People on your wavelength will see this post. Mochi will tell you the moment someone matches")}
      </motion.p>

      <motion.div variants={fadeUp} className="w-full">
        <LikelyMatches intent={intent} matches={matches} />
      </motion.div>

      <motion.div variants={fadeUp} className="mt-6 flex w-full flex-col items-center gap-2">
        <ButtonLink to="/app" size="lg" variant={matches.length ? 'secondary' : 'primary'} icon={<House size={20} aria-hidden />} className="w-full sm:w-auto sm:min-w-56">
          {t('กลับหน้าหลัก', 'Back home')}
        </ButtonLink>
        <Button variant="ghost" icon={<Plus size={18} aria-hidden />} onClick={onAgain}>
          {t('ชวนเล่นอีกเรื่อง', 'Start another invite')}
        </Button>
      </motion.div>
    </motion.div>
  )
}
