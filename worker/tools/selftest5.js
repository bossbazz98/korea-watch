const { allItems } = require("./test-data");
// ทดสอบการตรวจภาษาไทยในผลแปล: node tools/selftest5.js
const assert = require("assert");
const { translate, hasThai } = require("../lib/translate");
const { runOnce } = require("../run");
const log = { log() {}, warn() {} };

(async () => {
  assert.ok(hasThai("ข่าวด่วน")); assert.ok(!hasThai("Ruling and opposition clash")); assert.ok(!hasThai("")); assert.ok(hasThai("G20 ที่แอตแลนตา"));

  // AI ใส่ภาษาอังกฤษในช่องไทย → ไม่รับ (null) ส่วนข้อที่ถูกต้องรับตามปกติ / ข่าวไม่เกี่ยวข้องไม่ต้องมีภาษาไทย
  const reply = [
    { i: 0, relevant: true, categories: ["president"], level: "normal", title: { th: "Ruling and opposition clash over president", en: "Ruling and opposition clash" }, summary: { th: "x", en: "x" }, body_th: ["x"] },
    { i: 1, relevant: true, categories: ["war"], level: "normal", title: { th: "เกาหลีเหนือยิงขีปนาวุธ", en: "NK missile" }, summary: { th: "สรุป", en: "s" }, body_th: ["บ"] },
    { i: 2, relevant: true, categories: ["war"], level: "normal", title: { th: "หัวข้อไทย", en: "t" }, summary: { th: "English summary only", en: "s" }, body_th: [] },
    { i: 3, relevant: false, categories: [], level: "normal", title: { th: "", en: "" }, summary: {}, body_th: [] }
  ];
  const f = async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] } }] }) });
  const items = [0, 1, 2, 3].map(k => ({ titleKo: "뉴스 " + k, snippet: "", source: "", cats: ["war"] }));
  const { results } = await translate(items, { apiKey: "k", fetchImpl: f, log, waitMs: 0 });
  assert.strictEqual(results[0], null, "English in Thai title rejected");
  assert.strictEqual(results[1].title.th, "เกาหลีเหนือยิงขีปนาวุธ");
  assert.strictEqual(results[2], null, "English in Thai summary rejected");
  assert.strictEqual(results[3].relevant, false, "irrelevant item needs no Thai");

  // ข่าวเดิม (เวอร์ชัน 5) ที่หัวข้อไทยเป็นภาษาอังกฤษ → ส่งกลับไปแปลใหม่ ส่วนข่าวที่ถูกต้องคงไว้
  const data = new Map();
  const ref = p => ({ async get() { const d = data.get(p); return { exists: !!d, data: () => JSON.parse(JSON.stringify(d)) } }, async set(v) { data.set(p, JSON.parse(JSON.stringify(v))) }, async update() { }, async delete() { } });
  const db = { doc: ref, collection: () => ({ where() { return this }, limit() { return this }, async get() { return { empty: true, docs: [] } } }) };
  const now = Date.now(), base = { categories: ["president"], level: "normal", translated: true, publishedAt: new Date(now - 6e5).toISOString(), source: "연합뉴스TV", sourceUrl: "https://x", links: [], image: "https://img/1.jpg", body: { th: ["เนื้อข่าว"] }, summary: { th: "สรุปข่าว", en: "summary" } };
  data.set("meta/feed", { v: 5, items: [
    { ...base, id: "en", titleKo: "여야 대통령 SNS 공방", title: { th: "Ruling and opposition clash", en: "Ruling and opposition clash" } },
    { ...base, id: "th", titleKo: "외교장관 회담", title: { th: "รมว.ต่างประเทศประชุม", en: "FM meeting" } }
  ] });
  const rss = async url => ({ ok: true, text: async () => "<rss><channel></channel></rss>", arrayBuffer: async () => Buffer.from("") });
  await runOnce({ db, messaging: {}, appUrl: "https://x", geminiKey: "", fetchImpl: rss, now, log, waitMs: 0 });
  const fd = {...data.get("meta/feed"),items:allItems(data)}, by = id => fd.items.find(i => i.id === id);
  assert.strictEqual(fd.v, 8);
  assert.strictEqual(by("en").translated, false, "English-titled item sent back for translation");
  assert.strictEqual(by("en").title.ko, "여야 대통령 SNS 공방", "shows Korean headline until re-translated");
  assert.deepStrictEqual(by("en").title, { ko: "여야 대통령 SNS 공방" }, "no English left to show in Thai mode");
  assert.strictEqual(by("en").image, "https://img/1.jpg", "image kept");
  assert.strictEqual(by("th").translated, true, "correct Thai item untouched");
  console.log("ผ่านทุกข้อ (ชุดที่ 5: ตรวจภาษาไทย)");
})().catch(e => { console.error("ไม่ผ่าน:", e.stack || e.message); process.exit(1); });
