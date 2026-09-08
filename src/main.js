// Bacon Elevator — the DOM side. Dispatches from taps, plays effects and timelines off rAF.
import { VERSION } from './version.js'
import { mulberry32 } from './rng.js'
import { initialState, reduce, hydrate, currentLevel, STABLE } from './state.js'
import { serialize, parse, SAVE_KEY, decodeCode } from './save.js'
import * as storage from './storage.js'
import { loadFacts } from './trivia.js'
import { DURATIONS, scale, speedAt, label } from './elevator.js'
import { createPlayer } from './timeline.js'
import { signKeyLive } from './math.js'
import { explain } from './explain.js'
import { createShaft } from './render/shaft.js'
import { createPanel, createDisplay } from './render/panel.js'
import * as screens from './render/screens.js'
import { createAudio } from './audio.js'

const params = new URLSearchParams(location.search)
const DRIVE = params.get('drive') === '1'
// Per-tab, cleared when the tab closes: a cold open still starts in the lobby, as DESIGN wants.
const RESUME_KEY = 'bacon-elevator.resume-ride'
const SEED = params.has('seed') ? (parseInt(params.get('seed'), 10) >>> 0) : null
const DRIVE_SCALE = params.get('fast') === '1' ? 0.1 : 1
const app = document.getElementById('app')

// ---- reset (?reset=1) --------------------------------------------------------------------
// The service worker registers only after this settles, so a reset's unregister never races the fresh registration.
//
// AND THE DELETES ARE NOT ENOUGH ON THEIR OWN. Pages sends `cache-control: max-age=600`, and
// `unregister()` on a byte-identical sw.js is resurrected by the `register()` below, so no new
// worker installs and no `cache: 'reload'` precache runs. Measured against a real deploy: the reset
// deleted be-1.0.0 and the surviving worker refilled it from the browser's own HTTP cache within
// 266 ms — the child paid their whole lunchbox for the reset and stayed on the superseded build for
// another ten minutes. Re-fetching every precached path with `cache: 'reload'` refreshes the HTTP
// entries themselves, so whatever refills the cache is the deploy that is actually live.
// RESET_ASSETS must equal sw.js's ASSETS; test/version.test.js compares the two lists.
export const RESET_ASSETS = [
  './', './index.html', './404.html', './manifest.webmanifest', './favicon.ico',
  './css/app.css',
  './src/version.js', './src/main.js', './src/rng.js', './src/levels.js', './src/math.js', './src/explain.js',
  './src/elevator.js', './src/timeline.js', './src/trivia.js', './src/state.js', './src/save.js', './src/storage.js', './src/audio.js',
  './src/render/shaft.js', './src/render/panel.js', './src/render/screens.js',
  './data/trivia.json',
  './assets/icon.svg', './assets/icon-192.png', './assets/icon-512.png', './assets/apple-touch-icon.png', './assets/favicon-32.png',
  './assets/icon-maskable-192.png', './assets/icon-maskable-512.png',
]
let resetDone = Promise.resolve()
if (params.get('reset') === '1') {
  storage.removeItem(SAVE_KEY)
  const jobs = []
  if (globalThis.caches) jobs.push(caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k)))).catch(() => {}))
  if (navigator.serviceWorker) jobs.push(navigator.serviceWorker.getRegistrations().then((rs) => Promise.all(rs.map((r) => r.unregister()))).catch(() => {}))
  resetDone = Promise.all(jobs).then(() => Promise.all(RESET_ASSETS.map((u) => fetch(u, { cache: 'reload' }).catch(() => {})))).catch(() => {})
  params.delete('reset')
  const q = params.toString()
  try { history.replaceState(null, '', location.pathname + (q ? '?' + q : '')) } catch { /* ignore */ }
}

// ---- state ---------------------------------------------------------------------------------
let state = parse(storage.getItem(SAVE_KEY))
if (!state) {
  let salt = 0
  try { salt = crypto.getRandomValues(new Uint32Array(1))[0] } catch { salt = (Date.now() * 2654435761) >>> 0 }
  state = initialState(salt)
  state.created = Math.floor(Date.now() / 1000)
}
state.seedOverride = SEED
// THE WRITE COUNTER: how many times THIS record has been written, by anybody. save() refuses to
// overwrite a record whose counter has moved past ours — see save() below.
let writeCount = Number.isSafeInteger(state.writes) ? state.writes : 0
const audio = createAudio()
let rng = null
function rngFor(s) {
  if (s.ride) {
    if (!rng || rng.seed !== s.ride.seed) { rng = mulberry32(s.ride.seed); rng.skip(s.ride.draws || 0) }
    return rng
  }
  return mulberry32(s.salt)
}

const speedScale = () => (state.settings.speed === 'fast' ? 0.5 : 1)
const timescale = () => speedScale() * DRIVE_SCALE
const prefersReduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false } }
const reducedMotion = () => state.settings.motion === 'reduced' || (state.settings.motion === 'auto' && prefersReduced())

