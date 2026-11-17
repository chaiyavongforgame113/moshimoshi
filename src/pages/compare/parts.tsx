import { motion, useReducedMotion } from 'motion/react'
import { useId } from 'react'
import { Link } from 'react-router'
import { Avatar } from '@/components/ui'
import { MOCHI, SIGNAL_GRADIENT } from '@/lib/colors'
import { ease } from '@/lib/motion'
import type { SignalLevel, User } from '@/lib/types'
import type { WaveArchetype } from '@/lib/waveCard'

/** A soft wave drawn between two mochis (decorative); warmer the stronger the signal. */
export function WaveLine({ level = 3, className = '' }: { level?: SignalLevel; className?: string }) {
  const reduce = useReducedMotion()
  const id = `w${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <svg viewBox="0 0 120 40" className={className} aria-hidden preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={SIGNAL_GRADIENT[0]} />
          <stop offset="1" stopColor={SIGNAL_GRADIENT[level - 1]} />
        </linearGradient>
      </defs>
      <motion.path
        d="M4 20 Q16 6 28 20 T52 20 T76 20 T100 20 T116 20"
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="4"
        strokeLinecap="round"
        initial={reduce ? false : { pathLength: 0, opacity: 0.4 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.1, ease: ease.out }}
      />
    </svg>
  )
}

/** One side of a comparison: the mochi, the name (a link to their profile when given) and their wave. */
export function Side({ user, name, archetype, to }: { user: Pick<User, 'color' | 'face'>; name: string; archetype?: WaveArchetype; to?: string }) {
  const tone = archetype ? MOCHI[archetype.tone] : undefined
  const label = <span className="block max-w-full truncate font-display text-base font-semibold text-ink sm:text-lg">{name}</span>
  return (
    <div className="flex w-24 min-w-0 shrink-0 flex-col items-center text-center sm:w-40">
      <span className="motion-safe:animate-float">
        <span className="block sm:hidden">
          <Avatar color={user.color} face={user.face ?? 'happy'} size={84} />
        </span>
        <span className="hidden sm:block">
          <Avatar color={user.color} face={user.face ?? 'happy'} size={108} />
        </span>
      </span>
      <span className="mt-1 block w-full min-w-0">
        {to ? (
          <Link to={to} className="block rounded-full underline-offset-4 hover:underline">
            {label}
          </Link>
        ) : (
          label
        )}
      </span>
      {archetype && tone && (
        <span
          className="mt-1 line-clamp-2 rounded-2xl px-2 py-0.5 text-[11px] leading-tight font-semibold break-words sm:text-xs"
          style={{ background: tone.light, color: tone.ink }}
        >
          {archetype.emoji} {archetype.title}
        </span>
      )}
    </div>
  )
}
