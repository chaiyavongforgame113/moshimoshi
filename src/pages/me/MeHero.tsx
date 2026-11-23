import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui'
import { useServerFeatures } from '@/data/hooks'
import { t } from '@/lib/i18n'
import { useMoshi } from '@/lib/store'
import { ProfileHero } from '@/pages/people/profile/ProfileHero'
import { ColorSwatches } from './ColorSwatches'
import type { EditKind } from './EditSheets'

export function MeHero({ onEdit }: { onEdit: (kind: EditKind) => void }) {
  const me = useMoshi((s) => s.me)
  const updateMe = useMoshi((s) => s.updateMe)
  const lifeOn = useServerFeatures().lifeStages

  return (
    <>
      <div className="mt-4">
        <ProfileHero
          user={me}
          owner={{
            editLife: lifeOn ? () => onEdit('life') : undefined,
            avatarControls: (
              <div className="glass relative mx-auto -mt-3 w-fit max-w-full rounded-full px-2 py-0.5">
                <ColorSwatches value={me.color} onChange={(color) => updateMe({ color })} legend={t('เปลี่ยนสีโมชิ', "Change Mochi's color")} size={26} />
              </div>
            ),
          }}
        />
      </div>
      <div className="mt-4">
        <Button variant="secondary" icon={<Pencil size={16} aria-hidden />} onClick={() => onEdit('basics')}>
          {t('แก้ไขชื่อ แนะนำตัว และสี', 'Edit name, intro and color')}
        </Button>
      </div>
    </>
  )
}
