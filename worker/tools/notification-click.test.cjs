const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function harness({existing=false,ack=true,focusFails=false}={}) {
 const events={},calls={focus:0,navigate:[],open:[],messages:[],closed:0};
 class Channel{constructor(){this.port1={close(){}};this.port2={postMessage:data=>queueMicrotask(()=>this.port1.onmessage?.({data}))}}}
 const client={url:'https://news.example/',focus:async()=>{calls.focus++;if(focusFails)throw Error('window closed')},postMessage:(data,ports)=>{calls.messages.push(data);if(ack)ports[0].postMessage({opened:true})},navigate:async url=>{calls.navigate.push(url);return client}};
 const context={self:{KW_CACHE_VERSION:'test',KW_PRECACHE:[],location:{origin:'https://news.example'},addEventListener:(type,fn)=>events[type]=fn},clients:{matchAll:async()=>existing?[client]:[],openWindow:async url=>calls.open.push(url)},importScripts(){},URL,console,MessageChannel:Channel,setTimeout:fn=>{queueMicrotask(()=>queueMicrotask(fn));return 1},clearTimeout(){}};
 // Native timers are unnecessary: use a controllable timeout so an acknowledged
 // app can answer first, and a starting app immediately exercises the fallback.
 let timeout;context.setTimeout=fn=>{timeout=fn;return 1};context.clearTimeout=()=>{timeout=null};
 vm.runInNewContext(fs.readFileSync(require.resolve('../../public/firebase-messaging-sw'),'utf8'),context);
 return{calls,async click(data){let pending;events.notificationclick({notification:{data,close:()=>calls.closed++},stopImmediatePropagation(){},waitUntil:p=>pending=p});await new Promise(resolve=>setImmediate(resolve));if(timeout)timeout();await pending}};
}
test('a closed app opens the exact story URL carried by FCM, including escaped IDs',async()=>{
 const h=harness();await h.click({FCM_MSG:{data:{id:'story/one ไทย'}}});
 assert.equal(h.calls.closed,1);assert.equal(new URL(h.calls.open[0]).searchParams.get('id'),'story/one ไทย');
});
test('a running app receives the story request without navigation or an extra window',async()=>{
 const h=harness({existing:true});await h.click({FCM_MSG:{data:{id:'second'}}});
 assert.equal(h.calls.focus,1);assert.equal(h.calls.messages[0].id,'second');assert.deepEqual(h.calls.navigate,[]);assert.deepEqual(h.calls.open,[]);
});
test('a starting app without a message listener navigates to the story URL',async()=>{
 const h=harness({existing:true,ack:false});await h.click({id:'starting'});
 assert.equal(h.calls.navigate.length,1);assert.equal(new URL(h.calls.navigate[0]).searchParams.get('id'),'starting');assert.deepEqual(h.calls.open,[]);
});
test('a window closing during the click opens a new window on the same story',async()=>{
 const h=harness({existing:true,focusFails:true});await h.click({id:'closed-window'});
 assert.equal(new URL(h.calls.open[0]).searchParams.get('id'),'closed-window');
});
test('link-only and grouped alerts resolve their story IDs',async()=>{
 for(const payload of [{FCM_MSG:{fcmOptions:{link:'https://news.example/?id=link-only'}}},{FCM_MSG:{data:{id:'',storyId:'grouped'}}}]){
  const h=harness();await h.click(payload);assert.equal(new URL(h.calls.open[0]).searchParams.get('id'),payload.FCM_MSG.data?'grouped':'link-only');
 }
});
test('an external notification link cannot take the user off the app origin',async()=>{
 const h=harness();await h.click({FCM_MSG:{data:{id:'safe'},fcmOptions:{link:'https://other.example/?id=wrong'}}});
 const url=new URL(h.calls.open[0]);assert.equal(url.origin,'https://news.example');assert.equal(url.searchParams.get('id'),'safe');
});
