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
import { customLevel } from '../src/levels.js'
import { label } from '../src/elevator.js'

const Q = '?drive=1&seed=7&fast=1'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

// THE BANK'S WORST CASE, forced into the real panel by the layout scenario. The trivia step shows
// whatever fact seed 7 picks, which is why a clipped 196-character question could ship: this is the
// longest question and the three longest choices in data/trivia.json (196 / 84 / 71 / 57 chars).
const WORST = {
  q: 'A ‘space elevator’ would be a cable running from the ground up to a station in geostationary orbit, the orbit where a satellite stays above the same spot on Earth. About how high up is that orbit?',
  choices: [
    'A law says the doors must stay open for a few seconds so everyone has time to get in',
    'A super-short speech to sell an idea, short enough for an elevator ride',
    'So a wheelchair user can see behind them when backing out',
  ],
}

// A slim, serialisable view of the live state (the pool is 67 facts; leave it behind).
const slim = (page) => page.evaluate(() => {
  const s = window.__bacon.state()
  const r = s.ride
  return {
    screen: s.screen, phase: s.phase, lunchbox: s.lunchbox, step: s.step, settings: s.settings, carFloor: s.car.floor, carDoors: s.car.doors,
    ride: r ? { floor: r.floor, target: r.target, tray: r.tray, cleared: r.cleared, typed: r.typed, problem: r.problem, tries: r.tries, retrying: r.retrying, phase: r.phase, passengersDone: r.passengersDone, roofCard: r.roofCard } : null,
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
// The adaptive rule is specified as "visible, never silent" (DESIGN §4) and its whole announcement
// used to be three pips nothing explains. The words share the band that carries the doors line.
const STEP_NOTES = new Set(['Bigger numbers now.', 'Smaller numbers for a bit.'])
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

// Put the bank's worst-case trivia into the real panel, let the page re-measure (the shaft's
// ResizeObserver, the camera pull-back and the .tiny rule are the page's own code paths, not
// something an assertion may reason about), assert, then put back exactly what was there.
async function worstCase(page, check, name) {
  await page.evaluate((w) => {
    const panel = document.getElementById('panel'), appEl = document.getElementById('app')
    window.__worst = { mode: panel.dataset.mode, html: panel.innerHTML, phase: appEl.dataset.phase }
    const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
    const LET = ['A', 'B', 'C']
    panel.dataset.mode = 'trivia'
    appEl.dataset.phase = 'trivia'
    panel.innerHTML = `<div class="tq">${esc(w.q)}</div>` + w.choices.map((c, i) =>
      `<button class="cell choice" data-choice="${i}" data-tap data-result="" aria-label="${LET[i]}: ${esc(c)}"><span class="letter" aria-hidden="true">${LET[i]}</span><span class="ctext">${esc(c)}</span></button>`).join('')
  }, WORST)
  await wait(220)
  const r = await check(name, { ride: true, worstTrivia: true })
  await page.evaluate(() => {
    const panel = document.getElementById('panel'), appEl = document.getElementById('app')
    panel.dataset.mode = window.__worst.mode; panel.innerHTML = window.__worst.html; appEl.dataset.phase = window.__worst.phase
    delete window.__worst
  })
  await wait(220)
  return r
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
// A key inside a container that GENUINELY scrolls is reachable; one inside a container that does
    // not is off screen for ever. The old rule named two selectors, so a panel that had been given
    // overflow-y would have been judged as if it were still a fixed block — and a panel that has NOT
    // been given one still is.
    const scrollHost = (el) => {
      let e = el.parentElement
      while (e && e !== document.body) {
        const cs = getComputedStyle(e)
        if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && e.scrollHeight > e.clientHeight + 1) return e
        e = e.parentElement
      }
      return null
    }
    for (const el of app.querySelectorAll('[data-tap]')) {
      if (!vis(el)) continue
      const r = el.getBoundingClientRect()
      if (r.width < 48 || r.height < 48) out.problems.push(`tap target under 48 px: ${el.outerHTML.slice(0, 60)} ${Math.round(r.width)}×${Math.round(r.height)}`)
      const scrolls = el.closest('.page, .sheet .body') || scrollHost(el)
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
      const shaftBox = document.getElementById('shaft')
      const sh = shaftBox.getBoundingClientRect()
      out.shaft = Math.round(sh.height)
      const tb = document.querySelector('.ride .topbar').getBoundingClientRect()
      const dp = document.querySelector('.ride .display').getBoundingClientRect()
      const panel = document.getElementById('panel').getBoundingClientRect()
      out.budget = [tb, dp, sh, panel].map((r) => Math.round(r.height)).join('+') + '=' + Math.round(tb.height + dp.height + sh.height + panel.height) + ' of ' + window.innerHeight
      // The shaft is the remainder, so 200 px is a PREFERENCE, not a floor. Re-derive what the
      // budget allows it instead of re-asserting a constant the layout no longer promises.
      const spare = window.innerHeight - tb.height - dp.height - panel.height
      if (sh.height < Math.min(200, spare) - 1) out.problems.push(`shaft ${Math.round(sh.height)} px, budget allowed ${Math.round(Math.min(200, spare))}`)
      const tiny = shaftBox.classList.contains('tiny')
      if (sh.height > 0.5 && sh.height < 64 && !tiny) out.problems.push(`shaft is a ${Math.round(sh.height)} px sliver of cropped car`)
      if (sh.height >= 64 && tiny) out.problems.push('the shaft is hidden but has room')
      if (panel.bottom > window.innerHeight + 1) out.problems.push(`panel below the viewport by ${Math.round(panel.bottom - window.innerHeight)} px`)
      const cell = document.querySelector('.panel .cell')
      if (cell && cell.getBoundingClientRect().height < 48) out.problems.push(`panel cell under 48 px: ${Math.round(cell.getBoundingClientRect().height)}`)
      // EVERY KEY MUST BE REACHABLE. Where the panel scrolls (a viewport too short for five rows of
      // 48 px keys), scrolling it must actually bring the last row whole into its own box — the
      // failure this replaces was GO sitting 4 px on screen at 568 × 276 with #app overflow:hidden
      // and no scroll anywhere, so the one control that submits an answer could not be pressed.
      const panelEl0 = document.getElementById('panel')
      if (panelEl0.scrollHeight > panelEl0.clientHeight + 1) {
        const was = panelEl0.scrollTop
        panelEl0.scrollTop = panelEl0.scrollHeight
        const box = panelEl0.getBoundingClientRect()
        for (const el of panelEl0.querySelectorAll('[data-tap]')) {
          const q = el.getBoundingClientRect()
          if (q.bottom > box.bottom + 1) out.problems.push(`panel key unreachable even scrolled to the end: ${el.outerHTML.slice(0, 50)}`)
        }
        panelEl0.scrollTop = was
        out.panelScroll = `panel scrolls ${panelEl0.scrollHeight} in ${Math.round(panelEl0.clientHeight)}`
      }
      // the floor-mode spacer is a spacer: a lone bold `·` reads as a mystery button
      const panelEl = document.getElementById('panel')
      if (panelEl.dataset.mode === 'floor') for (const sp of panelEl.querySelectorAll('.spacer')) {
        if (sp.textContent.trim()) out.problems.push(`the floor-mode spacer draws "${sp.textContent.trim()}"`)
      }
      // the ride's level chip must HOLD its label; an ellipsis is the layout giving up
      const ln = document.getElementById('levelname')
      if (ln && ln.clientWidth > 0 && ln.scrollWidth > ln.clientWidth + 1) out.problems.push(`level name ellipsised: "${ln.textContent}" needs ${ln.scrollWidth} px of ${ln.clientWidth}`)
      // THE CROP GUARD: nothing visible is drawn cut in half by the shaft's edge. Partial OVERLAP,
      // never containment - an SVG child scrolled out of the viewBox still reports a rect outside
      // the shaft box, so a containment test flags four bacon plates on every phone.
      for (const node of document.querySelectorAll('#shaft .sign, #shaft .spikes, #shaft .buffers, #shaft .plate')) {
        if (getComputedStyle(node).visibility === 'hidden') continue
        const r = node.getBoundingClientRect()
        if (r.height < 0.5) continue
        const seen = Math.min(r.bottom, sh.bottom) - Math.max(r.top, sh.top)
        if (seen > 0.5 && seen < r.height - 0.5) out.problems.push(`the shaft crops "${node.textContent.trim() || node.getAttribute('class')}" mid-glyph: ${Math.round(seen)} of ${Math.round(r.height)} px`)
      }
    }
    // The bank's worst case, already in the real panel (see worstCase below): the longest question
    // and the three longest choices must be whole, inside their buttons and on screen.
    if (opts.worstTrivia) {
      const panel = document.getElementById('panel')
      const tq = panel.querySelector('.tq')
      if (!tq) out.problems.push('the worst-case trivia panel is not up')
      else {
        if (tq.scrollHeight > tq.clientHeight + 1) out.problems.push(`the longest question is clipped: ${tq.scrollHeight} > ${tq.clientHeight}`)
        const hs = []
        for (const b of panel.querySelectorAll('.choice')) {
          const r = b.getBoundingClientRect(), t = b.querySelector('.ctext').getBoundingClientRect()
          hs.push(Math.round(r.height))
          if (t.top < r.top + 2 || t.bottom > r.bottom - 2) out.problems.push(`choice ${b.dataset.choice} text paints over its border: text ${Math.round(t.top)}-${Math.round(t.bottom)} in ${Math.round(r.top)}-${Math.round(r.bottom)}`)
          if (r.bottom > window.innerHeight + 1) out.problems.push(`choice ${b.dataset.choice} below the viewport by ${Math.round(r.bottom - window.innerHeight)}`)
          if (r.height < 48) out.problems.push(`choice ${b.dataset.choice} is ${Math.round(r.height)} px tall`)
          if (parseFloat(getComputedStyle(b).fontSize) < 16) out.problems.push(`choice ${b.dataset.choice} text under 16 px`)
        }
        out.worst = `tq ${Math.round(tq.getBoundingClientRect().height)}px @${getComputedStyle(tq).fontSize}, choices ${hs.join('/')}`
      }
    }
    // The hint's number line: one countable hop per unit, not one arc labelled `+ 5`.
    if (opts.hops) {
      const svg = document.querySelector('#hint svg')
      if (!svg) out.problems.push('no hint number line')
      else {
        const arcs = [...svg.querySelectorAll('path')].filter((el) => (el.getAttribute('d') || '').includes('Q')).length
        if (arcs !== opts.hops) out.problems.push(`the number line draws ${arcs} hop(s) for b = ${opts.hops}`)
        out.hops = `${arcs} hops`
      }
    }
    // AND IT HAS TO BE READABLE. Counting the hops in the DOM certified a drawing whose 0–10 tick
    // labels rendered at 2 CSS px on a 320 × 454 phone: `.hint` was 46 % of a shaft that the short
    // tiers had collapsed to 82 px, and a fixed 320 × 110 viewBox letterboxed the whole drawing into
    // a 16 px box. This measures what is PAINTED, which computed font-size cannot see through a
    // viewBox scale.
    if (opts.hint) {
      const box = document.getElementById('hint')
      const svg = box && box.querySelector('svg')
      const worked = box && box.querySelector('.worked')
      if (!box || box.hidden) out.problems.push('the hint card is not up')
      else if (svg) {
        const texts = [...svg.querySelectorAll('text')].filter((t) => t.textContent.trim())
        if (!texts.length) out.problems.push('the hint drawing carries no labels')
        const hs = texts.map((t) => t.getBoundingClientRect().height)
        const min = Math.min(...hs)
        if (min < 9) out.problems.push(`hint labels render at ${min.toFixed(1)} CSS px`)
        const bb = svg.getBoundingClientRect()
        const drawn = texts.reduce((a, t) => { const r = t.getBoundingClientRect(); return { l: Math.min(a.l, r.left), r: Math.max(a.r, r.right) } }, { l: Infinity, r: -Infinity })
        const fill = (drawn.r - drawn.l) / Math.max(1, bb.width)
        if (fill < 0.5) out.problems.push(`the hint drawing fills ${(100 * fill).toFixed(0)} % of the width it was given`)
        out.hint = `labels ${min.toFixed(1)}px, fills ${(100 * fill).toFixed(0)} %`
      } else if (worked) out.hint = `worked line ${getComputedStyle(worked).fontSize}`
      else out.problems.push('the hint card is empty')
    }
    // A long page's way out must be reachable at ANY scroll position, not only at the top.
    if (opts.wayOut) {
      const page = document.querySelector('.screen.active .page')
      if (!page) out.problems.push('no scrollable page to leave')
      else {
        const was = page.scrollTop
        page.scrollTop = page.scrollHeight
        const exit = document.querySelector('.screen.active [data-nav="lobby"]')
        if (!exit) out.problems.push('no way out on this page')
        else {
          const r = exit.getBoundingClientRect()
          if (r.top < -1 || r.bottom > window.innerHeight + 1) out.problems.push(`the way out is off screen at the bottom of the page: top ${Math.round(r.top)}`)
          out.wayOut = `page ${page.scrollHeight} px, Lobby at ${Math.round(r.top)}`
        }
        page.scrollTop = was
      }
    }
    if (opts.go) {
      const go = document.querySelector('button[data-key="go"]')
      const panelBox = document.getElementById('panel')
      if (!go) out.problems.push('no GO key')
      else {
        const g = go.getBoundingClientRect(), p = panelBox.getBoundingClientRect()
        // GO is the last key of the panel, wherever the panel ends. Where the panel scrolls, `the
        // bottom` is the bottom of its CONTENT, not of the box the viewport gives it.
        const scrolls = panelBox.scrollHeight > panelBox.clientHeight + 1
        const bottomGap = scrolls
          ? panelBox.scrollHeight - (go.offsetTop + go.offsetHeight)
          : Math.abs(g.bottom - p.bottom)
        if (Math.abs(g.right - p.right) > 12 || bottomGap > 12) out.problems.push(`GO is not bottom-right: go ${Math.round(g.right)},${Math.round(g.bottom)} panel ${Math.round(p.right)},${Math.round(p.bottom)}${scrolls ? ` (scrolling, gap ${Math.round(bottomGap)})` : ''}`)
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
      let lastStep = (await slim(page)).step, stepChanges = 0, stepNotes = 0
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
          if (after.phase === 'floor') {
            const msg = await text(page, '#message')
            expect(msg === `Floor ${after.ride.floor}. Doors open.` || STEP_NOTES.has(msg), 'the status line after arrival: ' + msg)
            if (after.step !== lastStep) { stepChanges++; if (STEP_NOTES.has(msg)) stepNotes++ }
            if (STEP_NOTES.has(msg)) expect(after.step !== lastStep, `"${msg}" with the step still at ${after.step}`)
            lastStep = after.step
          }
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
      // r2-autism-fit-05: a step change is announced in words, every time it happens on a landing.
      expect(stepChanges > 0, 'the step never changed over 20 correct answers')
      expect(stepNotes === stepChanges, `${stepChanges} step changes, ${stepNotes} of them said so in words`)
      return `20 right answers, 2 roofs, lunchbox ${end.lunchbox}, step ${end.step}, ${stepChanges} step changes all announced, ${dings} dings + ding2 on the descent`
    },
  },
]

// THE SAVE IS THE DOORWAY. Every state the reducer can be parked in is reachable by closing the
// tab, and three of them used to come back dead. Nothing here is a corrupt save: these are the
// blobs the game writes for itself, on the child's own path.
scenarios.push({
  name: 'reload',
  async run(ctx) {
    const { page, shot } = ctx
    await load(ctx)
    await startRide(page)

    // (1) mid-sum, walk out to the picker and come back. The reducer bug behind this (nav stamping
    //     ride.phase = lobby over a live keypad) is not DOM-reachable today, because every nav button
    //     lives on the lobby screen; the reducer test pins it. This is the regression guard for the
    //     path a child DOES take.
    await rideOne(page)
    await tap(page, `button[data-floor="${label((await slim(page)).ride.target)}"]`)
    await waitPhaseIn(page, ['keypad'])
    const mid = await slim(page)
    await tap(page, '[data-nav="lobby"]'); await waitScreen(page, 'lobby')
    await tap(page, '[data-nav="picker"]'); await waitScreen(page, 'picker')
    expect((await slim(page)).ride.phase === 'keypad', 'the parked ride recorded phase ' + (await slim(page)).ride.phase + ', not keypad')
    await tap(page, '[data-nav="lobby"]'); await waitScreen(page, 'lobby')
    await startRide(page)
    let s = await slim(page)
    expect(s.phase === 'keypad', 'the resumed building is at ' + s.phase + ', not the keypad')
    expect(s.ride.problem.key === mid.ride.problem.key, 'the resumed sum changed')
    await tap(page, 'button[data-key="3"]')
    expect((await slim(page)).ride.typed === '3', 'the digit keys are dead after the resume')
    await tap(page, 'button[data-key="back"]')
    await rideOne(page)

    // (2) the Fact card. The SAVE effect fires with `choice`, so the blob at that instant is
    // {phase:'fact', floor:4, target:4}. It used to come back as "Press 4" with floor 4 the only
    // live button - and that button inert. Zero console errors; it just stopped being a game.
    await rideTo(page, 4)
    s = await slim(page)
    expect(s.phase === 'trivia', 'floor 4 should carry a passenger at the default cadence, got ' + s.phase)
    await tap(page, `button[data-choice="${s.trivia.answer}"]`)
    await waitPhaseIn(page, ['fact'])
    s = await slim(page)
    expect(s.ride.floor === 4 && s.ride.target === 4, `the save at the Fact card: floor ${s.ride.floor}, target ${s.ride.target}`)
    const trayAtCard = s.ride.tray
    await shot('fact-card')
    await ctx.goto(Q)
    await waitFor(page, () => window.__bacon && window.__bacon.state().pool.length > 0, 'the fact pool')
    await startRide(page)
    await waitPhaseIn(page, ['floor'])
    const q = await text(page, '#question')
    expect(/Press\s*5/.test(q), `after the reload the display reads "${q}", not "Press 5"`)
    s = await slim(page)
    expect(s.ride.target === 5, `target ${s.ride.target} after the reload`)
    expect(s.ride.tray === trayAtCard, `tray ${s.ride.tray} != ${trayAtCard}: nothing may be lost on a reload`)
    await shot('after-reload')
    await tap(page, 'button[data-floor="5"]')
    await waitPhaseIn(page, ['keypad'])
    await rideOne(page)
    expect((await slim(page)).ride.floor === 5, 'the elevator did not move after the reload')

    // (3) the roof card. The summary lives only in RAM until it is persisted, so a reload used to
    // synthesise {gained:0, bonus:0} - "Tray 0 -> lunchbox" over a full tray.
    await rideTo(page, 9)
    await rideOne(page)
    await waitScreen(page, 'roof')
    const gain = await page.$eval('.roof .gain', (e) => e.textContent.trim())
    expect(!/Tray 0 /.test(gain), `the roof card reads "${gain}" before any reload`)
    await shot('roof')
    await ctx.goto(Q)
    await waitFor(page, () => window.__bacon && window.__bacon.state().pool.length > 0, 'the fact pool')
    await tap(page, '[data-nav="ride"]')
    await waitScreen(page, 'roof')
    const again = await page.$eval('.roof .gain', (e) => e.textContent.trim())
    expect(again === gain, `the roof card after a reload reads "${again}", not "${gain}"`)
    await shot('roof-after-reload')
    return `keypad resumed, Fact card at 4 -> "Press 5" -> rode to 5, roof card survives a reload ("${again}")`
  },
})

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
    // Enter the mistake this KIND actually invites, not always answer + 1. On a missing-number sum
    // that means the operation swap (a + c, or c × b) — unless it lands within 2 of the answer, in
    // which case it is an off-by and says nothing about the missing-number clause, so add 5 instead.
    const missing = /^miss/.test(problem.kind)
    const swapEntry = problem.kind === 'missAdd' ? problem.a + problem.c
                    : problem.kind === 'missMul' ? problem.c * problem.b : null
    const wrong = swapEntry !== null && Math.abs(swapEntry - problem.answer) > 2 ? swapEntry
                : missing ? problem.answer + 5 : problem.answer + 1
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
    // DESIGN §2 wrong-answer step 2: `Button light out`. The panel used to read the PRE-fall car,
    // so floor 7 glowed amber for the whole 3.6 s drop.
    const litDuringFall = await page.$eval('#panel button[data-floor="7"]', (b) => b.classList.contains('lit'))
    expect(!litDuringFall, 'the car call stays lit through the whole fall')
    // …and a control that cannot act must show it. Measured before: Lobby and the bell were never
    // given `disabled` at all, and the two door keys were disabled and still drew as live keys.
    const dead = await page.evaluate(() => {
      const q = (sel) => document.querySelector(sel)
      const nav = q('.ride .topbar [data-nav="lobby"]'), bell = q('#panel [data-bell]')
      const open = q('#panel [data-door="open"]'), close = q('#panel [data-door="close"]')
      const live = [...document.querySelectorAll('#panel .key')].find((k) => !k.disabled)
      return {
        nav: nav && nav.disabled, bell: bell && bell.disabled, open: open && open.disabled, close: close && close.disabled,
        deadBg: close ? getComputedStyle(close).backgroundColor : null,
        deadShadow: close ? getComputedStyle(close).boxShadow : null,
        // `.panel .key` is the live look: white with the #b9b3a4 drop shadow. Every key on the panel
        // is disabled during a fall, so there is no live key to compare against — compare with the
        // declared live look instead, or the assertion passes vacuously.
        liveBg: live ? getComputedStyle(live).backgroundColor : 'rgb(255, 255, 255)',
      }
    })
    expect(dead.nav && dead.bell && dead.open && dead.close, `controls that cannot act still look live: ${JSON.stringify(dead)}`)
    expect(dead.deadBg !== dead.liveBg && dead.deadBg !== 'rgb(255, 255, 255)', `a disabled key paints exactly like a live one: ${dead.deadBg}`)
    expect(!/185, 179, 164/.test(dead.deadShadow || ''), `a disabled key keeps the live drop shadow: ${dead.deadShadow}`)
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
    // EVERY CLAUSE IS TRUE OF THE MISTAKE IT IS SHOWN FOR. The drive always entered answer + 1, so
    // it only ever exercised `offby` — which is how a missing-number card telling a child who added
    // that `+ means add` shipped with an instrument on the same screen.
    const clause = await text(page, '.card .clause')
    expect(!(/ means /.test(clause) && /^miss/.test(problem.kind)),
      `a missing-number card must never name the glyph the child already used: ${problem.text} -> "${clause}"`)
    if (missing) {
      // opswap and other both name the inverse move on a missing-number kind: the total is already
      // printed, so making it again cannot be the move.
      const want = problem.kind === 'missMul'
        ? `${problem.c} is the total, so ▮ is ${problem.c} ÷ ${problem.b}`
        : `${problem.c} is the total, so ▮ is ${problem.c} − ${problem.a}`
      expect(clause === want, `repair clause for a missing-number swap: got "${clause}", want "${want}"`)
    }
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
    // WRONG AGAIN ON THE RETRY. No scenario ever missed twice, so the whole forfeit branch —
    // reducer, renderer and copy — shipped with no instrument on it: the child rode up to a strip
    // they could never collect, against `Bacon is never lost.` printed on the Rules card.
    const nAgain = await evLen(page)
    await enter(page, wrong)
    await waitPhaseIn(page, ['repair'])
    const againEvs = await evSince(page, nAgain)
    expect(count(againEvs, 'fall-start') === 0 && !againEvs.includes('motion:falling'), 'a second wrong answer must not fall again: ' + againEvs.join(' '))
    expect((await text(page, '.card .big')).replace(/\s+/g, ' ') === problem.text.replace('▮', String(problem.answer)), 'the card returns with the true equation')
    trays.push(await num(page, '#tray'))
    await tap(page, 'button[data-continue]')
    await waitPhaseIn(page, ['keypad'])
    // the right answer rides express P → 7 with the strip collected, one ding
    const nExp = await evLen(page)
    await enter(page, problem.answer)
    await waitPhaseIn(page, ['moving'], 3000)
    expect((await attr(page, '#car', 'data-motion')) === 'hoisting', '#car[data-motion] should be hoisting on the recovery ride')
    const litOnExpress = await page.$eval('#panel button[data-floor="7"]', (b) => b.classList.contains('lit'))
    expect(litOnExpress, 'nothing is lit on the recovery express, where a real car shows the registered call')
    await shot('hoist')
    await waitPhaseIn(page, ['floor'])
    trays.push(await num(page, '#tray'))
    s = await slim(page)
    expect(s.ride.floor === 7 && s.ride.target === 8, `should be at floor 7 (${s.ride.floor})`)
    expect(s.ride.cleared.includes(7) && s.ride.tray === trayBefore + 1, 'the strip at 7 was not collected')
    expect((await attr(page, '#indicator', 'data-floor')) === '7', 'indicator should read 7')
    expect((await text(page, '#question')) === 'Press 8', 'display should read Press 8')
    // the fall dropped the step, so the band may be carrying that news instead of the doors line
    const at7 = await text(page, '#message')
    expect(at7 === 'Floor 7. Doors open.' || STEP_NOTES.has(at7), 'status line at 7: ' + at7)
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
      // r2-mobile-ux-003. `Bigger text` MUST REACH THE SCREENS THE CHILD READS.
      // Sixty-seven absolute `font-size: Npx` rules meant html.big raised only the Grown-ups labels
      // — the one screen a parent is looking at while deciding whether the toggle worked. Measured
      // before: the lobby, the picker, the Rules card, the Fact Book and the whole RIDE were
      // pixel-identical with the setting on and off.
      const sizesNow = async () => page.evaluate(() => {
        const out = {}
        const grab = (k, sel) => { const e = document.querySelector(sel); if (e) out[k] = parseFloat(getComputedStyle(e).fontSize) }
        grab('lobbyRide', '.lobby [data-nav="ride"]')
        grab('lobbyTag', '.lobby .level .tag')
        return out
      })
      await tap(page, '[data-nav="lobby"]'); await waitScreen(page, 'lobby')
      const smallText = await sizesNow()
      await tap(page, '[data-gear]'); await tap(page, '[data-gear]'); await waitScreen(page, 'grownups')
      await tap(page, '[data-setting="bigText"][data-value="true"]')
      expect((await slim(page)).settings.bigText === true, 'Bigger text did not turn on')
      await tap(page, '[data-nav="lobby"]'); await waitScreen(page, 'lobby')
      const bigText = await sizesNow()
      for (const k of Object.keys(smallText)) {
        expect(bigText[k] > smallText[k] + 0.5, `Bigger text left ${k} at ${smallText[k]} px`)
      }
      // …and the ride, which is where the child spends the whole game
      await startRide(page); await waitPhaseIn(page, ['floor'])
      const bigQ = await page.$eval('#question', (e) => parseFloat(getComputedStyle(e).fontSize))
      const bigKeyRow = await page.$eval('#panel .cell', (e) => parseFloat(getComputedStyle(e).fontSize))
      await tap(page, '.topbar [data-nav="lobby"]'); await waitScreen(page, 'lobby')
      await tap(page, '[data-gear]'); await tap(page, '[data-gear]'); await waitScreen(page, 'grownups')
      await tap(page, '[data-setting="bigText"][data-value="false"]')
      await tap(page, '[data-nav="lobby"]'); await waitScreen(page, 'lobby')
      await startRide(page); await waitPhaseIn(page, ['floor'])
      const smallQ = await page.$eval('#question', (e) => parseFloat(getComputedStyle(e).fontSize))
      const smallKeyRow = await page.$eval('#panel .cell', (e) => parseFloat(getComputedStyle(e).fontSize))
      expect(bigQ > smallQ + 0.5, `Bigger text left the sum at ${smallQ} px`)
      expect(bigKeyRow > smallKeyRow + 0.5, `Bigger text left the panel keys at ${smallKeyRow} px`)
      await tap(page, '.topbar [data-nav="lobby"]'); await waitScreen(page, 'lobby')
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
      // THE PICKER SAYS WHAT CHANGING BUILDING DOES. The reducer banks the tray — the kind thing —
      // and no sentence anywhere said so, so the parked building simply vanished.
      const parkedFloor = s.ride.floor, parkedTray = s.ride.tray
      const lunchInRide = await num(page, '#lunchbox')   // read INSIDE the ride: leaving already banks
      await tap(page, '[data-nav="lobby"]'); await waitScreen(page, 'lobby')
      await tap(page, '[data-nav="picker"]'); await waitScreen(page, 'picker')
      const note = await text(page, '.picker .page')
      expect(/lunchbox/.test(note) && note.includes(String(parkedFloor)), `the picker never says what picking another building does: "${note.slice(0, 160)}"`)
      await tap(page, 'button[data-level="hotel"]')
      await waitFor(page, () => window.__bacon.state().level === 'hotel', 'the Hotel level')
      s = await slim(page)
      expect(s.ride === null, 'the parked building should end when another is picked')
      await tap(page, '[data-nav="lobby"]'); await waitScreen(page, 'lobby')
      expect(await num(page, '#lunchbox-total') === lunchInRide + parkedTray, `the parked tray did not reach the lunchbox: ${await text(page, '#lunchbox-total')} vs ${lunchInRide} + ${parkedTray}`)
      // THE CUSTOM TAG NAMES WHAT THE TABLES CAN SHOW. It used to be composed from the raw knobs in
      // two places, so `numbers 50 to 60` sat over a `15 ÷ 3`.
      await tap(page, '[data-gear]'); await tap(page, '[data-gear]'); await waitScreen(page, 'grownups')
      await tap(page, 'button[data-level="custom"]')
      await tap(page, 'button[data-custom-op="div"]')
      await tap(page, 'button[data-custom-op="add"]')
      await tap(page, 'button[data-custom-op="sub"]')
      for (let i = 0; i < 10; i++) await tap(page, '[data-setting="custom.max"][aria-label$="up"]')
      for (let i = 0; i < 10; i++) await tap(page, '[data-setting="custom.min"][aria-label$="up"]')
      const knobs = await page.evaluate(() => window.__bacon.state().settings.custom)
      const honest = customLevel(knobs).tag
      await tap(page, '[data-nav="lobby"]'); await waitScreen(page, 'lobby')
      const chipTag = await text(page, '.lobby-chip .tag, .level .tag, [data-nav="picker"] .tag').catch(() => null)
      const shown = chipTag || (await page.evaluate(() => document.querySelector('.screen.active').textContent))
      expect(shown.includes(honest), `the Lobby shows a tag the tables cannot honour: knobs ${JSON.stringify(knobs)} → "${honest}" not in "${String(shown).slice(0, 160)}"`)
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
      const seen = [], bad = []
      // One run must name everything wrong on this phone: a broken screen used to abort the
      // scenario and hide every assertion after it (GO being unreachable went unreported because
      // the Rules card failed first).
      const check = async (name, opts) => {
        let r = null
        try { r = await checkLayout(page, name, opts) } catch (e) { bad.push(e.message) }
        if (r) seen.push(name + (r.budget ? `(${r.budget})` : r.shaft ? `(shaft ${r.shaft})` : '') + (r.worst ? ` [worst: ${r.worst}]` : '') + (r.wayOut ? ` [${r.wayOut}]` : '') + (r.panelScroll ? ` [${r.panelScroll}]` : ''))
        await shot(name)
        return r
      }
      await check('lobby')
      await tap(page, '[data-nav="picker"]'); await waitScreen(page, 'picker'); await check('picker')
      await tap(page, '[data-nav="lobby"]'); await waitScreen(page, 'lobby')
      await tap(page, '[data-nav="workshop"]'); await waitScreen(page, 'workshop'); await check('workshop')
      await tap(page, '[data-nav="lobby"]'); await waitScreen(page, 'lobby')
      await tap(page, '[data-nav="factbook"]'); await waitScreen(page, 'factbook'); await check('factbook')
      await tap(page, '[data-nav="lobby"]'); await waitScreen(page, 'lobby')
      await tap(page, '[data-gear]'); await tap(page, '[data-gear]'); await waitScreen(page, 'grownups'); await check('grownups', { wayOut: true })
      await tap(page, '[data-nav="lobby"]'); await waitScreen(page, 'lobby')
      await tap(page, '[data-nav="ride"]'); await waitScreen(page, 'rules')
      // the Rules card: five pictures and both sentences readable without scrolling, even at 360 × 640
      await check('rules', { noScroll: '.rules .body', texts: ["A passenger's question never falls.", 'Bacon is never lost. There is no clock.'] })
      expect(await page.$$eval('.rules .pic', (ps) => ps.length) === 5, 'five Rules pictures')
      await tap(page, '.rules [data-continue]'); await waitScreen(page, 'ride'); await waitPhaseIn(page, ['floor'])
      await check('floor', { ride: true })
      await tap(page, 'button[data-floor="1"]'); await waitPhaseIn(page, ['keypad'])
      await check('keypad', { ride: true, go: true })
      await worstCase(page, check, 'worst-trivia')
      await tap(page, 'button[data-key="hint"]')
      expect(!(await page.$eval('#hint', (h) => h.hidden)), 'HINT should show')
      const hp = (await slim(page)).ride.problem
      const hops = ['add', 'sub', 'up', 'down'].includes(hp.kind) && hp.b >= 1 && hp.b <= 10 ? hp.b : 0
      const hr = await check('hint', { ride: true, go: true, hint: true, ...(hops ? { hops } : {}) })
      if (hr && hr.hint) seen.push(`hint[${hr.hint}]`)
      await tap(page, 'button[data-key="hint"]')
      // LANDSCAPE, AT THE HEIGHTS A BROWSER ACTUALLY HANDS THE PAGE.
      // These turns used to be 667 × 375 and 640 × 360 — the DEVICE heights, the very mistake the
      // header comment in tools/phone-drive.mjs records for the portrait profiles. A 360 × 640
      // Android in Chrome landscape gets ~304 px and a 320 × 568 iPhone in Safari gets ~276, and at
      // those heights the old layout put GO 4 px on screen with no way to scroll to it. Subtracting
      // the bar is the whole fix to the instrument; the assertions were already right.
      const portrait = ctx.phone.viewport
      const turn = async (w, h) => { await page.setViewport({ ...portrait, width: w, height: h, isLandscape: true }); await wait(180) }
      await turn(667, 331); await check('landscape-keypad-667x331', { ride: true, go: true })
      await turn(640, 304); await check('landscape-keypad-640x304', { ride: true, go: true })
      await turn(568, 276); await check('landscape-keypad-568x276', { ride: true, go: true })
      // and the floor of the range: shorter than five 48 px keys need, where the panel must scroll
      await turn(568, 232); await check('landscape-keypad-568x232', { ride: true, go: true })
      await turn(640, 304)
      await rideOne(page)
      await check('landscape-floor-640x304', { ride: true })
      await turn(667, 331); await check('landscape-floor-667x331', { ride: true })
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
      const rm = await check('repair-megatall', { ride: true, card: true })
      if (rm && rm.card) seen.push(`repair-megatall(card ${rm.card.h}px: ${rm.card.worked})`)
      // THE UPDATE CHIP. It used to live for about a second before the page reloaded itself, so
      // nobody caught where it sat; now that the worker waits for the tap, it stays. Pinned to the
      // bottom it covered GO on an iPhone 12 (elementFromPoint at GO's own centre returned
      // #update-chip) and keys 1-6 on an SE. ?chip=1 forces it in so this is testable without a
      // deploy. Navigation here goes through el.click(), not a physical tap: a chip that BLOCKS the
      // tap must be reported by the occlusion measurement, not as a timeout somewhere else.
      await ctx.goto(Q + '&chip=1&reset=1')
      await waitFor(page, () => window.__bacon && window.__bacon.state().pool.length > 0, 'the fact pool')
      const click = async (sel) => { const hit = await page.evaluate((q) => { const e = document.querySelector(q); if (!e || e.disabled) return false; e.click(); return true }, sel); expect(hit, 'no ' + sel + ' to click'); await wait(120) }
      await waitFor(page, () => !!document.getElementById('update-chip'), 'the update chip')
      const chipRect = await page.$eval('#update-chip', (e) => { const b = e.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), x: Math.round(b.left), y: Math.round(b.top) } })
      if (chipRect.h < 48) bad.push(`update chip is ${chipRect.h}px tall, under the 48 px floor`)
      if (chipRect.y < 0 || chipRect.y + chipRect.h > page.viewport().height) bad.push(`update chip at y=${chipRect.y} h=${chipRect.h} is off screen`)
      const occ = async (where) => {
        const out = await page.evaluate(() => {
          const o = []
          for (const el of document.querySelectorAll('[data-tap]')) {
            const b = el.getBoundingClientRect()
            if (!b.width || !b.height || !el.offsetParent) continue
            const cx = b.left + b.width / 2, cy = b.top + b.height / 2
            // A centre outside the viewport is a scrolled page, not an overlay; the chip is
            // position:fixed, so it can only ever cover something the viewport already shows.
            if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) continue
            const hit = document.elementFromPoint(cx, cy)
            if (hit && hit !== el && !el.contains(hit)) o.push((el.dataset.key || el.dataset.floor || el.dataset.nav || el.tagName) + ' <- #' + (hit.id || hit.className))
          }
          return o
        })
        if (out.length) bad.push(`the update chip occludes at ${where}: ${out.join('; ')}`)
      }
      await occ('lobby')
      await click('[data-nav="ride"]')
      if ((await attr(page, '#app', 'data-screen')) === 'rules') { await occ('rules'); await click('.rules [data-continue]') }
      await waitPhaseIn(page, ['floor'])
      await occ('floor')
      await shot('chip-floor')
      await click(`button[data-floor="${label((await slim(page)).ride.target)}"]`)
      await waitPhaseIn(page, ['keypad'])
      await occ('keypad')
      await shot('chip-keypad')
      seen.push(`chip(${chipRect.w}x${chipRect.h} at ${chipRect.x},${chipRect.y})`)
      if (bad.length) throw new Error(bad.join(' ;; '))
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

