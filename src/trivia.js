// The trivia loader and picker. Pure. The gate is the one in docs/DESIGN.md amendment 1:
// both verification lenses, one http(s) source, three unique distractors none equal to the
// answer, and none of the forbidden words anywhere in the item.
//
// THE WORD LISTS AND THE CITATION CHECK NOW LIVE IN src/gate.js, imported here and by parts.js and
// climb.js. They used to be module-private constants in this file, so the two banks added in the
// content round would have had to re-implement the comparison — which is how a gate stops being one
// gate (r3-trivia-truth-01 was the first copy going stale). Nothing about what this gate REFUSES
// changed with the move; test/trivia.test.js and test/round3.test.js run the same assertions.
import { forbiddenWord, sourcesReason, domainOf as domainOfUrl } from './gate.js'

export const CHOICE_LETTERS = Object.freeze(['A', 'B', 'C'])
export const letterFor = (i) => CHOICE_LETTERS[i] || ''

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
      ...(typeof it.concept === 'string' && it.concept ? { concept: it.concept } : {}),
      ...(it.maths && Number.isFinite(+it.maths.max) ? { maths: { max: +it.maths.max, ...(it.maths.exact === false ? { exact: false } : {}) } } : {}),
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
  const m = forbiddenWord(text)
  if (m) return `forbidden word: ${m}`
  // Everything the child can SEE or FOLLOW, not only the sentences the game wrote itself.
  const bad = sourcesReason(it.sources)
  if (bad) return bad
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
// `denyConcepts` bands the KIND OF MATHS a passenger asks, which difficulty, question length and
// number size between them do not (r4-math-08). Every one of Corner Shop's ten maths items was
// recall trivia and not one was arithmetic the child can do, which is fine — but the band also let
// through `Which of these numbers is NOT a prime number?` (difficulty 1, 45 characters, so both
// gates pass it) at `numbers to 10`, in the negative form, and `How many zeros come after the 1 in
// a googol?`. The youngest two buildings get counting, shapes, notation and everyday maths; number
// theory and the very large numbers wait for Office Block. An item with no `concept` is unbanded.
export const TRIVIA_LIMITS = Object.freeze({
  corner: { maxDifficulty: 1, maxQ: 130, maxNumber: 10, denyConcepts: ['number-theory', 'large-numbers'] },
  hotel: { maxDifficulty: 1, maxQ: 130, maxNumber: 20, denyConcepts: ['number-theory', 'large-numbers'] },
  office: { maxDifficulty: 2, maxQ: 160, maxNumber: 100 },
  sky: { maxDifficulty: 2, maxQ: 160, maxNumber: 144 },
  megatall: null,
  custom: null,
})

// ONE BAND PREDICATE, so a caller (or a test) cannot re-implement three quarters of it and drift.
export function withinBand(fact, limits) {
  if (!limits) return true
  if (!(fact.difficulty <= limits.maxDifficulty)) return false
  if (!(fact.q.length <= limits.maxQ)) return false
  if (!withinNumberBand(fact, limits)) return false
  if (Array.isArray(limits.denyConcepts) && fact.concept && limits.denyConcepts.includes(fact.concept)) return false
  return true
}

// An item declares `maths: {max}` when answering it means doing arithmetic the child may not have
// met. No declaration = no arithmetic to do, so no band applies.
export function withinNumberBand(fact, limits) {
  if (!limits || !Number.isFinite(limits.maxNumber)) return true
  const m = fact && fact.maths
  if (!m || !Number.isFinite(m.max)) return true
  // r3-math-07: the band measured the SIZE of the numbers and not the KIND of arithmetic, so
  // `10 metres ÷ 4 metres = 2.5 floors` (maths.max 10) reached Office Block and Skyscraper — levels
  // whose own tables state `division always exact` and which have never put a decimal on the panel.
  // `exact: false` is the item's own declaration that answering it leaves the integers; it is
  // served only where the ladder has no ceiling left (Megatall and Custom, limits === null).
  if (m.exact === false) return false
  return m.max <= limits.maxNumber
}

// pickFact: a missed fact that is due (≥ 20 questions ago) first; then unseen of the other kind;
// then unseen of any kind; then the least recently seen (kinds still alternating when possible).
// `seen` is the ordered list of fact ids met, one entry per fact, most recent last; `retry` is
// [{id, at}] where `at` is the question count when it was missed; `limits` is a TRIVIA_LIMITS row
// (null = no band). `count` is the caller's monotonic question count — `seen.length` stopped being
// one when `seen` was de-duplicated, and the ≥ 20 rule is about QUESTIONS, not distinct facts.
export function pickFact(facts, seen = [], lastKind = null, rng, retry = [], limits = null, count = seen.length, lastWasRetry = false) {
  if (!facts || !facts.length) return null
  const banded = limits ? facts.filter((f) => withinBand(f, limits)) : facts
  const inBand = banded.length ? banded : facts
  const byId = new Map(inBand.map((f) => [f.id, f]))
  const due = retry.filter((r) => r && byId.has(r.id) && count - r.at >= 20)
  // A RETRY MAY NOT FOLLOW A RETRY — the belt makeProblem's comeback queue already wears
  // (math.js: "a comeback may not follow a comeback"). A child who missed everything filled the
  // retry list with four or five ids, one of which was always due, so the unseen pool was never
  // reached again: 400 passenger questions, 4 distinct facts, one served 100 times, at Corner Shop
  // and at Megatall alike (r3-code-hostile-06). Deferring one retry by a single passenger costs
  // nothing — it is still due next time — and lets the bank keep opening.
  if (due.length && !lastWasRetry) return { ...byId.get(due[0].id), fromRetry: true }
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

// One definition, in gate.js: the fact card, the Fact Book, the part card and the Climb all print
// `Source: <title> (<domain>)`.
export const domainOf = domainOfUrl
