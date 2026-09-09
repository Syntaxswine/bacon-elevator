# Handoff — 2026-09-08

Read this first, then `docs/DESIGN.md` (its **Amendments** section at the top overrides the
body) and the last section of `docs/REVIEW-LOG.md`.

## Where it stands

Live and playable at **https://syntaxswine.github.io/bacon-elevator/**. Pages serves `main`
at the repo root through the legacy builder with a `.nojekyll` file — **do not try the
Actions deploy path on this account**, it hangs.

`main` at the time of writing: **284 node tests green**, build stamp clean. Six rounds of
hostile review are done; the score has moved **5 → 6 → 7 → 7 → 8 → 7.25 (median of seven
lenses)** while the test suite grew 108 → 284 and the drive 28 → 105+ scenarios.

The owner's finish line is a **9/10 hostile review**. The loop's gate is median ≥ 9, min ≥ 8,
zero confirmed HIGH, twice consecutively.

## How to carry on

The loop is a Workflow script kept in the session scratchpad, not in the repo. Its shape,
if it needs rebuilding: seven fresh reviewers per round (autism fit · maths · elevator feel ·
mobile UX · hostile code reading · trivia truth · deploy) who must PLAY the game with
`tools/phone-drive.mjs` before scoring against an anchored rubric; every high and medium
finding then goes to three independent verifiers (reproducer · skeptic · child-impact judge)
and survives on two of three; lows pass through unverified; one fixer applies what survived,
must make `npm test` and the full drive green, and commits and pushes with a per-finding
message and a `docs/REVIEW-LOG.md` entry.

Reviewers must be given the artefact and **not** the reasoning behind it. That is the whole
value: four of them independently measured the round-1 layout defect that the author's own
instrument was blind to.

## Open work, highest value first

1. **The round-6 HIGH is unfixed.** The missing-number sentence overflows the display band and
   is painted under the keypad, sliced in half, on the default phone. Round 6's fixer committed
   before this one was handled; check `docs/REVIEW-LOG.md` round 6 for its exact repro.
2. **The maths lens is the laggard** (5 in rounds 4 and 6, 7 in round 5). Its findings are
   about the adaptive layer, not the arithmetic: the ladder oscillates for a child whose
   ability sits between two buildings, the Skyscraper → Megatall jump is 12.5× in operand
   size, and the sentence that announces an adaptation ("Bigger numbers now.") is false at
   four of the ten step transitions. Fix the ladder as a whole rather than one rung.
3. **The MACHINE and PIT part slots** (gearless traction, machine-room-less belts, oil buffers,
   the overspeed governor and its safety wedges) are designed but unbuilt. They land in
   `src/render/shaft.js`, the one file every round has kept byte-identical through the fall,
   so ship them with a frame-by-frame comparison of the fall.
4. **A free-ride / express mode** — riding to a floor already reached, for a bacon price. A
   fixer refused to invent it and handed it up; it is the best unbuilt idea in the round-4
   packet and needs an owner's ruling because it touches "maths moves the elevator".
5. **A real-phone check has never been done.** Everything is headless Chrome at real browser
   viewports. Home Screen install, iOS audio unlock, and rubber-band scroll want a human with
   an actual phone.

## Two rules this project learned the hard way

- **An instrument that models an environment must model what the environment gives you, not
  what the hardware is called.** The phone profiles used device screen heights; no mobile
  browser gives a page its device height, so the drive handed the layout ~100 px it never has
  and shipped a game where the child could not reach GO. Profiles now carry browser-visible
  heights and a second pass at device heights for the installed case.
- **A fix is pinned by an assertion of what it added; nothing guards what it spent.** Both of
  round 4's HIGHs, and round 5's, were earlier rounds' fixes. Write the counter-assertion in
  the same commit: *and nothing else became hidden, unreachable, or starved.*

## Loose ends

- `.candidates/A|B|C` (git-ignored) still hold the three original build candidates. A and its
  losing siblings were the source of the round-0 grafts; nothing needs them now, but they cost
  nothing and are the only record of the three-way build.
- The owner asked about using **a public-domain photograph of bacon**. A CC0 candidate was
  found and licence-verified (`Fried_Peppered_Bacon.jpg`, Wikimedia Commons, 765×534, CC0 1.0)
  but **not downloaded — it awaits the owner's yes.** The bacon is drawn once as an inline SVG
  `<symbol>`, so swapping in a photo is a one-file change, best offered as a Workshop skin.
