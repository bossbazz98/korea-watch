// Korea Watch: ตัวค้นข่าว รันบน GitHub Actions ทุก 5 นาที
// ข่าวทั้งหมดเก็บในเอกสารเดียว (meta/feed) เพื่อให้เปิดแอปแต่ละครั้งใช้การอ่านฐานข้อมูลแค่ 1 ครั้ง (ประหยัดโควตาฟรี)
const { collect } = require("./lib/collect");
const { translate, translateTitles, DEFAULT_MODELS, GROQ_MODELS, hasThai } = require("./lib/translate");
const { CAT_KEYS } = require("./feeds");
const { resolveArticle } = require("./lib/images");

const CFG = {
  MAX_TRANSLATE: 12,   // ข่าวที่แปลเต็ม (สรุปละเอียด) ต่อรอบ
  TITLE_BATCH: 40,     // หัวข้อต่อ 1 คำขอ (โหมดแปลเฉพาะหัวข้อ)
  TITLES_MAX: 80,      // หัวข้อสูงสุดต่อรอบ
  PRIORITY_MAX: 20,    // อ่านคิวแปลด่วนสูงสุดต่อรอบ
  BATCH: 2,            // ข่าวต่อ 1 คำขอ (ส่งเนื้อข่าวยาวไปด้วย ชุดเล็กไม่ชนเพดานต่อนาที)
  ENRICH_PER_RUN: 4,   // ข่าวเก่าที่เนื้อหาสั้น เขียนใหม่ให้ละเอียดสูงสุดกี่ข่าวต่อรอบ
  SHORT_BODY: 400,     // เนื้อหาไทยสั้นกว่านี้ (ตัวอักษร) ถือว่าสั้นเกินไป
  TIME_BUDGET_MS: 170000, // เวลาแปลสูงสุดต่อรอบ ~3 นาที แล้วบันทึกผลเสมอ (GitHub ตัดงานที่ 8 นาที)
  KEEP_DAYS: 30,       // เก็บข่าวกี่วัน
  FEED_MAX: 250,       // จำนวนข่าวสูงสุดในแอป
  FEED_MAX_BYTES: 900000, // เอกสาร Firestore ต้องไม่เกิน 1 MB
  SEEN_DAYS: 4,        // จำข่าวที่เคยเห็นกี่วัน (กันซ้ำ)
  MAX_ATTEMPTS: 4,     // แปลไม่สำเร็จกี่ครั้งแล้วพักไว้
  RETRY_AFTER_MS: 3 * 3600e3, // ข่าวที่พักไว้ ลองใหม่ทุก 3 ชั่วโมง (ไม่ทิ้งถาวร)
  PUSH_WINDOW_H: 6,    // แจ้งเตือนเฉพาะข่าวที่ไม่เก่ากว่ากี่ชั่วโมง
  IMG_PER_RUN: 20,     // หาภาพข่าวสูงสุดกี่ข่าวต่อรอบ
  IMG_PARALLEL: 6,     // เปิดหน้าข่าวพร้อมกันกี่ข่าว
  IMG_RETRY_MS: 12 * 3600e3, // ข่าวที่หาภาพไม่เจอ ลองใหม่ทุก 12 ชั่วโมง
  IMG_TIMEOUT_MS: 8000,// รอแต่ละหน้าเว็บไม่เกิน
  IMG_MAX_TRIES: 3     // หาภาพไม่เจอกี่ครั้งแล้วพักไว้ (แล้วลองใหม่ตาม IMG_RETRY_MS)
};
const DAY = 864e5;
const iso = ms => new Date(ms).toISOString();
const rank = n => Math.min(...(n.categories || []).map(c => { const i = CAT_KEYS.indexOf(c); return i < 0 ? 99 : i }), 99);

