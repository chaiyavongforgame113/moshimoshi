import { Waves } from 'lucide-react'
import { useParams } from 'react-router'
import { Avatar, ButtonLink, PageHeader, Zone } from '@/components/ui'
import { useCompare, useDataReady, useServerFeatures } from '@/data/hooks'
import { t } from '@/lib/i18n'
import { useMoshi } from '@/lib/store'
import { PageSkeleton } from '@/pages/people/Skeleton'
import { CompareResult } from './CompareResult'
import { CompareTeaser } from './CompareTeaser'
import { WaveCardPanel } from './WaveCardPanel'

/*
 * Routes (app/router):
 * - /c/:userId           public, outside the app shell: `teaser`. Signed out: the card owner's name +
 *                        mochi and one way in (Google). Signed in (or demo) the router goes straight on to:
 * - /app/compare/:userId inside the app shell: the comparison; my own id shows my card to share.
 */
export default function ComparePage({ teaser = false }: { teaser?: boolean }) {
  const { userId = '' } = useParams()
  return teaser ? <CompareTeaser userId={userId} /> : <Compare userId={userId} />
}

/** Back goes to where they came from; opened straight from a link, to home. */
const backTo = () => ((window.history.state as { idx?: number } | null)?.idx ? true : '/app')

function Compare({ userId }: { userId: string }) {
  const view = useCompare(userId)
  if (view.status === 'loading') return <PageSkeleton label={t('กำลังเทียบคลื่น…', 'Comparing waves…')} />
  if (view.status === 'self') return <MyCard />
  if (view.status === 'missing' || !view.person) return <Missing />
  return (
    <div className="pb-10">
      <PageHeader back={backTo()} title={t('เทียบคลื่น', 'Compare waves')} />
      <CompareResult view={view} person={view.person} />
    </div>
  )
}

/** My own link: my card and the ways to share it (once a shared link can open for anyone). */
function MyCard() {
  const tone = useMoshi((s) => s.me.color)
  const on = useServerFeatures().waveCard
  // the first load is what finds out
  const loaded = useDataReady()
  if (!on) return loaded ? <CardsSoon /> : <PageSkeleton label={t('กำลังเปิดบัตรคลื่น…', 'Opening your wave card…')} />
  return (
    <div className="pb-10">
      <PageHeader back={backTo()} title={t('บัตรคลื่นของฉัน', 'My wave card')} />
      <Zone
        tone={tone}
        icon={<Waves size={18} />}
        title={t('นี่คือบัตรของเราเอง', 'This is your own card')}
        note={t('ส่งให้เพื่อน แล้วเพื่อนจะเห็นว่าคลื่นตรงกับเราแค่ไหน', "Send it to friends and they'll see how well your waves match")}
        className="mx-auto max-w-xl"
      >
        <WaveCardPanel />
      </Zone>
    </div>
  )
}

/** Before the server can open a shared card's link for someone signed out: nothing to share yet. */
function CardsSoon() {
  return (
    <div className="pb-10">
      <PageHeader back={backTo()} title={t('บัตรคลื่นของฉัน', 'My wave card')} />
      <Zone tone="cream" className="mx-auto max-w-xl">
        <div className="flex flex-col items-center py-4 text-center">
          <Avatar color="cream" face="happy" size={96} />
          <h2 className="mt-3 font-display text-xl font-semibold text-ink">{t('บัตรคลื่นใกล้มาแล้ว', 'Wave cards are almost here')}</h2>
          <p className="mt-1 max-w-sm text-[15px] text-ink-soft">
            {t('อีกนิดเดียวก็แชร์บัตรให้เพื่อนกดมาเทียบคลื่นได้แล้ว ระหว่างนี้ไปดูเพื่อนที่คลื่นตรงกันก่อนนะ', "Soon you can share a card for friends to compare waves. Meanwhile, see who's on your wavelength")}
          </p>
          <ButtonLink to="/app/people" className="mt-5">
            {t('ไปหาเพื่อนที่คลื่นตรงกัน', 'Find people on your wavelength')}
          </ButtonLink>
        </div>
      </Zone>
    </div>
  )
}

/** No such card (a typo, someone who left or can't be shown, or a block either way). */
function Missing() {
  return (
    <div className="pb-10">
      <PageHeader back={backTo()} title={t('เทียบคลื่น', 'Compare waves')} />
      <Zone tone="cream" className="mx-auto max-w-xl">
        <div className="flex flex-col items-center py-4 text-center">
          <Avatar color="cream" face="sleepy" size={96} />
          <h2 className="mt-3 font-display text-xl font-semibold text-ink">{t('ไม่เจอบัตรคลื่นใบนี้', "We couldn't find this wave card")}</h2>
          <p className="mt-1 max-w-sm text-[15px] text-ink-soft">
            {t(
              'ลิงก์อาจไม่ครบ หรือเจ้าของบัตรไม่ได้เปิดให้เห็นแล้ว แต่ยังมีเพื่อนคลื่นเดียวกันรออยู่อีกเพียบนะ',
              'The link may be cut off, or its owner no longer shows it. Plenty of people on your wavelength are still around, though',
            )}
          </p>
          <ButtonLink to="/app/people" className="mt-5">
            {t('ไปหาเพื่อนที่คลื่นตรงกัน', 'Find people on your wavelength')}
          </ButtonLink>
        </div>
      </Zone>
    </div>
  )
}