// ---- DOM skeleton ---------------------------------------------------------------------------
app.innerHTML = `
  <section class="screen lobby" data-name="lobby"></section>
  <section class="screen picker" data-name="picker"></section>
  <section class="screen rules" data-name="rules"></section>
  <section class="screen ride" data-name="ride">
    <div class="topbar">
      <button class="tb nav" data-nav="lobby" data-tap aria-label="Lobby">Lobby</button>
      <span class="chip" aria-label="level and step"><span class="lname" id="levelname"></span><span class="stepbar" id="stepbar" data-step="1" aria-label="step 1 of 3"><i></i><i></i><i></i></span></span>
      <span class="tb" aria-label="tray, this building"><svg class="bacon-icon" viewBox="0 0 64 32" aria-hidden="true"><use href="#bacon"/></svg><span class="count" id="tray">0</span></span>
      <span class="tb" aria-label="lunchbox, all time"><svg class="lunch-icon" viewBox="0 0 24 20" aria-hidden="true"><rect x="1.5" y="6" width="21" height="12.5" rx="2" fill="#4A7BAA" stroke="#35618A" stroke-width="2"/><rect x="7" y="2" width="10" height="5" rx="1.5" fill="#35618A"/><rect x="1.5" y="10" width="21" height="2" fill="#35618A"/></svg><span class="count" id="lunchbox">0</span></span>
      <button class="tb speaker" data-sound data-tap aria-pressed="false" aria-label="Sound off">♪</button>
    </div>
    <div class="shaft" id="shaft"><div class="hint" id="hint" hidden></div></div>
    <div class="right">
      <div class="display"><div id="question" aria-live="polite" class="text"></div><div id="message" aria-live="polite"></div></div>
      <div class="panel" id="panel" role="group" aria-label="Elevator panel"></div>
    </div>
    <div id="sheet"></div>
  </section>
  <section class="screen roof" data-name="roof"></section>
  <section class="screen factbook" data-name="factbook"></section>
  <section class="screen workshop" data-name="workshop"></section>
  <section class="screen grownups" data-name="grownups"></section>
`
const sections = Object.fromEntries([...app.querySelectorAll('.screen')].map((s) => [s.dataset.name, s]))
const shaftBox = document.getElementById('shaft')
const shaft = createShaft(shaftBox, { reduced: reducedMotion() })
const panel = createPanel(document.getElementById('panel'))
const display = createDisplay(document.getElementById('question'), document.getElementById('message'))
const hintBox = document.getElementById('hint')
const sheetBox = document.getElementById('sheet')
const carEl = document.getElementById('car')
const ui = { resetArmedAt: 0, gearAt: 0, codeMsg: '', resetMsg: '', transient: null, factVisible: false, factTimer: 0, prevPhase: null, lastMotion: '', storageFailed: false, adopted: '', inertTimer: 0, build: '' }

// ---- drive log (only under ?drive=1) ----------------------------------------------------
// events: timeline step names and the car's motion transitions, in the order they happened;
// actions: every dispatched action type. Both are read by tools/drive-scenarios.mjs.
const events = []
const actions = []
function noteMotion() {
  const m = carEl.getAttribute('data-motion')
  if (m === ui.lastMotion) return
  ui.lastMotion = m
  if (DRIVE) events.push('motion:' + m)
}

// ---- timeline player ---------------------------------------------------------------------
// The pure player (src/timeline.js) owns the clock arithmetic; this side feeds it performance.now()
// off requestAnimationFrame and keeps a setTimeout fallback so a hidden tab still finishes the ride.
let play = null
function cancelTimeline() {
  if (!play) return
  cancelAnimationFrame(play.raf); clearTimeout(play.timer)
  play = null
  shaft.end(); audio.stopMotor()
}
function startTimeline(effect) {
  cancelTimeline()
  const ts = timescale() * (effect.name === 'fall' && reducedMotion() ? 2000 / 3900 : 1)
  const steps = effect.steps.slice().sort((a, b) => a.t - b.t)
  const move = steps.find((s) => s.ev === 'move-start')
  const arrive = steps.find((s) => s.ev === 'arrive')
  const now = performance.now()
  play = {
    name: effect.name, player: createPlayer(steps, ts, now, effect.duration), raf: 0, timer: 0,
    from: state.car.floor, to: arrive ? arrive.floor : state.car.floor, moveStart: move ? move.t : null,
    msPerFloor: effect.name === 'ride' ? DURATIONS.floor : DURATIONS.express,
  }
  shaft.setReduced(reducedMotion())
  shaft.begin(effect.name, steps, effect.duration, state)
  noteMotion()
  ui.transient = null
  tick()
  if (play) play.timer = setTimeout(flushTimeline, Math.max(0, play.player.endMs - performance.now()) + 80)
}
function tick() {
  if (!play) return
  const now = performance.now()
  const el = play.player.elapsed(now)
  // THE SHAFT'S CLOCK ADVANCES BEFORE THE STEPS FIRE. `doors-closed` and `move-start` both
  // re-render the panel, and the panel asks shaft.doorsClosingNow(), which compares the LAST DRAWN
  // elapsed against the door step's end. Firing first meant that comparison read the previous
  // frame's clock and answered "still closing" on the very frame the doors finished, so the panel
  // re-armed the ◁▷ key and nothing re-rendered again until the phase changed: the one key an
  // elevator-loving child hammers stayed lit and dead for ~1.6 s of every 2.7 s ride, then greyed
  // itself out the moment it was pressed.
  shaft.mark(el)
  const { fired, done } = play.player.advance(now)
  for (const s of fired) fireStep(s)
  if (!play) return // a step's dispatch may have cancelled the timeline
  shaft.frame(el)
  if (play.moveStart !== null && el >= play.moveStart && play.from !== play.to) audio.motor(speedAt(play.from, play.to, el - play.moveStart, play.msPerFloor))
  if (done) finishTimeline()
  else play.raf = requestAnimationFrame(tick)
}
// The hidden-tab path: rAF is paused, the fallback timer fires, every pending step fires at once.
function flushTimeline() {
  if (!play) return
  shaft.mark(play.player.duration)
  const { fired } = play.player.flush()
  for (const s of fired) fireStep(s)
  finishTimeline()
}
function finishTimeline() {
  if (!play) return
  cancelAnimationFrame(play.raf); clearTimeout(play.timer)
  const { fired } = play.player.flush()
  for (const s of fired) fireStep(s)
  shaft.frame(play.player.duration)
  shaft.end(); audio.stopMotor()
  play = null
  ui.transient = null
  dispatch({ type: 'timeline-done' })
}
const STEP_SOUND = { 'doors-closing': 'doorHum', 'doors-opening': 'doorHum', ding: 'ding', ding2: 'ding2', 'fall-start': 'whoosh', impact: 'boing', bacon: 'bacon' }
function fireStep(step) {
  if (DRIVE) events.push(step.ev)
  shaft.event(step)
  noteMotion()
  if (STEP_SOUND[step.ev]) audio.play(STEP_SOUND[step.ev])
  if (step.ev === 'arrive') {
    const f = step.floor
    ui.transient = { html: f === 0 ? 'Ground floor' : f === 10 ? 'Roof' : `Floor ${label(f)}`, cls: 'text', msg: '' }
    display.render(state, ui.transient)
  } else if (step.ev === 'brake') {
    ui.transient = { html: 'Safety brake on.', cls: 'text small', msg: 'Nobody is hurt. Nothing is lost.' }
    display.render(state, ui.transient)
  } else if (step.ev === 'doors-closing' || step.ev === 'doors-closed' || step.ev === 'move-start') {
    renderPanel()
  }
}

