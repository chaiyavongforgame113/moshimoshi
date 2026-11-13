import { Sheet, SignalMeter } from '@/components/ui'
import { t } from '@/lib/i18n'
import { BREAKDOWN_LABEL, MIN_LEVEL, SIGNAL_LEVELS, signalMeta } from '@/lib/matching'
import type { MatchBreakdown } from '@/lib/types'

/** "สัญญาณถูกคอคืออะไร" explainer. */
export function SignalInfoSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const parts = Object.keys(BREAKDOWN_LABEL) as (keyof MatchBreakdown)[]
  const floor = signalMeta(MIN_LEVEL).label
  return (
    <Sheet open={open} onClose={onClose} title={t('สัญญาณถูกคอคืออะไร', "What's a vibe signal?")}>
      <div className="space-y-5 pb-3">
        <p className="text-ink-soft">
          {t(
            'เหมือนขีดสัญญาณบนมือถือ ยิ่งขีดเยอะ คลื่นของเรากับเขายิ่งตรงกัน เราตั้งใจไม่ใช้ตัวเลขหรือเปอร์เซ็นต์ เพราะความถูกคอไม่ใช่คะแนนสอบ',
            "Like signal bars: the more bars, the closer your wavelengths. We skip numbers and percentages on purpose, because clicking with someone isn't an exam score.",
          )}
        </p>
        <ol className="space-y-2">
          {SIGNAL_LEVELS.map((s) => (
            <li key={s.level} className="flex items-center gap-4 rounded-2xl bg-white p-3">
              <span className="flex w-14 shrink-0 justify-center">
                <SignalMeter level={s.level} size="md" showLabel={false} />
              </span>
              <span className="min-w-0">
                <span className="block font-display font-semibold">{s.label}</span>
                <span className="block text-sm text-ink-soft">{s.hint}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="rounded-2xl bg-lavender/25 p-3 text-sm text-ink">
          {t(
            `เราแนะนำเฉพาะคนที่ "${floor}" ขึ้นไป คนอื่นยังเปิดดูโปรไฟล์ได้ตามปกตินะ`,
            `We only suggest people at "${floor}" or higher. You can still open anyone else's profile.`,
          )}
        </p>
        <div>
          <h3 className="font-display font-semibold">{t('ดูจากอะไรบ้าง', 'What we look at')}</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {parts.map((k) => (
              <li key={k} className="max-w-full rounded-full bg-cream-3/70 px-3 py-1 text-sm">
                {BREAKDOWN_LABEL[k]}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-ink-soft">
            {t(
              'คลื่นคิดจากโปรไฟล์ของเรา ไม่ต้องโพสต์ก็เจอคนได้ เรื่องที่หายากและตรงกันจะนับหนักกว่าเรื่องที่ใครๆ ก็ชอบ ส่วนโพสต์ชวนเล่นเป็นแค่โบนัสเล็กๆ ตอนที่ชวนเรื่องเดียวกันอยู่',
              "Your wave comes from your profile, so you don't need to post to be found. Rare things you share count for more than things everyone likes, and invites only add a small bonus when you're both after the same thing.",
            )}
          </p>
        </div>
      </div>
    </Sheet>
  )
}
