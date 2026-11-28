const APP_SHELL_CACHE = 'voiceguard-app-shell-v1'
const APP_SHELL_PATHS = [
  '/manifest.webmanifest',
  '/icons/voiceguard-192.png',
  '/icons/voiceguard-512.png',
]
const APP_ASSET_PATTERN = /(?:src|href)=["'](\/assets\/[^"']+)["']/g

async function cacheIfAvailable(cache, path) {
  try {
    const response = await fetch(path, { cache: 'reload' })
    if (response.ok) await cache.put(path, response)
  } catch {
    // Optional shell assets must not prevent the app shell from installing.
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_SHELL_CACHE)
    const response = await fetch('/', { cache: 'reload' })
    if (!response.ok) throw new Error('VoiceGuard app shell could not be cached')
    const html = await response.clone().text()
    await cache.put('/', response)
    const assets = [...html.matchAll(APP_ASSET_PATTERN)].map((match) => match[1])
    await Promise.all([...new Set([...APP_SHELL_PATHS, ...assets])].map((path) => cacheIfAvailable(cache, path)))
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys()
    await Promise.all(cacheNames
      .filter((name) => name.startsWith('voiceguard-app-shell-') && name !== APP_SHELL_CACHE)
      .map((name) => caches.delete(name)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // Worker, supervisor, auth, and other API data always goes to the network.
  if (url.pathname === '/api' || url.pathname.startsWith('/api/') || request.headers.has('Authorization')) return

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request)
        if (response.ok) {
          const cache = await caches.open(APP_SHELL_CACHE)
          await cache.put('/', response.clone())
        }
        return response
      } catch {
        return (await caches.match('/')) || Response.error()
      }
    })())
    return
  }

  if (url.pathname.startsWith('/assets/') || APP_SHELL_PATHS.includes(url.pathname)) {
    event.respondWith((async () => {
      const cached = await caches.match(request)
      if (cached) return cached
      const response = await fetch(request)
      if (response.ok) {
        const cache = await caches.open(APP_SHELL_CACHE)
        await cache.put(request, response.clone())
      }
      return response
    })())
  }
})
