import {deliver,decode,encode} from './webpush.mjs';
import {countries,categories} from '../pwa/topics.mjs';
const origin='https://mihail-nz.github.io';
const root=origin+'/eastern-europe-kuera/';
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':origin,'Vary':'Origin'}});
class Problem extends Error {constructor(status){super();this.status=status;}}
function requireThat(ok,status=400){if(!ok)throw new Problem(status);}
const digest=async value=>encode(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
export function validEndpoint(value){
  try {
    const u=new URL(value);
    return typeof value==='string' && value.length<=2048 && u.protocol==='https:' && !u.username && !u.password && !u.port && !u.hash && u.pathname.length>1 &&
      (u.hostname==='web.push.apple.com' || u.hostname.endsWith('.push.apple.com') || u.hostname==='fcm.googleapis.com' || u.hostname==='updates.push.services.mozilla.com');
  } catch {return false;}
}
function topics(body) {
  const country=body.country??'',category=body.category??'';
  requireThat((country==='' || countries.includes(country)) && (category==='' || categories.includes(category)));
  return {country,category};
}
export function message(body){
  const {country,category}=topics(body);
  requireThat(typeof body.id==='string' && /^[\w.-]{1,80}$/.test(body.id));
  requireThat(typeof body.title==='string' && body.title.trim() && body.title.length<=90 && typeof body.body==='string' && body.body.length<=360);
  let url;try{url=new URL(body.url,root);}catch{throw new Problem(400);}
  requireThat(typeof body.url==='string' && url.origin===origin && !url.username && !url.password && /^\/eastern-europe-kuera\/news\/(index\.html)?$/.test(url.pathname));
  requireThat(body.all===true ? !country && !category : body.all===false && (country || category));
  return {id:body.id,title:body.title,body:body.body,url:url.href,country,category,all:body.all};
}
async function readBody(request){
  requireThat(request.headers.get('content-type')?.split(';')[0]==='application/json',415);
  const reader=request.body?.getReader();
  requireThat(reader);
  const chunks=[];let length=0;
  while(true){
    const {done,value}=await reader.read();if(done)break;
    length+=value.length;if(length>8192){await reader.cancel();throw new Problem(413);}
    chunks.push(value);
  }
  try{const data=await new Response(new Blob(chunks)).json();requireThat(data && typeof data==='object' && !Array.isArray(data));return data;}catch{throw new Problem(400);}
}
async function send(row,payload,env){
  let status;
  try{status=await deliver({endpoint:row.endpoint,keys:row},payload,env);}catch{status=-1;}
  if(status===404 || status===410) await env.DB.prepare('DELETE FROM subscriptions WHERE id=? AND auth=?').bind(row.id,row.auth).run();
  return status;
}
async function admin(body,env){
  const data=message(body), db=env.DB, serialized=JSON.stringify(data);
  await db.prepare('INSERT OR IGNORE INTO jobs(id,payload,ceiling) SELECT ?,?,COALESCE(MAX(id),0) FROM subscriptions').bind(data.id,serialized).run();
  const job=await db.prepare('SELECT * FROM jobs WHERE id=?').bind(data.id).first();
  requireThat(job.payload===serialized,409);
  let cursor=job.cursor;
  // One recipient per invocation bounds crypto CPU and outbound requests on Free.
  const row=await db.prepare("SELECT * FROM subscriptions WHERE id>? AND id<=? AND (? OR ((?='' OR country='' OR country=?) AND (?='' OR category='' OR category=?))) ORDER BY id LIMIT 1")
    .bind(cursor,job.ceiling,Number(data.all),data.country,data.country,data.category,data.category).first();
  if(row){
    const claim=await db.prepare('INSERT OR IGNORE INTO deliveries(job,recipient) VALUES(?,?)').bind(data.id,row.id).run();
    if(claim.meta.changes){
      const status=await send(row,data,env);
      await db.prepare('UPDATE deliveries SET status=? WHERE job=? AND recipient=?').bind(status,data.id,row.id).run();
    }
    cursor=row.id;
  }else cursor=job.ceiling;
  await db.prepare('UPDATE jobs SET cursor=MAX(cursor,?) WHERE id=?').bind(cursor,data.id).run();
  if(cursor<job.ceiling) return json({id:data.id,created:job.created,done:false,cursor});
  const counts=await db.prepare('SELECT status,COUNT(*) AS n FROM deliveries WHERE job=? GROUP BY status').bind(data.id).all();
  const stats={attempted:0,accepted:0,expired:0,failed:0,uncertain:0,errors:{}};
  for(const {status,n} of counts.results){
    stats.attempted+=n;
    if(status>=200 && status<300)stats.accepted+=n;
    else if(status===0)stats.uncertain+=n;
    else if(status===404 || status===410)stats.expired+=n;
    else {stats.failed+=n;stats.errors[status]=n;}
  }
  return json({id:data.id,created:job.created,done:cursor>=job.ceiling,...stats});
}
async function route(request,env){
  const path=new URL(request.url).pathname;
  const source=request.headers.get('Origin');
  if(source && source!==origin)throw new Problem(403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, GET','Access-Control-Allow-Headers':'content-type, authorization','Vary':'Origin'}});
  if(path==='/key' && request.method==='GET')return json({publicKey:env.VAPID_PUBLIC_KEY});
  requireThat(request.method==='POST',405);
  const auth=request.headers.get('Authorization') || '';
  if(path==='/admin/send'){
    requireThat(env.ADMIN_TOKEN?.length>=32 && await digest(auth)===await digest('Bearer '+env.ADMIN_TOKEN),401);
    return admin(await readBody(request),env);
  }
  requireThat(['/subscribe','/status','/test','/delete'].includes(path),404);
  requireThat(source===origin,403);
  requireThat(/^Bearer [A-Za-z0-9_-]{32,160}$/.test(auth),401);
  const ip=request.headers.get('CF-Connecting-IP') || 'local';
  requireThat(env.RATE_SALT?.length>=16,503);
  requireThat((await env.LIMIT.limit({key:await digest(env.RATE_SALT+ip)})).success,429);
  const owner=await digest(auth), body=await readBody(request);
  const endpoint=path==='/subscribe'?body.subscription?.endpoint:body.endpoint;
  requireThat(validEndpoint(endpoint));
  const db=env.DB;
  if(path==='/subscribe'){
    const {country,category}=topics(body);
    const keys=body.subscription?.keys;
    requireThat(keys && /^[\w-]{87}$/.test(keys.p256dh) && /^[\w-]{22}$/.test(keys.auth));
    try {await crypto.subtle.importKey('raw',decode(keys.p256dh),{name:'ECDH',namedCurve:'P-256'},false,[]);}catch{throw new Problem(400);}
    const change=await db.prepare('INSERT INTO subscriptions(endpoint,owner,p256dh,auth,country,category) VALUES(?,?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh,auth=excluded.auth,country=excluded.country,category=excluded.category WHERE subscriptions.owner=excluded.owner')
      .bind(endpoint,owner,keys.p256dh,keys.auth,country,category).run();
    requireThat(change.meta.changes,403);
    return json({registered:true});
  }
  const row=await db.prepare('SELECT * FROM subscriptions WHERE endpoint=? AND owner=?').bind(endpoint,owner).first();
  if(path==='/status')return json(row?{registered:true,country:row.country,category:row.category}:{registered:false});
  if(path==='/delete'){
    await db.prepare('DELETE FROM subscriptions WHERE endpoint=? AND owner=?').bind(endpoint,owner).run();
    return json({registered:false});
  }
  requireThat(row,404);
  const claim=await db.prepare('UPDATE subscriptions SET tested=unixepoch() WHERE id=? AND tested<unixepoch()-60').bind(row.id).run();
  requireThat(claim.meta.changes,429);
  const status=await send(row,{id:'cee-test',title:'CEE Side 테스트',body:'뉴스 알림이 연결되었습니다.',url:root+'news/'},env);
  return json({accepted:status>=200 && status<300},status>=200 && status<300?200:status===410 || status===404?410:502);
}
export default {async fetch(request,env){try{return await route(request,env);}catch(error){return json({error:'request_failed'},error instanceof Problem?error.status:500);}}};
