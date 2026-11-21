import test from 'node:test';
import assert from 'node:assert/strict';
import {createECDH,createDecipheriv,hkdfSync,createPublicKey,verify} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker,{validEndpoint,message} from './worker.mjs';
import {authorization,encrypt,encode,deliverDetailed} from './webpush.mjs';
const origin='https://mihail-nz.github.io';
const endpoint='https://web.push.apple.com/Qtest';
const utf8=s=>Buffer.from(s);
const keys=createECDH('prime256v1');keys.generateKeys();
const auth=crypto.getRandomValues(new Uint8Array(16));
const sub={endpoint,keys:{p256dh:encode(keys.getPublicKey()),auth:encode(auth)}};
const news={id:'daily-01',title:'폴란드 소식',body:'경제 브리핑',url:'news/index.html?date=2026-11-21#daily',all:false,country:'폴란드'};
test('RFC 8291 receiver decrypts the encrypted Korean payload',async()=>{
  const record=Buffer.from(await encrypt(sub,news));
  assert.equal(record.readUInt32BE(16),4096);assert.equal(record[20],65);
  const sender=record.subarray(21,86);
  const ikm=hkdfSync('sha256',keys.computeSecret(sender),auth,Buffer.concat([utf8('WebPush: info\0'),keys.getPublicKey(),sender]),32);
  const derive=(s,n)=>Buffer.from(hkdfSync('sha256',ikm,record.subarray(0,16),utf8('Content-Encoding: '+s+'\0'),n));
  const decipher=createDecipheriv('aes-128-gcm',derive('aes128gcm',16),derive('nonce',12));
  decipher.setAuthTag(record.subarray(-16));
  const plain=Buffer.concat([decipher.update(record.subarray(86,-16)),decipher.final()]);
  assert.equal(plain.at(-1),2);assert.deepEqual(JSON.parse(plain.subarray(0,-1)),news);
});
function variables(){
  const key=createECDH('prime256v1');key.generateKeys();
  return {VAPID_PUBLIC_KEY:encode(key.getPublicKey()),VAPID_PRIVATE_KEY:encode(key.getPrivateKey()),VAPID_SUBJECT:'mailto:fixture@example.org',ADMIN_TOKEN:'a'.repeat(40),RATE_SALT:'s'.repeat(32)};
}
test('VAPID ES256 signature and Apple audience',async()=>{
  const env=variables();
  const header=await authorization(endpoint,env);
  const [h,p,s]=header.split('t=')[1].split(',')[0].split('.');
  const claims=JSON.parse(Buffer.from(p,'base64url'));
  assert.equal(claims.aud,new URL(endpoint).origin);
  assert.ok(claims.exp>Date.now()/1000 && claims.exp<Date.now()/1000+86400);
  const raw=Buffer.from(env.VAPID_PUBLIC_KEY,'base64url');
  const key=createPublicKey({format:'jwk',key:{kty:'EC',crv:'P-256',x:encode(raw.subarray(1,33)),y:encode(raw.subarray(33))}});
  assert.ok(verify('sha256',utf8(h+'.'+p),{key,dsaEncoding:'ieee-p1363'},Buffer.from(s,'base64url')));
});
test('allowlisted endpoints, internal news links, explicit targeting',()=>{
  assert.ok(validEndpoint(endpoint));
  for(const url of ['http://web.push.apple.com/a','https://web.push.apple.com.bad.example/a','https://example.org/a','https://name@web.push.apple.com/a'])assert.equal(validEndpoint(url),false);
  for(const url of ['https://example.org','../admin','/eastern-europe-kuera/news/%2f'])assert.throws(()=>message({...news,url}));
  assert.throws(()=>message({...news,all:true}));assert.throws(()=>message({...news,country:''}));
});
test('subscription ownership, preferences, rate limits, delivery ledger and expiry',async t=>{
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('migrations/0001.sql',import.meta.url),'utf8'));
  const DB={prepare(sql){
    const statement=sqlite.prepare(sql);let args=[];
    return {bind(...values){args=values;return this;},first:()=>statement.get(...args),all:()=>({results:statement.all(...args)}),run:()=>({meta:statement.run(...args)})};
  }};
  const env={...variables(),DB,LIMIT:{limit:()=>({success:true})}};
  const owner='u'.repeat(64), second='v'.repeat(64);
  async function call(path,data,token=owner,source=origin){
    return worker.fetch(new Request('https://worker.example'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:source,Authorization:'Bearer '+token},body:JSON.stringify(data)}),env);
  }
  let status=201;
  let sent=0;t.mock.method(globalThis,'fetch',async()=>{sent++;return new Response(null,{status});});
  assert.equal((await call('/admin/send',news)).status,401);
  assert.equal((await call('/subscribe',{subscription:sub},owner,'https://bad.example')).status,403);
  assert.equal((await call('/subscribe',{subscription:sub,country:'폴란드'})).status,200);
  assert.equal((await call('/subscribe',{subscription:sub},second)).status,403);
  assert.equal((await (await call('/status',{endpoint})).json()).country,'폴란드');
  await call('/delete',{endpoint},second);
  assert.equal((await call('/test',{endpoint})).status,200);
  assert.equal((await call('/test',{endpoint})).status,429);
  await call('/subscribe',{subscription:{...sub,endpoint:endpoint+'2'},country:'체코'},second);
  let result=await (await call('/admin/send',news,env.ADMIN_TOKEN)).json();
  assert.equal(result.done,false);
  result=await (await call('/admin/send',news,env.ADMIN_TOKEN)).json();
  assert.equal(result.accepted,1);assert.equal(result.done,true);
  await call('/admin/send',news,env.ADMIN_TOKEN);assert.equal(sent,2);
  assert.equal((await call('/admin/send',{...news,title:'changed'},env.ADMIN_TOKEN)).status,409);
  status=410;
  const all={...news,id:'global',all:true,country:''};
  await call('/admin/send',all,env.ADMIN_TOKEN);
  result=await (await call('/admin/send',all,env.ADMIN_TOKEN)).json();
  assert.equal(result.expired,2);assert.equal(sqlite.prepare('SELECT count(*) n FROM subscriptions').get().n,0);
  env.LIMIT.limit=()=>({success:false});
  assert.equal((await call('/subscribe',{subscription:sub})).status,429);
  sqlite.close();
});

