import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight, Radio, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router'
import { Avatar, Button, Section, zoneAction } from '@/components/ui'
import { useRooms } from '@/data/hooks'
import { MOCHI } from '@/lib/colors'
import { t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import { useMoshi } from '@/lib/store'
import type { EditKind } from './EditSheets'
import { waveProgress, type WaveProgress } from './wave'

/**
 * "คลื่นชัดขึ้น": how much of my wave is filled in (a squishy bar, no percentages), and the
 * one next thing to add, with one button that opens the right sheet. All done: a small happy state.
 */
export function WaveClarity({ onEdit }: { onEdit: (kind: EditKind, step?: number) => void }) {
  const me = useMoshi((s) => s.me)
  const rooms = useRooms()
  const wave = useMemo(() => waveProgress({ me, rooms }), [me, rooms])
  const navigate = useNavigate()
  const reduce = !!useReducedMotion()
  const { next } = wave
  const clear = !next
  const left = wave.total - wave.done

  // the last piece was just saved in a sheet: its button is gone, so the focus lands on the good news
  const happy = useRef<HTMLHeadingElement>(null)
  const wasClear = useRef(clear)
  useEffect(() => {
    const became = clear && !wasClear.current
    wasClear.current = clear
    if (!became) return
    const id = requestAnimationFrame(() => {
      const active = document.activeElement
      if (!active || active === document.body || active.closest('[role="dialog"]')) happy.current?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(id)
  }, [clear])

  const go = () => {
    if (!next) return
    const to = next.item.open({ me, rooms })
    if ('to' in to) navigate(to.to)
    else onEdit(to.sheet, to.step)
  }

  return (
    <Section
      tone="lavender"
      icon={<Radio size={18} strokeWidth={2.4} />}
      title={t('คลื่นชัดขึ้น', 'Clearer wave')}
      note={clear ? undefined : t('ยิ่งเล่าเรื่องของเรา ยิ่งเจอคนคลื่นเดียวกันง่าย', 'The more you share, the easier your people find you')}
      action={
        clear ? (
          <Link to="/app/people" className={zoneAction}>
            {t('ดูคนคลื่นเดียวกัน', 'See my people')}
          </Link>
        ) : undefined
      }
    >
      <WaveBar wave={wave} reduce={reduce} />

      {next ? (
        <>
          <p aria-live="polite" className="mt-3 font-display text-[17px] leading-snug font-semibold text-ink">
            {left === 1 ? t('อีกอย่างเดียว คลื่นจะชัดขึ้น', 'Just one more thing for a clearer wave') : t(`อีก ${left} อย่าง คลื่นจะชัดขึ้น`, `${left} more things for a clearer wave`)}
          </p>
          <div className="mt-3 rounded-3xl bg-white p-4 shadow-[var(--shadow-soft)]">
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-ink shadow-[inset_0_-3px_0_rgb(59_38_34/0.1)]"
                style={{ background: MOCHI[next.item.tone].base }}
              >
                <next.item.Icon size={20} strokeWidth={2.4} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-ink-soft">
                  {t('ขั้นต่อไป', 'Next up')} · {next.item.name()}
                  {next.item.need > 1 && <span className="tabular-nums"> ({Math.min(next.have, next.item.need)}/{next.item.need})</span>}
                </p>
                <p className="mt-0.5 text-[15px] text-ink">{next.item.why()}</p>
              </div>
            </div>
            {/* one element for every piece, so the focus comes back to it when a sheet closes */}
            <Button onClick={go} iconRight={<ArrowRight size={18} strokeWidth={2.4} className="shrink-0" aria-hidden />} className="mt-3 w-full min-w-0 sm:w-auto">
              <span className="min-w-0 leading-tight whitespace-normal text-balance">{next.item.cta(next.left)}</span>
            </Button>
          </div>
        </>
      ) : (
        <div className="mt-3 flex items-center gap-3 rounded-3xl bg-white p-4 shadow-[var(--shadow-soft)]">
          <motion.span
            className="relative shrink-0"
            initial={reduce ? false : { scale: 0.6, rotate: -8 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={spring.bouncy}
          >
            <Avatar color={me.color} size={56} face="happy" />
            <span aria-hidden className="absolute -top-1 -right-1 flex size-6 items-center justify-center rounded-full bg-butter ring-2 ring-white">
              <Sparkles size={13} strokeWidth={2.6} />
            </span>
          </motion.span>
          <div className="min-w-0">
            <h3 ref={happy} tabIndex={-1} className="font-display text-lg leading-snug font-semibold text-ink focus:outline-none">
              {t('คลื่นของเราชัดแจ๋วแล้ว!', 'Your wave is crystal clear!')}
            </h3>
            <p className="text-sm text-ink-soft">
              {t('ข้อมูลครบแล้ว คนที่คลื่นตรงกันจะเจอเราได้ง่ายขึ้น', "Everything's filled in, so people on your wavelength can find you easily")}
            </p>
          </div>
        </div>
      )}
    </Section>
  )
}

/** One squishy segment per piece, each in its own color; a half-done piece fills halfway, the next one breathes. */
function WaveBar({ wave, reduce }: { wave: WaveProgress; reduce: boolean }) {
  return (
    <div
      role="progressbar"
      aria-label={t('ความชัดของคลื่น', 'How clear my wave is')}
      aria-valuemin={0}
      aria-valuemax={wave.total}
      aria-valuenow={wave.done}
      aria-valuetext={t(`ครบแล้ว ${wave.done} จาก ${wave.total} อย่าง`, `${wave.done} of ${wave.total} filled in`)}
      className="flex h-4 items-center gap-1.5"
    >
      {wave.items.map((s) => {
        const p = MOCHI[s.item.tone]
        const isNext = s === wave.next
        const fill = Math.min(1, s.have / s.item.need)
        return (
          <motion.span
            key={s.item.key}
            className="relative block min-w-0 flex-1 overflow-hidden rounded-full bg-ink/10"
            initial={false}
            animate={
              isNext && !reduce
                ? { height: [10, 14, 10], transition: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' } }
                : { height: s.done ? 12 : 10, transition: spring.bouncy }
            }
          >
            <motion.span
              className="absolute inset-0 origin-left rounded-full"
              style={{ background: `linear-gradient(90deg, ${p.base}, ${p.shade})` }}
              initial={false}
              animate={{ scaleX: fill }}
              transition={reduce ? { duration: 0 } : spring.bouncy}
            />
            {fill > 0 && <span className="absolute inset-x-1.5 top-[2px] h-[3px] rounded-full bg-white/60" />}
          </motion.span>
        )
      })}
    </div>
  )
}
