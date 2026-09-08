// THE PARTS LADDER. Pure: no window, no document, no timers, no clock.
//
// A part is three things and nothing else: a DRAWING (render/shaft.js paints it, render/screens.js
// draws it in the Workshop and on its card), sometimes a SOUND (audio.js, one voice replacing
// another at a trigger that already existed), and a CARD — one true sentence about what the thing is
// on a real lift, with its sources, read from data/parts.json through the gate in src/gate.js.
//
// WHY THIS FILE EXISTS. Round 3 measured the problem: "all three Workshop parts are owned by
// building 7 … every building yields exactly 16 bacon … roughly 20-25 minutes before the elevator
// stops rewarding an elevator-loving child." The loop may not change (DESIGN amendment 12, and the
// child's own predictability), so the variety is ADDITIVE and INERT: what the lift LOOKS like, and
// what there is to read about it.
//
// FOUR RULES, and every one of them is load-bearing.
//  1. `at` is a LUNCHBOX THRESHOLD and nothing else. Not a level, not a step, not a streak, not a
//     speed, not a clock. The lunchbox is monotone and is never spent, so crossing a threshold is
//     permanent by construction.
//  2. THE GAME OWNS THE SHAFT; THE CHILD OWNS THE CAR. Nothing here is ever auto-equipped,
//     re-locked, replaced or swapped by the game. The roof card NAMES a new part and draws it; the
//     car the child rode up in is the car they ride down in, until they tap in the Workshop.
//  3. Nothing is a mystery. A locked row prints its full name, its drawing, its exact threshold and
//     how many strips are left.
//  4. A part may not be felt by the reducer. `equipped` is read in state.js in exactly one place,
//     `case 'equip'` — test/parts-inert.test.js asserts that statically AND behaviourally.
//
// The thresholds sit on the 16-bacon-per-building grid at offset −4, so each one lands at a ROOF:
// 12, 28, 44, 60, 76, 92, 108, 124, 140, 156, 172, 188 are buildings 1 to 12, then 204, 236, 284,
// 332, 380 at buildings 13, 15, 18, 21 and 24. Past that the plaque ladder and The Climb carry the
// forward line (src/climb.js); test/parts.test.js pins the whole sequence and its gaps.

import { forbiddenWord, sourcesReason } from './gate.js'

export const SLOTS = Object.freeze([
  { id: 'doors', title: 'Doors' },
  { id: 'indicator', title: 'Indicator' },
  { id: 'cab', title: 'Car' },
  { id: 'chime', title: 'Chime' },
  { id: 'edge', title: 'Door edge' },
  { id: 'guides', title: 'Guides' },
  { id: 'panel', title: 'Car buttons' },
])
export const SLOT_IDS = Object.freeze(SLOTS.map((s) => s.id))

// `at: 0` is the default the child already rides and owns from the first second. The four ids that
// shipped before this round — doors-centre, doors-telescopic, segment, dotmatrix, single, two-tone —
// keep their spelling, because they are in saves in the wild. Their thresholds only ever move DOWN
// (18 → 12, 50 → 28, 100 → 60): a lower threshold cannot un-earn anything.
export const PARTS = Object.freeze([
  { id: 'doors-centre', slot: 'doors', at: 0, name: 'Centre-opening doors' },
  { id: 'doors-telescopic', slot: 'doors', at: 12, name: 'Two-speed side-opening doors' },
  { id: 'doors-single', slot: 'doors', at: 92, name: 'Single-slide door' },
  { id: 'doors-gate', slot: 'doors', at: 204, name: 'Collapsible car gate' },
  { id: 'doors-four', slot: 'doors', at: 332, name: 'Four-panel centre-opening doors' },

  { id: 'segment', slot: 'indicator', at: 0, name: 'Seven-segment indicator' },
  { id: 'dotmatrix', slot: 'indicator', at: 28, name: 'Dot-matrix indicator' },
  { id: 'ind-dial', slot: 'indicator', at: 76, name: 'Half-moon dial' },
  { id: 'ind-numerals', slot: 'indicator', at: 172, name: 'Illuminated numerals' },
  { id: 'ind-nixie', slot: 'indicator', at: 284, name: 'Nixie tubes' },

  { id: 'cab-steel', slot: 'cab', at: 0, name: 'Painted steel car' },
  { id: 'cab-stainless', slot: 'cab', at: 44, name: 'Brushed stainless car' },
  { id: 'cab-veneer', slot: 'cab', at: 124, name: 'Wood veneer car' },
  { id: 'cab-brass', slot: 'cab', at: 236, name: 'Polished brass car' },
  { id: 'cab-glass', slot: 'cab', at: 380, name: 'Glass observation car' },

  { id: 'single', slot: 'chime', at: 0, name: 'Single chime' },
  { id: 'two-tone', slot: 'chime', at: 60, name: 'Two-tone chime' },
  { id: 'chime-gong', slot: 'chime', at: 156, name: 'Brass arrival gong' },

  { id: 'edge-safety', slot: 'edge', at: 0, name: 'Mechanical safety edge' },
  { id: 'edge-curtain', slot: 'edge', at: 108, name: 'Infrared light curtain' },

  { id: 'guides-shoe', slot: 'guides', at: 0, name: 'Sliding guide shoes' },
  { id: 'guides-roller', slot: 'guides', at: 140, name: 'Roller guides' },

  { id: 'panel-plain', slot: 'panel', at: 0, name: 'Plain car buttons' },
  { id: 'panel-braille', slot: 'panel', at: 188, name: 'Braille car panel' },
])