test('delayed test only sends to its owner and cancels after unsubscribe',async t=>{
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('migrations/0001.sql',import.meta.url),'utf8'));
  const DB={prepare(sql){const s=sqlite.prepare(sql);let args=[];return {bind(...a){args=a;return this;},first:()=>s.get(...args),run:()=>({meta:s.run(...args)})};}};
  const env={...variables(),DB,LIMIT:{limit:()=>({success:true})}};
  const pending=[],destinations=[];
  const ctx={waitUntil(p){pending.push(p);}};
  const owner='u'.repeat(64),other='v'.repeat(64);
  const call=(path,body,token=owner)=>worker.fetch(new Request('https://worker.example'+path,{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)}),env,ctx);
  t.mock.method(globalThis,'fetch',async url=>{destinations.push(url);return new Response(null,{status:201});});
  t.mock.timers.enable({apis:['setTimeout']});
  try{
    await call('/subscribe',{subscription:sub});
    await call('/subscribe',{subscription:{...sub,endpoint:endpoint+'2'}},other);
    assert.equal((await call('/test',{endpoint,delaySeconds:15},other)).status,404);
    assert.equal((await call('/test',{endpoint,delaySeconds:30})).status,400);
    assert.equal(pending.length,0);
    assert.equal((await call('/test',{endpoint,delaySeconds:15})).status,202);
    assert.equal((await call('/test',{endpoint,delaySeconds:15})).status,429);
    assert.deepEqual(destinations,[]);
    t.mock.timers.tick(14999);assert.deepEqual(destinations,[]);
    t.mock.timers.tick(1);await Promise.all(pending);
    assert.deepEqual(destinations,[endpoint]);
    sqlite.exec('UPDATE subscriptions SET tested=0');
    assert.equal((await call('/test',{endpoint,delaySeconds:15})).status,202);
    await call('/delete',{endpoint});
    t.mock.timers.tick(15000);await Promise.all(pending);
    assert.deepEqual(destinations,[endpoint]);
    assert.equal((await call('/admin/test',{subscriptionId:2})).status,401);
    assert.equal((await call('/admin/test',{all:true},env.ADMIN_TOKEN)).status,400);
    assert.equal((await call('/admin/test',{subscriptionId:999},env.ADMIN_TOKEN)).status,404);
    const diagnostic=await (await call('/admin/test',{subscriptionId:2},env.ADMIN_TOKEN)).json();
    assert.equal(diagnostic.accepted,true);assert.equal(diagnostic.status,201);
    assert.deepEqual(destinations,[endpoint,endpoint+'2']);
  }finally{sqlite.close();}
});

test('Workers-compatible manual redirect never follows a push redirect',async t=>{
  let calls=0;
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    calls++;assert.equal(url,endpoint);assert.equal(options.redirect,'manual');
    return new Response(null,{status:302,headers:{Location:'https://untrusted.example/'}});
  });
  const result=await deliverDetailed(sub,news,variables());
  assert.equal(result.status,302);assert.equal(calls,1);
});
