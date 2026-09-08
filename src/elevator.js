// The elevator model. Pure: floors −1 (P), 0 (G), 1–9, 10 (R).
// step(car, event) → {car, timeline:[{t, ev, floor?}], duration, blocked?}
// Every timing lives in DURATIONS (ms at Normal); scale() multiplies by one timescale.

export const DURATIONS = Object.freeze({
  doors: 500,       // centre-opening doors, open or close
  floor: 700,       // one floor of travel on a normal ride
  express: 500,     // per floor on the recovery ride and the victory descent
  fall: 800,        // pit drop, regardless of height
  impact: 600,      // spikes squash, car squashes 10 %, one bounce
  hold: 500,        // `Safety brake on.`
  pitDoors: 400,    // door time in the fall sequence
  lanternLead: 250, // lantern + ding this long before arrival
  tick: 600,        // `7 + 5 = 12 ✓` shown before the doors close
  bacon: 400,       // the strip slides in
  truth: 1200,      // the true equation is shown before a fall
})

export const FLOORS = Object.freeze({ PIT: -1, G: 0, TOP: 9, ROOF: 10 })

export function scale(durations, timescale) {
  const out = {}
  for (const k of Object.keys(durations)) out[k] = Math.round(durations[k] * timescale)
  return out
}

export function initialCar() {
  return { floor: 0, doors: 'open', direction: 'none', carCall: null, hallCalls: [], lantern: null, motion: 'idle' }
}

export function label(floor) {
  if (floor === -1) return 'P'
  if (floor === 0) return 'G'
  if (floor === 10) return 'R'
  return String(floor)
}

const unchanged = (car, blocked) => ({ car, timeline: [], duration: 0, blocked })

export function step(car, event) {
  const D = DURATIONS
  if (!event || typeof event.type !== 'string') return unchanged(car, 'illegal')
  switch (event.type) {
    case 'press': {
      const f = event.floor
      if (car.motion !== 'idle' || !Number.isInteger(f) || f < 0 || f > 10 || f === car.floor) return unchanged(car, 'illegal')
      return { car: { ...car, carCall: f }, timeline: [], duration: 0 }
    }
    case 'closeDoors': {
      if (car.motion !== 'idle' || (car.doors !== 'open' && car.doors !== 'opening')) return unchanged(car, 'illegal')
      return { car: { ...car, doors: 'closed' }, timeline: [{ t: 0, ev: 'doors-closing' }, { t: D.doors, ev: 'doors-closed' }], duration: D.doors }
    }
    case 'openDoors': {
      if (car.motion !== 'idle' || (car.doors !== 'closed' && car.doors !== 'closing')) return unchanged(car, 'illegal')
      return { car: { ...car, doors: 'open' }, timeline: [{ t: 0, ev: 'doors-opening' }, { t: D.doors, ev: 'doors-open' }], duration: D.doors }
    }
    case 'move': {
      if (car.motion !== 'idle' || car.floor >= 10) return unchanged(car, 'illegal')
      if (car.doors !== 'closed') return unchanged(car, 'doors')
      const to = car.floor + 1
      const T = D.floor
      const timeline = [
        { t: 0, ev: 'move-start', floor: to },
        { t: T - D.lanternLead, ev: 'lantern', floor: to },
        { t: T - D.lanternLead, ev: 'ding', floor: to },
        { t: T, ev: 'sill', floor: to },
        { t: T, ev: 'arrive', floor: to },
        { t: T, ev: 'doors-opening' },
        { t: T + D.doors, ev: 'doors-open' },
        { t: T + D.doors, ev: 'bacon', floor: to },
      ]
      return { car: { ...car, floor: to, doors: 'open', direction: 'none', carCall: null, lantern: null, motion: 'idle' }, timeline, duration: T + D.doors + D.bacon }
    }
    case 'express': {
      const to = event.to
      if (car.motion !== 'idle' || !Number.isInteger(to) || to <= car.floor || to > 10) return unchanged(car, 'illegal')
      if (car.doors !== 'closed') return unchanged(car, 'doors')
      const timeline = [{ t: 0, ev: 'move-start', floor: to }]
      for (let f = car.floor + 1; f <= to; f++) timeline.push({ t: (f - car.floor) * D.express, ev: 'sill', floor: f })
      const T = (to - car.floor) * D.express
      timeline.push({ t: T - D.lanternLead, ev: 'lantern', floor: to }, { t: T - D.lanternLead, ev: 'ding', floor: to })
      timeline.push({ t: T, ev: 'arrive', floor: to }, { t: T, ev: 'doors-opening' }, { t: T + D.doors, ev: 'doors-open' }, { t: T + D.doors, ev: 'bacon', floor: to })
      timeline.sort((x, y) => x.t - y.t)
      return { car: { ...car, floor: to, doors: 'open', direction: 'none', carCall: null, lantern: null, motion: 'idle' }, timeline, duration: T + D.doors + D.bacon }
    }
    case 'descend': {
      const to = event.to
      if (car.motion !== 'idle' || !Number.isInteger(to) || to >= car.floor || to < -1) return unchanged(car, 'illegal')
      if (car.doors !== 'closed') return unchanged(car, 'doors')
      const timeline = [{ t: 0, ev: 'move-start', floor: to }]
      for (let f = car.floor - 1; f >= to; f--) timeline.push({ t: (car.floor - f) * D.express, ev: 'sill', floor: f })
      const T = (car.floor - to) * D.express
      timeline.push({ t: T - D.lanternLead, ev: 'lantern', floor: to }, { t: T - D.lanternLead, ev: 'ding2', floor: to })
      timeline.push({ t: T, ev: 'arrive', floor: to }, { t: T, ev: 'doors-opening' }, { t: T + D.doors, ev: 'doors-open' })
      timeline.sort((x, y) => x.t - y.t)
      return { car: { ...car, floor: to, doors: 'open', direction: 'none', carCall: null, lantern: null, motion: 'idle' }, timeline, duration: T + D.doors }
    }
    case 'fall': {
      // The one deliberate bypass of the door interlock: the cable slips. Byte-identical every time.
      if (car.motion !== 'idle' || car.floor === -1) return unchanged(car, 'illegal')
      const t1 = D.pitDoors, t2 = t1 + D.fall, t3 = t2 + D.impact, t4 = t3 + D.hold
      const timeline = [
        { t: 0, ev: 'doors-closing' },
        { t: t1, ev: 'doors-closed' },
        { t: t1, ev: 'fall-start', floor: -1 },
        { t: t2, ev: 'impact', floor: -1 },
        { t: t2, ev: 'sill', floor: -1 },
        { t: t3, ev: 'brake', floor: -1 },
        { t: t4, ev: 'doors-opening' },
        { t: t4 + D.pitDoors, ev: 'doors-open' },
      ]
      return { car: { ...car, floor: -1, doors: 'open', direction: 'none', carCall: null, lantern: null, motion: 'idle' }, timeline, duration: t4 + D.pitDoors }
    }
    default:
      return unchanged(car, 'illegal')
  }
}