// THE UNRECOVERABLE TRAP, in a real browser (r1-math-01). A Megatall sum whose answer is negative,
// missed twice: the fall drops the step 3 → 2, and the panel used to derive its ± key from the
// level AND STEP rather than from the problem it is showing. The child came back to a keypad that
// could not express the answer to the sum on its own display — no escape, no message, for ever.
scenarios.push({
  name: 'fall-negative',
  async run(ctx) {
    const { page, shot } = ctx
    await load(ctx)
    await tap(page, '[data-nav="picker"]'); await waitScreen(page, 'picker')
    await tap(page, 'button[data-level="megatall"]')
    await waitFor(page, () => window.__bacon.state().level === 'megatall', 'the Megatall level')
    await tap(page, '[data-nav="lobby"]'); await waitScreen(page, 'lobby')
    await startRide(page)
    // play correctly until a negative-answer sum comes up (Megatall step 3 draws them)
    let problem = null
    for (let guard = 0; guard < 60 && !problem; guard++) {
      const s = await slim(page)
      if (s.phase === 'trivia') { await answerTrivia(page, true); continue }
      if (s.phase === 'roof') { await tap(page, '[data-next]'); await waitPhaseIn(page, ['floor']); continue }
      if (s.phase === 'floor') { await tap(page, `button[data-floor="${label(s.ride.target)}"]`); await waitPhaseIn(page, ['keypad']); continue }
      if (s.phase !== 'keypad') throw new Error('fall-negative stuck at ' + s.phase)
      if (s.ride.problem.answer < 0) { problem = s.ride.problem; break }
      await enter(page)
      await waitPhaseIn(page, ['floor', 'trivia', 'roof'])
    }
    expect(problem, 'no negative-answer sum in 60 Megatall questions')
    const trayBefore = await num(page, '#tray')
    const stepBefore = (await slim(page)).step
    // miss it twice: the calm line, then the fall
    await enter(page, 0)
    await wait(60)
    await enter(page, 0)
    await waitPhaseIn(page, ['repair'], 6000)
    await shot('negative-repair')
    const after = await slim(page)
    expect(after.ride.problem.key === problem.key, 'the retry must ask the same sum')
    // THE ASSERTION: the keypad can express the answer to the sum it is showing
    await tap(page, 'button[data-continue]')
    await waitPhaseIn(page, ['keypad'])
    const sign = await page.$eval('#panel button[data-key="sign"]', (b) => { const r = b.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) } }).catch(() => null)
    expect(sign, `no ± key for ${problem.text} (answer ${problem.answer}) at step ${after.step} — the sum cannot be entered at all`)
    expect(sign.w >= 48 && sign.h >= 48, `± key is ${sign.w}×${sign.h}`)
    await shot('negative-keypad')
    await enter(page, problem.answer)
    await waitPhaseIn(page, ['moving'], 4000)
    await waitPhaseIn(page, ['floor', 'trivia', 'roof'], 8000)
    const end = await slim(page)
    expect(await num(page, '#tray') >= trayBefore, 'the tray went backwards on the recovery')
    return `${problem.text.replace('▮', String(problem.answer))} missed twice at step ${stepBefore} → step ${after.step}, ± still on the keypad, rode to ${end.ride.floor}`
  },
})

