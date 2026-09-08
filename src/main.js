// Bacon Elevator — the DOM side. Dispatches from taps, plays effects and timelines off rAF.
import { VERSION } from './version.js'
import { mulberry32 } from './rng.js'
import { initialState, reduce, hydrate, currentLevel } from './state.js'
import { serialize, parse, SAVE_KEY, decodeCode } from './save.js'
import * as storage from './storage.js'
import { loadFacts } from './trivia.js'
import { DURATIONS, scale, speedAt, label } from './elevator.js'
import { createPlayer } from './timeline.js'
import { allowsNegatives } from './math.js'
import { explain } from './explain.js'
import { createShaft } from './render/shaft.js'
import { createPanel, createDisplay } from './render/panel.js'
import * as screens from './render/screens.js'
import { createAudio } from './audio.js'

const params = new URLSearchParams(location.search)
const DRIVE = params.get('drive') === '1'
const SEED = params.has('seed') ? (parseInt(params.get('seed'), 10) >>> 0) : null
const DRIVE_SCALE = params.get('fast') === '1' ? 0.1 : 1
const app = document.getElementById('app')

// ---- reset (?reset=1) --------------------------------------------------------------------
// The service worker registers only after this settles, so a reset's unregister never races the fresh registration.
let resetDone = Promise.resolve()
if (params.get('reset') === '1') {
  storage.removeItem(SAVE_KEY)
  const jobs = []
  if (globalThis.caches) jobs.push(caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k)))).catch(() => {}))
  if (navigator.serviceWorker) jobs.push(navigator.serviceWorker.getRegistrations().then((rs) => Promise.all(rs.map((r) => r.unregister()))).catch(() => {}))
  resetDone = Promise.all(jobs)
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
const ui = { resetArmedAt: 0, gearAt: 0, codeMsg: '', resetMsg: '', transient: null, factVisible: false, factTimer: 0, prevPhase: null, lastMotion: '' }

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
  const { fired, done } = play.player.advance(now)
  for (const s of fired) fireStep(s)
  if (!play) return // a step's dispatch may have cancelled the timeline
  const el = play.player.elapsed(now)
  shaft.frame(el)
  if (play.moveStart !== null && el >= play.moveStart && play.from !== play.to) audio.motor(speedAt(play.from, play.to, el - play.moveStart, play.msPerFloor))
  if (done) finishTimeline()
  else play.raf = requestAnimationFrame(tick)
}
// The hidden-tab path: rAF is paused, the fallback timer fires, every pending step fires at once.
function flushTimeline() {
  if (!play) return
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
function dispatch(action) {
  if (DRIVE) actions.push(action.type)
  const r = reduce(state, action, rngFor(state))
  state = r.state
  for (const e of r.effects) {
    if (e.type === 'timeline') startTimeline(e)
    else if (e.type === 'sound') audio.play(e.name)
    else if (e.type === 'save') save()
    // screen effects are reflected by state.screen
  }
  render()
}
function save() { storage.setItem(SAVE_KEY, serialize(state)) }

// ---- render ---------------------------------------------------------------------------------
function renderPanel() {
  panel.render(state, { negatives: state.ride && state.ride.problem ? allowsNegatives(currentLevel(state), state.step) : false, doorsClosing: !!shaft.doorsClosingNow() })
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
  if (s === 'lobby') sections.lobby.innerHTML = screens.lobby(state)
  else if (s === 'picker') sections.picker.innerHTML = screens.picker(state)
  else if (s === 'rules') sections.rules.innerHTML = screens.rules(state)
  else if (s === 'roof') sections.roof.innerHTML = screens.roof(state)
  else if (s === 'factbook') sections.factbook.innerHTML = screens.factbook(state)
  else if (s === 'workshop') sections.workshop.innerHTML = screens.workshop(state)
  else if (s === 'grownups') sections.grownups.innerHTML = screens.grownups(state, { version: VERSION, codeMsg: ui.codeMsg, resetMsg: ui.resetMsg, resetArmed: ui.resetArmedAt > 0 })
  // the ride screen is persistent: update in place
  const r = state.ride
  document.getElementById('tray').textContent = String(r ? r.tray : 0)
  document.getElementById('lunchbox').textContent = String(state.lunchbox)
  const lvl = currentLevel(state)
  document.getElementById('levelname').textContent = lvl.name
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
  display.render(state, ui.transient)
  // hint overlay
  const showHint = state.phase === 'keypad' && state.hint && r && r.problem
  hintBox.hidden = !showHint
  if (showHint) {
    const key = r.problem.key + '|' + shaftBox.clientWidth
    if (key !== lastHintKey) { hintBox.innerHTML = hintHTML(r.problem); lastHintKey = key }
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
}

// ---- hint renderers ------------------------------------------------------------------------
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
function hintHTML(p) {
  const big = Math.max(p.a, p.b, Math.abs(p.answer), p.c || 0)
  if (['add', 'sub', 'up', 'down', 'missAdd'].includes(p.kind) && big <= 30 && p.answer >= 0) return numberLine(p)
  if (['mul', 'div', 'missMul'].includes(p.kind)) {
    const rows = p.kind === 'mul' ? p.a : p.kind === 'div' ? p.answer : p.answer
    const cols = p.b
    if (rows <= 12 && cols <= 12) return dotArray(rows, cols, p)
  }
  const first = explain(p)[0]
  return `<div class="worked">${esc(first ? first.text : '')}</div>`
}
function numberLine(p) {
  const floors = p.kind === 'up' || p.kind === 'down'
  const c = Number.isInteger(p.c) ? p.c : null
  const hi = Math.max(10, Math.ceil(Math.max(p.a, c === null ? p.a + p.b : c, p.answer, p.kind === 'sub' || p.kind === 'down' ? p.a : 0) / 5) * 5)
  const W = 320, H = 110, x0 = 16, x1 = W - 16
  const X = (n) => x0 + ((x1 - x0) * n) / hi
  let start, end, lab
  if (p.kind === 'add' || p.kind === 'up') { start = p.a; end = p.answer; lab = `+ ${p.b}` }
  else if (p.kind === 'sub' || p.kind === 'down') { start = p.a; end = p.answer; lab = `− ${p.b}` }
  else { start = p.a; end = c; lab = '?' }
  const ticks = []
  const every = hi > 20 ? 5 : 1
  for (let n = 0; n <= hi; n += every) {
    const t = floors ? (n === 0 ? 'G' : n === 10 ? 'R' : n <= 10 ? String(n) : '') : String(n)
    ticks.push(`<line x1="${X(n)}" y1="66" x2="${X(n)}" y2="${n % 5 === 0 ? 56 : 60}" stroke="#6B6B6B" stroke-width="2"/><text x="${X(n)}" y="84" text-anchor="middle" font-size="12" font-family="system-ui" fill="#2B2B2B">${t}</text>`)
  }
  const mid = (X(start) + X(end)) / 2
  const arc = `<path d="M${X(start)} 62 Q${mid} 10 ${X(end)} 62" fill="none" stroke="${end >= start ? '#2F7A8C' : '#5B6B7A'}" stroke-width="4" stroke-linecap="round"/>`
  const arrowY = 62
  const dir = end >= start ? 1 : -1
  const head = `<path d="M${X(end)} ${arrowY} l${-6 * dir} -8 M${X(end)} ${arrowY} l${6 * dir} -8" fill="none" stroke="${end >= start ? '#2F7A8C' : '#5B6B7A'}" stroke-width="4" stroke-linecap="round"/>`
  return `<svg viewBox="0 0 ${W} ${H}" aria-label="number line from ${start} ${lab}"><line x1="${x0}" y1="66" x2="${x1}" y2="66" stroke="#6B6B6B" stroke-width="3"/>${ticks.join('')}${arc}${head}<circle cx="${X(start)}" cy="66" r="6" fill="#E8B04A" stroke="#6B6B6B" stroke-width="2"/><text x="${mid}" y="30" text-anchor="middle" font-size="20" font-weight="700" font-family="system-ui" fill="${end >= start ? '#2F7A8C' : '#5B6B7A'}">${esc(lab)}</text></svg>`
}
function dotArray(rows, cols, p) {
  const W = 320, H = 120
  const cell = Math.min(22, Math.floor((W - 40) / cols), Math.floor((H - 30) / rows))
  const ox = (W - cols * cell) / 2, oy = 22
  const dots = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) dots.push(`<circle cx="${ox + c * cell + cell / 2}" cy="${oy + r * cell + cell / 2}" r="${cell * 0.32}" fill="#7A4B8C"/>`)
  const title = p.kind === 'mul' ? `${p.a} rows of ${p.b}` : p.kind === 'div' ? `${p.a} in rows of ${p.b}` : `${p.c} in rows of ${p.b}`
  return `<svg viewBox="0 0 ${W} ${H}" aria-label="${esc(title)}"><text x="${W / 2}" y="14" text-anchor="middle" font-size="14" font-weight="700" font-family="system-ui" fill="#2B2B2B">${esc(title)}</text>${dots.join('')}</svg>`
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
})
app.addEventListener('pointerdown', () => {
  if (state.settings.sound && !audio.created) audio.enable(true)
  audio.resume()
}, { passive: true })
document.addEventListener('visibilitychange', () => { if (document.hidden) { audio.suspend(); save() } })
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
let waitingWorker = null
function applyUpdate() {
  if (waitingWorker) waitingWorker.postMessage({ type: 'skip-waiting' })
  const chip = document.getElementById('update-chip'); if (chip) chip.remove()
}
if ('serviceWorker' in navigator && params.get('nosw') !== '1') {
  window.addEventListener('load', () => {
    resetDone.then(() => navigator.serviceWorker.register('./sw.js')).then((reg) => {
      const offer = (w) => {
        waitingWorker = w
        if (document.getElementById('update-chip')) return
        const chip = document.createElement('button')
        chip.id = 'update-chip'; chip.className = 'chip-update'; chip.setAttribute('data-tap', ''); chip.setAttribute('data-update', '')
        chip.textContent = 'Update ready — tap to reload'
        app.appendChild(chip)
      }
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting)
      reg.addEventListener('updatefound', () => {
        const w = reg.installing
        if (!w) return
        w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w) })
      })
    }).catch((err) => { console.warn('service worker registration failed', err) })
    let reloading = false
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (waitingWorker && !reloading) { reloading = true; location.reload() } })
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
  }
}
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
  factsLoading.then((facts) => dispatch({ type: 'load-facts', facts }))
}
boot()
