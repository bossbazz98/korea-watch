import { normalizeFeed, timestamp } from "./feed-data.js?v=20261109-feed2";
import { attachPullRefresh } from "./pull-refresh.js?v=20261109-glass1";
import { AlertAudio, SOUND_PRESETS } from "./audio.js";
import { writeSubscription } from "./subscriptions.js";
import { createReadingList } from "./reading-list.js";
import { openShareMenu } from "./share-news.js";
import { UI_COPY, CATEGORY_KO } from "./ui-copy.js";
import { attachLiquidTabs, attachDockViewport } from "./liquid-tabs.js";
// Korea Watch: หน้าแอป (อ่านข่าวจาก Firestore, ตั้งค่าแจ้งเตือน, ติดตั้งแอป)
const SDK = "/vendor/firebase/";
const CFG = self.KW_CONFIG || {};
const DAY = 864e5, KEEP = 30 * DAY;
const CATS = globalThis.KW_CATEGORIES;
const BK_CATS = ["korwar", "war", "disease"], BK_MAX = 10;
const DEFAULT_PUSH = { enabled: false, level: "critical", cats: ["korwar"], quietOn:false, quietFrom:22, quietTo:10, quietBypass:true };
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
T.ko = { ...T.en };
for (const key of ['th', 'en', 'ko']) Object.assign(T[key], UI_COPY[key]);
function uiIcon(name) {
  const paths = {
    home:'<path d="m3 10 9-7 9 7v11h-6v-7H9v7H3z"/>', bookmark:'<path d="M6 3h12v18l-6-4-6 4z"/>', back:'<path d="m14 5-7 7 7 7"/>',share:'<path d="M12 15V3m-4 4 4-4 4 4M7 10H4v11h16V10h-3"/>',chevron:'<path d="m9 5 7 7-7 7"/>',star:'<path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>',language:'<path d="M3 5h12M9 3v2M5 5c0 5 3 8 7 10M13 5c0 5-4 10-10 12m11 4 4-11 4 11m-6-4h4"/>',type:'<path d="M4 5h16M12 5v15m-4 0h8"/>',vibrate:'<rect x="8" y="3" width="8" height="18" rx="2"/><path d="m4 5-2 3 2 4-2 4 2 3m16-14 2 3-2 4 2 4-2 3"/>',pin:'<path d="M19 9c0 5-7 12-7 12S5 14 5 9a7 7 0 1 1 14 0z"/><circle cx="12" cy="9" r="2.4"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',trash:'<path d="M3 6h18M9 6V3h6v3m-10 0 1 15h12l1-15M10 10v7m4-7v7"/>',external:'<path d="M14 3h7v7m0-7L11 13M9 5H4v16h16v-6"/>',link:'<path d="m10 8 3-3a5 5 0 0 1 7 7l-3 3m-3 1-3 3a5 5 0 0 1-7-7l3-3m1 6 8-8"/>',image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 4 4 3-3 5 5"/>',

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
let themeMode = store.get('kw.theme', 'dark');
if (!['system', 'light', 'dark'].includes(themeMode)) themeMode = 'dark';
let tone = store.get('kw.alertTone', 'emergency');
if (!SOUND_PRESETS.includes(tone)) tone = 'emergency';
const savedVolume = store.get('kw.volume', 0.45);
let volume = typeof savedVolume === 'number' && Number.isFinite(savedVolume) ? Math.max(0, Math.min(1, savedVolume)) : 0.45;
const alertAudio = new AlertAudio();
alertAudio.onStateChange = playing => { if ($('p-stop')) $('p-stop').disabled = !playing; };
const colorScheme = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const dark = themeMode === 'dark' || (themeMode === 'system' && colorScheme.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = dark ? '#16181C' : '#f6f7f8';
  const iosStyle=document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if(iosStyle)iosStyle.content=dark?'black-translucent':'default';
}
colorScheme.addEventListener('change', applyTheme);
applyTheme();
let push = Object.assign({}, DEFAULT_PUSH, store.get("kw.push", {}));
push.level = "critical";
push.cats = globalThis.KW_CATEGORY_POLICY.migratePreferences(push.cats);
if (!push.cats.length) push.cats = [...DEFAULT_PUSH.cats];
if (store.get("kw.schema", 0) < 2) { push.cats = [...new Set([...(push.cats || []), ...(push.cats?.includes("war") ? ["korwar"] : [])])]; store.set("kw.push", push); store.set("kw.schema", 2); }
if (!["th", "en", "ko"].includes(lang)) lang = "th";
let currentView = 'home';
let vibration = store.get('kw.vibration', true) !== false;
let featured = store.get('kw.featured', BK_CATS);
featured = [...new Set((Array.isArray(featured) ? featured : BK_CATS).filter(key => CATS[key]))];
let fontScale = store.get('kw.fontScale', 1);
if (![.9, 1, 1.14].includes(fontScale)) fontScale = 1;
document.documentElement.style.setProperty('--font-scale', fontScale);
let region = store.get('kw.region', 'seoul-gyeonggi');
const readingList = createReadingList({ getItem:key => localStorage.getItem(key), setItem:(key,value) => localStorage.setItem(key,value) });
function haptic() { if (vibration) { try { navigator.vibrate?.(15); } catch {} } }
function categoryLabel(key) { return lang === 'ko' ? CATEGORY_KO[key] || CATS[key]?.th || '' : CATS[key]?.[lang] || ''; }
function headlineOf(n) { return lang === 'ko' && n.titleKo ? n.titleKo : L(n.title); }
function categoryBadges(n) { return cats(n).filter(c => CATS[c]).map(c => `<span class="chip">${esc(categoryLabel(c))}</span>`).join(''); }
let items = [], status = null, loaded = false, notReady = false;
let fb = null; // { app, fs, db }
let deepId = new URLSearchParams(location.search).get("id");
const seen = new Set(store.get("kw.seenUrgent", []));
const lastVisit = store.get("kw.lastVisit", 0); store.set("kw.lastVisit", Date.now());
let primed = lastVisit > 0;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

const L = value => globalThis.KW_NEWS_TEXT.pick(value, lang === 'ko' ? 'th' : lang) || t("translationPending");
const t = k => T[lang][k];
function ago(ms) { const s = (Date.now() - ms) / 1000; if (s < 90) return t("now"); if (s < 3600) return Math.round(s / 60) + " " + t("m"); if (s < 86400) return Math.round(s / 3600) + " " + t("h"); return Math.round(s / 86400) + " " + t("d") }
function kst(ms) { try { return new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : lang === 'ko' ? 'ko-KR' : 'en-GB', { timeZone: "Asia/Seoul", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(ms)) + " " + t("kst") } catch (e) { return new Date(ms).toLocaleString() } }
function ts(n) { return timestamp(n.publishedAt) }
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])) }
function safeUrl(u) { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : "" } catch (e) { return "" } }
function cats(n) { return Array.isArray(n.categories) ? n.categories : (n.category ? [n.category] : []) }
function visible() { const cut = Date.now() - KEEP; return items.filter(n => ts(n) >= cut && (n.translated === true || cats(n).includes("korwar"))).sort((a, b) => ts(b) - ts(a)) }
function picture(n, hero = false) {
  const url=safeUrl(n.image);
  return `<div class="${hero?'hero':'thumb'} news-image"><span class="photo-placeholder" aria-hidden="true"><img src="/icons/icon-192.png" alt=""></span>${url?`<img class="news-photo" src="${esc(url)}" alt="" loading="${hero?'eager':'lazy'}" decoding="async" referrerpolicy="no-referrer">`:''}</div>`;
}
document.addEventListener('error',event=>{if(event.target instanceof HTMLImageElement && event.target.classList.contains('news-photo'))event.target.remove()},true);
function setHTML(el, html) { if (el._h === html) return; const sl = el.scrollLeft; el.innerHTML = html; el._h = html; el.scrollLeft = sl }
function emptyMsg(def) {
  if (notReady) return t('setup');
  const waiting = cat === 'all' ? status?.hidden : status?.pendingByCategory?.[cat];
  return waiting > 0 ? t('categoryPending')(waiting) : def;
}

