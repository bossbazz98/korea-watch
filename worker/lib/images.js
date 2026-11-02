// เปิดหน้าข่าวของสำนักข่าว เพื่อเอา: ลิงก์จริง ภาพหลัก และเนื้อข่าว (ส่งให้ AI สรุป ไม่ได้เก็บไว้)
// ทุกขั้นตอนมีเวลารอจำกัด ถ้าล้มเหลว ข่าวยังแสดงได้ตามปกติ
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const MAX_TEXT = 2500; // ตัวอักษรเนื้อข่าวที่ส่งให้ AI (พอสำหรับสรุปละเอียด และไม่ชนเพดานโควตาต่อนาที)

// ตรวจชุดตัวอักษรของหน้าเว็บ (เว็บเกาหลีบางเว็บยังใช้ EUC-KR)
function decodePage(buf, contentType) {
  let cs = (String(contentType || "").match(/charset=([\w-]+)/i) || [])[1];
  if (!cs) {
    const head = buf.subarray(0, 4096).toString("latin1");
    cs = (head.match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1];
  }
  cs = (cs || "utf-8").toLowerCase();
  if (/ks_c_5601|ksc5601|cp949|x-windows-949|ms949/.test(cs)) cs = "euc-kr";
  try { return new TextDecoder(cs).decode(buf) } catch (e) { return new TextDecoder("utf-8").decode(buf) }
}

