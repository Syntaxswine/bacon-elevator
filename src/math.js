// Problem generation. Pure: seed and context are injected.
// makeProblem(level, step, ctx, rng) → {kind, a, b, c?, answer, text, key}
// ctx = {ring, lastAnswer, sameSeen, kindRun:{kind,n}, comeback:[{problem,due}], count, skills:{kind:[1/0…]}}

export const BLANK = '▮'
export const MINUS = '−'
export const KINDS = ['add', 'sub', 'mul', 'div', 'missAdd', 'missMul', 'up', 'down']

export function initialCtx() {
  return { ring: [], lastAnswer: null, sameSeen: false, kindRun: { kind: null, n: 0 }, comeback: [], count: 0, skills: {} }
}

function fillCtx(ctx) {
  const c = ctx || {}
  return {
    ring: Array.isArray(c.ring) ? c.ring : [],
    lastAnswer: c.lastAnswer === undefined ? null : c.lastAnswer,
    sameSeen: !!c.sameSeen,
    kindRun: c.kindRun && typeof c.kindRun === 'object' ? c.kindRun : { kind: null, n: 0 },
    comeback: Array.isArray(c.comeback) ? c.comeback : [],
    count: Number.isInteger(c.count) ? c.count : 0,
    skills: c.skills && typeof c.skills === 'object' ? c.skills : {},
  }
}

export function solve(p) {
  switch (p.kind) {
    case 'add': case 'up': return p.a + p.b
    case 'sub': case 'down': return p.a - p.b
    case 'mul': return p.a * p.b
    case 'div': return p.a / p.b
    case 'missAdd': return (Number.isInteger(p.c) ? p.c : p.a + p.b) - p.a
    case 'missMul': return (Number.isInteger(p.c) ? p.c : p.a * p.b) / p.b
    default: return NaN
  }
}

// The one problem validator. Anything claiming to be a problem that did not come out of
// makeProblem — a save, a share code, a comeback entry — passes through here and comes back as a
// clean copy or null. The last line is the strong check: the stored answer must be the one solve()
// recomputes from kind/a/b/c, so a hand-edited save cannot teach the elevator a false sum.
// Measured over 320 000 real draws (20 000 × 5 levels × 3 steps, plus 20 000 custom): 0 rejects.
export function validProblem(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null
  if (!KINDS.includes(p.kind)) return null
  if (!Number.isSafeInteger(p.a) || !Number.isSafeInteger(p.b) || !Number.isSafeInteger(p.answer)) return null
  if (typeof p.text !== 'string' || !p.text.includes(BLANK)) return null
  if (typeof p.key !== 'string' || !p.key) return null
  const q = { kind: p.kind, a: p.a, b: p.b, ...(Number.isSafeInteger(p.c) ? { c: p.c } : {}), answer: p.answer, text: p.text, key: p.key }
  return solve(q) === q.answer ? q : null
}

export function keyOf(p) {
  if (p.kind === 'add' || p.kind === 'mul') {
    const [x, y] = p.a <= p.b ? [p.a, p.b] : [p.b, p.a]
    return `${p.kind}:${x}:${y}`
  }
  return `${p.kind}:${p.a}:${p.b}`
}

export function fmt(n) {
  return n < 0 ? MINUS + String(-n) : String(n)
}

export function textOf(p) {
  const a = fmt(p.a), b = fmt(p.b)
  switch (p.kind) {
    case 'add': return `${a} + ${b} = ${BLANK}`
    case 'sub': return `${a} ${MINUS} ${b} = ${BLANK}`
    case 'mul': return `${a} × ${b} = ${BLANK}`
    case 'div': return `${a} ÷ ${b} = ${BLANK}`
    case 'missAdd': return `${a} + ${BLANK} = ${fmt(p.c)}`
    case 'missMul': return `${BLANK} × ${b} = ${fmt(p.c)}`
    case 'up': return `${a} ▲ ${b} = ${BLANK}`
    case 'down': return `${a} ▼ ${b} = ${BLANK}`
    default: return ''
  }
}

// The same text with the answer in the blank (the true equation).
export function trueText(p) {
  return textOf(p).replace(BLANK, fmt(p.answer))
}

export function checkAnswer(p, typed) {
  const s = String(typed == null ? '' : typed).trim().replace(MINUS, '-')
  if (!/^-?\d{1,6}$/.test(s)) return false
  return parseInt(s, 10) === p.answer
}

