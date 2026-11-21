const SITE='https://mihail-nz.github.io/eastern-europe-kuera/';
const API='https://cee-side-push.cee-side-kuera.workers.dev';
export const koreaDate=now=>new Date(now+9*3600000).toISOString().slice(0,10);
export function selectBriefing(source,today,startAfter){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(startAfter))throw Error('InvalidStartDate');
  const match=source.match(/^\s*\/\*[^]*?\*\/\s*window\.NEWS_DATA\s*=\s*(\[[^]*\])\s*;?\s*$/);
  if(!match)throw Error('InvalidNewsFormat');
  const days=JSON.parse(match[1]);
  if(!Array.isArray(days))throw Error('InvalidNewsData');
  if(today<=startAfter)return null;
  const day=days.find(d=>d.date===today);
  if(!day)return null;
  const regions=['top','v4','baltic','wbalkan','sbalkan','east'];
  if(!Array.isArray(day.stories)||day.stories.length!==6||!regions.every(r=>day.stories.some(s=>s.region===r&&typeof s.title==='string'&&s.title.trim()&&Array.isArray(s.points)&&s.points.length>=3&&Array.isArray(s.sources)&&s.sources.length)))throw Error('IncompleteBriefing');
  // Stable content, including body, keeps retries and editorial revisions idempotent.
  return {id:'briefing-'+today,title:'동유럽 데일리 브리핑',body:today+' 동유럽 주요 뉴스를 확인해 보세요.',url:SITE+'news/index.html?date='+today+'#daily',all:true};
}
export async function runDaily(env,{now=Date.now(),preview=false,fetcher=fetch}={}){
  const today=koreaDate(now);
  if(env.AUTO_PUSH!=='true')return {state:'disabled',today};
  if(!/^\d{4}-\d{2}-\d{2}$/.test(env.START_AFTER||''))throw Error('InvalidStartDate');
  const url=new URL('assets/js/data-news.js',SITE);url.searchParams.set('push-check',String(now));
  const response=await fetcher(url,{redirect:'manual',signal:AbortSignal.timeout(15000),headers:{'Cache-Control':'no-cache'}});
  if(response.status!==200)throw Error('NewsHTTP'+response.status);
  const source=await response.text();
  if(source.length>4000000)throw Error('NewsTooLarge');
  const message=selectBriefing(source,today,env.START_AFTER);
  // Validate the existing authenticated sender without creating a job or sending.
  if(preview){
    const probe=await env.PUSH.fetch(API+'/admin/send',{method:'POST',headers:{Authorization:'Bearer '+env.ADMIN_TOKEN,'Content-Type':'application/json'},body:'{}'});
    if(probe.status!==400)throw Error('SenderAuthHTTP'+probe.status);
    return {state:message?'preview-ready':'preview-no-new-briefing',today,startAfter:env.START_AFTER,senderAuthenticated:true,candidate:message?.id??null};
  }
  if(!message)return {state:today<=env.START_AFTER?'before-start':'no-new-briefing',today};
  const page=await fetcher(message.url,{redirect:'manual',signal:AbortSignal.timeout(15000)});
  if(page.status!==200||!page.headers.get('content-type')?.includes('text/html'))throw Error('NewsPageUnavailable');
  await page.body?.cancel();
  const body=JSON.stringify(message);
  // One recipient per backend invocation keeps Web Crypto within the Free CPU budget.
  // The next cron resumes this same D1 job if more than 25 recipients remain.
  for(let batch=0;batch<25;batch++){
    const sent=await env.PUSH.fetch(API+'/admin/send',{method:'POST',headers:{Authorization:'Bearer '+env.ADMIN_TOKEN,'Content-Type':'application/json'},body});
    if(!sent.ok)throw Error('SenderHTTP'+sent.status);
    const result=await sent.json();
    if(result.done){
      if(result.failed||result.uncertain)throw Error('DeliveryRequiresReview');
      return {state:'done',today,id:message.id,accepted:result.accepted,expired:result.expired};
    }
  }
  return {state:'continuing-next-check',today,id:message.id};
}
async function authorized(request,env){
  if(!env.ADMIN_TOKEN||env.ADMIN_TOKEN.length<32)return false;
  const hash=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
  const a=await hash(request.headers.get('Authorization')||''),b=await hash('Bearer '+env.ADMIN_TOKEN);
  return a.every((v,i)=>v===b[i]);
}
export default {
  async scheduled(controller,env){
    const result=await runDaily(env,{now:controller.scheduledTime});
    console.log(JSON.stringify(result)); // Dates and aggregate counts only.
  },
  async fetch(request,env){
    if(!await authorized(request,env))return Response.json({error:'unauthorized'},{status:401});
    const path=new URL(request.url).pathname;
    if(request.method!=='POST'||!['/preview','/run'].includes(path))return new Response(null,{status:404});
    try{return Response.json(await runDaily(env,{preview:path==='/preview'}));}
    catch(e){const reason=/^[A-Za-z0-9]+$/.test(e.message)?e.message:'CheckFailed';return Response.json({error:reason},{status:502});}
  }
};
