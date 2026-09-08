import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mulberry32 } from '../src/rng.js'
import { LEVELS, customLevel } from '../src/levels.js'
import { makeProblem, initialCtx, KINDS, trueText } from '../src/math.js'
import { explain, classify, repair } from '../src/explain.js'

// Re-evaluate a worked step's expression: one operator, or a chain of + / −, left to right.
function evalExpr(expr) {
  const toks = expr.split(' ').map((t) => t.replace('−', '-'))
  let v = Number(toks[0])
  if (!Number.isFinite(v)) throw new Error('bad expression ' + expr)
  for (let i = 1; i < toks.length; i += 2) {
    const op = toks[i], n = Number(toks[i + 1])
    if (!Number.isFinite(n)) throw new Error('bad operand in ' + expr)
    if (op === '+') v += n; else if (op === '-') v -= n; else if (op === '×') v *= n; else if (op === '÷') v /= n; else throw new Error('bad op ' + op + ' in ' + expr)
  }
  return v
}
const fmt = (n) => (n < 0 ? '−' + String(-n) : String(n))
const clauses = (text) => text.split('  ·  ').length
// A counted run keeps a NON-BREAKING space before its last number so the run never wraps to a lone
// digit on its own line. The expectations below read the run as prose; the rule itself is pinned by
// its own test at the bottom of this file, which is the one place the character may be asserted.
const plain = (t) => String(t).replace(/ /g, ' ')

// Every kind from every level table (and the custom level for negatives).
function problemsOfKind(kind, n) {
  const out = []
  const levels = LEVELS.concat(customLevel({ ops: ['add', 'sub', 'mul', 'div', 'missAdd', 'up', 'down'], min: 0, max: 60, negatives: true }))
  const rng = mulberry32(5)
  let guard = 0
  while (out.length < n && guard++ < 400000) {
    for (const level of levels) for (let step = 1; step <= level.steps.length; step++) {
      const p = makeProblem(level, step, initialCtx(), rng)
      if (p.kind === kind) out.push(p)
      if (out.length >= n) return out
    }
  }
  return out
}

for (const kind of KINDS) {
  test(`explain: 5000 ${kind} problems — every step evaluates, the last value is the answer, nothing restates the big line`, () => {
    const ps = problemsOfKind(kind, 5000)
    assert.ok(ps.length >= 1000, `only ${ps.length} ${kind} problems`)
    for (const p of ps) {
      const steps = explain(p)
      assert.ok(steps.length >= 1)
      const big = trueText(p)
      for (const s of steps) {
        assert.equal(evalExpr(s.expr), s.value, `${kind}: "${s.expr}" does not evaluate to ${s.value} (${s.text})`)
        if (s.text.includes(' = ')) assert.equal(s.text, `${s.expr} = ${fmt(s.value)}`, `${kind}: equation text disagrees with its expression: ${s.text}`)
        else assert.ok(!s.text.includes('='), `${kind}: prose line carries a stray "=": ${s.text}`)
        assert.notEqual(s.text, big, `${kind}: a worked step merely restates the big line for ${p.text}`)
      }
      assert.equal(steps[steps.length - 1].value, p.answer, `${kind}: last value ≠ answer for ${p.text}`)
      const rep = repair(p, String(p.answer + 1))
      assert.notEqual(rep.worked, rep.big, `${kind}: the worked line restates the big line for ${p.text}`)
      assert.ok(rep.worked.length <= 110, `${kind}: worked line too long for the card (${rep.worked.length}): ${rep.worked}`)
      for (const t of [rep.big, rep.small, rep.worked, rep.clause]) {
        assert.ok(!/oops|wrong|✗|!/i.test(t), 'failure copy: ' + t)
        assert.ok(!/\bno\b/i.test(t), 'failure copy: ' + t)
      }
    }
  })
}

