// แปลและสรุปข่าวด้วย AI หลายเจ้า: Groq (เร็ว โควตาฟรีเยอะ) เป็นตัวหลัก แล้วสำรองด้วย Gemini
// ถ้าเจ้าไหนยุ่ง/โควตาเต็ม/ตอบช้า จะสลับไปตัวถัดไปเอง และไม่นับเป็นการแปลล้มเหลว
const { CATS, CAT_KEYS } = require("../feeds");

const SYSTEM = `You are the news editor of "Korea Watch", an app for Thai people living in South Korea.
You receive Korean news items (headline plus a short RSS snippet). For each item return JSON.
Rules:
- Use ONLY facts in the given headline and snippet. Never add names, numbers, dates, places or causes that are not in the input. If the input is thin, write less.
- "relevant": false if the item does not really fit any listed category or is entertainment, sports, celebrity gossip, ads or opinion columns.
- "categories": keep only keys from this list that truly apply: ${CAT_KEYS.map(k => `${k} (${CATS[k].th})`).join(", ")}.
- "level": "critical" only for news that needs immediate attention from people in Korea: military attack, missile launch or air-raid alert affecting Korea, a declared outbreak or new dangerous virus spreading in Korea, panic buying or shortages of daily goods, disasters or emergency alerts, or serious incidents involving Thai nationals. "high" for important developments in those categories or major policy changes affecting foreign workers. Otherwise "normal".
- "title" and "summary" in natural Thai ("th", written in Thai script) and English ("en"). summary: 1-2 short sentences.
- "body_th": 1-2 short Thai paragraphs (array of strings) explaining the news for a Thai reader, using only the given facts.
- Keep it brief. Answer immediately.
Reply with ONLY this JSON object, one entry per input item, same "i":
{"items":[{"i":0,"relevant":true,"categories":["war"],"level":"high","title":{"th":"","en":""},"summary":{"th":"","en":""},"body_th":[""]}]}`;

const SYSTEM_TITLES = `Translate Korean news headlines for a news app read by Thai people in South Korea.
For each input item give a natural, concise Thai headline ("th", in Thai script) and English headline ("en").
Keep names, numbers and places exactly as in the original. Do not add information. Answer immediately.
Reply with ONLY this JSON object, one entry per input item, same "i":
{"items":[{"i":0,"th":"","en":""}]}`;

// ลำดับรุ่น: Groq ก่อน (เร็วมาก) แล้ว Gemini เป็นตัวสำรอง
const GROQ_MODELS = ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "openai/gpt-oss-20b"];
const DEFAULT_MODELS = ["gemini-flash-lite-latest", "gemini-2.5-flash-lite", "gemini-flash-latest", "gemini-2.5-flash"];
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const plain = new Set(); // รุ่นที่ไม่รับพารามิเตอร์เสริม (thinking / reasoning / json mode)

// ข้อผิดพลาดชั่วคราว (โควตาเต็ม / ระบบยุ่ง): ไม่นับเป็นการแปลล้มเหลว รอแปลรอบหน้า
class QuotaError extends Error { constructor(m, code = 429) { super(m); this.code = code; this.transient = true } }

const str = v => (typeof v === "string" ? v.trim() : "");
// ข้อความภาษาไทยต้องมีตัวอักษรไทยจริง (บางครั้ง AI ใส่ภาษาอังกฤษในช่องภาษาไทย)
const hasThai = s => /[\u0E00-\u0E7F]/.test(s || "");
const pair = o => ({ th: str(o?.th), en: str(o?.en) });
const paras = v => (Array.isArray(v) ? v.map(str).filter(Boolean) : str(v) ? [str(v)] : []);

// อ่าน JSON (array หรือ {"items":[...]}) ถ้าคำตอบถูกตัดกลางทาง เก็บเฉพาะรายการที่ครบ
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
    else if (c === "]" && depth === 0) break;
  }
  if (!items.length) throw new Error("model reply was cut off before any item finished");
  return { items, partial: true };
}

