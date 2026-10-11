import assert from 'node:assert/strict';
import {SheetsClient} from '../worker/sheets-client.js';
const nativeFetch=globalThis.fetch;
let calls=0;
try{
 globalThis.fetch=async function(url,options){
  assert.equal(this,globalThis,'Cloudflare fetch must receive the global object');
  assert.equal(new URL(url).hostname,'sheets.googleapis.com');
  assert.equal(options.headers.Authorization,'Bearer synthetic-test-token');
  calls++;return Response.json({ok:true});
 };
 assert.deepEqual(await new SheetsClient('synthetic-test-token').api(),{ok:true});
 assert.equal(calls,1);
 console.log('Default Google fetch preserves its Cloudflare receiver.');
}finally{globalThis.fetch=nativeFetch;}
