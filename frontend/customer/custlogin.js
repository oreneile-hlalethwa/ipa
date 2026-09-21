(function(){
  'use strict';

  // If an admin is already logged in, skip the login page.
  if (typeof getToken === 'function' && getToken() && typeof isAdmin === 'function' && isAdmin()) {
    window.location.href = 'custdashboard.html';
    return;
  }

  // password show / hide
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

  const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  function markInvalid(input,bad){ input.classList.toggle('invalid',bad); }

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
      // admin-only page: refuse non-admin accounts
      if(!data.is_admin){
        alert('This login is for administrators only.');
        return;
      }
      saveAuth(data);
      window.location.href = 'custdashboard.html';
    } catch(err){
      alert('Could not reach the server. Is the backend running?');
    } finally {
      if(btn) btn.disabled = false;
    }
  });

  // clear invalid state as user types
  document.querySelectorAll('.input-wrap input').forEach(inp=>{
    inp.addEventListener('input',()=>inp.classList.remove('invalid'));
  });

})();