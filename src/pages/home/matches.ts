import { useMemo } from 'react'
import { useIntents, useMatchExtras, usePeople } from '@/data/hooks'
import { sameTag } from '@/data/tags'
import { matchAll, onWavelength } from '@/lib/matching'
import { useMoshi } from '@/lib/store'
import type { Intent, MatchResult, User } from '@/lib/types'

/** What matching runs on: me, everyone else, everyone else's open posts, and quiz picks / events I'm going to. */
function useMatchInputs() {
  const me = useMoshi((s) => s.me)
  const people = usePeople()
  const all = useIntents()
  const extras = useMatchExtras()
  const others = useMemo(() => all.filter((i) => i.userId !== me.id), [all, me.id])
  return { me, people, others, extras }
}

/**
 * How much someone is into what `intents` are about: 3 = they're inviting people for it too,
 * 2 = it's one of their loves, 1 = it's on their profile, 0 = not at all.
 */
function topicFit(them: User | undefined, intents: Intent[], posts: Intent[]): number {
  if (!them) return 0
  let best = 0
  for (const i of intents) {
    if (posts.some((p) => p.userId === them.id && sameTag(p.tagId, i.tagId))) return 3
    if (them.loves.some((t) => sameTag(t, i.tagId))) best = Math.max(best, 2)
    else if (them.tags.some((t) => sameTag(t, i.tagId))) best = Math.max(best, 1)
  }
  return best
}

/**
 * People to suggest for `intents` (a post just made, one card, …), as if those were my only posts:
 * only those at MIN_LEVEL ("ถูกคอ") and up. Whoever is into the post's topic comes first (posting
 * about it too, then loving it, then having it on their profile), then the rest by signal. Pass a stable array.
 */
export function useMatchesFor(intents: Intent[]): MatchResult[] {
  const { me, people, others, extras } = useMatchInputs()
  return useMemo(() => {
    const byId = new Map(people.map((u) => [u.id, u]))
    const fit = new Map<string, number>()
    const fitOf = (m: MatchResult) => {
      let f = fit.get(m.userId)
      if (f === undefined) fit.set(m.userId, (f = topicFit(byId.get(m.userId), intents, others)))
      return f
    }
    // matchAll is best-first already, and sort is stable, so equal fits keep that order
    return onWavelength(matchAll(me, intents, people, others, extras)).sort((a, b) => fitOf(b) - fitOf(a))
  }, [me, intents, people, others, extras])
}
