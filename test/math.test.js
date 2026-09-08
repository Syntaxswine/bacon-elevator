import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mulberry32 } from '../src/rng.js'
import { LEVELS, levelById, customLevel } from '../src/levels.js'
import { makeProblem, afterAnswer, solve, keyOf, checkAnswer, adaptStep, initialCtx, textOf, trueText, BLANK, stepOf } from '../src/math.js'

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
        assert.ok(!(ctx.sameSeen && p.a === p.b), `a = b twice`)
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
