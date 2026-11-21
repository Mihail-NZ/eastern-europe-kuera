import test from 'node:test';
import assert from 'node:assert/strict';
import {selectBriefing,koreaDate,runDaily} from './daily-worker.mjs';
const today='2026-11-22',start='2026-11-21',now=Date.parse('2026-11-22T00:00:00+09:00');
const day={date:today,stories:['top','v4','baltic','wbalkan','sbalkan','east'].map(region=>({region,title:'제목',points:['1','2','3'],sources:[{url:'https://example.org'}]}))};
const source=d=>'/* source */\nwindow.NEWS_DATA='+JSON.stringify(d)+';\n';
test('Korean midnight gate excludes old and future news, and edits retain the same delivery ID/body',()=>{
 assert.equal(koreaDate(now-1),start);assert.equal(koreaDate(now),today);
 assert.equal(selectBriefing(source([day]),start,start),null);
 assert.equal(selectBriefing(source([{...day,date:start}]),today,start),null);
 assert.equal(selectBriefing(source([{...day,date:'2026-11-23'}]),today,start),null);
 const msg=selectBriefing(source([day]),today,start);assert.equal(msg.id,'briefing-'+today);assert.ok(msg.url.endsWith('?date='+today+'#daily'));
 assert.deepEqual(selectBriefing(source([{...day,overview:'edited'}]),today,start),msg);
 assert.throws(()=>selectBriefing('alert(1)',today,start));
 assert.throws(()=>selectBriefing(source([{...day,stories:[]}]),today,start));
});
test('preview checks sender authentication but never creates a send job; pre-start run never sends',async()=>{
 const calls=[];const env={AUTO_PUSH:'true',START_AFTER:start,ADMIN_TOKEN:'a'.repeat(40),PUSH:{async fetch(url,options){calls.push(JSON.parse(options.body));return new Response(null,{status:400});}}};
 const fetcher=async()=>new Response(source([day]));
 assert.equal((await runDaily(env,{now,preview:true,fetcher})).state,'preview-ready');assert.deepEqual(calls,[{}]);calls.length=0;
 assert.equal((await runDaily(env,{now:now-1,fetcher})).state,'before-start');assert.equal(calls.length,0);
});
test('published briefing batches use identical payloads; missing page and disabled mode never send',async()=>{
 const calls=[];const env={AUTO_PUSH:'true',START_AFTER:start,ADMIN_TOKEN:'a'.repeat(40),PUSH:{async fetch(url,options){calls.push(options.body);return Response.json({done:calls.length===2,accepted:2,expired:0});}}};
 const fetcher=async url=>String(url).includes('data-news.js')?new Response(source([day])):new Response('<html>',{headers:{'Content-Type':'text/html'}});
 assert.equal((await runDaily(env,{now,fetcher})).state,'done');assert.equal(calls.length,2);assert.equal(calls[0],calls[1]);
 calls.length=0;await assert.rejects(runDaily(env,{now,fetcher:async url=>String(url).includes('data-news.js')?new Response(source([day])):new Response(null,{status:404})}));assert.equal(calls.length,0);
 assert.equal((await runDaily({...env,AUTO_PUSH:'false'},{now,fetcher})).state,'disabled');
});
