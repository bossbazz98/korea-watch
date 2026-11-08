(() => {
const categories = {
  korwar: { th: "สงครามเกาหลี", en: "Korean Peninsula" },
  war: { th: "สงครามทั่วโลก", en: "World conflicts" },
  disease: { th: "โรคติดต่อ / ไวรัส", en: "Disease & viruses" },
  tech: { th: "AI / เทคโนโลยี", en: "AI & technology" },
  crypto: { th: "คริปโตเคอเรนซี่", en: "Cryptocurrency" },
  foreign: { th: "แรงงานต่างชาติ", en: "Foreign workers in Korea" },
  wage: { th: "ค่าแรงขั้นต่ำ", en: "Korean minimum wage" },
  fx: { th: "ค่าเงินวอน", en: "Korean won" },
  oil: { th: "น้ำมัน / พลังงาน", en: "Oil & energy" },
  thai: { th: "คนไทยในเกาหลี", en: "Thais in Korea" },
  president: { th: "ประธานาธิบดี", en: "Korean president & government" },
  hot: { th: "ข่าวดัง", en: "Trending in Korea" }
};
if(typeof module !== "undefined") module.exports=categories;
else globalThis.KW_CATEGORIES=categories;
})();
