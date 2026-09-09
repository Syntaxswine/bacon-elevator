// HOSTILE REVIEW ROUND 3 — one test per confirmed finding, each written so it FAILS on the tree
// that was reviewed. Findings whose whole surface is layout or DOM behaviour live in
// tools/drive-scenarios.mjs instead (r3-mobile-ux-1/-2/-4/-5/-7, r3-elevator-feel-03/-04/-06,
// r3-code-hostile-01/-02/-03/-05/-07); they are named where they sit.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { mulberry32 } from '../src/rng.js'
import { LEVELS, LEVEL_ORDER, customLevel } from '../src/levels.js'
import { makeProblem, afterAnswer, initialCtx, SAME_FUSE } from '../src/math.js'
import { lunchboxMilestone, PARTS, PLAQUES } from '../src/state.js'
import { loadFacts, pickFact, withinNumberBand, withinBand, TRIVIA_LIMITS, CHOICE_LETTERS } from '../src/trivia.js'
import { factSheet, rules, lobby, roof } from '../src/render/screens.js'
import { fresh, makeRng, startRide, answer, run, FACTS } from './_helpers.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const shipped = JSON.parse(read('data/trivia.json'))

// ---- r3-autism-fit-01 ---------------------------------------------------------------------
// The beat panel says `The answer is C.` and the fact card, 900 ms later, said `The answer is A
// lift.` — the same sentence stem, one naming a LETTER and one naming TEXT that starts with "A".
// Seven of the 67 items have an answer beginning "A "/"An ", five of them inside Corner Shop's
// 22-item band, and eleven have such a DISTRACTOR, which the `You chose …` line hit too.
test('r3-autism-fit-01: the fact card names the answer by the same letter the display band does', () => {
  const f = loadFacts(shipped).facts.find((x) => x.id === 'elevator-engineering-lift-vs-elevator')
  assert.ok(f, 'the lift-vs-elevator item is in the bank')
  const choices = ['A trolley', 'An escalator', 'A lift']
  const html = factSheet({ trivia: { fact: f, choices, answer: 2, chosen: 0, result: 'wrong' } })
  assert.match(html, /You chose A: A trolley\./, html.replace(/<[^>]+>/g, ' '))
  assert.match(html, /The answer is C: A lift\./, html.replace(/<[^>]+>/g, ' '))
  // and every answer that begins "A "/"An " is now introduced by its letter, on every item
  const risky = shipped.items.filter((it) => /^An? /.test(String(it.answer)))
  assert.ok(risky.length >= 5, `only ${risky.length} items begin "A "/"An "`)
  for (const it of risky) {
    const fact = loadFacts({ items: [it] }).facts[0]
    if (!fact) continue
    const cs = [String(it.answer), ...it.distractors.slice(0, 2).map(String)]
    const sheet = factSheet({ trivia: { fact, choices: cs, answer: 0, chosen: 1, result: 'wrong' } })
    assert.match(sheet, new RegExp(`The answer is ${CHOICE_LETTERS[0]}: `), it.id)
  }
})

// ---- r3-math-01 ---------------------------------------------------------------------------
// Custom with ONE operation builds a table smaller than the 20-key ring (× at Largest 20 is ten
// keys), and a single-kind step also made the kind-run guard permanently true, so all 50 retries
// were rejected and `if (last) return last` served an unchecked sum — including the one just
// answered. DESIGN §4 says a key in the ring is rejected; DESIGN §13 says repeats < 1 %.
test('r3-math-01: a one-operation Custom level never serves the identical sum twice running', () => {
  const CONFIGS = [
    { ops: ['mul'], min: 2, max: 20 }, { ops: ['div'], min: 2, max: 20 },
    { ops: ['mul'], min: 2, max: 100 }, { ops: ['add'], min: 0, max: 5 },
    { ops: ['sub'], min: 2, max: 20 }, { ops: ['up'], min: 2, max: 20 },
    { ops: ['down'], min: 2, max: 20 }, { ops: ['missAdd'], min: 2, max: 20 },
    { ops: ['add', 'sub'], min: 2, max: 5 },
  ]
  for (const cfg of CONFIGS) {
    const level = customLevel(cfg)
    let backToBack = 0, n = 0
    for (let seed = 1; seed <= 12; seed++) {
      const rng = mulberry32(seed)
      const roll = mulberry32(1000 + seed)
      let ctx = initialCtx(), prev = null
      for (let i = 0; i < 250; i++) {
        const p = makeProblem(level, 1, ctx, rng)
        n++
        if (prev === p.key) backToBack++
        prev = p.key
        ctx = afterAnswer(ctx, p, roll() < 0.8)
        ctx = { ...ctx, comeback: ctx.comeback.slice(-12) }
        if (i % 9 === 8) ctx = { ...ctx, sameSeen: 0 }
      }
    }
    // The pool can legitimately be smaller than the 20-key ring (× at Largest 20 is ten sums, which
    // is the sibling finding r3-math-06); what it may never do is hand back the sum just answered.
    assert.equal(backToBack, 0, `${cfg.ops}/${cfg.min}-${cfg.max}: ${backToBack} of ${n} questions repeated the one before`)
  }
})

