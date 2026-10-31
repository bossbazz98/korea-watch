// ทดสอบดึงข่าวจริงโดยไม่ใช้ AI และไม่เขียนฐานข้อมูล: npm run dry-run
const { collect } = require("../lib/collect");
const { CATS } = require("../feeds");
collect().then(({ list, errors }) => {
  console.log(`พบข่าว ${list.length} ชิ้น` + (errors.length ? `\nแหล่งข่าวที่ดึงไม่ได้: ${errors.join(" | ")}` : ""));
  for (const n of list.slice(0, 30)) console.log(`[${n.cats.map(c => CATS[c].th).join(", ")}] ${n.titleKo} (${n.source})`);
}).catch(e => { console.error(e); process.exit(1); });
