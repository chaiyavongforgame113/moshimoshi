import { motion } from 'motion/react'
import { ChevronRight, DoorOpen, Download, MessageCircle, MoonStar, Plus, Radio, type LucideIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, Navigate, NavLink, useLocation, useOutlet } from 'react-router'
import { JellyRipple, Magnetic, RouteTransition } from '@/components/motion'
import { Avatar, ButtonLink, RoomIcon } from '@/components/ui'
import { useChats, useDataMode, useDataReady, useRooms, useSessions } from '@/data/hooks'
import { useInstallPrompt, useIsDesktop, useMediaQuery } from '@/lib/hooks'
import { displayName, L, loc, t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import { useMoshi } from '@/lib/store'
import type { Room, Session } from '@/lib/types'
import { InstallSheet } from './InstallSheet'
import { TabTip, useTabTip } from './TabTip'

interface NavItem {
  to: string
  label: string
  /** compact label for the phone tab bar */
  short?: string
  Icon: LucideIcon
  end?: boolean
}

const NAV: NavItem[] = [
  loc<NavItem>({ to: '/app', label: L('คืนนี้', 'Tonight'), Icon: MoonStar, end: true }),
  loc<NavItem>({ to: '/app/rooms', label: L('ห้อง', 'Rooms'), Icon: DoorOpen }),
  loc<NavItem>({ to: '/app/people', label: L('คนคลื่นเดียวกัน', 'Same wavelength'), short: L('คลื่นเดียวกัน', 'Wavelength'), Icon: Radio }),
  loc<NavItem>({ to: '/app/chats', label: L('แชท', 'Chats'), Icon: MessageCircle }),
]

/*
 * Enter-only page transition: the new page renders in the same commit as the
 * location change, so ScrollRestoration measures (and restores into) the new
 * page instead of the outgoing one. RouteTransition adds the circular wipe
 * from the tap point on top of the shared page fade.
 */
function AnimatedOutlet() {
  const location = useLocation()
  const outlet = useOutlet()
  return <RouteTransition routeKey={location.pathname}>{outlet}</RouteTransition>
}

/** Unread 1:1 messages across all chats (badge on the แชท tab). */
function useUnread() {
  const chats = useChats()
  return chats.reduce((n, c) => n + c.unread, 0)
}

/**
 * Live mode: the 20+ check happens in onboarding, so a signed-in profile that
 * never passed it (not onboarded, no birth year) is sent there first.
 */
function useNeedsAgeCheck() {
  const mode = useDataMode()
  const ready = useDataReady()
  const onboarded = useMoshi((s) => s.onboarded)
  const birthYear = useMoshi((s) => s.me.birthYear)
  return mode === 'live' && ready && !onboarded && !birthYear
}

export function AppShell() {
  const needsAgeCheck = useNeedsAgeCheck()
  const desktop = useIsDesktop()
  // the right rail only once the content column keeps its full width beside it
  const wide = useMediaQuery('(min-width: 1440px)')
  const location = useLocation()
  // full-screen pages (1:1 chat on phones) hide the bottom bar
  const immersive = !desktop && /^\/app\/chats\/[^/]+$/.test(location.pathname)
  // first visit to a main tab: one line from Little Mochi above the page
  const [tip, dismissTip] = useTabTip()

  if (needsAgeCheck) return <Navigate to="/onboarding" replace />

  return (
    <div className="relative z-10 min-h-dvh">
      {desktop ? (
        <div className="mx-auto flex max-w-[1440px] gap-6 px-6">
          <Sidebar />
          <main className="min-w-0 flex-1 pb-16">
            <div className="mx-auto max-w-3xl">
              <TabTip tip={tip} onDismiss={dismissTip} />
              <AnimatedOutlet />
            </div>
          </main>
          {/* the rail's column stays reserved, so pages never shift sideways when an event goes live */}
          {wide && <RightRail />}
        </div>
      ) : (
        <>
          <main className={`px-4 ${immersive ? '' : 'pb-[calc(7.5rem+env(safe-area-inset-bottom))]'}`}>
            <TabTip tip={tip} onDismiss={dismissTip} />
            <AnimatedOutlet />
          </main>
          {!immersive && <BottomNav />}
        </>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ mobile
function BottomNav() {
  const unread = useUnread()
  const items = [NAV[0], NAV[1]]
  const right = [NAV[2], NAV[3]]
  return (
    <nav aria-label={t('เมนูหลัก', 'Main menu')} className="safe-bottom fixed inset-x-0 bottom-0 z-40 px-3">
      <div className="glass relative mx-auto flex max-w-md items-center justify-between rounded-[1.75rem] px-2 py-1.5">
        {items.map((n) => (
          <TabLink key={n.to} item={n} />
        ))}
        <Link
          to="/app/post"
          aria-label={t('ชวนเล่น ชวนคนมาทำอะไรด้วยกัน', 'Invite people to do something together')}
          className="relative -mt-8 flex flex-col items-center rounded-full"
        >
          <Magnetic max={8}>
            <motion.span
              whileTap={{ scaleX: 1.1, scaleY: 0.84 }}
              transition={{ type: 'spring', stiffness: 520, damping: 11, mass: 0.6 }}
              className="relative flex size-16 items-center justify-center rounded-full bg-coral text-ink shadow-[var(--shadow-puffy)] ring-4 ring-cream"
            >
              <Plus size={30} strokeWidth={2.8} />
              <JellyRipple />
            </motion.span>
          </Magnetic>
          <span className="mt-0.5 text-[11px] font-semibold whitespace-nowrap text-ink">{t('ชวนเล่น', 'Invite')}</span>
        </Link>
        {right.map((n) => (
          <TabLink key={n.to} item={n} badge={n.to === '/app/chats' ? unread : undefined} />
        ))}
      </div>
    </nav>
  )
}

function TabLink({ item, badge }: { item: NavItem; badge?: number }) {
  return (
    <NavLink to={item.to} end={item.end} className="relative flex min-w-12 flex-col items-center gap-0.5 rounded-2xl px-1 py-1 text-[11px] font-semibold min-[360px]:min-w-14 min-[360px]:px-2">
      {({ isActive }) => (
        <>
          {isActive && <motion.span layoutId="tab-bg" className="absolute inset-0 rounded-2xl bg-butter/70" transition={spring.bouncy} />}
          <span className="relative">
            <item.Icon size={24} strokeWidth={isActive ? 2.6 : 2} className="text-ink" />
            {!!badge && (
              <span className="absolute -top-1.5 -right-2.5 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-coral px-1 text-[10px] text-ink ring-2 ring-white">
                {badge}
                <span className="sr-only">{t(' ข้อความใหม่', badge === 1 ? ' new message' : ' new messages')}</span>
              </span>
            )}
          </span>
          <span className={`relative whitespace-nowrap ${isActive ? 'text-ink' : 'text-ink-soft'}`}>{item.short ?? item.label}</span>
        </>
      )}
    </NavLink>
  )
}

// ------------------------------------------------------------------ desktop
function Sidebar() {
  const me = useMoshi((s) => s.me)
  const unread = useUnread()
  const install = useInstallPrompt()
  const [installOpen, setInstallOpen] = useState(false)
  return (
    <aside className="sticky top-0 flex h-dvh w-64 shrink-0 flex-col py-6">
      <Link to="/" className="flex items-center gap-2.5 px-2" aria-label={t('moshimoshi หน้าแรก', 'moshimoshi home')}>
        <img src="/logo.svg" alt="" className="size-11 rounded-2xl shadow-[var(--shadow-soft)]" />
        <span className="font-display text-2xl font-bold tracking-tight">moshimoshi</span>
      </Link>
      <nav aria-label={t('เมนูหลัก', 'Main menu')} className="mt-8 flex flex-col gap-1">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className="relative flex h-12 items-center gap-3 rounded-2xl px-4 font-display font-semibold">
            {({ isActive }) => (
              <>
                {isActive && <motion.span layoutId="side-bg" className="absolute inset-0 rounded-2xl bg-white shadow-[var(--shadow-soft)]" transition={spring.soft} />}
                <n.Icon size={22} strokeWidth={isActive ? 2.6 : 2} className="relative text-ink" />
                <span className={`relative ${isActive ? 'text-ink' : 'text-ink-soft'}`}>{n.label}</span>
                {n.to === '/app/chats' && !!unread && (
                  <span className="relative ml-auto inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-coral px-2 text-xs text-ink">
                    {unread}
                    <span className="sr-only">{t(' ข้อความใหม่', unread === 1 ? ' new message' : ' new messages')}</span>
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <Magnetic className="mt-5" max={6} strength={0.25}>
        <ButtonLink
          to="/app/post"
          block
          size="lg"
          icon={<Plus size={20} strokeWidth={2.8} />}
          aria-label={t('ชวนเล่น ชวนคนมาทำอะไรด้วยกัน', 'Invite people to do something together')}
          data-cursor={t('ชวนคนมาเล่นด้วยกัน', 'Invite people')}
        >
          {t('ชวนเล่น', 'Invite')}
          <JellyRipple />
        </ButtonLink>
      </Magnetic>
      <div className="mt-auto space-y-3">
        {!install.installed && (
          <button
            type="button"
            onClick={() => setInstallOpen(true)}
            className="glass flex w-full items-center gap-3 rounded-3xl p-3 text-left"
          >
            <span className="flex size-10 items-center justify-center rounded-2xl bg-mint/60">
              <Download size={20} />
            </span>
            <span className="text-sm leading-snug">
              <b className="font-display">{t('ติดตั้งแอป', 'Install the app')}</b>
              <br />
              <span className="text-ink-soft">{t('เปิดไว บนหน้าจอโฮม', 'Opens fast from your home screen')}</span>
            </span>
          </button>
        )}
        <NavLink to="/app/me" className="flex items-center gap-3 rounded-3xl p-2 hover:bg-white/60">
          <Avatar color={me.color} size={44} face="happy" online />
          <span className="min-w-0">
            <span className="block truncate font-display font-semibold">{displayName(me.name)}</span>
            <span className="block truncate text-xs text-ink-soft">{t('ดูโปรไฟล์ของเรา', 'View my profile')}</span>
          </span>
        </NavLink>
      </div>
      <InstallSheet open={installOpen} onClose={() => setInstallOpen(false)} />
    </aside>
  )
}

/** live events the rail lists before "ดูทั้งหมด" */
const RAIL_EVENTS = 3

/** the busiest live event first */
const byBusiest = (a: Session, b: Session) => b.going - a.going

/**
 * Wide screens only: a compact "อีเวนต์ที่เปิดอยู่ตอนนี้" card while something is live, nothing
 * otherwise (home already lists events, so the card sits out there). The column itself always
 * stays, so the page keeps the same place between the sidebar and it.
 */
function RightRail() {
  const sessions = useSessions()
  const rooms = useRooms()
  const { pathname } = useLocation()
  const home = pathname.replace(/\/$/, '') === '/app'
  const live = useMemo(
    () =>
      sessions
        .filter((s) => s.live)
        .sort(byBusiest)
        .map((s) => ({ s, room: rooms.find((r) => r.id === s.roomId) }))
        .filter((x): x is { s: Session; room: Room } => !!x.room),
    [sessions, rooms],
  )

  if (home || !live.length) return <div aria-hidden className="w-80 shrink-0" />

  return (
    <aside aria-labelledby="rail-live" className="sticky top-0 flex h-dvh w-80 shrink-0 flex-col py-8">
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring.soft} className="card p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 id="rail-live" className="flex min-w-0 items-center gap-2 font-display text-lg leading-snug font-semibold">
            <span className="relative flex size-2.5 shrink-0" aria-hidden>
              <span className="absolute inline-flex size-full rounded-full bg-success opacity-70 motion-safe:animate-ping" />
              <span className="relative inline-flex size-2.5 rounded-full bg-success" />
            </span>
            {t('อีเวนต์ที่เปิดอยู่ตอนนี้', 'Live events now')}
          </h2>
          {live.length > RAIL_EVENTS && (
            <Link
              to="/app/rooms?tab=events"
              className="inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded-full px-2 text-sm font-semibold text-ink-soft underline-offset-4 hover:underline"
            >
              {t('ดูทั้งหมด', 'See all')}
              <ChevronRight size={16} aria-hidden />
            </Link>
          )}
        </div>
        <ul className="mt-3 space-y-2">
          {live.slice(0, RAIL_EVENTS).map(({ s, room }) => (
            <li key={s.id}>
              <Link to={`/app/rooms/${s.roomId}`} className="flex items-center gap-3 rounded-2xl bg-cream p-3 transition-colors hover:bg-cream-2">
                <RoomIcon room={room} size={40} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{s.title}</span>
                  <span className="block truncate text-xs text-ink-soft">
                    {room.name} · {t(`${s.going} คนจะมาร่วม`, `${s.going} going`)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </motion.section>
    </aside>
  )
}
