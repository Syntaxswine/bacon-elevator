// Shared helpers for the reducer tests: play the game through reduce() alone.
import { readFileSync } from 'node:fs'
import { mulberry32 } from '../src/rng.js'
import { initialState, reduce } from '../src/state.js'
import { loadFacts } from '../src/trivia.js'

export const FACTS = loadFacts(JSON.parse(readFileSync(new URL('../data/trivia.json', import.meta.url), 'utf8'))).facts

export function fresh(salt = 1, { facts = FACTS, seed = null } = {}) {
  let s = initialState(salt)
  s = reduce(s, { type: 'load-facts', facts }).state
  if (seed !== null) s = reduce(s, { type: 'set-seed', seed }).state
  return s
}

export function makeRng(seed = 1) { return mulberry32(seed) }

// dispatch and play any timeline effect to its end
export function run(s, action, rng) {
  const r = reduce(s, action, rng)
  let state = r.state
  const effects = r.effects.slice()
  if (r.effects.some((e) => e.type === 'timeline')) {
    const d = reduce(state, { type: 'timeline-done' }, rng)
    state = d.state
    effects.push(...d.effects)
  }
  return { state, effects, raw: r }
}

export function startRide(s, rng) {
  s = run(s, { type: 'ride-start' }, rng).state
  if (s.screen === 'rules') s = run(s, { type: 'card-continue' }, rng).state
  return s
}

export function typeValue(s, value, rng) {
  const str = String(Math.abs(value))
  for (const ch of str) s = reduce(s, { type: 'digit', d: ch }, rng).state
  if (value < 0) s = reduce(s, { type: 'toggle-sign' }, rng).state
  return s
}

// From `floor` phase: press the lit button, type, GO. Returns the state after the timeline (if any) ends.
export function answer(s, rng, correct = true, opts = {}) {
  if (s.phase === 'floor') s = run(s, { type: 'press-floor', floor: s.ride.target }, rng).state
  if (s.phase !== 'keypad') throw new Error('not at the keypad: ' + s.phase)
  const p = s.ride.problem
  const val = correct ? p.answer : (opts.typed !== undefined ? opts.typed : p.answer + 1)
  s = typeValue(s, val, rng)
  return run(s, { type: 'go' }, rng)
}

export function answerTrivia(s, rng, right = true) {
  const t = s.trivia
  const i = right ? t.answer : (t.answer + 1) % 3
  s = run(s, { type: 'choice', i }, rng).state
  return run(s, { type: 'card-continue' }, rng).state
}

// Play a whole building with a perfect policy until the roof.
export function playBuilding(s, rng) {
  let guard = 0
  while (s.phase !== 'roof' && guard++ < 100) {
    if (s.phase === 'floor' || s.phase === 'keypad') s = answer(s, rng, true).state
    else if (s.phase === 'trivia') s = answerTrivia(s, rng, true)
    else if (s.phase === 'repair') s = run(s, { type: 'card-continue' }, rng).state
    else throw new Error('stuck at ' + s.phase)
  }
  if (s.phase !== 'roof') throw new Error('never reached the roof')
  return s
}
