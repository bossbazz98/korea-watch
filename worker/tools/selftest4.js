const { allItems } = require("./test-data");
// ทดสอบการหาภาพข่าวด้วยหน้าเว็บจำลอง: node tools/selftest4.js
const assert = require("assert");
const { decodeGoogleNews, findOgImage, resolveArticle } = require("../lib/images");
const { parseFeed } = require("../lib/collect");
const { runOnce } = require("../run");

const res = (body, { status = 200, url } = {}) => ({ ok: status < 400, status, url, arrayBuffer: async () => Buffer.from(body, "utf8"), text: async () => body, json: async () => JSON.parse(body) });
const GID = "CBMiWkFVX3lxTE9hYmNkZWZn";
const GLINK = `https://news.google.com/rss/articles/${GID}?oc=5`;
const REAL = "https://www.yna.co.kr/view/AKR20261031000100504";
let posted = null;
const web = async (url, opt = {}) => {
  if (url === `https://news.google.com/articles/${GID}`) return res(`<html><c-wiz><div jscontroller="x" data-n-a-sg="SIGabc" data-n-a-ts="1761900000"></div></c-wiz></html>`);
  if (url.startsWith("https://news.google.com/_/DotsSplashUi/data/batchexecute")) {
    posted = decodeURIComponent(opt.body);
    const inner = JSON.stringify(["garturlres", REAL, 1]);
    return res(`)]}'\n\n${JSON.stringify([["wrb.fr", "Fbv4je", inner, null, null, null, "generic"], ["di", 12]])}\n\n25\n[["e",4,null,null,123]]`);
  }
  if (url === REAL) return res(`<html><head><meta content="https://img.yna.co.kr/photo/AKR1.jpg?a=1&amp;b=2" property="og:image"/></head></html>`, { url: REAL });
  if (url === "https://broken.example/news") return res("", { status: 403 });
  if (url === "https://nometa.example/news") return res("<html><head><title>x</title></head></html>");
  throw new Error("unexpected " + url);
};

(async () => {
  // ถอดลิงก์ Google News
  const u = await decodeGoogleNews(GLINK, { fetchImpl: web });
  assert.strictEqual(u, REAL);
  assert.ok(posted.includes(GID) && posted.includes("1761900000") && posted.includes("SIGabc") && posted.includes("Fbv4je"), "request carries id/ts/sg");
  assert.strictEqual(await decodeGoogleNews("https://www.kbs.co.kr/a", { fetchImpl: web }), "https://www.kbs.co.kr/a", "non-google link passes through");

  // อ่าน og:image แบบต่างๆ
  assert.strictEqual(findOgImage(`<meta property="og:image" content="/img/a.jpg">`, "https://news.example.com/x/1"), "https://news.example.com/img/a.jpg", "relative url");
  assert.strictEqual(findOgImage(`<meta name="twitter:image" content="http://cdn.ex.com/p.png">`, "https://ex.com"), "https://cdn.ex.com/p.png", "twitter image, http→https");
  assert.strictEqual(findOgImage(`<meta property='og:image' content='https://ex.com/logo.png'><meta name="twitter:image" content="https://ex.com/photo/1.jpg">`, "https://ex.com"), "https://ex.com/photo/1.jpg", "skip logo, use next");
  assert.strictEqual(findOgImage(`<html><head></head></html>`, "https://ex.com"), null);
  assert.strictEqual(findOgImage(`<meta property="og:image" content="javascript:alert(1)">`, "https://ex.com"), null, "unsafe scheme ignored");

  // ทั้งขั้นตอน
  const a = await resolveArticle(GLINK, { fetchImpl: web });
  assert.strictEqual(a.url, REAL); assert.strictEqual(a.image, "https://img.yna.co.kr/photo/AKR1.jpg?a=1&b=2");

  // ภาพที่แนบมากับ RSS
  const xml = `<rss xmlns:media="http://search.yahoo.com/mrss/"><channel><item><title>북한 미사일 발사</title><link>https://www.yonhapnewstv.co.kr/news/1</link><pubDate>${new Date().toUTCString()}</pubDate><description>설명</description><media:content url="http://img.yonhapnewstv.co.kr/1.jpg" medium="image"/></item></channel></rss>`;
  const items = parseFeed(xml, { id: "yonhaptv", keywordOnly: true, take: 5 }, Date.now());
  assert.strictEqual(items[0].image, "https://img.yonhapnewstv.co.kr/1.jpg", "media:content picked, upgraded to https");

  // ในรอบจริง: ข่าวที่แปลแล้วได้ภาพและลิงก์จริง / เว็บเสียนับครั้ง / ครบ 3 ครั้งเลิก
  const data = new Map();
  const ref = p => ({ async get() { const d = data.get(p); return { exists: !!d, data: () => JSON.parse(JSON.stringify(d)) } }, async set(v) { data.set(p, JSON.parse(JSON.stringify(v))) }, async update() { }, async delete() { } });
  const db = { doc: ref, collection: () => ({ where() { return this }, limit() { return this }, async get() { return { empty: true, docs: [] } } }) };
  const now = Date.now();
  const base = { titleKo: "x", title: { th: "ก", en: "a" }, summary: {}, body: {}, categories: ["war"], level: "normal", translated: true, publishedAt: new Date(now - 6e5).toISOString(), source: "연합뉴스" };
  data.set("meta/feed", { v: 8, items: [
    { ...base, id: "g", sourceUrl: GLINK, links: [{ label: "연합뉴스", url: GLINK }] },
    { ...base, id: "b", sourceUrl: "https://broken.example/news", links: [] },
    { ...base, id: "n", sourceUrl: "https://nometa.example/news", links: [], imgTries: 2 },
    { ...base, id: "done", sourceUrl: "https://broken.example/news", links: [], imgTries: 3, imgLastTry: now - 3600e3 },
    { ...base, id: "retry12h", sourceUrl: GLINK, links: [], imgTries: 3, imgLastTry: now - 13 * 3600e3 }
  ] });
  const fetchAll = async (url, opt) => url.includes("news.google.com/rss/search") || url.includes("rss?hl") || url.includes("yonhapnewstv") ? res("<rss><channel></channel></rss>") : web(url, opt);
  const st = await runOnce({ db, messaging: {}, appUrl: "https://x", geminiKey: "", fetchImpl: fetchAll, now, log: { log() {}, warn() {} }, waitMs: 0 });
  const f = allItems(data), by = id => f.find(i => i.id === id);
  assert.strictEqual(by("g").image, "https://img.yna.co.kr/photo/AKR1.jpg?a=1&b=2");
  assert.strictEqual(by("g").sourceUrl, REAL); assert.strictEqual(by("g").links[0].url, REAL, "button now opens the real article");
  assert.strictEqual(by("b").imgTries, 1); assert.strictEqual(by("n").imgTries, 3, "no image found → counted");
  assert.strictEqual(by("done").imgTries, 3, "paused 1h ago → not retried yet");
  assert.ok(by("retry12h").image, "paused 13h ago → retried and found an image");
  assert.strictEqual(st.images, 2);
  console.log("ผ่านทุกข้อ (ชุดที่ 4: รูปภาพ)");
})().catch(e => { console.error("ไม่ผ่าน:", e.stack || e.message); process.exit(1); });
