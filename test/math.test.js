import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mulberry32 } from '../src/rng.js'
import { LEVELS, levelById, customLevel } from '../src/levels.js'
import { SETTINGS_DEFAULTS } from '../src/state.js'
import { makeProblem, afterAnswer, solve, keyOf, checkAnswer, adaptStep, initialCtx, textOf, trueText, BLANK, stepOf, validProblem } from '../src/math.js'

const N = 20000
const maxOf = (level, step) => Math.max(...stepOf(level, step).kinds.map((k) => k.max))
const nums = (p) => [p.a, p.b, p.answer].concat(Number.isInteger(p.c) ? [p.c] : [])

for (const level of LEVELS) for (let step = 1; step <= 3; step++) {
  test(`${level.id} step ${step}: ${N} draws stay in range, solve === answer, division exact`, () => {
    const rng = mulberry32(42)
    const bound = maxOf(level, step)
    let ctx = initialCtx()
    for (let i = 0; i < N; i++) {
      const p = makeProblem(level, step, ctx, rng)
      assert.ok(Number.isInteger(p.a) && Number.isInteger(p.b) && Number.isInteger(p.answer), JSON.stringify(p))
      assert.equal(solve(p), p.answer, JSON.stringify(p))
      assert.equal(p.key, keyOf(p))
      assert.equal(p.text, textOf(p))
      assert.ok(p.text.includes(BLANK))
      for (const n of nums(p)) assert.ok(Math.abs(n) <= bound, `${level.id}/${step} out of range: ${JSON.stringify(p)} > ${bound}`)
      if (p.kind === 'div') { assert.ok(p.b >= 2); assert.equal(p.a % p.b, 0) }
      if (p.kind === 'missMul') { assert.ok(p.b >= 2); assert.equal(p.c % p.b, 0) }
      if (level.id !== 'megatall') assert.ok(p.answer >= 0 && p.a >= 0 && p.b >= 0, 'negative below Megatall: ' + JSON.stringify(p))
      if (level.id !== 'corner') assert.ok(p.a >= 2 && p.b >= 2, 'operand 0/1 outside Corner Shop: ' + JSON.stringify(p))
      if (p.kind === 'up' || p.kind === 'down') assert.ok(p.answer >= 0 && p.answer <= 10 && p.a <= 10)
      // no more than 3 of a kind in a row, no ring repeats, no same answer twice, a = b once per building
      if (i > 0) {
        assert.ok(!ctx.ring.includes(p.key) || p.comeback, `ring repeat ${p.key}`)
        assert.notEqual(p.answer, ctx.lastAnswer, `same answer twice: ${p.answer}`)
        assert.ok(!(ctx.kindRun.kind === p.kind && ctx.kindRun.n >= 3), `kind run ${p.kind}`)
        assert.ok(!(ctx.sameSeen && p.a === p.b && !p.pair), `incidental a = b twice`)
      }
      ctx = afterAnswer(ctx, p, true)
    }
  })
}

test('Megatall step 3 draws negatives and Corner Shop draws 0 and 1', () => {
  const rng = mulberry32(1)
  let ctx = initialCtx(), neg = 0
  for (let i = 0; i < 3000; i++) { const p = makeProblem(levelById('megatall'), 3, ctx, rng); if (p.answer < 0) neg++; ctx = afterAnswer(ctx, p, true) }
  assert.ok(neg > 100, 'no negatives at Megatall step 3')
  ctx = initialCtx(); let small = 0
  for (let i = 0; i < 2000; i++) { const p = makeProblem(levelById('corner'), 1, ctx, rng); if (p.a <= 1 || p.b <= 1) small++; ctx = afterAnswer(ctx, p, true) }
  assert.ok(small > 100)
})

test('seed determinism: the same seed replays the same problems', () => {
  const run = () => { const rng = mulberry32(2024); let ctx = initialCtx(); const out = []; for (let i = 0; i < 200; i++) { const p = makeProblem(levelById('office'), 2, ctx, rng); out.push(p.key); ctx = afterAnswer(ctx, p, i % 7 !== 0) } return out }
  assert.deepEqual(run(), run())
})

