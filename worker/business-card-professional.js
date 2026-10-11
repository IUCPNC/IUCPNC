export function enrichCard(c,esc){
 const preview=document.querySelector('#card-preview .business-card');if(!preview)return;
 const heading=preview.querySelector('h2');heading.textContent=[c.academicTitle,c.name,c.professionalTitle].filter(Boolean).join(' ');
 const sections=[];
 if(c.preferredName)sections.push('<p class="professional-known">Known as '+esc(c.preferredName)+'</p>');
 if(c.roles?.length)sections.push('<section class="professional-section"><span class="label">POSITIONS & APPOINTMENTS</span><div class="professional-roles">'+[...c.roles].sort((a,b)=>Number(b.primary===true)-Number(a.primary===true)).map(r=>'<div class="'+(r.primary?'professional-primary':'')+'"><strong>'+esc(r.primary?c.title:r.title)+'</strong><p class="role-department">'+esc(r.primary?c.department:r.department)+'</p><span>'+esc(r.primary?'Primary position':r.type)+(r.expiry?' · until '+esc(r.expiry):'')+'</span></div>').join('')+'</div></section>');
 if(c.qualifications?.length)sections.push('<section class="professional-section"><span class="label">QUALIFICATIONS & CREDENTIALS</span><div class="credential-pills">'+c.qualifications.map(q=>'<span title="'+esc([q.institution,q.field,q.year].filter(Boolean).join(' · '))+'">'+esc(q.qualification)+'</span>').join('')+'</div><div class="credential-details">'+c.qualifications.map(q=>'<p><strong>'+esc(q.qualification)+'</strong><small>'+esc([q.field,q.institution,q.year].filter(Boolean).join(' · '))+'</small></p>').join('')+'</div></section>');
 if(c.biography)sections.push('<section class="professional-section"><span class="label">ABOUT</span><p>'+esc(c.biography)+'</p></section>');
 if(c.expertise)sections.push('<section class="professional-section"><span class="label">EXPERTISE</span><p>'+esc(c.expertise)+'</p></section>');
 if(sections.length){const section=document.createElement('div');section.className='professional-details';section.innerHTML=sections.join('');preview.append(section);}
 const methods=preview.querySelector('.contact-methods');
 if(c.officePhone)methods.insertAdjacentHTML('beforeend','<p><span class="label">OFFICE</span><a href="tel:'+esc(c.officePhone.replace(/[^\d+]/g,''))+'">'+esc(c.officePhone)+'</a></p>');
 if(c.website&&/^https:\/\//i.test(c.website))methods.insertAdjacentHTML('beforeend','<p><a href="'+esc(c.website)+'" target="_blank" rel="noopener">Visit website ↗</a></p>');
 if(c.publicUrl&&!document.querySelector('#copy-card-link')){const b=document.createElement('button');b.id='copy-card-link';b.textContent='Copy card link';b.onclick=async()=>{try{await navigator.clipboard.writeText(c.publicUrl);document.querySelector('#card-status').textContent='Business card link copied.'}catch{document.querySelector('#card-status').textContent=c.publicUrl}};document.querySelector('#card-actions').append(b);}
}
