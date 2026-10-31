// แปลและสรุปข่าวด้วย Gemini API (แผนฟรีของ Google AI Studio)
// แปลทีละชุดเล็ก (5 ข่าว) ปิดโหมดคิดนาน และกู้คำตอบที่ถูกตัดกลางทางได้
const { CATS, CAT_KEYS } = require("../feeds");

const SYSTEM = `You are the news editor of "Korea Watch", an app for Thai people living in South Korea.
You receive Korean news items (headline plus a short RSS snippet). For each item return JSON.
Rules:
- Use ONLY facts in the given headline and snippet. Never add names, numbers, dates, places or causes that are not in the input. If the input is thin, write less.
- "relevant": false if the item does not really fit any listed category or is entertainment, sports, celebrity gossip, ads or opinion columns.
- "categories": keep only keys from this list that truly apply: ${CAT_KEYS.map(k => `${k} (${CATS[k].th})`).join(", ")}.
- "level": "critical" only for news that needs immediate attention from people in Korea: military attack, missile launch or air-raid alert affecting Korea, a declared outbreak or new dangerous virus spreading in Korea, panic buying or shortages of daily goods, disasters or emergency alerts, or serious incidents involving Thai nationals. "high" for important developments in those categories or major policy changes affecting foreign workers. Otherwise "normal".
- "title" and "summary" in natural Thai ("th") and English ("en"). summary: 1-2 short sentences.
- "body_th": 1-2 short Thai paragraphs (array of strings) explaining the news for a Thai reader, using only the given facts.
- Keep it brief. Answer immediately.
Reply with ONLY a JSON array, one object per input item, same "i":
[{"i":0,"relevant":true,"categories":["war"],"level":"high","title":{"th":"","en":""},"summary":{"th":"","en":""},"body_th":[""]}]`;

// Flash-Lite ก่อน: เร็ว โควตาฟรีเยอะ คนใช้น้อย / Flash ตัวเต็มเป็นตัวสำรอง
const DEFAULT_MODELS = ["gemini-flash-lite-latest", "gemini-2.5-flash-lite", "gemini-flash-latest", "gemini-2.5-flash"];
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const noThinkingCfg = new Set(); // รุ่นที่ไม่รับการตั้งค่า thinking

// ข้อผิดพลาดชั่วคราว (โควตาเต็ม / ระบบยุ่ง): ไม่นับเป็นการแปลล้มเหลว รอแปลรอบหน้า
class QuotaError extends Error { constructor(m, code = 429) { super(m); this.code = code; this.transient = true } }

// อ่าน JSON array; ถ้าคำตอบถูกตัดกลางทาง เก็บเฉพาะ object ที่ครบ
function parseItems(text) {
  const s = String(text).replace(/```json|```/g, "");
  const a = s.indexOf("[");
  if (a < 0) throw new Error("no JSON array in model reply");
  const b = s.lastIndexOf("]");
  if (b > a) { try { return { items: JSON.parse(s.slice(a, b + 1)), partial: false } } catch (e) { } }
  const items = [];
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let k = a + 1; k < s.length; k++) {
    const c = s[k];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === "{") { if (depth === 0) start = k; depth++; }
    else if (c === "}") { depth--; if (depth === 0 && start >= 0) { try { items.push(JSON.parse(s.slice(start, k + 1))) } catch (e) { } start = -1; } }
  }
  if (!items.length) throw new Error("model reply was cut off before any item finished");
  return { items, partial: true };
}

const str = v => (typeof v === "string" ? v.trim() : "");
const pair = o => ({ th: str(o?.th), en: str(o?.en) });
const paras = v => (Array.isArray(v) ? v.map(str).filter(Boolean) : str(v) ? [str(v)] : []);

function thinkingFor(model) {
  if (noThinkingCfg.has(model)) return null;
  return /2\.5/.test(model) ? { thinkingBudget: 0 } : { thinkingLevel: "low" };
}

async function callGemini(model, body, apiKey, fetchImpl, timeoutMs) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": apiKey }, body: JSON.stringify(body), signal: ctl.signal
    });
    const data = await r.json().catch(() => ({}));
    return { status: r.status, ok: r.ok, data };
  } catch (e) {
    return { status: 503, ok: false, data: { error: { message: (e.name === "AbortError" ? "timeout" : "network: " + (e.message || e)) } } };
  } finally { clearTimeout(timer); }
}

