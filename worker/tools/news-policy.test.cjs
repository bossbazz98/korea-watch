const {test} = require('node:test');
const assert = require('node:assert/strict');
const policy = require('../../public/news-policy');
const {parseFeed} = require('../lib/collect');
const korean = titleKo => ({titleKo, sourceUrl:'https://www.yna.co.kr/view/AKR20261107001',categories:['korwar'],level:'normal'});
const confirmed = [
 ['북한, 한국 연평도에 포격', 'north-attacks-south'],
 ['북한, 동해상으로 탄도미사일 발사', 'north-launch'],
 ['北, 신형 로켓 시험 발사', 'north-launch'],
 ['북한, 초대형 방사포 시험발사', 'north-launch'],
 ['북한, 탄도미사일 쐈다', 'north-launch'],
 ['한국 서울 공습받아 건물 파손', 'south-attacked'],
 ['미사일 한국 영해 인근에 낙하', 'missile-near-south'],
 ['한국군 병사, DMZ에서 대인지뢰 밟아 부상', 'soldier-mine'],
 ['우리 군 장병 목함지뢰 밟고 중상', 'soldier-mine']
];
test('only confirmed incidents in the five requested classes can become critical',()=>{
 for (const [title,reason] of confirmed) {
  const item=korean(title);
  assert.equal(policy.incident(item),reason,title);
  assert.equal(policy.apply(item).level,'critical',title);
 }
});
test('drills, plans, anniversaries, threats, false reports and other emergencies cannot authorize urgent alerts',()=>{
 for (const title of [
  '북한 미사일 발사 가능성 경고', '북한 미사일 발사 준비 징후',
  '북한 미사일 발사 계획', '북한 미사일 발사하지 않겠다', '북한 미사일 발사설', '북한 발사체 포착', '북한 미사일 발사 안 했다', '북한 미사일 발사 사실무근',
  '북한 미사일 발사 규탄 성명', '북한 미사일 발사 10주년', '북한 핵실험', '북한, 러시아의 우크라이나 공격에 한국 비난',
  '북한, 한국 공격 시 보복 경고', '한국, 북한 공격 대비 훈련',
  '한국군 북한 미사일 요격 시험 발사', '우크라이나 군인 대인지뢰 밟아 사망',
  '북한군 병사 대인지뢰 밟아 부상', '한국군 병사 지뢰 발견해 제거',
  '독감 대유행 긴급 경보', '라면 사재기 확산', '서울 지진 긴급 대피',
  '이란 미사일 이스라엘에 발사', '태국인 사고 발생'
 ]) {
  const item={...korean(title),level:'critical',emergency:true};
  assert.equal(policy.incident(item),null,title);
  assert.equal(policy.apply(item).level,'high',title);
  assert.equal(policy.apply(item).emergency,false,title);
 }
});
test('publisher URLs are checked by hostname, not name, country TLD or substring',()=>{
 const title=confirmed[1][0];
 for(const sourceUrl of ['https://reuters.com/a','https://kcna.kp/a','https://yna.co.kr.evil.test/a','https://evil.test/yna.co.kr','https://fake.co.kr/a','javascript:alert(1)'])
  assert.equal(policy.incident({...korean(title),source:'연합뉴스',sourceUrl}),null,sourceUrl);
 assert(policy.incident({...korean(title),sourceUrl:'https://news.google.com/rss/a',publisherUrl:'https://news.kbs.co.kr'}));
 assert.equal(policy.incident({...korean(title),sourceUrl:'https://news.google.com/rss/a'}),null);
 assert.equal(policy.incident({...korean('외국인 노동자 임금 인상'),snippetKo:title}),null,'background snippet is not headline evidence');
});
test('RSS accepts only Korean publishers and preserves Google relay provenance',()=>{
 const xml=publisher=>`<rss><channel><item><title>북한 탄도미사일 발사</title><link>https://news.google.com/rss/articles/a</link><source url="${publisher}">연합뉴스</source><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`;
 const accepted=parseFeed(xml('https://www.yna.co.kr'),{hint:'korwar'},Date.now());
 assert.equal(accepted.length,1);assert.equal(accepted[0].publisherUrl,'https://www.yna.co.kr');assert(accepted[0].emergency);
 assert.equal(parseFeed(xml('https://reuters.com'),{hint:'korwar'},Date.now()).length,0);
});
test('only the 24 requested newsrooms and their verified domain aliases are permitted',()=>{
 assert.equal(policy.PUBLISHERS.length,24);
 for(const p of policy.PUBLISHERS)for(const d of p.domains){
  assert(policy.isKoreanPublisher('https://'+d+'/news'));
  assert(!policy.isKoreanPublisher('https://'+d+'.evil.test/news'));
  assert(!policy.isKoreanPublisher('https://evil.test/'+d));
 }
 for(const d of ['yonhapnewstv.co.kr','seoul.co.kr','mbn.co.kr','tvchosun.com','nocutnews.co.kr','ohmynews.com','pressian.com','edaily.co.kr','mt.co.kr','reuters.com','joins.com'])
  assert(!policy.trusted({publisherUrl:'https://'+d}),d);
 assert.equal(policy.publisherKey('https://en.yna.co.kr/a'),policy.publisherKey('https://www.yna.co.kr/b'));
 assert.equal(policy.publisherKey('https://koreajoongangdaily.joins.com/a'),policy.publisherKey('https://www.joongang.co.kr/b'));
 assert(!policy.trusted({publisherUrl:'https://www.yna.co.kr',sourceUrl:'https://reuters.com/a'}));
});
test('English desks use the same five confirmed incident classes without changing the threshold',()=>{
 const yes=[
  ['North Korea launches ballistic missile','north-launch'],
  ['North Korea has tested new rockets','north-launch'],
  ['North Korea attacks South Korea','north-attacks-south'],
  ['South Korea is shelled','south-attacked'],
  ['Missile falls near South Korea','missile-near-south'],
  ['South Korean soldier stepped on an anti-personnel mine','soldier-mine']
 ];
 for(const [title,reason]of yes)assert.equal(policy.incident(korean(title)),reason,title);
 for(const title of ['North Korea plans missile launch','North Korea missile launch drills','North Korea threatens South Korea','North Korea denies it launched missiles','North Korean officials say US launched a missile','South Korea has not been attacked','North Korea missile launch anniversary','South Korea attacks North Korea'])
  assert.equal(policy.incident(korean(title)),null,title);
});
