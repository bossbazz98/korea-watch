const {test} = require('node:test'), assert = require('node:assert/strict');
const {balancedQueue,retainItems} = require('../lib/scheduler');
const {completeThai,isThai} = require('../../public/news-text');
const make=(id,category,translated=false)=>({id,categories:[category],translated,publishedAt:new Date(1700000000000+Number(id.replace(/\D/g,''))*1000).toISOString()});
test('category rotation gives other topics slots even with a large Korean Peninsula backlog',()=>{
 const pool=[...Array.from({length:60},(_,i)=>make('k'+i,'korwar')), ...['war','disease','food','oil','fx','foreign'].map((c,i)=>make('o'+i,c))];
 const result=balancedQueue(pool,8,{now:0});
 for(const category of ['war','disease','food','oil','fx','foreign'])assert(result.some(i=>i.categories.includes(category)),category);
 assert(result.filter(i=>i.categories.includes('korwar')).length<3);
});
test('retention protects translated other-category news against an untranslated Korean flood',()=>{
 const pool=[...Array.from({length:400},(_,i)=>make('k'+i,'korwar')), ...['war','oil','food','fx'].map((c,i)=>make('o'+i,c,true))];
 const retained=retainItems(pool,250,0);
 for(const c of ['war','oil','food','fx'])assert(retained.some(i=>i.translated&&i.categories.includes(c)));
 assert(retained.filter(i=>!i.translated&&i.categories.includes('korwar')).length<=20);
});
test('a Thai headline alone never makes Korean summary/body a completed translation',()=>{
 assert(!completeThai({title:{th:'หัวข้อภาษาไทย'},summary:{th:'한국어 요약 뉴스'},body:{th:['한국어 본문']}}));
 assert(!completeThai({title:{th:'หัวข้อภาษาไทย'},summary:{th:'สรุปภาษาไทย'},body:{th:['한국어 본문']}}));
 assert(completeThai({title:{th:'หัวข้อภาษาไทย'},summary:{th:'สรุปภาษาไทย'},body:{th:['เนื้อข่าวภาษาไทย']}}));
 assert(!isThai('ข่าว 한국어 본문 제목 뉴스 긴 문장'));
});
