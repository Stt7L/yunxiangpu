// sw.js — 离线缓存壳
// v89：调亮 Dock / 批处理胶囊的「玻璃感」——白雾 46%→30%（胶囊 55%→42%）、模糊 26px→12px（胶囊 14px），
//      并加 .5px 暗色发丝内描边。原因：页面多为白底浅色内容，「重白雾 + 大模糊」会把背景糊成纯白，
//      玻璃看起来就是一块白板；降低白雾、减小模糊后背景能透出来，玻璃感才成立。
// v88：Dock 与部分界面改用液态玻璃（Liquid Glass）——顶光层 + 蒙版描边高光（全平台可见）；
//      Chromium 下再把 SVG 位移贴图折射滤镜接进 backdrop-filter（blur+saturate+url(#lgWarp)）实现边缘折射与色差。
//      关键：折射必须写在 backdrop-filter 里而非 filter，否则图标文字会被一起扭曲；Safari/Firefox 不支持，自动降级为纯模糊玻璃。
// 切换 CACHE 名称可彻底丢弃旧缓存，避免样式/图标残留。
const CACHE = 'dessert-v89';
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
