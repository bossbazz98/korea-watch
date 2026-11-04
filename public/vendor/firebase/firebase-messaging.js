import{A as R,D as b,G as k,H as v,I as y,J as A,N as P,O as I,p as z,q as Y,r as Q,s as X,t as _}from"./chunk-VKBP5T25.js";var te="@firebase/installations",j="0.6.24";var ne=1e4,re=`w:${j}`,oe="FIS_v2",Ve="https://firebaseinstallations.googleapis.com/v1",We=3600*1e3,Ge="installations",Je="Installations";var ze={"missing-app-config-values":'Missing App configuration value: "{$valueName}"',"not-registered":"Firebase Installation is not registered.","installation-not-found":"Firebase Installation not found.","request-failed":'{$requestName} request failed with error "{$serverCode} {$serverStatus}: {$serverMessage}"',"app-offline":"Could not process request. Application offline.","delete-pending-registration":"Can't delete installation while there is a pending registration request."},g=new _(Ge,Je,ze);function ie(e){return e instanceof X&&e.code.includes("request-failed")}function ae({projectId:e}){return`${Ve}/projects/${e}/installations`}function se(e){return{token:e.token,requestStatus:2,expiresIn:Qe(e.expiresIn),creationTime:Date.now()}}async function ce(e,t){let r=(await t.json()).error;return g.create("request-failed",{requestName:e,serverCode:r.code,serverMessage:r.message,serverStatus:r.status})}function ue({apiKey:e}){return new Headers({"Content-Type":"application/json",Accept:"application/json","x-goog-api-key":e})}function Ye(e,{refreshToken:t}){let n=ue(e);return n.append("Authorization",Xe(t)),n}async function de(e){let t=await e();return t.status>=500&&t.status<600?e():t}function Qe(e){return Number(e.replace("s","000"))}function Xe(e){return`${oe} ${e}`}async function Ze({appConfig:e,heartbeatServiceProvider:t},{fid:n}){let r=ae(e),o=ue(e),i=t.getImmediate({optional:!0});if(i){let s=await i.getHeartbeatsHeader();s&&o.append("x-firebase-client",s)}let a={fid:n,authVersion:oe,appId:e.appId,sdkVersion:re},u={method:"POST",headers:o,body:JSON.stringify(a)},d=await de(()=>fetch(r,u));if(d.ok){let s=await d.json();return{fid:s.fid||n,registrationStatus:2,refreshToken:s.refreshToken,authToken:se(s.authToken)}}else throw await ce("Create Installation",d)}function fe(e){return new Promise(t=>{setTimeout(t,e)})}function et(e){return btoa(String.fromCharCode(...e)).replace(/\+/g,"-").replace(/\//g,"_")}var tt=/^[cdef][\w-]{21}$/,H="";function nt(){try{let e=new Uint8Array(17);(self.crypto||self.msCrypto).getRandomValues(e),e[0]=112+e[0]%16;let n=rt(e);return tt.test(n)?n:H}catch{return H}}function rt(e){return et(e).substr(0,22)}function T(e){return`${e.appName}!${e.appId}`}var m=new Map;function le(e,t){let n=T(e);pe(n,t),at(n,t)}function ot(e,t){ge();let n=T(e),r=m.get(n);r||(r=new Set,m.set(n,r)),r.add(t)}function it(e,t){let n=T(e),r=m.get(n);r&&(r.delete(t),r.size===0&&m.delete(n),he())}function pe(e,t){let n=m.get(e);if(n)for(let r of n)r(t)}function at(e,t){let n=ge();n&&n.postMessage({key:e,fid:t}),he()}var p=null;function ge(){return!p&&"BroadcastChannel"in self&&(p=new BroadcastChannel("[Firebase] FID Change"),p.onmessage=e=>{pe(e.data.key,e.data.fid)}),p}function he(){m.size===0&&p&&(p.close(),p=null)}var st="firebase-installations-database",ct=1,h="firebase-installations-store",K=null;function L(){return K||(K=k(st,ct,{upgrade:(e,t)=>{t===0&&e.createObjectStore(h)}})),K}async function C(e,t){let n=T(e),o=(await L()).transaction(h,"readwrite"),i=o.objectStore(h),a=await i.get(n);return await i.put(t,n),await o.done,(!a||a.fid!==t.fid)&&le(e,t.fid),t}async function we(e){let t=T(e),r=(await L()).transaction(h,"readwrite");await r.objectStore(h).delete(t),await r.done}async function D(e,t){let n=T(e),o=(await L()).transaction(h,"readwrite"),i=o.objectStore(h),a=await i.get(n),u=t(a);return u===void 0?await i.delete(n):await i.put(u,n),await o.done,u&&(!a||a.fid!==u.fid)&&le(e,u.fid),u}async function q(e){let t,n=await D(e.appConfig,r=>{let o=ut(r),i=dt(e,o);return t=i.registrationPromise,i.installationEntry});return n.fid===H?{installationEntry:await t}:{installationEntry:n,registrationPromise:t}}function ut(e){let t=e||{fid:nt(),registrationStatus:0};return be(t)}function dt(e,t){if(t.registrationStatus===0){if(!navigator.onLine){let o=Promise.reject(g.create("app-offline"));return{installationEntry:t,registrationPromise:o}}let n={fid:t.fid,registrationStatus:1,registrationTime:Date.now()},r=ft(e,n);return{installationEntry:n,registrationPromise:r}}else return t.registrationStatus===1?{installationEntry:t,registrationPromise:lt(e)}:{installationEntry:t}}async function ft(e,t){try{let n=await Ze(e,t);return C(e.appConfig,n)}catch(n){throw ie(n)&&n.customData.serverCode===409?await we(e.appConfig):await C(e.appConfig,{fid:t.fid,registrationStatus:0}),n}}async function lt(e){let t=await Z(e.appConfig);for(;t.registrationStatus===1;)await fe(100),t=await Z(e.appConfig);if(t.registrationStatus===0){let{installationEntry:n,registrationPromise:r}=await q(e);return r||n}return t}function Z(e){return D(e,t=>{if(!t)throw g.create("installation-not-found");return be(t)})}function be(e){return pt(e)?{fid:e.fid,registrationStatus:0}:e}function pt(e){return e.registrationStatus===1&&e.registrationTime+ne<Date.now()}async function gt({appConfig:e,heartbeatServiceProvider:t},n){let r=ht(e,n),o=Ye(e,n),i=t.getImmediate({optional:!0});if(i){let s=await i.getHeartbeatsHeader();s&&o.append("x-firebase-client",s)}let a={installation:{sdkVersion:re,appId:e.appId}},u={method:"POST",headers:o,body:JSON.stringify(a)},d=await de(()=>fetch(r,u));if(d.ok){let s=await d.json();return se(s)}else throw await ce("Generate Auth Token",d)}function ht(e,{fid:t}){return`${ae(e)}/${t}/authTokens:generate`}async function $(e,t=!1){let n,r=await D(e.appConfig,i=>{if(!ye(i))throw g.create("not-registered");let a=i.authToken;if(!t&&yt(a))return i;if(a.requestStatus===1)return n=wt(e,t),i;{if(!navigator.onLine)throw g.create("app-offline");let u=mt(i);return n=bt(e,u),u}});return n?await n:r.authToken}async function wt(e,t){let n=await ee(e.appConfig);for(;n.authToken.requestStatus===1;)await fe(100),n=await ee(e.appConfig);let r=n.authToken;return r.requestStatus===0?$(e,t):r}function ee(e){return D(e,t=>{if(!ye(t))throw g.create("not-registered");let n=t.authToken;return Tt(n)?{...t,authToken:{requestStatus:0}}:t})}async function bt(e,t){try{let n=await gt(e,t),r={...t,authToken:n};return await C(e.appConfig,r),n}catch(n){if(ie(n)&&(n.customData.serverCode===401||n.customData.serverCode===404))await we(e.appConfig);else{let r={...t,authToken:{requestStatus:0}};await C(e.appConfig,r)}throw n}}function ye(e){return e!==void 0&&e.registrationStatus===2}function yt(e){return e.requestStatus===2&&!It(e)}function It(e){let t=Date.now();return t<e.creationTime||e.creationTime+e.expiresIn<t+We}function mt(e){let t={requestStatus:1,requestTime:Date.now()};return{...e,authToken:t}}function Tt(e){return e.requestStatus===1&&e.requestTime+ne<Date.now()}async function St(e){let t=e,{installationEntry:n,registrationPromise:r}=await q(t);return r?r.catch(console.error):$(t).catch(console.error),n.fid}async function kt(e,t=!1){let n=e;return await vt(n),(await $(n,t)).token}async function vt(e){let{registrationPromise:t}=await q(e);t&&await t}function Ie(e,t){let{appConfig:n}=e;return ot(n,t),()=>{it(n,t)}}function At(e){if(!e||!e.options)throw x("App Configuration");if(!e.name)throw x("App Name");let t=["projectId","apiKey","appId"];for(let n of t)if(!e.options[n])throw x(n);return{appName:e.name,projectId:e.options.projectId,apiKey:e.options.apiKey,appId:e.options.appId}}function x(e){return g.create("missing-app-config-values",{valueName:e})}var me="installations",Et="installations-internal",_t=e=>{let t=e.getProvider("app").getImmediate(),n=At(t),r=A(t,"heartbeat");return{app:t,appConfig:n,heartbeatServiceProvider:r,_delete:()=>Promise.resolve()}},Rt=e=>{let t=e.getProvider("app").getImmediate(),n=A(t,me).getImmediate();return{getId:()=>St(n),getToken:o=>kt(n,o)}};function Ct(){y(new b(me,_t,"PUBLIC")),y(new b(Et,Rt,"PRIVATE"))}Ct();I(te,j);I(te,j,"esm2020");var Dt="/firebase-messaging-sw.js",Nt="/firebase-cloud-messaging-push-scope",Fe="BDOU99-h67HcA6JeFXHbSNMu7e2yNNu3RzoMj8TM4W88jITfq7ZmPvIM1Iv-4_l2LxQcYwhqby2xGpWwzjfAnG4",Ot="https://fcmregistrations.googleapis.com/v1",Me="google.c.a.c_id",Ft="google.c.a.c_l",Mt="google.c.a.ts",Pt="google.c.a.e",Te=1e4,Se;(function(e){e[e.DATA_MESSAGE=1]="DATA_MESSAGE",e[e.DISPLAY_NOTIFICATION=3]="DISPLAY_NOTIFICATION"})(Se||(Se={}));var S;(function(e){e.PUSH_RECEIVED="push-received",e.NOTIFICATION_CLICKED="notification-clicked",e.FID_REGISTERED="fid-registered"})(S||(S={}));function f(e){let t=new Uint8Array(e);return btoa(String.fromCharCode(...t)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_")}function Pe(e){let t="=".repeat((4-e.length%4)%4),n=(e+t).replace(/\-/g,"+").replace(/_/g,"/"),r=atob(n),o=new Uint8Array(r.length);for(let i=0;i<r.length;++i)o[i]=r.charCodeAt(i);return o}var B="fcm_token_details_db",Kt=5,ke="fcm_token_object_Store";async function xt(e){if("databases"in indexedDB&&!(await indexedDB.databases()).map(i=>i.name).includes(B))return null;let t=null;return(await k(B,Kt,{upgrade:async(r,o,i,a)=>{if(o<2||!r.objectStoreNames.contains(ke))return;let u=a.objectStore(ke),d=await u.index("fcmSenderId").get(e);if(await u.clear(),!!d){if(o===2){let s=d;if(!s.auth||!s.p256dh||!s.endpoint)return;t={token:s.fcmToken,createTime:s.createTime??Date.now(),subscriptionOptions:{auth:s.auth,p256dh:s.p256dh,endpoint:s.endpoint,swScope:s.swScope,vapidKey:typeof s.vapidKey=="string"?s.vapidKey:f(s.vapidKey)}}}else if(o===3){let s=d;t={token:s.fcmToken,createTime:s.createTime,subscriptionOptions:{auth:f(s.auth),p256dh:f(s.p256dh),endpoint:s.endpoint,swScope:s.swScope,vapidKey:f(s.vapidKey)}}}else if(o===4){let s=d;t={token:s.fcmToken,createTime:s.createTime,subscriptionOptions:{auth:f(s.auth),p256dh:f(s.p256dh),endpoint:s.endpoint,swScope:s.swScope,vapidKey:f(s.vapidKey)}}}}}})).close(),await v(B),await v("fcm_vapid_details_db"),await v("undefined"),Ht(t)?t:null}function Ht(e){if(!e||!e.subscriptionOptions)return!1;let{subscriptionOptions:t}=e;return typeof e.createTime=="number"&&e.createTime>0&&typeof e.token=="string"&&e.token.length>0&&typeof t.auth=="string"&&t.auth.length>0&&typeof t.p256dh=="string"&&t.p256dh.length>0&&typeof t.endpoint=="string"&&t.endpoint.length>0&&typeof t.swScope=="string"&&t.swScope.length>0&&typeof t.vapidKey=="string"&&t.vapidKey.length>0}var jt={"missing-app-config-values":'Missing App configuration value: "{$valueName}"',"only-available-in-window":"This method is available in a Window context.","only-available-in-sw":"This method is available in a service worker context.","permission-default":"The notification permission was not granted and dismissed instead.","permission-blocked":"The notification permission was not granted and blocked instead.","unsupported-browser":"This browser doesn't support the API's required to use the Firebase SDK.","indexed-db-unsupported":"This browser doesn't support indexedDb.open() (ex. Safari iFrame, Firefox Private Browsing, etc)","failed-service-worker-registration":"We are unable to register the default service worker. {$browserErrorMessage}","token-subscribe-failed":"A problem occurred while subscribing the user to FCM: {$errorInfo}","token-subscribe-no-token":"FCM returned no token when subscribing the user to push.","fid-registration-failed":"A problem occurred while creating an FCM registration via FID: {$errorInfo}","fid-unregister-failed":"A problem occurred while unregistering the FCM registration via FID: {$errorInfo}","fid-registration-idb-schema-unavailable":"Unable to read or persist FID registration metadata because the messaging IndexedDB schema is unavailable (for example, the database could not be upgraded to the latest version).","token-unsubscribe-failed":"A problem occurred while unsubscribing the user from FCM: {$errorInfo}","token-update-failed":"A problem occurred while updating the user from FCM: {$errorInfo}","token-update-no-token":"FCM returned no token when updating the user to push.","use-sw-after-get-token":"The useServiceWorker() method may only be called once and must be called before calling getToken() to ensure your service worker is used.","invalid-sw-registration":"The input to useServiceWorker() must be a ServiceWorkerRegistration.","invalid-bg-handler":"The input to setBackgroundMessageHandler() must be a function.","invalid-vapid-key":"The public VAPID key must be a string.","use-vapid-key-after-get-token":"The usePublicVapidKey() method may only be called once and must be called before calling getToken() to ensure your VAPID key is used.","invalid-on-registered-handler":"No onRegistered callback handler was provided or registered. Implement onRegistered() before register()."},c=new _("messaging","Messaging",jt);var ve="firebase-messaging-database",Ae=2,w="firebase-messaging-store",l="firebase-messaging-fid-registration-store",Lt={openDB:k,deleteDB:v},Ee=Lt,E=null;function qt(e,t,n){switch(t){case 0:if(e.createObjectStore(w),n===1)break;case 1:n===2&&e.createObjectStore(l)}}function _e(e){return{upgrade:(t,n)=>{qt(t,n,e)},blocked:()=>{},blocking:(t,n,r)=>{E=null,r.target?.close()},terminated:()=>{E=null}}}function N(){return E||(E=Ee.openDB(ve,Ae,_e(2)).catch(()=>Ee.openDB(ve,Ae-1,_e(1)))),E}function Ke(e,t){return e.objectStoreNames.contains(t)}function xe(e){if(!Ke(e,l))throw c.create("fid-registration-idb-schema-unavailable")}async function $t(e){let t=O(e),r=await(await N()).transaction(w).objectStore(w).get(t);if(r)return r;{let o=await xt(e.appConfig.senderId);if(o)return await G(e,o),o}}async function G(e,t){let n=O(e),r=await N(),o=[w],i=Ke(r,l);i&&o.push(l);let a=r.transaction(o,"readwrite");return await a.objectStore(w).put(t,n),i&&await a.objectStore(l).delete(n),await a.done,t}async function He(e){let t=O(e),n=await N();return xe(n),await n.transaction(l).objectStore(l).get(t)}async function Bt(e,t){let n=O(e),r=await N();xe(r);let o=r.transaction([w,l],"readwrite");return await o.objectStore(l).put(t,n),await o.objectStore(w).delete(n),await o.done,t}function O({appConfig:e}){return e.appId}var Re="@firebase/messaging",V="0.13.3";var Ut=3,Vt=1e3;async function Wt(e,t){let n=await M(e),r=J(t,e.appConfig.appName,!1),o={method:"POST",headers:n,body:JSON.stringify(r)},i;try{i=await(await fetch(F(e.appConfig),o)).json()}catch(a){throw c.create("token-subscribe-failed",{errorInfo:a?.toString()})}if(i.error){let a=i.error.message;throw c.create("token-subscribe-failed",{errorInfo:a})}if(!i.token)throw c.create("token-subscribe-no-token");return i.token}async function Gt(e,t){let n=await M(e),r=J(t,e.appConfig.appName,!0),o={method:"POST",headers:n,body:JSON.stringify(r)},i;try{i=await Xt(()=>fetch(F(e.appConfig),o),Ut,Vt)}catch(d){throw c.create("fid-registration-failed",{errorInfo:d?.toString()})}if(i.ok)return{responseFid:await Jt(i)};let a;try{a=await i.json()}catch{throw c.create("fid-registration-failed",{errorInfo:i.statusText})}let u=a.error?.message??i.statusText;throw c.create("fid-registration-failed",{errorInfo:u})}async function Jt(e){let t=await e.text();if(!t.trim())throw c.create("fid-registration-failed",{errorInfo:"CreateRegistration succeeded but response body is empty"});let n;try{n=JSON.parse(t)}catch{throw c.create("fid-registration-failed",{errorInfo:"CreateRegistration succeeded but response body is not valid JSON"})}let r=n.name;if(typeof r!="string"||r.length===0)throw c.create("fid-registration-failed",{errorInfo:"CreateRegistration succeeded but response did not include a non-empty name"});return zt(r)}var Ce="/registrations/";function zt(e){let t=e.indexOf(Ce);if(t!==-1){let n=e.slice(t+Ce.length);if(n.length>0)return n}throw c.create("fid-registration-failed",{errorInfo:"CreateRegistration succeeded but response name is not a valid registration resource name"})}async function Yt(e,t){let n=await M(e),r=J(t.subscriptionOptions,e.appConfig.appName,!1),o={method:"PATCH",headers:n,body:JSON.stringify(r)},i;try{i=await(await fetch(`${F(e.appConfig)}/${t.token}`,o)).json()}catch(a){throw c.create("token-update-failed",{errorInfo:a?.toString()})}if(i.error){let a=i.error.message;throw c.create("token-update-failed",{errorInfo:a})}if(!i.token)throw c.create("token-update-no-token");return i.token}async function Qt(e,t){let r={method:"DELETE",headers:await M(e)};try{let i=await(await fetch(`${F(e.appConfig)}/${t}`,r)).json();if(i.error){let a=i.error.message;throw c.create("token-unsubscribe-failed",{errorInfo:a})}}catch(o){throw c.create("token-unsubscribe-failed",{errorInfo:o?.toString()})}}async function Xt(e,t,n){let r;for(let o=0;o<t;o++)try{return await e()}catch(i){if(r=i,o<t-1){let a=n*Math.pow(2,o);await new Promise(u=>setTimeout(u,a))}}throw r}function F({projectId:e}){return`${Ot}/projects/${e}/registrations`}async function M({appConfig:e,installations:t}){let n=await t.getToken();return new Headers({"Content-Type":"application/json",Accept:"application/json","x-goog-api-key":e.apiKey,"x-goog-firebase-installations-auth":`FIS ${n}`})}function Zt(e,t){try{if(/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(e))return new URL(e).host}catch{}try{if(typeof self<"u"&&self.location?.href)return new URL(e,self.location.origin).host}catch{}return typeof self<"u"&&self.location?.host?self.location.host:t}function J({p256dh:e,auth:t,endpoint:n,vapidKey:r,swScope:o},i,a){let u={web:{origin:Zt(o,i),endpoint:n,auth:t,p256dh:e}};return a&&(u.fcm_sdk_version=V),r!==Fe&&(u.web.applicationPubKey=r),u}var en=10080*60*1e3;async function tn(e){let t=await rn(e.swRegistration,e.vapidKey),n={vapidKey:e.vapidKey,swScope:e.swRegistration.scope,endpoint:t.endpoint,auth:f(t.getKey("auth")),p256dh:f(t.getKey("p256dh"))},r=await $t(e.firebaseDependencies);if(r){if(on(r.subscriptionOptions,n))return Date.now()>=r.createTime+en?nn(e,{token:r.token,createTime:Date.now(),subscriptionOptions:n}):r.token;try{await Qt(e.firebaseDependencies,r.token)}catch(o){console.warn(o)}return De(e.firebaseDependencies,n)}else return De(e.firebaseDependencies,n)}async function nn(e,t){try{let n=await Yt(e.firebaseDependencies,t),r={...t,token:n,createTime:Date.now()};return await G(e.firebaseDependencies,r),n}catch(n){throw n}}async function De(e,t){let r={token:await Wt(e,t),createTime:Date.now(),subscriptionOptions:t};return await G(e,r),r.token}async function rn(e,t){let n=await e.pushManager.getSubscription();return n||e.pushManager.subscribe({userVisibleOnly:!0,applicationServerKey:Pe(t)})}function on(e,t){let n=t.vapidKey===e.vapidKey,r=t.endpoint===e.endpoint,o=t.auth===e.auth,i=t.p256dh===e.p256dh;return n&&r&&o&&i}function an(e,t){let n=e.onRegisteredHandler;n&&(typeof n=="function"?n(t):n.next(t))}async function sn(e){try{e.swRegistration=await navigator.serviceWorker.register(Dt,{scope:Nt}),e.swRegistration.update().catch(()=>{}),await cn(e.swRegistration)}catch(t){throw c.create("failed-service-worker-registration",{browserErrorMessage:t?.message})}}async function cn(e){return new Promise((t,n)=>{let r=setTimeout(()=>n(new Error(`Service worker not registered after ${Te} ms`)),Te),o=e.installing||e.waiting;e.active?(clearTimeout(r),t()):o?o.onstatechange=i=>{i.target?.state==="activated"&&(o.onstatechange=null,clearTimeout(r),t())}:(clearTimeout(r),n(new Error("No incoming service worker found.")))})}async function je(e,t){if(!t&&!e.swRegistration&&await sn(e),!(!t&&e.swRegistration)){if(!(t instanceof ServiceWorkerRegistration))throw c.create("invalid-sw-registration");e.swRegistration=t}}async function Le(e,t){t?e.vapidKey=t:e.vapidKey||(e.vapidKey=Fe)}var Ne=3;async function un(e,t){let n=await dn(e.swRegistration,e.vapidKey),r={vapidKey:e.vapidKey,swScope:e.swRegistration.scope,endpoint:n.endpoint,auth:f(n.getKey("auth")),p256dh:f(n.getKey("p256dh"))},o=e.firebaseDependencies.installations;for(let i=0;i<Ne;i++){let{responseFid:a}=await Gt(e.firebaseDependencies,r);if(a===t)return;i<Ne-1&&await o.getToken(!0)}throw c.create("fid-registration-failed",{errorInfo:"CreateRegistration response FID does not match Firebase Installation ID"})}async function dn(e,t){let n=await e.pushManager.getSubscription();return n||e.pushManager.subscribe({userVisibleOnly:!0,applicationServerKey:Pe(t)})}var fn=10080*60*1e3;async function qe(e,t){if(!navigator)throw c.create("only-available-in-window");if(Notification.permission==="default"&&await Notification.requestPermission(),Notification.permission!=="granted")throw c.create("permission-blocked");if(!e.onRegisteredHandler)throw c.create("invalid-on-registered-handler");await Le(e,t?.vapidKey),await je(e,t?.serviceWorkerRegistration);let n=e._registerNotifyChain.catch(()=>{});return e._registerNotifyChain=n.then(async()=>{let r=await e.firebaseDependencies.installations.getId(),o=await He(e.firebaseDependencies),i=Date.now();if((!o||o.fid!==r||i>=o.lastRegisterTime+fn)&&(await un(e,r),await Bt(e.firebaseDependencies,{fid:r,lastRegisterTime:i,vapidKey:e.vapidKey})),!e.onRegisteredHandler)throw c.create("invalid-on-registered-handler");an(e,r)}),e._registerNotifyChain}function ln(e,t){return Ie(t,()=>{(async()=>!e.onRegisteredHandler||!await He(e.firebaseDependencies)||await qe(e).catch(()=>{}))()})}function Oe(e){let t={from:e.from,collapseKey:e.collapse_key,messageId:e.fcmMessageId};return pn(t,e),gn(t,e),hn(t,e),t}function pn(e,t){if(!t.notification)return;e.notification={};let n=t.notification.title;n&&(e.notification.title=n);let r=t.notification.body;r&&(e.notification.body=r);let o=t.notification.image;o&&(e.notification.image=o);let i=t.notification.icon;i&&(e.notification.icon=i)}function gn(e,t){t.data&&(e.data=t.data)}function hn(e,t){if(!t.fcmOptions&&!t.notification?.click_action)return;e.fcmOptions={};let n=t.fcmOptions?.link??t.notification?.click_action;n&&(e.fcmOptions.link=n);let r=t.fcmOptions?.analytics_label;r&&(e.fcmOptions.analyticsLabel=r)}function wn(e){return typeof e=="object"&&!!e&&Me in e}function bn(e){if(!e||!e.options)throw U("App Configuration Object");if(!e.name)throw U("App Name");let t=["projectId","apiKey","appId","messagingSenderId"],{options:n}=e;for(let r of t)if(!n[r])throw U(r);return{appName:e.name,projectId:n.projectId,apiKey:n.apiKey,appId:n.appId,senderId:n.messagingSenderId}}function U(e){return c.create("missing-app-config-values",{valueName:e})}var W=class{constructor(t,n,r){this.deliveryMetricsExportedToBigQueryEnabled=!1,this.onBackgroundMessageHandler=null,this.onMessageHandler=null,this.onRegisteredHandler=null,this.onUnregisteredHandler=null,this._registerNotifyChain=Promise.resolve(),this._fidChangeUnsubscribe=null,this.logEvents=[],this.logQueue={state:"stopped"};let o=bn(t);this.firebaseDependencies={app:t,appConfig:o,installations:n,analyticsProvider:r}}_delete(){return this._fidChangeUnsubscribe&&(this._fidChangeUnsubscribe(),this._fidChangeUnsubscribe=null),this.logQueue.state==="scheduled"&&clearTimeout(this.logQueue.timerId),this.logQueue={state:"stopped"},Promise.resolve()}};async function $e(e,t){if(!navigator)throw c.create("only-available-in-window");if(Notification.permission==="default"&&await Notification.requestPermission(),Notification.permission!=="granted")throw c.create("permission-blocked");return await Le(e,t?.vapidKey),await je(e,t?.serviceWorkerRegistration),tn(e)}async function yn(e,t,n){let r=In(t);(await e.firebaseDependencies.analyticsProvider.get()).logEvent(r,{message_id:n[Me],message_name:n[Ft],message_time:n[Mt],message_device_time:Math.floor(Date.now()/1e3)})}function In(e){switch(e){case S.NOTIFICATION_CLICKED:return"notification_open";case S.PUSH_RECEIVED:return"notification_foreground";default:throw new Error}}async function mn(e,t){let n=t.data;if(!n.isFirebaseMessaging)return;if(e.onMessageHandler&&n.messageType===S.PUSH_RECEIVED&&(typeof e.onMessageHandler=="function"?e.onMessageHandler(Oe(n)):e.onMessageHandler.next(Oe(n))),e.onRegisteredHandler&&n.messageType===S.FID_REGISTERED){let o=n.fid;typeof e.onRegisteredHandler=="function"?e.onRegisteredHandler(o):e.onRegisteredHandler.next(o)}let r=n.data;wn(r)&&r[Pt]==="1"&&await yn(e,n.messageType,r)}var Tn=e=>{let t=new W(e.getProvider("app").getImmediate(),e.getProvider("installations-internal").getImmediate(),e.getProvider("analytics-internal"));return navigator.serviceWorker.addEventListener("message",n=>mn(t,n)),t._fidChangeUnsubscribe=ln(t,e.getProvider("installations").getImmediate()),t},Sn=e=>{let t=e.getProvider("messaging").getImmediate();return{getToken:r=>$e(t,r),register:r=>qe(t,r)}};function kn(){y(new b("messaging",Tn,"PUBLIC")),y(new b("messaging-internal",Sn,"PRIVATE")),I(Re,V),I(Re,V,"esm2020")}async function Be(){try{await Y()}catch{return!1}return typeof window<"u"&&z()&&Q()&&"serviceWorker"in navigator&&"PushManager"in window&&"Notification"in window&&"fetch"in window&&ServiceWorkerRegistration.prototype.hasOwnProperty("showNotification")&&PushSubscription.prototype.hasOwnProperty("getKey")}function vn(e,t){if(!navigator)throw c.create("only-available-in-window");return e.onMessageHandler=t,()=>{e.onMessageHandler=null}}function An(e=P()){return Be().then(t=>{if(!t)throw c.create("unsupported-browser")},t=>{throw c.create("indexed-db-unsupported")}),A(R(e),"messaging").getImmediate()}async function En(e,t){return e=R(e),$e(e,t)}function _n(e,t){return e=R(e),vn(e,t)}kn();export{An as getMessaging,En as getToken,Be as isSupported,_n as onMessage};
/*! Bundled license information:

@firebase/installations/dist/esm/index.esm.js:
@firebase/installations/dist/esm/index.esm.js:
@firebase/messaging/dist/esm/index.esm.js:
@firebase/messaging/dist/esm/index.esm.js:
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

@firebase/installations/dist/esm/index.esm.js:
@firebase/installations/dist/esm/index.esm.js:
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

@firebase/messaging/dist/esm/index.esm.js:
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
   * Copyright 2018 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
   * in compliance with the License. You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software distributed under the License
   * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
   * or implied. See the License for the specific language governing permissions and limitations under
   * the License.
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

@firebase/messaging/dist/esm/index.esm.js:
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
  (**
   * @license
   * Copyright 2026 Google LLC
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

@firebase/messaging/dist/esm/index.esm.js:
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

@firebase/messaging/dist/esm/index.esm.js:
@firebase/messaging/dist/esm/index.esm.js:
  (**
   * @license
   * Copyright 2026 Google LLC
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

@firebase/messaging/dist/esm/index.esm.js:
@firebase/messaging/dist/esm/index.esm.js:
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
*/
