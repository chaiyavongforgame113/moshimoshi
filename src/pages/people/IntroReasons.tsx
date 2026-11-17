import { ReasonIcon } from '@/components/ui'
import { t } from '@/lib/i18n'
import type { MochiReason } from './intro'

/** Mochi's reasons as a short list (a shared life stage shows its emoji). */
export function MochiReasonList({ reasons, className = '' }: { reasons: MochiReason[]; className?: string }) {
  if (!reasons.length) {
    return (
      <p className={`text-sm text-ink ${className}`}>
        {t('โมชิว่าคุยกันแล้วน่าจะถูกคอนะ ลองทำความรู้จักกันดู', 'Mochi has a feeling you two would get along. Give it a try')}
      </p>
    )
  }
  return (
    <ul className={`space-y-1.5 ${className}`}>
      {reasons.map((r) => (
        <li key={r.key} className="flex items-start gap-2 text-sm text-ink">
          {r.emoji ? (
            <span aria-hidden className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-butter/60 text-[11px] leading-none">
              {r.emoji}
            </span>
          ) : (
            <ReasonIcon kind={r.kind} />
          )}
          <span className="min-w-0 break-words">{r.text}</span>
        </li>
      ))}
    </ul>
  )
}