test('a missed sum comes back verbatim at exactly +5 and +15', () => {
  const rng = mulberry32(9)
  const level = levelById('hotel')
  let ctx = initialCtx()
  const seq = []
  for (let i = 0; i < 40; i++) {
    const p = makeProblem(level, 2, ctx, rng)
    seq.push(p)
    ctx = afterAnswer(ctx, p, i !== 3) // miss the 4th question (count 3)
  }
  const missed = seq[3]
  assert.equal(seq[8].key, missed.key); assert.equal(seq[8].text, missed.text); assert.ok(seq[8].comeback)
  assert.equal(seq[18].key, missed.key); assert.ok(seq[18].comeback)
  for (const i of [4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23]) assert.notEqual(seq[i].key, missed.key, `unexpected return at ${i}`)
  assert.equal(ctx.comeback.length, 0)
})

test('afterAnswer keeps the ring at 20 and skills at 8', () => {
  let ctx = initialCtx()
  const rng = mulberry32(3)
  for (let i = 0; i < 60; i++) { const p = makeProblem(levelById('office'), 3, ctx, rng); ctx = afterAnswer(ctx, p, i % 2 === 0) }
  assert.equal(ctx.ring.length, 20)
  for (const v of Object.values(ctx.skills)) { assert.ok(v.length <= 8); for (const x of v) assert.ok(x === 0 || x === 1) }
  assert.equal(ctx.count, 60)
})

test('a mastered kind (8/8) is drawn at a quarter weight', () => {
  const level = { id: 'x', name: 'x', tag: 'x', steps: [{ kinds: [{ kind: 'add', weight: 1, a: [2, 50], b: [2, 50], max: 100 }, { kind: 'mul', weight: 1, a: [2, 9], b: [2, 9], max: 81 }] }] }
  const count = (skills) => { const rng = mulberry32(11); let n = 0; let ctx = { ...initialCtx(), skills }; for (let i = 0; i < 4000; i++) { const p = makeProblem(level, 1, ctx, rng); if (p.kind === 'add') n++; ctx = { ...afterAnswer(ctx, p, true), skills } } return n / 4000 }
  const even = count({})
  const mastered = count({ add: [1, 1, 1, 1, 1, 1, 1, 1] })
  const notYet = count({ add: [1, 1, 1, 1, 1, 1, 1, 0] })
  // the kind-run cap and the same-answer rule skew the base rate, so compare against it, not against 0.5
  assert.ok(even > 0.4 && even < 0.65, 'even ' + even)
  // the kind-run cap (≤ 3 in a row) forces the mastered kind back every fourth draw, so the drop is bounded
  assert.ok(mastered < even - 0.1 && mastered > 0.2, `mastered ${mastered} vs even ${even}`)
  assert.ok(Math.abs(notYet - even) < 0.05, `7/8 is not mastery: ${notYet} vs ${even}`)
})

test('keyOf sorts commutative pairs; checkAnswer parses typed strings', () => {
  assert.equal(keyOf({ kind: 'add', a: 7, b: 5 }), 'add:5:7')
  assert.equal(keyOf({ kind: 'mul', a: 3, b: 9 }), 'mul:3:9')
  assert.equal(keyOf({ kind: 'sub', a: 9, b: 3 }), 'sub:9:3')
  const p = { kind: 'add', a: 7, b: 5, answer: 12 }
  assert.equal(checkAnswer(p, '12'), true)
  assert.equal(checkAnswer(p, '012'), true)
  assert.equal(checkAnswer(p, '21'), false)
  assert.equal(checkAnswer(p, ''), false)
  assert.equal(checkAnswer(p, 'x'), false)
  assert.equal(checkAnswer({ kind: 'sub', a: 2, b: 5, answer: -3 }, '-3'), true)
  assert.equal(checkAnswer({ kind: 'sub', a: 2, b: 5, answer: -3 }, '−3'), true)
  assert.equal(trueText({ kind: 'add', a: 7, b: 5, answer: 12 }), '7 + 5 = 12')
  assert.equal(textOf({ kind: 'missAdd', a: 3, b: 4, c: 7 }), `3 + ${BLANK} = 7`)
  assert.equal(textOf({ kind: 'up', a: 6, b: 4 }), `6 ▲ 4 = ${BLANK}`)
})

