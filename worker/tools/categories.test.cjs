const {test}=require('node:test'),assert=require('node:assert/strict');
const labels=require('../../public/categories');
const category=require('../../public/category-policy');
const {CATS,FEEDS}=require('../feeds');
const {parseFeed,mergeSimilar}=require('../lib/collect');
const base={publisherUrl:'https://www.yna.co.kr'};
const classify=(titleKo,proposed=[])=>category.classify({...base,titleKo},proposed);
test('catalogue has exactly the requested twelve topics in order; All is a separate aggregate',()=>{
 assert.deepEqual(Object.keys(labels),['korwar','war','disease','tech','crypto','foreign','wage','fx','oil','thai','president','hot']);
 assert.deepEqual(Object.keys(CATS),Object.keys(labels));
 assert(!FEEDS.some(feed=>['food','korea','law'].includes(feed.hint)));
 for(const key of ['tech','crypto','foreign','wage','fx','hot'])assert(FEEDS.some(feed=>feed.hint===key),key);
});
test('country/topic guards reject unrelated wars, foreign wages, other presidents and non-won currencies',()=>{
 for(const title of ['캄보디아 전투 준비 태세 강화','캄보디아 태국 국경 교전','러시아군 전쟁 준비','北京 국제 회의']) assert(!classify(title,['korwar']).includes('korwar'),title);
 for(const title of ['북한 탄도미사일 발사','한미연합 군사훈련','남북 군사회담 제안'])assert(classify(title).includes('korwar'),title);
 assert(classify('캄보디아 태국 국경 교전').includes('war'));
 assert(!classify('캄보디아 전투 준비 태세 강화').includes('war'),'readiness alone is not actual fighting');
 assert(!classify('반도체 가격 전쟁',['war']).includes('war'));
 assert(!category.classify({...base,titleKo:'캄보디아 전투 준비',snippet:'북한 미사일 군사훈련 배경 설명'},['korwar']).includes('korwar'),'background snippets cannot move a foreign headline into the Korean Peninsula');
 assert(!classify('AI 전쟁 치열',['war']).includes('war'));
 assert(!classify('캄보디아 전쟁 준비',['war']).includes('war'));
 assert(!classify('컴퓨터 바이러스 악성코드',['disease']).includes('disease'));
 assert(classify('한국군 병사 대인지뢰 밟아 부상').includes('korwar'));
 assert(classify('한국 서울 공습받아 피해').includes('korwar'));
 assert(!classify('북한 임금 상승',['wage']).includes('wage'));
 assert(!classify('미국 대통령 국내 지지율',['president']).includes('president'));
 assert(!classify('일본 최저임금 인상',['wage']).includes('wage'));
 assert(!classify('일본 외국인 노동자 시위',['foreign']).includes('foreign'));
 assert(!classify('트럼프 미국 대통령 발표',['president']).includes('president'));
 assert(!classify('달러 강세 바트 환율',['fx']).includes('fx'));
});
test('all newly requested scopes are discoverable from original source facts',()=>{
 const examples={
  disease:['신종 바이러스 감염병 확산','세계 백신 개발 발표'], tech:['인공지능 AI 반도체 신기술','로봇 양자 기술 혁신'],
  crypto:['유명인 밈코인 출시 비트코인','태국 암호화폐 결제 허용'], foreign:['한국 외국인 노동자 파업','고용노동부 고용허가제 개편','한국 이주민 인종차별 반대 시위'],
  wage:['한국 최저임금법 개정','최저임금위원회 내년 시급 인상','한국 임금 체불 급여 관련 노동법'], fx:['원화 약세 원달러 환율 급등'],
  oil:['국제유가 원유 공급 과잉','재생에너지 태양광 풍력 확대','세계 연료 부족'],
  thai:['주한 태국대사관 태국 음식 축제','한국 결혼 비자 E-9 개편','태국 현지 뉴스'],president:['한국 대통령 정부 정책','대통령실 국무회의 발표']
 };
 for(const [key,titles]of Object.entries(examples))for(const title of titles)assert(classify(title).includes(key),key+': '+title);
 for(const key of ['foreign','wage','fx','thai','president']) {
  assert(!category.classify({titleKo:examples[key][0],publisherUrl:'https://reuters.com'},[key]).includes(key),key+' must use Korean outlets');
 }
});
test('trending requires three independent verified Korean publishers, including nonpolitical stories',()=>{
 const item={...base,titleKo:'유명 배우 결혼 소식',publishers:['https://www.yna.co.kr','https://news.sbs.co.kr','https://news.kbs.co.kr']};
 assert(category.classify(item,[]).includes('hot'));
 assert(!category.classify({...item,publishers:['https://www.yna.co.kr','https://en.yna.co.kr','https://reuters.com']},['hot']).includes('hot'));
 const now=new Date().toISOString();
 const list=['https://www.yna.co.kr','https://news.sbs.co.kr','https://news.kbs.co.kr'].map((publisherUrl,i)=>({id:''+i,...item,publishers:[publisherUrl],publisherUrl,sourceUrl:publisherUrl,link:publisherUrl+'/a',source:'outlet'+i,cats:[],publishedAt:now}));
 const merged=mergeSimilar(list);assert.equal(merged.length,1);assert(merged[0].cats.includes('hot'));
});
test('RSS query hints cannot force Cambodia into Korean conflict',()=>{
 const xml='<rss><channel><item><title>캄보디아 전투 준비 태세 강화</title><link>https://www.yna.co.kr/a</link></item></channel></rss>';
 assert.equal(parseFeed(xml,{hint:'korwar'},Date.now()).length,0);
});
test('legacy preferences migrate without showing deleted topics or losing current choices',()=>{
 assert.deepEqual(category.migratePreferences(['law','food','korea','foreign','korwar','invalid']),['foreign','hot','korwar']);
 assert.deepEqual(category.classify({...base,titleKo:'캄보디아 전투 준비 태세 강화'},['korwar','korea','food','law']),[]);
});

test('country and won evidence from the source article survives publication and later display',()=>{
 const input={...base,titleKo:'환율 상승 소식',article:'한국 원화 약세가 이어졌다.'};
 const categoryEvidence=category.evidenceOf(input);
 assert(categoryEvidence.includes('원화'));
 assert(category.classify({...base,titleKo:input.titleKo,categoryEvidence},['fx']).includes('fx'));
 assert(categoryEvidence.length<=512);
});
