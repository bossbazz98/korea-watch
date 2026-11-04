const { allItems } = require("./test-data");
// ทดสอบสถานการณ์จริงจากภาพหน้าจอ: ข่าวสงครามเกาหลีค้างหลายข่าว ข่าวเก่าไม่เคยได้คิว GitHub Models 403 Groq 429
// node tools/selftest12.js
const assert = require("assert");
const { runOnce } = require("../run");
const log = { log() {}, warn() {} };
const now = Date.now();
function fakeDb() {
  const data = new Map();
  const ref = p => ({ path: p, id: p.split("/").pop(), async get() { const d = data.get(p); return { exists: !!d, data: () => JSON.parse(JSON.stringify(d)) } }, async set(v) { data.set(p, JSON.parse(JSON.stringify(v))) }, async update(v) { data.set(p, { ...data.get(p), ...v }) }, async delete() { data.delete(p) } });
  return { data, doc: ref, collection: () => ({ where() { return this }, limit() { return this }, async get() { return { empty: true, docs: [] } } }) };
}
const KO = ["김여정, 바이낸스 사태에 미국의 상투적 도발", "합참 북한 서해 포병 사격 포착", "북한 순항미사일 서해상 발사", "남북 군사회담 제안 거부", "북한군 군사분계선 침범 경고사격", "통일부 대북 전단 살포 자제 요청", "북한 정찰위성 발사 준비 동향", "연평도 주민 대피 훈련 실시"];
const kw = (k, x = {}) => ({ id: "kw" + k, titleKo: KO[k], title: { ko: KO[k] }, summary: { ko: "x" }, body: {}, categories: ["korwar"], level: "normal", translated: false, attempts: 0, publishedAt: new Date(now - (k === 0 ? 7 : 1) * 3600e3 - k * 60e3).toISOString(), addedAt: new Date(now - 7 * 3600e3).toISOString(), source: "한겨레", sourceUrl: "https://hani/" + k, links: [], ...x });

