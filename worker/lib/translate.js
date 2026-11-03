// แปลและสรุปข่าวด้วย AI หลายเจ้า: Groq (เร็ว โควตาฟรีเยอะ) เป็นตัวหลัก แล้วสำรองด้วย Gemini
// ถ้าเจ้าไหนยุ่ง/โควตาเต็ม/ตอบช้า จะสลับไปตัวถัดไปเอง และไม่นับเป็นการแปลล้มเหลว
const { CATS, CAT_KEYS } = require("../feeds");

const SYSTEM = `You are the news editor of "Korea Watch", an app for Thai people living in South Korea.
You receive Korean news items: headline, an RSS snippet, and often "article" = text taken from the publisher's page. For each item return JSON.
Rules:
- Use ONLY facts found in the headline, snippet and article. Never add names, numbers, dates, places, quotes or causes that are not in the input.
- Write in your own words. Do not translate the article sentence by sentence; summarise it.
- "relevant": false if the item does not really fit any listed category or is entertainment, sports, celebrity gossip, ads or opinion columns.
- "categories": keep only keys from this list that truly apply: ${CAT_KEYS.map(k => `${k} = ${CATS[k].desc || CATS[k].th}`).join("; ")}.
- "korwar" and "war" are different: use "korwar" only for the Korean Peninsula; use "war" for conflicts elsewhere.
- "level": "critical" only for news that needs immediate attention from people in Korea: military attack, missile launch or air-raid alert affecting Korea, a declared outbreak or new dangerous virus spreading in Korea, panic buying or shortages of daily goods, disasters or emergency alerts, or serious incidents involving Thai nationals. "high" for important developments in those categories or major policy changes affecting foreign workers. Otherwise "normal".
- "title" and "summary" in natural Thai ("th", written in Thai script) and English ("en"). summary: 2-3 sentences with the key facts.
- "body_th": a detailed Thai summary as an array of paragraphs. When "article" has enough text, write 4-6 paragraphs covering: what happened, where and when, who is involved, key numbers, causes and reactions, impact, and what happens next (only parts the article actually covers). When only a headline/snippet is available, write 1-2 short paragraphs.
- "tips_th": 0-3 short practical points in Thai for Thai people living in Korea (e.g. what to watch out for, what to do), ONLY when the news clearly affects them (work, visas, health, prices, safety). Otherwise an empty array. Never invent advice that the facts do not support.
Reply with ONLY this JSON object, one entry per input item, same "i":
{"items":[{"i":0,"relevant":true,"categories":["war"],"level":"high","title":{"th":"","en":""},"summary":{"th":"","en":""},"body_th":[""],"tips_th":[]}]}`;

const SYSTEM_TITLES = `Translate Korean news headlines for a news app read by Thai people in South Korea.
For each input item give a natural, concise Thai headline ("th", in Thai script) and English headline ("en").
Keep names, numbers and places exactly as in the original. Do not add information. Answer immediately.
Reply with ONLY this JSON object, one entry per input item, same "i":
{"items":[{"i":0,"th":"","en":""}]}`;

// ลำดับรุ่น: Groq ก่อน (เร็วมาก) แล้ว Gemini เป็นตัวสำรอง
// (llama-3.3-70b-versatile ถูกเลิกให้บริการแล้ว จึงเอาออก)
const GROQ_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3-32b"];
// GitHub Models: ใช้สิทธิ์ GITHUB_TOKEN ของ GitHub Actions เอง (ไม่ต้องสมัครเพิ่ม) จำกัดขนาด 8K เข้า / 4K ออกต่อคำขอ
const GITHUB_MODELS = ["openai/gpt-4.1-mini", "openai/gpt-4o-mini"];
const COOLDOWN_MS = 60000; // รุ่นที่เพิ่งโดน 429 พักไว้ 60 วินาที
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

async function post(url, headers, body, fetchImpl, timeoutMs, signal) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), Math.max(1000, timeoutMs));
  if (signal) { if (signal.aborted) ctl.abort(); else signal.addEventListener("abort", () => ctl.abort(), { once: true }) }
  try {
    const r = await fetchImpl(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: ctl.signal });
    const data = await r.json().catch(() => ({}));
    return { status: r.status, ok: r.ok, data };
  } catch (e) {
    if (signal && signal.aborted) return { status: 499, ok: false, data: { error: { message: "aborted (another AI answered first)" } } };
    return { status: 503, ok: false, data: { error: { message: e.name === "AbortError" ? "timeout" : "network: " + (e.message || e) } } };
  } finally { clearTimeout(timer); }
}

