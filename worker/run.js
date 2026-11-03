// Korea Watch: ตัวค้นข่าว รันบน GitHub Actions ทุก 5 นาที
// ข่าวทั้งหมดเก็บในเอกสารเดียว (meta/feed) เพื่อให้เปิดแอปแต่ละครั้งใช้การอ่านฐานข้อมูลแค่ 1 ครั้ง (ประหยัดโควตาฟรี)
// ลำดับงานในแต่ละรอบ:
//   0) รับงานแก้จาก AI Agent
//   1) ดึงข่าวใหม่ รวมข่าวซ้ำ (ข่าวเรื่องเดียวกันจากหลายสำนัก = ข่าวเดียว หลายแหล่งข่าว)
//   2) ข่าวสงครามเกาหลี: ทางด่วน ใช้ AI ทุกตัวแข่งกันแปล บันทึกขึ้นแอปทันที (+ ตรวจฟีดซ้ำทุก ~2 นาทีตลอดรอบ)
//   3) ข่าวอื่น: แปลเต็มพร้อมกันหลายช่องทาง (ข่าวทั่วไปจะขึ้นแอปเมื่อแปลเสร็จเท่านั้น)
//   4) เขียนข่าวเก่าที่สั้นใหม่ / หาภาพ / รวมข่าวซ้ำหลังแปล / ตัดข่าวเก่า / ส่งแจ้งเตือน
// โควตา AI นับรายวัน และกันโควตาฉุกเฉินไว้ 3 ข่าวต่อวัน สำหรับข่าวสงครามเกาหลีและข่าวที่มีคำบ่งชี้เหตุด่วน
const { collect } = require("./lib/collect");
const { translate, translateTitles, raceTranslate, raceTitles, DEFAULT_MODELS, GROQ_MODELS, GITHUB_MODELS, hasThai } = require("./lib/translate");
const { CAT_KEYS, FEEDS } = require("./feeds");
const { resolveArticle } = require("./lib/images");
const { grams, similarity, SAME_KO, SAME_TH } = require("./lib/similar");
const { Quota } = require("./lib/quota");

