import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mulberry32 } from '../src/rng.js'
import { loadFacts, isPassengerFloor, pickFact, makeChoices, domainOf } from '../src/trivia.js'

const shipped = JSON.parse(readFileSync(new URL('../data/trivia.json', import.meta.url), 'utf8'))

const good = () => ({
  id: 'otis-1854', category: 'elevator', difficulty: 1,
  question: 'Who showed a safety elevator in 1854?', answer: 'Elisha Otis', distractors: ['Werner von Siemens', 'Frank Sprague', 'Jesse Reno'],
  fact: 'Elisha Otis showed his safety at the 1854 New York exhibition.',
  sources: [{ title: 'Otis history', url: 'https://www.otis.com/en/us/about/history' }],
  verification: [{ lens: 'confirm', source_title: 'x', source_url: 'https://a' }, { lens: 'refute', source_title: 'y', source_url: 'https://b' }],
})

test('the shipped bank passes the gate: ≥ 60 live items, a 40/60 or better mix, nothing rejected', () => {
  const { facts, rejected } = loadFacts(shipped)
  assert.deepEqual(rejected, [])
  assert.ok(facts.length >= 60, `only ${facts.length}`)
  const e = facts.filter((f) => f.kind === 'elevator').length, m = facts.length - e
  assert.ok(e / facts.length >= 0.4 && m / facts.length >= 0.3, `mix ${e}/${m}`)
  for (const f of facts) {
    assert.equal(f.distractors.length, 3)
    assert.ok(f.sources.every((s) => /^https?:\/\//.test(s.url)))
    assert.ok(f.q.length <= 200)
  }
})

test('the gate rejects a missing lens, a missing url, duplicate or answer-equal distractors, forbidden words', () => {
  const rej = (mut) => { const it = good(); mut(it); const r = loadFacts({ items: [it] }); assert.equal(r.facts.length, 0); assert.equal(r.rejected.length, 1); return r.rejected[0].reason }
  assert.equal(loadFacts({ items: [good()] }).facts.length, 1)
  assert.match(rej((it) => { it.verification = it.verification.filter((v) => v.lens !== 'refute') }), /refute/)
  assert.match(rej((it) => { it.verification = [] }), /lens/)
  assert.match(rej((it) => { delete it.verification }), /verification/)
  assert.match(rej((it) => { it.sources = [{ title: 'x', url: 'ftp://nope' }] }), /http/)
  assert.match(rej((it) => { it.sources = [] }), /http/)
  assert.match(rej((it) => { it.distractors = ['A', 'A', 'B'] }), /unique/)
  assert.match(rej((it) => { it.distractors = ['Elisha Otis', 'B', 'C'] }), /equals the answer/)
  assert.match(rej((it) => { it.distractors = ['A', 'B'] }), /three/)
  assert.match(rej((it) => { it.fact = 'Nobody died in the 1854 exhibition.' }), /forbidden word: died/)
  assert.match(rej((it) => { it.question = 'Which crash?' }), /forbidden word/)
  assert.match(rej((it) => { it.answer = 'trapped' }), /forbidden/)
  assert.match(rej((it) => { it.category = 'history' }), /category/)
  assert.match(rej((it) => { delete it.id }), /id/)
  const dup = loadFacts({ items: [good(), good()] })
  assert.equal(dup.facts.length, 1); assert.equal(dup.rejected[0].reason, 'duplicate id')
  assert.equal(loadFacts(null).facts.length, 0)
  assert.equal(loadFacts('garbage').facts.length, 0)
})

test('passenger floors per cadence', () => {
  const at = (c) => [...Array(11).keys()].filter((f) => isPassengerFloor(f, c))
  assert.deepEqual(at('sometimes'), [4, 8])
  assert.deepEqual(at(undefined), [4, 8])
  assert.deepEqual(at('often'), [3, 6, 9])
  assert.deepEqual(at('never'), [])
})

test('makeChoices: three choices, the answer among them, two of the three distractors', () => {
  const f = loadFacts({ items: [good()] }).facts[0]
  const rng = mulberry32(3)
  const pairs = new Set()
  for (let i = 0; i < 200; i++) {
    const { choices, answer } = makeChoices(f, rng)
    assert.equal(choices.length, 3)
    assert.equal(choices[answer], f.answer)
    assert.equal(new Set(choices).size, 3)
    for (const c of choices) assert.ok(c === f.answer || f.distractors.includes(c))
    pairs.add(choices.filter((c) => c !== f.answer).sort().join('|'))
  }
  assert.equal(pairs.size, 3, 'every distractor pair should appear over 200 draws')
})

test('pickFact: unseen first, kinds alternate, a missed fact returns after ≥ 20', () => {
  const { facts } = loadFacts(shipped)
  const rng = mulberry32(8)
  const seen = []
  let last = null
  for (let i = 0; i < facts.length; i++) {
    const f = pickFact(facts, seen, last, rng)
    assert.ok(!seen.includes(f.id), 'repeat before all seen')
    if (last && facts.some((x) => x.kind !== last && !seen.includes(x.id))) assert.notEqual(f.kind, last, 'did not alternate')
    seen.push(f.id); last = f.kind
  }
  // all seen: recycles the least recent
  const again = pickFact(facts, seen, last, rng)
  assert.ok(facts.some((f) => f.id === again.id))
  const idx = seen.indexOf(again.id)
  assert.ok(idx < 8, 'should recycle one of the oldest')
  // retry: missed at seen.length 5 → not before 20 questions later, then first
  const missed = facts[10].id
  const retry = [{ id: missed, at: 5 }]
  const s24 = Array.from({ length: 24 }, (_, i) => facts[i % 5].id)
  assert.notEqual(pickFact(facts, s24, null, rng, retry).id, missed)
  const s25 = s24.concat(facts[1].id)
  assert.equal(pickFact(facts, s25, null, rng, retry).id, missed)
  assert.equal(pickFact([], [], null, rng), null)
})

test('domainOf', () => {
  assert.equal(domainOf('https://www.otis.com/en/us/about'), 'otis.com')
  assert.equal(domainOf('http://mathworld.wolfram.com/x'), 'mathworld.wolfram.com')
  assert.equal(domainOf(''), '')
})
