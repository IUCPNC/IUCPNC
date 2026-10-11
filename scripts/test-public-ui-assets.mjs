import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import {fixture,hr} from './test-profiles.mjs';
const {env,sqlite}=fixture();env.PC_EMAILS=hr.email;
const call=path=>worker.fetch(new Request('https://portal.test'+path),env,{});let checks=0;
for(const path of ['/home.js','/sheets-sync.js','/home.css','/academic.js','/payroll.js','/profile.js','/connect.js','/mpc/app.js']){
 const r=await call(path);assert.equal(r.status,200);assert.ok(r.headers.get('content-type').includes(path.endsWith('.css')?'text/css':'javascript'));assert.ok(!(await r.text()).includes('<html'));checks+=3;
}
for(const path of ['/','/admin/sync','/employee/profile','/admin/payroll']){assert.equal((await call(path)).status,302);checks++;}
for(const path of ['/api/home/priorities','/api/profiles/me','/api/people-culture/sync','/api/academic/overview','/api/payroll/overview','/api/profiles/TEST-001/documents/private.js']){assert.equal((await call(path)).status,401);checks++;}
for(const path of ['/unknown.js','/private.css']){assert.equal((await call(path)).status,302);checks++;}
sqlite.close();console.log(JSON.stringify({passed:true,checks,coverage:'Exact public code-only resources; authenticated HTML, private APIs, documents and unknown extensions remain protected'}));