// ---- r3-math-02 ---------------------------------------------------------------------------
// The ladder offered LEVEL_ORDER[idx + 1] and nothing else, so a child who accepted one offer too
// many fell on most questions of every building for ever with no route back down — while
// history.falls recorded every one of them and no renderer read it.
test('r3-math-02: two buildings of falling on the bottom step offer the smaller building back', () => {
  const rng = makeRng(42)
  let s = fresh(42, { seed: 42 })
  s = run(s, { type: 'set-level', id: 'office' }, rng).state
  s = startRide(s, rng)
  const buildingWithFalls = (st) => {
    let guard = 0
    while (st.phase !== 'roof' && guard++ < 200) {
      if (st.phase === 'floor' || st.phase === 'keypad') st = answer(st, rng, false).state
      else if (st.phase === 'trivia') st = run(run(st, { type: 'choice', i: 0 }, rng).state, { type: 'card-continue' }, rng).state
      else if (st.phase === 'repair') { st = run(st, { type: 'card-continue' }, rng).state; st = answer(st, rng, true).state }
      else throw new Error('stuck at ' + st.phase)
    }
    return st
  }
  s = buildingWithFalls(s)
  assert.ok(s.ride.falls >= 5, `first building fell ${s.ride.falls} times`)
  assert.equal(s.step, 1, 'a child who falls on everything is pinned at step 1')
  assert.equal(s.struggleRun, 1)
  assert.equal(s.roof.offer, null, 'one bad building is not evidence')
  s = run(s, { type: 'next-building' }, rng).state
  s = buildingWithFalls(s)
  assert.equal(s.struggleRun, 2)
  assert.equal(s.roof.offer, 'hotel', 'after two, the roof offers the building below')
  const idx = LEVEL_ORDER.indexOf('office')
  assert.equal(s.roof.offer, LEVEL_ORDER[idx - 1])
  const taken = run(s, { type: 'offer', accept: true }, rng).state
  assert.equal(taken.level, 'hotel')
  assert.equal(taken.step, 1)
  assert.equal(taken.struggleRun, 0, 'the counter resets with the offer')
  // …and Corner Shop, the bottom of the ladder, never offers a level below itself
  let c = fresh(7, { seed: 7 })
  c = { ...c, struggleRun: 5, step: 1 }
  c = startRide(c, rng)
  c = buildingWithFalls(c)
  assert.equal(c.roof.offer, null, 'there is nothing below Corner Shop to offer')
})

// ---- r3-math-03 ---------------------------------------------------------------------------
// `A promotion may not narrow the question set` (DESIGN amendment 12). The guard that carries that
// title asserted only that ≥ 10 % of the new pool is fresh and that the ceiling does not fall — it
// never compared the SIZE of the two pools, so Office 3 → Sky 1 sat at 147 keys against 5 676 and
// passed with room to spare.
test('r3-math-03: a promotion never hands back a pool smaller than the one the child just left', () => {
  const keysOf = (level, step) => {
    const rng = mulberry32(7)
    let ctx = initialCtx()
    const out = new Set()
    for (let i = 0; i < 40000; i++) {
      const p = makeProblem(level, step, ctx, rng)
      out.add(p.key)
      ctx = afterAnswer(ctx, p, true)
      if (i % 9 === 8) ctx = { ...ctx, sameSeen: 0 }
    }
    return out
  }
  for (let i = 0; i < LEVELS.length - 1; i++) {
    const from = LEVELS[i], to = LEVELS[i + 1]
    const was = keysOf(from, 3), now = keysOf(to, 1)
    assert.ok(now.size >= 0.75 * was.size,
      `${to.id} step 1 serves ${now.size} sums after ${from.id} step 3's ${was.size} — a ${(was.size / now.size).toFixed(1)}x narrower pool on the screen that says "Try ${to.name}?"`)
  }
})