// ---- round 2 -----------------------------------------------------------------------------------

// r2-elevator-feel-01. THE DOOR-OPEN KEY MAY NOT BE LIT WHEN IT CANNOT ACT.
// `◁▷` re-opens CLOSING doors, and doorFlags asked shaft.doorsClosingNow(), which compares the last
// DRAWN elapsed against the door step's end. main.js fired the timeline's steps BEFORE advancing
// that clock, so the two re-renders at `doors-closed` and `move-start` both read the previous
// frame's value and re-armed the key on the very frame the doors finished: measured at 390 x 664,
// enabled from 707 ms to 2662 ms of a 2733 ms ride, dead for the last ~1.6 s of it, and greying
// itself out the moment it was pressed. This runs at TIMESCALE 1 — the defect is a one-frame
// ordering bug and ?fast=1 compresses the whole ride into 270 ms.
scenarios.push({
  name: 'door-interlock',
  async run(ctx) {
    const { page, shot } = ctx
    await ctx.goto('?drive=1&seed=7&reset=1')
    await waitFor(page, () => window.__bacon && window.__bacon.state().pool.length > 0, 'the fact pool')
    await startRide(page)
    const p = await press(page)
    await enter(page, p.answer)
    await waitPhaseIn(page, ['moving'], 4000)
    const samples = []
    const t0 = Date.now()
    while (Date.now() - t0 < 4000) {
      const s = await page.evaluate(() => {
        const b = document.querySelector('#panel button[data-door="open"]')
        return {
          open: b ? !b.disabled : null,
          doors: (document.getElementById('doors') || {}).dataset ? document.getElementById('doors').dataset.state : null,
          phase: window.__bacon.state().phase,
          closing: !!window.__bacon.doorsClosing(),
        }
      })
      samples.push(s)
      if (s.phase !== 'moving') break
      await wait(40)
    }
    const lit = samples.filter((s) => s.open === true)
    const litDead = lit.filter((s) => !s.closing)
    expect(samples.some((s) => s.open === true && s.closing), 'the reopen window never opened at all, so this proves nothing')
    expect(litDead.length === 0, `the ◁▷ key was lit in ${litDead.length} of ${samples.length} frames where it could do nothing (doors ${[...new Set(litDead.map((s) => s.doors))].join('/')})`)
    // and every other key on the panel is honestly dead while the car moves
    const mid = samples.find((s) => s.phase === 'moving' && s.doors === 'closed')
    expect(mid, 'the car never reached a closed-door moving frame')
    await shot('mid-ride')
    return `${samples.length} frames sampled at timescale 1: ◁▷ lit only inside the ${lit.length}-frame reopen window`
  },
})