export function parseTyped(typed) {
  const s = String(typed == null ? '' : typed).trim().replace(MINUS, '-')
  if (!/^-?\d{1,6}$/.test(s)) return null
  return parseInt(s, 10)
}

function finish(kind, a, b, extra = {}) {
  const p = { kind, a, b, ...extra }
  p.answer = solve(p)
  p.text = textOf(p)
  p.key = keyOf(p)
  return p
}

const digits = (n) => String(Math.abs(n)).split('').reverse().map(Number)
function carries(a, b) {
  const da = digits(a), db = digits(b)
  let carry = 0, n = 0
  for (let i = 0; i < Math.max(da.length, db.length); i++) {
    const s = (da[i] || 0) + (db[i] || 0) + carry
    carry = s >= 10 ? 1 : 0
    n += carry
  }
  return n
}
function borrows(a, b) {
  const da = digits(a), db = digits(b)
  let borrow = 0, n = 0
  for (let i = 0; i < Math.max(da.length, db.length); i++) {
    const d = (da[i] || 0) - (db[i] || 0) - borrow
    borrow = d < 0 ? 1 : 0
    n += borrow
  }
  return n
}

const tensOf = (lo, hi, rng) => 10 * rng.int(Math.ceil(lo / 10), Math.floor(hi / 10))

// Draw (a, b[, c]) for one kind entry. Returns null when the draw breaks a constraint; the caller retries.
function draw(e, rng) {
  const max = e.max ?? Infinity
  switch (e.kind) {
    case 'add': {
      let a, b
      if (e.tens) { a = tensOf(e.a[0], e.a[1], rng); b = tensOf(e.b[0], e.b[1], rng) }
      else { a = rng.int(e.a[0], e.a[1]); b = e.double ? a : rng.int(e.b[0], e.b[1]) }
      if (a + b > max) return null
      if (e.regroup === false && (a % 10) + (b % 10) >= 10) return null
      if (e.regroup === true && (a % 10) + (b % 10) < 10) return null
      if (Number.isInteger(e.regroups) && carries(a, b) > e.regroups) return null
      return finish('add', a, b)
    }
    case 'sub': {
      let a, b
      if (e.tens) { a = tensOf(e.a[0], e.a[1], rng); b = tensOf(e.b[0], e.b[1], rng) }
      else { a = rng.int(e.a[0], e.a[1]); b = rng.int(e.b[0], e.b[1]) }
      if (a > max || b > max) return null
      if (!e.negatives && a < b) return null
      if (e.negatives && a === b) return null
      if (e.regroup === false && (a % 10) < (b % 10)) return null
      if (e.regroup === true && (a % 10) >= (b % 10)) return null
      if (Number.isInteger(e.regroups) && borrows(a, b) > e.regroups) return null
      return finish('sub', a, b)
    }
    case 'mul': {
      const a = rng.int(e.a[0], e.a[1])
      const b = e.square ? a : (e.tables ? rng.pick(e.tables) : rng.int(e.b[0], e.b[1]))
      if (a * b > max) return null
      if (e.mult10 && !(a <= 25 || b <= 25 || a % 10 === 0 || b % 10 === 0)) return null
      return finish('mul', a, b)
    }
    case 'div': {
      const b = e.tables ? rng.pick(e.tables) : rng.int(e.b[0], e.b[1])
      const q = rng.int(e.q[0], e.q[1])
      const a = q * b
      if (a > max || b === 0) return null
      return finish('div', a, b)
    }
    case 'missAdd': {
      const a = rng.int(e.a[0], e.a[1]), b = rng.int(e.b[0], e.b[1])
      if (a + b > max) return null
      return finish('missAdd', a, b, { c: a + b })
    }
    case 'missMul': {
      const a = rng.int(e.a[0], e.a[1])
      const b = e.tables ? rng.pick(e.tables) : rng.int(e.b[0], e.b[1])
      if (a * b > max) return null
      return finish('missMul', a, b, { c: a * b })
    }
    case 'up': {
      const a = rng.int(e.a[0], e.a[1]), b = rng.int(e.b[0], e.b[1])
      if (a + b > max) return null
      return finish('up', a, b)
    }
    case 'down': {
      const a = rng.int(e.a[0], e.a[1]), b = rng.int(e.b[0], e.b[1])
      if (a < b || a > max) return null
      return finish('down', a, b)
    }
    default: return null
  }
}

