// นับโควตา AI รายวัน (ตามเวลาเกาหลี) และกันโควตาฉุกเฉินไว้
// ผู้ให้บริการไม่บอกโควตาที่เหลือทั้งวันมาตรงๆ จึงนับเองจากตัวเลขที่ AI ส่งกลับ และตั้งเพดานต่ำกว่าเพดานจริงเล็กน้อย
// ถ้า AI ตอบว่าโควตารายวันหมด จะจดว่ารุ่นนั้นหมดสำหรับวันนั้นทันที
const LIMITS = {
  "groq:openai/gpt-oss-120b": { tokens: 180000, requests: 900 },
  "groq:openai/gpt-oss-20b": { tokens: 180000, requests: 900 },
  "groq:qwen/qwen3-32b": { tokens: 450000, requests: 900 },
  "groq:*": { tokens: 180000, requests: 900 },
  "github:*": { requests: 140 },          // GitHub Models แผนฟรี จำกัดจำนวนครั้งต่อวัน
  "gemini:*": { requests: 200 }
};
const RESERVE = { tokens: 20000, requests: 6 }; // เก็บไว้ต่อรุ่น พอแปลข่าวฉุกเฉิน 3 ข่าว
const EMERGENCY_PER_DAY = 3;

const kstDay = ms => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);

class Quota {
  constructor(state = {}, now = Date.now()) {
    const day = kstDay(now);
    const same = state.day === day;
    this.day = day;
    this.used = same ? { ...(state.used || {}) } : {};
    this.exhausted = same ? { ...(state.exhausted || {}) } : {};
    this.emergencyUsed = same ? (state.emergencyUsed || 0) : 0;
    // ผู้ให้บริการที่ใช้ไม่ได้ (คีย์ผิด / ไม่มีสิทธิ์) พักไว้ระยะหนึ่ง ไม่ต้องลองซ้ำทุกรอบ (จำข้ามวัน)
    this.disabled = Object.fromEntries(Object.entries(state.disabled || {}).filter(([, v]) => v && v.until > now));
  }
  disable(provider, reason, ms = 6 * 3600e3) { this.disabled[provider] = { until: Date.now() + ms, reason: String(reason || "").slice(0, 160) } }
  isDisabled(provider) { const d = this.disabled[provider]; return !!(d && d.until > Date.now()) }
  limit(tag) { return LIMITS[tag] || LIMITS[tag.split(":")[0] + ":*"] || {} }
  u(tag) { return this.used[tag] || (this.used[tag] = { tokens: 0, requests: 0 }) }
  // งานปกติใช้ได้จนถึงเส้นสำรอง / ข่าวฉุกเฉินใช้ได้ถึงเพดาน
  canUse(tag, emergency = false) {
    if (this.exhausted[tag]) return false;
    const L = this.limit(tag), u = this.used[tag] || { tokens: 0, requests: 0 };
    const over = (pad) => (L.tokens && u.tokens + pad.tokens >= L.tokens) || (L.requests && u.requests + pad.requests >= L.requests);
    if (!over(RESERVE)) return true;
    return !!emergency && !over({ tokens: 0, requests: 0 });
  }
  record(tag, tokens = 0) { const u = this.u(tag); u.requests++; u.tokens += Math.max(0, tokens | 0) }
  exhaust(tag) { this.exhausted[tag] = true }
  emergencyLeft() { return Math.max(0, EMERGENCY_PER_DAY - this.emergencyUsed) }
  useEmergency() { this.emergencyUsed++ }
  toJSON() { return { day: this.day, used: this.used, exhausted: this.exhausted, emergencyUsed: this.emergencyUsed, disabled: this.disabled } }
}

module.exports = { Quota, LIMITS, RESERVE, EMERGENCY_PER_DAY, kstDay };