// r2-code-hostile-01. TWO TABS OF THE GAME MUST NOT WIPE THE LUNCHBOX.
// A second tab opened from a bookmark and never touched still holds the snapshot it booted with,
// and save() runs on visibilitychange and pagehide: measured, three buildings of play (lunchbox 48)
// were overwritten with lunchbox 0 by a tab in which nothing was ever tapped.
scenarios.push({
  name: 'two-tabs',
  async run(ctx) {
    const { page } = ctx
    const browser = page.browser()
    await ctx.goto('?drive=1&seed=7&fast=1&reset=1')
    await waitFor(page, () => window.__bacon && window.__bacon.state().pool.length > 0, 'the fact pool')
    // the STALE tab: opened now, holding lunchbox 0, and never touched again
    const stale = await browser.newPage()
    await stale.setViewport(ctx.phone.viewport)
    await stale.goto(ctx.url + '?drive=1&seed=7&fast=1', { waitUntil: 'load' })
    await stale.waitForFunction(() => !!window.__bacon, { timeout: 8000 })
    // …now play, in the first tab
    await page.bringToFront()
    await startRide(page)
    for (let i = 0; i < 6; i++) {
      const s = await slim(page)
      if (s.phase === 'trivia') { await answerTrivia(page, true); continue }
      if (s.phase === 'roof') { await tap(page, '[data-next]'); await waitPhaseIn(page, ['floor']); continue }
      await rideOne(page)
    }
    const played = await page.evaluate(() => JSON.parse(localStorage.getItem('bacon-elevator.save.v1')))
    expect(played.lunchbox + played.ride.tray > 0, 'the played tab banked nothing, so this proves nothing')
    // switch to the untouched tab and away again — no taps at all. The ORDER matters: the last
    // transition must be the STALE tab going hidden, which is the write that used to land on top.
    await stale.bringToFront(); await wait(400)
    await page.bringToFront(); await wait(600)
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('bacon-elevator.save.v1')))
    await stale.close()
    expect(after.lunchbox >= played.lunchbox, `an untouched tab took the lunchbox from ${played.lunchbox} to ${after.lunchbox}`)
    expect((after.ride ? after.ride.tray : 0) >= played.ride.tray, `an untouched tab took the tray from ${played.ride.tray} to ${after.ride ? after.ride.tray : null}`)
    expect(after.buildings >= played.buildings, 'an untouched tab rolled the building count back')
    return `played lunchbox ${played.lunchbox} tray ${played.ride.tray}; after a stale tab was fronted twice, lunchbox ${after.lunchbox} tray ${after.ride ? after.ride.tray : 0} (writes ${after.writes})`
  },
})

