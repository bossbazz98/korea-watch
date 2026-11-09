const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const labels=require('../../public/categories');
const root=path.resolve(__dirname,'../../public'),out=path.resolve(__dirname,'../agent-out');
const titles={korwar:'남북 군사회담 제안',war:'우크라이나 전쟁',disease:'신종 바이러스',tech:'AI 반도체 신기술',crypto:'비트코인 발표',foreign:'한국 외국인 근로자',wage:'한국 최저임금',fx:'원화 환율',oil:'국제유가 급등',thai:'주한 태국대사관',president:'한국 대통령 발표',hot:'인기 배우 결혼'};
const stories=Object.keys(labels).map((key,i)=>({id:key,titleKo:titles[key],categories:[key],translated:true,level:'normal',source:'연합뉴스',sourceUrl:'https://www.yna.co.kr/'+key,publishers:key==='hot'?['https://www.yna.co.kr','https://news.sbs.co.kr','https://news.kbs.co.kr']:[],publishedAt:new Date(Date.now()-i*1000).toISOString(),title:{th:'ข่าวทดสอบ '+key,en:'Test '+key},summary:{th:'สรุปข่าวสำหรับตรวจหมวดหมู่และท่าทางรีเฟรช '.repeat(3),en:'Summary'},body:{th:['เนื้อข่าวภาษาไทย']}}));
// Retired topics remain in All without masquerading as trending news.
stories.push({...stories[0],id:'legacy',titleKo:'อาหารทั่วไป',categories:['food','korea'],sourceUrl:'https://www.yna.co.kr/legacy'});
const sdk={
 'firebase-app.js':'export const initializeApp=c=>({c});',
 'firebase-messaging.js':'export const isSupported=async()=>false;',
 'firebase-firestore.js':`const items=${JSON.stringify(stories)};
 export const persistentLocalCache=()=>({}),initializeFirestore=()=>({}),getFirestore=()=>({}),doc=(d,...p)=>p.join('/');
 const snapshot=ref=>({exists:()=>true,data:()=>ref==='meta/feed'?{items:items.map((item,i)=>({...item,title:window.__reverseKeys?{en:item.title.en,th:item.title.th+(window.__changed&&i===0?' ใหม่':'')}:{...item.title,th:item.title.th+(window.__changed&&i===0?' ใหม่':'')},summary:window.__reverseKeys?{en:item.summary.en,th:item.summary.th}:item.summary}))}:{lastRun:new Date().toISOString()},metadata:{fromCache:false}});
 export function onSnapshot(ref,ok){setTimeout(()=>ok(snapshot(ref)),0);return()=>{}}
 export async function getDocFromServer(ref){window.__reads=(window.__reads||0)+1;if(ref==='meta/feed'&&window.__hold)await new Promise(resolve=>window.__release=resolve);if(ref==='meta/status'&&window.__holdStatus)await new Promise(resolve=>window.__releaseStatus=resolve);if(ref==='meta/feed'&&window.__fail)throw Error('fixture offline');return snapshot(ref);}`
};
const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname;const file=path.resolve(root,'.'+(p==='/'?'/index.html':p));if(!file.startsWith(root+path.sep)){res.writeHead(400);return res.end();}fs.readFile(file,(e,data)=>{res.writeHead(e?404:200,{'content-type':({'.js':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png'})[path.extname(file)]||'text/plain'});res.end(e?'missing':data);});});
async function touch(page,type,x,y,count=1){await page.evaluate(({type,x,y,count})=>{const target=document.querySelector('main');const touches=Array.from({length:count},(_,i)=>new Touch({identifier:i+1,target,clientX:x+i*20,clientY:y}));target.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'||type==='touchcancel'?[]:touches,changedTouches:touches}));},{type,x,y,count});}
(async()=>{
 await new Promise(resolve=>server.listen(8808,'127.0.0.1',resolve));fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.AGENT_CHROMIUM||chromium.executablePath()});
 try{for(const viewport of [{width:390,height:844},{width:320,height:640},{width:1280,height:900}]){
  const context=await browser.newContext({viewport,hasTouch:true,isMobile:viewport.width<800,colorScheme:'dark',reducedMotion:viewport.width===320?'reduce':'no-preference',serviceWorkers:'block'});
  await context.addInitScript(()=>localStorage.setItem('kw.push',JSON.stringify({cats:['law','korea','food'],enabled:false})));
  await context.route('**/vendor/firebase/**',r=>r.fulfill({contentType:'text/javascript',body:sdk[r.request().url().split('/').pop()]||''}));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto('http://127.0.0.1:8808');await page.waitForSelector('.card');
   assert.deepEqual(await page.locator('#tiles [data-cat]').evaluateAll(nodes=>nodes.map(n=>n.dataset.cat)),['all',...Object.keys(labels)]);
   assert.equal(await page.locator('#grid .card').count(),stories.length,'All includes legacy published stories');
   for(const key of Object.keys(labels)){await page.locator('#tiles [data-cat="'+key+'"]').evaluate(el=>el.click());assert(await page.locator('#grid .card').count()>0,key+' is selectable')}
   await page.locator('[data-cat=all]').evaluate(el=>el.click());await page.evaluate(()=>scrollTo(0,700));await page.waitForFunction(()=>scrollY>500);await page.locator('#home-top').click();await page.waitForFunction(()=>scrollY<1);assert.equal(await page.evaluate(()=>scrollY),0);
   await page.evaluate(()=>scrollTo(0,500));await page.locator('#home-top').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>scrollY<1);
   const baseline=await page.evaluate(()=>({header:document.querySelector('#home-header').getBoundingClientRect().y,title:document.querySelector('#t-bk').getBoundingClientRect().y}));
   const closed=()=>page.waitForFunction(()=>document.getElementById('pull-space').hidden&&document.getElementById('pull-refresh').dataset.phase==='idle');
   const pull=async dy=>{await touch(page,'touchstart',170,180);await touch(page,'touchmove',170,180+dy)};
   const reads=()=>page.evaluate(()=>window.__reads||0);
   await pull(40);assert.equal(await page.locator('#pull-refresh').getAttribute('data-phase'),'pulling');assert.equal(await page.locator('.pull-ring').getAttribute('aria-valuenow'),'28');
   const during=await page.evaluate(()=>({header:document.querySelector('#home-header').getBoundingClientRect().y,title:document.querySelector('#t-bk').getBoundingClientRect().y,height:document.querySelector('#pull-space').getBoundingClientRect().height}));
   assert.equal(during.header,baseline.header);assert.equal(during.height,22);assert(Math.abs(during.title-baseline.title-during.height)<1);
   await touch(page,'touchend',170,220);await closed();assert.equal(await reads(),0);
   await touch(page,'touchstart',170,180);await touch(page,'touchmove',250,190);await touch(page,'touchmove',250,400);await touch(page,'touchend',250,400);await closed();assert.equal(await reads(),0,'horizontal swipe cannot refresh');
   await page.evaluate(()=>scrollTo(0,400));await pull(160);await touch(page,'touchend',170,340);assert.equal(await reads(),0,'only start at the top');await page.locator('#home-top').click();await page.waitForFunction(()=>scrollY<1);
   await page.locator('#settings').click();assert.equal(await page.locator('input[name="pc"]').count(),12);assert(await page.locator('input[name="pc"][value="foreign"]').isChecked());assert(await page.locator('input[name="pc"][value="hot"]').isChecked());await pull(160);await touch(page,'touchend',170,340);assert.equal(await reads(),0);await page.locator('#nav-home').click();
   await pull(160);assert.equal(await page.locator('#pull-refresh').getAttribute('data-phase'),'ready');await page.waitForTimeout(500);assert.equal(await page.locator('#pull-refresh').getAttribute('data-phase'),'ready','ready stays while holding');await touch(page,'touchmove',170,220);assert.equal(await page.locator('#pull-refresh').getAttribute('data-phase'),'pulling');await touch(page,'touchend',170,220);await closed();assert.equal(await reads(),0);
   await page.evaluate(()=>{window.__hold=true;window.__reverseKeys=true});await pull(160);assert.equal(await page.locator('.pull-ring').getAttribute('aria-valuenow'),'100');assert.equal(await reads(),0);
   await page.screenshot({path:path.join(out,`ring-${viewport.width}-ready.png`)});await touch(page,'touchend',170,340);await page.waitForFunction(()=>window.__reads===2);assert.equal(await page.locator('#pull-refresh').getAttribute('data-phase'),'loading');assert.equal(await page.locator('#grid .card').count(),stories.length);assert(await page.locator('#refresh-status').isHidden());
   if(viewport.width===320)assert.equal(await page.locator('.pull-progress').evaluate(el=>getComputedStyle(el).animationName),'none');
   await pull(160);await touch(page,'touchend',170,340);assert.equal(await reads(),2,'one request per round');await page.evaluate(()=>{window.__hold=false;window.__release()});await closed();assert.equal(await page.locator('.pull-message').textContent(),'','no no-new-news message');
   await page.evaluate(()=>{window.__changed=true;window.__holdStatus=true});await pull(160);await touch(page,'touchend',170,340);await page.waitForFunction(()=>document.querySelector('#grid .card h3').textContent.includes('ใหม่'),{},{timeout:1000});assert.equal(await page.evaluate(()=>typeof window.__releaseStatus),'function');await closed();await page.evaluate(()=>{window.__holdStatus=false;window.__releaseStatus()});
   await page.evaluate(()=>window.__fail=true);await pull(160);await touch(page,'touchend',170,340);await page.waitForFunction(()=>document.getElementById('pull-refresh').dataset.phase==='error');assert.equal(await page.locator('#grid .card').count(),stories.length);await page.screenshot({path:path.join(out,`ring-${viewport.width}-error.png`)});await closed();assert.equal(await reads(),6);
   await page.evaluate(()=>window.__fail=false);await touch(page,'touchstart',170,180,2);await touch(page,'touchmove',170,360,2);await touch(page,'touchend',170,360,2);assert.equal(await reads(),6);
   const cdp=await context.newCDPSession(page);await page.evaluate(()=>window.__hold=true);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:170,y:180}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:170,y:240}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:170,y:350}]});assert.equal(await reads(),6);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForFunction(()=>window.__reads===8);await page.evaluate(()=>{window.__hold=false;window.__release()});await closed();assert(await page.locator('#sheet').isHidden());
   await pull(160);await touch(page,'touchcancel',170,340);await closed();assert.equal(await reads(),8);assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false);
   console.log(`Ring refresh ${viewport.width}: fixed header, resistance, hold/release, one request, immediate feed, failure, native touch and Reduce Motion passed`);
  }finally{await context.close()}
 }
 // Regression: the real backend has 184 translated items while the client showed zero.
 const recoveredStories=Array.from({length:184},(_,i)=>({...stories[3],id:'published'+i,title:{th:'ข่าวที่เผยแพร่ '+i},links:i%2?[null]:{legacy:true}}));
 for(const mode of ['stale-empty','malformed-records']) {
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  await context.addInitScript(()=>{globalThis.KW_NEWS_POLICY={VERSION:'old',isKoreanPublisher:()=>true};});
  const requests=[];
  await context.route('**/news-policy.js*',async route=>{
   requests.push(route.request().url());
   if(new URL(route.request().url()).search)await route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'news-policy.js'),'utf8')});
   else await route.fulfill({contentType:'text/javascript',body:'globalThis.KW_NEWS_POLICY={VERSION:"old",isKoreanPublisher:()=>true};'});
  });
  const snapshotData=JSON.stringify(recoveredStories);
  const recoverySdk=`const items=${snapshotData};
   export const persistentLocalCache=()=>({}),initializeFirestore=()=>({}),getFirestore=()=>({}),doc=(d,...p)=>p.join('/');
   const snapshot=(ref,empty=false)=>({exists:()=>true,data:()=>ref==='meta/feed'?{items:empty?[]:items}:{lastRun:'fixture-run',lastSuccessfulPublishAt:'fixture-publish',publishedByCategory:{tech:184},hidden:44},metadata:{fromCache:empty}});
   export function onSnapshot(ref,ok){setTimeout(()=>ok(snapshot(ref,ref==='meta/feed'&&${mode==='stale-empty'})),0);return()=>{}}
   export async function getDocFromServer(ref){window.__recoveryReads=(window.__recoveryReads||0)+1;return snapshot(ref);}`;
  await context.route('**/vendor/firebase/**',route=>route.fulfill({contentType:'text/javascript',body:route.request().url().endsWith('firebase-firestore.js')?recoverySdk:sdk[route.request().url().split('/').pop()]||''}));
  await context.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:''}));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8808');await page.waitForFunction(()=>document.querySelectorAll('#grid .card').length===184);
  assert.equal(await page.locator('#tiles [data-cat="all"] .n').textContent(),'184');
  assert.equal(await page.evaluate(()=>typeof globalThis.KW_NEWS_POLICY.publisherKey),'function');
  assert(requests.length>0&&requests.every(url=>url.includes('?v=')),'ignore stale unversioned policy files');
  assert.deepEqual(errors,[]);
  if(mode==='stale-empty')assert.equal(await page.evaluate(()=>window.__recoveryReads),2,'one forced server read restores the cached empty feed');
  console.log(`Feed UI ${mode}: all 184 stories displayed, version contract restored, zero uncaught errors`);
  await context.close();
 }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
