// Level tables. One row per level and step, data not formulas (docs/DESIGN.md §4).
// `name` is the full name (lobby chip, picker, Grown-ups); `short` (≤ 6 characters) is what the
// ride's top-bar chip shows, which has only 43–70 px beside the step bar.
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

export const LEVELS = [
  {
    id: 'corner', name: 'Corner Shop', short: 'Shop', tag: 'numbers to 10', floors: 3,
    steps: [
      { kinds: [K('add', 3, { a: [0, 5], b: [0, 5], max: 5 }), K('sub', 3, { a: [0, 5], b: [0, 5], max: 5 }), K('up', 1, { a: [0, 5], b: [1, 5], max: 5 }), K('down', 1, { a: [1, 5], b: [1, 5], max: 5 })] },
      { kinds: [K('add', 3, { a: [0, 10], b: [0, 10], max: 10 }), K('sub', 3, { a: [0, 10], b: [0, 10], max: 10 }), K('up', 1, { a: [0, 9], b: [1, 10], max: 10 }), K('down', 1, { a: [1, 10], b: [1, 10], max: 10 })] },
      // step 3 is the top of the easiest building: 0 has been taught at steps 1 and 2, and `2 + 0`
      // is not a question. ▲ keeps a: [1, 9] so a floor move still starts somewhere.
      { kinds: [K('add', 2, { a: [1, 10], b: [1, 10], max: 10 }), K('sub', 2, { a: [1, 10], b: [1, 10], max: 10 }), K('missAdd', 2, { a: [1, 10], b: [1, 10], max: 10 }), K('up', 1, { a: [1, 9], b: [1, 10], max: 10 }), K('down', 1, { a: [1, 10], b: [1, 10], max: 10 })] },
    ],
  },
  {
    id: 'hotel', name: 'Hotel', short: 'Hotel', tag: 'numbers to 20; tables 2, 5, 10', floors: 6,
    steps: [
      { kinds: [K('add', 3, { a: [2, 18], b: [2, 18], max: 20, regroup: false }), K('sub', 3, { a: [2, 20], b: [2, 18], max: 20, regroup: false }), K('up', 1, { a: [2, 9], b: [2, 8], max: 10 })] },
      { kinds: [K('add', 3, { a: [2, 18], b: [2, 18], max: 20, regroup: true }), K('sub', 3, { a: [2, 20], b: [2, 18], max: 20, regroup: true }), K('add', 1, { a: [2, 10], b: [2, 10], max: 20, double: true }), K('down', 1, { a: [2, 10], b: [2, 9], max: 10 })] },
      { kinds: [K('add', 2, { a: [2, 18], b: [2, 18], max: 20 }), K('sub', 2, { a: [2, 20], b: [2, 18], max: 20 }), K('mul', 2, { a: [2, 10], b: [2, 10], max: 100, tables: [2, 5, 10] }), K('missAdd', 2, { a: [2, 18], b: [2, 18], max: 20 })] },
    ],
  },
  {
    id: 'office', name: 'Office Block', short: 'Office', tag: 'numbers to 100', floors: 9,
    steps: [
      { kinds: [K('add', 2, { a: [11, 89], b: [2, 9], max: 100, regroup: false }), K('sub', 2, { a: [11, 99], b: [2, 9], max: 100, regroup: false }), K('add', 1, { a: [10, 90], b: [10, 90], max: 100, tens: true }), K('sub', 1, { a: [20, 100], b: [10, 90], max: 100, tens: true })] },
      { kinds: [K('add', 2, { a: [11, 89], b: [2, 9], max: 100, regroup: true }), K('sub', 2, { a: [11, 99], b: [2, 9], max: 100, regroup: true }), K('mul', 2, { a: [2, 10], b: [3, 4], max: 40, tables: [3, 4] })] },
      { kinds: [K('mul', 2, { a: [2, 10], b: [2, 10], max: 100, tables: [2, 3, 4, 5, 6, 7, 8, 9, 10] }), K('div', 2, { q: [2, 10], b: [2, 10], max: 100, tables: [2, 3, 4, 5, 6, 7, 8, 9, 10] }), K('add', 1, { a: [11, 89], b: [11, 89], max: 100 }), K('sub', 1, { a: [11, 99], b: [11, 89], max: 100 })] },
    ],
  },
  {
    id: 'sky', name: 'Skyscraper', short: 'Sky', tag: 'times tables', floors: 9,
    steps: [
      { kinds: [K('mul', 3, { a: [2, 10], b: [2, 10], max: 100, tables: [2, 3, 4, 5, 6, 7, 8, 9, 10] }), K('div', 2, { q: [2, 10], b: [2, 10], max: 100, tables: [2, 3, 4, 5, 6, 7, 8, 9, 10] })] },
      { kinds: [K('mul', 3, { a: [2, 12], b: [2, 12], max: 144, tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }), K('missMul', 2, { a: [2, 12], b: [2, 12], max: 144, tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] })] },
      { kinds: [K('div', 2, { q: [2, 12], b: [2, 12], max: 144, tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }), K('mul', 1, { a: [2, 12], b: [2, 12], max: 144, square: true }), K('add', 1, { a: [11, 89], b: [11, 89], max: 100, regroup: true }), K('sub', 1, { a: [11, 99], b: [11, 89], max: 100, regroup: true })] },
    ],
  },
  {
    id: 'megatall', name: 'Megatall', short: 'Mega', tag: 'big numbers', floors: 9,
    steps: [
      { kinds: [K('add', 3, { a: [100, 899], b: [100, 899], max: 999, regroups: 2 }), K('sub', 3, { a: [100, 999], b: [100, 899], max: 999, regroups: 2 })] },
      { kinds: [K('mul', 3, { a: [11, 99], b: [2, 9], max: 900 }), K('add', 2, { a: [100, 899], b: [100, 899], max: 999, regroups: 2 })] },
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
  max = Math.max(min + 2, Math.min(9999, Math.floor(+max || 10)))
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
  return { id: 'custom', name: 'Custom', short: 'Custom', tag: `numbers ${lo} to ${hi}`, floors: 9, custom: true, negatives: !!negatives, steps: [{ kinds }] }
}
