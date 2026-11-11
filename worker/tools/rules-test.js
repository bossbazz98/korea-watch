const fs=require('fs');
const assert=require('node:assert/strict');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const client=require('firebase/firestore');
const {doc,setDoc,getDoc,serverTimestamp,Timestamp,updateDoc}=client;
(async()=>{
  const env=await initializeTestEnvironment({projectId:'demo-korea-watch',firestore:{rules:fs.readFileSync('../firestore.rules','utf8')}});
  const data=()=>({token:'t'.repeat(120),cats:['korwar'],level:'all',enabled:true,testRequested:false,updatedAt:serverTimestamp(),lang:'th',subscriptionVersion:2,quietOn:true,quietFrom:22,quietTo:7,quietBypass:true});
  try {
    const alice=env.authenticatedContext('alice').firestore(),bob=env.authenticatedContext('bob').firestore(),anon=env.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(anon,'subscribers/alice'),data()));
    await assertFails(setDoc(doc(bob,'subscribers/alice'),data()));
    await assertSucceeds(setDoc(doc(alice,'subscribers/alice'),data()));
    await assertSucceeds(getDoc(doc(alice,'subscribers/alice')));
    await assertFails(getDoc(doc(bob,'subscribers/alice')));
    await assertSucceeds(setDoc(doc(alice,'subscribers/alice'),{...data(),lang:'ko'}));
    await assertFails(setDoc(doc(alice,'subscribers/alice'),{...data(),lang:'xx'}));
    await assertFails(setDoc(doc(alice,'subscribers/alice'),{...data(),cats:['unknown']}));
    await assertSucceeds(setDoc(doc(alice,'subscribers/alice'),{...data(),cats:['tech','crypto','hot','foreign']}));
    await assertSucceeds(setDoc(doc(alice,'subscribers/alice'),{...data(),cats:['food','korea','law']})); // Older installed clients remain compatible.
    await assertFails(setDoc(doc(alice,'subscribers/alice'),{...data(),quietFrom:24}));
    await assertFails(setDoc(doc(alice,'subscribers/alice'),{...data(),updatedAt:Timestamp.fromMillis(0)}));
    await assertSucceeds(setDoc(doc(alice,'subscribers/alice'),{...data(),testRequested:true,lastTestAt:serverTimestamp()}));
    await assertFails(setDoc(doc(alice,'subscribers/alice'),{...data(),testRequested:true,lastTestAt:serverTimestamp()}));
    await assertFails(getDoc(doc(alice,'meta/pending')));
    await assertFails(getDoc(doc(alice,'notificationJobs/job')));
    await assertFails(setDoc(doc(alice,'meta/feed'),{items:[]}));
    await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),'pushlog/alice'),{ok:true});await setDoc(doc(c.firestore(),'meta/feed'),{items:[]});});
    await assertSucceeds(getDoc(doc(alice,'pushlog/alice')));
    await assertFails(getDoc(doc(bob,'pushlog/alice')));
    await assertSucceeds(getDoc(doc(anon,'meta/feed')));
    const {writeSubscription}=await import('../../public/subscriptions.js');
    const options={fs:client,db:alice,uid:'alice',token:'t'.repeat(120),language:'th',preferences:{cats:['korwar','oil'],enabled:true,level:'high',quietOn:true,quietFrom:22,quietTo:7}};
    const before=(await getDoc(doc(alice,'subscribers/alice'))).data().lastTestAt;
    await assertSucceeds(writeSubscription(options));
    assert.equal((await getDoc(doc(alice,'subscribers/alice'))).data().lastTestAt.toMillis(),before.toMillis());
    const pending=await assertSucceeds(writeSubscription({...options,requestTest:true}));
    assert.equal(pending.testQueued,false);
    assert.equal(pending.testPending,true);
    await env.withSecurityRulesDisabled(async c=>updateDoc(doc(c.firestore(),'subscribers/alice'),{testRequested:false}));
    await assertSucceeds(writeSubscription(options));
    await assertFails(setDoc(doc(alice,'subscribers/alice'),{...data(),testRequested:true,lastTestAt:before}));
    await assertFails(setDoc(doc(alice,'subscribers/alice'),data())); // Cannot erase test history.
    await assertFails(setDoc(doc(bob,'subscribers/alice'),{...data(),lastTestAt:before}));
    await env.withSecurityRulesDisabled(async c=>updateDoc(doc(c.firestore(),'subscribers/alice'),{lastTestAt:Timestamp.fromMillis(Date.now()-6*60000)}));
    const next=await assertSucceeds(writeSubscription({...options,requestTest:true}));
    assert.equal(next.testQueued,true);
    await assertSucceeds(writeSubscription({...options,preferences:{...options.preferences,enabled:false}}));
    assert.equal((await getDoc(doc(alice,'subscribers/alice'))).data().testRequested,false);
    console.log('Firestore rules: authorization, cooldown, and save-after-test lifecycle checks passed');
  } finally {await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1;});
