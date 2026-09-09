// HOSTILE REVIEW ROUND 4 — one test per confirmed finding, each written so it FAILS on the tree
// that was reviewed. Findings whose whole surface is layout, occlusion or a real tap live in
// tools/drive-scenarios.mjs instead (r4-code-hostile-01, r4-autism-fit-1/-2/-3,
// r4-elevator-feel-01/-03, r4-mobile-ux-1/-2, r4-code-hostile-06); they are named where they sit.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { mulberry32 } from '../src/rng.js'
import { LEVELS, LEVEL_ORDER, levelById, customLevel, ADD_FLOOR } from '../src/levels.js'
import { makeProblem, afterAnswer, initialCtx, stepOf, inStepBand, isIdentity, MISS_RETIRE, solve } from '../src/math.js'
import { initialState, reduce, currentLevel, UP_AGAIN } from '../src/state.js'
import { serialize, parse, migrate } from '../src/save.js'
import { loadFacts, pickFact, withinBand, TRIVIA_LIMITS } from '../src/trivia.js'
import { rules, roof, lobby, grownups, byKindHTML } from '../src/render/screens.js'
import { fresh, makeRng, startRide, answer, answerTrivia, run, playBuilding, FACTS } from './_helpers.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const shipped = JSON.parse(read('data/trivia.json'))

// ---- r4-math-01 -----------------------------------------------------------------------------
// makeProblem read the comeback queue BEFORE stepOf(), so a due entry ignored both the step's kind
// list and its ceiling: a child at Corner Shop step 1 — tag `numbers to 10`, kinds add/sub/▲/▼,
// max 5 — was served `9 + ▮ = 10`, a form step 1 never teaches, above its own ceiling, right after
// the panel had said "Smaller numbers for a bit."
test('r4-math-01: a comeback is banded by the step that serves it', () => {
  const level = levelById('corner')
  const missAdd = { kind: 'missAdd', a: 9, b: 1, c: 10, answer: 1, text: '9 + ▮ = 10', key: 'missAdd:9:1' }
  const ctx = { ...initialCtx(), count: 100, comeback: [{ problem: missAdd, due: 0 }] }
  assert.equal(inStepBand(missAdd, stepOf(level, 3).kinds), true, 'step 3 declares missAdd and max 10')
  assert.equal(inStepBand(missAdd, stepOf(level, 1).kinds), false, 'step 1 declares neither missAdd nor 10')
  const rng = mulberry32(4)
  const atOne = makeProblem(level, 1, ctx, rng)
  assert.ok(!atOne.comeback, `step 1 served the out-of-band comeback: ${atOne.text}`)
  const atThree = makeProblem(level, 3, ctx, mulberry32(4))
  assert.ok(atThree.comeback && atThree.key === missAdd.key, 'the same entry must still fire where it IS in band')
  // …and it is a band, not a kind check: a `9 + 1` at step 1 (max 5) is refused for its numbers
  const bigAdd = { kind: 'add', a: 9, b: 1, answer: 10, text: '9 + 1 = ▮', key: 'add:1:9' }
  assert.equal(inStepBand(bigAdd, stepOf(level, 1).kinds), false)
  assert.equal(inStepBand(bigAdd, stepOf(level, 2).kinds), true)
})

// The whole trap, played through the real reducer: a fresh default save, every sum right except
// `missAdd`, which the child never gets right on a first try. On the reviewed tree this served the
// same three out-of-band sums for ever (189 of 191 comeback draws out of band, five falls in every
// building from the second on, for forty buildings).
test('r4-math-01: the trap, end to end — every comeback in band, and the queue keeps turning over', () => {
  const rng = makeRng(5)
  let s = fresh(123456, { facts: [] })
  s = { ...s, rulesSeen: true }
  const cbKeys = []
  let outOfBand = 0
  for (let b = 0; b < 12; b++) {
    s = startRide(s, rng)
    let guard = 0
    while (s.phase !== 'roof' && guard++ < 200) {
      if (s.phase === 'floor' || s.phase === 'keypad') {
        if (s.phase === 'floor') s = run(s, { type: 'press-floor', floor: s.ride.target }, rng).state
        const p = s.ride.problem
        if (p.comeback && !s.ride.retrying && s.ride.tries === 0) {
          cbKeys.push(p.key)
          if (!inStepBand(p, stepOf(currentLevel(s), s.step).kinds)) outOfBand++
        }
        // wrong on missAdd (both tries); right on everything else, and right on the post-fall
        // retry, because the Repair card prints the true equation
        const bad = p.kind === 'missAdd' && !s.ride.retrying
        s = answer(s, rng, !bad).state
      } else if (s.phase === 'repair') s = run(s, { type: 'card-continue' }, rng).state
      else if (s.phase === 'trivia') s = answerTrivia(s, rng, true)
      else throw new Error('stuck at ' + s.phase)
    }
    s = run(s, { type: 'next-building' }, rng).state
  }
  assert.equal(outOfBand, 0, `${outOfBand} of ${cbKeys.length} comebacks were outside the step that served them`)
  const late = new Set(cbKeys.slice(-40))
  assert.ok(late.size >= 8, `the queue collapsed to ${late.size} distinct sums in the last 40 comebacks`)
})

