// The Repair card's maths. Pure.
// explain(problem) → [{text, value}] — every text is `<expression> = <value>` and the last value is the answer.
// classify(problem, typed) → {cls, clause}; repair(problem, typed) → {big, small, worked, clause}.
// Failure copy never contains "Oops", "wrong", "no", "✗" or an exclamation mark.

import { fmt, MINUS, trueText } from './math.js'

const line = (text, value) => ({ text, value })
const tens = (n) => Math.floor(n / 10) * 10
const ones = (n) => n % 10
const hundreds = (n) => Math.floor(n / 100) * 100

function explainAdd(a, b) {
  const ans = a + b
  if (a >= 100 || b >= 100) {
    const h = hundreds(a) + hundreds(b), t = tens(a % 100) + tens(b % 100), o = ones(a) + ones(b)
    return [line(`${hundreds(a)} + ${hundreds(b)} = ${h}`, h), line(`${tens(a % 100)} + ${tens(b % 100)} = ${t}`, t), line(`${ones(a)} + ${ones(b)} = ${o}`, o), line(`${h} + ${t} + ${o} = ${ans}`, ans)]
  }
  if (a >= 10 && b >= 10) {
    const t = tens(a) + tens(b), o = ones(a) + ones(b)
    return [line(`${tens(a)} + ${tens(b)} = ${t}`, t), line(`${ones(a)} + ${ones(b)} = ${o}`, o), line(`${t} + ${o} = ${ans}`, ans)]
  }
  const [big, small] = a >= b ? [a, b] : [b, a]
  if (ones(big) !== 0 && ones(big) + small > 10) {
    const toTen = 10 - ones(big), next = big + toTen, rest = small - toTen
    return [line(`${big} + ${toTen} = ${next}`, next), line(`${next} + ${rest} = ${ans}`, ans)]
  }
  return [line(`${a} + ${b} = ${ans}`, ans)]
}

function explainSub(a, b) {
  const ans = a - b
  if (a < b) {
    const d = b - a
    return [line(`${b} ${MINUS} ${a} = ${d}`, d), line(`${a} ${MINUS} ${b} = ${fmt(ans)}`, ans)]
  }
  if (a >= 100 || b >= 100) {
    const s1 = a - hundreds(b), s2 = s1 - tens(b % 100)
    return [line(`${a} ${MINUS} ${hundreds(b)} = ${s1}`, s1), line(`${s1} ${MINUS} ${tens(b % 100)} = ${s2}`, s2), line(`${s2} ${MINUS} ${ones(b)} = ${ans}`, ans)]
  }
  if (b >= 10) {
    const s1 = a - tens(b)
    return [line(`${a} ${MINUS} ${tens(b)} = ${s1}`, s1), line(`${s1} ${MINUS} ${ones(b)} = ${ans}`, ans)]
  }
  if (a >= 10 && ones(a) < b && ones(a) > 0) {
    const down = ones(a), rest = b - down, mid = a - down
    return [line(`${a} ${MINUS} ${down} = ${mid}`, mid), line(`${mid} ${MINUS} ${rest} = ${ans}`, ans)]
  }
  return [line(`${a} ${MINUS} ${b} = ${ans}`, ans)]
}

function explainMul(a, b) {
  const ans = a * b
  if (b >= 10) {
    const x = a * tens(b), y = a * ones(b)
    if (y === 0) return [line(`${a} × ${b} = ${ans}`, ans)]
    return [line(`${a} × ${tens(b)} = ${x}`, x), line(`${a} × ${ones(b)} = ${y}`, y), line(`${x} + ${y} = ${ans}`, ans)]
  }
  if (a >= 10 && b <= 9) {
    const x = tens(a) * b, y = ones(a) * b
    if (y === 0) return [line(`${a} × ${b} = ${ans}`, ans)]
    return [line(`${tens(a)} × ${b} = ${x}`, x), line(`${ones(a)} × ${b} = ${y}`, y), line(`${x} + ${y} = ${ans}`, ans)]
  }
  if (b > 5) {
    const x = a * 5, y = a * (b - 5)
    return [line(`${a} × 5 = ${x}`, x), line(`${a} × ${b - 5} = ${y}`, y), line(`${x} + ${y} = ${ans}`, ans)]
  }
  if (b >= 2) {
    const terms = Array(b).fill(String(a)).join(' + ')
    return [line(`${terms} = ${ans}`, ans)]
  }
  return [line(`${a} × ${b} = ${ans}`, ans)]
}

