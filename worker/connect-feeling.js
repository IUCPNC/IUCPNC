import {day,fail,guardedAudit,MOODS,needEmployee,now,option,post,q,str} from './connect-core.js';

// Named community updates never read or write anonymous pulse responses.
export async function sharedFeeling(db,ctx){
  const employeeId=ctx.employee?.employee_id;
  if(!employeeId)return null;
  const p=await q(db,"SELECT id,body,version,metadata_json FROM connect_posts WHERE author_id=? AND kind='feeling' AND status='visible' AND json_extract(metadata_json,'$.day')=? ORDER BY created_at DESC LIMIT 1",employeeId,day()).first();
  if(!p)return null;
  const meta=JSON.parse(p.metadata_json);
  return {postId:p.id,mood:meta.mood,message:p.body,version:p.version,day:meta.day};
}

export async function shareFeeling(db,ctx,b){
  const author=needEmployee(ctx);
  if(Object.keys(b).some(k=>!['mood','message','shareWithColleagues','postId','version'].includes(k)))throw fail('Use only the feeling and message fields. Your identity comes from your signed-in account.');
  if(b.shareWithColleagues!==true)throw fail('Confirm that this update will be visible to IUC colleagues.');
  const mood=option(b.mood,MOODS,'feeling'),message=str(b.message,800,'optional message'),today=day(),meta=JSON.stringify({mood,day:today}),operation=crypto.randomUUID();
  let id,result,updated=false;
  if(b.postId){
    const p=await post(db,ctx,str(b.postId,100,'post',true));
    if(p.author_id!==author)throw fail('Only the employee who shared this feeling can update it.',403);
    if(p.kind!=='feeling'||JSON.parse(p.metadata_json).day!==today)throw fail('Only today’s feeling can be updated.',409);
    if(!Number.isInteger(b.version)||b.version!==p.version)throw fail('Refresh your feeling before updating it.',409);
    id=p.id;updated=true;
    result=await db.batch([
      q(db,"UPDATE connect_posts SET body=?,metadata_json=?,version=version+1,operation=? WHERE id=? AND author_id=? AND kind='feeling' AND status='visible' AND version=? AND json_extract(metadata_json,'$.day')=?",message,meta,operation,id,author,p.version,today),
      guardedAudit(db,ctx,'feeling_updated',id,{},'connect_posts',operation)
    ]);
  }else{
    id=crypto.randomUUID();
    result=await db.batch([
      q(db,"INSERT INTO connect_posts (id,author_id,kind,body,visibility,metadata_json,operation,created_at) SELECT ?,?,'feeling',?,'Everyone',?,?,? WHERE NOT EXISTS (SELECT 1 FROM connect_posts WHERE author_id=? AND kind='feeling' AND status='visible' AND json_extract(metadata_json,'$.day')=?)",id,author,message,meta,operation,now(),author,today),
      guardedAudit(db,ctx,'feeling_shared',id,{},'connect_posts',operation)
    ]);
  }
  if(!result[0].meta?.changes)throw fail('Today’s feeling has changed or was already shared. Refresh to see it.',409);
  return {id,status:updated?'updated':'shared',updated};
}
