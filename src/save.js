// Save serialisation. Pure: tolerates garbage, migrates v0, and makes the BE1- share code.
import { initialState, SETTINGS_DEFAULTS, normaliseRide } from './state.js'
import { validProblem } from './math.js'

export const SAVE_KEY = 'bacon-elevator.save.v1'

// `writes` is the record's own monotone write counter: main.js refuses to overwrite a record whose
// counter has moved past the one this tab last wrote, which is what stops a second tab holding an
// older snapshot from zeroing the lunchbox the moment it is backgrounded.
const PERSIST = ['v', 'created', 'salt', 'writes', 'lunchbox', 'buildings', 'level', 'step', 'adaptive', 'pinnedStep', 'settings', 'facts', 'unlocks', 'equipped', 'history', 'ride', 'rulesSeen', 'step3Run', 'plaques']

export function serialize(state) {
  const out = {}
  for (const k of PERSIST) if (state[k] !== undefined) out[k] = state[k]
  out.v = 1
  return JSON.stringify(out)
}

function isObj(x) { return x !== null && typeof x === 'object' && !Array.isArray(x) }
// Range, not merely type. Number.isInteger(1e308) is true, and a lunchbox that large prints as
// "1e+308" on the top bar and never increments again (1e308 + 3 === 1e308).
const int = (x, d) => (Number.isSafeInteger(x) ? x : d)
const MAX_BACON = 1e9
const MAX_COUNT = 1e9
const clampInt = (x, lo, hi, d) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(lo, Math.min(hi, Math.trunc(x))) : d)
const bool = (x, d) => (typeof x === 'boolean' ? x : d)
const oneOf = (x, opts, d) => (opts.includes(x) ? x : d)
const strArr = (x) => (Array.isArray(x) ? x.filter((s) => typeof s === 'string') : [])

