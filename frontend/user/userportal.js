(function(){
  'use strict';

  let registrationPaid=false;  // true once learner has an approved enrolment
  let monthlyAmount=0;         // monthly subtotal (excludes reg fee)

  // ===== ROUTE GUARD =====
  // Not logged in -> go to login. Admins -> their dashboard.
  if (typeof getToken !== 'function' || !getToken()) {
    window.location.href = 'loginregistration.html#login';
    return;
  }
  if (typeof isAdmin === 'function' && isAdmin()) {
    window.location.href = '../customer/custdashboard.html';
    return;
  }

  // greet the learner by their saved name
  (function(){
    const nm = (typeof getName === 'function') ? getName() : '';
    const nameEl = document.querySelector('.tb-right .tb-name');
    if (nm && nameEl) nameEl.textContent = nm;
  })();

  // wire the Log out button
  (function(){
    const logoutBtn = document.querySelector('.tb-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', function(){
      if (typeof clearAuth === 'function') clearAuth();
      window.location.href = 'loginregistration.html#login';
    });
  })();
  let selectedPkg=null, selectedPrice=null, fileChosen=false;
  let isHourly=false, hourlyRate=0, maxSubjects=1;
  let SUBJECTS=[];  // filled from /api/subjects on load
  const chosen=new Map(); // subject -> hours (hours only used for one-on-one)

  const hoursBox=document.getElementById('hoursBox');
  const subjBox=document.getElementById('subjBox');
  const subjGrid=document.getElementById('subjGrid');
  const subjCount=document.getElementById('subjCount');
  const subjLabel=document.getElementById('subjLabel');
  const totalBar=document.getElementById('receiptBox');
  const totalAmt=document.getElementById('totalAmt');
  const totalNote=document.getElementById('rcNote');
  const rcLines=document.getElementById('rcLines');
  const rcHint=document.getElementById('rcHint');
  const continueBtn=document.getElementById('toStep2');

  const CHECK='<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';

  function buildSubjectGrid(){
    subjGrid.innerHTML='';
    SUBJECTS.forEach(s=>{
      const chip=document.createElement('div');
      chip.className='subj-chip'; chip.dataset.subj=s;
      chip.innerHTML=
        '<div class="sc-top"><span class="box">'+CHECK+'</span><span class="nm">'+s+'</span></div>'+
        '<div class="sc-hours"><span class="lbl">Hours</span>'+
          '<span class="mini-step"><button type="button" class="mm">&minus;</button>'+
          '<input type="number" min="1" max="40" value="1" inputmode="numeric">'+
          '<button type="button" class="mp">+</button></span></div>';
      // toggle select
      chip.querySelector('.sc-top').addEventListener('click',()=>toggleSubject(chip,s));
      // per-subject hours (one-on-one)
      const inp=chip.querySelector('input');
      chip.querySelector('.mm').addEventListener('click',e=>{e.stopPropagation();inp.value=Math.max(1,(parseInt(inp.value,10)||1)-1);chosen.set(s,parseInt(inp.value,10));updateTotal();});
      chip.querySelector('.mp').addEventListener('click',e=>{e.stopPropagation();inp.value=Math.min(40,(parseInt(inp.value,10)||1)+1);chosen.set(s,parseInt(inp.value,10));updateTotal();});
      inp.addEventListener('click',e=>e.stopPropagation());
      inp.addEventListener('input',()=>{let h=parseInt(inp.value,10);if(isNaN(h)||h<1)h=1;if(h>40)h=40;inp.value=h;chosen.set(s,h);updateTotal();});
      subjGrid.appendChild(chip);
    });
  }

  function toggleSubject(chip,s){
    if(chosen.has(s)){
      chosen.delete(s); chip.classList.remove('sel');
      chip.querySelector('.sc-hours').classList.remove('on');
    } else {
      if(chosen.size>=maxSubjects) return; // at limit
      const h=isHourly?(parseInt(chip.querySelector('input').value,10)||1):null;
      chosen.set(s,h); chip.classList.add('sel');
      if(isHourly) chip.querySelector('.sc-hours').classList.add('on');
    }
    refreshChips();
    updateTotal();
  }

  function refreshChips(){
    const atLimit=chosen.size>=maxSubjects;
    subjGrid.querySelectorAll('.subj-chip').forEach(chip=>{
      const s=chip.dataset.subj;
      if(!chosen.has(s)) chip.classList.toggle('disabled',atLimit);
      else chip.classList.remove('disabled');
    });
    subjCount.textContent=chosen.size+' / '+maxSubjects+' selected';
    subjLabel.textContent = maxSubjects>1 ? 'Select your subjects' : 'Select your subject';
  }

  function rand(){ return 'R'; }
  function money(n){ return 'R'+n.toLocaleString('en-ZA'); }


  // fetch whether the once-off registration fee still applies
  (async function loadRegStatus(){
    try{
      const res=await apiFetch('/me',{method:'GET'});
      if(res.ok){ const p=await res.json(); registrationPaid=!!p.registration_paid; }
    }catch(_){}
    updateFeeRow();
    if(typeof updateTotal==='function' && selectedPkg) updateTotal();
  })();

  // show/hide the R100 fee row in the order summary based on registrationPaid
  function updateFeeRow(){
    const feeRow=document.querySelector('.rc-fee');
    if(!feeRow) return;
    if(registrationPaid){ feeRow.style.display='none'; }
    else { feeRow.style.display=''; }
  }

  function updateTotal(){
    let ready=false, total=0;
    rcLines.innerHTML='';

    if(isHourly){
      // one-on-one: a line per subject = hours × rate
      if(chosen.size===0){
        rcLines.innerHTML='<div class="rc-empty">Select at least one subject to see your breakdown.</div>';
      }
      let totalHrs=0;
      chosen.forEach((h,s)=>{
        const hh=h||1; const lineAmt=hh*hourlyRate; total+=lineAmt; totalHrs+=hh;
        rcLines.insertAdjacentHTML('beforeend',
          '<div class="rc-line"><div class="rl-left"><span class="rl-name">'+s+'</span>'+
          '<span class="rl-meta">'+hh+(hh===1?' hour':' hours')+' × '+money(hourlyRate)+'</span></div>'+
          '<span class="rl-amt">'+money(lineAmt)+'</span></div>');
      });
      const nSub=chosen.size;
      totalNote.textContent = nSub? ' · '+nSub+(nSub===1?' subject':' subjects')+', '+totalHrs+(totalHrs===1?' hour':' hours') : '';
      rcHint.textContent='One-on-one hours are arranged with your tutor. Pay by EFT, then upload proof on the next step.';
      ready = nSub>=1;
    } else {
      // group plan: flat monthly, list chosen subjects, single price line
      const flat=parseInt((selectedPrice||'').replace(/[^\d]/g,''),10)||0;
      total=flat;
      if(chosen.size===0){
        rcLines.innerHTML='<div class="rc-empty">Select your subject'+(maxSubjects>1?'s':'')+' to see your breakdown.</div>';
      } else {
        rcLines.insertAdjacentHTML('beforeend',
          '<div class="rc-line"><div class="rl-left"><span class="rl-name">'+selectedPkg+'</span>'+
          '<span class="rl-meta">'+[...chosen.keys()].join(', ')+'</span></div>'+
          '<span class="rl-amt">'+money(flat)+' /mo</span></div>');
      }
      totalNote.textContent = chosen.size? ' · '+chosen.size+' of '+maxSubjects+' subjects' : '';
      rcHint.textContent='Monthly fee. Pay by EFT using the details above, then upload your proof on the next step.';
      ready = chosen.size===maxSubjects;
    }

    // add the once-off registration fee to the grand total (first payment only)
    const regFee = registrationPaid ? 0 : 100;
    const grand = total + (total ? regFee : 0);
    monthlyAmount = total;                       // remember the monthly (for submit/receipt)
    totalAmt.textContent = total? money(grand) : '—';
    continueBtn.disabled=!ready;
  }

  // load subjects from the backend, then build the grid
  (async function loadSubjects(){
    try {
      const res = await apiFetch('/subjects', { method: 'GET' });
      if(res.ok){
        const data = await res.json();
        SUBJECTS = data.map(s => s.name);
      } else {
        SUBJECTS = [];
      }
    } catch(err){
      SUBJECTS = [];
    }
    buildSubjectGrid();
    if(SUBJECTS.length === 0 && subjGrid){
      subjGrid.innerHTML = '<div class="rc-empty">Could not load subjects. Please refresh.</div>';
    }
  })();


  const num1=document.getElementById('num1'),num2=document.getElementById('num2'),num3=document.getElementById('num3');
  const node1=document.getElementById('node1'),node2=document.getElementById('node2'),node3=document.getElementById('node3');
  const panel1=document.getElementById('panel1'),panel2=document.getElementById('panel2'),panel3=document.getElementById('panel3');
  const check='<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';

  function goStep(s){
    [panel1,panel2,panel3].forEach(p=>p.classList.remove('active'));
    [node1,node2,node3].forEach(n=>n.classList.remove('active'));
    window.scrollTo({top:0,behavior:'smooth'});
    if(s===1){panel1.classList.add('active');node1.classList.add('active');num1.textContent='1';}
    if(s===2){panel2.classList.add('active');node2.classList.add('active');
      node1.classList.add('done');num1.innerHTML=check;num2.textContent='2';}
    if(s===3){panel3.classList.add('active');node3.classList.add('active');
      node1.classList.add('done');num1.innerHTML=check;
      node2.classList.add('done');num2.innerHTML=check;num3.textContent='3';
      // fill summary
      document.getElementById('sumPkg').textContent=selectedPkg||'—';
      document.getElementById('sumPrice').textContent=totalAmt.textContent;
      const subs=[...chosen.entries()].map(([s,h])=> isHourly? s+' ('+(h||1)+'h)' : s ).join(', ');
      const subRow=document.getElementById('sumSubjects');
      if(subRow) subRow.textContent=subs||'—';
    }
  }

  // package selection
  document.querySelectorAll('.pkg').forEach(p=>{
    p.addEventListener('click',()=>{
      document.querySelectorAll('.pkg').forEach(x=>x.classList.remove('sel'));
      p.classList.add('sel');
      selectedPkg=p.dataset.pkg; selectedPrice=p.dataset.price;
      isHourly=p.dataset.hourly==='true';
      hourlyRate=parseInt(p.dataset.rate||'0',10);
      maxSubjects=parseInt(p.dataset.max||'1',10);
      // reset chosen subjects on package change
      chosen.clear();
      subjGrid.querySelectorAll('.subj-chip').forEach(chip=>{
        chip.classList.remove('sel','disabled');
        chip.querySelector('.sc-hours').classList.remove('on');
        const inp=chip.querySelector('input'); if(inp) inp.value=1;
      });
      hoursBox.classList.toggle('show',isHourly); // one-on-one intro note
      subjBox.classList.add('show');
      totalBar.classList.add('show');
      refreshChips();
      updateTotal();
    });
  });

  // ---- upload ----
  const drop=document.getElementById('drop'),input=document.getElementById('fileInput');
  const preview=document.getElementById('filePreview'),fpName=document.getElementById('fpName'),
        fpSize=document.getElementById('fpSize'),fpIcon=document.getElementById('fpIcon'),
        fpRemove=document.getElementById('fpRemove'),submitBtn=document.getElementById('toStep3');

  document.getElementById('toStep2').addEventListener('click',()=>goStep(2));
  document.getElementById('backTo1').addEventListener('click',()=>goStep(1));
  document.getElementById('toStep3').addEventListener('click',submitEnrolment);

  async function submitEnrolment(e){
    if(e && e.preventDefault) e.preventDefault();
    // must have a package, the right number of subjects, and a file
    if(!selectedPkg){ alert('Please choose a package.'); return; }
    if(chosen.size===0){ alert('Please select your subject(s).'); return; }
    if(!input || !input.files || !input.files[0]){ alert('Please upload your proof of payment.'); return; }

    // build the subjects payload: [{name, hours}]
    const subjectsPayload = [...chosen.entries()].map(([name,h])=>({
      name: name,
      hours: isHourly ? (h||1) : 1,
    }));

    // monthly fee only for group plans (strip non-digits from the price)
    const monthlyFee = isHourly ? '' : String(parseInt((selectedPrice||'').replace(/[^\d]/g,''),10)||0);

    const fd = new FormData();
    fd.append('package_type', isHourly ? 'oneonone' : 'group');
    if(!isHourly) fd.append('monthly_fee', monthlyFee);
    fd.append('subjects', JSON.stringify(subjectsPayload));
    fd.append('proof', input.files[0]);

    const btn=document.getElementById('toStep3');
    if(btn) btn.disabled=true;
    try {
      // note: no Content-Type header - apiFetch skips it for FormData so the
      // browser sets the multipart boundary automatically
      const res = await apiFetch('/enrolments', { method:'POST', body: fd });
      const out = await res.json().catch(()=>({}));
      if(!res.ok){
        alert(out.detail || 'Submission failed. Please check your details and try again.');
        return;
      }
      // success -> STAY on the confirmation screen; learner navigates away themselves.
      // snapshot summary so a Live Server auto-reload lands back on confirmation.
      try{
        const subsTxt=[...chosen.entries()].map(([s,h])=> isHourly? s+' ('+(h||1)+'h)' : s ).join(', ');
        sessionStorage.setItem('ipa_show_confirm','1');
        sessionStorage.setItem('ipa_confirm_pkg', selectedPkg||'—');
        sessionStorage.setItem('ipa_confirm_subs', subsTxt||'—');
        sessionStorage.setItem('ipa_confirm_amt', (totalAmt&&totalAmt.textContent)||'—');
      }catch(_){}
      loadSubmissions();     // refresh in the background (no await, no switch)
      goStep(3);             // show confirmation and stay
    } catch(err){
      alert('Could not reach the server. Is the backend running?');
    } finally {
      if(btn) btn.disabled=false;
    }
  }
  document.getElementById('backTo2').addEventListener('click',()=>switchView('subs'));


  function humanSize(b){return b<1024?b+' B':b<1048576?(b/1024).toFixed(1)+' KB':(b/1048576).toFixed(1)+' MB';}
  function showFile(file){
    fpName.textContent=file.name; fpSize.textContent=humanSize(file.size);
    // image thumbnail
    fpIcon.innerHTML='';
    if(file.type.startsWith('image/')){
      const img=document.createElement('img'); img.className='thumb';
      img.src=URL.createObjectURL(file); fpIcon.replaceWith(img); img.id='fpIcon';
    }
    preview.classList.add('show'); fileChosen=true; submitBtn.disabled=false;
  }
  input.addEventListener('change',e=>{ if(e.target.files[0]) showFile(e.target.files[0]); });
  ['dragover','dragenter'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('drag');}));
  ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('drag');}));
  drop.addEventListener('drop',e=>{ const f=e.dataTransfer.files[0]; if(f){input.files=e.dataTransfer.files;showFile(f);} });
  fpRemove.addEventListener('click',e=>{
    e.preventDefault();e.stopPropagation();
    input.value=''; preview.classList.remove('show'); fileChosen=false; submitBtn.disabled=true;
  });


  // ===== EDIT INFO PANEL =====
  const editPanel=document.getElementById('editPanel');
  const editToggle=document.getElementById('editToggle');
  const editClose=document.getElementById('editClose');
  const editCancel=document.getElementById('editCancel');
  const editForm=document.getElementById('editForm');
  const nameLabel=document.querySelector('.tb-right .tb-name');
  let profileLoaded=false;

  function openEdit(){ editPanel.classList.add('open'); editPanel.scrollIntoView({behavior:'smooth',block:'nearest'}); loadProfileIntoForm(); }
  function closeEdit(){ editPanel.classList.remove('open'); }

  // pull the learner's current details from the backend into the form
  async function loadProfileIntoForm(){
    if(profileLoaded) return;   // only fetch once per page load
    try {
      const res = await apiFetch('/me', { method:'GET' });
      if(!res.ok) return;
      const p = await res.json();
      const set=(id,val)=>{ const el=document.getElementById(id); if(el!=null && val!=null) el.value=val; };
      set('eiName', p.name);
      set('eiDob', p.date_of_birth);
      set('eiGrade', p.grade);
      set('eiSchool', p.school);
      set('eiProvince', p.province);
      profileLoaded=true;
    } catch(err){ /* leave form defaults if it fails */ }
  }

  if(editToggle) editToggle.addEventListener('click',()=> editPanel.classList.contains('open')?closeEdit():openEdit());
  if(editClose) editClose.addEventListener('click',closeEdit);
  if(editCancel) editCancel.addEventListener('click',closeEdit);

  if(editForm) editForm.addEventListener('submit',async e=>{
    e.preventDefault();
    const data={
      name:document.getElementById('eiName').value.trim(),
      date_of_birth:document.getElementById('eiDob').value,
      grade:document.getElementById('eiGrade').value,
      school:document.getElementById('eiSchool').value.trim(),
      province:document.getElementById('eiProvince').value,
    };
    const saveBtn=editForm.querySelector('.ef-save');
    if(saveBtn) saveBtn.disabled=true;
    try {
      const res = await apiFetch('/me', {
        method:'PATCH',
        body: JSON.stringify(data),
      });
      const out = await res.json();
      if(!res.ok){
        alert(out.detail || 'Could not save your details. Please check and try again.');
        return;
      }
      // reflect the new name in the top bar (and stored name)
      if(nameLabel && out.name) nameLabel.textContent=out.name;
      if(typeof localStorage!=='undefined' && out.name) localStorage.setItem('ipa_name', out.name);
      closeEdit();
    } catch(err){
      alert('Could not reach the server. Is the backend running?');
    } finally {
      if(saveBtn) saveBtn.disabled=false;
    }
  });

  // ===================== TABS: New enrolment / My submissions =====================
  const tabEnrol=document.getElementById('tabEnrol');
  const tabSubs=document.getElementById('tabSubs');
  const viewEnrol=document.getElementById('viewEnrol');
  const viewSubs=document.getElementById('viewSubs');
  const pageTitle=document.getElementById('pageTitle');
  const pageSub=document.getElementById('pageSub');

  function switchView(which){
    const subs = which==='subs';
    if(tabEnrol) tabEnrol.classList.toggle('active',!subs);
    if(tabSubs) tabSubs.classList.toggle('active',subs);
    if(viewEnrol) viewEnrol.style.display = subs?'none':'';
    if(viewSubs) viewSubs.style.display = subs?'':'none';
    if(pageTitle) pageTitle.textContent = subs ? 'My submissions' : 'Complete your enrolment';
    if(pageSub) pageSub.textContent = subs
      ? 'Every enrolment you submit, with its status. Print a receipt once approved.'
      : "Choose a package, upload your proof of payment, and we'll review it shortly.";
    if(subs) loadSubmissions();
    window.scrollTo({top:0,behavior:'smooth'});
  }
  if(tabEnrol) tabEnrol.addEventListener('click',()=>switchView('enrol'));
  if(tabSubs) tabSubs.addEventListener('click',()=>switchView('subs'));

  // confirmation-screen navigation (learner chooses when to leave)
  const goToSubsBtn=document.getElementById('goToSubs');
  const backToStartBtn=document.getElementById('backToStart');
  if(goToSubsBtn) goToSubsBtn.addEventListener('click',()=>switchView('subs'));
  if(backToStartBtn) backToStartBtn.addEventListener('click',()=>{ resetEnrolFlow(); switchView('enrol'); });

  // reset the stepped enrolment flow so the learner can submit again
  function resetEnrolFlow(){
    selectedPkg=null; selectedPrice=null; isHourly=false; hourlyRate=0; maxSubjects=1;
    chosen.clear();
    document.querySelectorAll('.pkg').forEach(x=>x.classList.remove('sel'));
    if(subjBox) subjBox.classList.remove('show');
    if(hoursBox) hoursBox.classList.remove('show');
    if(totalBar) totalBar.classList.remove('show');
    // clear file
    try{ input.value=''; }catch(_){}
    if(preview) preview.classList.remove('show');
    fileChosen=false;
    const s3=document.getElementById('toStep3'); if(s3) s3.disabled=true;
    const s2=document.getElementById('toStep2'); if(s2) s2.disabled=true;
    goStep(1);
  }

  // ===================== MY SUBMISSIONS =====================
  const subsList=document.getElementById('subsList');
  const subsEmpty=document.getElementById('subsEmpty');

  function fmtDateTime(iso){
    if(!iso) return '';
    const d=new Date(iso);
    if(isNaN(d)) return iso;
    const date=d.toLocaleDateString('en-ZA',{day:'2-digit',month:'short',year:'numeric'});
    const time=d.toLocaleTimeString('en-ZA',{hour:'2-digit',minute:'2-digit'});
    return date+' · '+time;
  }
  function subBadge(status){
    if(status==='approved') return '<span class="sub-badge approved"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Approved</span>';
    if(status==='rejected') return '<span class="sub-badge rejected"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Rejected</span>';
    return '<span class="sub-badge pending"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg> Pending</span>';
  }
  function subjectsText(rec){
    return (rec.subject_lines||[]).map(l =>
      rec.package_type==='oneonone' ? (l.subject_name+' ('+l.hours+'h)') : l.subject_name
    ).join(', ');
  }

  let mySubs=[];
  async function loadSubmissions(){
    try {
      const res=await apiFetch('/my/enrolments',{method:'GET'});
      if(!res.ok){ mySubs=[]; renderSubmissions(); return; }
      mySubs=await res.json();
      renderSubmissions();
    } catch(err){ mySubs=[]; renderSubmissions(); }
  }

  function renderSubmissions(){
    if(!subsList) return;
    // clear everything except the empty-state node
    [...subsList.querySelectorAll('.sub-card')].forEach(n=>n.remove());
    if(!mySubs.length){ if(subsEmpty) subsEmpty.style.display=''; return; }
    if(subsEmpty) subsEmpty.style.display='none';

    mySubs.forEach(rec=>{
      const reg=rec.registration_fee||0;
      const grand=(rec.total||0)+reg;
      const amount='R'+grand.toLocaleString('en-ZA');
      const card=document.createElement('div');
      card.className='sub-card';
      let actions='';
      if(rec.status==='approved'){
        actions='<div class="sub-actions"><button type="button" class="btn-receipt" data-id="'+rec.id+'">'
          +'<svg viewBox="0 0 24 24"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>'
          +' Print receipt</button></div>';
      }
      card.innerHTML=
        '<div class="sub-top">'
        +'<div><div class="sub-pkg">'+(rec.package_label||'Enrolment')+'</div>'
        +'<div class="sub-subs">'+subjectsText(rec)+'</div></div>'
        +subBadge(rec.status)+'</div>'
        +'<div class="sub-meta">'
        +'<div class="m"><span class="k">Submitted</span><span class="v">'+fmtDateTime(rec.created_at)+'</span></div>'
        +'<div class="m"><span class="k">Amount</span><span class="v">'+amount+'</span></div>'
        +(rec.approved_at?('<div class="m"><span class="k">Approved</span><span class="v">'+fmtDateTime(rec.approved_at)+'</span></div>'):'')
        +'</div>'+actions;
      subsList.appendChild(card);
    });

    // wire receipt buttons
    subsList.querySelectorAll('.btn-receipt').forEach(b=>{
      b.addEventListener('click',()=>printReceipt(parseInt(b.dataset.id,10)));
    });
  }

  // ===================== PRINT RECEIPT =====================
  function printReceipt(id){
    const rec=mySubs.find(r=>r.id===id);
    if(!rec) return;
    const reg=rec.registration_fee||0;
    const grand=(rec.total||0)+reg;
    const monthly='R'+(rec.total||0).toLocaleString('en-ZA');
    const regTxt='R'+reg.toLocaleString('en-ZA');
    const grandTxt='R'+grand.toLocaleString('en-ZA');
    const learner=(typeof getName==='function'?getName():'')||'Learner';
    const box=document.getElementById('receiptPrint');
    box.innerHTML=
      '<div class="rp-head">'
      +'<img class="rp-logo" src="images/logo.png" alt="IPA" onerror="this.style.display=\'none\'">'
      +'<div class="rp-brand">Ignite Potential Academy<span class="rp-sub">Ignite Brilliance, Inspire Futures</span></div>'
      +'</div>'
      +'<div class="rp-title">Payment Receipt</div>'
      +'<div class="rp-paid">APPROVED</div>'
      +'<div class="rp-row"><span class="k">Learner</span><span class="v">'+learner+'</span></div>'
      +'<div class="rp-row"><span class="k">Package</span><span class="v">'+(rec.package_label||'Enrolment')+'</span></div>'
      +'<div class="rp-row"><span class="k">Subject(s)</span><span class="v">'+subjectsText(rec)+'</span></div>'
      +'<div class="rp-row"><span class="k">Date &amp; time of submission</span><span class="v">'+fmtDateTime(rec.created_at)+'</span></div>'
      +(rec.approved_at?('<div class="rp-row"><span class="k">Approved on</span><span class="v">'+fmtDateTime(rec.approved_at)+'</span></div>'):'')
      +'<div class="rp-row"><span class="k">Receipt no.</span><span class="v">IPA-'+String(rec.id).padStart(5,'0')+'</span></div>'
      +'<div class="rp-row"><span class="k">Monthly fee</span><span class="v">'+monthly+'</span></div>'
      +(reg? '<div class="rp-row"><span class="k">Registration fee (once-off)</span><span class="v">'+regTxt+'</span></div>' : '')
      +'<div class="rp-total"><span class="k">Total paid</span><span class="v">'+grandTxt+'</span></div>'
      +'<div class="rp-foot">Thank you for enrolling with Ignite Potential Academy.</div>';
    window.print();
  }

  // on load: if we just submitted, open My Submissions; else default to enrol
  (function initView(){
    try {
      if(sessionStorage.getItem('ipa_show_confirm')==='1'){
        sessionStorage.removeItem('ipa_show_confirm');
        switchView('enrol');
        goStep(3);
        try{
          const setTxt=(id,v)=>{const el=document.getElementById(id); if(el&&v) el.textContent=v;};
          setTxt('sumPkg', sessionStorage.getItem('ipa_confirm_pkg'));
          setTxt('sumSubjects', sessionStorage.getItem('ipa_confirm_subs'));
          setTxt('sumPrice', sessionStorage.getItem('ipa_confirm_amt'));
        }catch(_){}
        return;
      }
    } catch(_){}
    // preload submissions quietly so the tab is ready
    loadSubmissions();
  })();

})();