// ทดสอบทั้งระบบโดยไม่ต่ออินเทอร์เน็ตและไม่ใช้ฐานข้อมูลจริง: npm test
const assert = require("assert");
const { runOnce } = require("../run");
const { FEEDS } = require("../feeds");

// ── ฐานข้อมูลจำลอง ──
function fakeDb() {
  const data = new Map();
  const ref = path => ({
    path,
    async get() { const d = data.get(path); return { exists: !!d, data: () => JSON.parse(JSON.stringify(d)) } },
    async set(v) { data.set(path, JSON.parse(JSON.stringify(v))) },
    async update(p) { data.set(path, { ...data.get(path), ...p }) },
    async delete() { data.delete(path) }
  });
  const query = (col, filters = []) => ({
    where(f, op, v) { return query(col, [...filters, [f, v]]) },
    limit() { return this },
    async get() {
      const docs = [...data.entries()].filter(([p, d]) => p.startsWith(col + "/") && filters.every(([f, v]) => d[f] === v))
        .map(([p, d]) => ({ ref: ref(p), data: () => JSON.parse(JSON.stringify(d)) }));
      return { empty: !docs.length, docs };
    }
  });
  return { data, doc: ref, collection: c => query(c) };
}
function fakeMessaging() {
  const sent = [];
  return { sent, async sendEachForMulticast(m) { sent.push(m); return { successCount: m.tokens.filter(t => t !== "dead").length, responses: m.tokens.map(t => t === "dead" ? { success: false, error: { code: "messaging/registration-token-not-registered" } } : { success: true }) } } };
}

const now = Date.parse("2026-10-31T09:00:00Z");
const d = h => new Date(now - h * 3600e3).toUTCString();
const rss = items => `<rss><channel>${items.map(i => `<item><title>${i.t} - ${i.s}</title><link>https://news.google.com/a/${encodeURIComponent(i.t)}</link><pubDate>${i.d}</pubDate><source url="x">${i.s}</source></item>`).join("")}</channel></rss>`;
let feeds = {
  gn_war: rss([{ t: "북한, 동해상으로 탄도미사일 발사", s: "연합뉴스", d: d(1) }]),
  gn_disease: rss([{ t: "질병관리청, 독감 유행주의보 발령", s: "YTN", d: d(2) }]),
  gn_thai: rss([{ t: "태국 여행 인기 여행지 순위", s: "MBC", d: d(3) }])
};
let geminiMode = "ok", geminiCalls = 0, modelsTried = [];
function geminiReply(input) {
  return input.map(x => x.headline.includes("탄도") ? { i: x.i, relevant: true, categories: ["war"], level: "critical", title: { th: "เกาหลีเหนือยิงขีปนาวุธ", en: "NK missile" }, summary: { th: "สรุปขีปนาวุธ", en: "s" }, body: { th: ["ย่อหน้า"], en: ["p"] } }
    : x.headline.includes("독감") ? { i: x.i, relevant: true, categories: ["disease"], level: "high", title: { th: "ประกาศเตือนไข้หวัดใหญ่ระบาด", en: "Flu advisory" }, summary: { th: "สรุปไข้หวัด", en: "s" }, body: { th: ["ย่อหน้า"], en: ["p"] } }
    : { i: x.i, relevant: false, categories: [], level: "normal", title: { th: "", en: "" }, summary: {}, body: {} });
}
const fetchImpl = async (url, opt) => {
  if (url.startsWith("https://generativelanguage")) {
    const model = decodeURIComponent(url.split("/models/")[1].split(":")[0]); modelsTried.push(model); geminiCalls++;
    if (geminiMode === "quota") return { ok: false, status: 429, json: async () => ({ error: { message: "Resource exhausted" } }) };
    if (geminiMode === "fallback" && model === "gemini-flash-latest") return { ok: false, status: 404, json: async () => ({ error: { message: "model not found" } }) };
    const body = JSON.parse(opt.body); assert.ok(opt.headers["x-goog-api-key"]);
    const input = JSON.parse(body.contents[0].parts[0].text);
    return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(geminiReply(input)) }] } }] }) };
  }
  const f = FEEDS.find(x => x.url === url);
  return { ok: true, text: async () => (f && feeds[f.id]) || "<rss><channel></channel></rss>" };
};
const log = { log() {}, warn() {} };

