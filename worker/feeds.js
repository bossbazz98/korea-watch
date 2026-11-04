// แหล่งข่าวและคำค้นของแต่ละหมวด แก้ไฟล์นี้ไฟล์เดียวเพื่อเพิ่ม/ลดแหล่งข่าวหรือคำค้น
// Google News RSS ค้นข่าวจากสำนักข่าวเกาหลีทุกเจ้า (KBS, MBC, SBS, YTN, 연합뉴스, JTBC ฯลฯ)

const gn = q =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q + " when:1d")}&hl=ko&gl=KR&ceid=KR:ko`;

// ลำดับในรายการนี้ = ลำดับความสำคัญเวลาเลือกข่าวไปแปล
const CATS = {
  korwar:    { th: "สงครามเกาหลี", desc: "Korean Peninsula conflict: North Korean military actions, missiles, nuclear tests, DMZ/border incidents, inter-Korean tension, ROK-US drills, air-raid/civil-defence alerts in Korea",
               // ไม่ใช้ "北" หรือ "도발" เดี่ยวๆ (北 ติดชื่อเมือง 北京 / 도발 ใช้ในข่าวการเมืองทั่วไป) ใช้เฉพาะคำที่ชี้ชัดว่าเป็นเกาหลีเหนือ/การทหาร
               kw: ["북한", "北 ", "北,", "北미사일", "北 미사일", "北 도발", "北 핵", "北군", "대북", "북측", "탄도미사일", "남북", "군사분계선", "비무장지대", "DMZ", "휴전선", "합참", "합동참모본부", "북한군", "핵실험", "북핵", "연평도", "공습경보", "민방위 훈련", "김정은", "김여정", "한미연합", "을지"] },
  war:       { th: "สงครามทั่วโลก", desc: "wars and security crises elsewhere in the world (Ukraine-Russia, Middle East, Taiwan Strait etc.), NOT the Korean Peninsula",
               kw: ["전쟁", "공습", "교전", "휴전", "우크라이나", "러시아군", "이스라엘", "가자", "이란", "중동", "하마스", "헤즈볼라", "대만해협", "분쟁", "나토", "NATO"] },
  disease:   { th: "โรคติดต่อ/ไวรัส", desc: "infectious diseases, viruses and outbreaks in Korea",
               kw: ["감염병", "전염병", "바이러스", "확진", "독감", "인플루엔자", "코로나", "질병관리청", "유행", "엠폭스", "결핵", "홍역", "조류인플루엔자", "백신", "팬데믹"] },
  food:      { th: "อาหาร/กักตุน", desc: "food supply, panic buying, shortages of daily goods",
               kw: ["사재기", "품귀", "생필품", "품절", "식량", "쌀값", "라면", "장보기", "물가 급등", "공급 부족", "비축"] },
  thai:      { th: "คนไทยในเกาหลี", desc: "Thai nationals in Korea, AND immigration enforcement, arrests/crackdowns on foreigners, deportation, detention, racism or discrimination against foreigners in Korea",
               kw: ["태국인", "태국 국적", "태국 노동자", "태국 출신", "주한 태국", "태국대사관", "태국", "출입국", "출입국관리", "불법체류", "강제퇴거", "외국인 보호소", "외국인보호소", "외국인 검거", "외국인 체포", "외국인 범죄", "외국인 단속", "불법체류 단속", "출입국 단속", "인종차별", "외국인 차별", "이주민 차별", "외국인 혐오", "인종 혐오"] },
  korea:     { th: "ข่าวในเกาหลี", desc: "other important general news in South Korea", kw: [] },
  oil:       { th: "น้ำมัน", desc: "oil and fuel prices", kw: ["유가", "휘발유", "경유", "기름값", "국제유가", "주유소"] },
  fx:        { th: "ค่าเงิน", desc: "exchange rates, the won", kw: ["환율", "원달러", "원·달러", "원화", "달러 강세", "바트"] },
  wage:      { th: "ค่าแรงขั้นต่ำ", desc: "minimum wage", kw: ["최저임금", "최저시급"] },
  foreign:   { th: "แรงงานต่างชาติ", desc: "foreign workers, EPS/E-9 visas, work permits", kw: ["외국인 노동자", "이주노동자", "외국인 근로자", "고용허가제", "E-9", "불법체류", "출입국", "비자"] },
  law:       { th: "กฎหมายแรงงาน", desc: "labour law changes", kw: ["근로기준법", "노동법", "주 52시간", "노란봉투법", "산업안전", "중대재해", "퇴직금"] },
  president: { th: "ประธานาธิบดี", desc: "the South Korean president and presidential office", kw: ["대통령", "대통령실", "청와대"] }
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
  { id: "gn_war",       hint: "war",       take: 12, url: gn("우크라이나 전쟁 OR 중동 전쟁 OR 이스라엘 공습 OR 이란 공습 OR 대만해협") },
  { id: "gn_disease",   hint: "disease",   take: 15, url: gn("감염병 OR 전염병 OR 바이러스 확산 OR 질병관리청 OR 유행 주의보") },
  { id: "gn_food",      hint: "food",      take: 12, url: gn("사재기 OR 품귀 OR 생필품 부족 OR 쌀값 급등") },
  { id: "gn_thai",      hint: "thai",      take: 12, url: gn("태국인 OR 태국 노동자 OR 태국 국적") },
  { id: "gn_immig",     hint: "thai",      take: 15, url: gn("출입국 단속 OR 불법체류 외국인 OR 외국인 검거 OR 강제퇴거 OR 인종차별 OR 외국인 차별") },
  { id: "gn_top",       hint: "korea",     take: 8,  url: "https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko" },
  { id: "gn_oil_fx",    hint: null,        take: 10, url: gn("국제유가 OR 휘발유 가격 OR 원달러 환율") },
  { id: "gn_labor",     hint: null,        take: 10, url: gn("최저임금 OR 외국인 노동자 OR 고용허가제 OR 근로기준법") },
  { id: "gn_president", hint: "president", take: 6,  url: gn("대통령실 OR 대통령 발표") },
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
