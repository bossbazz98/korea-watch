// แหล่งข่าวและคำค้นของแต่ละหมวด แก้ไฟล์นี้ไฟล์เดียวเพื่อเพิ่ม/ลดแหล่งข่าวหรือคำค้น
// Google News RSS ค้นข่าวจากสำนักข่าวเกาหลีทุกเจ้า (KBS, MBC, SBS, YTN, 연합뉴스, JTBC ฯลฯ)

const gn = q =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q + " when:1d")}&hl=ko&gl=KR&ceid=KR:ko`;

// ลำดับในรายการนี้ = ลำดับความสำคัญเวลาเลือกข่าวไปแปล
const CATS = {
  war:       { th: "สงคราม/ความมั่นคง", kw: ["북한", "미사일", "전쟁", "군사", "도발", "핵실험", "포격", "공습", "교전", "휴전", "민방위", "공습경보", "계엄"] },
  disease:   { th: "โรคติดต่อ/ไวรัส",   kw: ["감염병", "전염병", "바이러스", "확진", "독감", "인플루엔자", "코로나", "질병관리청", "유행", "엠폭스", "결핵", "홍역", "조류인플루엔자", "백신", "팬데믹"] },
  food:      { th: "อาหาร/กักตุน",      kw: ["사재기", "품귀", "생필품", "품절", "식량", "쌀값", "라면", "장보기", "물가 급등", "공급 부족", "비축"] },
  thai:      { th: "คนไทยในเกาหลี",     kw: ["태국인", "태국 국적", "태국 노동자", "태국 출신", "주한 태국", "태국대사관", "태국"] },
  korea:     { th: "ข่าวในเกาหลี",      kw: [] },
  oil:       { th: "น้ำมัน",            kw: ["유가", "휘발유", "경유", "기름값", "국제유가", "주유소"] },
  fx:        { th: "ค่าเงิน",           kw: ["환율", "원달러", "원·달러", "원화", "달러 강세", "바트"] },
  wage:      { th: "ค่าแรงขั้นต่ำ",      kw: ["최저임금", "최저시급"] },
  foreign:   { th: "แรงงานต่างชาติ",    kw: ["외국인 노동자", "이주노동자", "외국인 근로자", "고용허가제", "E-9", "불법체류", "출입국", "비자"] },
  law:       { th: "กฎหมายแรงงาน",      kw: ["근로기준법", "노동법", "주 52시간", "노란봉투법", "산업안전", "중대재해", "퇴직금"] },
  president: { th: "ประธานาธิบดี",       kw: ["대통령", "대통령실", "청와대"] }
};

// hint = หมวดที่คาดไว้ของ feed นั้น (AI จะตรวจซ้ำและตัดข่าวที่ไม่เกี่ยวออก)
// take = จำนวนข่าวบนสุดที่หยิบจาก feed นั้นต่อรอบ
const FEEDS = [
  { id: "gn_war",       hint: "war",       take: 15, url: gn("북한 미사일 OR 북한 도발 OR 전쟁 OR 공습경보 OR 군사 충돌") },
  { id: "gn_disease",   hint: "disease",   take: 15, url: gn("감염병 OR 전염병 OR 바이러스 확산 OR 질병관리청 OR 유행 주의보") },
  { id: "gn_food",      hint: "food",      take: 12, url: gn("사재기 OR 품귀 OR 생필품 부족 OR 쌀값 급등") },
  { id: "gn_thai",      hint: "thai",      take: 12, url: gn("태국인 OR 태국 노동자 OR 태국 국적") },
  { id: "gn_top",       hint: "korea",     take: 8,  url: "https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko" },
  { id: "gn_oil_fx",    hint: null,        take: 10, url: gn("국제유가 OR 휘발유 가격 OR 원달러 환율") },
  { id: "gn_labor",     hint: null,        take: 10, url: gn("최저임금 OR 외국인 노동자 OR 고용허가제 OR 근로기준법") },
  { id: "gn_president", hint: "president", take: 6,  url: gn("대통령실 OR 대통령 발표") },
  // ฟีดตรงของสำนักข่าว: ได้ลิงก์จริง (ไม่ต้องถอดลิงก์ Google) และหลายเจ้าแนบภาพ/คำโปรยมาในฟีด
  // เก็บเฉพาะข่าวที่ตรงคำค้นของหมวดใดหมวดหนึ่ง ฟีดไหนใช้ไม่ได้จะถูกข้ามอัตโนมัติ
  // หมายเหตุ: ฟีด RSS ของสำนักข่าวอนุญาตให้ใช้ส่วนบุคคล/ไม่แสวงหากำไร
  { id: "yonhaptv",     source: "연합뉴스TV", keywordOnly: true, take: 40, url: "http://www.yonhapnewstv.co.kr/browse/feed/" },
  { id: "yna",          source: "연합뉴스",   keywordOnly: true, take: 50, url: "https://www.yna.co.kr/rss/news.xml" },
  { id: "sbs_flash",    source: "SBS",        keywordOnly: true, take: 40, url: "https://news.sbs.co.kr/news/newsflashRssFeed.do?plink=RSSREADER" },
  { id: "sbs_society",  source: "SBS",        keywordOnly: true, take: 30, url: "https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=03&plink=RSSREADER" },
  { id: "sbs_world",    source: "SBS",        keywordOnly: true, take: 30, url: "https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=07&plink=RSSREADER" },
  { id: "sbs_economy",  source: "SBS",        keywordOnly: true, take: 30, url: "https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=02&plink=RSSREADER" },
  { id: "donga",        source: "동아일보",   keywordOnly: true, take: 40, url: "https://rss.donga.com/total.xml" },
  { id: "khan_society", source: "경향신문",   keywordOnly: true, take: 30, url: "https://www.khan.co.kr/rss/rssdata/society.xml" }
];

module.exports = { CATS, FEEDS, CAT_KEYS: Object.keys(CATS) };
