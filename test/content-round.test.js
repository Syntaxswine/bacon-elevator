// THE CONTENT ROUND (2026-09-08). Round 3 measured the wall this file exists to hold open:
//
//   "All three Workshop parts are owned by building 7, the last level offer lands at building 8,
//    and from building 9 the roof card carries no new line at all. Every building yields exactly
//    16 bacon … Roughly 20-25 minutes before the elevator stops rewarding an elevator-loving child."
//
// The fix is 24 parts across seven slots, a sourced card for each, a Logbook, and The Climb — all
// of it ADDITIVE and INERT to the loop, which is the lead's ruling. The tests below are the four
// things that must stay true for ever:
//
//   1. THE LADDER IS DENSE AND MONOTONE, and a future edit cannot re-cluster it into one building.
//   2. THE FORWARD LINE NEVER GOES SILENT, at any lunchbox and any number of floors.
//   3. NOTHING EARNED IS EVER LOST, including across the save migration.
//   4. A PART CANNOT BE FELT BY THE REDUCER (test/parts-inert.test.js carries that one).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PARTS, SLOTS, SLOT_IDS, partsBySlot, defaultPart, defaultEquipped, nextPart, newlyUnlocked, partsOwned, isUnlocked, loadParts, MAX_REAL } from '../src/parts.js'
import { loadClimb, climbGoal, climbLabel } from '../src/climb.js'
import { sourcesReason, forbiddenWord, forbiddenCitationWord, domainOf } from '../src/gate.js'
import { PLAQUES, lunchboxMilestone, initialState, reduce, tally, ROOF_BONUS } from '../src/state.js'
import { migrate, encodeCode, serialize, parse } from '../src/save.js'
import { mulberry32 } from '../src/rng.js'
import { workshop, logbook, roof, lobby, factbook, partCard, baconGoalLine, climbGoalLine } from '../src/render/screens.js'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { fresh, makeRng, startRide, answer, answerTrivia, run } from './_helpers.js'
const READ_ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = (p) => readFileSync(join(READ_ROOT, p), 'utf8')

const partsJson = JSON.parse(readFileSync(new URL('../data/parts.json', import.meta.url), 'utf8'))
const climbJson = JSON.parse(readFileSync(new URL('../data/climb.json', import.meta.url), 'utf8'))
const rng = () => mulberry32(42)

// ---- 1. the ladder ---------------------------------------------------------------------------

test('the ladder is one part per slot at zero, strictly increasing, and on the roof grid', () => {
  assert.equal(new Set(PARTS.map((p) => p.id)).size, PARTS.length, 'duplicate part id')
  for (const slot of SLOT_IDS) {
    const inSlot = partsBySlot(slot)
    assert.ok(inSlot.length >= 2, `${slot} has nothing to earn`)
    assert.equal(inSlot.filter((p) => p.at === 0).length, 1, `${slot} needs exactly one default`)
    assert.ok(defaultPart(slot), `${slot} has no default`)
  }
  assert.equal(SLOTS.length, SLOT_IDS.length)
  const earned = PARTS.filter((p) => p.at > 0).map((p) => p.at).sort((a, b) => a - b)
  assert.equal(new Set(earned).size, earned.length, 'two parts share a threshold: one of them can never be "next"')
  // A building is 16 bacon (9 strips + 2 x 2 passengers + 3 roof), so a threshold at 16n - 4 lands
  // at the ROOF of building n — the moment the child is looking at the card that names it.
  for (const at of earned) assert.equal(at % 16, 12, `${at} does not land at a roof`)
  assert.deepEqual(defaultEquipped(), Object.fromEntries(SLOT_IDS.map((s) => [s, defaultPart(s)])))
})

