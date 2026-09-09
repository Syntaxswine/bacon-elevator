// Problem generation. Pure: seed and context are injected.
// makeProblem(level, step, ctx, rng) → {kind, a, b, c?, answer, text, key}
// ctx = {ring, lastAnswer, sameSeen, kindRun:{kind,n}, comeback:[{problem,due}], count, skills:{kind:[1/0…]}}

export const BLANK = '▮'
export const MINUS = '−'
export const KINDS = ['add', 'sub', 'mul', 'div', 'missAdd', 'missMul', 'up', 'down']

export function initialCtx() {
  return { ring: [], lastAnswer: null, sameSeen: 0, zeroSeen: 0, kindRun: { kind: null, n: 0 }, comeback: [], count: 0, skills: {}, lastComeback: false }
}

function fillCtx(ctx) {
  const c = ctx || {}
  return {
    ring: Array.isArray(c.ring) ? c.ring : [],
    lastAnswer: c.lastAnswer === undefined ? null : c.lastAnswer,
    // sameSeen IS A FUSE, NOT A LATCH. It used to be a boolean set for the rest of the building, so
    // the first incidental `3 + 3` at Corner Shop — where no entry declares `double` — removed 1+1,
    // 2+2, 3+3, 4+4, 5+5 and every a−a from the remaining questions, and doubles are a taught fact at
    // that age (r3-math-09). It now holds for five questions and burns down. A legacy save (or a
    // test) that writes `true` gets a full fuse; `false` gets none.
    sameSeen: Number.isInteger(c.sameSeen) ? Math.max(0, Math.min(20, c.sameSeen)) : (c.sameSeen ? SAME_FUSE : 0),
    // The same fuse shape for the ADDITIVE IDENTITY (`0 + 2`, `4 − 0`, `0 ▲ 2`), whose answer is
    // one of the two numbers already on the panel. 0 is a taught point at Corner Shop steps 1 and
    // 2 and levels.js says so, but a third of every question drawn there was one of them (32.0 %
    // at step 1, 19.7 % at step 2 over 20 000 draws) — more than a teaching point, and the first
    // screen of a fresh save is drawn from it. Serving one holds the shape off for ZERO_FUSE
    // questions, which caps it near one in six without a weight table or a second rng draw.
    zeroSeen: Number.isInteger(c.zeroSeen) ? Math.max(0, Math.min(20, c.zeroSeen)) : 0,
    kindRun: c.kindRun && typeof c.kindRun === 'object' ? c.kindRun : { kind: null, n: 0 },
    comeback: Array.isArray(c.comeback) ? c.comeback : [],
    count: Number.isInteger(c.count) ? c.count : 0,
    skills: c.skills && typeof c.skills === 'object' ? c.skills : {},
    lastComeback: !!c.lastComeback,
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
  // THE KEYPAD'S OWN CEILING. checkAnswer's regex and typedCap both stop at TYPED_MAX digits, so a
  // problem whose answer is wider than that is a sum the panel physically cannot enter — it falls
  // every time and re-queues itself. No generator can draw one (108 000 draws across every level and
  // Custom setting: 0 answers over 4 digits); a hand-edited save or a hostile BE1- code can.
  if (String(Math.abs(p.answer)).length > TYPED_MAX) return null
  const q = { kind: p.kind, a: p.a, b: p.b, ...(Number.isSafeInteger(p.c) ? { c: p.c } : {}), ...(p.pair ? { pair: true } : {}), answer: p.answer, text: p.text, key: p.key }
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
  // A missing-number kind without its total renders `15 + ▮ = undefined` on the display band.
  // finish() is the one place every problem is built, so it is the one place that can refuse to
  // emit a blank the child cannot read.
  if (kind === 'missAdd' && !Number.isInteger(p.c)) p.c = a + b
  if (kind === 'missMul' && !Number.isInteger(p.c)) p.c = a * b
  p.answer = solve(p)
  p.text = textOf(p)
  p.key = keyOf(p)
  return p
}

// How many questions an incidental a === b suppresses its own shape for.
export const SAME_FUSE = 5
// …and how many an additive identity suppresses ITS shape for (r4-math-06).
export const ZERO_FUSE = 4
// How many misses in a row a queued sum gets before the queue stops re-arming it.
export const MISS_RETIRE = 3

// A sum whose answer is already printed in the question: the additive identity in every form the
// generator can draw it. `0 + 0` is refused outright by draw(); this is the throttle for the rest.
export function isIdentity(p) {
  if (!p) return false
  if (p.kind === 'add' || p.kind === 'up') return p.a === 0 || p.b === 0
  if (p.kind === 'sub' || p.kind === 'down') return p.b === 0
  if (p.kind === 'missAdd') return p.a === 0
  return false
}

// A COMEBACK IS BANDED BY THE STEP THAT SERVES IT, NOT BY THE STEP THAT DREW IT (r4-math-01).
// makeProblem used to take a due entry before it read stepOf(), so the queue overrode both the
// step's kind list and its ceiling: a child dropped to Corner Shop step 1 — tag `numbers to 10`,
// kinds add/sub/▲/▼, max 5 — was served `9 + ▮ = 10`, a form step 1 never teaches, above its own
// ceiling, on the screen whose own message band had just said "Smaller numbers for a bit."
// Measured on a fresh default save: 189 of 191 comeback draws out of band, five falls per building
// for every building after the second, for ever. A due entry that the current step cannot legally
// ask simply waits (and ages out of the queue on its own, state.js recordQuestion), which is what
// `+5 and +15` already promises for an entry that is not yet due.
export function inStepBand(problem, entries) {
  if (!problem || !Array.isArray(entries)) return false
  const nums = [problem.a, problem.b, ...(Number.isInteger(problem.c) ? [problem.c] : []), problem.answer]
  return entries.some((e) => {
    if (e.kind !== problem.kind) return false
    const max = e.max ?? Infinity
    if (nums.some((n) => Math.abs(n) > max)) return false
    if (problem.answer < 0 && !e.negatives) return false
    return true
  })
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
  const p = drawOne(e, rng)
  // `0 + 0` and `0 − 0` are the one cell of the bonds-to-5 table with nothing in it: the answer is
  // right there in the question. 0 stays a teaching point at Corner Shop steps 1 and 2 (`0 + 5`
  // teaches the additive identity, levels.js says so), but a sum with NO number in it is not a
  // question, and it reaches the very first screen of a fresh save about once in thirty buildings.
  if (p && p.a === 0 && p.b === 0) return null
  return p
}

function drawOne(e, rng) {
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
      return finish('add', a, b, e.double ? { pair: true } : {})
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
      return finish('mul', a, b, e.square ? { pair: true } : {})
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
  // A missed sum comes back verbatim when it is due, overriding the ring and the same-answer rule.
  // Validated here too, not only at the save boundary: this is the last gate before the renderer
  // is handed something it will call text.split() on.
  //
  // TWO THINGS THE OVERRIDE MAY NOT DO, both measured (r2-math-01).
  //   1. It may not serve the identical sum twice running. afterAnswer used to queue TWO entries per
  //      miss and remove only ONE on a re-miss, so a late comeback re-armed itself while its twin was
  //      already overdue and fired again on the very next question: 8.5 % of questions at 60 %
  //      accuracy, worst run 5, and 31 consecutive identical questions once one key saturated the
  //      12-entry queue. The queue is de-duplicated by key in afterAnswer; this is the second belt.
  //   2. It may not starve the generator. A struggling child always had something due, so EVERY
  //      question was a comeback and the pool collapsed to five sums with no new sum ever drawn
  //      again. A comeback may not follow a comeback, so the generator runs at least every other
  //      question whatever the accuracy, and a deferred entry simply fires one question later.
  //   3. It may not leave the band of the step it is served at — see inStepBand (r4-math-01).
  const lastKey = c.ring.length ? c.ring[c.ring.length - 1] : null
  const entries = stepOf(level, step).kinds
  const due = c.lastComeback ? null
    : c.comeback.filter((x) => x && Number.isInteger(x.due) && x.due <= c.count && validProblem(x.problem) && x.problem.key !== lastKey && inStepBand(x.problem, entries)).sort((x, y) => x.due - y.due)[0]
  if (due) return { ...validProblem(due.problem), comeback: true }
  // THE KIND-RUN GUARD IS ABOUT VARIETY, AND A STEP WITH ONE KIND HAS NONE TO OFFER.
  // `Custom → only ×` builds a single-kind step, so from question 4 `kindRun.n >= 3` was true for
  // ever and rejected all 50 attempts on 99 % of questions whatever the pool size — the ring, the
  // same-answer rule and the doubles fuse all stopped being consulted and every question came out of
  // the unchecked fallback below. Measured: `× only, 2–100` (a 44-key pool, twice the ring) repeated
  // the previous key at exactly the uniform-random rate, i.e. the anti-repeat layer contributed
  // nothing (r3-math-01).
  const multiKind = new Set(entries.map((e) => e.kind)).size > 1
  let last = null, lastFresh = null
  const lastServed = c.ring.length ? c.ring[c.ring.length - 1] : null
  for (let attempt = 0; attempt < 50; attempt++) {
    const e = pickEntry(entries, c, rng)
    let p = null
    for (let k = 0; k < 40 && !p; k++) p = draw(e, rng)
    if (!p) continue
    last = p
    if (p.key !== lastServed) lastFresh = p
    if (c.ring.includes(p.key)) continue
    if (c.lastAnswer !== null && p.answer === c.lastAnswer) continue
    if (c.sameSeen > 0 && p.a === p.b && !p.pair) continue   // a DECLARED double/square is the table, not a coincidence
    if (c.zeroSeen > 0 && isIdentity(p)) continue            // the answer is already printed in the question
    if (multiKind && c.kindRun && c.kindRun.kind === p.kind && c.kindRun.n >= 3) continue
    // The FIRST sum a child ever sees is the game's whole first impression, and it is drawn with no
    // ring, no last answer and no same-seen latch to steer it: one fresh save in six opened on an
    // answer of 0 (`5 − 5`, `2 ▼ 2`). Only here, and only on the very first question of a save.
    //
    // AND THE ZERO LATCH IS THE SAME KIND OF LATCH (r5-math-05). `zeroSeen` only arms once an
    // identity HAS been served, so question one was unthrottled: 37.5 % of fresh saves opened on
    // `0 + 5`, `5 + 0`, `2 − 0` — a sum whose answer is already printed in the question. The
    // steady-state rate is a healthy 16 %; the single most visible draw in the game was more than
    // twice that. Same one-line guard, same one question.
    if (c.count === 0 && (p.answer === 0 || isIdentity(p))) continue
    return p
  }
  // THE FALLBACK IS STILL BOUND BY THE ONE RULE THE PROJECT WROTE DOWN.
  // DESIGN §4 sanctions "50 retries, then accept", and r2-math-01 states the standard the comeback
  // path is already held to: "It may not serve the identical sum twice running." This path applied
  // no ring, no same-answer and no same-key check at all, so `Custom → only ×, Largest 20` (a 10-key
  // table against a 20-key ring) asked the identical sum twice running 4–7 % of the time — measured
  // on the panel, floors 7 and 8 of one building both `5 × 4 = ▮`. The last-served key is now the one
  // thing the fallback will not hand back.
  if (lastFresh) return lastFresh
  if (last) return last
  // Every draw broke a constraint (an impossible table). Degrade to a legal, RANDOM sum inside the
  // entry's own ceiling — never one corner of the range served for ever, and never a kind the
  // child was not asked for. The old fallback returned `e.a[0] op e.b[0]`, which measured as
  // `100 × 2 = 200` on 900/900 draws with ops ×, Smallest 100, Largest 120.
  return degrade(entries[0], rng)
}

function degrade(e, rng) {
  const max = Math.max(4, Math.min(e.max ?? 20, 9999))
  const fHi = Math.max(2, Math.min(12, Math.floor(Math.sqrt(max))))
  switch (e.kind) {
    case 'mul': case 'missMul': {
      const b = rng.int(2, fHi), a = rng.int(2, Math.max(2, Math.floor(max / b)))
      return finish(e.kind, a, b)
    }
    case 'div': {
      const b = rng.int(2, fHi), q = rng.int(2, Math.max(2, Math.floor(max / b)))
      return finish('div', q * b, b)
    }
    case 'sub': case 'down': {
      const a = rng.int(2, max), b = rng.int(1, e.kind === 'sub' && e.negatives ? max : a)
      return finish(e.kind, a, b)
    }
    default: {
      const a = rng.int(1, Math.max(1, Math.floor(max / 2))), b = rng.int(1, Math.max(1, max - a))
      return finish(e.kind === 'up' ? 'up' : e.kind === 'missAdd' ? 'missAdd' : 'add', a, b)
    }
  }
}

export function afterAnswer(ctx, problem, correct) {
  const c = fillCtx(ctx)
  const ring = c.ring.concat(problem.key).slice(-20)
  const skills = { ...c.skills }
  skills[problem.kind] = (skills[problem.kind] || []).concat(correct ? 1 : 0).slice(-8)
  // ONE PENDING PAIR PER SUM. Serving used to remove a single matching entry while a miss added two,
  // so a re-missed comeback left an already-overdue twin behind and the same sum fired again on the
  // very next question; repeat it and one key filled the whole 12-entry queue, evicting every other
  // sum's remediation. Serving now clears every DUE entry for that key (a not-yet-due +15 twin
  // survives, which is what §4's `+5 and +15` promises), and a fresh miss replaces the key's pair
  // outright instead of stacking a third and fourth copy on top of it.
  //
  // AND A KEY MAY NOT RE-ARM WITHOUT LIMIT (r4-math-01). Every miss deleted the key's pair and
  // queued a fresh one, so a sum the child cannot yet do could never leave the queue: measured on
  // a default save, three sums held all twelve slots for forty buildings and 194 falls. After
  // MISS_RETIRE misses IN A ROW WHILE STILL QUEUED, the key is retired rather than re-queued — it
  // is not banished, because the queue ages entries out after 40 questions (state.js
  // recordQuestion) and a sum unseen that long is a fresh question again.
  let comeback = c.comeback.filter((x) => !(x && x.problem && x.problem.key === problem.key && x.due <= c.count))
  if (!correct) {
    const misses = c.comeback.reduce((n, x) => (x && x.problem && x.problem.key === problem.key ? Math.max(n, x.misses || 1) : n), 0) + 1
    comeback = comeback.filter((x) => !(x && x.problem && x.problem.key === problem.key))
    const copy = { kind: problem.kind, a: problem.a, b: problem.b, ...(Number.isInteger(problem.c) ? { c: problem.c } : {}), ...(problem.pair ? { pair: true } : {}), answer: problem.answer, text: problem.text, key: problem.key }
    if (misses <= MISS_RETIRE) comeback = comeback.concat({ problem: copy, due: c.count + 5, misses }, { problem: copy, due: c.count + 15, misses })
  }
  return {
    ring,
    lastAnswer: problem.answer,
    sameSeen: (problem.a === problem.b && !problem.pair) ? SAME_FUSE : Math.max(0, c.sameSeen - 1),
    zeroSeen: isIdentity(problem) ? ZERO_FUSE : Math.max(0, c.zeroSeen - 1),
    kindRun: c.kindRun.kind === problem.kind ? { kind: problem.kind, n: c.kindRun.n + 1 } : { kind: problem.kind, n: 1 },
    comeback,
    count: c.count + 1,
    skills,
    lastComeback: !!problem.comeback,
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

// WHAT ACTUALLY CHANGED, IN WORDS (r5-math-02, r5-code-hostile-02).
// The step change is announced in the display band (DESIGN §4: the adaptive rule is visible, never
// silent), and the announcement used to be derived from the SIGN OF THE STEP alone: up said "Bigger
// numbers now.", down said "Smaller numbers for a bit." Measured over 20 000 draws either side of
// every transition, that sentence is false more often than it is true at three of the ten step-ups
// and at two of the step-downs — Office Block 1 → 2 drops the `tens ± tens` row (max 100) for the
// 3s and 4s (max 40), so the mean largest number on the panel falls 60 → 43 under a sentence saying
// it rises, and the mirror lands on the floor screen straight after a fall, which is the one moment
// the copy exists to reassure. The steps really do get harder; the sentence just named the wrong
// variable. This names the variable that moved, in the order a child meets it, and falls back to
// size only where the ceiling genuinely rises. A level with ONE step (Custom) returns '': stepOf
// clamps, so both sides are the same table and nothing changed at all.
const REGROUPS = (st) => Math.max(0, ...st.kinds.map((k) => (Number.isInteger(k.regroups) ? k.regroups : k.regroup === true ? 1 : 0)))
const CEILING = (st) => Math.max(0, ...st.kinds.map((k) => k.max ?? 0))
const NEW_KIND_WORD = [['div', 'Sharing now.'], ['mul', 'Times tables now.'], ['missMul', 'Missing numbers now.'], ['missAdd', 'Missing numbers now.']]
// Every sentence stepNote can return, in one place, so an instrument does not have to re-spell the
// list it is measuring (tools/drive-scenarios.mjs asserted against two hard-coded strings and went
// red on the other five the moment the copy told the truth).
export const STEP_NOTE_WORDS = Object.freeze(['Bigger numbers now.', 'Smaller numbers for a bit.', 'Easier sums for a bit.', 'New sums now.', 'Carrying now.', 'Times tables now.', 'Sharing now.', 'Missing numbers now.', 'Below zero now.'])
export function stepNote(level, from, to) {
  const a = stepOf(level, from), b = stepOf(level, to)
  if (a === b) return ''
  const kindsA = new Set(a.kinds.map((k) => k.kind)), kindsB = new Set(b.kinds.map((k) => k.kind))
  const up = (to | 0) > (from | 0)
  if (up) {
    if (b.kinds.some((k) => k.negatives) && !a.kinds.some((k) => k.negatives)) return 'Below zero now.'
    for (const [k, w] of NEW_KIND_WORD) if (kindsB.has(k) && !kindsA.has(k)) return w
    if (REGROUPS(b) > REGROUPS(a)) return 'Carrying now.'
    if (CEILING(b) > CEILING(a)) return 'Bigger numbers now.'
    return 'New sums now.'
  }
  if (CEILING(b) < CEILING(a)) return 'Smaller numbers for a bit.'
  return 'Easier sums for a bit.'
}

// THE KEYPAD MUST BE ABLE TO EXPRESS THE ANSWER TO THE PROBLEM IT IS SHOWING.
// The problem outlives the step that drew it: it is re-shown after a fall (which drops the step),
// after a pinned-step change, after a Custom-knob change and as a comeback. Deriving the ± key from
// the level+step alone therefore takes the key away from a sum that needs it — a keypad that cannot
// answer the sum on screen, with no way out. This predicate is that rule, and it lives here so
// every caller shares it instead of re-implementing the comparison.
export function levelAllowsNegatives(level) {
  return level.steps.some((s) => s.kinds.some((e) => e.negatives))
}

export const TYPED_MAX = 6
export function digitsNeeded(p) { return p ? String(Math.abs(p.answer)).length : 1 }
export function typedCap(p) { return Math.min(TYPED_MAX, Math.max(4, digitsNeeded(p))) }
export function signKeyLive(level, step, problem) {
  return levelAllowsNegatives(level) || !!(problem && problem.answer < 0)
}
