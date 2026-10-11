import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import {fixture,hr,employee} from './test-profiles.mjs';
const {env,sqlite}=fixture();env.PC_EMAILS=hr.email;
const call=(path,user)=>worker.fetch(new Request('https://portal.test'+path,{headers:user?{'oai-authenticated-user-id':user.userId,'oai-authenticated-user-email':user.email}:{}}),env,{});
assert.equal((await call('/culture',null)).status,302);
assert.equal((await call('/culture',{email:'unknown@example.test',userId:'unknown'})).status,403);
for(const user of [hr,employee]){const r=await call('/culture',user);assert.equal(r.status,200);assert.match(r.headers.get('content-security-policy'),/frame-src https:\/\/www.youtube-nocookie.com/);const h=await r.text();assert.ok(h.includes('3T2wdtrOfeE'));assert.ok(h.includes('lang="ms"'));assert.ok(!h.includes('sites.google.com'));}
const home=await call('/',employee);assert.ok(!(home.headers.get('content-security-policy').includes('youtube')));assert.ok((await home.text()).includes('href="/culture"'));
sqlite.exec("UPDATE employees SET active=0 WHERE employee_id='TEST-001'");assert.equal((await call('/culture',employee)).status,403);sqlite.close();console.log('Culture checks passed: staff access, inactive denial, homepage link and page-scoped video policy.');
