// Bacon Elevator service worker. Network-first index.html, cache-first relative assets.
// The cache name embeds src/version.js's VERSION (test/version.test.js keeps them equal).
const VERSION = '1.0.0'
const CACHE = 'be-' + VERSION
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './favicon.ico',
  './css/app.css',
  './src/version.js', './src/main.js', './src/rng.js', './src/levels.js', './src/math.js', './src/explain.js',
  './src/elevator.js', './src/timeline.js', './src/trivia.js', './src/state.js', './src/save.js', './src/storage.js', './src/audio.js',
  './src/render/shaft.js', './src/render/panel.js', './src/render/screens.js',
  './data/trivia.json',
  './assets/icon.svg', './assets/icon-192.png', './assets/icon-512.png', './assets/apple-touch-icon.png', './assets/favicon-32.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()))
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
  const isIndex = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')
  if (isIndex) {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => {})
        return res
      }).catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
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
