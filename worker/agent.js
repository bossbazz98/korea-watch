// Korea Watch AI Agent: ตรวจระบบทุกชั่วโมง
//  1) ตรวจข้อมูลข่าว (ภาษาไทย เนื้อหา ภาพ ข่าวค้าง ข่าวซ้ำ ตัวค้นข่าวหยุด)
//  2) สั่งแก้ข้อมูลอัตโนมัติ ผ่าน meta/fixes (ตัวค้นข่าวเป็นคนแก้ในรอบถัดไป ไม่เขียนทับกัน)
//  3) เปิดหน้าแอปด้วยเบราว์เซอร์จริง (มือถือ/คอม) + ให้ AI ดูภาพหน้าจอหาจุดผิดปกติ
//  4) รายงาน: บันทึก meta/health และเปิด/อัปเดต/ปิด GitHub Issue (GitHub ส่งอีเมลแจ้งให้)
// Agent จะไม่แก้โค้ดของแอปเอง ปัญหาที่ต้องแก้โค้ดจะถูกเขียนเป็นรายงานไว้
const fs = require("fs");
const path = require("path");
const { hasThai } = require("./lib/translate");
const { grams, similarity, SAME_KO, SAME_TH } = require("./lib/similar");

const OUT = path.join(__dirname, "agent-out");
const ISSUE_TITLE = "[Korea Watch Agent] รายงานปัญหาระบบ";
const VISION_MODELS = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-flash-lite-latest"];
const H = 3600e3;
const norm = s => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
const bodyLen = i => ((i.body && i.body.th) || []).join("").length;