test('adaptStep climbs after 3, drops once per building, stays within 1–3', () => {
  let s = { step: 1, streak: 0, stepDowns: 0 }
  s = adaptStep(s, true, false); assert.equal(s.step, 1); assert.equal(s.delta, 0)
  s = adaptStep(s, true, false); assert.equal(s.step, 1)
  s = adaptStep(s, true, false); assert.equal(s.step, 2); assert.equal(s.delta, 1); assert.equal(s.streak, 0)
  for (let i = 0; i < 3; i++) s = adaptStep(s, true, false)
  assert.equal(s.step, 3)
  for (let i = 0; i < 10; i++) s = adaptStep(s, true, false)
  assert.equal(s.step, 3)
  s = adaptStep(s, false, true); assert.equal(s.step, 2); assert.equal(s.delta, -1); assert.equal(s.stepDowns, 1)
  s = adaptStep(s, false, true); assert.equal(s.step, 2); assert.equal(s.delta, 0)
  s = adaptStep({ step: 1, streak: 2, stepDowns: 0 }, false, true); assert.equal(s.step, 1); assert.equal(s.streak, 0)
  s = adaptStep({ step: 2, streak: 2, stepDowns: 0 }, false, false); assert.equal(s.step, 2); assert.equal(s.streak, 0)
})

test('custom level obeys its knobs', () => {
  const level = customLevel({ ops: ['add', 'sub', 'mul', 'div'], min: 10, max: 40, negatives: true })
  const rng = mulberry32(77)
  let ctx = initialCtx()
  for (let i = 0; i < 3000; i++) {
    const p = makeProblem(level, 1, ctx, rng)
    assert.equal(solve(p), p.answer)
    if (p.kind === 'add' || p.kind === 'sub') { assert.ok(p.a >= 10 && p.a <= 40 && p.b >= 10 && p.b <= 40, JSON.stringify(p)) }
    if (p.kind === 'div') assert.equal(p.a % p.b, 0)
    ctx = afterAnswer(ctx, p, true)
  }
})

// ---- round 1, fixer 3 -------------------------------------------------------------------------

// r1-math-02 / r1-code-hostile-04: the shape customLevel used to build for ops ×, Smallest 100,
// Largest 120 — a range that inverts. Every draw breaks a constraint, and the generator's last
// resort must still be a legal, varied sum inside the entry's own ceiling.
test('an impossible table degrades to a legal, varied sum', () => {
  const level = { id: 'x', name: 'x', tag: 'x', steps: [{ kinds: [{ kind: 'mul', weight: 1, a: [100, 10], b: [2, 10], max: 120 }] }] }
  const rng = mulberry32(5)
  let ctx = initialCtx()
  const counts = new Map()
  for (let i = 0; i < 900; i++) {
    const p = makeProblem(level, 1, ctx, rng)
    assert.equal(p.kind, 'mul')
    assert.equal(solve(p), p.answer)
    assert.ok(!/undefined|NaN/.test(p.text), p.text)
    assert.ok(p.a * p.b <= 120, `${p.text} = ${p.answer} is above the entry's own max`)
    counts.set(p.key, (counts.get(p.key) || 0) + 1)
    ctx = afterAnswer(ctx, p, true)
  }
  assert.ok(counts.size >= 10, `only ${counts.size} distinct sums: ${[...counts.keys()].slice(0, 3)}`)
  assert.ok(Math.max(...counts.values()) <= 180, 'one sum over 20 % of the draws')
  // and the missing-number kinds never render a blank total
  const mrng = mulberry32(6)
  const missing = { id: 'y', name: 'y', tag: 'y', steps: [{ kinds: [{ kind: 'missAdd', weight: 1, a: [15, 20], b: [15, 20], max: 20 }] }] }
  for (let i = 0; i < 200; i++) {
    const p = makeProblem(missing, 1, initialCtx(), mrng)
    assert.ok(!/undefined/.test(p.text), p.text)
    assert.equal(solve(p), p.answer)
  }
})