// Chain several events; every timeline is offset by the running total. Stops at the first block.
export function sequence(car, events, offset = 0) {
  let t = offset
  let timeline = []
  let cur = car
  for (const ev of events) {
    const r = step(cur, ev)
    if (r.blocked) return { car: cur, timeline, duration: t, blocked: r.blocked, at: ev }
    timeline = timeline.concat(r.timeline.map((s) => ({ ...s, t: s.t + t })))
    t += r.duration
    cur = r.car
  }
  return { car: cur, timeline, duration: t }
}

// Jerk-limited trapezoid: sine-shaped ramps of one floor-time each (or the whole ride when short).
// Monotone, 0 at the start, exactly `to` at and after the end.
export function positionAt(from, to, elapsedMs, msPerFloor) {
  const n = Math.abs(to - from)
  if (n === 0) return to
  const T = n * msPerFloor
  if (!(elapsedMs > 0)) return from
  if (elapsedMs >= T) return to
  const tau = elapsedMs / T
  const f = Math.min(0.5, 1 / n)
  const vmax = n / (T * (1 - f))          // floors per ms
  let s
  if (tau <= f) {
    const x = tau / f
    s = vmax * f * T * (x / 2 - Math.sin(Math.PI * x) / (2 * Math.PI))
  } else if (tau <= 1 - f) {
    s = vmax * f * T / 2 + vmax * T * (tau - f)
  } else {
    const x = (tau - (1 - f)) / f
    s = vmax * f * T / 2 + vmax * T * (1 - 2 * f) + vmax * f * T * (x / 2 + Math.sin(Math.PI * x) / (2 * Math.PI))
  }
  s = Math.max(0, Math.min(n, s))
  return from + Math.sign(to - from) * s
}

// Speed in floors per ms at a moment of a ride, for the motor hum.
export function speedAt(from, to, elapsedMs, msPerFloor) {
  const h = 8
  return (positionAt(from, to, elapsedMs + h, msPerFloor) - positionAt(from, to, elapsedMs - h, msPerFloor)) / (2 * h)
}
