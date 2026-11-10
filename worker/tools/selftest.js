const { allItems } = require("./test-data");
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
const rss = items => `<rss><channel>${items.map(i => `<item><title>${i.t} - ${i.s}</title><link>https://news.google.com/a/${encodeURIComponent(i.t)}</link><pubDate>${i.d}</pubDate><source url="https://www.yna.co.kr">${i.s}</source></item>`).join("")}</channel></rss>`;
let feeds = {
  gn_war: rss([{ t: "북한, 동해상으로 탄도미사일 발사", s: "연합뉴스", d: d(1) }]),
  gn_disease: rss([{ t: "질병관리청, 독감 유행주의보 발령", s: "YTN", d: d(2) }]),
  gn_thai: rss([{ t: "태국 여행 인기 여행지 순위", s: "MBC", d: d(3) }])
};
let geminiMode = "ok", geminiCalls = 0, modelsTried = [], batchSizes = [];
function geminiReply(input) {
  return input.map(x => x.headline.includes("탄도") ? { i: x.i, relevant: true, categories: ["war"], level: "critical", title: { th: "เกาหลีเหนือยิงขีปนาวุธ", en: "NK missile" }, summary: { th: "สรุปขีปนาวุธ", en: "s" }, body: { th: ["ย่อหน้า"], en: ["p"] } }
    : x.headline.includes("독감") ? { i: x.i, relevant: true, categories: ["disease"], level: "high", title: { th: "ประกาศเตือนไข้หวัดใหญ่ระบาด", en: "Flu advisory" }, summary: { th: "สรุปไข้หวัด", en: "s" }, body: { th: ["ย่อหน้า"], en: ["p"] } }
    : x.headline.includes("우크라이나") ? { i: x.i, relevant: true, categories: ["war"], level: "normal", title: { th: "ข่าวชุด", en: "b" }, summary: { th: "ส", en: "s" }, body_th: ["บ"] }
    : { i: x.i, relevant: false, categories: [], level: "normal", title: { th: "", en: "" }, summary: {}, body: {} });
}
const fetchImpl = async (url, opt) => {
  if (url.startsWith("https://generativelanguage")) {
    const model = decodeURIComponent(url.split("/models/")[1].split(":")[0]); modelsTried.push(model); geminiCalls++;
    if (geminiMode === "quota") return { ok: false, status: 429, json: async () => ({ error: { message: "Resource exhausted" } }) };
    if (geminiMode === "busy") return { ok: false, status: 503, json: async () => ({ error: { message: "This model is currently experiencing high demand." } }) };
    if (geminiMode === "busyFirst" && model === "gemini-flash-lite-latest") return { ok: false, status: 503, json: async () => ({ error: { message: "high demand" } }) };
    if (geminiMode === "fallback" && model === "gemini-flash-lite-latest") return { ok: false, status: 404, json: async () => ({ error: { message: "model not found" } }) };
    const body = JSON.parse(opt.body); assert.ok(opt.headers["x-goog-api-key"]);
    const input = JSON.parse(body.contents[0].parts[0].text);
    batchSizes.push(input.length);
    if (body.systemInstruction.parts[0].text.startsWith("Translate Korean news headlines")) // โหมดแปลหัวข้อ
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ items: input.map(x => ({ i: x.i, th: "หัวข้อ " + x.headline, en: "Title " + x.i })) }) }] } }] }) };
    if (geminiMode === "batchBad" && input.some(x => x.headline.includes("BAD"))) return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: "sorry" }] } }] }) };
    return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(geminiReply(input)) }] } }] }) };
  }
  const f = FEEDS.find(x => x.url === url);
  return { ok: true, text: async () => (f && feeds[f.id]) || "<rss><channel></channel></rss>" };
};
const log = { log() {}, warn() {} };

