# The trivia bank — how a fact gets in

Owner's rule (2026-09-07): *"follow the science rule in strict effect, we want the trivia
to be accurate."* Every fact the game shows is true, sourced, and was checked by two
independent readers before it was allowed in. An unverifiable fact is cut, not softened.

## The files

- `data/trivia.json` — what the game loads. `items[]` of
  `{id, category: "elevator"|"math", difficulty 1-3, question, answer, distractors[3], fact,
  sources[{title, url, quote}], verification[{lens, source_title, source_url}]}`.
- `data/trivia-audit.json` — the full record: every item with both checkers' reasoning, the
  rejected candidates and why, and the duplicates that were folded.

## How the first bank was built (2026-09-08)

1. **Research.** Six themed researchers (elevator history · elevator engineering · elevator
   records · elevator culture · number trivia · everyday-shape trivia), each required to fetch
   its sources during the session. Primary sources preferred: manufacturer histories (Otis,
   Siemens, KONE, TK Elevator, Hitachi, Mitsubishi), Guinness World Records, museums, ASME/ADA
   documents, GIMPS, MacTutor, Wolfram MathWorld, NIST. Wikipedia only ever as a second source.
   Anything that can rot (records, "largest known") carries an as-of year in both the question
   and the fact. 72 candidates.
2. **Confirm.** For every batch of four candidates, a checker had to fetch an *independent*
   source (a different website from the researcher's) and confirm the answer and every number,
   name and date in the fact text.
3. **Refute.** A second, hostile checker searched for contradictions, rot, distractors that could
   also be argued correct, questions that need a picture, cited URLs that do not actually say
   what was claimed, and anything unsuitable for an autistic child aged 7–12 (no deaths,
   injuries, accidents, entrapment or frightening content; reading age about 8–10). Default was
   *reject when in doubt*. Either checker could rescue an item with a small correction (an as-of
   year, a softer sentence, a better distractor); the corrected wording is what shipped.
4. **Both must pass.** 70 of 72 passed. Rejected: the "Otis filed the first push-button patent in
   1892" claim (specialist history credits John H. Clark, 1886) and the "safety jaws stop the car
   within about 6.5 inches" claim (one manufacturer's illustrative figure; code stopping
   distances depend on speed). Three near-duplicates researched by more than one theme were
   folded (Otis 1854, the Eiffel lifts' annual distance, the 21 m/s record), leaving **67 items:
   42 elevator, 25 maths.**

## Adding a fact later

Do not hand-edit `data/trivia.json` with an unchecked fact. Run the same three steps: source it
from a primary document you fetched, have one reader confirm it from a second website, have
another reader try to refute it, and record both in `data/trivia-audit.json`. A fact that only
one person believes is not a fact the game may show a child.