const CFG = {
  MAX_TRANSLATE: 16,   // ข่าวที่แปลเต็ม (สรุปละเอียด) ต่อรอบ
  LANES: 3,            // แปลพร้อมกันกี่ช่องทาง (แต่ละช่องทางเริ่มจาก AI คนละตัว)
  TITLE_BATCH: 40,     // หัวข้อต่อ 1 คำขอ (โหมดแปลเฉพาะหัวข้อ)
  TITLES_MAX: 80,      // หัวข้อสูงสุดต่อรอบ
  PRIORITY_MAX: 20,    // อ่านคิวแปลด่วนสูงสุดต่อรอบ
  BATCH: 2,            // ข่าวต่อ 1 คำขอ (ส่งเนื้อข่าวยาวไปด้วย ชุดเล็กไม่ชนเพดานต่อนาที)
  ENRICH_PER_RUN: 4,   // ข่าวเก่าที่เนื้อหาสั้น เขียนใหม่ให้ละเอียดสูงสุดกี่ข่าวต่อรอบ
  SHORT_BODY: 400,     // เนื้อหาไทยสั้นกว่านี้ (ตัวอักษร) ถือว่าสั้นเกินไป
  TIME_BUDGET_MS: 280000, // ทำงานได้ ~4.7 นาทีต่อรอบ แล้วบันทึกผลเสมอ (GitHub ตัดงานที่ 9 นาที)
  WATCH_EVERY_MS: 120000, // ระหว่างรอบ ตรวจฟีดข่าวสงครามเกาหลีซ้ำทุก 2 นาที
  KORWAR_PER_RUN: 6,   // ข่าวสงครามเกาหลีที่ทำทางด่วนได้ต่อรอบ
  KORWAR_RETRY_MS: 10 * 60e3, // ข่าวสงครามเกาหลีที่แปลพลาด ลองใหม่ทุก 10 นาที (ข่าวอื่น 3 ชั่วโมง)
  KORWAR_BUDGET_MS: 120000, // ทางด่วนใช้เวลารวมไม่เกิน 2 นาทีต่อรอบ (เหลือเวลาให้ข่าวอื่น)
  KORWAR_TITLE_MS: 15000,   // เวลารอสูงสุดต่อคำขอแปลหัวข้อ
  KORWAR_ITEM_MS: 40000,    // เวลารอสูงสุดต่อคำขอแปลเนื้อหา
  KORWAR_TEXT: 1500,        // ทางด่วนส่งเนื้อข่าวสั้นลง (เร็วขึ้น ไม่ชนเพดานต่อนาที) แล้วเขียนละเอียดภายหลัง
  KEEP_DAYS: 30,       // เก็บข่าวกี่วัน
  FEED_MAX: 250,       // จำนวนข่าวสูงสุดในแอป
  FEED_MAX_BYTES: 900000, // เอกสาร Firestore ต้องไม่เกิน 1 MB
  SEEN_DAYS: 4,        // จำข่าวที่เคยเห็นกี่วัน (กันซ้ำ)
  DEDUPE_H: 48,        // เทียบข่าวซ้ำย้อนหลังกี่ชั่วโมง
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
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rank = n => Math.min(...(n.categories || []).map(c => { const i = CAT_KEYS.indexOf(c); return i < 0 ? 99 : i }), 99);
const isKorwar = i => (i.categories || []).includes("korwar");
const bodyLen = i => ((i.body && i.body.th) || []).join("").length;
// ข่าวที่แสดงในแอป: แปลเสร็จแล้ว หรือเป็นข่าวสงครามเกาหลี (ขึ้นก่อนแล้วค่อยแปล)
const shown = i => i.translated || isKorwar(i);

async function runOnce({ db, messaging, appUrl, geminiKey, groqKey, githubToken, models = DEFAULT_MODELS, groqModels = GROQ_MODELS, githubModels = GITHUB_MODELS, fetchImpl = fetch, now = Date.now(), log = console, waitMs = 2000, budgetMs = CFG.TIME_BUDGET_MS, imgBudgetMs = 45000, watchEveryMs = CFG.WATCH_EVERY_MS }) {
  const runStart = Date.now(), runDeadline = runStart + budgetMs;
  const feedRef = db.doc("meta/feed"), seenRef = db.doc("meta/seen"), statusRef = db.doc("meta/status"), quotaRef = db.doc("meta/quota");
  const [feedSnap, seenSnap, quotaSnap] = await Promise.all([feedRef.get(), seenRef.get(), quotaRef.get()]);
  let items = feedSnap.exists ? (feedSnap.data().items || []) : [];
  const seen = seenSnap.exists ? { ...(seenSnap.data().ids || {}) } : {};
  const quota = new Quota(quotaSnap.exists ? quotaSnap.data() : {}, now);
  const stat = { lastRun: iso(now), added: 0, merged: 0, translated: 0, dropped: 0, pushed: 0, feedErrors: [], lastError: null, korwar: 0, emergency: 0 };
  let feedChanged = false, seenChanged = false;

  const FEED_V = 8;
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

  // บันทึกขึ้นแอป (ทีละครั้ง ไม่ซ้อนกัน) ใช้ทั้งตอนจบรอบ และทันทีที่ข่าวสงครามเกาหลีแปลเสร็จ
  let saving = Promise.resolve();
  const saveFeed = () => (saving = saving.then(() => feedRef.set({ items, updatedAt: iso(Date.now()), v: FEED_V })).catch(e => log.warn("save failed", e.message)));

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

  // 1) รับข่าวใหม่เข้าระบบ: ข่าวที่ซ้ำกับข่าวที่มีอยู่ (หัวข้อคล้ายกัน) จะถูกรวมเป็นแหล่งข่าวเพิ่ม ไม่สร้างการ์ดใหม่
  const addSource = (it, source, link) => {
    if (!source || !link) return;
    it.links = it.links || [];
    if (it.source === source || it.links.some(l => l.label === source || l.url === link)) return;
    it.links.push({ label: source, url: link });
  };
  const ingest = list => {
    const fresh = [];
    const have = new Set(items.map(i => i.id));
    const recentCut = now - CFG.DEDUPE_H * 3600e3;
    const pool = items.filter(i => (Date.parse(i.publishedAt) || 0) >= recentCut).map(i => ({ i, g: grams(i.titleKo) }));
    for (const n of list) {
      if (seen[n.id] || have.has(n.id)) continue;
      seen[n.id] = now; seenChanged = true;
      const g = grams(n.titleKo);
      const win = (n.cats.includes("korwar") ? 6 : 24) * 3600e3;
      const twin = pool.find(p => Math.abs(Date.parse(p.i.publishedAt) - Date.parse(n.publishedAt)) <= win && similarity(p.g, g) >= SAME_KO);
      if (twin) { // ข่าวเดิมเรื่องเดียวกัน: เพิ่มเป็นแหล่งข่าว
        addSource(twin.i, n.source, n.link); (n.alts || []).forEach(a => addSource(twin.i, a.source, a.link));
        if (!twin.i.image && n.image) twin.i.image = n.image;
        stat.merged++; feedChanged = true; continue;
      }
      const it = {
        id: n.id, titleKo: n.titleKo, snippetKo: n.snippet,
        title: { ko: n.titleKo }, summary: { ko: n.snippet }, body: {},
        categories: n.cats, level: "normal", translated: false, attempts: 0, image: n.image || null, emergency: !!n.emergency,
        publishedAt: n.publishedAt, addedAt: iso(now),
        source: n.source, sourceUrl: n.link, links: [{ label: n.source || "ข่าวต้นฉบับ", url: n.link }]
      };
      (n.alts || []).forEach(a => addSource(it, a.source, a.link));
      items.push(it); pool.push({ i: it, g }); fresh.push(it);
      stat.added++; feedChanged = true;
    }
    return fresh;
  };
  const { list, errors } = await collect({ fetchImpl, now, log });
  stat.feedErrors = errors;
  ingest(list);

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

  const toPush = [];
  stat.pushFailed = 0; stat.pushErrors = {};
  const addPush = pr => { stat.pushed += pr.sent; stat.pushFailed += pr.failed; for (const [k, v] of Object.entries(pr.errors || {})) stat.pushErrors[k] = (stat.pushErrors[k] || 0) + v };
  const hasAI = !!(geminiKey || groqKey || githubToken);
  const aiOpts = { apiKey: geminiKey, groqKey, githubToken, models, groqModels, githubModels, fetchImpl, log, waitMs, cool: new Map(), quota, tpm: new Map() };
  const deadline = runDeadline - imgBudgetMs, used = new Set(), errs = [], drop = new Set(), tried = new Set();
  let ok = 0, total = 0, stopAI = false;
  stat.titled = 0; stat.priority = 0; stat.enriched = 0;
  const timeLeft = () => { if (deadline - Date.now() < 20000) { errs.push("time budget reached"); return false } return true };
  const inputOf = (i, max = Infinity) => ({ titleKo: i.titleKo, snippet: i.snippetKo || "", article: (article.get(i.id) || "").slice(0, max), source: i.source, cats: i.categories });

  // นำผลแปลเต็มไปใส่ข่าว (ใช้ทั้งทางด่วนและงานปกติ)
  const apply = (batch, results, model, partial) => {
    used.add(model + (partial ? " (partial)" : ""));
    batch.forEach((it, k) => {
      const r = results[k], wasNew = !it.translated, hadText = (article.get(it.id) || "").length > 300;
      if (!r) { if (wasNew) { it.attempts = (it.attempts || 0) + 1; it.lastTry = now } else it.enrichTries = (it.enrichTries || 0) + 1; return; }
      if (!r.relevant) { if (wasNew) drop.add(it.id); else it.enrichTries = 9; return; } // ข่าวเก่าไม่ลบทิ้งเพราะการเขียนใหม่
      Object.assign(it, { title: r.title, summary: r.summary, body: r.body, tips: r.tips, categories: r.categories, level: r.level, translated: true });
      if (hadText) { it.rich = true; delete it.needsEnrich } else if (!wasNew) it.enrichTries = (it.enrichTries || 0) + 1;
      delete it.snippetKo; delete it.attempts; delete it.lastTry; delete it.titleTries;
      if (wasNew) { stat.translated++; if (now - Date.parse(it.publishedAt) < CFG.PUSH_WINDOW_H * 3600e3) toPush.push(it) }
      else stat.enriched++;
    });
    feedChanged = true;
  };
  // ข่าวฉุกเฉินที่โควตาปกติหมด: ใช้โควตาสำรองได้วันละ 3 ข่าว
  const withEmergency = async (batch, call) => {
    try { return await call(false) } catch (e) {
      if (e.reserved && batch.some(i => i.emergency || isKorwar(i)) && quota.emergencyLeft() > 0) {
        const res = await call(true);
        quota.useEmergency(); stat.emergency++;
        log.warn(`used emergency quota (${quota.emergencyUsed}/3 today)`);
        return res;
      }
      throw e;
    }
  };
  const fullBatch = async (batch, rotate = 0) => {
    await openPages(batch); // เนื้อข่าวจริงก่อนแปล
    total++; batch.forEach(i => tried.add(i.id));
    try {
      const { results, model, partial } = await withEmergency(batch, emergency => translate(batch.map(i => inputOf(i)), { ...aiOpts, deadline, rotate, emergency }));
      ok++; apply(batch, results, model, partial);
    } catch (e) {
      errs.push(String(e.message || e).slice(0, 200));
      log.warn("translate batch failed", e.message);
      if (e.transient) { if (!e.reserved) stopAI = true; return; } // ทุกรุ่นยุ่ง/โควตาเต็ม: ไม่นับ รอรอบหน้า
      batch.forEach(it => { if (!it.translated) { it.attempts = (it.attempts || 0) + 1; it.lastTry = now } else it.enrichTries = (it.enrichTries || 0) + 1 }); feedChanged = true;
    }
  };
  // แปลหลายชุดพร้อมกัน แต่ละช่องทางเริ่มจาก AI คนละตัว
  const parallel = async (batches, fn) => {
    let next = 0;
    const lane = async k => { while (next < batches.length && !stopAI && timeLeft()) await fn(batches[next++], k) };
    await Promise.all(Array.from({ length: Math.min(CFG.LANES, batches.length) }, (_, k) => lane(k)));
  };

  // 2) ทางด่วนข่าวสงครามเกาหลี
  //    (1) แปลหัวข้อของทุกข่าวที่ค้างในคำขอเดียว (เร็ว ใช้โควตาน้อย) ไล่ลอง AI ทุกตัวจนสำเร็จ → หัวข้อไทยขึ้นแอปทันที
  //    (2) แปลเนื้อหาทีละข่าว: แข่งกัน 3 ช่องทางที่เร็วที่สุด ถ้าไม่สำเร็จใช้วิธีปกติ แล้วบันทึกขึ้นแอป + แจ้งเตือนทันที
  //    คิว: ข่าวที่ยังไม่เคยลอง และข่าวที่ลองล่าสุดนานที่สุดได้ก่อน (ไม่มีข่าวไหนถูกแซงคิวตลอด)
  const korwarDone = new Set();
  const korwarTitles = async (until) => {
    const need = items.filter(i => isKorwar(i) && !i.translated && !hasThai(i.title && i.title.th)).slice(0, CFG.TITLE_BATCH);
    if (!need.length || !hasAI) return;
    try {
      const t = await withEmergency(need, emergency => translateTitles(need.map(i => ({ titleKo: i.titleKo })), { ...aiOpts, deadline: until, timeoutMs: CFG.KORWAR_TITLE_MS, waitMs: 0, emergency }));
      need.forEach((it, k) => { const x = t.results[k]; if (x) { it.title = { ...it.title, th: x.th, en: x.en }; stat.titled++ } });
      used.add(t.model + " (korwar titles)"); feedChanged = true;
      await saveFeed();
    } catch (e) { errs.push("korwar titles: " + String(e.message || e).slice(0, 140)) }
  };
  const fastKorwar = async () => {
    const until = Math.min(runDeadline - 15000, Date.now() + CFG.KORWAR_BUDGET_MS);
    await korwarTitles(until);
    const q = items.filter(i => isKorwar(i) && !i.translated && !korwarDone.has(i.id) && ((i.attempts || 0) < CFG.MAX_ATTEMPTS || Date.now() - (i.lastTry || 0) > CFG.KORWAR_RETRY_MS))
      .sort((a, b) => (a.lastTry || 0) - (b.lastTry || 0) || b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, Math.max(0, CFG.KORWAR_PER_RUN - korwarDone.size));
    for (const it of q) {
      if (!hasAI || until - Date.now() < 10000) return;
      korwarDone.add(it.id); tried.add(it.id);
      try {
        await openPages([it]);
        const itemUntil = Math.min(until, Date.now() + CFG.KORWAR_ITEM_MS + 5000);
        const o = { ...aiOpts, deadline: itemUntil, timeoutMs: CFG.KORWAR_ITEM_MS };
        const input = [inputOf(it, CFG.KORWAR_TEXT)];
        // แข่งแปลก่อน ถ้าไม่สำเร็จ (และไม่ใช่เพราะโควตาหมด) ใช้วิธีปกติทันทีในรอบเดียวกัน
        const r = await withEmergency([it], async emergency => {
          try { return await raceTranslate(input, { ...o, emergency }) }
          catch (e) { if (e.reserved) throw e; log.warn("korwar race failed, trying normal chain", e.message); return await translate(input, { ...o, deadline: Math.min(until, Date.now() + CFG.KORWAR_ITEM_MS + 5000), emergency, waitMs: 0 }) }
        });
        apply([it], r.results, r.model + " (fast)", r.partial); stat.korwar++;
        if (it.translated) { it.rich = false; it.needsEnrich = true } // เนื้อหาย่อจากข่าวสั้น: เขียนให้ละเอียดภายหลัง
        it.lastTry = Date.now();
        await saveFeed();
        if (toPush.includes(it)) { const pr = await sendNews(db, messaging, [it], appUrl, log).catch(e => ({ sent: 0, failed: 1, errors: { [e.message]: 1 } })); addPush(pr); toPush.splice(toPush.indexOf(it), 1) }
      } catch (e) {
        errs.push("korwar: " + String(e.message || e).slice(0, 160));
        it.lastTry = Date.now();
        if (!e.transient) it.attempts = (it.attempts || 0) + 1;
        feedChanged = true;
      }
    }
  };
  await fastKorwar();

  // ระหว่างรอบ: ตรวจฟีดสงครามเกาหลีซ้ำทุก ~2 นาที ถ้ามีข่าวใหม่ทำทางด่วนทันที
  let watching = true, wake = null;
  const nap = ms => new Promise(res => { const t = setTimeout(res, ms); wake = () => { clearTimeout(t); res() } }); // ปลุกได้ทันทีตอนจบรอบ
  const watcher = (async () => {
    while (watching && runDeadline - Date.now() > watchEveryMs + 30000) {
      await nap(watchEveryMs);
      if (!watching) break;
      try {
        const r = await collect({ fetchImpl, now: Date.now(), log, only: f => f.korwar });
        const fresh = ingest(r.list.filter(n => n.cats.includes("korwar")));
        if (fresh.length) { log.log(`watch: ${fresh.length} new Korean-war item(s)`); await fastKorwar(); await saveFeed(); }
      } catch (e) { log.warn("watch failed", e.message) }
    }
  })();

  // อ่านคิวแปลด่วนที่แอปส่งมา (มีแค่ id ของข่าว)
  let prDocs = [];
  try {
    const ps = await db.collection("priority").limit(CFG.PRIORITY_MAX).get();
    prDocs = ps.docs.map(d => ({ ref: d.ref, id: d.id || (d.ref && (d.ref.id || String(d.ref.path || "").split("/").pop())), data: d.data() || {} }));
  } catch (e) { log.warn("priority read failed", e.message) }
  const prIds = new Set(prDocs.map(d => d.id));

  const due = i => !i.translated && ((i.attempts || 0) < CFG.MAX_ATTEMPTS || now - (i.lastTry || 0) > CFG.RETRY_AFTER_MS);
  const enrichDue = i => i.translated && !i.rich && (i.needsEnrich || bodyLen(i) < CFG.SHORT_BODY) && (i.enrichTries || 0) < 2;

  if (hasAI) {
    // (ก) คิวแปลด่วน (ข่าวที่ผู้อ่านเปิดดู)
    const prQueue = items.filter(i => prIds.has(i.id) && !i.translated && !tried.has(i.id)).slice(0, CFG.BATCH);
    stat.priority = prQueue.length;
    if (prQueue.length && timeLeft()) await fullBatch(prQueue);

    // (ข) แปลหัวข้อก่อน: เฉพาะข่าวที่แสดงในแอปก่อนแปลเสร็จ (สงครามเกาหลี) ข่าวอื่นจะขึ้นแอปเมื่อแปลเต็มเสร็จแล้ว
    const tq = items.filter(i => !i.translated && shown(i) && !(i.title && hasThai(i.title.th)) && !tried.has(i.id) && (i.titleTries || 0) < CFG.MAX_ATTEMPTS)
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, CFG.TITLES_MAX);
    const tBatches = [];
    for (let b = 0; b < tq.length; b += CFG.TITLE_BATCH) tBatches.push(tq.slice(b, b + CFG.TITLE_BATCH));
    await parallel(tBatches, async (batch, k) => {
      try {
        const { results, model } = await withEmergency(batch, emergency => translateTitles(batch.map(i => ({ titleKo: i.titleKo })), { ...aiOpts, deadline, rotate: k, emergency }));
        used.add(model + " (titles)");
        batch.forEach((it, j) => { const r = results[j]; if (!r) { it.titleTries = (it.titleTries || 0) + 1; return } it.title = { ...(it.title || {}), th: r.th, en: r.en }; stat.titled++ });
        feedChanged = true;
      } catch (e) {
        errs.push(String(e.message || e).slice(0, 200)); log.warn("titles batch failed", e.message);
        if (e.transient) { if (!e.reserved) stopAI = true; return }
        batch.forEach(it => { it.titleTries = (it.titleTries || 0) + 1 }); feedChanged = true;
      }
    });

    // (ค) แปลเต็มข่าวที่เหลือ พร้อมกันหลายช่องทาง (คิวด่วนก่อน แล้วหมวดสำคัญ ข่าวใหม่ก่อน) ตามด้วยเขียนข่าวเก่าที่สั้นใหม่
    const queue = items.filter(i => due(i) && !tried.has(i.id))
      .sort((a, b) => (prIds.has(b.id) - prIds.has(a.id)) || (!!b.emergency - !!a.emergency) || rank(a) - rank(b) || b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, Math.max(0, CFG.MAX_TRANSLATE - tried.size));
    const enrichQ = items.filter(i => enrichDue(i) && !tried.has(i.id))
      .sort((a, b) => (!!b.needsEnrich - !!a.needsEnrich) || rank(a) - rank(b) || b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, CFG.ENRICH_PER_RUN);
    // เขียนข่าวเก่าใหม่เฉพาะเมื่อได้เนื้อข่าวจริงมา ไม่อย่างนั้นได้ผลเท่าเดิมและเปลืองโควตา
    if (enrichQ.length && timeLeft()) await openPages(enrichQ);
    const enrichOk = enrichQ.filter(i => (article.get(i.id) || "").length > 300);
    enrichQ.filter(i => !enrichOk.includes(i)).forEach(i => { i.enrichTries = (i.enrichTries || 0) + 1; feedChanged = true });
    const work = [...queue, ...enrichOk], batches = [];
    for (let b = 0; b < work.length; b += CFG.BATCH) batches.push(work.slice(b, b + CFG.BATCH));
    await parallel(batches, (batch, k) => fullBatch(batch, k));
  } else if (items.some(i => !i.translated)) stat.lastError = "GROQ_API_KEY / GEMINI_API_KEY is missing";

  // ล้างคิวแปลด่วน: ข่าวที่แปลแล้ว ข่าวที่ไม่มีในแอปแล้ว หรือค้างนานเกิน 1 วัน
  const live = new Map(items.map(i => [i.id, i]));
  await Promise.all(prDocs.map(d => {
    const it = live.get(d.id);
    const at = d.data.at && typeof d.data.at.toMillis === "function" ? d.data.at.toMillis() : 0;
    const stale = at && now - at > 864e5;
    return (!it || it.translated || stale) ? Promise.resolve(d.ref.delete()).catch(() => { }) : null;
  }));

  // หาภาพให้ข่าวที่ยังไม่มีภาพ (ข่าวใหม่ก่อน) ข่าวที่เคยหาไม่เจอ ลองใหม่ทุก 12 ชั่วโมง
  const imgQueue = items.filter(i => !i.image && !opened.has(i.id) && ((i.imgTries || 0) < CFG.IMG_MAX_TRIES || now - (i.imgLastTry || 0) > CFG.IMG_RETRY_MS))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, CFG.IMG_PER_RUN);
  if (imgQueue.length) await openPages(imgQueue);

  watching = false; if (wake) wake();
  await watcher;

  if (drop.size) { items = items.filter(i => !drop.has(i.id)); stat.dropped = drop.size; }
  if (hasAI) {
    stat.model = [...used].join(", ") || null;
    stat.batches = `${ok}/${total}`;
    if (errs.length) stat.lastError = errs.join(" | ").slice(0, 400);
  }

  // รวมข่าวซ้ำหลังแปล: หัวข้อภาษาไทยคล้ายกันมาก = เรื่องเดียวกัน เก็บข่าวที่มีภาพ/ละเอียดกว่า
  const tr = items.filter(i => i.translated && now - Date.parse(i.publishedAt) < CFG.DEDUPE_H * 3600e3)
    .sort((a, b) => (!!b.image - !!a.image) || (!!b.rich - !!a.rich) || bodyLen(b) - bodyLen(a) || a.publishedAt.localeCompare(b.publishedAt));
  const keep = [], gone = new Set();
  for (const it of tr) {
    const g = grams(it.title.th), win = (isKorwar(it) ? 6 : 24) * 3600e3;
    const twin = keep.find(k => Math.abs(Date.parse(k.it.publishedAt) - Date.parse(it.publishedAt)) <= win && similarity(k.g, g) >= SAME_TH);
    if (!twin) { keep.push({ it, g }); continue }
    (it.links || []).forEach(l => addSource(twin.it, l.label, l.url)); addSource(twin.it, it.source, it.sourceUrl);
    twin.it.categories = [...new Set([...(twin.it.categories || []), ...(it.categories || [])])];
    gone.add(it.id);
  }
  if (gone.size) { items = items.filter(i => !gone.has(i.id)); stat.merged += gone.size; feedChanged = true; }

  // ตัดข่าวเก่าและคุมขนาดเอกสาร
  const cut = now - CFG.KEEP_DAYS * DAY;
  const before = items.length;
  items = items.filter(i => (Date.parse(i.publishedAt) || 0) >= cut).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, CFG.FEED_MAX);
  while (items.length && Buffer.byteLength(JSON.stringify(items)) > CFG.FEED_MAX_BYTES) items.pop();
  if (items.length !== before) feedChanged = true;
  for (const [id, t] of Object.entries(seen)) if (now - t > CFG.SEEN_DAYS * DAY) { delete seen[id]; seenChanged = true; }

  if (feedChanged) await saveFeed();
  await saving;
  if (seenChanged) await seenRef.set({ ids: seen });
  await quotaRef.set(quota.toJSON());

  // ส่งแจ้งเตือน (ข่าวที่ยังอยู่ในแอปเท่านั้น)
  const liveIds = new Set(items.map(i => i.id));
  const pushList = toPush.filter(i => liveIds.has(i.id));
  if (pushList.length) addPush(await sendNews(db, messaging, pushList, appUrl, log));
  addPush(await sendTests(db, messaging, appUrl, log));

  stat.pending = items.filter(i => !i.translated).length;
  stat.hidden = items.filter(i => !shown(i)).length;
  stat.total = items.length;
  stat.emergencyLeft = quota.emergencyLeft();
  // โควตาที่ใช้ไปวันนี้ (% ของเพดานรายวัน) ดูได้ในบรรทัดสรุปและหน้า Firebase (meta/status)
  stat.quotaUsed = Object.fromEntries(Object.entries(quota.used).map(([t, u]) => { const L = quota.limit(t); const pct = Math.max(L.tokens ? u.tokens / L.tokens : 0, L.requests ? u.requests / L.requests : 0); return [t, Math.round(pct * 100)] }));
  stat.korwarWaiting = items.filter(i => isKorwar(i) && !i.translated).length;
  stat.disabled = Object.fromEntries(Object.entries(quota.disabled || {}).map(([p, v]) => [p, v.reason]));
  await statusRef.set(stat);
  log.log(`added ${stat.added}, merged ${stat.merged}, translated ${stat.translated}, korwar fast ${stat.korwar}, dropped ${stat.dropped}, pushed ${stat.pushed}, pending ${stat.pending}` +
    `, titled ${stat.titled || 0}` + (stat.priority ? `, priority ${stat.priority}` : "") + (stat.enriched ? `, enriched ${stat.enriched}` : "") + (stat.fixes ? `, agent fixes ${stat.fixes}` : "") +
    (stat.pushFailed ? `, push failed ${stat.pushFailed} (${Object.entries(stat.pushErrors).map(([k, v]) => k + "×" + v).join(" ")})` : "") +
    (stat.emergency ? `, emergency used ${stat.emergency}` : "") + `, emergency left ${stat.emergencyLeft}/3` + (stat.korwarWaiting ? `, korwar waiting ${stat.korwarWaiting}` : "") +
    (Object.keys(stat.disabled).length ? `, disabled ${Object.entries(stat.disabled).map(([p, why]) => p + ": " + why).join("; ")}` : "") +
    `, quota ${Object.entries(stat.quotaUsed).map(([t, p]) => t.replace(/^(\w+):(?:\w+\/)?/, "$1:") + " " + p + "%").join(" ") || "-"}` +
    (stat.batches ? `, batches ${stat.batches}` : "") + `, images ${stat.images}` +
    (stat.model ? `, model ${stat.model}` : "") + (stat.lastError ? `, error: ${stat.lastError}` : ""));
  return stat;
}

