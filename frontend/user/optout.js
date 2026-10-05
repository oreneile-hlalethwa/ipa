(function(){
  'use strict';

  const token = new URLSearchParams(window.location.search).get('token');
  const loading = document.getElementById('optLoading');
  const formWrap = document.getElementById('optForm');
  const done = document.getElementById('optDone');
  let learnerName = 'your learner';

  function showMessage(title, text){
    loading.style.display = 'none';
    formWrap.style.display = 'none';
    done.style.display = '';
    done.querySelector('h2').textContent = title;
    done.querySelector('p').textContent = text;
  }

  function lateFeeNote(amount){
    return amount ? ' A late fee of R' + amount + ' already applies and will be added when you return.' : '';
  }

  if(!token){
    showMessage('Invalid link', 'This link is missing information. Please use the link from your email.');
    return;
  }
  const path = '/billing/optout/' + encodeURIComponent(token);

  // 1. look up who this link is for
  (async function(){
    try{
      const res = await apiFetch(path, { method: 'GET' });
      const data = await res.json().catch(()=>({}));
      if(!res.ok){
        showMessage('Invalid link', data.detail || 'This link is invalid or has expired.');
        return;
      }
      learnerName = data.learner_name || learnerName;
      if(data.status === 'optedout'){
        showMessage('Already confirmed',
          learnerName + ' is already marked as not continuing. No further reminders will be sent.' + lateFeeNote(data.late_fee_owed));
        return;
      }
      document.getElementById('optIntro').textContent =
        'If ' + learnerName + ' will not continue next month, confirm below. ' +
        'We will stop sending payment reminders and no late fee will be charged.' + lateFeeNote(data.late_fee_owed);
      document.getElementById('optLabel').textContent =
        'I confirm that ' + learnerName + ' will not continue next month.';
      loading.style.display = 'none';
      formWrap.style.display = '';
    }catch(err){
      showMessage('Something went wrong', 'Could not reach the server. Please try again later.');
    }
  })();

  // 2. confirm
  document.getElementById('optoutForm').addEventListener('submit', async e=>{
    e.preventDefault();
    const box = document.getElementById('optConfirm');
    if(!box.checked){ box.parentNode.style.color = 'var(--red)'; return; }
    box.parentNode.style.color = '';

    const btn = e.target.querySelector('.btn-submit');
    btn.disabled = true;
    try{
      const res = await apiFetch(path, { method: 'POST', body: JSON.stringify({ confirm: true }) });
      const data = await res.json().catch(()=>({}));
      if(!res.ok){ alert(data.detail || 'Could not save. Please try again.'); return; }
      showMessage('Thank you',
        learnerName + ' will not receive further payment reminders. To come back, log in to the ' +
        'learner portal and submit a new payment whenever you are ready.' + lateFeeNote(data.late_fee_owed));
    }catch(err){
      alert('Could not reach the server. Please try again later.');
    }finally{
      btn.disabled = false;
    }
  });
})();