const {spawnSync}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path');
const out=path.resolve(__dirname,'../agent-out');fs.mkdirSync(out,{recursive:true});
const suites=process.argv.includes('--navigation-only')?['navigation-ui.cjs']:process.argv.includes('--first-paint-only')?['first-paint-ui.cjs']:['settings-ui.cjs','navigation-ui.cjs','first-paint-ui.cjs'];
for(const suite of suites) {
  for(let run=1;run<=10;run++) {
    const file=path.join(out,`${suite}-${run}.log`),fd=fs.openSync(file,'w');
    const result=spawnSync(process.execPath,[path.join(__dirname,suite)],{stdio:['ignore',fd,fd],env:process.env});fs.closeSync(fd);
    if(result.status!==0){console.error(`${suite} run ${run} FAILED: ${file}`);process.exit(result.status||1)}
    console.log(`${suite} ${run}/10 passed`);
  }
}
