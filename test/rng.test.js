import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mulberry32, hash32 } from '../src/rng.js'

test('same seed, same sequence', () => {
  const a = mulberry32(7), b = mulberry32(7)
  for (let i = 0; i < 1000; i++) assert.equal(a(), b())
})

test('different seeds differ', () => {
  const a = mulberry32(7), b = mulberry32(8)
  let same = 0
  for (let i = 0; i < 100; i++) if (a() === b()) same++
  assert.ok(same < 3)
})

test('rng() is in [0,1)', () => {
  const r = mulberry32(123)
  for (let i = 0; i < 10000; i++) { const x = r(); assert.ok(x >= 0 && x < 1) }
})

test('int is inclusive at both ends and never outside', () => {
  const r = mulberry32(99)
  const seen = new Set()
  for (let i = 0; i < 5000; i++) { const x = r.int(3, 6); assert.ok(x >= 3 && x <= 6); assert.ok(Number.isInteger(x)); seen.add(x) }
  assert.deepEqual([...seen].sort(), [3, 4, 5, 6])
  assert.equal(r.int(5, 5), 5)
  assert.equal(r.int(9, 2), 9) // hi < lo → lo
})

test('pick returns members; count and skip replay', () => {
  const r = mulberry32(5)
  const arr = ['a', 'b', 'c']
  for (let i = 0; i < 100; i++) assert.ok(arr.includes(r.pick(arr)))
  assert.equal(r.count, 100)
  const s = mulberry32(5); s.skip(100)
  assert.equal(s(), r())
  assert.equal(r.seed, 5)
})

test('seed 0 still produces numbers; hash32 is stable and 32-bit', () => {
  const r = mulberry32(0)
  assert.notEqual(r(), r())
  assert.equal(hash32('bacon'), hash32('bacon'))
  assert.notEqual(hash32('bacon'), hash32('bacoN'))
  const h = hash32('elevator')
  assert.ok(Number.isInteger(h) && h >= 0 && h <= 0xFFFFFFFF)
})
