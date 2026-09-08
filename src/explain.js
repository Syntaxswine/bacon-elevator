// The Repair card's maths. Pure.
// explain(problem) → [{text, expr, value}] — `expr` is an arithmetic expression that evaluates to
// `value` (the tests re-evaluate every one) and `text` is what the card shows: either the equation
// `<expr> = <value>` or, for the counting strategies, one prose clause. The last value is the answer.
// No worked line ever merely restates the big line (0 + 1, 4 + 0, 3 − 2, 1 − 0 all get a real method).
// classify(problem, typed) → {cls, clause}; repair(problem, typed) → {big, small, worked, clause}.
// Failure copy never contains "Oops", "wrong", "no", "✗" or an exclamation mark.

import { fmt, MINUS, BLANK, trueText } from './math.js'

const line = (expr, value, text) => ({ text: text || `${expr} = ${fmt(value)}`, expr, value })
const tens = (n) => Math.floor(n / 10) * 10
const ones = (n) => n % 10
const hundreds = (n) => Math.floor(n / 100) * 100
const range = (from, to, step) => { const out = []; for (let n = from; step > 0 ? n <= to : n >= to; n += step) out.push(n); return out }
// A NON-BREAKING SPACE BEFORE THE LAST NUMBER of a counted run. `Start at 0, count 5 more: 1, 2,
// 3, 4,` wrapping to a lone centred `5` reads as a separate item rather than as the end of the run.
const NBSP = ' '
const list = (arr) => {
  const parts = arr.map(fmt)
  if (parts.length < 2) return parts.join(', ')
  return parts.slice(0, -1).join(', ') + ',' + NBSP + parts[parts.length - 1]
}

// Counting strategies (one clause each).
const countOn = (from, by) => line(`${from} + ${by}`, from + by, `Start at ${from}, count ${by} more: ${list(range(from + 1, from + by, 1))}`)
const countBack = (from, by) => line(`${from} ${MINUS} ${by}`, from - by, `Start at ${from}, count ${by} back: ${list(range(from - 1, from - by, -1))}`)
const countUp = (a, b) => { const d = a - b; return line(`${a} ${MINUS} ${b}`, d, `From ${b} count up to ${a}: ${list(range(b + 1, a, 1))} — that is ${d} ${d === 1 ? 'jump' : 'jumps'}`) }
const countOnBy = (from, unit, n) => line(`${from} + ${unit * n}`, from + unit * n, `Count on in ${unit}s from ${from}: ${list(range(from + unit, from + unit * n, unit))}`)
const countBackBy = (from, unit, n) => line(`${from} ${MINUS} ${unit * n}`, from - unit * n, `Count back in ${unit}s from ${from}: ${list(range(from - unit, from - unit * n, -unit))}`)
const skipCount = (a, n) => line(`${a} × ${n}`, a * n, `Count in ${a}s: ${list(range(a, a * n, a))}`)
const skipCountTo = (b, q, expr) => line(expr, q, `Count in ${b}s to ${b * q}: ${list(range(b, b * q, b))} — that is ${q} ${q === 1 ? 'lot' : 'lots'} of ${b}`)

