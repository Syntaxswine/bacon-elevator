#!/usr/bin/env node
// Runs the reducer alone (no DOM, no timers, no audio) with an answering policy at a fixed seed and
// reports the maths the child would meet: repeat rate, kind shares, step convergence, falls,
// passengers and bacon. test/headless-play.test.js pins the same numbers; this is the hand tool.
//
//   node tools/headless-play.mjs                       # every level, 10 000 questions each, seed 42
//   node tools/headless-play.mjs --level hotel         # one level
//   node tools/headless-play.mjs --questions 500 --seed 7 --policy sloppy
//
// Exit code 1 when a level breaks a design bound (repeat rate ≥ 1 %, a kind over 60 %, or the step
// not converging to 3 under the perfect policy) — an instrument must refuse.
import { readFileSync } from 'node:fs'
import { mulberry32 } from '../src/rng.js'
import { initialState, reduce } from '../src/state.js'
import { loadFacts } from '../src/trivia.js'
import { LEVEL_ORDER } from '../src/levels.js'
import { label } from '../src/elevator.js'

const argv = process.argv.slice(2)
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d }

export function loadPool() {
  const json = JSON.parse(readFileSync(new URL('../data/trivia.json', import.meta.url), 'utf8'))
  return loadFacts(json).facts
}

// policy(problem, i) → the number to type. 'perfect' always answers correctly; 'sloppy' misses every fifth.
export const POLICIES = {
  perfect: (p) => p.answer,
  sloppy: (p, i) => (i % 5 === 2 ? p.answer + 1 : p.answer),
}

export function play({ levelId = 'corner', questions = 10000, seed = 42, policy = POLICIES.perfect, pool = null, settings = {} } = {}) {
  const rng = mulberry32(seed >>> 0)
  let s = initialState(seed >>> 0)
  s = reduce(s, { type: 'load-facts', facts: pool || [] }, rng).state
  s = reduce(s, { type: 'set-seed', seed: seed >>> 0 }, rng).state
  s = { ...s, rulesSeen: true }
  for (const [k, v] of Object.entries(settings)) s = reduce(s, { type: 'set-setting', key: k, value: v }, rng).state
  s = reduce(s, { type: 'set-level', id: levelId }, rng).state
  const dispatch = (a) => { s = reduce(s, a, rng).state }
  const ring = []
  const kinds = {}
  const steps = []
  let repeats = 0, answered = 0, falls = 0, buildings = 0, trivia = 0, comebacks = 0
  let guard = 0
  while (answered < questions && guard++ < questions * 40) {
    switch (s.phase) {
      case 'lobby': dispatch({ type: 'ride-start' }); if (s.screen === 'rules') dispatch({ type: 'card-continue' }); break
      case 'floor': dispatch({ type: 'press-floor', floor: s.ride.target }); break
      case 'keypad': {
        const p = s.ride.problem
        const fresh = !s.ride.retrying && s.ride.tries === 0
        if (fresh) {
          if (p.comeback) comebacks++
          else { if (ring.slice(-20).includes(p.key)) repeats++; ring.push(p.key) }
          kinds[p.kind] = (kinds[p.kind] || 0) + 1
          answered++
        }
        const v = s.ride.retrying ? p.answer : policy(p, answered)
        for (const ch of String(Math.abs(v))) dispatch({ type: 'digit', d: ch })
        if (v < 0) dispatch({ type: 'toggle-sign' })
        dispatch({ type: 'go' })
        if (fresh) steps.push(s.step) // the step after this answer (the test pins stepAt[5] === 3)
        break
      }
      case 'moving': case 'falling': case 'descending':
        if (s.phase === 'falling') falls++
        dispatch({ type: 'timeline-done' }); break
      case 'repair': case 'fact': dispatch({ type: 'card-continue' }); break
      case 'trivia': trivia++; dispatch({ type: 'choice', i: s.trivia.answer }); break
      case 'roof': buildings++; dispatch({ type: 'next-building' }); break
      default: throw new Error('unexpected phase ' + s.phase)
    }
  }
  const total = ring.length
  const kindShare = Object.fromEntries(Object.entries(kinds).map(([k, n]) => [k, n / answered]))
  const tail = steps.slice(-Math.min(200, steps.length))
  return {
    state: s, answered, repeats, repeatRate: total ? repeats / total : 0, kinds: kindShare,
    maxKindShare: Math.max(...Object.values(kindShare)), stepAt6: steps[5], finalStep: s.step, tailSteps: tail,
    converged: steps.length > 6 && steps[5] === 3 && tail.every((x) => x === 3),
    falls, buildings, trivia, comebacks, lunchbox: s.lunchbox, floor: label(s.ride ? s.ride.floor : 0),
  }
}

const isMain = process.argv[1] && /headless-play\.mjs$/.test(process.argv[1].replace(/\\/g, '/'))
if (isMain) {
  const levelOpt = opt('--level', 'all')
  const levels = levelOpt === 'all' ? LEVEL_ORDER : [levelOpt]
  const questions = +opt('--questions', 10000)
  const seed = +opt('--seed', 42)
  const policyName = opt('--policy', 'perfect')
  const policy = POLICIES[policyName]
  if (!policy) { console.error(`unknown policy ${policyName} (${Object.keys(POLICIES).join(', ')})`); process.exit(2) }
  const pool = loadPool()
  let bad = 0
  console.log(`seed ${seed}, ${questions} questions per level, policy ${policyName}`)
  console.log('level      answered  repeat%  maxKind          step@6  final  converged  falls  bldgs  trivia  comebacks  lunchbox')
  for (const levelId of levels) {
    const r = play({ levelId, questions, seed, policy, pool })
    const maxKind = Object.entries(r.kinds).sort((a, b) => b[1] - a[1])[0]
    const ok = r.repeatRate < 0.01 && r.maxKindShare <= 0.6 && (policyName !== 'perfect' || r.converged)
    if (!ok) bad++
    console.log(
      `${levelId.padEnd(10)} ${String(r.answered).padStart(8)}  ${(100 * r.repeatRate).toFixed(2).padStart(6)}  ${(maxKind[0] + ' ' + (100 * maxKind[1]).toFixed(1) + '%').padEnd(16)} ${String(r.stepAt6).padStart(6)}  ${String(r.finalStep).padStart(5)}  ${(r.converged ? 'yes' : 'no').padStart(9)}  ${String(r.falls).padStart(5)}  ${String(r.buildings).padStart(5)}  ${String(r.trivia).padStart(6)}  ${String(r.comebacks).padStart(9)}  ${String(r.lunchbox).padStart(8)}${ok ? '' : '   <-- out of bounds'}`
    )
  }
  process.exit(bad ? 1 : 0)
}
