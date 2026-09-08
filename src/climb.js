// THE CLIMB. Pure.
//
// The parts ladder ends. The plaque ladder ends. The Climb does not, and that is the whole reason
// it is here: round 3 measured a roof card that stopped naming a next goal (r3-elevator-feel-02),
// the fix fell through from PARTS to PLAQUES, and PLAQUES has a last rung too. This counts the
// FLOORS the child has ridden under power against ten real buildings, in floor order — and past the
// tallest of them it counts Burj Khalifas, for ever. `climbGoal` may never return null and its
// `remaining` may never be zero or less; test/climb.test.js asserts both at every value it can
// reach, which is the invariant the roof card needs and could not previously be given.
//
// WHAT COUNTS. A floor the CAR travelled under power: the one-floor rides, the express hoist out of
// the pit, and the victory descent from the roof. A free fall is not a ride: it is neither counted
// nor punished, exactly like every other consequence of a wrong answer in this game. A building is
// therefore worth at least ten floors, so the first rung (5) lands inside the first building.
//
// The bank is data/climb.json, through the same src/gate.js the fact bank and the part cards use.

import { forbiddenWord, sourcesReason } from './gate.js'

export const MAX_LINE = 240

export function loadClimb(json) {
  const items = Array.isArray(json) ? json : (json && Array.isArray(json.items) ? json.items : [])
  const rungs = []
  const rejected = []
  const seen = new Set()
  for (const it of items) {
    const id = it && typeof it.id === 'string' ? it.id : null
    if (!id) { rejected.push({ id: null, reason: 'missing id' }); continue }
    if (seen.has(id)) { rejected.push({ id, reason: 'duplicate id' }); continue }
    const reason = rungGate(it)
    if (reason) { rejected.push({ id, reason }); continue }
    seen.add(id)
    rungs.push({
      id,
      name: it.name.trim(),
      city: String(it.city || '').trim(),
      floors: it.floors,
      line: it.line.trim(),
      sources: it.sources.map((s) => ({ title: String(s.title || '').trim(), url: String(s.url || '').trim(), quote: s.quote ? String(s.quote) : undefined })),
    })
  }
  rungs.sort((a, b) => a.floors - b.floors)
  // Strictly ascending, or the ladder has two rungs the child reaches at once and one of them can
  // never be "next". Refused rather than silently de-duplicated.
  const out = []
  for (const r of rungs) {
    if (out.length && r.floors <= out[out.length - 1].floors) { rejected.push({ id: r.id, reason: 'floor count is not above the rung below it' }); continue }
    out.push(r)
  }
  return { rungs: out, rejected }
}

function rungGate(it) {
  if (typeof it.name !== 'string' || !it.name.trim()) return 'missing name'
  if (!Number.isInteger(it.floors) || it.floors < 1 || it.floors > 1000) return 'floors must be a whole number of storeys'
  if (typeof it.line !== 'string' || !it.line.trim()) return 'missing the true sentence'
  if (it.line.trim().length > MAX_LINE) return `the true sentence is over ${MAX_LINE} characters`
  const bad = forbiddenWord([it.name, it.city, it.line].join(' '))
  if (bad) return `forbidden word: ${bad}`
  return sourcesReason(it.sources)
}

// climbGoal(floors, rungs) → {reached: [rung], next: {name, city, floors, remaining, times}}
//
// `next` is NEVER null while there is a bank at all, and `remaining` is always at least 1: past the
// last rung the target is the next whole multiple of the tallest building's floor count, and
// `Math.floor(f / top) + 1` is strictly greater than `f / top` for every f, so `top * k > f` always.
export function climbGoal(floors, rungs) {
  const f = Number.isFinite(floors) && floors > 0 ? Math.floor(floors) : 0
  const list = Array.isArray(rungs) ? rungs : []
  if (!list.length) return { reached: [], next: null }
  const reached = list.filter((r) => r.floors <= f)
  const ahead = list.find((r) => r.floors > f)
  if (ahead) return { reached, next: { id: ahead.id, name: ahead.name, city: ahead.city, floors: ahead.floors, remaining: ahead.floors - f, times: 1 } }
  const top = list[list.length - 1]
  const k = Math.floor(f / top.floors) + 1
  const target = top.floors * k
  return { reached, next: { id: top.id, name: top.name, city: top.city, floors: target, remaining: target - f, times: k } }
}

// The words the roof card, the Logbook and the lobby all print, so the child meets the same sentence
// in three places. `times > 1` is the endless tail.
export function climbLabel(next) {
  if (!next) return ''
  return next.times > 1 ? `${next.name} × ${next.times}` : next.name
}
