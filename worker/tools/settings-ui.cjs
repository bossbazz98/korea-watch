const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../../public');
const out = path.resolve(__dirname, '../agent-out');
const port = 8798, origin = `http://127.0.0.1:${port}`;
const fixture = [{ id: 'reader', translated: true, categories: ['korwar'], level: 'normal', publishedAt: new Date().toISOString(), source: 'Korea Watch', image: `${origin}/icons/icon-512.png`, title: { th: 'ข่าวทดสอบสำหรับตรวจหน้าอ่านข่าว', en: 'A story to test the article reader' }, summary: { th: 'สรุปข่าวสำหรับทดสอบภาพและปุ่มปิด', en: 'A summary for checking image and close-button behaviour.' }, body: { th: Array(10).fill('เนื้อข่าวภาษาไทยเพื่อทดสอบการเลื่อนอ่าน และยืนยันว่ารูปภาพไม่ทับปุ่มปิดข่าว '.repeat(6)), en: Array(10).fill('Article text for scrolling through the reader and checking the close button. '.repeat(7)) } }];
const scripts = {
  'firebase-app.js': 'export const initializeApp=c=>({c});',
  'firebase-firestore.js': `export const persistentLocalCache=()=>({}),initializeFirestore=()=>({}),getFirestore=()=>({}),doc=(d,...p)=>p.join('/'),serverTimestamp=()=>'TS';export async function setDoc(){throw Error('Unexpected subscription write')}export async function getDoc(){return {exists:()=>false}};export function onSnapshot(ref,ok){setTimeout(()=>ok({exists:()=>true,data:()=>ref==='meta/feed'?{items:${JSON.stringify(fixture)}}:{lastRun:new Date().toISOString()},metadata:{fromCache:false}}),10);return()=>{}}`,
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
(async () => {
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch(process.env.AGENT_CHROMIUM ? { executablePath: process.env.AGENT_CHROMIUM } : {});
  try {
    for (const scenario of [
      { name: 'mobile', width: 390, height: 844 },
      { name: 'small-mobile', width: 320, height: 640 },
      { name: 'desktop', width: 1280, height: 900 }
    ]) {
      const context = await browser.newContext({ viewport: scenario, colorScheme: 'light', permissions: ['notifications'], serviceWorkers: 'block' });
      const errors = [];
      await context.route('**/vendor/firebase/**', route => route.fulfill({ contentType: 'text/javascript', body: scripts[route.request().url().split('/').pop()] || '' }));
      await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
      const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
      try {
        await page.goto(origin); await page.waitForSelector('.card');
        assert.equal(await page.locator('.tools #l-th').count(), 0, 'language moved out of header');
        await page.locator('#settings').click();
        assert.equal(await page.locator('.settings-card').count(), 4);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no horizontal overflow');
        assert.equal(await page.locator('#panel').evaluate(el => el.scrollWidth > el.clientWidth), false);
        await page.screenshot({ path: path.join(out, `settings-${scenario.name}-light.png`) });
        await page.locator('label:has(input[name="theme"][value="dark"])').click();
        assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
        assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(21, 24, 27)');
        await page.screenshot({ path: path.join(out, `settings-${scenario.name}-dark.png`) });
        await page.locator('label:has(#p-on)').click();
        await page.locator('label:has(#p-quiet)').click();
        await page.locator('#p-from').selectOption('23');
        await page.locator('#l-en').click();
        assert.equal(await page.locator('#sheet-title').textContent(), 'Settings');
        assert(await page.locator('#p-on').isChecked(), 'language change preserves notification draft');
        assert.equal(await page.locator('#p-from').inputValue(), '23');
        await page.locator('#p-tone').selectOption('bell');
        await page.locator('#p-volume').focus(); await page.keyboard.press('Home');
        for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowRight');
        assert.equal(await page.locator('#volume-value').textContent(), '7%');
        await page.locator('#p-preview').click();
        await page.waitForFunction(() => !document.getElementById('p-stop').disabled);
        await page.locator('#p-stop').click();
        assert(await page.locator('#p-stop').isDisabled());
        await page.locator('label:has(#p-sound)').click();
        assert(await page.locator('#p-tone').isDisabled(), 'mute disables audio controls');
        await page.locator('#panel .sheet-content').evaluate(el => { el.scrollTop = el.scrollHeight; });
        assert(await page.locator('#p-save').isVisible());
        const headerHit = await page.locator('#close').evaluate(el => { const r = el.getBoundingClientRect(); return !!document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('#close'); });
        assert(headerHit, 'settings close remains clickable at bottom');
        await page.locator('#close').click();
        await page.reload(); await page.waitForSelector('.card');
        assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
        await page.locator('#settings').click();
        assert.equal(await page.locator('#sheet-title').textContent(), 'Settings');
        assert.equal(await page.locator('#p-tone').inputValue(), 'bell');
        assert.equal(await page.locator('#p-volume').inputValue(), '7');
        assert.equal(await page.locator('#p-sound').isChecked(), false);
        assert.equal(await page.locator('#p-on').isChecked(), false, 'unsaved remote changes are discarded on close');
        await page.emulateMedia({ colorScheme: 'dark' });
        await page.locator('label:has(input[name="theme"][value="light"])').click();
        assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(246, 247, 248)');
        await page.locator('label:has(input[name="theme"][value="system"])').click();
        assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(21, 24, 27)');
        await page.locator('#close').click();
        await page.locator('.card').first().click();
        const closeTop = await page.locator('#close').evaluate(el => el.getBoundingClientRect().top);
        await page.locator('#panel .sheet-content').evaluate(el => {
          const hero = el.querySelector('.hero'); el.scrollTop = hero.offsetTop + hero.offsetHeight / 2;
        });
        assert(Math.abs(await page.locator('#close').evaluate(el => el.getBoundingClientRect().top) - closeTop) < 1, 'reader close never scrolls with the image');
        assert(await page.locator('#close').evaluate(el => { const r = el.getBoundingClientRect(); return !!document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('#close'); }), 'image cannot cover close button');
        await page.screenshot({ path: path.join(out, `reader-${scenario.name}-scrolled.png`) });
        await page.locator('#close').click();
        assert(await page.locator('#sheet').isHidden());
        assert.deepEqual(errors, []);
        console.log(`Settings UI: ${scenario.name} passed theme/language/audio persistence, draft, layout and scrolled-reader checks`);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
