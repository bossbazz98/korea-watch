import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {watchAppResume} from '../../public/app-lifecycle.js';
function harness(initial={}){
 const doc=new EventTarget(),win=new EventTarget(),map=new Map(Object.entries(initial));doc.hidden=false;
 const storage={getItem:key=>map.get(key),setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};
 let time=2_000_000,returns=0,opens=0;const stop=watchAppResume({document:doc,window:win,storage,now:()=>time,onReturn:()=>returns++,onOpen:()=>opens++});
 return{doc,win,map,stop,get returns(){return returns},get opens(){return opens},advance:ms=>time+=ms,hide(){doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));win.dispatchEvent(new Event('pagehide'))},open(){doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));win.dispatchEvent(new Event('pageshow'))}};
}
test('returning after ten minutes resets once even when visibility and page events both fire',()=>{
 const h=harness();assert.equal(h.opens,1);h.hide();h.advance(600001);h.open();assert.equal(h.returns,1);assert.equal(h.opens,2);assert(!h.map.has('kw.backgroundAt'));h.stop();h.hide();h.advance(700000);h.open();assert.equal(h.returns,1);
});
test('a short absence preserves the current view; a stored long absence resets on launch',()=>{
 const h=harness();h.hide();h.advance(600000);h.open();assert.equal(h.returns,0);h.stop();const restarted=harness({'kw.backgroundAt':'1000000'});assert.equal(restarted.returns,1);restarted.stop();
});
test('the installed worker claims windows and announces its cached HTML release',async()=>{
 const events={},messages=[],removed=[];let claimed=false,skipped=false;
 const client={postMessage:value=>messages.push(value)},cache={addAll:async()=>{},match:async()=>new Response('<html data-release="test-new-release">')};
 const clients={claim:async()=>{claimed=true},matchAll:async()=>[client]};
 const self={KW_CACHE_VERSION:'new',KW_PRECACHE:['/index.html'],location:{origin:'https://test.local'},clients,skipWaiting:async()=>{skipped=true},addEventListener:(type,fn)=>events[type]=fn};
 vm.runInNewContext(fs.readFileSync(new URL('../../public/firebase-messaging-sw.js',import.meta.url),'utf8'),{self,clients,caches:{open:async()=>cache,keys:async()=>['kw-shell-old','kw-shell-new','other'],delete:async key=>removed.push(key)},importScripts:()=>{},URL,Response,console});
 let pending;events.install({waitUntil:p=>pending=p});await pending;assert(skipped);
 events.activate({waitUntil:p=>pending=p});await pending;assert(claimed);assert.deepEqual(removed,['kw-shell-old']);assert.equal(messages[0].release,'test-new-release');
 messages.length=0;events.message({data:{type:'get-release'},source:client,waitUntil:p=>pending=p});await pending;assert.equal(messages[0].type,'app-release');assert.equal(messages[0].release,'test-new-release');
});
