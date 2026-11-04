const fs=require('fs');
const assert=require('node:assert/strict');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,serverTimestamp,Timestamp}=require('firebase/firestore');
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
    await assertFails(setDoc(doc(alice,'subscribers/alice'),{...data(),cats:['unknown']}));
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
    console.log('Firestore rules: 16 authorization/validation checks passed');
  } finally {await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1;});
