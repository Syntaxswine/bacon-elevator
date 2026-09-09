// HOSTILE REVIEW ROUND 6 — one test per confirmed finding, each written so it FAILS on the tree
// that was reviewed. Findings whose whole surface is geometry, painted ink or a real tap live in
// tools/drive-scenarios.mjs instead and are named where they sit: r6-math-01 (the display band),
// r6-math-02 (the Repair card at 320 px with Bigger text), r6-math-05 (the number line's tick
// labels), r6-mobile-ux-1 (the system Back gesture, its own `back-gesture` scenario), r6-mobile-ux-3
// (whether anything MEASURES the viewport height), r6-mobile-ux-4 (the ride's level name),
// r6-mobile-ux-5 (the Grown-ups rows), r6-mobile-ux-6 (the disabled backspace) and r6-mobile-ux-7
// (focus behind a dialog). r6-elevator-feel-03's on-screen half lives in the `roof-offer` scenario.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { mulberry32 } from '../src/rng.js'
import { LEVELS, customLevel } from '../src/levels.js'
import { makeProblem, initialCtx, afterAnswer, isIdentity, validProblem } from '../src/math.js'
import { explain, repair } from '../src/explain.js'
import { initialState, reduce, normaliseRide, nextTarget } from '../src/state.js'
import { migrate, serialize, parse } from '../src/save.js'
import { loadClimb } from '../src/climb.js'
import { loadFacts, TRIVIA_LIMITS, withinBand } from '../src/trivia.js'
import { sourcesReason } from '../src/gate.js'
import { roof, grownups } from '../src/render/screens.js'
import { tagFloors } from '../src/render/panel.js'
import { fresh, makeRng, startRide, answer, run, playBuilding } from './_helpers.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const CLIMB = loadClimb(JSON.parse(read('data/climb.json'))).rungs

// ---- r6-code-hostile-1 -------------------------------------------------------------------------
// `Try again` on the Repair card stables the pit to {floor:-1, phase:'keypad'} and SAVES it, and
// normaliseRide's pit guard admitted only 'repair'. Every re-entry into that state — the top bar's
// Lobby (phase 'keypad' is in STABLE, so it is live), a plain reload, the update chip's own reload
// — lifted the car out of the pit to the Ground floor, threw away the retry and its sum, and left
// `target` where the fall had put it, because line 107 only ever RAISED the target. From floor 9
// that made one fresh sum at G animate to floor 1, announce "Floor 1", and then land on the Roof.
function pitRide(floor) {
  return { floor: -1, target: floor + 1, phase: 'keypad', problem: { kind: 'add', a: 2, b: 3, answer: 5, text: '2 + 3 = ▮', key: 'add:2:3' }, retrying: true, tray: 4, banked: 0, cleared: [1, 2, 3], seed: 7, typed: '', typedWrong: '7', tries: 1, streak: 0, stepDowns: 0, falls: 1, draws: 0, passengersDone: [], fallFloor: floor }
}

test('r6-code-hostile-1: `Try again` leaves the car in the pit, with its sum and its ride home', () => {
  for (const floor of [1, 3, 8, 9]) {
    const n = normaliseRide(pitRide(floor))
    assert.equal(n.floor, -1, `the car walked out of the pit from floor ${floor}`)
    assert.equal(n.phase, 'keypad', 'the keypad retry became something else')
    assert.equal(n.target, floor + 1, 'the target moved')
    assert.equal(n.retrying, true, 'the express hoist home was lost')
    assert.equal(n.problem.key, 'add:2:3', 'the same sum was thrown away')
  }
  // ...and the repair card is untouched by the widening
  const rep = normaliseRide({ ...pitRide(3), phase: 'repair' })
  assert.equal(rep.floor, -1)
  assert.equal(rep.retrying, true)
  // A pit with NO sum is still not a place the car may be parked.
  const empty = normaliseRide({ ...pitRide(3), problem: null })
  assert.equal(empty.floor, 0)
  assert.equal(empty.phase, 'floor')
  assert.equal(empty.target, 1, 'the target was left above a car that is no longer in the pit')
})

