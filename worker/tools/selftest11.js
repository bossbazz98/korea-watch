// ทดสอบระบบส่งแจ้งเตือน: ไม่ลบเครื่องผิดๆ, ระดับ "ทุกข่าว", จำกัด 4 ต่อเครื่องต่อรอบ, บันทึกผลต่อเครื่อง, ช่วงงดแจ้งเตือน: node tools/selftest11.js
const assert = require("assert");
const { runOnce } = require("../run");
const log = { log() {}, warn() {} };
const now = Date.now();
function fakeDb() {
  const data = new Map();
  const ref = p => ({ path: p, id: p.split("/").pop(), async get() { const d = data.get(p); return { exists: !!d, data: () => JSON.parse(JSON.stringify(d)) } }, async set(v) { data.set(p, JSON.parse(JSON.stringify(v))) }, async update(v) { data.set(p, { ...data.get(p), ...v }) }, async delete() { data.delete(p) } });
  const q = (col, fl = []) => ({ where(f, o, v) { return q(col, [...fl, [f, v]]) }, limit() { return this }, async get() { const docs = [...data.keys()].filter(k => k.startsWith(col + "/") && fl.every(([f, v]) => data.get(k)[f] === v)).map(k => ({ id: k.split("/").pop(), ref: ref(k), data: () => data.get(k) })); return { empty: !docs.length, docs } } });
  return { data, doc: ref, collection: c => q(c) };
}
const AI = async (url, opt) => {
  if (!/groq|github|generativelanguage/.test(url)) return { ok: true, text: async () => "<rss><channel></channel></rss>", arrayBuffer: async () => Buffer.from("") };
  const b = JSON.parse(opt.body), input = JSON.parse(b.messages[1].content);
  return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify({ items: input.map(x => ({ i: x.i, relevant: true, categories: x.guessedCategories, level: x.headline.includes("긴급") ? "critical" : "normal", title: { th: "ข่าว " + x.headline, en: "n" }, summary: { th: "สรุป", en: "s" }, body_th: ["ก"] })) }) } }] }) };
};
const item = (id, ko, cats) => ({ id, titleKo: ko, title: { ko }, summary: {}, body: {}, categories: cats, level: "normal", translated: false, attempts: 0, publishedAt: new Date(now - 600e3).toISOString(), addedAt: new Date(now).toISOString(), source: "KBS", sourceUrl: "https://x/" + id, links: [] });
const H = "a".repeat(64), H2 = "b".repeat(64), H3 = "c".repeat(64), H4 = "d".repeat(64);

(async () => {
  const db = fakeDb();
  const titles = ["유가 상승 지속", "환율 급등 우려", "휘발유값 최고", "원화 약세 계속", "경유 가격 인상", "주유소 대기 행렬", "긴급 유류 수급 점검"];
  db.data.set("meta/feed", { v: 8, items: titles.map((t, k) => item("o" + k, t, ["oil"])) });
  db.data.set(`subscribers/${H}`, { token: "ALL", enabled: true, level: "all", cats: ["oil"], testRequested: true });
  db.data.set(`subscribers/${H2}`, { token: "CRIT", enabled: true, level: "critical", cats: ["oil"], testRequested: false });
  db.data.set(`subscribers/${H3}`, { token: "BADMSG", enabled: true, level: "all", cats: ["oil"], testRequested: false });
  db.data.set(`subscribers/${H4}`, { token: "QUIET", enabled: true, level: "all", cats: ["oil"], testRequested: false, quietOn: true, quietFrom: 0, quietTo: 23 });
  const sent = [];
  const messaging = { async sendEachForMulticast(m) { sent.push(m); return { successCount: m.tokens.filter(t => t !== "BADMSG").length, responses: m.tokens.map(t => t === "BADMSG" ? { success: false, error: { code: "messaging/invalid-argument" } } : { success: true }) } } };
  const st = await runOnce({ db, messaging, appUrl: "https://app", groqKey: "g", fetchImpl: AI, now, log, waitMs: 0, budgetMs: 31000, imgBudgetMs: 2000, watchEveryMs: 60000 });
  const toAll = sent.filter(m => m.tokens.includes("ALL") && m.data.level !== "test");
  assert.strictEqual(toAll.filter(m => m.data.level !== "summary").length, 4, "level 'all': max 4 notifications per device per round");
  assert.ok(toAll.some(m => m.data.level === "summary" && /อีก 3 ข่าว/.test(m.notification.body)), "the rest grouped into one 'N more stories' notification");
  const toCrit = sent.filter(m => m.tokens.includes("CRIT"));
  assert.strictEqual(toCrit.length, 1, "level 'critical' only gets the urgent story"); assert.ok(toCrit[0].notification.title.startsWith("🔴"));
  assert.ok(!sent.some(m => m.tokens.includes("QUIET")), "quiet hours respected");
  assert.ok(db.data.has(`subscribers/${H3}`), "invalid-argument does NOT delete the device anymore");
  assert.ok(st.pushFailed >= 1 && st.pushErrors["messaging/invalid-argument"] >= 1, "failures counted with their error code");
  const log1 = db.data.get(`pushlog/${H}`), log3 = db.data.get(`pushlog/${H3}`);
  assert.ok(log1 && log1.ok, "per-device result saved (ok)"); assert.ok(log3 && !log3.ok && /invalid-argument/.test(log3.error), "per-device result saved (failed + reason)");
  assert.ok(sent.some(m => m.data.level === "test" && m.tokens.includes("ALL")), "test notification sent");
  assert.strictEqual(sent.find(m => m.data.level === "test").webpush.fcmOptions.link, "https://app/", "notification opens the app (https link)");
  assert.ok(Object.values(sent[0].data).every(v => typeof v === "string"), "FCM data values are strings");
  // เครื่องที่ token เลิกใช้จริง ถูกลบ
  const db2 = fakeDb();
  db2.data.set("meta/feed", { v: 8, items: [item("x1", "긴급 유류 수급 점검", ["oil"])] });
  db2.data.set(`subscribers/${H}`, { token: "GONE", enabled: true, level: "all", cats: ["oil"], testRequested: false });
  await runOnce({ db: db2, messaging: { async sendEachForMulticast(m) { return { successCount: 0, responses: m.tokens.map(() => ({ success: false, error: { code: "messaging/registration-token-not-registered" } })) } } }, appUrl: "https://app", groqKey: "g", fetchImpl: AI, now, log, waitMs: 0, budgetMs: 31000, imgBudgetMs: 2000, watchEveryMs: 60000 });
  assert.ok(!db2.data.has(`subscribers/${H}`), "really expired token removed");
  console.log("ผ่านทุกข้อ (ชุดที่ 11: ระบบส่งแจ้งเตือน)");
})().catch(e => { console.error("ไม่ผ่าน:", e.stack || e.message); process.exit(1); });
