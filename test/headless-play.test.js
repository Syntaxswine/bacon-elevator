// The reducer's maths alone, 10 000 questions per level at seed 42 under the perfect policy.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mulberry32 } from '../src/rng.js'
import { LEVELS } from '../src/levels.js'
import { makeProblem, afterAnswer, adaptStep, initialCtx, solve } from '../src/math.js'
import { fresh, makeRng, startRide, playBuilding, run } from './_helpers.js'

const N = 10000

for (const level of LEVELS) {
  test(`${level.id}: ${N} questions at seed 42 — repeat rate < 1 %, no kind over 60 %, step converges`, () => {
    const rng = mulberry32(42)
    let ctx = initialCtx()
    let adapt = { step: 1, streak: 0, stepDowns: 0 }
    const kinds = {}
    let repeats = 0
    const stepAt = []
    for (let i = 0; i < N; i++) {
      const p = makeProblem(level, adapt.step, ctx, rng)
      assert.equal(solve(p), p.answer)
      if (ctx.ring.includes(p.key)) repeats++
      kinds[p.kind] = (kinds[p.kind] || 0) + 1
      ctx = afterAnswer(ctx, p, true)
      adapt = adaptStep(adapt, true, false)
      stepAt.push(adapt.step)
      if (ctx.count % 100 === 0) ctx = { ...ctx, sameSeen: false } // a new building every 100 questions
    }
    assert.ok(repeats / N < 0.01, `repeat rate ${repeats / N}`)
    for (const [k, n] of Object.entries(kinds)) assert.ok(n / N <= 0.6, `${level.id}: ${k} at ${(100 * n / N).toFixed(1)} %`)
    assert.equal(stepAt[5], 3, 'step 3 after six correct answers')
    assert.ok(stepAt.slice(6).every((s) => s === 3), 'the step stays at 3 under the perfect policy')
  })
}

test('the whole reducer plays ten buildings at seed 42 without a fall and banks 16 each', () => {
  const rng = makeRng(42)
  let s = startRide(fresh(42, { seed: 42 }), rng)
  for (let b = 0; b < 10; b++) {
    s = playBuilding(s, rng)
    assert.equal(s.lunchbox, 16 * (b + 1))
    assert.equal(s.history.falls, 0)
    s = run(s, { type: 'next-building' }, rng).state
  }
  assert.equal(s.buildings, 10)
  assert.equal(s.history.answered, 100)
  assert.equal(s.history.correct, 100)
})
