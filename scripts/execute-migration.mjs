import fs from 'node:fs';
import readline from 'node:readline';
process.stdin.setRawMode?.(true);process.stdin.resume();console.log('Ready for private migration credentials on stdin (input hidden).');
let line='';const credentials=await new Promise(resolve=>process.stdin.on('data',chunk=>{line+=chunk.toString();if((line.includes('\n')||line.includes('\r'))){process.stdin.setRawMode?.(false);process.stdin.pause();resolve(JSON.parse(line.trim()));}}));
const records=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const results=[];let next=0,failed=false;
async function worker(){while(next<records.employees.length&&!failed){const employee=records.employees[next++];
 const response=await fetch('https://iuc-nadi-mpc-hr.iuc-people-a-4289.chatgpt.site/api/migration/employee',{method:'POST',headers:{'content-type':'application/json','OAI-Sites-Authorization':'Bearer '+credentials.serviceToken,'x-migration-key':credentials.migrationKey},body:JSON.stringify(employee),signal:AbortSignal.timeout(60000)});
 const data=await response.json();results.push({employeeId:employee.employeeId,status:response.status,...data});
 fs.writeFileSync(process.argv[3],JSON.stringify(results));
 if(!response.ok){failed=true;console.log(JSON.stringify({stopped:true,employeeId:employee.employeeId,status:response.status,error:data.error}));break;}
 if(results.length%10===0)console.log(JSON.stringify({imported:results.length,total:records.employees.length}));
}}
await Promise.all(Array.from({length:4},()=>worker()));
fs.writeFileSync(process.argv[3],JSON.stringify(results));console.log(JSON.stringify({processed:results.length,succeeded:results.filter(r=>r.status===200).length,sections:results.reduce((n,r)=>n+(r.importedSections||0),0),documentsPending:results.reduce((n,r)=>n+(r.retainedDocuments||0),0)}));

