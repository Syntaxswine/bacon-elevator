import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reduce, initialState, PARTS } from '../src/state.js'
import { serialize, parse } from '../src/save.js'
import { fresh, makeRng, run, startRide, answer, answerTrivia, playBuilding, typeValue } from './_helpers.js'

test('ride-start: rules first, then the ride at G with Press 1', () => {
  const rng = makeRng(1)
  let s = fresh(1)
  assert.equal(s.phase, 'lobby')
  const r = run(s, { type: 'ride-start' }, rng)
  s = r.state
  assert.equal(s.screen, 'rules'); assert.equal(s.phase, 'floor')
  assert.equal(s.ride.floor, 0); assert.equal(s.ride.target, 1); assert.equal(s.car.floor, 0); assert.equal(s.car.doors, 'open')
  s = run(s, { type: 'card-continue' }, rng).state
  assert.equal(s.screen, 'ride'); assert.equal(s.rulesSeen, true)
  // only the lit target is live
  assert.equal(reduce(s, { type: 'press-floor', floor: 2 }, rng).state, s)
  s = run(s, { type: 'press-floor', floor: 1 }, rng).state
  assert.equal(s.phase, 'keypad'); assert.ok(s.ride.problem); assert.equal(s.car.carCall, 1)
})

test('go outside keypad|repair and choice outside trivia are no-ops; digits cap at 4', () => {
  const rng = makeRng(2)
  let s = startRide(fresh(2), rng)
  assert.equal(reduce(s, { type: 'go' }, rng).state, s)
  assert.equal(reduce(s, { type: 'choice', i: 0 }, rng).state, s)
  assert.equal(reduce(s, { type: 'digit', d: '5' }, rng).state, s)
  s = run(s, { type: 'press-floor', floor: 1 }, rng).state
  assert.equal(reduce(s, { type: 'go' }, rng).state, s, 'GO with nothing typed is inert')
  s = typeValue(s, 12345, rng)
  assert.equal(s.ride.typed, '1234')
  s = reduce(s, { type: 'backspace' }, rng).state
  assert.equal(s.ride.typed, '123')
  assert.equal(reduce(s, { type: 'toggle-sign' }, rng).state, s, 'no ± below Megatall')
})

test('a correct answer rides one floor: doors, one ding, bacon, tray +1, then Press next', () => {
  const rng = makeRng(3)
  let s = startRide(fresh(3), rng)
  const r = answer(s, rng, true)
  const tl = r.raw.effects.find((e) => e.type === 'timeline')
  assert.ok(tl && tl.name === 'ride')
  assert.equal(r.raw.state.phase, 'moving')
  assert.deepEqual(tl.steps.filter((x) => x.ev === 'ding').length, 1)
  assert.ok(tl.steps.some((x) => x.ev === 'doors-closing') && tl.steps.some((x) => x.ev === 'bacon'))
  assert.ok(tl.steps.find((x) => x.ev === 'doors-closing').t >= 600, 'the tick shows before the doors close')
  s = r.state
  assert.equal(s.phase, 'floor'); assert.equal(s.ride.floor, 1); assert.equal(s.ride.target, 2)
  assert.equal(s.ride.tray, 1); assert.deepEqual(s.ride.cleared, [1]); assert.equal(s.car.floor, 1); assert.equal(s.car.doors, 'open')
  assert.equal(s.history.correct, 1); assert.equal(s.history.answered, 1)
})

