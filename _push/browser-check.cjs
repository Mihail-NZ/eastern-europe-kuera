const fs=require('node:fs'), path=require('node:path'), http=require('node:http'), assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.png':'image/png'};
(async()=>{
 let changed=false;
 const server=http.createServer((req,res)=>{
   const url=new URL(req.url,'http://localhost');
   if (!url.pathname.startsWith('/eastern-europe-kuera/')) {res.writeHead(404).end();return;}
   const base=path.resolve(__dirname,'..');
   let file=path.resolve(base,'.'+decodeURIComponent(url.pathname.slice('/eastern-europe-kuera'.length)));
   if(file!==base && !file.startsWith(base+path.sep)){res.writeHead(404).end();return;}
   if(url.pathname.endsWith('/'))file=path.join(file,'index.html');
   if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
   let bytes=fs.readFileSync(file);
   if(changed && url.pathname.endsWith('/sw.js'))bytes=Buffer.from(bytes.toString().replace(/const VERSION = '[^']+';/,"const VERSION = 'test-version-2';"));
   res.setHeader('content-type',types[path.extname(file)]||'application/octet-stream');res.end(bytes);
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 let browser;
 try {
   browser=await chromium.launch({channel:'msedge',headless:true});
   const ctx=await browser.newContext({viewport:{width:390,height:844}});
   const root='http://127.0.0.1:'+server.address().port+'/eastern-europe-kuera/';
   await ctx.route(/^https:/,r=>r.abort());
   const page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(root);
   await page.waitForFunction(()=>navigator.serviceWorker.controller);
   for(const route of ['','countries/','news/','travel/','jobs/','countries/poland/overview/']){
     await page.goto(root+route);
     await page.locator('.cee-entry').waitFor();
     assert.ok(await page.title());
     const widths=await page.evaluate(()=>[document.documentElement.clientWidth,document.documentElement.scrollWidth]);
     console.log(route||'home',widths.join('/'));
     assert.ok(widths[1]<=widths[0]+1);
   }
   await ctx.setOffline(true);
   await page.reload();assert.ok(await page.getByText(/저장된 페이지입니다/).count());
   await page.goto(root+'countries/slovakia/');
   assert.ok(await page.getByRole('heading',{name:'인터넷 연결을 확인해 주세요'}).count());
   await ctx.setOffline(false);
   await page.goto(root+'pwa/settings.html');
   await page.getByRole('heading',{name:'뉴스 알림',exact:true}).waitFor();
   await page.evaluate(()=>{localStorage.setItem('sample-user-data','saved');window.beforeUpdate=true;});
   changed=true;
   await page.evaluate(async()=>{await (await navigator.serviceWorker.ready).update()});
   const button=page.getByRole('button',{name:'업데이트 적용'});
   await button.waitFor();
   assert.equal(await page.evaluate(()=>window.beforeUpdate),true);
   await Promise.all([page.waitForNavigation(),button.click()]);
   assert.equal(await page.evaluate(()=>localStorage.getItem('sample-user-data')),'saved');
   assert.ok((await page.evaluate(()=>caches.keys())).some(k=>k.includes('test-version-2')));
   await page.setViewportSize({width:1440,height:900});
   await page.goto(root);
   assert.equal(await page.locator('link[rel=canonical]').count(),1);
   assert.equal(await page.locator('script[src*="googletagmanager"]').count(),1);
   assert.deepEqual(errors,[]);
   console.log('PASS offline guide/fallback, update prompt, opt-in reload, cache cleanup, user storage and desktop metadata');
 }finally{await browser?.close();server.closeAllConnections();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
