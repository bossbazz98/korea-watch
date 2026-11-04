var X=()=>{};var Z=function(t){let e=[],n=0;for(let r=0;r<t.length;r++){let i=t.charCodeAt(r);i<128?e[n++]=i:i<2048?(e[n++]=i>>6|192,e[n++]=i&63|128):(i&64512)===55296&&r+1<t.length&&(t.charCodeAt(r+1)&64512)===56320?(i=65536+((i&1023)<<10)+(t.charCodeAt(++r)&1023),e[n++]=i>>18|240,e[n++]=i>>12&63|128,e[n++]=i>>6&63|128,e[n++]=i&63|128):(e[n++]=i>>12|224,e[n++]=i>>6&63|128,e[n++]=i&63|128)}return e},we=function(t){let e=[],n=0,r=0;for(;n<t.length;){let i=t[n++];if(i<128)e[r++]=String.fromCharCode(i);else if(i>191&&i<224){let s=t[n++];e[r++]=String.fromCharCode((i&31)<<6|s&63)}else if(i>239&&i<365){let s=t[n++],o=t[n++],a=t[n++],f=((i&7)<<18|(s&63)<<12|(o&63)<<6|a&63)-65536;e[r++]=String.fromCharCode(55296+(f>>10)),e[r++]=String.fromCharCode(56320+(f&1023))}else{let s=t[n++],o=t[n++];e[r++]=String.fromCharCode((i&15)<<12|(s&63)<<6|o&63)}}return e.join("")},ee={byteToCharMap_:null,charToByteMap_:null,byteToCharMapWebSafe_:null,charToByteMapWebSafe_:null,ENCODED_VALS_BASE:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",get ENCODED_VALS(){return this.ENCODED_VALS_BASE+"+/="},get ENCODED_VALS_WEBSAFE(){return this.ENCODED_VALS_BASE+"-_."},HAS_NATIVE_SUPPORT:typeof atob=="function",encodeByteArray(t,e){if(!Array.isArray(t))throw Error("encodeByteArray takes an array as a parameter");this.init_();let n=e?this.byteToCharMapWebSafe_:this.byteToCharMap_,r=[];for(let i=0;i<t.length;i+=3){let s=t[i],o=i+1<t.length,a=o?t[i+1]:0,f=i+2<t.length,l=f?t[i+2]:0,q=s>>2,b=(s&3)<<4|a>>4,w=(a&15)<<2|l>>6,v=l&63;f||(v=64,o||(w=64)),r.push(n[q],n[b],n[w],n[v])}return r.join("")},encodeString(t,e){return this.HAS_NATIVE_SUPPORT&&!e?btoa(t):this.encodeByteArray(Z(t),e)},decodeString(t,e){return this.HAS_NATIVE_SUPPORT&&!e?atob(t):we(this.decodeStringToByteArray(t,e))},decodeStringToByteArray(t,e){this.init_();let n=e?this.charToByteMapWebSafe_:this.charToByteMap_,r=[];for(let i=0;i<t.length;){let s=n[t.charAt(i++)],a=i<t.length?n[t.charAt(i)]:0;++i;let l=i<t.length?n[t.charAt(i)]:64;++i;let b=i<t.length?n[t.charAt(i)]:64;if(++i,s==null||a==null||l==null||b==null)throw new T;let w=s<<2|a>>4;if(r.push(w),l!==64){let v=a<<4&240|l>>2;if(r.push(v),b!==64){let Ee=l<<6&192|b;r.push(Ee)}}}return r},init_(){if(!this.byteToCharMap_){this.byteToCharMap_={},this.charToByteMap_={},this.byteToCharMapWebSafe_={},this.charToByteMapWebSafe_={};for(let t=0;t<this.ENCODED_VALS.length;t++)this.byteToCharMap_[t]=this.ENCODED_VALS.charAt(t),this.charToByteMap_[this.byteToCharMap_[t]]=t,this.byteToCharMapWebSafe_[t]=this.ENCODED_VALS_WEBSAFE.charAt(t),this.charToByteMapWebSafe_[this.byteToCharMapWebSafe_[t]]=t,t>=this.ENCODED_VALS_BASE.length&&(this.charToByteMap_[this.ENCODED_VALS_WEBSAFE.charAt(t)]=t,this.charToByteMapWebSafe_[this.ENCODED_VALS.charAt(t)]=t)}}},T=class extends Error{constructor(){super(...arguments),this.name="DecodeBase64StringError"}},ve=function(t){let e=Z(t);return ee.encodeByteArray(e,!0)},y=function(t){return ve(t).replace(/\./g,"")},te=function(t){try{return ee.decodeString(t,!0)}catch(e){console.error("base64Decode failed: ",e)}return null};function De(){if(typeof self<"u")return self;if(typeof window<"u")return window;if(typeof global<"u")return global;throw new Error("Unable to locate global object.")}var Se=()=>De().__FIREBASE_DEFAULTS__,Ce=()=>{if(typeof process>"u"||typeof process.env>"u")return;let t=process.env.__FIREBASE_DEFAULTS__;if(t)return JSON.parse(t)},Ae=()=>{if(typeof document>"u")return;let t;try{t=document.cookie.match(/__FIREBASE_DEFAULTS__=([^;]+)/)}catch{return}let e=t&&te(t[1]);return e&&JSON.parse(e)},S=()=>{try{return X()||Se()||Ce()||Ae()}catch(t){console.info(`Unable to get __FIREBASE_DEFAULTS__ due to: ${t}`);return}},Ie=t=>S()?.emulatorHosts?.[t],Lt=t=>{let e=Ie(t);if(!e)return;let n=e.lastIndexOf(":");if(n<=0||n+1===e.length)throw new Error(`Invalid host ${e} with no separate hostname and port!`);let r=parseInt(e.substring(n+1),10);return e[0]==="["?[e.substring(1,n-1),r]:[e.substring(0,n),r]},R=()=>S()?.config,$t=t=>S()?.[`_${t}`];var D=class{constructor(){this.reject=()=>{},this.resolve=()=>{},this.promise=new Promise((e,n)=>{this.resolve=e,this.reject=n})}wrapCallback(e){return(n,r)=>{n?this.reject(n):this.resolve(r),typeof e=="function"&&(this.promise.catch(()=>{}),e.length===1?e(n):e(n,r))}}};function Pt(t,e){if(t.uid)throw new Error('The "uid" field is no longer supported by mockUserToken. Please use "sub" instead for Firebase Auth User ID.');let n={alg:"none",type:"JWT"},r=e||"demo-project",i=t.iat||0,s=t.sub||t.user_id;if(!s)throw new Error("mockUserToken must contain 'sub' or 'user_id' field!");let o={iss:`https://securetoken.google.com/${r}`,aud:r,iat:i,exp:i+3600,auth_time:i,sub:s,user_id:s,firebase:{sign_in_provider:"custom",identities:{}},...t};return[y(JSON.stringify(n)),y(JSON.stringify(o)),""].join(".")}function ne(){return typeof navigator<"u"&&typeof navigator.userAgent=="string"?navigator.userAgent:""}function Ft(){return typeof window<"u"&&!!(window.cordova||window.phonegap||window.PhoneGap)&&/ios|iphone|ipod|ipad|android|blackberry|iemobile/i.test(ne())}function re(){let t=S()?.forceEnvironment;if(t==="node")return!0;if(t==="browser")return!1;try{return Object.prototype.toString.call(global.process)==="[object process]"}catch{return!1}}function Ht(){return typeof navigator<"u"&&navigator.userAgent==="Cloudflare-Workers"}function zt(){let t=typeof chrome=="object"?chrome.runtime:typeof browser=="object"?browser.runtime:void 0;return typeof t=="object"&&t.id!==void 0}function Vt(){return typeof navigator=="object"&&navigator.product==="ReactNative"}function Ut(){let t=ne();return t.indexOf("MSIE ")>=0||t.indexOf("Trident/")>=0}function jt(){return!re()&&!!navigator.userAgent&&navigator.userAgent.includes("Safari")&&!navigator.userAgent.includes("Chrome")}function Wt(){return!re()&&!!navigator.userAgent&&(navigator.userAgent.includes("Safari")||navigator.userAgent.includes("WebKit"))&&!navigator.userAgent.includes("Chrome")}function ie(){try{return typeof indexedDB=="object"}catch{return!1}}function se(){return new Promise((t,e)=>{try{let n=!0,r="validate-browser-context-for-indexeddb-analytics-module",i=self.indexedDB.open(r);i.onsuccess=()=>{i.result.close(),n||self.indexedDB.deleteDatabase(r),t(!0)},i.onupgradeneeded=()=>{n=!1},i.onerror=()=>{e(i.error?.message||"")}}catch(n){e(n)}})}function Jt(){return!(typeof navigator>"u"||!navigator.cookieEnabled)}var Oe="FirebaseError",p=class t extends Error{constructor(e,n,r){super(n),this.code=e,this.customData=r,this.name=Oe,Object.setPrototypeOf(this,t.prototype),Error.captureStackTrace&&Error.captureStackTrace(this,_.prototype.create)}},_=class{constructor(e,n,r){this.service=e,this.serviceName=n,this.errors=r}create(e,...n){let r=n[0]||{},i=`${this.service}/${e}`,s=this.errors[e],o=s?xe(s,r):"Error",a=`${this.serviceName}: ${o} (${i}).`;return new p(i,a,r)}};function xe(t,e){try{let n=0,r="";for(;n<t.length;){let i=t.indexOf("{$",n);if(i===-1){r+=t.substring(n);break}let s=t.indexOf("}",i+2);if(s===-1){r+=t.substring(n);break}let o=t.substring(i+2,s),a=e[o];r+=t.substring(n,i)+(a!=null?String(a):`<${o}?>`),n=s+1}return r}catch{return t}}function Gt(t){for(let e in t)if(Object.prototype.hasOwnProperty.call(t,e))return!1;return!0}function C(t,e){if(t===e)return!0;let n=Object.keys(t),r=Object.keys(e);for(let i of n){if(!r.includes(i))return!1;let s=t[i],o=e[i];if(Q(s)&&Q(o)){if(!C(s,o))return!1}else if(s!==o)return!1}for(let i of r)if(!n.includes(i))return!1;return!0}function Q(t){return t!==null&&typeof t=="object"}function Kt(t){let e=[];for(let[n,r]of Object.entries(t))Array.isArray(r)?r.forEach(i=>{e.push(encodeURIComponent(n)+"="+encodeURIComponent(i))}):e.push(encodeURIComponent(n)+"="+encodeURIComponent(r));return e.length?"&"+e.join("&"):""}function Yt(t){let e={};return t.replace(/^\?/,"").split("&").forEach(r=>{if(r){let[i,s]=r.split("=");e[decodeURIComponent(i)]=decodeURIComponent(s)}}),e}function qt(t){let e=t.indexOf("?");if(!e)return"";let n=t.indexOf("#",e);return t.substring(e,n>0?n:void 0)}function Xt(t,e){let n=new N(t,e);return n.subscribe.bind(n)}var N=class{constructor(e,n){this.observers=[],this.unsubscribes=[],this.observerCount=0,this.task=Promise.resolve(),this.finalized=!1,this.onNoObservers=n,this.task.then(()=>{e(this)}).catch(r=>{this.error(r)})}next(e){this.forEachObserver(n=>{n.next(e)})}error(e){this.forEachObserver(n=>{n.error(e)}),this.close(e)}complete(){this.forEachObserver(e=>{e.complete()}),this.close()}subscribe(e,n,r){let i;if(e===void 0&&n===void 0&&r===void 0)throw new Error("Missing Observer.");Be(e,["next","error","complete"])?i=e:i={next:e,error:n,complete:r},i.next===void 0&&(i.next=B),i.error===void 0&&(i.error=B),i.complete===void 0&&(i.complete=B);let s=this.unsubscribeOne.bind(this,this.observers.length);return this.finalized&&this.task.then(()=>{try{this.finalError?i.error(this.finalError):i.complete()}catch{}}),this.observers.push(i),s}unsubscribeOne(e){this.observers===void 0||this.observers[e]===void 0||(delete this.observers[e],this.observerCount-=1,this.observerCount===0&&this.onNoObservers!==void 0&&this.onNoObservers(this))}forEachObserver(e){if(!this.finalized)for(let n=0;n<this.observers.length;n++)this.sendOne(n,e)}sendOne(e,n){this.task.then(()=>{if(this.observers!==void 0&&this.observers[e]!==void 0)try{n(this.observers[e])}catch(r){typeof console<"u"&&console.error&&console.error(r)}})}close(e){this.finalized||(this.finalized=!0,e!==void 0&&(this.finalError=e),this.task.then(()=>{this.observers=void 0,this.onNoObservers=void 0}))}};function Be(t,e){if(typeof t!="object"||t===null)return!1;for(let n of e)if(n in t&&typeof t[n]=="function")return!0;return!1}function B(){}var Qt=14400*1e3;function Zt(t){return t&&t._delegate?t._delegate:t}function en(t){try{return(t.startsWith("http://")||t.startsWith("https://")?new URL(t).hostname:t).endsWith(".cloudworkstations.dev")}catch{return!1}}async function tn(t){return(await fetch(t,{credentials:"include"})).ok}var g=class{constructor(e,n,r){this.name=e,this.instanceFactory=n,this.type=r,this.multipleInstances=!1,this.serviceProps={},this.instantiationMode="LAZY",this.onInstanceCreated=null}setInstantiationMode(e){return this.instantiationMode=e,this}setMultipleInstances(e){return this.multipleInstances=e,this}setServiceProps(e){return this.serviceProps=e,this}setInstanceCreatedCallback(e){return this.onInstanceCreated=e,this}};var m="[DEFAULT]";var M=class{constructor(e,n){this.name=e,this.container=n,this.component=null,this.instances=new Map,this.instancesDeferred=new Map,this.instancesOptions=new Map,this.onInitCallbacks=new Map}get(e){let n=this.normalizeInstanceIdentifier(e);if(!this.instancesDeferred.has(n)){let r=new D;if(this.instancesDeferred.set(n,r),this.isInitialized(n)||this.shouldAutoInitialize())try{let i=this.getOrInitializeService({instanceIdentifier:n});i&&r.resolve(i)}catch{}}return this.instancesDeferred.get(n).promise}getImmediate(e){let n=this.normalizeInstanceIdentifier(e?.identifier),r=e?.optional??!1;if(this.isInitialized(n)||this.shouldAutoInitialize())try{return this.getOrInitializeService({instanceIdentifier:n})}catch(i){if(r)return null;throw i}else{if(r)return null;throw Error(`Service ${this.name} is not available`)}}getComponent(){return this.component}setComponent(e){if(e.name!==this.name)throw Error(`Mismatching Component ${e.name} for Provider ${this.name}.`);if(this.component)throw Error(`Component for ${this.name} has already been provided`);if(this.component=e,!!this.shouldAutoInitialize()){if(Ne(e))try{this.getOrInitializeService({instanceIdentifier:m})}catch{}for(let[n,r]of this.instancesDeferred.entries()){let i=this.normalizeInstanceIdentifier(n);try{let s=this.getOrInitializeService({instanceIdentifier:i});r.resolve(s)}catch{}}}}clearInstance(e=m){this.instancesDeferred.delete(e),this.instancesOptions.delete(e),this.instances.delete(e)}async delete(){let e=Array.from(this.instances.values());await Promise.all([...e.filter(n=>"INTERNAL"in n).map(n=>n.INTERNAL.delete()),...e.filter(n=>"_delete"in n).map(n=>n._delete())])}isComponentSet(){return this.component!=null}isInitialized(e=m){return this.instances.has(e)}getOptions(e=m){return this.instancesOptions.get(e)||{}}initialize(e={}){let{options:n={}}=e,r=this.normalizeInstanceIdentifier(e.instanceIdentifier);if(this.isInitialized(r))throw Error(`${this.name}(${r}) has already been initialized`);if(!this.isComponentSet())throw Error(`Component ${this.name} has not been registered yet`);let i=this.getOrInitializeService({instanceIdentifier:r,options:n});for(let[s,o]of this.instancesDeferred.entries()){let a=this.normalizeInstanceIdentifier(s);r===a&&o.resolve(i)}return i}onInit(e,n){let r=this.normalizeInstanceIdentifier(n),i=this.onInitCallbacks.get(r)??new Set;i.add(e),this.onInitCallbacks.set(r,i);let s=this.instances.get(r);return s&&e(s,r),()=>{i.delete(e)}}invokeOnInitCallbacks(e,n){let r=this.onInitCallbacks.get(n);if(r)for(let i of r)try{i(e,n)}catch{}}getOrInitializeService({instanceIdentifier:e,options:n={}}){let r=this.instances.get(e);if(!r&&this.component&&(r=this.component.instanceFactory(this.container,{instanceIdentifier:Te(e),options:n}),this.instances.set(e,r),this.instancesOptions.set(e,n),this.invokeOnInitCallbacks(r,e),this.component.onInstanceCreated))try{this.component.onInstanceCreated(this.container,e,r)}catch{}return r||null}normalizeInstanceIdentifier(e=m){return this.component?this.component.multipleInstances?e:m:e}shouldAutoInitialize(){return!!this.component&&this.component.instantiationMode!=="EXPLICIT"}};function Te(t){return t===m?void 0:t}function Ne(t){return t.instantiationMode==="EAGER"}var A=class{constructor(e){this.name=e,this.providers=new Map}addComponent(e){let n=this.getProvider(e.name);if(n.isComponentSet())throw new Error(`Component ${e.name} has already been registered with ${this.name}`);n.setComponent(e)}addOrOverwriteComponent(e){this.getProvider(e.name).isComponentSet()&&this.providers.delete(e.name),this.addComponent(e)}getProvider(e){if(this.providers.has(e))return this.providers.get(e);let n=new M(e,this);return this.providers.set(e,n),n}getProviders(){return Array.from(this.providers.values())}};var Re=[],c;(function(t){t[t.DEBUG=0]="DEBUG",t[t.VERBOSE=1]="VERBOSE",t[t.INFO=2]="INFO",t[t.WARN=3]="WARN",t[t.ERROR=4]="ERROR",t[t.SILENT=5]="SILENT"})(c||(c={}));var Me={debug:c.DEBUG,verbose:c.VERBOSE,info:c.INFO,warn:c.WARN,error:c.ERROR,silent:c.SILENT},ke=c.INFO,Le={[c.DEBUG]:"log",[c.VERBOSE]:"log",[c.INFO]:"info",[c.WARN]:"warn",[c.ERROR]:"error"},$e=(t,e,...n)=>{if(e<t.logLevel)return;let r=new Date().toISOString(),i=Le[e];if(i)console[i](`[${r}]  ${t.name}:`,...n);else throw new Error(`Attempted to log a message with an invalid logType (value: ${e})`)},I=class{constructor(e){this.name=e,this._logLevel=ke,this._logHandler=$e,this._userLogHandler=null,Re.push(this)}get logLevel(){return this._logLevel}set logLevel(e){if(!(e in c))throw new TypeError(`Invalid value "${e}" assigned to \`logLevel\``);this._logLevel=e}setLogLevel(e){this._logLevel=typeof e=="string"?Me[e]:e}get logHandler(){return this._logHandler}set logHandler(e){if(typeof e!="function")throw new TypeError("Value assigned to `logHandler` must be a function");this._logHandler=e}get userLogHandler(){return this._userLogHandler}set userLogHandler(e){this._userLogHandler=e}debug(...e){this._userLogHandler&&this._userLogHandler(this,c.DEBUG,...e),this._logHandler(this,c.DEBUG,...e)}log(...e){this._userLogHandler&&this._userLogHandler(this,c.VERBOSE,...e),this._logHandler(this,c.VERBOSE,...e)}info(...e){this._userLogHandler&&this._userLogHandler(this,c.INFO,...e),this._logHandler(this,c.INFO,...e)}warn(...e){this._userLogHandler&&this._userLogHandler(this,c.WARN,...e),this._logHandler(this,c.WARN,...e)}error(...e){this._userLogHandler&&this._userLogHandler(this,c.ERROR,...e),this._logHandler(this,c.ERROR,...e)}};var Pe=(t,e)=>e.some(n=>t instanceof n),oe,ae;function Fe(){return oe||(oe=[IDBDatabase,IDBObjectStore,IDBIndex,IDBCursor,IDBTransaction])}function He(){return ae||(ae=[IDBCursor.prototype.advance,IDBCursor.prototype.continue,IDBCursor.prototype.continuePrimaryKey])}var ce=new WeakMap,L=new WeakMap,fe=new WeakMap,k=new WeakMap,P=new WeakMap;function ze(t){let e=new Promise((n,r)=>{let i=()=>{t.removeEventListener("success",s),t.removeEventListener("error",o)},s=()=>{n(h(t.result)),i()},o=()=>{r(t.error),i()};t.addEventListener("success",s),t.addEventListener("error",o)});return e.then(n=>{n instanceof IDBCursor&&ce.set(n,t)}).catch(()=>{}),P.set(e,t),e}function Ve(t){if(L.has(t))return;let e=new Promise((n,r)=>{let i=()=>{t.removeEventListener("complete",s),t.removeEventListener("error",o),t.removeEventListener("abort",o)},s=()=>{n(),i()},o=()=>{r(t.error||new DOMException("AbortError","AbortError")),i()};t.addEventListener("complete",s),t.addEventListener("error",o),t.addEventListener("abort",o)});L.set(t,e)}var $={get(t,e,n){if(t instanceof IDBTransaction){if(e==="done")return L.get(t);if(e==="objectStoreNames")return t.objectStoreNames||fe.get(t);if(e==="store")return n.objectStoreNames[1]?void 0:n.objectStore(n.objectStoreNames[0])}return h(t[e])},set(t,e,n){return t[e]=n,!0},has(t,e){return t instanceof IDBTransaction&&(e==="done"||e==="store")?!0:e in t}};function le(t){$=t($)}function Ue(t){return t===IDBDatabase.prototype.transaction&&!("objectStoreNames"in IDBTransaction.prototype)?function(e,...n){let r=t.call(O(this),e,...n);return fe.set(r,e.sort?e.sort():[e]),h(r)}:He().includes(t)?function(...e){return t.apply(O(this),e),h(ce.get(this))}:function(...e){return h(t.apply(O(this),e))}}function je(t){return typeof t=="function"?Ue(t):(t instanceof IDBTransaction&&Ve(t),Pe(t,Fe())?new Proxy(t,$):t)}function h(t){if(t instanceof IDBRequest)return ze(t);if(k.has(t))return k.get(t);let e=je(t);return e!==t&&(k.set(t,e),P.set(e,t)),e}var O=t=>P.get(t);function ue(t,e,{blocked:n,upgrade:r,blocking:i,terminated:s}={}){let o=indexedDB.open(t,e),a=h(o);return r&&o.addEventListener("upgradeneeded",f=>{r(h(o.result),f.oldVersion,f.newVersion,h(o.transaction),f)}),n&&o.addEventListener("blocked",f=>n(f.oldVersion,f.newVersion,f)),a.then(f=>{s&&f.addEventListener("close",()=>s()),i&&f.addEventListener("versionchange",l=>i(l.oldVersion,l.newVersion,l))}).catch(()=>{}),a}function fn(t,{blocked:e}={}){let n=indexedDB.deleteDatabase(t);return e&&n.addEventListener("blocked",r=>e(r.oldVersion,r)),h(n).then(()=>{})}var We=["get","getKey","getAll","getAllKeys","count"],Je=["put","add","delete","clear"],F=new Map;function he(t,e){if(!(t instanceof IDBDatabase&&!(e in t)&&typeof e=="string"))return;if(F.get(e))return F.get(e);let n=e.replace(/FromIndex$/,""),r=e!==n,i=Je.includes(n);if(!(n in(r?IDBIndex:IDBObjectStore).prototype)||!(i||We.includes(n)))return;let s=async function(o,...a){let f=this.transaction(o,i?"readwrite":"readonly"),l=f.store;return r&&(l=l.index(a.shift())),(await Promise.all([l[n](...a),i&&f.done]))[0]};return F.set(e,s),s}le(t=>({...t,get:(e,n,r)=>he(e,n)||t.get(e,n,r),has:(e,n)=>!!he(e,n)||t.has(e,n)}));var V=class{constructor(e){this.container=e}getPlatformInfoString(){return this.container.getProviders().map(n=>{if(Ge(n)){let r=n.getImmediate();return`${r.library}/${r.version}`}else return null}).filter(n=>n).join(" ")}};function Ge(t){return t.getComponent()?.type==="VERSION"}var U="@firebase/app",de="0.16.5";var d=new I("@firebase/app"),Ke="@firebase/app-compat",Ye="@firebase/analytics-compat",qe="@firebase/analytics",Xe="@firebase/app-check-compat",Qe="@firebase/app-check",Ze="@firebase/auth",et="@firebase/auth-compat",tt="@firebase/crashlytics",nt="@firebase/database",rt="@firebase/data-connect",it="@firebase/database-compat",st="@firebase/functions",ot="@firebase/functions-compat",at="@firebase/installations",ct="@firebase/installations-compat",ft="@firebase/messaging",lt="@firebase/messaging-compat",ht="@firebase/performance",ut="@firebase/performance-compat",dt="@firebase/remote-config",pt="@firebase/remote-config-compat",mt="@firebase/storage",gt="@firebase/storage-compat",bt="@firebase/firestore",yt="@firebase/ai",_t="@firebase/firestore-compat",Et="firebase",wt="13.2.0";var j="[DEFAULT]",vt={[U]:"fire-core",[Ke]:"fire-core-compat",[qe]:"fire-analytics",[Ye]:"fire-analytics-compat",[Qe]:"fire-app-check",[Xe]:"fire-app-check-compat",[Ze]:"fire-auth",[et]:"fire-auth-compat",[tt]:"fire-cls",[nt]:"fire-rtdb",[rt]:"fire-data-connect",[it]:"fire-rtdb-compat",[st]:"fire-fn",[ot]:"fire-fn-compat",[at]:"fire-iid",[ct]:"fire-iid-compat",[ft]:"fire-fcm",[lt]:"fire-fcm-compat",[ht]:"fire-perf",[ut]:"fire-perf-compat",[dt]:"fire-rc",[pt]:"fire-rc-compat",[mt]:"fire-gcs",[gt]:"fire-gcs-compat",[bt]:"fire-fst",[_t]:"fire-fst-compat",[yt]:"fire-vertex","fire-js":"fire-js",[Et]:"fire-js-all"};var x=new Map,Dt=new Map,W=new Map;function pe(t,e){try{t.container.addComponent(e)}catch(n){d.debug(`Component ${e.name} failed to register with FirebaseApp ${t.name}`,n)}}function J(t){let e=t.name;if(W.has(e))return d.debug(`There were multiple attempts to register component ${e}.`),!1;W.set(e,t);for(let n of x.values())pe(n,t);for(let n of Dt.values())pe(n,t);return!0}function En(t,e){let n=t.container.getProvider("heartbeat").getImmediate({optional:!0});return n&&n.triggerHeartbeat(),t.container.getProvider(e)}function wn(t){return t==null?!1:t.settings!==void 0}var St={"no-app":"No Firebase App '{$appName}' has been created - call initializeApp() first","bad-app-name":"Illegal App name: '{$appName}'","duplicate-app":"Firebase App named '{$appName}' already exists with different {$mismatchedParam}. Existing: '{$oldValue}'. New: '{$newValue}'.","app-deleted":"Firebase App named '{$appName}' already deleted","server-app-deleted":"Firebase Server App has been deleted","no-options":"Need to provide options, when not being deployed to hosting via source.","invalid-app-argument":"firebase.{$appName}() takes either no argument or a Firebase App instance.","invalid-log-argument":"First argument to `onLog` must be null or a function.","idb-open":"Error thrown when opening IndexedDB. Original error: {$originalErrorMessage}.","idb-get":"Error thrown when reading from IndexedDB. Original error: {$originalErrorMessage}.","idb-set":"Error thrown when writing to IndexedDB. Original error: {$originalErrorMessage}.","idb-delete":"Error thrown when deleting from IndexedDB. Original error: {$originalErrorMessage}.","finalization-registry-not-supported":"FirebaseServerApp deleteOnDeref field defined but the JS runtime does not support FinalizationRegistry.","invalid-server-app-environment":"FirebaseServerApp is not for use in browser environments."},u=new _("app","Firebase",St);var G=class{constructor(e,n,r){this._isDeleted=!1,this._options={...e},this._config={...n},this._name=n.name,this._automaticDataCollectionEnabled=n.automaticDataCollectionEnabled,this._container=r,this.container.addComponent(new g("app",()=>this,"PUBLIC"))}get automaticDataCollectionEnabled(){return this.checkDestroyed(),this._automaticDataCollectionEnabled}set automaticDataCollectionEnabled(e){this.checkDestroyed(),this._automaticDataCollectionEnabled=e}get name(){return this.checkDestroyed(),this._name}get options(){return this.checkDestroyed(),this._options}get config(){return this.checkDestroyed(),this._config}get container(){return this._container}get isDeleted(){return this._isDeleted}set isDeleted(e){this._isDeleted=e}checkDestroyed(){if(this.isDeleted)throw u.create("app-deleted",{appName:this._name})}};var vn=wt;function Ct(t,e={}){let n=t;typeof e!="object"&&(e={name:e});let r={name:j,automaticDataCollectionEnabled:!0,...e},i=r.name;if(typeof i!="string"||!i)throw u.create("bad-app-name",{appName:String(i)});if(n||(n=R()),!n)throw u.create("no-options");let s=x.get(i);if(s)if(C(n,s.options)){if(C(r,s.config))return s;throw u.create("duplicate-app",{appName:i,mismatchedParam:"config",oldValue:JSON.stringify(s.config),newValue:JSON.stringify(r)})}else throw u.create("duplicate-app",{appName:i,mismatchedParam:"options",oldValue:JSON.stringify(s.options),newValue:JSON.stringify(n)});let o=new A(i);for(let f of W.values())o.addComponent(f);let a=new G(n,r,o);return x.set(i,a),a}function Dn(t=j){let e=x.get(t);if(!e&&t===j&&R())return Ct();if(!e)throw u.create("no-app",{appName:t});return e}function H(t,e,n){let r=vt[t]??t;n&&(r+=`-${n}`);let i=r.match(/\s|\//),s=e.match(/\s|\//);if(i||s){let o=[`Unable to register library "${r}" with version "${e}":`];i&&o.push(`library name "${r}" contains illegal characters (whitespace or "/")`),i&&s&&o.push("and"),s&&o.push(`version name "${e}" contains illegal characters (whitespace or "/")`),d.warn(o.join(" "));return}J(new g(`${r}-version`,()=>({library:r,version:e}),"VERSION"))}var At="firebase-heartbeat-database",It=1,E="firebase-heartbeat-store",z=null;function ye(){return z||(z=ue(At,It,{upgrade:(t,e)=>{switch(e){case 0:try{t.createObjectStore(E)}catch(n){console.warn(n)}}}}).catch(t=>{throw u.create("idb-open",{originalErrorMessage:t.message})})),z}async function Ot(t){try{let n=(await ye()).transaction(E),r=await n.objectStore(E).get(_e(t));return await n.done,r}catch(e){if(e instanceof p)d.warn(e.message);else{let n=u.create("idb-get",{originalErrorMessage:e?.message});d.warn(n.message)}}}async function me(t,e){try{let r=(await ye()).transaction(E,"readwrite");await r.objectStore(E).put(e,_e(t)),await r.done}catch(n){if(n instanceof p)d.warn(n.message);else{let r=u.create("idb-set",{originalErrorMessage:n?.message});d.warn(r.message)}}}function _e(t){return`${t.name}!${t.options.appId}`}var xt=1024,Bt=30,K=class{constructor(e){this.container=e,this._heartbeatsCache=null;let n=this.container.getProvider("app").getImmediate();this._storage=new Y(n),this._heartbeatsCachePromise=this._storage.read().then(r=>(this._heartbeatsCache=r,r))}async triggerHeartbeat(){try{let n=this.container.getProvider("platform-logger").getImmediate().getPlatformInfoString(),r=ge();if(this._heartbeatsCache?.heartbeats==null&&(this._heartbeatsCache=await this._heartbeatsCachePromise,this._heartbeatsCache?.heartbeats==null)||this._heartbeatsCache.lastSentHeartbeatDate===r||this._heartbeatsCache.heartbeats.some(i=>i.date===r))return;if(this._heartbeatsCache.heartbeats.push({date:r,agent:n}),this._heartbeatsCache.heartbeats.length>Bt){let i=Nt(this._heartbeatsCache.heartbeats);this._heartbeatsCache.heartbeats.splice(i,1)}return this._storage.overwrite(this._heartbeatsCache)}catch(e){d.warn(e)}}async getHeartbeatsHeader(){try{if(this._heartbeatsCache===null&&await this._heartbeatsCachePromise,this._heartbeatsCache?.heartbeats==null||this._heartbeatsCache.heartbeats.length===0)return"";let e=ge(),{heartbeatsToSend:n,unsentEntries:r}=Tt(this._heartbeatsCache.heartbeats),i=y(JSON.stringify({version:2,heartbeats:n}));return this._heartbeatsCache.lastSentHeartbeatDate=e,r.length>0?(this._heartbeatsCache.heartbeats=r,await this._storage.overwrite(this._heartbeatsCache)):(this._heartbeatsCache.heartbeats=[],this._storage.overwrite(this._heartbeatsCache)),i}catch(e){return d.warn(e),""}}};function ge(){return new Date().toISOString().substring(0,10)}function Tt(t,e=xt){let n=[],r=t.slice();for(let i of t){let s=n.find(o=>o.agent===i.agent);if(s){if(s.dates.push(i.date),be(n)>e){s.dates.pop();break}}else if(n.push({agent:i.agent,dates:[i.date]}),be(n)>e){n.pop();break}r=r.slice(1)}return{heartbeatsToSend:n,unsentEntries:r}}var Y=class{constructor(e){this.app=e,this._canUseIndexedDBPromise=this.runIndexedDBEnvironmentCheck()}async runIndexedDBEnvironmentCheck(){return ie()?se().then(()=>!0).catch(()=>!1):!1}async read(){if(await this._canUseIndexedDBPromise){let n=await Ot(this.app);return n?.heartbeats?n:{heartbeats:[]}}else return{heartbeats:[]}}async overwrite(e){if(await this._canUseIndexedDBPromise){let r=await this.read();return me(this.app,{lastSentHeartbeatDate:e.lastSentHeartbeatDate??r.lastSentHeartbeatDate,heartbeats:e.heartbeats})}else return}async add(e){if(await this._canUseIndexedDBPromise){let r=await this.read();return me(this.app,{lastSentHeartbeatDate:e.lastSentHeartbeatDate??r.lastSentHeartbeatDate,heartbeats:[...r.heartbeats,...e.heartbeats]})}else return}};function be(t){return y(JSON.stringify({version:2,heartbeats:t})).length}function Nt(t){if(t.length===0)return-1;let e=0,n=t[0].date;for(let r=1;r<t.length;r++)t[r].date<n&&(n=t[r].date,e=r);return e}function Rt(t){J(new g("platform-logger",e=>new V(e),"PRIVATE")),J(new g("heartbeat",e=>new K(e),"PRIVATE")),H(U,de,t),H(U,de,"esm2020"),H("fire-js","")}Rt("");export{te as a,De as b,Ie as c,Lt as d,$t as e,D as f,Pt as g,ne as h,Ft as i,Ht as j,zt as k,Vt as l,Ut as m,jt as n,Wt as o,ie as p,se as q,Jt as r,p as s,_ as t,Gt as u,C as v,Kt as w,Yt as x,qt as y,Xt as z,Zt as A,en as B,tn as C,g as D,c as E,I as F,ue as G,fn as H,J as I,En as J,wn as K,vn as L,Ct as M,Dn as N,H as O};
/*! Bundled license information:

@firebase/util/dist/index.esm.js:
@firebase/util/dist/index.esm.js:
@firebase/util/dist/index.esm.js:
@firebase/util/dist/index.esm.js:
@firebase/util/dist/index.esm.js:
@firebase/util/dist/index.esm.js:
@firebase/util/dist/index.esm.js:
@firebase/util/dist/index.esm.js:
@firebase/util/dist/index.esm.js:
@firebase/logger/dist/esm/index.esm.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/util/dist/index.esm.js:
  (**
   * @license
   * Copyright 2022 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2017 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2021 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/util/dist/index.esm.js:
  (**
   * @license
   * Copyright 2022 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/util/dist/index.esm.js:
@firebase/component/dist/esm/index.esm.js:
@firebase/app/dist/esm/index.esm.js:
@firebase/app/dist/esm/index.esm.js:
  (**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/util/dist/index.esm.js:
  (**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/util/dist/index.esm.js:
  (**
   * @license
   * Copyright 2021 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2025 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/app/dist/esm/index.esm.js:
  (**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2023 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/app/dist/esm/index.esm.js:
  (**
   * @license
   * Copyright 2021 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
*/
