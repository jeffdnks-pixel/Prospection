// Service worker Prospectum — met en cache la coquille de l'app (HTML/CSS/JS)
// pour qu'elle s'ouvre même sans réseau. Les tuiles de carte (OpenStreetMap /
// ArcGIS) et la recherche d'adresse (Nominatim) NE SONT PAS mises en cache :
// elles nécessitent toujours une connexion active. C'est volontaire — voir
// l'audit technique pour le détail des raisons (politique d'usage des tuiles).

const CACHE_NAME = 'prospectum-shell-v1';
const SHELL_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet.heat/0.2.0/leaflet-heat.js',
  'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(
        SHELL_URLS.map(url =>
          cache.add(new Request(url, { mode: 'cors' })).catch(() => {
            // Une ressource CDN indisponible au moment de l'install ne doit
            // pas empêcher l'installation du reste du cache.
          })
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isShellAsset = SHELL_URLS.some(u => req.url.endsWith(u.replace('./', '')) || req.url === u);

  // Coquille de l'app : cache d'abord, réseau en secours (et mise à jour du cache)
  if (isShellAsset) {
    event.respondWith(
      caches.match(req).then(cached => {
        const network = fetch(req).then(resp => {
          if (resp && resp.ok) {
            caches.open(CACHE_NAME).then(cache => cache.put(req, resp.clone()));
          }
          return resp;
        }).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Tout le reste (tuiles de carte, Nominatim, etc.) : réseau uniquement,
  // aucune interception ni mise en cache.
});
