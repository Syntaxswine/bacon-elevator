// The game reducer. Pure: reduce(state, action, rng) → {state, effects}.
// Effects: {type:'timeline', name, steps, duration} | {type:'sound', name} | {type:'save'} | {type:'screen', name}
// Nothing here touches window, document, storage, timers or Date.

import { LEVELS, LEVEL_ORDER, levelById, customLevel } from './levels.js'
import { makeProblem, afterAnswer, checkAnswer, adaptStep, initialCtx, parseTyped, allowsNegatives, validProblem } from './math.js'
import { initialCar, sequence, step as carStep, FLOORS } from './elevator.js'
import { isPassengerFloor, pickFact, makeChoices } from './trivia.js'

export const SETTINGS_DEFAULTS = Object.freeze({
  sound: false, volume: 50, speed: 'normal', motion: 'auto', bigText: false, secondTry: true,
  passengers: 'sometimes', links: false, custom: { ops: ['add', 'sub'], min: 0, max: 20, negatives: false },
})

export const PARTS = Object.freeze([
  { id: 'doors-centre', slot: 'doors', name: 'Centre-opening doors', at: 0 },
  { id: 'doors-telescopic', slot: 'doors', name: 'Telescopic side-opening doors', at: 18 },
  { id: 'segment', slot: 'indicator', name: 'Segment indicator', at: 0 },
  { id: 'dotmatrix', slot: 'indicator', name: 'Dot-matrix indicator', at: 50 },
  { id: 'single', slot: 'chime', name: 'Single chime', at: 0 },
  { id: 'two-tone', slot: 'chime', name: 'Two-tone chime', at: 100 },
])
export const PLAQUES = Object.freeze([200, 400, 800, 1500])
export const ROOF_BONUS = 3
export const PHASES = ['lobby', 'floor', 'keypad', 'moving', 'falling', 'pit', 'repair', 'trivia', 'fact', 'roof', 'descending']
export const SCREENS = ['lobby', 'picker', 'rules', 'ride', 'roof', 'factbook', 'workshop', 'grownups']
// Timeline name → the phase the game is parked in while it plays. `ride.inFlight = {name, to}` is
// saved the moment a timeline starts, so a save taken mid-ride can be settled by hydrate().
export const IN_FLIGHT = Object.freeze({ ride: 'moving', express: 'moving', fall: 'falling', descend: 'descending' })

const STABLE = new Set(['floor', 'keypad', 'repair', 'trivia', 'fact', 'roof'])

// THE RIDE INVARIANT, in one place.
// A ride is playable iff there is a floor ABOVE the car to press. Range-checking floor and target
// independently is not enough: a save holding {floor:4, target:4} passes every range check and is
// still a dead building, because press-floor refuses f === car.floor and the reducer refuses any
// f !== target, so the only live button is inert. Every entry into a ride — a parsed save, a share
// code, a resume, a settled timeline — comes through here.
export function nextTarget(floor) { return Math.min(10, Math.max(1, floor + 1)) }

export function normaliseRide(ride) {
  if (!ride) return null
  const r = { ...ride }
  r.floor = Math.max(-1, Math.min(10, Number.isSafeInteger(r.floor) ? r.floor : 0))
  r.problem = validProblem(r.problem)
  r.passengersDone = Array.isArray(r.passengersDone) ? r.passengersDone.filter(Number.isSafeInteger) : []
  if (!STABLE.has(r.phase)) r.phase = 'floor'
  if ((r.phase === 'keypad' || r.phase === 'repair') && !r.problem) r.phase = 'floor'
  if (r.phase === 'fact') {
    // The card was read. Do exactly what card-continue does — including the bookkeeping, which is
    // the half a plain phase rewrite used to drop: the passenger stayed on the landing forever.
    if (!r.passengersDone.includes(r.floor)) r.passengersDone = r.passengersDone.concat(r.floor)
    r.phase = 'floor'
    r.target = nextTarget(r.floor)
  }
  if (r.floor === -1 && !(r.phase === 'repair' && r.problem)) { r.floor = 0; r.phase = 'floor' }
  if (r.floor >= 10) { r.floor = 10; r.phase = 'roof' } // the top IS the roof; bank it, never drop it
  if (r.phase === 'roof') { r.floor = 10; r.target = 10; r.retrying = false; return r }
  const t = Number.isSafeInteger(r.target) ? r.target : nextTarget(r.floor)
  r.target = Math.max(nextTarget(r.floor), Math.min(10, t))
  // The pit card IS the retry: a car at −1 showing the Repair card is always retrying, so a wrong
  // answer there returns the card instead of asking the elevator to fall out of the pit.
  r.retrying = r.floor === -1 && r.phase === 'repair'
  return r
}