// A key re-armed on EVERY miss, so a sum the child cannot yet do could never leave the queue.
test('r4-math-01: a key that keeps being missed is retired rather than re-queued for ever', () => {
  const p = { kind: 'add', a: 3, b: 4, answer: 7, text: '3 + 4 = ▮', key: 'add:3:4' }
  let ctx = initialCtx()
  for (let i = 0; i < MISS_RETIRE; i++) {
    ctx = afterAnswer(ctx, p, false)
    assert.ok(ctx.comeback.some((x) => x.problem.key === p.key), `miss ${i + 1} should still re-arm`)
    ctx = { ...ctx, count: ctx.count + 1 }
  }
  ctx = afterAnswer(ctx, p, false)
  assert.equal(ctx.comeback.filter((x) => x.problem.key === p.key).length, 0, `a key missed ${MISS_RETIRE + 1} times in a row is still being re-queued`)
})

// The queue survived serialize()/parse(), and set-level cleared it only when the id CHANGED, so
// re-picking the same building — the obvious thing a grown-up does — left every entry in place.
test('r4-math-01: picking a building is always a fresh start in it', () => {
  const rng = makeRng(6)
  let s = fresh(9)
  s = { ...s, history: { ...s.history, comeback: [{ problem: { kind: 'add', a: 1, b: 1, answer: 2, text: '1 + 1 = ▮', key: 'add:1:1' }, due: 0, misses: 1 }] } }
  assert.equal(parse(serialize(s)).history.comeback.length, 1, 'the queue is persisted')
  const same = reduce(s, { type: 'set-level', id: 'corner' }, rng).state
  assert.equal(same.history.comeback.length, 0, 're-picking the same level left the queue jammed')
  assert.equal(same.level, 'corner')
})

// `down` needs idx > 0, so at the bottom of the ladder the documented rescue cannot fire at all and
// a drowning child got no reaction of any kind. There is no smaller BUILDING; there is a smaller
// band, and the card now says where it lives — and Grown-ups names which shape is failing.
test('r4-math-01: at the bottom of the ladder the roof says where the smaller numbers are', () => {
  const rng = makeRng(7)
  let s = fresh(7, { seed: 7 })
  s = { ...s, struggleRun: 5, step: 1 }
  s = startRide(s, rng)
  let guard = 0
  while (s.phase !== 'roof' && guard++ < 200) {
    if (s.phase === 'floor' || s.phase === 'keypad') s = answer(s, rng, false).state
    // the pit card IS the retry: answer it right, ride back up, fall on the next sum
    else if (s.phase === 'repair') { s = run(s, { type: 'card-continue' }, rng).state; s = answer(s, rng, true).state }
    else if (s.phase === 'trivia') s = answerTrivia(s, rng, true)
    else throw new Error('stuck at ' + s.phase)
  }
  assert.ok(s.ride.falls >= 5, `a building of nothing but falls fell ${s.ride.falls} times`)
  assert.equal(s.roof.offer, null, 'there is nothing below Corner Shop to offer')
  assert.equal(s.roof.help, true, 'the card said nothing at all to a child drowning at the bottom')
  assert.match(roof(s), /Custom numbers/)
  // and the parent gets the diagnosis, not just the alarm
  const g = grownups({ ...s, history: { ...s.history, byKind: { add: [10, 9], missAdd: [8, 1] } } }, {})
  assert.match(g, /The missing number/)
  assert.match(g, /1 of 8 \(13%\)/)
  assert.equal(byKindHTML({ history: { byKind: {} } }), '', 'nothing is printed before anything is asked')
})

