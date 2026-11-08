import { attachPullRefresh } from "./pull-refresh.js";
import { AlertAudio, SOUND_PRESETS } from "./audio.js";
import { writeSubscription } from "./subscriptions.js";
// Korea Watch: หน้าแอป (อ่านข่าวจาก Firestore, ตั้งค่าแจ้งเตือน, ติดตั้งแอป)
const SDK = "/vendor/firebase/";
const CFG = self.KW_CONFIG || {};
const DAY = 864e5, KEEP = 30 * DAY;
const CATS = globalThis.KW_CATEGORIES;
const BK_CATS = ["korwar", "war", "disease"], BK_MAX = 10;
const DEFAULT_PUSH = { enabled: false, level: "critical", cats: ["korwar"] };
const T = {
  th: { bk: "ข่าวด่วนล่าสุด", bksub: "สงครามเกาหลี สงครามทั่วโลก โรคติดต่อ/ไวรัส", bknone: "ยังไม่มีข่าวด่วนในหมวดสงครามหรือโรคติดต่อภายใน 30 วัน",
    topics: "หมวดข่าว", all: "ข่าวทั้งหมด", d30: "ปัดดูหมวดเพิ่ม", allcat: "ทั้งหมด", bell: "แจ้งเตือน", bellOn: "แจ้งเตือนเปิด", install: "ติดตั้ง",
    urgent: "ด่วน", crit: "ด่วนมาก", high: "สำคัญ", isnew: "ใหม่", summary: "สรุปข่าว", full: "เนื้อหาข่าว", source: "แหล่งข่าว", orig: "หัวข้อต้นฉบับ", open: "เปิดข่าวต้นฉบับ",
    close: "ปิด", ack: "รับทราบ", read: "อ่านข่าวนี้", alertK: "แจ้งเตือนข่าวด่วน", count: n => n + " ข่าว", upd: t => "อัปเดต " + t, loading: "กำลังโหลดข่าว…",
    none: "ยังไม่มีข่าวในหมวดนี้ภายใน 30 วัน", setup: "ยังไม่ได้ตั้งค่า Firebase: ใส่ค่าในไฟล์ firebase-config.js ตามคู่มือ", slow: "เชื่อมต่อฐานข้อมูลข่าวไม่ได้ ลองดึงหน้าจอลงเพื่อโหลดใหม่",
    offline: "ออฟไลน์อยู่ กำลังแสดงข่าวที่โหลดไว้ล่าสุด", aiNote: "สรุปและแปลโดย AI อาจคลาดเคลื่อน ตรวจสอบกับข่าวต้นฉบับเสมอ",
    foot: "ค้นข่าวอัตโนมัติทุกประมาณ 5 นาทีจากสำนักข่าวเกาหลี เช่น KBS, MBC, SBS, YTN, 연합뉴스, JTBC แล้วสรุปและแปลเป็นภาษาไทยด้วย AI เก็บข่าวได้สูงสุด 30 วัน ภายใต้ขีดจำกัดจำนวนและขนาดข้อมูล กดลิงก์ต้นฉบับเพื่อตรวจสอบเสมอ",
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
  en: { bk: "Breaking now", bksub: "Korean Peninsula, world conflicts & disease", bknone: "No breaking stories on war or disease in the last 30 days",
    topics: "Topics", all: "All news", d30: "Swipe for more", allcat: "All", bell: "Alerts", bellOn: "Alerts on", install: "Install",
    urgent: "URGENT", crit: "Urgent", high: "Important", isnew: "New", summary: "Summary", full: "Full story", source: "Source", orig: "Original headline", open: "Open original article",
    close: "Close", ack: "Got it", read: "Read this story", alertK: "Breaking alert", count: n => n + " stories", upd: t => "Updated " + t, loading: "Loading news…",
    none: "No stories in this topic in the last 30 days", setup: "Firebase isn't set up yet: fill in firebase-config.js as described in the guide", slow: "Can't reach the news database. Pull down to reload.",
    offline: "You're offline. Showing the last loaded news.", aiNote: "Summarised and translated by AI and may contain errors. Always check the original.",
    foot: "News is gathered about every 5 minutes from Korean outlets such as KBS, MBC, SBS, YTN, Yonhap and JTBC, then summarised and translated by AI. Stories are kept for up to 30 days within feed size limits. Always check the original link.",
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

Object.assign(T.th, {
  categoryPending: count => `กำลังเตรียมข่าวหมวดนี้ ${count} ข่าว`, refresh: 'อัปเดตข่าว', refreshing: 'กำลังอัปเดตข่าว…', refreshed: 'อัปเดตข่าวล่าสุดแล้ว', refreshHint: 'ดึงลงจากด้านบนสุดเพื่ออัปเดตข่าว', refreshFailed: 'อัปเดตข่าวไม่ได้ โปรดตรวจการเชื่อมต่อแล้วลองอีกครั้ง', translationPending: 'กำลังแปลข่าวเป็นภาษาไทย', testPending: 'มีคำขอทดสอบจากระบบรอส่งอยู่แล้ว', testCooldown: 'ส่งทดสอบจากเครื่องแล้ว กรุณารอ 5 นาทีก่อนขอทดสอบจากระบบอีกครั้ง', localTestFailed: 'บันทึกแล้ว แต่แสดงแจ้งเตือนทดสอบบนเครื่องไม่ได้', settings: 'ตั้งค่า', settingsIntro: 'ปรับให้เป็นแบบที่คุณชอบ', devicePrefs: 'ภาษา ธีม และเสียง บันทึกให้อัตโนมัติบนเครื่องนี้',
  appearance: 'หน้าตาและภาษา', appearanceHint: 'อ่านข่าวได้สบาย ในสไตล์ของคุณ', language: 'ภาษาที่แสดง', theme: 'รูปแบบหน้าจอ',
  theme_system: 'ตามระบบ', theme_light: 'สว่าง', theme_dark: 'มืด', soundTitle: 'เสียงเตือนในแอป', soundHint: 'ใช้กับข่าวด่วนมากขณะเปิดแอป',
  soundType: 'เลือกเสียง', preview: 'ทดลองฟัง', stopSound: 'หยุดเสียง', volume: 'ระดับเสียง',
  tone_siren: 'ไซเรน · สลับเสียง', tone_airraid: 'หวอฉุกเฉิน · ขึ้นลงยาว', tone_emergency: 'ฉุกเฉิน · ไซเรนเร็ว', tone_pulse: 'แจ้งเตือน · สองจังหวะ', tone_bell: 'ระฆัง · นุ่มนวล', tone_chime: 'กระดิ่ง · สามโน้ต', tone_radar: 'เรดาร์ · ไล่ระดับ',
  backgroundSound: 'เสียงเมื่อปิดแอปใช้การตั้งค่าของอุปกรณ์ แถบนี้ปรับเฉพาะเสียงในแอป',
  notifications: 'การแจ้งเตือนข่าว', allNews: 'ทุกข่าวในหมวดที่เลือก', criticalHint: 'เฉพาะเกาหลีเหนือโจมตีเกาหลีใต้ ยิงหรือทดสอบขีปนาวุธ/จรวด เกาหลีใต้ถูกโจมตี ขีปนาวุธตกใกล้เกาหลีใต้ หรือทหารเกาหลีใต้เหยียบทุ่นระเบิดสังหาร จากสำนักข่าวเกาหลีใต้', highHint: 'รวมข่าวสำคัญที่ควรติดตาม', allHint: 'รับทุกข่าวใหม่ในหมวดที่คุณสนใจ',
  quietTitle: 'เวลาพัก', quietHint: 'งดแจ้งเตือนตามเวลาเกาหลี (KST)', quietFrom: 'เริ่มพัก', quietTo: 'กลับมาแจ้ง',
  quietBypass: 'ยกเว้นข่าวสงครามเกาหลีระดับด่วนมาก', saveAlerts: 'บันทึกการแจ้งเตือน', audioError: 'ยังเล่นเสียงไม่ได้ ลองแตะทดลองฟังอีกครั้ง'
});
Object.assign(T.en, {
  categoryPending: count => `${count} stories in this topic are being prepared`, refresh: 'Refresh news', refreshing: 'Refreshing news…', refreshed: 'News is up to date', refreshHint: 'Pull down at the top to refresh news', refreshFailed: 'Could not refresh. Check your connection and try again.', translationPending: 'English translation is pending', testPending: 'A server test is already queued.', testCooldown: 'Local test sent. Wait 5 minutes before requesting another server test.', localTestFailed: 'Saved, but the local notification could not be displayed.', settings: 'Settings', settingsIntro: 'Make it feel like yours.', devicePrefs: 'Language, theme and sound save automatically on this device',
  appearance: 'Appearance & language', appearanceHint: 'A comfortable way to read, day or night.', language: 'Display language', theme: 'Appearance',
  theme_system: 'System', theme_light: 'Light', theme_dark: 'Dark', soundTitle: 'In-app alert sound', soundHint: 'For urgent news while the app is open',
  soundType: 'Choose a sound', preview: 'Preview', stopSound: 'Stop sound', volume: 'Volume',
  tone_siren: 'Siren · alternating', tone_airraid: 'Air-raid siren · long wail', tone_emergency: 'Emergency · rapid siren', tone_pulse: 'Alert · double pulse', tone_bell: 'Bell · gentle', tone_chime: 'Chime · three notes', tone_radar: 'Radar · sweep',
  backgroundSound: 'Background push sounds follow your device settings. These controls affect in-app audio only.',
  notifications: 'News notifications', allNews: 'All selected news', criticalHint: 'Only North Korean attacks on South Korea, North Korean missile/rocket launches or tests, attacks on South Korea, missiles falling nearby, or South Korean soldiers stepping on antipersonnel mines. South Korean news outlets only.', highHint: 'Include important developments', allHint: 'Every new story in your selected topics',
  quietTitle: 'Quiet hours', quietHint: 'Pause notifications using Korean time (KST)', quietFrom: 'From', quietTo: 'Until',
  quietBypass: 'Allow urgent Korean Peninsula alerts', saveAlerts: 'Save notifications', audioError: 'Audio is unavailable. Try tapping Preview again.'
});
function uiIcon(name) {
  const paths = {
    close: '<path d="m6 6 12 12M18 6 6 18"/>', check: '<path d="m5 12 4 4L19 6"/>',
    system: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>',
    light: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
    dark: '<path d="M20 15A8.5 8.5 0 0 1 9 4a8.5 8.5 0 1 0 11 11Z"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 0-4h-1a2 2 0 0 1 0-4h5a4 4 0 0 0 4-4c0-3.3-4-6-9-6Z"/><path d="M7 9h.01M10 6h.01M15 6h.01"/>',
    volume: '<path d="m11 4-6 5H2v6h3l6 5V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
    play: '<path d="m9 5 11 7-11 7V5Z"/>', stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.01"/>', device: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M10 21h4"/>'
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name === 'moon' ? 'dark' : name] || paths.info}</svg>`;
}

const $ = id => document.getElementById(id);
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v) } catch (e) { return d } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) { } } };

let lang = store.get("kw.lang", "th"), sound = store.get("kw.sound", true), cat = "all";
let themeMode = store.get('kw.theme', 'system');
if (!['system', 'light', 'dark'].includes(themeMode)) themeMode = 'system';
let tone = store.get('kw.alertTone', 'airraid');
if (!SOUND_PRESETS.includes(tone)) tone = 'airraid';
const savedVolume = store.get('kw.volume', 0.45);
let volume = typeof savedVolume === 'number' && Number.isFinite(savedVolume) ? Math.max(0, Math.min(1, savedVolume)) : 0.45;
const alertAudio = new AlertAudio();
alertAudio.onStateChange = playing => { if ($('p-stop')) $('p-stop').disabled = !playing; };
const colorScheme = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  if (themeMode === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = themeMode;
  const dark = themeMode === 'dark' || (themeMode === 'system' && colorScheme.matches);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = dark ? '#15181b' : '#f6f7f8';
}
colorScheme.addEventListener('change', applyTheme);
applyTheme();
let push = Object.assign({}, DEFAULT_PUSH, store.get("kw.push", {}));
push.cats = globalThis.KW_CATEGORY_POLICY.migratePreferences(push.cats);
if (!push.cats.length) push.cats = [...DEFAULT_PUSH.cats];
if (store.get("kw.schema", 0) < 2) { push.cats = [...new Set([...(push.cats || []), ...(push.cats?.includes("war") ? ["korwar"] : [])])]; store.set("kw.push", push); store.set("kw.schema", 2); }
if (!["th", "en"].includes(lang)) lang = "th";
let items = [], status = null, loaded = false, notReady = false;
let fb = null; // { app, fs, db }
let deepId = new URLSearchParams(location.search).get("id");
const seen = new Set(store.get("kw.seenUrgent", []));
const lastVisit = store.get("kw.lastVisit", 0); store.set("kw.lastVisit", Date.now());
let primed = lastVisit > 0;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

const L = value => globalThis.KW_NEWS_TEXT.pick(value, lang) || t("translationPending");
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
function visible() { const cut = Date.now() - KEEP; return items.filter(n => ts(n) >= cut && (n.translated === true || cats(n).includes("korwar"))).sort((a, b) => ts(b) - ts(a)) }
function picture(n, hero = false) {
  const u = safeUrl(n.image); if (!u) return hero ? '<div class="hero"><div class="cap">Korea Watch</div></div>' : '';
  return `<div class="${hero ? 'hero' : 'thumb'}"><img src="${esc(u)}" alt="" loading="${hero ? 'eager' : 'lazy'}" decoding="async" referrerpolicy="no-referrer">${hero ? '<div class="cap">' + esc(n.source || '') + '</div>' : ''}</div>`;
}
function srcLine(n) { return `<div class="meta"><span>${esc(n.source || "")}</span><span>${ago(ts(n))}</span></div>` }
function setHTML(el, html) { if (el._h === html) return; const sl = el.scrollLeft; el.innerHTML = html; el._h = html; el.scrollLeft = sl }
function emptyMsg(def) {
  if (notReady) return t('setup');
  const waiting = cat === 'all' ? status?.hidden : status?.pendingByCategory?.[cat];
  return waiting > 0 ? t('categoryPending')(waiting) : def;
}

function renderStatic() {
  document.documentElement.lang = lang;
  renderRefreshState();
  $('home-top').setAttribute('aria-label', lang === 'th' ? 'กลับด้านบนสุด' : 'Back to top');
  $('pull-refresh').setAttribute('aria-label', t('refresh'));
  $("settings").setAttribute("aria-label", t("settings")); $("settings-l").textContent = t("settings");
  $("install").hidden = isStandalone(); $("install-l").textContent = t("install"); $("install").setAttribute("aria-label", t("install"));
  $("t-bk").textContent = t("bk"); $("t-bksub").textContent = t("bksub");
  $("t-topics").textContent = t("topics"); $("t-all").textContent = t("all"); $("t-30").textContent = t("d30"); $("t-foot").textContent = t("foot"); $("strip-k").textContent = t("urgent");
  $("offline").hidden = navigator.onLine !== false; $("offline").textContent = t("offline");
}
function render() {
  renderStatic();
  const all = visible();
  $("updated").textContent = status && (status.lastSuccessfulPublishAt || status.lastRun) ? t("upd")(ago(Date.parse(status.lastSuccessfulPublishAt || status.lastRun))) : (loaded ? t("count")(all.length) : t("loading"));
  const u = all.find(n => n.level === "critical" && Date.now() - ts(n) < 3 * DAY);
  $("strip").hidden = !u; if (u) { $("strip-t").textContent = L(u.title); $("strip-t").dataset.id = u.id }
  const bk = all.filter(n => cats(n).some(c => BK_CATS.includes(c))).slice(0, BK_MAX);
  setHTML($("bk"), bk.length ? bk.map(n => `<button class="bkc ${lvl(n)}" data-id="${esc(n.id)}">${picture(n)}<div class="meta">${badges(n)}</div><h3>${esc(L(n.title))}</h3><p>${esc(L(n.summary))}</p>${srcLine(n)}</button>`).join("")
    : `<div class="empty">${loaded ? emptyMsg(t("bknone")) : t("loading")}</div>`);
  setHTML($("dots"), bk.length > 1 ? bk.map(() => "<span></span>").join("") : "");
  updDots(); updHint();
  const counts = {}, crit = {}; all.forEach(n => cats(n).forEach(c => { counts[c] = (counts[c] || 0) + 1; if (n.level === "critical") crit[c] = 1 }));
  let tiles = `<button class="tile" data-cat="all" aria-pressed="${cat === "all"}"><span class="n">${all.length}</span><span class="l">${t("allcat")}</span></button>`;
  for (const k in CATS) tiles += `<button class="tile ${crit[k] ? "has-crit" : ""}" data-cat="${k}" aria-pressed="${cat === k}"><span class="n">${counts[k] || 0}</span><span class="l">${CATS[k][lang]}</span></button>`;
  const tl = $("tiles"); tl.style.setProperty("--cols", Math.ceil((Object.keys(CATS).length + 1) / 2)); setHTML(tl, tiles);
  const list = cat === "all" ? all : all.filter(n => cats(n).includes(cat));
  $("t-filter").textContent = cat === "all" ? (loaded ? t("count")(all.length) : "") : CATS[cat][lang];
  setHTML($("grid"), list.length ? list.map(n => `<button class="card ${lvl(n)}" data-id="${esc(n.id)}">${picture(n)}<div class="meta">${badges(n)}</div><h3>${esc(L(n.title))}</h3><p>${esc(L(n.summary))}</p>${srcLine(n)}</button>`).join("")
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
function showSheet(html, kind = 'reader') {
  if ($('sheet').hidden) lastFocus = document.activeElement;
  alertAudio.stop();
  const panel = $('panel'); panel.innerHTML = html; panel.dataset.kind = kind;
  const header = panel.querySelector('.bar'), footer = panel.querySelector('.settings-footer');
  header?.remove(); footer?.remove();
  const content = document.createElement('div'); content.className = 'sheet-content';
  while (panel.firstChild) content.append(panel.firstChild);
  if (header) panel.append(header);
  panel.append(content);
  if (footer) panel.append(footer);
  panel.setAttribute('aria-labelledby', kind === 'settings' ? 'sheet-title' : kind === 'reader' ? 'article-title' : 'info-title');
  $('sheet').hidden = false; document.body.style.overflow = 'hidden';
  $('close').onclick = closeSheet; $('close').focus({ preventScroll: true });
}
function closeSheet() {
  alertAudio.stop(); $('sheet').hidden = true; document.body.style.overflow = '';
  settingsDraft = null;
  try { lastFocus?.focus({ preventScroll: true }); } catch {}
}
function openItem(id) {
  const n = items.find(x => x.id === id); if (!n) return false;
  const paras = globalThis.KW_NEWS_TEXT.body(n.body, lang);
  const links = (n.links && n.links.length ? n.links : (n.sourceUrl ? [{ label: n.source, url: n.sourceUrl }] : [])).map(l => ({ label: l.label, url: safeUrl(l.url) })).filter(l => l.url);
  showSheet(`<div class="bar"><div class="meta">${badges(n)}</div><button class="btn" id="close">${t("close")}</button></div>
    <h2 id="article-title">${esc(L(n.title))}</h2>
    <div class="meta"><span>${esc(n.source || "")}</span><span>${kst(ts(n))}</span></div>
    ${picture(n, true)}
    <div class="sum"><div class="k">${t("summary")}</div><p>${esc(L(n.summary))}</p></div>
    ${paras.length ? `<div class="body"><div class="k">${t("full")}</div>${paras.map(p => `<p>${esc(p)}</p>`).join("")}</div>` : ""}
    <div class="src"><div class="k">${t("source")}</div>
      ${n.titleKo ? `<div class="ko">${t("orig")}: ${esc(n.titleKo)}</div>` : ""}
      ${links.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label || t("open"))} ↗</a>`).join("")}
      <div class="ko">${t("aiNote")}</div></div>`);
  return true;
}
$("sheet").addEventListener("click", e => { if (e.target === $("sheet")) closeSheet() });
document.addEventListener("keydown", e => { if (e.key === "Tab" && !$("sheet").hidden) { const f = [...$("panel").querySelectorAll('button:enabled,a[href],input:enabled,select:enabled')]; if (f.length && e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); } else if (f.length && !e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); } } if (e.key === "Escape") { if (!$("alert").hidden) $("alert").hidden = true; else if (!$("sheet").hidden) closeSheet() } });
document.addEventListener("click", e => {
  if (e.target.closest("#panel,#alert-box")) return;
  const c = e.target.closest("[data-id]"); if (c) { openItem(c.dataset.id); return }
  const tl = e.target.closest("[data-cat]"); if (tl) { cat = tl.dataset.cat; render() }
});

