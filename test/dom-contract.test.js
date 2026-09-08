// Static checks on the DOM layer: the contract ids and data attributes (docs/DESIGN.md §12) exist
// in the markup the renderers emit, the phone rules hold in index.html and the CSS, nothing can
// summon the keyboard, and the service worker's asset list covers every shipped file (a missing
// entry is silent otherwise — the install swallows single failures by design) and names nothing
// that does not exist (a wrong entry fails the whole install).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

function walk(dir, out = []) {
  for (const f of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${f}`
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out); else out.push(rel)
  }
  return out
}

test('index.html: viewport-fit=cover, no maximum-scale, light colour scheme, relative links only, manifest and icons, no <input>', () => {
  const html = read('index.html')
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">/)
  assert.ok(!/maximum-scale/.test(html))
  assert.match(html, /<meta name="color-scheme" content="light">/, 'controls and scrollbars stay on the Day palette under a dark system theme')
  assert.match(html, /<link rel="manifest" href="\.\/manifest\.webmanifest">/)
  assert.match(html, /apple-touch-icon" href="\.\/assets\/apple-touch-icon\.png"/)
  assert.match(html, /<script type="module" src="\.\/src\/main\.js">/)
  assert.match(html, /<symbol id="bacon"/, 'the single bacon symbol')
  assert.match(html, /<div id="app" data-screen="lobby" data-phase="lobby"/)
  assert.ok(!/<input|<textarea|contenteditable/i.test(html))
  assert.ok(!/(href|src)="\//.test(html), 'no root-absolute paths')
})

test('no <input>, <textarea> or contenteditable anywhere under src/ (nothing summons the keyboard)', () => {
  for (const f of walk('src')) assert.ok(!/<input|<textarea|contenteditable/i.test(read(f)), f)
})

test('the CSS keeps the phone rules: dvh with a vh fallback, safe-area insets, touch-action, overscroll, 48 px minimums, the short-landscape query, reduced motion', () => {
  const css = read('css/app.css')
  assert.match(css, /height: 100vh; height: 100dvh/)
  assert.match(css, /--vh: 100vh;/)
  assert.match(css, /@supports \(height: 100dvh\) \{ :root \{ --vh: 100dvh; \} \}/)
  assert.match(css, /--cell: clamp\(48px, calc\(\(var\(--vh\) - 48px - 90px - 200px - 38px\) \/ 5\), 56px\)/, 'the panel cell shrinks so the shaft keeps 200 px')
  for (const side of ['top', 'right', 'bottom', 'left']) assert.match(css, new RegExp(`padding-${side}: env\\(safe-area-inset-${side}`), side)
  assert.match(css, /touch-action: manipulation/)
  assert.match(css, /overscroll-behavior: none/)
  assert.match(css, /button \{[^}]*min-height: 48px; min-width: 48px/, 'every button is a 48 px target')
  assert.match(css, /font-size: max\(16px, 1em\)/, 'no focusable text under 16 px')
  assert.ok(!/url\(\s*["']?\//.test(css), 'no root-absolute url()')
  assert.match(css, /@media \(max-height: 500px\) and \(orientation: landscape\)/, 'short landscape becomes two columns')
  assert.match(css, /grid-template-areas: 'top display' 'shaft panel'/)
  assert.match(css, /html\.reduced \.roof \.drift \{ display: none; \}/, 'no drift under reduced motion')
  assert.match(css, /\.panel \.choice\[data-result="right"\]/)
  assert.match(css, /\.panel \.choice\[data-result="chosen"\]/)
  assert.match(css, /\.panel \.choice\[data-result="dim"\]/)
  assert.match(css, /\.panel \.choice \.letter/)
})

test('the renderers emit every id and data attribute the DOM contract names; every button carries data-tap; no anchors inside the ride', () => {
  const main = read('src/main.js'), panel = read('src/render/panel.js'), screens = read('src/render/screens.js'), shaft = read('src/render/shaft.js')
  for (const id of ['id="question"', 'id="message"', 'id="stepbar"', 'id="tray"', 'id="lunchbox"', 'id="panel"', 'id="shaft"', 'id="hint"', 'id="sheet"', 'id="levelname"']) assert.ok(main.includes(id), id)
  assert.match(main, /id="question" aria-live="polite"/)
  assert.match(main, /id="message" aria-live="polite"/)
  assert.match(main, /app\.dataset\.screen = state\.screen/)
  assert.match(main, /app\.dataset\.phase = state\.phase/)
  for (const k of ['data-key="${d}"', 'data-key="go"', 'data-key="back"', 'data-key="hint"', 'data-key="sign"', 'data-floor="${lab}"', 'data-door="open"', 'data-door="close"', 'data-bell', 'data-choice="${i}"', 'data-continue', 'data-result="${choiceResult(t, i)}"']) assert.ok(panel.includes(k), k)
  for (const k of ['data-nav="ride"', 'data-nav="lobby"', 'data-nav="picker"', 'data-nav="factbook"', 'data-nav="workshop"', 'data-nav="grownups"', 'data-level="${l.id}"', 'data-level="${id}"', 'data-setting="${key}"', 'data-continue', 'data-next', 'data-offer', 'data-gear', 'data-reset', 'data-sound']) assert.ok(screens.includes(k), k)
  assert.match(shaft, /id: 'car', 'data-motion': 'idle'/)
  assert.match(shaft, /id: 'doors', 'data-state': 'open'/)
  assert.match(shaft, /id: 'indicator', 'data-floor': 'G', 'data-arrow': 'none'/)
  assert.match(shaft, /class: 'strip', href: '#bacon'/, 'the collected strip rides inside the car')
  for (const [name, src] of [['screens', screens], ['panel', panel], ['main', main]]) {
    for (const m of src.matchAll(/<button\b[^>]*>/g)) assert.ok(/data-tap/.test(m[0]), `${name}: button without data-tap: ${m[0].slice(0, 80)}`)
  }
  assert.ok(!/<a\b/.test(panel) && !/<a\b/.test(main), 'no anchors in the panel or the ride skeleton')
  assert.match(screens, /links \? `<a href="\$\{esc\(s\.url\)\}" target="_blank" rel="noopener noreferrer">/, 'the Fact Book links only when the setting is on')
  assert.ok(!/<a\b/.test(screens.replace(/links \? `<a href[^`]*`/g, '')), 'no other anchor anywhere')
  assert.match(panel, /aria-label="\$\{LETTERS\[i\]\}: \$\{esc\(c\)\}"/, 'choices are read as "B: Kodak"')
})

test('the drive hook and the URL knobs are wired in main.js exactly as the contract says', () => {
  const main = read('src/main.js')
  assert.match(main, /const DRIVE = params\.get\('drive'\) === '1'/)
  assert.match(main, /params\.get\('fast'\) === '1' \? 0\.1 : 1/)
  assert.match(main, /params\.has\('seed'\)/)
  assert.match(main, /params\.get\('reset'\) === '1'/)
  assert.match(main, /if \(DRIVE\) \{\s*window\.__bacon = \{/)
  for (const k of ['state: () => state', 'version: VERSION', 'get timescale()', 'get durations()', 'audioCreated: () => audio.created', 'events, actions', 'inFlight: () => play !== null']) assert.ok(main.includes(k), k)
  assert.match(main, /register\('\.\/sw\.js'\)/)
  assert.match(main, /fetch\('\.\/data\/trivia\.json'\)/)
  assert.match(main, /window\.visualViewport\.addEventListener\('resize', onResize\)/)
  assert.match(main, /new ResizeObserver\(onResize\)\.observe\(shaftBox\)/)
  assert.match(main, /Math\.max\(300, 900 \* timescale\(\)\)/, 'the Fact sheet never follows a choice under 300 ms')
  assert.match(main, /state = hydrate\(state, rngFor\(state\)\)/, 'an in-flight save is settled before the first render')
  assert.match(main, /createPlayer\(steps, ts, now, effect\.duration\)/, 'the pure player drives the timeline')
})

test('audio: no AudioContext at module scope, construction inside a function, a −12 dBFS ceiling, no wall clock', () => {
  const a = read('src/audio.js')
  const lines = a.split('\n').filter((l) => /new AC\(|new AudioContext|webkitAudioContext\(/.test(l))
  assert.ok(lines.length >= 1)
  for (const l of lines) assert.match(l, /^\s{4,}/, 'construction is indented inside a function')
  assert.match(a, /0\.25 \*/, '0.25 ≈ −12 dBFS ceiling')
  assert.ok(!/setTimeout|Date\.now|performance\.now/.test(a), 'no wall clock in the synth')
})

test('pure modules never touch the DOM, storage, timers, the clock, the network or Math.random', () => {
  for (const f of ['rng', 'levels', 'math', 'explain', 'elevator', 'timeline', 'trivia', 'state', 'save']) {
    const t = read(`src/${f}.js`).replace(/\/\/.*$/gm, '')
    assert.ok(!/\b(window|document|localStorage|sessionStorage|setTimeout|setInterval|requestAnimationFrame|Date|performance|fetch|navigator)\b/.test(t), `${f}.js is pure`)
    assert.ok(!/Math\.random/.test(t), `${f}.js draws only from the injected rng`)
  }
})

test('sw.js ASSETS covers every shipped file and names nothing that does not exist', () => {
  const sw = read('sw.js')
  const assets = sw.match(/const ASSETS = \[([\s\S]*?)\]/)[1].match(/'[^']+'/g).map((q) => q.slice(1, -1))
  const shipped = ['./index.html', './manifest.webmanifest', './favicon.ico', './css/app.css', './data/trivia.json', ...walk('src').map((f) => './' + f), ...walk('assets').map((f) => './' + f)]
  for (const f of shipped) assert.ok(assets.includes(f), `sw.js ASSETS is missing ${f}`)
  for (const a of assets) { if (a === './') continue; assert.ok(existsSync(join(ROOT, a)), `sw.js ASSETS names a file that does not exist: ${a}`) }
  assert.equal(new Set(assets).size, assets.length, 'no duplicate entries')
  assert.ok(assets.includes('./'), 'the scope root is cached for offline navigation')
})