// ---- r4-math-02 -----------------------------------------------------------------------------
// step3Run and struggleRun are both zeroed by the `offer` action whichever way the child answers,
// and nothing recorded a demotion: two clean Skyscraper buildings re-offered Megatall, two ruinous
// Megatall buildings offered Skyscraper back, for ever, every four buildings.
test('r4-math-02: the ladder remembers the level it just took the child out of', () => {
  const rng = makeRng(11)
  let s = fresh(11)
  s = { ...s, level: 'sky', step: 1, struggleRun: 1, adaptive: true }
  // a Megatall-shaped demotion: accept the `down` offer and the level left is remembered
  s = { ...s, level: 'megatall', roof: { gained: 0, bonus: 3, unlocked: [], plaques: [], offer: 'sky', dir: 'down', help: false }, phase: 'roof', screen: 'roof' }
  s = reduce(s, { type: 'offer', accept: true }, rng).state
  assert.equal(s.level, 'sky')
  assert.equal(s.demotedFrom, 'megatall', 'nothing recorded which level the child was taken out of')
  assert.equal(parse(serialize(s)).demotedFrom, 'megatall', 'and a reload forgets it')

  // two clean step-3 buildings are enough for an ordinary promotion, and not for this one
  const offerAfter = (state, runs) => {
    const r = makeRng(3)
    let t = { ...state, step: 3, step3Run: runs - 1, struggleRun: 0, phase: 'lobby', screen: 'lobby', roof: null, ride: null }
    t = startRide(t, r)
    t = playBuilding(t, r)
    return t.roof.offer
  }
  assert.equal(offerAfter({ ...s, demotedFrom: null }, 2), 'megatall', 'the ordinary promotion still fires at two')
  assert.equal(offerAfter(s, 2), null, 'a level the child was just demoted from was re-offered after two clean buildings')
  assert.equal(offerAfter(s, UP_AGAIN), 'megatall', `it must be offered again eventually (at ${UP_AGAIN})`)

  // ACCEPTING THE PROMOTION BACK USED TO CLEAR THE NOTE, and that is what round 5 found makes the
  // bounce endless: the memory was a fuse that reset itself, so the same pair repeated on a fixed
  // six-building cycle for ever (r5-math-04). It is kept, and `demotions` counts the rescues, so
  // the second bounce off the same level costs 2 x UP_AGAIN clean buildings. A grown-up picking a
  // level still clears both.
  let up = { ...s, roof: { offer: 'megatall', dir: 'up', gained: 0, bonus: 3, unlocked: [], plaques: [], help: false }, phase: 'roof', screen: 'roof' }
  up = reduce(up, { type: 'offer', accept: true }, rng).state
  assert.equal(up.demotedFrom, 'megatall', 'the level the child was rescued out of is still remembered')
  assert.equal(up.demotions, 1)
  assert.equal(reduce(s, { type: 'set-level', id: 'office' }, rng).state.demotedFrom, null)
  assert.equal(reduce(s, { type: 'set-level', id: 'office' }, rng).state.demotions, 0)
})

// ---- r4-math-03 -----------------------------------------------------------------------------
// `a + ▮ = c` arrives at Corner Shop step 3 — question 7 of a fresh save, before the first ▲ — and
// the display band was empty for it while ▲ and ▼ are glossed twice over.
test('r4-math-03: the missing-number form is introduced where the child is looking', () => {
  const src = read('src/render/panel.js')
  assert.match(src, /missAdd: \(p\) =>/, 'OP_GLOSS still covers only ▲ and ▼')
  assert.match(src, /missMul: \(p\) =>/)
  // and on the Rules card, with the blank in the middle
  const card = rules({ settings: { sound: false, secondTry: true }, ride: null, screen: 'rules' })
  assert.match(card, /▮ = missing/)
  assert.match(card, /7 <tspan fill="#2F7A8C">\+<\/tspan> <tspan fill="#4A7BAA">5<\/tspan> = 12/, 'the third worked example puts the blank in the middle')
})

