// Keeps one person's player in step with the room. The server holds the clip's state (room_watch:
// playing or paused, positionS at the server moment positionAt, rate); this works out where the clip
// should be from the server's clock and nudges the local player there. No messages fly while people
// just watch, and someone who arrives late lands on the right spot.
//
// The rules (docs/2026-11-08-feature-proposal.md, section 5, simplified for v1):
// - off by less than ~3 s: leave it. More: jump to the right spot, then wait 5 s before the next jump
//   (jumping more often makes YouTube re-buffer on mobile data). 3 jumps in 30 s: "เน็ตช้านิดนึง…"
// - no measuring while the player isn't running smoothly (buffering, an ad, a stall)
// - a viewer who pauses or moves on their own goes "พักเฉพาะเรา" (solo) and is never pulled back;
//   someone who may control the clip does it for the whole room instead
// - hidden tab, or a sheet over the page: pause here only, catch up on return
// - never start playback for someone while less than half the player is on screen
import { watchEnded, watchPositionAt, watchStartsIn } from '@/data/watch'
import type { RoomWatch, WatchAction } from '@/lib/types'
import type { PlayerHandle, PlayerState } from './players'

export interface SyncStatus {
  /** follow: in step with the room · solo: "พักเฉพาะเรา", my own pause / spot */
  mode: 'follow' | 'solo'
  /** the browser wants a tap before it plays here */
  blocked: boolean
  /** caught up again and again: a slow connection */
  slow: boolean
}

export interface UserAction {
  action: Extract<WatchAction, 'play' | 'pause' | 'seek'>
  positionS?: number
}

const TICK_MS = 500
/** off by more than this: jump */
const DRIFT_MAX_S = 3
/** closer than this: no need to move (and less than this between two states: the room didn't move) */
const IN_STEP_S = 1.5
/** at most one catch-up jump this often */
const CATCH_UP_EVERY_MS = 5000
const SLOW_WINDOW_MS = 30_000
const SLOW_AFTER = 3
/** a jump bigger than this between two looks that I didn't make = someone moved the player */
const JUMP_S = 2.5
/** state changes right after my own command are its echo */
const OWN_COMMAND_MS = 1200
const OWN_SEEK_MS = 2000
/** a pause / play is acted on once it has lasted this long (dragging YouTube's bar flickers paused) */
const SETTLE_MS = 600
/** waiting this long for the room to take my own action before showing the room's state again */
const PENDING_MS = 4000

type Hold = 'hidden' | 'covered'
type Sample = { pos: number; at: number; state: PlayerState }

export class WatchSync {
  private player: PlayerHandle | null = null
  private mode: SyncStatus['mode'] = 'follow'
  private blocked = false
  private slow = false
  private holds = new Set<Hold>()
  private inView = true
  private canControl = false
  private catchUps: number[] = []
  private lastCatchUp = 0
  private roomChangedAt = 0
  private commandAt = 0
  private seekAt = 0
  private pendingUntil = 0
  private pendingPlaying = false
  private appliedRate = 1
  /** the last look at the player */
  private sample: Sample | null = null
  /** the last look while it was playing or paused (not buffering) */
  private stable: Sample | null = null
  private inStep = false
  private contentDuration = 0
  private starting = false
  private timer: number
  private startTimer = 0
  private settleTimer = 0
  /** the player just went against the room (a tap of the person's?): hands off until it's clear */
  private settleUntil = 0

  private watch: RoomWatch
  private serverNow: () => number
  private onStatus: (status: SyncStatus) => void
  private onAction: (action: UserAction) => Promise<boolean>

  /**
   * `serverNow`: the server's clock (useServerClock().now). `onStatus`: what to show under the player.
   * `onAction`: a play / pause / move by someone who may control the clip, for the whole room
   * (resolves false when the room didn't take it).
   */
  constructor(watch: RoomWatch, serverNow: () => number, onStatus: (status: SyncStatus) => void, onAction: (action: UserAction) => Promise<boolean>) {
    this.watch = watch
    this.serverNow = serverNow
    this.onStatus = onStatus
    this.onAction = onAction
    this.timer = window.setInterval(() => this.tick(), TICK_MS)
  }