function explainAdd(a, b) {
  const ans = a + b
  if (b === 0) return [line(`${a} + 0`, a, `${a} + 0 stays ${a}`)]
  if (a === 0) return b <= 10 ? [countOn(0, b)] : [line(`0 + ${b}`, b, `0 + ${b} stays ${b}`)]
  if (a >= 100 || b >= 100) {
    const h = hundreds(a) + hundreds(b), t = tens(a % 100) + tens(b % 100), o = ones(a) + ones(b)
    return [line(`${hundreds(a)} + ${hundreds(b)}`, h), line(`${tens(a % 100)} + ${tens(b % 100)}`, t), line(`${ones(a)} + ${ones(b)}`, o), line(`${h} + ${t} + ${o}`, ans)]
  }
  const [big, small] = a >= b ? [a, b] : [b, a]
  if (a >= 10 && b >= 10) {
    if (ones(small) === 0) return [countOnBy(big, 10, small / 10)]        // 34 + 20, 30 + 20
    if (ones(big) === 0) return [countOnBy(small, 10, big / 10)]          // 20 + 34
    const t = tens(a) + tens(b), o = ones(a) + ones(b)
    return [line(`${tens(a)} + ${tens(b)}`, t), line(`${ones(a)} + ${ones(b)}`, o), line(`${t} + ${o}`, ans)]
  }
  if (ones(big) !== 0 && ones(big) + small > 10) {
    const toTen = 10 - ones(big), next = big + toTen, rest = small - toTen   // make ten: 8 + 5 = 8 + 2 + 3
    return [line(`${big} + ${toTen}`, next), line(`${next} + ${rest}`, ans)]
  }
  if (small <= 3) return [countOn(big, small)]                             // count on from the larger addend
  if (ans <= 10 && big !== small && big - small <= 2) return [line(`${small} + ${small}`, 2 * small), line(`${2 * small} + ${big - small}`, ans)] // near doubles
  if (ans <= 10 || ones(big) === 0) return [countOn(big, small)]
  const o = ones(big) + small                                              // 12 + 5: 2 + 5 = 7, 10 + 7 = 17
  return [line(`${ones(big)} + ${small}`, o), line(`${tens(big)} + ${o}`, ans)]
}

function explainSub(a, b) {
  const ans = a - b
  if (a === 0 && b > 0) return [line(`0 ${MINUS} ${b}`, ans, `${b} below 0 is ${fmt(ans)}`)]
  if (a < b) return [line(`${a} ${MINUS} ${a}`, 0), line(`0 ${MINUS} ${b - a}`, ans)]   // down to zero, then below
  if (b === 0) return [line(`${a} ${MINUS} 0`, a, `${a} ${MINUS} 0 stays ${a}`)]
  if (a === b) return [line(`${a} ${MINUS} ${b}`, 0, `${a} take away all ${b} leaves 0`)]
  if (a >= 100 || b >= 100) {
    const parts = [hundreds(b), tens(b % 100), ones(b)].filter((p) => p > 0)
    if (parts.length === 1) { const unit = parts[0] >= 100 ? 100 : parts[0] >= 10 ? 10 : 1; return unit === 1 ? [countBack(a, b)] : [countBackBy(a, unit, b / unit)] }
    const steps = []
    let cur = a
    for (const p of parts) { steps.push(line(`${cur} ${MINUS} ${p}`, cur - p)); cur -= p }
    return steps
  }
  if (b >= 10) {
    if (ones(b) === 0) return [countBackBy(a, 10, b / 10)]                   // 50 − 20, 57 − 20
    const s1 = a - tens(b)
    return [line(`${a} ${MINUS} ${tens(b)}`, s1), line(`${s1} ${MINUS} ${ones(b)}`, ans)]
  }
  if (b <= 3) return [countBack(a, b)]                                       // 9 ▼ 3: 8, 7, 6
  if (a <= 10 || ans <= 3) return [countUp(a, b)]                             // 9 − 5: from 5 count up to 9
  if (ones(a) === 0) return [line(`10 ${MINUS} ${b}`, 10 - b), line(`${a - 10} + ${10 - b}`, ans)]   // 20 − 6
  if (ones(a) < b) {
    const down = ones(a), rest = b - down, mid = a - down                     // down through ten: 23 − 7
    return [line(`${a} ${MINUS} ${down}`, mid), line(`${mid} ${MINUS} ${rest}`, ans)]
  }
  const o = ones(a) - b                                                       // 17 − 5: 7 − 5 = 2, 10 + 2 = 12
  return [line(`${ones(a)} ${MINUS} ${b}`, o), line(`${tens(a)} + ${o}`, ans)]
}

