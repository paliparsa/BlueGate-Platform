(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const mobile=()=>window.matchMedia('(max-width: 768px)').matches;

  function closeMobileMenu(){
    $('mobileMenu')?.classList.add('hidden');
    $('mobileMenuBtn')?.setAttribute('aria-expanded','false');
  }
  function initMobileMenu(){
    const btn=$('mobileMenuBtn');
    if(btn&&!btn.hasAttribute('aria-expanded'))btn.setAttribute('aria-expanded','false');
    btn?.addEventListener('click',()=>requestAnimationFrame(()=>btn.setAttribute('aria-expanded',String(!$('mobileMenu')?.classList.contains('hidden')))));
    $('mobileMenu')?.querySelectorAll('a,button').forEach(el=>el.addEventListener('click',()=>setTimeout(closeMobileMenu,40)));
    document.addEventListener('click',e=>{
      if(!mobile()||$('mobileMenu')?.classList.contains('hidden'))return;
      if(!e.target.closest('#mobileMenu')&&!e.target.closest('#mobileMenuBtn'))closeMobileMenu();
    });
    window.addEventListener('resize',()=>{if(!mobile())closeMobileMenu()},{passive:true});
  }

  function syncComparisonCards(){
    const section=$('comparisonSection'),table=$('comparisonTable');
    if(!section||!table)return;
    let cards=section.querySelector('.mobile-comparison-cards');
    if(!cards){cards=document.createElement('div');cards.className='mobile-comparison-cards';section.appendChild(cards)}
    const rows=[...table.querySelectorAll('tr')].map(tr=>[...tr.children].map(c=>c.textContent.trim()));
    if(rows.length<2||rows[0].length<2){cards.innerHTML='';return}
    const headers=rows[0];
    cards.innerHTML=headers.slice(1).map((head,col)=>{
      const body=rows.slice(1).filter(r=>r.length>col+1).map(r=>`<div class="mobile-compare-row"><span>${escapeHtml(r[0])}</span><b>${escapeHtml(r[col+1])}</b></div>`).join('');
      return `<article class="mobile-compare-card"><h3>${escapeHtml(head)}</h3>${body}</article>`;
    }).join('');
  }
  function escapeHtml(v){return String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}

  function viewportAudit(){
    // Non-sensitive runtime marker for QA; never blocks the storefront.
    const root=document.documentElement;
    root.classList.toggle('bg-mobile',mobile());
    root.dataset.viewport=window.innerWidth<=420?'compact':(mobile()?'mobile':'desktop');
  }

  document.addEventListener('DOMContentLoaded',()=>{
    initMobileMenu();
    viewportAudit();
    syncComparisonCards();
    const table=$('comparisonTable');
    if(table)new MutationObserver(syncComparisonCards).observe(table,{childList:true,subtree:true,characterData:true});
  });
  window.addEventListener('resize',viewportAudit,{passive:true});
})();
