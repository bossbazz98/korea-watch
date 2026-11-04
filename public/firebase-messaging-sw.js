// ตัวรับแจ้งเตือนเบื้องหลัง + เก็บหน้าแอปไว้เปิดตอนออฟไลน์
importScripts('/cache-manifest.js');
const CACHE = "kw-shell-" + self.KW_CACHE_VERSION;
const SHELL = self.KW_PRECACHE;

// ต้องลงทะเบียนก่อน importScripts เพื่อให้ทำงานก่อนตัวจัดการของ Firebase
self.addEventListener("notificationclick", event => {
  const data = event.notification.data || {};
  const fcm = data.FCM_MSG || {};
  const id = fcm.data?.id || data.id;
  let url = new URL(id ? "/?id=" + encodeURIComponent(id) : "/", self.location.origin).href;
  try { const candidate=new URL(fcm.fcmOptions?.link || fcm.notification?.click_action || url, self.location.origin); if(candidate.origin===self.location.origin) url=candidate.href; } catch {}
  event.notification.close();
  event.stopImmediatePropagation();
  event.waitUntil((async () => {
    const wins = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const same = wins.find(w => new URL(w.url).origin === self.location.origin);
    if (same) { await same.focus(); if (id) same.postMessage({ type: "open", id }); return }
    await clients.openWindow(url);
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
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("kw-shell-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
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
