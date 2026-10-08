const CACHE_NAME = "kojak-ia-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Navegação (abrir o app/index.html): sempre busca a versão mais nova na rede
  // primeiro. Só usa o cache se estiver offline. Isso evita ficar preso numa
  // versão antiga do index.html que aponta pra arquivos JS/CSS que não existem
  // mais depois de um novo deploy (causa clássica de tela branca).
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  // Demais arquivos (JS/CSS/imagens com hash no nome): cache-first, mas sempre
  // atualiza o cache em segundo plano com o que vier da rede.
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