/* install */
let installEvt = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e });
addEventListener("appinstalled", () => { installEvt = null; toast(t("installed")); render() });
$("install").onclick = async () => {
  if (installEvt) { installEvt.prompt(); try { await installEvt.userChoice } catch (e) { } installEvt = null; render(); return }
  const first = isIOS ? "ios" : "and", second = isIOS ? "and" : "ios";
  const steps = p => `<div><div class="k">${t(p)}</div><ol class="steps">${[1, 2, 3, 4].map(i => `<li>${t(p + i)}</li>`).join("")}</ol></div>`;
  showSheet(`<div class="bar"><h2 id="info-title" style="font-size:22px">${t("installH")}</h2><button class="btn" id="close">${t("close")}</button></div>
    ${steps(first)}${steps(second)}
    <div class="linkbox"><code id="applink">${esc(location.origin)}</code><button class="btn sm" id="copy">${t("copy")}</button></div>`, 'info');
  $("copy").onclick = async () => { try { await navigator.clipboard.writeText(location.origin); toast(t("copied")) } catch (e) { const r = document.createRange(); r.selectNodeContents($("applink")); const s = getSelection(); s.removeAllRanges(); s.addRange(r) } };
};

/* alerts inside the app */
function toast(msg) { const el = $("toast"); el.textContent = msg; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, 2600) }
function unlock() { alertAudio.unlock().catch(() => {}); }
document.addEventListener('pointerdown', () => { if (sound) unlock(); }, { once: true });
async function playAlert(duration = 3) {
  if (!sound) return;
  try { await alertAudio.play({ preset: tone, volume, duration }); }
  catch { toast(t('audioError')); }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) alertAudio.stop(); });