// r2-code-hostile-02. A REFUSED WRITE IS SAID OUT LOUD.
// storage.js catches the throw and falls back to an in-memory map, which keeps the SESSION working
// — and main.js discarded the boolean, so the child played a whole session and the lunchbox was 0
// on the next load with nothing on any screen to say so, and the save code (the one thing that
// would have rescued it) never pointed at. Reachable in Safari's Block All Cookies and on a full quota.
scenarios.push({
  name: 'storage-refused',
  async run(ctx) {
    const { page, shot } = ctx
    await page.evaluateOnNewDocument(() => {
      const real = Storage.prototype.setItem
      Storage.prototype.setItem = function (k, v) {
        if (String(k).startsWith('bacon-elevator')) throw new DOMException('QuotaExceededError', 'QuotaExceededError')
        return real.call(this, k, v)
      }
    })
    await ctx.goto('?drive=1&seed=7&fast=1')
    await waitFor(page, () => window.__bacon && window.__bacon.state().pool.length > 0, 'the fact pool')
    await startRide(page)
    await rideOne(page); await rideOne(page)
    await tap(page, '.topbar [data-nav="lobby"]'); await waitScreen(page, 'lobby')
    await shot('lobby-no-storage')
    const notice = await page.$eval('.lobby #storagemsg', (e) => e.textContent.trim()).catch(() => null)
    expect(notice, 'a browser that refuses to keep the score says nothing about it on the lobby')
    expect(/not keeping the score/.test(notice), 'the notice does not say what happened: ' + notice)
    expect(/Save code/i.test(notice), 'the notice does not point at the one thing that rescues it: ' + notice)
    // …and Grown-ups carries it too, beside the save code itself
    await tap(page, '[data-gear]'); await tap(page, '[data-gear]'); await waitScreen(page, 'grownups')
    expect(await page.$('#storagemsg'), 'Grown-ups does not carry the notice')
    await shot('grownups-no-storage')
    // the game itself keeps working: the in-memory fallback is the documented design
    const s = await slim(page)
    expect(s.ride && s.ride.tray >= 2, 'the session stopped working, which is not the fallback the design asks for')
    return `two floors played with every write refused; the lobby and Grown-ups both say so: "${notice.slice(0, 48)}…"`
  },
})