  destroy() {
    window.clearInterval(this.timer)
    window.clearTimeout(this.startTimer)
    window.clearTimeout(this.settleTimer)
    this.player = null
  }

  // ---------------------------------------------------------------- inputs

  attach(player: PlayerHandle) {
    this.player = player
    this.sample = null
    this.stable = null
    this.inStep = false
    this.contentDuration = 0
    this.appliedRate = 1
    this.lastCatchUp = 0
    this.reconcile()
  }

  detach() {
    this.player = null
    window.clearTimeout(this.startTimer)
    window.clearTimeout(this.settleTimer)
  }

  /** a new state from the server (same clip: a new clip gets a new engine) */
  setWatch(next: RoomWatch) {
    const prev = this.watch
    if (next === prev) return
    this.watch = next
    if (next.version < prev.version) {
      this.watch = prev
      return
    }
    const t = this.serverNow()
    const moved = next.playing !== prev.playing || Math.abs(watchPositionAt(next, t) - watchPositionAt(prev, t)) > IN_STEP_S || next.rate !== prev.rate
    // the room took my action (or someone else's): show the room again
    this.pendingUntil = 0
    // nothing to tap for while the room is paused
    if (!next.playing && this.blocked) {
      this.blocked = false
      this.emit()
    }
    if (moved) {
      this.roomChangedAt = Date.now()
      this.lastCatchUp = 0
      this.sample = null
      this.stable = null
      this.inStep = false
    }
    this.reconcile()
  }

  setControl(canControl: boolean) {
    this.canControl = canControl
  }

  setHold(kind: Hold, on: boolean) {
    if (this.holds.has(kind) === on) return
    if (on) this.holds.add(kind)
    else this.holds.delete(kind)
    if (!on) {
      // back: catch up straight away
      this.lastCatchUp = 0
      this.sample = null
      this.stable = null
      this.inStep = false
    }
    this.reconcile()
  }

  setInView(inView: boolean) {
    if (this.inView === inView) return
    this.inView = inView
    if (inView) this.reconcile()
  }

  /** the clock's offset changed (a fresh measurement) */
  nudge() {
    this.lastCatchUp = 0
    this.reconcile()
  }

  /** "กลับไปดูพร้อมเพื่อน" */
  rejoin() {
    this.mode = 'follow'
    this.lastCatchUp = 0
    this.sample = null
    this.stable = null
    this.inStep = false
    this.starting = false
    this.settleUntil = 0
    this.emit()
    this.reconcile(true)
  }

  /** "แตะเพื่อเริ่มดูพร้อมเพื่อน": runs inside the tap, so the browser lets it play */
  tapToPlay() {
    this.blocked = false
    this.starting = false
    this.settleUntil = 0
    this.mode = 'follow'
    this.emit()
    this.reconcile(true)
  }

  /** the player's own onAutoplayBlocked */
  markBlocked() {
    if (this.blocked) return
    this.blocked = true
    this.emit()
  }

  /** the player says it changed state */
  handleState(s: PlayerState) {
    if ((s === 'playing' || s === 'buffering') && this.blocked) {
      this.blocked = false
      this.emit()
    }
    if (s === 'playing' || s === 'buffering') this.starting = false
    if (s !== 'paused' && s !== 'playing') return
    if (this.mode === 'solo' || this.holds.size || Date.now() - this.commandAt < OWN_COMMAND_MS) return
    const wants = this.roomPlaying()
    if ((s === 'paused') !== wants) return
    // against the room, and not my own doing: leave the player be until it's clear what happened
    this.settleUntil = Date.now() + SETTLE_MS + 150
    window.clearTimeout(this.settleTimer)
    this.settleTimer = window.setTimeout(() => this.checkPlayPause(), SETTLE_MS)
  }

