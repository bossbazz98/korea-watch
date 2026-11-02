// ทดสอบ AI Agent: ตรวจข้อมูล, สั่งแก้, เปิดหน้าแอปจริง, AI ดูภาพ, รายงาน GitHub: node tools/selftest8.js
// (ต้องมี Chromium: ตั้ง AGENT_CHROMIUM=path ถ้าไม่ได้ติดตั้งผ่าน npx playwright install)
const assert = require("assert");
const http = require("http"), fs = require("fs"), path = require("path");
const { auditData, pickReportable, syncIssue, runAgent } = require("../agent");
const log = { log() {}, warn() {} };
const now = Date.now(), iso = h => new Date(now - h * 3600e3).toISOString();
const item = (id, x = {}) => ({ id, titleKo: "기사", title: { th: "ข่าวทดสอบ " + id, en: "t" }, summary: { th: "สรุป", en: "s" }, body: { th: ["ก".repeat(500)] }, rich: true, categories: ["war"], level: "normal", translated: true, publishedAt: iso(1), addedAt: iso(1), source: "KBS", sourceUrl: "https://x/" + id, links: [], ...x });

(async () => {
  // 1) ตรวจข้อมูล + สั่งแก้
  const items = [
    item("ok1", { image: "https://img.ok/1.jpg" }),
    item("en", { title: { th: "English headline", en: "x" } }),
    item("short", { rich: false, body: { th: ["สั้น"] } }),
    item("broken", { image: "https://img.dead/1.jpg" }),
    item("dupA", { title: { th: "เกาหลีเหนือยิงขีปนาวุธลงทะเลตะวันออก", en: "" }, image: "https://img.ok/2.jpg" }),
    item("dupB", { title: { th: "เกาหลีเหนือยิงขีปนาวุธลงทะเลตะวันออก", en: "" } }),
    ...Array.from({ length: 12 }, (_, k) => item("stuck" + k, { translated: false, title: { ko: "x" }, addedAt: iso(3), publishedAt: iso(3) }))
  ];
  const f = async url => ({ ok: !/img\.dead/.test(decodeURIComponent(url)) });
  const d = await auditData({ items, status: { lastRun: iso(1) }, now, fetchImpl: f });
  const keys = d.issues.map(i => i.key);
  assert.ok(keys.includes("stale"), "worker stopped 60 min ago → reported");
  assert.ok(keys.includes("backlog"), "12 stories stuck > 2h");
  assert.deepStrictEqual(d.fixes.retranslate, ["en"]); assert.deepStrictEqual(d.fixes.enrich, ["short"]);
  assert.deepStrictEqual(d.fixes.requeueImage, ["broken"]); assert.deepStrictEqual(d.fixes.remove, ["dupB"], "duplicate without image removed, the one with image kept");
  assert.strictEqual(d.metrics.brokenImages, 1);

  // 2) รายงานเฉพาะปัญหาที่เจอซ้ำ 2 รอบ (ยกเว้นร้ายแรงที่ไม่ได้มาจาก AI) และไม่รายงานสิ่งที่แก้อัตโนมัติแล้ว
  const iss = [{ key: "stale", severity: "high", what: "a" }, { key: "backlog", severity: "medium", what: "b" }, { key: "ai-x", severity: "high", what: "c", byAI: true }, { key: "dup", severity: "low", what: "d", auto: true }];
  assert.deepStrictEqual(pickReportable(iss, new Set()).map(i => i.key), ["stale"]);
  assert.deepStrictEqual(pickReportable(iss, new Set(["backlog", "ai-x", "dup"])).map(i => i.key), ["stale", "backlog", "ai-x"]);

  // 3) GitHub Issue: เปิด → อัปเดต+คอมเมนต์เมื่อมีปัญหาใหม่ → ปิดเมื่อหาย
  const gh = []; let openIssue = null;
  const ghFetch = async (url, opt = {}) => {
    const m = opt.method || "GET", b = opt.body ? JSON.parse(opt.body) : null; gh.push(m + " " + url.replace("https://api.github.com/repos/me/kw", ""));
    if (m === "GET") return { ok: true, json: async () => openIssue ? [openIssue] : [] };
    if (m === "POST" && url.endsWith("/issues")) openIssue = { number: 7, title: b.title, body: b.body };
    if (m === "PATCH" && b.body) openIssue.body = b.body;
    if (m === "PATCH" && b.state === "closed") openIssue = null;
    return { ok: true, json: async () => ({}) };
  };
  assert.strictEqual(await syncIssue({ token: "t", repo: "me/kw", reportable: [{ what: "ปัญหา A" }], body: "ปัญหา A", fetchImpl: ghFetch }), "opened");
  assert.strictEqual(await syncIssue({ token: "t", repo: "me/kw", reportable: [{ what: "ปัญหา A" }, { what: "ปัญหา B" }], body: "ปัญหา A\nปัญหา B", fetchImpl: ghFetch }), "updated");
  assert.ok(gh.some(x => x === "POST /issues/7/comments"), "new problem → comment (GitHub emails the owner)");
  assert.strictEqual(await syncIssue({ token: "t", repo: "me/kw", reportable: [], body: "", fetchImpl: ghFetch }), "closed");

  // 4) เปิดหน้าแอปจริงในเบราว์เซอร์ (แอปจริงจาก public/ + Firebase จำลอง)
  let chromium = null;
  try { chromium = require("playwright").chromium } catch (e) { }
  const exe = process.env.AGENT_CHROMIUM;
  if (!chromium || !exe) { console.log("ข้ามการทดสอบหน้าแอป (ไม่มี Chromium)"); console.log("ผ่านทุกข้อ (ชุดที่ 8: AI Agent)"); return; }
  const pub = path.join(__dirname, "..", "..", "public");
  const srv = http.createServer((q, s) => { const f = path.join(pub, decodeURIComponent(q.url.split("?")[0]) === "/" ? "index.html" : decodeURIComponent(q.url.split("?")[0])); fs.readFile(f, (e, b) => { if (e) { s.writeHead(404); s.end(); return } s.writeHead(200, { "content-type": f.endsWith(".js") ? "text/javascript" : f.endsWith(".html") ? "text/html" : f.endsWith(".png") ? "image/png" : "application/octet-stream" }); s.end(b) }) }).listen(8799);
  const feedItems = [items[0], items[4], item("noimg"), item("mid", { image: "https://img.ok/3.jpg" })];
  const img = fs.readFileSync(path.join(pub, "icons", "icon-512.png"));
  const STUB = {
    "firebase-app.js": "export const initializeApp=c=>({c});",
    "firebase-firestore.js": `const D=${JSON.stringify(feedItems)};export const persistentLocalCache=()=>({});export const initializeFirestore=()=>({});export const getFirestore=()=>({});export const doc=(d,...p)=>p.join('/');export const serverTimestamp=()=>'TS';export async function setDoc(){}
export function onSnapshot(ref,ok){setTimeout(()=>{if(ref==="meta/feed")ok({exists:()=>true,data:()=>({items:D}),metadata:{fromCache:false}});else ok({exists:()=>true,data:()=>({lastRun:new Date().toISOString()})})},30);return()=>{}}`,
    "firebase-messaging.js": "export const isSupported=async()=>false;"
  };
  const prepare = async ctx => {
    await ctx.route("https://www.gstatic.com/**", r => r.fulfill({ status: 200, contentType: "text/javascript", body: STUB[r.request().url().split("/").pop()] || "" }));
    await ctx.route("**/firebase-config.js", r => r.fulfill({ status: 200, contentType: "text/javascript", body: "self.KW_CONFIG={firebase:{apiKey:'AIzaFAKE',projectId:'p'},vapidKey:'B'};" }));
    await ctx.route("https://wsrv.nl/**", r => r.fulfill({ status: 200, contentType: "image/png", body: img }));
    await ctx.route("https://fonts.googleapis.com/**", r => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
  };
  const store = new Map([["meta/feed", { items: feedItems }], ["meta/status", { lastRun: new Date().toISOString() }]]);
  const db = { doc: p => ({ async get() { const v = store.get(p); return { exists: !!v, data: () => v } }, async set(v) { store.set(p, v) } }) };
  let visionAsked = 0;
  const vfetch = async (url, opt) => {
    if (url.includes("generativelanguage")) { visionAsked = JSON.parse(opt.body).contents[0].parts.filter(p => p.inline_data).length; return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ issues: [{ key: "tiny-font", severity: "low", what: "ตัวอักษรเล็กไปเล็กน้อย" }] }) }] } }] }) } }
    return { ok: true, json: async () => [] };
  };
  try {
    const res = await runAgent({ db, chromium, launchOpts: { executablePath: exe }, prepare, appUrl: "http://localhost:8799/", geminiKey: "k", fetchImpl: vfetch, now, log });
    const h = store.get("meta/health");
    assert.ok(h.ui["mobile-light"].cards >= 4 && h.ui["desktop-dark"].cards >= 4, "cards rendered on both screens");
    assert.strictEqual(h.ui["mobile-light"].overflowX, false, "no sideways overflow");
    assert.ok(h.ui["mobile-light"].reader.open && h.ui["mobile-light"].reader.textBelowImage, "reader opens, text below image");
    assert.strictEqual(visionAsked, 4, "4 screenshots sent to the AI");
    assert.ok(h.issues.some(i => i.byAI && i.key.startsWith("ai-")), "AI finding recorded");
    assert.ok(!res.reportable.some(i => i.byAI), "AI finding not reported on first sighting");
    assert.ok(fs.existsSync(path.join(__dirname, "..", "agent-out", "mobile-light-reader.png")), "screenshots saved for GitHub artifact");
  } finally { srv.close() }
  console.log("ผ่านทุกข้อ (ชุดที่ 8: AI Agent)");
})().catch(e => { console.error("ไม่ผ่าน:", e.stack || e.message); process.exit(1); });