test('explain uses the named strategies', () => {
  const texts = (p) => explain(p).map((s) => plain(s.text))
  assert.deepEqual(texts({ kind: 'add', a: 8, b: 5, answer: 13 }), ['8 + 2 = 10', '10 + 3 = 13'])
  assert.deepEqual(texts({ kind: 'add', a: 34, b: 25, answer: 59 }), ['30 + 20 = 50', '4 + 5 = 9', '50 + 9 = 59'])
  assert.deepEqual(texts({ kind: 'add', a: 4, b: 5, answer: 9 }), ['4 + 4 = 8', '8 + 1 = 9'], 'near doubles')
  assert.deepEqual(texts({ kind: 'add', a: 12, b: 5, answer: 17 }), ['2 + 5 = 7', '10 + 7 = 17'], 'split the ones')
  assert.deepEqual(texts({ kind: 'add', a: 34, b: 20, answer: 54 }), ['Count on in 10s from 34: 44, 54'])
  assert.deepEqual(texts({ kind: 'add', a: 345, b: 527, answer: 872 }), ['300 + 500 = 800', '40 + 20 = 60', '5 + 7 = 12', '800 + 60 + 12 = 872'])
  assert.deepEqual(texts({ kind: 'sub', a: 9, b: 5, answer: 4 }), ['From 5 count up to 9: 6, 7, 8, 9 — that is 4 jumps'])
  assert.deepEqual(texts({ kind: 'sub', a: 23, b: 7, answer: 16 }), ['23 − 3 = 20', '20 − 4 = 16'], 'down through ten')
  assert.deepEqual(texts({ kind: 'sub', a: 17, b: 5, answer: 12 }), ['7 − 5 = 2', '10 + 2 = 12'])
  assert.deepEqual(texts({ kind: 'sub', a: 45, b: 23, answer: 22 }), ['45 − 20 = 25', '25 − 3 = 22'])
  assert.deepEqual(texts({ kind: 'sub', a: 50, b: 20, answer: 30 }), ['Count back in 10s from 50: 40, 30'])
  assert.deepEqual(texts({ kind: 'sub', a: 2, b: 5, answer: -3 }), ['2 − 2 = 0', '0 − 3 = −3'])
  assert.deepEqual(texts({ kind: 'sub', a: 5, b: 5, answer: 0 }), ['5 take away all 5 leaves 0'])
  assert.deepEqual(texts({ kind: 'mul', a: 6, b: 7, answer: 42 }), ['6 × 5 = 30', '6 × 2 = 12', '30 + 12 = 42'])
  assert.deepEqual(texts({ kind: 'mul', a: 4, b: 3, answer: 12 }), ['Count in 4s: 4, 8, 12'], 'skip count')
  assert.deepEqual(texts({ kind: 'mul', a: 3, b: 8, answer: 24 }), ['Count in 8s: 8, 16, 24'])
  assert.deepEqual(texts({ kind: 'mul', a: 7, b: 10, answer: 70 }), ['Count in 10s: 10, 20, 30, 40, 50, 60, 70'])
  assert.deepEqual(texts({ kind: 'mul', a: 30, b: 7, answer: 210 }), ['3 × 7 = 21', '21 × 10 = 210'])
  assert.deepEqual(texts({ kind: 'mul', a: 24, b: 30, answer: 720 }), ['24 × 3 = 72', '72 × 10 = 720'])
  assert.deepEqual(texts({ kind: 'mul', a: 12, b: 12, answer: 144 }), ['12 × 10 = 120', '12 × 2 = 24', '120 + 24 = 144'])
  assert.deepEqual(texts({ kind: 'div', a: 42, b: 6, answer: 7 }), ['Count in 6s to 42: 6, 12, 18, 24, 30, 36, 42 — that is 7 lots of 6'])
  assert.deepEqual(texts({ kind: 'div', a: 456, b: 4, answer: 114 }), ['440 ÷ 4 = 110', '16 ÷ 4 = 4', '110 + 4 = 114'], 'chunking')
  assert.deepEqual(texts({ kind: 'div', a: 440, b: 4, answer: 110 }), ['44 ÷ 4 = 11', '11 × 10 = 110'])
  assert.deepEqual(texts({ kind: 'missAdd', a: 3, b: 4, c: 7, answer: 4 }), ['From 3 count up to 7: 4, 5, 6, 7 — that is 4 jumps'])
  assert.deepEqual(texts({ kind: 'missAdd', a: 30, b: 40, c: 70, answer: 40 }), ['70 − 30 = 40'])
  assert.deepEqual(texts({ kind: 'missMul', a: 7, b: 6, c: 42, answer: 7 }), ['Count in 6s to 42: 6, 12, 18, 24, 30, 36, 42 — that is 7 lots of 6'])
})