// ---- dispatch and effects ---------------------------------------------------------------
// A TRANSIENT BELONGS TO THE PANEL IT WAS WRITTEN FOR, NOT TO ITS TIMER.
// The dead-floor-key line (`Press 1` / `Floor 9 is not the next stop.`) was cleared only by a
// 1400 ms setTimeout, and render() hands any standing transient straight to display.render, which
// returns before the `keypad` case. So tapping 9 at G — the move the dead-key handler exists for —
// and then the lit button left the keypad live for up to 1.35 s with NO sum on screen, no typed
// digits, and no `Try once more.`; with Second try off, GO in that window dropped the car for a sum
// that was never displayed. Worse, the stale line is an executable wrong instruction: the panel
// underneath has swapped to the digit pad, where `1` is an ANSWER key (r3-code-hostile-01).
function scopeOf(st) {
  const r = st.ride
  return `${st.phase}|${st.screen}|${r && r.problem ? r.problem.key : ''}|${r ? r.typed : ''}|${r ? r.tries : ''}`
}
function dispatch(action) {
  if (DRIVE) actions.push(action.type)
  const before = scopeOf(state)
  const r = reduce(state, action, rngFor(state))
  state = r.state
  // Mid-timeline transients (`arrive`, `brake`) are owned by fireStep and cleared by
  // start/finishTimeline, so the scope rule only polices the resting screens.
  if (!play && scopeOf(state) !== before) { clearTimeout(ui.inertTimer); ui.inertTimer = 0; ui.transient = null }
  for (const e of r.effects) {
    if (e.type === 'timeline') startTimeline(e)
    else if (e.type === 'sound') audio.play(e.name)
    else if (e.type === 'save') save()
    // screen effects are reflected by state.screen
  }
  render()
}
// TWO TABS OF THE GAME MUST NOT WIPE THE LUNCHBOX.
// save() used to write serialize(state) blindly, and it runs on every effect, on visibilitychange
// and on pagehide. A second tab opened from a bookmark and never touched still held the snapshot it
// booted with, so switching to it and away again wrote lunchbox 0 / buildings 0 over three
// buildings of play — total, silent, and needing no tap in the offending tab. Every save now
// carries a monotone `writes` counter: if the record on disk has moved past the one this tab last
// wrote, this tab is the stale one and it ADOPTS what is there instead of overwriting it.
function diskWrites() {
  const raw = storage.getItem(SAVE_KEY)
  if (raw === null) return null
  try { const o = JSON.parse(raw); return Number.isSafeInteger(o.writes) ? o.writes : 0 } catch { return null }
}
// The bacon this tab is holding, banked and unbanked. The two-tab counter exists to stop bacon
// being lost; this is the quantity it is protecting.
const bankOf = (st) => (st && Number.isSafeInteger(st.lunchbox) ? st.lunchbox : 0) + (st && st.ride && Number.isSafeInteger(st.ride.tray) ? st.ride.tray : 0)
function adoptDiskSave(reason, pre) {
  const incoming = pre || parse(storage.getItem(SAVE_KEY))
  if (!incoming) return false
  cancelTimeline(); rng = null
  writeCount = Number.isSafeInteger(incoming.writes) ? incoming.writes : 0
  state = { ...incoming, pool: state.pool, seedOverride: state.seedOverride }
  ui.transient = null
  ui.adopted = reason
  panel.invalidate()
  return true
}
function save() {
  const disk = diskWrites()
  // ADOPTING IN HERE THREW AWAY THE ACTION THAT ASKED FOR THE SAVE.
  // save() runs as an EFFECT of the dispatch the child's tap produced, so `adopt and return` meant
  // the reduced state — the press-floor, or a CORRECT GO — was discarded and replaced by the other
  // tab's snapshot, which parse() parks on the Lobby. Opening the game a second time is enough to
  // move the counter (each tab saves on its own visibilitychange), so a child who taps their Home
  // Screen icon while the game is already in a tab loses every following tap in both tabs
  // (r3-code-hostile-02). The counter's job is to stop BACON being lost, and it still does: a record
  // holding more bacon than this tab is adopted whatever the phase. Otherwise a tab that is mid-
  // building keeps the child's action and writes over an idle tab's snapshot — the same rule the
  // `storage` listener below already applies ("nothing may move under the child's finger mid-sum").
  if (disk !== null && disk > writeCount) {
    const incoming = parse(storage.getItem(SAVE_KEY))
    const atRest = state.phase === 'lobby' || state.screen === 'lobby'
    if (incoming && (atRest || bankOf(incoming) > bankOf(state))) { if (adoptDiskSave('other-tab', incoming)) render(); return }
  }
  writeCount = Math.max(writeCount, disk === null ? 0 : disk) + 1
  state.writes = writeCount
  const ok = storage.setItem(SAVE_KEY, serialize(state))
  // A refused write (Safari's Block All Cookies, a full quota, storage disabled) used to be
  // swallowed: the child played a whole session and the lunchbox was 0 on the next load, with
  // nothing on any screen to say so and the save code — the one thing that would have rescued it —
  // never pointed at. storage.js's in-memory fallback keeps the SESSION working; this says out loud
  // that it is only the session.
  if (!ok) ui.storageFailed = true
}