// ---- r4-math-04 -----------------------------------------------------------------------------
// Megatall step 1 was 3-digit ± with up to two regroups and nothing else: 0 % of its draws had every
// number under 100, against 56-100 % at every other step in the game. It is the step the promotion
// lands on AND the step a fall cannot leave.
test('r4-math-04: the step a promotion lands on carries something the child has already proved', () => {
  const share = (level, step) => {
    const rng = mulberry32(7)
    let ctx = initialCtx()
    let under = 0
    const N = 4000
    for (let i = 0; i < N; i++) {
      const p = makeProblem(level, step, ctx, rng)
      if (Math.max(Math.abs(p.a), Math.abs(p.b), Math.abs(p.answer)) < 100) under++
      ctx = afterAnswer(ctx, p, true)
      ctx = { ...ctx, comeback: ctx.comeback.slice(-12) }
    }
    return under / N
  }
  const mega = levelById('megatall')
  assert.ok(share(mega, 1) >= 0.1, `Megatall step 1 serves ${(100 * share(mega, 1)).toFixed(0)} % of its sums entirely under 100`)
  // …and it is still the big-numbers building: every row puts a 3-digit number on the panel
  const rng = mulberry32(3)
  let ctx = initialCtx()
  for (let i = 0; i < 400; i++) {
    const p = makeProblem(mega, 1, ctx, rng)
    assert.equal(solve(p), p.answer)
    ctx = afterAnswer(ctx, p, true)
  }
  // the ceiling still rises across the whole promotion, and step 2 is where the second regroup lands
  const rows = stepOf(mega, 1).kinds
  assert.ok(rows.every((r) => (r.regroups ?? 1) <= 1), 'step 1 still asks for two column regroups')
  assert.ok(stepOf(mega, 2).kinds.some((r) => r.regroups === 2), 'nothing moved the two-regroup rows to step 2')
})

// ---- r4-math-05 -----------------------------------------------------------------------------
// `Try Megatall?` and `Try Skyscraper?` were the same eight words with the same two buttons, so
// after two ruinous buildings the rescue read exactly like a reward, and neither named the band.
test('r4-math-05: a promotion and a rescue are not the same sentence', () => {
  const base = { lunchbox: 40, plaques: [], ride: { tray: 6 }, records: { floors: 10, rides: 8, longest: 2, passengers: 1 }, climb: [], unlocks: [], settings: { motion: 'auto' } }
  const up = roof({ ...base, roof: { gained: 6, bonus: 3, unlocked: [], plaques: [], offer: 'hotel', dir: 'up', offerTaken: null, lunchboxBefore: 31 } })
  const down = roof({ ...base, roof: { gained: 6, bonus: 3, unlocked: [], plaques: [], offer: 'hotel', dir: 'down', offerTaken: null, lunchboxBefore: 31 } })
  assert.match(up, /Ready for Hotel/)
  assert.match(down, /Back to Hotel/)
  assert.notEqual(/Ready for/.test(down), true, 'the rescue still reads as a reward')
  for (const html of [up, down]) assert.match(html, /numbers to 20/, 'neither offer names the band it is offering')
})

// ---- r4-math-06 -----------------------------------------------------------------------------
// A third of every question drawn at Corner Shop step 1 was the additive identity — the answer
// already printed in the question — and one fresh save in three opened on one.
test('r4-math-06: the additive identity is a teaching point, not a third of the questions', () => {
  for (const [step, wasPct] of [[1, 32], [2, 20]]) {
    const rng = mulberry32(7)
    let ctx = initialCtx()
    let n = 0
    const N = 8000
    for (let i = 0; i < N; i++) {
      const p = makeProblem(levelById('corner'), step, ctx, rng)
      if (isIdentity(p)) n++
      ctx = afterAnswer(ctx, p, true)
      ctx = { ...ctx, comeback: ctx.comeback.slice(-12) }
    }
    const pct = (100 * n) / N
    assert.ok(pct <= 18, `Corner Shop step ${step}: ${pct.toFixed(1)} % identities (was about ${wasPct} %)`)
    assert.ok(pct > 2, `step ${step}: 0 is still a taught point at this step, ${pct.toFixed(1)} % is not teaching it`)
  }
  assert.equal(isIdentity({ kind: 'add', a: 0, b: 3 }), true)
  assert.equal(isIdentity({ kind: 'sub', a: 4, b: 0 }), true)
  assert.equal(isIdentity({ kind: 'add', a: 2, b: 3 }), false)
})