  // ---------------------------------------------------------------- status

  private emit() {
    this.onStatus({ mode: this.mode, blocked: this.blocked, slow: this.slow })
  }

  private live(): boolean {
    return this.watch.isLive || !!this.player?.live()
  }

  /** the room wants it playing now (my own pending action counts until the room answers) */
  private roomPlaying(): boolean {
    if (Date.now() < this.pendingUntil) return this.pendingPlaying
    return this.watch.playing && !this.roomEnded()
  }

  private roomEnded(): boolean {
    const w = this.watch
    if (watchEnded(w, this.serverNow())) return true
    // no known length: the player's own
    const d = this.player?.duration() ?? 0
    return !w.durationS && !this.live() && d > 0 && watchPositionAt(w, this.serverNow()) >= d - 0.25
  }

  /** YouTube reports an ad's length as the duration while it plays */
  private adLikely(p: PlayerHandle): boolean {
    const d = p.duration()
    return this.contentDuration > 0 && d > 0 && Math.abs(d - this.contentDuration) > 1.5
  }

  // ---------------------------------------------------------------- what the person did on the player

  private checkPlayPause() {
    this.settleUntil = 0
    const p = this.player
    if (!p || this.mode === 'solo' || this.holds.size || this.blocked) return
    if (Date.now() - this.commandAt < OWN_COMMAND_MS) return
    const s = p.state()
    const wants = this.roomPlaying()
    if (s === 'paused' && wants) this.userDid({ action: 'pause', positionS: this.live() ? undefined : p.time() })
    else if (s === 'playing' && !wants) this.userDid({ action: 'play', positionS: this.live() ? undefined : p.time() })
  }

  private userDid(a: UserAction) {
    if (!this.canControl) {
      // a viewer: their own break, the room carries on
      this.mode = 'solo'
      this.emit()
      return
    }
    // for the whole room; until the room answers, don't fight what they just did
    this.pendingPlaying = a.action === 'seek' ? this.roomPlaying() : a.action === 'play'
    this.pendingUntil = Date.now() + PENDING_MS
    void this.onAction(a).then((ok) => {
      if (ok) return
      this.pendingUntil = 0
      this.lastCatchUp = 0
      this.reconcile(true)
    })
  }

  // ---------------------------------------------------------------- the loop

  private tick() {
    const p = this.player
    if (!p) return
    const now = Date.now()
    const s = p.state()
    const pos = p.time()
    const prev = this.sample
    const stable = this.stable
    this.sample = { pos, at: now, state: s }
    if (s === 'playing' || s === 'paused') this.stable = this.sample
    if (this.slow && now - this.lastCatchUp > SLOW_WINDOW_MS) {
      this.slow = false
      this.emit()
    }
    // someone moved the player's own bar (not me, not during an ad). Compared with the last look
    // while it played or sat paused, so a jump across a moment of buffering counts too; a stall in
    // between only makes it fall behind, which isn't a jump.
    if (
      stable &&
      this.mode === 'follow' &&
      !this.holds.size &&
      stable.state === s &&
      (s === 'playing' || s === 'paused') &&
      now - this.seekAt > OWN_SEEK_MS &&
      now - this.commandAt > OWN_COMMAND_MS &&
      now > this.pendingUntil &&
      this.inStep &&
      !this.live() &&
      !this.adLikely(p)
    ) {
      const ran = s === 'playing' ? ((now - stable.at) / 1000) * this.appliedRate : 0
      if (pos < stable.pos - JUMP_S || pos > stable.pos + ran + JUMP_S) {
        this.inStep = false
        this.stable = null
        this.userDid({ action: 'seek', positionS: pos })
        return
      }
    }
    this.reconcile(false, prev)
  }

  private pauseHere(p: PlayerHandle) {
    this.commandAt = Date.now()
    p.pause()
  }

  private seekHere(p: PlayerHandle, s: number) {
    this.seekAt = Date.now()
    this.sample = null
    this.stable = null
    p.seek(s)
  }

