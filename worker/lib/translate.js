// แปลและสรุปข่าวด้วย Gemini API (แผนฟรีของ Google AI Studio)
const { CATS, CAT_KEYS } = require("../feeds");

const SYSTEM = `You are the news editor of "Korea Watch", an app for Thai people living in South Korea.
You receive Korean news items (headline plus a short RSS snippet). For each item return JSON.
Rules:
- Use ONLY facts in the given headline and snippet. Never add names, numbers, dates, places or causes that are not in the input. If the input is thin, write less.
- "relevant": false if the item does not really fit any listed category or is entertainment, sports, celebrity gossip, ads or opinion columns.
- "categories": keep only keys from this list that truly apply: ${CAT_KEYS.map(k => `${k} (${CATS[k].th})`).join(", ")}.
- "level": "critical" only for news that needs immediate attention from people in Korea: military attack, missile launch or air-raid alert affecting Korea, a declared outbreak or new dangerous virus spreading in Korea, panic buying or shortages of daily goods, disasters or emergency alerts, or serious incidents involving Thai nationals. "high" for important developments in those categories or major policy changes affecting foreign workers. Otherwise "normal".
- title/summary/body in natural Thai ("th") and English ("en"). summary: 1-2 sentences. body: 1-3 short paragraphs (array of strings) explaining the news for a Thai reader, still using only the given facts.
Reply with ONLY a JSON array:
[{"i":0,"relevant":true,"categories":["war"],"level":"high","title":{"th":"","en":""},"summary":{"th":"","en":""},"body":{"th":[""],"en":[""]}}]`;

// ลองรุ่นตามลำดับ ถ้ารุ่นไหนถูกเลิกใช้ (404) จะลองรุ่นถัดไปเอง
// gemini-flash-latest ชี้ไปที่ Flash รุ่นล่าสุดเสมอ (ตอนนี้คือ Gemini 3.8 Flash)
const DEFAULT_MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.5-flash", "gemini-2.5-flash-lite"];

class QuotaError extends Error { constructor(m) { super(m); this.code = 429 } }

function parseJsonArray(s) {
  const clean = String(s).replace(/```json|```/g, "");
  const a = clean.indexOf("["), b = clean.lastIndexOf("]");
  if (a < 0 || b < a) throw new Error("no JSON array in model reply");
  return JSON.parse(clean.slice(a, b + 1));
}
const str = v => (typeof v === "string" ? v.trim() : "");
const pair = o => ({ th: str(o?.th), en: str(o?.en) });
const paras = v => (Array.isArray(v) ? v.map(str).filter(Boolean) : str(v) ? [str(v)] : []);

async function callGemini(model, body, apiKey, fetchImpl) {
  const r = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": apiKey }, body: JSON.stringify(body)
  });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, ok: r.ok, data };
}

async function translate(items, { apiKey, models = DEFAULT_MODELS, fetchImpl = fetch, log = console }) {
  if (!items.length) return { results: [], model: null };
  const input = items.map((n, i) => ({ i, headline: n.titleKo, snippet: n.snippet, source: n.source, guessedCategories: n.cats }));
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: "user", parts: [{ text: JSON.stringify(input) }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.2, maxOutputTokens: 16384 }
  };
  let last = "";
  for (const model of models) {
    const { status, ok, data } = await callGemini(model, body, apiKey, fetchImpl);
    const msg = data?.error?.message || "";
    if (status === 429) throw new QuotaError(`Gemini quota (${model}): ${msg}`.slice(0, 280));
    if (status === 404 || (status === 400 && /not found|not supported/i.test(msg))) { log.warn(`model ${model} unavailable, trying next`); last = msg; continue; }
    if (!ok) throw new Error(`Gemini ${status}: ${msg || "request failed"}`.slice(0, 280));
    const cand = data?.candidates?.[0];
    const reply = (cand?.content?.parts || []).map(p => p.text || "").join("");
    if (!reply) throw new Error(`Gemini empty reply (${cand?.finishReason || data?.promptFeedback?.blockReason || "unknown"})`);
    const arr = parseJsonArray(reply);
    const results = items.map(() => null);
    for (const o of arr) {
      const i = Number(o?.i);
      if (!Number.isInteger(i) || i < 0 || i >= items.length) continue;
      const cats = (Array.isArray(o.categories) ? o.categories : []).filter(c => CAT_KEYS.includes(c));
      const title = pair(o.title), summary = pair(o.summary);
      results[i] = {
        relevant: o.relevant !== false && cats.length > 0 && !!title.th,
        categories: cats, level: ["critical", "high"].includes(o.level) ? o.level : "normal",
        title, summary, body: { th: paras(o.body?.th), en: paras(o.body?.en) }
      };
    }
    return { results, model };
  }
  throw new Error("No Gemini model available: " + last.slice(0, 200));
}

module.exports = { translate, parseJsonArray, QuotaError, DEFAULT_MODELS };
