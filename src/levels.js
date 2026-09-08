// Level tables. One row per level and step, data not formulas (docs/DESIGN.md §4).
// `name` is the full name (lobby chip, picker, Grown-ups); `short` (≤ 6 characters) is what the
// ride's top-bar chip shows, which has only 43–70 px beside the step bar.
// A level is a maths band, not a height: every building is G, 1-9, R (docs/DESIGN.md §2), and the
// `floors: 3|6|9` field each level used to declare was read by nothing in src/, test/ or tools/.
// Dead data in the one file a maintainer reads to learn what a level IS, so it is gone rather than
// left looking like a knob. Making the buildings differ AS ELEVATORS is a v2 proposal, not a field.
// kind ∈ add|sub|mul|div|missAdd|missMul|up|down
// Each kind entry: {kind, weight, a:[lo,hi], b:[lo,hi], max, regroup, tables, ...flags}
//   a, b      ranges for the two operands (for div: b is the divisor, a/b the quotient range in `q`)
//   max       upper bound for every number shown (operands, sums, products)
//   regroup   true = must carry/borrow, false = must not, undefined = either
//   tables    the multiplier table(s) b is drawn from (mul/div/missMul)
//   double    add with a === b (doubles)
//   square    mul with a === b
//   tens      operands are multiples of 10
//   negatives answers may be negative (sub) — Megatall step 3 and Custom only
//   regroups  max number of column regroups for 3-digit ± (Megatall)
//   mult10    for 2-digit × 2-digit: one factor ≤ 25 or a multiple of 10

const K = (kind, weight, o = {}) => ({ kind, weight, ...o })

// The smallest ceiling Custom will build a +/- table under: below it the pool is a handful of sums.
export const ADD_FLOOR = 6

