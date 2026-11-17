// "โมชิแนะนำตัว" (Mochi's warm intros): what Mochi says about two people, worked out on the viewer's
// own device from what they can see (the asker never supplies text that shows as Mochi's).
import { useMemo } from 'react'
import { useMatch, usePerson, type IntroState } from '@/data/hooks'
import { known, t, useLang } from '@/lib/i18n'
import { lifeStageEmoji, lifeStageLabel, sharedLifeStages } from '@/lib/lifeStages'
import { useMoshi } from '@/lib/store'
import type { MatchReasonKind, MatchResult, User } from '@/lib/types'

export interface MochiReason {
  key: string
  kind: MatchReasonKind
  text: string
  /** a shared life stage: its emoji, shown in place of the reason icon */
  emoji?: string
}

/**
 * Mochi's 2–3 reasons the waves line up, from the viewer's side: a life stage both share comes
 * first (the strongest sign), then the match's own top reasons.
 */
export function mochiReasons(
  match: MatchResult | undefined,
  mine: readonly string[] | undefined,
  theirs: readonly string[] | undefined,
  max = 3,
): MochiReason[] {
  const out: MochiReason[] = []
  const stage = sharedLifeStages(mine, theirs)[0]
  if (stage) {
    const label = lifeStageLabel(stage)
    out.push({
      key: `stage:${stage}`,
      kind: 'lifeStage',
      text: t(`อยู่ในช่วงชีวิตเดียวกัน: ${label}`, `In the same stage of life: ${label}`),
      emoji: lifeStageEmoji(stage),
    })
  }
  for (const r of match?.reasons ?? []) {
    if (out.length >= max) break
    // matching's own life-stage reason says the same thing: not twice
    if (stage && r.kind === 'lifeStage') continue
    out.push({ key: r.text, kind: r.kind, text: r.text })
  }
  return out
}

/** Mochi's reasons about one person, for me. */
export function useMochiReasons(userId: string | undefined, max = 3): MochiReason[] {
  const match = useMatch(userId)
  const them = usePerson(userId)
  const mine = useMoshi((s) => s.me.lifeStages)
  const lang = useLang()
  return useMemo(() => mochiReasons(match, mine, them?.lifeStages, max), [match, mine, them?.lifeStages, max, lang])
}

/** Whether "ให้โมชิแนะนำให้" shows anything for this state (cards can then drop a less useful button). */
export const introOffered = (state: IntroState): boolean => state === 'ready' || state === 'waiting' || state === 'incoming' || state === 'limit'

/** One short line about where someone is: their first life stage, else their province. */
export function whereLine(user: Pick<User, 'lifeStages' | 'province'>): string {
  const stage = user.lifeStages?.[0]
  return stage ? `${lifeStageEmoji(stage)} ${lifeStageLabel(stage)}` : known(user.province)
}
