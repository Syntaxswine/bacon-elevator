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

## Round 4 — hostile review (2026-09-08)

Thirty-one findings: **2 high, 8 medium, 21 low**. Ten of them — both highs and all eight mediums —
carried three independent verifier reports each; the twenty-one lows were filed unverified. The
severity census is the score, and it moved the wrong way from round 3 (0 high, 14 medium, 30 low):
this round reopened the top of the scale, and both highs are earlier fixes that became defects.
**Twenty-nine fixed, two skipped**, with reasons below.

**Instruments before → after:** `npm test` 213 → **242 passing** (a new `test/round4.test.js`, 29
cases, one per finding whose surface is not layout); `node tools/phone-drive.mjs` 100 → **105
passing** (a new `roof-offer` scenario, once per phone). Every fix is pinned by one of those,
or by an assertion added to the layout instrument, that fails without it.

### The two highs are the same lesson twice

Both `r4-code-hostile-01` and `r4-math-01` are earlier fixes that solved their finding and created a
worse one, and in both cases **the instrument that pinned the fix could not see the trade**.

- `.roof .page > .stack { position: sticky; bottom: 0 }` (round 3, for r3-mobile-ux-1/-5) put the
  roof's two controls back on screen by pinning an opaque `--paper` block INSIDE the card's own
  scroller. The gate that came with it, `onScreen: ROOF_CONTROLS`, asserts that those two buttons have
  at least 44 px visible at rest — which is precisely what the sticky guarantees BY covering
  everything else. The gate and the guarantee were the same statement, so it could never go red.
  Verified: the part unlock 100 % hidden at 320 × 454, the lunchbox total sliced through its digits,
  one or both forward-goal lines painted over at every shipped profile including the reference
  390 × 664, and the level offer drawn UNDERNEATH the buttons — a real `page.mouse.click` at the
  centre of `Yes` dispatching `to-lobby` on one profile and `next-building` on another.
- The comeback queue's `+5 and +15` rule (DESIGN §4) is consulted in `math.js` before `stepOf()`, so
  a due entry ignored the step's kind list and its ceiling. The measurement that certified the queue
  after r2-math-01 — 0 back-to-back, no more than 55 % comebacks, at least 20 distinct sums in the
  last 200 — cannot see this shape at all: the FRESH half of the draws supplies all the variety while
  the comeback half collapses to three keys. One of the three verifiers named that gap in their own
  report, and they were right; the discriminating metric is distinct COMEBACK keys, and
  `test/round4.test.js` now counts exactly that.

### Fixed

