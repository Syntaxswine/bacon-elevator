// HOSTILE REVIEW ROUND 5 — one test per confirmed finding, each written so it FAILS on the tree
// that was reviewed. Findings whose whole surface is geometry, occlusion or a real tap live in
// tools/drive-scenarios.mjs instead and are named where they sit: r5-mobile-ux-1 (the update chip
// sideways), r5-autism-fit-2 (the hint's tick labels), r5-autism-fit-3 and r5-mobile-ux-2 (the top
// bar), and the on-screen half of r5-autism-fit-1 / r5-elevator-feel-01 (the roof card's hierarchy).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { mulberry32 } from '../src/rng.js'
import { LEVELS, LEVEL_ORDER, levelById, levelBound, customLevel, ADD_FLOOR } from '../src/levels.js'
import { makeProblem, initialCtx, stepOf, stepNote, isIdentity, adaptStep } from '../src/math.js'
import { explain } from '../src/explain.js'
import { initialState, reduce, currentLevel, carryBanks, RUNTIME_BANKS, UP_AGAIN } from '../src/state.js'
import { serialize, parse, migrate, encodeCode } from '../src/save.js'
import { roof, lobby, factSheet, stepbar } from '../src/render/screens.js'
import { fresh, makeRng, startRide, answer, answerTrivia, run, playBuilding, FACTS } from './_helpers.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

// ---- r5-math-01 ------------------------------------------------------------------------------
// explainAdd took the three-column split whenever EITHER operand was 3-digit and always emitted
// `hundreds(a) + hundreds(b)` first, so with the second operand under 100 the FIRST line — which is
// the only line HINT shows — was `X00 + 0 = X00`: true, naming neither number in the question and
// moving nothing. 41 % of Megatall step-1 draws, the step `Try Megatall?` lands on and the step a
// fall cannot leave. explainSub's mirror branch has filtered its empty columns all along.
test('r5-math-01: no worked line adds nothing', () => {
  const texts = (a, b) => explain({ kind: 'add', a, b, answer: a + b }).map((s) => s.text)
  assert.deepEqual(texts(168, 6), ['Start at 168, count 6 more: 169, 170, 171, 172, 173, 174'])
  assert.deepEqual(texts(871, 9)[0].slice(0, 26), 'Start at 871, count 9 more')
  assert.deepEqual(texts(600, 34), ['600 + 30 = 630', '630 + 4 = 634'])
  assert.deepEqual(texts(110, 90), ['Count on in 10s from 110: 120, 130, 140, 150, 160, 170, 180, 190, 200'])
  // both operands 3-digit still get the column split, which is what that branch is for
  assert.deepEqual(texts(345, 527), ['300 + 500 = 800', '40 + 20 = 60', '5 + 7 = 12', '800 + 60 + 12 = 872'])

  // THE CLASS, NOT THE INSTANCES: sweep every add the game can serve and refuse any clause that
  // adds, takes away or multiplies by nothing — unless the QUESTION itself carries the zero.
  const zeroTerm = /(^|[^\d−-])0 [+−×] |[+−×] 0 = /
  let checked = 0
  for (let a = 1; a <= 999; a += 1) {
    for (const b of [1, 2, 6, 9, 11, 34, 59, 89, 90, 99, 111, 527, 899]) {
      if (a + b > 9999) continue
      for (const kind of ['add', 'up']) {
        for (const s of explain({ kind, a, b, answer: a + b })) {
          assert.ok(!zeroTerm.test(s.text), `${kind} ${a} + ${b}: a worked line adds nothing: ${s.text}`)
          checked++
        }
      }
    }
  }
  assert.ok(checked > 20000, `only ${checked} lines checked`)
})

