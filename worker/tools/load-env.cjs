// Node 24 LTS preload: .env stays outside source control; never print values.
const fs=require('fs'),path=require('path');
const file=path.join(__dirname,'..','.env');
if(fs.existsSync(file)) {
  const parsed=require('node:util').parseEnv(fs.readFileSync(file,'utf8'));
  for(const [key,value] of Object.entries(parsed)) if(process.env[key]===undefined) process.env[key]=value;
}
if(!process.env.FIREBASE_SERVICE_ACCOUNT && process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
  process.env.FIREBASE_SERVICE_ACCOUNT=fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH,'utf8');
}