test('second try: the first miss clears the entry with a calm line; only the second falls', () => {
  const rng = makeRng(4)
  let s = startRide(fresh(4), rng)
  assert.equal(s.settings.secondTry, true)
  const first = answer(s, rng, false)
  assert.equal(first.raw.effects.some((e) => e.type === 'timeline'), false)
  s = first.state
  assert.equal(s.phase, 'keypad'); assert.equal(s.ride.typed, ''); assert.equal(s.message, 'Try once more.'); assert.equal(s.ride.tries, 1)
  assert.ok(!/[!✗]|oops|wrong/i.test(s.message))
  const second = answer(s, rng, false)
  const tl = second.raw.effects.find((e) => e.type === 'timeline')
  assert.ok(tl && tl.name === 'fall')
  assert.equal(second.raw.state.phase, 'falling')
  assert.equal(tl.steps.find((x) => x.ev === 'doors-closing').t, 1200, 'the true equation shows for 1.2 s before anything moves')
  assert.equal(tl.steps.filter((x) => x.ev === 'ding' || x.ev === 'ding2').length, 0)
  assert.ok(tl.duration <= 5000)
  s = second.state
  assert.equal(s.phase, 'repair'); assert.equal(s.ride.floor, -1); assert.equal(s.car.floor, -1); assert.equal(s.history.falls, 1)

  // second try off: the first miss falls
  let t = fresh(5)
  t = reduce(t, { type: 'set-setting', key: 'secondTry', value: false }, rng).state
  t = startRide(t, rng)
  const miss = answer(t, rng, false)
  assert.equal(miss.raw.state.phase, 'falling')
})

test('a fall keeps tray and cleared; Try again asks the SAME sum; the express ride collects the strip', () => {
  const rng = makeRng(6)
  let s = startRide(fresh(6), rng)
  for (let i = 0; i < 3; i++) s = answer(s, rng, true).state
  assert.equal(s.ride.floor, 3); assert.equal(s.ride.tray, 3)
  const stepBefore = s.step
  s = answer(s, rng, false).state // try once more
  const key = s.ride.problem.key
  s = answer(s, rng, false).state // the fall
  assert.equal(s.phase, 'repair'); assert.equal(s.ride.tray, 3); assert.deepEqual(s.ride.cleared, [1, 2, 3]); assert.equal(s.ride.target, 4)
  assert.equal(s.ride.typedWrong, String(s.ride.problem.answer + 1))
  assert.ok(s.step <= stepBefore)
  s = run(s, { type: 'card-continue' }, rng).state
  assert.equal(s.phase, 'keypad'); assert.equal(s.ride.problem.key, key); assert.equal(s.ride.typed, '')
  const r = answer(s, rng, true)
  const tl = r.raw.effects.find((e) => e.type === 'timeline')
  assert.equal(tl.name, 'express')
  assert.deepEqual(tl.steps.filter((x) => x.ev === 'sill').map((x) => x.floor), [0, 1, 2, 3, 4])
  s = r.state
  assert.equal(s.ride.floor, 4); assert.equal(s.ride.tray, 4); assert.deepEqual(s.ride.cleared, [1, 2, 3, 4])
  assert.equal(s.phase, 'trivia', 'floor 4 is a passenger floor')
  // the missed sum is queued for +5 and +15
  assert.equal(s.ride.comeback.length, 2)
  assert.deepEqual(s.ride.comeback.map((c) => c.due), [s.ride.ctx.count + 5 - 1, s.ride.ctx.count + 15 - 1].map((x) => x))
})

test('wrong again after a fall: no second fall, the card returns, the strip stays on its plate', () => {
  const rng = makeRng(7)
  let s = fresh(7)
  s = reduce(s, { type: 'set-setting', key: 'secondTry', value: false }, rng).state
  s = startRide(s, rng)
  s = answer(s, rng, true).state
  s = answer(s, rng, false).state
  assert.equal(s.phase, 'repair'); assert.equal(s.ride.floor, -1)
  s = run(s, { type: 'card-continue' }, rng).state
  const r = answer(s, rng, false)
  assert.equal(r.raw.effects.some((e) => e.type === 'timeline'), false)
  s = r.state
  assert.equal(s.phase, 'repair'); assert.equal(s.ride.floor, -1); assert.equal(s.history.falls, 1); assert.equal(s.ride.forfeit, true)
  s = run(s, { type: 'card-continue' }, rng).state
  s = answer(s, rng, true).state
  assert.equal(s.ride.floor, 2); assert.equal(s.ride.tray, 1); assert.deepEqual(s.ride.cleared, [1]); assert.equal(s.ride.target, 3)
  assert.equal(s.phase, 'floor')
})