// v0 → v1 and general repair: every field is checked, garbage falls back to defaults.
export function migrate(obj) {
  const base = initialState(isObj(obj) && Number.isInteger(obj.salt) ? obj.salt : undefined)
  if (!isObj(obj)) return base
  const s = { ...base }
  if (obj.v === undefined || obj.v === 0) {
    // v0 saves kept score as `bacon` and the level as `levelId`.
    obj = { ...obj, lunchbox: obj.lunchbox ?? obj.bacon, level: obj.level ?? obj.levelId }
  }
  s.created = int(obj.created, base.created)
  s.writes = clampInt(obj.writes, 0, MAX_COUNT, 0)
  s.lunchbox = clampInt(obj.lunchbox, 0, MAX_BACON, 0)
  s.buildings = clampInt(obj.buildings, 0, 1e6, 0)
  s.level = oneOf(obj.level, ['corner', 'hotel', 'office', 'sky', 'megatall', 'custom'], 'corner')
  s.step = Math.max(1, Math.min(3, int(obj.step, 1)))
  s.adaptive = bool(obj.adaptive, true)
  s.pinnedStep = Math.max(1, Math.min(3, int(obj.pinnedStep, 1)))
  s.rulesSeen = bool(obj.rulesSeen, false)
  s.step3Run = Math.max(0, int(obj.step3Run, 0))
  s.plaques = [...new Set(strArr(obj.plaques))]   // an older save may hold the same plaque many times
  const st = isObj(obj.settings) ? obj.settings : {}
  s.settings = {
    sound: bool(st.sound, SETTINGS_DEFAULTS.sound),
    volume: Math.max(0, Math.min(100, int(st.volume, SETTINGS_DEFAULTS.volume))),
    speed: oneOf(st.speed, ['normal', 'fast'], 'normal'),
    motion: oneOf(st.motion, ['auto', 'full', 'reduced'], 'auto'),
    bigText: bool(st.bigText, false),
    secondTry: bool(st.secondTry, SETTINGS_DEFAULTS.secondTry),
    passengers: oneOf(st.passengers, ['often', 'sometimes', 'never'], 'sometimes'),
    links: bool(st.links, false),
    custom: {
      ops: (isObj(st.custom) && Array.isArray(st.custom.ops) ? st.custom.ops.filter((o) => ['add', 'sub', 'mul', 'div', 'missAdd', 'up', 'down'].includes(o)) : null) || SETTINGS_DEFAULTS.custom.ops.slice(),
      min: isObj(st.custom) ? Math.max(0, int(st.custom.min, 0)) : 0,
      max: isObj(st.custom) ? Math.max(2, Math.min(9999, int(st.custom.max, 20))) : 20,
      negatives: isObj(st.custom) ? bool(st.custom.negatives, false) : false,
    },
  }
  if (s.settings.custom.min >= s.settings.custom.max) s.settings.custom.min = 0
  const f = isObj(obj.facts) ? obj.facts : {}
  // ONE ENTRY PER FACT, most recent last. An older save appended on every answer including repeats,
  // so the list — and the BE1- code built from it — grew without bound; de-duplicating on the way in
  // makes an upgraded save the same shape as a new one. `at` moved from "seen.length when it was
  // missed" to the monotone question count, so a legacy value is clamped to a count that exists.
  const seen = strArr(f.seen).filter((id, i, a) => a.lastIndexOf(id) === i)
  s.facts = { seen, right: strArr(f.right), retry: Array.isArray(f.retry) ? f.retry.filter((r) => isObj(r) && typeof r.id === 'string' && Number.isInteger(r.at)) : [] }
  s.unlocks = strArr(obj.unlocks)
  const eq = isObj(obj.equipped) ? obj.equipped : {}
  s.equipped = {
    doors: oneOf(eq.doors, ['doors-centre', 'doors-telescopic'], 'doors-centre'),
    indicator: oneOf(eq.indicator, ['segment', 'dotmatrix'], 'segment'),
    chime: oneOf(eq.chime, ['single', 'two-tone'], 'single'),
  }
  for (const slot of Object.keys(s.equipped)) {
    const part = s.equipped[slot]
    if (part !== base.equipped[slot] && !s.unlocks.includes(part)) s.equipped[slot] = base.equipped[slot]
  }
  const h = isObj(obj.history) ? obj.history : {}
  s.history = {
    ring: strArr(h.ring).slice(-20),
    count: clampInt(h.count, 0, MAX_COUNT, 0),
    answered: clampInt(h.answered, 0, MAX_COUNT, 0),
    correct: clampInt(h.correct, 0, MAX_COUNT, 0),
    falls: clampInt(h.falls, 0, MAX_COUNT, 0),
    byKind: isObj(h.byKind) ? Object.fromEntries(Object.entries(h.byKind).filter(([, v]) => Array.isArray(v) && v.length === 2 && v.every(Number.isInteger)).map(([k, v]) => [k, v.slice()])) : {},
    skills: isObj(h.skills) ? Object.fromEntries(Object.entries(h.skills).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, v.map((x) => (x ? 1 : 0)).slice(-8)])) : {},
    // The comeback queue lives here now (it could not mature inside one building). Same validator
    // the live problem gets: makeProblem hands a due entry straight to the renderer.
    comeback: (Array.isArray(h.comeback) ? h.comeback : []).map((x) => (isObj(x) ? { problem: validProblem(x.problem), due: clampInt(x.due, 0, MAX_COUNT, -1) } : null)).filter((x) => x && x.problem && x.due >= 0).slice(-12),
  }
  s.facts.retry = s.facts.retry.map((r) => ({ id: r.id, at: Math.max(0, Math.min(s.history.count, r.at)) }))
  s.ride = migrateRide(obj.ride)
  s.phase = 'lobby'
  s.screen = 'lobby'
  return s
}