test('r6-code-hostile-1: off the pit, the lit button is always the floor above the car', () => {
  // The class, not the instance: no re-entry may leave a car with a target it cannot reach in one
  // hop, whatever put the two out of step — this normaliser's own pit branch, or a hand-edited code.
  for (let floor = 0; floor <= 9; floor++) {
    for (const target of [0, 1, 4, 9, 10, 99, -3]) {
      const n = normaliseRide({ floor, target, phase: 'floor', problem: null, cleared: [], passengersDone: [] })
      if (n.phase === 'roof') continue
      assert.equal(n.target, nextTarget(n.floor), `floor ${floor}, target ${target} → ${n.target}`)
    }
  }
  // and through the save boundary, which is the route a pasted BE1- code takes
  const m = migrate({ v: 1, ride: { floor: 0, target: 10, phase: 'floor', tray: 0, banked: 0, cleared: [], passengersDone: [], seed: 1 } })
  assert.equal(m.ride.target, 1, 'a hand-edited save kept a target nine floors above the car')
})

test('r6-code-hostile-1: the whole route — fall, Try again, Lobby, Ride — is still one floor', () => {
  const rng = makeRng(21)
  let s = startRide(fresh(3, { seed: 21 }), rng)
  // climb to floor 3
  for (let i = 0; i < 3; i++) s = answer(s, rng, true).state
  assert.equal(s.ride.floor, 3)
  // fall: two wrong answers on one sum
  s = answer(s, rng, false).state
  s = answer(s, rng, false, { typed: s.ride.problem.answer + 2 }).state
  assert.equal(s.phase, 'repair')
  assert.equal(s.ride.floor, -1)
  const sameSum = s.ride.problem.key
  // `Try again`, then leave and come back (the Lobby tap; a reload takes the same route)
  s = run(s, { type: 'card-continue' }, rng).state
  assert.equal(s.phase, 'keypad')
  s = reduce(s, { type: 'to-lobby' }, rng).state
  s = run(s, { type: 'ride-start' }, rng).state
  assert.equal(s.ride.floor, -1, 'the car climbed out of the spiked pit by itself')
  assert.equal(s.ride.problem.key, sameSum, '`Same sum. Ride back up.` drew a different sum')
  assert.equal(s.ride.retrying, true)
  const before = { ...s.records }
  // the express hoist home lands on the floor it fell from + 1, and credits exactly that ride
  s = answer(s, rng, true).state
  assert.equal(s.ride.floor, 4)
  assert.equal(s.records.floors - before.floors, 5, 'the pit-to-floor-4 hoist is five floors')
  assert.equal(s.phase !== 'roof', true, 'one sum finished the building')
})

// ---- r6-code-hostile-2 -------------------------------------------------------------------------
// arrive() tallied `Math.abs(r.target - r.floor)` — the floor the ride was AIMING at, not the one
// the car reached — so a single one-floor hop could credit The Climb and the Logbook with ten
// floors and set `records.longest` to 10 for a ride the car never made.
test('r6-code-hostile-2: the Logbook counts the floors the car reached, never the ones it wanted', () => {
  const rng = makeRng(5)
  let s = startRide(fresh(9, { seed: 5 }), rng)
  // Force the desync the old normaliser produced: car at G, target at the Roof.
  s = { ...s, ride: { ...s.ride, floor: 0, target: 10 }, car: { ...s.car, floor: 0 } }
  s = run(s, { type: 'press-floor', floor: 10 }, rng).state
  // press-floor refuses a floor that is not the target+car+1 pair, so drive the sum from wherever
  // the reducer actually parked it; the point is what gets tallied for one `move`.
  if (s.phase === 'floor') s = { ...s, ride: { ...s.ride, target: nextTarget(s.ride.floor) } }
  const before = s.records.floors
  s = answer(s, rng, true).state
  assert.equal(s.records.floors - before, 1, 'one hop credited more than one floor')
  assert.equal(s.records.longest, 1, 'records.longest recorded a ride the car never made')
  assert.equal(s.ride.floor, 1)
})

// ---- r6-elevator-feel-02 -----------------------------------------------------------------------
// The roof card inferred "fresh" from an 11-floor window and a clean building is exactly 10 floors,
// so a rung on a multiple of 10 (the Woolworth's 60) printed on two consecutive roofs — the second
// time above a forward line that contradicted it. Taking only the LAST rung reached also swallowed
// Taipei 101 (101) and the Empire State (102), both overtaken by the Willis Tower (108) inside one
// building. Every rung crossed is announced; each is announced once.
test('r6-elevator-feel-02: every Climb rung is announced exactly once', () => {
  assert.ok(CLIMB.length >= 10, 'the Climb bank did not load')
  const rng = makeRng(21)
  let s = fresh(1, { seed: 21 })
  s = reduce(s, { type: 'load-climb', rungs: CLIMB }).state
  const printed = []
  for (let b = 0; b < 20; b++) {
    s = startRide(s, rng)
    s = playBuilding(s, rng)
    const html = roof(s)
    for (const m of html.matchAll(/data-climb-reached="([^"]+)"/g)) printed.push(m[1])
    s = run(s, { type: 'next-building' }, rng).state
  }
  const dupes = printed.filter((id, i) => printed.indexOf(id) !== i)
  assert.deepEqual(dupes, [], `a Climb rung was announced twice: ${dupes.join(', ')}`)
  // and nothing already crossed is silently skipped
  const crossed = CLIMB.filter((r) => r.floors <= s.records.floors).map((r) => r.id)
  assert.deepEqual(printed.slice().sort(), crossed.slice().sort(), 'a rung the child crossed was never announced')
})