async function get(url, fetchImpl, timeoutMs, opt = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), Math.max(1000, timeoutMs));
  try {
    const r = await fetchImpl(url, { redirect: "follow", ...opt, signal: ctl.signal, headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.6", ...(opt.headers || {}) } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const buf = Buffer.from(await r.arrayBuffer()).subarray(0, 1500000);
    const ct = r.headers && typeof r.headers.get === "function" ? r.headers.get("content-type") : "";
    return { text: decodePage(buf, ct), url: r.url || url };
  } finally { clearTimeout(timer); }
}

function googleArticleId(link) {
  try {
    const u = new URL(link);
    if (u.hostname !== "news.google.com") return null;
    const m = u.pathname.match(/\/(?:rss\/)?(?:articles|read)\/([^/?#]+)/);
    return m ? m[1] : null;
  } catch (e) { return null; }
}

// ถอดลิงก์ Google News เป็นลิงก์จริง (ช่องทางภายในของ Google: อาจเปลี่ยนได้ จึงมีทางสำรองเสมอ)
async function decodeGoogleNews(link, { fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  const id = googleArticleId(link);
  if (!id) return link;
  let sg = null, ts = null;
  // ระบุภาษาเกาหลี/ภูมิภาคเกาหลี และส่งคุกกี้ยินยอม เพื่อลดโอกาสได้หน้าขอความยินยอมแทนหน้าข่าว
  const qs = "?hl=ko&gl=KR&ceid=KR:ko";
  const headers = { Cookie: "CONSENT=YES+cb; SOCS=CAI" };
  for (const page of [`https://news.google.com/articles/${id}${qs}`, `https://news.google.com/rss/articles/${id}${qs}`, `https://news.google.com/articles/${id}`]) {
    try {
      const { text } = await get(page, fetchImpl, timeoutMs, { headers });
      sg = (text.match(/data-n-a-sg="([^"]+)"/) || [])[1];
      ts = (text.match(/data-n-a-ts="([^"]+)"/) || [])[1];
      if (sg && ts) break;
    } catch (e) { /* ลองหน้าถัดไป */ }
  }
  if (!sg || !ts) throw new Error("google params not found");
  const inner = `["garturlreq",[["X","X",["X","X"],null,null,1,1,"KR:ko",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${id}",${Number(ts)},"${sg}"]`;
  const body = "f.req=" + encodeURIComponent(JSON.stringify([[["Fbv4je", inner, null, "generic"]]]));
  const { text } = await get("https://news.google.com/_/DotsSplashUi/data/batchexecute", fetchImpl, timeoutMs,
    { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", ...headers } });
  const part = text.split("\n\n")[1];
  if (!part) throw new Error("google decode: unexpected reply");
  const outer = JSON.parse(part);
  const row = outer.find(x => Array.isArray(x) && x[1] === "Fbv4je") || outer[0];
  const url = JSON.parse(row[2])[1];
  if (!/^https?:\/\//.test(url)) throw new Error("google decode: no url");
  return url;
}

const decodeHtml = s => String(s).replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'").replace(/&#x2F;/gi, "/").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
const BAD_IMG = /logo|default|no[_-]?image|blank|placeholder|icon|banner|btn_|sprite|ad[_-]|\/ads?\/|tracking|pixel|1x1|share_|sns_/i;

function absUrl(src, pageUrl) {
  try {
    const abs = new URL(decodeHtml(src), pageUrl);
    if (!/^https?:$/.test(abs.protocol)) return null;
    if (abs.protocol === "http:") abs.protocol = "https:"; // แอปเป็น https ภาพ http จะถูกบล็อก
    return abs.href;
  } catch (e) { return null }
}

function metaMap(html) {
  const out = {};
  for (const m of html.match(/<meta\b[^>]*>/gi) || []) {
    const key = (m.match(/\b(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i) || [])[1];
    const val = (m.match(/\bcontent\s*=\s*["']([^"']*)["']/i) || [])[1];
    if (key && val != null && !out[key.toLowerCase()]) out[key.toLowerCase()] = val.trim();
  }
  return out;
}

// ภาพหลักที่สำนักข่าวตั้งไว้ (og:image / twitter:image)
function findOgImage(html, pageUrl) {
  const meta = metaMap(html);
  const keys = ["og:image:secure_url", "og:image", "og:image:url", "twitter:image", "twitter:image:src", "image"];
  for (const k of keys) {
    if (!meta[k]) continue;
    const u = absUrl(meta[k], pageUrl);
    if (u && !(BAD_IMG.test(new URL(u).pathname) && k !== keys[0])) return u;
  }
  const ln = (html.match(/<link\b[^>]*rel\s*=\s*["']image_src["'][^>]*>/i) || [])[0];
  const href = ln && (ln.match(/\bhref\s*=\s*["']([^"']+)["']/i) || [])[1];
  return href ? absUrl(href, pageUrl) : null;
}

// ทางสำรอง: ภาพแรกในตัวบทความ (ไม่ใช่โลโก้/ไอคอน/โฆษณา)
function findArticleImage(html, pageUrl) {
  const start = html.search(/<article\b|itemprop=["']articleBody|id=["'](?:article|news|content)[\w-]*(?:body|view|txt|cont)/i);
  const zone = start >= 0 ? html.slice(start, start + 200000) : html;
  for (const tag of zone.match(/<img\b[^>]*>/gi) || []) {
    const src = (tag.match(/\b(?:data-src|data-original|src)\s*=\s*["']([^"']+)["']/i) || [])[1];
    if (!src || /^data:/.test(src)) continue;
    const w = +((tag.match(/\bwidth\s*=\s*["']?(\d+)/i) || [])[1] || 0);
    if (w && w < 200) continue;
    const u = absUrl(src, pageUrl);
    if (u && !BAD_IMG.test(u) && /\.(jpe?g|png|webp)(\?|$)|\/photo|\/image|\/img/i.test(u)) return u;
  }
  return null;
}

const BOILER = /무단\s*전재|재배포\s*금지|저작권자|copyright|ⓒ|©|기자\s*[\w.-]+@|@[\w-]+\.(?:co\.kr|com|kr)|구독|제보하기|좋아요|관련\s*기사|많이\s*본|광고|AI\s*학습/i;
const strip = h => decodeHtml(h.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h\d)>/gi, "\n").replace(/<[^>]+>/g, " ")).replace(/[ \t\u00a0]+/g, " ").replace(/\n\s*/g, "\n").trim();
const koreanRatio = s => (s.match(/[\uac00-\ud7a3]/g) || []).length / Math.max(1, s.replace(/\s/g, "").length);
function cleanLines(text) {
  return text.split("\n").map(l => l.trim()).filter(l => l.length >= 15 && !BOILER.test(l) && koreanRatio(l) > 0.3).join("\n");
}

// เนื้อข่าว: JSON-LD articleBody → ย่อหน้า <p> → กล่องเนื้อข่าวที่มีภาษาเกาหลีหนาแน่นที่สุด → คำโปรย
function extractArticleText(html) {
  const clean = html.replace(/<(script|style|noscript|iframe|svg|nav|header|footer|aside|figcaption|button|form)\b[\s\S]*?<\/\1>/gi, " ");
  for (const block of html.match(/<script[^>]+application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi) || []) {
    try {
      const j = JSON.parse(block.replace(/^<script[^>]*>|<\/script>$/gi, ""));
      const list = Array.isArray(j) ? j : j["@graph"] || [j];
      for (const o of list) if (o && typeof o.articleBody === "string" && o.articleBody.length > 200) return cleanLines(decodeHtml(o.articleBody)).slice(0, MAX_TEXT);
    } catch (e) { }
  }
  const ps = (clean.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || []).map(strip).filter(t => t.length >= 30);
  const fromP = cleanLines(ps.join("\n"));
  if (fromP.length > 300) return fromP.slice(0, MAX_TEXT);
  let best = "";
  const re = /<(?:div|section|article)\b[^>]*(?:id|class|itemprop)\s*=\s*["'][^"']*(?:article|news|content|body|txt|view|text)[^"']*["'][^>]*>/gi;
  let m;
  while ((m = re.exec(clean))) {
    const seg = cleanLines(strip(clean.slice(m.index, m.index + 30000)));
    if (seg.length > best.length) best = seg;
  }
  if (best.length > 200) return best.slice(0, MAX_TEXT);
  return fromP.slice(0, MAX_TEXT);
}

// คืน { url: ลิงก์จริง, image, text: เนื้อข่าวสำหรับให้ AI สรุป, description: คำโปรยของสำนักข่าว }
async function resolveArticle(link, { fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  let url = link;
  if (googleArticleId(link)) url = await decodeGoogleNews(link, { fetchImpl, timeoutMs });
  const page = await get(url, fetchImpl, timeoutMs);
  const finalUrl = page.url && !googleArticleId(page.url) ? page.url : url;
  const meta = metaMap(page.text);
  const description = decodeHtml(meta["og:description"] || meta["description"] || "").slice(0, 600);
  let text = extractArticleText(page.text);
  if (text.length < 200 && description.length > text.length) text = description;
  return { url: finalUrl, image: findOgImage(page.text, finalUrl) || findArticleImage(page.text, finalUrl), text, description };
}

module.exports = { resolveArticle, decodeGoogleNews, findOgImage, findArticleImage, extractArticleText, googleArticleId, decodePage };