export function initialState(salt) {
  return {
    v: 1,
    created: 0,
    salt: Number.isInteger(salt) ? salt >>> 0 : 123456,
    lunchbox: 0,
    buildings: 0,
    level: 'corner',
    step: 1,
    adaptive: true,
    pinnedStep: 1,
    settings: { ...SETTINGS_DEFAULTS, custom: { ...SETTINGS_DEFAULTS.custom, ops: SETTINGS_DEFAULTS.custom.ops.slice() } },
    facts: { seen: [], right: [], retry: [] },
    unlocks: [],
    equipped: { doors: 'doors-centre', indicator: 'segment', chime: 'single' },
    history: { ring: [], count: 0, answered: 0, correct: 0, falls: 0, byKind: {}, skills: {} },
    ride: null,
    rulesSeen: false,
    step3Run: 0,
    plaques: [],
    // runtime (not persisted)
    phase: 'lobby',
    screen: 'lobby',
    car: initialCar(),
    pending: null,
    trivia: null,
    hint: false,
    roof: null,
    pool: [],
    seedOverride: null,
    message: '',
    lastResult: null,
  }
}

export function currentLevel(state) {
  if (state.level === 'custom') return customLevel(state.settings.custom)
  return levelById(state.level) || LEVELS[0]
}

const T = (name, r) => ({ type: 'timeline', name, steps: r.timeline, duration: r.duration })
const SAVE = { type: 'save' }
const SOUND = (name) => ({ type: 'sound', name })
const SCREEN = (name) => ({ type: 'screen', name })
const same = (state) => ({ state, effects: [] })

function ctxOf(state) {
  const r = state.ride
  const c = r && r.ctx ? r.ctx : initialCtx()
  return { ...c, ring: state.history.ring, skills: state.history.skills, comeback: r ? r.comeback : [] }
}

function newRide(state, seed) {
  return {
    seed: seed >>> 0, floor: 0, target: 1, cleared: [], tray: 0, banked: 0, phase: 'floor', problem: null, typed: '',
    tries: 0, streak: 0, stepDowns: 0, comeback: [], passengersDone: [], retrying: false, forfeit: false, typedWrong: '',
    falls: 0, draws: 0, ctx: initialCtx(), lastKind: null, fallFloor: 0, roofCard: null, inFlight: null,
  }
}

// Settle a ride that was saved mid-timeline (a tab killed during a ride, a fall or the descent):
// the timeline is played to its end here, before anything renders, so the game resumes at the
// stable state it was heading for — the Repair card after a fall, never a keypad that could fall
// again for the same sum. Pure; the rng is the ride's own (main.js passes rngFor(state)).
export function hydrate(state, rng) {
  const r = state.ride
  if (!r || !r.inFlight) return state
  const { name, to } = r.inFlight
  const phase = IN_FLIGHT[name]
  if (!phase || (name === 'fall' && !r.problem)) return { ...state, ride: normaliseRide({ ...r, inFlight: null }) }
  const parked = { ...state, phase, screen: 'ride', car: { ...initialCar(), floor: r.floor }, pending: { name, car: { ...initialCar(), floor: to } }, trivia: null, roof: null }
  const settled = reduce(parked, { type: 'timeline-done' }, rng).state
  return { ...settled, ride: settled.ride ? normaliseRide({ ...settled.ride, phase: settled.phase, inFlight: null }) : null, phase: 'lobby', screen: 'lobby', trivia: null, roof: null, pending: null, hint: false, message: '' }
}

function seedFor(state) {
  if (Number.isInteger(state.seedOverride)) return state.seedOverride >>> 0
  return ((state.buildings ^ state.salt) >>> 0) || 1
}

