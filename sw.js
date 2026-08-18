// sw.js — 离线缓存壳
// v29：优化分类编辑弹窗 UI。删除按钮改为右上角 icon-only 垃圾桶图标；底部仅保留「取消/完成」两按钮；输入框与按钮间距加大。
// 切换 CACHE 名称可彻底丢弃旧缓存，避免样式/图标残留。
const CACHE = 'dessert-v29';
const SHELL = [
  './',
  './manifest.json',
  './icons/app-icon-180.png',
  './icons/app-icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // 跨域（Tesseract CDN）不拦截

  // 页面文档：网络优先（离线时才回退缓存）→ 永远加载最新 HTML
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // 其他同源资源：缓存优先 + 后台更新
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetched = fetch(e.request).then((res) => {
        if (res && res.status === 200 && (res.type === 'basic' || res.type === 'default')) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});
