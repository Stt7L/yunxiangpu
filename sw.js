// sw.js — 离线缓存壳
// v91：给整个应用铺一层「加浓彩色渐变底」，并把 Dock 白雾 30%→18%、饱和 210%→240%、模糊系数 0.14→0.17。
//      原因：液态玻璃的观感完全来自「玻璃后面有足够饱和的颜色」——白底上无论怎么调参数都只是一块白板。
//      淡彩版经 A/B 实现在玻璃里几乎看不出颜色，故取加浓版配色（暖橙/天蓝/薄荷/玫瑰）。
// v90：按开源项目 Kyant0/AndroidLiquidGlass（Apache-2.0）的 AGSL 着色器算法重写折射与边缘高光——
//      折射缓动改用 circleMap(1-depth/h)（位移更集中在贴边一圈，形成真正的透镜鼓边）；
//      梯度用放大后的圆角计算；滤镜区域改为精确等于元素尺寸（修掉 v88 区域过大导致位移贴图被拉伸错位的 bug）；
//      边缘高光改为按 SDF 法线做方向性受光（顶缘白边、底缘黑边），并按设备像素比生成保证 Retina 锐利。
// v89：调亮 Dock / 批处理胶囊的「玻璃感」——白雾 46%→30%（胶囊 55%→42%）、模糊 26px→12px（胶囊 14px），
//      并加 .5px 暗色发丝内描边。原因：页面多为白底浅色内容，「重白雾 + 大模糊」会把背景糊成纯白，
//      玻璃看起来就是一块白板；降低白雾、减小模糊后背景能透出来，玻璃感才成立。
// v88：Dock 与部分界面改用液态玻璃（Liquid Glass）——顶光层 + 蒙版描边高光（全平台可见）；
//      Chromium 下再把 SVG 位移贴图折射滤镜接进 backdrop-filter（blur+saturate+url(#lgWarp)）实现边缘折射与色差。
//      关键：折射必须写在 backdrop-filter 里而非 filter，否则图标文字会被一起扭曲；Safari/Firefox 不支持，自动降级为纯模糊玻璃。
// v92：应用名改为「云享谱demo」（标题/品牌/分享名/导出文件名/manifest，5 语言同步）；
//      移除 v91 的彩色渐变底（暖桃/天蓝/薄荷/玫瑰），回到单一浅灰底 --bg；
//      连带回退玻璃参数（Dock 白雾 18%→30%、饱和 240%→180%，批处理胶囊 26%→42%，导航栏 55%→72%）。
// v93：底部 Dock 按 **iOS 27 Liquid Glass** 规则重做（WWDC 2026 方向）——
//      ① 明确边框取代投影（外圈暗边 darkened edge + 内圈亮边 defined border），解决纯浅底上玻璃发灰；
//      ② 镜面高光提亮（specular 更亮）；③ 扩散增强（白雾 30%→56%、模糊 10px→20px）提升可读性；
//      ④ 标签栏选中项背景由浅蓝高亮改为中性深色（iOS 27 明确变化）；
//      ⑤ 中央「＋」按 prominent tab 语义套用同一套边框语言。
// 切换 CACHE 名称可彻底丢弃旧缓存，避免样式/图标残留。
const CACHE = 'dessert-v93';
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
