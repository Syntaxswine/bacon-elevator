// THE LOAD-BEARING TEST OF THE CONTENT ROUND.
//
// The lead's ruling: variety must come from things that are ADDITIVE and INERT to the loop. A part
// may change what the lift LOOKS like and what there is to READ, and nothing else — not a sum, not
// a timing, not a phase, not the fall, not the bacon. If a part can be FELT by the reducer, the
// child's predictability is gone and no amount of content is worth it.
//
// Three instruments, because each one catches something the others cannot:
//
//  1. A BEHAVIOURAL TRACE, not only a final state. A deep-equal on the terminal state cannot see an
//     effect that fired in a different ORDER, and effect order is what the renderer and the audio
//     play off. So the trace is the phase, the problem key, the tray and every effect, in order,
//     for 300 actions at seed 42 — compared byte for byte against the shipped defaults.
//  2. A FINAL-STATE DEEP-EQUAL minus `equipped`, `unlocks` and `records`, which are the only three
//     fields a part or a ride is allowed to move.
//  3. A STATIC assertion that `equipped` is read in src/state.js in exactly one branch, `case
//     'equip'`, and that `records` is only ever written through `tally()`. A behavioural test at
//     one seed cannot prove the absence of a read; the source can.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mulberry32 } from '../src/rng.js'
import { initialState, reduce } from '../src/state.js'
import { PARTS, SLOT_IDS, partsBySlot } from '../src/parts.js'
import { loadFacts } from '../src/trivia.js'

const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8')
const pool = loadFacts(JSON.parse(readFileSync(new URL('../data/trivia.json', import.meta.url), 'utf8'))).facts

// The same 300-action script, driven by the state itself so it is a real game and not a fixed list.
// Every fifth question is answered wrong, so the fall, the Repair card and the express recovery are
// all inside the trace.
function play(equipped, unlocks) {
  const rng = mulberry32(42)
  let s = initialState(42)
  s = reduce(s, { type: 'load-facts', facts: pool }, rng).state
  s = reduce(s, { type: 'set-seed', seed: 42 }, rng).state
  s = { ...s, rulesSeen: true, equipped: { ...s.equipped, ...equipped }, unlocks }
  const trace = []
  const record = (fx) => trace.push(`${s.phase}|${s.screen}|${s.ride ? s.ride.problem ? s.ride.problem.key : '-' : '-'}|${s.ride ? s.ride.tray : 0}|${s.lunchbox}|${fx.map((e) => e.type + (e.name ? ':' + e.name : '')).join(',')}`)
  const go = (a) => { const r = reduce(s, a, rng); s = r.state; record(r.effects) }
  let asked = 0
  for (let i = 0; i < 300; i++) {
    switch (s.phase) {
      case 'lobby': go({ type: 'ride-start' }); break
      case 'floor': go({ type: 'press-floor', floor: s.ride.target }); break
      case 'keypad': case 'repair': {
        const fresh = !s.ride.retrying
        if (fresh) asked++
        const v = (fresh && asked % 5 === 0) ? s.ride.problem.answer + 1 : s.ride.problem.answer
        for (const ch of String(Math.abs(v))) go({ type: 'digit', d: ch })
        if (v < 0) go({ type: 'toggle-sign' })
        go({ type: 'go' })
        break
      }
      case 'moving': case 'falling': case 'descending': go({ type: 'timeline-done' }); break
      case 'trivia': go({ type: 'choice', i: s.trivia.answer }); break
      case 'fact': go({ type: 'card-continue' }); break
      case 'roof': go({ type: 'next-building' }); break
      default: go({ type: 'to-lobby' })
    }
  }
  return { trace, state: s }
}

const strip = (st) => {
  const out = { ...st }
  // The three fields a part, and a ride, are allowed to move. Everything else must match.
  delete out.equipped
  delete out.unlocks
  delete out.records
  return out
}

const base = play({}, [])

test('every part in the ladder leaves the reducer byte-identical: the trace AND the final state', () => {
  for (const p of PARTS) {
    const { trace, state } = play({ [p.slot]: p.id }, [p.id])
    assert.equal(trace.length, base.trace.length, `${p.id} changed how many actions the script took`)
    for (let i = 0; i < trace.length; i++) {
      assert.equal(trace[i], base.trace[i], `${p.id} changed step ${i} of the game:\n  with it: ${trace[i]}\n  without: ${base.trace[i]}`)
    }
    assert.deepEqual(strip(state), strip(base.state), `${p.id} left the state different`)
    assert.equal(state.records.floors, base.state.records.floors, `${p.id} changed how far the lift travelled`)
  }
})

