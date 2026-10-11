// Local synthetic-data preview; this server never connects to production.
import http from 'node:http';
import fs from 'node:fs';
import {fixture,hr,employee} from './test-profiles.mjs';
import {leaveRoute} from '../worker/leave-api.js';
const f=fixture();f.env.PC_EMAILS=hr.email;const types={'.css':'text/css','.js':'application/javascript','.html':'text/html','.png':'image/png'};
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1:5183');if(url.pathname.startsWith('/api/leave/')){const chunks=[];for await(const b of req)chunks.push(b);const who=url.searchParams.get('testEmployee')==='1'?employee:hr,response=await leaveRoute(new Request(url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})}),f.env,{user:who,isPc:(_,email)=>email===hr.email});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;}const file=['/leave.js','/leave-files.js','/leave.css'].includes(url.pathname)?'worker'+url.pathname:url.pathname==='/iuc-logo.png'?'public/mpc/assets/iuc-logo.png':'worker/leave.html';const ext=file.slice(file.lastIndexOf('.'));res.writeHead(200,{'content-type':types[ext]||'text/html'});res.end(fs.readFileSync(file));}catch(e){res.writeHead(500);res.end('Local preview error: '+e.message);}});
server.listen(5183,'127.0.0.1',()=>console.log('Synthetic leave preview: http://127.0.0.1:5183/admin/leave'));