  private playHere(p: PlayerHandle) {
    if (this.starting) return
    this.starting = true
    this.commandAt = Date.now()
    void p.play().then((result) => {
      this.starting = false
      if (result === 'blocked' && p.state() !== 'playing' && p.state() !== 'buffering') this.markBlocked()
    })
  }

  /**
   * Bring the player to where the room is. `tap`: the person just tapped to start (the browser
   * allows playback now, and a blocked player may try again).
   */
  private reconcile(tap = false, prev: Sample | null = null) {
    const p = this.player
    if (!p) return
    const s = p.state()
    const going = s === 'playing' || s === 'buffering'
    // hidden tab / a sheet over the player: paused here, whatever the room does
    if (this.holds.size) {
      if (going) this.pauseHere(p)
      return
    }
    if (this.mode === 'solo' || Date.now() < this.pendingUntil || Date.now() < this.settleUntil) return
    const w = this.watch
    const live = this.live()
    const now = Date.now()
    const t = this.serverNow()
    const target = watchPositionAt(w, t)
    if (!live && w.rate !== this.appliedRate) {
      p.setRate(w.rate)
      this.appliedRate = w.rate
    }

    // the room is paused (or the clip is over): line up once, then leave the bar to the person
    // (a move of theirs from there is theirs: see tick)
    const ended = this.roomEnded()
    if (!w.playing || ended) {
      if (going) this.pauseHere(p)
      if (!live && !ended && s === 'paused') {
        if (Math.abs(p.time() - target) <= 1) this.inStep = true
        else if (!this.inStep && now - this.seekAt > OWN_SEEK_MS) this.seekHere(p, target)
      }
      return
    }

    // the room starts in a moment (a fresh start, resume or move: everyone goes together)
    const startsIn = watchStartsIn(w, t)
    if (startsIn > 0) {
      // already going from about there (my own tap on the player): leave it
      if (going && (live || Math.abs(p.time() - w.positionS) < IN_STEP_S + 1)) return
      if (going) this.pauseHere(p)
      // an unstarted YouTube player would start on a seek: it lines up when it plays
      if (!live && s !== 'unstarted' && s !== 'cued' && Math.abs(p.time() - w.positionS) > 0.5) this.seekHere(p, w.positionS)
      window.clearTimeout(this.startTimer)
      this.startTimer = window.setTimeout(() => this.reconcile(), startsIn + 30)
      return
    }

    // the room is playing: start here
    if (!going) {
      if (s === 'ended' && (live || p.duration() <= 0 || target >= p.duration() - 1)) return
      if ((this.blocked && !tap) || !this.inView) return
      if (!live && Math.abs(p.time() - target) > IN_STEP_S) this.seekHere(p, target)
      this.playHere(p)
      return
    }

    // playing: in step?
    if (s !== 'playing' || live || !prev || prev.state !== 'playing' || this.adLikely(p)) return
    const ran = p.time() - prev.pos
    const should = ((now - prev.at) / 1000) * this.appliedRate
    // not running smoothly (an ad, a stall, a hiccup): don't measure now
    if (should <= 0 || ran < should * 0.5 || ran > should * 1.5) return
    const drift = p.time() - target
    if (Math.abs(drift) <= DRIFT_MAX_S) {
      if (!this.inStep) {
        this.inStep = true
        this.contentDuration = p.duration() || this.contentDuration
      }
      return
    }
    if (now - this.lastCatchUp < CATCH_UP_EVERY_MS) return
    // a little ahead: the jump itself takes a moment
    this.seekHere(p, target + 0.3)
    this.lastCatchUp = now
    // right after the room itself moved, a jump is expected, not a slow connection
    if (now - this.roomChangedAt > 3000) {
      this.catchUps = [...this.catchUps.filter((x) => now - x < SLOW_WINDOW_MS), now]
      if (this.catchUps.length >= SLOW_AFTER && !this.slow) {
        this.slow = true
        this.emit()
      }
    }
  }
}