test('a wrong choice never changes the floor; a right one is +2; the card waits for Got it', () => {
  const rng = makeRng(8)
  let s = startRide(fresh(8), rng)
  for (let i = 0; i < 4; i++) s = answer(s, rng, true).state
  assert.equal(s.phase, 'trivia'); assert.equal(s.trivia.choices.length, 3)
  assert.equal(s.trivia.choices[s.trivia.answer], s.trivia.fact.answer)
  const tray = s.ride.tray
  const wrong = (s.trivia.answer + 1) % 3
  const r = reduce(s, { type: 'choice', i: wrong }, rng)
  assert.equal(r.effects.some((e) => e.type === 'timeline'), false)
  s = r.state
  assert.equal(s.phase, 'fact'); assert.equal(s.ride.floor, 4); assert.equal(s.car.floor, 4); assert.equal(s.ride.tray, tray)
  assert.equal(s.trivia.result, 'wrong'); assert.equal(s.trivia.chosen, wrong)
  assert.ok(s.facts.seen.includes(s.trivia.fact.id)); assert.equal(s.facts.retry.length, 1)
  assert.equal(reduce(s, { type: 'choice', i: s.trivia.answer }, rng).state, s, 'choice outside trivia is a no-op')
  s = run(s, { type: 'card-continue' }, rng).state
  assert.equal(s.phase, 'floor'); assert.equal(s.ride.target, 5); assert.deepEqual(s.ride.passengersDone, [4])
  // floor 8: right answer
  for (let i = 0; i < 4; i++) s = answer(s, rng, true).state
  assert.equal(s.phase, 'trivia'); assert.equal(s.ride.floor, 8)
  const t8 = s.ride.tray
  s = reduce(s, { type: 'choice', i: s.trivia.answer }, rng).state
  assert.equal(s.ride.tray, t8 + 2); assert.equal(s.trivia.result, 'right'); assert.equal(s.ride.floor, 8)
})

test('the roof banks the tray with +3; the next building starts at G; the lunchbox never shrinks', () => {
  const rng = makeRng(9)
  let s = startRide(fresh(9), rng)
  s = playBuilding(s, rng)
  assert.equal(s.phase, 'roof'); assert.equal(s.screen, 'roof'); assert.equal(s.ride.floor, 10)
  assert.equal(s.roof.gained, 13); assert.equal(s.lunchbox, 16); assert.equal(s.buildings, 1)
  assert.equal(s.roof.offer, null, 'no offer after one building')
  s = run(s, { type: 'next-building' }, rng).state
  assert.equal(s.phase, 'floor'); assert.equal(s.ride.floor, 0); assert.equal(s.ride.tray, 0); assert.equal(s.car.floor, 0)
  s = playBuilding(s, rng)
  assert.equal(s.lunchbox, 32)
  assert.equal(s.unlocks.includes('doors-telescopic'), true, '18 unlocks the telescopic doors')
})

test('the roof offers the next level only after two step-3 buildings with ≤ 1 fall', () => {
  const rng = makeRng(10)
  let s = startRide(fresh(10), rng)
  s = playBuilding(s, rng)
  assert.equal(s.step, 3); assert.equal(s.step3Run, 1); assert.equal(s.roof.offer, null)
  s = run(s, { type: 'next-building' }, rng).state
  s = playBuilding(s, rng)
  assert.equal(s.step3Run, 2); assert.equal(s.roof.offer, 'hotel')
  const stay = reduce(s, { type: 'offer', accept: false }, rng).state
  assert.equal(stay.level, 'corner'); assert.equal(stay.roof.offer, null)
  const yes = reduce(s, { type: 'offer', accept: true }, rng).state
  assert.equal(yes.level, 'hotel'); assert.equal(yes.step, 1)
  // adaptive off, pinned 1: never step 3, never an offer
  let t = fresh(11)
  t = reduce(t, { type: 'set-setting', key: 'adaptive', value: false }, rng).state
  t = startRide(t, rng)
  t = playBuilding(t, rng)
  assert.equal(t.step, 1); assert.equal(t.step3Run, 0); assert.equal(t.roof.offer, null)
})

