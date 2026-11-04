const { allItems } = require("./test-data");
// ทดสอบการแก้รอบนี้: แข่งแปลประหยัดโควตา, นับโควตาตัวที่ถูกยกเลิก, ทางด่วนลองใหม่ทุก 10 นาที + สำรองด้วยวิธีปกติ,
// คำค้นสงครามเกาหลีแคบลง, ช่วงงดแจ้งเตือน, Agent เตือนข่าวสงครามเกาหลีค้าง: node tools/selftest10.js
const assert = require("assert");
const { raceLanes, raceTranslate } = require("../lib/translate");
const { Quota } = require("../lib/quota");
const { matchCats } = require("../lib/collect");
const { runOnce, inQuiet } = require("../run");
const { auditData } = require("../agent");
const log = { log() {}, warn() {} };
const now = Date.now();

(async () => {
  // 1) เลือกช่องทางแข่ง: ผู้ให้บริการละ 1 ตัวที่เร็วที่สุด / ข้ามตัวที่พักอยู่หรือโควตาหมด
  const keys = { groqKey: "g", githubToken: "t", apiKey: "k" };
  assert.deepStrictEqual(raceLanes(keys, 3), ["groq:openai/gpt-oss-20b", "github:openai/gpt-4o-mini", "gemini:gemini-flash-lite-latest"]);
  assert.deepStrictEqual(raceLanes(keys, 2), ["groq:openai/gpt-oss-20b", "github:openai/gpt-4o-mini"], "titles race uses 2 lanes");
  const cool = new Map([["groq:openai/gpt-oss-20b", Date.now() + 60000]]);
  const lc = raceLanes({ ...keys, cool }, 3); assert.ok(lc.includes("groq:openai/gpt-oss-120b") && !lc.includes("groq:openai/gpt-oss-20b") && lc.length === 3, "cooled lane replaced by another model of the same provider");
  const q = new Quota({}, now); q.exhaust("github:openai/gpt-4o-mini");
  assert.ok(raceLanes({ ...keys, quota: q }, 3).includes("github:openai/gpt-4.1-mini"), "exhausted lane replaced");

  // 2) ตัวที่แพ้และถูกยกเลิก ถูกนับโควตา (ประมาณจากขนาดคำขอ)
  const q2 = new Quota({}, now);
  const f = async (url, opt) => {
    const b = JSON.parse(opt.body), fast = url.includes("github");
    await new Promise((res, rej) => { const t = setTimeout(res, fast ? 10 : 300); opt.signal.addEventListener("abort", () => { clearTimeout(t); const e = new Error("a"); e.name = "AbortError"; rej(e) }) });
    const input = JSON.parse(url.includes("generativelanguage") ? b.contents[0].parts[0].text : b.messages[1].content);
    const content = JSON.stringify({ items: input.map(x => ({ i: x.i, relevant: true, categories: ["korwar"], level: "high", title: { th: "ข่าว", en: "n" }, summary: { th: "สรุป", en: "s" }, body_th: ["ก"] })) });
    return { ok: true, status: 200, json: async () => url.includes("generativelanguage") ? { candidates: [{ content: { parts: [{ text: content }] } }] } : { usage: { total_tokens: 900 }, choices: [{ message: { content } }] } };
  };
  await raceTranslate([{ titleKo: "북한 미사일", snippet: "", article: "북한이 미사일을 발사했다. ".repeat(80), source: "", cats: ["korwar"] }], { ...keys, fetchImpl: f, log, quota: q2 });
  await new Promise(r => setTimeout(r, 30));
  assert.strictEqual(q2.used["github:openai/gpt-4o-mini"].tokens, 900, "winner counted with real usage");
  assert.ok(q2.used["groq:openai/gpt-oss-20b"].tokens > 500, "cancelled loser still counted (estimate)");

  // 3) คำค้นสงครามเกาหลีแคบลง
  assert.deepStrictEqual(matchCats("北京 올림픽 개막식"), [], "北京 (Beijing) is not North Korea");
  assert.deepStrictEqual(matchCats("여야, 예산안 놓고 도발 공방"), [], "political 'provocation' is not war");
  assert.ok(matchCats("北, 동해상 탄도미사일 발사").includes("korwar"));
  assert.ok(matchCats("김여정 \"미국 해킹 주장은 정치적 도발\"").includes("korwar"));

  // 4) ทางด่วน: ข่าวที่พลาดครบ 4 ครั้งเมื่อ 15 นาทีก่อน ได้ลองใหม่ / แข่งแปลพลาดทุกช่องทาง → ใช้วิธีปกติในรอบเดียวกัน
  const data = new Map();
  const ref = p => ({ async get() { const d = data.get(p); return { exists: !!d, data: () => JSON.parse(JSON.stringify(d)) } }, async set(v) { data.set(p, JSON.parse(JSON.stringify(v))) }, async update() { }, async delete() { data.delete(p) } });
  const db = { doc: ref, collection: () => ({ where() { return this }, limit() { return this }, async get() { return { empty: true, docs: [] } } }) };
  data.set("meta/feed", { v: 8, items: [{ id: "kw1", titleKo: "김여정 \"美, 해킹을 우리 소행으로 오도\"", title: { ko: "김여정" }, summary: { ko: "x" }, body: {}, categories: ["korwar"], level: "normal", translated: false, attempts: 4, lastTry: now - 15 * 60e3, publishedAt: new Date(now - 3 * 3600e3).toISOString(), addedAt: new Date(now - 3 * 3600e3).toISOString(), source: "동아일보", sourceUrl: "https://donga/1", links: [] }] });
  const seen = [];
  const f4 = async (url, opt) => {
    if (!/groq|github|generativelanguage/.test(url)) return { ok: true, text: async () => "<rss><channel></channel></rss>", arrayBuffer: async () => Buffer.from("") };
    const b = JSON.parse(opt.body), m = url.includes("generativelanguage") ? "gemini:" + url.split("/models/")[1].split(":")[0] : (url.includes("groq") ? "groq:" : "github:") + b.model;
    seen.push(m);
    const titles = (url.includes("generativelanguage") ? b.systemInstruction.parts[0].text : b.messages[0].content).startsWith("Translate Korean");
    const input = JSON.parse(url.includes("generativelanguage") ? b.contents[0].parts[0].text : b.messages[1].content);
    // ตัวที่ถูกเลือกแข่ง (เร็ว) ตอบเป็นภาษาอังกฤษ → ใช้ไม่ได้; รุ่น 120b ตอบภาษาไทยถูกต้อง
    const good = m === "groq:openai/gpt-oss-120b";
    const content = JSON.stringify({ items: input.map(x => titles ? { i: x.i, th: good ? "คิมโยจองโต้สหรัฐฯ" : "Kim Yo Jong", en: "K" } : { i: x.i, relevant: true, categories: ["korwar"], level: "high", title: { th: good ? "คิมโยจองตอบโต้สหรัฐฯ เรื่องแฮก" : "Kim Yo Jong hits back", en: "K" }, summary: { th: good ? "สรุปไทย" : "English", en: "s" }, body_th: ["ก"] }) });
    return { ok: true, status: 200, json: async () => url.includes("generativelanguage") ? { candidates: [{ content: { parts: [{ text: content }] } }] } : { usage: { total_tokens: 400 }, choices: [{ message: { content } }] } };
  };
  const st = await runOnce({ db, messaging: { async sendEachForMulticast(m) { return { successCount: 0, responses: [] } } }, appUrl: "https://x", ...keys, groqKey: "g", fetchImpl: f4, now, log, waitMs: 0, budgetMs: 31000, imgBudgetMs: 2000, watchEveryMs: 60000 });
  const it = allItems(data).find(i => i.id === "kw1");
  assert.ok(it.translated && it.title.th.includes("คิมโยจอง"), "paused Korean-war story retried after 10 min and translated via the normal chain");
  assert.ok(seen.includes("groq:openai/gpt-oss-120b"), "fallback used the normal chain");
  assert.ok(/korwar \d+%|quota /.test(JSON.stringify(st.quotaUsed)) || Object.keys(st.quotaUsed).length > 0, "quota usage reported");

  // 5) ช่วงงดแจ้งเตือน (เวลาเกาหลี)
  const at = h => Date.parse("2026-11-03T00:00:00Z") + (h - 9) * 3600e3;
  const s = { quietOn: true, quietFrom: 22, quietTo: 7 };
  assert.ok(inQuiet(s, at(23)) && inQuiet(s, at(27)) && !inQuiet(s, at(12)), "22:00–07:00 crosses midnight");
  assert.ok(!inQuiet({ quietOn: false, quietFrom: 22, quietTo: 7 }, at(23)), "off = never quiet");

  // 6) Agent เตือนข่าวสงครามเกาหลีค้างแปลเกิน 30 นาที และโควตาใกล้หมด
  const d = await auditData({ items: [{ id: "k", titleKo: "북한 미사일", title: { ko: "x" }, categories: ["korwar"], translated: false, publishedAt: new Date(now - 3600e3).toISOString(), addedAt: new Date(now - 3600e3).toISOString() }], status: { lastRun: new Date(now).toISOString(), quotaUsed: { "groq:openai/gpt-oss-120b": 95 } }, now, fetchImpl: async () => ({ ok: true }) });
  assert.ok(d.issues.some(i => i.key === "korwar-stuck" && i.severity === "high"));
  assert.ok(d.issues.some(i => i.key === "quota-high"));
  console.log("ผ่านทุกข้อ (ชุดที่ 10: แก้ทางด่วน + โควตา + งดแจ้งเตือน)");
})().catch(e => { console.error("ไม่ผ่าน:", e.stack || e.message); process.exit(1); });
