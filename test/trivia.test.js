import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mulberry32 } from '../src/rng.js'
import { loadFacts, isPassengerFloor, pickFact, makeChoices, domainOf, TRIVIA_LIMITS, withinNumberBand } from '../src/trivia.js'

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

// r1-autism-fit-02: the picker knew the level existed and never asked it. A numbers-to-10 child was
// served difficulty-3, 183-character kilogram subtractions — measured over seeds 1–8 × 6 buildings
// at Corner Shop: 53 of 96 passengers above difficulty 1, 24 questions over 120 characters.
// The band predicate, asked of the module that owns it. Re-spelling `difficulty <= … && q.length <= …`
// here is how this test came to believe an item was available that pickFact had already excluded.
const inBandOf = (f, limits) => f.difficulty <= limits.maxDifficulty && f.q.length <= limits.maxQ && withinNumberBand(f, limits)

test('the fact pool is gated by level: Corner Shop never draws above its band', () => {
  const { facts } = loadFacts(shipped)
  const limits = TRIVIA_LIMITS.corner
  const rng = mulberry32(3)
  let seen = [], last = null
  for (let i = 0; i < 2000; i++) {
    const f = pickFact(facts, seen, last, rng, [], limits)
    assert.ok(f, 'the gate emptied the pool')
    assert.ok(f.difficulty <= limits.maxDifficulty, `${f.id} is difficulty ${f.difficulty}`)
    assert.ok(f.q.length <= limits.maxQ, `${f.id} asks ${f.q.length} characters`)
    if (last && facts.some((x) => x.kind !== last && inBandOf(x, limits) && !seen.includes(x.id))) {
      assert.notEqual(f.kind, last, 'the kinds stopped alternating inside the band')
    }
    seen = seen.concat(f.id); last = f.kind
  }
  // the band is big enough to be a pool, not a loop
  const inBand = facts.filter((f) => inBandOf(f, limits))
  assert.ok(inBand.length >= 20, `only ${inBand.length} items inside the Corner Shop band`)
  assert.ok(inBand.some((f) => f.kind === 'elevator') && inBand.some((f) => f.kind === 'math'), 'both kinds must be stocked')
})

test('a due retry above the level band is not served, and Megatall is ungated', () => {
  const { facts } = loadFacts(shipped)
  const rng = mulberry32(4)
  const hard = facts.find((f) => f.difficulty === 3)
  const retry = [{ id: hard.id, at: 0 }]
  const seen = new Array(30).fill('x')
  const got = pickFact(facts, seen, null, rng, retry, TRIVIA_LIMITS.corner)
  assert.notEqual(got.id, hard.id, 'a fact met at Megatall came back after a drop to Corner Shop')
  assert.equal(pickFact(facts, seen, null, rng, retry, TRIVIA_LIMITS.megatall).id, hard.id)
  assert.equal(TRIVIA_LIMITS.megatall, null)
})

// ---- round 1, fixer 3: the bank's own gates ----------------------------------------------------

const auditFile = JSON.parse(readFileSync(new URL('../data/trivia-audit.json', import.meta.url), 'utf8'))

// r1-trivia-truth-01's ROOT CAUSE: the audit recorded a fix (cite Maine, not the Pennsylvania rule
// it had itself called rotten) and the shipped item never received it. Nothing compared the two
// files, so the record and the artefact could drift for ever.
test('the audit record and the shipped bank say the same thing', () => {
  const shownById = new Map(shipped.items.map((i) => [i.id, i]))
  const auditById = new Map(auditFile.items.map((i) => [i.id, i]))
  assert.equal(auditById.size, shownById.size, 'the audit holds a different number of items')
  for (const [id, it] of shownById) {
    const a = auditById.get(id)
    assert.ok(a, `${id} is shipped with no audit record`)
    for (const k of ['question', 'answer', 'fact']) assert.equal(a[k], it[k], `${id}: audit and bank disagree on ${k}`)
    assert.deepEqual(a.distractors, it.distractors, `${id}: distractors`)
    assert.deepEqual(a.sources.map((s) => s.url), it.sources.map((s) => s.url), `${id}: the audit and the bank cite different sources`)
    assert.deepEqual(a.sources.map((s) => s.quote), it.sources.map((s) => s.quote), `${id}: the audit and the bank show different quotes`)
  }
})