function markSeen(id) { seen.add(id); store.set("kw.seenUrgent", [...seen].slice(-300)) }
function raiseAlert(n) {
  markSeen(n.id);
  $("alert-box").innerHTML = `<div class="ak">${t("alertK")}</div><h2>${esc(L(n.title))}</h2><p style="margin:0;color:var(--fg-2)">${esc(L(n.summary))}</p>
    <div class="meta"><span>${esc(n.source || "")}</span><span>${kst(ts(n))}</span></div>
    <div class="row"><button class="btn primary" id="a-read">${t("read")}</button><button class="btn" id="a-ok">${t("ack")}</button></div>`;
  $("alert").hidden = false; $("a-ok").onclick = () => $("alert").hidden = true; $("a-read").onclick = () => { $("alert").hidden = true; openItem(n.id) }; $("a-ok").focus();
  if (sound && n.level === "critical") playAlert(4);
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
  swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { updateViaCache: "none" });
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
    if (n && globalThis.KW_NEWS_POLICY.incident(n)) { if (!seen.has(n.id)) raiseAlert(n) } else if (p?.data?.level === 'test' && p?.notification?.title) toast(p.notification.title);
  });
  return msgMod;
}
async function getToken() {
  const m = await getMessagingMod(); if (!m) throw new Error(t("sNo"));
  if (!CFG.vapidKey || /PASTE/.test(CFG.vapidKey)) throw new Error(t("sNoKey"));
  const reg = await getSw(); await navigator.serviceWorker.ready;
  return m.getToken(messaging, { vapidKey: CFG.vapidKey, serviceWorkerRegistration: reg });
}
// Anonymous Authentication owns one subscription document per browser profile.
async function subscriptionId() {
  const module = await import(SDK + 'firebase-auth.js');
  const auth = module.getAuth(fb.app);
  await auth.authStateReady();
  const user = auth.currentUser || (await module.signInAnonymously(auth)).user;
  return user.uid;
}
async function saveSub(token, preferences, extra = {}) {
  const uid = await subscriptionId();
  return writeSubscription({ fs: fb.fs, db: fb.db, uid, token, preferences, language: lang, requestTest: extra.testRequested === true });
}
async function confirmNotifications() {
  const registration = await getSw();
  if (!registration?.showNotification) throw new Error('Local notification unavailable');
  await registration.showNotification('Korea Watch', {
    body: t('testLocal'), icon: '/icons/icon-192.png', badge: '/icons/badge-72.png', tag: 'subscription-confirmation'
  });
  await playAlert(3);
}
function pushState() {
  if (notReady) return ["warn", t("setup")];
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return isIOS && !isStandalone() ? ["warn", t("sIos")] : ["warn", t("sNo")];
  if (Notification.permission === "denied") return ["warn", t("sDenied")];
  if (push.enabled && Notification.permission === "granted") return ["ok", t("sOn")];
  return ["", t("sOff")];
}
let settingsDraft = null;
function readSettingsDraft() {
  if (!$('p-on')) return;
  settingsDraft = {
    enabled: $('p-on').checked,
    level: document.querySelector('input[name="lv"]:checked')?.value || 'critical',
    cats: [...document.querySelectorAll('input[name="pc"]:checked')].map(input => input.value),
    quietOn: $('p-quiet').checked,
    quietFrom: Number($('p-from').value), quietTo: Number($('p-to').value),
    quietBypass: $('p-bypass').checked
  };
}
function openSettings(keepDraft = false) {
  if (keepDraft !== true || !settingsDraft) settingsDraft = { ...push, cats: [...push.cats] };
  const draft = settingsDraft, scroll = keepDraft === true ? $('panel').querySelector('.sheet-content')?.scrollTop || 0 : 0;
  const [cls, msg] = pushState(), blocked = cls === 'warn';
  const toggle = (id, checked, label, disabled = false) => `<label class="sw"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} aria-label="${esc(label)}"><i></i></label>`;
  const hourOptions = value => Array.from({ length: 24 }, (_, hour) => `<option value="${hour}" ${Number(value) === hour ? 'selected' : ''}>${String(hour).padStart(2, '0')}:00</option>`).join('');
  showSheet(`<div class="bar settings-heading"><div><h2 id="sheet-title">${t('settings')}</h2></div><button class="close-button" id="close" aria-label="${t('close')}">${uiIcon('close')}</button></div>
    <div class="settings-intro"><p>${t('settingsIntro')}</p><span class="local-note">${uiIcon('device')}${t('devicePrefs')}</span></div>
    <section class="settings-card" aria-labelledby="appearance-title">
      <div class="section-heading"><span class="section-icon">${uiIcon('palette')}</span><div><h3 id="appearance-title">${t('appearance')}</h3><p>${t('appearanceHint')}</p></div></div>
      <fieldset><legend>${t('language')}</legend><div class="choice-grid language-choices"><button type="button" id="l-th" aria-pressed="${lang === 'th'}"><b>ไทย</b><span>ภาษาไทย</span></button><button type="button" id="l-en" aria-pressed="${lang === 'en'}"><b>EN</b><span>English</span></button></div></fieldset>
      <fieldset><legend>${t('theme')}</legend><div class="choice-grid theme-choices">${['system', 'light', 'dark'].map(mode => `<label><input type="radio" name="theme" value="${mode}" ${themeMode === mode ? 'checked' : ''}>${uiIcon(mode)}<span>${t('theme_' + mode)}</span></label>`).join('')}</div></fieldset>
    </section>
    <section class="settings-card" aria-labelledby="sound-title">
      <div class="section-heading"><span class="section-icon">${uiIcon('volume')}</span><div><h3 id="sound-title">${t('soundTitle')}</h3><p>${t('soundHint')}</p></div>${toggle('p-sound', sound, t('soundTitle'))}</div>
      <fieldset id="sound-options" ${sound ? '' : 'disabled'}><label class="field-label" for="p-tone">${t('soundType')}</label><div class="sound-picker"><select id="p-tone">${SOUND_PRESETS.map(preset => `<option value="${preset}" ${tone === preset ? 'selected' : ''}>${t('tone_' + preset)}</option>`).join('')}</select><button type="button" class="btn preview-button" id="p-preview">${uiIcon('play')}<span>${t('preview')}</span></button><button type="button" class="stop-button" id="p-stop" aria-label="${t('stopSound')}" disabled>${uiIcon('stop')}</button></div>
      <div class="volume-heading"><label for="p-volume">${t('volume')}</label><output id="volume-value" for="p-volume">${Math.round(volume * 100)}%</output></div><input type="range" id="p-volume" min="0" max="100" step="1" value="${Math.round(volume * 100)}" style="--volume:${Math.round(volume * 100)}%" aria-label="${t('volume')}"></fieldset>
      <p class="settings-hint">${uiIcon('info')}${t('backgroundSound')}</p>
    </section>
    <section class="settings-card" aria-labelledby="notifications-title">
      <div class="section-heading"><span class="section-icon">${uiIcon('bell')}</span><div><h3 id="notifications-title">${t('notifications')}</h3><p>${t('nOnS')}</p></div>${toggle('p-on', draft.enabled, t('nOn'), blocked)}</div>
      <div class="state ${cls}" id="p-state" role="status" ${blocked ? '' : 'hidden'}>${blocked ? esc(msg) : ''}</div>
      <fieldset id="p-opts" ${blocked ? 'disabled' : ''}><legend>${t('nLevel')}</legend><div class="level-choices">${[['critical', 'nCrit', 'criticalHint']].map(([value, label, hint]) => `<label><input type="radio" name="lv" value="${value}" checked><span class="radio-indicator"></span><span><b>${t(label)}</b><small>${t(hint)}</small></span></label>`).join('')}</div></fieldset>
      <fieldset ${blocked ? 'disabled' : ''}><legend>${t('nCats')}<span class="selection-count" id="category-count">${draft.cats.length}/${Object.keys(CATS).length}</span></legend><div class="topic-choices">${Object.keys(CATS).map(key => `<label><input type="checkbox" name="pc" value="${key}" ${draft.cats.includes(key) ? 'checked' : ''}><span class="topic-check">${uiIcon('check')}</span><span>${CATS[key][lang]}</span></label>`).join('')}</div></fieldset>
    </section>
    <section class="settings-card" aria-labelledby="quiet-title">
      <div class="section-heading"><span class="section-icon">${uiIcon('moon')}</span><div><h3 id="quiet-title">${t('quietTitle')}</h3><p>${t('quietHint')}</p></div>${toggle('p-quiet', draft.quietOn, t('quietTitle'))}</div>
      <fieldset id="quiet-options" ${draft.quietOn ? '' : 'disabled'}><div class="quiet-time"><label for="p-from">${t('quietFrom')}<select id="p-from">${hourOptions(draft.quietFrom ?? 22)}</select></label><span aria-hidden="true">→</span><label for="p-to">${t('quietTo')}<select id="p-to">${hourOptions(draft.quietTo ?? 7)}</select></label></div><label class="bypass-option"><input type="checkbox" id="p-bypass" ${draft.quietBypass !== false ? 'checked' : ''}><span>${t('quietBypass')}</span></label></fieldset>
    </section>
    <p id="push-result" class="delivery-result" role="status"></p>
    <footer class="settings-footer"><button type="button" class="btn primary" id="p-save">${t('saveAlerts')}</button><button type="button" class="btn test-button" id="p-test" ${push.enabled && !blocked ? '' : 'disabled'}>${t('test')}</button></footer>`, 'settings');
  $('panel').querySelector('.sheet-content').scrollTop = scroll;
  $('l-th').onclick = () => changeLanguage('th');
  $('l-en').onclick = () => changeLanguage('en');
  document.querySelectorAll('input[name="theme"]').forEach(input => { input.onchange = () => { readSettingsDraft(); themeMode = input.value; store.set('kw.theme', themeMode); applyTheme(); }; });
  document.querySelectorAll('#p-on,input[name="lv"],input[name="pc"],#p-from,#p-to,#p-bypass').forEach(input => { input.addEventListener('change', () => { readSettingsDraft(); $('category-count').textContent = `${settingsDraft.cats.length}/${Object.keys(CATS).length}`; }); });
  $('p-quiet').onchange = () => { $('quiet-options').disabled = !$('p-quiet').checked; readSettingsDraft(); };
  $('p-sound').onchange = () => { sound = $('p-sound').checked; store.set('kw.sound', sound); $('sound-options').disabled = !sound; alertAudio.stop(); if (sound) unlock(); };
  $('p-tone').onchange = () => { tone = $('p-tone').value; store.set('kw.alertTone', tone); alertAudio.stop(); };
  $('p-volume').oninput = () => { volume = Number($('p-volume').value) / 100; store.set('kw.volume', volume); $('volume-value').textContent = `${Math.round(volume * 100)}%`; $('p-volume').style.setProperty('--volume', `${Math.round(volume * 100)}%`); alertAudio.setVolume(volume); };
  $('p-preview').onclick = () => playAlert(tone === 'airraid' ? 4.2 : 2.4);
  $('p-stop').onclick = () => alertAudio.stop();
  $('p-save').onclick = savePush;
  $('p-test').onclick = async () => {
    const button = $('p-test'); button.disabled = true;
    try {
      const token = await getToken();
      const result = await saveSub(token, push, { testRequested: true });
      await confirmNotifications();
      toast(result.testQueued ? t('tested') : result.testPending ? t('testPending') : t('testCooldown'));
    } catch (error) { toast(t('errSave') + (error.message || error)); }
    button.disabled = false;
  };
}
function changeLanguage(next) {
  readSettingsDraft(); lang = next; store.set('kw.lang', lang); render(); openSettings(true);
  $(next === 'th' ? 'l-th' : 'l-en').focus({ preventScroll: true });
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
    const quietFrom = Number($("p-from").value), quietTo = Number($("p-to").value);
    if (![quietFrom, quietTo].every(h => Number.isInteger(h) && h >= 0 && h <= 23)) throw new Error("Hours must be 0–23");
    const next = { enabled, level, cats: picked.length ? picked : push.cats, quietOn: $("p-quiet").checked, quietFrom, quietTo, quietBypass: $("p-bypass").checked };
    const wasEnabled = push.enabled;
    const result = token ? await saveSub(token, next, { testRequested: enabled && !wasEnabled }) : null;
    push = next;
    store.set("kw.push", push); if (token) store.set("kw.token", token);
    closeSheet(); render();
    let confirmed = true;
    if (enabled && (!wasEnabled || result?.enabledNow)) {
      try { await confirmNotifications(); } catch { confirmed = false; }
    }
    toast(!confirmed ? t('localTestFailed') : result?.testQueued ? t('tested') : enabled ? t('saved') : t('savedOff'));
  } catch (e) {
    toast(t("errSave") + (e.message || e));
    btn.disabled = false; btn.textContent = t("saveAlerts");
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
      // The authenticated document is updated in place when FCM rotates the token.
      store.set("kw.token", token);
    }
  } catch (e) { console.warn("token refresh", e) }
}
$("settings").onclick = () => openSettings();

