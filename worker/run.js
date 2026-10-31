// Korea Watch: ตัวค้นข่าว รันบน GitHub Actions ทุก 5 นาที
// ข่าวทั้งหมดเก็บในเอกสารเดียว (meta/feed) เพื่อให้เปิดแอปแต่ละครั้งใช้การอ่านฐานข้อมูลแค่ 1 ครั้ง (ประหยัดโควตาฟรี)
const { collect } = require("./lib/collect");
const { translate, DEFAULT_MODELS } = require("./lib/translate");
const { CAT_KEYS } = require("./feeds");

const CFG = {
  MAX_TRANSLATE: 15,   // ข่าวที่ส่งให้ AI แปลต่อรอบ (1 คำขอ)
  KEEP_DAYS: 30,       // เก็บข่าวกี่วัน
  FEED_MAX: 250,       // จำนวนข่าวสูงสุดในแอป
  FEED_MAX_BYTES: 900000, // เอกสาร Firestore ต้องไม่เกิน 1 MB
  SEEN_DAYS: 4,        // จำข่าวที่เคยเห็นกี่วัน (กันซ้ำ)
  MAX_ATTEMPTS: 4,     // แปลไม่สำเร็จกี่ครั้งแล้วเลิกลอง
  PUSH_WINDOW_H: 6     // แจ้งเตือนเฉพาะข่าวที่ไม่เก่ากว่ากี่ชั่วโมง
};
const DAY = 864e5;
const iso = ms => new Date(ms).toISOString();
const rank = n => Math.min(...(n.categories || []).map(c => { const i = CAT_KEYS.indexOf(c); return i < 0 ? 99 : i }), 99);

async function runOnce({ db, messaging, appUrl, geminiKey, models = DEFAULT_MODELS, fetchImpl = fetch, now = Date.now(), log = console, waitMs = 2000 }) {
  const feedRef = db.doc("meta/feed"), seenRef = db.doc("meta/seen"), statusRef = db.doc("meta/status");
  const [feedSnap, seenSnap] = await Promise.all([feedRef.get(), seenRef.get()]);
  let items = feedSnap.exists ? (feedSnap.data().items || []) : [];
  const seen = seenSnap.exists ? { ...(seenSnap.data().ids || {}) } : {};
  const stat = { lastRun: iso(now), added: 0, translated: 0, dropped: 0, pushed: 0, feedErrors: [], lastError: null };
  let feedChanged = false, seenChanged = false;
  // ครั้งเดียว: ล้างตัวนับของข่าวที่เคยถูกนับผิดตอน Gemini ยุ่ง (เวอร์ชันก่อน)
  const FEED_V = 2;
  if (feedSnap.exists && (feedSnap.data().v || 1) < FEED_V) {
    items.forEach(i => { if (!i.translated && i.attempts) i.attempts = 0 });
    feedChanged = true;
  }

  // 1) ดึงข่าวใหม่ แล้วใส่ในแอปทันที (ยังไม่แปล) ข่าวจึงขึ้นแม้ AI ติดโควตา
  const { list, errors } = await collect({ fetchImpl, now, log });
  stat.feedErrors = errors;
  const have = new Set(items.map(i => i.id));
  for (const n of list) {
    if (seen[n.id] || have.has(n.id)) continue;
    seen[n.id] = now; seenChanged = true;
    items.push({
      id: n.id, titleKo: n.titleKo, snippetKo: n.snippet,
      title: { ko: n.titleKo }, summary: { ko: n.snippet }, body: {},
      categories: n.cats, level: "normal", translated: false, attempts: 0,
      publishedAt: n.publishedAt, addedAt: iso(now),
      source: n.source, sourceUrl: n.link, links: [{ label: n.source || "ข่าวต้นฉบับ", url: n.link }]
    });
    stat.added++; feedChanged = true;
  }

  // 2) แปลข่าวที่ค้างอยู่ (ข่าวใหม่และข่าวที่รอบก่อนแปลไม่ทัน)
  const toPush = [];
  const queue = items.filter(i => !i.translated && (i.attempts || 0) < CFG.MAX_ATTEMPTS)
    .sort((a, b) => rank(a) - rank(b) || b.publishedAt.localeCompare(a.publishedAt)).slice(0, CFG.MAX_TRANSLATE);
  if (queue.length && geminiKey) {
    try {
      const { results, model } = await translate(queue.map(i => ({ titleKo: i.titleKo, snippet: i.snippetKo || "", source: i.source, cats: i.categories })), { apiKey: geminiKey, models, fetchImpl, log, waitMs });
      stat.model = model;
      const drop = new Set();
      queue.forEach((it, k) => {
        const r = results[k];
        if (!r) { it.attempts = (it.attempts || 0) + 1; return; }
        if (!r.relevant) { drop.add(it.id); return; }
        Object.assign(it, { title: r.title, summary: r.summary, body: r.body, categories: r.categories, level: r.level, translated: true });
        delete it.snippetKo; delete it.attempts;
        stat.translated++;
        if ((r.level === "critical" || r.level === "high") && now - Date.parse(it.publishedAt) < CFG.PUSH_WINDOW_H * 3600e3) toPush.push(it);
      });
      if (drop.size) { items = items.filter(i => !drop.has(i.id)); stat.dropped = drop.size; }
      feedChanged = true;
    } catch (e) {
      stat.lastError = String(e.message || e).slice(0, 300);
      if (!e.transient) { queue.forEach(it => { it.attempts = (it.attempts || 0) + 1 }); feedChanged = true; }
      log.warn("translate failed", stat.lastError);
    }
  } else if (queue.length && !geminiKey) stat.lastError = "GEMINI_API_KEY is missing";

  // 3) ตัดข่าวเก่าและคุมขนาดเอกสาร
  const cut = now - CFG.KEEP_DAYS * DAY;
  const before = items.length;
  items = items.filter(i => (Date.parse(i.publishedAt) || 0) >= cut).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, CFG.FEED_MAX);
  while (items.length && Buffer.byteLength(JSON.stringify(items)) > CFG.FEED_MAX_BYTES) items.pop();
  if (items.length !== before) feedChanged = true;
  for (const [id, t] of Object.entries(seen)) if (now - t > CFG.SEEN_DAYS * DAY) { delete seen[id]; seenChanged = true; }

  if (feedChanged) await feedRef.set({ items, updatedAt: iso(now), v: FEED_V });
  if (seenChanged) await seenRef.set({ ids: seen });

  // 4) ส่งแจ้งเตือน
  if (toPush.length) stat.pushed = await sendNews(db, messaging, toPush, appUrl, log);
  await sendTests(db, messaging, appUrl, log);

  stat.pending = items.filter(i => !i.translated && (i.attempts || 0) < CFG.MAX_ATTEMPTS).length;
  stat.total = items.length;
  await statusRef.set(stat);
  log.log(`added ${stat.added}, translated ${stat.translated}, dropped ${stat.dropped}, pushed ${stat.pushed}, pending ${stat.pending}` + (stat.lastError ? `, error: ${stat.lastError}` : ""));
  return stat;
}