// ---- render ---------------------------------------------------------------------------------
function renderPanel() {
  // The panel's capability comes from the problem it is SHOWING, not from the step that drew it.
  const p = state.ride ? state.ride.problem : null
  panel.render(state, { negatives: !!p && signKeyLive(currentLevel(state), state.step, p), doorsClosing: !!shaft.doorsClosingNow() })
}
let lastHintKey = ''
let lastScreen = ''
function render() {
  app.dataset.screen = state.screen
  app.dataset.phase = state.phase
  document.documentElement.classList.toggle('big', !!state.settings.bigText)
  document.documentElement.classList.toggle('reduced', reducedMotion())
  audio.setVolume(state.settings.volume)
  audio.setChime(state.equipped.chime)
  for (const [name, sec] of Object.entries(sections)) {
    sec.classList.toggle('active', name === state.screen)
    if (name !== state.screen && name !== 'ride' && sec.firstChild) sec.innerHTML = '' // no stale markup (or duplicate ids) behind the live screen
  }
  const s = state.screen
  const notices = { storageFailed: ui.storageFailed, adopted: ui.adopted }
  if (s === 'lobby') sections.lobby.innerHTML = screens.lobby(state, notices)
  else if (s === 'picker') sections.picker.innerHTML = screens.picker(state)
  else if (s === 'rules') sections.rules.innerHTML = screens.rules(state)
  else if (s === 'roof') sections.roof.innerHTML = screens.roof(state)
  else if (s === 'factbook') sections.factbook.innerHTML = screens.factbook(state)
  else if (s === 'workshop') sections.workshop.innerHTML = screens.workshop(state)
  else if (s === 'grownups') sections.grownups.innerHTML = screens.grownups(state, { version: VERSION, build: ui.build, codeMsg: ui.codeMsg, resetMsg: ui.resetMsg, resetArmed: ui.resetArmedAt > 0, ...notices })
  // the ride screen is persistent: update in place
  const r = state.ride
  document.getElementById('tray').textContent = String(r ? r.tray : 0)
  document.getElementById('lunchbox').textContent = String(state.lunchbox)
  const lvl = currentLevel(state)
  document.getElementById('levelname').textContent = lvl.short || lvl.name
  const sb = document.getElementById('stepbar')
  sb.dataset.step = String(state.step); sb.setAttribute('aria-label', `step ${state.step} of 3`)
  for (const b of app.querySelectorAll('[data-sound]')) { b.setAttribute('aria-pressed', state.settings.sound ? 'true' : 'false'); b.setAttribute('aria-label', state.settings.sound ? 'Sound on' : 'Sound off') }
  shaft.setReduced(reducedMotion())
  // The shaft measures itself only once it is on screen: at boot the ride section is display:none (0 × 0).
  if (s === 'ride' && lastScreen !== 'ride') shaft.resize()
  lastScreen = s
  shaft.setState(state)
  noteMotion()
  renderPanel()
  // The ride's own top bar mirrors the reducer's phase guard: Lobby is refused while the car is
  // moving, falling or descending, so it must not look live for those 2.7–6.1 s. The speaker is
  // left alone — set-setting has no phase guard, so it genuinely works mid-ride.
  const busyNow = !STABLE.has(state.phase) && state.phase !== 'lobby'
  for (const b of sections.ride.querySelectorAll('.topbar [data-nav]')) {
    b.disabled = busyNow
    b.setAttribute('aria-disabled', busyNow ? 'true' : 'false')
  }
  display.render(state, ui.transient)
  // hint overlay
  const showHint = state.phase === 'keypad' && state.hint && r && r.problem
  hintBox.hidden = !showHint
  if (showHint) {
    // The drawing is sized to the box it actually gets, so the key carries the box.
    const bw = Math.max(0, hintBox.clientWidth - 16), bh = Math.max(0, hintBox.clientHeight - 16)
    const key = r.problem.key + '|' + Math.round(bw) + 'x' + Math.round(bh)
    if (key !== lastHintKey) { hintBox.innerHTML = hintHTML(r.problem, bw, bh); lastHintKey = key }
  } else lastHintKey = ''
  // The on-panel beat after a trivia choice: the buttons show the result and the display band
  // says so; the Fact sheet follows after a beat (never under 300 ms) and never auto-dismisses.
  const beat = state.phase === 'fact' && state.screen === 'ride'
  if (beat) {
    if (!ui.factVisible && !ui.factTimer) {
      if (ui.prevPhase === 'trivia') ui.factTimer = setTimeout(() => { ui.factTimer = 0; ui.factVisible = true; render() }, Math.max(300, 900 * timescale()))
      else ui.factVisible = true
    }
  } else {
    ui.factVisible = false
    if (ui.factTimer) { clearTimeout(ui.factTimer); ui.factTimer = 0 }
  }
  const sheet = beat && ui.factVisible ? screens.factSheet(state) : ''
  if (sheetBox.innerHTML !== sheet) sheetBox.innerHTML = sheet
  if (sheet && sheetBox.firstElementChild) sheetBox.firstElementChild.querySelector('.body').scrollTop = 0
  if (s !== 'ride') for (const sec of Object.values(sections)) if (sec.classList.contains('active')) { const p = sec.querySelector('.page, .body'); if (p && ui.scrollReset) p.scrollTop = 0 }
  ui.scrollReset = false
  ui.prevPhase = state.phase
  // A chip offered mid-ride appears at the next resting frame. render() only rewrites the
  // per-screen sections, never #app's own children, so an existing chip survives a re-render.
  showChipIfAtRest()
}