export const LEVELS = [
  {
    id: 'corner', name: 'Corner Shop', short: 'Shop', tag: 'numbers to 10',
    steps: [
      { kinds: [K('add', 3, { a: [0, 5], b: [0, 5], max: 5 }), K('sub', 3, { a: [0, 5], b: [0, 5], max: 5 }), K('up', 1, { a: [0, 5], b: [1, 5], max: 5 }), K('down', 1, { a: [1, 5], b: [1, 5], max: 5 })] },
      { kinds: [K('add', 3, { a: [0, 10], b: [0, 10], max: 10 }), K('sub', 3, { a: [0, 10], b: [0, 10], max: 10 }), K('up', 1, { a: [0, 9], b: [1, 10], max: 10 }), K('down', 1, { a: [1, 10], b: [1, 10], max: 10 })] },
      // step 3 is the top of the easiest building: 0 has been taught at steps 1 and 2, and `2 + 0`
      // is not a question. ▲ keeps a: [1, 9] so a floor move still starts somewhere.
      { kinds: [K('add', 2, { a: [1, 10], b: [1, 10], max: 10 }), K('sub', 2, { a: [1, 10], b: [1, 10], max: 10 }), K('missAdd', 2, { a: [1, 10], b: [1, 10], max: 10 }), K('up', 1, { a: [1, 9], b: [1, 10], max: 10 }), K('down', 1, { a: [1, 10], b: [1, 10], max: 10 })] },
    ],
  },
  {
    id: 'hotel', name: 'Hotel', short: 'Hotel', tag: 'numbers to 20; tables 2, 5, 10',
    steps: [
      { kinds: [K('add', 3, { a: [2, 18], b: [2, 18], max: 20, regroup: false }), K('sub', 3, { a: [2, 20], b: [2, 18], max: 20, regroup: false }), K('up', 1, { a: [2, 9], b: [2, 8], max: 10 })] },
      { kinds: [K('add', 3, { a: [2, 18], b: [2, 18], max: 20, regroup: true }), K('sub', 3, { a: [2, 20], b: [2, 18], max: 20, regroup: true }), K('add', 1, { a: [2, 10], b: [2, 10], max: 20, double: true }), K('down', 1, { a: [2, 10], b: [2, 9], max: 10 })] },
      { kinds: [K('add', 2, { a: [2, 18], b: [2, 18], max: 20 }), K('sub', 2, { a: [2, 20], b: [2, 18], max: 20 }), K('mul', 2, { a: [2, 10], b: [2, 10], max: 100, tables: [2, 5, 10] }), K('missAdd', 2, { a: [2, 18], b: [2, 18], max: 20 })] },
    ],
  },
  {
    id: 'office', name: 'Office Block', short: 'Office', tag: 'numbers to 100',
    steps: [
      { kinds: [K('add', 2, { a: [11, 89], b: [2, 9], max: 100, regroup: false }), K('sub', 2, { a: [11, 99], b: [2, 9], max: 100, regroup: false }), K('add', 1, { a: [10, 90], b: [10, 90], max: 100, tens: true }), K('sub', 1, { a: [20, 100], b: [10, 90], max: 100, tens: true })] },
      { kinds: [K('add', 2, { a: [11, 89], b: [2, 9], max: 100, regroup: true }), K('sub', 2, { a: [11, 99], b: [2, 9], max: 100, regroup: true }), K('mul', 2, { a: [2, 10], b: [3, 4], max: 40, tables: [3, 4] })] },
      { kinds: [K('mul', 2, { a: [2, 10], b: [2, 10], max: 100, tables: [2, 3, 4, 5, 6, 7, 8, 9, 10] }), K('div', 2, { q: [2, 10], b: [2, 10], max: 100, tables: [2, 3, 4, 5, 6, 7, 8, 9, 10] }), K('add', 1, { a: [11, 89], b: [11, 89], max: 100 }), K('sub', 1, { a: [11, 99], b: [11, 89], max: 100 })] },
    ],
  },
  {
    id: 'sky', name: 'Skyscraper', short: 'Sky', tag: 'times tables',
    steps: [
      // A PROMOTION MAY NOT NARROW THE QUESTION SET. Skyscraper step 1 used to be Office Block step
      // 3's mul/div rows verbatim (tables 2-10, max 100), so every one of its 126 reachable sums was
      // one the child had just been answering, out of the 5 656 Office step 3 serves — a strictly
      // easier, 45x narrower pool arriving on the screen that says "Try Skyscraper?", and six correct
      // answers to climb back. The 11s and 12s move here, which is what the building is FOR; step 2
      // still owns the missing-factor form and step 3 the squares, division within 144 and regrouping.
      // r3-math-03: moving the 11s and 12s here closed the CONTAINMENT half (100 % → 86 %) and left
      // the SIZE half open — 147 reachable keys against Office step 3's 5 676, 38x narrower, and the
      // only promotion of the four that shrinks the pool at all (the other three widen it or replace
      // it outright). The two ± rows Skyscraper step 3 already carries are lifted to step 1 as well,
      // so the screen that says `Try Skyscraper?` no longer answers with a pool three quarters of
      // which the child has just proved. The building is still `times tables`: × and ÷ hold 5/7 of
      // the weight and the level's ceiling is unchanged at 144.
      { kinds: [K('mul', 3, { a: [2, 12], b: [2, 12], max: 144, tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }), K('div', 2, { q: [2, 10], b: [2, 10], max: 100, tables: [2, 3, 4, 5, 6, 7, 8, 9, 10] }), K('add', 1, { a: [11, 99], b: [11, 99], max: 144 }), K('sub', 1, { a: [11, 144], b: [11, 99], max: 144 })] },
      { kinds: [K('mul', 2, { a: [2, 12], b: [2, 12], max: 144, tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }), K('missMul', 2, { a: [2, 12], b: [2, 12], max: 144, tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }), K('div', 1, { q: [2, 12], b: [2, 12], max: 144, tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] })] },
      { kinds: [K('div', 2, { q: [2, 12], b: [2, 12], max: 144, tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }), K('mul', 1, { a: [2, 12], b: [2, 12], max: 144, square: true }), K('add', 1, { a: [11, 89], b: [11, 89], max: 100, regroup: true }), K('sub', 1, { a: [11, 99], b: [11, 89], max: 100, regroup: true })] },
    ],
  },
  {
    id: 'megatall', name: 'Megatall', short: 'Mega', tag: 'big numbers, and below zero',
    steps: [
      // STEP 1 IS A BRIDGE, NOT THE DEEP END (r4-math-04). It used to be 3-digit ± with up to two
      // regroups and NOTHING ELSE: mean largest operand 595.9 against Skyscraper step 3's 47.5, a
      // 12.5x jump where the other three promotions in the game are 1.7x, 4.6x and 1.07x, and 0 %
      // of its draws had every number under 100 (every other step in the game is 56-100 %). It is
      // also the step `Try Megatall?` lands on (`offer` forces step 1) AND the step a fall cannot
      // leave (adaptStep floors at 1), so a child who accepted had no easier content anywhere in
      // the building. Every row still puts a 3-digit number on the panel — that is what the
      // building is FOR — but the second operand is one or two digits and at most one column
      // regroups, and the 2-digit ± rows the child proved at Skyscraper step 3 come with them. The
      // old step 1 is now step 2, where the ceiling and the second regroup arrive together.
      { kinds: [K('add', 3, { a: [100, 899], b: [11, 89], max: 999, regroups: 1 }), K('sub', 3, { a: [110, 999], b: [11, 89], max: 999, regroups: 1 }), K('add', 2, { a: [100, 899], b: [2, 9], max: 999, regroups: 1 }), K('sub', 2, { a: [101, 999], b: [2, 9], max: 999, regroups: 1 }), K('add', 1, { a: [11, 89], b: [11, 89], max: 100, regroup: true }), K('sub', 1, { a: [11, 99], b: [11, 89], max: 100, regroup: true })] },
      { kinds: [K('add', 3, { a: [100, 899], b: [100, 899], max: 999, regroups: 2 }), K('sub', 3, { a: [100, 999], b: [100, 899], max: 999, regroups: 2 }), K('mul', 2, { a: [11, 99], b: [2, 9], max: 900 })] },
      { kinds: [K('mul', 2, { a: [11, 99], b: [11, 99], max: 9999, mult10: true }), K('div', 2, { q: [11, 99], b: [2, 9], max: 999 }), K('sub', 2, { a: [2, 50], b: [2, 50], max: 50, negatives: true })] },
    ],
  },
]

