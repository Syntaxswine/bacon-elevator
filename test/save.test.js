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
  // floor 99 clamps to 10, and floor 10 IS the roof: a corrupt top-of-the-building save is banked,
  // not dropped ("nothing is ever taken away"). It used to land in phase 'floor' with target 1 —
  // a building where the one lit button was below the car and `move` was refused: dead.
  assert.equal(r.ride.floor, 10); assert.equal(r.ride.phase, 'roof'); assert.equal(r.ride.target, 10); assert.equal(r.ride.problem, null)
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


// ---------------------------------------------------------------------------------------------
// Round 1, fixer 2: the save is the doorway into every dead state the reducer can be parked in.
// ---------------------------------------------------------------------------------------------

test('r1-code-hostile-01: a save taken at the Fact card resumes with the passenger DONE', () => {
  // The natural player path: the SAVE effect fires with `choice`, so the blob at the instant of the
  // Fact card is {phase:'fact', floor:4, target:4}. A plain phase rewrite kept target 4 and dropped
  // the passengersDone bookkeeping: floor 4 was the only live button and it was inert, forever.
  const r = parse(JSON.stringify({ v: 1, ride: { phase: 'fact', floor: 4, target: 4, passengersDone: [] } }))
  assert.equal(r.ride.phase, 'floor')
  assert.equal(r.ride.target, 5)
  assert.deepEqual(r.ride.passengersDone, [4])
})

test('r1-code-hostile-06: a comeback entry gets the same validator the live problem gets', () => {
  const r = parse(JSON.stringify({ v: 1, ride: { phase: 'floor', floor: 2, target: 3, comeback: [{ problem: {}, due: 0 }] } }))
  assert.deepEqual(r.ride.comeback, [], 'isObj(x.problem) let {} through to the renderer')
  const t = parse(JSON.stringify({ v: 1, ride: { phase: 'floor', floor: 2, target: 3, comeback: [{ problem: { kind: 'add', a: 1, b: 1, answer: 2, text: 42, key: 'add:1:1' }, due: 0 }] } }))
  assert.deepEqual(t.ride.comeback, [], 'text:42 threw `text.split is not a function` out of equationHTML')
  // a real one survives
  const good = { kind: 'add', a: 1, b: 1, answer: 2, text: '1 + 1 = \u25AE', key: 'add:1:1' }
  const g = parse(JSON.stringify({ v: 1, ride: { phase: 'floor', floor: 2, target: 3, comeback: [{ problem: good, due: 0 }] } }))
  assert.equal(g.ride.comeback.length, 1)
  // and a problem whose stored answer is a lie is not a problem
  const lie = parse(JSON.stringify({ v: 1, ride: { phase: 'keypad', floor: 2, target: 3, problem: { ...good, answer: 99 } } }))
  assert.equal(lie.ride.problem, null); assert.equal(lie.ride.phase, 'floor')
})

test('r1-code-hostile-09: counters are range-checked, not merely type-checked', () => {
  // Number.isInteger(1e308) is true. A lunchbox of 1e308 prints "1e+308" on the top bar and never
  // increments again, because 1e308 + 3 === 1e308.
  assert.equal(parse('{"v":1,"lunchbox":1e308}').lunchbox, 1e9)
  assert.ok(String(parse('{"v":1,"lunchbox":1e308}').lunchbox).indexOf('e') < 0, 'the top bar must never print exponent notation')
  assert.equal(parse('{"v":1,"lunchbox":9007199254740993}').lunchbox, 1e9)
  assert.equal(parse('{"v":1,"buildings":1e15}').buildings, 1e6)
  assert.equal(parse('{"v":1,"lunchbox":1.7}').lunchbox, 1)
  assert.equal(parse('{"v":1,"lunchbox":-5}').lunchbox, 0)
  assert.equal(parse('{"v":1,"history":{"count":1e308}}').history.count, 1e9)
  // banked can never exceed the tray, or the roof card says the tray gave a negative number
  const r = parse(JSON.stringify({ v: 1, ride: { phase: 'floor', floor: 2, target: 3, tray: 4, banked: 900 } }))
  assert.equal(r.ride.banked, 4)
})

test('r1-code-hostile-05: the roof card round-trips, and garbage in it does not', () => {
  // `dir`, `help` and `midBanked` joined the card in round 4 (r4-math-05, r4-math-01,
  // r4-code-hostile-02): a card that round-trips without them prints the wrong sentence on reload.
  const card = { gained: 6, bonus: 3, unlocked: ['dotmatrix'], plaques: [], offer: 'hotel', dir: 'up', help: false, offerTaken: null, lunchboxBefore: 12, midBanked: 3 }
  const r = parse(JSON.stringify({ v: 1, ride: { phase: 'roof', floor: 10, target: 10, roofCard: card } }))
  assert.deepEqual(r.ride.roofCard, card)
  const bad = parse(JSON.stringify({ v: 1, ride: { phase: 'roof', floor: 10, target: 10, roofCard: { gained: 1e308, bonus: -4, offer: 'moon', unlocked: 'x' } } }))
  assert.equal(bad.ride.roofCard.gained, 1e9); assert.equal(bad.ride.roofCard.bonus, 0); assert.equal(bad.ride.roofCard.offer, null)
  assert.deepEqual(bad.ride.roofCard.unlocked, [])
  assert.equal(bad.ride.roofCard.dir, null); assert.equal(bad.ride.roofCard.help, false); assert.equal(bad.ride.roofCard.midBanked, 0)
})

test('a mid-timeline save keeps its phase: hydrate settles it, the invariant does not pre-empt it', () => {
  const mid = parse(JSON.stringify({ v: 1, ride: { phase: 'keypad', floor: 6, target: 7, problem: { kind: 'add', a: 7, b: 5, answer: 12, text: '7 + 5 = \u25AE', key: 'add:5:7' }, retrying: true, inFlight: { name: 'fall', to: -1 } } }))
  assert.equal(mid.ride.inFlight.name, 'fall')
  assert.equal(mid.ride.phase, 'keypad', 'the in-flight phase is settled by hydrate(), not rewritten here')
})