// ---- r5-math-02 ------------------------------------------------------------------------------
// The announcement was derived from the SIGN of the step alone. Measured over 20 000 draws either
// side of every transition, "Bigger numbers now." is followed by a smaller number most of the time
// at three of the ten step-ups (Office 1→2 drops `tens ± tens`, max 100, for the 3s and 4s, max 40),
// and the mirror lands on the floor screen straight after a fall.
function sample(level, step, n, salt) {
  const rng = mulberry32(salt)
  let ceiling = 0, total = 0
  for (let i = 0; i < n; i++) {
    const p = makeProblem(level, step, initialCtx(), rng)
    const big = Math.max(Math.abs(p.a), Math.abs(p.b), Math.abs(p.answer), Math.abs(p.c || 0))
    ceiling = Math.max(ceiling, big); total += big
  }
  return { ceiling, mean: total / n }
}
test('r5-math-02: a step change names the thing that actually changed', () => {
  const seen = new Set()
  for (const level of LEVELS) {
    for (let from = 1; from <= level.steps.length; from++) {
      for (const to of [from - 1, from + 1]) {
        if (to < 1 || to > level.steps.length) continue
        const note = stepNote(level, from, to)
        assert.ok(note, `${level.id} ${from}→${to} says nothing`)
        seen.add(note)
        const a = sample(level, from, 4000, 11), b = sample(level, to, 4000, 11)
        // The one sentence that IS a claim about size may only be used where size rises.
        if (note === 'Bigger numbers now.') assert.ok(b.ceiling > a.ceiling && b.mean > a.mean, `${level.id} ${from}→${to}: "${note}" over ${a.mean.toFixed(1)} → ${b.mean.toFixed(1)} (ceiling ${a.ceiling} → ${b.ceiling})`)
        if (note === 'Smaller numbers for a bit.') assert.ok(b.ceiling < a.ceiling && b.mean < a.mean, `${level.id} ${from}→${to}: "${note}" over ${a.mean.toFixed(1)} → ${b.mean.toFixed(1)}`)
        // …and a sentence that names a kind may only be used where that kind is new.
        const kinds = (st) => new Set(stepOf(level, st).kinds.map((k) => k.kind))
        const arrived = (k) => kinds(to).has(k) && !kinds(from).has(k)
        if (note === 'Times tables now.') assert.ok(arrived('mul'), `${level.id} ${from}→${to}: no × row arrives`)
        if (note === 'Sharing now.') assert.ok(arrived('div'), `${level.id} ${from}→${to}: no ÷ row arrives`)
        if (note === 'Missing numbers now.') assert.ok(arrived('missAdd') || arrived('missMul'), `${level.id} ${from}→${to}: no missing-number row arrives`)
        if (note === 'Below zero now.') assert.ok(stepOf(level, to).kinds.some((k) => k.negatives) && !stepOf(level, from).kinds.some((k) => k.negatives), `${level.id} ${from}→${to}: nothing goes below zero`)
        if (note === 'Carrying now.') {
          const reg = (st) => Math.max(0, ...stepOf(level, st).kinds.map((k) => (Number.isInteger(k.regroups) ? k.regroups : k.regroup === true ? 1 : 0)))
          assert.ok(reg(to) > reg(from), `${level.id} ${from}→${to}: no new regrouping`)
        }
      }
    }
  }
  assert.ok(seen.size >= 5, `only ${seen.size} distinct sentences across ten transitions`)
  // and the reducer says it, not just the module
  const rng = makeRng(5)
  let s = { ...fresh(5), level: 'office', step: 1, adaptive: true }
  s = startRide(s, rng)
  let note = ''
  for (let i = 0; i < 12 && !note; i++) { s = answer(s, rng, true).state; note = s.stepNote; if (s.phase === 'trivia') s = answerTrivia(s, rng, true) }
  assert.equal(note, 'Times tables now.', 'the reducer still announces size at Office Block 1 → 2')
  // …and the instrument reads the list from the module rather than keeping its own copy of it: two
  // hard-coded strings in tools/drive-scenarios.mjs went red on the truth and green on the old lie.
  assert.match(read('tools/drive-scenarios.mjs'), /STEP_NOTE_WORDS \} from '\.\.\/src\/math\.js'/, 'the drive re-spells the sentences it is measuring')
  assert.match(read('tools/drive-scenarios.mjs'), /const STEP_NOTES = new Set\(STEP_NOTE_WORDS\)/)
})

