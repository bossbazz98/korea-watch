(() => {
const categories = {
  korwar: { th: "สงครามเกาหลี", en: "Korean Peninsula" },
  war: { th: "สงครามทั่วโลก", en: "World conflicts" },
  food: { th: "อาหาร/กักตุน", en: "Food & stockpiling" },
  disease: { th: "โรคติดต่อ/ไวรัส", en: "Disease & viruses" },
  thai: { th: "คนไทยในเกาหลี", en: "Thais in Korea" },
  korea: { th: "ข่าวในเกาหลี", en: "Korea news" },
  oil: { th: "น้ำมัน", en: "Oil & fuel" },
  fx: { th: "ค่าเงิน", en: "Currency" },
  wage: { th: "ค่าแรงขั้นต่ำ", en: "Minimum wage" },
  foreign: { th: "แรงงานต่างชาติ", en: "Foreign workers" },
  law: { th: "กฎหมายแรงงาน", en: "Labor law" },
  president: { th: "ประธานาธิบดี", en: "President" }
};
if(typeof module !== "undefined") module.exports=categories;
else globalThis.KW_CATEGORIES=categories;
})();