// ---- r3-math-06 ---------------------------------------------------------------------------
// facHi floors the factor range at 5, so seven consecutive presses of Custom's Largest `+` key
// (2 → 35) change nothing at all, and the table then reaches 25 — above the number the parent set.
test('r3-math-06: Custom names the table its × and ÷ knobs actually built', () => {
  for (const max of [2, 12, 20, 35, 36, 49, 200]) {
    const tag = customLevel({ ops: ['mul'], min: 2, max }).tag
    assert.match(tag, /× and ÷ use \d+ to \d+/, `ops × Largest ${max}: "${tag}" does not say which table it built`)
  }
  assert.match(customLevel({ ops: ['mul'], min: 2, max: 20 }).tag, /× and ÷ use 2 to 5/)
  assert.match(customLevel({ ops: ['div'], min: 2, max: 49 }).tag, /× and ÷ use 2 to 7/)
  // …and the clause appears only when a table is actually on
  assert.ok(!/× and ÷/.test(customLevel({ ops: ['add', 'sub'], min: 2, max: 20 }).tag))
})

// ---- r3-math-09 ---------------------------------------------------------------------------
// sameSeen was a latch held for the whole building, so the first incidental `3 + 3` at Corner
// Shop — where no entry declares `double` — removed 1+1 … 5+5 and every a − a from the rest of it.
test('r3-math-09: an incidental double suppresses its own shape for a few questions, not a building', () => {
  const corner = LEVELS[0]
  let ctx = initialCtx()
  assert.equal(ctx.sameSeen, 0)
  ctx = afterAnswer(ctx, { kind: 'add', a: 3, b: 3, answer: 6, key: 'add:3:3' }, true)
  assert.equal(ctx.sameSeen, SAME_FUSE, 'a coincidence arms the fuse')
  for (let i = 0; i < SAME_FUSE; i++) ctx = afterAnswer(ctx, { kind: 'add', a: 2, b: 5, answer: 7, key: `add:2:${i}` }, true)
  assert.equal(ctx.sameSeen, 0, 'and the fuse burns down')
  // measured: doubles come back inside a 9-question building instead of vanishing from it
  let withDoubles = 0
  for (let seed = 1; seed <= 40; seed++) {
    const rng = mulberry32(seed)
    let c = initialCtx(), sawEarly = false, sawLate = false
    for (let i = 0; i < 30; i++) {
      const p = makeProblem(corner, 2, c, rng)
      if (p.a === p.b) { if (i < 10) sawEarly = true; else sawLate = true }
      c = afterAnswer(c, p, true)
    }
    if (sawEarly && sawLate) withDoubles++
  }
  assert.ok(withDoubles >= 10, `only ${withDoubles}/40 seeds served a double both early and late`)
})

// ---- r3-elevator-feel-02 -------------------------------------------------------------------
// lunchboxMilestone filtered PARTS only, so from the 100-bacon chime (building 7) the roof card
// printed no forward goal at all — for the twelve buildings to the 200 plaque and for ever after
// the last one, with PLAQUES declared eleven lines above and drawn greyed in the Workshop.
test('r3-elevator-feel-02: the roof keeps naming a next goal after the last part is owned', () => {
  const lastPart = Math.max(...PARTS.map((p) => p.at))
  // The content round moved the first rung from 18 (building 2) to 12 (building 1) and added
  // fourteen more; the invariant this test polices is unchanged. The DENSITY of the ladder is
  // policed separately, by the gap instrument in test/parts.test.js.
  assert.equal(lunchboxMilestone(0).part.at, 12)
  const after = lunchboxMilestone(lastPart)
  assert.ok(after && !after.part, `at ${lastPart} bacon the card still points at a part`)
  assert.equal(after.at, PLAQUES.find((x) => x > lastPart), 'past the last part it must name the next plaque')
  for (const at of [lastPart, 199, 200, 399, 1499, 2999]) {
    const m = lunchboxMilestone(at)
    assert.ok(m && Number.isFinite(m.at) && m.at > at, `nothing to aim at with ${at} bacon`)
  }
  assert.equal(lunchboxMilestone(PLAQUES[PLAQUES.length - 1]), null, 'and it ends when the wall is full')
  // the card renders the plaque line, not a blank
  const st = { lunchbox: 390, plaques: ['200'], ride: { tray: 0 }, records: { floors: 0, rides: 0, longest: 0, passengers: 0 }, climb: [], unlocks: [], roof: { gained: 5, bonus: 3, unlocked: [], plaques: [], offer: null, offerTaken: null, lunchboxBefore: 382 }, settings: { motion: 'auto' } }
  assert.match(roof(st), /Next plaque at 400 bacon/)
})