(async () => {
  const db = fakeDb();
  // ข่าว 06:34 (kw0) ไม่เคยได้คิว / ข่าวใหม่กว่า 7 ข่าวลองแล้วพลาดเมื่อ 11 นาทีก่อน
  db.data.set("meta/feed", { v: 8, items: [kw(0), ...[1, 2, 3, 4, 5, 6, 7].map(k => kw(k, { lastTry: now - 11 * 60e3, attempts: 1 }))] });
  const calls = [];
  const hdr = o => ({ get: k => (o[k.toLowerCase()] ?? null) });
  let groq20bHits = 0;
  const fetchImpl = async (url, opt) => {
    if (!/groq|github|generativelanguage/.test(url)) {
      if (url.startsWith("https://hani/")) return { ok: true, status: 200, headers: hdr({ "content-type": "text/html" }), arrayBuffer: async () => Buffer.from("<article><p>" + "북한 김여정 부부장은 미국의 주장을 도발이라고 비난했다. ".repeat(60) + "</p></article>") };
      return { ok: true, text: async () => "<rss><channel></channel></rss>", arrayBuffer: async () => Buffer.from("") };
    }
    const b = JSON.parse(opt.body);
    const tag = url.includes("generativelanguage") ? "gemini:" + decodeURIComponent(url.split("/models/")[1].split(":")[0]) : (url.includes("groq") ? "groq:" : "github:") + b.model;
    const sys = url.includes("generativelanguage") ? b.systemInstruction.parts[0].text : b.messages[0].content;
    const input = JSON.parse(url.includes("generativelanguage") ? b.contents[0].parts[0].text : b.messages[1].content);
    calls.push({ tag, titles: sys.startsWith("Translate Korean"), n: input.length, art: input.map(x => (x.article || "").length) });
    if (tag.startsWith("github")) return { ok: false, status: 403, headers: hdr({}), json: async () => ({ error: { message: "The 'models' permission is required" } }) };
    if (tag === "groq:openai/gpt-oss-20b" && groq20bHits++ === 0) return { ok: false, status: 429, headers: hdr({ "retry-after": "2" }), json: async () => ({ error: { message: "Rate limit reached for model openai/gpt-oss-20b: tokens per minute" } }) };
    const items = input.map(x => sys.startsWith("Translate Korean") ? { i: x.i, th: "หัวข้อไทย " + x.headline.slice(0, 6), en: "T" } :
      { i: x.i, relevant: true, categories: ["korwar"], level: "high", title: { th: "ข่าวไทย " + x.headline.slice(0, 6), en: "t" }, summary: { th: "สรุป", en: "s" }, body_th: ["ก", "ข"] });
    const content = JSON.stringify({ items });
    await new Promise(r => setTimeout(r, 600));
    return { ok: true, status: 200, headers: hdr({ "x-ratelimit-remaining-tokens": "50000", "x-ratelimit-reset-tokens": "5s" }), json: async () => url.includes("generativelanguage") ? { candidates: [{ content: { parts: [{ text: content }] } }] } : { usage: { total_tokens: 800 }, choices: [{ message: { content } }] } };
  };
  const base = { db, messaging: { async sendEachForMulticast(m) { return { successCount: 0, responses: [] } } }, appUrl: "https://x", groqKey: "g", githubToken: "t", geminiKey: "k", fetchImpl, now, log, waitMs: 0, imgBudgetMs: 2000, watchEveryMs: 600000 };
  const t0 = Date.now();
  const st = await runOnce({ ...base, budgetMs: 200000 });
  const took = Date.now() - t0;
  const feed = allItems(db.data), by = id => feed.find(i => i.id === id);

  // (1) หัวข้อของทุกข่าวที่ค้าง แปลในคำขอเดียวตั้งแต่ต้นรอบ
  const firstTitles = calls.find(c => c.titles);
  assert.ok(firstTitles && firstTitles.n === 8, "all 8 stuck titles translated in ONE request");
  assert.ok(feed.every(i => /[\u0E00-\u0E7F]/.test(i.title.th)), "every Korean-war card now has a Thai title");
  // (2) ข่าว 06:34 ที่ไม่เคยได้คิว ได้แปลเป็นข่าวแรก
  assert.ok(by("kw0").translated, "the 7-hour-old story (never queued) is translated");
  const firstFull = calls.find(c => !c.titles && c.art.some(n => n > 0));
  assert.ok(firstFull && firstFull.art[0] <= 1500, "fast lane sends a shorter article (≤1500 chars)");
  assert.strictEqual(st.korwar, 6, "6 Korean-war stories per round");
  assert.ok(by("kw0").needsEnrich, "fast summary marked to be rewritten in full later");
  // (3) GitHub Models 403 → พัก 6 ชั่วโมง ไม่ลองซ้ำ และรายงานสาเหตุ
  const ghCalls = calls.filter(c => c.tag.startsWith("github")).length;
  assert.ok(ghCalls <= 2, `GitHub Models tried at most once or twice after 403 (got ${ghCalls})`);
  const q = db.data.get("meta/quota");
  assert.ok(q.disabled && q.disabled.github && /models: read/.test(q.disabled.github.reason), "403 remembered with a fix hint");
  assert.ok(/disabled github/.test(JSON.stringify(st.disabled)) || st.disabled.github, "status shows the disabled provider");
  // (4) Groq 429 พักตามเวลาที่บอก (2 วินาที) ไม่ใช่ 60 วินาที → กลับมาใช้ได้ในรอบเดียวกัน
  assert.ok(calls.filter(c => c.tag === "groq:openai/gpt-oss-20b").length >= 2, "20b used again after its short (2s) cooldown");
  assert.ok(took < 60000, `fast (${took} ms)`);

  // รอบถัดไป: ไม่เรียก GitHub Models อีกเลย และข่าวที่เหลือแปลต่อ
  calls.length = 0;
  const st2 = await runOnce({ ...base, now: now + 6 * 60e3, budgetMs: 200000 });
  assert.strictEqual(calls.filter(c => c.tag.startsWith("github")).length, 0, "disabled provider skipped in the next round");
  const feed2 = allItems(db.data);
  assert.ok(feed2.filter(i => i.translated).length === 8, "remaining stories translated in the next round");
  console.log(`ผ่านทุกข้อ (ชุดที่ 12: สถานการณ์ข่าวสงครามเกาหลีค้าง) รอบแรกใช้ ${(took / 1000).toFixed(1)} วินาที`);
})().catch(e => { console.error("ไม่ผ่าน:", e.stack || e.message); process.exit(1); });