test('the shipped Custom default never serves an operand of 0 or 1', () => {
  const level = customLevel(SETTINGS_DEFAULTS.custom)
  const rng = mulberry32(31)
  let ctx = initialCtx()
  for (let i = 0; i < 3000; i++) {
    const p = makeProblem(level, 1, ctx, rng)
    assert.ok(p.a >= 2 && p.b >= 2, `${p.text} carries an operand under 2`)
    ctx = afterAnswer(ctx, p, true)
  }
})

// r1-math-07: the latch is meant to stop an INCIDENTAL repeat, not to cap a kind whose every draw
// has a = b. It measured Hotel doubles at 7.99 % against a 12.50 % table weight and Skyscraper
// squares at 9.43 % against 20.00 %, and made a second one in the same building impossible.
test('a declared double or square is not capped by the incidental a = b latch', () => {
  const cases = [
    { id: 'hotel', step: 2, want: 0.11, label: 'doubles' },
    { id: 'sky', step: 3, want: 0.14, label: 'squares' },
  ]
  for (const c of cases) {
    const level = levelById(c.id)
    const rng = mulberry32(42)
    let ctx = initialCtx(), pairs = 0, n = 0
    for (let i = 0; i < 90000; i++) {
      const p = makeProblem(level, c.step, ctx, rng)
      if (p.a === p.b) pairs++
      n++
      ctx = afterAnswer(ctx, p, true)
      if (i % 9 === 8) ctx = { ...ctx, sameSeen: false }   // the game's real per-building latch reset
    }
    assert.ok(pairs / n > c.want, `${c.id} ${c.label} ${(100 * pairs / n).toFixed(2)} % against a ${100 * c.want} % floor`)
  }
})

// r1-elevator-feel-07 (the defensible half): 0 is the teaching point at Corner Shop steps 1 and 2,
// but at step 3 — the top of the easiest building — `2 + 0` and `5 − 5` are not a question for a
// child who loves maths. Measured before: 22 % of step-3 sums carried a 0 operand.
test('Corner Shop keeps 0 as a teaching point at steps 1–2 and drops it at step 3', () => {
  const corner = levelById('corner')
  const rng = mulberry32(8)
  const zeros = [0, 0, 0]
  for (let step = 1; step <= 3; step++) {
    let ctx = initialCtx()
    for (let i = 0; i < 5000; i++) {
      const p = makeProblem(corner, step, ctx, rng)
      if (p.a === 0 || p.b === 0) zeros[step - 1]++
      ctx = afterAnswer(ctx, p, true)
    }
  }
  assert.ok(zeros[0] > 0 && zeros[1] > 0, `0 is the teaching point at steps 1–2: ${zeros.join('/')}`)
  assert.equal(zeros[2], 0, `${zeros[2]}/5000 step-3 sums still carry a 0 operand`)
})


// ---- round 2 -----------------------------------------------------------------------------------