// ---- r3-elevator-feel-07 -------------------------------------------------------------------
// The rules card named a ding the default configuration mutes (SETTINGS_DEFAULTS.sound = false),
// and the lobby's `♪ Sound off` is a state label, not an invitation.
test('r3-elevator-feel-07: the rules card only promises the ding when the ding can be heard', () => {
  const base = { settings: { sound: false }, ride: null, screen: 'rules' }
  const off = rules(base)
  assert.ok(!/one ding/.test(off), 'the card names a ding the child cannot hear')
  assert.match(off, /Turn on ♪ for the ding\./)
  const on = rules({ ...base, settings: { sound: true } })
  assert.match(on, /one ding/)
  assert.ok(!/Turn on ♪/.test(on))
})

// ---- r3-autism-fit-03 ----------------------------------------------------------------------
// noticeHTML was emitted last in the lobby markup, after the plaques, so on every phone profile the
// `this browser is not keeping the score` warning sat past the bottom of the screen and the visible
// lobby was indistinguishable from a healthy one.
test('r3-autism-fit-03: the storage warning is above the fold, not below the plaques', () => {
  const st = { level: 'corner', step: 1, lunchbox: 12, plaques: ['200'], ride: null, adaptive: true, pinnedStep: 1, settings: { sound: false, custom: {} } }
  const html = lobby(st, { storageFailed: true })
  const notice = html.indexOf('id="storagemsg"')
  assert.ok(notice > 0, 'the notice is missing')
  assert.ok(notice < html.indexOf('data-nav="ride"'), 'the notice still renders after the buttons')
  assert.ok(notice < html.indexOf('class="plaques"'), 'the notice still renders after the plaques')
})

// ---- r3-trivia-truth-01 --------------------------------------------------------------------
// gate() built its scanned text from question/answer/distractors/fact and never looked at
// sources[].title, which screens.js renders verbatim on the fact card and as the Fact Book's link.
test('r3-trivia-truth-01: the content gate reads the citations the child is shown, not only the sentences', () => {
  const good = shipped.items.find((i) => i.id === 'math-numbers-pi-day')
  assert.ok(good, 'the Pi Day item')
  assert.equal(loadFacts({ items: [good] }).rejected.length, 0, 'the shipped item passes')
  const bad = (patch) => loadFacts({ items: [{ ...good, id: 'probe', sources: [{ ...good.sources[0], ...patch }, ...good.sources.slice(1)] }] })
  for (const [what, patch] of [
    ['title', { title: 'Reed Magazine: In Memoriam, Larry Shaw 1961' }],
    ['url', { url: 'https://www.reed.edu/reed-magazine/in-memoriam/obituaries/2018/larry-shaw-1961.html' }],
    ['quote', { quote: 'He was killed in the accident that followed.' }],
  ]) {
    const r = bad(patch)
    assert.equal(r.facts.length, 0, `a source ${what} carrying a memorial word was accepted`)
    assert.match(r.rejected[0].reason, /forbidden word in a source/)
  }
  // and no shipped item carries one anywhere the child can see or follow
  const { facts, rejected } = loadFacts(shipped)
  assert.deepEqual(rejected, [], 'the shipped bank must pass its own gate')
  assert.ok(facts.length >= 60)
  for (const f of facts) for (const s of f.sources) {
    assert.ok(!/obituar|memoriam|memorial/i.test(s.title + ' ' + s.url), `${f.id}: ${s.title}`)
  }
})

// ---- r3-trivia-truth-02 --------------------------------------------------------------------
// 42.6 % of the bank's three-choice presentations made the answer the strictly longest option
// against a 33.3 % baseline, and five items gave it a 13–39 character lead: answerable by shape.
test('r3-trivia-truth-02: no answer is much longer than the longest distractor beside it', () => {
  const over = []
  for (const it of shipped.items) {
    const a = String(it.answer).length
    const d = Math.max(...it.distractors.map((x) => String(x).length))
    if (a - d > 8) over.push(`${it.id}: answer ${a} vs longest distractor ${d}`)
  }
  assert.deepEqual(over, [], `${over.length} items can be answered by picking the longest option`)
})

