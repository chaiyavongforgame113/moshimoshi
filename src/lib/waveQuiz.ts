// "จูนคลื่น" (this or that) for screens and the matcher: one emoji per side, this week's round,
// how much of it I've answered, and how two people's picks line up.
//
// The questions themselves (ids, both languages, the weekly rotation) live in src/data/wave.ts,
// the one bank the database, the live loader and the demo people share. Add or reword questions
// there; give a new question its two emoji here (a side without one shows a sparkle).
import { nextWaveRoundAt, WAVE_QUESTIONS, WAVE_ROUND_SIZE, waveQuestion, waveRound, waveWeek, type WaveQuestion } from '@/data/wave'
import type { WaveAnswers, WaveChoice } from './types'

export type { WaveQuestion } from '@/data/wave'
export { WAVE_ROUND_SIZE, waveQuestion }

/** Fewer questions in common than this says nothing yet: the wave leaves the quiz out, profiles don't show a score. */
export const QUIZ_MIN_COMMON = 3

/** question id → [side 0, side 1] */
const ICONS: Readonly<Record<string, readonly [string, string]>> = {
  'sea-or-mountain': ['🏖️', '🏔️'],
  'night-or-morning': ['🦉', '🐤'],
  'mobile-or-pc': ['📱', '🖥️'],
  'cat-or-dog': ['🐱', '🐶'],
  'coffee-or-tea': ['☕', '🍵'],
  'home-or-out': ['🛋️', '🎉'],
  'sweet-or-spicy': ['🍰', '🌶️'],
  'stickers-or-long': ['🧸', '📝'],
  'movie-or-series': ['🎬', '📺'],
  'plan-or-flow': ['🗓️', '🎈'],
  'rain-or-sun': ['🌧️', '☀️'],
  'city-or-country': ['🏙️', '🌾'],
  'books-or-podcasts': ['📚', '🎧'],
  'karaoke-or-dance': ['🎤', '🪩'],
  'cook-or-order': ['🍳', '🛵'],
  'hot-or-cool': ['🌞', '🧣'],
  'solo-or-group-trip': ['🎒', '🚐'],
  'sunrise-or-sunset': ['🌅', '🌇'],
  'noodles-or-somtam': ['🍜', '🥗'],
  'anime-or-kdrama': ['🍥', '💕'],
  'early-or-ontime': ['⏰', '🎯'],
  'bubbletea-or-smoothie': ['🧋', '🥤'],
  'horror-or-comedy': ['👻', '😂'],
  'repeat-or-new-songs': ['🔁', '🎶'],
  'camping-or-hotel': ['⛺', '🏨'],
  'reply-now-or-later': ['⚡', '🐢'],
  'walk-or-bike': ['🚶', '🚲'],
  'museum-or-market': ['🏛️', '🏮'],
  'home-or-cafe-work': ['🏠', '🥐'],
  'photos-or-moment': ['📸', '💭'],
  'board-or-video-games': ['🎲', '🎮'],
  'big-crew-or-few': ['👯', '🤝'],
}

/** The emoji for one side of a question (decorative: always next to the words). */
export const sideIcon = (questionId: string, choice: WaveChoice): string => ICONS[questionId]?.[choice] ?? '✨'

/** The words for one side, in the language of the moment. */
export const sideLabel = (q: WaveQuestion, choice: WaveChoice): string => (choice === 0 ? q.a : q.b)

export interface WaveRound {
  /** which week since the quiz began (changes every Monday 00:00 Asia/Bangkok) */
  week: number
  /** 1-based number of the round inside the bank, e.g. "รอบที่ 2" */
  number: number
  /** how many rounds the bank holds (the weeks go round them) */
  rounds: number
  questions: WaveQuestion[]
  /** when this round gives way to the next (ms) */
  endsAt: number
}

/** This week's round: 8 questions, a new set every Monday (Asia/Bangkok), going round the bank. */
export function currentRound(now = Date.now()): WaveRound {
  const rounds = Math.max(1, Math.floor(WAVE_QUESTIONS.length / WAVE_ROUND_SIZE))
  const week = waveWeek(now)
  return {
    week,
    number: (((week % rounds) + rounds) % rounds) + 1,
    rounds,
    questions: waveRound(now),
    endsAt: nextWaveRoundAt(now),
  }
}

/** How many of these questions (default: the whole bank) have a pick. */
export function answeredCount(answers: WaveAnswers | undefined, questions: readonly WaveQuestion[] = WAVE_QUESTIONS): number {
  if (!answers) return 0
  return questions.reduce((n, q) => (answers[q.id] === undefined ? n : n + 1), 0)
}

/** The first of these questions without a pick (its index), or -1 when all are answered. */
export function firstOpen(answers: WaveAnswers | undefined, questions: readonly WaveQuestion[]): number {
  return questions.findIndex((q) => answers?.[q.id] === undefined)
}

export interface WaveAgreement {
  /** questions both picked the same side on */
  same: number
  /** questions both answered */
  common: number
  /** the questions we agree on, in bank order, with the side we both picked */
  agreed: { question: WaveQuestion; choice: WaveChoice }[]
}

/**
 * How two people's picks line up, over the questions both answered (only questions still in the
 * bank count; pass `questions` to look at one round). `common` under QUIZ_MIN_COMMON says nothing yet.
 */
export function agreement(a: WaveAnswers | undefined, b: WaveAnswers | undefined, questions: readonly WaveQuestion[] = WAVE_QUESTIONS): WaveAgreement {
  const agreed: WaveAgreement['agreed'] = []
  let common = 0
  if (a && b) {
    for (const q of questions) {
      const mine = a[q.id]
      const theirs = b[q.id]
      if (mine === undefined || theirs === undefined) continue
      common++
      if (mine === theirs) agreed.push({ question: q, choice: mine })
    }
  }
  return { same: agreed.length, common, agreed }
}