// เรียก 1 รุ่น คืน { status, ok, msg, text, finish, extras, tokens }
async function callOne({ p, m }, system, user, maxTokens, keys, fetchImpl, timeoutMs, signal) {
  const extras = !plain.has(p + ":" + m);
  if (p === "groq" || p === "github") {
    const max = p === "github" ? Math.min(maxTokens, 4000) : maxTokens;
    const body = { model: m, temperature: 0.2, messages: [{ role: "system", content: system }, { role: "user", content: user }] };
    if (p === "groq") body.max_completion_tokens = max; else body.max_tokens = max;
    if (extras) {
      body.response_format = { type: "json_object" };
      if (p === "groq" && /gpt-oss/.test(m)) { body.reasoning_effort = "low"; body.include_reasoning = false; }
      if (p === "groq" && /qwen3/.test(m)) body.reasoning_effort = "none";
    }
    const url = p === "groq" ? "https://api.groq.com/openai/v1/chat/completions" : "https://models.github.ai/inference/chat/completions";
    const headers = p === "groq" ? { authorization: "Bearer " + keys.groq } : { authorization: "Bearer " + keys.github, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" };
    const { status, ok, data } = await post(url, headers, body, fetchImpl, timeoutMs, signal);
    const ch = data?.choices?.[0];
    return { status, ok, msg: data?.error?.message || data?.message || "", text: ch?.message?.content || "", finish: ch?.finish_reason, extras, tokens: data?.usage?.total_tokens || 0 };
  }
  const generationConfig = { responseMimeType: "application/json", temperature: 0.2, maxOutputTokens: maxTokens };
  if (extras) generationConfig.thinkingConfig = /2\.5/.test(m) ? { thinkingBudget: 0 } : { thinkingLevel: "low" };
  const body = { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: user }] }], generationConfig };
  const { status, ok, data } = await post(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, { "x-goog-api-key": keys.gemini }, body, fetchImpl, timeoutMs, signal);
  const cand = data?.candidates?.[0];
  const text = (cand?.content?.parts || []).filter(x => !x.thought).map(x => x.text || "").join("");
  return { status, ok, msg: data?.error?.message || (ok && !text ? `empty reply (${cand?.finishReason || data?.promptFeedback?.blockReason || "unknown"})` : ""), text, finish: cand?.finishReason, extras, tokens: data?.usageMetadata?.totalTokenCount || 0 };
}

// รายชื่อช่องทาง AI ทั้งหมดที่มีคีย์ (เรียงตามลำดับที่ต้องการ)
function chainOf({ apiKey, groqKey, githubToken, models = DEFAULT_MODELS, groqModels = GROQ_MODELS, githubModels = GITHUB_MODELS }) {
  return [...(groqKey ? groqModels.map(m => ({ p: "groq", m })) : []), ...(githubToken ? githubModels.map(m => ({ p: "github", m })) : []), ...(apiKey ? models.map(m => ({ p: "gemini", m })) : [])];
}