// ---- r5-code-hostile-02 -----------------------------------------------------------------------
// Custom is `steps: [{kinds}]` and stepOf() clamps, so steps 1, 2 and 3 are the SAME table object.
// The pips still moved 1 → 2 → 3, "Bigger numbers now." was announced over it, and the chip told a
// screen reader "step 2 of 3" about a level that has one step.
test('r5-code-hostile-02: a level with one band announces no step change and draws no ladder', () => {
  const custom = customLevel({})
  assert.equal(custom.steps.length, 1)
  assert.equal(stepOf(custom, 1), stepOf(custom, 3), 'the three steps are one table')
  assert.equal(stepNote(custom, 1, 2), '', 'a promotion over an unchanged table was announced')
  assert.equal(stepNote(custom, 2, 1), '', 'a demotion over an unchanged table was announced')
  assert.equal(stepbar(2, '', 1), '', 'three pips for a level with one band')
  assert.match(stepbar(2, '', 3), /step 2 of 3/)
  // through the reducer: three right answers on Custom move the step and say nothing
  const rng = makeRng(13)
  let s = reduce(fresh(13), { type: 'set-level', id: 'custom' }, rng).state
  s = startRide(s, rng)
  let notes = 0, steps = new Set()
  for (let i = 0; i < 12; i++) {
    if (s.phase === 'trivia') { s = answerTrivia(s, rng, true); continue }
    if (s.phase !== 'floor' && s.phase !== 'keypad') break
    s = answer(s, rng, true).state
    steps.add(s.step)
    if (s.stepNote) notes++
  }
  assert.ok(steps.size > 1, 'the fixture never moved the step at all')
  assert.equal(notes, 0, 'Custom announced a step change over a table that cannot change')
  // and the ride's own chip hides the bar rather than freezing it
  assert.match(read('src/main.js'), /sb\.hidden = nsteps <= 1/, 'the ride top bar still draws three pips for a one-band level')
})

// ---- r5-math-03 ------------------------------------------------------------------------------
// The one rescue at the bottom of the ladder promised "the numbers smaller still", and no reachable
// Grown-ups setting delivers that: Corner Shop step 1 tops out at 5, and the lowest table the
// steppers can build tops out at ADD_FLOOR = 6.
test('r5-math-03: the roof help line promises only what Grown-ups can do', () => {
  const corner = sample(levelById('corner'), 1, 20000, 3)
  let best = Infinity, bestMean = Infinity
  const OPS = ['add', 'sub', 'mul', 'div', 'missAdd', 'up', 'down']
  for (let mask = 1; mask < 128; mask++) {
    const ops = OPS.filter((_, i) => mask & (1 << i))
    const lv = customLevel({ ops, min: 0, max: 2 })
    const m = sample(lv, 1, 400, 3)
    best = Math.min(best, m.ceiling); bestMean = Math.min(bestMean, m.mean)
  }
  assert.ok(best > corner.ceiling, `a Custom setting DOES go below Corner Shop step 1 now (${best} vs ${corner.ceiling}) — the old sentence would be true and this test is stale`)
  assert.equal(ADD_FLOOR, 6)
  const info = { gained: 0, bonus: 3, unlocked: [], plaques: [], offer: null, dir: null, help: true, lunchboxBefore: 0 }
  const html = roof({ ...initialState(1), level: 'corner', roof: info, ride: { tray: 0 }, climb: [], records: { floors: 0 } })
  const line = /data-roof-help>([^<]*)</.exec(html)
  assert.ok(line, 'the drowning child gets no line at all')
  assert.ok(!/smaller still/.test(line[1]), `the card still promises what Custom cannot do: ${line[1]}`)
  assert.match(line[1], /one kind of sum at a time/, `the card does not name what Custom can do: ${line[1]}`)
  assert.match(line[1], /Custom numbers/, 'the card no longer names where to go')
})

