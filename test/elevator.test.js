import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DURATIONS, scale, initialCar, step, sequence, positionAt, speedAt, label, FLOORS } from '../src/elevator.js'

const D = DURATIONS
const closed = () => ({ ...initialCar(), doors: 'closed' })
const evs = (r) => r.timeline.map((s) => s.ev)
const count = (r, ev) => r.timeline.filter((s) => s.ev === ev).length

test('DURATIONS carries every named timing; scale rounds every one', () => {
  for (const k of ['doors', 'floor', 'express', 'fall', 'impact', 'hold', 'pitDoors', 'lanternLead', 'tick', 'bacon']) assert.ok(Number.isInteger(D[k]) && D[k] > 0, k)
  assert.equal(D.doors, 500); assert.equal(D.floor, 700); assert.equal(D.express, 500); assert.equal(D.fall, 800)
  const half = scale(D, 0.5)
  for (const k of Object.keys(D)) assert.equal(half[k], Math.round(D[k] / 2))
  const tenth = scale(D, 0.1)
  assert.equal(tenth.floor, 70)
})

test('label', () => {
  assert.equal(label(-1), 'P'); assert.equal(label(0), 'G'); assert.equal(label(5), '5'); assert.equal(label(10), 'R')
  assert.equal(FLOORS.PIT, -1); assert.equal(FLOORS.ROOF, 10)
})

test('initial car: G, doors open, idle', () => {
  assert.deepEqual(initialCar(), { floor: 0, doors: 'open', direction: 'none', carCall: null, hallCalls: [], lantern: null, motion: 'idle' })
})

test('press registers a car call; illegal floors leave the car unchanged', () => {
  const car = initialCar()
  const r = step(car, { type: 'press', floor: 1 })
  assert.equal(r.car.carCall, 1); assert.deepEqual(r.timeline, [])
  for (const f of [0, -1, 11, 'x', undefined]) { const x = step(car, { type: 'press', floor: f }); assert.equal(x.blocked, 'illegal'); assert.equal(x.car, car) }
})

test('closeDoors / openDoors timelines', () => {
  const c = step(initialCar(), { type: 'closeDoors' })
  assert.deepEqual(c.timeline, [{ t: 0, ev: 'doors-closing' }, { t: D.doors, ev: 'doors-closed' }])
  assert.equal(c.car.doors, 'closed'); assert.equal(c.duration, D.doors)
  const o = step(c.car, { type: 'openDoors' })
  assert.deepEqual(o.timeline, [{ t: 0, ev: 'doors-opening' }, { t: D.doors, ev: 'doors-open' }])
  assert.equal(o.car.doors, 'open')
  assert.equal(step(initialCar(), { type: 'openDoors' }).blocked, 'illegal')
  assert.equal(step(c.car, { type: 'closeDoors' }).blocked, 'illegal')
})

test('move: refused with {blocked:"doors"} unless closed; one floor up with one ding, lantern 250 ms early', () => {
  const open = step(initialCar(), { type: 'move' })
  assert.equal(open.blocked, 'doors'); assert.equal(open.car, initialCar() && open.car); assert.deepEqual(open.timeline, [])
  const r = step(closed(), { type: 'move' })
  assert.equal(r.car.floor, 1); assert.equal(r.car.doors, 'open'); assert.equal(r.car.motion, 'idle')
  assert.deepEqual(r.timeline, [
    { t: 0, ev: 'move-start', floor: 1 },
    { t: D.floor - D.lanternLead, ev: 'lantern', floor: 1 },
    { t: D.floor - D.lanternLead, ev: 'ding', floor: 1 },
    { t: D.floor, ev: 'sill', floor: 1 },
    { t: D.floor, ev: 'arrive', floor: 1 },
    { t: D.floor, ev: 'doors-opening' },
    { t: D.floor + D.doors, ev: 'doors-open' },
    { t: D.floor + D.doors, ev: 'bacon', floor: 1 },
  ])
  assert.equal(count(r, 'ding'), 1); assert.equal(count(r, 'ding2'), 0)
  assert.equal(r.duration, D.floor + D.doors + D.bacon)
  assert.equal(step({ ...closed(), floor: 10 }, { type: 'move' }).blocked, 'illegal')
})

