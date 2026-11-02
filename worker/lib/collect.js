const crypto = require("crypto");
const { XMLParser } = require("fast-xml-parser");
const { CATS, FEEDS, CAT_KEYS } = require("../feeds");

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
      id: newsId(title), titleKo: title, snippet: snippet.slice(0, 600), link, image: rssImage(it, rawDesc),
      source: sourceName || feed.source || "",
      publishedAt: new Date(publishedAt).toISOString(), cats
    });
  }
  return out;
}

// ดึงทุก feed พร้อมกัน feed ไหนล่มก็ข้ามไป ไม่ทำให้ทั้งรอบพัง
async function collect({ fetchImpl = fetch, now = Date.now(), log = console } = {}) {
  const results = await Promise.allSettled(FEEDS.map(async f => parseFeed(await getText(f.url, fetchImpl), f, now)));
  const byId = new Map(), errors = [];
  results.forEach((r, i) => {
    if (r.status === "rejected") { errors.push(FEEDS[i].id + ": " + (r.reason?.message || r.reason)); return; }
    for (const n of r.value) {
      const prev = byId.get(n.id);
      if (!prev) byId.set(n.id, n);
      else prev.cats = [...new Set([...prev.cats, ...n.cats])];
    }
  });
  if (errors.length) log.warn("feed errors", errors);
  const rank = n => Math.min(...n.cats.map(c => CAT_KEYS.indexOf(c)));
  const list = [...byId.values()].sort((a, b) => rank(a) - rank(b) || b.publishedAt.localeCompare(a.publishedAt));
  return { list, errors };
}

module.exports = { collect, parseFeed, newsId, matchCats };