function explainMul(a, b) {
  const ans = a * b
  if (a === 0 || b === 0) return [line(`${a} × ${b}`, 0, 'Anything times 0 is 0')]
  if (a === 1 || b === 1) return [line(`${a} × ${b}`, ans, `${a} × ${b}: one lot of ${ans} is ${ans}`)]
  if (a === 10 || b === 10) {
    const n = a === 10 ? b : a                                                // 7 × 10: count in 10s; 99 × 10: 99 tens
    return n <= 12 ? [skipCount(10, n)] : [line(`${a} × ${b}`, ans, `${a} × ${b}: ${n} tens is ${ans}`)]
  }
  if (a >= 10 && b >= 10) {
    if (ones(b) === 0) { const x = a * (b / 10); return [line(`${a} × ${b / 10}`, x), line(`${x} × 10`, ans)] }
    if (ones(a) === 0) { const x = (a / 10) * b; return [line(`${a / 10} × ${b}`, x), line(`${x} × 10`, ans)] }
    const x = a * tens(b), y = a * ones(b)
    return [line(`${a} × ${tens(b)}`, x), line(`${a} × ${ones(b)}`, y), line(`${x} + ${y}`, ans)]
  }
  if (a >= 10) {
    if (ones(a) === 0) { const x = (a / 10) * b; return [line(`${a / 10} × ${b}`, x), line(`${x} × 10`, ans)] }   // 30 × 7
    const x = tens(a) * b, y = ones(a) * b
    return [line(`${tens(a)} × ${b}`, x), line(`${ones(a)} × ${b}`, y), line(`${x} + ${y}`, ans)]
  }
  if (b >= 10) {
    const x = a * tens(b), y = a * ones(b)
    return [line(`${a} × ${tens(b)}`, x), line(`${a} × ${ones(b)}`, y), line(`${x} + ${y}`, ans)]
  }
  if (b <= 5) return [skipCount(a, b)]                                        // 4 × 3: count in 4s
  if (a <= 5) return [skipCount(b, a)]                                        // 3 × 8: count in 8s
  const x = a * 5, y = a * (b - 5)                                            // distributive split: 6 × 7 = 6 × 5 + 6 × 2
  return [line(`${a} × 5`, x), line(`${a} × ${b - 5}`, y), line(`${x} + ${y}`, ans)]
}

function explainDiv(a, b) {
  const q = a / b
  if (q <= 10) return [skipCountTo(b, q, `${a} ÷ ${b}`)]                    // 42 ÷ 6: count in 6s to 42
  if (ones(q) === 0) { const x = q / 10; return [line(`${x * b} ÷ ${b}`, x), line(`${x} × 10`, q)] }   // 440 ÷ 4
  const tq = tens(q), oq = q - tq                                             // chunk: 456 ÷ 4 = 440 ÷ 4 + 16 ÷ 4
  return [line(`${tq * b} ÷ ${b}`, tq), line(`${oq * b} ÷ ${b}`, oq), line(`${tq} + ${oq}`, q)]
}

function explainMissAdd(a, c) {
  const m = c - a
  if (m === 0) return [line(`${c} ${MINUS} ${a}`, 0, `${a} + 0 stays ${a}, so the missing number is 0`)]
  if (a === 0) return [line(`${c} ${MINUS} 0`, c, `0 + ${c} is ${c}, so the missing number is ${c}`)]
  if (c <= 20) return [countUp(c, a)]                                         // 3 + ▮ = 7: from 3 count up to 7
  return [line(`${c} ${MINUS} ${a}`, m)]
}

export function explain(p) {
  switch (p.kind) {
    case 'add': case 'up': return explainAdd(p.a, p.b)
    case 'sub': case 'down': return explainSub(p.a, p.b)
    case 'mul': return explainMul(p.a, p.b)
    case 'div': return explainDiv(p.a, p.b)
    case 'missAdd': return explainMissAdd(p.a, Number.isInteger(p.c) ? p.c : p.a + p.b)
    case 'missMul': {
      const c = Number.isInteger(p.c) ? p.c : p.a * p.b
      const q = c / p.b
      return q <= 10 ? [skipCountTo(p.b, q, `${c} ÷ ${p.b}`)] : [line(`${c} ÷ ${p.b}`, q)]
    }
    default: return [line(String(p.answer), p.answer)]
  }
}

