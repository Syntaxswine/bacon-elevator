#!/usr/bin/env node
// THE UPDATE-FLOW INSTRUMENT. `npm run drive` cannot see any of this: tools/phone-drive.mjs's own
// server sends `Cache-Control: no-store` and never bumps a version, so the two defects this file
// exists for — an unrequested self-reload, and a precache that inherits the browser's HTTP cache —
// are both invisible to it.
//
// What it does: copies the tree to a temp dir under a /bacon-elevator/ subpath (so the SW scope
// matches the deploy), serves it with the header GitHub Pages actually sends
// (`cache-control: max-age=600`, verified live on the deployed src/version.js), installs VERSION
// 1.0.0, bumps the copy to 1.0.1, opens a NEW page, plays to mid-sum, and then sits still.
//
//   node tools/update-drive.mjs               # the real thing, max-age 600
//   node tools/update-drive.mjs --max-age 0   # control: proves assertion 5 measures the HTTP cache
//   node tools/update-drive.mjs --headed
//
// TWO TRAPS, both of which cost real time to find:
//  1. On Windows, Chrome's service-worker database fails SILENTLY when userDataDir sits past
//     MAX_PATH — getRegistrations() returns [] with no console error, no pageerror and no failed
//     request. Keep the profile directory short.
//  2. Reset the copy's sw.js/version.js from the repo at the START of every run, or the second run
//     begins already at 1.0.1 and silently tests nothing.
import puppeteer from 'puppeteer-core'
import { createServer } from 'node:http'
import { readFile, writeFile, stat, rm, mkdir, cp } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = normalize(join(fileURLToPath(new URL('.', import.meta.url)), '..'))
const argv = process.argv.slice(2)
const flag = (n) => argv.includes(n)
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d }
const MAXAGE = Number(opt('--max-age', 600))

const WORK = join(tmpdir(), 'be-upd')
const ROOT = join(WORK, 'site')
const SITE = join(ROOT, 'bacon-elevator')
const PROFILE = join(tmpdir(), 'be-swp') // short: see trap 1

const CHROME = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean).find(existsSync)
if (!CHROME) throw new Error('No Chrome/Edge found. Set CHROME_PATH.')

// Everything sw.js precaches must be here: addAll() rejects on ONE missing entry and the whole
// install fails, so a file added to ASSETS and not to this list reads as "no worker ever installs".
const COPY = ['index.html', '404.html', 'sw.js', 'manifest.webmanifest', 'favicon.ico', '.nojekyll', 'css', 'src', 'data', 'assets']
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' }

const fails = []
const ok = []
function assert(cond, msg) { if (cond) ok.push(msg); else fails.push(msg) }
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

// ---- a fresh copy of the tree, always at 1.0.0 ---------------------------------------------
await rm(WORK, { recursive: true, force: true }).catch(() => {})
await mkdir(SITE, { recursive: true })
for (const f of COPY) if (existsSync(join(REPO, f))) await cp(join(REPO, f), join(SITE, f), { recursive: true })

let log = []
const srv = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  if (p.endsWith('/')) p += 'index.html'
  const f = normalize(join(ROOT, p))
  if (!f.startsWith(ROOT)) return res.writeHead(403).end()
  const s = await stat(f).catch(() => null)
  if (!s || !s.isFile()) return res.writeHead(404).end('404 ' + p)
  log.push(p)
  // The header Pages really sends. sw.js itself is fetched past the HTTP cache by the browser's own
  // update check (register() defaults to updateViaCache:'imports'), which is why the WORKER updates
  // and only the PRECACHE goes stale.
  const cc = p.endsWith('/sw.js') ? 'max-age=0, no-cache' : (MAXAGE > 0 ? `max-age=${MAXAGE}` : 'no-store')
  res.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream', 'Cache-Control': cc, ETag: `"${s.mtimeMs}-${s.size}"` }).end(await readFile(f))
})
await new Promise((r) => srv.listen(0, '127.0.0.1', r))
const BASE = `http://127.0.0.1:${srv.address().port}/bacon-elevator/`
const URL_ = BASE + '?drive=1&seed=7&fast=1'
console.log(`update-drive: ${BASE}  max-age=${MAXAGE}`)