async function post(url, headers, body, fetchImpl, timeoutMs) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), Math.max(1000, timeoutMs));
  try {
    const r = await fetchImpl(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: ctl.signal });
    const data = await r.json().catch(() => ({}));
    return { status: r.status, ok: r.ok, data };
  } catch (e) {
    return { status: 503, ok: false, data: { error: { message: e.name === "AbortError" ? "timeout" : "network: " + (e.message || e) } } };
  } finally { clearTimeout(timer); }
}

// เรียก 1 รุ่น คืน { status, ok, msg, text, finish, extras }
async function callOne({ p, m }, system, user, maxTokens, keys, fetchImpl, timeoutMs) {
  const extras = !plain.has(p + ":" + m);
  if (p === "groq") {
    const body = { model: m, temperature: 0.2, max_completion_tokens: maxTokens, messages: [{ role: "system", content: system }, { role: "user", content: user }] };
    if (extras) {
      body.response_format = { type: "json_object" };
      if (/gpt-oss/.test(m)) { body.reasoning_effort = "low"; body.include_reasoning = false; }
      if (/qwen3/.test(m)) body.reasoning_effort = "none";
    }
    const { status, ok, data } = await post("https://api.groq.com/openai/v1/chat/completions", { authorization: "Bearer " + keys.groq }, body, fetchImpl, timeoutMs);
    const ch = data?.choices?.[0];
    return { status, ok, msg: data?.error?.message || "", text: ch?.message?.content || "", finish: ch?.finish_reason, extras };
  }
  const generationConfig = { responseMimeType: "application/json", temperature: 0.2, maxOutputTokens: maxTokens };
  if (extras) generationConfig.thinkingConfig = /2\.5/.test(m) ? { thinkingBudget: 0 } : { thinkingLevel: "low" };
  const body = { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: user }] }], generationConfig };
  const { status, ok, data } = await post(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, { "x-goog-api-key": keys.gemini }, body, fetchImpl, timeoutMs);
  const cand = data?.candidates?.[0];
  const text = (cand?.content?.parts || []).filter(x => !x.thought).map(x => x.text || "").join("");
  return { status, ok, msg: data?.error?.message || (ok && !text ? `empty reply (${cand?.finishReason || data?.promptFeedback?.blockReason || "unknown"})` : ""), text, finish: cand?.finishReason, extras };
}

// ลองทีละรุ่นจนได้คำตอบ คืน { text, model, finish }
async function runChain(system, user, maxTokens, { apiKey, groqKey, models = DEFAULT_MODELS, groqModels = GROQ_MODELS, fetchImpl = fetch, log = console, waitMs = 2000, timeoutMs = 60000, deadline = Infinity }) {
  const chain = [...(groqKey ? groqModels.map(m => ({ p: "groq", m })) : []), ...(apiKey ? models.map(m => ({ p: "gemini", m })) : [])];
  if (!chain.length) throw new Error("no AI key (GROQ_API_KEY / GEMINI_API_KEY)");
  let last = "", busy = [], quotaOnly = true;
  const skip = new Set(); // เจ้าที่คีย์ใช้ไม่ได้ ข้ามทั้งเจ้า
  for (const entry of chain) {
    if (skip.has(entry.p)) continue;
    for (let attempt = 0; attempt < 2; attempt++) {
      const left = deadline - Date.now();
      if (left < 5000) { busy.push("time budget"); quotaOnly = false; last = last || "time budget reached"; break; }
      const r = await callOne(entry, system, user, maxTokens, { groq: groqKey, gemini: apiKey }, fetchImpl, Math.min(timeoutMs, left - 2000));
      const tag = `${entry.p}:${entry.m}`;
      // รุ่นนี้ไม่รับพารามิเตอร์เสริม: ลองรุ่นเดิมอีกครั้งแบบพื้นฐาน
      if (r.status === 400 && r.extras && !/api key|api_key|invalid.*key/i.test(r.msg)) { plain.add(tag); log.warn(`${tag} rejected extra params, retrying plain`); continue; }
      if (RETRYABLE.has(r.status) || /overloaded|high demand|unavailable|capacity/i.test(r.msg)) {
        if (r.status !== 429) quotaOnly = false;
        busy.push(`${tag} ${r.status}${/timeout/.test(r.msg) ? " timeout" : ""}`); last = r.msg;
        log.warn(`${tag} busy (${r.status}), trying next`);
        if (waitMs && deadline - Date.now() > waitMs + 5000) await sleep(waitMs);
        break;
      }
      if (r.status === 404 || (r.status === 400 && /not found|not supported|decommission|does not exist/i.test(r.msg))) { log.warn(`${tag} unavailable, trying next`); last = r.msg; break; }
      if (r.status === 401 || r.status === 403 || (r.status === 400 && /api key|api_key/i.test(r.msg))) {
        // คีย์ของเจ้านี้ใช้ไม่ได้: ข้ามไปเจ้าอื่น (ถ้าไม่มีเจ้าอื่นจะแจ้งเป็นข้อผิดพลาด)
        skip.add(entry.p); last = `${entry.p} key rejected (${r.status}): ${r.msg}`; log.warn(last); break;
      }
      if (!r.ok || !r.text) throw new Error(`${tag} ${r.status}: ${r.msg || "request failed"}`.slice(0, 280));
      return { text: r.text, model: tag, finish: r.finish };
    }
  }
  if (busy.length) {
    const what = quotaOnly ? "quota" : "busy";
    throw new QuotaError(`AI ${what} (${busy.join(", ")}): ${last}`.slice(0, 300), quotaOnly ? 429 : 503);
  }
  throw new Error("No AI model available: " + String(last).slice(0, 200));
}

