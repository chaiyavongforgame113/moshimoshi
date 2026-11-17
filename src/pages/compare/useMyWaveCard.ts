import { useMemo } from 'react'
import { compareLink } from '@/data/compare'
import { useMyWaveAnswers } from '@/data/hooks'
import { displayName } from '@/lib/i18n'
import { useMoshi } from '@/lib/store'
import { answeredCount } from '@/lib/waveQuiz'
import { cardInterests, cardLifeStages, myWave, type MyWave, type WaveCardContent } from '@/lib/waveCard'
import type { User, WaveAnswers } from '@/lib/types'

/** Someone's wave archetype from what this device can see (their profile + their "จูนคลื่น" picks). */
export function useWaveOf(user: Pick<User, 'id' | 'tags' | 'loves' | 'lifeStages'> | undefined, wave: WaveAnswers | undefined): MyWave | undefined {
  return useMemo(
    () => (user ? myWave({ id: user.id, tags: user.tags, loves: user.loves, lifeStages: user.lifeStages, wave }) : undefined),
    [user, wave],
  )
}

export interface MyWaveCard {
  me: User
  wave: MyWave
  /** how many "จูนคลื่น" questions I've answered (few: the card nudges me to play) */
  answered: number
  /** everything the image needs except the mochi's SVG (that comes from the rendered <Avatar>) */
  content: Omit<WaveCardContent, 'mochiSvg'>
}

/** My own card: archetype, top interests, life stage and the link it carries. */
export function useMyWaveCard(): MyWaveCard {
  const me = useMoshi((s) => s.me)
  const answers = useMyWaveAnswers()
  const wave = useWaveOf(me, answers)!
  return useMemo(
    () => ({
      me,
      wave,
      answered: answeredCount(answers),
      content: {
        name: displayName(me.name),
        color: me.color,
        wave,
        interests: cardInterests(me),
        lifeStages: cardLifeStages(me.lifeStages),
        link: compareLink(me.id),
      },
    }),
    [me, wave, answers],
  )
}