// ---- hint renderers ------------------------------------------------------------------------
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
// HINT IS THE ONE HELP THE CHILD CAN ASK FOR, so it may not be a smudge.
// Both SVG hints used a FIXED viewBox (320 x 110 and 320 x 120) inside a box whose aspect ratio the
// short-viewport tiers change completely: at 320 x 454 the card's content box is 282 x 42, so
// preserveAspectRatio scaled the whole drawing by 0.14 and the 0-10 tick labels rendered at 2 CSS
// px. The viewBox height is now derived from the box, so the drawing is always WIDTH-limited and
// fills what it is given; below the height where any drawing can read, the worked line takes over.
const HINT_MIN_H = 34
function hintHTML(p, boxW = 320, boxH = 110) {
  const big = Math.max(p.a, p.b, Math.abs(p.answer), p.c || 0)
  const worked = () => { const first = explain(p)[0]; return `<div class="worked">${esc(first ? first.text : '')}</div>` }
  if (boxH < HINT_MIN_H || boxW < 80) return worked()
  // 320 logical units wide; the height matches the box's aspect so `meet` scales by width.
  const H = Math.round(Math.min(140, Math.max(60, (320 * boxH) / Math.max(1, boxW))))
  if (['add', 'sub', 'up', 'down', 'missAdd'].includes(p.kind) && big <= 30 && p.answer >= 0) return numberLine(p, H)
  if (['mul', 'div', 'missMul'].includes(p.kind)) {
    const rows = p.kind === 'mul' ? p.a : p.kind === 'div' ? p.answer : p.answer
    const cols = p.b
    if (rows <= 12 && cols <= 12) return dotArray(rows, cols, p, H)
  }
  return worked()
}
function numberLine(p, H = 110) {
  const floors = p.kind === 'up' || p.kind === 'down'
  const c = Number.isInteger(p.c) ? p.c : null
  const hi = Math.max(10, Math.ceil(Math.max(p.a, c === null ? p.a + p.b : c, p.answer, p.kind === 'sub' || p.kind === 'down' ? p.a : 0) / 5) * 5)
  const W = 320, x0 = 16, x1 = W - 16
  // Everything below is measured DOWN from the baseline so the line, its labels and its hops keep
  // their proportions whatever height the card was given.
  const axis = H - 24, tickText = H - 6, labelY = Math.max(15, axis - 44), tickSize = 13, labelSize = H < 76 ? 17 : 20
  const X = (n) => x0 + ((x1 - x0) * n) / hi
  let start, end, lab
  if (p.kind === 'add' || p.kind === 'up') { start = p.a; end = p.answer; lab = `+ ${p.b}` }
  else if (p.kind === 'sub' || p.kind === 'down') { start = p.a; end = p.answer; lab = `− ${p.b}` }
  else { start = p.a; end = c; lab = '?' }
  const ticks = []
  const every = hi > 20 ? 5 : 1
  for (let n = 0; n <= hi; n += every) {
    const t = floors ? (n === 0 ? 'G' : n === 10 ? 'R' : n <= 10 ? String(n) : '') : String(n)
    ticks.push(`<line x1="${X(n)}" y1="${axis}" x2="${X(n)}" y2="${axis - (n % 5 === 0 ? 10 : 6)}" stroke="#6B6B6B" stroke-width="2"/><text x="${X(n)}" y="${tickText}" text-anchor="middle" font-size="${tickSize}" font-family="system-ui" fill="#2B2B2B">${t}</text>`)
  }
  const mid = (X(start) + X(end)) / 2
  const col = end >= start ? '#2F7A8C' : '#5B6B7A'
  const dir = end >= start ? 1 : -1
  // ONE HOP PER UNIT, so `+ 5` is five arcs a child can count instead of one arc labelled `+ 5`,
  // which only reads if you already know what + 5 means. The single long arc stays for missAdd
  // (the hop count is the thing being asked) and for b > 10, where the hops would not be countable.
  const unit = Math.abs(X(1) - X(0))
  const rise = Math.max(8, Math.min(30, axis - labelY - 8))
  const hopY = axis - 4
  const hops = []
  if (['add', 'sub', 'up', 'down'].includes(p.kind) && p.b >= 1 && p.b <= 10 && unit >= 12) {
    for (let i = 0; i < p.b; i++) {
      const n0 = start + dir * i, n1 = n0 + dir
      const w = Math.abs(X(n1) - X(n0))
      hops.push(`<path d="M${X(n0)} ${hopY} Q${(X(n0) + X(n1)) / 2} ${hopY - Math.min(rise, w * 1.6)} ${X(n1)} ${hopY}" fill="none" stroke="${col}" stroke-width="4" stroke-linecap="round"/>`)
    }
  }
  const arc = hops.length ? hops.join('') : `<path d="M${X(start)} ${hopY} Q${mid} ${hopY - rise} ${X(end)} ${hopY}" fill="none" stroke="${col}" stroke-width="4" stroke-linecap="round"/>`
  const head = `<path d="M${X(end)} ${hopY} l${-6 * dir} -8 M${X(end)} ${hopY} l${6 * dir} -8" fill="none" stroke="${end >= start ? '#2F7A8C' : '#5B6B7A'}" stroke-width="4" stroke-linecap="round"/>`
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" aria-label="number line from ${start} ${lab}"><line x1="${x0}" y1="${axis}" x2="${x1}" y2="${axis}" stroke="#6B6B6B" stroke-width="3"/>${ticks.join('')}${arc}${head}<circle cx="${X(start)}" cy="${axis}" r="6" fill="#E8B04A" stroke="#6B6B6B" stroke-width="2"/><text x="${mid}" y="${labelY}" text-anchor="middle" font-size="${labelSize}" font-weight="700" font-family="system-ui" fill="${end >= start ? '#2F7A8C' : '#5B6B7A'}">${esc(lab)}</text></svg>`
}
function dotArray(rows, cols, p, H = 120) {
  const W = 320
  const titleSize = H < 76 ? 15 : 17
  const top = titleSize + 6
  const cell = Math.min(26, Math.floor((W - 40) / cols), Math.floor((H - top - 6) / rows))
  const ox = (W - cols * cell) / 2, oy = top
  const dots = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) dots.push(`<circle cx="${ox + c * cell + cell / 2}" cy="${oy + r * cell + cell / 2}" r="${cell * 0.32}" fill="#7A4B8C"/>`)
  const title = p.kind === 'mul' ? `${p.a} rows of ${p.b}` : p.kind === 'div' ? `${p.a} in rows of ${p.b}` : `${p.c} in rows of ${p.b}`
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" aria-label="${esc(title)}"><text x="${W / 2}" y="${titleSize}" text-anchor="middle" font-size="${titleSize}" font-weight="700" font-family="system-ui" fill="#2B2B2B">${esc(title)}</text>${dots.join('')}</svg>`
}

