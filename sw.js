// Bacon Elevator service worker. Network-first index.html, cache-first relative assets.
// The cache name embeds src/version.js's VERSION (test/version.test.js keeps them equal).
const VERSION = '1.0.0'
// BUILD IS THE DEPLOY'S OWN FINGERPRINT: a hash of every file in ASSETS, written by
// `node tools/build-stamp.mjs` and checked by test/version.test.js, which goes RED until it matches.
//
// Why it exists. The browser's update check compares THIS FILE'S BYTES and nothing else. Three of
// the last four deploys changed shipped assets — a false legal citation, a keypad that could not
// answer its own sum — without touching sw.js or src/version.js, so no worker installed, no cache
// was replaced, and the cache-first fetch handler never asked the network again. Measured against
// the live tree: five opens with an empty HTTP cache each time, and the only request that ever left
// the browser was /sw.js. A child who already had the game could not be reached by a correction at
// all, and `Version 1.0.0` on the Grown-ups screen said the same on both builds, so nobody could
// tell. The cache name is now a function of the CONTENT, not of a literal somebody has to remember.
const BUILD = 'ef630a206a78'
const CACHE = 'be-' + VERSION + '-' + BUILD
const ASSETS = [
  './', './index.html', './404.html', './manifest.webmanifest', './favicon.ico',
  './css/app.css',
  './src/version.js', './src/main.js', './src/rng.js', './src/levels.js', './src/math.js', './src/explain.js',
  './src/elevator.js', './src/timeline.js', './src/trivia.js', './src/state.js', './src/save.js', './src/storage.js', './src/audio.js',
  './src/render/shaft.js', './src/render/panel.js', './src/render/screens.js',
  './data/trivia.json',
  './assets/icon.svg', './assets/icon-192.png', './assets/icon-512.png', './assets/apple-touch-icon.png', './assets/favicon-32.png',
  './assets/icon-maskable-192.png', './assets/icon-maskable-512.png',
]

self.addEventListener('install', (event) => {
  // Two deliberate things here.
  //
  // 1. cache:'reload' bypasses the BROWSER's HTTP cache. GitHub Pages sends
  //    `cache-control: max-age=600` on every asset, so a plain addAll() copies whatever the HTTP
  //    cache is still holding into the NEW version's cache: measured on a max-age=600 server, the
  //    new worker fetched ZERO assets and `be-1.0.1` ended up holding VERSION '1.0.0'. The trap
  //    fires whenever two deploys land within ten minutes with the app open in between — which is
  //    exactly what a hostile-review fix loop does on the owner's own phone.
  //
  // 2. No skipWaiting() here. The new worker WAITS until the update chip is tapped. With
  //    skipWaiting the deploy activated instantly, clients.claim() took the page over, and the tab
  //    reloaded itself mid-sum with no tap: measured, an unrequested navigation 3.1 s in, the
  //    child returned to the lobby. Nothing may move without the child's action.
  //    The message handler below still calls skipWaiting — that is the chip's own path.
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('be-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'skip-waiting') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  // ONLY THE APP ROOT IS THE APP. `req.mode === 'navigate'` classed EVERY in-scope navigation as
  // index.html, so a path two segments deep (`/bacon-elevator/floors/nope/x`) was answered with the
  // cached shell whose relative refs then resolved against `/floors/nope/` — measured on the live
  // deploy: HTTP 200, empty body, zero buttons or links, a blank white screen a non-reading child
  // cannot leave, and no reload recovers it. The deliberately built 404.html became dead code for
  // every client that had ever opened the game. Anything that is not the root now goes to the
  // network, so Pages serves the friendly page; offline, the same page comes out of the cache
  // (r3-deploy-pages-01).
  const root = new URL('./', self.location).pathname
  const isIndex = url.pathname === root || url.pathname === root + 'index.html'
  if (!isIndex && req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('./404.html').then((hit) => hit || caches.match('./index.html'))))
    return
  }
  if (isIndex) {
    // CACHE-FIRST index.html, from the versioned cache (DESIGN.md amendment 10; it was network-first).
    // Once the worker genuinely waits, network-first mixes versions: measured, the page loaded the
    // NEW index.html over the network while every module still came from the OLD be-1.0.0 cache and
    // stayed in that state until the chip was tapped. skipWaiting used to hide this by activating
    // instantly. Fetch only fills a miss; the update path runs entirely through the SW update check,
    // which the browser performs on every navigation.
    event.respondWith(
      caches.match('./index.html').then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => {})
        return res
      }).catch(() => caches.match('./')))
    )
    return
  }
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}) }
      return res
    }))
  )
})
