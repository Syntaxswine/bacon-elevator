// THE CONTENT GATE, IN ONE PLACE.
//
// Three banks now put sourced sentences in front of the child — the passenger facts
// (data/trivia.json), the part cards (data/parts.json) and The Climb (data/climb.json) — and every
// one of them shows the source title on the card. Round 3 found the fact bank's gate reading past
// the only line that carried a memorial (`Reed Magazine: In Memoriam …` on the Pi Day card,
// r3-trivia-truth-01), and round 3's own note says the fix must never be re-implemented: a second
// copy of a gate is a second thing to forget. `trivia.js`, `parts.js` and `climb.js` all IMPORT
// these; none of them re-states the comparison.
//
// Two lists, deliberately different widths:
//  - FORBIDDEN scans the sentences the game itself wrote (question, answer, distractors, fact,
//    a part's `real` line, a climb entry's `line`).
//  - CITATION_FORBIDDEN scans what the child can SEE or FOLLOW in a citation — title, url, quote —
//    and is wider, because a memorial page announces itself in words the first list never had.
//    It deliberately does NOT carry `grave`: Elisha GRAVES Otis is in the banks' source titles, and
//    a gate that fires on a middle name polices a spelling, not a hazard.
export const FORBIDDEN = /\b(death|dead|die|died|killed|injur\w*|crash\w*|trapped|accident\w*)\b/i
export const CITATION_FORBIDDEN = /\b(death|dead|die|died|killed|injur\w*|crash\w*|trapped|accident\w*|memoriam|memorial|obituar\w*|funeral|posthumous\w*)\b/i

export function domainOf(url) {
  const m = /^https?:\/\/([^/?#]+)/i.exec(url || '')
  return m ? m[1].replace(/^www\./, '') : ''
}

// The word the child would have read, or null. Callers phrase their own reason string.
export function forbiddenWord(text) {
  const m = String(text == null ? '' : text).match(FORBIDDEN)
  return m ? m[0] : null
}

export function forbiddenCitationWord(text) {
  const m = String(text == null ? '' : text).match(CITATION_FORBIDDEN)
  return m ? m[0] : null
}

// A source list good enough to print. Returns a reason string, or null when it passes.
//
// `Source: piday.org (piday.org)` was shipped once and read as a broken line rather than a
// citation (r3-trivia-truth-06), so a title that is merely its own domain is refused here rather
// than in a test that only ever looked at one of the three banks.
export function sourcesReason(sources) {
  if (!Array.isArray(sources) || !sources.length) return 'no sources'
  if (!sources.some((s) => s && typeof s.url === 'string' && /^https?:\/\//i.test(s.url))) return 'no http(s) source url'
  for (const s of sources) {
    if (!s || typeof s !== 'object') return 'a source is not an object'
    const title = String(s.title || '').trim()
    if (!title) return 'a source has no title'
    const dom = domainOf(s.url)
    if (dom && title.toLowerCase().replace(/^www\./, '') === dom.toLowerCase()) return `a source title is just its own domain: ${title}`
    const bad = forbiddenCitationWord([title, String(s.url || ''), String(s.quote || '')].join(' '))
    if (bad) return `forbidden word in a source: ${bad}`
  }
  return null
}
