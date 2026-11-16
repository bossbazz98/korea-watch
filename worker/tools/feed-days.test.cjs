const {test}=require('node:test');
const assert=require('node:assert/strict');
const {persist,load,migrate,dayDocuments}=require('../lib/storage');
function database(){const data=new Map(),writes=[];const doc=path=>({path,get:async()=>({exists:data.has(path),data:()=>data.get(path)}),set:async v=>{writes.push(path);data.set(path,v)},delete:async()=>{writes.push(path);data.delete(path)}});return {data,writes,doc,collection:name=>({get:async()=>({docs:[...data].filter(([p])=>p.startsWith(name+'/')).map(([p,v])=>({id:p.split('/')[1],data:()=>v}))})})}}
test('900 multilingual records survive day splitting; only expiry deletes; unchanged days cost no writes',async()=>{
 const db=database(),now=Date.now();
 const items=Array.from({length:900},(_,i)=>({id:String(i),translated:true,publishedAt:new Date(now-(i%30)*86400000).toISOString(),body:{th:['ข่าว'.repeat(550)],en:['news '.repeat(550)],ko:['한국어'.repeat(550)]}}));
 items.push({...items[0],id:'expired',publishedAt:new Date(now-31*86400000).toISOString()});
 await persist(db,items,{updatedAt:new Date(now).toISOString()});assert.equal((await load(db)).length,900);assert(!(await load(db)).some(i=>i.id==='expired'));
 for(const [path,value]of db.data)if(path.startsWith('feedDays/'))assert(Buffer.byteLength(JSON.stringify(value))<=800000);
 assert(db.data.get('meta/feed').items.length<=60);
 db.writes.length=0;await persist(db,items,{updatedAt:new Date(now+1).toISOString()});assert(!db.writes.some(p=>p.startsWith('feedDays/')));
 const split=dayDocuments(Array.from({length:100},(_,i)=>({...items[0],id:String(i)})));assert(split.size>1);
});
test('migration preserves public and private records, including expired records, and is idempotent',async()=>{
 const db=database();db.data.set('meta/feed',{items:[{id:'a',translated:true,publishedAt:'2020-01-01'}]});db.data.set('meta/pending',{items:[{id:'b',publishedAt:'2020-01-01'},{id:'a',translated:false,publishedAt:'2020-01-01'}]});
 await migrate(db);assert.equal((await load(db)).length,2);assert((await load(db)).find(i=>i.id==='a').translated);await migrate(db);assert.equal((await load(db)).length,2);assert.equal(db.data.get('meta/pending').items.length,0);
});
test('at most twenty feeds, two publisher groups covering all newsrooms, topic hints kept and all direct feeds',()=>{const {FEEDS}=require('../feeds'),{PUBLISHERS}=require('../../public/news-policy');assert(FEEDS.length<=20);assert.equal(FEEDS.filter(f=>f.id.startsWith('publisher_group')).length,2);const q=FEEDS.filter(f=>f.id.startsWith('publisher_group')).map(f=>decodeURIComponent(f.url)).join(' ');for(const p of PUBLISHERS)assert(q.includes('site:'+p.domains[0]));assert(FEEDS.filter(f=>f.url.includes('news.google.com')).length<=13);for(const [id,hint] of [['gn_korwar','korwar'],['gn_war','war'],['gn_disease','disease'],['gn_foreign','foreign']])assert.equal(FEEDS.find(f=>f.id===id).hint,hint);assert(FEEDS.find(f=>f.id==='gn_korwar').korwar);for(const f of FEEDS.filter(f=>f.url.includes('news.google.com')))assert(new URL(f.url).searchParams.get('q').split(/\s+/).length<=85,f.id);for(const id of ['yna','sbs_flash','donga'])assert(FEEDS.some(f=>f.id===id))});
test('429 backs off a host for this and subsequent runs',async()=>{const {collect}=require('../lib/collect');let calls=0;const backoff={},now=Date.now(),fetchImpl=async()=>{calls++;return {ok:false,status:429}};await collect({backoff,now,fetchImpl,log:{warn(){}},only:f=>f.url.includes('news.google.com')});assert.equal(calls,1);await collect({backoff,now:now+300000,fetchImpl,log:{warn(){}},only:f=>f.url.includes('news.google.com')});assert.equal(calls,1)});
test('one request budget covers discovery and later watcher polls, including 503 backoff',async()=>{
 const {collect}=require('../lib/collect'),requestBudget={remaining:20},backoff={};let calls=0;
 const fetchImpl=async()=>{calls++;return {ok:true,status:200,text:async()=>'<rss><channel/></rss>'}};
 const options={fetchImpl,requestBudget,backoff,log:{warn(){}}};
 await collect(options);for(let i=0;i<10;i++)await collect({...options,only:f=>f.korwar});assert.equal(calls,20);assert.equal(requestBudget.remaining,0);
 let failed=0;await collect({backoff:{},fetchImpl:async()=>{failed++;return {ok:false,status:503}},only:f=>f.url.includes('news.google.com'),log:{warn(){}}});assert.equal(failed,1);
});
test('Spark quota: a run reads each collection once and the backlog is stored in a few chunk documents',async()=>{
 const db=database();let reads=0;const get=db.collection;db.collection=name=>({get:async()=>{const r=await get(name).get();reads+=r.docs.length;return r}});
 const now=Date.now(),published=Array.from({length:900},(_,i)=>({id:'p'+i,translated:true,publishedAt:new Date(now-(i%30)*86400000).toISOString(),body:{th:['ข่าว'.repeat(500)]}}));
 const backlog=Array.from({length:1500},(_,i)=>({id:'q'+i,translated:false,titleKo:'한국어 제목 '.repeat(8),snippet:'요약 '.repeat(150),publishedAt:new Date(now-(i%7)*86400000).toISOString()}));
 await persist(db,[...published,...backlog],{},null,null,[],{now});
 const items=await load(db);const afterLoad=reads;
 assert.equal(items.length,2400);
 const chunks=[...db.data.keys()].filter(p=>p.startsWith('pending/'));assert(chunks.length<=8,'pending docs '+chunks.length);
 db.writes.length=0;items.find(i=>i.id==='q0').lastTry=now;
 for(let k=0;k<4;k++)await persist(db,items,{},null,null,[],{now});
 assert.equal(reads,afterLoad,'saves within a run must not re-read collections');
 assert(db.writes.filter(p=>p.startsWith('pending/')).length<=1,'one changed record rewrites one chunk once');
 assert(!db.writes.some(p=>p.startsWith('feedDays/')));
 const old={id:'stale',translated:false,publishedAt:new Date(now-8*86400000).toISOString()};
 await persist(db,[...items,old],{},null,null,[],{now});assert(!(await load(db)).some(i=>i.id==='stale'),'untranslated backlog older than 7 days is dropped');
 assert((await load(db)).some(i=>i.id==='p29'),'published history keeps 30 days');
});
