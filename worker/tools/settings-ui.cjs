const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../../public');
const out = path.resolve(__dirname, '../agent-out');
const port = 8798, origin = `http://127.0.0.1:${port}`;
const fixture = [{ id: 'reader', translated: true, categories: ['korwar'], level: 'normal', publishedAt: new Date().toISOString(), source: '연합뉴스', sourceUrl: 'https://www.yna.co.kr/view/test', titleKo: '남북 군사회담 제안', image: `${origin}/icons/icon-512.png`, title: { th: 'ข่าวทดสอบสำหรับตรวจหน้าอ่านข่าว', en: 'A story to test the article reader' }, summary: { th: 'สรุปข่าวสำหรับทดสอบภาพและปุ่มปิด', en: 'A summary for checking image and close-button behaviour.' }, body: { th: Array(10).fill('เนื้อข่าวภาษาไทยเพื่อทดสอบการเลื่อนอ่าน และยืนยันว่ารูปภาพไม่ทับปุ่มปิดข่าว '.repeat(6)), en: Array(10).fill('Article text for scrolling through the reader and checking the close button. '.repeat(7)) } }];
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
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false);
   await page.screenshot({path:path.join(out,`glass-home-${viewport.width}.png`)});
   await page.locator('.card').first().click();assert(await page.locator('#app-tabs').isHidden());
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
   await page.locator('#reader-back').click();await page.locator('#nav-saved').click();assert.equal(await page.locator('.saved-row').count(),1);
   await page.reload();await page.waitForSelector('.card');await page.locator('#nav-saved').click();assert.equal(await page.locator('.saved-row').count(),1,'saved snapshots survive restart');
   const savedRow=await page.locator('.saved-row').boundingBox(),touchClient=await context.newCDPSession(page);const sx=savedRow.x+savedRow.width-25,sy=savedRow.y+savedRow.height/2;
   await touchClient.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:sx,y:sy}]});await touchClient.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:sx-60,y:sy}]});await touchClient.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:sx-110,y:sy}]});await touchClient.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   assert((await page.locator('.saved-item-wrap').getAttribute('class')).includes('swiped'));await page.locator('.delete-saved').click();assert(await page.locator('.empty-saved').isVisible());
   await page.locator('#nav-home').click();await page.locator('.card').first().click();await page.locator('#reader-save').click();await page.locator('#reader-save').click();assert.equal(await page.locator('#reader-save').getAttribute('aria-pressed'),'false');await page.locator('#reader-back').click();
   await page.locator('#nav-home').click();await page.locator('#settings').click();
   assert.equal(await page.locator('#panel').getAttribute('role'),'region','settings is an app tab');
   assert.equal(await page.locator('.settings-card').count(),6);
   assert.equal(await page.locator('#sheet-title').textContent(),'ตั้งค่า');
   assert.equal(await page.locator('input[name="lv"]').count(),3);assert(await page.locator('input[name="lv"][value="high"]').isDisabled());assert(await page.locator('input[name="lv"][value="all"]').isDisabled());
   assert.equal(await page.locator('.topic-check').count(),0,'selected notification chips have no checkmark');
   assert.equal(await page.locator('input[name="pc"]').count(),12);
   assert.equal(await page.locator('#featured-count').textContent(),'3/12');
   await page.locator('[data-featured=korwar]').click();assert.equal(await page.locator('#featured-count').textContent(),'2/12');assert.deepEqual(await page.locator('.order-badge').allTextContents(),['1','2']);
   assert.equal(await page.locator('#category-count').textContent(),'1/12','featured selection is independent');
   await page.locator('[data-featured=tech]').click();await page.locator('#nav-home').click();assert.equal(await page.locator('#t-bksub').textContent(),'สงครามทั่วโลก · โรคติดต่อ / ไวรัส · AI / เทคโนโลยี');
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
   for(const selector of ['#p-save','#p-test','#settings'])assert(await page.locator(selector).isVisible(),selector+' remains visible');
   assert(await page.locator('#p-save').evaluate(el=>{const r=el.getBoundingClientRect();return !!document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#p-save')}));
   assert.equal(await page.locator('#panel').evaluate(el=>el.scrollWidth>el.clientWidth),false);
   await page.screenshot({path:path.join(out,`glass-settings-${viewport.width}.png`)});
   await page.reload();await page.waitForSelector('.card');await page.locator('#settings').click();assert.equal(await page.locator('#p-tone').inputValue(),'bell');assert.equal(await page.locator('#p-volume').inputValue(),'7');assert.equal(await page.locator('#p-area').inputValue(),'busan');assert.equal(await page.locator('#p-sound').isChecked(),false);assert.equal(await page.locator('#p-vibration').isChecked(),false);assert.equal(await page.locator('#p-on').isChecked(),false);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false);assert.deepEqual(errors,[]);
   console.log(`Liquid Glass ${viewport.width}: tabs, sticky reader, saved persistence, clipboard/image sharing, feature ordering, locale/theme/font/audio, fixed actions passed`);
  }catch(error){await page.screenshot({path:path.join(out,`glass-failure-${viewport.width}.png`)}).catch(()=>{});console.error('Runtime errors:',errors);throw error}finally{await context.close()}
 }}finally{await browser.close();server.close()}
})().catch(error=>{console.error(error);server.close();process.exitCode=1});
