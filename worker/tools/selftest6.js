const { allItems } = require("./test-data");
// ทดสอบ Groq (ตัวหลัก) + Gemini (สำรอง) + คิวแปลด่วน + แปลหัวข้อก่อน: node tools/selftest6.js
const assert = require("assert");
const { translate, translateTitles } = require("../lib/translate");
const { runOnce } = require("../run");
const log = { log() {}, warn() {} };

const fullItem = (x, tag) => ({ i: x.i, relevant: true, categories: ["war"], level: "normal", title: { th: `แปลโดย ${tag} ${x.i}`, en: "t" }, summary: { th: "สรุป", en: "s" }, body_th: ["บ"] });
function mockAI({ groq = "ok", gemini = "ok" } = {}) {
  const calls = [];
  const f = async (url, opt) => {
    if (!url.startsWith("https://api.groq.com") && !url.startsWith("https://generativelanguage")) return { ok: true, text: async () => "<rss><channel></channel></rss>", arrayBuffer: async () => Buffer.from("") };
    const b = JSON.parse(opt.body);
    if (url.startsWith("https://api.groq.com")) {
      calls.push({ p: "groq", m: b.model, json: !!b.response_format, effort: b.reasoning_effort, auth: opt.headers.authorization, sys: b.messages[0].content.slice(0, 20) });
      const mode = typeof groq === "function" ? groq(b) : groq;
      if (mode === 401) return { ok: false, status: 401, json: async () => ({ error: { message: "Invalid API Key" } }) };
      if (mode === 429) return { ok: false, status: 429, json: async () => ({ error: { message: "Rate limit reached for model" } }) };
      if (mode === "nojson" && b.response_format) return { ok: false, status: 400, json: async () => ({ error: { message: "response_format json_object is not supported for this model" } }) };
      const input = JSON.parse(b.messages[1].content);
      const titles = b.messages[0].content.startsWith("Translate Korean news headlines");
      const items = input.map(x => titles ? { i: x.i, th: "หัวข้อ " + x.headline, en: "T" } : fullItem(x, "groq"));
      return { ok: true, status: 200, json: async () => ({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ items }) } }] }) };
    }
    calls.push({ p: "gemini", m: decodeURIComponent(url.split("/models/")[1].split(":")[0]) });
    if (gemini === 503) return { ok: false, status: 503, json: async () => ({ error: { message: "high demand" } }) };
    const input = JSON.parse(b.contents[0].parts[0].text);
    const titles = b.systemInstruction.parts[0].text.startsWith("Translate Korean news headlines");
    const items = input.map(x => titles ? { i: x.i, th: "หัวข้อ " + x.headline, en: "T" } : fullItem(x, "gemini"));
    return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ items }) }] } }] }) };
  };
  return { f, calls };
}
const one = [{ titleKo: "북한 미사일", snippet: "", source: "KBS", cats: ["war"] }];

