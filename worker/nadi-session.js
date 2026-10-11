document.addEventListener('click',async e=>{const button=e.target.closest('[data-nadi-signout]');if(!button)return;e.preventDefault();button.disabled=true;try{const response=await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:'{}'});const data=await response.json();if(!response.ok)throw Error(data.error);location.assign(data.redirect);}catch{button.disabled=false;location.assign('/logout');}});

// Shared navigation behaviour for every authenticated workspace.
const portalNav=document.querySelector('.portal-nav');
const portalToggle=portalNav?.querySelector('.portal-menu-toggle');
function closePortalMenus(restoreFocus=false){
 const opened=portalNav?.querySelector('details[open]');
 if(restoreFocus){if(portalNav?.dataset.expanded==='true')portalToggle?.focus();else opened?.querySelector('summary')?.focus();}
 portalNav?.querySelectorAll('details[open]').forEach(d=>d.open=false);
 if(portalNav)portalNav.dataset.expanded='false';
 portalToggle?.setAttribute('aria-expanded','false');
}
portalToggle?.addEventListener('click',()=>{const open=portalNav.dataset.expanded!=='true';portalNav.dataset.expanded=String(open);portalToggle.setAttribute('aria-expanded',String(open));if(!open)portalNav.querySelectorAll('details').forEach(d=>d.open=false);});
document.addEventListener('click',e=>{if(!portalNav)return;if(!portalNav.contains(e.target)||e.target.closest('.portal-nav a'))closePortalMenus();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&portalNav&&(portalNav.querySelector('details[open]')||portalNav.dataset.expanded==='true')){closePortalMenus(true);e.preventDefault();}});
portalNav?.querySelectorAll('details').forEach(detail=>detail.addEventListener('toggle',()=>{if(detail.open)portalNav.querySelectorAll('details').forEach(other=>{if(other!==detail)other.open=false;});}));
window.matchMedia('(max-width:1100px)').addEventListener('change',()=>closePortalMenus());

document.addEventListener('click',e=>document.querySelectorAll('.position-menu[open]').forEach(menu=>{if(!menu.contains(e.target))menu.open=false;}));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){const menu=document.querySelector('.position-menu[open]');if(menu){menu.open=false;menu.querySelector('summary')?.focus();}}});
