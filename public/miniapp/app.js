// BlueReferral miniapp — ensure no stray top-level statements break the bundle
// (prepending a safe comment helps spot versions; remove only when sure)
const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }
// Scroll safety: do not block touchmove/touchend globally.
// Telegram's WebView handles one-finger page scrolling best when touch events stay passive.
// Zoom is controlled by the viewport meta and CSS; global preventDefault breaks scrolling on some Android builds.
try { tg?.disableVerticalSwipes?.(); } catch(e) {}
const initData = tg?.initData || '';
function getUrlFlag(name){
  const search=new URLSearchParams(location.search||'');
  if(search.get(name)) return search.get(name);
  const hash=(location.hash||'').replace(/^#/,'');
  try{const hp=new URLSearchParams(hash); if(hp.get(name)) return hp.get(name);}catch(e){}
  return null;
}
const adminFlag = getUrlFlag('admin') || getUrlFlag('mode') || getUrlFlag('startapp') || tg?.initDataUnsafe?.start_param || '';
const isAdminMode = adminFlag === '1' || String(adminFlag).toLowerCase() === 'admin';
let state = null, adminState = null, currentTab = 'home', currentAdminTab = 'dashboard', settingsSubTab = 'general', walletTab = 'overview', searchTerm = '', activeCategory = 'all', pendingDialog = null, pendingEdit = null, currentOrderId = null, currentProductId = null, orderFilter = 'all', adminOrderViewMode = 'board', adminOrdersLimit = 25, lastSpinPrize = null, searchTimeout = null, shopSort = 'newest', shopFilterInStock = false, shopFilterFeatured = false, shopFilterWishlist = false, _shareUrl = '';
// Product card display mode: 'compact' (grid) or 'detailed' (list)
let productCardMode = localStorage.getItem('blue_ref_card_mode') || 'compact';

function saveAppLastState(){
  try {
    localStorage.setItem('blue_ref_last_user_tab', JSON.stringify({
      currentTab: currentTab || 'home',
      currentOrderId: currentOrderId || null,
      currentProductId: currentProductId || null,
      walletTab: walletTab || 'overview'
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
    if (savedUser.currentTab) currentTab = savedUser.currentTab;
    if (savedUser.currentOrderId) currentOrderId = savedUser.currentOrderId;
    if (savedUser.currentProductId) currentProductId = savedUser.currentProductId;
    if (savedUser.walletTab) walletTab = savedUser.walletTab;
  } catch(e) {}

  try {
    const savedAdmin = JSON.parse(localStorage.getItem('blue_ref_last_admin_tab') || '{}');
    if (savedAdmin.currentAdminTab) currentAdminTab = savedAdmin.currentAdminTab;
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

// Keyboard shortcuts: Cmd/Ctrl+K to open command palette, '/' to focus search
document.addEventListener('keydown', function(e){
  // ignore when typing in inputs or dialogs
  const tag = (document.activeElement && document.activeElement.tagName || '').toLowerCase();
  if(tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable) return;
  // Cmd/Ctrl+K
  if((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')){
    e.preventDefault();
    openCommandPalette();
    return;
  }
  // Focus search with '/'
  if(e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey){
    e.preventDefault();
    const s = document.getElementById('searchInput');
    if(s){ s.focus(); s.select(); }
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
    if(data?.error === 'AUTH_REQUIRED'){
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
function startAdminLivePolling(){if(isAdminMode&&currentAdminTab==='dashboard'){setTimeout(async()=>{if(!isAdminMode||currentAdminTab!=='dashboard')return;try{const snap=await api('admin_summary');const c=Number(snap.report?.today?.c||0);if(_adminLastTodayCount>=0&&c>_adminLastTodayCount){hapticNotify('success');playChime();const el=document.querySelector('.admin-stat-card:first-child');if(el){el.classList.add('pulse-alert');setTimeout(()=>el.classList.remove('pulse-alert'),2000)}showStatus(`🛎 سفارش جدید! (${nf(c-_adminLastTodayCount)} عدد)`)}_adminLastTodayCount=c;adminState=snap;renderAdmin()}catch(e){}},30000)}}
/* ===== Batch 2 utilities: cart, referral tree, customer 360, CSV export ===== */
let _cart=JSON.parse(localStorage.getItem('blue_ref_cart')||'[]');
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
async function cartCheckout(){if(!_cart.length)return;if(!confirm(`${nf(cartCount())} سفارش ساخته شود؟`))return;const btn=$('cartCheckoutBtn');if(btn)btn.disabled=true;let ok=0, fail=0;for(const item of _cart){try{await api('create_order',{product_id:item.pid,variant_id:item.vid||null,use_wallet:0});ok++}catch(e){fail++}}_cart=[];saveCart();closeCartSheet();if(btn)btn.disabled=false;showStatus(`✅ ${nf(ok)} سفارش ساخته شد${fail?` · ${nf(fail)} ناموفق`:''}`);state=await api('me');applyTheme(state);currentTab='orders';renderUser()}
function updateCartFab(){const fab=$('cartFab');if(!fab)return;const c=cartCount();fab.classList.toggle('hidden',c===0||isAdminMode);if(c>0&&!isAdminMode){fab.style.display='flex';}else{fab.style.display='none';}const badge=fab.querySelector('.cart-fab-badge');if(badge)badge.textContent=nf(c)}
function openCartSheet(){const s=$('cartSheet');if(!s)return;s.innerHTML=cartSheetHtml();s.classList.add('open');s.style.display='flex';haptic('light');bindCartEvents(s)}
function closeCartSheet(){const s=$('cartSheet');if(s){s.classList.remove('open');setTimeout(()=>{if(!s.classList.contains('open'))s.style.display='none';},300)}}
function bindCartEvents(s){if(!s)return;s.querySelector('#cartCloseBtn')?.addEventListener('click',closeCartSheet);s.querySelector('.cart-sheet-handle')?.addEventListener('click',closeCartSheet);s.querySelector('#cartClearBtn')?.addEventListener('click',()=>{cartClear();openCartSheet()});s.querySelector('#cartCheckoutBtn')?.addEventListener('click',cartCheckout);s.querySelectorAll('[data-cart-inc]').forEach(btn=>{btn.addEventListener('click',e=>{const idx=Number(e.currentTarget.dataset.cartInc);cartQty(idx,1);openCartSheet()})});s.querySelectorAll('[data-cart-dec]').forEach(btn=>{btn.addEventListener('click',e=>{const idx=Number(e.currentTarget.dataset.cartDec);cartQty(idx,-1);openCartSheet()})});s.querySelectorAll('[data-cart-del]').forEach(btn=>{btn.addEventListener('click',e=>{const idx=Number(e.currentTarget.dataset.cartDel);cartRemove(idx);openCartSheet()})});s.addEventListener('click',e=>{if(e.target===s)closeCartSheet()})}
function cartSheetHtml(){if(!_cart.length)return `<div class="cart-sheet-inner"><div class="cart-sheet-handle"></div><div class="cart-sheet-head"><h3>🛒 سبد خرید</h3><button class="ghost" id="cartCloseBtn">✕</button></div><p class="muted empty-state" style="padding:40px 20px;text-align:center;">سبد خرید شما خالی است. از فروشگاه محصول اضافه کنید.</p></div>`;return `<div class="cart-sheet-inner"><div class="cart-sheet-handle"></div><div class="cart-sheet-head"><h3>🛒 سبد خرید (${nf(cartCount())})</h3><button class="ghost" id="cartCloseBtn">✕</button></div><div class="cart-items">${_cart.map((it,i)=>`<div class="cart-item"><div class="cart-item-thumb">${it.img?`<img src="${esc(it.img)}" alt="">`:'<span>🛍</span>'}</div><div class="cart-item-info"><b>${esc(it.name)}</b><span class="muted" style="font-size:14px;color:var(--muted);">${fmt(it.price)} × ${nf(it.qty)}</span></div><div class="cart-item-qty"><button class="ghost" data-cart-dec="${i}">−</button><span>${nf(it.qty)}</span><button class="ghost" data-cart-inc="${i}">+</button></div><button class="ghost cart-item-del" data-cart-del="${i}">🗑</button></div>`).join('')}</div><div class="cart-sheet-foot"><div class="cart-total"><span>مجموع کل</span><b style="color:var(--cyan);font-size:17px;font-weight:900;">${fmt(cartTotal())}</b></div><div class="cart-actions"><button class="secondary" id="cartClearBtn">پاکسازی</button><button class="primary" id="cartCheckoutBtn" style="background:linear-gradient(135deg,#00f2fe,#1d9bf0);color:#000;font-weight:900;">⚡ ثبت ${nf(cartCount())} سفارش</button></div><p class="muted cart-note" style="font-size:13.5px;margin-top:6px;text-align:center;">هر آیتم یک سفارش جداگانه ثبت می‌کند.</p></div></div>`}
function renderCartSheet(){const s=$('cartSheet');if(s&&s.classList.contains('open'))openCartSheet()}
/* Referral tree */
async function loadReferralTree(){try{const r=await api('my_referrals');return r.referrals||[]}catch(e){return[]}}
function referralTreeHtml(refs){if(!refs||!refs.length)return `<article class="wallet-card referral-tree-card"><div class="referral-tree-head"><span class="admin-card-icon">🌳</span><div><h3>درخت دعوت</h3><p class="muted">هنوز کسی را دعوت نکرده‌ای.</p></div></div><p class="muted">لینک دعوت خود را بفرست و با اولین دعوت پاداش بگیر.</p></article>`;const totalEarned=refs.reduce((s,r)=>s+Number(r.reward_amount||0),0);return `<article class="wallet-card referral-tree-card"><div class="referral-tree-head"><span class="admin-card-icon">🌳</span><div><h3>درخت دعوت</h3><p class="muted">${nf(refs.length)} زیرمجموعه · ${fmt(totalEarned)} درآمد</p></div></div><div class="referral-tree-list">${refs.map(r=>`<div class="referral-node"><div class="referral-node-avatar">${esc(String(r.first_name||r.username||'?').slice(0,1).toUpperCase())}</div><div class="referral-node-info"><b>${esc(r.first_name||r.username||'کاربر')}${r.username?' @'+esc(r.username):''}</b><span class="muted">عضو: ${esc(String(r.joined_at||r.created_at||'').slice(0,10))} · ${Number(r.orders_count||0)>0?nf(r.orders_count)+' سفارش · '+fmt(r.total_spent):'بدون سفارش'}</span></div><div class="referral-node-reward">+${fmt(r.reward_amount||0)}</div></div>`).join('')}</div></article>`}
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
function openAdminActionSheet(type,id){const pv=$('previewSheet');if(!pv)return;let title='',subtitle='',buttons='';if(type==='product'){const p=(adminState.products||[]).find(x=>Number(x.id)===Number(id));if(!p)return;title=`محصول #${nf(p.id)}`;subtitle=p.name;buttons=`<button class="ios-action-btn" data-edit-product="${p.id}">ویرایش کامل</button><button class="ios-action-btn" data-admin-toggle-product="${p.id}">${Number(p.is_active)?'غیرفعال کردن':'فعال کردن'}</button><button class="ios-action-btn danger-action" data-admin-delete-product="${p.id}">غیرفعال‌سازی</button><button class="ios-action-btn danger-action" data-admin-hard-delete-product="${p.id}">حذف کامل</button>`;}else if(type==='variant'){const v=(adminState.variants||[]).find(x=>Number(x.id)===Number(id));if(!v)return;title=`پلن #${nf(v.id)}`;subtitle=`${v.product_name||''} - ${v.title}`;buttons=`<button class="ios-action-btn" data-edit-variant="${v.id}">ویرایش پلن</button><button class="ios-action-btn danger-action" data-admin-delete-variant="${v.id}">غیرفعال‌سازی</button><button class="ios-action-btn danger-action" data-admin-hard-delete-variant="${v.id}">حذف کامل</button>`;}else if(type==='category'){const c=(adminState.categories||[]).find(x=>Number(x.id)===Number(id));if(!c)return;title=`دسته #${nf(c.id)}`;subtitle=c.title;buttons=`<button class="ios-action-btn" data-edit-category="${c.id}">ویرایش</button><button class="ios-action-btn danger-action" data-admin-delete-category="${c.id}">غیرفعال‌سازی</button><button class="ios-action-btn danger-action" data-admin-hard-delete-category="${c.id}">حذف کامل</button>`;}else if(type==='order'){const o=(adminState.orders||[]).find(x=>Number(x.id)===Number(id));if(!o)return;title=`سفارش #${nf(o.id)}`;subtitle=o.display_name;buttons=`${o.user_id?`<button class="ios-action-btn" data-customer-360="${o.user_id}">👤 پروفایل کاربر</button>`:''}${o.username?`<button class="ios-action-btn" data-chat-user="${esc(o.username)}">💬 ارسال پیام</button>`:''}<button class="ios-action-btn" data-admin-order-note="${o.id}">📝 یادداشت داخلی${o.admin_note?' (دارد)':''}</button><button class="ios-action-btn" data-admin-status="${o.id}:reviewing">در بررسی</button><button class="ios-action-btn" data-admin-status="${o.id}:payment_confirmed">تایید پرداخت</button><button class="ios-action-btn" data-admin-status="${o.id}:preparing">آماده‌سازی</button><button class="ios-action-btn" data-admin-service="${o.id}">🌐 ثبت لینک سرویس${o.delivery_url?' (ثبت شده)':''}</button><button class="ios-action-btn" data-admin-deliver="${o.id}">ثبت تحویل متنی</button>${o.receipt_file_id?`<button class="ios-action-btn" data-view-receipt="${o.id}">🖼 دیدن رسید تصویری</button>`:''}<button class="ios-action-btn danger-action" data-admin-status="${o.id}:rejected">رد سفارش</button><button class="ios-action-btn danger-action" data-admin-archive-order="${o.id}">آرشیو سفارش</button>${cleanupStatuses.includes(o.status)?`<button class="ios-action-btn danger-action" data-admin-delete-order="${o.id}">حذف کامل</button>`:''}`;}pv.innerHTML=`<div class="preview-sheet-inner" style="padding-top: 10px;"><div class="preview-sheet-handle" data-close-preview></div><div style="text-align:center; margin: 12px 0 16px;"><h3 style="font-size: 16px; margin-bottom: 4px;">${title}</h3><p class="muted" style="font-size: 14.5px;">${esc(subtitle)}</p></div><div class="ios-action-group">${buttons}</div><div class="ios-action-group" style="margin-top: -10px;"><button class="ios-action-btn" style="font-weight: 800;" data-close-preview>بستن</button></div></div>`;pv.classList.add('open');pv.querySelectorAll('[data-close-preview]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();closePreviewSheet()}));pv.addEventListener('click',function(ev){if(ev.target===pv)closePreviewSheet()})}
/* VIP / loyalty progress (U8) */
function vipProgressHtml(){const u=state.user;if(!u)return '';const tier=u.customer?.tier||{};const spent=Number(u.customer?.total_spent||0);const tiers=[{name:'Bronze',fa:'برنز',emoji:'🥉',min:0},{name:'Silver',fa:'نقره',emoji:'🥈',min:1000000},{name:'Gold',fa:'طلایی',emoji:'🥇',min:5000000},{name:'Diamond',fa:'الماس',emoji:'💎',min:10000000}];let cur=0,nxt=tiers[1];for(let i=0;i<tiers.length;i++){if(spent>=tiers[i].min){cur=i;nxt=tiers[i+1]||null}}const curTier=tiers[cur];const base=curTier.min;const ceiling=nxt?nxt.min:curTier.min;const range=Math.max(1,ceiling-base);const pct=nxt?Math.min(100,Math.round((spent-base)/range*100)):100;return `<article class="wallet-card vip-card"><div class="vip-head"><span class="vip-emoji">${curTier.emoji}</span><div><h3>سطح مشتری ${curTier.fa}</h3><p class="muted">${nxt?`تا ${nxt.fa} ${nxt.emoji}: ${fmt(Math.max(0,ceiling-spent))}`:'بالاترین سطح رسیدی! 🎉'}</p></div></div><div class="vip-track"><div class="vip-fill" style="width:${pct}%"></div></div><div class="vip-tiers">${tiers.map(t=>`<span class="${t.name===curTier.name?'active':''}">${t.emoji} ${esc(t.fa)}</span>`).join('')}</div></article>`}
/* Onboarding (U10) */
function shouldShowOnboarding(){return !localStorage.getItem('blue_ref_onboarded')}
function showOnboarding(){if(!shouldShowOnboarding())return;const o=$('onboarding');if(!o)return;const slides=[{emoji:'👋',title:'به فروشگاه خوش اومدی',text:'محصولات دیجیتال، VPN و اشتراک‌ها را اینجا پیدا کن.'},{emoji:'🤝',title:'با دعوت دوستان پول دربیار',text:'لینک دعوت اختصاصی بفرست و برای هر عضو جدید پاداش بگیر.'},{emoji:'🛒',title:'خرید کن و تحویل بگیر',text:'سفارش بده، پرداخت کن و تحویل آنی یا دستی را دریافت کن.'}];let idx=0;o.innerHTML=`<div class="onb-inner"><div class="onb-slides">${slides.map((s,i)=>`<div class="onb-slide ${i===0?'active':''}" data-onb-slide="${i}"><div class="onb-emoji">${s.emoji}</div><h2>${s.title}</h2><p>${s.text}</p></div>`).join('')}</div><div class="onb-dots">${slides.map((_,i)=>`<span class="onb-dot ${i===0?'active':''}" data-onb-dot="${i}"></span>`).join('')}</div><div class="onb-actions"><button class="ghost" id="onbSkip">رد کردن</button><button class="primary" id="onbNext">بعدی</button></div></div>`;o.classList.add('open');const next=$('onbNext');next?.addEventListener('click',()=>{idx++;if(idx>=slides.length){finishOnboarding();return}updateOnbSlide(idx,slides.length)});$('onbSkip')?.addEventListener('click',finishOnboarding);o.querySelectorAll('[data-onb-dot]').forEach(d=>d.addEventListener('click',()=>{idx=Number(d.dataset.onbDot);updateOnbSlide(idx,slides.length)}))}
function updateOnbSlide(i,total){document.querySelectorAll('[data-onb-slide]').forEach(s=>s.classList.toggle('active',Number(s.dataset.onbSlide)===i));document.querySelectorAll('[data-onb-dot]').forEach(d=>d.classList.toggle('active',Number(d.dataset.onbDot)===i));$('onbNext').textContent=i>=total-1?'شروع کنیم':'بعدی'}
function finishOnboarding(){localStorage.setItem('blue_ref_onboarded','1');$('onboarding')?.classList.remove('open')}
/* Recently viewed (U12) */
function pushRecent(pid){let r=JSON.parse(localStorage.getItem('blue_ref_recent')||'[]');r=r.filter(id=>Number(id)!==Number(pid));r.unshift(Number(pid));r=r.slice(0,8);localStorage.setItem('blue_ref_recent',JSON.stringify(r))}
function recentProductsHtml(){const ids=JSON.parse(localStorage.getItem('blue_ref_recent')||'[]');if(!ids.length)return '';const prods=ids.map(id=>(state.shop_products||[]).find(p=>Number(p.id)===Number(id))).filter(Boolean);if(!prods.length)return '';return `<section class="section-row"><div class="section-title"><h2>👁 اخیراً دیده‌شده</h2></div><div class="h-scroll product-grid-wrap">${prods.map(productCard).join('')}</div></section>`}
/* QR code (U13) — real QR via api.qrserver.com */
function qrCodeImg(text,size=200){const url='https://api.qrserver.com/v1/create-qr-code/?size='+size+'x'+size+'&data='+encodeURIComponent(text)+'&margin=8&qzone=2';return `<img src="${esc(url)}" alt="QR" width="${size}" height="${size}" style="display:block;width:100%;height:100%;border-radius:8px">`}
function openQrSheet(){const u=state.user;if(!u)return;const link=u.referral_link||'';if(!link){showStatus('لینک دعوت در دسترس نیست','error');return}const qs=$('qrSheet');if(!qs)return;qs.innerHTML=`<div class="qr-sheet-inner"><div class="qr-sheet-handle" data-close-qr></div><h3>📱 کد QR لینک دعوت</h3><p class="muted">دوستت این کد را با دوربین گوشی اسکن کنه تا مستقیم وارد بات بشه.</p><div class="qr-box">${qrCodeImg(link,200)}</div><div class="qr-link-box"><code>${esc(link)}</code></div><div class="actions"><button class="secondary" id="qrCopyBtn">📋 کپی لینک</button><button class="primary" id="qrCloseBtn">بستن</button></div></div>`;qs.classList.add('open');qs.querySelectorAll('[data-close-qr]').forEach(el=>el.addEventListener('click',closeQrSheet));$('qrCopyBtn')?.addEventListener('click',()=>{navigator.clipboard?.writeText(link);showStatus('لینک کپی شد')});$('qrCloseBtn')?.addEventListener('click',closeQrSheet)}
function closeQrSheet(){const qs=$('qrSheet');if(qs){qs.classList.remove('open');qs.innerHTML=''}}
function openPromoSheet(){const u=state.user;if(!u)return;const link=u.referral_link||'';if(!link){showStatus('لینک دعوت در دسترس نیست','error');return}const brand=state.brand||'BlueGate';const txt=`💙 با ${brand} هم اینترنت آزاد داشته باش، هم از دعوت دوستات درآمد بگیر!\n\n👥 با لینک من وارد ربات شو؛ فعالیتت زیرمجموعه من حساب می‌شه.\n🎁 پاداش دعوت، اعتبار BlueGate و گردونه شانس فعال است.\n\n🔗 ${link}`;const pv=$('previewSheet');if(!pv)return;pv.innerHTML=`<div class="preview-sheet-inner" style="padding-top: 20px;"><div class="preview-sheet-handle" data-close-preview></div><div style="text-align:center; margin-bottom: 16px;"><h3 style="font-size: 18px; margin-bottom: 8px;">📣 متن آماده تبلیغ شما</h3><p class="muted" style="font-size: 14.5px;">این متن را کپی کنید و برای دوستانتان یا در گروه‌ها بفرستید</p></div><div style="background: rgba(0,0,0,0.2); padding: 12px; border-radius: 12px; margin-bottom: 16px; font-size: 14.5px; line-height: 1.6; white-space: pre-wrap; user-select: text; text-align: right; border: 1px solid rgba(255,255,255,0.05);">${esc(txt)}</div><div class="actions" style="flex-direction: column; gap: 8px;"><button class="primary" id="copyPromoBtn" style="width: 100%;">📋 کپی متن تبلیغ</button><button class="ghost" data-close-preview style="width: 100%;">بستن</button></div></div>`;pv.classList.add('open');pv.querySelectorAll('[data-close-preview]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();closePreviewSheet()}));pv.addEventListener('click',function(ev){if(ev.target===pv)closePreviewSheet()});$('copyPromoBtn')?.addEventListener('click',()=>{navigator.clipboard?.writeText(txt);showStatus('متن تبلیغ کپی شد!');closePreviewSheet()})}
/* Achievement badges (U15) */
function achievementsHtml(){const a=state.achievements||[];if(!a.length)return '';const earned=a.filter(x=>x.earned).length;return `<article class="wallet-card achievements-card"><div class="achievements-head"><span class="admin-card-icon">🏆</span><div><h3>دستاوردها</h3><p class="muted">${nf(earned)} از ${nf(a.length)} باز شده</p></div></div><div class="badges-grid">${a.map(x=>`<div class="badge-cell ${x.earned?'earned':'locked'}" title="${esc(x.title)}"><span class="badge-emoji">${x.earned?x.emoji:'🔒'}</span><small>${esc(x.title)}</small></div>`).join('')}</div></article>`}
/* Advanced order search (A2) */
let adminOrderSearch='',adminOrderStatusFilter='all',selectedOrderIds=new Set();
async function adminSearchOrdersNow(){try{const r=await api('admin_search_orders',{search:adminOrderSearch,status:adminOrderStatusFilter});adminState.orders=r.orders||[];renderAdmin()}catch(e){showStatus(e.message,'error')}}
/* Bulk actions (A3) */
async function bulkOrderAction(action){if(!selectedOrderIds.size){showStatus('حداقل یک سفارش انتخاب کن','error');return}const ids=[...selectedOrderIds];if(!confirm(`${nf(ids.length)} سفارش به «${action==='payment_confirmed'?'تایید پرداخت':action==='rejected'?'رد':action}» تغییر وضعیت دهد؟`))return;for(const id of ids){try{await api('admin_order_status',{order_id:id,status:action})}catch(e){}}selectedOrderIds.clear();await loadAdmin();showStatus(`${nf(ids.length)} سفارش تغییر کرد`)}
/* Inline edit (A4) */
function inlineEditProduct(id,field){const p=(adminState.products||[]).find(x=>Number(x.id)===Number(id));if(!p)return;const cur=p[field];const label={name:'نام',price:'قیمت',short_description:'توضیح کوتاه'}[field]||field;openDialog(`ویرایش ${label}`,`مقدار جدید برای ${esc(p.name)}:`,cur,async(txt)=>{await adminAction('admin_update_product',{product_id:id,[field]:txt})},String(cur||''))}
/* Reorder (A7) — up/down buttons */
async function reorderItem(type,id,direction){const list=type==='product'?(adminState.products||[]):(adminState.categories||[]);const ids=list.map(x=>Number(x.id));const idx=ids.indexOf(Number(id));if(idx<0)return;const swapIdx=direction==='up'?idx-1:idx+1;if(swapIdx<0||swapIdx>=ids.length)return;[ids[idx],ids[swapIdx]]=[ids[swapIdx],ids[idx]];const action=type==='product'?'admin_reorder_products':'admin_reorder_categories';try{haptic('light');await api(action,{ordered_ids:ids});showStatus('ترتیب ذخیره شد');await loadAdmin()}catch(e){showStatus(e.message,'error')}}
/* Command palette (A13) */
function openCommandPalette(){const cp=$('cmdPalette');if(!cp)return;const cmds=[{label:'داشبورد',icon:'📊',action:()=>setAdminTab('dashboard')},{label:'کاتالوگ',icon:'🧭',action:()=>setAdminTab('catalog')},{label:'سفارش‌ها',icon:'🧾',action:()=>setAdminTab('orders')},{label:'کدهای تخفیف',icon:'🎟',action:()=>setAdminTab('coupons')},{label:'انبار',icon:'📦',action:()=>setAdminTab('inventory')},{label:'تنظیمات',icon:'⚙️',action:()=>setAdminTab('settings')},{label:'بکاپ',icon:'💾',action:()=>setAdminTab('backups')},{label:'لاگ فعالیت',icon:'📜',action:()=>setAdminTab('activity')},{label:'نقش‌های ادمین',icon:'👥',action:()=>setAdminTab('roles')},{label:'دانلود CSV سفارش‌ها',icon:'📥',action:()=>exportOrdersCsv()},{label:'دانلود CSV کاتالوگ',icon:'📥',action:()=>exportProductsCsv()}];const q=(cp.querySelector('#cmdInput')?.value||'').toLowerCase();const filtered=cmds.filter(c=>c.label.toLowerCase().includes(q));cp.querySelector('#cmdList').innerHTML=filtered.length?filtered.map((c,i)=>`<button class="cmd-item" data-cmd-idx="${i}"><span>${c.icon}</span><b>${c.label}</b></button>`).join(''):'<p class="muted" style="padding:14px;text-align:center">موردی پیدا نشد.</p>';cp._cmds=filtered;cp.classList.add('open');setTimeout(()=>cp.querySelector('#cmdInput')?.focus(),50)}
function closeCommandPalette(){const cp=$('cmdPalette');if(cp)cp.classList.remove('open')}
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
function closeEdit(){const s=$('presentationSheet');if(s){s.classList.remove('open');setTimeout(()=>s.innerHTML='',300)}pendingEdit=null}
function openEdit(title,inputFields,onSubmit){pendingEdit=onSubmit;let sheet=$('presentationSheet');if(!sheet){sheet=document.createElement('div');sheet.id='presentationSheet';sheet.className='preview-sheet presentation-sheet';document.body.appendChild(sheet)}let sections=[];if(inputFields.length>0&&typeof inputFields[0]==='string'){sections=[{title:'',fields:inputFields.map(html=>({html}))}]}else{sections=inputFields}let html=`<div class="presentation-inner"><div class="presentation-header"><button class="ghost" onclick="if(typeof haptic==='function')haptic('light'); closeEdit()">لغو</button><h3>${title}</h3><button class="primary" id="presentationSaveBtn" onclick="if(typeof haptic==='function')haptic('medium')">ذخیره</button></div><div class="presentation-body">`;sections.forEach(sec=>{if(sec.title)html+=`<div class="presentation-section-title">${sec.title}</div>`;html+=`<div class="form-grid">`;sec.fields.forEach(f=>{if(f.html)html+=f.html;else if(f.type==='checkbox')html+=`<label class="switch-line"><span>${f.label}</span><input id="${f.id}" type="checkbox" onchange="if(typeof haptic==='function')haptic('light')" ${f.value?'checked':''}></label>`;else if(f.type==='select')html+=`<label><span>${f.label}</span><select id="${f.id}">${f.options}</select></label>`;else if(f.type==='textarea')html+=`<label class="full"><span>${f.label}</span><textarea id="${f.id}" placeholder="${f.placeholder||f.label}">${esc(f.value||'')}</textarea></label>`;else html+=`<label><span>${f.label}</span><input id="${f.id}" type="${f.type||'text'}" value="${esc(f.value||'')}" placeholder="${f.placeholder||f.label}" ${f.props||''}></label>`});html+=`</div>`});html+=`</div></div>`;sheet.innerHTML=html;sheet.classList.add('open');const saveBtn=sheet.querySelector('#presentationSaveBtn');saveBtn.addEventListener('click',async(e)=>{if(!pendingEdit)return;e.preventDefault();saveBtn.disabled=true;saveBtn.textContent='...';try{await pendingEdit();closeEdit()}catch(err){showStatus(err.message||'خطا','error');saveBtn.disabled=false;saveBtn.textContent='ذخیره'}})}
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
      ${(o.has_service_delivery||o.has_service_viewer) ? `<button class="primary btn-v2 mini-service-open-btn" data-service-view="${o.id}" data-service-url="${esc(o.service_url||'')}" data-service-title="${esc(o.service_title||'مدیریت سرویس')}">🌐 باز کردن سرویس</button><button class="secondary btn-v2 mini-service-copy-btn" data-service-copy-link="${o.id}" data-service-url="${esc(o.service_url||'')}">📋 کپی لینک ساب</button>` : ''}
      <button class="secondary btn-v2" data-customer-note="${o.id}">یادداشت سفارش</button>
      ${isPendingDetail ? `<button class="secondary btn-v2" data-coupon="${o.id}">کد تخفیف</button><button class="danger btn-v2" data-cancel="${o.id}">لغو</button>` : ''}
      ${o.receipt_file_id ? `<button class="secondary btn-v2" data-view-receipt="${o.id}">🖼 دیدن رسید</button>` : ''}
      ${canHideOrder(o) ? `<button class="danger btn-v2" data-hide-order="${o.id}">حذف از لیست من</button>` : ''}
    </div>
  </section>`
}
function setTab(tab){currentTab=tab;saveAppLastState();renderUser()}
function setAdminTab(tab){if(['products','categories','variants'].includes(tab))tab='catalog';currentAdminTab=tab;saveAppLastState();renderAdmin()}
function render(data){
  hideSkeleton();
  state=data;applyTheme(data);
  if($('brandTitle')) $('brandTitle').textContent=data.brand||'BlueGate';
  if($('helloText')) $('helloText').textContent=`سلام ${data.user?.first_name||data.user?.username||'رفیق'} 👋`;
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
  if(startParam && /^product_(\d+)$/i.test(startParam)){
    pid = startParam.replace(/^product_/i,'');
  }
  // 2) Web fallback: ?product=5
  if(!pid){ pid = getUrlFlag('product'); }
  if(pid && Number(pid) > 0){
    // Switch to shop tab first so back-button works, then show the product
    currentTab='shop';
    showProduct(pid);
  }
}
function hidePages(){
  ['homePage','shopPage','productPage','ordersPage','walletPage'].forEach(id=>$(id).classList.add('hidden'));
  document.querySelectorAll('.bottom-nav [data-tab], .topbar-desktop-nav [data-tab]').forEach(b=>{
    const isActive = b.dataset.tab === currentTab;
    if(isActive && !b.classList.contains('active') && typeof haptic === 'function') {
      haptic('light');
    }
    b.classList.toggle('active', isActive);
  });
  const topbar=document.querySelector('#userApp .topbar');
  if(topbar)topbar.style.display=(currentTab==='product')?'none':'flex';
}
function renderUser(){saveAppLastState();hidePages();updateCartFab();if(currentTab==='home'){ $('homePage').classList.remove('hidden'); renderHome(); }if(currentTab==='shop'){ $('shopPage').classList.remove('hidden'); renderShop(); }if(currentTab==='orders'){ $('ordersPage').classList.remove('hidden'); renderOrders(); }if(currentTab==='wallet'){ $('walletPage').classList.remove('hidden'); renderWallet(); }if(currentTab==='product'){ $('productPage').classList.remove('hidden'); showProduct(currentProductId); }}
function renderHome(){
  const u=state.user;const c=u.customer?.tier||{};const isGuest=state?.is_guest||u?.is_guest;const orders=state.orders||[];const active=orders.filter(o=>!['delivered','canceled','rejected','refunded'].includes(String(o.status||''))).length;const recent=orders.slice(0,3);const tg=!!u.telegram_connected;const completion=Math.round([!!String(u.first_name||'').trim(),!!(u.web_username||u.username),!!u.email_verified_at,tg].filter(Boolean).length/4*100);
  const guestBanner=isGuest?`<div class="guest-banner"><div class="guest-banner-text"><strong>👋 حالت میهمان</strong><span>برای ثبت سفارش و مدیریت اعتبار وارد شوید.</span></div><button class="primary" onclick="openAuthModal()">ورود / ثبت‌نام</button></div>`:'';
  $('homePage').innerHTML=`${guestBanner}<section class="account-center-mini-hero"><div class="mini-profile-main">${userProfileAvatar(u,'account-center-photo')}<div><small>BLUEGATE MEMBER</small><h2>${esc(u.first_name||u.username||'کاربر BlueGate')}</h2><p>${u.username?'@'+esc(u.username):'حساب BlueGate'} · ${tg?'تلگرام متصل ✓':'حساب وب'}</p></div><button class="account-edit-mini" id="editMiniProfile">✏️</button></div><div class="mini-profile-completion"><div><span>تکمیل حساب</span><b>${nf(completion)}٪</b></div><i><em style="width:${completion}%"></em></i></div><div class="mini-account-stats"><button data-tab-jump="wallet"><span>اعتبار</span><b data-count-anim="${u.balance}">${fmt(u.balance)}</b></button><button data-tab-jump="orders"><span>سفارش فعال</span><b>${nf(active)}</b></button><button id="miniReferralJump"><span>دعوت موفق</span><b>${nf(u.referrals_count)}</b></button></div></section><article class="account-credit-card"><div><small>اعتبار BlueGate</small><strong data-count-anim="${u.balance}">${fmt(u.balance)}</strong><p>قابل استفاده برای خرید سرویس‌ها؛ برداشت نقدی ندارد.</p></div><button class="primary" data-tab-jump="shop">خرید سرویس</button></article><div class="mini-account-grid"><article class="account-hub-card"><div class="hub-card-head"><span>📦</span><div><b>سرویس‌های من</b><small>${nf(orders.length)} سفارش</small></div><button data-tab-jump="orders">همه ←</button></div>${recent.length?recent.map(o=>`<div class="hub-order-row"><div><b>${esc(o.display_name||o.product_name||'سفارش')}</b><small>${esc(o.status_fa||o.status||'')}</small></div><span>${fmt(o.final_amount||0)}</span></div>`).join(''):'<div class="hub-empty">هنوز سرویسی نداری.</div>'}</article><article class="account-hub-card"><div class="hub-card-head"><span>✈️</span><div><b>Telegram</b><small>${tg?'اتصال حساب فعال':'ورود با تلگرام'}</small></div><i class="mini-connection ${tg?'on':''}">${tg?'متصل ✓':'وب'}</i></div><div class="hub-info-row"><span>سطح مشتری</span><b>${esc(c.emoji||'🥉')} ${esc(c.fa||'برنز')}</b></div><div class="hub-info-row"><span>عضو از</span><b>${esc(String(u.member_since||'—').slice(0,10))}</b></div></article></div><article class="account-hub-card"><div class="hub-card-head"><span>👥</span><div><b>دعوت دوستان</b><small>پاداش مستقیم به اعتبار BlueGate</small></div></div><div class="hub-ref-stats"><div><b>${nf(u.referrals_count)}</b><span>دعوت</span></div><div><b>${fmt(u.total_earned)}</b><span>پاداش</span></div></div><div class="actions"><button class="primary" id="shareInviteHome">ارسال لینک دعوت</button><button class="ghost" data-tab-jump="wallet">ماموریت‌ها</button></div></article><article class="account-hub-card account-settings-mini"><div class="hub-card-head"><span>⚙️</span><div><b>حساب و امنیت</b><small>اطلاعات شخصی و روش‌های ورود</small></div></div><div class="mini-email-summary"><div><span>ایمیل</span><b>${esc(u.email||'ثبت نشده')}</b><small class="${u.email_verified_at?'verified':''}">${u.email_verified_at?'تایید شده ✓':u.email?'نیاز به تایید':'هنوز ثبت نشده'}</small></div><button id="miniChangeEmailBtn">${u.email?'تغییر':'افزودن'}</button></div><div class="mini-settings-actions"><button id="editMiniProfile2">👤 ویرایش اطلاعات</button>${u.has_password?'<button id="changeMiniPassword">🔐 تغییر رمز</button>':''}<button id="paletteQuick">🎨 رنگ برنامه</button><button id="miniSupportBtn">💬 پشتیبانی</button></div></article>`;triggerBalanceAnims()
}
function openMiniProfileEditor(){const u=state.user||{};openEdit('ویرایش اطلاعات حساب',[{title:'مشخصات',fields:[{id:'mp_first',label:'نام نمایشی',value:u.first_name||''},{id:'mp_last',label:'نام خانوادگی',value:u.last_name||''},{id:'mp_phone',label:'شماره تماس',value:u.phone_number||'',props:'inputmode="tel"'},{html:`<div class="mini-secure-email-note full"><div><span>ایمیل حساب</span><b>${esc(u.email||'ثبت نشده')}</b><small>${u.email_verified_at?'تایید شده ✓':'تغییر ایمیل از مسیر امن جداگانه انجام می‌شود.'}</small></div><button type="button" id="miniChangeEmailInlineBtn">${u.email?'تغییر ایمیل':'افزودن ایمیل'}</button></div>`}]}],async()=>{state=await api('update_my_profile',{first_name:val('mp_first'),last_name:val('mp_last'),phone_number:val('mp_phone')});applyTheme(state);renderUser();showStatus('اطلاعات حساب ذخیره شد')})}
function miniEmailSheet(title,subtitle,body){pendingEdit=null;let sheet=$('presentationSheet');if(!sheet){sheet=document.createElement('div');sheet.id='presentationSheet';sheet.className='preview-sheet presentation-sheet';document.body.appendChild(sheet)}sheet.innerHTML=`<div class="presentation-inner mini-email-flow"><div class="presentation-header"><button class="ghost" id="miniEmailClose">لغو</button><div><h3>${esc(title)}</h3><small>${esc(subtitle||'')}</small></div><span class="mini-email-lock">🔐</span></div><div class="presentation-body">${body}</div></div>`;sheet.classList.add('open');sheet.querySelector('#miniEmailClose')?.addEventListener('click',closeEdit);return sheet}
async function openMiniEmailChangeFlow(){try{const r=await api('email_change_start');if(r.step==='new_email')renderMiniNewEmailStep();else renderMiniOldEmailOtpStep(r)}catch(e){showStatus(e.message||'ارسال کد ممکن نشد','error')}}
function renderMiniOldEmailOtpStep(r){const sheet=miniEmailSheet('تغییر ایمیل','مرحله ۱ از ۲ · تایید ایمیل فعلی',`<div class="mini-email-flow-note"><b>کد به ${esc(r.masked_email||'ایمیل فعلی')} ارسال شد</b><p>اول مالکیت ایمیل فعلی را تایید کن.</p></div><label class="mini-email-otp"><span>کد ۶ رقمی</span><input id="miniOldEmailOtp" maxlength="6" inputmode="numeric" autocomplete="one-time-code" placeholder="••••••"></label><button class="primary wide" id="miniVerifyOldEmail">تایید و ادامه</button><button class="ghost wide" id="miniResendOldEmail">ارسال مجدد</button>`);sheet.querySelector('#miniVerifyOldEmail')?.addEventListener('click',async()=>{try{await api('email_change_verify_current',{otp:sheet.querySelector('#miniOldEmailOtp')?.value.trim()||''});renderMiniNewEmailStep();showStatus('ایمیل فعلی تایید شد','success')}catch(e){showStatus(e.message,'error')}});sheet.querySelector('#miniResendOldEmail')?.addEventListener('click',async()=>{try{const x=await api('email_change_resend_current');renderMiniOldEmailOtpStep(x);showStatus('کد جدید ارسال شد','success')}catch(e){showStatus(e.message,'error')}});setTimeout(()=>sheet.querySelector('#miniOldEmailOtp')?.focus(),120)}
function renderMiniNewEmailStep(){const u=state.user||{};const sheet=miniEmailSheet(u.email?'ایمیل جدید':'افزودن ایمیل',u.email?'مرحله ۲ از ۲ · ایمیل جدید':'تایید ایمیل جدید',`<div class="mini-email-flow-note ok"><b>${u.email?'ایمیل فعلی تایید شد ✓':'ایمیل جدید را وارد کن'}</b><p>${u.email?'حالا ایمیل جدید را وارد کن؛ یک OTP دوم به آن ارسال می‌شود.':'برای ثبت نهایی، یک کد تایید به این ایمیل ارسال می‌شود.'}</p></div><label><span>ایمیل جدید</span><input id="miniNewEmail" type="email" autocomplete="email" placeholder="name@example.com"></label><button class="primary wide" id="miniSendNewEmailOtp">ارسال کد</button>`);sheet.querySelector('#miniSendNewEmailOtp')?.addEventListener('click',async()=>{try{const r=await api('email_change_set_new',{email:sheet.querySelector('#miniNewEmail')?.value.trim()||''});renderMiniNewEmailOtpStep(r);showStatus('کد به ایمیل جدید ارسال شد','success')}catch(e){showStatus(e.message,'error')}});setTimeout(()=>sheet.querySelector('#miniNewEmail')?.focus(),120)}
function renderMiniNewEmailOtpStep(r){const sheet=miniEmailSheet('تایید ایمیل جدید','آخرین مرحله',`<div class="mini-email-flow-note ok"><b>کد به ${esc(r.masked_email||'ایمیل جدید')} ارسال شد</b><p>تا قبل از تایید این کد، ایمیل قبلی حساب تغییر نمی‌کند.</p></div><label class="mini-email-otp"><span>کد ۶ رقمی</span><input id="miniNewEmailOtp" maxlength="6" inputmode="numeric" autocomplete="one-time-code" placeholder="••••••"></label><button class="primary wide" id="miniVerifyNewEmail">تایید و ثبت ایمیل</button><button class="ghost wide" id="miniResendNewEmail">ارسال مجدد</button>`);sheet.querySelector('#miniVerifyNewEmail')?.addEventListener('click',async()=>{try{state=await api('email_change_verify_new',{otp:sheet.querySelector('#miniNewEmailOtp')?.value.trim()||''});applyTheme(state);closeEdit();renderUser();showStatus('ایمیل جدید ثبت شد ✓','success')}catch(e){showStatus(e.message,'error')}});sheet.querySelector('#miniResendNewEmail')?.addEventListener('click',async()=>{try{const x=await api('email_change_resend_new');renderMiniNewEmailOtpStep(x);showStatus('کد جدید ارسال شد','success')}catch(e){showStatus(e.message,'error')}});setTimeout(()=>sheet.querySelector('#miniNewEmailOtp')?.focus(),120)}

function openMiniPasswordEditor(){if(!state.user?.has_password){showStatus('این حساب با تلگرام وارد می‌شود و رمز وب ندارد','error');return}openEdit('تغییر رمز عبور',[{title:'امنیت حساب',fields:[{id:'mp_current',label:'رمز فعلی',type:'password'},{id:'mp_new',label:'رمز جدید (حداقل ۸ کاراکتر)',type:'password'}]}],async()=>{state=await api('change_my_password',{current_password:val('mp_current'),new_password:val('mp_new')});renderUser();showStatus('رمز عبور تغییر کرد')})}
function openPalettePopup(){const colors=['#1d9bf0','#8b5cf6','#22c55e','#ef4444','#f97316','#ec4899','#06b6d4','#f59e0b','#14b8a6','#64748b'];const p=$('palettePopup');if(!p)return;p.innerHTML=`<div class="palette-popup-backdrop" data-close-palette></div><div class="palette-popup-inner"><button class="palette-popup-close" data-close-palette>✕</button><h3>🎨 رنگ دلخواه Mini App</h3><p class="muted">یکی از رنگ‌ها را بزن یا رنگ اختصاصی خودت را انتخاب کن. این رنگ فقط روی همین دستگاه ذخیره می‌شود.</p><div class="palette">${colors.map(c=>`<button class="swatch" data-color="${c}" style="background:${c}"></button>`).join('')}<label class="custom-color"><span>رنگ دلخواه</span><input id="userCustomColor" type="color" value="${esc(localStorage.getItem('blue_ref_color')||state?.theme_color||'#1d9bf0')}"></label><button class="secondary wide" id="applyCustomColor">اعمال رنگ</button><button class="ghost wide" id="resetColor">پیش‌فرض</button></div></div>`;p.classList.add('open');p.querySelectorAll('[data-close-palette]').forEach(el=>el.addEventListener('click',closePalettePopup))}
function closePalettePopup(){const p=$('palettePopup');if(p){p.classList.remove('open');p.innerHTML=''}}
function missionCard(m){const today=Number(state.user?.today_referrals||0);const target=Math.max(1,Number(m.target||1));const pct=Math.max(0,Math.min(100,Math.round(today/target*100)));const done=m.claimed?'claimed':(m.done?'done':'todo');return `<article class="mission-card ${done}"><div class="mission-top"><div><small>${nf(Math.min(today,target))} از ${nf(target)}</small><h3>${nf(target)} دعوت امروز</h3><p class="muted">پاداش: <b>${fmt(m.reward)}</b></p></div><div class="mission-icon">${m.claimed?'✅':(m.done?'🎁':'✌️')}</div></div><div class="progress-track"><span style="width:${pct}%"></span></div><div class="mission-foot"><span>${pct}% تکمیل شده</span><b>${m.claimed?'دریافت شد':(m.done?'آماده دریافت':'در حال انجام')}</b></div></article>`}
function getWishlist(){try{return JSON.parse(localStorage.getItem('blue_ref_wishlist')||'[]').map(Number)}catch(e){return []}}
function toggleWishlist(pid){let w=getWishlist();pid=Number(pid);if(w.includes(pid))w=w.filter(id=>id!==pid);else{w.push(pid);haptic('success');}localStorage.setItem('blue_ref_wishlist',JSON.stringify(w));document.querySelectorAll(`[data-wishlist-pid="${pid}"]`).forEach(el=>{el.textContent=w.includes(pid)?'❤️':'🤍';el.classList.toggle('active',w.includes(pid))});if(shopFilterWishlist)renderShopSections();}
function filteredProducts(){let list=(state.shop_products||[]).filter(p=>(activeCategory==='all'||Number(p.category_id)===Number(activeCategory)||(activeCategory==='featured'&&Number(p.is_featured)===1))&&(!searchTerm||`${p.name} ${p.short_description} ${p.full_description}`.toLowerCase().includes(searchTerm.toLowerCase())));if(shopFilterInStock)list=list.filter(p=>Number(p.inventory_available||0)>0);if(shopFilterFeatured)list=list.filter(p=>Number(p.is_featured)===1);if(shopFilterWishlist){const w=getWishlist();list=list.filter(p=>w.includes(Number(p.id)));}if(shopSort==='price_low')list=[...list].sort((a,b)=>Number(a.price||0)-Number(b.price||0));else if(shopSort==='price_high')list=[...list].sort((a,b)=>Number(b.price||0)-Number(a.price||0));else if(shopSort==='newest')list=[...list].sort((a,b)=>Number(b.id)-Number(a.id));return list}
function specialDiscountsBannerHtml(){
  const allProds = state.shop_products || [];
  const specialProducts = allProds.filter(p => {
    const hasVarDiscount = (p.variants || []).some(v => Number(v.discount_percent) > 0);
    return hasVarDiscount || Number(p.discount_percent || 0) > 0;
  });
  if (!specialProducts.length) return '';

  return `<section class="glowing-flash-sale-section">
    <div class="flash-sale-header">
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="glowing-fire-icon">⚡</span>
        <h3 class="flash-sale-title">تخفیف‌های ویژه</h3>
      </div>
    </div>
    <div class="glowing-flash-products-row">
      ${specialProducts.slice(0, 8).map(p => {
        let realPrice = Number(p.price);
        let crossedPrice = 0;
        let discLabel = '';
        let targetVTitle = '';

        const discountedVariants = (p.variants || []).filter(v => Number(v.discount_percent) > 0);
        if (discountedVariants.length > 0) {
          const bestV = discountedVariants.sort((a, b) => Number(b.discount_percent) - Number(a.discount_percent))[0];
          realPrice = Number(bestV.price);
          crossedPrice = Number(bestV.old_price) || (bestV.discount_percent > 0 ? Math.round(realPrice / (1 - Number(bestV.discount_percent) / 100)) : 0);
          if (crossedPrice <= realPrice) crossedPrice = 0;
          targetVTitle = bestV.title || '';
          discLabel = `<span class="disc-val">${bestV.discount_percent}%-</span> <span class="disc-fire">🔥</span>`;
        } else if (Number(p.discount_percent || 0) > 0) {
          const d = Number(p.discount_percent);
          crossedPrice = (p.old_price && Number(p.old_price) > realPrice) ? Number(p.old_price) : Math.round(realPrice / (1 - d / 100));
          discLabel = `<span class="disc-val">${d}%-</span> <span class="disc-fire">🔥</span>`;
        }

        const w = getWishlist();
        const wishBtn = `<button class="wishlist-fab ${w.includes(Number(p.id))?'active':''}" data-wishlist-pid="${p.id}" aria-label="نشان‌کردن">${w.includes(Number(p.id))?'❤️':'🤍'}</button>`;
        const discBadge = discLabel ? `<span class="discount-badge" style="z-index:3;">${discLabel}</span>` : '';

        return `<div class="glowing-flash-card" data-product-preview="${p.id}">
          <div class="tile-img" style="position:relative; margin-bottom:10px;">
            ${cardImage(p,'🛍')}
            ${discBadge}
            ${wishBtn}
          </div>
          <div class="flash-card-title">${esc(p.name)}${targetVTitle ? `<small class="flash-card-vname">${esc(targetVTitle)}</small>` : ''}</div>
          <div class="flash-card-bottom">
            <div class="flash-card-price-col">
              ${crossedPrice > 0 ? `<s class="flash-card-orig-price">${fmt(crossedPrice)}</s>` : ''}
              <b class="flash-card-cur-price">${fmt(realPrice)}</b>
            </div>
            <button class="primary" data-buy="${p.id}" style="padding:6px 12px; font-size:14px; border-radius:12px;">⚡ خرید</button>
          </div>
        </div>`;
      }).join('')}
    </div>
  </section>`;
}
function shopSectionsHtml(){const cats=state.shop_categories||[];const products=filteredProducts();const filtersActive=shopFilterInStock||shopFilterFeatured||shopFilterWishlist||shopSort!=='newest';let sections='';if(activeCategory==='all'&&!searchTerm&&!filtersActive){const spec=specialDiscountsBannerHtml();if(spec)sections+=spec;const recent=recentProductsHtml();if(recent)sections+=recent;const featured=(state.shop_products||[]).filter(p=>Number(p.is_featured)===1);if(featured.length)sections+=sectionHtml('⭐ محصولات ویژه',featured);for(const c of cats){const list=(state.shop_products||[]).filter(p=>Number(p.category_id)===Number(c.id));if(list.length)sections+=sectionHtml(`${esc(c.emoji||'🛒')} ${esc(c.title)}`,list)} }else sections=gridHtml(products);return sections||'<div class="empty-state rich-empty-state" style="padding:40px 20px;text-align:center"><div class="empty-icon" style="font-size:48px;margin-bottom:12px;opacity:0.8">🕵️‍♂️</div><h3>محصولی پیدا نشد!</h3><p class="muted" style="margin-bottom:20px;font-size:14px">با این فیلترها و جستجو چیزی پیدا نکردیم.</p><button class="secondary" data-clear-filters>حذف تمام فیلترها</button></div>'}
function renderShop(){const cats=state.shop_categories||[];const brand=state.brand||'BlueGate';$('shopPage').innerHTML=`<section class="shop-hero"><div><small>${esc(brand)}</small><h2>محصولاتو راحت پیدا کن</h2></div><span>🛍</span></section><div class="shop-header-sticky"><div class="searchbar-modern"><span class="search-icon">🔍</span><input id="searchInput" autocomplete="off" inputmode="search" placeholder="جستجوی محصول، اشتراک..." value="${esc(searchTerm)}"><div class="quick-toggles"><button class="icon-toggle ${shopFilterWishlist?'active':''}" data-shop-toggle="wishlist" title="نشان‌شده">${shopFilterWishlist?'❤️':'🤍'}</button><button class="icon-toggle ${shopFilterInStock?'active':''}" data-shop-toggle="instock" title="فقط آنی">${shopFilterInStock?'⚡':'📦'}</button></div></div><div class="shop-controls-row"><div class="segmented-control"><button class="${shopSort==='newest'?'active':''}" data-shop-sort="newest">جدیدترین</button><button class="${shopSort==='price_low'?'active':''}" data-shop-sort="price_low">ارزان‌ترین</button><button class="${shopSort==='price_high'?'active':''}" data-shop-sort="price_high">گران‌ترین</button></div></div><div class="category-strip modern-cats"><button class="cat-pill ${activeCategory==='all'?'active':''}" data-cat="all"><span>✨</span><b>همه</b></button><button class="cat-pill ${activeCategory==='featured'?'active':''}" data-cat="featured"><span>⭐</span><b>ویژه</b></button>${cats.map(c=>`<button class="cat-pill ${Number(activeCategory)===Number(c.id)?'active':''}" data-cat="${c.id}">${c.image_url?`<img src="${esc(c.image_url)}">`:`<span>${esc(c.emoji||'🛒')}</span>`}<b>${esc(c.title)}</b></button>`).join('')}</div></div><div id="shopSections">${shopSectionsHtml()}</div>`}
function renderShopSections(){const box=$('shopSections'); if(box) box.innerHTML=shopSectionsHtml();}
function sectionHtml(title,products){return `<details class="section-row section-collapsible" open><summary class="section-title"><h2>${title}</h2><span class="section-chevron">‹</span></summary><div class="h-scroll product-grid-wrap">${products.map(productCard).join('')}</div></details>`}
function gridHtml(products){return products.length ? `<section class="section-row"><div class="h-scroll product-grid-wrap">${products.map(productCard).join('')}</div></section>` : ''}
function productCard(p){
  const maxDiscount = (p.variants||[]).reduce((max, v)=>Math.max(max, Number(v.discount_percent||0)), Number(p.discount_percent||0));
  const hasDiscount = maxDiscount > 0;
  const noVariants = (!p.variants || p.variants.length === 0);
  const w = getWishlist();
  const wishBtn = `<button class="wishlist-fab ${w.includes(Number(p.id))?'active':''}" data-wishlist-pid="${p.id}" aria-label="نشان‌کردن">${w.includes(Number(p.id))?'❤️':'🤍'}</button>`;
  const badgeHtml = hasDiscount ? `<span class="discount-badge"><span class="disc-val">${maxDiscount}%-</span> <span class="disc-fire">🔥</span></span>` : '';
  
  if(productCardMode==='detailed'){
    return `<article class="product-tile detailed ${hasDiscount?'discount-tile':''}" data-product-preview="${p.id}">`+
      `<div class="tile-img">${cardImage(p,'🛍')}${badgeHtml}${wishBtn}</div>`+
      `<div class="tile-body"><h3>${esc(p.name)}</h3>`+
      (p.short_description?`<p class="tile-desc">${esc(p.short_description)}</p>`:'')+
      `<div class="price-row-mini"><span class="price-pill">${priceLabel(p)}</span>${Number(p.inventory_available||0)>0?'<span class="soon">آنی</span>':''}</div></div></article>`;
  }
  return `<article class="product-tile compact-tile ${hasDiscount?'discount-tile':''}" data-product-preview="${p.id}"><div class="tile-img" style="position:relative">${cardImage(p,'🛍')}<div class="overlay-price" style="position:absolute;bottom:8px;left:8px;display:flex;gap:4px;z-index:2;max-width:calc(100% - 16px)"><span class="compact-price">${priceLabel(p)}</span></div>${badgeHtml}${wishBtn}</div><div class="tile-body" style="padding:10px;padding-bottom:12px"><h3>${esc(p.name)}</h3></div></article>`;
}
function buyButtonsForProduct(p){
  const bal=Number(state.user?.balance||0);
  const walletHint=bal>0?`<div class="wallet-hint">💰 موجودی شما: <b>${fmt(bal)}</b>؛ می‌تونی ازش برای کم‌کردن فاکتور استفاده کنی.</div>`:'';
  if((p.variants||[]).length){
    return `${walletHint}<div class="variant-list" style="display:flex;flex-direction:column;gap:8px">${(p.variants||[]).map(v=>{
      const d=Number(v.discount_percent)||0;
      const priceText = fmt(v.price);
      let priceHtml = `<span style="font-weight:900;color:#ffffff;">${priceText}</span>`;
      if(d > 0){
        const orig = (v.old_price && Number(v.old_price) > Number(v.price)) ? Number(v.old_price) : Math.round(Number(v.price) / (1 - d / 100));
        const savings = orig - Number(v.price);
        priceHtml = `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;"><s class="muted-strike" style="font-size:14px;text-decoration:line-through;color:#9fb0c8;">${fmt(orig)}</s><span style="font-weight:900;color:#ffffff;">${priceText}</span><span class="discount-badge">−${nf(d)}٪</span>${savings>0?`<small class="savings-tag" style="color:#4ade80;font-weight:800;font-size:13.5px;">(سود: ${fmt(savings)})</small>`:''}</div>`;
      }
      return `<div class="variant-card"><div class="variant-info" data-variant-details="${p.id}:${v.id}" style="cursor:pointer;"><div style="display:flex;align-items:center;gap:6px;"><b style="color:#ffffff;">${esc(v.title)}</b><span class="v-info-icon" style="font-size:14.5px;opacity:0.8;" title="مشاهده جزئیات پلن">ℹ️</span></div>${priceHtml}</div><div class="variant-card-actions"><button class="ghost" data-variant-details="${p.id}:${v.id}" title="مشاهده جزئیات پلن">ℹ️</button><button class="ghost" data-cart-add="${p.id}" data-cart-variant="${v.id}">🛒</button><button class="primary" data-buy="${p.id}" data-variant="${v.id}">خرید</button>${bal>0?`<button class="secondary" data-buy-wallet="${p.id}" data-variant="${v.id}">کیف</button>`:''}</div></div>`;
    }).join('')}</div>`;
  }
  return `${walletHint}<div class="actions variant-list"><button class="ghost" data-cart-add="${p.id}">🛒 افزودن به سبد</button><button class="primary pulse" data-buy="${p.id}">ثبت سفارش</button>${bal>0?`<button class="secondary" data-buy-wallet="${p.id}">خرید با اعتبار BlueGate</button>`:''}</div>`;
}

function addToCart(productId, variantId){
  productId = Number(productId); variantId = Number(variantId);
  const p = (state?.shop_products || []).find(x => Number(x.id) === productId);
  const v = (p?.variants || []).find(x => Number(x.id) === variantId);
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem('blue_user_cart') || '[]'); } catch(_) { cart = []; }
  cart.push({ product_id: Number(v?.product_id||productId), variant_id: variantId, added_at: Date.now() });
  localStorage.setItem('blue_user_cart', JSON.stringify(cart));
  const name = v ? `${p?.name || ''} - ${v.title}` : (p?.name || 'محصول');
  showStatus(`🛒 «${name}» با موفقیت به سبد خرید اضافه شد`);
  closeVariantDetails();
}

function openVariantDetails(pid, vid){
  pid = Number(pid); vid = Number(vid);
  const p = (state?.shop_products || []).find(x => Number(x.id) === pid);
  if(!p) return;
  const v = (p.variants || []).find(x => Number(x.id) === vid);
  if(!v) return;

  const d = Number(v.discount_percent || 0);
  const origPrice = (v.old_price && Number(v.old_price) > Number(v.price)) ? Number(v.old_price) : (d > 0 ? Math.round(Number(v.price) / (1 - d / 100)) : Number(v.price));
  
  const descText = (v.description && String(v.description).trim()) || p.short_description || p.full_description || '';
  const deliveryTypeFa = { manual: 'دستی', account: 'اکانت اختصاصی', vpn: 'مولتی لوکیشن • سرعت عالی', code: 'کد دیجیتال', file: 'فایل / متن آماده' }[p.delivery_type] || p.delivery_type_fa || 'تحویل آنی';
  const brandName = state?.brand || 'BlueGate';

  let sheet = $('variantDetailSheet');
  if(!sheet){
    sheet = document.createElement('div');
    sheet.id = 'variantDetailSheet';
    document.body.appendChild(sheet);
  }

  sheet.style.cssText = 'position:fixed; inset:0; z-index:99999; display:flex; align-items:center; justify-content:center; background:rgba(2, 6, 15, 0.85); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); padding:16px; direction:rtl; opacity:0; transition:opacity 0.25s ease;';

  sheet.innerHTML = `
    <div style="width:100%; max-width:440px; max-height:88vh; background:linear-gradient(180deg, #0d1728 0%, #070d18 100%); border:1px solid rgba(0, 242, 254, 0.3); border-radius:26px; padding:20px; display:flex; flex-direction:column; gap:14px; box-shadow:0 24px 60px rgba(0, 0, 0, 0.9), 0 0 35px rgba(0, 242, 254, 0.15); overflow-y:auto; -webkit-overflow-scrolling:touch; margin:auto; box-sizing:border-box;">
      
      <!-- Top Header -->
      <div style="display:flex; align-items:center; justify-content:space-between; padding-bottom:12px; border-bottom:1px solid rgba(255, 255, 255, 0.08);">
        <button onclick="closeVariantDetails()" style="width:36px; height:36px; border-radius:50%; background:rgba(255, 255, 255, 0.08); border:1px solid rgba(255, 255, 255, 0.15); color:#94a3b8; font-size:16px; display:flex; align-items:center; justify-content:center; cursor:pointer;" title="بستن">✕</button>
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="text-align:right;">
            <h3 style="font-size:16px; font-weight:800; color:#ffffff; margin:0;">فاکتور رسمی خرید ${esc(brandName)}</h3>
            <p style="font-size:14px; color:#00f2fe; margin:2px 0 0 0; font-weight:700;">کد پیگیری: <b>#BG-${p.id}${v.id}</b></p>
          </div>
          <div style="width:48px; height:48px; min-width:48px; min-height:48px; border-radius:50%; background:rgba(0, 242, 254, 0.1); border:2px solid #00f2fe; box-shadow:0 0 14px rgba(0, 242, 254, 0.35); display:flex; align-items:center; justify-content:center; overflow:hidden; font-size:22px; flex-shrink:0;">
            ${p.image_url ? `<img src="${esc(p.image_url)}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" alt="">` : '<span>⚡</span>'}
          </div>
        </div>
      </div>

      <!-- Specs List -->
      <div style="display:flex; flex-direction:column; gap:10px; padding:4px 0;">
        <div style="display:flex; align-items:center; justify-content:space-between; font-size:14.5px;">
          <span style="color:#94a3b8; font-weight:600; display:flex; align-items:center; gap:6px;"><span>📚</span> <span>سرویس انتخابی:</span></span>
          <span style="color:#00f2fe; font-weight:800;">${esc(p.name)}</span>
        </div>
        <div style="display:flex; align-items:center; justify-content:space-between; font-size:14.5px;">
          <span style="color:#94a3b8; font-weight:600; display:flex; align-items:center; gap:6px;"><span>📐</span> <span>نام پلن:</span></span>
          <span style="color:#ffffff; font-weight:800;">${esc(v.title)}</span>
        </div>
        <div style="display:flex; align-items:center; justify-content:space-between; font-size:14.5px;">
          <span style="color:#94a3b8; font-weight:600; display:flex; align-items:center; gap:6px;"><span>⚡</span> <span>نوع / خصوصیت:</span></span>
          <span style="color:#f1f5f9; font-weight:700;">${esc(deliveryTypeFa)}</span>
        </div>
        <div style="display:flex; align-items:center; justify-content:space-between; font-size:14.5px;">
          <span style="color:#94a3b8; font-weight:600; display:flex; align-items:center; gap:6px;"><span>📅</span> <span>مدت اعتبار:</span></span>
          <span style="color:#4ade80; font-weight:800;">${v.duration_days > 0 ? `${nf(v.duration_days)} روز` : 'دائمی / بدون انقضا'}</span>
        </div>
      </div>

      <!-- Custom Variant Description Box -->
      ${descText ? `
        <div style="background:rgba(255, 255, 255, 0.03); border:1px solid rgba(255, 255, 255, 0.08); border-radius:14px; padding:12px; max-height:140px; overflow-y:auto;">
          <div style="font-size:14px; font-weight:800; color:#00f2fe; margin-bottom:6px;">📝 توضیحات اختصاصی پلن:</div>
          <div style="font-size:14px; line-height:1.65; color:#cbd5e1; word-break:break-word;">${textBlock(descText)}</div>
        </div>
      ` : ''}

      <!-- Dashed Payable Price Card -->
      <div style="display:flex; align-items:center; justify-content:space-between; padding:14px 16px; background:rgba(0, 242, 254, 0.04); border:1.5px dashed rgba(0, 242, 254, 0.4); border-radius:16px;">
        <span style="font-size:14.5px; font-weight:700; color:#cbd5e1;">مبلغ کل قابل پرداخت:</span>
        <div style="display:flex; align-items:center; gap:6px;">
          ${d > 0 ? `<s style="font-size:14px; color:#94a3b8; margin-left:6px; text-decoration:line-through;">${fmt(origPrice)}</s>` : ''}
          <b style="font-size:20px; font-weight:900; color:#facc15;">${fmt(v.price)}</b>
        </div>
      </div>

      <!-- Guarantee Banner -->
      <div style="background:rgba(34, 197, 94, 0.08); border:1px solid rgba(34, 197, 94, 0.25); color:#4ade80; font-size:14px; font-weight:700; border-radius:12px; padding:10px 14px; text-align:center; display:flex; align-items:center; justify-content:center; gap:6px;">
        🛡️ شامل ۷ روز ضمانت بازگشت ۱۰۰٪ وجه در صورت عدم رضایت
      </div>

      <!-- Action Buttons -->
      <div style="display:flex; flex-direction:column; gap:8px; padding-top:4px;">
        <button data-buy="${p.id}" data-variant="${v.id}" onclick="closeVariantDetails()" style="width:100%; padding:14px; background:linear-gradient(135deg, #00f2fe, #1d9bf0); border:none; border-radius:14px; color:#000000; font-weight:900; font-size:14px; cursor:pointer; box-shadow:0 4px 18px rgba(0, 242, 254, 0.4);">
          ⚡ تایید و ثبت سفارش (${fmt(v.price)})
        </button>
        <button onclick="addToCart(${p.id}, ${v.id})" style="width:100%; padding:13px; background:rgba(255, 255, 255, 0.06); border:1px solid rgba(255, 255, 255, 0.12); border-radius:14px; color:#ffffff; font-weight:800; font-size:15px; cursor:pointer;">
          🛒 افزودن به سبد خرید
        </button>
      </div>

    </div>
  `;

  sheet.style.display = 'flex';
  setTimeout(() => { sheet.style.opacity = '1'; }, 10);
  sheet.onclick = (e) => { if(e.target === sheet) closeVariantDetails(); };
  if(typeof haptic === 'function') haptic('light');
}

function closeVariantDetails(){
  const s = $('variantDetailSheet');
  if(s){
    s.style.opacity = '0';
    setTimeout(() => { s.style.display = 'none'; }, 250);
  }
}

/* ===== Share sheet ===== */
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




window.applyProductColor = function(imgEl) {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 64; canvas.height = 64;
    ctx.drawImage(imgEl, 0, 0, 64, 64);
    const data = ctx.getImageData(0, 0, 64, 64).data;
    let r=0, g=0, b=0, c=0;
    for(let i=0; i<data.length; i+=16) {
      if(data[i+3]>128) { r+=data[i]; g+=data[i+1]; b+=data[i+2]; c++; }
    }
    if(c>0) {
      r=Math.floor(r/c); g=Math.floor(g/c); b=Math.floor(b/c);
      const max=Math.max(r,g,b);
      r=Math.floor(r+(max-r)*0.4); g=Math.floor(g+(max-g)*0.4); b=Math.floor(b+(max-b)*0.4);
      const bg = document.getElementById('productPageBg');
      if(bg) bg.style.background = `radial-gradient(circle at top, rgba(${r},${g},${b},0.25) 0%, #0b0f17 70%)`;
    }
  } catch(e) {}
};

function closeProductModal(){
  const modal = $('miniappProductModal');
  if(modal) {
    modal.classList.add('hidden');
    modal.innerHTML = '';
  }
}

function showProduct(pid){
  const p=(state.shop_products||[]).find(x=>Number(x.id)===Number(pid));
  if(!p) return;

  const title = p.name || p.title || 'جزئیات محصول';
  const variants = p.variants || [];
  const w = getWishlist();
  const isWished = w.includes(Number(p.id));
  const rawDesc = (p.full_description || p.short_description || '').trim();
  const hasDesc = rawDesc && rawDesc !== '-' && rawDesc !== '.';

  let selectedVariant = variants.length > 0 ? variants[0] : null;
  let selectedQty = 1;

  let modal = $('miniappProductModal');
  if(!modal) {
    modal = document.createElement('div');
    modal.id = 'miniappProductModal';
    modal.className = 'modal-container hidden';
    document.body.appendChild(modal);
  }

  function updateModalPrice() {
    const basePrice = selectedVariant ? Number(selectedVariant.price) : Number(p.price || 0);
    const baseOrig = selectedVariant ? Number(selectedVariant.old_price || 0) : Number(p.old_price || 0);

    const totalPrice = basePrice * selectedQty;
    const totalOrig = baseOrig && baseOrig > basePrice ? baseOrig * selectedQty : null;

    const lbl = $('mp-price-lbl');
    if (lbl) {
      lbl.innerHTML = `${totalOrig ? `<s style="color:var(--muted); font-size:14px; margin-left:6px; text-decoration:line-through; font-weight:normal;">${fmt(totalOrig)}</s>` : ''}${fmt(totalPrice)}`;
    }
  }

  modal.innerHTML = `
    <div class="modal-card" style="max-width:580px; width:95%; max-height:calc(100vh - 40px); overflow-y:auto; border-radius:24px; padding:20px; background:linear-gradient(180deg, rgba(15, 24, 44, 0.98), rgba(7, 12, 24, 0.99)); border:1px solid rgba(0, 242, 254, 0.3); box-shadow:0 20px 60px rgba(0, 0, 0, 0.8);">
      
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <h3 style="font-size:18px; font-weight:900; color:#fff; margin:0;">${esc(title)}</h3>
        <div style="display:flex; align-items:center; gap:8px;">
          <button class="icon-btn-circle" id="m-wish-btn" title="علاقه‌مندی" style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);font-size:14px;cursor:pointer;">${isWished ? '❤️' : '🤍'}</button>
          <button class="icon-btn-circle" id="m-share-btn" title="اشتراک‌گذاری" style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);font-size:14px;cursor:pointer;">🔗</button>
          <button class="icon-btn-circle" id="m-close-btn" title="بستن" style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);font-size:16px;cursor:pointer;color:#fff;">✕</button>
        </div>
      </div>

      ${p.image_url ? `
        <div class="product-modal-hero" style="margin-bottom:16px; max-height:220px; display:flex; justify-content:center; align-items:center; border-radius:18px; overflow:hidden; background:linear-gradient(135deg, rgba(0,242,254,0.08), rgba(29,155,240,0.15)); border:1px solid rgba(255,255,255,0.12); padding:10px;">
          <img src="${esc(p.image_url)}" crossorigin="anonymous" onload="window.applyProductColor(this)" ${p.image_srcset ? `srcset="${esc(p.image_srcset)}"` : ''} alt="${esc(title)}" style="max-height:200px; object-fit:contain; border-radius:16px;">
        </div>
      ` : ''}

      <div style="display:flex; justify-content:space-around; background:rgba(0,242,254,0.04); border:1px solid rgba(0,242,254,0.2); border-radius:14px; padding:12px; margin-bottom:16px; font-size:14px; color:var(--cyan);">
        <span>⚡ <b>تحویل آنی ۲۴ ساعته</b></span>
        <span>🛡️ <b>ضمانت سلامت اکانت</b></span>
        <span>🎧 <b>پشتیبانی اختصاصی</b></span>
      </div>

      ${hasDesc ? `<div style="margin-bottom:16px; background:rgba(255,255,255,0.03); border-radius:14px; padding:14px; border:1px solid rgba(255,255,255,0.08); font-size:14.5px; color:var(--muted); line-height:1.7;">${textBlock(rawDesc)}</div>` : ''}

      ${variants.length > 0 ? `
        <div style="margin-bottom:18px;">
          <label style="display:block; font-size:14px; color:var(--muted); margin-bottom:8px;">انتخاب پلن / مدت زمان اشتراک:</label>
          <div class="variant-cards-grid">
            ${variants.map((v, idx) => {
              const vDisc = Number(v.discount_percent || 0);
              const vOrig = Number(v.old_price || 0);
              return `
                <button class="variant-option-card ${idx === 0 ? 'selected' : ''}" data-v-idx="${idx}" data-v-id="${v.id}">
                  <div class="variant-card-header">
                    <span class="variant-title">${esc(v.title)}</span>
                    <span class="variant-badge">${v.duration_days ? `${v.duration_days} روز` : 'پلن ویژه'}</span>
                  </div>
                  <div class="variant-price">
                    ${vOrig > 0 && vOrig > Number(v.price) ? `<s style="color:var(--muted); font-size:13.5px; margin-left:4px; text-decoration:line-through;">${fmt(vOrig)}</s>` : ''}
                    <span>${fmt(v.price)}</span>
                    ${vDisc > 0 ? `<span class="flash-pill" style="font-size:13px; background:rgba(239,68,68,0.2); color:#fca5a5; padding:2px 6px; border-radius:6px; margin-right:4px;">−${nf(vDisc)}٪</span>` : ''}
                  </div>
                  <div style="margin-top:6px; font-size:13.5px; color:var(--accent); text-align:left; font-weight:700;">ℹ️ مشاهده جزئیات و مشخصات پلن ↗</div>
                </button>
              `;
            }).join('')}
          </div>
        </div>
        </div>
      ` : ''}
    </div>
  `;

  modal.classList.remove('hidden');

  // Close handlers
  modal.querySelector('#m-close-btn')?.addEventListener('click', closeProductModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeProductModal();
  });

  // Wishlist handler
  modal.querySelector('#m-wish-btn')?.addEventListener('click', () => {
    toggleWishlist(p.id);
    const btn = modal.querySelector('#m-wish-btn');
    if (btn) {
      const w = getWishlist();
      btn.textContent = w.includes(Number(p.id)) ? '❤️' : '🤍';
    }
  });

  // Share handler
  modal.querySelector('#m-share-btn')?.addEventListener('click', () => openShareSheet(p.id));

  // Variant selection & pop-up opener
  modal.querySelectorAll('.variant-option-card').forEach(card => {
    card.addEventListener('click', (e) => {
      modal.querySelectorAll('.variant-option-card').forEach(c => c.classList.remove('selected'));
      const btn = e.currentTarget;
      btn.classList.add('selected');
      const idx = Number(btn.dataset.vIdx);
      selectedVariant = variants[idx] || null;
      updateModalPrice();
      if(selectedVariant){
        openVariantDetails(p.id, selectedVariant.id);
      }
    });
  });

  // Quantity handlers
  modal.querySelector('#m-qty-plus')?.addEventListener('click', () => {
    selectedQty++;
    modal.querySelector('#m-qty-val').textContent = selectedQty;
    updateModalPrice();
  });

  modal.querySelector('#m-qty-minus')?.addEventListener('click', () => {
    if (selectedQty > 1) {
      selectedQty--;
      modal.querySelector('#m-qty-val').textContent = selectedQty;
      updateModalPrice();
    }
  });

  // Buy handler
  modal.querySelector('#m-buy-btn')?.addEventListener('click', () => {
    const vid = selectedVariant ? selectedVariant.id : 0;
    for (let i = 0; i < selectedQty; i++) {
      cartAdd(p.id, vid);
    }
    closeProductModal();
    openCartSheet();
  });
}
function renderOrders(){const all=state.orders||[];const filters=[['all','همه'],['active','فعال'],['pending_payment','در انتظار پرداخت'],['receipt_submitted','رسید ارسال شده'],['delivered','تحویل‌شده'],['cleanup','لغو/رد شده']];if(currentOrderId){const o=orderById(currentOrderId); if(!o){currentOrderId=null; return renderOrders()} $('ordersPage').innerHTML=orderDetailHtml(o); return;}const orders=all.filter(o=>orderFilter==='all'||(orderFilter==='active'&&!canHideOrder(o)&&o.status!=='delivered')||(orderFilter==='cleanup'&&canHideOrder(o))||o.status===orderFilter);$('ordersPage').innerHTML=`<section class="orders-header"><div><h2>🧾 سفارش‌های من</h2><p class="muted">روی هر سفارش بزن تا جزئیات تمیز و کاملش باز شود.</p></div><button class="secondary" data-clear-canceled>پاکسازی لغو/رد شده‌ها</button></section><div class="order-filters">${filters.map(f=>`<button class="filter-chip ${orderFilter===f[0]?'active':''}" data-order-filter="${f[0]}">${f[1]}</button>`).join('')}</div><div class="order-list">${orders.map(orderRowHtml).join('')||'<p class="muted empty-state">سفارشی در این بخش نیست.</p>'}</div>`}
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
function _walletSubNav(){
  const tabs=[{k:'overview',icon:'💰',label:'خلاصه'},{k:'missions',icon:'🎯',label:'ماموریت'},{k:'history',icon:'📋',label:'تاریخچه'}];
  return `<nav class="wallet-sub-tabs" role="tablist" aria-label="بخش‌های اعتبار">${tabs.map(t=>`<button class="${walletTab===t.k?'active':''}" data-wallet-tab="${t.k}" role="tab" aria-selected="${walletTab===t.k}">${t.icon} ${t.label}</button>`).join('')}</nav>`;
}
function _walletOverview(u){
  return `<div class="wallet-tab-panel">
    <section class="wallet-dashboard">
      <div class="wallet-card-main">
        <small>اعتبار قابل استفاده در فروشگاه</small>
        <strong data-count-anim="${u.balance}">${fmt(u.balance)}</strong>
        <p>اعتبار BlueGate برای کم‌کردن مبلغ سفارش‌های فروشگاه استفاده می‌شود و برداشت نقدی ندارد.</p>
      </div>
      <div class="wallet-mini-grid">
        <div><b>${fmt(u.total_earned)}</b><span>کل درآمد</span></div>
        <div><b>${nf(u.referrals_count)}</b><span>دعوت موفق</span></div>
        <div><b>${nf(u.spin_balance)}</b><span>شانس گردونه</span></div>
        <div><b data-count-anim="${u.balance}">${fmt(u.balance)}</b><span>اعتبار فعلی</span></div>
      </div>
    </section>
    ${vipProgressHtml()}
    <article class="wallet-card referral-card">
      <div class="referral-card-head"><span class="referral-icon">🔗</span><div><h3>دعوت دوستان، درآمد بساز</h3><p class="muted">لینک اختصاصی خودت را با دوستان به اشتراک بذار. هر کس با این لینک وارد بات بشه و عضو بشه، خودکار به زیرمجموعه‌های تو اضافه می‌شه و پاداش دعوت به اعتبار BlueGate اضافه می‌شه. هرچه دعوت بیشتر، درآمد بیشتر!</p></div></div>
      <div class="actions" style="flex-direction:column;gap:10px">
        <button class="primary" id="shareInviteNative" style="width:100%;font-size:15px;padding:15px;background:linear-gradient(135deg,var(--accent),#2563eb);box-shadow:0 12px 28px color-mix(in srgb,var(--accent) 40%,transparent);animation:pulseGlow 2s infinite">🚀 ارسال برای دوستان → دریافت ${fmt(state.start_reward||2000)} تومان</button>
        <div style="display:flex;gap:8px;width:100%">
          <button class="ghost" id="copyLink" style="flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1)">📋 کپی لینک</button>
          <button class="ghost" id="openPromoSheetBtn" style="flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1)">📝 متن تبلیغ</button>
          <button class="ghost" id="openQrWallet" style="flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1)">📱 کد QR</button>
        </div>
      </div>
    </article>
    <div id="referralTreePlaceholder">
      <article class="wallet-card referral-tree-card">
        <div class="referral-tree-head"><span class="admin-card-icon">🌳</span><div><h3>درخت دعوت</h3><p class="muted">در حال بارگذاری...</p></div></div>
      </article>
    </div>
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
  const txs=state.transactions||[];
  return `<div class="wallet-tab-panel">
    <article class="wallet-card">
      <div class="section-title" style="margin-bottom:14px"><h2>📋 تاریخچه اعتبار</h2><small>${nf(txs.length)} رکورد</small></div>
      <div class="tx-list">${txs.map(t=>`<div class="tx-row"><span>${esc(t.description||t.type)}</span><b class="${Number(t.amount)<0?'negative':'positive'}">${fmt(t.amount)}</b><small>${esc(t.created_at)}</small></div>`).join('')||'<p class="muted empty-state">تراکنشی نیست.</p>'}</div>
    </article>
  </div>`;
}
function renderWallet(){
  const u=state.user;
  if(walletTab!=='missions') lastSpinPrize=null; // BUG-14: reset stale prize on tab switch
  $('walletPage').innerHTML=_walletSubNav()+`<div id="walletContent"></div>`;
  const panel=$('walletContent');
  if(walletTab==='overview'){panel.innerHTML=_walletOverview(u);triggerBalanceAnims();loadReferralTree().then(refs=>{const ph=$('referralTreePlaceholder');if(ph)ph.innerHTML=referralTreeHtml(refs)});}
  else if(walletTab==='missions'){panel.innerHTML=_walletMissions(u);triggerBalanceAnims();}
  else{panel.innerHTML=_walletHistory(u);}
}
async function reload(){state=await api('me');applyTheme(state);renderUser()}
function showFatalPanel(message){
  const html=`<section class="hero error-panel"><h2>⚠️ خطا</h2><p class="muted">${esc(message||'خطا در بارگذاری')}</p><button class="primary" id="reloadAdmin">تلاش دوباره</button></section>`;
  if(isAdminMode){$('userApp').classList.add('hidden');$('adminApp').classList.remove('hidden');$('adminContent').innerHTML=html;}
  else {$('userApp').classList.remove('hidden');$('adminApp').classList.add('hidden');$('homePage').innerHTML=html;}
}

async function loadAdmin(){try{adminState=await api('admin_summary');applyTheme(adminState.settings||{});renderAdmin()}catch(e){showFatalPanel(e.message);showStatus(e.message,'error')}}
function renderAdmin(){if(['products','categories','variants'].includes(currentAdminTab))currentAdminTab='catalog';saveAppLastState();const r=adminState.report||{};$('adminStats').innerHTML=`<div class="mini-stat admin-stat-card"><b>${nf(r.today?.c||0)}</b><span>سفارش امروز<br>${fmt(r.today?.s||0)}</span></div><div class="mini-stat admin-stat-card"><b>${nf(r.month?.c||0)}</b><span>سفارش ماه<br>${fmt(r.month?.s||0)}</span></div><div class="mini-stat admin-stat-card"><b>${nf(r.pending||0)}</b><span>نیازمند اقدام</span></div>`;document.querySelectorAll('[data-admin-tab]').forEach(b=>b.classList.toggle('active',b.dataset.adminTab===currentAdminTab));const fn={dashboard:renderAdminDashboard,catalog:renderAdminCatalog,inventory:renderAdminInventory,orders:renderAdminOrders,coupons:renderAdminCoupons,activity:renderAdminActivity,roles:renderAdminRoles,settings:renderAdminSettings,backups:renderAdminBackups}[currentAdminTab];const content=$('adminContent');content.classList.remove('admin-content-enter');void content.offsetWidth;content.innerHTML=fn?fn():'';content.classList.add('admin-content-enter');requestAnimationFrame(()=>{content.querySelectorAll('.admin-card, .admin-item, .accordion-card, .no-variant-row').forEach((el,i)=>{el.style.setProperty('--stagger-i',Math.min(i,8));el.classList.add('stagger-in')})});setTimeout(()=>{if(currentAdminTab==='settings')initSettingsUi();attachLongPress()},0)}
function catOptions(selected=''){return `<option value="">بدون دسته</option>`+(adminState.categories||[]).map(c=>`<option value="${c.id}" ${Number(selected)===Number(c.id)?'selected':''}>${esc(c.emoji||'🛒')} ${esc(c.title)}</option>`).join('')}
function productOptions(selected=''){return (adminState.products||[]).map(p=>`<option value="${p.id}" ${Number(selected)===Number(p.id)?'selected':''}>#${p.id} ${esc(p.name)}</option>`).join('')}
function parentProductOptions(selected='',exclude=''){return `<option value="">بدون والد</option>`+(adminState.products||[]).filter(p=>Number(p.id)!==Number(exclude)&&!Number(p.parent_id||0)).map(p=>`<option value="${p.id}" ${Number(selected)===Number(p.id)?'selected':''}>#${p.id} ${esc(p.name)}</option>`).join('')}
function productTypeOptions(selected='normal'){return [['normal','محصول عادی'],['service_group','سرویس مادر'],['vpn','زیرسرویس VPN'],['premium','Premium'],['stars','Stars']].map(([v,l])=>`<option value="${v}" ${String(selected||'normal')===v?'selected':''}>${l}</option>`).join('')}
function variantOptions(selected='', productId=null){return `<option value="">بدون پلن</option>`+(adminState.variants||[]).filter(v=>!productId||Number(v.product_id)===Number(productId)).map(v=>`<option value="${v.id}" ${Number(selected)===Number(v.id)?'selected':''}>#${v.id} ${esc(v.product_name)} - ${esc(v.title)}</option>`).join('')}
function renderAdminDashboard(){const top=adminState.report?.top||[];const catalogTree=adminState.catalog_admin?.tree||[];const productCount=catalogTree.length;const variantCount=catalogTree.reduce((a,s)=>a+(s.groups||[]).reduce((b,g)=>b+(g.plans||[]).length,0),0);const orderCount=(adminState.orders||[]).length;const inventoryCount=(adminState.inventory||[]).length;const orders=adminState.orders||[];const rev7=last7DaysRevenue(orders);const total7=rev7.reduce((s,d)=>s+d.rev,0);const lowStock=(adminState.products||[]).filter(p=>Number(p.inventory_available||0)<3&&Number(p.is_active)).sort((a,b)=>Number(a.inventory_available||0)-Number(b.inventory_available||0));return `<article class="admin-card dashboard-hero"><div class="admin-card-head"><span class="admin-card-icon">📊</span><div><h3>داشبورد فروش</h3><p class="muted">مرور سریع وضعیت فروشگاه و دسترسی به همه بخش‌ها.</p></div></div><div class="dashboard-quick-stats"><div class="dq-stat"><b>${nf(productCount)}</b><span>سرویس</span></div><div class="dq-stat"><b>${nf(variantCount)}</b><span>پلن</span></div><div class="dq-stat"><b>${nf(orderCount)}</b><span>سفارش</span></div><div class="dq-stat"><b>${nf(inventoryCount)}</b><span>آیتم انبار</span></div></div><div class="dashboard-quick-actions"><button class="quick-action" data-admin-tab="catalog"><span>🧭</span><b>Catalog Studio</b></button><button class="quick-action" data-admin-tab="orders"><span>🧾</span><b>سفارش‌ها</b></button><button class="quick-action" data-admin-tab="inventory"><span>📦</span><b>انبار</b></button><button class="quick-action" data-admin-tab="settings"><span>⚙️</span><b>تنظیمات</b></button><button class="quick-action" data-admin-tab="backups"><span>💾</span><b>بکاپ</b></button><button class="quick-action" onclick="openBroadcast()"><span>📢</span><b>پیام همگانی</b></button><button class="quick-action" onclick="openPurchaseReward()"><span>🎁</span><b>پاداش خرید</b></button></div></article>${lowStock.length?`<article class="admin-card alert-card"><div class="admin-card-head"><span class="admin-card-icon">⚠️</span><div><h3>موجودی کم</h3><p class="muted">${nf(lowStock.length)} محصول کمتر از ۳ آیتم در انبار دارند.</p></div></div><div class="low-stock-list">${lowStock.slice(0,5).map(p=>`<div class="low-stock-row" data-admin-tab="inventory"><div><b>${esc(p.name)}</b><span class="muted">موجودی: ${nf(p.inventory_available||0)} آیتم</span></div><span class="chip-mini chip-${Number(p.inventory_available||0)===0?'off':'featured'}">${Number(p.inventory_available||0)===0?'ناموجود':'کم'}</span></div>`).join('')}</div>${lowStock.length>5?`<button class="secondary wide" data-admin-tab="inventory" style="margin-top:10px">مشاهده همه در انبار</button>`:''}</article>`:''}<article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">📈</span><div><h3>درآمد ۷ روز اخیر</h3><p class="muted">مجموع: ${fmt(total7)} تومان</p></div></div>${sparklineHtml(rev7)}</article>${(adminState.forecast&&adminState.forecast.forecast)?`<article class="admin-card forecast-card"><div class="admin-card-head"><span class="admin-card-icon">🔮</span><div><h3>پیش‌بینی ماه آینده</h3><p class="muted">بر اساس میانگین ۳۰ روز اخیر</p></div></div><div class="forecast-grid"><div class="forecast-main"><b>${fmt(adminState.forecast.forecast)}</b><span>تومان پیش‌بینی</span></div><div class="forecast-side"><span class="chip-mini chip-${adminState.forecast.change_percent>=0?'active':'off'}">${adminState.forecast.change_percent>=0?'▲':'▼'} ${nf(Math.abs(adminState.forecast.change_percent))}٪</span><small>نسبت به ماه قبل</small></div></div><p class="muted">میانگین روزانه: ${fmt(adminState.forecast.daily_avg)} تومان · ۳۰ روز اخیر: ${nf(adminState.forecast.last30_count)} سفارش</p></article>`:''}<div class="admin-charts-grid"><article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">🏆</span><div><h3>پرفروش‌ترین‌ها</h3><p class="muted">بر اساس تعداد سفارش</p></div></div>${top.length?barChartHtml(top):'<p class="muted empty-state">داده‌ای نیست.</p>'}</article><article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">🥧</span><div><h3>روش‌های پرداخت</h3><p class="muted">توزیع ${nf(orderCount)} سفارش</p></div></div>${pieChartHtml(orders)}</article></div>`}

function catalogAdminData(){return adminState.catalog_admin||{tree:[],categories:[],preview:{counts:{},proposals:[]},public:{enabled:false}}}
function catalogCategoryOptions(selected=''){return (catalogAdminData().categories||[]).map(c=>`<option value="${c.id}" ${Number(selected)===Number(c.id)?'selected':''}>${esc(c.emoji||'🛍️')} ${esc(c.title)}</option>`).join('')}
function catalogServiceOptions(selected=''){return (catalogAdminData().tree||[]).map(s=>`<option value="${s.id}" ${Number(selected)===Number(s.id)?'selected':''}>${esc(s.name)}</option>`).join('')}
function catalogGroupOptions(selected=''){return (catalogAdminData().tree||[]).flatMap(s=>(s.groups||[]).map(g=>`<option value="${g.id}" ${Number(selected)===Number(g.id)?'selected':''}>${esc(s.name)} → ${g.is_default?'پلن‌های مستقیم':esc(g.name)}</option>`)).join('')}
function catalogPlanOptions(selected=''){return (catalogAdminData().tree||[]).flatMap(s=>(s.groups||[]).flatMap(g=>(g.plans||[]).map(p=>`<option value="${p.id}" ${Number(selected)===Number(p.id)?'selected':''}>${esc(s.name)} → ${g.is_default?'مستقیم':esc(g.name)} → ${esc(p.title)}</option>`))).join('')}
function renderAdminCatalog(){const ca=catalogAdminData(),tree=ca.tree||[],cats=ca.categories||[],pv=ca.preview||{},enabled=!!ca.public?.enabled,undo=ca.undo||{},unresolved=(pv.proposals||[]).filter(x=>!x.mapped),review=unresolved.filter(x=>x.confidence==='review');const groupCount=tree.reduce((a,s)=>a+(s.groups||[]).filter(g=>!g.is_default).length,0),planCount=tree.reduce((a,s)=>a+(s.groups||[]).reduce((b,g)=>b+(g.plans||[]).length,0),0);return `<article class="admin-card catalog-mobile-studio-hero"><div class="admin-card-head"><span class="admin-card-icon">🧭</span><div><h3>Catalog Studio</h3><p class="muted">ساخت و ویرایش سرویس‌ها، مرحله‌به‌مرحله</p></div></div><div class="dashboard-quick-stats"><div class="dq-stat"><b>${nf(tree.length)}</b><span>سرویس</span></div><div class="dq-stat"><b>${nf(groupCount)}</b><span>زیرسرویس</span></div><div class="dq-stat"><b>${nf(planCount)}</b><span>پلن</span></div><div class="dq-stat"><b>${nf(review.length)}</b><span>بررسی</span></div></div><button class="primary wide catalog-mobile-create" onclick="openCatalogMobileWizard(0)">＋ ساخت سرویس جدید</button><button class="secondary wide catalog-mobile-quick" onclick="openCatalogFast()">⚡ ساخت سریع</button>${undo.available?`<button class="secondary wide catalog-mobile-undo" onclick="catalogMobileUndo()">↶ بازگشت آخرین تغییر</button>`:''}</article>${!enabled?`<article class="admin-card catalog-mobile-migrate"><div class="admin-card-head"><span class="admin-card-icon">🪄</span><div><h3>مرتب‌سازی فروشگاه قبلی</h3><p class="muted">هیچ سفارش یا دیتایی حذف نمی‌شود.</p></div></div><div class="catalog-mobile-stepbar"><span><b>1</b>اسکن</span><i></i><span><b>2</b>بررسی</span><i></i><span><b>3</b>فعال‌سازی</span></div><div class="catalog-mobile-actions"><button class="secondary" onclick="catalogMobilePreview()">🔍 اسکن دوباره</button><button class="primary" onclick="catalogMobileApply()">✨ اعمال موارد مطمئن</button></div></article>`:''}<article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">🗂</span><div><h3>دسته‌های فروشگاه</h3><p class="muted">فقط برای مرتب‌کردن ویترین.</p></div><button class="secondary" onclick="openCatalogMobileCategory(0)">＋</button></div><div class="catalog-mobile-categories">${cats.map(c=>`<button onclick="openCatalogMobileCategory(${c.id})"><span>${esc(c.emoji||'🛍️')}</span><b>${esc(c.title)}</b><small>${tree.filter(s=>Number(s.category_id)===Number(c.id)).length} سرویس</small></button>`).join('')||'<p class="muted">هنوز دسته‌ای نیست.</p>'}</div></article><div class="catalog-mobile-section-title"><div><h3>سرویس‌های فروشگاه</h3><p class="muted">برای اصلاح محصول فعلی، همان Wizard را باز کن.</p></div><button class="secondary" onclick="openCatalogMobileOrganizer()">⇄ انتقال</button></div><div class="catalog-mobile-service-list">${tree.map(catalogMobileServiceCard).join('')||`<article class="admin-card catalog-mobile-empty"><span>🛍️</span><h3>هنوز سرویسی نداری</h3><p class="muted">اولین سرویس را با مسیر مرحله‌ای بساز.</p><button class="primary wide" onclick="openCatalogMobileWizard(0)">ساخت سرویس</button></article>`}</div>${unresolved.length?`<article class="admin-card catalog-mobile-review"><div class="admin-card-head"><span class="admin-card-icon">🧠</span><div><h3>اصلاح محصولات قبلی</h3><p class="muted">فقط موارد حل‌نشده از ساختار قدیمی اینجا نمایش داده می‌شوند.</p></div></div><div class="catalog-mobile-review-list">${unresolved.map(x=>`<div><div><b>${esc(x.service_name)}</b><small>${esc(x.category_title||'سایر')} · ${nf(x.plan_count||0)} پلن</small></div><span class="chip-mini ${x.confidence==='review'?'chip-off':x.confidence==='medium'?'chip-featured':'chip-active'}">${x.confidence==='review'?'🔴 تصمیم لازم':x.confidence==='medium'?'🟡 بررسی':'🟢 آماده'}</span>${x.confidence==='review'?`<button class="secondary" onclick="catalogMobileApplyOne(${x.legacy_product_id})">مرتب‌سازی</button>`:''}</div>`).join('')}</div></article>`:''}`}
function catalogMobileServiceCard(s){const groups=(s.groups||[]).filter(g=>!g.is_default),direct=(s.groups||[]).find(g=>g.is_default),plans=(s.groups||[]).reduce((a,g)=>a+(g.plans||[]).length,0);return `<article class="admin-card catalog-mobile-service-card ${Number(s.is_active)?'':'is-off'}"><header><div class="catalog-mobile-service-icon">${s.image_url?`<img src="${esc(s.image_url)}">`:esc(s.category_emoji||'🛍️')}</div><div><small>${esc(s.category_title||'سایر')}</small><h3>${esc(s.name)}</h3><p class="muted">${esc(s.description||'بدون توضیح')}</p></div><span class="chip-mini ${Number(s.is_active)?'chip-active':'chip-off'}">${Number(s.is_active)?'فعال':'غیرفعال'}</span></header><div class="catalog-mobile-card-stats"><span><b>${nf(groups.length)}</b><small>زیرسرویس</small></span><span><b>${nf(plans)}</b><small>پلن</small></span><span><b>${groups.length?'مرحله‌ای':'مستقیم'}</b><small>ساختار</small></span></div><div class="catalog-mobile-card-structure">${groups.length?groups.map(g=>`<div><b>${esc(g.name)}</b><span>${(g.plans||[]).map(p=>esc(p.title)).join(' · ')||'بدون پلن'}</span></div>`).join(''):`<div><b>⚡ پلن‌های مستقیم</b><span>${(direct?.plans||[]).map(p=>esc(p.title)).join(' · ')||'بدون پلن'}</span></div>`}</div><button class="primary wide" onclick="openCatalogMobileWizard(${s.id})">✏️ مدیریت و ویرایش</button></article>`}
let mobileCatalogWizard=null,mobileCatalogStep=0;
function mcKey(p='x'){return p+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function mcPlan(p={}){return {id:Number(p.id||0),key:p.key||mcKey('p'),title:p.title||'',price:Number(p.price||0),duration_days:Number(p.duration_days||0),discount_percent:Number(p.discount_percent||0),description:p.description||'',is_active:p.is_active===undefined?1:Number(p.is_active)}}
function mcGroup(g={}){return {id:Number(g.id||0),key:g.key||mcKey('g'),name:g.is_default?'Default Group':(g.name||''),description:g.description||'',is_default:Number(g.is_default||0),is_active:g.is_active===undefined?1:Number(g.is_active),plans:(g.plans||[]).map(mcPlan)}}
function mcFromService(s){const gs=(s.groups||[]).map(mcGroup),vis=gs.filter(g=>!g.is_default),def=gs.find(g=>g.is_default),mode=vis.length?'grouped':'direct';return {id:Number(s.id),name:s.name||'',category_id:s.category_id||'',description:s.description||'',image_url:s.image_url||'',theme:s.theme||'blue',badge:s.badge||'',is_featured:Number(s.is_featured||0),is_active:Number(s.is_active||0),mode,groups:mode==='direct'?[def||mcGroup({is_default:1})]:gs.filter(g=>!g.is_default||(g.plans||[]).length)}}
function mcBlank(){const c=catalogAdminData().categories?.[0];return {id:0,name:'',category_id:c?.id||'',description:'',image_url:'',theme:'blue',badge:'',is_featured:0,is_active:1,mode:'grouped',groups:[mcGroup({name:'Standard'})]}}
function openCatalogMobileWizard(id=0){const s=(catalogAdminData().tree||[]).find(x=>Number(x.id)===Number(id));mobileCatalogWizard=s?mcFromService(s):mcBlank();let restored=false;try{const raw=localStorage.getItem(`bg_mcw_${id||'new'}`);if(raw){const d=JSON.parse(raw);if(d&&Number(d.id||0)===Number(id||0)){mobileCatalogWizard=d;restored=true}}}catch(_){}mobileCatalogStep=0;renderCatalogMobileWizard();if(restored)setTimeout(()=>showStatus('پیش‌نویس ذخیره‌شده بازیابی شد.','success'),30)}
function mcCollect(){const sh=$('presentationSheet');if(!sh||!mobileCatalogWizard)return;const w=mobileCatalogWizard;if(mobileCatalogStep===0){sh.querySelectorAll('[data-mcw]').forEach(el=>{w[el.dataset.mcw]=el.type==='checkbox'?(el.checked?1:0):el.value})}if(mobileCatalogStep===2&&w.mode==='grouped'){sh.querySelectorAll('[data-mcg]').forEach(box=>{const g=w.groups.find(x=>x.key===box.dataset.mcg);if(g){box.querySelectorAll('[data-mcgf]').forEach(el=>g[el.dataset.mcgf]=el.value)}})}if(mobileCatalogStep===3){sh.querySelectorAll('[data-mcp]').forEach(box=>{const p=w.groups.flatMap(g=>g.plans||[]).find(x=>x.key===box.dataset.mcp);if(p){box.querySelectorAll('[data-mcpf]').forEach(el=>p[el.dataset.mcpf]=el.type==='checkbox'?(el.checked?1:0):(el.type==='number'?Number(el.value||0):el.value))}})}try{localStorage.setItem(`bg_mcw_${w.id||'new'}`,JSON.stringify(w))}catch(_){}}
function mcValidate(step=mobileCatalogStep){const w=mobileCatalogWizard;if(step===0){if(!String(w.name||'').trim())return 'نام سرویس را وارد کن';if(!Number(w.category_id))return 'دسته را انتخاب کن'}if(step===2&&w.mode==='grouped'){const gs=w.groups.filter(g=>!g.is_default);if(!gs.length)return 'حداقل یک زیرسرویس اضافه کن';if(gs.some(g=>!String(g.name||'').trim()))return 'نام زیرسرویس‌ها را کامل کن'}if(step===3){const gs=w.mode==='direct'?w.groups.filter(g=>g.is_default):w.groups.filter(g=>!g.is_default);if(!gs.some(g=>(g.plans||[]).length))return 'حداقل یک پلن اضافه کن';for(const g of gs)for(const p of g.plans||[]){if(!String(p.title||'').trim())return 'عنوان پلن را کامل کن';if(Number(p.price||0)<=0)return 'قیمت پلن باید بیشتر از صفر باشد'}}return ''}
function mcStepHtml(){const w=mobileCatalogWizard;if(mobileCatalogStep===0)return `<div class="mcw-copy"><small>مرحله ۱ از ۵</small><h3>${w.id?'ویرایش اطلاعات اصلی':'سرویس جدید'}</h3><p class="muted">نام، دسته و ظاهر سرویس را مشخص کن.</p></div><div class="form-grid mcw-grid"><label class="full"><span>نام سرویس</span><input data-mcw="name" value="${esc(w.name)}" placeholder="مثلاً BluePing"></label><label><span>دسته</span><select data-mcw="category_id">${catalogCategoryOptions(w.category_id)}</select></label><label><span>Badge</span><input data-mcw="badge" value="${esc(w.badge)}" placeholder="مثلاً محبوب"></label><label class="full"><span>توضیح کوتاه</span><textarea data-mcw="description">${esc(w.description)}</textarea></label><label class="full"><span>لینک تصویر</span><input data-mcw="image_url" value="${esc(w.image_url)}" placeholder="https://..."></label><label class="switch-line"><span>⭐ ویژه</span><input type="checkbox" data-mcw="is_featured" ${Number(w.is_featured)?'checked':''}></label><label class="switch-line"><span>🟢 فعال</span><input type="checkbox" data-mcw="is_active" ${Number(w.is_active)?'checked':''}></label></div>`;if(mobileCatalogStep===1)return `<div class="mcw-copy"><small>مرحله ۲ از ۵</small><h3>ساختار انتخاب پلن</h3><p class="muted">فقط چیزی را انتخاب کن که مشتری باید ببیند.</p></div><div class="mcw-mode"><button class="${w.mode==='direct'?'active':''}" data-mc-mode="direct"><span>⚡</span><b>پلن مستقیم</b><small>مثلاً 1 Month، 3 Months</small></button><button class="${w.mode==='grouped'?'active':''}" data-mc-mode="grouped"><span>🧩</span><b>چند زیرسرویس</b><small>مثلاً Standard، Pro</small></button></div>`;if(mobileCatalogStep===2){if(w.mode==='direct')return `<div class="mcw-copy"><small>مرحله ۳ از ۵</small><h3>زیرسرویس لازم نیست</h3><p class="muted">Default Group پشت صحنه مدیریت می‌شود و تو آن را نمی‌بینی.</p></div><div class="mcw-empty">✨ ساختار ساده آماده است</div>`;return `<div class="mcw-copy"><small>مرحله ۳ از ۵</small><h3>زیرسرویس‌ها</h3><p class="muted">نوع‌های سرویس را اضافه یا اصلاح کن.</p></div><div class="mcw-list">${w.groups.filter(g=>!g.is_default).map((g,i)=>`<div class="mcw-group" data-mcg="${g.key}"><b>${i+1}</b><div><label><span>نام</span><input data-mcgf="name" value="${esc(g.name)}"></label><label><span>توضیح</span><input data-mcgf="description" value="${esc(g.description)}"></label></div><button class="danger ghost" data-mc-remove-group="${g.key}">حذف</button></div>`).join('')}</div><button class="secondary wide" data-mc-add-group>＋ افزودن زیرسرویس</button>`}if(mobileCatalogStep===3){let gs=w.mode==='direct'?w.groups.filter(g=>g.is_default):w.groups.filter(g=>!g.is_default||g.plans.length);if(w.mode==='direct'&&!gs.length){const g=mcGroup({is_default:1});w.groups.unshift(g);gs=[g]}return `<div class="mcw-copy"><small>مرحله ۴ از ۵</small><h3>پلن‌ها</h3><p class="muted">قیمت و مدت هر پلن را وارد کن.</p></div><div class="mcw-plan-groups">${gs.map(g=>`<section><header><b>${g.is_default?'⚡ پلن‌های مستقیم':'🧩 '+esc(g.name)}</b><button class="secondary" data-mc-add-plan="${g.key}">＋ پلن</button></header>${(g.plans||[]).map(p=>`<div class="mcw-plan" data-mcp="${p.key}"><div class="form-grid"><label><span>عنوان</span><input data-mcpf="title" value="${esc(p.title)}"></label><label><span>قیمت</span><input data-mcpf="price" type="number" value="${Number(p.price||0)}"></label><label><span>روز</span><input data-mcpf="duration_days" type="number" value="${Number(p.duration_days||0)}"></label><label><span>تخفیف %</span><input data-mcpf="discount_percent" type="number" value="${Number(p.discount_percent||0)}"></label><label class="full"><span>توضیح</span><input data-mcpf="description" value="${esc(p.description)}"></label></div><div class="mcw-plan-foot"><label><input data-mcpf="is_active" type="checkbox" ${Number(p.is_active)?'checked':''}> فعال</label><button class="danger ghost" data-mc-remove-plan="${p.key}" data-group-key="${g.key}">حذف</button></div></div>`).join('')||'<p class="muted mcw-no-plan">هنوز پلنی نیست.</p>'}</section>`).join('')}</div>`}const gs=w.mode==='direct'?w.groups.filter(g=>g.is_default):w.groups.filter(g=>!g.is_default);return `<div class="mcw-copy"><small>مرحله ۵ از ۵</small><h3>پیش‌نمایش</h3><p class="muted">ذخیره، موارد حذف‌شده را فقط امن غیرفعال می‌کند.</p></div><div class="mcw-preview"><header><span>${esc((catalogAdminData().categories||[]).find(c=>Number(c.id)===Number(w.category_id))?.emoji||'🛍️')}</span><div><small>${esc((catalogAdminData().categories||[]).find(c=>Number(c.id)===Number(w.category_id))?.title||'دسته')}</small><h3>${esc(w.name||'نام سرویس')}</h3><p class="muted">${esc(w.description||'بدون توضیح')}</p></div></header>${gs.map(g=>`<div><b>${g.is_default?'پلن‌ها':esc(g.name)}</b>${(g.plans||[]).map(p=>`<span>${esc(p.title)}<small>${fmt(p.price)} ت</small></span>`).join('')||'<em>بدون پلن</em>'}</div>`).join('')}</div>`}
function renderCatalogMobileWizard(){let sheet=$('presentationSheet');if(!sheet){sheet=document.createElement('div');sheet.id='presentationSheet';sheet.className='preview-sheet presentation-sheet';document.body.appendChild(sheet)}sheet.innerHTML=`<div class="presentation-inner mcw-shell"><div class="presentation-header"><button class="ghost" data-mc-close>لغو</button><h3>${mobileCatalogWizard.id?'ویرایش سرویس':'سرویس جدید'}</h3><span class="mcw-step-num">${mobileCatalogStep+1}/5</span></div><div class="mcw-stepper">${[0,1,2,3,4].map(i=>`<span class="${i===mobileCatalogStep?'active':i<mobileCatalogStep?'done':''}">${i<mobileCatalogStep?'✓':i+1}</span>`).join('')}</div><div class="presentation-body mcw-body">${mcStepHtml()}</div><div class="mcw-footer">${mobileCatalogStep>0?'<button class="secondary" data-mc-prev>قبلی</button>':'<span></span>'}${mobileCatalogStep<4?'<button class="primary" data-mc-next>ادامه</button>':`<button class="primary" data-mc-save>${mobileCatalogWizard.id?'✓ ذخیره تغییرات':'🚀 ساخت و انتشار'}</button>`}</div></div>`;sheet.classList.add('open');sheet.querySelector('[data-mc-close]')?.addEventListener('click',()=>closeEdit());sheet.querySelector('[data-mc-prev]')?.addEventListener('click',()=>{mcCollect();mobileCatalogStep=Math.max(0,mobileCatalogStep-1);renderCatalogMobileWizard()});sheet.querySelector('[data-mc-next]')?.addEventListener('click',()=>{mcCollect();const err=mcValidate();if(err)return showStatus(err,'error');mobileCatalogStep=Math.min(4,mobileCatalogStep+1);renderCatalogMobileWizard()});sheet.querySelectorAll('[data-mc-mode]').forEach(b=>b.addEventListener('click',()=>{mcCollect();mobileCatalogWizard.mode=b.dataset.mcMode;if(mobileCatalogWizard.mode==='direct'&&!mobileCatalogWizard.groups.some(g=>g.is_default))mobileCatalogWizard.groups.unshift(mcGroup({is_default:1}));if(mobileCatalogWizard.mode==='grouped'&&!mobileCatalogWizard.groups.some(g=>!g.is_default))mobileCatalogWizard.groups.push(mcGroup({name:'Standard'}));renderCatalogMobileWizard()}));sheet.querySelector('[data-mc-add-group]')?.addEventListener('click',()=>{mcCollect();mobileCatalogWizard.groups.push(mcGroup({name:''}));renderCatalogMobileWizard()});sheet.querySelectorAll('[data-mc-remove-group]').forEach(b=>b.addEventListener('click',()=>{mcCollect();const g=mobileCatalogWizard.groups.find(x=>x.key===b.dataset.mcRemoveGroup);if(g?.id&&!confirm(`زیرسرویس «${g.name}» غیرفعال شود؟`))return;mobileCatalogWizard.groups=mobileCatalogWizard.groups.filter(x=>x.key!==b.dataset.mcRemoveGroup);renderCatalogMobileWizard()}));sheet.querySelectorAll('[data-mc-add-plan]').forEach(b=>b.addEventListener('click',()=>{mcCollect();const g=mobileCatalogWizard.groups.find(x=>x.key===b.dataset.mcAddPlan);if(g)g.plans.push(mcPlan());renderCatalogMobileWizard()}));sheet.querySelectorAll('[data-mc-remove-plan]').forEach(b=>b.addEventListener('click',()=>{mcCollect();const g=mobileCatalogWizard.groups.find(x=>x.key===b.dataset.groupKey),p=g?.plans.find(x=>x.key===b.dataset.mcRemovePlan);if(p?.id&&!confirm(`پلن «${p.title}» غیرفعال شود؟`))return;if(g)g.plans=g.plans.filter(x=>x.key!==b.dataset.mcRemovePlan);renderCatalogMobileWizard()}));sheet.querySelector('[data-mc-save]')?.addEventListener('click',async()=>{mcCollect();for(const st of [0,2,3]){const err=mcValidate(st);if(err){mobileCatalogStep=st;renderCatalogMobileWizard();showStatus(err,'error');return}}const bp=JSON.parse(JSON.stringify(mobileCatalogWizard));bp.groups=(bp.groups||[]).map(g=>{delete g.key;g.plans=(g.plans||[]).map(p=>{delete p.key;return p});return g});const ok=await adminAction('admin_catalog_save_blueprint',{blueprint:JSON.stringify(bp)});if(ok){try{localStorage.removeItem(`bg_mcw_${bp.id||'new'}`)}catch(_){}}})}
function openCatalogMobileCategory(id=0){const c=(catalogAdminData().categories||[]).find(x=>Number(x.id)===Number(id))||{};openEdit(id?`ویرایش ${c.title}`:'دسته جدید',[{title:'دسته فروشگاه',fields:[{id:'mcc_title',label:'نام دسته',value:c.title||''},{id:'mcc_emoji',label:'ایموجی',value:c.emoji||'🛍️'},{id:'mcc_img',label:'لینک تصویر',value:c.image_url||''},{id:'mcc_sort',label:'ترتیب',type:'number',value:c.sort_order||0},{id:'mcc_active',label:'فعال باشد؟',type:'checkbox',value:id?Number(c.is_active):1}]}],async()=>adminAction('admin_catalog_save_category',{id,title:val('mcc_title'),emoji:val('mcc_emoji'),image_url:val('mcc_img'),sort_order:val('mcc_sort'),is_active:val('mcc_active')?1:0}))}
function openCatalogMobileOrganizer(){openEdit('مرتب‌سازی و انتقال',[{title:'انتقال زیرسرویس',fields:[{id:'mco_group',label:'زیرسرویس',type:'select',options:catalogGroupOptions()},{id:'mco_service',label:'سرویس مقصد',type:'select',options:catalogServiceOptions()}]},{title:'انتقال پلن',fields:[{id:'mco_plan',label:'پلن',type:'select',options:catalogPlanOptions()},{id:'mco_target_group',label:'زیرسرویس مقصد',type:'select',options:catalogGroupOptions()}]}],async()=>{if(val('mco_group')&&val('mco_service'))await api('admin_catalog_move_group',{group_id:val('mco_group'),service_id:val('mco_service')});if(val('mco_plan')&&val('mco_target_group'))await api('admin_catalog_move_plan',{plan_id:val('mco_plan'),group_id:val('mco_target_group')});adminState=await api('admin_summary');renderAdmin();showStatus('ساختار بروزرسانی شد')})}
async function catalogMobileUndo(){if(!confirm('آخرین تغییر کاتالوگ برگردانده شود؟'))return;return adminAction('admin_catalog_undo',{})}
async function catalogMobilePreview(){await adminAction('admin_catalog_preview',{})}
async function catalogMobileApply(){if(confirm('موارد مطمئن به کاتالوگ جدید منتقل شوند؟ چیزی حذف نمی‌شود.'))await adminAction('admin_catalog_apply',{confirm:'APPLY'})}
async function catalogMobileApplyOne(id){if(confirm('این محصول قدیمی مرتب شود؟'))await adminAction('admin_catalog_apply_one',{legacy_product_id:id,confirm:'APPLY'})}
function openCatalogMoveGroup(){return openCatalogMobileOrganizer()}
function openCatalogMovePlan(){return openCatalogMobileOrganizer()}
function openCatalogFast(){openEdit('ساخت سریع سرویس',[{title:'اطلاعات سرویس',fields:[{id:'mcf_name',label:'نام سرویس',placeholder:'مثلاً BluePing'},{id:'mcf_cat',label:'دسته فروشگاه',type:'select',options:catalogCategoryOptions()},{id:'mcf_desc',label:'توضیح کوتاه',type:'textarea',placeholder:'توضیح سرویس'}]},{title:'ساختار سریع',fields:[{id:'mcf_groups',label:'هر زیرسرویس یک خط',type:'textarea',placeholder:'Standard: 20GB=99000, 30GB=149000\nPro: 10GB=149000, 20GB=249000'}]}],async()=>adminAction('admin_catalog_fast_create',{service_name:val('mcf_name'),category_id:val('mcf_cat'),description:val('mcf_desc'),groups_text:val('mcf_groups')}))}
function openCatalogAddService(){return openCatalogMobileWizard(0)}
function openCatalogAddGroup(){return openCatalogMobileOrganizer()}
function openCatalogAddPlan(){return openCatalogMobileOrganizer()}

function renderAdminProducts(){const prods=adminState.products||[];return `<div style="display:flex;gap:12px;margin-bottom:16px;padding:0 4px"><button class="primary" style="flex:2" onclick="if(typeof haptic==='function')haptic('light');openAddProduct()">➕ محصول جدید</button><button class="secondary" style="flex:1;white-space:nowrap" data-export-products-csv>📥 CSV</button></div>`+prods.map((p,i)=>`<div class="admin-item product-list-item"><div class="admin-item-head"><div class="reorder-btns"><button class="ghost reorder-btn" data-reorder="product:${p.id}:up" ${i===0?'disabled':''}>▲</button><button class="ghost reorder-btn" data-reorder="product:${p.id}:down" ${i===prods.length-1?'disabled':''}>▼</button></div><div class="admin-item-thumb" data-admin-action-sheet="product:${p.id}" style="cursor:pointer">${p.image_url?`<img src="${esc(p.image_url)}" alt="">`:'<span>🛒</span>'}</div><div class="admin-item-main" data-admin-action-sheet="product:${p.id}" style="cursor:pointer"><h4>${esc(p.name)} <span class="admin-id-badge">#${nf(p.id)}</span></h4><p class="muted">${p.parent_name?esc(p.parent_name)+' → ':''}${esc(p.product_type||'normal')} · ${priceAdminSummary(p)} · ${Number(p.is_active)?'<span class="chip-mini chip-active">فعال</span>':'<span class="chip-mini chip-off">غیرفعال</span>'} ${Number(p.is_featured)?'<span class="chip-mini chip-featured">ویژه</span>':''} · موجودی: ${nf(p.inventory_available||0)}</p></div></div></div>`).join('')}
function renderAdminCategories(){const cats=adminState.categories||[];return `<div style="display:flex;margin-bottom:16px;padding:0 4px"><button class="primary" style="flex:1" onclick="if(typeof haptic==='function')haptic('light');openAddCategory()">➕ دسته‌بندی جدید</button></div>`+cats.map((c,i)=>`<div class="admin-item category-list-item"><div class="admin-item-head"><div class="reorder-btns"><button class="ghost reorder-btn" data-reorder="category:${c.id}:up" ${i===0?'disabled':''}>▲</button><button class="ghost reorder-btn" data-reorder="category:${c.id}:down" ${i===cats.length-1?'disabled':''}>▼</button></div><div class="admin-item-thumb emoji-thumb" data-admin-action-sheet="category:${c.id}" style="cursor:pointer"><span>${esc(c.emoji||'🛒')}</span></div><div class="admin-item-main" data-admin-action-sheet="category:${c.id}" style="cursor:pointer"><h4>${esc(c.title)} <span class="admin-id-badge">#${nf(c.id)}</span></h4><p class="muted">${Number(c.is_active)?'<span class="chip-mini chip-active">فعال</span>':'<span class="chip-mini chip-off">غیرفعال</span>'} · ترتیب: ${nf(c.sort_order)}</p></div></div></div>`).join('')}
let variantExpandedProducts = new Set();
function toggleVariantProduct(pid, targetEl){pid=Number(pid);if(variantExpandedProducts.has(pid))variantExpandedProducts.delete(pid);else variantExpandedProducts.add(pid);const card=targetEl?targetEl.closest('.accordion-card'):document.querySelector(`.accordion-card[data-accordion="${pid}"]`);if(card){card.classList.toggle('expanded',variantExpandedProducts.has(pid));if(typeof tg!=='undefined'&&tg?.HapticFeedback)tg.HapticFeedback.selectionChanged()}else{renderAdmin()}}
function renderAdminVariants(){
  const addForm = `<div style="display:flex;margin-bottom:16px;padding:0 4px"><button class="primary" style="flex:1" onclick="if(typeof haptic==='function')haptic('light');openAddVariant()">➕ پلن جدید</button></div>`;
  const allVariants = adminState.variants || [];
  const allProducts = adminState.products || [];
  if(!allVariants.length && !allProducts.length){
    return addForm + `<article class="admin-card empty-state-card"><div class="empty-illustration">📦</div><h3>هنوز محصولی نساخته‌ای</h3><p class="muted">اول از تب «محصولات» یک محصول بساز، بعد اینجا برایش پلن اضافه کن.</p></article>`;
  }
  // Group variants by product_id
  const byProduct = new Map();
  for(const v of allVariants){
    const pid = Number(v.product_id);
    if(!byProduct.has(pid)) byProduct.set(pid, []);
    byProduct.get(pid).push(v);
  }
  // Build list: products that have variants first (sorted by variant count desc), then products without variants
  const productsWithVariants = allProducts.filter(p => byProduct.has(Number(p.id)))
    .sort((a,b) => (byProduct.get(Number(b.id)).length) - (byProduct.get(Number(a.id)).length));
  const productsWithoutVariants = allProducts.filter(p => !byProduct.has(Number(p.id)) && Number(p.is_active));
  // Orphan variants (product deleted) — show in a separate section
  const orphanPids = [...byProduct.keys()].filter(pid => !allProducts.some(p => Number(p.id) === pid));
  const orphanVariants = orphanPids.flatMap(pid => byProduct.get(pid).map(v => ({...v, _orphan: true})));
  let accordionHtml = '';
  if(productsWithVariants.length){
    accordionHtml += `<div class="admin-accordion-group" data-accordion-group>`;
    for(const p of productsWithVariants){
      const pid = Number(p.id);
      const variants = byProduct.get(pid);
      const activeCount = variants.filter(v => Number(v.is_active)).length;
      const totalDuration = variants.reduce((s,v) => s + (Number(v.duration_days)||0), 0);
      const expanded = variantExpandedProducts.has(pid);
      const minPrice = variants.reduce((m,v) => Math.min(m, Number(v.price)||0), Infinity);
      const maxPrice = variants.reduce((m,v) => Math.max(m, Number(v.price)||0), 0);
      const priceRange = minPrice === Infinity ? '—' : (minPrice === maxPrice ? fmt(minPrice) : `${fmt(minPrice)} – ${fmt(maxPrice)}`);
      accordionHtml += `<article class="accordion-card ${expanded?'expanded':''}" data-accordion="${pid}">
        <header class="accordion-header" data-accordion-toggle="${pid}">
          <div class="accordion-product-info">
            <div class="accordion-product-thumb">${p.image_url?`<img src="${esc(p.image_url)}" alt="">`:`<span>${esc(p.emoji||(p.category_emoji||'📦'))}</span>`}</div>
            <div class="accordion-product-meta">
              <h4>${esc(p.name)}</h4>
              <p class="muted">
                <span class="chip-mini chip-count">${nf(variants.length)} پلن</span>
                <span class="chip-mini chip-active">${nf(activeCount)} فعال</span>
                <span class="chip-mini chip-price">${priceRange}</span>
                ${!Number(p.is_active)?'<span class="chip-mini chip-off">غیرفعال</span>':''}
              </p>
            </div>
          </div>
          <span class="accordion-chevron" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </span>
        </header>
        <div class="accordion-body">
          <div class="accordion-body-inner">
            ${variants.map(v => variantItemHtml(v)).join('')}
            <button class="secondary wide" data-accordion-add-variant="${pid}" style="margin-top:10px;border-radius:12px;font-weight:600">➕ افزودن پلن جدید برای ${esc(p.name)}</button>
          </div>
        </div>
      </article>`;
    }
    accordionHtml += `</div>`;
  }
  if(productsWithoutVariants.length){
    accordionHtml += `<article class="admin-card no-variants-card">
      <div class="admin-card-head"><span class="admin-card-icon">💤</span><div><h3>محصولات بدون پلن</h3><p class="muted">این محصولات هنوز پلن قیمت‌گذاری ندارند. روی دکمه بزن تا مستقیم پلن اضافه کنی.</p></div></div>
      <div class="no-variants-list">
        ${productsWithoutVariants.map(p => `<div class="no-variant-row"><div><b>${esc(p.name)}</b><span class="muted">${priceAdminSummary(p)}</span></div><button class="secondary" data-accordion-add-variant="${p.id}">➕ افزودن پلن</button></div>`).join('')}
      </div>
    </article>`;
  }
  if(orphanVariants.length){
    accordionHtml += `<article class="admin-card warning-card">
      <div class="admin-card-head"><span class="admin-card-icon">⚠️</span><div><h3>پلن‌های یتیم</h3><p class="muted">محصول این پلن‌ها حذف شده. می‌توانید آن‌ها را به محصول دیگری منتقل یا حذف کنید.</p></div></div>
      ${orphanVariants.map(v => variantItemHtml(v)).join('')}
    </article>`;
  }
  return addForm + accordionHtml;
}
function variantItemHtml(v){
  return `<div class="admin-item variant-list-item" data-admin-action-sheet="variant:${v.id}" style="cursor:pointer;margin-bottom:8px">
    <div class="admin-item-head">
      <div class="admin-item-thumb emoji-thumb"><span>📐</span></div>
      <div class="admin-item-main">
        <h4>${esc(v.title)} <span class="admin-id-badge">#${nf(v.id)}</span></h4>
        <p class="muted">${priceAdminSummary(v)} ${Number(v.discount_percent)>0?`<span class="chip-mini chip-featured">تخفیف: ${nf(v.discount_percent)}٪</span> `:''}· ${Number(v.is_active)?'<span class="chip-mini chip-active">فعال</span>':'<span class="chip-mini chip-off">غیرفعال</span>'} · مدت: ${nf(v.duration_days)} روز</p>
      </div>
      <span class="chev" style="font-size:20px;color:var(--muted);align-self:center">‹</span>
    </div>
  </div>`;
}
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
            <div class="kanban-card-title">${esc(o.display_name)}</div>
            <div class="kanban-card-meta">
              <span>👤 ${esc(o.username ? '@' + o.username : 'کاربر')}</span>
              <span>📅 ${esc(String(o.created_at || '').slice(0, 16))}</span>
              ${o.receipt_file_id ? '<span>🖼 دارای رسید عکس</span>' : ''}
              <span style="color:var(--accent);margin-top:4px">وضعیت: ${esc(o.status_fa || o.status)}</span>
            </div>
          </div>`).join('');
      }
      html += `</div>`;
    }
    html+=`</div>`;
  }else{
    html+=(visibleOrders.map(o=>`<div class="admin-item order-admin-item"><div class="admin-item-head"><input type="checkbox" class="bulk-check" data-bulk-check="${o.id}" ${selectedOrderIds.has(Number(o.id))?'checked':''}><div class="admin-item-thumb" data-admin-action-sheet="order:${o.id}" style="cursor:pointer">${o.image_url?`<img src="${esc(o.image_url)}" alt="">`:'<span>🧾</span>'}</div><div class="admin-item-main" data-admin-action-sheet="order:${o.id}" style="cursor:pointer"><h4>#${nf(o.id)} ${esc(o.display_name)} <span class="admin-id-badge">${esc(o.status_fa||o.status)}</span></h4><p class="muted">${fmt(o.final_amount)} · ${esc(o.created_at||'')}${o.payment_method_fa?' · '+esc(o.payment_method_fa):''}${o.receipt_file_id?' · <span class="chip-mini chip-active">🖼 رسید عکس</span>':''}${o.username?' · @'+esc(o.username):''}</p></div></div></div>`).join('')||'<p class="muted">سفارشی نیست.</p>');
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
  if(!confirm('Restore کل دیتابیس فعلی را جایگزین می‌کند. ادامه می‌دهی؟'))return;
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

function deleteSpinReward(index) {
  if(!confirm('این جایزه از لیست گردونه حذف شود؟')) return;
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

function editProduct(id){
  const p=adminState.products.find(x=>Number(x.id)===Number(id));
  if(!p)return;
  const cur = p.price_currency || adminState?.settings?.default_base_currency || 'USDT';
  const initialAmt = (cur === 'USDT' || cur === 'USD' || cur === 'STARS') ? (p.price_usd || 0) : (p.price || 0);
  openEdit(`ویرایش محصول #${id}`,[
    {title:'اطلاعات اصلی',fields:[{id:'ep_name',label:'نام محصول',value:p.name},{id:'ep_type',label:'نوع محصول',type:'select',options:productTypeOptions(p.product_type)},{id:'ep_parent',label:'محصول مادر',type:'select',options:parentProductOptions(p.parent_id,p.id)},{id:'ep_cat',label:'دسته‌بندی',type:'select',options:catOptions(p.category_id)},{id:'ep_delivery',label:'نوع تحویل',type:'select',options:`<option value="manual">دستی</option><option value="account">اکانت</option><option value="vpn">VPN / لینک ساب</option><option value="code">کد</option><option value="file">فایل/متن</option>`}]},
    {title:'قیمت‌گذاری',fields:[
      {id:'ep_currency',label:'ارز پایه',type:'select',options:currencyOptions(cur)},
      {id:'ep_price_amount',label:'قیمت',type:'number',props:'inputmode="decimal"',value:initialAmt},
      {html:'<div id="ep_price_hint" class="price-hint-badge" style="grid-column:1/-1;padding:8px 12px;background:rgba(29,155,240,0.1);border-radius:10px;font-size:14.5px;color:var(--text);margin-top:-4px"></div>'},
      {id:'ep_commission_type',label:'نوع پورسانت',type:'select',options:`<option value="none">بدون پورسانت</option><option value="fixed">مبلغ ثابت</option><option value="percent">درصدی</option>`},
      {id:'ep_commission_value',label:'مقدار پورسانت',value:p.commission_value||0},
      {id:'ep_duration',label:'مدت روز',type:'number',value:p.duration_days||0}
    ]},
    {title:'تنظیمات پیشرفته',fields:[{id:'ep_img',label:'لینک عکس',value:p.image_url||''},{id:'ep_active',label:'فعال باشد؟',type:'checkbox',value:Number(p.is_active)},{id:'ep_featured',label:'ویژه باشد؟',type:'checkbox',value:Number(p.is_featured)},{id:'ep_short',label:'توضیح کوتاه',type:'textarea',value:p.short_description||''},{id:'ep_full',label:'توضیح کامل',type:'textarea',value:p.full_description||''}]}
  ],async()=>{
    const c = val('ep_currency');
    const a = Number(val('ep_price_amount')||0);
    await adminAction('admin_update_product',{
      product_id:id,
      name:val('ep_name'),
      price_currency:c,
      price: (c==='IRR'||c==='IRT')?a:0,
      price_usd: (c==='USDT'||c==='USD'||c==='STARS')?a:0,
      category_id:val('ep_cat'),
      parent_id:val('ep_parent'),
      product_type:val('ep_type'),
      delivery_type:val('ep_delivery'),
      commission_type:val('ep_commission_type'),
      commission_value:val('ep_commission_value'),
      duration_days:val('ep_duration'),
      image_url:val('ep_img'),
      is_active:val('ep_active')?1:0,
      is_featured:val('ep_featured')?1:0,
      short_description:val('ep_short'),
      full_description:val('ep_full')
    });
  });
  setTimeout(()=>{
    if($('ep_delivery'))$('ep_delivery').value=p.delivery_type;
    if($('ep_commission_type'))$('ep_commission_type').value=p.commission_type||'none';
    setupPricingFormListeners('ep');
  },50);
}
function editCategory(id){const c=adminState.categories.find(x=>Number(x.id)===Number(id));if(!c)return;openEdit(`ویرایش دسته #${id}`,[{title:'اطلاعات دسته',fields:[{id:'ec_title',label:'نام دسته',value:c.title},{id:'ec_emoji',label:'اموجی',value:c.emoji||''},{id:'ec_img',label:'لینک عکس',value:c.image_url||''},{id:'ec_sort',label:'ترتیب نمایش',type:'number',value:c.sort_order||0},{id:'ec_active',label:'فعال باشد؟',type:'checkbox',value:Number(c.is_active)}]}],async()=>adminAction('admin_update_category',{category_id:id,title:val('ec_title'),emoji:val('ec_emoji'),image_url:val('ec_img'),sort_order:val('ec_sort'),is_active:val('ec_active')?1:0}))}
function editVariant(id){
  const v=adminState.variants.find(x=>Number(x.id)===Number(id));
  if(!v)return;
  const cur = v.price_currency || adminState?.settings?.default_base_currency || 'USDT';
  const initialAmt = (cur === 'USDT' || cur === 'USD' || cur === 'STARS') ? (v.price_usd || 0) : (v.price || 0);
  openEdit(`ویرایش پلن #${id}`,[
    {title:'اطلاعات پلن',fields:[
      {id:'ev_title',label:'نام پلن',value:v.title},
      {id:'ev_currency',label:'ارز پایه',type:'select',options:currencyOptions(cur)},
      {id:'ev_price_amount',label:'قیمت',type:'number',props:'inputmode="decimal"',value:initialAmt},
      {html:'<div id="ev_price_hint" class="price-hint-badge" style="grid-column:1/-1;padding:8px 12px;background:rgba(29,155,240,0.1);border-radius:10px;font-size:14.5px;color:var(--text);margin-top:-4px"></div>'},
      {id:'ev_duration',label:'مدت روز',type:'number',value:v.duration_days||0},
      {id:'ev_discount',label:'درصد تخفیف',type:'number',props:'inputmode="decimal" step="any"',value:v.discount_percent||0},
      {id:'ev_description',label:'توضیحات اختصاصی پلن',type:'textarea',placeholder:'توضیحات کامل این پلن (در پاپ‌آپ کاربر نمایش داده می‌شود)...',value:v.description||''},
      {id:'ev_sort',label:'ترتیب نمایش',type:'number',value:v.sort_order||0},
      {id:'ev_active',label:'فعال باشد؟',type:'checkbox',value:Number(v.is_active)}
    ]}
  ],async()=>{
    const c = val('ev_currency');
    const a = Number(val('ev_price_amount')||0);
    await adminAction('admin_update_variant',{
      variant_id:id,
      title:val('ev_title'),
      price_currency:c,
      price: (c==='IRR'||c==='IRT')?a:0,
      price_usd: (c==='USDT'||c==='USD'||c==='STARS')?a:0,
      duration_days:val('ev_duration'),
      discount_percent:val('ev_discount'),
      description:val('ev_description'),
      sort_order:val('ev_sort'),
      is_active:val('ev_active')?1:0
    });
  });
  setTimeout(()=>{ setupPricingFormListeners('ev'); }, 50);
}
function openAddProduct(){
  const defCur = adminState?.settings?.default_base_currency || 'USDT';
  openEdit('افزودن محصول جدید',[
    {title:'اطلاعات اصلی',fields:[{id:'ap_name',label:'نام محصول',placeholder:'مثلاً: اکانت پرمیوم اسپاتیفای'},{id:'ap_type',label:'نوع محصول',type:'select',options:productTypeOptions('normal')},{id:'ap_parent',label:'محصول مادر',type:'select',options:parentProductOptions()},{id:'ap_cat',label:'دسته‌بندی',type:'select',options:catOptions()},{id:'ap_delivery',label:'نوع تحویل',type:'select',options:`<option value="manual">دستی</option><option value="account">اکانت</option><option value="vpn">VPN / لینک ساب</option><option value="code">کد</option><option value="file">فایل/متن</option>`}]},
    {title:'قیمت‌گذاری',fields:[
      {id:'ap_currency',label:'ارز پایه',type:'select',options:currencyOptions(defCur)},
      {id:'ap_price_amount',label:'قیمت',type:'number',props:'inputmode="decimal"',value:0},
      {html:'<div id="ap_price_hint" class="price-hint-badge" style="grid-column:1/-1;padding:8px 12px;background:rgba(29,155,240,0.1);border-radius:10px;font-size:14.5px;color:var(--text);margin-top:-4px"></div>'},
      {id:'ap_commission_type',label:'نوع پورسانت',type:'select',options:`<option value="none" selected>بدون پورسانت</option><option value="fixed">مبلغ ثابت</option><option value="percent">درصدی</option>`},
      {id:'ap_commission_value',label:'مقدار پورسانت',value:0},
      {id:'ap_duration',label:'مدت روز',type:'number',value:0}
    ]},
    {title:'تنظیمات پیشرفته',fields:[{id:'ap_img',label:'لینک عکس',placeholder:'https://...'},{id:'ap_featured',label:'ویژه باشد؟',type:'checkbox',value:0},{id:'ap_short',label:'توضیح کوتاه',type:'textarea'},{id:'ap_full',label:'توضیح کامل',type:'textarea'}]}
  ],async()=>{
    const c = val('ap_currency');
    const a = Number(val('ap_price_amount')||0);
    await adminAction('admin_add_product',{
      name:val('ap_name'),
      price_currency:c,
      price: (c==='IRR'||c==='IRT')?a:0,
      price_usd: (c==='USDT'||c==='USD'||c==='STARS')?a:0,
      category_id:val('ap_cat'),
      parent_id:val('ap_parent'),
      product_type:val('ap_type'),
      delivery_type:val('ap_delivery'),
      commission_type:val('ap_commission_type'),
      commission_value:val('ap_commission_value'),
      duration_days:val('ap_duration'),
      image_url:val('ap_img'),
      is_featured:val('ap_featured')?1:0,
      short_description:val('ap_short'),
      full_description:val('ap_full')
    });
  });
  setTimeout(()=>{ setupPricingFormListeners('ap'); }, 50);
}
function openAddCategory(){openEdit('افزودن دسته جدید',[{title:'اطلاعات دسته',fields:[{id:'ac_title',label:'نام دسته'},{id:'ac_emoji',label:'اموجی',placeholder:'🛒'},{id:'ac_img',label:'لینک عکس'},{id:'ac_sort',label:'ترتیب نمایش',type:'number',value:0}]}],async()=>adminAction('admin_add_category',{title:val('ac_title'),emoji:val('ac_emoji'),image_url:val('ac_img'),sort_order:val('ac_sort')}))}
function openAddVariant(productId){
  const defCur = adminState?.settings?.default_base_currency || 'USDT';
  openEdit('افزودن پلن جدید',[
    {title:'اطلاعات پلن',fields:[
      {id:'av_product',label:'محصول والد',type:'select',options:productOptions(productId)},
      {id:'av_title',label:'نام پلن'},
      {id:'av_currency',label:'ارز پایه',type:'select',options:currencyOptions(defCur)},
      {id:'av_price_amount',label:'قیمت',type:'number',props:'inputmode="decimal"',value:0},
      {html:'<div id="av_price_hint" class="price-hint-badge" style="grid-column:1/-1;padding:8px 12px;background:rgba(29,155,240,0.1);border-radius:10px;font-size:14.5px;color:var(--text);margin-top:-4px"></div>'},
      {id:'av_duration',label:'مدت روز',type:'number',value:0},
      {id:'av_discount',label:'درصد تخفیف',type:'number',props:'inputmode="decimal" step="any"',value:0},
      {id:'av_description',label:'توضیحات اختصاصی پلن',type:'textarea',placeholder:'توضیحات کامل این پلن (در پاپ‌آپ کاربر نمایش داده می‌شود)...'},
      {id:'av_sort',label:'ترتیب نمایش',type:'number',value:0}
    ]}
  ],async()=>{
    const c = val('av_currency');
    const a = Number(val('av_price_amount')||0);
    await adminAction('admin_add_variant',{
      product_id:val('av_product'),
      title:val('av_title'),
      price_currency:c,
      price: (c==='IRR'||c==='IRT')?a:0,
      price_usd: (c==='USDT'||c==='USD'||c==='STARS')?a:0,
      duration_days:val('av_duration'),
      discount_percent:val('av_discount'),
      description:val('av_description'),
      sort_order:val('av_sort')
    });
  });
  setTimeout(()=>{ setupPricingFormListeners('av'); }, 50);
}
function openAddCoupon(){openEdit('افزودن کد تخفیف',[{title:'اطلاعات کد',fields:[{id:'acp_code',label:'کد تخفیف',placeholder:'مثلا BLUE10'},{id:'acp_type',label:'نوع تخفیف',type:'select',options:`<option value="percent" selected>درصدی (٪)</option><option value="fixed">مبلغ ثابت (تومان)</option>`},{id:'acp_value',label:'مقدار (درصد یا تومان)',type:'number',props:'inputmode="numeric"',value:0},{id:'acp_min',label:'حداقل مبلغ سفارش (تومان)',type:'number',props:'inputmode="numeric"',value:0,placeholder:'۰ = بدون حداقل'},{id:'acp_max',label:'کل سقف استفاده جهانی',type:'number',props:'inputmode="numeric"',value:0,placeholder:'۰ = نامحدود'},{id:'acp_per_user',label:'سقف استفاده برای هر کاربر',type:'number',props:'inputmode="numeric"',value:1},{id:'acp_cat',label:'محدودیت دسته‌بندی (اختیاری)',type:'select',options:catOptions()},{id:'acp_expires',label:'تاریخ انقضا',type:'datetime-local'}]}],async()=>adminAction('admin_add_coupon',{code:val('acp_code'),discount_type:val('acp_type'),discount_value:val('acp_value'),min_order_amount:val('acp_min'),max_uses:val('acp_max'),max_uses_per_user:val('acp_per_user'),category_id:val('acp_cat'),expires_at:val('acp_expires')}))}
function openAddInventory(){openEdit('افزودن انبار',[{title:'جزئیات آیتم',fields:[{id:'ai_product',label:'محصول مرتبط',type:'select',options:productOptions()},{id:'ai_variant',label:'پلن مرتبط',type:'select',options:variantOptions()},{id:'ai_content',label:'محتوای آیتم',type:'textarea',placeholder:'هر آیتم یک خط؛ ایمیل/پسورد، لینک ساب، کد یا متن آماده'}]}],async()=>adminAction('admin_add_inventory',{product_id:val('ai_product'),variant_id:val('ai_variant'),content:val('ai_content')}))}
function editInventory(id){const i=adminState.inventory.find(x=>Number(x.id)===Number(id));if(!i)return;openEdit(`ویرایش آیتم انبار #${id}`,[{title:'جزئیات آیتم',fields:[{id:'ei_product',label:'محصول مرتبط',type:'select',options:productOptions(i.product_id)},{id:'ei_variant',label:'پلن مرتبط',type:'select',options:variantOptions(i.variant_id)},{id:'ei_status',label:'وضعیت فروش',type:'select',options:`<option value="available" ${i.status==='available'?'selected':''}>available</option><option value="reserved" ${i.status==='reserved'?'selected':''}>reserved</option><option value="delivered" ${i.status==='delivered'?'selected':''}>delivered</option><option value="disabled" ${i.status==='disabled'?'selected':''}>disabled</option>`},{id:'ei_content',label:'محتوای آیتم',type:'textarea',value:i.content||''}]}],async()=>adminAction('admin_update_inventory',{inventory_id:id,product_id:val('ei_product'),variant_id:val('ei_variant'),status:val('ei_status'),content:val('ei_content')}))}
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
  if(b.dataset.builderDel){const [type,idx]=b.dataset.builderDel.split(':'); const i=Number(idx); if(!confirm('این مورد حذف شود؟'))return; if(type==='card')adminUiCards.splice(i,1); if(type==='wallet')adminUiWallets.splice(i,1); if(type==='rate')adminUiRates.splice(i,1); syncPaymentBuilders(); showStatus('حذف شد'); return; }
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

    await loadAfterAction('submit_receipt', {
      order_id: oid,
      note: note || 'رسید واریز کارت به کارت',
      receipt_b64: b64 || ''
    });
    currentTab = 'orders';
    currentOrderId = oid;
    renderUser();
    showStatus('رسید با موفقیت ثبت شد و در صف بررسی قرار گرفت ⚡');
    return;
  }
  const cartBtn = e.target.closest('#cartFab, .cart-fab');
  if(cartBtn){
    if(typeof haptic === 'function') haptic('light');
    openCartSheet();
    return;
  }
  const t=e.target.closest('button,a,[data-admin-tab],[data-settings-subtab],[data-wallet-tab],[data-admin-view-mode],[data-admin-action-sheet],[data-tab],[data-tab-jump],[data-color],[data-cat],[data-shop-sort],[data-shop-toggle],[data-clear-filters],[data-product],[data-product-preview],[data-back-shop],[data-variant-details],[data-wallet-order],[data-select-card],[data-pay-stars],[data-select-crypto],[data-select-crypto-tab],[data-reset-payment-method],[data-show-crypto],[data-crypto-hash],[data-check-crypto],[data-bulk-action],[data-reorder],[data-chat-user],[data-edit-role],[data-admin-remove-role],[data-contact-wallet],[data-contact-ban],[data-edit-product],[data-admin-toggle-product],[data-admin-delete-product],[data-admin-hard-delete-product],[data-edit-category],[data-admin-delete-category],[data-admin-hard-delete-category],[data-edit-variant],[data-admin-delete-variant],[data-admin-hard-delete-variant],[data-edit-inventory],[data-admin-delete-inventory],[data-admin-hard-delete-inventory],[data-admin-status],[data-admin-order-note],[data-admin-archive-order],[data-admin-delete-order],[data-admin-cleanup],[data-admin-deliver],[data-admin-service],[data-service-view],[data-service-copy-link],[data-view-receipt],[data-admin-save-settings],[data-open-url],[data-copy],[data-receipt],[data-customer-note],[data-order-filter],[data-order-open],[data-order-back],[data-hide-order],[data-clear-canceled],[data-cancel],[data-refresh-crypto-rates],[data-admin-backup-create],[data-admin-backup-sendbot],[data-admin-backup-delete],[data-admin-backup-restore-server],[data-admin-backup-upload],[data-admin-load-more-orders],[data-accordion-toggle],[data-accordion-add-variant],[data-edit-coupon],[data-admin-toggle-coupon],[data-admin-delete-coupon]')||e.target;if(t.dataset.serviceView){openDirectServiceViewer(t.dataset.serviceView,t.dataset.serviceUrl||'',t.dataset.serviceTitle||'مدیریت سرویس');return}if(t.dataset.serviceCopyLink){copyMiniServiceUrl(t.dataset.serviceCopyLink,t.dataset.serviceUrl||'');return}if(t.dataset.variantDetails){const [pid,vid]=t.dataset.variantDetails.split(':');openVariantDetails(pid,vid);return}if(t.dataset.settingsSubtab){if(typeof haptic==='function')haptic('light');settingsSubTab=t.dataset.settingsSubtab;document.querySelectorAll('.settings-subtab-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.settingsSubtab===settingsSubTab));document.querySelectorAll('.settings-subtab-pane').forEach(pane=>pane.classList.toggle('hidden',pane.dataset.pane!==settingsSubTab));const settingsTabLabels = { general: '🏪 عمومی', payments: '💳 روش‌های پرداخت', crypto: '🪙 کریپتو & ارزها', appearance: '🎨 ظاهر & تم', gamification: '🎡 پاداش & گردونه' };const lbl=$('activeSettingsTabLabel');if(lbl)lbl.textContent=settingsTabLabels[settingsSubTab]||'';const muted=$('activeSettingsTabMuted');if(muted)muted.textContent=settingsTabLabels[settingsSubTab]||'';return}if(t.dataset.walletTab){haptic('light');walletTab=t.dataset.walletTab;renderWallet();return}if(t.dataset.adminViewMode){adminOrderViewMode=t.dataset.adminViewMode;renderAdmin();return}if(t.dataset.adminActionSheet){const [type,id]=t.dataset.adminActionSheet.split(':');openAdminActionSheet(type,id);return}if(t.dataset.tab){setTab(t.dataset.tab)}if(t.dataset.tabJump){setTab(t.dataset.tabJump)}if(t.id==='openPalette'||t.id==='paletteQuick'){openPalettePopup()}if(t.id==='editMiniProfile'||t.id==='editMiniProfile2'){openMiniProfileEditor();return}if(t.id==='miniChangeEmailBtn'||t.id==='miniChangeEmailInlineBtn'){closeEdit();openMiniEmailChangeFlow();return}if(t.id==='changeMiniPassword'){openMiniPasswordEditor();return}if(t.id==='shareInviteHome'){const link=state.user?.referral_link||'';if(link){if(TG?.openTelegramLink)TG.openTelegramLink('https://t.me/share/url?url='+encodeURIComponent(link));else navigator.clipboard?.writeText(link);showStatus('لینک دعوت آماده اشتراک است')}return}if(t.id==='miniReferralJump'){walletTab='overview';setTab('wallet');return}if(t.id==='miniSupportBtn'){const u=String(state.support_username||'BlueGateSupport').replace(/^@/,'');if(TG?.openTelegramLink)TG.openTelegramLink('https://t.me/'+u);else window.open('https://t.me/'+u,'_blank');return}if(t.dataset.color){localStorage.setItem('blue_ref_color',t.dataset.color);applyTheme({...state,theme_color:t.dataset.color});showStatus('رنگ تغییر کرد')}if(t.id==='resetColor'){localStorage.removeItem('blue_ref_color');applyTheme(state);showStatus('رنگ پیش‌فرض برگشت')}if(t.id==='applyCustomColor'){const c=$('userCustomColor')?.value||'#1d9bf0';localStorage.setItem('blue_ref_color',c);applyTheme({...state,theme_color:c});showStatus('رنگ دلخواه اعمال شد')}if(t.dataset.cat){activeCategory=t.dataset.cat;document.querySelectorAll('.cat-pill').forEach(el=>el.classList.toggle('active',el.dataset.cat===activeCategory));renderShopSections()}if(t.dataset.shopSort!==undefined){shopSort=t.dataset.shopSort;document.querySelectorAll('[data-shop-sort]').forEach(el=>el.classList.toggle('active',el.dataset.shopSort===shopSort));renderShopSections()}if(t.dataset.shopToggle!==undefined){if(t.dataset.shopToggle==='instock'){shopFilterInStock=!shopFilterInStock;t.textContent=shopFilterInStock?'⚡':'📦'}else if(t.dataset.shopToggle==='featured')shopFilterFeatured=!shopFilterFeatured;else if(t.dataset.shopToggle==='wishlist'){shopFilterWishlist=!shopFilterWishlist;t.textContent=shopFilterWishlist?'❤️':'🤍'}t.classList.toggle('active');renderShopSections()}if(t.dataset.clearFilters!==undefined){searchTerm='';activeCategory='all';shopSort='newest';shopFilterInStock=false;shopFilterFeatured=false;shopFilterWishlist=false;renderShop()}if(t.id==='searchInput')return;if(t.dataset.product)showProduct(t.dataset.product);if(t.dataset.productPreview)showProduct(t.dataset.productPreview);if(t.dataset.backShop!==undefined){currentTab='shop';renderUser()}// BUG-2: [data-buy]/[data-buy-wallet] removed from here — handled exclusively by the capture-phase optimistic handler (avoids double confirm + double API call)
if(t.dataset.walletOrder){openWalletConfirmSheet(t.dataset.walletOrder);return}if(t.dataset.selectCard){await loadAfterAction('select_payment_method',{order_id:t.dataset.selectCard,method:'card',details:{}});currentTab='orders';currentOrderId=t.dataset.selectCard;renderUser();showStatus('کارت به کارت انتخاب شد')}if(t.dataset.selectCryptoTab){await loadAfterAction('select_payment_method',{order_id:t.dataset.selectCryptoTab,method:'crypto',details:{}});currentTab='orders';currentOrderId=t.dataset.selectCryptoTab;renderUser();showStatus('پرداخت رمزارز انتخاب شد');return}if(t.dataset.resetPaymentMethod){const oid=t.dataset.resetPaymentMethod;await loadAfterAction('select_payment_method',{order_id:oid,method:'none',details:{}});const o=orderById(oid);if(o){o.payment_method='';o.payment_method_fa='انتخاب نشده';}currentTab='orders';currentOrderId=oid;renderOrders();showStatus('انتخاب روش پرداخت بازنشانی شد');return}if(t.dataset.payStars){await loadAfterAction('start_stars_invoice',{order_id:t.dataset.payStars});currentTab='orders';currentOrderId=t.dataset.payStars;renderUser();showStatus('فاکتور Stars داخل تلگرام ارسال شد')}if(t.dataset.selectCrypto){const [oid,wid]=t.dataset.selectCrypto.split(':');await loadAfterAction('select_crypto_wallet',{order_id:oid,wallet_id:wid});currentTab='orders';currentOrderId=oid;renderUser();showStatus('کیف پول رمزارز انتخاب شد')}if(t.dataset.showCrypto){showStatus('کمی پایین‌تر کیف پول رمزارز را انتخاب کن')}if(t.dataset.cryptoHash){openDialog('ثبت TXID / Hash',`هش تراکنش رمزارز سفارش #${t.dataset.cryptoHash} را وارد کن.`, 'TXID / Hash', async(txt)=>{await loadAfterAction('submit_crypto_hash',{order_id:t.dataset.cryptoHash,tx_hash:txt});currentTab='orders';currentOrderId=t.dataset.cryptoHash;renderUser();showStatus('هش ثبت شد و در صف بررسی قرار گرفت')})}if(t.dataset.checkCrypto){await loadAfterAction('check_crypto_payment',{order_id:t.dataset.checkCrypto});currentTab='orders';currentOrderId=t.dataset.checkCrypto;renderUser();showStatus('بررسی پرداخت انجام شد')}
  if(t.id==='openQrHome'||t.id==='openQrWallet'){openQrSheet();return}if(t.id==='openPromoSheetBtn'){openPromoSheet();return}if(t.id==='adminOrderSearchBtn'){adminOrderSearch=$('adminOrderSearchInput')?.value||'';adminOrderStatusFilter=$('adminOrderStatusSelect')?.value||'all';adminSearchOrdersNow();return}if(t.id==='adminOrderResetBtn'){adminOrderSearch='';adminOrderStatusFilter='all';adminSearchOrdersNow();return}if(t.id==='bulkClearBtn'){selectedOrderIds.clear();renderAdmin();return}if(t.dataset.bulkAction){bulkOrderAction(t.dataset.bulkAction);return}if(t.dataset.reorder){const [type,id,dir]=t.dataset.reorder.split(':');reorderItem(type,Number(id),dir);return}if(t.dataset.chatUser){openUserChat(t.dataset.chatUser);return}if(t.dataset.editRole){const r=(adminState.admin_roles||[]).find(x=>Number(x.id)===Number(t.dataset.editRole));if(!r)return;openEdit(`ویرایش نقش ${esc(r.display_name||'')}`,[{title:'سطح دسترسی',fields:[{id:'erl_name',label:'نام نمایشی',value:r.display_name||''},{id:'erl_role',label:'نوع دسترسی',type:'select',options:`<option value="full" ${r.role==='full'?'selected':''}>ادمین کامل</option><option value="orders" ${r.role==='orders'?'selected':''}>فقط سفارش‌ها</option><option value="products" ${r.role==='products'?'selected':''}>فقط محصولات</option><option value="finance" ${r.role==='finance'?'selected':''}>فقط مالی</option>`}]}],async()=>adminAction('admin_set_role',{telegram_id:r.telegram_id,role:val('erl_role'),display_name:val('erl_name')}));return}if(t.dataset.adminRemoveRole&&confirm('نقش این کاربر حذف شود؟')){adminAction('admin_remove_role',{telegram_id:Number(t.dataset.adminRemoveRole)});return}
if(t.dataset.contactWallet){openDialog('افزایش/کاهش اعتبار',`مبلغی که می‌خواهید به اعتبار کاربر با ID ${t.dataset.contactWallet} اضافه شود را وارد کنید. برای کاهش، عدد منفی وارد کنید.`,'مثلا 50000 یا -20000',async(txt)=>{const amount=Number(txt);if(isNaN(amount)||!amount)return showStatus('مبلغ نامعتبر است','error');const ok=await adminAction('admin_add_balance',{telegram_id:t.dataset.contactWallet,amount});if(ok){showStatus('اعتبار تغییر کرد');closeCustomer360();setTimeout(()=>openCustomer360(t.dataset.contactWallet),500)}});return}if(t.dataset.contactBan){if(confirm('آیا از مسدود کردن این کاربر اطمینان دارید؟')){const ok=await adminAction('admin_ban_user',{telegram_id:t.dataset.contactBan});if(ok)showStatus('کاربر مسدود شد')}return}if(t.dataset.catalogApplyOne!==undefined){const legacyId=Number(t.dataset.catalogApplyOne||0);if(legacyId&&confirm('این مورد Needs Review نگاشت شود؟'))adminAction('admin_catalog_apply_one',{legacy_product_id:legacyId,confirm:'APPLY'});return}if(t.dataset.catalogPreview!==undefined){adminAction('admin_catalog_preview');return}if(t.dataset.catalogApply!==undefined){if(confirm('Migration کاتالوگ v2 اعمال شود؟ هیچ محصول یا سفارش قدیمی حذف نمی‌شود.'))adminAction('admin_catalog_apply',{confirm:'APPLY'});return}if(t.dataset.catalogFast!==undefined){openCatalogFast();return}if(t.dataset.catalogMoveGroup!==undefined){openCatalogMoveGroup();return}if(t.dataset.catalogMovePlan!==undefined){openCatalogMovePlan();return}if(t.dataset.catalogAddService!==undefined){openCatalogAddService();return}if(t.dataset.catalogAddGroup!==undefined){openCatalogAddGroup();return}if(t.dataset.catalogAddPlan!==undefined){openCatalogAddPlan();return}if(t.dataset.adminTab){setAdminTab(t.dataset.adminTab)}if(t.id==='reloadAdmin')loadAdmin();if(t.id==='openCmdPalette'){openCommandPalette();return}if(t.dataset.editProduct)editProduct(t.dataset.editProduct);if(t.dataset.adminToggleProduct)adminAction('admin_toggle_product',{product_id:t.dataset.adminToggleProduct});if(t.dataset.adminDeleteProduct&&confirm('محصول غیرفعال شود؟'))adminAction('admin_delete_product',{product_id:t.dataset.adminDeleteProduct});if(t.dataset.adminHardDeleteProduct&&confirm('حذف کامل محصول؟ اگر سفارش داشته باشد انجام نمی‌شود.'))adminAction('admin_hard_delete_product',{product_id:t.dataset.adminHardDeleteProduct});if(t.dataset.editCategory)editCategory(t.dataset.editCategory);if(t.dataset.adminDeleteCategory&&confirm('دسته غیرفعال شود؟'))adminAction('admin_delete_category',{category_id:t.dataset.adminDeleteCategory});if(t.dataset.adminHardDeleteCategory&&confirm('حذف کامل دسته؟ محصولات بدون دسته می‌شوند.'))adminAction('admin_hard_delete_category',{category_id:t.dataset.adminHardDeleteCategory});if(t.dataset.editVariant)editVariant(t.dataset.editVariant);if(t.dataset.adminDeleteVariant&&confirm('پلن غیرفعال شود؟'))adminAction('admin_delete_variant',{variant_id:t.dataset.adminDeleteVariant});if(t.dataset.adminHardDeleteVariant&&confirm('حذف کامل پلن؟ اگر سفارش داشته باشد انجام نمی‌شود.'))adminAction('admin_hard_delete_variant',{variant_id:t.dataset.adminHardDeleteVariant});if(t.dataset.editInventory)editInventory(t.dataset.editInventory);if(t.dataset.adminDeleteInventory&&confirm('حذف امن آیتم؟'))adminAction('admin_delete_inventory',{inventory_id:t.dataset.adminDeleteInventory});if(t.dataset.adminHardDeleteInventory&&confirm('حذف کامل آیتم؟'))adminAction('admin_hard_delete_inventory',{inventory_id:t.dataset.adminHardDeleteInventory});if(t.dataset.adminStatus){const [id,status]=t.dataset.adminStatus.split(':');adminAction('admin_order_status',{order_id:id,status})}if(t.dataset.adminOrderNote){const id=t.dataset.adminOrderNote;const o=(adminState.orders||[]).find(x=>Number(x.id)===Number(id));if(o)openEdit(`یادداشت داخلی #${id}`,[{title:'یادداشت داخلی (مخفی)',fields:[{id:'adm_note',label:'متن یادداشت',type:'textarea',placeholder:'فقط شما می‌بینید...',value:o.admin_note||''}]}],async()=>adminAction('admin_order_note',{order_id:id,note:val('adm_note')}))}if(t.dataset.adminArchiveOrder&&confirm('این سفارش آرشیو شود؟'))adminAction('admin_archive_order',{order_id:t.dataset.adminArchiveOrder});if(t.dataset.adminDeleteOrder&&confirm('حذف کامل سفارش؟ این عملیات قابل برگشت نیست.'))adminAction('admin_delete_order',{order_id:t.dataset.adminDeleteOrder});if(t.dataset.adminCleanup&&confirm('پاکسازی گروهی سفارش‌های لغو/رد شده انجام شود؟'))adminAction('admin_cleanup_orders',{older_days:t.dataset.adminCleanup==='all'?null:t.dataset.adminCleanup});if(t.dataset.adminService){const oid=t.dataset.adminService;const o=(adminState.orders||[]).find(x=>Number(x.id)===Number(oid))||{};openEdit(`لینک سرویس #${oid}`,[{title:'دسترسی سرویس',fields:[{id:'svc_url',label:'لینک HTTPS پنل / Subscription',placeholder:'https://...',value:o.delivery_url||''},{id:'svc_title',label:'عنوان دکمه برای مشتری',value:o.delivery_title||'مدیریت سرویس'},{id:'svc_note',label:'پیام تحویل',type:'textarea',value:o.delivery_text||'سرویس شما آماده است. از سفارش‌ها می‌توانید لینک سرویس را باز یا کپی کنید.'}]}],async()=>{const ok=await adminAction('admin_set_service_delivery',{order_id:oid,delivery_url:val('svc_url'),delivery_title:val('svc_title'),delivery_note:val('svc_note')});if(ok){currentAdminTab='orders';showStatus('لینک مستقیم سرویس ثبت شد')}});return}if(t.dataset.adminDeliver){const oid=t.dataset.adminDeliver;openDialog('تحویل سفارش',`متن تحویل سفارش #${oid} را وارد کن.`, 'ایمیل/پسورد، لینک ساب یا کد', async(txt)=>{const ok=await adminAction('admin_deliver_order',{order_id:oid,delivery:txt});if(ok){currentAdminTab='orders';showStatus('تحویل ثبت شد و برای کاربر ارسال شد')}})}if(t.dataset.viewReceipt!==undefined){loadReceiptImage(t.dataset.viewReceipt)}if(t.dataset.adminSaveSettings!==undefined){syncPaymentBuilders();adminAction('admin_save_settings',{brand_name:val('as_brand_name'),default_base_currency:val('as_default_base_currency'),theme_color:val('as_theme'),button_colors_enabled:val('as_btn_enabled')?1:0,require_contact_auth:val('as_require_contact')?1:0,notify_new_user:val('as_notify_new')?1:0,resend_api_key:val('as_resend_api_key'),resend_from_email:val('as_resend_from_email'),require_email_verification:val('as_require_email_verif')?1:0,button_colors:{primary:val('as_primary'),secondary:val('as_secondary'),success:val('as_success'),warning:val('as_warning'),danger:val('as_danger')},payment_instructions:val('as_payment'),payment_methods_enabled:{wallet:val('as_pay_wallet')?1:0,card:val('as_pay_card')?1:0,stars:val('as_pay_stars')?1:0,crypto:val('as_pay_crypto')?1:0},card_accounts_text:val('as_cards'),stars_rate_toman:val('as_stars_rate'),crypto_wallets_text:val('as_crypto_wallets'),crypto_manual_rates_text:val('as_crypto_rates'),crypto_rate_source:val('as_crypto_source'),crypto_rate_provider_priority:'wallex,ramzinex,nobitex',crypto_rate_markup_percent:val('as_crypto_markup'),crypto_rate_refresh_interval_seconds:val('as_crypto_refresh_interval'),crypto_notify_rate_fail:val('as_crypto_notify')?1:0,spin_referrals_per_chance:val('as_spin_every'),spin_rewards_text:val('as_spin_rewards')})}
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
if(t.dataset.hideOrder && confirm('این سفارش از لیست شما حذف شود؟')){
  await loadAfterAction('hide_order', { order_id: t.dataset.hideOrder });
  currentTab = 'orders';
  currentOrderId = null;
  renderUser();
  return;
}
if(t.dataset.clearCanceled!==undefined && confirm('همه سفارش‌های لغو/رد شده از لیست شما مخفی شوند؟')){
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
}if(t.id==='shareInviteNative'){const l=state.user?.referral_link;if(navigator.share&&l){try{await navigator.share({title:document.title,url:l});showStatus('اشتراک‌گذاری انجام شد')}catch(e){}}else if(l){navigator.clipboard?.writeText(l);showStatus('لینک کپی شد')}}if(t.id==='copyLink'||t.id==='copyRefHome'){navigator.clipboard?.writeText(state.user.referral_link);showStatus('لینک دعوت کپی شد')}if(t.id==='claimBtn')await loadAfterAction('claim_missions');if(t.id==='spinBtn')await doSpinWheel();if(t.dataset.refreshCryptoRates!==undefined){const ok=await adminAction('admin_refresh_crypto_rates',{});if(ok){showStatus('نرخ‌ها از Providerها رفرش شد')}}if(t.dataset.adminBackupCreate!==undefined){const ok=await adminAction('admin_backup_create',{});if(ok){showStatus('بکاپ روی سرور ساخته شد')}}if(t.dataset.adminBackupSendbot!==undefined){const ok=await adminAction('admin_backup_send_bot',{});if(ok){showStatus('بکاپ داخل چت بات ارسال شد')}}if(t.dataset.adminBackupDelete&&confirm('این بکاپ از سرور حذف شود؟')){await adminAction('admin_backup_delete',{filename:t.dataset.adminBackupDelete})}if(t.dataset.adminBackupRestoreServer&&confirm('Restore این فایل انجام شود؟ دیتابیس فعلی جایگزین می‌شود.')){await adminAction('admin_backup_restore_server',{filename:t.dataset.adminBackupRestoreServer,confirm:'RESTORE'})}if(t.dataset.adminBackupUpload!==undefined){try{await uploadBackupRestore()}catch(e){showStatus(e.message||'Restore failed','error')}}if(t.dataset.adminLoadMoreOrders!==undefined){adminOrdersLimit+=25;renderAdmin();return}if(t.dataset.accordionToggle!==undefined){toggleVariantProduct(t.dataset.accordionToggle, t);return}if(t.dataset.accordionAddVariant!==undefined){openAddVariant(Number(t.dataset.accordionAddVariant));return}
if(t.dataset.editCoupon){const cp=(adminState.coupons||[]).find(x=>Number(x.id)===Number(t.dataset.editCoupon));if(!cp)return;openEdit(`ویرایش کد ${esc(cp.code)}`,[{title:'تنظیمات کد تخفیف',fields:[{id:'ecp_code',label:'کد',value:cp.code},{id:'ecp_type',label:'نوع',type:'select',options:`<option value="percent" ${cp.type==='percent'?'selected':''}>درصدی</option><option value="fixed" ${cp.type==='fixed'?'selected':''}>مبلغ ثابت</option>`},{id:'ecp_value',label:'مقدار',type:'number',props:'inputmode="numeric"',value:cp.value||0},{id:'ecp_max',label:'حداکثر استفاده',type:'number',props:'inputmode="numeric"',value:cp.max_uses||0},{id:'ecp_expires',label:'تاریخ انقضا',type:'datetime-local',value:cp.expires_at?String(cp.expires_at).slice(0,16):''},{id:'ecp_active',label:'فعال باشد؟',type:'checkbox',value:Number(cp.is_active)}]}],async()=>adminAction('admin_update_coupon',{coupon_id:cp.id,code:val('ecp_code'),type:val('ecp_type'),value:val('ecp_value'),max_uses:val('ecp_max'),expires_at:val('ecp_expires'),is_active:val('ecp_active')?1:0}));return}if(t.dataset.adminToggleCoupon){const cp=(adminState.coupons||[]).find(x=>Number(x.id)===Number(t.dataset.adminToggleCoupon));if(cp)adminAction('admin_update_coupon',{coupon_id:cp.id,is_active:Number(cp.is_active)?0:1});return}if(t.dataset.adminDeleteCoupon&&confirm('این کد تخفیف حذف شود؟')){adminAction('admin_delete_coupon',{coupon_id:Number(t.dataset.adminDeleteCoupon)});return}});

document.addEventListener('input',e=>{if(e.target.id==='searchInput'){searchTerm=e.target.value;clearTimeout(searchTimeout);searchTimeout=setTimeout(renderShopSections,250)}if(e.target.id==='ai_product'){const sel=$('ai_variant'); if(sel) sel.innerHTML=variantOptions('', e.target.value)}if(e.target.dataset.colorMirror){const id=e.target.dataset.colorMirror;if($(id))$(id).value=e.target.value}if(e.target.type==='color'&&$(e.target.id+'_text'))$(e.target.id+'_text').value=e.target.value;if(e.target.id==='cmdInput'&&$('cmdPalette')?.classList.contains('open')){openCommandPalette()}})
document.addEventListener('change',e=>{if(e.target.classList?.contains('bulk-check')){const id=Number(e.target.dataset.bulkCheck);if(e.target.checked)selectedOrderIds.add(id);else selectedOrderIds.delete(id);if(selectedOrderIds.size>0&&currentAdminTab==='orders'){const bar=document.querySelector('.bulk-action-bar h3');if(bar)bar.textContent=`${nf(selectedOrderIds.size)} سفارش انتخاب شده`;else renderAdmin()}}})
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();openCommandPalette()}if(e.key==='Escape'){$('cmdPalette')?.classList.remove('open');$('onboarding')?.classList.remove('open');closePreviewSheet();closeQrSheet();closeCartSheet();closeCustomer360();closePalettePopup();closeShareSheet()}if($('cmdPalette')?.classList.contains('open')){const cp=$('cmdPalette');if(e.key==='Enter'){const first=cp.querySelector('[data-cmd-idx]');if(first){const idx=Number(first.dataset.cmdIdx);cp._cmds?.[idx]?.action?.();closeCommandPalette()}}if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const items=[...cp.querySelectorAll('[data-cmd-idx]')];const cur=cp.querySelector('[data-cmd-idx].selected');let i=cur?items.indexOf(cur):-1;i+=e.key==='ArrowDown'?1:-1;if(i<0)i=items.length-1;if(i>=items.length)i=0;items.forEach(el=>el.classList.remove('selected'));items[i]?.classList.add('selected');items[i]?.scrollIntoView({block:'nearest'})}}})
document.addEventListener('click',e=>{const cp=e.target.closest('#cmdPalette, [data-cmd-idx]');if(e.target.dataset?.cmdIdx!==undefined){const cp2=$('cmdPalette');const idx=Number(e.target.dataset.cmdIdx);cp2?._cmds?.[idx]?.action?.();closeCommandPalette();return}if(!cp&&$('cmdPalette')?.classList.contains('open')){closeCommandPalette()}})
$('dialogSubmit').addEventListener('click',async(e)=>{
  if(!pendingDialog) return;
  e.preventDefault();
  const txt=$('dialogInput').value.trim();
  const fileInput=$('dialogFileInput');
  const hasFile=fileInput && fileInput.style.display!=='none' && fileInput.files.length>0;
  if(!txt && !hasFile){showStatus('ورودی خالی است','error');return}
  const cb=pendingDialog;
  const btn=$('dialogSubmit');
  pendingDialog=null;
  btn.disabled=true;
  try{
    if(hasFile){
      const reader=new FileReader();
      reader.onload=async(ev)=>{
        try{
          await cb(txt,ev.target.result);
          $('inputDialog').close('ok');
        }catch(err){
          showStatus(err.message||'خطا در ثبت اطلاعات','error');
          pendingDialog=cb;
        }finally{
          btn.disabled=false;
        }
      };
      reader.readAsDataURL(fileInput.files[0]);
    }else{
      await cb(txt,null);
      $('inputDialog').close('ok');
      btn.disabled=false;
    }
  }catch(err){
    showStatus(err.message||'خطا در ثبت اطلاعات','error');
    pendingDialog=cb;
    btn.disabled=false;
  }
})
// BUG-5: Legacy editDialog submit handler — save is now handled inside openEdit() via presentationSaveBtn.
// Kept for compatibility in case editDialog is ever used directly.
if($('editSubmit')) $('editSubmit').addEventListener('click',async(e)=>{
  if(!pendingEdit) return;
  e.preventDefault();
  const cb=pendingEdit;
  const btn=$('editSubmit');
  pendingEdit=null;
  btn.disabled=true;
  try{
    await cb();
    closeEdit(); // was: $('editDialog').close('ok') which didn't close the presentation sheet
  }catch(err){
    showStatus(err.message||'خطا در ذخیره ویرایش','error');
    pendingEdit=cb;
  }finally{
    btn.disabled=false;
  }
})
async function load(){
  showSkeleton();
  initAuthHandlers();
  try{
    if(isAdminMode){
      adminState=await api('admin_summary');
      applyTheme(adminState.settings||{});
      $('userApp')?.classList.add('hidden');
      $('adminApp')?.classList.remove('hidden');
      loadAdmin();
    } else {
      state=await api('me');
      updateAuthUI(state);
      render(state);
    }
  }catch(e){
    hideSkeleton();
    console.error('MiniApp startup error:', e);
    if (!isAdminMode) {
      try {
        state = await api('guest_dashboard_payload');
        if (state && state.ok) {
          updateAuthUI(state);
          render(state);
          return;
        }
      } catch(ge) {}
    }
    const home = $('homePage');
    if (home) {
      home.classList.remove('hidden');
      home.innerHTML = `<div class="error-state" style="padding:40px 20px;text-align:center"><div style="font-size:48px;margin-bottom:12px">⚠️</div><h3>خطا در بارگذاری اطلاعات</h3><p class="muted" style="margin-bottom:20px;font-size:14.5px">${esc(e.message||'خطا در ارتباط با سرور')}</p><button class="primary" onclick="location.reload()">تلاش مجدد</button></div>`;
    }
  }
}
setInterval(()=>{
  if(!isAdminMode && currentTab==='orders' && currentOrderId){ refreshCurrentOrderSilently(); }
  // BUG-6: removed settings auto-reload — was wiping admin's unsaved form inputs every 60s
},60000);
// VIP Tier Rates save handler
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-save-vip-rates]');
  if (!btn) return;
  e.preventDefault(); e.stopPropagation();
  const rates = {
    bronze: {name:'Bronze', fa:'برنز', emoji:'🥉', min_ref: 0, multiplier: Number(val('vip_bronze_mult')||1.0)},
    silver: {name:'Silver', fa:'سیلور', emoji:'🥈', min_ref: Number(val('vip_silver_min')||10), multiplier: Number(val('vip_silver_mult')||1.1)},
    gold: {name:'Gold', fa:'گلد', emoji:'🥇', min_ref: Number(val('vip_gold_min')||50), multiplier: Number(val('vip_gold_mult')||1.25)},
    diamond: {name:'Diamond', fa:'دایموند', emoji:'💎', min_ref: Number(val('vip_diamond_min')||100), multiplier: Number(val('vip_diamond_mult')||1.5)}
  };
  try {
    await adminAction('admin_save_vip_rates', { vip_tier_rates: rates });
    showStatus('نرخ‌های VIP با موفقیت ذخیره شدند');
  } catch(err) {
    showStatus(err.message || 'خطا در ذخیره VIP', 'error');
  }
});

// Capture-phase click handler for buy flows.
document.addEventListener('click',async function(e){
  const t=e.target.closest('[data-buy],[data-buy-wallet]');
  if(!t) return;
  if(t.dataset.buy || t.dataset.buyWallet){
    e.preventDefault(); e.stopPropagation();
    
    // Close both pop-up overlays
    if(typeof closeVariantDetails === 'function') closeVariantDetails();
    if(typeof closeProductModal === 'function') closeProductModal();
    if(typeof closePreviewSheet === 'function') closePreviewSheet();

    const pid = Number(t.dataset.buy || t.dataset.buyWallet);
    const variantId = t.dataset.variant ? Number(t.dataset.variant) : null;
    const p = (state.shop_products||[]).find(x=>Number(x.id)===Number(pid));
    if(!p) return;
    const selectedVariant=variantId?(p.variants||[]).find(v=>Number(v.id)===variantId):null;
    const orderPid=Number(selectedVariant?.product_id||pid);

    const tmpId = 'tmp_'+Date.now();
    const price = variantId ? ((p.variants||[]).find(v=>Number(v.id)===variantId)?.price||p.price) : p.price;
    const tmpOrder = {id: tmpId, display_name: p?.name||'سفارش', status:'pending_payment', final_amount:price, created_at:new Date().toISOString(), image_url:p?.image_url};
    state.orders = state.orders || [];
    state.orders.unshift(tmpOrder);
    
    currentTab = 'orders';
    currentOrderId = tmpId;
    renderUser();
    
    try{
      const res = await api('create_order',{product_id:orderPid, variant_id:variantId, use_wallet:t.dataset.buyWallet?1:0});
      state = await api('me');
      applyTheme(state);
      const newOrderId = res?.order_id || state.orders?.[0]?.id || null;
      currentTab = 'orders';
      currentOrderId = newOrderId;
      renderUser();
      showStatus('⚡ سفارش با موفقیت ثبت شد');
    }catch(err){
      state.orders = (state.orders||[]).filter(o=>o.id!==tmpId);
      showStatus(err.message||'خطا در ثبت سفارش','error');
      renderUser();
    }
  }
}, true);

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
  const btn = $('openAuthModalBtn');
  if (!btn) return;
  const isGuest = Boolean(st?.is_guest || st?.user?.is_guest || !st?.user);
  if (isGuest) {
    btn.innerHTML = '🔑 ورود / ثبت‌نام';
    btn.title = 'ورود / ثبت‌نام';
    btn._isGuest = true;
  } else {
    const name = st?.user?.first_name || st?.user?.username || 'حساب من';
    btn.innerHTML = `👤 ${esc(name)} (خروج)`;
    btn.title = 'خروج از حساب';
    btn._isGuest = false;
  }
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
      if (confirm('آیا می‌خواهید از حساب کاربری خود خارج شوید؟')) {
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


load();
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


