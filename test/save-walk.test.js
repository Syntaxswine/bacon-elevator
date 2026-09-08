// The corrupt-save random walk: 3 000 seeded garbage saves, each parsed, hydrated and then PLAYED
// with nothing but DOM-reachable actions until the roof.
//
// It exists because every field of a save was range-checked on its own and the one relation the
// reducer depends on — that there is a floor ABOVE the car to press — was checked nowhere. A save
// holding {floor:4, target:4} passes every range check and is a building the child cannot move.
//
// Three assertions, all of which must hold for every save:
//   1. no parse, hydrate or reduce call throws;
//   2. equationHTML(problem.text, typed) is callable in every keypad and repair phase — this is the
//      renderer's own entry point, and the comeback class went straight past the save's validator
//      into `text.split is not a function`;
//   3. the walk reaches the roof inside 600 actions, and NO action it issues returns the identical
//      state object. A state that changes but never reaches the roof is still a dead building.
//
// The wrong-answer arm is load-bearing: a perfect player never falls, never visits the pit, never
// sees the Repair card, and would miss the pit-keypad freeze entirely.
//
// Measured against the tree this test was written for: 788 of 3 000 dead or throwing (452 render
// throws, 141 `no-op: press-floor 10`, 122 `GO on the correct answer was a no-op`, 29
// `no-op: press-floor 11`, and a tail of `no-op: press-floor N` where target <= floor). Now: 0.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from '../src/save.js'
import { hydrate, reduce, normaliseRide } from '../src/state.js'
import { mulberry32 } from '../src/rng.js'
import { loadFacts } from '../src/trivia.js'
import { equationHTML } from '../src/render/panel.js'

const POOL = loadFacts(JSON.parse(readFileSync(new URL('../data/trivia.json', import.meta.url), 'utf8'))).facts

// Garbage that a hand-edited save, a truncated write or a bad share code can really carry.
const G = [undefined, null, true, false, 0, -1, 1.5, NaN, Infinity, 1e308, -1e308, 9007199254740993, '', 'x', '12', [], {}, [1, 2], { a: 1 }]

function corrupt(rnd) {
  const pick = (a) => a[Math.floor(rnd() * a.length)]
  const g = () => pick(G)
  const maybe = (v) => (rnd() < 0.5 ? v : g())
  const ride = rnd() < 0.12 ? g() : {
    seed: maybe(7), floor: maybe(Math.floor(rnd() * 16) - 3), target: maybe(Math.floor(rnd() * 16) - 3),
    cleared: maybe([1, 2, 3].slice(0, Math.floor(rnd() * 4))), tray: maybe(Math.floor(rnd() * 20)), banked: maybe(Math.floor(rnd() * 30)),
    phase: pick(['floor', 'keypad', 'repair', 'trivia', 'fact', 'roof', 'moving', 'lobby', '', null, undefined, 'ZZ']),
    problem: rnd() < 0.5 ? { kind: pick(['add', 'sub', 'mul', 'div', 'missAdd', 'zz']), a: maybe(3), b: maybe(4), answer: maybe(7), text: maybe('3 + 4 = ▮'), key: maybe('add:3:4') } : g(),
    typed: maybe('12'), tries: maybe(0), streak: maybe(1), stepDowns: maybe(0),
    comeback: rnd() < 0.5 ? [{ problem: rnd() < 0.5 ? {} : { kind: 'add', a: 1, b: 1, answer: 2, text: maybe('1 + 1 = ▮'), key: 'add:1:1' }, due: maybe(0) }] : g(),
    passengersDone: maybe([4]), retrying: g(), forfeit: g(), typedWrong: g(),
    falls: maybe(0), draws: maybe(0), ctx: g(), lastKind: g(), fallFloor: maybe(0),
    inFlight: rnd() < 0.25 ? { name: pick(['ride', 'express', 'fall', 'descend', 'zz']), to: maybe(5) } : g(),
  }
  return {
    v: 1, created: g(), salt: maybe(1), lunchbox: maybe(Math.floor(rnd() * 50)), buildings: maybe(1),
    level: pick(['corner', 'hotel', 'office', 'sky', 'megatall', 'custom', 'zz', null]), step: maybe(2), adaptive: g(), pinnedStep: maybe(1),
    settings: rnd() < 0.3 ? g() : { sound: g(), volume: g(), speed: g(), motion: g(), bigText: g(), secondTry: g(), passengers: pick(['often', 'sometimes', 'never', null]), links: g(), custom: g() },
    facts: g(), unlocks: g(), equipped: g(), history: g(), ride, rulesSeen: true, step3Run: g(), plaques: g(),
  }
}

const snap = (s) => ({ phase: s.phase, screen: s.screen, floor: s.ride && s.ride.floor, target: s.ride && s.ride.target, lunchbox: s.lunchbox })

