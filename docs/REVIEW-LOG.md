# Bacon Elevator — review log

Each round: what the reviewers asked for, what was grafted, what was skipped and why, and the
numbers before and after. Scores are defended with instruments (`npm test`, `npm run drive`,
`npm run headless`), never asserted.

## Round 0 — judge grafts (2026-09-08)

Candidate A won the three-way judged build; the judges named specific things from the losing
candidates B and C that A had to absorb. All eighteen grafts landed; none was skipped.
Adaptations to A's names and structure are listed under each.

| # | Graft | Where | Pinned by |
|---|---|---|---|
| G1 | Worked lines that never restate the big line: count on from the larger addend (B), near doubles (B), count back for small subtractions, C's count-up wording (`From 4 count up to 9: 5, 6, 7, 8, 9 — that is 5 jumps`, grammar fixed for 1 jump), skip count (C), `a + 0 stays a` / `a − 0 stays a`; also tens-only and hundreds-only counting, `7 × 10` as a count in 10s, 3-digit ÷ 1-digit chunking. Every step now carries `expr` (re-evaluated by the tests) beside `text`. | `src/explain.js` | `test/explain.test.js`: 5 000 problems per kind re-evaluate every `expr`, assert no step equals the big line and no worked line over 110 chars; 10 one-step fixtures (0 + 1, 4 + 0, 3 − 2, 1 − 0, 2 + 7, 9 ▼ 3, 3 ▲ 2, 6 + ▮ = 7, 7 − 6, 0 + ▮ = 1) assert one step, one clause, ≤ 60 chars |
| G2 | The second status line: `Ground floor. Doors open.` / `Floor 3. Doors closed.` in floor mode (A had room, so every floor gets it, and the doors' real state), `Nobody is hurt. Nothing is lost.` under `Safety brake on.`, `Same sum. Ride back up.` on the retry keypad, the trivia verdict (G7). `#message` moved under `#question`, where C keeps it. | `src/render/panel.js` `createDisplay`, `src/main.js` brake transient | drive `play20` (G and after every arrival), `fall` (pit and retry) |
| G3 | The collected strip rides inside the car (drawn behind the doors) from the end of its slide until the next ride's `move-start` — through a fall, so it is there when the doors open in the pit. Adaptation: C hid it at `doors-closing`; A keeps it through the fall as the judges asked. A wrong retry (`ride.forfeit`) no longer plays the slide at all — before, the strip flew into the car and reappeared on its plate. | `src/render/shaft.js` (`.strip`, `hasStrip()`), `src/main.js` | drive `fall`: strip visible at the second try, in the pit, at the retry keypad and after the express; `play20`: after every collection |
| G4 | The pure injected-clock player replaces the inline rAF/setTimeout player. `createPlayer(steps, timescale, startMs, durationMs)` → `advance(now)`, `flush()`, `elapsed(now)`, `endMs`. Adaptation: A's effects carry `duration`, so the player takes it instead of B's `end()` and per-step `dur`. `shaft.begin/event/frame/end` stay the consumer. | `src/timeline.js`, `src/main.js` | `test/timeline.test.js`: once-only and order, the hidden-tab flush, 2 000 random timelines at four timescales, the ride at 2 700 ms and the fall at 3 900 ms |
| G5 | An in-flight ride survives a killed tab: the reducer saves `ride.inFlight = {name, to}` the moment a timeline starts, and `hydrate(state, rng)` plays `timeline-done` before anything renders. main.js waits (≤ 4 s) for the fact pool first so a ride into a passenger floor settles into the passenger. The migration keeps `retrying` through an in-flight fall. `pagehide` and `visibilitychange` now always save. | `src/state.js`, `src/save.js`, `src/main.js` | `test/state.test.js`: mid-ride, mid-ride into floor 4, mid-fall (resumes at the Repair card, the retry rides express, the miss is not counted twice), mid-express, mid-descent, a corrupt in-flight fall |
| G6 | The DOM-contract test, adapted to A's selectors: every §12 id and data attribute, the phone CSS rules (dvh + vh fallback, safe-area insets, `touch-action`, `overscroll-behavior`, 48 px minimums, the short-landscape query, reduced motion), no `<input>`/`<textarea>`/`contenteditable`, every `<button>` carries `data-tap`, anchors only behind the links setting, the drive hook, pure modules, and `sw.js` ASSETS ⊇ every shipped file and ∌ any missing file. | `test/dom-contract.test.js` | itself (9 tests) |
| G7 | The on-panel beat after a trivia choice: `data-result` right / chosen / dim, A/B/C letter badges with `aria-label="B: Kodak"`, the display band says `That is right.` + `+2 bacon` or `The answer is B.`, the Fact sheet follows after `max(300, 900 × timescale)` ms and never auto-dismisses. | `src/render/panel.js`, `src/main.js` (`ui.factTimer`), `css/app.css` | drive `trivia`: the sheet is absent while the buttons and the band show the result, then appears (≥ 250 ms measured); still there 700 ms later |
| G8 | Landscape under 500 px tall: grid areas `'top display' / 'shaft panel'`, `--cell 48px --gap 4px --display 60px`. Adaptation: B's `1fr 1fr` let A's wider top bar overflow by 4 px, so the left column is `minmax(0, 1fr)` and the top bar ellipsises its level name; the panel is `align-self: start` so GO sits at its bottom. | `css/app.css` | drive `layout`: 667 × 375 and 640 × 360 in keypad and floor mode (shaft 315 / 300 px), then portrait again |
| G9 | `--cell: clamp(48px, calc((var(--vh) − 48px − 90px − 200px − 38px) / 5), 56px)` with `--vh: 100dvh` under `@supports`, replacing the fixed `max-height` breakpoints; a `max-height: 600px` step for the display band remains. | `css/app.css` | drive `layout` asserts shaft ≥ 200 (202 at 360 × 640, 213 at 375 × 667, 390 / 397 on the tall phones) |
| G10 | The standalone reducer-only runner at seed 42 (10 000 questions per level under the perfect policy: repeat rate, kind shares, step convergence, falls, passengers, bacon), with `npm run headless`. It exits 1 when a level breaks a design bound. `test/headless-play.test.js` stays. | `tools/headless-play.mjs`, `package.json` | run by hand: all five levels 0.00 % repeats, max kind 25.9–41.6 %, step 3 by the sixth answer |
| G11 | The fifth Rules picture (silhouette in the car + `?`) carrying `A passenger's question never falls.`, and `Bacon is never lost. There is no clock.` at the bottom. Adaptation: the picture is a full-width row under the four, and the old `At the roof …` line moved off the card (the roof screen says it) so both sentences fit 360 × 640 without scrolling. | `src/render/screens.js`, `css/app.css` | drive `layout`: `.rules .body` must not scroll, both sentences present, five pictures |
| G12 | Signature-diffed panel: the markup is rebuilt only when the mode or its shape changes; GO's disabled state, the hint's `aria-pressed`, each choice's `data-result`, the lit / target / disabled floor buttons and the door keys are patched in place. | `src/render/panel.js` | drive `play20`, `fall`, `trivia` (every key tapped through the patched panel) |
| G13 | A `ResizeObserver` on the shaft box and a `visualViewport` resize listener beside the resize / orientationchange handlers; `<meta name="color-scheme" content="light">`. | `src/main.js`, `index.html` | `test/dom-contract.test.js`; drive `smoke` |
| G14 | `window.__bacon` (only under `?drive=1`) gains `events` (timeline step names and `motion:<state>` transitions in order), `actions` (dispatched action types) and `inFlight()`. | `src/main.js` | drive `fall`: `motion:falling → doors-closing → doors-closed → fall-start → impact → motion:idle → brake → doors-opening → doors-open`, no ding; one ding on the express; `play20`: exactly one ding on each of 20 up rides, one `ding2` and no `ding` on the victory descent, 20 `go` actions |
| G15 | The six drifting strips are confined to a `.picnic-wrap` band around the picnic art; none under reduced motion. | `src/render/screens.js`, `css/app.css` | drive `layout` roof: the drift box inside the band, above the milestone text, `overflow: hidden`, six strips starting inside it |
| G16 | Verified on A's reducer: the retry after a fall (right or wrong again) touches neither `history` (answered, correct, falls, ring, byKind, skills) nor `streak`, `stepDowns`, `comeback` or `ctx`. No change needed. | — | `test/state.test.js` |
| G17 | Verified on A's reducer: `set-level` never changes any setting, `secondTry` included, whether or not a building is parked. No change needed. | — | `test/state.test.js` |
| G18 | The Megatall 3-digit Repair card at 360 × 640: the card body is 229 px and the worked line fits; if a line ever grows past the box the card now scrolls inside itself (`overflow-y: auto`, content centred with `margin: auto`) and a worked line over 56 characters steps down to 15 px. | `css/app.css`, `src/render/panel.js` | drive `layout` `repair-megatall`: card `scrollHeight ≤ clientHeight`, every line inside the card box, screenshot |

What the instruments caught while grafting (each fixed before the commit):

- `test/explain.test.js` on the custom level: `0 + 37` produced a 164-character count-on, `0 − 28`
  and `10 × 10` restated themselves. Now `0 + b` counts on only to 10 (`stays` above that),
  `0 − b` reads `b below 0 is −b`, and a factor of 10 counts in 10s or reads `n tens`.
- The `settings` scenario's garbage-save check: the new `visibilitychange` save ran after the
  scenario's `pagehide` garbage writer and quietly repaired it; the scenario now writes garbage on
  both events, which is what a hostile save looks like.
- Landscape at 667 × 375: B's `1fr 1fr` columns overflowed by 4 px on A's top bar (see G8).
- The Rules card at 360 × 640 needed 2 px of scroll; the header and picture heights came down.

Numbers: `npm test` 89 → 108 tests, all green. `npm run drive` 28 / 28 → 28 / 28 (7 scenarios ×
4 phones), with the `layout` scenario growing from 13 to 19 checkpoints and `fall`, `play20`,
`trivia` and `smoke` carrying the new assertions above. `npm run headless`: five levels in bounds.

Not grafted, by design: B's `#app[data-motion]` attribute (A signals reduced motion with
`html.reduced`) and C's `#status` id (A's contract names the line `#message`).

## Round 1 (2026-09-08)

Seven fresh reviewers played the shipped game and all seven scored it 5/10; 58 findings. The
round is split three ways. This section is **fixer 1 — layout** (`css/app.css`, `index.html`,
`src/render/*`, the `layout` scenario). Twelve findings, all twelve reproduced at the numbers the
reviewers quoted, none rejected.

### The one that mattered

`.shaft { min-height: 200px }` sat inside `#app { height: 100dvh; overflow: hidden }` next to three
`flex: 0 0` bands. 48 + 76 + 200 + 276 = **600 px**, so on any browser viewport shorter than that
the only growable band could not shrink and the excess fell off the bottom of the panel. On an
iPhone SE in Safari (375 × 553) that left **7 px of GO** visible; at 320 × 454, none of it, and
floors 1–6 with it. The child could not move the elevator. The drive could not see it because its
phone profiles used device heights; the profiles were corrected in the previous commit, which is
what turned the gate red and made this round's work visible.

### What changed