function migrateRide(r) {
  if (!isObj(r)) return null
  const problem = validProblem(r.problem)
  const floor = clampInt(r.floor, -1, 10, 0)
  const phase = oneOf(r.phase, ['floor', 'keypad', 'repair', 'trivia', 'fact', 'roof'], 'floor')
  const cleared = Array.isArray(r.cleared) ? [...new Set(r.cleared.filter((x) => Number.isSafeInteger(x) && x >= 1 && x <= 9))].sort((x, y) => x - y) : []
  const target = clampInt(r.target, 1, 10, floor + 1)
  // A save taken mid-timeline: {name, to}; hydrate() plays it to its end before anything renders.
  const f = isObj(r.inFlight) ? r.inFlight : null
  const inFlight = f && ['ride', 'express', 'fall', 'descend'].includes(f.name) && Number.isInteger(f.to) && f.to >= -1 && f.to <= 10 ? { name: f.name, to: f.to } : null
  const tray = clampInt(r.tray, 0, MAX_BACON, 0)
  const out = {
    seed: int(r.seed, 1) >>> 0,
    floor,
    target,
    cleared,
    tray,
    // banked can never exceed the tray, or the roof card would say the tray gave less than it banked.
    banked: Math.min(tray, clampInt(r.banked, 0, MAX_BACON, 0)),
    phase,
    problem,
    typed: typeof r.typed === 'string' && /^-?\d{0,6}$/.test(r.typed) ? r.typed : '',
    tries: clampInt(r.tries, 0, 99, 0),
    streak: clampInt(r.streak, 0, 99, 0),
    stepDowns: clampInt(r.stepDowns, 0, 99, 0),
    // A comeback problem is drawn verbatim when it is due and handed straight to the renderer, so it
    // gets the same validator the live problem gets — `isObj` alone let `{}` through to text.split().
    comeback: (Array.isArray(r.comeback) ? r.comeback : []).map((x) => (isObj(x) ? { problem: validProblem(x.problem), due: clampInt(x.due, 0, MAX_COUNT, -1) } : null)).filter((x) => x && x.problem && x.due >= 0).slice(0, 40),
    passengersDone: Array.isArray(r.passengersDone) ? [...new Set(r.passengersDone.filter((x) => Number.isSafeInteger(x) && x >= 1 && x <= 9))] : [],
    retrying: bool(r.retrying, false) && (floor === -1 || (inFlight !== null && inFlight.name === 'fall')),
    typedWrong: typeof r.typedWrong === 'string' && /^-?\d{0,6}$/.test(r.typedWrong) ? r.typedWrong : '',
    falls: clampInt(r.falls, 0, 999, 0),
    draws: clampInt(r.draws, 0, MAX_COUNT, 0),
    ctx: isObj(r.ctx) ? r.ctx : null,
    lastKind: oneOf(r.lastKind, ['elevator', 'math'], null),
    fallFloor: clampInt(r.fallFloor, 0, 10, 0),
    roofCard: roofCardOf(r.roofCard),
    inFlight,
  }
  // The one place the CROSS-FIELD invariant is settled: every field above is range-checked on its
  // own, and a ride can still be dead ({floor:4, target:4} presses nothing). A mid-timeline save
  // keeps its phase — hydrate() plays that timeline to its end and normalises there.
  return inFlight ? out : normaliseRide(out)
}

const LEVEL_IDS = ['corner', 'hotel', 'office', 'sky', 'megatall']
function roofCardOf(c) {
  if (!isObj(c)) return null
  return {
    gained: clampInt(c.gained, 0, MAX_BACON, 0),
    bonus: clampInt(c.bonus, 0, 99, 0),
    unlocked: strArr(c.unlocked),
    plaques: strArr(c.plaques),
    offer: oneOf(c.offer, LEVEL_IDS, null),
    offerTaken: oneOf(c.offerTaken, LEVEL_IDS, null),
    lunchboxBefore: clampInt(c.lunchboxBefore, 0, MAX_BACON, 0),
  }
}

export function parse(str) {
  if (typeof str !== 'string' || !str.trim()) return null
  let obj
  try { obj = JSON.parse(str) } catch { return null }
  if (!isObj(obj)) return null
  try { return migrate(obj) } catch { return null }
}

// --- share code: 'BE1-' + base64url(JSON) -------------------------------------------------
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

function bytesOf(str) {
  return new TextEncoder().encode(str)
}
function strOf(bytes) {
  return new TextDecoder().decode(bytes)
}
function toB64(bytes) {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0)
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '') + (i + 2 < bytes.length ? B64[n & 63] : '')
  }
  return out
}
function fromB64(s) {
  const idx = (ch) => B64.indexOf(ch)
  const out = []
  for (let i = 0; i < s.length; i += 4) {
    const a = idx(s[i]), b = idx(s[i + 1]), c = s[i + 2] === undefined ? -1 : idx(s[i + 2]), d = s[i + 3] === undefined ? -1 : idx(s[i + 3])
    if (a < 0 || b < 0 || (s[i + 2] !== undefined && c < 0) || (s[i + 3] !== undefined && d < 0)) return null
    const n = (a << 18) | (b << 12) | ((c < 0 ? 0 : c) << 6) | (d < 0 ? 0 : d)
    out.push((n >> 16) & 255)
    if (c >= 0) out.push((n >> 8) & 255)
    if (d >= 0) out.push(n & 255)
  }
  return Uint8Array.from(out)
}

export function encodeCode(state) {
  return 'BE1-' + toB64(bytesOf(serialize(state)))
}

export function decodeCode(code) {
  if (typeof code !== 'string') return null
  const s = code.trim().replace(/\s+/g, '')
  if (!/^BE1-[A-Za-z0-9\-_]+$/.test(s)) return null
  const bytes = fromB64(s.slice(4))
  if (!bytes) return null
  let str
  try { str = strOf(bytes) } catch { return null }
  return parse(str)
}
