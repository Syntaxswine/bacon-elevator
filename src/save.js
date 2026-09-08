// Save serialisation. Pure: tolerates garbage, migrates v0, and makes the BE1- share code.
import { initialState, SETTINGS_DEFAULTS } from './state.js'

export const SAVE_KEY = 'bacon-elevator.save.v1'

const PERSIST = ['v', 'created', 'salt', 'lunchbox', 'buildings', 'level', 'step', 'adaptive', 'pinnedStep', 'settings', 'facts', 'unlocks', 'equipped', 'history', 'ride', 'rulesSeen', 'step3Run', 'plaques']

export function serialize(state) {
  const out = {}
  for (const k of PERSIST) if (state[k] !== undefined) out[k] = state[k]
  out.v = 1
  return JSON.stringify(out)
}

function isObj(x) { return x !== null && typeof x === 'object' && !Array.isArray(x) }
const int = (x, d) => (Number.isInteger(x) ? x : d)
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
  s.lunchbox = Math.max(0, int(obj.lunchbox, 0))
  s.buildings = Math.max(0, int(obj.buildings, 0))
  s.level = oneOf(obj.level, ['corner', 'hotel', 'office', 'sky', 'megatall', 'custom'], 'corner')
  s.step = Math.max(1, Math.min(3, int(obj.step, 1)))
  s.adaptive = bool(obj.adaptive, true)
  s.pinnedStep = Math.max(1, Math.min(3, int(obj.pinnedStep, 1)))
  s.rulesSeen = bool(obj.rulesSeen, false)
  s.step3Run = Math.max(0, int(obj.step3Run, 0))
  s.plaques = strArr(obj.plaques)
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
  s.facts = { seen: strArr(f.seen), right: strArr(f.right), retry: Array.isArray(f.retry) ? f.retry.filter((r) => isObj(r) && typeof r.id === 'string' && Number.isInteger(r.at)) : [] }
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
    count: Math.max(0, int(h.count, 0)),
    answered: Math.max(0, int(h.answered, 0)),
    correct: Math.max(0, int(h.correct, 0)),
    falls: Math.max(0, int(h.falls, 0)),
    byKind: isObj(h.byKind) ? Object.fromEntries(Object.entries(h.byKind).filter(([, v]) => Array.isArray(v) && v.length === 2 && v.every(Number.isInteger)).map(([k, v]) => [k, v.slice()])) : {},
    skills: isObj(h.skills) ? Object.fromEntries(Object.entries(h.skills).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, v.map((x) => (x ? 1 : 0)).slice(-8)])) : {},
  }
  s.ride = migrateRide(obj.ride)
  s.phase = 'lobby'
  s.screen = 'lobby'
  return s
}

function migrateRide(r) {
  if (!isObj(r)) return null
  const p = isObj(r.problem) ? r.problem : null
  const problem = p && ['add', 'sub', 'mul', 'div', 'missAdd', 'missMul', 'up', 'down'].includes(p.kind) && Number.isInteger(p.a) && Number.isInteger(p.b) && Number.isInteger(p.answer) && typeof p.text === 'string' && typeof p.key === 'string'
    ? { kind: p.kind, a: p.a, b: p.b, ...(Number.isInteger(p.c) ? { c: p.c } : {}), answer: p.answer, text: p.text, key: p.key }
    : null
  const floor = Math.max(-1, Math.min(10, int(r.floor, 0)))
  let phase = oneOf(r.phase, ['floor', 'keypad', 'repair', 'trivia', 'fact', 'roof'], 'floor')
  if ((phase === 'keypad' || phase === 'repair') && !problem) phase = 'floor'
  if (phase === 'fact') phase = 'floor' // the card was read; a quit during the question re-asks it fresh
  if (phase === 'roof' && floor !== 10) phase = 'floor'
  const cleared = Array.isArray(r.cleared) ? [...new Set(r.cleared.filter((x) => Number.isInteger(x) && x >= 1 && x <= 9))].sort((x, y) => x - y) : []
  const target = Math.max(1, Math.min(10, int(r.target, floor + 1)))
  // A save taken mid-timeline: {name, to}; hydrate() plays it to its end before anything renders.
  const f = isObj(r.inFlight) ? r.inFlight : null
  const inFlight = f && ['ride', 'express', 'fall', 'descend'].includes(f.name) && Number.isInteger(f.to) && f.to >= -1 && f.to <= 10 ? { name: f.name, to: f.to } : null
  return {
    seed: int(r.seed, 1) >>> 0,
    floor,
    target: phase === 'roof' ? 10 : target,
    cleared,
    tray: Math.max(0, int(r.tray, 0)),
    banked: Math.max(0, int(r.banked, 0)),
    phase,
    problem,
    typed: typeof r.typed === 'string' && /^-?\d{0,4}$/.test(r.typed) ? r.typed : '',
    tries: Math.max(0, int(r.tries, 0)),
    streak: Math.max(0, int(r.streak, 0)),
    stepDowns: Math.max(0, int(r.stepDowns, 0)),
    comeback: Array.isArray(r.comeback) ? r.comeback.filter((x) => isObj(x) && isObj(x.problem) && Number.isInteger(x.due)) : [],
    passengersDone: Array.isArray(r.passengersDone) ? r.passengersDone.filter(Number.isInteger) : [],
    retrying: bool(r.retrying, false) && (floor === -1 || (inFlight !== null && inFlight.name === 'fall')),
    forfeit: bool(r.forfeit, false),
    typedWrong: typeof r.typedWrong === 'string' ? r.typedWrong : '',
    falls: Math.max(0, int(r.falls, 0)),
    draws: Math.max(0, int(r.draws, 0)),
    ctx: isObj(r.ctx) ? r.ctx : null,
    lastKind: oneOf(r.lastKind, ['elevator', 'math'], null),
    fallFloor: Math.max(0, int(r.fallFloor, 0)),
    inFlight,
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