export function stepOf(level, step) {
  const steps = level.steps
  const i = Math.max(0, Math.min(steps.length - 1, (step | 0) - 1))
  return steps[i]
}

function pickEntry(entries, ctx, rng) {
  const weights = entries.map((e) => {
    const s = ctx.skills[e.kind]
    const mastered = Array.isArray(s) && s.length >= 8 && s.slice(-8).every((x) => x === 1)
    return e.weight * (mastered ? 0.25 : 1)
  })
  const total = weights.reduce((x, y) => x + y, 0)
  let r = rng() * total
  for (let i = 0; i < entries.length; i++) { r -= weights[i]; if (r < 0) return entries[i] }
  return entries[entries.length - 1]
}

export function makeProblem(level, step, ctx, rng) {
  const c = fillCtx(ctx)
  // A missed sum comes back verbatim when it is due, overriding every other rule.
  // Validated here too, not only at the save boundary: this is the last gate before the renderer
  // is handed something it will call text.split() on.
  const due = c.comeback.filter((x) => x && Number.isInteger(x.due) && x.due <= c.count && validProblem(x.problem)).sort((x, y) => x.due - y.due)[0]
  if (due) return { ...validProblem(due.problem), comeback: true }
  const entries = stepOf(level, step).kinds
  let last = null
  for (let attempt = 0; attempt < 50; attempt++) {
    const e = pickEntry(entries, c, rng)
    let p = null
    for (let k = 0; k < 40 && !p; k++) p = draw(e, rng)
    if (!p) continue
    last = p
    if (c.ring.includes(p.key)) continue
    if (c.lastAnswer !== null && p.answer === c.lastAnswer) continue
    if (c.sameSeen && p.a === p.b) continue
    if (c.kindRun && c.kindRun.kind === p.kind && c.kindRun.n >= 3) continue
    return p
  }
  if (last) return last
  // Every draw broke a table constraint (a bad custom table): fall back to the first entry, unconstrained.
  const e = entries[0]
  return finish(e.kind === 'div' || e.kind === 'missMul' ? 'add' : e.kind, e.a ? e.a[0] : 0, e.b ? e.b[0] : 0)
}

export function afterAnswer(ctx, problem, correct) {
  const c = fillCtx(ctx)
  const ring = c.ring.concat(problem.key).slice(-20)
  const skills = { ...c.skills }
  skills[problem.kind] = (skills[problem.kind] || []).concat(correct ? 1 : 0).slice(-8)
  let comeback = c.comeback.slice()
  const served = comeback.findIndex((x) => x && x.problem && x.problem.key === problem.key && x.due <= c.count)
  if (served >= 0) comeback.splice(served, 1)
  if (!correct) {
    const copy = { kind: problem.kind, a: problem.a, b: problem.b, ...(Number.isInteger(problem.c) ? { c: problem.c } : {}), answer: problem.answer, text: problem.text, key: problem.key }
    comeback = comeback.concat({ problem: copy, due: c.count + 5 }, { problem: copy, due: c.count + 15 })
  }
  return {
    ring,
    lastAnswer: problem.answer,
    sameSeen: c.sameSeen || problem.a === problem.b,
    kindRun: c.kindRun.kind === problem.kind ? { kind: problem.kind, n: c.kindRun.n + 1 } : { kind: problem.kind, n: 1 },
    comeback,
    count: c.count + 1,
    skills,
  }
}

// The visible adaptive rule: 3 correct in a row → step +1 (max 3); a fall → step −1 (min 1), once per building.
export function adaptStep({ step = 1, streak = 0, stepDowns = 0 } = {}, correct, fell) {
  step = Math.max(1, Math.min(3, step | 0))
  if (correct) {
    streak += 1
    if (streak >= 3 && step < 3) return { step: step + 1, streak: 0, stepDowns, delta: 1 }
    if (streak >= 3) return { step, streak: 0, stepDowns, delta: 0 }
    return { step, streak, stepDowns, delta: 0 }
  }
  if (fell && stepDowns < 1 && step > 1) return { step: step - 1, streak: 0, stepDowns: stepDowns + 1, delta: -1 }
  return { step, streak: 0, stepDowns, delta: 0 }
}

export function allowsNegatives(level, step) {
  return stepOf(level, step).kinds.some((e) => e.negatives)
}