| Finding(s) | Change | Pinned by |
|---|---|---|
| `r1-elevator-feel-01`, `r1-autism-fit-01`, `r1-deploy-pages-01`, `r1-mobile-ux-01` | The vertical budget, stated once (`css/app.css` `:root`) and enforced by the flex rules: `.shaft { min-height: 0 }` — the shaft is the remainder, 200 px is now a preference that feeds the `--cell` clamp only. `--cell` is derived from the variables it depends on, so a tier change cannot desynchronise it. Two short-viewport tiers (`max-height: 620px` → display 72, gap 4; `max-height: 500px` → display 60) pay for the space out of the display band, never out of a tap target; `--cell` never goes under 48. DESIGN amendment 8 records the rule. | drive `layout`: `panel below the viewport by N px` and `tap target outside the viewport`; `test/dom-contract.test.js` now asserts `min-height: 0` and both tiers instead of a literal clamp string |
| same | The drive's own `shaft < 200` line was wrong the moment the shaft was allowed to yield. Re-derived from the budget: it prints all four bands (`48+72+169+264=553 of 553`) and fails only when the shaft is smaller than the budget actually allows it. Also pins the 48 px cell floor. | itself: the old constant fails 2/5 on the fixed tree, the new rule fails on the broken one |
| `r1-code-hostile-03`, `r1-mobile-ux-02`, `r1-mobile-ux-03` | Trivia rows are sized by their text: `.panel[data-mode="trivia"] { grid-auto-rows: minmax(var(--cell), auto) }`, the question no longer spans a fixed two rows or hides its overflow, question and choice type step with the viewport (`clamp`, floor 16 px on a choice). DESIGN amendment 3 dropped the ≤ 90 / ≤ 40 character caps without giving the layout anywhere to put the text. | new drive checkpoint `worst-trivia`: the bank's longest question and three longest choices (196 / 84 / 71 / 57 chars) are put into the **real** panel, the page re-measures itself, and the question must not be clipped, the text must stay 2 px inside its button, every choice must be ≥ 48 px, ≥ 16 px type and on screen |
| `r1-mobile-ux-01` | A shaft that yields all the way can become an unreadable stripe. Under 64 px it keeps its box (it is the spring — no blank paper ever opens under the panel) and stops drawing: `.shaft.tiny > svg { display: none }`, toggled in `shaft.js resize()`. The class does not change the box height, so the `ResizeObserver` cannot oscillate. | drive: `shaft is a N px sliver of cropped car` / `the shaft is hidden but has room`. Mutation-tested: deleting the toggle makes `worst-trivia` fail at 320 × 454 with a 23 px shaft |
| `r1-deploy-pages-01`, `r1-mobile-ux-01` | The Rules card fits at 320 × 454 (it was 281 px over; 79 over at 375 × 553, 72 at 360 × 560): the two tiers trim its padding, headings, pictures and type. One paragraph carries `class="detail"` and is dropped only at ≤ 500 px tall — it restates the two "Right" pictures directly above it. The "Wrong:" paragraph (the spikes and the safety brake) is the sensory-risk item and stays at every size, as do all five pictures and both asserted sentences. | the existing `rules` check (`noScroll: '.rules .body'`, the two `texts`, five pictures) — the thing that was failing at se/small/se1 |
| `r1-mobile-ux-05` | The way out of a long page is now reachable at any scroll position: `.page > .row.spread:first-child` is sticky. Grown-ups is 2081–2294 px tall; scrolled to the bottom its Lobby button was at −1576 / −1824. Preferred to repeating the button at the end, which only helps at the end. Fact Book, Workshop and the picker get it for free. | new `wayOut` check: scroll the active page to its `scrollHeight`, assert `[data-nav="lobby"]` is inside the viewport. Reports `page 2294 px, Lobby at 8` |
| `r1-autism-fit-06`, `r1-mobile-ux-06` | The ride chip stops relying on an ellipsis: each level carries a `short` label (Shop / Hotel / Office / Sky / Mega / Custom) and the chip shows it; the full name still appears on the lobby, the picker and in Grown-ups. At ≤ 340 px wide no name fits beside the step bar (43 px of room), so none is shown and the step bar stands alone. | new drive line `level name ellipsised: "Corner Shop" needs 74 px of 43`, which fired on every phone before; `test/levels.test.js` asserts every row has a `short` of ≤ 6 characters |
| `r1-mobile-ux-08`, `r1-deploy-pages-06` | A crop guard in `shaft.js`: the PIT sign, the P plate, the buffer springs, the spike row and every bacon plate register a world band, and `scrollTo()` hides any of them the camera's edge would cut in half. It writes a **class**, never the `visibility` attribute — the collected-bacon logic already writes that attribute, and two writers on one attribute fight. In the pit the camera sits on the world's floor so the whole spike row is in frame for the impact. | new drive assertion over `#shaft .sign, .spikes, .buffers, .plate` using a partial-**overlap** predicate (a containment test flags four plates on every phone, because an SVG child scrolled out of its viewBox still reports a rect). It fired as `the shaft crops "PIT" mid-glyph` / `"spikes" mid-glyph: 16 of 50 px` |
| `r1-mobile-ux-01`, `r1-mobile-ux-08` | On a short shaft the camera pulls back (capped at 2.4×) until at least 200 world units are in frame, and the backdrop widens to cover the margins. At 320 × 454 an 82 px shaft was 77 world units against an 88-unit car — the car could not be whole however the camera was placed. | the crop-guard assertion, which cannot pass at 320 × 454 without the pull-back |
| — | The `layout` scenario collected only the first failure and threw, so one bad screen hid every assertion after it: all three red phones reported the Rules card while GO being unreachable — the thing that actually stops the child playing — went unreported. It now collects across every check and throws once at the end. | itself: one run now names ten problems on a phone instead of one |

### Rejected

No finding was rejected. Two of the reviewers' *suggested fixes* were, in favour of what the
measurements said:

- `r1-code-hostile-03`'s "cap choice length in the bank": the 67 facts are fact-checked and sourced
  under `docs/TRIVIA.md`; truncating a verified answer to fit a button is a content regression
  dressed as a layout fix. The layout absorbs it instead, measured at 320 × 454.
- `r1-mobile-ux-03`'s "give trivia mode a third question row": a fixed third row costs a whole cell
  on the median 103-character question, which is the common case. `minmax(var(--cell), auto)` gives
  the 196-character question 96–113 px and the median question 48, at no cost.
- `r1-autism-fit-01`'s "drop the cell floor to 44 px" is not needed and does not bend: the budget
  fits at 320 × 454 with every cell at 48.

### Numbers

`npm test` 108 → 109, all green. Both new node assertions were watched failing first: on the
pristine tree the suite is 107 pass / 2 fail (`no hard minimum on the one growable band`,
`corner: no short label`).

`node tools/phone-drive.mjs` **32/35 → 35/35**, and the layout scenario 2/5 → **5/5** — `layout` was red on `se`, `small` and `se1`. Every new
drive assertion was watched failing on a pristine checkout before the fix (one run at 320 × 454
named: the way out at −1824, the Rules card 657 > 376, floors 4/5/6 outside the viewport, the panel
146 px below it, the level name 74 px of 43, the longest question clipped 117 > 102, two choices
painting over their borders, and the spikes cropped in landscape).

| | 375 × 553 | 360 × 560 | 320 × 454 | 390 × 664 | 393 × 727 |
|---|---|---|---|---|---|
| bands before | 48+76+200+276 = 600 | 600 | 600 | unchanged | unchanged |
| bands after | 48+72+169+264 = **553** | 48+72+176+264 = **560** | 48+60+82+264 = **454** | 48+90+210+316 = 664 | 48+90+273+316 = 727 |
| GO visible | 7 px → **48** | 14 px → **48** | 0 px → **48** | 48 | 48 |
| Rules card over | 79 px → **0** | 72 px → **0** | 281 px → **0** | 0 | 0 |
| worst question | clipped → **whole, 112 px @ 17.3 px** | **108 px @ 16.6 px** | clipped 15 px → **96 px @ 14.7 px** | 113 px @ 17.5 px | 113 px @ 17.5 px |
| worst choices | spilling 25 px → **80/59/59, all inside** | **78/58/58** | spilling 46 px, two off screen → **76/76/56, all on screen** | 83/61/61 | 83/61/61 |
| Grown-ups way out | −1576 → **+8** | −1590 → **+8** | −1824 → **+8** | −1401 → **+8** | −1338 → **+8** |

The two good phones (390 × 664, 393 × 727) are byte-for-byte unchanged in the ride: this fix costs
them nothing.

### Handed on

- The `--tall` profiles (device heights, i.e. a Home Screen install) are not in the default gate.
  They are the *easier* case now that the budget yields, but nothing pins them.
- The landscape block still re-sets `--cell`/`--gap`/`--display` by hand instead of using the
  budget's variables; it is correct today but it is a second copy of the same arithmetic.

---

## Round 1 — fixer 2: state, save and the service worker

Files owned: `src/state.js`, `src/save.js`, `src/main.js`, `sw.js`, `tools/make-icons.mjs`,
`assets/`. Eleven findings (`r1-code-hostile-01/02/05/06/07/08/09`, `r1-elevator-feel-06`,
`r1-deploy-pages-02/03/04`, `r1-mobile-ux-04`). All eleven reproduced; none rejected.

### The two that mattered

**The building died on a save the game wrote for itself.** Answer the passenger on floor 4 and the
Fact card goes up; the `choice` action emits `SAVE`, so the blob on disk at that instant is
`{phase:'fact', floor:4, target:4}`. `migrateRide` rewrote `fact → floor` and stopped there — it
did not do what `card-continue` does, which is add the floor to `passengersDone` **and** advance the
target. After the reload the display read `Press 4`, floor 4 was the only enabled button, and that
button was inert: `press-floor` refuses `f === car.floor`, and the reducer refuses any `f !==
target`. No console error. It just quietly stopped being a game, and it cost the child the whole
building. Reproduced in real headless Chrome at 390 × 664, and it is now the `reload` drive
scenario on all five phones.

The root cause is one missing invariant, not one missing line: every field of a ride was
range-checked **on its own**, and the one relation the reducer depends on — *there is a floor above
the car to press* — was checked nowhere. `floor` was clamped to [−1, 10] and `target` to [1, 10]
with no tie between them. So `normaliseRide()` now states that relation once, in `state.js`, and
every entry into a ride goes through it: a parsed save, a share code, a resume, a settled timeline,
an `import`. `nextTarget(floor)` is the only way a target is ever computed (four sites used a raw
`floor + 1`, which yields target 11 at floor 10 — a target no button can carry).

**The deploy reloaded the child's tab mid-sum.** `sw.js` ended `install` with `skipWaiting()`, so a
new worker activated the instant it finished installing; `clients.claim()` took the open tab over;
`main.js` reloaded on *any* `controllerchange` once a worker had ever been offered. Measured
against a server sending the header GitHub Pages really sends (`max-age=600`): at 1851 ms the state
is `{phase:'keypad', typed:'3'}`, an unrequested main-frame navigation fires at 3116 ms, and the
child is on the lobby screen. That breaks the one rule this game has: nothing moves without the
child's action.

Removing `skipWaiting` alone would have been worse than the disease. The update chip was pinned to
`bottom: 12px` and had only ever existed for about a second before the page reloaded itself, so
nobody had noticed where it sat: `elementFromPoint` at GO's own centre returned `#update-chip` on
an iPhone 12, and it covered keys 1–6 on an SE. Making the worker wait turns that into a permanent
overlay over the button that moves the elevator. `sw.js`, `src/main.js` and the chip rule in
`css/app.css` are therefore one change, landed together.

### What changed

| finding | change | pinned by |
|---|---|---|
| `01`, `07`, `elevator-feel-06` | `normaliseRide()` + `nextTarget()` in `state.js`; every ride entry routed through them; `migrateRide` ends with it | `test/save-walk.test.js` (3 000 corrupt saves), `save.test.js` fact-card test, drive `reload` |
| `06` | `validProblem()` in `math.js` — the stored answer must equal `solve()`; applied to `ride.problem`, every `comeback[].problem`, and the comeback draw in `makeProblem` | `save.test.js` comeback test; 452 of the walk's 788 failures |
| `07` | three blocked car steps stop returning `same(state)`: `press-floor` heals, a right answer at the top banks the building, a wrong answer in the pit returns the Repair card | `state.test.js` blocked-step test; the walk's no-op assertion |
| `09` | `clampInt` on every counter (`Number.isSafeInteger`, ceilings 1e9 / 1e6 / 999 / 99); `banked ≤ tray` | `save.test.js` magnitude test |
| `05` | the roof summary is persisted as `ride.roofCard`; `ride-start` reads it; an old save with no card omits the lines instead of printing a zero | `state.test.js` roof test, drive `reload` step 3 |
| `08` | `nav` parks a live building through `to-lobby`, which already records the real phase | `state.test.js` nav test |
| `02`, `deploy-pages-02`, `mobile-ux-04` | no `skipWaiting` in `install`; the chip is offered only at rest and stays until tapped; only `updateRequested` may reload; a chip tap resumes the ride | `tools/update-drive.mjs` asserts 1–3, 6; `version.test.js` |
| `deploy-pages-03` | `install` precaches with `new Request(u, {cache:'reload'})`; `index.html` is cache-first from the versioned cache (DESIGN amendment 10) | `update-drive.mjs` asserts 4–5 |
| `mobile-ux-04` | the chip moves from the bottom to under the top bar, over the untappable shaft | drive `layout` occlusion probe |
| `deploy-pages-04` | a real maskable pair (`icon-maskable-{192,512}.png`), the manifest's purposes split, a measured gate in `make-icons.mjs` (DESIGN amendment 11) | `version.test.js` manifest test; the gate itself |

