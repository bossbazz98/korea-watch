const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../../public'),out=path.resolve(__dirname,'../agent-out'),origin='http://127.0.0.1:8818';
const fixture={id:'startup',translated:true,categories:['tech'],level:'normal',publishedAt:new Date().toISOString(),titleKo:'한국 인공지능 반도체 기술',source:'KBS',sourceUrl:'https://news.kbs.co.kr/test',title:{th:'ข่าวสำหรับทดสอบการเปิดแอป',en:'A startup test story',ko:'앱 시작 테스트 기사'},summary:{th:'สรุปข่าวสำหรับทดสอบ',en:'A test summary',ko:'테스트 요약'},body:{th:['เนื้อข่าวสำหรับทดสอบ'],en:['Test article text'],ko:['테스트 기사 본문']}};
const sdk={
 'firebase-app.js':'export const initializeApp=()=>({});',
 'firebase-firestore.js':`export const persistentLocalCache=()=>({}),initializeFirestore=()=>({}),getFirestore=()=>({}),doc=(db,...p)=>p.join('/');export function onSnapshot(ref,ok){setTimeout(()=>ok({exists:()=>true,data:()=>ref==='meta/feed'?{items:[${JSON.stringify(fixture)}]}:{},metadata:{fromCache:false}}),0);return()=>{}}`,
 'firebase-messaging.js':'export const isSupported=async()=>false;'
};
const server=http.createServer((req,res)=>{const pathname=new URL(req.url,origin).pathname,file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep)){res.writeHead(400);return res.end()}fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'content-type':({'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream'});res.end(err?'missing':data)})});
const layout=page=>page.evaluate(()=>{
 const rect=el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
 const bar=document.getElementById('app-tabs');return{bar:rect(bar),lens:rect(bar.querySelector('.tab-lens')),buttons:[...bar.querySelectorAll('button')].map(rect),rows:bar.querySelectorAll('.tab-real-row').length,contents:bar.querySelectorAll('.tab-content').length};
});
function aligned(value){
 const {bar,lens,buttons}=value;
 assert.equal(buttons.length,3);assert.equal(bar.height,62);
 assert(buttons.every(b=>Math.abs(b.y-buttons[0].y)<.5&&b.height===52),'all three buttons must share one row from first paint: '+JSON.stringify(buttons));
 assert(buttons[0].x<buttons[1].x&&buttons[1].x<buttons[2].x);
 assert(buttons.every(b=>b.x>=bar.x&&b.right<=bar.right&&b.y>=bar.y&&b.bottom<=bar.bottom),'buttons cannot spill below the dock');
 assert(lens.width>90&&lens.height===52&&lens.x>=bar.x&&lens.right<=bar.right,'selected lens is positioned before scripts run');
}
(async()=>{
 await new Promise(resolve=>server.listen(8818,'127.0.0.1',resolve));fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.AGENT_CHROMIUM||chromium.executablePath()});
 try{for(const scenario of [
  {name:'app-module',width:390,height:844,theme:'light'},
  {name:'lens-module',width:320,height:640,theme:'dark',dependency:true},
  {name:'standalone-light',width:390,height:844,theme:'light',standalone:true},
  {name:'standalone-fonts',width:390,height:844,theme:'dark',standalone:true,dependency:true,fonts:true},
  {name:'desktop',width:1280,height:900,theme:'dark'},
  {name:'legacy-html',width:390,height:844,theme:'light',legacy:true},
  {name:'without-js',width:390,height:844,theme:'dark',noJS:true}
 ]){
  const context=await browser.newContext({viewport:{width:scenario.width,height:scenario.height},hasTouch:true,isMobile:scenario.width<800,deviceScaleFactor:scenario.standalone?3:1,javaScriptEnabled:!scenario.noJS,serviceWorkers:'block'});
  await context.addInitScript(s=>{localStorage.setItem('kw.theme',JSON.stringify(s.theme));if(s.standalone)Object.defineProperty(navigator,'standalone',{value:true});const sw=new EventTarget(),reg={active:{postMessage(){}},update:async()=>{}};Object.assign(sw,{register:async()=>reg,ready:Promise.resolve(reg)});Object.defineProperty(navigator,'serviceWorker',{value:sw})},scenario);
  await context.route('**/vendor/firebase/**',route=>route.fulfill({contentType:'text/javascript',body:sdk[route.request().url().split('/').pop()]||''}));
  let release,releaseFonts;const gate=new Promise(resolve=>release=resolve),fontGate=new Promise(resolve=>releaseFonts=resolve);
  if(!scenario.noJS)await context.route(scenario.dependency?'**/liquid-tabs.js*':'**/app.js',async route=>{await gate;await route.continue().catch(()=>{})});
  if(scenario.fonts)await context.route('**/fonts/*.woff2',async route=>{await fontGate;await route.continue().catch(()=>{})});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const cdp=await context.newCDPSession(page),capture=async name=>{const frame=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name),Buffer.from(frame.data,'base64'))};
  try{
   await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
   await page.goto(origin,{waitUntil:'commit'});await page.waitForSelector('#app-tabs');
   await capture(`first-paint-${scenario.name}.png`);const initial=await layout(page);aligned(initial);
   await page.waitForTimeout(500);aligned(await layout(page));if(!scenario.noJS&&!scenario.legacy)await page.locator('#nav-saved').focus();
   if(!scenario.noJS){if(scenario.legacy)await page.evaluate(()=>{const bar=document.getElementById('app-tabs'),row=bar.querySelector('.tab-real-row');for(const button of row.querySelectorAll('button')){const content=button.querySelector('.tab-content');content.replaceWith(...content.childNodes);bar.append(button)}row.remove();bar.querySelector('.tab-lens').innerHTML=''});release();await page.waitForSelector('#grid .card');const ready=await layout(page);aligned(ready);assert.equal(ready.rows,1);assert.equal(ready.contents,3);if(!scenario.legacy)assert.equal(await page.evaluate(()=>document.activeElement.id),'nav-saved','initialization preserves focus on the existing button');
    for(let i=0;i<3;i++)assert(Math.abs(initial.buttons[i].x-ready.buttons[i].x)<.5&&Math.abs(initial.buttons[i].y-ready.buttons[i].y)<.5,'hydration cannot move a button');
    for(const key of ['x','y','width','height'])assert(Math.abs(initial.lens[key]-ready.lens[key])<.5,'hydration cannot move or resize the selected lens');
    releaseFonts();await page.evaluate(()=>document.fonts.ready);aligned(await layout(page));await page.locator('#nav-saved').click();assert.equal(await page.locator('body').getAttribute('data-view'),'saved');await page.locator('#settings').click();await page.waitForSelector('#sheet-title');await page.locator('#nav-home').click();assert.equal(await page.locator('body').getAttribute('data-view'),'home');
   }
   assert.deepEqual(errors,[]);console.log(`First paint ${scenario.name}: three aligned buttons, positioned selection, no startup stacking or hydration jump`);
  }catch(error){await capture(`first-paint-failure-${scenario.name}.png`).catch(()=>{});throw error}
  finally{release();releaseFonts();await context.close()}
 }}finally{await browser.close();server.close()}
})().catch(error=>{console.error(error);server.close();process.exitCode=1});