test('r6-elevator-feel-02: a save written before the ledger existed does not dump its backlog', () => {
  const rng = makeRng(4)
  // 154 floors ridden, no climbShown field at all — the shape every existing save has.
  const old = migrate({ v: 1, records: { floors: 154, rides: 40, longest: 10, passengers: 3 }, buildings: 15 })
  assert.equal(old.climbShown, null, 'an absent ledger must stay absent so arrive() can seed it')
  let s = reduce(reduce(old, { type: 'load-facts', facts: [] }).state, { type: 'load-climb', rungs: CLIMB }).state
  s = reduce(s, { type: 'set-seed', seed: 4 }).state
  s = playBuilding(startRide(s, rng), rng)
  const printed = [...roof(s).matchAll(/data-climb-reached="([^"]+)"/g)].map((m) => m[1])
  assert.ok(printed.length <= 1, `the first roof after the upgrade printed ${printed.length} rungs`)
  assert.ok(Array.isArray(s.climbShown) && s.climbShown.length >= 9, 'the ledger was not seeded from the floors already ridden')
  // and it survives the save boundary
  const round = parse(serialize(s))
  assert.deepEqual(round.climbShown, s.climbShown)
})

// ---- r6-math-04 --------------------------------------------------------------------------------
// explainMissAdd took the count-up branch for every c ≤ 20 regardless of the gap, so `2 + ▮ = 20`
// modelled counting eighteen ones — the worst available method — directly above the clause that
// names the right one. Every sibling branch in the file bounds its counted run; this one did not.
test('r6-math-04: no worked line counts more than nine numbers one at a time', () => {
  const runOf = (text) => {
    const m = /: ((?:−?\d+, )*−?\d+)/.exec(text)
    return m ? m[1].split(',').length : 0
  }
  // the reported case, and the method it should model instead
  assert.deepEqual(explain({ kind: 'missAdd', a: 2, c: 20, answer: 18 }).map((s) => s.text), ['2 + 8 = 10', '10 + 10 = 20', '8 + 10 = 18'])
  assert.deepEqual(explain({ kind: 'missAdd', a: 6, c: 18, answer: 12 }).map((s) => s.text), ['6 + 4 = 10', '10 + 8 = 18', '4 + 8 = 12'])
  // small gaps still count up: that is what the branch is for
  assert.ok(explain({ kind: 'missAdd', a: 15, c: 18, answer: 3 })[0].text.startsWith('From 15 count up to 18'))
  // THE CLASS: sweep every missAdd the shipped ladder and Custom can serve
  const rng = mulberry32(11)
  const levels = [customLevel({ ops: ['missAdd'], min: 0, max: 20 }), customLevel({ ops: ['missAdd'], min: 0, max: 100 })]
  let worst = 0
  for (let a = 0; a <= 20; a++) for (let c = a; c <= 20; c++) {
    const p = { kind: 'missAdd', a, b: c - a, c, answer: c - a, text: `${a} + ▮ = ${c}`, key: `missAdd:${a}:${c - a}` }
    for (const s of explain(p)) worst = Math.max(worst, runOf(s.text))
    assert.ok(repair(p, String(p.answer + 1)).worked.length <= 110)
  }
  for (const lv of levels) {
    let ctx = initialCtx()
    for (let i = 0; i < 4000; i++) {
      const p = makeProblem(lv, 1, ctx, rng)
      for (const s of explain(p)) worst = Math.max(worst, runOf(s.text))
      ctx = afterAnswer(ctx, p, true)
    }
  }
  assert.ok(worst <= 9, `a worked line counts ${worst} numbers one at a time`)
})