test('the victory descent: R → G at express speed with two dings, then the lobby', () => {
  const rng = makeRng(12)
  let s = playBuilding(startRide(fresh(12), rng), rng)
  const r = reduce(s, { type: 'to-lobby' }, rng)
  const tl = r.effects.find((e) => e.type === 'timeline')
  assert.equal(tl.name, 'descend'); assert.equal(r.state.phase, 'descending'); assert.equal(r.state.screen, 'ride')
  assert.equal(tl.steps.filter((x) => x.ev === 'ding2').length, 1)
  s = reduce(r.state, { type: 'timeline-done' }, rng).state
  assert.equal(s.phase, 'lobby'); assert.equal(s.ride, null); assert.equal(s.lunchbox, 16)
})

test('a mid-question quit persists the problem and the typed digits; the ride resumes exactly', () => {
  const rng = makeRng(13)
  let s = startRide(fresh(13), rng)
  s = answer(s, rng, true).state
  s = run(s, { type: 'press-floor', floor: 2 }, rng).state
  s = reduce(s, { type: 'digit', d: '1' }, rng).state
  const problem = s.ride.problem
  s = reduce(s, { type: 'to-lobby' }, rng).state
  assert.equal(s.phase, 'lobby'); assert.equal(s.lunchbox, 1, 'the tray banks on leaving')
  const back = parse(serialize(s))
  assert.deepEqual(back.ride.problem, problem); assert.equal(back.ride.typed, '1'); assert.equal(back.ride.phase, 'keypad'); assert.equal(back.ride.floor, 1)
  let t = reduce(back, { type: 'load-facts', facts: s.pool }, rng).state
  t = run(t, { type: 'ride-start' }, rng).state
  assert.equal(t.phase, 'keypad'); assert.deepEqual(t.ride.problem, problem); assert.equal(t.ride.typed, '1'); assert.equal(t.car.floor, 1)
  t = typeValue(t, problem.answer, rng)
  assert.equal(t.ride.typed, '1' + String(problem.answer))
  // leaving again does not bank the same bacon twice
  t = reduce(t, { type: 'to-lobby' }, rng).state
  assert.equal(t.lunchbox, 1)
})

