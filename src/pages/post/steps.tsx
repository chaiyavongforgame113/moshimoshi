import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  InfinityIcon,
  Lock,
  MapPin,
  Minus,
  MoonStar,
  Plus,
  RotateCcw,
  UserPlus,
  WandSparkles,
  Wifi,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { IconButton, OwnOption } from '@/components/ui'
import { OWN_TAG_MAX, ownTagId } from '@/data/tags'
import { MOCHI } from '@/lib/colors'
import { known, t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import type { IntentTemplate, IntentWhen, MochiColor } from '@/lib/types'
import { PickChip, fieldClass } from './bits'
import { langOf, SLOTS_MAX, TEXT_MAX, todayISO, type Draft } from './draft'
import { LANGS, PROVINCES, TEMPLATE_BY_KEY, TEMPLATES } from './templates'

type Patch = (p: Partial<Draft>) => void

const reveal = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto' },
  exit: { opacity: 0, height: 0 },
  transition: spring.soft,
}

/** A small label over one part of a step. */
function Part({ label, children, className = '' }: { label: ReactNode; children: ReactNode; className?: string }) {
  const id = useId()
  return (
    <div role="group" aria-labelledby={id} className={className}>
      <p id={id} className="mb-2 font-display font-semibold text-ink">
        {label}
      </p>
      {children}
    </div>
  )
}