await rm(PROFILE, { recursive: true, force: true }).catch(() => {})
await mkdir(PROFILE, { recursive: true })
const browser = await puppeteer.launch({ executablePath: CHROME, headless: !flag('--headed'), userDataDir: PROFILE, args: ['--no-first-run', '--no-default-browser-check', '--disable-gpu', '--mute-audio'] })

// WHICH BUILD DOES THE GROWN-UPS SCREEN SAY THIS PHONE IS RUNNING (r5-deploy-pages-1, -2)?
// Two taps of the gear, then the last line of the screen: `Version 1.0.0 · <12 hex>`, or the same
// stamp on the `Load the new version` button when a worker is waiting.
const buildLine = async (page) => {
  await page.evaluate(() => { const g = document.querySelector('[data-gear]'); g.click(); g.click() })
  await page.waitForFunction(() => document.getElementById('app').dataset.screen === 'grownups', { timeout: 5000 })
  const txt = await page.$eval('.screen.grownups', (e) => e.innerText)
  const m = /(?:Version|version)[^\n]*?(\d+\.\d+\.\d+)(?:\s*\u00b7\s*([0-9a-f]{12}))?/.exec(txt) || /(\d+\.\d+\.\d+)\s*\u00b7\s*([0-9a-f]{12})/.exec(txt)
  return { version: m && m[1], stamp: m && m[2], txt: txt.slice(-120) }
}
const cacheHash = (page, prefix) => page.evaluate(async (pre) => {
  const k = (await caches.keys()).find((x) => x.startsWith(pre))
  return k ? k.split('-').pop() : null
}, prefix)

const phone = async () => {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 664, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')
  return page
}

