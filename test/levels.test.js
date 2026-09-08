import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LEVELS, LEVEL_ORDER, levelById, customLevel } from '../src/levels.js'
import { KINDS } from '../src/math.js'

test('five levels in the design order, exactly 3 steps each, ≥ 1 kind per step', () => {
  assert.deepEqual(LEVEL_ORDER, ['corner', 'hotel', 'office', 'sky', 'megatall'])
  for (const l of LEVELS) {
    assert.equal(l.steps.length, 3, l.id)
    assert.ok(typeof l.name === 'string' && l.name && typeof l.tag === 'string' && l.tag)
    for (const s of l.steps) {
      assert.ok(s.kinds.length >= 1)
      for (const k of s.kinds) {
        assert.ok(KINDS.includes(k.kind), `${l.id}: kind ${k.kind}`)
        assert.ok(k.weight > 0)
        assert.ok(Number.isFinite(k.max))
      }
    }
  }
})

test('no single kind carries more than 60 % of a step by weight', () => {
  for (const l of LEVELS) l.steps.forEach((s, i) => {
    const total = s.kinds.reduce((x, k) => x + k.weight, 0)
    const byKind = {}
    for (const k of s.kinds) byKind[k.kind] = (byKind[k.kind] || 0) + k.weight
    for (const [kind, w] of Object.entries(byKind)) assert.ok(w / total <= 0.6, `${l.id} step ${i + 1}: ${kind} ${w}/${total}`)
  })
})

test('negatives only at Megatall step 3; operands 0/1 only at Corner Shop', () => {
  for (const l of LEVELS) l.steps.forEach((s, i) => {
    for (const k of s.kinds) {
      if (k.negatives) assert.ok(l.id === 'megatall' && i === 2, `${l.id} step ${i + 1} allows negatives`)
      if (l.id !== 'corner') {
        if (k.a) assert.ok(k.a[0] >= 2, `${l.id} step ${i + 1} ${k.kind} a from ${k.a[0]}`)
        if (k.b) assert.ok(k.b[0] >= 2, `${l.id} step ${i + 1} ${k.kind} b from ${k.b[0]}`)
      }
    }
  })
})

test('levelById and customLevel', () => {
  assert.equal(levelById('hotel').name, 'Hotel')
  assert.equal(levelById('nope'), null)
  assert.equal(levelById('custom'), null)
  const c = customLevel({ ops: ['add', 'mul'], min: 0, max: 50, negatives: false })
  assert.equal(c.id, 'custom')
  assert.equal(c.steps.length, 1)
  assert.deepEqual(c.steps[0].kinds.map((k) => k.kind), ['add', 'mul'])
  const d = customLevel({ ops: [], min: 30, max: 10 })
  assert.equal(d.steps[0].kinds.length, 1)
  assert.ok(d.steps[0].kinds[0].a[1] > d.steps[0].kinds[0].a[0])
})