// ---- r3-trivia-truth-03 --------------------------------------------------------------------
// The rule string claimed of every item what is true of all but two; test/trivia.test.js names the
// two, so the claim and its own exception list had drifted apart.
test('r3-trivia-truth-03: the shipped rule string states its own exceptions', () => {
  const same = shipped.items.filter((it) => {
    const u = it.verification.map((v) => v.source_url)
    return new Set(u).size < u.length
  })
  assert.equal(same.length, 2, `${same.length} items read one document with both lenses`)
  assert.match(shipped.rule, /except two declared items named in test\/trivia\.test\.js/)
})

// ---- r3-trivia-truth-06 --------------------------------------------------------------------
// The card renders `Source: <title> (<domain>)`, so a title that IS the domain read
// `Source: piday.org (piday.org)`.
test('r3-trivia-truth-06: no source title is just its own domain', () => {
  const dumb = []
  for (const it of shipped.items) for (const s of it.sources) {
    const dom = (/^https?:\/\/([^/?#]+)/i.exec(s.url) || [])[1] || ''
    if (s.title.trim().toLowerCase() === dom.replace(/^www\./, '').toLowerCase()) dumb.push(`${it.id}: "${s.title}"`)
  }
  assert.deepEqual(dumb, [], 'a source title that repeats the domain renders it twice on the card')
})

// ---- r3-math-07 ----------------------------------------------------------------------------
// The band measured the SIZE of the numbers, not the KIND of arithmetic, so a division with a
// fractional quotient reached levels whose own tables say `division always exact`.
test('r3-math-07: an inexact division never reaches a level whose own rule is exact division', () => {
  const facts = loadFacts(shipped).facts
  const decimal = facts.find((f) => f.id === 'math-everyday-floors-per-second')
  assert.ok(decimal, 'the Burj Khalifa floors-per-second item')
  assert.equal(decimal.maths.exact, false, 'the item declares that answering it leaves the integers')
  for (const level of ['corner', 'hotel', 'office', 'sky']) {
    assert.equal(withinNumberBand(decimal, TRIVIA_LIMITS[level]), false, `${level} would serve it`)
  }
  assert.equal(withinNumberBand(decimal, TRIVIA_LIMITS.megatall), true, 'Megatall has no ceiling left')
  // …and it is genuinely out of every banded pool, not merely out of the predicate
  for (const level of ['corner', 'hotel', 'office', 'sky']) {
    const rng = mulberry32(3)
    const seen = new Set()
    for (let i = 0; i < 4000; i++) {
      const f = pickFact(facts, [...seen], null, rng, [], TRIVIA_LIMITS[level], i)
      if (f) seen.add(f.id)
    }
    assert.ok(!seen.has(decimal.id), `${level} drew the decimal item`)
  }
  // every shipped item that answers with a decimal declares itself
  // …scoped to the items that ASK the child to compute (a `maths` declaration): `2.5 billion`
  // recalled from a company report is a number, not a division.
  const undeclared = shipped.items.filter((it) => it.maths && /\d\.\d/.test(String(it.answer)) && it.maths.exact !== false)
  assert.deepEqual(undeclared.map((i) => i.id), [], 'an arithmetic item with a decimal answer must declare maths.exact = false')
})

// ---- r3-code-hostile-06 --------------------------------------------------------------------
// pickFact returned the first due retry unconditionally and a re-miss re-armed it, so once four or
// five facts were queued one was always due and no unseen fact was ever reached again: 400
// passenger questions, four distinct facts, one served 100 times — at Corner Shop and at Megatall.
test('r3-code-hostile-06: a child who gets every fact wrong still meets new facts', () => {
  for (const level of ['corner', 'megatall']) {
    const limits = TRIVIA_LIMITS[level]
    const rng = mulberry32(11)
    let seen = [], retry = [], count = 0, lastKind = null, lastWasRetry = false
    const distinct = new Set()
    for (let i = 0; i < 400; i++) {
      const f = pickFact(FACTS, seen, lastKind, rng, retry, limits, count, lastWasRetry)
      assert.ok(f, 'a fact')
      distinct.add(f.id)
      lastWasRetry = !!f.fromRetry
      lastKind = f.kind
      seen = seen.filter((x) => x !== f.id).concat(f.id)
      retry = retry.filter((x) => x.id !== f.id).concat({ id: f.id, at: count })  // every one answered WRONG
      count += 2
    }
    // The module's own band predicate, never a re-spelling of it: the band grew a fourth clause in
    // round 4 (concepts, r4-math-08) and a copy here would have gone on measuring the old one.
    const band = limits ? FACTS.filter((f) => withinBand(f, limits)).length : FACTS.length
    assert.ok(distinct.size >= band - 1, `${level}: ${distinct.size} distinct facts out of ${band} in band after 400 passengers`)
  }
})

// ---- r3-deploy-pages-01 --------------------------------------------------------------------
// `req.mode === 'navigate'` classed every in-scope navigation as index.html, so a path two segments
// deep was answered with the cached shell whose relative refs then resolved against the wrong
// directory: HTTP 200, empty body, no controls, and 404.html dead code for every returning client.
test('r3-deploy-pages-01: only the app root is answered with the app, and 404.html is precached', () => {
  const sw = read('sw.js')
  assert.match(sw, /const root = new URL\('\.\/', self\.location\)\.pathname/)
  assert.match(sw, /const isIndex = url\.pathname === root \|\| url\.pathname === root \+ 'index\.html'/)
  assert.ok(!/const isIndex = req\.mode === 'navigate'/.test(sw), 'every navigation is still treated as the index')
  assert.match(sw, /if \(!isIndex && req\.mode === 'navigate'\)/, 'a deep navigation must fall through to the network')
  assert.match(sw, /caches\.match\('\.\/404\.html'\)/, 'and to the friendly page when the network is gone')
  for (const list of [sw, read('src/main.js')]) assert.match(list, /'\.\/404\.html'/, 'both asset lists precache 404.html')
})

// ---- r3-mobile-ux-6 ------------------------------------------------------------------------
test('r3-mobile-ux-6: every precached asset is one the page can actually use', () => {
  const html = read('index.html')
  assert.match(html, /href="\.\/assets\/favicon-32\.png"/, 'favicon-32.png is precached and referenced nowhere')
})

// ---- r3-deploy-pages-02 --------------------------------------------------------------------
// `Version 1.0.0` was the same string on two different builds, which sw.js's own comment records as
// what made a stale install undiagnosable. The BUILD stamp cannot live in src/version.js — that file
// is one of the files BUILD hashes — so the app reads the name of the cache serving this tab.
test('r3-deploy-pages-02: a grown-up can read which build this phone is running', () => {
  const screens = read('src/render/screens.js')
  assert.match(screens, /Version \$\{esc\(extras\.version \|\| ''\)\}\$\{extras\.build/, 'the footer never shows the build')
  const main = read('src/main.js')
  // THIS USED TO GREP FOR `caches.keys()`, which is the call round 5 found was answering with the
  // wrong cache (r5-deploy-pages-1): a test that polices a spelling stays green under any selection
  // policy, including a broken one. The stamp must come from the worker serving the tab; the
  // mechanism is asserted in test/round5.test.js and this keeps the surface it feeds.
  assert.match(main, /which-build/, 'nothing asks which build is serving this tab')
  assert.match(main, /build: ui\.build/, 'the build never reaches the Grown-ups screen')
})

// ---- r3-deploy-pages-03 --------------------------------------------------------------------
// The Architecture and PWA sections still specified the worker behaviour amendment 10 removed, in
// the same document as the amendment: a maintainer reading them could "restore" skipWaiting and
// re-introduce the unrequested navigation 3.1 s into a sum.
test('r3-deploy-pages-03: DESIGN.md describes the worker that actually ships', () => {
  const design = read('docs/DESIGN.md')
  for (const line of design.split('\n')) {
    if (/network-first/i.test(line) && /index/i.test(line)) {
      assert.match(line, /superseded|amendment 10|was\b/i, `DESIGN.md still specifies the removed worker: "${line.trim().slice(0, 110)}"`)
    }
  }
  assert.ok(!/should confirm or revert this amendment/.test(design), 'amendment 10 still carries an open instruction to the lead')
  assert.match(design, /be-<VERSION>-<BUILD>/, 'the PWA section must name the cache the worker opens')
})
