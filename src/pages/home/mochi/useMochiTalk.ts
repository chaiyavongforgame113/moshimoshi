import { useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MOCHI } from '@/lib/colors'
import type { Mood } from '@/lib/types'
import { MOOD_BY_KEY } from '../moods'
import { FIRST_CTX, respond, validStep, type Action, type Ask, type Card, type Ctx, type Line, type Out, type Step, type Turn } from './engine'
import { say } from './script'

/*
 * The conversation's state: the thread, Mochi's lines still "being typed",
 * and where the script is. It lives in this browser only (localStorage, per
 * user id) and never goes to the server.
 */

interface State {
  lines: Line[]
  /** Mochi's next lines: each shows after a short typing pause */
  queue: Line[]
  step: Step
  ctx: Ctx
}

interface Saved {
  v: 1
  lines: Line[]
  step: Step
  ctx: Ctx
}

const KEY = 'moshi-mochi-chat:'
/** the newest lines kept on this device */
const MAX_LINES = 60

let seq = 0
const newId = () => `${Date.now().toString(36)}${(seq++).toString(36)}`

const greeting = (): Line => ({ id: newId(), who: 'mochi', key: 'hello', sub: 'hello.sub', face: 'happy' })
const fresh = (): State => ({ lines: [greeting()], queue: [], step: { id: 'mood' }, ctx: FIRST_CTX })

/** a saved line this version can draw (anything else from an older or edited save is dropped) */
function isLine(l: unknown): l is Line {
  if (!l || typeof l !== 'object') return false
  const x = l as Record<string, unknown>
  if (typeof x.id !== 'string') return false
  if (x.who === 'mochi') return typeof x.key === 'string' && (x.sub === undefined || typeof x.sub === 'string')
  if (x.who === 'me')
    return (
      (x.key === undefined || typeof x.key === 'string') &&
      (x.text === undefined || typeof x.text === 'string') &&
      (x.tone === undefined || (typeof x.tone === 'string' && x.tone in MOCHI))
    )
  if (x.who === 'card') {
    const c = x.card as Record<string, unknown> | undefined
    return !!c && (c.kind === 'hotline' || c.kind === 'browse' || ((c.kind === 'room' || c.kind === 'person' || c.kind === 'session') && typeof c.id === 'string'))
  }
  return false
}

function load(userId: string): Saved | null {
  try {
    const raw = localStorage.getItem(KEY + userId)
    if (!raw) return null
    const data = JSON.parse(raw) as Partial<Saved>
    const step = validStep(data.step)
    if (data.v !== 1 || !Array.isArray(data.lines) || !step || !data.ctx) return null
    const lines = data.lines.filter(isLine)
    const m = data.ctx.mood
    const mood = m === 'other' || (typeof m === 'string' && m in MOOD_BY_KEY) ? m : undefined
    const ctx: Ctx = { mood, vent: Number(data.ctx.vent) || 0, turn: Number(data.ctx.turn) || 0 }
    return { v: 1, lines, step, ctx }
  } catch {
    return null
  }
}

function save(userId: string, s: State) {
  try {
    const data: Saved = { v: 1, lines: [...s.lines, ...s.queue].slice(-MAX_LINES), step: s.step, ctx: s.ctx }
    localStorage.setItem(KEY + userId, JSON.stringify(data))
  } catch {
    // private mode or storage full: the chat still works, it just isn't remembered
  }
}

function forget(userId: string) {
  try {
    localStorage.removeItem(KEY + userId)
  } catch {
    // nothing saved to clear
  }
}

/** turns Mochi's "out" into thread lines; a suggestion becomes one line about it plus its card */
function toLines(out: Out[], resolve: (ask: Ask) => Card): Line[] {
  const lines: Line[] = []
  for (const o of out) {
    if ('say' in o) lines.push({ id: newId(), who: 'mochi', key: o.say, sub: o.sub, face: o.face, tip: o.tip })
    else if ('card' in o) lines.push({ id: newId(), who: 'card', card: o.card })
    else {
      const card = resolve(o.ask)
      lines.push({ id: newId(), who: 'mochi', key: cardLine(o.ask, card), face: card.kind === 'browse' ? 'smile' : 'happy' })
      lines.push({ id: newId(), who: 'card', card })
    }
  }
  return lines
}

