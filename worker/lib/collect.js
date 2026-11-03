const crypto = require("crypto");
const { XMLParser } = require("fast-xml-parser");
const { CATS, FEEDS, CAT_KEYS, EMERGENCY_KW } = require("../feeds");
const { grams, similarity, SAME_KO } = require("./similar");

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@", textNodeName: "#text", processEntities: true, htmlEntities: true });
const MAX_AGE_MS = 36 * 3600e3;

const text = v => (v == null ? "" : typeof v === "object" ? String(v["#text"] ?? "") : String(v));
const stripTags = s => s.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const norm = s => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

// id เดียวกันสำหรับข่าวหัวเดียวกันจากหลายสำนัก จึงไม่ซ้ำ
function newsId(title) {
  return crypto.createHash("sha1").update(norm(title).slice(0, 48)).digest("hex").slice(0, 20);
}

// ภาพที่แนบมากับ RSS (ถ้ามี): media:content / media:thumbnail / enclosure / <img> ในคำโปรย
function rssImage(it, rawDesc) {
  const pick = v => (Array.isArray(v) ? v[0] : v);
  const cands = [pick(it["media:content"])?.["@url"], pick(it["media:thumbnail"])?.["@url"],
    /^image\//.test(pick(it.enclosure)?.["@type"] || "") ? pick(it.enclosure)?.["@url"] : null,
    (String(rawDesc).match(/<img[^>]+src=["']([^"']+)["']/i) || [])[1]];
  for (const c of cands) {
    if (typeof c === "string" && /^https?:\/\//.test(c) && !/news\.google\.com|gstatic\.com\/.*favicon/.test(c)) return c.replace(/^http:/, "https:");
  }
  return null;
}

function matchCats(s) {
  s = String(s).replace(/北京/g, "베이징"); // 北京 = ปักกิ่ง ไม่ใช่เกาหลีเหนือ
  const out = [];
  for (const k of CAT_KEYS) if (CATS[k].kw.some(w => s.includes(w))) out.push(k);
  return out;
}

async function getText(url, fetchImpl) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetchImpl(url, { signal: ctl.signal, headers: { "User-Agent": "Mozilla/5.0 (KoreaWatch news reader)", Accept: "application/rss+xml,application/xml,text/xml,*/*" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.text();
  } finally { clearTimeout(timer); }
}

function parseFeed(xml, feed, now) {
  const doc = parser.parse(xml);
  let items = doc?.rss?.channel?.item || doc?.feed?.entry || [];
  if (!Array.isArray(items)) items = [items];
  const out = [];
  for (const it of items.slice(0, feed.take || 20)) {
    let title = stripTags(text(it.title));
    const sourceName = stripTags(text(it.source)) || "";
    // Google News: "หัวข้อ - ชื่อสำนักข่าว"
    if (sourceName && title.endsWith(" - " + sourceName)) title = title.slice(0, -(sourceName.length + 3)).trim();
    if (!title) continue;
    let link = text(it.link) || it.link?.["@href"] || "";
    link = String(link).trim();
    if (!/^https?:\/\//.test(link)) continue;
    const rawDesc = text(it.description || it.summary);
    let snippet = stripTags(rawDesc);
    if (norm(snippet).startsWith(norm(title).slice(0, 20))) snippet = ""; // Google News ซ้ำหัวข้อ
    const t = Date.parse(text(it.pubDate || it.published || it.updated));
    const publishedAt = Number.isFinite(t) ? Math.min(t, now) : now;
    if (now - publishedAt > MAX_AGE_MS) continue;
    const cats = matchCats(title + " " + snippet);
    if (feed.keywordOnly && !cats.length) continue;
    if (feed.hint && !cats.includes(feed.hint)) cats.push(feed.hint);
    if (!cats.length) continue;
    out.push({
      emergency: cats.includes("korwar") || EMERGENCY_KW.some(w => title.includes(w)),
      id: newsId(title), titleKo: title, snippet: snippet.slice(0, 600), link, image: rssImage(it, rawDesc),
      source: sourceName || feed.source || "",
      publishedAt: new Date(publishedAt).toISOString(), cats
    });
  }
  return out;
}

// ดึงทุก feed พร้อมกัน feed ไหนล่มก็ข้ามไป ไม่ทำให้ทั้งรอบพัง
// ข่าวเรื่องเดียวกันอยู่ห่างกันได้ไม่เกินนี้ (สงครามเกาหลีสั้นกว่า เพื่อไม่ให้เหตุการณ์คนละวันรวมกัน)
const mergeWindow = (a, b) => (a.cats.includes("korwar") || b.cats.includes("korwar") ? 6 : 24) * 3600e3;
const isGoogle = u => /news\.google\.com/.test(u || "");

// รวมข่าวที่เป็นเรื่องเดียวกัน (หัวข้อคล้ายกัน) ให้เหลือข่าวเดียว เก็บสำนักอื่นไว้เป็นแหล่งข่าวเพิ่ม
function mergeSimilar(list) {
  const kept = [];
  for (const n of list) {
    n._g = n._g || grams(n.titleKo);
    const twin = kept.find(k => Math.abs(Date.parse(k.publishedAt) - Date.parse(n.publishedAt)) <= mergeWindow(k, n) && similarity(k._g, n._g) >= SAME_KO);
    if (!twin) { kept.push(n); continue; }
    twin.cats = [...new Set([...twin.cats, ...n.cats])];
    twin.emergency = twin.emergency || n.emergency;
    // ใช้ลิงก์ตรงของสำนักข่าวเป็นหลัก (เร็วกว่าและได้ภาพง่ายกว่าลิงก์ Google)
    if (isGoogle(twin.link) && !isGoogle(n.link)) { [twin.link, n.link] = [n.link, twin.link]; [twin.source, n.source] = [n.source, twin.source]; }
    if (!twin.image && n.image) twin.image = n.image;
    if (!twin.snippet && n.snippet) twin.snippet = n.snippet;
    twin.alts = twin.alts || [];
    if (n.source && n.source !== twin.source && !twin.alts.some(a => a.source === n.source)) twin.alts.push({ source: n.source, link: n.link });
  }
  return kept;
}

async function collect({ fetchImpl = fetch, now = Date.now(), log = console, only = null } = {}) {
  const feeds = only ? FEEDS.filter(only) : FEEDS;
  const results = await Promise.allSettled(feeds.map(async f => parseFeed(await getText(f.url, fetchImpl), f, now)));
  const byId = new Map(), errors = [];
  results.forEach((r, i) => {
    if (r.status === "rejected") { errors.push(feeds[i].id + ": " + (r.reason?.message || r.reason)); return; }
    for (const n of r.value) {
      const prev = byId.get(n.id);
      if (!prev) byId.set(n.id, n);
      else prev.cats = [...new Set([...prev.cats, ...n.cats])];
    }
  });
  if (errors.length) log.warn("feed errors", errors);
  const rank = n => Math.min(...n.cats.map(c => CAT_KEYS.indexOf(c)));
  const list = mergeSimilar([...byId.values()].sort((a, b) => rank(a) - rank(b) || b.publishedAt.localeCompare(a.publishedAt)));
  list.forEach(n => delete n._g);
  return { list, errors };
}

module.exports = { collect, parseFeed, newsId, matchCats, mergeSimilar };
