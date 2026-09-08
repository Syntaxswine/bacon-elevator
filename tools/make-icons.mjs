#!/usr/bin/env node
// Renders assets/icon.svg to the PNG sizes a phone home screen needs, plus a
// PNG-in-ICO favicon, using the same headless Chrome the drive tool uses.
//   node tools/make-icons.mjs
import puppeteer from 'puppeteer-core'
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = normalize(join(fileURLToPath(new URL('.', import.meta.url)), '..'))
const CHROME = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].filter(Boolean).find(existsSync)
if (!CHROME) throw new Error('no Chrome found; set CHROME_PATH')

const svg = await readFile(join(ROOT, 'assets', 'icon.svg'), 'utf8')
const SIZES = [
  { file: 'assets/icon-192.png', px: 192 },
  { file: 'assets/icon-512.png', px: 512 },
  { file: 'assets/apple-touch-icon.png', px: 180 },
  { file: 'assets/favicon-32.png', px: 32 },
]

// THE MASKABLE PAIR, and why it is a second image rather than a second `purpose` on the first.
//
// icon.svg draws its plate as a ROUNDED rect and is screenshotted with omitBackground, so the
// shipped PNGs have transparent corners: measured, pixel (0,0) at alpha 0 and 3.99 % of the square
// fully clear. Android composites a maskable icon's transparency onto whatever it likes and then
// crops it to a platform shape, so declaring `any maskable` on that art gives a clipped, haloed
// launcher icon. A full-bleed background alone would not be enough either: rendering the artwork
// WITHOUT the plate, the farthest drawn pixel sits at 0.883 of the half-width and the maskable safe
// zone is a circle of radius 0.800 — the shaft frame's corners are outside it. So: opaque plate,
// square, plus the art scaled about the centre until it fits inside the safe circle.
const MASK_SCALE = 0.85 // art reach 0.883 -> 0.751 of the half-width; the safe circle is 0.800
const MASK_T = (512 - 512 * MASK_SCALE) / 2 // 38.4
const PLATE = '<rect width="512" height="512" rx="112" fill="url(#bg)"/>'
if (!svg.includes(PLATE)) throw new Error('icon.svg background plate changed; update tools/make-icons.mjs')
const wrapArt = (src, head) => src.replace(new RegExp(`(${head.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})([\\s\\S]*)(<\\/svg>)`), (m, a, body, end) => `${a}<g transform="translate(${MASK_T} ${MASK_T}) scale(${MASK_SCALE})">${body}</g>${end}`)
const FLAT = '<rect width="512" height="512" fill="url(#bg)"/>'
const maskableSvg = wrapArt(svg.replace(PLATE, FLAT), FLAT)
// the same art, same scale, with NO plate: this is what the safe-circle gate measures
const maskableArtOnly = wrapArt(svg.replace(PLATE, ''), '</defs>')
const MASKABLE = [
  { file: 'assets/icon-maskable-192.png', px: 192 },
  { file: 'assets/icon-maskable-512.png', px: 512 },
]

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run', '--disable-gpu'] })
try {
  const page = await browser.newPage()
  for (const s of SIZES) {
    await page.setViewport({ width: s.px, height: s.px, deviceScaleFactor: 1 })
    await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${svg.replace(/width="512" height="512"/, `width="${s.px}" height="${s.px}"`)}</body></html>`)
    const png = await page.screenshot({ type: 'png', omitBackground: true, clip: { x: 0, y: 0, width: s.px, height: s.px } })
    await writeFile(join(ROOT, s.file), png)
    console.log(`${s.file} ${png.length} bytes`)
  }
  for (const s of MASKABLE) {
    await page.setViewport({ width: s.px, height: s.px, deviceScaleFactor: 1 })
    await page.setContent(`<!doctype html><html><body style="margin:0">${maskableSvg.replace(/width="512" height="512"/, `width="${s.px}" height="${s.px}"`)}</body></html>`)
    // omitBackground: false — a maskable icon must be opaque edge to edge.
    const png = await page.screenshot({ type: 'png', omitBackground: false, clip: { x: 0, y: 0, width: s.px, height: s.px } })
    await writeFile(join(ROOT, s.file), png)
    console.log(`${s.file} ${png.length} bytes`)
  }

  // The measured gate. (a) every maskable pixel is opaque; (b) with the plate removed, nothing
  // drawn reaches past 0.80 of the half-width. (b) is the assertion that proves a full-bleed
  // background alone would NOT have been enough: the unscaled art fails it at 0.883.
  const measure = async (src, px, omit) => {
    await page.setViewport({ width: px, height: px, deviceScaleFactor: 1 })
    await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${src.replace(/width="512" height="512"/, `width="${px}" height="${px}"`)}</body></html>`)
    const buf = await page.screenshot({ type: 'png', omitBackground: omit, clip: { x: 0, y: 0, width: px, height: px } })
    return await page.evaluate(async (b64, n) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode()
      const c = document.createElement('canvas'); c.width = n; c.height = n
      const g = c.getContext('2d'); g.drawImage(img, 0, 0)
      const d = g.getImageData(0, 0, n, n).data
      let clear = 0, far = 0
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const a = d[(y * n + x) * 4 + 3]
        if (a === 0) clear++
        if (a > 8) { const rr = Math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2) / (n / 2); if (rr > far) far = rr }
      }
      return { transparentFraction: +(clear / (n * n)).toFixed(4), reach: +far.toFixed(3) }
    }, buf.toString('base64'), px)
  }
  for (const s of MASKABLE) {
    const m = await measure(maskableSvg, s.px, false)
    console.log(`  gate ${s.file}: transparent ${m.transparentFraction}, reach ${m.reach}`)
    if (m.transparentFraction !== 0) throw new Error(`${s.file} has transparent pixels (${m.transparentFraction}); a maskable icon must be opaque edge to edge`)
  }
  const reach = (await measure(maskableArtOnly, 512, true)).reach
  const unscaled = (await measure(svg.replace(PLATE, ''), 512, true)).reach
  console.log(`  gate safe circle: scaled art reaches ${reach}, unscaled art reaches ${unscaled}, limit 0.800`)
  if (!(reach <= 0.8)) throw new Error(`maskable art reaches ${reach} of the half-width; the safe circle is 0.800`)

  // favicon.ico = ICO container around the 32px PNG (PNG-in-ICO is supported everywhere that matters).
  const png32 = await readFile(join(ROOT, 'assets/favicon-32.png'))
  const header = Buffer.alloc(6); header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4)
  const entry = Buffer.alloc(16)
  entry[0] = 32; entry[1] = 32; entry[2] = 0; entry[3] = 0
  entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6)
  entry.writeUInt32LE(png32.length, 8); entry.writeUInt32LE(22, 12)
  await writeFile(join(ROOT, 'favicon.ico'), Buffer.concat([header, entry, png32]))
  console.log(`favicon.ico ${22 + png32.length} bytes`)
} finally {
  await browser.close()
}
