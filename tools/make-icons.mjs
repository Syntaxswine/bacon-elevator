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