// ---- r6-math-06 --------------------------------------------------------------------------------
// countOnBy / countBackBy had no cap on n, so a Custom ceiling above ~2000 produced `Count back in
// 100s from 9110: …` listing 76 four-digit numbers (484 characters) on a card 296 px wide.
test('r6-math-06: a big Custom ceiling cannot list a page of numbers', () => {
  const runOf = (text) => { const m = /: ((?:−?\d+, )*−?\d+)/.exec(text); return m ? m[1].split(',').length : 0 }
  assert.deepEqual(explain({ kind: 'sub', a: 9110, b: 7600, answer: 1510 }).map((s) => s.text), ['9110 − 7000 = 2110', '2110 − 600 = 1510'])
  const rng = mulberry32(3)
  for (const max of [500, 2000, 9999]) {
    const lv = customLevel({ ops: ['add', 'sub'], min: 0, max })
    let ctx = initialCtx()
    for (let i = 0; i < 3000; i++) {
      const p = makeProblem(lv, 1, ctx, rng)
      for (const s of explain(p)) assert.ok(runOf(s.text) <= 9, `Largest ${max}: "${s.text}" lists ${runOf(s.text)} numbers`)
      ctx = afterAnswer(ctx, p, true)
    }
  }
})

// ---- r6-math-03 --------------------------------------------------------------------------------
// A single-op Custom table can be smaller than the 20-key ring — `× only, Largest 20` is ten sums —
// which round 3 ruled legitimate. What was NOT legitimate: once the ring can never be satisfied,
// all fifty attempts fail and EVERY question comes out of the unguarded fallback, so the
// same-answer rule, the doubles fuse and the zero fuse stopped being consulted too. The guard is
// now satisfiable: the ring window shortens until a draw can pass it, and the weaker fuses bind.
test('r6-math-03: a pool smaller than the ring does not switch off the other fuses', () => {
  const cases = [
    { ops: ['mul'], min: 2, max: 20 },
    { ops: ['div'], min: 2, max: 20 },
    { ops: ['add'], min: 0, max: 6 },
  ]
  for (const knobs of cases) {
    const lv = customLevel(knobs)
    const rng = mulberry32(9)
    let ctx = initialCtx()
    let prev = null, sameAnswer = 0, doublesLit = 0, identities = 0, sameKey = 0, n = 0
    for (let i = 0; i < 8000; i++) {
      const p = makeProblem(lv, 1, ctx, rng)
      if (prev) {
        n++
        if (p.answer === prev.answer) sameAnswer++
        if (p.key === prev.key) sameKey++
      }
      if (ctx.sameSeen > 0 && p.a === p.b && !p.pair) doublesLit++
      if (ctx.zeroSeen > 0 && isIdentity(p)) identities++
      prev = p
      ctx = afterAnswer(ctx, p, true)
    }
    const label = knobs.ops.join('+') + ' ' + knobs.max
    assert.equal(sameKey, 0, `${label}: the same sum twice running`)
    assert.ok(sameAnswer / n < 0.02, `${label}: the same answer twice running on ${(100 * sameAnswer / n).toFixed(1)} % of questions`)
    assert.equal(doublesLit, 0, `${label}: ${doublesLit} doubles served while the doubles fuse was lit`)
    assert.equal(identities, 0, `${label}: ${identities} identities served while the zero fuse was lit`)
  }
})

test('r6-math-03: the shortened ring never engages on a shipped level', () => {
  // The window may only shorten where the FULL ring cannot be satisfied, so no shipped level's rng
  // cascade moves by a single draw. The ring is breached exactly when a shorter window was used, so
  // zero breaches over the whole ladder IS the assertion that nothing shipped changed — and it is
  // the same measurement tools/headless-play.mjs reports as `repeat%` (0.00 on all five levels).
  for (const level of LEVELS) {
    for (let step = 1; step <= level.steps.length; step++) {
      const rng = mulberry32(42)
      let ctx = initialCtx()
      const keys = []
      for (let i = 0; i < 600; i++) { const p = makeProblem(level, step, ctx, rng); keys.push(p.key); ctx = afterAnswer(ctx, p, true) }
      for (let i = 20; i < keys.length; i++) {
        assert.ok(!keys.slice(i - 20, i).includes(keys[i]), `${level.id} step ${step}: the ring was breached at draw ${i} (${keys[i]}) — the shortened window ran on a shipped level`)
      }
    }
  }
  // ...and the default Custom level, which is what a grown-up gets before touching anything
  const rng = mulberry32(42)
  let ctx = initialCtx()
  const keys = []
  const lv = customLevel({ ops: ['add', 'sub'], min: 2, max: 20 })
  for (let i = 0; i < 600; i++) { const p = makeProblem(lv, 1, ctx, rng); keys.push(p.key); ctx = afterAnswer(ctx, p, true) }
  for (let i = 20; i < keys.length; i++) assert.ok(!keys.slice(i - 20, i).includes(keys[i]), `Custom defaults: the ring was breached at draw ${i}`)
})