function newsCard(n,kind='card') {
  return `<button class="${kind} hero-card" data-id="${esc(n.id)}">${picture(n)}<div class="hero-copy"><div class="chips">${categoryBadges(n)}</div><h3>${esc(headlineOf(n))}</h3></div></button>`;
}

function renderStatic() {
  document.documentElement.lang = lang;
  $('nav-home-label').textContent=t('home');$('nav-saved-label').textContent=t('readingList');
  $('nav-home').setAttribute('aria-label',t('home'));$('nav-saved').setAttribute('aria-label',t('readingList'));
  updateAppChrome();
  renderRefreshState();
  $('home-top').setAttribute('aria-label', lang === 'th' ? 'กลับด้านบนสุด' : 'Back to top');
  $("settings").setAttribute("aria-label", t("settings")); $("settings-l").textContent = t("settings");
  $("install").hidden = isStandalone(); $("install-l").textContent = t("install"); $("install").setAttribute("aria-label", t("install"));
  $("t-bk").textContent = t("bk"); $("t-bksub").textContent = featured.length ? featured.map(categoryLabel).join(" · ") : t("chooseFeatured");
  $("t-topics").textContent = t("topics"); $("t-all").textContent = t("all"); $("t-30").textContent = t("d30"); $("t-foot").textContent = t("foot"); $("strip-k").textContent = t("urgent");
  $("offline").hidden = navigator.onLine !== false; $("offline").textContent = t("offline");
}
function render() {
  renderStatic();
  const all = visible();
  $("updated").textContent = status && (status.lastSuccessfulPublishAt || status.lastRun) ? t("upd")(ago(Date.parse(status.lastSuccessfulPublishAt || status.lastRun))) : (loaded ? t("count")(all.length) : t("loading"));
  const u = all.find(n => n.level === "critical" && Date.now() - ts(n) < 3 * DAY);
  $("strip").hidden = !u; if (u) { $("strip-t").textContent = L(u.title); $("strip-t").dataset.id = u.id }
  const queues=featured.map(key=>all.filter(n=>cats(n).includes(key))),bk=[],featuredIds=new Set();
  while(bk.length<BK_MAX&&queues.some(queue=>queue.length)) {
    for(const queue of queues){while(queue.length&&featuredIds.has(queue[0].id))queue.shift();const next=queue.shift();if(next){bk.push(next);featuredIds.add(next.id)}if(bk.length===BK_MAX)break}
  }
  setHTML($("bk"), bk.length ? bk.map(n => newsCard(n,'bkc')).join("")
    : `<div class="empty">${loaded ? emptyMsg(t("bknone")) : t("loading")}</div>`);
  setHTML($("dots"), bk.length > 1 ? bk.map(() => "<span></span>").join("") : "");
  updDots(); updHint();
  if (currentView === "saved") renderSaved();
  const counts = {}, crit = {}; all.forEach(n => cats(n).forEach(c => { counts[c] = (counts[c] || 0) + 1; if (n.level === "critical") crit[c] = 1 }));
  let tiles = `<button class="tile" data-cat="all" aria-pressed="${cat === "all"}"><span class="n">${all.length}</span><span class="l">${t("allcat")}</span></button>`;
  for (const k in CATS) tiles += `<button class="tile ${crit[k] ? "has-crit" : ""}" data-cat="${k}" aria-pressed="${cat === k}"><span class="n">${counts[k] || 0}</span><span class="l">${categoryLabel(k)}</span></button>`;
  const tl = $("tiles"); tl.style.setProperty("--cols", Math.ceil((Object.keys(CATS).length + 1) / 2)); setHTML(tl, tiles);
  const list = cat === "all" ? all : all.filter(n => cats(n).includes(cat));
  $("t-filter").textContent = cat === "all" ? (loaded ? t("count")(all.length) : "") : categoryLabel(cat);
  setHTML($("grid"), list.length ? list.map(n => newsCard(n)).join("")
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

/* Full-screen reader and three persistent app tabs. */
let lastFocus = null, currentArticle = null, closeShare = null, settingsReturnView = 'home';
const pageScroll = { home:0, saved:0 };
function updateAppChrome() {
  const overlay = !$('sheet').hidden, modal = overlay && $('panel').dataset.kind !== 'settings';
  $('home-page').hidden = currentView !== 'home'; $('home-header').hidden = currentView !== 'home';
  $('saved-page').hidden = currentView !== 'saved';
  $('home-page').inert = modal; $('home-header').inert = modal; $('saved-page').inert = modal;
  $('app-tabs').hidden = modal || currentView === 'settings';
  document.body.dataset.view = currentView;
  for (const [id,view] of [['nav-home','home'],['nav-saved','saved'],['settings','settings']]) {
    const selected=currentView===view;$(id).classList.toggle('active',selected);
    if(selected)$(id).setAttribute('aria-current','page');else $(id).removeAttribute('aria-current');
  }
  tabLens.sync();
}
function showSheet(html, kind = 'reader') {
  if ($('sheet').hidden) lastFocus = document.activeElement;
  alertAudio.stop();
  const panel=$('panel');panel.innerHTML=html;panel.dataset.kind=kind;$('sheet').dataset.kind=kind;
  const header=panel.querySelector(kind==='reader'?'.reader-top':'.bar'),footer=panel.querySelector(kind==='reader'?'.reader-actions':'.settings-footer');
  header?.remove();footer?.remove();
  const content=document.createElement('div');content.className='sheet-content';
  while(panel.firstChild)content.append(panel.firstChild);
  if(header)panel.append(header);panel.append(content);if(footer)panel.append(footer);
  const label=kind==='settings'?'sheet-title':kind==='reader'?'article-title':'info-title';
  panel.setAttribute('aria-labelledby',label);panel.setAttribute('role',kind==='settings'?'region':'dialog');
  if(kind==='settings')panel.removeAttribute('aria-modal');else panel.setAttribute('aria-modal','true');
  $('sheet').hidden=false;document.body.style.overflow='hidden';document.body.dataset.overlay=kind;
  updateAppChrome();
  if($('close')){$('close').className='icon-button glass';$('close').innerHTML=uiIcon('close');$('close').setAttribute('aria-label',t('close'));$('close').onclick=()=>closeSheet();$('close').focus({preventScroll:true})}
  else {panel.querySelector('h2')?.setAttribute('tabindex','-1');panel.querySelector('h2')?.focus({preventScroll:true})}
}
function closeSheet({restore=true}={}) {
  if(closeShare){closeShare();closeShare=null}$('panel').inert=false;
  alertAudio.stop();$('sheet').hidden=true;document.body.style.overflow='';delete document.body.dataset.overlay;
  settingsDraft=null;currentArticle=null;
  if(currentView==='settings')currentView=settingsReturnView;updateAppChrome();if(currentView==='saved')renderSaved();
  if(restore){try{if(lastFocus?.isConnected&&!lastFocus.closest('[hidden]'))lastFocus.focus({preventScroll:true});else $('nav-'+(currentView==='saved'?'saved':'home')).focus({preventScroll:true})}catch{}}
}
function navigate(view) {
  if(!['home','saved','settings'].includes(view))return;
  if(currentView===view&&$('sheet').hidden){if(view==='home')scrollHomeTop();return}
  if(view==='settings'&&currentView!=='settings')settingsReturnView=currentView;
  if(currentView!=='settings')pageScroll[currentView]=scrollY;
  if(!$('sheet').hidden)closeSheet({restore:false});currentView=view;
  if(view==='settings'){openSettings();return}
  updateAppChrome();if(view==='saved')renderSaved();
  window.scrollTo({top:pageScroll[view]||0,behavior:'instant'});
}
function bookmarkButton() {
  const selected=currentArticle&&readingList.has(currentArticle.id),button=$('reader-save');if(!button)return;
  button.classList.toggle('bookmarked',!!selected);button.setAttribute('aria-pressed',String(!!selected));button.setAttribute('aria-label',t(selected?'unbookmark':'bookmark'));
}
function openItem(id) {
  const n=items.find(x=>String(x.id)===String(id))||readingList.get(id);if(!n)return false;
  const paras=globalThis.KW_NEWS_TEXT.body(n.body,lang==='ko'?'th':lang);
  const links=(Array.isArray(n.links)&&n.links.length?n.links:(n.sourceUrl?[{label:n.source,url:n.sourceUrl}]:[])).filter(Boolean).map(l=>({label:l.label,url:safeUrl(l.url)})).filter(l=>l.url);
  const headline=headlineOf(n);
  showSheet(`<div class="reader-top"><div class="reader-sticky glass" aria-hidden="true"><span>${esc(headline)}</span><div class="read-progress"><i></i></div></div><button class="icon-button glass" id="close" aria-label="${t('close')}">${uiIcon('close')}</button></div>
    <div class="reader-hero">${picture(n,true)}</div><article class="article"><div class="chips">${categoryBadges(n)}</div><h1 id="article-title">${esc(headline)}</h1><div class="article-meta"><img class="mini-logo" src="/icons/icon-192.png" alt=""><span>${esc(n.source||'')} · ${kst(ts(n))}</span></div>${lang==='ko'?`<p class="content-language">${t('koreanContent')}</p>`:''}<div class="summary-box"><h2>${t('summary')}</h2><p>${esc(L(n.summary))}</p></div>${paras.length?`<div class="article-body body">${paras.map(p=>`<p>${esc(p)}</p>`).join('')}</div>`:''}<div class="src"><div class="k">${t('source')}</div>${n.titleKo?`<div class="ko">${t('orig')}: ${esc(n.titleKo)}</div>`:''}${links.map(l=>`<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label||t('open'))}${uiIcon('external')}</a>`).join('')}<p class="ko">${t('aiNote')}</p></div></article>
    <div class="reader-actions"><button class="back-wide glass" id="reader-back">${uiIcon('back')}${t('back')}</button><button class="icon-button glass" id="reader-save" aria-label="${t('bookmark')}">${uiIcon('bookmark')}</button><button class="icon-button glass" id="reader-share" aria-label="${t('share')}">${uiIcon('share')}</button></div>`,'reader');
  currentArticle=n;bookmarkButton();
  $('reader-back').onclick=()=>closeSheet();
  $('reader-save').onclick=()=>{try{if(readingList.has(n.id)){readingList.remove(n.id);toast(t('unbookmark'),1500)}else{readingList.save(n);haptic();toast(t('bookmarked'),1500,'bookmark')}bookmarkButton();if(currentView==='saved')renderSaved()}catch{toast(t('storageFailed'))}};
  $('reader-share').onclick=()=>{if(closeShare)return;$('panel').inert=true;closeShare=openShareMenu({article:n,title:headline,summary:L(n.summary),category:cats(n).filter(c=>CATS[c]).map(categoryLabel).join(' · '),icon:uiIcon,t,toast,onClose:()=>{$('panel').inert=false;closeShare=null;$('reader-share')?.focus({preventScroll:true})}})};
  const scroll=$('panel').querySelector('.sheet-content'),title=$('article-title'),sticky=$('panel').querySelector('.reader-sticky');
  let frame=0;const update=()=>{const past=title.getBoundingClientRect().bottom<scroll.getBoundingClientRect().top+70;$('panel').classList.toggle('is-scrolled',past);sticky.setAttribute('aria-hidden',String(!past));const range=scroll.scrollHeight-scroll.clientHeight;sticky.style.setProperty('--read',`${range>0?Math.min(100,scroll.scrollTop/range*100):0}%`)};
  scroll.addEventListener('scroll',()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(update)},{passive:true});update();
  return true;
}
function renderSaved() {
  const entries=readingList.all();$('saved-title').textContent=t('readingList');$('saved-count').textContent=t('count')(entries.length);
  setHTML($('saved-content'),entries.length?`<div class="saved-rows">${entries.map(({id,savedAt,article:n})=>`<div class="saved-item-wrap"><button class="delete-saved" data-delete="${esc(id)}" aria-label="${t('deleteSaved')}: ${esc(headlineOf(n))}">${uiIcon('trash')}${t('delete')}</button><button class="saved-row" data-id="${esc(id)}">${picture(n)}<span><span class="chips">${categoryBadges(n)}</span><h3>${esc(headlineOf(n))}</h3><span class="saved-at">${uiIcon('clock')}${t('savedAt')} ${Date.now()-savedAt<60000?t('minuteSaved'):kst(savedAt)}</span></span></button></div>`).join('')}</div>`:`<div class="empty-saved"><div class="empty-icon">${uiIcon('bookmark')}</div><h2>${t('emptySaved')}</h2><p>${t('emptySavedHint')}</p></div>`);
}
let swipeStart=null;
$('saved-content').addEventListener('touchstart',e=>{const row=e.target.closest('.saved-item-wrap');if(row&&e.touches.length===1)swipeStart={row,x:e.touches[0].clientX,y:e.touches[0].clientY};else swipeStart=null},{passive:true});
$('saved-content').addEventListener('touchmove',e=>{if(!swipeStart||e.touches.length!==1)return;const dx=e.touches[0].clientX-swipeStart.x,dy=e.touches[0].clientY-swipeStart.y;if(Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>10){swipeStart=null;return}if(Math.abs(dx)>24&&Math.abs(dx)>Math.abs(dy)*1.3){if(e.cancelable)e.preventDefault();swipeStart.row.classList.toggle('swiped',dx<0)}},{passive:false});
$('saved-content').addEventListener('touchend',()=>{swipeStart=null},{passive:true});$('saved-content').addEventListener('touchcancel',()=>{swipeStart=null},{passive:true});
$('saved-content').addEventListener('focusin',e=>{if(e.target.closest('.delete-saved'))e.target.closest('.saved-item-wrap').classList.add('swiped')});
$('sheet').addEventListener('click',e=>{if(e.target===$('sheet')&&$('panel').dataset.kind!=='settings')closeSheet()});
document.addEventListener('keydown',e=>{
  if($('share-layer'))return;
  if(e.key==='Tab'&&!$('sheet').hidden&&$('panel').dataset.kind!=='settings'){
    const f=[...$('panel').querySelectorAll('button:enabled,a[href],input:enabled,select:enabled')].filter(el=>el.offsetParent!==null);
    if(e.shiftKey&&document.activeElement===f[0]){e.preventDefault();f.at(-1)?.focus()}else if(!e.shiftKey&&document.activeElement===f.at(-1)){e.preventDefault();f[0]?.focus()}
  }
  if(e.key==='Escape'){if(!$('alert').hidden)$('alert').hidden=true;else if(!$('sheet').hidden)closeSheet()}
});
document.addEventListener('click',e=>{
  if(e.target.closest('#panel,#alert-box,#share-layer'))return;
  const remove=e.target.closest('[data-delete]');if(remove){try{readingList.remove(remove.dataset.delete);renderSaved();toast(t('unbookmark'),1500)}catch{toast(t('storageFailed'))}return}
  const row=e.target.closest('.saved-item-wrap');if(row?.classList.contains('swiped')){row.classList.remove('swiped');return}
  const card=e.target.closest('[data-id]');if(card){openItem(card.dataset.id);return}
  const tile=e.target.closest('[data-cat]');if(tile){cat=tile.dataset.cat;render()}
});
$('nav-home').onclick=()=>navigate('home');$('nav-saved').onclick=()=>navigate('saved');
const tabLens=attachLiquidTabs({bar:$('app-tabs'),onSelect:id=>navigate({'nav-home':'home','nav-saved':'saved',settings:'settings'}[id])});
attachDockViewport({isStandalone});

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
function toast(msg, duration=2000, mark='check') {
  const el=$('toast');clearTimeout(toast.t);clearTimeout(toast.hide);el.className='toast glass';el.innerHTML=uiIcon(mark)+`<span>${esc(msg)}</span>`;el.hidden=false;
  toast.t=setTimeout(()=>{el.classList.add('leaving');toast.hide=setTimeout(()=>el.hidden=true,150)},duration);
}
function unlock() { alertAudio.unlock().catch(() => {}); }
document.addEventListener('pointerdown', () => { if (sound) unlock(); }, { once: true });
async function playAlert(duration = 3) {
  if (!sound) return;
  try { await alertAudio.play({ preset: tone, volume, duration }); }
  catch { toast(t('audioError')); }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) alertAudio.stop(); });
