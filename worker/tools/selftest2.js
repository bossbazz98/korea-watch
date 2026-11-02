// ทดสอบการแปลเป็นชุด, ปิด thinking, กู้คำตอบที่ถูกตัด: node tools/selftest2.js
const assert = require("assert");
const { translate, parseItems } = require("../lib/translate");

(async () => {
  // 1) กู้คำตอบที่ถูกตัดกลางทาง
  const cut = '[{"i":0,"relevant":true,"categories":["war"],"level":"high","title":{"th":"ก","en":"a"},"summary":{"th":"ส","en":"s"},"body_th":["x \\"q\\" }"]},{"i":1,"relevant":true,"categ';
  const p = parseItems(cut);
  assert.strictEqual(p.partial, true); assert.strictEqual(p.items.length, 1); assert.strictEqual(p.items[0].body_th[0], 'x "q" }');
  assert.throws(() => parseItems('[{"i":0,"rel'), /cut off/);

  // 2) รุ่นที่ไม่รับ thinkingConfig → ลองรุ่นเดิมโดยไม่ตั้งค่า
  const bodies = [];
  const f = async (url, opt) => {
    const b = JSON.parse(opt.body); bodies.push(b.generationConfig.thinkingConfig || null);
    if (b.generationConfig.thinkingConfig) return { ok: false, status: 400, json: async () => ({ error: { message: "Unknown name thinkingLevel in generation_config.thinking_config" } }) };
    const input = JSON.parse(b.contents[0].parts[0].text);
    const reply = JSON.stringify(input.map(x => ({ i: x.i, relevant: true, categories: ["war"], level: "normal", title: { th: "ท", en: "t" }, summary: { th: "ส", en: "s" }, body_th: ["บ"] })));
    return { ok: true, status: 200, json: async () => ({ candidates: [{ finishReason: "STOP", content: { parts: [{ thought: true, text: "thinking..." }, { text: reply }] } }] }) };
  };
  const items = [{ titleKo: "북한 미사일", snippet: "", source: "KBS", cats: ["war"] }, { titleKo: "북한 도발", snippet: "", source: "SBS", cats: ["war"] }];
  const out = await translate(items, { apiKey: "k", fetchImpl: f, log: { warn() {} }, waitMs: 0 });
  assert.deepStrictEqual(bodies, [{ thinkingLevel: "low" }, null], "retried same model without thinking config");
  assert.strictEqual(out.model, "gemini:gemini-flash-lite-latest");
  assert.deepStrictEqual(out.results[1].body, { th: ["บ"] });
  // 2.5 models use thinkingBudget 0
  const b2 = [];
  await translate(items, { apiKey: "k", models: ["gemini-2.5-flash-lite"], fetchImpl: async (u, o) => { b2.push(JSON.parse(o.body).generationConfig.thinkingConfig); return f(u, { body: JSON.stringify({ ...JSON.parse(o.body), generationConfig: {} }) }) }, log: { warn() {} }, waitMs: 0 });
  assert.deepStrictEqual(b2[0], { thinkingBudget: 0 });

  // 3) หมดเวลารอ → นับเป็นยุ่งชั่วคราว ไปรุ่นถัดไป
  let n = 0;
  const slow = async (url, opt) => { n++; if (n === 1) return new Promise((_, rej) => opt.signal.addEventListener("abort", () => { const e = new Error("aborted"); e.name = "AbortError"; rej(e) })); return f(url, { body: JSON.stringify({ ...JSON.parse(opt.body), generationConfig: {} }) }) };
  const o3 = await translate(items, { apiKey: "k", fetchImpl: slow, log: { warn() {} }, waitMs: 0, timeoutMs: 50 });
  assert.strictEqual(o3.model, "gemini:gemini-2.5-flash-lite", "timeout on first model → next model");

  console.log("ผ่านทุกข้อ (ชุดที่ 2)");
})().catch(e => { console.error("ไม่ผ่าน:", e.message); process.exit(1); });