Two corrections to the finding texts, both of which change the framing:

- `r1-mobile-ux-04` says the chip "never appears". It does. An in-page `MutationObserver` recorded
  it added at page-clock 1769 ms; the document was destroyed 1017 ms later by the self-reload. A
  60 ms Node-side poll misses that, which is how two reviewers concluded it never rendered. The
  constraint broken is *nothing moves without the child's action*, not *nothing shows under 300 ms*.
- `r1-code-hostile-08` is real in the reducer but **not reachable through today's DOM**: every
  `[data-nav]` to the picker, Fact Book, Workshop and Grown-ups lives on the lobby screen, so
  `phase !== 'lobby'` cannot hold when `nav` fires. It is fixed and pinned as a reducer test, and
  it is honestly defence-in-depth, not a live player path. The `import` action was the same shape of
  doorway and is now normalised too.

Two bugs the review did not find, both the same class, found while reproducing:

1. **A wrong answer at a pit keypad was a silent no-op.** From `{phase:'repair', floor:−1,
   retrying:false}` with second try off, `carStep(car, {type:'fall'})` is refused because the car is
   already at −1, and `go` returned `same(state)` with zero effects: the child taps GO and *nothing*
   happens. My first harness missed it because a perfect player never falls — which is why the
   walk's wrong-answer arm is load-bearing.
2. **`{phase:'floor', floor:−1}` handed out free bacon.** Pressing 1 and answering right moved the
   car −1 → 0 while `arrive` set `ride.floor = target = 1`: the car teleported a floor and floor 1's
   strip was collected for a one-floor ride out of the pit. The invariant's rule "floor −1 exists
   only while the Repair card is up" closes it.

### Rejected

- **`r1-deploy-pages-03`'s `updateViaCache:'none'` half.** Not the bug and a no-op here.
  `register('./sw.js')` already defaults to `updateViaCache:'imports'`, and `sw.js` has no
  `importScripts`. Measured: on the max-age=600 server the update check fetched `/sw.js` from the
  network on *every* load while fetching zero assets — the worker script was fresh and only the
  precache was stale. Adding the option would look like a fix and change nothing. `cache:'reload'`
  in `addAll` is the whole cure.
- Nothing else was rejected.

### Departures from the plan, and things the lead should look at

- **The `state` plan's `validProblem` lives in `src/math.js`, which fixer 3 owns.** It belongs
  there — it uses `solve` and `BLANK`, and `keyOf`/`checkAnswer` are its neighbours — and putting a
  maths validator in `state.js` would have been the wrong shape. It is an additive export plus a
  two-line hardening of `makeProblem`'s comeback draw; fixer 3 branches from this commit.
