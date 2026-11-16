const {initializeApp,cert}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
async function main() {
  const raw=process.env.FIREBASE_SERVICE_ACCOUNT;
  if(raw){let account;try{account=JSON.parse(raw)}catch{throw Error('Invalid Admin credential configuration')}initializeApp({credential:cert(account)})}
  else initializeApp(); // Application Default Credentials are also supported.
  await require('../lib/storage').migrate(getFirestore());
  console.log('Feed day migration complete');
}
main().catch(error=>{console.error(error.code||'Migration failed');process.exitCode=1});