// ลองทีละรุ่นจนได้คำตอบ คืน { text, model, finish }
async function runChain(system, user, maxTokens, opts) {
  const { apiKey, groqKey, githubToken, fetchImpl = fetch, log = console, waitMs = 2000, timeoutMs = 60000, deadline = Infinity, cool = new Map(), exclude = new Set(), only = null, rotate = 0, quota = null, emergency = false, signal = null } = opts;
  let chain = chainOf(opts);
  if (!chain.length) throw new Error("no AI key (GROQ_API_KEY / GEMINI_API_KEY)");
  if (only) chain = chain.filter(e => only.has(`${e.p}:${e.m}`));
  // แต่ละช่องทาง (lane) เริ่มจากรุ่นต่างกัน เพื่อให้หลายชุดแปลพร้อมกันได้โดยไม่แย่งโควตาต่อนาทีของรุ่นเดียวกัน
  if (rotate && chain.length) { const k = rotate % chain.length; chain = [...chain.slice(k), ...chain.slice(0, k)]; }
  let reservedOnly = chain.length > 0;
  let last = "", busy = [], quotaOnly = true;
  const skip = new Set(); // เจ้าที่คีย์ใช้ไม่ได้ ข้ามทั้งเจ้า
  for (const entry of chain) {
    if (skip.has(entry.p)) continue;
    const ctag = `${entry.p}:${entry.m}`;
    if (exclude.has(ctag)) continue;
    if ((cool.get(ctag) || 0) > Date.now()) { busy.push(`${ctag} cooling`); reservedOnly = false; continue; } // เพิ่งโดน 429 ข้ามไปก่อน
    if (quota && !quota.canUse(ctag, emergency)) { busy.push(`${ctag} reserved`); continue; } // เหลือแต่โควตาฉุกเฉิน
    reservedOnly = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      const left = deadline - Date.now();
      if (left < 5000) { busy.push("time budget"); quotaOnly = false; last = last || "time budget reached"; break; }
      if (signal && signal.aborted) throw new QuotaError("cancelled (another AI answered first)", 499);
      const r = await callOne(entry, system, user, maxTokens, { groq: groqKey, gemini: apiKey, github: githubToken }, fetchImpl, Math.min(timeoutMs, left - 2000), signal);
      const tag = `${entry.p}:${entry.m}`;
      // ตัวที่ถูกยกเลิกกลางคันก็ใช้โควตาไปแล้ว: ประมาณจากขนาดคำขอ (ภาษาเกาหลี/ไทย ~2.5 ตัวอักษรต่อ token)
      if (quota && r.status === 499) quota.record(tag, Math.ceil((system.length + user.length) / 2.5));
      else if (quota && !/timeout|network/.test(r.msg)) quota.record(tag, r.tokens);
      if (r.status === 499) throw new QuotaError("cancelled (another AI answered first)", 499);
      // รุ่นนี้ไม่รับพารามิเตอร์เสริม: ลองรุ่นเดิมอีกครั้งแบบพื้นฐาน
      if (r.status === 400 && r.extras && !/api key|api_key|invalid.*key/i.test(r.msg)) { plain.add(tag); log.warn(`${tag} rejected extra params, retrying plain`); continue; }
      if (RETRYABLE.has(r.status) || /overloaded|high demand|unavailable|capacity/i.test(r.msg)) {
        if (r.status !== 429) quotaOnly = false; else cool.set(tag, Date.now() + COOLDOWN_MS);
        if (quota && r.status === 429 && /per day|per-day|daily|TPD|RPD|requests per day|tokens per day|UserByModelByDay/i.test(r.msg)) quota.exhaust(tag); // โควตารายวันหมด
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
    const what = reservedOnly ? "reserved for emergencies" : quotaOnly ? "quota" : "busy";
    const e = new QuotaError(`AI ${what} (${busy.join(", ")}): ${last}`.slice(0, 300), quotaOnly ? 429 : 503);
    e.reserved = reservedOnly;
    throw e;
  }
  throw new Error("No AI model available: " + String(last).slice(0, 200));
}

// แปลเต็ม (หัวข้อ สรุปละเอียด เนื้อหา หมวด ระดับความด่วน สิ่งที่ควรรู้) ทีละชุดเล็ก
async function translate(items, opts) {
  const log = opts.log || console;
  if (!items.length) return { results: [], model: null, partial: false };
  const input = items.map((n, i) => ({ i, headline: n.titleKo, snippet: n.snippet, article: n.article || "", source: n.source, guessedCategories: n.cats }));
  const exclude = new Set(opts.exclude || []);
  for (let round = 0; ; round++) {
    const { text, model, finish } = await runChain(SYSTEM, JSON.stringify(input), 8192, { ...opts, exclude });
    const { items: arr, partial } = parseItems(text);
    const results = items.map(() => null);
    let bad = 0, judged = 0;
    for (const o of arr) {
      const i = Number(o?.i);
      if (!Number.isInteger(i) || i < 0 || i >= items.length) continue;
      const cats = (Array.isArray(o.categories) ? o.categories : []).filter(c => CAT_KEYS.includes(c));
      const title = pair(o.title), summary = pair(o.summary);
      // AI ตอบว่างทั้งหัวข้อและหมวด = ไม่เกี่ยวข้อง (ไม่ต้องลองแปลซ้ำ)
      const relevant = o.relevant !== false && !(!title.th && !cats.length);
      judged++;
      if (relevant && (!hasThai(title.th) || (summary.th && !hasThai(summary.th)))) { bad++; continue; }
      results[i] = {
        relevant: relevant && cats.length > 0 && !!title.th,
        categories: cats, level: ["critical", "high"].includes(o.level) ? o.level : "normal",
        title, summary, body: { th: paras(o.body_th ?? o.body?.th) }, tips: { th: paras(o.tips_th).slice(0, 3) }
      };
    }
    // ข่าวเกินครึ่งช่องภาษาไทยไม่ใช่ภาษาไทย: ลองชุดเดิมกับรุ่นถัดไปทันที (ไม่ต้องรอรอบหน้า)
    if (bad && bad * 2 > judged && round < 2) {
      log.warn(`${model}: ${bad}/${judged} items not in Thai, retrying with next model now`);
      exclude.add(model);
      continue;
    }
    if (bad) log.warn(`${model}: ${bad} item(s) not in Thai, will retry next run`);
    if (partial) log.warn(`${model} reply cut off (${finish}); kept ${results.filter(Boolean).length}/${items.length}`);
    return { results, model, partial };
  }
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

// แข่งกันแปล (ข่าวสงครามเกาหลี): ส่งงานเดียวกันให้ AI ที่เร็วที่สุด "ผู้ให้บริการละ 1 ตัว" พร้อมกัน ใช้คำตอบแรกที่ถูกต้อง แล้วยกเลิกตัวที่เหลือ
// (เดิมส่งทุกตัว 9 ช่องทาง เปลืองโควตาเกินไป จนโควตาหมดและแปลไม่ได้ทั้งวัน)
const RACE_PREF = ["groq:openai/gpt-oss-20b", "github:openai/gpt-4o-mini", "gemini:gemini-flash-lite-latest"];
function raceLanes(opts, max) {
  const all = chainOf(opts).map(e => `${e.p}:${e.m}`).filter(t => !opts.quota || opts.quota.canUse(t, opts.emergency));
  const cooled = t => (opts.cool && (opts.cool.get(t) || 0) > Date.now());
  const picked = [];
  // ตัวที่เร็วที่สุดก่อน แล้วเติมด้วยตัวอื่นจากผู้ให้บริการที่ยังไม่มีในรายการ
  for (const t of [...RACE_PREF, ...all]) {
    if (picked.length >= max) break;
    if (!all.includes(t) || cooled(t) || picked.includes(t) || picked.some(x => x.split(":")[0] === t.split(":")[0])) continue;
    picked.push(t);
  }
  for (const t of all) { if (picked.length >= max) break; if (!picked.includes(t) && !cooled(t)) picked.push(t) }
  return picked;
}
async function race(fn, items, opts, valid, max = 3) {
  const lanes = raceLanes(opts, max);
  if (!lanes.length) { const e = new QuotaError("no AI lane available for race", 429); e.reserved = true; throw e; }
  const ctl = new AbortController();
  try {
    return await Promise.any(lanes.map(t => fn(items, { ...opts, only: new Set([t]), signal: ctl.signal, waitMs: 0 }).then(r => { if (!valid(r)) throw new Error(`${t}: answer not usable`); return r })));
  } catch (e) {
    const errs = e.errors || [e];
    const err = new QuotaError("race failed: " + errs.map(x => String(x.message || x).slice(0, 80)).join(" | ").slice(0, 280), 503);
    err.transient = errs.some(x => x.transient); err.reserved = errs.every(x => x.reserved);
    throw err;
  } finally { ctl.abort() }
}
const raceTranslate = (items, opts) => race(translate, items, opts, r => r.results.some(Boolean), 3);
const raceTitles = (items, opts) => race(translateTitles, items, opts, r => r.results.some(Boolean), 2);

module.exports = { translate, translateTitles, raceTranslate, raceTitles, raceLanes, parseItems, QuotaError, DEFAULT_MODELS, GROQ_MODELS, GITHUB_MODELS, hasThai, chainOf };