- **`css/app.css` (fixer 1's file) carries the chip rule**, and **`src/render/screens.js`** carries
  one line so `gained === null` omits the roof lines instead of printing `Tray null`. Both are
  required by the sw and state plans and cannot ship separately from them.
- **DESIGN amendments 10 and 11 were written by the engineer, not the lead.** Amendment 6 said
  network-first `index.html` and `skipWaiting`; amendment 4 said one image with
  `purpose: "any maskable"`. Both are now wrong, and the plan for each said not to land it silently.
  They are written up with their measurements and marked for the lead to confirm or revert.
- **`test/save.test.js`'s "floor 99 → phase floor" assertion was changed on purpose.** Under the
  invariant floor 99 clamps to 10, and floor 10 *is* the roof, so a corrupt top-of-the-building save
  is banked rather than dropped — which is what "nothing is ever taken away" asks for. It used to
  land in phase `floor` with target 1: a building whose one lit button was below the car.

### Numbers

`npm test` **109 → 123**, all green. Every new assertion was watched failing on a clean checkout of
the previous tip first: the four `r1-*` save tests, the four `r1-*` state tests, both new
`version.test.js` tests, and the rewritten manifest assertion — 9 failing before, 0 after.

`test/save-walk.test.js` is the falsifier for this whole section: 3 000 seeded corrupt saves,
parsed, hydrated and then *played* to the roof with nothing but DOM-reachable actions.

| | before | after |
|---|---|---|
| dead or throwing | **788 / 3 000 (26.3 %)** | **0** |
| render throws (`text.split`) | 452 | 0 |
| `no-op: press-floor 10` | 141 | 0 |
| `GO on the correct answer was a no-op` | 122 | 0 |
| `no-op: press-floor 11` | 29 | 0 |
| tail: `press-floor N` with target ≤ floor | 44 | 0 |

`node tools/phone-drive.mjs` **35/35 → 40/40** (a new `reload` scenario on all five phones). The
occlusion probe was watched failing with the old chip rule: at 390 × 664, `go <- #update-chip`.

`node tools/update-drive.mjs` (new, `npm run drive:update`) — the only instrument that can see any
of this, because the phone drive's own server sends `no-store` and never bumps a version:

| assertion | before | after |
|---|---|---|
| 1 · no unrequested navigation for 8 s | one at 3116 ms | none |
| 2 · the chip stays, and covers no tap target | added 1769 ms, destroyed 1017 ms later | added 1838 ms, still there at 10 s |
| 3 · the session stays on one version until the tap | mixed (new HTML, old modules) | 1.0.0 throughout |
| 4 · `be-1.0.1` holds VERSION 1.0.1 | `'1.0.0'` | `'1.0.1'` |
| 5 · install fetched the assets | **1** | **28** |
| 6 · after the tap: one navigation, 1.0.1, back on the sum | 0 navs, 1.0.0, lobby | 1 nav, 1.0.1, `ride/keypad`, typed `35` |
| **total** | **5 / 15** | **15 / 15** |

Icons: `transparentFraction` 0.0399 → **0.0000**; corner pixel alpha 0 → opaque `#2A303F`; art reach
0.883 → **0.751** against a 0.800 safe circle. `node tools/headless-play.mjs` at seed 42 is
unchanged (repeat 0.00 %, step converges on every level).

`validProblem`'s strict `solve(q) === q.answer` check rejects nothing legitimate: 320 000 real draws
(20 000 per level per step across all five levels, plus 20 000 custom) gave 0 mismatches.

### Handed on

- **`tools/update-drive.mjs` is not in `npm run drive`.** It costs a real Chrome launch and ~40 s
  and belongs beside the drive in the pre-push gate, not inside `node --test`.
- **The Windows trap it carries:** Chrome's service-worker database fails *silently* when
  `userDataDir` sits past MAX_PATH — `getRegistrations()` returns `[]` with no console error, no
  pageerror and no failed request. Any future SW instrument needs a short profile directory.
- **Multi-tab:** a chip tap in one tab no longer reloads the others. That is deliberate (nothing may
  move under the child's hands), but a second tab is then silently controlled by the new worker
  while still running the old modules until it is closed.
- **`assets/apple-touch-icon.png` still has 3.7 % transparent corners**, which iOS composites onto
  black. Rendering it from a plate with the `rx` removed (art unscaled — iOS rounds, it does not
  circle-mask) takes that to 0. Not done: outside the finding.
- **`PROBLEM_KINDS` is `KINDS` in `math.js`.** If a new kind is added to `levels.js` it must be
  added there, or `validProblem` will quietly reject every save carrying it.

## Round 1 — fixer 3: content and words (2026-09-08)

`src/math.js`, `src/explain.js`, `src/levels.js`, `src/trivia.js`, `data/trivia.json`,
`data/trivia-audit.json` and the copy in `src/render/screens.js`, plus the reducer and renderer call
sites those rules are read from. Nineteen findings: eighteen reproduced and fixed, one rejected in
half (the level-offer timing), one reviewer suggestion rejected in favour of what the measurement
said.

### The one that mattered

A Megatall sum with a negative answer, missed twice. The fall drops the step 3 → 2; the panel
derived its `±` key from the level **and step**, so the key vanished — from a keypad still showing
`2 − 27 = ▮`. The child could not enter the answer at all: 30 cycles of card → keypad → card, and
Lobby → Ride restored the same dead keypad. The rule the code was missing is one sentence — *the
keypad must be able to express the answer to the problem it is showing* — and the problem outlives
the step that drew it in four ways (a fall, a pinned-step change, a Custom-knob change, a comeback).
It is now one predicate, `signKeyLive`, with `typedCap` for the same trap in the digit dimension
(a 5-digit answer under a hard cap of 4), read from `main.js` and `state.js` rather than
re-implemented in each.

### What changed

| Finding(s) | Change | Pinned by |
|---|---|---|
| `r1-math-01` | `math.js` gains `levelAllowsNegatives`, `signKeyLive`, `digitsNeeded`, `typedCap`; `main.js:204` and `state.js`'s `toggle-sign` and digit cap all ask them; `save.js`'s persisted `typed` widens to 6 digits. The `±` key no longer appears and vanishes inside one Megatall building. | new drive scenario `fall-negative` (real Chrome, 5 phones): play Megatall to a negative sum, miss twice, and the `±` key must still be there and ≥ 48 px — it reports `2 − 27 = −25 missed twice at step 3 → step 2, ± still on the keypad`. Watched failing with the old derivation: `no ± key for 2 − 27 (answer −25) at step 2 — the sum cannot be entered at all`. Plus `test/panel-capability.test.js` (every level × drawStep × panelStep) and two `state.test.js` cases |
| `r1-math-03`, `r1-math-08` | `explain.js classify`: the missing-number kinds get the inverse clause (`7 is the total, so ▮ is 7 − 3`) instead of `+ means add`, which contradicted the worked line above it; `neighbour` fires only on `mul`, where the typed number IS a product (it was firing on `missMul`: `▮ × 8 = 40` typed 35 read `that is 5 × 7; one more 5`); the unreachable ÷ branch is deleted; `reversal` compares digit strings of EQUAL length, so `10 × 10 = ▮` typed 1 is no longer called a digit reversal. | `test/explain.test.js`: 11 new fixtures/counter-fixtures **and** a drawn-problem sweep (6 000 problems × 21 candidate entries, plus a dedicated Skyscraper `missMul` pass) asserting four invariants — a neighbour clause names a product the child pressed, a reversal is a reversal, the operator lesson is only shown for the operation the child should have used, an inverse clause evaluates to the answer. It fails on HEAD with `reversal on a truncated entry` and `a missing-number card names the glyph the child already used`. The `fall` drive scenario now enters the mistake the KIND invites, not always `answer + 1` — the reason this shipped with an instrument on the same screen |
| `r1-math-02`, `r1-math-09`, `r1-code-hostile-04` | `makeProblem`'s last-resort fallback returned `e.a[0] op e.b[0]` — measured `100 × 2 = 200` on 900/900 draws for ops ×, Smallest 100, Largest 120, above the parent's own Largest — and `finish()` could emit `15 + ▮ = undefined`. Now `degrade()` draws a legal random sum of the same kind inside the entry's ceiling, and `finish()` fills a missing total. `customLevel` builds tables that are satisfiable by construction (one Smallest knob cannot bind both `a + b ≤ max` and `a·b ≤ max`, so it is relaxed per family, never inverted) and derives its tag from them. | `test/levels.test.js`: all 360 knob combinations a parent can reach through the steppers, 900 draws each — ≥ 10 distinct sums, no sum over half the draws, no `undefined`, nothing above the number in the tag, nothing wider than the keypad. Before: 4 804 `undefined` draws and 39 degenerate configurations. `test/math.test.js` pins `degrade()` directly (watched failing: `100 × 2 = 200 is above the entry's own max`) |
| `r1-math-09` (second half) | `render/screens.js` composed the Custom tag a second time from the raw knobs, so the Lobby chip read `numbers 50 to 60` over a `15 ÷ 3`. It asks `customLevel` now. `SETTINGS_DEFAULTS.custom.min` is 2 (0 was in 26 % of the default Custom level's draws; §4 puts 0 and 1 at Corner Shop). | the `settings` drive scenario sets Custom to ÷ only, 52–70 through the real steppers and asserts the Lobby shows the tag `customLevel` actually produces. Watched failing: `knobs {"ops":["div"],"min":52,"max":70} → "numbers 2 to 64" not in "numbers 52 to 70"` |
| `r1-math-06` | `levels.js` exports `levelBound(level)`; Hotel is tagged `numbers to 20; tables 2, 5, 10`, because its step-3 × table is exactly what §4 asks for and it reaches 100 (1 078 of 10 000 draws above 20). The tag was what was wrong, not the table. | `test/levels.test.js`: no `numbers to N` tag may undercut its own `levelBound`, **and** the direct measurement — 10 000 Hotel step-3 draws must show nothing over 20 unless the tag names the tables. Fails on HEAD: `hotel: tag says 20, tables reach 100` |
| `r1-math-04` | `recordAnswer` was the only writer of history AND the adaptive rule, and the second-try branch returned before it: a first miss changed nothing. A child who missed every first attempt and got every second right was at step 3 by question 7, with history reading 17 answered / 17 correct / 0 falls. Split into `recordQuestion` (once per question, at the first verdict) and `applyAdapt` (every verdict). | `state.test.js` `a child who needs two tries is not promoted`: 18 questions wrong-then-right → step 1, 18 answered, 0 correct, 0 falls, and `byKind` records ONE attempt, not two. Fails on HEAD at the double-count assertion |
| `r1-math-05` | The comeback queue was scheduled at `count+5`/`count+15` in a counter `newRide` reset every building — and a building is TEN questions, so +5 fired only for floors 1–5 and +15 never fired at all. Moved to `history.comeback` with `history.count` as its clock, pruned to the last 12, validated in `save.js`, and cleared on any level change (including an accepted roof offer). | `state.test.js` `a sum missed on floor 8 comes back in the NEXT building at +5 and again at +15` — the miss must reappear at exactly questions 13 and 23. The old assertion only proved the queue was SCHEDULED, which is why this shipped; it now reads `history.comeback` and a second test proves a comeback never crosses a level change |
| `r1-math-07` | The `a = b` latch is meant to stop an incidental repeat; it was capping the kinds whose every draw has `a = b`. Hotel doubles measured 7.99 % against a 12.5 % table weight, Skyscraper squares 9.43 % against 20 %, and a second one in the same building was impossible. Declared pairs now carry `pair: true` (through `validProblem` and the comeback copy, so a reload cannot demote one). | `test/math.test.js`: 90 000 draws with the game's real per-building latch reset — Hotel doubles > 11 %, Skyscraper squares > 14 %. Fails on HEAD at 9.52 %. The old `a = b twice` assertion is narrowed to *incidental* `a = b`, which is a green test going red on purpose |
| `r1-elevator-feel-02`, `r1-autism-fit-03` | **The forfeit is dropped.** After a second wrong retry the strip stayed on its plate, silently, at a floor the child was standing on — against `Bacon is never lost.` printed on the Rules card and §7's 16 per building (a forfeit run banked 15). The strip is collected when the sum is finally answered. DESIGN amendment 9 records the spec reversal. | the existing `state.test.js` case is renamed and inverted (tray 2, cleared [1, 2]) plus a new one playing a whole building with two cards on one floor: `roof.gained + bonus === 16`. The `fall` drive scenario now answers WRONG a second time — no scenario ever missed twice, which is how the whole branch shipped unwatched |
| `r1-autism-fit-02` | The trivia picker knew the level existed and never asked it: over seeds 1–8 at Corner Shop, 53 of 96 passengers were above difficulty 1 and the longest question ran 188 characters. `TRIVIA_LIMITS` gates the pool by level, applied before the comeback and recycle branches so nothing escapes the band. | `test/trivia.test.js` (2 000 gated draws stay in band, kinds still alternate, a due retry above the band is refused) and a `state.test.js` walk of 8 seeds × 6 buildings at Corner Shop. Both mutation-checked: dropping the filter reports `elevator-history-haughwout-five-floors is difficulty 2`, dropping the wiring reports `seed 1: difficulty 2 at numbers to 10` |
| `r1-autism-fit-07` | The picker never said that picking another building ends the parked one. The behaviour is already the kind thing — the tray is banked — so only the words were missing; the lobby's floor label is now one function both screens share. | the `settings` drive scenario parks a building, opens the picker, asserts the note names the parked floor and the lunchbox, then picks Hotel and asserts the tray reached the lunchbox |
| `r1-elevator-feel-03` | The lit floor button was read from the pre-timeline car: it glowed amber for the whole 3.6 s fall (against §2's `Button light out`) and nothing was lit on the recovery express, where a real car shows its registered call. The fall clears `carCall`; the retry issues a `press` (which draws no randomness, so `elevator.test.js`'s snapshots do not move). Also `color: var(--ink)` on `.floor.lit .face`: the lit digit was #9A968C on #E8B04A = **1.51:1**, invisible to the contrast gate because it skips anything inside a disabled button. | `state.test.js` (carCall null through the fall, `=== target` on the express) and the `fall` drive scenario, watched failing: `the car call stays lit through the whole fall` |
| `r1-autism-fit-04`, `r1-mobile-ux-07`, `r1-elevator-feel-09` | One `cannot act` look for the panel (`.panel .key:disabled`, the same three colours the disabled floor face already used — no red, no cross, no washed-out glyph), `.topbar .tb.nav:disabled`, and `STABLE` exported from `state.js` so `main.js` and `panel.js` REFLECT the reducer's own guard instead of re-implementing it. The two door keys had been disabled and drawing as live white keys the whole time; no reviewer caught that. | the `fall` drive scenario asserts Lobby, the bell and both door keys report `disabled` during the fall, and that a disabled key does not paint the live white with the live drop shadow. Watched failing with the CSS rule removed |
| `r1-elevator-feel-04` | `◁▷` during a close snapped the doors fully open and then held them for the whole 500 ms step: the renderer re-seeded its animation from `state.car.doors` (still `open` on a reopen) instead of from what it last drew. `lastDoorPos` is the painted position. | covered by the existing door-order assertions; the drive's `fall` and `play20` step orders are unchanged |
| `r1-elevator-feel-05` | A digit tapped after a lone `0` was refused: no click, no change, and GO then sent the `0` the child thought they had replaced. It replaces the zero now, and still clicks. | `state.test.js`: `0` then `5` gives `5`; `0` twice gives `0` **and** still emits a click — the falsifier for a dead key |
| `r1-elevator-feel-08` | The `+ 5` number line drew one long arc labelled `+ 5`, which only reads if you already know what `+ 5` means. It draws `b` unit hops (28.8 px each at Corner Shop). | a new `layout` checkpoint counts the quadratic paths in `#hint svg` against the problem's own `b`. Watched failing: `the number line draws 1 hop(s) for b = 5` |
| `r1-autism-fit-05` | The floor-mode spacer carried a 26 px bold `·` — the only glyph on the panel that did nothing, and no `[data-tap]`, so the 48 px gate never looked at it. | a `layout` assertion: a floor-mode spacer must carry no text |
| `r1-elevator-feel-07` (half) | Corner Shop **step 3** drops 0 as an operand: 22 % of its sums carried one, and `2 + 0` is not a question for a child who loves maths. 0 stays the teaching point at steps 1 and 2. | `test/math.test.js`: 0 must still appear at steps 1–2 and never at step 3. Fails on HEAD at 1 250/5 000 |
| `r1-trivia-truth-01` … `-07`, `r1-math-10` | Eleven trivia items corrected — see below. **67 items in, 67 items out:** nothing was cut, because every claim was either sourced or removed from the sentence rather than the item. | four new `trivia.test.js` tests, all four watched failing on the shipped bank |

### The trivia bank: 67 → 67

Every source below was **fetched in this session**; no claim was repaired from memory.

- **`elevator-engineering-inspection-certificate`** — the shipped item cited *34 Pa. Code § 7.15*
  under a sentence about **Maine**, and the project's own audit had already called that citation
  rotten (a 1924 rule superseded by ch. 405) and recorded the fix: *cite Maine Title 32 §15221*.
  The fix was never applied to `sources[]`. Applied now, and §15221 (fetched) carries **both** shown
  claims: `The owner of an elevator shall have the elevator inspected annually` and `The elevator
  certificate must be posted in the elevator`.
- **`elevator-culture-thirteenth-floor`** — the 2024 figure lived only in the refute lens, which the
  player never sees, and said *apartment* where the study counted *condominium* buildings.
  Hardesty & Auerbach, *Significance* 21(2), April 2024 promoted into `sources[]` with its quote
  (`of the approximately 620 condominium buildings in New York City with more than 13 storeys, only
  13.5% have a unit with a thirteenth-floor address`); wording corrected.
- **`elevator-engineering-kone-monospace-1996`** — the Otis-1990-Tokyo parenthetical had no shown
  source and its only citation (Elevator World) answers **HTTP 403** to every fetch. Search snippets
  name an Otis *Sky Linear* of 1990, but a snippet is not a source. **Cut, not softened.**
- **`elevator-records-bailong-outdoor-elevator`** — the cited Guinness page itself gives two ride
  times (`takes 1 minute 58 seconds` and `takes just 1 minute and 32 seconds`) and the fact asserted
  only the faster. Reworded to *under two minutes*, true under either reading, and the source now
  ships the quote a parent can check.
- **`elevator-history-colosseum-capstans`** — the second source shipped the quote `had roughly 25
  elevators`, contradicting the item's own 60 capstans. Fetched: that page carries no sentence about
  the hypogeum or its capstans, so there was no honest quote to swap in. Source dropped; the
  Smithsonian interview with Beste, who did the work, remains.
- **`elevator-culture-otis-1854-rope`** — its question named **1854** and its fact a **five-story**
  store: the answers to two other items in the same pool, which `pickFact` will show inside one
  cycle. Both are now told without the numbers (and the fact drops 402 → 297 characters).
- **Five facts over 360 characters** (`door-close` 434, `otis-1854-rope` 402, `monospace` 386,
  `autotronic` 384, `tallest-lift` 363) trimmed to ≤ 310. Nothing trimmed was untrue: every removed
  sentence is preserved verbatim in `data/trivia-audit.json` with its source.
- **`math-numbers-chessboard-doubling`** (`r1-math-10`) — `About 18 quintillion` against a distractor
  of `About 18 trillion` is only right on the **short scale**, and the bank otherwise writes British
  English (*storeys*, *maths*, *lift*). The answer is now `A 20-digit number`, which is the same under
  every naming convention; the total was re-checked at Wolfram MathWorld
  (`2^(64)-1=18446744073709551615`).
- **`elevator-history-empire-state-73-elevators`** (`r1-math-10`, second half) — **the finding does
  not stand.** The ESB facts page says `the Empire State Building houses a whopping 73 Otis
  elevators` verbatim (fetched). The item is unchanged; the quote is now shown so no reader has to
  take it on trust.

The root cause of the first one — an audit that records a fix the artefact never receives — is now a
test: **`the audit record and the shipped bank say the same thing`** compares question, answer,
distractors, fact, source URLs and source quotes item by item across the two files. Two more gates
came with it: every shown fact ≤ 360 characters with a quote on every source, and no item may give
away another item's answer (one documented exception, the Eiffel pair, where the maths item cannot
ask its arithmetic question without naming its inputs).

### Rejected

- **`r1-elevator-feel-07`, the offer-timing half.** Measured across seeds 1–10 at corner and hotel
  under perfect play: the roof offers the next level at the SECOND roof, after exactly 20 questions,
  deterministically. The finding wants it at the first. §4 makes `two consecutive buildings at step 3
  with ≤ 1 fall` a marked **Decision**, taken against judge 3's objection to silent difficulty
  change, and §Risks 5 repeats it. Twenty questions is about six minutes, and the Lobby's level chip
  moves building in one tap. The defensible half of the finding — the 0-operand rate — is fixed.
- **`r1-math-06`'s suggested fix** (cap the ×10 table at 5 × 10). It contradicts §4's own Hotel
  step-3 row and would delete two thirds of a table the design specifies. The tag was wrong, not the
  table.
- **`r1-math-09`'s suggested fix** (enforce `max − min ≥ 5`). It treats the symptom at the wrong
  layer: the measured degeneracy is not narrowness but tables with NO legal draw (add is degenerate
  at 50–100, a span of 50; mul at 100–120 inverts its own range). A span rule leaves 9 of the 39
  degenerate configurations degenerate and forbids harmless narrow ones. Satisfiable-by-construction
  tables plus `degrade()` fix all 39.

### Numbers

`npm test` **123 → 148** tests, all green (`explain` +2 including a 130 000-classification invariant
sweep, `levels` +2 including all 360 reachable Custom settings, `math` +3, `state` +7, `trivia` +4,
and a new `panel-capability.test.js` with 3). `node tools/phone-drive.mjs` **40/40 → 45/45**: eight
scenarios became nine (`fall-negative`) across all five corrected phone profiles, and `fall`,
`layout` and `settings` carry eleven new assertions. `npm run headless` unchanged and in bounds on
every level: 0.00 % repeats, max kind 25.5–38.7 %, step 3 by the sixth answer, 0 falls under the
perfect policy.

Measured before → after, on the things a child feels:

| | before | after |
|---|---|---|
| negative sum re-asked after a fall | no `±` key, unanswerable for ever | `±` present at every Megatall step |
| bacon in a building with one double miss | 15 | 16 |
| Corner Shop passengers above difficulty 1 (seeds 1–8) | 53 of 96 | 0 |
| longest Corner Shop question | 188 characters | ≤ 130 |
| degenerate Custom settings (of 360 reachable) | 39 | 0 |
| Custom draws rendering `undefined` | 4 804 of 324 000 | 0 |
| second-try child's step after 18 questions | 3 (from question 7) | 1 |
| comeback at +15 | never fires, in any configuration | fires |
| comeback at +5 for a miss on floors 6–9 | never fires | fires, in the next building |
| Hotel doubles / Skyscraper squares | 7.99 % / 9.43 % | 13.1 % / 16.2 % |
| lit floor digit contrast | 1.51:1 | 7.24:1 |
| trivia facts over 360 characters | 5 | 0 |
| shown claims with no shown source | 3 | 0 |

Two things the instruments could not have caught before this round, and now can: the `fall` scenario
never missed twice (so the entire forfeit branch — reducer, renderer and copy — shipped unwatched),
and it always entered `answer + 1` (so only the `offby` clause was ever exercised, which is how a
Repair card telling a child who added that `+ means add` shipped with a drive assertion on the same
screen).

### Handed on

- **`settings.secondTry` is still `true` at every level**, while §4 says `on at Corner Shop, off
  above`. The measured harm — a second-try child being promoted on the strength of answers they got
  wrong the first time — is fixed by the `recordQuestion`/`applyAdapt` split, so the remaining gap is
  a spec question, not a defect: either flip it when the child ACCEPTS a roof offer (and say so on
  the offer card), or amend §4 to make it a pure parent switch. **The lead should decide.**
- **`levels.js` carries a `floors:` field** (corner 3, hotel 6, rest 9) that nothing in `src/`,
  `test/` or `tools/` reads — every building is 9 floors plus the roof. And `phase: 'pit'` is in
  `PHASES` and handled by `createDisplay`, but the reducer never sets it. Dead, both of them.
- **`repair().small` prints `you pressed 2` for a child who pressed `0` then `2`.** `state.js` keeps
  the raw string in `ride.typedWrong`, so the exact keys are available if a later round wants the
  card to echo them. With the reversal fix in, it no longer feeds a false clause.
- **The mul-square signal is unused.** A child who types `a × a` on `7 × 5` has recalled the wrong
  table row; it lands in `other` 5 726 times per 4 003 drawn `mul` problems. A truthful neighbour
  clause (`that is 7 × 7; it is 7 × 5`) is one line inside the `mul` block, deliberately left out to
  keep this diff to the findings.
- **The Hotel tag now wraps to two lines at 320 px** (the picker row grows 74 → 92 px). Measured, no
  overflow, drive green — but it is the first level tag that does not fit on one line, and a sixth
  level would want a shorter form.

## Round 2 — hostile review (2026-09-08)

Forty-nine findings, all reproduced by at least one verifier before they reached me. Forty-five
fixed, one fixed in part, three skipped with reasons below. One defect nobody reported was found
while measuring the save's growth and fixed with the rest.

**Instruments before → after:** `npm test` 148 → **173 passing**; `npm run drive` 45 → **70 passing**
(9 → 14 scenarios × 5 phones); `npm run drive:update` **15/15**. Every fix below is pinned by a test
in `test/` or a scenario in `tools/drive-scenarios.mjs` that fails without it; the two that could
only be shown in a browser were mutation-tested by reverting the fix and watching the new scenario
go red (`door-interlock`: the ◁▷ key lit in 33 of 58 frames where it could do nothing; `two-tabs`:
"an untouched tab took the tray from 7 to null").

### High

| id | what changed, and why | pinned by |
|---|---|---|
| r2-mobile-ux-001 | **Landscape put GO off the screen.** The short-landscape rule pinned `--cell 48 / --gap 4 / --display 60` in a grid row only `vh − display` tall, so the panel needed 324 px of viewport height — arithmetic done against the DEVICE height. A browser hands a 360 × 640 Android ~304 px and a 320 × 568 iPhone ~276, and `#app` is `overflow: hidden`: GO measured 32 px, then 4 px, of its 48, with no scroll anywhere and nothing saying to turn the phone back. The ride is now a three-row grid whose panel spans all three rows, so the panel gets the WHOLE viewport height; `--cell` is computed from it with amendment 8's 48 px floor; the keys sit at the bottom of the column; and under the 258 px five keys need, the panel scrolls inside its own box. Measured after: GO whole at 331, 304 and 276, and reachable by scrolling at 232. | drive `layout`: four landscape turns at browser heights, `{ride, go}` at each, plus a new panel-reachability check that scrolls the panel and asserts every key lands inside its box; `test/dom-contract.test.js` asserts the PROPERTIES (panel spans the height, cell computed from `--vh`, panel scrolls) rather than one grid string |
| r2-code-hostile-01 | **Two tabs wiped the lunchbox.** `save()` wrote `serialize(state)` blindly on every effect, on `visibilitychange` and on `pagehide`, so a second tab opened from a bookmark and never touched wrote its boot snapshot over three buildings of play the moment it was backgrounded — total, silent, no tap needed in the offending tab. The save now carries a monotone `writes` counter: a tab whose counter is behind the record on disk ADOPTS what is there instead of overwriting it, and a `storage` listener re-hydrates an idle tab from a foreign write (never mid-ride: nothing moves under the child's finger). | drive `two-tabs` (a real second page, `bringToFront` both ways, no taps in it); mutation-tested |
| r2-deploy-pages-01 | **A content-only deploy never reached a child who already had the game.** The browser's update check compares `sw.js`'s bytes and nothing else; three of the last four deploys changed shipped assets without touching it, so no worker installed and the cache-first handler never asked the network again. `sw.js` now carries `BUILD`, a hash of every file it precaches, and the cache is `be-<VERSION>-<BUILD>`, so any content change moves sw.js's own bytes. `tools/build-stamp.mjs` writes it. | `test/version.test.js` recomputes the hash and goes RED until the stamp is moved — the message names the command; `npm run drive:update` still 15/15 |

### Medium

| id | what changed, and why | pinned by |
|---|---|---|
| r2-autism-fit-01 / r2-math-02 | **HINT was a 2 px smudge on the smallest phone.** `.hint` was 46 % of a shaft the short tiers had collapsed to 82 px, and a fixed 320 × 110 viewBox letterboxed the whole drawing into a 16 px box: the 0–10 tick labels painted at 2.0 CSS px. The card now has a 64 px floor and both renderers derive their viewBox HEIGHT from the box's aspect, so the drawing is width-limited and fills what it is given; under 34 px the worked line takes over. Measured after at 320 × 454: labels **12.0 px**, drawing fills **74 %** of the width. | drive `layout` `{hint: true}` measures the PAINTED label height (≥ 9 px) and the fraction of the width filled — the old check counted `<path>` elements and could not see any of it |
| r2-math-01 | **The comeback queue served the same sum twice running and starved the generator.** `afterAnswer` queued two entries per miss and removed one on a re-miss, so a late comeback re-armed itself while its twin was overdue; and because a struggling child always had something due, every question was a comeback. The queue is de-duplicated by key, serving clears every DUE entry for that key, and `ctx.lastComeback` stops two comebacks in a row. | `test/math.test.js` (three levels × 40/60/80 % accuracy: zero back-to-back, ≤ 55 % comebacks, ≥ 20 distinct sums in the last 200) and the new imperfect-child sweep in `test/headless-play.test.js` |
| r2-math-04 | **The ladder went down at Office → Skyscraper.** Skyscraper step 1 was Office step 3's mul/div rows verbatim, so all 126 of its reachable sums were already reachable at Office step 3, which serves 5 500 more. Step 1 now carries the 2–12 tables (the 11s and 12s are what the building is FOR) and step 2 keeps the missing-factor form and widens division to 144. | `test/levels.test.js`: for every consecutive pair, the next level's step 1 must reach keys the previous step 3 cannot, and may not top out lower |
| r2-math-03 / r2-autism-fit-06 | **▲ and ▼ were operators the game never defined**, while the same glyphs mean DIRECTION on the hall calls and the lantern of the same screen. `▲ means go up: add.` now rides in the band under the sum whenever one is on screen, and the Rules card names both. | drive `rules-route` plays until a ▲/▼ sum comes up and asserts the band says so |
| r2-autism-fit-03 | **After the first play the rules were reachable only through an unlabelled bell**, in floor mode, with the car standing still. The lobby carries `How it works`, the bell key carries the word RULES, and `card-continue` now decides where to return from the PHASE (a parked ride whose phase is `lobby` used to land the child on the ride screen with the reducer in the lobby). | drive `rules-route`; `test/state.test.js` for the return branch |
| r2-elevator-feel-01 | **The ◁▷ key stayed lit ~1.6 s after it could do anything**, then greyed itself out when pressed. `tick()` fired the timeline's steps before advancing the shaft's clock, so the two re-renders at `doors-closed` and `move-start` both read the previous frame and re-armed the key. The clock leads the steps now. | drive `door-interlock`, at timescale 1 (`?fast=1` compresses the whole ride into 270 ms and hides it); mutation-tested |
| r2-elevator-feel-02 / r2-trivia-truth-02 | **The three-ropes card cited the wrong regulation.** §1604.25 is Construction Safety Orders, Article 14 "Construction Hoists" — different machines, and its factor table stops at 10.70, so it does not carry the "nearly 12 times" the fact quotes. The shown source is now §3042, the Elevator Safety Orders section the fact names, with its verbatim quote; the hostile lens moved to the construction-hoist rule, which is exactly the check that failed. | `test/trivia.test.js`, generalised: any fact naming `section NNNN` must show a source carrying it |
| r2-mobile-ux-002 | **The drive's landscape turns used device heights**, so the gate could not see finding 001. They are the browser-visible heights now (667 × 331, 640 × 304, 568 × 276, 568 × 232). | itself: the same turns fail on the pre-fix CSS |
| r2-mobile-ux-003 | **`Bigger text` was a no-op on every screen the child reads.** 67 absolute `font-size: Npx` rules meant `html.big` raised only the Grown-ups labels — the one screen a parent is looking at while deciding whether it worked. Every child-facing size is now `calc(var(--body) / 18 * N)`, byte-identical at the 18 px default. | drive `settings` turns it on and asserts the lobby's Ride button, the level tag, the sum and the panel keys all grow |
| r2-code-hostile-02 | **A refused write was swallowed.** `storage.js`'s in-memory fallback keeps the session working, and `main.js` discarded the boolean, so the child played a whole session and the lunchbox was 0 on the next load with nothing on any screen to say so. The lobby and Grown-ups now say it, and point at the save code. | drive `storage-refused` (every `bacon-elevator` write throws) |
| r2-deploy-pages-02 | **`?reset=1` refilled from the browser's own HTTP cache.** The deletes were undone within 266 ms by the surviving worker, so the child paid their whole lunchbox and stayed on the superseded build. The reset now re-fetches every precached path with `cache: 'reload'`. | `test/version.test.js` asserts `RESET_ASSETS` equals `sw.js`'s `ASSETS` exactly, so the two lists cannot drift |
| r2-autism-fit-02 / r2-math-05 | **`0 + 0` and `0 − 0` are not questions**, and one fresh save in six opened on an answer of 0. Both operands zero is refused at every level and step, and the FIRST question of a brand-new save never answers 0. 0 stays the teaching point at Corner Shop steps 1 and 2 that `levels.js` describes, and the shipped test for that still passes unchanged. | `test/math.test.js`: 200 000+ draws across every level and step, and 1 500 fresh saves |

### Low — all fixed

`r2-autism-fit-04` a scroll cue on the fact and rules sheets (pure CSS, no listener) · `r2-autism-fit-05`
a step change says so in words (`Bigger numbers now.`) in the band that carries `Try once more.` ·
`r2-autism-fit-07` one colour for the button that carries you forward; sage now means only ON ·
`r2-autism-fit-08` the Rules card says where the bacon goes · `r2-autism-fit-09` the three-ropes lens
now reads a second document; the two items that were genuinely checked twice against one source are
NAMED in the test and amendment 1 is narrowed to what the record shows · `r2-math-07` the tag-honesty
guard parses the leading bound out of any tag and measures every level and every step (it had been
`/^numbers to (\d+)$/`, so adding `; tables 2, 5, 10` made it skip the level it was written for) ·
`r2-math-08` an imperfect-child sweep beside the perfect one · `r2-math-09` two arithmetic word
problems re-filed from `elevator` to `math` (mix 42/25 → 40/27) · `r2-math-10` `TRIVIA_LIMITS` gains
`maxNumber` and items declare `maths: {max}`, so a `numbers to 10` child is not asked 8 × 5 (Corner
Shop band 22 → 20 items, both kinds still stocked) · `r2-math-11` two questions reworded to be
answerable before reading the options · `r2-elevator-feel-03` the dead `floors:` field deleted ·
`r2-elevator-feel-05` the landing's hall call lights while the car is called · `r2-elevator-feel-07`
a disabled floor key answers the press by re-stating which button is lit · `r2-elevator-feel-08` a
counted run keeps a non-breaking space before its last number · `r2-mobile-ux-004` `pan-y pinch-zoom`
· `r2-mobile-ux-005` / `r2-deploy-pages-04` the chip speaks the game's register and can be put away ·
`r2-code-hostile-03` a short portrait window gives the panel the scroll · `r2-code-hostile-04`
`normaliseRide` clamps the ride's counters, not only its geometry (an import could make the lunchbox
NaN) · `r2-code-hostile-05` `load-facts` re-validates its payload · `r2-code-hostile-06` `facts.seen`
holds one entry per fact and the missed-fact clock moved to `history.count` · `r2-code-hostile-07`
`validProblem` refuses an answer wider than the keypad can type · `r2-code-hostile-08` Custom's tag
names where its floor moves live · `r2-code-hostile-09` no entry, no `you pressed 0` ·
`r2-code-hostile-10` digits, Backspace and Enter from a paired keyboard · `r2-trivia-truth-01` one
card, one date · `r2-trivia-truth-03` the Siemens exhibition and the 20-metre tower are cited (and
the uncited streetcar clause is gone) · `r2-deploy-pages-03` a `404.html` that says Bacon Elevator
and computes its own way back.

### Found in passing, not reported

**A plaque was hung again on every roof.** `PLAQUES` holds numbers and `state.plaques` holds strings,
so `state.plaques.includes(p)` was never true: past 200 bacon the roof card announced "A plaque for
200 bacon hangs in the Lobby" on every single building, the Lobby drew the same plaque over and
over, and the list grew without bound. Found while measuring the save code's growth for
r2-code-hostile-06 — the growth that survived the `facts.seen` fix was this. Pinned by
`test/state.test.js` (four roofs from lunchbox 199: announced once, never again) and repaired for
existing saves in `migrate`.

### Skipped, and why

- **r2-elevator-feel-04 — the Fact card and the roof are full-screen takeovers.** Both are the spec:
  amendment 3 defines the Fact card as "a full-height sheet over shaft and panel", and §Screens makes
  the roof picnic its own screen. Rendering them inside the panel band contradicts that and the
  vertical budget it sits in — at 320 × 454 the panel's four text rows are 204 px, which the longest
  fact (434 characters) does not fit, and the shaft would then be paying for a text card. This is a
  design change for the lead, not a defect fix.
- **r2-elevator-feel-06 — a long passenger question shrinks the shaft to 79 px at 320 × 454.** Both
  offered fixes contradict something shipped. Capping questions at ~110 characters reverses amendment
  3, which dropped the ≤ 90 cap deliberately and states that a question is "never truncated"; making
  the question scroll inside its own box trips the shipped `worst-trivia` gate ("the longest question
  is clipped"), which is the assertion that keeps the bank readable. The shaft yielding IS amendment
  8's documented trade, and `.shaft.tiny` already blanks a cropped sliver rather than showing one.
- **r2-mobile-ux-006 — the shaft gets 82 px of 454 on the smallest phone.** The finding calls it "a
  nicety rather than a defect" and a deliberate, documented trade, and it is: no key may ever be
  pushed off the bottom. The harm it actually names — the elevator unreadable at a glance because the
  HINT over it is a smudge — is fixed by r2-autism-fit-01, and a third short tier trimming the
  display band and the gaps would take the Repair card's four-row box from 204 px to ~201, which the
  drive's card check is already close to failing at Megatall.
- **r2-math-06 — partly.** Megatall's tag now reads `big numbers, and below zero` and the Grown-ups
  Level list shows every level's tag, so a parent choosing it is told. A per-preset negatives switch
  is NOT built: it needs a level-override field in the save schema and a second source of truth
  beside `levels.js`, and Custom already exposes the knob. **The lead should decide** whether the
  preset levels get their own overrides or the answer stays "use Custom".

### Handed on

- **`tools/build-stamp.mjs` must be the last thing run before a commit that changes a shipped file**,
  or `npm test` is red. That is the point — but it means the stamp is a merge-conflict magnet on any
  branch that touches `src/`, `css/`, `index.html` or `data/`. If that becomes a nuisance, compute
  the hash in the worker at install time instead and compare it there.
- **Two items are still checked twice against the same document** (`elevator-engineering-infrared-light-curtain`,
  `elevator-records-space-elevator-orbit-height`). They are named in `test/trivia.test.js` so a third
  cannot join them unremarked; re-running the hostile lens against a genuinely different source is a
  research task, not an engineering one.
- **The `two-tabs` guard resolves a genuine double-play by adopting whichever record is newer**, which
  means a tab that was ALSO played can lose its own progress rather than the other tab's. That is
  strictly better than the silent wipe, and it is the shape the review asked for, but a real merge
  (take the larger lunchbox, the union of the facts) is the honest end state.
- **`settings.secondTry` is still `true` at every level** — round 1's open question, unchanged.

## Round 3 — hostile review (2026-09-08)

Forty-four findings: **14 medium, 30 low**, no highs. The panel attached no numeric score to this
packet; the severity census is the score, and it is the first round with nothing above medium
(round 1 and round 2 both opened with defects that put a control off the screen or wiped a save).
Every one of the fourteen mediums, and two of the lows, carried three independent verifier reports;
the other twenty-eight lows were filed unverified. **Forty-three fixed** (three of them in part),
**one skipped**, with reasons below.

**Instruments before → after:** `npm test` 173 → **192 passing**; `npm run drive` 70 → **85 passing**
(14 → 16 scenarios × 5 phones, plus a second `layout` pass at the DEVICE heights); `npm run drive:update`
**15/15**. Every fix is pinned by a test in `test/round3.test.js` or a scenario in
`tools/drive-scenarios.mjs` that fails without it. The layout and DOM fixes were mutation-tested by
reverting the fix and watching the new assertion go red — the numbers that came back are the
reviewers' own: `.roof [data-next]: 0 px of 72 on screen at rest, in a 276 px viewport`;
`.lobby [data-nav="ride"]: 26 px of 72`; `unlit floor digit "R" at 2.57:1`;
`[rules] .rules .body needs scrolling: 584 > 562`; `the car is moving with #doors[data-state="closing"]`.

### Two things the round found that no finding named

- **`--tall` was not in the gate at all.** r3-mobile-ux-2 is the counter-example to round 1's
  assumption that the device heights are "the easier case": `display: standalone` is exactly the mode
  that hands the page its full height, and the parent who does the right thing — Add to Home Screen —
  is the one who got the sliced Rules card. `node tools/phone-drive.mjs` now runs `layout` a second
  time at the device heights, reported as `layout-tall`.
- **`tools/update-drive.mjs` copies a hand-written file list.** Adding `404.html` to `sw.js`'s
  `ASSETS` broke `npm run drive:update` outright, because `addAll()` rejects on one missing entry and
  the whole install fails — the trap `test/dom-contract.test.js` already guards for the repo, with
  nothing guarding the deploy harness's own copy of the tree. `404.html` is in `COPY` now and the
  reason is written above it.

### Medium

| id | what changed, and why | pinned by |
|---|---|---|
| r3-autism-fit-01 | **The trivia answer was named by letter on one screen and by text on the next.** The beat band says `The answer is C.`; 900 ms later the fact card said `The answer is A lift.` — the same sentence stem, one naming a LETTER, one naming text that begins with "A". Seven of 67 items have such an answer, five of them inside Corner Shop's 22-item band, and eleven have such a distractor, which the `You chose …` line hit too. The card now reads `You chose A: A trolley.` / `The answer is C: A lift.`, the colon convention the choice buttons' `aria-label` already used. The three letters moved to `src/trivia.js` (`CHOICE_LETTERS`), because the card could not reach them in `panel.js`. | `test/round3.test.js` r3-autism-fit-01: the observed item verbatim, then every `A `/`An `-initial answer in the bank |
| r3-math-01 | **Custom with one operation served the identical sum twice running.** Two mechanisms, and the report named only the first: the table is smaller than the 20-key ring (× at Largest 20 is ten keys), AND a single-kind step makes `kindRun.n >= 3` permanently true from question 4, which rejected all 50 attempts whatever the pool size — `× only, 2–100` (a 44-key pool, twice the ring) repeated the previous key at exactly the uniform-random rate. The kind-run guard now applies only where there is more than one kind to vary, and the `if (last) return last` fallback keeps the last-served key out. Measured after: 0.00 % back-to-back on every single-op configuration, where × at Largest 20 was 4.5–7 %. | `test/round3.test.js` r3-math-01: nine one-op and small-pool Custom settings, 12 seeds × 250 draws each at 80 % accuracy |
| r3-math-02 | **The ladder only ever adapted upward.** `step3Run` offers `LEVEL_ORDER[idx + 1]`; nothing counted the mirror, so a child who accepted one offer too many fell on most questions of every building indefinitely while `history.falls` recorded every one of them and no renderer read it. `struggleRun` counts buildings finished on step 1 with ≥ 5 falls, and after two the SAME roof card offers the building below, with the same Yes/Stay and `Stay` still primary. Not the silent easing §4 dropped: the child answers it. Verifiers disagreed on how far the ladder can actually overshoot (one rung by the offer path, four by the picker); the asymmetry itself is what is fixed. | `test/round3.test.js` r3-math-02: two all-wrong buildings at Office Block, the offer, the accept, and Corner Shop offering nothing below itself |
| r3-math-03 | **The Skyscraper promotion still narrowed the question set.** Amendment 12 wrote the rule and `test/levels.test.js:148` carries its title, but that guard asserts only ≥ 10 % fresh and a non-falling ceiling — it never compares the two pools, so Office 3 → Sky 1 sat at 147 reachable keys against 5 676 (38× narrower) and cleared the freshness bar by 4.3 points. Skyscraper step 1 now carries the ± rows step 3 already had, at the level's own 144 ceiling rather than Office's 100. Measured after: 8 810 keys against Office 3's 5 435 (1.6× LARGER), 52 % of them fresh, × and ÷ still 5/7 of the weight. | `test/round3.test.js` r3-math-03 asserts the POOL SIZE across all four promotions — the invariant the old test's title claimed and its body did not measure |
| r3-math-04 | **partly.** A sum whose operator was glossed `go down` made the elevator go up. The gloss now names the arithmetic and says what actually moves — `▼ is take away: the number goes down.` — and the Rules card's picture reads `▲ = add, ▼ = take away` instead of `▲ = up, ▼ = down`, which was the sentence contradicting the tile beside it. The OPERATORS stay: §4 ships them as the elevator-native form, every kind is an abstraction the car does not obey (`7 + 5` does not send the car to 12), and dropping ▼ leaves ▲ with the identical glyph clash plus a new one — a missed `6 ▲ 4` sits on the display through the whole fall while the indicator reads ▼ and the car really is going down. See "skipped in part" below. | drive `rules-route`: the band must name `add`/`take away` AND `the number goes up/down`, and must not say `means go` |
| r3-elevator-feel-01 | **The 1.2 s before a fall was the reward display minus a small green tick.** `.blank.filled` had no CSS rule of its own, so the true answer arrived in exactly the ink and underline of the digits the child had just typed, with an empty message band: the wrong 7 silently became a 10 and the car dropped. The true answer is now drawn in `--ink` (`#question.truth`) and the band says `you pressed 7` — the string `state.lastResult`/`ride.typedWrong` already held and nothing read. No cross and no red: the fall carries no punishing copy anywhere, which is BRIEF requirement 7 and the reason the reviewers' suggested ✗ was not taken. | drive `fall`: the `truth` class, the computed ink, the band text, and the tone check (`no !, ✗, wrong, oops`) |
| r3-elevator-feel-02 | **in part.** `lunchboxMilestone` filtered PARTS only, so from the 100-bacon chime (building 7) the roof card printed no forward goal at all — for the twelve buildings to the 200 plaque and for ever after the last one — while `PLAQUES` sits eleven lines above it and the Workshop already draws all four greyed. It falls through to the plaque ladder now. The other half of the finding, "make the buildings differ AS ELEVATORS", is a v2 feature against amendment 12's own decision; see below. | `test/round3.test.js` r3-elevator-feel-02: the fall-through at every part and plaque boundary, and the rendered `Next plaque at 200 bacon` |
| r3-mobile-ux-1 | **The roof's controls were below the fold on every landscape phone.** `Next building` sat at y 370–442 in viewports 276–412 tall (0 px visible at 276/320/331) and `Lobby` at 0 px in all six, on a card that ended in clean paper — no cut glyph, no shadow, nothing saying it continued. Two fixes, because the second verifier was right that this is a `.page` bug and the roof is its worst instance: `.page` now carries the same four-layer scroll cue `.sheet .body` was given, and the roof's button stack is sticky to the bottom of its scroller (inert whenever the card fits). | drive `layout`: a new `onScreen` measurement — a named control must have ≥ 44 px on screen AT REST — run on the roof in portrait and at two landscape turns |
| r3-mobile-ux-2 | **The installed Rules card cut `There is no clock.` in half.** At 360 × 640 the body needed 584 px in 562: 640 drops out of the `max-height: 620px` tier and takes the full-size type with no room for it. The band is 621–661 at 360 wide and never fits at 320. The `.rules` compaction is now its own tier at 700 px (the card needs 662 at full size), leaving the ride's budget untouched, and the 620 tier no longer restates it. | `node tools/phone-drive.mjs` runs `layout` a second time at the device heights (`layout-tall`), which is the only way the gate sees `display: standalone` |
| r3-code-hostile-01 | **After a dead floor-key tap the next sum was never shown.** `ui.transient` was cleared only by a 1400 ms timer and `render()` hands any standing transient straight to `display.render`, which returns before the `keypad` case — so tapping 9 at G (the move the dead-key handler exists for) and then the lit button left the keypad live for up to 1.35 s with no sum, no typed digits and no `Try once more.`; with Second try off, GO in that window dropped the car for a sum that was never displayed. Worse than filed: the stale line is an executable WRONG instruction, because `Press 1` was about floor button 1 and the panel underneath has swapped to the digit pad, where `1` is an answer key. A transient is now scoped to the phase, screen, problem and entry it was written for. | drive `transient-scope` (new): the dead-key line, the lit button, the sum on screen, a typed digit visible at once, and the same again with Second try off |
| r3-code-hostile-02 | **With a second tab open, the child's next tap — including a correct GO — was discarded.** `save()` runs as an EFFECT of the dispatch the tap produced, so `adopt and return` threw away the reduced state and replaced it with the other tab's snapshot, which `parse()` parks on the Lobby. Merely OPENING the game a second time moves the counter (each tab saves on its own `visibilitychange`), and one verifier diffed the two records: the one the child was forced to "catch up with" was byte-identical to their own. The counter's job is to stop BACON being lost and it still does that — a record holding more bacon is adopted whatever the phase — but a tab mid-building that holds at least as much keeps the child's action, which is the same rule the `storage` listener already applied. | drive `two-tabs`, extended by the one tap it stopped short of: after the stale tab is fronted twice, the next floor press must open the keypad and a correct GO must move the car |
| r3-trivia-truth-01 | **The Pi Day fact card showed the child "In Memoriam" and linked into an obituaries section.** `gate()` built its scanned text from question/answer/distractors/fact and stopped there, but `sources[].title` is rendered verbatim on the card and as the Fact Book's link. The item is difficulty 1 with a 46-character question, so it is in the pool at Corner Shop. The gate now scans every source title, url and quote against a WIDER list than the fact text (memorial vocabulary included; `grave` deliberately excluded, because Elisha Graves Otis is in the bank's source titles and a gate that fires on a middle name polices a spelling, not a hazard). The citation was replaced with the Wikipedia Pi Day article (fetched, quote verbatim) and the `1:59 p.m.` detail left with it rather than standing uncited. | `test/round3.test.js` r3-trivia-truth-01: the gate refuses a memorial title, url and quote independently, the shipped bank passes, and no shipped source carries one |
| r3-deploy-pages-01 | **With the worker installed, a navigation two segments deep returned a blank white page with no controls.** `req.mode === 'navigate'` classed every in-scope navigation as index.html, so `/bacon-elevator/floors/nope/x` got the cached shell whose relative refs then resolved against `/floors/nope/`: HTTP 200, empty body, zero buttons or links, no reload recovering it, and the deliberately built `404.html` dead code for every client that had ever opened the game. Only the scope root is answered with the app now; anything else goes to the network so Pages serves the friendly page, and `404.html` is precached so it works offline too. Verified live against a Pages-faithful server with the worker controlling: `floors/nope/x`, `nope` and `index.html/` all return 404 with the elevator drawing and a `Back to the lobby` link; the root still loads the game with 23 controls. | `test/round3.test.js` r3-deploy-pages-01 (the root comparison, the navigate fall-through, the offline fallback, both asset lists) |

### Low — fixed

| id | what changed |
|---|---|
| r3-autism-fit-02 / r3-elevator-feel-05 | **in part.** At 568 × 232 the bottom row (0 and GO) hangs 26 px below the fold at rest. `--cell` cannot go under 48 px (amendment 8, and the drive fails on it), so the panel keeps scrolling — but it now carries the same scroll cue `.sheet .body` has, so it says so. The sliver is tappable and one drag fixes it for the session; both verifiers measured that. |
| r3-autism-fit-03 | The storage / adopted notice moved out of the end of the lobby markup and up under the lunchbox total, where a grown-up trips over it without scrolling. |
| r3-autism-fit-04 | The unlit floor digits went from `#9a968c` (2.57:1) to `#6F6B62` (4.6:1); the dimming cue stays in the ring and the fill. The drive's contrast sweep deliberately skips disabled controls, so this gets its own measurement — taken at the RESTING background, because `.face` fades its amber over 200 ms and a button that has just stopped being lit is not "unlit". |
| r3-math-06 | Custom's tag names the table its × and ÷ knobs actually built (`numbers 2 to 25; × and ÷ use 2 to 5`), so the seven presses of `Largest` that change nothing, and the ceiling that then exceeds the parent's own number, are both readable. The 5 × 5 floor stays: there is no honest table under it. |
| r3-math-07 | `maths: {max, exact: false}` declares that answering an item leaves the integers, and `withinNumberBand` refuses such an item below Megatall. `10 m ÷ 4 m = 2.5 floors` was reaching Office Block and Skyscraper, whose own tables state `division always exact`. The Eiffel `103,000 ÷ 40,000 ≈ 2.5` item is declared too. |
| r3-math-08 | The recovered number on a missing-number Repair card is drawn in the clause's own teal, so the child can see which of the three numbers was the one asked for. |
| r3-math-09 | `sameSeen` is a five-question fuse, not a latch held for the building, so the first incidental `3 + 3` at Corner Shop no longer removes every double and every `a − a` from the rest of it. |
| r3-elevator-feel-03 | **in part.** The ▼ hall call, drawn on all ten landings and written to by nothing in the whole game, lights on the victory descent — at the ROOF, which is where the rider who wants to go down is standing. The ▲ call is still driven by the car call; giving the waiting passenger a real hall call is a bigger change to the arrive() sequence than this round is taking. |
| r3-elevator-feel-04 | The fall's indicator counts the floors it passes. The timeline carries one sill event, at the pit, so the number is derived from the car's own drawn position instead — it cannot drift from the drawing that way. |
| r3-elevator-feel-06 | The 18-bacon telescopic doors are a wide slow leaf and a narrow fast one meeting off centre, so the part is recognisable standing still rather than only during the 500 ms slide. Two leaf pairs are drawn and one is shown: scaling a single pair would scale its stroke and its handle mark with it. |
| r3-elevator-feel-07 | The Rules card names the ding only when sound is on, and otherwise says `Turn on ♪ for the ding.` Sound stays off by default. |
| r3-mobile-ux-3 | The menu screens get a landscape layout: under 500 px of height the lobby hero yields its ART (the part with no words on it) and keeps the title and the total, so `Ride` is a whole button instead of a 26 px unlabelled blue sliver. |
| r3-mobile-ux-4 | In short landscape the top bar's five items share ~250 px, so the chip drops its level name there — the same answer the 340 px rule already gives, and the level is named on the lobby chip, the picker and Grown-ups. |
| r3-mobile-ux-5 | Fixed by the roof's sticky button stack (r3-mobile-ux-1): `Lobby` was 0 px on screen at se1 portrait too. |
| r3-mobile-ux-6 | `assets/favicon-32.png` was precached and re-fetched on every `?reset=1` for a file nothing referenced. `index.html` references it now (some Android launchers prefer a PNG to an .ico). |
| r3-mobile-ux-7 / r3-code-hostile-07 | The worst-case trivia check runs a second time with Bigger text on, and the panel is the band that yields in trivia mode (`min-content` rows, `overflow-y: auto`) so the third answer is reachable instead of placed 54 px past a fold it could not scroll to. Every real item in the bank still fits without scrolling. |
| r3-code-hostile-03 | A timeline that carries no door step BEFORE the car moves inherits the reducer's door state instead of whatever frame the cancelled animation left behind, so GO inside the door close no longer rides a floor with the leaves 44 % open and `data-state="closing"`. |
| r3-code-hostile-04 | `tagFloors` and the shaft's waiter are gated on `state.pool.length`, the same condition `arrive()` already used, so a bank that failed to load no longer draws people waiting on floors the lift rides straight past. |
| r3-code-hostile-05 | The bell key's two lines are set solid, which buys the 5 px it overflowed by with Bigger text at 320 wide. The TYPE is not reduced: that is the setting undoing itself, and the drive checks that every panel key grows with it. |
| r3-code-hostile-06 | A retry may not follow a retry in `pickFact` — the belt `makeProblem`'s comeback queue already wears. A child who missed every fact saw four, for ever, at Corner Shop and at Megatall alike; now the bank keeps opening and the deferred retry simply fires one passenger later. |
| r3-trivia-truth-02 | Six items had an answer 10–39 characters longer than the longest distractor beside it. Distractors lengthened (or, on the worst one, the answer trimmed to the clause that answers the question); a lint holds the whole bank to ≤ 8. `answer is longest` fell from 42.6 % to 39.0 % against a 33.3 % baseline — the extremes are gone, the residual mix effect is not. |
| r3-trivia-truth-03 | The `rule` string names its own two exceptions, as amendment 12 already narrowed round 1's claim. |
| r3-trivia-truth-04 | Mponeng's answer reads `About 4 km`, which matches its Guinness citation and its own fact text, and puts it in the same form as its three distractors. |
| r3-trivia-truth-05 | Bailong's `171.4 m above ground` is replaced by the split its source actually gives (505 ft in the wall, 565 ft of exposed derrick → 154 m and 172 m) with that quote shipped; `quartzite` corrected to `quartz sandstone`. The lift/elevator etymology gets both etymonline entries, fetched, with verbatim quotes. |
| r3-trivia-truth-06 | `Source: piday.org (piday.org)` — a lint now refuses any source title that is just its own domain. |
| r3-deploy-pages-02 | Grown-ups prints `Version 1.0.0 · ef630a206a78`, read from the name of the cache serving this tab. It cannot be stamped into `src/version.js`: that file is one of the files BUILD hashes. |
| r3-deploy-pages-03 | DESIGN.md's Architecture and PWA sections describe the worker that ships. The confirm-or-revert note on amendment 10 is resolved: confirmed, after two hostile reviews and 15/15 on `drive:update`. |

### Skipped, and why

- **r3-deploy-pages-04 — the update chip covers most of the shaft on a 320 px phone.** Filed as
  opinion, and the constraint is real: the chip may not cover a tap target (the drive asserts it, and
  round 2 moved it off the panel for exactly that reason), so the shaft is the only safe ground; the
  chip must clear 48 px to be tappable at all; and se1's shaft is 82 px. Anything that meets both
  rules covers most of it. The chip is dismissible, is held until the car is at rest, and does not
  cover the panel. **The lead should decide** whether the chip is worth a dedicated band above the
  top bar, which is the only place left.
- **r3-math-04, the structural half.** All three suggested fixes were declined and one reworded.
  "Make the ▲▼ sums describe THIS ride" makes the elevator the maths, which is a different game;
  "move them to a building where the car travels more than one floor" contradicts amendment 12 (a
  level is a maths band, not a height); and "drop ▼ and keep ▲" is refuted by two of the three
  verifiers — ▲ agrees only in sign (`6 ▲ 4 = 10` while the car goes G → 1), keeps the identical
  glyph clash with the lantern and the indicator, and adds the mirror contradiction on a fall. The
  copy is fixed; the notation stands.
- **r3-elevator-feel-02, the "buildings differ as elevators" half.** Amendment 12 already ruled on
  it ("a level is a maths band, not a height"), `src/levels.js` records the decision at the top of
  the file, and BRIEF requirement 7 opens with *Predictable, consistent*. The measurable half — the
  roof card going silent about goals that exist — is fixed. **The lead should decide** whether the
  v2 elevator ladder (an express zone, a taller shaft, a second car) is worth reopening it.
- **r3-math-02's four-rung version.** The offer path can only overshoot by ONE rung — climbing needs
  two clean step-3 buildings, which a child above their ceiling cannot produce — so the report's
  100 %-fall rows at Office/Skyscraper/Megatall are reachable only through the picker, which is
  bidirectional and undone by the same three taps. The mirror offer is built for the rung the ladder
  can actually deliver.

### Handed on

- **`answer is longest` is still 39.0 % against a 33.3 % baseline.** The ≤ 8-character lint kills the
  extremes; the residual is a mix effect across 67 items and closing it means re-authoring most of
  the bank's distractors. Worth doing when the bank next grows, not as a patch.
- **The ▲ hall call is still driven by the car call inside the car.** Honest semantics need the
  waiting passenger to register a real call in `arrive()` before the car answers it, which touches
  the phase sequence rather than the renderer.
- **`.page`'s scroll cue is a cue, not a foot.** Grown-ups is 2 400 px tall and the roof is the only
  `.page` whose primary control is at the bottom; if another one appears, give it the same sticky
  stack rather than trusting the gradient.
- **Two items are still checked twice against the same document**, unchanged from round 2 — but the
  `rule` string now says so.
- **`settings.secondTry` is still `true` at every level** — round 1's open question, unchanged.

## Content round — the elevator stops rewarding an elevator-loving child (2026-09-08)

Not a hostile-review round: a single defect, measured by two independent reviewers in round 3 and
ruled on by the lead. Both reviewers reached the same wall from different directions.

> All three Workshop parts are owned by building 7, the last level offer lands at building 8, and
> from building 9 the roof card carries no new line at all. Every building yields exactly 16 bacon,
> and Megatall is the same G-1-9-R shaft with the same one-floor hop as Corner Shop. Roughly 20-25
> minutes before the elevator stops rewarding an elevator-loving child.

> A child stops at the roof of the second Corner Shop, around question 20, if nobody shows them the
> level chip: nine identical 2.7-second rides whose only variable is the sum.

Round 3 fixed the measurable half of this (r3-elevator-feel-02: the roof card falling through from
PARTS to the plaque ladder) and skipped the other half with a note — *"make the buildings differ AS
ELEVATORS is a v2 feature against amendment 12's own decision; the lead should decide."* This is
that decision, and what shipped under it. The full ruling is DESIGN amendment 14.

**Instruments before → after:** `npm test` 192 → **213 passing**; `npm run drive` 85 → **100 passing**
(20 scenarios × 5 phones, plus the second `layout` pass at the device heights);
`npm run drive:update` **15/15**. Three new drive scenarios (`workshop`, `logbook`,
`parts-inert-drive`) reach the new content through real taps, and `layout` now measures the fully
unlocked Workshop — the longest page in the game — the part card and the Logbook on all five
profiles and at the device heights.

### The ruling, in four lines

1. **Predictability is about the RULES, not about sameness.** The loop, the timings, the failure
   behaviour, the copy and the controls are identical everywhere. Nothing is random, timed or
   surprising, and nothing is ever taken away.
2. **Amendment 12 stands.** A level is a maths band, not a height. The maths is never coupled to the
   building's shape.
3. **Variety is therefore additive and inert:** what the lift LOOKS like, what the child can earn
   and choose, what the Fact Book and the Workshop hold, and what the roof says. The elevator
   special interest is content — real mechanisms, real parts, real vocabulary, all true and sourced.
4. **THE GAME OWNS THE SHAFT; THE CHILD OWNS THE CAR.** Now canon. Nothing equipped is ever
   replaced, swapped, auto-equipped or re-locked by anything the game decides.

### What shipped

| what | why it is the fix |
|---|---|
| **24 parts across seven slots** (`src/parts.js`), 17 of them earned at 12, 28, 44, 60, 76, 92, 108, 124, 140, 156, 172, 188, 204, 236, 284, 332, 380 bacon | The measured problem was three parts, all owned by building 7. That is now a part at the roof of every building from 1 to 12, then 13, 15, 18, 21 and 24 — and the thresholds sit on the 16-bacon grid at offset −4 so each one lands at a ROOF, in front of the card that names it. The three shipped ids keep their spelling and their thresholds only ever move DOWN, so no save loses anything. |
| **Every part is a drawing** — five door sets, five indicators, five car finishes, two door-edge devices, two guide types, two car-button panels, all inline SVG in `render/shaft.js` | r3-elevator-feel-06's lesson generalised: a part the child spends a whole building earning must change what the lift looks like STANDING STILL, not only during the 500 ms slide. The doors are a list of `{node, travel}` per set, so a two-speed door really runs one leaf at twice the other's speed, a collapsible gate really concertinas into its pocket, and a scenic car really shows the shaft through its walls. Guide rails are drawn down the hoistway, because the guides had nothing to grip. |
| **One new sound: the brass arrival gong** | A chime part replaces the ding's VOICE at triggers that already exist — same peak, same length budget, no new cue and no new moment. Sound is off by default, and a child who turns it on must not discover that a setting changed the world. `ding2` now plays the fitted chime twice instead of the plain 880 Hz, so the ADA count (one up, two down) holds in every set rather than only in the default one. |
| **A part card behind every ⓘ** (`data/parts.json`) | The Workshop becomes the second Fact Book: one true sentence about what the thing is on a real lift, with the sources it was checked against, for all 24. Every quote was fetched from the url beside it. |
| **`src/gate.js`** — the citation gate extracted and imported by `trivia.js`, `parts.js` and `climb.js` | Three banks now put sourced sentences in front of the child. r3-trivia-truth-01 was the fact bank's gate reading past the one line that carried a memorial; a second copy of that gate is a second thing to forget. None of the three re-states the comparison. `grave` stays out of the citation list (Elisha Graves Otis). |
| **The Climb** (`src/climb.js`, `data/climb.json`) — ten real buildings by floor count, then Burj Khalifas without end | The parts ladder ends and so does the plaque ladder. This is the only line that provably cannot: `climbGoal` may never return null and `remaining` may never be ≤ 0, asserted at every floor count from 0 to 20 000. Floors count only under POWER — the one-floor rides, the express out of the pit, the victory descent. A free fall is not a ride and is neither counted nor punished. |
| **The Logbook** — a numbered ticket per building, nine monotone records, and The Climb | A collector sorts, counts, re-reads and shows. **Falls, accuracy and percentages appear on no screen the child can reach**; they are on Grown-ups Progress only. A number a child can see must never be able to go down. The tickets are DERIVED from `buildings`, because an array of one entry per building would grow the hand-copied `BE1-` code without bound — which is the bug round 2 already fixed once, in `facts.seen`. |
| **The Fact Book's completion board** — `23 of 67 facts collected`, a ghost tile per unheard fact, and persisted All/Elevator/Numbers and Newest/In-order chips | For a child who counts things, an empty slot beside a full one is the strongest engine in the game. Neither control changes a fact, a count or a distance. |
| **`PLAQUES` gains 3000 and 5000**, and both forward lines print on the lobby, the roof and the Workshop | The lead's rule: the child must always see what the next thing is and how far away it is. Two ladders, and `test/content-round.test.js` asserts at least one of them names a next thing with a distance at every lunchbox 0-6000 and every floor count 0-20000. |

### The two instruments this round exists to leave behind

**`test/parts-inert.test.js` — a part may not be felt by the reducer.** For each of the 24 parts it
runs the same 300-action script at seed 42 (every fifth question answered wrong, so the fall, the
Repair card and the express recovery are all inside it) and compares a behavioural TRACE — phase,
screen, problem key, tray, lunchbox and every effect, in order — byte for byte against the shipped
defaults, then deep-equals the final state minus `equipped`, `unlocks` and `records`. A final-state
comparison alone cannot see an effect that fired in a different order, and effect order is what the
renderer and the audio play off. It then asserts statically that `equipped` is read in `state.js` in
exactly one branch (`case 'equip'`), that `records` is only ever written through `tally()`, and that
`math.js`, `levels.js`, `explain.js`, `elevator.js` and `trivia.js` do not know either field exists
— because a behavioural test at one seed cannot prove the absence of a read, and the source can.
`parts-inert-drive` asks the same question in a real browser: seven identical sums and the same wall
clock (measured 20 264 ms against 20 195 ms, 69 ms apart) on the defaults and fully fitted.

**The gap instrument — `test/content-round.test.js`.** Pinning that thresholds are unique and
increasing does not stop a future edit re-clustering them into building 7, which is the exact defect
this round fixes and which nothing in the tree would have caught. It walks 120 buildings, records the
building index of every unlock, plaque and Climb rung, and fails if the ladder goes quiet for longer
than 16 buildings — what it delivers today (buildings 31 to 47, between Burj × 2 and Burj × 3, and
even there the roof card counts down to both). Tighten that number when the ladder gets denser; never
loosen it without a lead's ruling.

### Cut from the winning proposal, and why

- **The machine and pit slots** (gearless, machine-room-less, oil buffers, the overspeed governor and
  its safety wedges). Both judges named them as the first cut and they were right: they are new
  geometry in `render/shaft.js`, the one file three hostile rounds have spent keeping byte-identical
  through the fall. They land alone, in their own pass, behind the fall's own identity assertion.
- **The twelve-building ROUTE.** It terminates at twelve and then repeats; it rotates the world under
  the child on the screen that carries the maths; `createShaft` builds the world once and the crop
  guard is a closure-scoped array with no removal path. Amendment 12 already ruled on it. The
  CONTENT survives as part cards; the container does not ship.
- **Renaming the levels to maths bands.** It takes away names the child has had for a week, which is
  the one thing the ruling forbids outright, and every level already carries its band as its tag.
- **`pin a building`** — a second navigation concept, earning nothing.
- **`history.missed`**, the child's last ten wrong presses, persisted: the only proposed state whose
  content is their failures.

### Handed on

- **The machine and pit slots are the next pass**, and they should ship with a fall comparison of
  their own: the phases, the durations and the copy of `fall` unchanged, drawn frame by frame, before
  and after. Everything else in the parts ladder is inert by construction; those two are not.
- **The 16-building quiet stretch is real.** Between Burj Khalifa × 2 (building 31) and × 3 (47) the
  child crosses no threshold at all — the roof card still counts down to both ladders every time, but
  nothing arrives. Two more real buildings between 154 and 308 floors would close it; there is no
  shortage of them.
- **The braille car panel is drawn at 12 world units wide**, which is a legible strip and a barely
  legible braille cell on a 320 px phone. The part card shows it at readable size and that is where
  the rule is taught; if the car ever gets a bigger interior, redraw it there too.
- **`settings.secondTry` is still `true` at every level** — round 1's open question, unchanged.
