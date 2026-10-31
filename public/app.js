// Korea Watch: หน้าแอป (อ่านข่าวจาก Firestore, ตั้งค่าแจ้งเตือน, ติดตั้งแอป)
const SDK = "https://www.gstatic.com/firebasejs/12.19.0/";
const CFG = self.KW_CONFIG || {};
const DAY = 864e5, KEEP = 30 * DAY;
const CATS = {
  war: { th: "สงคราม/ความมั่นคง", en: "War & security" },
  food: { th: "อาหาร/กักตุน", en: "Food & stockpiling" },
  disease: { th: "โรคติดต่อ/ไวรัส", en: "Disease & viruses" },
  thai: { th: "คนไทยในเกาหลี", en: "Thais in Korea" },
  korea: { th: "ข่าวในเกาหลี", en: "Korea news" },
  oil: { th: "น้ำมัน", en: "Oil & fuel" },
  fx: { th: "ค่าเงิน", en: "Currency" },
  wage: { th: "ค่าแรงขั้นต่ำ", en: "Minimum wage" },
  foreign: { th: "แรงงานต่างชาติ", en: "Foreign workers" },
  law: { th: "กฎหมายแรงงาน", en: "Labor law" },
  president: { th: "ประธานาธิบดี", en: "President" }
};
const BK_CATS = ["war", "food", "disease"], BK_MAX = 10;
const DEFAULT_PUSH = { enabled: false, level: "critical", cats: ["war", "food", "disease", "thai"] };
const T = {
  th: { bk: "ข่าวด่วนล่าสุด", bksub: "สงคราม กักตุน โรคติดต่อ/ไวรัส", bknone: "ยังไม่มีข่าวด่วนในหมวดสงคราม กักตุน หรือโรคติดต่อภายใน 30 วัน",
    topics: "หมวดข่าว", all: "ข่าวทั้งหมด", d30: "ปัดดูหมวดเพิ่ม", allcat: "ทั้งหมด", bell: "แจ้งเตือน", bellOn: "แจ้งเตือนเปิด", install: "ติดตั้ง",
    urgent: "ด่วน", crit: "ด่วนมาก", high: "สำคัญ", isnew: "ใหม่", summary: "สรุปข่าว", full: "เนื้อหาข่าว", source: "แหล่งข่าว", orig: "หัวข้อต้นฉบับ", open: "เปิดข่าวต้นฉบับ",
    close: "ปิด", ack: "รับทราบ", read: "อ่านข่าวนี้", alertK: "แจ้งเตือนข่าวด่วน", count: n => n + " ข่าว", upd: t => "อัปเดต " + t, loading: "กำลังโหลดข่าว…",
    none: "ยังไม่มีข่าวในหมวดนี้ภายใน 30 วัน", setup: "ยังไม่ได้ตั้งค่า Firebase: ใส่ค่าในไฟล์ firebase-config.js ตามคู่มือ", slow: "เชื่อมต่อฐานข้อมูลข่าวไม่ได้ ลองดึงหน้าจอลงเพื่อโหลดใหม่",
    offline: "ออฟไลน์อยู่ กำลังแสดงข่าวที่โหลดไว้ล่าสุด", aiNote: "สรุปและแปลโดย AI อาจคลาดเคลื่อน ตรวจสอบกับข่าวต้นฉบับเสมอ",
    foot: "ค้นข่าวอัตโนมัติทุกประมาณ 5 นาทีจากสำนักข่าวเกาหลี เช่น KBS, MBC, SBS, YTN, 연합뉴스, JTBC แล้วสรุปและแปลเป็นภาษาไทยด้วย AI เก็บข่าวไว้ 30 วัน กดลิงก์ต้นฉบับเพื่อตรวจสอบเสมอ",
    now: "เมื่อสักครู่", m: "นาทีที่แล้ว", h: "ชม.ที่แล้ว", d: "วันที่แล้ว", kst: "เวลาเกาหลี",
    nH: "ตั้งค่าแจ้งเตือน", nOn: "รับแจ้งเตือนข่าวด่วน", nOnS: "เด้งเข้ามือถือแม้ปิดแอปอยู่", nLevel: "ระดับข่าวที่จะแจ้ง", nCrit: "ด่วนมากเท่านั้น", nHigh: "ด่วนมาก + สำคัญ",
    nCats: "หมวดที่จะแจ้ง", nSound: "เสียงไซเรนขณะเปิดแอป", nSoundS: "ดังเมื่อมีข่าวด่วนมากระหว่างที่เปิดแอปอยู่", save: "บันทึก", saving: "กำลังบันทึก…", test: "ส่งแจ้งเตือนทดสอบ",
    saved: "บันทึกการแจ้งเตือนแล้ว", savedOff: "ปิดแจ้งเตือนแล้ว", tested: "ขอแจ้งเตือนทดสอบแล้ว จะมาถึงภายใน 5–15 นาที", pickCat: "เลือกอย่างน้อย 1 หมวด",
    sOn: "เครื่องนี้รับแจ้งเตือนอยู่", sOff: "ยังไม่ได้เปิดรับแจ้งเตือน", sDenied: "เบราว์เซอร์บล็อกการแจ้งเตือนของแอปนี้ไว้ เปิดได้ที่การตั้งค่าเบราว์เซอร์หรือการตั้งค่าแอปในมือถือ",
    sIos: "บน iPhone ต้องเพิ่มแอปลงหน้าจอโฮมก่อน แล้วเปิดจากไอคอนนั้นจึงจะเปิดแจ้งเตือนได้ (iOS 16.4 ขึ้นไป)", sNo: "เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน ลองใช้ Chrome บน Android หรือ Safari บน iPhone",
    sNoKey: "ยังไม่ได้ใส่ vapidKey ในไฟล์ firebase-config.js", errSave: "บันทึกไม่สำเร็จ: ", installH: "ติดตั้ง Korea Watch",
    ios: "iPhone / iPad (Safari)", ios1: "เปิดเว็บนี้ใน Safari", ios2: "แตะปุ่มแชร์ (สี่เหลี่ยมมีลูกศรขึ้น)", ios3: "เลือก “เพิ่มไปยังหน้าจอโฮม” แล้วแตะ “เพิ่ม”", ios4: "เปิดแอปจากไอคอนบนหน้าจอโฮม แล้วกดปุ่มแจ้งเตือน",
    and: "Android (Chrome)", and1: "เปิดเว็บนี้ใน Chrome", and2: "แตะเมนู ⋮ มุมขวาบน", and3: "เลือก “ติดตั้งแอป” หรือ “เพิ่มลงในหน้าจอหลัก”", and4: "เปิดแอปแล้วกดปุ่มแจ้งเตือน",
    copy: "คัดลอกลิงก์", copied: "คัดลอกลิงก์แล้ว", installed: "ติดตั้งแอปแล้ว", pending: "กำลังแปล",
    testLocal: "เครื่องนี้แสดงแจ้งเตือนได้", testLocalB: "แจ้งเตือนทดสอบจากระบบจะตามมาภายใน 5–15 นาที" },
  en: { bk: "Breaking now", bksub: "War, stockpiling, disease & viruses", bknone: "No breaking stories on war, stockpiling or disease in the last 30 days",
    topics: "Topics", all: "All news", d30: "Swipe for more", allcat: "All", bell: "Alerts", bellOn: "Alerts on", install: "Install",
    urgent: "URGENT", crit: "Urgent", high: "Important", isnew: "New", summary: "Summary", full: "Full story", source: "Source", orig: "Original headline", open: "Open original article",
    close: "Close", ack: "Got it", read: "Read this story", alertK: "Breaking alert", count: n => n + " stories", upd: t => "Updated " + t, loading: "Loading news…",
    none: "No stories in this topic in the last 30 days", setup: "Firebase isn't set up yet: fill in firebase-config.js as described in the guide", slow: "Can't reach the news database. Pull down to reload.",
    offline: "You're offline. Showing the last loaded news.", aiNote: "Summarised and translated by AI and may contain errors. Always check the original.",
    foot: "News is gathered about every 5 minutes from Korean outlets such as KBS, MBC, SBS, YTN, Yonhap and JTBC, then summarised and translated by AI. Stories are kept for 30 days. Always check the original link.",
    now: "just now", m: "min ago", h: "h ago", d: "d ago", kst: "KST",
    nH: "Alert settings", nOn: "Breaking news alerts", nOnS: "Arrive on your phone even when the app is closed", nLevel: "Alert me about", nCrit: "Urgent only", nHigh: "Urgent + important",
    nCats: "Topics", nSound: "Siren while the app is open", nSoundS: "Plays for urgent news while you have the app open", save: "Save", saving: "Saving…", test: "Send a test alert",
    saved: "Alert settings saved", savedOff: "Alerts turned off", tested: "Test requested. It will arrive within 5–15 minutes", pickCat: "Pick at least one topic",
    sOn: "This device receives alerts", sOff: "Alerts are off", sDenied: "Your browser has blocked alerts for this app. Allow them in your browser or phone settings.",
    sIos: "On iPhone, add the app to your Home Screen first and open it from that icon to turn on alerts (iOS 16.4 or later).", sNo: "This browser can't show alerts. Use Chrome on Android or Safari on iPhone.",
    sNoKey: "vapidKey is missing in firebase-config.js", errSave: "Couldn't save: ", installH: "Install Korea Watch",
    ios: "iPhone / iPad (Safari)", ios1: "Open this site in Safari", ios2: "Tap Share (square with an up arrow)", ios3: "Choose “Add to Home Screen”, then tap Add", ios4: "Open the app from the Home Screen icon and tap Alerts",
    and: "Android (Chrome)", and1: "Open this site in Chrome", and2: "Tap the ⋮ menu, top right", and3: "Choose “Install app” or “Add to Home screen”", and4: "Open the app and tap Alerts",
    copy: "Copy link", copied: "Link copied", installed: "App installed", pending: "Translating",
    testLocal: "This device can show alerts", testLocalB: "A test alert from the server will follow within 5–15 minutes" }
};