async function timedFetch(fetchImpl, url, ms = 7000, opt = {}) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { return await fetchImpl(url, { ...opt, signal: ctl.signal, redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 KoreaWatchAgent", ...(opt.headers || {}) } }) }
  finally { clearTimeout(t) }
}

// ───── 1) ตรวจข้อมูลข่าว ─────
async function auditData({ items, status, now = Date.now(), fetchImpl = fetch, sample = 12 }) {
  const issues = [], fixes = { requeueImage: [], retranslate: [], enrich: [], remove: [] };
  const add = (key, severity, what, auto = false) => issues.push({ key, severity, what, auto });
  const recent = items.filter(i => now - Date.parse(i.publishedAt) < 2 * 24 * H);
  const tr = items.filter(i => i.translated);
  const m = {
    total: items.length, translated: tr.length, untranslated: items.length - tr.length,
    noThaiTitle: items.filter(i => i.translated && !hasThai(i.title && i.title.th)).length,
    hidden: items.filter(i => !i.translated && !(i.categories || []).includes("korwar")).length,
    shortBody: tr.filter(i => !i.rich && bodyLen(i) < 400).length,
    rich: tr.filter(i => i.rich).length,
    recentWithImage: recent.filter(i => i.image).length, recent: recent.length,
    lastRunMin: status && status.lastRun ? Math.round((now - Date.parse(status.lastRun)) / 60000) : null
  };
  // ตัวค้นข่าวหยุดทำงาน
  if (m.lastRunMin == null || m.lastRunMin > 30) add("stale", "high", `ตัวค้นข่าวไม่ได้อัปเดตมา ${m.lastRunMin ?? "?"} นาที (ปกติไม่เกิน 15 นาที) ให้ตรวจแท็บ Actions ของ Fetch news`);
  if (status && status.lastError && !/time budget|cooling|busy|quota/i.test(status.lastError)) add("worker-error", "medium", `ตัวค้นข่าวรายงานข้อผิดพลาด: ${String(status.lastError).slice(0, 200)}`);
  // ข่าวสงครามเกาหลีต้องแปลเร็ว: ค้างเกิน 30 นาที = ปัญหาร้ายแรง
  const kwStuck = items.filter(i => !i.translated && (i.categories || []).includes("korwar") && now - Date.parse(i.addedAt || i.publishedAt) > 30 * 60e3);
  if (kwStuck.length) add("korwar-stuck", "high", `ข่าวสงครามเกาหลีค้างแปลเกิน 30 นาที ${kwStuck.length} ข่าว (เช่น "${String(kwStuck[0].titleKo).slice(0, 40)}") ให้ดูบรรทัด quota และ error ใน log ของ Fetch news`);
  if (status && status.quotaUsed) { const hot = Object.entries(status.quotaUsed).filter(([, p]) => p >= 90); if (hot.length) add("quota-high", "medium", `โควตา AI วันนี้ใกล้หมด: ${hot.map(([t, p]) => `${t} ${p}%`).join(", ")}`) }
  // ข่าวค้างแปลนาน
  const stuck = items.filter(i => !i.translated && now - Date.parse(i.addedAt || i.publishedAt) > 2 * H);
  if (stuck.length > 10) add("backlog", "medium", `มีข่าวค้างแปลเกิน 2 ชั่วโมง ${stuck.length} ข่าว (อาจติดโควตา AI)`);
  // หัวข้อในช่องภาษาไทยไม่ใช่ภาษาไทย → แปลใหม่อัตโนมัติ
  for (const i of tr) if (!hasThai(i.title && i.title.th)) fixes.retranslate.push(i.id);
  if (fixes.retranslate.length) add("non-thai", "low", `พบข่าว ${fixes.retranslate.length} ข่าวที่หัวข้อภาษาไทยไม่ใช่ภาษาไทย ส่งแปลใหม่แล้ว`, true);
  // เนื้อหาสั้น → ส่งเขียนใหม่ (ข่าวใหม่ก่อน)
  fixes.enrich = tr.filter(i => !i.rich && bodyLen(i) < 400 && (i.enrichTries || 0) < 2).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 20).map(i => i.id);
  if (fixes.enrich.length) add("short-body", "low", `ข่าวเนื้อหาสั้น ${m.shortBody} ข่าว ส่งเข้าคิวสรุปใหม่จากเนื้อข่าวจริง ${fixes.enrich.length} ข่าว`, true);
  // ภาพ
  const imgPct = m.recent ? Math.round(100 * m.recentWithImage / m.recent) : 100;
  m.imagePct = imgPct;
  if (m.recent >= 10 && imgPct < 40) add("few-images", "medium", `ข่าว 2 วันล่าสุดมีภาพแค่ ${imgPct}% (การหาภาพอาจมีปัญหา)`);
  const withImg = recent.filter(i => i.image).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, sample);
  let broken = 0;
  await Promise.all(withImg.map(async i => {
    const via = `https://wsrv.nl/?url=${encodeURIComponent(i.image)}&w=64&output=webp`;
    let ok = false;
    try { ok = (await timedFetch(fetchImpl, via)).ok } catch (e) { }
    if (!ok) { try { ok = (await timedFetch(fetchImpl, i.image)).ok } catch (e) { } }
    if (!ok) { broken++; fixes.requeueImage.push(i.id) }
  }));
  m.brokenImages = broken; m.imagesChecked = withImg.length;
  if (broken) add("broken-images", "low", `ภาพเสีย ${broken}/${withImg.length} ภาพที่สุ่มตรวจ ส่งหาภาพใหม่แล้ว`, true);
  // ข่าวซ้ำ (หัวข้อคล้ายกันมาก ทั้งไทยและเกาหลี) เก็บข่าวที่มีภาพ/เนื้อหาละเอียดกว่า
  const kept = [];
  for (const i of recent.filter(x => x.translated).sort((a, b) => (!!b.image - !!a.image) || (!!b.rich - !!a.rich) || a.publishedAt.localeCompare(b.publishedAt))) {
    const gt = grams(i.title.th), gk = grams(i.titleKo);
    const win = ((i.categories || []).includes("korwar") ? 6 : 24) * H;
    const twin = kept.find(k => Math.abs(Date.parse(k.i.publishedAt) - Date.parse(i.publishedAt)) <= win && (similarity(k.gt, gt) >= SAME_TH || similarity(k.gk, gk) >= SAME_KO));
    if (twin) fixes.remove.push(i.id); else kept.push({ i, gt, gk });
  }
  if (fixes.remove.length) add("duplicates", "low", `พบข่าวซ้ำ ${fixes.remove.length} ข่าว รวมเป็นข่าวเดียวแล้ว`, true);
  return { metrics: m, issues, fixes };
}

