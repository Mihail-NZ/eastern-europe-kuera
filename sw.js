const ROOT = new URL(self.registration.scope);
const PREFIX = 'cee-side-eastern-europe-kuera-';
const VERSION = '2026-11-21.6';
const CORE = PREFIX + VERSION + '-core';
const PAGES = PREFIX + VERSION + '-visited';
const essentials = ['', 'index.html','pwa/offline.html','pwa/settings.html','manifest.webmanifest','pwa/app.css','pwa/app.js','pwa/settings.js','pwa/config.js','pwa/icon-180.png','pwa/icon-192.png','pwa/icon-512.png','assets/images/kuera/kuera-badge.png','assets/css/site.css','assets/js/site.js','assets/js/data-map.js','assets/js/data-countries.js','assets/js/data-news.js'];
essentials.push('pwa/topics.mjs');
const urlFor = path => new URL(path,ROOT).href;
self.addEventListener('install', e => e.waitUntil(caches.open(CORE).then(cache =>
  cache.addAll(essentials.map(path => new Request(urlFor(path),{cache:'reload'}))))));
self.addEventListener('activate',e => e.waitUntil((async()=>{
  for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key!==CORE && key!==PAGES) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('message', e => { if (e.data==='apply-update') e.waitUntil(self.skipWaiting()); });
function eligible(url,request) {
  if (request.method!=='GET' || request.headers.has('authorization') || request.headers.has('range') || url.origin!==ROOT.origin || !url.pathname.startsWith(ROOT.pathname)) return false;
  const path = url.pathname.slice(ROOT.pathname.length);
  // News date/country are public client-side filters over the same HTML.
  const newsPage = path==='news/' || path==='news/index.html';
  if ([...url.searchParams.keys()].some(k=>k!=='v' && !(newsPage && ['date','country'].includes(k)))) return false;
  return essentials.includes(path) || /^(countries|news|travel|about|jobs|games)\/(?:[a-z0-9-]+\/)*(?:index\.html)?$/.test(path) || /^assets\/(js|css)\/[\w.-]+\.(js|css)$/.test(path);
}
async function serve(event,url) {
  const key = url.origin+url.pathname;
  const core = await caches.open(CORE);
  const coreFile = essentials.includes(url.pathname.slice(ROOT.pathname.length));
  const cache = coreFile ? core : await caches.open(PAGES);
  try {
    const response = await fetch(event.request,{cache:'no-cache'});
    if (response.ok && !response.redirected && !/private|no-store/i.test(response.headers.get('cache-control') || '')) {
      try {
        await cache.put(key,response.clone());
        if (!coreFile) { const keys = await cache.keys(); for (const old of keys.slice(0,-100)) await cache.delete(old); }
      } catch { /* Storage limits must not interrupt online browsing. */ }
    }
    if (response.status < 500) return response;
    throw Error('temporarily unavailable');
  } catch {
    const saved = await cache.match(key);
    if (saved) {
      if (event.request.mode==='navigate') {
        const html=(await saved.text()).replace(/<body\b[^>]*>/i, tag=>tag+'<aside class="cee-status" role="status">저장된 페이지입니다. 최신 뉴스와 외부 지도는 인터넷 연결 후 확인해 주세요.</aside>');
        return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8'}});
      }
      const client = event.clientId && await self.clients.get(event.clientId);
      if (client) client.postMessage('cached-content');
      return saved;
    }
    if (event.request.mode==='navigate') return await core.match(urlFor('pwa/offline.html')) || Response.error();
    return Response.error();
  }
}
self.addEventListener('fetch',e => {
  const url = new URL(e.request.url);
  if (eligible(url,e.request)) e.respondWith(serve(e,url));
  else if (e.request.mode==='navigate' && e.request.method==='GET' && url.origin===ROOT.origin && url.pathname.startsWith(ROOT.pathname)) {
    e.respondWith(fetch(e.request).catch(async()=> (await caches.open(CORE)).match(urlFor('pwa/offline.html'))));
  }
});
function landing(value) {
  try {
    const u=new URL(value,ROOT);
    if (u.origin===ROOT.origin && u.pathname.startsWith(ROOT.pathname+'news/') && !u.username && !u.password) return u.href;
  } catch {}
  return urlFor('news/');
}
self.addEventListener('push',e=>{
  let data={};
  try { data=e.data.json() || {}; } catch {}
  e.waitUntil(self.registration.showNotification(data.title || 'CEE Side 뉴스',{body:data.body || '새 브리핑을 확인하세요.',icon:urlFor('pwa/icon-192.png'),tag:data.id,data:{url:landing(data.url)}}));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  const target=landing(e.notification.data?.url);
  e.waitUntil((async()=>{
    const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
    const existing=windows.find(w=>w.url===target);
    if (existing) return existing.focus();
    return clients.openWindow(target);
  })());
});