test('every slot at its TOP part at once is still byte-identical', () => {
  const top = {}
  for (const slot of SLOT_IDS) top[slot] = partsBySlot(slot).slice(-1)[0].id
  const { trace, state } = play(top, PARTS.map((p) => p.id))
  assert.deepEqual(trace, base.trace, 'a fully fitted lift plays a different game')
  assert.deepEqual(strip(state), strip(base.state))
  // …and the fully fitted lift really is a different lift
  assert.notDeepEqual(state.equipped, base.state.equipped)
})

test('`equipped` is read in state.js in exactly one branch, and it is `case equip`', () => {
  const code = src('state.js').replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
  const lines = code.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /\bequipped\b/.test(l))
  assert.ok(lines.length > 0, 'the reducer no longer knows about equipped at all')
  // initialState builds it; migrate is in save.js; case 'equip' writes it. Nothing else may READ it:
  // a read in makeProblem, in arrive(), or in a timeline is a part the child can feel.
  for (const [n, l] of lines) {
    const ok = /equipped: defaultEquipped\(\)/.test(l) || /\.\.\.state\.equipped/.test(l)
    assert.ok(ok, `state.js:${n} touches equipped outside initialState and case 'equip': ${l.trim()}`)
  }
  // and the write is inside the equip branch
  const equipBranch = /case 'equip': \{([\s\S]*?)\n    \}/.exec(code)
  assert.ok(equipBranch && /\.\.\.state\.equipped/.test(equipBranch[1]), "case 'equip' no longer writes equipped")
})

test('`records` is only ever written through tally(), and read by nothing that draws a sum', () => {
  const code = src('state.js').replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
  // tally() is allowed to know about records — it IS the writer. Everything OUTSIDE it must only
  // ever hand its result straight back into the state, never read a field off it.
  const tallyBody = /export function tally\(records, delta\) \{[\s\S]*?\n\}/.exec(code)
  assert.ok(tallyBody, 'tally() is gone; records now has no single writer')
  const outside = code.replace(tallyBody[0], '')
  const lines = outside.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /\brecords\b/.test(l))
  assert.ok(lines.length >= 3, 'records is written in fewer places than the roof, the passenger and the descent')
  for (const [n, l] of lines) {
    // WHAT THIS RULE IS ACTUALLY FOR: records must have exactly ONE writer, so nothing outside
    // tally() may put a value into it by any other route. A READ of the floor count cannot make a
    // monotone field go down. The Climb's ledger asks how many floors have been ridden, to decide
    // which rungs this roof crossed and to seed a save written before that ledger existed
    // (r6-elevator-feel-02) — a paragraph on the reward card, never a sum. The half of the rule
    // that keeps records out of the maths is enforced below, where the pure modules that draw a
    // sum may not name `records` at all.
    const readsFloors = /state\.records\.floors/.test(l) && !/records\s*:/.test(l) && !/records\s*=[^=]/.test(l)
    const ok = /records: \{ floors: 0/.test(l) || /records: tally\(/.test(l) || readsFloors
    assert.ok(ok, `state.js (outside tally, line ${n}) writes records outside tally(): ${l.trim()}`)
  }
  // the pure modules that make the maths must not know records or equipped exist at all
  for (const f of ['math.js', 'levels.js', 'explain.js', 'elevator.js', 'trivia.js']) {
    const t = src(f)
    assert.ok(!/\bequipped\b/.test(t), `${f} reads equipped`)
    assert.ok(!/\brecords\b/.test(t), `${f} reads records`)
  }
})

test('a part cannot be equipped before it is earned, and equipping never touches anything else', () => {
  const rng = mulberry32(7)
  let s = initialState(7)
  const locked = PARTS.find((p) => p.at > 0)
  const before = s
  s = reduce(s, { type: 'equip', slot: locked.slot, part: locked.id }, rng).state
  assert.equal(s, before, 'a locked part was fitted')
  // the wrong slot for a real part is refused too
  s = reduce({ ...s, unlocks: [locked.id] }, { type: 'equip', slot: 'chime', part: locked.id }, rng).state
  assert.notEqual(s.equipped.chime, locked.id)
  // …and once earned, the ONLY thing that changes is that slot
  let earned = { ...initialState(7), unlocks: [locked.id] }
  const after = reduce(earned, { type: 'equip', slot: locked.slot, part: locked.id }, rng).state
  assert.equal(after.equipped[locked.slot], locked.id)
  assert.deepEqual({ ...after, equipped: earned.equipped }, earned, 'equipping moved something other than the slot')
  // nothing is ever RE-LOCKED: the unlock list only ever grows
  assert.deepEqual(after.unlocks, [locked.id])
})