| id | what changed, and why |
| --- | --- |
| r4-code-hostile-01 (high) | The roof card is the two-band shape `.sheet .body` / `.sheet .foot` has always used: a scrolling `.page` and a sibling `.foot` holding the level offer and the two controls. Nothing is pinned inside a scroller over content the child has not read. The offer moves into that foot, where it cannot be covered. Pinned by the new `roof-offer` drive scenario (`elementFromPoint` at the centre of `Yes` must return `Yes`, at four geometries, plus a real tap that must leave `state.level === 'hotel'`) and by a `.roof .page` occlusion sweep in `checkLayout` that samples three heights down every line of the card. |
| r4-math-01 (high) | `inStepBand()`: a due comeback the current step cannot legally ask — wrong kind, or a number past that step's `max` — waits instead of firing. `MISS_RETIRE`: a key stops re-arming after three misses in a row while queued (it can return once the queue ages it out at 40 questions, which is a fresh question again). `set-level` now clears the queue even when the id is unchanged, so picking a building is always a fresh start in it. At `LEVEL_ORDER` index 0 the roof card says where the smaller numbers live (Grown-ups, Custom numbers) rather than staying silent, and Grown-ups prints `history.byKind` — recorded since round 1 and displayed nowhere, so a parent had the alarm and not the diagnosis. Reducer replay over 12 buildings: 0 of 144 comebacks out of band, and the queue keeps turning over. |
| r4-autism-fit-1, r4-elevator-feel-01, r4-mobile-ux-1 (medium x3) | The same occluder as r4-code-hostile-01, reported against three different lines of the card. Same fix; the picnic drawing is also capped at `34vh` so the tray line, the total and the unlock sit above the fold on a 454 px screen, and on a short screen the foot's buttons drop to the 48 px floor and sit side by side so every control stays whole. |
| r4-math-02 (medium) | One persisted field, `demotedFrom`, set when a rescue offer is accepted and cleared when the promotion back is taken or a grown-up picks a level. A level the child was just demoted from needs `UP_AGAIN` (4) clean buildings, not 2. Two clean Skyscraper buildings are evidence about Skyscraper — its step 3 serves no 3-digit sum at all — and the ladder used to discard twenty questions of direct counter-evidence about Megatall two buildings after collecting it. |
| r4-math-03 (medium) | `OP_GLOSS` gains `missAdd` and `missMul`, built from the problem on screen, and the Rules card gains a third worked example with the blank in the middle. On a fresh save the blank-in-the-middle form arrives at question 7, BEFORE the first triangle — the first unfamiliar shape the child meets was the one the game explained last. |
| r4-math-04 (medium) | Megatall step 1 is a bridge: 3-digit plus-or-minus a one- or two-digit number with at most one column regroup, plus the 2-digit rows the child proved at Skyscraper step 3. The old step 1 (two regroups) is step 2. It is the step `Try Megatall?` lands on AND the step a fall cannot leave, and it served **0 %** of its sums entirely under 100 — every other step in the game is 56 to 100 %. Now 16 %. Both promotion guards in `test/levels.test.js` and `test/round3.test.js` are one-sided (they forbid a promotion NARROWING, never hardening); the new test measures the under-100 share directly. |
| r4-elevator-feel-02, r4-autism-fit-6 (medium, low) | The Rules card reads `settings.secondTry`. It ships ON, so the first wrong answer clears the entry and nothing falls — a rule stated only on a Grown-ups toggle while the card the child is shown, unskippably, on the first Ride said "Wrong: a fall". Every other promise on that card is exact, which is what made this one conspicuous. |
| r4-mobile-ux-2, r4-autism-fit-2, r4-elevator-feel-03, r4-code-hostile-06 (medium, low x3) | Below 257 px of landscape height the keypad is FOUR columns — the 3 x 3 digit block untouched and in the same order, HINT / plus-minus / backspace in a right-hand column, 0 and GO on the last row — instead of five rows that need 258 px in a 232 px viewport. The keypad loses a row before it loses a key. `checkLayout`'s `go` rule now also asserts GO is whole on screen at rest; its old rule answered "is it reachable?", which is the right question for a settings page and the wrong one for the key that submits an answer. |
| r4-math-05 (low) | The roof card carries `dir`. A promotion reads `Ready for Hotel — numbers to 20?`; a rescue reads `Back to Skyscraper — times tables?`. Both used to be the same eight words with no direction and no band, so after two ruinous buildings the way out was typographically identical to a reward. |
| r4-math-06 (low) | A `zeroSeen` fuse, the same shape as the existing `sameSeen` one: serving an additive identity holds that shape off for four questions. Corner Shop step 1 goes 32.0 % to 16.4 %, step 2 19.7 % to 11.8 %. 0 stays a teaching point (levels.js says so); a third of every question is not teaching it. No extra rng draw, so this is deterministic and reads the same way the doubles fuse does. |
| r4-math-07 (low) | Past the digit cap the keypad returned `same(state)` — no click, no line, on a lit and undimmed key, while a tap on the wrong FLOOR button, the other dead key on the same panel, answers in words for 1.4 s. The band now says `Four numbers is enough.` and clears on the next real keypress. |
| r4-math-08 (low) | `TRIVIA_LIMITS` gains `denyConcepts`, and every one of the 27 maths items declares a `concept` (a rule, not a hand-picked id list). Corner Shop and Hotel no longer draw number theory or very large numbers: `Which of these numbers is NOT a prime number?` is difficulty 1 and 45 characters, so both existing gates passed it to a child on `numbers to 10`, in the negative form. The band is 18 items (was 20); it opens up again at Office Block. `withinBand()` is now one exported predicate — two tests were re-spelling three quarters of it and would have gone on measuring the old band. |
| r4-math-09 (low) | The honeycomb question named its subject by itself (`shape of room ... into ... rooms`) and offered a regular octagon, which does not tile the plane at all and so is not a wrong ANSWER but a shape the question cannot be asked about. Reworded; the octagon is a rectangle. The fact and both citations are untouched. |
| r4-math-10 (low) | `ADD_FLOOR = 6`: Custom's Largest stepper gets the floor that multiplication and division have had since r3-math-06. `Smallest 0, Largest 2` is reachable from Grown-ups and built a pool of three sums, the same one returning two questions later on 55 % of questions. The tag is still derived from the tables that were BUILT, so it reads `numbers 0 to 6`. |
| r4-autism-fit-3 (low) | Disabled GO was white on pale blue at **1.74:1** — formally exempt, and semantically the same argument the unlit floor face already lost at 2.57:1, on the key the whole game turns on. The word is now ink-blue at 4.84:1 and turns white the moment a digit is typed; the "not yet" cue stays in the fill and the shadow. The drive's contrast sweep skips disabled controls by design, so this gets its own assertion. |
| r4-autism-fit-4 (low) | The lobby's sound control read `Sound off` — the CURRENT state on a control shaped like a command, so a child reading it and tapping got sound ON. Now `Sound` plus an Off/On pill, the label-and-switch idiom Grown-ups has always used, with `role="switch"`. |
| r4-autism-fit-5 (low) | An unreadable save and no save were the same thing to `migrate()`. The raw text is moved aside under `bacon-elevator.save.v1.unreadable` and both the lobby and Grown-ups say so, the way the refused-write path has since round 2. Contrived to trigger, and the cost when it happens is the whole lunchbox. |
| r4-code-hostile-02 (low) | `gained` is the UNbanked remainder and the card called it `Tray`, so after a mid-building Lobby tap the reward card and the top bar printed two different numbers for the same tray. The card now says `8 more bacon` when something was banked mid-building, and the lobby's waiting line counts the same bacon once. |
| r4-code-hostile-03 (low) | The drawn fact id and the shuffled choice order are persisted in the ride, and a resumed `trivia` phase re-hydrates them instead of drawing a fresh fact with the advanced rng. Parking at a passenger and coming back swapped the question; a reload swapped it again — a reroll of a question worth 2 bacon, and a world that changes under a child who was told it would not. |
| r4-code-hostile-04 (low) | `plaques` is filtered against `PLAQUES` the way `unlocks` on the very next line is filtered against `PART_IDS`. Output was already escaped, so this is hygiene, not injection. |
| r4-code-hostile-05 (low) | The reset confirmation was written to the Grown-ups screen that the same dispatch navigates away from. It is carried to the lobby's notice band, which already had the shape for it. |
| r4-mobile-ux-3 (low) | `assets/apple-touch-icon.png` is rendered square and fully opaque (colour type 2, no alpha) with no baked-in corner radius: iOS ignores alpha, composites onto black and applies its own squircle, so a pre-rounded icon with transparent corners gets thin black wedges on the Home Screen — the one icon a parent following Add to Home Screen actually sees. `tools/make-icons.mjs` gates it the way it already gates the Android maskable pair. |
| r4-mobile-ux-4 (low) | `env(safe-area-inset-bottom)` removed from `.sheet .foot` and `.rules .foot`. `#app` reserves it for every descendant, so it was being spent twice — 34 px off the scrolling body of the two cards that already clip their last line, on exactly the phones with the least room. |
| r4-mobile-ux-5 (low) | `sw.js` precaches per file through `Promise.allSettled` and names what failed, instead of one `addAll()` that rejects as a unit: a single cancelled request left the install with NO cache at all and that visit with no offline copy. The drive treats a service-worker-initiated `requestfailed` as a warning with the path in it, so a real layout regression can never hide behind the flake. |
| r4-mobile-ux-6 (low) | `404.html` gets the same `100vh` then `100dvh` pair the app uses. |
| r4-deploy-pages-01 (low) | Documentation, because nothing outside the worker's scope can be cached: DESIGN now says to give the parent the URL WITH its trailing slash, and why the no-slash form is the browser's own offline error page. |
| r4-deploy-pages-02 (low) | `.github/workflows/ci.yml`: `npm test` and `node tools/build-stamp.mjs --check` on every push to `main` and every PR. The stamp is the one gate that makes a content-only deploy reach a child who already has the game, and nothing but a human remembering to type `npm test` enforced it while Pages publishes whatever lands. Zero dependencies and zero build step, so there is nothing to install. |
| r4-deploy-pages-03 (low) | When a worker is waiting, the Grown-ups version line IS the button (`Load the new version`), and it says the lunchbox is kept. Before this the only route to a new build was a chip a child can dismiss every session, or `?reset=1`, which costs the lunchbox. |
| r4-trivia-truth-01 (low) | `data/trivia.json`'s `rule` string claimed both checkers fetched an independent source; for **32 of 67 items** the refuting lens re-read a document the item itself cites, and a refute lens pointed at an item's own primary citation re-confirms it. The rule string and `docs/TRIVIA.md` now say what the record shows, and `test/round4.test.js` re-derives the 32 from the file so the sentence cannot drift from it. No false fact resulted; the claim a future maintainer will trust must match the process that was run. |
| r4-trivia-truth-02 (low) | Two stems printed another shipped item's exact answer: the Eiffel lifts' `103,000 km` (given in words instead, so the division the question asks for still works) and Otis's `by having the rope cut`, which is the whole answer to `elevator-culture-otis-1854-rope`. A generalised check over every ordered pair of items is in the test. |
| r4-trivia-truth-03 (low) | `math-numbers-pi-day` cited Wikipedia FIRST with only piday.org behind it, against `docs/TRIVIA.md`'s own rule. A primary source leads — H. Res. 224, fetched from govinfo, whose quote carries the date the question asks for — Wikipedia is second and carries the Larry Shaw / 1988 / Exploratorium sentence, and piday.org is off the child's card entirely. The Exploratorium's own Pi Day history page answers 403 to an automated fetch, so it is cited as the refuting lens (a document the item does not itself cite) rather than as a shown source with a quote nobody re-read. All four content edits are recorded in `data/trivia-audit.json`'s new `round4` block with the text they replaced. |
| r4-trivia-truth-04 (low) | The layout instrument's worst-case trivia fixture is read from `data/trivia.json` at drive time. Its comment claimed to be the longest question and the three longest choices (196 / 84 / 71 / 57) and had drifted: the 84-character choice belonged to an item whose answer was shortened to 52. Safe today, and a fixture that says it tracks the data while no longer doing so is one the next person will trust. |

### Skipped, and why

- **`r4-elevator-feel-04`** — ten of the eleven floor buttons are permanently dead and the car can
  never be sent down. Filed by its own reporter as `opinion (design observation, but the measurement
  is real)`, and its own text says "this is an observation about the ceiling on elevator play, not a
  defect" and proposes a v2 mode. The measurement is correct and it is the design: `nextTarget()`
  clamps the target to `floor + 1` because **maths moves the elevator** (BRIEF item 3), and a
  free-ride mode is a new mechanic, not a fix. Handed on below.
- **The suggested REMEDY in `r4-mobile-ux-2` / `r4-autism-fit-2` / `r4-elevator-feel-03` /
  `r4-code-hostile-06`** — start the panel scrolled to its end. Not skipped as findings (all four are
  fixed): the suggested fix is rejected because it moves the slice from GO onto backspace, the key a
  child needs to repair a typo before a wrong answer drops the car. Four columns costs a row instead
  of a key.

### Two things the round found that no finding named

- **`.rules .body` had no slack left.** Adding one sentence to the Rules card (the second-try rule the
  child is entitled to) and one clause to a picture caption pushed it 66 px past the fold at
  320 x 454, which the existing `noScroll` assertion caught immediately. The card is genuinely fuller
  now — three question shapes and both wrong-answer rules — so the smallest tier buys the words back
  out of the DRAWINGS, which repeat what the words say. It sits at exactly its budget again; the next
  sentence added to that card needs a line removed with it.
- **The roof's foot is a hard claim on the viewport.** Taking the controls out of the scroller is
  right, but a foot is not free the way a sticky block was: two tall buttons plus an offer row are
  240 px, more than a 232 px landscape window has at all. Below 460 px of height the buttons drop to
  the 48 px floor and sit side by side. Any future addition to that foot has to pay the same way.

### Handed on

