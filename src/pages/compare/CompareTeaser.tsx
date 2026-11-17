import { Lock, RotateCcw } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Avatar, Button, ButtonLink } from '@/components/ui'
import { comparePath, rememberCompareInvite } from '@/data/compare'
import { useComparePreview } from '@/data/hooks'
import { rememberNext, signInWithGoogle } from '@/lib/auth'
import { displayName, t } from '@/lib/i18n'
import { currentInAppBrowser, OUTSIDE_MARK } from '@/lib/inAppBrowser'
import { AuthShell, ErrorNote } from '@/pages/auth/AuthShell'
import { authErrorText } from '@/pages/auth/errors'
import { GoogleButton } from '@/pages/auth/parts/GoogleButton'
import { InAppNudge, OpenInBrowser } from '@/pages/auth/parts/OpenInBrowser'
import { LegalLinks } from '@/pages/legal/LegalLinks'
import { WaveLine } from './parts'

/**
 * /c/:userId signed out: the card owner's mochi and name (all the link may show before sign-in),
 * a peek at what the comparison holds, and one way in: Google, straight back to the comparison
 * (someone new goes through onboarding first; the router remembers the invite). Inside LINE,
 * Instagram, TikTok… Google won't sign anyone in, so it shows the way out to a real browser,
 * as the login page does (the way out opens this same /c/ link, which remembers the invite there).
 */