// ---- r5-math-04 ------------------------------------------------------------------------------
// `demotedFrom` was a one-bit fuse that reset itself: accepting the promotion BACK cleared it, so a
// child who sits between two buildings bounced on a fixed six-building cycle for ever — a third of
// steady-state play in a band they answer almost nothing in.
test('r5-math-04: the ladder remembers every rescue, so the bounce damps instead of repeating', () => {
  // The child, abstracted to the one thing that matters: clean at `floorLevel`, hopeless above it.
  const ladder = (withMemory) => {
    let s = { ...initialState(2), level: 'sky', step: 3, adaptive: true, step3Run: 0, struggleRun: 0, demotedFrom: null, demotions: 0 }
    let promotions = 0, atMega = 0
    for (let b = 0; b < 60; b++) {
      const clean = s.level === 'sky'
      // what arrive() computes at the roof, transcribed: a clean step-3 building, or five falls at step 1
      const step = clean ? 3 : 1
      const step3Run = (step === 3) ? s.step3Run + 1 : 0
      const struggleRun = (step === 1) ? s.struggleRun + 1 : 0
      const idx = LEVEL_ORDER.indexOf(s.level)
      const nextUp = idx < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[idx + 1] : null
      const need = nextUp && nextUp === s.demotedFrom ? (withMemory ? UP_AGAIN * Math.max(1, Math.min(4, s.demotions)) : UP_AGAIN) : 2
      const up = step3Run >= need && nextUp ? nextUp : null
      const down = !up && struggleRun >= 2 && idx > 0 ? LEVEL_ORDER[idx - 1] : null
      s = { ...s, step, step3Run, struggleRun }
      if (s.level === 'megatall') atMega++
      const offer = up || down
      if (!offer) continue
      s = reduce({ ...s, phase: 'roof', screen: 'roof', roof: { gained: 0, bonus: 3, unlocked: [], plaques: [], offer, dir: up ? 'up' : 'down', help: false } }, { type: 'offer', accept: true }, makeRng(b)).state
      if (up) promotions++
      s = { ...s, step: 1, step3Run: 0, struggleRun: 0, phase: 'lobby', screen: 'lobby', roof: null }
    }
    return { promotions, atMega }
  }
  const before = ladder(false)
  const after = ladder(true)
  assert.ok(before.promotions >= 5, `the fixture does not reproduce the cycle (${before.promotions} promotions in 60 buildings)`)
  assert.ok(after.promotions * 2 <= before.promotions, `the bounce did not damp: ${before.promotions} → ${after.promotions} promotions`)
  assert.ok(after.atMega * 2 <= before.atMega, `still as many buildings in the band the child cannot do: ${before.atMega} → ${after.atMega}`)
  // …and it is still offered again eventually, which r4-math-02 requires of every offer
  assert.ok(after.promotions >= 2, 'the level became a permanent gate')
  // the count survives a reload, and a grown-up picking a level clears it
  const rng = makeRng(1)
  let d = { ...initialState(4), level: 'megatall', phase: 'roof', screen: 'roof', roof: { gained: 0, bonus: 3, unlocked: [], plaques: [], offer: 'sky', dir: 'down', help: false } }
  d = reduce(d, { type: 'offer', accept: true }, rng).state
  assert.equal(d.demotions, 1)
  assert.equal(parse(serialize(d)).demotions, 1, 'a reload forgets how many rescues there have been')
  assert.equal(reduce(d, { type: 'set-level', id: 'office' }, rng).state.demotions, 0)
  assert.equal(migrate({ v: 1, demotions: -4 }).demotions, 0)
  assert.equal(migrate({ v: 1, demotions: 1e9 }).demotions, 1000)
})

// ---- r5-math-05 ------------------------------------------------------------------------------
// ZERO_FUSE only arms once an identity HAS been served, so question one was unthrottled: 37.5 % of
// fresh saves opened on `0 + 5`, `5 + 0`, `2 − 0` — the answer already printed in the question.
test('r5-math-05: the first sum a save ever shows is a real question', () => {
  const level = levelById('corner')
  let identities = 0
  for (let salt = 0; salt < 4000; salt++) {
    const p = makeProblem(level, 1, initialCtx(), mulberry32(salt))
    if (isIdentity(p) || p.answer === 0) identities++
  }
  assert.equal(identities, 0, `${identities} of 4000 fresh saves open on a sum whose answer is already printed`)
  // …and only the first: the steady-state rate is the latch's job, not this guard's
  const rng = mulberry32(9)
  let ctx = { ...initialCtx(), count: 40 }
  let later = 0
  for (let i = 0; i < 2000; i++) if (isIdentity(makeProblem(level, 1, ctx, rng))) later++
  assert.ok(later > 0, 'the guard leaked past question one and identities vanished from the game')
})