// ───── 3) ตรวจหน้าแอปด้วยเบราว์เซอร์จริง ─────
async function auditUI({ appUrl, chromium, launchOpts = {}, prepare = null }) {
  fs.mkdirSync(OUT, { recursive: true });
  const issues = [], shots = [], metrics = {};
  const add = (key, severity, what) => issues.push({ key, severity, what });
  const browser = await chromium.launch(launchOpts);
  try {
    for (const vp of [{ name: "mobile-light", w: 390, h: 844, scheme: "light" }, { name: "desktop-dark", w: 1280, h: 900, scheme: "dark" }]) {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, colorScheme: vp.scheme, locale: "th-TH" });
      if (prepare) await prepare(ctx); // ใช้ตอนทดสอบเท่านั้น
      const page = await ctx.newPage();
      const jsErrors = [];
      page.on("pageerror", e => jsErrors.push(String(e.message || e)));
      try {
        await page.goto(appUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForSelector(".card", { timeout: 25000 });
      } catch (e) {
        add(`ui-load-${vp.name}`, "high", `หน้าแอป (${vp.name}) โหลดไม่ขึ้นหรือไม่มีการ์ดข่าวภายใน 25 วินาที: ${String(e.message || e).slice(0, 120)}`);
        await page.screenshot({ path: path.join(OUT, `${vp.name}-home.png`) }).catch(() => { });
        await ctx.close(); continue;
      }
      // เลื่อนลงให้ภาพโหลด แล้วกลับขึ้นบน
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)) } window.scrollTo(0, 0) });
      await page.waitForTimeout(1500);
      const r = await page.evaluate(() => {
        const cards = [...document.querySelectorAll(".card")];
        const imgs = [...document.querySelectorAll(".card .thumb img")];
        const thai = /[\u0E00-\u0E7F]/;
        const titles = cards.map(c => (c.querySelector("h3") || {}).textContent || "");
        return {
          cards: cards.length, breaking: document.querySelectorAll(".bkc").length, tiles: document.querySelectorAll(".tile").length,
          imgs: imgs.length, imgsLoaded: imgs.filter(i => i.complete && i.naturalWidth > 0).length,
          graphics: [...document.querySelectorAll(".card .thumb")].filter(t => !t.querySelector("img")).length,
          overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
          nonThaiTitles: titles.filter(t => t && !thai.test(t)).length,
          emptyTitles: titles.filter(t => !t.trim()).length,
          updated: (document.getElementById("updated") || {}).textContent || ""
        };
      });
      metrics[vp.name] = r;
      if (r.overflowX) add(`overflow-${vp.name}`, "medium", `หน้าจอ ${vp.name} เลื่อนซ้ายขวาได้ (มีบางส่วนล้นจอ)`);
      if (r.emptyTitles) add(`empty-title-${vp.name}`, "medium", `มีการ์ด ${r.emptyTitles} ใบที่ไม่มีหัวข้อ`);
      if (r.imgs >= 5 && r.imgsLoaded / r.imgs < 0.5) add(`img-load-${vp.name}`, "medium", `ภาพบนหน้าแอปโหลดได้แค่ ${r.imgsLoaded}/${r.imgs} ภาพ (${vp.name})`);
      if (jsErrors.length) add(`js-error-${vp.name}`, "high", `หน้าแอปมีข้อผิดพลาด JavaScript: ${jsErrors.slice(0, 2).join(" | ").slice(0, 200)}`);
      const home = path.join(OUT, `${vp.name}-home.png`);
      await page.screenshot({ path: home });
      shots.push({ name: `${vp.name} หน้าแรก`, file: home });
      // เปิดหน้าอ่านข่าวใบแรกที่มีภาพ (หรือใบแรก)
      const target = await page.$(".card:has(.thumb img)") || await page.$(".card");
      await target.click();
      await page.waitForSelector("#panel .hero", { timeout: 5000 }).catch(() => { });
      await page.waitForTimeout(1200);
      const rd = await page.evaluate(() => {
        const h = document.querySelector("#panel .hero"), c = h && h.querySelector(".cap"), s = document.querySelector("#panel .sum, #panel .body");
        if (!h) return { open: false };
        const hr = h.getBoundingClientRect(), cr = c.getBoundingClientRect(), sr = s ? s.getBoundingClientRect() : null;
        return { open: true, capInside: cr.bottom <= hr.bottom + 1 && cr.top >= hr.top - 1, textBelowImage: !sr || sr.top >= hr.bottom - 1, paragraphs: document.querySelectorAll("#panel .body p").length };
      });
      metrics[vp.name].reader = rd;
      if (!rd.open) add(`reader-${vp.name}`, "high", `กดการ์ดข่าวแล้วหน้าอ่านข่าวไม่เปิด (${vp.name})`);
      else if (!rd.capInside || !rd.textBelowImage) add(`reader-overlap-${vp.name}`, "high", `หน้าอ่านข่าว (${vp.name}) มีข้อความทับรูปภาพ`);
      const reader = path.join(OUT, `${vp.name}-reader.png`);
      await page.screenshot({ path: reader });
      shots.push({ name: `${vp.name} หน้าอ่านข่าว`, file: reader });
      await ctx.close();
    }
  } finally { await browser.close() }
  return { issues, metrics, shots };
}