// ---- r4-math-07 -----------------------------------------------------------------------------
// Past the digit cap the keypad returned same(state): no click, no line, no change, on a lit and
// undimmed key — while a tap on the wrong FLOOR button, the other dead key on the same panel,
// answers in words for 1.4 s.
test('r4-math-07: the digit cap says why nothing happened', () => {
  const rng = makeRng(21)
  let s = fresh(21)
  s = startRide(s, rng)
  s = run(s, { type: 'press-floor', floor: s.ride.target }, rng).state
  for (const d of ['1', '2', '3', '4']) s = reduce(s, { type: 'digit', d }, rng).state
  assert.equal(s.ride.typed, '1234')
  assert.equal(s.message, '')
  const capped = reduce(s, { type: 'digit', d: '5' }, rng).state
  assert.equal(capped.ride.typed, '1234', 'the cap still holds')
  assert.match(capped.message, /Four numbers is enough\./)
  // and the line clears the moment something does happen
  assert.equal(reduce(capped, { type: 'backspace' }, rng).state.message, '')
})

// ---- r4-math-08 -----------------------------------------------------------------------------
// TRIVIA_LIMITS banded difficulty, question length and the SIZE of any arithmetic, and nothing
// banded the CONCEPT: `Which of these numbers is NOT a prime number?` is difficulty 1 and 45
// characters, so a child on `numbers to 10` was asked it, in the negative form.
test('r4-math-08: the youngest band gets counting, shapes and everyday maths, not number theory', () => {
  const { facts } = loadFacts(shipped)
  const byId = new Map(facts.map((f) => [f.id, f]))
  assert.equal(byId.get('math-numbers-one-not-prime').concept, 'number-theory')
  assert.equal(byId.get('math-numbers-googol').concept, 'large-numbers')
  for (const level of ['corner', 'hotel']) {
    const band = facts.filter((f) => withinBand(f, TRIVIA_LIMITS[level]))
    assert.ok(!band.some((f) => f.id === 'math-numbers-one-not-prime'), `${level} still asks which number is NOT prime`)
    assert.ok(!band.some((f) => f.id === 'math-numbers-googol'), `${level} still asks about a googol`)
    assert.ok(band.length >= 16 && band.some((f) => f.kind === 'math') && band.some((f) => f.kind === 'elevator'), `${level}: ${band.length} items, both kinds`)
  }
  // …and the band opens up again where the ladder has grown into it
  assert.ok(facts.filter((f) => withinBand(f, TRIVIA_LIMITS.office)).some((f) => f.id === 'math-numbers-one-not-prime'))
  // every maths item declares its concept, so this is a rule and not a hand-picked list
  for (const it of shipped.items) if (it.category === 'math') assert.ok(it.concept, `${it.id} has no concept`)
})

// ---- r4-math-09 -----------------------------------------------------------------------------
test('r4-math-09: the honeycomb question names its subject once and every distractor can tile', () => {
  const it = shipped.items.find((i) => i.id === 'math-everyday-honeycomb-hexagon')
  assert.ok(!/room[^.]*rooms/.test(it.question), `the stem still defines its subject by itself: ${it.question}`)
  assert.ok(!it.distractors.includes('Regular octagon'), 'a regular octagon cannot tile the plane, so it is not a wrong answer')
  // ...AND NO TWO OPTIONS MAY NAME OVERLAPPING CATEGORIES (r6-math-08). `Square` and `Rectangle`
  // were both offered as wrong answers and every square is a rectangle, so two of the four options
  // could both be right at once while only the ANSWER was qualified as `regular`. The replacement
  // still has to satisfy the rule this test was written for: it must be a shape that can actually
  // tile, or it is not a wrong answer to this question.
  for (const d of it.distractors) assert.ok(['Square', 'Equilateral triangle', 'Long thin rectangle'].includes(d), d)
  assert.ok(!it.distractors.includes('Rectangle'), 'every square is a rectangle: the options overlap')
})

// ---- r4-math-10 -----------------------------------------------------------------------------
// `Smallest 0, Largest 2` is reachable from Grown-ups and built a pool of three sums.
test('r4-math-10: no reachable Custom setting builds a pool a child exhausts in one building', () => {
  const keysOf = (level) => {
    const rng = mulberry32(7)
    let ctx = initialCtx()
    const out = new Set()
    for (let i = 0; i < 4000; i++) { const p = makeProblem(level, 1, ctx, rng); out.add(p.key); ctx = afterAnswer(ctx, p, true); ctx = { ...ctx, comeback: ctx.comeback.slice(-12) } }
    return out
  }
  for (const ops of [['add'], ['sub'], ['add', 'sub'], ['missAdd']]) {
    const lvl = customLevel({ ops, min: 0, max: 2 })
    assert.ok(keysOf(lvl).size >= 10, `ops ${ops.join('+')}, 0 to 2: only ${keysOf(lvl).size} sums in the whole pool`)
    // the tag names the table that was BUILT, never the knob that was set
    assert.match(lvl.tag, new RegExp(`numbers 0 to ${ADD_FLOOR}`), lvl.tag)
  }
  // …and a parent's real setting is untouched
  assert.match(customLevel({ ops: ['add', 'sub'], min: 2, max: 20 }).tag, /numbers 2 to 20/)
})

