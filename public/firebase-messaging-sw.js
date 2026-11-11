// ตัวรับแจ้งเตือนเบื้องหลัง + เก็บหน้าแอปไว้เปิดตอนออฟไลน์
importScripts('/cache-manifest.js');
const CACHE = "kw-shell-" + self.KW_CACHE_VERSION;
const SHELL = self.KW_PRECACHE;

// ต้องลงทะเบียนก่อน importScripts เพื่อให้ทำงานก่อนตัวจัดการของ Firebase
self.addEventListener("notificationclick", event => {
  const data = event.notification.data || {};
  const fcm = data.FCM_MSG || {};
  let id = fcm.data?.id || data.id || fcm.data?.storyId || data.storyId;
  let url = new URL('/', self.location.origin);
  try { const candidate=new URL(fcm.fcmOptions?.link || fcm.fcm_options?.link || fcm.notification?.click_action || data.url || '/', self.location.origin); if(candidate.origin===self.location.origin) url=candidate; } catch {}
  id ||= url.searchParams.get('id');
  if(id)url=new URL('/?id='+encodeURIComponent(id),self.location.origin);
  event.notification.close();
  event.stopImmediatePropagation();
  event.waitUntil((async () => {
    const wins = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const same = wins.find(w => {const u=new URL(w.url);return u.origin===self.location.origin&&['/','/index.html'].includes(u.pathname)});
    if (same) {
      try {
        await same.focus();
        if (!id) return;
        // An already-running app opens without reloading. If it is still starting,
        // navigate to the article URL so a message sent before its listener is not lost.
        const opened = await new Promise(resolve => {
          if(typeof MessageChannel==='undefined'){resolve(false);return}
          const channel=new MessageChannel();
          const timer=setTimeout(()=>finish(false),500);
          const finish=value=>{clearTimeout(timer);channel.port1.close();resolve(value)};
          channel.port1.onmessage=event=>finish(event.data?.opened===true);
          same.postMessage({type:'open',id},[channel.port2]);
        });
        if(!opened){const navigated=await same.navigate(url.href);if(!navigated)await clients.openWindow(url.href)}
        return;
      } catch { /* A window can close between matching it and focusing it. */ }
    }
    await clients.openWindow(url.href);
  })());
});

// ถ้าโหลด Firebase ไม่ได้ (เน็ตหลุด) ตัว service worker ยังติดตั้งได้ ส่วนเก็บหน้าแอปออฟไลน์ยังทำงาน
try {
  importScripts("/firebase-config.js", "/vendor/firebase/firebase-sw.js");
  if (self.KW_CONFIG?.firebase?.apiKey && !/PASTE/.test(self.KW_CONFIG.firebase.apiKey)) {
    self.KW_FIREBASE_SW.getMessaging(self.KW_FIREBASE_SW.initializeApp(self.KW_CONFIG.firebase));
  }
} catch (e) { console.warn("firebase sw", e) }

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
async function appRelease() {
  const cache=await caches.open(CACHE),html=await cache.match('/index.html');
  return html?(await html.text()).match(/data-release="([^"]+)"/)?.[1]:null;
}
async function announceRelease(target) {
  const release=await appRelease();if(!release)return;
  const windows=target?[target]:await self.clients.matchAll({type:'window'});
  windows.forEach(client=>client.postMessage({type:'app-release',release}));
}
self.addEventListener('message',event=>{if(event.data?.type==='get-release')event.waitUntil(announceRelease(event.source))});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("kw-shell-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()).then(()=>announceRelease()));
});
// เปิดหน้าใหม่จากเน็ตก่อนเสมอ ถ้าออฟไลน์ค่อยใช้ของที่เก็บไว้
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== self.location.origin) return;
  e.respondWith(fetch(r).then(res => {
    if (res.ok && SHELL.includes(new URL(r.url).pathname)) { const copy = res.clone(); e.waitUntil(caches.open(CACHE).then(c => c.put(r, copy))) }
    return res;
  }).catch(() => caches.match(r).then(m => m || (r.mode === "navigate" ? caches.match("/index.html") : Response.error()))));
});
