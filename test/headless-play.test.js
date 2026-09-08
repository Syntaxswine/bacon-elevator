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


// r2-math-08: the two headline generator tests above run the PERFECT policy, so ctx.comeback is
// always empty and the `repeat rate < 1 %` assertion cannot reach the branch at math.js's `due`
// gate at all — the instrument confirmed a claim in the only regime where it is trivially true.
// This is the same 10 000-question sweep with a child who misses, which is the regime the comeback
// queue exists for and the one in which it collapsed the pool to five sums.
for (const acc of [0.6, 0.4]) {
  test(`a child at ${100 * acc} % accuracy: no back-to-back repeat, and new sums keep arriving`, () => {
    for (const level of LEVELS) {
      const rng = mulberry32(42)
      const roll = mulberry32(2024)
      let ctx = initialCtx()
      let adapt = { step: 1, streak: 0, stepDowns: 0 }
      let prev = null, backToBack = 0
      const late = new Set()
      const N = 2000
      for (let i = 0; i < N; i++) {
        const p = makeProblem(level, adapt.step, ctx, rng)
        assert.equal(solve(p), p.answer)
        if (prev && p.key === prev) backToBack++
        if (i >= N - 300) late.add(p.key)
        prev = p.key
        const right = roll() < acc
        ctx = afterAnswer(ctx, p, right)
        // the reducer's own clamp on the queue (src/state.js recordQuestion)
        ctx = { ...ctx, comeback: ctx.comeback.filter((x) => x.due >= ctx.count - 40).slice(-12) }
        adapt = adaptStep(adapt, right, !right)
        if (ctx.count % 10 === 0) { ctx = { ...ctx, sameSeen: false }; adapt = { ...adapt, stepDowns: 0 } }
      }
      assert.equal(backToBack, 0, `${level.id}: ${backToBack}/${N} questions repeated the one before`)
      assert.ok(late.size >= 25, `${level.id}: only ${late.size} distinct sums in the last 300 questions`)
    }
  })
}
