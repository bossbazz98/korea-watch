// ทดสอบ: กรองข่าวซ้ำ, ข่าวซ่อนจนแปลเสร็จ, ทางด่วนสงครามเกาหลี (แข่งแปล + เฝ้าฟีด), โควตาฉุกเฉิน, GitHub Models: node tools/selftest9.js
const assert = require("assert");
const { runOnce, shown } = require("../run");
const { Quota, kstDay } = require("../lib/quota");
const { translate, raceTranslate } = require("../lib/translate");
const { FEEDS } = require("../feeds");
const log = { log() {}, warn() {} };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function fakeDb() {
  const data = new Map(), writes = [];
  const ref = p => ({ path: p, id: p.split("/").pop(), async get() { const d = data.get(p); return { exists: !!d, data: () => JSON.parse(JSON.stringify(d)) } }, async set(v) { writes.push({ p, t: Date.now(), v: JSON.parse(JSON.stringify(v)) }); data.set(p, JSON.parse(JSON.stringify(v))) }, async update(v) { data.set(p, { ...data.get(p), ...v }) }, async delete() { data.delete(p) } });
  return { data, writes, doc: ref, collection: col => ({ where() { return this }, limit() { return this }, async get() { const docs = [...data.keys()].filter(k => k.startsWith(col + "/")).map(k => ({ id: k.split("/").pop(), ref: ref(k), data: () => data.get(k) })); return { empty: !docs.length, docs } } }) };
}
const now = Date.now();
const rss = items => `<rss><channel>${items.map(i => `<item><title>${i.t}${i.s ? " - " + i.s : ""}</title><link>${i.l}</link><pubDate>${new Date(now - i.h * 3600e3).toUTCString()}</pubDate><description>${i.d || ""}</description>${i.s ? `<source url="x">${i.s}</source>` : ""}</item>`).join("")}</channel></rss>`;
const okItem = (x, by) => ({ i: x.i, relevant: true, categories: x.guessedCategories || ["korea"], level: x.guessedCategories && x.guessedCategories.includes("korwar") ? "critical" : "normal", title: { th: "ข่าว " + x.headline, en: "n" }, summary: { th: "สรุป", en: "s" }, body_th: ["ก", "ข", "ค", "ง"], tips_th: [] });