async function runOnce({ db, messaging, appUrl, geminiKey, groqKey, models = DEFAULT_MODELS, groqModels = GROQ_MODELS, fetchImpl = fetch, now = Date.now(), log = console, waitMs = 2000, budgetMs = CFG.TIME_BUDGET_MS, imgBudgetMs = 45000 }) {
  const runStart = Date.now(), runDeadline = runStart + budgetMs;
  const feedRef = db.doc("meta/feed"), seenRef = db.doc("meta/seen"), statusRef = db.doc("meta/status");
  const [feedSnap, seenSnap] = await Promise.all([feedRef.get(), seenRef.get()]);
  let items = feedSnap.exists ? (feedSnap.data().items || []) : [];
  const seen = seenSnap.exists ? { ...(seenSnap.data().ids || {}) } : {};
  const stat = { lastRun: iso(now), added: 0, translated: 0, dropped: 0, pushed: 0, feedErrors: [], lastError: null };
  let feedChanged = false, seenChanged = false;

  // 0) งานที่ AI Agent ตรวจเจอแล้วสั่งแก้ (Agent ไม่เขียนข้อมูลข่าวเอง เพื่อไม่ให้ชนกับรอบนี้)
  stat.fixes = 0;
  try {
    const fx = await db.doc("meta/fixes").get();
    if (fx.exists) {
      const f = fx.data() || {}, by = new Map(items.map(i => [i.id, i]));
      for (const id of f.requeueImage || []) { const it = by.get(id); if (it) { delete it.image; it.imgTries = 0; delete it.imgLastTry; stat.fixes++ } }
      for (const id of f.retranslate || []) { const it = by.get(id); if (it) { Object.assign(it, { translated: false, attempts: 0, title: { ko: it.titleKo } }); delete it.rich; stat.fixes++ } }
      for (const id of f.enrich || []) { const it = by.get(id); if (it && it.translated) { it.needsEnrich = true; it.enrichTries = 0; stat.fixes++ } }
      for (const id of f.remove || []) { if (by.has(id)) { items = items.filter(i => i.id !== id); stat.fixes++ } }
      if (stat.fixes) feedChanged = true;
      await db.doc("meta/fixes").delete();
    }
  } catch (e) { log.warn("fixes read failed", e.message) }
  // ครั้งเดียว: ล้างตัวนับของข่าวที่เคยถูกนับผิดตอน Gemini ยุ่ง (เวอร์ชันก่อน)
  const FEED_V = 7;
  const oldV = feedSnap.exists ? (feedSnap.data().v || 1) : FEED_V;
  if (oldV < FEED_V) {
    items.forEach(i => { if (!i.translated && i.attempts) i.attempts = 0 });
    // ครั้งเดียว (v6): ข่าวที่แปลแล้วแต่หัวข้อภาษาไทยไม่ใช่ภาษาไทย ส่งกลับไปแปลใหม่
    if (oldV < 6) items.forEach(i => {
      if (i.translated && !hasThai(i.title && i.title.th)) {
        Object.assign(i, { translated: false, attempts: 0, snippetKo: i.snippetKo || "" });
        i.title = { ko: i.titleKo }; // ไม่เก็บหัวข้ออังกฤษเดิม ไม่อย่างนั้นโหมดไทยจะยังแสดงภาษาอังกฤษ
      }
    });
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
      categories: n.cats, level: "normal", translated: false, attempts: 0, image: n.image || null,
      publishedAt: n.publishedAt, addedAt: iso(now),
      source: n.source, sourceUrl: n.link, links: [{ label: n.source || "ข่าวต้นฉบับ", url: n.link }]
    });
    stat.added++; feedChanged = true;
  }

  // เปิดหน้าข่าวจริง: ได้ลิงก์จริง ภาพ และเนื้อข่าว (เนื้อข่าวใช้ส่งให้ AI สรุปในรอบนี้เท่านั้น ไม่เก็บลงฐานข้อมูล)
  const article = new Map(), opened = new Set();
  stat.images = 0;
  const openPages = async list => {
    let next = 0;
    const worker = async () => {
      while (next < list.length) {
        const it = list[next++];
        if (opened.has(it.id)) continue;
        opened.add(it.id);
        const left = runDeadline - Date.now();
        if (left < 8000) return;
        try {
          const a = await resolveArticle(it.sourceUrl, { fetchImpl, timeoutMs: Math.min(CFG.IMG_TIMEOUT_MS, left - 4000) });
          if (a.url && a.url !== it.sourceUrl) { it.sourceUrl = a.url; if (it.links && it.links[0]) it.links[0].url = a.url; }
          if (a.text) article.set(it.id, a.text);
          if (!it.image) {
            if (a.image) { it.image = a.image; delete it.imgTries; delete it.imgLastTry; stat.images++ }
            else { it.imgTries = (it.imgTries || 0) + 1; it.imgLastTry = now }
          }
        } catch (e) {
          if (!it.image) { it.imgTries = (it.imgTries || 0) + 1; it.imgLastTry = now }
          log.warn("page failed", it.id, String(e.message || e).slice(0, 120));
        }
        feedChanged = true;
      }
    };
    await Promise.all(Array.from({ length: CFG.IMG_PARALLEL }, worker));
  };

  // 2) แปลข่าว ตามลำดับ:
  //    (ก) ข่าวที่มีคนกดอ่าน (คิวแปลด่วน) แปลเต็มก่อนเสมอ
  //    (ข) แปลหัวข้อทุกข่าวที่ยังไม่มีหัวข้อภาษาไทย ทีละ 40 ข่าว ให้การ์ดทุกใบเป็นภาษาที่เลือกเร็วที่สุด
  //    (ค) แปลเนื้อหาเต็ม (สรุปละเอียดจากเนื้อข่าวจริง) ของข่าวที่เหลือ แล้วเขียนข่าวเก่าที่สั้นเกินไปใหม่
  const toPush = [];
  const hasAI = !!(geminiKey || groqKey);
  const aiOpts = { apiKey: geminiKey, groqKey, models, groqModels, fetchImpl, log, waitMs, cool: new Map() };
  const deadline = runDeadline - imgBudgetMs, used = new Set(), errs = [], drop = new Set(), tried = new Set();
  let ok = 0, total = 0, stopAI = false;
  stat.titled = 0; stat.priority = 0; stat.enriched = 0;

  // อ่านคิวแปลด่วนที่แอปส่งมา (มีแค่ id ของข่าว)
  let prDocs = [];
  try {
    const ps = await db.collection("priority").limit(CFG.PRIORITY_MAX).get();
    prDocs = ps.docs.map(d => ({ ref: d.ref, id: d.id || (d.ref && (d.ref.id || String(d.ref.path || "").split("/").pop())), data: d.data() || {} }));
  } catch (e) { log.warn("priority read failed", e.message) }
  const prIds = new Set(prDocs.map(d => d.id));

  const bodyLen = i => ((i.body && i.body.th) || []).join("").length;
  const due = i => !i.translated && ((i.attempts || 0) < CFG.MAX_ATTEMPTS || now - (i.lastTry || 0) > CFG.RETRY_AFTER_MS);
  const enrichDue = i => i.translated && !i.rich && (i.needsEnrich || bodyLen(i) < CFG.SHORT_BODY) && (i.enrichTries || 0) < 2;
  const fullBatch = async batch => {
    await openPages(batch); // เนื้อข่าวจริงก่อนแปล
    total++; batch.forEach(i => tried.add(i.id));
    try {
      const { results, model, partial } = await translate(batch.map(i => ({ titleKo: i.titleKo, snippet: i.snippetKo || "", article: article.get(i.id) || "", source: i.source, cats: i.categories })), { ...aiOpts, deadline });
      used.add(model + (partial ? " (partial)" : "")); ok++;
      batch.forEach((it, k) => {
        const r = results[k], wasNew = !it.translated, hadText = (article.get(it.id) || "").length > 300;
        if (!r) { if (wasNew) { it.attempts = (it.attempts || 0) + 1; it.lastTry = now } else it.enrichTries = (it.enrichTries || 0) + 1; return; }
        if (!r.relevant) { if (wasNew) drop.add(it.id); else it.enrichTries = 9; return; } // ข่าวเก่าไม่ลบทิ้งเพราะการเขียนใหม่
        Object.assign(it, { title: r.title, summary: r.summary, body: r.body, tips: r.tips, categories: r.categories, level: r.level, translated: true });
        if (hadText) { it.rich = true; delete it.needsEnrich } else if (!wasNew) it.enrichTries = (it.enrichTries || 0) + 1;
        delete it.snippetKo; delete it.attempts; delete it.lastTry; delete it.titleTries;
        if (wasNew) { stat.translated++; if ((r.level === "critical" || r.level === "high") && now - Date.parse(it.publishedAt) < CFG.PUSH_WINDOW_H * 3600e3) toPush.push(it) }
        else stat.enriched++;
      });
      feedChanged = true;
    } catch (e) {
      errs.push(String(e.message || e).slice(0, 200));
      log.warn("translate batch failed", e.message);
      if (e.transient) { stopAI = true; return; } // ทุกรุ่นยุ่ง/โควตาเต็ม: ไม่นับ รอรอบหน้า
      batch.forEach(it => { if (!it.translated) { it.attempts = (it.attempts || 0) + 1; it.lastTry = now } else it.enrichTries = (it.enrichTries || 0) + 1 }); feedChanged = true;
    }
  };
  const timeLeft = () => { if (deadline - Date.now() < 20000) { errs.push("time budget reached"); return false } return true };

  if (hasAI) {
    // (ก) คิวแปลด่วน
    const prQueue = items.filter(i => prIds.has(i.id) && !i.translated).slice(0, CFG.BATCH);
    stat.priority = prQueue.length;
    if (prQueue.length && timeLeft()) await fullBatch(prQueue);

    // (ข) แปลหัวข้อก่อน
    const tq = items.filter(i => !i.translated && !(i.title && hasThai(i.title.th)) && !tried.has(i.id) && (i.titleTries || 0) < CFG.MAX_ATTEMPTS)
      .sort((a, b) => rank(a) - rank(b) || b.publishedAt.localeCompare(a.publishedAt)).slice(0, CFG.TITLES_MAX);
    for (let b = 0; b < tq.length && !stopAI && timeLeft(); b += CFG.TITLE_BATCH) {
      const batch = tq.slice(b, b + CFG.TITLE_BATCH);
      try {
        const { results, model } = await translateTitles(batch.map(i => ({ titleKo: i.titleKo })), { ...aiOpts, deadline });
        used.add(model + " (titles)");
        batch.forEach((it, k) => {
          const r = results[k];
          if (!r) { it.titleTries = (it.titleTries || 0) + 1; return; }
          it.title = { ...(it.title || {}), th: r.th, en: r.en }; stat.titled++;
        });
        feedChanged = true;
      } catch (e) {
        errs.push(String(e.message || e).slice(0, 200));
        log.warn("titles batch failed", e.message);
        if (e.transient) { stopAI = true; break; }
        batch.forEach(it => { it.titleTries = (it.titleTries || 0) + 1 }); feedChanged = true;
      }
    }

    // (ค) แปลเต็มข่าวที่เหลือ (คิวด่วนก่อน แล้วตามหมวดสำคัญ ข่าวใหม่ก่อน) ตามด้วยเขียนข่าวเก่าที่สั้นใหม่
    const queue = items.filter(i => due(i) && !tried.has(i.id))
      .sort((a, b) => (prIds.has(b.id) - prIds.has(a.id)) || rank(a) - rank(b) || b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, Math.max(0, CFG.MAX_TRANSLATE - tried.size));
    const enrichQ = items.filter(i => enrichDue(i) && !tried.has(i.id))
      .sort((a, b) => (!!b.needsEnrich - !!a.needsEnrich) || rank(a) - rank(b) || b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, CFG.ENRICH_PER_RUN);
    // เขียนข่าวเก่าใหม่เฉพาะเมื่อได้เนื้อข่าวจริงมา ไม่อย่างนั้นได้ผลเท่าเดิมและเปลืองโควตา
    if (enrichQ.length && timeLeft()) await openPages(enrichQ);
    const enrichOk = enrichQ.filter(i => (article.get(i.id) || "").length > 300);
    enrichQ.filter(i => !enrichOk.includes(i)).forEach(i => { i.enrichTries = (i.enrichTries || 0) + 1; feedChanged = true });
    const work = [...queue, ...enrichOk];
    for (let b = 0; b < work.length && !stopAI && timeLeft(); b += CFG.BATCH) await fullBatch(work.slice(b, b + CFG.BATCH));

    if (drop.size) { items = items.filter(i => !drop.has(i.id)); stat.dropped = drop.size; }
    stat.model = [...used].join(", ") || null;
    stat.batches = `${ok}/${total}`;
    if (errs.length) stat.lastError = errs.join(" | ").slice(0, 400);
  } else if (items.some(i => !i.translated)) stat.lastError = "GROQ_API_KEY / GEMINI_API_KEY is missing";

  // ล้างคิวแปลด่วน: ข่าวที่แปลแล้ว ข่าวที่ไม่มีในแอปแล้ว หรือค้างนานเกิน 1 วัน
  const live = new Map(items.map(i => [i.id, i]));
  await Promise.all(prDocs.map(d => {
    const it = live.get(d.id);
    const at = d.data.at && typeof d.data.at.toMillis === "function" ? d.data.at.toMillis() : 0;
    const stale = at && now - at > 864e5;
    return (!it || it.translated || stale) ? Promise.resolve(d.ref.delete()).catch(() => { }) : null;
  }));

  // 2.5) หาภาพให้ข่าวที่ยังไม่มีภาพ (ข่าวใหม่ก่อน) ข่าวที่เคยหาไม่เจอ ลองใหม่ทุก 12 ชั่วโมง
  const imgQueue = items.filter(i => !i.image && !opened.has(i.id) && ((i.imgTries || 0) < CFG.IMG_MAX_TRIES || now - (i.imgLastTry || 0) > CFG.IMG_RETRY_MS))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, CFG.IMG_PER_RUN);
  if (imgQueue.length) await openPages(imgQueue);

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

  stat.pending = items.filter(i => !i.translated).length;
  stat.total = items.length;
  await statusRef.set(stat);
  log.log(`added ${stat.added}, translated ${stat.translated}, dropped ${stat.dropped}, pushed ${stat.pushed}, pending ${stat.pending}` +
    `, titled ${stat.titled || 0}` + (stat.priority ? `, priority ${stat.priority}` : "") + (stat.enriched ? `, enriched ${stat.enriched}` : "") + (stat.fixes ? `, agent fixes ${stat.fixes}` : "") +
    (stat.batches ? `, batches ${stat.batches}` : "") + `, images ${stat.images}` + (stat.model ? `, model ${stat.model}` : "") + (stat.lastError ? `, error: ${stat.lastError}` : ""));
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
  const g = process.env.GROQ_MODEL;
  const groqModels = g ? [g, ...GROQ_MODELS.filter(m => m !== g)] : GROQ_MODELS;
  await runOnce({ db: getFirestore(), messaging: getMessaging(), appUrl, geminiKey: process.env.GEMINI_API_KEY, groqKey: process.env.GROQ_API_KEY, models, groqModels });
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1) });
module.exports = { runOnce, CFG };