test('lunchbox is monotone over a 2 000-action random walk; every sequence ends in a stable state', () => {
  const rng = makeRng(14)
  const walk = makeRng(99)
  let s = fresh(14)
  let lunch = 0
  const ACTIONS = ['ride-start', 'card-continue', 'press-floor', 'digit', 'backspace', 'go', 'hint', 'choice', 'next-building', 'to-lobby', 'set-level', 'set-setting', 'equip', 'openDoors', 'closeDoors', 'nav', 'offer', 'toggle-sign']
  for (let i = 0; i < 2000; i++) {
    const type = walk.pick(ACTIONS)
    let action = { type }
    if (type === 'press-floor') action.floor = s.ride ? (walk() < 0.8 ? s.ride.target : walk.int(0, 10)) : 1
    if (type === 'digit') action.d = String(walk.int(0, 9))
    if (type === 'choice') action.i = walk.int(0, 2)
    if (type === 'set-level') action.id = walk.pick(['corner', 'hotel', 'office', 'sky', 'megatall', 'custom'])
    if (type === 'set-setting') { const k = walk.pick(['secondTry', 'passengers', 'speed', 'adaptive', 'pinnedStep', 'custom.max']); action.key = k; action.value = k === 'passengers' ? walk.pick(['often', 'sometimes', 'never']) : k === 'speed' ? walk.pick(['normal', 'fast']) : k === 'pinnedStep' ? walk.int(1, 3) : k === 'custom.max' ? walk.int(5, 200) : walk() < 0.5 }
    if (type === 'equip') { const p = walk.pick(PARTS); action.slot = p.slot; action.part = p.id }
    if (type === 'nav') action.screen = walk.pick(['lobby', 'picker', 'factbook', 'workshop', 'grownups', 'rules'])
    if (type === 'offer') action.accept = walk() < 0.5
    const r = reduce(s, action, rng)
    s = r.state
    const tl = r.effects.find((e) => e.type === 'timeline')
    if (tl) {
      // a doors-only timeline (◁▷ / ▷◁) keeps the phase; a ride, express, fall or descent parks it until timeline-done
      if (['ride', 'express', 'fall', 'descend'].includes(tl.name)) assert.ok(['moving', 'falling', 'descending'].includes(s.phase), `${tl.name} left phase ${s.phase}`)
      else assert.ok(['floor', 'keypad'].includes(s.phase), `${tl.name} in phase ${s.phase}`)
      s = reduce(s, { type: 'timeline-done' }, rng).state
    }
    assert.ok(!['moving', 'falling', 'descending'].includes(s.phase), 'unstable after ' + type)
    assert.ok(s.lunchbox >= lunch, `lunchbox shrank on ${type}: ${lunch} → ${s.lunchbox}`)
    lunch = s.lunchbox
    if (s.ride) { assert.ok(s.ride.tray >= 0); assert.ok(s.ride.floor >= -1 && s.ride.floor <= 10) }
    assert.ok(s.step >= 1 && s.step <= 3)
    // the save round-trips at every point
    const back = parse(serialize(s))
    assert.ok(back); assert.equal(back.lunchbox, s.lunchbox)
  }
  assert.ok(lunch > 0, 'the walk never banked anything')
})

test('settings and equip are validated; reset restores defaults but keeps the fact pool', () => {
  const rng = makeRng(15)
  let s = fresh(15)
  s = reduce(s, { type: 'set-setting', key: 'volume', value: 250 }, rng).state
  assert.equal(s.settings.volume, 100)
  s = reduce(s, { type: 'set-setting', key: 'speed', value: 'warp' }, rng).state
  assert.equal(s.settings.speed, 'normal')
  s = reduce(s, { type: 'set-setting', key: 'custom.min', value: 50 }, rng).state
  assert.ok(s.settings.custom.min < s.settings.custom.max)
  assert.equal(reduce(s, { type: 'set-setting', key: 'nope', value: 1 }, rng).state, s)
  assert.equal(reduce(s, { type: 'equip', slot: 'doors', part: 'doors-telescopic' }, rng).state, s, 'locked parts cannot be equipped')
  s = { ...s, unlocks: ['doors-telescopic'] }
  s = reduce(s, { type: 'equip', slot: 'doors', part: 'doors-telescopic' }, rng).state
  assert.equal(s.equipped.doors, 'doors-telescopic')
  s = { ...s, lunchbox: 40 }
  s = reduce(s, { type: 'reset' }, rng).state
  assert.equal(s.lunchbox, 0); assert.equal(s.pool.length > 0, true); assert.equal(s.equipped.doors, 'doors-centre')
  assert.deepEqual(initialState(3).settings, initialState(3).settings)
})

test('passengers: never → no trivia; often → floors 3, 6, 9 and 18 bacon per building', () => {
  const rng = makeRng(16)
  let s = fresh(16)
  s = reduce(s, { type: 'set-setting', key: 'passengers', value: 'never' }, rng).state
  s = playBuilding(startRide(s, rng), rng)
  assert.equal(s.roof.gained, 9); assert.equal(s.lunchbox, 12)
  let t = fresh(17)
  t = reduce(t, { type: 'set-setting', key: 'passengers', value: 'often' }, rng).state
  t = playBuilding(startRide(t, rng), rng)
  assert.equal(t.roof.gained, 15); assert.equal(t.lunchbox, 18)
})
