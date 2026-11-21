const utf8 = new TextEncoder();
export const encode = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export const decode = value => Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const join=(...parts)=>new Uint8Array(parts.flatMap(p=>Array.from(p)));
async function derive(input,salt,info,bits) {
  const key=await crypto.subtle.importKey('raw',input,'HKDF',false,['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},key,bits));
}
export async function encrypt(subscription,payload) {
  const recipient=decode(subscription.keys.p256dh);
  const peer=await crypto.subtle.importKey('raw',recipient,{name:'ECDH',namedCurve:'P-256'},false,[]);
  const pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  const pub=new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey));
  const shared=await crypto.subtle.deriveBits({name:'ECDH',public:peer},pair.privateKey,256);
  const secret=await derive(shared,decode(subscription.keys.auth),join(utf8.encode('WebPush: info\0'),recipient,pub),256);
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const cek=await derive(secret,salt,utf8.encode('Content-Encoding: aes128gcm\0'),128);
  const iv=await derive(secret,salt,utf8.encode('Content-Encoding: nonce\0'),96);
  const key=await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['encrypt']);
  const record=join(utf8.encode(JSON.stringify(payload)),[2]);
  if(record.length>3993)throw Error('oversize');
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,record);
  return join(salt,[0,0,16,0,65],pub,new Uint8Array(cipher));
}
export async function authorization(endpoint,env) {
  const raw=decode(env.VAPID_PUBLIC_KEY);
  const key=await crypto.subtle.importKey('jwk',{kty:'EC',crv:'P-256',x:encode(raw.slice(1,33)),y:encode(raw.slice(33)),d:env.VAPID_PRIVATE_KEY},{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
  const part=value=>encode(utf8.encode(JSON.stringify(value)));
  const jwt=part({typ:'JWT',alg:'ES256'})+'.'+part({aud:new URL(endpoint).origin,exp:Math.floor(Date.now()/1000)+3600,sub:env.VAPID_SUBJECT});
  const sig=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,utf8.encode(jwt));
  return 'vapid t='+jwt+'.'+encode(sig)+', k='+env.VAPID_PUBLIC_KEY;
}
export async function deliverDetailed(sub,message,env) {
  let auth,payload;
  try{auth=await authorization(sub.endpoint,env);}catch(e){return {status:-1,reason:'Vapid'+(['DataError','OperationError','InvalidCharacterError','TypeError'].includes(e.name)?e.name:'Error')};}
  try{payload=await encrypt(sub,message);}catch(e){return {status:-1,reason:'Payload'+(['DataError','OperationError','InvalidCharacterError','TypeError'].includes(e.name)?e.name:'Error')};}
  const res=await fetch(sub.endpoint,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(12000),headers:{TTL:'3600',Authorization:auth,'Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream'},body:payload});
  let reason;
  try {const body=await res.json();if(typeof body.reason==='string' && /^[A-Za-z]{1,80}$/.test(body.reason))reason=body.reason;}catch{}
  return {status:res.status,...(reason?{reason}:{})};
}

export async function deliver(sub,message,env) {return (await deliverDetailed(sub,message,env)).status;}
