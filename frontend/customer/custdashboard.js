(function(){
  'use strict';

  // ===== ROUTE GUARD (admin only) =====
  if (typeof getToken !== 'function' || !getToken()) { window.location.href='custlogin.html'; return; }
  if (typeof isAdmin !== 'function' || !isAdmin()) { window.location.href='../user/userportal.html'; return; }

  (function(){ const nm=(typeof getName==='function')?getName():''; const el=document.querySelector('.tb-right .tb-name'); if(nm&&el) el.textContent=nm; })();
  (function(){ const b=document.querySelector('.tb-logout'); if(b) b.addEventListener('click',function(){ if(typeof clearAuth==='function') clearAuth(); window.location.href='custlogin.html'; }); })();

  const money=n=>'R'+(n||0).toLocaleString('en-ZA');
  const RATE=250, REG=100;

  // ---- data ----
  let STUDENTS=[];   // [{id,name,grade,...,enrolments:[...], payment_count, pending_count, approved_count}]

  async function loadData(){
    try{
      const res=await apiFetch('/admin/students',{method:'GET'});
      if(!res.ok){ STUDENTS=[]; render(); return; }
      STUDENTS=await res.json();
      render();
    }catch(err){ STUDENTS=[]; render(); }
  }

  function enrTotal(e){
    if(e.package_type==='oneonone'){
      return (e.subject_lines||[]).reduce((s,l)=>s+l.hours*RATE,0);
    }
    return e.monthly_fee||0;
  }
  function fmtDateTime(iso){
    if(!iso) return '—';
    const d=new Date(iso); if(isNaN(d)) return iso;
    return d.toLocaleDateString('en-ZA',{day:'2-digit',month:'short',year:'numeric'})+' · '+
           d.toLocaleTimeString('en-ZA',{hour:'2-digit',minute:'2-digit'});
  }
  function subjectsText(e){
    return (e.subject_lines||[]).map(l => e.package_type==='oneonone' ? (l.subject_name+' ('+l.hours+'h)') : l.subject_name).join(', ');
  }
  function pmtBadge(status){
    if(status==='approved') return '<span class="badge approved"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Approved</span>';
    if(status==='pending')  return '<span class="badge pending"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg> Pending</span>';
    if(status==='rejected') return '<span class="badge noproof"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Rejected</span>';
    return '<span class="badge noproof">No proof</span>';
  }

  const tblBody=document.getElementById('tblBody');
  const cardsList=document.getElementById('cardsList');
  const tblEmpty=document.getElementById('tblEmpty');
  const gradeSelect=document.getElementById('gradeSelect');
  const searchInput=document.getElementById('searchInput');

  function currentList(){
    const g=gradeSelect.value, q=searchInput.value.trim().toLowerCase();
    return STUDENTS.filter(s=>{
      if(g!=='all' && String(s.grade)!==g) return false;
      if(q && !((s.name||'').toLowerCase().includes(q)||(s.guardian_name||'').toLowerCase().includes(q))) return false;
      return true;
    });
  }

  const USERICON='<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>';

  function render(){
    const list=currentList();
    // stats: students total, pending payments (across all), approved payments, approved revenue
    const allEnr=STUDENTS.flatMap(s=>s.enrolments||[]);
    document.getElementById('stTotal').textContent=STUDENTS.length;
    document.getElementById('stPending').textContent=allEnr.filter(e=>e.status==='pending').length;
    document.getElementById('stApproved').textContent=allEnr.filter(e=>e.status==='approved').length;
    document.getElementById('stRevenue').textContent=money(
      allEnr.filter(e=>e.status==='approved').reduce((s,e)=>s+enrTotal(e)+(e.registration_fee||0),0)
    );
    document.getElementById('rcNum').textContent=list.length;

    tblBody.innerHTML=''; cardsList.innerHTML='';
    if(!list.length){ tblEmpty.style.display='block'; return; }
    tblEmpty.style.display='none';

    list.forEach(s=>{
      const idx=STUDENTS.indexOf(s);
      const rollup=(s.payment_count||0)+' payment'+(s.payment_count===1?'':'s')+' · '+(s.pending_count||0)+' pending';
      // table row
      const tr=document.createElement('tr');
      tr.innerHTML=
        '<td><div class="cell-name"><span class="cell-avatar">'+USERICON+'</span>'+
          '<div class="info"><div class="nm">'+(s.name||s.email)+'</div><div class="sub">Guardian: '+(s.guardian_name||'—')+'</div></div></div></td>'+
        '<td>Grade '+(s.grade||'—')+'</td>'+
        '<td><span class="pkg-tag">'+rollup+'</span></td>'+
        '<td>'+( s.pending_count>0 ? pmtBadge('pending') : (s.approved_count>0 ? pmtBadge('approved') : pmtBadge('noproof')) )+'</td>'+
        '<td style="text-align:right"><button class="btn-view" data-i="'+idx+'"><svg viewBox="0 0 24 24"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg> <span>View</span></button></td>';
      tblBody.appendChild(tr);
      // mobile card
      const card=document.createElement('div'); card.className='rc';
      card.innerHTML=
        '<div class="rc-top"><span class="cell-avatar">'+USERICON+'</span>'+
          '<div class="info"><div class="nm">'+(s.name||s.email)+'</div><div class="sub">Grade '+(s.grade||'—')+' · Guardian: '+(s.guardian_name||'—')+'</div></div></div>'+
        '<div class="rc-meta"><span class="pkg-tag">'+rollup+'</span>'+( s.pending_count>0 ? pmtBadge('pending') : (s.approved_count>0 ? pmtBadge('approved') : pmtBadge('noproof')) )+'</div>'+
        '<button class="btn-view" data-i="'+idx+'"><svg viewBox="0 0 24 24"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg> <span>View details</span></button>';
      cardsList.appendChild(card);
    });

    document.querySelectorAll('.btn-view').forEach(b=>b.addEventListener('click',()=>openStudent(parseInt(b.dataset.i,10))));
  }

  // ===== STUDENT PROFILE MODAL =====
  const overlay=document.getElementById('modalOverlay');
  let currentStudentIdx=null;

  function ci(l,v){ return '<div class="contact-item"><div class="ci-lbl">'+l+'</div><div class="ci-val">'+(v||'—')+'</div></div>'; }

  function openStudent(i){
    currentStudentIdx=i;
    const s=STUDENTS[i];
    document.getElementById('mAvatar').innerHTML=USERICON;
    document.getElementById('mName').textContent=s.name||s.email;
    document.getElementById('mSub').textContent='Grade '+(s.grade||'—')+' · '+(s.payment_count||0)+' payment'+(s.payment_count===1?'':'s');

    // contact / profile
    document.getElementById('mContact').innerHTML=
      ci('Date of birth', s.date_of_birth)+ci('Learner WhatsApp', s.whatsapp)+ci('Learner email', s.email)+
      ci('School', s.school)+ci('Province', s.province)+
      ci('Guardian', s.guardian_name)+ci('Guardian WhatsApp', s.guardian_whatsapp)+ci('Guardian email', s.guardian_email);

    // payments list
    renderPayments(s);

    overlay.classList.add('open');
    document.body.style.overflow='hidden';
  }

  function renderPayments(s){
    const wrap=document.getElementById('mPayments');
    const enrs=s.enrolments||[];
    if(!enrs.length){ wrap.innerHTML='<div class="pay-empty">No payments submitted yet.</div>'; return; }
    wrap.innerHTML='';
    enrs.forEach(e=>{
      const monthly=enrTotal(e);
      const reg=e.registration_fee||0;
      const grand=monthly+reg;
      // build receipt-style lines
      let lines='';
      if(e.package_type==='oneonone'){
        (e.subject_lines||[]).forEach(l=>{
          lines+='<div class="pay-line"><span>'+l.subject_name+' <em>'+l.hours+'h × '+money(RATE)+'</em></span><b>'+money(l.hours*RATE)+'</b></div>';
        });
      } else {
        lines+='<div class="pay-line"><span>'+(e.package_label||'Group')+' <em>'+subjectsText(e)+'</em></span><b>'+money(monthly)+' /mo</b></div>';
      }
      if(reg) lines+='<div class="pay-line"><span>Registration fee <em>once-off</em></span><b>'+money(reg)+'</b></div>';

      const proof = e.proof_url
        ? '<a href="#" class="pay-proof" data-proof="'+e.proof_url+'">View proof of payment</a>'
        : '<span class="pay-noproof">No proof uploaded</span>';

      let actions='';
      if(e.status==='pending'){
        actions='<button class="btn btn-approve" data-approve="'+e.id+'"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Approve</button>'+
                '<button class="btn btn-reject" data-reject="'+e.id+'">Reject</button>';
      } else if(e.status==='approved'){
        actions='<span class="pay-approved"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Approved '+fmtDateTime(e.approved_at)+'</span>';
      } else if(e.status==='rejected'){
        actions='<span class="pay-rejected">Rejected</span> <button class="btn btn-approve" data-approve="'+e.id+'"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Approve</button>';
      }

      const card=document.createElement('div');
      card.className='pay-card';
      card.innerHTML=
        '<div class="pay-head"><div><div class="pay-pkg">'+(e.package_label||'Enrolment')+'</div>'+
          '<div class="pay-date">Submitted '+fmtDateTime(e.created_at)+'</div></div>'+pmtBadge(e.status)+'</div>'+
        '<div class="pay-lines">'+lines+'<div class="pay-total"><span>Total for the month</span><b>'+money(grand)+'</b></div></div>'+
        '<div class="pay-foot">'+proof+'<div class="pay-actions">'+actions+'</div></div>';
      wrap.appendChild(card);
    });

    // wire proof links -> lightbox
    wrap.querySelectorAll('.pay-proof').forEach(a=>a.addEventListener('click',ev=>{
      ev.preventDefault();
      const url=a.dataset.proof;
      const img=document.getElementById('lightboxImg');
      // if it's a pdf, open in new tab; else lightbox
      if(/\.pdf($|\?)/i.test(url)){ window.open(url,'_blank'); return; }
      img.src=url; document.getElementById('lightbox').classList.add('open');
    }));
    // wire approve/reject
    wrap.querySelectorAll('[data-approve]').forEach(b=>b.addEventListener('click',()=>act(b.dataset.approve,'approve',b)));
    wrap.querySelectorAll('[data-reject]').forEach(b=>b.addEventListener('click',()=>act(b.dataset.reject,'reject',b)));
  }

  async function act(id, kind, btn){
    if(btn) btn.disabled=true;
    try{
      const res=await apiFetch('/admin/enrolments/'+id+'/'+kind,{method:'POST'});
      const out=await res.json().catch(()=>({}));
      if(!res.ok){ alert(out.detail||('Could not '+kind+'.')); if(btn) btn.disabled=false; return; }
      await loadData();
      // re-open the same student to reflect changes
      if(currentStudentIdx!=null && STUDENTS[currentStudentIdx]) renderPayments(STUDENTS[currentStudentIdx]);
      else closeModal();
    }catch(err){ alert('Could not reach the server.'); if(btn) btn.disabled=false; }
  }

  // deregister whole student
  document.getElementById('mDereg').addEventListener('click',async ()=>{
    if(currentStudentIdx==null) return;
    const s=STUDENTS[currentStudentIdx];
    if(!confirm('Permanently remove '+(s.name||s.email)+' and ALL their data? This cannot be undone.')) return;
    try{
      const res=await apiFetch('/admin/students/'+s.id+'/deregister',{method:'DELETE'});
      if(!res.ok && res.status!==204){ const out=await res.json().catch(()=>({})); alert(out.detail||'Could not deregister.'); return; }
      closeModal(); await loadData();
    }catch(err){ alert('Could not reach the server.'); }
  });

  function closeModal(){ overlay.classList.remove('open'); document.body.style.overflow=''; currentStudentIdx=null; }
  document.getElementById('modalClose').addEventListener('click',closeModal);
  overlay.addEventListener('click',e=>{ if(e.target===overlay) closeModal(); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ closeModal(); document.getElementById('lightbox').classList.remove('open'); } });
  document.getElementById('lightbox').addEventListener('click',()=>document.getElementById('lightbox').classList.remove('open'));

  gradeSelect.addEventListener('change',render);
  searchInput.addEventListener('input',render);

  loadData();
})();