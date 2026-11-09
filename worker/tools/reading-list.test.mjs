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
