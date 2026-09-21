const mt=document.getElementById('menuToggle'),nl=document.getElementById('navLinks');
  mt.addEventListener('click',()=>nl.classList.toggle('show'));
  nl.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>nl.classList.remove('show')));

  // scroll reveal
  const io=new IntersectionObserver((entries)=>{
    entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
  },{threshold:.12,rootMargin:'0px 0px -8% 0px'});
  document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

  // section divider-line reveal (re-fires each time section enters view)
  const secIo=new IntersectionObserver((entries)=>{
    entries.forEach(e=>{ e.target.classList.toggle('section-in', e.isIntersecting); });
  },{threshold:.06});
  document.querySelectorAll('#about,#subjects,#why,#pricing,#enrol,#contact').forEach(el=>secIo.observe(el));
  function openLegal(id){
    document.querySelectorAll('body > section, header, footer, .divider').forEach(el=>el.style.display='none');
    document.getElementById('legal-'+id).classList.add('open');
    window.scrollTo(0,0);
  }
  function closeLegal(id){
    document.getElementById('legal-'+id).classList.remove('open');
    document.querySelectorAll('body > section, header, footer, .divider').forEach(el=>el.style.display='');
    document.querySelectorAll('.reveal:not(.in)').forEach(el=>io.observe(el));
    window.scrollTo(0,0);
  }
  // fallback: if IntersectionObserver unsupported, show everything
  if(!('IntersectionObserver' in window)){
    document.querySelectorAll('.reveal').forEach(el=>el.classList.add('in'));
  }

  // carousel
  (function(){
    const cards=[...document.querySelectorAll('.car-card')];
    const dotsWrap=document.getElementById('carDots');
    const viewport=document.getElementById('carViewport');
    let current=0;const n=cards.length;let isAnimating=false;

    // responsive pixel positions (viewport width-relative via 'left')
    function getPositions(){
      const w=window.innerWidth;
      if(w<=600){
        const vw=viewport.clientWidth; // actual viewport px
        const aw=Math.min(230,vw*0.68);
        const sw=vw*0.24;
        return {
          hiddenLeft:{left:-sw,width:sw,height:200,opacity:0},
          prev:{left:0,width:sw,height:225,opacity:.5},
          active:{left:(vw-aw)/2,width:aw,height:265,opacity:1},
          next:{left:vw-sw,width:sw,height:225,opacity:.5},
          hiddenRight:{left:vw,width:sw,height:200,opacity:0},
        };
      } else if(w<=900){
        return {
          hiddenLeft:{left:-140,width:130,height:280,opacity:0},
          prev:{left:0,width:130,height:300,opacity:.7},
          active:{left:120,width:260,height:340,opacity:1},
          next:{left:370,width:130,height:300,opacity:.7},
          hiddenRight:{left:500,width:130,height:280,opacity:0},
        };
      } else {
        return {
          hiddenLeft:{left:-180,width:160,height:320,opacity:0},
          prev:{left:0,width:160,height:340,opacity:.65},
          active:{left:150,width:300,height:400,opacity:1},
          next:{left:440,width:160,height:340,opacity:.65},
          hiddenRight:{left:600,width:160,height:320,opacity:0},
        };
      }
    }

    function getRole(index){
      const diff=((index-current)%n+n)%n;
      if(diff===0)return 'active';
      if(diff===1)return 'next';
      if(diff===n-1)return 'prev';
      if(diff===2)return 'hiddenRight';
      return 'hiddenLeft';
    }

    function applyPosition(card,role){
      const p=getPositions()[role];
      card.style.left=p.left+'px';
      card.style.width=p.width+'px';
      card.style.height=p.height+'px';
      card.style.opacity=p.opacity;
      card.style.transform='translateY(-50%)';
      card.style.zIndex=role==='active'?10:(role==='prev'||role==='next')?5:1;
      card.classList.toggle('is-active',role==='active');
      if(role==='active'){
        card.style.filter='none';
        card.style.boxShadow='0 24px 50px -20px rgba(0,0,0,.7)';
      } else {
        card.style.filter='brightness(.6)';
        card.style.boxShadow='0 8px 20px -10px rgba(0,0,0,.5)';
      }
    }

    function update(animate=true){
      if(!animate)cards.forEach(c=>c.style.transition='none');
      cards.forEach((card,i)=>applyPosition(card,getRole(i)));
      [...dotsWrap.children].forEach((d,i)=>d.classList.toggle('on',i===current));
      if(!animate){void viewport.offsetHeight;cards.forEach(c=>c.style.transition='');}
    }

    function navigate(dir){
      if(isAnimating)return;isAnimating=true;
      current=(current+dir+n)%n;update(true);
      setTimeout(()=>{isAnimating=false;},600);
    }
    function goTo(i){
      if(isAnimating||i===current)return;isAnimating=true;
      current=i;update(true);setTimeout(()=>{isAnimating=false;},600);
    }

    // dots
    cards.forEach((_,i)=>{
      const b=document.createElement('button');
      b.setAttribute('aria-label','Go to card '+(i+1));
      b.addEventListener('click',()=>goTo(i));
      dotsWrap.appendChild(b);
    });

    // card clicks: active -> explore, side -> navigate
    cards.forEach((card,i)=>{
      card.addEventListener('click',()=>{
        const role=getRole(i);
        if(role==='active'){
          const t=card.getAttribute('data-explore');
          if(t){const el=document.querySelector(t);if(el)el.scrollIntoView({behavior:'smooth'});}
        } else if(role==='prev') navigate(-1);
        else if(role==='next') navigate(1);
        else goTo(i);
      });
    });

    document.getElementById('carNext').addEventListener('click',()=>navigate(1));
    document.getElementById('carPrev').addEventListener('click',()=>navigate(-1));

    // touch swipe
    let touchStartX=0;
    viewport.addEventListener('touchstart',e=>{touchStartX=e.touches[0].clientX;},{passive:true});
    viewport.addEventListener('touchend',e=>{const d=e.changedTouches[0].clientX-touchStartX;if(Math.abs(d)>50)navigate(d>0?-1:1);});

    // resize
    let rt;window.addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>update(false),120);});

    update(false);
  })();