// r2-autism-fit-02 / r2-math-05: `0 + 0 = ?` and `0 - 0 = ?` are the one cell of the bonds table
// with nothing in it, and Corner Shop steps 1 and 2 drew them freely: one fresh save in fifty opened
// on one, and one in six opened on an answer of 0 (`5 - 5`, `2 down 2`). 0 stays a teaching point
// (the test above pins that); a sum with no number in it is not a question.
test('no sum has both operands zero, at any level or step, and no save opens on an answer of 0', () => {
  const levels = LEVELS.concat(customLevel({ ops: ['add', 'sub', 'mul', 'div', 'missAdd', 'up', 'down'], min: 0, max: 20, negatives: true }))
  let both = 0, draws = 0
  for (const level of levels) for (let step = 1; step <= level.steps.length; step++) {
    const rng = mulberry32(77 + step)
    let ctx = initialCtx()
    for (let i = 0; i < 20000; i++) {
      const p = makeProblem(level, step, ctx, rng)
      if (p.a === 0 && p.b === 0) both++
      draws++
      ctx = afterAnswer(ctx, p, true)
      if (i % 9 === 8) ctx = { ...ctx, sameSeen: false }
    }
  }
  assert.ok(draws > 200000, `only ${draws} draws swept`)
  assert.equal(both, 0, `${both}/${draws} sums had nothing in them`)
  // and the very first question of a brand-new save is a sum, not an identity
  const corner = levelById('corner')
  let zeroFirst = 0
  for (let salt = 0; salt < 1500; salt++) {
    const p = makeProblem(corner, 1, initialCtx(), mulberry32(salt))
    if (p.answer === 0) zeroFirst++
  }
  assert.equal(zeroFirst, 0, `${zeroFirst}/1500 fresh saves opened on an answer of 0`)
})

// r2-math-01: afterAnswer queued TWO entries per miss and removed only ONE on a re-miss, so a late
// comeback re-armed itself while its twin was already overdue and fired again on the very next
// question (8.5 % of questions at 60 % accuracy; 31 identical questions in a row once one key
// saturated the 12-entry queue). And because a struggling child always had something due, EVERY
// question was a comeback and the pool collapsed to five sums with no new sum ever drawn again.
test('a struggling child is never asked the same sum twice running, and still meets new sums', () => {
  for (const acc of [0.4, 0.6, 0.8]) {
    for (const id of ['corner', 'office', 'sky']) {
      const level = levelById(id)
      const rng = mulberry32(3)
      const roll = mulberry32(90210)
      let ctx = initialCtx()
      let prev = null, backToBack = 0, comebacks = 0
      const keys = new Set(), lateKeys = new Set()
      const N = 1200
      for (let i = 0; i < N; i++) {
        const p = makeProblem(level, 2, ctx, rng)
        if (prev && p.key === prev) backToBack++
        if (p.comeback) comebacks++
        keys.add(p.key)
        if (i >= N - 200) lateKeys.add(p.key)
        prev = p.key
        ctx = afterAnswer(ctx, p, roll() < acc)
        // the reducer's own clamp on the queue (state.js recordQuestion)
        ctx = { ...ctx, comeback: ctx.comeback.filter((x) => x.due >= ctx.count - 40).slice(-12) }
        if (i % 9 === 8) ctx = { ...ctx, sameSeen: false }
      }
      assert.equal(backToBack, 0, `${id} at ${acc}: ${backToBack}/${N} questions repeated the one before`)
      assert.ok(comebacks / N <= 0.55, `${id} at ${acc}: ${(100 * comebacks / N).toFixed(0)} % comebacks starves the generator`)
      assert.ok(lateKeys.size >= 20, `${id} at ${acc}: only ${lateKeys.size} distinct sums in the last 200 questions (of ${keys.size} all told)`)
    }
  }
})

// r2-code-hostile-07: checkAnswer's regex and typedCap both stop at TYPED_MAX digits, so a problem
// whose answer is wider is a sum the keypad physically cannot enter. No generator draws one; a
// hand-edited save or a hostile BE1- code can, and it fell every time and re-queued itself.
test('validProblem refuses an answer the keypad cannot type', () => {
  const ok = { kind: 'add', a: 999999, b: 0, answer: 999999, text: `999999 + 0 = ${BLANK}`, key: 'add:0:999999' }
  assert.ok(validProblem(ok), 'six digits is the cap, not one under it')
  const wide = { kind: 'add', a: 1234567, b: 1, answer: 1234568, text: `1234567 + 1 = ${BLANK}`, key: 'add:1:1234567' }
  assert.equal(validProblem(wide), null, 'a seven-digit answer must not reach the panel')
  const negWide = { kind: 'sub', a: 1, b: 1234567, answer: -1234566, text: `1 ${'\u2212'} 1234567 = ${BLANK}`, key: 'sub:1:1234567' }
  assert.equal(validProblem(negWide), null)
})