function webpush(appUrl, id, level) {
  return {
    headers: { Urgency: level === "critical" ? "high" : "normal", TTL: "86400" },
    notification: { icon: "/icons/icon-192.png", badge: "/icons/badge-72.png", tag: id, requireInteraction: level === "critical", lang: "th" },
    fcmOptions: { link: `${appUrl}/${id ? "?id=" + id : ""}` }
  };
}
// ลบเครื่องออกจากรายชื่อเฉพาะเมื่อ Firebase ยืนยันว่า token นั้นเลิกใช้แล้วจริงๆ เท่านั้น
// (เดิมรวม invalid-argument ด้วย ทำให้ถ้าข้อความผิดรูปแบบครั้งเดียว ทุกเครื่องถูกลบทิ้งจนไม่ได้รับแจ้งเตือนอีก)
const BAD_TOKEN = /registration-token-not-registered|invalid-registration-token/;
const sid = s => s.ref && (s.ref.id || String(s.ref.path || "").split("/").pop());

// ส่งแบบหลายเครื่อง คืน { sent, failed, errors: {รหัสข้อผิดพลาด: จำนวน}, perToken: Map(token → ok|รหัส) }
async function sendMulticast(db, messaging, subs, msg, log) {
  const out = { sent: 0, failed: 0, errors: {}, perToken: new Map() };
  for (let i = 0; i < subs.length; i += 500) {
    const chunk = subs.slice(i, i + 500);
    const res = await messaging.sendEachForMulticast({ ...msg, tokens: chunk.map(s => s.token) });
    out.sent += res.successCount || 0;
    await Promise.all((res.responses || []).map((r, k) => {
      if (r.success) { out.perToken.set(chunk[k].token, "ok"); return null }
      const code = (r.error && (r.error.code || r.error.message)) || "unknown";
      out.failed++; out.errors[code] = (out.errors[code] || 0) + 1; out.perToken.set(chunk[k].token, code);
      log.warn("push to one device failed:", code);
      return BAD_TOKEN.test(code) ? chunk[k].ref.delete().catch(() => {}) : null;
    }));
  }
  return out;
}
// ผลการส่งล่าสุดของแต่ละเครื่อง ให้แอปแสดงในหน้าตั้งค่า (เอกสารชื่อเป็นรหัสลับของเครื่อง อ่านได้เฉพาะเครื่องที่รู้รหัส)
async function logPush(db, subs, perToken, kind, title) {
  await Promise.all(subs.filter(s => perToken.has(s.token) && sid(s)).map(s => {
    const r = perToken.get(s.token);
    return db.doc("pushlog/" + sid(s)).set({ at: new Date().toISOString(), kind, title: String(title || "").slice(0, 80), ok: r === "ok", error: r === "ok" ? null : String(r).slice(0, 120) }).catch(() => {});
  }));
}

