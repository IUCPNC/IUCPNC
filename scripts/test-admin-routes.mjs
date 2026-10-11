import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import {fixture,hr,employee} from './test-profiles.mjs';
const {env,sqlite}=fixture();env.PC_EMAILS=hr.email;
const call=(path,user)=>worker.fetch(new Request('https://portal.test'+path,{headers:user?{'oai-authenticated-user-id':user.userId,'oai-authenticated-user-email':user.email}:{}}),env,{});
for(const suffix of ['', '/profiles','/master-database','/management-access','/sync','/talent']){
 const old=await call('/people-culture'+suffix+'?employeeId=TEST-001',hr);assert.equal(old.status,307);assert.equal(old.headers.get('location'),'https://portal.test/admin'+suffix+'?employeeId=TEST-001');
 assert.equal((await call('/admin'+suffix,hr)).status,200);
 assert.equal((await call('/admin'+suffix,employee)).status,403);
 const anonymous=await call('/admin'+suffix);assert.equal(anonymous.status,302);assert.ok(anonymous.headers.get('location').includes(encodeURIComponent('/admin'+suffix)));
}
assert.equal((await call('/employee',employee)).status,200);
assert.equal((await call('/employee/profile',employee)).status,200);
assert.equal((await call('/api/people-culture/sync',employee)).status,403);
assert.equal((await call('/api/people-culture/sync',hr)).status,200);
assert.equal((await call('/',hr)).status,200);
assert.equal((await call('/',employee)).status,200);
assert.match(await(await call('/profile.js',hr)).text(),/startsWith\('\/admin'\)/);
assert.equal((await call('/profile.js')).status,200); // Code-only UI asset; profile API remains authenticated.
assert.ok(!(await(await call('/admin',hr)).text()).includes('href="/people-culture'));
sqlite.close();console.log('Admin routes passed: access control, redirects with query strings, sign-in return URLs, employee routes and API compatibility.');
