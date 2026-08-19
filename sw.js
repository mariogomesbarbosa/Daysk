/* Service worker do Daysk.
 *
 * Existe por duas razões, nesta ordem:
 *
 * 1. É ele que faz o Chrome no Android instalar um APP DE VERDADE (WebAPK) em
 *    vez de um atalho de favorito. Sem manifest e sem service worker, o
 *    "Adicionar à tela inicial" cria um atalho legado — e é esse atalho que
 *    aparece na home e não abre nada em vários launchers.
 * 2. Faz o app abrir sem rede, que num gerenciador de tarefas diárias no
 *    celular é o caso comum. Os dados já são locais (localStorage); o que
 *    faltava era o app carregar.
 *
 * Estratégia, e o porquê de cada uma:
 *
 * - DOCUMENTO: rede primeiro, cache como rede de segurança. Todo o app vive num
 *   único index.html, então cache-primeiro no documento significaria continuar
 *   vendo a versão velha depois de um deploy — o problema clássico. Rede
 *   primeiro custa alguns milissegundos e paga com "abrir online é sempre a
 *   versão nova".
 * - RESTO (ícones, fontes, Chart.js): serve do cache e revalida em segundo
 *   plano. São imutáveis na prática e é onde está o peso.
 * - AUTENTICAÇÃO DO GOOGLE: nunca passa por aqui. Cachear resposta de OAuth é
 *   pedir para o login quebrar de um jeito difícil de diagnosticar.
 */

const VERSAO = 'daysk-v1';
const APP = './';

/* Precache mínimo: o shell e os ícones. Deliberadamente NÃO inclui as CDNs —
   elas entram pelo caminho de revalidação, e uma CDN fora do ar no momento da
   instalação não pode impedir o service worker de instalar. */
const PRECACHE = [
  APP,
  'manifest.webmanifest',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',
];

const NUNCA_CACHEAR = [
  'accounts.google.com',
  'apis.google.com',
  'www.googleapis.com',
  'oauth2.googleapis.com',
  'content.googleapis.com',
];

self.addEventListener('install', evento => {
  evento.waitUntil(
    caches.open(VERSAO)
      // allSettled e não all: um único 404 no precache faria a instalação
      // inteira falhar, e sem service worker não há instalação do app.
      .then(cache => Promise.allSettled(PRECACHE.map(u => cache.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', evento => {
  evento.waitUntil(
    caches.keys()
      .then(chaves => Promise.all(
        chaves.filter(k => k !== VERSAO).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', evento => {
  const req = evento.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch { return; }
  if (NUNCA_CACHEAR.includes(url.hostname)) return;

  if (req.mode === 'navigate') {
    evento.respondWith(
      fetch(req)
        .then(res => {
          const copia = res.clone();
          caches.open(VERSAO).then(c => c.put(APP, copia));
          return res;
        })
        // Sem rede: a última versão que carregou. Cai no shell e não na URL
        // pedida porque o app é uma página só — a navegação é toda interna.
        .catch(() => caches.match(APP).then(r => r || caches.match(req)))
    );
    return;
  }

  evento.respondWith(
    caches.match(req).then(cacheado => {
      const daRede = fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copia = res.clone();
          caches.open(VERSAO).then(c => c.put(req, copia));
        }
        return res;
      }).catch(() => cacheado);
      return cacheado || daRede;
    })
  );
});
