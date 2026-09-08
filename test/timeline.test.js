import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPlayer } from '../src/timeline.js'
import { mulberry32 } from '../src/rng.js'
import { sequence, step, initialCar, DURATIONS } from '../src/elevator.js'

test('fires every step exactly once, in time order, and is done exactly when the timeline has elapsed', () => {
  const steps = [{ t: 0, ev: 'a' }, { t: 100, ev: 'b' }, { t: 100, ev: 'c' }, { t: 250, ev: 'bacon' }]
  const p = createPlayer(steps, 1, 1000, 650)
  assert.equal(p.endMs, 1000 + 650)
  assert.deepEqual(p.advance(999).fired, [])
  assert.deepEqual(p.advance(1000).fired.map((s) => s.ev), ['a'])
  assert.deepEqual(p.advance(1050).fired.map((s) => s.ev), [])
  assert.deepEqual(p.advance(1100).fired.map((s) => s.ev), ['b', 'c'], 'equal times keep list order')
  const r = p.advance(1649)
  assert.deepEqual(r.fired.map((s) => s.ev), ['bacon']); assert.equal(r.done, false, 'the bacon slide is still running')
  assert.equal(p.advance(1650).done, true)
  assert.deepEqual(p.advance(9999).fired, [], 'nothing fires twice')
  assert.equal(p.elapsed(1400), 400)
})

test('timescale scales every offset and the elapsed clock; flush fires the rest once (the hidden-tab path)', () => {
  const steps = [{ t: 0, ev: 'a' }, { t: 1000, ev: 'b' }, { t: 2000, ev: 'c' }]
  const p = createPlayer(steps, 0.1, 0, 2000)
  assert.equal(p.endMs, 200)
  assert.deepEqual(p.advance(50).fired.map((s) => s.ev), ['a'])
  assert.equal(p.elapsed(50), 500, 'elapsed is in design-time ms')
  assert.deepEqual(p.advance(100).fired.map((s) => s.ev), ['b'])
  const f = p.flush()
  assert.deepEqual(f.fired.map((s) => s.ev), ['c']); assert.equal(f.done, true)
  assert.deepEqual(p.flush().fired, [])
  assert.equal(p.advance(100000).done, true)
  assert.deepEqual(p.advance(100000).fired, [])
})

test('the fired step is the very object that was given, data intact; steps are sorted for the caller', () => {
  const a = { t: 5, ev: 'move-start', floor: 1 }
  const b = { t: 2, ev: 'doors-closing' }
  const p = createPlayer([a, b], 1, 0)
  assert.equal(p.endMs, 5, 'duration defaults to the last step')
  const r = p.advance(5)
  assert.equal(r.fired[0], b); assert.equal(r.fired[1], a)
  assert.deepEqual(a, { t: 5, ev: 'move-start', floor: 1 })
  assert.equal(createPlayer([], 1, 7).advance(7).done, true, 'an empty timeline is done at once')
  assert.equal(createPlayer([{ t: 10, ev: 'x' }], 0, 0).ts, 1, 'a bad timescale falls back to 1')
})

test('property: 2 000 random timelines at random timescales and clock steps — order, once-only, done at end', () => {
  const rng = mulberry32(77)
  for (let n = 0; n < 2000; n++) {
    const count = rng.int(0, 12)
    const steps = []
    for (let i = 0; i < count; i++) steps.push({ t: rng.int(0, 3000), ev: 'e' + i })
    const ts = [0.1, 0.5, 1, 2][rng.int(0, 3)]
    const start = rng.int(0, 100000)
    const tail = rng() < 0.5 ? rng.int(0, 500) : 0
    const last = steps.reduce((m, s) => Math.max(m, s.t), 0)
    const p = createPlayer(steps, ts, start, last + tail)
    assert.equal(p.endMs, start + (last + tail) * ts)
    let now = start - 10
    const seen = []
    let done = false
    let guard = 0
    while (!done && guard++ < 1000) {
      now += rng.int(0, 400)
      const r = p.advance(now)
      for (const s of r.fired) { assert.ok(start + s.t * ts <= now, 'never early'); seen.push(s) }
      for (let k = 1; k < r.fired.length; k++) assert.ok(r.fired[k].t >= r.fired[k - 1].t, 'in time order')
      done = r.done
      if (done) assert.ok(now >= p.endMs)
      else if (seen.length === steps.length) assert.ok(now < p.endMs, 'not done only while the tail runs')
    }
    assert.equal(seen.length, steps.length, 'each step once')
    assert.equal(p.advance(now + 1e6).fired.length, 0)
    // flushing a fresh player fires everything once, in order
    const q = createPlayer(steps, ts, start, last + tail)
    const f = q.flush().fired
    assert.equal(f.length, steps.length)
    for (let k = 1; k < f.length; k++) assert.ok(f[k].t >= f[k - 1].t)
    assert.equal(q.flush().fired.length, 0)
  }
})

test('the real sequences: a ride and a fall complete at the design times', () => {
  const D = DURATIONS
  const ride = sequence(initialCar(), [{ type: 'closeDoors' }, { type: 'move' }], D.tick)
  const p = createPlayer(ride.timeline, 1, 0, ride.duration)
  assert.equal(p.endMs, 2700, 'GO to the next Press is 2.7 s')
  const fall = step({ ...initialCar(), floor: 6 }, { type: 'fall' })
  const shifted = fall.timeline.map((e) => ({ ...e, t: e.t + D.truth }))
  const q = createPlayer(shifted, 0.5, 0, fall.duration + D.truth)
  assert.equal(q.endMs, 3900 * 0.5, 'a fall is 3.9 s from GO, halved at Fast')
  const evs = q.flush().fired.map((s) => s.ev)
  assert.deepEqual(evs.slice(0, 4), ['doors-closing', 'doors-closed', 'fall-start', 'impact'])
  assert.ok(evs.includes('brake') && evs[evs.length - 1] === 'doors-open')
  assert.equal(fall.car.floor, -1)
})