// ---- r4-elevator-feel-02 / r4-autism-fit-6 --------------------------------------------------
// `secondTry` ships ON, so the first wrong answer clears the entry and nothing falls — a rule
// stated only on the Grown-ups toggle, while the card the child IS shown said "Wrong: a fall".
test('r4-elevator-feel-02: the Rules card states the rule that actually runs', () => {
  const base = { ride: null, screen: 'rules' }
  const on = rules({ ...base, settings: { sound: false, secondTry: true } })
  assert.match(on, /one more go, then a fall/)
  assert.match(on, /the entry clears and you try again\. Miss it twice/)
  assert.ok(!/Wrong: a fall, then back up/.test(on), 'the card still promises a fall on the first wrong answer')
  const off = rules({ ...base, settings: { sound: false, secondTry: false } })
  assert.match(off, /Wrong: a fall, then back up/)
  assert.ok(!/one more go/.test(off))
  // and what the card says is what the reducer does, at the shipped default
  const rng = makeRng(31)
  let s = fresh(31)
  assert.equal(s.settings.secondTry, true, 'the shipped default moved; the card must move with it')
  s = startRide(s, rng)
  const r = answer(s, rng, false)
  assert.equal(r.state.phase, 'keypad')
  assert.equal(r.state.ride.falls, 0)
  assert.equal(r.state.message, 'Try once more.')
})

// ---- r4-autism-fit-4 -------------------------------------------------------------------------
// The visible text named the CURRENT state on a control shaped like a command, so a child reading
// `♪ Sound off` and tapping it got sound ON.
test('r4-autism-fit-4: the lobby sound control names the thing, and a pill names the state', () => {
  const base = { lunchbox: 0, plaques: [], ride: null, level: 'corner', step: 1, adaptive: true, pinnedStep: 1, records: { floors: 0 }, climb: [], unlocks: [], history: { count: 0 } }
  const off = lobby({ ...base, settings: { sound: false, custom: { ops: ['add'], min: 2, max: 20 } } })
  const on = lobby({ ...base, settings: { sound: true, custom: { ops: ['add'], min: 2, max: 20 } } })
  assert.ok(!/♪ Sound off</.test(off), 'the button still reads as a command to turn sound off')
  assert.match(off, /♪ Sound<span class="pill">Off<\/span>/)
  assert.match(on, /♪ Sound<span class="pill">On<\/span>/)
  assert.match(off, /role="switch" aria-checked="false"/)
  assert.match(on, /role="switch" aria-checked="true"/)
})

// ---- r4-autism-fit-5 -------------------------------------------------------------------------
// migrate() answers "unreadable" and "absent" with the same fresh initialState(), so a mangled
// record booted the game at lunchbox 0 with nothing on any screen to say so.
test('r4-autism-fit-5: an unreadable save is told about, and kept aside', () => {
  assert.equal(parse('{"lunchbox":"banana",'), null, 'unparseable JSON must be distinguishable from a valid save')
  assert.ok(parse(JSON.stringify({ v: 1, lunchbox: 12 })), 'a valid save still parses')
  const src = read('src/main.js')
  assert.match(src, /const BROKEN_KEY = SAVE_KEY \+ '\.unreadable'/)
  assert.match(src, /saveUnreadable = true/)
  const html = lobby({ lunchbox: 0, plaques: [], ride: null, level: 'corner', step: 1, adaptive: true, pinnedStep: 1, records: { floors: 0 }, climb: [], unlocks: [], history: { count: 0 }, settings: { sound: false, custom: { ops: ['add'], min: 2, max: 20 } } }, { saveUnreadable: true })
  assert.match(html, /The saved lunchbox could not be read/)
})