function markSeen(id) { seen.add(id); store.set("kw.seenUrgent", [...seen].slice(-300)) }
function inAppEligible(n) {
  if (!push.enabled || !globalThis.KW_NEWS_POLICY.incident(n) || !cats(n).some(c => push.cats.includes(c))) return false;
  if (!push.quietOn || (push.quietBypass !== false && cats(n).includes('korwar'))) return true;
  const h = new Date(Date.now() + 9 * 3600e3).getUTCHours(), from = Number(push.quietFrom), to = Number(push.quietTo);
  if (!Number.isInteger(from) || !Number.isInteger(to) || from === to) return true;
  return !(from < to ? h >= from && h < to : h >= from || h < to);
}
function raiseAlert(n) {
  if (!inAppEligible(n)) return;
  markSeen(n.id);
  $("alert-box").innerHTML = `<div class="ak">${t("alertK")}</div><h2>${esc(headlineOf(n))}</h2><p style="margin:0;color:var(--fg-2)">${esc(L(n.summary))}</p>
    <div class="meta"><span>${esc(n.source || "")}</span><span>${kst(ts(n))}</span></div>
    <div class="row"><button class="btn primary" id="a-read">${t("read")}</button><button class="btn" id="a-ok">${t("ack")}</button></div>`;
  $("alert").hidden = false; $("a-ok").onclick = () => $("alert").hidden = true; $("a-read").onclick = () => { $("alert").hidden = true; openItem(n.id) }; $("a-ok").focus();
  if (sound && n.level === "critical") playAlert(4);
  try { vibration && navigator.vibrate && navigator.vibrate([400, 200, 400, 200, 600]) } catch (e) { }
}
function checkAlerts() {
  const fresh = visible().filter(n => inAppEligible(n) && n.level === "critical" && Date.now() - ts(n) < 2 * DAY && !seen.has(n.id));
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
  return writeSubscription({ fs: fb.fs, db: fb.db, uid, token, preferences, language: lang === 'ko' ? 'th' : lang, requestTest: extra.testRequested === true });
}
async function confirmNotifications() {
  const registration = await getSw();
  if (!registration?.showNotification) throw new Error('Local notification unavailable');
  await registration.showNotification('Korea Watch', {
    body: t('testLocal'), icon: '/icons/icon-192.png', badge: '/icons/badge-72.png', tag: 'subscription-confirmation', vibrate:vibration ? [200,80,200] : []
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
let settingsDraft = null, savingSettings = false;
const REGIONS = [
  ['seoul-gyeonggi','โซล / คยองกี','Seoul / Gyeonggi','서울 / 경기'],['incheon','อินชอน','Incheon','인천'],['busan','ปูซาน','Busan','부산'],['daegu','แทกู','Daegu','대구'],['daejeon','แทจอน','Daejeon','대전'],['gwangju','ควังจู','Gwangju','광주'],['ulsan','อุลซาน','Ulsan','울산'],['sejong','เซจง','Sejong','세종'],['gangwon','คังวอน','Gangwon','강원'],['chungbuk','ชุงชองเหนือ','North Chungcheong','충북'],['chungnam','ชุงชองใต้','South Chungcheong','충남'],['jeonbuk','ชอลลาเหนือ','North Jeolla','전북'],['jeonnam','ชอลลาใต้','South Jeolla','전남'],['gyeongbuk','คยองซังเหนือ','North Gyeongsang','경북'],['gyeongnam','คยองซังใต้','South Gyeongsang','경남'],['jeju','เชจู','Jeju','제주']
];
if(!REGIONS.some(entry=>entry[0]===region))region='seoul-gyeonggi';
const hourText = value => `${String(Number(value)).padStart(2,'0')}:00`;
function readSettingsDraft() {
  if(!$('p-on'))return;
  settingsDraft={enabled:$('p-on').checked,level:'critical',cats:[...document.querySelectorAll('input[name="pc"]:checked')].map(input=>input.value),quietOn:$('p-quiet').checked,quietFrom:Number($('p-from').value),quietTo:Number($('p-to').value),quietBypass:$('p-bypass').checked};
}
function featureChoices() {
  return Object.keys(CATS).map(key=>`<button type="button" class="topic-pick ${featured.includes(key)?'selected':''}" data-featured="${key}" aria-pressed="${featured.includes(key)}">${featured.includes(key)?`<span class="order-badge">${featured.indexOf(key)+1}</span>`:''}${esc(categoryLabel(key))}</button>`).join('');
}
function updateFeatureChoices() {
  setHTML($('featured-choices'),featureChoices());$('featured-count').textContent=`${featured.length}/12`;$('featured-all').textContent=t(featured.length===12?'clearAll':'selectAll');store.set('kw.featured',featured);render();
}
function updateQuietDuration() {
  const hours=(Number($('p-to').value)-Number($('p-from').value)+24)%24;
  $('quiet-duration-label').textContent=t('quietDuration')(hours);
}
function updateSettingsStatus() {
  if(!$('status-summary'))return;
  const active=push.enabled&&typeof Notification!=='undefined'&&Notification.permission==='granted';
  $('notification-status').classList.toggle('off',!active);
  $('status-title').innerHTML=`<i class="live-dot"></i>${t(active?'statusOn':'statusOff')}`;
  $('status-summary').textContent=`${t('nCrit')} · ${t('topicCount')(push.cats.length)} · ${push.quietOn?`${hourText(push.quietFrom??22)}–${hourText(push.quietTo??10)} KST`:t('quietNone')}`;
}
function openSettings(keepDraft=false) {
  if(keepDraft!==true||!settingsDraft)settingsDraft={...push,cats:[...push.cats]};
  currentView='settings';const draft=settingsDraft,scroll=keepDraft===true?$('panel').querySelector('.sheet-content')?.scrollTop||0:0;
  const [statusClass,statusMessage]=pushState(),blocked=statusClass==='warn';
  const toggle=(id,checked,label,disabled=false)=>`<label class="sw"><input type="checkbox" id="${id}" ${checked?'checked':''} ${disabled?'disabled':''} aria-label="${esc(label)}"><i></i></label>`;
  const row=(icon,label,right='',sub='')=>`<div class="setting-row"><span class="row-icon">${uiIcon(icon)}</span><span class="row-body">${label}${sub?`<small>${sub}</small>`:''}</span>${right}</div>`;
  const heading=(text,tools='')=>`<h3 class="group-title"><span>${text}</span>${tools}</h3>`;
  const tools=(id,count,allId)=>`<span class="group-tools"><span id="${id}">${count}/12</span><button type="button" id="${allId}">${t(count===12?'clearAll':'selectAll')}</button></span>`;
  const hourOptions=value=>Array.from({length:24},(_,hour)=>`<option value="${hour}" ${Number(value)===hour?'selected':''}>${hourText(hour)}</option>`).join('');
  showSheet(`<div class="bar settings-heading glass"><button type="button" id="settings-back" class="icon-button glass" aria-label="${t('back')}">${uiIcon('back')}</button><h2 id="sheet-title">${t('settings')}</h2></div>
    <section class="status-card glass ${push.enabled?'':'off'}" id="notification-status"><span class="status-kw glass"><img src="/icons/icon-192.png" alt="KW"></span><div class="status-copy"><strong id="status-title"></strong><small id="status-summary"></small></div></section><p class="settings-state" id="p-state" role="status" ${blocked?'':'hidden'}>${blocked?esc(statusMessage):''}</p>
    ${heading(t('appearance'))}<section class="settings-card">${row('language',t('language'))}<div class="setting-block"><div class="segments language-choices">${[['th','ไทย'],['en','English'],['ko','한국어']].map(([key,label])=>`<button type="button" id="l-${key}" class="${lang===key?'selected':''}" aria-pressed="${lang===key}">${label}</button>`).join('')}</div>${lang==='ko'?`<p class="hint">${t('koreanPush')}</p>`:''}</div>${row('system',t('theme'))}<div class="setting-block"><div class="segments theme-choices">${['system','light','dark'].map(mode=>`<label><input type="radio" name="theme" value="${mode}" ${themeMode===mode?'checked':''}>${uiIcon(mode)}<span>${t('theme_'+mode)}</span></label>`).join('')}</div></div>${row('type',t('fontSize'))}<div class="setting-block"><div class="segments font-buttons">${[.9,1,1.14].map((value,i)=>`<button type="button" data-font="${value}" class="${fontScale===value?'selected':''}" aria-label="${t('fontSize')} ${i+1}" aria-pressed="${fontScale===value}">${lang==='th'?'ก':lang==='ko'?'가':'A'}</button>`).join('')}</div><div class="font-example"><b>${t('fontPreviewTitle')}</b><p>${t('fontPreviewBody')}</p></div></div></section>
    ${heading(t('featured'),tools('featured-count',featured.length,'featured-all'))}<section class="settings-card">${row('star',t('featuredTopics'),'','') }<div class="topic-picks" id="featured-choices">${featureChoices()}</div></section><p class="hint">${t('featuredHint')}</p>
    ${heading(t('soundTitle'))}<section class="settings-card">${row('volume',t('soundTitle'),toggle('p-sound',sound,t('soundTitle')))}<fieldset id="sound-options" ${sound?'':'disabled'}>${row('bell',`<label class="sr-only" for="p-tone">${t('soundType')}</label><select id="p-tone">${SOUND_PRESETS.map(preset=>`<option value="${preset}" ${tone===preset?'selected':''}>${t('tone_'+preset)}</option>`).join('')}</select>`,`<button type="button" class="icon-button glass" id="p-preview" aria-label="${t('preview')}">${uiIcon('play')}</button><button type="button" class="icon-button glass" id="p-stop" aria-label="${t('stopSound')}" disabled>${uiIcon('stop')}</button>`)}<div class="volume-wrap"><div class="volume-top"><label for="p-volume">${t('volume')}</label><output id="volume-value" for="p-volume">${Math.round(volume*100)}%</output></div><div class="volume-line">${uiIcon('volume')}<input type="range" id="p-volume" min="0" max="100" step="1" value="${Math.round(volume*100)}" style="--volume:${Math.round(volume*100)}%" aria-label="${t('volume')}">${uiIcon('volume')}</div></div></fieldset>${row('vibrate',t('vibration'),toggle('p-vibration',vibration,t('vibration')),t('vibrationHint'))}</section><p class="hint">${t('soundShort')}</p>
    ${heading(t('notifications'))}<section class="settings-card">${row('bell',t('nOn'),toggle('p-on',draft.enabled,t('nOn'),blocked&&!draft.enabled))}<fieldset id="p-opts" ${blocked||!draft.enabled?'disabled':''}><div class="radio-list level-choices">${[['critical','nCrit','criticalHint'],['high','nHigh','highHint'],['all','allNews','allHint']].map(([value,label,hint])=>`<label class="radio-card ${value==='critical'?'selected':''} ${value!=='critical'?'unavailable':''}"><input type="radio" name="lv" value="${value}" ${value==='critical'?'checked':'disabled'}><span class="radio-indicator"></span><span><b>${value==='critical'?'<i class="live-dot"></i>':''}${t(label)}</b>${value==='critical'?'':`<small>${t(hint)}</small>`}</span></label>`).join('')}</div>${row('pin',`<label for="p-area">${t('area')}</label>`,`<select id="p-area" aria-label="${t('area')}">${REGIONS.map(entry=>`<option value="${entry[0]}" ${entry[0]===region?'selected':''}>${entry[lang==='ko'?3:lang==='en'?2:1]}</option>`).join('')}</select>`,t('areaHint'))}</fieldset></section><p class="hint policy-hint">${t('policyNote')}</p>
    ${heading(t('nCats'),tools('category-count',draft.cats.length,'topics-all'))}<section class="settings-card"><fieldset id="category-options" ${blocked||!draft.enabled?'disabled':''}><div class="topic-picks topic-choices">${Object.keys(CATS).map(key=>`<label class="topic-pick"><input type="checkbox" name="pc" value="${key}" ${draft.cats.includes(key)?'checked':''}><span>${esc(categoryLabel(key))}</span></label>`).join('')}</div></fieldset></section>
    ${heading(t('quietTitle')+(lang==='ko'?'':' (KST)'))}<section class="settings-card">${row('moon',t('quietTitle'),toggle('p-quiet',draft.quietOn,t('quietTitle')))}<fieldset id="quiet-options" ${draft.quietOn?'':'disabled'}><div class="time-grid"><label class="time-box"><span class="time-label">${uiIcon('moon')}${t('quietFrom')}</span><select id="p-from" aria-label="${t('quietFrom')}">${hourOptions(draft.quietFrom??22)}</select></label><label class="time-box"><span class="time-label">${uiIcon('light')}${t('quietTo')}</span><select id="p-to" aria-label="${t('quietTo')}">${hourOptions(draft.quietTo??10)}</select></label></div><div class="quiet-duration"><span id="quiet-duration-label"></span><i class="quiet-timeline"></i></div><label class="check-row"><input type="checkbox" id="p-bypass" ${draft.quietBypass!==false?'checked':''}><span><b><i class="live-dot"></i>${t('quietBypass')}</b><small>${t('quietNote')}</small></span></label></fieldset></section>
    <footer class="settings-footer settings-actions"><button type="button" class="glass" id="p-test" ${push.enabled&&!blocked?'':'disabled'}>${uiIcon('bell')}${t('test')}</button><button type="button" class="primary glass" id="p-save" ${savingSettings?'disabled':''}>${t(savingSettings?'saving':'saveAlerts')}</button></footer>`,'settings');
  const content=$('panel').querySelector('.sheet-content');content.scrollTop=scroll;
  updateQuietDuration();updateSettingsStatus();
  $('settings-back').onclick=()=>{navigate(settingsReturnView);$(currentView==='saved'?'nav-saved':'nav-home').focus({preventScroll:true})};
  for(const key of ['th','en','ko'])$('l-'+key).onclick=()=>changeLanguage(key);
  document.querySelectorAll('input[name="theme"]').forEach(input=>input.onchange=()=>{readSettingsDraft();themeMode=input.value;store.set('kw.theme',themeMode);applyTheme()});
  document.querySelectorAll('[data-font]').forEach(button=>button.onclick=()=>{fontScale=Number(button.dataset.font);document.documentElement.style.setProperty('--font-scale',fontScale);store.set('kw.fontScale',fontScale);document.querySelectorAll('[data-font]').forEach(b=>{const active=b===button;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active))})});
  $('featured-choices').onclick=e=>{const button=e.target.closest('[data-featured]');if(!button)return;const key=button.dataset.featured;featured=featured.includes(key)?featured.filter(c=>c!==key):[...featured,key];updateFeatureChoices()};
  $('featured-all').onclick=()=>{featured=featured.length===12?[]:Object.keys(CATS);updateFeatureChoices()};
  document.querySelectorAll('#p-on,input[name="lv"],input[name="pc"],#p-from,#p-to,#p-bypass').forEach(input=>input.addEventListener('change',()=>{readSettingsDraft();$('category-count').textContent=`${settingsDraft.cats.length}/12`;updateQuietDuration()}));
  $('p-on').addEventListener('change',()=>{$('p-on').disabled=blocked&&!$('p-on').checked;$('p-opts').disabled=blocked||!$('p-on').checked;$('category-options').disabled=blocked||!$('p-on').checked;$('topics-all').disabled=blocked||!$('p-on').checked});
  $('topics-all').disabled=blocked||!draft.enabled;$('topics-all').onclick=()=>{const all=[...document.querySelectorAll('input[name="pc"]')],select=!all.every(input=>input.checked);all.forEach(input=>input.checked=select);readSettingsDraft();$('category-count').textContent=`${settingsDraft.cats.length}/12`;$('topics-all').textContent=t(select?'clearAll':'selectAll')};
  $('p-area').onchange=()=>{region=$('p-area').value;store.set('kw.region',region)};
  $('p-quiet').onchange=()=>{$('quiet-options').disabled=!$('p-quiet').checked;readSettingsDraft()};
  $('p-sound').onchange=()=>{sound=$('p-sound').checked;store.set('kw.sound',sound);$('sound-options').disabled=!sound;alertAudio.stop();if(sound)unlock()};
  $('p-vibration').onchange=()=>{vibration=$('p-vibration').checked;store.set('kw.vibration',vibration);if(vibration)haptic()};
  $('p-tone').onchange=()=>{tone=$('p-tone').value;store.set('kw.alertTone',tone);alertAudio.stop()};
  $('p-volume').oninput=()=>{volume=Number($('p-volume').value)/100;store.set('kw.volume',volume);$('volume-value').textContent=`${Math.round(volume*100)}%`;$('p-volume').style.setProperty('--volume',`${Math.round(volume*100)}%`);alertAudio.setVolume(volume)};
  $('p-preview').onclick=()=>playAlert(tone==='airraid'?4.2:2.4);$('p-stop').onclick=()=>alertAudio.stop();$('p-save').onclick=savePush;
  $('p-test').onclick=async()=>{const button=$('p-test');button.disabled=true;try{const token=await getToken(),result=await saveSub(token,push,{testRequested:true});await confirmNotifications();toast(result.testQueued?t('tested'):result.testPending?t('testPending'):t('testCooldown'))}catch(error){toast(t('errSave')+(error.message||error))}finally{button.disabled=false}};
}
function changeLanguage(next) {
  readSettingsDraft();lang=next;store.set('kw.lang',lang);render();openSettings(true);$('l-'+next).focus({preventScroll:true});
}

async function savePush() {
  if(savingSettings)return;
  const enabled = $("p-on").checked;
  const level = "critical";
  const picked = [...document.querySelectorAll("input[name=pc]:checked")].map(i => i.value);
  if (enabled && !picked.length) { toast(t("pickCat")); return }
  const quietFrom = Number($('p-from').value), quietTo = Number($('p-to').value);
  const quietOn = $('p-quiet').checked, quietBypass = $('p-bypass').checked;
  const btn = $('p-save'); savingSettings = true; btn.disabled = true; btn.textContent = t('saving');
  try {
    // ขออนุญาตทันทีตอนกด (iPhone ต้องเรียกจากการกดปุ่มโดยตรง)
    if (enabled && Notification.permission !== "granted") {
      const r = await Notification.requestPermission();
      if (r !== "granted") throw new Error(t("sDenied"));
    }
    let token = store.get("kw.token", "");
    if (enabled) token = await getToken();
    if (![quietFrom, quietTo].every(h => Number.isInteger(h) && h >= 0 && h <= 23)) throw new Error("Hours must be 0–23");
    const next = { enabled, level, cats: picked.length ? picked : push.cats, quietOn, quietFrom, quietTo, quietBypass };
    const wasEnabled = push.enabled;
    const result = token ? await saveSub(token, next, { testRequested: enabled && !wasEnabled }) : null;
    push = next;
    store.set("kw.push", push); if (token) store.set("kw.token", token);
    settingsDraft = { ...push, cats:[...push.cats] }; render(); updateSettingsStatus();
    if ($('p-test')) $('p-test').disabled = !push.enabled;
    let confirmed = true;
    if (enabled && (!wasEnabled || result?.enabledNow)) {
      try { await confirmNotifications(); } catch { confirmed = false; }
    }
    toast(!confirmed ? t('localTestFailed') : t('settingsSaved'),2000);
  } catch (e) {
    toast(t("errSave") + (e.message || e));
  } finally {
    savingSettings = false;
    const current = $('p-save'); if(current){current.disabled=false;current.textContent=t('saveAlerts')}
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
$("settings").onclick = () => navigate("settings");

let refreshingNews = false, capsuleRefresh = false, refreshMessage = 'refreshHint';
function renderRefreshState() {
  const indicator = $('refresh-status');
  indicator.hidden = capsuleRefresh || (!refreshingNews && refreshMessage !== 'refreshFailed');
  indicator.textContent = t(refreshingNews ? 'refreshing' : refreshMessage);
}
function applyFeedSnapshot(snapshot) {
  const list = snapshot.exists() ? snapshot.data().items : [];
  const normalized = normalizeFeed(list);
  if (normalized.errors.length) console.warn('Feed records could not be displayed', normalized.errors);
  items = normalized.items;
  if (items.length) refreshMessage = 'refreshed';
  loaded = true; render(); openDeepLink();
  if (!snapshot.metadata?.fromCache) checkAlerts();
}
let recoveredStatus = null;
function recoverEmptyFeed() {
  const key = status?.lastSuccessfulPublishAt || status?.lastRun;
  const published = Object.values(status?.publishedByCategory || {}).some(count => count > 0);
  if (!key || key === recoveredStatus || visible().length || !published || refreshingNews) return;
  recoveredStatus = key;
  refreshNews();
}

function refreshFingerprint() {
  const content = value => typeof value === 'string' || Array.isArray(value) ? value : [value?.th ?? null, value?.en ?? null];
  return JSON.stringify(visible().map(n => [String(n.id), n.publishedAt, n.titleKo,
    content(n.title), content(n.summary), content(n.body), content(n.tips), [...cats(n)].sort(),
    n.level, n.image, n.source, n.sourceUrl, (n.links || []).map(link => [link.label,link.url])])
    .sort((a,b) => a[0].localeCompare(b[0])));
}

let refreshSequence = 0;
async function refreshNews({capsule = false} = {}) {
  if (refreshingNews) return {ok:false,busy:true};
  const before = refreshFingerprint(), sequence = ++refreshSequence;
  refreshingNews = true; capsuleRefresh = capsule;
  if (!capsule) renderRefreshState();
  try {
    if (!fb || navigator.onLine === false) throw new Error('News connection unavailable');
    // Status is optional: never hold the refreshed feed/spinner waiting for this read.
    Promise.resolve().then(() => fb.fs.getDocFromServer(fb.fs.doc(fb.db, 'meta/status')))
      .then(result => { if (sequence === refreshSequence) { status = result.exists() ? result.data() : null; render(); } })
      .catch(error => console.warn('refresh status',error.code || error.message));
    const snapshot = await fb.fs.getDocFromServer(fb.fs.doc(fb.db, 'meta/feed'));
    applyFeedSnapshot(snapshot); refreshMessage = 'refreshed';
    return {ok:true,changed:before !== refreshFingerprint()};
  } catch (error) {
    console.warn('refresh news', error.code || error.message); refreshMessage = 'refreshFailed';
    return {ok:false};
  } finally {
    refreshingNews = false;
    if (capsule) { capsuleRefresh = false; refreshMessage = 'refreshHint'; $('refresh-status').hidden = true; }
    else renderRefreshState();
  }
}
function scrollHomeTop() {
  const from=scrollY,start=performance.now();const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
  const tick=now=>{const p=Math.min(1,(now-start)/(reduced?100:350));scrollTo(0,from*Math.pow(1-p,3));if(p<1)requestAnimationFrame(tick)};requestAnimationFrame(tick);
}
$('home-top').onclick = scrollHomeTop;
attachPullRefresh({
  element:$('pull-refresh'), space:$('pull-space'), language:() => lang,
  threshold:80, onReady:haptic,
  canStart:() => currentView === 'home' && scrollY <= 1 && $('sheet').hidden && $('alert').hidden && !document.hidden,
  isBusy:() => refreshingNews,
  refresh:() => refreshNews({capsule:true}),
  onComplete:result => { if(result?.ok && result.changed) $('bk').querySelectorAll('.bkc').forEach(card => { card.classList.remove('fresh-entrance'); void card.offsetWidth; card.classList.add('fresh-entrance'); }); }
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
      try { applyFeedSnapshot(snap); recoverEmptyFeed(); }
      catch (error) { console.error(error); refreshMessage = 'refreshFailed'; renderRefreshState(); recoverEmptyFeed(); }
    }, err => { console.error(err); clearTimeout(timer); loaded = true; toast(t("slow")); render() });
    fs.onSnapshot(fs.doc(db, "meta/status"), s => { status = s.exists() ? s.data() : null; render(); recoverEmptyFeed() }, () => { });
    refreshToken();
  } catch (e) { console.error(e); clearTimeout(timer); loaded = true; toast(t("slow")); render() }
}
// กดแจ้งเตือนขณะแอปเปิดอยู่: service worker ส่ง id มาให้เปิดข่าว
navigator.serviceWorker?.addEventListener("message", e => { if (e.data?.type === "open" && e.data.id) { deepId = e.data.id; openDeepLink() } });
setInterval(render, 60000);
render();
boot();