export const LEVEL_ORDER = LEVELS.map((l) => l.id)

// The largest number any step of a level can put on the display — the number its tag must not
// undercut. Nothing tied a tag to its tables before, so `numbers to 20` could serve 10 × 10 = 100.
export function levelBound(level) {
  return Math.max(...level.steps.flatMap((s) => s.kinds.map((k) => k.max ?? 0)))
}

export function levelById(id) {
  if (id === 'custom') return null
  return LEVELS.find((l) => l.id === id) || null
}

// Custom (Grown-ups) level: one step from explicit knobs.
// Every table here is satisfiable BY CONSTRUCTION, and the tag is derived from the tables that were
// actually built rather than from the raw knobs. A sum needs a + b ≤ max and a product a·b ≤ max,
// so one Smallest-number knob cannot bind both families: it is relaxed per family — never inverted
// (rng.int returns lo when hi < lo, which is how `100 × 2 = 200` became the only sum a parent's
// ops-×, 100-to-120 setting could serve), never left with a single legal pair.
export function customLevel({ ops = ['add', 'sub'], min = 0, max = 20, negatives = false } = {}) {
  min = Math.max(0, Math.floor(+min || 0))
  // The Largest stepper's own floor. `Smallest 0, Largest 2` is reachable from Grown-ups and built
  // a pool of THREE sums — the same sum back two questions later on 55 % of questions, ten floors
  // of a building drawn from three (r4-math-10). × and ÷ have had a factor floor since r3-math-06
  // for the same reason; this is the ± family's, and the tag below is derived from the tables that
  // were actually built, so it says `numbers 0 to 6` rather than repeating the knob.
  max = Math.max(min + 2, ADD_FLOOR, Math.min(9999, Math.floor(+max || 10)))
  const sumLo = Math.max(0, Math.min(min, Math.floor(max / 4)))
  const facHi = Math.max(5, Math.min(12, Math.floor(Math.sqrt(max))))   // no honest table under 5 × 5
  const facLo = 2                                                       // min cannot bind a factor
  const mulMax = facHi * facHi
  const kinds = []
  const OPS = new Set(ops && ops.length ? ops : ['add'])
  if (OPS.has('add')) kinds.push(K('add', 2, { a: [sumLo, max], b: [sumLo, max], max }))
  if (OPS.has('sub')) kinds.push(K('sub', 2, { a: [min, max], b: [min, max], max, negatives: !!negatives }))
  if (OPS.has('mul')) kinds.push(K('mul', 2, { a: [facLo, facHi], b: [facLo, facHi], max: mulMax }))
  if (OPS.has('div')) kinds.push(K('div', 2, { q: [facLo, facHi], b: [facLo, facHi], max: mulMax }))
  if (OPS.has('missAdd')) kinds.push(K('missAdd', 1, { a: [sumLo, max], b: [sumLo, max], max }))
  if (OPS.has('up')) kinds.push(K('up', 1, { a: [0, 9], b: [1, 10], max: 10 }))
  if (OPS.has('down')) kinds.push(K('down', 1, { a: [1, 10], b: [1, 10], max: 10 }))
  if (!kinds.length) kinds.push(K('add', 1, { a: [sumLo, max], b: [sumLo, max], max }))
  // The tag names what the tables can actually show, so `ops ÷, 50 to 60` can no longer read
  // `numbers 50 to 60` over a `15 ÷ 3`.
  const lo = Math.min(...kinds.map((k) => (k.a ? k.a[0] : k.q[0])))
  const hi = Math.max(...kinds.map((k) => k.max))
  // ▲ and ▼ are bounded by the BUILDING, not by the knobs: a floor move cannot leave G-1-9-R, so
  // like × and ÷ above they are relaxed out of the Smallest/Largest range — and, unlike × and ÷,
  // they were relaxed silently. `ops ▲▼, 9997 to 9999` read `numbers 0 to 9999` over a `9 ▲ 1`.
  const floorOps = OPS.has('up') || OPS.has('down')
  // …and the same honesty for × and ÷, whose FACTORS are floored at 5 by the line above. Seven
  // consecutive presses of the Largest `+` key (2 → 35) change nothing a child sees, and the ceiling
  // the tables then reach (5 × 5 = 25) sits ABOVE the number the parent set. The tag says which
  // table it actually built, so the stepper's effect — and its floor — are readable (r3-math-06).
  const tableOps = OPS.has('mul') || OPS.has('div')
  return { id: 'custom', name: 'Custom', short: 'Custom', tag: `numbers ${lo} to ${hi}${tableOps ? `; × and ÷ use ${facLo} to ${facHi}` : ''}${floorOps ? '; ▲▼ inside the building, 0 to 10' : ''}`, custom: true, negatives: !!negatives, steps: [{ kinds }] }
}
