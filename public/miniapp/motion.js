(()=>{
  'use strict';
  if(window.__BLUEGATE_MINI_MOTION__) return;window.__BLUEGATE_MINI_MOTION__=true;
  const reduce=matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const seen=new WeakSet(); let successAt=0;

  function mark(root=document){
    $$('.hero,.shop-hero,.wallet-card,.detail-card,.admin-card,.admin-item,.product-tile,.order-row,.quick-card,.mission-card,.vpn-subscription-card,.vpn-sub-targets,.vpn-sub-metrics>div,.mcw-card,.builder-row',root).forEach(x=>x.dataset.bgmCard='1');
    $$('.status-badge.active,.status-badge.ok,.vpn-sub-pills .ok,.mini-notification-badge',root).forEach(x=>x.dataset.bgmLive='1');
    $$('.vpn-target-flag',root).forEach(x=>{if(!x.dataset.bgmFlag){x.dataset.bgmFlag='1';x.classList.add('bgm-flag-pop');setTimeout(()=>x.classList.remove('bgm-flag-pop'),380)}});
    ['.wallet-card-main','.vpn-subscription-card.ready','.cart-sheet-inner','.presentation-sheet'].forEach(s=>$$(s,root).forEach(x=>x.classList.add('bgm-energy')));
  }

  function enter(el,delay=0){if(reduce||!el||seen.has(el)||el.classList.contains('hidden'))return;seen.add(el);el.style.setProperty('--bgm-delay',`${Math.min(delay,160)}ms`);el.classList.add('bgm-enter');el.addEventListener('animationend',()=>el.classList.remove('bgm-enter'),{once:true})}
  function animate(root=document){$$('.page:not(.hidden)>*,#adminContent>*,#adminStats>*,.product-grid-wrap>*,.h-scroll>*,.missions-grid>*,.tx-list>*,.vpn-sub-targets section',root).slice(0,20).forEach((x,i)=>enter(x,i*18))}

  function latinDigits(str){return String(str).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d))}
  function animateCounter(el){if(reduce||!el||el.children.length||el.dataset.bgmCounterRunning==='1')return;const raw=(el.textContent||'').trim();const m=raw.match(/[0-9۰-۹٠-٩][0-9۰-۹٠-٩,٬٫.]*/);if(!m)return;const token=m[0],norm=latinDigits(token).replace(/[٬,]/g,'').replace('٫','.');const target=Number(norm);if(!Number.isFinite(target)||Math.abs(target)<2)return;const decimals=(norm.split('.')[1]||'').length,fa=/[۰-۹]/.test(token),ar=/[٠-٩]/.test(token),locale=fa?'fa-IR':ar?'ar':'en-US',prefix=raw.slice(0,m.index),suffix=raw.slice(m.index+token.length),start=performance.now(),duration=480;el.dataset.bgmCounterRunning='1';el.style.setProperty('--bgm-counter-color',getComputedStyle(el).color);el.classList.add('bgm-counter-active');const fmt=n=>prefix+new Intl.NumberFormat(locale,{minimumFractionDigits:decimals,maximumFractionDigits:decimals}).format(n)+suffix;const tick=now=>{const t=Math.min(1,(now-start)/duration),e=1-Math.pow(1-t,3);el.dataset.bgmCounter=fmt(target*e);if(t<1)requestAnimationFrame(tick);else{el.dataset.bgmCounter=raw;setTimeout(()=>{el.classList.remove('bgm-counter-active');delete el.dataset.bgmCounterRunning;delete el.dataset.bgmCounter},70)}};requestAnimationFrame(tick)}
  function counters(root=document){$$('.wallet-card-main strong,.mini-stat b,.wallet-mini-grid b,.price-pill,.hero-price strong,.vpn-sub-metrics b,.order-money-grid strong,.stats-grid b',root).forEach(el=>{if(!el.dataset.bgmCountSeen){el.dataset.bgmCountSeen='1';animateCounter(el)}})}

  function progress(root=document){$$('.progress-track span,.progress-bar span,.usage-progress span',root).forEach(bar=>{if(bar.dataset.bgmProgress)return;bar.dataset.bgmProgress='1';bar.classList.add('bgm-progress');if(reduce){bar.classList.add('go');return}const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('go');io.unobserve(e.target)}}),{threshold:.25});io.observe(bar)})}

  function skeleton(){['homePage','shopPage','ordersPage','walletPage','adminContent'].forEach(id=>{const el=document.getElementById(id);if(!el||el.children.length||el.classList.contains('hidden'))return;el.classList.add('bgm-skeleton');const mo=new MutationObserver(()=>{if(el.children.length){el.classList.remove('bgm-skeleton');mo.disconnect()}});mo.observe(el,{childList:true});setTimeout(()=>{el.classList.remove('bgm-skeleton');mo.disconnect()},3500)})}

  function popSuccess(){const now=Date.now();if(reduce||now-successAt<900)return;successAt=now;const n=document.createElement('div');n.className='bgm-success-pop';n.setAttribute('aria-hidden','true');document.body.appendChild(n);try{Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.('success')}catch(_){}setTimeout(()=>n.remove(),850)}
  function successObserver(){const re=/موفق|انجام شد|ثبت شد|پرداخت شد|کپی شد|success/i;const mo=new MutationObserver(ms=>{for(const m of ms){for(const n of m.addedNodes){if(!(n instanceof HTMLElement))continue;const t=(n.textContent||'').trim();if(t&&t.length<220&&re.test(t)&&/toast|status|success|alert/i.test(`${n.className} ${n.id||''} ${n.getAttribute('role')||''}`)){popSuccess();return}}}});mo.observe(document.body,{childList:true,subtree:true,characterData:false})}

  function copyMorph(e){const b=e.target.closest('button,[role="button"]');if(!b)return;const label=(b.textContent||'')+' '+(b.getAttribute('aria-label')||'');if(!/کپی|copy/i.test(label))return;b.classList.add('bgm-copy-pop');const badge=document.createElement('span');badge.className='bgm-copy-badge';badge.textContent='✓ کپی شد';b.appendChild(badge);setTimeout(()=>{badge.remove();if(document.contains(b))b.classList.remove('bgm-copy-pop')},950)}

  function connectionVisual(e){const b=e.target.closest('button');if(!b||!/تست\s*(اتصال|کانکشن)|test\s*connection/i.test(b.textContent||''))return;const host=b.closest('.admin-card,.admin-item,.builder-row,.detail-card,.mcw-card')||b.parentElement;if(!host||$('.bgm-connection-steps',host))return;const box=document.createElement('div');box.className='bgm-connection-steps';box.innerHTML='<span class="active"><i></i>اتصال</span><span><i></i>احراز هویت</span><span><i></i>پاسخ پنل</span>';host.appendChild(box);const steps=$$('span',box);let i=0;const tm=setInterval(()=>{steps[i]?.classList.remove('active');steps[i]?.classList.add('done');i++;if(i<steps.length)steps[i].classList.add('active');else{clearInterval(tm);setTimeout(()=>box.remove(),650)}},420)}

  function modalObserver(){const mo=new MutationObserver(()=>{$$('dialog[open],.cart-sheet.open,.cust-drawer.open,.preview-sheet.open,.qr-sheet.open,.share-sheet.open,.app-sheet.open,.presentation-sheet.open').forEach(el=>{if(el.dataset.bgmModal)return;el.dataset.bgmModal='1';el.classList.add('bgm-modal-in');setTimeout(()=>{el.classList.remove('bgm-modal-in');delete el.dataset.bgmModal},320)})});mo.observe(document.body,{subtree:true,attributes:true,attributeFilter:['open','class']})}

  function navMotion(e){const b=e.target.closest('[data-tab],[data-admin-tab]');if(!b)return;requestAnimationFrame(()=>{const target=b.dataset.tab?document.getElementById(`${b.dataset.tab}Page`):document.getElementById('adminContent');if(target)animate(target)})}
  function logo(){try{if(sessionStorage.getItem('bgm-logo'))return;sessionStorage.setItem('bgm-logo','1')}catch(_){}$('.brand-box')?.classList.add('bgm-logo-intro')}

  function enhance(root=document){mark(root);animate(root);counters(root);progress(root)}
  function enhanceDynamic(root=document){mark(root);progress(root)}
  function boot(){logo();skeleton();enhance();successObserver();modalObserver();document.addEventListener('click',copyMorph,true);document.addEventListener('click',connectionVisual,true);let q=false;const mo=new MutationObserver(ms=>{if(q)return;q=true;requestAnimationFrame(()=>{q=false;ms.flatMap(m=>Array.from(m.addedNodes)).filter(n=>n instanceof HTMLElement).slice(0,12).forEach(enhanceDynamic)})});mo.observe(document.body,{subtree:true,childList:true})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
