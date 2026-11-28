import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distRoot = path.join(frontendRoot, 'dist')
const html = await readFile(path.join(distRoot, 'index.html'), 'utf8')
const manifest = JSON.parse(await readFile(path.join(distRoot, 'manifest.webmanifest'), 'utf8'))

assert.equal(manifest.display, 'standalone', 'manifest must use standalone display mode')
assert.equal(manifest.theme_color.toUpperCase(), '#0B4F3E')
assert.equal(manifest.background_color.toUpperCase(), '#F6EBD3')
assert.match(html, /<link[^>]+rel="manifest"[^>]+href="\/manifest\.webmanifest"/)

const requiredIcons = new Set(['192x192', '512x512'])
for (const icon of manifest.icons) {
  assert.ok(requiredIcons.has(icon.sizes), `unexpected PWA icon size: ${icon.sizes}`)
  requiredIcons.delete(icon.sizes)
  assert.match(icon.purpose, /maskable/)
  const png = await readFile(path.join(distRoot, icon.src.slice(1)))
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${icon.src} must be a PNG`)
  assert.equal(png.readUInt32BE(16), Number(icon.sizes.split('x')[0]))
  assert.equal(png.readUInt32BE(20), Number(icon.sizes.split('x')[1]))
}
assert.equal(requiredIcons.size, 0, 'manifest must include 192 and 512 icons')

const bundledAssets = [...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)].map((match) => match[1])
assert.ok(bundledAssets.length > 0, 'production HTML must include built JS/CSS assets')
for (const asset of bundledAssets) await readFile(path.join(distRoot, asset.slice(1)))

const serviceWorkerText = await readFile(path.join(distRoot, 'sw.js'), 'utf8')
new vm.Script(serviceWorkerText, { filename: 'sw.js' })
const apiBypass = serviceWorkerText.indexOf("if (url.pathname === '/api' || url.pathname.startsWith('/api/') || request.headers.has('Authorization')) return")
const navigationCaching = serviceWorkerText.indexOf('if (request.mode === \'navigate\')')
assert.ok(apiBypass >= 0 && apiBypass < navigationCaching, 'API and authenticated requests must bypass cache handling')

const listeners = new Map()
const cacheData = new Map()
const cache = {
  async put(key, response) { cacheData.set(new URL(typeof key === 'string' ? key : key.url, 'http://voiceguard.test').pathname, response.clone()) },
  async match(key) { const response = cacheData.get(new URL(typeof key === 'string' ? key : key.url, 'http://voiceguard.test').pathname); return response?.clone() },
}
const cachesApi = {
  async open() { return cache },
  async match(key) { return cache.match(key) },
  async keys() { return ['voiceguard-app-shell-v1'] },
  async delete() { return true },
}
let offline = false
const appShell = new Response(html, { status: 200, headers: { 'content-type': 'text/html' } })
const context = {
  self: {
    location: { origin: 'http://voiceguard.test' },
    clients: { claim: async () => {} },
    addEventListener(name, callback) { listeners.set(name, callback) },
    skipWaiting: async () => {},
  },
  caches: cachesApi,
  URL,
  Response,
  Headers,
  Request,
  fetch: async (resource) => {
    if (offline) throw new Error('network offline')
    const value = typeof resource === 'string' ? resource : resource.url
    const pathname = new URL(value, 'http://voiceguard.test').pathname
    if (pathname === '/') return appShell.clone()
    if (pathname === '/manifest.webmanifest') return new Response(JSON.stringify(manifest), { status: 200 })
    if (pathname.startsWith('/icons/')) return new Response('icon', { status: 200 })
    if (pathname.startsWith('/assets/')) return new Response('built asset', { status: 200 })
    return new Response('not found', { status: 404 })
  },
}
vm.runInNewContext(serviceWorkerText, context, { filename: 'sw.js' })

let installPromise
listeners.get('install')({ waitUntil(promise) { installPromise = promise } })
await installPromise
assert.ok(cacheData.has('/'), 'install must cache the SPA shell')
for (const asset of ['/manifest.webmanifest', ...manifest.icons.map((icon) => icon.src), ...bundledAssets]) {
  assert.ok(cacheData.has(asset), `install must cache the static asset ${asset}`)
}

offline = true
let offlineNavigation
listeners.get('fetch')({
  request: { method: 'GET', url: 'http://voiceguard.test/worker/hazard', mode: 'navigate', headers: new Headers() },
  respondWith(promise) { offlineNavigation = promise },
})
assert.equal((await offlineNavigation).status, 200, 'offline navigation must fall back to the cached shell')

for (const request of [
  { method: 'GET', url: 'http://voiceguard.test/api/hazards', mode: 'cors', headers: new Headers() },
  { method: 'GET', url: 'http://voiceguard.test/private/status', mode: 'cors', headers: new Headers({ Authorization: 'Bearer test-token' }) },
]) {
  let intercepted = false
  listeners.get('fetch')({ request, respondWith() { intercepted = true } })
  assert.equal(intercepted, false, 'API and authenticated requests must not be cached or intercepted')
}

assert.equal([...cacheData.keys()].some((key) => key === '/api' || key.startsWith('/api/')), false)
console.log('PWA manifest, icons, production assets, API cache boundary, and offline shell simulation passed.')
