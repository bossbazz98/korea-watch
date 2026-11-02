// ทดสอบ: ดึงเนื้อข่าวจริง, สรุปละเอียด, เขียนข่าวสั้นใหม่, พักรุ่นที่โดน 429, แปลซ้ำทันที, งานจาก Agent: node tools/selftest7.js
const assert = require("assert");
const { extractArticleText, findArticleImage, decodePage, resolveArticle } = require("../lib/images");
const { translate } = require("../lib/translate");
const { runOnce } = require("../run");
const log = { log() {}, warn() {} };
const KO = "북한이 31일 오전 동해상으로 단거리 탄도미사일 여러 발을 발사했다고 합동참모본부가 밝혔다. ";

(async () => {
  // 1) ดึงเนื้อข่าว 3 แบบ + ตัดข้อความท้ายข่าว (ลิขสิทธิ์/อีเมลนักข่าว)
  const ld = `<script type="application/ld+json">{"@type":"NewsArticle","articleBody":"${KO.repeat(6)}\\n홍길동 기자 hong@yna.co.kr\\n무단 전재 및 재배포 금지"}</script>`;
  const t1 = extractArticleText(`<html>${ld}<p>메뉴</p></html>`);
  assert.ok(t1.includes("탄도미사일") && !t1.includes("무단") && !t1.includes("@"), "JSON-LD body, boilerplate removed");
  const t2 = extractArticleText(`<html><nav><p>${KO}메뉴</p></nav><article><p>${KO.repeat(4)}</p><p>${KO.repeat(4)}</p><p>ⓒ SBS 무단복제 금지</p></article></html>`);
  assert.ok(t2.length > 300 && !t2.includes("ⓒ") && !t2.includes("메뉴"), "<p> paragraphs without nav/boilerplate");
  const t3 = extractArticleText(`<html><div id="articleBody" class="news_body">${KO.repeat(3)}<br>${KO.repeat(3)}<br>기자 kim@kbs.co.kr</div></html>`);
  assert.ok(t3.length > 300 && !t3.includes("@"), "container with <br> lines");
  assert.ok(extractArticleText(`<p>${KO.repeat(40)}</p>`).length <= 3000, "capped at 3000 characters");
  // EUC-KR
  const euc = Buffer.from([0x3c, 0x6d, 0x65, 0x74, 0x61, 0x20, 0x63, 0x68, 0x61, 0x72, 0x73, 0x65, 0x74, 0x3d, 0x65, 0x75, 0x63, 0x2d, 0x6b, 0x72, 0x3e, 0xc7, 0xd1, 0xb1, 0xb9]);
  assert.ok(decodePage(euc, "text/html").endsWith("한국"), "EUC-KR page decoded");
  assert.ok(decodePage(euc, "text/html; charset=ks_c_5601-1987").endsWith("한국"), "ks_c_5601 alias");
  // ภาพสำรอง: ภาพแรกในบทความ ข้ามโลโก้/ไอคอน
  assert.strictEqual(findArticleImage(`<img src="/logo.png"><article><img src="/icons/a.png" width="20"><img data-src="//img.sbs.co.kr/photo/2026/1031/main.jpg"></article>`, "https://news.sbs.co.kr/a"), "https://img.sbs.co.kr/photo/2026/1031/main.jpg");

  // 2) แปลซ้ำทันทีกับรุ่นถัดไป ถ้าข่าวเกินครึ่งไม่ใช่ภาษาไทย
  const seenModels = [];
  const f2 = async (url, opt) => {
    const b = JSON.parse(opt.body); seenModels.push(b.model);
    const input = JSON.parse(b.messages[1].content);
    const th = b.model === "openai/gpt-oss-120b" ? "Missile launched" : "เกาหลีเหนือยิงขีปนาวุธ";
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify({ items: input.map(x => ({ i: x.i, relevant: true, categories: ["war"], level: "high", title: { th, en: "t" }, summary: { th: "สรุป", en: "s" }, body_th: ["ก", "ข", "ค", "ง"], tips_th: ["ติดตามประกาศทางการ"] })) }) } }] }) };
  };
  const o = await translate([{ titleKo: "북한", snippet: "", article: KO, source: "", cats: ["war"] }], { groqKey: "k", fetchImpl: f2, log, waitMs: 0 });
  assert.deepStrictEqual(seenModels, ["openai/gpt-oss-120b", "openai/gpt-oss-20b"], "non-Thai answer → retried right away with next model");
  assert.strictEqual(o.results[0].title.th, "เกาหลีเหนือยิงขีปนาวุธ"); assert.deepStrictEqual(o.results[0].tips.th, ["ติดตามประกาศทางการ"]); assert.strictEqual(o.results[0].body.th.length, 4);

  // 3) รอบจริง
  const data = new Map();
  const ref = p => ({ path: p, id: p.split("/").pop(), async get() { const d = data.get(p); return { exists: !!d, data: () => JSON.parse(JSON.stringify(d)) } }, async set(v) { data.set(p, JSON.parse(JSON.stringify(v))) }, async update(v) { data.set(p, { ...data.get(p), ...v }) }, async delete() { data.delete(p) } });
  const db = { doc: ref, collection: col => ({ where() { return this }, limit() { return this }, async get() { const docs = [...data.keys()].filter(k => k.startsWith(col + "/")).map(k => ({ id: k.split("/").pop(), ref: ref(k), data: () => data.get(k) })); return { empty: !docs.length, docs } } }) };
  const now = Date.now(), iso = h => new Date(now - h * 3600e3).toISOString();
  const page = (body, img = "") => ({ ok: true, status: 200, url: undefined, headers: { get: () => "text/html; charset=utf-8" }, arrayBuffer: async () => Buffer.from(`<html><head>${img ? `<meta property="og:image" content="${img}">` : ""}<meta property="og:description" content="요약"></head><body><article><p>${body}</p></article></body></html>`) });
  const groqCalls = [];
  let mode = "ok";
  const fetchImpl = async (url, opt) => {
    if (url.startsWith("https://news.example/")) return url.includes("noText") ? page("짧음") : page(KO.repeat(8), url.includes("img") ? "https://img.example/p.jpg" : "");
    if (url.startsWith("https://api.groq.com")) {
      const b = JSON.parse(opt.body), input = JSON.parse(b.messages[1].content);
      groqCalls.push({ m: b.model, n: input.length, art: input.map(x => (x.article || "").length) });
      if (mode === "rate" && b.model === "openai/gpt-oss-120b") return { ok: false, status: 429, json: async () => ({ error: { message: "Rate limit reached: tokens per minute" } }) };
      const titles = b.messages[0].content.startsWith("Translate Korean");
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify({ items: input.map(x => titles ? { i: x.i, th: "หัวข้อ", en: "T" } : { i: x.i, relevant: true, categories: x.guessedCategories && x.guessedCategories.length ? x.guessedCategories : ["war"], level: "high", title: { th: "ข่าวละเอียด " + x.headline, en: "t" }, summary: { th: "สรุปสองถึงสามประโยค", en: "s" }, body_th: ["ย่อ1", "ย่อ2", "ย่อ3", "ย่อ4", "ย่อ5"], tips_th: ["ข้อควรรู้"] }) }) } }] }) };
    }
    return { ok: true, text: async () => "<rss><channel></channel></rss>", arrayBuffer: async () => Buffer.from("") };
  };
  const base = { titleKo: "북한 미사일", snippetKo: "", summary: {}, body: {}, categories: ["war"], level: "normal", links: [{ label: "x", url: "" }], source: "연합뉴스" };
  data.set("meta/feed", { v: 8, items: [
    { ...base, id: "new1", titleKo: "북한 탄도미사일 동해 발사", title: { ko: "북한" }, translated: false, publishedAt: iso(0.5), sourceUrl: "https://news.example/new1-img" },
    { ...base, id: "old-short", titleKo: "국제유가 급등 주유소 가격 상승", categories: ["oil"], title: { th: "สั้น", en: "s" }, summary: { th: "ส", en: "s" }, body: { th: ["สั้นมาก"] }, translated: true, publishedAt: iso(5), sourceUrl: "https://news.example/old" },
    { ...base, id: "old-notext", titleKo: "최저임금 결정 노사 협상", categories: ["wage"], title: { th: "สั้น2", en: "s" }, summary: { th: "ส", en: "s" }, body: { th: ["สั้น"] }, translated: true, publishedAt: iso(6), sourceUrl: "https://news.example/noText", image: "https://img/x.jpg" },
    { ...base, id: "fix-img", titleKo: "질병관리청 독감 주의보", categories: ["disease"], title: { th: "ภาพเสีย", en: "x" }, translated: true, rich: true, body: { th: ["x".repeat(500)] }, publishedAt: iso(7), sourceUrl: "https://news.example/fix-img", image: "https://broken/1.jpg" },
    { ...base, id: "fix-remove", titleKo: "외국인 노동자 고용허가", categories: ["foreign"], title: { th: "ซ้ำ", en: "x" }, translated: true, rich: true, body: { th: ["x".repeat(500)] }, publishedAt: iso(8), sourceUrl: "https://news.example/x", image: "https://i/1.jpg" }
  ] });
  data.set("meta/fixes", { requeueImage: ["fix-img"], remove: ["fix-remove"], enrich: [] });
  const st = await runOnce({ db, messaging: { async sendEachForMulticast(m) { return { successCount: m.tokens.length, responses: [] } } }, appUrl: "https://x", groqKey: "k", fetchImpl, now, log, waitMs: 0 });
  const fd = data.get("meta/feed").items, by = id => fd.find(i => i.id === id);
  assert.strictEqual(st.fixes, 2); assert.ok(!data.has("meta/fixes"), "agent fixes applied then cleared");
  assert.ok(!by("fix-remove"), "duplicate removed by agent request");
  assert.strictEqual(by("fix-img").image, "https://img.example/p.jpg", "broken image cleared by agent, new image found");
  const full = groqCalls.filter(c => c.m !== undefined && c.art.some(n => n > 0));
  assert.ok(full.length >= 1 && full[0].art[0] > 300, "real article text sent to the AI");
  assert.strictEqual(by("new1").body.th.length, 5, "detailed 5-paragraph body"); assert.ok(by("new1").rich); assert.deepStrictEqual(by("new1").tips.th, ["ข้อควรรู้"]);
  assert.strictEqual(by("new1").image, "https://img.example/p.jpg", "image picked up while reading the page");
  assert.strictEqual(st.translated, 1); assert.strictEqual(st.enriched, 1, "old short story rewritten from real text");
  assert.ok(by("old-short").rich && by("old-short").body.th.length === 5);
  assert.strictEqual(by("old-notext").enrichTries, 1, "no article text → not sent to AI, counted");
  assert.ok(!by("old-notext").rich);
  assert.strictEqual(st.pushed, 0, "rewritten old story does not trigger a second alert (new1 has no subscribers)");

  // 4) รุ่นที่โดน 429 ถูกพักไว้ 60 วินาที: ชุดถัดไปในรอบเดียวกันไม่ลองรุ่นนั้นซ้ำ
  const sixTitles = ["유가 급등 정유사 대책", "환율 1400원 돌파 우려", "최저임금 심의 시작", "외국인 근로자 쿼터 확대", "근로기준법 개정안 통과", "대통령실 정책 브리핑"];
  data.set("meta/feed", { v: 8, items: [1, 2, 3, 4, 5, 6].map(k => ({ ...base, categories: ["oil"], id: "r" + k, titleKo: sixTitles[k - 1], title: { ko: sixTitles[k - 1] }, translated: false, publishedAt: iso(k * 0.1), sourceUrl: "https://news.example/r" + k })) });
  groqCalls.length = 0; mode = "rate";
  const st2 = await runOnce({ db, messaging: {}, appUrl: "https://x", groqKey: "k", fetchImpl, now, log, waitMs: 0 });
  const big = groqCalls.filter(c => c.m === "openai/gpt-oss-120b").length;
  assert.strictEqual(big, 1, "120b tried once, then cooled down for the rest of the run");
  assert.strictEqual(st2.translated, 6, "all 6 translated by the next model");
  console.log("ผ่านทุกข้อ (ชุดที่ 7: เนื้อข่าวจริง + สรุปละเอียด + Agent)");
})().catch(e => { console.error("ไม่ผ่าน:", e.stack || e.message); process.exit(1); });
