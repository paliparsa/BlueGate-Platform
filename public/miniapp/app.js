// BlueGate Mini App v2.8.1 — Telegram boot recovery + unified navigation
// (prepending a safe comment helps spot versions; remove only when sure)
let tg = window.Telegram?.WebApp || null;
if (tg) { try{tg.ready();tg.expand();}catch(_){} }
// Scroll safety: do not block touchmove/touchend globally.
// Telegram's WebView handles one-finger page scrolling best when touch events stay passive.
// Zoom is controlled by the viewport meta and CSS; global preventDefault breaks scrolling on some Android builds.
try { tg?.disableVerticalSwipes?.(); } catch(e) {}
function initDataFromLocation(){
  const sources=[location.search||'',(location.hash||'').replace(/^#/,'')];
  for(const raw of sources){
    try{
      const p=new URLSearchParams(raw.replace(/^\?/,''));
      const v=p.get('tgWebAppData');
      if(v) return v;
    }catch(_){}
  }
  return '';
}
let initData = String(tg?.initData || initDataFromLocation() || '');
function refreshTelegramContext(){
  tg = window.Telegram?.WebApp || tg || null;
  const fresh = String(tg?.initData || initDataFromLocation() || '');
  if(fresh) initData = fresh;
  return {tg, initData};
}
function isTelegramMiniAppContext(){
  refreshTelegramContext();
  const platform=String(tg?.platform||'').toLowerCase();
  return Boolean(initData || tg?.initDataUnsafe?.user?.id || (platform && platform !== 'unknown'));
}
async function waitForTelegramInitData(timeoutMs=4500){
  const started=Date.now();
  while(Date.now()-started < timeoutMs){
    refreshTelegramContext();
    if(initData) return initData;
    try{tg?.ready?.();}catch(_){}
    await new Promise(r=>setTimeout(r,60));
  }
  refreshTelegramContext();
  return initData;
}
function getUrlFlag(name){
  const search=new URLSearchParams(location.search||'');
  if(search.get(name)) return search.get(name);
  const hash=(location.hash||'').replace(/^#/,'');
  try{const hp=new URLSearchParams(hash); if(hp.get(name)) return hp.get(name);}catch(e){}
  return null;
}
const adminFlag = getUrlFlag('admin') || getUrlFlag('mode') || getUrlFlag('startapp') || tg?.initDataUnsafe?.start_param || '';
const isAdminMode = adminFlag === '1' || String(adminFlag).toLowerCase() === 'admin';
let state = null, adminState = null, currentTab = 'shop', currentAdminTab = 'dashboard', settingsSubTab = 'general', searchTerm = '', activeCategory = 'all', pendingEdit = null, currentOrderId = null, currentServiceOrderId = null, orderFilter = 'all', adminOrderViewMode = 'board', adminOrdersLimit = 25, lastSpinPrize = null, searchTimeout = null, shopSort = 'newest', shopFilterInStock = false, shopFilterFeatured = false, shopFilterWishlist = false, _shareUrl = '';
// Product card display mode: 'compact' (grid) or 'detailed' (list)
let productCardMode = localStorage.getItem('blue_ref_card_mode') || 'compact';

function saveAppLastState(){
  try {
    localStorage.setItem('blue_ref_last_user_tab', JSON.stringify({
      currentTab: ['shop','orders','wallet','home'].includes(currentTab) ? currentTab : 'shop',
      currentOrderId: currentOrderId || null
    }));
    localStorage.setItem('blue_ref_last_admin_tab', JSON.stringify({
      currentAdminTab: currentAdminTab || 'dashboard',
      settingsSubTab: settingsSubTab || 'general',
      adminOrderViewMode: adminOrderViewMode || 'board'
    }));
  } catch(e) {}
}
function restoreAppLastState(){
  try {
    const savedUser = JSON.parse(localStorage.getItem('blue_ref_last_user_tab') || '{}');
    if (['shop','orders','wallet','home'].includes(savedUser.currentTab)) currentTab = savedUser.currentTab;
    if (savedUser.currentOrderId) currentOrderId = savedUser.currentOrderId;
  } catch(e) {}
  try {
    const savedAdmin = JSON.parse(localStorage.getItem('blue_ref_last_admin_tab') || '{}');
    if (savedAdmin.currentAdminTab) currentAdminTab = ['dashboard','catalog','orders','more','inventory','coupons','settings','activity','roles','backups'].includes(savedAdmin.currentAdminTab) ? savedAdmin.currentAdminTab : 'dashboard';
    if (savedAdmin.settingsSubTab) settingsSubTab = savedAdmin.settingsSubTab;
    if (savedAdmin.adminOrderViewMode) adminOrderViewMode = savedAdmin.adminOrderViewMode;
  } catch(e) {}
}
restoreAppLastState();

function setProductCardMode(mode){productCardMode=mode;localStorage.setItem('blue_ref_card_mode',mode);renderShop();}
let adminUiCards = [], adminUiWallets = [], adminUiRates = [];

function detectMiniAppDevice(){
  const ua = navigator.userAgent || '';
  const platform = String(tg?.platform || '').toLowerCase();
  const isiOS = /iphone|ipad|ipod/i.test(ua) || platform === 'ios' || platform === 'iphone' || platform === 'ipad' || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /android/i.test(ua) || platform === 'android';
  const w = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  const h = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
  return {isiOS,isAndroid,w,h,compact:w<=390,phone:w<=520,tablet:w>=760,landscape:w>h};
}
function applyDeviceLayout(){
  const d = detectMiniAppDevice();
  const root = document.documentElement;
  const body = document.body;
  root.classList.toggle('device-ios', d.isiOS);
  root.classList.toggle('device-android', d.isAndroid);
  root.classList.toggle('device-other', !d.isiOS && !d.isAndroid);
  root.classList.toggle('device-compact', d.compact);
  root.classList.toggle('device-phone', d.phone);
  root.classList.toggle('device-tablet', d.tablet);
  root.classList.toggle('device-landscape', d.landscape);
  if(body){
    body.dataset.device = d.isiOS ? 'ios' : (d.isAndroid ? 'android' : 'other');
    body.style.setProperty('--app-vw', `${d.w}px`);
    body.style.setProperty('--app-vh', `${d.h}px`);
  }
}
applyDeviceLayout();
window.addEventListener('resize', applyDeviceLayout, {passive:true});
window.addEventListener('orientationchange', () => setTimeout(applyDeviceLayout, 160), {passive:true});
// Compact header: reduce topbar on scroll for better viewport space
function updateCompactHeader(){
  const tb = document.querySelector('.topbar');
  if(!tb) return;
  tb.classList.toggle('compact', window.scrollY > 48);
}
window.addEventListener('scroll', updateCompactHeader, {passive:true});
// initialize
setTimeout(updateCompactHeader, 120);

// Keyboard shortcut: '/' focuses Shop search. Admin command palette has its own desktop-only handler below.
document.addEventListener('keydown', function(e){
  const tag = (document.activeElement && document.activeElement.tagName || '').toLowerCase();
  if(tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable) return;
  if(e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey){
    const search = document.getElementById('searchInput');
    if(search && !isAdminMode){
      e.preventDefault();
      search.focus();
      search.select();
    }
  }
}, {passive:false});
function tgUser(){return tg?.initDataUnsafe?.user || {}}
function userPhotoUrl(u={}){return u.photo_url || tgUser().photo_url || ''}
function userInitial(u={}){return esc(String(u.first_name || u.username || 'B').trim().slice(0,1).toUpperCase() || 'B')}
function userProfileAvatar(u={}, cls='profile-photo'){
  const photo = userPhotoUrl(u);
  return photo ? `<div class="${cls}"><img src="${esc(photo)}" alt="profile"></div>` : `<div class="${cls} fallback">${userInitial(u)}</div>`;
}
const $ = (id) => document.getElementById(id);
const fmt = (n) => `${Number(n || 0).toLocaleString('fa-IR')} تومان`;
const nf = (n) => Number(n || 0).toLocaleString('fa-IR');
const esc = (s) => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const textBlock = (s) => esc(s || '').replace(/\n/g,'<br>');

function parseServerDate(str) {
  if (!str) return null;
  const clean = String(str).trim().replace(' ', 'T');
  let dt = new Date(clean);
  if (!isNaN(dt.getTime())) return dt;
  const parts = clean.split(/[T:\- \/]/);
  if (parts.length >= 6) {
    dt = new Date(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]);
    if (!isNaN(dt.getTime())) return dt;
  }
  return null;
}

function getOrderRemainingSeconds(o) {
  if (!o) return 0;
  if (typeof o.payment_remaining_seconds === 'number' && o.payment_remaining_seconds > 0) {
    return o.payment_remaining_seconds;
  }
  if (o.payment_expires_at) {
    const exp = parseServerDate(o.payment_expires_at);
    if (exp) {
      const rem = Math.floor((exp.getTime() - Date.now()) / 1000);
      if (rem > 0) return rem;
    }
  }
  if (o.created_at) {
    const created = parseServerDate(o.created_at);
    if (created) {
      const expTime = created.getTime() + 20 * 60 * 1000;
      const rem = Math.floor((expTime - Date.now()) / 1000);
      if (rem > 0) return rem;
    }
  }
  const st = String(o.status || '').toLowerCase();
  if (['pending_payment', 'pending', 'reviewing'].includes(st)) {
    return 20 * 60;
  }
  return 0;
}

function formatMMSS(sec) {
  if (sec <= 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

let _orderCountdownInterval = null;
function startOrderCountdownTicker() {
  if (_orderCountdownInterval) return;
  _orderCountdownInterval = setInterval(() => {
    const badges = document.querySelectorAll('[data-order-timer]');
    if (!badges.length) return;
    badges.forEach(badge => {
      const expStr = badge.dataset.expiresAt;
      let rem = 0;
      if (expStr) {
        const exp = parseServerDate(expStr);
        if (exp) rem = Math.max(0, Math.floor((exp.getTime() - Date.now()) / 1000));
      } else {
        const valEl = badge.querySelector('.timer-val');
        if (valEl) {
          const parts = valEl.textContent.trim().split(':');
          if (parts.length === 2) {
            rem = Math.max(0, (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0) - 1);
          }
        }
      }
      const valEl = badge.querySelector('.timer-val');
      if (valEl) {
        valEl.textContent = formatMMSS(rem);
        if (rem <= 300) {
          badge.classList.add('urgent');
        }
      }
      if (rem <= 0) {
        badge.classList.add('expired');
      }
    });
  }, 1000);
}
startOrderCountdownTicker();
function colorMix(c){return c || '#1d9bf0'}
// applyTheme: canonical version defined at line ~2450 (after overrides are loaded)
let _statusTimer=null;
function showStatus(text,type='success'){
  const el=$('status');
  if(!el) return;
  // icon prefix
  const icons={success:'✅',error:'❌',warning:'⚠️',info:'🔔'};
  const icon=icons[type]||icons.success;
  el.innerHTML=`<span class="toast-icon">${icon}</span><span class="toast-text">${text}</span><div class="toast-bar"></div>`;
  el.className=`toast ${type}`;
  el.classList.remove('hidden');
  // haptic
  if(type==='error')try{tg?.HapticFeedback?.notificationOccurred?.('error')}catch(e){}
  else if(type==='success')try{tg?.HapticFeedback?.notificationOccurred?.('success')}catch(e){}
  // progress bar drain animation
  const bar=el.querySelector('.toast-bar');
  if(bar){bar.style.transition='none';bar.style.width='100%';requestAnimationFrame(()=>requestAnimationFrame(()=>{bar.style.transition='width 3.4s linear';bar.style.width='0%'}));}
  clearTimeout(_statusTimer);
  _statusTimer=setTimeout(()=>el.classList.add('hidden'),3500);
}
async function api(action,payload={}){
  refreshTelegramContext();
  const body = JSON.stringify({action,initData,...payload});
  const headers = {'Content-Type':'application/json'};
  const candidateEndpoints = ['../api.php', 'api.php', '/api.php'];
  let res = null, data = null, fetchErr = null;
  for (const ep of candidateEndpoints) {
    try {
      const r = await fetch(ep, {method:'POST', headers, body, credentials:'include'});
      if (r.status !== 404) {
        res = r;
        data = await r.json().catch(()=>({}));
        break;
      }
    } catch(e) { fetchErr = e; }
  }
  if(!res || !res.ok || data?.ok===false){
    if(data?.error === 'AUTH_REQUIRED' && !initData){
      openAuthModal();
    }
    const err = new Error(data?.message || data?.error || fetchErr?.message || 'خطا در ارتباط با سرور');
    if (data) Object.assign(err, data);
    throw err;
  }
  return data;
}
/* ===== Batch 1 utilities: haptic, chime, confetti, pull-to-refresh, charts, lightbox, stepper ===== */
function haptic(t='light'){try{tg?.HapticFeedback?.impactOccurred?.(t)}catch(e){}}
function hapticNotify(t='success'){try{tg?.HapticFeedback?.notificationOccurred?.(t)}catch(e){}}
function playChime(){try{const ctx=new(window.AudioContext||window.webkitAudioContext)();[523.25,659.25,783.99].forEach((f,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.value=f;o.type='sine';const t0=ctx.currentTime+i*0.1;g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(0.12,t0+0.02);g.gain.exponentialRampToValueAtTime(0.001,t0+0.35);o.start(t0);o.stop(t0+0.4)})}catch(e){}}
function fireConfetti(){try{const c=document.createElement('canvas');c.className='confetti-canvas';c.width=innerWidth;c.height=innerHeight;c.style.cssText='position:fixed;inset:0;z-index:9999;pointer-events:none';document.body.appendChild(c);const cx=c.getContext('2d'),colors=['#1d9bf0','#22c55e','#f59e0b','#ec4899','#8b5cf6','#ef4444','#06b6d4','#fde047'];const P=[];for(let i=0;i<90;i++)P.push({x:c.width/2+(Math.random()-0.5)*80,y:c.height*0.35,vx:(Math.random()-0.5)*14,vy:Math.random()*-12-5,grav:0.35+Math.random()*0.25,sz:5+Math.random()*8,col:colors[0|Math.random()*colors.length],rot:Math.random()*6.28,vr:(Math.random()-0.5)*0.3,life:1});let fr=0;(function anim(){fr++;cx.clearRect(0,0,c.width,c.height);let alive=false;P.forEach(p=>{if(p.life<=0)return;alive=true;p.x+=p.vx;p.y+=p.vy;p.vy+=p.grav;p.vx*=0.99;p.rot+=p.vr;if(fr>90)p.life-=0.04;cx.save();cx.globalAlpha=Math.max(0,p.life);cx.translate(p.x,p.y);cx.rotate(p.rot);cx.fillStyle=p.col;cx.fillRect(-p.sz/2,-p.sz/2,p.sz,p.sz*0.6);cx.restore()});if(alive&&fr<210)requestAnimationFrame(anim);else c.remove()})()}catch(e){}}
function celebrate(){hapticNotify('success');playChime();fireConfetti()}
let lastReferralsCount=-1,lastDeliveredOrderId=null;
function checkAndCelebrate(){const u=state?.user;if(u){if(lastReferralsCount>=0&&Number(u.referrals_count)>lastReferralsCount){celebrate();showStatus('🎉 زیرمجموعه جدید اضافه شد!')}lastReferralsCount=Number(u.referrals_count)}if(currentOrderId&&currentTab==='orders'){const o=orderById(currentOrderId);if(o&&o.status==='delivered'&&lastDeliveredOrderId!==currentOrderId){lastDeliveredOrderId=currentOrderId;celebrate()}}}
function orderStepperHtml(o){const steps=[{label:'پرداخت',icon:'💳'},{label:'در بررسی',icon:'🔍'},{label:'آماده‌سازی',icon:'📦'},{label:'تحویل',icon:'✅'}];const canceled=['rejected','canceled','refunded'].includes(o.status);if(canceled)return `<div class="order-stepper canceled"><div class="stepper-cancel"><span class="step-circle cancel">✕</span><div><b>سفارش ${esc(o.status_fa||o.status)}</b><small>این سفارش کامل نشد</small></div></div></div>`;let cur=0;if(o.status==='pending_payment'||o.status==='receipt_submitted')cur=0;else if(o.status==='reviewing'||o.status==='payment_confirmed')cur=1;else if(o.status==='preparing')cur=2;else if(o.status==='delivered')cur=3;return `<div class="order-stepper">${steps.map((s,i)=>{const done=i<cur,active=i===cur;return `<div class="step ${done?'done':''} ${active?'active':''}"><div class="step-circle">${done?'✓':s.icon}</div><span class="step-label">${s.label}</span>${i<steps.length-1?`<div class="step-line ${i<cur?'done':''}"></div>`:''}</div>`}).join('')}</div>`}
/* Pull-to-refresh */
let _ptrAttached=false,_ptrStartY=0,_ptrPulling=false,_ptrDist=0,_ptrIndicator=null;
function attachPullToRefresh(){if(_ptrAttached)return;_ptrAttached=true;_ptrIndicator=document.createElement('div');_ptrIndicator.className='ptr-indicator';_ptrIndicator.innerHTML=`<div class="ptr-arc-wrapper"><svg class="ptr-arc" viewBox="0 0 40 40"><circle class="ptr-arc-bg" cx="20" cy="20" r="16"/><circle class="ptr-arc-fill" cx="20" cy="20" r="16" transform="rotate(-90 20 20)"/></svg></div><span class="ptr-label">برای رفرش بکش...</span>`;document.body.appendChild(_ptrIndicator);document.addEventListener('touchstart',e=>{// BUG-15: don't trigger PTR when any sheet/overlay is open
if(scrollY<=0&&!document.querySelector('.presentation-sheet.open,.preview-sheet.open,.cart-sheet.open,.wallet-confirm-sheet.open,.share-sheet.open')){_ptrStartY=e.touches[0].clientY;_ptrPulling=true;_ptrDist=0}},{passive:true});document.addEventListener('touchmove',e=>{if(!_ptrPulling)return;_ptrDist=Math.max(0,e.touches[0].clientY-_ptrStartY);if(_ptrDist>0&&_ptrDist<130){_ptrIndicator.style.opacity=Math.min(1,_ptrDist/70);const arcFill=_ptrIndicator.querySelector('.ptr-arc-fill');const arcWrapper=_ptrIndicator.querySelector('.ptr-arc-wrapper');if(arcFill){const progress=Math.min(1,_ptrDist/70);arcFill.style.strokeDashoffset=100.53*(1-progress)}if(arcWrapper)arcWrapper.style.transform=`rotate(${_ptrDist*2.5}deg)`;_ptrIndicator.classList.toggle('ready',_ptrDist>70);const lbl=_ptrIndicator.querySelector('.ptr-label');if(lbl)lbl.textContent=_ptrDist>70?'رها کن':'برای رفرش بکش...'}else{_ptrIndicator.style.opacity=0}},{passive:true});document.addEventListener('touchend',async()=>{if(!_ptrPulling)return;_ptrPulling=false;if(_ptrDist>70){_ptrIndicator.classList.add('loading');const arcWrapper=_ptrIndicator.querySelector('.ptr-arc-wrapper');if(arcWrapper)arcWrapper.style.animation='ptrSpin .8s linear infinite';const arcFill=_ptrIndicator.querySelector('.ptr-arc-fill');if(arcFill)arcFill.style.strokeDashoffset='20';const lbl=_ptrIndicator.querySelector('.ptr-label');if(lbl)lbl.textContent='در حال بارگذاری...';const st=Date.now();try{await reloadCurrentPage()}catch(e){}const el=Date.now()-st;setTimeout(()=>{_ptrIndicator.classList.remove('loading','ready');_ptrIndicator.style.opacity='';if(arcWrapper)arcWrapper.style.animation='';if(arcFill)arcFill.style.strokeDashoffset='100.53';if(lbl)lbl.textContent='برای رفرش بکش...'},Math.max(0,1000-el))}else{_ptrIndicator.style.opacity=''}_ptrDist=0},{passive:true})}
async function reloadCurrentPage(){if(isAdminMode){adminState=await api('admin_summary');applyTheme(adminState.settings||{});renderAdmin()}else{state=await api('me');applyTheme(state);renderUser()}}

/* v2.8.1 — single, resilient Mini App boot controller */
let _bootPromise = null;
function miniBootContext(){
  return {
    mode:isAdminMode?'admin':'user',
    telegram:Boolean(initData),
    platform:String(tg?.platform||'unknown'),
    version:'2.9.2'
  };
}
function setMiniBootState(kind, message=''){
  document.documentElement.dataset.bootState=kind;
  const app=isAdminMode?$('adminApp'):$('userApp');
  if(!app)return;
  let box=$('miniBootState');
  if(kind==='ready'){
    box?.remove();
    app.classList.remove('boot-pending','boot-failed');
    return;
  }
  app.classList.toggle('boot-pending',kind==='loading');
  app.classList.toggle('boot-failed',kind==='error');
  if(kind==='loading'){
    box?.remove();
    return;
  }
  if(!box){
    box=document.createElement('section');
    box.id='miniBootState';
    box.className='mini-boot-state';
    app.prepend(box);
  }
  {
    box.innerHTML=`<div class="mini-boot-error-icon">!</div><b>Mini App کامل بارگذاری نشد</b><span>${esc(message||'ارتباط با سرور برقرار نشد.')}</span><button type="button" class="primary" id="miniBootRetry">تلاش دوباره</button>`;
    box.querySelector('#miniBootRetry')?.addEventListener('click',()=>{_bootPromise=null;load({force:true})});
  }
}
function syncMiniAuthChrome(){
  const authBtn=$('openAuthModalBtn');
  const loggedIn=Boolean(state?.user&&!state?.is_guest&&!state?.user?.is_guest);
  if(authBtn) authBtn.classList.toggle('hidden', loggedIn);
}
async function load({force=false}={}){
  if(_bootPromise&&!force)return _bootPromise;
  _bootPromise=(async()=>{
    const ctx=miniBootContext();
    console.info('[BlueGate MiniApp boot]',ctx);
    setMiniBootState('loading');
    try{showSkeleton();}catch(_){}
    try{
      try{tg?.ready?.();tg?.expand?.();}catch(e){console.warn('[BlueGate MiniApp] Telegram ready/expand failed',e?.message||e)}
      applyDeviceLayout();
      const telegramContext=isTelegramMiniAppContext();
      if(telegramContext){
        const readyInitData=await waitForTelegramInitData();
        if(!readyInitData){
          const err=new Error('اطلاعات ورود تلگرام دریافت نشد. Mini App را کامل ببند و دوباره از داخل ربات باز کن.');
          err.error='TELEGRAM_INIT_DATA_MISSING';
          throw err;
        }
      }
      if(isAdminMode){
        if(telegramContext) await api('telegram_boot');
        adminState=await api('admin_summary');
        applyTheme(adminState.settings||{});
        $('userApp')?.classList.add('hidden');
        $('adminApp')?.classList.remove('hidden');
        renderAdmin();
        try{startAdminLivePolling();}catch(_){}
      }else{
        state=telegramContext ? await api('telegram_boot') : await api('me');
        if(telegramContext && (state?.is_guest || state?.user?.is_guest || !state?.user)){
          const err=new Error('تلگرام هویت کاربر را تأیید نکرد. Mini App را دوباره از داخل ربات باز کن.');
          err.error='TELEGRAM_SESSION_NOT_RESOLVED';
          throw err;
        }
        applyTheme(state||{});
        $('adminApp')?.classList.add('hidden');
        $('userApp')?.classList.remove('hidden');
        renderUser();
        scheduleMiniEnhancementsHydration();
        initAuthHandlers();
        updateAuthUI(state);
        syncMiniAuthChrome();
        try{checkAndCelebrate();}catch(_){}
        try{handleDeepLink();}catch(e){console.warn('[BlueGate MiniApp] deep link failed',e?.message||e)}
        try{showOnboarding();}catch(_){}
      }
      try{hideSkeleton();}catch(_){}
      setMiniBootState('ready');
      return isAdminMode?adminState:state;
    }catch(e){
      console.error('[BlueGate MiniApp boot failed]',{...ctx,code:e?.error||'',message:e?.message||String(e)});
      try{hideSkeleton();}catch(_){}
      setMiniBootState('error',e?.message||'اتصال به BlueGate برقرار نشد.');
      throw e;
    }
  })();
  try{return await _bootPromise}finally{if(document.documentElement.dataset.bootState==='error')_bootPromise=null}
}
/* Charts (SVG / CSS, no external lib) */
function last7DaysRevenue(orders){const days=[];const now=new Date();for(let i=6;i>=0;i--){const d=new Date(now);d.setDate(d.getDate()-i);const ds=d.toISOString().slice(0,10);const rev=orders.filter(o=>{const od=String(o.created_at||'').slice(0,10);return ds===od&&['payment_confirmed','preparing','delivered'].includes(o.status)}).reduce((s,o)=>s+Number(o.final_amount||0),0);days.push({date:ds,label:['ی','د','س','چ','پ','ج','ش'][d.getDay()],rev})}return days}
function sparklineHtml(data){if(!data||!data.length)return '';const max=Math.max(...data.map(d=>d.rev),1);const w=280,h=56,pad=4;const pts=data.map((d,i)=>{const x=pad+(i*(w-2*pad))/(data.length-1);const y=h-pad-(d.rev/max)*(h-2*pad);return [x,y]});const poly=pts.map(p=>p.join(',')).join(' ');const area=`${pad},${h-pad} ${poly} ${w-pad},${h-pad}`;const labels=data.map((d,i)=>`<text x="${pad+(i*(w-2*pad))/(data.length-1)}" y="${h-1}" text-anchor="middle" font-size="9" fill="#9fb0c8">${d.label}</text>`).join('');const dots=pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="var(--accent)"/>`).join('');return `<svg class="sparkline" viewBox="0 0 ${w} ${h+12}" width="100%" height="68"><polygon points="${area}" fill="color-mix(in srgb,var(--accent) 18%,transparent)" stroke="none"/><polyline points="${poly}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>${dots}${labels}</svg>`}
function barChartHtml(items){if(!items||!items.length)return '<p class="muted empty-state">داده‌ای نیست.</p>';const max=Math.max(...items.map(i=>Number(i.c||0)),1);return `<div class="bar-chart">${items.map((it,i)=>{const pct=Math.round((Number(it.c||0)/max)*100);const colors=['var(--accent)','var(--success)','var(--warning)','#8b5cf6','#ec4899'];return `<div class="bar-row"><span class="bar-label">${esc(it.name||'')}</span><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:linear-gradient(90deg,${colors[i%5]},color-mix(in srgb,${colors[i%5]} 50%,#000))"></div></div><span class="bar-value">${nf(it.c||0)}</span></div>`}).join('')}</div>`}
function pieChartHtml(orders){const methods={};orders.forEach(o=>{const m=o.payment_method||'unknown';methods[m]=(methods[m]||0)+1});const total=orders.length;if(!total)return '<p class="muted empty-state">سفارشی نیست.</p>';const labels={card:'کارت',wallet:'اعتبار BlueGate',stars:'Stars',crypto:'رمزارز',unknown:'نامشخص'};const colors={card:'#1d9bf0',wallet:'#22c55e',stars:'#f59e0b',crypto:'#8b5cf6',unknown:'#64748b'};const entries=Object.entries(methods).filter(([,c])=>c>0);let acc=0;const segs=entries.map(([k,c])=>{const pct=c/total*100;const s=acc;acc+=pct;return {k,c,pct,start:s,color:colors[k]||'#64748b'}});const grad=segs.map(s=>`${s.color} ${s.start}% ${s.start+s.pct}%`).join(', ');return `<div class="pie-wrap"><div class="pie" style="background:conic-gradient(${grad})"><div class="pie-hole"><b>${nf(total)}</b><span>سفارش</span></div></div><div class="pie-legend">${entries.map(([k,c])=>`<div class="pie-legend-row"><span class="pie-dot" style="background:${colors[k]||'#64748b'}"></span><span>${labels[k]||k}</span><b>${nf(c)}</b></div>`).join('')}</div></div>`}
/* Lightbox */
function openLightbox(url,caption=''){const lb=$('lightbox');if(!lb)return;lb.innerHTML=`<div class="lightbox-backdrop"></div><img src="${esc(url)}" alt="${esc(caption)}"><button class="lightbox-close">✕</button>${caption?`<p class="lightbox-caption">${esc(caption)}</p>`:''}`;lb.classList.add('open');lb.querySelector('.lightbox-backdrop')?.addEventListener('click',()=>closeLightbox());lb.querySelector('.lightbox-close')?.addEventListener('click',()=>closeLightbox())}
function closeLightbox(){const lb=$('lightbox');if(lb)lb.classList.remove('open')}
async function loadReceiptImage(orderId){try{haptic('light');showStatus('در حال دریافت رسید...');const r=await api('get_receipt_url',{order_id:orderId});if(r.url){openLightbox(r.url,`رسید سفارش #${nf(orderId)}`);showStatus('')}else{showStatus('رسید قابل دریافت نبود','error')}}catch(e){showStatus(e.message||'خطا در دریافت رسید','error')}}
/* Admin live counter polling */
let _adminLastTodayCount=-1;
function startAdminLivePolling(){if(!isAdminMode||currentAdminTab!=='dashboard')return;setTimeout(async()=>{if(!isAdminMode||currentAdminTab!=='dashboard')return;try{const snap=await api('admin_summary');const c=Number(snap.report?.today?.c||0);if(_adminLastTodayCount>=0&&c>_adminLastTodayCount){hapticNotify('success');playChime();const el=document.querySelector('.admin-stat-card:first-child');if(el){el.classList.add('pulse-alert');setTimeout(()=>el.classList.remove('pulse-alert'),2000)}showStatus(`🛎 سفارش جدید! (${nf(c-_adminLastTodayCount)} عدد)`)}_adminLastTodayCount=c;adminState=snap;renderAdmin()}catch(e){}finally{if(isAdminMode&&currentAdminTab==='dashboard')startAdminLivePolling()}},30000)}
/* ===== Batch 2 utilities: cart, referral tree, customer 360, CSV export ===== */
let _cart=[];try{const _savedCart=JSON.parse(localStorage.getItem('blue_ref_cart')||'[]');_cart=Array.isArray(_savedCart)?_savedCart:[]}catch(_){_cart=[];try{localStorage.removeItem('blue_ref_cart')}catch(__){}}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',updateCartFab);}else{setTimeout(updateCartFab,0);}
setTimeout(updateCartFab,300);
setTimeout(updateCartFab,1000);
function saveCart(){localStorage.setItem('blue_ref_cart',JSON.stringify(_cart));updateCartFab()}
function cartCount(){return _cart.reduce((s,i)=>s+Number(i.qty||1),0)}
function cartTotal(){return _cart.reduce((s,i)=>s+Number(i.price||0)*Number(i.qty||1),0)}
function cartAdd(pid,vid=0){const p=(state.shop_products||[]).find(x=>Number(x.id)===Number(pid));if(!p)return;const v=vid?(p.variants||[]).find(x=>Number(x.id)===Number(vid)):null;const orderPid=Number(v?.product_id||pid);const price=v?Number(v.price):Number(p.price);const name=v?`${p.name} — ${v.title}`:p.name;const ex=_cart.find(i=>Number(i.pid)===orderPid&&Number(i.vid)===Number(vid));if(ex){ex.qty++}else{_cart.push({pid:orderPid,vid:Number(vid),name,price,qty:1,img:p.image_url||''})}saveCart();haptic('light');showStatus(`🛒 «${name}» به سبد اضافه شد`);updateCartFab()}
function cartRemove(idx){_cart.splice(idx,1);saveCart();renderCartSheet()}
function cartQty(idx,delta){const it=_cart[idx];if(!it)return;it.qty=Math.max(1,Number(it.qty)+delta);saveCart();renderCartSheet()}
function cartClear(){_cart=[];saveCart();renderCartSheet()}
async function cartCheckout(){if(!_cart.length)return;if(!await BlueGateUI.confirm({title:'ثبت سبد خرید',message:`${nf(cartCount())} سفارش در یک مرحله ثبت شود؟`,confirmText:'ثبت سبد'}))return;const btn=$('cartCheckoutBtn');if(btn){btn.disabled=true;btn.textContent='در حال ثبت…'}try{const items=_cart.map(it=>({product_id:Number(it.pid),variant_id:Number(it.vid)||null,qty:Math.max(1,Number(it.qty||1))}));const r=await api('create_cart_orders',{items});state=r;_cart=[];saveCart();closeCartSheet();applyTheme(state);currentTab='orders';currentOrderId=Number(r.created_order_ids?.[0]||state.orders?.[0]?.id||0)||null;renderUser();showStatus(`✅ ${nf(r.created_order_ids?.length||0)} سفارش با موفقیت ثبت شد`,'success')}catch(e){showStatus(e.message||'ثبت سبد انجام نشد؛ هیچ سفارشی ساخته نشد.','error');if(btn){btn.disabled=false;btn.textContent=`⚡ ثبت ${nf(cartCount())} سفارش`}}}
function updateCartFab(){const fab=$('cartFab');if(!fab)return;const c=cartCount();fab.classList.toggle('hidden',c===0||isAdminMode);if(c>0&&!isAdminMode){fab.style.display='flex';}else{fab.style.display='none';}const badge=fab.querySelector('.cart-fab-badge');if(badge)badge.textContent=nf(c)}
function openCartSheet(){const s=$('cartSheet');if(!s)return;s.innerHTML=cartSheetHtml();s.classList.add('open');s.style.display='flex';haptic('light');bindCartEvents(s)}
function closeCartSheet(){const s=$('cartSheet');if(s){s.classList.remove('open');setTimeout(()=>{if(!s.classList.contains('open'))s.style.display='none';},300)}}
function bindCartEvents(s){if(!s)return;s.querySelector('#cartCloseBtn')?.addEventListener('click',closeCartSheet);s.querySelector('.cart-sheet-handle')?.addEventListener('click',closeCartSheet);s.querySelector('#cartClearBtn')?.addEventListener('click',()=>{cartClear();openCartSheet()});s.querySelector('#cartCheckoutBtn')?.addEventListener('click',cartCheckout);s.querySelectorAll('[data-cart-inc]').forEach(btn=>{btn.addEventListener('click',e=>{const idx=Number(e.currentTarget.dataset.cartInc);cartQty(idx,1);openCartSheet()})});s.querySelectorAll('[data-cart-dec]').forEach(btn=>{btn.addEventListener('click',e=>{const idx=Number(e.currentTarget.dataset.cartDec);cartQty(idx,-1);openCartSheet()})});s.querySelectorAll('[data-cart-del]').forEach(btn=>{btn.addEventListener('click',e=>{const idx=Number(e.currentTarget.dataset.cartDel);cartRemove(idx);openCartSheet()})});s.addEventListener('click',e=>{if(e.target===s)closeCartSheet()})}
function cartSheetHtml(){if(!_cart.length)return `<div class="cart-sheet-inner"><div class="cart-sheet-handle"></div><div class="cart-sheet-head"><h3>🛒 سبد خرید</h3><button class="ghost" id="cartCloseBtn">✕</button></div><p class="muted empty-state" style="padding:40px 20px;text-align:center;">سبد خرید شما خالی است. از فروشگاه محصول اضافه کنید.</p></div>`;return `<div class="cart-sheet-inner"><div class="cart-sheet-handle"></div><div class="cart-sheet-head"><h3>🛒 سبد خرید (${nf(cartCount())})</h3><button class="ghost" id="cartCloseBtn">✕</button></div><div class="cart-items">${_cart.map((it,i)=>`<div class="cart-item"><div class="cart-item-thumb">${it.img?`<img src="${esc(it.img)}" alt="">`:'<span>🛍</span>'}</div><div class="cart-item-info"><b>${esc(it.name)}</b><span class="muted" style="font-size:14px;color:var(--muted);">${fmt(it.price)} × ${nf(it.qty)}</span></div><div class="cart-item-qty"><button class="ghost" data-cart-dec="${i}">−</button><span>${nf(it.qty)}</span><button class="ghost" data-cart-inc="${i}">+</button></div><button class="ghost cart-item-del" data-cart-del="${i}">🗑</button></div>`).join('')}</div><div class="cart-sheet-foot"><div class="cart-total"><span>مجموع کل</span><b style="color:var(--cyan);font-size:17px;font-weight:900;">${fmt(cartTotal())}</b></div><div class="cart-actions"><button class="secondary" id="cartClearBtn">پاکسازی</button><button class="primary" id="cartCheckoutBtn" style="background:linear-gradient(135deg,#00f2fe,#1d9bf0);color:#000;font-weight:900;">⚡ ثبت ${nf(cartCount())} سفارش</button></div></div></div>`}
function renderCartSheet(){const s=$('cartSheet');if(s&&s.classList.contains('open'))openCartSheet()}
/* Referral tree */
async function loadReferralTree(){try{const r=await api('my_referrals');return r.referrals||[]}catch(e){return[]}}
function referralTreeHtml(refs){
  if(!refs||!refs.length)return `<article class="wallet-card referral-tree-card referral-tree-v2"><div class="referral-tree-head"><span class="admin-card-icon">👥</span><div><h3>زیرمجموعه‌های من</h3><p class="muted">اولین معرفی که انجام بشه اینجا می‌بینی.</p></div></div><div class="ref-empty-mini"><b>هنوز کسی با لینک شما ثبت‌نام نکرده</b><p class="muted">لینکت رو بفرست و اولین معرفی رو شروع کن.</p><button class="primary" id="shareInviteEmpty">اشتراک لینک دعوت</button></div></article>`;
  return `<article class="wallet-card referral-tree-card referral-tree-v2"><div class="referral-tree-head"><span class="admin-card-icon">👥</span><div><h3>زیرمجموعه‌های من</h3><p class="muted">${nf(refs.length)} مورد اخیر</p></div></div><div class="referral-tree-list referral-tree-list-v2">${refs.slice(0,8).map(r=>`<div class="referral-node"><div class="referral-node-avatar">${esc(String(r.first_name||r.username||'?').slice(0,1).toUpperCase())}</div><div class="referral-node-info"><b>${esc(r.first_name||r.username||'کاربر')}</b><span class="muted">${Number(r.orders_count||0)>0?nf(r.orders_count)+' خرید':'بدون خرید'} · ${esc(String(r.joined_at||r.created_at||'').slice(0,10))}</span></div><div class="referral-node-reward">+${fmt(r.reward_amount||0)}</div></div>`).join('')}</div></article>`}
/* Customer 360 */
async function openCustomer360(userId){try{haptic('light');const r=await api('admin_customer_view',{user_id:userId});const d=$('custDrawer');if(!d)return;const u=r.user,cs=r.customer_stats||{};const initial=esc(String(u.first_name||u.username||'?').slice(0,1).toUpperCase());d.innerHTML=`<div class="cust-drawer-inner" style="padding-top:0; overflow-x:hidden"><div class="contact-card-header"><div class="contact-card-bg"><div class="contact-card-blur">${initial}</div></div><div class="contact-card-content"><div class="cust-drawer-handle" style="background:rgba(255,255,255,0.4); margin-top:8px"></div><button class="ghost close-contact" id="custCloseBtn">✕</button><div class="contact-avatar-large">${initial}</div><h2>${esc(u.first_name||u.username||'کاربر')}</h2><p class="muted" style="margin-top:2px">ID: <code>${u.telegram_id}</code>${u.username?'<br>@'+esc(u.username):''}</p><div class="contact-actions-row">${u.username?`<div class="contact-action-btn" data-chat-user="${esc(u.username)}"><div class="ca-icon">💬</div><span>پیام</span></div>`:''}<div class="contact-action-btn" data-contact-wallet="${u.telegram_id}"><div class="ca-icon">💳</div><span>موجودی</span></div><div class="contact-action-btn danger" data-contact-ban="${u.telegram_id}"><div class="ca-icon">🚫</div><span>مسدود</span></div></div></div></div><div class="cust-stats-grid" style="margin-top:16px; padding:0 16px"><div class="cust-stat"><b>${fmt(u.balance)}</b><span>موجودی</span></div><div class="cust-stat"><b>${fmt(r.total_spent)}</b><span>کل خرید</span></div><div class="cust-stat"><b>${nf(u.referrals_count)}</b><span>زیرمجموعه</span></div><div class="cust-stat"><b>${esc(cs.tier?.emoji||'🥉')}</b><span>${esc(cs.tier?.fa||'برنز')}</span></div></div><div class="cust-section" style="padding:0 16px"><h4>🧾 سفارش‌ها (${nf(r.orders?.length||0)})</h4><div class="cust-orders">${(r.orders||[]).slice(0,8).map(o=>`<div class="cust-order-row"><div><b>#${nf(o.id)}</b> ${esc(o.display_name)}</div><span class="chip-mini chip-${o.status==='delivered'?'active':o.status==='rejected'?'off':'featured'}">${esc(o.status_fa||o.status)}</span></div>`).join('')||'<p class="muted">سفارشی نیست.</p>'}</div></div><div class="cust-section" style="padding:0 16px 20px 16px"><h4>📊 عضو از ${esc(String(u.created_at||'').slice(0,10))}</h4></div></div>`;d.classList.add('open');d.querySelector('#custCloseBtn')?.addEventListener('click',()=>closeCustomer360());d.querySelector('.cust-drawer-handle')?.addEventListener('click',()=>closeCustomer360())}catch(e){showStatus(e.message||'خطا در دریافت اطلاعات کاربر','error')}}
function closeCustomer360(){const d=$('custDrawer');if(d)d.classList.remove('open')}
/* CSV export */
function exportCsv(filename,rows){const csv=rows.map(r=>r.map(c=>{const s=String(c??'');return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}).join(',')).join('\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);haptic('light');showStatus(`📊 ${filename} دانلود شد`)}
function exportOrdersCsv(){const rows=[['#','کاربر','محصول','مبلغ نهایی','روش پرداخت','وضعیت','تاریخ']];(adminState.orders||[]).forEach(o=>rows.push([o.id,o.telegram_id,o.display_name,o.final_amount,o.payment_method_fa||o.payment_method,o.status_fa||o.status,o.created_at]));exportCsv('orders-'+new Date().toISOString().slice(0,10)+'.csv',rows)}
function exportProductsCsv(){const rows=[['#','نام','دسته','قیمت','واحد','فعال','ویژه','موجودی']];(adminState.products||[]).forEach(p=>rows.push([p.id,p.name,p.category_title||'',p.price,p.price_currency,p.is_active,p.is_featured,p.inventory_available||0]));exportCsv('products-'+new Date().toISOString().slice(0,10)+'.csv',rows)}
/* ===== Batch 3 utilities: balance counter, long-press, VIP bar, onboarding, recent, QR, light theme, badges, search, bulk, inline-edit, reorder, command palette, activity log, roles, flash sale, forecast, chat shortcut ===== */
function animateCount(el,end,duration=900){if(!el)return;const start=0;const t0=performance.now();const tick=now=>{const p=Math.min(1,(now-t0)/duration);const ease=1-Math.pow(1-p,3);el.textContent=nf(Math.round(start+(end-start)*ease));if(p<1)requestAnimationFrame(tick)};requestAnimationFrame(tick)}
function triggerBalanceAnims(){document.querySelectorAll('[data-count-anim]').forEach(el=>{if(el.dataset.counted)return;el.dataset.counted='1';animateCount(el,Number(el.dataset.countAnim||0))})}
/* Long-press: products + order rows */
let _lpTimer=null,_lpTarget=null,_lpAttached=false;
function _showOrderQuickMenu(orderId){
  const o=(state?.orders||[]).find(x=>Number(x.id)===Number(orderId));
  if(!o) return;
  haptic('medium');
  const ss=$('shareSheet'); // reuse share-sheet overlay
  if(!ss) return;
  _shareUrl=''; // not a share context
  ss.innerHTML=`<div class="share-sheet-inner"><div class="share-sheet-handle" data-close-share></div><div class="share-sheet-head"><div class="share-product-thumb" style="font-size:26px;display:grid;place-items:center">🧾</div><div class="share-product-info"><h3>سفارش #${nf(o.id)}</h3><p class="muted">${esc(o.display_name)} · ${esc(o.status_fa||o.status)}</p></div><button class="ghost" data-close-share>✕</button></div><div class="share-actions"><button class="share-btn" data-order-quick-copy="${o.id}"><span class="share-btn-icon">📋</span><div><b>کپی شناسه سفارش</b><small>#${nf(o.id)}</small></div></button>${state?.support_username?`<button class="share-btn" data-order-quick-support><span class="share-btn-icon">💬</span><div><b>تماس با پشتیبانی</b><small>@${esc(state.support_username)}</small></div></button>`:''}<button class="share-btn" data-order-open="${o.id}"><span class="share-btn-icon">📄</span><div><b>باز کردن جزئیات</b><small>مشاهده کامل سفارش</small></div></button></div></div>`;
  ss.classList.add('open');
  ss.addEventListener('click',ev=>{if(ev.target===ss)closeShareSheet();},{once:true});
}
function attachLongPress(){if(_lpAttached)return;_lpAttached=true;
  let _lpOrderTarget=null, _lpOrderTimer=null;
  document.addEventListener('touchstart',e=>{
    // product preview
    if($('previewSheet')?.classList.contains('open')) return;
    const t=e.target.closest('[data-product]');
    if(t){_lpTarget=t;_lpTimer=setTimeout(()=>{if(_lpTarget===t){_lpTarget=null;haptic('medium');showProductPreview(Number(t.dataset.product))}},550);}
    // order quick menu
    const or=e.target.closest('.order-row[data-order-open]');
    if(or){_lpOrderTarget=or;_lpOrderTimer=setTimeout(()=>{if(_lpOrderTarget===or){_lpOrderTarget=null;_showOrderQuickMenu(or.dataset.orderOpen)}},600);}
  },{passive:true});
  document.addEventListener('touchend',()=>{clearTimeout(_lpTimer);_lpTarget=null;clearTimeout(_lpOrderTimer);_lpOrderTarget=null;});
  document.addEventListener('touchmove',()=>{clearTimeout(_lpTimer);_lpTarget=null;clearTimeout(_lpOrderTimer);_lpOrderTarget=null;},{passive:true});
}
function showProductPreview(pid){
  showProduct(pid);
}
function closePreviewSheet(){const pv=$('previewSheet');if(pv){pv.classList.remove('open');pv.innerHTML=''}}
function openAdminActionSheet(type,id){
  if(type!=='order') return;
  const o=(adminState.orders||[]).find(x=>Number(x.id)===Number(id));if(!o)return;
  const body=`<div class="order-more-actions">${o.user_id?`<button data-customer-360="${o.user_id}">پروفایل کاربر</button>`:''}${o.username?`<button data-chat-user="${esc(o.username)}">ارسال پیام</button>`:''}<button data-admin-order-note="${o.id}">یادداشت داخلی</button><button data-admin-status="${o.id}:reviewing">وضعیت: در بررسی</button><button data-admin-status="${o.id}:payment_confirmed">تأیید پرداخت</button><button data-admin-status="${o.id}:preparing">آماده‌سازی</button><button data-admin-service="${o.id}">ثبت لینک سرویس</button><button data-admin-deliver="${o.id}">ثبت تحویل متنی</button>${o.receipt_file_id?`<button data-view-receipt="${o.id}">دیدن رسید</button>`:''}<button class="danger" data-admin-status="${o.id}:rejected">رد سفارش</button><button class="danger" data-admin-archive-order="${o.id}">آرشیو سفارش</button>${cleanupStatuses.includes(o.status)?`<button class="danger" data-admin-delete-order="${o.id}">حذف کامل</button>`:''}</div>`;
  BlueGateUI.openSheet({type:'action',eyebrow:`سفارش #${nf(o.id)}`,title:o.display_name||'سفارش',subtitle:o.status_fa||o.status||'',body});
}
/* VIP / loyalty progress (U8) */
function vipProgressHtml(){const u=state.user;if(!u)return '';const tier=u.customer?.tier||{};const spent=Number(u.customer?.total_spent||0);const tiers=[{name:'Bronze',fa:'برنز',emoji:'🥉',min:0},{name:'Silver',fa:'نقره',emoji:'🥈',min:1000000},{name:'Gold',fa:'طلایی',emoji:'🥇',min:5000000},{name:'Diamond',fa:'الماس',emoji:'💎',min:10000000}];let cur=0,nxt=tiers[1];for(let i=0;i<tiers.length;i++){if(spent>=tiers[i].min){cur=i;nxt=tiers[i+1]||null}}const curTier=tiers[cur];const base=curTier.min;const ceiling=nxt?nxt.min:curTier.min;const range=Math.max(1,ceiling-base);const pct=nxt?Math.min(100,Math.round((spent-base)/range*100)):100;return `<article class="wallet-card vip-card"><div class="vip-head"><span class="vip-emoji">${curTier.emoji}</span><div><h3>سطح مشتری ${curTier.fa}</h3><p class="muted">${nxt?`تا ${nxt.fa} ${nxt.emoji}: ${fmt(Math.max(0,ceiling-spent))}`:'بالاترین سطح رسیدی! 🎉'}</p></div></div><div class="vip-track"><div class="vip-fill" style="width:${pct}%"></div></div><div class="vip-tiers">${tiers.map(t=>`<span class="${t.name===curTier.name?'active':''}">${t.emoji} ${esc(t.fa)}</span>`).join('')}</div></article>`}
/* Onboarding (U10) */
function shouldShowOnboarding(){return !localStorage.getItem('blue_ref_onboarded')}
function showOnboarding(){if(!shouldShowOnboarding())return;const o=$('onboarding');if(!o)return;const slides=[{emoji:'◇',title:'خرید و مدیریت سرویس‌ها',text:'سرویس‌ها رو از فروشگاه انتخاب کن و وضعیت سفارش و تحویل رو یک‌جا ببین.'},{emoji:'↗',title:'دعوت کن و اعتبار بگیر',text:'لینک دعوتت رو بفرست؛ پاداش‌ها به اعتبار BlueGate اضافه می‌شن.'}];let idx=0;o.innerHTML=`<div class="onb-inner"><div class="onb-slides">${slides.map((s,i)=>`<div class="onb-slide ${i===0?'active':''}" data-onb-slide="${i}"><div class="onb-emoji">${s.emoji}</div><h2>${s.title}</h2><p>${s.text}</p></div>`).join('')}</div><div class="onb-dots">${slides.map((_,i)=>`<span class="onb-dot ${i===0?'active':''}" data-onb-dot="${i}"></span>`).join('')}</div><div class="onb-actions"><button class="ghost" id="onbSkip">رد کردن</button><button class="primary" id="onbNext">بعدی</button></div></div>`;o.classList.add('open');const next=$('onbNext');next?.addEventListener('click',()=>{idx++;if(idx>=slides.length){finishOnboarding();return}updateOnbSlide(idx,slides.length)});$('onbSkip')?.addEventListener('click',finishOnboarding);o.querySelectorAll('[data-onb-dot]').forEach(d=>d.addEventListener('click',()=>{idx=Number(d.dataset.onbDot);updateOnbSlide(idx,slides.length)}))}
function updateOnbSlide(i,total){document.querySelectorAll('[data-onb-slide]').forEach(s=>s.classList.toggle('active',Number(s.dataset.onbSlide)===i));document.querySelectorAll('[data-onb-dot]').forEach(d=>d.classList.toggle('active',Number(d.dataset.onbDot)===i));$('onbNext').textContent=i>=total-1?'شروع کنیم':'بعدی'}
function finishOnboarding(){localStorage.setItem('blue_ref_onboarded','1');$('onboarding')?.classList.remove('open')}
/* Recently viewed (U12) */
function pushRecent(pid){let r=JSON.parse(localStorage.getItem('blue_ref_recent')||'[]');r=r.filter(id=>Number(id)!==Number(pid));r.unshift(Number(pid));r=r.slice(0,8);localStorage.setItem('blue_ref_recent',JSON.stringify(r))}
function recentProductsHtml(){const ids=JSON.parse(localStorage.getItem('blue_ref_recent')||'[]');if(!ids.length)return '';const prods=ids.map(id=>(state.shop_products||[]).find(p=>Number(p.id)===Number(id))).filter(p=>p&&Number(p.parent_id||0)===0);if(!prods.length)return '';return sectionHtml('👁 اخیراً دیده‌شده',prods,'all',false)}
/* QR code (U13) — real QR via api.qrserver.com */
function qrCodeImg(text,size=200){const url='https://api.qrserver.com/v1/create-qr-code/?size='+size+'x'+size+'&data='+encodeURIComponent(text)+'&margin=8&qzone=2';return `<img src="${esc(url)}" alt="QR" width="${size}" height="${size}" style="display:block;width:100%;height:100%;border-radius:8px">`}
function openQrSheet(){const u=state.user;if(!u)return;const link=u.referral_link||'';if(!link){showStatus('لینک دعوت در دسترس نیست','error');return}const qs=$('qrSheet');if(!qs)return;qs.innerHTML=`<div class="qr-sheet-inner"><div class="qr-sheet-handle" data-close-qr></div><h3>📱 کد QR لینک دعوت</h3><p class="muted">دوستت این کد را با دوربین گوشی اسکن کنه تا مستقیم وارد بات بشه.</p><div class="qr-box">${qrCodeImg(link,200)}</div><div class="qr-link-box"><code>${esc(link)}</code></div><div class="actions"><button class="secondary" id="qrCopyBtn">📋 کپی لینک</button><button class="primary" id="qrCloseBtn">بستن</button></div></div>`;qs.classList.add('open');qs.querySelectorAll('[data-close-qr]').forEach(el=>el.addEventListener('click',closeQrSheet));$('qrCopyBtn')?.addEventListener('click',()=>{navigator.clipboard?.writeText(link);showStatus('لینک کپی شد')});$('qrCloseBtn')?.addEventListener('click',closeQrSheet)}
function closeQrSheet(){const qs=$('qrSheet');if(qs){qs.classList.remove('open');qs.innerHTML=''}}
function openPromoSheet(){const u=state.user;if(!u)return;const link=u.referral_link||'';if(!link){showStatus('لینک دعوت در دسترس نیست','error');return}const brand=state.brand||'BlueGate';const txt=`💙 با ${brand} هم سرویس‌هات رو مدیریت کن، هم از دعوت دوستات اعتبار بگیر!\n\n👥 با لینک من وارد ربات شو؛ فعالیتت زیرمجموعه من حساب می‌شه.\n🎁 پاداش دعوت، اعتبار BlueGate و گردونه شانس فعال است.\n\n🔗 ${link}`;const pv=$('previewSheet');if(!pv)return;pv.innerHTML=`<div class="preview-sheet-inner" style="padding-top: 20px;"><div class="preview-sheet-handle" data-close-preview></div><div style="text-align:center; margin-bottom: 16px;"><h3 style="font-size: 18px; margin-bottom: 8px;">📣 متن آماده تبلیغ شما</h3><p class="muted" style="font-size: 14.5px;">این متن را کپی کنید و برای دوستانتان یا در گروه‌ها بفرستید</p></div><div style="background: rgba(0,0,0,0.2); padding: 12px; border-radius: 12px; margin-bottom: 16px; font-size: 14.5px; line-height: 1.6; white-space: pre-wrap; user-select: text; text-align: right; border: 1px solid rgba(255,255,255,0.05);">${esc(txt)}</div><div class="actions" style="flex-direction: column; gap: 8px;"><button class="primary" id="copyPromoBtn" style="width: 100%;">📋 کپی متن تبلیغ</button><button class="ghost" data-close-preview style="width: 100%;">بستن</button></div></div>`;pv.classList.add('open');pv.querySelectorAll('[data-close-preview]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();closePreviewSheet()}));pv.addEventListener('click',function(ev){if(ev.target===pv)closePreviewSheet()});$('copyPromoBtn')?.addEventListener('click',()=>{navigator.clipboard?.writeText(txt);showStatus('متن تبلیغ کپی شد!');closePreviewSheet()})}
/* Achievement badges (U15) */
function achievementsHtml(){const a=state.achievements||[];if(!a.length)return '';const earned=a.filter(x=>x.earned).length;return `<article class="wallet-card achievements-card"><div class="achievements-head"><span class="admin-card-icon">🏆</span><div><h3>دستاوردها</h3><p class="muted">${nf(earned)} از ${nf(a.length)} باز شده</p></div></div><div class="badges-grid">${a.map(x=>`<div class="badge-cell ${x.earned?'earned':'locked'}" title="${esc(x.title)}"><span class="badge-emoji">${x.earned?x.emoji:'🔒'}</span><small>${esc(x.title)}</small></div>`).join('')}</div></article>`}
/* Advanced order search (A2) */
let adminOrderSearch='',adminOrderStatusFilter='all',selectedOrderIds=new Set();
async function adminSearchOrdersNow(){try{const r=await api('admin_search_orders',{search:adminOrderSearch,status:adminOrderStatusFilter});adminState.orders=r.orders||[];renderAdmin()}catch(e){showStatus(e.message,'error')}}
/* Bulk actions (A3) */
async function bulkOrderAction(action){if(!selectedOrderIds.size){showStatus('حداقل یک سفارش انتخاب کن','error');return}const ids=[...selectedOrderIds];if(!await BlueGateUI.confirm({title:'تغییر گروهی وضعیت',message:`${nf(ids.length)} سفارش به «${action==='payment_confirmed'?'تایید پرداخت':action==='rejected'?'رد':action}» تغییر وضعیت دهند؟`,confirmText:'اعمال تغییر'}))return;for(const id of ids){try{await api('admin_order_status',{order_id:id,status:action})}catch(e){}}selectedOrderIds.clear();await loadAdmin();showStatus(`${nf(ids.length)} سفارش تغییر کرد`)}
/* Inline edit (A4) */
function inlineEditProduct(id,field){const p=(adminState.products||[]).find(x=>Number(x.id)===Number(id));if(!p)return;const cur=p[field];const label={name:'نام',price:'قیمت',short_description:'توضیح کوتاه'}[field]||field;openDialog(`ویرایش ${label}`,`مقدار جدید برای ${esc(p.name)}:`,cur,async(txt)=>{await adminAction('admin_update_product',{product_id:id,[field]:txt})},String(cur||''))}
/* Reorder (A7) — up/down buttons */
async function reorderItem(type,id,direction){const list=type==='product'?(adminState.products||[]):(adminState.categories||[]);const ids=list.map(x=>Number(x.id));const idx=ids.indexOf(Number(id));if(idx<0)return;const swapIdx=direction==='up'?idx-1:idx+1;if(swapIdx<0||swapIdx>=ids.length)return;[ids[idx],ids[swapIdx]]=[ids[swapIdx],ids[idx]];const action=type==='product'?'admin_reorder_products':'admin_reorder_categories';try{haptic('light');await api(action,{ordered_ids:ids});showStatus('ترتیب ذخیره شد');await loadAdmin()}catch(e){showStatus(e.message,'error')}}
/* Command palette (A13) */
function canUseCommandPalette(){
  const adminVisible=isAdminMode && !$('adminApp')?.classList.contains('hidden');
  return Boolean(adminVisible && window.innerWidth>=760 && window.matchMedia('(pointer:fine)').matches);
}
function openCommandPalette(){
  const cp=$('cmdPalette');
  if(!cp || !canUseCommandPalette()) return;
  const cmds=[{label:'داشبورد',icon:'📊',action:()=>setAdminTab('dashboard')},{label:'کاتالوگ',icon:'🧭',action:()=>setAdminTab('catalog')},{label:'سفارش‌ها',icon:'🧾',action:()=>setAdminTab('orders')},{label:'کدهای تخفیف',icon:'🎟',action:()=>setAdminTab('coupons')},{label:'انبار',icon:'📦',action:()=>setAdminTab('inventory')},{label:'تنظیمات',icon:'⚙️',action:()=>setAdminTab('settings')},{label:'بکاپ',icon:'💾',action:()=>setAdminTab('backups')},{label:'لاگ فعالیت',icon:'📜',action:()=>setAdminTab('activity')},{label:'نقش‌های ادمین',icon:'👥',action:()=>setAdminTab('roles')},{label:'دانلود CSV سفارش‌ها',icon:'📥',action:()=>exportOrdersCsv()},{label:'دانلود CSV کاتالوگ',icon:'📥',action:()=>exportProductsCsv()}];
  const q=(cp.querySelector('#cmdInput')?.value||'').toLowerCase();
  const filtered=cmds.filter(c=>c.label.toLowerCase().includes(q));
  cp.querySelector('#cmdList').innerHTML=filtered.length?filtered.map((c,i)=>`<button class="cmd-item" data-cmd-idx="${i}"><span>${c.icon}</span><b>${c.label}</b></button>`).join(''):'<p class="muted" style="padding:14px;text-align:center">موردی پیدا نشد.</p>';
  cp._cmds=filtered;
  cp.hidden=false;
  cp.setAttribute('aria-hidden','false');
  cp.classList.add('open');
  setTimeout(()=>cp.querySelector('#cmdInput')?.focus(),50);
}
function closeCommandPalette(){
  const cp=$('cmdPalette');
  if(!cp) return;
  cp.classList.remove('open');
  cp.setAttribute('aria-hidden','true');
  cp.hidden=true;
}
/* Flash sale functions removed for Phase 1 */
/* Chat shortcut (A16) */
function openUserChat(username){if(username){try{Telegram?.WebApp?.openTelegramLink?.('https://t.me/'+username)}catch(e){location.href='https://t.me/'+username}}else{showStatus('این کاربر یوزرنیم ندارد','error')}}
function openDialog(title,text,placeholder,onSubmit,initial='',showFile=false){
  openEdit(title, [{
    title: text || '',
    fields: [
      {
        id: 'dialog_inp_val',
        label: placeholder || title,
        type: 'textarea',
        placeholder: placeholder || '',
        value: initial || ''
      },
      ...(showFile ? [{
        html: `<div style="margin-top:8px;"><label style="display:block;font-size:14px;color:var(--muted);margin-bottom:4px;">انتخاب تصویر (اختیاری):</label><input type="file" id="dialog_file_val" accept="image/*" style="width:100%;"></div>`
      }] : [])
    ]
  }], async () => {
    const txt = val('dialog_inp_val');
    const fileEl = document.getElementById('dialog_file_val');
    let b64 = null;
    if (fileEl && fileEl.files && fileEl.files[0]) {
      b64 = await new Promise((resolve) => {
        const r = new FileReader();
        r.onload = (e) => resolve(e.target.result);
        r.readAsDataURL(fileEl.files[0]);
      });
    }
    await onSubmit(txt, b64);
  });
}
function closeEdit(){BlueGateUI?.closeSheet?.();pendingEdit=null}
function openEdit(title,inputFields,onSubmit){pendingEdit=onSubmit;let sections=[];if(inputFields.length>0&&typeof inputFields[0]==='string'){sections=[{title:'',fields:inputFields.map(html=>({html}))}]}else{sections=inputFields}let body='';sections.forEach(sec=>{if(sec.title)body+=`<div class="presentation-section-title">${sec.title}</div>`;body+=`<div class="form-grid">`;sec.fields.forEach(f=>{if(f.html)body+=f.html;else if(f.type==='checkbox')body+=`<label class="switch-line"><span>${f.label}</span><input id="${f.id}" type="checkbox" ${f.value?'checked':''}></label>`;else if(f.type==='select')body+=`<label><span>${f.label}</span><select id="${f.id}">${f.options}</select></label>`;else if(f.type==='textarea')body+=`<label class="full"><span>${f.label}</span><textarea id="${f.id}" placeholder="${f.placeholder||f.label}">${esc(f.value||'')}</textarea></label>`;else body+=`<label><span>${f.label}</span><input id="${f.id}" type="${f.type||'text'}" value="${esc(f.value||'')}" placeholder="${f.placeholder||f.label}" ${f.props||''}></label>`});body+=`</div>`});return BlueGateUI.openSheet({type:'form',eyebrow:'BLUEGATE',title,body,footer:`<button type="button" class="secondary" data-edit-cancel>لغو</button><button type="button" class="primary" id="presentationSaveBtn">ذخیره</button>`,onClose:()=>{pendingEdit=null},onOpen:(host)=>{host.querySelector('[data-edit-cancel]')?.addEventListener('click',closeEdit);host.querySelectorAll('input[type="checkbox"]').forEach(el=>el.addEventListener('change',()=>haptic?.('light')));const saveBtn=host.querySelector('#presentationSaveBtn');saveBtn?.addEventListener('click',async(e)=>{if(!pendingEdit)return;e.preventDefault();haptic?.('medium');saveBtn.disabled=true;saveBtn.textContent='...';try{await pendingEdit();closeEdit()}catch(err){showStatus(err.message||'خطا','error');saveBtn.disabled=false;saveBtn.textContent='ذخیره'}})}})}
function val(id){const el=$(id);return el?.type==='checkbox'?el.checked:el?.value}
function timeline(t=[]){return t?.length?`<div class="timeline">${t.map(e=>`<div><b>${esc(e.title)}</b><small>${esc(e.created_at||'')}</small></div>`).join('')}</div>`:''}
const cleanupStatuses=['rejected','canceled','refunded'];
function canHideOrder(o){return cleanupStatuses.includes(String(o?.status||''))}
function statusClass(status){return ({delivered:'success',payment_confirmed:'success',preparing:'warning',receipt_submitted:'warning',reviewing:'warning',pending_payment:'pending',rejected:'danger',canceled:'danger',refunded:'danger'}[status]||'pending')}
function orderStatusBadge(o){return `<span class="status-badge ${statusClass(o.status)}">${esc(o.status_fa||o.status)}</span>`}
function orderById(id){return (state.orders||[]).find(o=>Number(o.id)===Number(id))}
function cryptoRateCacheText(){const c=state?.payment_methods?.crypto?.rate_cache||adminState?.settings?.crypto_rate_cache||{};const rows=Object.entries(c||{});const last=adminState?.settings?.crypto_rate_last_result||{};let out=[];if(rows.length){out=rows.map(([k,v])=>{const r=typeof v==='object'?v.rate:v;const at=typeof v==='object'?(v.updated_at||''):'';const src=typeof v==='object'?(v.source||v.provider||'cache'):'cache';return `${k}: ${Number(r||0).toLocaleString('fa-IR')} تومان · ${src}${at?' · '+at:''}`})}else out.push('هنوز cache نرخ نداریم.');if(last?.providers?.length)out.push('Providerها: '+last.providers.join(' → '));if(last?.failed&&Object.keys(last.failed).length)out.push('خطا/ fallback: '+Object.entries(last.failed).map(([k,v])=>`${k}:${v}`).join('، '));return out.join('\n')}
async function refreshCurrentOrderSilently(){if(currentTab!=='orders'||!currentOrderId)return;try{state=await api('me');applyTheme(state);renderOrders()}catch(e){console.warn('order refresh failed',e)}}

function cardImage(obj, emoji='🛒'){
  if(!obj || !obj.image_url) return `<div class="tile-placeholder">${emoji}</div>`;
  const url=esc(obj.image_url);
  // support optional responsive srcset if provided by API
  const srcset = obj.image_srcset?` srcset="${esc(obj.image_srcset)}"` : '';
  return `<img src="${url}" loading="lazy" decoding="async"${srcset} alt="${esc(obj.name||'product')}">`;
}
function priceLabel(p){
  if (!p || typeof p !== 'object') return esc(fmt(p));
  const discountedVariants = (p.variants || []).filter(v => Number(v.discount_percent) > 0);
  const bestV = discountedVariants.sort((a, b) => Number(b.discount_percent) - Number(a.discount_percent))[0];
  if (bestV) {
    const salePrice = Number(bestV.price);
    const d = Number(bestV.discount_percent);
    const origPrice = (bestV.old_price && Number(bestV.old_price) > salePrice) ? Number(bestV.old_price) : Math.round(salePrice / (1 - d / 100));
    const vLabel = `<span class="variant-tag">${esc(bestV.title)}</span>`;
    if (origPrice > salePrice) {
      return `<s class="muted-strike">${fmt(origPrice)}</s> <span style="font-weight:900;color:#ffffff;">${fmt(salePrice)}</span> ${vLabel}`;
    }
    return `<span style="font-weight:900;color:#ffffff;">${fmt(salePrice)}</span> ${vLabel}`;
  }
  const d = Number(p.discount_percent || p.variant_discount_percent || 0);
  if (d > 0 && Number(p.price) > 0) {
    const salePrice = Number(p.price);
    const origPrice = (p.old_price && Number(p.old_price) > salePrice) ? Number(p.old_price) : Math.round(salePrice / (1 - d / 100));
    if (origPrice > salePrice) {
      return `<s class="muted-strike">${fmt(origPrice)}</s> <span style="font-weight:900;color:#ffffff;">${fmt(salePrice)}</span>`;
    }
  }
  return esc(p.price_label || fmt(p.price));
}
function productMinPriceNumber(p){
  const variantPrices=(p?.variants||[]).map(v=>Number(v.price||0)).filter(n=>n>0);
  if(variantPrices.length) return Math.min(...variantPrices);
  const direct=Number(p?.price||0);
  return direct>0?direct:0;
}
function productCardPriceLine(p){
  const discount=productDiscountInfo(p);
  if(discount?.kind==='variant'&&discount.variantId){
    const v=(p?.variants||[]).find(x=>Number(x.id)===Number(discount.variantId));
    const sale=Number(v?.price||0);
    if(sale>0) return `<span>از</span><strong>${fmt(sale)}</strong><em>تومان</em>`;
  }
  const directDiscount=Number(p?.discount_percent||0)>0&&Number(p?.price||0)>0?Number(p.price):0;
  if(directDiscount>0) return `<span>از</span><strong>${fmt(directDiscount)}</strong><em>تومان</em>`;
  const min=productMinPriceNumber(p);
  if(min>0) return `<span>از</span><strong>${fmt(min)}</strong><em>تومان</em>`;
  const raw=String(p?.price_label||'مشاهده پلن‌ها').trim();
  return `<strong>${esc(raw)}</strong>`;
}
function productCardDiscountNoteText(p){
  const d=productDiscountInfo(p);
  if(!d) return '';
  return d.kind==='variant' && d.title ? `${nf(d.percent)}٪ تخفیف روی ${esc(d.title)}` : `${nf(d.percent)}٪ تخفیف`;
}

function priceCurrencyOptions(selected='IRT'){selected=String(selected||'IRT').toUpperCase();return `<option value="IRT" ${selected!=='USD'?'selected':''}>تومان</option><option value="USD" ${selected==='USD'?'selected':''}>دلار / USDT</option>`}
function priceAdminFields(prefix,item={}){const c=String(item.price_currency||'IRT').toUpperCase();const usd=item.price_usd||'';const toman=item.price||'';return `<div class="price-editor full"><div class="price-editor-head"><span>💸</span><div><b>نوع قیمت‌گذاری</b><small>تومان ثابت یا دلار با تبدیل خودکار به تومان</small></div></div><div class="price-editor-grid"><label><span>واحد قیمت</span><select id="${prefix}_currency">${priceCurrencyOptions(c)}</select></label><label><span>قیمت تومان</span><input id="${prefix}_price" value="${esc(toman)}" inputmode="numeric" placeholder="مثلاً 2199000"></label><label><span>قیمت دلار</span><input id="${prefix}_price_usd" value="${esc(usd)}" inputmode="decimal" placeholder="مثلاً 19.99"></label><p class="muted full">اگر دلار انتخاب شود، کاربر فقط قیمت تومانی لحظه‌ای را می‌بیند؛ مبلغ دلاری فقط هنگام پرداخت رمزارز/ارزی نمایش داده می‌شود.</p></div></div>`}
function priceAdminSummary(obj={}){const m=obj.price_meta||{};if((obj.price_currency||m.currency)==='USD'){return `قیمت دلاری: ${nf(obj.price_usd||m.usd||0)}$ → ${fmt(obj.price||m.toman||0)} ${m.rate_source?`· نرخ ${esc(m.rate_source)}`:''}`}return `قیمت تومانی: ${fmt(obj.price||0)}`}
function orderUsdHint(o){
  const cur = String(o.price_currency || o.currency || 'IRT').toUpperCase();
  if (['USD', 'USDT', 'TRX', 'TON', 'STARS'].includes(cur)) {
    if (cur === 'USD' || cur === 'USDT') {
      return Number(o.price_usd || 0) > 0 ? `<p class="muted usd-only-hint">مبنای دلاری این سفارش: $${nf(o.price_usd)} USDT · نرخ تبدیل: ${o.usd_rate_toman ? nf(o.usd_rate_toman) + ' تومان' : ''}</p>` : '';
    }
    if (cur === 'TRX') {
      return Number(o.price_crypto || 0) > 0 ? `<p class="muted usd-only-hint">مبنای ترون این سفارش: ${nf(o.price_crypto)} TRX · نرخ تبدیل: ${o.usd_rate_toman ? nf(o.usd_rate_toman) + ' تومان' : ''}</p>` : '';
    }
    if (cur === 'TON') {
      return Number(o.price_crypto || 0) > 0 ? `<p class="muted usd-only-hint">مبنای تون این سفارش: ${nf(o.price_crypto)} TON · نرخ تبدیل: ${o.usd_rate_toman ? nf(o.usd_rate_toman) + ' تومان' : ''}</p>` : '';
    }
  }
  return '';
}

function openWalletConfirmSheet(orderId){
  const o = orderById(orderId);
  if(!o) return;
  const bal = Number(state.user?.balance||0);
  const supportUser = state.support_username || '';
  
  let sheet = $('walletConfirmSheet');
  if(!sheet){
    sheet = document.createElement('div');
    sheet.id = 'walletConfirmSheet';
    sheet.className = 'wallet-confirm-sheet';
    document.body.appendChild(sheet);
  }
  
  sheet.innerHTML = `
    <div class="wallet-confirm-card">
      <div style="text-align:center;margin-bottom:12px">
        <div style="font-size:42px;margin-bottom:4px">💰</div>
        <h3 style="font-size:18px;font-weight:900;color:var(--text);margin-bottom:6px">کسر از موجودی اعتبار BlueGate</h3>
        <p class="muted" style="font-size:14.5px;line-height:1.6;margin-bottom:14px">
          آیا از پرداخت سفارش <b>#${nf(o.id)}</b> به مبلغ <b>${fmt(o.final_amount)}</b> اطمینان دارید؟<br>
          موجودی قابل پرداخت شما: <b style="color:#4ade80;font-size:15px">${fmt(bal)}</b>
        </p>
      </div>
      <div style="background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.3);padding:12px;border-radius:16px;font-size:14px;color:#fde68a;line-height:1.6;margin-bottom:18px;text-align:right">
        ⚠️ <b>توجه مهم:</b> موجودی کسرشده تنها در صورت لغو سفارش به اعتبار BlueGate شما بازگردانده می‌شود.
        ${supportUser ? `<br>💬 قبل از تایید، حتماً موجودی محصول را با پشتیبانی <a href="https://t.me/${esc(supportUser)}" target="_blank" style="color:#60a5fa;text-decoration:underline">@${esc(supportUser)}</a> چک کنید.` : ''}
      </div>
      <div style="display:flex;gap:10px">
        <button class="primary" id="doWalletPayBtn" style="flex:1;padding:12px;font-size:14px;border-radius:14px">تایید و کسر از موجودی</button>
        <button class="ghost" id="cancelWalletPaySheet" style="flex:1;padding:12px;font-size:14px;border-radius:14px">انصراف</button>
      </div>
    </div>
  `;
  
  sheet.classList.add('open');
  
  const closeSheet = () => {
    sheet.classList.remove('open');
  };
  
  sheet.querySelector('#doWalletPayBtn')?.addEventListener('click', async(e) => {
    e.preventDefault();
    closeSheet();
    await loadAfterAction('apply_wallet',{order_id:orderId});
    currentTab='orders';
    currentOrderId=orderId;
    renderUser();
    showStatus('پرداخت از اعتبار BlueGate با موفقیت انجام شد');
  });
  
  sheet.querySelector('#cancelWalletPaySheet')?.addEventListener('click', closeSheet);
  sheet.addEventListener('click', (e) => {
    if(e.target === sheet) closeSheet();
  });
}

function paymentMethodsHtml(o){
  const methods=state.payment_methods||{wallet:{enabled:true},card:{enabled:true,accounts:[],instructions:state.payment_instructions||''},stars:{enabled:false,rate_toman:3200},crypto:{enabled:false,wallets:[],markup_percent:1}};
  const st = String(o.status || '').toLowerCase();
  if(!['pending_payment','pending','rejected'].includes(st)||Number(o.final_amount||0)<=0)return '';
  const bal=Number(state.user?.balance||0);
  const supportUser = state.support_username || '';
  const supportWarningHtml = `
    <div class="support-warning-box">
      <div class="support-warning-head">⚠️ استعلام موجودی و تایید سفارش از پشتیبانی</div>
      <div class="support-warning-text">
        قبل از انجام هرگونه پرداخت (کارت به کارت، اعتبار BlueGate، کریپتو)، حتماً از طریق پشتیبانی موجودی و امکان تحویل فوری محصول را استعلام و تایید کنید.
      </div>
      ${supportUser ? `<a class="support-contact-btn" href="https://t.me/${esc(supportUser)}" target="_blank">💬 استعلام مستقیم از پشتیبانی (@${esc(supportUser)})</a>` : ''}
    </div>
  `;

  const remSec = getOrderRemainingSeconds(o);
  const isPending = ['pending_payment','pending'].includes(st);
  if (isPending && remSec <= 0) {
    return `<article class="payment-box">
      <div class="order-expired-card">
        <div class="expired-icon">⚠️</div>
        <div class="expired-content">
          <h4>مهلت پرداخت این سفارش به پایان رسیده است</h4>
          <p>زمان مجاز برای تکمیل پرداخت ۲۰ دقیقه بود که به اتمام رسید. برای ادامه می‌توانید سفارش جدیدی ثبت کنید.</p>
        </div>
        <button class="primary btn-reorder" data-reorder-product="${o.product_id || ''}">🔄 سفارش مجدد / رفرش</button>
      </div>
    </article>`;
  }

  const timerBadgeHtml = (isPending && remSec > 0) ? `
    <div class="payment-countdown-badge" data-order-timer="${o.id}" data-expires-at="${esc(o.payment_expires_at || '')}">
      <span class="timer-icon">⏳</span>
      <span class="timer-label">مهلت پرداخت:</span>
      <b class="timer-val">${formatMMSS(remSec)}</b>
    </div>
  ` : '';

  let html=`<article class="payment-box">
    ${timerBadgeHtml}
    ${supportWarningHtml}
    <div class="section-title compact">
      <h3>💳 روش پرداخت</h3>
      <span class="badge">${esc(o.payment_method_fa||'انتخاب نشده')}</span>
    </div>`;

  // 1. Selector Buttons Grid (Shown when method is NOT chosen yet)
  if(!o.payment_method || o.payment_method === 'none'){
    html+=`<p class="muted" style="margin-bottom:10px">یکی از روش‌های زیر را برای پرداخت انتخاب کن:</p><div class="payment-grid">`;
    if(methods.wallet?.enabled) html+=`<button class="pay-method success" data-wallet-order="${o.id}"><b>💳 اعتبار BlueGate</b><span>موجودی: ${fmt(bal)}</span></button>`;
    if(methods.card?.enabled) html+=`<button class="pay-method" data-select-card="${o.id}"><b>💳 کارت به کارت</b><span>پرداخت دستی با رسید</span></button>`;
    if(methods.stars?.enabled) html+=`<button class="pay-method warning" data-pay-stars="${o.id}"><b>⭐ Telegram Stars</b><span>${nf(Math.max(1,Math.ceil(Number(o.final_amount||0)/Number(methods.stars?.rate_toman||3200))))} استار</span></button>`;
    if(methods.crypto?.enabled) html+=`<button class="pay-method crypto" data-select-crypto-tab="${o.id}"><b>🪙 رمزارز</b><span>USDT / TRX / TON با TXID</span></button>`;
    if(!methods.wallet?.enabled && !methods.card?.enabled && !methods.stars?.enabled && !methods.crypto?.enabled) html+=`<p class="muted empty-state">فعلاً هیچ روش پرداختی فعال نیست. لطفاً به پشتیبانی پیام بده.</p>`;
    html+=`</div>`;
  }

  // 2. Card Payment Panel (Shown ONLY when o.payment_method === 'card')
  if(o.payment_method === 'card' && methods.card?.enabled){
    let cardAccounts = methods.card?.accounts || [];
    if(!cardAccounts.length && state.settings?.card_accounts_text){
      cardAccounts = parsePipeLines(state.settings.card_accounts_text, ['title','card','owner','sheba']);
    }
    if(!cardAccounts.length && state.card_accounts_text){
      cardAccounts = parsePipeLines(state.card_accounts_text, ['title','card','owner','sheba']);
    }
    if(!cardAccounts.length && (state.payment_instructions || methods.card?.instructions)){
      const txt = String(methods.card?.instructions || state.payment_instructions || '');
      const m = txt.match(/\d{16}/);
      if(m) cardAccounts = [{title:'کارت بانکی سفارشات', card: m[0], owner:'پشتیبانی', sheba:''}];
    }
    if(!cardAccounts.length) cardAccounts = [{title:'کارت بانکی', card:'6037997412345678', owner:'پشتیبانی فروشگاه', sheba:''}];

    html+=`<div class="card-v2-container">
      ${timerBadgeHtml}
      <div class="card-v2-topbar">
        <button type="button" class="card-v2-reset-btn" data-reset-payment-method="${o.id}">
          <span>🔄</span> تغییر روش
        </button>

        <div class="card-v2-title">
          <span class="card-v2-title-text">اطلاعات شماره کارت</span>
          <span class="card-v2-card-icon">💳</span>
        </div>
      </div>`+cardAccounts.map(c=>{
        const rawCard = String(c.card||'').replace(/\D/g,'');
        const formattedCard = rawCard.length===16 ? rawCard.match(/.{1,4}/g).join('  -  ') : esc(c.card||'');
        const rawSheba = String(c.sheba||'').trim();
        return `<div class="card-v2-bank-card">
          <div class="card-v2-card-head">
            <span class="card-v2-card-label">${esc(c.title||'کارت اصلی فروشگاه')}</span>
            <span style="font-size:22px">💳</span>
          </div>
          <code class="card-v2-card-number">${formattedCard}</code>
          <div class="card-v2-owner-info">صاحب حساب: <b>${esc(c.owner||'نامشخص')}</b></div>
          ${rawSheba ? `<div class="card-v2-sheba-info">شماره شبا: <b>${esc(rawSheba)}</b></div>` : ''}
          <button type="button" class="card-v2-copy-btn" data-copy="${esc(c.card||'')}">📋 کپی شماره کارت</button>
        </div>`;
      }).join('')+`

      <div class="card-v2-form-section">
        <div class="card-v2-form-group">
          <label class="card-v2-label-title">توضیحات / شماره پیگیری / ۴ رقم کارت</label>
          <input type="text" id="cardReceiptNote_${o.id}" class="card-v2-input" value="${esc(o.customer_note||'')}" placeholder="مثلاً: واریز از کارت علی محمودی کد ۱۲۳۴" autocomplete="off">
        </div>

        <div class="card-v2-form-group">
          <label class="card-v2-label-title">تصویر رسید (اختیاری)</label>
          <div class="card-v2-upload-box" onclick="document.getElementById('cardReceiptFile_${o.id}').click()">
            <input type="file" id="cardReceiptFile_${o.id}" accept="image/*" style="display:none;" onchange="handleCardReceiptFileChange(this, ${o.id})">
            <div id="cardReceiptFilePreview_${o.id}" class="card-v2-upload-inner">
              ${o.payment_receipt_url ? `
                <div class="receipt-file-selected">
                  <img src="${esc(o.payment_receipt_url)}" alt="رسید" class="receipt-file-img">
                  <div class="receipt-file-info">
                    <b>رسید ارسال شده</b>
                    <small>برای تغییر، تصویر جدید انتخاب کنید</small>
                  </div>
                </div>
              ` : `
                <span class="upload-icon">🖼️</span>
                <span class="upload-text">انتخاب یا درگ تصویر رسید پرداخت...</span>
              `}
            </div>
          </div>
        </div>

        <button type="button" class="card-v2-submit-btn" data-submit-inline-card-receipt="${o.id}">
          📥 ثبت رسید و تایید پرداخت
        </button>

        ${(o.payment_receipt_url || o.customer_note) ? `<p class="crypto-v2-status success">✅ رسید پرداخت ثبت شد و در صف تایید ادمین قرار دارد.</p>` : ''}
      </div>
    </div>`;
  }

  // 3. Crypto Payment Panel (Shown ONLY when o.payment_method === 'crypto')
  const cryptoWallets=methods.crypto?.wallets||[];
  const cryptoCheck=o.crypto_check||null;
  if(o.payment_method === 'crypto' && methods.crypto?.enabled){
    html+=`<div class="crypto-v2-container">
      ${timerBadgeHtml}
      <div class="crypto-v2-topbar">
        <button type="button" class="crypto-v2-reset-btn" data-reset-payment-method="${o.id}">
          <span>🔄</span> تغییر روش
        </button>

        <div class="crypto-v2-title">
          <span class="crypto-v2-title-text">پرداخت رمزارز (Crypto)</span>
          <span class="crypto-v2-coin-icon">🪙</span>
        </div>
      </div>`;

    if(!cryptoCheck){
      html+=`<p class="crypto-v2-subtitle">کیف پول شبکه مورد نظر خود را برای پرداخت انتخاب کنید:</p>
      <div class="crypto-v2-wallet-list">`+cryptoWallets.map(w=>{
        const asset = esc(w.asset || w.rate_symbol || 'USDT');
        const network = esc(w.network || 'TRC20');
        const rate = Number(w.rate_toman || 0);
        const title = esc(w.title || (asset + ' ' + network));
        return `<div class="crypto-v2-wallet-card" data-select-crypto="${o.id}:${w.id}">
          <div class="crypto-v2-wallet-left">
            <span class="crypto-v2-rate-pill">${rate ? `۱ ${asset} = ${nf(rate)} تومان` : 'نرخ دستی'}</span>
          </div>
          <div class="crypto-v2-wallet-right">
            <div class="crypto-v2-wallet-text">
              <b class="crypto-v2-wallet-name">${title}</b>
              <span class="crypto-v2-wallet-network">${network}</span>
            </div>
            <div class="crypto-v2-coin-badge">🪙</div>
          </div>
        </div>`;
      }).join('')+`</div>`;
    } else {
      const assetStr = esc(cryptoCheck.asset || 'USDT');
      const amountText = Number(cryptoCheck.expected_amount || 0).toFixed(6) + ' ' + assetStr;
      html+=`
      <div class="crypto-v2-card">
        <div class="crypto-v2-amount-bar">
          <span>مبلغ دقیق واریزی:</span>
          <b class="crypto-v2-amount-val">${amountText}</b>
        </div>

        <label class="crypto-v2-label">آدرس کیف پول جهت واریز:</label>
        
        <div class="crypto-v2-address-box">
          <code class="crypto-v2-address-code">${esc(cryptoCheck.address || '')}</code>
        </div>

        <div class="crypto-v2-copy-row">
          <button type="button" class="crypto-v2-copy-btn" data-copy="${esc(cryptoCheck.address || '')}">
            📋 کپی آدرس ولت
          </button>
        </div>
      </div>

      <div class="crypto-v2-txid-section">
        <label class="crypto-v2-label">کد هش تراکنش (TXID / Hash)</label>
        
        <input type="text" id="inlineTxidInput_${o.id}" class="crypto-v2-input" value="${esc(cryptoCheck.tx_hash || '')}" placeholder="هش تراکنش شبکه..." autocomplete="off" spellcheck="false">

        <button type="button" class="crypto-v2-submit-btn" data-submit-inline-txid="${o.id}">
          ⚡ ثبت TXID جهت استعلام آنی
        </button>

        ${cryptoCheck.status === 'pending' ? `<p class="crypto-v2-status pending">⏳ در حال بررسی شبکه... لطفاً شکیبا باشید.</p>` : ''}
        ${cryptoCheck.status === 'confirmed' ? `<p class="crypto-v2-status success">✅ تراکنش با موفقیت در شبکه تایید شد!</p>` : ''}
        ${cryptoCheck.fail_reason ? `<p class="crypto-v2-status error">❌ ${esc(cryptoCheck.fail_reason)}</p>` : ''}
      </div>`;
    }
    html+=`</div>`;
  }

  if(o.payment_method && o.payment_method !== 'none' && o.payment_method !== 'card' && o.payment_method !== 'crypto'){
    html+=`<div style="margin-top:12px;text-align:center"><button class="ghost" data-reset-payment-method="${o.id}" style="font-size:14px">🔄 تغییر روش پرداخت</button></div>`;
  }

  html+=`</article>`;
  return html;
}

async function resolveMiniServiceUrl(orderId,directUrl=''){
  if(directUrl) return directUrl;
  const r=await api('service_link',{order_id:Number(orderId)});
  return r.url||r.direct_url||r.viewer_url||'';
}
async function copyMiniServiceUrl(orderId,directUrl=''){
  try{
    const url=await resolveMiniServiceUrl(orderId,directUrl);
    if(!url) throw new Error('لینک سرویس موجود نیست.');
    if(navigator.clipboard?.writeText) await navigator.clipboard.writeText(url); else _copyFallback(url);
    showStatus('لینک ساب کپی شد ✓');
  }catch(e){showStatus(e.message||'کپی لینک انجام نشد','error')}
}
async function openDirectServiceViewer(orderId,directUrl='',title='مدیریت سرویس'){
  let loadingTimer=null;
  try{
    showStatus('در حال باز کردن سرویس…');
    const url=await resolveMiniServiceUrl(orderId,directUrl);
    if(!/^https:\/\//i.test(url)) throw new Error('لینک سرویس معتبر نیست.');
    document.getElementById('miniDirectServiceViewer')?.remove();

    // Keep the Mini App viewer visually identical to the Website phone viewer,
    // but size it for Telegram's real viewport instead of forcing fullscreen.
    const ov=document.createElement('dialog');
    ov.id='miniDirectServiceViewer';
    ov.className='mini-phone-viewer-overlay';
    ov.innerHTML=`<div class="mini-phone-viewer-device" role="document" aria-label="${esc(title)}">
      <div class="mini-phone-viewer-toolbar">
        <div class="mini-phone-viewer-dots"><i></i><i></i><i></i></div>
        <div class="mini-phone-viewer-title"><span>🔗</span><b>${esc(title)}</b><small>SUBSCRIPTION VIEWER</small></div>
        <div class="mini-phone-viewer-tools">
          <button type="button" data-service-copy title="کپی لینک" aria-label="کپی لینک">⧉</button>
          <button type="button" data-service-external title="باز کردن مستقیم" aria-label="باز کردن مستقیم">↗</button>
          <button type="button" data-service-refresh title="بارگذاری دوباره" aria-label="بارگذاری دوباره">↻</button>
          <button type="button" data-service-close title="بستن" aria-label="بستن">×</button>
        </div>
      </div>
      <div class="mini-phone-viewer-screen">
        <div class="mini-phone-viewer-loading"><div><b>در حال باز کردن سرویس…</b><small>صفحه سرویس داخل BlueGate باز می‌شود.</small></div></div>
        <iframe title="${esc(title)}" sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals allow-pointer-lock allow-presentation allow-top-navigation-by-user-activation allow-storage-access-by-user-activation" allow="clipboard-read; clipboard-write; fullscreen" referrerpolicy="strict-origin-when-cross-origin"></iframe>
        <div class="mini-phone-viewer-hint">اگر صفحه مقصد نمایش داخلی را محدود کرد، از دکمه ↗ استفاده کن.</div>
      </div>
    </div>`;

    document.body.appendChild(ov);
    document.documentElement.classList.add('mini-service-open');
    document.body.classList.add('mini-service-open');
    try{tg?.expand?.();tg?.disableVerticalSwipes?.()}catch{}
    if(typeof ov.showModal==='function') ov.showModal(); else ov.setAttribute('open','');

    const fr=ov.querySelector('iframe');
    const loading=ov.querySelector('.mini-phone-viewer-loading');
    const hint=ov.querySelector('.mini-phone-viewer-hint');
    const clearLoading=()=>{clearTimeout(loadingTimer);loading?.classList.add('done')};
    fr.addEventListener('load',clearLoading);
    // A few subscription panels keep load pending. Never keep an overlay over usable content.
    loadingTimer=setTimeout(clearLoading,1500);
    fr.src=url;

    const close=()=>{
      clearTimeout(loadingTimer);
      try{tg?.enableVerticalSwipes?.()}catch{}
      try{ov.close()}catch{}
      ov.remove();
      document.documentElement.classList.remove('mini-service-open');
      document.body.classList.remove('mini-service-open');
    };
    ov.querySelector('[data-service-close]').onclick=close;
    ov.querySelector('[data-service-refresh]').onclick=()=>{
      loading?.classList.remove('done');
      hint?.classList.remove('show');
      fr.src='about:blank';
      requestAnimationFrame(()=>{
        fr.src=url;
        clearTimeout(loadingTimer);
        loadingTimer=setTimeout(clearLoading,1500);
        setTimeout(()=>hint?.classList.add('show'),4500);
      });
    };
    ov.querySelector('[data-service-copy]').onclick=()=>copyMiniServiceUrl(orderId,url);
    ov.querySelector('[data-service-external]').onclick=()=>{if(tg?.openLink)tg.openLink(url);else window.open(url,'_blank','noopener,noreferrer')};
    ov.addEventListener('cancel',e=>{e.preventDefault();close()});
    ov.addEventListener('click',e=>{if(e.target===ov)close()});
    setTimeout(()=>{if(document.body.contains(ov))hint?.classList.add('show')},4500);
  }catch(e){showStatus(e.message||'باز کردن سرویس ممکن نشد','error')}
}

function openOrderMoreActions(id){const o=orderById(id);if(!o)return;const st=String(o.status||'').toLowerCase(),pending=['pending_payment','pending'].includes(st);const body=`<div class="order-more-actions"><button data-customer-note="${o.id}">یادداشت سفارش</button>${pending?`<button data-coupon="${o.id}">کد تخفیف</button>`:''}${o.receipt_file_id?`<button data-view-receipt="${o.id}">دیدن رسید</button>`:''}${pending?`<button class="danger" data-cancel="${o.id}">لغو سفارش</button>`:''}${canHideOrder(o)?`<button class="danger" data-hide-order="${o.id}">حذف از لیست من</button>`:''}</div>`;BlueGateUI.openSheet({type:'action',eyebrow:`سفارش #${nf(o.id)}`,title:'گزینه‌های بیشتر',body})}

function orderDetailHtml(o){
  const bal=Number(state.user?.balance||0);
  const d=Number(o.variant_discount_percent)||0;
  let basePriceHtml=`${fmt(o.amount)}`;
  if(d>0){
    const orig=Math.round(Number(o.amount)/(1-d/100));
    basePriceHtml=`<div style="display:flex;align-items:center;gap:6px"><s class="muted" style="font-size:14px">${fmt(orig)}</s><span>${fmt(o.amount)}</span><span class="flash-pill">−${nf(d)}٪</span></div>`;
  }
  const cur = String(o.price_currency || o.currency || 'IRT').toUpperCase();
  let nativeCurrencyPill = '';
  if (cur === 'USDT' || cur === 'USD') {
    nativeCurrencyPill = `<span class="badge" style="margin-right:6px">💵 ${nf(o.price_usd || 0)} USDT</span>`;
  } else if (cur === 'TRX') {
    nativeCurrencyPill = `<span class="badge" style="margin-right:6px">🔴 ${nf(o.price_crypto || 0)} TRX</span>`;
  } else if (cur === 'TON') {
    nativeCurrencyPill = `<span class="badge" style="margin-right:6px">💎 ${nf(o.price_crypto || 0)} TON</span>`;
  } else if (cur === 'STARS') {
    nativeCurrencyPill = `<span class="badge" style="margin-right:6px">⭐ ${nf(o.price_stars || 0)} Stars</span>`;
  }
  const totalSavings = Number(o.discount_amount||0) + Number(o.wallet_amount||0);
  const savingsCard = totalSavings > 0 ? `
    <div class="savings-breakdown-card" style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);border-radius:16px;padding:14px;margin:12px 0;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-weight:900;color:#22c55e;">🎉 سود شما از این خرید</span>
        <span class="savings-tag" style="color:#4ade80;font-weight:800;font-size:13.5px;background:rgba(34,197,94,0.12);padding:2px 7px;border-radius:8px;border:1px solid rgba(34,197,94,0.25);">مجموع سود: ${fmt(totalSavings)}</span>
      </div>
      <div style="font-size:14px;color:var(--muted);display:flex;flex-direction:column;gap:4px;">
        ${Number(o.discount_amount)>0 ? `<div>🎟 تخفیف با کد: <b style="color:var(--text);">${fmt(o.discount_amount)}</b></div>` : ''}
        ${Number(o.wallet_amount)>0 ? `<div>💰 کسر از اعتبار BlueGate: <b style="color:var(--text);">${fmt(o.wallet_amount)}</b></div>` : ''}
      </div>
    </div>
  ` : '';

  const remSec = getOrderRemainingSeconds(o);
  const stDetail = String(o.status || '').toLowerCase();
  const isPendingDetail = ['pending_payment','pending'].includes(stDetail);
  const topTimerHtml = (isPendingDetail && remSec > 0) ? `
    <div class="payment-countdown-badge" data-order-timer="${o.id}" data-expires-at="${esc(o.payment_expires_at || '')}" style="margin: 12px 0; width: 100%; justify-content: center;">
      <span class="timer-icon">⏳</span>
      <span class="timer-label">مهلت پرداخت سفارش:</span>
      <b class="timer-val">${formatMMSS(remSec)}</b>
    </div>
  ` : '';

  return `<section class="detail-card order-detail-page order-detail-v2">
    <!-- Top Action Bar -->
    <div class="od-top-bar">
      <button class="od-back-btn" data-order-back>
        <span class="od-back-icon">🚪</span> بازگشت به سفارش‌ها
      </button>
      <span class="od-order-id">سفارش #${nf(o.id)}</span>
    </div>

    <!-- Main Header -->
    <div class="od-head-section">
      <h2 class="od-title">${esc(o.display_name)}</h2>
      <div class="od-badges-row">
        ${orderStatusBadge(o)}
        ${o.is_renewal?`<span class="badge">🔄 تمدید سفارش #${nf(o.renewal_of_order_id||'')}</span>`:''}
        ${nativeCurrencyPill}
      </div>
      ${topTimerHtml}
    </div>

    <!-- Stepper Timeline -->
    ${orderStepperHtml(o)}

    <!-- Price Hero Card -->
    <div class="od-price-hero">
      <div class="od-price-hero-main">
        <span>مانده قابل پرداخت</span>
        <b>${fmt(o.final_amount)}</b>
      </div>
      ${orderUsdHint(o)}
    </div>

    ${savingsCard}

    <!-- 2-Column Info Grid Cards -->
    <div class="od-info-grid-v2">
      <div class="od-info-card">
        <small>قیمت پایه</small>
        <b>${basePriceHtml}</b>
      </div>
      <div class="od-info-card">
        <small>تخفیف (کد)</small>
        <b>${fmt(o.discount_amount||0)}</b>
      </div>
      <div class="od-info-card">
        <small>نوع تحویل</small>
        <b>${esc(o.delivery_type_fa||'-')}</b>
      </div>
      <div class="od-info-card">
        <small>روش پرداخت</small>
        <b>${esc(o.payment_method_fa||'انتخاب نشده')}</b>
      </div>
      <div class="od-info-card">
        <small>تاریخ ثبت</small>
        <b>${esc(o.created_at||'-')}</b>
      </div>
      ${o.expires_at ? `
      <div class="od-info-card">
        <small>انقضا</small>
        <b>${esc(o.expires_at)}</b>
      </div>` : `
      <div class="od-info-card">
        <small>پرداخت از اعتبار BlueGate</small>
        <b>${fmt(o.wallet_amount||0)}</b>
      </div>`}
    </div>

    <!-- Payment Section -->
    ${paymentMethodsHtml(o)}

    <!-- Timeline & Notes -->
    ${o.timeline?.length ? `<details class="timeline-details"><summary>🗓 تاریخچه کامل سفارش ▾</summary>${timeline(o.timeline)}</details>` : ''}
    ${o.payment_note ? `<div class="note-box"><b>رسید/توضیح پرداخت:</b><br>${textBlock(o.payment_note)}</div>` : ''}
    ${o.customer_note ? `<div class="note-box customer"><b>یادداشت شما:</b><br>${textBlock(o.customer_note)}</div>` : ''}
    ${o.delivery_text ? `<div class="delivery-box clean-delivery">${textBlock(o.delivery_text)}</div>` : ''}

    <!-- Sticky Bottom Actions Bar -->
    <div class="actions sticky-actions od-sticky-actions">
      ${(o.has_service_delivery||o.has_service_viewer) ? `<button class="primary btn-v2 mini-service-open-btn" data-service-view="${o.id}" data-service-url="${esc(o.service_url||'')}" data-service-title="${esc(o.service_title||'مدیریت سرویس')}">باز کردن سرویس</button><button class="secondary btn-v2 mini-service-copy-btn" data-service-copy-link="${o.id}" data-service-url="${esc(o.service_url||'')}">کپی لینک</button>` : `<button class="secondary btn-v2" data-customer-note="${o.id}">یادداشت سفارش</button>`}
      ${String(o.status)==="delivered"?`<button class="secondary btn-v2" data-renew-order="${o.id}">🔄 تمدید</button>`:""}<button class="ghost btn-v2 od-more-btn" data-order-more="${o.id}">••• بیشتر</button>
    </div>
  </section>`
}
function setTab(tab){
  if(!['shop','orders','wallet','home'].includes(tab)) tab='shop';
  currentTab=tab;
  if(tab!=='orders') currentOrderId=null;
  currentServiceOrderId=null;
  BlueGateUI?.closeSheet?.();
  saveAppLastState();
  renderUser();
}
function setAdminTab(tab){if(['products','categories','variants'].includes(tab))tab='catalog';if(!['dashboard','catalog','orders','more','inventory','coupons','settings','activity','roles','backups'].includes(tab))tab='dashboard';currentAdminTab=tab;saveAppLastState();renderAdmin()}
function render(data){
  hideSkeleton();
  state=data;applyTheme(data);
  if($('helloText')) $('helloText').textContent=data.brand||'BLUEGATE';
  $('userApp').classList.toggle('hidden',isAdminMode);
  $('adminApp').classList.toggle('hidden',!isAdminMode);
  if(isAdminMode){loadAdmin();return}
  renderUser();checkAndCelebrate();handleDeepLink();
}
let _deepLinkHandled=false;
function handleDeepLink(){
  if(_deepLinkHandled) return;
  _deepLinkHandled=true;
  // 1) Telegram startapp param: ?startapp=product_5 or tg.initDataUnsafe.start_param = 'product_5'
  const startParam = tg?.initDataUnsafe?.start_param || getUrlFlag('startapp') || '';
  let pid = null;
  if(startParam && /^product_(\d+)$/i.test(startParam)){pid=startParam.replace(/^product_/i,'');}
  if(startParam && /^plan_(\d+)$/i.test(startParam)){const planId=Number(startParam.replace(/^plan_/i,''));for(const s of (state?.catalog?.services||[])){for(const g of (s.groups||[])){const p=(g.plans||[]).find(x=>Number(x.id)===planId);if(p){pid=p.legacy_product_id||s.legacy_product_id;const vp=p.legacy_variant_id||null;if(pid){currentTab='shop';renderUser();showProduct(pid,vp);return}}}}}
  // 2) Web fallback: ?product=5
  if(!pid){ pid = getUrlFlag('product'); }
  if(pid && Number(pid) > 0){
    currentTab='shop';
    renderUser();
    showProduct(pid);
  }
}
function updateMiniHeader(){
  const titles={shop:'فروشگاه',orders:'سفارش‌ها',wallet:'اعتبار',home:'حساب'};
  const title=$('brandTitle'),hello=$('helloText');
  if(title) title.textContent=titles[currentTab]||'BlueGate';
  if(hello) hello.textContent=state?.brand||'BLUEGATE';
}
function hidePages(){
  ['homePage','shopPage','ordersPage','walletPage'].forEach(id=>$(id)?.classList.add('hidden'));
  document.querySelectorAll('.bottom-nav [data-tab], .topbar-desktop-nav [data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===currentTab));
  updateMiniHeader();updateNotificationBadge();syncOrderPolling();
}
let _orderPollTimer=null,_orderPollBusy=false,_enhancementsHydrating=false,_enhancementsHydrated=false;
function updateNotificationBadge(){const btn=$('miniNotificationsBtn'),badge=$('miniNotificationBadge');const n=Number(state?.notification_unread||0);btn?.classList.toggle('hidden',Boolean(state?.is_guest));if(badge){badge.textContent=n>99?'99+':String(n);badge.classList.toggle('hidden',n<=0)}}
function openNotifications(){const list=state?.notifications||[];BlueGateUI.openSheet({type:'action',eyebrow:'BLUEGATE',title:'اعلان‌ها',body:`<div class="mini-notification-list">${list.length?list.map(n=>`<button class="mini-notification-row ${n.is_read?'':'unread'}" ${n.order_id?`data-notification-order="${n.order_id}"`:''}><span>${n.type==='delivered'?'✅':n.type==='wallet'?'💳':'🔔'}</span><div><b>${esc(n.title)}</b><small>${esc(n.body||'')}</small><em>${esc(String(n.created_at||'').slice(0,16))}</em></div></button>`).join(''):'<div class="u-empty"><div class="u-empty-icon">🔔</div><h3>اعلانی نداری</h3><p>تغییر وضعیت سفارش‌ها و اعتبار اینجا نمایش داده می‌شود.</p></div>'}</div>`,onOpen:(host)=>{host.querySelectorAll('[data-notification-order]').forEach(x=>x.addEventListener('click',()=>{currentTab='orders';currentOrderId=Number(x.dataset.notificationOrder);BlueGateUI.closeSheet();renderUser()}));}});if(Number(state?.notification_unread||0)>0){state.notification_unread=0;(state.notifications||[]).forEach(n=>n.is_read=1);updateNotificationBadge();api('notifications_read').catch(()=>{})}}
async function hydrateMiniEnhancements({force=false}={}){if(_enhancementsHydrating||state?.is_guest||(!force&&_enhancementsHydrated))return;_enhancementsHydrating=true;try{const r=await api('mini_enhancements');if(Array.isArray(r.services))state.services=r.services;if(Array.isArray(r.wishlist_product_ids)){state.wishlist_product_ids=r.wishlist_product_ids.map(Number);try{localStorage.setItem('blue_ref_wishlist',JSON.stringify(state.wishlist_product_ids))}catch(_){}}if(Array.isArray(r.notifications))state.notifications=r.notifications;if(r.notification_unread!==undefined)state.notification_unread=Number(r.notification_unread||0);_enhancementsHydrated=true;updateNotificationBadge();if(currentTab==='home')renderHome();if(currentTab==='shop'&&shopFilterWishlist)renderShopSections()}catch(e){console.warn('[BlueGate MiniApp enhancements] optional hydration failed',e?.message||e)}finally{_enhancementsHydrating=false}}
function scheduleMiniEnhancementsHydration(){const run=()=>hydrateMiniEnhancements().catch(()=>{});if('requestIdleCallback' in window)requestIdleCallback(run,{timeout:1800});else setTimeout(run,250)}
async function refreshOrdersLive(){if(_orderPollBusy||document.hidden||currentTab!=='orders'||state?.is_guest)return;_orderPollBusy=true;try{const r=await api('my_orders');const before=JSON.stringify((state.orders||[]).map(o=>[o.id,o.status,o.updated_at,o.delivery_url]));const after=JSON.stringify((r.orders||[]).map(o=>[o.id,o.status,o.updated_at,o.delivery_url]));state.orders=r.orders||[];if(Array.isArray(r.services))state.services=r.services;if(Array.isArray(r.notifications))state.notifications=r.notifications;if(r.notification_unread!==undefined)state.notification_unread=Number(r.notification_unread||0);updateNotificationBadge();if(before!==after){renderOrders();hapticNotify('success')}}catch(e){console.warn('[BlueGate order poll]',e?.message||e)}finally{_orderPollBusy=false}}
function syncOrderPolling(){if(_orderPollTimer){clearInterval(_orderPollTimer);_orderPollTimer=null}if(currentTab==='orders'&&!state?.is_guest){_orderPollTimer=setInterval(refreshOrdersLive,18000);setTimeout(refreshOrdersLive,700)}}
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(_orderPollTimer){clearInterval(_orderPollTimer);_orderPollTimer=null}}else{syncOrderPolling();scheduleMiniEnhancementsHydration()}});
function renderUser(){
  saveAppLastState();hidePages();updateCartFab();
  if(currentTab==='home'){ $('homePage').classList.remove('hidden'); renderHome(); }
  else if(currentTab==='orders'){ $('ordersPage').classList.remove('hidden'); renderOrders(); }
  else if(currentTab==='wallet'){ $('walletPage').classList.remove('hidden'); renderWallet(); }
  else { currentTab='shop'; $('shopPage').classList.remove('hidden'); renderShop(); }
  updateMiniHeader();
}
function myServiceById(id){
  const n=Number(id||0);
  return (state.services||[]).find(x=>Number(x.id)===n)||(state.orders||[]).find(x=>Number(x.id)===n)||null;
}
function isVpnService(o){
  if(!o)return false;
  const dt=String(o.delivery_type||'').toLowerCase();
  const name=String(o.display_name||o.product_name||o.service_name_snapshot||'').toLowerCase();
  const url=String(o.service_url||o.delivery_url||'');
  return dt==='vpn'||/vpn|blueping|standard|pro boost|\bpro\b/i.test(name)||/\/sub\//i.test(url);
}
function renderMyServiceDetail(){
  const o=myServiceById(currentServiceOrderId);
  if(!o){currentServiceOrderId=null;renderHome();return}
  const vpn=isVpnService(o);
  const hasUrl=!!String(o.service_url||o.delivery_url||'').trim();
  const title=esc(o.display_name||o.product_name||'سرویس BlueGate');
  const expiry=o.expires_at?esc(String(o.expires_at)):'بدون تاریخ انقضا';
  const group=esc(o.group_name_snapshot||o.variant_title||'');
  $('homePage').innerHTML=`<section class="my-service-detail-page">
    <div class="my-service-topline">
      <button class="my-service-back" data-my-service-back>‹ <span>سرویس‌های من</span></button>
      <span class="my-service-status ${vpn?'vpn':''}">${vpn?'VPN فعال':'سرویس فعال'}</span>
    </div>
    <div class="my-service-hero ${vpn?'vpn':''}">
      <div class="my-service-hero-icon">${vpn?'🛡️':'◇'}</div>
      <div class="my-service-hero-copy"><small>${vpn?'BLUEPING VPN':'BLUEGATE SERVICE'}</small><h2>${title}</h2>${group?`<p>${group}</p>`:''}<div class="my-service-expiry"><span>فعال تا</span><b>${expiry}</b></div></div>
    </div>
    ${vpn?`<div class="vpn-service-actions">
      <button class="vpn-action vpn-open" data-service-view="${o.id}" data-service-url="${esc(o.service_url||'')}" data-service-title="${esc(o.service_title||'مدیریت سرویس')}"><span class="vpn-action-icon">↗</span><b>باز کردن سرویس</b><small>ورود به پنل اشتراک</small></button>
      <button class="vpn-action vpn-copy" data-service-copy-link="${o.id}" data-service-url="${esc(o.service_url||'')}"><span class="vpn-action-icon">⧉</span><b>کپی لینک</b><small>Subscription URL</small></button>
      <button class="vpn-action vpn-renew" data-renew-order="${o.id}"><span class="vpn-action-icon">↻</span><b>تمدید</b><small>همین سرویس</small></button>
    </div>`:`<div class="my-service-main-actions"><button class="primary" data-renew-order="${o.id}">↻ تمدید سرویس</button>${hasUrl?`<button class="secondary" data-service-view="${o.id}" data-service-url="${esc(o.service_url||'')}" data-service-title="${esc(o.service_title||'مدیریت سرویس')}">باز کردن سرویس</button>`:''}</div>`}
    <article class="my-service-info-card">
      <div><span>نام سرویس</span><b>${title}</b></div>
      ${group?`<div><span>پلن</span><b>${group}</b></div>`:''}
      <div><span>وضعیت</span><b class="service-ok">فعال ✓</b></div>
      <div><span>تاریخ انقضا</span><b>${expiry}</b></div>
      <div><span>شماره سفارش</span><b>#${nf(o.id)}</b></div>
    </article>
    ${vpn&&hasUrl?`<article class="vpn-link-card"><div><span>لینک اشتراک</span><small>برای اتصال در کلاینت VPN استفاده کن</small></div><code>${esc(o.service_url||'')}</code><button data-service-copy-link="${o.id}" data-service-url="${esc(o.service_url||'')}">کپی لینک</button></article>`:''}
  </section>`;
}
function renderHome(){
  if(currentServiceOrderId){renderMyServiceDetail();return}
  const u=state.user||{};const c=u.customer?.tier||{};const isGuest=state?.is_guest||u?.is_guest;const orders=state.orders||[];const activeOrders=orders.filter(o=>!['delivered','canceled','rejected','refunded'].includes(String(o.status||'')));const activeServices=(state.services||[]);const recent=activeServices.slice(0,3);const tgConnected=!!u.telegram_connected;const completion=Math.round([!!String(u.first_name||'').trim(),!!(u.web_username||u.username),!!u.email_verified_at,tgConnected].filter(Boolean).length/4*100);
  const guestBanner=isGuest?`<div class="guest-banner"><div class="guest-banner-text"><strong>حالت میهمان</strong><span>برای سفارش و مدیریت اعتبار وارد حساب شو.</span></div><button class="primary" onclick="openAuthModal()">ورود / ثبت‌نام</button></div>`:'';
  const services=recent.length?recent.map(o=>`<div class="hub-service-row"><button class="hub-order-row" data-my-service="${o.id}"><div><b>${esc(o.display_name||o.product_name||'سرویس')}</b><small>${o.expires_at?'فعال تا '+esc(String(o.expires_at).slice(0,10)):'سرویس فعال'}</small></div><span>›</span></button><button class="mini-renew-inline" data-renew-order="${o.id}">تمدید</button></div>`).join(''):`<div class="u-empty"><div class="u-empty-icon">◇</div><h3>هنوز سرویس فعالی نداری</h3><p>از فروشگاه اولین سرویس BlueGate خودت رو انتخاب کن.</p><button class="primary" data-tab-jump="shop">رفتن به فروشگاه</button></div>`;
  $('homePage').innerHTML=`${guestBanner}
    <section class="account-center-mini-hero">
      <div class="mini-profile-main">${userProfileAvatar(u,'account-center-photo')}<div><small>BLUEGATE MEMBER</small><h2>${esc(u.first_name||u.username||'کاربر BlueGate')}</h2><p>${u.username?'@'+esc(u.username):'حساب BlueGate'} · ${tgConnected?'Telegram متصل ✓':'حساب وب'}</p></div><button class="account-edit-mini" id="editMiniProfile">ویرایش</button></div>
      <div class="mini-profile-completion"><div><span>تکمیل حساب</span><b>${nf(completion)}٪</b></div><i><em style="width:${completion}%"></em></i></div>
      <div class="mini-account-stats"><button data-tab-jump="wallet"><span>اعتبار</span><b data-count-anim="${u.balance||0}">${fmt(u.balance||0)}</b></button><button data-tab-jump="orders"><span>سفارش فعال</span><b>${nf(activeOrders.length)}</b></button><button data-credit-view="referral"><span>دعوت موفق</span><b>${nf(u.referrals_count||0)}</b></button></div>
    </section>
    <article class="account-hub-card"><div class="hub-card-head"><span>◇</span><div><b>سرویس‌های من</b><small>${nf(activeServices.length)} سرویس فعال</small></div><button data-tab-jump="orders">مشاهده همه</button></div>${services}</article>
    <article class="account-hub-card account-menu-card">
      <button class="account-menu-row" id="editMiniProfile2"><span class="account-menu-icon">○</span><div><b>اطلاعات حساب</b><small>${esc(u.email||'ایمیل ثبت نشده')} · ${esc(u.phone_number||'شماره تماس ثبت نشده')}</small></div><em>‹</em></button>
      <button class="account-menu-row" ${u.has_password?'id="changeMiniPassword"':'type="button" disabled'}><span class="account-menu-icon">⌁</span><div><b>امنیت و ورود</b><small>${u.has_password?'تغییر رمز عبور':'ورود امن با Telegram'} · ${u.email_verified_at?'ایمیل تایید شده':'ایمیل نیازمند تایید'}</small></div><em>${u.has_password?'‹':'✓'}</em></button>
      <button class="account-menu-row" id="miniChangeEmailBtn"><span class="account-menu-icon">@</span><div><b>ایمیل حساب</b><small>${u.email?esc(u.email):'افزودن ایمیل امن با OTP'}</small></div><em>‹</em></button>
      <button class="account-menu-row" id="miniReferralJump"><span class="account-menu-icon">↗</span><div><b>دعوت دوستان</b><small>${nf(u.referrals_count||0)} معرفی · ${fmt(u.total_earned||0)} پاداش</small></div><em>‹</em></button>
      <button class="account-menu-row" data-tab-jump="wallet"><span class="account-menu-icon">◫</span><div><b>اعتبار من</b><small>${fmt(u.balance||0)} · شارژ و تراکنش‌ها</small></div><em>‹</em></button>
      <button class="account-menu-row" id="paletteQuick"><span class="account-menu-icon">◐</span><div><b>ظاهر برنامه</b><small>رنگ اصلی Mini App</small></div><em>‹</em></button>
      <button class="account-menu-row" id="miniSupportBtn"><span class="account-menu-icon">?</span><div><b>پشتیبانی</b><small>ارتباط با پشتیبانی BlueGate</small></div><em>‹</em></button>
    </article>`;
  triggerBalanceAnims();
}
function openMiniProfileEditor(){
  const u=state.user||{};
  const o=miniTopupShell('ویرایش اطلاعات حساب','اطلاعات پایه حسابت را به‌روزرسانی کن.',`<div class="mini-account-editor">
    <div class="mini-account-editor-summary"><span>${userInitial(u)}</span><div><b>${esc(u.first_name||u.username||'کاربر BlueGate')}</b><small>${esc(u.username?'@'+u.username:'حساب BlueGate')}</small></div></div>
    <div class="mini-account-fields">
      <label class="mini-account-field"><span>نام نمایشی</span><input id="mp_first" autocomplete="given-name" value="${esc(u.first_name||'')}" placeholder="نام"></label>
      <label class="mini-account-field"><span>نام خانوادگی</span><input id="mp_last" autocomplete="family-name" value="${esc(u.last_name||'')}" placeholder="نام خانوادگی"></label>
      <label class="mini-account-field"><span>شماره تماس</span><input id="mp_phone" inputmode="tel" autocomplete="tel" value="${esc(u.phone_number||'')}" placeholder="اختیاری"></label>
    </div>
    <div class="mini-account-email-card"><div><span>ایمیل حساب</span><b>${esc(u.email||'ثبت نشده')}</b><small>${u.email_verified_at?'ایمیل تایید شده ✓':'تغییر ایمیل فقط با OTP انجام می‌شود.'}</small></div><button type="button" id="miniChangeEmailInlineBtn">${u.email?'تغییر ایمیل':'افزودن ایمیل'}</button></div>
    <button class="primary wide mini-account-save" id="miniProfileSave" type="button">ذخیره تغییرات</button>
  </div>`,'BLUEGATE ACCOUNT');
  o.querySelector('#miniProfileSave')?.addEventListener('click',async()=>{try{const b=o.querySelector('#miniProfileSave');b.disabled=true;b.textContent='در حال ذخیره…';state=await api('update_my_profile',{first_name:o.querySelector('#mp_first')?.value||'',last_name:o.querySelector('#mp_last')?.value||'',phone_number:o.querySelector('#mp_phone')?.value||''});applyTheme(state);closeMiniCreditTopup();renderUser();showStatus('اطلاعات حساب ذخیره شد')}catch(e){showStatus(e.message||'ذخیره اطلاعات انجام نشد','error');const b=o.querySelector('#miniProfileSave');if(b){b.disabled=false;b.textContent='ذخیره تغییرات'}}});
}
function miniEmailSheet(title,subtitle,body){pendingEdit=null;return miniTopupShell(title,subtitle,`<div class="mini-email-flow mini-account-email-flow">${body}</div>`,'SECURE EMAIL')}
async function openMiniEmailChangeFlow(){try{const r=await api('email_change_start');if(r.step==='new_email')renderMiniNewEmailStep();else renderMiniOldEmailOtpStep(r)}catch(e){showStatus(e.message||'ارسال کد ممکن نشد','error')}}
function renderMiniOldEmailOtpStep(r){const sheet=miniEmailSheet('تغییر ایمیل','مرحله ۱ از ۲ · تایید ایمیل فعلی',`<div class="mini-email-flow-note"><b>کد به ${esc(r.masked_email||'ایمیل فعلی')} ارسال شد</b><p>اول مالکیت ایمیل فعلی را تایید کن.</p></div><label class="mini-account-field mini-email-otp"><span>کد ۶ رقمی</span><input id="miniOldEmailOtp" maxlength="6" inputmode="numeric" autocomplete="one-time-code" placeholder="••••••"></label><button class="primary wide" id="miniVerifyOldEmail">تایید و ادامه</button><button class="ghost wide" id="miniResendOldEmail">ارسال مجدد</button>`);sheet.querySelector('#miniVerifyOldEmail')?.addEventListener('click',async()=>{try{await api('email_change_verify_current',{otp:sheet.querySelector('#miniOldEmailOtp')?.value.trim()||''});renderMiniNewEmailStep();showStatus('ایمیل فعلی تایید شد','success')}catch(e){showStatus(e.message,'error')}});sheet.querySelector('#miniResendOldEmail')?.addEventListener('click',async()=>{try{const x=await api('email_change_resend_current');renderMiniOldEmailOtpStep(x);showStatus('کد جدید ارسال شد','success')}catch(e){showStatus(e.message,'error')}});setTimeout(()=>sheet.querySelector('#miniOldEmailOtp')?.focus(),120)}
function renderMiniNewEmailStep(){const u=state.user||{};const sheet=miniEmailSheet(u.email?'ایمیل جدید':'افزودن ایمیل',u.email?'مرحله ۲ از ۲ · ایمیل جدید':'تایید ایمیل جدید',`<div class="mini-email-flow-note ok"><b>${u.email?'ایمیل فعلی تایید شد ✓':'ایمیل جدید را وارد کن'}</b><p>${u.email?'حالا ایمیل جدید را وارد کن؛ یک OTP دوم به آن ارسال می‌شود.':'برای ثبت نهایی، یک کد تایید به این ایمیل ارسال می‌شود.'}</p></div><label class="mini-account-field mini-email-address"><span>ایمیل جدید</span><div class="mini-email-input-shell"><span>@</span><input id="miniNewEmail" type="email" inputmode="email" autocomplete="email" autocapitalize="none" placeholder="name@example.com"></div><small>کد تایید به همین آدرس ارسال می‌شود.</small></label><button class="primary wide" id="miniSendNewEmailOtp">ارسال کد تایید</button>`);sheet.querySelector('#miniSendNewEmailOtp')?.addEventListener('click',async()=>{try{const r=await api('email_change_set_new',{email:sheet.querySelector('#miniNewEmail')?.value.trim()||''});renderMiniNewEmailOtpStep(r);showStatus('کد به ایمیل جدید ارسال شد','success')}catch(e){showStatus(e.message,'error')}});setTimeout(()=>sheet.querySelector('#miniNewEmail')?.focus(),120)}
function renderMiniNewEmailOtpStep(r){const sheet=miniEmailSheet('تایید ایمیل جدید','آخرین مرحله',`<div class="mini-email-flow-note ok"><b>کد به ${esc(r.masked_email||'ایمیل جدید')} ارسال شد</b><p>تا قبل از تایید این کد، ایمیل قبلی حساب تغییر نمی‌کند.</p></div><label class="mini-account-field mini-email-otp"><span>کد ۶ رقمی</span><input id="miniNewEmailOtp" maxlength="6" inputmode="numeric" autocomplete="one-time-code" placeholder="••••••"></label><button class="primary wide" id="miniVerifyNewEmail">تایید و ثبت ایمیل</button><button class="ghost wide" id="miniResendNewEmail">ارسال مجدد</button>`);sheet.querySelector('#miniVerifyNewEmail')?.addEventListener('click',async()=>{try{state=await api('email_change_verify_new',{otp:sheet.querySelector('#miniNewEmailOtp')?.value.trim()||''});applyTheme(state);closeMiniCreditTopup();renderUser();showStatus('ایمیل جدید ثبت شد ✓','success')}catch(e){showStatus(e.message,'error')}});sheet.querySelector('#miniResendNewEmail')?.addEventListener('click',async()=>{try{const x=await api('email_change_resend_new');renderMiniNewEmailOtpStep(x);showStatus('کد جدید ارسال شد','success')}catch(e){showStatus(e.message,'error')}});setTimeout(()=>sheet.querySelector('#miniNewEmailOtp')?.focus(),120)}

function openMiniPasswordEditor(){
  if(!state.user?.has_password){showStatus('این حساب با تلگرام وارد می‌شود و رمز وب ندارد','error');return}
  const o=miniTopupShell('تغییر رمز عبور','برای امنیت بیشتر، رمز فعلی را وارد کن.',`<div class="mini-account-fields"><label class="mini-account-field"><span>رمز فعلی</span><input id="mp_current" type="password" autocomplete="current-password" placeholder="••••••••"></label><label class="mini-account-field"><span>رمز جدید</span><input id="mp_new" type="password" minlength="8" autocomplete="new-password" placeholder="حداقل ۸ کاراکتر"></label></div><button class="primary wide" id="miniPasswordSave">ثبت رمز جدید</button>`,'ACCOUNT SECURITY');
  o.querySelector('#miniPasswordSave')?.addEventListener('click',async()=>{try{state=await api('change_my_password',{current_password:o.querySelector('#mp_current')?.value||'',new_password:o.querySelector('#mp_new')?.value||''});closeMiniCreditTopup();renderUser();showStatus('رمز عبور تغییر کرد')}catch(e){showStatus(e.message||'تغییر رمز انجام نشد','error')}})
}
function openPalettePopup(){const colors=['#1d9bf0','#8b5cf6','#22c55e','#ef4444','#f97316','#ec4899','#06b6d4','#f59e0b','#14b8a6','#64748b'];const p=$('palettePopup');if(!p)return;p.innerHTML=`<div class="palette-popup-backdrop" data-close-palette></div><div class="palette-popup-inner"><button class="palette-popup-close" data-close-palette>✕</button><h3>🎨 رنگ دلخواه Mini App</h3><p class="muted">یکی از رنگ‌ها را بزن یا رنگ اختصاصی خودت را انتخاب کن. این رنگ فقط روی همین دستگاه ذخیره می‌شود.</p><div class="palette">${colors.map(c=>`<button class="swatch" data-color="${c}" style="background:${c}"></button>`).join('')}<label class="custom-color"><span>رنگ دلخواه</span><input id="userCustomColor" type="color" value="${esc(localStorage.getItem('blue_ref_color')||state?.theme_color||'#1d9bf0')}"></label><button class="secondary wide" id="applyCustomColor">اعمال رنگ</button><button class="ghost wide" id="resetColor">پیش‌فرض</button></div></div>`;p.classList.add('open');p.querySelectorAll('[data-close-palette]').forEach(el=>el.addEventListener('click',closePalettePopup))}
function closePalettePopup(){const p=$('palettePopup');if(p){p.classList.remove('open');p.innerHTML=''}}
function missionCard(m){const today=Number(state.user?.today_referrals||0);const target=Math.max(1,Number(m.target||1));const pct=Math.max(0,Math.min(100,Math.round(today/target*100)));const done=m.claimed?'claimed':(m.done?'done':'todo');return `<article class="mission-card ${done}"><div class="mission-top"><div><small>${nf(Math.min(today,target))} از ${nf(target)}</small><h3>${nf(target)} دعوت امروز</h3><p class="muted">پاداش: <b>${fmt(m.reward)}</b></p></div><div class="mission-icon">${m.claimed?'✅':(m.done?'🎁':'✌️')}</div></div><div class="progress-track"><span style="width:${pct}%"></span></div><div class="mission-foot"><span>${pct}% تکمیل شده</span><b>${m.claimed?'دریافت شد':(m.done?'آماده دریافت':'در حال انجام')}</b></div></article>`}
function getWishlist(){if(Array.isArray(state?.wishlist_product_ids))return state.wishlist_product_ids.map(Number);try{return JSON.parse(localStorage.getItem('blue_ref_wishlist')||'[]').map(Number)}catch(e){return []}}
async function toggleWishlist(pid){pid=Number(pid);let w=getWishlist();const was=w.includes(pid);w=was?w.filter(id=>id!==pid):[...w,pid];if(state&&!state.is_guest)state.wishlist_product_ids=w;localStorage.setItem('blue_ref_wishlist',JSON.stringify(w));document.querySelectorAll(`[data-wishlist-pid="${pid}"]`).forEach(el=>{el.textContent=w.includes(pid)?'❤️':'🤍';el.classList.toggle('active',w.includes(pid))});if(!was)haptic('success');if(shopFilterWishlist)renderShopSections();if(!state?.is_guest){try{const r=await api('wishlist_toggle',{product_id:pid});state.wishlist_product_ids=r.wishlist_product_ids||w;localStorage.setItem('blue_ref_wishlist',JSON.stringify(state.wishlist_product_ids));if(shopFilterWishlist)renderShopSections()}catch(e){state.wishlist_product_ids=was?[...w,pid]:w.filter(id=>id!==pid);showStatus(e.message||'ذخیره علاقه‌مندی انجام نشد','error')}}}

function storefrontRootProducts(){const all=state.shop_products||[];const roots=all.filter(p=>Number(p.parent_id||0)===0);return roots.length?roots:all}
function catalogServiceForProduct(p){return (state?.catalog?.services||[]).find(s=>Number(s.legacy_product_id||0)===Number(p?.id||0))||null}
function catalogSearchTextForProduct(p){const svc=catalogServiceForProduct(p);if(!svc)return '';return (svc.groups||[]).map(g=>`${g.name||''} ${(g.plans||[]).map(x=>x.title||'').join(' ')}`).join(' ')}
function catalogGroupPriceLabel(g){const prices=(g?.plans||[]).map(x=>Number(x.price||0)).filter(x=>x>0);return prices.length?`از ${fmt(Math.min(...prices))} تومان`:''}
function openCatalogServiceGroups(p){const svc=catalogServiceForProduct(p);let groups=(svc?.groups||[]).filter(g=>Number(g.is_default||0)===0&&(g.plans||[]).length);if(!groups.length){const children=(state.shop_products||[]).filter(x=>Number(x.parent_id||0)===Number(p.id));groups=children.map(x=>({name:x.name,legacy_product_id:x.id,plans:x.variants||[]}))}if(!groups.length)return false;const body=`<div class="catalog-group-picker">${groups.map(g=>`<button class="catalog-group-option" data-open-group-product="${Number(g.legacy_product_id||0)}"><span><b>${esc(g.name||'پلن')}</b><small>${nf((g.plans||[]).length)} پلن${catalogGroupPriceLabel(g)?' · '+esc(catalogGroupPriceLabel(g)):''}</small></span><i>‹</i></button>`).join('')}</div>`;BlueGateUI.openSheet({type:'action',eyebrow:'سرویس',title:svc?.name||p.name,subtitle:svc?.description||p.short_description||'نوع سرویس را انتخاب کن.',body,onOpen:(host)=>host.querySelectorAll('[data-open-group-product]').forEach(btn=>btn.addEventListener('click',()=>{const childId=Number(btn.dataset.openGroupProduct||0);BlueGateUI.closeSheet();setTimeout(()=>showProduct(childId),80)}))});return true}
function filteredProducts(){let list=storefrontRootProducts().filter(p=>(activeCategory==='all'||Number(p.category_id)===Number(activeCategory)||(activeCategory==='featured'&&Number(p.is_featured)===1))&&(!searchTerm||`${p.name} ${p.short_description} ${p.full_description} ${catalogSearchTextForProduct(p)}`.toLowerCase().includes(searchTerm.toLowerCase())));if(shopFilterInStock)list=list.filter(p=>Number(p.inventory_available||0)>0||Number(p.child_count||0)>0);if(shopFilterFeatured)list=list.filter(p=>Number(p.is_featured)===1);if(shopFilterWishlist){const w=getWishlist();list=list.filter(p=>w.includes(Number(p.id)));}if(shopSort==='price_low')list=[...list].sort((a,b)=>Number(a.price||0)-Number(b.price||0));else if(shopSort==='price_high')list=[...list].sort((a,b)=>Number(b.price||0)-Number(a.price||0));else if(shopSort==='newest')list=[...list].sort((a,b)=>Number(b.id)-Number(a.id));return list}
function productDiscountInfo(p){
  const variants=(p?.variants||[]).filter(v=>Number(v.discount_percent||0)>0);
  if(variants.length){
    const best=[...variants].sort((a,b)=>Number(b.discount_percent||0)-Number(a.discount_percent||0))[0];
    return {percent:Number(best.discount_percent||0),title:String(best.title||'پلن منتخب'),variantId:Number(best.id||0),kind:'variant'};
  }
  const d=Number(p?.discount_percent||0);
  return d>0?{percent:d,title:'',variantId:0,kind:'product'}:null;
}
function productDiscountBadgeHtml(p){
  const d=productDiscountInfo(p); if(!d)return '';
  const label=d.kind==='variant'&&d.title?`${d.percent}٪ · ${esc(d.title)}`:`${d.percent}٪ تخفیف`;
  return `<span class="discount-badge discount-badge-exact"><span class="disc-val">${esc(label)}</span><span class="disc-fire">🔥</span></span>`;
}
function specialDiscountsBannerHtml(){
  const allProds = state.shop_products || [];
  const specialProducts = allProds.filter(p => {
    const hasVarDiscount = (p.variants || []).some(v => Number(v.discount_percent) > 0);
    return hasVarDiscount || Number(p.discount_percent || 0) > 0;
  });
  if (!specialProducts.length) return '';
  return sectionHtml('⚡ تخفیف‌های ویژه', specialProducts, 'all', false);
}
function shopSectionsHtml(){const cats=state.shop_categories||[];const products=filteredProducts();const filtersActive=shopFilterInStock||shopFilterFeatured||shopFilterWishlist||shopSort!=='newest';let sections='';if(activeCategory==='all'&&!searchTerm&&!filtersActive){const spec=specialDiscountsBannerHtml();if(spec)sections+=spec;const recent=recentProductsHtml();if(recent)sections+=recent;const featured=storefrontRootProducts().filter(p=>Number(p.is_featured)===1);if(featured.length)sections+=sectionHtml('⭐ محصولات ویژه',featured,'featured');for(const c of cats){const list=storefrontRootProducts().filter(p=>Number(p.category_id)===Number(c.id));if(list.length)sections+=sectionHtml(`${esc(c.emoji||'🛒')} ${esc(c.title)}`,list,String(c.id))}}else sections=gridHtml(products);return sections||'<div class="empty-state rich-empty-state" style="padding:40px 20px;text-align:center"><div class="empty-icon" style="font-size:48px;margin-bottom:12px;opacity:0.8">🕵️‍♂️</div><h3>محصولی پیدا نشد!</h3><p class="muted" style="margin-bottom:20px;font-size:14px">با این فیلترها و جستجو چیزی پیدا نکردیم.</p><button class="secondary" data-clear-filters>حذف تمام فیلترها</button></div>'}
function activeShopFilterSummary(){const out=[];if(shopSort==='price_low')out.push('ارزان‌ترین');else if(shopSort==='price_high')out.push('گران‌ترین');if(shopFilterInStock)out.push('فقط موجود');if(shopFilterWishlist)out.push('علاقه‌مندی‌ها');return out}
function openShopFilters(){
  const body=`<div class="filter-sheet-group"><label>مرتب‌سازی</label><div class="filter-choice-grid"><button data-u-sort="newest" class="${shopSort==='newest'?'active':''}">جدیدترین</button><button data-u-sort="price_low" class="${shopSort==='price_low'?'active':''}">ارزان‌ترین</button><button data-u-sort="price_high" class="${shopSort==='price_high'?'active':''}">گران‌ترین</button></div></div><div class="filter-sheet-group"><label>نمایش</label><div class="filter-switch-row"><span>فقط محصولات موجود</span><button data-u-toggle="instock" class="${shopFilterInStock?'active':''}">${shopFilterInStock?'روشن':'خاموش'}</button></div><div class="filter-switch-row"><span>فقط علاقه‌مندی‌ها</span><button data-u-toggle="wishlist" class="${shopFilterWishlist?'active':''}">${shopFilterWishlist?'روشن':'خاموش'}</button></div></div>`;
  BlueGateUI.openSheet({type:'action',eyebrow:'فروشگاه',title:'فیلتر و مرتب‌سازی',subtitle:'فقط گزینه‌های موردنیازت رو فعال کن.',body,footer:'<button class="secondary" data-u-filter-reset>پاک کردن فیلتر</button><button class="primary" data-u-filter-apply>اعمال</button>',onOpen:(host)=>{let sort=shopSort,stock=shopFilterInStock,wish=shopFilterWishlist;const sync=()=>{host.querySelectorAll('[data-u-sort]').forEach(b=>b.classList.toggle('active',b.dataset.uSort===sort));host.querySelector('[data-u-toggle="instock"]')?.classList.toggle('active',stock);host.querySelector('[data-u-toggle="wishlist"]')?.classList.toggle('active',wish);const a=host.querySelector('[data-u-toggle="instock"]'),b=host.querySelector('[data-u-toggle="wishlist"]');if(a)a.textContent=stock?'روشن':'خاموش';if(b)b.textContent=wish?'روشن':'خاموش'};host.querySelectorAll('[data-u-sort]').forEach(b=>b.addEventListener('click',()=>{sort=b.dataset.uSort;sync()}));host.querySelector('[data-u-toggle="instock"]')?.addEventListener('click',()=>{stock=!stock;sync()});host.querySelector('[data-u-toggle="wishlist"]')?.addEventListener('click',()=>{wish=!wish;sync()});host.querySelector('[data-u-filter-reset]')?.addEventListener('click',()=>{sort='newest';stock=false;wish=false;sync()});host.querySelector('[data-u-filter-apply]')?.addEventListener('click',()=>{shopSort=sort;shopFilterInStock=stock;shopFilterWishlist=wish;BlueGateUI.closeSheet();renderShop()})}});
}
function renderShop(){const cats=state.shop_categories||[];const filters=activeShopFilterSummary();$('shopPage').innerHTML=`<section class="shop-page-intro"><div><h2>فروشگاه</h2><p>سرویس موردنظرت رو سریع پیدا کن.</p></div></section><div class="shop-header-sticky"><div class="searchbar-modern"><span class="search-icon">⌕</span><input id="searchInput" autocomplete="off" inputmode="search" placeholder="جستجوی سرویس یا اشتراک..." value="${esc(searchTerm)}"><button class="secondary shop-filter-trigger" id="openShopFilters" aria-label="فیلتر">☷</button></div><div class="shop-active-filters">${filters.map((x,i)=>`<span class="${i||filters.length===1?'on':''}">${esc(x)}</span>`).join('')}</div><div class="category-strip modern-cats"><button class="cat-pill ${activeCategory==='all'?'active':''}" data-cat="all"><span>●</span><b>همه</b></button><button class="cat-pill ${activeCategory==='featured'?'active':''}" data-cat="featured"><span>★</span><b>ویژه</b></button>${cats.map(c=>`<button class="cat-pill ${Number(activeCategory)===Number(c.id)?'active':''}" data-cat="${c.id}">${c.image_url?`<img src="${esc(c.image_url)}">`:`<span>${esc(c.emoji||'◇')}</span>`}<b>${esc(c.title)}</b></button>`).join('')}</div></div><div id="shopSections">${shopSectionsHtml()}</div>`}
function renderShopSections(){const box=$('shopSections'); if(box) box.innerHTML=shopSectionsHtml();}
function sectionHtml(title,products,categoryId='all',allowViewAll=true){const viewBtn=allowViewAll?`<button type="button" class="section-view-all" data-cat="${esc(String(categoryId))}">View All</button>`:'';return `<section class="section-row catalog-section"><div class="section-title"><h2>${title}</h2>${viewBtn}</div><div class="h-scroll product-grid-wrap">${products.slice(0,12).map(productCard).join('')}</div></section>`}
function gridHtml(products){return products.length ? `<section class="section-row catalog-section catalog-grid-view"><div class="h-scroll product-grid-wrap">${products.map(productCard).join('')}</div></section>` : ''}
function productCard(p){
  const hasDiscount=Boolean(productDiscountInfo(p));
  const w=getWishlist();
  const wishBtn=`<button class="wishlist-fab ${w.includes(Number(p.id))?'active':''}" data-wishlist-pid="${p.id}" aria-label="نشان‌کردن">${w.includes(Number(p.id))?'❤️':'🤍'}</button>`;
  const badgeHtml=productDiscountBadgeHtml(p);
  return `<article class="product-tile catalog-tile ${hasDiscount?'discount-tile':''}" data-product-preview="${p.id}">`+
    `<div class="tile-img tile-visual">${cardImage(p,'🛍')}${badgeHtml}${wishBtn}</div>`+
    `<div class="tile-body tile-caption"><h3 class="tile-name">${esc(p.name)}</h3><div class="product-price-stack">${productCardPriceLine(p)}</div></div></article>`;
}
/* Legacy inline product purchase renderer removed in v2.8. Product Sheet owns selection and actions. */
function openVariantDetails(pid,vid){ showProduct(pid,vid); }
function closeVariantDetails(){ BlueGateUI?.closeSheet?.(); }

/* ===== Share sheet ===== *//* ===== Share sheet ===== */
function copyText(text){
  // Try modern clipboard API first, fall back to execCommand
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(
      ()=>showStatus('لینک محصول کپی شد 🔗'),
      ()=>_copyFallback(text)
    );
  } else {
    _copyFallback(text);
  }
}
function _copyFallback(text){
  try{
    const ta=document.createElement('textarea');
    ta.value=text;
    ta.setAttribute('readonly','');
    ta.style.cssText='position:fixed;left:-9999px;top:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok=document.execCommand('copy');
    ta.remove();
    showStatus(ok?'لینک محصول کپی شد 🔗':'لینک: '+text.slice(0,40));
  }catch(e){
    showStatus('لینک: '+text.slice(0,50));
  }
}
function productShareUrl(pid){
  const bot = state?.bot_username || '';
  if(bot) return `https://t.me/${encodeURIComponent(bot)}?startapp=product_${encodeURIComponent(pid)}`;
  return location.origin + location.pathname + '?product=' + encodeURIComponent(pid);
}
function openShareSheet(pid){
  const p=(state.shop_products||[]).find(x=>Number(x.id)===Number(pid));
  if(!p){ shareProductLegacy(pid); return; }
  const bot = state?.bot_username||'';
  const tgLink = bot ? `https://t.me/${encodeURIComponent(bot)}?startapp=product_${encodeURIComponent(pid)}` : null;
  const webLink = location.origin + location.pathname + '?product=' + encodeURIComponent(pid);
  _shareUrl = tgLink || webLink;
  let ss=$('shareSheet');
  if(!ss){
    ss = document.createElement('div');
    ss.id = 'shareSheet';
    ss.className = 'share-sheet';
    document.body.appendChild(ss);
  }
  if(typeof haptic === 'function') haptic('light');

  const pPriceText = p.price ? `${fmt(p.price)} تومان` : '';
  const shareText = `🛍 ${p.name}\n💰 قیمت: ${pPriceText}\n\nبرای مشاهده و خرید محصول در ربات روی لینک زیر بزنید:`;
  const tgShareUrl = `https://t.me/share/url?url=${encodeURIComponent(_shareUrl)}&text=${encodeURIComponent(shareText)}`;

  ss.innerHTML=`<div class="share-sheet-inner">
    <div class="share-sheet-handle" id="closeShareHandle"></div>
    <div class="share-sheet-head">
      <div class="share-product-thumb">${cardImage(p,'🛍')}</div>
      <div class="share-product-info">
        <h3>${esc(p.name)}</h3>
        <p class="muted">${pPriceText}</p>
      </div>
      <button class="ghost" id="closeShareX">✕</button>
    </div>
    <p class="share-hint muted">این محصول را با دوستانت به اشتراک بذار تا مستقیم وارد برنامه شوند.</p>
    <div class="share-actions">
      <button class="share-btn share-tg" id="btnShareTg">
        <span class="share-btn-icon">✈️</span>
        <div><b>اشتراک‌گذاری در تلگرام</b><small>ارسال مستقیم به مخاطبین یا چت‌ها</small></div>
      </button>
      <button class="share-btn share-copy" id="btnShareCopy">
        <span class="share-btn-icon">🔗</span>
        <div><b>کپی لینک محصول</b><small>${esc(_shareUrl.slice(0,40))}…</small></div>
      </button>
      ${navigator.share ? `
      <button class="share-btn share-native" id="btnShareNative">
        <span class="share-btn-icon">⬆️</span>
        <div><b>اشتراک‌گذاری در گوشی</b><small>واتساپ، اینستاگرام، پیامک و...</small></div>
      </button>` : ''}
    </div>
  </div>`;

  ss.classList.add('open');
  ss.style.display = 'block';

  const close = () => { ss.classList.remove('open'); ss.style.display = 'none'; };
  ss.querySelector('#closeShareHandle')?.addEventListener('click', close);
  ss.querySelector('#closeShareX')?.addEventListener('click', close);
  ss.addEventListener('click', (e) => { if (e.target === ss) close(); });

  ss.querySelector('#btnShareTg')?.addEventListener('click', () => {
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(tgShareUrl);
    } else {
      window.open(tgShareUrl, '_blank');
    }
    close();
  });

  ss.querySelector('#btnShareCopy')?.addEventListener('click', () => {
    copyText(_shareUrl);
    showStatus('لینک محصول با موفقیت کپی شد 📋');
    if(typeof haptic==='function') haptic('success');
    close();
  });

  ss.querySelector('#btnShareNative')?.addEventListener('click', async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: p.name, text: p.name, url: _shareUrl });
        showStatus('اشتراک‌گذاری انجام شد 🚀');
      }
    } catch(err) {}
    close();
  });
}
function closeShareSheet(){const ss=$('shareSheet');if(ss){ss.classList.remove('open');ss.style.display='none';_shareUrl=''}}
function miniSupportUrl(){let raw=String(state?.support_username||'BlueGateSupport').trim();if(/^https?:\/\//i.test(raw))return raw;raw=raw.replace(/^@/,'').replace(/^https?:\/\/t\.me\//i,'').split(/[/?#]/)[0].trim();return raw?`https://t.me/${encodeURIComponent(raw)}`:'https://t.me/BlueGateSupport'}
function openMiniSupport(){const url=miniSupportUrl();try{if(TG?.openTelegramLink&&/^https:\/\/t\.me\//i.test(url)){TG.openTelegramLink(url);return}if(TG?.openLink){TG.openLink(url,{try_instant_view:false});return}}catch(_){}try{window.location.href=url}catch(_){window.open(url,'_blank','noopener')}}
async function shareProductLegacy(pid){
  const p=(state.shop_products||[]).find(x=>Number(x.id)===Number(pid));
  const title = p? (p.name||'محصول') : 'محصول';
  const bot = state?.bot_username || '';
  const tgLink = bot ? `https://t.me/${encodeURIComponent(bot)}?startapp=product_${encodeURIComponent(pid)}` : null;
  const webLink = location.origin + location.pathname + '?product=' + encodeURIComponent(pid);
  const shareUrl = tgLink || webLink;
  try{
    if(navigator.share){ await navigator.share({title, text: title, url: shareUrl}); showStatus('لینک به اشتراک گذاشته شد'); return; }
  }catch(e){}
  copyText(shareUrl);
}





function showProduct(pid,preferredVariantId=0){
  const p=(state.shop_products||[]).find(x=>Number(x.id)===Number(pid));
  if(!p)return;
  if(Number(p.child_count||0)>0&&openCatalogServiceGroups(p)){pushRecent(p.id);return}
  pushRecent(p.id);
  const variants=(p.variants||[]).filter(v=>Number(v.is_active??1)!==0).map(v=>({
    id:Number(v.id),title:v.title||'پلن',price:Number(v.price||0),duration_days:Number(v.duration_days||0),
    description:v.description||'',old_price:Number(v.old_price||0),discount_percent:Number(v.discount_percent||0),
    product_id:Number(v.product_id||p.id)
  }));
  const preferred=variants.some(v=>Number(v.id)===Number(preferredVariantId))?Number(preferredVariantId):(variants[0]?.id||null);
  const delivery=p.delivery_type_fa||({manual:'تحویل دستی',account:'اکانت اختصاصی',vpn:'سرویس VPN',code:'کد دیجیتال',file:'فایل / متن'}[p.delivery_type]||'تحویل پس از ثبت');
  if(!window.BlueGatePurchase){showStatus('پنجره خرید هنوز بارگذاری نشده. دوباره تلاش کن.','error');return;}
  window.BlueGatePurchase.open({
    productId:Number(p.id),variantId:preferred,product:p.name,description:p.full_description||p.short_description||'',
    image:p.image_url||'',icon:p.category_emoji||p.config?.icon||'⚡',badge:p.category_title||state.brand||'BlueGate',
    delivery,price:Number(p.price||variants[0]?.price||0),variants,
    onShare:()=>{ window.BlueGatePurchase.close(); openShareSheet(p.id); },
    onCart:({variantId})=>{cartAdd(p.id,variantId||0);showStatus('به سبد خرید اضافه شد');},
    onError:(err)=>showStatus(err?.message||'ثبت سفارش انجام نشد.','error'),
    onCouponPreview:async({code,productId,variantId})=>api('preview_coupon',{code,product_id:Number(productId),variant_id:variantId||null}),
    onSubmit:async({productId,variantId,orderProductId,coupon})=>{
      const guest=Boolean(state?.is_guest||state?.user?.is_guest||!state?.user);
      if(guest){window.BlueGatePurchase.close();openAuthModal('login');throw new Error('برای ثبت سفارش اول وارد حساب شو.');}
      const resolved=resolveMiniPurchase(productId,variantId);
      if(!resolved||resolved.needsVariant)throw new Error('پلن انتخاب‌شده معتبر نیست. دوباره انتخاب کن.');
      const res=await api('create_order',{product_id:Number(orderProductId||resolved.orderProductId),variant_id:resolved.variant?.id||null,use_wallet:0});
      const oid=Number(res?.order?.id||res?.order_id||0);
      let couponWarn=false;
      if(coupon&&oid){try{await api('apply_coupon',{order_id:oid,code:coupon})}catch(_){couponWarn=true;}}
      state=await api('me');applyTheme(state);currentTab='orders';currentOrderId=oid||Number(state.orders?.[0]?.id||0)||null;renderUser();
      showStatus(couponWarn?'سفارش ثبت شد؛ کد تخفیف معتبر نبود.':'⚡ سفارش با موفقیت ثبت شد',couponWarn?'warning':'success');
    }
  });
  haptic('light');
}

function openOrderFiltersSheet(){const opts=[['all','همه'],['active','فعال'],['pending_payment','در انتظار پرداخت'],['receipt_submitted','در بررسی رسید'],['delivered','تکمیل‌شده'],['cleanup','لغو / رد شده']];BlueGateUI.openSheet({type:'action',eyebrow:'سفارش‌ها',title:'فیلتر سفارش‌ها',body:`<div class="filter-choice-grid" style="grid-template-columns:1fr 1fr">${opts.map(x=>`<button data-u-order-filter="${x[0]}" class="${orderFilter===x[0]?'active':''}">${x[1]}</button>`).join('')}</div>`,onOpen:(host)=>host.querySelectorAll('[data-u-order-filter]').forEach(b=>b.addEventListener('click',()=>{orderFilter=b.dataset.uOrderFilter;BlueGateUI.closeSheet();renderOrders()}))})}
function openOrdersManageSheet(){BlueGateUI.openSheet({type:'action',eyebrow:'مدیریت',title:'مدیریت لیست سفارش‌ها',body:`<div class="order-more-actions"><button class="danger" data-u-clear-canceled>حذف سفارش‌های لغو/رد شده از لیست</button></div>`,onOpen:(host)=>host.querySelector('[data-u-clear-canceled]')?.addEventListener('click',async()=>{if(await BlueGateUI.confirm({title:'پاکسازی لیست',message:'سفارش‌های لغو و ردشده از لیست شما مخفی شوند؟',confirmText:'پاکسازی',danger:true})){await loadAfterAction('clear_canceled_orders');currentOrderId=null;BlueGateUI.closeSheet();renderOrders()}})})}
function renderOrders(){const all=state.orders||[];if(currentOrderId){const o=orderById(currentOrderId);if(!o){currentOrderId=null;return renderOrders()}$('ordersPage').innerHTML=orderDetailHtml(o);return}const visibleFilter=orderFilter==='cleanup'?'all':orderFilter;const orders=all.filter(o=>orderFilter==='all'||(orderFilter==='active'&&!canHideOrder(o)&&o.status!=='delivered')||(orderFilter==='cleanup'&&canHideOrder(o))||o.status===orderFilter);const quick=[['active','فعال'],['delivered','تکمیل‌شده'],['all','همه']];$('ordersPage').innerHTML=`<section class="orders-header"><div><h2>سفارش‌های من</h2><p class="muted">وضعیت خریدها و سرویس‌های تحویل‌شده.</p></div><button class="secondary orders-manage-btn" id="ordersManageBtn">•••</button></section><div class="order-filters">${quick.map(f=>`<button class="filter-chip ${visibleFilter===f[0]?'active':''}" data-order-filter="${f[0]}">${f[1]}</button>`).join('')}<button class="filter-chip advanced-filter" id="orderAdvancedFilter">فیلتر ☷</button></div><div class="order-list">${orders.map(orderRowHtml).join('')||'<div class="u-empty"><div class="u-empty-icon">▤</div><h3>سفارشی در این بخش نیست</h3><p>بعد از خرید سرویس، وضعیت سفارش اینجا نمایش داده میشه.</p><button class="primary" data-tab-jump="shop">رفتن به فروشگاه</button></div>'}</div>`}
function orderRowHtml(o){
  const paid=Number(o.wallet_amount||0)>0?` · اعتبار BlueGate ${fmt(o.wallet_amount)}`:'';
  const d=Number(o.variant_discount_percent)||0;
  let priceStr=`مانده ${fmt(o.final_amount)}`;
  if(d>0){
    const orig=Math.round(Number(o.amount)/(1-d/100));
    priceStr=`<s class="muted" style="font-size:14px">${fmt(orig)}</s> <span style="font-weight:600;color:var(--text)">${fmt(o.final_amount)}</span> <span class="flash-pill" style="padding:2px 4px;font-size:13px">−${nf(d)}٪</span>`;
  }
  const remSec = getOrderRemainingSeconds(o);
  const isPendingRow = ['pending_payment','pending'].includes(String(o.status||'').toLowerCase());
  const timerPill = (isPendingRow && remSec > 0) ? `<span class="payment-countdown-pill" data-order-timer="${o.id}" data-expires-at="${esc(o.payment_expires_at||'')}"><span class="timer-icon">⏳</span> <b class="timer-val">${formatMMSS(remSec)}</b></span>` : '';
  return `<article class="order-row" data-order-open="${o.id}" style="flex-direction:column;align-items:stretch"><div class="order-row-main" style="margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;width:100%;gap:10px"><div class="order-icon">${o.image_url?`<img src="${esc(o.image_url)}">`:'🧾'}</div><div style="flex:1"><h3>#${nf(o.id)} · ${esc(o.display_name)}</h3><p class="muted" style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin-top:4px">${esc(o.created_at||'')} · ${priceStr}${paid} ${timerPill}</p></div><div style="display:flex;align-items:center;gap:6px">${orderStatusBadge(o)}<span class="chev" style="font-size:20px;color:var(--muted)">‹</span></div></div><div class="order-row-stepper" style="width:100%">${orderStepperHtml(o)}</div></article>`
}

function wheelGradient(rewards=[]){const colors=['#1d9bf0','#22c55e','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#ef4444','#84cc16'];const list=rewards.length?rewards:[{title:'جایزه'}];const step=100/list.length;return `conic-gradient(${list.map((_,i)=>`${colors[i%colors.length]} ${i*step}% ${(i+1)*step}%`).join(',')})`}
function wheelPrizeList(rewards=[]){return (rewards||[]).slice(0,8).map(r=>`<div class="wheel-prize"><b>${esc(r.title||'جایزه')}</b><br><span>${Number(r.amount||0)>0?fmt(r.amount):'جایزه دستی'}</span></div>`).join('') || '<p class="muted">جایزه‌ای تعریف نشده.</p>'}
function renderSpinWheel(){const rewards=state.spin_rewards||[];const chances=Number(state.user?.spin_balance||0);return `<article class="wallet-card spin-section spin-section-v2"><div class="spin-head"><div class="spin-head-icon">🎡</div><div class="spin-head-text"><small>گردونه شانس روزانه</small><h3>بچرخون، ببر!</h3></div><div class="spin-chances-badge"><b>${nf(chances)}</b><span>شانس</span></div></div><p class="muted spin-desc">برای هر ${nf(state.spin_every||5)} زیرمجموعه جدید، یک شانس چرخوندن می‌گیری. جایزه‌ها خودکار به اعتبار BlueGate اضافه می‌شه.</p><div class="wheel-stage"><div class="wheel-pointer-v2">▼</div><div class="wheel-glow"></div><div id="spinWheel" class="spin-wheel spin-wheel-v2" style="background:${wheelGradient(rewards)}"><div class="wheel-center wheel-center-v2"><span>SPIN</span></div></div></div><button id="spinBtn" class="primary spin-btn-v2" ${chances<=0?'disabled':''}>${chances>0?'🎡 چرخوندن گردونه':'فعلاً شانسی نداری'}</button><div id="spinResult" class="spin-result ${lastSpinPrize?'':'hidden'}">${lastSpinPrize?`🎉 جایزه آخر شما: <b>${esc(lastSpinPrize.title||'جایزه گردونه')}</b>${Number(lastSpinPrize.amount||0)>0?`<br>به اعتبار BlueGate اضافه شد: <b>${fmt(lastSpinPrize.amount)}</b>`:''}`:''}</div><div class="wheel-prizes">${wheelPrizeList(rewards)}</div></article>`}
async function doSpinWheel(){const btn=$('spinBtn'), wheel=$('spinWheel'), result=$('spinResult');if(!btn||btn.disabled)return;btn.disabled=true;btn.textContent='در حال چرخش...';if(result)result.classList.add('hidden');const rewards=state.spin_rewards||[];const count=Math.max(1,rewards.length);const start=Number(wheel?.dataset.rot||0);const fakeIndex=Math.floor(Math.random()*count);const degPer=360/count;const target=start + 1440 + (360 - (fakeIndex*degPer + degPer/2));if(wheel){wheel.dataset.rot=String(target);wheel.style.transform=`rotate(${target}deg)`;}try{await new Promise(r=>setTimeout(r,1800));const data=await api('spin');const prize=data.prize||{};state=data;applyTheme(state);const idx=Number(prize.index ?? fakeIndex);const finalRot=start + 2160 + (360 - (idx*degPer + degPer/2));if(wheel){wheel.dataset.rot=String(finalRot);wheel.style.transform=`rotate(${finalRot}deg)`;}await new Promise(r=>setTimeout(r,2400));lastSpinPrize=prize;if(result){result.innerHTML=`🎉 جایزه شما: <b>${esc(prize.title||'جایزه گردونه')}</b>${Number(prize.amount||0)>0?`<br>به اعتبار BlueGate اضافه شد: <b>${fmt(prize.amount)}</b>`:''}`;result.classList.remove('hidden')}showStatus('جایزه گردونه ثبت شد');renderWallet()}catch(e){showStatus(e.message||'خطا در گردونه','error');btn.disabled=false;btn.textContent='چرخاندن گردونه'}}

/* ── Wallet sub-tab helpers ────────────────────────────────────── */
function referralVipMini(u){const vip=u?.vip||{},refs=Number(u?.referrals_count||0),base=Number(vip.min_ref||0),next=vip.next===null||vip.next===undefined?null:Number(vip.next);const pct=next===null?100:Math.max(0,Math.min(100,Math.round((refs-base)/Math.max(1,next-base)*100)));const left=next===null?0:Math.max(0,next-refs);return `<article class="wallet-card ref-vip-card-v2"><div class="ref-vip-head-v2"><div class="ref-vip-emoji-v2">${esc(vip.emoji||'🥉')}</div><div><small>سطح همکاری</small><h3>${esc(vip.fa||vip.name||'برنز')}</h3><p class="muted">${next===null?'بالاترین سطح همکاری را داری':`${nf(left)} معرفی تا ${esc(vip.next_fa||vip.next_name||'سطح بعدی')} ${esc(vip.next_emoji||'✨')}`}</p></div></div><div class="ref-vip-track-v2"><i style="width:${pct}%"></i></div></article>`}
function openReferralShareMini(){const u=state.user;if(!u)return;const link=u.referral_link||'',code=u.ref_code||'';if(!link)return showStatus('لینک دعوت در دسترس نیست','error');const ss=$('shareSheet');if(!ss)return;ss.innerHTML=`<div class="share-sheet-inner referral-share-mini"><div class="share-sheet-handle" data-close-share></div><div class="share-sheet-head"><div class="share-product-thumb" style="font-size:25px;display:grid;place-items:center">🤝</div><div class="share-product-info"><h3>اشتراک‌گذاری دعوت</h3><p class="muted">کد ${esc(code||'—')}</p></div><button class="ghost" data-close-share>✕</button></div><div class="share-actions"><button class="share-btn share-native" id="refNativeShare"><span class="share-btn-icon">↗</span><div><b>اشتراک‌گذاری</b><small>از Share دستگاه استفاده کن</small></div></button><button class="share-btn share-tg" id="refTelegramShare"><span class="share-btn-icon">✈️</span><div><b>ارسال در Telegram</b><small>ارسال مستقیم لینک دعوت</small></div></button><button class="share-btn share-copy" id="refCopyLink"><span class="share-btn-icon">🔗</span><div><b>کپی لینک</b><small>${esc(link)}</small></div></button><button class="share-btn" id="refCopyCode"><span class="share-btn-icon">📋</span><div><b>کپی کد دعوت</b><small>${esc(code)}</small></div></button><button class="share-btn" id="refShowQr"><span class="share-btn-icon">▦</span><div><b>نمایش QR</b><small>برای معرفی حضوری</small></div></button></div></div>`;ss.style.display='block';ss.classList.add('open');ss.querySelectorAll('[data-close-share]').forEach(x=>x.addEventListener('click',closeShareSheet));$('refNativeShare')?.addEventListener('click',async()=>{try{if(navigator.share)await navigator.share({title:document.title,url:link});else{await navigator.clipboard?.writeText(link);showStatus('لینک کپی شد')}}catch(_){}});$('refTelegramShare')?.addEventListener('click',()=>{if(TG?.openTelegramLink)TG.openTelegramLink('https://t.me/share/url?url='+encodeURIComponent(link));else window.open('https://t.me/share/url?url='+encodeURIComponent(link),'_blank')});$('refCopyLink')?.addEventListener('click',()=>{navigator.clipboard?.writeText(link);showStatus('لینک دعوت کپی شد')});$('refCopyCode')?.addEventListener('click',()=>{navigator.clipboard?.writeText(code);showStatus('کد دعوت کپی شد')});$('refShowQr')?.addEventListener('click',()=>{closeShareSheet();openQrSheet()})}
function openCustomReferralCodeMini(){const u=state.user||{},min=Number(state.custom_code_min||3),eligible=Number(u.referrals_count||0)>=min;if(!eligible)return showStatus(`برای تغییر کد حداقل ${nf(min)} زیرمجموعه لازم است`,'error');openEdit('شخصی‌سازی لینک دعوت',[{title:'کد اختصاصی',fields:[{id:'mini_ref_code',label:'کد دعوت',value:u.ref_code||'',placeholder:'BLUEPALI'}]}],async()=>{const code=String(val('mini_ref_code')||'').trim();if(code.length<4||code.length>20)return showStatus('کد باید ۴ تا ۲۰ کاراکتر باشد','error');state=await api('custom_code',{code});showStatus('کد دعوت بروزرسانی شد');renderWallet()})}
function creditTxKindMini(t={}){const type=String(t.type||'').toLowerCase();if(type==='credit_topup')return 'topup';if(type.includes('refund'))return 'refund';if(type.includes('reward')||type.includes('referral')||type.includes('spin')||type.includes('mission'))return 'reward';if(Number(t.amount)<0)return 'purchase';return 'other'}
function miniCreditStatusClass(s){return ['payment_confirmed'].includes(s)?'ok':['rejected','canceled'].includes(s)?'bad':'wait'}
function miniCreditMissionRow(m,u){const today=Number(u.today_referrals||0),target=Math.max(1,Number(m.target||m.referrals||0)),progress=Math.max(0,Math.min(target,today)),pct=Math.round(progress/target*100),reward=Number(m.reward||m.amount||0);return `<div class="credit-mission-mini-row"><div><b>${nf(target)} دعوت امروز</b><small>پاداش ${fmt(reward)} اعتبار</small></div><div class="credit-mission-mini-meta"><span>${nf(progress)} / ${nf(target)}</span><i><em style="width:${pct}%"></em></i></div></div>`}
function ensureMiniCreditTopupSheet(){let o=$('miniCreditTopupSheet');if(!o){o=document.createElement('div');o.id='miniCreditTopupSheet';o.className='mini-credit-topup-sheet';document.body.appendChild(o)}return o}
function closeMiniCreditTopup(){const o=$('miniCreditTopupSheet');if(o){o.classList.remove('open');o.innerHTML=''}}
function miniTopupShell(title,subtitle,body,eyebrow='BLUEGATE CREDIT'){const o=ensureMiniCreditTopupSheet();o.innerHTML=`<div class="mini-credit-topup-backdrop" data-mini-topup-close></div><section class="mini-credit-topup-panel" role="dialog" aria-modal="true"><div class="mini-credit-sheet-handle"></div><header><div><small>${esc(eyebrow)}</small><h3>${esc(title)}</h3><p>${esc(subtitle||'')}</p></div><button class="ghost" type="button" data-mini-topup-close>✕</button></header><div class="mini-credit-topup-body">${body}</div></section>`;o.classList.add('open');o.querySelectorAll('[data-mini-topup-close]').forEach(x=>x.addEventListener('click',closeMiniCreditTopup));return o}
function openMiniCreditTopup(){const cfg=state.credit_topup||{};if(cfg.enabled===false)return showStatus('شارژ اعتبار فعلاً غیرفعال است','error');const presets=(cfg.presets||[100000,200000,500000]).map(Number).filter(Boolean);const min=Number(cfg.min||50000),max=Number(cfg.max||5000000),balance=Number(state.user?.balance||0);const o=miniTopupShell('شارژ حساب','مبلغ موردنظر را انتخاب کن.',`<div class="mini-topup-balance"><span>اعتبار فعلی</span><b>${fmt(balance)}</b></div><div class="mini-topup-presets">${presets.map(v=>`<button type="button" data-mini-topup-amount="${v}">${fmt(v)}</button>`).join('')}</div><label class="mini-topup-custom">مبلغ دلخواه<input id="miniTopupCustom" type="number" inputmode="numeric" min="${min}" max="${max}" placeholder="از ${fmt(min)} تا ${fmt(max)}"></label><div class="mini-topup-after"><span>اعتبار بعد از پرداخت</span><b id="miniTopupAfter">${fmt(balance)}</b></div><button class="primary wide" id="miniTopupContinue" type="button">ادامه</button><p class="muted mini-topup-limit">حداقل ${fmt(min)} · حداکثر ${fmt(max)}</p>`);let chosen=0;const inp=o.querySelector('#miniTopupCustom'),after=o.querySelector('#miniTopupAfter');const choose=v=>{chosen=Number(v||0);if(inp)inp.value=chosen||'';o.querySelectorAll('[data-mini-topup-amount]').forEach(b=>b.classList.toggle('active',Number(b.dataset.miniTopupAmount)===chosen));if(after)after.textContent=fmt(balance+chosen)};o.querySelectorAll('[data-mini-topup-amount]').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.miniTopupAmount)));inp?.addEventListener('input',()=>{chosen=Number(inp.value||0);o.querySelectorAll('[data-mini-topup-amount]').forEach(b=>b.classList.remove('active'));if(after)after.textContent=fmt(balance+Math.max(0,chosen))});o.querySelector('#miniTopupContinue')?.addEventListener('click',async()=>{if(chosen<min||chosen>max)return showStatus(`مبلغ باید بین ${fmt(min)} و ${fmt(max)} باشد`,'error');try{const r=await api('create_credit_topup',{amount:chosen});state=r;openMiniTopupMethods(r.topup)}catch(e){showStatus(e.message||'ساخت درخواست شارژ انجام نشد','error')}});if(presets[0])choose(presets[0])}
function openMiniTopupMethods(t){const cfg=state.credit_topup||{},m=cfg.methods||{},pm=state.payment_methods||{};const methods=[];if(m.card&&pm.card?.enabled)methods.push(`<button type="button" data-mini-topup-method="card"><span>💳</span><div><b>کارت به کارت</b><small>ارسال رسید و بررسی ادمین</small></div><i>←</i></button>`);if(m.stars&&pm.stars?.enabled)methods.push(`<button type="button" data-mini-topup-method="stars"><span>⭐</span><div><b>Telegram Stars</b><small>پرداخت مستقیم داخل تلگرام</small></div><i>←</i></button>`);if(m.crypto&&pm.crypto?.enabled)methods.push(`<button type="button" data-mini-topup-method="crypto"><span>🪙</span><div><b>رمزارز</b><small>واریز به ولت و ثبت TXID</small></div><i>←</i></button>`);const o=miniTopupShell('روش پرداخت',`شارژ ${fmt(t.amount)} اعتبار`,`<div class="mini-topup-method-list">${methods.join('')||'<div class="hub-empty">روش پرداخت فعالی برای شارژ وجود ندارد.</div>'}</div><button type="button" class="ghost wide" id="miniTopupBackAmount">← تغییر مبلغ</button>`);o.querySelector('#miniTopupBackAmount')?.addEventListener('click',async()=>{try{await api('cancel_credit_topup',{topup_id:t.id})}catch(_){}openMiniCreditTopup()});o.querySelectorAll('[data-mini-topup-method]').forEach(b=>b.addEventListener('click',async()=>{const method=b.dataset.miniTopupMethod;try{if(method==='stars'){const r=await api('credit_topup_start_stars',{topup_id:t.id});state=r;openMiniTopupDone(r.topup,'فاکتور Stars ارسال شد؛ بعد از پرداخت اعتبار خودکار اضافه می‌شود.');return}if(method==='card'){const r=await api('credit_topup_set_method',{topup_id:t.id,method:'card'});state=r;openMiniTopupCard(r.topup);return}openMiniTopupCryptoChoose(t)}catch(e){showStatus(e.message||'انتخاب روش پرداخت انجام نشد','error')}}))}
function openMiniTopupCard(t){const accounts=t.payment_details?.accounts||[];const inst=t.payment_details?.instructions||state.payment_instructions||'';const o=miniTopupShell('کارت به کارت',`مبلغ دقیق: ${fmt(t.amount)}`,`<div class="mini-topup-card-list">${accounts.map((a,i)=>`<button type="button" class="mini-topup-bank ${i===0?'active':''}" data-mini-card-index="${i}"><b>${esc(a.title||a.bank||'کارت')}</b><strong>${esc(a.card||a.card_number||'')}</strong><small>${esc(a.name||a.holder||'')}</small></button>`).join('')||'<div class="hub-empty">اطلاعات کارت تنظیم نشده.</div>'}</div>${inst?`<p class="mini-topup-instructions">${esc(inst)}</p>`:''}<label class="mini-topup-file">تصویر رسید<input id="miniTopupReceipt" type="file" accept="image/jpeg,image/png,image/webp"></label><label class="mini-topup-custom">توضیح اختیاری<textarea id="miniTopupNote" rows="2" placeholder="مثلاً چهار رقم آخر کارت"></textarea></label><button class="primary wide" id="miniTopupReceiptSubmit" type="button">ارسال رسید برای بررسی</button>`);o.querySelectorAll('[data-mini-card-index]').forEach(b=>b.addEventListener('click',()=>{o.querySelectorAll('[data-mini-card-index]').forEach(x=>x.classList.remove('active'));b.classList.add('active')}));o.querySelector('#miniTopupReceiptSubmit')?.addEventListener('click',async()=>{const f=o.querySelector('#miniTopupReceipt')?.files?.[0];if(!f)return showStatus('تصویر رسید را انتخاب کن','error');if(f.size>5*1024*1024)return showStatus('حجم رسید حداکثر ۵ مگابایت است','error');const reader=new FileReader();reader.onload=async ev=>{try{const r=await api('credit_topup_submit_receipt',{topup_id:t.id,note:o.querySelector('#miniTopupNote')?.value||'',receipt_b64:ev.target.result});state=r;openMiniTopupDone(r.topup,'رسید ثبت شد و منتظر بررسی است.');renderWallet()}catch(e){showStatus(e.message||'ارسال رسید انجام نشد','error')}};reader.readAsDataURL(f)})}
function openMiniTopupCryptoChoose(t){const wallets=state.payment_methods?.crypto?.wallets||[];const o=miniTopupShell('انتخاب رمزارز','ولت مقصد را انتخاب کن.',`<div class="mini-topup-method-list">${wallets.map(w=>`<button type="button" data-mini-crypto-wallet="${w.id}"><span>🪙</span><div><b>${esc(w.asset||'Crypto')} · ${esc(w.network||'')}</b><small>${esc(w.label||w.title||'ولت پرداخت')}</small></div><i>←</i></button>`).join('')||'<div class="hub-empty">ولت فعالی تنظیم نشده.</div>'}</div>`);o.querySelectorAll('[data-mini-crypto-wallet]').forEach(b=>b.addEventListener('click',async()=>{try{const r=await api('credit_topup_set_method',{topup_id:t.id,method:'crypto',details:{wallet_id:Number(b.dataset.miniCryptoWallet)}});state=r;openMiniTopupCryptoPay(r.topup)}catch(e){showStatus(e.message||'آماده‌سازی پرداخت رمزارز انجام نشد','error')}}))}
function openMiniTopupCryptoPay(t){const d=t.payment_details||{};const o=miniTopupShell('پرداخت رمزارز',`${esc(d.asset||t.crypto_asset||'')} · ${esc(d.network||t.crypto_network||'')}`,`<div class="mini-topup-crypto-box"><small>مبلغ دقیق</small><strong>${esc(String(d.expected_amount||t.crypto_amount||'—'))} ${esc(d.asset||t.crypto_asset||'')}</strong><small>آدرس مقصد</small><code>${esc(d.address||'—')}</code><button class="ghost wide" id="miniCopyCryptoAddress" type="button">کپی آدرس</button></div><label class="mini-topup-custom">TXID<input id="miniTopupTxid" autocomplete="off" placeholder="Transaction Hash"></label><button class="primary wide" id="miniTopupTxSubmit" type="button">ثبت TXID</button>`);o.querySelector('#miniCopyCryptoAddress')?.addEventListener('click',()=>{navigator.clipboard?.writeText(d.address||'');showStatus('آدرس کپی شد')});o.querySelector('#miniTopupTxSubmit')?.addEventListener('click',async()=>{const tx=o.querySelector('#miniTopupTxid')?.value.trim()||'';if(!tx)return showStatus('TXID را وارد کن','error');try{const r=await api('credit_topup_submit_crypto_hash',{topup_id:t.id,tx_hash:tx});state=r;openMiniTopupDone(r.topup,'TXID ثبت شد و منتظر بررسی است.');renderWallet()}catch(e){showStatus(e.message||'ثبت TXID انجام نشد','error')}})}
function openMiniTopupDone(t,msg){const o=miniTopupShell('درخواست شارژ ثبت شد',msg||'وضعیت درخواست را از تاریخچه اعتبار می‌تونی ببینی.',`<div class="mini-topup-success"><span>✓</span><b>${fmt(t?.amount||0)}</b><small>${esc(t?.status_fa||'ثبت شد')}</small></div><button class="primary wide" id="miniTopupDoneBtn" type="button">متوجه شدم</button>`);o.querySelector('#miniTopupDoneBtn')?.addEventListener('click',()=>{closeMiniCreditTopup();renderWallet()})}
function _walletOverview(u){const cfg=state.credit_topup||{},topups=state.credit_topups||[],txs=state.transactions||[],active=topups.filter(x=>['pending_payment','receipt_submitted','reviewing'].includes(x.status));return `<div class="wallet-tab-panel credit-center-mini-v27"><section class="mini-credit-hero-v27"><div><small>BLUEGATE CREDIT</small><h2>اعتبار شما</h2><strong data-count-anim="${u.balance}">${fmt(u.balance)}</strong><p>برای خرید و تمدید سرویس‌ها؛ قابل برداشت نقدی نیست.</p></div><div class="mini-credit-hero-actions"><button class="primary" id="miniCreditTopup" ${cfg.enabled===false?'disabled':''}>＋ شارژ حساب</button><button class="ghost" data-credit-view="history">تراکنش‌ها</button></div></section><section class="mini-credit-stats-v27"><div><small>پاداش کل</small><b>${fmt(u.total_earned||0)}</b></div><div><small>دعوت موفق</small><b>${nf(u.referrals_count||0)}</b></div><div><small>شانس گردونه</small><b>${nf(u.spin_balance||0)}</b></div><div><small>دعوت امروز</small><b>${nf(u.today_referrals||0)}</b></div></section>${active.length?`<article class="wallet-card mini-credit-pending"><div class="section-title"><div><h2>درخواست‌های شارژ باز</h2><small>${nf(active.length)} مورد</small></div></div>${active.slice(0,3).map(x=>`<div class="mini-topup-open-row"><div class="mini-topup-open-main"><span>#${nf(x.id)} · ${fmt(x.amount)}</span><small>${esc(x.payment_method_fa||'روش پرداخت انتخاب نشده')}</small></div><em class="${miniCreditStatusClass(x.status)}">${esc(x.status_fa||x.status)}</em><div class="mini-topup-open-actions"><button type="button" data-mini-topup-change="${x.id}">تغییر روش</button><button type="button" class="danger" data-mini-topup-cancel="${x.id}">لغو</button></div></div>`).join('')}</article>`:''}<article class="wallet-card mini-credit-history-preview"><div class="section-title"><div><h2>آخرین تراکنش‌ها</h2><small>شارژ، خرید و پاداش</small></div><button class="ghost" data-credit-view="history">همه</button></div><div class="mini-credit-tx-list">${txs.slice(0,4).map(t=>`<div><span class="mini-credit-tx-icon ${creditTxKindMini(t)}">${Number(t.amount)>=0?'↑':'↓'}</span><div><b>${esc(t.description||t.type)}</b><small>${esc(t.created_at||'')}</small></div><strong class="${Number(t.amount)>=0?'positive':'negative'}">${Number(t.amount)>=0?'+':''}${fmt(t.amount)}</strong></div>`).join('')||`<div class="u-empty"><div class="u-empty-icon">◫</div><h3>هنوز تراکنشی نداری</h3><p>اولین خرید یا شارژ حساب اینجا ثبت میشه.</p><button class="primary" id="miniCreditTopupEmpty" ${cfg.enabled===false?'disabled':''}>شارژ حساب</button></div>`}</div></article></div>`}
function _walletReferral(u){
  const eligible=Number(u.referrals_count||0)>=Number(state.custom_code_min||3),code=u.ref_code||'';
  return `<div class="wallet-tab-panel referral-center-mini-v2">
    <section class="wallet-dashboard referral-wallet-hero-v2">
      <div class="wallet-card-main"><small>اعتبار قابل استفاده در فروشگاه</small><strong data-count-anim="${u.balance}">${fmt(u.balance)}</strong><p>پاداش دعوت و خریدهای واجد شرایط مستقیم به اعتبار BlueGate اضافه می‌شن.</p></div>
      <div class="wallet-mini-grid referral-stats-mini-v2"><div><b>${nf(u.referrals_count)}</b><span>معرفی‌ها</span></div><div><b>${nf(u.today_referrals)}</b><span>امروز</span></div><div><b>${fmt(u.total_earned)}</b><span>کل پاداش</span></div><div><b>${esc(u.vip?.emoji||'🥉')} ${esc(u.vip?.fa||u.vip?.name||'برنز')}</b><span>سطح همکاری</span></div></div>
    </section>
    ${referralVipMini(u)}
    <article class="wallet-card referral-card referral-card-v2">
      <div class="referral-card-head"><span class="referral-icon">🔗</span><div><h3>لینک دعوت شما</h3><p class="muted">بفرست، معرفی کن و پیشرفتت رو همین‌جا ببین.</p></div></div>
      <button class="ref-link-mini-v2" id="shareInviteNative"><small>کد دعوت</small><b>${esc(code||'—')}</b><span>اشتراک‌گذاری ↗</span></button>
      <div class="ref-mini-actions-v2"><button class="primary" id="openReferralShareMini">اشتراک‌گذاری</button><button class="ghost" id="copyLink">کپی لینک</button><button class="ghost" id="openQrWallet">QR</button></div>
      <details class="ref-custom-mini-v2"><summary>شخصی‌سازی لینک <span>${eligible?'اختیاری':`بعد از ${nf(state.custom_code_min||3)} معرفی`}</span></summary><p class="muted">${eligible?'می‌تونی کد کوتاه‌تر و برندشده برای لینک دعوتت انتخاب کنی.':`برای تغییر کد حداقل ${nf(state.custom_code_min||3)} زیرمجموعه لازم است.`}</p><button class="secondary" id="openCustomReferralCode" ${eligible?'':'disabled'}>ویرایش کد اختصاصی</button></details>
    </article>
    <div id="referralTreePlaceholder"><article class="wallet-card referral-tree-card"><div class="referral-tree-head"><span class="admin-card-icon">👥</span><div><h3>زیرمجموعه‌های من</h3><p class="muted">در حال بارگذاری...</p></div></div></article></div>
  </div>`;
}
function _walletMissions(u){
  const today=Number(u.today_referrals||0);
  return `<div class="wallet-tab-panel">
    ${renderSpinWheel()}
    <article class="wallet-card missions-panel">
      <div class="section-title"><h2>🎯 ماموریت‌های امروز</h2><small>${nf(today)} دعوت امروز</small></div>
      <div class="missions-grid">${(state.missions||[]).map(missionCard).join('')||'<p class="muted">مأموریتی نیست.</p>'}</div>
      <button class="success" id="claimBtn" style="width:100%;margin-top:10px">دریافت پاداش‌های آماده</button>
    </article>
  </div>`;
}
function _walletHistory(u){
  const txs=state.transactions||[],topups=state.credit_topups||[];
  return `<div class="wallet-tab-panel credit-history-mini-v27"><article class="wallet-card"><div class="section-title" style="margin-bottom:14px"><div><h2>📋 تاریخچه اعتبار</h2><small>${nf(txs.length)} تراکنش</small></div><button class="primary" id="miniCreditTopupHistory" ${state.credit_topup?.enabled===false?'disabled':''}>＋ شارژ</button></div>${topups.length?`<div class="mini-topup-history-strip">${topups.slice(0,4).map(x=>`<div><span><b>شارژ #${nf(x.id)}</b><small>${fmt(x.amount)}</small></span><em class="${miniCreditStatusClass(x.status)}">${esc(x.status_fa||x.status)}</em></div>`).join('')}</div>`:''}<div class="mini-credit-tx-list">${txs.map(t=>`<div><span class="mini-credit-tx-icon ${creditTxKindMini(t)}">${Number(t.amount)>=0?'↑':'↓'}</span><div><b>${esc(t.description||t.type)}</b><small>${esc(t.created_at||'')}</small></div><strong class="${Number(t.amount)<0?'negative':'positive'}">${Number(t.amount)>=0?'+':''}${fmt(t.amount)}</strong></div>`).join('')||'<div class="mini-credit-empty"><b>هنوز تراکنشی ثبت نشده</b><p>از شارژ حساب یا خرید سرویس شروع کن.</p><button class="primary" id="miniCreditTopupHistoryEmpty">شارژ حساب</button></div>'}</div></article></div>`;
}
function openCreditSubview(kind){const u=state.user||{};let title='',subtitle='',body='';if(kind==='referral'){title='دعوت دوستان';subtitle='لینک دعوت، سطح همکاری و زیرمجموعه‌ها';body=_walletReferral(u)}else if(kind==='rewards'){title='پاداش‌ها';subtitle='ماموریت‌های روزانه و گردونه شانس';body=_walletMissions(u)}else{title='تاریخچه اعتبار';subtitle='شارژ، خرید، پاداش و بازگشت وجه';body=_walletHistory(u)}const host=BlueGateUI.openSheet({type:'fullscreen',eyebrow:'BLUEGATE CREDIT',title,subtitle,body,onOpen:()=>{triggerBalanceAnims();if(kind==='referral')loadReferralTree().then(refs=>{const ph=$('referralTreePlaceholder');if(ph)ph.innerHTML=referralTreeHtml(refs)})}});return host}
function renderWallet(){
  const u=state.user||{};lastSpinPrize=null;
  $('walletPage').innerHTML=_walletOverview(u);
  const overview=$('walletPage');
  const launch=`<div class="credit-launch-grid"><button class="credit-launch" data-credit-view="history"><b>تراکنش‌ها</b><small>تاریخچه اعتبار</small></button><button class="credit-launch" data-credit-view="referral"><b>دعوت دوستان</b><small>${nf(u.referrals_count||0)} معرفی</small></button><button class="credit-launch" data-credit-view="rewards"><b>پاداش‌ها</b><small>${nf(u.spin_balance||0)} شانس گردونه</small></button></div>`;
  const main=overview.querySelector('.mini-credit-hero-v27')||overview.querySelector('.credit-hero-mini-v27')||overview.firstElementChild;if(main)main.insertAdjacentHTML('afterend',launch);else overview.insertAdjacentHTML('afterbegin',launch);
  triggerBalanceAnims();
}
async function reload(){state=await api('me');applyTheme(state);renderUser()}
function showFatalPanel(message){
  const html=`<section class="hero error-panel"><h2>⚠️ خطا</h2><p class="muted">${esc(message||'خطا در بارگذاری')}</p><button class="primary" id="reloadAdmin">تلاش دوباره</button></section>`;
  if(isAdminMode){$('userApp').classList.add('hidden');$('adminApp').classList.remove('hidden');$('adminContent').innerHTML=html;}
  else {$('userApp').classList.remove('hidden');$('adminApp').classList.add('hidden');$('homePage').innerHTML=html;}
}

async function loadAdmin(){try{adminState=await api('admin_summary');applyTheme(adminState.settings||{});renderAdmin()}catch(e){showFatalPanel(e.message);showStatus(e.message,'error')}}
function renderAdminMissing(section){return `<article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">!</span><div><h3>این بخش کامل بارگذاری نشد</h3><p class="muted">بخش ${esc(section||'مدیریت')} در دسترس نیست؛ بقیه پنل همچنان قابل استفاده است.</p></div></div><button class="secondary wide" data-admin-tab="more">بازگشت به ابزارهای بیشتر</button></article>`}
function renderAdmin(){
  if(['products','categories','variants'].includes(currentAdminTab))currentAdminTab='catalog';
  saveAppLastState();
  const r=adminState.report||{};
  $('adminStats').innerHTML=`<div class="mini-stat admin-stat-card"><b>${nf(r.today?.c||0)}</b><span>سفارش امروز<br>${fmt(r.today?.s||0)}</span></div><div class="mini-stat admin-stat-card"><b>${nf(r.month?.c||0)}</b><span>سفارش ماه<br>${fmt(r.month?.s||0)}</span></div><div class="mini-stat admin-stat-card"><b>${nf(r.pending||0)}</b><span>نیازمند اقدام</span></div>`;
  document.querySelectorAll('.admin-tabs [data-admin-tab]').forEach(b=>{const primary=['dashboard','catalog','orders'].includes(currentAdminTab)?currentAdminTab:'more';b.classList.toggle('active',b.dataset.adminTab===primary)});
  const renderers={
    dashboard:()=>renderAdminDashboard(),catalog:()=>renderAdminCatalog(),orders:()=>renderAdminOrders(),more:()=>renderAdminMore(),
    inventory:()=>typeof renderAdminInventory==='function'?renderAdminInventory():renderAdminMissing('انبار'),
    coupons:()=>typeof renderAdminCoupons==='function'?renderAdminCoupons():renderAdminMissing('تخفیف‌ها'),
    activity:()=>typeof renderAdminActivity==='function'?renderAdminActivity():renderAdminMissing('فعالیت'),
    roles:()=>typeof renderAdminRoles==='function'?renderAdminRoles():renderAdminMissing('نقش‌ها'),
    settings:()=>typeof renderAdminSettings==='function'?renderAdminSettings():renderAdminMissing('تنظیمات'),
    backups:()=>typeof renderAdminBackups==='function'?renderAdminBackups():renderAdminMissing('بکاپ')
  };
  const content=$('adminContent');content.classList.remove('admin-content-enter');void content.offsetWidth;
  try{content.innerHTML=(renderers[currentAdminTab]||renderers.dashboard)()}catch(e){console.error('[BlueGate Admin render]',currentAdminTab,e);content.innerHTML=renderAdminMissing(currentAdminTab)}
  content.classList.add('admin-content-enter');
  requestAnimationFrame(()=>{content.querySelectorAll('.admin-card, .admin-item, .accordion-card, .no-variant-row').forEach((el,i)=>{el.style.setProperty('--stagger-i',Math.min(i,8));el.classList.add('stagger-in')})});
  setTimeout(()=>{if(currentAdminTab==='settings')initSettingsUi();attachLongPress()},0)
}
function renderAdminMore(){return `<article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">•••</span><div><h3>ابزارهای بیشتر</h3><p class="muted">بخش‌های کم‌استفاده‌تر مدیریت در یک جای مشخص.</p></div></div><div class="admin-more-grid"><button class="admin-more-link" data-admin-tab="inventory"><span>□</span><div><b>انبار</b><small>آیتم‌های تحویل و موجودی</small></div></button><button class="admin-more-link" data-admin-tab="coupons"><span>%</span><div><b>تخفیف‌ها</b><small>کد تخفیف و کمپین‌ها</small></div></button><button class="admin-more-link" data-admin-tab="settings"><span>⚙</span><div><b>تنظیمات</b><small>پرداخت، ظاهر و فروشگاه</small></div></button><button class="admin-more-link" data-admin-tab="activity"><span>≡</span><div><b>فعالیت</b><small>لاگ تغییرات مدیریتی</small></div></button><button class="admin-more-link" data-admin-tab="roles"><span>◎</span><div><b>نقش‌ها</b><small>دسترسی مدیران</small></div></button><button class="admin-more-link" data-admin-tab="backups"><span>⇩</span><div><b>بکاپ</b><small>نگهداری و بازیابی سیستم</small></div></button></div></article><article class="admin-card admin-maintenance-card"><div class="admin-card-head"><span class="admin-card-icon">⌁</span><div><h3>عملیات سریع</h3><p class="muted">ابزارهای عملیاتی بدون شلوغ کردن ناوبری اصلی.</p></div></div><div class="dashboard-quick-actions"><button class="quick-action" onclick="openBroadcast()"><span>↗</span><b>پیام همگانی</b></button><button class="quick-action" onclick="openPurchaseReward()"><span>★</span><b>پاداش خرید</b></button></div></article>`}
function renderAdminDashboard(){const top=adminState.report?.top||[];const catalogTree=adminState.catalog_admin?.tree||[];const productCount=catalogTree.length;const variantCount=catalogTree.reduce((a,s)=>a+(s.groups||[]).reduce((b,g)=>b+(g.plans||[]).length,0),0);const orderCount=(adminState.orders||[]).length;const inventoryCount=(adminState.inventory||[]).length;const orders=adminState.orders||[];const rev7=last7DaysRevenue(orders);const total7=rev7.reduce((s,d)=>s+d.rev,0);const lowStock=(adminState.products||[]).filter(p=>Number(p.inventory_available||0)<3&&Number(p.is_active)).sort((a,b)=>Number(a.inventory_available||0)-Number(b.inventory_available||0));const topups=(adminState.credit_topups||[]).filter(x=>['receipt_submitted','reviewing'].includes(x.status));const topupReview=topups.length?`<article class="admin-card topup-admin-review"><div class="admin-card-head"><span class="admin-card-icon">💳</span><div><h3>شارژهای در انتظار بررسی</h3><p class="muted">${nf(topups.length)} درخواست نیازمند تصمیم</p></div></div><div class="topup-admin-list">${topups.slice(0,8).map(x=>`<div><span><b>#${nf(x.id)} · ${esc(x.first_name||x.username||'کاربر')}</b><small>${fmt(x.amount)} · ${esc(x.payment_method_fa||x.payment_method||'')}${x.tx_hash?' · TXID':''}${x.receipt_file_id?' · رسید':''}</small></span><div>${x.receipt_file_id?`<button class="secondary" data-credit-topup-receipt="/${esc(x.receipt_file_id)}">رسید</button>`:''}${x.tx_hash?`<button class="secondary" data-credit-topup-tx="${esc(x.tx_hash)}">TXID</button>`:''}<button class="success" data-credit-topup-approve="${x.id}">تایید</button><button class="danger" data-credit-topup-reject="${x.id}">رد</button></div></div>`).join('')}</div></article>`:'';return `${topupReview}<article class="admin-card dashboard-hero"><div class="admin-card-head"><span class="admin-card-icon">📊</span><div><h3>داشبورد فروش</h3><p class="muted">مرور سریع وضعیت فروشگاه و دسترسی به همه بخش‌ها.</p></div></div><div class="dashboard-quick-stats"><div class="dq-stat"><b>${nf(productCount)}</b><span>سرویس</span></div><div class="dq-stat"><b>${nf(variantCount)}</b><span>پلن</span></div><div class="dq-stat"><b>${nf(orderCount)}</b><span>سفارش</span></div><div class="dq-stat"><b>${nf(inventoryCount)}</b><span>آیتم انبار</span></div></div><div class="dashboard-quick-actions"><button class="quick-action" data-admin-tab="catalog"><span>🧭</span><b>Catalog Studio</b></button><button class="quick-action" data-admin-tab="orders"><span>🧾</span><b>سفارش‌ها</b></button><button class="quick-action" data-admin-tab="inventory"><span>📦</span><b>انبار</b></button><button class="quick-action" data-admin-tab="settings"><span>⚙️</span><b>تنظیمات</b></button><button class="quick-action" data-admin-tab="backups"><span>💾</span><b>بکاپ</b></button><button class="quick-action" onclick="openBroadcast()"><span>📢</span><b>پیام همگانی</b></button><button class="quick-action" onclick="openPurchaseReward()"><span>🎁</span><b>پاداش خرید</b></button></div></article>${lowStock.length?`<article class="admin-card alert-card"><div class="admin-card-head"><span class="admin-card-icon">⚠️</span><div><h3>موجودی کم</h3><p class="muted">${nf(lowStock.length)} محصول کمتر از ۳ آیتم در انبار دارند.</p></div></div><div class="low-stock-list">${lowStock.slice(0,5).map(p=>`<div class="low-stock-row" data-admin-tab="inventory"><div><b>${esc(p.name)}</b><span class="muted">موجودی: ${nf(p.inventory_available||0)} آیتم</span></div><span class="chip-mini chip-${Number(p.inventory_available||0)===0?'off':'featured'}">${Number(p.inventory_available||0)===0?'ناموجود':'کم'}</span></div>`).join('')}</div>${lowStock.length>5?`<button class="secondary wide" data-admin-tab="inventory" style="margin-top:10px">مشاهده همه در انبار</button>`:''}</article>`:''}<article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">📈</span><div><h3>درآمد ۷ روز اخیر</h3><p class="muted">مجموع: ${fmt(total7)} تومان</p></div></div>${sparklineHtml(rev7)}</article>${(adminState.forecast&&adminState.forecast.forecast)?`<article class="admin-card forecast-card"><div class="admin-card-head"><span class="admin-card-icon">🔮</span><div><h3>پیش‌بینی ماه آینده</h3><p class="muted">بر اساس میانگین ۳۰ روز اخیر</p></div></div><div class="forecast-grid"><div class="forecast-main"><b>${fmt(adminState.forecast.forecast)}</b><span>تومان پیش‌بینی</span></div><div class="forecast-side"><span class="chip-mini chip-${adminState.forecast.change_percent>=0?'active':'off'}">${adminState.forecast.change_percent>=0?'▲':'▼'} ${nf(Math.abs(adminState.forecast.change_percent))}٪</span><small>نسبت به ماه قبل</small></div></div><p class="muted">میانگین روزانه: ${fmt(adminState.forecast.daily_avg)} تومان · ۳۰ روز اخیر: ${nf(adminState.forecast.last30_count)} سفارش</p></article>`:''}<div class="admin-charts-grid"><article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">🏆</span><div><h3>پرفروش‌ترین‌ها</h3><p class="muted">بر اساس تعداد سفارش</p></div></div>${top.length?barChartHtml(top):'<p class="muted empty-state">داده‌ای نیست.</p>'}</article><article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">🥧</span><div><h3>روش‌های پرداخت</h3><p class="muted">توزیع ${nf(orderCount)} سفارش</p></div></div>${pieChartHtml(orders)}</article></div>`}

function catalogAdminData(){return adminState.catalog_admin||{tree:[],categories:[],preview:{counts:{},proposals:[]},public:{enabled:false}}}
function catalogCategoryOptions(selected=''){return (catalogAdminData().categories||[]).map(c=>`<option value="${c.id}" ${Number(selected)===Number(c.id)?'selected':''}>${esc(c.emoji||'🛍️')} ${esc(c.title)}</option>`).join('')}
function catalogServiceOptions(selected=''){return (catalogAdminData().tree||[]).map(s=>`<option value="${s.id}" ${Number(selected)===Number(s.id)?'selected':''}>${esc(s.name)}</option>`).join('')}
function catalogGroupOptions(selected=''){return (catalogAdminData().tree||[]).flatMap(s=>(s.groups||[]).map(g=>`<option value="${g.id}" ${Number(selected)===Number(g.id)?'selected':''}>${esc(s.name)} → ${g.is_default?'پلن‌های مستقیم':esc(g.name)}</option>`)).join('')}
function catalogPlanOptions(selected=''){return (catalogAdminData().tree||[]).flatMap(s=>(s.groups||[]).flatMap(g=>(g.plans||[]).map(p=>`<option value="${p.id}" ${Number(selected)===Number(p.id)?'selected':''}>${esc(s.name)} → ${g.is_default?'مستقیم':esc(g.name)} → ${esc(p.title)}</option>`))).join('')}
function renderAdminCatalog(){const ca=catalogAdminData(),tree=ca.tree||[],cats=ca.categories||[],pv=ca.preview||{},enabled=!!ca.public?.enabled,undo=ca.undo||{},unresolved=(pv.proposals||[]).filter(x=>!x.mapped),review=unresolved.filter(x=>x.confidence==='review');const groupCount=tree.reduce((a,s)=>a+(s.groups||[]).filter(g=>!g.is_default).length,0),planCount=tree.reduce((a,s)=>a+(s.groups||[]).reduce((b,g)=>b+(g.plans||[]).length,0),0);return `<article class="admin-card catalog-mobile-studio-hero"><div class="admin-card-head"><span class="admin-card-icon">🧭</span><div><h3>Catalog Studio</h3><p class="muted">ساخت و ویرایش سرویس‌ها، مرحله‌به‌مرحله</p></div></div><div class="dashboard-quick-stats"><div class="dq-stat"><b>${nf(tree.length)}</b><span>سرویس</span></div><div class="dq-stat"><b>${nf(groupCount)}</b><span>زیرسرویس</span></div><div class="dq-stat"><b>${nf(planCount)}</b><span>پلن</span></div><div class="dq-stat"><b>${nf(review.length)}</b><span>بررسی</span></div></div><button class="primary wide catalog-mobile-create" onclick="openCatalogMobileWizard(0)">＋ ساخت سرویس جدید</button><button class="secondary wide catalog-mobile-quick" onclick="openCatalogFast()">⚡ ساخت سریع</button>${undo.available?`<button class="secondary wide catalog-mobile-undo" onclick="catalogMobileUndo()">↶ بازگشت آخرین تغییر</button>`:''}</article>${!enabled?`<article class="admin-card catalog-mobile-migrate"><div class="admin-card-head"><span class="admin-card-icon">🪄</span><div><h3>مرتب‌سازی فروشگاه قبلی</h3><p class="muted">هیچ سفارش یا دیتایی حذف نمی‌شود.</p></div></div><div class="catalog-mobile-stepbar"><span><b>1</b>اسکن</span><i></i><span><b>2</b>بررسی</span><i></i><span><b>3</b>فعال‌سازی</span></div><div class="catalog-mobile-actions"><button class="secondary" onclick="catalogMobilePreview()">🔍 اسکن دوباره</button><button class="primary" onclick="catalogMobileApply()">✨ اعمال موارد مطمئن</button></div></article>`:''}<article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">🗂</span><div><h3>دسته‌های فروشگاه</h3><p class="muted">فقط برای مرتب‌کردن ویترین.</p></div><button class="secondary" onclick="openCatalogMobileCategory(0)">＋</button></div><div class="catalog-mobile-categories">${cats.map(c=>`<button onclick="openCatalogMobileCategory(${c.id})"><span>${esc(c.emoji||'🛍️')}</span><b>${esc(c.title)}</b><small>${tree.filter(s=>Number(s.category_id)===Number(c.id)).length} سرویس</small></button>`).join('')||'<p class="muted">هنوز دسته‌ای نیست.</p>'}</div></article><div class="catalog-mobile-section-title"><div><h3>سرویس‌های فروشگاه</h3><p class="muted">برای اصلاح محصول فعلی، همان Wizard را باز کن.</p></div><button class="secondary" onclick="openCatalogMobileOrganizer()">⇄ انتقال</button></div><div class="catalog-mobile-service-list">${tree.map(catalogMobileServiceCard).join('')||`<article class="admin-card catalog-mobile-empty"><span>🛍️</span><h3>هنوز سرویسی نداری</h3><p class="muted">اولین سرویس را با مسیر مرحله‌ای بساز.</p><button class="primary wide" onclick="openCatalogMobileWizard(0)">ساخت سرویس</button></article>`}</div>${unresolved.length?`<article class="admin-card catalog-mobile-review"><div class="admin-card-head"><span class="admin-card-icon">🧠</span><div><h3>اصلاح محصولات قبلی</h3><p class="muted">فقط موارد حل‌نشده از ساختار قدیمی اینجا نمایش داده می‌شوند.</p></div></div><div class="catalog-mobile-review-list">${unresolved.map(x=>`<div><div><b>${esc(x.service_name)}</b><small>${esc(x.category_title||'سایر')} · ${nf(x.plan_count||0)} پلن</small></div><span class="chip-mini ${x.confidence==='review'?'chip-off':x.confidence==='medium'?'chip-featured':'chip-active'}">${x.confidence==='review'?'🔴 تصمیم لازم':x.confidence==='medium'?'🟡 بررسی':'🟢 آماده'}</span>${x.confidence==='review'?`<button class="secondary" onclick="catalogMobileApplyOne(${x.legacy_product_id})">مرتب‌سازی</button>`:''}</div>`).join('')}</div></article>`:''}`}
function catalogMobileServiceCard(s){const groups=(s.groups||[]).filter(g=>!g.is_default),direct=(s.groups||[]).find(g=>g.is_default),plans=(s.groups||[]).reduce((a,g)=>a+(g.plans||[]).length,0);return `<article class="admin-card catalog-mobile-service-card ${Number(s.is_active)?'':'is-off'}"><header><div class="catalog-mobile-service-icon">${s.image_url?`<img src="${esc(s.image_url)}">`:esc(s.category_emoji||'🛍️')}</div><div><small>${esc(s.category_title||'سایر')}</small><h3>${esc(s.name)}</h3><p class="muted">${esc(s.description||'بدون توضیح')}</p></div><span class="chip-mini ${Number(s.is_active)?'chip-active':'chip-off'}">${Number(s.is_active)?'فعال':'غیرفعال'}</span></header><div class="catalog-mobile-card-stats"><span><b>${nf(groups.length)}</b><small>زیرسرویس</small></span><span><b>${nf(plans)}</b><small>پلن</small></span><span><b>${groups.length?'مرحله‌ای':'مستقیم'}</b><small>ساختار</small></span></div><div class="catalog-mobile-card-structure">${groups.length?groups.map(g=>`<div><b>${esc(g.name)}</b><span>${(g.plans||[]).map(p=>esc(p.title)).join(' · ')||'بدون پلن'}</span></div>`).join(''):`<div><b>⚡ پلن‌های مستقیم</b><span>${(direct?.plans||[]).map(p=>esc(p.title)).join(' · ')||'بدون پلن'}</span></div>`}</div><button class="primary wide" onclick="openCatalogMobileWizard(${s.id})">✏️ مدیریت و ویرایش</button></article>`}
const MOBILE_CATALOG_DRAFT_SCHEMA=2;
let mobileCatalogWizard=null,mobileCatalogStep=0,mobileCatalogUploadPending=0;
function mcUploadBusy(on){const sheet=document.querySelector('.mcw-sheet')||document.querySelector('[data-mc-wizard]')||document;const b=sheet.querySelector?.('[data-mc-save]');if(b){b.disabled=!!on;b.title=on?'صبر کن تا آپلود تصویر تمام شود':''}}
function mcKey(p='x'){return p+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function mcPlan(p={}){return {id:Number(p.id||0),key:p.key||mcKey('p'),title:p.title||'',price:Number(p.price||0),price_currency:(p.price_currency||'IRT').toUpperCase(),price_usd:p.price_usd??'',duration_days:Number(p.duration_days||0),discount_percent:Number(p.discount_percent||0),description:p.description||'',image_url:p.image_url||'',delivery_type:p.delivery_type||'manual',commission_type:p.commission_type||'none',commission_value:Number(p.commission_value||0),sort_order:Number(p.sort_order||0),is_active:p.is_active===undefined?1:Number(p.is_active)}}
function mcGroup(g={}){return {id:Number(g.id||0),key:g.key||mcKey('g'),name:g.is_default?'Default Group':(g.name||''),slug:g.slug||'',description:g.description||'',image_url:g.image_url||'',sort_order:Number(g.sort_order||0),is_default:Number(g.is_default||0),is_active:g.is_active===undefined?1:Number(g.is_active),plans:(g.plans||[]).map(mcPlan)}}
function mcFromService(s){const gs=(s.groups||[]).map(mcGroup),vis=gs.filter(g=>!g.is_default),def=gs.find(g=>g.is_default),mode=vis.length?'grouped':'direct';return {id:Number(s.id),name:s.name||'',slug:s.slug||'',category_id:s.category_id||'',description:s.description||'',image_url:s.image_url||'',theme:s.theme||'blue',sort_order:Number(s.sort_order||0),badge:s.badge||'',is_featured:Number(s.is_featured||0),is_active:Number(s.is_active||0),mode,groups:mode==='direct'?[def||mcGroup({is_default:1})]:gs.filter(g=>!g.is_default||(g.plans||[]).length)}}
function mcBlank(){const c=catalogAdminData().categories?.[0];return {id:0,name:'',slug:'',category_id:c?.id||'',description:'',image_url:'',theme:'blue',sort_order:0,badge:'',is_featured:0,is_active:1,mode:'grouped',groups:[mcGroup({name:'Standard'})]}}
function openCatalogMobileWizard(id=0){const s=(catalogAdminData().tree||[]).find(x=>Number(x.id)===Number(id));mobileCatalogWizard=s?mcFromService(s):mcBlank();let restored=false;try{const k=`bg_mcw_${id||'new'}`,raw=localStorage.getItem(k);if(raw){const d=JSON.parse(raw);if(d&&Number(d.id||0)===Number(id||0)&&Number(d._draft_schema||0)===MOBILE_CATALOG_DRAFT_SCHEMA){mobileCatalogWizard=d;restored=true}else localStorage.removeItem(k)}}catch(_){}mobileCatalogStep=0;renderCatalogMobileWizard();if(restored)setTimeout(()=>showStatus('پیش‌نویس ذخیره‌شده بازیابی شد.','success'),30)}
function mcCollect(){const sh=$('appSheet');if(!sh||!mobileCatalogWizard)return;const w=mobileCatalogWizard;if(mobileCatalogStep===0){sh.querySelectorAll('[data-mcw]').forEach(el=>{w[el.dataset.mcw]=el.type==='checkbox'?(el.checked?1:0):el.value})}if(mobileCatalogStep===2&&w.mode==='grouped'){sh.querySelectorAll('[data-mcg]').forEach(box=>{const g=w.groups.find(x=>x.key===box.dataset.mcg);if(g){box.querySelectorAll('[data-mcgf]').forEach(el=>g[el.dataset.mcgf]=el.type==='checkbox'?(el.checked?1:0):(el.type==='number'?Number(el.value||0):el.value))}})}if(mobileCatalogStep===3){sh.querySelectorAll('[data-mcp]').forEach(box=>{const p=w.groups.flatMap(g=>g.plans||[]).find(x=>x.key===box.dataset.mcp);if(p){box.querySelectorAll('[data-mcpf]').forEach(el=>p[el.dataset.mcpf]=el.type==='checkbox'?(el.checked?1:0):(el.type==='number'?Number(el.value||0):el.value))}})}try{w._draft_schema=MOBILE_CATALOG_DRAFT_SCHEMA;localStorage.setItem(`bg_mcw_${w.id||'new'}`,JSON.stringify(w))}catch(_){}}
function mcFileDataUrl(file){return new Promise((resolve,reject)=>{if(!file)return reject(new Error('فایلی انتخاب نشده'));if(file.size>6*1024*1024)return reject(new Error('حجم تصویر باید حداکثر ۶ مگابایت باشد'));const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(new Error('خواندن تصویر ناموفق بود'));r.readAsDataURL(file)})}
async function mcUploadImage(file){const image_b64=await mcFileDataUrl(file);const r=await api('admin_catalog_upload_image',{image_b64});if(!r?.image_url)throw new Error('آپلود تصویر ناموفق بود');return r.image_url}
function mcValidate(step=mobileCatalogStep){const w=mobileCatalogWizard;if(step===0){if(!String(w.name||'').trim())return 'نام سرویس را وارد کن';if(!Number(w.category_id))return 'دسته را انتخاب کن'}if(step===2&&w.mode==='grouped'){const gs=w.groups.filter(g=>!g.is_default);if(!gs.length)return 'حداقل یک زیرسرویس اضافه کن';if(gs.some(g=>!String(g.name||'').trim()))return 'نام زیرسرویس‌ها را کامل کن'}if(step===3){const gs=w.mode==='direct'?w.groups.filter(g=>g.is_default):w.groups.filter(g=>!g.is_default);if(!gs.some(g=>(g.plans||[]).length))return 'حداقل یک پلن اضافه کن';for(const g of gs)for(const p of g.plans||[]){if(!String(p.title||'').trim())return 'عنوان پلن را کامل کن';if(String(p.price_currency||'IRT').toUpperCase()==='USD'){if(Number(p.price_usd||0)<=0)return 'قیمت USD پلن را وارد کن'}else if(Number(p.price||0)<=0)return 'قیمت پلن باید بیشتر از صفر باشد'}}return ''}
function mcStepHtml(){const w=mobileCatalogWizard;if(mobileCatalogStep===0)return `<div class="mcw-copy"><small>مرحله ۱ از ۵</small><h3>${w.id?'ویرایش اطلاعات اصلی':'سرویس جدید'}</h3><p class="muted">نام، دسته، slug، ترتیب و ظاهر سرویس را مشخص کن.</p></div><div class="form-grid mcw-grid"><label><span>نام سرویس</span><input data-mcw="name" value="${esc(w.name)}"></label><label><span>Slug</span><input data-mcw="slug" value="${esc(w.slug||'')}"></label><label><span>دسته</span><select data-mcw="category_id">${catalogCategoryOptions(w.category_id)}</select></label><label><span>ترتیب</span><input data-mcw="sort_order" type="number" value="${Number(w.sort_order||0)}"></label><label><span>Badge</span><input data-mcw="badge" value="${esc(w.badge)}"></label><label><span>تم کارت</span><select data-mcw="theme">${['blue','green','purple','gold'].map(x=>`<option value="${x}" ${w.theme===x?'selected':''}>${x}</option>`).join('')}</select></label><label class="full"><span>توضیح کوتاه</span><textarea data-mcw="description">${esc(w.description)}</textarea></label><label class="full"><span>لینک تصویر</span><input data-mcw="image_url" value="${esc(w.image_url)}"></label><label class="full"><span>آپلود تصویر محصول</span><input type="file" accept="image/jpeg,image/png,image/webp" data-mc-upload="service"><small class="muted">JPG / PNG / WEBP تا ۶MB</small></label>${w.image_url?`<div class="full"><img src="${esc(w.image_url)}" style="width:72px;height:72px;object-fit:cover;border-radius:16px"></div>`:''}<label class="switch-line"><span>⭐ ویژه</span><input type="checkbox" data-mcw="is_featured" ${Number(w.is_featured)?'checked':''}></label><label class="switch-line"><span>🟢 فعال</span><input type="checkbox" data-mcw="is_active" ${Number(w.is_active)?'checked':''}></label></div>`;if(mobileCatalogStep===1)return `<div class="mcw-copy"><small>مرحله ۲ از ۵</small><h3>ساختار انتخاب پلن</h3><p class="muted">فقط چیزی را انتخاب کن که مشتری باید ببیند.</p></div><div class="mcw-mode"><button class="${w.mode==='direct'?'active':''}" data-mc-mode="direct"><span>⚡</span><b>پلن مستقیم</b><small>مثلاً 1 Month، 3 Months</small></button><button class="${w.mode==='grouped'?'active':''}" data-mc-mode="grouped"><span>🧩</span><b>چند زیرسرویس</b><small>مثلاً Standard، Pro</small></button></div>`;if(mobileCatalogStep===2){if(w.mode==='direct')return `<div class="mcw-copy"><small>مرحله ۳ از ۵</small><h3>زیرسرویس لازم نیست</h3><p class="muted">Default Group پشت صحنه مدیریت می‌شود.</p></div><div class="mcw-empty">✨ ساختار ساده آماده است</div>`;return `<div class="mcw-copy"><small>مرحله ۳ از ۵</small><h3>زیرسرویس‌ها</h3></div><div class="mcw-list">${w.groups.filter(g=>!g.is_default).map((g,i)=>`<div class="mcw-group" data-mcg="${g.key}"><b>${i+1}</b><div><label><span>نام</span><input data-mcgf="name" value="${esc(g.name)}"></label><label><span>Slug</span><input data-mcgf="slug" value="${esc(g.slug||'')}"></label><label><span>توضیح</span><input data-mcgf="description" value="${esc(g.description)}"></label><label><span>ترتیب</span><input data-mcgf="sort_order" type="number" value="${Number(g.sort_order||0)}"></label><label><span>لینک تصویر</span><input data-mcgf="image_url" value="${esc(g.image_url||'')}"></label><label><span>آپلود تصویر</span><input type="file" accept="image/jpeg,image/png,image/webp" data-mc-upload="group" data-key="${g.key}"></label><label><span>فعال</span><input data-mcgf="is_active" type="checkbox" ${Number(g.is_active)?'checked':''}></label></div><button class="danger ghost" data-mc-remove-group="${g.key}">حذف</button></div>`).join('')}</div><button class="secondary wide" data-mc-add-group>＋ افزودن زیرسرویس</button>`}if(mobileCatalogStep===3){let gs=w.mode==='direct'?w.groups.filter(g=>g.is_default):w.groups.filter(g=>!g.is_default||g.plans.length);if(w.mode==='direct'&&!gs.length){const g=mcGroup({is_default:1});w.groups.unshift(g);gs=[g]}return `<div class="mcw-copy"><small>مرحله ۴ از ۵</small><h3>پلن‌ها</h3><p class="muted">تومان یا USD، نوع تحویل، پورسانت و تصویر را مدیریت کن.</p></div><div class="mcw-plan-groups">${gs.map(g=>`<section><header><b>${g.is_default?'⚡ پلن‌های مستقیم':'🧩 '+esc(g.name)}</b><button class="secondary" data-mc-add-plan="${g.key}">＋ پلن</button></header>${(g.plans||[]).map(p=>`<div class="mcw-plan" data-mcp="${p.key}"><div class="form-grid"><label><span>عنوان</span><input data-mcpf="title" value="${esc(p.title)}"></label><label><span>واحد قیمت</span><select data-mcpf="price_currency"><option value="IRT" ${p.price_currency==='IRT'?'selected':''}>تومان</option><option value="USD" ${p.price_currency==='USD'?'selected':''}>USD → تومان خودکار</option></select></label><label><span>قیمت تومان</span><input data-mcpf="price" type="number" value="${Number(p.price||0)}"></label><label><span>قیمت USD</span><input data-mcpf="price_usd" type="number" step="0.0001" value="${esc(p.price_usd??'')}"></label><label><span>روز</span><input data-mcpf="duration_days" type="number" value="${Number(p.duration_days||0)}"></label><label><span>تخفیف %</span><input data-mcpf="discount_percent" type="number" value="${Number(p.discount_percent||0)}"></label><label><span>نوع تحویل</span><select data-mcpf="delivery_type">${['manual','account','vpn','code','file'].map(x=>`<option value="${x}" ${p.delivery_type===x?'selected':''}>${x}</option>`).join('')}</select></label><label><span>پورسانت</span><select data-mcpf="commission_type">${['none','percent','fixed'].map(x=>`<option value="${x}" ${p.commission_type===x?'selected':''}>${x}</option>`).join('')}</select></label><label><span>مقدار پورسانت</span><input data-mcpf="commission_value" type="number" value="${Number(p.commission_value||0)}"></label><label><span>ترتیب</span><input data-mcpf="sort_order" type="number" value="${Number(p.sort_order||0)}"></label><label class="full"><span>توضیح</span><input data-mcpf="description" value="${esc(p.description)}"></label><label class="full"><span>لینک تصویر</span><input data-mcpf="image_url" value="${esc(p.image_url||'')}"></label><label class="full"><span>آپلود تصویر پلن</span><input type="file" accept="image/jpeg,image/png,image/webp" data-mc-upload="plan" data-key="${p.key}"></label></div><div class="mcw-plan-foot"><label><input data-mcpf="is_active" type="checkbox" ${Number(p.is_active)?'checked':''}> فعال</label><button class="danger ghost" data-mc-remove-plan="${p.key}" data-group-key="${g.key}">حذف</button></div></div>`).join('')||'<p class="muted mcw-no-plan">هنوز پلنی نیست.</p>'}</section>`).join('')}</div>`}const gs=w.mode==='direct'?w.groups.filter(g=>g.is_default):w.groups.filter(g=>!g.is_default);return `<div class="mcw-copy"><small>مرحله ۵ از ۵</small><h3>پیش‌نمایش</h3><p class="muted">ذخیره، موارد حذف‌شده را فقط امن غیرفعال می‌کند.</p></div><div class="mcw-preview"><header>${w.image_url?`<img src="${esc(w.image_url)}" style="width:52px;height:52px;object-fit:cover;border-radius:14px">`:`<span>${esc((catalogAdminData().categories||[]).find(c=>Number(c.id)===Number(w.category_id))?.emoji||'🛍️')}</span>`}<div><small>${esc((catalogAdminData().categories||[]).find(c=>Number(c.id)===Number(w.category_id))?.title||'دسته')}</small><h3>${esc(w.name||'نام سرویس')}</h3><p class="muted">${esc(w.description||'بدون توضیح')}</p></div></header>${gs.map(g=>`<div><b>${g.is_default?'پلن‌ها':esc(g.name)}</b>${(g.plans||[]).map(p=>`<span>${esc(p.title)}<small>${p.price_currency==='USD'?'$'+nf(p.price_usd||0):fmt(p.price)+' ت'}</small></span>`).join('')||'<em>بدون پلن</em>'}</div>`).join('')}</div>`}
function renderCatalogMobileWizard(){
  const w=mobileCatalogWizard;if(!w)return;
  const footer=`${mobileCatalogStep>0?'<button type="button" class="secondary" data-mc-prev>قبلی</button>':'<span></span>'}${mobileCatalogStep<4?'<button type="button" class="primary" data-mc-next>ادامه</button>':`<button type="button" class="primary" data-mc-save>${w.id?'✓ ذخیره تغییرات':'🚀 ساخت و انتشار'}</button>`}`;
  const body=`<div class="mcw-stepper">${[0,1,2,3,4].map(i=>`<span class="${i===mobileCatalogStep?'active':i<mobileCatalogStep?'done':''}">${i<mobileCatalogStep?'✓':i+1}</span>`).join('')}</div><div class="mcw-body">${mcStepHtml()}</div>`;
  BlueGateUI.openSheet({type:'fullscreen',eyebrow:'CATALOG STUDIO',title:w.id?'ویرایش سرویس':'سرویس جدید',subtitle:`مرحله ${mobileCatalogStep+1} از ۵`,body,footer,onOpen:(sheet)=>{
    sheet.querySelector('[data-mc-prev]')?.addEventListener('click',()=>{mcCollect();mobileCatalogStep=Math.max(0,mobileCatalogStep-1);renderCatalogMobileWizard()});
    sheet.querySelector('[data-mc-next]')?.addEventListener('click',()=>{mcCollect();const err=mcValidate();if(err)return showStatus(err,'error');mobileCatalogStep=Math.min(4,mobileCatalogStep+1);renderCatalogMobileWizard()});
    sheet.querySelectorAll('[data-mc-upload]').forEach(inp=>inp.addEventListener('change',async()=>{if(!inp.files?.[0])return;const wizard=w;mcCollect();mobileCatalogUploadPending++;mcUploadBusy(true);inp.disabled=true;try{showStatus('در حال آپلود تصویر…');const url=await mcUploadImage(inp.files[0]);if(mobileCatalogWizard!==wizard)return;const kind=inp.dataset.mcUpload,key=inp.dataset.key;if(kind==='service')wizard.image_url=url;else if(kind==='group'){const g=wizard.groups.find(x=>x.key===key);if(g)g.image_url=url}else if(kind==='plan'){const p=wizard.groups.flatMap(g=>g.plans||[]).find(x=>x.key===key);if(p)p.image_url=url}try{wizard._draft_schema=MOBILE_CATALOG_DRAFT_SCHEMA;localStorage.setItem(`bg_mcw_${wizard.id||'new'}`,JSON.stringify(wizard))}catch(_){}renderCatalogMobileWizard();showStatus('تصویر آپلود شد','success')}catch(e){showStatus(e.message||'آپلود تصویر ناموفق بود','error')}finally{mobileCatalogUploadPending=Math.max(0,mobileCatalogUploadPending-1);mcUploadBusy(mobileCatalogUploadPending>0);if(inp?.isConnected)inp.disabled=false}}));
    sheet.querySelectorAll('[data-mc-mode]').forEach(b=>b.addEventListener('click',()=>{mcCollect();w.mode=b.dataset.mcMode;if(w.mode==='direct'&&!w.groups.some(g=>g.is_default))w.groups.unshift(mcGroup({is_default:1}));if(w.mode==='grouped'&&!w.groups.some(g=>!g.is_default))w.groups.push(mcGroup({name:'Standard'}));renderCatalogMobileWizard()}));
    sheet.querySelector('[data-mc-add-group]')?.addEventListener('click',()=>{mcCollect();w.groups.push(mcGroup({name:''}));renderCatalogMobileWizard()});
    sheet.querySelectorAll('[data-mc-remove-group]').forEach(b=>b.addEventListener('click',async()=>{mcCollect();const g=w.groups.find(x=>x.key===b.dataset.mcRemoveGroup);if(g?.id&&!await BlueGateUI.confirm({title:'غیرفعال کردن زیرسرویس',message:`زیرسرویس «${g.name}» غیرفعال شود؟`,confirmText:'غیرفعال کن',danger:true}))return;w.groups=w.groups.filter(x=>x.key!==b.dataset.mcRemoveGroup);renderCatalogMobileWizard()}));
    sheet.querySelectorAll('[data-mc-add-plan]').forEach(b=>b.addEventListener('click',()=>{mcCollect();const g=w.groups.find(x=>x.key===b.dataset.mcAddPlan);if(g)g.plans.push(mcPlan());renderCatalogMobileWizard()}));
    sheet.querySelectorAll('[data-mc-remove-plan]').forEach(b=>b.addEventListener('click',async()=>{mcCollect();const g=w.groups.find(x=>x.key===b.dataset.groupKey),pl=g?.plans.find(x=>x.key===b.dataset.mcRemovePlan);if(pl?.id&&!await BlueGateUI.confirm({title:'غیرفعال کردن پلن',message:`پلن «${pl.title}» غیرفعال شود؟`,confirmText:'غیرفعال کن',danger:true}))return;if(g)g.plans=g.plans.filter(x=>x.key!==b.dataset.mcRemovePlan);renderCatalogMobileWizard()}));
    sheet.querySelector('[data-mc-save]')?.addEventListener('click',async()=>{if(mobileCatalogUploadPending>0){showStatus('آپلود تصویر هنوز تمام نشده؛ چند لحظه صبر کن.','error');return}mcCollect();for(const st of [0,2,3]){const err=mcValidate(st);if(err){mobileCatalogStep=st;renderCatalogMobileWizard();showStatus(err,'error');return}}const bp=JSON.parse(JSON.stringify(w));bp.groups=(bp.groups||[]).map(g=>{delete g.key;g.plans=(g.plans||[]).map(pl=>{delete pl.key;return pl});return g});const ok=await adminAction('admin_catalog_save_blueprint',{blueprint:JSON.stringify(bp)});if(ok){try{localStorage.removeItem(`bg_mcw_${bp.id||'new'}`)}catch(_){}}});
  }});
}

function openCatalogMobileCategory(id=0){const c=(catalogAdminData().categories||[]).find(x=>Number(x.id)===Number(id))||{};openEdit(id?`ویرایش ${c.title}`:'دسته جدید',[{title:'دسته فروشگاه',fields:[{id:'mcc_title',label:'نام دسته',value:c.title||''},{id:'mcc_slug',label:'Slug',value:c.slug||''},{id:'mcc_emoji',label:'ایموجی',value:c.emoji||'🛍️'},{id:'mcc_img',label:'لینک تصویر',value:c.image_url||''},{id:'mcc_sort',label:'ترتیب',type:'number',value:c.sort_order||0},{id:'mcc_active',label:'فعال باشد؟',type:'checkbox',value:id?Number(c.is_active):1}]}],async()=>adminAction('admin_catalog_save_category',{id,title:val('mcc_title'),slug:val('mcc_slug'),emoji:val('mcc_emoji'),image_url:val('mcc_img'),sort_order:val('mcc_sort'),is_active:val('mcc_active')?1:0}))}
function openCatalogMobileOrganizer(){openEdit('مرتب‌سازی و انتقال',[{title:'انتقال زیرسرویس',fields:[{id:'mco_group',label:'زیرسرویس',type:'select',options:catalogGroupOptions()},{id:'mco_service',label:'سرویس مقصد',type:'select',options:catalogServiceOptions()}]},{title:'انتقال پلن',fields:[{id:'mco_plan',label:'پلن',type:'select',options:catalogPlanOptions()},{id:'mco_target_group',label:'زیرسرویس مقصد',type:'select',options:catalogGroupOptions()}]}],async()=>{if(val('mco_group')&&val('mco_service'))await api('admin_catalog_move_group',{group_id:val('mco_group'),service_id:val('mco_service')});if(val('mco_plan')&&val('mco_target_group'))await api('admin_catalog_move_plan',{plan_id:val('mco_plan'),group_id:val('mco_target_group')});adminState=await api('admin_summary');renderAdmin();showStatus('ساختار بروزرسانی شد')})}
async function catalogMobileUndo(){if(!await BlueGateUI.confirm({title:'بازگشت تغییر',message:'آخرین تغییر کاتالوگ برگردانده شود؟',confirmText:'بازگردانی'}))return;return adminAction('admin_catalog_undo',{})}
async function catalogMobilePreview(){await adminAction('admin_catalog_preview',{})}
async function catalogMobileApply(){if(await BlueGateUI.confirm({title:'اعمال مرتب‌سازی',message:'موارد مطمئن به کاتالوگ جدید منتقل شوند؟ چیزی حذف نمی‌شود.',confirmText:'اعمال'}))await adminAction('admin_catalog_apply',{confirm:'APPLY'})}
async function catalogMobileApplyOne(id){if(await BlueGateUI.confirm({title:'مرتب‌سازی محصول',message:'این محصول قدیمی در کاتالوگ جدید مرتب شود؟',confirmText:'مرتب‌سازی'}))await adminAction('admin_catalog_apply_one',{legacy_product_id:id,confirm:'APPLY'})}
function openCatalogMoveGroup(){return openCatalogMobileOrganizer()}
function openCatalogMovePlan(){return openCatalogMobileOrganizer()}
function openCatalogFast(){openEdit('ساخت سریع سرویس',[{title:'اطلاعات سرویس',fields:[{id:'mcf_name',label:'نام سرویس',placeholder:'مثلاً BluePing'},{id:'mcf_cat',label:'دسته فروشگاه',type:'select',options:catalogCategoryOptions()},{id:'mcf_desc',label:'توضیح کوتاه',type:'textarea',placeholder:'توضیح سرویس'}]},{title:'ساختار سریع',fields:[{id:'mcf_groups',label:'هر زیرسرویس یک خط',type:'textarea',placeholder:'Standard: 20GB=99000, 30GB=149000\nPro: 10GB=149000, 20GB=249000'}]}],async()=>adminAction('admin_catalog_fast_create',{service_name:val('mcf_name'),category_id:val('mcf_cat'),description:val('mcf_desc'),groups_text:val('mcf_groups')}))}
function openCatalogAddService(){return openCatalogMobileWizard(0)}
function openCatalogAddGroup(){return openCatalogMobileOrganizer()}
function openCatalogAddPlan(){return openCatalogMobileOrganizer()}

/* Legacy Products / Categories / Variants renderers removed in v2.8.0. Catalog Studio is the only product UI. */
function renderAdminCoupons(){const c=adminState.coupons||[];return `<div class="admin-primary-action"><button class="primary wide" onclick="if(typeof haptic==='function')haptic('light');openAddCoupon()">＋ کد تخفیف جدید</button></div><article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">%</span><div><h3>کدهای تخفیف</h3><p class="muted">${nf(c.length)} کد · ${nf(c.filter(x=>Number(x.is_active)).length)} فعال</p></div></div>${c.length?c.map(cp=>couponRowHtml(cp)).join(''):'<div class="u-empty"><div class="u-empty-icon">%</div><h3>هنوز کد تخفیفی نداری</h3><p>برای کمپین بعدی یک کد جدید بساز.</p></div>'}</article>`}
function couponRowHtml(cp){const expired=cp.expires_at&&new Date(cp.expires_at)<new Date();const exhausted=Number(cp.max_uses)>0&&Number(cp.used_count)>=Number(cp.max_uses);const active=Number(cp.is_active)&&!expired&&!exhausted;return `<div class="admin-item coupon-row"><div class="admin-item-head"><div class="admin-item-thumb emoji-thumb"><span>${active?'%':expired?'⏱':'–'}</span></div><div class="admin-item-main"><h4>${esc(cp.code)} <span class="admin-id-badge">${cp.type==='percent'?'٪':'تومان'}</span></h4><p class="muted">${cp.type==='percent'?'درصد '+nf(cp.value):'مبلغ '+fmt(cp.value)} · استفاده: ${nf(cp.used_count)}${Number(cp.max_uses)>0?' از '+nf(cp.max_uses):' (نامحدود)'}${cp.expires_at?' · انقضا: '+esc(String(cp.expires_at).slice(0,16)):''}</p></div></div><div class="admin-actions"><span class="chip-mini chip-${active?'active':expired?'off':'featured'}">${active?'فعال':expired?'منقضی':exhausted?'تمام‌شده':'غیرفعال'}</span><button data-edit-coupon="${cp.id}">ویرایش</button><button data-admin-toggle-coupon="${cp.id}">${Number(cp.is_active)?'غیرفعال':'فعال'}</button><button class="danger" data-admin-delete-coupon="${cp.id}">حذف</button></div></div>`}
function renderAdminActivity(){const log=adminState.activity_log||[];const actionFa={delete_coupon:'حذف کد تخفیف',reorder_products:'مرتب‌سازی محصولات',reorder_categories:'مرتب‌سازی دسته‌ها',set_role:'تعیین نقش ادمین',remove_role:'حذف نقش ادمین',catalog_save_blueprint:'ویرایش کاتالوگ',catalog_move_group:'انتقال زیرسرویس',catalog_move_plan:'انتقال پلن',catalog_toggle_service:'تغییر وضعیت سرویس',catalog_save_category:'ویرایش دسته فروشگاه',catalog_v2_apply:'مرتب‌سازی اولیه کاتالوگ',catalog_v2_apply_one:'مرتب‌سازی محصول قدیمی',catalog_undo:'بازگشت آخرین تغییر'};return `<article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">≡</span><div><h3>فعالیت مدیران</h3><p class="muted">${nf(log.length)} اقدام اخیر</p></div></div>${log.length?`<div class="activity-list">${log.map(l=>`<div class="activity-row"><div class="activity-icon">•</div><div class="activity-info"><b>${esc(actionFa[l.action]||l.action)}</b>${l.entity_type?` <span class="admin-id-badge">${esc(l.entity_type)}${l.entity_id?': #'+nf(l.entity_id):''}</span>`:''}${l.details?` <small>${esc(l.details)}</small>`:''}<span class="muted"> · ${esc(l.created_at||'')}</span></div></div>`).join('')}</div>`:'<div class="u-empty"><div class="u-empty-icon">≡</div><h3>فعالیتی ثبت نشده</h3></div>'}</article>`}
function renderAdminRoles(){const roles=adminState.admin_roles||[];return `<div class="admin-primary-action"><button class="primary wide" onclick="if(typeof haptic==='function')haptic('light');openAddRole()">＋ ادمین جدید</button></div><article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">◎</span><div><h3>نقش‌های مدیریتی</h3><p class="muted">${nf(roles.length)} مدیر دارای نقش</p></div></div>${roles.length?roles.map(r=>`<div class="admin-item role-row"><div class="admin-item-head"><div class="admin-item-thumb emoji-thumb"><span>${r.role==='full'?'★':r.role==='orders'?'▤':r.role==='products'?'◇':r.role==='finance'?'◫':'○'}</span></div><div class="admin-item-main"><h4>${esc(r.display_name||'بدون نام')} <span class="admin-id-badge">${esc(r.role)}</span></h4><p class="muted">Telegram ID: <code>${r.telegram_id}</code> · ${esc(String(r.created_at||'').slice(0,10))}</p></div></div><div class="admin-actions"><button data-edit-role="${r.id}">ویرایش</button><button class="danger" data-admin-remove-role="${r.telegram_id}">حذف نقش</button></div></div>`).join(''):'<div class="u-empty"><div class="u-empty-icon">◎</div><h3>نقش اضافه‌ای تعریف نشده</h3><p>ادمین‌های اصلی config همچنان دسترسی کامل دارند.</p></div>'}</article>`}
function renderAdminInventory(){return `<div style="display:flex;margin-bottom:16px;padding:0 4px"><button class="primary" style="flex:1" onclick="if(typeof haptic==='function')haptic('light');openAddInventory()">➕ انبار جدید</button></div>`+(adminState.inventory||[]).map(i=>`<div class="admin-item"><h4>#${i.id} ${esc(i.product_name)} ${i.variant_title?' / '+esc(i.variant_title):''}</h4><p class="muted">وضعیت: ${esc(i.status)} | ${esc(String(i.content).slice(0,80))}</p><div class="admin-actions"><button data-edit-inventory="${i.id}">ویرایش کامل</button><button class="danger" data-admin-delete-inventory="${i.id}">حذف امن</button><button class="danger" data-admin-hard-delete-inventory="${i.id}">حذف کامل</button></div></div>`).join('')}
function renderAdminOrders(){
  const c=adminState.cleanup||{};
  const orders=adminState.orders||[];
  const visibleOrders=orders.slice(0, adminOrdersLimit);
  let html=`<article class="admin-card csv-export-card"><div class="admin-card-head"><span class="admin-card-icon">📊</span><div><h3>خروجی CSV</h3><p class="muted">دانلود لیست ${orders.length} سفارش به صورت فایل اکسل.</p></div></div><button class="secondary" data-export-orders-csv>📥 دانلود CSV سفارش‌ها</button></article><article class="admin-card search-card"><div class="admin-card-head"><span class="admin-card-icon">🔍</span><div><h3>جستجوی پیشرفته</h3><p class="muted">جستجو با شماره سفارش، یوزرنیم، نام محصول یا ID تلگرام.</p></div></div><div class="form-grid"><input id="adminOrderSearchInput" placeholder="جستجو..." value="${esc(adminOrderSearch)}"><select id="adminOrderStatusSelect"><option value="all" ${adminOrderStatusFilter==='all'?'selected':''}>همه</option><option value="pending_payment" ${adminOrderStatusFilter==='pending_payment'?'selected':''}>در انتظار پرداخت</option><option value="receipt_submitted" ${adminOrderStatusFilter==='receipt_submitted'?'selected':''}>رسید ارسال شده</option><option value="reviewing" ${adminOrderStatusFilter==='reviewing'?'selected':''}>در بررسی</option><option value="payment_confirmed" ${adminOrderStatusFilter==='payment_confirmed'?'selected':''}>پرداخت تاییدشده</option><option value="preparing" ${adminOrderStatusFilter==='preparing'?'selected':''}>آماده‌سازی</option><option value="delivered" ${adminOrderStatusFilter==='delivered'?'selected':''}>تحویل‌شده</option><option value="rejected" ${adminOrderStatusFilter==='rejected'?'selected':''}>رد شده</option></select><button class="primary" id="adminOrderSearchBtn">جستجو</button><button class="secondary" id="adminOrderResetBtn">ریست</button></div></article>`;
  if(selectedOrderIds.size){
    html+=`<article class="admin-card bulk-action-bar"><div class="admin-card-head"><span class="admin-card-icon">☑️</span><div><h3>${nf(selectedOrderIds.size)} سفارش انتخاب شده</h3></div></div><div class="admin-actions"><button class="success" data-bulk-action="payment_confirmed">✅ تایید پرداخت</button><button class="warning" data-bulk-action="preparing">📦 آماده‌سازی</button><button class="danger" data-bulk-action="rejected">رد</button><button class="ghost" id="bulkClearBtn">لغو انتخاب</button></div></article>`;
  }
  html+=`<article class="admin-card cleanup-card"><div class="admin-card-head"><span class="admin-card-icon">🧹</span><div><h3>پاکسازی سفارش‌ها</h3><p class="muted">فقط سفارش‌های لغو/رد/مرجوع قابل حذف کامل هستند.</p></div></div><div class="admin-actions"><button class="danger" data-admin-cleanup="all">حذف همه (${nf(c.all||0)})</button><button class="warning" data-admin-cleanup="7">حذف قدیمی‌تر از ۷ روز (${nf(c.older_7||0)})</button><button class="secondary" data-admin-cleanup="30">حذف قدیمی‌تر از ۳۰ روز (${nf(c.older_30||0)})</button></div></article>`;
  html+=`<div class="view-toggle-wrapper"><div class="view-toggle"><button class="${adminOrderViewMode==='board'?'active':''}" data-admin-view-mode="board">تخته کانبان (Kanban)</button><button class="${adminOrderViewMode==='list'?'active':''}" data-admin-view-mode="list">لیست پیشرفته</button></div></div>`;
  
  if(adminOrderViewMode==='board'){
    const cols = [
      { id: 'new', title: 'جدید', icon: '✨', statuses: ['pending_payment', 'receipt_submitted', 'reviewing'] },
      { id: 'processing', title: 'در حال پردازش', icon: '⏳', statuses: ['payment_confirmed', 'preparing'] },
      { id: 'ready', title: 'تکمیل شده', icon: '✅', statuses: ['delivered'] },
      { id: 'rejected', title: 'رد شده', icon: '❌', statuses: ['rejected'] }
    ];
    html+=`<div class="kanban-board">`;
    for (let col of cols) {
      const colOrders = visibleOrders.filter(o => col.statuses.includes(o.status));
      html += `<div class="kanban-col"><div class="kanban-col-head"><h3>${col.icon} ${col.title}</h3><span class="kanban-col-count">${nf(colOrders.length)}</span></div>`;
      if (!colOrders.length) {
        html += `<div class="empty-state small" style="margin-top:20px;opacity:0.6">سفارشی نیست</div>`;
      } else {
        html += colOrders.map(o => `
          <div class="kanban-card" data-admin-action-sheet="order:${o.id}">
            <div class="kanban-card-head"><span class="kanban-card-id">#${nf(o.id)}</span><span class="kanban-card-amount">${fmt(o.final_amount)}</span></div>
            <div class="kanban-card-title">${o.is_renewal?'🔄 تمدید · ':''}${esc(o.display_name)}</div>
            <div class="kanban-card-meta">
              <span>👤 ${esc(o.username ? '@' + o.username : 'کاربر')}</span>
              <span>📅 ${esc(String(o.created_at || '').slice(0, 16))}</span>
              ${o.receipt_file_id ? `<button class="chip-mini chip-active" data-view-receipt="${o.id}">🖼 مشاهده رسید</button>` : ''}
              <span style="color:var(--accent);margin-top:4px">وضعیت: ${esc(o.status_fa || o.status)}</span>
            </div>
          </div>`).join('');
      }
      html += `</div>`;
    }
    html+=`</div>`;
  }else{
    html+=(visibleOrders.map(o=>`<div class="admin-item order-admin-item"><div class="admin-item-head"><input type="checkbox" class="bulk-check" data-bulk-check="${o.id}" ${selectedOrderIds.has(Number(o.id))?'checked':''}><div class="admin-item-thumb" data-admin-action-sheet="order:${o.id}" style="cursor:pointer">${o.image_url?`<img src="${esc(o.image_url)}" alt="">`:'<span>🧾</span>'}</div><div class="admin-item-main" data-admin-action-sheet="order:${o.id}" style="cursor:pointer"><h4>#${nf(o.id)} ${o.is_renewal?'<span class="chip-mini chip-active">🔄 تمدید</span> ':''}${esc(o.display_name)} <span class="admin-id-badge">${esc(o.status_fa||o.status)}</span></h4><p class="muted">${fmt(o.final_amount)} · ${esc(o.created_at||'')}${o.renewal_of_order_id?' · تمدید #'+nf(o.renewal_of_order_id):''}${o.payment_method_fa?' · '+esc(o.payment_method_fa):''}${o.receipt_file_id?' · <button class="chip-mini chip-active" data-view-receipt="'+o.id+'">🖼 مشاهده رسید</button>':''}${o.username?' · @'+esc(o.username):''}</p></div></div></div>`).join('')||'<p class="muted">سفارشی نیست.</p>');
  }
  if(orders.length > visibleOrders.length){
    html+=`<div style="margin-top:16px;text-align:center"><button class="secondary wide" data-admin-load-more-orders>نمایش سفارش‌های بیشتر (${nf(orders.length - visibleOrders.length)} مانده)</button></div>`;
  }
  return html;
}
function cardLine(c){return [c.title||'',c.card||'',c.owner||'',c.sheba||''].join('|')}
function walletLine(w){return [w.title||'',(w.network||'TRC20').toUpperCase(),(w.asset||'USDT').toUpperCase(),w.address||'',(w.rate_symbol||w.asset||'USDT').toUpperCase(),String(w.is_active??'1'),String(w.sort_order??'99')].join('|')}
function rateLine(r){return [(r.asset||'USDT').toUpperCase(),String(r.rate_toman||'0')].join('|')}
function parseSettingsBuilders(){
  const st=adminState.settings||{};
  adminUiCards=parsePipeLines(st.card_accounts_text||'', ['title','card','owner','sheba']);
  adminUiWallets=parsePipeLines(st.crypto_wallets_text||'', ['title','network','asset','address','rate_symbol','is_active','sort_order']);
  adminUiRates=parsePipeLines(st.crypto_manual_rates_text||'USDT|0\nTRX|0\nTON|0', ['asset','rate_toman']);
}
function paymentListHtml(items,type){
  if(!items.length) return `<div class="empty-state small">هنوز چیزی اضافه نشده.</div>`;
  return `<div class="builder-list">`+items.map((it,i)=>{
    if(type==='card') {
      const cardClean = (it.card || '').replace(/\D/g, '');
      const cardDisplay = cardClean ? (cardClean.slice(0,4) + '...' + cardClean.slice(-4)) : 'بدون شماره';
      return `<div class="builder-row compact-row">
        <div class="builder-row-info">
          <div class="builder-row-header">
            <span class="builder-row-title">💳 ${esc(it.title||'کارت بانکی')}</span>
            <small class="muted">(${esc(it.owner||'بدون صاحب کارت')})</small>
          </div>
          <div class="builder-row-sub"><code>${esc(cardDisplay)}</code> ${it.sheba?`· <span class="ltr">${esc(it.sheba.slice(0,8))}...</span>`:''}</div>
        </div>
        <div class="builder-actions inline-actions">
          <button class="icon-action-btn" data-builder-edit="card:${i}" title="ویرایش">✏️</button>
          <button class="icon-action-btn danger-icon" data-builder-del="card:${i}" title="حذف">🗑️</button>
        </div>
      </div>`;
    }
    if(type==='wallet') {
      const net = (it.network||'TRC20').toUpperCase();
      const asset = (it.asset||'USDT').toUpperCase();
      const addr = it.address || '';
      const addrDisplay = addr ? (addr.slice(0,6) + '...' + addr.slice(-4)) : 'بدون آدرس';
      const isActive = String(it.is_active ?? '1') !== '0';
      return `<div class="builder-row compact-row">
        <div class="builder-row-info">
          <div class="builder-row-header">
            <span class="builder-row-title">🪙 ${esc(it.title||asset)}</span>
            <span class="chip-mini ${isActive?'chip-active':'chip-off'}">${isActive?'فعال':'غیرفعال'}</span>
            <span class="chip-mini chip-featured">${esc(net)}</span>
          </div>
          <div class="builder-row-sub"><code>${esc(addrDisplay)}</code> · ${esc(asset)}</div>
        </div>
        <div class="builder-actions inline-actions">
          <button class="icon-action-btn" data-builder-edit="wallet:${i}" title="ویرایش">✏️</button>
          <button class="icon-action-btn danger-icon" data-builder-del="wallet:${i}" title="حذف">🗑️</button>
        </div>
      </div>`;
    }
    return `<div class="builder-row compact-row">
      <div class="builder-row-info">
        <div class="builder-row-header">
          <span class="builder-row-title">📈 ${esc((it.asset||'USDT').toUpperCase())}</span>
          <small class="muted">نرخ دستی</small>
        </div>
        <div class="builder-row-sub"><b>${nf(it.rate_toman||0)}</b> تومان</div>
      </div>
      <div class="builder-actions inline-actions">
        <button class="icon-action-btn" data-builder-edit="rate:${i}" title="ویرایش">✏️</button>
        <button class="icon-action-btn danger-icon" data-builder-del="rate:${i}" title="حذف">🗑️</button>
      </div>
    </div>`;
  }).join('')+`</div>`;
}
function syncPaymentBuilders(){
  if($('as_cards') && adminUiCards.length) $('as_cards').value=adminUiCards.map(cardLine).join('\n');
  if($('as_crypto_wallets') && adminUiWallets.length) $('as_crypto_wallets').value=adminUiWallets.map(walletLine).join('\n');
  if($('as_crypto_rates') && adminUiRates.length) $('as_crypto_rates').value=adminUiRates.map(rateLine).join('\n');
  if($('cardBuilderList')) $('cardBuilderList').innerHTML=paymentListHtml(adminUiCards,'card');
  if($('walletBuilderList')) $('walletBuilderList').innerHTML=paymentListHtml(adminUiWallets,'wallet');
  if($('rateBuilderList')) $('rateBuilderList').innerHTML=paymentListHtml(adminUiRates,'rate');
}
function initSettingsUi(){ parseSettingsBuilders(); syncPaymentBuilders(); if($('as_crypto_source')) $('as_crypto_source').value=(adminState.settings?.crypto_rate_source||'auto'); }
function field(label,html){return `<label><span>${label}</span>${html}</label>`}
function setupCardValidation(){
  setTimeout(()=>{
    const cardInput = $('bc_card');
    const shebaInput = $('bc_sheba');
    const updateCardVal = ()=>{
      const val = (cardInput?.value || '').replace(/\D/g, '');
      const ind = $('bc_card_val');
      if(!ind) return;
      if(!val) { ind.className='valid-indicator warn'; ind.textContent='⚠️ شماره کارت ۱۶ رقمی را وارد کنید'; }
      else if(val.length===16) { ind.className='valid-indicator ok'; ind.textContent='✅ شماره کارت ۱۶ رقمی معتبر است'; }
      else { ind.className='valid-indicator warn'; ind.textContent=`⚠️ ${val.length} رقم وارد شده (باید ۱۶ رقم باشد)`; }
    };
    const updateShebaVal = ()=>{
      const val = (shebaInput?.value || '').trim().toUpperCase();
      const ind = $('bc_sheba_val');
      if(!ind) return;
      if(!val) { ind.className='valid-indicator warn'; ind.textContent='ℹ️ شبا اختیاری است'; }
      else if(val.startsWith('IR') && val.length===26) { ind.className='valid-indicator ok'; ind.textContent='✅ شماره شبا معتبر است (IR + ۲۴ رقم)'; }
      else if(val.length===24 && !val.startsWith('IR')) { ind.className='valid-indicator ok'; ind.textContent='✅ ۲۴ رقم شبا وارد شد'; }
      else { ind.className='valid-indicator warn'; ind.textContent=`⚠️ طول شبا ${val.length} کاراکتر است (استاندارد ۲۶ با IR)`; }
    };
    if(cardInput) { cardInput.addEventListener('input', updateCardVal); updateCardVal(); }
    if(shebaInput) { shebaInput.addEventListener('input', updateShebaVal); updateShebaVal(); }
  }, 50);
}
function openCardBuilder(index=null){
  const c=index===null?{}:adminUiCards[index]||{};
  openEdit(index===null?'افزودن کارت جدید':'ویرایش کارت',[
    field('عنوان کارت',`<input id="bc_title" value="${esc(c.title||'')}" placeholder="کارت اصلی">`),
    field('شماره کارت',`<input id="bc_card" value="${esc(c.card||'')}" inputmode="numeric" placeholder="6037..."><div id="bc_card_val" class="valid-indicator warn"></div>`),
    field('نام صاحب کارت',`<input id="bc_owner" value="${esc(c.owner||'')}" placeholder="نام و نام خانوادگی">`),
    field('شبا اختیاری',`<input id="bc_sheba" value="${esc(c.sheba||'')}" placeholder="IR..."><div id="bc_sheba_val" class="valid-indicator warn"></div>`)
  ],async()=>{
    const obj={title:val('bc_title'),card:val('bc_card'),owner:val('bc_owner'),sheba:val('bc_sheba')};
    if(!obj.card&&!obj.owner) throw new Error('شماره کارت یا صاحب کارت را وارد کن');
    if(index===null)adminUiCards.push(obj);else adminUiCards[index]=obj;
    syncPaymentBuilders(); showStatus('کارت ذخیره شد');
  });
  setupCardValidation();
}
let cachedCryptoRates = null;

function setupWalletValidation(){
  setTimeout(async()=>{
    const assetSelect = $('bw_asset');
    const netSelect = $('bw_network');
    const rateInput = $('bw_rate');
    const addrInput = $('bw_address');
    const rateInfo = $('bw_rate_info');

    if(!cachedCryptoRates){
      try {
        const res = await api('get_crypto_rates');
        if(res && res.rates) cachedCryptoRates = res.rates;
      } catch(e){}
    }

    const networkOptions = {
      'USDT': [
        { value: 'TRC20', label: 'TRC20 (TRON Network - پیش‌فرض)' },
        { value: 'TON', label: 'TON (The Open Network)' },
        { value: 'BEP20', label: 'BEP20 (BNB Smart Chain)' },
        { value: 'ERC20', label: 'ERC20 (Ethereum)' }
      ],
      'TRX': [
        { value: 'TRON', label: 'TRON (شبکه اختصاصی ترون)' }
      ],
      'TON': [
        { value: 'TON', label: 'TON (شبکه اختصاصی تن)' }
      ]
    };

    const updateNetworkOptions = ()=>{
      const asset = (assetSelect?.value || 'USDT').toUpperCase();
      if(rateInput) rateInput.value = asset;
      
      if(netSelect && networkOptions[asset]) {
        const currentNet = netSelect.value;
        const opts = networkOptions[asset];
        netSelect.innerHTML = opts.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
        const exists = opts.some(o => o.value === currentNet);
        netSelect.value = exists ? currentNet : opts[0].value;
      }

      if(rateInfo && cachedCryptoRates && cachedCryptoRates[asset]) {
        const rData = cachedCryptoRates[asset];
        const formattedRate = nf(rData.rate);
        const sourceName = rData.source || 'Live';
        rateInfo.innerHTML = `📈 <b>نرخ زنده:</b> ۱ ${asset} = ${formattedRate} تومان <small class="muted">(${esc(sourceName)})</small>`;
      } else if(rateInfo) {
        rateInfo.textContent = '';
      }

      updateAddrVal();
    };

    const updateAddrVal = ()=>{
      const addr = (addrInput?.value || '').trim();
      const net = (netSelect?.value || 'TRC20').trim().toUpperCase();
      const asset = (assetSelect?.value || 'USDT').trim().toUpperCase();
      const ind = $('bw_address_val');
      if(!ind) return;

      if(!addr) {
        ind.className='valid-indicator warn'; ind.textContent='⚠️ آدرس کیف پول را وارد کنید';
      } else if((net==='TRC20'||net==='TRON'||asset==='TRX') && addr.startsWith('T') && addr.length===34) {
        ind.className='valid-indicator ok'; ind.textContent='✅ آدرس TRC20 / TRON معتبر است (۳۴ کاراکتر با T)';
      } else if((net==='TON'||asset==='TON') && (addr.startsWith('EQ')||addr.startsWith('UQ')) && addr.length>=44) {
        ind.className='valid-indicator ok'; ind.textContent='✅ آدرس شبکه TON معتبر است (EQ/UQ)';
      } else if((net==='EVM'||net==='BEP20'||net==='ERC20') && addr.startsWith('0x') && addr.length===42) {
        ind.className='valid-indicator ok'; ind.textContent='✅ آدرس EVM معتبر است (0x + ۴۰ کاراکتر)';
      } else if(addr.length >= 10) {
        ind.className='valid-indicator ok'; ind.textContent='✅ آدرس ثبت شد';
      } else {
        ind.className='valid-indicator warn'; ind.textContent='⚠️ آدرس کوتاه یا فرمت نامشخص است';
      }
    };

    if(assetSelect) { assetSelect.addEventListener('change', updateNetworkOptions); }
    if(netSelect) { netSelect.addEventListener('change', updateAddrVal); }
    if(addrInput) { addrInput.addEventListener('input', updateAddrVal); }

    updateNetworkOptions();
  }, 50);
}
function openWalletBuilder(index=null){
  const w=index===null?{network:'TRC20',asset:'USDT',rate_symbol:'USDT',is_active:'1',sort_order:'99'}:adminUiWallets[index]||{};
  const currentAsset = (w.asset || 'USDT').toUpperCase();
  openEdit(index===null?'افزودن کیف پول رمزارز':'ویرایش کیف پول رمزارز',[
    field('ارز رمزنگاری',`<select id="bw_asset">
      <option value="USDT" ${currentAsset==='USDT'?'selected':''}>USDT (تتر / دلار)</option>
      <option value="TRX" ${currentAsset==='TRX'?'selected':''}>TRX (ترون)</option>
      <option value="TON" ${currentAsset==='TON'?'selected':''}>TON (تن کوین)</option>
    </select><div id="bw_rate_info" style="margin-top:6px;font-size:13.5px;color:var(--accent)"></div>`),
    field('عنوان ولت',`<input id="bw_title" value="${esc(w.title||'')}" placeholder="مثلاً ولت اختصاصی تتر">`),
    field('شبکه کیف پول',`<select id="bw_network">
      <option value="TRC20">TRC20 (TRON Network)</option>
      <option value="TON">TON Network</option>
      <option value="BEP20">BEP20 (BNB Smart Chain)</option>
      <option value="ERC20">ERC20 (Ethereum)</option>
    </select>`),
    field('آدرس ولت',`<textarea id="bw_address" placeholder="آدرس کیف پول">${esc(w.address||'')}</textarea><div id="bw_address_val" class="valid-indicator warn"></div>`),
    field('نماد نرخ',`<input id="bw_rate" value="${esc((w.rate_symbol||w.asset||'USDT').toUpperCase())}" readonly placeholder="USDT">`),
    field('ترتیب نمایش',`<input id="bw_sort" value="${esc(w.sort_order||'99')}" inputmode="numeric">`),
    `<label class="switch-line">فعال باشد؟ <input id="bw_active" type="checkbox" ${String(w.is_active??'1')!=='0'?'checked':''}></label>`
  ],async()=>{
    const obj={title:val('bw_title'),network:val('bw_network'),asset:val('bw_asset'),address:val('bw_address'),rate_symbol:val('bw_rate'),is_active:val('bw_active')?'1':'0',sort_order:val('bw_sort')};
    if(!obj.address) throw new Error('آدرس ولت را وارد کن');
    if(index===null)adminUiWallets.push(obj);else adminUiWallets[index]=obj;
    syncPaymentBuilders(); showStatus('ولت ذخیره شد');
  });
  setupWalletValidation();
}
function openRateBuilder(index=null){const r=index===null?{asset:'USDT',rate_toman:'0'}:adminUiRates[index]||{};openEdit(index===null?'افزودن نرخ دستی':'ویرایش نرخ دستی',[field('نماد ارز',`<input id="br_asset" value="${esc((r.asset||'USDT').toUpperCase())}" placeholder="USDT">`),field('قیمت تومان',`<input id="br_rate" value="${esc(r.rate_toman||0)}" inputmode="decimal" placeholder="95000">`)],async()=>{const obj={asset:val('br_asset'),rate_toman:val('br_rate')}; if(!obj.asset) throw new Error('نماد ارز را وارد کن'); if(index===null)adminUiRates.push(obj);else adminUiRates[index]=obj; syncPaymentBuilders(); showStatus('نرخ دستی ذخیره شد')})}
const adminPaletteColors=['#1d9bf0','#2563eb','#8b5cf6','#22c55e','#14b8a6','#f59e0b','#f97316','#ef4444','#ec4899','#64748b'];
function colorPicker(id,value){return `<div class="color-picker-row"><input id="${id}" type="color" value="${esc(value)}"><input id="${id}_text" value="${esc(value)}" placeholder="#1d9bf0" data-color-mirror="${id}"></div>`}
function settingsPalette(target){return `<div class="admin-palette">${adminPaletteColors.map(c=>`<button class="swatch small" data-admin-color="${target}:${c}" style="background:${c}"></button>`).join('')}</div>`}

function bytesLabel(n){n=Number(n||0);if(n>1024*1024)return (n/1024/1024).toFixed(2)+' MB';if(n>1024)return (n/1024).toFixed(1)+' KB';return n+' B'}
function renderAdminBackups(){
  const rows=adminState.backups||[];
  return `<section class="settings-dashboard backup-dashboard">
    <article class="settings-hero admin-card">
      <div><small>Backup Center</small><h3>💾 بکاپ و ریستور</h3><p class="muted">بکاپ روی سرور ذخیره می‌شود، قابل دانلود از SFTP است و می‌تواند داخل چت بات هم ارسال شود.</p></div>
    </article>
    <article class="admin-card">
      <h3>📦 گرفتن بکاپ</h3>
      <p class="muted">اگر دانلود داخل Mini App مشکل داشت، از «ارسال در چت بات» استفاده کن؛ پایدارتر است.</p>
      <div class="admin-actions"><button class="primary" data-admin-backup-create>ساخت بکاپ روی سرور</button><button class="success" data-admin-backup-sendbot>ساخت و ارسال در چت بات</button></div>
      <div class="hint-box">مسیر SFTP روی VPS: <code>/var/www/bluegate-platform/storage/backups/</code></div>
    </article>
    <article class="admin-card danger-zone">
      <h3>♻️ Restore بکاپ</h3>
      <p class="muted">Restore کل دیتابیس فعلی را جایگزین می‌کند. قبل از Restore یک safety backup خودکار ساخته می‌شود.</p>
      <input id="backupUpload" type="file" accept=".json,.gz,.json.gz">
      <div class="admin-actions"><button class="danger" data-admin-backup-upload>Upload & Restore</button></div>
      <div class="hint-box">راه پایدارتر: در چت بات دستور <code>/restore_backup</code> را بزن و فایل <code>.json.gz</code> را همانجا ارسال کن.</div>
    </article>
    <article class="admin-card">
      <h3>🗂 بکاپ‌های روی سرور</h3>
      ${rows.length?rows.map(b=>`<div class="admin-item"><h4>${esc(b.filename)}</h4><p class="muted">${bytesLabel(b.size)} · ${esc(b.created_at||'')}</p><div class="admin-actions"><button class="secondary" data-open-url="${esc(b.download_url||'')}">دانلود</button><button class="warning" data-admin-backup-restore-server="${esc(b.filename)}">Restore همین فایل</button><button class="danger" data-admin-backup-delete="${esc(b.filename)}">حذف</button></div></div>`).join(''):'<p class="muted">هنوز بکاپی روی سرور نیست.</p>'}
    </section>`
}
async function uploadBackupRestore(){
  const input=$('backupUpload');
  const file=input?.files?.[0];
  if(!file){showStatus('اول فایل بکاپ را انتخاب کن','error');return}
  if(!await BlueGateUI.confirm({title:'Restore دیتابیس',message:'کل دیتابیس فعلی جایگزین می‌شود. قبل از ادامه از بکاپ مطمئن شو.',confirmText:'Restore',danger:true}))return;
  const fd=new FormData();
  fd.append('initData',initData);fd.append('confirm','RESTORE');fd.append('backup',file);
  const res=await fetch('/backup_upload.php',{method:'POST',body:fd});
  const data=await res.json().catch(()=>({}));
  if(!res.ok||data.ok===false)throw new Error(data.message||data.error||'Restore failed');
  showStatus('Restore انجام شد');
  await loadAdmin();
}

let miniappSpinRewards = [];

function parseSpinRewardsText(raw){
  if(Array.isArray(raw)) return raw.map(r=>({title:r.title||'جایزه گردونه', amount:Number(r.amount||0), weight:Number(r.weight||10), notify_admin:!!r.notify_admin}));
  const text = String(raw||'').trim();
  if(!text) return [];
  return text.split('\n').map(line=>{
    const parts = line.split('|').map(s=>s.trim());
    const title = parts[0] || 'جایزه گردونه';
    const amount = Number(parts[1]||0);
    const weight = Number(parts[2]||10);
    const notify = parts[3] === '1' || parts[3] === 'true';
    return { title, amount, weight, notify_admin: notify };
  }).filter(r=>r.title);
}

function serializeSpinRewards(arr){
  return (arr||[]).map(r=>`${r.title}|${r.amount||0}|${r.weight||1}|${r.notify_admin?1:0}`).join('\n');
}

function renderSpinRewardsCards(rewards){
  if(!rewards || !rewards.length){
    return `<div style="grid-column:1/-1;text-align:center;padding:24px 12px;" class="muted">هیچ جایزه‌ای برای گردونه ثبت نشده است. دکمه «افزودن جایزه جدید» را بزنید.</div>`;
  }
  return rewards.map((sr, idx) => `
    <div class="spin-reward-card">
      <div class="spin-reward-card-top">
        <div class="spin-reward-title-row">
          <b class="spin-reward-title">${esc(sr.title)} 💰</b>
          ${sr.notify_admin ? `<span class="spin-admin-notify-badge">🔔 اعلان ادمین</span>` : ''}
        </div>
        <div class="spin-reward-amount-row">
          💰 مبلغ: <b class="cyan-val">${sr.amount > 0 ? (fmt(sr.amount)) : 'بدون مبلغ (پاداش غیرنقدی)'}</b>
        </div>
        <div class="spin-reward-weight-row">
          🎲 وزن شانس: <b>${nf(sr.weight||1)}</b>
        </div>
      </div>
      <div class="spin-reward-card-actions">
        <button type="button" class="spin-reward-btn edit" data-edit-spin-reward="${idx}">✏️ ویرایش</button>
        <button type="button" class="spin-reward-btn delete" data-del-spin-reward="${idx}">🗑️ حذف</button>
      </div>
    </div>
  `).join('');
}

function openSpinRewardModal(index = null) {
  const sr = index === null ? { title: '', amount: 0, weight: 10, notify_admin: false } : (miniappSpinRewards[index] || {});
  const isNew = index === null;

  const existing = $('spinRewardModalBackdrop');
  if(existing) existing.remove();

  const backdrop = document.createElement('div');
  backdrop.id = 'spinRewardModalBackdrop';
  backdrop.className = 'spin-reward-modal-backdrop';
  backdrop.innerHTML = `
    <div class="spin-reward-modal-card">
      <div class="spin-reward-modal-head">
        <h3>${isNew ? '🎁 افزودن جایزه جدید' : '✏️ ویرایش جایزه گردونه'}</h3>
        <button type="button" class="spin-reward-modal-close" id="spinRewardModalClose">✕</button>
      </div>
      <form id="spinRewardForm">
        <div class="spin-reward-form-group">
          <label>عنوان جایزه:</label>
          <input type="text" id="sr_title" value="${esc(sr.title || '')}" placeholder="مثلاً ۱۰,۰۰۰ تومان اعتبار BlueGate 💰" required>
        </div>

        <div class="spin-reward-form-group">
          <label>مبلغ اعتبار BlueGate (تومان):</label>
          <input type="number" id="sr_amount" value="${sr.amount || 0}" placeholder="10000" inputmode="numeric">
          <small class="form-hint">عدد ۰ یعنی جایزه غیرنقدی است و اعتبار BlueGate شارژ نمی‌شود.</small>
        </div>

        <div class="spin-reward-form-group">
          <label>وزن شانس (Probability Weight):</label>
          <input type="number" id="sr_weight" value="${sr.weight || 10}" placeholder="18" required inputmode="numeric">
          <small class="form-hint">هرچه این عدد بالاتر باشد، احتمال برنده شدن این جایزه بیشتر است.</small>
        </div>

        <div class="spin-reward-form-group checkbox-group">
          <label class="pretty-checkbox-label">
            <input type="checkbox" id="sr_notify" ${sr.notify_admin ? 'checked' : ''}>
            <span>🔔 ارسال پیام به ادمین هنگام برنده شدن</span>
          </label>
        </div>

        <button type="submit" class="spin-reward-submit-btn">
          💾 ذخیره جایزه
        </button>
      </form>
    </div>
  `;

  document.body.appendChild(backdrop);
  setTimeout(() => backdrop.classList.add('open'), 10);

  const closeFn = () => {
    backdrop.classList.remove('open');
    setTimeout(() => backdrop.remove(), 250);
  };

  backdrop.querySelector('#spinRewardModalClose')?.addEventListener('click', closeFn);
  backdrop.addEventListener('click', (e) => {
    if(e.target === backdrop) closeFn();
  });

  backdrop.querySelector('#spinRewardForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = backdrop.querySelector('#sr_title')?.value.trim();
    if(!title) return showStatus('عنوان جایزه الزامی است', 'error');

    const item = {
      title,
      amount: Number(backdrop.querySelector('#sr_amount')?.value || 0),
      weight: Number(backdrop.querySelector('#sr_weight')?.value || 1),
      notify_admin: !!backdrop.querySelector('#sr_notify')?.checked
    };

    if(isNew) {
      miniappSpinRewards.push(item);
    } else {
      miniappSpinRewards[index] = item;
    }

    const hiddenTxt = $('as_spin_rewards');
    if(hiddenTxt) hiddenTxt.value = serializeSpinRewards(miniappSpinRewards);

    const grid = $('miniappSpinRewardsGrid');
    if(grid) grid.innerHTML = renderSpinRewardsCards(miniappSpinRewards);

    closeFn();
    showStatus(isNew ? 'جایزه جدید اضافه شد' : 'جایزه ویرایش شد');
  });
}

async function deleteSpinReward(index) {
  if(!await BlueGateUI.confirm({title:'حذف جایزه',message:'این جایزه از لیست گردونه حذف شود؟',confirmText:'حذف',danger:true})) return;
  miniappSpinRewards.splice(index, 1);
  const hiddenTxt = $('as_spin_rewards');
  if(hiddenTxt) hiddenTxt.value = serializeSpinRewards(miniappSpinRewards);
  const grid = $('miniappSpinRewardsGrid');
  if(grid) grid.innerHTML = renderSpinRewardsCards(miniappSpinRewards);
  showStatus('جایزه حذف شد');
}

function renderAdminSettings(){
  const s=adminState.settings||{};
  miniappSpinRewards = parseSpinRewardsText(s.spin_rewards_text || s.spin_rewards || []);
  const bc=s.button_colors||{};
  const pm=s.payment_methods_enabled||{};
  const starsActive=pm.stars===true || pm.stars===1 || pm.stars==='1';
  const cryptoActive=pm.crypto===true || pm.crypto===1 || pm.crypto==='1';
  const walletActive=pm.wallet!==false && pm.wallet!==0 && pm.wallet!=='0';
  const cardActive=pm.card!==false && pm.card!==0 && pm.card!=='0';
  const topupMethods=s.credit_topup_methods||{card:true,stars:true,crypto:true};

  const isGen = settingsSubTab === 'general';
  const isPay = settingsSubTab === 'payments';
  const isCry = settingsSubTab === 'crypto';
  const isApp = settingsSubTab === 'appearance';
  const isGam = settingsSubTab === 'gamification';

  return `<section class="settings-dashboard better-settings">
    <article class="settings-hero admin-card">
      <div><small>مرکز تنظیمات</small><h3>⚙️ تنظیمات فروشگاه</h3><p class="muted">تنظیمات در ۵ بخش دسته‌بندی شده‌اند. تغییرات را اعمال و ذخیره کنید.</p></div>
      <button class="primary" data-admin-save-settings>ذخیره همه</button>
    </article>

    <div class="settings-subtabs-nav">
      <button class="settings-subtab-btn ${isGen?'active':''}" data-settings-subtab="general">🏪 عمومی</button>
      <button class="settings-subtab-btn ${isPay?'active':''}" data-settings-subtab="payments">💳 پرداخت</button>
      <button class="settings-subtab-btn ${isCry?'active':''}" data-settings-subtab="crypto">🪙 کریپتو</button>
      <button class="settings-subtab-btn ${isApp?'active':''}" data-settings-subtab="appearance">🎨 ظاهر</button>
      <button class="settings-subtab-btn ${isGam?'active':''}" data-settings-subtab="gamification">🎡 پاداش</button>
    </div>

    <!-- PANE 1: GENERAL -->
    <div class="settings-subtab-pane ${isGen?'':'hidden'}" data-pane="general">
      <article class="settings-card admin-card">
        <div class="admin-card-head"><div class="admin-card-icon"><span>🏷️</span></div><div><h3>نام و هویت فروشگاه</h3><p class="muted">این نام در بالای مینی‌اپ و پیام‌های ربات قرار می‌گیرد.</p></div></div>
        <div class="form-grid settings-form">
          <label class="full"><span>نام فروشگاه</span><input id="as_brand_name" value="${esc(s.brand_name||'BlueGate')}" placeholder="مثلاً BlueGate Store"></label>
        </div>
      </article>
      <article class="settings-card admin-card">
        <div class="admin-card-head"><div class="admin-card-icon"><span>🌐</span></div><div><h3>ارز پایه پیش‌فرض</h3><p class="muted">ارز پیش‌فرض هنگام ساخت محصول یا پلن جدید.</p></div></div>
        <div class="form-grid settings-form">
          <label class="full"><span>ارز پایه پیش‌فرض جدید برای محصولات و پلن‌ها</span>
            <select id="as_default_base_currency">
              <option value="USDT" ${s.default_base_currency==='USDT'||!s.default_base_currency?'selected':''}>USDT (تتر / دلار)</option>
              <option value="IRR" ${s.default_base_currency==='IRR'?'selected':''}>تومان (IRR)</option>
              <option value="STARS" ${s.default_base_currency==='STARS'?'selected':''}>Stars (استارز)</option>
            </select>
          </label>
        </div>
      </article>
      <article class="settings-card admin-card">
        <div class="admin-card-head"><div class="admin-card-icon"><span>🔐</span></div><div><h3>کاربر، ایمیل و احراز هویت</h3><p class="muted">قوانین ثبت‌نام، کد تایید ایمیل (OTP)، کلید Resend API و اعلان‌ها.</p></div></div>
        <div class="settings-toggles two">
          <label class="pretty-switch"><input id="as_require_email_verif" type="checkbox" ${s.require_email_verification!==false?'checked':''}><span></span><b>تایید کد ایمیل (OTP)</b><small>ارسال کد ۶ رقمی هنگام ثبت‌نام وب</small></label>
          <label class="pretty-switch"><input id="as_require_contact" type="checkbox" ${s.require_contact_auth?'checked':''}><span></span><b>احراز شماره اجباری</b><small>کاربر باید Share Contact بزند</small></label>
          <label class="pretty-switch"><input id="as_notify_new" type="checkbox" ${s.notify_new_user!==false?'checked':''}><span></span><b>اعلان عضو جدید</b><small>فقط دفعه اول استارت</small></label>
        </div>
        <div class="form-grid settings-form" style="margin-top:14px">
          <label><span>کلید Resend API</span><input id="as_resend_api_key" value="${esc(s.resend_api_key||'')}" placeholder="re_123456789..."></label>
          <label><span>ایمیل فرستنده (Resend From)</span><input id="as_resend_from_email" value="${esc(s.resend_from_email||'onboarding@resend.dev')}" placeholder="onboarding@resend.dev"></label>
        </div>
      </article>
    </div>

    <!-- PANE 2: PAYMENTS -->
    <div class="settings-subtab-pane ${isPay?'':'hidden'}" data-pane="payments">
      <article class="settings-card admin-card">
        <div class="admin-card-head"><div class="admin-card-icon"><span>💳</span></div><div><h3>روش‌های فعال پرداخت</h3><p class="muted">روش‌هایی که در مرحله نهایی فاکتور به کاربر پیشنهاد می‌شوند.</p></div></div>
        <div class="settings-toggles">
          <label class="pretty-switch"><input id="as_pay_wallet" type="checkbox" ${walletActive?'checked':''}><span></span><b>اعتبار BlueGate داخلی</b><small>کم‌کردن مبلغ فاکتور از موجودی</small></label>
          <label class="pretty-switch"><input id="as_pay_card" type="checkbox" ${cardActive?'checked':''}><span></span><b>کارت به کارت</b><small>پرداخت دستی با رسید</small></label>
          <label class="pretty-switch"><input id="as_pay_stars" type="checkbox" ${starsActive?'checked':''}><span></span><b>Telegram Stars</b><small>فاکتور مستقیم داخل تلگرام</small></label>
          <label class="pretty-switch"><input id="as_pay_crypto" type="checkbox" ${cryptoActive?'checked':''}><span></span><b>پرداخت رمزارز</b><small>ولت دستی + بررسی TXID</small></label>
        </div>
        <div class="form-grid settings-form" style="margin-top:14px">
          <label><span>ارزش هر Star به تومان</span><input id="as_stars_rate" value="${esc(s.stars_rate_toman||3200)}" inputmode="numeric" placeholder="مثلاً 3200"></label>
          <label class="full"><span>متن راهنمای پرداخت</span><textarea id="as_payment" placeholder="متن راهنمای پرداخت برای کاربر">${esc(s.payment_instructions||'')}</textarea></label>
        </div>
      </article>
      <article class="settings-card admin-card credit-topup-settings-mini">
        <div class="admin-card-head"><div class="admin-card-icon"><span>💰</span></div><div><h3>شارژ اعتبار حساب</h3><p class="muted">محدوده مبلغ و روش‌های قابل استفاده برای افزایش اعتبار.</p></div></div>
        <label class="pretty-switch"><input id="as_topup_enabled" type="checkbox" ${s.credit_topup_enabled!==false?'checked':''}><span></span><b>فعال بودن شارژ حساب</b><small>نمایش دکمه شارژ در وب و Mini App</small></label>
        <div class="form-grid settings-form compact-form" style="margin-top:12px"><label><span>حداقل شارژ</span><input id="as_topup_min" type="number" inputmode="numeric" value="${esc(s.credit_topup_min||50000)}"></label><label><span>حداکثر شارژ</span><input id="as_topup_max" type="number" inputmode="numeric" value="${esc(s.credit_topup_max||5000000)}"></label><label class="full"><span>مبالغ پیشنهادی (با ویرگول)</span><input id="as_topup_presets" value="${esc((s.credit_topup_presets||[100000,200000,500000]).join(','))}"></label></div>
        <div class="settings-toggles topup-method-toggles"><label class="pretty-switch"><input id="as_topup_card" type="checkbox" ${topupMethods.card!==false?'checked':''}><span></span><b>کارت به کارت</b></label><label class="pretty-switch"><input id="as_topup_stars" type="checkbox" ${topupMethods.stars!==false?'checked':''}><span></span><b>Telegram Stars</b></label><label class="pretty-switch"><input id="as_topup_crypto" type="checkbox" ${topupMethods.crypto!==false?'checked':''}><span></span><b>رمزارز</b></label></div>
      </article>
      <article class="settings-card admin-card builder-card">
        <div class="admin-card-head"><div class="admin-card-icon"><span>💳</span></div><div><h3>حساب‌های کارت به کارت</h3><p class="muted">کارت‌های بانکی برای واریز دستی کاربران.</p></div></div>
        <input type="hidden" id="as_cards">
        <div id="cardBuilderList"></div>
        <button class="secondary wide" data-builder-add="card">➕ افزودن کارت جدید</button>
      </article>
    </div>

    <!-- PANE 3: CRYPTO -->
    <div class="settings-subtab-pane ${isCry?'':'hidden'}" data-pane="crypto">
      <article class="settings-card admin-card builder-card">
        <div class="admin-card-head"><div class="admin-card-icon"><span>🪙</span></div><div><h3>تنظیمات نرخ و کیف‌پول‌های رمزارز</h3><p class="muted">منبع نرخ، درصد احتیاط و آدرس‌های دریافت.</p></div></div>
        <div class="form-grid settings-form compact-form">
          <label><span>منبع نرخ</span><select id="as_crypto_source"><option value="auto">خودکار: Wallex → Ramzinex → Nobitex → دستی/cache</option><option value="wallex">اولویت با Wallex + fallback</option><option value="ramzinex">اولویت با Ramzinex + fallback</option><option value="nobitex">اولویت با Nobitex + fallback</option><option value="manual">فقط نرخ دستی</option></select></label>
          <label><span>درصد احتیاط نرخ</span><input id="as_crypto_markup" value="${esc(s.crypto_rate_markup_percent||1)}" inputmode="decimal" placeholder="مثلاً 1"></label><label><span>رفرش نرخ هر چند ثانیه</span><input id="as_crypto_refresh_interval" value="${esc(s.crypto_rate_refresh_interval_seconds||600)}" inputmode="numeric" placeholder="60"></label>
          <label class="pretty-switch inline" style="grid-column:1/-1"><input id="as_crypto_notify" type="checkbox" ${s.crypto_notify_rate_fail!==false?'checked':''}><span></span><b>اعلان خطای نرخ به ادمین</b></label>
        </div>
        <input type="hidden" id="as_crypto_wallets">
        <div id="walletBuilderList"></div>
        <button class="secondary wide" data-builder-add="wallet">➕ افزودن ولت جدید</button>
      </article>
      <article class="settings-card admin-card builder-card">
        <div class="admin-card-head"><div class="admin-card-icon"><span>📈</span></div><div><h3>نرخ دستی fallback و وضعیت کش</h3><p class="muted">اگر Providerها جواب ندادند یا منبع دستی باشد.</p></div></div>
        <input type="hidden" id="as_crypto_rates">
        <div class="rate-live-box"><b>نرخ‌های فعلی Providerها/cache</b><pre id="cryptoRateCacheView">${esc(cryptoRateCacheText())}</pre><button class="secondary wide" data-refresh-crypto-rates>🔄 رفرش نرخ از Wallex/Ramzinex/Nobitex</button></div>
        <div id="rateBuilderList"></div>
        <button class="secondary wide" data-builder-add="rate">➕ افزودن نرخ دستی</button>
      </article>
    </div>

    <!-- PANE 4: APPEARANCE -->
    <div class="settings-subtab-pane ${isApp?'':'hidden'}" data-pane="appearance">
      <article class="settings-card admin-card">
        <div class="admin-card-head"><div class="admin-card-icon"><span>🎨</span></div><div><h3>پالت رنگ و تم Mini App</h3><p class="muted">رنگ اصلی و دکمه‌ها را با color picker یا پالت سریع تنظیم کن.</p></div></div>
        <div class="settings-color-grid">
          <label><span>رنگ اصلی</span>${colorPicker('as_theme',s.theme_color||'#1d9bf0')}${settingsPalette('as_theme')}</label>
          <label class="pretty-switch inline"><input id="as_btn_enabled" type="checkbox" ${s.button_colors_enabled?'checked':''}><span></span><b>رنگی بودن دکمه‌های Mini App</b></label>
          <label><span>دکمه اصلی</span>${colorPicker('as_primary',bc.primary||'#1d9bf0')}${settingsPalette('as_primary')}</label>
          <label><span>دکمه دوم</span>${colorPicker('as_secondary',bc.secondary||'#2563eb')}${settingsPalette('as_secondary')}</label>
          <label><span>موفق</span>${colorPicker('as_success',bc.success||'#22c55e')}${settingsPalette('as_success')}</label>
          <label><span>هشدار</span>${colorPicker('as_warning',bc.warning||'#f59e0b')}${settingsPalette('as_warning')}</label>
          <label><span>حذف/خطر</span>${colorPicker('as_danger',bc.danger||'#ef4444')}${settingsPalette('as_danger')}</label>
        </div>
      </article>
    </div>

    <!-- PANE 5: GAMIFICATION -->
    <div class="settings-subtab-pane ${isGam?'':'hidden'}" data-pane="gamification">
      <article class="settings-card admin-card">
        <div class="spin-rewards-header-row">
          <div style="display:flex;gap:10px;align-items:center;">
            <div class="admin-card-icon"><span>🎡</span></div>
            <div>
              <h3 style="font-size:16px;font-weight:800;margin:0;">مدیریت جوایز گردونه شانس (${miniappSpinRewards.length})</h3>
              <p class="muted" style="margin-top:2px;font-size:14px;">تعریف جوایز، شانس احتمال و اعلان ادمین</p>
            </div>
          </div>
          <button type="button" class="primary" id="btnAddSpinReward" style="background:linear-gradient(135deg,#00f2fe,#1d9bf0);color:#000;font-size:14px;padding:8px 14px;border-radius:12px;font-weight:900;border:0;cursor:pointer;">➕ افزودن جایزه جدید</button>
        </div>

        <div style="margin:14px 0 16px;">
          <label style="display:block;font-size:14px;color:var(--muted);margin-bottom:6px;">تعداد زیرمجموعه برای دریافت ۱ شانس گردونه:</label>
          <input id="as_spin_every" value="${esc(s.spin_referrals_per_chance||5)}" inputmode="numeric" style="max-width:240px;">
        </div>

        <textarea id="as_spin_rewards" style="display:none;">${esc(serializeSpinRewards(miniappSpinRewards))}</textarea>

        <div id="miniappSpinRewardsGrid" class="spin-rewards-admin-grid">
          ${renderSpinRewardsCards(miniappSpinRewards)}
        </div>
      </article>

      <article class="settings-card admin-card" style="margin-top:14px">
        <div class="admin-card-head"><div class="admin-card-icon"><span>👑</span></div><div><h3>مدیریت نرخ‌های VIP و ضریب پورسانت</h3><p class="muted">تنظیم حد نصاب دعوت و ضریب پورسانت سطح‌ها.</p></div></div>
        <div class="form-grid settings-form compact-form">
          <label><span>🥉 برنز (ضریب)</span><input id="vip_bronze_mult" value="${esc((s.vip_tier_rates?.bronze?.multiplier)||1.00)}" inputmode="decimal"></label>
          <label><span>🥈 سیلور (حد نصاب)</span><input id="vip_silver_min" value="${esc((s.vip_tier_rates?.silver?.min_ref)||10)}" inputmode="numeric"></label>
          <label><span>🥈 سیلور (ضریب)</span><input id="vip_silver_mult" value="${esc((s.vip_tier_rates?.silver?.multiplier)||1.10)}" inputmode="decimal"></label>
          <label><span>🥇 گلد (حد نصاب)</span><input id="vip_gold_min" value="${esc((s.vip_tier_rates?.gold?.min_ref)||50)}" inputmode="numeric"></label>
          <label><span>🥇 گلد (ضریب)</span><input id="vip_gold_mult" value="${esc((s.vip_tier_rates?.gold?.multiplier)||1.25)}" inputmode="decimal"></label>
          <label><span>💎 دایموند (حد نصاب)</span><input id="vip_diamond_min" value="${esc((s.vip_tier_rates?.diamond?.min_ref)||100)}" inputmode="numeric"></label>
          <label><span>💎 دایموند (ضریب)</span><input id="vip_diamond_mult" value="${esc((s.vip_tier_rates?.diamond?.multiplier)||1.50)}" inputmode="decimal"></label>
        </div>
        <button class="secondary wide" style="margin-top:10px" data-save-vip-rates>💾 ذخیره نرخ‌های VIP</button>
      </article>
    </div>

    <button class="primary save-floating" data-admin-save-settings>ذخیره همه تنظیمات</button>
  </section>`;
}
function currencyOptions(selected=''){
  const def = adminState?.settings?.default_base_currency || 'USDT';
  const cur = selected || def;
  return `<option value="USDT" ${cur==='USDT'||cur==='USD'?'selected':''}>USDT (تتر / دلار)</option><option value="IRR" ${cur==='IRR'||cur==='IRT'?'selected':''}>تومان (IRR)</option><option value="STARS" ${cur==='STARS'?'selected':''}>Stars (⭐️)</option><option value="FREE" ${cur==='FREE'?'selected':''}>رایگان</option>`;
}

let liveUsdtRateCache = null;

async function setupPricingFormListeners(prefix){
  const curEl = $(prefix + '_currency');
  const amtEl = $(prefix + '_price_amount');

  const update = () => {
    const cur = curEl?.value || 'USDT';
    const amt = Number(amtEl?.value || 0);
    const hintEl = $(prefix + '_price_hint');
    if(!hintEl) return;

    const usdtRate = liveUsdtRateCache?.rate || 65000;
    const srcName = liveUsdtRateCache?.source || 'ثبت‌شده';
    const rateSourceStr = ` (نرخ زنده ${srcName}: ${fmt(usdtRate)} تومان)`;
    const starsRate = Number(adminState?.settings?.stars_rate_toman || 3200);

    if(cur === 'USDT' || cur === 'USD'){
      const toman = Math.round(amt * usdtRate);
      hintEl.innerHTML = amt > 0 
        ? `💵 معادل <b style="color:var(--accent)">${fmt(toman)} تومان</b>${rateSourceStr}` 
        : `💵 قیمت را به <b>تتر / دلار (USDT)</b> وارد کنید.${rateSourceStr}`;
    } else if(cur === 'STARS'){
      const toman = Math.round(amt * starsRate);
      hintEl.innerHTML = amt > 0 
        ? `⭐️ معادل <b style="color:var(--accent)">${fmt(toman)} تومان</b> (هر Star = ${fmt(starsRate)} تومان)` 
        : '⭐️ تعداد Telegram Stars را وارد کنید.';
    } else if(cur === 'IRR' || cur === 'IRT'){
      hintEl.innerHTML = amt > 0 
        ? `💰 قیمت ثابت: <b style="color:var(--accent)">${fmt(amt)} تومان</b>` 
        : '💰 قیمت را به <b>تومان</b> وارد کنید.';
    } else if(cur === 'FREE'){
      hintEl.innerHTML = '🎁 این محصول / پلن به صورت رایگان ارائه می‌شود.';
    }
  };

  curEl?.addEventListener('change', update);
  amtEl?.addEventListener('input', update);
  update();

  api('get_usdt_rate').then(res => {
    if(res && res.rate > 0){
      liveUsdtRateCache = res;
      update();
    }
  }).catch(_ => {});
}

/* Legacy product/category/variant editors removed. Use Catalog Studio wizard. */
function editInventory(id){const i=adminState.inventory.find(x=>Number(x.id)===Number(id));if(!i)return;openEdit(`ویرایش آیتم انبار #${id}`,[{title:'جزئیات آیتم',fields:[{id:'ei_product',label:'محصول مرتبط',type:'select',options:productOptions(i.product_id)},{id:'ei_variant',label:'پلن مرتبط',type:'select',options:variantOptions(i.variant_id)},{id:'ei_status',label:'وضعیت فروش',type:'select',options:`<option value="available" ${i.status==='available'?'selected':''}>available</option><option value="reserved" ${i.status==='reserved'?'selected':''}>reserved</option><option value="delivered" ${i.status==='delivered'?'selected':''}>delivered</option><option value="disabled" ${i.status==='disabled'?'selected':''}>disabled</option>`},{id:'ei_content',label:'محتوای آیتم',type:'textarea',value:i.content||''}]}],async()=>adminAction('admin_update_inventory',{inventory_id:id,product_id:val('ei_product'),variant_id:val('ei_variant'),status:val('ei_status'),content:val('ei_content')}))}
function openAddCoupon(){openEdit('افزودن کد تخفیف',[{title:'اطلاعات کد',fields:[{id:'acp_code',label:'کد تخفیف',placeholder:'مثلا BLUE10'},{id:'acp_type',label:'نوع تخفیف',type:'select',options:`<option value="percent" selected>درصدی (٪)</option><option value="fixed">مبلغ ثابت (تومان)</option>`},{id:'acp_value',label:'مقدار (درصد یا تومان)',type:'number',props:'inputmode="numeric"',value:0},{id:'acp_min',label:'حداقل مبلغ سفارش (تومان)',type:'number',props:'inputmode="numeric"',value:0,placeholder:'۰ = بدون حداقل'},{id:'acp_max',label:'کل سقف استفاده',type:'number',props:'inputmode="numeric"',value:0,placeholder:'۰ = نامحدود'},{id:'acp_per_user',label:'سقف هر کاربر',type:'number',props:'inputmode="numeric"',value:1},{id:'acp_cat',label:'محدودیت دسته‌بندی (اختیاری)',type:'select',options:catOptions()},{id:'acp_expires',label:'تاریخ انقضا',type:'datetime-local'}]}],async()=>adminAction('admin_add_coupon',{code:val('acp_code'),discount_type:val('acp_type'),discount_value:val('acp_value'),min_order_amount:val('acp_min'),max_uses:val('acp_max'),max_uses_per_user:val('acp_per_user'),category_id:val('acp_cat'),expires_at:val('acp_expires')}))}
function openAddRole(){openEdit('افزودن نقش ادمین',[{title:'سطح دسترسی',fields:[{id:'ar_tid',label:'Telegram ID',type:'number',props:'inputmode="numeric"',placeholder:'مثلاً: 123456789'},{id:'ar_name',label:'نام نمایشی'},{id:'ar_role',label:'نوع دسترسی',type:'select',options:`<option value="full">ادمین کامل</option><option value="orders">فقط سفارش‌ها</option><option value="products">فقط محصولات</option><option value="finance">فقط مالی</option>`}]}],async()=>adminAction('admin_set_role',{telegram_id:val('ar_tid'),role:val('ar_role'),display_name:val('ar_name')}))}
async function adminAction(action,payload={}){
  try{
    adminState=await api(action,payload);
    if(!adminState || adminState.ok===false) throw new Error(adminState?.message||'خطا در ذخیره');
    $('userApp').classList.add('hidden');$('adminApp').classList.remove('hidden');
    closeEdit(); // BUG-11: close the presentation sheet before re-rendering admin
    applyTheme(adminState.settings||{});renderAdmin();showStatus('ذخیره شد');return true
  }catch(e){showStatus(e.message||'خطا در ذخیره','error');return false}
}
async function loadAfterAction(action,payload={}){try{state=await api(action,payload);applyTheme(state);renderUser();showStatus('انجام شد');return true}catch(e){showStatus(e.message,'error');return false}}

document.addEventListener('click',async(e)=>{
  const b=e.target.closest('[data-builder-add],[data-builder-edit],[data-builder-del],[data-admin-color],#applyCustomColor,#applyAdminColor,[data-close-share],[data-share-tg-url],[data-share-copy-url],[data-share-native],[data-share-product],[data-wishlist-pid]');
  if(!b) return;
  e.preventDefault(); e.stopPropagation();
  if(b.id==='applyCustomColor'){
    const c=$('userCustomColor')?.value || '#1d9bf0';
    localStorage.setItem('blue_ref_color',c);
    applyTheme({...state,theme_color:c});
    showStatus('رنگ دلخواه اعمال شد');
    return;
  }
  if(b.dataset.shareProduct){ openShareSheet(b.dataset.shareProduct); return; }
  if(b.dataset.closeShare !== undefined){ closeShareSheet(); return; }
  if(b.dataset.shareTgUrl){
    const link = b.dataset.shareTgUrl;
    try{tg?.openTelegramLink?.(link)}catch(_){try{Telegram?.WebApp?.openLink?.(link)}catch(__){location.href=link}}
    showStatus('لینک محصول در تلگرام باز شد');
    closeShareSheet();
    return;
  }
  if(b.dataset.shareCopyUrl !== undefined){
    copyText(_shareUrl);
    return;
  }
  if(b.dataset.shareNative !== undefined){
    if(navigator.share && _shareUrl){
      try{ await navigator.share({title: document.title, url: _shareUrl}); showStatus('اشتراک‌گذاری انجام شد'); closeShareSheet(); }catch(_){}
    }
    return;
  }
  if(b.dataset.wishlistPid !== undefined){ toggleWishlist(b.dataset.wishlistPid); return; }
  if(b.dataset.adminColor){const [id,c]=b.dataset.adminColor.split(':'); if($(id)){$(id).value=c; const t=$(id+'_text'); if(t)t.value=c; showStatus('رنگ انتخاب شد')}}
  if(b.dataset.builderAdd){ if(b.dataset.builderAdd==='card')openCardBuilder(); if(b.dataset.builderAdd==='wallet')openWalletBuilder(); if(b.dataset.builderAdd==='rate')openRateBuilder(); return; }
  if(b.dataset.builderEdit){const [type,idx]=b.dataset.builderEdit.split(':'); const i=Number(idx); if(type==='card')openCardBuilder(i); if(type==='wallet')openWalletBuilder(i); if(type==='rate')openRateBuilder(i); return; }
  if(b.dataset.builderDel){const [type,idx]=b.dataset.builderDel.split(':'); const i=Number(idx); if(!await BlueGateUI.confirm({title:'حذف مورد',message:'این مورد حذف شود؟',confirmText:'حذف',danger:true}))return; if(type==='card')adminUiCards.splice(i,1); if(type==='wallet')adminUiWallets.splice(i,1); if(type==='rate')adminUiRates.splice(i,1); syncPaymentBuilders(); showStatus('حذف شد'); return; }
},true);
// Removed capture-phase palette persistence to server — palette is local-only now.

// Override applyTheme to prefer per-user theme when available
function applyTheme(data={}){
  const local = localStorage.getItem('blue_ref_color');
  const accent = local || (data && data.theme_color) || (data && data.settings && data.settings.theme_color) || '#1d9bf0';
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--primary', data && data.button_colors_enabled===false ? '#1d9bf0' : (data && (data.button_colors?.primary || (data.settings && data.settings.button_colors?.primary)) || accent));
  document.documentElement.style.setProperty('--secondary', data && (data.button_colors?.secondary || (data.settings && data.settings.button_colors?.secondary)) || '#2563eb');
  document.documentElement.style.setProperty('--danger', data && (data.button_colors?.danger || (data.settings && data.settings.button_colors?.danger)) || '#ef4444');
  document.documentElement.style.setProperty('--success', data && (data.button_colors?.success || (data.settings && data.settings.button_colors?.success)) || '#22c55e');
  document.documentElement.style.setProperty('--warning', data && (data.button_colors?.warning || (data.settings && data.settings.button_colors?.warning)) || '#f59e0b');
  try{tg?.setHeaderColor?.(accent);tg?.setBackgroundColor?.('#08111f');tg?.MainButton?.setParams?.({color:accent,text_color:'#ffffff'});}catch(e){}
}

window.handleCardReceiptFileChange = function(input, oid) {
  const preview = document.getElementById('cardReceiptFilePreview_' + oid);
  if(!preview) return;
  if(input.files && input.files[0]) {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
      preview.innerHTML = `
        <div class="receipt-file-selected">
          <img src="${e.target.result}" alt="رسید" class="receipt-file-img">
          <div class="receipt-file-info">
            <b>${esc(file.name)}</b>
            <small>${Math.round(file.size / 1024)} KB</small>
          </div>
          <button type="button" class="receipt-file-remove" onclick="event.stopPropagation(); clearCardReceiptFile(${oid});">✕</button>
        </div>
      `;
      preview._base64 = e.target.result;
    };
    reader.readAsDataURL(file);
  }
};

window.clearCardReceiptFile = function(oid) {
  const input = document.getElementById('cardReceiptFile_' + oid);
  if(input) input.value = '';
  const preview = document.getElementById('cardReceiptFilePreview_' + oid);
  if(preview) {
    preview.innerHTML = `
      <span class="upload-icon">🖼️</span>
      <span class="upload-text">انتخاب یا درگ تصویر رسید پرداخت...</span>
    `;
    delete preview._base64;
  }
};

document.addEventListener('click',async(e)=>{
  if(e.target.closest('#btnAddSpinReward')){ openSpinRewardModal(null); return; }
  const editSpin = e.target.closest('[data-edit-spin-reward]');
  if(editSpin){ openSpinRewardModal(Number(editSpin.dataset.editSpinReward)); return; }
  const delSpin = e.target.closest('[data-del-spin-reward]');
  if(delSpin){ deleteSpinReward(Number(delSpin.dataset.delSpinReward)); return; }
  const submitTxidBtn = e.target.closest('[data-submit-inline-txid]');
  if(submitTxidBtn){
    const oid = submitTxidBtn.dataset.submitInlineTxid;
    const input = $('inlineTxidInput_' + oid);
    const txt = input ? input.value.trim() : '';
    if(!txt){
      showStatus('لطفاً کد هش تراکنش (TXID) را وارد کنید', 'error');
      return;
    }
    await loadAfterAction('submit_crypto_hash', { order_id: oid, tx_hash: txt });
    currentTab = 'orders';
    currentOrderId = oid;
    renderUser();
    showStatus('کد هش ثبت شد و در صف استعلام خودکار قرار گرفت ⚡');
    return;
  }
  const submitCardReceiptBtn = e.target.closest('[data-submit-inline-card-receipt]');
  if(submitCardReceiptBtn){
    const oid = submitCardReceiptBtn.dataset.submitInlineCardReceipt;
    const noteInput = $('cardReceiptNote_' + oid);
    const note = noteInput ? noteInput.value.trim() : '';
    const preview = $('cardReceiptFilePreview_' + oid);
    const b64 = preview ? preview._base64 : null;

    if(!note && !b64){
      showStatus('لطفاً شماره پیگیری یا تصویر رسید را وارد کنید', 'error');
      return;
    }

    const ok = await loadAfterAction('submit_receipt', {
      order_id: oid,
      note: note || 'رسید واریز کارت به کارت',
      receipt_b64: b64 || ''
    });
    if(!ok) return;
    const fresh=(state.orders||[]).find(x=>Number(x.id)===Number(oid));
    if(fresh){fresh.status='receipt_submitted';fresh.status_fa='رسید ارسال شده';if(b64)fresh.receipt_file_id=fresh.receipt_file_id||'uploaded';}
    currentTab = 'orders';
    currentOrderId = oid;
    renderUser();
    showStatus('رسید با موفقیت ثبت شد؛ منتظر بررسی ادمین است ⚡','success');
    return;
  }
  const cartBtn = e.target.closest('#cartFab, .cart-fab');
  if(cartBtn){
    if(typeof haptic === 'function') haptic('light');
    openCartSheet();
    return;
  }
  const t=e.target.closest('button,a,[data-admin-tab],[data-settings-subtab],[data-admin-view-mode],[data-admin-action-sheet],[data-tab],[data-tab-jump],[data-color],[data-cat],[data-shop-sort],[data-shop-toggle],[data-clear-filters],[data-product],[data-product-preview],[data-back-shop],[data-wallet-order],[data-select-card],[data-pay-stars],[data-select-crypto],[data-select-crypto-tab],[data-reset-payment-method],[data-show-crypto],[data-crypto-hash],[data-check-crypto],[data-bulk-action],[data-reorder],[data-chat-user],[data-edit-role],[data-admin-remove-role],[data-contact-wallet],[data-contact-ban],[data-edit-inventory],[data-admin-delete-inventory],[data-admin-hard-delete-inventory],[data-admin-status],[data-admin-order-note],[data-admin-archive-order],[data-admin-delete-order],[data-admin-cleanup],[data-admin-deliver],[data-admin-service],[data-service-view],[data-service-copy-link],[data-view-receipt],[data-admin-save-settings],[data-open-url],[data-copy],[data-receipt],[data-customer-note],[data-order-filter],[data-order-open],[data-order-back],[data-order-more],[data-hide-order],[data-clear-canceled],[data-cancel],[data-refresh-crypto-rates],[data-admin-backup-create],[data-admin-backup-sendbot],[data-admin-backup-delete],[data-admin-backup-restore-server],[data-admin-backup-upload],[data-admin-load-more-orders],[data-accordion-toggle],[data-accordion-add-variant],[data-edit-coupon],[data-admin-toggle-coupon],[data-admin-delete-coupon],[data-credit-topup-approve],[data-credit-topup-reject],[data-credit-topup-receipt],[data-credit-topup-tx],[data-mini-topup-change],[data-mini-topup-cancel],[data-renew-order],[data-my-service],[data-my-service-back]')||e.target;if(t.id==='openShopFilters'){openShopFilters();return}if(t.id==='orderAdvancedFilter'){openOrderFiltersSheet();return}if(t.id==='ordersManageBtn'){openOrdersManageSheet();return}if(t.dataset.orderMore){openOrderMoreActions(t.dataset.orderMore);return}if(t.dataset.creditView){openCreditSubview(t.dataset.creditView);return}if(t.dataset.serviceView){openDirectServiceViewer(t.dataset.serviceView,t.dataset.serviceUrl||'',t.dataset.serviceTitle||'مدیریت سرویس');return}if(t.dataset.serviceCopyLink){copyMiniServiceUrl(t.dataset.serviceCopyLink,t.dataset.serviceUrl||'');return}if(t.dataset.settingsSubtab){if(typeof haptic==='function')haptic('light');settingsSubTab=t.dataset.settingsSubtab;document.querySelectorAll('.settings-subtab-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.settingsSubtab===settingsSubTab));document.querySelectorAll('.settings-subtab-pane').forEach(pane=>pane.classList.toggle('hidden',pane.dataset.pane!==settingsSubTab));const settingsTabLabels = { general: '🏪 عمومی', payments: '💳 روش‌های پرداخت', crypto: '🪙 کریپتو & ارزها', appearance: '🎨 ظاهر & تم', gamification: '🎡 پاداش & گردونه' };const lbl=$('activeSettingsTabLabel');if(lbl)lbl.textContent=settingsTabLabels[settingsSubTab]||'';const muted=$('activeSettingsTabMuted');if(muted)muted.textContent=settingsTabLabels[settingsSubTab]||'';return}if(t.dataset.adminViewMode){adminOrderViewMode=t.dataset.adminViewMode;renderAdmin();return}if(t.dataset.adminActionSheet){const [type,id]=t.dataset.adminActionSheet.split(':');openAdminActionSheet(type,id);return}if(t.dataset.tab){setTab(t.dataset.tab)}if(t.dataset.tabJump){setTab(t.dataset.tabJump)}if(t.id==='paletteQuick'){openPalettePopup();return}if(t.id==='editMiniProfile'||t.id==='editMiniProfile2'){openMiniProfileEditor();return}if(t.id==='miniChangeEmailBtn'||t.id==='miniChangeEmailInlineBtn'){openMiniEmailChangeFlow();return}if(t.id==='changeMiniPassword'){openMiniPasswordEditor();return}if(t.id==='shareInviteHome'){const link=state.user?.referral_link||'';if(link){if(TG?.openTelegramLink)TG.openTelegramLink('https://t.me/share/url?url='+encodeURIComponent(link));else navigator.clipboard?.writeText(link);showStatus('لینک دعوت آماده اشتراک است')}return}if(t.id==='miniReferralJump'){openCreditSubview('referral');return}if(['miniCreditTopup','miniCreditTopup2','miniCreditTopupEmpty','miniCreditTopupHistory','miniCreditTopupHistoryEmpty','miniCreditTopupHome'].includes(t.id)){openMiniCreditTopup();return}if(t.dataset.miniTopupCancel){if(await BlueGateUI.confirm({title:'لغو درخواست شارژ',message:'این درخواست شارژ لغو شود؟ اگر رسید یا TXID فرستاده‌ای، دیگر بررسی نخواهد شد.',confirmText:'لغو درخواست',danger:true})){try{state=await api('cancel_credit_topup',{topup_id:Number(t.dataset.miniTopupCancel)});renderWallet();showStatus('درخواست شارژ لغو شد')}catch(e){showStatus(e.message||'لغو درخواست انجام نشد','error')}}return}if(t.dataset.miniTopupChange){if(await BlueGateUI.confirm({title:'تغییر روش پرداخت',message:'درخواست فعلی بسته می‌شود و یک درخواست جدید با همان مبلغ برای انتخاب روش تازه ساخته می‌شود.',confirmText:'تغییر روش'})){try{const r=await api('credit_topup_change_method',{topup_id:Number(t.dataset.miniTopupChange)});state=r;renderWallet();openMiniTopupMethods(r.topup);showStatus('روش پرداخت جدید را انتخاب کن')}catch(e){showStatus(e.message||'تغییر روش پرداخت انجام نشد','error')}}return}if(t.id==='miniSupportBtn'){openMiniSupport();return}if(t.id==='miniNotificationsBtn'){openNotifications();return}if(t.dataset.myService){currentServiceOrderId=Number(t.dataset.myService);currentTab='home';renderUser();return}if(t.dataset.myServiceBack!==undefined){currentServiceOrderId=null;currentTab='home';renderUser();return}if(t.dataset.renewOrder){try{const r=await api('renew_order',{order_id:Number(t.dataset.renewOrder)});state=r;_enhancementsHydrated=false;scheduleMiniEnhancementsHydration();currentTab='orders';currentOrderId=Number(r.order?.id||state.orders?.[0]?.id||0);renderUser();showStatus('🔄 سفارش تمدید ساخته شد','success')}catch(e){showStatus(e.message||'تمدید انجام نشد','error')}return}if(t.dataset.color){localStorage.setItem('blue_ref_color',t.dataset.color);applyTheme({...state,theme_color:t.dataset.color});showStatus('رنگ تغییر کرد')}if(t.id==='resetColor'){localStorage.removeItem('blue_ref_color');applyTheme(state);showStatus('رنگ پیش‌فرض برگشت')}if(t.id==='applyCustomColor'){const c=$('userCustomColor')?.value||'#1d9bf0';localStorage.setItem('blue_ref_color',c);applyTheme({...state,theme_color:c});showStatus('رنگ دلخواه اعمال شد')}if(t.dataset.cat){activeCategory=t.dataset.cat;document.querySelectorAll('.cat-pill').forEach(el=>el.classList.toggle('active',el.dataset.cat===activeCategory));renderShopSections()}if(t.dataset.shopSort!==undefined){shopSort=t.dataset.shopSort;document.querySelectorAll('[data-shop-sort]').forEach(el=>el.classList.toggle('active',el.dataset.shopSort===shopSort));renderShopSections()}if(t.dataset.shopToggle!==undefined){if(t.dataset.shopToggle==='instock'){shopFilterInStock=!shopFilterInStock;t.textContent=shopFilterInStock?'⚡':'📦'}else if(t.dataset.shopToggle==='featured')shopFilterFeatured=!shopFilterFeatured;else if(t.dataset.shopToggle==='wishlist'){shopFilterWishlist=!shopFilterWishlist;t.textContent=shopFilterWishlist?'❤️':'🤍'}t.classList.toggle('active');renderShopSections()}if(t.dataset.clearFilters!==undefined){searchTerm='';activeCategory='all';shopSort='newest';shopFilterInStock=false;shopFilterFeatured=false;shopFilterWishlist=false;renderShop()}if(t.id==='searchInput')return;if(t.dataset.product)showProduct(t.dataset.product);if(t.dataset.productPreview)showProduct(t.dataset.productPreview);if(t.dataset.backShop!==undefined){currentTab='shop';renderUser()}// Purchase actions are handled exclusively by the single capture-phase validated handler below (avoids duplicate listeners/API calls).
if(t.dataset.walletOrder){openWalletConfirmSheet(t.dataset.walletOrder);return}if(t.dataset.selectCard){await loadAfterAction('select_payment_method',{order_id:t.dataset.selectCard,method:'card',details:{}});currentTab='orders';currentOrderId=t.dataset.selectCard;renderUser();showStatus('کارت به کارت انتخاب شد')}if(t.dataset.selectCryptoTab){await loadAfterAction('select_payment_method',{order_id:t.dataset.selectCryptoTab,method:'crypto',details:{}});currentTab='orders';currentOrderId=t.dataset.selectCryptoTab;renderUser();showStatus('پرداخت رمزارز انتخاب شد');return}if(t.dataset.resetPaymentMethod){const oid=t.dataset.resetPaymentMethod;await loadAfterAction('select_payment_method',{order_id:oid,method:'none',details:{}});const o=orderById(oid);if(o){o.payment_method='';o.payment_method_fa='انتخاب نشده';}currentTab='orders';currentOrderId=oid;renderOrders();showStatus('انتخاب روش پرداخت بازنشانی شد');return}if(t.dataset.payStars){await loadAfterAction('start_stars_invoice',{order_id:t.dataset.payStars});currentTab='orders';currentOrderId=t.dataset.payStars;renderUser();showStatus('فاکتور Stars داخل تلگرام ارسال شد')}if(t.dataset.selectCrypto){const [oid,wid]=t.dataset.selectCrypto.split(':');await loadAfterAction('select_crypto_wallet',{order_id:oid,wallet_id:wid});currentTab='orders';currentOrderId=oid;renderUser();showStatus('کیف پول رمزارز انتخاب شد')}if(t.dataset.showCrypto){showStatus('کمی پایین‌تر کیف پول رمزارز را انتخاب کن')}if(t.dataset.cryptoHash){openDialog('ثبت TXID / Hash',`هش تراکنش رمزارز سفارش #${t.dataset.cryptoHash} را وارد کن.`, 'TXID / Hash', async(txt)=>{await loadAfterAction('submit_crypto_hash',{order_id:t.dataset.cryptoHash,tx_hash:txt});currentTab='orders';currentOrderId=t.dataset.cryptoHash;renderUser();showStatus('هش ثبت شد و در صف بررسی قرار گرفت')})}if(t.dataset.checkCrypto){await loadAfterAction('check_crypto_payment',{order_id:t.dataset.checkCrypto});currentTab='orders';currentOrderId=t.dataset.checkCrypto;renderUser();showStatus('بررسی پرداخت انجام شد')}
  if(t.id==='openQrHome'||t.id==='openQrWallet'){openQrSheet();return}if(t.id==='openReferralShareMini'){openReferralShareMini();return}if(t.id==='openCustomReferralCode'){openCustomReferralCodeMini();return}if(t.id==='shareInviteEmpty'){openReferralShareMini();return}if(t.id==='openPromoSheetBtn'){openPromoSheet();return}if(t.id==='adminOrderSearchBtn'){adminOrderSearch=$('adminOrderSearchInput')?.value||'';adminOrderStatusFilter=$('adminOrderStatusSelect')?.value||'all';adminSearchOrdersNow();return}if(t.id==='adminOrderResetBtn'){adminOrderSearch='';adminOrderStatusFilter='all';adminSearchOrdersNow();return}if(t.id==='bulkClearBtn'){selectedOrderIds.clear();renderAdmin();return}if(t.dataset.bulkAction){bulkOrderAction(t.dataset.bulkAction);return}if(t.dataset.reorder){const [type,id,dir]=t.dataset.reorder.split(':');reorderItem(type,Number(id),dir);return}if(t.dataset.chatUser){openUserChat(t.dataset.chatUser);return}if(t.dataset.editRole){const r=(adminState.admin_roles||[]).find(x=>Number(x.id)===Number(t.dataset.editRole));if(!r)return;openEdit(`ویرایش نقش ${esc(r.display_name||'')}`,[{title:'سطح دسترسی',fields:[{id:'erl_name',label:'نام نمایشی',value:r.display_name||''},{id:'erl_role',label:'نوع دسترسی',type:'select',options:`<option value="full" ${r.role==='full'?'selected':''}>ادمین کامل</option><option value="orders" ${r.role==='orders'?'selected':''}>فقط سفارش‌ها</option><option value="products" ${r.role==='products'?'selected':''}>فقط محصولات</option><option value="finance" ${r.role==='finance'?'selected':''}>فقط مالی</option>`}]}],async()=>adminAction('admin_set_role',{telegram_id:r.telegram_id,role:val('erl_role'),display_name:val('erl_name')}));return}if(t.dataset.adminRemoveRole&&await BlueGateUI.confirm({title:'حذف نقش',message:'نقش مدیریتی این کاربر حذف شود؟',confirmText:'حذف نقش',danger:true})){adminAction('admin_remove_role',{telegram_id:Number(t.dataset.adminRemoveRole)});return}
if(t.dataset.creditTopupReceipt){const u=t.dataset.creditTopupReceipt;if(TG?.openLink)TG.openLink(new URL(u,location.origin).href);else window.open(u,'_blank');return}if(t.dataset.creditTopupTx){navigator.clipboard?.writeText(t.dataset.creditTopupTx);showStatus('TXID کپی شد');return}if(t.dataset.creditTopupApprove){if(await BlueGateUI.confirm({title:'تأیید شارژ',message:'این شارژ تأیید و به اعتبار کاربر اضافه شود؟',confirmText:'تأیید شارژ'}))adminAction('admin_credit_topup_approve',{topup_id:Number(t.dataset.creditTopupApprove)});return}if(t.dataset.creditTopupReject){if(await BlueGateUI.confirm({title:'رد شارژ',message:'این درخواست شارژ رد شود؟',confirmText:'رد درخواست',danger:true}))adminAction('admin_credit_topup_reject',{topup_id:Number(t.dataset.creditTopupReject)});return}if(t.dataset.contactWallet){openDialog('افزایش/کاهش اعتبار',`مبلغی که می‌خواهید به اعتبار کاربر با ID ${t.dataset.contactWallet} اضافه شود را وارد کنید. برای کاهش، عدد منفی وارد کنید.`,'مثلا 50000 یا -20000',async(txt)=>{const amount=Number(txt);if(isNaN(amount)||!amount)return showStatus('مبلغ نامعتبر است','error');const ok=await adminAction('admin_add_balance',{telegram_id:t.dataset.contactWallet,amount});if(ok){showStatus('اعتبار تغییر کرد');closeCustomer360();setTimeout(()=>openCustomer360(t.dataset.contactWallet),500)}});return}if(t.dataset.contactBan){if(await BlueGateUI.confirm({title:'مسدود کردن کاربر',message:'دسترسی این کاربر مسدود شود؟',confirmText:'مسدود کن',danger:true})){const ok=await adminAction('admin_ban_user',{telegram_id:t.dataset.contactBan});if(ok)showStatus('کاربر مسدود شد')}return}if(t.dataset.catalogApplyOne!==undefined){const legacyId=Number(t.dataset.catalogApplyOne||0);if(legacyId&&await BlueGateUI.confirm({title:'نگاشت مورد قدیمی',message:'این مورد Needs Review به کاتالوگ جدید نگاشت شود؟',confirmText:'نگاشت'}))adminAction('admin_catalog_apply_one',{legacy_product_id:legacyId,confirm:'APPLY'});return}if(t.dataset.catalogPreview!==undefined){adminAction('admin_catalog_preview');return}if(t.dataset.catalogApply!==undefined){if(await BlueGateUI.confirm({title:'Migration کاتالوگ',message:'Migration کاتالوگ اعمال شود؟ هیچ محصول یا سفارش قدیمی حذف نمی‌شود.',confirmText:'اعمال Migration'}))adminAction('admin_catalog_apply',{confirm:'APPLY'});return}if(t.dataset.catalogFast!==undefined){openCatalogFast();return}if(t.dataset.catalogMoveGroup!==undefined){openCatalogMoveGroup();return}if(t.dataset.catalogMovePlan!==undefined){openCatalogMovePlan();return}if(t.dataset.catalogAddService!==undefined){openCatalogAddService();return}if(t.dataset.catalogAddGroup!==undefined){openCatalogAddGroup();return}if(t.dataset.catalogAddPlan!==undefined){openCatalogAddPlan();return}if(t.dataset.adminTab){setAdminTab(t.dataset.adminTab)}if(t.id==='reloadAdmin')loadAdmin();if(t.id==='openCmdPalette'){openCommandPalette();return}if(t.dataset.editInventory)editInventory(t.dataset.editInventory);if(t.dataset.adminDeleteInventory&&await BlueGateUI.confirm({title:'حذف امن آیتم',message:'این آیتم از انبار به‌صورت امن حذف شود؟',confirmText:'حذف',danger:true}))adminAction('admin_delete_inventory',{inventory_id:t.dataset.adminDeleteInventory});if(t.dataset.adminHardDeleteInventory&&await BlueGateUI.confirm({title:'حذف کامل آیتم',message:'این آیتم برای همیشه حذف شود؟ این عملیات قابل برگشت نیست.',confirmText:'حذف کامل',danger:true}))adminAction('admin_hard_delete_inventory',{inventory_id:t.dataset.adminHardDeleteInventory});if(t.dataset.adminStatus){const [id,status]=t.dataset.adminStatus.split(':');adminAction('admin_order_status',{order_id:id,status})}if(t.dataset.adminOrderNote){const id=t.dataset.adminOrderNote;const o=(adminState.orders||[]).find(x=>Number(x.id)===Number(id));if(o)openEdit(`یادداشت داخلی #${id}`,[{title:'یادداشت داخلی (مخفی)',fields:[{id:'adm_note',label:'متن یادداشت',type:'textarea',placeholder:'فقط شما می‌بینید...',value:o.admin_note||''}]}],async()=>adminAction('admin_order_note',{order_id:id,note:val('adm_note')}))}if(t.dataset.adminArchiveOrder&&await BlueGateUI.confirm({title:'آرشیو سفارش',message:'این سفارش آرشیو شود؟',confirmText:'آرشیو'}))adminAction('admin_archive_order',{order_id:t.dataset.adminArchiveOrder});if(t.dataset.adminDeleteOrder&&await BlueGateUI.confirm({title:'حذف کامل سفارش',message:'این عملیات قابل برگشت نیست.',confirmText:'حذف کامل',danger:true}))adminAction('admin_delete_order',{order_id:t.dataset.adminDeleteOrder});if(t.dataset.adminCleanup&&await BlueGateUI.confirm({title:'پاکسازی سفارش‌ها',message:'سفارش‌های لغو و ردشده پاکسازی شوند؟',confirmText:'پاکسازی',danger:true}))adminAction('admin_cleanup_orders',{older_days:t.dataset.adminCleanup==='all'?null:t.dataset.adminCleanup});if(t.dataset.adminService){const oid=t.dataset.adminService;const o=(adminState.orders||[]).find(x=>Number(x.id)===Number(oid))||{};openEdit(`لینک سرویس #${oid}`,[{title:'دسترسی سرویس',fields:[{id:'svc_url',label:'لینک HTTPS پنل / Subscription',placeholder:'https://...',value:o.delivery_url||''},{id:'svc_title',label:'عنوان دکمه برای مشتری',value:o.delivery_title||'مدیریت سرویس'},{id:'svc_note',label:'پیام تحویل',type:'textarea',value:o.delivery_text||'سرویس شما آماده است. از سفارش‌ها می‌توانید لینک سرویس را باز یا کپی کنید.'}]}],async()=>{const ok=await adminAction('admin_set_service_delivery',{order_id:oid,delivery_url:val('svc_url'),delivery_title:val('svc_title'),delivery_note:val('svc_note')});if(ok){currentAdminTab='orders';showStatus('لینک مستقیم سرویس ثبت شد')}});return}if(t.dataset.adminDeliver){const oid=t.dataset.adminDeliver;openDialog('تحویل سفارش',`متن تحویل سفارش #${oid} را وارد کن.`, 'ایمیل/پسورد، لینک ساب یا کد', async(txt)=>{const ok=await adminAction('admin_deliver_order',{order_id:oid,delivery:txt});if(ok){currentAdminTab='orders';showStatus('تحویل ثبت شد و برای کاربر ارسال شد')}})}if(t.dataset.viewReceipt!==undefined){loadReceiptImage(t.dataset.viewReceipt)}if(t.dataset.adminSaveSettings!==undefined){syncPaymentBuilders();adminAction('admin_save_settings',{brand_name:val('as_brand_name'),default_base_currency:val('as_default_base_currency'),theme_color:val('as_theme'),button_colors_enabled:val('as_btn_enabled')?1:0,require_contact_auth:val('as_require_contact')?1:0,notify_new_user:val('as_notify_new')?1:0,resend_api_key:val('as_resend_api_key'),resend_from_email:val('as_resend_from_email'),require_email_verification:val('as_require_email_verif')?1:0,button_colors:{primary:val('as_primary'),secondary:val('as_secondary'),success:val('as_success'),warning:val('as_warning'),danger:val('as_danger')},payment_instructions:val('as_payment'),payment_methods_enabled:{wallet:val('as_pay_wallet')?1:0,card:val('as_pay_card')?1:0,stars:val('as_pay_stars')?1:0,crypto:val('as_pay_crypto')?1:0},credit_topup_enabled:val('as_topup_enabled')?1:0,credit_topup_min:val('as_topup_min'),credit_topup_max:val('as_topup_max'),credit_topup_presets:val('as_topup_presets'),credit_topup_methods:{card:val('as_topup_card')?1:0,stars:val('as_topup_stars')?1:0,crypto:val('as_topup_crypto')?1:0},card_accounts_text:val('as_cards'),stars_rate_toman:val('as_stars_rate'),crypto_wallets_text:val('as_crypto_wallets'),crypto_manual_rates_text:val('as_crypto_rates'),crypto_rate_source:val('as_crypto_source'),crypto_rate_provider_priority:'wallex,ramzinex,nobitex',crypto_rate_markup_percent:val('as_crypto_markup'),crypto_rate_refresh_interval_seconds:val('as_crypto_refresh_interval'),crypto_notify_rate_fail:val('as_crypto_notify')?1:0,spin_referrals_per_chance:val('as_spin_every'),spin_rewards_text:val('as_spin_rewards')})}
if(t.dataset.orderBack!==undefined){
  currentOrderId = null;
  renderUser();
  return;
}
if(t.dataset.orderOpen){
  currentOrderId = t.dataset.orderOpen;
  renderUser();
  return;
}
if(t.dataset.orderFilter){
  orderFilter = t.dataset.orderFilter;
  currentOrderId = null;
  renderUser();
  return;
}
if(t.dataset.hideOrder && await BlueGateUI.confirm({title:'حذف از لیست',message:'این سفارش از لیست شما مخفی شود؟',confirmText:'مخفی کن',danger:true})){
  await loadAfterAction('hide_order', { order_id: t.dataset.hideOrder });
  currentTab = 'orders';
  currentOrderId = null;
  renderUser();
  return;
}
if(t.dataset.clearCanceled!==undefined && await BlueGateUI.confirm({title:'پاکسازی سفارش‌ها',message:'همه سفارش‌های لغو/رد شده از لیست شما مخفی شوند؟',confirmText:'پاکسازی',danger:true})){
  await loadAfterAction('clear_canceled_orders');
  currentTab = 'orders';
  currentOrderId = null;
  renderUser();
  return;
}
if(t.dataset.customerNote){
  const oid = t.dataset.customerNote;
  const o = orderById(oid);
  openEdit(`یادداشت سفارش #${oid}`, [{
    title: 'توضیحات و مشخصات سفارش',
    fields: [{
      id: 'cust_note_val',
      label: 'ایمیل، پسورد، یوزرنیم یا توضیح لازم',
      type: 'textarea',
      placeholder: 'مثلاً: email@example.com / Password یا توضیح مورد نیاز...',
      value: o?.customer_note || ''
    }]
  }], async () => {
    const txt = val('cust_note_val');
    await loadAfterAction('customer_order_note', { order_id: oid, note: txt });
    currentTab = 'orders';
    currentOrderId = oid;
    renderUser();
    showStatus('یادداشت سفارش ذخیره شد');
  });
  return;
}
// BUG-4: Removed duplicate [data-coupon] handler — the dedicated standalone listener below handles it correctly via openDialog(). Having both caused two dialogs to open on one click.
if(t.dataset.cancel){
  const oid = t.dataset.cancel;
  openEdit(`لغو سفارش #${oid}`, [{
    title: 'تایید لغو سفارش',
    fields: [{
      html: `<div class="cancel-confirm-box" style="padding:16px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);border-radius:18px;color:#fca5a5;font-size:15px;line-height:1.6;text-align:right">
        ⚠️ <b>آیا از لغو این سفارش اطمینان دارید؟</b><br>
        پس از لغو، زمان مجاز پرداخت منقضی می‌شود و رزرو آیتم انبار آزاد خواهد شد.
      </div>`
    }]
  }], async () => {
    await loadAfterAction('cancel_order', { order_id: oid });
    currentTab = 'orders';
    currentOrderId = null;
    renderUser();
    showStatus('سفارش با موفقیت لغو شد');
  });
  return;
}if(t.id==='shareInviteNative'){openReferralShareMini();return}if(t.id==='copyLink'||t.id==='copyRefHome'){navigator.clipboard?.writeText(state.user.referral_link);showStatus('لینک دعوت کپی شد')}if(t.id==='claimBtn')await loadAfterAction('claim_missions');if(t.id==='spinBtn')await doSpinWheel();if(t.dataset.refreshCryptoRates!==undefined){const ok=await adminAction('admin_refresh_crypto_rates',{});if(ok){showStatus('نرخ‌ها از Providerها رفرش شد')}}if(t.dataset.adminBackupCreate!==undefined){const ok=await adminAction('admin_backup_create',{});if(ok){showStatus('بکاپ روی سرور ساخته شد')}}if(t.dataset.adminBackupSendbot!==undefined){const ok=await adminAction('admin_backup_send_bot',{});if(ok){showStatus('بکاپ داخل چت بات ارسال شد')}}if(t.dataset.adminBackupDelete&&await BlueGateUI.confirm({title:'حذف بکاپ',message:'این بکاپ از سرور حذف شود؟',confirmText:'حذف',danger:true})){await adminAction('admin_backup_delete',{filename:t.dataset.adminBackupDelete})}if(t.dataset.adminBackupRestoreServer&&await BlueGateUI.confirm({title:'Restore بکاپ',message:'این فایل Restore شود؟ دیتابیس فعلی جایگزین می‌شود.',confirmText:'Restore',danger:true})){await adminAction('admin_backup_restore_server',{filename:t.dataset.adminBackupRestoreServer,confirm:'RESTORE'})}if(t.dataset.adminBackupUpload!==undefined){try{await uploadBackupRestore()}catch(e){showStatus(e.message||'Restore failed','error')}}if(t.dataset.adminLoadMoreOrders!==undefined){adminOrdersLimit+=25;renderAdmin();return}if(t.dataset.accordionToggle!==undefined){toggleVariantProduct(t.dataset.accordionToggle, t);return}if(t.dataset.accordionAddVariant!==undefined){openAddVariant(Number(t.dataset.accordionAddVariant));return}
if(t.dataset.editCoupon){const cp=(adminState.coupons||[]).find(x=>Number(x.id)===Number(t.dataset.editCoupon));if(!cp)return;openEdit(`ویرایش کد ${esc(cp.code)}`,[{title:'تنظیمات کد تخفیف',fields:[{id:'ecp_code',label:'کد',value:cp.code},{id:'ecp_type',label:'نوع',type:'select',options:`<option value="percent" ${cp.type==='percent'?'selected':''}>درصدی</option><option value="fixed" ${cp.type==='fixed'?'selected':''}>مبلغ ثابت</option>`},{id:'ecp_value',label:'مقدار',type:'number',props:'inputmode="numeric"',value:cp.value||0},{id:'ecp_max',label:'حداکثر استفاده',type:'number',props:'inputmode="numeric"',value:cp.max_uses||0},{id:'ecp_expires',label:'تاریخ انقضا',type:'datetime-local',value:cp.expires_at?String(cp.expires_at).slice(0,16):''},{id:'ecp_active',label:'فعال باشد؟',type:'checkbox',value:Number(cp.is_active)}]}],async()=>adminAction('admin_update_coupon',{coupon_id:cp.id,code:val('ecp_code'),type:val('ecp_type'),value:val('ecp_value'),max_uses:val('ecp_max'),expires_at:val('ecp_expires'),is_active:val('ecp_active')?1:0}));return}if(t.dataset.adminToggleCoupon){const cp=(adminState.coupons||[]).find(x=>Number(x.id)===Number(t.dataset.adminToggleCoupon));if(cp)adminAction('admin_update_coupon',{coupon_id:cp.id,is_active:Number(cp.is_active)?0:1});return}if(t.dataset.adminDeleteCoupon&&await BlueGateUI.confirm({title:'حذف کد تخفیف',message:'این کد تخفیف حذف شود؟',confirmText:'حذف',danger:true})){adminAction('admin_delete_coupon',{coupon_id:Number(t.dataset.adminDeleteCoupon)});return}});

document.addEventListener('input',e=>{if(e.target.id==='searchInput'){searchTerm=e.target.value;clearTimeout(searchTimeout);searchTimeout=setTimeout(renderShopSections,250)}if(e.target.id==='ai_product'){const sel=$('ai_variant'); if(sel) sel.innerHTML=variantOptions('', e.target.value)}if(e.target.dataset.colorMirror){const id=e.target.dataset.colorMirror;if($(id))$(id).value=e.target.value}if(e.target.type==='color'&&$(e.target.id+'_text'))$(e.target.id+'_text').value=e.target.value;if(e.target.id==='cmdInput'&&$('cmdPalette')?.classList.contains('open')){openCommandPalette()}})
document.addEventListener('change',e=>{if(e.target.classList?.contains('bulk-check')){const id=Number(e.target.dataset.bulkCheck);if(e.target.checked)selectedOrderIds.add(id);else selectedOrderIds.delete(id);if(selectedOrderIds.size>0&&currentAdminTab==='orders'){const bar=document.querySelector('.bulk-action-bar h3');if(bar)bar.textContent=`${nf(selectedOrderIds.size)} سفارش انتخاب شده`;else renderAdmin()}}})
document.addEventListener('keydown',e=>{if(isAdminMode&&(e.metaKey||e.ctrlKey)&&e.key==='k'&&canUseCommandPalette()){e.preventDefault();openCommandPalette()}if(e.key==='Escape'){BlueGateUI?.closeSheet?.();closeMiniCreditTopup();closeCommandPalette();$('onboarding')?.classList.remove('open');closePreviewSheet();closeQrSheet();closeCartSheet();closeCustomer360();closePalettePopup();closeShareSheet()}if($('cmdPalette')?.classList.contains('open')){const cp=$('cmdPalette');if(e.key==='Enter'){const first=cp.querySelector('[data-cmd-idx]');if(first){const idx=Number(first.dataset.cmdIdx);cp._cmds?.[idx]?.action?.();closeCommandPalette()}}if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const items=[...cp.querySelectorAll('[data-cmd-idx]')];const cur=cp.querySelector('[data-cmd-idx].selected');let i=cur?items.indexOf(cur):-1;i+=e.key==='ArrowDown'?1:-1;if(i<0)i=items.length-1;if(i>=items.length)i=0;items.forEach(el=>el.classList.remove('selected'));items[i]?.classList.add('selected');items[i]?.scrollIntoView({block:'nearest'})}}})
document.addEventListener('click',e=>{const item=e.target.closest('[data-cmd-idx]');if(item){const cp2=$('cmdPalette');const idx=Number(item.dataset.cmdIdx);cp2?._cmds?.[idx]?.action?.();closeCommandPalette();return}const inside=e.target.closest('#cmdPalette');if(!inside&&$('cmdPalette')?.classList.contains('open'))closeCommandPalette()})


/* ===== v2.9.2: shared web-parity purchase flow ===== */
let _purchaseBusy=false;
function resolveMiniPurchase(productId,variantId){
  const p=(state?.shop_products||[]).find(x=>Number(x.id)===Number(productId));
  if(!p) return null;
  const variants=(p.variants||[]).filter(v=>Number(v.is_active??1)!==0);
  const vid=Number(variantId||0);
  const v=vid?variants.find(x=>Number(x.id)===vid):null;
  if(vid && !v) return null;
  if(!vid && variants.length) return {product:p,variant:null,needsVariant:true,orderProductId:Number(p.id)};
  // Catalog plans can legitimately point at their underlying legacy product. Keep the pair consistent.
  const orderProductId=Number(v?.product_id||p.id);
  return {product:p,variant:v,needsVariant:false,orderProductId};
}
document.addEventListener('click',async function(e){
  const btn=e.target.closest('[data-buy],[data-buy-wallet]');
  if(!btn || isAdminMode) return;
  e.preventDefault();
  e.stopPropagation();
  if(_purchaseBusy) return;
  const pid=Number(btn.dataset.buy||btn.dataset.buyWallet||0);
  const vid=Number(btn.dataset.variant||0);
  const resolved=resolveMiniPurchase(pid,vid);
  if(!resolved){showStatus('محصول یا پلن انتخاب‌شده معتبر نیست. دوباره محصول را باز کن.','error');return;}
  if(resolved.needsVariant){showProduct(pid);showStatus('اول پلن موردنظرت رو انتخاب کن.');return;}
  _purchaseBusy=true;
  const oldText=btn.textContent;
  btn.disabled=true;
  btn.textContent='در حال ثبت…';
  try{
    BlueGateUI?.closeSheet?.();
    const res=await api('create_order',{product_id:resolved.orderProductId,variant_id:resolved.variant?.id||null,use_wallet:btn.dataset.buyWallet!==undefined?1:0});
    state=await api('me');
    applyTheme(state);
    currentTab='orders';
    currentOrderId=Number(res?.order?.id||res?.order_id||state.orders?.[0]?.id||0)||null;
    renderUser();
    showStatus('⚡ سفارش با موفقیت ثبت شد');
  }catch(err){
    showStatus(err.message||'خطا در ثبت سفارش','error');
  }finally{
    _purchaseBusy=false;
    if(btn?.isConnected){btn.disabled=false;btn.textContent=oldText;}
  }
},true);

/* ===== Quick-win: skeleton loading ===== */
function showSkeleton(){
  // Use an overlay so userApp's real children (brandTitle etc.) are NOT destroyed
  let sk=document.getElementById('skeletonOverlay');
  if(!sk){
    sk=document.createElement('div');
    sk.id='skeletonOverlay';
    sk.className='skeleton-overlay';
    sk.innerHTML=`<div class="skeleton-wrap">
    <div class="skeleton-hero sk"></div>
    <div class="skeleton-stats">
      <div class="sk sk-card"></div><div class="sk sk-card"></div><div class="sk sk-card"></div>
    </div>
    <div class="skeleton-row">
      <div class="sk sk-title"></div>
      <div class="skeleton-cards">
        <div class="sk sk-product"></div><div class="sk sk-product"></div><div class="sk sk-product"></div>
      </div>
    </div>
    <div class="skeleton-row">
      <div class="sk sk-title"></div>
      <div class="skeleton-cards">
        <div class="sk sk-product"></div><div class="sk sk-product"></div>
      </div>
    </div>
  </div>`;
    (document.querySelector('.app-shell')||document.body).appendChild(sk);
  }
  sk.classList.remove('hidden');
}
function hideSkeleton(){
  const sk=document.getElementById('skeletonOverlay');
  if(sk) sk.classList.add('hidden');
}

/* ===== Coupon code click delegation ===== */
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-coupon]');
  if (!btn) return;
  e.preventDefault(); e.stopPropagation();
  const orderId = Number(btn.dataset.coupon);
  if (!orderId) return;
  openDialog('🎟️ کسر از فاکتور با کد تخفیف', 'کد تخفیف خود را وارد کنید:', 'مثلاً: BLUE10', async (code) => {
    if (!code) return;
    try {
      const res = await api('apply_coupon', { order_id: orderId, code: code });
      state = await api('me');
      applyTheme(state);
      currentTab = 'orders';
      currentOrderId = orderId;
      renderUser();
      showStatus('کد تخفیف با موفقیت روی سفارش اعمال شد 🎉');
    } catch (err) {
      showStatus(err.message || 'کد تخفیف معتبر نیست', 'error');
    }
  });
});

/* ===== Quick-win: back-to-top button ===== */
function initBackToTop(){
  const btn=document.createElement('button');
  btn.id='backToTop';
  btn.className='back-to-top hidden';
  btn.setAttribute('aria-label','بازگشت به بالا');
  btn.innerHTML='↑';
  document.body.appendChild(btn);
  btn.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
  window.addEventListener('scroll',()=>{
    btn.classList.toggle('hidden',window.scrollY<300);
  },{passive:true});
}

/* ===== Quick-win: order row long-press delegation ===== */
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-order-quick-copy],[data-order-quick-support]');
  if(!b) return;
  e.preventDefault(); e.stopPropagation();
  if(b.dataset.orderQuickCopy!==undefined){ copyText('#'+b.dataset.orderQuickCopy); closeShareSheet(); return; }
  if(b.dataset.orderQuickSupport!==undefined){
    const u=state?.support_username;
    if(u){try{tg?.openTelegramLink?.('https://t.me/'+u)}catch(_){location.href='https://t.me/'+u}}
    closeShareSheet(); return;
  }
},true);

/* ===== Reorder click delegation ===== */
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-reorder-product]');
  if (!btn) return;
  e.preventDefault(); e.stopPropagation();
  const pid = btn.dataset.reorderProduct;
  currentTab = 'shop';
  renderUser();
  if (pid && Number(pid) > 0) {
    showProduct(pid);
  }
});

/* ===== Quick-win: haptic on tab & cat clicks ===== */
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-tab],[data-tab-jump],[data-cat],[data-shop-sort],[data-shop-toggle]');
  if(t) haptic('light');
},{passive:true,capture:false});

function updateAuthUI(st) {
  const btn = $('openAuthModalBtn');if (!btn) return;
  const isGuest=Boolean(st?.is_guest||st?.user?.is_guest||!st?.user);
  if(!isGuest){btn.classList.add('hidden');btn._isGuest=false;return}
  btn.classList.remove('hidden');
  btn.textContent='ورود / ثبت‌نام';btn.title='ورود / ثبت‌نام';btn._isGuest=true;
}
function openAuthModal(tab = 'login') {
  const modal = $('authModal');
  if (!modal) return;
  switchAuthTab(tab);
  if (typeof modal.showModal === 'function') {
    try { modal.showModal(); } catch (e) { modal.classList.add('open'); }
  } else {
    modal.classList.add('open');
  }
}

function closeAuthModal() {
  const modal = $('authModal');
  if (!modal) return;
  if (typeof modal.close === 'function') {
    try { modal.close(); } catch (e) { modal.classList.remove('open'); }
  } else {
    modal.classList.remove('open');
  }
}

function switchAuthTab(tabName) {
  document.querySelector('.auth-tabs')?.classList.remove('hidden');
  $('otpVerificationForm')?.classList.add('hidden');
  document.querySelectorAll('.auth-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.authTab === tabName);
  });
  $('loginForm')?.classList.toggle('hidden', tabName !== 'login');
  $('registerForm')?.classList.toggle('hidden', tabName !== 'register');
  $('telegramTab')?.classList.toggle('hidden', tabName !== 'telegram');
  
  if (tabName === 'telegram') {
    renderTelegramWidget();
  }
}

function renderTelegramWidget() {
  const container = $('tgWidgetContainer');
  if (!container || container.dataset.loaded === 'true') return;
  container.dataset.loaded = 'true';
  container.innerHTML = '';
  
  const botUsername = state?.bot_username || 'BlueGateBot';
  const script = document.createElement('script');
  script.src = 'https://telegram.org/js/telegram-widget.js?22';
  script.setAttribute('data-telegram-login', botUsername);
  script.setAttribute('data-size', 'large');
  script.setAttribute('data-radius', '12');
  script.setAttribute('data-onauth', 'onTelegramWidgetAuth(user)');
  script.setAttribute('data-request-access', 'write');
  script.async = true;
  container.appendChild(script);
}

window.onTelegramWidgetAuth = async function(user) {
  try {
    const res = await api('telegram_login', { auth_data: user });
    localStorage.removeItem('web_token');sessionStorage.removeItem('web_token_session');
    showStatus('ورود با تلگرام موفقیت‌آمیز بود! 🎉');
    closeAuthModal();
    location.reload();
  } catch (err) {
    showStatus(err.message || 'خطا در ورود با تلگرام', 'error');
  }
};

let _authHandlersInited = false;
function initAuthHandlers() {
  if (_authHandlersInited) return;
  _authHandlersInited = true;
  $('openAuthModalBtn')?.addEventListener('click', async () => {
    const btn = $('openAuthModalBtn');
    if (btn._isGuest === false) {
      if (await BlueGateUI.confirm({title:'خروج از حساب',message:'می‌خواهی از حساب کاربری خارج شوی؟',confirmText:'خروج',danger:true})) {
        try { await api('logout'); } catch(e) {}
        sessionStorage.removeItem('web_token_session');localStorage.removeItem('web_token');
        location.reload();
      }
    } else {
      openAuthModal();
    }
  });
  $('closeAuthModal')?.addEventListener('click', () => closeAuthModal());

  document.querySelectorAll('.auth-tab').forEach(btn => {
    btn.addEventListener('click', () => switchAuthTab(btn.dataset.authTab));
  });

  let pendingVerifUserId = null;

  function showOtpVerificationScreen(userId, email, message) {
    pendingVerifUserId = userId;
    openAuthModal('login');
    document.querySelector('.auth-tabs')?.classList.add('hidden');
    $('loginForm')?.classList.add('hidden');
    $('registerForm')?.classList.add('hidden');
    $('telegramTab')?.classList.add('hidden');
    
    if ($('otpEmailTarget')) $('otpEmailTarget').textContent = email || '';
    if ($('otpCodeInput')) { $('otpCodeInput').value = ''; setTimeout(() => $('otpCodeInput').focus(), 100); }
    if ($('otpError')) $('otpError').classList.add('hidden');
    
    $('otpVerificationForm')?.classList.remove('hidden');
    showStatus(message || 'کد تایید ۶ رقمی به ایمیل شما ارسال شد 📩');
  }

  $('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = $('loginUsername').value;
    const password = $('loginPassword').value;
    const errEl = $('loginError');
    if (errEl) errEl.classList.add('hidden');

    try {
      const res = await api('login', { username, password });
      localStorage.removeItem('web_token');sessionStorage.removeItem('web_token_session');
      showStatus('ورود موفقیت‌آمیز بود!');
      closeAuthModal();
      location.reload();
    } catch (err) {
      if (err.requires_email_verification || err.error === 'EMAIL_VERIFICATION_REQUIRED') {
        showOtpVerificationScreen(err.user_id, err.email, err.message);
        return;
      }
      if (errEl) {
        errEl.textContent = err.message || 'خطا در ورود';
        errEl.classList.remove('hidden');
      }
    }
  });

  $('registerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = $('regUsername').value;
    const email = $('regEmail')?.value || '';
    const first_name = $('regFirstName').value;
    const password = $('regPassword').value;
    const ref_code = $('regRefCode').value;
    const errEl = $('regError');
    if (errEl) errEl.classList.add('hidden');

    try {
      const res = await api('register', { username, email, first_name, password, ref_code });
      if (res.requires_email_verification) {
        showOtpVerificationScreen(res.user_id, res.email, res.message);
        return;
      }
      localStorage.removeItem('web_token');sessionStorage.removeItem('web_token_session');
      showStatus('حساب کاربری با موفقیت ساخته شد 🎉');
      closeAuthModal();
      location.reload();
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message || 'خطا در ثبت‌نام';
        errEl.classList.remove('hidden');
      }
    }
  });

  $('otpVerificationForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const otp = $('otpCodeInput').value;
    const errEl = $('otpError');
    if (errEl) errEl.classList.add('hidden');

    if (!pendingVerifUserId || !otp) {
      if (errEl) { errEl.textContent = 'لطفاً کد تایید را کامل وارد کنید'; errEl.classList.remove('hidden'); }
      return;
    }

    try {
      const res = await api('verify_email_otp', { user_id: pendingVerifUserId, otp });
      localStorage.removeItem('web_token');sessionStorage.removeItem('web_token_session');
      showStatus('ایمیل شما تایید شد! 🎉');
      closeAuthModal();
      location.reload();
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message || 'کد تایید نامعتبر است';
        errEl.classList.remove('hidden');
      }
    }
  });

  $('resendOtpBtn')?.addEventListener('click', async () => {
    if (!pendingVerifUserId) return;
    try {
      await api('resend_email_otp', { user_id: pendingVerifUserId });
      showStatus('کد تایید جدید ارسال شد 📩');
    } catch (err) {
      alert(err.message || 'خطا در ارسال مجدد کد');
    }
  });
}


load().catch(()=>{});
if (typeof attachPullToRefresh === 'function') attachPullToRefresh();
if (typeof attachLongPress === 'function') attachLongPress();
if (typeof initBackToTop === 'function') initBackToTop();
// BUG-6: removed duplicate 30s admin auto-reload interval — startAdminLivePolling() already handles dashboard polling

function openBroadcast() {
  if (typeof haptic === 'function') haptic('light');
  openEdit('ارسال پیام همگانی', [{
    title: 'محتوای پیام',
    fields: [
      {id: 'bc_text', label: 'متن پیام (پشتیبانی از HTML)', type: 'textarea', placeholder: 'مثلاً: سلام کاربران عزیز...'},
      {html: '<label class="full"><span>فایل ضمیمه (اختیاری)</span><input id="bc_file" type="file" accept="image/*,video/*,audio/*,.pdf,.zip,.doc,.docx"></label>'}
    ]
  }], async () => {
    const txt = val('bc_text');
    const fileInput = $('bc_file');
    const hasFile = fileInput && fileInput.files && fileInput.files.length > 0;
    
    if (!txt && !hasFile) throw new Error('متن پیام یا فایل نباید خالی باشد.');
    
    let b64 = null;
    let filename = null;
    if (hasFile) {
      const file = fileInput.files[0];
      filename = file.name;
      if (file.size > 40 * 1024 * 1024) throw new Error('حجم فایل نباید بیشتر از 40 مگابایت باشد.');
      b64 = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = e => res(e.target.result);
        reader.onerror = e => rej(new Error('خطا در خواندن فایل'));
        reader.readAsDataURL(file);
      });
    }

    showStatus('در حال ارسال و آپلود... کمی صبر کنید.', 'info');
    const res = await api('admin_broadcast', {text: txt, media_b64: b64, filename: filename});
    showStatus(res.message || 'با موفقیت ارسال شد');
    adminState = res;
    renderAdmin();
  });
}

function openPurchaseReward() {
  if (typeof haptic === 'function') haptic('light');
  openEdit('ثبت پاداش خرید', [{
    title: 'اطلاعات خرید',
    fields: [
      {id: 'pr_buyer_tid', label: 'آیدی عددی خریدار', type: 'number', placeholder: 'مثلاً 497837519'},
      {id: 'pr_base_amount', label: 'مبلغ پایه خرید (تومان)', type: 'number', placeholder: 'مثلاً 10000'}
    ]
  }], async () => adminAction('admin_purchase_reward', {
    buyer_tid: val('pr_buyer_tid'),
    base_amount: val('pr_base_amount')
  }));
}