function webpush(appUrl, id, level) {
  return {
    headers: { Urgency: level === "critical" ? "high" : "normal", TTL: "86400" },
    notification: { icon: "/icons/icon-192.png", badge: "/icons/badge-72.png", tag: id, requireInteraction: level === "critical", lang: "th" },
    fcmOptions: { link: `${appUrl}/${id ? "?id=" + id : ""}` }
  };
}
const BAD_TOKEN = /registration-token-not-registered|invalid-registration-token|invalid-argument/;

async function sendMulticast(db, messaging, subs, msg, log) {
  let sent = 0;
  for (let i = 0; i < subs.length; i += 500) {
    const chunk = subs.slice(i, i + 500);
    const res = await messaging.sendEachForMulticast({ ...msg, tokens: chunk.map(s => s.token) });
    sent += res.successCount;
    await Promise.all(res.responses.map((r, k) => !r.success && BAD_TOKEN.test(r.error?.code || "") ? chunk[k].ref.delete().catch(() => {}) : null));
  }
  return sent;
}

async function sendNews(db, messaging, news, appUrl, log) {
  const snap = await db.collection("subscribers").where("enabled", "==", true).get();
  const subs = snap.docs.map(d => ({ ref: d.ref, ...d.data() })).filter(s => typeof s.token === "string");
  let total = 0;
  for (const n of news) {
    const targets = subs.filter(s => Array.isArray(s.cats) && s.cats.some(c => n.categories.includes(c)) && (n.level === "critical" || s.level === "high"));
    if (!targets.length) continue;
    const tag = n.level === "critical" ? "🔴 ด่วนมาก" : "🟠 สำคัญ";
    try {
      total += await sendMulticast(db, messaging, targets, {
        notification: { title: `${tag}: ${n.title.th}`.slice(0, 120), body: (n.summary.th || "").slice(0, 240) },
        data: { id: n.id, level: n.level }, webpush: webpush(appUrl, n.id, n.level)
      }, log);
    } catch (e) { log.warn("push failed", n.id, e.message) }
  }
  return total;
}

async function sendTests(db, messaging, appUrl, log) {
  const snap = await db.collection("subscribers").where("testRequested", "==", true).limit(50).get();
  if (snap.empty) return 0;
  const subs = snap.docs.map(d => ({ ref: d.ref, ...d.data() })).filter(s => typeof s.token === "string");
  let n = 0;
  try {
    n = await sendMulticast(db, messaging, subs, {
      notification: { title: "Korea Watch: ทดสอบแจ้งเตือน", body: "ระบบส่งแจ้งเตือนถึงเครื่องนี้ได้แล้ว ข่าวด่วนจะเด้งแบบนี้" },
      data: { id: "", level: "test" }, webpush: webpush(appUrl, "", "test")
    }, log);
  } catch (e) { log.warn("test push failed", e.message) }
  await Promise.all(subs.map(s => s.ref.update({ testRequested: false }).catch(() => {})));
  return n;
}

async function main() {
  const { initializeApp, cert } = require("firebase-admin/app");
  const { getFirestore } = require("firebase-admin/firestore");
  const { getMessaging } = require("firebase-admin/messaging");
  let sa;
  try { sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "") } catch (e) { throw new Error("FIREBASE_SERVICE_ACCOUNT secret is missing or not valid JSON") }
  initializeApp({ credential: cert(sa) });
  const appUrl = (process.env.APP_URL || `https://${sa.project_id}.web.app`).replace(/\/$/, "");
  const models = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL, ...DEFAULT_MODELS.filter(m => m !== process.env.GEMINI_MODEL)] : DEFAULT_MODELS;
  await runOnce({ db: getFirestore(), messaging: getMessaging(), appUrl, geminiKey: process.env.GEMINI_API_KEY, models });
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1) });
module.exports = { runOnce, CFG };