// THE GAP INSTRUMENT. Pinning that thresholds are unique and increasing does NOT stop a future edit
// re-clustering them into building 7, which is the exact defect round 3 measured. This walks 120
// buildings, records the building index of every unlock, every plaque and every Climb rung, and
// fails if the ladder ever goes quiet for longer than it does today.
test('no reward gap over 120 buildings is longer than the ladder actually delivers', () => {
  const { rungs } = loadClimb(climbJson)
  const events = new Map() // building index -> what arrived
  let unlocks = []
  for (let b = 1; b <= 120; b++) {
    const lunchbox = 16 * b
    const floors = 10 * b // the guaranteed minimum: nine hops plus the hop to the roof
    const got = newlyUnlocked(lunchbox, unlocks)
    unlocks = unlocks.concat(got)
    const plaques = PLAQUES.filter((p) => p > 16 * (b - 1) && p <= lunchbox)
    const rung = rungs.filter((r) => r.floors > 10 * (b - 1) && r.floors <= floors)
    const tail = []
    const top = rungs[rungs.length - 1].floors
    for (let k = 2; k * top <= floors; k++) if (k * top > 10 * (b - 1)) tail.push(`${rungs[rungs.length - 1].id} x${k}`)
    const all = [...got, ...plaques.map((p) => `plaque ${p}`), ...rung.map((r) => r.id), ...tail]
    if (all.length) events.set(b, all)
  }
  const at = [...events.keys()]
  assert.equal(at[0], 1, 'nothing arrives at the first roof')
  let worst = 0, worstAt = 0
  for (let i = 1; i < at.length; i++) if (at[i] - at[i - 1] > worst) { worst = at[i] - at[i - 1]; worstAt = at[i - 1] }
  // 16 is what the shipped ladder delivers (the quiet stretch is buildings 31-47, between Burj x2
  // and Burj x3, and even there the roof card still counts down to both). Tighten this number when
  // the ladder gets denser; NEVER loosen it without a lead's ruling.
  assert.ok(worst <= 16, `a ${worst}-building gap after building ${worstAt}: ${JSON.stringify([...events].slice(0, 40))}`)
  // and the first twelve buildings each hand over exactly one part
  for (let b = 1; b <= 12; b++) {
    const got = events.get(b) || []
    assert.ok(got.some((x) => PARTS.some((p) => p.id === x)), `building ${b} hands over no part: ${JSON.stringify(got)}`)
  }
  assert.ok(events.size >= 25, `only ${events.size} of 120 buildings hand anything over`)
})

test('newlyUnlocked never re-hands a part, and parts owned never falls', () => {
  let unlocks = []
  let owned = partsOwned(unlocks).owned
  for (let b = 1; b <= 40; b++) {
    const got = newlyUnlocked(16 * b, unlocks)
    for (const id of got) assert.ok(!unlocks.includes(id), `${id} handed over twice`)
    unlocks = unlocks.concat(got)
    const now = partsOwned(unlocks).owned
    assert.ok(now >= owned, 'parts owned went down')
    owned = now
  }
  assert.equal(newlyUnlocked(1e9, unlocks).length, 0, 'a part is still owed after every threshold is past')
  assert.equal(partsOwned(unlocks).owned, PARTS.length)
  assert.equal(isUnlocked(PARTS.find((p) => p.at === 0), []), true, 'a default is owned from the first second')
  assert.equal(isUnlocked(PARTS.find((p) => p.at > 0), []), false)
})

// ---- 2. the forward line -----------------------------------------------------------------------

test('the roof card names a next thing at EVERY lunchbox 0-6000 and every floor count 0-20000', () => {
  const { rungs } = loadClimb(climbJson)
  for (let n = 0; n <= 6000; n++) {
    const bacon = lunchboxMilestone(n)
    const climb = climbGoal(10, rungs) // any floor count: the point is that ONE of the two speaks
    assert.ok(bacon || climb.next, `nothing to aim at with ${n} bacon`)
    if (bacon) assert.ok(bacon.at > n, `the ${n}-bacon goal is not ahead of the child`)
  }
  for (let f = 0; f <= 20000; f++) {
    const g = climbGoal(f, rungs)
    assert.ok(g.next, `The Climb ran out at ${f} floors`)
    assert.ok(g.next.remaining > 0, `The Climb asks for ${g.next.remaining} more floors at ${f}`)
    assert.equal(g.next.floors - f, g.next.remaining)
  }
  // …and past the last part AND the last plaque, The Climb is still the line
  const lastPart = Math.max(...PARTS.map((p) => p.at))
  assert.equal(lunchboxMilestone(PLAQUES[PLAQUES.length - 1]), null)
  assert.ok(climbGoal(999999, rungs).next, 'nothing at all to aim at')
  assert.ok(lastPart < PLAQUES[PLAQUES.length - 1])
})