export const PART_IDS = Object.freeze(PARTS.map((p) => p.id))
const BY_ID = new Map(PARTS.map((p) => [p.id, p]))

export function partById(id) { return BY_ID.get(id) || null }
export function partsBySlot(slot) { return PARTS.filter((p) => p.slot === slot) }
export function defaultPart(slot) { const p = PARTS.find((x) => x.slot === slot && x.at === 0); return p ? p.id : null }
export function defaultEquipped() {
  const out = {}
  for (const s of SLOT_IDS) out[s] = defaultPart(s)
  return out
}
// Every id a slot will accept, for save.js's oneOf. One list, so a new part cannot be earnable and
// unloadable at the same time.
export function slotPartIds(slot) { return partsBySlot(slot).map((p) => p.id) }

// The cheapest part the lunchbox has NOT reached. Null once every part is earned — the roof card
// falls through to the plaque ladder and then to The Climb, which never runs out.
export function nextPart(lunchbox) {
  const n = typeof lunchbox === 'number' && Number.isFinite(lunchbox) ? lunchbox : 0
  let best = null
  for (const p of PARTS) if (p.at > n && (!best || p.at < best.at)) best = p
  return best
}

// The ids a lunchbox has earned but a save has not yet recorded. arrive() calls this at the roof.
export function newlyUnlocked(lunchbox, unlocks) {
  const have = new Set(Array.isArray(unlocks) ? unlocks : [])
  return PARTS.filter((p) => p.at > 0 && p.at <= lunchbox && !have.has(p.id)).map((p) => p.id)
}

export function isUnlocked(part, unlocks) {
  if (!part) return false
  return part.at === 0 || (Array.isArray(unlocks) && unlocks.includes(part.id))
}

// How many parts the child owns, out of how many exist. The Logbook prints it; it never falls.
export function partsOwned(unlocks) {
  const have = new Set(Array.isArray(unlocks) ? unlocks : [])
  return { owned: PARTS.filter((p) => p.at === 0 || have.has(p.id)).length, total: PARTS.length }
}

// ---- the card bank ------------------------------------------------------------------------
// Same shape as the fact bank's loader and the SAME gate module: an id that exists, one true
// sentence short enough to read at the reward moment, and sources good enough to print.
export const MAX_REAL = 240

export function loadParts(json) {
  const items = Array.isArray(json) ? json : (json && Array.isArray(json.items) ? json.items : [])
  const cards = []
  const rejected = []
  const seen = new Set()
  for (const it of items) {
    const id = it && typeof it.id === 'string' ? it.id : null
    if (!id) { rejected.push({ id: null, reason: 'missing id' }); continue }
    if (seen.has(id)) { rejected.push({ id, reason: 'duplicate id' }); continue }
    const reason = cardGate(it)
    if (reason) { rejected.push({ id, reason }); continue }
    seen.add(id)
    cards.push({
      id,
      real: it.real.trim(),
      sources: it.sources.map((s) => ({ title: String(s.title || '').trim(), url: String(s.url || '').trim(), quote: s.quote ? String(s.quote) : undefined })),
    })
  }
  return { cards, rejected }
}

function cardGate(it) {
  if (!BY_ID.has(it.id)) return 'no such part'
  if (typeof it.real !== 'string' || !it.real.trim()) return 'missing the true sentence'
  if (it.real.trim().length > MAX_REAL) return `the true sentence is over ${MAX_REAL} characters`
  const bad = forbiddenWord(it.real)
  if (bad) return `forbidden word: ${bad}`
  return sourcesReason(it.sources)
}
