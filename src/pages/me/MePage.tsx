import { Pencil } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { KineticText, Reveal } from '@/components/motion'
import { IconButton, PageHeader } from '@/components/ui'
import { useDataMode, useDataReady, useServerFeatures } from '@/data/hooks'
import { t } from '@/lib/i18n'
import { WaveCardEntry } from '@/pages/compare/WaveCardEntry'
import { PageSkeleton } from '@/pages/people/Skeleton'
import { Account } from './Account'
import { EditSheets, type EditKind } from './EditSheets'
import { MeHero } from './MeHero'
import { MyIntents, MyPrompts, MyRooms, MyTags } from './MySections'
import { Settings } from './Settings'
import { EDIT_KINDS } from './wave'
import { WaveClarity } from './WaveClarity'

const isEditKind = (v: string | null): v is EditKind => EDIT_KINDS.includes(v as EditKind)

export default function MePage() {
  // which edit sheet is open, and at which question; ?edit=tags&step=1 (from home or the People tab) opens one
  const [params, setParams] = useSearchParams()
  const [edit, setEdit] = useState<{ kind: EditKind; step: number } | null>(null)
  // open the linked sheet, then drop the link so Back or a reload doesn't open it again
  useEffect(() => {
    const kind = params.get('edit')
    if (kind === null) return
    if (isEditKind(kind)) setEdit({ kind, step: Math.max(0, Number(params.get('step')) || 0) })
    setParams(
      (p) => {
        p.delete('edit')
        p.delete('step')
        return p
      },
      { replace: true },
    )
  }, [params, setParams])
  const open = useCallback((kind: EditKind, step = 0) => setEdit({ kind, step }), [])
  const closeEdit = useCallback(() => setEdit(null), [])
  const live = useDataMode() === 'live'
  // a shared card's link opens signed out only once wave_card_preview is on the server
  const waveCards = useServerFeatures().waveCard
  const ready = useDataReady()
  if (!ready) return <PageSkeleton label={t('กำลังโหลดโปรไฟล์ของเรา…', 'Loading your profile…')} />
  return (
    <div>
      <PageHeader
        title={<KineticText text={t('โปรไฟล์ของเรา', 'My profile')} />}
        subtitle={t('เพื่อนๆ จะเห็นหน้าของเราแบบนี้', 'This is how friends see you')}
        action={
          <IconButton label={t('แก้ไขโปรไฟล์', 'Edit profile')} onClick={() => open('basics')}>
            <Pencil size={18} />
          </IconButton>
        }
      />
      <MeHero onEdit={open} />
      <Reveal>
        <WaveClarity onEdit={open} />
      </Reveal>
      {/* "บัตรคลื่นของฉัน": my wave archetype, shared as an image + a link friends open to compare waves */}
      {waveCards && (
        <Reveal>
          <WaveCardEntry />
        </Reveal>
      )}
      <Reveal>
        <MyTags onEdit={() => open('tags')} />
      </Reveal>
      <Reveal>
        <MyPrompts onEdit={() => open('stories')} />
      </Reveal>
      <Reveal>
        <MyIntents />
      </Reveal>
      <Reveal>
        <MyRooms />
      </Reveal>
      <Reveal>
        <Settings />
      </Reveal>
      {live && (
        <Reveal>
          <Account />
        </Reveal>
      )}
      <EditSheets open={edit?.kind ?? null} step={edit?.step} onClose={closeEdit} />
    </div>
  )
}
