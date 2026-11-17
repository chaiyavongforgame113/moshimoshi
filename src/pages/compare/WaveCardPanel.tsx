import { Check, Download, ImageOff, Link2, RotateCcw, Share2, Sparkles } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Avatar, Button } from '@/components/ui'
import { MOCHI } from '@/lib/colors'
import { t } from '@/lib/i18n'
import { copyText } from '@/lib/inAppBrowser'
import { spring } from '@/lib/motion'
import {
  canShareLink,
  downloadBlob,
  printedLink,
  renderWaveCard,
  serializeMochi,
  shareWaveCard,
  waveCardFile,
} from '@/lib/waveCard'
import { useMyWaveCard } from './useMyWaveCard'

type Drawn = { key: string; blob: Blob; url: string; file: File } | { key: string; failed: true }

/** fewer "จูนคลื่น" answers than this: a soft nudge to play so the card fits better */
const FEW_ANSWERS = 4

/**
 * "บัตรคลื่นของฉัน": the story-size image of my wave (drawn on this device), and the ways to send
 * it on: share (the image itself where the share sheet takes files, else the link), save the
 * image, copy the link. The image is drawn as soon as this shows, so a tap on แชร์ opens the
 * share sheet straight away (Safari only allows it right after the tap).
 */
export function WaveCardPanel() {
  const { me, wave, answered, content } = useMyWaveCard()
  const reduce = useReducedMotion()
  const mochiBox = useRef<HTMLSpanElement>(null)
  const [drawn, setDrawn] = useState<Drawn | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState('')
  const [copied, setCopied] = useState(false)
  const [hasShare] = useState(canShareLink)
  const face = me.face ?? 'happy'
  const key = useMemo(() => JSON.stringify([content, face, attempt]), [content, face, attempt])

  useEffect(() => {
    const svg = mochiBox.current?.querySelector('svg')
    if (!svg) return
    let alive = true
    let url: string | undefined
    renderWaveCard({ ...content, mochiSvg: serializeMochi(svg) }).then(
      (blob) => {
        if (!alive) return
        url = URL.createObjectURL(blob)
        setDrawn({ key, blob, url, file: waveCardFile(blob) })
      },
      (err) => {
        console.warn('[moshi] wave card drawing failed', err)
        if (alive) setDrawn({ key, failed: true })
      },
    )
    return () => {
      alive = false
      if (url) URL.revokeObjectURL(url)
    }
    // `key` covers content, face and retries
  }, [key])

  useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 2400)
    return () => window.clearTimeout(id)
  }, [copied])

  const current = drawn?.key === key ? drawn : null
  const ready = current && !('failed' in current) ? current : null
  const failed = !!current && 'failed' in current
  const link = content.link
  const tone = MOCHI[wave.archetype.tone]

  const copy = async () => {
    if (await copyText(link)) {
      setCopied(true)
      setStatus(t('คัดลอกลิงก์แล้ว วางในแชทหรือโพสต์ไหนก็ได้เลย', 'Link copied. Paste it into any chat or post'))
    } else {
      setStatus(t('คัดลอกไม่ได้ ลองกดค้างที่ลิงก์ด้านล่างแล้วคัดลอกเองนะ', "Couldn't copy. Press and hold the link below to copy it yourself"))
    }
  }

  const share = () => {
    setStatus('')
    // no awaits before this: the share sheet needs the tap to still be fresh
    void shareWaveCard({
      file: ready?.file,
      link,
      text: t('มาเทียบคลื่นกับเราใน moshimoshi กัน 🌊', 'Come compare waves with me on moshimoshi 🌊'),
    }).then((r) => {
      if (r === 'shared') setStatus(t('แชร์แล้ว! รอเพื่อนกดลิงก์มาเทียบคลื่นได้เลย', 'Shared! Now wait for friends to tap the link'))
      else if (r === 'failed') setStatus(t('แชร์ไม่สำเร็จ ลองบันทึกรูปหรือคัดลอกลิงก์แทนนะ', "Sharing didn't work. Try saving the image or copying the link"))
    })
  }

  const save = () => {
    if (!ready) return
    downloadBlob(ready.blob)
    setStatus(t('บันทึกรูปแล้ว เอาไปลงสตอรี่ได้เลย', 'Image saved. Post it to your story!'))
  }

  const alt = t(
    `บัตรคลื่นของ ${content.name}: คลื่นของฉันคือ ${wave.archetype.title}. ${wave.archetype.line}${content.interests.length ? `. เรื่องที่ชอบ: ${content.interests.map((i) => i.label).join(', ')}` : ''}${content.lifeStages.length ? `. ช่วงชีวิตตอนนี้: ${content.lifeStages.map((s) => s.label).join(', ')}` : ''}. ลิงก์ ${printedLink(link)}`,
    `${content.name}'s wave card: my wave is ${wave.archetype.title}. ${wave.archetype.line}${content.interests.length ? `. Into: ${content.interests.map((i) => i.label).join(', ')}` : ''}${content.lifeStages.length ? `. Life right now: ${content.lifeStages.map((s) => s.label).join(', ')}` : ''}. Link ${printedLink(link)}`,
  )

  return (
    <div className="pb-2">
      {/* the 2D mochi the image is drawn from (never shown: serializing needs no layout) */}
      <span ref={mochiBox} className="hidden" aria-hidden>
        <Avatar color={me.color} face={face} size={300} />
      </span>

      <div className="relative mx-auto aspect-[9/16] max-w-full" style={{ height: 'min(54dvh, 560px)' }}>
        {ready ? (
          <motion.img
            key={ready.url}
            src={ready.url}
            alt={alt}
            width={1080}
            height={1920}
            initial={reduce ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={spring.soft}
            className="size-full rounded-[1.75rem] object-contain shadow-[var(--shadow-lift)]"
          />
        ) : (
          <div
            className="flex size-full flex-col items-center justify-center gap-3 overflow-hidden rounded-[1.75rem] px-4 text-center shadow-[var(--shadow-soft)]"
            style={{ background: `linear-gradient(180deg, ${tone.light}, #FFF7EE 55%, ${tone.base})` }}
            role="status"
            aria-live="polite"
          >
            {failed ? (
              <>
                <ImageOff size={28} aria-hidden className="text-ink-soft" />
                <p className="font-display text-base font-semibold text-ink">{t('วาดบัตรไม่สำเร็จ', "Couldn't draw the card")}</p>
                <Button size="sm" variant="secondary" icon={<RotateCcw size={16} aria-hidden />} onClick={() => setAttempt((n) => n + 1)}>
                  {t('ลองอีกครั้ง', 'Try again')}
                </Button>
              </>
            ) : (
              <>
                <span className={reduce ? '' : 'animate-float'}>
                  <Avatar color={me.color} face={face} size={88} />
                </span>
                <p className="font-display text-base font-semibold break-words text-ink">
                  {wave.archetype.emoji} {wave.archetype.title}
                </p>
                <p className="text-xs text-ink-soft">{t('กำลังวาดบัตรคลื่น…', 'Drawing your wave card…')}</p>
              </>
            )}
          </div>
        )}
      </div>

      <p className="mx-auto mt-4 max-w-sm text-center text-sm text-ink-soft">
        {t(
          'ลงสตอรี่ IG, TikTok หรือส่งใน LINE เพื่อนกดลิงก์แล้วจะเห็นว่าคลื่นตรงกับเราแค่ไหน',
          "Post it to your IG or TikTok story, or send it on LINE. Friends who tap the link see how well your waves match",
        )}
      </p>

      <div className="mt-4">
        {hasShare ? (
          <Button block size="lg" icon={<Share2 size={20} aria-hidden />} onClick={share}>
            {t('แชร์บัตรคลื่น', 'Share my wave card')}
          </Button>
        ) : (
          <Button block size="lg" icon={<Download size={20} aria-hidden />} onClick={save} disabled={!ready}>
            {t('บันทึกรูป', 'Save image')}
          </Button>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          {hasShare && (
            <Button variant="secondary" icon={<Download size={18} aria-hidden />} onClick={save} disabled={!ready} className="min-w-0 flex-1 basis-[9.5rem] px-3">
              {t('บันทึกรูป', 'Save image')}
            </Button>
          )}
          <Button
            variant="secondary"
            icon={copied ? <Check size={18} aria-hidden /> : <Link2 size={18} aria-hidden />}
            onClick={() => void copy()}
            className="min-w-0 flex-1 basis-[9.5rem] px-3"
          >
            {copied ? t('คัดลอกแล้ว', 'Copied') : t('คัดลอกลิงก์', 'Copy link')}
          </Button>
        </div>
      </div>

      <p role="status" aria-live="polite" className="mt-2 min-h-5 text-center text-sm font-semibold text-ink">
        {status}
      </p>

      <p className="mt-1 text-center text-xs text-ink-soft">
        {t('ลิงก์ของเรา', 'Your link')}:{' '}
        <span className="font-semibold break-all text-ink select-all">{printedLink(link)}</span>
      </p>

      {answered < FEW_ANSWERS && (
        <p className="mt-4 flex items-start justify-center gap-2 rounded-2xl bg-butter/35 px-4 py-3 text-sm text-ink">
          <Sparkles size={16} aria-hidden className="mt-0.5 shrink-0" />
          <span>
            {t('เล่นจูนคลื่นอีกนิด บัตรจะเป็นตัวเรามากขึ้น ', 'Play a few more wave-tuning rounds and the card gets more like you. ')}
            <Link to="/app/tune" className="font-semibold underline decoration-peach decoration-2 underline-offset-4">
              {t('ไปจูนคลื่น', 'Tune your wave')}
            </Link>
          </span>
        </p>
      )}
    </div>
  )
}
