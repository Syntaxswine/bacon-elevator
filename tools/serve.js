// Minimal static server for local development. No dependencies.
//   node tools/serve.js [port]
// Serves the repo root exactly as GitHub Pages would (legacy builder, .nojekyll).
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = normalize(join(fileURLToPath(new URL('.', import.meta.url)), '..'))
const PORT = +(process.argv[2] || 8791)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
}

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    if (path.endsWith('/')) path += 'index.html'
    const file = normalize(join(ROOT, path))
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return }
    const s = await stat(file).catch(() => null)
    if (!s || !s.isFile()) { res.writeHead(404).end('404 ' + path); return }
    const body = await readFile(file)
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    }).end(body)
  } catch (e) {
    res.writeHead(500).end(String(e))
  }
}).listen(PORT, () => console.log(`bacon-elevator serving ${ROOT} at http://localhost:${PORT}/`))
