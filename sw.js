/* =========================================================================
   Service Worker escopado por aplicativo.
   Copie este arquivo para DENTRO da pasta de cada projeto (Zenny/sw.js e
   Daysk/sw.js) e altere APENAS a constante APP_ID em cada cópia.
   Um sw.js na raiz do repositório username.github.io controlaria os dois
   apps ao mesmo tempo — é exatamente o que queremos evitar.
   ========================================================================= */

const APP_ID = 'zenny';          // <-- em Daysk/sw.js troque para 'daysk'
const VERSION = 'v1';
const CACHE_NAME = `${APP_ID}-${VERSION}`;

// Caminhos relativos ao sw.js, ou seja, relativos à pasta do app.
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // addAll falha inteiro se um arquivo faltar; add individual é mais tolerante
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            // remove só as versões antigas DESTE app, nunca as do outro
            .filter((key) => key.startsWith(`${APP_ID}-`) && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  // Ignora qualquer requisição fora do escopo deste app.
  if (!request.url.startsWith(self.registration.scope)) return;

  // Navegação: rede primeiro, cai para o cache offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  // Demais arquivos: cache primeiro, rede como reforço.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
