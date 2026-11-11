const {test}=require('node:test'),assert=require('node:assert/strict');
const text=require('../../public/news-text');
const {translate,localize}=require('../lib/translate');
const {runOnce,sendNews,retryNotifications}=require('../run');
const quiet={log(){},warn(){}};
const editions={title:{th:'ข่าวเทคโนโลยี',en:'Technology news',ko:'기술 뉴스'},summary:{th:'สรุปข่าวเทคโนโลยี',en:'Technology summary',ko:'기술 소식 요약'},body:{th:['เนื้อข่าวเทคโนโลยี'],en:['The technology story.'],ko:['기술 기사 본문입니다.']},tips:{th:[],en:[],ko:[]}};
const story=()=>({id:'tech',...structuredClone(editions),titleKo:'인공지능 반도체 신기술 발표',source:'KBS',sourceUrl:'https://news.kbs.co.kr/test',publisherUrl:'https://news.kbs.co.kr/test',image:'https://news.kbs.co.kr/image.png',categories:['tech'],translated:true,rich:true,level:'normal',publishedAt:new Date(Date.now()-60000).toISOString()});
function database() {
 const data=new Map();
 const doc=path=>({path,id:path.split('/').pop(),async get(){return{exists:data.has(path),data:()=>structuredClone(data.get(path))}},async set(v){data.set(path,structuredClone(v))},async update(v){data.set(path,{...data.get(path),...structuredClone(v)})},async delete(){data.delete(path)}});
 return{data,doc,collection(prefix){const filters=[];let limit=Infinity;return{where(key,op,value){filters.push(v=>op==='=='?v[key]===value:op==='<'?v[key]<value:true);return this},limit(n){limit=n;return this},async get(){const docs=[...data].filter(([p,v])=>p.startsWith(prefix+'/')&&filters.every(f=>f(v))).slice(0,limit).map(([p,v])=>({id:doc(p).id,ref:doc(p),data:()=>structuredClone(v)}));return{empty:!docs.length,docs}}}}};
}
const aiOptions=reply=>({githubToken:'fixture',githubModels:['fixture'],log:quiet,waitMs:0,fetchImpl:async(_url,opt)=>({ok:true,status:200,json:async()=>({choices:[{message:{content:JSON.stringify({items:[reply(JSON.parse(opt.body))]})}}]})})});
test('each selected language reads only its own title, summary and body',()=>{
 for(const lang of text.languages){assert.equal(text.pick(editions.title,lang),editions.title[lang]);assert.deepEqual(text.body(editions.body,lang),editions.body[lang]);assert(text.complete(editions,lang));}
 assert.equal(text.pick({th:editions.title.th},'en'),'');assert.equal(text.pick({th:editions.title.th},'ko'),'');
 assert.deepEqual(text.body({ko:[editions.body.th[0]]},'ko'),[]);
 assert.equal(text.pick(editions.title,'unknown'),'');
});
test('AI full translation retains all three language editions including English and Korean bodies',async()=>{
 const opts=aiOptions(()=>({i:0,relevant:true,categories:['tech'],level:'normal',...editions,body_th:editions.body.th,body_en:editions.body.en,body_ko:editions.body.ko}));
 const result=(await translate([{titleKo:story().titleKo,cats:['tech']}],opts)).results[0];
 for(const lang of text.languages)assert(text.complete(result,lang),lang);
});
test('repair fills missing editions without changing existing translations, rank or categories',async()=>{
 const old=story();delete old.title.ko;delete old.summary.ko;delete old.body.ko;delete old.body.en;
 const before=structuredClone(old),opts=aiOptions(request=>{const input=JSON.parse(request.messages[1].content);assert.deepEqual(input.languages,['en','ko']);return{i:0,...editions}});
 const fixed=await localize(old,opts);
 assert.deepEqual(old,before,'input is not mutated');assert.deepEqual(text.missingLanguages(fixed),[]);
 assert.equal(fixed.title.th,old.title.th);assert.equal(fixed.level,old.level);assert.deepEqual(fixed.categories,old.categories);
 const incomplete=await localize(old,aiOptions(()=>({i:0,...editions,body:{en:['เนื้อข่าวภาษาไทย'],ko:[]}})));
 assert.deepEqual(incomplete,before,'wrong-language or incomplete editions never replace stored content');
});
test('worker repairs an already published story without treating it as a new publication or notifying again',async()=>{
 const db=database(),old=story();old.title={th:editions.title.th};old.summary={th:editions.summary.th};old.body={th:editions.body.th};
 db.data.set('meta/feed',{items:[old]});let calls=0,sent=0;
 const opts=aiOptions(()=>{calls++;return{i:0,...editions}});
 const fetchImpl=async(url,opt)=>url.includes('models.github.ai')?opts.fetchImpl(url,opt):{ok:true,status:200,text:async()=>'<rss><channel></channel></rss>',arrayBuffer:async()=>Buffer.from('')};
 const stat=await runOnce({db,messaging:{sendEachForMulticast:async()=>{sent++;throw Error('must not notify')}},appUrl:'https://example.com',githubToken:'fixture',githubModels:['fixture'],log:quiet,waitMs:0,fetchImpl,budgetMs:60000,watchEveryMs:600000});
 assert.equal(calls,1);assert.equal(stat.localized,1);assert.equal(stat.translated,0);assert.equal(sent,0);
 assert.deepEqual(text.missingLanguages(db.data.get('meta/feed').items[0]),[]);
});
test('push messages are grouped by chosen language; retries honor a changed language without duplicate delivery',async()=>{
 const db=database(),news=story(),messages=[];
 for(const lang of text.languages)db.data.set('subscribers/'+lang,{token:lang,lang,subscriptionVersion:2,enabled:true,level:'all',cats:['tech']});
 const messaging={sendEachForMulticast:async msg=>{messages.push(msg);return{successCount:msg.tokens.length,responses:msg.tokens.map(()=>({success:true}))}}};
 await sendNews(db,messaging,[news],'https://example.com',quiet);
 assert.equal(messages.length,3);
 for(const msg of messages){const lang=msg.tokens[0];assert.equal(msg.notification.title,'KOREA WATCH');assert.equal(msg.notification.body.split('\n').length,2);assert.equal(msg.notification.body.split('\n')[1],editions.title[lang]);assert(!msg.notification.body.includes(editions.summary[lang]));assert.equal(msg.webpush.notification.lang,lang)}
 db.data.set('meta/feed',{items:[news]});
 db.data.set('notificationJobs/retry',{status:'pending',attempts:1,expiresAt:Date.now()+600000,nextAttemptAt:0,recipients:[{id:'th',token:'th'}],msg:messages.find(m=>m.data.lang==='th')});
 db.data.get('subscribers/th').lang='ko';messages.length=0;
 await retryNotifications(db,messaging,quiet);assert.equal(messages.length,1);assert.equal(messages[0].data.lang,'ko');assert(messages[0].notification.body.endsWith(editions.title.ko));
 await retryNotifications(db,messaging,quiet);assert.equal(messages.length,1,'completed language transfer is not replayed');
});
test('all UI copy keys are defined in each language without inheriting another language',async()=>{
 const fs=require('node:fs'),vm=require('node:vm');const {UI_COPY}=await import('../../public/ui-copy.js');
 const source=fs.readFileSync(require.resolve('../../public/app.js'),'utf8'),context={UI_COPY};
 vm.runInNewContext(source.slice(source.indexOf('const T ='),source.indexOf('function uiIcon'))+';globalThis.copy=T;',context);
 for(const lang of ['en','ko'])for(const key of Object.keys(context.copy.th))assert.equal(typeof context.copy[lang][key],typeof context.copy.th[key],lang+': '+key);
});
