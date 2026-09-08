// The trivia loader and picker. Pure. The gate is the one in docs/DESIGN.md amendment 1:
// both verification lenses, one http(s) source, three unique distractors none equal to the
// answer, and none of the forbidden words anywhere in the item.

const FORBIDDEN = /\b(death|dead|die|died|killed|injur\w*|crash\w*|trapped|accident\w*)\b/i

export function loadFacts(json) {
  const items = Array.isArray(json) ? json : (json && Array.isArray(json.items) ? json.items : [])
  const facts = []
  const rejected = []
  const ids = new Set()
  for (const it of items) {
    const id = it && typeof it.id === 'string' ? it.id : null
    if (!id) { rejected.push({ id: null, reason: 'missing id' }); continue }
    if (ids.has(id)) { rejected.push({ id, reason: 'duplicate id' }); continue }
    const reason = gate(it)
    if (reason) { rejected.push({ id, reason }); continue }
    ids.add(id)
    facts.push({
      id,
      kind: it.category === 'math' ? 'math' : 'elevator',
      difficulty: Number.isInteger(it.difficulty) ? it.difficulty : 2,
      ...(it.maths && Number.isFinite(+it.maths.max) ? { maths: { max: +it.maths.max } } : {}),
      q: it.question.trim(),
      answer: String(it.answer).trim(),
      distractors: it.distractors.map((d) => String(d).trim()),
      fact: it.fact.trim(),
      sources: it.sources.map((s) => ({ title: String(s.title || '').trim(), url: String(s.url || '').trim(), quote: s.quote ? String(s.quote) : undefined })),
      verification: it.verification.map((v) => ({ lens: v.lens, source_title: v.source_title, source_url: v.source_url })),
    })
  }
  return { facts, rejected }
}

