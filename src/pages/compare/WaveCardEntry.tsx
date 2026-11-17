import { Share2, Waves } from 'lucide-react'
import { useState } from 'react'
import { Avatar, Button, Sheet, Zone } from '@/components/ui'
import { t } from '@/lib/i18n'
import { useMyWaveCard } from './useMyWaveCard'
import { WaveCardPanel } from './WaveCardPanel'

/**
 * "บัตรคลื่นของฉัน" on the Me page: my wave archetype at a glance and one button that opens the
 * card (preview + share / save / copy link) in a sheet.
 */
export function WaveCardEntry({ className = 'mt-5' }: { className?: string }) {
  const { me, wave } = useMyWaveCard()
  const [open, setOpen] = useState(false)
  const { archetype } = wave
  return (
    <>
      <Zone
        tone={archetype.tone}
        icon={<Waves size={18} />}
        title={t('บัตรคลื่นของฉัน', 'My wave card')}
        note={t('แชร์ให้เพื่อนกดมาเทียบคลื่นกัน', 'Share it so friends can compare waves with you')}
        className={className}
      >
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <span className="relative shrink-0">
            <Avatar color={me.color} face={me.face ?? 'happy'} size={72} />
            <span
              aria-hidden
              className="absolute -right-2 -bottom-1 inline-flex size-9 items-center justify-center rounded-full bg-white text-lg shadow-[var(--shadow-soft)]"
            >
              {archetype.emoji}
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-ink-soft">{t('คลื่นของเราคือ', 'Your wave is')}</p>
            <p className="font-display text-xl leading-snug font-semibold break-words text-ink">{archetype.title}</p>
            <p className="mt-0.5 text-sm text-ink-soft">{archetype.line}</p>
          </div>
          <Button variant="secondary" icon={<Share2 size={18} aria-hidden />} onClick={() => setOpen(true)} className="w-full shrink-0 sm:w-auto">
            {t('เปิดบัตรคลื่น', 'Open my card')}
          </Button>
        </div>
      </Zone>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('บัตรคลื่นของฉัน', 'My wave card')} width={560}>
        <WaveCardPanel />
      </Sheet>
    </>
  )
}
