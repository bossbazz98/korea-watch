// หาภาพหลักของข่าว: ถอดลิงก์ Google News เป็นลิงก์จริงของสำนักข่าว แล้วอ่าน og:image จากหน้าข่าว
// ทุกขั้นตอนมีเวลารอจำกัด ถ้าล้มเหลว ข่าวยังแสดงได้ตามปกติ (แค่ไม่มีรูป)
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

async function get(url, fetchImpl, timeoutMs, opt = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), Math.max(1000, timeoutMs));
  try {
    const r = await fetchImpl(url, { redirect: "follow", ...opt, signal: ctl.signal, headers: { "User-Agent": UA, "Accept-Language": "ko,en;q=0.8", ...(opt.headers || {}) } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    // อ่านเป็น latin1 พอสำหรับหาแท็ก meta/URL (หน้าเว็บเกาหลีบางเว็บไม่ใช่ UTF-8)
    const buf = Buffer.from(await r.arrayBuffer());
    return { text: buf.subarray(0, 600000).toString("latin1"), url: r.url || url };
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

// ถอดลิงก์ Google News (ใช้ช่องทางภายในของ Google: อาจเปลี่ยนได้ จึงมีทางสำรองเสมอ)
async function decodeGoogleNews(link, { fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  const id = googleArticleId(link);
  if (!id) return link;
  let sg = null, ts = null;
  for (const page of [`https://news.google.com/articles/${id}`, `https://news.google.com/rss/articles/${id}`]) {
    try {
      const { text } = await get(page, fetchImpl, timeoutMs);
      sg = (text.match(/data-n-a-sg="([^"]+)"/) || [])[1];
      ts = (text.match(/data-n-a-ts="([^"]+)"/) || [])[1];
      if (sg && ts) break;
    } catch (e) { /* ลองหน้าถัดไป */ }
  }
  if (!sg || !ts) throw new Error("google params not found");
  const inner = `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${id}",${Number(ts)},"${sg}"]`;
  const body = "f.req=" + encodeURIComponent(JSON.stringify([[["Fbv4je", inner, null, "generic"]]]));
  const { text } = await get("https://news.google.com/_/DotsSplashUi/data/batchexecute", fetchImpl, timeoutMs,
    { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" } });
  const part = text.split("\n\n")[1];
  if (!part) throw new Error("google decode: unexpected reply");
  const outer = JSON.parse(part);
  const row = outer.find(x => Array.isArray(x) && x[1] === "Fbv4je") || outer[0];
  const url = JSON.parse(row[2])[1];
  if (!/^https?:\/\//.test(url)) throw new Error("google decode: no url");
  return url;
}

const decodeHtml = s => s.replace(/&amp;/g, "&").replace(/&#x2F;/gi, "/").replace(/&#47;/g, "/").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

// อ่านภาพหลักจากแท็ก meta ของหน้าข่าว
function findOgImage(html, pageUrl) {
  const metas = html.match(/<meta\b[^>]*>/gi) || [];
  const want = ["og:image:secure_url", "og:image", "og:image:url", "twitter:image", "twitter:image:src"];
  const found = {};
  for (const m of metas) {
    const key = (m.match(/\b(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i) || [])[1];
    const val = (m.match(/\bcontent\s*=\s*["']([^"']+)["']/i) || [])[1];
    if (key && val && want.includes(key.toLowerCase()) && !found[key.toLowerCase()]) found[key.toLowerCase()] = val.trim();
  }
  if (!Object.keys(found).length) {
    const ln = (html.match(/<link\b[^>]*rel\s*=\s*["']image_src["'][^>]*>/i) || [])[0];
    const href = ln && (ln.match(/\bhref\s*=\s*["']([^"']+)["']/i) || [])[1];
    if (href) found.link = href;
  }
  for (const k of [...want, "link"]) {
    if (!found[k]) continue;
    try {
      const abs = new URL(decodeHtml(found[k]), pageUrl);
      if (!/^https?:$/.test(abs.protocol)) continue;
      if (/logo|default|no[_-]?image|blank|placeholder/i.test(abs.pathname) && k !== want[0]) continue; // ข้ามโลโก้/ภาพแทน
      if (abs.protocol === "http:") abs.protocol = "https:"; // แอปเป็น https ภาพ http จะถูกบล็อก
      return abs.href;
    } catch (e) { }
  }
  return null;
}

// คืน { url: ลิงก์จริงของข่าว, image: ภาพหลัก|null }
async function resolveArticle(link, { fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  let url = link;
  if (googleArticleId(link)) url = await decodeGoogleNews(link, { fetchImpl, timeoutMs });
  const page = await get(url, fetchImpl, timeoutMs);
  return { url: page.url && !googleArticleId(page.url) ? page.url : url, image: findOgImage(page.text, page.url || url) };
}

module.exports = { resolveArticle, decodeGoogleNews, findOgImage, googleArticleId };