// ช่วงเวลางดแจ้งเตือน (เวลาเกาหลี) ของแต่ละเครื่อง / ข่าวสงครามเกาหลีด่วนมากแจ้งได้เสมอถ้าผู้ใช้เลือกไว้
function inQuiet(s, ms = Date.now()) {
  if (!s.quietOn) return false;
  const h = new Date(ms + 9 * 3600e3).getUTCHours(), from = +s.quietFrom, to = +s.quietTo;
  if (!Number.isInteger(from) || !Number.isInteger(to) || from === to) return false;
  return from < to ? h >= from && h < to : h >= from || h < to; // เช่น 22 → 7 ข้ามเที่ยงคืน
}
const quietBlocks = (s, n, ms) => inQuiet(s, ms) && !(s.quietBypass !== false && (n.categories || []).includes("korwar") && n.level === "critical");
// ระดับที่ผู้ใช้เลือก: critical = ด่วนมากเท่านั้น / high = ด่วนมาก + สำคัญ / all = ทุกข่าวใหม่ในหมวดที่เลือก
const levelOk = (s, n) => n.level === "critical" || (s.level === "high" && n.level === "high") || s.level === "all";
const MAX_PER_DEVICE = 4; // ต่อรอบ: เกินนี้รวมเป็นแจ้งเตือนเดียว "มีข่าวใหม่อีก N ข่าว"

