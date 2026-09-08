// The keypad must be able to express the answer to the problem it is SHOWING.
// r1-math-01: the panel's capability was derived from the level+step, and the problem outlives the
// step that drew it (a fall drops the step, a pinned-step change moves it, a Custom knob rebuilds
// the level, a comeback re-serves an older sum). A negative-answer sum on a keypad with no ± key —
// or a five-digit answer under a four-digit cap — is a sum the child cannot enter at all.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mulberry32 } from '../src/rng.js'
import { LEVELS, customLevel } from '../src/levels.js'
import { makeProblem, initialCtx, signKeyLive, digitsNeeded, typedCap, levelAllowsNegatives } from '../src/math.js'

test('the keypad can always express the answer to the problem it is showing', () => {
  const levels = LEVELS.concat(
    customLevel({ ops: ['add', 'sub', 'mul', 'div', 'missAdd'], min: 0, max: 20, negatives: true }),
    customLevel({ ops: ['add', 'sub', 'mul', 'div', 'missAdd'], min: 0, max: 20, negatives: false }),
  )
  const rng = mulberry32(4242)
  let negatives = 0
  for (const level of levels) {
    for (let drawStep = 1; drawStep <= level.steps.length; drawStep++) {
      for (let i = 0; i < 2000; i++) {
        const p = makeProblem(level, drawStep, initialCtx(), rng)
        if (p.answer < 0) negatives++
        // The panel may be showing ANY step of this level — the adaptive rule moves it under the
        // problem's feet — so every panel step must be able to answer every drawn problem.
        for (let panelStep = 1; panelStep <= 3; panelStep++) {
          assert.ok(!(p.answer < 0) || signKeyLive(level, panelStep, p),
            `no ± key for ${p.text} (answer ${p.answer}) on ${level.id} panel step ${panelStep}`)
          assert.ok(digitsNeeded(p) <= typedCap(p),
            `answer ${p.answer} needs ${digitsNeeded(p)} digits, cap is ${typedCap(p)}`)
        }
      }
    }
  }
  assert.ok(negatives > 0, 'the sweep never drew a negative answer, so it proves nothing')
})

test('the ± key is a property of the level, not of the step', () => {
  const mega = LEVELS.find((l) => l.id === 'megatall')
  assert.equal(levelAllowsNegatives(mega), true)
  for (let step = 1; step <= 3; step++) assert.equal(signKeyLive(mega, step, null), true)
  const corner = LEVELS.find((l) => l.id === 'corner')
  assert.equal(levelAllowsNegatives(corner), false)
  assert.equal(signKeyLive(corner, 1, null), false)
  // …and a negative answer turns it on wherever it is parked (a comeback, a corrupt save, Custom).
  assert.equal(signKeyLive(corner, 1, { answer: -3 }), true)
})

test('the digit cap is derived from the answer, never a bare constant', () => {
  assert.equal(typedCap({ answer: 12 }), 4)
  assert.equal(typedCap({ answer: 10000 }), 5)
  assert.equal(typedCap({ answer: -10000 }), 5)
  assert.equal(typedCap({ answer: 12345678 }), 6)   // TYPED_MAX, matching parseTyped's own regex
})