(async () => {
  // ── 1) โควตาฉุกเฉิน ──
  let q = new Quota({}, now);
  const tag = "groq:openai/gpt-oss-120b";
  q.record(tag, 150000);
  assert.ok(q.canUse(tag), "below reserve line (160k) → normal work allowed");
  q.record(tag, 11000);
  assert.ok(!q.canUse(tag) && q.canUse(tag, true), "inside the reserve → only emergencies");
  q.record(tag, 20000);
  assert.ok(!q.canUse(tag, true), "over the daily limit → nobody");
  q.exhaust("groq:openai/gpt-oss-20b"); assert.ok(!q.canUse("groq:openai/gpt-oss-20b", true), "provider said daily quota is gone");
  q.useEmergency(); q.useEmergency(); q.useEmergency(); assert.strictEqual(q.emergencyLeft(), 0, "3 emergencies per day");
  const tomorrow = new Quota(q.toJSON(), now + 864e5);
  assert.ok(tomorrow.canUse(tag) && tomorrow.emergencyLeft() === 3, "new day (KST) → everything resets");
  assert.ok(kstDay(Date.parse("2026-11-02T15:30:00Z")) === "2026-11-03", "day counted in Korean time");

  // ── 2) GitHub Models: รูปแบบคำขอถูกต้อง และนับโควตา ──
  const calls = [];
  const gh = async (url, opt) => { const b = JSON.parse(opt.body); calls.push({ url, auth: opt.headers.authorization, max: b.max_tokens, m: b.model }); const input = JSON.parse(b.messages[1].content); return { ok: true, status: 200, json: async () => ({ usage: { total_tokens: 1234 }, choices: [{ message: { content: JSON.stringify({ items: input.map(x => okItem(x)) }) } }] }) } };
  q = new Quota({}, now);
  const o = await translate([{ titleKo: "환율 급등", snippet: "", article: "", source: "", cats: ["fx"] }], { githubToken: "ghs_x", fetchImpl: gh, log, waitMs: 0, quota: q });
  assert.strictEqual(calls[0].url, "https://models.github.ai/inference/chat/completions"); assert.strictEqual(calls[0].auth, "Bearer ghs_x");
  assert.ok(calls[0].max <= 4000, "GitHub Models output capped at 4K"); assert.strictEqual(o.model, "github:openai/gpt-4.1-mini");
  assert.deepStrictEqual(q.used["github:openai/gpt-4.1-mini"], { tokens: 1234, requests: 1 });

  // ── 3) แข่งกันแปล: ใช้คำตอบแรกที่ถูกต้อง และยกเลิกตัวที่เหลือ ──
  const order = [], aborted = [];
  const multi = async (url, opt) => {
    const b = JSON.parse(opt.body);
    const name = url.includes("groq") ? "groq:" + b.model : url.includes("github") ? "github:" + b.model : "gemini";
    order.push(name);
    const delay = name === "github:openai/gpt-4o-mini" ? 30 : 400; // ตัวนี้เร็วสุด
    await new Promise((res, rej) => { const t = setTimeout(res, delay); opt.signal.addEventListener("abort", () => { clearTimeout(t); aborted.push(name); const e = new Error("aborted"); e.name = "AbortError"; rej(e) }) });
    const input = JSON.parse(url.includes("generativelanguage") ? b.contents[0].parts[0].text : b.messages[1].content);
    const content = JSON.stringify({ items: input.map(x => okItem(x)) });
    return { ok: true, status: 200, json: async () => url.includes("generativelanguage") ? { candidates: [{ content: { parts: [{ text: content }] } }] } : { choices: [{ message: { content } }] } };
  };
  const t0 = Date.now();
  const rr = await raceTranslate([{ titleKo: "북한 미사일", snippet: "", article: "", source: "", cats: ["korwar"] }], { groqKey: "g", githubToken: "t", apiKey: "k", fetchImpl: multi, log });
  assert.strictEqual(rr.model, "github:openai/gpt-4o-mini", "fastest valid answer wins");
  assert.ok(Date.now() - t0 < 300, "did not wait for slower AIs");
  assert.strictEqual(new Set(order).size, 9 - 3, "all lanes asked at once (3 groq + 2 github + gemini models)") ;
  await sleep(20); assert.ok(aborted.length >= 5, "slower AIs cancelled");

  // ── 4) รอบจริง: ข่าวซ้ำ, ข่าวซ่อน, ทางด่วนสงครามเกาหลี, ตัวเฝ้าฟีด ──
  const db = fakeDb();
  db.data.set("meta/feed", { v: 8, items: [
    { id: "exist1", titleKo: "최저임금 내년 1만1천원으로 결정", title: { th: "ค่าแรงขั้นต่ำปีหน้า 11,000 วอน", en: "x" }, summary: { th: "ส", en: "s" }, body: { th: ["ก".repeat(500)] }, rich: true, image: "https://i/1.jpg",
      categories: ["wage"], level: "normal", translated: true, publishedAt: new Date(now - 2 * 3600e3).toISOString(), source: "연합뉴스", sourceUrl: "https://yna/1", links: [{ label: "연합뉴스", url: "https://yna/1" }] },
    { id: "kw-old", titleKo: "북한, 동해상으로 탄도미사일 발사", title: { th: "เกาหลีเหนือยิงขีปนาวุธ (เมื่อวาน)", en: "x" }, summary: { th: "ส", en: "s" }, body: { th: ["ก".repeat(500)] }, rich: true, image: "https://i/2.jpg",
      categories: ["korwar"], level: "critical", translated: true, publishedAt: new Date(now - 20 * 3600e3).toISOString(), source: "KBS", sourceUrl: "https://kbs/1", links: [{ label: "KBS", url: "https://kbs/1" }] }
  ] });
  db.data.set("subscribers/a", { token: "tokA", enabled: true, level: "critical", cats: ["korwar"], testRequested: false });
  let pollCount = 0;
  const feedFor = { gn_labor: () => rss([{ t: "최저임금 1만1천원 확정", s: "SBS", l: "https://sbs/2", h: 1 }]),                // ข่าวซ้ำกับ exist1
                    gn_korwar: () => rss([{ t: "북한, 동해상으로 탄도미사일 발사", l: "https://sbs/kw-today", h: 0.2 }]), // ซ้ำหัวข้อกับเมื่อวาน แต่ห่าง 20 ชม. → ข่าวใหม่
                    gn_oil_fx: () => rss([{ t: "국제유가 급등 휘발유 2천원 돌파", l: "https://khan/oil", h: 0.5 }]),
                    yna: () => pollCount++ >= 1 ? rss([{ t: "합참 \"북한, 서해 군사분계선 인근 포격\"", l: "https://yna/kw-late", h: 0 }]) : rss([]) };
  const pushes = [], feedWritesBeforeEnd = [];
  const fetchImpl = async (url, opt) => {
    if (url.includes("api.groq.com") || url.includes("models.github.ai") || url.includes("generativelanguage")) {
      const b = JSON.parse(opt.body);
      const sys = url.includes("generativelanguage") ? b.systemInstruction.parts[0].text : b.messages[0].content;
      const input = JSON.parse(url.includes("generativelanguage") ? b.contents[0].parts[0].text : b.messages[1].content);
      const titles = sys.startsWith("Translate Korean");
      await sleep(url.includes("github") ? 5 : 60);
      const content = JSON.stringify({ items: input.map(x => titles ? { i: x.i, th: "หัวข้อ " + x.headline, en: "T" } : okItem(x)) });
      return { ok: true, status: 200, json: async () => url.includes("generativelanguage") ? { candidates: [{ content: { parts: [{ text: content }] } }] } : { usage: { total_tokens: 500 }, choices: [{ message: { content } }] } };
    }
    const f = FEEDS.find(x => x.url === url);
    if (f) return { ok: true, text: async () => (feedFor[f.id] ? feedFor[f.id]() : "<rss><channel></channel></rss>") };
    await sleep(400); // เปิดหน้าข่าว: ช้าหน่อย ให้ตัวเฝ้าฟีดได้ตรวจระหว่างรอบ
    return { ok: true, status: 200, headers: { get: () => "text/html" }, arrayBuffer: async () => Buffer.from("<html><p>" + "북한이 포격을 했다고 합참이 밝혔다. ".repeat(20) + "</p></html>") };
  };
  const messaging = { async sendEachForMulticast(m) { pushes.push({ t: Date.now(), id: m.data.id, tokens: m.tokens }); return { successCount: m.tokens.length, responses: m.tokens.map(() => ({ success: true })) } } };
  const start = Date.now();
  const st = await runOnce({ db, messaging, appUrl: "https://x", groqKey: "g", githubToken: "t", geminiKey: "k", fetchImpl, now, log, waitMs: 0, budgetMs: 33000, imgBudgetMs: 2000, watchEveryMs: 300 });
  const feed = db.data.get("meta/feed").items, by = id => feed.find(i => i.id === id);
  // ข่าวซ้ำ
  assert.ok(by("exist1").links.some(l => l.label === "SBS"), "duplicate from SBS added as an extra source, no new card");
  assert.ok(!feed.some(i => i.titleKo.startsWith("최저임금 1만1천원 확정")), "no duplicate card");
  assert.ok(st.merged >= 1);
  const kwToday = feed.find(i => i.sourceUrl.includes("kw-today") || (i.links || []).some(l => l.url.includes("kw-today")));
  assert.ok(kwToday && kwToday.id !== "kw-old", "same headline 20h later = a new event (Korean-war window is 6h)");
  // ทางด่วนสงครามเกาหลี
  assert.ok(kwToday.translated && kwToday.title.th.startsWith("ข่าว"), "Korean-war story fully translated");
  const late = feed.find(i => i.titleKo.includes("서해 군사분계선"));
  assert.ok(late && late.translated, "story that appeared mid-run caught by the watcher and translated in the same run");
  assert.ok(pollCount >= 2, "Korean-war feeds polled again during the run");
  const kwPush = pushes.find(p => p.id === kwToday.id);
  assert.ok(kwPush && kwPush.t - start < 5000, "Korean-war alert sent right away, not at the end of the run");
  const firstKwWrite = db.writes.find(w => w.p === "meta/feed" && w.v.items.some(i => i.id === kwToday.id && i.translated));
  const lastWrite = db.writes.filter(w => w.p === "meta/feed").pop();
  assert.ok(firstKwWrite && firstKwWrite !== lastWrite, "Korean-war story saved to the app immediately (before the round ended)");
  // ข่าวทั่วไปแปลเสร็จก่อนขึ้นแอป
  const oil = feed.find(i => i.titleKo.includes("국제유가"));
  assert.ok(oil && oil.translated && shown(oil), "normal story shown after full translation");
  assert.ok(!shown({ translated: false, categories: ["oil"] }) && shown({ translated: false, categories: ["korwar"] }), "untranslated normal stories are hidden; Korean war shows first");
  // โควตาถูกบันทึก
  const qd = db.data.get("meta/quota");
  assert.ok(qd && Object.keys(qd.used).length >= 1 && qd.emergencyUsed === 0, "quota usage saved");

  // ── 5) ใช้โควตาฉุกเฉินเมื่อโควตาปกติเหลือแค่ส่วนสำรอง ──
  const db2 = fakeDb();
  const full = { tokens: 175000, requests: 10 };
  db2.data.set("meta/quota", { day: kstDay(now), used: { "groq:openai/gpt-oss-120b": full, "groq:openai/gpt-oss-20b": full, "groq:qwen/qwen3-32b": { tokens: 445000, requests: 10 } }, exhausted: {}, emergencyUsed: 0 });
  db2.data.set("meta/feed", { v: 8, items: [] });
  const feed2 = { gn_korwar: () => rss([{ t: "북한 장사정포 포격 도발", l: "https://a/kw", h: 0.1 }]), gn_oil_fx: () => rss([{ t: "휘발유 가격 하락세 지속", l: "https://a/oil", h: 0.1 }]) };
  const f2 = async (url, opt) => { const f = FEEDS.find(x => x.url === url); if (f) return { ok: true, text: async () => (feed2[f.id] ? feed2[f.id]() : "<rss><channel></channel></rss>") }; return fetchImpl(url, opt) };
  const st2 = await runOnce({ db: db2, messaging, appUrl: "https://x", groqKey: "g", fetchImpl: f2, now, log, waitMs: 0, budgetMs: 31000, imgBudgetMs: 2000, watchEveryMs: 60000 });
  const fd2 = db2.data.get("meta/feed").items;
  assert.ok(fd2.find(i => i.titleKo.includes("장사정포")).translated, "Korean-war story translated with emergency quota");
  assert.ok(!fd2.find(i => i.titleKo.includes("휘발유")).translated, "normal story waits (only emergency quota left)");
  assert.ok(st2.emergency >= 1 && db2.data.get("meta/quota").emergencyUsed >= 1, "emergency use counted");
  assert.ok(/reserved for emergencies/.test(st2.lastError || ""), "log explains that normal work is paused by the reserve");
  console.log("ผ่านทุกข้อ (ชุดที่ 9: ข่าวซ้ำ + สงครามเกาหลีทางด่วน + โควตาฉุกเฉิน + GitHub Models)");
})().catch(e => { console.error("ไม่ผ่าน:", e.stack || e.message); process.exit(1); });