// ---- r5-math-06 ------------------------------------------------------------------------------
// ⌫ on an empty entry returned same(state): no digit, no sound, no message, and no dimming to say
// why — the one key on the panel that was live, looked live and answered nothing.
test('r5-math-06: no lit key does nothing', () => {
  const src = read('src/render/panel.js')
  assert.match(src, /data-key="back" data-tap \$\{typed \? '' : 'disabled'\}/, '⌫ is drawn live on an empty entry')
  assert.match(src, /const back = container\.querySelector\('button\[data-key="back"\]'\)/, 'patchKeypad never touches ⌫')
})

// ---- r5-math-07 ------------------------------------------------------------------------------
// `numbers to 20` is printed in the picker and in the offer card, and Hotel step 3's × row reaches
// 10 × 10 = 100 on 11.8 % of its questions.
test('r5-math-07: no level tag undercuts the largest number its own steps can print', () => {
  for (const level of LEVELS) {
    const bound = levelBound(level)
    // A tag that names NO number promises nothing about size (Skyscraper is `times tables`); a tag
    // that names one is read as the ceiling, and may not be under what the level prints.
    const numbers = (level.tag.match(/\d[\d,]*/g) || []).map((n) => Number(n.replace(/,/g, '')))
    if (!numbers.length) continue
    assert.ok(Math.max(...numbers) >= bound, `${level.id}: the tag "${level.tag}" tops out at ${Math.max(...numbers)} and the level prints ${bound}`)
  }
  // measured, not merely declared: Hotel step 3 really does put a number over 20 on the panel
  const hotel = levelById('hotel')
  const rng = mulberry32(21)
  let over = 0
  for (let i = 0; i < 5000; i++) {
    const p = makeProblem(hotel, 3, initialCtx(), rng)
    if (Math.max(p.a, p.b, p.answer) > 20) over++
  }
  assert.ok(over > 200, `Hotel step 3 no longer exceeds 20 (${over} of 5000) — the tag could go back`)
})

