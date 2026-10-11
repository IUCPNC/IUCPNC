import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker from '../dist/server/index.js';
import {fixture,hr,employee} from './test-profiles.mjs';
import {POLICIES} from '../dist/server/policy-assets.js';
const {env,sqlite}=fixture();env.PC_EMAILS=hr.email;let objects=new Map();env.PROFILE_FILES={put:async(k,b)=>objects.set(k,b),get:async k=>objects.has(k)?{body:objects.get(k)}:null};
const call=(path,user,method='GET',body,headers={})=>worker.fetch(new Request('https://worker.test'+path,{method,headers:{...(user?{'oai-authenticated-user-id':user.userId,'oai-authenticated-user-email':user.email}:{}),...headers},...(body?{body}:{})}),env,{waitUntil(){}});
for(const path of ['/policies','/policies/catalog','/policies/files/handbook'])assert.equal((await call(path,null)).status,302);
assert.equal((await call('/policies/catalog',{userId:'unknown',email:'unknown@example.test'})).status,403);
assert.equal((await call('/policies',employee)).status,200);
const page=await(await call('/policies',hr)).text();assert.match(page,/Management approval confirmed by P&amp;C/);assert.equal(POLICIES.filter(p=>p.status==='Approved').length,3);assert.match(page,/192/);assert.equal((await(await call('/policies/catalog',hr)).json()).length,4);
assert.equal((await call('/api/policies/upload/handbook',null,'PUT','x')).status,403);
env.POLICY_UPLOAD_KEY='test-key-for-policy-upload-at-least-32-characters';env.POLICY_UPLOAD_EXPIRES=new Date(Date.now()+3600000).toISOString();
assert.equal((await call('/api/policies/upload/handbook',null,'PUT','x',{'x-policy-upload-key':env.POLICY_UPLOAD_KEY})).status,400);
for(const p of POLICIES){const bytes=fs.readFileSync('C:/Users/ravogue/Downloads/'+p.filename),result=await call('/api/policies/upload/'+p.id,null,'PUT',bytes,{'x-policy-upload-key':env.POLICY_UPLOAD_KEY});assert.equal(result.status,200,await result.clone().text());const download=await call('/policies/files/'+p.id+'?download=1',employee);assert.equal(download.status,200);assert.equal(download.headers.get('x-policy-sha256'),p.sha256);assert.deepEqual(Buffer.from(await download.arrayBuffer()),bytes);}
env.POLICY_UPLOAD_EXPIRES='2020-01-01';assert.equal((await call('/api/policies/upload/handbook',null,'PUT','x',{'x-policy-upload-key':env.POLICY_UPLOAD_KEY})).status,403);
sqlite.close();console.log('Policy checks passed: authentication, active-employee access, private downloads, 4 original PDF hashes, approval labels, upload expiry and source validation.');