// ---- r6-code-hostile-5 -------------------------------------------------------------------------
// validProblem checked the arithmetic of an imported save's problem but accepted any `text` that
// merely contained ▮, so a hand-crafted BE1- code could put 614 characters of a stranger's words on
// the display band. The text is deterministic from kind/a/b/c: recompute it rather than trust it.
test('r6-code-hostile-5: the display band can only ever show a sum the generator could have drawn', () => {
  const p = validProblem({ kind: 'add', a: 1, b: 1, answer: 2, text: 'BUY GOLD NOW ▮ ' + 'X'.repeat(600), key: 'add:1:1' })
  assert.ok(p, 'a legal sum was refused')
  assert.equal(p.text, '1 + 1 = ▮')
  // every problem the game itself draws already satisfies it, so nothing shipped changes
  const rng = mulberry32(13)
  const lv = customLevel({ ops: ['add', 'sub', 'mul', 'div', 'missAdd', 'up', 'down'], min: 0, max: 144 })
  let ctx = initialCtx()
  for (let i = 0; i < 5000; i++) {
    const q = makeProblem(lv, 1, ctx, rng)
    assert.equal(validProblem(q).text, q.text, `the generator's own text was rewritten: ${q.text}`)
    ctx = afterAnswer(ctx, q, true)
  }
})

// ---- r6-code-hostile-4 -------------------------------------------------------------------------
// A ? badge marks a passenger the child can still meet. tagFloors() read the CURRENT cadence and
// `passengersDone` only, with no reference to the car, so a grown-up switching Passengers mid-
// building put a badge on floors the car had already passed — a promise the building cannot keep.
test('r6-code-hostile-4: no ? badge at or below the car', () => {
  const base = { pool: [{ id: 'x' }], settings: { passengers: 'often' } }
  const ride = (floor) => ({ floor, target: floor + 1, passengersDone: [] })
  assert.deepEqual(tagFloors({ ...base, ride: ride(0) }), [3, 6, 9])
  // the switch from Sometimes to Often at floor 5: 3 is behind the car and may not be marked
  assert.deepEqual(tagFloors({ ...base, ride: ride(5) }), [6, 9])
  assert.deepEqual(tagFloors({ ...base, ride: ride(9) }), [])
  // no ride at all (the lobby preview) still marks the whole building
  assert.deepEqual(tagFloors({ ...base, ride: null }), [3, 6, 9])
  // ...and the badge still marks every floor the car can actually reach, on both cadences
  for (const passengers of ['often', 'sometimes']) {
    for (let f = 0; f <= 9; f++) {
      const tags = tagFloors({ ...base, settings: { passengers }, ride: ride(f) })
      for (const t of tags) assert.ok(t > f, `floor ${t} tagged with the car at ${f}`)
    }
  }
})