const $ = id => document.getElementById(id);
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v) } catch (e) { return d } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) { } } };

let lang = store.get("kw.lang", "th"), sound = store.get("kw.sound", true), cat = "all";
let push = Object.assign({}, DEFAULT_PUSH, store.get("kw.push", {}));
let items = [], status = null, loaded = false, audioCtx = null, notReady = false;
let fb = null; // { app, fs, db }
let deepId = new URLSearchParams(location.search).get("id");
const seen = new Set(store.get("kw.seenUrgent", []));
const lastVisit = store.get("kw.lastVisit", 0); store.set("kw.lastVisit", Date.now());
let primed = lastVisit > 0;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

const L = o => o ? (typeof o === "string" ? o : (o[lang] || o.th || o.en || o.ko || "")) : "";
const t = k => T[lang][k];
function ago(ms) { const s = (Date.now() - ms) / 1000; if (s < 90) return t("now"); if (s < 3600) return Math.round(s / 60) + " " + t("m"); if (s < 86400) return Math.round(s / 3600) + " " + t("h"); return Math.round(s / 86400) + " " + t("d") }
function kst(ms) { try { return new Intl.DateTimeFormat(lang === "th" ? "th-TH" : "en-GB", { timeZone: "Asia/Seoul", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(ms)) + " " + t("kst") } catch (e) { return new Date(ms).toLocaleString() } }
function ts(n) { return Date.parse(n.publishedAt) || 0 }
function isNew(n) { const a = Date.parse(n.addedAt || n.publishedAt) || 0; return (lastVisit > 0 && a > lastVisit) || Date.now() - ts(n) < DAY }
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])) }
function safeUrl(u) { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : "" } catch (e) { return "" } }
function cats(n) { return Array.isArray(n.categories) ? n.categories : (n.category ? [n.category] : []) }
function lvl(n) { return n.level === "critical" ? "crit" : n.level === "high" ? "high" : "" }
function badges(n) {
  let b = ""; if (n.level === "critical") b += `<span class="badge crit">${t("crit")}</span>`; else if (n.level === "high") b += `<span class="badge high">${t("high")}</span>`;
  if (n.translated === false) b += `<span class="badge">${t("pending")}</span>`;
  if (isNew(n)) b += `<span class="badge new">${t("isnew")}</span>`; cats(n).forEach(c => { if (CATS[c]) b += `<span class="badge">${CATS[c][lang]}</span>` }); return b
}
function visible() { const cut = Date.now() - KEEP; return items.filter(n => ts(n) >= cut).sort((a, b) => ts(b) - ts(a)) }
function srcLine(n) { return `<div class="meta"><span>${esc(n.source || "")}</span><span>${ago(ts(n))}</span></div>` }
function setHTML(el, html) { if (el._h === html) return; const sl = el.scrollLeft; el.innerHTML = html; el._h = html; el.scrollLeft = sl }
function emptyMsg(def) { return notReady ? t("setup") : def }

