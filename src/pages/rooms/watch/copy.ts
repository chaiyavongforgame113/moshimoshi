// Words the watch-together screens share (read at render time, so the language switch applies).
import { providerName } from '@/data/watch'
import { t } from '@/lib/i18n'
import type { WatchProvider } from '@/lib/types'
import { videoHost } from '@/lib/video'

/** What saying OK means, shown before the app plays and pauses a clip for someone. */
export function consentText(provider: WatchProvider, ref: string): string {
  if (provider === 'youtube')
    return t(
      'วิดีโอจะเล่นและหยุดตามห้อง และ YouTube จะได้รับข้อมูลการดูตามนโยบายของ Google',
      "The video plays and pauses along with the room, and YouTube receives viewing data under Google's policies",
    )
  if (provider === 'vimeo')
    return t(
      'วิดีโอจะเล่นและหยุดตามห้อง และ Vimeo จะได้รับข้อมูลการดูตามนโยบายของ Vimeo',
      "The video plays and pauses along with the room, and Vimeo receives viewing data under Vimeo's policies",
    )
  const host = videoHost(ref)
  return t(`วิดีโอจะเล่นและหยุดตามห้อง โดยโหลดไฟล์มาจาก ${host}`, `The video plays and pauses along with the room, loaded from ${host}`)
}

/** The provider's own terms and privacy pages. */
export function policyLinks(provider: WatchProvider): { href: string; label: string }[] {
  if (provider === 'youtube')
    return [
      { href: 'https://policies.google.com/privacy', label: t('นโยบายความเป็นส่วนตัวของ Google', 'Google Privacy Policy') },
      { href: 'https://www.youtube.com/t/terms', label: t('ข้อกำหนดของ YouTube', 'YouTube Terms of Service') },
    ]
  if (provider === 'vimeo') return [{ href: 'https://vimeo.com/privacy', label: t('นโยบายความเป็นส่วนตัวของ Vimeo', 'Vimeo Privacy Policy') }]
  return []
}

/** "คลิปจาก YouTube" when the clip has no title. */
export const untitled = (provider: WatchProvider) =>
  provider === 'file' ? t('คลิปวิดีโอ', 'A video') : t(`คลิปจาก ${providerName(provider)}`, `A clip from ${providerName(provider)}`)

/** "ดูบน YouTube" for the link back to the clip. */
export const openOn = (provider: WatchProvider) =>
  provider === 'file' ? t('เปิดไฟล์วิดีโอ', 'Open the video file') : t(`ดูบน ${providerName(provider)}`, `Watch on ${providerName(provider)}`)