function gate(it) {
  if (it.category !== 'elevator' && it.category !== 'math') return 'category must be elevator or math'
  if (typeof it.question !== 'string' || !it.question.trim()) return 'missing question'
  if (it.answer === undefined || it.answer === null || String(it.answer).trim() === '') return 'missing answer'
  if (!Array.isArray(it.distractors) || it.distractors.length !== 3) return 'needs exactly three distractors'
  const ds = it.distractors.map((d) => String(d).trim())
  if (new Set(ds).size !== 3) return 'distractors are not unique'
  if (ds.includes(String(it.answer).trim())) return 'a distractor equals the answer'
  if (typeof it.fact !== 'string' || !it.fact.trim()) return 'missing fact'
  if (!Array.isArray(it.sources) || !it.sources.some((s) => s && typeof s.url === 'string' && /^https?:\/\//i.test(s.url))) return 'no http(s) source url'
  if (!Array.isArray(it.verification)) return 'missing verification'
  const lenses = new Set(it.verification.map((v) => v && v.lens))
  if (!lenses.has('confirm') || !lenses.has('refute')) return 'verification needs both a confirm and a refute lens'
  const text = [it.question, String(it.answer), ...ds, it.fact].join(' ')
  const m = text.match(FORBIDDEN)
  if (m) return `forbidden word: ${m[0]}`
  return null
}

export function isPassengerFloor(floor, cadence) {
  if (cadence === 'often') return floor === 3 || floor === 6 || floor === 9
  if (cadence === 'never') return false
  return floor === 4 || floor === 8 // sometimes (default)
}

// Three choices from four options: the answer plus two of the three distractors, shuffled by the rng.
export function makeChoices(fact, rng) {
  const ds = fact.distractors.slice()
  ds.splice(Math.floor(rng() * ds.length), 1)
  const choices = [fact.answer, ...ds]
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[choices[i], choices[j]] = [choices[j], choices[i]]
  }
  return { choices, answer: choices.indexOf(fact.answer) }
}

// THE FACT POOL IS GATED BY LEVEL. A child at `numbers to 10` was drawing difficulty-3, 183-character
// questions, because the picker knew the level existed and never asked it. The band is applied
// FIRST, so it also covers the comeback branch (a fact met at Megatall does not follow a child down
// to Corner Shop) and the all-seen recycle (a Corner Shop child recycles inside their own band
// rather than escaping it). Measured pool: 67 items → 22 at d ≤ 1 / q ≤ 130 (10 elevator, 12 maths,
// eleven buildings of two passengers before anything repeats), 54 at d ≤ 2 / q ≤ 160.
// `maxNumber` bands the ARITHMETIC a passenger's question asks the child to do, which difficulty
// and question length do not: at `numbers to 10` the bank could serve `8 capsules x 5 seats` and
// `1, 1, 2, 3, 5, 8, 13 - what is next?` (8 + 13). The game bands its own sums level by level; the
// maths it hands the same child through a passenger is banded by the same ladder.
export const TRIVIA_LIMITS = Object.freeze({
  corner: { maxDifficulty: 1, maxQ: 130, maxNumber: 10 },
  hotel: { maxDifficulty: 1, maxQ: 130, maxNumber: 20 },
  office: { maxDifficulty: 2, maxQ: 160, maxNumber: 100 },
  sky: { maxDifficulty: 2, maxQ: 160, maxNumber: 144 },
  megatall: null,
  custom: null,
})

// An item declares `maths: {max}` when answering it means doing arithmetic the child may not have
// met. No declaration = no arithmetic to do, so no band applies.
export function withinNumberBand(fact, limits) {
  if (!limits || !Number.isFinite(limits.maxNumber)) return true
  const m = fact && fact.maths
  if (!m || !Number.isFinite(m.max)) return true
  return m.max <= limits.maxNumber
}

// pickFact: a missed fact that is due (≥ 20 questions ago) first; then unseen of the other kind;
// then unseen of any kind; then the least recently seen (kinds still alternating when possible).
// `seen` is the ordered list of fact ids met, one entry per fact, most recent last; `retry` is
// [{id, at}] where `at` is the question count when it was missed; `limits` is a TRIVIA_LIMITS row
// (null = no band). `count` is the caller's monotonic question count — `seen.length` stopped being
// one when `seen` was de-duplicated, and the ≥ 20 rule is about QUESTIONS, not distinct facts.
export function pickFact(facts, seen = [], lastKind = null, rng, retry = [], limits = null, count = seen.length) {
  if (!facts || !facts.length) return null
  const banded = limits ? facts.filter((f) => f.difficulty <= limits.maxDifficulty && f.q.length <= limits.maxQ && withinNumberBand(f, limits)) : facts
  const inBand = banded.length ? banded : facts
  const byId = new Map(inBand.map((f) => [f.id, f]))
  const due = retry.filter((r) => r && byId.has(r.id) && count - r.at >= 20)
  if (due.length) return byId.get(due[0].id)
  const seenSet = new Set(seen)
  const otherKind = lastKind === 'elevator' ? 'math' : lastKind === 'math' ? 'elevator' : null
  const unseen = inBand.filter((f) => !seenSet.has(f.id))
  let pool = unseen
  if (otherKind && unseen.some((f) => f.kind === otherKind)) pool = unseen.filter((f) => f.kind === otherKind)
  if (pool.length) return pool[Math.floor(rng() * pool.length)]
  // All seen: recycle the least recently shown, alternating kinds when it can.
  const lastIndex = new Map()
  seen.forEach((id, i) => lastIndex.set(id, i))
  let cands = inBand.slice()
  if (otherKind && cands.some((f) => f.kind === otherKind)) cands = cands.filter((f) => f.kind === otherKind)
  cands.sort((x, y) => (lastIndex.get(x.id) ?? -1) - (lastIndex.get(y.id) ?? -1))
  const oldest = lastIndex.get(cands[0].id) ?? -1
  const ties = cands.filter((f) => (lastIndex.get(f.id) ?? -1) === oldest)
  return ties[Math.floor(rng() * ties.length)]
}

export function domainOf(url) {
  const m = /^https?:\/\/([^/?#]+)/i.exec(url || '')
  return m ? m[1].replace(/^www\./, '') : ''
}