const OP_WORD = { add: '+ means add', up: '▲ means go up', sub: `${MINUS} means take away`, down: '▼ means go down', mul: '× means times', div: '÷ means share equally' }

// The missing-number kinds put the child's number in the BLANK, not at the end of the sum: the
// total is already printed, so every clause for them names the inverse move, never the glyph the
// child has just (correctly) used. `+ means add` on `3 + ▮ = 7` contradicts the worked line above it.
const totalOf = (p) => (Number.isInteger(p.c) ? p.c : p.kind === 'missMul' ? p.a * p.b : p.a + p.b)
const isMissing = (k) => k === 'missAdd' || k === 'missMul'
const inverseClause = (p) => {
  const c = fmt(totalOf(p))
  return p.kind === 'missMul'
    ? `${c} is the total, so ${BLANK} is ${c} ÷ ${fmt(p.b)}`
    : `${c} is the total, so ${BLANK} is ${c} ${MINUS} ${fmt(p.a)}`
}

// Digit reversal is a claim about digit ORDER, so it is tested on digit strings of EQUAL length:
// "1" is not 100 reversed, it is 100 cut short — a child who pressed GO one digit early.
function isReversal(ans, t) {
  if (!(ans >= 10) || t === ans || t < 0) return false
  const d = String(ans)
  return d.length >= 2 && String(t).length === d.length && String(t) === d.split('').reverse().join('')
}

export function classify(p, typed) {
  const ans = p.answer
  const t = Number(typed)
  if (!Number.isFinite(t)) return { cls: 'other', clause: `the answer is ${fmt(ans)}` }
  const d = Math.abs(t - ans)
  if (d === 1 || d === 2) return { cls: 'offby', clause: 'count again' }
  // A neighbour table fact is a claim about a PRODUCT, so it can only fire where the child's number
  // IS a product — plain mul. On div and missMul the typed number is a FACTOR, and a neighbouring
  // factor is off by one, already returned above (which is why the old ÷ branch was unreachable).
  if (p.kind === 'mul') {
    const a = p.a, b = p.b
    if (t === a * (b - 1)) return { cls: 'neighbour', clause: `that is ${a} × ${b - 1}; one more ${a}` }
    if (t === a * (b + 1)) return { cls: 'neighbour', clause: `that is ${a} × ${b + 1}; one ${a} fewer` }
    if (t === (a - 1) * b) return { cls: 'neighbour', clause: `that is ${a - 1} × ${b}; one more ${b}` }
    if (t === (a + 1) * b) return { cls: 'neighbour', clause: `that is ${a + 1} × ${b}; one ${b} fewer` }
  }
  if (isReversal(ans, t)) return { cls: 'reversal', clause: `you pressed ${fmt(t)}; it is ${fmt(ans)}` }
  const a = p.a, b = p.b
  const swaps = { add: a - b, up: a - b, sub: a + b, down: a + b, mul: a + b, div: a * b, missAdd: a + totalOf(p), missMul: totalOf(p) * b }
  if (p.kind in swaps && t === swaps[p.kind] && t !== ans) {
    return { cls: 'opswap', clause: isMissing(p.kind) ? inverseClause(p) : OP_WORD[p.kind] }
  }
  return { cls: 'other', clause: isMissing(p.kind) ? inverseClause(p) : `the answer is ${fmt(ans)}` }
}

export function repair(p, typed) {
  const steps = explain(p)
  const entered = typeof typed === 'string' ? typed.trim() : (typed === null || typed === undefined ? '' : String(typed))
  return {
    big: trueText(p),
    // No entry, no claim about one. `Number('') === 0`, and a resumed save whose typedWrong was
    // dropped (an old save, an imported code) printed `you pressed 0` for an answer nobody gave.
    small: entered === '' ? '' : `you pressed ${fmt(Number(entered.replace(MINUS, '-')))}`,
    worked: steps.map((s) => s.text).join('  ·  '),
    clause: classify(p, typed).clause,
  }
}