// ------------------------------------------------------------------ 1. อยากทำอะไร?
/** The 8 templates as big cards; picking one moves on. */
export function TemplatePick({ value, onPick }: { value: IntentTemplate | null; onPick: (k: IntentTemplate) => void }) {
  const reduce = useReducedMotion()
  return (
    <div role="group" aria-label={t('แบบที่อยากชวน', 'Kind of invite')} className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-4">
      {TEMPLATES.map((x) => {
        const on = value === x.key
        const p = MOCHI[x.color]
        return (
          <motion.button
            key={x.key}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(x.key)}
            whileHover={reduce ? undefined : { y: -3 }}
            whileTap={reduce ? undefined : { scale: 0.96 }}
            transition={spring.bouncy}
            className="relative flex min-h-36 min-w-0 flex-col items-start gap-2 overflow-hidden rounded-[1.75rem] border-2 p-3 text-left outline-offset-2 sm:p-4"
            style={{
              background: on ? p.light : 'rgb(255 255 255 / 0.85)',
              borderColor: on ? p.shade : 'var(--color-line)',
              boxShadow: on ? `inset 0 -4px 0 ${p.shade}, var(--shadow-puffy)` : 'var(--shadow-soft)',
            }}
          >
            <span aria-hidden className="pointer-events-none absolute -top-10 -right-10 size-28 rounded-full opacity-70 blur-2xl" style={{ background: p.light }} />
            <span
              aria-hidden
              className="relative inline-flex size-12 shrink-0 items-center justify-center rounded-2xl text-ink"
              style={{ background: p.base, boxShadow: `inset 0 -3px 0 ${p.shade}, inset 0 1px 0 rgb(255 255 255 / 0.7)` }}
            >
              <x.Icon size={24} strokeWidth={2.3} />
            </span>
            <span className="relative font-display text-[15px] leading-snug font-semibold wrap-break-word text-ink sm:text-base">{x.label}</span>
            <span className="relative line-clamp-2 text-xs leading-normal text-ink-soft sm:text-[13px]">{x.hint}</span>
            <AnimatePresence>
              {on && (
                <motion.span
                  key="on"
                  aria-hidden
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={spring.bouncy}
                  className="absolute top-2.5 right-2.5 inline-flex size-7 items-center justify-center rounded-full bg-white text-ink shadow-[var(--shadow-soft)]"
                >
                  <Check size={16} strokeWidth={3} />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        )
      })}
    </div>
  )
}

// ------------------------------------------------------------------ 2. (language posts) อยากฝึกภาษาอะไร?
/** Language posts ask what to practice (required, it's the post's topic) and what they can help with. */
export function LangPick({ draft, patch }: { draft: Draft; patch: Patch }) {
  const want = langOf(draft.want)
  const pickWant = (value: string, tagId: string) => {
    const same = !!value && !!langOf(value) && langOf(value)?.tag === langOf(draft.give)?.tag
    // can't swap a language for itself: what they "give" lets go
    patch({ want: value, tagId, ...(same ? { give: '' } : {}) })
  }
  return (
    <div className="flex flex-col gap-6">
      <LangGroup label={t('อยากฝึกภาษาอะไร', 'I want to practice')} value={draft.want} onChange={pickWant} />
      <LangGroup
        label={
          <>
            {t('ช่วยสอนภาษาอะไรได้', 'I can help with')} <span className="font-sans text-sm font-normal text-ink-soft">{t('(ไม่ใส่ก็ได้)', '(optional)')}</span>
          </>
        }
        value={draft.give}
        hide={want?.tag}
        onChange={(value) => patch({ give: value })}
      />
    </div>
  )
}

function LangGroup({ label, value, hide, onChange }: { label: ReactNode; value: string; hide?: string; onChange: (value: string, tagId: string) => void }) {
  const picked = langOf(value)
  // typed in "อื่นๆ" (or saved that way): shown as a picked chip of its own
  const own = value.trim() && !picked ? value.trim() : ''
  return (
    <Part label={label}>
      <div className="flex flex-wrap gap-2">
        {LANGS.filter((l) => l.tag !== hide).map((l) => {
          const on = picked?.tag === l.tag
          return (
            <PickChip key={l.tag} selected={on} color="sky" onClick={() => (on ? onChange('', '') : onChange(l.value, l.tag))}>
              {known(l.value)}
            </PickChip>
          )
        })}
        {own && (
          <PickChip selected color="sky" onClick={() => onChange('', '')}>
            <span className="min-w-0 truncate">{own}</span>
          </PickChip>
        )}
        <OwnOption
          label={t('อื่นๆ', 'Other')}
          name={t('พิมพ์ชื่อภาษาเอง', 'Type a language')}
          placeholder={t('เช่น ภาษาจีน', 'e.g. Chinese')}
          maxLength={OWN_TAG_MAX}
          onAdd={(text) => {
            const v = text.trim()
            const l = langOf(v)
            if (l) return void onChange(l.value, l.tag)
            const id = ownTagId(v)
            if (!id) return false
            onChange(v, id)
          }}
        />
      </div>
    </Part>
  )
}

// ------------------------------------------------------------------ 3. เมื่อไหร่?
type WhenKey = IntentWhen | 'now'

const whenOptions = (): { key: WhenKey; label: string; Icon: LucideIcon }[] => [
  { key: 'now', label: t('ตอนนี้เลย', 'Right now'), Icon: Zap },
  { key: 'tonight', label: t('คืนนี้', 'Tonight'), Icon: MoonStar },
  { key: 'weekend', label: t('สุดสัปดาห์', 'This weekend'), Icon: CalendarDays },
  { key: 'anytime', label: t('เมื่อไหร่ก็ได้', 'Anytime'), Icon: InfinityIcon },
  { key: 'dated', label: t('เลือกวัน', 'Pick a day'), Icon: CalendarClock },
]

/** When, then online or in person (in person asks the province, the finest place ever shown). */
export function WhenPick({ draft, patch }: { draft: Draft; patch: Patch }) {
  const timeId = useId()
  const dateId = useId()
  const provId = useId()
  const current: WhenKey = draft.now ? 'now' : draft.when
  // touching "when" lets go of a saved time label (see Draft.keptWhenLabel)
  const pickWhen = (k: WhenKey) =>
    patch(k === 'now' ? { when: 'tonight', now: true, time: '', keptWhenLabel: undefined } : { when: k, now: false, keptWhenLabel: undefined })
  const modes: { key: Draft['mode']; label: string; sub: string; Icon: LucideIcon; color: MochiColor }[] = [
    { key: 'online', label: t('ออนไลน์', 'Online'), sub: t('แชท คุยเสียง เล่นด้วยกัน', 'Chat, voice, play together'), Icon: Wifi, color: 'mint' },
    { key: 'offline', label: t('เจอตัว', 'In person'), sub: t('ไปงาน หรือนัดเป็นกลุ่ม', 'Events or group meetups'), Icon: MapPin, color: 'peach' },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div role="group" aria-label={t('เวลา', 'Time')} className="flex flex-wrap gap-2">
          {whenOptions().map((w) => (
            <PickChip key={w.key} selected={current === w.key} color="sky" onClick={() => pickWhen(w.key)} icon={<w.Icon size={17} strokeWidth={2.3} aria-hidden />}>
              {w.label}
            </PickChip>
          ))}
        </div>
        {draft.keptWhenLabel && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-soft">
            <CalendarClock size={15} aria-hidden /> {t(`ตอนนี้ตั้งไว้: ${known(draft.keptWhenLabel)}`, `Currently set: ${known(draft.keptWhenLabel)}`)}
          </p>
        )}

        <AnimatePresence initial={false}>
          {(current === 'tonight' || current === 'dated') && (
            <motion.div key="time" {...reveal} className="overflow-hidden">
              <div className={`mt-3 grid items-end gap-3 ${current === 'dated' ? 'grid-cols-1 min-[380px]:grid-cols-2' : 'grid-cols-1 sm:max-w-56'}`}>
                {current === 'dated' && (
                  <div className="min-w-0">
                    <label htmlFor={dateId} className="mb-1 block text-sm font-semibold">
                      {t('วันไหน', 'Which day')}
                    </label>
                    <input
                      id={dateId}
                      type="date"
                      min={todayISO()}
                      value={draft.date}
                      onChange={(e) => patch({ date: e.target.value, keptWhenLabel: undefined })}
                      className={`${fieldClass} min-h-12`}
                    />
                  </div>
                )}
                <div className="min-w-0">
                  <label htmlFor={timeId} className="mb-1 block text-sm font-semibold">
                    {t('ประมาณกี่โมง', 'Around what time')} <span className="font-normal text-ink-soft">{t('(ไม่ใส่ก็ได้)', '(optional)')}</span>
                  </label>
                  <input id={timeId} type="time" value={draft.time} onChange={(e) => patch({ time: e.target.value, keptWhenLabel: undefined })} className={`${fieldClass} min-h-12`} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Part label={t('ออนไลน์ หรือเจอตัว?', 'Online or in person?')}>
        <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
          {modes.map((m) => {
            const on = draft.mode === m.key
            const p = MOCHI[m.color]
            return (
              <motion.button
                key={m.key}
                type="button"
                aria-pressed={on}
                onClick={() => patch({ mode: m.key })}
                whileTap={{ scale: 0.95 }}
                transition={spring.bouncy}
                className={`flex min-h-16 min-w-0 items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${on ? '' : 'border-line bg-white hover:bg-cream'}`}
                style={on ? { background: p.light, borderColor: p.shade, boxShadow: `inset 0 -3px 0 ${p.shade}` } : undefined}
              >
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-ink" style={{ background: p.base }} aria-hidden>
                  <m.Icon size={20} strokeWidth={2.3} />
                </span>
                <span className="min-w-0">
                  <span className="block font-display font-semibold text-ink">{m.label}</span>
                  <span className="block text-xs leading-normal text-ink-soft">{m.sub}</span>
                </span>
              </motion.button>
            )
          })}
        </div>

        <AnimatePresence initial={false}>
          {draft.mode === 'offline' && (
            <motion.div key="prov" {...reveal} className="overflow-hidden">
              <div className="mt-3">
                <label htmlFor={provId} className="mb-1 block text-sm font-semibold">
                  {t('จังหวัด', 'Province')}
                </label>
                <div className="relative">
                  <select id={provId} value={draft.province} onChange={(e) => patch({ province: e.target.value })} className={`${fieldClass} min-h-12 appearance-none pr-11`}>
                    {(PROVINCES.includes(draft.province) ? PROVINCES : [draft.province, ...PROVINCES]).map((p) => (
                      <option key={p} value={p}>
                        {known(p)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={18} className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-ink-soft" aria-hidden />
                </div>
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-soft">
                  <Lock size={13} aria-hidden /> {t('แสดงแค่จังหวัด ไม่บอกที่อยู่ละเอียด', 'Only your province shows, never your exact address')}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Part>
    </div>
  )
}

// ------------------------------------------------------------------ 4. อยากบอกอะไรเพิ่มไหม
/** One line Mochi already wrote from the answers (editable), and the optional "ขาดอีกกี่คน". */
export function NotePick({ draft, patch, suggested }: { draft: Draft; patch: Patch; suggested: string }) {
  const id = useId()
  const countId = useId()
  const value = draft.textTouched ? draft.text : suggested
  const near = value.length >= TEXT_MAX - 10
  const tpl = draft.template ? TEMPLATE_BY_KEY[draft.template] : undefined
  const own = draft.textTouched && !!suggested && draft.text.trim() !== suggested

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label htmlFor={id} className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-ink-soft">
          <WandSparkles size={15} aria-hidden />
          {own ? t('ข้อความของเรา', 'Your words') : t('โมชิเขียนไว้ให้แล้ว แก้ได้เลย', 'Mochi wrote this for you. Edit away')}
        </label>
        <input
          id={id}
          type="text"
          value={value}
          maxLength={TEXT_MAX}
          enterKeyHint="next"
          onChange={(e) => patch({ text: e.target.value, textTouched: true })}
          placeholder={tpl?.example}
          aria-describedby={countId}
          className={`${fieldClass} min-h-12 text-[16px]`}
        />
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          {own ? (
            <button
              type="button"
              onClick={() => patch({ text: '', textTouched: false })}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-sm font-semibold text-ink-soft hover:bg-ink/5 hover:text-ink"
            >
              <RotateCcw size={15} aria-hidden /> {t('ใช้ประโยคที่โมชิเขียนให้', "Use Mochi's line")}
            </button>
          ) : (
            <span />
          )}
          <span id={countId} className={`text-xs tabular-nums ${near ? 'font-semibold text-ink' : 'text-ink-soft'}`}>
            <span className="sr-only">{t('จำนวนตัวอักษร ', 'Characters ')}</span>
            {value.length}/{TEXT_MAX}
          </span>
        </div>
      </div>

      <HostToggle draft={draft} patch={patch} />
    </div>
  )
}

/** "เปิดตี้ไว้แล้ว": the post says how many spots are still open. */
function HostToggle({ draft, patch }: { draft: Draft; patch: Patch }) {
  const reduce = useReducedMotion()
  const p = MOCHI.pink
  const set = (n: number) => patch({ slots: Math.min(SLOTS_MAX, Math.max(1, n)) })
  return (
    <div className="rounded-3xl border-2 p-3 transition-colors sm:p-4" style={{ borderColor: draft.host ? p.shade : 'var(--color-line)', background: draft.host ? p.light : 'rgb(255 255 255 / 0.6)' }}>
      <button type="button" role="switch" aria-checked={draft.host} onClick={() => patch({ host: !draft.host })} className="flex min-h-12 w-full items-center gap-3 rounded-2xl text-left outline-offset-4">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-ink" style={{ background: p.base }} aria-hidden>
          <UserPlus size={20} strokeWidth={2.3} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display font-semibold text-ink">{t('เปิดตี้ไว้แล้ว ยังขาดคน', 'Got a group, need a few more')}</span>
          <span className="block text-xs text-ink-soft">{t('ไม่ใส่ก็ได้นะ', 'Totally optional')}</span>
        </span>
        <span aria-hidden className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors ${draft.host ? 'bg-coral' : 'bg-ink/15'}`}>
          <motion.span
            className="size-5 rounded-full bg-white shadow-[var(--shadow-soft)]"
            initial={false}
            animate={{ x: draft.host ? 20 : 0 }}
            transition={reduce ? { duration: 0 } : spring.bouncy}
          />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {draft.host && (
          <motion.div key="slots" {...reveal} className="overflow-hidden">
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/80 p-3">
              <div className="min-w-0 flex-[1_1_9rem]">
                <p className="font-display font-semibold">{t('ขาดอีกกี่คน?', 'How many more?')}</p>
                <p className="text-xs text-ink-soft">
                  {t(`เพื่อนๆ จะเห็นว่า "ขาดอีก ${draft.slots} คน"`, `People will see "${draft.slots} more ${draft.slots === 1 ? 'spot' : 'spots'} open"`)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <IconButton label={t('ลดจำนวนคน', 'Fewer')} disabled={draft.slots <= 1} onClick={() => set(draft.slots - 1)} className="disabled:opacity-40">
                  <Minus size={18} />
                </IconButton>
                <span className="w-8 text-center font-display text-2xl font-bold tabular-nums" aria-live="polite">
                  <motion.span key={draft.slots} className="inline-block" initial={reduce ? false : { scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring.bouncy}>
                    {draft.slots}
                  </motion.span>
                </span>
                <IconButton label={t('เพิ่มจำนวนคน', 'More')} disabled={draft.slots >= SLOTS_MAX} onClick={() => set(draft.slots + 1)} className="disabled:opacity-40">
                  <Plus size={18} />
                </IconButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