(async () => {
  const db = fakeDb(), msg = fakeMessaging();
  await db.doc("subscribers/a").set({ token: "tokA", subscriptionVersion: 2, enabled: true, level: "critical", cats: ["korwar"], testRequested: true });
  await db.doc("subscribers/b").set({ token: "tokB", subscriptionVersion: 2, enabled: true, level: "high", cats: ["disease", "korwar"], testRequested: false });
  await db.doc("subscribers/c").set({ token: "dead", subscriptionVersion: 2, enabled: true, level: "high", cats: ["disease"], testRequested: false });
  await db.doc("subscribers/d").set({ token: "tokD", subscriptionVersion: 2, enabled: false, level: "high", cats: ["korwar"], testRequested: false });
  const base = { db, messaging: msg, appUrl: "https://kw.web.app", geminiKey: "k", fetchImpl, log, waitMs: 0 };

  // รอบ 1: แปลได้ ส่งแจ้งเตือนตามหมวดและระดับ
  let s = await runOnce({ ...base, now });
  let feed = allItems(db.data);
  assert.strictEqual(s.added, 3); assert.strictEqual(s.translated, 2); assert.strictEqual(s.dropped, 1);
  assert.strictEqual(feed.length, 2, "irrelevant Thai travel item dropped");
  assert.ok(feed.every(i => i.translated && i.title.th && !i.snippetKo && i.body.th.length));
  const warMsg = msg.sent.find(m => m.data.id === feed.find(i => i.level === "critical").id);
  assert.deepStrictEqual(warMsg.tokens.sort(), ["tokA", "tokB"], "critical war → A (critical/war) + B (high/war), not disabled D");
  assert.ok(warMsg.webpush.fcmOptions.link.startsWith("https://kw.web.app/?id="));
  const fluMsg = msg.sent.find(m => m.data.id === feed.find(i => i.level === "high").id);
  assert.deepStrictEqual(fluMsg.tokens.sort(),["dead","tokB"],"important disease news goes to high subscribers in that topic, never urgent-only A");
  assert.ok(!db.data.has("subscribers/c"), "a confirmed expired token is removed after its selected topic is sent");
  assert.ok(msg.sent.some(m => m.data.level === "test" && m.tokens.includes("tokA")), "test push sent");
  assert.strictEqual(db.data.get("subscribers/a").testRequested, false, "test flag reset");

  // รอบ 2: ข่าวเดิม ไม่แปลซ้ำ ไม่แจ้งซ้ำ
  const calls = geminiCalls, sentN = msg.sent.length;
  s = await runOnce({ ...base, now: now + 300e3 });
  assert.strictEqual(s.added, 0); assert.strictEqual(geminiCalls, calls, "no extra AI call"); assert.strictEqual(msg.sent.length, sentN, "no duplicate push");

  // รอบ 3: ติดโควตา ข่าวยังขึ้น (ยังไม่แปล) แล้วแปลได้ในรอบถัดไป
  feeds.gn_tech = rss([{ t: "인공지능 반도체 신기술 발표", s: "KBS", d: d(0.5) }]);
  geminiMode = "quota";
  s = await runOnce({ ...base, now: now + 600e3 });
  feed = allItems(db.data);
  const ramen = feed.find(i => i.titleKo.includes("인공지능"));
  assert.ok(ramen && ramen.translated === false && ramen.title.ko, "shown untranslated");
  assert.strictEqual(ramen.attempts, 0, "quota does not count as a failed attempt");
  assert.match(db.data.get("meta/status").lastError, /quota/);
  assert.strictEqual(modelsTried.length >= 4, true, "quota on one model → tries the others first");

  // ระบบยุ่ง (503) ทุกรุ่น: ไม่นับเป็นความล้มเหลว
  geminiMode = "busy";
  for (let k = 0; k < 5; k++) await runOnce({ ...base, now: now + 620e3 + k });
  const ramenBusy = allItems(db.data).find(i => i.id === ramen.id);
  assert.strictEqual(ramenBusy.attempts, 0, "503 five times still not counted");
  assert.match(db.data.get("meta/status").lastError, /busy/);

  // รุ่นแรกยุ่ง รุ่นถัดไปแปลได้
  geminiMode = "busyFirst"; modelsTried = [];
  feeds.gn_thai = rss([{ t: "태국인 노동자 화재로 부상", s: "MBC", d: d(0.2) }]);
  await runOnce({ ...base, now: now + 700e3 });
  assert.deepStrictEqual(modelsTried.slice(0, 2), ["gemini-flash-lite-latest", "gemini-2.5-flash-lite"], "503 → next model");
  assert.strictEqual(db.data.get("meta/status").lastError, null, "translated with second model");
  assert.ok(!allItems(db.data).some(i => i.id === ramen.id), "ramen handled by fallback model");

  feeds.gn_war = rss([{ t: "북한, 순항미사일 추가 발사", s: "KBS", d: d(0.1) }]);
  geminiMode = "fallback"; modelsTried = [];
  s = await runOnce({ ...base, now: now + 900e3 });
  assert.deepStrictEqual(modelsTried.slice(0, 2), ["gemini-flash-lite-latest", "gemini-2.5-flash-lite"], "falls back to next model");

  assert.strictEqual(db.data.get("meta/status").lastError, null);

  // ล้างตัวนับเก่าครั้งเดียว (feed เวอร์ชันก่อน)
  const f = db.data.get("meta/feed"); f.items.push({ ...f.items[0], id: "old1", translated: false, attempts: 3 }); delete f.v;
  geminiMode = "busy"; await runOnce({ ...base, now: now + 950e3 });
  assert.strictEqual(allItems(db.data).find(i => i.id === "old1").attempts, 0, "old counters reset once");
  assert.strictEqual(db.data.get("meta/feed").v, 10);
  geminiMode = "ok";

  // แปลเป็นชุดละ 5: 12 ข่าว = 3 ชุด ชุดที่เสีย 1 ชุดไม่ทำให้ชุดอื่นเสีย
  const distinct = ["키이우 정전 협상 재개", "가자지구 구호품 반입 확대", "이란 핵시설 사찰 논의", "대만해협 해상 순찰 강화", "흑해 곡물 수송로 위협", "시리아 국경 난민 증가", "홍해 상선 우회 항로", "레바논 남부 주민 대피", "나토 정상회의 공동성명", "러시아 국경 병력 이동", "예멘 항구 봉쇄 장기화", "수단 내전 사상자 집계"];
  feeds = { gn_war: rss(distinct.map((t, k) => ({ t: (k === 6 ? "BAD " : "") + t + " 우크라이나 전쟁", s: "KBS", d: d(0.01 * (k + 1)) }))) };
  { const f2 = db.data.get("meta/feed"); f2.items = f2.items.filter(i => i.translated); db.data.set("meta/pending", {items:[]}); }
  geminiMode = "batchBad"; batchSizes = [];
  s = await runOnce({ ...base, now: now + 960e3 });
  assert.deepStrictEqual(batchSizes, [2, 2, 2, 2, 2, 2, 2, 2], "batches of 2; malformed JSON retries two alternate models");
  assert.strictEqual(s.titled, 0, "titles-first is only for stories shown before translation (Korean war)");
  assert.strictEqual(s.translated, 10, "five good batches translated, the bad batch of 2 skipped");
  assert.strictEqual(s.batches, "5/6");
  const bad = allItems(db.data).filter(i => i.titleKo.includes("우크라이나") && !i.translated);
  assert.strictEqual(bad.length, 2); assert.ok(bad.every(i => i.attempts === 1), "only the bad batch counted");
  geminiMode = "ok";

  // รอบ 4: 31 วันต่อมา ข่าวเก่าถูกลบ
  feeds = {};
  s = await runOnce({ ...base, now: now + 31 * 864e5 });
  assert.strictEqual(allItems(db.data).length, 0, "old news pruned");
  assert.strictEqual(Object.keys(db.data.get("meta/seen").ids).length, 0, "seen list pruned");

  console.log("ผ่านทุกข้อ");
})().catch(e => { console.error("ไม่ผ่าน:", e.message); process.exit(1); });