let refreshingNews = false, refreshMessage = 'refreshHint', lastAutoRefresh = 0;
function renderRefreshState() {
  if (!$('refresh-news')) return;
  $('refresh-news').disabled = refreshingNews;
  $('refresh-news').setAttribute('aria-busy', String(refreshingNews));
  $('refresh-news').closest('section').setAttribute('aria-label', t('refresh'));
  $('refresh-label').textContent = t(refreshingNews ? 'refreshing' : 'refresh');
  $('refresh-status').textContent = t(refreshingNews ? 'refreshing' : refreshMessage);
}
function applyFeedSnapshot(snapshot) {
  const list = snapshot.exists() ? snapshot.data().items : [];
  items = Array.isArray(list) ? list.filter(item => item?.id).map(item => globalThis.KW_NEWS_POLICY.apply({ ...item, categories:globalThis.KW_CATEGORY_POLICY.classify(item,item.categories || []), translated: item.translated === true && globalThis.KW_NEWS_TEXT.completeThai(item) })) : [];
  loaded = true; render(); openDeepLink();
  if (!snapshot.metadata?.fromCache) checkAlerts();
}
async function refreshNews(reason = 'manual') {
  if (refreshingNews || (reason === 'scroll' && Date.now() - lastAutoRefresh < 30000)) return;
  lastAutoRefresh = Date.now();
  refreshingNews = true; renderRefreshState();
  try {
    if (!fb || navigator.onLine === false) throw new Error('News connection unavailable');
    const [feedResult, statusResult] = await Promise.allSettled([
      fb.fs.getDocFromServer(fb.fs.doc(fb.db, 'meta/feed')),
      fb.fs.getDocFromServer(fb.fs.doc(fb.db, 'meta/status'))
    ]);
    if (feedResult.status === 'rejected') throw feedResult.reason;
    if (statusResult.status === 'fulfilled') status = statusResult.value.exists() ? statusResult.value.data() : null;
    applyFeedSnapshot(feedResult.value); refreshMessage = 'refreshed';
  } catch (error) { console.warn('refresh news', error.code || error.message); refreshMessage = 'refreshFailed'; }
  finally { refreshingNews = false; renderRefreshState(); }
}
let previousScrollY = scrollY, bottomRefreshArmed = true;
addEventListener('scroll', () => {
  const current = scrollY, distance = document.documentElement.scrollHeight - innerHeight - current;
  if (distance > 160) bottomRefreshArmed = true;
  if (current > previousScrollY && distance <= 60 && bottomRefreshArmed && $('sheet').hidden && !document.hidden) {
    bottomRefreshArmed = false; refreshNews('scroll');
  }
  previousScrollY = current;
}, { passive: true });
$('refresh-news').onclick = () => refreshNews();
$('home-top').onclick = () => window.scrollTo({top:0, left:0, behavior:'instant'});
attachPullRefresh({
  element:$('pull-refresh'),
  canStart:() => scrollY <= 0 && $('sheet').hidden && $('alert').hidden && !document.hidden,
  isBusy:() => refreshingNews,
  refresh:() => refreshNews('pull')
});

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
    // Live listeners incur reads when feed/status documents change.
    fs.onSnapshot(fs.doc(db, "meta/feed"), snap => {
      if (!snap.metadata.fromCache) clearTimeout(timer);
      applyFeedSnapshot(snap);
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
