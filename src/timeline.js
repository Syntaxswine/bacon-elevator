// Timeline player core. Pure: the clock is injected (advance(nowMs)), so the tests drive it by
// hand and main.js drives it off requestAnimationFrame with a setTimeout fallback for hidden tabs.
//
// createPlayer(steps, timescale, startMs, durationMs) → player
//   steps        [{t, ev, ...}] design-time offsets in ms (elevator.js), in any order
//   timescale    Normal 1, Fast 0.5, drive 0.1 (times the reduced-motion factor for a fall)
//   durationMs   the design-time length of the whole timeline (the effect's `duration`, which
//                includes the trailing bacon slide); defaults to the last step's t
//   player.advance(nowMs) → {fired: step[], done}  every step whose scaled time has passed, in
//     time order (equal times keep list order), each exactly once; `done` once the whole
//     timeline has elapsed
//   player.flush() → {fired, done: true}  fires everything still pending (hidden tab, quit)
//   player.elapsed(nowMs) → design-time ms since the start (what shaft.frame wants)
//   player.endMs   the absolute ms at which the timeline completes

export function createPlayer(steps, timescale = 1, startMs = 0, durationMs) {
  const ts = Number.isFinite(timescale) && timescale > 0 ? timescale : 1
  const list = (Array.isArray(steps) ? steps : [])
    .map((step, i) => ({ step, i, at: startMs + step.t * ts }))
    .sort((x, y) => x.at - y.at || x.i - y.i)
  const last = list.reduce((m, x) => Math.max(m, x.step.t), 0)
  const duration = Number.isFinite(durationMs) ? Math.max(durationMs, last) : last
  const endMs = startMs + duration * ts
  let next = 0
  let done = false
  return {
    endMs, ts, startMs, duration,
    get done() { return done },
    get pending() { return list.length - next },
    elapsed(nowMs) { return Math.max(0, (nowMs - startMs) / ts) },
    advance(nowMs) {
      if (done) return { fired: [], done: true }
      const fired = []
      while (next < list.length && list[next].at <= nowMs) fired.push(list[next++].step)
      if (next >= list.length && nowMs >= endMs) done = true
      return { fired, done }
    },
    flush() {
      if (done) return { fired: [], done: true }
      const fired = []
      while (next < list.length) fired.push(list[next++].step)
      done = true
      return { fired, done }
    },
  }
}