test('climbGoal is monotone, exact at every boundary, and the tail repeats the tallest building', () => {
  const { rungs } = loadClimb(climbJson)
  let lastReached = -1
  for (let f = 0; f <= 2000; f++) {
    const g = climbGoal(f, rungs)
    assert.ok(g.reached.length >= lastReached, 'a reached rung was taken away')
    lastReached = g.reached.length
  }
  for (const r of rungs) {
    assert.equal(climbGoal(r.floors - 1, rungs).next.id, r.id, `${r.id} is not next one floor below it`)
    assert.equal(climbGoal(r.floors - 1, rungs).next.remaining, 1)
    assert.ok(climbGoal(r.floors, rungs).reached.some((x) => x.id === r.id), `${r.id} is not reached at exactly its own floor count`)
  }
  const top = rungs[rungs.length - 1]
  assert.equal(climbGoal(top.floors, rungs).next.floors, top.floors * 2)
  assert.equal(climbGoal(top.floors, rungs).next.times, 2)
  assert.equal(climbLabel(climbGoal(top.floors, rungs).next), `${top.name} × 2`)
  assert.equal(climbLabel(climbGoal(0, rungs).next), rungs[0].name)
  // garbage in
  assert.equal(climbGoal(NaN, rungs).next.id, rungs[0].id)
  assert.equal(climbGoal(5, []).next, null)
})

// ---- the banks and the shared gate -------------------------------------------------------------

