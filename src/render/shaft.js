// The shaft: an inline SVG cut-away of the Bacon Building, scrolled to keep the car centred.
// Timelines are played by main.js; this module is told begin/event/frame/end and draws.
import { positionAt, DURATIONS, label } from '../elevator.js'
import { isPassengerFloor } from '../trivia.js'

const NS = 'http://www.w3.org/2000/svg'
const FH = 96                        // floor pitch in world units
const W = 300                        // world width
const TOP = -70                      // machine room top
const BOTTOM = 1190                  // pit floor bottom
const CAR_H = 88, CAR_X = 125, CAR_W = 110
const OPEN_X = 140, OPEN_W = 80, OPEN_Y = 34, OPEN_H = 50
const PIT_REST = 1148                // where the car bottom rests on the squashed spikes
const SHEAVE = { x: 180, y: -30, r: 22 }

export const sillOf = (f) => 1056 - f * FH
const carBottom = (pos) => (pos <= -1 ? PIT_REST : pos < 0 ? sillOf(0) + (PIT_REST - sillOf(0)) * -pos : sillOf(pos))

function el(name, attrs = {}, children = []) {
  const e = document.createElementNS(NS, name)
  for (const k of Object.keys(attrs)) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, String(attrs[k]))
  for (const c of children) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c)
  return e
}
const text = (x, y, str, attrs = {}) => el('text', { x, y, 'text-anchor': 'middle', 'font-family': 'system-ui, sans-serif', 'font-weight': 700, ...attrs }, [str])
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// 5×7 dot-matrix glyphs for the Workshop's dot-matrix indicator.
const DOTS = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  '▲': ['00000', '00100', '01110', '11111', '00000', '00000', '00000'],
  '▼': ['00000', '00000', '00000', '11111', '01110', '00100', '00000'],
}

