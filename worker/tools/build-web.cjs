const esbuild=require('esbuild'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'public/vendor/firebase');
(async()=>{
  fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
  await esbuild.build({entryPoints:['firebase-app','firebase-firestore','firebase-auth','firebase-messaging'].map(n=>path.join(__dirname,'sdk',n+'.js')),outdir:out,bundle:true,splitting:true,format:'esm',platform:'browser',minify:true,target:['safari16.4','chrome110'],legalComments:'eof'});
  await esbuild.build({entryPoints:[path.join(__dirname,'sdk/firebase-sw.js')],outfile:path.join(out,'firebase-sw.js'),bundle:true,format:'iife',platform:'browser',minify:true,target:['safari16.4','chrome110'],legalComments:'eof'});
  const shell=['/','/index.html','/app.js','/pull-refresh.js','/feed-data.js','/feed-data.js?v=20261109-feed2','/news-policy.js?v=20261109-feed2','/category-policy.js?v=20261109-feed2','/pull-refresh.js?v=20261109-glass1','/audio.js','/subscriptions.js','/news-text.js','/news-policy.js','/category-policy.js','/settings.css','/liquid-glass.css','/reading-list.js','/share-news.js','/ui-copy.js','/fonts/NotoSansThai-Regular.ttf','/fonts/NotoSansThai-Bold.ttf','/categories.js','/firebase-config.js','/manifest.webmanifest','/icons/icon-192.png','/icons/badge-72.png',...fs.readdirSync(out).map(n=>'/vendor/firebase/'+n)];
  const hash=crypto.createHash('sha256');for(const f of shell.filter(f=>f!=='/'))hash.update(fs.readFileSync(path.join(root,'public',f.split('?')[0])));
  fs.writeFileSync(path.join(root,'public/cache-manifest.js'),'self.KW_CACHE_VERSION='+JSON.stringify(hash.digest('hex').slice(0,16))+';\nself.KW_PRECACHE='+JSON.stringify(shell)+';\n');
  console.log('Bundled Firebase SDK and offline shell ('+shell.length+' files)');
})().catch(e=>{console.error(e);process.exitCode=1});
