#!/usr/bin/env node
// THE DEPLOY'S FINGERPRINT.
//
// The browser decides whether a deploy exists by comparing sw.js's bytes. A content-only push —
// a corrected citation, a fixed keypad, new CSS — changed none of them, so nothing installed and
// every child who already had the game stayed on the old build for ever. `BUILD` in sw.js is a hash
// of every file the worker precaches, so any content change moves sw.js's bytes; this tool writes
// it, and test/version.test.js goes red until it is right.
//
//   node tools/build-stamp.mjs           # write the stamp into sw.js
//   node tools/build-stamp.mjs --check   # print expected vs actual, exit 1 on a mismatch
//
// The hash covers file CONTENT and the path list, in ASSETS order, so a reordering or a rename is
// a new build too. './' is the scope root, served as index.html, which is hashed under its own name.

import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SW = join(ROOT, 'sw.js')

export function assetList(swText) {
  const m = /const ASSETS = \[([\s\S]*?)\n\]/.exec(swText)
  if (!m) throw new Error('sw.js: no ASSETS array')
  return m[1].match(/'[^']+'/g).map((q) => q.slice(1, -1))
}

export function buildStamp(root = ROOT) {
  const sw = readFileSync(join(root, 'sw.js'), 'utf8')
  const h = createHash('sha256')
  for (const rel of assetList(sw)) {
    if (rel === './') continue
    h.update(rel)
    h.update(readFileSync(join(root, rel)))
  }
  return h.digest('hex').slice(0, 12)
}

export function stampInSw(swText) {
  const m = /const BUILD = '([0-9a-f]{12})'/.exec(swText)
  return m ? m[1] : null
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const want = buildStamp()
  const sw = readFileSync(SW, 'utf8')
  const have = stampInSw(sw)
  if (process.argv.includes('--check')) {
    console.log(`sw.js BUILD  is ${have}\n             wants ${want}`)
    process.exit(have === want ? 0 : 1)
  }
  if (have === want) { console.log(`sw.js BUILD is already ${want}`); process.exit(0) }
  writeFileSync(SW, sw.replace(/const BUILD = '[0-9a-f]{12}'/, `const BUILD = '${want}'`))
  console.log(`sw.js BUILD ${have} -> ${want}`)
}