test('one-step sums get a real method, never a restatement, in one clause the 4-row card can hold', () => {
  const fixtures = [
    [{ kind: 'add', a: 0, b: 1, answer: 1, text: '0 + 1 = ▮' }, 'Start at 0, count 1 more: 1'],
    [{ kind: 'add', a: 4, b: 0, answer: 4, text: '4 + 0 = ▮' }, '4 + 0 stays 4'],
    [{ kind: 'sub', a: 3, b: 2, answer: 1, text: '3 − 2 = ▮' }, 'Start at 3, count 2 back: 2, 1'],
    [{ kind: 'sub', a: 1, b: 0, answer: 1, text: '1 − 0 = ▮' }, '1 − 0 stays 1'],
    [{ kind: 'add', a: 2, b: 7, answer: 9, text: '2 + 7 = ▮' }, 'Start at 7, count 2 more: 8, 9'],
    [{ kind: 'down', a: 9, b: 3, answer: 6, text: '9 ▼ 3 = ▮' }, 'Start at 9, count 3 back: 8, 7, 6'],
    [{ kind: 'up', a: 3, b: 2, answer: 5, text: '3 ▲ 2 = ▮' }, 'Start at 3, count 2 more: 4, 5'],
    [{ kind: 'missAdd', a: 0, b: 1, c: 1, answer: 1, text: '0 + ▮ = 1' }, '0 + 1 is 1, so the missing number is 1'],
    [{ kind: 'missAdd', a: 6, b: 1, c: 7, answer: 1, text: '6 + ▮ = 7' }, 'From 6 count up to 7: 7 — that is 1 jump'],
    [{ kind: 'sub', a: 7, b: 6, answer: 1, text: '7 − 6 = ▮' }, 'From 6 count up to 7: 7 — that is 1 jump'],
  ]
  for (const [p, expected] of fixtures) {
    const rep = repair(p, String(p.answer + 1))
    const steps = explain(p)
    assert.equal(plain(rep.worked), expected, p.text)
    assert.notEqual(rep.worked, rep.big, `restates: ${p.text}`)
    assert.equal(steps.length, 1, 'one step')
    assert.equal(clauses(rep.worked), 1, 'one clause')
    assert.ok(!rep.worked.includes(';'), 'one clause')
    assert.equal(evalExpr(steps[0].expr), p.answer, `${steps[0].expr} evaluates to the answer`)
    assert.equal(steps[0].value, p.answer)
    assert.ok(rep.worked.length <= 60, `fits the card: ${rep.worked}`)
  }
})

test('classify: every class has a fixture and a counter-fixture', () => {
  const add = { kind: 'add', a: 7, b: 5, answer: 12 }
  assert.equal(classify(add, 13).cls, 'offby')
  assert.equal(classify(add, 10).cls, 'offby')
  assert.notEqual(classify(add, 15).cls, 'offby')
  assert.equal(classify(add, 21).cls, 'reversal')
  assert.equal(classify(add, 21).clause, 'you pressed 21; it is 12')
  assert.notEqual(classify(add, 22).cls, 'reversal')
  assert.equal(classify(add, 2).cls, 'opswap')
  assert.equal(classify(add, 2).clause, '+ means add')
  assert.notEqual(classify(add, 3).cls, 'opswap')
  const mul = { kind: 'mul', a: 6, b: 7, answer: 42 }
  assert.equal(classify(mul, 36).cls, 'neighbour')
  assert.equal(classify(mul, 36).clause, 'that is 6 × 6; one more 6')
  assert.equal(classify(mul, 48).cls, 'neighbour')
  assert.equal(classify(mul, 35).cls, 'neighbour')
  assert.notEqual(classify(mul, 30).cls, 'neighbour')
  assert.equal(classify(mul, 13).cls, 'opswap')
  assert.equal(classify(mul, 100).cls, 'other')
  const sub = { kind: 'sub', a: 9, b: 3, answer: 6 }
  assert.equal(classify(sub, 12).cls, 'opswap')
  assert.equal(classify(sub, 12).clause, '− means take away')
  const div = { kind: 'div', a: 42, b: 6, answer: 7 }
  assert.equal(classify(div, 8).cls, 'offby')
  assert.equal(classify(div, 252).cls, 'opswap')
  assert.equal(classify(add, 'abc').cls, 'other')
  assert.equal(classify(add, 999).cls, 'other')
  // Missing-number kinds put the child's number in the BLANK, not at the end of the sum, so the
  // clause names the inverse move — never the glyph the child has just (correctly) used.
  const mAdd = { kind: 'missAdd', a: 3, b: 4, c: 7, answer: 4 }
  assert.equal(classify(mAdd, 10).cls, 'opswap')                       // 3 + 7: they added
  assert.equal(classify(mAdd, 10).clause, '7 is the total, so ▮ is 7 − 3')
  assert.notEqual(classify(mAdd, 11).cls, 'opswap')
  assert.equal(classify(mAdd, 6).cls, 'offby')
  assert.equal(classify(mAdd, 6).clause, 'count again')
  const mMul = { kind: 'missMul', a: 3, b: 4, c: 12, answer: 3 }
  assert.equal(classify(mMul, 48).cls, 'opswap')                       // 12 × 4: they multiplied
  assert.equal(classify(mMul, 48).clause, '12 is the total, so ▮ is 12 ÷ 4')
  assert.notEqual(classify(mMul, 47).cls, 'opswap')
  assert.equal(classify(mMul, 12).clause, '12 is the total, so ▮ is 12 ÷ 4')  // copied the total
  // A neighbour table fact is a claim about a PRODUCT: only `mul` types a product.
  const mMul2 = { kind: 'missMul', a: 5, b: 8, c: 40, answer: 5 }
  assert.notEqual(classify(mMul2, 35).cls, 'neighbour')
  assert.equal(classify(mMul2, 35).clause, '40 is the total, so ▮ is 40 ÷ 8')
  assert.equal(classify(div, 6).cls, 'offby')      // the ÷ neighbour branch was unreachable
  assert.equal(classify(div, 6).clause, 'count again')
  // Reversal is a claim about digit ORDER, not a truncated entry.
  assert.notEqual(classify({ kind: 'add', a: 15, b: 5, answer: 20 }, 2).cls, 'reversal')
  assert.equal(classify({ kind: 'add', a: 15, b: 5, answer: 20 }, 2).clause, 'the answer is 20')
  assert.notEqual(classify({ kind: 'mul', a: 10, b: 10, answer: 100 }, 1).cls, 'reversal')
  assert.notEqual(classify({ kind: 'add', a: 497, b: 243, answer: 740 }, 47).cls, 'reversal')
  assert.equal(classify({ kind: 'missAdd', a: 3, b: 21, c: 24, answer: 21 }, 12).cls, 'reversal')
})