- **A discriminating metric for the comeback queue.** `test/math.test.js`'s r2-math-01 sweep measures
  distinct keys over ALL draws, and the fresh half hides a comeback half that has collapsed. Round 4
  added the missing measurement in `test/round4.test.js`; the older test should adopt it too.
- **Both promotion guards are one-sided.** `test/levels.test.js` and `test/round3.test.js` forbid a
  promotion NARROWING the question set and say nothing about one that hardens it, which is why a
  12.5x jump in operand size sat there for four rounds. A two-sided guard — a ceiling on the jump as
  well as a floor on the pool — would close the class rather than this instance.
- **`settings.secondTry` is still `true` at every level** — round 1's open question, unchanged, and
  now at least stated truthfully on the card the child reads.
- **`shots/` is now a photograph of a layout that has changed.** The 500 committed screenshots were
  taken before this round; the roof card, the short-landscape keypad and the Rules card all look
  different now. They were deliberately NOT regenerated here — a partial refresh would leave the
  directory a mix of two vintages, and a full `node tools/phone-drive.mjs --shots` run rewrites
  nearly all of them, which is a commit of its own. Do that one next, on its own, and read them.
- **The free-ride, or express-to-a-floor-you-have-already-reached, mode** from `r4-elevator-feel-04`
  is the best unbuilt idea in this packet: it would give the car panel back its point without
  weakening "maths moves the elevator". It needs a lead's ruling on the bacon price, not a fixer's.

## Round 5 — hostile review (2026-09-08)

Thirty-four findings: **1 high, 10 medium, 23 low**. The eleven at high and medium carried three
independent verifier reports each; the twenty-three lows were filed unverified. The severity census
is the score: round 3 was 0 high / 14 medium / 30 low, round 4 was 2 high / 8 medium / 21 low, this
round is 1 high / 10 medium / 23 low. The top of the scale is closing again and the tail is not.
**Thirty fixed, four skipped**, with reasons below.

The high and four of the mediums are the same shape as round 4's two highs, one more time: **an
earlier fix that solved its finding, in a place the instrument that pinned it does not look.**

**Instruments before → after:** `npm test` 242 → **261 passing** (a new `test/round5.test.js`, 19
cases, one per finding whose surface is not geometry, plus the rewritten save-code gate);
`node tools/phone-drive.mjs` **105 → 105 passing**, with the chip scenario extended to five
landscape turns, the top bar and the roof card's hierarchy measured for the first time, and the
hint's tick-label floor raised from 9 to 14 CSS px; `npm run drive:update` 15 → **20 passing**,
with a third session that lands a second deploy so TWO `be-` caches are live at once and the build
line is read against the one actually serving the tab. Every fix is pinned by one of those, or by an
assertion added to the layout instrument, that fails without it — update-drive's assert 8c was run
against the old `caches.keys().sort().pop()` policy and reported `ffffffffffff`, the pending build.

One thing the round changed about the instruments themselves: `tools/drive-scenarios.mjs` kept its
own copy of the two step-change sentences, so telling the truth in the display band turned it red on
five phones. The list is exported from `src/math.js` as `STEP_NOTE_WORDS` and the drive reads it —
an instrument that re-spells what it measures cannot catch that thing drifting, and here it went one
better and refused the fix.

### The high, and the four mediums that share its shape

`r5-mobile-ux-1` is a CSS comment that states its own invariant — "over the (untappable) shaft,
never over the panel" — and a rule three lines below it that only satisfies the invariant in
portrait. `left: 50%` is the middle of the VIEWPORT, and round 3's landscape grid moved the panel
into a right-hand column, so the middle of the viewport became the middle of the keypad. Measured on
the reviewed tree: key 7 100 % covered at 568 × 276 with its own centre returning the chip's take
button, so a child pressing a digit posted `skip-waiting` and the tab reloaded mid-sum; keys 4 and 5
at 568 × 232; HINT at 667 × 331; and the answer blank 100 % covered at **all five** landscape turns,
so the digits already typed were invisible sideways at every size. The chip scenario restored the
portrait viewport before it ever looked (`drive-scenarios.mjs` line 1228, then the chip block at
1288), so `--only layout` reported `chip(160x70 at 80,56)` and stayed green through two rounds.

The same shape, four more times:

- `r5-code-hostile-01` — `pool` is carried across `import`, `reset` and `adoptDiskSave` BY NAME, and
  the content round added two more banks beside it. All three sites forgot both.
  `test/state.test.js:289` pins `s.pool.length > 0` after a reset: the invariant exists and is
  tested, for the first bank only.
- `r5-code-hostile-03` — the save-code gate builds its state by hand with `facts.right: []` and
  `facts.retry: []`, two of the three PERSIST fields that dominate the blob and that real play
  fills. It measured 5 434 characters against its own `< 9000` while play reaches 11 900.
- `r5-code-hostile-02` — `stepNote` and the step bar were written for levels with three steps, and
  Custom has one; nothing joins the two facts.
- `r5-deploy-pages-1` — `test/round3.test.js:382` asserts main.js contains the literal
  `caches.keys()`. That is a grep policing a spelling, and it stays green under any selection
  policy, including the broken one it was pinning.

### Fixed

