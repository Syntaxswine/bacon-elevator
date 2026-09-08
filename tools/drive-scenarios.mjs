// Scenarios for tools/phone-drive.mjs. Each scenario gets a ctx:
//   ctx.page   puppeteer Page at a phone viewport (touch enabled)
//   ctx.goto(hash?)   load the game (waits for load + one animation frame)
//   ctx.shot(name)    screenshot to shots/ when --shots is on
//   ctx.errors        console/page/network errors collected so far (any → FAIL unless allowErrors)
//   ctx.phone / ctx.key   the phone profile
// Return a short string for the report, or throw to fail.
//
// Every scenario plays the game through the DOM contract in docs/DESIGN.md §12: real taps on
// the real keys, never a dispatch. Answers are computed in Node with the same solve() the game uses.
// The URL is ?drive=1&seed=7&fast=1 (timescale 0.1); ?reset=1 clears the previous scenario's save.

import { solve } from '../src/math.js'
import { label } from '../src/elevator.js'

const Q = '?drive=1&seed=7&fast=1'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

// A slim, serialisable view of the live state (the pool is 67 facts; leave it behind).
const slim = (page) => page.evaluate(() => {
  const s = window.__bacon.state()
  const r = s.ride
  return {
    screen: s.screen, phase: s.phase, lunchbox: s.lunchbox, step: s.step, settings: s.settings, carFloor: s.car.floor, carDoors: s.car.doors,
    ride: r ? { floor: r.floor, target: r.target, tray: r.tray, cleared: r.cleared, typed: r.typed, problem: r.problem, tries: r.tries, retrying: r.retrying } : null,
    trivia: s.trivia ? { answer: s.trivia.answer, chosen: s.trivia.chosen, result: s.trivia.result, choices: s.trivia.choices } : null,
    roof: s.roof ? { gained: s.roof.gained, offer: s.roof.offer } : null,
    message: s.message, pool: s.pool.length,
  }
})

async function waitFor(page, fn, what, timeout = 8000) {
  try { await page.waitForFunction(fn, { timeout, polling: 30 }) } catch (e) { const s = await slim(page).catch(() => null); throw new Error(`timed out waiting for ${what}; state=${JSON.stringify(s && { screen: s.screen, phase: s.phase, ride: s.ride && { floor: s.ride.floor, target: s.ride.target } })}`) }
}
async function waitPhaseIn(page, phases, timeout = 8000) {
  await page.waitForFunction((ps) => ps.includes(window.__bacon.state().phase), { timeout, polling: 30 }, phases).catch(async () => { const s = await slim(page); throw new Error(`timed out waiting for phase ${phases.join('|')}; got ${s.phase} (screen ${s.screen})`) })
}
async function waitScreen(page, screen, timeout = 8000) {
  await page.waitForFunction((sc) => document.getElementById('app').dataset.screen === sc, { timeout, polling: 30 }, screen).catch(async () => { const s = await slim(page); throw new Error(`timed out waiting for screen ${screen}; got ${s.screen}`) })
}
// Tap the first VISIBLE match (a selector may also match markup on a hidden screen).
async function tap(page, sel) {
  const t0 = Date.now()
  let handle = null
  while (!handle && Date.now() - t0 < 5000) {
    for (const h of await page.$$(sel)) {
      const vis = await h.evaluate((el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && el.closest('.screen') && el.closest('.screen').classList.contains('active') })
      if (vis) { handle = h; break }
    }
    if (!handle) await wait(40)
  }
  if (!handle) throw new Error('no visible ' + sel)
  if (await handle.evaluate((b) => b.disabled)) throw new Error(sel + ' is disabled')
  await handle.tap()
}

// From `floor`: press the lit floor button and return the problem it asks (nothing typed).
async function press(page) {
  const s = await slim(page)
  expect(s.phase === 'floor', 'press: not in floor mode but ' + s.phase)
  await tap(page, `button[data-floor="${label(s.ride.target)}"]`)
  await waitPhaseIn(page, ['keypad'])
  return (await slim(page)).ride.problem
}
const text = (page, sel) => page.$eval(sel, (e) => e.textContent.trim())
const attr = (page, sel, name) => page.$eval(sel, (e, n) => e.getAttribute(n), name)
const num = async (page, sel) => { const t = await text(page, sel); if (!/^\d+$/.test(t)) throw new Error(`${sel} is not an integer: "${t}"`); return parseInt(t, 10) }
function expect(cond, msg) { if (!cond) throw new Error(msg) }
// The drive log: window.__bacon.events holds timeline step names and motion transitions in order.
const evLen = (page) => page.evaluate(() => window.__bacon.events.length)
const evSince = (page, n) => page.evaluate((n) => window.__bacon.events.slice(n), n)
const count = (evs, ev) => evs.filter((e) => e === ev).length
// true when `seq` appears in `evs` as a subsequence (other events may sit between)
const inOrder = (evs, seq) => { let i = 0; for (const e of evs) if (i < seq.length && e === seq[i]) i++; return i === seq.length }
const inFlight = (page) => page.evaluate(() => window.__bacon.inFlight())
const stripShown = (page) => page.$eval('#car .strip', (e) => e.getAttribute('visibility') === 'visible')

async function load(ctx, extra = '&reset=1') {
  await ctx.goto(Q + extra)
  await waitFor(ctx.page, () => window.__bacon && window.__bacon.state().pool.length > 0, 'the fact pool')
  expect(await attr(ctx.page, '#app', 'data-screen') === 'lobby', 'boot screen is not the lobby')
}

async function startRide(page) {
  await tap(page, '[data-nav="ride"]')
  await waitFor(page, () => ['rules', 'ride'].includes(document.getElementById('app').dataset.screen), 'rules or ride')
  if ((await attr(page, '#app', 'data-screen')) === 'rules') await tap(page, '.rules [data-continue]')
  await waitScreen(page, 'ride')
  await waitPhaseIn(page, ['floor', 'keypad', 'trivia', 'repair'])
}