async function sendNews(db, messaging, news, appUrl, log) {
  const out = { sent: 0, failed: 0, errors: {} };
  const merge = r => { out.sent += r.sent; out.failed += r.failed; for (const [k, v] of Object.entries(r.errors)) out.errors[k] = (out.errors[k] || 0) + v };
  const snap = await db.collection("subscribers").where("enabled", "==", true).get();
  const subs = snap.docs.map(d => ({ ref: d.ref, ...d.data() })).filter(s => typeof s.token === "string");
  const count = new Map(), extra = new Map(), last = new Map();
  for (const n of news) {
    const wanted = subs.filter(s => Array.isArray(s.cats) && s.cats.some(c => (n.categories || []).includes(c)) && levelOk(s, n) && !quietBlocks(s, n));
    const targets = wanted.filter(s => (count.get(s.token) || 0) < MAX_PER_DEVICE);
    wanted.filter(s => !targets.includes(s)).forEach(s => extra.set(s.token, (extra.get(s.token) || 0) + 1));
    if (!targets.length) continue;
    targets.forEach(s => count.set(s.token, (count.get(s.token) || 0) + 1));
    const tag = n.level === "critical" ? "🔴 ด่วนมาก" : n.level === "high" ? "🟠 สำคัญ" : "🆕 ข่าวใหม่";
    try {
      const r = await sendMulticast(db, messaging, targets, {
        notification: { title: `${tag}: ${n.title.th}`.slice(0, 120), body: (n.summary.th || "").slice(0, 240) },
        data: { id: String(n.id), level: String(n.level) }, webpush: webpush(appUrl, n.id, n.level)
      }, log);
      merge(r); targets.forEach(s => last.set(s.token, { r: r.perToken.get(s.token), title: n.title.th }));
    } catch (e) { log.warn("push failed", n.id, e.message); out.failed += targets.length; out.errors[e.code || e.message] = (out.errors[e.code || e.message] || 0) + targets.length }
  }
  // ข่าวที่เกินโควตาต่อเครื่อง: รวมเป็นแจ้งเตือนเดียว
  const byN = new Map();
  for (const [tok, k] of extra) { if (!byN.has(k)) byN.set(k, []); byN.get(k).push(subs.find(s => s.token === tok)) }
  for (const [k, list] of byN) {
    try { merge(await sendMulticast(db, messaging, list, { notification: { title: "Korea Watch", body: `มีข่าวใหม่อีก ${k} ข่าว แตะเพื่ออ่าน` }, data: { id: "", level: "summary" }, webpush: webpush(appUrl, "", "summary") }, log)) } catch (e) { log.warn("summary push failed", e.message) }
  }
  const per = new Map([...last].map(([t, v]) => [t, v.r]));
  await logPush(db, subs, per, "news", [...last.values()].pop()?.title);
  return out;
}

