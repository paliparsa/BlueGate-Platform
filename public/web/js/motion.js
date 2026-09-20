(()=>{
  'use strict';
  if(window.__BLUEGATE_MOTION__) return;
  window.__BLUEGATE_MOTION__=true;
  const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const fine=window.matchMedia?.('(hover:hover) and (pointer:fine)').matches;
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const seen=new WeakSet();
  let successCooldown=0;

  function markHoverables(root=document){
    $$('.product-tab,.configurator-card,.premium-card,.vpn-package-card,.feature-card,.review-card,.tutorial-card,.generic-product-card,.bg-order-card,.bg-ref-card,.admin-card,.admin-item',root)
      .forEach(el=>el.dataset.bgHoverable='1');
    $$('.pulse-dot,.live-dot,.brand-live-badge i,.bg-status.ok,.status-badge.ok,.status-badge.active',root)
      .forEach(el=>el.dataset.bgLive='1');
  }

  function enter(el,delay=0){
    if(reduce||!el||seen.has(el)||el.classList.contains('hidden')) return;
    seen.add(el);el.style.setProperty('--bg-delay',`${Math.min(delay,180)}ms`);el.classList.add('bg-motion-enter');
    el.addEventListener('animationend',()=>el.classList.remove('bg-motion-enter'),{once:true});
  }

  function animateNew(root=document){
    const nodes=$$('.product-panel.active > *,#genericProductsGrid > *,#featureGrid > *,#reviewsGrid > *,#tutorialsGrid > *,.member-content > *,.bg-orders-list > *,.admin-grid > *,.admin-list > *',root);
    nodes.slice(0,18).forEach((el,i)=>enter(el,i*22));
  }

  function latinDigits(str){return String(str).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d))}
  function animateCounter(el){
    if(reduce||!el||el.children.length||el.dataset.bgCounterRunning==='1')return;
    const raw=(el.textContent||'').trim();const m=raw.match(/[0-9۰-۹٠-٩][0-9۰-۹٠-٩,٬٫.]*/);if(!m)return;
    const token=m[0], normalized=latinDigits(token).replace(/[٬,]/g,'').replace('٫','.');const target=Number(normalized);if(!Number.isFinite(target)||Math.abs(target)<2)return;
    const decimals=(normalized.split('.')[1]||'').length;const fa=/[۰-۹]/.test(token);const ar=/[٠-٩]/.test(token);const locale=fa?'fa-IR':ar?'ar':'en-US';
    const prefix=raw.slice(0,m.index),suffix=raw.slice(m.index+token.length),duration=520,start=performance.now();
    el.dataset.bgCounterRunning='1';el.style.setProperty('--bg-counter-color',getComputedStyle(el).color);el.classList.add('bg-counter-active');
    const fmt=n=>prefix+new Intl.NumberFormat(locale,{minimumFractionDigits:decimals,maximumFractionDigits:decimals}).format(n)+suffix;
    const tick=now=>{const t=Math.min(1,(now-start)/duration),e=1-Math.pow(1-t,3);el.dataset.bgCounter=fmt(target*e);if(t<1)requestAnimationFrame(tick);else{el.dataset.bgCounter=raw;setTimeout(()=>{el.classList.remove('bg-counter-active');delete el.dataset.bgCounterRunning;delete el.dataset.bgCounter},80)}};requestAnimationFrame(tick);
  }
  function prepCounters(root=document){
    const sels='#quickCreditValue,#usdtRate,#trxRate,#tonRate,#starsReceive,#starsMinimum,#starsToman,#starsUsdt,#starsTrx,#starsTon,#premiumSelectedPrice,#vpnSelectionPrice,.bg-stat-grid b,.bg-profile-grid b,.selection-price strong,.hero-price strong';
    $$(sels,root).forEach(el=>{if(!el.dataset.bgCountSeen){el.dataset.bgCountSeen='1';animateCounter(el)}});
  }

  function prepProgress(root=document){
    const bars=$$('.progress-track span,.progress-bar span,[role="progressbar"] .bar,.usage-progress span',root);
    bars.forEach(bar=>{
      if(bar.dataset.bgProgress) return;bar.dataset.bgProgress='1';bar.classList.add('bg-progress-ready');
      if(reduce){bar.classList.add('bg-progress-go');return;}
      const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('bg-progress-go');io.unobserve(e.target)}}),{threshold:.3});io.observe(bar);
    });
  }

  function energyBorders(root=document){
    const candidates=[
      $('#vpnAction',root),$('.primary-price-card',root),$('.wallet-card-main',root),$('.bg-account-top',root),$('.selection-summary',root)
    ].filter(Boolean);
    candidates.forEach(el=>el.classList.add('bg-energy-border'));
  }

  function skeletonBootstrap(){
    ['vpnPlans','premiumPlans','featureGrid','genericProductsGrid'].forEach(id=>{
      const el=document.getElementById(id);if(!el||el.children.length) return;
      el.classList.add('bg-motion-skeleton');
      const stop=()=>{if(el.children.length||el.textContent.trim()){el.classList.remove('bg-motion-skeleton');obs.disconnect()}};
      const obs=new MutationObserver(stop);obs.observe(el,{childList:true,subtree:true,characterData:true});
      setTimeout(()=>{el.classList.remove('bg-motion-skeleton');obs.disconnect()},4500);
    });
  }

  function successPop(){
    const now=Date.now();if(reduce||now-successCooldown<1000)return;successCooldown=now;
    const n=document.createElement('div');n.className='bg-success-pop';n.setAttribute('aria-hidden','true');document.body.appendChild(n);setTimeout(()=>n.remove(),900);
  }

  function observeSuccess(){
    const successWords=/موفق|انجام شد|ثبت شد|پرداخت شد|success|successful/i;
    const obs=new MutationObserver(ms=>{
      for(const m of ms){for(const n of m.addedNodes){if(!(n instanceof HTMLElement))continue;const text=(n.textContent||'').trim();if(text&&text.length<240&&successWords.test(text)&&/toast|success|status|alert/i.test(`${n.className} ${n.getAttribute('role')||''}`)){successPop();return}}}
    });
    obs.observe(document.body,{subtree:true,childList:true});
  }

  function copyMorph(e){
    const btn=e.target.closest('button,[role="button"],a');if(!btn)return;
    const txt=(btn.textContent||'').trim();const aria=btn.getAttribute('aria-label')||'';
    if(!/کپی|copy/i.test(txt+' '+aria))return;
    btn.classList.add('bg-copy-ok','bg-copy-pop');
    const badge=document.createElement('span');badge.className='bg-copy-badge';badge.textContent='✓ کپی شد';btn.appendChild(badge);
    setTimeout(()=>{badge.remove();if(document.contains(btn))btn.classList.remove('bg-copy-pop');},1050);
  }

  function connectionVisual(e){
    const btn=e.target.closest('button');if(!btn)return;
    if(!/تست\s*(اتصال|کانکشن)|test\s*connection|connection\s*test/i.test((btn.textContent||'').trim()))return;
    const host=btn.closest('.admin-card,.admin-item,.card,.panel,.builder-row')||btn.parentElement;if(!host||$('.bg-connection-steps',host))return;
    const box=document.createElement('div');box.className='bg-connection-steps';box.innerHTML='<span class="active"><i></i>اتصال</span><span><i></i>احراز هویت</span><span><i></i>پاسخ پنل</span>';
    host.appendChild(box);const steps=$$('span',box);let i=0;const timer=setInterval(()=>{steps[i]?.classList.remove('active');steps[i]?.classList.add('done');i++;if(i<steps.length)steps[i].classList.add('active');else{clearInterval(timer);setTimeout(()=>box.remove(),700)}},430);
  }

  function modalObserver(){
    const obs=new MutationObserver(()=>{
      $$('dialog[open],.bg-account-drawer.open,.bg-account-popover:not(.hidden)').forEach(el=>{
        if(el.dataset.bgModalSeen)return;el.dataset.bgModalSeen='1';el.classList.add('bg-modal-enter');setTimeout(()=>{el.classList.remove('bg-modal-enter');delete el.dataset.bgModalSeen},350);
      });
    });obs.observe(document.body,{subtree:true,attributes:true,attributeFilter:['open','class']});
  }

  function setupMagnetic(){
    if(!fine||reduce)return;
    $$('.hero-primary,.sticky-cta,.purchase-cta,.btn.primary').forEach(btn=>{
      if(btn.dataset.bgMagnetic)return;btn.dataset.bgMagnetic='1';btn.classList.add('bg-magnetic');
      btn.addEventListener('pointermove',e=>{const r=btn.getBoundingClientRect();const x=(e.clientX-r.left-r.width/2)/r.width;const y=(e.clientY-r.top-r.height/2)/r.height;btn.style.transform=`translate3d(${(x*3).toFixed(2)}px,${(y*2).toFixed(2)}px,0)`});
      btn.addEventListener('pointerleave',()=>btn.style.removeProperty('transform'));
    });
  }

  function setupTilt(){
    if(!fine||reduce)return;
    $$('.product-tab,.premium-card,.generic-product-card').forEach(card=>{
      if(card.dataset.bgTilt)return;card.dataset.bgTilt='1';
      card.addEventListener('pointermove',e=>{if(card.matches(':active'))return;const r=card.getBoundingClientRect();const rx=((e.clientY-r.top)/r.height-.5)*-1.6;const ry=((e.clientX-r.left)/r.width-.5)*1.6;card.style.transform=`perspective(800px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-1px)`});
      card.addEventListener('pointerleave',()=>card.style.removeProperty('transform'));
    });
  }

  function logoIntro(){
    try{if(sessionStorage.getItem('bg-logo-intro'))return;sessionStorage.setItem('bg-logo-intro','1')}catch(_){ }
    const el=$('.brand')||$('.brand-stage');if(el)el.classList.add('bg-logo-intro');
  }

  function enhance(root=document){markHoverables(root);animateNew(root);prepCounters(root);prepProgress(root);energyBorders(root);setupMagnetic();setupTilt()}

  function boot(){
    document.documentElement.classList.add('bg-motion-ready');logoIntro();skeletonBootstrap();enhance();observeSuccess();modalObserver();
    document.addEventListener('click',copyMorph,true);document.addEventListener('click',connectionVisual,true);
    let queued=false;const mo=new MutationObserver(ms=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;const roots=ms.flatMap(m=>Array.from(m.addedNodes)).filter(n=>n instanceof HTMLElement).slice(0,8);roots.forEach(r=>enhance(r));enhance();})});
    mo.observe(document.body,{subtree:true,childList:true});
    const countMo=new MutationObserver(ms=>{for(const m of ms){const p=m.target instanceof Text?m.target.parentElement:m.target;if(p?.matches?.('#quickCreditValue,#usdtRate,#trxRate,#tonRate,#starsReceive,#starsMinimum,#starsToman,#starsUsdt,#starsTrx,#starsTon,#premiumSelectedPrice,#vpnSelectionPrice,.bg-stat-grid b,.bg-profile-grid b,.selection-price strong,.hero-price strong')){delete p.dataset.bgCountSeen;p.dataset.bgCountSeen='1';animateCounter(p)}}});
    countMo.observe(document.body,{subtree:true,childList:true,characterData:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
