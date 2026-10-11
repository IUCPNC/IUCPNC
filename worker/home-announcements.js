const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
export async function announcementRoute(request,env,user,isPc){
 const path=new URL(request.url).pathname;if(!path.startsWith('/api/home/announcements'))return null;
 if(!user)return json({error:'Sign in is required.'},401);if(!isPc(env,user.email))return json({error:'P&C access is required to publish or archive announcements.'},403);
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Request origin is not allowed.'},403);
 if(request.method==='POST'&&path==='/api/home/announcements'){
 if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'Use a JSON request.'},415);
 const raw=await request.text();if(raw.length>12000)return json({error:'Announcement is too long.'},413);let data;try{data=JSON.parse(raw)}catch{return json({error:'Invalid announcement.'},400)};
 if(!data||typeof data!=='object'||Array.isArray(data))return json({error:'Invalid announcement.'},400);
 const title=typeof data.title==='string'?data.title.trim():'',body=typeof data.body==='string'?data.body.trim():'',category=data.category||'University update';
 if(!title||title.length>120||!body||body.length>4000||!['University update','People & Culture','Learning & development','Reminder'].includes(category))return json({error:'Enter a title (up to 120 characters), message (up to 4,000 characters) and a valid category.'},400);
 const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO nadi_announcements (id,title,body,category,published_at,published_by) VALUES (?,?,?,?,?,?)').bind(id,title,body,category,new Date().toISOString(),user.email).run();return json({id,status:'published'},201);
 }
 const match=path.match(/^\/api\/home\/announcements\/([a-zA-Z0-9-]+)$/);if(request.method==='PATCH'&&match){const row=await env.DB.prepare('SELECT id FROM nadi_announcements WHERE id=?').bind(match[1]).first();if(!row)return json({error:'Announcement not found.'},404);await env.DB.prepare('UPDATE nadi_announcements SET archived_at=COALESCE(archived_at,?),archived_by=COALESCE(archived_by,?) WHERE id=?').bind(new Date().toISOString(),user.email,match[1]).run();return json({status:'archived'})}
 return json({error:'Method not allowed.'},405);
}
