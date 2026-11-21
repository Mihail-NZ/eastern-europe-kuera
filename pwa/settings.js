import {countries,categories} from './topics.mjs';
const $ = id=>document.getElementById(id);
for (const [field,items] of [['country',countries],['category',categories]]) for (const item of items) $(field).add(new Option(item,item));
const scope='/eastern-europe-kuera/';
const ownerKey='cee-side.push.owner.v1';
let reg, publicKey, subscription, registered=false, busy=false;
function show(message) { $('status').textContent=message; }
function buttons() {
  $('enable').disabled=busy || !reg || !publicKey || registered || Notification.permission==='denied';
  for (const id of ['test','save']) $(id).disabled=busy || !registered;
  $('disable').disabled=busy || !subscription;
}
async function api(path,data) {
  const response=await fetch(new URL(path,globalThis.CEE_PUSH_ORIGIN),data ? {method:'POST',credentials:'omit',headers:{'Content-Type':'application/json',Authorization:'Bearer '+localStorage.getItem(ownerKey)},body:JSON.stringify(data)} : {credentials:'omit'});
  if (!response.ok) throw new Error(response.status===429?'요청이 많습니다. 잠시 후 다시 시도해 주세요.':'서버 요청 실패 ('+response.status+'). 연결과 설정을 확인해 주세요.');
  return response.json();
}
function prefs(){return {country:$('country').value,category:$('category').value};}
async function start() {
  const ios=/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
  if (ios && !(navigator.standalone || matchMedia('(display-mode: standalone)').matches)) return show('Safari 공유 메뉴 → 홈 화면에 추가를 선택하고, 홈 화면 아이콘에서 다시 열어 주세요.');
  if (!('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window)) return show('이 환경은 웹 푸시를 지원하지 않습니다. iPhone에서는 iOS 16.4 이상이 필요합니다.');
  if (!globalThis.CEE_PUSH_ORIGIN) return show('운영자가 알림 서버를 연결하면 구독할 수 있습니다.');
  await navigator.serviceWorker.register(scope+'sw.js',{scope,updateViaCache:'none'});
  reg=await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('앱 준비가 지연되고 있습니다. 인터넷에 연결한 뒤 다시 열어 주세요.')),20000))]);
  subscription=await reg.pushManager.getSubscription();
  publicKey=(await api('/key')).publicKey;
  if (!localStorage.getItem(ownerKey)) localStorage.setItem(ownerKey,crypto.randomUUID()+crypto.randomUUID());
  if(subscription) {
    const state=await api('/status',{endpoint:subscription.endpoint});
    registered=state.registered;
    if(registered) { $('country').value=state.country; $('category').value=state.category; }
  }
  show(Notification.permission==='denied'?'알림 권한이 꺼져 있습니다. iPhone 설정의 알림에서 변경해 주세요.':registered?'뉴스 알림을 받고 있습니다.':'뉴스 알림이 꺼져 있습니다.');
}
async function enable() {
  const permission=await Notification.requestPermission();
  if(permission!=='granted') return show('권한이 허용되지 않았습니다. 기기 알림 설정을 확인해 주세요.');
  const binary=atob(publicKey.replace(/-/g,'+').replace(/_/g,'/'));
  subscription ??= await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:Uint8Array.from(binary,c=>c.charCodeAt(0))});
  await api('/subscribe',{subscription:subscription.toJSON(),...prefs()});
  registered=true; show('뉴스 알림을 받고 있습니다.');
}
async function disable(){
  await api('/delete',{endpoint:subscription.endpoint});
  await subscription.unsubscribe();
  registered=false; subscription=null;
  show('구독을 해제하고 서버의 구독 정보를 삭제했습니다.');
}
const actions={enable,disable,test:async()=>{await api('/test',{endpoint:subscription.endpoint}); show('푸시 서비스가 테스트 알림을 접수했습니다. 기기에서 수신을 확인해 주세요.');},save:async()=>{await api('/subscribe',{subscription:subscription.toJSON(),...prefs()});show('수신 설정을 저장했습니다.');}};
for (const [id,action] of Object.entries(actions)) $(id).onclick=async()=>{
  if(busy)return;
  busy=true; buttons();
  try{await action();}catch(e){show(e.message);}finally{busy=false; buttons();}
};
start().catch(e=>show(e.message)).finally(buttons);
