# Bacon Elevator — the brief

Owner's words (2026-09-07), verbatim where it matters:

> i'm making a game for my autistic nephew to play. he loves math and elevators. he plays
> games primarily on his phone, the final work output should be on github pages so he can
> access it. you have to do math to make the elevator move. if you do the math wrong the
> elevator falls onto spikes at the bottom of the elevator shaft. the goal of the game is to
> collect bacon.

Follow-up:

> how about math and elevator trivia. follow the science rule in strict effect, we want the
> trivia to be accurate

## Hard requirements

1. **Phone-first.** Played on a phone, in a mobile browser, one hand, portrait. Must be
   excellent on iOS Safari and Android Chrome. No app store.
2. **GitHub Pages.** Static files served from `main` root by the legacy Pages builder
   (`.nojekyll` present). Zero build step, zero runtime dependencies, ES modules are fine.
3. **Math moves the elevator.** Correct answer → the elevator moves. The math is the
   control.
4. **Wrong answer → the elevator falls onto spikes** at the bottom of the shaft. This is the
   fail state. It is the owner's design; keep it, but it must be cartoon-safe for an
   autistic child (no gore, no screaming, no strobe, brief, recoverable).
5. **Goal: collect bacon.** Bacon is the score and the reward loop.
6. **Trivia — math trivia and elevator trivia — as a second question type.** Every trivia fact
   must be TRUE and SOURCED. "Follow the science rule in strict effect": each fact ships
   with its citation(s) in the data file, is independently fact-checked before it is
   allowed in, and an unverifiable fact is cut, not softened.
7. **Designed for an autistic child.** Predictable, consistent, no time pressure by default,
   no sudden loud sounds (sound opt-in), no flashing, clear rules stated up front, immediate
   unambiguous feedback, big touch targets, no punishing tone on failure. Elevator love is
   real: honour the details (floor indicator, doors, the ding, the button panel).
8. **Unknown age / math level.** Ship with selectable and adaptive difficulty so a parent
   or the child can set it; sensible default that starts easy.

## Process (owner's instruction)

Loop design → production → **hostile review** → fix, until a hostile review panel scores
the product **9/10**. Reviews are by fresh reviewers who see the artefact, not the
reasoning. A score must be defended with evidence (played it, ran it), never asserted.

## Conventions inherited from the owner's other repos

- Repo `Syntaxswine/bacon-elevator`, live at `https://syntaxswine.github.io/bacon-elevator/`.
- Commits as `StonePhilosopher`; auto-push; dense field-note commit messages.
- `npm test` = `node --test`; instruments live in `tools/`; `tools/serve.js` is the local
  server; `tools/phone-drive.mjs` drives the game headless in Chrome at phone viewports.