// ให้ AI (Gemini มองเห็นภาพ) ดูภาพหน้าจอหาจุดผิดปกติที่โค้ดตรวจไม่เจอ
async function visionReview({ shots, apiKey, fetchImpl = fetch, log = console }) {
  if (!apiKey || !shots.length) return [];
  const prompt = `You are a careful QA tester for "Korea Watch", a Thai-language news app about South Korea.
Look at these screenshots (mobile home, mobile article reader, desktop home, desktop article reader).
Report ONLY clear, real defects a user would notice: overlapping or cut-off text, broken or misaligned layout, empty or blank cards, missing images where an image frame is empty grey, unreadable text contrast, headlines in Korean or English instead of Thai while the app is in Thai mode, error messages on screen.
Do NOT report: coloured category cards with an icon (these are intentional placeholders for stories without photos), Korean names of news outlets, small style preferences.
Reply with ONLY JSON: {"issues":[{"key":"short-kebab-id","severity":"high|medium|low","what":"one sentence in Thai"}]} (empty list if everything looks fine).`;
  const parts = [{ text: prompt }, ...shots.slice(0, 4).map(s => ({ inline_data: { mime_type: "image/png", data: fs.readFileSync(s.file).toString("base64") } }))];
  for (const model of VISION_MODELS) {
    try {
      const r = await timedFetch(fetchImpl, `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, 90000,
        { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": apiKey }, body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseMimeType: "application/json", temperature: 0.1 } }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { log.warn(`vision ${model} ${r.status}`); continue }
      const text = (data.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text || "").join("");
      const j = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
      return (j.issues || []).filter(i => i && i.what).slice(0, 8).map(i => ({ key: "ai-" + norm(i.key || i.what).slice(0, 30), severity: ["high", "medium", "low"].includes(i.severity) ? i.severity : "low", what: String(i.what).slice(0, 200), byAI: true }));
    } catch (e) { log.warn("vision failed", model, e.message) }
  }
  return [];
}

// ───── 4) รายงาน ─────
// รายงานเฉพาะปัญหาที่เจอซ้ำ 2 รอบติดกัน (กัน AI ทักผิดครั้งเดียว) ยกเว้นปัญหาร้ายแรงที่ไม่ได้มาจาก AI
function pickReportable(issues, prevKeys) {
  return issues.filter(i => !i.auto && ((i.severity === "high" && !i.byAI) || prevKeys.has(i.key)));
}

function reportBody({ metrics, ui, issues, fixesQueued, runUrl, now }) {
  const sev = { high: "🔴 ร้ายแรง", medium: "🟠 ปานกลาง", low: "⚪ เล็กน้อย" };
  const lines = [
    `**ตรวจล่าสุด:** ${new Date(now).toISOString().replace("T", " ").slice(0, 16)} UTC`, "",
    "### ปัญหาที่ต้องดู", ...issues.map(i => `- ${sev[i.severity] || ""} ${i.what}${i.byAI ? " _(AI ตรวจจากภาพหน้าจอ)_" : ""}`), "",
    "### ภาพรวมข้อมูลข่าว",
    `| รายการ | ค่า |`, `|---|---|`,
    `| ข่าวทั้งหมด | ${metrics.total} |`, `| แปลแล้ว / ค้างแปล | ${metrics.translated} / ${metrics.untranslated} |`,
    `| สรุปละเอียด / เนื้อหาสั้น | ${metrics.rich} / ${metrics.shortBody} |`, `| ข่าว 2 วันล่าสุดที่มีภาพ | ${metrics.imagePct}% |`,
    `| ตัวค้นข่าวอัปเดตล่าสุด | ${metrics.lastRunMin ?? "?"} นาทีที่แล้ว |`, "",
    ...(fixesQueued ? [`Agent สั่งแก้ข้อมูลอัตโนมัติไปแล้ว ${fixesQueued} รายการ (ตัวค้นข่าวจะแก้ในรอบถัดไป)`, ""] : []),
    ...(ui ? ["### หน้าแอป", ...Object.entries(ui).map(([k, v]) => `- **${k}**: การ์ด ${v.cards} ใบ, ภาพโหลดได้ ${v.imgsLoaded}/${v.imgs}, หัวข้อไม่ใช่ภาษาไทย ${v.nonThaiTitles} ใบ`), ""] : []),
    runUrl ? `ภาพหน้าจอดูได้ที่ ${runUrl} (ส่วน Artifacts)` : "",
    "", "_ปัญหาที่ต้องแก้โค้ด: ส่งรายงานนี้ให้ผู้พัฒนาได้เลย_"
  ];
  return lines.join("\n");
}

async function syncIssue({ token, repo, reportable, body, fetchImpl = fetch, log = console }) {
  if (!token || !repo) return "skipped";
  const api = (p, method = "GET", data) => timedFetch(fetchImpl, `https://api.github.com/repos/${repo}${p}`, 15000,
    { method, headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "content-type": "application/json" }, body: data ? JSON.stringify(data) : undefined });
  const list = await (await api(`/issues?state=open&labels=agent-report&per_page=10`)).json().catch(() => []);
  const open = Array.isArray(list) ? list.find(i => i.title === ISSUE_TITLE) : null;
  if (reportable.length) {
    if (!open) { await api("/issues", "POST", { title: ISSUE_TITLE, body, labels: ["agent-report"] }); return "opened" }
    const known = open.body || "";
    const fresh = reportable.filter(i => !known.includes(i.what));
    await api(`/issues/${open.number}`, "PATCH", { body });
    if (fresh.length) await api(`/issues/${open.number}/comments`, "POST", { body: "พบปัญหาใหม่:\n" + fresh.map(i => "- " + i.what).join("\n") }); // คอมเมนต์ = GitHub ส่งอีเมลแจ้ง
    return "updated";
  }
  if (open) {
    await api(`/issues/${open.number}/comments`, "POST", { body: "✅ ตรวจรอบล่าสุดไม่พบปัญหาแล้ว Agent ปิดรายงานนี้ให้อัตโนมัติ" });
    await api(`/issues/${open.number}`, "PATCH", { state: "closed" });
    return "closed";
  }
  return "ok";
}

async function runAgent({ db, chromium, launchOpts, prepare, appUrl, geminiKey, token, repo, runUrl, fetchImpl = fetch, now = Date.now(), log = console }) {
  const [feedSnap, statusSnap, healthSnap, fixSnap] = await Promise.all(["meta/feed", "meta/status", "meta/health", "meta/fixes"].map(p => db.doc(p).get()));
  const items = feedSnap.exists ? (feedSnap.data().items || []) : [];
  const data = await auditData({ items, status: statusSnap.exists ? statusSnap.data() : null, now, fetchImpl });
  let ui = null, uiIssues = [], aiIssues = [];
  if (chromium) {
    try {
      const u = await auditUI({ appUrl, chromium, launchOpts, prepare });
      ui = u.metrics; uiIssues = u.issues;
      aiIssues = await visionReview({ shots: u.shots, apiKey: geminiKey, fetchImpl, log });
    } catch (e) { uiIssues.push({ key: "ui-agent", severity: "medium", what: `Agent เปิดหน้าแอปไม่สำเร็จ: ${String(e.message || e).slice(0, 150)}` }) }
  }
  const issues = [...data.issues, ...uiIssues, ...aiIssues];
  // ส่งงานแก้ข้อมูลให้ตัวค้นข่าว (รวมกับงานที่ยังค้างอยู่ ไม่ซ้ำ)
  const prev = fixSnap.exists ? fixSnap.data() : {};
  const merged = {}; let fixesQueued = 0;
  for (const k of ["requeueImage", "retranslate", "enrich", "remove"]) { merged[k] = [...new Set([...(prev[k] || []), ...data.fixes[k]])]; fixesQueued += data.fixes[k].length }
  if (fixesQueued) await db.doc("meta/fixes").set({ ...merged, at: new Date(now).toISOString() });
  const prevKeys = new Set(healthSnap.exists ? (healthSnap.data().issues || []).map(i => i.key) : []);
  const reportable = pickReportable(issues, prevKeys);
  const status = reportable.some(i => i.severity === "high") ? "fail" : reportable.length ? "warn" : "ok";
  const body = reportBody({ metrics: data.metrics, ui, issues: reportable, fixesQueued, runUrl, now });
  let gh = "skipped";
  try { gh = await syncIssue({ token, repo, reportable, body, fetchImpl, log }) } catch (e) { log.warn("github issue failed", e.message) }
  await db.doc("meta/health").set({ at: new Date(now).toISOString(), status, metrics: data.metrics, ui, issues, reported: reportable.map(i => i.key), fixesQueued, github: gh });
  log.log(`agent: status ${status}, issues ${issues.length} (reported ${reportable.length}), fixes queued ${fixesQueued}, github ${gh}`);
  for (const i of issues) log.log(` - [${i.severity}${i.auto ? ", auto-fixed" : ""}${i.byAI ? ", AI" : ""}] ${i.what}`);
  return { status, issues, reportable, fixesQueued, gh };
}

async function main() {
  const { initializeApp, cert } = require("firebase-admin/app");
  const { getFirestore } = require("firebase-admin/firestore");
  let sa;
  try { sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "") } catch (e) { throw new Error("FIREBASE_SERVICE_ACCOUNT secret is missing or not valid JSON") }
  initializeApp({ credential: cert(sa) });
  let chromium = null;
  try { chromium = require("playwright").chromium } catch (e) { console.warn("playwright not installed: UI check skipped") }
  await runAgent({
    db: getFirestore(), chromium, launchOpts: process.env.AGENT_CHROMIUM ? { executablePath: process.env.AGENT_CHROMIUM } : {},
    appUrl: (process.env.APP_URL || `https://${sa.project_id}.web.app`).replace(/\/$/, "") + "/",
    geminiKey: process.env.GEMINI_API_KEY, token: process.env.GITHUB_TOKEN, repo: process.env.GITHUB_REPOSITORY, runUrl: process.env.RUN_URL
  });
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1) });
module.exports = { auditData, auditUI, visionReview, pickReportable, reportBody, syncIssue, runAgent };
