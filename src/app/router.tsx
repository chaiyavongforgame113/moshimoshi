import { Fragment, lazy, Suspense, useEffect, type ReactNode } from 'react'
import { createBrowserRouter, Navigate, Outlet, ScrollRestoration, useLocation, useNavigate, useParams } from 'react-router'
import { comparePath, rememberCompareInvite, takeCompareInvite } from '@/data/compare'
import { useMyId } from '@/data/hooks'
import { useAuth } from '@/lib/auth'
import { t, useLang } from '@/lib/i18n'
import { LiveBoot, LiveToast, RequireAuth } from '@/pages/auth/guards'
import { AppShell } from './AppShell'
import { RouteError } from './RouteError'

// Each page is its own chunk so the landing page loads fast.
const LandingPage = lazy(() => import('@/pages/landing/LandingPage'))
const OnboardingPage = lazy(() => import('@/pages/onboarding/OnboardingPage'))
const HomePage = lazy(() => import('@/pages/home/HomePage'))
const PostIntentPage = lazy(() => import('@/pages/post/PostIntentPage'))
const RoomsPage = lazy(() => import('@/pages/rooms/RoomsPage'))
const RoomPage = lazy(() => import('@/pages/rooms/RoomPage'))
const PeoplePage = lazy(() => import('@/pages/people/PeoplePage'))
const ProfilePage = lazy(() => import('@/pages/people/ProfilePage'))
const ChatsPage = lazy(() => import('@/pages/chats/ChatsPage'))
const ChatPage = lazy(() => import('@/pages/chats/ChatPage'))
const MePage = lazy(() => import('@/pages/me/MePage'))
const EventPage = lazy(() => import('@/pages/events/EventPage'))
const TunePage = lazy(() => import('@/pages/tune/TunePage'))
const ComparePage = lazy(() => import('@/pages/compare/ComparePage'))
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const AuthCallbackPage = lazy(() => import('@/pages/auth/AuthCallbackPage'))
const AdminPage = lazy(() => import('@/pages/admin/AdminPage'))
const AdminRoomsPage = lazy(() => import('@/pages/admin/AdminPage').then((m) => ({ default: m.AdminRoomsPage })))
const PrivacyPage = lazy(() => import('@/pages/legal/PrivacyPage'))
const TermsPage = lazy(() => import('@/pages/legal/TermsPage'))
// dev-only 3D gallery for tuning characters and scenes (not routed in production builds)
const Gallery3D = import.meta.env.DEV ? lazy(() => import('@/pages/dev/Gallery3D')) : null
const StoryPreview = import.meta.env.DEV ? lazy(() => import('@/pages/dev/StoryPreview')) : null

function PageFallback() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center" role="status" aria-label={t('กำลังโหลด', 'Loading')}>
      <span className="size-12 animate-bounce rounded-full bg-peach shadow-[var(--shadow-puffy)]" />
    </div>
  )
}

const page = (node: ReactNode) => <Suspense fallback={<PageFallback />}>{node}</Suspense>

function Root() {
  // a new language re-renders every page from scratch, so t() calls never go stale
  const lang = useLang()
  return (
    <>
      <ScrollRestoration />
      <LiveBoot />
      <Fragment key={lang}>
        <Outlet />
        <LiveToast />
      </Fragment>
    </>
  )
}

/**
 * /c/:userId, the link on a wave card: open to everyone. Signed out, the teaser (name + mochi, then
 * sign in); signed in (or demo), on to the comparison. Either way the invite is remembered, so
 * someone who signs up first (login → onboarding → /app) still lands on the comparison.
 */
function CompareGate() {
  const { userId = '' } = useParams()
  const { status } = useAuth()
  useEffect(() => {
    if (userId) rememberCompareInvite(userId)
  }, [userId])
  if (!userId) return <Navigate to="/" replace />
  if (status === 'signedIn' || status === 'demo') return <Navigate to={comparePath(userId)} replace />
  if (status === 'loading') return <PageFallback />
  return page(<ComparePage teaser />)
}

/** Inside the app shell: a wave card that brought me here before sign-up opens once I'm in. */
function PendingCompare() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const myId = useMyId()
  useEffect(() => {
    if (!myId || pathname.startsWith('/app/compare/')) return
    const id = takeCompareInvite(myId)
    if (id) navigate(comparePath(id))
    // once per person, when the app shell opens (not on every navigation)
  }, [myId])
  return null
}

/** Installed PWA opens straight into the app instead of the marketing page. */
function LandingOrApp() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches
  return standalone ? <Navigate to="/app" replace /> : page(<LandingPage />)
}

function LegacyInviteRoute() {
  const { search, hash } = useLocation()
  return <Navigate to={{ pathname: '/app/people/invites/compose', search, hash }} replace />
}

export const router = createBrowserRouter([
  {
    element: <Root />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <LandingOrApp /> },
      { path: '/login', element: page(<LoginPage />) },
      { path: '/auth/callback', element: page(<AuthCallbackPage />) },
      { path: '/privacy', element: page(<PrivacyPage />) },
      { path: '/terms', element: page(<TermsPage />) },
      // a wave card's link: public teaser, then the comparison (see CompareGate)
      { path: '/c/:userId', element: <CompareGate /> },
      // staff console: signed in via the live guard (no onboarding detour), then the page checks is_admin() itself
      { path: '/admin', element: <RequireAuth onboarding>{page(<AdminPage />)}</RequireAuth> },
      { path: '/admin/rooms', element: <RequireAuth onboarding>{page(<AdminRoomsPage />)}</RequireAuth> },
      { path: '/onboarding', element: <RequireAuth onboarding>{page(<OnboardingPage />)}</RequireAuth> },
      ...(Gallery3D ? [{ path: '/dev/3d', element: page(<Gallery3D />) }] : []),
      ...(StoryPreview ? [{ path: '/dev/story', element: page(<StoryPreview />) }] : []),
      {
        path: '/app',
        // live mode: signed in + onboarded (demo mode passes straight through)
        element: (
          <RequireAuth>
            <PendingCompare />
            <AppShell />
          </RequireAuth>
        ),
        children: [
          { index: true, element: page(<HomePage />) },
          { path: 'post', element: <LegacyInviteRoute /> },
          { path: 'rooms', element: page(<RoomsPage />) },
          { path: 'rooms/:roomId', element: page(<RoomPage />) },
          { path: 'people', element: page(<PeoplePage />) },
          { path: 'people/invites/compose', element: page(<PostIntentPage />) },
          { path: 'people/:userId', element: page(<ProfilePage />) },
          { path: 'chats', element: page(<ChatsPage />) },
          { path: 'chats/:chatId', element: page(<ChatPage />) },
          { path: 'me', element: page(<MePage />) },
          { path: 'events/:sessionId', element: page(<EventPage />) },
          { path: 'tune', element: page(<TunePage />) },
          // comparing waves with whoever's wave card brought me here (watching together lives in RoomPage)
          { path: 'compare/:userId', element: page(<ComparePage />) },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