// ---- r4-code-hostile-02 ----------------------------------------------------------------------
// `gained` is the UNbanked remainder, and the card called it `Tray`, so after a mid-building Lobby
// tap the reward card and the top bar printed two different numbers for the same tray.
test('r4-code-hostile-02: the roof card says which of the two numbers it is printing', () => {
  const base = { lunchbox: 40, plaques: [], ride: { tray: 14 }, records: { floors: 10, rides: 8, longest: 2, passengers: 1 }, climb: [], unlocks: [], settings: { motion: 'auto' } }
  const clean = roof({ ...base, roof: { gained: 11, bonus: 3, unlocked: [], plaques: [], offer: null, midBanked: 0, lunchboxBefore: 26 } })
  assert.match(clean, /Tray 11 → lunchbox/)
  const banked = roof({ ...base, roof: { gained: 8, bonus: 3, unlocked: [], plaques: [], offer: null, midBanked: 3, lunchboxBefore: 29 } })
  assert.match(banked, /8 more bacon → lunchbox/)
  assert.ok(!/Tray 8/.test(banked), 'the card still calls the remainder the tray')
  // …and the lobby line counts the same bacon once
  const html = lobby({ lunchbox: 40, plaques: [], ride: { floor: 3, tray: 5, banked: 5 }, level: 'corner', step: 1, adaptive: true, pinnedStep: 1, records: { floors: 0 }, climb: [], unlocks: [], history: { count: 0 }, settings: { sound: false, custom: { ops: ['add'], min: 2, max: 20 } } })
  assert.match(html, /with 0 bacon on the tray/)
})

// ---- r4-code-hostile-03 ----------------------------------------------------------------------
// `ride-start` re-ran askPassenger() for a resumed `trivia` phase, so parking at a passenger and
// coming back swapped the question — a reroll of a question worth +2 bacon.
test('r4-code-hostile-03: the passenger on the landing asks the same thing when you come back', () => {
  const rng = makeRng(41)
  let s = fresh(41, { seed: 101 })
  s = startRide(s, rng)
  let guard = 0
  while (s.phase !== 'trivia' && guard++ < 60) s = answer(s, rng, true).state
  assert.equal(s.phase, 'trivia', 'never reached a passenger')
  const asked = s.trivia.fact.id
  const choices = s.trivia.choices.slice()
  // park it (the top-bar Lobby), then come back
  s = run(s, { type: 'to-lobby' }, rng).state
  s = startRide(s, makeRng(41))
  assert.equal(s.phase, 'trivia')
  assert.equal(s.trivia.fact.id, asked, 'the passenger swapped their question')
  assert.deepEqual(s.trivia.choices, choices, 'the choices were reshuffled')
  // …and it survives a reload
  const reloaded = parse(serialize(s))
  let t = reduce(reloaded, { type: 'load-facts', facts: FACTS }).state
  t = startRide(t, makeRng(99))
  assert.equal(t.trivia.fact.id, asked, 'a reload swapped the question')
  assert.deepEqual(t.trivia.choices, choices)
})

// ---- r4-code-hostile-04 ----------------------------------------------------------------------
// `plaques` took any string of any length, while `unlocks` on the very next line is filtered
// against PART_IDS.
test('r4-code-hostile-04: plaques are thresholds, checked against the list they come from', () => {
  const s = migrate({ v: 1, lunchbox: 300, plaques: ['<b>200</b>', 'ha '.repeat(40), '200', '999', '400'] })
  assert.deepEqual(s.plaques, ['200', '400'], `hand-written plaques reached the Lobby wall: ${JSON.stringify(s.plaques)}`)
})

