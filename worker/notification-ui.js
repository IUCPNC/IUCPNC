(()=>{
 const trigger=document.querySelector('[data-nadi-notifications]');if(!trigger)return;
 const panel=document.getElementById('nadi-notification-panel'),list=document.getElementById('nadi-notification-list'),count=document.getElementById('notification-count'),status=document.getElementById('nadi-notification-status'),toast=document.getElementById('nadi-notification-toast');
 let records=[],busy=false,seen=new Set(),initial=true,timer,toastTimer;
 const safe=link=>typeof link==='string'&&/^\/(?!\/)/.test(link)&&!/[\\\r\n]/.test(link)?link:'/?open=notifications';
 const close=()=>{panel.close();trigger.setAttribute('aria-expanded','false')};
 function paint(){
  const unread=records.filter(n=>!n.read_at);count.textContent=unread.length;count.hidden=!unread.length;trigger.setAttribute('aria-label','Notifications'+(unread.length?', '+unread.length+' unread':''));list.replaceChildren();
  if(!records.length){const p=document.createElement('p');p.className='nadi-notice-empty';p.textContent='You’re all caught up. New work and community updates will appear here.';list.append(p)}
  records.forEach(n=>{const article=document.createElement('article'),tag=document.createElement('span'),a=document.createElement('a'),time=document.createElement('time');article.className='nadi-notice'+(!n.read_at?' is-unread':'');tag.textContent=n.kind;a.textContent=n.message;a.href=safe(n.link);a.addEventListener('click',()=>{void mark([n.id])});time.textContent=new Date(n.created_at).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});article.append(tag,a,time);if(!n.read_at){const b=document.createElement('button');b.textContent='Mark read';b.onclick=()=>mark([n.id]);article.append(b)}list.append(article)});
  document.getElementById('nadi-notification-read').disabled=!unread.length;
 }
 function popup(items){
  if(!items.length||panel.open)return;clearTimeout(toastTimer);toast.querySelector('strong').textContent=items.length===1?'New notification: '+items[0].kind:items.length+' unread updates';toast.querySelector('p').textContent='Open your Nadi inbox to see what needs your attention.';toast.hidden=false;toastTimer=setTimeout(()=>toast.hidden=true,9000);
 }
 async function refresh(){
  if(busy)return;busy=true;try{const r=await fetch('/api/notifications',{cache:'no-store'});if([401,403].includes(r.status)){clearInterval(timer);toast.hidden=true;return}if(!r.ok)throw Error();const d=await r.json();records=d.notifications;const fresh=records.filter(n=>!n.read_at&&!seen.has(n.id));
   // Session storage avoids repeating the same alert across pages; no message bodies are stored.
   if(initial){try{seen=new Set(JSON.parse(sessionStorage.getItem('nadi-notifications-seen')||'[]'));}catch{}initial=false}
   const unseen=fresh.filter(n=>!seen.has(n.id));records.forEach(n=>seen.add(n.id));try{sessionStorage.setItem('nadi-notifications-seen',JSON.stringify([...seen].slice(-300)))}catch{}
   paint();status.textContent=d.emailReady?'Nadi alerts are on. Email delivery is connected.':'Nadi alerts are on. Email delivery is waiting for the P&C sender.';popup(unseen);
  }catch{status.textContent='Unable to refresh notifications. Try again shortly.'}finally{busy=false}
 }
 async function mark(ids){try{const r=await fetch('/api/notifications',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({ids})});if(!r.ok)throw Error();records=records.map(n=>ids.includes(n.id)?{...n,read_at:new Date().toISOString()}:n);paint();}catch{status.textContent='Could not mark the update as read. Please retry.'}}
 const open=()=>{toast.hidden=true;panel.showModal();trigger.setAttribute('aria-expanded','true');void refresh()};
 trigger.addEventListener('click',open);document.getElementById('nadi-notification-close').onclick=close;panel.addEventListener('close',()=>trigger.setAttribute('aria-expanded','false'));panel.addEventListener('click',e=>{if(e.target===panel){const r=panel.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close()}});
 document.getElementById('nadi-notification-refresh').onclick=()=>{status.textContent='Refreshing…';void refresh()};document.getElementById('nadi-notification-read').onclick=()=>mark(records.filter(n=>!n.read_at).map(n=>n.id));
 toast.querySelector('[data-notice-open]').onclick=open;toast.querySelector('[data-notice-dismiss]').onclick=()=>toast.hidden=true;
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh()});timer=setInterval(()=>{if(!document.hidden)void refresh()},60000);void refresh();
 if(new URL(location.href).searchParams.get('open')==='notifications')open();
})();