// r2-autism-fit-03: the only route back to the rules was an unlabelled bell on the panel, in floor
// mode, with the car standing still. r2-math-03: ▲ and ▼ are operators the game never defined.
scenarios.push({
  name: 'rules-route',
  async run(ctx) {
    const { page, shot } = ctx
    await load(ctx)
    // play one ride, so the card has been seen and the first-ride route is spent
    await startRide(page)
    await rideOne(page)
    await tap(page, '.topbar [data-nav="lobby"]'); await waitScreen(page, 'lobby')
    expect(await page.$('.lobby [data-nav="rules"]'), 'the lobby offers no route back to the rules')
    await tap(page, '.lobby [data-nav="rules"]'); await waitScreen(page, 'rules')
    const body = await text(page, '.rules .body')
    for (const t of ['How it works', "A passenger's question never falls.", 'Bacon is never lost. There is no clock.', 'tray', 'lunchbox', '▲', '▼']) {
      expect(body.includes(t), `the rules card no longer says "${t}"`)
    }
    await shot('rules-from-lobby')
    await tap(page, '.rules [data-continue]'); await waitScreen(page, 'lobby')
    expect((await slim(page)).phase === 'lobby', 'the rules card left the child on the ride screen with the reducer in the lobby')
    // …and the bell key carries a word, not only a glyph
    await tap(page, '[data-nav="ride"]'); await waitScreen(page, 'ride'); await waitPhaseIn(page, ['floor'])
    const bell = await page.$eval('#panel [data-bell]', (b) => b.textContent.trim())
    expect(/[A-Za-z]/.test(bell), `the bell key is still a bare glyph: "${bell}"`)
    // the ▲ / ▼ gloss rides under the sum, where the glyph is
    let gloss = null
    for (let i = 0; i < 30 && !gloss; i++) {
      const s = await slim(page)
      if (s.phase === 'roof') { await tap(page, '[data-next]'); await waitPhaseIn(page, ['floor']); continue }
      if (s.phase === 'trivia') { await answerTrivia(page, true); continue }
      if (s.phase === 'floor') { await press(page); continue }
      const p = (await slim(page)).ride.problem
      if (p.kind === 'up' || p.kind === 'down') {
        const msg = await text(page, '#message')
        expect(/means go (up|down)/.test(msg), `${p.text} is on screen and the band says "${msg}"`)
        gloss = msg
        await shot('arrow-gloss')
        break
      }
      await enter(page, p.answer)
      await waitPhaseIn(page, ['floor', 'trivia', 'roof'])
    }
    expect(gloss, 'no ▲ or ▼ sum came up in 30 questions, so the gloss was never tested')
    return `lobby → How it works → lobby; bell reads "${bell}"; the gloss reads "${gloss}"`
  },
})

