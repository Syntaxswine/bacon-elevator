import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mulberry32 } from '../src/rng.js'
import { LEVELS, customLevel } from '../src/levels.js'
import { makeProblem, afterAnswer, initialCtx, KINDS } from '../src/math.js'
import { explain, classify, repair } from '../src/explain.js'

// Re-evaluate a worked line "<expr> = <value>": every line is one operator, or a chain of +.
function evalLine(text) {
  const [lhs, rhs] = text.split(' = ')
  const toks = lhs.split(' ').map((t) => t.replace('−', '-'))
  let v = Number(toks[0])
  for (let i = 1; i < toks.length; i += 2) {
    const op = toks[i], n = Number(toks[i + 1])
    if (op === '+') v += n; else if (op === '-') v -= n; else if (op === '×') v *= n; else if (op === '÷') v /= n; else throw new Error('bad op ' + op + ' in ' + text)
  }
  return { lhs: v, rhs: Number(rhs.replace('−', '-')) }
}

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
  test(`explain: 5000 ${kind} problems — every step evaluates, the last value is the answer`, () => {
    const ps = problemsOfKind(kind, 5000)
    assert.ok(ps.length >= 1000, `only ${ps.length} ${kind} problems`)
    for (const p of ps) {
      const steps = explain(p)
      assert.ok(steps.length >= 1)
      for (const s of steps) {
        const { lhs, rhs } = evalLine(s.text)
        assert.equal(lhs, rhs, `${kind}: "${s.text}" does not hold`)
        assert.equal(rhs, s.value, `${kind}: value mismatch in "${s.text}"`)
      }
      assert.equal(steps[steps.length - 1].value, p.answer, `${kind}: last value ≠ answer for ${p.text}`)
      const rep = repair(p, String(p.answer + 1))
      for (const t of [rep.big, rep.small, rep.worked, rep.clause]) {
        assert.ok(!/oops|wrong|✗|!/i.test(t), 'failure copy: ' + t)
        assert.ok(!/\bno\b/i.test(t), 'failure copy: ' + t)
      }
    }
  })
}

test('explain uses the named strategies', () => {
  assert.deepEqual(explain({ kind: 'add', a: 8, b: 5, answer: 13 }).map((s) => s.text), ['8 + 2 = 10', '10 + 3 = 13'])
  assert.deepEqual(explain({ kind: 'add', a: 34, b: 25, answer: 59 }).map((s) => s.text), ['30 + 20 = 50', '4 + 5 = 9', '50 + 9 = 59'])
  assert.deepEqual(explain({ kind: 'mul', a: 6, b: 7, answer: 42 }).map((s) => s.text), ['6 × 5 = 30', '6 × 2 = 12', '30 + 12 = 42'])
  assert.deepEqual(explain({ kind: 'mul', a: 4, b: 3, answer: 12 }).map((s) => s.text), ['4 + 4 + 4 = 12'])
  assert.deepEqual(explain({ kind: 'div', a: 42, b: 6, answer: 7 }).map((s) => s.text), ['6 × 7 = 42', '42 ÷ 6 = 7'])
  assert.deepEqual(explain({ kind: 'missAdd', a: 3, b: 4, c: 7, answer: 4 }).map((s) => s.text), ['7 − 3 = 4'])
  assert.deepEqual(explain({ kind: 'sub', a: 2, b: 5, answer: -3 }).map((s) => s.text), ['5 − 2 = 3', '2 − 5 = −3'])
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
})

test('repair carries the true equation big and the typed value small', () => {
  const r = repair({ kind: 'add', a: 7, b: 5, answer: 12, text: '7 + 5 = ▮' }, '11')
  assert.equal(r.big, '7 + 5 = 12')
  assert.equal(r.small, 'you pressed 11')
  assert.equal(r.clause, 'count again')
  assert.ok(r.worked.includes('= 12'))
})
