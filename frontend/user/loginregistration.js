(function(){
  'use strict';

  const tabLogin=document.getElementById('tabLogin');
  const tabRegister=document.getElementById('tabRegister');
  const slider=document.getElementById('tabSlider');
  const viewLogin=document.getElementById('viewLogin');
  const viewRegister=document.getElementById('viewRegister');

  // ---- view switching ----
  function show(which){
    const reg = which==='register';
    tabLogin.classList.toggle('is-active',!reg);
    tabRegister.classList.toggle('is-active',reg);
    slider.classList.toggle('right',reg);
    viewLogin.classList.toggle('is-active',!reg);
    viewRegister.classList.toggle('is-active',reg);
    // keep url in sync so refresh/deep-link lands on the right view
    history.replaceState(null,'', reg?'#register':'#login');
    // move focus to first field for accessibility
    const first=(reg?viewRegister:viewLogin).querySelector('input');
    if(first) setTimeout(()=>first.focus(),120);
  }

  tabLogin.addEventListener('click',()=>show('login'));
  tabRegister.addEventListener('click',()=>show('register'));

  // cross-links inside the forms ("Sign up" / "Log in")
  document.querySelectorAll('.switch-link').forEach(link=>{
    link.addEventListener('click',e=>{ e.preventDefault(); show(link.dataset.go); });
  });

  // ---- deep link: land on the correct view ----
  // infopage "Register" button -> loginregistration.html#register
  // infopage "Log in" button   -> loginregistration.html#login
  const hash=(location.hash||'').toLowerCase();
  if(hash==='#register') show('register');
  else show('login');

  // ---- password show / hide ----
  document.querySelectorAll('.toggle-pw').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const input=document.getElementById(btn.dataset.target);
      if(!input) return;
      const showing=input.type==='text';
      input.type=showing?'password':'text';
      btn.classList.toggle('off',showing);
      btn.setAttribute('aria-label', showing?'Show password':'Hide password');
    });
  });

  // ---- helpers ----
  function markInvalid(input,bad){ input.classList.toggle('invalid',bad); }
  const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  // ---- login submit ----
  document.getElementById('loginForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const email=document.getElementById('loginEmail');
    const pw=document.getElementById('loginPassword');
    let ok=true;
    if(!isEmail(email.value.trim())){ markInvalid(email,true); ok=false; } else markInvalid(email,false);
    if(pw.value.length<1){ markInvalid(pw,true); ok=false; } else markInvalid(pw,false);
    if(!ok) return;

    const btn = e.target.querySelector('.btn-submit');
    if(btn) btn.disabled = true;

    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: email.value.trim(),
          password: pw.value,
        }),
      });
      const data = await res.json();
      if(!res.ok){
        alert(data.detail || (data.non_field_errors && data.non_field_errors[0]) || 'Invalid email or password.');
        return;
      }
      saveAuth(data);
      // admins go to the dashboard, learners to the portal
      if(data.is_admin){
        window.location.href = '../customer/custdashboard.html';
      } else {
        window.location.href = 'userportal.html';
      }
    } catch(err){
      alert('Could not reach the server. Is the backend running?');
    } finally {
      if(btn) btn.disabled = false;
    }
  });

  // ---- register submit ----
  document.getElementById('registerForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const f=e.target;
    const fields={
      learnerName:f.learnerName,
      learnerDob:f.learnerDob,
      learnerGrade:f.learnerGrade,
      learnerProvince:f.learnerProvince,
      learnerSchool:f.learnerSchool,
      learnerWhatsapp:f.learnerWhatsapp,
      learnerEmail:f.learnerEmail,
      guardianName:f.guardianName,
      guardianWhatsapp:f.guardianWhatsapp,
      guardianEmail:f.guardianEmail,
      password:document.getElementById('regPassword'),
      password2:document.getElementById('regPassword2'),
    };
    let ok=true;

    // required text/tel
    ['learnerName','guardianName'].forEach(k=>{
      const bad=fields[k].value.trim().length<2; markInvalid(fields[k],bad); if(bad) ok=false;
    });
    // date of birth (required, not in the future)
    const dobVal=fields.learnerDob.value;
    const dobBad = !dobVal || (new Date(dobVal) > new Date());
    markInvalid(fields.learnerDob,dobBad); if(dobBad) ok=false;
    // grade
    const gradeBad=!fields.learnerGrade.value; markInvalid(fields.learnerGrade,gradeBad); if(gradeBad) ok=false;
    // province
    const provBad=!fields.learnerProvince.value; markInvalid(fields.learnerProvince,provBad); if(provBad) ok=false;
    // school
    const schoolBad=fields.learnerSchool.value.trim().length<2; markInvalid(fields.learnerSchool,schoolBad); if(schoolBad) ok=false;
    // emails
    ['learnerEmail','guardianEmail'].forEach(k=>{
      const bad=!isEmail(fields[k].value.trim()); markInvalid(fields[k],bad); if(bad) ok=false;
    });
    // whatsapp (at least 9 digits)
    ['learnerWhatsapp','guardianWhatsapp'].forEach(k=>{
      const digits=fields[k].value.replace(/\D/g,''); const bad=digits.length<9;
      markInvalid(fields[k],bad); if(bad) ok=false;
    });
    // password
    const pwBad=fields.password.value.length<6; markInvalid(fields.password,pwBad); if(pwBad) ok=false;
    const matchBad=fields.password.value!==fields.password2.value || fields.password2.value.length<6;
    markInvalid(fields.password2,matchBad); if(matchBad) ok=false;
    // terms
    const agree=document.getElementById('agree');
    if(!agree.checked){ ok=false; agree.parentNode.style.color='var(--red)'; }
    else agree.parentNode.style.color='';

    if(!ok) return;

    const btn = e.target.querySelector('.btn-submit');
    if(btn) btn.disabled = true;

    try {
      const res = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: fields.learnerEmail.value.trim(),
          password: fields.password.value,
          name: fields.learnerName.value.trim(),
          date_of_birth: fields.learnerDob.value,
          grade: fields.learnerGrade.value,
          school: fields.learnerSchool.value.trim(),
          province: fields.learnerProvince.value,
          whatsapp: fields.learnerWhatsapp.value.trim(),
          guardian_name: fields.guardianName.value.trim(),
          guardian_whatsapp: fields.guardianWhatsapp.value.trim(),
          guardian_email: fields.guardianEmail.value.trim(),
        }),
      });
      const data = await res.json();
      if(!res.ok){
        // show the first error the backend returns (e.g. email already exists)
        let msg = 'Registration failed. Please check your details.';
        if(data.email) { msg = Array.isArray(data.email) ? data.email[0] : data.email; markInvalid(fields.learnerEmail,true); }
        else if(data.detail) msg = data.detail;
        alert(msg);
        return;
      }
      saveAuth(data);
      // new learners go straight to the portal
      window.location.href = 'userportal.html';
    } catch(err){
      alert('Could not reach the server. Is the backend running?');
    } finally {
      if(btn) btn.disabled = false;
    }
  });

  // clear invalid state as user types
  document.querySelectorAll('.input-wrap input, .input-wrap select').forEach(inp=>{
    inp.addEventListener('input',()=>inp.classList.remove('invalid'));
    inp.addEventListener('change',()=>inp.classList.remove('invalid'));
  });

})();