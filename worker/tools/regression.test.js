const {test}=require('node:test'),assert=require('node:assert/strict');
const {prepare,persist}=require('../lib/storage');
const {sendMulticast,retryNotifications,sendNews,runOnce}=require('../run');
const {newsId}=require('../lib/collect');
const {similarity}=require('../lib/similar');
const {Quota}=require('../lib/quota');
const {syncIssue}=require('../agent');
function dbFake() {
 const data=new Map(); let failCommit=false;
 const doc=p=>({path:p,id:p.split('/').pop(),async get(){return{exists:data.has(p),data:()=>structuredClone(data.get(p))}},async set(v){data.set(p,structuredClone(v))},async delete(){data.delete(p)},async update(v){data.set(p,{...data.get(p),...v})}});
 return {data,doc,set failCommit(v){failCommit=v},batch(){const writes=[];return{set(r,v){writes.push([r.path,v])},async commit(){if(failCommit)throw Error('storage unavailable');for(const[p,v]of writes)data.set(p,structuredClone(v))}}},collection(col){const filters=[];return{where(k,op,v){filters.push([k,v]);return this},limit(){return this},async get(){const docs=[...data].filter(([p,v])=>p.startsWith(col+'/')&&filters.every(([k,x])=>v[k]===x)).map(([p])=>({id:p.split('/').pop(),ref:doc(p),data:()=>structuredClone(data.get(p))}));return{docs,empty:!docs.length}}}}};
}
const story=(id,translated=true)=>({id,titleKo:'제목 '+id,title:{th:'ข่าว '+id},summary:{th:'สรุป'},body:{th:['เนื้อหา']},categories:['oil'],level:'high',translated,publishedAt:new Date().toISOString()});
const log={warn(){},log(){}};
test('public feed excludes pending; every save bounds document bytes',async()=>{
 const db=dbFake(),items=[story('published'),story('private',false),...Array.from({length:30},(_,i)=>({...story('large'+i),body:{th:['ก'.repeat(20000)]}}))];
 await persist(db,items,{v:8},{a:1},{used:{}});
 assert(!db.data.get('meta/feed').items.some(i=>i.id==='private'));
 assert(db.data.get('meta/pending').items.some(i=>i.id==='private'));
 assert(Buffer.byteLength(JSON.stringify(db.data.get('meta/feed')))<850000);
 assert(prepare(items,10000).published.length<items.length);
});
test('atomic publication failure does not advance seen, quota, or notification outbox',async()=>{
 const db=dbFake();db.failCommit=true;
 await assert.rejects(persist(db,[story('x')],{v:8},{x:1},{used:{}},[{news:story('x')}]),/storage unavailable/);
 assert.equal(db.data.size,0);
});
test('runOnce propagates storage failure and does not acknowledge fixes',async()=>{
 const db=dbFake();db.data.set('meta/feed',{v:8,items:[story('x')]});db.data.set('fixJobs/f',{action:'enrich',itemId:'x'});db.failCommit=true;
 await assert.rejects(runOnce({db,messaging:{},appUrl:'https://example.test',budgetMs:1000,imgBudgetMs:0,fetchImpl:async()=>({ok:true,text:async()=>'<rss><channel/></rss>'}),log}),/storage unavailable/);
 assert(db.data.has('fixJobs/f'));assert(!db.data.has('meta/status'));
});
test('FCM partial failure retries only failed recipients and retains receipts',async()=>{
 const db=dbFake(),subs=['a','b'].map(id=>({ref:db.doc('subscribers/'+id),token:id,subscriptionVersion:2,enabled:true}));for(const s of subs)await s.ref.set({token:s.token,subscriptionVersion:2,enabled:true});
 const message={notification:{title:'test',body:'body'},data:{id:'news1',level:'high'}};
 let first=true,calls=[];const messaging={async sendEachForMulticast(m){calls.push(m.tokens);if(first){first=false;return{successCount:1,responses:[{success:true},{success:false,error:{code:'messaging/server-unavailable'}}]}}return{successCount:m.tokens.length,responses:m.tokens.map(()=>({success:true}))}}};
 await sendMulticast(db,messaging,subs,message,log);
 const job=[...db.data].find(([p,v])=>p.startsWith('notificationJobs/')&&v.status==='pending');assert.deepEqual(job[1].recipients.map(r=>r.id),['b']);job[1].nextAttemptAt=0;
 await retryNotifications(db,messaging,log);assert.deepEqual(calls,[['a','b'],['b']]);
 await sendMulticast(db,messaging,subs,message,log);assert.equal(calls.length,2);
});
test('four-news budget is shared across fast calls; remainder has one summary',async()=>{
 const db=dbFake();await db.doc('subscribers/a').set({token:'a',subscriptionVersion:2,enabled:true,cats:['oil'],level:'all'});
 const sent=[],messaging={async sendEachForMulticast(m){sent.push(m);return{successCount:1,responses:[{success:true}]}}};
 const context={count:new Map(),subs:null,extra:new Map(),deferSummary:true};
 for(let i=0;i<7;i++)await sendNews(db,messaging,[story('n'+i)],'https://example.test',log,context);
 context.deferSummary=false;await sendNews(db,messaging,[],'https://example.test',log,context);
 assert.equal(sent.filter(m=>m.data.level!=='summary').length,4);assert.equal(sent.filter(m=>m.data.level==='summary').length,1);assert.match(sent.at(-1).notification.body,/3/);
});
test('identity uses full headline, link, and date; differing numbers never merge',()=>{
 const title='북'.repeat(50);assert.notEqual(newsId(title+'1'),newsId(title+'2'));
 assert.notEqual(newsId(title,'https://a','2026-11-01'),newsId(title,'https://a','2026-11-02'));
 assert.equal(similarity('ราคาน้ำมันในเกาหลีเพิ่มขึ้น 10 เปอร์เซ็นต์','ราคาน้ำมันในเกาหลีเพิ่มขึ้น 90 เปอร์เซ็นต์'),0);
});
test('in-flight AI reservations stop parallel requests exceeding reserve',()=>{
 const q=new Quota(),tag='groq:openai/gpt-oss-20b';q.record(tag,155000);
 const settle=q.reserve(tag,3000);assert.equal(typeof settle,'function');assert.equal(q.reserve(tag,3000),null);settle(500);assert.equal(q.used[tag].tokens,155500);assert.equal(q.inFlight[tag].requests,0);
});
test('GitHub HTTP denial cannot be reported as an opened issue',async()=>{
 await assert.rejects(syncIssue({token:'fake',repo:'test/test',reportable:[{what:'x'}],body:'x',fetchImpl:async()=>({ok:false,status:403,json:async()=>({})})}),/HTTP 403/);
});
test('retry respects quiet hours without dropping the pending recipient',async()=>{
 const db=dbFake(),hour=new Date(Date.now()+9*3600e3).getUTCHours();
 await db.doc('subscribers/a').set({token:'a',enabled:true,subscriptionVersion:2,quietOn:true,quietFrom:hour,quietTo:(hour+1)%24});
 await db.doc('notificationJobs/j').set({status:'pending',attempts:1,nextAttemptAt:0,expiresAt:Date.now()+3600000,recipients:[{id:'a',token:'a'}],msg:{data:{id:'x',level:'high',categories:'["oil"]'},notification:{title:'x'}}});
 let calls=0;await retryNotifications(db,{async sendEachForMulticast(){calls++;throw Error('should not send')}},log);
 assert.equal(calls,0);assert.equal(db.data.get('notificationJobs/j').recipients.length,1);assert(db.data.get('notificationJobs/j').nextAttemptAt>Date.now());
});
test('emergency budget counts distinct stories, not title/body calls, and reserves before awaiting',()=>{
 const q=new Quota();const a=q.claimEmergency(['a','b']);assert.equal(a.count,2);assert.equal(q.claimEmergency(['c','d']),null);assert.equal(q.claimEmergency(['a']).count,0);a.rollback();assert.equal(q.emergencyLeft(),3);assert.equal(q.claimEmergency(['c','d','e']).count,3);assert.equal(q.claimEmergency(['f']),null);
});