// ---- r6-code-hostile-3 -------------------------------------------------------------------------
// A LIT, UNDIMMED KEY THAT DOES NOTHING IS A DEAD KEY — the rule the panel already enforces on GO,
// on the backspace and on the digit cap. Every Grown-ups stepper drew both buttons live at its
// limits with an out-of-range data-value; set-setting clamped, saved, and nothing on screen moved.
test('r6-code-hostile-3: a stepper at its limit is dead, and only where the reducer would refuse', () => {
  // Read the two stepper buttons for one setting straight out of the rendered Grown-ups page.
  const buttons = (html, key) => html.split('<button ').slice(1)
    .filter((chunk) => chunk.includes(`data-setting="${key}" `) && /^[^>]*>[−+]</.test(chunk))
    .map((chunk) => ({ dead: /^[^>]*\bdisabled\b/.test(chunk.split('>')[0]), value: Number(/data-value="(-?\d+)"/.exec(chunk)[1]), glyph: /^[^>]*>(.)</.exec(chunk)[1] }))
  const at = (mut) => { let s = initialState(1); s = reduce(s, { type: 'load-facts', facts: [] }).state; return grownups(mut(s)) }
  const set = (s, key, value) => reduce(s, { type: 'set-setting', key, value }).state

  // volume floor and ceiling
  let html = at((s) => set(s, 'volume', 0))
  assert.deepEqual(buttons(html, 'volume').map((b) => b.dead), [true, false], 'Volume − at 0 is still live')
  html = at((s) => set(s, 'volume', 100))
  assert.deepEqual(buttons(html, 'volume').map((b) => b.dead), [false, true], 'Volume + at 100 is still live')
  html = at((s) => set(s, 'volume', 50))
  assert.deepEqual(buttons(html, 'volume').map((b) => b.dead), [false, false], 'Volume is dead in the middle of its range')

  // pinned step, which only exists with Adaptive off
  html = at((s) => set(set(s, 'adaptive', false), 'pinnedStep', 1))
  assert.deepEqual(buttons(html, 'pinnedStep').map((b) => b.dead), [true, false])
  html = at((s) => set(set(s, 'adaptive', false), 'pinnedStep', 3))
  assert.deepEqual(buttons(html, 'pinnedStep').map((b) => b.dead), [false, true])

  // the custom numbers, whose bounds depend on each other
  html = at((s) => set(s, 'custom.min', 0))
  assert.deepEqual(buttons(html, 'custom.min').map((b) => b.dead), [true, false], 'Smallest − at 0 is still live')
  html = at((s) => set(s, 'custom.max', 9999))
  assert.deepEqual(buttons(html, 'custom.max').map((b) => b.dead), [false, true], 'Largest + at 9999 is still live')

  // NO BUTTON EVER CARRIES A VALUE THE REDUCER WOULD REFUSE, at any reachable setting.
  for (const [key, values, delta] of [['volume', [0, 10, 50, 90, 100], 10], ['custom.min', [0, 5, 10], 5], ['custom.max', [4, 20, 100, 9995, 9999], 5]]) {
    for (const v of values) {
      const s0 = set(reduce(initialState(1), { type: 'load-facts', facts: [] }).state, key, v)
      for (const b of buttons(grownups(s0), key)) {
        const after = set(s0, key, b.value)
        const now = key === 'volume' ? after.settings.volume : after.settings.custom[key.slice(7)]
        const was = key === 'volume' ? s0.settings.volume : s0.settings.custom[key.slice(7)]
        assert.equal(b.dead, now === was, `${key} at ${was}: ${b.glyph} says dead=${b.dead} but the reducer moves it to ${now}`)
      }
    }
  }
})

// ---- r6-elevator-feel-03 -----------------------------------------------------------------------
// Tapping past the offer defers it by design and leaves `step3Run` alone, so the identical sentence
// came back on every clean roof — eight in a row, measured, while the sums stayed where they were.
test('r6-elevator-feel-03: an offer that has already stood does not read as the same unanswered question', () => {
  const base = { ...initialState(1), level: 'corner', ride: { tray: 0 }, climb: [], records: { floors: 0 } }
  const card = (offerRun, dir = 'up', offer = 'hotel') => roof({ ...base, roof: { gained: 4, bonus: 3, unlocked: [], plaques: [], offer, dir, offerRun, help: false, lunchboxBefore: 0 } })
  const q = (html) => /<p class="offerq" data-offer-q>([^<]*)</.exec(html)[1]
  assert.match(q(card(0)), /^Ready for Hotel/)
  assert.notEqual(q(card(1)), q(card(0)))
  assert.match(q(card(1)), /still there whenever you want it/)
  assert.match(q(card(1)), /Try it\?$/)
  assert.match(q(card(1, 'down', 'corner')), /Go back\?$/)
  // and the offer is still an offer: both answers are still on the card, at both wordings
  for (const run of [0, 1, 7]) for (const which of ['yes', 'stay']) assert.match(card(run), new RegExp(`data-offer="${which}"`))
})

test('r6-elevator-feel-03: offerRun counts the roofs the offer has already stood on', () => {
  const rng = makeRng(11)
  let s = fresh(2, { seed: 11 })
  s = reduce(s, { type: 'set-setting', key: 'adaptive', value: true }).state
  const runs = []
  for (let b = 0; b < 8; b++) {
    s = playBuilding(startRide(s, rng), rng)
    if (s.roof.offer) runs.push(s.roof.offerRun)
    s = run(s, { type: 'next-building' }, rng).state   // tap PAST the offer, which defers it
  }
  assert.ok(runs.length >= 3, `the ladder never offered a promotion in eight clean buildings (${runs.length})`)
  assert.equal(runs[0], 0, 'the first showing is not marked as a repeat')
  assert.ok(runs[1] >= 1, 'a second showing of the same offer is not marked as a repeat')
})

