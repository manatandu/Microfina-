// Exofina : cache des seuls fichiers statiques, pour installer l'application (plan d'allègement, point 11.5 ; registre T154).
// Jamais les données : les appels /api/ passent toujours par le réseau et ne sont jamais gardés.
const CACHE = "exofina-statique-1";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/impression.html", "/manifest.webmanifest", "/icone-192.png", "/icone-512.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((noms) => Promise.all(noms.filter((n) => n !== CACHE).map((n) => caches.delete(n)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== self.location.origin || u.pathname.startsWith("/api/")) return;
  if (u.pathname.startsWith("/assets/")) {   // fichiers nommés par leur empreinte : ils ne changent jamais
    e.respondWith(caches.open(CACHE).then(async (c) => (await c.match(e.request)) ?? fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; })));
    return;
  }
  if (e.request.mode === "navigate") {      // la page d'entrée : le réseau d'abord, la copie gardée hors ligne
    e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const copie = r.clone(); caches.open(CACHE).then((c) => c.put("/", copie)); } return r; })
      .catch(() => caches.match("/")));
  }
});