function withDraws(state, rng) {
  if (!state.ride || !rng || !Number.isInteger(rng.count)) return state
  return { ...state, ride: { ...state.ride, draws: rng.count } }
}

function stable(state, phase, extra = {}) {
  const ride = state.ride ? { ...state.ride, phase, ...(extra.ride || {}) } : state.ride
  return { ...state, ...extra, ride, phase, pending: null }
}

function askProblem(state, rng) {
  const level = currentLevel(state)
  const problem = makeProblem(level, state.step, ctxOf(state), rng)
  return { ...state, ride: { ...state.ride, problem, typed: '', tries: 0, retrying: false, forfeit: false, typedWrong: '' }, hint: false, message: '' }
}

function askPassenger(state, rng) {
  const r = state.ride
  const fact = pickFact(state.pool, state.facts.seen, r.lastKind, rng, state.facts.retry)
  if (!fact) return null
  const { choices, answer } = makeChoices(fact, rng)
  return { fact, choices, answer, chosen: null, result: null }
}

// The car the reducer believes in while a timeline plays: the pre-ride car. `pending` holds the end
// state; `ride.inFlight` persists enough of it for hydrate() to settle a save taken mid-timeline.
function startTimeline(state, name, r, phase) {
  const ride = state.ride ? { ...state.ride, inFlight: { name, to: r.car.floor } } : state.ride
  return { state: { ...state, ride, phase, pending: { car: r.car, name }, hint: false }, effect: T(name, r) }
}

function recordAnswer(state, problem, correct, fell) {
  const h = state.history
  const byKind = { ...h.byKind }
  const bk = byKind[problem.kind] || [0, 0]
  byKind[problem.kind] = [bk[0] + 1, bk[1] + (correct ? 1 : 0)]
  const ctx = afterAnswer(ctxOf(state), problem, correct)
  const history = { ...h, ring: ctx.ring, count: h.count + 1, answered: h.answered + 1, correct: h.correct + (correct ? 1 : 0), falls: h.falls + (fell ? 1 : 0), byKind, skills: ctx.skills }
  const ride = { ...state.ride, comeback: ctx.comeback, ctx: { lastAnswer: ctx.lastAnswer, sameSeen: ctx.sameSeen, kindRun: ctx.kindRun, count: ctx.count } }
  let step = state.step, streak = ride.streak, stepDowns = ride.stepDowns
  if (state.adaptive) {
    const a = adaptStep({ step, streak, stepDowns }, correct, fell)
    step = a.step; streak = a.streak; stepDowns = a.stepDowns
  } else {
    step = Math.max(1, Math.min(3, state.pinnedStep))
  }
  return { ...state, history, ride: { ...ride, streak, stepDowns }, step }
}

function arrive(state, rng) {
  // The car has stopped at ride.target with the doors open and the bacon in (unless forfeited).
  const r = state.ride
  const floor = r.target
  const collected = floor >= 1 && floor <= 9 && !r.cleared.includes(floor) && !r.forfeit
  const cleared = collected ? r.cleared.concat(floor).sort((x, y) => x - y) : r.cleared
  const tray = r.tray + (collected ? 1 : 0)
  let s = { ...state, car: { ...initialCar(), floor }, ride: { ...r, floor, cleared, tray, retrying: false, forfeit: false, typed: '', typedWrong: '', problem: null, fallFloor: 0, inFlight: null }, hint: false, message: '' }
  const effects = []
  if (floor === FLOORS.ROOF) {
    const gained = s.ride.tray - s.ride.banked
    const lunchbox = state.lunchbox + gained + ROOF_BONUS
    const unlocked = PARTS.filter((p) => p.at > 0 && p.at <= lunchbox && !state.unlocks.includes(p.id)).map((p) => p.id)
    const plaques = PLAQUES.filter((p) => p <= lunchbox && !state.plaques.includes(p)).map(String)
    const step3Run = (state.step === 3 && s.ride.falls <= 1) ? state.step3Run + 1 : 0
    const idx = LEVEL_ORDER.indexOf(state.level)
    const next = state.adaptive && step3Run >= 2 && idx >= 0 && idx < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[idx + 1] : null
    s = {
      ...s,
      lunchbox,
      buildings: state.buildings + 1,
      unlocks: state.unlocks.concat(unlocked),
      plaques: state.plaques.concat(plaques),
      step3Run,
      // The roof summary lives in the ride, which IS persisted, so a reload at the roof shows the
      // real numbers instead of a fabricated "Tray 0 -> lunchbox".
      ride: { ...s.ride, tray: s.ride.tray + ROOF_BONUS, banked: s.ride.tray + ROOF_BONUS, roofCard: { gained, bonus: ROOF_BONUS, unlocked, plaques, offer: next, offerTaken: null, lunchboxBefore: state.lunchbox } },
      roof: { gained, bonus: ROOF_BONUS, unlocked, plaques, offer: next, lunchboxBefore: state.lunchbox },
    }
    s = stable(s, 'roof', { screen: 'roof' })
    effects.push(SOUND('roof'), SCREEN('roof'), SAVE)
    return { state: s, effects }
  }
  if (isPassengerFloor(floor, state.settings.passengers) && !r.passengersDone.includes(floor) && state.pool.length) {
    const trivia = askPassenger(s, rng)
    if (trivia) {
      s = stable({ ...s, trivia }, 'trivia', { ride: { lastKind: trivia.fact.kind } })
      effects.push(SAVE)
      return { state: withDraws(s, rng), effects }
    }
  }
  s = stable({ ...s, ride: { ...s.ride, target: nextTarget(floor) } }, 'floor')
  effects.push(SAVE)
  return { state: withDraws(s, rng), effects }
}

