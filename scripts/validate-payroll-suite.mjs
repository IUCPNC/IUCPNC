import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
const site=process.cwd(),output=path.resolve(site,'../../outputs'),logs=path.resolve(site,'../validation-logs');
await fs.mkdir(output,{recursive:true});await fs.mkdir(logs,{recursive:true});
const tests=(await fs.readdir('scripts')).filter(f=>/^test-.*\.mjs$/.test(f)).sort(),results=[];let index=0;
await Promise.all(Array.from({length:3},async()=>{for(;;){const n=index++;if(n>=tests.length)return;const file=tests[n],started=Date.now(),r=await new Promise(resolve=>execFile(process.execPath,['scripts/'+file],{cwd:site,timeout:90000,maxBuffer:2*1024*1024,env:process.env},(error,stdout,stderr)=>resolve({file,passed:!error,exitCode:error?.code||0,durationMs:Date.now()-started,stdout,stderr})));await fs.writeFile(path.join(logs,file+'.log'),r.stdout+r.stderr);results.push({...r,stdout:undefined,stderr:undefined,summary:r.passed?r.stdout.trim().split('\n').at(-1):r.stderr.slice(-1400)});if(!r.passed)console.log(JSON.stringify({failed:file,detail:r.stderr.slice(-1000)}));}}));
results.sort((a,b)=>a.file.localeCompare(b.file));await fs.writeFile(path.join(output,'NADI-Payroll-validation.json'),JSON.stringify({generatedAt:new Date().toISOString(),environment:'Local synthetic fixtures; no live payroll or bank activity',total:results.length,passed:results.filter(r=>r.passed).length,results},null,2));
console.log(JSON.stringify({total:results.length,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).map(r=>r.file)}));if(results.some(r=>!r.passed))process.exitCode=1;
