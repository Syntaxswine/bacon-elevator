import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { buildStamp, stampInSw, assetList } from '../tools/build-stamp.mjs'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')

test('sw.js and src/version.js carry the same VERSION literal', () => {
  const v = /VERSION\s*=\s*'([^']+)'/.exec(read('../src/version.js'))
  const w = /VERSION\s*=\s*'([^']+)'/.exec(read('../sw.js'))
  assert.ok(v && w)
  assert.equal(v[1], w[1])
  assert.match(v[1], /^\d+\.\d+\.\d+$/)
  assert.match(read('../sw.js'), /'be-'\s*\+\s*VERSION/)
})

test('sw.js caches every src module and registers relative paths only', () => {
  const sw = read('../sw.js')
  for (const f of ['main', 'rng', 'levels', 'math', 'explain', 'elevator', 'timeline', 'trivia', 'state', 'save', 'storage', 'audio', 'version', 'render/shaft', 'render/panel', 'render/screens']) assert.ok(sw.includes(`./src/${f}.js`), f)
  assert.ok(sw.includes('skipWaiting'))
  assert.ok(!/['"]\/(?:src|css|data|assets|sw\.js|manifest|favicon)/.test(sw), 'no root-absolute paths in sw.js')
})

test('the new worker waits for the chip tap, and precaches past the browser HTTP cache', () => {
  const sw = read('../sw.js')
  const code = sw.replace(/^\s*\/\/.*$/gm, '') // the comments talk ABOUT skipWaiting
  const install = /addEventListener\('install',([\s\S]*?)\n\}\)/.exec(code)
  assert.ok(install, 'no install handler')
  // skipWaiting() in install activates the deploy the instant it finishes installing; clients.claim()
  // then takes the open tab over and it reloads itself mid-sum with no tap. The chip is the only
  // thing allowed to do that, through the message handler.
  assert.ok(!install[1].includes('skipWaiting'), 'the new worker must WAIT for the chip tap')
  // Pages sends cache-control: max-age=600 on every asset, so a default addAll() can copy the
  // PREVIOUS version's files out of the browser HTTP cache into the new version's cache.
  assert.match(install[1], /cache:\s*'reload'/)
  const msg = /addEventListener\('message',([\s\S]*?)\n\}\)/.exec(code)
  assert.ok(msg && msg[1].includes('skipWaiting'), 'the chip tap still needs the message-driven skipWaiting')
  // index.html is cache-first from the versioned cache (DESIGN amendment 10): once the worker really
  // waits, network-first serves the NEW index.html against the OLD cached modules.
  assert.match(code, /caches\.match\('\.\/index\.html'\)\.then\(\(hit\) =>/)
})

test('only a chip tap may reload the tab, and the chip is held while the car is moving', () => {
  const main = read('../src/main.js')
  assert.match(main, /controllerchange[\s\S]{0,120}updateRequested/, 'the reload gate must be the chip tap, not "a worker was ever offered"')
  assert.match(main, /CHIP_HELD_PHASES[\s\S]{0,80}moving[\s\S]{0,40}falling[\s\S]{0,40}descending/)
  assert.match(main, /RESUME_KEY/, 'a chip tap must come back to the sum, not to the lobby')
})

test('index.html, manifest and css use only relative paths', () => {
  const html = read('../index.html')
  assert.ok(!/(href|src)="\//.test(html), 'root-absolute path in index.html')
  assert.ok(html.includes('viewport-fit=cover'))
  assert.ok(!/maximum-scale/.test(html))
  assert.ok(html.includes('<symbol id="bacon"'))
  const man = JSON.parse(read('../manifest.webmanifest'))
  assert.equal(man.start_url, './'); assert.equal(man.scope, './'); assert.equal(man.display, 'standalone')
  assert.ok(man.icons.every((i) => i.src.startsWith('./assets/')))
  // One rounded-corner image cannot be both. The shipped `any` art has 3.99 % transparent corners;
  // Android crops a maskable icon to a platform shape and composites whatever is behind the alpha.
  assert.ok(man.icons.every((i) => i.purpose === 'any' || i.purpose === 'maskable'), 'no icon may claim both purposes')
  assert.ok(man.icons.some((i) => i.purpose === 'maskable' && i.sizes === '512x512'))
  assert.ok(man.icons.some((i) => i.purpose === 'maskable' && i.sizes === '192x192'))
  assert.ok(man.icons.some((i) => i.purpose === 'any' && i.sizes === '512x512'))
  for (const i of man.icons) assert.ok(existsSync(new URL('../' + i.src.slice(2), import.meta.url)), i.src + ' is declared but not shipped')
  const css = read('../css/app.css')
  assert.ok(!/url\(\s*['"]?\//.test(css), 'root-absolute url() in css')
  assert.ok(css.includes('100dvh') && css.includes('safe-area-inset') && css.includes('touch-action: manipulation'))
  const src = ['main', 'audio', 'storage', 'render/shaft', 'render/panel', 'render/screens'].map((f) => read(`../src/${f}.js`)).join('\n')
  assert.ok(!/from\s+'\//.test(src) && !/fetch\(\s*'\//.test(src), 'root-absolute import or fetch')
})

test('pure modules never touch window, document, localStorage, setTimeout or Date', () => {
  for (const f of ['rng', 'levels', 'math', 'explain', 'elevator', 'timeline', 'trivia', 'state', 'save']) {
    const code = read(`../src/${f}.js`).replace(/\/\/.*$/gm, '')
    for (const bad of ['window', 'document', 'localStorage', 'setTimeout', 'Date', 'requestAnimationFrame']) assert.ok(!new RegExp(`\\b${bad}\\b`).test(code), `${f}.js references ${bad}`)
  }
})


// ---- round 2, r2-deploy-pages-01 ---------------------------------------------------------------
// A CONTENT-ONLY DEPLOY MUST STILL BE A DEPLOY.
// The browser's service-worker update check compares sw.js's BYTES and nothing else. Three of the
// last four pushes changed shipped assets (data/trivia.json among them — a false legal citation, a
// keypad that could not answer its own sum) without touching sw.js or src/version.js, so no worker
// installed, no cache was replaced, and the cache-first handler never asked the network again:
// measured on a real deploy, five opens with an empty HTTP cache each time and the only request
// that ever left the browser was /sw.js. `Version 1.0.0` printed the same on both builds, so a
// grown-up could not even tell. This test goes red on any content change until the stamp is moved,
// which is the one thing the update check can see.
test('sw.js carries the fingerprint of the files it precaches (node tools/build-stamp.mjs)', () => {
  const want = buildStamp()
  const have = stampInSw(read('../sw.js'))
  assert.ok(have, 'sw.js has no BUILD stamp')
  assert.equal(have, want, `the precached files changed and sw.js did not: run \`node tools/build-stamp.mjs\` (BUILD ${have} -> ${want})`)
  assert.match(read('../sw.js'), /const CACHE = 'be-' \+ VERSION \+ '-' \+ BUILD/, 'the cache name must be a function of the content, not of a hand-edited literal')
})

// The reset hatch re-fetches exactly what the worker precaches, so the two lists may not drift.
test("?reset=1 refreshes every precached path, so the reset cannot refill from the browser's own HTTP cache", () => {
  const main = read('../src/main.js')
  const m = /export const RESET_ASSETS = \[([\s\S]*?)\n\]/.exec(main)
  assert.ok(m, 'main.js has no RESET_ASSETS list')
  const reset = m[1].match(/'[^']+'/g).map((q) => q.slice(1, -1))
  assert.deepEqual(reset, assetList(read('../sw.js')), 'RESET_ASSETS and sw.js ASSETS have drifted apart')
  assert.match(main, /fetch\(u, \{ cache: 'reload' \}\)/, "the refresh must bypass the HTTP cache, or it re-reads the build it is trying to leave")
})