// From `floor`: press the lit button. From `keypad`: type the value and GO. Returns the problem.
async function enter(page, value) {
  let s = await slim(page)
  if (s.phase === 'floor') {
    await tap(page, `button[data-floor="${label(s.ride.target)}"]`)
    await waitPhaseIn(page, ['keypad'])
    s = await slim(page)
  }
  expect(s.phase === 'keypad', 'not at the keypad: ' + s.phase)
  const p = s.ride.problem
  expect(solve(p) === p.answer, `solve() disagrees with the problem: ${JSON.stringify(p)}`)
  const v = value === undefined ? p.answer : value
  for (const ch of String(Math.abs(v))) await tap(page, `button[data-key="${ch}"]`)
  if (v < 0) await tap(page, 'button[data-key="sign"]')
  const typed = await page.evaluate(() => window.__bacon.state().ride.typed)
  expect(typed === (v < 0 ? '-' : '') + String(Math.abs(v)), `typed "${typed}" for ${v}`)
  await tap(page, 'button[data-key="go"]')
  return p
}

// Answer correctly and wait for the car to arrive (floor, trivia or roof).
async function rideOne(page) {
  const before = await slim(page)
  const p = await enter(page)
  await waitPhaseIn(page, ['moving', 'floor', 'trivia', 'roof'])
  await waitPhaseIn(page, ['floor', 'trivia', 'roof'])
  const after = await slim(page)
  expect(after.ride.floor === before.ride.target, `expected floor ${before.ride.target}, got ${after.ride.floor}`)
  expect(after.carFloor === after.ride.floor, 'car and ride disagree')
  expect((await attr(page, '#indicator', 'data-floor')) === label(after.ride.floor), 'indicator lags the car')
  expect((await attr(page, '#car', 'data-motion')) === 'idle', 'car not idle after arrival')
  expect((await attr(page, '#doors', 'data-state')) === 'open', 'doors not open after arrival')
  return { before, after, problem: p }
}

async function answerTrivia(page, right) {
  const s = await slim(page)
  expect(s.phase === 'trivia', 'not at a passenger')
  const i = right ? s.trivia.answer : (s.trivia.answer + 1) % 3
  await tap(page, `button[data-choice="${i}"]`)
  await waitPhaseIn(page, ['fact'])
  await tap(page, '#sheet [data-continue]')
  await waitPhaseIn(page, ['floor', 'roof'])
}

// Ride to a floor (handling passengers on the way with right answers).
async function rideTo(page, floor) {
  for (let guard = 0; guard < 40; guard++) {
    const s = await slim(page)
    if (s.ride.floor >= floor && s.phase === 'floor') return
    if (s.phase === 'trivia') { if (s.ride.floor >= floor) return; await answerTrivia(page, true); continue }
    if (s.phase === 'floor' || s.phase === 'keypad') { await rideOne(page); continue }
    throw new Error('rideTo stuck at ' + s.phase)
  }
  throw new Error('rideTo never arrived')
}