// r1-trivia-truth-07: the Fact card is read by a 7–12-year-old.
test('every shown fact fits in one breath and every shown source carries its quote', () => {
  for (const it of shipped.items) {
    assert.ok(it.fact.length <= 360, `${it.id}: the fact is ${it.fact.length} characters`)
    assert.ok(it.sources.length >= 1, `${it.id}: no source`)
    for (const s of it.sources) {
      assert.ok(/^https?:\/\//.test(s.url), `${it.id}: ${s.url}`)
      assert.ok(s.quote && s.quote.trim().length > 10, `${it.id}: ${s.title} is cited with no quote`)
    }
  }
})

// r1-trivia-truth-06: pickFact prefers unseen items, so a child meets both halves of a leaking pair
// inside one pool cycle and the "quiz" half becomes a memory check.
test('no item gives away another item\'s answer, except the documented teach-then-quiz pair', () => {
  // The Eiffel pair is deliberate: elevator-records-eiffel-lifts-around-the-world is an ARITHMETIC
  // question (103,000 ÷ 40,000), and it cannot ask it without naming its inputs.
  const ALLOWED = new Set(['elevator-records-eiffel-lifts-around-the-world -> elevator-history-eiffel-lifts-distance'])
  const core = (a) => String(a).trim().replace(/^(About|Roughly|Around)\s+/i, '').trim()
  const leaks = []
  for (const a of shipped.items) {
    const c = core(a.answer)
    if (c.length < 4) continue
    for (const b of shipped.items) {
      if (a.id === b.id) continue
      const hay = `${b.question} ${b.fact}`
      let i = hay.indexOf(c)
      while (i >= 0) {
        const before = hay[i - 1] || ' ', after = hay[i + c.length] || ' '
        if (!/[\d,]/.test(before) && !/[\d,]/.test(after)) {   // not a fragment of a longer number
          const key = `${b.id} -> ${a.id}`
          if (!ALLOWED.has(key)) leaks.push(`${key} ("${c}")`)
          break
        }
        i = hay.indexOf(c, i + 1)
      }
    }
  }
  assert.deepEqual(leaks, [], `answer leakage between items: ${leaks.join(' | ')}`)
})

// The specific corrections, so a later edit cannot quietly undo them.
test('the round-1 corrections are in the shipped bank', () => {
  const get = (id) => shipped.items.find((i) => i.id === id)
  const cert = get('elevator-engineering-inspection-certificate')
  assert.ok(/Maine/.test(cert.fact), 'the fact talks about Maine')
  assert.ok(cert.sources.some((s) => /legislature\.maine\.gov/.test(s.url)), 'a sentence about Maine law must show a Maine source')
  assert.ok(!cert.sources.some((s) => /pacodeandbulletin/.test(s.url)), 'the Pennsylvania rule the audit rejected is still cited')
  const thirteen = get('elevator-culture-thirteenth-floor')
  assert.ok(/condominium/.test(thirteen.fact) && !/apartment/.test(thirteen.fact), 'the wording must match the population the study counted')
  assert.ok(thirteen.sources.some((s) => /academic\.oup\.com/.test(s.url)), 'the 2024 count needs a shown source')
  assert.ok(!/1990/.test(get('elevator-engineering-kone-monospace-1996').fact), 'the unsourceable Otis-1990 parenthetical is back')
  assert.ok(!/minute and a half/.test(get('elevator-records-bailong-outdoor-elevator').fact), 'the ride time must not out-run its own citation')
  const col = get('elevator-history-colosseum-capstans')
  assert.ok(!col.sources.some((s) => /wikipedia/i.test(s.url)), 'a source whose quote contradicts the fact is still shipped')
  const chess = get('math-numbers-chessboard-doubling')
  assert.ok(!/quintillion|trillion/.test([chess.answer, ...chess.distractors].join(' ')), 'short-scale names are not answers a UK child can rely on')
  assert.equal(chess.answer, 'A 20-digit number')
  assert.equal(String(2n ** 64n - 1n).length, 20, 'the arithmetic behind the answer')
})


// ---- round 2: the bank's corrections -----------------------------------------------------------

// r2-elevator-feel-02 / r2-trivia-truth-02: §1604.25 is Subchapter 4, Construction Safety Orders,
// Article 14 "Construction Hoists" — different machines, and its factor table stops at 10.70, so it
// does not contain the "nearly 12 times" the fact quotes. §3042 is the Elevator Safety Orders
// section and does. The audit caught it in round 1 ("Misattributed source"), the fact text was
// corrected and sources[] was not, and the card contradicted itself two lines apart on screen.
test('r2: a fact that names a regulation shows that regulation', () => {
  const ropes = shipped.items.find((i) => i.id === 'elevator-engineering-minimum-three-ropes')
  assert.match(ropes.fact, /section 3042/)
  assert.ok(ropes.sources.some((s) => /dir\.ca\.gov\/title8\/3042/.test(s.url)), 'the shown source must be the elevator rule the fact names')
  assert.ok(!ropes.sources.some((s) => /8-CCR-1604\.25/.test(s.url)), 'the construction-hoist rule is still cited as the source')
  assert.match(ropes.sources[0].quote, /three for traction elevators/)
  // and the general rule, so the next item cannot repeat it
  for (const it of shipped.items) {
    for (const m of it.fact.matchAll(/section (\d{3,5})/g)) {
      const n = m[1]
      assert.ok(it.sources.some((s) => s.url.includes(n) || (s.title || '').includes(n)), `${it.id}: the fact names section ${n} and no shown source carries it`)
    }
  }
})

// r2-trivia-truth-01: the question said 2016 (the Mitsubishi press release) while the fact and
// Guinness both date the record to 27 October 2015. One card, two dates, for a child who reads dates.
test('r2: a card never gives two different years for the same event', () => {
  const tall = shipped.items.find((i) => i.id === 'elevator-records-tallest-lift-in-a-building')
  assert.ok(!/2016/.test(tall.question), `the question still dates the record: "${tall.question}"`)
  const YEAR = /\b(1[6-9]\d\d|20\d\d)\b/g
  for (const it of shipped.items) {
    const qy = new Set((it.question.match(YEAR) || []))
    const fy = new Set((it.fact.match(YEAR) || []))
    for (const y of qy) assert.ok(fy.size === 0 || fy.has(y) || /as of/i.test(it.question), `${it.id}: the question says ${y} and the fact says ${[...fy].join(', ')}`)
  }
})

// r2-trivia-truth-03: the exhibition and the 20-metre tower were true and carried by neither shown
// source. Under the strict-sourcing rule every clause of a shown fact is carried by a shown source.
test('r2: the Siemens 1880 details are carried by a shown source', () => {
  const sie = shipped.items.find((i) => i.id === 'elevator-history-siemens-electric-1880')
  assert.match(sie.fact, /Pfalzgau exhibition/)
  assert.ok(!/streetcar/.test(sie.fact), 'the uncited streetcar clause is back')
  const quotes = sie.sources.map((x) => x.quote).join(' ')
  assert.match(quotes, /20-meter-high observation tower/)
  assert.match(quotes, /8,000 visitors/)
})

// r2-math-09: two pure arithmetic word problems were filed as `elevator`, so pickFact's kind
// alternation could hand a child two maths word problems in a row believing it had alternated.
test('r2: an arithmetic word problem is a maths item', () => {
  for (const id of ['math-everyday-counterweight-subtraction', 'math-everyday-floors-per-second']) {
    assert.equal(shipped.items.find((i) => i.id === id).category, 'math', id)
  }
  for (const it of shipped.items) {
    if (/^math-/.test(it.id)) assert.equal(it.category, 'math', `${it.id} is filed as ${it.category}`)
  }
})

// r2-math-10: difficulty and question length do not band ARITHMETIC. At `numbers to 10` the bank
// could serve `8 capsules x 5 seats` (40) and `1, 1, 2, 3, 5, 8, 13 — what is next?` (8 + 13).
test('r2: a passenger never asks arithmetic above the level the child is on', () => {
  const { facts } = loadFacts(shipped)
  for (const [level, limits] of Object.entries(TRIVIA_LIMITS)) {
    if (!limits) continue
    for (const f of facts) {
      if (!inBandOf(f, limits)) continue
      if (f.maths) assert.ok(f.maths.max <= limits.maxNumber, `${level}: ${f.id} asks for ${f.maths.max}, above ${limits.maxNumber}`)
    }
  }
  const byId = new Map(facts.map((f) => [f.id, f]))
  assert.ok(byId.get('elevator-records-gateway-arch-tram-seats').maths.max === 40)
  assert.ok(!inBandOf(byId.get('elevator-records-gateway-arch-tram-seats'), TRIVIA_LIMITS.corner), '8 x 5 is still inside `numbers to 10`')
  assert.ok(!inBandOf(byId.get('math-everyday-fibonacci-next'), TRIVIA_LIMITS.hotel), '8 + 13 is still inside `numbers to 20`')
  // the band must still be a pool, not a loop
  for (const level of ['corner', 'hotel']) {
    const inb = facts.filter((f) => inBandOf(f, TRIVIA_LIMITS[level]))
    assert.ok(inb.length >= 20, `${level}: ${inb.length} items left in the band`)
    assert.ok(inb.some((f) => f.kind === 'elevator') && inb.some((f) => f.kind === 'math'), `${level}: both kinds must be stocked`)
  }
})

// r2-math-11: a question a 7-12-year-old cannot answer before reading the options.
test('r2: the two loosely worded questions say what they are asking', () => {
  const chess = shipped.items.find((i) => i.id === 'math-numbers-chessboard-doubling')
  assert.match(chess.question, /How many digits long/)
  const et = shipped.items.find((i) => i.id === 'elevator-culture-etiquette-nearest-doors')
  assert.match(et.question, /step out or in first/)
})

// r2-autism-fit-09: a refuting lens that reads the SAME document as the confirming one is not an
// independent check. Three items did; the three-ropes one is fixed by the citation correction above
// and DESIGN amendment 1 now states what the record actually shows for the other two.
test('r2: the hostile lens reads a different document from the confirming one, or is declared', () => {
  const DECLARED = new Set(['elevator-engineering-infrared-light-curtain', 'elevator-records-space-elevator-orbit-height'])
  const same = []
  for (const it of shipped.items) {
    const c = it.verification.find((v) => v.lens === 'confirm')
    const r = it.verification.find((v) => v.lens === 'refute')
    if (c && r && c.source_url === r.source_url && !DECLARED.has(it.id)) same.push(it.id)
  }
  assert.deepEqual(same, [], `both lenses read one document: ${same.join(', ')}`)
})
