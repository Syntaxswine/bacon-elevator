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