// ---- layout instrument ------------------------------------------------------------------
async function checkLayout(page, name, opts = {}) {
  const r = await page.evaluate((opts) => {
    const out = { problems: [] }
    const app = document.getElementById('app')
    if (document.documentElement.scrollWidth > window.innerWidth + 1) out.problems.push(`horizontal overflow: ${document.documentElement.scrollWidth} > ${window.innerWidth}`)
    if (app.scrollWidth > app.clientWidth + 1) out.problems.push('#app scrolls horizontally')
    if (app.clientHeight !== window.innerHeight) out.problems.push(`#app height ${app.clientHeight} !== innerHeight ${window.innerHeight}`)
    const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.bottom > 0 && r.top < window.innerHeight }
    for (const el of app.querySelectorAll('[data-tap]')) {
      if (!vis(el)) continue
      const r = el.getBoundingClientRect()
      if (r.width < 48 || r.height < 48) out.problems.push(`tap target under 48 px: ${el.outerHTML.slice(0, 60)} ${Math.round(r.width)}×${Math.round(r.height)}`)
      const scrolls = el.closest('.page, .sheet .body')
      if (r.left < -1 || r.right > window.innerWidth + 1 || (!scrolls && r.bottom > window.innerHeight + 1)) out.problems.push(`tap target outside the viewport: ${el.outerHTML.slice(0, 60)}`)
    }
    // contrast ≥ 4.5:1 (3:1 for large text) on every visible enabled text element
    const lum = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return null; const [r, g, b, a] = m[1].split(',').map(Number); if (a === 0) return null; const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return { L: 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b), a: a === undefined ? 1 : a } }
    const bgOf = (el) => { let e = el; while (e && e !== document.documentElement) { const l = lum(getComputedStyle(e).backgroundColor); if (l && l.a >= 0.9) return l.L; e = e.parentElement }; return lum(getComputedStyle(document.body).backgroundColor)?.L ?? 1 }
    const hasText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    const sel = 'button:not(:disabled), #question, #message, .page p, .page h1, .page h2, .tq, .card .big, .card .small, .card .worked, .card .clause, .sheet .body p, .setting .label, .tb, .chip, .face, .gain, .total, .val, .code'
    for (const el of app.querySelectorAll(sel)) {
      if (!vis(el) || !hasText(el)) continue
      if (el.closest('button:disabled')) continue
      const cs = getComputedStyle(el)
      const fg = lum(cs.color); if (!fg) continue
      const bg = bgOf(el)
      const ratio = (Math.max(fg.L, bg) + 0.05) / (Math.min(fg.L, bg) + 0.05)
      const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight, 10) >= 700
      const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5
      if (ratio < need) out.problems.push(`contrast ${ratio.toFixed(2)} < ${need}: "${el.textContent.trim().slice(0, 30)}" ${cs.color} on L=${bg.toFixed(3)}`)
      if (size < 16 && el.matches('button')) out.problems.push(`focusable text under 16 px: ${el.textContent.trim().slice(0, 30)}`)
    }
    if (opts.ride) {
      const sh = document.getElementById('shaft').getBoundingClientRect()
      out.shaft = Math.round(sh.height)
      if (sh.height < 200) out.problems.push(`shaft ${Math.round(sh.height)} px < 200`)
      const panel = document.getElementById('panel').getBoundingClientRect()
      if (panel.bottom > window.innerHeight + 1) out.problems.push('panel below the viewport')
    }
    if (opts.go) {
      const go = document.querySelector('button[data-key="go"]')
      if (!go) out.problems.push('no GO key')
      else {
        const g = go.getBoundingClientRect(), p = document.getElementById('panel').getBoundingClientRect()
        if (Math.abs(g.right - p.right) > 12 || Math.abs(g.bottom - p.bottom) > 12) out.problems.push(`GO is not bottom-right: go ${Math.round(g.right)},${Math.round(g.bottom)} panel ${Math.round(p.right)},${Math.round(p.bottom)}`)
        const key7 = document.querySelector('button[data-key="7"]').getBoundingClientRect()
        if (g.width < key7.width * 1.8) out.problems.push('GO is not two cells wide')
      }
    }
    // a sheet that must be readable without scrolling (the Rules card at 360 × 640)
    if (opts.noScroll) {
      const el = document.querySelector(opts.noScroll)
      if (!el) out.problems.push('no ' + opts.noScroll)
      else if (el.scrollHeight > el.clientHeight + 1) out.problems.push(`${opts.noScroll} needs scrolling: ${el.scrollHeight} > ${el.clientHeight}`)
    }
    if (opts.texts) for (const t of opts.texts) if (!app.textContent.includes(t)) out.problems.push(`text missing: ${t}`)
    // the Repair card: nothing clipped, every line inside the card box
    if (opts.card) {
      const card = document.querySelector('.card')
      if (!card) out.problems.push('no repair card')
      else {
        if (card.scrollHeight > card.clientHeight + 1) out.problems.push(`repair card text overflows its box: ${card.scrollHeight} > ${card.clientHeight}`)
        const cr = card.getBoundingClientRect()
        for (const el of card.querySelectorAll('.big, .small, .worked, .clause')) {
          const r = el.getBoundingClientRect()
          if (r.top < cr.top - 1 || r.bottom > cr.bottom + 1 || r.left < cr.left - 1 || r.right > cr.right + 1) out.problems.push(`repair card clips .${el.className}: ${el.textContent.slice(0, 40)}`)
          if (el.scrollWidth > el.clientWidth + 1) out.problems.push(`repair card line wider than its box: ${el.textContent.slice(0, 40)}`)
        }
        out.card = { h: Math.round(cr.height), worked: card.querySelector('.worked').textContent }
      }
    }
    // the roof: the six drifting strips stay inside the picnic band, above the milestone text and the buttons
    if (opts.roof) {
      const drift = document.querySelector('.roof .drift'), wrap = document.querySelector('.roof .picnic-wrap'), gain = document.querySelector('.roof .gain')
      if (!drift || !wrap || !gain) out.problems.push('roof drift, picnic band or milestone text missing')
      else {
        const d = drift.getBoundingClientRect(), w = wrap.getBoundingClientRect(), g = gain.getBoundingClientRect()
        if (d.top < w.top - 1 || d.bottom > w.bottom + 1 || d.left < w.left - 1 || d.right > w.right + 1) out.problems.push('the drift is not confined to the picnic band')
        if (d.bottom > g.top + 1) out.problems.push('the drift band reaches the milestone text')
        if (getComputedStyle(drift).overflow !== 'hidden') out.problems.push('the drift band must clip its strips')
        const n = drift.querySelectorAll('svg').length
        if (n !== 6) out.problems.push(`${n} drifting strips, expected 6`)
        for (const svg of drift.querySelectorAll('svg')) { const r = svg.getBoundingClientRect(); if (r.bottom > w.bottom + 1 || r.left < w.left - 1 || r.right > w.right + 1) out.problems.push('a drifting strip starts outside the band') }
      }
    }
    return out
  }, opts)
  if (r.problems.length) throw new Error(`[${name}] ` + r.problems.slice(0, 4).join(' | '))
  return r
}

