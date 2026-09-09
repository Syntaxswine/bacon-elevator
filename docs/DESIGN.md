# Bacon Elevator — Design (v1)

Base: Design 1 (judges 1 and 3). Grafts two or more judges named are in, rejects are out, and each contradiction is settled in a line marked **Decision**.

## Amendments by the lead (2026-09-08) — binding wherever a section below differs

1. **The fact pool is `data/trivia.json` as shipped** — 67 items (42 elevator, 25 maths), each one passed a confirming checker and a hostile refuting checker with independently fetched sources; the protocol is `docs/TRIVIA.md` and the full record (both checkers' reasoning, the two rejects, the three folded duplicates) is `data/trivia-audit.json`. Its schema replaces the `facts.json` schema in §5: `{id, category: "elevator"|"math", difficulty 1-3, question, answer, distractors[3], fact, sources[{title, url, quote?}], verification[{lens: "confirm"|"refute", source_title, source_url}]}`. There is no `archive_url`, `checked`, `selfcheck` or `evergreen` field and no `facts-cut.json`; `tools/facts-lint.mjs` and `docs/FACT-CHECK.md` are not built. The runtime gate in `trivia.js` `loadFacts(json)` accepts an item only if: both verification lenses are present, at least one source has an `http(s)` url, the three distractors are unique and none equals the answer, and none of the words *death, dead, die, died, killed, injur-, crash, trapped, accident* appears in question, answer, distractors or fact. Anything else is returned in `rejected[]` with a reason. `test/trivia.test.js` runs the same gate over the shipped file and asserts ≥ 60 live items and a 40/60 or better elevator/maths mix.
2. **Three choices from four options.** The choices shown are the answer plus two of the three distractors, picked and shuffled by the seeded rng, so a repeat of the same fact can show a different pair. `fact.kind` maps from `category`; `pickFact` alternates kinds and prefers unseen items; a missed fact returns after ≥ 20 questions as §5 says.
3. **Trivia layout, because the bank is longer than §5 assumed** (questions run to 196 characters, median 103; facts to 434, median 255; eight choices exceed 40 characters, the longest is 84). The ≤ 90 / ≤ 40 caps in §5 are dropped. In trivia mode the panel's rows 1–2 hold the question (17–18 px, wrapping, up to five lines) and rows 3–5 hold the three choices as full-width buttons (min-height 56 px, text may wrap to two lines, never truncated). The Fact card is a full-height sheet over shaft and panel: the question, `You chose …` / `The answer is …`, the fact text, one `Source:` line per source as `Source: <title> (<domain>)` in plain text, and a `Got it` button pinned at the bottom (≥ 56 px). The sheet scrolls inside itself if the text is taller than the viewport; the button never scrolls away. Everything else in §5 stands: the `?` tags, the cadence setting, +2 bacon for a right answer, the car never moves, nothing is lost, no anchor inside the ride.
4. **Icons live in `assets/`**, already rendered: `icon.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (180), `favicon-32.png`, plus `favicon.ico` at the root; `tools/make-icons.mjs` regenerates them. The manifest points at the PNGs with `purpose: "any maskable"` (the artwork sits inside the central 80 %). Do not create an `icons/` directory.
5. **The drive tool exists**: `tools/phone-drive.mjs` (phones `se` 375×667, `i12` 390×844, `pixel` 393×851, `small` 360×640; touch on; fails on any console error, page error, failed request or HTTP ≥ 400) and `tools/drive-scenarios.mjs` (named scenario entries, `--only <name>`). Keep that structure. Implement §13's scenarios as entries named `smoke`, `play20`, `fall`, `trivia`, `settings`, `layout`, `audio`; put the 48 px tap-target, horizontal-overflow and `#app` height assertions inside `layout`. Scenarios must tap real DOM keys through the DOM contract in §12 and use `?drive=1&seed=N&fast=1`.
6. **Version** — `src/version.js` exports `VERSION`; `sw.js` embeds the same literal in its cache name; `test/version.test.js` reads both files as text and asserts they agree. The service worker is required (§10): the worker **waits** for the update chip's tap (no `skipWaiting` in `install`), `index.html` is served **cache-first** from the versioned cache, relative assets cache-first, precached with `cache: 'reload'`, old caches deleted on `activate`, the quiet update chip, and `?reset=1`. Only the app ROOT is answered with `index.html`: a navigation deeper in the scope goes to the network so Pages can serve `404.html` (amendments 10 and 13). The cache name is `be-<VERSION>-<BUILD>`, where BUILD is a hash of every precached file (`node tools/build-stamp.mjs`).
7. **Bacon art** — v1 draws the bacon as one flat, thick-outlined inline-SVG `<symbol id="bacon">` reused everywhere (plates, tray, roof). A public-domain photograph may replace or join it later as a Workshop skin, so the symbol must be the single place the bacon is drawn.
8. **The vertical budget replaces §9's "shaft ≥ 200 px" (round 1, layout).** §9 sized the ride for a 390 × 664 reference and made the shaft's 200 px a hard minimum; on a real iPhone SE in Safari (375 × 553) the column then needed 600 px, and `#app` is `overflow: hidden`, so GO was pushed off the bottom — the child could not move the elevator. The rule is now: the top bar (48), the display band and the panel (5 × `--cell` + 6 × `--gap`) are fixed bands, the shaft is the remainder (`min-height: 0`), and 200 px is a preference that feeds the `--cell` clamp only. `--cell` never goes under 48 px. Three tiers: h ≥ 640 → gap 6, display 90, cell 56 (panel 316); h 501–620 → gap 4, display 72, cell 48 (panel 264); h ≤ 500 → display 60 (panel 264). Guaranteed-fit condition: top bar + display + panel ≤ vh, i.e. 372 px at the bottom tier. Under 64 px the shaft keeps its box but stops drawing (`.shaft.tiny`), and on a short shaft the camera pulls back (capped at 2.4×) so the car is whole; anything the camera's edge would cut in half is hidden instead (`.cropped`). Trivia rows are sized by their text (`grid-auto-rows: minmax(var(--cell), auto)`), which is what amendment 3 needed and did not have. The drive re-derives all of this from the measured bands rather than re-asserting 200.
9. **Content and words (round 1, fixer 3).** Nine changes to what the game asks, says and cites, each one because a sentence already on screen was false.
   - **The keypad must be able to express the answer to the problem it is SHOWING.** §4's `± is a blank spacer below Megatall` is unchanged in spirit and stricter in fact: the key is now a property of the LEVEL (`levelAllowsNegatives`), plus any problem whose answer is negative — never of the level AND step. The problem outlives the step that drew it (a fall drops the step, a pinned-step change moves it, a Custom knob rebuilds the level, a comeback re-serves an older sum), so the old derivation took the ± key away from a parked `2 − 27` and left a keypad that could not answer the sum on its own display. The same rule governs the digit cap: `typedCap(problem)` (4 digits, or as many as the answer needs, to a ceiling of 6) replaces the bare 4 in `state.js` and the `\d{0,4}` in `save.js`. One predicate, three call sites: `signKeyLive`, `typedCap` in `math.js`.
   - **The forfeit is dropped.** §2's wrong-answer step 4 said `keying it rides up but floor 7's strip stays on its plate`; the strip is now collected when the sum is finally answered, however many cards it took. The rule was silent and it made two printed sentences false — the Rules card's `Bacon is never lost. There is no clock.` and §7's 16 bacon per building (a forfeit run banked 15). The cost of a fall stays what §2's Decision names: one card, one re-ask, step −1, and the sum returning at +5 and +15.
   - **The comeback queue moved from `ride.comeback` to `history.comeback`** (§12's Save JSON block). A building is TEN questions and `newRide` reset both the queue and the count, so +5 could only fire for a miss on floors 1–5 and +15 could never fire at all. It is cleared on any level change (including an accepted roof offer), so a Corner Shop child is never served a Megatall sum. An old save loses one building's worth of remediation on upgrade.
   - **`pickFact` takes a sixth parameter, `limits`** (§12 module contract), and `trivia.js` exports `TRIVIA_LIMITS`: Corner Shop and Hotel draw difficulty ≤ 1 and questions ≤ 130 characters (22 of the 67 items, 10 elevator + 12 maths), Office and Skyscraper ≤ 2 and ≤ 160 (54 items), Megatall and Custom ungated. The band is applied before the comeback and recycle branches, so nothing escapes it. §5 is otherwise unchanged.
   - **A first miss is a miss.** §4's adaptive rule assumed every verdict reached it; the second-try branch returned before the one function that wrote history and the streak, so a child who missed every first attempt and got every second one right was promoted to step 3 by question 7 with history reading 17 answered / 17 correct. `recordQuestion` (once per question, at the first verdict) and `applyAdapt` (every verdict) are now separate. `history.answered`/`correct` therefore count FIRST attempts; that is the intent. `settings.secondTry` remains a parent switch at every level — §4's `on at Corner Shop, off above` is NOT implemented, and needs the lead's decision either way.
   - **Repair-card clauses name the mistake the child actually made** (§4's classifier list). On `a + ▮ = c` and `▮ × b = c` the typed number is an addend or a factor, not a total, so the operation-swap clause is the inverse move (`7 is the total, so ▮ is 7 − 3`), never `+ means add` — which contradicted the worked line above it. `neighbour` fires only on `mul`, where the typed number IS a product; the ÷ branch was unreachable and is deleted. `reversal` compares digit strings of EQUAL length, so a child who pressed GO one digit early (`10 × 10`, typed 1) is no longer told they reversed the digits.
   - **Level tags may not undercut their own tables.** `levels.js` exports `levelBound(level)`; Hotel is tagged `numbers to 20; tables 2, 5, 10` because its step-3 × table (which §4 specifies) reaches 100. `customLevel` builds tables that are satisfiable by construction and derives its tag from them, so `ops ÷, 50 to 60` no longer reads `numbers 50 to 60` over a `15 ÷ 3`; `render/screens.js` asks that one function instead of composing the tag a second time. The Custom default is `min: 2` (0 stays reachable through the stepper), and Corner Shop step 3 drops 0 as an operand — §4's `Operands 0 and 1 only at Corner Shop` is a permission, not a requirement.
   - **`makeProblem` never invents a problem.** Its last-resort fallback served one corner of the range for ever (`100 × 2 = 200` on 900/900 draws, above the parent's own Largest number) and could render `= undefined`; it now degrades to a legal random sum of the same kind inside the entry's own ceiling, and `finish()` fills a missing-number total rather than emitting a blank the child cannot read.
   - **Small ones:** a declared double or square is no longer capped by the incidental `a = b` latch (Hotel doubles 7.99 % → 13.1 % against a 12.5 % table weight); a digit tapped after a lone `0` replaces it instead of being swallowed; the fall clears the car call (§2 wrong-answer step 2, `Button light out`) and the recovery express registers one; every control the reducer refuses by phase now looks refused; the number-line hint draws one countable hop per unit; the floor-mode spacer is empty; and the picker says what picking another building does.

10. **The service worker WAITS, and `index.html` is now cache-first (round 1, fixer 2).** Amendment 6 and the Architecture section say 'network-first index.html' and 'skipWaiting'; both change here, and the two changes are one change. `skipWaiting()` in `install` activated a deploy the instant it finished installing, `clients.claim()` took the open tab over, and `main.js` reloaded on any `controllerchange`: measured on a max-age=600 server, an unrequested navigation 3.1 s into a sum, and the child back on the lobby screen. The worker now waits and only a chip TAP may reload the tab (`updateRequested`; the chip also sets a per-tab `sessionStorage` flag so the reload lands back on the sum, not the lobby). Once the worker genuinely waits, network-first `index.html` serves the NEW document against the OLD cached modules until the tap, so `index.html` is served cache-first from the versioned cache and `fetch` only fills a miss; the update path runs entirely through the SW update check, which the browser performs on every navigation (measured: `/sw.js` was requested from the network on every load even at max-age=600). `install` also precaches with `new Request(u, {cache: 'reload'})`, because Pages sends `cache-control: max-age=600` on every asset and a default `addAll()` copies the PREVIOUS version out of the browser HTTP cache into the new version's cache (measured: 0 assets fetched, `be-1.0.1` holding VERSION '1.0.0'). Escape hatches are unchanged: `?reset=1` clears the save and every cache, and Grown-ups prints VERSION. The instrument is `tools/update-drive.mjs` (`npm run drive:update`), which `npm run drive` cannot replace: the drive's own server sends `no-store` and never bumps a version. **Confirmed (round 3).** It has survived two hostile reviews and `tools/update-drive.mjs`; amendments 6 and the PWA section were still describing the worker it replaced, and now describe this one. The prose that specified `network-first index.html` and `skipWaiting` is superseded wherever it still appears in this document — a maintainer who "restores" either re-introduces the measured unrequested navigation 3.1 s into a sum (r3-deploy-pages-03).

11. **Icons: `any` and `maskable` are two different images (round 1, fixer 2).** Amendment 4 says the manifest points at the PNGs with `purpose: "any maskable"` because the artwork sits inside the central 80 %. It does not: rendered without its plate, the art reaches 0.883 of the half-width and the maskable safe circle is 0.800, and the shipped PNGs have 3.99 % fully transparent corners (`icon.svg` draws a rounded plate; `make-icons.mjs` screenshots with `omitBackground`). `assets/icon-maskable-192.png` and `-512.png` now ship alongside: full-bleed opaque plate, art scaled 0.85 about the centre (reach 0.751). The four existing PNGs keep their rounded plate and `purpose: "any"`. `tools/make-icons.mjs` renders both families and gates them — zero transparent pixels, and nothing drawn past 0.800 of the half-width.

12. **Round 2 of the hostile review (2026-09-08).** Where a sentence below still says otherwise, this wins.
   - **The short-landscape ride is a three-row grid whose panel spans all three rows** (`'top panel' / 'display panel' / 'shaft panel'`), and `--cell` is `clamp(48px, (var(--vh) − var(--panel-chrome)) / 5, 56px)`. Amendment 8's budget applies sideways too: the panel used to be pinned at `--cell 48 / --gap 4 / --display 60` inside a row only `vh − display` tall, so it needed 324 px of viewport height — arithmetic done against the DEVICE height. A 360 × 640 Android in Chrome landscape gets ~304 px and a 320 × 568 iPhone in Safari gets ~276, and `#app` is `overflow: hidden`: GO measured 32 px and then 4 px of its 48, with no scroll anywhere and nothing on screen saying to turn the phone back. Under the 258 px that five 48 px keys and their gaps need, the panel scrolls inside its own box rather than putting a key off screen, and the keys sit at the bottom of the column (`align-content: safe end`). §13's landscape turns are now the BROWSER-visible heights (667 × 331, 640 × 304, 568 × 276, 568 × 232) — the same lesson `tools/phone-drive.mjs` records for the portrait profiles, applied to the turns that had escaped it. A short PORTRAIT window under 420 px (a floating or split-screen window, never a phone held upright) gives the panel the same scroll.
   - **`Bigger text` is a type scale, not a body font-size.** Every child-facing size is `calc(var(--body) / 18 * N)`; 67 absolute `font-size: Npx` rules made the toggle a no-op on every screen except the Grown-ups page it is turned on from — measured, the lobby, picker, Rules card, Fact Book and the whole ride were pixel-identical with it on and off, so a parent watching the labels grow under their finger got a false confirmation.
   - **The HINT drawing is sized to the box it is given.** `.hint` is `height: max(64px, 46%)` of the shaft, and `numberLine`/`dotArray` derive their viewBox HEIGHT from the box's aspect so the drawing is width-limited and fills it. A fixed 320 × 110 viewBox inside 46 % of an 82 px shaft letterboxed the whole thing into 16 px: the 0–10 tick labels rendered at 2 CSS px on a 320 × 454 phone. Below 34 px of box the worked line takes over. §13's `hops` check counted `<path>` elements and could not see any of this; the drive now measures the PAINTED label height (≥ 9 CSS px) and how much of the width the drawing fills.
   - **A comeback may not follow a comeback, and a sum may hold one pending pair.** §4's override still beats the ring and the same-answer rule, with two limits. `afterAnswer` de-duplicates the queue by key (serving clears every DUE entry for that key; a fresh miss replaces the key's pair instead of stacking a third and fourth copy), and `ctx.lastComeback` stops two comebacks in a row. Measured before: the identical sum twice running on 8.5 % of questions at 60 % accuracy, 31 identical questions in a row once one key filled the 12-entry queue, and — because a struggling child always had something due — every question a comeback with the pool collapsed to five sums and no new sum ever drawn again.
   - **A promotion may not narrow the question set.** Skyscraper step 1 was Office Block step 3's mul/div rows verbatim (tables 2–10, max 100), so all 126 of its reachable sums were already reachable at Office step 3, which serves 5 500 more. §4's table changes: Skyscraper step 1 is `tables to 12, ÷ exact to 100` and step 2 keeps the missing-factor form and widens division to 144. Megatall's tag is `big numbers, and below zero`, because it is the level that introduces negatives and a parent picking it was told nothing.
   - **A level is a maths band, not a height.** The `floors: 3|6|9` field every level declared was read by nothing; it is gone. Every building is G, 1–9, R, as §2 says. Custom's tag names where its floor moves live (`▲▼ inside the building, 0 to 10`), which is the same relaxation §4 already documented for × and ÷.
   - **`0 + 0` and `0 − 0` are not questions**, and the first sum of a brand-new save never answers 0. 0 stays the teaching point at Corner Shop steps 1 and 2 that `levels.js` describes.
   - **The save carries a monotone `writes` counter.** `main.js` refuses to overwrite a record whose counter has moved past the one this tab last wrote, adopting what is there instead, and a `storage` listener re-hydrates an idle tab from a foreign write. A second tab opened from a bookmark and never touched wiped three buildings of play the moment it was backgrounded — total, silent, and needing no tap in the offending tab. A refused write (Safari's Block All Cookies, a full quota) now says so on the lobby and in Grown-ups, beside the save code that rescues it.
   - **`sw.js` carries `BUILD`, a hash of every file it precaches** (`tools/build-stamp.mjs` writes it, `test/version.test.js` goes red until it matches), and the cache name is `be-<VERSION>-<BUILD>`. The browser's update check compares sw.js's bytes and nothing else, so a content-only deploy — three of the last four — installed no worker and replaced no cache: measured, five opens with an empty HTTP cache and the only request that ever left the browser was `/sw.js`. `?reset=1` also re-fetches every precached path with `cache: 'reload'`, because the deletes alone were refilled from the browser's own HTTP cache within 266 ms.
   - **`facts.seen` holds one entry per fact**, most recent last, and the missed-fact clock moved to `history.count` (`pickFact` takes it as a seventh argument). The list — and the BE1- code a grown-up is told they may have to copy by hand — grew on every answer including repeats. `TRIVIA_LIMITS` gains `maxNumber`, which bands the arithmetic a passenger asks by the same ladder the level tables use.
   - **The Rules card is reachable from the lobby** (`[data-nav="rules"]`, a new value in §12's DOM contract), the bell key carries the word RULES, and the card names the ▲▼ operators and where the bacon goes. `▲ means go up: add.` also rides under the sum itself whenever one is on screen — a quarter of first-ever questions use a glyph the card never defined, while the same two glyphs mean DIRECTION on the hall calls and the lantern of the same screen. An adaptive step change says so in words in the band that carries `Try once more.`
   - **One colour for the button that carries you forward**: GO blue, on the panel and on every sheet. Sage now means one thing only — a state that is ON. `Ride` was blue in the lobby and green on the Rules card one tap later.
   - **Amendment 1's claim about the two checkers is narrowed to what the record shows**: 65 of the 67 items were refuted against a document the confirming checker did not read; `elevator-engineering-infrared-light-curtain` and `elevator-records-space-elevator-orbit-height` were checked twice against the same source, and `test/trivia.test.js` names them so a third cannot join them unremarked.
   - **Small ones:** a counted run keeps a non-breaking space before its last number; the Repair card says nothing about an entry that does not exist; `normaliseRide` clamps the ride's counters as well as its geometry; `load-facts` re-validates its payload; `validProblem` refuses an answer wider than the keypad can type; a plaque is hung once (`PLAQUES` holds numbers and `state.plaques` strings, so every roof re-awarded every plaque already on the wall); the landing's hall call lights while the car is called; a disabled floor key answers the press by re-stating which button is lit; digits, Backspace and Enter work from a paired keyboard; the update chip speaks the game's register and can be put away; the fact and rules sheets show that there is more to read; `.page` and `.sheet .body` keep pinch-zoom; and a wrong path lands on `404.html` with a way back.

13. **Round 3 of the hostile review (2026-09-08).** Where a sentence below still says otherwise, this wins.
   - **▲ and ▼ are operators on the NUMBER, not instructions to the car.** The gloss read `▼ means go down: take away.` while a correct answer sends the car UP one floor and the only time the car obeys a ▼ is the fall onto the spikes, with the same glyph on the lantern and the hall calls in the same frame. The operators stay (§4 ships them as the elevator-native form, and dropping ▼ leaves ▲ with the identical clash); the sentences change. The band reads `▲ is add: the number goes up.` / `▼ is take away: the number goes down.`, and the Rules card's picture reads `▲ = add, ▼ = take away`.
   - **The trivia answer is named the same way on both screens.** The display band says `The answer is C.`; the fact card now says `The answer is C: A lift.` and `You chose A: A trolley.` The three letters live once, in `src/trivia.js` (`CHOICE_LETTERS`), because the card could not reach them in `panel.js`.
   - **The generator's 50-retry fallback may not serve the sum just answered**, and the kind-run guard is skipped on a step that has only one kind (Custom with one operation, where it was permanently true and rejected every attempt whatever the pool size). `sameSeen` is a five-question fuse, not a latch held for the building.
   - **A promotion may not narrow the question set — measured on the SIZE of the pool, not only its freshness.** Amendment 12's guard asserted ≥ 10 % fresh and a non-falling ceiling and never compared the two pools, so Office 3 → Sky 1 sat at 147 keys against 5 676. Skyscraper step 1 carries the ± rows Skyscraper step 3 already had, reaching its own 144 ceiling.
   - **The ladder adapts DOWN as well as up.** `struggleRun` counts buildings finished on step 1 with ≥ 5 falls, and after two the SAME roof card offers `LEVEL_ORDER[idx − 1]`. An offer is not the silent easing §4 dropped: the child answers it, and `Stay` is still the primary button.
   - **The beat before a fall is not the reward display minus a tick.** The true answer is drawn in `--ink` (`#question.truth`), not in the child's own blue, and the message band says `you pressed 7`. No cross, no red, no punishing copy — BRIEF requirement 7 stands.
   - **The roof card always names a next goal while one exists**: `lunchboxMilestone` falls through from PARTS to the plaque ladder.
   - **`.page` and `.ride .panel` carry `.sheet .body`'s scroll cue**, and the roof card's buttons are sticky to the bottom of their scroller. A screen that continues past the fold must say so — a card ending in clean paper with no control on it is a dead end at the reward moment.
   - **The Rules card's compaction tier starts at 700 px, not 620** (it needs 662 px at full size, and never fits at 320 wide), so an installed Home Screen icon at 360 × 640 does not slice `There is no clock.` in half. `node tools/phone-drive.mjs` now runs the layout instrument a second time at the DEVICE heights.
   - **The menu screens get a landscape layout too.** The lobby hero yields its art under 500 px of height, so `Ride` is not a 26 px sliver; the ride's top bar drops the level name there, as the 340 px rule already does.
   - **A transient belongs to the panel it was written for, not to its timer.** `ui.transient` is cleared whenever the phase, the screen, the problem or the typed entry changes: the dead-floor-key line is an instruction about a panel that is no longer on screen.
   - **The two-tab counter protects BACON, not the child's tap.** `save()` adopts a newer record when this tab is at rest, or when that record holds more bacon; a tab that is mid-building keeps the action that produced the save. Discarding it threw away correct answers and dumped the child in the Lobby.
   - **Only the app root is the app.** `sw.js` answers `index.html` for the scope root alone; any deeper navigation goes to the network so Pages serves `404.html` (precached, so it works offline too). `404.html` is in `ASSETS` and `RESET_ASSETS`.
   - **The content gate reads the citations the child is shown.** `sources[].title`, `.url` and `.quote` are scanned against a wider list than the fact text (memorial vocabulary included, `grave` deliberately excluded: Elisha Graves Otis). An item declares `maths: {max, exact: false}` when answering it leaves the integers, and the number band refuses it below Megatall.
   - **Grown-ups prints the BUILD as well as the VERSION**, read from the name of the cache serving this tab (it cannot be stamped into `src/version.js`, which is one of the files BUILD hashes).
   - **Small ones:** the storage warning renders above the fold on the lobby; the unlit floor digits read at 4.6:1; the recovered number on a Repair card is drawn in the clause's teal; the telescopic doors are a wide slow leaf and a narrow fast one, recognisable shut; the fall's indicator counts the floors it passes; the ▼ hall call lights on the victory descent; a retry may not follow a retry in `pickFact`; passengers are drawn only when a bank is loaded; the Rules card names the ding only when sound is on; `assets/favicon-32.png` is referenced; Custom's tag names the table its × and ÷ knobs actually built; no answer is more than 8 characters longer than the longest distractor beside it.

14. **The content round (2026-09-08) — the lead's ruling, and what shipped under it.** Where a sentence below still says otherwise, this wins.

   Two independent reviewers measured the same wall in round 3: *"All three Workshop parts are owned by building 7, the last level offer lands at building 8, and from building 9 the roof card carries no new line at all. Every building yields exactly 16 bacon, and Megatall is the same G-1-9-R shaft with the same one-floor hop as Corner Shop. Roughly 20-25 minutes before the elevator stops rewarding an elevator-loving child."* And: *"A child stops at the roof of the second Corner Shop, around question 20, if nobody shows them the level chip: nine identical 2.7-second rides whose only variable is the sum."*

   **The ruling.** Predictability is about the RULES, not about sameness. The loop, the timings, the failure behaviour, the copy and the controls stay identical everywhere; nothing becomes random, timed or surprising; nothing is ever taken away. Amendment 12 stands — a level is a MATHS BAND, not a height — so the maths level is never coupled to the building's shape. Variety therefore comes only from what is **additive and inert to the loop**: what the elevator LOOKS like, what the child can earn and choose, what the Fact Book and Workshop hold, and what the roof says. The elevator special interest is content: real mechanisms, real parts, real vocabulary, all true and all sourced. Anything earned is earned by playing, never bought, never lost, never gated behind a timer, and the child can always see what the next thing is and how far away it is.

   **THE GAME OWNS THE SHAFT; THE CHILD OWNS THE CAR.** This is now canon. Nothing the child has equipped is ever replaced, swapped, auto-equipped or re-locked by anything the game decides. The roof card NAMES a new part and draws it; the car they rode up in is the car they ride down in, until they tap in the Workshop.

   - **`src/parts.js` replaces the six-entry `PARTS` list in `state.js`** (re-exported under the old name, so there is still exactly one list). 24 parts across seven slots — doors, indicator, car, chime, door edge, guides, car buttons — with 17 earned. Thresholds sit on the 16-bacon-per-building grid at offset −4, so each one lands at a ROOF: 12, 28, 44, 60, 76, 92, 108, 124, 140, 156, 172, 188 are buildings 1 to 12, then 204, 236, 284, 332, 380 at buildings 13, 15, 18, 21 and 24. The three ids that shipped before (`doors-telescopic`, `dotmatrix`, `two-tone`) keep their spelling and their thresholds only ever move DOWN (18 → 12, 50 → 28, 100 → 60): a lower threshold cannot un-earn anything. `PLAQUES` gains 3000 and 5000.
   - **Every part is a drawing, and some are a sound.** Five door sets, five indicators, five car finishes, three chimes, two door-edge devices, two guide types, two car-button panels, all in inline SVG in `render/shaft.js` and `render/screens.js`. Guide rails are drawn down the shaft, because the guides slot had nothing to grip. The doors are a list of `{node, travel}` per set, so a two-speed door really runs one leaf at twice the other's speed and a collapsible gate really concertinas. `audio.js` gains ONE voice, the brass arrival gong, which replaces the ding's voice at the triggers that already exist — same peak, same budget. `ding2` now plays the fitted chime twice instead of the plain 880 Hz, so the ADA count (one up, two down) holds in every set.
   - **The Workshop is the second Fact Book.** Every row carries the part's drawing, its full name, and — locked or not — its exact distance in strips (`at 172 bacon · 30 more`). No mystery boxes, ever. An `ⓘ` beside each row opens a part card: the drawing large, one true sentence, `Source:` lines as plain text, `Got it`. `#workshop-next` names and draws the next part at the top of the page.
   - **`data/parts.json` and `data/climb.json` go through the SAME gate as the fact bank.** `src/gate.js` is new and holds the two word lists and the citation check; `trivia.js`, `parts.js` and `climb.js` all import it and none of them re-states the comparison. Every quote in both files was fetched from the url beside it. `grave` stays out of the citation list (Elisha Graves Otis).
   - **The Climb** (`src/climb.js`) is the ladder that does not end. Ten real buildings by floor count — Haughwout 5, Flatiron 22, Woolworth 60, the Shard 72, Petronas 88, Taipei 101, the Empire State 102, the Willis Tower 108, the Shanghai Tower 128, the Burj Khalifa 154 — against the floors the child has ridden UNDER POWER (the one-floor rides, the express out of the pit, the victory descent; a free fall is not a ride and is neither counted nor punished). Past the tallest it counts Burj Khalifas, for ever: `climbGoal` may never return null and `remaining` may never be ≤ 0. Two claims were re-sourced rather than softened before shipping — the Petronas deck parity and the Shanghai Tower record with the year it ended.
   - **The Logbook** (a new screen, `data-nav="logbook"`) is the collector's shelf: a numbered ticket per building, nine monotone records, and The Climb with the line and the source for every rung reached. **Falls, accuracy and percentages appear on NO screen the child can reach** — they are on the Grown-ups Progress block only. A number a child can see must never be able to go down. The tickets are DERIVED from `buildings`; an array of one entry per building would grow the hand-copied `BE1-` code without bound, which is the bug round 2 fixed once already.
   - **The Fact Book gains a count and a completion board** (`23 of 67 facts collected`) plus a ghost tile per unheard fact, with `All / Elevator / Numbers` and `Newest / In order` chips persisted as settings. Neither control changes a fact, a count or a distance.
   - **Save.** `PERSIST` gains `records` (four integers). `migrate`'s three hard-coded slots become a loop over the ladder's own slot list: an old save keeps every choice it made and gains the four new slots at their defaults, an unknown or unearned id still falls back, and a junk unlock id is dropped. `settings` gains `bookKind` and `bookOrder` through the existing `oneOf`. `test/content-round.test.js` migrates a real pre-round save and holds `encodeCode` under 9 000 characters at a large reachable state.
   - **THE INERTNESS GATE, which nothing additive ships without again.** `test/parts-inert.test.js` runs the same 300-action script at seed 42 for every one of the 24 parts and compares a behavioural TRACE — phase, screen, problem key, tray, lunchbox and every effect, in order — byte for byte against the shipped defaults, then deep-equals the final state minus `equipped`/`unlocks`/`records`. A final-state comparison alone cannot see an effect that fired in a different order. It also asserts statically that `equipped` is read in `state.js` in exactly one branch (`case 'equip'`), that `records` is only ever written through `tally()`, and that `math.js`, `levels.js`, `explain.js`, `elevator.js` and `trivia.js` do not know either field exists. `tools/drive-scenarios.mjs`'s `parts-inert-drive` is the same question in a browser: seven identical sums and the same wall clock on the defaults and fully fitted.
   - **The gap instrument.** Pinning that thresholds are unique and increasing does not stop a future edit re-clustering them into building 7, which is the exact defect this round fixes. `test/content-round.test.js` walks 120 buildings, records the building index of every unlock, plaque and Climb rung, and fails if the ladder ever goes quiet for longer than 16 buildings — which is what it delivers today (buildings 31–47, between Burj × 2 and Burj × 3, and even there the roof card counts down to both). Tighten that number when the ladder gets denser; never loosen it.
   - **The forward line, extended.** `test/content-round.test.js` asserts that at EVERY lunchbox from 0 to 6 000 and every floor count from 0 to 20 000 at least one of the two ladders names a next thing with a distance — round 3's r3-elevator-feel-02 assertion widened so it can never go silent again. Both lines print on the lobby (below the buttons: two extra lines in the head put `Ride` at 36 px of 72 at 568 × 276, which is r3-mobile-ux-3 with new words in it), on the roof card, and in the Workshop.
   - **What was CUT from the winning proposal, and why.** The machine and pit slots (gearless, MRL, oil buffers, the overspeed governor) are not in this pass: they are new geometry in `render/shaft.js`, the one file that animates the fall, and both judges named them as the first cut. They land alone, behind the fall's own identity assertion. The twelve-building ROUTE is rejected outright — it terminates, it rotates the world under the child on the screen that carries the maths, and amendment 12 already ruled on it. Renaming the levels from building names to maths bands is rejected: it takes away names the child has had for a week, and the tag beside each name is already the band. `pin a building` is rejected as a second navigation concept. `history.missed` (the child's last ten wrong presses, persisted) is rejected as the only new state whose content is their failures.

15. **Round 4, hostile review (2026-09-08) — binding.**
   - **The roof card's controls sit BESIDE the scroller, not inside it.** Amendment 13's sticky
     `.roof .page > .stack` fixed "both buttons 0 px on screen" and became an occluder: an opaque
     `--paper` block at `z-index: 3` painted over the card it was pinned inside, hiding the part
     unlock outright at 320 × 454, slicing the lunchbox total through its digits, covering one or
     both forward-goal lines on every shipped phone profile, and — the worst of it — drawing the
     level offer UNDERNEATH the two big buttons, where a real tap at the centre of `Yes` dispatched
     `to-lobby` or `next-building`. The roof is now the two-band shape `.sheet .body` / `.sheet
     .foot` has always used: a scrolling `.page` and a sibling `.foot` holding the offer and the two
     controls. Nothing may be pinned INSIDE a scroller over content the child has not read.
   - **The offer moves into that foot, and it says which way it points.** `Try Hotel?` read
     identically whether it was a promotion or a rescue and never named the band; it is now
     `Ready for Hotel — numbers to 20?` / `Back to Skyscraper — times tables?`, with `Stay` still
     the primary button. The roof card carries `dir`, and `tools/drive-scenarios.mjs`'s
     `roof-offer` scenario plays to a card that has one and asserts `elementFromPoint` at the
     centre of `Yes` returns `Yes`, at four geometries.
   - **A comeback is banded by the step that serves it.** `makeProblem` read the queue before
     `stepOf()`, so a due entry ignored the step's kind list and its ceiling: `9 + ▮ = 10` at
     Corner Shop step 1. A due entry the current step cannot legally ask waits (`inStepBand`), a
     key stops re-arming after `MISS_RETIRE` misses in a row, and picking a building — the same one
     included — always clears the queue.
   - **The ladder remembers a demotion.** One persisted field, `demotedFrom`: the level a rescue
     took the child out of needs `UP_AGAIN` clean buildings, not two, before it is offered again.
   - **Megatall step 1 is a bridge.** 3-digit ± one- or two-digit with at most one column regroup,
     plus the 2-digit ± rows the child proved at Skyscraper step 3; the old step 1 (two regroups) is
     step 2. It is the step a promotion lands on AND the step a fall cannot leave, and it served 0 %
     of its sums entirely under 100.
   - **The keypad loses a ROW before it loses a KEY.** Below 257 px of landscape height the keypad
     is four columns — the 3 × 3 digit block untouched, HINT/±/⌫ in a right-hand column, 0 and GO on
     the last row — instead of five rows that do not fit and a GO sliced in half at the fold.
   - **`install` precaches per file, not with `addAll()`.** `cache: 'reload'` stays (amendment 10's
     reason is unchanged); what changes is that one cancelled request no longer rejects the whole
     install and leaves that visit with no offline cache at all. `Promise.allSettled` over individual
     `cache.put`s, the failed paths named in the console, the rest filled on demand by the fetch
     handler. `tools/phone-drive.mjs` treats a service-worker-initiated `requestfailed` as a warning,
     so a real layout regression can never hide behind that flake.
   - **The Rules card states the rule that actually runs.** It reads `settings.secondTry`, and it
     shows a third worked example with the blank in the middle; the display band glosses `▮` the
     way it already glosses ▲ and ▼.

16. **Round 5, hostile review (2026-09-08) — binding.**
   - **The update chip is placed against the LAYOUT, not against the viewport.** `.chip-update` was
     `position: fixed; left: 50%; top: safe-top + --topbar + 8px`, which is the shaft in portrait and
     the KEYPAD in landscape, where the panel is a 288–320 px right-hand column and the display band
     is row 2 of the left one. Measured: key 7 100 % covered at 568 × 276 with its own centre
     returning the chip's take button, so a tap on a digit posted `skip-waiting` and reloaded the tab
     mid-sum; keys 4 and 5 at 568 × 232; HINT at 667 × 331; and the answer blank 100 % covered at all
     five landscape turns. In landscape the chip is pinned into the left column below the display
     band. The chip scenario now measures every panel key and the blank at those five turns, and any
     OVERLAP fails it, not only a stolen centre (r5-mobile-ux-1).
   - **A step change names the variable that moved.** `Bigger numbers now.` / `Smaller numbers for a
     bit.` were derived from the sign of the step alone and are false more often than true at three
     of the ten step-ups and two of the step-downs (Office Block 1 → 2 drops `tens ± tens`, max 100,
     for the 3s and 4s, max 40: mean largest number 60 → 43 under a sentence saying it rises). The
     steps do get harder; the sentence named the wrong variable. `math.stepNote(level, from, to)`
     reads the two tables: `Carrying now.` / `Times tables now.` / `Sharing now.` / `Missing numbers
     now.` / `Below zero now.`, `Bigger numbers now.` only where the ceiling really rises,
     `Easier sums for a bit.` for a step down that is not smaller, and `New sums now.` for a step up
     that changes none of those things. `STEP_NOTE_WORDS` is exported beside it so an instrument
     never keeps its own copy of the list (r5-math-02).
   - **A level with ONE band announces nothing and draws no ladder.** Custom builds a single step and
     `stepOf` clamps, so its steps 1, 2 and 3 are the same table — and the pips still moved, the band
     still said `Bigger numbers now.`, and the chip told a screen reader `step 2 of 3`. `stepbar()`
     takes the level's step count and returns nothing at one; `stepNote` returns `''` (r5-code-hostile-02).
   - **A worked line may not add nothing.** `explainAdd` took the three-column split whenever EITHER
     operand was 3-digit, so with the second under 100 the first line — the only line HINT shows —
     was `X00 + 0 = X00`, on 41 % of Megatall step-1 draws. The split is taken only where every
     column has something in it; otherwise the smaller operand is added in the places it actually
     has. `explainSub` has filtered its empty columns since it was written (r5-math-01).
   - **The ladder's memory accumulates.** `demotedFrom` was cleared when the promotion back was
     accepted, so a child who sits between two buildings bounced on a fixed six-building cycle for
     ever. `demotions` counts the rescues out of that level and each one buys another `UP_AGAIN`
     clean buildings before it is offered again, capped at four — an offer may never become a
     permanent gate (r5-math-04, amending amendment 15's ruling on the same field).
   - **The one rescue at the bottom of the ladder names what Grown-ups can actually do.** The roof
     help line promised numbers `smaller still` than Corner Shop step 1, and no reachable Custom
     setting delivers that: swept all 127 operation subsets against every stepper value, the lowest
     ceiling is `ADD_FLOOR` = 6 against Corner Shop step 1's 5. What Custom does give is FEWER
     SHAPES, and that is what the card offers now (r5-math-03).
   - **On the reward card, while an offer stands, the only primary is an answer to it.** `Next
     building` carried `btn primary tall wide` — the game's one "tap this" idiom — so two blue
     primaries sat 8 px apart meaning different things and the bigger one did not answer the question
     above it. `Stay` is still the primary and the default (§4); `Next building` drops to a plain
     button until the question is answered, and the question and its two answers are drawn as one
     bordered block. Nothing is gated: tapping past the offer still defers it to the next clean roof
     (r5-autism-fit-1, r5-elevator-feel-01).
   - **A tag may not undercut the largest number its own steps can print.** Hotel read `numbers to
     20` and its step-3 × row reaches 10 × 10; it reads `numbers to 20; tables 2, 5, 10 (to 100)`
     (r5-math-07).
   - **The runtime content banks are carried by ONE named list.** `pool`, `partsPool` and `climb` are
     content, not progress, and `import`, `reset` and `adoptDiskSave` each carried the first by hand
     and dropped the other two — for the whole session, on a paste, a reset OR a second tab, so the
     Workshop read "The card for this part did not load" for all 24 parts and the Logbook's Climb
     section rendered empty under its own heading. `state.carryBanks()` (r5-code-hostile-01).
   - **The build stamp is answered by the worker serving the tab.** Reading `caches.keys()` and
     taking the greatest `be-` name picked by hex ordering of the BUILD hash while two caches
     coexist, and named nothing at all on a first-ever visit. `sw.js` replies to a `which-build`
     message with its own `CACHE` literal, and the page asks again on `controllerchange`
     (r5-deploy-pages-1, r5-deploy-pages-2).
   - **Small ones:** ⌫ is disabled on an empty entry, like GO (a lit key that does nothing is a dead
     key); the first sum a save ever shows is never one whose answer is already printed in it; the
     hint's tick labels scale with the card and the drive holds them at 14 CSS px; the ride's top bar
     keeps the building name at 320 px and the step pips off the `Lobby` label sideways; the trivia
     panel carries `.sheet .body`'s scroll cue; a missed passenger is answered in words (`0 bacon
     this time. Nothing is lost. This passenger asks again later.`) rather than by the absence of the
     `+2 bacon` line; both roof exits bank the tray; the display band guards `r.problem` in every
     branch; the lobby's parked car shows no direction arrow; the keypad is capped at 460 px on a
     viewport over 600 px wide and over 500 px tall (a tablet, where the landscape grid does not
     apply and each key was 333 x 56); and the save-code gate PLAYS the reducer instead of hand-building a
     state with the two fields that dominate the blob left empty.

17. **Everything else** in the sections below is the spec. Where two sentences below still conflict, the Module contract (§12) and the Verification plan (§13) win, then §2 Core loop, then the rest.

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
| 6 | Custom (Grown-ups) | ops, min, max, negatives knobs | one step: no step bar, no step-change sentence | |

Data in `src/levels.js`, one row per level and step, not a formula; a 20 000-draw test per row pins it. Operands 0 and 1 only at Corner Shop; no negatives below Megatall; division always exact. Default: Corner Shop, step 1.

**Adaptive rule** (visible, never silent): a three-segment step bar under the level name, on levels that have three steps, and a sentence in the display band naming what changed (`Carrying now.`, `Times tables now.`, `Sharing now.`, `Missing numbers now.`, `Below zero now.`, `Bigger numbers now.` only where the ceiling rises, `Easier sums for a bit.` / `Smaller numbers for a bit.` on the way down). 3 correct in a row → step +1 (max 3); a fall → step −1 (min 1), once per building at most. Levels never change on their own: two consecutive buildings at step 3 with ≤ 1 fall → the roof offers `Ready for Hotel — <tag>?` (`Yes` / `Stay`, default Stay, and the only primary on the card while the question stands). `Adaptive: off` pins a parent-chosen step. Each kind keeps its last 8 results; a kind at 8/8 is drawn at weight 0.25, the rest at 1.0. **Decision:** Design 3's below-40 % easing is dropped (judge 3: no silent difficulty change).

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

Portrait, one thumb. `#app {position:fixed; inset:0; height:100dvh}` with a `100vh` fallback; padding from `env(safe-area-inset-*)`; `viewport-fit=cover`; `overscroll-behavior:none`; `touch-action:manipulation`; no `maximum-scale=1`. Reference viewport 390 × 664 (iPhone 14 with Safari bars): top bar 48 px; shaft ≥ 200 px (flex); display band 90 px; panel 3 × 5 cells of 118 × 56 px, 6 px gaps (48 px minimum everywhere); GO always bottom-right, two cells wide. Landscape under 500 px tall becomes two columns, shaft left, panel right — no rotate blocker; the panel is the full-height right column and its cell is computed from the real viewport (amendment 12).

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

**Give the parent the URL WITH its trailing slash.** `https://<user>.github.io/bacon-elevator/`,
never `…/bacon-elevator`. The no-slash form is answered by a 301 from Pages, and a redirect outside
the worker's scope cannot be served from the cache: offline it is the browser's own error page,
which a non-reading child cannot leave. Every practical entry point already carries the slash (the
Home Screen icon uses `start_url "./"`, a bookmark of the loaded page keeps it, and `404.html`
computes it), so this is the one hand-typed case — and it is documentation, not code: nothing
outside the scope can be cached (r4-deploy-pages-01).

PWA on the Pages subpath: manifest `start_url "./"`, `scope "./"`, `display standalone`, `orientation portrait`; `sw.js` registered as `./sw.js`, cache-first index (amendment 10 — the network-first index and `skipWaiting` this line used to specify are gone), cache-first relative assets, cache `be-<VERSION>-<BUILD>` (VERSION from `src/version.js`, BUILD a hash of the precached files), the worker WAITS for the chip's tap, older caches deleted on `activate`, a quiet `Update ready — tap to reload` chip; `?reset=1` clears save and caches. A navigation that is not the scope root is not the app: it goes to the network, so a mistyped path lands on `404.html` with a way back rather than on the shell's own blank page (amendment 13).

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

**DOM contract** (what the drive relies on): `#app[data-screen]` ∈ `lobby|picker|rules|ride|roof|factbook|workshop|grownups`; `#app[data-phase]` mirrors `state.phase`; `#question` (display band, `aria-live`, the current question or status text); `#stepbar[data-step="1|2|3"]`; `#indicator[data-floor="P|G|1…9|R"][data-arrow="up|down|none"]`; `#car[data-motion="idle|moving|falling|hoisting"]`; `#doors[data-state]`; `#tray` and `#lunchbox` (integer text); panel buttons `button[data-key="0"…"9"|"back"|"go"|"hint"|"sign"]`, `button[data-floor="G"|"1"…"9"|"R"]`, `button[data-door="open"|"close"]`, `button[data-bell]`, `button[data-choice="0|1|2"]`, `button[data-continue]`; every tappable element carries `data-tap`; screen buttons `[data-nav="ride|lobby|rules|picker|factbook|workshop|grownups"]`, `[data-level="corner|hotel|office|sky|megatall"]`, `[data-setting="…"]`. Hook: `window.__bacon = {state(), version, timescale}` exists only when the URL has `?drive=1`; `?seed=N` seeds; `?fast=1` sets timescale 0.1; `?reset=1` clears.

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