// The class, not the instances: a clause is a sentence about the child's mistake, so it must be
// TRUE of the problem it is shown for. Hand-picked fixtures cannot see this; drawn problems can.
function clauseInvariants(p, assertFn) {
  const c = Number.isInteger(p.c) ? p.c : undefined
  const cands = new Set([p.answer - 1, p.answer + 1, p.answer - 2, p.answer + 2, p.a, p.b, c,
    p.a + p.b, p.a - p.b, p.a * p.b, 2 * p.answer, Math.floor(p.answer / 2), p.answer + 10, p.answer - 10,
    Number(String(Math.abs(p.answer)).split('').reverse().join('')),
    p.a * (p.b - 1), p.a * (p.b + 1), (p.a - 1) * p.b, (p.a + 1) * p.b,
    c === undefined ? undefined : c * p.b, c === undefined ? undefined : c + p.a])
  const seen = { offby: 0, neighbour: 0, reversal: 0, opswap: 0, other: 0 }
  for (const t of cands) {
    if (!Number.isInteger(t) || t === p.answer) continue
    const { cls, clause } = classify(p, t)
    seen[cls]++
    const where = `${p.text} (answer ${p.answer}) typed ${t} → ${cls}: ${clause}`
    if (cls === 'neighbour') {
      assertFn.equal(p.kind, 'mul', 'neighbour on a kind whose entry is not a product: ' + where)
      const m = clause.match(/that is (\d+) × (\d+)/)
      assertFn.ok(m && Number(m[1]) * Number(m[2]) === t, 'neighbour names a product the child did not press: ' + where)
    }
    if (cls === 'reversal') {
      const A = String(Math.abs(p.answer))
      assertFn.equal(String(t).length, A.length, 'reversal on a truncated entry: ' + where)
      assertFn.equal(String(t), A.split('').reverse().join(''), 'reversal that is not a reversal: ' + where)
    }
    if (/ means /.test(clause)) {
      assertFn.ok(!/^miss/.test(p.kind), 'a missing-number card names the glyph the child already used: ' + where)
      assertFn.equal(clause, { add: '+ means add', up: '▲ means go up', sub: '− means take away', down: '▼ means go down', mul: '× means times', div: '÷ means share equally' }[p.kind], where)
    }
    const inv = clause.match(/^(\d+) is the total, so ▮ is (\d+) (−|÷) (\d+)$/)
    if (inv) {
      assertFn.ok(/^miss/.test(p.kind), 'inverse clause on a direct kind: ' + where)
      const v = inv[3] === '÷' ? Number(inv[2]) / Number(inv[4]) : Number(inv[2]) - Number(inv[4])
      assertFn.equal(v, p.answer, 'inverse clause does not reach the answer: ' + where)
    }
    assertFn.ok(!/oops|wrong|✗|!/i.test(clause) && !/\bno\b/i.test(clause), 'clause tone: ' + where)
  }
  return seen
}