// ---- scenarios ------------------------------------------------------------------------------
export const scenarios = [
  {
    name: 'smoke',
    async run(ctx) {
      const { page, shot } = ctx
      await load(ctx)
      const title = await page.title()
      expect(title === 'Bacon Elevator', 'title: ' + title)
      const meta = await page.$eval('meta[name="viewport"]', (m) => m.content)
      expect(/width=device-width/.test(meta) && /viewport-fit=cover/.test(meta) && !/maximum-scale/.test(meta), 'viewport meta: ' + meta)
      expect(await page.$('input, textarea, select') === null, 'a native input would summon the keyboard')
      const man = await page.$eval('link[rel="manifest"]', (l) => l.getAttribute('href'))
      expect(man === './manifest.webmanifest', 'manifest href ' + man)
      expect(await page.$('symbol#bacon') !== null, 'no #bacon symbol')
      // registration is async after load (and waits for a ?reset=1 unregister to settle)
      const sw = await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistrations()).length, { timeout: 8000, polling: 100 }).then((h) => h.jsonValue()).catch(() => 0)
      expect(sw >= 1, 'service worker not registered')
      const active = await page.waitForFunction(async () => { const r = await navigator.serviceWorker.getRegistration('./'); return !!(r && (r.active || r.installing || r.waiting)) }, { timeout: 8000, polling: 100 }).then((h) => h.jsonValue()).catch(() => false)
      expect(active, 'service worker registration has no worker')
      const audio = await page.evaluate(() => window.__bacon.audioCreated())
      expect(audio === false, 'AudioContext created before the speaker tap')
      const hook = await page.evaluate(() => ({ events: Array.isArray(window.__bacon.events), actions: Array.isArray(window.__bacon.actions), inFlight: window.__bacon.inFlight() }))
      expect(hook.events && hook.actions && hook.inFlight === false, 'drive hook: events, actions, inFlight()')
      const scheme = await page.$eval('meta[name="color-scheme"]', (m) => m.content)
      expect(scheme === 'light', 'color-scheme meta: ' + scheme)
      const v = await page.evaluate(() => window.__bacon.version)
      await shot('lobby')
      return `v${v}, sw ok, ${await page.evaluate(() => window.__bacon.state().pool.length)} facts`
    },
  },
  {
    name: 'play20',
    async run(ctx) {
      const { page, shot } = ctx
      await load(ctx)
      await startRide(page)
      expect((await text(page, '#message')) === 'Ground floor. Doors open.', 'the status line at G: ' + await text(page, '#message'))
      let answered = 0, tray = 0, lunch = 0, roofs = 0, dings = 0
      let shotsTaken = 0
      while (answered < 20) {
        const s = await slim(page)
        if (s.phase === 'floor') {
          const n0 = await evLen(page)
          const { after } = await rideOne(page)
          answered++
          // exactly one ding on an up ride, in the design order, and the car's motion goes moving → idle
          const evs = await evSince(page, n0)
          expect(count(evs, 'ding') === 1 && count(evs, 'ding2') === 0, `ride ${answered}: dings ${count(evs, 'ding')}/${count(evs, 'ding2')} in ${evs.join(' ')}`)
          expect(inOrder(evs, ['motion:moving', 'doors-closing', 'doors-closed', 'move-start', 'lantern', 'ding', 'sill', 'arrive', 'motion:idle', 'doors-opening', 'doors-open', 'bacon']), `ride ${answered}: step order ${evs.join(' ')}`)
          dings += count(evs, 'ding')
          if (after.phase === 'floor') expect((await text(page, '#message')) === `Floor ${after.ride.floor}. Doors open.`, 'the status line after arrival: ' + await text(page, '#message'))
          if (after.ride.floor >= 1 && after.ride.floor <= 9) { tray++; expect(await stripShown(page), `the collected strip should ride in the car at floor ${after.ride.floor}`) }
          // on the roof the tray already carries the +3 picnic bonus (9 + 2 × 2 + 3 = 16 per building)
          const shownTray = after.phase === 'roof' ? tray + 3 : tray
          expect(await num(page, '#tray') === shownTray, `#tray after ${answered}: ${await text(page, '#tray')} ≠ ${shownTray}`)
          // the lunchbox only moves at the roof, where the tray (with its bonus) banks the moment the car arrives
          expect(await num(page, '#lunchbox') === (after.phase === 'roof' ? lunch + tray + 3 : lunch), `#lunchbox drifted during a building: ${await text(page, '#lunchbox')}`)
          expect((await attr(page, '#app', 'data-phase')) === after.phase, 'data-phase does not mirror state.phase')
          expect(await num(page, '#lunchbox') >= 0, '')
          if (shotsTaken++ < 1) await shot('floor-' + after.ride.floor)
        } else if (s.phase === 'trivia') {
          await shot('passenger')
          await answerTrivia(page, true)
          tray += 2
          expect(await num(page, '#tray') === tray, `#tray after a right choice ≠ ${tray}`)
        } else if (s.phase === 'roof') {
          roofs++
          lunch += tray + 3
          expect((await attr(page, '#app', 'data-screen')) === 'roof', 'not on the roof screen')
          expect(s.ride.floor === 10 && s.roof.gained === tray, `roof gained ${s.roof.gained} ≠ tray ${tray}`)
          expect(await num(page, '#lunchbox-roof') === lunch, `roof lunchbox ${await text(page, '#lunchbox-roof')} ≠ ${lunch}`)
          expect(await num(page, '#lunchbox') === lunch, `#lunchbox ≠ ${lunch}`)
          await shot('roof')
          await tap(page, '[data-next]')
          await waitPhaseIn(page, ['floor'])
          const t = await slim(page)
          expect(t.ride.floor === 0 && t.ride.target === 1 && t.ride.tray === 0, 'the next building did not start at G')
          expect((await attr(page, '#indicator', 'data-floor')) === 'G', 'indicator not G at the new building')
          expect((await text(page, '#question')) === 'Press 1', 'display should read Press 1')
          tray = 0
        } else throw new Error('unexpected phase ' + s.phase)
      }
      const end = await slim(page)
      expect(end.phase === 'roof' && roofs === 1, 'twenty right answers should end on the second roof')
      lunch += tray + 3
      expect(end.lunchbox === lunch && lunch === 32, `lunchbox ${end.lunchbox} ≠ 32`)
      expect(end.step === 3, 'the step should have climbed to 3')
      expect((await attr(page, '#stepbar', 'data-step')) === '3', '#stepbar not at 3')
      expect(dings === 20, `20 up rides should ring 20 dings, heard ${dings}`)
      const gos = await page.evaluate(() => window.__bacon.actions.filter((a) => a === 'go').length)
      expect(gos === 20, `actions: ${gos} GO taps`)
      // the victory descent: two dings (one ding2 event), no single ding, then the lobby
      const nD = await evLen(page)
      await tap(page, '.roof [data-nav="lobby"]')
      await waitPhaseIn(page, ['descending'], 3000)
      expect(await inFlight(page), 'inFlight() during the descent')
      await waitScreen(page, 'lobby')
      const dEvs = await evSince(page, nD)
      expect(count(dEvs, 'ding2') === 1 && count(dEvs, 'ding') === 0, `descent dings: ${dEvs.join(' ')}`)
      expect(inOrder(dEvs, ['doors-closing', 'move-start', 'sill', 'ding2', 'arrive', 'doors-open']), 'descent order: ' + dEvs.join(' '))
      expect(!(await inFlight(page)), 'inFlight() after the descent')
      return `20 right answers, 2 roofs, lunchbox ${end.lunchbox}, step ${end.step}, ${dings} dings + ding2 on the descent`
    },
  },
]