// ---- r6-trivia-truth-02 ------------------------------------------------------------------------
// Four items listed the same URL twice under titles differing only by a parenthetical, so the fact
// card printed two `Source: X (domain)` lines that read as two independent documents for one — the
// shape r2-autism-fit-09 already refused for the two verification lenses, on the surface the child
// actually sees. Enforced in src/gate.js, so all three banks get it.
test('r6-trivia-truth-02: two Source lines are two documents', () => {
  for (const [file, key] of [['data/trivia.json', 'items'], ['data/parts.json', 'cards'], ['data/climb.json', 'items']]) {
    const bank = JSON.parse(read(file))
    const rows = Array.isArray(bank) ? bank : (bank[key] || bank.items || [])
    assert.ok(rows.length, `${file} carries nothing`)
    for (const it of rows) {
      const urls = (it.sources || []).map((s) => String(s.url || '').toLowerCase())
      assert.equal(new Set(urls).size, urls.length, `${file}: ${it.id} cites one document twice`)
    }
  }
  // ...and the gate refuses it, so a new item cannot reintroduce it
  const same = [{ title: 'A', url: 'https://x.test/a', quote: 'q' }, { title: 'A (second bit)', url: 'https://x.test/a', quote: 'q2' }]
  assert.match(String(sourcesReason(same)), /same document/)
  assert.equal(sourcesReason([{ title: 'A', url: 'https://x.test/a', quote: 'q' }, { title: 'B', url: 'https://x.test/b', quote: 'q' }]), null)
})

// ---- r6-trivia-truth-03 ------------------------------------------------------------------------
// docs/TRIVIA.md step 2 says the confirming checker had to fetch an INDEPENDENT source, and the
// bank's own rule string discloses only the 32 refute-lens re-reads. One item's confirm lens pointed
// at the item's own primary citation, so it had no independent confirming reader at all.
test('r6-trivia-truth-03: no confirming lens re-reads the item it is confirming', () => {
  const bank = JSON.parse(read('data/trivia.json'))
  const bad = []
  for (const it of bank.items) {
    const c = (it.verification || []).find((v) => v.lens === 'confirm')
    if (c && it.sources.some((s) => s.url === c.source_url)) bad.push(it.id)
  }
  assert.deepEqual(bad, [], `the confirming lens read the item's own citation: ${bad.join(', ')}`)
})

// ---- r6-trivia-truth-04 ------------------------------------------------------------------------
// §3042 carries `EXCEPTION: Existing traction elevators with two hoisting ropes.`, so `the fewest a
// traction elevator is allowed to hang from` was true only of NEW installations.
test('r6-trivia-truth-04: the three-ropes question says which case it asks about', () => {
  const it = JSON.parse(read('data/trivia.json')).items.find((i) => i.id === 'elevator-engineering-minimum-three-ropes')
  assert.match(it.question, /\bNEW\b/, 'the question still reads as if it covered every traction elevator')
  assert.match(it.fact, /already running on two may keep them/, 'the fact does not carry the exception')
  assert.match(it.sources[0].quote, /EXCEPTION/, 'the quote stops before the clause that qualifies it')
})

// ---- r6-math-07 --------------------------------------------------------------------------------
// `withinNumberBand` fires only on a declared `maths.max`, so an item whose options are 86,400 /
// 3,600 / 1,440 / 864,000 was served at Corner Shop's `numbers to 10`. Telling 86,400 from 864,000
// is place value at that magnitude, which is exactly what the band is for.
test('r6-math-07: no banded level asks a place-value question above its own ceiling', () => {
  const bank = JSON.parse(read('data/trivia.json'))
  const { facts } = loadFacts(bank)
  const num = (x) => { const s = String(x).replace(/,/g, ''); return /^\d+$/.test(s) ? Number(s) : null }
  for (const level of ['corner', 'hotel', 'office', 'sky']) {
    const limits = TRIVIA_LIMITS[level]
    for (const f of facts.filter((x) => withinBand(x, limits))) {
      // `large-numbers` is a DECLARED concept, and each level says whether it admits one: Corner
      // Shop and Hotel deny it outright, Office Block and Skyscraper take it deliberately. This
      // rule is about a big-number question arriving under some other label — the seconds item
      // declared `counting` and was served at `numbers to 10`.
      if (f.concept === 'large-numbers') continue
      const ns = [f.answer, ...f.distractors].map(num).filter((n) => n !== null && n > limits.maxNumber)
      // two options that are the same digits at a different place value: the whole question is then
      // reading the size of a number the level has never put on the panel
      for (const a of ns) for (const b of ns) {
        if (a >= b) continue
        assert.ok(!(b % a === 0 && [10, 100, 1000].includes(b / a)), `${level}: ${f.id} offers ${a} against ${b}`)
      }
    }
  }
  assert.ok(!facts.filter((f) => withinBand(f, TRIVIA_LIMITS.corner)).some((f) => f.id === 'math-numbers-seconds-in-a-day'))
  // the band must still be a pool, not a loop
  for (const level of ['corner', 'hotel']) assert.ok(facts.filter((f) => withinBand(f, TRIVIA_LIMITS[level])).length >= 16)
})