test('every clause is true of the mistake it is shown for', () => {
  const rng = mulberry32(9)
  const levels = LEVELS.concat(customLevel({ ops: ['add', 'sub', 'mul', 'div', 'missAdd', 'up', 'down'], min: 0, max: 60, negatives: true }))
  const seen = { offby: 0, neighbour: 0, reversal: 0, opswap: 0, other: 0 }
  for (let i = 0; i < 6000; i++) {
    const level = levels[i % levels.length]
    const p = makeProblem(level, 1 + (i % level.steps.length), initialCtx(), rng)
    if (!p) continue
    const s = clauseInvariants(p, assert)
    for (const k of Object.keys(seen)) seen[k] += s[k]
  }
  // The round-robin above almost never reaches Skyscraper step 2, where missMul lives.
  const sky = LEVELS.find((l) => l.id === 'sky')
  for (let i = 0; i < 500; i++) {
    const p = makeProblem(sky, 2, initialCtx(), rng)
    const s = clauseInvariants(p, assert)
    for (const k of Object.keys(seen)) seen[k] += s[k]
  }
  for (const k of ['offby', 'neighbour', 'reversal', 'opswap', 'other']) assert.ok(seen[k] > 0, `no ${k} clause was exercised`)
})

test('repair carries the true equation big and the typed value small', () => {
  const r = repair({ kind: 'add', a: 7, b: 5, answer: 12, text: '7 + 5 = ▮' }, '11')
  assert.equal(r.big, '7 + 5 = 12')
  assert.equal(r.small, 'you pressed 11')
  assert.equal(r.clause, 'count again')
  assert.ok(r.worked.includes('= 12'))
})


// ---- round 2 -----------------------------------------------------------------------------------

// r2-elevator-feel-08: `Start at 0, count 5 more: 1, 2, 3, 4,` wrapped and left a lone centred `5`
// under the middle of the Repair card, which reads as a separate item rather than the end of the run.
test('r2-elevator-feel-08: a counted run never orphans its last number onto a line of its own', () => {
  const NBSP = '\u00A0'
  const runs = [
    explain({ kind: 'add', a: 0, b: 5, answer: 5 })[0].text,
    explain({ kind: 'sub', a: 9, b: 3, answer: 6 })[0].text,
    explain({ kind: 'missMul', a: 7, b: 6, c: 42, answer: 7 })[0].text,
  ]
  for (const t of runs) {
    assert.ok(t.includes(NBSP), `no non-breaking space in "${t}"`)
    const nums = t.slice(t.indexOf(':') + 1)
    assert.ok(!/,\s\d+(\s|$)/.test(nums.replace(/[^,\s\d]/g, ' ').split(NBSP)[1] || ''), 'only the last separator is non-breaking')
  }
  // one clause, one non-breaking space: the separator before the last number and nowhere else
  const one = explain({ kind: 'add', a: 0, b: 5, answer: 5 })[0].text
  assert.equal(one.split(NBSP).length - 1, 1)
})

// r2-code-hostile-09: `Number('') === 0`, so a resumed save whose typedWrong was dropped (an old
// save, an imported code) printed `you pressed 0` for an answer the child never gave.
test('r2-code-hostile-09: no entry, no claim about one', () => {
  const p = { kind: 'add', a: 7, b: 5, answer: 12, text: '7 + 5 = ▮', key: 'add:5:7' }
  assert.equal(repair(p, '').small, '')
  assert.equal(repair(p, null).small, '')
  assert.equal(repair(p, undefined).small, '')
  assert.equal(repair(p, '11').small, 'you pressed 11')
  assert.equal(repair({ kind: 'sub', a: 2, b: 27, answer: -25, text: '2 − 27 = ▮', key: 'sub:2:27' }, '−9').small, 'you pressed −9')
  assert.equal(repair(p, '0').small, 'you pressed 0', 'a real 0 still says so')
})