async function translate(items, { apiKey, models = DEFAULT_MODELS, fetchImpl = fetch, log = console, waitMs = 2000, timeoutMs = 60000, deadline = Infinity }) {
  if (!items.length) return { results: [], model: null, partial: false };
  const input = items.map((n, i) => ({ i, headline: n.titleKo, snippet: n.snippet, source: n.source, guessedCategories: n.cats }));
  let last = "", busy = [], quotaOnly = true;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      // ห้ามเกินเวลาที่เหลือของรอบ เพื่อให้บันทึกผลทันก่อน GitHub ตัดงาน
      const left = deadline - Date.now();
      if (left < 5000) { busy.push("time budget"); quotaOnly = false; last = last || "time budget reached"; break; }
      const generationConfig = { responseMimeType: "application/json", temperature: 0.2, maxOutputTokens: 8192 };
      const th = thinkingFor(model); if (th) generationConfig.thinkingConfig = th;
      const body = { systemInstruction: { parts: [{ text: SYSTEM }] }, contents: [{ role: "user", parts: [{ text: JSON.stringify(input) }] }], generationConfig };
      const { status, ok, data } = await callGemini(model, body, apiKey, fetchImpl, Math.min(timeoutMs, left - 2000));
      const msg = data?.error?.message || "";
      // รุ่นนี้ไม่รับการตั้งค่า thinking: ลองรุ่นเดิมอีกครั้งแบบไม่ตั้งค่า
      // รุ่นนี้ปฏิเสธคำขอที่มีการตั้งค่า thinking (ข้อความอาจเขียนต่างกัน): ลองใหม่แบบไม่ตั้งค่า
      if (status === 400 && th) { noThinkingCfg.add(model); log.warn(`model ${model} rejected thinking config, retrying without`); continue; }
      if (RETRYABLE.has(status) || /overloaded|high demand|unavailable/i.test(msg)) {
        if (status !== 429) quotaOnly = false;
        busy.push(`${model} ${status}${/timeout/.test(msg) ? " timeout" : ""}`); last = msg;
        log.warn(`model ${model} busy (${status}), trying next`);
        if (waitMs && deadline - Date.now() > waitMs + 5000) await sleep(waitMs);
        break;
      }
      if (status === 404 || (status === 400 && /not found|not supported/i.test(msg))) { log.warn(`model ${model} unavailable, trying next`); last = msg; break; }
      if (!ok) throw new Error(`Gemini ${status} (${model}): ${msg || "request failed"}`.slice(0, 280));
      const cand = data?.candidates?.[0];
      const reply = (cand?.content?.parts || []).filter(p => !p.thought).map(p => p.text || "").join("");
      if (!reply) throw new Error(`Gemini empty reply (${model}, ${cand?.finishReason || data?.promptFeedback?.blockReason || "unknown"})`);
      const { items: arr, partial } = parseItems(reply);
      const results = items.map(() => null);
      for (const o of arr) {
        const i = Number(o?.i);
        if (!Number.isInteger(i) || i < 0 || i >= items.length) continue;
        const cats = (Array.isArray(o.categories) ? o.categories : []).filter(c => CAT_KEYS.includes(c));
        const title = pair(o.title), summary = pair(o.summary);
        results[i] = {
          relevant: o.relevant !== false && cats.length > 0 && !!title.th,
          categories: cats, level: ["critical", "high"].includes(o.level) ? o.level : "normal",
          title, summary, body: { th: paras(o.body_th ?? o.body?.th) }
        };
      }
      if (partial) log.warn(`model ${model} reply cut off (${cand?.finishReason}); kept ${results.filter(Boolean).length}/${items.length}`);
      return { results, model, partial };
    }
  }
  if (busy.length) {
    const what = quotaOnly ? "quota" : "busy";
    throw new QuotaError(`Gemini ${what} (${busy.join(", ")}): ${last}`.slice(0, 280), quotaOnly ? 429 : 503);
  }
  throw new Error("No Gemini model available: " + last.slice(0, 200));
}

module.exports = { translate, parseItems, QuotaError, DEFAULT_MODELS };