function renderStatic() {
  document.documentElement.lang = lang;
  $("l-th").setAttribute("aria-pressed", String(lang === "th")); $("l-en").setAttribute("aria-pressed", String(lang === "en"));
  const on = push.enabled && "Notification" in window && Notification.permission === "granted";
  $("bell").setAttribute("aria-pressed", String(on)); $("bell-l").textContent = on ? t("bellOn") : t("bell"); $("bell").setAttribute("aria-label", t("nH"));
  $("install").hidden = isStandalone(); $("install-l").textContent = t("install"); $("install").setAttribute("aria-label", t("install"));
  $("t-bk").textContent = t("bk"); $("t-bksub").textContent = t("bksub");
  $("t-topics").textContent = t("topics"); $("t-all").textContent = t("all"); $("t-30").textContent = t("d30"); $("t-foot").textContent = t("foot"); $("strip-k").textContent = t("urgent");
  $("offline").hidden = navigator.onLine !== false; $("offline").textContent = t("offline");
}
function render() {
  renderStatic();
  const all = visible();
  $("updated").textContent = status && status.lastRun ? t("upd")(ago(Date.parse(status.lastRun))) : (loaded ? t("count")(all.length) : t("loading"));
  const u = all.find(n => n.level === "critical" && Date.now() - ts(n) < 3 * DAY);
  $("strip").hidden = !u; if (u) { $("strip-t").textContent = L(u.title); $("strip-t").dataset.id = u.id }
  const bk = all.filter(n => cats(n).some(c => BK_CATS.includes(c))).slice(0, BK_MAX);
  setHTML($("bk"), bk.length ? bk.map(n => `<button class="bkc ${lvl(n)}" data-id="${esc(n.id)}"><div class="meta">${badges(n)}</div><h3>${esc(L(n.title))}</h3><p>${esc(L(n.summary))}</p>${srcLine(n)}</button>`).join("")
    : `<div class="empty">${loaded ? emptyMsg(t("bknone")) : t("loading")}</div>`);
  setHTML($("dots"), bk.length > 1 ? bk.map(() => "<span></span>").join("") : "");
  updDots(); updHint();
  const counts = {}, crit = {}; all.forEach(n => cats(n).forEach(c => { counts[c] = (counts[c] || 0) + 1; if (n.level === "critical") crit[c] = 1 }));
  let tiles = `<button class="tile" data-cat="all" aria-pressed="${cat === "all"}"><span class="n">${all.length}</span><span class="l">${t("allcat")}</span></button>`;
  for (const k in CATS) tiles += `<button class="tile ${crit[k] ? "has-crit" : ""}" data-cat="${k}" aria-pressed="${cat === k}"><span class="n">${counts[k] || 0}</span><span class="l">${CATS[k][lang]}</span></button>`;
  const tl = $("tiles"); tl.style.setProperty("--cols", Math.ceil((Object.keys(CATS).length + 1) / 2)); setHTML(tl, tiles);
  const list = cat === "all" ? all : all.filter(n => cats(n).includes(cat));
  $("t-filter").textContent = cat === "all" ? (loaded ? t("count")(all.length) : "") : CATS[cat][lang];
  setHTML($("grid"), list.length ? list.map(n => `<button class="card ${lvl(n)}" data-id="${esc(n.id)}"><div class="meta">${badges(n)}</div><h3>${esc(L(n.title))}</h3><p>${esc(L(n.summary))}</p>${srcLine(n)}</button>`).join("")
    : (loaded ? `<div class="empty">${emptyMsg(t("none"))}</div>` : ""));
}

