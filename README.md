# Bacon Elevator

**Play it: https://syntaxswine.github.io/bacon-elevator/**

Open it on a phone. Nothing to install; "Add to Home Screen" works and it plays offline
after the first visit.

A maths game for a child who loves elevators. You are the operator of the lift in the Bacon
Building. Press the lit floor button, work out the sum on the panel, and the doors close, the
car hums up one floor, the indicator ticks, the bell rings once, and a strip of bacon slides
in. Get it wrong and the cable slips: the car drops onto the springy spikes in the pit, the
safety brake catches it, and a repair card shows how the sum works before you answer it again
and ride straight back up.

**Nobody is hurt. No bacon is ever lost. There is no clock.**

## What is in it

| | |
|---|---|
| Maths | Five buildings from "numbers to 10" to "big numbers", three steps each, plus a Custom level for a grown-up to set. Adding, subtracting, times, sharing, missing numbers, and up/down floor moves. |
| Trivia | 67 facts about elevators and numbers, asked by a passenger who steps into the car. Every one is true, sourced, and shown with its citation. A passenger's question can never make the lift fall. |
| Parts | 24 real elevator parts to earn and fit to your own car — telescopic doors, a half-moon dial, a nixie tube indicator, a brass gong. Each is a real mechanism, correctly named and drawn. |
| The Climb | Your floors ridden, measured against real buildings: the Haughwout Building, the Flatiron, the Woolworth, the Shard, and on past the Burj Khalifa without ever running out. |
| Logbook | A numbered ticket for every building, your records, and the facts you have collected. |

## For a grown-up

The **Grown-ups** screen (two taps on the gear) has sound and volume, speed, motion, bigger
text, second-try, passenger frequency, the level and its step, a Custom level, and a save code
you can copy to move progress to another phone.

Designed for an autistic child: predictable and consistent, no time pressure anywhere, sound
off until you turn it on, no flashing, big touch targets, plain literal wording, and a failure
that is brief, gentle and never uses a shaming word. Nothing is ever taken away.

## For a developer

Zero runtime dependencies, no build step, plain ES modules. Serve the folder and it runs.

```bash
npm install          # puppeteer-core, for the test instruments only
npm test             # node --test — the pure modules
npm run drive        # plays the game in real Chrome at five phone profiles
npm run headless     # the reducer alone, 10 000 questions per level
npm run serve        # http://localhost:8791/
```

`node tools/build-stamp.mjs` regenerates the service worker's cache key, which is a hash of
every shipped asset. **`npm test` fails until it matches** — that is what guarantees a
corrected fact actually reaches a child who already has the game installed.

Read `docs/BRIEF.md` for what was asked for, `docs/DESIGN.md` for the spec (its Amendments
section at the top overrides the body), `docs/TRIVIA.md` for the rule every fact must pass,
and `docs/REVIEW-LOG.md` for what six rounds of hostile review found and what was done about
it.

## Licence

MIT. The trivia sources are cited per item in `data/trivia.json`.
