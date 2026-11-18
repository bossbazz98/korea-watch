const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loop,CFG}=require('../run');
const fake=()=>{let t=0;return {clock:()=>t,wait:async ms=>{t+=ms},advance:ms=>{t+=ms},log:{log(){},error(){}}}};
test('without LOOP_MINUTES the worker runs exactly one round',async()=>{
 const f=fake();let n=0;const r=await loop(async()=>{n++},{...f});assert.equal(n,1);assert.equal(r.rounds,1);
});
test('a long job runs a round every five minutes and stops before the job limit',async()=>{
 const f=fake(),starts=[];
 await loop(async({now})=>{starts.push(now);f.advance(CFG.TIME_BUDGET_MS)},{...f,minutes:340});
 assert(starts.length>=60&&starts.length<=68,'rounds '+starts.length);
 for(let i=1;i<starts.length;i++)assert.equal(starts[i]-starts[i-1],5*60e3);
 assert(starts.at(-1)+CFG.TIME_BUDGET_MS+60e3<=340*60e3);
});
test('a failed round does not stop the loop; only all-failed rounds fail the job',async()=>{
 const f=fake();let n=0;
 const r=await loop(async()=>{n++;f.advance(1000);if(n===2)throw Error('boom')},{...f,minutes:20});
 assert.equal(r.failures,1);assert(r.rounds>=3);
 await assert.rejects(loop(async()=>{throw Error('down')},{...fake(),minutes:0}),/down/);
});
test('only the first round forces an AI probe',async()=>{
 const f=fake(),probes=[];await loop(async({forceAIProbe})=>{probes.push(forceAIProbe);f.advance(1000)},{...f,minutes:15,forceFirstProbe:true});
 assert.equal(probes[0],true);assert(probes.slice(1).every(p=>p===false));
});