// ---- r4-mobile-ux-4 / r4-mobile-ux-6 / r4-mobile-ux-5 ---------------------------------------
test('r4-mobile-ux-4: the home-indicator inset is reserved once, by #app', () => {
  const css = read('css/app.css')
  assert.match(css, /#app \{[\s\S]*?padding-bottom: env\(safe-area-inset-bottom, 0px\);/)
  const feet = css.split('\n').filter((l) => /\.(sheet|rules) \.foot/.test(l) && /safe-area-inset-bottom/.test(l))
  assert.deepEqual(feet, [], `a foot inside #app reserves the inset a second time: ${feet.join(' | ')}`)
})

test('r4-mobile-ux-6: 404.html sizes itself the way the app does', () => {
  const html = read('404.html')
  assert.match(html, /min-height: 100vh; min-height: 100dvh/)
})

test('r4-mobile-ux-5: one aborted precache fetch does not cost the whole cache', () => {
  const sw = read('sw.js')
  assert.ok(!/c\.addAll\(/.test(sw), 'addAll() rejects as a unit: one cancelled request left no cache at all')
  assert.match(sw, /Promise\.allSettled/)
  assert.match(sw, /cache: 'reload'/, 'the HTTP-cache bypass must survive the rewrite')
  assert.match(sw, /precache incomplete/)
})

// ---- r4-mobile-ux-3 ---------------------------------------------------------------------------
// iOS ignores alpha, composites onto black and applies its own squircle, so a pre-rounded icon with
// transparent corners gets black wedges around its edge.
test('r4-mobile-ux-3: the apple touch icon is square and opaque', () => {
  const png = readFileSync(join(ROOT, 'assets/apple-touch-icon.png'))
  assert.equal(png.readUInt32BE(16), 180)
  assert.equal(png.readUInt32BE(20), 180)
  assert.equal(png[25], 2, 'colour type 6 is RGBA: the icon still ships an alpha channel for iOS to fill with black')
  const tool = read('tools/make-icons.mjs')
  assert.match(tool, /const APPLE = \{ file: 'assets\/apple-touch-icon\.png'/)
  assert.match(tool, /has transparent pixels/)
})

// ---- r4-deploy-pages-02 -----------------------------------------------------------------------
// The BUILD stamp is the one gate that makes a content-only deploy reach a child who already has
// the game, and nothing but a human running `npm test` enforced it.
test('r4-deploy-pages-02: the stamp is enforced by the deploy, not by remembering', () => {
  const wf = read('.github/workflows/ci.yml')
  assert.match(wf, /on:[\s\S]*push:/)
  assert.match(wf, /branches:\s*\[\s*main\s*\]/)
  assert.match(wf, /npm test/)
})

// ---- r4-trivia-truth-01 / -02 / -03 / -04 -----------------------------------------------------
test('r4-trivia-truth-01: the bank\'s rule string says what the record actually shows', () => {
  assert.ok(!/each fetching an independent source/.test(shipped.rule), 'the rule still claims more than the record shows')
  const cited = shipped.items.filter((it) => {
    const r = (it.verification || []).find((v) => v.lens === 'refute')
    return r && it.sources.map((s) => s.url).includes(r.source_url)
  })
  assert.ok(cited.length > 0, 'the count in the rule string is now wrong the other way')
  assert.match(shipped.rule, new RegExp(`for ${cited.length} items the refuting lens re-read a document the item itself cites`), `${cited.length} items, and the rule string says otherwise`)
})

test('r4-trivia-truth-02: no shipped stem prints another shipped item\'s answer', () => {
  const leaks = []
  for (const a of shipped.items) for (const b of shipped.items) {
    if (a === b) continue
    const ans = String(b.answer).replace(/^About /, '').trim()
    if (ans.length >= 4 && a.question.includes(ans)) leaks.push(`${a.id} gives away ${b.id} (${ans})`)
  }
  assert.deepEqual(leaks, [], leaks.join(' | '))
  // the Otis pair leaked semantically, not by string match
  const demo = shipped.items.find((i) => i.id === 'elevator-history-otis-1854-safety-demo')
  assert.ok(!/rope/.test(demo.question), `the stem still answers elevator-culture-otis-1854-rope: ${demo.question}`)
})

test('r4-trivia-truth-03: no item cites Wikipedia first', () => {
  const wikiFirst = shipped.items.filter((i) => /wikipedia\.org/.test(i.sources[0].url)).map((i) => i.id)
  assert.deepEqual(wikiFirst, [], `docs/TRIVIA.md: "Wikipedia only ever as a second source" — ${wikiFirst.join(', ')}`)
  const pd = shipped.items.find((i) => i.id === 'math-numbers-pi-day')
  assert.ok(!pd.sources.some((s) => /piday\.org/.test(s.url)), 'piday.org is still a citation the child is shown')
  assert.match(pd.sources[0].url, /govinfo\.gov/)
})

test('r4-trivia-truth-04: the layout instrument\'s worst case is read from the bank', () => {
  const src = read('tools/drive-scenarios.mjs')
  assert.match(src, /const BANK = JSON\.parse\(readFileSync\(new URL\('\.\.\/data\/trivia\.json'/)
  assert.ok(!/A law says the doors must stay open for a few seconds so everyone has time to get in/.test(src), 'the fixture still carries a choice string no shipped item has')
})