// The round-2 panel and chip niceties, in one pass: a lit hall call, a disabled key that still
// answers the press, a paired keyboard, a dismissible chip, and a fact card that shows there is
// more to read.
scenarios.push({
  name: 'round2-dom',
  async run(ctx) {
    const { page, shot } = ctx
    await load(ctx)
    await startRide(page)

    // r2-elevator-feel-07: a disabled floor key gave NOTHING — no press state, no sound, no line —
    // so hammering 9 at G (the first thing an elevator-loving child does) read as a dead screen.
    const before = await text(page, '#message')
    await page.evaluate(() => {
      const b = document.querySelector('button[data-floor="9"]')
      const r = b.getBoundingClientRect()
      document.getElementById('app').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }))
    })
    await wait(120)
    const answered = await text(page, '#message')
    expect(answered !== before && /not the next stop/.test(answered), `a dead floor key answered with "${answered}"`)
    expect((await slim(page)).phase === 'floor', 'a dead key must stay inert: it may say something, never do something')
    await wait(1500)
    expect((await text(page, '#message')) === before, 'the answer must go away again: ' + await text(page, '#message'))

    // r2-elevator-feel-05: the hall calls were two white circles nothing ever wrote to.
    const callFill = () => page.evaluate(() => {
      const g = [...document.querySelectorAll('#shaft .landing')].find((x) => x.dataset.floor === '1')
      return g ? [...g.querySelectorAll('circle')].map((c) => c.getAttribute('fill')) : null
    })
    const dark = await callFill()
    await tap(page, 'button[data-floor="1"]')
    await waitPhaseIn(page, ['keypad'])
    const litCalls = await callFill()
    expect(dark && litCalls, 'no landing 1 in the shaft')
    expect(JSON.stringify(dark) !== JSON.stringify(litCalls), `the registered call never lit the landing: ${JSON.stringify(dark)}`)
    expect(litCalls.some((f) => f === '#E8B04A'), 'the lit hall call is not the amber the lantern uses: ' + litCalls.join(','))
    await shot('hall-call')

    // r2-code-hostile-10: a paired keyboard could Tab and Enter its way around but could not type.
    const p = (await slim(page)).ride.problem
    for (const ch of String(Math.abs(p.answer))) await page.keyboard.press('Digit' + ch)
    expect((await slim(page)).ride.typed === String(Math.abs(p.answer)), 'the keyboard typed nothing: ' + (await slim(page)).ride.typed)
    await page.keyboard.press('Backspace')
    expect((await slim(page)).ride.typed.length === String(Math.abs(p.answer)).length - 1, 'Backspace did nothing')
    for (const ch of String(Math.abs(p.answer)).slice(-1)) await page.keyboard.press('Digit' + ch)
    await page.keyboard.press('Enter')
    await waitPhaseIn(page, ['moving', 'floor', 'trivia'], 4000)
    await waitPhaseIn(page, ['floor', 'trivia', 'roof'], 8000)
    expect((await slim(page)).ride.floor === 1, 'Enter did not send the answer')

    // r2-autism-fit-04: the fact card's sources fall below the fold on a 320 px phone and the
    // `Got it` bar sits flush against the cut, which reads as the end of the card.
    await rideTo(page, 4)
    let st = await slim(page)
    expect(st.phase === 'trivia', 'floor 4 should bring a passenger, got ' + st.phase)
    await tap(page, `button[data-choice="${st.trivia.answer}"]`)
    await waitPhaseIn(page, ['fact'])
    await waitFor(page, () => !!document.querySelector('#sheet .fact'), 'the fact sheet')
    const sheet = await page.evaluate(() => {
      const b = document.querySelector('#sheet .fact .body')
      return { scrolls: b.scrollHeight > b.clientHeight + 1, bg: getComputedStyle(b).backgroundImage, h: b.clientHeight, sh: b.scrollHeight }
    })
    expect(/radial-gradient/.test(sheet.bg), 'the fact card carries no scroll cue at all')
    await shot('fact-cue')

    // r2-mobile-ux-005 / r2-deploy-pages-04: the chip stays until it is answered, so it needs a way
    // to be answered with `not now`, and its words are the child's, not a developer's.
    await ctx.goto(Q + '&chip=1&reset=1')
    await waitFor(page, () => window.__bacon && window.__bacon.state().pool.length > 0, 'the fact pool')
    await waitFor(page, () => !!document.getElementById('update-chip'), 'the update chip')
    const chipText = await text(page, '#update-chip .chip-take')
    expect(!/reload|update ready/i.test(chipText), `the chip still speaks developer: "${chipText}"`)
    expect(/tap/i.test(chipText), `the chip does not say what to do: "${chipText}"`)
    const later = await page.$('#update-chip [data-update-dismiss]')
    expect(later, 'the chip cannot be put away')
    const lr = await later.boundingBox()
    expect(lr.width >= 44 && lr.height >= 44, `the dismiss control is ${Math.round(lr.width)}x${Math.round(lr.height)}`)
    await shot('chip')
    await later.tap()
    await wait(200)
    expect(await page.$('#update-chip') === null, 'the chip survived being dismissed')
    // …and it stays away for the rest of the session
    await tap(page, '[data-nav="picker"]'); await waitScreen(page, 'picker')
    await tap(page, '[data-nav="lobby"]'); await waitScreen(page, 'lobby')
    expect(await page.$('#update-chip') === null, 'the chip came back after it was put away')
    return `dead key answers; hall call lights ${litCalls.filter((f) => f === '#E8B04A').length}; keyboard typed and sent; fact card ${sheet.sh}/${sheet.h} with a cue; chip "${chipText}" dismissible`
  },
})
