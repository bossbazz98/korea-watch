const { allItems } = require("./test-data");
// ทดสอบการคุมเวลาและการลองใหม่ของข่าวที่พักไว้: node tools/selftest3.js
const assert = require("assert");
const { runOnce } = require("../run");
const { translate } = require("../lib/translate");

function fakeDb() {
  const data = new Map();
  const ref = path => ({ path,
    async get() { const d = data.get(path); return { exists: !!d, data: () => JSON.parse(JSON.stringify(d)) } },
    async set(v) { data.set(path, JSON.parse(JSON.stringify(v))) },
    async update(p) { data.set(path, { ...data.get(path), ...p }) }, async delete() { data.delete(path) } });
  const q = (col, fl = []) => ({ where(f, o, v) { return q(col, [...fl, [f, v]]) }, limit() { return this },
    async get() { const docs = [...data.entries()].filter(([p, d]) => p.startsWith(col + "/") && fl.every(([f, v]) => d[f] === v)).map(([p, d]) => ({ ref: ref(p), data: () => d })); return { empty: !docs.length, docs } } });
  return { data, doc: ref, collection: c => q(c) };
}
const log = { log() {}, warn() {} };
const msg = { async sendEachForMulticast(m) { return { successCount: m.tokens.length, responses: m.tokens.map(() => ({ success: true })) } } };
const now = Date.parse("2026-10-31T10:00:00Z");
const item = (id, extra = {}) => ({ id, titleKo: "북한 " + id, snippetKo: "", title: { ko: "북한 " + id }, summary: {}, body: {}, categories: ["war"], level: "normal", translated: false, attempts: 0, publishedAt: new Date(now - 3600e3).toISOString(), addedAt: new Date(now).toISOString(), source: "KBS", sourceUrl: "https://x", links: [] , ...extra });
const okReply = async (url, opt) => {
  if (!url.startsWith("https://generativelanguage")) return { ok: true, text: async () => "<rss><channel></channel></rss>" };
  const input = JSON.parse(JSON.parse(opt.body).contents[0].parts[0].text);
  return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(input.map(x => ({ i: x.i, relevant: true, categories: ["war"], level: "normal", title: { th: "แปลแล้ว", en: "t" }, summary: { th: "ส", en: "s" }, body_th: ["บ"] }))) }] } }] }) };
};

(async () => {
  // 1) Gemini ค้างไม่ตอบ: รอบต้องจบภายในเวลาที่กำหนดและบันทึกผลได้
  let db = fakeDb();
  await db.doc("meta/feed").set({ v: 8, items: [item("a"), item("b")] });
  const hang = async (url, opt) => {
    if (!url.startsWith("https://generativelanguage")) return { ok: true, text: async () => "<rss><channel></channel></rss>" };
    return new Promise((_, rej) => opt.signal.addEventListener("abort", () => { const e = new Error("aborted"); e.name = "AbortError"; rej(e) }));
  };
  const t0 = Date.now();
  const s1 = await runOnce({ db, messaging: msg, appUrl: "https://x", geminiKey: "k", fetchImpl: hang, now, log, waitMs: 0, budgetMs: 30000 });
  const took = Date.now() - t0;
  assert.ok(took < 30000, "run finished within budget (" + took + "ms)");
  assert.ok(db.data.get("meta/status").lastRun, "status saved even though Gemini hung");
  assert.ok(allItems(db.data).every(i => i.attempts === 0), "hang is not counted as failure");
  assert.match(s1.lastError, /busy|time budget/);

  // 2) ข่าวที่พักไว้ (ล้มเหลวครบ 4 ครั้ง) ลองใหม่หลัง 3 ชั่วโมง
  db = fakeDb();
  await db.doc("meta/feed").set({ v: 9, items: [item("old", { attempts: 4, lastTry: now - 4 * 3600e3 }), item("recent", { attempts: 4, lastTry: now - 3600e3 })] });
  const s2 = await runOnce({ db, messaging: msg, appUrl: "https://x", geminiKey: "k", fetchImpl: okReply, now, log, waitMs: 0 });
  const f = allItems(db.data);
  assert.strictEqual(f.find(i => i.id === "old").translated, true, "paused 4h ago → retried and translated");
  assert.strictEqual(f.find(i => i.id === "recent").translated, false, "paused 1h ago → still waiting");
  assert.strictEqual(s2.pending, 1, "pending counts paused items too");

  // 3) แปลเต็มได้ 16 ข่าวต่อรอบ (8 ชุด ชุดละ 2)
  db = fakeDb();
  await db.doc("meta/feed").set({ v: 8, items: Array.from({ length: 35 }, (_, k) => item("n" + k)) });
  const s3 = await runOnce({ db, messaging: msg, appUrl: "https://x", geminiKey: "k", fetchImpl: okReply, now, log, waitMs: 0 });
  assert.strictEqual(s3.translated, 16); assert.strictEqual(s3.batches, "8/8"); assert.strictEqual(s3.pending, 19);

  // 4) รุ่นปฏิเสธการตั้งค่า thinking ด้วยข้อความอะไรก็ได้ → ลองใหม่แบบไม่ตั้งค่า
  const seen = [];
  const odd = async (url, opt) => { const b = JSON.parse(opt.body); seen.push(!!b.generationConfig.thinkingConfig);
    if (b.generationConfig.thinkingConfig) return { ok: false, status: 400, json: async () => ({ error: { message: "Invalid value at 'generation_config' (budget)" } }) };
    return okReply(url, opt); };
  const o = await translate([{ titleKo: "북한", snippet: "", source: "", cats: ["war"] }], { apiKey: "k", models: ["gemini-x-test"], fetchImpl: odd, log, waitMs: 0 });
  assert.deepStrictEqual(seen, [true, false]); assert.strictEqual(o.results[0].title.th, "แปลแล้ว");

  console.log("ผ่านทุกข้อ (ชุดที่ 3)");
})().catch(e => { console.error("ไม่ผ่าน:", e.message); process.exit(1); });
