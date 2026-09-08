// Seeded random numbers. Pure: no window, no Date.
// mulberry32(seed) -> rng; rng() in [0,1); rng.int(lo,hi) inclusive; rng.pick(arr); rng.count draws so far.

export function mulberry32(seed) {
  let a = (seed >>> 0) || 0x9E3779B9
  const rng = function () {
    rng.count++
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  rng.count = 0
  rng.seed = seed >>> 0
  rng.int = (lo, hi) => {
    lo = Math.ceil(lo); hi = Math.floor(hi)
    if (hi < lo) return lo
    return lo + Math.floor(rng() * (hi - lo + 1))
  }
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)]
  rng.skip = (n) => { for (let i = 0; i < n; i++) rng() }
  return rng
}

// FNV-1a 32-bit over UTF-16 code units. Deterministic across engines.
export function hash32(str) {
  let h = 0x811C9DC5
  const s = String(str)
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