/* swipe helpers */
function updHint() { const el = $("tiles"); $("t-30").style.visibility = el.scrollWidth > el.clientWidth + 2 ? "visible" : "hidden" }
function step() { const el = $("bk"), c = el.querySelector(".bkc"); if (!c) return 0; return c.getBoundingClientRect().width + parseFloat(getComputedStyle(el).columnGap || 10) }
function bkIdx() { const s = step(); return s ? Math.round($("bk").scrollLeft / s) : 0 }
function updDots() {
  const el = $("bk"), i = bkIdx(), ds = $("dots").children, n = el.querySelectorAll(".bkc").length;
  for (let k = 0; k < ds.length; k++) ds[k].classList.toggle("on", k === Math.min(i, ds.length - 1));
  const max = el.scrollWidth - el.clientWidth - 2; $("bk-prev").disabled = el.scrollLeft <= 2; $("bk-next").disabled = n < 2 || el.scrollLeft >= max
}
let raf = 0; $("bk").addEventListener("scroll", () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(updDots) }, { passive: true });
function go(d) { $("bk").scrollTo({ left: (bkIdx() + d) * step(), behavior: reduce ? "auto" : "smooth" }) }
$("bk-prev").onclick = () => go(-1); $("bk-next").onclick = () => go(1);
addEventListener("resize", () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { updDots(); updHint() }) });
addEventListener("online", render); addEventListener("offline", render);

