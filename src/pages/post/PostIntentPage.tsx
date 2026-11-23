import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Pencil, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { KineticText } from '@/components/motion'
import { MochiStage, View3D } from '@/components/three'
import { Button, PageHeader, Sheet, Wizard, Zone, type WizardStep } from '@/components/ui'
import { useMyIntent, useRoom, useRooms } from '@/data/hooks'
import { getLang, t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import { useMoshi } from '@/lib/store'
import type { Intent, IntentTemplate } from '@/lib/types'
import { IntentCard } from './IntentCard'
import { MAX_ACTIVE, MyIntents } from './MyIntents'
import { PostSuccess } from './PostSuccess'
import { TagPicker } from './TagPicker'
import { draftFromIntent, initialDraft, suggestedText, toIntent, validate, withTemplate, type Draft } from './draft'
import { LangPick, NotePick, TemplatePick, WhenPick } from './steps'
import { TEMPLATE_BY_KEY } from './templates'

/**
 * Switching language remounts the page (see Root in app/router), which would throw away the
 * answers so far. The wizard keeps a copy here and picks it up on mount; leaving the page any
 * other way clears it (same as onboarding).
 */
let snapshot: { draft: Draft; step: number; tried: string | null; loadedFor: string | null; posted: Intent | null } | null = null

/** Invite composer, one question at a time: what · topic · when · a line · preview. ?edit=<id> edits one of mine. */
export default function PostIntentPage() {
  const me = useMoshi((s) => s.me)
  const activeCount = useMoshi((s) => s.myIntents.length)
  const postIntent = useMoshi((s) => s.postIntent)
  const updateIntent = useMoshi((s) => s.updateIntent)
  const notify = useMoshi((s) => s.notify)
  const reduce = useReducedMotion()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const editing = useMyIntent(params.get('edit') ?? undefined)
  // started from a room → the post lands in that room
  const rooms = useRooms()
  const roomId = useRoom(params.get('room') ?? undefined)?.id

  const [draft, setDraft] = useState<Draft>(() => snapshot?.draft ?? initialDraft(me.province))
  const [step, setStep] = useState(() => snapshot?.step ?? 0)
  // the step whose Next was pressed while it wasn't answered yet: its message shows from then on
  const [tried, setTried] = useState<string | null>(() => snapshot?.tried ?? null)
  const [askingStop, setAskingStop] = useState(false)
  const [posted, setPosted] = useState<Intent | null>(() => snapshot?.posted ?? null)
  // live: a post the server turned down is rolled back (with a toast): back to the kept draft
  const stillThere = useMyIntent(posted?.id)
  useEffect(() => {
    if (posted && !stillThere) setPosted(null)
  }, [posted, stillThere])
  const patch = useCallback((p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p })), [])

  // ?edit=<id>: that post fills every step (once per post)
  const [loadedFor, setLoadedFor] = useState<string | null>(() => snapshot?.loadedFor ?? null)

  // keep the copy current; drop it on unmount unless a language switch caused the unmount
  useEffect(() => {
    snapshot = { draft, step, tried, loadedFor, posted }
  }, [draft, step, tried, loadedFor, posted])
  useEffect(() => {
    const lang = getLang()
    return () => {
      if (getLang() === lang) snapshot = null
    }
  }, [])
  if (editing && loadedFor !== editing.id) {
    setLoadedFor(editing.id)
    setDraft(draftFromIntent(editing, me.province))
    setStep(0)
    setTried(null)
    setPosted(null)
  }
  if (!editing && loadedFor) {
    setLoadedFor(null)
    setDraft(initialDraft(me.province))
    setStep(0)
    setTried(null)
  }

  const errors = validate(draft)
  const suggested = suggestedText(draft)
  const intent = useMemo(() => toIntent({ ...draft, roomId: roomId ?? draft.roomId }, rooms), [draft, roomId, rooms])
  const tpl = draft.template ? TEMPLATE_BY_KEY[draft.template] : undefined
  const lang = draft.template === 'lang'

  const pickTemplate = (k: IntentTemplate) => {
    setDraft((d) => withTemplate(d, k))
    setStep(1)
  }

  const stopEditing = () => {
    setAskingStop(false)
    navigate('/app/people?tab=invites', { replace: true })
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }
  // leaving an edit with changes asks first
  const askStop = () => {
    if (!editing) return
    const changed = JSON.stringify(draft) !== JSON.stringify(draftFromIntent(editing, me.province))
    if (changed) setAskingStop(true)
    else stopEditing()
  }

  const show = (key: string, error?: string) => (tried === key ? error : undefined)
  const steps: WizardStep[] = [
    {
      key: 'what',
      title: t('อยากชวนเพื่อนทำอะไร?', 'What do you want to do?'),
      hint: t('แตะการ์ดเดียวพอ เดี๋ยวโมชิตั้งค่าที่เหลือให้', 'Tap a card and Mochi sets up the rest'),
      valid: !!draft.template,
      content: <TemplatePick value={draft.template} onPick={pickTemplate} />,
    },
    {
      key: 'topic',
      title: lang ? t('อยากฝึกภาษาอะไร?', 'Which language?') : t('เรื่องอะไรดี?', 'What about?'),
      hint: lang
        ? t('บอกด้วยว่าเราช่วยสอนภาษาอะไรได้ จะได้แลกกัน', 'Add one you can help with too, so you can swap')
        : t('เรื่องที่เราชอบอยู่ข้างบนแล้ว แตะทีเดียวได้เลย', 'Your favorite things are up top. One tap does it'),
      valid: !errors.tag,
      error: show('topic', errors.tag),
      content: lang ? (
        <LangPick draft={draft} patch={patch} />
      ) : (
        <TagPicker value={draft.tagId} onChange={(tagId) => patch({ tagId })} suggestions={tpl?.tags ?? []} />
      ),
    },
    {
      key: 'when',
      title: t('เมื่อไหร่ดี?', 'When?'),
      hint: t('บอกคร่าวๆ ก็พอ ไม่ต้องเป๊ะ', 'Roughly is fine'),
      valid: !errors.date,
      error: show('when', errors.date),
      content: <WhenPick draft={draft} patch={patch} />,
    },
    {
      key: 'note',
      title: t('อยากบอกอะไรเพิ่มไหม?', 'Anything to add?'),
      hint: editing
        ? t('แก้ข้อความให้เป็นสไตล์เราได้เลย', 'Change the wording however you like')
        : t('แก้ให้เป็นสไตล์เราได้ หรือข้ามไปใช้ของโมชิก็ได้', "Make it yours, or skip and keep Mochi's"),
      // editing: the saved line stays unless they change it (no skip that would swap it for Mochi's);
      // skipping only drops the typed line, "เปิดตี้ไว้แล้ว" is a separate answer and stays
      optional: !editing,
      onSkip: () => patch({ text: '', textTouched: false }),
      valid: !errors.text,
      error: show('note', errors.text),
      content: <NotePick draft={draft} patch={patch} suggested={suggested} />,
    },
    {
      key: 'preview',
      title: editing ? t('โพสต์ใหม่หน้าตาแบบนี้', "Here's the updated invite") : t('หน้าตาโพสต์เป็นแบบนี้', "Here's your invite"),
      hint: editing
        ? t('กดอัปเดต เพื่อนๆ จะเห็นเวอร์ชันใหม่ทันที', 'Tap update and everyone sees the new version right away')
        : t('เพื่อนๆ จะเห็นแบบนี้ ถ้าโอเคก็โพสต์ได้เลย', 'This is what everyone sees. Happy with it? Post away'),
      content: (
        <div className="flex flex-col gap-3">
          <IntentCard intent={intent} me={me} className="shadow-[var(--shadow-lift)]" />
          {!editing && activeCount >= MAX_ACTIVE && (
            <p className="rounded-2xl bg-butter/40 p-3 text-sm text-ink">
              {t(`มีครบ ${MAX_ACTIVE} โพสต์แล้ว โพสต์ใหม่จะแทนที่อันที่เก่าที่สุดนะ`, `You already have ${MAX_ACTIVE} invites. A new one replaces your oldest`)}
            </p>
          )}
        </div>
      ),
    },
  ]
  const at = Math.min(step, steps.length - 1)
  const cur = steps[at]

  const submit = () => {
    const bad = !draft.template ? 'what' : errors.tag ? 'topic' : errors.date ? 'when' : errors.text ? 'note' : null
    if (bad) {
      setTried(bad)
      setStep(steps.findIndex((s) => s.key === bad))
      return
    }
    if (editing) {
      updateIntent(editing.id, intent)
      notify(t('อัปเดตโพสต์แล้ว เพื่อนๆ จะเห็นเวอร์ชันใหม่นะ', 'Invite updated. Everyone sees the new version'))
      stopEditing()
      return
    }
    setPosted(postIntent(intent))
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }

  const again = () => {
    setPosted(null)
    setDraft(initialDraft(me.province))
    setStep(0)
    setTried(null)
    window.scrollTo({ top: 0 })
  }

  // a Next pressed on an unanswered step (the wizard marks it aria-disabled), or Enter in a field there
  const blocked = cur.valid === false
  const onClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    if (blocked && e.target instanceof Element && e.target.closest('button[aria-disabled="true"]')) setTried(cur.key)
  }
  const onKeyDownCapture = (e: KeyboardEvent<HTMLDivElement>) => {
    if (blocked && e.key === 'Enter' && e.target instanceof HTMLInputElement && !e.nativeEvent.isComposing) setTried(cur.key)
  }

  const cheers = [
    t('ชวนเพื่อนมาเล่นด้วยกัน ไม่ถึงนาทีก็เสร็จ', 'Invite friends to play. Done in under a minute'),
    t('เดี๋ยวโมชิหาคนที่ชอบเรื่องเดียวกันให้นะ', 'Mochi will find people who love it too'),
    t('ตอนไหนก็ได้ที่เราสะดวก', 'Whenever suits you'),
    t('โมชิช่วยเขียนให้แล้วนะ', 'Mochi wrote you a line'),
    t('น่ารักมาก! พร้อมส่งแล้ว', 'Looking great! Ready to send'),
  ]

  return (
    <>
      <PageHeader
        back={editing ? undefined : '/app/people?tab=invites'}
        title={<KineticText key={editing ? 'edit' : 'new'} text={editing ? t('แก้โพสต์ชวนเล่น', 'Edit your invite') : t('ชวนเล่น', 'Invite to play')} />}
        subtitle={editing ? t('แก้ได้ทุกข้อ แล้วกดอัปเดต', 'Change anything, then update') : t('ชวนคนที่ชอบเรื่องเดียวกันมาเล่นด้วยกัน', 'Invite people who love the same things')}
      />

      <AnimatePresence mode="wait" initial={false}>
        {posted ? (
          <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <PostSuccess intent={posted} onAgain={again} />
          </motion.div>
        ) : (
          <motion.div key="compose" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -8 }} transition={spring.soft}>
            {/* Mochi cheers along; the 3D box has no background on top of it */}
            <div className="flex items-center gap-2 sm:gap-3">
              <View3D className="size-20 shrink-0 sm:size-24" label={t('น้องโมชิช่วยชวนเพื่อน', 'Little Mochi helping with your invite')}>
                <MochiStage color={tpl?.color ?? 'peach'} expression={at === steps.length - 1 ? 'happy' : 'talk'} zoom={0.85} />
              </View3D>
              <div className="relative min-w-0 flex-1 rounded-3xl rounded-bl-md bg-white px-4 py-2.5 shadow-[var(--shadow-soft)]">
                <span aria-hidden className="absolute bottom-3 -left-2 size-4 rotate-45 rounded-[4px] bg-white" />
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={at}
                    initial={reduce ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
                    transition={{ duration: 0.18 }}
                    className="relative font-display leading-snug font-semibold text-ink"
                  >
                    {cheers[at]}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>

            {editing && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-3xl border-2 border-lavender bg-lavender/20 p-2 pl-4" role="status">
                <Pencil size={17} aria-hidden className="shrink-0 text-ink" />
                <p className="min-w-0 flex-[1_1_12rem] truncate text-sm text-ink">
                  <b className="font-display font-semibold">{t('กำลังแก้: ', 'Editing: ')}</b>“{editing.text}”
                </p>
                <Button size="sm" variant="ghost" icon={<X size={16} aria-hidden />} onClick={askStop}>
                  {t('เลิกแก้', 'Stop editing')}
                </Button>
              </div>
            )}

            <Zone tone={tpl?.color ?? 'peach'} className="mt-3">
              <div onClickCapture={onClickCapture} onKeyDownCapture={onKeyDownCapture}>
                <Wizard
                  steps={steps}
                  step={at}
                  onStep={setStep}
                  onFinish={submit}
                  finishLabel={editing ? t('อัปเดตโพสต์', 'Update post') : t('โพสต์เลย', 'Post it')}
                  onCancel={editing ? askStop : undefined}
                />
              </div>
            </Zone>

            {at === 0 && <MyIntents editingId={editing?.id} />}
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={askingStop} onClose={() => setAskingStop(false)} title={t('เลิกแก้โพสต์นี้ไหม?', 'Stop editing this invite?')}>
        <p className="text-ink-soft">{t('ที่แก้ไว้จะไม่ถูกบันทึก โพสต์เดิมยังอยู่เหมือนเดิมนะ', "Your changes won't be saved. The original stays as it was")}</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <Button block onClick={() => setAskingStop(false)}>
            {t('แก้ต่อ', 'Keep editing')}
          </Button>
          <Button block variant="secondary" onClick={stopEditing}>
            {t('เลิกแก้', 'Stop editing')}
          </Button>
        </div>
      </Sheet>
    </>
  )
}