(async () => {
  // 1) Groq เป็นตัวหลัก: ส่งคีย์ถูกที่ เปิด json mode และลดการคิดของ gpt-oss
  let m = mockAI();
  let o = await translate(one, { apiKey: "g", groqKey: "gk", fetchImpl: m.f, log, waitMs: 0 });
  assert.strictEqual(o.model, "groq:openai/gpt-oss-120b"); assert.strictEqual(o.results[0].title.th, "แปลโดย groq 0");
  assert.deepStrictEqual(m.calls[0], { p: "groq", m: "openai/gpt-oss-120b", json: true, effort: "low", auth: "Bearer gk", sys: "You are the news edi" });

  // 2) Groq ติดโควตาทุกรุ่น → ใช้ Gemini แทน
  m = mockAI({ groq: 429 });
  o = await translate(one, { apiKey: "g", groqKey: "gk", fetchImpl: m.f, log, waitMs: 0 });
  assert.deepStrictEqual(m.calls.map(c => c.p + ":" + c.m), ["groq:openai/gpt-oss-120b", "groq:openai/gpt-oss-20b", "groq:qwen/qwen3-32b", "gemini:gemini-flash-lite-latest"]);
  assert.strictEqual(o.results[0].title.th, "แปลโดย gemini 0");

  // 3) คีย์ Groq ผิด → ข้าม Groq ทั้งหมดทันที ไปใช้ Gemini
  m = mockAI({ groq: 401 });
  o = await translate(one, { apiKey: "g", groqKey: "bad", fetchImpl: m.f, log, waitMs: 0 });
  assert.strictEqual(m.calls.filter(c => c.p === "groq").length, 1, "bad key tried once only"); assert.strictEqual(o.model, "gemini:gemini-flash-lite-latest");

  // 4) รุ่นไม่รับ json mode → ลองรุ่นเดิมแบบพื้นฐาน
  m = mockAI({ groq: "nojson" });
  o = await translate(one, { apiKey: "", groqKey: "gk", fetchImpl: m.f, log, waitMs: 0 });
  assert.deepStrictEqual(m.calls.map(c => c.json), [true, false]); assert.strictEqual(o.model, "groq:openai/gpt-oss-120b");

  // 5) ไม่มี Gemini key และ Groq ยุ่ง → ข้อผิดพลาดชั่วคราว (ไม่นับว่าแปลล้มเหลว)
  m = mockAI({ groq: 429 });
  await assert.rejects(translate(one, { apiKey: "", groqKey: "gk", fetchImpl: m.f, log, waitMs: 0 }), e => e.transient === true);
  await assert.rejects(translate(one, { fetchImpl: m.f, log, waitMs: 0 }), /no AI key/);

  // 6) แปลหัวข้อทีละ 40
  m = mockAI();
  const t = await translateTitles(Array.from({ length: 40 }, (_, k) => ({ titleKo: "제목 " + k })), { groqKey: "gk", fetchImpl: m.f, log, waitMs: 0 });
  assert.strictEqual(t.results.filter(Boolean).length, 40); assert.strictEqual(t.results[7].th, "หัวข้อ 제목 7");

  // 7) ในรอบจริง: คิวแปลด่วนได้แปลก่อน → แปลหัวข้อทีละ 40 → แปลเต็มที่เหลือ / ล้างคิวที่เสร็จแล้ว
  const data = new Map();
  const ref = p => ({ path: p, id: p.split("/").pop(), async get() { const d = data.get(p); return { exists: !!d, data: () => JSON.parse(JSON.stringify(d)) } }, async set(v) { data.set(p, JSON.parse(JSON.stringify(v))) }, async update(v) { data.set(p, { ...data.get(p), ...v }) }, async delete() { data.delete(p) } });
  const db = { doc: ref, collection: col => ({ where() { return this }, limit() { return this }, async get() { const docs = [...data.keys()].filter(k => k.startsWith(col + "/")).map(k => ({ id: k.split("/").pop(), ref: ref(k), data: () => data.get(k) })); return { empty: !docs.length, docs } } }) };
  const now = Date.now();
  const item = (id, cat, h) => ({ id, titleKo: "기사 " + id, snippetKo: "", title: { ko: "기사 " + id }, summary: {}, body: {}, categories: [cat], level: "normal", translated: false, attempts: 0, publishedAt: new Date(now - h * 3600e3).toISOString(), source: "KBS", sourceUrl: "https://x", links: [] });
  const its = [item("lawOld", "law", 20), ...Array.from({ length: 49 }, (_, k) => item("w" + k, "war", k * 0.1))];
  data.set("meta/feed", { v: 8, items: its });
  data.set("priority/lawOld", { at: null });
  data.set("priority/gone", { at: null });
  m = mockAI();
  const st = await runOnce({ db, messaging: {}, appUrl: "https://x", geminiKey: "g", groqKey: "gk", fetchImpl: m.f, now, log, waitMs: 0 });
  const ai = m.calls;
  assert.ok(ai[0].sys.startsWith("You are the news edi"), "first AI call is the full translation of the priority item");
  const feed = allItems(data), by = id => feed.find(i => i.id === id);
  assert.strictEqual(by("lawOld").translated, true, "priority item translated even though it is old and low-rank");
  assert.strictEqual(st.priority, 1);
  assert.strictEqual(ai.filter(c => c.sys.startsWith("Translate Korean")).length, 0, "hidden (non-Korean-war) stories skip the title-only pass");
  assert.strictEqual(st.translated, 16, "1 priority + 15 more full translations (max 16)");
  assert.strictEqual(st.hidden, 49 - 15, "untranslated stories stay hidden from the app");
  assert.ok(!data.has("priority/lawOld") && !data.has("priority/gone"), "finished + unknown queue entries removed");
  console.log("ผ่านทุกข้อ (ชุดที่ 6: Groq + คิวแปลด่วน + แปลหัวข้อก่อน)");
})().catch(e => { console.error("ไม่ผ่าน:", e.stack || e.message); process.exit(1); });
