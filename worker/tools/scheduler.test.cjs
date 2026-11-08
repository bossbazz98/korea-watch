const {test} = require('node:test'), assert = require('node:assert/strict');
const {balancedQueue,retainItems} = require('../lib/scheduler');
const {completeThai,isThai} = require('../../public/news-text');
const make=(id,category,translated=false)=>({id,categories:[category],translated,publishedAt:new Date(1700000000000+Number(id.replace(/\D/g,''))*1000).toISOString()});
test('empty tech and foreign-worker categories lead a small budget regardless of clock rotation',()=>{
 const keys=['war','tech','foreign','oil'];
 const pool=keys.map((c,i)=>make('a'+i,c));
 for(let shift=0;shift<keys.length;shift++) {
  const result=balancedQueue(pool,2,{now:shift*300000,categoryKeys:keys,publishedCounts:{war:7,tech:0,foreign:0,oil:4}});
  assert.deepEqual(new Set(result.flatMap(i=>i.categories)),new Set(['tech','foreign']));
 }
});
test('repeatedly failed newer articles do not starve an untried candidate in their category',()=>{
 const old=make('a1','tech'),fresh={...make('a9','tech'),lastTry:123,attempts:1};
 assert.equal(balancedQueue([fresh,old],1,{categoryKeys:['tech']})[0].id,old.id);
});
test('category rotation gives other topics slots even with a large Korean Peninsula backlog',()=>{
 const pool=[...Array.from({length:60},(_,i)=>make('k'+i,'korwar')), ...['war','disease','tech','oil','fx','foreign'].map((c,i)=>make('o'+i,c))];
 const result=balancedQueue(pool,8,{now:0});
 for(const category of ['war','disease','tech','oil','fx','foreign'])assert(result.some(i=>i.categories.includes(category)),category);
 assert(result.filter(i=>i.categories.includes('korwar')).length<3);
});
test('retention protects translated other-category news against an untranslated Korean flood',()=>{
 const pool=[...Array.from({length:400},(_,i)=>make('k'+i,'korwar')), ...['war','oil','tech','fx'].map((c,i)=>make('o'+i,c,true))];
 const retained=retainItems(pool,250,0);
 for(const c of ['war','oil','tech','fx'])assert(retained.some(i=>i.translated&&i.categories.includes(c)));
 assert(retained.filter(i=>!i.translated&&i.categories.includes('korwar')).length<=20);
});
test('a Thai headline alone never makes Korean summary/body a completed translation',()=>{
 assert(!completeThai({title:{th:'หัวข้อภาษาไทย'},summary:{th:'한국어 요약 뉴스'},body:{th:['한국어 본문']}}));
 assert(!completeThai({title:{th:'หัวข้อภาษาไทย'},summary:{th:'สรุปภาษาไทย'},body:{th:['한국어 본문']}}));
 assert(completeThai({title:{th:'หัวข้อภาษาไทย'},summary:{th:'สรุปภาษาไทย'},body:{th:['เนื้อข่าวภาษาไทย']}}));
 assert(!isThai('ข่าว 한국어 본문 제목 뉴스 긴 문장'));
});
