const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function harness({installed=[],override,broken=[],installStatus=0}={}) {
  const calls={launched:[],installed:[],published:[]},environment={GITHUB_ENV:'/test/github-env',...(override?{AGENT_CHROMIUM:override}:{})};
  const modules={
    'node:fs':{existsSync:file=>installed.includes(file),appendFileSync:(file,value)=>calls.published.push({file,value})},
    'node:path':path,
    'node:child_process':{spawnSync:(command,args,options)=>{calls.installed.push({command,args,options});return {status:installStatus}}},
    playwright:{chromium:{executablePath:()=>'/cached/chromium',launch:async options=>{
      calls.launched.push(options.executablePath);if(broken.includes(options.executablePath))throw Error('Browser cannot start');
      return {newPage:async()=>({setContent:async()=>{},textContent:async()=> 'Browser ready'}),version:()=> 'test',close:async()=>{}};
    }}}
  };
  const mockRequire=name=>modules[name];mockRequire.resolve=()=>'/package/playwright/package.json';
  const context={module:{exports:{}},require:mockRequire,process:{env:environment,execPath:'/node'},console:{log(){},warn(){}}};
  vm.runInNewContext(fs.readFileSync(require.resolve('./prepare-browser.cjs'),'utf8'),context);
  return {calls,prepare:context.module.exports.prepareBrowser};
}
test('CI verifies installed Chrome and exports its path without downloading another browser',async()=>{
  const h=harness({installed:['/usr/bin/google-chrome']});assert.equal(await h.prepare(),'/usr/bin/google-chrome');
  assert.equal(h.calls.installed.length,0);assert.equal(h.calls.published[0].value,'AGENT_CHROMIUM=/usr/bin/google-chrome\n');
});
test('an explicit unusable browser fails without publishing a path or hiding the override',async()=>{
  const h=harness({override:'/custom/browser',broken:['/custom/browser']});await assert.rejects(h.prepare(),/cannot start/);
  assert.equal(h.calls.installed.length,0);assert.equal(h.calls.published.length,0);
});
test('a missing browser falls back to the package CLI and verifies the installed binary',async()=>{
  const h=harness();assert.equal(await h.prepare(),'/cached/chromium');assert.equal(h.calls.installed.length,1);
  assert.deepEqual(Array.from(h.calls.installed[0].args),['/package/playwright/cli.js','install','--with-deps','chromium']);
  assert.equal(h.calls.installed[0].options.timeout,180000);assert.equal(h.calls.published.length,1);
});
test('failed browser installation fails the check and cannot publish a successful environment',async()=>{
  const h=harness({installStatus:1});await assert.rejects(h.prepare(),/installation failed/);
  assert.equal(h.calls.launched.length,0);assert.equal(h.calls.published.length,0);
});
test('a broken system browser can use a verified cached Playwright binary',async()=>{
  const h=harness({installed:['/usr/bin/google-chrome','/cached/chromium'],broken:['/usr/bin/google-chrome']});
  assert.equal(await h.prepare(),'/cached/chromium');assert.equal(h.calls.installed.length,0);assert.equal(h.calls.published.length,1);
});
