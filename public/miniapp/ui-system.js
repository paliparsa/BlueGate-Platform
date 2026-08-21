/* BlueGate Mini App UI System v2.8.0 */
(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  let cleanup = null;

  function closeSheet(){
    const host = $('appSheet');
    if(!host) return;
    host.classList.remove('open');
    host.setAttribute('aria-hidden','true');
    document.documentElement.classList.remove('sheet-open');
    if(typeof cleanup === 'function') { try{ cleanup(); }catch(_){} }
    cleanup = null;
    setTimeout(() => { if(!host.classList.contains('open')) host.innerHTML=''; }, 220);
  }

  function openSheet(opts={}){
    const host = $('appSheet');
    if(!host) return null;
    if(typeof cleanup === 'function') { try{ cleanup(); }catch(_){} }
    cleanup = typeof opts.onClose === 'function' ? opts.onClose : null;
    const type = ['action','form','detail','confirm','fullscreen'].includes(opts.type) ? opts.type : 'detail';
    host.className = `app-sheet app-sheet-${type}`;
    host.innerHTML = `
      <div class="app-sheet-backdrop" data-app-sheet-close></div>
      <section class="app-sheet-panel" role="dialog" aria-modal="true" aria-label="${esc(opts.title||'')}">
        <div class="app-sheet-handle"></div>
        <header class="app-sheet-header">
          <div class="app-sheet-heading">
            ${opts.eyebrow?`<small>${esc(opts.eyebrow)}</small>`:''}
            <h3>${esc(opts.title||'')}</h3>
            ${opts.subtitle?`<p>${esc(opts.subtitle)}</p>`:''}
          </div>
          <button type="button" class="app-sheet-close" data-app-sheet-close aria-label="بستن">×</button>
        </header>
        <div class="app-sheet-body">${opts.body||''}</div>
        ${opts.footer?`<footer class="app-sheet-footer">${opts.footer}</footer>`:''}
      </section>`;
    host.setAttribute('aria-hidden','false');
    requestAnimationFrame(()=>host.classList.add('open'));
    document.documentElement.classList.add('sheet-open');
    host.querySelectorAll('[data-app-sheet-close]').forEach(el=>el.addEventListener('click', closeSheet));
    const panel=host.querySelector('.app-sheet-panel');
    if(typeof opts.onOpen === 'function') requestAnimationFrame(()=>opts.onOpen(host,panel));
    return host;
  }

  function confirmSheet(opts={}){
    return new Promise(resolve => {
      let settled=false;
      const layer=document.createElement('div');
      layer.className='app-sheet app-confirm-layer';
      layer.setAttribute('aria-hidden','false');
      layer.innerHTML=`
        <div class="app-sheet-backdrop" data-confirm-cancel></div>
        <section class="app-sheet-panel app-confirm-panel" role="alertdialog" aria-modal="true" aria-label="${esc(opts.title||'تأیید عملیات')}">
          <div class="app-sheet-handle"></div>
          <header class="app-sheet-header"><div class="app-sheet-heading">${opts.eyebrow?`<small>${esc(opts.eyebrow)}</small>`:''}<h3>${esc(opts.title||'تأیید عملیات')}</h3>${opts.subtitle?`<p>${esc(opts.subtitle)}</p>`:''}</div></header>
          <div class="app-sheet-body"><div class="unified-confirm-message">${opts.icon?`<span>${esc(opts.icon)}</span>`:''}<p>${esc(opts.message||'آیا مطمئن هستید؟')}</p></div></div>
          <footer class="app-sheet-footer"><button type="button" class="secondary" data-confirm-cancel>${esc(opts.cancelText||'لغو')}</button><button type="button" class="${opts.danger?'danger':'primary'}" data-confirm-ok>${esc(opts.confirmText||'تأیید')}</button></footer>
        </section>`;
      document.body.appendChild(layer);
      const finish=v=>{if(settled)return;settled=true;layer.classList.remove('open');setTimeout(()=>layer.remove(),180);resolve(v)};
      layer.querySelectorAll('[data-confirm-cancel]').forEach(el=>el.addEventListener('click',()=>finish(false)));
      layer.querySelector('[data-confirm-ok]')?.addEventListener('click',()=>finish(true));
      requestAnimationFrame(()=>layer.classList.add('open'));
    });
  }


  window.BlueGateUI = { openSheet, closeSheet, confirm: confirmSheet };
})();
