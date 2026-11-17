import { Heart, MessageCircle, MessageCircleHeart, Sparkles, Sprout, Waves } from 'lucide-react'
import { useMemo } from 'react'
import { ButtonLink, Chip, ReasonIcon, ShowMore, SignalMeter, TagChip, Zone } from '@/components/ui'
import { useChats, useMyWaveAnswers, usePersonWaveAnswers, type CompareView } from '@/data/hooks'
import { displayName, t } from '@/lib/i18n'
import { lifeStageEmoji, lifeStageLabel } from '@/lib/lifeStages'
import { signalMeta } from '@/lib/matching'
import { useMoshi } from '@/lib/store'
import type { User } from '@/lib/types'
import { chatToOpen } from '@/pages/chats/lib'
import { Side, WaveLine } from './parts'
import { useWaveOf } from './useMyWaveCard'

/**
 * The comparison (signed in, someone else's card): both mochis and waves, the signal level (bars +
 * words, never a number), why our waves match, interests and "จูนคลื่น" picks in common, shared
 * life stages, and one "ทักแชท" (the usual hello flow, or "ไปที่แชท" when we already talk).
 */
export function CompareResult({ view, person }: { view: CompareView; person: User }) {
  const me = useMoshi((s) => s.me)
  const myAnswers = useMyWaveAnswers()
  const theirAnswers = usePersonWaveAnswers(person.id)
  const mine = useWaveOf(me, myAnswers)
  const theirs = useWaveOf(person, theirAnswers)
  const chat = chatToOpen(useChats(), person.id)
  const name = displayName(person.name)
  const { match, quiz, sharedTags, sharedLifeStages } = view
  const meta = match ? signalMeta(match.level) : undefined
  const reasons = useMemo(() => [...(match?.reasons ?? [])].sort((a, b) => b.weight - a.weight).slice(0, 3), [match])

  return (
    <div className="space-y-5">
      <section aria-labelledby="compare-hero" className="glass relative overflow-hidden rounded-[2rem] px-4 pt-6 pb-5 sm:px-8 sm:pt-8">
        <h2 id="compare-hero" className="sr-only">
          {t(`คลื่นของเรากับ ${name}`, `Your wave and ${name}'s`)}
        </h2>
        <span aria-hidden className="pointer-events-none absolute -top-16 -left-10 size-48 rounded-full bg-butter/40 blur-3xl" />
        <span aria-hidden className="pointer-events-none absolute -right-10 -bottom-16 size-48 rounded-full bg-pink/40 blur-3xl" />
        <div className="relative flex items-start justify-center gap-2 sm:gap-4">
          <Side user={me} name={t('เรา', 'You')} archetype={mine?.archetype} />
          <WaveLine level={match?.level} className="mt-8 h-10 w-12 shrink-0 sm:mt-10 sm:w-28" />
          <Side user={person} name={name} archetype={theirs?.archetype} to={`/app/people/${person.id}`} />
        </div>
        <div className="relative mt-5 flex flex-col items-center gap-1 text-center" aria-live="polite">
          {match && meta ? (
            <>
              <SignalMeter level={match.level} size="lg" />
              <p className="max-w-sm text-sm text-ink-soft">{meta.hint}</p>
            </>
          ) : (
            <p role="status" className="text-sm text-ink-soft">
              {t('กำลังเทียบคลื่น…', 'Comparing waves…')}
            </p>
          )}
        </div>
        <ButtonLink
          to={chat ? `/app/chats/${chat.id}` : `/app/people/${person.id}?send=1`}
          block
          size="lg"
          className="relative mt-5"
          icon={chat ? <MessageCircle size={20} aria-hidden /> : <MessageCircleHeart size={20} aria-hidden />}
          aria-label={chat ? t(`ไปที่แชทกับ ${name}`, `Go to your chat with ${name}`) : t(`ทักแชท ${name}`, `Say hi to ${name}`)}
        >
          {chat ? t('ไปที่แชท', 'Go to chat') : t('ทักแชท', 'Say hi')}
        </ButtonLink>
      </section>

      {reasons.length > 0 && (
        <Zone tone="lavender" icon={<Sparkles size={18} />} title={t('ทำไมคลื่นเราตรงกัน', 'Why your waves match')}>
          <ul className="space-y-2.5">
            {reasons.map((r) => (
              <li key={`${r.kind}:${r.text}`} className="flex items-start gap-2.5 text-[15px] text-ink">
                <ReasonIcon kind={r.kind} />
                <span className="min-w-0 break-words">{r.text}</span>
              </li>
            ))}
          </ul>
        </Zone>
      )}

      {sharedTags.length > 0 && (
        <Zone
          tone="pink"
          icon={<Heart size={18} />}
          title={t('เรื่องที่ชอบเหมือนกัน', 'Interests you share')}
          note={t(`${sharedTags.length} อย่าง`, `${sharedTags.length} in common`)}
        >
          <ShowMore
            items={sharedTags}
            initial={8}
            getKey={(s) => s.tag.id}
            render={(s) => <TagChip tag={s.tag} rare={s.rare} />}
            listClassName="flex flex-wrap gap-2"
            moreLabel={(n) => t(`ดูอีก ${n} อย่าง`, `Show ${n} more`)}
          />
        </Zone>
      )}

      <QuizZone quiz={quiz} name={name} />

      {sharedLifeStages.length > 0 && (
        <Zone
          tone="mint"
          icon={<Sprout size={18} />}
          title={t('ช่วงชีวิตเดียวกัน', 'Same stage of life')}
          note={t('กำลังเจอเรื่องคล้ายๆ กัน คุยกันเข้าใจง่ายแน่', "You're going through similar things, so you'll get each other")}
        >
          <ul className="flex flex-wrap gap-2">
            {sharedLifeStages.map((v) => (
              <li key={v} className="max-w-full">
                <Chip color="mint" size="lg" icon={<span aria-hidden>{lifeStageEmoji(v)}</span>}>
                  {lifeStageLabel(v)}
                </Chip>
              </li>
            ))}
          </ul>
        </Zone>
      )}
    </div>
  )
}