try {
  // ---- session 1: install VERSION 1.0.0 -----------------------------------------------------
  let page = await phone()
  await page.goto(URL_, { waitUntil: 'load' })
  await page.waitForFunction('navigator.serviceWorker.controller !== null', { timeout: 20000 }).catch(async () => {
    await page.reload({ waitUntil: 'load' })
    await page.waitForFunction('navigator.serviceWorker.controller !== null', { timeout: 20000 })
  })
  const v0 = await page.evaluate(() => window.__bacon.version)
  assert(v0 === '1.0.0', `session 1 runs VERSION 1.0.0 (got ${v0})`)
  // 7 — THE FIRST-EVER VISIT NAMES ITS BUILD (r5-deploy-pages-2). The stamp used to be read from
  // caches.keys() at module evaluation, which resolves before `load` registers the worker and
  // before `install` creates a cache, so the very first visit — a parent setting the game up —
  // printed a bare `Version 1.0.0` and no stamp for the whole session.
  const first = await buildLine(page)
  const h100 = await cacheHash(page, 'be-1.0.0')
  assert(first.version === '1.0.0' && !!first.stamp, `assert 7a: the first-ever visit prints a build stamp (${JSON.stringify(first)})`)
  assert(first.stamp === h100, `assert 7b: and it is the cache serving this tab (said ${first.stamp}, cache ${h100})`)
  await page.close()
  log = []

  // ---- the deploy ----------------------------------------------------------------------------
  for (const f of ['sw.js', 'src/version.js']) {
    const p = join(SITE, f)
    await writeFile(p, (await readFile(p, 'utf8')).replace(/'1\.0\.0'/, "'1.0.1'"))
  }

  // ---- session 2: the child is mid-sum when the deploy lands ---------------------------------
  page = await phone()
  const navs = []
  const chipLog = []
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) navs.push(Date.now()) })
  page.on('console', (m) => { if (m.text().startsWith('CHIPLOG ')) chipLog.push(m.text().slice(8)) })
  // An in-page MutationObserver, not a Node-side poll: the chip used to live for ~1.0 s and a 60 ms
  // CDP poll missed it, which is how two reviewers concluded it never rendered at all.
  await page.evaluateOnNewDocument(() => {
    const t0 = performance.now()
    new MutationObserver((recs) => {
      for (const r of recs) {
        for (const n of r.addedNodes) if (n.id === 'update-chip') console.log('CHIPLOG add ' + Math.round(performance.now() - t0))
        for (const n of r.removedNodes) if (n.id === 'update-chip') console.log('CHIPLOG remove ' + Math.round(performance.now() - t0))
      }
    }).observe(document, { childList: true, subtree: true })
  })
  await page.goto(URL_, { waitUntil: 'load' })
  const t0 = Date.now()
  navs.length = 0
  const click = (sel) => page.evaluate((q) => { const e = document.querySelector(q); if (!e || e.disabled) return false; e.click(); return true }, sel)
  const peek = () => page.evaluate(() => { const s = window.__bacon.state(); return { screen: app.dataset.screen, phase: app.dataset.phase, typed: s.ride && s.ride.typed, version: window.__bacon.version } })
  await page.waitForSelector('[data-nav="ride"]', { timeout: 8000 })
  await click('[data-nav="ride"]'); await wait(300)
  await click('[data-continue]'); await wait(300)
  await click('button[data-floor="1"]:not([disabled])'); await wait(300)
  await click('button[data-key="3"]'); await wait(200)
  const mid = await peek()
  assert(mid.phase === 'keypad' && mid.typed === '3', `mid-sum before the update lands (${mid.phase}, typed ${JSON.stringify(mid.typed)})`)

  // 1 — nothing may move without the child's action.
  await wait(8000)
  assert(navs.length === 0, `assert 1: no unrequested navigation for 8 s (saw ${navs.length}; before the fix: one at ~3.1 s)`)

  // 2 — the chip appears and STAYS. It must survive another key tap (render() rewrites the panel).
  const chipNow = () => page.evaluate(() => !!document.getElementById('update-chip'))
  assert(await chipNow(), 'assert 2a: the update chip is in the DOM after 8 s')
  await click('button[data-key="5"]'); await wait(400)
  const after = await peek()
  assert(await chipNow(), 'assert 2b: the chip survives a re-render')
  assert(after.typed === '35', `assert 2c: the digits still go in behind the chip (typed ${JSON.stringify(after.typed)})`)
  assert(chipLog.length >= 1 && chipLog[0].startsWith('add') && !chipLog.some((l) => l.startsWith('remove')), `assert 2d: the chip was added once and never removed (${chipLog.join(', ') || 'never added'})`)

  // 2e — and it must not sit on a tappable. Measured before: elementFromPoint at GO's own centre
  // returned #update-chip on the i12 profile; keys 1–6 on the SE.
  const occluded = await page.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll('[data-tap]')) {
      const b = el.getBoundingClientRect()
      if (!b.width || !b.height || !el.offsetParent) continue
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)
      if (hit !== el && !el.contains(hit)) out.push((el.dataset.key || el.dataset.floor || el.dataset.nav || el.tagName) + ' <- ' + (hit && (hit.id || hit.className)))
    }
    return out
  })
  assert(occluded.length === 0, `assert 2e: the chip covers no tap target (${occluded.join('; ') || 'none'})`)

  // 3 — during the wait the page must still be ONE coherent version (cache-first index.html).
  assert(after.version === '1.0.0', `assert 3: the running session stays on 1.0.0 until the tap (got ${after.version})`)

  // 4 — the new cache holds the NEW files, not the ones the HTTP cache was still holding.
  // The cache name is `be-<VERSION>-<BUILD>` now: BUILD is the hash of everything the worker
  // precaches, which is what makes sw.js's OWN bytes move on a content-only deploy.
  const cached = await page.evaluate(async () => {
    const name = (await caches.keys()).find((k) => k.startsWith('be-1.0.1'))
    if (!name) return null
    const c = await caches.open(name)
    const r = await c.match('./src/version.js')
    return r ? (await r.text()).trim() : null
  })
  assert(cached && cached.includes('1.0.1'), `assert 4: the be-1.0.1 cache holds VERSION 1.0.1 (got ${JSON.stringify(cached)})`)

  // 5 — and it holds them because install actually went to the network for every asset.
  const assets = new Set(log.filter((p) => !p.endsWith('/sw.js')))
  assert(assets.size >= 25, `assert 5: the new worker's install fetched ${assets.size} assets past a max-age=${MAXAGE} cache (needs >= 25)`)

  // 6 — the tap: exactly one navigation, the new version, and back to the SUM.
  navs.length = 0
  await click('#update-chip [data-update]')   // the chip is a pill of two buttons now: take it, or `not now`
  await page.waitForFunction(() => window.__bacon && window.__bacon.version === '1.0.1', { timeout: 15000 }).catch(() => {})
  await wait(600)
  const back = await peek()
  assert(navs.length === 1, `assert 6a: exactly one navigation follows the tap (saw ${navs.length})`)
  assert(back.version === '1.0.1', `assert 6b: the reload runs 1.0.1 (got ${back.version})`)
  assert(back.screen === 'ride' && back.phase === 'keypad', `assert 6c: the child lands back on the sum (${back.screen}/${back.phase})`)
  assert(back.typed === '35', `assert 6d: the typed digits survive (${JSON.stringify(back.typed)})`)
  await page.close()

  // ---- session 3: two caches at once, which is where the old stamp guessed --------------------
  // `caches.keys().filter(be-).sort().pop()` takes the lexicographically greatest name, and from the
  // moment a new worker finishes installing until the chip is tapped there are TWO. A VERSION bump
  // makes that always wrong, not merely half the time: `be-1.0.2-…` sorts above `be-1.0.1-…` on
  // every hash, so the line paired the RUNNING build's version with the PENDING build's stamp — a
  // pair naming a build that has never existed (r5-deploy-pages-1).
  // The BUILD literal moves too, and to `ffffffffffff` ON PURPOSE: it sorts above every real hash,
  // so `sort().pop()` would pick the PENDING cache. Without that the two caches share this repo's
  // BUILD and the check cannot tell a right answer from a lucky one.
  for (const f of ['sw.js', 'src/version.js']) {
    const q = join(SITE, f)
    await writeFile(q, (await readFile(q, 'utf8')).replace(/'1\.0\.1'/, "'1.0.2'").replace(/const BUILD = '[0-9a-f]{12}'/, "const BUILD = 'ffffffffffff'"))
  }
  page = await phone()
  await page.goto(URL_, { waitUntil: 'load' })
  await page.waitForFunction('navigator.serviceWorker.controller !== null', { timeout: 20000 })
  await page.waitForFunction(async () => (await caches.keys()).some((k) => k.startsWith('be-1.0.2')), { timeout: 25000 }).catch(() => {})
  // AND THEN RELOAD, which is the whole repro: on the load where the deploy ARRIVES the new cache
  // does not exist yet, so any policy reads the right one by luck. It is the next load - both caches
  // present from the first frame - where a guess is a guess.
  await page.reload({ waitUntil: 'load' })
  await page.waitForFunction('navigator.serviceWorker.controller !== null', { timeout: 20000 })
  await wait(800)
  const keys = await page.evaluate(() => caches.keys())
  const running = await cacheHash(page, 'be-1.0.1')
  const pending = await cacheHash(page, 'be-1.0.2')
  const line = await buildLine(page)
  assert(!!running && pending === 'ffffffffffff' && running !== pending, `assert 8a: both caches are present and tell apart (${keys.join(', ')})`)
  assert(line.version === '1.0.1', `assert 8b: the line names the version this tab is running (got ${line.version})`)
  assert(line.stamp === running, `assert 8c: and the build serving this tab, not the one waiting (said ${line.stamp}, running ${running}, pending ${pending})`)
  await page.close()
} finally {
  await browser.close()
  srv.close()
}

for (const line of ok) console.log('  ok   ' + line)
for (const line of fails) console.log('  FAIL ' + line)
console.log(`\n${ok.length}/${ok.length + fails.length} passed`)
process.exit(fails.length ? 1 : 0)
