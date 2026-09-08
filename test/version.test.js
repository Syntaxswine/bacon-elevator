import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

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
  for (const f of ['main', 'rng', 'levels', 'math', 'explain', 'elevator', 'trivia', 'state', 'save', 'storage', 'audio', 'version', 'render/shaft', 'render/panel', 'render/screens']) assert.ok(sw.includes(`./src/${f}.js`), f)
  assert.ok(sw.includes('skipWaiting'))
  assert.ok(!/['"]\/(?:src|css|data|assets|sw\.js|manifest|favicon)/.test(sw), 'no root-absolute paths in sw.js')
})

test('index.html, manifest and css use only relative paths', () => {
  const html = read('../index.html')
  assert.ok(!/(href|src)="\//.test(html), 'root-absolute path in index.html')
  assert.ok(html.includes('viewport-fit=cover'))
  assert.ok(!/maximum-scale/.test(html))
  assert.ok(html.includes('<symbol id="bacon"'))
  const man = JSON.parse(read('../manifest.webmanifest'))
  assert.equal(man.start_url, './'); assert.equal(man.scope, './'); assert.equal(man.display, 'standalone')
  assert.ok(man.icons.every((i) => i.src.startsWith('./assets/') && i.purpose === 'any maskable'))
  const css = read('../css/app.css')
  assert.ok(!/url\(\s*['"]?\//.test(css), 'root-absolute url() in css')
  assert.ok(css.includes('100dvh') && css.includes('safe-area-inset') && css.includes('touch-action: manipulation'))
  const src = ['main', 'audio', 'storage', 'render/shaft', 'render/panel', 'render/screens'].map((f) => read(`../src/${f}.js`)).join('\n')
  assert.ok(!/from\s+'\//.test(src) && !/fetch\(\s*'\//.test(src), 'root-absolute import or fetch')
})

test('pure modules never touch window, document, localStorage, setTimeout or Date', () => {
  for (const f of ['rng', 'levels', 'math', 'explain', 'elevator', 'trivia', 'state', 'save']) {
    const code = read(`../src/${f}.js`).replace(/\/\/.*$/gm, '')
    for (const bad of ['window', 'document', 'localStorage', 'setTimeout', 'Date', 'requestAnimationFrame']) assert.ok(!new RegExp(`\\b${bad}\\b`).test(code), `${f}.js references ${bad}`)
  }
})