async function sendTests(db, messaging, appUrl, log) {
  const snap = await db.collection("subscribers").where("testRequested", "==", true).limit(50).get();
  const out = { sent: 0, failed: 0, errors: {} };
  if (snap.empty) return out;
  const subs = snap.docs.map(d => ({ ref: d.ref, ...d.data() })).filter(s => typeof s.token === "string");
  try {
    const r = await sendMulticast(db, messaging, subs, {
      notification: { title: "Korea Watch: ทดสอบแจ้งเตือน", body: "ระบบส่งแจ้งเตือนถึงเครื่องนี้ได้แล้ว ข่าวด่วนจะเด้งแบบนี้" },
      data: { id: "", level: "test" }, webpush: webpush(appUrl, "", "test")
    }, log);
    Object.assign(out, { sent: r.sent, failed: r.failed, errors: r.errors });
    await logPush(db, subs, r.perToken, "test", "ทดสอบแจ้งเตือน");
  } catch (e) { log.warn("test push failed", e.message); out.failed = subs.length; out.errors[e.code || e.message] = subs.length }
  await Promise.all(subs.map(s => s.ref.update({ testRequested: false }).catch(() => {})));
  return out;
}

async function main() {
  const { initializeApp, cert } = require("firebase-admin/app");
  const { getFirestore } = require("firebase-admin/firestore");
  const { getMessaging } = require("firebase-admin/messaging");
  let sa;
  try { sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "") } catch (e) { throw new Error("FIREBASE_SERVICE_ACCOUNT secret is missing or not valid JSON") }
  initializeApp({ credential: cert(sa) });
  const appUrl = (process.env.APP_URL || `https://${sa.project_id}.web.app`).replace(/\/$/, "");
  const pref = (v, list) => v ? [v, ...list.filter(m => m !== v)] : list;
  await runOnce({
    db: getFirestore(), messaging: getMessaging(), appUrl,
    geminiKey: process.env.GEMINI_API_KEY, groqKey: process.env.GROQ_API_KEY, githubToken: process.env.GITHUB_TOKEN,
    models: pref(process.env.GEMINI_MODEL, DEFAULT_MODELS), groqModels: pref(process.env.GROQ_MODEL, GROQ_MODELS), githubModels: pref(process.env.GITHUB_MODEL, GITHUB_MODELS)
  });
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1) });
module.exports = { runOnce, CFG, shown, inQuiet };
