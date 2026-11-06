const {test} = require('node:test');
const assert = require('node:assert/strict');
const {translate} = require('../lib/translate');
const {publicationCategories} = require('../lib/categories');
const input=[{titleKo:'쌀값 급등, 생필품 수급 점검',cats:['food']},{titleKo:'외국인 근로자 고용허가제 임금 개선',cats:['foreign']}];
const result=i=>({i,relevant:true,categories:['korea'],level:'normal',title:{th:'ข่าวแปลภาษาไทย '+i,en:'Translated news'},summary:{th:'สรุปข่าวภาษาไทย',en:'Summary'},body_th:['เนื้อหาภาษาไทยที่แปลครบแล้ว']});
const quiet={log(){},warn(){}};
function options(replies) {
 const calls=[];
 return {calls,githubToken:'fixture',githubModels:['a','b','c'],log:quiet,waitMs:0,fetchImpl:async(_url,opt)=>{
  calls.push(JSON.parse(opt.body).model);
  const reply=replies[calls.length-1];
  if(reply instanceof Error)throw reply;
  return {ok:true,status:200,json:async()=>({choices:[{message:{content:JSON.stringify({items:reply})}}]})};
 }};
}
test('structured empty and incomplete JSON fall back; food and foreign remain publishable in their topics',async()=>{
 for(const empty of [[],[{}],[{i:0,title:{},categories:[]}],[{...result(0),body_th:[]}]]) {
  const opts=options([empty,input.map((_,i)=>result(i))]);
  const r=await translate(input,opts);
  assert.deepEqual(opts.calls,['a','b']);
  assert(r.results.every(x=>x.relevant));
  assert(r.results[0].categories.includes('food'));assert(r.results[1].categories.includes('foreign'));
 }
});
test('a complete item survives fallback for its missing batch partner',async()=>{
 const first={...result(0),title:{th:'ผลแปลชุดแรก',en:'First'}};
 const opts=options([[first],[result(0),result(1)]]);
 const r=await translate(input,opts);
 assert.equal(r.results[0].title.th,'ผลแปลชุดแรก');assert(r.results[1]);
});
test('provider failure after partial completion preserves the completed article',async()=>{
 const opts=options([[result(0)],new Error('network failure'),new Error('network failure')]);
 const r=await translate(input,opts);
 assert(r.results[0]);assert.equal(r.results[1],null);assert(r.partial);
});
test('explicit irrelevant remains rejected; RSS category hints alone cannot force a topic',async()=>{
 const opts=options([[{i:0,relevant:false}]]);
 const r=await translate([input[0]],opts);assert.equal(r.results[0].relevant,false);assert.equal(opts.calls.length,1);
 assert.deepEqual(publicationCategories({titleKo:'인기 가수 라면 먹방',cats:['food']},['korea']),['korea']);
 assert.deepEqual(publicationCategories({titleKo:'관광 비자 연장',cats:['foreign']},['law']),['law']);
});
test('unavailable models are skipped in later batches and full error reasons are retained',async()=>{
 const calls=[],modelErrors=new Map(),unavailable=new Map();
 const opts={githubToken:'fixture',githubModels:['retired','working'],log:quiet,waitMs:0,modelErrors,unavailable,fetchImpl:async(_url,opt)=>{
  const model=JSON.parse(opt.body).model;calls.push(model);
  if(model==='retired')return{ok:false,status:404,json:async()=>({error:{message:'This model is no longer available. Use the provider model catalog.'}})};
  return{ok:true,status:200,json:async()=>({choices:[{message:{content:JSON.stringify({items:[result(0)]})}}]})};
 }};
 await translate([input[0]],opts);await translate([input[0]],opts);
 assert.deepEqual(calls,['retired','working','working']);
 assert.equal(modelErrors.get('github:retired').status,404);assert.match(unavailable.get('github:retired'),/no longer available/);
});
test('minute-quota cooldown allows another model now and the original model after expiry',async t=>{
 let now=Date.now();t.mock.method(Date,'now',()=>now);
 const cool=new Map(),calls=[];
 let limited=true;
 const opts={githubToken:'fixture',githubModels:['limited','fallback'],cool,waitMs:0,log:quiet,fetchImpl:async(_url,opt)=>{
  const model=JSON.parse(opt.body).model;calls.push(model);
  if(model==='limited'&&limited){limited=false;return{ok:false,status:429,headers:{get:key=>key==='retry-after'?'2':null},json:async()=>({error:{message:'tokens per minute'}})};}
  return{ok:true,status:200,json:async()=>({choices:[{message:{content:JSON.stringify({items:[result(0)]})}}]})};
 }};
 await translate([input[0]],opts);await translate([input[0]],opts);
 assert.deepEqual(calls,['limited','fallback','fallback']);
 now+=3001;await translate([input[0]],opts);
 assert.equal(calls.at(-1),'limited');
});
