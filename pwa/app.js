const root = '/eastern-europe-kuera/';
const style = document.createElement('link');
style.rel = 'stylesheet';
style.href = root + 'pwa/app.css';
document.head.append(style);
if (!document.querySelector('link[rel="manifest"]')) {
  const manifest = document.createElement('link');
  manifest.rel = 'manifest';
  manifest.href = root + 'manifest.webmanifest';
  document.head.append(manifest);
  const icon=document.createElement('link');
  icon.rel='apple-touch-icon';
  icon.href=root+'pwa/icon-180.png';
  document.head.append(icon);
  for (const [name,content] of [['theme-color','#081433'],['apple-mobile-web-app-capable','yes']]) {
    const meta=document.createElement('meta');
    meta.name=name; meta.content=content;
    document.head.append(meta);
  }
  const viewport=document.querySelector('meta[name="viewport"]');
  if(viewport && !viewport.content.includes('viewport-fit')) viewport.content+=', viewport-fit=cover';
}
if (!location.pathname.includes('/pwa/')) {
  const settings = document.createElement('a');
  settings.className = 'cee-entry';
  settings.href = root + 'pwa/settings.html';
  settings.textContent = '뉴스 알림 받기 · 설정';
  document.body.append(settings);
}
let banner;
function offline(message) {
  banner ??= document.createElement('div');
  banner.className = 'cee-status';
  banner.setAttribute('role','status');
  banner.textContent = message;
  document.body.prepend(banner);
}
function connection() {
  if (!navigator.onLine) offline('오프라인 · 저장된 내용을 표시합니다. 최신 뉴스, 외부 지도와 링크에는 인터넷 연결이 필요합니다.');
}
connection();
addEventListener('offline',connection);
if ('serviceWorker' in navigator) {
  const sw = navigator.serviceWorker;
  let apply = false;
  sw.addEventListener('controllerchange', () => {
    if (apply) { apply = false; location.reload(); }
  });
  sw.addEventListener('message',e => {
    if (e.data === 'cached-content') offline('저장된 내용을 표시하고 있습니다. 최신 뉴스는 연결을 확인한 뒤 새로고침해 주세요.');
  });
  sw.register(root+'sw.js',{scope:root,updateViaCache:'none'}).then(reg => {
    let notice;
    function offer() {
      if (!reg.waiting || !sw.controller || notice?.isConnected) return;
      notice = document.createElement('aside');
      notice.className = 'cee-notice';
      notice.textContent = '새 버전이 준비되었습니다. ';
      const button = document.createElement('button');
      button.textContent = '업데이트 적용';
      button.onclick = () => {
        if (reg.waiting) { apply = true; reg.waiting.postMessage('apply-update'); }
        else location.reload();
      };
      notice.append(button);
      document.body.append(notice);
    }
    function watch(worker) { worker?.addEventListener('statechange',offer); }
    reg.addEventListener('updatefound',() => watch(reg.installing));
    watch(reg.installing);
    offer();
    function check() { offer(); reg.update().catch(()=>{}); }
    check();
    addEventListener('pageshow',check);
    document.addEventListener('visibilitychange',() => { if (!document.hidden) check(); });
  }).catch(()=>{});
}
