import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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
//
// r2-math-07: the guard was written as /^numbers to (\d+)$/ — the WHOLE tag — so the moment Hotel's
// tag gained `; tables 2, 5, 10` the regex missed and the level the guard was written for stopped
// being inspected. It now parses the leading bound out of ANY tag, requires every level either to
// name a bound that covers its tables or to say in words that it goes past them, and measures the
// claim on every level and step rather than on Hotel step 3 alone.
const NON_NUMERIC_TAGS = new Set(['sky', 'megatall'])   // `times tables`, `big numbers, and below zero`
test('a tag never undercuts the numbers its own tables can show — every level, every step', () => {
  for (const l of LEVELS) {
    const m = /^numbers to (\d+)/.exec(l.tag)
    if (!m) { assert.ok(NON_NUMERIC_TAGS.has(l.id), `${l.id}: tag "${l.tag}" neither names a bound nor is a whitelisted non-numeric tag`); continue }
    const named = Number(m[1])
    assert.ok(named >= levelBound(l) || /tables/.test(l.tag),
      `${l.id}: tag says ${named}, tables reach ${levelBound(l)}, and the tag does not name the tables`)
  }
  // …and the direct measurement, which no tag rewrite can dodge, on every row of every table
  for (const l of LEVELS) {
    const m = /^numbers to (\d+)/.exec(l.tag)
    if (!m || /tables/.test(l.tag) || NON_NUMERIC_TAGS.has(l.id)) continue
    const named = Number(m[1])
    for (let step = 1; step <= 3; step++) {
      const rng = mulberry32(42)
      let ctx = initialCtx(), over = 0
      for (let i = 0; i < 8000; i++) {
        const p = makeProblem(l, step, ctx, rng)
        if ([p.a, p.b, p.answer].concat(Number.isInteger(p.c) ? [p.c] : []).some((n) => Math.abs(n) > named)) over++
        ctx = afterAnswer(ctx, p, true)
        if (i % 9 === 8) ctx = { ...ctx, sameSeen: false }
      }
      assert.equal(over, 0, `${l.id} step ${step}: ${over}/8000 draws above the ${named} its tag names`)
    }
  }
  // Hotel is the level the guard was written for: its tag must still name the tables it reaches past
  const hotel = LEVELS.find((l) => l.id === 'hotel')
  assert.ok(levelBound(hotel) > 20 && /tables/.test(hotel.tag), `Hotel reaches ${levelBound(hotel)} and its tag is "${hotel.tag}"`)
})

// r2-math-04: Skyscraper step 1 was Office Block step 3's mul/div rows verbatim, so every one of
// its 126 reachable sums was already reachable at Office step 3 (which serves 5 500 more besides).
// A child who had just proved Office step 3 was promoted, on the screen that says `Try Skyscraper?`,
// into a strictly easier and 45x narrower pool, and had to re-earn six answers to climb back.
test('a promotion never narrows the question set: each level opens on material the last one could not reach', () => {
  const keysOf = (level, step) => {
    const rng = mulberry32(7)
    let ctx = initialCtx()
    const out = new Set()
    for (let i = 0; i < 40000; i++) {
      const p = makeProblem(level, step, ctx, rng)
      out.add(p.key)
      ctx = afterAnswer(ctx, p, true)
      if (i % 9 === 8) ctx = { ...ctx, sameSeen: false }
    }
    return out
  }
  for (let i = 0; i < LEVELS.length - 1; i++) {
    const from = LEVELS[i], to = LEVELS[i + 1]
    const was = keysOf(from, 3), now = keysOf(to, 1)
    const fresh = [...now].filter((k) => !was.has(k))
    assert.ok(fresh.length > 0, `${to.id} step 1 is a strict subset of ${from.id} step 3: nothing new to meet`)
    assert.ok(fresh.length / now.size >= 0.1, `${to.id} step 1: only ${fresh.length} of ${now.size} sums are new after ${from.id} step 3`)
    assert.ok(levelBound(to) >= levelBound(from), `${to.id} tops out at ${levelBound(to)}, below ${from.id}'s ${levelBound(from)}`)
  }
})

// r2-elevator-feel-03 / r2-code-hostile-08: dead data in the file a maintainer reads to learn what
// a level IS, and a Custom tag that implied the knobs governed the floor moves.
test('a level declares nothing the game does not read, and Custom says where its floor moves live', () => {
  const src = readFileSync(new URL('../src/levels.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '')
  assert.ok(!/\bfloors:\s*\d/.test(src), 'levels.js declares a `floors:` field again; nothing reads it')
  for (const l of LEVELS) assert.equal(l.floors, undefined, `${l.id} carries a dead floors field`)
  const c = customLevel({ ops: ['add', 'up', 'down'], min: 9997, max: 9999 })
  assert.match(c.tag, /▲▼ inside the building, 0 to 10/, `Custom tag "${c.tag}" hides that ▲▼ ignore the knobs`)
  assert.ok(!/▲▼/.test(customLevel({ ops: ['add', 'sub'], min: 0, max: 20 }).tag), 'the clause appears only when a floor move is on')
})