// ---- input ---------------------------------------------------------------------------------
function parseValue(v) {
  if (v === 'true') return true
  if (v === 'false') return false
  if (/^-?\d+$/.test(v)) return parseInt(v, 10)
  return v
}
app.addEventListener('click', (e) => {
  const b = e.target.closest('[data-tap]')
  if (!b || b.disabled) return
  const d = b.dataset
  if (d.key !== undefined) {
    if (/^\d$/.test(d.key)) return dispatch({ type: 'digit', d: d.key })
    if (d.key === 'back') return dispatch({ type: 'backspace' })
    if (d.key === 'go') return dispatch({ type: 'go' })
    if (d.key === 'hint') return dispatch({ type: 'hint' })
    if (d.key === 'sign') return dispatch({ type: 'toggle-sign' })
    return
  }
  if (d.floor !== undefined) return dispatch({ type: 'press-floor', floor: d.floor === 'G' ? 0 : d.floor === 'R' ? 10 : parseInt(d.floor, 10) })
  if (d.door !== undefined) return dispatch(d.door === 'open' ? { type: 'openDoors', whileClosing: !!shaft.doorsClosingNow() } : { type: 'closeDoors' })
  if (d.bell !== undefined) return dispatch({ type: 'nav', screen: 'rules' })
  if (d.choice !== undefined) return dispatch({ type: 'choice', i: parseInt(d.choice, 10) })
  if (d.continue !== undefined) return dispatch({ type: 'card-continue' })
  if (d.next !== undefined) return dispatch({ type: 'next-building' })
  if (d.offer !== undefined) return dispatch({ type: 'offer', accept: d.offer === 'yes' })
  if (d.gear !== undefined) {
    // The gear carries data-nav="grownups" for the DOM contract, but keeps its two-tap guard (no long-press: iOS fires the callout).
    const now = Date.now()
    if (now - ui.gearAt < 3000) { ui.gearAt = 0; ui.scrollReset = true; return dispatch({ type: 'nav', screen: 'grownups' }) }
    ui.gearAt = now
    b.textContent = '⚙ Tap again'
    setTimeout(() => { if (b.isConnected) b.textContent = '⚙ Grown-ups' }, 3000)
    return
  }
  if (d.nav !== undefined) {
    ui.scrollReset = true
    if (d.nav === 'ride') return dispatch({ type: 'ride-start' })
    if (d.nav === 'lobby') return dispatch({ type: 'to-lobby' })
    return dispatch({ type: 'nav', screen: d.nav })
  }
  if (d.level !== undefined) return dispatch({ type: 'set-level', id: d.level })
  if (d.setting !== undefined) return dispatch({ type: 'set-setting', key: d.setting, value: parseValue(d.value) })
  if (d.customOp !== undefined) {
    const ops = state.settings.custom.ops.slice()
    const i = ops.indexOf(d.customOp)
    if (i >= 0) ops.splice(i, 1); else ops.push(d.customOp)
    return dispatch({ type: 'set-setting', key: 'custom.ops', value: ops })
  }
  if (d.equipSlot !== undefined) return dispatch({ type: 'equip', slot: d.equipSlot, part: d.equipPart })
  if (d.sound !== undefined) {
    const on = !state.settings.sound
    audio.enable(on) // inside the gesture
    if (on) audio.play('click')
    return dispatch({ type: 'set-setting', key: 'sound', value: on })
  }
  if (d.copy !== undefined) {
    const code = document.getElementById('savecode')?.textContent || ''
    const done = (ok) => { ui.codeMsg = ok ? 'Copied.' : 'Could not copy. Select the code and copy it by hand.'; render() }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(() => done(true), () => done(false))
    else done(false)
    return
  }
  if (d.paste !== undefined) {
    const apply = (text) => {
      const inc = decodeCode(text || '')
      if (!inc) { ui.codeMsg = 'That is not a Bacon Elevator code.'; render(); return }
      ui.codeMsg = 'Loaded.'
      dispatch({ type: 'import', state: inc })
    }
    if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(apply, () => { ui.codeMsg = 'Could not read the clipboard. Allow paste, then try again.'; render() })
    else { ui.codeMsg = 'This browser cannot paste here.'; render() }
    return
  }
  if (d.reset !== undefined) {
    const now = Date.now()
    if (ui.resetArmedAt && now - ui.resetArmedAt >= 5000 && now - ui.resetArmedAt <= 30000) {
      ui.resetArmedAt = 0; ui.resetMsg = 'Everything is back to the start.'
      cancelTimeline(); rng = null
      dispatch({ type: 'reset' })
      return
    }
    ui.resetArmedAt = now; ui.resetMsg = 'Wait five seconds, then tap again to reset.'
    setTimeout(() => { if (ui.resetArmedAt === now) { ui.resetMsg = 'Now tap again to reset.'; if (state.screen === 'grownups') render() } }, 5000)
    setTimeout(() => { if (ui.resetArmedAt === now) { ui.resetArmedAt = 0; ui.resetMsg = ''; if (state.screen === 'grownups') render() } }, 30000)
    render()
    return
  }
  if (d.update !== undefined) { applyUpdate(); return }
  if (d.updateDismiss !== undefined) { dismissUpdate(); return }
})
// A PAIRED KEYBOARD IS NOT A SECOND UI. Every control is a real button element with a focus ring, so
// Tab + Enter already plays the whole game; what was missing was the obvious one — typing the
// answer. Digits, Backspace and Enter map onto the same actions the keys dispatch, and only in the
// phases the reducer already accepts them in, so nothing new can be reached this way.
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  if (state.screen !== 'ride') return
  if (/^\d$/.test(e.key) && state.phase === 'keypad') { e.preventDefault(); return dispatch({ type: 'digit', d: e.key }) }
  if (e.key === 'Backspace' && state.phase === 'keypad') { e.preventDefault(); return dispatch({ type: 'backspace' }) }
  if (e.key === 'Enter' && state.phase === 'keypad') {
    // Enter is GO only when GO itself is live; an empty entry must not submit.
    const go = document.querySelector('#panel button[data-key="go"]')
    if (go && !go.disabled) { e.preventDefault(); dispatch({ type: 'go' }) }
    return
  }
  if (e.key === '-' && state.phase === 'keypad') { e.preventDefault(); return dispatch({ type: 'toggle-sign' }) }
}, { passive: false })

