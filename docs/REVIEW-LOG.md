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
