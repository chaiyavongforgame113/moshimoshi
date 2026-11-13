import { motion, useReducedMotion } from 'motion/react'
import { CircleHelp, Megaphone, Plus, Radio, UsersRound, Wifi } from 'lucide-react'
import { useCallback, useId, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { KineticText } from '@/components/motion'
import { Avatar, Button, ButtonLink, Chip, IconButton, PageHeader, ShowMore, Tabs, tabId, tabPanelId, Zone, zoneAction, type MochiFace, type TabItem } from '@/components/ui'
import { useDailyPick, useDataReady, useInviteBoard, usePeople, useWavelengthMatches } from '@/data/hooks'
import { t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import { useMoshi } from '@/lib/store'
import type { MochiColor } from '@/lib/types'
import { InviteButton } from '@/pages/home/Soft'
import { useWave, waveHref } from '@/pages/me/wave'
import { InviteCard } from './InviteCard'
import { PersonRow } from './PersonRow'
import { SignalInfoSheet } from './SignalScale'
import { ListSkeleton } from './Skeleton'
import { TodaysWave } from './TodaysWave'

type TabKey = 'wave' | 'invites'

/** ?tab=invites opens the board; anything else is the wavelength tab. */
const tabOf = (value: string | null): TabKey => (value === 'invites' ? 'invites' : 'wave')

export default function PeoplePage() {
  const [params, setParams] = useSearchParams()
  const tab = tabOf(params.get('tab'))
  const idBase = `people${useId().replace(/:/g, '')}`
  const [infoOpen, setInfoOpen] = useState(false)
  const closeInfo = useCallback(() => setInfoOpen(false), [])

  const setTab = (next: TabKey) =>
    setParams(
      (p) => {
        if (next === 'wave') p.delete('tab')
        else p.set('tab', next)
        return p
      },
      { replace: true },
    )

  const tabs: TabItem<TabKey>[] = [
    { key: 'wave', label: t('คลื่นเดียวกัน', 'Same wavelength'), icon: <Radio size={16} strokeWidth={2.4} /> },
    { key: 'invites', label: t('ชวนเล่น', 'Invites'), icon: <Megaphone size={16} strokeWidth={2.4} /> },
  ]

  return (
    <div>
      <PageHeader
        title={<KineticText text={t('คนคลื่นเดียวกัน', 'People on your wavelength')} />}
        subtitle={t('คนที่ถูกคอกับเรา และคำชวนที่น่าไปด้วย', 'People who click with you, and invites worth joining')}
        action={
          <IconButton label={t('สัญญาณถูกคอคืออะไร', "What's a vibe signal?")} onClick={() => setInfoOpen(true)}>
            <CircleHelp size={20} />
          </IconButton>
        }
      />

      <Tabs items={tabs} value={tab} onChange={setTab} idBase={idBase} className="mt-2 w-full sm:w-fit" />

      <div role="tabpanel" id={tabPanelId(idBase, tab)} aria-labelledby={tabId(idBase, tab)}>
        {tab === 'wave' ? <WaveTab /> : <InvitesTab />}
      </div>

      <SignalInfoSheet open={infoOpen} onClose={closeInfo} />
    </div>
  )
}

// ---------- คลื่นเดียวกัน ----------

function WaveTab() {
  const ready = useDataReady()
  const myAge = useMoshi((s) => s.me.age)
  const people = usePeople()
  const byId = useMemo(() => new Map(people.map((u) => [u.id, u])), [people])
  const daily = useDailyPick()
  const matches = useWavelengthMatches()
  const [onlineOnly, setOnlineOnly] = useState(false)

  const dailyUser = daily && byId.get(daily.userId)
  const rest = useMemo(
    () =>
      matches.flatMap((m) => {
        const u = m.userId === daily?.userId ? undefined : byId.get(m.userId)
        return u ? [{ m, u }] : []
      }),
    [matches, byId, daily?.userId],
  )
  const shown = useMemo(() => (onlineOnly ? rest.filter(({ u }) => u.isOnline) : rest), [rest, onlineOnly])
  const wave = useWave()

  if (!ready) return <ListSkeleton count={3} label={t('กำลังหาคนคลื่นเดียวกัน…', 'Finding people on your wavelength…')} />

  if (!dailyUser && !rest.length) {
    const nobody = people.length === 0
    // one next step: the piece of my wave that's still missing (it opens right there), or, with
    // the wave already clear, bringing friends along
    const missing = wave.next
    return (
      <EmptyState
        color="lavender"
        face="sleepy"
        title={nobody ? t('ยังไม่มีเพื่อนคนอื่นแวะมาเลย', 'Nobody else has dropped by yet') : t('ยังไม่เจอคนที่คลื่นตรงกันพอ', 'No one quite on your wavelength yet')}
        text={
          nobody
            ? missing
              ? t(
                  'ชุมชนเพิ่งเริ่มต้น เล่าเรื่องของเราไว้ก่อนนะ พอมีคนที่ชอบเหมือนกันเข้ามา โมชิจะพามาเจอเราทันที',
                  "The community's just getting started. Tell us about yourself now, and Mochi will bring people who like the same things to you as soon as they join.",
                )
              : t(
                  'ชุมชนเพิ่งเริ่มต้น ชวนเพื่อนมาเล่นด้วยกันสิ พอมีคนที่ชอบเหมือนกันเข้ามา โมชิจะพามาเจอเราทันที',
                  "The community's just getting started. Bring your friends along, and Mochi will introduce you to people who like the same things as soon as they join.",
                )
            : missing?.item.key === 'tune'
              ? t(
                  'โมชิแนะนำเฉพาะคนที่ถูกคอกับเราจริงๆ ลองเล่นจูนคลื่นอีกนิด คลื่นจะชัดขึ้นและเจอคนที่ใช่ง่ายขึ้นนะ',
                  'Mochi only suggests people who really click with you. A few quick this-or-thats make your wave clearer and easier to match.',
                )
              : missing
                ? t(
                    'โมชิแนะนำเฉพาะคนที่ถูกคอกับเราจริงๆ เล่าเรื่องของเราอีกนิด คลื่นจะชัดขึ้นและเจอคนที่ใช่ง่ายขึ้นนะ',
                    'Mochi only suggests people who really click with you. Share a little more and your wave gets clearer and easier to match.',
                  )
                : t(
                    'โมชิแนะนำเฉพาะคนที่ถูกคอกับเราจริงๆ คลื่นของเราชัดแล้ว ยิ่งมีเพื่อนมาเล่นเยอะ ก็ยิ่งเจอคนที่ใช่ง่ายขึ้นนะ',
                    'Mochi only suggests people who really click with you. Your wave is clear, so the more friends join, the sooner your people turn up.',
                  )
        }
        action={
          missing ? (
            <ButtonLink to={waveHref(missing.item.open(wave.context))} icon={<Radio size={18} strokeWidth={2.4} aria-hidden />}>
              {missing.item.cta(missing.left)}
            </ButtonLink>
          ) : (
            <InviteButton variant="primary" />
          )
        }
      />
    )
  }

  return (
    <>
      {daily && dailyUser && <TodaysWave match={daily} user={dailyUser} myAge={myAge} />}

      {rest.length > 0 && (
        <Zone
          tone="pink"
          icon={<UsersRound size={18} strokeWidth={2.4} />}
          title={dailyUser ? t('คนอื่นที่คลื่นตรงกัน', 'More on your wavelength') : t('คนที่คลื่นตรงกัน', 'On your wavelength')}
          note={t('เรียงจากคลื่นตรงมากไปน้อย', 'Closest wavelength first')}
          className="mt-5"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <Chip size="md" color="mint" selected={onlineOnly} onClick={() => setOnlineOnly((v) => !v)} icon={<Wifi size={14} strokeWidth={2.6} aria-hidden />}>
              {t('ออนไลน์อยู่', 'Online now')}
            </Chip>
            <p className="text-sm text-ink-soft" aria-live="polite">
              {t(`${shown.length} คน`, `${shown.length} ${shown.length === 1 ? 'person' : 'people'}`)}
            </p>
          </div>
          {shown.length > 0 ? (
            <ShowMore
              key={onlineOnly ? 'online' : 'all'}
              items={shown}
              initial={5}
              getKey={({ m }) => m.userId}
              render={({ m, u }) => <PersonRow match={m} user={u} myAge={myAge} />}
              listClassName="grid gap-3 xl:grid-cols-2"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-3xl bg-white/70 px-5 py-7 text-center">
              <Avatar color="mint" size={60} face="sleepy" />
              <p className="max-w-xs text-ink-soft">
                {t('ตอนนี้ยังไม่มีใครในคลื่นนี้ออนไลน์ แวะมาใหม่ช่วงหัวค่ำนะ', 'No one on your wavelength is online right now. Check back this evening!')}
              </p>
              <Button variant="secondary" onClick={() => setOnlineOnly(false)}>
                {t('ดูทุกคน', 'Show everyone')}
              </Button>
            </div>
          )}
        </Zone>
      )}
    </>
  )
}

// ---------- ชวนเล่น ----------

function InvitesTab() {
  const ready = useDataReady()
  const board = useInviteBoard()

  if (!ready) return <ListSkeleton count={2} label={t('กำลังโหลดคำชวน…', 'Loading invites…')} />

  if (!board.length)
    return (
      <EmptyState
        color="butter"
        face="wink"
        title={t('ยังไม่มีคำชวนที่ใช่สำหรับเรา', 'No invites for you yet')}
        text={t(
          'เป็นคนเริ่มเองเลยไหม บอกว่าอยากทำอะไร แล้วคนที่คลื่นตรงกันจะเห็นก่อนใคร',
          "Why not start one? Say what you'd like to do, and people on your wavelength will see it first.",
        )}
        action={
          <ButtonLink to="/app/post" icon={<Plus size={18} strokeWidth={2.8} aria-hidden />}>
            {t('ชวนเล่น', 'Invite people')}
          </ButtonLink>
        }
      />
    )

  return (
    <Zone
      tone="butter"
      icon={<Megaphone size={18} strokeWidth={2.4} />}
      title={t('คำชวนที่น่าไปด้วย', 'Invites for you')}
      note={t('จากคนที่ถูกคอกับเรา เรื่องที่เราชอบขึ้นก่อน กด "ฉันด้วย" แล้วเจ้าของโพสต์จะเห็น', 'From people who click with you, things you like first. Tap "Me too!" and the poster will see it')}
      action={
        <Link to="/app/post" className={zoneAction} aria-label={t('ชวนเล่นเอง', 'Post your own invite')}>
          <Plus size={16} strokeWidth={2.6} aria-hidden />
          <span className="max-sm:sr-only">{t('ชวนเอง', 'Post one')}</span>
        </Link>
      }
      className="mt-5"
    >
      <ShowMore
        items={board}
        initial={5}
        getKey={({ intent }) => intent.id}
        render={({ intent, poster, match }) => <InviteCard intent={intent} poster={poster} match={match} />}
        listClassName="grid gap-4 lg:grid-cols-2"
      />
    </Zone>
  )
}

// ---------- shared ----------

/** A warm empty state with exactly one next step. */
function EmptyState({ color, face, title, text, action }: { color: MochiColor; face: MochiFace; title: string; text: string; action: ReactNode }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.soft}
      className="card mt-5 flex flex-col items-center gap-3 rounded-[2rem] px-6 py-10 text-center"
    >
      <Avatar color={color} size={84} face={face} />
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <p className="max-w-sm text-ink-soft">{text}</p>
      <div className="mt-2">{action}</div>
    </motion.div>
  )
}
