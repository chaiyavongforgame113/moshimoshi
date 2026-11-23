import { AnimatePresence, motion } from 'motion/react'
import { Clock3, MessageCircleHeart, Search, Signpost, Sparkle, Star, Tags } from 'lucide-react'
import type { ReactNode } from 'react'
import type { MochiExpression } from '@/components/three'
import { AllDayChip } from '@/components/ui'
import { useServerFeatures } from '@/data/hooks'
import { chatStyleLabel, isAllDay, ONLINE_LABEL, tagOf } from '@/data/tags'
import { CATEGORY_COLOR, MOCHI } from '@/lib/colors'
import { known, t } from '@/lib/i18n'
import { lifeStageEmoji, lifeStageLabel } from '@/lib/lifeStages'
import { spring } from '@/lib/motion'
import { intentChoices, type Draft } from '../model'
import { TEMPLATE_BY_ID } from '../options'
import { SignalBars } from './Signal'
import { StageBox } from './StageBox'

interface PreviewPanelProps {
  draft: Draft
  expression: MochiExpression
  pulse: number
  /** onboarding finished: the badge says ready instead of searching */
  done: boolean
  province: string
}

/** Desktop left column: the live 3D mochi + a profile card that fills in as you go. */
export function PreviewPanel({ draft, expression, pulse, done, province }: PreviewPanelProps) {
  const connected = done
  return (
    <div className="relative flex flex-col gap-3 rounded-[2.5rem] border-2 border-white/80 p-4 xl:p-5">
      <Sparkle className="absolute -top-3 right-10 text-butter" size={22} fill="currentColor" strokeWidth={0} aria-hidden />
      <Sparkle className="absolute top-1/3 -left-3 text-pink" size={16} fill="currentColor" strokeWidth={0} aria-hidden />

      <div className="flex items-center justify-between gap-3 px-1">
        <span className="glass inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-xs font-semibold text-ink">
          <MessageCircleHeart size={14} aria-hidden />
          {connected ? t('พร้อมทักเพื่อนแล้ว', 'Ready to say hi') : t('กำลังหาเพื่อนคลื่นเดียวกัน…', 'Finding friends on your wavelength…')}
          <SignalBars tuning={!connected} />
        </span>
        <span className="text-xs font-semibold text-ink-soft">{t('ตัวอย่างโปรไฟล์', 'Profile preview')}</span>
      </div>

      <StageBox
        color={draft.color}
        expression={expression}
        accessory={draft.accessory}
        name={draft.name}
        pulse={pulse}
        heightClass="h-[clamp(200px,34vh,380px)]"
      />

      <ProfilePreview draft={draft} province={province} />
    </div>
  )
}

