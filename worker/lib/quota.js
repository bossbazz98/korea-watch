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
    const zone = process.env.AI_QUOTA_TIMEZONE || "Asia/Seoul";
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year:"numeric",month:"2-digit",day:"2-digit" }).format(new Date(now));
    const same = state.day === day;
    this.day = day;
    this.inFlight = {};
    this.used = same ? { ...(state.used || {}) } : {};
    this.exhausted = same ? { ...(state.exhausted || {}) } : {};
    this.emergencyUsed = same ? (state.emergencyUsed || 0) : 0;
    this.emergencyItems = new Set(same ? (state.emergencyItems || []) : []);
    // ผู้ให้บริการที่ใช้ไม่ได้ (คีย์ผิด / ไม่มีสิทธิ์) พักไว้ระยะหนึ่ง ไม่ต้องลองซ้ำทุกรอบ (จำข้ามวัน)
    this.disabled = Object.fromEntries(Object.entries(state.disabled || {}).filter(([, v]) => v && v.until > now));
  }
  disable(provider, reason, ms = 6 * 3600e3) { this.disabled[provider] = { until: Date.now() + ms, reason: String(reason || "").slice(0, 160) } }
  isDisabled(provider) { const d = this.disabled[provider]; return !!(d && d.until > Date.now()) }
  limit(tag) { return LIMITS[tag] || LIMITS[tag.split(":")[0] + ":*"] || {} }
  u(tag) { return this.used[tag] || (this.used[tag] = { tokens: 0, requests: 0 }) }
  // งานปกติใช้ได้จนถึงเส้นสำรอง / ข่าวฉุกเฉินใช้ได้ถึงเพดาน
  canUse(tag, emergency = false, estimate = 0) {
    if (this.exhausted[tag]) return false;
    const L = this.limit(tag), used = this.used[tag] || { tokens: 0, requests: 0 }, f = this.inFlight[tag] || {tokens:0,requests:0};
    const u={tokens:used.tokens+f.tokens+estimate,requests:used.requests+f.requests};
    const over = (pad) => (L.tokens && u.tokens + pad.tokens >= L.tokens) || (L.requests && u.requests + pad.requests >= L.requests);
    if (!over(RESERVE)) return true;
    return !!emergency && !over({ tokens: 0, requests: 0 });
  }
  reserve(tag, tokens, emergency = false) {
    if (!this.canUse(tag, emergency, tokens)) return null;
    const f=this.inFlight[tag] || (this.inFlight[tag]={tokens:0,requests:0}); f.tokens+=tokens; f.requests++;
    let settled=false;
    return (actual = tokens, count = true) => { if(settled) return; settled=true; f.tokens-=tokens;f.requests--;if(count) this.record(tag,actual); };
  }
  record(tag, tokens = 0) { const u = this.u(tag); u.requests++; u.tokens += Math.max(0, tokens | 0) }
  exhaust(tag) { this.exhausted[tag] = true }
  emergencyLeft() { return Math.max(0, EMERGENCY_PER_DAY - this.emergencyUsed) }
  claimEmergency(ids) {
    const fresh=[...new Set(ids)].filter(id=>!this.emergencyItems.has(id));
    if(fresh.length>this.emergencyLeft()) return null;
    fresh.forEach(id=>this.emergencyItems.add(id));this.emergencyUsed+=fresh.length;
    return { count:fresh.length, rollback:()=>{fresh.forEach(id=>this.emergencyItems.delete(id));this.emergencyUsed-=fresh.length;} };
  }
  useEmergency() { this.emergencyUsed++ }
  toJSON() { return { day: this.day, used: this.used, exhausted: this.exhausted, emergencyUsed: this.emergencyUsed, emergencyItems: [...this.emergencyItems], disabled: this.disabled } }
}

module.exports = { Quota, LIMITS, RESERVE, EMERGENCY_PER_DAY, kstDay };
