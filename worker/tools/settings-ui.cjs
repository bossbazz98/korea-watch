const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../../public');
const out = path.resolve(__dirname, '../agent-out');
const port = 8798, origin = `http://127.0.0.1:${port}`;
const fixture = [{ id: 'reader', translated: true, categories: ['korwar'], level: 'normal', publishedAt: new Date().toISOString(), source: '연합뉴스', sourceUrl: 'https://www.yna.co.kr/view/test', titleKo: '남북 군사회담 제안', image: `${origin}/icons/icon-512.png`, title: { th: 'ข่าวทดสอบสำหรับตรวจหน้าอ่านข่าว', en: 'A story to test the article reader' }, summary: { th: 'สรุปข่าวสำหรับทดสอบภาพและปุ่มปิด', en: 'A summary for checking image and close-button behaviour.' }, body: { th: Array(10).fill('เนื้อข่าวภาษาไทยเพื่อทดสอบการเลื่อนอ่าน และยืนยันว่ารูปภาพไม่ทับปุ่มปิดข่าว '.repeat(6)), en: Array(10).fill('Article text for scrolling through the reader and checking the close button. '.repeat(7)) } }];
fixture.push({...fixture[0],id:'important',level:'high',publishedAt:new Date(Date.now()-60000).toISOString(),title:{th:'ข่าวสำคัญเพื่อทดสอบกรอบสีและคอลัมน์',en:'An important story for checking the grid'},titleKo:'남북 군사 긴장 강화'});
fixture.push({...fixture[0],id:'critical',level:'critical',publishedAt:new Date(Date.now()-120000).toISOString(),title:{th:'เกาหลีเหนือยิงขีปนาวุธ ข่าวด่วนมากสำหรับทดสอบ',en:'North Korea launches a missile'},titleKo:'북한 탄도미사일 발사'});
const scripts = {
  'firebase-app.js': 'export const initializeApp=c=>({c});',
  'firebase-firestore.js': `export const persistentLocalCache=()=>({}),initializeFirestore=()=>({}),getFirestore=()=>({}),doc=(d,...p)=>p.join('/'),serverTimestamp=()=>'TS';export async function setDoc(){throw Error('Unexpected subscription write')}export async function getDoc(){return {exists:()=>false}};export async function getDocFromServer(ref){window.__refreshReads=(window.__refreshReads||0)+1;return {exists:()=>true,data:()=>ref==='meta/feed'?{items:${JSON.stringify(fixture)}}:{lastRun:new Date().toISOString()},metadata:{fromCache:false}};}export function onSnapshot(ref,ok){setTimeout(()=>ok({exists:()=>true,data:()=>ref==='meta/feed'?{items:${JSON.stringify(fixture)}}:{lastRun:new Date().toISOString()},metadata:{fromCache:false}}),10);return()=>{}}`,
  'firebase-messaging.js': 'export const isSupported=async()=>false;'
};
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, origin).pathname;
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : decodeURIComponent(pathname)));
  if (!file.startsWith(root + path.sep)) { response.writeHead(400); response.end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { 'content-type': ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream' }); response.end(data);
  });
});
(async()=>{
 await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));fs.mkdirSync(out,{recursive:true});
 const executablePath=process.env.AGENT_CHROMIUM||chromium.executablePath();
 const browser=await chromium.launch({executablePath});
 try{for(const viewport of [{width:390,height:844},{width:320,height:640},{width:1280,height:900}]){
  const context=await browser.newContext({viewport,isMobile:viewport.width<800,hasTouch:true,colorScheme:'dark',permissions:['notifications','clipboard-read','clipboard-write'],serviceWorkers:'block'});
  await context.route('**/vendor/firebase/**',route=>route.fulfill({contentType:'text/javascript',body:scripts[route.request().url().split('/').pop()]||''}));
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  try{
   await page.goto(origin);await page.waitForSelector('.card');await page.evaluate(()=>document.fonts.ready);
   assert.equal(await page.locator('.tools #settings').count(),0,'settings moved to bottom navigation');
   assert.equal(await page.locator('#t-bk').textContent(),'ข่าวเด่น');
   assert.equal(await page.locator('.bkc p,.bkc .meta').count(),0,'featured cards contain no summary, source or time');
   assert.equal(await page.locator('#refresh-news').count(),0);
   assert.equal(await page.locator('#updated').count(),0,'header has no update timestamp');
   assert.deepEqual(await page.locator('#app-tabs button span').allTextContents(),['หน้าแรก','บันทึก','ตั้งค่า']);
   assert.equal((await page.locator('#app-tabs').boundingBox()).height,68,'same dock height at every viewport');
   assert.equal(await page.locator('.bkc[data-level="critical"]').evaluate(el=>getComputedStyle(el).borderTopColor),'rgb(226, 75, 74)');
   assert.equal(await page.locator('.bkc[data-level="critical"]').evaluate(el=>getComputedStyle(el).borderTopWidth),'2px');
   assert.equal(await page.locator('.bkc[data-level="high"]').evaluate(el=>getComputedStyle(el).borderTopColor),'rgb(240, 163, 74)');
   assert.deepEqual(await page.evaluate(()=>['#t-bk','#t-topics','#t-all','.bkc h3','.card h3'].map(selector=>getComputedStyle(document.querySelector(selector)).fontSize)),Array(5).fill('20px'));

   assert.equal(await page.locator('.chip.new,.badge.new').count(),0,'no New chip in news');
   assert.equal(await page.locator('#grid .card p,#grid .card .meta').count(),0,'All news uses photo/topic/headline-only cards');
   const cardStyle=await page.evaluate(()=>({columns:getComputedStyle(document.querySelector('#grid')).gridTemplateColumns,featureHeight:document.querySelector('.bkc .thumb').getBoundingClientRect().height,feedHeight:document.querySelector('#grid .thumb').getBoundingClientRect().height,head:getComputedStyle(document.querySelector('.card h3')).fontFamily,body:getComputedStyle(document.body).fontFamily}));
   assert(cardStyle.featureHeight>=220&&cardStyle.featureHeight>cardStyle.feedHeight,'featured photo uses the added vertical space');assert(cardStyle.head.includes('IBM Plex Sans Thai'));assert(cardStyle.body.includes('Sarabun'));
   assert.equal(cardStyle.columns.split(' ').length,viewport.width>=1280?4:1,'responsive column count');
   const dock=await page.locator('#app-tabs').boundingBox();assert(Math.abs(viewport.height-dock.y-dock.height-2)<1,'dock sits near bottom edge');
   const center=async selector=>page.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,height:r.height}});
   const lens=()=>center('.tab-lens');
   const settled=()=>page.waitForFunction(()=>document.getElementById('app-tabs').dataset.lensState==='idle');
   const home=await center('#nav-home'),saved=await center('#nav-saved');
   await page.mouse.click(saved.x,saved.y);await page.waitForTimeout(35);
   const sliding=await lens();assert(sliding.x>home.x&&sliding.x<saved.x,'a tap slides instead of jumping');assert(sliding.height<=dock.height,'a tap never enlarges the lens');
   await settled();assert.equal(await page.locator('body').getAttribute('data-view'),'saved');
   await page.locator('#nav-home').click();await settled();
   await page.mouse.move(home.x,home.y);await page.mouse.down();await page.waitForTimeout(100);assert((await lens()).height<=dock.height,'short press keeps normal size');
   await page.waitForTimeout(300);assert((await lens()).height>dock.height,'holding beyond 200 ms enlarges beyond the dock');
   await page.screenshot({path:path.join(out,`lens-hold-${viewport.width}.png`)});await page.mouse.up();await settled();assert(Math.abs((await lens()).height-home.height)<1,'release shrinks back');
   await page.mouse.move(home.x,home.y);await page.mouse.down();await page.mouse.move(home.x+18,home.y);await page.mouse.move(saved.x,saved.y);await page.waitForTimeout(32);
   const tracking=await lens();assert(tracking.x<saved.x-2,'lens follows with damping rather than sticking to the pointer');await page.mouse.up();await settled();assert.equal(await page.locator('body').getAttribute('data-view'),'saved','drag releases on the selected tab without a second click');
   await page.locator('#nav-home').click();await settled();
   const dragTouch=await context.newCDPSession(page);await dragTouch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:home.x,y:home.y}]});await dragTouch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:home.x+20,y:home.y}]});await dragTouch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:saved.x,y:saved.y}]});await dragTouch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settled();assert.equal(await page.locator('body').getAttribute('data-view'),'saved','native touch can slide to a tab');
   await page.locator('#nav-home').click();await settled();
   await page.mouse.move(home.x,home.y);await page.mouse.down();await page.mouse.move(saved.x,saved.y);await page.locator('#app-tabs').dispatchEvent('pointercancel');await page.mouse.up();await settled();assert.equal(await page.locator('body').getAttribute('data-view'),'home','cancelled drags do not change tab');
   await page.locator('#nav-saved').click();await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>matchMedia('(prefers-reduced-motion: reduce)').matches&&document.getElementById('app-tabs').dataset.lensState==='idle',null,{timeout:500});assert(Math.abs((await lens()).x-saved.x)<1,'Reduce Motion selects without a spring');await page.locator('#nav-home').click();await page.emulateMedia({reducedMotion:'no-preference'});
   await page.evaluate(()=>{const fake=new EventTarget();Object.assign(fake,{height:innerHeight-110,offsetTop:0,scale:1});window.__dockViewport=fake;window.__originalViewport=window.visualViewport;Object.defineProperty(window,'visualViewport',{value:fake,configurable:true});});
   await page.evaluate(async()=>{const {attachDockViewport}=await import('/liquid-tabs.js');window.__stopDock=attachDockViewport({isStandalone:()=>window.__standaloneDock===true});});
   const raised=await page.locator('#app-tabs').boundingBox();assert(Math.abs(viewport.height-raised.y-raised.height-112)<1,'web toolbar obstruction lifts the dock');
   await page.evaluate(()=>{window.__standaloneDock=true;window.__dockViewport.dispatchEvent(new Event('resize'));});await page.waitForFunction(()=>document.documentElement.style.getPropertyValue('--dock-obstruction')==='0px');
   const installed=await page.locator('#app-tabs').boundingBox();assert(Math.abs(viewport.height-installed.y-installed.height-2)<1,'installed app keeps dock at the edge');
   await page.evaluate(()=>{window.__stopDock();Object.defineProperty(window,'visualViewport',{value:window.__originalViewport,configurable:true});});


   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false);
   await page.screenshot({path:path.join(out,`glass-home-${viewport.width}.png`)});
   await page.locator('.card').first().click();assert(await page.locator('#app-tabs').isHidden());
   assert.equal((await page.locator('.reader-actions').boundingBox()).height,68,'reader dock shares the tab bar height');
   assert.equal(await page.locator('#article-title').evaluate(el=>getComputedStyle(el).fontSize),'20px');
   assert.deepEqual(await page.evaluate(()=>['.summary-box p','.article-body p','.src .ko'].map(selector=>getComputedStyle(document.querySelector(selector)).fontSize)),Array(3).fill('16px'));
   assert.equal(await page.locator('#reader-back-top').count(),0,'reader has no upper back button');
   const save=page.locator('#reader-save');await save.click();assert.equal(await save.getAttribute('aria-pressed'),'true');assert.equal(await save.evaluate(el=>getComputedStyle(el).color),'rgb(227, 179, 65)');
   const closeTop=await page.locator('#close').evaluate(el=>el.getBoundingClientRect().top);
   await page.locator('#panel .sheet-content').evaluate(el=>el.scrollTop=700);
   await page.waitForFunction(()=>document.querySelector('#panel').classList.contains('is-scrolled'));
   assert(Math.abs(await page.locator('#close').evaluate(el=>el.getBoundingClientRect().top)-closeTop)<1);
   assert(await page.locator('#reader-save').evaluate(el=>{const r=el.getBoundingClientRect();return !!document.elementFromPoint(r.x+22,r.y+22)?.closest('#reader-save')}));
   assert(await page.locator('.read-progress i').evaluate(el=>el.getBoundingClientRect().width>0));
   await page.screenshot({path:path.join(out,`glass-reader-${viewport.width}.png`)});
   await page.locator('#reader-share').click();await page.waitForSelector('.share-sheet');
   await page.locator('[data-share=copy]').click();await page.waitForFunction(()=>!document.getElementById('share-layer'));
   assert((await page.evaluate(()=>navigator.clipboard.readText())).includes('?id=reader'),'copy uses the real deep link');
   await page.locator('#reader-share').click();await page.locator('[data-share=image]').click();await page.waitForSelector('.summary-result');await page.waitForFunction(()=>document.querySelector('.summary-result')?.naturalWidth===600);
   assert((await page.locator('.summary-result').getAttribute('src')).startsWith('blob:'),'summary preview is a generated image');
   const dims=await page.locator('.summary-result').evaluate(el=>({w:el.naturalWidth,h:el.naturalHeight}));assert.deepEqual(dims,{w:600,h:900});
   await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.getElementById('share-layer'));
   await page.locator('#reader-back').click();await page.locator('#nav-saved').click();assert.equal(await page.locator('.saved-row').count(),1);await page.locator('#settings').click();assert(await page.locator('#app-tabs').isHidden());await page.locator('#settings-back').click();assert.equal(await page.locator('body').getAttribute('data-view'),'saved','settings back returns to the previous page');
   await page.reload();await page.waitForSelector('.card');await page.locator('#nav-saved').click();assert.equal(await page.locator('.saved-row').count(),1,'saved snapshots survive restart');
   const savedRow=await page.locator('.saved-row').boundingBox(),touchClient=await context.newCDPSession(page);const sx=savedRow.x+savedRow.width-25,sy=savedRow.y+savedRow.height/2;
   await touchClient.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:sx,y:sy}]});await touchClient.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:sx-60,y:sy}]});await touchClient.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:sx-110,y:sy}]});await touchClient.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   assert((await page.locator('.saved-item-wrap').getAttribute('class')).includes('swiped'));await page.locator('.delete-saved').click();assert(await page.locator('.empty-saved').isVisible());
   await page.locator('#nav-home').click();await page.locator('.card').first().click();await page.locator('#reader-save').click();await page.locator('#reader-save').click();assert.equal(await page.locator('#reader-save').getAttribute('aria-pressed'),'false');await page.locator('#reader-back').click();
   await page.locator('#nav-home').click();await page.locator('#settings').click();
   assert.equal(await page.locator('.settings-heading #settings-back').count(),0,'no upper back button');
   assert.equal(await page.locator('#p-test').count(),0,'test action removed');
   assert.equal((await page.locator('.settings-actions').boundingBox()).height,68,'settings has the same dock height');
   assert.deepEqual(await page.locator('.settings-actions button').allTextContents(),['ย้อนกลับ','บันทึก']);
   const closeBounds=await page.locator('#settings-close').boundingBox(),panelBounds=await page.locator('#panel').boundingBox();assert(closeBounds.x>panelBounds.x+panelBounds.width/2,'settings close is at top right');
   assert((await page.locator('.settings-card select').first().evaluate(el=>getComputedStyle(el).fontFamily)).includes('IBM Plex Sans Thai'));
   assert.deepEqual(await page.evaluate(()=>['#sheet-title','.group-title'].map(selector=>getComputedStyle(document.querySelector(selector)).fontSize)),['20px','20px']);
   assert.deepEqual(await page.evaluate(()=>['.hint','.row-body small','.font-example p'].map(selector=>getComputedStyle(document.querySelector(selector)).fontSize)),['16px','16px','16px']);
   assert.equal(await page.locator('#panel').getAttribute('role'),'region','settings is an app tab');
   assert.equal(await page.locator('.settings-card').count(),6);
   assert.equal(await page.locator('#sheet-title').textContent(),'ตั้งค่า');
   assert.equal(await page.locator('input[name="lv"]').count(),3);assert(await page.locator('input[name="lv"][value="high"]').isDisabled());assert(await page.locator('input[name="lv"][value="all"]').isDisabled());
   assert.equal(await page.locator('.topic-check').count(),0,'selected notification chips have no checkmark');
   assert.equal(await page.locator('input[name="pc"]').count(),12);
   assert.equal(await page.locator('#featured-count').textContent(),'3/12');
   await page.locator('[data-featured=korwar]').click();assert.equal(await page.locator('#featured-count').textContent(),'2/12');assert.deepEqual(await page.locator('.order-badge').allTextContents(),['1','2']);
   assert.equal(await page.locator('#category-count').textContent(),'1/12','featured selection is independent');
   await page.locator('[data-featured=tech]').click();await page.locator('#settings-back').click();assert.equal(await page.locator('#t-bksub').textContent(),'สงครามทั่วโลก · โรคติดต่อ / ไวรัส · AI / เทคโนโลยี');
   await page.locator('#settings').click();await page.locator('[data-font="1.14"]').click();
   assert.equal(await page.locator('html').evaluate(el=>el.style.getPropertyValue('--font-scale')),'1.14');
   await page.locator('label:has(input[name="theme"][value="light"])').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
   await page.locator('label:has(input[name="theme"][value="dark"])').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
   await page.locator('label:has(#p-on)').click();await page.locator('label:has(#p-quiet)').click();await page.locator('#p-from').selectOption('23');await page.locator('#p-to').selectOption('10');
   assert((await page.locator('#quiet-duration-label').textContent()).includes('11'));
   await page.locator('#p-area').selectOption('busan');await page.locator('#l-en').click();
   assert.equal(await page.locator('#sheet-title').textContent(),'Settings');assert(await page.locator('#p-on').isChecked());assert.equal(await page.locator('#p-from').inputValue(),'23');
   await page.locator('#l-ko').click();assert.equal(await page.locator('#sheet-title').textContent(),'설정');assert.equal(await page.locator('#p-area').inputValue(),'busan');
   await page.locator('#l-th').click();
   await page.locator('#p-tone').selectOption('bell');await page.locator('#p-volume').fill('7');await page.locator('#p-volume').dispatchEvent('input');assert.equal(await page.locator('#volume-value').textContent(),'7%');
   await page.locator('#p-preview').click();await page.waitForFunction(()=>!document.getElementById('p-stop').disabled);await page.locator('#p-stop').click();assert(await page.locator('#p-stop').isDisabled());
   await page.locator('label:has(#p-sound)').click();assert(await page.locator('#p-tone').isDisabled());assert(await page.locator('#p-vibration').isEnabled(),'vibration is independent of sound');
   await page.locator('label:has(#p-vibration)').click();assert.equal(await page.locator('#p-vibration').isChecked(),false);
   await page.locator('label:has(#p-on)').click();await page.locator('#p-save').click();await page.waitForFunction(()=>document.querySelector('#toast span')?.textContent==='บันทึกแล้ว');
   assert(await page.locator('#sheet-title').isVisible(),'save stays on settings tab');
   await page.locator('#panel .sheet-content').evaluate(el=>el.scrollTop=el.scrollHeight);
   assert(await page.locator('#app-tabs').isHidden(),'settings has only Back/Save in its bottom dock');
   for(const selector of ['#p-save','#settings-close','#settings-back'])assert(await page.locator(selector).isVisible(),selector+' remains visible');
   assert(await page.locator('#p-save').evaluate(el=>{const r=el.getBoundingClientRect();return !!document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#p-save')}));
   assert.equal(await page.locator('#panel').evaluate(el=>el.scrollWidth>el.clientWidth),false);
   await page.screenshot({path:path.join(out,`glass-settings-${viewport.width}.png`)});
   await page.reload();await page.waitForSelector('.card');await page.locator('#settings').click();assert.equal(await page.locator('#p-tone').inputValue(),'bell');assert.equal(await page.locator('#p-volume').inputValue(),'7');assert.equal(await page.locator('#p-area').inputValue(),'busan');assert.equal(await page.locator('#p-sound').isChecked(),false);assert.equal(await page.locator('#p-vibration').isChecked(),false);assert.equal(await page.locator('#p-on').isChecked(),false);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false);assert.deepEqual(errors,[]);
   await page.locator('#settings-close').click();assert.equal(await page.locator('body').getAttribute('data-view'),'home','X returns from settings');
   console.log(`Liquid Glass ${viewport.width}: tabs, sticky reader, saved persistence, clipboard/image sharing, feature ordering, locale/theme/font/audio, fixed actions passed`);
  }catch(error){await page.screenshot({path:path.join(out,`glass-failure-${viewport.width}.png`)}).catch(()=>{});console.error('Runtime errors:',errors);throw error}finally{await context.close()}
 }
 for(const viewport of [{width:768,height:1024,columns:2},{width:1024,height:768,columns:3},{width:1440,height:900,columns:4},{width:844,height:390,columns:1}]){
  const context=await browser.newContext({viewport,hasTouch:true,isMobile:viewport.width===844,serviceWorkers:'block'});await context.route('**/vendor/firebase/**',route=>route.fulfill({contentType:'text/javascript',body:scripts[route.request().url().split('/').pop()]||''}));const page=await context.newPage();
  try{await page.goto(origin);await page.waitForSelector('.card');const columns=await page.locator('#grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);assert.equal(columns,viewport.columns);assert.equal((await page.locator('#app-tabs').boundingBox()).height,68);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false);console.log(`Responsive grid ${viewport.width}×${viewport.height}: ${columns} columns`)}finally{await context.close()}
 }
 }finally{await browser.close();server.close()}
})().catch(error=>{console.error(error);server.close();process.exitCode=1});
