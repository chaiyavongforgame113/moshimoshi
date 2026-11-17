// Wave cards ("บัตรคลื่น"): the link a card carries, and remembering whose card brought someone in
// so they land on the comparison after signing in and finishing onboarding.
//
// The link is /c/<user id>: a public page (no sign-in) that shows the teaser (wave_card_preview:
// name + mochi only). Signed in, it goes on to /app/compare/<user id>. Someone new signs in, the
// onboarding sends them to /app, and the /app shell takes the remembered invite and opens the
// comparison (see PendingCompare in app/router).

const KEY = 'moshi-compare-invite'
/** an invite older than this is forgotten (they came back another day on their own) */
const TTL_MS = 24 * 3_600_000
const ID = /^[A-Za-z0-9-]{1,64}$/

/** The path of the public teaser page for someone's card. */
export const compareTeaserPath = (userId: string) => `/c/${encodeURIComponent(userId)}`

/** The signed-in comparison page. */
export const comparePath = (userId: string) => `/app/compare/${encodeURIComponent(userId)}`

/** The full link a wave card carries (share it, copy it, print it on the image). */
export const compareLink = (userId: string) => `${window.location.origin}${compareTeaserPath(userId)}`

interface Kept {
  id: string
  at: number
}

function read(): Kept | null {
  try {
    const raw = localStorage.getItem(KEY)
    const k = raw ? (JSON.parse(raw) as Kept) : null
    if (!k || typeof k.id !== 'string' || !ID.test(k.id) || typeof k.at !== 'number') return null
    return Date.now() - k.at > TTL_MS ? null : k
  } catch {
    return null
  }
}

/** Someone opened a card's link: remember whose (until they reach the comparison, or a day). */
export function rememberCompareInvite(userId: string) {
  if (!ID.test(userId)) return
  try {
    localStorage.setItem(KEY, JSON.stringify({ id: userId, at: Date.now() } satisfies Kept))
  } catch {
    /* storage blocked: they land on /app instead, and can open the link again */
  }
}

/** The card that brought this visitor in, if any (still kept). */
export const peekCompareInvite = (): string | null => read()?.id ?? null

/** Forget it (they reached the comparison). With an id: only if it's that one. */
export function clearCompareInvite(userId?: string) {
  try {
    if (userId && read()?.id !== userId) return
    localStorage.removeItem(KEY)
  } catch {
    /* nothing to clear */
  }
}

/** Take the remembered invite once (it's cleared): the comparison to open now. Never my own card. */
export function takeCompareInvite(myId: string): string | null {
  const id = peekCompareInvite()
  clearCompareInvite()
  return id && id !== myId ? id : null
}
