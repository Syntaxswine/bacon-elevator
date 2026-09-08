import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mulberry32 } from '../src/rng.js'
import { LEVELS, LEVEL_ORDER, levelById, customLevel, levelBound } from '../src/levels.js'
import { KINDS, makeProblem, afterAnswer, initialCtx, digitsNeeded } from '../src/math.js'

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

test('every level carries a short chip label of at most 6 characters', () => {
  for (const l of LEVELS) {
    assert.ok(typeof l.short === 'string' && l.short.length > 0, `${l.id}: no short label`)
    assert.ok(l.short.length <= 6, `${l.id}: short label "${l.short}" is ${l.short.length} characters`)
  }
  assert.ok(customLevel({}).short.length <= 6)
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

// ---- round 1, fixer 3 -------------------------------------------------------------------------

// r1-math-09 / r1-code-hostile-04: a Custom table a parent can reach through the Grown-ups steppers
// must have legal draws in it. Two shapes had none: mul/div derived a: [max(2,min), √max], which
// INVERTS whenever min > √max (rng.int returns lo when hi < lo), and add needs a + b ≤ max, which
// has no legal pair whenever 2·min > max. The generator then served one corner of the range for
// ever, above the parent's own Largest number, or rendered `= undefined`.
test('every reachable Custom setting is satisfiable, non-degenerate and honestly tagged', () => {
  const OPSETS = [['add'], ['sub'], ['mul'], ['div'], ['add', 'sub'], ['mul', 'div'], ['add', 'sub', 'mul', 'div'], ['missAdd'], ['up'], ['down']]
  const NUMS = [0, 5, 10, 15, 20, 25, 50, 100, 200]
  let configs = 0, degenerate = [], overTag = [], undef = [], wide = []
  for (const ops of OPSETS) for (const min of NUMS) for (const max of NUMS) {
    if (min > max - 2) continue
    configs++
    const level = customLevel({ ops, min, max, negatives: false })
    const tagHi = Number(/numbers (\d+) to (\d+)/.exec(level.tag)[2])
    const rng = mulberry32(11)
    const counts = new Map()
    let ctx = initialCtx()
    for (let i = 0; i < 900; i++) {
      const p = makeProblem(level, 1, ctx, rng)
      counts.set(p.key, (counts.get(p.key) || 0) + 1)
      if (/undefined|NaN/.test(p.text)) undef.push(`${ops}/${min}/${max}: ${p.text}`)
      const nums = [p.a, p.b, p.answer].concat(Number.isInteger(p.c) ? [p.c] : [])
      if (nums.some((n) => Math.abs(n) > tagHi)) overTag.push(`${ops}/${min}/${max} tag ${level.tag}: ${p.text} = ${p.answer}`)
      if (digitsNeeded(p) > 4) wide.push(`${ops}/${min}/${max}: ${p.text} = ${p.answer}`)
      ctx = afterAnswer(ctx, p, true)
    }
    const top = Math.max(...counts.values())
    if (counts.size < 10 || top > 450) degenerate.push(`${ops}/${min}/${max}: ${counts.size} distinct keys, top ${top}/900`)
    ctx = null
  }
  assert.ok(configs >= 300, `only ${configs} configurations swept`)
  assert.deepEqual(undef.slice(0, 3), [], `${undef.length} draws rendered undefined`)
  assert.deepEqual(degenerate.slice(0, 3), [], `${degenerate.length}/${configs} degenerate configurations`)
  assert.deepEqual(overTag.slice(0, 3), [], `${overTag.length} draws above the number in the tag`)
  assert.deepEqual(wide.slice(0, 3), [], `${wide.length} answers too wide for the keypad`)
})

// r1-math-06: nothing tied a tag to the table it describes, so Hotel could say `numbers to 20`
// while its step-3 × table served 10 × 10 = 100.
test('a tag never undercuts the numbers its own tables can show', () => {
  for (const l of LEVELS) {
    const m = /^numbers to (\d+)$/.exec(l.tag)
    if (m) assert.ok(Number(m[1]) >= levelBound(l), `${l.id}: tag says ${m[1]}, tables reach ${levelBound(l)}`)
  }
  // and the direct measurement, which no tag rewrite can dodge
  const hotel = LEVELS.find((l) => l.id === 'hotel')
  const rng = mulberry32(42)
  let ctx = initialCtx(), over = 0
  for (let i = 0; i < 10000; i++) {
    const p = makeProblem(hotel, 3, ctx, rng)
    if ([p.a, p.b, p.answer].concat(Number.isInteger(p.c) ? [p.c] : []).some((n) => n > 20)) over++
    ctx = afterAnswer(ctx, p, true)
    if (i % 9 === 8) ctx = { ...ctx, sameSeen: false }
  }
  assert.ok(over === 0 || /tables/.test(hotel.tag), `${over}/10000 draws above 20 and the tag does not name the tables: "${hotel.tag}"`)
})
