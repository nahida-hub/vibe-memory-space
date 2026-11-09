const CACHE_NAME = "vibe-memory-pwa-v2";
const PRECACHE_URLS = ["/", "/manifest.json", "/icon.svg"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // Ignore individual asset failure during install
      });
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // 只缓存 GET 请求，放行所有大模型 POST 请求（如 DeepSeek 直连或 /api/ai/distill）
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // 对于同源页面与 Next.js 静态资源，采用 Network First + Offline Cache Fallback 策略
  // 确保电脑开着时永远获取最新界面，电脑关机或手机出门离线时直接从手机本地缓存秒开 App！
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (networkResponse.type === "basic" || networkResponse.type === "cors")
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // 如果是页面导航请求且离线，返回已缓存的首页壳子
          if (request.mode === "navigate") {
            const rootCache = await caches.match("/");
            if (rootCache) return rootCache;
          }
          return new Response("Offline - 记忆手账离线模式运行中", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        })
    );
  }
});
