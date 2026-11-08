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
test('empty HTTP 200 completion falls back to another model without losing quota accounting',async()=>{
 const {translateTitles}=require('../lib/translate');
 for(const empty of ['', '   ']) {
  const calls=[],quota=new Quota();
  const result=await translateTitles([{titleKo:'국제 뉴스'}],{
   githubToken:'test',githubModels:['empty-model','working-model'],quota,log,waitMs:0,
   fetchImpl:async(url,options)=>{
    const model=JSON.parse(options.body).model;calls.push(model);
    return{ok:true,status:200,json:async()=>({choices:[{message:{content:model==='empty-model'?empty:JSON.stringify({items:[{i:0,th:'ข่าวต่างประเทศ',en:'World news'}]})},finish_reason:'stop'}],usage:{total_tokens:12}})};
   }
  });
  assert.deepEqual(calls,['empty-model','working-model']);
  assert.equal(result.results[0].th,'ข่าวต่างประเทศ');
  assert.equal(quota.used['github:empty-model'].requests,1);
  assert.equal(quota.used['github:working-model'].requests,1);
 }
});
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
 const message={notification:{title:'test',body:'body'},data:{id:'news1',level:'critical',titleKo:'북한 탄도미사일 발사',publisherUrl:'https://www.yna.co.kr'}};
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
 for(let i=0;i<7;i++)await sendNews(db,messaging,[{...story('n'+i),titleKo:'북한 탄도미사일 발사',sourceUrl:'https://www.yna.co.kr'}],'https://example.test',log,context);
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
 await db.doc('subscribers/a').set({token:'a',enabled:true,subscriptionVersion:2,quietBypass:false,quietOn:true,quietFrom:hour,quietTo:(hour+1)%24});
 await db.doc('notificationJobs/j').set({status:'pending',attempts:1,nextAttemptAt:0,expiresAt:Date.now()+3600000,recipients:[{id:'a',token:'a'}],msg:{data:{id:'x',level:'critical',categories:'["korwar"]',titleKo:'북한 탄도미사일 발사',publisherUrl:'https://www.yna.co.kr'},notification:{title:'x'}}});
 let calls=0;await retryNotifications(db,{async sendEachForMulticast(){calls++;throw Error('should not send')}},log);
 assert.equal(calls,0);assert.equal(db.data.get('notificationJobs/j').recipients.length,1);assert(db.data.get('notificationJobs/j').nextAttemptAt>Date.now());
});
test('emergency budget counts distinct stories, not title/body calls, and reserves before awaiting',()=>{
 const q=new Quota();const a=q.claimEmergency(['a','b']);assert.equal(a.count,2);assert.equal(q.claimEmergency(['c','d']),null);assert.equal(q.claimEmergency(['a']).count,0);a.rollback();assert.equal(q.emergencyLeft(),3);assert.equal(q.claimEmergency(['c','d','e']).count,3);assert.equal(q.claimEmergency(['f']),null);
});
function translatedNewsFetch(transform = value => value) {
 return async (url,options={})=>{
  if(String(url).includes('api.groq.com')) {
   const payload=JSON.parse(options.body),input=JSON.parse(payload.messages[1].content),titles=payload.messages[0].content.startsWith('Translate Korean');
   const results=input.map(x=>{
    const hash=require('crypto').createHash('sha256').update(x.headline).digest('hex').slice(0,24);
    return titles?{i:x.i,th:'หัวข้อไทย '+hash,en:'Headline '+hash}:{i:x.i,relevant:true,categories:x.guessedCategories,level:'normal',title:{th:'ข่าวแปล '+hash,en:'News '+hash},summary:{th:'สรุปเนื้อข่าวภาษาไทย',en:'Translated summary'},body_th:['เนื้อข่าวภาษาไทย '.repeat(40)]};
   });
   return {ok:true,status:200,json:async()=>({usage:{total_tokens:500},choices:[{message:{content:JSON.stringify({items:titles?results:results.map(transform)})}}]})};
  }
  if(String(url).includes('rss')||String(url).includes('feed')) return {ok:true,text:async()=>'<rss><channel/></rss>'};
  return {ok:true,status:200,headers:{get:()=> 'text/html'},arrayBuffer:async()=>Buffer.from('<article><p>'+'국제 뉴스 기사 내용과 사실을 확인합니다. '.repeat(60)+'</p></article>')};
 };
}
test('a large Korean backlog cannot consume all translation slots; other categories publish across runs',async()=>{
 const db=dbFake(),now=Date.now(),categories=['war','disease','tech','thai','crypto','oil','fx','wage','foreign','hot','president'];
 const titles={korwar:'남북 군사회담 제안',war:'우크라이나 전쟁 교전',disease:'신종 바이러스 확산',tech:'AI 반도체 신기술',thai:'태국대사관 축제',crypto:'비트코인 가상자산',oil:'국제유가 급등',fx:'원화 환율',wage:'한국 최저임금',foreign:'고용허가제 외국인 근로자',hot:'인기 배우 결혼 소식',president:'한국 대통령 발표'};
 const item=(id,category)=>({id,titleKo:titles[category]+' '+id,title:{ko:'기사 '+id},summary:{ko:'한국어 요약'},body:{},translated:false,attempts:0,categories:[category],level:'normal',publishedAt:new Date(now-600000).toISOString(),addedAt:new Date(now-600000).toISOString(),source:'Fixture',sourceUrl:'https://www.yna.co.kr/'+id,publishers:category==='hot'?['https://www.yna.co.kr','https://news.sbs.co.kr','https://news.kbs.co.kr']:[],links:[]});
 db.data.set('meta/feed',{v:8,items:[...Array.from({length:80},(_,i)=>item('kw'+i,'korwar')),...categories.map((category,i)=>item('other'+i,category))]});
 const options={db,messaging:{},appUrl:'https://example.test',groqKey:'fixture',fetchImpl:translatedNewsFetch(),log,waitMs:0,budgetMs:60000,imgBudgetMs:2000,watchEveryMs:120000};
 const first=await runOnce({...options,now});
 assert.equal(first.korwar,0,'general Korean news cannot spend fast-lane quota');
 assert(first.translationByCategory.korwar.attempted>0);
 assert.equal(first.translationByCategory.korwar.attempted,first.translationByCategory.korwar.completed);
 assert(categories.filter(category=>first.publishedByCategory[category]>0).length>=9);
 const second=await runOnce({...options,now:now+300000});
 for(const category of categories) assert(second.publishedByCategory[category]>0,category);
});
test('diagnostics distinguish AI category reassignment from retry cooldown',async()=>{
 const db=dbFake(),now=Date.now();
 const tech={...story('tech',false),sourceUrl:'https://www.yna.co.kr/tech',source:'Fixture',categories:['tech']};
 const foreign={...story('foreign',false),categories:['foreign'],attempts:4,lastTry:now};
 db.data.set('meta/feed',{v:10,items:[tech,foreign]});
 const stat=await runOnce({db,messaging:{},appUrl:'https://example.test',groqKey:'fixture',fetchImpl:translatedNewsFetch(r=>({...r,categories:['crypto']})),log,now,budgetMs:60000,imgBudgetMs:2000,waitMs:0});
 assert.equal(stat.translationByCategory.tech.attempted,1);
 assert.equal(stat.translationByCategory.tech.completed,1);
 assert.deepEqual(stat.translationByCategory.tech.movedTo,{crypto:1});
 assert.equal(stat.publishedByCategory.tech,0);
 assert.equal(stat.translationByCategory.foreign.attempted,0);
 assert.equal(stat.retryDelayedByCategory.foreign,1);
 assert.deepEqual(db.data.get('meta/status').translationByCategory,stat.translationByCategory);
});
test('legacy Thai headline with Korean body is requeued and repaired without a duplicate alert',async()=>{
 const db=dbFake(),now=Date.now();
 const old={...story('legacy'),title:{th:'หัวข้อแปลแล้ว'},summary:{th:'한국어 요약 뉴스'},body:{th:['한국어 기사 본문']},titleKo:'원문 뉴스',sourceUrl:'https://example.test/legacy',source:'Fixture',links:[]};
 db.data.set('meta/feed',{v:8,items:[old]});
 await runOnce({db,messaging:{},appUrl:'https://example.test',fetchImpl:translatedNewsFetch(),log,now,budgetMs:1000,imgBudgetMs:0});
 assert.equal(db.data.get('meta/pending').items[0].translated,false);
 assert.equal(db.data.get('meta/pending').items[0].retranslation,true);
 let sent=0;
 await runOnce({db,messaging:{async sendEachForMulticast(){sent++;return {successCount:0,responses:[]}}},appUrl:'https://example.test',groqKey:'fixture',fetchImpl:translatedNewsFetch(),log,now,budgetMs:60000,imgBudgetMs:2000,waitMs:0});
 assert(require('../../public/news-text').completeThai(db.data.get('meta/feed').items[0]));assert.equal(sent,0);
});
test('nonincident Korean backlog cannot spend the fast lane before tech/foreign publication under rate limiting',async()=>{
 const db=dbFake(),now=Date.now(),sourceUrl='https://www.yna.co.kr/news';
 const pending=(id,titleKo,categories)=>({...story(id,false),titleKo,categories,sourceUrl,publishedAt:new Date(now-2*86400000).toISOString(),attempts:4,lastTry:now-4*3600000});
 db.data.set('meta/feed',{v:9,items:[{...story('published-korean'),titleKo:'남북 군사회담 재개',categories:['korwar']},...Array.from({length:40},(_,i)=>pending('politics'+i,'김여정 남북 군사회담 '+i,['korwar']))]});
 db.data.set('meta/pending',{v:9,items:[pending('tech','인공지능 AI 반도체 신기술',['tech']),pending('foreign','외국인 근로자 고용허가제 고용 환경 개선',['foreign'])]});
 const requests=[],base=translatedNewsFetch(r=>({...r,categories:['crypto']}));
 let limited=false;
 const fetchImpl=async(url,opt={})=>{
  if(String(url).includes('api.groq.com')) {
   const body=JSON.parse(opt.body),input=JSON.parse(body.messages[1].content);
   requests.push({model:body.model,titles:body.messages[0].content.startsWith('Translate Korean'),input});
   if(!limited){limited=true;return {ok:false,status:429,headers:{get:()=>null},json:async()=>({error:{message:'tokens per minute limit reached'}})};}
  }
  return base(url,opt);
 };
 const stat=await runOnce({db,messaging:{},appUrl:'https://example.test',groqKey:'fixture',fetchImpl,log,now,budgetMs:60000,imgBudgetMs:2000,waitMs:0});
 assert.equal(stat.korwar,0);
 assert(!requests.some(r=>r.titles),'general Korean news does not consume separate title requests');
 assert.deepEqual(new Set(requests[0].input.flatMap(i=>i.guessedCategories)),new Set(['tech','foreign']));
 for(const category of ['tech','foreign']) {
  assert(stat.publishedByCategory[category]>0,category);
  assert(db.data.get('meta/feed').items.some(i=>i.id===category&&i.translated&&i.categories.includes(category)),category+' really persisted publicly');
 }
 assert.equal(stat.aiModelErrors['groq:openai/gpt-oss-120b'].status,429);
});
test('all/high preferences and old pending jobs never bypass the incident/source policy',async()=>{
 const db=dbFake();await db.doc('subscribers/a').set({token:'a',enabled:true,subscriptionVersion:2,cats:['oil','disease','korwar'],level:'all'});
 const sent=[],messaging={async sendEachForMulticast(m){sent.push(m);return{successCount:1,responses:[{success:true}]}}};
 const critical=(titleKo,sourceUrl)=>({...story('bad'),titleKo,sourceUrl,level:'critical',categories:['disease','oil']});
 await sendNews(db,messaging,[critical('독감 대유행 긴급','https://www.yna.co.kr'),critical('북한 탄도미사일 발사','https://reuters.com')],'https://example.test',log);
 assert.equal(sent.length,0);
 for(const [id,data] of [['legacy',{level:'high'}],['forged',{level:'critical',titleKo:'북한 미사일 발사',publisherUrl:'https://evil.test'}],['disease',{level:'critical',titleKo:'독감 유행 긴급 경보',publisherUrl:'https://www.yna.co.kr'}]])
  await db.doc('notificationJobs/'+id).set({status:'pending',nextAttemptAt:0,expiresAt:Date.now()+3600000,recipients:[{id:'a',token:'a'}],msg:{data,notification:{title:'old'}}});
 await retryNotifications(db,messaging,log);
 assert.equal(sent.length,0);assert(![...db.data.keys()].some(p=>p.startsWith('notificationJobs/')));
 await sendNews(db,messaging,[critical('북한 탄도미사일 발사','https://www.yna.co.kr')],'https://example.test',log);
 assert.equal(sent.length,1);assert.equal(sent[0].data.level,'critical');assert.equal(sent[0].data.publisherUrl,'https://www.yna.co.kr');
});
test('repeat ingestion adds verified trending coverage to an existing translated item without republishing alerts',async()=>{
 const db=dbFake(),now=Date.now(),title='유명 배우 결혼 소식',date=new Date(now-60000).toISOString();
 const sources=[['연합뉴스','https://www.yna.co.kr'],['SBS','https://news.sbs.co.kr'],['KBS','https://news.kbs.co.kr']];
 const link='https://www.yna.co.kr/a',id=newsId(title,link,date);
 db.data.set('meta/feed',{v:10,items:[{...story(id),titleKo:title,source:'연합뉴스',sourceUrl:link,publisherUrl:sources[0][1],publishedAt:date,categories:[]}]});
 db.data.set('meta/seen',{ids:{[id]:now-1000}});
 const {FEEDS}=require('../feeds');
 const xml='<rss><channel>'+sources.map(([name,url])=>`<item><title>${title}</title><link>${url}/a</link><source url="${url}">${name}</source><pubDate>${date}</pubDate></item>`).join('')+'</channel></rss>';
 const fetchImpl=async url=>({ok:true,text:async()=>url===FEEDS.find(f=>f.id==='gn_top').url?xml:'<rss><channel/></rss>'});
 let pushes=0;
 const stat=await runOnce({db,messaging:{async sendEachForMulticast(){pushes++;throw Error('must not notify')}},appUrl:'https://example.test',fetchImpl,log,now,budgetMs:1000,imgBudgetMs:0});
 const saved=db.data.get('meta/feed').items;
 assert.equal(stat.added,0);assert.equal(saved.length,1);assert(saved[0].categories.includes('hot'));
 assert.equal(require('../../public/category-policy').publisherKeys(saved[0]).length,3);assert.equal(pushes,0);
});
