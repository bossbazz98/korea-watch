// แหล่งข่าวและคำค้นของแต่ละหมวด แก้ไฟล์นี้ไฟล์เดียวเพื่อเพิ่ม/ลดแหล่งข่าวหรือคำค้น
// Google News RSS ค้นข่าวจากสำนักข่าวเกาหลีทุกเจ้า (KBS, MBC, SBS, YTN, 연합뉴스, JTBC ฯลฯ)

const gn = q =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q + " when:1d")}&hl=ko&gl=KR&ceid=KR:ko`;

// ลำดับในรายการนี้ = ลำดับความสำคัญเวลาเลือกข่าวไปแปล
const CATS = {
  korwar: { desc: "Korean Peninsula military/security conflict ONLY. North/South Korea attacks, missiles, nuclear tests, DMZ incidents, inter-Korean threats and drills. Never unrelated foreign military readiness.", kw: ["북한", "북측", "남북", "한반도", "군사분계선", "DMZ"] },
  war: { desc: "Actual wars and armed conflicts anywhere outside the Korean Peninsula, fighting, invasions, airstrikes, ceasefires. Exclude trade/price wars and unrelated military readiness.", kw: ["전쟁", "공습", "교전", "휴전", "폭격", "침공"] },
  disease: { desc: "All infectious diseases worldwide, new viruses, outbreaks, transmission and vaccines.", kw: ["감염병", "바이러스", "백신", "전염병"] },
  tech: { desc: "All AI news, emerging technology, semiconductors, robotics and new innovations.", kw: ["인공지능", "AI", "반도체", "로봇", "신기술"] },
  crypto: { desc: "All cryptocurrency news: coins, celebrity launches, adoption and legalisation by countries, tokens and blockchain.", kw: ["암호화폐", "비트코인", "가상자산", "이더리움"] },
  foreign: { desc: "Foreigners and migrant workers IN SOUTH KOREA ONLY: employment ministry, recruitment, work, visas, labour law, protests and racial discrimination. Not workers abroad.", kw: ["외국인", "이주노동자", "고용허가제", "고용노동부"] },
  wage: { desc: "SOUTH KOREAN wages/pay, wage law, minimum wages and minimum-wage adjustments only.", kw: ["최저임금", "최저시급"] },
  fx: { desc: "KOREAN WON only: KRW exchange rates, appreciation and depreciation. Not unrelated dollar/baht news.", kw: ["원화", "원달러", "원·달러"] },
  oil: { desc: "Oil and all energy globally and in Korea: prices, renewable energy, fuels, shortages and oversupply.", kw: ["유가", "원유", "에너지", "연료", "태양광"] },
  thai: { desc: "Thailand, Thai people and businesses, Thai people/restaurants/embassy/events in Korea, marriage visas and E-9 visas. May overlap foreign.", kw: ["태국", "결혼비자", "E-9"] },
  president: { desc: "SOUTH KOREAN president and government only. Not other countries' presidents/governments.", kw: ["대통령", "대통령실", "정부"] },
  hot: { desc: "Viral/trending stories of ANY topic covered by at least THREE independent South Korean news outlets. Use verified publishers in input; do not guess popularity.", kw: [] }
};

const labels = require("../public/categories");
if (Object.keys(labels).sort().join() !== Object.keys(CATS).sort().join()) throw new Error("Category catalogue mismatch");
for (const [key, value] of Object.entries(labels)) Object.assign(CATS[key], value);

// คำบ่งชี้เหตุฉุกเฉิน: ข่าวที่มีคำเหล่านี้ (หรืออยู่หมวดสงครามเกาหลี) ใช้โควตาฉุกเฉินได้
const EMERGENCY_KW = ["미사일 발사", "탄도미사일", "공습경보", "경계경보", "포격", "교전", "계엄", "핵실험", "위기경보", "감염병 위기", "사재기", "대피", "민방위 경보", "전쟁 발발"];

// hint = หมวดที่คาดไว้ของ feed นั้น (AI จะตรวจซ้ำและตัดข่าวที่ไม่เกี่ยวออก)
// take = จำนวนข่าวบนสุดที่หยิบจาก feed นั้นต่อรอบ
const FEEDS = [
  { id: "gn_korwar",    hint: "korwar",    take: 15, korwar: true, url: gn("북한 미사일 OR 북한 도발 OR 합참 OR 군사분계선 OR 남북 군사 OR 공습경보") },
  { id: "gn_war",       hint: "war",       take: 12, url: gn("전쟁 OR 공습 OR 교전 OR 휴전 OR 무력 충돌") },
  { id: "gn_disease",   hint: "disease",   take: 15, url: gn("감염병 OR 전염병 OR 바이러스 확산 OR 질병관리청 OR 유행 주의보") },
  { id: "gn_tech",      hint: "tech",      take: 12, url: gn("인공지능 OR AI 신기술 OR 반도체 OR 기술 혁신") },
  { id: "gn_thai",      hint: "thai",      take: 12, url: gn("태국 OR 주한 태국대사관 OR 한국 태국 음식점 OR 결혼 비자 OR E-9") },
  { id: "gn_immig",     hint: "foreign",   take: 15, url: gn("출입국 단속 OR 불법체류 외국인 OR 외국인 검거 OR 강제퇴거 OR 인종차별 OR 외국인 차별") },
  { id: "gn_top",       hint: "hot",     take: 8,  url: "https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko" },
  { id: "gn_oil_fx",    hint: null,        take: 10, url: gn("국제유가 OR 휘발유 가격 OR 원달러 환율") },
  { id: "gn_foreign", hint: "foreign", take: 12, url: gn("한국 외국인 근로자 OR 고용허가제 OR 고용노동부 외국인 OR 한국 인종차별") },
  { id: "gn_wage", hint: "wage", take: 12, url: gn("한국 최저임금 OR 최저임금위원회 OR 최저시급 인상 OR 한국 임금 체불") },
  { id: "gn_labor",     hint: null,        take: 10, url: gn("한국 최저임금 OR 외국인 노동자 OR 고용허가제 OR 근로기준법 OR 고용노동부") },
  { id: "gn_president", hint: "president", take: 6,  url: gn("한국 대통령 OR 대통령실 OR 한국 정부 정책") },
  // Separate international/category searches so the Korean Peninsula feed cannot dominate collection.
  { id: "gn_war_global", hint: "war", take: 12, url: gn("러시아 우크라이나 전쟁 OR 중동 분쟁 OR 이스라엘 가자 OR 대만 해협") },
  { id: "gn_health_global", hint: "disease", take: 8, url: gn("세계보건기구 감염병 OR 해외 바이러스 확산 OR 국제 감염병 비상") },
  { id: "gn_crypto", hint: "crypto", take: 8, url: gn("암호화폐 OR 비트코인 OR 가상자산 OR 밈코인 OR 스테이블코인") },
  { id: "gn_oil_global", hint: "oil", take: 8, url: gn("국제유가 OR 원유 공급 OR 재생에너지 OR 에너지 부족 OR 연료") },
  { id: "gn_fx_global", hint: "fx", take: 8, url: gn("원달러 환율 OR 원화 강세 OR 원화 약세 OR 원바트 환율") },
  // ฟีดตรงของสำนักข่าว: ได้ลิงก์จริง (ไม่ต้องถอดลิงก์ Google) และหลายเจ้าแนบภาพ/คำโปรยมาในฟีด
  // เก็บเฉพาะข่าวที่ตรงคำค้นของหมวดใดหมวดหนึ่ง ฟีดไหนใช้ไม่ได้จะถูกข้ามอัตโนมัติ
  // หมายเหตุ: ฟีด RSS ของสำนักข่าวอนุญาตให้ใช้ส่วนบุคคล/ไม่แสวงหากำไร
  // korwar: true = ฟีดที่ตรวจซ้ำทุก ~2 นาทีระหว่างรอบ เพื่อจับข่าวสงครามเกาหลีให้เร็วที่สุด
  { id: "yonhaptv",     source: "연합뉴스TV", keywordOnly: true, take: 40, korwar: true, url: "http://www.yonhapnewstv.co.kr/browse/feed/" },
  { id: "yna",          source: "연합뉴스",   keywordOnly: true, take: 50, korwar: true, url: "https://www.yna.co.kr/rss/news.xml" },
  { id: "sbs_flash",    source: "SBS",        keywordOnly: true, take: 40, korwar: true, url: "https://news.sbs.co.kr/news/newsflashRssFeed.do?plink=RSSREADER" },
  { id: "sbs_society",  source: "SBS",        keywordOnly: true, take: 30, url: "https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=03&plink=RSSREADER" },
  { id: "sbs_world",    source: "SBS",        keywordOnly: true, take: 30, url: "https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=07&plink=RSSREADER" },
  { id: "sbs_economy",  source: "SBS",        keywordOnly: true, take: 30, url: "https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=02&plink=RSSREADER" },
  { id: "donga",        source: "동아일보",   keywordOnly: true, take: 40, url: "https://rss.donga.com/total.xml" },
  { id: "khan_society", source: "경향신문",   keywordOnly: true, take: 30, url: "https://www.khan.co.kr/rss/rssdata/society.xml" }
];

module.exports = { CATS, FEEDS, CAT_KEYS: Object.keys(CATS), EMERGENCY_KW };