scenarios.push({
  name: 'fall',
  async run(ctx) {
    const { page, shot } = ctx
    await load(ctx)
    const D = await page.evaluate(() => window.__bacon.durations)
    expect(D.truth + D.pitDoors + D.fall + D.impact + D.hold + D.pitDoors <= 5000, 'a fall over 5 s at timescale 1')
    await startRide(page)
    await rideTo(page, 6)
    let s = await slim(page)
    expect(s.ride.floor === 6 && s.ride.target === 7, `not at floor 6 (${s.ride.floor})`)
    const trayBefore = s.ride.tray, clearedBefore = s.ride.cleared.slice()
    const trays = [await num(page, '#tray')]
    // press 7, read the sum, answer it wrong (second try is on at Corner Shop: a calm line first)
    await tap(page, 'button[data-floor="7"]')
    await waitPhaseIn(page, ['keypad'])
    s = await slim(page)
    const problem = s.ride.problem
    const wrong = problem.answer + 1
    await enter(page, wrong)
    await wait(60)
    s = await slim(page)
    expect(s.phase === 'keypad' && s.ride.typed === '' && s.ride.tries === 1, 'the first miss should clear the entry and wait')
    expect((await text(page, '#message')) === 'Try once more.', 'second-try line missing: ' + await text(page, '#message'))
    expect(!/[!✗]|wrong|oops/i.test(await text(page, '.display')), 'failure copy tone')
    await shot('second-try')
    expect(await stripShown(page), 'the strip collected at floor 6 should be in the car before the fall')
    // second miss: the true equation, then the fall
    const nFall = await evLen(page)
    await enter(page, wrong)
    await waitPhaseIn(page, ['falling'], 3000)
    expect(await inFlight(page), 'inFlight() during the fall')
    expect((await attr(page, '#car', 'data-motion')) === 'falling', '#car[data-motion] should be falling')
    expect((await attr(page, '#indicator', 'data-arrow')) === 'down', 'indicator arrow should point down')
    const shown = await text(page, '#question')
    expect(shown.replace(/\s+/g, ' ') === problem.text.replace('▮', String(problem.answer)), `the true equation should show first: "${shown}"`)
    trays.push(await num(page, '#tray'))
    await page.waitForFunction(() => document.getElementById('indicator').dataset.floor === 'P', { timeout: 3000 })
    await shot('pit')
    await waitPhaseIn(page, ['repair'])
    expect(!(await inFlight(page)), 'inFlight() after the fall')
    trays.push(await num(page, '#tray'))
    expect((await attr(page, '#indicator', 'data-floor')) === 'P', 'indicator should read P')
    expect((await attr(page, '#doors', 'data-state')) === 'open', 'doors should reopen in the pit')
    // the fall's step order, the motion transitions, and no ding of any kind
    const fallEvs = await evSince(page, nFall)
    expect(inOrder(fallEvs, ['motion:falling', 'doors-closing', 'doors-closed', 'fall-start', 'impact', 'motion:idle', 'brake', 'doors-opening', 'doors-open']), 'fall order: ' + fallEvs.join(' '))
    expect(count(fallEvs, 'ding') === 0 && count(fallEvs, 'ding2') === 0, 'a fall rings no ding: ' + fallEvs.join(' '))
    expect((await text(page, '#question')) === 'Safety brake on.' && (await text(page, '#message')) === 'Nobody is hurt. Nothing is lost.', `pit status lines: "${await text(page, '#question')}" / "${await text(page, '#message')}"`)
    expect(await stripShown(page), 'the strip should still be in the car after the fall — no bacon is ever lost')
    s = await slim(page)
    expect(s.ride.floor === -1 && s.carFloor === -1, 'not in the pit')
    expect(s.ride.tray === trayBefore && JSON.stringify(s.ride.cleared) === JSON.stringify(clearedBefore), 'the fall took bacon')
    const big = (await text(page, '.card .big')).replace(/\s+/g, ' ')
    expect(big === problem.text.replace('▮', String(problem.answer)), `repair card should begin with the true equation, got "${big}"`)
    expect((await text(page, '.card .small')) === `you pressed ${wrong}`, 'repair small line')
    const cardText = await text(page, '.card')
    expect(!/[!✗]|wrong|oops/i.test(cardText), 'repair copy tone: ' + cardText)
    expect(!/\bno\b/i.test(cardText), 'repair copy tone (no): ' + cardText)
    await shot('repair')
    // Try again → the SAME sum
    await tap(page, 'button[data-continue]')
    await waitPhaseIn(page, ['keypad'])
    s = await slim(page)
    expect(s.ride.problem.key === problem.key && s.ride.problem.text === problem.text, 'Try again must return the same problem')
    const norm = (t) => t.replace('▮', '').replace(/\s+/g, ' ').trim()
    expect(norm(await text(page, '#question')) === norm(problem.text), `display should show the same sum: "${await text(page, '#question')}" vs "${problem.text}"`)
    expect((await text(page, '#message')) === 'Same sum. Ride back up.', 'retry status line: ' + await text(page, '#message'))
    expect(await stripShown(page), 'the strip stays in the car at the retry keypad')
    // the right answer rides express P → 7 with the strip collected, one ding
    const nExp = await evLen(page)
    await enter(page, problem.answer)
    await waitPhaseIn(page, ['moving'], 3000)
    expect((await attr(page, '#car', 'data-motion')) === 'hoisting', '#car[data-motion] should be hoisting on the recovery ride')
    await shot('hoist')
    await waitPhaseIn(page, ['floor'])
    trays.push(await num(page, '#tray'))
    s = await slim(page)
    expect(s.ride.floor === 7 && s.ride.target === 8, `should be at floor 7 (${s.ride.floor})`)
    expect(s.ride.cleared.includes(7) && s.ride.tray === trayBefore + 1, 'the strip at 7 was not collected')
    expect((await attr(page, '#indicator', 'data-floor')) === '7', 'indicator should read 7')
    expect((await text(page, '#question')) === 'Press 8', 'display should read Press 8')
    expect((await text(page, '#message')) === 'Floor 7. Doors open.', 'status line at 7: ' + await text(page, '#message'))
    const expEvs = await evSince(page, nExp)
    expect(count(expEvs, 'ding') === 1 && count(expEvs, 'ding2') === 0, 'the express ride rings one ding: ' + expEvs.join(' '))
    expect(inOrder(expEvs, ['motion:hoisting', 'doors-closing', 'move-start', 'sill', 'ding', 'arrive', 'motion:idle', 'doors-open', 'bacon']), 'express order: ' + expEvs.join(' '))
    expect(await stripShown(page), 'the strip from 7 rides in the car after the recovery')
    for (let i = 1; i < trays.length; i++) expect(trays[i] >= trays[i - 1], `#tray decreased: ${trays.join(' → ')}`)
    return `fall from 6, brake at P, Try again → ${problem.text.replace('▮', String(problem.answer))}, express to 7, tray ${trays.join('→')}, strip in the car throughout`
  },
})