(async () => {
  const db = fakeDb(), msg = fakeMessaging();
  await db.doc("subscribers/a").set({ token: "tokA", enabled: true, level: "critical", cats: ["war"], testRequested: true });
  await db.doc("subscribers/b").set({ token: "tokB", enabled: true, level: "high", cats: ["disease", "war"], testRequested: false });
  await db.doc("subscribers/c").set({ token: "dead", enabled: true, level: "high", cats: ["disease"], testRequested: false });
  await db.doc("subscribers/d").set({ token: "tokD", enabled: false, level: "high", cats: ["war"], testRequested: false });
  const base = { db, messaging: msg, appUrl: "https://kw.web.app", geminiKey: "k", fetchImpl, log };

  // รอบ 1: แปลได้ ส่งแจ้งเตือนตามหมวดและระดับ
  let s = await runOnce({ ...base, now });
  let feed = db.data.get("meta/feed").items;
  assert.strictEqual(s.added, 3); assert.strictEqual(s.translated, 2); assert.strictEqual(s.dropped, 1);
  assert.strictEqual(feed.length, 2, "irrelevant Thai travel item dropped");
  assert.ok(feed.every(i => i.translated && i.title.th && !i.snippetKo));
  const warMsg = msg.sent.find(m => m.data.id === feed.find(i => i.level === "critical").id);
  assert.deepStrictEqual(warMsg.tokens.sort(), ["tokA", "tokB"], "critical war → A (critical/war) + B (high/war), not disabled D");
  assert.ok(warMsg.webpush.fcmOptions.link.startsWith("https://kw.web.app/?id="));
  const fluMsg = msg.sent.find(m => m.data.id === feed.find(i => i.level === "high").id);
  assert.deepStrictEqual(fluMsg.tokens.sort(), ["dead", "tokB"], "high flu → only subscribers who chose 'high'");
  assert.ok(!db.data.has("subscribers/c"), "dead token removed");
  assert.ok(msg.sent.some(m => m.data.level === "test" && m.tokens.includes("tokA")), "test push sent");
  assert.strictEqual(db.data.get("subscribers/a").testRequested, false, "test flag reset");

  // รอบ 2: ข่าวเดิม ไม่แปลซ้ำ ไม่แจ้งซ้ำ
  const calls = geminiCalls, sentN = msg.sent.length;
  s = await runOnce({ ...base, now: now + 300e3 });
  assert.strictEqual(s.added, 0); assert.strictEqual(geminiCalls, calls, "no extra AI call"); assert.strictEqual(msg.sent.length, sentN, "no duplicate push");

  // รอบ 3: ติดโควตา ข่าวยังขึ้น (ยังไม่แปล) แล้วแปลได้ในรอบถัดไป
  feeds.gn_food = rss([{ t: "라면 사재기 확산, 마트 품절", s: "KBS", d: d(0.5) }]);
  geminiMode = "quota";
  s = await runOnce({ ...base, now: now + 600e3 });
  feed = db.data.get("meta/feed").items;
  const ramen = feed.find(i => i.titleKo.includes("라면"));
  assert.ok(ramen && ramen.translated === false && ramen.title.ko, "shown untranslated");
  assert.strictEqual(ramen.attempts, 0, "quota does not count as a failed attempt");
  assert.match(db.data.get("meta/status").lastError, /quota/);
  geminiMode = "fallback"; modelsTried = [];
  s = await runOnce({ ...base, now: now + 900e3 });
  assert.deepStrictEqual(modelsTried.slice(0, 2), ["gemini-flash-latest", "gemini-flash-lite-latest"], "falls back to next model");
  assert.strictEqual(db.data.get("meta/feed").items.find(i => i.id === ramen.id), undefined, "ramen judged irrelevant by fake AI and removed");
  assert.strictEqual(db.data.get("meta/status").lastError, null);

  // รอบ 4: 31 วันต่อมา ข่าวเก่าถูกลบ
  feeds = {};
  s = await runOnce({ ...base, now: now + 31 * 864e5 });
  assert.strictEqual(db.data.get("meta/feed").items.length, 0, "old news pruned");
  assert.strictEqual(Object.keys(db.data.get("meta/seen").ids).length, 0, "seen list pruned");

  console.log("ผ่านทุกข้อ");
})().catch(e => { console.error("ไม่ผ่าน:", e.message); process.exit(1); });