function ProfilePreview({ draft, province }: { draft: Draft; province: string }) {
  const ordered = [...draft.loves, ...draft.tags.filter((t) => !draft.loves.includes(t))]
  const shown = ordered.slice(0, 7)
  const more = ordered.length - shown.length
  const bio = draft.bio.trim()
  const templates = intentChoices(draft).map((intent) => TEMPLATE_BY_ID[intent])
  const allDay = isAllDay(draft.online)
  const rhythm = [...(allDay ? [] : draft.online.map((s) => ONLINE_LABEL[s])), ...draft.chatStyle.map(chatStyleLabel)]
  const lifeOn = useServerFeatures().lifeStages

  return (
    <div className="glass rounded-[1.75rem] p-4 xl:p-5">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
        <span className="size-1.5 rounded-full bg-success" aria-hidden />
        {known(province)} · {t('ออนไลน์อยู่', 'Online now')}
      </p>
      <dl className="space-y-3">
        <Row icon={<Tags size={14} />} label={t('ชอบ', 'Likes')}>
          {shown.length ? (
            <div className="flex flex-wrap gap-1.5">
              <AnimatePresence initial={false}>
                {shown.map((id) => {
                  const tag = tagOf(id)
                  if (!tag) return null
                  const p = MOCHI[CATEGORY_COLOR[tag.category]]
                  const loved = draft.loves.includes(id)
                  return (
                    <motion.span
                      key={id}
                      layout
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.6 }}
                      transition={spring.bouncy}
                      className="inline-flex h-7 max-w-full items-center gap-1 rounded-full px-2.5 text-xs font-medium"
                      style={{ background: loved ? p.base : p.light, color: p.ink }}
                    >
                      {loved && <Star size={11} fill="currentColor" strokeWidth={0} className="shrink-0" aria-label={t('รักมาก', 'Love it')} />}
                      <span className="min-w-0 truncate">{tag.label}</span>
                    </motion.span>
                  )
                })}
              </AnimatePresence>
              {more > 0 && <span className="inline-flex h-7 items-center rounded-full bg-cream-3 px-2.5 text-xs font-semibold text-ink">+{more}</span>}
            </div>
          ) : (
            <Ghosts widths={['w-16', 'w-20', 'w-14']} />
          )}
        </Row>

        {lifeOn && (
          <Row icon={<Signpost size={14} />} label={t('ช่วงชีวิต', 'Life stage')}>
            {draft.lifeStages.length ? (
              <div className="flex flex-wrap gap-1.5">
                <AnimatePresence initial={false}>
                  {draft.lifeStages.map((v) => (
                    <motion.span
                      key={v}
                      layout
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.6 }}
                      transition={spring.bouncy}
                      className="inline-flex h-7 max-w-full items-center gap-1 rounded-full px-2.5 text-xs font-medium"
                      style={{ background: MOCHI.sky.light, color: MOCHI.sky.ink }}
                    >
                      <span aria-hidden className="shrink-0">
                        {lifeStageEmoji(v)}
                      </span>
                      <span className="min-w-0 truncate">{lifeStageLabel(v)}</span>
                    </motion.span>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <Ghosts widths={['w-24', 'w-16']} />
            )}
          </Row>
        )}

        <Row icon={<MessageCircleHeart size={14} />} label={t('เล่าให้ฟัง', 'About me')}>
          {bio ? (
            <p className="line-clamp-2 text-sm [overflow-wrap:anywhere] text-ink">{bio}</p>
          ) : (
            <Ghosts widths={['w-40', 'w-24']} />
          )}
        </Row>

        <Row icon={templates.length ? <Search size={14} /> : <Clock3 size={14} />} label={t('จังหวะ', 'Rhythm')}>
          {templates.length || allDay || rhythm.length ? (
            <div className="flex flex-wrap gap-1.5">
              {templates.map((tpl) => (
                <span key={tpl.id} className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-semibold" style={{ background: MOCHI[tpl.color].base, color: MOCHI[tpl.color].ink }}>
                  <tpl.Icon size={12} aria-hidden />
                  {tpl.label}
                </span>
              ))}
              {allDay && <AllDayChip size="xs" />}
              {rhythm.map((r) => (
                <span key={r} className="inline-flex h-7 max-w-full items-center rounded-full bg-white px-2.5 text-xs font-medium text-ink">
                  <span className="min-w-0 truncate">{r}</span>
                </span>
              ))}
            </div>
          ) : (
            <Ghosts widths={['w-20', 'w-16']} />
          )}
        </Row>

      </dl>
    </div>
  )
}

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-2">
      <dt className="flex items-center gap-1.5 pt-1 text-xs font-semibold text-ink-soft">
        <span aria-hidden>{icon}</span>
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  )
}

/** Dashed placeholders that hint at what's still to come. */
function Ghosts({ widths }: { widths: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className="sr-only">{t('ยังไม่ได้เลือก', 'Nothing picked yet')}</span>
      {widths.map((w, i) => (
        <span key={i} aria-hidden className={`h-7 rounded-full border-2 border-dashed border-ink/15 ${w}`} />
      ))}
    </div>
  )
}