// A DISABLED KEY STILL ANSWERS THE PRESS. `disabled` swallows the event outright, so tapping 9 at
// floor G — the first thing an elevator-loving child does — produced nothing at all: no press
// state, no sound, no line. The panel keeps the reducer's guard (only the lit button is live) and
// the display band re-states which button IS lit, which is the answer to what the child just asked.
app.addEventListener('pointerdown', (e) => {
  if (state.phase !== 'floor' || !state.ride) return
  const hit = document.elementFromPoint(e.clientX, e.clientY)
  const key = hit && hit.closest ? hit.closest('button[data-floor]') : null
  if (!key || !key.disabled) return
  ui.transient = { html: `Press ${label(state.ride.target)}`, cls: 'text', msg: `Floor ${key.dataset.floor} is not the next stop.` }
  display.render(state, ui.transient)
  clearTimeout(ui.inertTimer)
  ui.inertTimer = setTimeout(() => { ui.inertTimer = 0; ui.transient = null; render() }, 1400)
}, { passive: true })

app.addEventListener('pointerdown', () => {
  if (state.settings.sound && !audio.created) audio.enable(true)
  audio.resume()
}, { passive: true })
document.addEventListener('visibilitychange', () => { if (document.hidden) { audio.suspend(); save() } })
// The other half of the two-tab guard: a foreign write is heard the moment it lands, so a tab that
// is doing nothing re-hydrates from it rather than sitting on a stale snapshot until the child
// happens to look at it. Only when this tab is idle — the reducer's own resting states, no timeline
// in flight — because nothing may move under the child's finger mid-sum.
window.addEventListener('storage', (e) => {
  if (e.key !== SAVE_KEY) return
  const disk = diskWrites()
  if (disk === null || disk <= writeCount) return
  if (play || !(state.phase === 'lobby' || state.screen === 'lobby')) { return }
  if (adoptDiskSave('other-tab')) render()
})
// The shaft re-measures whenever the viewport changes: a rotation, a resize, iOS Safari's toolbar
// growing or shrinking (visualViewport), or the shaft box itself changing size (ResizeObserver).
const onResize = () => { shaft.resize(); display.fit() }
window.addEventListener('resize', onResize)
window.addEventListener('orientationchange', () => setTimeout(onResize, 60))
if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize)
if (window.ResizeObserver) new ResizeObserver(onResize).observe(shaftBox)
// The save always holds enough to resume: a timeline in flight is recorded as ride.inFlight and
// settled by hydrate() on the next load, so saving mid-ride is safe.
window.addEventListener('pagehide', save)

