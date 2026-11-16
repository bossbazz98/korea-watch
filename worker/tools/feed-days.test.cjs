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
test('at most twenty feeds, four publisher groups and all direct feeds',()=>{const {FEEDS}=require('../feeds');assert(FEEDS.length<=20);assert.equal(FEEDS.filter(f=>f.id.startsWith('publisher_group')).length,4);for(const id of ['yna','sbs_flash','donga'])assert(FEEDS.some(f=>f.id===id))});
test('429 backs off a host for this and subsequent runs',async()=>{const {collect}=require('../lib/collect');let calls=0;const backoff={},now=Date.now(),fetchImpl=async()=>{calls++;return {ok:false,status:429}};await collect({backoff,now,fetchImpl,log:{warn(){}},only:f=>f.url.includes('news.google.com')});assert.equal(calls,1);await collect({backoff,now:now+300000,fetchImpl,log:{warn(){}},only:f=>f.url.includes('news.google.com')});assert.equal(calls,1)});
test('one request budget covers discovery and later watcher polls, including 503 backoff',async()=>{
 const {collect}=require('../lib/collect'),requestBudget={remaining:20},backoff={};let calls=0;
 const fetchImpl=async()=>{calls++;return {ok:true,status:200,text:async()=>'<rss><channel/></rss>'}};
 const options={fetchImpl,requestBudget,backoff,log:{warn(){}}};
 await collect(options);for(let i=0;i<10;i++)await collect({...options,only:f=>f.korwar});assert.equal(calls,20);assert.equal(requestBudget.remaining,0);
 let failed=0;await collect({backoff:{},fetchImpl:async()=>{failed++;return {ok:false,status:503}},only:f=>f.url.includes('news.google.com'),log:{warn(){}}});assert.equal(failed,1);
});