export function createShaft(container, opts = {}) {
  const svg = el('svg', { viewBox: `0 ${TOP} ${W} 240`, preserveAspectRatio: 'xMidYMid slice', 'aria-hidden': 'true', focusable: 'false' })
  container.appendChild(svg)

  // ---- static world ------------------------------------------------------------------
  const world = el('g', { class: 'world' })
  svg.appendChild(world)
  // building face + shaft
  world.appendChild(el('rect', { x: -W, y: TOP, width: W * 3, height: BOTTOM - TOP, fill: '#D9D4C7' }))
  world.appendChild(el('rect', { x: 110, y: 0, width: 140, height: BOTTOM, fill: '#C6C0B1' }))
  world.appendChild(el('line', { x1: 119, y1: 0, x2: 119, y2: sillOf(-1) + 20, stroke: '#8A8578', 'stroke-width': 3 }))
  world.appendChild(el('line', { x1: 241, y1: 0, x2: 241, y2: sillOf(-1) + 20, stroke: '#8A8578', 'stroke-width': 3 }))
  world.appendChild(el('line', { x1: 267, y1: 0, x2: 267, y2: sillOf(-1) + 20, stroke: '#8A8578', 'stroke-width': 2, 'stroke-dasharray': '6 6' }))
  // machine room
  world.appendChild(el('rect', { x: 110, y: TOP, width: 140, height: 70, fill: '#CFC9BA', stroke: '#6B6B6B', 'stroke-width': 3 }))
  world.appendChild(el('rect', { x: 205, y: -52, width: 36, height: 34, rx: 4, fill: '#8A8578', stroke: '#6B6B6B', 'stroke-width': 3 }))
  world.appendChild(el('circle', { cx: SHEAVE.x, cy: SHEAVE.y, r: SHEAVE.r, fill: '#B9B3A4', stroke: '#6B6B6B', 'stroke-width': 3 }))
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 4
    world.appendChild(el('line', { x1: SHEAVE.x - Math.cos(a) * 18, y1: SHEAVE.y - Math.sin(a) * 18, x2: SHEAVE.x + Math.cos(a) * 18, y2: SHEAVE.y + Math.sin(a) * 18, stroke: '#6B6B6B', 'stroke-width': 2 }))
  }
  world.appendChild(el('circle', { cx: SHEAVE.x, cy: SHEAVE.y, r: 5, fill: '#6B6B6B' }))
  world.appendChild(el('rect', { x: 110, y: -2, width: 50, height: 6, fill: '#8A8578' }))
  world.appendChild(el('rect', { x: 200, y: -2, width: 50, height: 6, fill: '#8A8578' }))

  // THE CROP GUARD. The camera keeps the car centred, so its edge falls wherever it falls; a glyph
  // it would cut in half is hidden instead of shown as half a glyph (see scrollTo). Registration is
  // by WORLD BAND, not by measuring: an SVG child scrolled out of the viewBox still reports a
  // getBoundingClientRect on screen. It writes a CLASS, never the visibility attribute — the bacon
  // plates already have a writer on that attribute (collected bacon) and two writers would fight.
  const cropGuard = []
  const guard = (node, top, bottom) => { cropGuard.push({ node, top, bottom }); return node }

  const landings = new Map()
  for (let f = 0; f <= 10; f++) {
    const s = sillOf(f)
    const g = el('g', { class: 'landing', 'data-floor': label(f) })
    // hall (cut-away) and slab
    g.appendChild(el('rect', { x: 0, y: s - FH + 8, width: 110, height: FH - 8, fill: f === 10 ? '#EAF0E8' : '#EFEBE1' }))
    g.appendChild(el('rect', { x: 0, y: s, width: 110, height: 8, fill: '#B9B3A4', stroke: '#6B6B6B', 'stroke-width': 2 }))
    g.appendChild(el('rect', { x: 250, y: s, width: 50, height: 8, fill: '#B9B3A4', stroke: '#6B6B6B', 'stroke-width': 2 }))
    // floor plate
    g.appendChild(el('rect', { x: 10, y: s - 78, width: 30, height: 20, rx: 3, fill: '#fff', stroke: '#6B6B6B', 'stroke-width': 2 }))
    g.appendChild(text(25, s - 63, label(f), { 'font-size': 14, fill: '#2B2B2B' }))
    // hall calls (▲ ▼) and the lantern above them
    // The hall calls are the other half of the lantern pair: a registered call glows until the car
    // answers it. They used to be two white circles nothing ever wrote to, on every landing, for ever.
    const callUp = f < 10 ? el('circle', { cx: 98, cy: s - 44, r: 5, fill: '#fff', stroke: '#6B6B6B', 'stroke-width': 2 }) : null
    const callDown = f > 0 ? el('circle', { cx: 98, cy: s - 30, r: 5, fill: '#fff', stroke: '#6B6B6B', 'stroke-width': 2 }) : null
    if (callUp) g.appendChild(callUp)
    if (callDown) g.appendChild(callDown)
    const lantern = el('g', { class: 'lantern' })
    lantern.appendChild(el('rect', { x: 88, y: s - 76, width: 20, height: 14, rx: 3, fill: '#CFC9BA', stroke: '#6B6B6B', 'stroke-width': 2 }))
    const glyph = text(98, s - 65, '▲', { 'font-size': 10, fill: '#8A8578' })
    lantern.appendChild(glyph)
    g.appendChild(lantern)
    // bacon plate (floors 1–9) or the roof picnic
    let plate = null, waiter = null
    if (f >= 1 && f <= 9) {
      plate = el('g', { class: 'plate' })
      plate.appendChild(el('ellipse', { cx: 58, cy: s - 4, rx: 24, ry: 6, fill: '#fff', stroke: '#6B6B6B', 'stroke-width': 2 }))
      const use = el('use', { href: '#bacon', x: 40, y: s - 22, width: 36, height: 18 })
      use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#bacon')
      plate.appendChild(use)
      g.appendChild(plate)
      waiter = el('g', { class: 'waiter' })
      waiter.appendChild(el('circle', { cx: 78, cy: s - 52, r: 8, fill: '#8A8578' }))
      waiter.appendChild(el('path', { d: `M66 ${s} v-30 a12 12 0 0 1 24 0 v30 z`, fill: '#8A8578' }))
      g.appendChild(waiter)
    }
    if (f === 10) {
      g.appendChild(el('rect', { x: 12, y: s - 14, width: 84, height: 14, fill: '#E9DFC8', stroke: '#6B6B6B', 'stroke-width': 2 }))
      for (let i = 0; i < 6; i++) g.appendChild(el('rect', { x: 12 + i * 14, y: s - 14 + (i % 2) * 7, width: 14, height: 7, fill: '#C9694A', opacity: 0.35 }))
      g.appendChild(el('rect', { x: 26, y: s - 34, width: 30, height: 20, rx: 3, fill: '#4A7BAA', stroke: '#35618A', 'stroke-width': 2 }))
      g.appendChild(el('rect', { x: 30, y: s - 40, width: 22, height: 8, rx: 2, fill: '#35618A' }))
      const use = el('use', { href: '#bacon', x: 60, y: s - 30, width: 32, height: 16 })
      use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#bacon')
      g.appendChild(use)
      g.appendChild(text(54, s - 84, 'ROOF', { 'font-size': 12, fill: '#55534E' }))
    }
    world.appendChild(g)
    if (plate) guard(plate, sillOf(f) - 23, sillOf(f) + 3)
    landings.set(f, { g, lantern, glyph, lanternRect: lantern.firstChild, plate, waiter, callUp, callDown })
  }

  // pit: buffer springs and grey round-tipped spikes on springs
  const pit = el('g', { class: 'pit' })
  const pitTop = sillOf(0) + 8
  pit.appendChild(el('rect', { x: 110, y: pitTop, width: 140, height: BOTTOM - pitTop, fill: '#B5AF9F' }))
  pit.appendChild(el('rect', { x: 0, y: PIT_REST, width: 110, height: BOTTOM - PIT_REST, fill: '#B9B3A4', stroke: '#6B6B6B', 'stroke-width': 2 }))
  pit.appendChild(el('rect', { x: 0, y: pitTop, width: 110, height: PIT_REST - pitTop, fill: '#E4DFD3' }))
  pit.appendChild(el('rect', { x: 250, y: pitTop, width: 50, height: BOTTOM - pitTop, fill: '#CFC9BA' }))
  const pitSign = el('g', { class: 'sign' })
  pitSign.appendChild(el('rect', { x: 20, y: PIT_REST - 60, width: 60, height: 22, rx: 3, fill: '#fff', stroke: '#6B6B6B', 'stroke-width': 2 }))
  pitSign.appendChild(text(50, PIT_REST - 44, 'PIT', { 'font-size': 14, fill: '#2B2B2B' }))
  pit.appendChild(guard(pitSign, PIT_REST - 62, PIT_REST - 36))
  const pPlate = el('g', { class: 'sign' })
  pPlate.appendChild(el('rect', { x: 10, y: PIT_REST - 98, width: 30, height: 20, rx: 3, fill: '#fff', stroke: '#6B6B6B', 'stroke-width': 2 }))
  pPlate.appendChild(text(25, PIT_REST - 83, 'P', { 'font-size': 14, fill: '#2B2B2B' }))
  pit.appendChild(guard(pPlate, PIT_REST - 100, PIT_REST - 76))
  pit.appendChild(el('rect', { x: 110, y: BOTTOM - 12, width: 140, height: 12, fill: '#8A8578' }))
  const spring = (x, y0, y1, w = 8) => {
    const n = 5, seg = (y1 - y0) / n
    let d = `M${x} ${y0}`
    for (let i = 0; i < n; i++) d += ` L${x + (i % 2 ? -w : w)} ${y0 + seg * (i + 0.5)}`
    d += ` L${x} ${y1}`
    return el('path', { d, fill: 'none', stroke: '#6B6B6B', 'stroke-width': 3, 'stroke-linejoin': 'round' })
  }
  const buffers = el('g', { class: 'buffers' })
  buffers.appendChild(spring(132, BOTTOM - 46, BOTTOM - 12, 6))
  buffers.appendChild(spring(228, BOTTOM - 46, BOTTOM - 12, 6))
  buffers.appendChild(el('rect', { x: 124, y: BOTTOM - 52, width: 16, height: 6, fill: '#6B6B6B' }))
  buffers.appendChild(el('rect', { x: 220, y: BOTTOM - 52, width: 16, height: 6, fill: '#6B6B6B' }))
  pit.appendChild(guard(buffers, BOTTOM - 54, BOTTOM - 10))
  const spikes = el('g', { class: 'spikes' })
  const SPIKE_BASE = BOTTOM - 12, SPIKE_H = 40
  for (let i = 0; i < 5; i++) {
    const x = 148 + i * 16
    const one = el('g', { transform: `translate(${x} ${SPIKE_BASE})` })
    one.appendChild(spring(0, -14, 0, 4))
    const cone = el('g', { class: 'cone' })
    cone.appendChild(el('path', { d: `M-7 -14 L0 ${-SPIKE_H} L7 -14 Z`, fill: '#9A9A9A', stroke: '#6B6B6B', 'stroke-width': 2, 'stroke-linejoin': 'round' }))
    cone.appendChild(el('circle', { cx: 0, cy: -SPIKE_H, r: 3.5, fill: '#9A9A9A', stroke: '#6B6B6B', 'stroke-width': 2 }))
    one.appendChild(cone)
    spikes.appendChild(one)
  }
  pit.appendChild(guard(spikes, SPIKE_BASE - SPIKE_H - 2, SPIKE_BASE + 2))
  world.appendChild(pit)

  // ---- moving parts -----------------------------------------------------------------
  const cwRope = el('path', { fill: 'none', stroke: '#55534E', 'stroke-width': 2 })
  const ropeA = el('path', { fill: 'none', stroke: '#55534E', 'stroke-width': 2 })
  const ropeB = el('path', { fill: 'none', stroke: '#55534E', 'stroke-width': 2 })
  svg.appendChild(cwRope); svg.appendChild(ropeA); svg.appendChild(ropeB)
  const counterweight = el('rect', { x: 258, y: 0, width: 18, height: 60, rx: 2, fill: '#7A7568', stroke: '#55534E', 'stroke-width': 2 })
  svg.appendChild(counterweight)

  const car = el('g', { id: 'car', 'data-motion': 'idle' })
  const carInner = el('g')
  car.appendChild(carInner)
  carInner.appendChild(el('rect', { x: CAR_X, y: -CAR_H, width: CAR_W, height: CAR_H, rx: 4, fill: '#E9E4D8', stroke: '#6B6B6B', 'stroke-width': 3 }))
  carInner.appendChild(el('rect', { x: OPEN_X, y: -CAR_H + OPEN_Y, width: OPEN_W, height: OPEN_H, fill: '#F8F5EE', stroke: '#6B6B6B', 'stroke-width': 2 }))
  const rider = el('g', { class: 'rider', visibility: 'hidden' })
  rider.appendChild(el('circle', { cx: 192, cy: -CAR_H + OPEN_Y + 14, r: 8, fill: '#8A8578' }))
  rider.appendChild(el('path', { d: `M180 ${-CAR_H + OPEN_Y + OPEN_H} v-22 a12 12 0 0 1 24 0 v22 z`, fill: '#8A8578' }))
  carInner.appendChild(rider)
  // The collected strip rides inside the car (behind the doors) until the next ride starts — through
  // a fall too, so "no bacon is ever lost" is shown, not just said.
  const carStrip = el('use', { class: 'strip', href: '#bacon', x: 143, y: -CAR_H + OPEN_Y + 27, width: 34, height: 17, visibility: 'hidden' })
  carStrip.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#bacon')
  carInner.appendChild(carStrip)
  const clip = el('clipPath', { id: 'door-clip' }, [el('rect', { x: OPEN_X, y: -CAR_H + OPEN_Y, width: OPEN_W, height: OPEN_H })])
  carInner.appendChild(clip)
  const doors = el('g', { id: 'doors', 'data-state': 'open', 'clip-path': 'url(#door-clip)' })
  const doorL = el('g'), doorR = el('g')
  for (const [g, x] of [[doorL, OPEN_X], [doorR, OPEN_X + OPEN_W / 2]]) {
    g.appendChild(el('rect', { x, y: -CAR_H + OPEN_Y, width: OPEN_W / 2, height: OPEN_H, fill: '#D9D4C7', stroke: '#6B6B6B', 'stroke-width': 2 }))
    g.appendChild(el('line', { x1: x + OPEN_W / 2 - (g === doorL ? 6 : OPEN_W / 2 - 6), y1: -CAR_H + OPEN_Y + 18, x2: x + OPEN_W / 2 - (g === doorL ? 6 : OPEN_W / 2 - 6), y2: -CAR_H + OPEN_Y + 32, stroke: '#6B6B6B', 'stroke-width': 3, 'stroke-linecap': 'round' }))
  }
  doors.appendChild(doorL); doors.appendChild(doorR)
  carInner.appendChild(doors)
  // indicator bezel
  const indicator = el('g', { id: 'indicator', 'data-floor': 'G', 'data-arrow': 'none' })
  indicator.appendChild(el('rect', { x: 135, y: -CAR_H + 6, width: 90, height: 22, rx: 3, fill: '#2B2B2B' }))
  const indDigits = el('g')
  const indText = text(172, -CAR_H + 23, 'G', { 'font-size': 18, fill: '#E8B04A', 'font-family': 'ui-monospace, Menlo, Consolas, monospace' })
  const indArrow = text(212, -CAR_H + 22, '', { 'font-size': 13, fill: '#E8B04A' })
  indicator.appendChild(indDigits); indicator.appendChild(indText); indicator.appendChild(indArrow)
  carInner.appendChild(indicator)
  svg.appendChild(car)

  // bacon in flight
  const flight = el('g', { class: 'flight', visibility: 'hidden' })
  const flightUse = el('use', { href: '#bacon', x: 0, y: 0, width: 36, height: 18 })
  flightUse.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#bacon')
  flight.appendChild(flightUse)
  svg.appendChild(flight)

  // ---- state ------------------------------------------------------------------------
  let reduced = false
  let vb = { w: W, h: 240 }
  let idle = { floor: 0, doorsOpen: 1, arrow: 'none', floorLabel: 'G' }
  let equipped = { doors: 'doors-centre', indicator: 'segment' }
  let anim = null
  let lit = null // lantern floor
  let called = null // the landing whose hall call is registered
  let lastIndicator = ''
  let riderIn = false
  let strip = false          // the last collected strip is in the car
  let stripPending = false   // the bacon step fired; the strip lands when its slide ends
  function setStrip(on) { strip = !!on; carStrip.setAttribute('visibility', strip ? 'visible' : 'hidden') }

  function resize() {
    const r = container.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) {
      // A short shaft cannot frame an 88-unit car at natural scale (82 px at 320 × 454 is 77 world
      // units), so the camera pulls back — capped at MAX_PULL — until MIN_WORLD units are in frame.
      // preserveAspectRatio is 'slice' and the box aspect is kept, so the visible world height is
      // exactly vb.h.
      const MIN_WORLD = 200, MAX_PULL = 2.4
      const natural = (W * r.height) / r.width
      if (natural >= MIN_WORLD) vb = { w: W, h: natural }
      else { const w = Math.min(W * MAX_PULL, (W * MIN_WORLD) / natural); vb = { w, h: (w * r.height) / r.width } }
    }
    // Below 64 px the shaft would be an unreadable stripe of cropped car. It keeps its box (it is
    // the flex spring, so no blank paper opens under the panel) and draws plain shaft wall instead.
    // The class does not change the box height, so main.js's ResizeObserver cannot oscillate.
    container.classList.toggle('tiny', r.height > 0 && r.height < 64)
    draw(anim ? anim.lastElapsed : null)
  }

  function setIndicator(fl, arrow) {
    const key = fl + '|' + arrow + '|' + equipped.indicator
    if (key === lastIndicator) return
    lastIndicator = key
    indicator.setAttribute('data-floor', fl)
    indicator.setAttribute('data-arrow', arrow)
    if (equipped.indicator === 'dotmatrix') {
      indText.textContent = ''
      indArrow.textContent = ''
      while (indDigits.firstChild) indDigits.removeChild(indDigits.firstChild)
      const chars = [fl, arrow === 'up' ? '▲' : arrow === 'down' ? '▼' : null].filter(Boolean)
      let x0 = 160 - (chars.length - 1) * 12
      for (const ch of chars) {
        const rows = DOTS[ch] || DOTS['0']
        rows.forEach((row, ry) => {
          for (let cx = 0; cx < 5; cx++) if (row[cx] === '1') indDigits.appendChild(el('circle', { cx: x0 + cx * 2.6, cy: -CAR_H + 9 + ry * 2.4, r: 1, fill: '#E8B04A' }))
        })
        x0 += 24
      }
    } else {
      while (indDigits.firstChild) indDigits.removeChild(indDigits.firstChild)
      indText.textContent = fl
      indArrow.textContent = arrow === 'up' ? '▲' : arrow === 'down' ? '▼' : ''
    }
  }

  function setHallCall(f, dir) {
    if (called !== null && landings.get(called)) {
      const L = landings.get(called)
      if (L.callUp) L.callUp.setAttribute('fill', '#fff')
      if (L.callDown) L.callDown.setAttribute('fill', '#fff')
    }
    called = null
    if (f === null || !landings.has(f)) return
    const L = landings.get(f)
    const btn = dir === 'down' ? L.callDown : L.callUp
    if (!btn) return
    btn.setAttribute('fill', '#E8B04A')
    called = f
  }

  function setLantern(f, dir) {
    if (lit !== null && landings.get(lit)) {
      const L = landings.get(lit)
      L.lanternRect.setAttribute('fill', '#CFC9BA'); L.glyph.setAttribute('fill', '#8A8578')
    }
    lit = null
    if (f === null || !landings.has(f)) return
    const L = landings.get(f)
    L.lanternRect.setAttribute('fill', dir === 'down' ? '#E8B04A' : '#FFF6DC')
    L.glyph.textContent = dir === 'down' ? '▼' : '▲'
    L.glyph.setAttribute('fill', '#2B2B2B')
    lit = f
  }

  // WHERE THE LEAVES ACTUALLY ARE, in pixels — not what the reducer believes. On a reopen mid-close
  // state.car.doors is still 'open', so seeding the animation from state snapped the leaves fully
  // open on the first frame and then held them there for the whole 500 ms step.
  let lastDoorPos = 1
  function setDoors(open) {
    const o = clamp(open, 0, 1)
    lastDoorPos = o
    if (equipped.doors === 'doors-telescopic') {
      doorL.setAttribute('transform', `translate(${-OPEN_W / 2 * o} 0)`)
      doorR.setAttribute('transform', `translate(${-OPEN_W * o} 0)`)
    } else {
      doorL.setAttribute('transform', `translate(${-OPEN_W / 2 * o} 0)`)
      doorR.setAttribute('transform', `translate(${OPEN_W / 2 * o} 0)`)
    }
  }

  function placeCar(pos, squash = 1, lift = 0, opacity = 1) {
    const y = carBottom(pos) - lift
    car.setAttribute('transform', `translate(0 ${y})`)
    carInner.setAttribute('transform', squash === 1 ? '' : `scale(1 ${squash})`)
    car.setAttribute('opacity', String(opacity))
    // counterweight rides opposite the car
    const cwTop = clamp(sillOf(9 - clamp(pos, -1, 10)) - 60, 10, sillOf(-1) - 40)
    counterweight.setAttribute('y', String(cwTop))
    cwRope.setAttribute('d', `M${SHEAVE.x + SHEAVE.r} ${SHEAVE.y} L267 ${SHEAVE.y} L267 ${cwTop}`)
    return y
  }

  function drawRopes(carTop, slack) {
    const yA = carTop, x1 = 165, x2 = 195
    if (slack > 0) {
      const sag = 26 * slack
      ropeA.setAttribute('d', `M${SHEAVE.x - 12} ${SHEAVE.y} Q${x1 - sag} ${(SHEAVE.y + yA) / 2} ${x1} ${yA}`)
      ropeB.setAttribute('d', `M${SHEAVE.x + 12} ${SHEAVE.y} Q${x2 + sag} ${(SHEAVE.y + yA) / 2} ${x2} ${yA}`)
    } else {
      ropeA.setAttribute('d', `M${SHEAVE.x - 12} ${SHEAVE.y - 4} L${x1} ${yA}`)
      ropeB.setAttribute('d', `M${SHEAVE.x + 12} ${SHEAVE.y - 4} L${x2} ${yA}`)
    }
  }

  function scrollTo(carBottomY) {
    const centre = carBottomY - CAR_H / 2
    const worldH = BOTTOM - TOP
    let y
    if (vb.h >= worldH) y = TOP - (vb.h - worldH) / 2
    // in the pit the camera sits on the world's floor, so the whole spike row is in frame for the
    // impact rather than cut across the middle of it
    else if (carBottomY >= PIT_REST - 1) y = BOTTOM - vb.h
    else y = clamp(centre - vb.h / 2, TOP, BOTTOM - vb.h)
    svg.setAttribute('viewBox', `${(W - vb.w) / 2} ${y} ${vb.w} ${vb.h}`)
    const camTop = y, camBot = y + vb.h
    for (const o of cropGuard) {
      const cut = (o.top < camTop && o.bottom > camTop) || (o.top < camBot && o.bottom > camBot)
      if (o.node.classList.contains('cropped') !== cut) o.node.classList.toggle('cropped', cut)
    }
  }

  function setSpikes(squash) {
    spikes.setAttribute('transform', squash === 1 ? '' : `translate(0 ${SPIKE_BASE}) scale(1 ${squash}) translate(0 ${-SPIKE_BASE})`)
  }

  // Draw the idle car (elapsed === null) or a frame of the running timeline.
  function draw(elapsed) {
    if (!anim || elapsed === null) {
      const y = placeCar(idle.floor, 1, 0, 1)
      drawRopes(y - CAR_H, 0)
      setDoors(idle.doorsOpen)
      setIndicator(idle.floorLabel, idle.arrow)
      setSpikes(idle.floor === -1 ? 0.35 : 1)
      scrollTo(y)
      return
    }
    anim.lastElapsed = elapsed
    const a = anim
    let pos = a.from, squash = 1, lift = 0, opacity = 1, slack = 0
    if (a.name === 'fall') {
      if (elapsed >= a.fallStart) {
        const p = clamp((elapsed - a.fallStart) / DURATIONS.fall, 0, 1)
        if (reduced) { pos = p >= 1 ? -1 : a.from; opacity = p >= 1 ? clamp((elapsed - a.impactAt) / DURATIONS.hold, 0, 1) : 1 - p }
        else { pos = a.from + (-1 - a.from) * p * p; slack = p < 1 ? 1 : clamp(1 - (elapsed - a.impactAt) / DURATIONS.impact, 0, 1) }
      }
      if (elapsed >= a.impactAt && !reduced) {
        const q = clamp((elapsed - a.impactAt) / DURATIONS.impact, 0, 1)
        // squash 10 %, one bounce, settle
        if (q < 0.25) { squash = 1 - 0.1 * (q / 0.25); setSpikes(1 - 0.65 * (q / 0.25)) }
        else if (q < 0.6) { const r = (q - 0.25) / 0.35; squash = 0.9 + 0.13 * Math.sin(r * Math.PI); lift = 8 * Math.sin(r * Math.PI); setSpikes(0.35 + 0.25 * Math.sin(r * Math.PI)) }
        else { squash = 1; setSpikes(0.35) }
      }
    } else if (a.moveStart !== null && elapsed >= a.moveStart) {
      if (reduced) pos = a.sillPassed !== null ? a.sillPassed : a.from
      else pos = positionAt(a.from, a.to, elapsed - a.moveStart, a.msPerFloor)
    }
    const y = placeCar(pos, squash, lift, opacity)
    drawRopes(y - CAR_H * squash, slack)
    // doors
    if (a.door) {
      const d = a.door
      const p = clamp((elapsed - d.t0) / Math.max(1, d.t1 - d.t0), 0, 1)
      setDoors(reduced ? (p >= 1 ? d.to : d.from) : d.from + (d.to - d.from) * ease(p))
    }
    // bacon slide
    if (a.baconAt !== null && elapsed >= a.baconAt) {
      const p = clamp((elapsed - a.baconAt) / DURATIONS.bacon, 0, 1)
      const s = sillOf(a.to)
      if (p < 1) {
        flight.setAttribute('visibility', 'visible')
        const x = 40 + (150 - 40) * ease(p), yy = s - 22 - 20 * Math.sin(p * Math.PI)
        flight.setAttribute('transform', `translate(${x} ${yy})`)
      } else {
        flight.setAttribute('visibility', 'hidden')
        if (stripPending) { stripPending = false; setStrip(true) }
      }
    }
    scrollTo(y)
  }

  const api = {
    el: svg,
    resize,
    setReduced(v) { reduced = !!v },
    // Idle render from state.
    setState(state) {
      equipped = { doors: state.equipped.doors, indicator: state.equipped.indicator }
      const r = state.ride
      const cleared = r ? r.cleared : []
      const done = r ? r.passengersDone : []
      for (const [f, L] of landings) {
        if (L.plate) L.plate.setAttribute('visibility', cleared.includes(f) ? 'hidden' : 'visible')
        if (L.waiter) L.waiter.setAttribute('visibility', isPassengerFloor(f, state.settings.passengers) && !done.includes(f) && !(riderIn && r && r.floor === f) ? 'visible' : 'hidden')
      }
      setHallCall(state.car.carCall === null || state.car.carCall === undefined ? null : state.car.carCall, state.phase === 'descending' ? 'down' : 'up')
      riderIn = state.phase === 'trivia' || state.phase === 'fact'
      rider.setAttribute('visibility', riderIn ? 'visible' : 'hidden')
      if (riderIn && r) { const L = landings.get(r.floor); if (L && L.waiter) L.waiter.setAttribute('visibility', 'hidden') }
      if (!r || !cleared.length) { stripPending = false; if (strip) setStrip(false) } // a fresh building: nothing collected yet
      if (!anim) {
        idle = { floor: state.car.floor, doorsOpen: state.car.doors === 'open' || state.car.doors === 'opening' ? 1 : 0, arrow: 'none', floorLabel: label(state.car.floor) }
        car.setAttribute('data-motion', 'idle')
        doors.setAttribute('data-state', state.car.doors)
        setLantern(null)
        flight.setAttribute('visibility', 'hidden')
        draw(null)
      }
    },
    begin(name, steps, duration, state) {
      const from = state.car.floor
      const arrive = steps.find((s) => s.ev === 'arrive')
      const move = steps.find((s) => s.ev === 'move-start')
      const fallStart = steps.find((s) => s.ev === 'fall-start')
      const impact = steps.find((s) => s.ev === 'impact')
      const bacon = steps.find((s) => s.ev === 'bacon')
      const to = arrive ? arrive.floor : name === 'fall' ? -1 : from
      anim = {
        name, steps, duration, from, to,
        msPerFloor: name === 'ride' ? DURATIONS.floor : DURATIONS.express,
        moveStart: move ? move.t : null,
        fallStart: fallStart ? fallStart.t : Infinity,
        impactAt: impact ? impact.t : Infinity,
        baconAt: bacon ? bacon.t : null,
        door: null,
        sillPassed: null,
        lastElapsed: 0,
      }
      anim.door = { from: lastDoorPos, to: lastDoorPos, t0: 0, t1: 1 }
      idle.doorsOpen = state.car.doors === 'open' || state.car.doors === 'opening' ? 1 : 0
      car.setAttribute('data-motion', name === 'fall' ? 'falling' : name === 'express' ? 'hoisting' : name === 'closeDoors' || name === 'openDoors' ? 'idle' : 'moving')
      if (name === 'fall') setIndicator(label(from), 'down')
      else if (name === 'descend') setIndicator(label(from), 'down')
      else if (name === 'ride' || name === 'express') setIndicator(label(from), 'up')
      draw(0)
    },
    event(step) {
      if (!anim) return
      const a = anim
      const nextOf = (ev) => a.steps.find((s) => s.t > step.t && s.ev === ev)
      switch (step.ev) {
        case 'doors-closing': { const n = nextOf('doors-closed'); a.door = { from: lastDoorPos, to: 0, t0: step.t, t1: n ? n.t : step.t + DURATIONS.doors }; doors.setAttribute('data-state', 'closing'); break }
        case 'doors-closed': doors.setAttribute('data-state', 'closed'); setLantern(null); break
        case 'doors-opening': { const n = nextOf('doors-open'); a.door = { from: lastDoorPos, to: 1, t0: step.t, t1: n ? n.t : step.t + DURATIONS.doors }; doors.setAttribute('data-state', 'opening'); break }
        case 'doors-open': doors.setAttribute('data-state', 'open'); break
        case 'move-start': stripPending = false; setStrip(false); break // the next ride starts: the strip is on the tray now
        case 'lantern': setLantern(step.floor, a.name === 'descend' ? 'down' : 'up'); break
        case 'sill': a.sillPassed = step.floor; setIndicator(label(step.floor), a.name === 'fall' ? 'none' : a.name === 'descend' ? 'down' : step.floor === a.to ? 'none' : 'up'); break
        case 'arrive': car.setAttribute('data-motion', 'idle'); setIndicator(label(step.floor), 'none'); setHallCall(null); break
        case 'fall-start': break
        case 'impact': car.setAttribute('data-motion', 'idle'); setIndicator('P', 'none'); break
        case 'brake': break
        case 'bacon': { const L = landings.get(step.floor); if (L && L.plate) L.plate.setAttribute('visibility', 'hidden'); stripPending = true; break }
        default: break
      }
    },
    frame(elapsed) { if (anim) draw(elapsed) },
    // The panel asks doorsClosingNow() from inside a step's own re-render, which happens BEFORE the
    // frame is drawn; without this the answer is one frame stale and the ◁▷ key re-arms itself on
    // the very frame the doors finish closing.
    mark(elapsed) { if (anim) anim.lastElapsed = elapsed },
    end() { anim = null; flight.setAttribute('visibility', 'hidden'); if (stripPending) { stripPending = false; setStrip(true) } },
    isAnimating() { return !!anim },
    hasStrip() { return strip },
    doorsClosingNow() { return anim && anim.door && anim.door.to === 0 && anim.lastElapsed < anim.door.t1 && (anim.moveStart === null || anim.lastElapsed < anim.moveStart) },
  }
  if (opts.reduced) reduced = true
  draw(null)
  return api
}