// ---- service worker + update chip -----------------------------------------------------
// Only a chip TAP may reload this tab. The old gate reloaded on any controllerchange once a worker
// had ever been offered, and sw.js's skipWaiting made that fire on its own: the page navigated
// 3.1 s into a sum with no tap, and the child came back to the lobby. Nothing moves without the
// child's action — and the chip itself is held back while the car is in motion.
let waitingWorker = null
let pendingWorker = null // offered, but held until the car is at rest
let updateRequested = false // only a chip tap sets this; only this may reload
let chipForced = false // ?drive=1&chip=1, so the chip's placement is testable without a deploy
const CHIP_HELD_PHASES = new Set(['moving', 'falling', 'descending'])
let chipDismissed = false
function showChipIfAtRest() {
  if (!(pendingWorker || chipForced)) return
  if (chipDismissed) return
  if (CHIP_HELD_PHASES.has(state.phase)) return
  if (document.getElementById('update-chip')) return
  // In the game's own register (`Update ready — tap to reload` is a developer's sentence), and with
  // a way to put it away: the chip stays until it is tapped, so without a `Not now` it is a banner
  // a child cannot act on parked over the elevator for the rest of the session. Dismissing hides it
  // for this tab only; the waiting worker keeps waiting and the next load offers it again.
  const chip = document.createElement('div')
  chip.id = 'update-chip'; chip.className = 'chip-update'
  const take = document.createElement('button')
  take.className = 'chip-take'; take.setAttribute('data-tap', ''); take.setAttribute('data-update', '')
  take.textContent = 'A new lift is ready. Tap to load it.'
  take.setAttribute('aria-label', 'A new version is ready, tap to load it')
  const later = document.createElement('button')
  later.className = 'chip-later'; later.setAttribute('data-tap', ''); later.setAttribute('data-update-dismiss', '')
  later.textContent = '✕'
  later.setAttribute('aria-label', 'Not now')
  chip.append(take, later)
  app.appendChild(chip)
}
function dismissUpdate() {
  chipDismissed = true
  const chip = document.getElementById('update-chip'); if (chip) chip.remove()
}
function applyUpdate() {
  updateRequested = true
  // Come back to the sum, not to the lobby: save.js parks every load on the lobby screen, and the
  // ride is fully resumable through `ride-start`.
  try { sessionStorage.setItem(RESUME_KEY, '1') } catch { /* Safari private mode */ }
  if (waitingWorker) waitingWorker.postMessage({ type: 'skip-waiting' })
  const chip = document.getElementById('update-chip'); if (chip) chip.remove()
}
// WHICH BUILD IS THIS PHONE ACTUALLY RUNNING? `Version 1.0.0` was the only human-readable answer,
// and sw.js's own comment records that the identical string on two different builds is what made a
// stale install undiagnosable. The fix made the CACHE NAME content-derived (`be-1.0.0-239e82454a4f`)
// and left the one surface a parent can read un-fingerprinted (r3-deploy-pages-02). The name of the
// cache serving THIS tab is the honest answer, and reading it costs nothing: it cannot be stamped
// into src/version.js, because version.js is itself one of the files BUILD hashes.
if (globalThis.caches && caches.keys) {
  caches.keys().then((ks) => {
    const k = ks.filter((x) => x.startsWith('be-')).sort().pop()
    const stamp = k ? k.split('-').pop() : ''
    if (stamp && stamp !== ui.build) { ui.build = stamp; if (state.screen === 'grownups') render() }
  }).catch(() => { /* no cache storage (private mode, a blocked origin): the version line stands alone */ })
}
if ('serviceWorker' in navigator && params.get('nosw') !== '1') {
  window.addEventListener('load', () => {
    resetDone.then(() => navigator.serviceWorker.register('./sw.js')).then((reg) => {
      const offer = (w) => { waitingWorker = w; pendingWorker = w; showChipIfAtRest() }
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting)
      reg.addEventListener('updatefound', () => {
        const w = reg.installing
        if (!w) return
        w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w) })
      })
    }).catch((err) => { console.warn('service worker registration failed', err) })
    let reloading = false
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (updateRequested && !reloading) { reloading = true; location.reload() } })
  })
}

// ---- boot ---------------------------------------------------------------------------------
if (DRIVE) {
  window.__bacon = {
    state: () => state,
    version: VERSION,
    get timescale() { return timescale() },
    get durations() { return scale(DURATIONS, speedScale()) },
    audioCreated: () => audio.created,
    events, actions,
    inFlight: () => play !== null,
    // the reducer's own reopen window, so the drive can ask whether a LIT ◁▷ key could act
    doorsClosing: () => !!shaft.doorsClosingNow(),
  }
}
if (DRIVE && params.get('chip') === '1') chipForced = true
const factsLoading = fetch('./data/trivia.json').then((r) => r.json()).then((json) => loadFacts(json).facts)
  .catch((err) => { console.warn('trivia bank did not load; passengers stay home', err); return [] })
async function boot() {
  if (state.ride && state.ride.inFlight) {
    // A tab killed mid-ride: settle the timeline before anything renders. Arriving at a passenger
    // floor needs the fact pool, so wait for it (briefly) first.
    const facts = await Promise.race([factsLoading, new Promise((res) => setTimeout(() => res(null), 4000))])
    if (facts) state = reduce(state, { type: 'load-facts', facts }, rngFor(state)).state
    state = hydrate(state, rngFor(state))
    save()
  }
  render()
  shaft.resize()
  // After a chip tap the child comes back to the sum, not to the lobby. `ride-start` is a no-op
  // unless the phase is 'lobby', which is exactly what save.js leaves, so it cannot fire twice.
  let resumeRide = false
  try { resumeRide = sessionStorage.getItem(RESUME_KEY) === '1'; sessionStorage.removeItem(RESUME_KEY) } catch { /* private mode */ }
  if (resumeRide && state.ride) dispatch({ type: 'ride-start' })
  factsLoading.then((facts) => dispatch({ type: 'load-facts', facts }))
}
boot()
