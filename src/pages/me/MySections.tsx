import { AnimatePresence, motion } from 'motion/react'
import { Clock3, DoorOpen, Heart, PartyPopper, Pencil, Plus, Quote, Star, Trash2, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Button, ButtonLink, Chip, IconButton, RoomIcon, Section, ShowMore, TagChip, zoneAction } from '@/components/ui'
import { useCatalog } from '@/data/catalog'
import { useRooms } from '@/data/hooks'
import { promptKey, promptLabel, tagOf } from '@/data/tags'
import { MOCHI } from '@/lib/colors'
import { known, t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import { useMoshi } from '@/lib/store'
import type { Intent } from '@/lib/types'
import { TEMPLATE_LABEL, WHEN_LABEL } from '@/pages/people/lib'
import { ReactedBadge } from '@/pages/rooms/bits'

/** each section shows this many, then "ดูเพิ่ม" */
const FIRST = 3

/** "แก้" in a zone's title band; the screen-reader name says what it edits */
const EditLink = ({ onClick, label, what }: { onClick: () => void; label: string; what: string }) => (
  <button type="button" onClick={onClick} aria-label={what} className={zoneAction}>
    <Pencil size={14} aria-hidden /> {label}
  </button>
)

/** An empty section: one line, and the one thing to do about it (a secondary button: the page's main one is in "คลื่นชัดขึ้น"). */
function Empty({ text, children }: { text: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-3xl border-2 border-dashed border-line bg-white/50 p-4 sm:flex-row sm:items-center sm:p-5">
      <p className="min-w-0 flex-1 text-ink-soft">{text}</p>
      {children}
    </div>
  )
}

export function MyTags({ onEdit }: { onEdit: () => void }) {
  const me = useMoshi((s) => s.me)
  const loves = me.tags.filter((id) => me.loves.includes(id))
  // starred first, so the first few are the ones I love most
  const ordered = [...loves, ...me.tags.filter((id) => !me.loves.includes(id))].filter((id) => !!tagOf(id))
  return (
    <Section
      tone="pink"
      icon={<Heart size={18} strokeWidth={2.4} />}
      title={t('เรื่องที่ชอบ', 'My interests')}
      action={ordered.length > 0 && <EditLink onClick={onEdit} label={t('แก้', 'Edit')} what={t('แก้เรื่องที่ชอบ', 'Edit my interests')} />}
    >
      {ordered.length ? (
        <>
          <ShowMore
            items={ordered}
            initial={FIRST}
            getKey={(id) => id}
            listClassName="flex flex-wrap gap-2"
            itemClassName="relative max-w-full"
            render={(id) => {
              const tag = tagOf(id)
              if (!tag) return null
              return (
                <>
                  <TagChip tag={tag} />
                  {me.loves.includes(id) && (
                    <span className="absolute -top-1.5 -right-1 flex size-5 items-center justify-center rounded-full bg-butter ring-2 ring-cream">
                      <Star size={11} strokeWidth={2.6} className="fill-white" aria-label={t('รักมาก', 'Love it')} />
                    </span>
                  )}
                </>
              )
            }}
          />
          {loves.length > 0 && (
            <p className="mt-2 text-xs text-ink-soft">
              {t('ติดดาว = รักมาก ช่วยให้เจอคนคลื่นเดียวกันได้แม่นขึ้น', 'Star = love it. Helps us find people on your wavelength more accurately')}
            </p>
          )}
        </>
      ) : (
        <Empty text={t('ยังไม่ได้เลือกเรื่องที่ชอบเลย เลือกสัก 3 เรื่อง แล้วคนที่ชอบเหมือนกันจะเจอเราง่ายขึ้น', "No interests yet. Pick 3, and people who like the same things will find you more easily")}>
          <Button variant="secondary" icon={<Heart size={17} strokeWidth={2.4} aria-hidden />} onClick={onEdit}>
            {t('เลือกเรื่องที่ชอบ', 'Pick interests')}
          </Button>
        </Empty>
      )}
    </Section>
  )
}

/** who reacted to one story (own keys only: storySames is filled from rows other people wrote) */
const reactedTo = (map: Record<string, string[]>, key: string) => (Object.hasOwn(map, key) ? map[key] : undefined)

export function MyPrompts({ onEdit }: { onEdit: () => void }) {
  const me = useMoshi((s) => s.me)
  const storySames = useCatalog((s) => s.storySames)
  const p = MOCHI[me.color]
  const stories = me.prompts.filter((pa) => pa.text.trim() && promptLabel(pa))
  return (
    <Section
      tone="butter"
      icon={<Quote size={18} strokeWidth={2.4} />}
      title={t('เรื่องเล่าของเรา', 'My stories')}
      action={stories.length > 0 && <EditLink onClick={onEdit} label={t('แก้', 'Edit')} what={t('แก้เรื่องเล่า', 'Edit my stories')} />}
    >
      {stories.length ? (
        <ShowMore
          items={stories}
          initial={FIRST}
          getKey={(pa, i) => `${pa.promptId}-${i}`}
          listClassName="grid gap-3 sm:grid-cols-2"
          itemClassName="overflow-hidden rounded-3xl border border-white shadow-[var(--shadow-soft)]"
          render={(pa) => (
            <div style={{ background: `linear-gradient(150deg, ${p.light} 0%, white 80%)` }} className="relative h-full p-5">
              <Quote size={44} strokeWidth={1.6} aria-hidden className="absolute -top-1 right-3 text-ink opacity-10" />
              <p className="relative text-sm font-semibold text-ink-soft">{promptLabel(pa)}</p>
              <p className="relative mt-1.5 font-display text-lg leading-normal wrap-break-word text-ink">“{pa.text}”</p>
              <ReactedBadge ids={reactedTo(storySames, promptKey(pa))} className="relative mt-3" />
            </div>
          )}
        />
      ) : (
        <Empty text={t('ยังไม่มีเรื่องเล่า ตอบคำถามสั้นๆ สักข้อ เพื่อนจะมีเรื่องเริ่มทักแชทง่ายขึ้น', 'No stories yet. Answer a quick question, so friends have something easy to say hi about')}>
          <Button variant="secondary" icon={<Quote size={17} strokeWidth={2.4} aria-hidden />} onClick={onEdit}>
            {t('เล่าเรื่องของเรา', 'Share a story')}
          </Button>
        </Empty>
      )}
    </Section>
  )
}

/** My open invites ("ชวนเล่น"). The database keeps at most 3, so the list never needs "ดูเพิ่ม". */
export function MyIntents() {
  const intents = useMoshi((s) => s.myIntents)
  // after deleting one, the focus goes to "ชวนเพิ่ม" (or the empty state's button) instead of getting lost
  const box = useRef<HTMLDivElement>(null)
  const refocus = useRef(false)
  useEffect(() => {
    if (!refocus.current) return
    refocus.current = false
    box.current?.querySelector<HTMLElement>('[data-after-delete]')?.focus()
  }, [intents.length])

  return (
    <div ref={box}>
      <Section
        tone="mint"
        icon={<PartyPopper size={18} strokeWidth={2.4} />}
        title={t('ชวนเล่นของเรา', 'My invites')}
        action={
          intents.length > 0 && intents.length < 3 ? (
            <Link to="/app/post" data-after-delete className={zoneAction}>
              <Plus size={15} strokeWidth={2.6} aria-hidden /> {t('ชวนเพิ่ม', 'New invite')}
            </Link>
          ) : undefined
        }
      >
        {intents.length === 0 ? (
          <Empty
            text={t(
              'ยังไม่มีชวนเล่น ชวนเพื่อนมาทำอะไรด้วยกันสักอย่าง คนที่ชอบเรื่องเดียวกันจะได้กด "ฉันด้วย" ง่ายๆ',
              'No invites yet. Invite people to do something together, so anyone into the same thing can tap "Me too"',
            )}
          >
            <ButtonLink variant="secondary" to="/app/post" data-after-delete icon={<Plus size={18} strokeWidth={2.6} aria-hidden />}>
              {t('ชวนเล่น', 'Start an invite')}
            </ButtonLink>
          </Empty>
        ) : (
          <ul className="grid gap-3">
            <AnimatePresence initial={false}>
              {intents.map((i) => (
                <InviteCard key={i.id} intent={i} onRemoved={() => (refocus.current = true)} />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </Section>
    </div>
  )
}

/** One invite: edit it on the post page, or delete it after a quick "แน่ใจไหม". */
function InviteCard({ intent, onRemoved }: { intent: Intent; onRemoved: () => void }) {
  const remove = useMoshi((s) => s.removeIntent)
  const tag = tagOf(intent.tagId)
  const [asking, setAsking] = useState(false)
  const ids = useId()
  const keep = useRef<HTMLButtonElement>(null)
  // the question takes the focus to its safe answer; "ยังก่อน" gives it back to the delete button
  const focusTo = useRef<'keep' | 'delete' | null>(null)
  useEffect(() => {
    const to = focusTo.current
    focusTo.current = null
    if (to === 'keep') keep.current?.focus()
    else if (to === 'delete') document.getElementById(`${ids}-delete`)?.focus()
  }, [asking, ids])
  const ask = (on: boolean) => {
    focusTo.current = on ? 'keep' : 'delete'
    setAsking(on)
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
      transition={spring.soft}
      className="card rounded-3xl p-4"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1.5">
            <Chip size="sm" color="butter">
              {TEMPLATE_LABEL[intent.template]}
            </Chip>
            {tag && <TagChip tag={tag} size="sm" />}
            <Chip size="sm" icon={<Clock3 size={12} aria-hidden />}>
              {known(intent.whenLabel) ?? WHEN_LABEL[intent.when]}
            </Chip>
          </div>
          <p className="mt-2 font-display text-lg leading-normal wrap-break-word">{intent.text}</p>
          <ReactedBadge kind="metoo" ids={intent.joinedBy} className="mt-2" />
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <Link
            to={`/app/post?edit=${intent.id}`}
            aria-label={t(`แก้ไขชวนเล่น "${intent.text}"`, `Edit invite "${intent.text}"`)}
            title={t('แก้ไข', 'Edit')}
            className="inline-flex size-11 items-center justify-center rounded-full bg-cream-3/70 text-ink hover:bg-cream-3"
          >
            <Pencil size={17} aria-hidden />
          </Link>
          <IconButton
            id={`${ids}-delete`}
            label={t(`ลบชวนเล่น "${intent.text}"`, `Delete invite "${intent.text}"`)}
            variant="soft"
            aria-expanded={asking}
            aria-controls={asking ? `${ids}-ask` : undefined}
            onClick={() => ask(!asking)}
          >
            <X size={18} aria-hidden />
          </IconButton>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {asking && (
          <motion.div
            key="ask"
            id={`${ids}-ask`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={spring.soft}
            className="overflow-hidden"
          >
            <div role="group" aria-labelledby={`${ids}-q`} className="mt-3 rounded-2xl bg-coral/15 p-3">
              <p id={`${ids}-q`} className="font-display font-semibold text-ink">
                {t('ลบชวนเล่นนี้ไหม?', 'Delete this invite?')}
              </p>
              <p id={`${ids}-what`} className="text-sm text-ink-soft">
                {t('ลบแล้วจะหายไปเลย คนที่กด "ฉันด้วย" ไว้ก็จะไม่เห็นอีก', `It'll be gone for good, and people who tapped "Me too" won't see it anymore`)}
              </p>
              <div className="mt-2.5 flex flex-wrap-reverse justify-end gap-2">
                <Button ref={keep} variant="ghost" size="sm" aria-describedby={`${ids}-q ${ids}-what`} onClick={() => ask(false)}>
                  {t('ยังก่อน', 'Keep it')}
                </Button>
                <Button
                  variant="dark"
                  size="sm"
                  icon={<Trash2 size={15} aria-hidden />}
                  onClick={() => {
                    onRemoved()
                    remove(intent.id)
                  }}
                >
                  {t('ลบเลย', 'Delete')}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  )
}

export function MyRooms() {
  const rooms = useMoshi((s) => s.me.rooms)
  const allRooms = useRooms()
  const list = rooms.flatMap((id) => allRooms.find((r) => r.id === id) ?? [])
  return (
    <Section
      tone="sky"
      icon={<DoorOpen size={18} strokeWidth={2.4} />}
      title={t('ห้องของเรา', 'My rooms')}
      action={
        list.length > 0 ? (
          <Link to="/app/rooms" className={zoneAction}>
            {t('หาห้องใหม่', 'Find a new room')}
          </Link>
        ) : undefined
      }
    >
      {list.length ? (
        <ShowMore
          items={list}
          initial={FIRST}
          getKey={(room) => room.id}
          listClassName="flex flex-wrap gap-2"
          itemClassName="max-w-full"
          render={(room) => (
            <Link
              to={`/app/rooms/${room.id}`}
              className="inline-flex h-14 max-w-full items-center gap-2.5 rounded-full bg-white py-1.5 pr-4 pl-1.5 font-display font-semibold shadow-[var(--shadow-soft)] transition-transform hover:-translate-y-0.5 active:scale-95"
            >
              <RoomIcon room={room} size={42} />
              <span className="min-w-0 truncate">{room.name}</span>
            </Link>
          )}
        />
      ) : (
        <Empty text={t('ยังไม่ได้เข้าห้องไหนเลย ลองเข้าห้องที่ชอบดูสิ มีคนรอคุยอยู่', "You haven't joined any rooms yet. Try one you like, people are waiting to chat")}>
          <ButtonLink variant="secondary" to="/app/rooms" icon={<DoorOpen size={18} strokeWidth={2.4} aria-hidden />}>
            {t('หาห้องที่ชอบ', 'Find a room')}
          </ButtonLink>
        </Empty>
      )}
    </Section>
  )
}
