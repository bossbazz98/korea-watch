import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReadingList } from '../../public/reading-list.js';
function memory(initial = null) { const map = new Map(initial ? [['kw.readingList',initial]] : []);return {getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value)}; }
const article = { id:'old-news',title:{th:'ข่าวที่บันทึกไว้'},publishedAt:'2020-01-01T00:00:00Z',body:{th:['ยังอ่านเนื้อหาได้แม้ออกจากฟีด']},sourceUrl:'https://www.yna.co.kr/view/1' };
test('a saved snapshot remains readable offline after it expires from the live feed',()=>{
  const storage=memory();const first=createReadingList(storage);first.save(article);article.body.th.push('ข้อความที่เปลี่ยนภายหลัง');
  const restored=createReadingList(storage);assert(restored.has(article.id));assert.equal(restored.get(article.id).body.th.length,1);assert.equal(restored.all().length,1);assert(restored.all()[0].savedAt>0);
});
test('saving again is unique and removal persists across restart',()=>{
  const storage=memory(),list=createReadingList(storage);list.save(article);list.save(article);assert.equal(list.all().length,1);list.remove(article.id);assert.equal(createReadingList(storage).all().length,0);
});
test('damaged local data does not crash the feed and storage-full errors preserve saved news',()=>{
  assert.deepEqual(createReadingList(memory('{bad-json')).all(),[]);
  assert.deepEqual(createReadingList(memory('[null,{"id":"bad"}]')).all(),[]);
  const storage=memory(),list=createReadingList(storage);list.save(article);storage.setItem=()=>{throw Error('QuotaExceededError')};
  assert.throws(()=>list.remove(article.id));assert(list.has(article.id));assert.throws(()=>list.save({...article,id:'new'}));assert(!list.has('new'));
});

test('saved snapshots acquire new language editions without changing their order or save dates',()=>{
 const data=new Map(),storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
 const list=createReadingList(storage);
 list.save({id:'one',title:{th:'ข่าวที่บันทึกไว้'},summary:{th:'สรุปข่าว'},body:{th:['เนื้อข่าว']}});
 const savedAt=list.all()[0].savedAt;
 const translated={id:'one',title:{th:'ข่าวที่บันทึกไว้',en:'Saved story',ko:'저장한 기사'},summary:{th:'สรุปข่าว',en:'Summary',ko:'요약'},body:{th:['เนื้อข่าว'],en:['Article text'],ko:['기사 본문']}};
 list.refresh([translated]);assert.equal(list.all()[0].savedAt,savedAt);
 list.refresh([{...translated,title:{th:translated.title.th},summary:{th:translated.summary.th},body:{th:translated.body.th}}]);
 const offline=createReadingList(storage);assert.equal(offline.get('one').summary.ko,'요약');assert.deepEqual(offline.get('one').body.en,['Article text']);
 list.refresh([]);assert.equal(list.get('one').title.en,'Saved story');
});