/* sheets */
let lastFocus = null;
function showSheet(html) { lastFocus = document.activeElement; $("panel").innerHTML = html; $("sheet").hidden = false; const c = $("close"); c.onclick = closeSheet; c.focus() }
function closeSheet() { $("sheet").hidden = true; try { lastFocus && lastFocus.focus && lastFocus.focus() } catch (e) { } }
function openItem(id) {
  const n = items.find(x => x.id === id); if (!n) return false;
  const body = n.body && typeof n.body === "object" && !Array.isArray(n.body) ? L(n.body) : n.body;
  const paras = (Array.isArray(body) ? body : String(body || "").split(/\n\n+/)).map(String).filter(Boolean);
  const links = (n.links && n.links.length ? n.links : (n.sourceUrl ? [{ label: n.source, url: n.sourceUrl }] : [])).map(l => ({ label: l.label, url: safeUrl(l.url) })).filter(l => l.url);
  showSheet(`<div class="bar"><div class="meta">${badges(n)}</div><button class="btn" id="close">${t("close")}</button></div>
    <h2>${esc(L(n.title))}</h2>
    <div class="meta"><span>${esc(n.source || "")}</span><span>${kst(ts(n))}</span></div>
    <div class="sum"><div class="k">${t("summary")}</div><p>${esc(L(n.summary))}</p></div>
    ${paras.length ? `<div class="body"><div class="k">${t("full")}</div>${paras.map(p => `<p>${esc(p)}</p>`).join("")}</div>` : ""}
    <div class="src"><div class="k">${t("source")}</div>
      ${n.titleKo ? `<div class="ko">${t("orig")}: ${esc(n.titleKo)}</div>` : ""}
      ${links.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label || t("open"))} ↗</a>`).join("")}
      <div class="ko">${t("aiNote")}</div></div>`);
  return true;
}
$("sheet").addEventListener("click", e => { if (e.target === $("sheet")) closeSheet() });
document.addEventListener("keydown", e => { if (e.key === "Escape") { if (!$("alert").hidden) $("alert").hidden = true; else if (!$("sheet").hidden) closeSheet() } });
document.addEventListener("click", e => {
  if (e.target.closest("#panel,#alert-box")) return;
  const c = e.target.closest("[data-id]"); if (c) { openItem(c.dataset.id); return }
  const tl = e.target.closest("[data-cat]"); if (tl) { cat = tl.dataset.cat; render() }
});
$("l-th").onclick = () => { lang = "th"; store.set("kw.lang", lang); render() };
$("l-en").onclick = () => { lang = "en"; store.set("kw.lang", lang); render() };

/* install */
let installEvt = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e });
addEventListener("appinstalled", () => { installEvt = null; toast(t("installed")); render() });
$("install").onclick = async () => {
  if (installEvt) { installEvt.prompt(); try { await installEvt.userChoice } catch (e) { } installEvt = null; render(); return }
  const first = isIOS ? "ios" : "and", second = isIOS ? "and" : "ios";
  const steps = p => `<div><div class="k">${t(p)}</div><ol class="steps">${[1, 2, 3, 4].map(i => `<li>${t(p + i)}</li>`).join("")}</ol></div>`;
  showSheet(`<div class="bar"><h2 style="font-size:22px">${t("installH")}</h2><button class="btn" id="close">${t("close")}</button></div>
    ${steps(first)}${steps(second)}
    <div class="linkbox"><code id="applink">${esc(location.origin)}</code><button class="btn sm" id="copy">${t("copy")}</button></div>`);
  $("copy").onclick = async () => { try { await navigator.clipboard.writeText(location.origin); toast(t("copied")) } catch (e) { const r = document.createRange(); r.selectNodeContents($("applink")); const s = getSelection(); s.removeAllRanges(); s.addRange(r) } };
};

/* alerts inside the app */
function toast(msg) { const el = $("toast"); el.textContent = msg; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, 2600) }
function unlock() { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume && audioCtx.resume() } catch (e) { } }
document.addEventListener("pointerdown", () => { if (sound) unlock() }, { once: true });
function siren(dur) {
  if (!audioCtx) return; try {
    const c = audioCtx, now = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type = "square";
    const len = dur || 3; for (let i = 0; i < len * 2; i++) o.frequency.setValueAtTime(i % 2 ? 660 : 880, now + i * .5);
    g.gain.setValueAtTime(.0001, now); g.gain.exponentialRampToValueAtTime(.18, now + .05); g.gain.setValueAtTime(.18, now + Math.max(.06, len - .1)); g.gain.exponentialRampToValueAtTime(.0001, now + len);
    o.connect(g).connect(c.destination); o.start(now); o.stop(now + len + .05)
  } catch (e) { }
}
function markSeen(id) { seen.add(id); store.set("kw.seenUrgent", [...seen].slice(-300)) }
function raiseAlert(n) {
  markSeen(n.id);
  $("alert-box").innerHTML = `<div class="ak">${t("alertK")}</div><h2>${esc(L(n.title))}</h2><p style="margin:0;color:var(--fg-2)">${esc(L(n.summary))}</p>
    <div class="meta"><span>${esc(n.source || "")}</span><span>${kst(ts(n))}</span></div>
    <div class="row"><button class="btn primary" id="a-read">${t("read")}</button><button class="btn" id="a-ok">${t("ack")}</button></div>`;
  $("alert").hidden = false; $("a-ok").onclick = () => $("alert").hidden = true; $("a-read").onclick = () => { $("alert").hidden = true; openItem(n.id) }; $("a-ok").focus();
  if (sound && n.level === "critical") { unlock(); siren(4) }
  try { navigator.vibrate && navigator.vibrate([400, 200, 400, 200, 600]) } catch (e) { }
}
function checkAlerts() {
  const fresh = visible().filter(n => n.level === "critical" && Date.now() - ts(n) < 2 * DAY && !seen.has(n.id));
  if (!primed) { fresh.forEach(n => markSeen(n.id)); primed = true; return }
  if (fresh.length && $("alert").hidden && $("sheet").hidden) raiseAlert(fresh[0]);
}

/* push notifications */
let swReg = null, msgMod = null, messaging = null;
async function getSw() {
  if (swReg) return swReg;
  if (!("serviceWorker" in navigator)) return null;
  swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  return swReg;
}
async function getMessagingMod() {
  if (messaging) return msgMod;
  if (!fb) return null;
  msgMod = await import(SDK + "firebase-messaging.js");
  if (!(await msgMod.isSupported())) { msgMod = null; return null }
  messaging = msgMod.getMessaging(fb.app);
  msgMod.onMessage(messaging, p => { // แจ้งเตือนที่มาตอนเปิดแอปอยู่
    const id = p?.data?.id, n = id && items.find(x => x.id === id);
    if (n) { if (!seen.has(n.id)) raiseAlert(n) } else if (p?.notification?.title) toast(p.notification.title);
  });
  return msgMod;
}
async function getToken() {
  const m = await getMessagingMod(); if (!m) throw new Error(t("sNo"));
  if (!CFG.vapidKey || /PASTE/.test(CFG.vapidKey)) throw new Error(t("sNoKey"));
  const reg = await getSw(); await navigator.serviceWorker.ready;
  return m.getToken(messaging, { vapidKey: CFG.vapidKey, serviceWorkerRegistration: reg });
}
// บันทึกการตั้งค่าแจ้งเตือนของเครื่องนี้ลงฐานข้อมูล (id = SHA-256 ของ token)
async function subId(token) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("");
}
async function saveSub(token, p, extra = {}) {
  const { fs, db } = fb;
  await fs.setDoc(fs.doc(db, "subscribers", await subId(token)), {
    token, cats: p.cats, level: p.level === "high" ? "high" : "critical", enabled: !!p.enabled,
    testRequested: false, lang, updatedAt: fs.serverTimestamp(), ...extra
  });
}
function pushState() {
  if (notReady) return ["warn", t("setup")];
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return isIOS && !isStandalone() ? ["warn", t("sIos")] : ["warn", t("sNo")];
  if (Notification.permission === "denied") return ["warn", t("sDenied")];
  if (push.enabled && Notification.permission === "granted") return ["ok", t("sOn")];
  return ["", t("sOff")];
}
function openSettings() {
  const [cls, msg] = pushState();
  const blocked = cls === "warn";
  showSheet(`<div class="bar"><h2 style="font-size:22px">${t("nH")}</h2><button class="btn" id="close">${t("close")}</button></div>
    <div class="state ${cls}" id="p-state">${esc(msg)}</div>
    <div>
      <div class="opt"><div class="ol"><b>${t("nOn")}</b><span>${t("nOnS")}</span></div><label class="sw"><input type="checkbox" id="p-on" ${push.enabled ? "checked" : ""} ${blocked ? "disabled" : ""} aria-label="${t("nOn")}"><i></i></label></div>
      <div class="opt"><div class="ol"><b>${t("nSound")}</b><span>${t("nSoundS")}</span></div><label class="sw"><input type="checkbox" id="p-sound" ${sound ? "checked" : ""} aria-label="${t("nSound")}"><i></i></label></div>
    </div>
    <fieldset id="p-opts" ${blocked ? "disabled" : ""}>
      <legend>${t("nLevel")}</legend>
      <div class="seg"><label><input type="radio" name="lv" value="critical" ${push.level !== "high" ? "checked" : ""}>${t("nCrit")}</label><label><input type="radio" name="lv" value="high" ${push.level === "high" ? "checked" : ""}>${t("nHigh")}</label></div>
    </fieldset>
    <fieldset ${blocked ? "disabled" : ""}>
      <legend>${t("nCats")}</legend>
      <div class="chips">${Object.keys(CATS).map(k => `<label><input type="checkbox" name="pc" value="${k}" ${push.cats.includes(k) ? "checked" : ""}>${CATS[k][lang]}</label>`).join("")}</div>
    </fieldset>
    <div class="row"><button class="btn primary" id="p-save">${t("save")}</button><button class="btn" id="p-test" ${push.enabled && !blocked ? "" : "disabled"}>${t("test")}</button></div>`);
  $("p-sound").onchange = e => { sound = e.target.checked; store.set("kw.sound", sound); if (sound) { unlock(); siren(0.8) } };
  $("p-save").onclick = savePush;
  $("p-test").onclick = async () => {
    const b = $("p-test"); b.disabled = true;
    try {
      const token = store.get("kw.token", "") || await getToken();
      const reg = await getSw();
      try { if (reg && reg.showNotification) await reg.showNotification("Korea Watch", { body: t("testLocal") + ". " + t("testLocalB"), icon: "/icons/icon-192.png", badge: "/icons/badge-72.png", tag: "local-test" }) } catch (e) { console.warn("local test", e) }
      await saveSub(token, push, { testRequested: true });
      toast(t("tested"));
    } catch (e) { toast(t("errSave") + (e.message || e)) }
    b.disabled = false;
  };
}
async function savePush() {
  const enabled = $("p-on").checked;
  const level = (document.querySelector("input[name=lv]:checked") || {}).value || "critical";
  const picked = [...document.querySelectorAll("input[name=pc]:checked")].map(i => i.value);
  if (enabled && !picked.length) { toast(t("pickCat")); return }
  const btn = $("p-save"); btn.disabled = true; btn.textContent = t("saving");
  try {
    // ขออนุญาตทันทีตอนกด (iPhone ต้องเรียกจากการกดปุ่มโดยตรง)
    if (enabled && Notification.permission !== "granted") {
      const r = await Notification.requestPermission();
      if (r !== "granted") throw new Error(t("sDenied"));
    }
    let token = store.get("kw.token", "");
    if (enabled) token = await getToken();
    const next = { enabled, level, cats: picked.length ? picked : push.cats };
    if (token) await saveSub(token, next);
    push = next;
    store.set("kw.push", push); if (token) store.set("kw.token", token);
    toast(enabled ? t("saved") : t("savedOff")); closeSheet(); render();
  } catch (e) {
    toast(t("errSave") + (e.message || e));
    btn.disabled = false; btn.textContent = t("save");
  }
}
// token อาจเปลี่ยนเองได้ ตรวจทุกครั้งที่เปิดแอปแล้วสมัครใหม่ถ้าเปลี่ยน
async function refreshToken() {
  try {
    if (!push.enabled || !("Notification" in window) || Notification.permission !== "granted") return;
    const token = await getToken();
    const old = store.get("kw.token", "");
    if (token && token !== old) {
      await saveSub(token, push);
      if (old) await saveSub(old, { ...push, enabled: false }).catch(() => { });
      store.set("kw.token", token);
    }
  } catch (e) { console.warn("token refresh", e) }
}
$("bell").onclick = openSettings;

/* data */
function openDeepLink() { if (deepId && openItem(deepId)) { deepId = null; history.replaceState(null, "", location.pathname) } }
async function boot() {
  getSw().catch(e => console.warn("sw", e));
  const c = CFG.firebase || {};
  if (!c.apiKey || /PASTE/.test(c.apiKey)) { notReady = true; loaded = true; render(); return }
  const timer = setTimeout(() => { if (!loaded) { loaded = true; toast(t("slow")); render() } }, 10000);
  try {
    const [{ initializeApp }, fs] = await Promise.all([import(SDK + "firebase-app.js"), import(SDK + "firebase-firestore.js")]);
    const app = initializeApp(c);
    let db; try { db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache() }) } catch (e) { db = fs.getFirestore(app) }
    fb = { app, fs, db };
    // ข่าวทั้งหมดอยู่ในเอกสารเดียว: เปิดแอป 1 ครั้ง = อ่านฐานข้อมูล 1 ครั้ง
    fs.onSnapshot(fs.doc(db, "meta/feed"), snap => {
      const list = snap.exists() ? snap.data().items : [];
      items = Array.isArray(list) ? list.filter(n => n && n.id) : [];
      if (!snap.metadata.fromCache) clearTimeout(timer);
      loaded = true; render(); openDeepLink(); if (!snap.metadata.fromCache) checkAlerts();
    }, err => { console.error(err); clearTimeout(timer); loaded = true; toast(t("slow")); render() });
    fs.onSnapshot(fs.doc(db, "meta/status"), s => { status = s.exists() ? s.data() : null; render() }, () => { });
    refreshToken();
  } catch (e) { console.error(e); clearTimeout(timer); loaded = true; toast(t("slow")); render() }
}
// กดแจ้งเตือนขณะแอปเปิดอยู่: service worker ส่ง id มาให้เปิดข่าว
navigator.serviceWorker?.addEventListener("message", e => { if (e.data?.type === "open" && e.data.id) { deepId = e.data.id; openDeepLink() } });
setInterval(render, 60000);
render();
boot();
