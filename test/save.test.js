import { test } from 'node:test'
import assert from 'node:assert/strict'
import { serialize, parse, migrate, encodeCode, decodeCode, SAVE_KEY } from '../src/save.js'
import { initialState } from '../src/state.js'
import { fresh, makeRng, startRide, answer } from './_helpers.js'

test('key and round trip', () => {
  assert.equal(SAVE_KEY, 'bacon-elevator.save.v1')
  const rng = makeRng(1)
  let s = startRide(fresh(1), rng)
  s = answer(s, rng, true).state
  const back = parse(serialize(s))
  for (const k of ['lunchbox', 'buildings', 'level', 'step', 'adaptive', 'pinnedStep', 'rulesSeen']) assert.equal(back[k], s[k], k)
  assert.deepEqual(back.settings, s.settings)
  assert.deepEqual(back.history, s.history)
  assert.deepEqual(back.ride.cleared, s.ride.cleared); assert.equal(back.ride.tray, 1); assert.equal(back.ride.floor, 1)
  assert.equal(back.phase, 'lobby'); assert.equal(back.screen, 'lobby')
  const json = JSON.parse(serialize(s))
  assert.equal(json.v, 1)
  assert.ok(!('pool' in json) && !('car' in json) && !('pending' in json), 'runtime fields are not persisted')
})

test('corrupt, missing and hostile blobs → null or defaults, never a throw', () => {
  for (const bad of [null, undefined, '', '   ', '{', '[]', '"x"', '42', 'null', '{"v":1,"lunchbox":"lots"}', '{"__proto__":{"x":1}}']) {
    const r = parse(bad)
    if (r !== null) { assert.equal(r.lunchbox, 0); assert.equal(r.level, 'corner') }
  }
  assert.equal(parse('{'), null); assert.equal(parse('[]'), null); assert.equal(parse(''), null)
  const r = parse(JSON.stringify({ v: 1, lunchbox: -5, level: 'moon', step: 9, settings: { volume: 'loud', speed: 7, passengers: 'always', custom: { min: 90, max: 10 } }, ride: { floor: 99, phase: 'keypad', problem: { kind: 'add' } }, equipped: { doors: 'doors-telescopic' }, facts: 'no', history: { ring: 'x', count: -1 } }))
  assert.equal(r.lunchbox, 0); assert.equal(r.level, 'corner'); assert.equal(r.step, 3)
  assert.equal(r.settings.volume, 50); assert.equal(r.settings.speed, 'normal'); assert.equal(r.settings.passengers, 'sometimes')
  assert.ok(r.settings.custom.min < r.settings.custom.max)
  assert.equal(r.ride.floor, 10); assert.equal(r.ride.phase, 'floor'); assert.equal(r.ride.problem, null)
  assert.equal(r.equipped.doors, 'doors-centre', 'an equipped part that is not unlocked falls back')
  assert.deepEqual(r.facts, { seen: [], right: [], retry: [] })
  assert.deepEqual(r.history.ring, []); assert.equal(r.history.count, 0)
})

test('v0 → v1 migration', () => {
  const v0 = { bacon: 41, levelId: 'hotel', settings: { sound: true } }
  const s = migrate(v0)
  assert.equal(s.v, 1); assert.equal(s.lunchbox, 41); assert.equal(s.level, 'hotel'); assert.equal(s.settings.sound, true); assert.equal(s.settings.volume, 50)
  assert.equal(migrate(null).lunchbox, 0)
  assert.equal(migrate({ v: 0, lunchbox: 3 }).lunchbox, 3)
})

test('share code: BE1- prefix, round trip, garbage → null', () => {
  let s = initialState(77)
  s = { ...s, lunchbox: 123, level: 'sky', step: 2, unlocks: ['doors-telescopic', 'dotmatrix'], equipped: { ...s.equipped, indicator: 'dotmatrix' } }
  const code = encodeCode(s)
  assert.ok(code.startsWith('BE1-'))
  assert.match(code, /^BE1-[A-Za-z0-9_-]+$/)
  const back = decodeCode(code)
  assert.equal(back.lunchbox, 123); assert.equal(back.level, 'sky'); assert.equal(back.step, 2); assert.equal(back.equipped.indicator, 'dotmatrix'); assert.equal(back.salt, 77)
  assert.equal(decodeCode(' ' + code.slice(0, 10) + '\n' + code.slice(10) + ' ').lunchbox, 123, 'whitespace is tolerated')
  for (const bad of ['', 'BE1-', 'BE2-abc', 'hello', 'BE1-!!!!', 'BE1-AAAA', null, 42]) assert.equal(decodeCode(bad), null, String(bad))
})