function QuizZone({ quiz, name }: { quiz: CompareView['quiz']; name: string }) {
  const { same, common, agreed, mine, theirs } = quiz
  const icon = <Waves size={18} />
  if (!mine)
    return (
      <Zone tone="butter" icon={icon} title={t('จูนคลื่น', 'Wave tuning')}>
        <p className="text-[15px] text-ink">
          {t(`เล่นจูนคลื่นแบบนี้หรือแบบนั้น 8 ข้อ แล้วมาดูว่าตอบตรงกับ ${name} กี่ข้อ`, `Play 8 quick this-or-that picks, then see how many match ${name}'s`)}
        </p>
        <ButtonLink to="/app/tune" variant="soft" className="mt-3">
          {t('ไปจูนคลื่น', 'Tune your wave')}
        </ButtonLink>
      </Zone>
    )
  if (!theirs)
    return (
      <Zone tone="butter" icon={icon} title={t('จูนคลื่น', 'Wave tuning')}>
        <p className="text-[15px] text-ink">
          {t(`${name} ยังไม่ได้เล่นจูนคลื่น พอเล่นแล้วจะเห็นตรงนี้เลยว่าตอบตรงกันกี่ข้อ`, `${name} hasn't played wave tuning yet. Once they do, you'll see how many picks match right here`)}
        </p>
      </Zone>
    )
  if (!common)
    return (
      <Zone tone="butter" icon={icon} title={t('จูนคลื่น', 'Wave tuning')}>
        <p className="text-[15px] text-ink">
          {t('ยังไม่ได้ตอบข้อเดียวกันเลย ลองเล่นรอบอื่นเพิ่ม แล้วมาดูกันใหม่นะ', "You haven't answered the same questions yet. Play another round and check back")}
        </p>
        <ButtonLink to="/app/tune" variant="soft" className="mt-3">
          {t('ไปจูนคลื่น', 'Tune your wave')}
        </ButtonLink>
      </Zone>
    )
  const dots = common <= 16
  return (
    <Zone
      tone="butter"
      icon={icon}
      title={t(`จูนคลื่นตรงกัน ${same}/${common}`, `Tuned alike: ${same}/${common}`)}
      note={same ? t('ข้อที่เลือกเหมือนกันทั้งคู่', 'Picks you both made') : undefined}
    >
      {dots && (
        <p className="mb-3 flex flex-wrap gap-1.5" role="img" aria-label={t(`ตอบตรงกัน ${same} จาก ${common} ข้อ`, `${same} of ${common} picks match`)}>
          {Array.from({ length: common }, (_, i) => (
            <span key={i} className={`size-3.5 rounded-full ${i < same ? 'bg-coral' : 'bg-ink/10'}`} />
          ))}
        </p>
      )}
      {same > 0 ? (
        <ShowMore
          items={agreed}
          initial={6}
          getKey={(a) => a.question.id}
          render={(a) => <Chip color="butter">{a.choice === 0 ? a.question.a : a.question.b}</Chip>}
          listClassName="flex flex-wrap gap-2"
          moreLabel={(n) => t(`ดูอีก ${n} ข้อ`, `Show ${n} more`)}
        />
      ) : (
        <p className="text-[15px] text-ink">
          {t('ตอบไม่เหมือนกันสักข้อ แบบนี้คุยสนุกแน่ มีเรื่องให้แลกมุมมองเพียบ', 'Not one pick in common, so you’ll have plenty of fun swapping takes')}
        </p>
      )}
    </Zone>
  )
}