// ---- r5-math-09 ------------------------------------------------------------------------------
test('r5-math-09: no question turns on a negation, and no choice is another choice with a piece cut out', () => {
  const bank = JSON.parse(read('data/trivia.json'))
  for (const it of bank.items) {
    assert.ok(!/\bNOT\b|\bisn't\b|\bdoes not\b|\bnever\b/.test(it.question), `${it.id}: the question turns on a negation: ${it.question}`)
    for (const d of it.distractors) assert.notEqual(String(d).trim(), String(it.answer).trim())
  }
  // The distractor half is NOT generalised to the whole bank, deliberately. `70,000` against
  // `7,000` and `100` against `10` are one character apart too, and for a maths bank an
  // order-of-magnitude distractor is the question rather than a trap. What the finding named is a
  // PROSE choice that is the answer with one character taken out of the middle of it, so that the
  // two read as the same sentence at a glance - and makeChoices shows two of three distractors, so
  // that pair appeared together about two thirds of the time.
  const prime = bank.items.find((i) => i.id === 'math-numbers-largest-known-prime-2026')
  const drop1 = (str) => new Set([...str].map((_, i) => str.slice(0, i) + str.slice(i + 1)))
  for (const d of prime.distractors) assert.ok(!drop1(prime.answer).has(d), `${prime.id}: "${d}" is the answer with one character taken out`)
})

// ---- r5-trivia-truth-01 and -03 ---------------------------------------------------------------
test('r5-trivia-truth-01/-03: every clause is carried by a source the card prints', () => {
  const bank = JSON.parse(read('data/trivia.json'))
  const kone = bank.items.find((i) => i.id === 'elevator-engineering-kone-monospace-1996')
  assert.ok(!/world's first/.test(kone.fact), 'the card still attributes a superlative to pages that do not make it')
  assert.match(kone.fact, /In 1996 KONE launched MonoSpace/, 'the year, which the cited page does carry')
  const zero = bank.items.find((i) => i.id === 'math-numbers-zero-brahmagupta')
  assert.ok(!/300-400 BC/.test(zero.fact), 'the fact still widens the date its own quote gives')
  assert.match(zero.fact, /around 400 BC/)
  assert.ok(zero.sources.some((s) => /around 400 BC/.test(s.quote || '')), 'the date in the fact is in no stored quote')
  // and the audit record moves with the bank, which is what r1-trivia-truth-01 was about
  const audit = JSON.parse(read('data/trivia-audit.json'))
  assert.ok(audit.round5, 'the audit has no round-5 record')
  const byId = new Map(audit.items.map((i) => [i.id, i]))
  for (const id of audit.round5.items) assert.equal(byId.get(id).fact, bank.items.find((i) => i.id === id).fact, `${id}: audit and bank disagree`)
})

// ---- r5-code-hostile-01 -----------------------------------------------------------------------
// `import`, `reset` and main.js's adoptDiskSave each carried `pool` forward by hand and forgot the
// two banks the content round added: partsPool 24 → 0 and climb 10 → 0 on all three, for the rest
// of the session, so the Workshop read "The card for this part did not load" for all 24 parts.
test('r5-code-hostile-01: the runtime content banks survive a paste, a reset and a second tab', () => {
  assert.deepEqual([...RUNTIME_BANKS], ['pool', 'partsPool', 'climb'])
  const banked = { ...fresh(1), partsPool: [{ id: 'doors-centre', body: 'x' }], climb: [{ id: 'a', name: 'A', floors: 5, line: 'x' }] }
  const rng = makeRng(1)
  for (const action of [{ type: 'reset' }, { type: 'import', state: migrate({ v: 1, lunchbox: 12 }) }]) {
    const out = reduce(banked, action, rng).state
    for (const k of RUNTIME_BANKS) assert.deepEqual(out[k], banked[k], `${action.type} emptied ${k}`)
  }
  // the same helper, so a fourth bank cannot be forgotten at one of three call sites
  const adopted = carryBanks({ ...migrate({ v: 1, lunchbox: 9 }) }, banked)
  for (const k of RUNTIME_BANKS) assert.deepEqual(adopted[k], banked[k])
  const main = read('src/main.js')
  assert.match(main, /state = carryBanks\(\{ \.\.\.incoming/, 'adoptDiskSave still rebuilds the banks by hand')
  assert.ok(!/pool: state\.pool/.test(main + read('src/state.js')), 'a bank is still carried by name somewhere')
  // and the lobby keeps its Climb goal line across the transition rather than going quiet
  const withClimb = { ...fresh(1), climb: [{ id: 'a', name: 'Tower', floors: 40, line: 'x' }], records: { floors: 5, rides: 1, longest: 1, passengers: 0 } }
  assert.match(lobby(withClimb, {}), /data-goal="climb"/)
  assert.match(lobby(reduce(withClimb, { type: 'reset' }, rng).state, {}), /data-goal="climb"/, 'the reset lobby lost The Climb')
})

// ---- r5-code-hostile-04 -----------------------------------------------------------------------
// Both roof exits dropped `tray - banked`. Every roof the game reaches itself has banked === tray,
// so this only bites a ride restored from a hand-edited BE1- code — and the lobby names the exact
// number it was about to throw away.
test('r5-code-hostile-04: neither roof exit throws away bacon the lobby has just counted', () => {
  const parked = migrate({ v: 1, lunchbox: 5, rulesSeen: true, ride: { seed: 3, floor: 10, target: 10, phase: 'roof', tray: 16, banked: 0 } })
  assert.equal(parked.ride.phase, 'roof', 'the fixture no longer parks at the roof')
  assert.match(lobby({ ...parked, pool: [], partsPool: [], climb: [] }, {}), /16 bacon on the tray/)
  const rng = makeRng(2)
  // the car is AT the roof, or the descent is blocked and there is no timeline to bank on
  const atRoof = { ...fresh(1), ...parked, phase: 'roof', screen: 'roof', pool: [], car: { ...initialState(1).car, floor: 10, doors: 'open' } }
  const next = reduce(atRoof, { type: 'next-building' }, rng).state
  assert.equal(next.lunchbox, 21, `Next building dropped the tray: lunchbox ${next.lunchbox}`)
  const down = reduce(atRoof, { type: 'to-lobby' }, rng)
  const settled = down.effects.some((e) => e.type === 'timeline') ? reduce(down.state, { type: 'timeline-done' }, rng).state : down.state
  assert.equal(settled.lunchbox, 21, `the victory descent dropped the tray: lunchbox ${settled.lunchbox}`)
  // and it is idempotent: an ordinary roof, where banked === tray, gains nothing extra
  let s = playBuilding(startRide(fresh(6), makeRng(6)), makeRng(6))
  const before = s.lunchbox
  assert.equal(reduce(s, { type: 'next-building' }, rng).state.lunchbox, before, 'an ordinary roof paid twice')
})

// ---- r5-code-hostile-07 -----------------------------------------------------------------------
test('r5-code-hostile-07: the display band guards the problem in every branch that reads it', () => {
  const src = read('src/render/panel.js')
  const line = src.split('\n').find((l) => l.includes("case 'keypad': set("))
  assert.ok(line, 'the keypad branch moved')
  assert.match(line, /r && r\.problem \?/, 'the keypad branch dereferences r.problem with no guard, unlike its two neighbours')
})

// ---- r5-code-hostile-08 -----------------------------------------------------------------------
test('r5-code-hostile-08: no ternary whose branches are the same string', () => {
  const src = read('src/render/screens.js')
  for (const m of src.matchAll(/\?\s*('[^']*')\s*:\s*('[^']*')/g)) {
    assert.notEqual(m[1], m[2], `a ternary with identical branches reads as a distinction that is not there: ${m[0]}`)
  }
})

// ---- r5-autism-fit-1 / r5-elevator-feel-01 ----------------------------------------------------
// `Next building` carried `btn primary tall wide` — the one "tap this" idiom in the game — so while
// an offer stood two blue primaries sat 8 px apart meaning different things and the bigger one did
// not answer the question printed above it.
//
// AMENDED IN ROUND 6 (r6-elevator-feel-03). Round 5's remedy left `Stay` as the only primary, which
// made the loudest control on the card the DECLINE — the same defect one button along, and a child
// who has learned that the blue fill means keep going then declines every promotion for ever. The
// question round 5 was really asking is unchanged and is still asserted below: is `Next building`
// louder than the answers to the question printed above it? The answer is now that while an offer
// stands NOTHING on the card carries the fill — the bordered block is the emphasis, and inside it a
// question with two answers may not tell the child which one to give. `Stay` is still the default
// (DESIGN §4) and nothing is gated.
test('r5-autism-fit-1 / r6-elevator-feel-03: while the offer stands, no button outshouts the question', () => {
  const base = { ...initialState(1), level: 'corner', ride: { tray: 0 }, climb: [], records: { floors: 0 } }
  const withOffer = roof({ ...base, roof: { gained: 4, bonus: 3, unlocked: [], plaques: [], offer: 'hotel', dir: 'up', help: false, lunchboxBefore: 0 } })
  const primaries = [...withOffer.matchAll(/class="btn ([^"]*)"[^>]*(data-offer="(\w+)"|data-next|data-nav="lobby")/g)]
    .filter((m) => /\bprimary\b/.test(m[1])).map((m) => m[3] || (m[2] === 'data-next' ? 'next' : m[2]))
  assert.deepEqual(primaries, [], `the primaries on an unanswered card are [${primaries}]`)
  assert.ok(!/class="btn primary tall wide" data-next/.test(withOffer), '`Next building` is still the loudest control on the card')
  // the two answers are the same button: same classes, same width, different word
  const answers = [...withOffer.matchAll(/<button class="([^"]*)" style="([^"]*)" data-offer="(\w+)"/g)].map((m) => [m[3], m[1], m[2]])
  assert.equal(answers.length, 2, 'the offer no longer draws two answers')
  assert.equal(answers[0][1], answers[1][1], `${answers[0][0]} is drawn as "${answers[0][1]}" and ${answers[1][0]} as "${answers[1][1]}"`)
  assert.equal(answers[0][2], answers[1][2], 'the two answers are not the same width')
  // …and with no offer it is the forward button again, exactly as it was
  const noOffer = roof({ ...base, roof: { gained: 4, bonus: 3, unlocked: [], plaques: [], offer: null, dir: null, help: false, lunchboxBefore: 0 } })
  assert.match(noOffer, /class="btn primary tall wide" data-next/)
  // the grouping is drawn, not inferred from proximity
  assert.match(read('css/app.css'), /\.roof \.foot \.offer \{[^}]*border: 3px solid/, 'the offer block has no border of its own')
})

// ---- r5-autism-fit-4 --------------------------------------------------------------------------
test('r5-autism-fit-4: the trivia panel says when there is more below the fold', () => {
  const css = read('css/app.css')
  const rule = /\.ride \.panel\[data-mode="trivia"\] \{[\s\S]{0,900}?\}/.exec(css)
  assert.ok(rule, 'the scrolling trivia panel rule moved')
  assert.match(rule[0], /overflow-y: auto/)
  assert.match(rule[0], /radial-gradient/, 'the panel scrolls with no cue that it does')
})

// ---- r5-autism-fit-5 --------------------------------------------------------------------------
// A right answer prints "+2 bacon"; a wrong one printed nothing where that line had been, so the
// feedback for a miss was an absence.
test('r5-autism-fit-5: a missed passenger is answered in words, not by a line that is not there', () => {
  const fact = FACTS[0]
  const sheet = (chosen) => factSheet({ trivia: { fact, choices: [fact.answer, ...fact.distractors.slice(0, 2)], answer: 0, chosen, result: chosen === 0 ? 'right' : 'wrong' } })
  assert.match(sheet(0), /\+2 bacon/)
  const missed = sheet(1)
  assert.ok(!/\+2 bacon/.test(missed), 'a miss pays bacon')
  assert.match(missed, /0 bacon this time/, 'the card says nothing about the bacon that did not arrive')
  assert.match(missed, /Nothing is lost/)
  assert.match(missed, /asks again later/, 'the card does not say the passenger comes back')
  for (const bad of [/oops/i, /wrong/i, /sorry/i, /!/]) assert.ok(!bad.test(missed), `the miss copy has a punishing tone: ${bad}`)
})

// ---- r5-elevator-feel-03 ----------------------------------------------------------------------
test('r5-elevator-feel-03: the lobby art is a parked car, so it lights no direction arrow', () => {
  const art = /<svg class="title-art"[\s\S]*?<\/svg>/.exec(read('src/render/screens.js'))
  assert.ok(art, 'the lobby art moved')
  assert.ok(!/▲|▼/.test(art[0]), 'a car with its doors drawn open is showing a direction arrow')
})

// ---- r5-deploy-pages-1 and -2 -----------------------------------------------------------------
// The stamp took the lexicographically greatest `be-` cache name, and two caches coexist from the
// moment a new worker installs until the chip is tapped — so it named the running build or the
// pending one by hex ordering. On a first-ever visit it named nothing: the read ran before install.
test('r5-deploy-pages-1/-2: the build stamp comes from the worker that is serving the tab', () => {
  const main = read('src/main.js')
  const sw = read('sw.js')
  assert.ok(!/caches\.keys\(\)[\s\S]{0,200}\.sort\(\)\.pop\(\)/.test(main), 'the page still picks a cache name by sorting')
  assert.match(main, /postMessage\(\{ type: 'which-build' \}\)/, 'nothing asks the controller which build it is')
  assert.match(main, /d\.type !== 'build'/, 'nothing listens for the answer')
  assert.match(main, /controllerchange[\s\S]{0,400}askBuild\(\)/, 'the stamp is never re-read when the controller arrives (a first-ever install)')
  assert.match(sw, /which-build[\s\S]{0,160}postMessage\(\{ type: 'build', cache: CACHE \}\)/, 'the worker does not answer for its own cache')
  assert.match(main, /build: ui\.build/, 'the build never reaches the Grown-ups screen')
})