// Only DOM-reachable actions: ride-start, press-floor ride.target, digit + go, card-continue,
// choice, timeline-done. Nothing the child cannot actually tap.
function play(s0, rnd, limit = 600) {
  let s = { ...s0, pool: POOL, rulesSeen: true }
  const seed = Number.isSafeInteger(s.ride && s.ride.seed) ? s.ride.seed : 7
  const rng = mulberry32(seed >>> 0)
  s = hydrate(s, rng)
  for (let n = 0; n < limit; n++) {
    // Render safety: the panel must be drawable in every phase that shows an equation.
    if ((s.phase === 'keypad' || s.phase === 'repair') && s.ride && s.ride.problem) equationHTML(s.ride.problem.text, s.ride.typed)
    if (s.phase === 'roof') return { ok: true, n }
    let act
    if (s.phase === 'lobby') act = { type: 'ride-start' }
    else if (s.phase === 'floor') act = { type: 'press-floor', floor: s.ride.target }
    else if (s.phase === 'keypad') {
      const wrong = rnd() < 0.35 && s.ride.tries === 0 && !s.ride.retrying
      const a = s.ride.problem ? (wrong ? s.ride.problem.answer + 1 : s.ride.problem.answer) : 0
      let t = s
      for (const ch of String(Math.abs(a)).slice(0, 4)) t = reduce(t, { type: 'digit', d: ch }, rng).state
      if (a < 0) t = reduce(t, { type: 'toggle-sign' }, rng).state
      const g = reduce(t, { type: 'go' }, rng)
      if (g.state === t && t === s) return { ok: false, n, why: 'keypad: typing and GO changed nothing', s: snap(s) }
      if (g.state === t) return { ok: false, n, why: (wrong ? 'GO on a wrong answer' : 'GO on the correct answer') + ' was a no-op', s: snap(s) }
      s = g.state
      continue
    } else if (s.phase === 'repair') act = { type: 'card-continue' }
    else if (s.phase === 'trivia') act = { type: 'choice', i: s.trivia ? s.trivia.answer : 0 }
    else if (s.phase === 'fact') act = { type: 'card-continue' }
    else if (s.phase === 'moving' || s.phase === 'falling' || s.phase === 'descending') act = { type: 'timeline-done' }
    else return { ok: false, n, why: 'unknown phase ' + s.phase, s: snap(s) }
    const r = reduce(s, act, rng)
    if (r.state === s) return { ok: false, n, why: 'no-op: ' + act.type + (act.floor !== undefined ? ' ' + act.floor : ''), s: snap(s) }
    s = r.state
  }
  return { ok: false, n: limit, why: 'did not reach the roof in ' + limit + ' actions', s: snap(s) }
}

test('3 000 corrupt saves: every one parses, renders and can be played to the roof', () => {
  const N = 3000
  const dead = []
  for (let i = 0; i < N; i++) {
    const rnd = mulberry32(1000 + i)
    const blob = JSON.stringify(corrupt(rnd), (k, v) => (typeof v === 'number' && !Number.isFinite(v) ? null : v))
    let s
    try { s = parse(blob) } catch (e) { dead.push(`seed ${1000 + i}: parse threw ${e.message}`); continue }
    if (!s) continue
    let r
    try { r = play(s, rnd) } catch (e) { dead.push(`seed ${1000 + i}: threw ${e.message}`); continue }
    if (!r.ok) dead.push(`seed ${1000 + i}: ${r.why} at action ${r.n} ${JSON.stringify(r.s)}`)
  }
  assert.deepEqual(dead.slice(0, 8), [], `${dead.length} of ${N} corrupt saves are dead or throw`)
})

test('normaliseRide is idempotent, so the press-floor heal cannot recurse twice', () => {
  for (let i = 0; i < 2000; i++) {
    const rnd = mulberry32(9000 + i)
    const blob = JSON.stringify(corrupt(rnd), (k, v) => (typeof v === 'number' && !Number.isFinite(v) ? null : v))
    const s = parse(blob)
    if (!s || !s.ride) continue
    const once = normaliseRide(s.ride)
    assert.deepEqual(normaliseRide(once), once, 'seed ' + (9000 + i))
  }
})

test('a ride the invariant passes always has a floor above the car to press', () => {
  for (let i = 0; i < 3000; i++) {
    const rnd = mulberry32(4000 + i)
    const blob = JSON.stringify(corrupt(rnd), (k, v) => (typeof v === 'number' && !Number.isFinite(v) ? null : v))
    const s = parse(blob)
    if (!s || !s.ride || s.ride.inFlight) continue
    const r = s.ride
    if (r.phase === 'roof') { assert.equal(r.floor, 10); assert.equal(r.target, 10); continue }
    assert.ok(r.target > r.floor, `seed ${4000 + i}: target ${r.target} <= floor ${r.floor}`)
    assert.ok(r.target >= 1 && r.target <= 10, `seed ${4000 + i}: target ${r.target} out of range`)
    assert.ok(r.floor >= -1 && r.floor <= 9, `seed ${4000 + i}: floor ${r.floor}`)
    if (r.floor === -1) assert.ok(r.phase === 'repair' && r.problem && r.retrying, `seed ${4000 + i}: the pit without the Repair card`)
  }
})