// ---- r6-math-08 --------------------------------------------------------------------------------
test('r6-math-08: no maths question offers two options that can both be right', () => {
  const it = JSON.parse(read('data/trivia.json')).items.find((i) => i.id === 'math-everyday-honeycomb-hexagon')
  const opts = [it.answer, ...it.distractors]
  assert.ok(!(opts.includes('Square') && opts.includes('Rectangle')), 'every square is a rectangle')
  assert.equal(new Set(opts).size, opts.length)
})

// ---- r6-deploy-pages-1 -------------------------------------------------------------------------
// ci.yml's header said "This is that gate, run by the deploy". Pages here is a BRANCH source, so it
// publishes whatever lands on main in parallel with the run and regardless of its outcome; the
// workflow has no deploy job and no `environment: github-pages`, so it structurally cannot gate the
// publish. In this repo's own vocabulary a gate REFUSES, and the one file a maintainer reads to
// decide whether they must run `npm test` before pushing said the machine already had.
test('r6-deploy-pages-1: the tests workflow does not claim to gate the publish', () => {
  const ci = read('.github/workflows/ci.yml')
  assert.ok(!/This is that gate, run by the deploy/.test(ci), 'ci.yml still claims to be the deploy gate')
  assert.match(ci, /ALARM, NOT A GATE/, 'ci.yml does not say what it actually is')
  // and it must not have quietly become a gate in name only either: a real one needs both of these
  const gates = /deploy-pages|environment:\s*github-pages/.test(ci)
  assert.equal(gates, /needs:\s*test/.test(ci), 'a deploy job without `needs: test` is worse than no deploy job')
  // the command it names is the command package.json actually runs
  assert.match(ci, /node --test "test\/\*\*\/\*\.test\.js"/, 'ci.yml describes a different test command from package.json')
  assert.match(read('package.json'), /node --test \\"test\/\*\*\/\*\.test\.js\\"/)
})

// ---- r6-deploy-pages-2 -------------------------------------------------------------------------
// Cache Storage and getRegistrations() are ORIGIN-scoped, not path-scoped, and ?reset=1 swept both
// unfiltered: a neighbouring app on syntaxswine.github.io would lose its offline copy and its
// worker to a reset pressed here. sw.js's own activate handler has filtered on `be-` all along.
test('r6-deploy-pages-2: a reset touches only this game', () => {
  const main = read('src/main.js')
  const block = /if \(params\.get\('reset'\) === '1'\) \{[\s\S]*?\n\}/.exec(main)
  assert.ok(block, 'the reset branch moved')
  assert.match(block[0], /caches\.keys\(\)[\s\S]*?startsWith\('be-'\)/, 'the reset still deletes every cache on the origin')
  assert.match(block[0], /getRegistrations\(\)[\s\S]*?\.scope === SCOPE/, 'the reset still unregisters every worker on the origin')
  // the prefix is the one sw.js names its caches with, not a second spelling of it
  assert.match(read('sw.js'), /const CACHE = 'be-' \+ VERSION/)
})

// ---- r6-deploy-pages-3 -------------------------------------------------------------------------
// The 404 page is served at any depth, so `./favicon.ico` resolved against the missing path and
// asked for a file that is not there: one 404 request per deep-path visit, and a blank tab icon
// anyway. Hard-coding the site root is refused on this page (test/dom-contract.test.js), so the
// static href fetches nothing and the script that already computes the project root sets the real
// one. r6-deploy-pages-4 (the same page's back link, with JavaScript off) is skipped for the same
// reason — see docs/REVIEW-LOG.md, round 6.
test('r6-deploy-pages-3: the 404 page never requests a favicon that is not there', () => {
  const html = read('404.html')
  const icon = /<link rel="icon"[^>]*href="([^"]*)"/.exec(html)
  assert.ok(icon, 'the icon link moved')
  assert.ok(!/^\.\//.test(icon[1]), `the favicon is still depth-relative: ${icon[1]}`)
  assert.ok(/^data:/.test(icon[1]), `the static favicon href must fetch nothing: ${icon[1]}`)
  assert.match(html, /id="icon"/)
  assert.match(html, /getElementById\('icon'\)\.setAttribute\('href', root \+ 'favicon\.ico'\)/, 'nothing points the icon at the project root')
  // ...and the way out is still computed, not hard-coded (the rule this page has carried all along)
  assert.match(html, /<a class="btn" id="back" href="\.\/"/)
  assert.match(html, /getElementById\('back'\)\.setAttribute\('href', root\)/)
})