test('every shipped part card passes the gate, and every part has one', () => {
  const { cards, rejected } = loadParts(partsJson)
  assert.deepEqual(rejected, [], 'a shipped part card was refused')
  assert.equal(cards.length, PARTS.length, 'a part has no card, or a card has no part')
  for (const p of PARTS) {
    const c = cards.find((x) => x.id === p.id)
    assert.ok(c, `${p.id} has no card`)
    assert.ok(c.real.length > 40 && c.real.length <= MAX_REAL, `${p.id}: ${c.real.length} characters`)
    assert.ok(c.sources.length >= 1)
    for (const s of c.sources) {
      assert.match(s.url, /^https?:\/\//)
      assert.ok(s.title && s.title.toLowerCase() !== domainOf(s.url).toLowerCase(), `${p.id}: a source title is its own domain`)
      assert.ok(s.quote && s.quote.length > 10, `${p.id}: a source with no quote fetched from it`)
    }
  }
})

test('every Climb rung passes the gate, and the ten are in strict floor order', () => {
  const { rungs, rejected } = loadClimb(climbJson)
  assert.deepEqual(rejected, [], 'a shipped Climb rung was refused')
  assert.equal(rungs.length, 10)
  for (let i = 1; i < rungs.length; i++) assert.ok(rungs[i].floors > rungs[i - 1].floors, 'the ladder is not strictly ascending')
  for (const r of rungs) {
    assert.ok(r.name && r.city && r.line.length > 40, `${r.id} is thin`)
    assert.ok(r.sources.length >= 1 && r.sources.every((s) => /^https?:\/\//.test(s.url) && s.quote), `${r.id} is not sourced with a fetched quote`)
  }
})

test('the gate refuses what it is there to refuse, in one place for all three banks', () => {
  assert.equal(forbiddenWord('a lift that never crashed'), 'crashed')
  assert.equal(forbiddenWord('a lift that rises'), null)
  // the citation lens is WIDER than the child-text lens, and deliberately excludes `grave`
  assert.equal(forbiddenCitationWord('In Memoriam, Larry Shaw'), 'Memoriam')
  assert.equal(forbiddenWord('In Memoriam, Larry Shaw'), null)
  assert.equal(forbiddenCitationWord('Elisha Graves Otis, a life'), null, 'the gate must not police a middle name')
  assert.equal(sourcesReason([]), 'no sources')
  assert.equal(sourcesReason([{ title: 'A title', url: 'ftp://x/y' }]), 'no http(s) source url')
  assert.equal(sourcesReason([{ title: '', url: 'https://x.example/y' }]), 'a source has no title')
  assert.match(sourcesReason([{ title: 'piday.org', url: 'https://piday.org/x' }]), /just its own domain/)
  assert.match(sourcesReason([{ title: 'Fine', url: 'https://x.example/obituaries/y' }]), /forbidden word in a source/)
  assert.equal(sourcesReason([{ title: 'Fine', url: 'https://x.example/y' }]), null)
  // …and the part loader uses it
  const bad = loadParts({ items: [
    { id: 'not-a-part', real: 'x'.repeat(50), sources: [{ title: 'T', url: 'https://x.example/y' }] },
    { id: 'segment', real: '', sources: [{ title: 'T', url: 'https://x.example/y' }] },
    { id: 'segment', real: 'A lift that crashed.', sources: [{ title: 'T', url: 'https://x.example/y' }] },
    { id: 'dotmatrix', real: 'x'.repeat(MAX_REAL + 1), sources: [{ title: 'T', url: 'https://x.example/y' }] },
    { id: 'single', real: 'A real sentence about a chime.', sources: [] },
  ] })
  assert.equal(bad.cards.length, 0)
  assert.deepEqual(bad.rejected.map((r) => r.reason), ['no such part', 'missing the true sentence', 'forbidden word: crashed', `the true sentence is over ${MAX_REAL} characters`, 'no sources'])
})

// ---- 3. the save ------------------------------------------------------------------------------

test('a save written before the content round migrates without losing anything', () => {
  // exactly what shipped: three slots, the old thresholds, no records, no book settings
  const old = {
    v: 1, salt: 77, writes: 12, lunchbox: 137, buildings: 8, level: 'hotel', step: 2, adaptive: true, pinnedStep: 1,
    settings: { sound: true, volume: 70, speed: 'fast', motion: 'reduced', bigText: true, secondTry: false, passengers: 'often', links: true, custom: { ops: ['mul'], min: 2, max: 30, negatives: false } },
    facts: { seen: ['otis-1854'], right: ['otis-1854'], retry: [] },
    unlocks: ['doors-telescopic', 'dotmatrix', 'two-tone'],
    equipped: { doors: 'doors-telescopic', indicator: 'dotmatrix', chime: 'two-tone' },
    history: { ring: ['add:5:7'], count: 90, answered: 90, correct: 71, falls: 6, byKind: {}, skills: {}, comeback: [] },
    plaques: [], rulesSeen: true, ride: null,
  }
  const s = migrate(old)
  // NOTHING EARNED IS LOST: every unlock, every fitted part, the lunchbox, the buildings, the facts
  assert.equal(s.lunchbox, 137)
  assert.equal(s.buildings, 8)
  assert.deepEqual(s.unlocks, ['doors-telescopic', 'dotmatrix', 'two-tone'])
  assert.equal(s.equipped.doors, 'doors-telescopic', 'the child lost the doors they chose')
  assert.equal(s.equipped.indicator, 'dotmatrix')
  assert.equal(s.equipped.chime, 'two-tone')
  assert.deepEqual(s.facts.seen, ['otis-1854'])
  assert.equal(s.settings.speed, 'fast')
  // …and the four new slots arrive at their defaults, fitted, not empty and not locked
  for (const slot of SLOT_IDS) assert.ok(s.equipped[slot], `${slot} came through empty`)
  assert.equal(s.equipped.cab, 'cab-steel')
  assert.equal(s.equipped.edge, 'edge-safety')
  assert.equal(s.equipped.guides, 'guides-shoe')
  assert.equal(s.equipped.panel, 'panel-plain')
  assert.deepEqual(s.records, { floors: 0, rides: 0, longest: 0, passengers: 0 })
  assert.equal(s.settings.bookKind, 'all')
  assert.equal(s.settings.bookOrder, 'newest')
  // it renders, on every screen the new fields reach
  const st = { ...initialState(77), ...s, pool: [], partsPool: [], climb: [] }
  for (const fn of [lobby, workshop, logbook, factbook]) assert.ok(fn(st).length > 100, fn.name)
  // and it round-trips
  const back = parse(serialize(st))
  assert.deepEqual(back.equipped, s.equipped)
  assert.deepEqual(back.records, s.records)
})

test('a hostile or half-written save cannot equip a part the child has not earned', () => {
  const s = migrate({ v: 1, lunchbox: 0, unlocks: ['not-a-part', 42, 'cab-glass'], equipped: { doors: 'doors-gate', indicator: 'nonsense', cab: 'cab-glass', edge: 7, guides: null, panel: 'panel-braille' } })
  assert.equal(s.equipped.doors, 'doors-centre', 'a locked door set was fitted from a hand-edited code')
  assert.equal(s.equipped.indicator, 'segment')
  assert.equal(s.equipped.cab, 'cab-glass', 'an unlock that IS in the ladder must survive')
  assert.equal(s.equipped.edge, 'edge-safety')
  assert.equal(s.equipped.guides, 'guides-shoe')
  assert.equal(s.equipped.panel, 'panel-plain')
  assert.deepEqual(s.unlocks, ['cab-glass'], 'a junk unlock id survived into the save')
  // and the counters
  const bad = migrate({ v: 1, records: { floors: -5, rides: 'lots', longest: 900, passengers: 1e308 } })
  // Clamped to the range, not zeroed: a number that is merely too big is a corrupt record, and the
  // ceiling is what stops `1e308 + 1 === 1e308` freezing the counter for ever (save.js MAX_COUNT).
  assert.deepEqual(bad.records, { floors: 0, rides: 0, longest: 0, passengers: 1e9 })
  const clamped = migrate({ v: 1, records: { floors: 3, rides: 2, longest: 9, passengers: 1 } })
  assert.equal(clamped.records.longest, 3, 'the longest single ride cannot exceed every floor ever ridden')
})

// THE GATE MEASURED 60 % OF THE TRUTH (r5-code-hostile-03). It built its state BY HAND with
// `facts.right: []` and `facts.retry: []` - two of the three PERSIST fields that dominate the blob
// and that real play fills - so it read 5 434 characters against its own `< 9000` while a state
// reached by playing 20-40 buildings encodes at 9 000-12 000. `facts.right` alone puts it over the
// old bound. A gate that cannot fail at any size the game can produce is not a bound; this one
// PLAYS the reducer, so the number it asserts is the number a parent gets.
function playedPeak({ salt, level, accuracy, buildings }) {
  const rng = makeRng(salt)
  let s = fresh(salt)
  for (const [key, value] of [['passengers', 'often'], ['secondTry', false]]) s = reduce(s, { type: 'set-setting', key, value }, rng).state
  s = reduce(s, { type: 'set-level', id: level }, rng).state
  s = startRide(s, rng)
  let peak = 0, done = 0
  for (let b = 0; b < buildings; b++) {
    let guard = 0
    while (s.phase !== 'roof' && guard++ < 300) {
      if (s.phase === 'floor' || s.phase === 'keypad') s = answer(s, rng, rng() < accuracy).state
      else if (s.phase === 'trivia') s = answerTrivia(s, rng, rng() < accuracy)
      else if (s.phase === 'repair') s = run(s, { type: 'card-continue' }, rng).state
      else break
    }
    if (s.phase !== 'roof') break
    peak = Math.max(peak, encodeCode(s).length); done = b + 1
    if (s.roof && s.roof.offer) s = reduce(s, { type: 'offer', accept: true }, rng).state
    s = reduce(s, { type: 'next-building' }, rng).state
  }
  return { peak, done, state: s }
}

test('the save code has a ceiling, and it is measured on a state the reducer actually reaches', () => {
  let worst = { peak: 0 }
  for (const level of ['corner', 'office', 'megatall']) {
    for (const accuracy of [0.55, 0.7, 0.85]) {
      const r = playedPeak({ salt: 7, level, accuracy, buildings: 60 })
      assert.equal(r.done, 60, `${level} @ ${accuracy}: only ${r.done} buildings played`)
      assert.ok(encodeCode(r.state).startsWith('BE1-'))
      if (r.peak > worst.peak) worst = { ...r, level, accuracy }
    }
  }
  // The bug this replaces: the hand-built fixture was UNDER the old bound, so the gate could not
  // fail. Real play is over it, which is the fact the old number hid.
  assert.ok(worst.peak > 9000, `real play now peaks at ${worst.peak}: the old 9 000 gate would hold and this test is stale`)
  // BOUNDED, which is the invariant round 2 established and the one that matters: `facts.seen`
  // dedupes, `right` is includes-guarded and `retry` is filtered before it is concatenated, so each
  // is at most one entry per fact in the bank. Nothing here grows with buildings played.
  const long = playedPeak({ salt: 7, level: worst.level, accuracy: worst.accuracy, buildings: 140 })
  assert.ok(long.peak <= worst.peak + 400, `the code grew ${worst.peak} → ${long.peak} between 60 and 140 buildings`)
  assert.ok(long.peak < 14000, `the save code reaches ${long.peak} characters (${worst.level} @ ${worst.accuracy})`)
  // …and nothing anywhere asks a parent to transcribe it by hand.
  assert.ok(!/copy it by hand/.test(read('src/main.js') + read('src/render/screens.js')), 'a screen still offers hand-copying as the fallback')
})

// ---- the screens say the right things -----------------------------------------------------------

test('the Workshop prints every locked part by name, drawing and exact distance — no mystery boxes', () => {
  const st = { ...initialState(3), lunchbox: 40, partsPool: loadParts(partsJson).cards, climb: loadClimb(climbJson).rungs, pool: [] }
  const html = workshop(st)
  for (const p of PARTS) {
    assert.ok(html.includes(p.name), `${p.id} is not named in the Workshop`)
    assert.ok(html.includes(`data-part-card="${p.id}"`), `${p.id} has no card button`)
    assert.ok(html.includes(`data-equip-part="${p.id}"`), `${p.id} has no radio`)
    if (p.at > 40) assert.ok(html.includes(`at ${p.at} bacon · ${p.at - 40} more`), `${p.id} does not print its distance`)
  }
  const shown = html.replace(/<[^>]*>/g, ' ')  // what the child READS, not the class names
  assert.ok(!/\?\?\?|coming soon|\blocked\b|\bhidden\b|\bsecret\b|\bmystery\b/i.test(shown), `a mystery box in the Workshop: ${shown.slice(0, 200)}`)
  assert.match(html, /id="workshop-next"/)
  assert.ok(html.includes('Next part: Brushed stainless car'), 'the Workshop does not name the next part')
  // the card carries the sentence and the source as text; an anchor only with links on
  const card = partCard(st, 'cab-glass')
  assert.match(card, /Source: /)
  assert.ok(!/<a /.test(card), 'the part card links out with links off')
  assert.match(partCard({ ...st, settings: { ...st.settings, links: true } }, 'cab-glass'), /<a href="https:\/\//)
  assert.equal(partCard(st, 'not-a-part'), '')
  assert.equal(partCard(st, null), '')
})

test('no screen the child can reach shows a fall, an accuracy or a percentage', () => {
  const st = { ...initialState(4), lunchbox: 300, buildings: 20, records: { floors: 250, rides: 220, longest: 9, passengers: 40 }, climb: loadClimb(climbJson).rungs, partsPool: loadParts(partsJson).cards, pool: [], history: { ...initialState(4).history, answered: 180, correct: 140, falls: 40 } }
  for (const fn of [lobby, workshop, logbook, factbook]) {
    const html = fn(st).replace(/<[^>]*>/g, ' ')
    for (const word of [/\bfalls?\b/i, /\baccuracy\b/i, /%/, /\bstreak\b/i, /\bwrong\b/i]) {
      assert.ok(!word.test(html), `${fn.name} shows ${word}`)
    }
  }
  // …and the roof card does not either
  const rf = roof({ ...st, roof: { gained: 13, bonus: 3, unlocked: [], plaques: [], offer: null, offerTaken: null, lunchboxBefore: 284 }, ride: { tray: 16 } }).replace(/<[^>]*>/g, ' ')
  assert.ok(!/\bfalls?\b/i.test(rf) && !/%/.test(rf))
})

test('both forward lines carry a number, and the lobby prints them', () => {
  const st = { ...initialState(5), lunchbox: 20, records: { floors: 30, rides: 30, longest: 10, passengers: 4 }, climb: loadClimb(climbJson).rungs, partsPool: [], pool: [] }
  assert.match(baconGoalLine(st), /Next at 28 bacon: Dot-matrix indicator — 8 more\./)
  assert.match(climbGoalLine(st), /The Climb: 30 more floors to the Woolworth Building — 60 floors\./)
  const html = lobby(st)
  assert.ok(html.includes('data-goal="bacon"') && html.includes('data-goal="climb"'))
  // past the last plaque only The Climb speaks, and the lobby still prints a goal
  const done = { ...st, lunchbox: 99999 }
  assert.equal(baconGoalLine(done), '')
  assert.ok(climbGoalLine(done).length > 10)
  assert.ok(lobby(done).includes('data-goal="climb"'))
})

// ---- tally: the Logbook's numbers only ever rise ------------------------------------------------

test('tally is monotone in every field and takes the max for the longest ride', () => {
  let r = { floors: 0, rides: 0, longest: 0, passengers: 0 }
  r = tally(r, { floors: 1, rides: 1 })
  assert.deepEqual(r, { floors: 1, rides: 1, longest: 1, passengers: 0 })
  r = tally(r, { floors: 8, rides: 1 })
  assert.deepEqual(r, { floors: 9, rides: 2, longest: 8, passengers: 0 })
  r = tally(r, { floors: 1, rides: 1 })
  assert.equal(r.longest, 8, 'the longest ride shrank')
  r = tally(r, { passengers: 1 })
  assert.deepEqual(r, { floors: 10, rides: 3, longest: 8, passengers: 1 })
  // garbage and negatives cannot move it backwards
  assert.deepEqual(tally(r, { floors: -5 }), { ...r })
  assert.deepEqual(tally(r, { floors: NaN }), { ...r })
  assert.deepEqual(tally(null, {}), { floors: 0, rides: 0, longest: 0, passengers: 0 })
})

test('a played building fills the Logbook, and the roof hands over the first part', () => {
  const r = rng()
  let s = initialState(9)
  s = reduce(s, { type: 'set-seed', seed: 42 }, r).state
  s = { ...s, rulesSeen: true }
  s = reduce(s, { type: 'ride-start' }, r).state
  let guard = 0
  while (s.phase !== 'roof' && guard++ < 400) {
    if (s.phase === 'floor') s = reduce(s, { type: 'press-floor', floor: s.ride.target }, r).state
    else if (s.phase === 'keypad' || s.phase === 'repair') {
      for (const ch of String(s.ride.problem.answer)) s = reduce(s, { type: 'digit', d: ch }, r).state
      s = reduce(s, { type: 'go' }, r).state
    } else if (s.phase === 'moving' || s.phase === 'falling') s = reduce(s, { type: 'timeline-done' }, r).state
    else if (s.phase === 'trivia') s = reduce(s, { type: 'choice', i: s.trivia.answer }, r).state
    else if (s.phase === 'fact') s = reduce(s, { type: 'card-continue' }, r).state
    else break
  }
  assert.equal(s.phase, 'roof')
  assert.equal(s.buildings, 1)
  assert.equal(s.records.rides, 10, 'nine hops and the hop to the roof')
  assert.equal(s.records.floors, 10)
  assert.equal(s.records.longest, 1)
  assert.equal(s.lunchbox, 9 + ROOF_BONUS, 'no passengers with an empty bank')
  // THE FIRST PART ARRIVES AT THE FIRST ROOF — the whole point of the ladder's new first rung. Even
  // with no fact bank loaded (9 strips + 3 roof bonus = 12, and the threshold is 12).
  assert.deepEqual(s.roof.unlocked, ['doors-telescopic'], 'building 1 hands over nothing')
  assert.ok(s.unlocks.includes('doors-telescopic'))
  assert.equal(s.equipped.doors, 'doors-centre', 'the new part was fitted without the child tapping it')
  // the victory descent counts as the ride it is
  s = reduce(s, { type: 'to-lobby' }, r).state
  s = reduce(s, { type: 'timeline-done' }, r).state
  assert.equal(s.records.floors, 20, 'the descent R to G is ten floors the lift really carried you')
  assert.equal(s.records.longest, 10)
})