export function explain(p) {
  switch (p.kind) {
    case 'add': case 'up': return explainAdd(p.a, p.b)
    case 'sub': case 'down': return explainSub(p.a, p.b)
    case 'mul': return explainMul(p.a, p.b)
    case 'div': {
      const q = p.a / p.b
      return [line(`${p.b} × ${q} = ${p.a}`, p.a), line(`${p.a} ÷ ${p.b} = ${q}`, q)]
    }
    case 'missAdd': {
      const c = Number.isInteger(p.c) ? p.c : p.a + p.b
      return [line(`${c} ${MINUS} ${p.a} = ${c - p.a}`, c - p.a)]
    }
    case 'missMul': {
      const c = Number.isInteger(p.c) ? p.c : p.a * p.b
      return [line(`${c} ÷ ${p.b} = ${c / p.b}`, c / p.b)]
    }
    default: return [line(trueText(p), p.answer)]
  }
}

const OP_WORD = { add: '+ means add', up: '▲ means go up', sub: `${MINUS} means take away`, down: '▼ means go down', mul: '× means times', div: '÷ means share equally', missAdd: '+ means add', missMul: '× means times' }

export function classify(p, typed) {
  const ans = p.answer
  const t = Number(typed)
  if (!Number.isFinite(t)) return { cls: 'other', clause: `the answer is ${fmt(ans)}` }
  const d = Math.abs(t - ans)
  if (d === 1 || d === 2) return { cls: 'offby', clause: 'count again' }
  if (p.kind === 'mul' || p.kind === 'missMul' || p.kind === 'div') {
    const a = p.kind === 'div' ? p.b : p.a, b = p.kind === 'div' ? ans : p.b
    // neighbour table fact: a × (b ± 1) or (a ± 1) × b
    if (p.kind !== 'div') {
      if (t === a * (b - 1)) return { cls: 'neighbour', clause: `that is ${a} × ${b - 1}; one more ${a}` }
      if (t === a * (b + 1)) return { cls: 'neighbour', clause: `that is ${a} × ${b + 1}; one ${a} fewer` }
      if (t === (a - 1) * b) return { cls: 'neighbour', clause: `that is ${a - 1} × ${b}; one more ${b}` }
      if (t === (a + 1) * b) return { cls: 'neighbour', clause: `that is ${a + 1} × ${b}; one ${b} fewer` }
    } else {
      if (t === b - 1 || t === b + 1) return { cls: 'neighbour', clause: `${a} × ${t} = ${a * t}; try ${a} × ${b}` }
    }
  }
  if (ans >= 10 && ans !== t && t >= 0 && String(t) === String(Math.abs(ans)).split('').reverse().join('').replace(/^0+/, '')) {
    return { cls: 'reversal', clause: `you pressed ${fmt(t)}; it is ${fmt(ans)}` }
  }
  const a = p.a, b = p.b
  const swaps = { add: a - b, up: a - b, sub: a + b, down: a + b, mul: a + b, div: a * b, missAdd: a + (Number.isInteger(p.c) ? p.c : a + b), missMul: (Number.isInteger(p.c) ? p.c : a * b) * b }
  if (p.kind in swaps && t === swaps[p.kind] && t !== ans) return { cls: 'opswap', clause: OP_WORD[p.kind] }
  if (p.kind === 'mul' && t === a * a && a !== b) return { cls: 'other', clause: `the answer is ${fmt(ans)}` }
  return { cls: 'other', clause: `the answer is ${fmt(ans)}` }
}

export function repair(p, typed) {
  const steps = explain(p)
  return {
    big: trueText(p),
    small: `you pressed ${fmt(Number(typed))}`,
    worked: steps.map((s) => s.text).join('  ·  '),
    clause: classify(p, typed).clause,
  }
}