| id | what changed, and why |
| --- | --- |
| r5-mobile-ux-1 (high) | In landscape the chip is pinned into the LEFT column, below the display band — over the shaft, which `render/shaft.js` draws with no `[data-tap]` on it, exactly where the portrait rule already puts it. Non-ride screens keep the centred placement: they have no panel column and no blank to avoid. The chip scenario now runs its occlusion sweep at 568 × 232, 568 × 276, 640 × 304, 667 × 331 and 844 × 390, includes `#question .blank` in the sweep, and fails on ANY overlap with a panel key rather than only on a stolen centre — the reviewed tree covered key 8 by 67 % and HINT by 64 % at turns where their centres were still their own, and a key three quarters hidden is a key the child cannot find. |
| r5-math-02 (medium) | `math.stepNote(level, from, to)` reads the two step tables and names what differs: `Carrying now.`, `Times tables now.`, `Sharing now.`, `Missing numbers now.`, `Below zero now.`, `Bigger numbers now.` only where the ceiling really rises, `Smaller numbers for a bit.` only where it really falls, `Easier sums for a bit.` otherwise. The old sentence was derived from the sign of the step alone and is false more often than true at three of ten step-ups; the mirror lands on the floor screen straight after a fall, the one moment the copy exists to reassure. The test asserts each sentence against the tables it is spoken over, at all twenty transitions. |
| r5-math-01 (medium) | `explainAdd` takes the three-column split only where every column has something in it; otherwise the smaller operand is added in the places it actually HAS (`600 + 30 = 630 · 630 + 4 = 634`), or counted on where it has one. `explainSub`'s mirror branch, twenty-nine lines below, has filtered its empty columns since it was written. HINT shows `explain(p)[0].text` and nothing else, so on 41 % of Megatall step-1 draws the game's only help read `100 + 0 = 100` over `168 + 6`. The repair card's own instrument printed the defect on every run — `repair-megatall(card 204px: 800 + 0 = 800 · 70 + 0 = 70 · …)` — and passed, because it measures whether the card FITS. The test sweeps ~26 000 worked lines and refuses any clause that adds nothing. |
| r5-math-04 (medium) | `demotions`, one persisted integer beside `demotedFrom`. Round 4 gave the ladder a memory and then cleared it when the promotion back was accepted, which made it a fuse that resets itself: a child clean at Skyscraper and hopeless at Megatall bounced on a fixed six-building cycle for ever. Each rescue out of a level now buys another `UP_AGAIN` clean buildings before that level is offered again, capped at four, because an offer may never become a permanent gate (r4-math-02's own ruling, which `test/round4.test.js:158` still pins). Model-free ladder probe over 60 buildings: promotions into the band the child cannot do fall by more than half, and the level is still offered again. |
| r5-code-hostile-01 (medium) | `RUNTIME_BANKS` and `state.carryBanks(next, from)`, used by `import`, `reset` and `adoptDiskSave`. `partsPool` 24 → 0 and `climb` 10 → 0 on all three routes, for the rest of the session, with nothing said and a reload the only cure: all 24 Workshop cards read "The card for this part did not load. The part still works.", the Logbook's Climb section rendered its heading over nothing, and the lobby and roof lost the Climb goal line. One of the three routes needs no adult at all (a second tab), and it empties BOTH tabs. |
| r5-code-hostile-02 (medium) | `stepbar(step, id, steps)` returns nothing when the level has one band, `sb.hidden` does the same on the ride's chip with a truthful `step N of M` label, and `stepNote` returns `''`. Custom's three steps are the same table object — measured, 10.39 mean answer and 270 problem keys at all three — and the game announced `Bigger numbers now.` over it, then `Smaller numbers for a bit.` after a fall, on the level the roof card itself recommends for a struggling child. |
| r5-math-03 (medium) | The roof help line says what Custom can do (`give one kind of sum at a time, and choose the numbers`) instead of what it cannot (`make the numbers smaller still`). Swept all 127 operation subsets against every reachable stepper value: the lowest ceiling any Custom setting can build is `ADD_FLOOR` = 6, against Corner Shop step 1's 5, with a higher mean. Two earlier fixes collided — r4-math-01 added the sentence, r4-math-10 added the floor — and no test connected them. The test now re-derives the sweep, so if `ADD_FLOOR` ever drops the old sentence becomes true and this test says so. |
| r5-autism-fit-1, r5-elevator-feel-01 (medium x2) | While an offer stands, `Next building` drops `primary tall` and the offer's question and its two answers are drawn as one bordered block. `btn primary tall wide` occurs in exactly two places in the game — the Lobby's `Ride` and this button — so the single "this is the thing to tap" idiom was spent on the one control that does not answer the question printed 50 px above it, at 2.6x the pixel area of `Yes` and 24 px type against 18. `Stay` stays the primary and the default; that is DESIGN §4's ruling and the reason the offer exists. **Nothing is gated**, deliberately: `next-building` does not touch `step3Run`, so ignoring the offer defers it to the very next clean roof, while the suggested `accept: false` routing would zero it and cost two more buildings — the suggested fix was strictly worse than the defect. |
| r5-code-hostile-03 (medium) | The gate PLAYS the reducer — nine profiles of 60 buildings, then one of 140 — and asserts the observed peak (11 900) rather than a hand-built 5 434. It also asserts real play is over the old 9 000 bound, so the test fails if it is ever made stale, and that the code does not grow between 60 and 140 buildings, which is the invariant round 2 established and which does still hold. The copy that made 9 000 load-bearing is gone: the fallback said "Select the code and copy it by hand" for a string that has been thousands of characters at every size the game can produce. |
| r5-deploy-pages-1, r5-deploy-pages-2 (medium, low) | `sw.js` answers a `which-build` message with its own `CACHE` literal — which it cannot get wrong — and the page asks the controller, again on `controllerchange`. Two `be-` caches coexist from the moment a new worker installs until the chip is tapped, so the old `caches.keys().sort().pop()` was decided by hex ordering of the BUILD hash: the same pending update read one build on one load and the other on the next. On a first-ever visit it printed no stamp at all, because the read ran at module evaluation, before `install` had made a cache. This surface exists because an identical version string on two builds made a stale install undiagnosable; a confidently wrong stamp is worse than the missing one it replaced. |
| r5-autism-fit-2 (low) | The hint's tick labels scale with the card the way its operand labels already do, and the drive's floor moves from 9 to **14 CSS px**. 12.0 px at 320 × 454 passed the old floor and was still the smallest text in the game — under the 14 px status line, less than half the keypad's digits — on the one help a struggling child can ask for. Now 15.0 px. |
| r5-autism-fit-3, r5-elevator-feel-02 (low x2) | The ride's top bar keeps the building name at 320 px, and stops clipping `Shop` to `Sh…` at 360 px once the lunchbox reaches four digits. Both are one shortage: the tray and the lunchbox are `min-width: 48px` on SPANS — readouts, not touch targets — holding 96 px of the bar against a name that needed 30, and three 14 px step pips were another 48. The spans size to their content, the pips are 11 px in the top bar only, and every BUTTON keeps its 48 px floor. Three unlabelled pips were the whole on-screen record of which building and which band the child was in, and nothing anywhere says what a pip is. |
| r5-autism-fit-4 (low) | The trivia panel carries `.sheet .body`'s four-layer scroll cue. It scrolls at 320 × 454 with Bigger text on and said nothing, so a child who does not know it scrolls can read A and B and never learn C exists. |
| r5-autism-fit-5 (low) | A missed passenger is answered in words: `0 bacon this time. Nothing is lost. This passenger asks again later.` A right answer prints `+2 bacon`; a wrong one printed nothing where that line had been, so the feedback for a miss was an absence, and a child who counts bacon had to infer both that none arrived and that the passenger was gone. Same register as the Repair card's `Nobody is hurt. Nothing is lost.`, and the second half is true — `pickFact` re-serves a missed fact after 20 questions. |
| r5-math-05 (low) | The `count === 0` guard covers identities as well as zero answers. `zeroSeen` only arms once an identity HAS been served, so question one was unthrottled: 37.5 % of fresh saves opened on `0 + 5`, `5 + 0`, `2 − 0`. The steady-state rate is a healthy 16 %; the single most visible draw in the game was more than twice that. |
| r5-math-06 (low) | ⌫ is disabled on an empty entry, like GO. A lit, undimmed key that does nothing is a dead key — the rule `state.js` states for the digit keys past the cap, and ⌫ was the one key left that was live, looked live and answered nothing (20 142 such taps in an 11.4M-tap walk). |
| r5-math-07 (low) | Hotel reads `numbers to 20; tables 2, 5, 10 (to 100)`. `levelBound(hotel)` is 100 and step 3's × row reaches 10 × 10 on 11.8 % of its questions, and that tag is printed verbatim in the picker and in the offer card. The test holds every level's tag to its own bound, so the two cannot drift again. |
| r5-math-09 (low) | `Which of these numbers is NOT a prime number?` becomes `Which of these numbers has only one factor?` — the two MathWorld quotes already on the card carry it — and the fact gains one clause naming the factor count. Negative-form multiple choice is a comprehension trap for a literal reader, on a bank written for one. Also, `About 4 million digits` against the answer `About 41 million digits` is replaced by `About 500 thousand digits`: one character apart, and `makeChoices` shows two of three distractors, so the pair appeared together about two thirds of the time. |
| r5-elevator-feel-03 (low) | The lobby's title art drops its `▲`. The car is drawn parked with its doors open; a lit direction arrow belongs to a car answering a call, which is what the ride screen's own indicator draws. |
| r5-mobile-ux-2 (low) | Fixed by the same top-bar change as r5-autism-fit-3, plus a 4 px margin on the chip in the landscape block: the pips start 7.3 px from the `Lobby` label's ink, where they used to overlap it by 0.7. The instrument measures the gap with a `Range` over the label's own ink, not its button box. |
| r5-mobile-ux-3 (low) | `.ride .panel { max-width: 460px; margin-inline: auto }` above 600 px of viewport width. At 1024 × 698 each key was 333 × 56 — six times wider than tall — with the shaft squeezed to 244 px. Costs nothing on any phone the project ships a profile for, and nothing in the landscape grid, whose column is narrower than the cap. |
| r5-code-hostile-04 (low) | Both roof exits call `bankOnLeave()`, which is idempotent. Every roof the game reaches itself has `banked === tray`, so this is a no-op in play; a ride restored from a hand-edited BE1- code can be parked at the roof with bacon unbanked, and the lobby names the exact number (`…with 16 bacon on the tray`) one screen before both exits dropped it. |
| r5-code-hostile-06 (low) | `tools/phone-drive.mjs` writes its full report to `shots/drive-report.json` on any failure (and on `--report`). One run in three reported a failure that the next two did not reproduce, and the failing scenario could not even be NAMED, because the run was backgrounded and only the tail of its output survived. Not a retry: a scenario that failed is still reported as failed, and this is the evidence for it. |
| r5-code-hostile-07 (low) | The display band's `keypad` branch guards `r.problem`, like its two neighbours and like `modeOf()`. Unreachable today — `normaliseRide` rewrites phase `keypad` to `floor` whenever `problem` is null — so this is the asymmetry, not a live bug: it is the one place where a future save-shape change turns into a blank screen instead of a floor. |
| r5-code-hostile-08 (low) | Two ternaries whose branches were the same string, collapsed to the literal. They read as a resume-vs-start distinction that was flattened and never removed. The test forbids the shape rather than the two instances. |
| r5-trivia-truth-01 (low) | The KONE MonoSpace card drops `which KONE calls the world's first machine-room-less elevator`. Neither source the card PRINTS makes that claim — the kone.com story says only that MonoSpace launched in 1996 and that EcoDisc is flat enough to sit in the hoistway, and the second source is a competitor's glossary page that does not mention MonoSpace at all — and MRL priority in 1996 is genuinely contested (Schindler Mobile shipped the same year), so the attribution was the load-bearing part of the clause. Cut to what the cited page carries rather than propped up with a source nobody re-fetched: an unverifiable claim is cut, not softened. |
| r5-trivia-truth-03 (low) | `by around 300-400 BC` becomes `by around 400 BC`, which is the MacTutor quote the item itself stores. The answer (7th century, Brahmagupta) was never in question. |

### Skipped, and why

- **`r5-code-hostile-05`** — `Paste code` is the only route a save code has back in, and Firefox does
  not expose `navigator.clipboard.readText` to page script, so on that browser a lunchbox can be
  copied out and never put back. The finding is correct and its suggested fix — a one-line text
  field beside the button — is **ruled out by the spec twice over**: DESIGN §4 says entry is
  `<button data-key>` elements, "never an `<input>`", and DESIGN's Grown-ups section says "custom
  level knobs (steppers, no `<input>`)". `test/dom-contract.test.js` enforces it as
  "nothing summons the keyboard". BRIEF item 1 names iOS Safari and Android Chrome, and both support
  `readText`. What IS fixed is the dead end the message left behind: it now says where the code can
  be loaded (`This browser cannot paste here. Open the game in Safari or Chrome to load a code.`).
  A text field in Grown-ups is a lead's ruling, not a fixer's.
- **`r5-trivia-truth-02`** — the fact card's `Source:` line starts below the fold at 320 × 454.
  Filed as an `Opinion-level nicety` by its own reporter, and its text already says the CSS comment
  records this as a deliberate trade-off. It was **tried and reverted**: shrinking `.src` on the
  narrowest breakpoint moved the line and did not clear the fold, because the longest cards are
  taller than the body box by more than a source line, so getting a whole citation above the cut
  means shrinking the FACT the child is there to read. The drive assertion written for it
  (`at least one whole Source line inside the body box at rest`) is left in the file as a comment
  naming what was measured. The card scrolls and says so — r2-autism-fit-04's four-layer cue exists
  for exactly this — and a citation one flick away is not the same defect as a hidden one.
- **`r5-elevator-feel-04`** — the hint card covers the whole hoistway, so the car is behind it while
  the number line is up. Filed by its own reporter as `opinion`. It is real and it is a genuine cost;
  it is skipped because **the fix competes directly with `r5-autism-fit-2`, which is fixed in this
  same round.** At 320 × 454 the shaft is 82 px and `.hint` is already at its 64 px floor — the floor
  exists because a percentage of a collapsed shaft rendered the tick labels at 2 CSS px — so there is
  no height to give back, and moving the card to the top of the band puts it over the indicator
  instead of the car. The two findings want the same 82 px and the teaching aid has the better claim
  to it: the car is still there, drawn, one tap away when the hint is dismissed. Handed on below.
- **`r5-math-08`** — the `±` key is live at Megatall steps 1 and 2 where no answer can be negative.
  Filed by its own reporter as `opinion`, and its own text says the predicate is sound and explains
  why: `signKeyLive` uses `levelAllowsNegatives(level)` because the PROBLEM outlives the step that
  drew it — a comeback, a re-shown sum after a fall, a pinned-step change — and deriving the key from
  level + step takes it away from a sum that needs it, which is a keypad that cannot answer the sum
  on screen with no way out. The suggested remedy (a display-band gloss the first time a negative
  answer is possible) adds a sentence to the band on a step where nothing has changed, which is the
  class of defect `r5-math-02` and `r5-code-hostile-02` exist to close. Handed on below.

### Three things the round found that no finding named

- **The suggested fix was worse than the defect, three times over two findings.** `r5-autism-fit-1` proposes routing
  `next-building` through the `offer` reducer with `accept: false`; that zeroes `step3Run` and turns
  today's harmless deferral into a real decline costing two more clean buildings. It also proposes
  gating the navigation buttons until the offer is answered, which turns the reward screen into a
  modal a child cannot leave. `r5-math-03` proposes lowering `ADD_FLOOR` to 5, which is parity on the
  ceiling and re-opens the three-sum pool r4-math-10 closed. In all three cases the finding was real
  and the fix had to be re-derived. One verifier per finding said so before the fixer did, which is
  the argument for the three-report format.
- **A handoff can be wrong about the repository.** Round 4 asked a future round to regenerate
  `shots/` as "a commit of its own"; `.gitignore` has excluded `shots/` since the start and
  `git ls-files shots` returns nothing, so there is no such commit to make. It is under Handed on
  below rather than quietly fixed, because the decision — commit them, or stop calling them
  committed — is the lead's.
- **A general rule was not always available.** `r5-math-09`'s distractor half looks like a class
  (`no choice may be another choice with a piece cut out`) and is not: `70,000` against `7,000` and
  `100` against `10` are one character apart too, and for a maths bank an order-of-magnitude
  distractor IS the question. The general half — no question turning on a negation — is pinned over
  the whole bank; the distractor half is pinned on the one item, with the reason written beside it.

### Handed on

- **`shots/` is NOT in the repository, and round 4's handoff said it was.** `.gitignore` has carried
  `shots/` since the start and `git ls-files shots` returns nothing: the "500 committed screenshots"
  round 4 asked a future round to regenerate as "a commit of its own" have never been committed at
  all. They are a local artefact of `--shots`, which means the review's only durable picture of the
  layout is whatever a reviewer runs for themselves. That is worth deciding rather than inheriting:
  either commit them (and pay for the churn on every layout round) or stop describing them as a
  thing a commit can refresh. This round's changes do move them — the roof card's foot, the ride's
  top bar, the hint's tick labels and the landscape chip all look different.
- **`struggleRun` needs two CONSECUTIVE ruinous buildings**, so a child at ~3.8 falls per building
  sits just under the rescue threshold for ever. One verifier measured 20+ buildings stranded in
  Megatall with no offer down at all. `r5-math-04` fixed the bounce; it did not fix the strand. `2 of
  the last 3` is the obvious shape and it needs a measurement, not a guess.
- **A hint that does not hide the lift** (`r5-elevator-feel-04`). Skipped above because at 320 px
  there is no room for both, which is an argument about the SHAFT's height, not about the hint: a
  drawing that sat beside the car rather than over it, or a shaft that yields differently while the
  hint is up, would give a child who is here for the elevator their elevator back at the moment they
  most need reassurance the ride is still waiting. It needs a layout proposal, not a CSS tweak.
- **`r5-math-08`'s real question**: the keypad is honest about what it can express and silent about
  what the step needs. A gloss on the FIRST negative answer a child actually meets (not on every
  question of a step that has none) would be the version worth building.
- **A text field in Grown-ups**, if the lead wants Firefox to be a supported way in. It is a spec
  change to two DESIGN lines and one test, not a bug fix.
- **The save code is ~11 900 characters at a played save** and the fact bank is the growing term
  (~120 characters of BE1- per new fact across `seen`/`right`/`retry`). It is bounded and it round
  trips, and every content round adds to it. An index list over a stable id order would cut it by
  more than half and would silently remap on a bank reorder, so it needs a versioned id table first.

## Round 6 — hostile review (2026-09-08)

Thirty-four findings: **1 high, 10 medium, 23 low**. The high and the ten mediums carried three
independent verifier reports each; the twenty-three lows were filed unverified. The severity census
is the score: round 3 was 0 high / 14 medium / 30 low, round 4 was 2 high / 8 medium / 21 low,
round 5 was 1 high / 10 medium / 23 low, and this round is 1 high / 10 medium / 23 low — flat in
the census, and different in shape. **Twenty-seven fixed, seven skipped**, with reasons below.

Round 5's pattern was "an earlier fix that solved its finding, in a place the instrument that pinned
it does not look". This round's is narrower and sharper: **a guard that describes a STATE by naming
one of the phases that state can be in**, or **a bound taken on the wrong quantity**. The high is
the first (the pit is `repair` OR `keypad`, and the guard named only `repair`); so is `r6-math-03`
(the ring guard is unsatisfiable on a ten-key pool, so every guard below it in the same loop stops
being consulted). `r6-math-04` is the second (the count-up branch is bounded by the TOTAL when what
makes it laborious is the GAP) and so is `r6-math-05` (the number line is sized by `a + b`, a
quantity that is never on it, and labelled by a magic 20 rather than by the width a label needs).

**Instruments before → after:** `npm test` 261 → **284 passing** (a new `test/round6.test.js`,
23 cases, one per finding whose surface is not geometry); `node tools/phone-drive.mjs`
105 → **110 passing** (a new `back-gesture` scenario on all five phones, plus nine new assertions
inside the layout instrument: painted message text against the display band, tick-label collision on
the hint, focus containment behind a dialog, the disabled keys' contrast, the Grown-ups rows' label
alignment, the Repair card and the top bar re-measured with `Bigger text` on, and a check that
something MEASURES the viewport height); `node tools/headless-play.mjs` unchanged at 0.00 % repeats
on all five levels, which is the falsifier for the ring change. Every fix is pinned by an assertion
that fails on the reviewed tree — the geometry ones were each verified by reverting the fix and
watching the new gate go red, and those runs are named below.

### The high

`r6-code-hostile-1` — **the car walks out of the pit and then teleports.** `Try again` is the only
button on the Repair card, so every fall passes through the state it creates: `{floor: -1,
phase: 'keypad'}` with the same sum, saved. `normaliseRide`'s pit guard admitted `phase === 'repair'`
only, so every re-entry into that state — the top-bar `Lobby` (phase `keypad` is in `STABLE`, so the
button is live), a plain reload, or the update chip's own reload — lifted the car to the Ground
floor, threw away the retry and its sum, and left `target` where the fall had put it, because the
line below only ever RAISED it. From floor 9 that gave a car at G with only `R` lit: one fresh sum,
a shaft animation to floor 1 announcing "Floor 1", and then `arrive()` — which took `r.target`
rather than the floor the car reached — banking the building, paying the roof bonus, and writing
`records.longest = 10` for a ride of one floor.

Three changes, because the finding is a class and not an instance:

- the pit is a STATE (`floor === -1` and a problem to answer), not a phase, so the guard admits
  `repair` OR `keypad`, and `retrying` is read off the same condition;
- `target` is clamped BOTH ways off the pit (`nextTarget(floor)`), so no future path that lowers
  `floor` can leave the lit button out of reach — this also closes the hand-edited BE1- code
  carrying `{floor: 0, target: 10}`, which `migrateRide` passed through; and
- `arrive()` takes `state.car.floor` — where the timeline actually put the car — instead of
  `r.target`, so a desync can never move the car or the Logbook further than the lift travelled.
  That half is `r6-code-hostile-2`, and it is the same line.

Pinned by four cases in `test/round6.test.js`, including the whole route through the reducer (fall →
`Try again` → `to-lobby` → `ride-start` → one correct answer lands on floor 4, five floors credited)
and a sweep of every `{floor, target}` pair a hand-edited save can carry.

### The mediums

| id | what it was | what changed |
|---|---|---|
| `r6-math-01` | `.display` had a hard height, so `#message`'s BOX stayed inside the band while its TEXT was laid out below it — painted under the panel's own scroll-cue gradient and sliced at the band border. It fires on the ▮ gloss, the one sentence that explains the newest question form, on three phone profiles at the default type size and on all five with `Bigger text`. Box geometry could not see it, which is why this instrument's own section-height sums passed on every phone. | The band GROWS for a second line (`flex: 0 0 auto; min-height`) and the shaft pays for it, which is the band this layout has always said is the spring. At 320 × 454 that took the shaft to 63 px, one under the `.tiny` threshold, so the ≤ 500 tier gives back two pixels of band padding: shaft 65, elevator still drawn. With `Bigger text` at 320 the shaft does go `.tiny` — the trade DESIGN amendment 8 already makes for the trivia panel at that size, and the shaft keeps its box so nothing jumps. |
| `r6-math-02` | The Repair card overflowed its box on ~1 in 5 Megatall falls at 320 × 454 with `Bigger text`, sliced the count-on line through its glyphs, and put the clause — the only line naming WHAT went wrong — below a clean rounded border with no cue. The assertion that catches it already existed; the one scenario that turns `Bigger text` on never leaves the keypad. | The dominant term is `.big` wrapping: mono at 34/18 × 21 px cannot fit `169 + 9 = 178` in a 274 px card, and 46 px of headline becomes 92. Two character-count steps (`.big.long`, `.big.longer`), the mechanism `.worked.long` has used since it was written. Plus the four-layer scroll cue every other scroller in the game carries — this was the last one without it. The two card checks now re-run with the setting on. |
| `r6-math-03` | `× only, Largest 20` is a ten-key table against a 20-key ring, which round 3 ruled legitimate. What was not: once the ring can never be satisfied, all fifty attempts fail on the FIRST test and every question falls out of the bottom of the loop, where the same-answer rule, the doubles fuse and the zero fuse were never consulted either. | The ring gives way before the fuses do: the window shortens 20 → 10 → 5 → 2 → 1 until a draw can pass it, never below the last key served. The tables are NOT widened — `r3-math-06` rules that they may not exceed the number the parent set. Measured after, over 8 000 draws on each of three configurations: 0 same-key-twice-running, 0 doubles served while the doubles fuse is lit, 0 identities while the zero fuse is lit. `headless-play` still reports 0.00 % repeats on every shipped level, because a pool the full ring can satisfy never reaches the second rung. |
| `r6-math-04` | `explainMissAdd` bounded its count-up by the TOTAL, so `2 + ▮ = 20` modelled counting eighteen ones — 21 numerals, half again as long as anything else in the file — directly above the clause naming the right method. Every sibling branch in that file bounds its counted run. | Bridging through ten for a gap that crosses it: `2 + 8 = 10 · 10 + 10 = 20 · 8 + 10 = 18`. Count-up stays where its run cannot exceed nine, which is the bound `explainAdd`'s own `countOn` already carries. Swept over every reachable missAdd: no worked line anywhere counts more than nine numbers one at a time. It also shortens the card enough to help `r6-math-02`. |
| `r6-math-05` | The number line was sized by `p.a + p.b` — a quantity that is never drawn on it — so `9 − 8` at `numbers to 10` drew a line to 20 and `20 − 18` one to 40; and it labelled every unit below a magic `hi > 20`, so 21 two-digit labels went into a 288-unit span and `9 10 11 … 20` painted as `9 101 11 21 31 41 51 61 71 81 920`. | The bound is `max(a, answer)` for sub/down — the term was dead everywhere it was right (for add and up, `a + b` IS the answer) and fired only where it was wrong. The label step is measured from the font the labels will actually be drawn in, snapped to a step that divides the line so the last tick is always named. Tick MARKS stay at every unit: on a count-back they are the thing being counted, and the old rule deleted them wholesale past 20. |
| `r6-elevator-feel-02` | The roof card inferred "fresh" from an 11-floor window and a clean building is exactly 10 floors, so the Woolworth (60) was announced on two consecutive roofs — the second time above a forward line that contradicted it. Taking only the LAST rung reached also swallowed Taipei 101 and the Empire State, both overtaken by the Willis Tower inside one building. | A ledger, kept the way `state.plaques` is kept: `climbShown`. Every rung crossed is announced, each exactly once. A save written before the ledger existed carries `null` and is seeded from the floors already ridden, so an upgrade announces this building's rungs and not a backlog. Also `1 more floors` → `1 more floor`. |
| `r6-mobile-ux-1` | No screen change created a history entry, so Android Back / the iOS edge swipe left the site from every screen — and in the installed app (`display: standalone`, the configuration the design asks a parent to use) closed the game. It also defeated a guard the game already has: the ride's `Lobby` is disabled while the car moves, and the gesture pulled the child out mid-animation anyway. | One entry of ours sits on top for as long as the game runs. Back therefore lands in the game first and means `Lobby` — the same destination every screen's own button has, so the gesture and the button agree. At the lobby the entry is spent and the child leaves, which is the one Back that should. A Back the reducer REFUSES (car in motion) pushes the entry back, so the next one cannot leave from a moving lift; the part card closes instead of the Workshop. |
| `r6-mobile-ux-2` | *skipped — see below.* | |
| `r6-mobile-ux-3` | `#app` was `height: 100vh; height: 100dvh`, which is a fallback only on an engine that HAS dvh. On iOS Safari 15.0–15.3, Chrome under 108 (every Android 6 and older, permanently capped at Chrome 106) and Samsung Internet under 21 both resolve to the bars-HIDDEN viewport, so the whole vertical budget was computed against a box a toolbar too tall and GO — the only control that submits an answer — sat under the toolbar with nothing on the page able to scroll to it. Not degraded: dead, on first load, before anyone can Add to Home Screen. | `src/main.js` writes `--vh` from `window.innerHeight` as an inline property on `:root`, on load and on the same resize / orientationchange / visualViewport handler the shaft has always re-measured on, and `#app` takes `height: var(--vh)`. The two CSS values stay as the pre-script floor. `test/dom-contract.test.js`'s "dvh with a vh fallback" assertion is rewritten: 100vh is not a fallback on the engines that need one, and a test that says it is vouches for the defect. |
| `r6-deploy-pages-1` | `ci.yml`'s header said "This is that gate, run by the deploy". Pages here is a BRANCH source, so it publishes whatever lands on main in parallel with the run and regardless of its outcome — on the round-5 tip the deployment was created eight seconds before the test job finished — and the workflow has no deploy job and no `environment: github-pages`, so it structurally cannot consume the result. `main` carries no protection and no required check. | The reword, not the re-plumbing. In this repo's vocabulary a gate REFUSES (DESIGN calls the trivia audit "link-rot radar, not a test gate"), and the one file a maintainer reads to decide whether they must run `npm test` before pushing told them the machine already had — which retires the manual habit that is actually doing the work. It now says it is a post-hoc alarm, names what it is worth (~20 s, to whoever is watching), and states that the STAMP is still the gate and is still enforced by a human before the push. Making the claim true is a Pages-source change, not a file in this tree; handed on. |

### The lows, in one line each

- `r6-math-06` — `countBackBy` had no cap on `n`, so a Custom ceiling of 9999 produced
  `Count back in 100s from 9110:` listing seventy-six four-digit numbers (484 characters on a 296 px
  card). The place-value split now goes as far as thousands, so every single part is one leading
  digit times its place and no counted run in the file can exceed nine.
- `r6-math-07` — `withinNumberBand` fires only on a declared `maths.max`, so
  `How many seconds are there in one day?` (86,400 against 864,000, concept `counting`) was served
  at Corner Shop's `numbers to 10`. It declares `maths: {max: 86400}`. The new gate asks the class
  question — no banded level may offer two options that are the same digits at a different place
  value above its own ceiling — and exempts the DECLARED concept `large-numbers`, which Corner Shop
  and Hotel deny outright and Office Block and Skyscraper take deliberately.
- `r6-math-08` — the honeycomb question offered `Square` and `Rectangle` as distinct wrong answers
  and every square is a rectangle. `Long thin rectangle`, which is disjoint AND still tiles: round 4
  ruled that a distractor which cannot tile at all is not a wrong answer to this question
  (`r4-math-09`), so the reviewer's suggested `Regular octagon` is refused and that test now states
  both halves of the rule.
- `r6-elevator-feel-03` — `Stay` carried the game's one "this is the thing to tap" fill, so the
  loudest control on the reward card was the DECLINE. Round 5 made it the only primary to stop
  `Next building` shouting over the question; its own reasoning is why the fill has no business on
  either answer. While an offer stands nothing on the card is filled, the bordered block is the
  emphasis, and the two answers are the same button. The line also changes after the first showing
  (`Hotel is still there whenever you want it — … Try it?`), because tapping past the offer defers
  it by design and the identical sentence came back on eight consecutive roofs.
- `r6-mobile-ux-4` — `Shop` clipped to `Sh...` at 320 px once `Bigger text` was on and the lunchbox
  reached two digits, i.e. from the end of the first building. The readouts and the pips give way
  before the name does; the drive's existing ellipsis assertion now runs with the setting on and
  with a banked building behind it.
- `r6-mobile-ux-5` — at 320–375 px the Operations group wraps to three rows of keys and the label
  floated beside the middle of it. The rows whose control group is a set of 56 px keys carry `stack`
  and put the label above the group below 480 px; toggles and steppers are unchanged.
- `r6-mobile-ux-6` — the disabled backspace glyph read at 2.57:1, the identical number this project
  has now rejected twice on the same reasoning (`r3-autism-fit-04`, `r4-autism-fit-3`). Ink at
  4.6:1; the "cannot act" cue stays in the fill, the border and the shadow.
- `r6-mobile-ux-7` — the fact card and the part card are `role="dialog"` over a live screen and a
  touch could not reach past them, but Tab and a screen reader's swipe could — and `src/main.js`
  documents a paired keyboard as a supported way to play the whole game. `inert` plus `aria-hidden`
  on everything but the dialog, recomputed on every render so nothing is ever left inert.
- `r6-code-hostile-2` — fixed with the high, above: `arrive()` takes the floor the car reached.
- `r6-code-hostile-3` — every Grown-ups stepper drew both buttons live at its limits with an
  out-of-range `data-value`; `set-setting` clamped, saved, and nothing on screen moved or said why.
  `stepper()` takes the SAME bounds `set-setting` clamps to, so a button is dead exactly when the
  reducer would refuse it. The rule ("a lit, undimmed key that does nothing is a dead key") was
  already enforced on GO, on ⌫ and on the digit cap; this was the one screen it had not reached.
- `r6-code-hostile-4` — `tagFloors()` had no reference to the car, so switching Passengers
  mid-building put a `?` on floors the lift had already passed. A floor at or below the car is a
  passenger nobody can meet again in this building.
- `r6-code-hostile-5` — `validProblem` checked the arithmetic and accepted any `text` containing a
  ▮, so a hand-crafted BE1- code could put 614 characters of a stranger's words on the display band.
  `text` and `key` are recomputed from `kind/a/b/c` rather than trusted; verified over 5 000 real
  draws that the generator's own text and key are unchanged by it.
- `r6-trivia-truth-02` — four items listed the same URL twice under titles differing by a
  parenthetical, so the card printed two `Source:` lines for one document — the shape
  `r2-autism-fit-09` already refused for the two verification lenses, on the surface the child sees.
  Each pair is folded into one entry carrying both excerpts; the Otis 1854 card's second entry cited
  the 1857 Haughwout installation, which supports no claim in an item about the rope-cutting, and is
  dropped. `src/gate.js` now refuses a repeated URL, so all three banks get it.
- `r6-trivia-truth-03` — the three-ropes item's CONFIRM lens re-read the item's own primary, which
  `docs/TRIVIA.md` step 2 forbids and the bank's rule string does not disclose. Re-confirmed on
  2026-09-08 against an outside copy of the same rule (Seattle Building Code 2018 § 3011.6.12.4, via
  UpCodes) — a document the round-1 refute check had already fetched and recorded in the audit.
  `test/round6.test.js` now asserts the class over the whole bank.
- `r6-trivia-truth-04` — § 3042 carries `EXCEPTION: Existing traction elevators with two hoisting
  ropes.`, re-read at the primary on 2026-09-08, so "the fewest a traction elevator is allowed to
  hang from" was true only of NEW installations. The question, the fact and the quote all say which
  case they are about, and the fact came back under the 360-character card limit.
- `r6-deploy-pages-2` — `?reset=1` deleted every cache and unregistered every worker on the ORIGIN,
  not on this path, so a neighbouring app on `syntaxswine.github.io` would lose its offline copy to a
  reset pressed here. Filtered on the `be-` prefix `sw.js`'s own activate handler has always used,
  and on the registration's scope. Latent today (no sibling registers a worker) and the origin is
  shared with every future game the owner ships there.
- `r6-deploy-pages-3` — the 404 page is served at any depth, so `./favicon.ico` asked for a file
  that is not there: one 404 request per deep-path visit and a blank tab icon anyway. The static
  href is now an empty `data:` URL, which fetches nothing and cannot 404, and the inline script that
  already computes the project root points it at the real file.

### Skipped, and why

- **`r6-mobile-ux-2`** (medium) — *the shaft goes `.tiny` on four trivia items at 320 px with
  `Bigger text`.* Reproduced exactly; the mechanism and the four ids are right. It is the DOCUMENTED
  decision, twice over: DESIGN amendment 8 states "Under 64 px the shaft keeps its box but stops
  drawing (`.shaft.tiny`)", `tools/drive-scenarios.mjs` passes a sub-64 shaft precisely when `.tiny`
  is set, and `shots/se1-layout-worst-trivia-big.png` has been photographing a 0 px shaft at that
  geometry for two rounds. The suggested fix is refused by a passing test that carries its own
  reason — `test/dom-contract.test.js`: `no hard minimum on the one growable band` — which exists
  because a 200 px shaft floor pushed GO off the bottom of a real iPhone SE in round 1. Taking 64 px
  back from the trivia panel would put ~36 px of choice C below the fold on exactly the item that
  triggers it, which is the strictly worse defect `r5-autism-fit-4` was convened for. The residue
  worth having is the panel's own height at that tier, not a floor on the shaft; handed on.
- **`r6-elevator-feel-01`** (low) — *every building is the same lift.* Confirmed to the pixel, and
  already ruled on twice, in writing, against this same complaint: DESIGN amendment 12 ("a level is
  a maths band, not a height") and amendment 14, which quotes a round-3 reviewer's sentence
  verbatim. The reason is hard requirement 7: decoupling the band from the building's shape means a
  promotion — and, more importantly, a RESCUE down a level — never rearranges the physical world
  under the child. The suggested taller shaft is also not cosmetic: a building is exactly 16 bacon
  and all 24 part thresholds sit on that grid at offset −4 so each lands on a roof
  (`test/content-round.test.js`), so `Skyscraper G,1-14,R` desynchronises seventeen part unlocks and
  six plaques from the card that names them.
- **`r6-elevator-feel-04`** (low) — *the answer never names the floor.* A v2 design proposal, filed
  as one by the reviewer: it changes what a correct answer MEANS, and therefore the ride length, the
  16-bacon-per-building constant and every threshold built on it. Handed on.
- **`r6-elevator-feel-05`** (low) — *the roof card replaces the lift before the arrival is seen.*
  The observation is right and the beat is worth having, but the first half is a timing change to the
  one transition six drive scenarios measure, and the second half is new art. It needs its own
  measurement pass rather than a number changed under a review commit. Handed on.
- **`r6-trivia-truth-01`** (low) — *no part of the Source line is above the fold at 320 px.* The
  finding's own conclusion is "nothing needs to move if the trade-off stands", and it stands: this is
  `r5-trivia-truth-02`, measured and recorded both in `css/app.css` and in the layout scenario's own
  comment, and the card scrolls with the four-layer cue. Buying the eight pixels means shrinking the
  fact text the child is there to read.
- **`r6-deploy-pages-4`** (low) — *with JavaScript off the 404's back link loops.* The suggested fix
  is a hard-coded site root, and `test/dom-contract.test.js` refuses one on this page for a stated
  reason: it is served at any depth. The game itself requires JavaScript (`index.html` says so in a
  `<noscript>`), and every engine that can play it repairs the link. The favicon half of the same
  page IS fixed above, in a form that keeps the rule.
- **`r6-deploy-pages-5`** (low) — *Pages publishes `docs/`, including a brief that names the child's
  diagnosis.* Not a code change: it is a decision about the Pages source, and the same decision
  `r6-deploy-pages-1` hands on. Flagged so the choice is conscious rather than incidental. The
  repository is public already, so what this adds is the adjacency, not the content.

### What the instruments caught while fixing

- **The records gate refused the Climb ledger, and it was right to ask.**
  `test/parts-inert.test.js` allowed no line outside `tally()` to name `records`, and the ledger has
  to know how many floors have been ridden. The rule's real question is that `records` has ONE writer
  and is never read by the sum generator; the test now says that, permits a read of `.floors`, and
  still fails on any new write by any route. Widening a gate to admit one's own change is the thing
  to be most suspicious of, so the write half was tightened rather than left alone.
- **The new `r6-math-07` gate found a sibling immediately** — `math-numbers-pi-memorised-record`
  offers 7,000 / 70,000 / 700,000 at Office Block's `numbers to 100`. That item declares the concept
  `large-numbers`, which Office Block and Skyscraper admit on purpose, so the rule exempts it and
  says so. A rule that had flagged it would have been a rule about magnitude; this one is about a big
  number arriving under some other label.
- **The `--tall` pass was nearly turned into a duplicate of the browser-height pass.** The new
  viewport check restored `ctx.phone.viewport` — the BROWSER height — and the `--tall` pass runs the
  same scenario at the DEVICE height. It restores `page.viewport()` instead.
- **The display band spills SIDEWAYS too, and the portrait fix does not reach it.** In landscape
  `.ride.active` is a grid and the band is a fixed ROW (`grid-template-rows: … var(--display) …`),
  so `flex: 0 0 auto` on `.display` changes nothing there — and the display column is ~250 px wide,
  so the same sentences wrap sooner than they do in portrait. The row is
  `minmax(var(--display), auto)`, the shaft (`1fr`) gives, and the worst-message check now runs one
  landscape turn as well. Reverted, at 568 × 276: `the display band paints its message outside its
  own box (34 > 16)` on all three sentences.
- **The worst-message fixture asked the renderer instead of quoting it.** The first draft carried
  the two ▮ glosses as string literals — the shape round 4 caught drifting for the trivia worst case
  (`r4-trivia-truth-04`) and round 5 caught in the drive's own copy of the step-change sentences.
  `opGloss` is exported and the instrument draws the sentence with it, at the largest numbers the
  shipped ladder can put in it.
- **Five fixes were falsified by reverting them and watching the new gate go red.** `.display`'s
  hard height → `the display band paints its message outside its own box (37 > 23)` at 375 × 553;
  the magic-20 label rule → `hint tick labels overlap by 4.7 px: 0 1 2 … 20` at 390 × 664; `.big`'s
  step-down → `repair card text overflows its box: 250 > 198` and `repair card clips .clause: count
  again` at 320 × 454; `syncHistory()` → `Back from the picker left the game`; `markInert` →
  `focusable behind #sheet .sheet: Lobby, Sound off`, which is the finding's own measurement, word
  for word. The Grown-ups and top-bar rules were falsified the same way
  (`"Operations" sits 80 px below the top of the 184 px group it names`;
  `building name is clipped to "Mega" in 34 px`).

### Handed on

- **Make `ci.yml`'s claim true, or leave it as an alarm.** Switching the Pages source to GitHub
  Actions and giving a deploy job `needs: test` is the only thing that turns the stamp check into a
  refusal. It is a repository-settings change, not a file in this tree. The cheaper refusals are a
  `pre-push` hook or making `tests` a required status check on `main` — both stop the bad push
  before any bytes move, which is better than blocking a publish that a child who already has the
  game would not receive either way. `r6-deploy-pages-5` is decided by the same change.
- **The trivia panel's own height at 320 px** (`r6-mobile-ux-2`'s residue). The shaft may not have a
  floor and the panel may not push choice C past the fold, so the lever is the panel's type scale at
  that tier — the question clamp, the choice line-height, the padding — not a minimum on the shaft.
  It needs a measurement across all 67 items at both type sizes, which the `worstCase` helper
  already knows how to do.
- **Corner Shop and Hotel see the same 17 trivia items.** Promotion opens no new passenger question
  at all, because nothing in the bank declares a `maths.max` between 11 and 20. That is a content
  gap rather than a code one, and it is the second half of `r6-math-07`.
- **The `× only` pool is still ten sums**, and the Largest stepper is still inert from 6 to 35
  because `facHi` is floored at 5. `r6-math-03` fixed what that pool did to the OTHER guards; it did
  not make the pool bigger, because `r3-math-06` rules that the tables may not exceed the number the
  parent set and the tag says honestly which table was built. If a parent turning Largest up should
  see something change, that is a decision about the ceiling, not about the ring.
- **The landscape block in the layout scenario restores `ctx.phone.viewport`**, so under `--tall`
  everything after the first turn is measured at the browser height instead of the device height.
  One line, but it changes what half the tall pass has been measuring for three rounds, so it wants
  its own commit and its own before/after.
- **`shots/` is still not in the repository**, as round 5 recorded. This round moves them again: the
  display band, the Repair card's headline, the hint's tick labels, the Grown-ups rows, the roof
  card's offer block and the ride's top bar at 320 px all look different.