function bankOnLeave(state) {
  const r = state.ride
  if (!r) return state
  const gained = Math.max(0, r.tray - r.banked)
  return { ...state, lunchbox: state.lunchbox + gained, ride: { ...r, banked: r.tray } }
}

export function reduce(state, action, rng) {
  if (!action || typeof action.type !== 'string') return same(state)
  const r = state.ride
  const phase = state.phase
  switch (action.type) {
    case 'load-facts':
      return same({ ...state, pool: Array.isArray(action.facts) ? action.facts : [] })
    case 'set-seed':
      return same({ ...state, seedOverride: Number.isInteger(action.seed) ? action.seed : null })

    case 'nav': {
      const name = action.screen
      if (!SCREENS.includes(name) || name === 'ride' || name === 'roof') return same(state)
      if (!STABLE.has(phase) && phase !== 'lobby') return same(state)
      if (name === 'rules') return { state: { ...state, screen: 'rules' }, effects: [SCREEN('rules')] }
      if (name === 'lobby') return reduce(state, { type: 'to-lobby' }, rng)
      // picker, factbook, workshop, grownups: reachable from the lobby (or the roof); an in-progress building is parked.
      let s = state
      // `to-lobby` already banks the tray, performs the fact -> floor transition WITH passengersDone,
      // and records the REAL phase into ride.phase. Stamping 'lobby' here instead left a dead building.
      if (r && phase !== 'lobby' && phase !== 'roof') s = reduce(state, { type: 'to-lobby' }, rng).state
      return { state: { ...s, screen: name }, effects: [SCREEN(name), SAVE] }
    }

    case 'ride-start': {
      if (!(phase === 'lobby' || (phase === 'floor' && state.screen !== 'ride'))) return same(state)
      let s = state
      const effects = []
      if (!r) {
        s = { ...s, ride: newRide(s, seedFor(s)), car: initialCar(), trivia: null, roof: null, hint: false, message: '' }
        s = stable(s, 'floor')
      } else {
        // Resume exactly where it was - through the invariant, so a hand-edited, imported or
        // half-written save can never park the car on a floor whose one live button does nothing.
        const nr = normaliseRide(r)
        const car = { ...initialCar(), floor: nr.floor }
        s = { ...s, ride: nr, car, hint: false, message: '', trivia: null, roof: null }
        if (nr.phase === 'trivia') {
          const trivia = askPassenger(s, rng)
          s = trivia ? stable({ ...s, trivia }, 'trivia') : stable({ ...s, ride: { ...nr, target: nextTarget(nr.floor) } }, 'floor')
        } else if (nr.phase === 'roof') {
          // gained === null means "an old save with no roof card": the screen omits those lines
          // rather than printing a number nobody earned.
          const rc = nr.roofCard
          s = stable(s, 'roof', { roof: rc ? { ...rc } : { gained: null, bonus: null, unlocked: [], plaques: [], offer: null, lunchboxBefore: s.lunchbox } })
        } else {
          s = stable(s, nr.phase)
        }
      }
      const screen = s.phase === 'roof' ? 'roof' : (s.rulesSeen ? 'ride' : 'rules')
      s = { ...s, screen }
      effects.push(SCREEN(screen), SAVE)
      return { state: withDraws(s, rng), effects }
    }

    case 'card-continue': {
      if (state.screen === 'rules') {
        const screen = r ? (phase === 'roof' ? 'roof' : 'ride') : 'lobby'
        return { state: { ...state, rulesSeen: true, screen }, effects: [SCREEN(screen), SAVE] }
      }
      if (phase === 'repair' && r) {
        // `Try again` → keypad, the SAME sum.
        const s = stable({ ...state, ride: { ...r, typed: '' }, message: '' }, 'keypad')
        return { state: s, effects: [SOUND('click'), SAVE] }
      }
      if (phase === 'fact' && r) {
        const done = r.passengersDone.includes(r.floor) ? r.passengersDone : r.passengersDone.concat(r.floor)
        const s = stable({ ...state, trivia: null, ride: { ...r, passengersDone: done, target: nextTarget(r.floor) } }, 'floor')
        return { state: s, effects: [SOUND('click'), SAVE] }
      }
      return same(state)
    }

    case 'press-floor': {
      if (phase !== 'floor' || !r) return same(state)
      const f = action.floor
      if (f !== r.target) return same(state)
      const pressed = carStep(state.car, { type: 'press', floor: f })
      if (pressed.blocked) {
        // Unreachable while the invariant holds. If it ever is reached, heal - never freeze: a tap
        // on the one lit button must always do something. normaliseRide is idempotent, so the
        // recursion below runs at most once.
        const nr = normaliseRide({ ...r, floor: state.car.floor })
        if (nr.phase === r.phase && nr.target === r.target && nr.floor === r.floor) return same(state)
        const healed = { ...state, ride: nr, phase: nr.phase, car: { ...initialCar(), floor: nr.floor } }
        return nr.phase === 'floor' ? reduce(healed, { type: 'press-floor', floor: nr.target }, rng) : { state: healed, effects: [SAVE] }
      }
      let s = { ...state, car: pressed.car }
      s = askProblem(s, rng)
      s = stable(s, 'keypad')
      return { state: withDraws(s, rng), effects: [SOUND('click'), SAVE] }
    }

    case 'digit': {
      if (phase !== 'keypad' || !r || !r.problem) return same(state)
      const d = String(action.d)
      if (!/^\d$/.test(d)) return same(state)
      const digitsOnly = r.typed.replace('-', '')
      if (digitsOnly.length >= 4) return same(state)
      if (digitsOnly === '0') return same(state)
      const typed = r.typed + d
      return { state: { ...state, ride: { ...r, typed }, message: '' }, effects: [SOUND('click')] }
    }

    case 'backspace': {
      if (phase !== 'keypad' || !r) return same(state)
      if (!r.typed) return same(state)
      return { state: { ...state, ride: { ...r, typed: r.typed.slice(0, -1) }, message: '' }, effects: [SOUND('click')] }
    }

    case 'toggle-sign': {
      if (phase !== 'keypad' || !r || !r.problem) return same(state)
      if (!allowsNegatives(currentLevel(state), state.step)) return same(state)
      const typed = r.typed.startsWith('-') ? r.typed.slice(1) : '-' + r.typed
      return { state: { ...state, ride: { ...r, typed } }, effects: [SOUND('click')] }
    }

    case 'hint': {
      if (phase !== 'keypad' || !r || !r.problem) return same(state)
      return { state: { ...state, hint: !state.hint }, effects: [SOUND('click')] }
    }

    case 'closeDoors': {
      if (!r || (phase !== 'floor' && phase !== 'keypad')) return same(state)
      const res = carStep(state.car, { type: 'closeDoors' })
      if (res.blocked) return same(state)
      return { state: { ...state, car: res.car }, effects: [T('closeDoors', res), SOUND('click')] }
    }

    case 'openDoors': {
      if (!r) return same(state)
      if (phase === 'floor' || phase === 'keypad') {
        const res = carStep(state.car, { type: 'openDoors' })
        if (res.blocked) return same(state)
        return { state: { ...state, car: res.car }, effects: [T('openDoors', res), SOUND('click')] }
      }
      if (phase === 'moving' && state.pending && state.pending.name === 'ride' && action.whileClosing) {
        // `◁▷` re-opens closing doors: reopen, then close and ride as before.
        const closing = { ...state.car, doors: 'closing' }
        const res = sequence(closing, [{ type: 'openDoors' }, { type: 'closeDoors' }, { type: 'move' }])
        if (res.blocked) return same(state)
        const st = startTimeline(state, 'ride', res, 'moving')
        return { state: st.state, effects: [st.effect, SOUND('click'), SAVE] }
      }
      return same(state)
    }

    case 'go': {
      if (!r || !r.problem) return same(state)
      if (phase === 'repair') return reduce(state, { type: 'card-continue' }, rng)
      if (phase !== 'keypad') return same(state)
      if (parseTyped(r.typed) === null) return same(state)
      const problem = r.problem
      const correct = checkAnswer(problem, r.typed)
      const doorsEvents = state.car.doors === 'closed' ? [] : [{ type: 'closeDoors' }]

      if (r.retrying) {
        // After a fall: the same sum again. Right → express ride to the target. Wrong → the card returns, no second fall.
        if (correct) {
          const res = sequence(state.car, [...doorsEvents, { type: 'express', to: r.target }], 0)
          if (res.blocked) return same(state)
          const shifted = { ...res, timeline: res.timeline.map((e) => ({ ...e, t: e.t + 600 })), duration: res.duration + 600 }
          const st = startTimeline({ ...state, message: '', lastResult: 'correct' }, 'express', shifted, 'moving')
          return { state: st.state, effects: [st.effect, SOUND('click'), SAVE] }
        }
        const s = stable({ ...state, ride: { ...r, tries: r.tries + 1, forfeit: true, typedWrong: r.typed, typed: '' }, message: '', lastResult: 'wrong' }, 'repair')
        return { state: s, effects: [SAVE] }
      }

      if (correct) {
        let s = recordAnswer(state, problem, true, false)
        const res = sequence(s.car, [...doorsEvents, { type: 'move' }], 0)
        if (res.blocked) {
          // Only reachable from a save that put the car at the top in a playing phase. The answer
          // was RIGHT, so bank the building rather than swallow the tap.
          if (s.car.floor >= FLOORS.ROOF) return arrive({ ...s, ride: { ...s.ride, target: FLOORS.ROOF }, car: { ...initialCar(), floor: FLOORS.ROOF }, pending: null }, rng)
          return same(state)
        }
        const shifted = { ...res, timeline: res.timeline.map((e) => ({ ...e, t: e.t + 600 })), duration: res.duration + 600 }
        const st = startTimeline({ ...s, message: '', lastResult: 'correct' }, 'ride', shifted, 'moving')
        return { state: st.state, effects: [st.effect, SOUND('click'), SAVE] }
      }

      if (state.settings.secondTry && r.tries === 0) {
        return { state: { ...state, ride: { ...r, tries: 1, typed: '' }, message: 'Try once more.', lastResult: 'again' }, effects: [SAVE] }
      }

      // The fall. The true equation shows for 1.2 s, then the cable slips. Byte-identical every time.
      let s = recordAnswer(state, problem, false, true)
      const res = carStep(s.car, { type: 'fall' })
      if (res.blocked) {
        // The car is already in the pit, so it cannot fall again (only a save that lost `retrying`
        // gets here). Show the Repair card rather than swallow the tap - no second fall, exactly as
        // the retry rule already says.
        const st = stable({ ...s, ride: { ...s.ride, tries: s.ride.tries + 1, forfeit: true, retrying: true, typedWrong: r.typed, typed: '' }, message: '', lastResult: 'wrong' }, 'repair')
        return { state: st, effects: [SAVE] }
      }
      const shifted = { ...res, timeline: res.timeline.map((e) => ({ ...e, t: e.t + 1200 })), duration: res.duration + 1200 }
      s = { ...s, ride: { ...s.ride, typedWrong: r.typed, typed: '', retrying: true, falls: s.ride.falls + 1, fallFloor: r.floor }, message: '', lastResult: 'fall' }
      const st = startTimeline(s, 'fall', shifted, 'falling')
      return { state: st.state, effects: [st.effect, SAVE] }
    }

    case 'timeline-done': {
      const p = state.pending
      if (!p) return same(state)
      if (p.name === 'ride' || p.name === 'express') {
        return arrive({ ...state, car: p.car, pending: null }, rng)
      }
      if (p.name === 'fall') {
        const s = stable({ ...state, car: p.car, ride: { ...r, floor: -1, inFlight: null } }, 'repair')
        return { state: s, effects: [SAVE] }
      }
      if (p.name === 'descend') {
        const s = { ...state, car: p.car, ride: null, trivia: null, roof: null, phase: 'lobby', screen: 'lobby', pending: null }
        return { state: s, effects: [SCREEN('lobby'), SAVE] }
      }
      return same({ ...state, pending: null })
    }

    case 'choice': {
      if (phase !== 'trivia' || !state.trivia || !r) return same(state)
      const i = action.i
      if (!Number.isInteger(i) || i < 0 || i > 2) return same(state)
      const t = state.trivia
      const right = i === t.answer
      const seen = state.facts.seen.concat(t.fact.id)
      const rightList = right && !state.facts.right.includes(t.fact.id) ? state.facts.right.concat(t.fact.id) : state.facts.right
      let retry = state.facts.retry.filter((x) => x.id !== t.fact.id)
      if (!right) retry = retry.concat({ id: t.fact.id, at: seen.length })
      const tray = r.tray + (right ? 2 : 0)
      const s = stable({ ...state, facts: { seen, right: rightList, retry }, trivia: { ...t, chosen: i, result: right ? 'right' : 'wrong' }, ride: { ...r, tray } }, 'fact')
      return { state: s, effects: [SOUND(right ? 'bacon' : 'click'), SAVE] }
    }

    case 'next-building': {
      if (phase !== 'roof') return same(state)
      let s = { ...state, ride: newRide(state, seedFor(state)), car: initialCar(), roof: null, trivia: null, hint: false, message: '' }
      s = stable(s, 'floor', { screen: 'ride' })
      return { state: s, effects: [SCREEN('ride'), SAVE] }
    }

    case 'offer': {
      if (phase !== 'roof' || !state.roof || !state.roof.offer) return same(state)
      const accept = !!action.accept
      const card = { ...state.roof, offer: null, offerTaken: accept ? state.roof.offer : null }
      const s = { ...state, roof: card, ride: state.ride ? { ...state.ride, roofCard: state.ride.roofCard ? { ...state.ride.roofCard, offer: null, offerTaken: card.offerTaken } : null } : null, step3Run: 0 }
      if (accept) return { state: { ...s, level: state.roof.offer, step: 1 }, effects: [SOUND('click'), SAVE] }
      return { state: s, effects: [SOUND('click'), SAVE] }
    }

    case 'to-lobby': {
      if (phase === 'lobby') return { state: { ...state, screen: 'lobby' }, effects: [SCREEN('lobby')] }
      if (phase === 'roof' && r) {
        // The victory descent: R → G at express speed, two dings.
        const res = sequence(state.car, [{ type: 'closeDoors' }, { type: 'descend', to: 0 }])
        if (res.blocked) return same(state)
        const st = startTimeline({ ...state, screen: 'ride', roof: null }, 'descend', res, 'descending')
        return { state: st.state, effects: [SCREEN('ride'), st.effect, SAVE] }
      }
      if (!STABLE.has(phase)) return same(state)
      let s = state
      if (phase === 'fact' && r) {
        const done = r.passengersDone.includes(r.floor) ? r.passengersDone : r.passengersDone.concat(r.floor)
        s = stable({ ...s, trivia: null, ride: { ...r, passengersDone: done, target: nextTarget(r.floor) } }, 'floor')
      }
      s = bankOnLeave(s)
      s = { ...s, ride: s.ride ? { ...s.ride, phase: s.phase } : null, phase: 'lobby', screen: 'lobby', hint: false, pending: null }
      return { state: s, effects: [SCREEN('lobby'), SAVE] }
    }

    case 'set-level': {
      const id = action.id
      if (!['corner', 'hotel', 'office', 'sky', 'megatall', 'custom'].includes(id)) return same(state)
      if (!STABLE.has(phase) && phase !== 'lobby') return same(state)
      let s = state
      if (id !== state.level && r) {
        // A level change ends the parked building; the tray is banked, nothing is lost.
        s = bankOnLeave(s)
        s = { ...s, ride: null, trivia: null, roof: null, phase: 'lobby', screen: s.screen === 'ride' || s.screen === 'roof' ? 'lobby' : s.screen }
      }
      const step = state.adaptive ? (id === state.level ? state.step : 1) : Math.max(1, Math.min(3, state.pinnedStep))
      return { state: { ...s, level: id, step, step3Run: id === state.level ? s.step3Run : 0 }, effects: [SOUND('click'), SAVE] }
    }

    case 'set-setting': {
      const { key, value } = action
      if (typeof key !== 'string') return same(state)
      let s = state
      if (key === 'adaptive') {
        const adaptive = !!value
        s = { ...s, adaptive, step: adaptive ? s.step : Math.max(1, Math.min(3, s.pinnedStep)) }
      } else if (key === 'pinnedStep') {
        const pinned = Math.max(1, Math.min(3, value | 0))
        s = { ...s, pinnedStep: pinned, step: s.adaptive ? s.step : pinned }
      } else if (key.startsWith('custom.')) {
        const k = key.slice(7)
        const custom = { ...s.settings.custom }
        if (k === 'ops' && Array.isArray(value)) custom.ops = value.filter((o) => ['add', 'sub', 'mul', 'div', 'missAdd', 'up', 'down'].includes(o))
        else if (k === 'min') custom.min = Math.max(0, Math.min(custom.max - 2, value | 0))
        else if (k === 'max') custom.max = Math.max(custom.min + 2, Math.min(9999, value | 0))
        else if (k === 'negatives') custom.negatives = !!value
        else return same(state)
        if (!custom.ops.length) custom.ops = ['add']
        s = { ...s, settings: { ...s.settings, custom } }
      } else if (key in SETTINGS_DEFAULTS && key !== 'custom') {
        const st = { ...s.settings }
        if (key === 'volume') st.volume = Math.max(0, Math.min(100, value | 0))
        else if (key === 'speed') st.speed = value === 'fast' ? 'fast' : 'normal'
        else if (key === 'motion') st.motion = ['auto', 'full', 'reduced'].includes(value) ? value : 'auto'
        else if (key === 'passengers') st.passengers = ['often', 'sometimes', 'never'].includes(value) ? value : 'sometimes'
        else st[key] = !!value
        s = { ...s, settings: st }
      } else return same(state)
      return { state: s, effects: [SAVE] }
    }

    case 'equip': {
      const part = PARTS.find((p) => p.id === action.part && p.slot === action.slot)
      if (!part) return same(state)
      if (part.at > 0 && !state.unlocks.includes(part.id)) return same(state)
      return { state: { ...state, equipped: { ...state.equipped, [action.slot]: part.id } }, effects: [SOUND('click'), SAVE] }
    }

    case 'import': {
      const inc = action.state
      if (!inc || typeof inc !== 'object') return same(state)
      // Its one caller feeds a decodeCode() result, already through parse -> migrate; normalising
      // here means a second caller can never open a doorway back into the dead states.
      const s = { ...initialState(inc.salt), ...inc, ride: normaliseRide(inc.ride), pool: state.pool, seedOverride: state.seedOverride, phase: 'lobby', screen: 'lobby', car: initialCar(), pending: null, trivia: null, roof: null, hint: false }
      return { state: s, effects: [SCREEN('lobby'), SAVE] }
    }

    case 'reset': {
      const s = { ...initialState(state.salt), pool: state.pool, seedOverride: state.seedOverride, created: state.created }
      return { state: s, effects: [SCREEN('lobby'), SAVE] }
    }

    default:
      return same(state)
  }
}

export function lunchboxMilestone(lunchbox) {
  const next = PARTS.filter((p) => p.at > lunchbox).sort((a, b) => a.at - b.at)[0]
  return next ? { at: next.at, part: next } : null
}