scenarios.push(
  {
    name: 'trivia',
    async run(ctx) {
      const { page, shot } = ctx
      await load(ctx)
      await startRide(page)
      await rideTo(page, 4)
      let s = await slim(page)
      expect(s.phase === 'trivia' && s.ride.floor === 4, 'floor 4 should bring a passenger, got ' + s.phase)
      const choices = await page.$$('button[data-choice]')
      expect(choices.length === 3, `${choices.length} choices`)
      const labels = await page.$$eval('button[data-choice] .ctext', (bs) => bs.map((b) => b.textContent.trim()))
      expect(new Set(labels).size === 3 && labels.every((l) => l.length > 0), 'choices must be three distinct labels')
      const letters = await page.$$eval('button[data-choice] .letter', (bs) => bs.map((b) => b.textContent.trim()))
      expect(letters.join('') === 'ABC', 'letter badges A, B, C: ' + letters.join(''))
      const arias = await page.$$eval('button[data-choice]', (bs) => bs.map((b) => b.getAttribute('aria-label')))
      expect(arias.every((a, i) => a === `${'ABC'[i]}: ${labels[i]}`), 'aria-labels like "B: Kodak": ' + arias.join(' | '))
      expect((await text(page, '#question')) === 'A passenger asks:', 'display should read A passenger asks:')
      expect(await page.$('.tq') !== null && (await text(page, '.tq')).length > 5, 'no question text')
      expect(await page.$('button[data-key="go"]') === null, 'the keypad must be gone in trivia mode')
      const indicator = await attr(page, '#indicator', 'data-floor')
      const tray = await num(page, '#tray')
      await shot('question')
      const wrong = (s.trivia.answer + 1) % 3
      const third = 3 - wrong - s.trivia.answer
      await tap(page, `button[data-choice="${wrong}"]`)
      const t0 = Date.now()
      await waitPhaseIn(page, ['fact'])
      // the on-panel beat: the result shows on the buttons and the display band BEFORE the Fact sheet
      expect(await page.$('#sheet .fact') === null, 'the Fact sheet must wait for the beat')
      const results = await page.$$eval('button[data-choice]', (bs) => bs.map((b) => [b.dataset.result, b.disabled]))
      expect(results[s.trivia.answer][0] === 'right' && results[wrong][0] === 'chosen' && results[third][0] === 'dim', 'choice results: ' + JSON.stringify(results))
      expect(results.every((r) => r[1] === true), 'choices are disabled after a choice')
      const letter = 'ABC'[s.trivia.answer]
      expect((await text(page, '#question')) === `The answer is ${letter}.`, 'beat display: ' + await text(page, '#question'))
      await wait(120) // past the 200 ms colour transition, still inside the 300 ms beat
      expect(await page.$('#sheet .fact') === null, 'the Fact sheet must still wait for the beat')
      await shot('beat')
      await waitFor(page, () => document.querySelector('#sheet .fact'), 'the Fact sheet after the beat', 5000)
      const beatMs = Date.now() - t0
      expect(beatMs >= 250, `the Fact sheet came ${beatMs} ms after the choice; never under 300`)
      expect((await attr(page, '#indicator', 'data-floor')) === indicator, 'a wrong choice moved the indicator')
      expect((await attr(page, '#car', 'data-motion')) === 'idle', 'the car moved on a wrong choice')
      expect(await num(page, '#tray') === tray, 'a wrong choice changed the tray')
      const sheet = await text(page, '#sheet .fact')
      expect(/Source: .+\(.+\)/.test(sheet), 'Fact card needs a Source: line')
      expect(/The answer is /.test(sheet), 'Fact card should state the answer')
      expect(await page.$('#sheet a') === null, 'no anchor inside the ride')
      expect((await text(page, '#sheet [data-continue]')) === 'Got it', 'Got it button')
      const foot = await page.$eval('#sheet .foot', (f) => f.getBoundingClientRect().bottom <= window.innerHeight + 1)
      expect(foot, 'Got it must be pinned inside the viewport')
      await shot('fact')
      await tap(page, '#sheet [data-continue]')
      await waitPhaseIn(page, ['floor'])
      expect((await text(page, '#question')) === 'Press 5', 'after Got it the display should read Press 5')
      s = await slim(page)
      expect(s.ride.floor === 4 && s.ride.target === 5, 'floor changed')
      // floor 8: a right answer pays +2 and the choice fills
      await rideTo(page, 8)
      s = await slim(page)
      expect(s.phase === 'trivia' && s.ride.floor === 8, 'floor 8 should bring a passenger')
      const t8 = await num(page, '#tray')
      await tap(page, `button[data-choice="${s.trivia.answer}"]`)
      await waitPhaseIn(page, ['fact'])
      expect(await page.$('#sheet .fact') === null, 'the Fact sheet must wait for the beat (right choice)')
      expect((await attr(page, `button[data-choice="${s.trivia.answer}"]`, 'data-result')) === 'right', 'the right choice fills')
      expect((await text(page, '#question')) === 'That is right.' && (await text(page, '#message')) === '+2 bacon', `beat display: "${await text(page, '#question')}" / "${await text(page, '#message')}"`)
      expect(await num(page, '#tray') === t8 + 2, 'a right choice should pay +2')
      await waitFor(page, () => document.querySelector('#sheet .fact'), 'the Fact sheet after the beat', 5000)
      expect(/\+2 bacon/.test(await text(page, '#sheet .fact')), 'card should say +2 bacon')
      await wait(700)
      expect(await page.$('#sheet .fact') !== null, 'the Fact sheet never auto-dismisses')
      await tap(page, '#sheet [data-continue]')
      await waitPhaseIn(page, ['floor'])
      // the Fact Book lists both facts with citations
      await tap(page, '[data-nav="lobby"]')
      await waitScreen(page, 'lobby')
      await tap(page, '[data-nav="factbook"]')
      await waitScreen(page, 'factbook')
      const items = await page.$$('.book-item')
      expect(items.length === 2, `Fact Book should list 2 facts, has ${items.length}`)
      expect(await page.$('.book-item a') === null, 'links off by default')
      await shot('factbook')
      return `wrong at 4 (indicator stayed ${indicator}), right at 8 (+2), 2 facts in the book`
    },
  },
  {
    name: 'settings',
    async run(ctx) {
      const { page, shot } = ctx
      await load(ctx)
      await tap(page, '[data-gear]')
      await tap(page, '[data-gear]')
      await waitScreen(page, 'grownups')
      let s = await slim(page)
      expect(s.settings.speed === 'normal' && s.settings.secondTry === true && s.settings.sound === false, 'defaults')
      const before = await page.evaluate(() => window.__bacon.durations)
      expect(before.floor === 700 && before.doors === 500, 'Normal durations')
      await tap(page, '[data-setting="speed"][data-value="fast"]')
      await tap(page, '[data-setting="secondTry"][data-value="false"]')
      await tap(page, '[data-setting="passengers"][data-value="never"]')
      s = await slim(page)
      expect(s.settings.speed === 'fast' && s.settings.secondTry === false && s.settings.passengers === 'never', 'settings did not change')
      expect((await attr(page, '[data-setting="speed"][data-value="fast"]', 'aria-checked')) === 'true', 'radio state')
      await shot('grownups')
      // persistence across a reload (no ?reset)
      await ctx.goto(Q)
      await waitFor(page, () => window.__bacon && window.__bacon.state().pool.length > 0, 'the fact pool')
      s = await slim(page)
      expect(s.settings.speed === 'fast' && s.settings.secondTry === false && s.settings.passengers === 'never', 'settings did not persist: ' + JSON.stringify(s.settings))
      const after = await page.evaluate(() => window.__bacon.durations)
      expect(after.floor === 350 && after.doors === 250 && after.fall === 400, 'Fast should halve every duration: ' + JSON.stringify(after))
      expect(Math.abs(await page.evaluate(() => window.__bacon.timescale) - 0.05) < 1e-9, 'timescale = 0.5 × 0.1 in the drive')
      // second try off: the first miss falls; passengers never: floor 4 has no ? tag and no passenger
      await startRide(page)
      expect(await page.$('button[data-floor="4"] .tag') === null, 'no ? tags with passengers off')
      const p = await press(page)
      await enter(page, p.answer + 1)
      await waitPhaseIn(page, ['falling'], 3000)
      await waitPhaseIn(page, ['repair'])
      await tap(page, 'button[data-continue]')
      await enter(page, p.answer)
      await waitPhaseIn(page, ['floor'])
      await rideTo(page, 4)
      s = await slim(page)
      expect(s.phase === 'floor' && s.ride.floor === 4, 'passengers never: floor 4 should be quiet')
      // a garbage save is tolerated. The game saves on pagehide and on visibilitychange (hidden); listeners run in
      // registration order per event, so garbage written by both of these lands after the game's own saves.
      await page.evaluate(() => {
        const garbage = () => localStorage.setItem('bacon-elevator.save.v1', '{"v":1,"lunchbox":"many","settings":{"speed":"warp"},"ride":{"floor":99}}')
        window.addEventListener('pagehide', garbage)
        document.addEventListener('visibilitychange', garbage)
      })
      await ctx.goto(Q)
      await waitFor(page, () => window.__bacon && window.__bacon.state().pool.length > 0, 'the fact pool')
      s = await slim(page)
      expect(s.screen === 'lobby' && s.lunchbox === 0 && s.settings.speed === 'normal', 'garbage save should fall back to defaults')
      return 'fast+secondTry off+passengers never persisted; durations halved; garbage save tolerated'
    },
  },
  {
    name: 'layout',
    async run(ctx) {
      const { page, shot } = ctx
      await load(ctx)
      const seen = []
      const check = async (name, opts) => { const r = await checkLayout(page, name, opts); seen.push(name + (r.shaft ? `(shaft ${r.shaft})` : '')); await shot(name) }
      await check('lobby')
      await tap(page, '[data-nav="picker"]'); await waitScreen(page, 'picker'); await check('picker')
      await tap(page, '[data-nav="lobby"]'); await waitScreen(page, 'lobby')
      await tap(page, '[data-nav="workshop"]'); await waitScreen(page, 'workshop'); await check('workshop')
      await tap(page, '[data-nav="lobby"]'); await waitScreen(page, 'lobby')
      await tap(page, '[data-nav="factbook"]'); await waitScreen(page, 'factbook'); await check('factbook')
      await tap(page, '[data-nav="lobby"]'); await waitScreen(page, 'lobby')
      await tap(page, '[data-gear]'); await tap(page, '[data-gear]'); await waitScreen(page, 'grownups'); await check('grownups')
      await tap(page, '[data-nav="lobby"]'); await waitScreen(page, 'lobby')
      await tap(page, '[data-nav="ride"]'); await waitScreen(page, 'rules')
      // the Rules card: five pictures and both sentences readable without scrolling, even at 360 × 640
      await check('rules', { noScroll: '.rules .body', texts: ["A passenger's question never falls.", 'Bacon is never lost. There is no clock.'] })
      expect(await page.$$eval('.rules .pic', (ps) => ps.length) === 5, 'five Rules pictures')
      await tap(page, '.rules [data-continue]'); await waitScreen(page, 'ride'); await waitPhaseIn(page, ['floor'])
      await check('floor', { ride: true })
      await tap(page, 'button[data-floor="1"]'); await waitPhaseIn(page, ['keypad'])
      await check('keypad', { ride: true, go: true })
      await tap(page, 'button[data-key="hint"]')
      expect(!(await page.$eval('#hint', (h) => h.hidden)), 'HINT should show')
      await check('hint', { ride: true, go: true })
      await tap(page, 'button[data-key="hint"]')
      // landscape under 500 px tall: two columns, nothing clipped, every target 48 px, shaft ≥ 200
      const portrait = ctx.phone.viewport
      const turn = async (w, h) => { await page.setViewport({ ...portrait, width: w, height: h, isLandscape: true }); await wait(150) }
      await turn(667, 375); await check('landscape-keypad-667', { ride: true, go: true })
      await turn(640, 360); await check('landscape-keypad-640', { ride: true, go: true })
      await rideOne(page)
      await check('landscape-floor-640', { ride: true })
      await turn(667, 375); await check('landscape-floor-667', { ride: true })
      await page.setViewport(portrait); await wait(150)
      await check('portrait-again', { ride: true })
      await rideTo(page, 4)
      await check('trivia', { ride: true })
      const s = await slim(page)
      await tap(page, `button[data-choice="${s.trivia.answer}"]`); await waitPhaseIn(page, ['fact'])
      await check('fact')
      await tap(page, '#sheet [data-continue]'); await waitPhaseIn(page, ['floor'])
      // a fall for the repair card
      const p = await press(page)
      await enter(page, p.answer + 1); await enter(page, p.answer + 1)
      await waitPhaseIn(page, ['repair'])
      await check('repair', { ride: true, card: true })
      await tap(page, 'button[data-continue]'); await enter(page, p.answer); await waitPhaseIn(page, ['floor'])
      await rideTo(page, 9)
      await rideOne(page)
      await waitScreen(page, 'roof')
      await check('roof', { roof: true })
      await tap(page, '.roof [data-nav="lobby"]')
      await waitPhaseIn(page, ['descending'], 3000)
      expect((await attr(page, '#indicator', 'data-arrow')) === 'down', 'descent arrow')
      await waitScreen(page, 'lobby')
      // a Megatall 3-digit Repair card: the worked line fits the 4-row card, nothing clipped
      await tap(page, '[data-nav="picker"]'); await waitScreen(page, 'picker')
      await tap(page, '[data-level="megatall"]')
      await tap(page, '[data-nav="lobby"]'); await waitScreen(page, 'lobby')
      await tap(page, '[data-nav="ride"]'); await waitScreen(page, 'ride'); await waitPhaseIn(page, ['floor'])
      const pm = await press(page)
      expect(Math.max(pm.a, pm.b) >= 100, 'Megatall step 1 should ask a 3-digit sum: ' + pm.text)
      await enter(page, pm.answer + 1); await enter(page, pm.answer + 1)
      await waitPhaseIn(page, ['repair'])
      const rm = await checkLayout(page, 'repair-megatall', { ride: true, card: true })
      seen.push(`repair-megatall(card ${rm.card.h}px: ${rm.card.worked})`)
      await shot('repair-megatall')
      return seen.join(', ')
    },
  },
  {
    name: 'audio',
    async run(ctx) {
      const { page } = ctx
      await load(ctx)
      const created = () => page.evaluate(() => window.__bacon.audioCreated())
      expect(await created() === false, 'AudioContext before any tap')
      await startRide(page)
      await rideOne(page)
      expect(await created() === false, 'AudioContext created before the speaker tap')
      await tap(page, '.topbar [data-sound]')
      expect(await created() === true, 'the speaker tap should create the AudioContext')
      let s = await slim(page)
      expect(s.settings.sound === true, 'sound setting on')
      expect((await attr(page, '.topbar [data-sound]', 'aria-pressed')) === 'true', 'speaker aria-pressed')
      await rideOne(page); await rideOne(page)
      const p = await press(page)
      await enter(page, p.answer + 1); await enter(page, p.answer + 1)
      await waitPhaseIn(page, ['repair'])
      await tap(page, 'button[data-continue]'); await enter(page, p.answer); await waitPhaseIn(page, ['floor', 'trivia'])
      s = await slim(page)
      if (s.phase === 'trivia') await answerTrivia(page, true)
      await tap(page, '.topbar [data-sound]')
      s = await slim(page)
      expect(s.settings.sound === false, 'sound off again')
      await ctx.goto(Q)
      await waitFor(page, () => window.__bacon && window.__bacon.state().pool.length > 0, 'the fact pool')
      expect(await created() === false, 'a reload must not create audio without a gesture')
      return 'no context before the speaker tap; rides, a fall and a recovery played with sound on'
    },
  },
)
