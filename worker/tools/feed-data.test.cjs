const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const labels=require('../../public/categories'),news=require('../../public/news-policy'),category=require('../../public/category-policy'),text=require('../../public/news-text');
Object.assign(globalThis,{KW_CATEGORIES:labels,KW_NEWS_POLICY:news,KW_CATEGORY_POLICY:category,KW_NEWS_TEXT:text});
const story=i=>({id:'story'+i,titleKo:'인공지능 반도체 발표',title:{th:'ข่าวภาษาไทย '+i},summary:{th:'สรุปข่าวภาษาไทย'},body:{th:['เนื้อหาข่าวภาษาไทย']},categories:['tech'],translated:true,publishedAt:new Date().toISOString(),sourceUrl:'https://www.yna.co.kr/'+i});
test('reproduce the reported mixed-version publisherKey exception',()=>{
 const context={KW_CATEGORIES:labels,KW_NEWS_POLICY:{...news,publisherKey:undefined}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../../public/category-policy'),'utf8'),context);
 assert.throws(()=>context.KW_CATEGORY_POLICY.classify(story(1),['tech']),/function/);
 assert(category.classify(story(1),['tech']).includes('tech'));
});
test('184 complete published stories survive legacy/null link and category shapes',async()=>{
 const {normalizeFeed}=await import('../../public/feed-data.js');
 const input=Array.from({length:184},(_,i)=>story(i));
 input[0].links=[null,{},'old'];input[1].links={old:true};input[2].categories='tech';input[3].publishers={old:true};input[4].alts=[null];
 const result=normalizeFeed(input);
 assert.equal(result.items.length,184);assert.equal(result.errors.length,0);
 assert(result.items.every(i=>i.translated));assert(result.items.every(i=>i.categories.includes('tech')));
});
test('Firestore timestamp variants normalize to the same publication date',async()=>{
 const {timestamp,normalizeFeed}=await import('../../public/feed-data.js');
 const now=Math.floor(Date.now()/1000)*1000;
 for(const value of [new Date(now).toISOString(),new Date(now),{seconds:now/1000,nanoseconds:0},{_seconds:now/1000,_nanoseconds:0},{toMillis:()=>now}]){
  assert.equal(timestamp(value),now);assert.equal(normalizeFeed([{...story(1),publishedAt:value}]).items[0].publishedAt,new Date(now).toISOString());
 }
});
test('one bad record cannot throw away the rest of a published feed',async()=>{
 const {normalizeFeed}=await import('../../public/feed-data.js');
 const result=normalizeFeed([null,{},story(1),story(2)]);
 assert.equal(result.items.length,2);assert.equal(result.errors.length,2);
 assert.throws(()=>normalizeFeed({items:[]}),/Invalid feed/);
});
test('all versioned runtime dependencies are precached and have no-cache Hosting coverage',()=>{
 const source=fs.readFileSync(require.resolve('../../public/app.js'),'utf8')+fs.readFileSync(require.resolve('../../public/feed-data.js'),'utf8');
 const imports=[...source.matchAll(/import.*?['"]\.\/(.*?\?v=[^'"]+)['"]/g)].map(m=>'/'+m[1]);
 const manifest={};vm.runInNewContext(fs.readFileSync(require.resolve('../../public/cache-manifest.js'),'utf8'),{self:manifest});
 assert(imports.length>=4);
 for(const url of imports)assert(manifest.KW_PRECACHE.includes(url),url);
 const config=require('../../firebase.json');
 const header=config.hosting.headers.find(h=>h.source.startsWith('/@('));
 for(const file of ['news-policy.js','category-policy.js','feed-data.js','pull-refresh.js'])assert(header.source.includes(file));
});
