# Bacon Elevator — Design (v1)

Base: Design 1 (judges 1 and 3). Grafts two or more judges named are in, rejects are out, and each contradiction is settled in a line marked **Decision**.

## Amendments by the lead (2026-09-08) — binding wherever a section below differs

1. **The fact pool is `data/trivia.json` as shipped** — 67 items (42 elevator, 25 maths), each one passed a confirming checker and a hostile refuting checker with independently fetched sources; the protocol is `docs/TRIVIA.md` and the full record (both checkers' reasoning, the two rejects, the three folded duplicates) is `data/trivia-audit.json`. Its schema replaces the `facts.json` schema in §5: `{id, category: "elevator"|"math", difficulty 1-3, question, answer, distractors[3], fact, sources[{title, url, quote?}], verification[{lens: "confirm"|"refute", source_title, source_url}]}`. There is no `archive_url`, `checked`, `selfcheck` or `evergreen` field and no `facts-cut.json`; `tools/facts-lint.mjs` and `docs/FACT-CHECK.md` are not built. The runtime gate in `trivia.js` `loadFacts(json)` accepts an item only if: both verification lenses are present, at least one source has an `http(s)` url, the three distractors are unique and none equals the answer, and none of the words *death, dead, die, died, killed, injur-, crash, trapped, accident* appears in question, answer, distractors or fact. Anything else is returned in `rejected[]` with a reason. `test/trivia.test.js` runs the same gate over the shipped file and asserts ≥ 60 live items and a 40/60 or better elevator/maths mix.
2. **Three choices from four options.** The choices shown are the answer plus two of the three distractors, picked and shuffled by the seeded rng, so a repeat of the same fact can show a different pair. `fact.kind` maps from `category`; `pickFact` alternates kinds and prefers unseen items; a missed fact returns after ≥ 20 questions as §5 says.
3. **Trivia layout, because the bank is longer than §5 assumed** (questions run to 196 characters, median 103; facts to 434, median 255; eight choices exceed 40 characters, the longest is 84). The ≤ 90 / ≤ 40 caps in §5 are dropped. In trivia mode the panel's rows 1–2 hold the question (17–18 px, wrapping, up to five lines) and rows 3–5 hold the three choices as full-width buttons (min-height 56 px, text may wrap to two lines, never truncated). The Fact card is a full-height sheet over shaft and panel: the question, `You chose …` / `The answer is …`, the fact text, one `Source:` line per source as `Source: <title> (<domain>)` in plain text, and a `Got it` button pinned at the bottom (≥ 56 px). The sheet scrolls inside itself if the text is taller than the viewport; the button never scrolls away. Everything else in §5 stands: the `?` tags, the cadence setting, +2 bacon for a right answer, the car never moves, nothing is lost, no anchor inside the ride.
4. **Icons live in `assets/`**, already rendered: `icon.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (180), `favicon-32.png`, plus `favicon.ico` at the root; `tools/make-icons.mjs` regenerates them. The manifest points at the PNGs with `purpose: "any maskable"` (the artwork sits inside the central 80 %). Do not create an `icons/` directory.
5. **The drive tool exists**: `tools/phone-drive.mjs` (phones `se` 375×667, `i12` 390×844, `pixel` 393×851, `small` 360×640; touch on; fails on any console error, page error, failed request or HTTP ≥ 400) and `tools/drive-scenarios.mjs` (named scenario entries, `--only <name>`). Keep that structure. Implement §13's scenarios as entries named `smoke`, `play20`, `fall`, `trivia`, `settings`, `layout`, `audio`; put the 48 px tap-target, horizontal-overflow and `#app` height assertions inside `layout`. Scenarios must tap real DOM keys through the DOM contract in §12 and use `?drive=1&seed=N&fast=1`.
6. **Version** — `src/version.js` exports `VERSION`; `sw.js` embeds the same literal in its cache name; `test/version.test.js` reads both files as text and asserts they agree. The service worker is required (§10): network-first `index.html`, cache-first relative assets, `skipWaiting`, old caches deleted on `activate`, the quiet update chip, and `?reset=1`.
7. **Bacon art** — v1 draws the bacon as one flat, thick-outlined inline-SVG `<symbol id="bacon">` reused everywhere (plates, tray, roof). A public-domain photograph may replace or join it later as a Workshop skin, so the symbol must be the single place the bacon is drawn.
8. **The vertical budget replaces §9's "shaft ≥ 200 px" (round 1, layout).** §9 sized the ride for a 390 × 664 reference and made the shaft's 200 px a hard minimum; on a real iPhone SE in Safari (375 × 553) the column then needed 600 px, and `#app` is `overflow: hidden`, so GO was pushed off the bottom — the child could not move the elevator. The rule is now: the top bar (48), the display band and the panel (5 × `--cell` + 6 × `--gap`) are fixed bands, the shaft is the remainder (`min-height: 0`), and 200 px is a preference that feeds the `--cell` clamp only. `--cell` never goes under 48 px. Three tiers: h ≥ 640 → gap 6, display 90, cell 56 (panel 316); h 501–620 → gap 4, display 72, cell 48 (panel 264); h ≤ 500 → display 60 (panel 264). Guaranteed-fit condition: top bar + display + panel ≤ vh, i.e. 372 px at the bottom tier. Under 64 px the shaft keeps its box but stops drawing (`.shaft.tiny`), and on a short shaft the camera pulls back (capped at 2.4×) so the car is whole; anything the camera's edge would cut in half is hidden instead (`.cropped`). Trivia rows are sized by their text (`grid-auto-rows: minmax(var(--cell), auto)`), which is what amendment 3 needed and did not have. The drive re-derives all of this from the measured bands rather than re-asserting 200.
9. **Everything else** in the sections below is the spec. Where two sentences below still conflict, the Module contract (§12) and the Verification plan (§13) win, then §2 Core loop, then the rest.

## Concept

You are the operator of the elevator in the Bacon Building. A strip of bacon waits on every floor. To ride up one floor, press the lit floor button and work out the sum on the panel. Right answer: the doors close, the elevator hums up, the indicator ticks to the next floor, one ding, the doors open, and the bacon slides in. Wrong answer: the panel shows the true sum, then the cable slips and the elevator drops onto the springy spikes in the pit — boing — and the safety brake catches it. Nobody is hurt and no bacon is ever lost. A repair card shows how the sum works, you answer it again, and the elevator rides straight back up. On two floors a passenger steps in with a true question about elevators or numbers; it can never make the elevator fall, and every answer shows where the fact comes from. At the roof your bacon goes into your lunchbox for good. There is no clock, no lives, and nothing is ever taken away.

## Core loop

One building = floors G, 1–9, R. The car starts at G, doors open. Timings are Normal (Fast halves them).

1. Floor mode: the next floor's round button pulses at 1 Hz (static under reduced motion). Display: `Press 3`.
2. Child taps `3`; its halo stays lit (a registered car call). Keypad mode; display: `7 + 5 = ▮`.
3. Child taps digits (max 4), `⌫`, then `GO` (grey until a digit exists). No auto-submit, no timer.
4. Correct: `7 + 5 = 12 ✓` (600 ms); doors close (500 ms); arrow ▲; the car rises one floor (700 ms, jerk-limited); 250 ms before arrival the hall lantern lights and one ding plays; the button light goes out; doors open (500 ms); the bacon slides in (400 ms), tray +1. Display: `Press 4`. GO to next `Press`: 2.7 s.
5. Floors tagged `?` (4 and 8 by default): a passenger steps in after the bacon (§5). Floor R: roof picnic (§6).

Wrong answer at floor 6, pressing 7, typing 11:

1. Display `7 + 5 = 12` — the true equation, 1.2 s. Nothing moves until it has been shown.
2. Button light out; arrow ▼; no ding. Doors close (400 ms); the cable goes slack; the car falls to the pit in 800 ms regardless of height; impact 600 ms (spikes squash, car squashes 10 %, one bounce); hold 500 ms: `Safety brake on.`, indicator `P`; doors open (400 ms). 3.9 s from GO; 2.0 s under reduced motion (cross-fades).
3. The Repair card (§4) covers the panel: big `7 + 5 = 12`, small `you pressed 11`, one worked line, one clause, button `Try again`.
4. `Try again` → keypad mode, the SAME sum. Correct: express ride P → 7 (500 ms per floor, indicator ticking G, 1 … 7, one ding), doors open, floor 7's bacon slides in; then `Press 8`, a new sum. Wrong again: no second fall; the card returns showing the answer; keying it rides up but floor 7's strip stays on its plate.
5. The missed sum returns at +5 and +15 questions. Step −1, once per building. Tray, lunchbox and cleared floors never shrink on a fall.

**Decision (recovery):** judges 2 and 3 ride pit → target with the strip; judge 1 rode back to the fall floor for a new sum. Two judges win; a fall costs one card and one re-ask.

## The elevator

**Model** (`src/elevator.js`, pure): floors −1 (P), 0 (G), 1–9, 10 (R). `step(car, event)` returns the next car plus a timeline of `{t, ev}` steps (absolute ms offsets) that the renderer plays off `requestAnimationFrame` and the tests assert on. `move` is refused with `{blocked:'doors'}` unless the doors are closed (the real interlock); `fall` is the one deliberate bypass; illegal events return the car unchanged. `positionAt(from, to, elapsedMs, msPerFloor)` is a pure jerk-limited trapezoid sampled every frame. **Decision (sequencing):** judges 1 and 2 grafted `transitionend` + rAF, judge 3 rejected `transitionend` (silent in a hidden tab); an rAF-clocked timeline with a `setTimeout` fallback satisfies both.

**Shown** (inline SVG, the top ~45 %): a cut-away shaft, two floors visible, scrolled to keep the car centred; landings carry a floor plate, hall calls, a lantern (▲ cream, ▼ amber) and a plate of bacon until collected. The car has centre-opening doors, an indicator bezel with amber tabular digits and arrow, and no face; two ropes run over a sheave above R and a counterweight slides opposite; the pit holds buffer springs and grey, round-tipped spikes on springs.

**Buttons** (bottom panel, floor mode): `🔔 | R | ·` / `7 8 9` / `4 5 6` / `1 2 3` / `G | ◁▷ | ▷◁`. Floor buttons are round with halos; only the lit target is live. `◁▷` re-opens closing doors; `▷◁` closes early and always works; the bell opens the Rules card; `?` tags mark passenger floors. **Decision (panel):** judge 2 rejected cells that change meaning between modes; judges 1 and 3 praised the zero-reflow panel. Kept, made safe: round floor buttons versus square digit keys, only the lit floor button live — a mode error is inert.

**Chime:** one ding up, two down (2010 ADA Standards §407.2.2.3, in the fact pool); the two-ding arrival plays on the victory descent from the roof; a fall gets none.

**Fall and recovery:** as in §2, byte-identical every time so it cannot become novelty; Otis's 1854 safety ends it; the pit is a floor (`P`, a `PIT` sign) and the recovery is the retry ride. **Bacon on a fall:** none is lost, ever.

## Math system

**Forms**, symbols only, never word problems: `a + b`, `a − b`, `a × b`, `a ÷ b` (exact), missing number `a + ▮ = c` / `▮ × b = c`, and the elevator-native `6 ▲ 4 = ▮` / `9 ▼ 3 = ▮`. Operator glyphs are 40 px, colour-coded (+▲ `#2F7A8C`, −▼ `#5B6B7A`, × `#7A4B8C`, ÷ `#2E8B74`) and shape-distinct (× at 0.8 em, thinner), so colour never carries the difference alone.

**Levels** are buildings with a range tag a parent reads at a glance, picked by tapping a silhouette:

| # | Name — tag | Step 1 | Step 2 | Step 3 |
|---|---|---|---|---|
| 1 | Corner Shop — numbers to 10 | + − ▲▼ within 5 | within 10 | + missing addend |
| 2 | Hotel — numbers to 20 | + − within 20, no crossing ten | crossing ten, doubles | + ×2 ×5 ×10 to 10, missing number |
| 3 | Office Block — numbers to 100 | 2-digit ± 1-digit, tens ± tens, no regroup | with regroup; ×3 ×4 | tables to 10, ÷ exact, 2-digit ± 2-digit |
| 4 | Skyscraper — times tables | tables to 10, ÷ exact | tables to 12, ▮ × b = c | ÷ within 144, squares to 12², 2-digit ± 2-digit regroup |
| 5 | Megatall — big numbers | 3-digit ± (≤ 2 regroups) | 2-digit × 1-digit | 2-digit × 2-digit (one ≤ 25 or a multiple of 10), 3-digit ÷ 1-digit, negatives (`±` live) |
| 6 | Custom (Grown-ups) | ops, min, max, negatives knobs | | |

Data in `src/levels.js`, one row per level and step, not a formula; a 20 000-draw test per row pins it. Operands 0 and 1 only at Corner Shop; no negatives below Megatall; division always exact. Default: Corner Shop, step 1.

**Adaptive rule** (visible, never silent): a three-segment step bar under the level name. 3 correct in a row → step +1 (max 3); a fall → step −1 (min 1), once per building at most. Levels never change on their own: two consecutive buildings at step 3 with ≤ 1 fall → the roof offers `Try Hotel?` (`Yes` / `Stay`, default Stay). `Adaptive: off` pins a parent-chosen step. Each kind keeps its last 8 results; a kind at 8/8 is drawn at weight 0.25, the rest at 1.0. **Decision:** Design 3's below-40 % easing is dropped (judge 3: no silent difficulty change).

**Anti-repeat and comeback:** a ring of the last 20 keys (`op:a:b`, commutative pairs sorted); rejected if the key is in the ring, the answer repeats the previous answer, `a = b` already occurred this building, or the kind has run three times; 50 retries, then accept. A missed sum returns verbatim at +5 and +15, overriding both. RNG: mulberry32 seeded by `?seed=` or `buildingIndex ^ saveSalt`; a seed replays identically.

**Repair card** (`src/explain.js`): big line the true equation, small line `you pressed 11`, one worked line from `explain(q)` whose steps a test re-evaluates (make-ten, split tens and ones, count-up, distributive split `6 × 7 = 6 × 5 + 6 × 2`, skip-count, inverse), plus one clause from `classify(q, typed)`: off by 1–2 → `count again`; neighbour table fact → `that is 6 × 6; one more 6`; digit reversal → `you pressed 21; it is 12`; operation swap → `+ means add`. Failure copy never contains "Oops", "wrong", "no", "✗" or an exclamation mark.

**Second try** (toggle; on at Corner Shop, off above): the first wrong answer clears the entry and shows `Try once more.`; only the second falls.

**HINT** (its own labelled cell, never the door button): a number line (+, −, ▲▼) or an a × b dot array (×, ÷ to 12 × 12) over the lower shaft; Megatall kinds show the first line of `explain(q)`. Free, unlimited, never recorded. **Decision:** judges 1 and 2 grafted it, judge 3 cut it for scope; adopted with exactly those three renderers.

**Entry:** `<button data-key>` elements, never an `<input>`: `HINT | ± | ⌫` / `7 8 9` / `4 5 6` / `1 2 3` / `0 | GO GO`; `±` is a blank spacer below Megatall so nothing shifts. No multiple choice for math: a one-in-three guess would move the elevator without maths.

## Trivia system

A passenger — a faceless silhouette — steps into the car after the bacon on `?`-tagged floors. `Passengers` setting: often (3, 6, 9), sometimes (4, 8; default), never. **Decision (cadence):** judge 1 kept 3/6/9, judge 2 rejected three of nine stops as too dense; sometimes is the default. The Rules card states: `Falls only happen for wrong sums. A passenger's question never falls.`

**Format:** `A passenger asks:`; question ≤ 90 characters; three choices ≤ 40 characters as stacked full-width 64 px buttons in place of the keypad. Right: the choice fills sage, `+2 bacon`, then the Fact card. Wrong: the chosen button keeps a thin outline, the right one fills, `The answer is B.`, then the same Fact card; nothing is lost and the car does not move — only math moves the elevator. The Fact card shows one explaining sentence and the citation as text (`Source: Otis Elevator Company, "History", 2023`) and stays until `Got it`; no card auto-dismisses. A missed fact returns after ≥ 20 questions. URLs open only from the Fact Book and only when `Open source links` is on (default off: leaving the game is a surprise).

**The sourcing rule:** every entry in `data/facts.json` carries `sources[≥1]` (`title, publisher, url, archive_url, accessed`), `checked: {by, date, verdict: "verified"}`, `safe: true`, `status: "live"`, and `evergreen: true` or a year inside the question text; computable facts carry a `selfcheck` the test evaluates. Content filter: no death, injury, crash, trapped. Two gates: `tools/facts-lint.mjs` blocks `npm test` on any gap, and `loadFacts()` refuses at runtime any entry not `verified` and `live`. `docs/FACT-CHECK.md` sets the protocol (two sources or one primary, checker initials, date); `tools/trivia-audit.mjs` HEAD-requests every URL quarterly — link-rot radar, not a test gate. Unverifiable facts move to `data/facts-cut.json` with the reason: cut, not softened. **Decision (pool size):** judge 3 asked for 30, judge 2 for ≥ 40, Design 1 for 60: v1 ships 40 live (20/20); the lint fails under 30; growth is ten per release, never by loosening.

## Bacon economy

Bacon is the score and the only reward. Tray = this building; Lunchbox = all-time; both on the top bar. Per building: 9 floor strips + 2 × 2 passenger strips (3 × 2 at often) + 3 roof bonus = 16 (18). The tray banks at the roof or whenever the child leaves — quitting is never penalised, and a building resumes exactly where it was, question included. No streak counter anywhere. The lunchbox never decreases; there is no spend.

Lunchbox milestones unlock real elevator parts in the Workshop, a radio per slot: 18 → telescopic side-opening doors; 50 → dot-matrix indicator; 100 → two-tone chime. 200, 400, 800 and 1500 hang a plaque on the Lobby wall. **Decision (parts):** judges 1 and 2 grafted Design 3's part list, judge 3 cut unbuilt parts; the Workshop lists only what is built; the rest (half-moon dial, nixie, wood/brass/glass cars, observation livery) is the v2 ladder in `docs/`.

## Screens and layout

Portrait, one thumb. `#app {position:fixed; inset:0; height:100dvh}` with a `100vh` fallback; padding from `env(safe-area-inset-*)`; `viewport-fit=cover`; `overscroll-behavior:none`; `touch-action:manipulation`; no `maximum-scale=1`. Reference viewport 390 × 664 (iPhone 14 with Safari bars): top bar 48 px; shaft ≥ 200 px (flex); display band 90 px; panel 3 × 5 cells of 118 × 56 px, 6 px gaps (48 px minimum everywhere); GO always bottom-right, two cells wide. Landscape under 500 px tall becomes two columns, shaft left, panel right — no rotate blocker.

- **Lobby:** title; lunchbox total; `Ride` (full width, 72 px); level chip; `Fact Book`; `Workshop`; speaker toggle; gear (two taps within 3 s; no long-press, iOS fires the callout).
- **Level picker:** five silhouettes with name, tag and step bar; `Custom` lives in Grown-ups.
- **Rules card** (first ride, and from the bell): four pictures (press, solve, up, fall and return) plus the passenger and never-lost sentences.
- **Ride:** top bar (`Lobby`, tray, lunchbox, speaker); shaft; display band (40 px tabular digits); panel in one of four modes sharing the same cells — floor, keypad, trivia (three choices), card (text on rows 1–4, one button on row 5).
- **Roof picnic:** tray slides into the lunchbox, `+3`, milestone line, level offer if earned, `Next building`, `Lobby` (the victory descent R → G at 500 ms per floor, two dings).
- **Fact Book:** every fact seen with answer, sentence and citation text (link when allowed). **Workshop:** built parts as radios per slot; plaques.
- **Grown-ups:** sound + volume; speed Normal/Fast; motion; bigger text; second try; adaptive (with pinned step); passengers; open source links; save code copy/paste, with the note that iOS may clear an uninstalled web game's storage after 7 days; custom level knobs (steppers, no `<input>`); reset (two taps 5 s apart).

## Accessibility and sensory design

Defaults: sound off; motion full unless `prefers-reduced-motion` (toggleable); Normal speed; no timers, streaks, lives, leaderboards, notifications or ads; second try on at Corner Shop; source links off; passengers sometimes; one fixed Day palette. **Decision (theme):** judge 1 rejected auto-following the system scheme (the palette must not flip at sunset); Night ships in v2 as an explicit toggle, never automatic.

Feedback is words plus the elevator, never colour alone: no red, no ✗, no exclamation marks in failure copy; the true equation is shown before anything moves. Copy is literal, calm, idiom-free. Nothing moves without the child's action except the announced elevator sequence; every sequence ends in a stable state that waits for a tap; nothing shows for under 300 ms; nothing flashes faster than 1 Hz. Every button has an `aria-label`; the display band is `aria-live="polite"`; contrast ≥ 4.5:1.

Explicitly not done, and why: background music (unpredictable layering); voices or `speechSynthesis` (iOS voices vary; surprise speech is a sensory risk); shake, flash, strobe, confetti (the roof drifts six bacon icons over 2 s, off under reduced motion); faces on the car or bacon (a "hurt elevator" reading); random events; pop-ups; response-time adaptivity; visible streaks; punishment tone; links inside the loop; spending; a `GO` hold timer.

## Visual and audio style

Palette, low saturation and warm: paper `#F4F1EA`, shaft `#D9D4C7`, car `#E9E4D8` with `#6B6B6B` lines, indicator bezel `#2B2B2B` with amber `#E8B04A`, lantern up cream `#FFF6DC` / down amber, bacon `#C9694A` + `#F1C9A6`, correct sage `#6E9B6E`, GO blue `#4A7BAA`, spikes `#9A9A9A`. Type: `system-ui`, 18 px body; 40 px display digits in `ui-monospace`, `tabular-nums`; indicator 48 px. Flat, thick-outlined shapes.

Motion: ease-in-out for doors, the trapezoid for travel, ease-in for the fall; one bounce, only on impact; the indicator swaps at the sill, never faster than 4 per second. All timings are constants in `src/elevator.js`, scaled by one `timescale` (Normal 1, Fast 0.5, drive 0.1).

Sound set, WebAudio-synthesised, no files, peaks ≤ −12 dBFS, none over 1 s: ding (880 Hz sine, 120 ms), double ding, door hum, motor hum (110 Hz, −30 dB, following `positionAt` speed), button click (20 ms), bacon two-note C5–E5, cable whoosh (filtered noise 400 → 100 Hz, −18 dB), boing (200 Hz pitch drop, 250 ms), roof three-note rise. Opt-in: the speaker button's tap creates the `AudioContext`; `resume()` runs on any `pointerdown` while suspended; `visibilitychange` suspends it; volume default 50. Haptics: v2, Android only.

## Architecture

```
index.html  .nojekyll  manifest.webmanifest  sw.js  css/app.css  icons/ (svg, 192, 512, maskable, apple-touch-180.png)
src/ (§12)   data/ facts.json facts-cut.json   test/*.test.js   docs/ BRIEF DESIGN FACT-CHECK
tools/ serve.js phone-drive.mjs headless-play.mjs facts-lint.mjs trivia-audit.mjs make-icons.mjs
```

Pure: `rng, levels, math, explain, elevator, trivia, state, save` — none references `window`, `document`, `localStorage`, `setTimeout` or `Date`; seed and now are injected. DOM: `main, storage, audio, render/*`. `state.reduce` returns `{state, effects}`; `main.js` alone dispatches from DOM events and plays effects and timelines off rAF. Save at `localStorage["bacon-elevator.save.v1"]` through `storage.js` (try/catch, in-memory fallback for Safari private mode); export/import as `BE1-` + base64.

PWA on the Pages subpath: manifest `start_url "./"`, `scope "./"`, `display standalone`, `orientation portrait`; `sw.js` registered as `./sw.js`, network-first index, cache-first relative assets in cache `be-<VERSION>` from `src/version.js`, `skipWaiting`, older caches deleted on `activate`, a quiet `Update ready — tap to reload` chip; `?reset=1` clears save and caches.

Headless drive: `tools/phone-drive.mjs` launches system Chrome via puppeteer-core at iPhone 14 (390 × 844, DPR 3, iOS UA, touch), Pixel 7 (412 × 915) and iPhone SE (375 × 667) with `?seed=7&drive=1&fast=1`, reads the read-only `window.__bacon.state()`, computes each answer in Node with the same `solve()`, and enters everything with `page.tap` on the real keys — never a dispatch. **Decision (time):** judge 2's `performance.now` mock is rejected (judge 3: rAF and CSS ignore it); the drive uses the `timescale` knob. `tools/headless-play.mjs` runs the reducer alone at seed 42 (§13).

## Risks and open questions

1. **The fall frightens, or becomes the fun.** Identical animation, no loss, the true equation first; the uncle watches the first session; reduced motion's cross-fade is the gentle fall if needed. No "no spikes" mode: the owner's design stands.
2. **The child may not read.** Symbols-only math, icons on every button, a picture Rules card, `Passengers: never`.
3. **Fact-checking is real labour and links rot.** 40 facts at v1 through the protocol, `archive_url` mandatory, the runtime gate, the quarterly audit; grow by ten per release.
4. **iOS Safari** (dvh, audio unlock, stale caches, 7-day storage eviction). Fixed root + dvh, gesture-created context, versioned index, Home Screen install plus the save code; the drive asserts layout on every change.
5. **Unknown level: picking versus being offered.** Ship adaptive on, level pinned, offers only at the roof after two buildings of evidence; Custom exposes explicit ranges; read `history.byKind` after the first week and re-tune the tables, not the rules.

## Module contract

Files under `src/`: `version.js`, `main.js`, `rng.js`, `levels.js`, `math.js`, `explain.js`, `elevator.js`, `trivia.js`, `state.js`, `save.js`, `storage.js`, `audio.js`, `render/shaft.js`, `render/panel.js`, `render/screens.js`.

**rng.js** — `mulberry32(seed:uint32) → rng`; `rng() → [0,1)`; `rng.int(lo, hi)` inclusive; `rng.pick(arr)`; `hash32(str) → uint32`.

**levels.js** — `LEVELS: [{id, name, tag, steps: [{kinds: [{kind, weight, a:[lo,hi], b:[lo,hi], max, regroup, tables}]} ×3]}]`; `levelById(id)`; `customLevel({ops, min, max, negatives}) → level` (one step). `kind` ∈ `add|sub|mul|div|missAdd|missMul|up|down`; `id` ∈ `corner|hotel|office|sky|megatall|custom`.

**math.js** — `makeProblem(level, step, ctx, rng) → problem`, `problem = {kind, a, b, answer, text, key}` (`text` is the display string with `▮` for the blank); `ctx = {ring: string[], lastAnswer, sameSeen: boolean, kindRun: {kind, n}, comeback: [{problem, due}], count, skills: {[kind]: number[]}}` (last 8 as 1/0); `afterAnswer(ctx, problem, correct) → ctx` (ring push, skills push, comeback at `count+5` and `count+15` on a miss, `count+1`); `solve(problem) → number` (recomputed from `kind, a, b`; equals `answer`); `keyOf(problem) → string` (`add:5:7`, sorted for add and mul); `checkAnswer(problem, typed:string) → boolean`; `adaptStep({step, streak, stepDowns}, correct, fell) → {step, streak, stepDowns, delta:-1|0|1}`.

**explain.js** — `explain(problem) → [{text, value}]` (last `value === answer`); `classify(problem, typed:number) → {cls:'offby'|'neighbour'|'reversal'|'opswap'|'other', clause}`; `repair(problem, typed) → {big, small, worked, clause}`.

**elevator.js** — `DURATIONS = {doors:500, floor:700, express:500, fall:800, impact:600, hold:500, pitDoors:400, lanternLead:250, tick:600, bacon:400}`; `scale(durations, timescale)`; `initialCar() → car` where `car = {floor, doors:'open'|'closing'|'closed'|'opening', direction:'up'|'down'|'none', carCall, hallCalls:number[], lantern, motion:'idle'|'moving'|'falling'|'hoisting'}`; `step(car, event) → {car, timeline:[{t, ev, floor?}], blocked?:'doors'|'illegal'}`; events `{type:'press', floor}`, `{type:'closeDoors'}`, `{type:'openDoors'}`, `{type:'move'}` (one floor up), `{type:'fall'}`, `{type:'express', to}`, `{type:'descend', to}`; `ev` ∈ `doors-closing|doors-closed|move-start|lantern|ding|ding2|sill|arrive|doors-opening|doors-open|fall-start|impact|brake|bacon`; `positionAt(from, to, elapsedMs, msPerFloor) → float` (monotone, exactly `to` at the end); `label(floor) → 'P'|'G'|'1'…'9'|'R'`.

**trivia.js** — `loadFacts(json) → {facts, rejected:[{id, reason}]}` (gate: `status==='live'`, `checked.verdict==='verified'`, `safe===true`, every source has `url` and `archive_url`, three unique choices, answer 0–2, length caps); `isPassengerFloor(floor, cadence) → boolean`; `pickFact(facts, seen:string[], lastKind, rng) → fact` (unseen first, kinds alternate, least-recent recycle); `fact = {id, kind:'elevator'|'math', q, choices[3], answer, fact, sources[], checked, safe, status, evergreen?, selfcheck?}`.

**state.js** — `initialState(salt) → state`; `reduce(state, action, rng) → {state, effects}`; actions `ride-start`, `press-floor {floor}`, `digit {d}`, `backspace`, `toggle-sign`, `go`, `hint`, `timeline-done`, `card-continue`, `choice {i}`, `next-building`, `to-lobby`, `set-level {id}`, `set-setting {key, value}`, `equip {slot, part}`, `reset`; `state.phase` ∈ `lobby|floor|keypad|moving|falling|pit|repair|trivia|fact|roof|descending`; effects `{type:'timeline', steps}`, `{type:'sound', name}`, `{type:'save'}`, `{type:'screen', name}`. `go` outside `keypad|repair` and `choice` outside `trivia` are no-ops.

**save.js** — `serialize(state) → string`; `parse(str) → state|null` (malformed → null); `migrate(obj) → state` (v0 → v1); `encodeCode(state) → 'BE1-…'`; `decodeCode(code) → state|null`.

**Save JSON** (`bacon-elevator.save.v1`):

```json
{"v":1,"created":1757000000,"salt":123456,"lunchbox":41,"buildings":3,
 "level":"corner","step":2,"adaptive":true,"pinnedStep":1,
 "settings":{"sound":false,"volume":50,"speed":"normal","motion":"auto","bigText":false,
   "secondTry":true,"passengers":"sometimes","links":false,
   "custom":{"ops":["add","sub"],"min":0,"max":20,"negatives":false}},
 "facts":{"seen":["otis-1854"],"right":["otis-1854"],"retry":[]},
 "unlocks":["doors-telescopic"],"equipped":{"doors":"doors-telescopic","indicator":"segment","chime":"single"},
 "history":{"ring":["add:5:7"],"count":212,"answered":212,"correct":190,"falls":6,
   "byKind":{"add":[80,76]},"skills":{"add":[1,1,0,1,1,1,1,1]}},
 "ride":{"seed":7,"floor":6,"target":7,"cleared":[1,2,3,4,5,6],"tray":6,"phase":"keypad",
   "problem":{"kind":"add","a":7,"b":5,"answer":12,"text":"7 + 5 = ▮","key":"add:5:7"},
   "typed":"1","tries":0,"streak":2,"stepDowns":0,"comeback":[],"passengersDone":[4]}}
```

`ride` is `null` between buildings.

**DOM contract** (what the drive relies on): `#app[data-screen]` ∈ `lobby|picker|rules|ride|roof|factbook|workshop|grownups`; `#app[data-phase]` mirrors `state.phase`; `#question` (display band, `aria-live`, the current question or status text); `#stepbar[data-step="1|2|3"]`; `#indicator[data-floor="P|G|1…9|R"][data-arrow="up|down|none"]`; `#car[data-motion="idle|moving|falling|hoisting"]`; `#doors[data-state]`; `#tray` and `#lunchbox` (integer text); panel buttons `button[data-key="0"…"9"|"back"|"go"|"hint"|"sign"]`, `button[data-floor="G"|"1"…"9"|"R"]`, `button[data-door="open"|"close"]`, `button[data-bell]`, `button[data-choice="0|1|2"]`, `button[data-continue]`; every tappable element carries `data-tap`; screen buttons `[data-nav="ride|lobby|picker|factbook|workshop|grownups"]`, `[data-level="corner|hotel|office|sky|megatall"]`, `[data-setting="…"]`. Hook: `window.__bacon = {state(), version, timescale}` exists only when the URL has `?drive=1`; `?seed=N` seeds; `?fast=1` sets timescale 0.1; `?reset=1` clears.

## Verification plan

`npm test` = `node --test test/`:

- `rng.test.js` — same seed → same sequence; `int` bounds inclusive. `levels.test.js` — exactly 3 steps per level, ≥ 1 kind per step.
- `math.test.js` — 20 000 draws per level and step stay in range; `solve` equals `answer`; division exact; no negatives below Megatall; operands 0/1 only at Corner Shop; ring, same-answer and kind-run rules hold; comeback at exactly +5 and +15; seed determinism; `adaptStep` climbs after 3, drops once per building, stays within 1–3.
- `explain.test.js` — 5 000 problems per kind: the steps evaluate to the answer; each classifier class has a fixture and a counter-fixture.
- `elevator.test.js` — timeline snapshots for every legal event; illegal events return the car unchanged; `move` blocked unless doors closed, `fall` bypasses; one `ding` up, `ding2` on descend, none on fall; express and descend pass floors in order at 500 ms; `positionAt` monotone and exact at arrival; `scale` halves every duration.
- `trivia.test.js` — the loader rejects entries missing verdict, status, safe, url or archive_url; passenger floors per cadence; unseen-first and alternation; retry after 20.
- `facts-lint.test.js` — every §5 rule on `data/facts.json`; `selfcheck` evaluated; forbidden words; unique choices; ≥ 30 live; no id shared by live and cut.
- `state.test.js` — a fall keeps tray and cleared; a wrong choice never changes floor; lunchbox monotone over a 2 000-action random walk; a mid-question quit persists the problem; second try falls only on the second miss; the roof offers only after two step-3 buildings.
- `save.test.js` — round trip; corrupt and missing blobs → defaults; v0 → v1 migration; code encode/decode. `version.test.js` — `sw.js` and `version.js` agree.
- `headless-play.test.js` — 10 000 questions per level at seed 42: repeat rate < 1 %, no kind over 60 %, step converges under the perfect policy.

Drive scenarios (`tools/phone-drive.mjs`, the pre-push gate; fails on any console error, horizontal overflow, a `[data-tap]` rect under 48 px, `clientHeight !== innerHeight`, service-worker registration failure, contrast under 4.5:1, or a fall over 5 s at timescale 1):

1. `--play 20` at iPhone 14: 20 correct answers through the real keys; floor increments, `#tray` and `#lunchbox` match the prediction, the roof picnic follows floor 9, the second building starts at G.
2. `--fail`: answer 11 to `7 + 5` at floor 6; `#car[data-motion=falling]`, then `#indicator[data-floor=P]`; the Repair card begins with the true equation; `Try again` returns the same problem; the correct answer rides to floor 7 with the strip collected; `#tray` never decreased.
3. `--trivia`: reach floor 4; three `[data-choice]` buttons; a wrong choice leaves `#indicator` unchanged; the Fact card shows a `Source:` line and no anchor; `Got it` returns to `Press 5`.
4. Settings persistence: set speed Fast and second try off, reload, assert `__bacon.state().settings` and the halved durations.
5. Layout at 375 × 667 and 390 × 844 (and 412 × 915): no overflow, panel inside the safe area, GO bottom-right, shaft ≥ 200 px, screenshots of every screen to `tools/out/`.
6. Console: zero errors in every run; `AudioContext` never created before the speaker tap; the sound-on run plays without error.

A real-phone check (iPhone and Android: Home Screen install, audio unlock, no rubber-band scroll) closes each review.