export function CompareTeaser({ userId }: { userId: string }) {
  const { status, preview, retry } = useComparePreview(userId)
  const [params, setParams] = useSearchParams()
  const [inApp] = useState(currentInAppBrowser)
  const [nudge, setNudge] = useState(0)
  const [anyway, setAnyway] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const whyId = useId()
  const googleId = useId()
  const errId = useId()
  const marked = params.has(OUTSIDE_MARK)

  // made it out into a real browser: take LINE's mark back out of the address
  useEffect(() => {
    if (inApp || !marked) return
    setParams(
      (p) => {
        const clean = new URLSearchParams(p)
        clean.delete(OUTSIDE_MARK)
        return clean
      },
      { replace: true },
    )
  }, [inApp, marked, setParams])

  // back from Google with the browser's Back button (bfcache): unfreeze the button
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setBusy(false)
    }
    window.addEventListener('pageshow', onShow)
    return () => window.removeEventListener('pageshow', onShow)
  }, [])

  if (status === 'loading')
    return (
      <AuthShell face="talk" color="mint" bubble={t('แป๊บนึงนะ', 'One sec!')}>
        <p role="status" className="py-6 text-center font-display text-lg font-semibold text-ink">
          {t('กำลังเปิดบัตรคลื่น…', 'Opening the wave card…')}
        </p>
      </AuthShell>
    )

  if (status === 'failed')
    return (
      <AuthShell face="wow" color="sky" bubble={t('อุ๊ย เน็ตสะดุด', 'Oops, a hiccup')}>
        <h1 className="text-center font-display text-2xl font-semibold text-ink">{t('เปิดบัตรคลื่นไม่ได้', "Couldn't open the wave card")}</h1>
        <p className="mx-auto mt-1 max-w-xs text-center text-[15px] text-ink-soft">
          {t('สัญญาณอาจหลุดไปแป๊บนึง ลองอีกครั้งนะ', 'The connection may have dropped for a moment. Give it another go')}
        </p>
        <Button block size="lg" className="mt-6" icon={<RotateCcw size={18} aria-hidden />} onClick={retry}>
          {t('ลองอีกครั้ง', 'Try again')}
        </Button>
      </AuthShell>
    )

  if (status === 'missing' || !preview)
    return (
      <AuthShell face="sleepy" color="cream" bubble={t('หาไม่เจอเลย…', "Can't find it…")}>
        <h1 className="text-center font-display text-2xl font-semibold text-ink">{t('ไม่เจอบัตรคลื่นใบนี้', "We couldn't find this wave card")}</h1>
        <p className="mx-auto mt-1 max-w-xs text-center text-[15px] text-ink-soft">
          {t('ลิงก์อาจไม่ครบ หรือเจ้าของบัตรไม่ได้เปิดให้เห็นแล้ว แต่ยังมีเพื่อนคลื่นเดียวกันรออยู่อีกเพียบ', 'The link may be cut off, or its owner no longer shows it. Plenty of people on your wavelength are still waiting, though')}
        </p>
        <ButtonLink to="/" block size="lg" className="mt-6">
          {t('มาทำความรู้จัก moshimoshi', 'Get to know moshimoshi')}
        </ButtonLink>
      </AuthShell>
    )

  const name = displayName(preview.name)

  const signIn = async () => {
    setBusy(true)
    setError(null)
    try {
      rememberCompareInvite(userId)
      rememberNext(comparePath(userId))
      await signInWithGoogle() // leaves the page on success
    } catch (err) {
      setError(authErrorText(err))
      setBusy(false)
    }
  }
  // inside an app's browser Google only shows its "403 disallowed_useragent" dead end: point at the way out instead
  const blocked = !!inApp && !anyway
  const google = () => {
    if (blocked) setNudge((n) => n + 1)
    else void signIn()
  }
  const goAnyway = () => {
    document.getElementById(googleId)?.focus()
    setAnyway(true)
    void signIn()
  }

  return (
    <AuthShell face={preview.face ?? 'happy'} color={preview.color} bubble={t('มาเทียบคลื่นกัน~', "Let's compare waves~")}>
      <h1 className="text-center font-display text-[1.6rem] leading-snug font-semibold break-words text-ink">
        {t(`มาเทียบคลื่นกับ ${name} กัน`, `Compare waves with ${name}`)}
      </h1>
      <p className="mx-auto mt-1 max-w-xs text-center text-[15px] text-ink-soft">
        {t(
          'ดูว่าเรื่องที่ชอบ ช่วงชีวิต และคำตอบจูนคลื่นของเราตรงกันแค่ไหน แล้วทักแชทกันต่อได้เลย',
          'See how your interests, life stage and wave-tuning picks line up, then say hi right away',
        )}
      </p>

      {/* what's waiting on the other side of sign-in */}
      <div className="mt-5 flex flex-col items-center rounded-[1.75rem] bg-white/70 px-4 pt-4 pb-3 ring-1 ring-line" aria-hidden>
        <div className="flex items-center justify-center gap-2">
          <Avatar color={preview.color} face={preview.face ?? 'happy'} size={56} />
          <WaveLine className="h-8 w-16 shrink-0 sm:w-24" />
          <Avatar color="cream" face="wow" size={56} />
        </div>
        {/* no level before there's a comparison: grey bars and a "?" (never a made-up match) */}
        <div className="mt-2 flex items-center justify-center gap-2">
          <span className="inline-flex h-6 items-end gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <span key={i} className="block w-2 rounded-full bg-ink/12" style={{ height: `${28 + i * 14.4}%` }} />
            ))}
          </span>
          <span className="inline-flex size-6 items-center justify-center rounded-full bg-white font-display text-sm font-bold text-ink-soft shadow-[var(--shadow-soft)]">
            ?
          </span>
        </div>
        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink shadow-[var(--shadow-soft)]">
          <Lock size={13} aria-hidden />
          {t('เข้าสู่ระบบแล้วจะเห็นผล', 'Sign in to see it')}
        </span>
      </div>

      {inApp && (
        <div className="mt-5">
          <OpenInBrowser browser={inApp} tried={marked} nudge={nudge} whyId={whyId} />
        </div>
      )}
      <div className={inApp ? 'mt-4' : 'mt-6'}>
        <GoogleButton id={googleId} busy={busy} disabled={busy} blocked={blocked} describedBy={blocked ? whyId : error ? errId : undefined} onClick={google} />
      </div>
      {blocked && inApp && <InAppNudge browser={inApp} nudge={nudge} onAnyway={goAnyway} />}
      <div className="mt-2">
        <ErrorNote id={errId} text={error} />
      </div>

      <p className="mt-2 text-center text-xs leading-relaxed text-ink-soft">
        {t('ที่นี่หาเพื่อน ไม่ใช่หาคู่ · ในแอปเราคือโมจิกับชื่อเล่น ไม่ต้องใช้รูปจริง', "It's for friends, not dating · In the app you're a mochi with a nickname, no photos needed")}
      </p>
      <LegalLinks consent className="mt-3 text-center" />
    </AuthShell>
  )
}
