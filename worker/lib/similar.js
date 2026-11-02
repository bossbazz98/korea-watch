// ตรวจข่าวซ้ำ: ข่าวเรื่องเดียวกันจากหลายสำนักมักใช้หัวข้อต่างกัน จึงเทียบ "ความคล้าย" แทนการเทียบตรงตัว
// วิธี: แตกหัวข้อเป็นคู่ตัวอักษรติดกัน (bigram) แล้วดูว่าซ้อนทับกันมากแค่ไหน
const NOISE = /\[[^\]]*\]|\([^)]*\)|【[^】]*】|속보|단독|종합|영상|포토|사진|오늘의|뉴스|기자|exclusive|breaking/gi;

function grams(title) {
  const s = String(title || "").replace(NOISE, " ").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  const g = new Set();
  for (let i = 0; i < s.length - 1; i++) g.add(s.slice(i, i + 2));
  // ภาษาไทยใช้ตัวอักษรมากกว่าเกาหลีเพื่อความหมายเท่ากัน (สระ/วรรณยุกต์แยกตัว) จึงต้องยาวกว่าถึงจะใช้กฎ "ครอบ"
  g.minContain = /[\u0E00-\u0E7F]/.test(s) ? 16 : 8;
  return g;
}

// คืนค่า 0..1 (ใช้ทั้งอัตราซ้อนทับรวม และอัตราที่หัวข้อสั้นถูกครอบในหัวข้อยาว)
function similarity(a, b) {
  const A = a instanceof Set ? a : grams(a), B = b instanceof Set ? b : grams(b);
  if (A.size < 4 || B.size < 4) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const jaccard = inter / (A.size + B.size - inter);
  // หัวข้อสั้นถูกครอบในหัวข้อยาว: ใช้เฉพาะเมื่อหัวข้อสั้นยาวพอ (กันหัวข้อสั้นที่ขึ้นต้นเหมือนกันถูกรวมผิด)
  const contain = Math.min(A.size, B.size) >= Math.max(A.minContain || 8, B.minContain || 8) ? inter / Math.min(A.size, B.size) : 0;
  return Math.max(jaccard, contain * 0.85);
}

const SAME_KO = 0.5;  // หัวข้อเกาหลีคล้ายกันเกินนี้ = ข่าวเดียวกัน (ข่าวต่างเรื่องมักได้ไม่เกิน ~0.25)
const SAME_TH = 0.6;  // หัวข้อไทย (หลังแปล) คล้ายกันเกินนี้ = ข่าวเดียวกัน

module.exports = { grams, similarity, SAME_KO, SAME_TH };