test('express passes every floor in order at 500 ms, one ding; descend dings twice', () => {
  const r = step({ ...closed(), floor: -1 }, { type: 'express', to: 7 })
  const sills = r.timeline.filter((s) => s.ev === 'sill')
  assert.deepEqual(sills.map((s) => s.floor), [0, 1, 2, 3, 4, 5, 6, 7])
  sills.forEach((s, i) => assert.equal(s.t, (i + 1) * D.express))
  assert.equal(count(r, 'ding'), 1); assert.equal(count(r, 'ding2'), 0)
  assert.equal(r.timeline.find((s) => s.ev === 'arrive').t, 8 * D.express)
  assert.equal(r.car.floor, 7)
  for (let i = 1; i < r.timeline.length; i++) assert.ok(r.timeline[i].t >= r.timeline[i - 1].t, 'sorted')
  assert.equal(step(closed(), { type: 'express', to: 0 }).blocked, 'illegal')
  assert.equal(step(initialCar(), { type: 'express', to: 3 }).blocked, 'doors')

  const d = step({ ...closed(), floor: 10 }, { type: 'descend', to: 0 })
  assert.deepEqual(d.timeline.filter((s) => s.ev === 'sill').map((s) => s.floor), [9, 8, 7, 6, 5, 4, 3, 2, 1, 0])
  assert.equal(count(d, 'ding2'), 1); assert.equal(count(d, 'ding'), 0)
  assert.equal(d.car.floor, 0); assert.equal(d.car.doors, 'open')
  assert.equal(step({ ...closed(), floor: 3 }, { type: 'descend', to: 5 }).blocked, 'illegal')
})

test('fall bypasses the door interlock, reaches P in 800 ms regardless of height, no ding, byte-identical', () => {
  const a = step({ ...initialCar(), floor: 6 }, { type: 'fall' })
  const b = step({ ...initialCar(), floor: 2 }, { type: 'fall' })
  assert.deepEqual(a.timeline, b.timeline)
  assert.deepEqual(evs(a), ['doors-closing', 'doors-closed', 'fall-start', 'impact', 'sill', 'brake', 'doors-opening', 'doors-open'])
  const at = (ev) => a.timeline.find((s) => s.ev === ev).t
  assert.equal(at('fall-start'), D.pitDoors)
  assert.equal(at('impact') - at('fall-start'), D.fall)
  assert.equal(at('brake') - at('impact'), D.impact)
  assert.equal(at('doors-opening') - at('brake'), D.hold)
  assert.equal(a.duration, D.pitDoors + D.fall + D.impact + D.hold + D.pitDoors)
  assert.ok(a.duration + 1200 <= 5000, 'a fall over 5 s')
  assert.equal(count(a, 'ding') + count(a, 'ding2'), 0)
  assert.equal(a.car.floor, -1); assert.equal(a.car.doors, 'open')
  assert.equal(step(a.car, { type: 'fall' }).blocked, 'illegal')
})

test('illegal events return the car unchanged', () => {
  const car = initialCar()
  for (const ev of [null, {}, { type: 'dance' }, { type: 'move', to: 3 }]) { const r = step(car, ev); assert.equal(r.car, car); assert.deepEqual(r.timeline, []) }
  const moving = { ...closed(), motion: 'moving' }
  assert.equal(step(moving, { type: 'move' }).blocked, 'illegal')
})

test('sequence offsets each timeline and stops at the first block', () => {
  const r = sequence(initialCar(), [{ type: 'closeDoors' }, { type: 'move' }])
  assert.equal(r.timeline[0].ev, 'doors-closing')
  assert.equal(r.timeline.find((s) => s.ev === 'move-start').t, D.doors)
  assert.equal(r.duration, D.doors + D.floor + D.doors + D.bacon)
  assert.equal(r.car.floor, 1)
  const blocked = sequence(initialCar(), [{ type: 'move' }])
  assert.equal(blocked.blocked, 'doors')
})

test('positionAt is monotone, starts at from, and is exactly `to` at the end', () => {
  for (const [from, to, ms] of [[0, 1, 700], [-1, 7, 500], [10, 0, 500], [3, 4, 350]]) {
    const T = Math.abs(to - from) * ms
    let prev = positionAt(from, to, 0, ms)
    assert.equal(prev, from)
    for (let t = 1; t <= T; t++) {
      const p = positionAt(from, to, t, ms)
      if (to > from) assert.ok(p >= prev - 1e-12, `${from}→${to} at ${t}`); else assert.ok(p <= prev + 1e-12)
      prev = p
    }
    assert.equal(positionAt(from, to, T, ms), to)
    assert.equal(positionAt(from, to, T + 5000, ms), to)
    assert.equal(positionAt(from, to, -5, ms), from)
  }
  assert.equal(positionAt(4, 4, 100, 700), 4)
  // the mid-ride speed is positive and finite
  assert.ok(speedAt(0, 1, 350, 700) > 0)
})
