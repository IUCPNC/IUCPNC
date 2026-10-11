import assert from 'node:assert/strict';
import {fixture,employee} from './test-profiles.mjs';
import {attendanceRoute} from '../worker/attendance-api.js';
const {env,sqlite}=fixture(),original=env.DB.prepare.bind(env.DB),batch=env.DB.batch.bind(env.DB);
let release,arrivals=0,serial=Promise.resolve();const gate=new Promise(resolve=>release=resolve);
env.DB.prepare=sql=>{const query=original(sql);if(sql==='SELECT * FROM attendance_sessions WHERE employee_id=? AND clock_out IS NULL'){const first=query.first.bind(query);query.first=async()=>{const value=await first();arrivals++;if(arrivals===2)release();await gate;return value}}return query};
env.DB.batch=statements=>{const operation=serial.then(()=>batch(statements));serial=operation.catch(()=>{});return operation};
const request=()=>attendanceRoute(new Request('https://race.test/api/attendance/clock',{method:'POST',headers:{origin:'https://race.test','content-type':'application/json','idempotency-key':crypto.randomUUID()},body:JSON.stringify({action:'clockIn',context:'Office',deviceId:'race-device-0000001',location:{status:'unavailable'}})}),env,{user:employee,isPc:()=>false});
const responses=await Promise.all([request(),request()]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM attendance_sessions WHERE clock_out IS NULL').get().n,1);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM attendance_events').get().n,1);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM idempotency_keys').get().n,1);assert.equal(sqlite.prepare('PRAGMA foreign_key_check').all().length,0);sqlite.close();console.log('Concurrent clock-in: one committed session, one safe conflict, no partial events or request receipts.');