function cardLine(ask: Ask, card: Card): string {
  if (card.kind === 'room' && ask.kind === 'person') return 'card.room.noPerson'
  if (card.kind === 'room' && ask.kind === 'session') return 'card.room.noSession'
  return `card.${card.kind}`
}

/**
 * I act: Mochi's pending lines land first, then mine, then Mochi's answer queues up
 * (or lands right away when `instant`, for reduced motion).
 */
function apply(s: State, turn: Turn, resolve: (ask: Ask) => Card, instant = false): State {
  const lines = [...s.lines, ...s.queue]
  if (turn.me) lines.push({ id: newId(), who: 'me', ...turn.me })
  const answer = toLines(turn.out, resolve)
  if (instant) return { lines: [...lines, ...answer].slice(-MAX_LINES), queue: [], step: turn.step, ctx: turn.ctx }
  return { lines: lines.slice(-MAX_LINES), queue: answer, step: turn.step, ctx: turn.ctx }
}

/** the mood answer never suggests anything, so there is nothing to resolve yet */
const noAsk = (): Card => ({ kind: 'browse' })

function start(userId: string, initialMood: Mood | null | undefined, instant: boolean): State {
  const saved = load(userId)
  let s: State = saved && saved.lines.length ? { lines: saved.lines, queue: [], step: saved.step, ctx: saved.ctx } : fresh()
  // opened from a mood on the home card: the chat starts from it
  if (initialMood) return apply(s, respond(s.step, s.ctx, { type: 'mood', mood: initialMood }), noAsk, instant)
  // they said goodbye last time: Mochi welcomes them back and asks again
  if (saved && s.step.id === 'rest') {
    const back: Line = { id: newId(), who: 'mochi', key: 'back', face: 'happy' }
    s = instant ? { ...s, lines: [...s.lines, back], step: { id: 'mood' } } : { ...s, queue: [back], step: { id: 'mood' } }
  }
  return s
}

/** a little longer for a longer line, 0.8–1.2 s */
function typingTime(line: Line): number {
  if (line.who !== 'mochi') return 700
  return 800 + Math.min(400, say(line.key).length * 5)
}

export function useMochiTalk({ userId, initialMood, resolve }: { userId: string; initialMood?: Mood | null; resolve: (ask: Ask) => Card }) {
  const reduce = useReducedMotion()
  const [state, setState] = useState<State>(() => start(userId, initialMood, !!reduce))
  const resolveRef = useRef(resolve)
  const reduceRef = useRef(reduce)
  useEffect(() => {
    resolveRef.current = resolve
    reduceRef.current = reduce
  })

  // Mochi "types" each queued line, one after another (all at once with reduced motion)
  useEffect(() => {
    const first = state.queue[0]
    if (!first) return
    const all = !!reduce
    const timer = window.setTimeout(
      () =>
        setState((s) => {
          if (!s.queue.length) return s
          const landing = all ? s.queue : s.queue.slice(0, 1)
          return { ...s, lines: [...s.lines, ...landing].slice(-MAX_LINES), queue: s.queue.slice(landing.length) }
        }),
      all ? 0 : typingTime(first),
    )
    return () => window.clearTimeout(timer)
  }, [state.queue, reduce])

  useEffect(() => save(userId, state), [userId, state])

  const act = useCallback((a: Action) => {
    setState((s) => apply(s, respond(s.step, s.ctx, a), resolveRef.current, !!reduceRef.current))
  }, [])

  const restart = useCallback(() => {
    forget(userId)
    setState(fresh())
  }, [userId])

  return { lines: state.lines, typing: state.queue.length > 0, step: state.step, ctx: state.ctx, act, restart }
}
