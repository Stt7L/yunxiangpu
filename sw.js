// sw.js — 离线缓存壳
// v69：电脑端顶部导航进一步贴边（.nav-inner padding 14→8px）；手机端批处理胶囊改为横向滚动并保留文字；修复新建共享配方后本地临时 id 未清理导致的「作者无法编辑自己作品」bug；「我的」页面新增「我发布的」共享配方历史。
// 切换 CACHE 名称可彻底丢弃旧缓存，避免样式/图标残留。
const CACHE = 'dessert-v69';
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