// แปลเต็ม (หัวข้อ สรุป เนื้อหา หมวด ระดับความด่วน) ทีละชุดเล็ก
async function translate(items, opts) {
  const log = opts.log || console;
  if (!items.length) return { results: [], model: null, partial: false };
  const input = items.map((n, i) => ({ i, headline: n.titleKo, snippet: n.snippet, source: n.source, guessedCategories: n.cats }));
  const { text, model, finish } = await runChain(SYSTEM, JSON.stringify(input), 8192, opts);
  const { items: arr, partial } = parseItems(text);
  const results = items.map(() => null);
  for (const o of arr) {
    const i = Number(o?.i);
    if (!Number.isInteger(i) || i < 0 || i >= items.length) continue;
    const cats = (Array.isArray(o.categories) ? o.categories : []).filter(c => CAT_KEYS.includes(c));
    const title = pair(o.title), summary = pair(o.summary);
    if (o.relevant !== false && (!hasThai(title.th) || (summary.th && !hasThai(summary.th)))) {
      log.warn(`${model} item ${i}: Thai field is not Thai, will retry`);
      continue; // ไม่รับผลนี้ → นับเป็นแปลไม่สำเร็จ แล้วแปลใหม่รอบหน้า
    }
    results[i] = {
      relevant: o.relevant !== false && cats.length > 0 && !!title.th,
      categories: cats, level: ["critical", "high"].includes(o.level) ? o.level : "normal",
      title, summary, body: { th: paras(o.body_th ?? o.body?.th) }
    };
  }
  if (partial) log.warn(`${model} reply cut off (${finish}); kept ${results.filter(Boolean).length}/${items.length}`);
  return { results, model, partial };
}

// แปลเฉพาะหัวข้อ ทีละมาก (ให้การ์ดทุกใบเป็นภาษาที่เลือกเร็วที่สุด)
async function translateTitles(items, opts) {
  if (!items.length) return { results: [], model: null };
  const input = items.map((n, i) => ({ i, headline: n.titleKo }));
  const { text, model } = await runChain(SYSTEM_TITLES, JSON.stringify(input), 4096, opts);
  const { items: arr } = parseItems(text);
  const results = items.map(() => null);
  for (const o of arr) {
    const i = Number(o?.i);
    if (!Number.isInteger(i) || i < 0 || i >= items.length) continue;
    const th = str(o.th), en = str(o.en);
    if (hasThai(th)) results[i] = { th, en };
  }
  return { results, model };
}

module.exports = { translate, translateTitles, parseItems, QuotaError, DEFAULT_MODELS, GROQ_MODELS, hasThai };
