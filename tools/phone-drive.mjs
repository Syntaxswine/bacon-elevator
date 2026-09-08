#!/usr/bin/env node
// Headless phone drive: plays Bacon Elevator in a real Chrome at phone viewports
// and reports console errors, page errors, failed requests and scenario results.
//
//   node tools/phone-drive.mjs                 # all scenarios, all phones
//   node tools/phone-drive.mjs --phone se      # one phone profile
//   node tools/phone-drive.mjs --only smoke    # one scenario (substring match)
//   node tools/phone-drive.mjs --url http://localhost:8791/   # against a running server
//   node tools/phone-drive.mjs --shots         # write PNGs to shots/
//   node tools/phone-drive.mjs --headed        # watch it
//
// Exit code 1 if any scenario fails or any console/page error is seen.
// Scenarios live in tools/drive-scenarios.mjs (see that file for the helper API).

import puppeteer from 'puppeteer-core'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scenarios } from './drive-scenarios.mjs'

const ROOT = normalize(join(fileURLToPath(new URL('.', import.meta.url)), '..'))
const argv = process.argv.slice(2)
const flag = (n) => argv.includes(n)
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d }

// THE HEIGHTS ARE THE BROWSER'S, NOT THE DEVICE'S.
//
// A phone's screen is 375x667; the page never gets 667. Safari and Chrome keep an address
// bar and a toolbar, and what is left is the visual viewport the layout must fit. Round 1 of
// the hostile review found the panel's bottom row (0 | GO, the door keys) pushed off the
// bottom of the screen on every real phone — and this instrument could not see it, because
// these profiles used the DEVICE heights and so handed the page ~100 px it never has.
//
// `height` is therefore the browser-visible height with the bars showing (the worst case a
// child sees on first load, before scrolling collapses the bar); `device` records the screen
// it came from. Sources: Apple's Safari viewport sizes and Chrome's mobile toolbar height.
// Run with --tall to use the device heights instead (fullscreen / Home Screen install).
const PHONES = {
  se: { name: 'iPhone SE 2/3, Safari bars (375x553; screen 375x667)', device: 667, viewport: { width: 375, height: 553, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
  i12: { name: 'iPhone 12/13/14, Safari bars (390x664; screen 390x844)', device: 844, viewport: { width: 390, height: 664, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
  pixel: { name: 'Pixel 5, Chrome toolbar (393x727; screen 393x851)', device: 851, viewport: { width: 393, height: 727, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true }, ua: 'Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36' },
  small: { name: 'Small Android, Chrome toolbar (360x560; screen 360x640)', device: 640, viewport: { width: 360, height: 560, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, ua: 'Mozilla/5.0 (Linux; Android 11; SM-A125F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36' },
  se1: { name: 'iPhone SE 1 / iPod, Safari bars (320x454; screen 320x568)', device: 568, viewport: { width: 320, height: 454, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1' },
}

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean)

function findChrome() {
  for (const c of CHROME_CANDIDATES) if (existsSync(c)) return c
  throw new Error('No Chrome/Edge found. Set CHROME_PATH.')
}

// A throwaway static server so the drive never depends on tools/serve.js being up.
function serveRoot() {
  const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' }
  const srv = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname)
      if (p.endsWith('/')) p += 'index.html'
      const f = normalize(join(ROOT, p))
      if (!f.startsWith(ROOT)) return res.writeHead(403).end()
      const s = await stat(f).catch(() => null)
      if (!s || !s.isFile()) return res.writeHead(404).end('404 ' + p)
      res.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(await readFile(f))
    } catch (e) { res.writeHead(500).end(String(e)) }
  })
  return new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve({ srv, url: `http://127.0.0.1:${srv.address().port}/` })))
}

async function main() {
  const only = opt('--only', null)
  const phoneKeys = opt('--phone', null) ? [opt('--phone')] : Object.keys(PHONES)
  const shots = flag('--shots')
  let url = opt('--url', null)
  let srv = null
  if (!url) { const s = await serveRoot(); srv = s.srv; url = s.url }
  if (shots) await mkdir(join(ROOT, 'shots'), { recursive: true })

  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: !flag('--headed'),
    args: ['--no-first-run', '--no-default-browser-check', '--disable-gpu', '--mute-audio', '--autoplay-policy=no-user-gesture-required'],
  })

  let failures = 0
  const report = []
  try {
    for (const key of phoneKeys) {
      const phone = PHONES[key]
      if (!phone) throw new Error(`unknown phone "${key}" (${Object.keys(PHONES).join(', ')})`)
      for (const sc of scenarios) {
        if (only && !sc.name.includes(only)) continue
        const page = await browser.newPage()
        const errors = []
        page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()) })
        page.on('pageerror', (e) => errors.push('pageerror: ' + (e && e.message ? e.message : String(e))))
        page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url() + ' ' + (r.failure() && r.failure().errorText)))
        page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`) })
        await page.setUserAgent(phone.ua)
        await page.setViewport(flag('--tall') ? { ...phone.viewport, height: phone.device } : phone.viewport)
        const t0 = Date.now()
        const ctx = {
          page, url, phone, key, ROOT, errors,
          shot: async (name) => { if (shots) await page.screenshot({ path: join(ROOT, 'shots', `${key}-${sc.name}-${name}.png`) }) },
          goto: async (hash = '') => { await page.goto(url + hash, { waitUntil: 'load' }); await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r()))) },
        }
        let status = 'PASS', detail = ''
        try {
          detail = (await sc.run(ctx)) || ''
        } catch (e) {
          status = 'FAIL'; detail = e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : String(e)
          try { await ctx.shot('FAIL') } catch {}
        }
        if (errors.length && sc.allowErrors !== true) { status = 'FAIL'; detail += (detail ? ' | ' : '') + errors.slice(0, 5).join(' | ') }
        if (status === 'FAIL') failures++
        const ms = Date.now() - t0
        report.push({ phone: phone.name, scenario: sc.name, status, ms, detail })
        console.log(`${status === 'PASS' ? 'ok  ' : 'FAIL'} [${key}] ${sc.name} (${ms} ms)${detail ? '\n      ' + detail : ''}`)
        await page.close()
      }
    }
  } finally {
    await browser.close()
    if (srv) srv.close()
  }
  const total = report.length
  console.log(`\n${total - failures}/${total} passed`)
  process.exit(failures ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(2) })
