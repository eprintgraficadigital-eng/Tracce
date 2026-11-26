/* Traço — Service Worker (versão 1.5)
   Faz o programa abrir mesmo sem internet depois do primeiro acesso.
   Ao publicar uma versão nova, troque o número em CACHE_NAME (ex.: traco-pwa-v1.6). */
const CACHE_NAME = 'traco-pwa-v1.5';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('traco-pwa-') && k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

const stamp = r => r ? (r.headers.get('etag') || r.headers.get('last-modified') || r.headers.get('content-length') || '') : '';

async function tellClients(msg) {
  const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  all.forEach(c => c.postMessage(msg));
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  /* Página principal: abre na hora pelo cache e confere no servidor se há versão nova. */
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = (await cache.match('./index.html')) || (await cache.match('./'));
      const update = fetch(request, { cache: 'no-cache' }).then(async response => {
        if (response && response.ok) {
          const changed = cached && stamp(cached) !== stamp(response);
          await cache.put('./index.html', response.clone());
          if (changed) tellClients({ type: 'traco-update' });
        }
        return response;
      }).catch(() => null);
      if (cached) { event.waitUntil(update); return cached; }
      return (await update) || Response.error();
    })());
    return;
  }

  /* Demais arquivos (ícones, manifest): cache primeiro. */
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && response.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      return Response.error();
    }
  })());
});
