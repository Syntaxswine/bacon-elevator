// The trivia loader and picker. Pure. The gate is the one in docs/DESIGN.md amendment 1:
// both verification lenses, one http(s) source, three unique distractors none equal to the
// answer, and none of the forbidden words anywhere in the item.

const FORBIDDEN = /\b(death|dead|die|died|killed|injur\w*|crash\w*|trapped|accident\w*)\b/i
// r3-trivia-truth-01: the gate scanned question/answer/distractors/fact and stopped there, but
// `sources[].title` is rendered verbatim on the fact card (screens.js factSheet) and as the link
// text in the Fact Book. The Pi Day item shipped `Reed Magazine: In Memoriam, Larry Shaw 1961`
// pointing at `/obituaries/`, so the one gate written to keep death off the child's reward screen
// was reading past the only line that carried it. The citation lens is WIDER than the child-text
// lens — a memorial page announces itself in words FORBIDDEN never had — and it reads the url too,
// where the give-away usually lives. It deliberately does NOT carry `grave`: Elisha GRAVES Otis is
// in the bank's source titles, and a gate that fires on a middle name polices a spelling, not a
// hazard.
const CITATION_FORBIDDEN = /\b(death|dead|die|died|killed|injur\w*|crash\w*|trapped|accident\w*|memoriam|memorial|obituar\w*|funeral|posthumous\w*)\b/i

// The letters that label the three trivia choices. ONE definition: the panel prints them as badges
// beside each option, the display band names the answer by letter, and the fact card names it by
// letter AND text. While the letter lived in panel.js alone the fact card could not reach it, so the
// band said `The answer is C.` and the card, 900 ms later, said `The answer is A lift.` — two
// sentences with the same stem and different referents, in a game built for a literal reader
// (r3-autism-fit-01).
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
  const m = text.match(FORBIDDEN)
  if (m) return `forbidden word: ${m[0]}`
  // Everything the child can SEE or FOLLOW, not only the sentences the game wrote itself.
  const cited = it.sources.flatMap((x) => [String((x && x.title) || ''), String((x && x.url) || ''), String((x && x.quote) || '')]).join(' ')
  const c = cited.match(CITATION_FORBIDDEN)
  if (c) return `forbidden word in a source: ${c[0]}`
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
  const banded = limits ? facts.filter((f) => f.difficulty <= limits.maxDifficulty && f.q.length <= limits.maxQ && withinNumberBand(f, limits)) : facts
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

export function domainOf(url) {
  const m = /^https?:\/\/([^/?#]+)/i.exec(url || '')
  return m ? m[1].replace(/^www\./, '') : ''
}
