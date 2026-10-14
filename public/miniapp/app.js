// BlueGate Mini App v2.8.3 / Core 2.1.5 — resilient Telegram bridge + backend role resolution
// (prepending a safe comment helps spot versions; remove only when sure)
let tg = window.Telegram?.WebApp || null;

function syncMiniViewport() {
  const viewport = window.visualViewport;
  const height = Math.round(viewport?.height || window.innerHeight || 0);
  if (height > 0) document.documentElement.style.setProperty('--mini-viewport-height', `${height}px`);
  const keyboardInset = Math.max(0, Math.round((window.innerHeight || height) - height));
  document.documentElement.style.setProperty('--mini-keyboard-inset', `${keyboardInset}px`);
}
syncMiniViewport();
window.addEventListener('resize', syncMiniViewport, {passive: true});
window.visualViewport?.addEventListener('resize', syncMiniViewport, {passive: true});

// Keep the Mini App at a fixed scale without blocking normal one-finger scrolling.
function lockMiniAppZoom() {
  const preventZoomGesture = event => event.preventDefault();
  document.addEventListener('gesturestart', preventZoomGesture, {passive: false});
  document.addEventListener('gesturechange', preventZoomGesture, {passive: false});
  document.addEventListener('gestureend', preventZoomGesture, {passive: false});
  document.addEventListener('wheel', event => {
    if (event.ctrlKey) event.preventDefault();
  }, {passive: false});
  document.addEventListener('keydown', event => {
    if (event.ctrlKey && ['+', '-', '=', '0'].includes(event.key)) event.preventDefault();
  }, {passive: false});
  document.addEventListener('dblclick', preventZoomGesture, {passive: false});
}
lockMiniAppZoom();

function optimizeMiniImages(root = document) {
  root.querySelectorAll?.('img').forEach(img => {
    if (!img.hasAttribute('decoding')) img.decoding = 'async';
    if (!img.hasAttribute('loading') && !img.closest('.hero,.topbar')) img.loading = 'lazy';
  });
}
optimizeMiniImages();
if (window.MutationObserver) {
  new MutationObserver(records => records.forEach(record => {
    record.addedNodes.forEach(node => {
      if (node.nodeType === 1) optimizeMiniImages(node);
    });
  })).observe(document.body, {childList: true, subtree: true});
}

// Safety: ensure UI helper exists
if (typeof window.BlueGateUI === 'undefined' && typeof window.VeyraUI !== 'undefined') {
  window.BlueGateUI = window.VeyraUI;
}
if (typeof window.BlueGatePurchase === 'undefined' && typeof window.VeyraPurchase !== 'undefined') {
  window.BlueGatePurchase = window.VeyraPurchase;
}

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
function telegramLaunchHint(){
  const raw=((location.search||'')+'&'+(location.hash||'')).toLowerCase();
  const ua=String(navigator.userAgent||'').toLowerCase();
  return raw.includes('tgwebapp') || raw.includes('mode=admin') || raw.includes('admin=1') || ua.includes('telegram');
}
function isTelegramMiniAppContext(){
  refreshTelegramContext();
  const platform=String(tg?.platform||'').toLowerCase();
  return Boolean(initData || tg?.initDataUnsafe?.user?.id || (platform && platform !== 'unknown') || telegramLaunchHint());
}
async function waitForTelegramBridge(timeoutMs=6500){
  const started=Date.now();
  const hinted=telegramLaunchHint();
  while(Date.now()-started < timeoutMs){
    refreshTelegramContext();
    if(initData) return {telegram:true,initData};
    const platform=String(tg?.platform||'').toLowerCase();
    if(tg && tg?.initDataUnsafe?.user?.id){
      // Telegram bridge exists but signed initData may arrive a little later.
      try{tg?.ready?.();tg?.expand?.();}catch(_){}
    } else if(tg && platform && platform!=='unknown') {
      try{tg?.ready?.();tg?.expand?.();}catch(_){}
    }
    // On a normal browser page with no Telegram hint, do not hold the storefront boot.
    if(!hinted && Date.now()-started > 450) return {telegram:false,initData:''};
    await new Promise(r=>setTimeout(r,75));
  }
  refreshTelegramContext();
  if(initData) return {telegram:true,initData};
  return {telegram:hinted || Boolean(tg?.initDataUnsafe?.user?.id),initData:''};
}
async function waitForTelegramInitData(timeoutMs=6500){
  const ctx=await waitForTelegramBridge(timeoutMs);
  return ctx.initData||'';
}
function getUrlFlag(name){
  const search=new URLSearchParams(location.search||'');
  if(search.get(name)) return search.get(name);
  const hash=(location.hash||'').replace(/^#/,'');
  try{const hp=new URLSearchParams(hash); if(hp.get(name)) return hp.get(name);}catch(e){}
  return null;
}
const adminFlag = getUrlFlag('admin') || getUrlFlag('mode') || getUrlFlag('startapp') || tg?.initDataUnsafe?.start_param || '';
const requestedMiniMode = String(adminFlag || '').toLowerCase();
const forceAdminMode = requestedMiniMode === '1' || requestedMiniMode === 'admin';
const forceUserMode = requestedMiniMode === 'user' || requestedMiniMode === 'customer' || requestedMiniMode === 'shop';
// Runtime mode is resolved from the authenticated backend payload. Do not trust a URL flag
// to decide whether someone is an administrator.
let isAdminMode = false;
let state = null, adminState = null, currentTab = 'shop', currentAdminTab = 'dashboard', settingsSubTab = 'general', searchTerm = '', activeCategory = 'all', pendingEdit = null, currentOrderId = null, currentServiceOrderId = null, orderFilter = 'all', adminOrderViewMode = 'board', adminOrdersLimit = 25, lastSpinPrize = null, searchTimeout = null, shopSort = 'newest', shopFilterFeatured = false, shopFilterWishlist = false, _shareUrl = '';

const BLUEGATE_PRO_FEATURES={
  web_storefront:{title:'فروشگاه و پنل وب',desc:'فروشگاه مستقل روی دامنه، ورود وب و داشبورد مشتری'},
  white_label:{title:'White-label',desc:'حذف برند BlueGate و شخصی‌سازی کامل برند'},
  unlimited_providers:{title:'پنل‌های نامحدود',desc:'اتصال بیش از یک Provider به BlueGate'},
  multi_provider:{title:'Multi-provider',desc:'مدیریت چند پنل و چند Provider به‌صورت همزمان'},
  routing:{title:'Routing پیشرفته',desc:'انتخاب خودکار مسیر و سیاست‌های مسیریابی'},
  failover:{title:'Failover',desc:'جایگزینی خودکار Provider هنگام اختلال'},
  multi_location:{title:'Multi-location',desc:'ساخت یک سرویس روی چند مقصد و لوکیشن'},
  advanced_monitoring:{title:'مانیتورینگ پیشرفته',desc:'Health check، Sync و هشدارهای پیشرفته'},
  automation:{title:'اتوماسیون پیشرفته',desc:'ظرفیت، هزینه، Maintenance و عملیات خودکار'},
  bulk_tools:{title:'ابزارهای گروهی',desc:'Migration و عملیات Bulk روی سرویس‌ها'},
  release_access:{title:'دسترسی Pro',desc:'ماژول‌ها و Releaseهای خصوصی BlueGate Pro'},
  team_roles:{title:'تیم و نقش‌های مدیریتی',desc:'چند ادمین با سطح دسترسی و نقش‌های جداگانه'},
  marketing_automation:{title:'کمپین و ارسال همگانی',desc:'Broadcast، اعلان هدفمند و ابزارهای رشد و بازاریابی'},
  advanced_backups:{title:'بکاپ پیشرفته',desc:'Download/Export، ارسال به تلگرام و Restore کامل'},
  advanced_commerce:{title:'فروش پیشرفته',desc:'قیمت‌گذاری VIP، قوانین تجاری و ابزارهای رشد فروش'},
  advanced_analytics:{title:'گزارش و تحلیل پیشرفته',desc:'تحلیل سود، عملکرد و گزارش‌های مدیریتی پیشرفته'},
  integrations:{title:'Integration و Webhook',desc:'اتصال سرویس‌های خارجی، API و Webhookهای تجاری'},
  advanced_security:{title:'امنیت پیشرفته',desc:'کنترل‌های امنیتی حرفه‌ای برای تیم و مدیریت'},
  custom_notifications:{title:'قالب اعلان سفارشی',desc:'قالب‌ها و اتوماسیون پیام‌های سفارشی'},
  customer_segmentation:{title:'بخش‌بندی مشتریان',desc:'گروه‌بندی و هدف‌گیری مشتریان برای کمپین‌ها'}
};
const BLUEGATE_PRO_EDITION_CAPS=new Set(['team_roles','marketing_automation','advanced_backups','advanced_commerce','advanced_analytics','integrations','advanced_security','custom_notifications','customer_segmentation']);
function licensePayload(){return adminState?.license||state?.license||{edition:'free',features:[]}}
function hasLicenseFeature(feature){return true; /* unrestricted */}
function proFeatureMeta(feature,title=''){const m=BLUEGATE_PRO_FEATURES[feature]||{};return {title:title||m.title||'قابلیت Pro',desc:m.desc||'این قابلیت در BlueGate Pro فعال می‌شود.'}}
function proBadge(feature){return ''; /* unrestricted */}

let _licensePollTimer=null,_licensePollSig='';
function licenseStateSignature(l){const f=Array.isArray(l?.features)?[...l.features].sort():[];return JSON.stringify([String(l?.edition||''),String(l?.status||''),String(l?.license_id||''),f]);}
async function refreshLicenseUiState(){
  if(document.hidden)return;try{const r=await api('license_status');const l=r?.license;if(!l)return;const sig=licenseStateSignature(l),prev=_licensePollSig||licenseStateSignature(licensePayload());_licensePollSig=sig;if(sig===prev)return;
    const oldEdition=String(licensePayload()?.edition||'free').toLowerCase(),newEdition=String(l.edition||'free').toLowerCase();
    if(isAdminMode){adminState=adminState||{};adminState.license=l;}else{state=state||{};state.license=l;}
    if(oldEdition!==newEdition)showStatus(newEdition==='pro'?'✨ لایسنس Pro فعال شد.':'لایسنس به Free تغییر کرد؛ امکانات Pro غیرفعال شدند.','info');
    await reloadCurrentPage();
  }catch(e){if(e?.error==='LICENSE_REQUIRED')location.reload();}
}
function startLicensePolling(){if(_licensePollTimer)clearInterval(_licensePollTimer);_licensePollSig=licenseStateSignature(licensePayload());_licensePollTimer=setInterval(refreshLicenseUiState,15000);setTimeout(refreshLicenseUiState,2500);}
const BLUEGATE_UPGRADE_SUPPORT='bluegatesupport';
const BLUEGATE_UPGRADE_URL='https://t.me/'+BLUEGATE_UPGRADE_SUPPORT;
function openBlueGateUpgradeSupport(){try{if(tg?.openTelegramLink){tg.openTelegramLink(BLUEGATE_UPGRADE_URL);return}}catch(_){}window.open(BLUEGATE_UPGRADE_URL,'_blank','noopener')}
function showProUpgrade(feature,title=''){const meta=proFeatureMeta(feature,title);const body=`<div class="pro-upsell"><div class="pro-upsell-icon">◆</div><h3>${esc(meta.title)}</h3><p>${esc(meta.desc)}</p><div class="pro-upsell-note">نسخه Free برای شروع کاملاً قابل استفاده است؛ برای فعال‌سازی این قابلیت با پشتیبانی BlueGate در تلگرام تماس بگیر.</div><a class="primary wide pro-upgrade-link" href="${BLUEGATE_UPGRADE_URL}" target="_blank" rel="noopener" data-upgrade-support>ارتقا از طریق @${BLUEGATE_UPGRADE_SUPPORT}</a></div>`;if(window.BlueGateUI?.openSheet){BlueGateUI.openSheet({type:'info',eyebrow:'BLUEGATE PRO',title:'ارتقا به BlueGate Pro',body,footer:`<button type="button" class="secondary" data-pro-close>بستن</button>`,onOpen:(host)=>{host.querySelector('[data-pro-close]')?.addEventListener('click',()=>BlueGateUI.closeSheet?.());host.querySelector('[data-upgrade-support]')?.addEventListener('click',(e)=>{if(tg?.openTelegramLink){e.preventDefault();openBlueGateUpgradeSupport()}})}})}else{showStatus(`${meta.title}: برای ارتقا با @${BLUEGATE_UPGRADE_SUPPORT} تماس بگیر.`,'error');openBlueGateUpgradeSupport()}}
function requireProFeature(feature,title=''){if(hasLicenseFeature(feature))return true;showProUpgrade(feature,title);return false}
function showProActive(feature){const meta=proFeatureMeta(feature);showStatus(`${meta.title} در لایسنس Pro شما فعال است.`,'success')}
// Product card display mode: 'compact' (grid) or 'detailed' (list)
let productCardMode = localStorage.getItem('blue_ref_card_mode') || 'compact';


/* ===== v3.0.9: parent/child layer stack ===== */
const MINI_LAYER_IDS=['appSheet','miniPurchaseOverlay','miniCreditTopupSheet','shareSheet','previewSheet','qrSheet','cartSheet','custDrawer','palettePopup','cmdPalette','onboarding','lightbox','authModal'];
const MINI_LAYER_KIND={
  appSheet:'primary',miniPurchaseOverlay:'primary',miniCreditTopupSheet:'primary',cartSheet:'primary',custDrawer:'primary',onboarding:'primary',authModal:'primary',
  shareSheet:'child',previewSheet:'child',qrSheet:'child',palettePopup:'child',cmdPalette:'child',lightbox:'child'
};
let miniLayerStack=[];
function miniLayerIsOpen(id){const el=$(id);if(!el)return false;if(id==='cmdPalette')return !el.hidden&&el.classList.contains('open');if(id==='authModal')return el.open||el.classList.contains('open');return el.classList.contains('open')}
function closeMiniLayerById(id){
  if(id==='appSheet'){window.BlueGateUI?.closeSheet?.();return true}
  if(id==='miniPurchaseOverlay'){window.BlueGatePurchase?.close?.();return true}
  if(id==='miniCreditTopupSheet'){closeMiniCreditTopup();return true}
  if(id==='shareSheet'){closeShareSheet();return true}
  if(id==='previewSheet'){closePreviewSheet();return true}
  if(id==='qrSheet'){closeQrSheet();return true}
  if(id==='cartSheet'){closeCartSheet();return true}
  if(id==='custDrawer'){closeCustomer360();return true}
  if(id==='palettePopup'){closePalettePopup();return true}
  if(id==='cmdPalette'){closeCommandPalette();return true}
  if(id==='onboarding'){$('onboarding')?.classList.remove('open');return true}
  if(id==='lightbox'){closeLightbox();return true}
  if(id==='authModal'){closeAuthModal();return true}
  return false;
}
function pruneMiniLayerStack(){miniLayerStack=miniLayerStack.filter((id,i,a)=>a.indexOf(id)===i&&miniLayerIsOpen(id));return miniLayerStack}
function registerMiniLayer(id){miniLayerStack=pruneMiniLayerStack().filter(x=>x!==id);miniLayerStack.push(id)}
function prepareMiniLayer(id){
  const kind=MINI_LAYER_KIND[id]||'child';
  pruneMiniLayerStack();
  if(kind==='primary'){
    // Primary pages replace other primary pages and clear orphan child overlays.
    [...miniLayerStack].reverse().forEach(openId=>{if(openId!==id&&miniLayerIsOpen(openId))closeMiniLayerById(openId)});
    miniLayerStack=[];
  }else if(miniLayerIsOpen(id)){
    // Reopening the same child replaces only itself, never its parent.
    closeMiniLayerById(id);
  }
  registerMiniLayer(id);
}
function topMiniLayer(){pruneMiniLayerStack();for(let i=miniLayerStack.length-1;i>=0;i--){if(miniLayerIsOpen(miniLayerStack[i]))return miniLayerStack[i]}for(let i=MINI_LAYER_IDS.length-1;i>=0;i--){if(miniLayerIsOpen(MINI_LAYER_IDS[i]))return MINI_LAYER_IDS[i]}return null}
function closeTopMiniLayer(){const id=topMiniLayer();if(!id)return false;const ok=closeMiniLayerById(id);miniLayerStack=miniLayerStack.filter(x=>x!==id);return ok}
document.addEventListener('bluegate:before-layer-open',e=>{const id=e.detail?.id;if(id)prepareMiniLayer(id)});
function syncTelegramBackButton(){try{const bb=tg?.BackButton;if(!bb)return;if(topMiniLayer()||currentOrderId||currentServiceOrderId||currentTab!=='shop')bb.show();else bb.hide()}catch(_){}}
setInterval(syncTelegramBackButton,700);
try{tg?.BackButton?.onClick?.(()=>{if(closeTopMiniLayer()){syncTelegramBackButton();return}if(currentServiceOrderId){currentServiceOrderId=null;currentTab='home';renderUser();miniScrollTop();return}if(currentOrderId){currentOrderId=null;currentTab='orders';renderUser();return}if(currentTab!=='shop'){currentTab='shop';renderUser();miniScrollTop();return}})}catch(_){}
/* Edge swipe back: keep normal scrolling and horizontal controls untouched. */
let _edgeBackStart=null,_edgeBackTracking=false;
function miniAppBack(){
  if(closeTopMiniLayer()){syncTelegramBackButton();return true}
  if(currentServiceOrderId){currentServiceOrderId=null;currentTab='home';renderUser();miniScrollTop();return true}
  if(currentOrderId){currentOrderId=null;currentTab='orders';renderUser();return true}
  if(currentTab!=='shop'){currentTab='shop';renderUser();miniScrollTop();return true}
  return false;
}
document.addEventListener('touchstart',e=>{
  if(e.touches.length!==1)return;
  const t=e.target;
  if(t.closest('input,textarea,select,[contenteditable="true"],[data-horizontal-scroll],.h-scroll,.category-strip,.order-filters'))return;
  const p=e.touches[0];
  if(p.clientX<=34){_edgeBackStart={x:p.clientX,y:p.clientY};_edgeBackTracking=false;document.documentElement.classList.remove('edge-back-ready');}
},{passive:true});
document.addEventListener('touchmove',e=>{
  if(!_edgeBackStart||e.touches.length!==1)return;
  const p=e.touches[0],dx=p.clientX-_edgeBackStart.x,dy=Math.abs(p.clientY-_edgeBackStart.y);
  if(dx<0||dy>Math.max(28,dx*.75)){_edgeBackStart=null;_edgeBackTracking=false;document.documentElement.classList.remove('edge-back-ready');return}
  if(dx>18){_edgeBackTracking=true;document.documentElement.classList.toggle('edge-back-ready',dx>54);if(dx>54)e.preventDefault();}
},{passive:false});
document.addEventListener('touchend',e=>{
  if(!_edgeBackStart)return;
  const p=e.changedTouches[0],dx=p.clientX-_edgeBackStart.x,dy=Math.abs(p.clientY-_edgeBackStart.y),valid=_edgeBackTracking&&dx>=72&&dy<Math.max(42,dx*.65);
  _edgeBackStart=null;_edgeBackTracking=false;document.documentElement.classList.remove('edge-back-ready');
  if(valid){e.preventDefault();miniAppBack();}
},{passive:false});

function saveAppLastState(){
  try {
    localStorage.setItem('blue_ref_last_user_tab', JSON.stringify({
      currentTab: ['shop','orders','wallet','support','home'].includes(currentTab) ? currentTab : 'shop',
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
    if (['shop','orders','wallet','support','home'].includes(savedUser.currentTab)) currentTab = savedUser.currentTab;
    if (savedUser.currentOrderId) currentOrderId = savedUser.currentOrderId;
  } catch(e) {}
  try {
    const savedAdmin = JSON.parse(localStorage.getItem('blue_ref_last_admin_tab') || '{}');
    if (savedAdmin.currentAdminTab) currentAdminTab = ['dashboard','catalog','orders','more','customers','notifications','support','inventory','coupons','settings','activity','roles','backups'].includes(savedAdmin.currentAdminTab) ? savedAdmin.currentAdminTab : 'dashboard';
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
function userPhotoUrl(u={}){return u.avatar_url || u.photo_url || tgUser().photo_url || ''}
function userInitial(u={}){return esc(String(u.first_name || u.username || 'B').trim().slice(0,1).toUpperCase() || 'B')}
function userProfileAvatar(u={}, cls='profile-photo'){
  const photo = userPhotoUrl(u);
  return photo ? `<div class="${cls}"><img src="${esc(photo)}" alt="profile"></div>` : `<div class="${cls} fallback">${userInitial(u)}</div>`;
}
const $ = (id) => document.getElementById(id);
const fmt = (n) => `${Number(n || 0).toLocaleString('fa-IR')} تومان`;
const nf = (n) => Number(n || 0).toLocaleString('fa-IR');
const esc = (s) => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const dateMini = (value, fallback='-') => { const d=parseServerDate(value); return d ? d.toLocaleDateString('fa-IR',{year:'numeric',month:'short',day:'numeric'}) : String(value||fallback); };
const textBlock = (s) => esc(s || '').replace(/\n/g,'<br>');
function parsePipeLines(text, keys=[]){
  return String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(line=>{
    const parts=line.split('|').map(x=>x.trim());
    const row={}; keys.forEach((k,i)=>row[k]=parts[i]??''); return row;
  });
}
function normalizeAdminCryptoWallet(w={}){
  const asset=String(w.asset||'USDT').trim().toUpperCase();
  const network=String(w.network||'TRC20').trim().toUpperCase();
  return {...w,id:Number(w.id||0),title:String(w.title||`${asset} ${network}`),asset,network,address:String(w.address||'').trim(),rate_symbol:String(w.rate_symbol||asset).trim().toUpperCase(),is_active:String(w.is_active??1),sort_order:String(w.sort_order??99),min_confirmations:String(w.min_confirmations??1)};
}

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
function colorMix(c){return c || '#8b5cf6'}
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
/* BlueGate premium command loader + page transitions */
const BlueGateCommandLoader=(()=>{
  // Opt in only for deliberate user actions that mutate data or take noticeable time.
  // A denylist accidentally showed the overlay for every newly-added read/refresh action.
  const tracked=new Set(['create_order','create_cart_orders','renew_order','service_renew','service_add_days','service_add_traffic','create_credit_topup','credit_topup_start_stars','credit_topup_submit_crypto_hash','credit_topup_submit_receipt','apply_coupon','login','register','telegram_login','change_my_password','email_change_start','email_change_set_new','email_change_verify_current','email_change_verify_new','update_my_profile','update_my_avatar','reset_my_avatar','support_ticket_create','support_ticket_reply','admin_broadcast','admin_notification_broadcast','admin_order_provision_now','admin_provider_save','admin_provider_test','admin_provider_client_create','admin_provider_client_update','admin_provider_client_delete','admin_catalog_upload_image','admin_crypto_wallet_save','admin_crypto_wallet_delete','admin_plan_provider_map_save','spin','initial_boot','select_payment_method','select_crypto_wallet','select_crypto_tab','start_stars_invoice','submit_crypto_hash','check_crypto_payment','credit_topup_set_method','credit_topup_change_method','cancel_credit_topup','cancel_order','hide_order','clear_canceled_orders','service_sync','service_usage_history','service_event_history']);
  let active=0,root=null,textNode=null;
  const loadingMessage='در حال انجام درخواست…';
  function ensure(){
    if(root)return root;
    root=document.createElement('div');root.id='bgCommandLoader';root.className='bg-command-loader';root.setAttribute('role','status');root.setAttribute('aria-live','polite');root.setAttribute('aria-hidden','true');
    root.innerHTML='<div class="bg-loader-glass"><div class="bg-loader-orbit"><span class="bg-loader-orbit-dot"></span><span class="bg-loader-orbit-dot second"></span><div class="bg-loader-core"><img class="bg-loader-mark" src="/web/assets/logo-mark.webp" alt="BlueGate" width="43" height="43"></div></div><div class="bg-loader-title">در حال انجام درخواست</div><div class="bg-loader-message"></div><div class="bg-loader-track"><i></i></div><div class="bg-loader-foot">BlueGate <span>•</span> لطفاً صفحه را نبند</div></div>';
    document.body.appendChild(root);textNode=root.querySelector('.bg-loader-message');return root;
  }
  function show(action){
    if(!tracked.has(String(action||'')))return ()=>{};
    active++;
    const el=ensure();el.dataset.action=String(action||'');el.setAttribute('aria-hidden','false');
    if(active===1){
      textNode.textContent=loadingMessage;
      el.classList.remove('is-idle');el.classList.add('visible');
      document.documentElement.classList.add('bg-command-busy');document.body.classList.add('bg-command-busy');
    }
    let released=false;
    return ()=>{if(released)return;released=true;active=Math.max(0,active-1);if(active===0){el.classList.remove('visible');el.setAttribute('aria-hidden','true');document.documentElement.classList.remove('bg-command-busy');document.body.classList.remove('bg-command-busy');el.classList.add('is-idle')}};
  }
  return {show};
})();

async function api(action,payload={}){
  const finishCommandLoader=BlueGateCommandLoader.show(action);
  try{
  refreshTelegramContext();
  const body = JSON.stringify({action,initData,language:(localStorage.getItem('bluegate_language')||((navigator.language||'').toLowerCase().startsWith('fa')?'fa':'en')),...payload});
  const headers = {'Content-Type':'application/json'};

  // Resolve API path robustly. Mini App lives under /miniapp/, so relative
  // "api.php" hits the wrong place. Prefer parent and absolute candidates.
  const here = location.pathname || '/';
  const candidates = [];
  // 1) Absolute from domain root (most reliable when docroot is public/)
  candidates.push('/api.php');
  // 2) Parent of current directory (works when opened from /miniapp/)
  if (here.includes('/miniapp')) {
    candidates.push(here.replace(/\/miniapp\/?.*$/, '/api.php'));
    candidates.push('../api.php');
  }
  // 3) Same directory fallback
  candidates.push('api.php');
  // 4) Common alternative if docroot is project root
  candidates.push('/public/api.php');

  // Deduplicate while preserving order
  const seen = new Set();
  const candidateEndpoints = candidates.filter(ep => {
    if (!ep || seen.has(ep)) return false;
    seen.add(ep);
    return true;
  });

  let res = null, data = null, fetchErr = null, lastUrl = '';
  for (const ep of candidateEndpoints) {
    try {
      lastUrl = ep;
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
    if(String(data?.error||'').startsWith('PRO_FEATURE_REQUIRED')){
      const suffix=String(data.error).replace(/^PRO_FEATURE_REQUIRED_?/,'').toLowerCase();
      const feature=Object.keys(BLUEGATE_PRO_FEATURES).find(k=>k.toUpperCase()===suffix.toUpperCase())||suffix;
      showProUpgrade(feature);
    }
    const errMsg = data?.message || data?.error || fetchErr?.message || 'خطا در ارتباط با سرور';
    const err = new Error(lastUrl ? (errMsg + ' [' + lastUrl + ']') : errMsg);
    if (data?.error) err.code = data.error;
    if (data) Object.assign(err, data);
    throw err;
  }
  if(action==='me'&&data&&typeof data==='object')window.__bluegateState=data;
  return data;
  } finally { finishCommandLoader(); }
}
/* ===== Batch 1 utilities: haptic, chime, confetti, pull-to-refresh, charts, lightbox, stepper ===== */
function haptic(t='light'){try{tg?.HapticFeedback?.impactOccurred?.(t)}catch(e){}}
function hapticNotify(t='success'){try{tg?.HapticFeedback?.notificationOccurred?.(t)}catch(e){}}
function playChime(){try{const ctx=new(window.AudioContext||window.webkitAudioContext)();[523.25,659.25,783.99].forEach((f,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.value=f;o.type='sine';const t0=ctx.currentTime+i*0.1;g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(0.12,t0+0.02);g.gain.exponentialRampToValueAtTime(0.001,t0+0.35);o.start(t0);o.stop(t0+0.4)})}catch(e){}}
function fireConfetti(){try{const c=document.createElement('canvas');c.className='confetti-canvas';c.width=innerWidth;c.height=innerHeight;c.style.cssText='position:fixed;inset:0;z-index:9999;pointer-events:none';document.body.appendChild(c);const cx=c.getContext('2d'),colors=['#8b5cf6','#22c55e','#f59e0b','#ec4899','#8b5cf6','#ef4444','#06b6d4','#fde047'];const P=[];for(let i=0;i<90;i++)P.push({x:c.width/2+(Math.random()-0.5)*80,y:c.height*0.35,vx:(Math.random()-0.5)*14,vy:Math.random()*-12-5,grav:0.35+Math.random()*0.25,sz:5+Math.random()*8,col:colors[0|Math.random()*colors.length],rot:Math.random()*6.28,vr:(Math.random()-0.5)*0.3,life:1});let fr=0;(function anim(){fr++;cx.clearRect(0,0,c.width,c.height);let alive=false;P.forEach(p=>{if(p.life<=0)return;alive=true;p.x+=p.vx;p.y+=p.vy;p.vy+=p.grav;p.vx*=0.99;p.rot+=p.vr;if(fr>90)p.life-=0.04;cx.save();cx.globalAlpha=Math.max(0,p.life);cx.translate(p.x,p.y);cx.rotate(p.rot);cx.fillStyle=p.col;cx.fillRect(-p.sz/2,-p.sz/2,p.sz,p.sz*0.6);cx.restore()});if(alive&&fr<210)requestAnimationFrame(anim);else c.remove()})()}catch(e){}}
function celebrate(){hapticNotify('success');playChime();fireConfetti()}
let lastReferralsCount=-1,lastDeliveredOrderId=null;
function checkAndCelebrate(){const u=state?.user;if(u){if(lastReferralsCount>=0&&Number(u.referrals_count)>lastReferralsCount){celebrate();showStatus('🎉 زیرمجموعه جدید اضافه شد!')}lastReferralsCount=Number(u.referrals_count)}if(currentOrderId&&currentTab==='orders'){const o=orderById(currentOrderId);if(o&&o.status==='delivered'&&lastDeliveredOrderId!==currentOrderId){lastDeliveredOrderId=currentOrderId;celebrate()}}}
function orderStepperHtml(o){const steps=[{key:'payment',label:'پرداخت',icon:'💳',hint:'ثبت سفارش'},{key:'review',label:'بررسی',icon:'🔍',hint:'تایید رسید'},{key:'preparing',label:'آماده‌سازی',icon:'📦',hint:'آماده‌سازی سرویس'},{key:'delivered',label:'تحویل',icon:'✅',hint:'تحویل نهایی'}];const canceled=['rejected','canceled','refunded'].includes(o.status);if(canceled)return `<div class="order-stepper canceled"><div class="stepper-cancel"><span class="step-circle cancel">✕</span><div><b>سفارش ${esc(o.status_fa||o.status)}</b><small>${esc(o.stage_description||'این سفارش کامل نشد')}</small></div></div></div>`;const cur=Math.max(0,Math.min(3,Number.isFinite(Number(o.stage_index))?Number(o.stage_index):o.status==='delivered'?3:o.status==='preparing'||o.status==='payment_confirmed'?2:o.status==='reviewing'||o.status==='receipt_submitted'?1:0));return `<div class="order-stepper">${steps.map((s,i)=>{const done=i<cur,active=i===cur;return `<div class="step ${done?'done':''} ${active?'active':''}"><div class="step-circle">${done?'✓':s.icon}</div><span class="step-label">${s.label}</span><small class="step-hint">${s.hint}</small>${i<steps.length-1?`<div class="step-line ${i<cur?'done':''}"></div>`:''}</div>`}).join('')}</div>`}
function orderStageLabel(o){return o.stage_label||({pending_payment:'پرداخت',receipt_submitted:'بررسی',reviewing:'بررسی',payment_confirmed:'آماده‌سازی',preparing:'آماده‌سازی',delivered:'تحویل',rejected:'رد شده',canceled:'لغو شده',refunded:'مرجوع شده'}[o.status]||o.status_fa||'در حال پردازش')}
/* Pull-to-refresh */
let _ptrAttached=false,_ptrStartX=0,_ptrStartY=0,_ptrPulling=false,_ptrLocked=false,_ptrCanceled=false,_ptrDist=0,_ptrIndicator=null;
function ptrResetVisual(){if(!_ptrIndicator)return;_ptrIndicator.classList.remove('ready');_ptrIndicator.style.opacity='';const arcFill=_ptrIndicator.querySelector('.ptr-arc-fill');const arcWrapper=_ptrIndicator.querySelector('.ptr-arc-wrapper');const lbl=_ptrIndicator.querySelector('.ptr-label');if(arcWrapper&&!_ptrIndicator.classList.contains('loading'))arcWrapper.style.transform='';if(arcFill&&!_ptrIndicator.classList.contains('loading'))arcFill.style.strokeDashoffset='100.53';if(lbl&&!_ptrIndicator.classList.contains('loading'))lbl.textContent='برای رفرش بکش...'}
function ptrGestureBlocked(target){return Boolean(target?.closest?.('.presentation-sheet.open,.preview-sheet.open,.cart-sheet.open,.wallet-confirm-sheet.open,.share-sheet.open,.category-strip,.h-scroll,.product-grid-wrap,.admin-tabs,.order-filters,[data-horizontal-scroll]'))}
function attachPullToRefresh(){if(_ptrAttached)return;_ptrAttached=true;const THRESHOLD=88,DEAD_ZONE=10,DIRECTION_RATIO=1.2;_ptrIndicator=document.createElement('div');_ptrIndicator.className='ptr-indicator';_ptrIndicator.innerHTML=`<div class="ptr-arc-wrapper"><svg class="ptr-arc" viewBox="0 0 40 40"><circle class="ptr-arc-bg" cx="20" cy="20" r="16"/><circle class="ptr-arc-fill" cx="20" cy="20" r="16" transform="rotate(-90 20 20)"/></svg></div><span class="ptr-label">برای رفرش بکش...</span>`;document.body.appendChild(_ptrIndicator);document.addEventListener('touchstart',e=>{const t=e.touches?.[0];_ptrPulling=false;_ptrLocked=false;_ptrCanceled=false;_ptrDist=0;if(!t||scrollY>0||ptrGestureBlocked(e.target))return;_ptrStartX=t.clientX;_ptrStartY=t.clientY;_ptrPulling=true;ptrResetVisual()},{passive:true});document.addEventListener('touchmove',e=>{if(!_ptrPulling||_ptrCanceled)return;const t=e.touches?.[0];if(!t)return;const dx=t.clientX-_ptrStartX,dy=t.clientY-_ptrStartY,ax=Math.abs(dx),ay=Math.abs(dy);if(!_ptrLocked){if(Math.max(ax,ay)<DEAD_ZONE)return;if(ax>ay){_ptrCanceled=true;_ptrPulling=false;ptrResetVisual();return}if(dy<=0||ay<ax*DIRECTION_RATIO){_ptrCanceled=true;_ptrPulling=false;ptrResetVisual();return}_ptrLocked=true}if(ax>ay*1.05){_ptrCanceled=true;_ptrPulling=false;ptrResetVisual();return}_ptrDist=Math.max(0,dy);if(_ptrDist>0&&_ptrDist<155){_ptrIndicator.style.opacity=Math.min(1,_ptrDist/THRESHOLD);const arcFill=_ptrIndicator.querySelector('.ptr-arc-fill');const arcWrapper=_ptrIndicator.querySelector('.ptr-arc-wrapper');if(arcFill){const progress=Math.min(1,_ptrDist/THRESHOLD);arcFill.style.strokeDashoffset=100.53*(1-progress)}if(arcWrapper)arcWrapper.style.transform=`rotate(${_ptrDist*2.2}deg)`;_ptrIndicator.classList.toggle('ready',_ptrDist>THRESHOLD);const lbl=_ptrIndicator.querySelector('.ptr-label');if(lbl)lbl.textContent=_ptrDist>THRESHOLD?'رها کن':'برای رفرش بکش...'}else if(_ptrDist<=0){ptrResetVisual()}},{passive:true});document.addEventListener('touchend',async()=>{if(!_ptrPulling){_ptrCanceled=false;_ptrLocked=false;_ptrDist=0;return}_ptrPulling=false;const shouldRefresh=_ptrLocked&&!_ptrCanceled&&_ptrDist>THRESHOLD;if(shouldRefresh){_ptrIndicator.classList.add('loading');const arcWrapper=_ptrIndicator.querySelector('.ptr-arc-wrapper');if(arcWrapper)arcWrapper.style.animation='ptrSpin .8s linear infinite';const arcFill=_ptrIndicator.querySelector('.ptr-arc-fill');if(arcFill)arcFill.style.strokeDashoffset='20';const lbl=_ptrIndicator.querySelector('.ptr-label');if(lbl)lbl.textContent='در حال بارگذاری...';const st=Date.now();try{await reloadCurrentPage()}catch(e){}const el=Date.now()-st;setTimeout(()=>{_ptrIndicator.classList.remove('loading','ready');if(arcWrapper){arcWrapper.style.animation='';arcWrapper.style.transform=''}if(arcFill)arcFill.style.strokeDashoffset='100.53';if(lbl)lbl.textContent='برای رفرش بکش...';_ptrIndicator.style.opacity=''},Math.max(0,700-el))}else ptrResetVisual();_ptrDist=0;_ptrLocked=false;_ptrCanceled=false},{passive:true});document.addEventListener('touchcancel',()=>{_ptrPulling=false;_ptrLocked=false;_ptrCanceled=false;_ptrDist=0;ptrResetVisual()},{passive:true})}
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
let _initialLoaderShown=false;
async function load({force=false}={}){
  if(_bootPromise&&!force)return _bootPromise;
  _bootPromise=(async()=>{
    // Show the full-screen loader only for the first boot attempt in this page session.
    // Forced refreshes/reloads must not retrigger it.
    const finishInitialLoader=(!_initialLoaderShown)?( _initialLoaderShown=true, BlueGateCommandLoader.show('initial_boot') ):(()=>{});
    try {
    const ctx=miniBootContext();
    console.info('[BlueGate MiniApp boot]',ctx);
    setMiniBootState('loading');
    try{showSkeleton();}catch(_){}
    try{
      try{tg?.ready?.();tg?.expand?.();}catch(e){console.warn('[BlueGate MiniApp] Telegram ready/expand failed',e?.message||e)}
      applyDeviceLayout();
      // Telegram's external SDK can be slower than our own deferred bundle on some
      // Telegram Desktop/Android WebViews. Wait for the bridge before classifying this
      // launch as a normal web visit, otherwise admins silently fall back to the user shell.
      const bridge=await waitForTelegramBridge();
      const telegramContext=Boolean(bridge.telegram);
      if(telegramContext && !bridge.initData){
        const err=new Error('اطلاعات امن ورود تلگرام دریافت نشد. Mini App را کامل ببند و دوباره از دکمه داخل ربات باز کن.');
        err.error='TELEGRAM_INIT_DATA_MISSING';
        throw err;
      }
      // Resolve identity first, then decide which panel to render. Generic Telegram links no
      // longer depend on ?admin=1: an authenticated admin automatically receives Admin Mini App.
      const identityPayload=telegramContext ? await api('telegram_boot') : await api('me');
      if(telegramContext && (identityPayload?.is_guest || identityPayload?.user?.is_guest || !identityPayload?.user)){
        const err=new Error('تلگرام هویت کاربر را تأیید نکرد. Mini App را دوباره از داخل ربات باز کن.');
        err.error='TELEGRAM_SESSION_NOT_RESOLVED';
        throw err;
      }
      const backendIsAdmin=Boolean(identityPayload?.is_admin);
      isAdminMode = forceUserMode ? false : backendIsAdmin;
      if(forceAdminMode && !backendIsAdmin){
        console.warn('[BlueGate MiniApp] admin mode was requested but backend did not authorize this user; falling back to user mode');
        isAdminMode=false;
      }
      document.documentElement.dataset.bluegateRole=isAdminMode?'admin':'user';

      if(isAdminMode){
        adminState=await api('admin_summary');
        if(!adminState.license && identityPayload?.license)adminState.license=identityPayload.license;
        applyTheme(adminState.settings||identityPayload||{});
        $('userApp')?.classList.add('hidden');
        $('adminApp')?.classList.remove('hidden');
        renderAdmin();
        try{startAdminLivePolling();}catch(_){}
      }else{
        state=identityPayload;
        applyTheme(state||{});
        $('adminApp')?.classList.add('hidden');
        $('userApp')?.classList.remove('hidden');
        // Hydrate optional service/wishlist/notification data before the first visible render.
        // This prevents the old render -> hydration -> second render flash.
        try{await hydrateMiniEnhancements({force:true,render:false})}catch(_){}
        renderUser();
        initAuthHandlers();
        updateAuthUI(state);
        syncMiniAuthChrome();
        try{checkAndCelebrate();}catch(_){}
        try{handleDeepLink();}catch(e){console.warn('[BlueGate MiniApp] deep link failed',e?.message||e)}
        try{showOnboarding();}catch(_){}
      }
      try{hideSkeleton();}catch(_){}
      setMiniBootState('ready');
      try{startLicensePolling();}catch(_){}
      return isAdminMode?adminState:state;
    }catch(e){
      console.error('[BlueGate MiniApp boot failed]',{...ctx,code:e?.error||'',message:e?.message||String(e)});
      try{hideSkeleton();}catch(_){}
      setMiniBootState('error',e?.message||'اتصال به BlueGate برقرار نشد.');
      throw e;
    }
    } finally { finishInitialLoader(); }
  })();
  try{return await _bootPromise}finally{if(document.documentElement.dataset.bootState==='error')_bootPromise=null}
}
/* Charts (SVG / CSS, no external lib) */
function last7DaysRevenue(orders){const days=[];const now=new Date();for(let i=6;i>=0;i--){const d=new Date(now);d.setDate(d.getDate()-i);const ds=d.toISOString().slice(0,10);const rev=orders.filter(o=>{const od=String(o.created_at||'').slice(0,10);return ds===od&&['payment_confirmed','preparing','delivered'].includes(o.status)}).reduce((s,o)=>s+Number(o.final_amount||0),0);days.push({date:ds,label:['ی','د','س','چ','پ','ج','ش'][d.getDay()],rev})}return days}
function sparklineHtml(data){if(!data||!data.length)return '';const max=Math.max(...data.map(d=>d.rev),1);const w=280,h=56,pad=4;const pts=data.map((d,i)=>{const x=pad+(i*(w-2*pad))/(data.length-1);const y=h-pad-(d.rev/max)*(h-2*pad);return [x,y]});const poly=pts.map(p=>p.join(',')).join(' ');const area=`${pad},${h-pad} ${poly} ${w-pad},${h-pad}`;const labels=data.map((d,i)=>`<text x="${pad+(i*(w-2*pad))/(data.length-1)}" y="${h-1}" text-anchor="middle" font-size="9" fill="#9fb0c8">${d.label}</text>`).join('');const dots=pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="var(--accent)"/>`).join('');return `<svg class="sparkline" viewBox="0 0 ${w} ${h+12}" width="100%" height="68"><polygon points="${area}" fill="color-mix(in srgb,var(--accent) 18%,transparent)" stroke="none"/><polyline points="${poly}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>${dots}${labels}</svg>`}
function barChartHtml(items){if(!items||!items.length)return '<p class="muted empty-state">داده‌ای نیست.</p>';const max=Math.max(...items.map(i=>Number(i.c||0)),1);return `<div class="bar-chart">${items.map((it,i)=>{const pct=Math.round((Number(it.c||0)/max)*100);const colors=['var(--accent)','var(--success)','var(--warning)','#8b5cf6','#ec4899'];return `<div class="bar-row"><span class="bar-label">${esc(it.name||'')}</span><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:linear-gradient(90deg,${colors[i%5]},color-mix(in srgb,${colors[i%5]} 50%,#000))"></div></div><span class="bar-value">${nf(it.c||0)}</span></div>`}).join('')}</div>`}
function pieChartHtml(orders){const methods={};orders.forEach(o=>{const m=o.payment_method||'unknown';methods[m]=(methods[m]||0)+1});const total=orders.length;if(!total)return '<p class="muted empty-state">سفارشی نیست.</p>';const labels={card:'کارت',wallet:'اعتبار BlueGate',stars:'Stars',crypto:'رمزارز',unknown:'نامشخص'};const colors={card:'#8b5cf6',wallet:'#22c55e',stars:'#f59e0b',crypto:'#8b5cf6',unknown:'#64748b'};const entries=Object.entries(methods).filter(([,c])=>c>0);let acc=0;const segs=entries.map(([k,c])=>{const pct=c/total*100;const s=acc;acc+=pct;return {k,c,pct,start:s,color:colors[k]||'#64748b'}});const grad=segs.map(s=>`${s.color} ${s.start}% ${s.start+s.pct}%`).join(', ');return `<div class="pie-wrap"><div class="pie" style="background:conic-gradient(${grad})"><div class="pie-hole"><b>${nf(total)}</b><span>سفارش</span></div></div><div class="pie-legend">${entries.map(([k,c])=>`<div class="pie-legend-row"><span class="pie-dot" style="background:${colors[k]||'#64748b'}"></span><span>${labels[k]||k}</span><b>${nf(c)}</b></div>`).join('')}</div></div>`}
/* Lightbox */
function openLightbox(url,caption=''){prepareMiniLayer('lightbox');const lb=$('lightbox');if(!lb)return;lb.innerHTML=`<div class="lightbox-backdrop"></div><img src="${esc(url)}" alt="${esc(caption)}"><button class="lightbox-close">✕</button>${caption?`<p class="lightbox-caption">${esc(caption)}</p>`:''}`;lb.classList.add('open');lb.querySelector('.lightbox-backdrop')?.addEventListener('click',()=>closeLightbox());lb.querySelector('.lightbox-close')?.addEventListener('click',()=>closeLightbox())}
function closeLightbox(){const lb=$('lightbox');if(lb)lb.classList.remove('open')}
async function loadReceiptImage(orderId){try{haptic('light');showStatus('در حال دریافت رسید...');const r=await api('get_receipt_url',{order_id:orderId});if(r.url){openLightbox(r.url,`رسید سفارش #${nf(orderId)}`);showStatus('')}else{showStatus('رسید قابل دریافت نبود','error')}}catch(e){showStatus(e.message||'خطا در دریافت رسید','error')}}
async function loadCreditTopupReceipt(topupId){try{haptic('light');showStatus('در حال دریافت رسید شارژ...');const r=await api('get_credit_topup_receipt_url',{topup_id:Number(topupId)});if(r.url){openLightbox(r.url,`رسید افزایش اعتبار #${nf(topupId)}`);showStatus('')}else{showStatus('رسید قابل دریافت نبود','error')}}catch(e){showStatus(e.message||'خطا در دریافت رسید شارژ','error')}}
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
function openCartSheet(){prepareMiniLayer('cartSheet');const s=$('cartSheet');if(!s)return;s.innerHTML=cartSheetHtml();s.classList.add('open');s.style.display='flex';haptic('light');bindCartEvents(s)}
function closeCartSheet(){const s=$('cartSheet');if(s){s.classList.remove('open');setTimeout(()=>{if(!s.classList.contains('open'))s.style.display='none';},300)}}
function bindCartEvents(s){if(!s)return;s.querySelector('#cartCloseBtn')?.addEventListener('click',closeCartSheet);s.querySelector('#cartCloseBtnEmpty')?.addEventListener('click',closeCartSheet);s.querySelector('.cart-sheet-handle')?.addEventListener('click',closeCartSheet);s.querySelector('#cartClearBtn')?.addEventListener('click',()=>{cartClear();openCartSheet()});s.querySelector('#cartCheckoutBtn')?.addEventListener('click',cartCheckout);s.querySelectorAll('[data-cart-inc]').forEach(btn=>{btn.addEventListener('click',e=>{const idx=Number(e.currentTarget.dataset.cartInc);cartQty(idx,1);openCartSheet()})});s.querySelectorAll('[data-cart-dec]').forEach(btn=>{btn.addEventListener('click',e=>{const idx=Number(e.currentTarget.dataset.cartDec);cartQty(idx,-1);openCartSheet()})});s.querySelectorAll('[data-cart-del]').forEach(btn=>{btn.addEventListener('click',e=>{const idx=Number(e.currentTarget.dataset.cartDel);cartRemove(idx);openCartSheet()})});s.addEventListener('click',e=>{if(e.target===s)closeCartSheet()})}
function cartSheetHtml(){
  const icon=(name)=>({
    cart:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3.5h3l2.6 12a2 2 0 0 0 2 1.5h7.6a2 2 0 0 0 2-1.5L21 7.5H6"/></svg>',
    close:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
    bag:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l1 13H4L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
    trash:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3"/></svg>',
    plus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    minus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>',
    check:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>'
  })[name]||'';
  const header=`<div class="cart-sheet-head"><div class="cart-sheet-title-wrap"><span class="cart-sheet-kicker">BLUEGATE STORE</span><h3>سبد خرید <span class="cart-head-count">${nf(cartCount())}</span></h3><p>اقلام انتخاب‌شده و جمع کل سفارش</p></div><button class="ghost cart-close-btn" id="cartCloseBtn" aria-label="بستن سبد خرید">${icon('close')}</button></div>`;
  if(!_cart.length)return `<div class="cart-sheet-inner cart-sheet-empty">${header}<div class="cart-empty-state"><span class="cart-empty-icon">${icon('bag')}</span><h4>سبد خرید خالی است</h4><p>هنوز محصولی انتخاب نکردی. به فروشگاه برگرد و محصولات دلخواهت رو اضافه کن.</p><button class="primary cart-empty-action" id="cartCloseBtnEmpty">بازگشت به فروشگاه</button></div></div>`;
  return `<div class="cart-sheet-inner">${header}<div class="cart-items" aria-label="محصولات سبد خرید">${_cart.map((it,i)=>`<article class="cart-item"><div class="cart-item-thumb">${it.img?`<img src="${esc(it.img)}" alt="">`:icon('bag')}</div><div class="cart-item-info"><b title="${esc(it.name)}">${esc(it.name)}</b><span class="cart-item-price">${fmt(it.price)} <span class="cart-price-times">× ${nf(it.qty)}</span></span></div><div class="cart-item-qty" aria-label="تعداد"><button class="ghost cart-qty-btn" data-cart-dec="${i}" aria-label="کم کردن تعداد">${icon('minus')}</button><span>${nf(it.qty)}</span><button class="ghost cart-qty-btn" data-cart-inc="${i}" aria-label="زیاد کردن تعداد">${icon('plus')}</button></div><button class="ghost cart-item-del" data-cart-del="${i}" aria-label="حذف ${esc(it.name)}">${icon('trash')}</button></article>`).join('')}</div><div class="cart-sheet-foot"><div class="cart-total"><span>مجموع کل</span><b>${fmt(cartTotal())}</b></div><p class="cart-checkout-caption">تعداد اقلام: ${nf(cartCount())} · مبلغ نهایی بر اساس انتخاب‌های فعلی</p><div class="cart-actions"><button class="secondary" id="cartClearBtn">پاکسازی سبد</button><button class="primary" id="cartCheckoutBtn">${icon('check')} ثبت ${nf(cartCount())} سفارش</button></div></div></div>`;
}
function renderCartSheet(){const s=$('cartSheet');if(s&&s.classList.contains('open'))openCartSheet()}
/* Referral tree */
async function loadReferralTree(){try{const r=await api('my_referrals');return r.referrals||[]}catch(e){return[]}}
function referralTreeHtml(refs){
 if(!refs||!refs.length)return `<article class="wallet-card referral-tree-card referral-tree-v2"><div class="referral-tree-head"><span class="admin-card-icon" aria-hidden="true">${bgFeatureIcon('users',21)}</span><div><h3>زیرمجموعه‌های من</h3><p class="muted">کاربرانی که با لینک دعوت تو ثبت‌نام می‌کنند، اینجا نمایش داده می‌شوند.</p></div></div><div class="ref-empty-mini"><span class="ref-empty-icon" aria-hidden="true">${bgFeatureIcon('userPlus',27)}</span><b>هنوز معرفی ثبت‌شده‌ای نداری</b><p class="muted">لینک اختصاصی‌ات را برای دوستانت بفرست تا اولین معرفی اینجا ثبت شود.</p><button class="primary" id="shareInviteEmpty">${bgFeatureIcon('share',17)} اشتراک‌گذاری لینک دعوت</button></div></article>`;
 return `<article class="wallet-card referral-tree-card referral-tree-v2"><div class="referral-tree-head"><span class="admin-card-icon" aria-hidden="true">${bgFeatureIcon('users',21)}</span><div><h3>زیرمجموعه‌های من</h3><p class="muted">${nf(refs.length)} معرفی اخیر</p></div></div><div class="referral-tree-list referral-tree-list-v2">${refs.slice(0,8).map(r=>`<div class="referral-node"><div class="referral-node-avatar">${esc(String(r.first_name||r.username||'?').slice(0,1).toUpperCase())}</div><div class="referral-node-info"><b>${esc(r.first_name||r.username||'کاربر')}</b><span class="muted">${Number(r.orders_count||0)>0?nf(r.orders_count)+' خرید':'هنوز خریدی ثبت نشده'} · ${esc(String(r.joined_at||r.created_at||'').slice(0,10))}</span></div><div class="referral-node-reward">+${fmt(r.reward_amount||0)}</div></div>`).join('')}</div></article>`;
}
/* Customer 360 */
async function openCustomer360(userId){try{haptic('light');showStatus('در حال دریافت پروفایل مشتری...');const r=await api('admin_customer_view',{user_id:Number(userId)});prepareMiniLayer('custDrawer');const d=$('custDrawer');if(!d)return;const u=r.user,cs=r.customer_stats||{};const initial=esc(String(u.first_name||u.username||'?').slice(0,1).toUpperCase());d.innerHTML=`<div class="cust-drawer-inner" style="padding-top:0; overflow-x:hidden"><div class="contact-card-header"><div class="contact-card-bg"><div class="contact-card-blur">${initial}</div></div><div class="contact-card-content"><div class="cust-drawer-handle" style="background:rgba(255,255,255,0.4); margin-top:8px"></div><button class="ghost close-contact" id="custCloseBtn">✕</button><div class="contact-avatar-large">${initial}</div><h2>${esc(u.first_name||u.username||'کاربر')}</h2><p class="muted" style="margin-top:2px">ID: <code>${u.telegram_id}</code>${u.username?'<br>@'+esc(u.username):''}</p><div class="contact-actions-row">${u.username?`<div class="contact-action-btn" data-chat-user="${esc(u.username)}"><div class="ca-icon">💬</div><span>پیام</span></div>`:''}<div class="contact-action-btn" data-contact-wallet="${u.telegram_id}"><div class="ca-icon">💳</div><span>موجودی</span></div><div class="contact-action-btn danger" data-contact-ban="${u.telegram_id}"><div class="ca-icon">🚫</div><span>مسدود</span></div></div></div></div><div class="cust-stats-grid" style="margin-top:16px; padding:0 16px"><div class="cust-stat"><b>${fmt(u.balance)}</b><span>موجودی</span></div><div class="cust-stat"><b>${fmt(r.total_spent)}</b><span>کل خرید</span></div><div class="cust-stat"><b>${nf(u.referrals_count)}</b><span>زیرمجموعه</span></div><div class="cust-stat"><b>${esc(cs.tier?.emoji||'🥉')}</b><span>${esc(cs.tier?.fa||'برنز')}</span></div></div><div class="cust-section" style="padding:0 16px"><h4>🧾 سفارش‌ها (${nf(r.orders?.length||0)})</h4><div class="cust-orders">${(r.orders||[]).slice(0,8).map(o=>`<div class="cust-order-row"><div><b>#${nf(o.id)}</b> ${esc(o.display_name)}</div><span class="chip-mini chip-${o.status==='delivered'?'active':o.status==='rejected'?'off':'featured'}">${esc(o.status_fa||o.status)}</span></div>`).join('')||'<p class="muted">سفارشی نیست.</p>'}</div></div><div class="cust-section" style="padding:0 16px 20px 16px"><h4>📊 عضو از ${esc(String(u.created_at||'').slice(0,10))}</h4></div></div>`;d.classList.add('open');showStatus('');d.querySelector('#custCloseBtn')?.addEventListener('click',()=>closeCustomer360());d.querySelector('.cust-drawer-handle')?.addEventListener('click',()=>closeCustomer360())}catch(e){showStatus(e.message||'خطا در دریافت اطلاعات کاربر','error')}}
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
  prepareMiniLayer('shareSheet');
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
  const status=String(o.status||'');
  const statusLabel=esc(o.status_fa||status||'بدون وضعیت');
  const statusClass=status==='rejected'||status==='canceled'?'danger':status==='delivered'?'success':'info';
  const primaryActions=[];
  if(o.receipt_file_id) primaryActions.push(`<button class="oac-primary" data-view-receipt="${o.id}"><span>🧾</span><b>رسید</b><small>مشاهده پرداخت</small></button>`);
  if(!['payment_confirmed','preparing','delivered'].includes(status)) primaryActions.push(`<button class="oac-primary success" data-admin-status="${o.id}:payment_confirmed"><span>✓</span><b>تأیید پرداخت</b><small>مرحله بعد</small></button>`);
  if(status!=='delivered') primaryActions.push(`<button class="oac-primary" data-admin-deliver="${o.id}"><span>↗</span><b>تحویل</b><small>ثبت متن تحویل</small></button>`);
  const body=`<div class="order-control-center">
    <div class="oac-summary"><div><span class="oac-order-id">#${nf(o.id)}</span><b>${esc(o.display_name||'سفارش')}</b><small>${o.username?'@'+esc(o.username):'کاربر سفارش'}</small></div><em class="oac-status ${statusClass}">${statusLabel}</em></div>
    ${primaryActions.length?`<div class="oac-primary-grid">${primaryActions.slice(0,3).join('')}</div>`:''}
    <section class="oac-section"><header><span>👤</span><div><b>کاربر</b><small>پروفایل و ارتباط</small></div></header><div class="oac-action-grid">${o.user_id?`<button data-customer360="${o.user_id}"><span>◎</span><b>پروفایل کاربر</b></button>`:''}${o.username?`<button data-chat-user="${esc(o.username)}"><span>✉</span><b>ارسال پیام</b></button>`:''}<button data-admin-order-note="${o.id}"><span>✎</span><b>یادداشت داخلی</b></button></div></section>
    <section class="oac-section"><header><span>◫</span><div><b>وضعیت سفارش</b><small>مرحله پردازش را انتخاب کن</small></div></header><div class="oac-status-grid"><button class="${status==='reviewing'?'active':''}" data-admin-status="${o.id}:reviewing"><span>1</span><b>در بررسی</b></button><button class="${status==='payment_confirmed'?'active':''}" data-admin-status="${o.id}:payment_confirmed"><span>2</span><b>تأیید پرداخت</b></button><button class="${status==='preparing'?'active':''}" data-admin-status="${o.id}:preparing"><span>3</span><b>آماده‌سازی</b></button></div></section>
    <section class="oac-section"><header><span>⚡</span><div><b>تحویل سرویس</b><small>ساخت خودکار از پنل یا تحویل دستی</small></div></header><div class="oac-action-grid">${o.provisioning_eligible&&!['rejected','canceled','refunded'].includes(status)?`<button class="success" data-admin-provision="${o.id}"><span>⚡</span><b>ساخت و ارسال از پنل</b></button>`:''}${o.is_managed_vpn?`<button data-admin-service="${o.id}"><span>🔗</span><b>ثبت دستی لینک ساب</b></button>`:''}<button data-admin-deliver="${o.id}"><span>▤</span><b>تحویل متنی</b></button>${o.receipt_file_id?`<button data-view-receipt="${o.id}"><span>🧾</span><b>دیدن رسید</b></button>`:''}</div></section>
    <details class="oac-danger"><summary><span>⚠</span><div><b>عملیات بیشتر</b><small>رد، آرشیو و حذف</small></div><i>⌄</i></summary><div><button class="danger" data-admin-status="${o.id}:rejected">رد سفارش</button><button class="danger soft" data-admin-archive-order="${o.id}">آرشیو سفارش</button>${cleanupStatuses.includes(o.status)?`<button class="danger hard" data-admin-delete-order="${o.id}">حذف کامل</button>`:''}</div></details>
  </div>`;
  BlueGateUI.openSheet({type:'action',eyebrow:`ORDER CONTROL · #${nf(o.id)}`,title:o.display_name||'سفارش',subtitle:statusLabel,body});
}
/* VIP / loyalty progress (U8) */
function vipProgressHtml(){const u=state.user;if(!u)return '';const tier=u.customer?.tier||{};const spent=Number(u.customer?.total_spent||0);const tiers=[{name:'Bronze',fa:'برنز',emoji:'🥉',min:0},{name:'Silver',fa:'نقره',emoji:'🥈',min:1000000},{name:'Gold',fa:'طلایی',emoji:'🥇',min:5000000},{name:'Diamond',fa:'الماس',emoji:'💎',min:10000000}];let cur=0,nxt=tiers[1];for(let i=0;i<tiers.length;i++){if(spent>=tiers[i].min){cur=i;nxt=tiers[i+1]||null}}const curTier=tiers[cur];const base=curTier.min;const ceiling=nxt?nxt.min:curTier.min;const range=Math.max(1,ceiling-base);const pct=nxt?Math.min(100,Math.round((spent-base)/range*100)):100;return `<article class="wallet-card vip-card"><div class="vip-head"><span class="vip-emoji">${curTier.emoji}</span><div><h3>سطح مشتری ${curTier.fa}</h3><p class="muted">${nxt?`تا ${nxt.fa} ${nxt.emoji}: ${fmt(Math.max(0,ceiling-spent))}`:'بالاترین سطح رسیدی! 🎉'}</p></div></div><div class="vip-track"><div class="vip-fill" style="width:${pct}%"></div></div><div class="vip-tiers">${tiers.map(t=>`<span class="${t.name===curTier.name?'active':''}">${t.emoji} ${esc(t.fa)}</span>`).join('')}</div></article>`}
/* Onboarding (U10) */
const BLUEGATE_WELCOME_VERSION=1;
function shouldShowOnboarding(){if(state?.is_guest||!state?.user)return false;try{if(localStorage.getItem('bluegate_welcome_seen_v'+BLUEGATE_WELCOME_VERSION)==='1')return false}catch(_){}return Number(state.user.welcome_version_seen||0)<BLUEGATE_WELCOME_VERSION}
function showOnboarding(){prepareMiniLayer('onboarding');if(!shouldShowOnboarding())return;const o=$('onboarding');if(!o)return;const slides=[{emoji:'🛍️',title:'همه سرویس‌ها، یکجا',text:'خرید، تمدید و مدیریت سرویس‌های BlueGate را بدون خروج از Mini App انجام بده.'},{emoji:'⚡',title:'دسترسی سریع به VPN پیش‌فرض',text:'سرویس VPN را باز کن، لینک Subscription را کپی کن و تمدید را مستقیم انجام بده.'},{emoji:'🔔',title:'هیچ اطلاعیه‌ای را از دست نده',text:'تحویل سفارش، تغییرات سرویس و پیام‌های مهم BlueGate داخل مرکز اعلان‌ها نمایش داده می‌شوند.'},{emoji:'👤',title:'حساب و اعتبارت همیشه همراهته',text:'اطلاعات حساب، اعتبار، سفارش‌ها و راه‌های بازیابی دسترسی را از بخش حساب مدیریت کن.'}];let idx=0;o.innerHTML=`<div class="onb-inner welcome-v1"><button class="welcome-close" id="welcomeClose" type="button" aria-label="بستن">×</button><div class="welcome-brand"><span>BG</span><div><b>BlueGate</b><small>WELCOME</small></div></div><div class="onb-slides">${slides.map((x,i)=>`<div class="onb-slide ${i===0?'active':''}" data-onb-slide="${i}"><div class="onb-emoji">${x.emoji}</div><h2>${x.title}</h2><p>${x.text}</p></div>`).join('')}</div><div class="onb-dots">${slides.map((_,i)=>`<span class="onb-dot ${i===0?'active':''}" data-onb-dot="${i}"></span>`).join('')}</div><label class="welcome-dontshow"><input type="checkbox" id="welcomeDontShow"><span></span><b>دیگر نمایش نده</b></label><div class="onb-actions"><button class="ghost" id="onbSkip">فعلاً رد کن</button><button class="primary" id="onbNext">بعدی</button></div></div>`;o.classList.add('open');const next=$('onbNext');next?.addEventListener('click',()=>{idx++;if(idx>=slides.length){finishOnboarding();return}updateOnbSlide(idx,slides.length)});$('onbSkip')?.addEventListener('click',finishOnboarding);$('welcomeClose')?.addEventListener('click',()=>o.classList.remove('open'));o.querySelectorAll('[data-onb-dot]').forEach(d=>d.addEventListener('click',()=>{idx=Number(d.dataset.onbDot);updateOnbSlide(idx,slides.length)}))}
function updateOnbSlide(i,total){document.querySelectorAll('[data-onb-slide]').forEach(s=>s.classList.toggle('active',Number(s.dataset.onbSlide)===i));document.querySelectorAll('[data-onb-dot]').forEach(d=>d.classList.toggle('active',Number(d.dataset.onbDot)===i));$('onbNext').textContent=i>=total-1?'شروع کنیم':'بعدی'}
async function finishOnboarding(){const remember=!!$('welcomeDontShow')?.checked;$('onboarding')?.classList.remove('open');if(!remember)return;try{const r=await api('welcome_seen',{version:BLUEGATE_WELCOME_VERSION});if(state?.user)state.user.welcome_version_seen=Number(r.welcome_version_seen||BLUEGATE_WELCOME_VERSION)}catch(_){try{localStorage.setItem('bluegate_welcome_seen_v'+BLUEGATE_WELCOME_VERSION,'1')}catch(__){}}}
/* Recently viewed (U12) */
function pushRecent(pid){let r=JSON.parse(localStorage.getItem('blue_ref_recent')||'[]');r=r.filter(id=>Number(id)!==Number(pid));r.unshift(Number(pid));r=r.slice(0,8);localStorage.setItem('blue_ref_recent',JSON.stringify(r))}
function recentProductsHtml(){const ids=JSON.parse(localStorage.getItem('blue_ref_recent')||'[]');if(!ids.length)return '';const prods=ids.map(id=>(state.shop_products||[]).find(p=>Number(p.id)===Number(id))).filter(p=>p&&Number(p.parent_id||0)===0);if(!prods.length)return '';return sectionHtml('👁 اخیراً دیده‌شده',prods,'all',false)}
/* QR code (U13) — real QR via api.qrserver.com */
function qrCodeImg(text,size=200){const url='https://api.qrserver.com/v1/create-qr-code/?size='+size+'x'+size+'&data='+encodeURIComponent(text)+'&margin=8&qzone=2';return `<img src="${esc(url)}" alt="QR" width="${size}" height="${size}" style="display:block;width:100%;height:100%;border-radius:8px">`}
function openQrSheet(){prepareMiniLayer('qrSheet');const u=state.user;if(!u)return;const link=u.referral_link||'';if(!link){showStatus('لینک دعوت در دسترس نیست','error');return}const qs=$('qrSheet');if(!qs)return;qs.innerHTML=`<div class="qr-sheet-inner"><div class="qr-sheet-handle" data-close-qr></div><h3>📱 کد QR لینک دعوت</h3><p class="muted">دوستت این کد را با دوربین گوشی اسکن کنه تا مستقیم وارد بات بشه.</p><div class="qr-box">${qrCodeImg(link,200)}</div><div class="qr-link-box"><code>${esc(link)}</code></div><div class="actions"><button class="secondary" id="qrCopyBtn">📋 کپی لینک</button><button class="primary" id="qrCloseBtn">بستن</button></div></div>`;qs.classList.add('open');qs.querySelectorAll('[data-close-qr]').forEach(el=>el.addEventListener('click',closeQrSheet));$('qrCopyBtn')?.addEventListener('click',()=>{navigator.clipboard?.writeText(link);showStatus('لینک کپی شد')});$('qrCloseBtn')?.addEventListener('click',closeQrSheet)}
function closeQrSheet(){const qs=$('qrSheet');if(qs){qs.classList.remove('open');qs.innerHTML=''}}
function openPromoSheet(){prepareMiniLayer('previewSheet');const u=state.user;if(!u)return;const link=u.referral_link||'';if(!link){showStatus('لینک دعوت در دسترس نیست','error');return}const brand=state.brand||'BlueGate';const txt=`💙 با ${brand} هم سرویس‌هات رو مدیریت کن، هم از دعوت دوستات اعتبار بگیر!\n\n👥 با لینک من وارد ربات شو؛ فعالیتت زیرمجموعه من حساب می‌شه.\n🎁 پاداش دعوت، اعتبار BlueGate و گردونه شانس فعال است.\n\n🔗 ${link}`;const pv=$('previewSheet');if(!pv)return;pv.innerHTML=`<div class="preview-sheet-inner" style="padding-top: 20px;"><div class="preview-sheet-handle" data-close-preview></div><div style="text-align:center; margin-bottom: 16px;"><h3 style="font-size: 18px; margin-bottom: 8px;">📣 متن آماده تبلیغ شما</h3><p class="muted" style="font-size: 14.5px;">این متن را کپی کنید و برای دوستانتان یا در گروه‌ها بفرستید</p></div><div style="background: rgba(0,0,0,0.2); padding: 12px; border-radius: 12px; margin-bottom: 16px; font-size: 14.5px; line-height: 1.6; white-space: pre-wrap; user-select: text; text-align: right; border: 1px solid rgba(255,255,255,0.05);">${esc(txt)}</div><div class="actions" style="flex-direction: column; gap: 8px;"><button class="primary" id="copyPromoBtn" style="width: 100%;">📋 کپی متن تبلیغ</button><button class="ghost" data-close-preview style="width: 100%;">بستن</button></div></div>`;pv.classList.add('open');pv.querySelectorAll('[data-close-preview]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();closePreviewSheet()}));pv.addEventListener('click',function(ev){if(ev.target===pv)closePreviewSheet()});$('copyPromoBtn')?.addEventListener('click',()=>{navigator.clipboard?.writeText(txt);showStatus('متن تبلیغ کپی شد!');closePreviewSheet()})}
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
function openCommandPalette(){prepareMiniLayer('cmdPalette');
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
function adminFormIcon(title=''){const s=String(title);if(/پنل|Provider|اتصال/.test(s))return '🧩';if(/تخفیف|کد/.test(s))return '🎟';if(/محصول|سرویس|کاتالوگ|پلن/.test(s))return '◇';if(/انبار/.test(s))return '📦';if(/ادمین|نقش/.test(s))return '🛡';if(/کاربر|مشتری/.test(s))return '👥';if(/تنظیم/.test(s))return '⚙';return '✦'}
function openEdit(title,inputFields,onSubmit){pendingEdit=onSubmit;let sections=[];if(inputFields.length>0&&typeof inputFields[0]==='string'){sections=[{title:'',fields:inputFields.map(html=>({html}))}]}else{sections=inputFields}let body=`<div class="vy-admin-form-shell"><div class="vy-admin-form-intro"><span>${adminFormIcon(title)}</span><div><small>BLUEGATE ADMIN</small><b>${esc(title)}</b><p>تنظیمات را کامل کن؛ تغییرات بعد از ذخیره بلافاصله روی Mini App اعمال می‌شوند.</p></div></div>`;sections.forEach(sec=>{if(sec?.html){body+=sec.html;return}body+=`<section class="vy-admin-form-section">${sec?.title?`<div class="presentation-section-title"><span></span><b>${esc(sec.title)}</b></div>`:''}`;const fields=Array.isArray(sec?.fields)?sec.fields:[];body+=`<div class="form-grid">`;fields.forEach(f=>{const help=f.help?`<small class="vy-field-help">${esc(f.help)}</small>`:'';if(f.html)body+=f.html;else if(f.type==='checkbox')body+=`<label class="switch-line vy-switch-line"><span><b>${f.label}</b>${help}</span><input id="${f.id}" type="checkbox" ${f.value?'checked':''}></label>`;else if(f.type==='select')body+=`<label class="vy-form-field"><span>${f.label}</span><select id="${f.id}">${f.options}</select>${help}</label>`;else if(f.type==='textarea')body+=`<label class="full vy-form-field"><span>${f.label}</span><textarea id="${f.id}" placeholder="${f.placeholder||f.label}">${esc(f.value||'')}</textarea>${help}</label>`;else body+=`<label class="vy-form-field"><span>${f.label}</span><input id="${f.id}" type="${f.type||'text'}" value="${esc(f.value??'')}" placeholder="${f.placeholder||f.label}" ${f.props||''}>${help}</label>`});body+=`</div></section>`});body+=`</div>`;return BlueGateUI.openSheet({type:'form',eyebrow:'BLUEGATE ADMIN',title,body,footer:`<button type="button" class="secondary" data-edit-cancel>انصراف</button><button type="button" class="primary" id="presentationSaveBtn"><span>ذخیره تغییرات</span></button>`,onClose:()=>{pendingEdit=null},onOpen:(host)=>{host.classList.add('vy-admin-parity-sheet');host.querySelector('[data-edit-cancel]')?.addEventListener('click',closeEdit);host.querySelectorAll('input[type="checkbox"]').forEach(el=>el.addEventListener('change',()=>haptic?.('light')));const saveBtn=host.querySelector('#presentationSaveBtn');saveBtn?.addEventListener('click',async(e)=>{if(!pendingEdit)return;e.preventDefault();haptic?.('medium');const old=saveBtn.innerHTML;saveBtn.disabled=true;saveBtn.innerHTML='<span class="vy-btn-spinner"></span><span>در حال ذخیره…</span>';try{const res=await pendingEdit();if(res!==false)closeEdit();else{saveBtn.disabled=false;saveBtn.innerHTML=old}}catch(err){showStatus(err.message||'خطا','error');saveBtn.disabled=false;saveBtn.innerHTML=old}})}})}

function val(id){const el=$(id);return el?.type==='checkbox'?el.checked:el?.value}
function timeline(t=[]){return t?.length?`<div class="timeline order-history-timeline">${t.map((e,i)=>`<div class="order-history-event"><span class="order-history-dot">${i===t.length-1?'✓':'•'}</span><div><b>${esc(e.title)}</b><small>${esc(dateMini(e.created_at,''))}</small></div></div>`).join('')}</div>`:''}
const cleanupStatuses=['rejected','canceled','refunded'];
function canHideOrder(o){return cleanupStatuses.includes(String(o?.status||''))}
function statusClass(status){return ({delivered:'success',payment_confirmed:'success',preparing:'warning',receipt_submitted:'warning',reviewing:'warning',pending_payment:'pending',rejected:'danger',canceled:'danger',refunded:'danger'}[status]||'pending')}
function orderStatusBadge(o){return `<span class="status-badge ${statusClass(o.status)}">${esc(o.status_fa||o.status)}</span>`}
function orderById(id){return (state.orders||[]).find(o=>Number(o.id)===Number(id))}
function cryptoRateCacheText(){const c=state?.payment_methods?.crypto?.rate_cache||adminState?.settings?.crypto_rate_cache||{};const rows=Object.entries(c||{});const last=adminState?.settings?.crypto_rate_last_result||{};let out=[];if(rows.length){out=rows.map(([k,v])=>{const r=typeof v==='object'?v.rate:v;const at=typeof v==='object'?(v.updated_at||''):'';const src=typeof v==='object'?(v.source||v.provider||'cache'):'cache';return `${k}: ${Number(r||0).toLocaleString('fa-IR')} تومان · ${src}${at?' · '+at:''}`})}else out.push('هنوز cache نرخ نداریم.');if(last?.providers?.length)out.push('Providerها: '+last.providers.join(' → '));if(last?.failed&&Object.keys(last.failed).length)out.push('خطا/ fallback: '+Object.entries(last.failed).map(([k,v])=>`${k}:${v}`).join('، '));return out.join('\n')}
async function refreshCurrentOrderSilently(){if(currentTab!=='orders'||!currentOrderId)return;try{state=await api('me');applyTheme(state);renderOrders()}catch(e){console.warn('order refresh failed',e)}}

function cardImage(obj, fallback=''){
  if(!obj || !obj.image_url) return `<div class="tile-placeholder">${fallback||productCardIcon('box')}</div>`;
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
function miniIntlPrice(value,usd=null){if(window.BlueGateI18n?.language!=='en')return fmt(value);const rate=Math.max(1,Number(state?.storefront_rates?.usdt_toman||192000));const amount=usd!==null&&usd!==''?Number(usd):Number(value||0)/rate;return '$'+amount.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});}
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
    if(sale>0) return `<span>${window.BlueGateI18n?.language==='en'?'From':'از'}</span><strong>${miniIntlPrice(sale,v?.price_usd)}</strong>`;
  }
  const directDiscount=Number(p?.discount_percent||0)>0&&Number(p?.price||0)>0?Number(p.price):0;
  if(directDiscount>0) return `<span>${window.BlueGateI18n?.language==='en'?'From':'از'}</span><strong>${miniIntlPrice(directDiscount,p?.price_usd)}</strong>`;
  const min=productMinPriceNumber(p);
  if(min>0) return `<span>${window.BlueGateI18n?.language==='en'?'From':'از'}</span><strong>${miniIntlPrice(min,p?.price_usd)}</strong>`;
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
function openWalletConfirmSheet(orderId){
  const o = orderById(orderId);
  if(!o) return;
  const en=window.BlueGateI18n?.language==='en',rate=Math.max(1,Number(state.storefront_rates?.usdt_toman||192000)),irtBal=Number(state.user?.balance||0),usdBal=Number(state.user?.usd_balance||0),bal=en?usdBal+irtBal/rate:irtBal,money=v=>en?miniIntlPrice(v):fmt(v);
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
        <h3 style="font-size:18px;font-weight:900;color:var(--text);margin-bottom:6px">${en?'Pay with BlueGate balance':'کسر از موجودی اعتبار BlueGate'}</h3>
        <p class="muted" style="font-size:14.5px;line-height:1.6;margin-bottom:14px">
          ${en?'Pay for order':'آیا از پرداخت سفارش'} <b>#${nf(o.id)}</b> ${en?'for':'به مبلغ'} <b>${money(o.final_amount)}</b> ${en?'?':'اطمینان دارید؟'}<br>
          ${en?'Available balance:':'موجودی قابل پرداخت شما:'} <b style="color:#4ade80;font-size:15px">${en?'$'+bal.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4}):fmt(bal)}</b>
        </p>
      </div>
      <div style="background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.3);padding:12px;border-radius:16px;font-size:14px;color:#fde68a;line-height:1.6;margin-bottom:18px;text-align:right">
        ⚠️ <b>توجه مهم:</b> موجودی کسرشده تنها در صورت لغو سفارش به اعتبار BlueGate شما بازگردانده می‌شود.
        ${supportUser ? `<br>💬 قبل از تایید، حتماً موجودی محصول را با پشتیبانی <a href="https://t.me/${esc(supportUser)}" target="_blank" style="color:#60a5fa;text-decoration:underline">@${esc(supportUser)}</a> چک کنید.` : ''}
      </div>
      <div style="display:flex;gap:10px">
        <button class="primary" id="doWalletPayBtn" style="flex:1;padding:12px;font-size:14px;border-radius:14px">${en?'Confirm payment':'تایید و کسر از موجودی'}</button>
        <button class="ghost" id="cancelWalletPaySheet" style="flex:1;padding:12px;font-size:14px;border-radius:14px">${en?'Cancel':'انصراف'}</button>
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
  const en=window.BlueGateI18n?.language==='en',rate=Math.max(1,Number(state.storefront_rates?.usdt_toman||192000)),irtBal=Number(state.user?.balance||0),usdBal=Number(state.user?.usd_balance||0),bal=en?usdBal+irtBal/rate:irtBal,money=v=>en?miniIntlPrice(v):fmt(v);
  const methods=state.payment_methods||{wallet:{enabled:true},card:{enabled:true,accounts:[],instructions:state.payment_instructions||''},stars:{enabled:false,rate_toman:3200},crypto:{enabled:false,wallets:[],markup_percent:1}};
  const st = String(o.status || '').toLowerCase();
  if(!['pending_payment','pending','rejected'].includes(st)||Number(o.final_amount||0)<=0)return '';
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

let _orderMorePopupOrderId=0;
function closeOrderMorePopup(){const el=document.getElementById('orderMorePopup');if(el){el.classList.remove('open');document.body.classList.remove('order-more-popup-open');setTimeout(()=>el.remove(),180)}_orderMorePopupOrderId=0}
function renderOrderMorePopup(view='menu',message=''){
  const id=_orderMorePopupOrderId,o=orderById(id);if(!o){closeOrderMorePopup();return}
  const st=String(o.status||'').toLowerCase(),pending=['pending_payment','pending','awaiting_payment','receipt_submitted','reviewing','pending_review'].includes(st);
  let title='گزینه‌های بیشتر',content='';
  if(view==='menu'){
    content=`<div class="order-more-popup-options">
      <button class="order-more-popup-option" data-omp-view="note"><span class="omp-icon">✎</span><span><b>یادداشت سفارش</b><small>اطلاعات و توضیحات سفارش</small></span><i>‹</i></button>
      ${pending?`<button class="order-more-popup-option" data-omp-view="coupon"><span class="omp-icon coupon">٪</span><span><b>کد تخفیف</b><small>اعمال کد روی همین سفارش</small></span><i>‹</i></button>`:''}
      ${pending?`<button class="order-more-popup-option danger" data-omp-view="cancel"><span class="omp-icon">×</span><span><b>لغو سفارش</b><small>لغو خرید و آزادسازی رزرو</small></span><i>‹</i></button>`:''}
    </div>`;
  }else if(view==='note'){
    title='یادداشت سفارش';
    content=`<form class="order-more-popup-form" data-omp-form="note"><label for="ompNote">ایمیل، یوزرنیم، اطلاعات تحویل یا توضیح موردنیاز</label><textarea id="ompNote" rows="5" maxlength="2000" placeholder="یادداشتت رو اینجا بنویس…">${esc(o.customer_note||'')}</textarea><p class="omp-help">این یادداشت همراه همین سفارش ذخیره می‌شود.</p><div class="omp-actions"><button type="button" class="secondary" data-omp-view="menu">بازگشت</button><button class="primary" type="submit">ذخیره یادداشت</button></div></form>`;
  }else if(view==='coupon'){
    title='کد تخفیف';
    content=`<form class="order-more-popup-form" data-omp-form="coupon"><label for="ompCoupon">کد تخفیف سفارش #${nf(id)}</label><input id="ompCoupon" type="text" maxlength="80" autocomplete="off" autocapitalize="characters" placeholder="مثلاً BLUE10"><p class="omp-help">کد روی همین سفارش اعمال می‌شود.</p><div class="omp-actions"><button type="button" class="secondary" data-omp-view="menu">بازگشت</button><button class="primary" type="submit">اعمال کد</button></div></form>`;
  }else if(view==='cancel'){
    title='لغو سفارش';
    content=`<div class="order-more-popup-cancel"><div class="omp-warning-icon">!</div><h3>از لغو این سفارش مطمئنی؟</h3><p>این عملیات وضعیت سفارش را لغو می‌کند و ممکن است رزرو آیتم انبار آزاد شود.</p><div class="omp-actions"><button type="button" class="secondary" data-omp-view="menu">نه، برگشت</button><button type="button" class="danger" data-omp-confirm-cancel="${id}">بله، لغو سفارش</button></div></div>`;
  }
  const el=document.getElementById('orderMorePopup');if(!el)return;
  el.querySelector('.order-more-popup-title').textContent=title;
  el.querySelector('.order-more-popup-content').innerHTML=content;
  const err=el.querySelector('.order-more-popup-message');err.textContent=message;err.classList.toggle('show',!!message);
  if(view==='note')setTimeout(()=>el.querySelector('#ompNote')?.focus(),60);
  if(view==='coupon')setTimeout(()=>el.querySelector('#ompCoupon')?.focus(),60);
}
function openOrderMoreActions(id){
  const o=orderById(id);if(!o)return;
  closeOrderMorePopup();_orderMorePopupOrderId=Number(id);
  const el=document.createElement('div');el.id='orderMorePopup';el.className='order-more-popup';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','گزینه‌های سفارش');
  el.innerHTML=`<div class="order-more-popup-backdrop" data-omp-close></div><section class="order-more-popup-card"><header class="order-more-popup-head"><div><span>سفارش #${nf(id)}</span><h2 class="order-more-popup-title">گزینه‌های بیشتر</h2></div><button class="order-more-popup-close" type="button" aria-label="بستن" data-omp-close>×</button></header><div class="order-more-popup-message" role="status"></div><div class="order-more-popup-content"></div></section>`;
  document.body.appendChild(el);document.body.classList.add('order-more-popup-open');requestAnimationFrame(()=>el.classList.add('open'));renderOrderMorePopup();
}
document.addEventListener('click',async e=>{
 const close=e.target.closest('[data-omp-close]');if(close){closeOrderMorePopup();return}
 const view=e.target.closest('[data-omp-view]');if(view){renderOrderMorePopup(view.dataset.ompView);return}
 const cancel=e.target.closest('[data-omp-confirm-cancel]');if(cancel){const id=Number(cancel.dataset.ompConfirmCancel),btn=cancel;btn.disabled=true;btn.textContent='در حال لغو…';try{await api('cancel_order',{order_id:id});state=await api('me');currentTab='orders';currentOrderId=null;renderUser();closeOrderMorePopup();showStatus('سفارش با موفقیت لغو شد','success')}catch(err){btn.disabled=false;btn.textContent='بله، لغو سفارش';renderOrderMorePopup('cancel',err.message||'لغو سفارش انجام نشد')}return}
},{capture:true});
document.addEventListener('submit',async e=>{
 const form=e.target.closest('#orderMorePopup [data-omp-form]');if(!form)return;e.preventDefault();
 const id=_orderMorePopupOrderId,kind=form.dataset.ompForm,submit=form.querySelector('[type=submit]');if(!id)return;
 submit.disabled=true;const old=submit.textContent;submit.textContent='در حال ثبت…';
 try{
   if(kind==='note'){const note=form.querySelector('#ompNote')?.value||'';await api('customer_order_note',{order_id:id,note});state=await api('me');currentTab='orders';currentOrderId=id;renderUser();renderOrderMorePopup('note','یادداشت سفارش ذخیره شد.');showStatus('یادداشت سفارش ذخیره شد','success');}
   else if(kind==='coupon'){const code=form.querySelector('#ompCoupon')?.value.trim()||'';if(!code)throw new Error('کد تخفیف را وارد کن.');await api('apply_coupon',{order_id:id,code});state=await api('me');currentTab='orders';currentOrderId=id;renderUser();renderOrderMorePopup('coupon','کد تخفیف با موفقیت اعمال شد.');showStatus('کد تخفیف با موفقیت روی سفارش اعمال شد','success');}
 }catch(err){submit.disabled=false;submit.textContent=old;renderOrderMorePopup(kind,err.message||'عملیات انجام نشد')}
},{capture:true});

function orderDetailHtml(o){
  const en=window.BlueGateI18n?.language==='en',rate=Math.max(1,Number(state.storefront_rates?.usdt_toman||192000)),irtBal=Number(state.user?.balance||0),usdBal=Number(state.user?.usd_balance||0),bal=en?usdBal+irtBal/rate:irtBal,money=v=>en?miniIntlPrice(v):fmt(v);
  const d=Number(o.variant_discount_percent)||0;
  const basePriceHtml=`<span class="od-money-value">${money(o.amount)}</span>`;
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

  return `<section class="detail-card order-detail-page order-detail-v2 ${isVpnService(o)?'vpn-order-detail':'service-order-detail'}">
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
      </div>
      ${topTimerHtml}
    </div>

    <!-- Stepper Timeline -->
    ${orderStepperHtml(o)}

    <!-- Price Hero Card -->
    <div class="od-price-hero">
      <div class="od-price-hero-main">
        <span>${en?'Amount due':'مانده قابل پرداخت'}</span>
        <b>${money(o.final_amount)}</b>
      </div>
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
        <b>${money(o.discount_amount||0)}</b>
      </div>
      <div class="od-info-card">
        <small>نوع تحویل</small>
        <b class="od-delivery-value">${esc(o.delivery_type_fa||'-')}</b>
      </div>
      <div class="od-info-card">
        <small>روش پرداخت</small>
        <b>${esc(o.payment_method_fa||'انتخاب نشده')}</b>
      </div>
      <div class="od-info-card">
        <small>تاریخ ثبت</small>
        <b>${esc(dateMini(o.created_at))}</b>
      </div>
      ${o.expires_at ? `
      <div class="od-info-card">
        <small>انقضا</small>
        <b>${esc(o.expires_at)}</b>
      </div>` : `
      <div class="od-info-card">
        <small>پرداخت از اعتبار BlueGate</small>
        <b>${money(o.wallet_amount||0)}</b>
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
    <div class="actions sticky-actions od-sticky-actions ${o.has_service_delivery||o.has_service_viewer?'has-service-actions':'note-actions'}">
      ${(o.has_service_delivery||o.has_service_viewer) ? `<button class="primary btn-v2 mini-service-open-btn" data-service-view="${o.id}" data-service-url="${esc(o.service_url||'')}" data-service-title="${esc(o.service_title||'مدیریت سرویس')}"><span class="od-action-icon">↗</span><span>باز کردن سرویس</span></button><button class="secondary btn-v2 mini-service-copy-btn" data-service-copy-link="${o.id}" data-service-url="${esc(o.service_url||'')}"><span class="od-action-icon">⧉</span><span>کپی لینک</span></button>` : `<button class="od-note-btn btn-v2" data-customer-note="${o.id}"><span class="od-action-icon">✎</span><span>یادداشت سفارش</span></button>`}
      ${String(o.status)==="delivered"?`<button class="secondary btn-v2 od-renew-btn" data-renew-order="${o.id}"><span class="od-action-icon">↻</span><span>تمدید</span></button>`:""}<button class="od-more-btn btn-v2" aria-label="گزینه‌های بیشتر سفارش" title="گزینه‌های بیشتر" data-order-more="${o.id}"><span class="od-more-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="od-more-label">بیشتر</span></button>
    </div>
  </section>`
}
function miniScrollTop(){requestAnimationFrame(()=>{try{window.scrollTo({top:0,left:0,behavior:'auto'});if(document.scrollingElement)document.scrollingElement.scrollTop=0;document.body.scrollTop=0;document.documentElement.scrollTop=0}catch(_){}})}
function setTab(tab){
  if(!['shop','orders','wallet','support','home'].includes(tab)) tab='shop';
  currentTab=tab;
  if(tab!=='orders') currentOrderId=null;
  currentServiceOrderId=null;
  BlueGateUI?.closeSheet?.();
  saveAppLastState();
  renderUser();
  miniScrollTop();
}
function setAdminTab(tab){if(['products','categories','variants'].includes(tab))tab='catalog';if(!['dashboard','catalog','orders','more','customers','infrastructure','advanced','notifications','support','inventory','coupons','settings','activity','roles','backups'].includes(tab))tab='dashboard';currentAdminTab=tab;saveAppLastState();renderAdmin();miniScrollTop()}
function scheduleAvatarSync(){const u=state?.user||{};if(state?.is_guest||u.avatar_source==='custom'||!u.telegram_connected)return;const last=u.avatar_synced_at?Date.parse(String(u.avatar_synced_at).replace(' ','T')):0;if(last&&Date.now()-last<86400000)return;const run=async()=>{try{const fresh=await api('sync_my_telegram_avatar');if(fresh?.user){state=fresh;updateMiniHeader();if(currentTab==='home')renderHome()}}catch(_){}};if('requestIdleCallback' in window)requestIdleCallback(run,{timeout:2500});else setTimeout(run,900)}
function render(data){
  hideSkeleton();
  state=data;applyTheme(data);
  if($('helloText')) $('helloText').textContent=data.brand||'BLUEGATE';
  $('userApp').classList.toggle('hidden',isAdminMode);
  $('adminApp').classList.toggle('hidden',!isAdminMode);
  if(isAdminMode){loadAdmin().then(()=>handleTicketDeepLink());return}
  renderUser();handleTicketDeepLink();checkAndCelebrate();handleDeepLink();scheduleAvatarSync();
}
let _ticketDeepLinkHandled=false;
async function handleTicketDeepLink(){
  if(_ticketDeepLinkHandled)return;
  const startParam=String(tg?.initDataUnsafe?.start_param||getUrlFlag('startapp')||'');
  const rawId=(startParam.match(/^ticket_(\d+)$/i)||[])[1]||getUrlFlag('ticket');
  const id=Number(rawId||0);if(!Number.isSafeInteger(id)||id<=0)return;
  _ticketDeepLinkHandled=true;
  if(isAdminMode){
    currentAdminTab='support';renderAdmin();
    await openMiniAdminSupportTicket(id);
    return;
  }
  if(state?.is_guest){currentTab='support';renderUser();openAuthModal();showStatus('برای مشاهده‌ی تیکت، ابتدا وارد حساب خودت شو.','info');return;}
  currentTab='support';renderUser();await openMiniSupportTicket(id);
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
  const titles={shop:'فروشگاه',orders:'سفارش‌ها',wallet:'اعتبار',support:'تیکت‌ها',home:'حساب'};
  const title=$('brandTitle'),hello=$('helloText');
  if(title) title.textContent=titles[currentTab]||'BlueGate';
  if(hello) hello.textContent=state?.brand||'BLUEGATE';
}
function hidePages(){
  ['homePage','shopPage','ordersPage','walletPage','supportPage'].forEach(id=>$(id)?.classList.add('hidden'));
  document.querySelectorAll('.bottom-nav [data-tab], .topbar-desktop-nav [data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===currentTab));
  updateMiniHeader();updateNotificationBadge();syncOrderPolling();
}
let _orderPollTimer=null,_orderPollBusy=false,_enhancementsHydrating=false,_enhancementsHydrated=false;
function updateNotificationBadge(){const btn=$('miniNotificationsBtn'),badge=$('miniNotificationBadge');const n=Number(state?.notification_unread||0);btn?.classList.toggle('hidden',Boolean(state?.is_guest));if(badge){badge.textContent=n>99?'99+':String(n);badge.classList.toggle('hidden',n<=0)}}
function notificationIcon(n){return n.type==='delivered'?'✅':n.type==='wallet'?'💳':n.type==='important'?'⚠️':n.type==='promo'?'🎁':n.type==='service'?'⚡':n.type==='security'?'🛡️':'🔔'}
function runMiniNotificationAction(n){const a=String(n.action_type||'');const v=String(n.action_value||'');BlueGateUI.closeSheet();if(n.order_id||a==='orders'){currentTab='orders';currentOrderId=Number(n.order_id||v||0)||null;renderUser();miniScrollTop();return}if(a==='store'){currentTab='shop';renderUser();return}if(a==='wallet'){currentTab='wallet';renderUser();miniScrollTop();return}if(a==='account'||a==='profile'){currentTab='home';renderUser();return}if(a==='service'&&v){currentServiceOrderId=Number(v)||null;currentTab='home';renderUser();return}if(a==='url'&&/^https:\/\//i.test(v)){if(TG?.openLink)TG.openLink(v);else window.open(v,'_blank','noopener')}}
function openNotifications(){const list=state?.notifications||[];const unread=list.filter(n=>!n.is_read).length;const kind=n=>['delivered','wallet','important','promo','service','security'].includes(String(n.type||''))?String(n.type):'default';BlueGateUI.openSheet({type:'action',eyebrow:'BLUEGATE • UPDATES',title:'اعلان‌ها',subtitle:unread?`${nf(unread)} اعلان خوانده‌نشده`:'همه اعلان‌ها دیده شده‌اند',body:`<div class="mini-notification-feed"><div class="mini-notification-feed-head"><span>آخرین پیام‌ها</span><span class="mini-notification-total">${nf(list.length)} اعلان</span></div><div class="mini-notification-list">${list.length?list.map(n=>`<button class="mini-notification-row ${n.is_read?'':'unread'} type-${kind(n)}" data-notification-id="${n.id}"><span class="mini-notification-icon" aria-hidden="true">${notificationIcon(n)}</span><span class="mini-notification-copy"><span class="mini-notification-titleline"><b>${esc(n.title)}</b>${n.is_read?'':'<i class="mini-notification-unread-dot" aria-label="خوانده‌نشده"></i>'}</span><small>${esc(n.body||'')}</small><em><span>${esc(String(n.created_at||'').slice(0,16))}</span>${n.action_type||n.order_id?'<span class="mini-notification-action-hint">مشاهده جزئیات <span aria-hidden="true">←</span></span>':''}</em></span></button>`).join(''):'<div class="mini-notification-empty"><span class="mini-notification-empty-icon">✓</span><b>فعلاً اعلانی نیست</b><p>پیام‌های سفارش، کیف پول و به‌روزرسانی‌های BlueGate اینجا نمایش داده می‌شوند.</p></div>'}</div></div>`,onOpen:(host)=>{host.querySelectorAll('[data-notification-id]').forEach(x=>x.addEventListener('click',()=>{const n=list.find(y=>Number(y.id)===Number(x.dataset.notificationId));if(n&&(n.order_id||n.action_type))runMiniNotificationAction(n)}));}});if(Number(state?.notification_unread||0)>0){state.notification_unread=0;(state.notifications||[]).forEach(n=>n.is_read=1);updateNotificationBadge();api('notifications_read').catch(()=>{})}}
async function hydrateMiniEnhancements({force=false,render=true}={}){if(_enhancementsHydrating||state?.is_guest||(!force&&_enhancementsHydrated))return;_enhancementsHydrating=true;try{const beforeServices=JSON.stringify((state.services||[]).map(x=>[x.id,x.status,x.updated_at,x.last_sync_at,x.traffic_used_bytes,x.expires_at,x.subscription_url]));const beforeWishlist=JSON.stringify((state.wishlist_product_ids||[]).map(Number));const r=await api('mini_enhancements');if(Array.isArray(r.services))state.services=r.services;if(Array.isArray(r.wishlist_product_ids)){state.wishlist_product_ids=r.wishlist_product_ids.map(Number);try{localStorage.setItem('blue_ref_wishlist',JSON.stringify(state.wishlist_product_ids))}catch(_){}}if(Array.isArray(r.notifications))state.notifications=r.notifications;if(r.notification_unread!==undefined)state.notification_unread=Number(r.notification_unread||0);_enhancementsHydrated=true;updateNotificationBadge();if(render){const servicesChanged=beforeServices!==JSON.stringify((state.services||[]).map(x=>[x.id,x.status,x.updated_at,x.last_sync_at,x.traffic_used_bytes,x.expires_at,x.subscription_url]));const wishlistChanged=beforeWishlist!==JSON.stringify((state.wishlist_product_ids||[]).map(Number));if(currentTab==='home'&&servicesChanged)renderHome();if(currentTab==='shop'&&shopFilterWishlist&&wishlistChanged)renderShopSections()}}catch(e){console.warn('[BlueGate MiniApp enhancements] optional hydration failed',e?.message||e)}finally{_enhancementsHydrating=false}}
function scheduleMiniEnhancementsHydration(){const run=()=>hydrateMiniEnhancements({render:true}).catch(()=>{});if('requestIdleCallback' in window)requestIdleCallback(run,{timeout:1800});else setTimeout(run,250)}
async function refreshOrdersLive(){if(_orderPollBusy||document.hidden||currentTab!=='orders'||state?.is_guest)return;_orderPollBusy=true;try{const r=await api('my_orders');const before=JSON.stringify((state.orders||[]).map(o=>[o.id,o.status,o.updated_at,o.delivery_url]));const after=JSON.stringify((r.orders||[]).map(o=>[o.id,o.status,o.updated_at,o.delivery_url]));state.orders=r.orders||[];if(Array.isArray(r.services))state.services=r.services;if(Array.isArray(r.notifications))state.notifications=r.notifications;if(r.notification_unread!==undefined)state.notification_unread=Number(r.notification_unread||0);updateNotificationBadge();if(before!==after){renderOrders();hapticNotify('success')}}catch(e){console.warn('[BlueGate order poll]',e?.message||e)}finally{_orderPollBusy=false}}
function syncOrderPolling(){if(_orderPollTimer){clearInterval(_orderPollTimer);_orderPollTimer=null}if(currentTab==='orders'&&!state?.is_guest){_orderPollTimer=setInterval(refreshOrdersLive,18000);setTimeout(refreshOrdersLive,700)}}
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(_orderPollTimer){clearInterval(_orderPollTimer);_orderPollTimer=null}}else{syncOrderPolling();scheduleMiniEnhancementsHydration();refreshLicenseUiState().catch(()=>{})}});
function renderUser(){
  saveAppLastState();hidePages();updateCartFab();
  if(currentTab==='home'){ $('homePage').classList.remove('hidden'); renderHome(); }
  else if(currentTab==='orders'){ $('ordersPage').classList.remove('hidden'); renderOrders(); }
  else if(currentTab==='wallet'){ $('walletPage').classList.remove('hidden'); renderWallet(); }
  else if(currentTab==='support'){ $('supportPage').classList.remove('hidden'); renderMiniSupportPage(); }
  else { currentTab='shop'; $('shopPage').classList.remove('hidden'); renderShop(); }
  updateMiniHeader();
  // Animate only real page changes; repeated data refreshes on the same page stay still.
  const activePage=document.querySelector('.page:not(.hidden)');
  if(activePage){
    const pageKey=currentTab+(currentOrderId?':order:'+currentOrderId:'')+(currentServiceOrderId?':service:'+currentServiceOrderId:'');
    if(document.documentElement.dataset.bgCurrentPage!==pageKey){
      document.documentElement.dataset.bgCurrentPage=pageKey;
      activePage.classList.remove('bg-page-enter');void activePage.offsetWidth;activePage.classList.add('bg-page-enter');
      activePage.addEventListener('animationend',()=>activePage.classList.remove('bg-page-enter'),{once:true});
    }
  }
}
function myServiceById(id){
  const n=Number(id||0);
  if(n<0){const o=(state.orders||[]).find(x=>Number(x.id)===Math.abs(n));return o?{...o,id:n,order_id:Number(o.id),_manual_order:true,subscription_url:o.service_url||o.delivery_url||null,status:o.status==='delivered'?'active':o.status}:null;}
  return (state.services||[]).find(x=>Number(x.id)===n)||(state.orders||[]).find(x=>Number(x.id)===n)||null;
}
function serviceHubItems(){
  const managed=[...(state.services||[])];const represented=new Set(managed.map(x=>Number(x.order_id||0)).filter(Boolean));
  const manual=(state.orders||[]).filter(o=>o.status==='delivered'&&isVpnService(o)&&String(o.service_url||o.delivery_url||'').trim()&&!represented.has(Number(o.id))).map(o=>({...o,id:-Number(o.id),order_id:Number(o.id),_manual_order:true,subscription_url:o.service_url||o.delivery_url,status:'active',display_name:o.display_name||o.product_name||'سرویس VPN'}));
  return [...managed,...manual];
}
function isVpnService(o){
  if(!o)return false;
  // Backend capabilities are authoritative. Never infer VPN from product names such as Pro/Standard.
  return o.is_managed_vpn===true||Number(o.is_managed_vpn)===1||o.delivery_mode==='managed_vpn';
}
function bytesFa(v){const n=Number(v||0);if(!n)return '0 GB';return (n/1073741824).toLocaleString('fa-IR',{maximumFractionDigits:1})+' GB'}
function serviceForOrder(o){
  if(!o)return null;
  const managed=(state.services||[]).find(x=>Number(x.order_id||0)===Number(o.id)||Number(x.id||0)===Number(o.user_service_id||0));
  if(managed)return managed;
  if(!isVpnService(o))return null;
  return {...o,id:-Number(o.id),order_id:Number(o.id),_manual_order:true,subscription_url:o.service_url||o.delivery_url||null,status:o.status==='delivered'?'active':o.status,display_name:o.display_name||o.product_name||'سرویس VPN'};
}
function vpnStatusFa(s){s=String(s||'active').toLowerCase();return s==='active'?'فعال':s==='preparing'||s==='provisioning'?'در حال ساخت':s==='payment_confirmed'?'پرداخت تایید شده':s==='pending_payment'||s==='pending'?'در انتظار پرداخت':s==='suspended'?'متوقف':s==='expired'?'منقضی':s==='degraded'?'نیازمند بررسی':s==='provisioning_failed'?'خطای ساخت':s}
function vpnDaysLeft(v){if(!v)return null;const t=Date.parse(String(v).replace(' ','T'));if(!Number.isFinite(t))return null;return Math.max(0,Math.ceil((t-Date.now())/86400000))}
function vpnFlagToCode(flag){try{return [...String(flag)].map(c=>String.fromCharCode(c.codePointAt(0)-0x1F1E6+65)).join('')}catch(_){return''}}
const VPN_LOCATION_FA={TR:'ترکیه',DE:'آلمان',SE:'سوئد',GB:'انگلستان',NL:'هلند',FR:'فرانسه',FI:'فنلاند',US:'آمریکا',CA:'کانادا',AE:'امارات',IR:'ایران',CH:'سوئیس',AT:'اتریش',IT:'ایتالیا',ES:'اسپانیا',PL:'لهستان',RO:'رومانی',CZ:'چک',NO:'نروژ',DK:'دانمارک',RU:'روسیه',JP:'ژاپن',SG:'سنگاپور',IN:'هند',HK:'هنگ‌کنگ',AU:'استرالیا',BR:'برزیل',ZA:'آفریقای جنوبی',IE:'ایرلند',BE:'بلژیک',PT:'پرتغال',UA:'اوکراین',GR:'یونان',BG:'بلغارستان'};
const VPN_LOCATION_WORDS=[['turkey','TR','🇹🇷'],['türkiye','TR','🇹🇷'],['germany','DE','🇩🇪'],['deutschland','DE','🇩🇪'],['sweden','SE','🇸🇪'],['stockholm','SE','🇸🇪'],['uk','GB','🇬🇧'],['england','GB','🇬🇧'],['london','GB','🇬🇧'],['netherlands','NL','🇳🇱'],['holland','NL','🇳🇱'],['france','FR','🇫🇷'],['finland','FI','🇫🇮'],['usa','US','🇺🇸'],['united states','US','🇺🇸'],['canada','CA','🇨🇦'],['emirates','AE','🇦🇪'],['dubai','AE','🇦🇪'],['iran','IR','🇮🇷'],['switzerland','CH','🇨🇭'],['italy','IT','🇮🇹'],['spain','ES','🇪🇸'],['poland','PL','🇵🇱'],['romania','RO','🇷🇴'],['norway','NO','🇳🇴'],['denmark','DK','🇩🇰'],['russia','RU','🇷🇺'],['japan','JP','🇯🇵'],['singapore','SG','🇸🇬'],['india','IN','🇮🇳'],['australia','AU','🇦🇺']];
function vpnTargetNames(o){const out=[];(o.instances||[]).forEach(i=>{(i.targets||[]).forEach(t=>{const n=String(t.remote_target_name||'').trim();if(n)out.push(n)})});return out}
function vpnSmartLocations(o){const found=new Map();for(const name of vpnTargetNames(o)){const flags=name.match(/[\u{1F1E6}-\u{1F1FF}]{2}/gu)||[];for(const flag of flags){const code=vpnFlagToCode(flag);if(code&&!found.has(code))found.set(code,{code,flag,name:VPN_LOCATION_FA[code]||name.replace(/[\u{1F1E6}-\u{1F1FF}]{2}/gu,'').trim()||code})}if(flags.length)continue;const low=name.toLowerCase();for(const [word,code,flag] of VPN_LOCATION_WORDS){if(low.includes(word)&&!found.has(code)){found.set(code,{code,flag,name:VPN_LOCATION_FA[code]||name});break}}}return [...found.values()]}
function miniVpnClientRows(o){
  const rows=[];const seen=new Set();
  for(const i of (o.instances||[])){
    const name=String(i.client_name||i.external_username||'').trim();
    const sid=String(i.sub_id||'').trim();
    const cid=String(i.client_id||i.external_client_id||'').trim();
    const provider=String(i.provider_name||'').trim();
    const key=[name,sid,cid,provider].join('|');if((!name&&!sid&&!cid)||seen.has(key))continue;seen.add(key);rows.push({name,sid,cid,provider});
  }
  return rows;
}
function miniVpnClientSummary(o){const r=miniVpnClientRows(o);if(!r.length)return '';const names=[...new Set(r.map(v=>v.name).filter(Boolean))];return names.length===1?names[0]:`${names.length||r.length} Client`;}
function miniVpnClientIdentityHtml(o){const rows=miniVpnClientRows(o);if(!rows.length)return '';
  return `<article class="vpn-client-card"><header><small>CLIENT IDENTITY</small><h3>شناسه اشتراک</h3></header><div class="vpn-client-list">${rows.map((r,idx)=>`<section><div><small>${r.provider?esc(r.provider):`Client ${idx+1}`}</small><b>${esc(r.name||r.cid||'—')}</b></div><div><small>Sub ID</small><code>${esc(r.sid||'—')}</code></div></section>`).join('')}</div></article>`;
}
function vpnServiceDetailHtml(o,{context='service',order=null}={}){
  const rawUrl=String(o.subscription_url||o.service_url||o.delivery_url||'').trim();
  const url=/^https:\/\//i.test(rawUrl)?rawUrl:'';
  const hasUrl=!!url;
  const title=esc(o.display_name||o.product_name||'سرویس BlueGate');
  const expiry=o.expires_at?esc(String(o.expires_at)):'بدون تاریخ انقضا';
  const limit=Number(o.traffic_limit_bytes||0),used=Number(o.traffic_used_bytes||0),remaining=Math.max(0,limit-used),pct=limit?Math.min(100,Math.round(used/limit*100)):0;
  const status=String(o.status||'active');const statusFa=vpnStatusFa(status);const add=o.addons||{};const manual=!!o._manual_order;const clientName=miniVpnClientSummary(o)||o.client_username||'';
  const days=vpnDaysLeft(o.expires_at);const smartLocations=vpnSmartLocations(o);const locations=smartLocations.length||((o.instances||[]).length?1:0);
  const back=context==='order'?`<button class="vpn-sub-back" data-vpn-detail-back="orders">‹ <span>سفارش‌ها</span></button>`:`<button class="vpn-sub-back" data-vpn-detail-back="services">‹ <span>VPNهای من</span></button>`;
  const orderId=Number(order?.id||o.order_id||0);
  const waitingPay=order&&['pending_payment','pending','rejected'].includes(String(order.status||''));
  const topActions=waitingPay?'':`${manual?`<button class="vpn-top-action primary" data-renew-order="${o.order_id}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9A7 7 0 0 1 18 6.5L20 12M4 12l2 5.5A7 7 0 0 0 18.4 15"/></svg><span>تمدید سرویس</span></button>`:`<button class="vpn-top-action primary" data-service-renew="${o.id}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9A7 7 0 0 1 18 6.5L20 12M4 12l2 5.5A7 7 0 0 0 18.4 15"/></svg><span>تمدید</span></button><button class="vpn-top-action" data-service-sync="${o.id}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.5-4L4 9"/><path d="M4 4v5h5M4 13a8 8 0 0 0 14.5 4L20 15"/><path d="M20 20v-5h-5"/></svg><span>بروزرسانی</span></button>`}`;
  return `<section class="vpn-sub-page vpn-sub-page-service">
    <div class="vpn-sub-topbar">${back}<div class="vpn-sub-top-actions">${topActions}</div><div class="vpn-sub-topmeta">${orderId?`<span class="vpn-order-number"><small>شماره سفارش</small><b>#${nf(orderId)}</b></span>`:''}<b class="vpn-sub-status ${status==='active'?'ok':status==='expired'||status==='provisioning_failed'?'bad':'warn'}"><i></i>${esc(statusFa)}</b></div></div>
    <article class="vpn-sub-identity">
      <div class="vpn-sub-copy"><div><div class="vpn-sub-micro"><i></i> BLUEGATE MANAGED VPN</div><h1>${title}</h1><p>${hasUrl?'سرویس آماده استفاده است؛ لینک اشتراک را باز کن یا کپی کن.':'سرویس ثبت شده و پس از ساخت Client، لینک اشتراک فعال می‌شود.'}</p></div>
        <div class="vpn-client-summary"><span class="vpn-client-avatar" aria-hidden="true">BG</span><span><small>نام کلاینت</small><b>${esc(clientName||o.client_username||'کلاینت شما')}</b></span></div>
        <div class="vpn-sub-pills">${locations?`<span>◉ ${nf(locations)} لوکیشن</span>`:''}${orderId?`<span class="vpn-order-chip">سفارش #${nf(orderId)}</span>`:''}</div>
        ${miniVpnClientRows(o).filter(r=>r.sid).length?`<div class="vpn-sub-id-strip"><small>شناسه اشتراک</small>${miniVpnClientRows(o).filter(r=>r.sid).map(r=>'<button type="button" data-copy-subid="'+esc(r.sid)+'" title="کپی شناسه اشتراک"><code>'+esc(r.sid)+'</code><span>⧉</span></button>').join('')}</div>`:''}
      </div>
      <div class="vpn-sub-orb-wrap"><div class="vpn-sub-orb" style="--p:${pct}"><div><strong>${limit?pct.toLocaleString('fa-IR')+'٪':'∞'}</strong><span>${limit?'مصرف شده':'نامحدود'}</span></div></div><div class="vpn-traffic-inline"><div><span><i class="vpn-traffic-dot used"></i>مصرف‌شده</span><b>${limit?bytesFa(used):'—'}</b></div><div><span><i class="vpn-traffic-dot left"></i>باقی‌مانده</span><b>${limit?bytesFa(remaining):'نامحدود'}</b></div><small>${limit?`از ${bytesFa(limit)} حجم کل`:'بدون سقف ترافیک'}</small><div class="vpn-expiry-inline"><span class="vpn-expiry-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></svg></span><span class="vpn-expiry-copy"><small>اعتبار سرویس</small><b>${days===null?'بدون انقضا':nf(days)+' روز باقی‌مانده'}</b><em>${expiry}</em></span></div></div></div>
    </article>
    <article class="vpn-subscription-card ${hasUrl?'ready':'pending'}"><header><div class="vpn-subscription-heading"><span class="vpn-subscription-mark"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.7 1.7"/><path d="M14 10.5a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 19.2l1.7-1.7"/></svg></span><div><small>SUBSCRIPTION</small><h3>${hasUrl?'لینک اشتراک شما':'در حال آماده‌سازی لینک'}</h3><p>${hasUrl?'اتصال امن و مدیریت یکپارچه لوکیشن‌ها':'به‌محض آماده‌شدن سرویس، لینک اینجا نمایش داده می‌شود'}</p></div></div><span class="vpn-subscription-state">${hasUrl?'آماده':'در انتظار'}</span></header>${hasUrl?`<div class="vpn-subscription-linkbox"><code>${esc(url)}</code><button type="button" class="vpn-subscription-copy" data-service-copy-link="${o.id}" data-service-url="${esc(url)}" aria-label="کپی لینک اشتراک" title="کپی لینک"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg></button></div><div class="vpn-sub-actions"><button class="primary" data-service-view="${o.id}" data-service-url="${esc(url)}" data-service-title="Subscription"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/></svg><span>مشاهده لینک</span></button><button data-service-copy-link="${o.id}" data-service-url="${esc(url)}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg><span>کپی لینک</span></button><button data-service-qr="${o.id}" data-service-url="${esc(url)}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v2M14 20h2M19 19h2v2h-2z"/></svg><span>QR Code</span></button><button class="vpn-happ-action" data-service-happ="${esc(url)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11"/><path d="m7.5 9.5 4.5 4.5 4.5-4.5"/><rect x="4" y="14" width="16" height="7" rx="2"/><path d="M8 17.5h8"/></svg><span>افزودن به Happ</span><small>اتصال مستقیم</small></button></div>`:`<div class="vpn-sub-pending"><span class="vpn-pending-mark"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></svg></span><div><b>کلاینت هنوز آماده نشده</b><small>پس از ساخت سرویس، لینک اشتراک به‌صورت خودکار نمایش داده می‌شود.</small></div></div>`}</article>
    ${smartLocations.length?`<article class="vpn-sub-targets"><header><small>LOCATIONS</small><h3>لوکیشن‌های سرویس</h3></header><div>${smartLocations.map(l=>`<section><span class="vpn-target-proto vpn-target-flag"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z"/><circle cx="12" cy="9" r="2.3"/></svg></span><div><b>${esc(l.name)}</b><small>${esc(l.code)} · فعال در Subscription</small></div><em>فعال</em></section>`).join('')}</div></article>`:''}
    ${Number(add.traffic_price_per_gb||0)>0||Number(add.day_price||0)>0?`<div class="vpn-sub-quick vpn-sub-addons">${Number(add.traffic_price_per_gb||0)>0?`<button data-service-add-traffic="${o.id}"><i>＋</i><b>حجم اضافه</b><small>افزایش ترافیک</small></button>`:''}${Number(add.day_price||0)>0?`<button data-service-add-days="${o.id}"><i>＋</i><b>روز اضافه</b><small>افزایش اعتبار</small></button>`:''}</div>`:''}
    ${waitingPay?`<article class="vpn-sub-payment"><h3>تکمیل پرداخت</h3>${paymentMethodsHtml(order)}</article>`:''}
  </section>`;
}
function renderMyServiceDetail(){
  const o=myServiceById(currentServiceOrderId);
  if(!o){currentServiceOrderId=null;renderHome();return}
  $('homePage').innerHTML=vpnServiceDetailHtml(o,{context:'service'});
}

function renderHome(){
  if(currentServiceOrderId){renderMyServiceDetail();return}
  const u=state.user||{};const c=u.customer?.tier||{};const isGuest=state?.is_guest||u?.is_guest;const orders=state.orders||[];const activeOrders=orders.filter(o=>!['delivered','canceled','rejected','refunded'].includes(String(o.status||'')));const activeServices=serviceHubItems();const recent=activeServices.slice(0,3);const tgConnected=!!u.telegram_connected;const completion=Math.round([!!String(u.first_name||'').trim(),!!(u.web_username||u.username),!!u.email_verified_at,tgConnected].filter(Boolean).length/4*100);
  const guestBanner=isGuest?`<div class="guest-banner"><div class="guest-banner-text"><strong>حالت میهمان</strong><span>برای سفارش و مدیریت اعتبار وارد حساب شو.</span></div><button class="primary" onclick="openAuthModal()">ورود / ثبت‌نام</button></div>`:'';
  const missingEmail=!String(u.email||'').trim(),missingPhone=!String(u.phone_number||'').trim();const securityBanner=!isGuest&&(missingEmail||missingPhone)?`<article class="account-security-alert"><span>⚠️</span><div><b>امنیت حسابت رو کامل کن</b><p>${missingEmail&&missingPhone?'برای افزایش امنیت حساب و بازیابی دسترسی در زمان اختلال یا قطعی اینترنت، ایمیل و شماره تماس خودت را اضافه کن.':missingEmail?'برای افزایش امنیت و بازیابی حساب، ایمیل خودت را اضافه کن.':'برای افزایش امنیت و بازیابی حساب، شماره تماس خودت را اضافه کن.'}</p></div><button id="completeMiniSecurity">تکمیل اطلاعات</button></article>`:'';
  const services=recent.length?recent.map(o=>{const client=miniVpnClientSummary(o);const loc=vpnSmartLocations(o).length||((o.instances||[]).length?1:0);return `<div class="hub-service-row parity-service-card"><button class="hub-order-row" data-my-service="${o.id}"><div class="parity-service-copy"><div class="parity-service-top"><b>${esc(o.display_name||o.product_name||'سرویس VPN')}</b><span class="parity-service-status">${esc(vpnStatusFa(o.status||'active'))}</span></div><small class="parity-service-meta">${client?`<span class="client"><em>کلاینت</em>${esc(client)}</span>`:''}${loc?`<span><em>لوکیشن</em>${nf(loc)} فعال</span>`:''}${o.expires_at?`<span><em>اعتبار</em>تا ${esc(dateMini(o.expires_at))}</span>`:'<span><em>اعتبار</em>بدون انقضا</span>'}</small></div><span>›</span></button><button class="mini-renew-inline" ${o._manual_order?`data-renew-order="${o.order_id}"`:`data-service-renew="${o.id}"`}>تمدید</button></div>`}).join(''):`<div class="u-empty"><div class="u-empty-icon">◇</div><h3>هنوز VPN فعالی نداری</h3><p>از فروشگاه اولین VPN خودت رو انتخاب کن.</p><button class="primary" data-tab-jump="shop">رفتن به فروشگاه</button></div>`;
  $('homePage').innerHTML=`${guestBanner}${securityBanner}
    <section class="account-center-mini-hero">
      <div class="mini-profile-main">${userProfileAvatar(u,'account-center-photo')}<div><small>BLUEGATE MEMBER</small><h2>${esc(u.first_name||u.username||'کاربر BlueGate')}</h2><p>${u.username?'@'+esc(u.username):'حساب BlueGate'} · ${tgConnected?'Telegram متصل ✓':'حساب وب'}</p></div><button class="account-edit-mini" id="editMiniProfile">ویرایش</button></div>
      <div class="mini-profile-completion"><div><span>تکمیل حساب</span><b>${nf(completion)}٪</b></div><i><em style="width:${completion}%"></em></i></div>
      <div class="mini-account-stats"><button data-tab-jump="wallet"><span>اعتبار</span><b data-count-anim="${u.balance||0}">${fmt(u.balance||0)}</b></button><button data-tab-jump="orders"><span>سفارش فعال</span><b>${nf(activeOrders.length)}</b></button><button data-credit-view="referral"><span>دعوت موفق</span><b>${nf(u.referrals_count||0)}</b></button></div>
    </section>
    <article class="account-hub-card"><div class="hub-card-head"><span>◇</span><div><b>VPNهای من</b><small>${nf(activeServices.length)} VPN فعال</small></div><button data-tab-jump="orders">همه سفارش‌ها</button></div>${services}</article>
    ${state?.trial?.eligible?`<article class="account-hub-card"><div class="hub-card-head"><span>🧪</span><div><b>تست رایگان BlueGate</b><small>${nf(Math.round(Number(state.trial?.settings?.traffic_limit_bytes||0)/1073741824))} GB · ${nf(state.trial?.settings?.duration_minutes||120)} دقیقه</small></div><button id="miniTrialBtn">فعال‌سازی</button></div></article>`:''}
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
    <div class="mini-account-editor-summary mini-avatar-editor-summary">${userProfileAvatar(u,'mini-profile-edit-avatar')}<div><b>${esc(u.first_name||u.username||'کاربر BlueGate')}</b><small>${esc(u.username?'@'+u.username:'حساب BlueGate')}</small></div><label class="mini-avatar-upload-btn">تغییر عکس<input id="miniAvatarFile" type="file" accept="image/jpeg,image/png,image/webp" hidden></label></div><div class="mini-avatar-actions"><button type="button" class="ghost" id="miniAvatarTelegram">↻ عکس تلگرام</button><button type="button" class="ghost" id="miniAvatarRemove">استفاده از تلگرام</button></div>
    <div class="mini-account-fields">
      <label class="mini-account-field"><span>نام نمایشی</span><input id="mp_first" autocomplete="given-name" value="${esc(u.first_name||'')}" placeholder="نام"></label>
      <label class="mini-account-field"><span>نام خانوادگی</span><input id="mp_last" autocomplete="family-name" value="${esc(u.last_name||'')}" placeholder="نام خانوادگی"></label>
      <label class="mini-account-field"><span>شماره تماس</span><input id="mp_phone" inputmode="tel" autocomplete="tel" value="${esc(u.phone_number||'')}" placeholder="اختیاری"></label>
    </div>
    <div class="mini-account-email-card"><div><span>ایمیل حساب</span><b>${esc(u.email||'ثبت نشده')}</b><small>${u.email_verified_at?'ایمیل تایید شده ✓':'تغییر ایمیل فقط با OTP انجام می‌شود.'}</small></div><button type="button" id="miniChangeEmailInlineBtn">${u.email?'تغییر ایمیل':'افزودن ایمیل'}</button></div>
    <button class="primary wide mini-account-save" id="miniProfileSave" type="button">ذخیره تغییرات</button>
  </div>`,'BLUEGATE ACCOUNT');
  o.querySelector('#miniAvatarFile')?.addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>4*1024*1024){showStatus('حجم عکس باید کمتر از ۴MB باشد','error');return}try{const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});state=await api('update_my_avatar',{image_b64:data});closeMiniCreditTopup();renderUser();showStatus('عکس پروفایل ذخیره شد','success');setTimeout(openMiniProfileEditor,80)}catch(err){showStatus(err.message||'آپلود عکس انجام نشد','error')}});
  o.querySelector('#miniAvatarTelegram')?.addEventListener('click',async()=>{try{state=await api('sync_my_telegram_avatar');closeMiniCreditTopup();renderUser();showStatus('عکس تلگرام بروزرسانی شد','success');setTimeout(openMiniProfileEditor,80)}catch(err){showStatus(err.message||'دریافت عکس تلگرام ممکن نشد','error')}});
  o.querySelector('#miniAvatarRemove')?.addEventListener('click',async()=>{try{state=await api('reset_my_avatar');closeMiniCreditTopup();renderUser();showStatus('عکس تلگرام جایگزین شد','success');setTimeout(openMiniProfileEditor,80)}catch(err){showStatus(err.message||'تغییر عکس انجام نشد','error')}});
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
function openPalettePopup(){prepareMiniLayer('palettePopup');const colors=['#4A8DFF','#8B5CF6','#22C55E','#EF4444','#F97316','#EC4899','#06B6D4','#F59E0B','#14B8A6','#64748B'];const p=$('palettePopup');if(!p)return;p.innerHTML=`<div class="palette-popup-backdrop" data-close-palette></div><div class="palette-popup-inner"><button class="palette-popup-close" data-close-palette>✕</button><h3>🎨 رنگ دلخواه Mini App</h3><p class="muted">یکی از رنگ‌ها را بزن یا رنگ اختصاصی خودت را انتخاب کن. این رنگ فقط روی همین دستگاه ذخیره می‌شود.</p><div class="palette">${colors.map(c=>`<button class="swatch" data-color="${c}" style="background:${c}"></button>`).join('')}<label class="custom-color"><span>رنگ دلخواه</span><input id="userCustomColor" type="color" value="${esc(localStorage.getItem('blue_ref_color')||state?.theme_color||'#4A8DFF')}"></label><button class="secondary wide" id="applyCustomColor">اعمال رنگ</button><button class="ghost wide" id="resetColor">پیش‌فرض</button></div></div>`;p.classList.add('open');p.querySelectorAll('[data-close-palette]').forEach(el=>el.addEventListener('click',closePalettePopup))}
function closePalettePopup(){const p=$('palettePopup');if(p){p.classList.remove('open');p.innerHTML=''}}
function missionCard(m){
 const today=Number(state.user?.today_referrals||0),target=Math.max(1,Number(m.target||1)),pct=Math.max(0,Math.min(100,Math.round(today/target*100))),done=m.claimed?'claimed':(m.done?'done':'todo'),status=m.claimed?'دریافت شده':m.done?'آماده دریافت':'در حال تکمیل',icon=m.claimed?'check':m.done?'gift':'target';
 return `<article class="mission-card ${done}"><div class="mission-top"><div class="mission-copy"><small>هدف امروز: ${nf(target)} معرفی</small><h3>ثبت ${nf(target)} دعوت موفق</h3><p class="muted">پاداش این مأموریت: <b>${fmt(m.reward)}</b></p></div><span class="mission-icon ${done}" aria-hidden="true">${bgFeatureIcon(icon,22)}</span></div><div class="progress-track" role="progressbar" aria-label="پیشرفت مأموریت ${nf(target)} دعوت" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div><div class="mission-foot"><span>${nf(Math.min(today,target))} از ${nf(target)} دعوت · ${pct}%</span><b class="mission-status-text">${status}</b></div></article>`;
}
function getWishlist(){if(Array.isArray(state?.wishlist_product_ids))return state.wishlist_product_ids.map(Number);try{return JSON.parse(localStorage.getItem('blue_ref_wishlist')||'[]').map(Number)}catch(e){return []}}
async function toggleWishlist(pid){pid=Number(pid);let w=getWishlist();const was=w.includes(pid);w=was?w.filter(id=>id!==pid):[...w,pid];if(state&&!state.is_guest)state.wishlist_product_ids=w;localStorage.setItem('blue_ref_wishlist',JSON.stringify(w));document.querySelectorAll(`[data-wishlist-pid="${pid}"]`).forEach(el=>{const active=w.includes(pid);el.innerHTML=productCardIcon('heart');el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));el.setAttribute('aria-label',active?'حذف از علاقه‌مندی‌ها':'افزودن به علاقه‌مندی‌ها')});if(!was)haptic('success');if(shopFilterWishlist)renderShopSections();if(!state?.is_guest){try{const r=await api('wishlist_toggle',{product_id:pid});state.wishlist_product_ids=r.wishlist_product_ids||w;localStorage.setItem('blue_ref_wishlist',JSON.stringify(state.wishlist_product_ids));if(shopFilterWishlist)renderShopSections()}catch(e){state.wishlist_product_ids=was?[...w,pid]:w.filter(id=>id!==pid);showStatus(e.message||'ذخیره علاقه‌مندی انجام نشد','error')}}}

function storefrontRootProducts(){const all=state.shop_products||[];const roots=all.filter(p=>Number(p.parent_id||0)===0);return roots.length?roots:all}
function miniCatalogText(item,field){const en=String(item?.[field+'_en']||'').trim();const fa=String(item?.[field]||'');return window.BlueGateI18n?.language==='en'&&en?en:fa}
function catalogServiceForProduct(p){return (state?.catalog?.services||[]).find(s=>Number(s.legacy_product_id||0)===Number(p?.id||0))||null}
function catalogSearchTextForProduct(p){const svc=catalogServiceForProduct(p);if(!svc)return '';return (svc.groups||[]).map(g=>`${miniCatalogText(g,'name')} ${(g.plans||[]).map(x=>miniCatalogText(x,'title')).join(' ')}`).join(' ')}
function catalogGroupPriceLabel(g){const prices=(g?.plans||[]).map(x=>Number(x.price||0)).filter(x=>x>0);return prices.length?`از ${fmt(Math.min(...prices))}`:''}
function openCatalogServiceGroups(p){const svc=catalogServiceForProduct(p);let groups=(svc?.groups||[]).filter(g=>Number(g.is_default||0)===0&&(g.plans||[]).length);if(!groups.length){const children=(state.shop_products||[]).filter(x=>Number(x.parent_id||0)===Number(p.id));groups=children.map(x=>({name:x.name,legacy_product_id:x.id,plans:x.variants||[]}))}if(!groups.length)return false;const body=`<div class="catalog-group-picker">${groups.map((g,i)=>`<button type="button" class="catalog-group-option" data-open-group-product="${Number(g.legacy_product_id||0)}" aria-label="${esc(miniCatalogText(g,'name')||'Plan')}"><span class="catalog-group-option-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H10l2 2h5.5A2.5 2.5 0 0 1 20 9.5v7a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M4.5 10h15" stroke="currentColor" stroke-width="1.5"/></svg></span><span class="catalog-group-option-copy"><b>${esc(miniCatalogText(g,'name')||'Plan')}</b><small>${nf((g.plans||[]).length)} پلن${catalogGroupPriceLabel(g)?' · '+esc(catalogGroupPriceLabel(g)):''}</small></span><span class="catalog-group-option-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="m9 5 7 7-7 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button>`).join('')}</div>`;BlueGateUI.openSheet({type:'action',eyebrow:'انتخاب نوع سرویس',title:miniCatalogText(svc,'name')||miniCatalogText(p,'name'),subtitle:miniCatalogText(svc,'description')||miniCatalogText(p,'short_description')||'نوع سرویس را انتخاب کن تا پلن‌های آن را ببینی.',body,onOpen:(host)=>host.querySelectorAll('[data-open-group-product]').forEach(btn=>btn.addEventListener('click',()=>{const childId=Number(btn.dataset.openGroupProduct||0);if(!childId)return;btn.disabled=true;BlueGateUI.closeSheet();setTimeout(()=>showProduct(childId),80)}))});return true}
function filteredProducts(){let list=storefrontRootProducts().filter(p=>(activeCategory==='all'||Number(p.category_id)===Number(activeCategory)||(activeCategory==='featured'&&Number(p.is_featured)===1))&&(!searchTerm||`${miniCatalogText(p,'name')} ${miniCatalogText(p,'short_description')} ${miniCatalogText(p,'full_description')} ${catalogSearchTextForProduct(p)}`.toLowerCase().includes(searchTerm.toLowerCase())));if(shopFilterFeatured)list=list.filter(p=>Number(p.is_featured)===1);if(shopFilterWishlist){const w=getWishlist();list=list.filter(p=>w.includes(Number(p.id)));}if(shopSort==='price_low')list=[...list].sort((a,b)=>Number(a.price||0)-Number(b.price||0));else if(shopSort==='price_high')list=[...list].sort((a,b)=>Number(b.price||0)-Number(a.price||0));else if(shopSort==='newest')list=[...list].sort((a,b)=>Number(b.id)-Number(a.id));return list}
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
  const label=`${nf(d.percent)}٪`;
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
function shopSvgIcon(name){const paths={store:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/><path d="M9.5 20v-5h5v5"/>',search:'<circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 4.5 4.5"/>',category:'<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',filter:'<path d="M4 6h16M7 12h10M10 18h4"/><circle cx="8" cy="6" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="12" cy="18" r="1.5"/>',chevron:'<path d="m7 10 5 5 5-5"/>',star:'<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>',empty:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 4 4M8 10.5h5"/>'};return '<svg class="bg-ico shop-svg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+(paths[name]||paths.category)+'</svg>'}
function shopSectionsHtml(){const cats=state.shop_categories||[];const products=filteredProducts();const filtersActive=shopFilterFeatured||shopFilterWishlist||shopSort!=='newest';let sections='';if(activeCategory==='all'&&!searchTerm&&!filtersActive){const spec=specialDiscountsBannerHtml();if(spec)sections+=spec;const recent=recentProductsHtml();if(recent)sections+=recent;const featured=storefrontRootProducts().filter(p=>Number(p.is_featured)===1);if(featured.length)sections+=sectionHtml(shopSvgIcon('star')+' محصولات ویژه',featured,'featured');for(const c of cats){const list=storefrontRootProducts().filter(p=>Number(p.category_id)===Number(c.id));if(list.length)sections+=sectionHtml(shopSvgIcon('category')+' '+esc(miniCatalogText(c,'title')),list,String(c.id))}}else sections=gridHtml(products);return sections||'<div class="empty-state rich-empty-state shop-empty-state"><span class="shop-empty-icon">'+shopSvgIcon('empty')+'</span><h3>محصولی پیدا نشد!</h3><p class="muted">با این فیلترها و جستجو چیزی پیدا نکردیم.</p><button class="secondary" data-clear-filters>حذف تمام فیلترها</button></div>'}
function activeShopFilterSummary(){const out=[];if(shopSort==='price_low')out.push('ارزان‌ترین');else if(shopSort==='price_high')out.push('گران‌ترین');if(shopFilterFeatured)out.push('ویژه‌ها');if(shopFilterWishlist)out.push('علاقه‌مندی‌ها');return out}
function openShopCategories(){
 const cats=state.shop_categories||[];
 const options=[{id:'all',title:'همهٔ محصولات',subtitle:'نمایش تمام محصولات و سرویس‌ها',emoji:shopSvgIcon('store')}, {id:'featured',title:'محصولات ویژه',subtitle:'محصولات منتخب فروشگاه',emoji:shopSvgIcon('star')},...cats.map(c=>({id:String(c.id),title:miniCatalogText(c,'title'),subtitle:'مشاهده محصولات این دسته',emoji:shopSvgIcon('category'),image_url:c.image_url}))];
 const body=`<div class="shop-category-picker-list">${options.map(c=>{const selected=String(activeCategory)===String(c.id);return `<button type="button" class="shop-category-picker-option ${selected?'is-selected':''}" data-shop-category="${esc(String(c.id))}" aria-pressed="${selected}">${c.image_url?`<img class="shop-category-picker-image" src="${esc(c.image_url)}" alt="">`:`<span class="shop-category-picker-icon" aria-hidden="true">${c.emoji}</span>`}<span class="shop-category-picker-copy"><strong>${esc(c.title)}</strong><small>${esc(c.subtitle)}</small></span><span class="shop-category-picker-check" aria-hidden="true">${selected?shopSvgIcon('check'):''}</span></button>`}).join('')}</div>`;
 BlueGateUI.openSheet({type:'action',eyebrow:'فروشگاه · دسته‌بندی',title:'چه چیزی دنبالش هستی؟',subtitle:'یک دسته انتخاب کن تا محصولات مرتبط نمایش داده شوند.',body,footer:'<button class="secondary" data-shop-category-close>بستن</button>',onOpen:host=>{host.querySelectorAll('[data-shop-category]').forEach(btn=>btn.addEventListener('click',()=>{activeCategory=btn.dataset.shopCategory;BlueGateUI.closeSheet();renderShop();}));host.querySelector('[data-shop-category-close]')?.addEventListener('click',()=>BlueGateUI.closeSheet());}});
}
function openShopFilters(){
 const body=`<div class="filter-sheet-group"><label>مرتب‌سازی</label><div class="filter-choice-grid"><button data-u-sort="newest" class="${shopSort==='newest'?'active':''}">جدیدترین</button><button data-u-sort="price_low" class="${shopSort==='price_low'?'active':''}">ارزان‌ترین</button><button data-u-sort="price_high" class="${shopSort==='price_high'?'active':''}">گران‌ترین</button></div></div><div class="filter-sheet-group"><label>نمایش محصولات</label><div class="filter-switch-row"><span>فقط محصولات ویژه</span><button data-u-toggle="featured" class="${shopFilterFeatured?'active':''}">${shopFilterFeatured?'روشن':'خاموش'}</button></div><div class="filter-switch-row"><span>فقط علاقه‌مندی‌ها</span><button data-u-toggle="wishlist" class="${shopFilterWishlist?'active':''}">${shopFilterWishlist?'روشن':'خاموش'}</button></div></div>`;
 BlueGateUI.openSheet({type:'action',eyebrow:'فروشگاه',title:'فیلتر و مرتب‌سازی',subtitle:'نتایج رو بر اساس نیازت محدود کن.',body,footer:'<button class="secondary" data-u-filter-reset>پاک کردن فیلترها</button><button class="primary" data-u-filter-apply>اعمال فیلتر</button>',onOpen:host=>{let sort=shopSort,wish=shopFilterWishlist,featured=shopFilterFeatured;const sync=()=>{host.querySelectorAll('[data-u-sort]').forEach(b=>b.classList.toggle('active',b.dataset.uSort===sort));host.querySelector('[data-u-toggle="wishlist"]')?.classList.toggle('active',wish);host.querySelector('[data-u-toggle="featured"]')?.classList.toggle('active',featured);const w=host.querySelector('[data-u-toggle="wishlist"]'),f=host.querySelector('[data-u-toggle="featured"]');if(w)w.textContent=wish?'روشن':'خاموش';if(f)f.textContent=featured?'روشن':'خاموش'};host.querySelectorAll('[data-u-sort]').forEach(b=>b.addEventListener('click',()=>{sort=b.dataset.uSort;sync()}));host.querySelector('[data-u-toggle="wishlist"]')?.addEventListener('click',()=>{wish=!wish;sync()});host.querySelector('[data-u-toggle="featured"]')?.addEventListener('click',()=>{featured=!featured;sync()});host.querySelector('[data-u-filter-reset]')?.addEventListener('click',()=>{sort='newest';wish=false;featured=false;sync()});host.querySelector('[data-u-filter-apply]')?.addEventListener('click',()=>{shopSort=sort;shopFilterWishlist=wish;shopFilterFeatured=featured;BlueGateUI.closeSheet();renderShop()});}});
}
function renderShop(){const cats=state.shop_categories||[];const filters=activeShopFilterSummary();const count=filteredProducts().length;const selectedCategory=activeCategory==='all'?'همهٔ دسته‌ها':activeCategory==='featured'?'محصولات ویژه':(cats.find(c=>Number(c.id)===Number(activeCategory))?miniCatalogText(cats.find(c=>Number(c.id)===Number(activeCategory)),'title'):'دسته‌بندی');$('shopPage').innerHTML=`<section class="shop-page-intro parity-page-hero shop-intro-refined"><div class="shop-intro-copy"><span class="shop-intro-eyebrow">BLUEGATE · STORE</span><h2>محصولات و سرویس‌ها</h2><p>سرویس موردنظرت رو سریع پیدا کن.</p></div><span class="shop-intro-mark" aria-hidden="true">${shopSvgIcon('store')}</span></section><section class="shop-discovery" aria-label="جستجو و دسته‌بندی محصولات"><div class="shop-discovery-search"><span class="search-icon" aria-hidden="true">${shopSvgIcon('search')}</span><input id="searchInput" autocomplete="off" inputmode="search" placeholder="جستجوی سرویس یا اشتراک..." value="${esc(searchTerm)}" aria-label="جستجوی سرویس یا اشتراک"><button type="button" class="shop-search-clear ${searchTerm?'is-visible':''}" id="clearShopSearch" aria-label="پاک کردن جستجو" ${searchTerm?'':'hidden'}>×</button></div><div class="shop-discovery-actions"><button type="button" class="shop-discovery-control shop-category-trigger" id="openShopCategories" aria-haspopup="dialog"><span class="shop-control-icon" aria-hidden="true">${shopSvgIcon('category')}</span><span class="shop-control-copy"><small>دسته‌بندی</small><strong>${esc(selectedCategory)}</strong></span><span class="shop-control-chevron" aria-hidden="true">${shopSvgIcon('chevron')}</span></button><button type="button" class="shop-discovery-control shop-filter-trigger" id="openShopFilters" aria-haspopup="dialog"><span class="shop-control-icon" aria-hidden="true">${shopSvgIcon('filter')}</span><span class="shop-control-copy"><small>نمایش و مرتب‌سازی</small><strong>فیلترها${filters.length?` · ${filters.length}`:''}</strong></span><span class="shop-filter-dot ${filters.length?'is-active':''}" aria-hidden="true"></span></button></div><div class="shop-discovery-meta"><span id="shopResultCount">${count.toLocaleString('fa-IR')} محصول</span><div class="shop-active-filters">${filters.map(x=>`<span class="shop-filter-chip">${esc(x)}</span>`).join('')}${activeCategory!=='all'&&!filters.some(x=>x===selectedCategory)?`<span class="shop-filter-chip shop-category-chip">${esc(selectedCategory)}</span>`:''}</div></div></section><div id="shopSections">${shopSectionsHtml()}</div>`;}
function renderShopSections(){const box=$('shopSections');if(box)box.innerHTML=shopSectionsHtml();const count=$('shopResultCount');if(count)count.textContent=filteredProducts().length.toLocaleString('fa-IR')+' محصول';const clear=$('clearShopSearch');if(clear){clear.hidden=!searchTerm;clear.classList.toggle('is-visible',Boolean(searchTerm));}const meta=document.querySelector('.shop-discovery-meta');if(meta){const filters=activeShopFilterSummary();const cats=state.shop_categories||[];const selected=activeCategory==='all'?'':activeCategory==='featured'?'محصولات ویژه':(cats.find(c=>Number(c.id)===Number(activeCategory))?miniCatalogText(cats.find(c=>Number(c.id)===Number(activeCategory)),'title'):'');const chips=meta.querySelector('.shop-active-filters');if(chips)chips.innerHTML=filters.map(x=>'<span class="shop-filter-chip">'+esc(x)+'</span>').join('')+(selected&&!filters.includes(selected)?'<span class="shop-filter-chip shop-category-chip">'+esc(selected)+'</span>':'');}}
function sectionHtml(title,products,categoryId='all',allowViewAll=true){const viewBtn=allowViewAll?`<button type="button" class="section-view-all" data-cat="${esc(String(categoryId))}">View All</button>`:'';return `<section class="section-row catalog-section"><div class="section-title"><h2>${title}</h2>${viewBtn}</div><div class="h-scroll product-grid-wrap">${products.slice(0,12).map(productCard).join('')}</div></section>`}
function gridHtml(products){return products.length ? `<section class="section-row catalog-section catalog-grid-view"><div class="h-scroll product-grid-wrap">${products.map(productCard).join('')}</div></section>` : ''}
function productCardIcon(name){
  const paths={heart:'<path d="M20.8 4.9a5.5 5.5 0 0 0-7.8 0L12 5.9l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.3 1-1a5.5 5.5 0 0 0 0-7.8Z"/>',box:'<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4.3 7.7 7.7 4.4 7.7-4.4M12 12v9M8 5.2l8 4.6"/>',arrow:'<path d="M7 17 17 7M7 7h10v10"/>'};
  return '<svg class="product-card-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+(paths[name]||paths.box)+'</svg>';
}
function productCard(p){
  const hasDiscount=Boolean(productDiscountInfo(p));
  const w=getWishlist();
  const wishBtn=`<button type="button" class="wishlist-fab ${w.includes(Number(p.id))?'active':''}" data-wishlist-pid="${p.id}" aria-label="${w.includes(Number(p.id))?'حذف از علاقه‌مندی‌ها':'افزودن به علاقه‌مندی‌ها'}" aria-pressed="${w.includes(Number(p.id))}">${productCardIcon('heart')}</button>`;
  const badgeHtml=productDiscountBadgeHtml(p);
  const priceLine=productCardPriceLine(p);
  return `<article class="product-tile catalog-tile product-card-v2 ${hasDiscount?'discount-tile':''}" data-product-preview="${p.id}">`+
    `<div class="tile-img tile-visual product-card-media">${cardImage(p,productCardIcon('box'))}${badgeHtml}${wishBtn}<span class="product-card-open" aria-hidden="true">${productCardIcon('arrow')}</span></div>`+
    `<div class="tile-body tile-caption product-card-content"><h3 class="tile-name">${esc(miniCatalogText(p,'name'))}</h3><div class="product-price-stack product-card-price">${priceLine}</div></div></article>`;
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
function openShareSheet(pid){prepareMiniLayer('shareSheet');
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

  const pPriceText = p.price ? miniIntlPrice(p.price,p.price_usd) : '';
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
function miniSupportStatusLabel(status){
  const labels={open:'باز',waiting_admin:'در انتظار پاسخ پشتیبانی',waiting_customer:'در انتظار پاسخ شما',resolved:'حل‌شده',closed:'بسته'};
  return labels[String(status||'open').toLowerCase()]||'در حال بررسی';
}
function miniSupportStatusClass(status){
  const classes={open:'is-open',waiting_admin:'is-waiting',waiting_customer:'is-waiting',resolved:'is-closed',closed:'is-closed'};
  return classes[String(status||'open').toLowerCase()]||'is-open';
}
function miniSupportUrl(){let raw=String(state?.support_username||'BlueGateSupport').trim();if(/^https?:\/\//i.test(raw))return raw;raw=raw.replace(/^@/,'').replace(/^https?:\/\/t\.me\//i,'').split(/[/?#]/)[0].trim();return raw?`https://t.me/${encodeURIComponent(raw)}`:'https://t.me/BlueGateSupport'}
function renderMiniSupportPage(){
  const host=$('supportPage');
  if(!host)return;
  if(state?.is_guest){
    host.innerHTML=\`<section class="mini-support-page support-center-v2">
      <header class="support-page-hero support-page-hero-guest">
        <span class="support-hero-icon" aria-hidden="true">\${bgFeatureIcon('headset',30)}</span>
        <div class="support-page-intro"><span class="member-kicker">BLUEGATE SUPPORT</span><h2>پشتیبانی BlueGate</h2><p>برای ثبت درخواست، پیگیری پاسخ‌ها و ارسال فایل، ابتدا وارد حساب کاربری‌ات شو.</p></div>
        <div class="support-page-actions"><button class="primary" id="miniSupportLogin">\${bgFeatureIcon('user',17)} ورود یا ثبت‌نام</button><a class="ghost support-telegram-link" href="\${esc(miniSupportUrl())}" target="_blank" rel="noopener">\${bgFeatureIcon('send',16)} ارتباط در تلگرام</a></div>
      </header>
    </section>\`;
    host.querySelector('#miniSupportLogin')?.addEventListener('click',openAuthModal);
    return;
  }
  const tickets=Array.isArray(state?.support_tickets)?state.support_tickets:[];
  const status=t=>String(t?.status||'open').toLowerCase();
  const closed=t=>['closed','resolved'].includes(status(t));
  const needsTeam=t=>['open','waiting_admin'].includes(status(t));
  const waitingUser=t=>status(t)==='waiting_customer';
  const renderRows=(filter='all',query='')=>{
    const q=String(query||'').trim().toLocaleLowerCase();
    const filtered=tickets.filter(t=>{
      const s=status(t);
      const matches=filter==='team'?needsTeam(t):filter==='user'?waitingUser(t):filter==='closed'?closed(t):true;
      const haystack=[t?.subject,t?.id,t?.last_message_at,t?.created_at,miniSupportStatusLabel(s)].join(' ').toLocaleLowerCase();
      return matches&&(!q||haystack.includes(q));
    });
    if(!filtered.length){
      const hasTickets=tickets.length>0;
      return \`<div class="support-empty-state" role="status"><span class="support-empty-icon" aria-hidden="true">\${bgFeatureIcon(hasTickets?'search':'ticket',28)}</span><h3>\${hasTickets?'درخواستی با این مشخصات پیدا نشد':'هنوز درخواستی ثبت نکرده‌ای'}</h3><p>\${hasTickets?'عبارت جست‌وجو یا فیلتر وضعیت را تغییر بده.':'اگر برای خرید یا سرویس به کمک نیاز داری، یک تیکت ثبت کن تا درخواستت را پیگیری کنیم.'}</p>\${hasTickets?'':'<button class="primary" data-support-ticket-new>'+bgFeatureIcon('plus',17)+' ثبت اولین تیکت</button>'}</div>\`;
    }
    return filtered.map(t=>\`<button type="button" class="support-ticket-card-v3" data-support-ticket="\${Number(t.id)||0}">
      <span class="support-ticket-mark-v3" aria-hidden="true">\${bgFeatureIcon('ticket',20)}<small>#\${esc(String(t.id||''))}</small></span>
      <span class="support-ticket-main-v3"><b>\${esc(t.subject||'درخواست پشتیبانی')}</b><small><span>\${bgFeatureIcon('clock',12)} آخرین فعالیت</span>\${esc(t.last_message_at||t.created_at||'هنوز پیامی ثبت نشده')}</small></span>
      <span class="support-ticket-side-v3"><span class="support-ticket-status \${miniSupportStatusClass(t.status)}">\${esc(miniSupportStatusLabel(t.status))}</span><span class="support-ticket-chevron-v3" aria-hidden="true">\${bgFeatureIcon('chevronLeft',17)}</span></span>
    </button>\`).join('');
  };
  const awaitingTeam=tickets.filter(needsTeam).length,awaitingUser=tickets.filter(waitingUser).length;
  host.innerHTML=\`<section class="mini-support-page support-center-v2 support-center-v3">
    <header class="support-page-hero">
      <div class="support-page-intro"><span class="member-kicker"><span class="support-live-dot"></span> BLUEGATE SUPPORT</span><h2>مرکز پشتیبانی</h2><p>درخواستت را ثبت کن و پاسخ‌های تیم پشتیبانی را از همین‌جا دنبال کن.</p></div>
      <div class="support-page-actions"><button class="primary support-new-ticket-btn" data-support-ticket-new>\${bgFeatureIcon('plus',17)} ثبت تیکت جدید</button><a class="ghost support-telegram-link" href="\${esc(miniSupportUrl())}" target="_blank" rel="noopener">\${bgFeatureIcon('send',16)} پشتیبانی تلگرام</a></div>
    </header>
    <section class="support-center-stats" aria-label="خلاصه درخواست‌ها">
      <article class="support-center-stat"><span class="support-center-stat-icon all" aria-hidden="true">\${bgFeatureIcon('ticket',20)}</span><span><small>کل تیکت‌ها</small><b>\${tickets.length.toLocaleString('fa-IR')}</b></span></article>
      <article class="support-center-stat"><span class="support-center-stat-icon team" aria-hidden="true">\${bgFeatureIcon('headset',20)}</span><span><small>نیازمند پاسخ پشتیبانی</small><b>\${awaitingTeam.toLocaleString('fa-IR')}</b></span></article>
      <article class="support-center-stat"><span class="support-center-stat-icon waiting" aria-hidden="true">\${bgFeatureIcon('message',20)}</span><span><small>منتظر پاسخ شما</small><b>\${awaitingUser.toLocaleString('fa-IR')}</b></span></article>
    </section>
    <section class="support-center-toolbar" aria-label="جست‌وجو و فیلتر تیکت‌ها">
      <label class="support-ticket-search"><span aria-hidden="true">\${bgFeatureIcon('search',18)}</span><input type="search" id="supportTicketSearch" placeholder="جست‌وجو بر اساس موضوع یا شماره تیکت" autocomplete="off" aria-label="جست‌وجوی تیکت‌ها"><button type="button" id="supportTicketClear" aria-label="پاک کردن جست‌وجو" hidden>\${bgFeatureIcon('close',15)}</button></label>
      <div class="support-ticket-filters" role="group" aria-label="فیلتر وضعیت تیکت">
        <button type="button" class="support-ticket-filter is-active" data-support-filter="all" aria-pressed="true">همه <span>\${tickets.length.toLocaleString('fa-IR')}</span></button>
        <button type="button" class="support-ticket-filter" data-support-filter="team" aria-pressed="false">نیازمند پاسخ</button>
        <button type="button" class="support-ticket-filter" data-support-filter="user" aria-pressed="false">نوبت پاسخ شما</button>
        <button type="button" class="support-ticket-filter" data-support-filter="closed" aria-pressed="false">بسته‌شده</button>
      </div>
    </section>
    <div class="support-list-heading"><div><b>درخواست‌های شما</b><small id="supportTicketResultCount">\${tickets.length.toLocaleString('fa-IR')} تیکت</small></div><span class="support-list-heading-note">آخرین فعالیت در ابتدا</span></div>
    <div class="support-page-list" id="supportTicketList">\${renderRows()}</div>
  </section>\`;
  let activeFilter='all';
  const list=host.querySelector('#supportTicketList'),search=host.querySelector('#supportTicketSearch'),clear=host.querySelector('#supportTicketClear');
  const bindRows=()=>{
    list?.querySelectorAll('[data-support-ticket]').forEach(x=>x.addEventListener('click',()=>openMiniSupportTicket(Number(x.dataset.supportTicket))));
    list?.querySelectorAll('[data-support-ticket-new]').forEach(x=>x.addEventListener('click',newMiniSupportTicket));
  };
  const updateList=()=>{
    if(list)list.innerHTML=renderRows(activeFilter,search?.value||'');
    const count=list?.querySelectorAll('[data-support-ticket]').length||0;
    const countLabel=host.querySelector('#supportTicketResultCount');
    if(countLabel)countLabel.textContent=\`\${count.toLocaleString('fa-IR')} تیکت\`;
    if(clear)clear.hidden=!search?.value;
    bindRows();
  };
  search?.addEventListener('input',updateList);
  clear?.addEventListener('click',()=>{if(search){search.value='';updateList();search.focus()}});
  host.querySelectorAll('[data-support-filter]').forEach(btn=>btn.addEventListener('click',()=>{
    activeFilter=String(btn.dataset.supportFilter||'all');
    host.querySelectorAll('[data-support-filter]').forEach(item=>{const selected=item===btn;item.classList.toggle('is-active',selected);item.setAttribute('aria-pressed',selected?'true':'false')});
    updateList();
  }));
  host.querySelectorAll('.support-page-hero [data-support-ticket-new]').forEach(x=>x.addEventListener('click',newMiniSupportTicket));
  bindRows();
  search?.addEventListener('keydown',e=>{if(e.key==='Escape'){search.value='';updateList();search.blur()}});
}
function openMiniSupport(){
  if(state?.is_guest){openAuthModal();return}
  const tickets=state.support_tickets||[];
  const body=`<div class="mini-support-panel"><div class="mini-support-actions"><button class="primary" data-support-ticket-new>＋ تیکت جدید</button><button class="ghost" id="miniSupportTelegram">ارتباط مستقیم در تلگرام</button></div><div class="mini-support-list">${tickets.length?tickets.map(t=>`<button class="account-menu-row" data-support-ticket="${t.id}"><span class="account-menu-icon">#</span><div><b>${esc(t.subject||'تیکت پشتیبانی')}</b><small>${esc(miniSupportStatusLabel(t.status))} · ${esc(t.last_message_at||t.created_at||'')}</small></div><em>‹</em></button>`).join(''):'<div class="u-empty"><div class="u-empty-icon">?</div><h3>هنوز تیکتی نداری</h3><p>اگر در خرید یا سرویس مشکلی داری، از همین‌جا پیام بده.</p></div>'}</div></div>`;
  BlueGateUI.openSheet({type:'fullscreen',eyebrow:'BLUEGATE SUPPORT',title:'پشتیبانی',subtitle:'ثبت و پیگیری درخواست‌ها',body,onOpen:(host)=>{
    host.querySelector('[data-support-ticket-new]')?.addEventListener('click',newMiniSupportTicket);
    host.querySelectorAll('[data-support-ticket]').forEach(x=>x.addEventListener('click',()=>openMiniSupportTicket(Number(x.dataset.supportTicket))));
    host.querySelector('#miniSupportTelegram')?.addEventListener('click',()=>{const url=miniSupportUrl();if(tg?.openTelegramLink)tg.openTelegramLink(url);else if(tg?.openLink)tg.openLink(url);else window.open(url,'_blank','noopener')});
  }});
}
async function supportFilePayload(file){if(!file||!file.size)return{};if(file.size>5*1024*1024)throw new Error('حجم فایل بیشتر از ۵ مگابایت است');return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve({attachment_data:String(r.result),attachment_name:file.name});r.onerror=()=>reject(new Error('خواندن فایل ناموفق بود')) ;r.readAsDataURL(file)})}
function supportAttachmentHtml(m){
  if(!m.attachment_url)return '';
  const image=['image/jpeg','image/png','image/webp'].includes(String(m.attachment_mime||'').toLowerCase());
  return image
    ? `<button type="button" class="support-attachment support-attachment-preview" data-support-preview="${esc(m.attachment_url)}" data-support-preview-name="${esc(m.attachment_name||'تصویر پیوست')}"><img src="${esc(m.attachment_url)}" alt="${esc(m.attachment_name||'تصویر پیوست')}" loading="lazy"><span>${bgFeatureIcon('image',15)} مشاهده تصویر <small>${esc(m.attachment_name||'فایل پیوست')}</small></span></button>`
    : `<a class="support-attachment" href="${esc(m.attachment_url)}" target="_blank" rel="noopener">${bgFeatureIcon('paperclip',16)} <span>${esc(m.attachment_name||'فایل پیوست')}</span><small>باز کردن فایل</small></a>`;
}
function openSupportAttachmentPreview(url,name='تصویر پیوست'){
  if(!url)return;
  openLightbox(url,name);
}
function bindSupportPreview(root){
  root?.querySelectorAll('[data-support-preview]').forEach(x=>x.addEventListener('click',()=>openSupportAttachmentPreview(x.dataset.supportPreview,x.dataset.supportPreviewName||'تصویر پیوست')));
}
function supportMessageHtml(m){const mine=m.sender_type!=='admin';const tick=m.read_at?'✓✓':m.delivered_at?'✓':'○';return `<article class="support-bubble ${mine?'mine':'theirs'}"><div class="support-bubble-meta"><b>${mine?'شما':'پشتیبانی'}</b><small>${esc(m.created_at||'')} ${mine?`<span class="support-ticks ${m.read_at?'seen':''}">${tick}</span>`:''}</small></div>${m.body?`<p>${esc(m.body)}</p>`:''}${supportAttachmentHtml(m)}</article>`}
function newMiniSupportTicket(){
  BlueGateUI.openSheet({
    type:'fullscreen',eyebrow:'BLUEGATE SUPPORT',title:'ثبت تیکت جدید',
    subtitle:'موضوع و شرح درخواستت را بنویس تا تیم پشتیبانی بررسی کند.',
    body:\`<form class="support-compose-form mini-ticket-create">
      <div class="support-compose-intro"><span class="support-compose-icon" aria-hidden="true">\${bgFeatureIcon('message',21)}</span><div><b>چطور می‌توانیم کمکت کنیم؟</b><small>شرح دقیق مشکل کمک می‌کند سریع‌تر راهنمایی‌ات کنیم.</small></div></div>
      <label class="support-form-field"><span>موضوع تیکت</span><input name="subject" maxlength="255" required placeholder="مثلاً مشکل اتصال یا پرداخت" autocomplete="off"></label>
      <label class="support-form-field"><span>شرح درخواست</span><textarea name="message" maxlength="4000" rows="5" required placeholder="چه اتفاقی افتاده؟ هر جزئیاتی که مهم است بنویس…"></textarea><small class="support-field-hint">حداکثر ۴۰۰۰ نویسه</small></label>
      <label class="support-file-label"><span class="support-file-icon" aria-hidden="true">\${bgFeatureIcon('paperclip',20)}</span><span class="support-file-copy"><b>افزودن پیوست <em>اختیاری</em></b><small>تصویر، PDF یا فایل متنی · حداکثر ۵ مگابایت</small><small class="support-file-selected" data-support-file-name>هنوز فایلی انتخاب نشده</small></span><input name="attachment" type="file" accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"></label>
      <button class="primary support-submit-ticket" type="submit">\${bgFeatureIcon('send',17)} ثبت تیکت و ورود به گفت‌وگو</button>
    </form>\`,
    onOpen:host=>{
      const form=host.querySelector('form.mini-ticket-create'),fileInput=form?.querySelector('[name="attachment"]'),fileName=form?.querySelector('[data-support-file-name]');
      fileInput?.addEventListener('change',()=>{if(fileName)fileName.textContent=fileInput.files?.[0]?.name||'هنوز فایلی انتخاب نشده'});
      form?.addEventListener('submit',async e=>{
        e.preventDefault();
        if(form.dataset.submitting==='1')return;
        const f=new FormData(form),subject=String(f.get('subject')||'').trim(),message=String(f.get('message')||'').trim();
        if(!subject||!message){showStatus('موضوع و شرح درخواست را کامل کن.','error');return}
        form.dataset.submitting='1';
        const submit=form.querySelector('[type="submit"]'),originalLabel=submit?.innerHTML||'ثبت تیکت و ورود به گفت‌وگو';
        if(submit){submit.disabled=true;submit.innerHTML=bgFeatureIcon('loader',17)+' در حال ثبت درخواست…'}
        try{
          const a=await supportFilePayload(f.get('attachment'));
          const r=await api('support_ticket_create',{subject,message,category:'other',...a});
          state={...state,support_tickets:r.tickets||[r.ticket,...(state.support_tickets||[])]};
          showStatus(r.duplicate?'این درخواست قبلاً ثبت شده؛ همان گفت‌وگو باز شد.':'تیکت با موفقیت ثبت شد.','success');
          if(typeof BlueGateUI?.closeSheet==='function')BlueGateUI.closeSheet();
          else if(typeof BlueGateUI?.closeTopSheet==='function')BlueGateUI.closeTopSheet();
          else document.querySelectorAll('.bluegate-sheet.open,.ui-sheet.open,[data-sheet].open').forEach(x=>x.classList.remove('open'));
          await openMiniSupportTicket(Number(r.ticket_id));
        }catch(err){
          delete form.dataset.submitting;
          if(submit){submit.disabled=false;submit.innerHTML=originalLabel}
          showStatus(err.message||'ثبت تیکت انجام نشد؛ دوباره تلاش کن.','error');
        }
      });
    }
  });
}
async function openMiniSupportTicket(id){
  try{
    const r=await api('support_ticket_messages',{ticket_id:Number(id)});
    prepareMiniLayer('previewSheet');
    const pv=$('previewSheet'),t=r.ticket||{},ticketIsClosed=['closed','resolved'].includes(String(t.status||'').toLowerCase());
    const composer=ticketIsClosed
      ? \`<div class="support-ticket-closed-notice" role="status"><span class="support-closed-icon" aria-hidden="true">\${bgFeatureIcon('lock',20)}</span><div><b>این تیکت بسته شده است</b><span>امکان ارسال پیام یا بازگشایی دوبارهٔ این تیکت وجود ندارد. برای موضوع جدید، تیکت تازه‌ای ثبت کن.</span></div></div>\`
      : \`<form class="support-chat-composer" id="miniSupportComposer"><textarea name="message" rows="1" maxlength="4000" placeholder="پیامت را بنویس…" aria-label="متن پیام"></textarea><label class="attach-button" aria-label="افزودن پیوست" title="افزودن پیوست">\${bgFeatureIcon('paperclip',19)}<input name="attachment" type="file" accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"></label><button class="primary" type="submit">\${bgFeatureIcon('send',16)} ارسال</button></form>\`;
    pv.innerHTML=\`<div class="preview-sheet-inner mini-chat-shell"><div class="preview-sheet-handle" data-close-preview></div><header class="support-chat-head"><span class="support-chat-head-icon" aria-hidden="true">\${bgFeatureIcon('headset',21)}</span><div><span class="member-kicker">BLUEGATE SUPPORT · تیکت #\${Number(id)}</span><b>\${esc(t.subject||'گفت‌وگوی پشتیبانی')}</b><small class="support-chat-status \${miniSupportStatusClass(t.status)}">\${esc(miniSupportStatusLabel(t.status))}</small></div><button type="button" class="ghost support-chat-close" data-close-preview aria-label="بستن گفت‌وگو">\${bgFeatureIcon('close',17)} بستن</button></header><div class="support-chat-messages" id="miniSupportMessages">\${(r.messages||[]).map(supportMessageHtml).join('')||\`<div class="support-chat-empty"><span aria-hidden="true">\${bgFeatureIcon('message',25)}</span><b>گفت‌وگو هنوز شروع نشده</b><small>پیامت را در کادر پایین بنویس تا تیم پشتیبانی در جریان قرار بگیرد.</small></div>\`}</div>\${composer}</div>\`;
    pv.classList.add('open');
    pv.querySelectorAll('[data-close-preview]').forEach(x=>x.addEventListener('click',closePreviewSheet));
    bindSupportPreview(pv);
    const form=$('miniSupportComposer');
    form?.addEventListener('submit',async e=>{
      e.preventDefault();
      if(form.dataset.sending==='1')return;
      const f=new FormData(form),msg=String(f.get('message')||'').trim(),file=f.get('attachment');
      if(!msg&&!file?.size){showStatus('پیام بنویس یا فایلی برای ارسال انتخاب کن.','error');return}
      form.dataset.sending='1';
      const submit=form.querySelector('[type="submit"]');
      if(submit){submit.disabled=true;submit.innerHTML=bgFeatureIcon('loader',16)+' در حال ارسال…'}
      try{
        const a=await supportFilePayload(file);
        await api('support_ticket_reply',{ticket_id:Number(id),message:msg,...a});
        await openMiniSupportTicket(id);
      }catch(e){
        delete form.dataset.sending;
        if(submit){submit.disabled=false;submit.innerHTML=bgFeatureIcon('send',16)+' ارسال'}
        showStatus(e.message||'ارسال پیام ناموفق بود.','error');
      }
    });
    const box=$('miniSupportMessages');
    if(box)box.scrollTop=box.scrollHeight;
    window.clearInterval(window.__miniTicketPoll);
    window.__miniTicketPoll=window.setInterval(async()=>{
      if(!document.body.contains($('miniSupportMessages')))return window.clearInterval(window.__miniTicketPoll);
      try{
        const x=await api('support_ticket_messages',{ticket_id:Number(id)}),b=$('miniSupportMessages');
        if(b){b.innerHTML=(x.messages||[]).map(supportMessageHtml).join('');bindSupportPreview(b);b.scrollTop=b.scrollHeight}
        if(x.ticket&&['closed','resolved'].includes(String(x.ticket.status||'').toLowerCase())&&!document.querySelector('.support-ticket-closed-notice'))await openMiniSupportTicket(id);
      }catch(e){}
    },5000);
  }catch(e){showStatus(e.message||'باز کردن تیکت ممکن نشد.','error')}
}
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
    id:Number(v.id),title:miniCatalogText(v,'title')||'Plan',price:Number(v.price||0),duration_days:Number(v.duration_days||0),
    description:miniCatalogText(v,'description')||'',old_price:Number(v.old_price||0),discount_percent:Number(v.discount_percent||0),
    product_id:Number(v.product_id||p.id)
  }));
  const preferred=variants.some(v=>Number(v.id)===Number(preferredVariantId))?Number(preferredVariantId):(variants[0]?.id||null);
  const delivery=p.delivery_type_fa||({manual:'تحویل دستی',account:'اکانت اختصاصی',vpn:'سرویس VPN',code:'کد دیجیتال',file:'فایل / متن'}[p.delivery_type]||'تحویل پس از ثبت');
  if(!window.BlueGatePurchase){showStatus('پنجره خرید هنوز بارگذاری نشده. دوباره تلاش کن.','error');return;}
  window.BlueGatePurchase.open({
    productId:Number(p.id),variantId:preferred,product:miniCatalogText(p,'name'),description:miniCatalogText(p,'full_description')||miniCatalogText(p,'short_description')||'',
    image:p.image_url||'',icon:p.category_emoji||p.config?.icon||'⚡',badge:(window.BlueGateI18n?.language==='en'?(p.category_title_en||p.category_title):p.category_title)||state.brand||'BlueGate',
    delivery,price:Number(p.price||variants[0]?.price||0),variants,
    onShare:()=>{ openShareSheet(p.id); },
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

function openOrderFiltersSheet(){const opts=[['all','همه','تمام سفارش‌ها'],['pending_payment','در انتظار پرداخت','نیازمند پرداخت'],['review','در بررسی','رسید ارسال‌شده یا در حال بررسی'],['processing','آماده‌سازی','پرداخت تاییدشده یا در حال آماده‌سازی'],['delivered','تحویل‌شده','سفارش‌های تکمیل‌شده'],['cleanup','لغو / رد / مرجوع','سفارش‌های بسته‌شده']];BlueGateUI.openSheet({type:'action',eyebrow:'سفارش‌ها',title:'فیلتر سفارش‌ها',subtitle:'فقط وضعیت‌هایی که از چرخه واقعی سفارش پشتیبانی می‌شوند.',body:`<div class="orders-filter-sheet-grid">${opts.map(x=>`<button class="orders-filter-option ${orderFilter===x[0]?'active':''}" data-u-order-filter="${x[0]}"><span class="orders-filter-option-icon">${x[0]==='all'?'▦':x[0]==='pending_payment'?'⏳':x[0]==='review'?'🔍':x[0]==='processing'?'📦':x[0]==='delivered'?'✓':'⌁'}</span><span><b>${x[1]}</b><small>${x[2]}</small></span><i>✓</i></button>`).join('')}</div>`,onOpen:(host)=>host.querySelectorAll('[data-u-order-filter]').forEach(b=>b.addEventListener('click',()=>{orderFilter=b.dataset.uOrderFilter;BlueGateUI.closeSheet();renderOrders()}))})}
function openOrdersManageSheet(){BlueGateUI.openSheet({type:'action',eyebrow:'مدیریت',title:'مدیریت لیست سفارش‌ها',body:`<div class="order-more-actions"><button class="danger" data-u-clear-canceled>حذف سفارش‌های لغو/رد شده از لیست</button></div>`,onOpen:(host)=>host.querySelector('[data-u-clear-canceled]')?.addEventListener('click',async()=>{if(await BlueGateUI.confirm({title:'پاکسازی لیست',message:'سفارش‌های لغو و ردشده از لیست شما مخفی شوند؟',confirmText:'پاکسازی',danger:true})){await loadAfterAction('clear_canceled_orders');currentOrderId=null;BlueGateUI.closeSheet();renderOrders()}})})}
function renderOrders(){const all=state.orders||[];if(currentOrderId){const o=orderById(currentOrderId);if(!o){currentOrderId=null;return renderOrders()}if(isVpnService(o)&&String(o.status)==='delivered'){const svc=serviceForOrder(o);$('ordersPage').innerHTML=vpnServiceDetailHtml(svc||o,{context:'order',order:o});return}$('ordersPage').innerHTML=orderDetailHtml(o);return}const visibleFilter=orderFilter==='cleanup'?'all':orderFilter;const matchesFilter=o=>orderFilter==='all'||(orderFilter==='active'&&!canHideOrder(o)&&o.status!=='delivered')||(orderFilter==='cleanup'&&canHideOrder(o))||(orderFilter==='review'&&['receipt_submitted','reviewing'].includes(o.status))||(orderFilter==='processing'&&['payment_confirmed','preparing'].includes(o.status))||o.status===orderFilter;const orders=all.filter(matchesFilter);const quick=[['active','فعال'],['delivered','تحویل‌شده'],['all','همه']];const activeCount=all.filter(o=>!canHideOrder(o)&&o.status!=='delivered').length;const deliveredCount=all.filter(o=>o.status==='delivered').length;$('ordersPage').innerHTML=`<section class="orders-header parity-page-hero"><div class="orders-header-copy"><span class="orders-eyebrow">حساب کاربری</span><h2>سفارش‌های من</h2><p class="muted">پیگیری خریدها و سرویس‌های تحویل‌شده</p><div class="orders-header-stats"><span><b>${nf(all.length)}</b> کل سفارش</span><span><b>${nf(activeCount)}</b> در جریان</span><span><b>${nf(deliveredCount)}</b> تکمیل‌شده</span></div></div><div class="orders-header-icon" aria-hidden="true">🧾</div></section><div class="order-filters"><div class="order-filter-label">نمایش بر اساس وضعیت</div><div class="order-filter-actions">${quick.map(f=>{const count=f[0]==='active'?activeCount:f[0]==='delivered'?deliveredCount:all.length;return `<button class="filter-chip ${visibleFilter===f[0]?'active':''}" data-order-filter="${f[0]}"><span>${f[1]}</span><b>${nf(count)}</b></button>`}).join('')}<button class="filter-chip advanced-filter" id="orderAdvancedFilter"><span>فیلتر بیشتر</span><b>☷</b></button></div></div><div class="order-list">${orders.map(orderRowHtml).join('')||'<div class="u-empty"><div class="u-empty-icon">▤</div><h3>سفارشی در این بخش نیست</h3><p>بعد از خرید سرویس، وضعیت سفارش اینجا نمایش داده میشه.</p><button class="primary" data-tab-jump="shop">رفتن به فروشگاه</button></div>'}</div><div class="orders-manage-footer"><button class="orders-manage-btn orders-manage-btn-bottom" id="ordersManageBtn" type="button" aria-label="مدیریت سفارش‌ها" title="مدیریت سفارش‌ها">•••</button></div>`}
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
  const orderTitle=o.user_label||o.display_name||'سفارش';
  return `<article class="order-row parity-order-card" data-order-open="${o.id}"><div class="order-row-main parity-order-main"><div class="order-icon">${o.image_url?`<img src="${esc(o.image_url)}">`:'🧾'}<small>${esc(orderStageLabel(o))}</small></div><div class="parity-order-copy"><h3>${esc(orderTitle)} <small>#${nf(o.id)}</small></h3>${o.user_label?`<div class="order-original-name">${esc(o.display_name||'')}</div>`:''}<div class="order-card-meta"><span>${esc(dateMini(o.created_at))}</span>${timerPill}</div><div class="order-card-total">${priceStr}${paid}</div></div><div class="parity-order-side">${orderStatusBadge(o)}<span class="chev">‹</span><button class="order-rename-btn" type="button" data-order-rename="${o.id}" aria-label="تغییر نام سفارش">✎</button></div></div><div class="order-row-stepper">${orderStepperHtml(o)}</div></article>`
}

function wheelGradient(rewards=[]){const colors=['#8b5cf6','#22c55e','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#ef4444','#84cc16'];const list=rewards.length?rewards:[{title:'جایزه'}];const step=100/list.length;return `conic-gradient(${list.map((_,i)=>`${colors[i%colors.length]} ${i*step}% ${(i+1)*step}%`).join(',')})`}
function wheelPrizeList(rewards=[]){return (rewards||[]).slice(0,8).map(r=>`<div class="wheel-prize"><b>${esc(r.title||'جایزه')}</b><br><span>${Number(r.amount||0)>0?fmt(r.amount):'جایزه دستی'}</span></div>`).join('') || '<p class="muted">جایزه‌ای تعریف نشده.</p>'}
function renderSpinWheel(){
 const rewards=state.spin_rewards||[],chances=Number(state.user?.spin_balance||0),per=Math.max(1,Number(state.spin_every||5)),canSpin=chances>0&&rewards.length>0;
 return `<article class="wallet-card spin-section spin-section-v2"><div class="spin-head"><span class="spin-head-icon" aria-hidden="true">${bgFeatureIcon('target',23)}</span><div class="spin-head-text"><small>جایزه‌های شانسی</small><h3>گردونه شانس</h3></div><div class="spin-chances-badge"><b>${nf(chances)}</b><span>شانس باقی‌مانده</span></div></div><p class="muted spin-desc">به‌ازای هر ${nf(per)} معرفی جدید، یک شانس گردونه دریافت می‌کنی. جایزهٔ برنده‌شده طبق قوانین سیستم ثبت می‌شود.</p><div class="wheel-stage"><div class="wheel-pointer-v2" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 20 3.5 5h17L12 20Z"/></svg></div><div class="wheel-glow"></div><div id="spinWheel" class="spin-wheel spin-wheel-v2" style="background:${wheelGradient(rewards)}"><div class="wheel-center wheel-center-v2"><span>SPIN</span></div></div></div><button id="spinBtn" class="primary spin-btn-v2" ${canSpin?'':'disabled'}>${canSpin?'چرخاندن گردونه':chances<=0?'شانس کافی نداری':'جایزه‌ای برای گردونه تعریف نشده'}</button><div id="spinResult" class="spin-result ${lastSpinPrize?'':'hidden'}">${lastSpinPrize?`<span class="spin-result-icon">${bgFeatureIcon('trophy',22)}</span><div><b>جایزه ثبت شد</b><p>${esc(lastSpinPrize.title||'جایزه گردونه')}${Number(lastSpinPrize.amount||0)>0?`<br>مبلغ ${fmt(lastSpinPrize.amount)} به اعتبار حساب اضافه شد.`:''}</p></div>`:''}</div><div class="wheel-prizes">${wheelPrizeList(rewards)}</div></article>`;
}
async function doSpinWheel(){
 const btn=$('spinBtn'),wheel=$('spinWheel'),result=$('spinResult');if(!btn||btn.disabled)return;btn.disabled=true;btn.textContent='در حال چرخش…';if(result)result.classList.add('hidden');
 const rewards=state.spin_rewards||[],count=Math.max(1,rewards.length),start=Number(wheel?.dataset.rot||0),fakeIndex=Math.floor(Math.random()*count),degPer=360/count,target=start+1440+(360-(fakeIndex*degPer+degPer/2));
 if(wheel){wheel.dataset.rot=String(target);wheel.style.transform=`rotate(${target}deg)`;}
 try{await new Promise(r=>setTimeout(r,1800));const data=await api('spin'),prize=data.prize||{};state=data;applyTheme(state);const idx=Number(prize.index??fakeIndex),finalRot=start+2160+(360-(idx*degPer+degPer/2));if(wheel){wheel.dataset.rot=String(finalRot);wheel.style.transform=`rotate(${finalRot}deg)`;}await new Promise(r=>setTimeout(r,2400));lastSpinPrize=prize;
 if(result){result.innerHTML=`<span class="spin-result-icon">${bgFeatureIcon('trophy',22)}</span><div><b>جایزه ثبت شد</b><p>${esc(prize.title||'جایزه گردونه')}${Number(prize.amount||0)>0?`<br>مبلغ ${fmt(prize.amount)} به اعتبار حساب اضافه شد.`:''}</p></div>`;result.classList.remove('hidden');}
 showStatus('جایزه گردونه با موفقیت ثبت شد.');const remaining=Number(state.user?.spin_balance||0);btn.disabled=remaining<=0;btn.textContent=remaining>0?'چرخاندن گردونه':'شانس کافی نداری';const badge=document.querySelector('#appSheet .spin-chances-badge');if(badge)badge.innerHTML=`<b>${nf(remaining)}</b><span>شانس باقی‌مانده</span>`;
 }catch(e){showStatus(e.message||'چرخاندن گردونه انجام نشد. دوباره تلاش کن.','error');btn.disabled=false;btn.textContent='تلاش دوباره';}
}
/* ── Wallet sub-tab helpers ────────────────────────────────────── */
function bgFeatureIcon(name,size=22){
 const p={
 gift:'<path d="M20 12v9H4v-9M2 7h20v5H2z"/><path d="M12 7v14M12 7H7.5a2.5 2.5 0 1 1 2.5-2.5C10 6 12 7 12 7Zm0 0h4.5A2.5 2.5 0 1 0 14 4.5C14 6 12 7 12 7Z"/>',
 users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
 userPlus:'<path d="M15 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M16 11h6"/>',
 link:'<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
 share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4"/>',
 copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
 qr:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v2M14 20h2M19 19h2v2h-2z"/>',
 info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v5M12 7h.01"/>',chart:'<path d="M3 3v18h18M7 14l4-4 4 3 5-7"/>',gem:'<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M9 3l-3 6 6 12 6-12-3-6"/>',coins:'<ellipse cx="9" cy="5" rx="7" ry="3"/><path d="M2 5v6c0 1.66 3.13 3 7 3 1.2 0 2.33-.14 3.3-.39M2 8c0 1.66 3.13 3 7 3M16 10c3.31 0 6 1.34 6 3s-2.69 3-6 3-6-1.34-6-3 2.69-3 6-3Z"/><path d="M10 13v6c0 1.66 2.69 3 6 3s6-1.34 6-3v-6"/>',
 target:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M8 15l2 2 5-5"/>',
 trophy:'<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H3v2a5 5 0 0 0 5 5M17 6h4v2a5 5 0 0 1-5 5"/>',
 check:'<path d="m5 12 4 4L19 6"/>',medal:'<circle cx="12" cy="8" r="6"/><path d="m8.2 13-1.4 8 5.2-2.7 5.2 2.7-1.4-8"/>',
 headset:'<path d="M3 13v-2a9 9 0 0 1 18 0v2"/><path d="M5 13h2v6H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2ZM19 13h-2v6h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2ZM17 19a5 5 0 0 1-5 3"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
 ticket:'<path d="M4 5h16v4a3 3 0 0 0 0 6v4H4v-4a3 3 0 0 0 0-6V5Z"/><path d="M9 9h6M9 15h6"/>',
 search:'<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 message:'<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 chevronLeft:'<path d="m15 18-6-6 6-6"/>',
 paperclip:'<path d="m21.4 11.1-8.5 8.5a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>,close:'<path d="m18 6-12 12M6 6l12 12"/>',send:'<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>'
 };
 return `<svg class="bg-feature-svg" width="${Number(size)||22}" height="${Number(size)||22}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${p[name]||p.gift}</svg>`;
}
function referralVipMini(u){
 const vip=u?.vip||{},refs=Number(u?.referrals_count||0),base=Number(vip.min_ref||0),next=vip.next===null||vip.next===undefined?null:Number(vip.next),pct=next===null?100:Math.max(0,Math.min(100,Math.round((refs-base)/Math.max(1,next-base)*100))),left=next===null?0:Math.max(0,next-refs);
 return `<article class="wallet-card ref-vip-card-v2"><div class="ref-vip-head-v2"><span class="ref-vip-emoji-v2" aria-hidden="true">${bgFeatureIcon('medal',23)}</span><div class="ref-vip-copy"><small>سطح فعلی همکاری</small><h3>${esc(vip.fa||vip.name||'برنز')}</h3><p class="muted">${next===null?'به بالاترین سطح همکاری رسیده‌ای.':`با ${nf(left)} معرفی موفق دیگر به سطح ${esc(vip.next_fa||vip.next_name||'بعدی')} می‌رسی.`}</p></div><button type="button" class="ghost referral-tier-guide-btn" id="referralTierGuide">${bgFeatureIcon('info',17)} راهنمای سطح‌ها</button></div><div class="ref-vip-track-v2" role="progressbar" aria-label="پیشرفت سطح همکاری" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div><div class="ref-vip-progress-meta"><small>${pct}% از مسیر سطح بعدی</small><small>${next===null?'سطح نهایی':`${nf(refs)} از ${nf(next)} معرفی موفق`}</small></div></article>`;
}
function referralTierGuideHtml(u){
 const configured=state?.settings?.vip_tier_rates||state?.vip_tier_rates||{};
 const defaults=[{key:'bronze',fa:'برنز',min_ref:0,multiplier:1},{key:'silver',fa:'سیلور',min_ref:10,multiplier:1.1},{key:'gold',fa:'گلد',min_ref:50,multiplier:1.25},{key:'diamond',fa:'دایموند',min_ref:100,multiplier:1.5}];
 const tiers=defaults.map(d=>{const c=configured?.[d.key]||{};return {...d,fa:String(c.fa||d.fa),min_ref:Number(c.min_ref??d.min_ref),multiplier:Number(c.multiplier??d.multiplier)}}).sort((a,b)=>a.min_ref-b.min_ref),refs=Number(u?.referrals_count||0);
 return `<div class="ref-tier-guide"><p class="ref-tier-guide-intro">سطح همکاری بر اساس تعداد معرفی‌های موفق ثبت‌شده تعیین می‌شود. با رسیدن به حدنصاب هر سطح، ضریب مزایای همان سطح اعمال می‌شود.</p><div class="ref-tier-guide-list">${tiers.map((t,i)=>{const next=tiers[i+1],active=refs>=t.min_ref&&(!next||refs<next.min_ref);return `<article class="ref-tier-row ${active?'is-current':''}"><span class="ref-tier-icon" aria-hidden="true">${bgFeatureIcon(t.key==='diamond'?'gem':'medal',21)}</span><div class="ref-tier-copy"><div class="ref-tier-title"><b>${esc(t.fa)}</b>${active?'<span class="ref-tier-current">سطح شما</span>':''}</div><p>${t.min_ref===0?'شروع همکاری':`حداقل ${nf(t.min_ref)} معرفی موفق`}</p></div><div class="ref-tier-benefit"><b>×${Number(t.multiplier).toLocaleString('fa-IR',{maximumFractionDigits:2})}</b><small>ضریب مزایا</small></div></article>`}).join('')}</div><div class="ref-tier-guide-note"><span>${bgFeatureIcon('info',18)}</span><p>تعداد معرفی‌های موفق شما: <b>${nf(refs)}</b>. در صورت نبود تنظیمات اختصاصی، حدنصاب‌ها و ضرایب پیش‌فرض نمایش داده می‌شوند.</p></div></div>`;
}
function openReferralTierGuide(){const u=state?.user||{};BlueGateUI.openSheet({type:'action',eyebrow:'راهنمای دعوت دوستان',title:'سطح‌های همکاری',subtitle:'شرایط ارتقا و ضریب مزایای هر سطح',body:referralTierGuideHtml(u),footer:`<button type="button" class="primary wide" data-tier-guide-close>متوجه شدم</button>`,onOpen:host=>host.querySelector('[data-tier-guide-close]')?.addEventListener('click',()=>BlueGateUI.closeSheet?.())})}
function openReferralShareMini(){
 const u=state.user;if(!u)return;const link=String(u.referral_link||''),code=String(u.ref_code||'');if(!link)return showStatus('لینک دعوت شما هنوز در دسترس نیست. لطفاً دوباره تلاش کنید.','error');
 const ss=$('shareSheet');if(!ss)return;
 ss.innerHTML=`<div class="share-sheet-inner referral-share-mini referral-share-polished"><div class="share-sheet-handle" data-close-share aria-label="بستن پنجره"></div>
 <div class="share-sheet-head"><span class="share-product-thumb" aria-hidden="true">${bgFeatureIcon('share',23)}</span><div class="share-product-info"><h3>اشتراک‌گذاری لینک دعوت</h3><p class="muted">کد دعوت: <b dir="ltr">${esc(code||'—')}</b></p></div><button class="ghost share-close-btn" type="button" data-close-share aria-label="بستن">${bgFeatureIcon('close',18)}</button></div>
 <p class="referral-share-intro">دوستت را با لینک اختصاصی خودت دعوت کن تا معرفی از طریق حساب تو ثبت شود.</p><div class="referral-share-link"><small>لینک اختصاصی شما</small><b dir="ltr">${esc(link)}</b></div>
 <div class="share-actions"><button class="share-btn share-native" id="refNativeShare"><span class="share-btn-icon">${bgFeatureIcon('share',20)}</span><span class="share-btn-copy"><b>اشتراک‌گذاری</b><small>انتخاب برنامه از منوی اشتراک‌گذاری دستگاه</small></span></button>
 <button class="share-btn share-tg" id="refTelegramShare"><span class="share-btn-icon">${bgFeatureIcon('send',20)}</span><span class="share-btn-copy"><b>ارسال در تلگرام</b><small>فرستادن مستقیم لینک برای دوستان</small></span></button>
 <button class="share-btn share-copy" id="refCopyLink"><span class="share-btn-icon">${bgFeatureIcon('link',20)}</span><span class="share-btn-copy"><b>کپی لینک دعوت</b><small>برای ارسال در هر پیام‌رسانی</small></span></button>
 <button class="share-btn" id="refCopyCode"><span class="share-btn-icon">${bgFeatureIcon('copy',20)}</span><span class="share-btn-copy"><b>کپی کد دعوت</b><small>کد اختصاصی برای معرفی</small></span></button>
 <button class="share-btn" id="refShowQr"><span class="share-btn-icon">${bgFeatureIcon('qr',20)}</span><span class="share-btn-copy"><b>نمایش کد QR</b><small>اسکن برای باز کردن لینک دعوت</small></span></button></div></div>`;
 ss.style.display='block';ss.classList.add('open');ss.querySelectorAll('[data-close-share]').forEach(x=>x.addEventListener('click',closeShareSheet));
 $('refNativeShare')?.addEventListener('click',async()=>{try{if(navigator.share)await navigator.share({title:'دعوت به BlueGate',text:'از لینک دعوت من برای ورود به BlueGate استفاده کن.',url:link});else{await navigator.clipboard?.writeText(link);showStatus('لینک دعوت کپی شد.')}}catch(e){if(e?.name!=='AbortError')showStatus('اشتراک‌گذاری انجام نشد. لینک را کپی کن.','error')}});
 $('refTelegramShare')?.addEventListener('click',()=>{const url='https://t.me/share/url?url='+encodeURIComponent(link)+'&text='+encodeURIComponent('دعوت به BlueGate');if(TG?.openTelegramLink)TG.openTelegramLink(url);else window.open(url,'_blank','noopener,noreferrer')});
 $('refCopyLink')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(link);showStatus('لینک دعوت کپی شد.')}catch(_){showStatus('امکان کپی خودکار نیست؛ لینک را از کادر بالا کپی کن.','error')}});
 $('refCopyCode')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(code);showStatus('کد دعوت کپی شد.')}catch(_){showStatus('امکان کپی خودکار نیست.','error')}});
 $('refShowQr')?.addEventListener('click',()=>openQrSheet());
}
function openCustomReferralCodeMini(){const u=state.user||{},min=Number(state.custom_code_min||3),eligible=Number(u.referrals_count||0)>=min;if(!eligible)return showStatus(`برای تغییر کد حداقل ${nf(min)} زیرمجموعه لازم است`,'error');openEdit('شخصی‌سازی لینک دعوت',[{title:'کد اختصاصی',fields:[{id:'mini_ref_code',label:'کد دعوت',value:u.ref_code||'',placeholder:'BLUEPALI'}]}],async()=>{const code=String(val('mini_ref_code')||'').trim();if(code.length<4||code.length>20)return showStatus('کد باید ۴ تا ۲۰ کاراکتر باشد','error');state=await api('custom_code',{code});showStatus('کد دعوت بروزرسانی شد');renderWallet()})}
function creditTxKindMini(t={}){const type=String(t.type||'').toLowerCase();if(type==='credit_topup')return 'topup';if(type.includes('refund'))return 'refund';if(type.includes('reward')||type.includes('referral')||type.includes('spin')||type.includes('mission'))return 'reward';if(Number(t.amount)<0)return 'purchase';return 'other'}
function creditTxLabelMini(t={}){const labels={credit_topup:'شارژ اعتبار',purchase:'خرید سرویس',order_payment:'پرداخت سفارش',refund:'بازگشت وجه',referral_reward:'پاداش دعوت',spin_reward:'پاداش گردونه',mission_reward:'پاداش مأموریت'};return String(t.description||labels[String(t.type||'').toLowerCase()]||'تراکنش اعتبار')}
function creditTxSignedAmountMini(t={}){return String(t.currency||'IRT').toUpperCase()==='USD'&&t.amount_usd!=null?Number(t.amount_usd):Number(t.amount||0)}
function creditTxAmountMini(t={}){const a=creditTxSignedAmountMini(t);return String(t.currency||'IRT').toUpperCase()==='USD'?(a>=0?'+':'')+'$'+Math.abs(a).toFixed(4):(a>=0?'+':'')+fmt(a)}
function creditTopupAmountMini(t={}){return String(t.credit_currency||'IRT').toUpperCase()==='USD'&&t.credit_amount_usd!=null?'$'+Number(t.credit_amount_usd).toFixed(4):fmt(t.amount)}
function creditTxDateMini(value){const d=parseServerDate(value);return d?d.toLocaleDateString('fa-IR',{year:'numeric',month:'short',day:'numeric'}):String(value||'تاریخ نامشخص')}
function miniCreditStatusClass(s){return ['payment_confirmed'].includes(s)?'ok':['rejected','canceled'].includes(s)?'bad':'wait'}
function miniCreditMissionRow(m,u){const today=Number(u.today_referrals||0),target=Math.max(1,Number(m.target||m.referrals||0)),progress=Math.max(0,Math.min(target,today)),pct=Math.round(progress/target*100),reward=Number(m.reward||m.amount||0);return `<div class="credit-mission-mini-row"><div><b>${nf(target)} دعوت امروز</b><small>پاداش ${fmt(reward)} اعتبار</small></div><div class="credit-mission-mini-meta"><span>${nf(progress)} / ${nf(target)}</span><i><em style="width:${pct}%"></em></i></div></div>`}
function ensureMiniCreditTopupSheet(){let o=$('miniCreditTopupSheet');if(!o){o=document.createElement('div');o.id='miniCreditTopupSheet';o.className='mini-credit-topup-sheet';document.body.appendChild(o)}return o}
function closeMiniCreditTopup(){const o=$('miniCreditTopupSheet');if(o){o.classList.remove('open');o.innerHTML=''}}
function miniTopupShell(title,subtitle,body,eyebrow='BLUEGATE CREDIT'){const o=ensureMiniCreditTopupSheet();o.innerHTML=`<div class="mini-credit-topup-backdrop" data-mini-topup-close></div><section class="mini-credit-topup-panel" role="dialog" aria-modal="true"><div class="mini-credit-sheet-handle"></div><header><div><small>${esc(eyebrow)}</small><h3>${esc(title)}</h3><p>${esc(subtitle||'')}</p></div><button class="ghost" type="button" data-mini-topup-close>✕</button></header><div class="mini-credit-topup-body">${body}</div></section>`;o.classList.add('open');o.querySelectorAll('[data-mini-topup-close]').forEach(x=>x.addEventListener('click',closeMiniCreditTopup));return o}
function openMiniCreditTopup(){prepareMiniLayer('miniCreditTopupSheet');const cfg=state.credit_topup||{};if(cfg.enabled===false)return showStatus(window.BlueGateI18n?.language==='en'?'Top-ups are currently disabled':'شارژ اعتبار فعلاً غیرفعال است','error');const en=window.BlueGateI18n?.language==='en',currency=en?'USD':'IRT',rate=Number(state.storefront_rates?.usdt_toman||192000),presets=(cfg.presets||[100000,200000,500000]).map(Number).filter(Boolean).map(v=>en&&rate>0?Math.round(v/rate*100)/100:v),min=Number(cfg.min||50000),max=Number(cfg.max||5000000),minInput=en&&rate>0?Math.ceil(min/rate*100)/100:min,maxInput=en&&rate>0?Math.floor(max/rate*100)/100:max,balance=Number(state.user?.balance||0),usdBalance=Number(state.user?.usd_balance||0),initial=en?usdBalance+balance/rate:balance,moneyText=v=>en?'$'+Number(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4}):fmt(v);const o=miniTopupShell(en?'Add credit':'شارژ حساب',en?'Choose an amount to add to your USD wallet.':'مبلغ موردنظر را انتخاب کن.',`<div class="mini-topup-balance"><span>${en?'Total balance (USD equivalent)':'اعتبار فعلی'}</span><b>${moneyText(initial)}</b></div><div class="mini-topup-presets">${presets.map(v=>`<button type="button" data-mini-topup-amount="${v}">${moneyText(v)}</button>`).join('')}</div><label class="mini-topup-custom">${en?'Custom amount':'مبلغ دلخواه'}<input id="miniTopupCustom" type="number" inputmode="decimal" step="${en?'0.01':'1'}" min="${minInput}" max="${maxInput}" placeholder="${en?'From $'+minInput.toFixed(2)+' to $'+maxInput.toFixed(2):'از '+fmt(min)+' تا '+fmt(max)}"></label><div class="mini-topup-after"><span>${en?'Balance after credit':'اعتبار بعد از پرداخت'}</span><b id="miniTopupAfter">${moneyText(initial)}</b></div><button class="primary wide" id="miniTopupContinue" type="button">${en?'Continue':'ادامه'}</button><p class="muted mini-topup-limit">${en?'Limits use the current USDT/Toman rate.':'حداقل '+fmt(min)+' · حداکثر '+fmt(max)}</p>${en&&rate>0?`<p class="muted">Rate: 1 USD ≈ ${fmt(rate)} Toman</p>`:''}`);let chosen=0;const inp=o.querySelector('#miniTopupCustom'),after=o.querySelector('#miniTopupAfter');const choose=v=>{chosen=Number(v||0);if(inp)inp.value=chosen||'';o.querySelectorAll('[data-mini-topup-amount]').forEach(b=>b.classList.toggle('active',Number(b.dataset.miniTopupAmount)===chosen));if(after)after.textContent=moneyText(initial+chosen)};o.querySelectorAll('[data-mini-topup-amount]').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.miniTopupAmount)));inp?.addEventListener('input',()=>{chosen=Number(inp.value||0);o.querySelectorAll('[data-mini-topup-amount]').forEach(b=>b.classList.remove('active'));if(after)after.textContent=moneyText(initial+Math.max(0,chosen))});o.querySelector('#miniTopupContinue')?.addEventListener('click',async()=>{if(!Number.isFinite(chosen)||chosen<=0||(en?(chosen<minInput||chosen>maxInput):(chosen<min||chosen>max)))return showStatus(en?'Amount is outside the allowed range':`مبلغ باید بین ${fmt(min)} و ${fmt(max)} باشد`,'error');try{const r=await api('create_credit_topup',{amount:chosen,currency});state=r;openMiniTopupMethods(r.topup)}catch(e){showStatus(e.message||'ساخت درخواست شارژ انجام نشد','error')}});if(presets[0])choose(presets[0])}
function openMiniTopupMethods(t){const cfg=state.credit_topup||{},m=cfg.methods||{},pm=state.payment_methods||{},en=String(t.credit_currency||'IRT').toUpperCase()==='USD',amountLabel=en?'$'+Number(t.credit_amount_usd||0).toFixed(4):fmt(t.amount);const methods=[];if(!en&&m.card&&pm.card?.enabled)methods.push(`<button type="button" data-mini-topup-method="card"><span>💳</span><div><b>کارت به کارت</b><small>ارسال رسید و بررسی ادمین</small></div><i>←</i></button>`);if(m.stars&&pm.stars?.enabled)methods.push(`<button type="button" data-mini-topup-method="stars"><span>⭐</span><div><b>Telegram Stars</b><small>پرداخت مستقیم داخل تلگرام</small></div><i>←</i></button>`);if(m.crypto&&pm.crypto?.enabled)methods.push(`<button type="button" data-mini-topup-method="crypto"><span>🪙</span><div><b>رمزارز</b><small>واریز به ولت و ثبت TXID</small></div><i>←</i></button>`);const o=miniTopupShell(en?'Payment method':'روش پرداخت',en?`Add ${amountLabel} to your USD wallet. The amount is fixed at the live exchange rate.`:`شارژ ${amountLabel} اعتبار`,`<div class="mini-topup-method-list">${methods.join('')||'<div class="hub-empty">روش پرداخت فعالی برای شارژ وجود ندارد.</div>'}</div><button type="button" class="ghost wide" id="miniTopupBackAmount">← تغییر مبلغ</button>`);o.querySelector('#miniTopupBackAmount')?.addEventListener('click',async()=>{try{await api('cancel_credit_topup',{topup_id:t.id})}catch(_){}openMiniCreditTopup()});o.querySelectorAll('[data-mini-topup-method]').forEach(b=>b.addEventListener('click',async()=>{const method=b.dataset.miniTopupMethod;try{if(method==='stars'){const r=await api('credit_topup_start_stars',{topup_id:t.id});state=r;openMiniTopupDone(r.topup,'فاکتور Stars ارسال شد؛ بعد از پرداخت اعتبار خودکار اضافه می‌شود.');return}if(method==='card'){const r=await api('credit_topup_set_method',{topup_id:t.id,method:'card'});state=r;openMiniTopupCard(r.topup);return}openMiniTopupCryptoChoose(t)}catch(e){showStatus(e.message||'انتخاب روش پرداخت انجام نشد','error')}}))}
function openMiniTopupCard(t){const accounts=t.payment_details?.accounts||[];const inst=t.payment_details?.instructions||state.payment_instructions||'';const o=miniTopupShell('کارت به کارت',`مبلغ دقیق: ${fmt(t.amount)}`,`<div class="mini-topup-card-list">${accounts.map((a,i)=>`<button type="button" class="mini-topup-bank ${i===0?'active':''}" data-mini-card-index="${i}"><b>${esc(a.title||a.bank||'کارت')}</b><strong>${esc(a.card||a.card_number||'')}</strong><small>${esc(a.name||a.holder||'')}</small></button>`).join('')||'<div class="hub-empty">اطلاعات کارت تنظیم نشده.</div>'}</div>${inst?`<p class="mini-topup-instructions">${esc(inst)}</p>`:''}<label class="mini-topup-file">تصویر رسید<input id="miniTopupReceipt" type="file" accept="image/jpeg,image/png,image/webp"></label><label class="mini-topup-custom">توضیح اختیاری<textarea id="miniTopupNote" rows="2" placeholder="مثلاً چهار رقم آخر کارت"></textarea></label><button class="primary wide" id="miniTopupReceiptSubmit" type="button">ارسال رسید برای بررسی</button>`);o.querySelectorAll('[data-mini-card-index]').forEach(b=>b.addEventListener('click',()=>{o.querySelectorAll('[data-mini-card-index]').forEach(x=>x.classList.remove('active'));b.classList.add('active')}));o.querySelector('#miniTopupReceiptSubmit')?.addEventListener('click',async()=>{const f=o.querySelector('#miniTopupReceipt')?.files?.[0];if(!f)return showStatus('تصویر رسید را انتخاب کن','error');if(f.size>5*1024*1024)return showStatus('حجم رسید حداکثر ۵ مگابایت است','error');const reader=new FileReader();reader.onload=async ev=>{try{const r=await api('credit_topup_submit_receipt',{topup_id:t.id,note:o.querySelector('#miniTopupNote')?.value||'',receipt_b64:ev.target.result});state=r;openMiniTopupDone(r.topup,'رسید ثبت شد و منتظر بررسی است.');renderWallet()}catch(e){showStatus(e.message||'ارسال رسید انجام نشد','error')}};reader.readAsDataURL(f)})}
function openMiniTopupCryptoChoose(t){const wallets=state.payment_methods?.crypto?.wallets||[];const o=miniTopupShell('انتخاب رمزارز','ولت مقصد را انتخاب کن.',`<div class="mini-topup-method-list">${wallets.map(w=>`<button type="button" data-mini-crypto-wallet="${w.id}"><span>🪙</span><div><b>${esc(w.asset||'Crypto')} · ${esc(w.network||'')}</b><small>${esc(w.label||w.title||'ولت پرداخت')}</small></div><i>←</i></button>`).join('')||'<div class="hub-empty">ولت فعالی تنظیم نشده.</div>'}</div>`);o.querySelectorAll('[data-mini-crypto-wallet]').forEach(b=>b.addEventListener('click',async()=>{try{const r=await api('credit_topup_set_method',{topup_id:t.id,method:'crypto',details:{wallet_id:Number(b.dataset.miniCryptoWallet)}});state=r;openMiniTopupCryptoPay(r.topup)}catch(e){showStatus(e.message||'آماده‌سازی پرداخت رمزارز انجام نشد','error')}}))}
function openMiniTopupCryptoPay(t){const d=t.payment_details||{};const o=miniTopupShell('پرداخت رمزارز',`${esc(d.asset||t.crypto_asset||'')} · ${esc(d.network||t.crypto_network||'')}`,`<div class="mini-topup-crypto-box"><small>مبلغ دقیق</small><strong>${esc(String(d.expected_amount||t.crypto_amount||'—'))} ${esc(d.asset||t.crypto_asset||'')}</strong><small>آدرس مقصد</small><code>${esc(d.address||'—')}</code><button class="ghost wide" id="miniCopyCryptoAddress" type="button">کپی آدرس</button></div><label class="mini-topup-custom">TXID<input id="miniTopupTxid" autocomplete="off" placeholder="Transaction Hash"></label><button class="primary wide" id="miniTopupTxSubmit" type="button">ثبت TXID</button>`);o.querySelector('#miniCopyCryptoAddress')?.addEventListener('click',()=>{navigator.clipboard?.writeText(d.address||'');showStatus('آدرس کپی شد')});o.querySelector('#miniTopupTxSubmit')?.addEventListener('click',async()=>{const tx=o.querySelector('#miniTopupTxid')?.value.trim()||'';if(!tx)return showStatus('TXID را وارد کن','error');try{const r=await api('credit_topup_submit_crypto_hash',{topup_id:t.id,tx_hash:tx});state=r;openMiniTopupDone(r.topup,'TXID ثبت شد و منتظر بررسی است.');renderWallet()}catch(e){showStatus(e.message||'ثبت TXID انجام نشد','error')}})}
function openMiniTopupDone(t,msg){const o=miniTopupShell('درخواست شارژ ثبت شد',msg||'وضعیت درخواست را از تاریخچه اعتبار می‌تونی ببینی.',`<div class="mini-topup-success"><span>✓</span><b>${t?creditTopupAmountMini(t):'0'}</b><small>${esc(t?.status_fa||'ثبت شد')}</small></div><button class="primary wide" id="miniTopupDoneBtn" type="button">متوجه شدم</button>`);o.querySelector('#miniTopupDoneBtn')?.addEventListener('click',()=>{closeMiniCreditTopup();renderWallet()})}
function _walletOverview(u){const cfg=state.credit_topup||{},topups=state.credit_topups||[],txs=state.transactions||[],active=topups.filter(x=>['pending_payment','receipt_submitted','reviewing'].includes(x.status)),en=window.BlueGateI18n?.language==='en',rate=Number(state.storefront_rates?.usdt_toman||192000),irtBalance=Number(u.balance||0),usdBalance=Number(u.usd_balance||0),displayUsd=usdBalance+irtBalance/rate;return `<div class="wallet-tab-panel credit-center-mini-v27"><section class="mini-credit-hero-v27"><div><small>BLUEGATE CREDIT</small><h2>${en?'Your wallet':'اعتبار شما'}</h2><strong data-count-anim="${en?displayUsd:irtBalance}">${en?'$'+displayUsd.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4}):fmt(irtBalance)}</strong><p>${en?'Total available balance shown in USD equivalent at the live rate.':'برای خرید و تمدید سرویس‌ها؛ قابل برداشت نقدی نیست.'}</p>${en?`<small>USD wallet: $${usdBalance.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4})} · Rate: ${fmt(rate)} Toman/USD</small><div style="margin-top:8px;font-size:13px">IRT wallet: ${fmt(irtBalance)} Toman · ≈ $${(irtBalance/rate).toFixed(2)}</div>`:''}</div><div class="mini-credit-hero-actions"><button class="primary" id="miniCreditTopup" ${cfg.enabled===false?'disabled':''}>＋ شارژ حساب</button><button class="ghost" data-credit-view="history">تراکنش‌ها</button></div></section><section class="mini-credit-stats-v27"><div><small>پاداش کل</small><b>${fmt(u.total_earned||0)}</b></div><div><small>دعوت موفق</small><b>${nf(u.referrals_count||0)}</b></div><div><small>شانس گردونه</small><b>${nf(u.spin_balance||0)}</b></div><div><small>دعوت امروز</small><b>${nf(u.today_referrals||0)}</b></div></section>${active.length?`<article class="wallet-card mini-credit-pending"><div class="section-title"><div><h2>درخواست‌های شارژ باز</h2><small>${nf(active.length)} مورد</small></div></div>${active.slice(0,3).map(x=>`<div class="mini-topup-open-row"><div class="mini-topup-open-main"><span>#${nf(x.id)} · ${creditTopupAmountMini(x)}</span><small>${esc(x.payment_method_fa||'روش پرداخت انتخاب نشده')}</small></div><em class="${miniCreditStatusClass(x.status)}">${esc(x.status_fa||x.status)}</em><div class="mini-topup-open-actions">${x.status==="pending_payment"?`<button type="button" class="primary" data-mini-topup-pay="${x.id}">ادامه پرداخت</button>`:""}<button type="button" data-mini-topup-change="${x.id}">تغییر روش</button><button type="button" class="danger" data-mini-topup-cancel="${x.id}">لغو</button></div></div>`).join('')}</article>`:''}<article class="wallet-card mini-credit-history-preview"><div class="section-title"><div><h2>آخرین تراکنش‌ها</h2><small>آخرین شارژ، خرید و پاداش</small></div><button class="ghost" data-credit-view="history">همه</button></div><div class="mini-credit-tx-list">${txs.slice(0,4).map(t=>`<div><span class="mini-credit-tx-icon ${creditTxKindMini(t)}">${Number(t.amount)>=0?'↑':'↓'}</span><div class="mini-credit-tx-copy"><b>${esc(creditTxLabelMini(t))}</b><small>${esc(creditTxDateMini(t.created_at))}</small></div><strong class="${creditTxSignedAmountMini(t)>=0?'positive':'negative'}">${creditTxAmountMini(t)}</strong></div>`).join('')||`<div class="u-empty"><div class="u-empty-icon">◫</div><h3>هنوز تراکنشی نداری</h3><p>اولین خرید یا شارژ حساب اینجا ثبت میشه.</p><button class="primary" id="miniCreditTopupEmpty" ${cfg.enabled===false?'disabled':''}>شارژ حساب</button></div>`}</div></article></div>`}
function _walletReferral(u){
 const eligible=Number(u.referrals_count||0)>=Number(state.custom_code_min||3),code=u.ref_code||'',link=u.referral_link||'',referrals=Number(u.referrals_count||0),today=Number(u.today_referrals||0),earned=Number(u.total_earned||0);
 return `<div class="wallet-tab-panel referral-center-mini-v2 referral-center-v27 referral-center-v29">
 <section class="referral-top-v27 referral-top-v29"><div class="referral-top-copy-v27"><small>BLUEGATE · INVITE & EARN</small><h2>دعوت دوستان</h2><p>لینک اختصاصی‌ات را با دوستانت به اشتراک بگذار؛ معرفی‌های موفق و پاداش‌های ثبت‌شده را همین‌جا پیگیری کن.</p></div><span class="referral-top-icon-v27" aria-hidden="true">${bgFeatureIcon('userPlus',24)}</span></section>
 <section class="referral-balance-v27 referral-balance-v29"><div class="referral-balance-label-v27"><span>موجودی قابل استفاده</span><span class="referral-live-dot-v27"></span></div><strong data-count-anim="${Number(u.balance||0)}">${fmt(u.balance||0)}</strong><p>اعتبار فعلی حسابت برای خرید سرویس‌ها و پرداخت‌های داخل BlueGate.</p></section>
 <section class="referral-metrics-panel"><div class="referral-panel-heading"><span>${bgFeatureIcon('chart',18)}</span><div><h3>گزارش دعوت‌های شما</h3><p>آمار ثبت‌شده برای حساب شما</p></div></div><div class="referral-stats-v27 referral-stats-v29">
 <article><span class="referral-stat-icon-v27">${bgFeatureIcon('users',19)}</span><div><small>معرفی موفق</small><b>${nf(referrals)}</b></div></article><article><span class="referral-stat-icon-v27">${bgFeatureIcon('calendar',19)}</span><div><small>امروز</small><b>${nf(today)}</b></div></article><article><span class="referral-stat-icon-v27">${bgFeatureIcon('coins',19)}</span><div><small>مجموع پاداش</small><b>${fmt(earned)}</b><em>اعتبار ثبت‌شده</em></div></article><article><span class="referral-stat-icon-v27">${bgFeatureIcon('medal',19)}</span><div><small>سطح همکاری</small><b>${esc(u.vip?.fa||u.vip?.name||'برنز')}</b><button type="button" class="referral-inline-guide" id="referralTierGuideInline">مشاهده راهنما</button></div></article></div></section>
 ${referralVipMini(u)}
 <article class="wallet-card referral-card referral-card-v2 referral-invite-card-v27 referral-invite-card-v29"><div class="referral-card-head"><span class="referral-icon">${bgFeatureIcon('link',21)}</span><div><h3>لینک دعوت اختصاصی</h3><p class="muted">برای اینکه معرفی به نام شما ثبت شود، دوستتان باید از همین لینک وارد شود.</p></div></div>
 <div class="referral-code-row"><small>کد دعوت شما</small><b dir="ltr">${esc(code||'—')}</b><button type="button" class="ghost" id="shareInviteNative">${bgFeatureIcon('share',17)} اشتراک‌گذاری</button></div><div class="referral-url-v27"><small>لینک اختصاصی</small><span dir="ltr">${esc(link||'لینک دعوت در دسترس نیست')}</span></div>
 <div class="ref-mini-actions-v2"><button class="primary" id="openReferralShareMini">${bgFeatureIcon('share',17)} اشتراک‌گذاری</button><button class="ghost" id="copyLink">${bgFeatureIcon('copy',17)} کپی لینک</button><button class="ghost" id="openQrWallet">${bgFeatureIcon('qr',17)} کد QR</button></div>
 <details class="ref-custom-mini-v2"><summary>تنظیم کد دعوت دلخواه <span>${eligible?'امکان ویرایش فعال است':`نیاز به ${nf(state.custom_code_min||3)} معرفی موفق`}</span></summary><p class="muted">${eligible?'می‌توانی کد دعوت کوتاه و دلخواهی انتخاب کنی.':'پس از رسیدن به حداقل معرفی موفق تعیین‌شده، امکان تغییر کد دعوت فعال می‌شود.'}</p><button class="secondary" id="openCustomReferralCode" ${eligible?'':'disabled'}>ویرایش کد دعوت</button></details></article>
 <div id="referralTreePlaceholder"><article class="wallet-card referral-tree-card referral-tree-v2"><div class="referral-tree-head"><span class="admin-card-icon">${bgFeatureIcon('users',21)}</span><div><h3>معرفی‌های شما</h3><p class="muted">در حال بارگذاری فهرست معرفی‌ها…</p></div></div></article></div></div>`;
}
function _walletMissions(u){
 const today=Number(u.today_referrals||0),missions=Array.isArray(state.missions)?state.missions:[],ready=missions.filter(m=>m&&m.done&&!m.claimed).length,claimed=missions.filter(m=>m&&m.claimed).length,completed=missions.filter(m=>m&&m.done).length;
 return `<div class="wallet-tab-panel rewards-center-v27 rewards-center-v29">
 <section class="rewards-overview-v27 rewards-overview-v29"><div class="rewards-overview-copy-v27"><small>BLUEGATE · REWARDS CLUB</small><h2>پاداش‌های من</h2><p>با تکمیل مأموریت‌ها پاداش بگیر، پاداش‌های آماده را دریافت کن و شانس‌های گردونه را استفاده کن. وضعیت هر مورد در کارت خودش مشخص است.</p></div><span class="rewards-overview-icon-v27">${bgFeatureIcon('gift',24)}</span></section>
 <section class="rewards-summary-panel"><div class="rewards-summary-heading"><span>${bgFeatureIcon('chart',18)}</span><div><h3>خلاصه پاداش‌ها</h3><p>وضعیت فعلی پاداش‌ها و مأموریت‌های شما</p></div></div><div class="rewards-stats-v27 rewards-stats-v29">
 <article><span class="rewards-stat-icon-v27">${bgFeatureIcon('target',20)}</span><div><small>شانس گردونه</small><b>${nf(u.spin_balance||0)}</b><em>آماده استفاده</em></div></article><article><span class="rewards-stat-icon-v27">${bgFeatureIcon('gift',20)}</span><div><small>آماده دریافت</small><b>${nf(ready)}</b><em>پاداش مأموریت‌ها</em></div></article><article><span class="rewards-stat-icon-v27">${bgFeatureIcon('check',20)}</span><div><small>تکمیل‌شده</small><b>${nf(completed)}</b><em>از ${nf(missions.length)} مأموریت</em></div></article><article><span class="rewards-stat-icon-v27">${bgFeatureIcon('trophy',20)}</span><div><small>دریافت‌شده</small><b>${nf(claimed)}</b><em>پاداش‌های قبلی</em></div></article></div></section>
 <section class="rewards-wheel-wrap-v27 rewards-wheel-wrap-v29">${renderSpinWheel()}</section>
 <article class="wallet-card missions-panel rewards-missions-v27 rewards-missions-v29"><div class="section-title rewards-missions-heading"><div><h2>مأموریت‌های روزانه</h2><small>امروز ${nf(today)} معرفی موفق ثبت شده است. پس از تکمیل هدف، پاداش آماده دریافت می‌شود.</small></div><span class="rewards-mission-count-v27">${nf(missions.length)} مأموریت</span></div>
 <div class="missions-grid">${missions.map(missionCard).join('')||'<div class="rewards-empty-v27"><span class="rewards-empty-icon" aria-hidden="true">'+bgFeatureIcon('calendar',26)+'</span><b>در حال حاضر مأموریتی فعال نیست</b><p>فعلاً مأموریتی برای حساب شما تعریف نشده است. بعداً دوباره بررسی کنید.</p></div>'}</div>
 <div class="rewards-claim-area"><div class="rewards-claim-copy"><span>${bgFeatureIcon('gift',19)}</span><div><b>${ready>0?'پاداش آماده دریافت است':'وضعیت دریافت پاداش'}</b><small>${ready>0?`${nf(ready)} مأموریت تکمیل شده و پاداش آن قابل دریافت است.`:claimed>0?'پاداش‌های دریافت‌شده در خلاصه بالا ثبت شده‌اند.':'با تکمیل مأموریت‌ها، پاداش‌های قابل دریافت در این بخش فعال می‌شوند.'}</small></div></div><button class="success rewards-claim-btn-v27" id="claimBtn" ${ready===0?'disabled':''}>${bgFeatureIcon('gift',18)} ${ready>0?'دریافت پاداش‌های آماده':'پاداش آماده‌ای برای دریافت نیست'}</button></div></article></div>`;
}
function _walletHistory(u){
  const txs=state.transactions||[],topups=state.credit_topups||[];
  return `<div class="wallet-tab-panel credit-history-mini-v27"><article class="wallet-card"><div class="section-title" style="margin-bottom:14px"><div><h2>📋 تاریخچه اعتبار</h2><small>${nf(txs.length)} تراکنش</small></div><button class="primary" id="miniCreditTopupHistory" ${state.credit_topup?.enabled===false?'disabled':''}>＋ شارژ</button></div>${topups.length?`<div class="mini-topup-history-strip">${topups.slice(0,4).map(x=>`<div><span><b>شارژ #${nf(x.id)}</b><small>${creditTopupAmountMini(x)}</small></span><em class="${miniCreditStatusClass(x.status)}">${esc(x.status_fa||x.status)}</em></div>`).join('')}</div>`:''}<div class="mini-credit-tx-list">${txs.map(t=>`<div><span class="mini-credit-tx-icon ${creditTxKindMini(t)}">${Number(t.amount)>=0?'↑':'↓'}</span><div class="mini-credit-tx-copy"><b>${esc(creditTxLabelMini(t))}</b><small>${esc(creditTxDateMini(t.created_at))}</small></div><strong class="${creditTxSignedAmountMini(t)<0?'negative':'positive'}">${creditTxAmountMini(t)}</strong></div>`).join('')||'<div class="mini-credit-empty"><b>هنوز تراکنشی ثبت نشده</b><p>از شارژ حساب یا خرید سرویس شروع کن.</p><button class="primary" id="miniCreditTopupHistoryEmpty">شارژ حساب</button></div>'}</div></article></div>`;
}
function openMiniReferralCenter(){return openCreditSubview('referral')}
function openCreditSubview(kind){const u=state.user||{};let title='',subtitle='',body='';if(kind==='referral'){title='دعوت دوستان';subtitle='لینک دعوت، سطح همکاری و زیرمجموعه‌ها';body=_walletReferral(u)}else if(kind==='rewards'){title='پاداش‌ها';subtitle='ماموریت‌های روزانه و گردونه شانس';body=_walletMissions(u)}else{title='تاریخچه اعتبار';subtitle='شارژ، خرید، پاداش و بازگشت وجه';body=_walletHistory(u)}const host=BlueGateUI.openSheet({type:'fullscreen',eyebrow:'BLUEGATE CREDIT',title,subtitle,body,onOpen:()=>{triggerBalanceAnims();if(kind==='referral'){loadReferralTree().then(refs=>{const ph=$('referralTreePlaceholder');if(ph)ph.innerHTML=referralTreeHtml(refs)});host.querySelectorAll('#referralTierGuide,#referralTierGuideInline').forEach(btn=>btn.addEventListener('click',openReferralTierGuide))}}});return host}
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
    customers:()=>typeof renderAdminCustomers==='function'?renderAdminCustomers():renderAdminMissing('کاربران'),
    inventory:()=>typeof renderAdminInventory==='function'?renderAdminInventory():renderAdminMissing('انبار'),
    coupons:()=>typeof renderAdminCoupons==='function'?renderAdminCoupons():renderAdminMissing('تخفیف‌ها'),
    notifications:()=>renderAdminNotifications(),support:()=>renderAdminSupport(),
    activity:()=>typeof renderAdminActivity==='function'?renderAdminActivity():renderAdminMissing('فعالیت'),
    roles:()=>typeof renderAdminRoles==='function'?renderAdminRoles():renderAdminMissing('نقش‌ها'),
    settings:()=>typeof renderAdminSettings==='function'?renderAdminSettings():renderAdminMissing('تنظیمات'),
    backups:()=>typeof renderAdminBackups==='function'?renderAdminBackups():renderAdminMissing('بکاپ'),
    infrastructure:()=>renderAdminInfrastructure(),
    advanced:()=>renderAdminAdvanced()
  };
  const content=$('adminContent');content.classList.remove('admin-content-enter');void content.offsetWidth;
  try{content.innerHTML=(renderers[currentAdminTab]||renderers.dashboard)()}catch(e){console.error('[BlueGate Admin render]',currentAdminTab,e);content.innerHTML=renderAdminMissing(currentAdminTab)}
  content.classList.add('admin-content-enter');
  requestAnimationFrame(()=>{content.querySelectorAll('.admin-card, .admin-item, .accordion-card, .no-variant-row').forEach((el,i)=>{el.style.setProperty('--stagger-i',Math.min(i,8));el.classList.add('stagger-in')})});
  setTimeout(()=>{if(currentAdminTab==='settings')initSettingsUi();attachLongPress()},0)
}
function renderAdminMore(){
  const locked=(feature,icon,title,desc,tab)=>hasLicenseFeature(feature)
    ? `<button class="admin-more-link" data-admin-tab="${tab}"><span>${icon}</span><div><b>${title}</b><small>${desc}</small></div></button>`
    : `<button class="admin-more-link pro-feature-tile locked" data-pro-feature="${feature}"><span>${icon}</span><div><b>${title} ${proBadge(feature)}</b><small>${desc}</small></div></button>`;
  return `<article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">•••</span><div><h3>ابزارهای بیشتر</h3><p class="muted">Free برای شروع؛ ابزارهای رشد و عملیات حرفه‌ای با Pro.</p></div></div><div class="admin-more-grid">
    <button class="admin-more-link" data-admin-tab="infrastructure"><span>🧩</span><div><b>زیرساخت سرویس</b><small>یک پنل در Free؛ چند پنل و اتوماسیون در Pro</small></div></button>
    <button class="admin-more-link" data-admin-tab="advanced"><span>🚀</span><div><b>امکانات پیشرفته</b><small>قابلیت‌های Free و مسیر ارتقا به Pro</small></div></button>
    ${locked('marketing_automation','🔔','کمپین و اعلان','Broadcast و اعلان هدفمند','notifications')}
    <button class="admin-more-link" data-admin-tab="customers"><span>👥</span><div><b>کاربران</b><small>Customer 360، سفارش‌ها و اعتبار</small></div></button>
    <button class="admin-more-link" data-admin-tab="support"><span>?</span><div><b>تیکت‌های پشتیبانی</b><small>پاسخ، تغییر وضعیت و پیگیری درخواست‌ها</small></div></button>
    <button class="admin-more-link" data-admin-tab="inventory"><span>□</span><div><b>انبار</b><small>آیتم‌های تحویل و موجودی</small></div></button>
    <button class="admin-more-link" data-admin-tab="coupons"><span>%</span><div><b>تخفیف‌ها</b><small>کد تخفیف پایه در Free</small></div></button>
    <button class="admin-more-link" data-admin-tab="settings"><span>⚙</span><div><b>تنظیمات</b><small>پرداخت، ظاهر پایه و فروشگاه</small></div></button>
    <button class="admin-more-link" data-admin-tab="activity"><span>≡</span><div><b>فعالیت</b><small>لاگ تغییرات مدیریتی</small></div></button>
    ${locked('team_roles','◎','تیم و نقش‌ها','چند ادمین و Staff permissions','roles')}
    <button class="admin-more-link" data-admin-tab="backups"><span>⇩</span><div><b>بکاپ</b><small>بکاپ محلی Free؛ Restore/Export در Pro</small></div></button>
  </div></article>
  <article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">◆</span><div><h3>رشد با BlueGate Pro</h3><p class="muted">قابلیت‌ها مخفی نشده‌اند؛ هر مورد قفل‌شده مسیر ارتقا را نشان می‌دهد.</p></div></div><div class="pro-feature-grid">
    ${['web_storefront','white_label','multi_provider','multi_location','routing','advanced_monitoring','automation','bulk_tools','advanced_analytics','integrations'].map(f=>{const m=proFeatureMeta(f);return `<button class="pro-feature-tile ${hasLicenseFeature(f)?'':'locked'}" ${hasLicenseFeature(f)?`data-pro-active="${f}"`:`data-pro-feature="${f}"`}><span>◆</span><div><b>${esc(m.title)} ${proBadge(f)}</b><small>${esc(m.desc)}</small></div></button>`}).join('')}
  </div></article>
  <article class="admin-card admin-maintenance-card"><div class="admin-card-head"><span class="admin-card-icon">⌁</span><div><h3>عملیات سریع</h3><p class="muted">ابزارهای پایه در Free؛ ارسال همگانی در Pro.</p></div></div><div class="dashboard-quick-actions"><button class="quick-action" ${hasLicenseFeature('marketing_automation')?'onclick="openBroadcast()"':'data-pro-feature="marketing_automation"'}><span>↗</span><b>پیام همگانی ${proBadge('marketing_automation')}</b></button><button class="quick-action" onclick="openPurchaseReward()"><span>★</span><b>پاداش خرید</b></button></div></article>`
}
async function openMiniAdminSupportTicket(id){
  try{
    const load=async()=>api('admin_support_ticket_messages',{ticket_id:Number(id)});
    const r=await load(),ticket={...((adminState.support_tickets||[]).find(x=>Number(x.id)===Number(id))||{}),...(r.ticket||{})};
    const statusLabels={open:'باز',waiting_admin:'در انتظار پاسخ ادمین',waiting_customer:'در انتظار کاربر',resolved:'حل‌شده',closed:'بسته'};
    const renderMessages=messages=>(messages||[]).map(m=>`<article class="support-bubble ${m.sender_type==='admin'?'mine':'theirs'}"><div class="support-bubble-meta"><b>${m.sender_type==='admin'?'مدیر':'کاربر'}</b><small>${esc(m.created_at||'')} ${m.sender_type==='admin'?`<span class="support-ticks ${m.read_at?'seen':''}">${m.read_at?'✓✓':m.delivered_at?'✓':'○'}</span>`:''}</small></div>${m.body?`<p>${esc(m.body)}</p>`:''}${supportAttachmentHtml(m)}</article>`).join('')||'<div class="u-empty support-ticket-empty"><div class="u-empty-icon">✉</div><h3>هنوز پیامی ثبت نشده</h3><p>برای شروع گفت‌وگو، پاسخ خود را ارسال کنید.</p></div>';
    const customerName=ticket.first_name||ticket.username||(ticket.telegram_id?String(ticket.telegram_id):'کاربر');
    BlueGateUI.openSheet({type:'fullscreen',eyebrow:'BLUEGATE SUPPORT · ADMIN',title:`#${ticket.id||id} ${esc(ticket.subject||'تیکت پشتیبانی')}`,subtitle:`${esc(customerName)} · ${esc(statusLabels[ticket.status]||miniSupportStatusLabel(ticket.status))}`,body:`<div class="mini-chat-shell admin-mini-chat">
      <header class="support-chat-head admin-support-chat-head"><div><span class="member-kicker">درخواست کاربر</span><b>${esc(customerName)}</b><small>${esc(ticket.username?'@'+ticket.username:ticket.telegram_id?'Telegram ID: '+ticket.telegram_id:'کاربر BlueGate')} · ${esc(ticket.created_at||'')}</small><span class="support-ticket-status ${miniSupportStatusClass(ticket.status)}">${esc(statusLabels[ticket.status]||miniSupportStatusLabel(ticket.status))}</span></div><button type="button" class="ghost support-chat-close" data-close-admin-ticket>بستن</button></header>
      <div class="support-chat-messages" id="miniAdminSupportMessages">${renderMessages(r.messages)}</div>
      <form class="support-chat-composer" id="miniAdminSupportComposer"><textarea name="message" rows="1" maxlength="4000" placeholder="پاسخ پشتیبانی را بنویس…" aria-label="متن پاسخ"></textarea><label class="attach-button" title="پیوست فایل">📎<input name="attachment" type="file" accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"></label><button class="primary" type="submit">ارسال پاسخ</button></form>
      <div class="support-status-actions admin-support-status-actions"><button type="button" class="ghost" data-mini-admin-status="open">بازگشایی</button><button type="button" class="ghost" data-mini-admin-status="waiting_customer">انتظار کاربر</button><button type="button" class="secondary" data-mini-admin-status="resolved">حل شد</button><button type="button" class="danger" data-mini-admin-status="closed">بستن تیکت</button></div>
    </div>`,onOpen:host=>{
      bindSupportPreview(host);
      host.querySelector('[data-close-admin-ticket]')?.addEventListener('click',()=>BlueGateUI.closeSheet?.());
      const form=host.querySelector('#miniAdminSupportComposer');
      form?.addEventListener('submit',async e=>{
        e.preventDefault();
        if(form.dataset.submitting==='1')return;
        const f=new FormData(form),msg=String(f.get('message')||'').trim(),file=f.get('attachment');
        if(!msg&&!file?.size)return;
        form.dataset.submitting='1';
        const submit=form.querySelector('[type="submit"]'),label=submit?.textContent||'ارسال پاسخ';
        if(submit){submit.disabled=true;submit.textContent='در حال ارسال…';}
        try{
          const a=await supportFilePayload(file);
          await api('admin_support_ticket_reply',{ticket_id:Number(id),message:msg,...a});
          form.reset();
          await openMiniAdminSupportTicket(id);
        }catch(err){
          delete form.dataset.submitting;
          if(submit){submit.disabled=false;submit.textContent=label;}
          showStatus(err.message||'ارسال پاسخ ناموفق بود','error');
        }
      });
      host.querySelectorAll('[data-mini-admin-status]').forEach(b=>b.addEventListener('click',async()=>{
        if(b.disabled)return;b.disabled=true;
        try{
          await api('admin_support_ticket_status',{ticket_id:Number(id),status:b.dataset.miniAdminStatus});
          showStatus('وضعیت تیکت بروزرسانی شد','success');
          window.clearInterval(window.__miniAdminTicketPoll);
          BlueGateUI.closeSheet?.();
          adminState=await api('admin_summary');renderAdmin();
        }catch(err){b.disabled=false;showStatus(err.message||'تغییر وضعیت ناموفق بود','error')}
      }));
      const box=host.querySelector('#miniAdminSupportMessages');if(box)box.scrollTop=box.scrollHeight;
    }});
    window.clearInterval(window.__miniAdminTicketPoll);
    window.__miniAdminTicketPoll=window.setInterval(async()=>{
      const box=document.querySelector('#miniAdminSupportMessages');
      if(!box){window.clearInterval(window.__miniAdminTicketPoll);return;}
      try{const x=await load();box.innerHTML=renderMessages(x.messages);bindSupportPreview(box);box.scrollTop=box.scrollHeight;}catch(_){}
    },5000);
  }catch(e){showStatus(e.message||'دریافت تیکت ناموفق بود','error')}
}
document.addEventListener('click',e=>{
  const target=e.target.closest?.('[data-admin-support-ticket]');
  if(!target)return;
  e.preventDefault();e.stopImmediatePropagation();
  openMiniAdminSupportTicket(Number(target.dataset.adminSupportTicket));
},true);
function renderAdminSupport(){
  const rows=adminState.support_tickets||[];
  const fa={open:'باز',waiting_admin:'در انتظار پاسخ شما',waiting_customer:'در انتظار کاربر',resolved:'حل‌شده',closed:'بسته'};
  const needsReply=rows.filter(x=>['open','waiting_admin'].includes(x.status)).length;
  const waitingCustomer=rows.filter(x=>x.status==='waiting_customer').length;
  const resolved=rows.filter(x=>['resolved','closed'].includes(x.status)).length;
  return `<section class="admin-support-page">
    <div class="admin-support-hero support-page-hero"><div class="support-page-intro"><span class="member-kicker">BLUEGATE SUPPORT</span><h2>تیکت‌های پشتیبانی</h2><p>درخواست‌های کاربران را بررسی کن، پاسخ بده و وضعیت هر گفت‌وگو را مدیریت کن.</p></div><div class="admin-support-hero-actions"><button class="secondary" data-admin-action="reload">↻ بروزرسانی</button></div></div>
    <div class="admin-support-stats">
      <article><span class="admin-support-stat-icon">✉</span><div><b>${nf(rows.length)}</b><small>کل تیکت‌ها</small></div></article>
      <article class="needs-reply"><span class="admin-support-stat-icon">◷</span><div><b>${nf(needsReply)}</b><small>نیازمند پاسخ</small></div></article>
      <article><span class="admin-support-stat-icon">↗</span><div><b>${nf(waitingCustomer)}</b><small>در انتظار کاربر</small></div></article>
      <article><span class="admin-support-stat-icon">✓</span><div><b>${nf(resolved)}</b><small>حل‌شده / بسته</small></div></article>
    </div>
    <div class="support-list-heading"><b>همه درخواست‌ها</b><span>${nf(rows.length)} تیکت</span></div>
    <div class="admin-support-list admin-support-list-modern">${rows.length?rows.map(t=>{const customer=t.first_name||t.username||(t.telegram_id?String(t.telegram_id):'کاربر');return `<button type="button" class="admin-support-card" data-admin-support-ticket="${Number(t.id)||0}"><span class="admin-support-avatar">#${esc(String(t.id||''))}</span><span class="admin-support-card-main"><span class="admin-support-card-title"><b>${esc(t.subject||'بدون موضوع')}</b><small>${esc(customer)}</small></span><span class="admin-support-card-meta"><span class="support-ticket-status ${miniSupportStatusClass(t.status)}">${esc(fa[t.status]||miniSupportStatusLabel(t.status))}</span><small>${esc(t.last_message_at||t.created_at||'بدون پیام')}</small></span></span><span class="admin-support-card-arrow" aria-hidden="true">‹</span></button>`;}).join(''):'<div class="u-empty support-ticket-empty"><div class="u-empty-icon">✉</div><h3>تیکتی ثبت نشده</h3><p>وقتی کاربری تیکت جدیدی ایجاد کند، درخواستش اینجا نمایش داده می‌شود.</p></div>'}</div>
  </section>`;
}
function infraPlanOptions(selected=''){const tree=adminState.catalog_admin?.tree||[];const out=[];for(const svc of tree)for(const g of (svc.groups||[]))for(const p of (g.plans||[]))out.push(`<option value="${p.id}" ${String(selected)===String(p.id)?'selected':''}>${esc(svc.name||'')} / ${esc(g.is_default?'پلن اصلی':g.name||'')} / ${esc(p.title||('پلن #'+p.id))}</option>`);return out.join('')}
function infraProviderOptions(selected=''){return (adminState.infrastructure?.providers||[]).filter(p=>Number(p.is_active??1)).map(p=>`<option value="${p.id}" ${String(selected)===String(p.id)?'selected':''}>${esc(p.name||('پنل #'+p.id))} · ${p.driver==='xui'?'3x-ui':p.driver==='marzban'?'Marzban':p.driver==='remnawave'?'Remnawave':esc(p.driver||'')}</option>`).join('')}
function openInfraProvider(id=0){const ps=adminState.infrastructure?.providers||[],p=ps.find(x=>Number(x.id)===Number(id))||{},drivers=adminState.infrastructure?.drivers||{},m=p.metadata||{};if(!p.id&&ps.length&&!hasLicenseFeature('unlimited_providers'))return showProUpgrade('unlimited_providers','اتصال پنل دوم');const driverOpts=Object.entries(drivers).filter(([,v])=>v?.live).map(([k,v])=>`<option value="${esc(k)}" ${String(p.driver||'xui')===k?'selected':''}>${k==='xui'?'3x-ui (Sanaei)':k==='marzban'?'Marzban':k==='remnawave'?'Remnawave':esc(v.label||k)}</option>`).join('');openEdit(p.id?'ویرایش پنل':'اتصال پنل جدید',[{title:'پنل و API',fields:[{id:'if_name',label:'نام پنل',value:p.name||'',placeholder:'مثلاً Germany Main'},{id:'if_driver',label:'نوع پنل',type:'select',options:driverOpts},{id:'if_base',label:'آدرس پنل',type:'url',value:p.base_url||'',placeholder:'https://panel.example.com'},{id:'if_auth',label:'روش ورود API',type:'select',options:`<option value="token" ${p.auth_type==='token'?'selected':''}>توکن API (پیشنهادی)</option><option value="legacy" ${['legacy','basic'].includes(p.auth_type)?'selected':''}>نام کاربری / رمز</option>`},{id:'if_token',label:'API Token',type:'password',placeholder:p.has_api_token?'برای حفظ توکن فعلی خالی بگذار':'API Token'},{id:'if_user',label:'نام کاربری Legacy',value:p.username||''},{id:'if_secret',label:'رمز عبور Legacy',type:'password',placeholder:p.has_secret?'برای حفظ رمز فعلی خالی بگذار':'Password'}]},{title:'تنظیمات اتصال',fields:[{id:'if_tls',label:'بررسی اعتبار SSL',type:'checkbox',value:m.verify_tls!==false},{id:'if_active',label:'پنل فعال باشد',type:'checkbox',value:Number(p.is_active??1)===1},{id:'if_sub_base',label:'Subscription Base URL',type:'url',value:m.subscription_base_url||'',placeholder:'اختیاری؛ https://sub.example.com'},{id:'if_sub_path',label:'Subscription Path',value:m.subscription_path||'/sub/{subId}'},{id:'if_priority',label:'اولویت',type:'number',value:p.priority??100,props:'min="0"'},{id:'if_weight',label:'وزن',type:'number',value:p.weight??100,props:'min="0"'},{id:'if_max',label:'حداکثر کاربر',type:'number',value:p.max_clients??'',props:'min="0"'}]}],async()=>{const driver=val('if_driver'),auth=driver==='remnawave'?'token':val('if_auth');const r=await api('admin_provider_save',{provider_id:Number(p.id||0),name:val('if_name'),driver,base_url:val('if_base'),auth_type:auth,api_token:val('if_token'),username:auth==='legacy'?val('if_user'):'',secret:auth==='legacy'?val('if_secret'):'',verify_tls:document.getElementById('if_tls')?.checked?1:0,is_active:document.getElementById('if_active')?.checked?1:0,subscription_base_url:val('if_sub_base'),subscription_path:val('if_sub_path'),priority:val('if_priority'),weight:val('if_weight'),max_clients:val('if_max')});adminState=await api('admin_summary');renderAdmin();showStatus(r.message||'پنل ذخیره شد','success')});setTimeout(()=>{const d=document.getElementById('if_driver'),a=document.getElementById('if_auth'),u=document.getElementById('if_user'),pw=document.getElementById('if_secret'),tk=document.getElementById('if_token');const sync=()=>{const rem=d?.value==='remnawave';if(rem&&a)a.value='token';if(a)a.disabled=rem;const legacy=!rem&&a?.value==='legacy';[u,pw].forEach(el=>{const wrap=el?.closest('.edit-field,.field,.form-field')||el?.parentElement;if(wrap)wrap.style.display=legacy?'':'none'});const tw=tk?.closest('.edit-field,.field,.form-field')||tk?.parentElement;if(tw)tw.style.display=legacy?'none':'';if(rem&&tk)tk.placeholder=p.has_api_token?'برای حفظ توکن فعلی خالی بگذار':'Remnawave API Token (الزامی)'};d?.addEventListener('change',sync);a?.addEventListener('change',sync);sync()},0)}
async function openInfraInbounds(id){const p=(adminState.infrastructure?.providers||[]).find(x=>Number(x.id)===Number(id));if(!p)return;try{const r=await api('admin_provider_inbounds',{provider_id:Number(id)}),rows=r.inbounds||[];const body=`<div class="infra-target-list">${rows.map(x=>`<article><div><b>${esc(x.remark||x.name||('مقصد #'+x.id))}</b><small>${esc(x.protocol||'')} ${x.port?`· پورت ${nf(x.port)}`:''} ${x.client_count!==undefined?`· ${nf(x.client_count)} کاربر`:''}</small></div><span class="chip-mini ${x.enable===false?'chip-off':'chip-active'}">${x.enable===false?'خاموش':'فعال'}</span></article>`).join('')||'<div class="u-empty"><h3>مقصدی پیدا نشد</h3></div>'}</div>`;BlueGateUI.openSheet({type:'info',eyebrow:p.driver==='remnawave'?'INTERNAL SQUADS':'INBOUNDS',title:p.name||'پنل',body,footer:`<button type="button" class="secondary" data-pro-close>بستن</button>`,onOpen:(h)=>h.querySelector('[data-pro-close]')?.addEventListener('click',()=>BlueGateUI.closeSheet?.())})}catch(e){showStatus(e.message||'دریافت مقصدها ناموفق بود','error')}}
function openInfraClientTools(id){const p=(adminState.infrastructure?.providers||[]).find(x=>Number(x.id)===Number(id));if(!p)return;const body=`<div class="infra-client-tools"><button data-infra-client-action="lookup" data-provider-id="${p.id}"><span>🔎</span><div><b>مشاهده Client</b><small>مصرف، وضعیت و لینک Subscription</small></div></button><button data-infra-client-action="create" data-provider-id="${p.id}"><span>＋</span><div><b>ساخت دستی Client</b><small>ساخت روی پنل برای تست یا پشتیبانی</small></div></button><button data-infra-client-action="update" data-provider-id="${p.id}"><span>✏️</span><div><b>ویرایش / تعلیق</b><small>حجم، انقضا و وضعیت Client</small></div></button><button data-infra-client-action="delete" data-provider-id="${p.id}"><span>🗑</span><div><b>حذف Client</b><small>حذف از پنل متصل</small></div></button></div>`;BlueGateUI.openSheet({type:'info',eyebrow:'CLIENT TOOLS',title:p.name||'مدیریت Client',body,footer:`<button type="button" class="secondary" data-pro-close>بستن</button>`,onOpen:(h)=>h.querySelector('[data-pro-close]')?.addEventListener('click',()=>BlueGateUI.closeSheet?.())})}
function openInfraClientAction(action,id){BlueGateUI.closeSheet?.();const p=(adminState.infrastructure?.providers||[]).find(x=>Number(x.id)===Number(id));if(!p)return;if(action==='lookup')return openEdit('مشاهده Client',[{title:p.name||'پنل',fields:[{id:'ic_external',label:'ایمیل / شناسه Client'},{id:'ic_sub',label:'Sub ID',placeholder:'اختیاری'}]}],async()=>{const r=await api('admin_provider_client_get',{provider_id:id,external_id:val('ic_external'),sub_id:val('ic_sub')});showInfraClientResult(r)});if(action==='create')return openEdit('ساخت دستی Client',[{title:p.name||'پنل',fields:[{id:'ic_email',label:'ایمیل / نام Client'},{id:'ic_inbounds',label:'Inbound IDها',placeholder:'1,2,3'},{id:'ic_bytes',label:'حجم به بایت',type:'number',value:0,props:'min="0"'},{id:'ic_exp',label:'تاریخ انقضا',placeholder:'2030-01-01 00:00:00'},{id:'ic_ip',label:'محدودیت IP',type:'number',value:0,props:'min="0"'}]}],async()=>{const r=await api('admin_provider_client_create',{provider_id:id,email:val('ic_email'),inbound_ids:val('ic_inbounds'),traffic_limit_bytes:val('ic_bytes'),expires_at:val('ic_exp'),limit_ip:val('ic_ip')});showInfraClientResult(r);adminState=await api('admin_summary');renderAdmin()});if(action==='update')return openEdit('ویرایش / تعلیق Client',[{title:p.name||'پنل',fields:[{id:'ic_external',label:'ایمیل / شناسه Client'},{id:'ic_uuid',label:'UUID Client',placeholder:'اختیاری'},{id:'ic_inbounds',label:'Inbound IDها',placeholder:'1,2,3'},{id:'ic_bytes',label:'حجم به بایت',type:'number',placeholder:'خالی = بدون تغییر'},{id:'ic_exp',label:'تاریخ انقضا',placeholder:'خالی = بدون تغییر'},{id:'ic_enable',label:'وضعیت',type:'select',options:'<option value="1">فعال</option><option value="0">تعلیق</option>'}]}],async()=>{const r=await api('admin_provider_client_update',{provider_id:id,external_id:val('ic_external'),external_client_id:val('ic_uuid'),inbound_ids:val('ic_inbounds'),traffic_limit_bytes:val('ic_bytes'),expires_at:val('ic_exp'),enable:val('ic_enable')});showInfraClientResult(r)});if(action==='delete')return openEdit('حذف Client',[{title:p.name||'پنل',fields:[{id:'ic_external',label:'ایمیل / شناسه Client'}]}],async()=>{if(!await BlueGateUI.confirm({title:'حذف Client',message:'Client واقعاً از پنل حذف شود؟',confirmText:'حذف',danger:true}))return;const r=await api('admin_provider_client_delete',{provider_id:id,external_id:val('ic_external')});showStatus(r.message||'Client حذف شد','success')})}
function showInfraClientResult(r){closeEdit();const sub=r?.subscription||r?.result?.subscription||{},usage=r?.usage||{},client=r?.client||r?.result||{};const body=`<div class="infra-client-result"><div><small>Client</small><b>${esc(client.external_username||client.email||client.external_client_id||'—')}</b></div><div><small>مصرف</small><b>${nf(usage.used_bytes||0)} / ${usage.total_bytes==null?'∞':nf(usage.total_bytes)}</b></div><div><small>Subscription</small><code>${esc(sub.url||sub.primary_link||'—')}</code></div><details><summary>جزئیات فنی</summary><pre>${esc(JSON.stringify(r,null,2))}</pre></details></div>`;BlueGateUI.openSheet({type:'info',eyebrow:'CLIENT RESULT',title:'نتیجه عملیات',body,footer:`<button type="button" class="secondary" data-pro-close>بستن</button>`,onOpen:(h)=>h.querySelector('[data-pro-close]')?.addEventListener('click',()=>BlueGateUI.closeSheet?.())})}
function openAdminMonitoringSettings(){if(!requireProFeature('advanced_monitoring','تنظیمات مانیتورینگ پیشرفته'))return;const m=adminState.monitoring?.settings||{};openEdit('مانیتورینگ و اتوماسیون',[{title:'سلامت سرویس‌ها و پنل‌ها',fields:[{id:'ams_sync',label:'همگام‌سازی مصرف سرویس‌ها',type:'checkbox',value:Number(m.service_sync_enabled??1)===1},{id:'ams_health',label:'بررسی سلامت پنل‌ها',type:'checkbox',value:Number(m.provider_health_enabled??1)===1},{id:'ams_suspend',label:'تعلیق خودکار منقضی‌ها',type:'checkbox',value:Number(m.expire_suspend_enabled??1)===1},{id:'ams_tg',label:'هشدار تلگرام',type:'checkbox',value:Number(m.telegram_alerts_enabled??1)===1},{id:'ams_usage',label:'آستانه مصرف (%)',value:m.usage_thresholds||'80,90,100'},{id:'ams_days',label:'هشدار روزهای باقی‌مانده',value:m.expiry_days||'3,1,0'},{id:'ams_latency',label:'Latency ناپایداری (ms)',type:'number',value:m.provider_degraded_latency_ms||2000},{id:'ams_batch',label:'Batch size',type:'number',value:m.service_batch_size||100}]}],async()=>adminAction('admin_monitoring_settings',{service_sync_enabled:document.getElementById('ams_sync')?.checked?1:0,provider_health_enabled:document.getElementById('ams_health')?.checked?1:0,expire_suspend_enabled:document.getElementById('ams_suspend')?.checked?1:0,telegram_alerts_enabled:document.getElementById('ams_tg')?.checked?1:0,usage_thresholds:val('ams_usage'),expiry_days:val('ams_days'),provider_degraded_latency_ms:val('ams_latency'),service_batch_size:val('ams_batch')}))}
async function infraTargets(providerId,selected=[],map={}){const p=(adminState.infrastructure?.providers||[]).find(x=>Number(x.id)===Number(providerId));if(!p)return {html:'<p class="muted">پنل پیدا نشد.</p>',rows:[]};const r=await api('admin_provider_inbounds',{provider_id:Number(providerId)}),rows=r.inbounds||[],chosen=new Set((selected||[]).map(String));let html='';if(p.driver==='marzban'){html=`<div class="pro-hint-box">Marzban کاربر را با API رسمی می‌سازد. برای تنظیم تخصصی می‌توانی Proxies / Inbounds JSON را وارد کنی.</div>`}else html=`<div class="infra-check-grid">${rows.map(x=>`<label class="infra-check ${x.enable===false?'is-disabled':''}"><input type="checkbox" data-infra-target value="${esc(x.id)}" ${chosen.has(String(x.id))?'checked':''} ${x.enable===false?'disabled':''}><span><b>${esc(x.remark||x.name||('مقصد #'+x.id))}</b><small>${esc(x.protocol||'')} ${x.port?`· ${nf(x.port)}`:''}</small></span></label>`).join('')||'<p class="muted">مقصد فعالی پیدا نشد.</p>'}</div>`;return {html,rows,p}}
async function openInfraMap(id=0){const maps=adminState.service_plan_provider_maps||[],m=maps.find(x=>Number(x.id)===Number(id))||{},ps=(adminState.infrastructure?.providers||[]).filter(p=>Number(p.is_active??1));if(!infraPlanOptions())return showStatus('اول حداقل یک پلن فروش بساز','error');if(!ps.length)return showStatus('اول یک پنل در زیرساخت اضافه کن','error');const cfg=m.config||{},providerId=Number(m.provider_id||ps[0].id),selected=Array.isArray(cfg.inbound_ids)?cfg.inbound_ids.map(String):String(cfg.inbound_ids||m.remote_target_id||'').split(',').map(x=>x.trim()).filter(Boolean);let targetHtml='<p class="muted">در حال دریافت مقصدها…</p>';try{targetHtml=(await infraTargets(providerId,selected,m)).html}catch(e){targetHtml=`<p class="muted">${esc(e.message||'دریافت مقصدها ناموفق بود')}</p>`}const trafficGb=Number(cfg.traffic_limit_bytes||0)/1073741824;openEdit(m.id?'ویرایش اتصال پلن':'اتصال پلن به پنل',[{title:'پلن و پنل',fields:[{id:'im_plan',label:'پلن فروش',type:'select',options:infraPlanOptions(m.service_plan_id)},{id:'im_provider',label:'پنل سرویس',type:'select',options:infraProviderOptions(providerId)},{html:`<div class="full"><div class="presentation-section-title">مقصد سرویس</div><div id="im_targets">${targetHtml}</div></div>`},{id:'im_remote',label:'Remote Target ID',value:m.remote_target_id||'',placeholder:'برای Marzban می‌تواند AUTO باشد'},{id:'im_inbound_ids',label:'Inbound IDها',value:selected.join(','),placeholder:'با انتخاب مقصدها خودکار پر می‌شود'}]},{title:'محدودیت‌های پلن',fields:[{id:'im_gb',label:'حجم (GB)',type:'number',value:trafficGb?Number(trafficGb.toFixed(3)):'',props:'min="0" step="0.1"'},{id:'im_days',label:'مدت (روز)',type:'number',value:cfg.duration_days||'',props:'min="0"'},{id:'im_ip',label:'محدودیت IP همزمان',type:'number',value:cfg.limit_ip??0,props:'min="0"'},{id:'im_proxies',label:'Marzban Proxies JSON',value:cfg.proxies?JSON.stringify(cfg.proxies):'',placeholder:'اختیاری'},{id:'im_inbounds_json',label:'Marzban Inbounds JSON',value:cfg.inbounds?JSON.stringify(cfg.inbounds):'',placeholder:'اختیاری'},{id:'im_active',label:'این اتصال فعال باشد',type:'checkbox',value:m.id?Number(m.is_active)===1:true}]}],async()=>{const targets=[...document.querySelectorAll('#im_targets [data-infra-target]:checked')].map(x=>String(x.value));const provider=(adminState.infrastructure?.providers||[]).find(x=>Number(x.id)===Number(val('im_provider')));const remote=targets[0]||val('im_remote')||(provider?.driver==='marzban'?'AUTO':'');await api('admin_plan_provider_map_save',{map_id:Number(m.id||0),service_plan_id:Number(val('im_plan')),provider_id:Number(val('im_provider')),remote_target_id:remote,inbound_ids:targets.length?targets.join(','):val('im_inbound_ids'),traffic_gb:val('im_gb'),duration_days:val('im_days'),limit_ip:val('im_ip'),proxies_json:val('im_proxies'),inbounds_json:val('im_inbounds_json'),is_active:document.getElementById('im_active')?.checked?1:0});adminState=await api('admin_summary');renderAdmin();showStatus('اتصال پلن ذخیره شد','success')});setTimeout(()=>{const sel=document.getElementById('im_provider');sel?.addEventListener('change',async()=>{const box=document.getElementById('im_targets');if(!box)return;box.innerHTML='<p class="muted">در حال دریافت مقصدها…</p>';try{box.innerHTML=(await infraTargets(Number(sel.value),[],{})).html}catch(e){box.innerHTML=`<p class="muted">${esc(e.message||'خطا')}</p>`}});document.getElementById('im_targets')?.addEventListener('change',()=>{const vals=[...document.querySelectorAll('#im_targets [data-infra-target]:checked')].map(x=>String(x.value));const inp=document.getElementById('im_inbound_ids'),rem=document.getElementById('im_remote');if(inp)inp.value=vals.join(',');if(rem&&vals[0])rem.value=vals[0]})},0)}
function renderAdminInfrastructure(){
  const I=adminState.infrastructure||{},c=I.counts||{},ps=I.providers||[],maps=adminState.service_plan_provider_maps||[],jobs=adminState.provisioning_jobs||[],mon=adminState.monitoring||{},routing=adminState.routing||{};
  const multiLocked=ps.length>=1&&!hasLicenseFeature('unlimited_providers');
  return `<article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">🧩</span><div><h3>زیرساخت سرویس</h3><p class="muted">پنل‌ها، اتصال پلن‌ها و وضعیت خودکار سرویس‌ها</p></div><button class="primary" data-infra-add>+ اتصال پنل</button></div>${multiLocked?`<div class="pro-inline-alert"><b>نسخه Free: یک پنل</b><span>برای اتصال چند پنل و Multi-provider به Pro ارتقا بده.</span><button data-pro-feature="unlimited_providers">مشاهده Pro</button></div>`:''}<div class="dashboard-quick-stats"><div class="dq-stat"><b>${nf(c.providers||0)}</b><span>پنل</span></div><div class="dq-stat"><b>${nf(c.online||0)}</b><span>آنلاین</span></div><div class="dq-stat"><b>${nf(c.services||0)}</b><span>سرویس</span></div><div class="dq-stat"><b>${nf(c.queued_jobs||0)}</b><span>در صف</span></div></div><div class="dashboard-quick-actions"><button class="quick-action" data-infra-refresh><span>↻</span><b>بروزرسانی</b></button><button class="quick-action" data-infra-run-monitor><span>♥</span><b>بررسی سلامت</b></button><button class="quick-action" data-infra-run-queue><span>⚙</span><b>اجرای صف</b></button></div></article>
  <article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">🌐</span><div><h3>پنل‌های متصل</h3><p class="muted">3x-ui، Marzban و Remnawave</p></div></div>${ps.length?ps.map(p=>{const st=String(p.last_health_status||p.status||'unknown').toLowerCase();return `<div class="infra-provider-card"><div class="infra-provider-main"><span class="infra-provider-icon">${p.driver==='xui'?'⚡':p.driver==='marzban'?'🟦':p.driver==='remnawave'?'🌊':'🔌'}</span><div><b>${esc(p.name||('پنل #'+p.id))}</b><small>${p.driver==='xui'?'3x-ui (Sanaei)':p.driver==='marzban'?'Marzban':p.driver==='remnawave'?'Remnawave':esc(p.driver||'')} · ${['online','healthy'].includes(st)?'آنلاین':st==='offline'?'آفلاین':st==='degraded'?'ناپایدار':'تست نشده'}</small><em>${esc(p.base_url||'')}</em></div></div><div class="infra-provider-actions"><button class="secondary" data-infra-test="${p.id}">تست</button><button class="secondary" data-infra-inbounds="${p.id}">${p.driver==='remnawave'?'Squadها':'Inboundها'}</button><button class="secondary" data-infra-clients="${p.id}">Clientها</button><button class="secondary" data-infra-edit="${p.id}">ویرایش</button><button class="secondary" data-infra-toggle="${p.id}" data-active="${Number(p.is_active||0)}">${Number(p.is_active)?'غیرفعال':'فعال'}</button></div></div>`}).join(''):'<div class="u-empty"><h3>هنوز پنلی وصل نشده</h3><p>نسخه Free یک پنل کامل را پشتیبانی می‌کند.</p><button class="primary" data-infra-add>اتصال اولین پنل</button></div>'}</article>
  <article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">🧭</span><div><h3>اتصال پلن‌ها</h3><p class="muted">هر پلن فروش را به Inbound / مقصد پنل وصل کن</p></div><button class="primary" data-infra-map-add>+ اتصال جدید</button></div>${maps.map(m=>{const ids=Array.isArray(m.config?.inbound_ids)?m.config.inbound_ids:[];const gb=Number(m.config?.traffic_limit_bytes||0)/1073741824;return `<div class="admin-list-row"><div><b>${esc(m.plan_title||('پلن #'+m.service_plan_id))}</b><small>${esc(m.provider_name||'پنل')} · ${ids.length?nf(ids.length)+' Inbound':'مقصد '+esc(m.remote_target_id||'—')} · ${gb?gb.toFixed(gb%1?1:0)+' GB':'بدون سقف'} · ${Number(m.config?.duration_days||0)?nf(m.config.duration_days)+' روز':'بدون محدودیت'} · IP ${Number(m.config?.limit_ip||0)?nf(m.config.limit_ip):'∞'}</small></div><div><button class="secondary" data-infra-map-edit="${m.id}">ویرایش</button><button class="secondary danger-soft" data-infra-map-delete="${m.id}">حذف</button></div></div>`}).join('')||'<p class="muted">هنوز پلنی به پنل متصل نشده.</p>'}</article>
  <article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">⚙</span><div><h3>صف ساخت و تمدید</h3><p class="muted">آخرین عملیات خودکار</p></div></div>${jobs.slice(0,15).map(j=>`<div class="admin-list-row"><div><b>#${nf(j.id)} · سفارش #${nf(j.order_id||0)}</b><small>${esc(j.provider_name||'پنل')} · ${j.status==='completed'?'کامل':j.status==='failed'?'ناموفق':'در انتظار'} · تلاش ${nf(j.attempt_count||0)}/${nf(j.max_attempts||0)}</small></div>${j.status!=='completed'?`<button class="secondary" data-infra-retry="${j.id}">تلاش دوباره</button>`:''}</div>`).join('')||'<p class="muted">صف خالی است.</p>'}</article>
  <article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">🚨</span><div><h3>سلامت و مسیریابی</h3><p class="muted">${nf(mon.stats?.open_incidents||0)} مشکل باز · ${nf(routing.stats?.open_circuits||0)} Circuit باز</p></div></div><div class="pro-feature-grid"><button class="pro-feature-tile ${hasLicenseFeature('advanced_monitoring')?'':'locked'}" ${hasLicenseFeature('advanced_monitoring')?'data-infra-monitor-settings':'data-pro-feature="advanced_monitoring"'}><span>♥</span><div><b>مانیتورینگ پیشرفته ${proBadge('advanced_monitoring')}</b><small>Health، Sync و هشدار</small></div></button><button class="pro-feature-tile ${hasLicenseFeature('routing')?'':'locked'}" ${hasLicenseFeature('routing')?'data-adv-routing':'data-pro-feature="routing"'}><span>🧭</span><div><b>Routing / Failover ${proBadge('routing')}</b><small>مسیریابی و Circuit Breaker</small></div></button></div></article>`;
}
function renderAdminAdvanced(){
  const A=adminState.advanced||{},pa=A.provider_analytics||[],mon=adminState.monitoring||{},routing=adminState.routing||{},inc=mon.open_incidents||[],runs=mon.recent_runs||[],decisions=routing.recent_decisions||[];
  const featureCards=[
    ['🧪','تست رایگان','پلن، حجم و زمان آزمایشی','data-adv-trial',''],
    ['➕','تمدید سراسری','حجم و روز اضافه برای همه پلن‌ها','data-adv-addons',''],
    ['♥','مانیتورینگ','Health check و Sync سرویس',hasLicenseFeature('advanced_monitoring')?'data-adv-monitor':'data-pro-feature="advanced_monitoring"','advanced_monitoring'],
    ['🧭','Failover','Routing و Circuit Breaker',hasLicenseFeature('routing')?'data-adv-routing':'data-pro-feature="routing"','routing'],
    ['🌐','فروشگاه وب','دامنه مستقل، ورود وب و داشبورد مشتری',hasLicenseFeature('web_storefront')?'data-pro-active="web_storefront"':'data-pro-feature="web_storefront"','web_storefront'],
    ['◈','White-label','حذف برند BlueGate و برندینگ کامل',hasLicenseFeature('white_label')?'data-pro-active="white_label"':'data-pro-feature="white_label"','white_label'],
    ['🗺','Multi-location','یک سرویس روی چند مقصد و لوکیشن',hasLicenseFeature('multi_location')?'data-pro-active="multi_location"':'data-pro-feature="multi_location"','multi_location'],
    ['⇄','ابزارهای گروهی','Migration و عملیات Bulk',hasLicenseFeature('bulk_tools')?'data-pro-active="bulk_tools"':'data-pro-feature="bulk_tools"','bulk_tools']
  ];
  return `<article class="admin-card adv-clean-hero"><div class="admin-card-head"><span class="admin-card-icon">🚀</span><div><h3>امکانات پیشرفته</h3><p class="muted">هر قابلیت در یک کارت مشخص؛ جزئیات فنی فقط وقتی لازم باشد باز می‌شود.</p></div></div><div class="adv-feature-grid">${featureCards.map(([icon,title,desc,attr,feature])=>`<button class="adv-feature-card ${feature&&!hasLicenseFeature(feature)?'locked':''}" ${attr}><span>${icon}</span><div><b>${title} ${feature?proBadge(feature):''}</b><small>${desc}</small></div></button>`).join('')}</div><div class="dashboard-quick-stats"><div class="dq-stat"><b>${nf(A.trials_active||0)}</b><span>تست فعال</span></div><div class="dq-stat"><b>${nf(mon.stats?.open_incidents||0)}</b><span>Incident باز</span></div><div class="dq-stat"><b>${nf(pa.length)}</b><span>پنل</span></div><div class="dq-stat"><b>${nf(routing.stats?.open_circuits||0)}</b><span>Circuit باز</span></div></div></article>
  ${pa.length?`<article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">📈</span><div><h3>ظرفیت و هزینه Providerها ${proBadge('automation')}</h3><p class="muted">تنظیمات عملیاتی هر پنل</p></div></div>${!hasLicenseFeature('automation')?`<div class="pro-inline-alert"><b>قابلیت Pro</b><span>اقتصاد Provider، ظرفیت و Maintenance در نسخه Pro فعال می‌شود.</span><button data-pro-feature="automation">مشاهده Pro</button></div>`:''}${pa.map(p=>`<div class="admin-list-row"><div><b>${esc(p.name||'پنل')}</b><small>${p.driver==='xui'?'3x-ui':esc(p.driver||'')} · ${nf(p.active_services||0)} سرویس · ${(Number(p.traffic_used_bytes||0)/1073741824).toFixed(1)} GB</small></div><button class="secondary" ${hasLicenseFeature('automation')?`data-adv-economics="${p.id}"`:'data-pro-feature="automation"'}>تنظیم</button></div>`).join('')}</article>`:''}
  <article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">🚨</span><div><h3>وضعیت اتوماسیون</h3><p class="muted">آخرین رخدادهای مهم</p></div></div><div class="adv-status-summary"><div><b>${inc.length?nf(inc.length):'✓'}</b><span>${inc.length?'Incident باز':'بدون Incident باز'}</span></div><div><b>${runs[0]?esc(runs[0].status||'—'):'—'}</b><span>آخرین Monitoring</span></div><div><b>${decisions.length?nf(decisions.length):'0'}</b><span>Routing اخیر</span></div></div>${inc.slice(0,5).map(x=>`<div class="admin-list-row"><div><b>${esc(x.provider_name||'Provider')}</b><small>${esc(x.message||x.title||'')}</small></div><span>${esc(x.opened_at||'')}</span></div>`).join('')}</article>`;
}
function openAdminAdvancedAddons(){const a=adminState.service_addons||{};openEdit('تمدید و افزونه سراسری',[{title:'برای همه پلن‌ها',fields:[{id:'adv_agb',label:'قیمت هر GB اضافه',type:'number',value:a.traffic_price_per_gb||0},{id:'adv_aday',label:'قیمت هر روز اضافه',type:'number',value:a.day_price||0},{id:'adv_mingb',label:'حداقل GB',type:'number',value:a.min_gb||1},{id:'adv_maxgb',label:'حداکثر GB',type:'number',value:a.max_gb||500},{id:'adv_minday',label:'حداقل روز',type:'number',value:a.min_days||1},{id:'adv_maxday',label:'حداکثر روز',type:'number',value:a.max_days||365}]}],async()=>adminAction('admin_service_addons_global',{traffic_price_per_gb:val('adv_agb'),day_price:val('adv_aday'),min_gb:val('adv_mingb'),max_gb:val('adv_maxgb'),min_days:val('adv_minday'),max_days:val('adv_maxday')}))}
function advancedPlanOptions(selected){const tree=adminState.catalog_admin?.tree||[];let out='<option value="">انتخاب پلن</option>';for(const sv of tree)for(const g of (sv.groups||[]))for(const p of (g.plans||[]))out+=`<option value="${p.id}" ${String(selected||'')===String(p.id)?'selected':''}>${esc(sv.name||'')} / ${esc(g.name||'')} / ${esc(p.title||'')}</option>`;return out}
function openAdminAdvancedTrial(){const a=adminState.advanced?.trial||{};openEdit('تنظیم تست رایگان',[{title:'Trial',fields:[{id:'adv_trial_on',label:'فعال (1/0)',type:'number',value:Number(a.enabled||0)},{id:'adv_trial_plan',label:'پلن تست',type:'select',options:advancedPlanOptions(a.service_plan_id)},{id:'adv_trial_gb',label:'حجم تست (GB)',type:'number',value:(Number(a.traffic_limit_bytes||1073741824)/1073741824).toFixed(2)},{id:'adv_trial_min',label:'مدت تست (دقیقه)',type:'number',value:a.duration_minutes||120},{id:'adv_trial_max',label:'حداکثر دفعات هر کاربر',type:'number',value:a.max_per_user||1},{id:'adv_trial_cd',label:'Cooldown (روز)',type:'number',value:a.cooldown_days||30}]}],async()=>adminAction('admin_trial_settings',{enabled:Number(val('adv_trial_on'))?1:0,service_plan_id:val('adv_trial_plan'),traffic_limit_bytes:Math.round(Number(val('adv_trial_gb')||0)*1073741824),duration_minutes:val('adv_trial_min'),max_per_user:val('adv_trial_max'),cooldown_days:val('adv_trial_cd')}))}
function openAdminAdvancedEconomics(id){const p=(adminState.advanced?.provider_analytics||[]).find(x=>Number(x.id)===Number(id))||{};openEdit('اقتصاد و ظرفیت پنل',[{title:p.name||'Provider',fields:[{id:'adv_cost',label:'هزینه ماهانه',type:'number',value:p.monthly_cost||0},{id:'adv_cur',label:'واحد هزینه',value:p.cost_currency||'USD'},{id:'adv_bw',label:'هزینه هر GB',type:'number',value:p.bandwidth_cost_per_gb||0},{id:'adv_maint',label:'حالت تعمیرات (1/0)',type:'number',value:Number(p.maintenance_mode||0)},{id:'adv_msg',label:'پیام تعمیرات',type:'textarea',value:p.maintenance_message||''},{id:'adv_cap',label:'آستانه ظرفیت نرم (%)',type:'number',value:p.soft_capacity_percent||90}]}],async()=>adminAction('admin_provider_economics',{provider_id:id,monthly_cost:val('adv_cost'),cost_currency:val('adv_cur'),bandwidth_cost_per_gb:val('adv_bw'),maintenance_mode:Number(val('adv_maint'))?1:0,maintenance_message:val('adv_msg'),soft_capacity_percent:val('adv_cap')}))}
function openAdminAdvancedRouting(){const r=adminState.routing?.settings||{};openEdit('تنظیم Failover',[{title:'Routing',fields:[{id:'adv_strategy',label:'Strategy',type:'select',options:`<option value="priority_weighted" ${r.strategy==='priority_weighted'?'selected':''}>اولویت + وزن</option><option value="priority" ${r.strategy==='priority'?'selected':''}>اولویت</option><option value="weighted" ${r.strategy==='weighted'?'selected':''}>وزن</option><option value="capacity" ${r.strategy==='capacity'?'selected':''}>ظرفیت</option>`},{id:'adv_reserve',label:'ظرفیت رزرو',type:'number',value:r.capacity_reserve||0},{id:'adv_fail',label:'خطا تا بازشدن Circuit',type:'number',value:r.circuit_failure_threshold||3},{id:'adv_open',label:'مدت Circuit (ثانیه)',type:'number',value:r.circuit_open_seconds||300},{id:'adv_degraded',label:'اجازه Provider ناپایدار (1/0)',type:'number',value:Number(r.allow_degraded??1)}]}],async()=>adminAction('admin_routing_settings',{strategy:val('adv_strategy'),capacity_reserve:val('adv_reserve'),circuit_failure_threshold:val('adv_fail'),circuit_open_seconds:val('adv_open'),allow_degraded:Number(val('adv_degraded'))?1:0}))}

/* Telegram Stars stats card (admin dashboard, v5.0.15) */
let starsStats=null,starsStatsLoading=false,starsStatsAt=0,starsStatsFailed=false;
function starsStatsCardHtml(){
  const d=starsStats,b=d&&d.balance;
  if(!starsStatsLoading&&Date.now()-starsStatsAt>=60000)setTimeout(()=>loadStarsStats(),0);
  const bal=b&&b.available?nf(b.amount):'—';
  const note=!d?'':(b&&b.available?(b.stale?' · موجودی بات قدیمی است':''):' · موجودی بات در دسترس نیست');
  const body=d?`<div class="dashboard-quick-stats"><div class="dq-stat"><b>${bal}</b><span>موجودی بات ⭐</span></div><div class="dq-stat"><b>${nf(d.total&&d.total.stars)}</b><span>کل خرید با Stars</span></div><div class="dq-stat"><b>${nf(d.d30&&d.d30.stars)}</b><span>۳۰ روز اخیر</span></div><div class="dq-stat"><b>${nf(d.today&&d.today.stars)}</b><span>امروز</span></div></div><p class="muted">${nf(d.total&&d.total.count)} پرداخت · سفارش‌ها: ${nf(d.total&&d.total.orders_stars)} ⭐ · شارژ کیف پول: ${nf(d.total&&d.total.topups_stars)} ⭐ · ۷ روز اخیر: ${nf(d.d7&&d.d7.stars)} ⭐${note}</p>`:`<p class="muted empty-state">${starsStatsFailed?'دریافت آمار Stars ممکن نشد.':'در حال دریافت…'}</p>`;
  return `<article class="admin-card stars-stats-card" id="starsStatsCard"><div class="admin-card-head"><span class="admin-card-icon">⭐</span><div><h3>Telegram Stars</h3><p class="muted">موجودی بات و مجموع خریدهای Stars</p></div><button class="secondary" data-stars-refresh="1" ${starsStatsLoading?'disabled':''}>${starsStatsLoading?'…':'بروزرسانی'}</button></div>${body}</article>`;
}
function refreshStarsStatsCard(){const el=$('starsStatsCard');if(el)el.outerHTML=starsStatsCardHtml()}
async function loadStarsStats(force=false){
  if(starsStatsLoading||!isAdminMode)return;
  if(!force&&Date.now()-starsStatsAt<60000)return;
  starsStatsLoading=true;refreshStarsStatsCard();
  try{starsStats=await api('admin_stars_stats',force?{refresh:1}:{});starsStatsFailed=false}
  catch(e){starsStatsFailed=!starsStats;if(force)showStatus(e.message||'دریافت آمار Stars ممکن نشد','error')}
  starsStatsAt=Date.now();starsStatsLoading=false;refreshStarsStatsCard();
}
if(!window.__bgStarsBound){window.__bgStarsBound=true;document.addEventListener('click',e=>{const t=e.target&&e.target.closest?e.target.closest('[data-stars-refresh]'):null;if(t){e.preventDefault();loadStarsStats(true)}})}
function renderAdminDashboard(){const I=adminState.infrastructure||{},ps=I.providers||[],maps=adminState.service_plan_provider_maps||[],healthy=ps.filter(p=>['online','healthy'].includes(String(p.last_health_status||'').toLowerCase())).length,setupItems=[['پنل سرویس',ps.length>0,'infrastructure'],['اتصال سالم',healthy>0,'infrastructure'],['مپ پلن',maps.length>0,'infrastructure'],['اتوماسیون',!!adminState.monitoring?.settings,'advanced']],setupDone=setupItems.filter(x=>x[1]).length,onboarding=setupDone===setupItems.length?'':`<article class="admin-card admin-setup-card"><div class="admin-card-head"><span class="admin-card-icon">✓</span><div><h3>راه‌اندازی BlueGate · ${setupDone}/${setupItems.length}</h3><p class="muted">موارد باقی‌مانده را از همین‌جا کامل کن.</p></div></div><div class="admin-setup-list">${setupItems.map(([label,ok,route],i)=>`<button data-admin-tab="${route}" class="${ok?'done':''}"><span>${ok?'✓':i+1}</span><b>${label}</b></button>`).join('')}</div></article>`;const top=adminState.report?.top||[];const catalogTree=adminState.catalog_admin?.tree||[];const productCount=catalogTree.length;const variantCount=catalogTree.reduce((a,s)=>a+(s.groups||[]).reduce((b,g)=>b+(g.plans||[]).length,0),0);const orderCount=(adminState.orders||[]).length;const inventoryCount=(adminState.inventory||[]).length;const orders=adminState.orders||[];const rev7=last7DaysRevenue(orders);const total7=rev7.reduce((s,d)=>s+d.rev,0);const lowStock=(adminState.products||[]).filter(p=>Number(p.inventory_available||0)<3&&Number(p.is_active)).sort((a,b)=>Number(a.inventory_available||0)-Number(b.inventory_available||0));const topups=(adminState.credit_topups||[]).filter(x=>['receipt_submitted','reviewing'].includes(x.status));const topupReview=topups.length?`<article class="admin-card topup-admin-review"><div class="admin-card-head"><span class="admin-card-icon">💳</span><div><h3>شارژهای در انتظار بررسی</h3><p class="muted">${nf(topups.length)} درخواست نیازمند تصمیم</p></div></div><div class="topup-admin-list">${topups.slice(0,8).map(x=>`<div><span><b>#${nf(x.id)} · ${esc(x.first_name||x.username||'کاربر')}</b><small>${String(x.credit_currency||'IRT').toUpperCase()==='USD'?'$'+Number(x.credit_amount_usd||0).toFixed(4)+' · '+fmt(x.amount)+' Toman':fmt(x.amount)} · ${esc(x.payment_method_fa||x.payment_method||'')}${x.tx_hash?' · TXID':''}${x.receipt_file_id?' · رسید':''}</small></span><div>${x.receipt_file_id?`<button class="secondary" data-credit-topup-receipt="${x.id}">مشاهده رسید</button>`:''}${x.tx_hash?`<button class="secondary" data-credit-topup-tx="${esc(x.tx_hash)}">TXID</button>`:''}<button class="success" data-credit-topup-approve="${x.id}">تایید</button><button class="danger" data-credit-topup-reject="${x.id}">رد</button></div></div>`).join('')}</div></article>`:'';return `${onboarding}${topupReview}<article class="admin-card dashboard-hero"><div class="admin-card-head"><span class="admin-card-icon">📊</span><div><h3>داشبورد فروش</h3><p class="muted">مرور سریع وضعیت فروشگاه و دسترسی به همه بخش‌ها.</p></div></div><div class="dashboard-quick-stats"><div class="dq-stat"><b>${nf(productCount)}</b><span>سرویس</span></div><div class="dq-stat"><b>${nf(variantCount)}</b><span>پلن</span></div><div class="dq-stat"><b>${nf(orderCount)}</b><span>سفارش</span></div><div class="dq-stat"><b>${nf(inventoryCount)}</b><span>آیتم انبار</span></div></div><div class="dashboard-quick-actions"><button class="quick-action" data-admin-tab="catalog"><span>🧭</span><b>Catalog Studio</b></button><button class="quick-action" data-admin-tab="orders"><span>🧾</span><b>سفارش‌ها</b></button><button class="quick-action" data-admin-tab="inventory"><span>📦</span><b>انبار</b></button><button class="quick-action" data-admin-tab="settings"><span>⚙️</span><b>تنظیمات</b></button><button class="quick-action" data-admin-tab="backups"><span>💾</span><b>بکاپ</b></button><button class="quick-action" data-admin-tab="notifications"><span>🔔</span><b>اعلان کاربران</b></button><button class="quick-action" onclick="openBroadcast()"><span>📢</span><b>پیام تلگرام</b></button><button class="quick-action" onclick="openPurchaseReward()"><span>🎁</span><b>پاداش خرید</b></button></div></article>${lowStock.length?`<article class="admin-card alert-card"><div class="admin-card-head"><span class="admin-card-icon">⚠️</span><div><h3>موجودی کم</h3><p class="muted">${nf(lowStock.length)} محصول کمتر از ۳ آیتم در انبار دارند.</p></div></div><div class="low-stock-list">${lowStock.slice(0,5).map(p=>`<div class="low-stock-row" data-admin-tab="inventory"><div><b>${esc(p.name)}</b><span class="muted">موجودی: ${nf(p.inventory_available||0)} آیتم</span></div><span class="chip-mini chip-${Number(p.inventory_available||0)===0?'off':'featured'}">${Number(p.inventory_available||0)===0?'ناموجود':'کم'}</span></div>`).join('')}</div>${lowStock.length>5?`<button class="secondary wide" data-admin-tab="inventory" style="margin-top:10px">مشاهده همه در انبار</button>`:''}</article>`:''}${starsStatsCardHtml()}<article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">📈</span><div><h3>درآمد ۷ روز اخیر</h3><p class="muted">مجموع: ${fmt(total7)} تومان</p></div></div>${sparklineHtml(rev7)}</article>${(adminState.forecast&&adminState.forecast.forecast)?`<article class="admin-card forecast-card"><div class="admin-card-head"><span class="admin-card-icon">🔮</span><div><h3>پیش‌بینی ماه آینده</h3><p class="muted">بر اساس میانگین ۳۰ روز اخیر</p></div></div><div class="forecast-grid"><div class="forecast-main"><b>${fmt(adminState.forecast.forecast)}</b><span>تومان پیش‌بینی</span></div><div class="forecast-side"><span class="chip-mini chip-${adminState.forecast.change_percent>=0?'active':'off'}">${adminState.forecast.change_percent>=0?'▲':'▼'} ${nf(Math.abs(adminState.forecast.change_percent))}٪</span><small>نسبت به ماه قبل</small></div></div><p class="muted">میانگین روزانه: ${fmt(adminState.forecast.daily_avg)} تومان · ۳۰ روز اخیر: ${nf(adminState.forecast.last30_count)} سفارش</p></article>`:''}<div class="admin-charts-grid"><article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">🏆</span><div><h3>پرفروش‌ترین‌ها</h3><p class="muted">بر اساس تعداد سفارش</p></div></div>${top.length?barChartHtml(top):'<p class="muted empty-state">داده‌ای نیست.</p>'}</article><article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">🥧</span><div><h3>روش‌های پرداخت</h3><p class="muted">توزیع ${nf(orderCount)} سفارش</p></div></div>${pieChartHtml(orders)}</article></div>`}

function renderAdminNotifications(){if(!hasLicenseFeature('marketing_automation'))return `<article class="admin-card"><div class="pro-inline-alert"><b>کمپین و اعلان همگانی ${proBadge('marketing_automation')}</b><span>این بخش در نسخه Pro فعال است.</span><button data-pro-feature="marketing_automation">ارتقا به Pro</button></div></article>`;const rows=adminState.notification_campaigns||[];const typeFa={info:'عادی',important:'مهم',promo:'تخفیف',service:'سرویس',security:'امنیتی'},audFa={all:'همه کاربران',service:'دارای سرویس',vpn:'کاربران VPN'};return `<article class="admin-card admin-notify-compose"><div class="admin-card-head"><span class="admin-card-icon">🔔</span><div><h3>ارسال اعلان به کاربران</h3><p class="muted">این پیام داخل Notification Center وب و Mini App ثبت می‌شود.</p></div></div><div class="admin-notify-form"><label><span>عنوان</span><input id="aniTitle" maxlength="255" placeholder="مثلاً لوکیشن جدید VPN پیش‌فرض"></label><label><span>نوع</span><select id="aniType"><option value="info">عادی</option><option value="important">مهم</option><option value="promo">تخفیف</option><option value="service">سرویس</option><option value="security">امنیتی</option></select></label><label class="full"><span>متن پیام</span><textarea id="aniBody" maxlength="1000" placeholder="متن کوتاه و واضح اعلان"></textarea></label><label><span>مخاطب</span><select id="aniAudience"><option value="all">همه کاربران</option><option value="service">کاربران دارای سرویس</option><option value="vpn">کاربران VPN</option></select></label><label><span>با کلیک برو به</span><select id="aniAction"><option value="">بدون اکشن</option><option value="store">فروشگاه</option><option value="orders">سفارش‌ها</option><option value="wallet">اعتبار</option><option value="account">حساب</option><option value="service">سرویس مشخص</option><option value="url">لینک HTTPS</option></select></label><label class="full"><span>مقدار اکشن <small>اختیاری؛ برای سرویس Order ID و برای لینک URL</small></span><input id="aniActionValue" placeholder="مثلاً 123 یا https://..."></label><button class="primary wide" id="adminSendInAppNotification">ارسال اعلان</button></div></article><article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">🕘</span><div><h3>اعلان‌های ارسال‌شده</h3><p class="muted">${nf(rows.length)} کمپین اخیر · آمار خوانده‌شدن</p></div></div><div class="admin-notification-history">${rows.length?rows.map(x=>`<div class="admin-notification-history-row"><span>${notificationIcon(x)}</span><div><b>${esc(x.title)}</b><small>${esc(x.body||'')}</small><em>${audFa[x.audience]||x.audience} · ${nf(x.recipient_count||0)} گیرنده · ${nf(x.read_count||0)} خوانده · ${nf(x.unread_count||0)} نخوانده · ${esc(String(x.created_at||'').slice(0,16))}</em></div><i>${typeFa[x.type]||x.type}</i></div>`).join(''):'<p class="muted empty-state">هنوز اعلانی ارسال نشده.</p>'}</div></article>`}
async function sendAdminInAppNotification(){const title=$('aniTitle')?.value.trim()||'',body=$('aniBody')?.value.trim()||'',type=$('aniType')?.value||'info',audience=$('aniAudience')?.value||'all',action_type=$('aniAction')?.value||'',action_value=$('aniActionValue')?.value.trim()||'';if(!title){showStatus('عنوان اعلان را وارد کن','error');return}try{showStatus('در حال ثبت اعلان…','info');adminState=await api('admin_notification_broadcast',{title,body,type,audience,action_type,action_value});renderAdmin();showStatus(adminState.message||'اعلان ارسال شد','success')}catch(e){showStatus(e.message||'ارسال اعلان انجام نشد','error')}}
function catalogAdminData(){return adminState.catalog_admin||{tree:[],categories:[],preview:{counts:{},proposals:[]},public:{enabled:false}}}
function catalogCategoryOptions(selected=''){return (catalogAdminData().categories||[]).map(c=>`<option value="${c.id}" ${Number(selected)===Number(c.id)?'selected':''}>${esc(c.emoji||'🛍️')} ${esc(c.title)}</option>`).join('')}
function catalogServiceOptions(selected=''){return (catalogAdminData().tree||[]).map(s=>`<option value="${s.id}" ${Number(selected)===Number(s.id)?'selected':''}>${esc(s.name)}</option>`).join('')}
function catalogGroupOptions(selected=''){return (catalogAdminData().tree||[]).flatMap(s=>(s.groups||[]).map(g=>`<option value="${g.id}" ${Number(selected)===Number(g.id)?'selected':''}>${esc(s.name)} → ${g.is_default?'پلن‌های مستقیم':esc(g.name)}</option>`)).join('')}
function catalogPlanOptions(selected=''){return (catalogAdminData().tree||[]).flatMap(s=>(s.groups||[]).flatMap(g=>(g.plans||[]).map(p=>`<option value="${p.id}" ${Number(selected)===Number(p.id)?'selected':''}>${esc(s.name)} → ${g.is_default?'پلن اصلی':esc(g.name)} → ${esc(p.title)}</option>`))).join('')}
function renderAdminCatalog(){const ca=catalogAdminData(),tree=ca.tree||[],cats=ca.categories||[],pv=ca.preview||{},enabled=!!ca.public?.enabled,undo=ca.undo||{},unresolved=(pv.proposals||[]).filter(x=>!x.mapped),review=unresolved.filter(x=>x.confidence==='review');const groupCount=tree.reduce((a,s)=>a+(s.groups||[]).filter(g=>!g.is_default).length,0),planCount=tree.reduce((a,s)=>a+(s.groups||[]).reduce((b,g)=>b+(g.plans||[]).length,0),0);return `<article class="admin-card catalog-mobile-studio-hero"><div class="admin-card-head"><span class="admin-card-icon">🧭</span><div><h3>Catalog Studio</h3><p class="muted">ساخت و ویرایش سرویس‌ها، مرحله‌به‌مرحله</p></div></div><div class="dashboard-quick-stats"><div class="dq-stat"><b>${nf(tree.length)}</b><span>سرویس</span></div><div class="dq-stat"><b>${nf(groupCount)}</b><span>گروه پلن</span></div><div class="dq-stat"><b>${nf(planCount)}</b><span>پلن</span></div><div class="dq-stat"><b>${nf(review.length)}</b><span>بررسی</span></div></div><button class="primary wide catalog-mobile-create" onclick="openCatalogMobileWizard(0)">＋ ساخت سرویس جدید</button>${undo.available?`<button class="secondary wide catalog-mobile-undo" onclick="catalogMobileUndo()">↶ بازگشت آخرین تغییر</button>`:''}</article><article class="admin-card catalog-guide-card" data-catalog-guide><div class="admin-card-head"><span class="admin-card-icon">📘</span><div><h3>راهنمای ساخت کاتالوگ</h3><p class="muted">دسته‌بندی، سرویس، گروه پلن و پلن اصلی یعنی چی؟</p></div><span class="catalog-guide-chevron">‹</span></div></article>${!enabled?`<article class="admin-card catalog-mobile-migrate"><div class="admin-card-head"><span class="admin-card-icon">🪄</span><div><h3>مرتب‌سازی فروشگاه قبلی</h3><p class="muted">هیچ سفارش یا دیتایی حذف نمی‌شود.</p></div></div><div class="catalog-mobile-stepbar"><span><b>1</b>اسکن</span><i></i><span><b>2</b>بررسی</span><i></i><span><b>3</b>فعال‌سازی</span></div><div class="catalog-mobile-actions"><button class="secondary" onclick="catalogMobilePreview()">🔍 اسکن دوباره</button><button class="primary" onclick="catalogMobileApply()">✨ اعمال موارد مطمئن</button></div></article>`:''}<article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">🗂</span><div><h3>دسته‌های فروشگاه</h3><p class="muted">فقط برای مرتب‌کردن ویترین.</p></div><button class="secondary" onclick="openCatalogMobileCategory(0)">＋</button></div><div class="catalog-mobile-categories">${cats.map(c=>`<button onclick="openCatalogMobileCategory(${c.id})"><span>${esc(c.emoji||'🛍️')}</span><b>${esc(c.title)}</b><small>${tree.filter(s=>Number(s.category_id)===Number(c.id)).length} سرویس</small></button>`).join('')||'<p class="muted">هنوز دسته‌ای نیست.</p>'}</div></article><div class="catalog-mobile-section-title"><div><h3>سرویس‌های فروشگاه</h3><p class="muted">برای اصلاح محصول فعلی، همان Wizard را باز کن.</p></div><button class="secondary" onclick="openCatalogMobileOrganizer()">⇄ انتقال</button></div><div class="catalog-mobile-service-list">${tree.map(catalogMobileServiceCard).join('')||`<article class="admin-card catalog-mobile-empty"><span>🛍️</span><h3>هنوز سرویسی نداری</h3><p class="muted">اولین سرویس را با مسیر مرحله‌ای بساز.</p><button class="primary wide" onclick="openCatalogMobileWizard(0)">ساخت سرویس</button></article>`}</div>${unresolved.length?`<article class="admin-card catalog-mobile-review"><div class="admin-card-head"><span class="admin-card-icon">🧠</span><div><h3>موارد نیازمند بررسی</h3><p class="muted">مواردی که برای چیدمان دقیق‌تر نیاز به تصمیم شما دارند اینجا نمایش داده می‌شوند.</p></div></div><div class="catalog-mobile-review-list">${unresolved.map(x=>`<div><div><b>${esc(x.service_name)}</b><small>${esc(x.category_title||'سایر')} · ${nf(x.plan_count||0)} پلن</small></div><span class="chip-mini ${x.confidence==='review'?'chip-off':x.confidence==='medium'?'chip-featured':'chip-active'}">${x.confidence==='review'?'🔴 تصمیم لازم':x.confidence==='medium'?'🟡 بررسی':'🟢 آماده'}</span>${x.confidence==='review'?`<button class="secondary" onclick="catalogMobileApplyOne(${x.legacy_product_id})">مرتب‌سازی</button>`:''}</div>`).join('')}</div></article>`:''}`}
function openCatalogGuide(){const body=`<div class="catalog-guide-body"><section><span>1</span><div><b>دسته‌بندی</b><p>فقط برای مرتب‌کردن ویترین است؛ مثلاً VPN، هوش مصنوعی یا استریم. دسته‌بندی خودش چیزی برای فروش ندارد و سرویس‌ها داخل آن قرار می‌گیرند.</p></div></section><section><span>2</span><div><b>سرویس</b><p>همان محصول اصلی است که کاربر در فروشگاه می‌بیند؛ مثل VPN، Gemini یا Netflix. تصویر، توضیح و جایگاه اصلی فروش را اینجا تنظیم می‌کنی.</p></div></section><section><span>3</span><div><b>گروه پلن</b><p>وقتی یک سرویس چند نوع انتخاب دارد از گروه پلن استفاده کن؛ مثلاً «استاندارد» و «پرو». کاربر اول گروه را انتخاب می‌کند و بعد پلن مناسبش را می‌بیند.</p></div></section><section><span>4</span><div><b>پلن اصلی</b><p>اگر سرویس به گروه‌بندی نیاز ندارد، پلن‌ها را مستقیم زیر خود سرویس می‌سازی؛ مثلاً ۱ ماهه، ۳ ماهه و ۱۲ ماهه. این مدل کاملاً استاندارد و مناسب سرویس‌های ساده‌تر است.</p></div></section><div class="catalog-guide-tip"><b>کدام مدل بهتر است؟</b><p>هر دو مدل درست‌اند. اگر کاربر قبل از انتخاب مدت/حجم باید نوع سرویس را مشخص کند، «گروه پلن» مناسب‌تر است. اگر فقط چند گزینه قیمت یا مدت داری، «پلن اصلی» ساده‌تر و سریع‌تر است.</p></div></div>`;BlueGateUI.openSheet({type:'fullscreen',eyebrow:'راهنمای کاتالوگ',title:'ساخت سرویس در BlueGate',subtitle:'ساختار کاتالوگ را ساده و بدون اصطلاحات فنی بچین.',body,footer:'<button type="button" class="primary" data-close-catalog-guide>متوجه شدم</button>',onOpen:h=>{h.classList.add('vy-admin-parity-sheet','catalog-guide-sheet');h.querySelector('[data-close-catalog-guide]')?.addEventListener('click',()=>BlueGateUI.closeSheet?.())}})}
function catalogMobileServiceCard(s){const groups=(s.groups||[]).filter(g=>!g.is_default),direct=(s.groups||[]).find(g=>g.is_default),plans=(s.groups||[]).reduce((a,g)=>a+(g.plans||[]).length,0);return `<article class="admin-card catalog-mobile-service-card ${Number(s.is_active)?'':'is-off'}"><header><div class="catalog-mobile-service-icon">${s.image_url?`<img src="${esc(s.image_url)}">`:esc(s.category_emoji||'🛍️')}</div><div><small>${esc(s.category_title||'سایر')}</small><h3>${esc(s.name)}</h3><p class="muted">${esc(s.description||'بدون توضیح')}</p></div><span class="chip-mini ${Number(s.is_active)?'chip-active':'chip-off'}">${Number(s.is_active)?'فعال':'غیرفعال'}</span></header><div class="catalog-mobile-card-stats"><span><b>${nf(groups.length)}</b><small>گروه پلن</small></span><span><b>${nf(plans)}</b><small>پلن</small></span><span><b>${groups.length?'گروه‌بندی‌شده':'پلن اصلی'}</b><small>مدل فروش</small></span></div><div class="catalog-mobile-card-structure">${groups.length?groups.map(g=>`<div><b>${esc(g.name)}</b><span>${(g.plans||[]).map(p=>esc(p.title)).join(' · ')||'بدون پلن'}</span></div>`).join(''):`<div><b>⚡ پلن‌های اصلی</b><span>${(direct?.plans||[]).map(p=>esc(p.title)).join(' · ')||'بدون پلن'}</span></div>`}</div><button class="primary wide" onclick="openCatalogMobileWizard(${s.id})">✏️ مدیریت و ویرایش</button></article>`}
const MOBILE_CATALOG_DRAFT_SCHEMA=2;
let mobileCatalogWizard=null,mobileCatalogStep=0,mobileCatalogUploadPending=0;
function mcUploadBusy(on){const sheet=document.querySelector('.mcw-sheet')||document.querySelector('[data-mc-wizard]')||document;const b=sheet.querySelector?.('[data-mc-save]');if(b){b.disabled=!!on;b.title=on?'صبر کن تا آپلود تصویر تمام شود':''}}
function mcKey(p='x'){return p+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function mcPlan(p={}){return {id:Number(p.id||0),key:p.key||mcKey('p'),title:p.title||'',price:Number(p.price||0),price_currency:(p.price_currency||'IRT').toUpperCase(),price_usd:p.price_usd??'',duration_days:Number(p.duration_days||0),discount_percent:Number(p.discount_percent||0),description:p.description||'',image_url:p.image_url||'',delivery_type:p.delivery_type||'manual',commission_type:p.commission_type||'none',commission_value:Number(p.commission_value||0),sort_order:Number(p.sort_order||0),is_active:p.is_active===undefined?1:Number(p.is_active)}}
function mcGroup(g={}){return {id:Number(g.id||0),key:g.key||mcKey('g'),name:g.is_default?'Default Group':(g.name||''),slug:g.slug||'',description:g.description||'',image_url:g.image_url||'',sort_order:Number(g.sort_order||0),is_default:Number(g.is_default||0),is_active:g.is_active===undefined?1:Number(g.is_active),plans:(g.plans||[]).map(mcPlan)}}
function mcFromService(s){const gs=(s.groups||[]).map(mcGroup),vis=gs.filter(g=>!g.is_default),def=gs.find(g=>g.is_default),mode=vis.length?'grouped':'direct';return {id:Number(s.id),name:s.name||'',slug:s.slug||'',category_id:s.category_id||'',description:s.description||'',image_url:s.image_url||'',theme:s.theme||'blue',sort_order:Number(s.sort_order||0),badge:s.badge||'',is_featured:Number(s.is_featured||0),is_active:Number(s.is_active||0),mode,groups:mode==='direct'?[def||mcGroup({is_default:1})]:gs.filter(g=>!g.is_default||(g.plans||[]).length)}}
function mcBlank(){const c=catalogAdminData().categories?.[0];return {id:0,name:'',slug:'',category_id:c?.id||'',description:'',image_url:'',theme:'blue',sort_order:0,badge:'',is_featured:0,is_active:1,mode:'grouped',groups:[mcGroup({name:'Standard'})]}}
function openCatalogMobileWizard(id=0){const s=(catalogAdminData().tree||[]).find(x=>Number(x.id)===Number(id));mobileCatalogWizard=s?mcFromService(s):mcBlank();let restored=false;try{const k=`nx_mcw_${id||'new'}`,raw=localStorage.getItem(k);if(raw){const d=JSON.parse(raw);if(d&&Number(d.id||0)===Number(id||0)&&Number(d._draft_schema||0)===MOBILE_CATALOG_DRAFT_SCHEMA){mobileCatalogWizard=d;restored=true}else localStorage.removeItem(k)}}catch(_){}mobileCatalogStep=0;renderCatalogMobileWizard();if(restored)setTimeout(()=>showStatus('پیش‌نویس ذخیره‌شده بازیابی شد.','success'),30)}
function mcCollect(){const sh=$('appSheet');if(!sh||!mobileCatalogWizard)return;const w=mobileCatalogWizard;if(mobileCatalogStep===0){sh.querySelectorAll('[data-mcw]').forEach(el=>{w[el.dataset.mcw]=el.type==='checkbox'?(el.checked?1:0):el.value})}if(mobileCatalogStep===2&&w.mode==='grouped'){sh.querySelectorAll('[data-mcg]').forEach(box=>{const g=w.groups.find(x=>x.key===box.dataset.mcg);if(g){box.querySelectorAll('[data-mcgf]').forEach(el=>g[el.dataset.mcgf]=el.type==='checkbox'?(el.checked?1:0):(el.type==='number'?Number(el.value||0):el.value))}})}if(mobileCatalogStep===3){sh.querySelectorAll('[data-mcp]').forEach(box=>{const p=w.groups.flatMap(g=>g.plans||[]).find(x=>x.key===box.dataset.mcp);if(p){box.querySelectorAll('[data-mcpf]').forEach(el=>p[el.dataset.mcpf]=el.type==='checkbox'?(el.checked?1:0):(el.type==='number'?Number(el.value||0):el.value))}})}try{w._draft_schema=MOBILE_CATALOG_DRAFT_SCHEMA;localStorage.setItem(`nx_mcw_${w.id||'new'}`,JSON.stringify(w))}catch(_){}}
function mcFileDataUrl(file){return new Promise((resolve,reject)=>{if(!file)return reject(new Error('فایلی انتخاب نشده'));if(file.size>6*1024*1024)return reject(new Error('حجم تصویر باید حداکثر ۶ مگابایت باشد'));const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(new Error('خواندن تصویر ناموفق بود'));r.readAsDataURL(file)})}
async function mcUploadImage(file){const image_b64=await mcFileDataUrl(file);const r=await api('admin_catalog_upload_image',{image_b64});if(!r?.image_url)throw new Error('آپلود تصویر ناموفق بود');return r.image_url}
function mcValidate(step=mobileCatalogStep){const w=mobileCatalogWizard;if(step===0){if(!String(w.name||'').trim())return 'نام سرویس را وارد کن';if(!Number(w.category_id))return 'دسته را انتخاب کن'}if(step===2&&w.mode==='grouped'){const gs=w.groups.filter(g=>!g.is_default);if(!gs.length)return 'حداقل یک گروه پلن اضافه کن';if(gs.some(g=>!String(g.name||'').trim()))return 'نام گروه‌های پلن را کامل کن'}if(step===3){const gs=w.mode==='direct'?w.groups.filter(g=>g.is_default):w.groups.filter(g=>!g.is_default);if(!gs.some(g=>(g.plans||[]).length))return 'حداقل یک پلن اضافه کن';for(const g of gs)for(const p of g.plans||[]){if(!String(p.title||'').trim())return 'عنوان پلن را کامل کن';if(String(p.price_currency||'IRT').toUpperCase()==='USD'){if(Number(p.price_usd||0)<=0)return 'قیمت USD پلن را وارد کن'}else if(Number(p.price||0)<=0)return 'قیمت پلن باید بیشتر از صفر باشد'}}return ''}
function mcUploadField(kind,key='',url=''){
  const keyAttr=key?` data-key="${esc(key)}"`:'';
  return `<div class="mcw-upload-card full ${url?'has-image':''}">
    <div class="mcw-upload-main">
      <div class="mcw-upload-icon">${url?`<img src="${esc(url)}" alt="">`:'🖼️'}</div>
      <div><b>${url?'تصویر فعلی':'آپلود تصویر'}</b><small>JPG / PNG / WEBP · حداکثر ۶MB</small></div>
    </div>
    <label class="mcw-upload-action"><input type="file" accept="image/jpeg,image/png,image/webp" data-mc-upload="${kind}"${keyAttr}><span>${url?'تغییر تصویر':'انتخاب تصویر'}</span></label>
  </div>`;
}
function mcSettingRow(label,desc,field,checked,icon='●'){
  return `<label class="mcw-setting-row"><span class="mcw-setting-icon">${icon}</span><span class="mcw-setting-copy"><b>${label}</b><small>${desc}</small></span><span class="mcw-toggle"><input type="checkbox" ${field} ${checked?'checked':''}><i></i></span></label>`;
}
function mcGroupEditorHtml(g){
  return `<div class="form-grid mcw-grid compact">
    <label class="mcw-field"><span>نام</span><input data-mcgf="name" value="${esc(g.name)}"></label>
    <label class="mcw-field"><span>Slug</span><input data-mcgf="slug" value="${esc(g.slug||'')}"></label>
    <label class="mcw-field full"><span>توضیح</span><input data-mcgf="description" value="${esc(g.description)}"></label>
    <label class="mcw-field"><span>ترتیب</span><input data-mcgf="sort_order" type="number" value="${Number(g.sort_order||0)}"></label>
    <label class="mcw-field full"><span>لینک تصویر</span><input data-mcgf="image_url" value="${esc(g.image_url||'')}"></label>
    ${mcUploadField('group',g.key,g.image_url)}
  </div><div class="mcw-inline-setting">${mcSettingRow('فعال','این گروه پلن قابل انتخاب باشد','data-mcgf="is_active"',Number(g.is_active),'●')}</div>`;
}
function mcPlanEditorHtml(p){
  return `<div class="form-grid mcw-grid compact">
    <label class="mcw-field full"><span>عنوان</span><input data-mcpf="title" value="${esc(p.title)}"></label>
    <label class="mcw-field"><span>واحد قیمت</span><select data-mcpf="price_currency"><option value="IRT" ${p.price_currency==='IRT'?'selected':''}>تومان</option><option value="USD" ${p.price_currency==='USD'?'selected':''}>USD → تومان خودکار</option></select></label>
    <label class="mcw-field"><span>قیمت تومان</span><input data-mcpf="price" type="number" value="${Number(p.price||0)}"></label>
    <label class="mcw-field"><span>قیمت USD</span><input data-mcpf="price_usd" type="number" step="0.0001" value="${esc(p.price_usd??'')}"></label>
    <label class="mcw-field"><span>مدت (روز)</span><input data-mcpf="duration_days" type="number" value="${Number(p.duration_days||0)}"></label>
    <label class="mcw-field"><span>تخفیف ٪</span><input data-mcpf="discount_percent" type="number" value="${Number(p.discount_percent||0)}"></label>
    <label class="mcw-field"><span>نوع تحویل</span><select data-mcpf="delivery_type">${['manual','account','vpn','code','file'].map(x=>`<option value="${x}" ${p.delivery_type===x?'selected':''}>${x}</option>`).join('')}</select></label>
    <label class="mcw-field"><span>نوع پورسانت</span><select data-mcpf="commission_type">${['none','percent','fixed'].map(x=>`<option value="${x}" ${p.commission_type===x?'selected':''}>${x}</option>`).join('')}</select></label>
    <label class="mcw-field"><span>مقدار پورسانت</span><input data-mcpf="commission_value" type="number" value="${Number(p.commission_value||0)}"></label>
    <label class="mcw-field"><span>ترتیب</span><input data-mcpf="sort_order" type="number" value="${Number(p.sort_order||0)}"></label>
    <label class="mcw-field full"><span>توضیح</span><input data-mcpf="description" value="${esc(p.description)}"></label>
    <label class="mcw-field full"><span>لینک تصویر</span><input data-mcpf="image_url" value="${esc(p.image_url||'')}"></label>
    ${mcUploadField('plan',p.key,p.image_url)}
  </div><div class="mcw-inline-setting">${mcSettingRow('فعال','این پلن در انتخاب‌های کاربر نمایش داده شود','data-mcpf="is_active"',Number(p.is_active),'●')}</div>`;
}
function mcSyncLazyField(el){
  const w=mobileCatalogWizard;if(!w||!el)return;
  const value=el.type==='checkbox'?(el.checked?1:0):(el.type==='number'?Number(el.value||0):el.value);
  if(el.dataset.mcgf){const box=el.closest('[data-mcg]');const g=box&&w.groups.find(x=>x.key===box.dataset.mcg);if(g)g[el.dataset.mcgf]=value}
  if(el.dataset.mcpf){const box=el.closest('[data-mcp]');const p=box&&w.groups.flatMap(g=>g.plans||[]).find(x=>x.key===box.dataset.mcp);if(p)p[el.dataset.mcpf]=value}
}
async function mcHandleUploadInput(inp,w){
  if(!inp?.files?.[0])return;const wizard=w;mcCollect();mobileCatalogUploadPending++;mcUploadBusy(true);inp.disabled=true;
  try{showStatus('در حال آپلود تصویر…');const url=await mcUploadImage(inp.files[0]);if(mobileCatalogWizard!==wizard)return;const kind=inp.dataset.mcUpload,key=inp.dataset.key;if(kind==='service')wizard.image_url=url;else if(kind==='group'){const g=wizard.groups.find(x=>x.key===key);if(g)g.image_url=url}else if(kind==='plan'){const p=wizard.groups.flatMap(g=>g.plans||[]).find(x=>x.key===key);if(p)p.image_url=url}try{wizard._draft_schema=MOBILE_CATALOG_DRAFT_SCHEMA;localStorage.setItem(`nx_mcw_${wizard.id||'new'}`,JSON.stringify(wizard))}catch(_){}renderCatalogMobileWizard();showStatus('تصویر آپلود شد','success')}catch(e){showStatus(e.message||'آپلود تصویر ناموفق بود','error')}finally{mobileCatalogUploadPending=Math.max(0,mobileCatalogUploadPending-1);mcUploadBusy(mobileCatalogUploadPending>0);if(inp?.isConnected)inp.disabled=false}
}
function mcStepHtml(){
  const w=mobileCatalogWizard;
  if(mobileCatalogStep===0)return `<div class="mcw-section-head"><span class="mcw-section-kicker">اطلاعات اصلی</span><h3>${w.id?'ویرایش مشخصات سرویس':'سرویس جدید'}</h3><p>اطلاعات اصلی و ظاهر ویترین را بدون حذف هیچ تنظیمی مدیریت کن.</p></div>
    <section class="mcw-card"><div class="mcw-card-title"><span>✦</span><div><b>مشخصات سرویس</b><small>اطلاعاتی که در کاتالوگ و URL استفاده می‌شود</small></div></div><div class="form-grid mcw-grid compact">
      <label class="mcw-field full"><span>نام سرویس</span><input data-mcw="name" value="${esc(w.name)}" placeholder="مثلاً VPN پیش‌فرض"></label>
      <label class="mcw-field"><span>Slug</span><input data-mcw="slug" value="${esc(w.slug||'')}" placeholder="default-vpn"></label>
      <label class="mcw-field"><span>دسته</span><select data-mcw="category_id">${catalogCategoryOptions(w.category_id)}</select></label>
      <label class="mcw-field"><span>ترتیب</span><input data-mcw="sort_order" type="number" value="${Number(w.sort_order||0)}"></label>
      <label class="mcw-field"><span>Badge</span><input data-mcw="badge" value="${esc(w.badge)}" placeholder="اختیاری"></label>
    </div></section>
    <section class="mcw-card"><div class="mcw-card-title"><span>◈</span><div><b>ظاهر و توضیحات</b><small>تمام گزینه‌های قبلی حفظ شده‌اند</small></div></div><div class="form-grid mcw-grid compact">
      <label class="mcw-field"><span>تم کارت</span><select data-mcw="theme">${['blue','green','purple','gold'].map(x=>`<option value="${x}" ${w.theme===x?'selected':''}>${x}</option>`).join('')}</select></label>
      <label class="mcw-field full"><span>توضیح کوتاه</span><textarea data-mcw="description" rows="3">${esc(w.description)}</textarea></label>
      <label class="mcw-field full"><span>لینک تصویر</span><input data-mcw="image_url" value="${esc(w.image_url)}" placeholder="https://..."></label>
      ${mcUploadField('service','',w.image_url)}
    </div></section>
    <section class="mcw-card mcw-settings-card"><div class="mcw-card-title"><span>⚙</span><div><b>وضعیت نمایش</b><small>کنترل انتشار سرویس در فروشگاه</small></div></div><div class="mcw-setting-list">
      ${mcSettingRow('ویژه','نمایش برجسته‌تر در بخش‌های پیشنهادی','data-mcw="is_featured"',Number(w.is_featured),'★')}
      ${mcSettingRow('فعال','سرویس برای کاربران قابل مشاهده و خرید باشد','data-mcw="is_active"',Number(w.is_active),'●')}
    </div></section>`;

  if(mobileCatalogStep===1)return `<div class="mcw-section-head"><span class="mcw-section-kicker">ساختار</span><h3>مشتری چطور پلن را انتخاب کند؟</h3><p>ساختار فقط نحوه نمایش را تعیین می‌کند؛ همه تنظیمات سرویس حفظ می‌شوند.</p></div><div class="mcw-mode mcw-mode-clean">
    <button type="button" class="${w.mode==='direct'?'active':''}" data-mc-mode="direct"><span>⚡</span><b>پلن اصلی</b><small>مناسب سرویس‌هایی که کاربر مستقیماً ۱ ماهه، ۳ ماهه و… را انتخاب می‌کند.</small><i></i></button>
    <button type="button" class="${w.mode==='grouped'?'active':''}" data-mc-mode="grouped"><span>🧩</span><b>زیرسرویس + پلن</b><small>مناسب Standard / Pro یا هر سرویسی که یک انتخاب قبل از پلن دارد.</small><i></i></button>
  </div>`;

  if(mobileCatalogStep===2){
    if(w.mode==='direct')return `<div class="mcw-section-head"><span class="mcw-section-kicker">زیرسرویس</span><h3>این مرحله لازم نیست</h3><p>برای ساختار مستقیم، Default Group پشت صحنه حفظ و مدیریت می‌شود.</p></div><div class="mcw-empty mcw-empty-clean"><span>⚡</span><b>ساختار مستقیم آماده است</b><p>بدون حذف هیچ داده‌ای می‌توانی مستقیم به پلن‌ها بروی.</p></div>`;
    const groups=w.groups.filter(g=>!g.is_default);
    return `<div class="mcw-section-head"><span class="mcw-section-kicker">زیرسرویس‌ها</span><h3>گروه‌های سرویس</h3><p>جزئیات هر زیرسرویس فقط وقتی بازش کنی ساخته می‌شود؛ هیچ فیلدی حذف نشده.</p></div><div class="mcw-list mcw-lazy-list">${groups.map((g,i)=>`<article class="mcw-lazy-card" data-mcg="${g.key}"><button type="button" class="mcw-lazy-summary" data-mc-toggle-group="${g.key}"><span class="mcw-lazy-index">${i+1}</span><div><b>${esc(g.name||'زیرسرویس جدید')}</b><small>${esc(g.slug||'بدون slug')} · ${nf((g.plans||[]).length)} پلن · ${Number(g.is_active)?'فعال':'غیرفعال'}</small></div><i>⌄</i></button><div class="mcw-lazy-body" data-mc-group-body="${g.key}" hidden></div><button type="button" class="mcw-lazy-remove danger ghost" data-mc-remove-group="${g.key}">حذف زیرسرویس</button></article>`).join('')}</div><button class="secondary wide mcw-add-row" data-mc-add-group>＋ افزودن زیرسرویس</button>`;
  }

  if(mobileCatalogStep===3){
    let gs=w.mode==='direct'?w.groups.filter(g=>g.is_default):w.groups.filter(g=>!g.is_default||g.plans.length);
    if(w.mode==='direct'&&!gs.length){const g=mcGroup({is_default:1});w.groups.unshift(g);gs=[g]}
    return `<div class="mcw-section-head"><span class="mcw-section-kicker">پلن‌ها</span><h3>قیمت و نحوه تحویل</h3><p>پلن‌ها به‌صورت کشویی و Lazy هستند؛ فرم کامل هر پلن فقط هنگام بازکردن ساخته می‌شود.</p></div><div class="mcw-plan-groups">${gs.map(g=>`<section class="mcw-plan-group-clean"><header><div><b>${g.is_default?'⚡ پلن‌های مستقیم':'🧩 '+esc(g.name)}</b><small>${nf((g.plans||[]).length)} پلن</small></div><button type="button" class="secondary" data-mc-add-plan="${g.key}">＋ پلن</button></header><div class="mcw-plan-list mcw-lazy-list">${(g.plans||[]).map((p,idx)=>`<article class="mcw-lazy-card mcw-lazy-plan" data-mcp="${p.key}"><button type="button" class="mcw-lazy-summary" data-mc-toggle-plan="${p.key}"><span class="mcw-lazy-index">${idx+1}</span><div><b>${esc(p.title||'پلن جدید')}</b><small>${p.price_currency==='USD'?'$'+nf(p.price_usd||0):fmt(p.price)} · ${Number(p.duration_days||0)} روز · ${esc(p.delivery_type||'manual')} · ${Number(p.is_active)?'فعال':'غیرفعال'}</small></div><i>⌄</i></button><div class="mcw-lazy-body" data-mc-plan-body="${p.key}" hidden></div><button type="button" class="mcw-lazy-remove danger ghost" data-mc-remove-plan="${p.key}" data-group-key="${g.key}">حذف پلن</button></article>`).join('')||'<p class="muted mcw-no-plan">هنوز پلنی نیست.</p>'}</div></section>`).join('')}</div>`;
  }

  const gs=w.mode==='direct'?w.groups.filter(g=>g.is_default):w.groups.filter(g=>!g.is_default);
  return `<div class="mcw-section-head"><span class="mcw-section-kicker">بررسی نهایی</span><h3>قبل از ذخیره یک نگاه آخر</h3><p>ذخیره، موارد حذف‌شده موجود را طبق رفتار فعلی سیستم به‌صورت امن غیرفعال می‌کند.</p></div><div class="mcw-preview mcw-preview-clean"><header>${w.image_url?`<img src="${esc(w.image_url)}" alt="">`:`<span>${esc((catalogAdminData().categories||[]).find(c=>Number(c.id)===Number(w.category_id))?.emoji||'🛍️')}</span>`}<div><small>${esc((catalogAdminData().categories||[]).find(c=>Number(c.id)===Number(w.category_id))?.title||'دسته')}</small><h3>${esc(w.name||'نام سرویس')}</h3><p>${esc(w.description||'بدون توضیح')}</p></div></header><div class="mcw-review-chips"><span>${w.mode==='direct'?'⚡ پلن اصلی':'🧩 گروه‌بندی‌شده'}</span><span>${Number(w.is_active)?'● فعال':'○ غیرفعال'}</span>${Number(w.is_featured)?'<span>★ ویژه</span>':''}</div>${gs.map(g=>`<section class="mcw-review-group"><b>${g.is_default?'پلن‌ها':esc(g.name)}</b><div>${(g.plans||[]).map(p=>`<span><strong>${esc(p.title)}</strong><small>${p.price_currency==='USD'?'$'+nf(p.price_usd||0):fmt(p.price)}</small></span>`).join('')||'<em>بدون پلن</em>'}</div></section>`).join('')}</div>`;
}
function renderCatalogMobileWizard(){
  const w=mobileCatalogWizard;if(!w)return;
  const footer=`${mobileCatalogStep>0?'<button type="button" class="secondary" data-mc-prev>قبلی</button>':'<span></span>'}${mobileCatalogStep<4?'<button type="button" class="primary" data-mc-next>ادامه</button>':`<button type="button" class="primary" data-mc-save>${w.id?'✓ ذخیره تغییرات':'🚀 ساخت و انتشار'}</button>`}`;
  const labels=['اطلاعات','ساختار','زیرسرویس','پلن‌ها','بررسی'];const body=`<div class="mcw-stepper">${[0,1,2,3,4].map(i=>`<button type="button" data-mc-goto="${i}" class="${i===mobileCatalogStep?'active':i<mobileCatalogStep?'done':''}"><span>${i<mobileCatalogStep?'✓':i+1}</span><small>${labels[i]}</small></button>`).join('')}</div><div class="mcw-body">${mcStepHtml()}</div>`;
  BlueGateUI.openSheet({type:'fullscreen',eyebrow:'CATALOG STUDIO',title:w.id?'ویرایش سرویس':'سرویس جدید',subtitle:labels[mobileCatalogStep],body,footer,onOpen:(sheet)=>{
    sheet.classList.add('vy-admin-parity-sheet','mcw-sheet');
    sheet.querySelector('[data-mc-prev]')?.addEventListener('click',()=>{mcCollect();mobileCatalogStep=Math.max(0,mobileCatalogStep-1);renderCatalogMobileWizard()});
    sheet.querySelector('[data-mc-next]')?.addEventListener('click',()=>{mcCollect();const err=mcValidate();if(err)return showStatus(err,'error');mobileCatalogStep=Math.min(4,mobileCatalogStep+1);renderCatalogMobileWizard()});
    const syncLazy=(ev)=>{const el=ev.target;if(el?.matches?.('[data-mcgf],[data-mcpf]'))mcSyncLazyField(el)};
    sheet.addEventListener('input',syncLazy);sheet.addEventListener('change',syncLazy);
    sheet.addEventListener('change',ev=>{const inp=ev.target.closest?.('[data-mc-upload]');if(inp)mcHandleUploadInput(inp,w)});
    sheet.querySelectorAll('[data-mc-toggle-group]').forEach(btn=>btn.addEventListener('click',()=>{const key=btn.dataset.mcToggleGroup,body=sheet.querySelector(`[data-mc-group-body="${key}"]`),card=btn.closest('.mcw-lazy-card'),g=w.groups.find(x=>x.key===key);if(!body||!g)return;const opening=body.hidden;if(opening&&!body.dataset.loaded){body.innerHTML=mcGroupEditorHtml(g);body.dataset.loaded='1'}body.hidden=!opening;card?.classList.toggle('open',opening)}));
    sheet.querySelectorAll('[data-mc-toggle-plan]').forEach(btn=>btn.addEventListener('click',()=>{const key=btn.dataset.mcTogglePlan,body=sheet.querySelector(`[data-mc-plan-body="${key}"]`),card=btn.closest('.mcw-lazy-card'),p=w.groups.flatMap(g=>g.plans||[]).find(x=>x.key===key);if(!body||!p)return;const opening=body.hidden;if(opening&&!body.dataset.loaded){body.innerHTML=mcPlanEditorHtml(p);body.dataset.loaded='1'}body.hidden=!opening;card?.classList.toggle('open',opening)}));
    sheet.querySelectorAll('[data-mc-mode]').forEach(b=>b.addEventListener('click',()=>{mcCollect();w.mode=b.dataset.mcMode;if(w.mode==='direct'&&!w.groups.some(g=>g.is_default))w.groups.unshift(mcGroup({is_default:1}));if(w.mode==='grouped'&&!w.groups.some(g=>!g.is_default))w.groups.push(mcGroup({name:'Standard'}));renderCatalogMobileWizard()}));
    sheet.querySelector('[data-mc-add-group]')?.addEventListener('click',()=>{mcCollect();w.groups.push(mcGroup({name:''}));renderCatalogMobileWizard()});
    sheet.querySelectorAll('[data-mc-remove-group]').forEach(b=>b.addEventListener('click',async()=>{mcCollect();const g=w.groups.find(x=>x.key===b.dataset.mcRemoveGroup);if(g?.id&&!await BlueGateUI.confirm({title:'غیرفعال کردن زیرسرویس',message:`زیرسرویس «${g.name}» غیرفعال شود؟`,confirmText:'غیرفعال کن',danger:true}))return;w.groups=w.groups.filter(x=>x.key!==b.dataset.mcRemoveGroup);renderCatalogMobileWizard()}));
    sheet.querySelectorAll('[data-mc-add-plan]').forEach(b=>b.addEventListener('click',()=>{mcCollect();const g=w.groups.find(x=>x.key===b.dataset.mcAddPlan);if(g)g.plans.push(mcPlan());renderCatalogMobileWizard()}));
    sheet.querySelectorAll('[data-mc-remove-plan]').forEach(b=>b.addEventListener('click',async()=>{mcCollect();const g=w.groups.find(x=>x.key===b.dataset.groupKey),pl=g?.plans.find(x=>x.key===b.dataset.mcRemovePlan);if(pl?.id&&!await BlueGateUI.confirm({title:'غیرفعال کردن پلن',message:`پلن «${pl.title}» غیرفعال شود؟`,confirmText:'غیرفعال کن',danger:true}))return;if(g)g.plans=g.plans.filter(x=>x.key!==b.dataset.mcRemovePlan);renderCatalogMobileWizard()}));
    sheet.querySelector('[data-mc-save]')?.addEventListener('click',async()=>{if(mobileCatalogUploadPending>0){showStatus('آپلود تصویر هنوز تمام نشده؛ چند لحظه صبر کن.','error');return}mcCollect();for(const st of [0,2,3]){const err=mcValidate(st);if(err){mobileCatalogStep=st;renderCatalogMobileWizard();showStatus(err,'error');return}}const bp=JSON.parse(JSON.stringify(w));bp.groups=(bp.groups||[]).map(g=>{delete g.key;g.plans=(g.plans||[]).map(pl=>{delete pl.key;return pl});return g});const ok=await adminAction('admin_catalog_save_blueprint',{blueprint:JSON.stringify(bp)});if(ok){try{localStorage.removeItem(`nx_mcw_${bp.id||'new'}`)}catch(_){}}});
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

function openCatalogAddService(){return openCatalogMobileWizard(0)}
function openCatalogAddGroup(){return openCatalogMobileOrganizer()}
function openCatalogAddPlan(){return openCatalogMobileOrganizer()}

/* Legacy Products / Categories / Variants renderers removed in v2.8.0. Catalog Studio is the only product UI. */
function renderAdminCustomers(){const orders=adminState.orders||[],seen=new Set(),recent=[];for(const o of orders){const uid=Number(o.user_id||0);if(uid>0&&!seen.has(uid)){seen.add(uid);recent.push({id:uid,name:o.customer_name||o.first_name||o.username||('کاربر #'+uid),username:o.username||'',telegram_id:o.telegram_id||0,orders:orders.filter(x=>Number(x.user_id||0)===uid).length})}}return `<article class="admin-card vy-customer-hub"><div class="admin-card-head"><span class="admin-card-icon">👥</span><div><h3>Customer 360</h3><p class="muted">پروفایل، سفارش‌ها، تراکنش‌ها و اعتبار مشتری را یکجا ببین.</p></div></div><div class="vy-customer-actions"><label><span>User ID داخلی</span><div><input id="adminCustomerId" type="number" min="1" inputmode="numeric" placeholder="مثلاً 42"><button class="primary" data-admin-customer-open>باز کردن</button></div></label><label><span>تغییر اعتبار با Telegram ID</span><div><input id="adminCustomerTid" type="number" inputmode="numeric" placeholder="Telegram ID"><input id="adminCustomerAmount" type="number" inputmode="numeric" placeholder="+50000 یا -20000"><button class="secondary" data-admin-customer-balance>اعمال</button></div></label></div></article><article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">🕘</span><div><h3>مشتری‌های اخیر</h3><p class="muted">از سفارش‌های اخیر، برای دسترسی سریع.</p></div></div>${recent.length?`<div class="vy-customer-list">${recent.slice(0,20).map(u=>`<button data-admin-customer-id="${u.id}"><span class="vy-customer-avatar">${esc(String(u.name||'?').slice(0,1).toUpperCase())}</span><div><b>${esc(u.name)}</b><small>User #${u.id}${u.username?' · @'+esc(u.username):''} · ${nf(u.orders)} سفارش</small></div><em>مشاهده</em></button>`).join('')}</div>`:'<div class="u-empty"><div class="u-empty-icon">👥</div><h3>هنوز مشتری فعالی نیست</h3><p>با ثبت سفارش، مشتری‌ها اینجا ظاهر می‌شوند.</p></div>'}</article>`}
async function openAdminCustomer360(uid){uid=Number(uid||0);if(uid<=0)return showStatus('User ID معتبر وارد کن','error');try{const r=await api('admin_customer_view',{user_id:uid}),u=r.user||{},cs=r.customer_stats||{},orders=r.orders||[],tx=r.transactions||[];const body=`<div class="vy-customer-360"><div class="vy-customer-hero"><span>${esc(String(u.first_name||u.username||'?').slice(0,1).toUpperCase())}</span><div><small>CUSTOMER 360</small><h3>${esc(u.first_name||u.username||'کاربر')}</h3><p>User #${nf(u.id||0)} · Telegram ${esc(u.telegram_id||'—')}${u.username?' · @'+esc(u.username):''}</p></div></div><div class="dashboard-quick-stats"><div class="dq-stat"><b>${fmt(u.balance||0)}</b><span>موجودی</span></div><div class="dq-stat"><b>${fmt(r.total_spent||0)}</b><span>کل خرید</span></div><div class="dq-stat"><b>${nf(orders.length)}</b><span>سفارش</span></div></div><section class="vy-c360-section"><h4>سفارش‌های اخیر</h4>${orders.slice(0,10).map(o=>`<div><b>#${nf(o.id)} · ${esc(o.display_name||o.product_name||'سفارش')}</b><span>${fmt(o.final_amount||0)} · ${esc(o.status_fa||o.status||'')}</span></div>`).join('')||'<p class="muted">سفارشی نیست.</p>'}</section><section class="vy-c360-section"><h4>تراکنش‌های اخیر</h4>${tx.slice(0,8).map(t=>`<div><b>${esc(t.type||t.kind||'تراکنش')}</b><span>${fmt(t.amount||0)} · ${esc(String(t.created_at||'').slice(0,16))}</span></div>`).join('')||'<p class="muted">تراکنشی نیست.</p>'}</section></div>`;BlueGateUI.openSheet({type:'fullscreen',eyebrow:'BLUEGATE ADMIN',title:'پروفایل مشتری',body,footer:`<button type="button" class="secondary" data-c360-close>بستن</button><button type="button" class="primary" data-c360-balance="${u.telegram_id||0}">تغییر اعتبار</button>`,onOpen:h=>{h.classList.add('vy-admin-parity-sheet');h.querySelector('[data-c360-close]')?.addEventListener('click',()=>BlueGateUI.closeSheet?.());h.querySelector('[data-c360-balance]')?.addEventListener('click',()=>{BlueGateUI.closeSheet?.();setAdminTab('customers');setTimeout(()=>{const tid=document.getElementById('adminCustomerTid');if(tid)tid.value=u.telegram_id||'';document.getElementById('adminCustomerAmount')?.focus()},80)})}})}catch(e){showStatus(e.message||'پروفایل مشتری باز نشد','error')}}

function renderAdminCoupons(){const c=adminState.coupons||[];return `<div class="admin-primary-action"><button class="primary wide" data-admin-add-coupon>＋ کد تخفیف جدید</button></div><article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">%</span><div><h3>کدهای تخفیف</h3><p class="muted">${nf(c.length)} کد · ${nf(c.filter(x=>Number(x.is_active)).length)} فعال</p></div></div>${c.length?c.map(cp=>couponRowHtml(cp)).join(''):'<div class="u-empty"><div class="u-empty-icon">%</div><h3>هنوز کد تخفیفی نداری</h3><p>برای کمپین بعدی یک کد جدید بساز.</p></div>'}</article>`}
function couponRowHtml(cp){const expired=cp.expires_at&&new Date(cp.expires_at)<new Date();const exhausted=Number(cp.max_uses)>0&&Number(cp.used_count)>=Number(cp.max_uses);const active=Number(cp.is_active)&&!expired&&!exhausted;return `<div class="admin-item coupon-row"><div class="admin-item-head"><div class="admin-item-thumb emoji-thumb"><span>${active?'%':expired?'⏱':'–'}</span></div><div class="admin-item-main"><h4>${esc(cp.code)} <span class="admin-id-badge">${cp.type==='percent'?'٪':'تومان'}</span></h4><p class="muted">${cp.type==='percent'?'درصد '+nf(cp.value):'مبلغ '+fmt(cp.value)} · استفاده: ${nf(cp.used_count)}${Number(cp.max_uses)>0?' از '+nf(cp.max_uses):' (نامحدود)'}${cp.expires_at?' · انقضا: '+esc(String(cp.expires_at).slice(0,16)):''}</p></div></div><div class="admin-actions"><span class="chip-mini chip-${active?'active':expired?'off':'featured'}">${active?'فعال':expired?'منقضی':exhausted?'تمام‌شده':'غیرفعال'}</span><button data-edit-coupon="${cp.id}">ویرایش</button><button data-admin-toggle-coupon="${cp.id}">${Number(cp.is_active)?'غیرفعال':'فعال'}</button><button class="danger" data-admin-delete-coupon="${cp.id}">حذف</button></div></div>`}
function renderAdminActivity(){const log=adminState.activity_log||[];const actionFa={delete_coupon:'حذف کد تخفیف',reorder_products:'مرتب‌سازی محصولات',reorder_categories:'مرتب‌سازی دسته‌ها',set_role:'تعیین نقش ادمین',remove_role:'حذف نقش ادمین',catalog_save_blueprint:'ویرایش کاتالوگ',catalog_move_group:'انتقال زیرسرویس',catalog_move_plan:'انتقال پلن',catalog_toggle_service:'تغییر وضعیت سرویس',catalog_save_category:'ویرایش دسته فروشگاه',catalog_v2_apply:'مرتب‌سازی اولیه کاتالوگ',catalog_v2_apply_one:'مرتب‌سازی محصول قدیمی',catalog_undo:'بازگشت آخرین تغییر'};return `<article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">≡</span><div><h3>فعالیت مدیران</h3><p class="muted">${nf(log.length)} اقدام اخیر</p></div></div>${log.length?`<div class="activity-list">${log.map(l=>`<div class="activity-row"><div class="activity-icon">•</div><div class="activity-info"><b>${esc(actionFa[l.action]||l.action)}</b>${l.entity_type?` <span class="admin-id-badge">${esc(l.entity_type)}${l.entity_id?': #'+nf(l.entity_id):''}</span>`:''}${l.details?` <small>${esc(l.details)}</small>`:''}<span class="muted"> · ${esc(l.created_at||'')}</span></div></div>`).join('')}</div>`:'<div class="u-empty"><div class="u-empty-icon">≡</div><h3>فعالیتی ثبت نشده</h3></div>'}</article>`}
function renderAdminRoles(){if(!hasLicenseFeature('team_roles'))return `<article class="admin-card"><div class="pro-inline-alert"><b>تیم و نقش‌های مدیریتی ${proBadge('team_roles')}</b><span>این بخش در نسخه Pro فعال است.</span><button data-pro-feature="team_roles">ارتقا به Pro</button></div></article>`;const roles=adminState.admin_roles||[];return `<div class="admin-primary-action"><button class="primary wide" data-admin-add-role>＋ ادمین جدید</button></div><article class="admin-card"><div class="admin-card-head"><span class="admin-card-icon">◎</span><div><h3>نقش‌های مدیریتی</h3><p class="muted">${nf(roles.length)} مدیر دارای نقش</p></div></div>${roles.length?roles.map(r=>`<div class="admin-item role-row"><div class="admin-item-head"><div class="admin-item-thumb emoji-thumb"><span>${r.role==='full'?'★':r.role==='orders'?'▤':r.role==='products'?'◇':r.role==='finance'?'◫':'○'}</span></div><div class="admin-item-main"><h4>${esc(r.display_name||'بدون نام')} <span class="admin-id-badge">${esc(r.role)}</span></h4><p class="muted">Telegram ID: <code>${r.telegram_id}</code> · ${esc(String(r.created_at||'').slice(0,10))}</p></div></div><div class="admin-actions"><button data-edit-role="${r.id}">ویرایش</button><button class="danger" data-admin-remove-role="${r.telegram_id}">حذف نقش</button></div></div>`).join(''):'<div class="u-empty"><div class="u-empty-icon">◎</div><h3>نقش اضافه‌ای تعریف نشده</h3><p>ادمین‌های اصلی config همچنان دسترسی کامل دارند.</p></div>'}</article>`}
function renderAdminInventory(){return `<div style="display:flex;margin-bottom:16px;padding:0 4px"><button class="primary" style="flex:1" data-admin-add-inventory>➕ انبار جدید</button></div>`+(adminState.inventory||[]).map(i=>`<div class="admin-item"><h4>#${i.id} ${esc(i.product_name)} ${i.variant_title?' / '+esc(i.variant_title):''}</h4><p class="muted">وضعیت: ${esc(i.status)} | ${esc(String(i.content).slice(0,80))}</p><div class="admin-actions"><button data-edit-inventory="${i.id}">ویرایش کامل</button><button class="danger" data-admin-delete-inventory="${i.id}">حذف امن</button><button class="danger" data-admin-hard-delete-inventory="${i.id}">حذف کامل</button></div></div>`).join('')}
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
  const dbWallets=Array.isArray(st.crypto_wallets)?st.crypto_wallets:[];
  // Canonical source is the crypto_wallets DB table. Legacy pipe text is fallback only.
  adminUiWallets=(dbWallets.length?dbWallets:parsePipeLines(st.crypto_wallets_text||'', ['title','network','asset','address','rate_symbol','is_active','sort_order'])).map(normalizeAdminCryptoWallet);
  adminUiRates=parsePipeLines(st.crypto_manual_rates_text||'USDT|0\nTRX|0\nTON|0', ['asset','rate_toman']);
}
function cryptoWalletDbCardsHtml(){
  const rows=(Array.isArray(adminState?.settings?.crypto_wallets)?adminState.settings.crypto_wallets:[]).map(normalizeAdminCryptoWallet);
  if(!rows.length)return `<div class="crypto-wallet-empty-mini"><span>🪙</span><b>هنوز Wallet رمزارزی ثبت نشده</b><small>Wallet جدید را اضافه کن؛ بعد از ذخیره همین‌جا قابل مشاهده و ویرایش است.</small></div>`;
  return paymentListHtml(rows,'wallet');
}
function walletById(id){id=Number(id||0);return (adminUiWallets||[]).find(x=>Number(x.id||0)===id)||(adminState?.settings?.crypto_wallets||[]).find(x=>Number(x.id||0)===id)||null}
function walletIndexById(id){id=Number(id||0);return (adminUiWallets||[]).findIndex(x=>Number(x.id||0)===id)}
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
      const net=(it.network||'TRC20').toUpperCase(), asset=(it.asset||'USDT').toUpperCase(), addr=it.address||'';
      const addrDisplay=addr?(addr.slice(0,7)+'…'+addr.slice(-5)):'بدون آدرس';
      const isActive=String(it.is_active??'1')!=='0';
      const track=it.tracking_supported!==undefined?!!it.tracking_supported:walletMiniTracking(asset,net).supported;
      const provider=it.tracking_provider||walletMiniTracking(asset,net).provider;
      return `<article class="crypto-wallet-card-mini ${isActive?'':'is-off'}">
        <div class="crypto-wallet-card-head"><div class="crypto-coin-mark">${walletAssetIcon(asset)}</div><div><b>${esc(it.title||asset)}</b><small>${esc(asset)} · ${esc(net)}</small></div><span class="chip-mini ${isActive?'chip-active':'chip-off'}">${isActive?'فعال':'غیرفعال'}</span></div>
        <code class="crypto-wallet-address-mini">${esc(addrDisplay)}</code>
        <div class="crypto-wallet-meta-mini"><span class="${track?'auto':'manual'}">${track?'● پیگیری خودکار':'● بررسی دستی'}</span><small>${esc(provider)}</small><small>${nf(it.min_confirmations||1)} تأیید</small></div>
        <div class="crypto-wallet-actions-mini"><button class="secondary" data-wallet-edit-id="${Number(it.id||0)}" data-builder-edit="wallet:${i}">✏️ ویرایش</button><button class="secondary ghost" data-copy-wallet-address="${esc(addr)}">کپی آدرس</button><button class="danger ghost" data-wallet-delete-id="${Number(it.id||0)}" data-builder-del="wallet:${i}">حذف</button></div>
      </article>`;
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
    `<label class="full mini-stack-field"><span>عنوان کارت</span><input id="bc_title" value="${esc(c.title||'')}" placeholder="مثلاً کارت اصلی"></label>`,
    `<label class="full mini-stack-field"><span>شماره کارت</span><input id="bc_card" value="${esc(c.card||'')}" inputmode="numeric" maxlength="19" placeholder="6037 ・・・・ ・・・・ ・・・・"><div id="bc_card_val" class="valid-indicator warn"></div></label>`,
    `<label class="full mini-stack-field"><span>نام صاحب کارت</span><input id="bc_owner" value="${esc(c.owner||'')}" placeholder="نام و نام خانوادگی"></label>`,
    `<label class="full mini-stack-field"><span>شماره شبا <small>اختیاری</small></span><input id="bc_sheba" value="${esc(c.sheba||'')}" maxlength="26" placeholder="IR••••••••••••••••••••••••"><div id="bc_sheba_val" class="valid-indicator warn"></div></label>`
  ],async()=>{
    const obj={title:val('bc_title'),card:val('bc_card'),owner:val('bc_owner'),sheba:val('bc_sheba')};
    if(!obj.card&&!obj.owner) throw new Error('شماره کارت یا صاحب کارت را وارد کن');
    if(index===null)adminUiCards.push(obj);else adminUiCards[index]=obj;
    syncPaymentBuilders(); showStatus('کارت ذخیره شد');
  });
  setupCardValidation();
}
let cachedCryptoRates = null;

const MINI_CRYPTO_PRESETS={
  USDT:{icon:'₮',networks:[['TRC20','TRON'],['ERC20','Ethereum'],['BEP20','BNB Chain']]},
  TRX:{icon:'◆',networks:[['TRON','TRON']]},
  TON:{icon:'💎',networks:[['TON','TON']]},
  ETH:{icon:'Ξ',networks:[['ETHEREUM','Ethereum']]},
  BNB:{icon:'⬡',networks:[['BSC','BNB Chain']]},
  BTC:{icon:'₿',networks:[['BITCOIN','Bitcoin']]}
};
function walletAssetIcon(asset){return MINI_CRYPTO_PRESETS[String(asset||'').toUpperCase()]?.icon||'◈'}
function walletMiniTracking(asset,network){asset=String(asset||'').toUpperCase();network=String(network||'').toUpperCase();let provider='';let supported=false;if((asset==='USDT'&&['TRC20','ERC20','BEP20'].includes(network))||(asset==='TRX'&&network==='TRON')){supported=true;provider=['TRC20','TRON'].includes(network)?'TronScan':network==='ERC20'?'Ethereum RPC':'BSC RPC'}else if(asset==='TON'&&network==='TON'){supported=true;provider='TON Center'}else if(asset==='ETH'&&['ETHEREUM','ERC20'].includes(network)){supported=true;provider='Ethereum RPC'}else if(asset==='BNB'&&['BSC','BEP20'].includes(network)){supported=true;provider='BSC RPC'}else if(asset==='BTC'&&['BITCOIN','BTC'].includes(network)){supported=true;provider='Blockstream'}return{supported,provider:provider||'Manual'}}
function cryptoAssetPickerHtml(selected){return `<div class="crypto-choice-grid asset-grid">${Object.entries(MINI_CRYPTO_PRESETS).map(([a,c])=>`<button type="button" data-bw-asset-choice="${a}" class="${a===selected?'active':''}"><span>${c.icon}</span><b>${a}</b></button>`).join('')}</div>`}
function cryptoNetworkPickerHtml(asset,selected){const rows=MINI_CRYPTO_PRESETS[asset]?.networks||[];return `<div class="crypto-choice-grid network-grid" id="bw_network_choices">${rows.map(([n,label])=>`<button type="button" data-bw-network-choice="${n}" class="${n===selected?'active':''}"><b>${n}</b><small>${label}</small></button>`).join('')}</div>`}
function setupWalletValidation(){
  setTimeout(async()=>{
    const assetInput=$('bw_asset'), netInput=$('bw_network'), rateInput=$('bw_rate'), addrInput=$('bw_address'), rateInfo=$('bw_rate_info');
    const host=assetInput?.closest('.presentation-body')||document;
    if(!cachedCryptoRates){try{const res=await api('get_crypto_rates');if(res?.rates)cachedCryptoRates=res.rates}catch(_){}}
    const showRate=()=>{const a=(assetInput?.value||'USDT').toUpperCase(), r=cachedCryptoRates?.[a], rate=typeof r==='object'?Number(r.rate||0):Number(r||0);const tr=walletMiniTracking(a,netInput?.value);if(rateInfo)rateInfo.innerHTML=`<span class="tracking-dot ${tr.supported?'ok':'bad'}"></span><b>${tr.supported?'پیگیری خودکار':'بررسی دستی'}</b> · ${esc(tr.provider)}${rate?`<small> · نرخ: ${nf(rate)} تومان</small>`:''}`;if(rateInput)rateInput.value=a};
    const renderNetworks=(asset,wanted='')=>{const cfg=MINI_CRYPTO_PRESETS[asset]||MINI_CRYPTO_PRESETS.USDT;const chosen=cfg.networks.some(x=>x[0]===wanted)?wanted:cfg.networks[0][0];if(netInput)netInput.value=chosen;const box=$('bw_network_choices');if(box)box.outerHTML=cryptoNetworkPickerHtml(asset,chosen);bindNetwork();showRate();validateAddress()};
    const bindNetwork=()=>{host.querySelectorAll('[data-bw-network-choice]').forEach(btn=>btn.addEventListener('click',()=>{host.querySelectorAll('[data-bw-network-choice]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');if(netInput)netInput.value=btn.dataset.bwNetworkChoice;showRate();validateAddress()}))};
    const validateAddress=()=>{const addr=(addrInput?.value||'').trim(), net=(netInput?.value||'').toUpperCase(), ind=$('bw_address_val');if(!ind)return;if(!addr){ind.className='valid-indicator warn';ind.textContent='⚠ آدرس کیف پول را وارد کنید';return}let ok=addr.length>=10;if(['ERC20','ETHEREUM','BEP20','BSC'].includes(net))ok=/^0x[a-fA-F0-9]{40}$/.test(addr);else if(net==='BITCOIN')ok=/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{20,}$/.test(addr);ind.className='valid-indicator '+(ok?'ok':'warn');ind.textContent=ok?'✓ فرمت آدرس قابل قبول است':'⚠ فرمت آدرس با شبکه انتخاب‌شده هماهنگ نیست'};
    host.querySelectorAll('[data-bw-asset-choice]').forEach(btn=>btn.addEventListener('click',()=>{host.querySelectorAll('[data-bw-asset-choice]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');const a=btn.dataset.bwAssetChoice;if(assetInput)assetInput.value=a;renderNetworks(a,'')}));
    bindNetwork();addrInput?.addEventListener('input',validateAddress);showRate();validateAddress();
  },50);
}
async function saveMiniCryptoWallet(index,obj){
  const existing=index===null?null:adminUiWallets[index];
  const r=await api('admin_crypto_wallet_save',{wallet_id:Number(existing?.id||0),...obj});
  adminState.settings=adminState.settings||{};adminState.settings.crypto_wallets=r.wallets||[];adminState.settings.crypto_wallets_text=r.crypto_wallets_text||'';parseSettingsBuilders();showStatus('کیف پول ذخیره شد');return r;
}
function openWalletBuilder(index=null){
  const w=index===null?{network:'TRC20',asset:'USDT',rate_symbol:'USDT',is_active:'1',sort_order:'99',min_confirmations:'1'}:adminUiWallets[index]||{};
  const asset=MINI_CRYPTO_PRESETS[(w.asset||'USDT').toUpperCase()]?(w.asset||'USDT').toUpperCase():'USDT';
  const allowed=MINI_CRYPTO_PRESETS[asset].networks.map(x=>x[0]);const network=allowed.includes((w.network||'').toUpperCase())?(w.network||'').toUpperCase():allowed[0];
  openEdit(index===null?'افزودن کیف پول رمزارز':'ویرایش کیف پول رمزارز',[
    `<div class="crypto-wallet-editor"><input type="hidden" id="bw_asset" value="${asset}"><input type="hidden" id="bw_network" value="${network}"><input type="hidden" id="bw_rate" value="${asset}"><section><span class="crypto-editor-label">ارز رمزارزی</span>${cryptoAssetPickerHtml(asset)}<div id="bw_rate_info" class="crypto-tracking-info"></div></section><section><span class="crypto-editor-label">شبکه کیف پول</span>${cryptoNetworkPickerHtml(asset,network)}</section><label class="mini-stack-field"><span>عنوان Wallet</span><input id="bw_title" value="${esc(w.title||'')}" placeholder="مثلاً تتر اصلی"></label><label class="mini-stack-field"><span>آدرس Wallet</span><textarea id="bw_address" dir="ltr" placeholder="آدرس دریافت روی شبکه انتخاب‌شده">${esc(w.address||'')}</textarea><div id="bw_address_val" class="valid-indicator warn"></div></label><div class="crypto-wallet-mini-options"><label><span>تعداد تأیید</span><input id="bw_confirm" type="number" min="1" max="50" value="${esc(w.min_confirmations||1)}"></label><label><span>ترتیب</span><input id="bw_sort" type="number" value="${esc(w.sort_order||99)}"></label></div><label class="switch-line crypto-active-switch"><span>Wallet فعال باشد</span><input id="bw_active" type="checkbox" ${String(w.is_active??'1')!=='0'?'checked':''}></label></div>`
  ],async()=>{
    const obj={title:val('bw_title'),network:val('bw_network'),asset:val('bw_asset'),address:val('bw_address'),rate_symbol:val('bw_rate'),is_active:val('bw_active')?1:0,sort_order:Number(val('bw_sort')||99),min_confirmations:Number(val('bw_confirm')||1)};
    if(!obj.address)throw new Error('آدرس Wallet را وارد کن');const tr=walletMiniTracking(obj.asset,obj.network);if(!tr.supported)throw new Error('این ارز/شبکه قابلیت پیگیری خودکار ندارد.');
    await saveMiniCryptoWallet(index,obj); renderAdmin();
  });setupWalletValidation();
}
function openRateBuilder(index=null){const r=index===null?{asset:'USDT',rate_toman:'0'}:adminUiRates[index]||{};openEdit(index===null?'افزودن نرخ دستی':'ویرایش نرخ دستی',[field('نماد ارز',`<input id="br_asset" value="${esc((r.asset||'USDT').toUpperCase())}" placeholder="USDT">`),field('قیمت تومان',`<input id="br_rate" value="${esc(r.rate_toman||0)}" inputmode="decimal" placeholder="95000">`)],async()=>{const obj={asset:val('br_asset'),rate_toman:val('br_rate')}; if(!obj.asset) throw new Error('نماد ارز را وارد کن'); if(index===null)adminUiRates.push(obj);else adminUiRates[index]=obj; syncPaymentBuilders(); showStatus('نرخ دستی ذخیره شد')})}
const adminPaletteColors=['#8b5cf6','#2563eb','#8b5cf6','#22c55e','#14b8a6','#f59e0b','#f97316','#ef4444','#ec4899','#64748b'];
function colorPicker(id,value){return `<div class="color-picker-row"><input id="${id}" type="color" value="${esc(value)}"><input id="${id}_text" value="${esc(value)}" placeholder="#8b5cf6" data-color-mirror="${id}"></div>`}
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
      <div class="admin-actions"><button class="primary" data-admin-backup-create>ساخت بکاپ روی سرور</button><button class="success" ${hasLicenseFeature('advanced_backups')?'data-admin-backup-sendbot':'data-pro-feature="advanced_backups"'}>ساخت و ارسال در چت بات ${proBadge('advanced_backups')}</button></div>
      <div class="hint-box">مسیر SFTP روی VPS: <code>/var/www/bluegate-platform/storage/backups/</code></div>
    </article>
    <article class="admin-card danger-zone">
      <h3>♻️ Restore بکاپ ${proBadge('advanced_backups')}</h3>${!hasLicenseFeature('advanced_backups')?`<div class="pro-inline-alert"><b>Restore و Export حرفه‌ای</b><span>در Free بکاپ محلی می‌سازی؛ بازیابی، دانلود و ارسال به تلگرام در Pro فعال است.</span><button data-pro-feature="advanced_backups">ارتقا به Pro</button></div>`:''}
      <p class="muted">Restore کل دیتابیس فعلی را جایگزین می‌کند. قبل از Restore یک safety backup خودکار ساخته می‌شود.</p>
      <input id="backupUpload" type="file" accept=".json,.gz,.json.gz">
      <div class="admin-actions"><button class="danger" ${hasLicenseFeature('advanced_backups')?'data-admin-backup-upload':'data-pro-feature="advanced_backups"'}>Upload & Restore</button></div>
      <div class="hint-box">راه پایدارتر: در چت بات دستور <code>/restore_backup</code> را بزن و فایل <code>.json.gz</code> را همانجا ارسال کن.</div>
    </article>
    <article class="admin-card">
      <h3>🗂 بکاپ‌های روی سرور</h3>
      ${rows.length?rows.map(b=>`<div class="admin-item"><h4>${esc(b.filename)}</h4><p class="muted">${bytesLabel(b.size)} · ${esc(b.created_at||'')}</p><div class="admin-actions"><button class="secondary" ${hasLicenseFeature('advanced_backups')?`data-open-url="${esc(b.download_url||'')}"`:`data-pro-feature="advanced_backups"`}>دانلود ${proBadge('advanced_backups')}</button><button class="warning" ${hasLicenseFeature('advanced_backups')?`data-admin-backup-restore-server="${esc(b.filename)}"`:`data-pro-feature="advanced_backups"`}>Restore ${proBadge('advanced_backups')}</button><button class="danger" data-admin-backup-delete="${esc(b.filename)}">حذف</button></div></div>`).join(''):'<p class="muted">هنوز بکاپی روی سرور نیست.</p>'}
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
    <div class="settings-subtab-pane ${isPay?'':'hidden'}" data-pane="payments"><button class="crypto-wallet-shortcut" data-settings-subtab="crypto"><span>🪙</span><div><b>کیف پول‌های رمزارز</b><small>${nf((s.crypto_wallets||[]).length)} Wallet ثبت‌شده · مدیریت و ویرایش</small></div><i>‹</i></button>
      <article class="settings-card admin-card">
        <div class="admin-card-head"><div class="admin-card-icon"><span>💳</span></div><div><h3>روش‌های فعال پرداخت</h3><p class="muted">روش‌هایی که در مرحله نهایی فاکتور به کاربر پیشنهاد می‌شوند.</p></div></div>
        <div class="settings-toggles">
          <label class="pretty-switch"><input id="as_pay_wallet" type="checkbox" ${walletActive?'checked':''}><span></span><b>اعتبار BlueGate داخلی</b><small>کم‌کردن مبلغ فاکتور از موجودی</small></label>
          <label class="pretty-switch"><input id="as_pay_card" type="checkbox" ${cardActive?'checked':''}><span></span><b>کارت به کارت</b><small>پرداخت دستی با رسید</small></label>
          <label class="pretty-switch"><input id="as_pay_stars" type="checkbox" ${starsActive?'checked':''}><span></span><b>Telegram Stars</b><small>فاکتور مستقیم داخل تلگرام</small></label>
          <label class="pretty-switch"><input id="as_pay_crypto" type="checkbox" ${cryptoActive?'checked':''}><span></span><b>پرداخت رمزارز</b><small>ولت دستی + بررسی TXID</small></label>
        </div>
        <div class="form-grid settings-form" style="margin-top:14px">
          <label><span>حالت نرخ Stars</span><select id="as_stars_mode"><option value="auto" ${s.stars_rate_mode!=='manual'?'selected':''}>خودکار با USDT</option><option value="manual" ${s.stars_rate_mode==='manual'?'selected':''}>دستی</option></select></label><label><span>Base هر Star (USDT)</span><input id="as_stars_base_usdt" value="${esc(s.stars_base_usdt||0.016)}" inputmode="decimal"></label><label><span>Markup Stars %</span><input id="as_stars_markup" value="${esc(s.stars_rate_markup_percent||0)}" inputmode="decimal"></label><label><span>Fallback دستی تومان</span><input id="as_stars_rate" value="${esc(s.stars_rate_manual_toman||3200)}" inputmode="numeric"></label><div class="full rate-live-box"><b>⭐ نرخ فعلی: ${nf(s.stars_rate_toman||0)} تومان / Star</b><small>${esc(s.stars_rate_meta?.source||'manual')} · USDT ${nf(s.stars_rate_meta?.usdt_rate||0)} تومان</small></div>
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
        <div class="admin-card-head crypto-wallet-admin-head"><div class="admin-card-icon"><span>🪙</span></div><div><h3>کیف پول‌های رمزارز</h3><p class="muted">${nf((s.crypto_wallets||[]).length)} Wallet ثبت‌شده · Walletهای واقعی دیتابیس پایین نمایش داده می‌شوند.</p></div><button type="button" class="secondary crypto-wallet-refresh-mini" data-refresh-wallet-list>↻ بروزرسانی</button></div>
        <div class="form-grid settings-form compact-form">
          <label><span>منبع نرخ</span><select id="as_crypto_source"><option value="auto">خودکار: Wallex → Ramzinex → Nobitex → دستی/cache</option><option value="wallex">اولویت با Wallex + fallback</option><option value="ramzinex">اولویت با Ramzinex + fallback</option><option value="nobitex">اولویت با Nobitex + fallback</option><option value="manual">فقط نرخ دستی</option></select></label>
          <label><span>درصد احتیاط نرخ</span><input id="as_crypto_markup" value="${esc(s.crypto_rate_markup_percent||1)}" inputmode="decimal" placeholder="مثلاً 1"></label><label><span>رفرش نرخ هر چند ثانیه</span><input id="as_crypto_refresh_interval" value="${esc(s.crypto_rate_refresh_interval_seconds||600)}" inputmode="numeric" placeholder="60"></label>
          <label class="pretty-switch inline" style="grid-column:1/-1"><input id="as_crypto_notify" type="checkbox" ${s.crypto_notify_rate_fail!==false?'checked':''}><span></span><b>اعلان خطای نرخ به ادمین</b></label>
        </div>
        <input type="hidden" id="as_crypto_wallets">
        <div id="walletBuilderList">${cryptoWalletDbCardsHtml()}</div>
        <button class="primary wide crypto-add-wallet-btn" data-builder-add="wallet">＋ افزودن کیف پول رمزارز</button>
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
          <label><span>رنگ اصلی</span>${colorPicker('as_theme',s.theme_color||'#8b5cf6')}${settingsPalette('as_theme')}</label>
          <label class="pretty-switch inline"><input id="as_btn_enabled" type="checkbox" ${s.button_colors_enabled?'checked':''}><span></span><b>رنگی بودن دکمه‌های Mini App</b></label>
          <label><span>دکمه اصلی</span>${colorPicker('as_primary',bc.primary||'#8b5cf6')}${settingsPalette('as_primary')}</label>
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
          <button type="button" class="primary" id="btnAddSpinReward" style="background:linear-gradient(135deg,#00f2fe,#8b5cf6);color:#000;font-size:14px;padding:8px 14px;border-radius:12px;font-weight:900;border:0;cursor:pointer;">➕ افزودن جایزه جدید</button>
        </div>

        <div style="margin:14px 0 16px;">
          <label style="display:block;font-size:14px;color:var(--muted);margin-bottom:6px;">تعداد زیرمجموعه برای دریافت ۱ شانس گردونه:</label>
          <input id="as_spin_every" value="${esc(s.spin_referrals_per_chance||5)}" inputmode="numeric" style="max-width:240px;">
        </div>
        <div class="referral-reward-settings-grid">
          <div class="referral-reward-setting"><label for="as_start_reward">💸 پاداش هر دعوت معتبر (تومان)</label><input id="as_start_reward" type="number" min="0" step="1000" value="${esc(s.start_reward??2000)}" inputmode="numeric"><small>اعتبار معرف برای هر دعوت معتبر.</small></div>
          <div class="referral-reward-setting"><label for="as_purchase_reward">🛍 پاداش پایه خرید معرف (تومان)</label><input id="as_purchase_reward" type="number" min="0" step="1000" value="${esc(s.purchase_reward??10000)}" inputmode="numeric"><small>صفر یعنی غیرفعال.</small></div>
          <div class="referral-reward-setting"><label for="as_custom_code_min">🔗 حداقل دعوت برای کد اختصاصی</label><input id="as_custom_code_min" type="number" min="0" step="1" value="${esc(s.custom_code_min_referrals??3)}" inputmode="numeric"><small>حداقل زیرمجموعه معتبر برای تغییر کد دعوت.</small></div>
        </div><p class="muted referral-reward-settings-note">این تنظیمات بین وب، Mini App و بات مشترک‌اند. بعد از تغییر «ذخیره همه تنظیمات» را بزنید.</p>

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
function productOptions(selected=''){return `<option value="">انتخاب محصول</option>${(adminState.products||[]).map(p=>`<option value="${p.id}" ${String(selected||'')===String(p.id)?'selected':''}>#${p.id} ${esc(p.name||'محصول')}</option>`).join('')}`}
function variantOptions(selected='',productId=''){return `<option value="">بدون پلن</option>${(adminState.variants||[]).filter(v=>!productId||String(v.product_id)===String(productId)).map(v=>`<option value="${v.id}" ${String(selected||'')===String(v.id)?'selected':''}>#${v.id} ${esc(v.product_name||'')} — ${esc(v.title||'پلن')}</option>`).join('')}`}
function openAddVariant(productId=0){const p=(adminState.products||[]).find(x=>Number(x.id)===Number(productId));openEdit('پلن جدید',[{title:p?.name||'محصول',fields:[{id:'av_product',label:'محصول',type:'select',options:productOptions(productId)},{id:'av_title',label:'نام پلن',placeholder:'مثلاً 30 روزه'},{id:'av_price',label:'قیمت تومان',type:'number',props:'inputmode="numeric" min="0"',value:0},{id:'av_days',label:'مدت (روز)',type:'number',props:'inputmode="numeric" min="0"',value:30},{id:'av_discount',label:'تخفیف پلن ٪',type:'number',props:'inputmode="numeric" min="0" max="100"',value:0},{id:'av_desc',label:'توضیحات',type:'textarea'}]}],async()=>{const pid=Number(val('av_product')||0),title=String(val('av_title')||'').trim();if(pid<=0||!title)throw new Error('محصول و نام پلن الزامی است.');return adminAction('admin_add_variant',{product_id:pid,title,price:Number(val('av_price')||0),price_currency:'IRT',duration_days:Number(val('av_days')||0),discount_percent:Number(val('av_discount')||0),description:val('av_desc')})})}
function catOptions(selected=''){return `<option value="">همه دسته‌بندی‌ها</option>${(adminState.categories||[]).map(c=>`<option value="${c.id}" ${String(selected||'')===String(c.id)?'selected':''}>${esc(c.emoji||'')} ${esc(c.title||'دسته')}</option>`).join('')}`}
function openAddInventory(){openEdit('انبار جدید',[{title:'محصول و پلن',fields:[{id:'ai_product',label:'محصول',type:'select',options:productOptions()},{id:'ai_variant',label:'پلن مرتبط',type:'select',options:variantOptions(),help:'اختیاری؛ برای محصولاتی که پلن جدا دارند.'}]},{title:'محتوای تحویل',fields:[{id:'ai_content',label:'آیتم‌ها',type:'textarea',placeholder:'هر آیتم را در یک خط وارد کن',help:'هر خط به‌عنوان یک آیتم مستقل در انبار ذخیره می‌شود.'}]}],async()=>{const pid=Number(val('ai_product')||0),content=String(val('ai_content')||'').trim();if(pid<=0)throw new Error('محصول را انتخاب کن.');if(!content)throw new Error('حداقل یک آیتم برای انبار وارد کن.');return adminAction('admin_add_inventory',{product_id:pid,variant_id:val('ai_variant')||null,content})});setTimeout(()=>{const p=document.getElementById('ai_product'),v=document.getElementById('ai_variant');p?.addEventListener('change',()=>{if(v)v.innerHTML=variantOptions('',p.value)})},0)}

function editInventory(id){const i=adminState.inventory.find(x=>Number(x.id)===Number(id));if(!i)return;openEdit(`ویرایش آیتم انبار #${id}`,[{title:'جزئیات آیتم',fields:[{id:'ei_product',label:'محصول مرتبط',type:'select',options:productOptions(i.product_id)},{id:'ei_variant',label:'پلن مرتبط',type:'select',options:variantOptions(i.variant_id)},{id:'ei_status',label:'وضعیت فروش',type:'select',options:`<option value="available" ${i.status==='available'?'selected':''}>available</option><option value="reserved" ${i.status==='reserved'?'selected':''}>reserved</option><option value="delivered" ${i.status==='delivered'?'selected':''}>delivered</option><option value="disabled" ${i.status==='disabled'?'selected':''}>disabled</option>`},{id:'ei_content',label:'محتوای آیتم',type:'textarea',value:i.content||''}]}],async()=>adminAction('admin_update_inventory',{inventory_id:id,product_id:val('ei_product'),variant_id:val('ei_variant'),status:val('ei_status'),content:val('ei_content')}))}
function openAddCoupon(){openEdit('کد تخفیف جدید',[{title:'مشخصات تخفیف',fields:[{id:'acp_code',label:'کد تخفیف',placeholder:'مثلاً BLUEGATE10',help:'فقط حروف انگلیسی، عدد، خط تیره و زیرخط.'},{id:'acp_type',label:'نوع تخفیف',type:'select',options:`<option value="percent" selected>درصدی (٪)</option><option value="fixed">مبلغ ثابت (تومان)</option>`},{id:'acp_value',label:'مقدار',type:'number',props:'inputmode="numeric" min="1"',value:10},{id:'acp_min',label:'حداقل مبلغ سفارش',type:'number',props:'inputmode="numeric" min="0"',value:0,placeholder:'۰ = بدون حداقل'}]},{title:'محدودیت‌ها',fields:[{id:'acp_max',label:'کل سقف استفاده',type:'number',props:'inputmode="numeric" min="0"',value:0,placeholder:'۰ = نامحدود'},{id:'acp_per_user',label:'سقف هر کاربر',type:'number',props:'inputmode="numeric" min="1"',value:1},{id:'acp_cat',label:'دسته‌بندی',type:'select',options:catOptions(),help:'اختیاری؛ خالی یعنی همه محصولات.'},{id:'acp_expires',label:'تاریخ انقضا',type:'datetime-local'}]}],async()=>{const code=String(val('acp_code')||'').trim().toUpperCase(),type=val('acp_type'),value=Number(val('acp_value')||0);if(!code)throw new Error('کد تخفیف را وارد کن.');if(!/^[A-Z0-9_-]+$/.test(code))throw new Error('کد تخفیف فقط می‌تواند شامل حروف انگلیسی، عدد، - و _ باشد.');if(value<=0)throw new Error('مقدار تخفیف باید بیشتر از صفر باشد.');if(type==='percent'&&value>100)throw new Error('تخفیف درصدی نمی‌تواند بیشتر از ۱۰۰٪ باشد.');return adminAction('admin_add_coupon',{code,discount_type:type,discount_value:value,min_order_amount:Number(val('acp_min')||0),max_uses:Number(val('acp_max')||0),max_uses_per_user:Math.max(1,Number(val('acp_per_user')||1)),category_id:val('acp_cat')||null,expires_at:val('acp_expires')})})}
function openAddRole(){openEdit('افزودن نقش ادمین',[{title:'سطح دسترسی',fields:[{id:'ar_tid',label:'Telegram ID',type:'number',props:'inputmode="numeric"',placeholder:'مثلاً: 123456789'},{id:'ar_name',label:'نام نمایشی'},{id:'ar_role',label:'نوع دسترسی',type:'select',options:`<option value="full">ادمین کامل</option><option value="orders">فقط سفارش‌ها</option><option value="products">فقط محصولات</option><option value="finance">فقط مالی</option>`}]}],async()=>adminAction('admin_set_role',{telegram_id:val('ar_tid'),role:val('ar_role'),display_name:val('ar_name')}))}
async function adminAction(action,payload={}){
  try{
    const result=await api(action,payload);
    if(!result || result.ok===false) throw new Error(result?.message||'خطا در ذخیره');
    // Many infrastructure/advanced endpoints intentionally return a partial payload.
    // Always re-hydrate the complete admin state after mutations so Mini App controls stay functional.
    adminState=action==='admin_summary'?result:await api('admin_summary');
    $('userApp').classList.add('hidden');$('adminApp').classList.remove('hidden');
    closeEdit();
    applyTheme(adminState.settings||{});renderAdmin();showStatus('ذخیره شد');return true
  }catch(e){showStatus(e.message||'خطا در ذخیره','error');return false}
}
async function loadAfterAction(action,payload={}){try{state=await api(action,payload);const active=topMiniLayer();if(active==='appSheet')BlueGateUI?.closeSheet?.();applyTheme(state);renderUser();showStatus('انجام شد');syncTelegramBackButton();return true}catch(e){showStatus(e.message,'error');return false}}

// === Dedicated early admin-tab handler (capture) — fixes unresponsive admin navigation ===
document.addEventListener('click', function(e) {
  const tabBtn = e.target.closest('[data-admin-tab]');
  if (!tabBtn) return;
  if (!document.getElementById('adminApp') || document.getElementById('adminApp').classList.contains('hidden')) return;
  e.preventDefault();
  e.stopPropagation();
  const tab = tabBtn.dataset.adminTab;
  if (tab && typeof setAdminTab === 'function') {
    setAdminTab(tab);
  }
}, true);

document.addEventListener('click',async(e)=>{const t=e.target.closest('[data-admin-add-coupon],[data-admin-add-inventory],[data-admin-add-role],[data-admin-customer-open],[data-admin-customer-id],[data-admin-customer-balance]');if(!t)return;if(!document.getElementById('adminApp')||document.getElementById('adminApp').classList.contains('hidden'))return;e.preventDefault();e.stopPropagation();if(t.dataset.adminAddCoupon!==undefined){haptic?.('light');openAddCoupon();return}if(t.dataset.adminAddInventory!==undefined){haptic?.('light');openAddInventory();return}if(t.dataset.adminAddRole!==undefined){haptic?.('light');if(!hasLicenseFeature('team_roles')){showProUpgrade('team_roles');return}openAddRole();return}if(t.dataset.adminCustomerOpen!==undefined){openAdminCustomer360(Number(document.getElementById('adminCustomerId')?.value||0));return}if(t.dataset.adminCustomerId){openAdminCustomer360(Number(t.dataset.adminCustomerId));return}if(t.dataset.adminCustomerBalance!==undefined){const tid=Number(document.getElementById('adminCustomerTid')?.value||0),amount=Number(document.getElementById('adminCustomerAmount')?.value||0);if(tid<=0||!amount)return showStatus('Telegram ID و مبلغ معتبر وارد کن','error');if(await adminAction('admin_add_balance',{telegram_id:tid,amount})){showStatus('اعتبار مشتری تغییر کرد','success')}return}},true);

document.addEventListener('click',async(e)=>{
  const b=e.target.closest('[data-builder-add],[data-builder-edit],[data-builder-del],[data-wallet-edit-id],[data-wallet-delete-id],[data-copy-wallet-address],[data-refresh-wallet-list],[data-admin-color],#applyCustomColor,#applyAdminColor,[data-close-share],[data-share-tg-url],[data-share-copy-url],[data-share-native],[data-share-product],[data-wishlist-pid]');
  if(!b) return;
  e.preventDefault(); e.stopPropagation();
  if(b.id==='applyCustomColor'){
    const c=$('userCustomColor')?.value || '#8b5cf6';
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
  if(b.dataset.copyWalletAddress!==undefined){copyText(b.dataset.copyWalletAddress||'');showStatus('آدرس Wallet کپی شد');return;}
  if(b.dataset.walletEditId!==undefined){const i=walletIndexById(b.dataset.walletEditId);if(i<0){showStatus('Wallet در لیست فعلی پیدا نشد؛ لیست را بروزرسانی کن.','error');return}openWalletBuilder(i);return;}
  if(b.dataset.walletDeleteId!==undefined){const id=Number(b.dataset.walletDeleteId||0);if(!id)return showStatus('شناسه Wallet معتبر نیست','error');if(!await BlueGateUI.confirm({title:'حذف Wallet',message:'این Wallet از دیتابیس حذف شود؟',confirmText:'حذف',danger:true}))return;try{const r=await api('admin_crypto_wallet_delete',{wallet_id:id});adminState.settings.crypto_wallets=r.wallets||[];adminState.settings.crypto_wallets_text=r.crypto_wallets_text||'';parseSettingsBuilders();renderAdmin();showStatus('Wallet حذف شد')}catch(err){showStatus(err.message||'حذف Wallet انجام نشد','error')}return;}
  if(b.dataset.refreshWalletList!==undefined){try{adminState=await api('admin_summary');parseSettingsBuilders();renderAdmin();showStatus('Walletها از دیتابیس بروزرسانی شدند')}catch(err){showStatus(err.message||'بروزرسانی Walletها ناموفق بود','error')}return;}
  if(b.dataset.builderAdd){ if(b.dataset.builderAdd==='card')openCardBuilder(); if(b.dataset.builderAdd==='wallet')openWalletBuilder(); if(b.dataset.builderAdd==='rate')openRateBuilder(); return; }
  if(b.dataset.builderEdit){const [type,idx]=b.dataset.builderEdit.split(':'); const i=Number(idx); if(type==='card')openCardBuilder(i); if(type==='wallet')openWalletBuilder(i); if(type==='rate')openRateBuilder(i); return; }
  if(b.dataset.builderDel){const [type,idx]=b.dataset.builderDel.split(':');const i=Number(idx);if(!await BlueGateUI.confirm({title:'حذف مورد',message:'این مورد حذف شود؟',confirmText:'حذف',danger:true}))return;if(type==='wallet'){const w=adminUiWallets[i];if(w?.id){try{const r=await api('admin_crypto_wallet_delete',{wallet_id:Number(w.id)});adminState.settings=adminState.settings||{};adminState.settings.crypto_wallets=r.wallets||[];adminState.settings.crypto_wallets_text=r.crypto_wallets_text||'';parseSettingsBuilders();renderAdmin();showStatus('Wallet حذف شد')}catch(err){showStatus(err.message||'حذف Wallet انجام نشد','error')}return}adminUiWallets.splice(i,1)}if(type==='card')adminUiCards.splice(i,1);if(type==='rate')adminUiRates.splice(i,1);syncPaymentBuilders();showStatus('حذف شد');return;}
},true);
// Removed capture-phase palette persistence to server — palette is local-only now.

// Override applyTheme to prefer per-user theme when available
function applyTheme(data={}){
  const local = localStorage.getItem('blue_ref_color');
  const configuredAccent = (data && data.theme_color) || (data && data.settings && data.settings.theme_color) || '#4A8DFF';
  const configuredPrimary = data && (data.button_colors?.primary || (data.settings && data.settings.button_colors?.primary));
  // A device-local choice intentionally overrides the global accent and primary button color.
  const accent = local || configuredAccent;
  const primary = local || ((data && data.button_colors_enabled===false) ? configuredAccent : (configuredPrimary || configuredAccent));
  // Inline important tokens also win against stale cached legacy CSS during rollout.
  document.documentElement.style.setProperty('--accent', accent, 'important');
  document.documentElement.style.setProperty('--primary', primary, 'important');
  document.documentElement.style.setProperty('--u-accent', accent, 'important');
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
  const t=e.target.closest('button,a,[data-admin-tab],[data-settings-subtab],[data-admin-view-mode],[data-admin-action-sheet],[data-tab],[data-tab-jump],[data-color],[data-cat],[data-shop-sort],[data-shop-toggle],[data-clear-filters],[data-product],[data-product-preview],[data-back-shop],[data-wallet-order],[data-select-card],[data-pay-stars],[data-select-crypto],[data-select-crypto-tab],[data-reset-payment-method],[data-show-crypto],[data-crypto-hash],[data-check-crypto],[data-bulk-action],[data-reorder],[data-chat-user],[data-customer-360],[data-customer360],[data-edit-role],[data-admin-remove-role],[data-contact-wallet],[data-contact-ban],[data-edit-inventory],[data-admin-delete-inventory],[data-admin-hard-delete-inventory],[data-admin-status],[data-admin-order-note],[data-admin-archive-order],[data-admin-delete-order],[data-admin-cleanup],[data-admin-deliver],[data-admin-service],[data-admin-provision],[data-service-view],[data-service-copy-link],[data-view-receipt],[data-admin-save-settings],[data-open-url],[data-copy],[data-receipt],[data-customer-note],  [data-order-filter],[data-order-open],[data-order-rename],[data-order-back],[data-order-more],[data-hide-order],[data-clear-canceled],[data-cancel],[data-refresh-crypto-rates],[data-admin-backup-create],[data-admin-backup-sendbot],[data-admin-backup-delete],[data-admin-backup-restore-server],[data-admin-backup-upload],[data-admin-load-more-orders],[data-accordion-toggle],[data-accordion-add-variant],[data-edit-coupon],[data-admin-toggle-coupon],[data-admin-delete-coupon],[data-credit-topup-approve],[data-credit-topup-reject],[data-credit-topup-receipt],[data-credit-topup-tx],[data-mini-topup-change],[data-mini-topup-cancel],[data-mini-topup-pay],[data-renew-order],[data-my-service],[data-my-service-back],[data-vpn-detail-back],[data-service-renew],[data-service-sync],[data-service-add-traffic],[data-service-add-days],[data-service-qr],[data-support-ticket],[data-support-ticket-new],[data-support-ticket-reply],[data-service-history],[data-service-events],[data-adv-trial],[data-adv-addons],[data-adv-monitor],[data-adv-routing],[data-adv-economics]')||e.target;  if(t.id==='openShopFilters'){openShopFilters();return}if(t.id==='openShopCategories'){openShopCategories();return}if(t.id==='clearShopSearch'){searchTerm='';const input=$('searchInput');if(input)input.value='';renderShopSections();input?.focus();return}if(t.id==='orderAdvancedFilter'){openOrderFiltersSheet();return}if(t.id==='ordersManageBtn'){openOrdersManageSheet();return}if(t.dataset.orderRename){const o=orderById(Number(t.dataset.orderRename));if(!o)return;const label=prompt('نام دلخواه برای این سفارش را وارد کن:',o.user_label||'');if(label===null)return;try{state=await api('update_order_label',{order_id:Number(o.id),label:label.trim()});renderOrders();showStatus(label.trim()?'نام سفارش ذخیره شد':'نام سفارشی حذف شد','success')}catch(e){showStatus(e.message||'ذخیره نام سفارش انجام نشد','error')}return}if(t.dataset.orderMore){openOrderMoreActions(t.dataset.orderMore);return}if(t.dataset.creditView){if(t.dataset.creditView==='referral')openMiniReferralCenter();else openCreditSubview(t.dataset.creditView);return}if(t.dataset.serviceView){openDirectServiceViewer(t.dataset.serviceView,t.dataset.serviceUrl||'',t.dataset.serviceTitle||'مدیریت سرویس');return}if(t.dataset.serviceCopyLink){copyMiniServiceUrl(t.dataset.serviceCopyLink,t.dataset.serviceUrl||'');return}if(t.dataset.serviceHapp!==undefined){const u=String(t.dataset.serviceHapp||'').trim();if(!/^https:\/\//i.test(u)){showStatus('لینک اشتراک معتبر نیست','error');return}const deep='happ://add/'+u;showStatus('در حال باز کردن Happ…');try{window.location.href=deep}catch(e){copyText(deep);showStatus('باز کردن Happ ممکن نشد؛ لینک اتصال کپی شد','error')}return}if(t.dataset.copySubid!==undefined){copyText(t.dataset.copySubid||'');showStatus('شناسه اشتراک کپی شد','success');return}if(t.dataset.settingsSubtab){if(typeof haptic==='function')haptic('light');settingsSubTab=t.dataset.settingsSubtab;document.querySelectorAll('.settings-subtab-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.settingsSubtab===settingsSubTab));document.querySelectorAll('.settings-subtab-pane').forEach(pane=>pane.classList.toggle('hidden',pane.dataset.pane!==settingsSubTab));if(settingsSubTab==='crypto'){parseSettingsBuilders();syncPaymentBuilders();}const settingsTabLabels = { general: '🏪 عمومی', payments: '💳 روش‌های پرداخت', crypto: '🪙 کریپتو & ارزها', appearance: '🎨 ظاهر & تم', gamification: '🎡 پاداش & گردونه' };const lbl=$('activeSettingsTabLabel');if(lbl)lbl.textContent=settingsTabLabels[settingsSubTab]||'';const muted=$('activeSettingsTabMuted');if(muted)muted.textContent=settingsTabLabels[settingsSubTab]||'';return}if(t.dataset.adminViewMode){adminOrderViewMode=t.dataset.adminViewMode;renderAdmin();return}if(t.dataset.adminActionSheet){const [type,id]=t.dataset.adminActionSheet.split(':');openAdminActionSheet(type,id);return}  if(t.dataset.adminSupportTicket){(async()=>{try{const r=await api('admin_support_ticket_messages',{ticket_id:Number(t.dataset.adminSupportTicket)});const ticket=(adminState.support_tickets||[]).find(x=>Number(x.id)===Number(t.dataset.adminSupportTicket))||{};const msgs=(r.messages||[]).map(m=>`<article class="my-service-info-card"><div><span>${m.sender_type==='admin'?'مدیر':'کاربر'}</span><small>${esc(m.created_at||'')}</small></div><p>${esc(m.body||'')}</p></article>`).join('')||'<div class="u-empty">پیامی ثبت نشده.</div>';BlueGateUI.openSheet({type:'fullscreen',eyebrow:'SUPPORT TICKET',title:`#${ticket.id||t.dataset.adminSupportTicket} ${esc(ticket.subject||'تیکت')}`,subtitle:esc(ticket.status||'open'),body:`<div class="mini-support-thread">${msgs}<button class="primary wide" data-admin-support-reply="${ticket.id||t.dataset.adminSupportTicket}">پاسخ به تیکت</button><div class="support-status-actions"><button class="ghost" data-admin-support-status="${ticket.id||t.dataset.adminSupportTicket}:resolved">حل شد</button><button class="ghost" data-admin-support-status="${ticket.id||t.dataset.adminSupportTicket}:closed">بستن</button></div></div>`,onOpen:(host)=>{host.querySelector('[data-admin-support-reply]')?.addEventListener('click',()=>openDialog('پاسخ به تیکت','پیام پاسخ را بنویس.','متن پاسخ',async(message)=>{if(!message)return;try{await api('admin_support_ticket_reply',{ticket_id:Number(ticket.id),message});showStatus('پاسخ ارسال شد','success');BlueGateUI.closeSheet?.();adminState=await api('admin_summary');renderAdmin()}catch(e){showStatus(e.message||'ارسال پاسخ ناموفق بود','error')}}));host.querySelectorAll('[data-admin-support-status]').forEach(b=>b.addEventListener('click',async()=>{const [id,status]=b.dataset.adminSupportStatus.split(':');try{await api('admin_support_ticket_status',{ticket_id:Number(id),status});showStatus('وضعیت تیکت بروزرسانی شد','success');BlueGateUI.closeSheet?.();adminState=await api('admin_summary');renderAdmin()}catch(e){showStatus(e.message||'تغییر وضعیت ناموفق بود','error')}}))}})}catch(e){showStatus(e.message||'دریافت تیکت ناموفق بود','error')}})();return}if(t.dataset.tab){setTab(t.dataset.tab)}if(t.dataset.tabJump){setTab(t.dataset.tabJump)}if(t.id==='paletteQuick'){openPalettePopup();return}if(t.id==='editMiniProfile'||t.id==='editMiniProfile2'||t.id==='completeMiniSecurity'){openMiniProfileEditor();return}if(t.id==='miniChangeEmailBtn'||t.id==='miniChangeEmailInlineBtn'){openMiniEmailChangeFlow();return}if(t.id==='changeMiniPassword'){openMiniPasswordEditor();return}if(t.id==='shareInviteHome'){const link=state.user?.referral_link||'';if(link){if(TG?.openTelegramLink)TG.openTelegramLink('https://t.me/share/url?url='+encodeURIComponent(link));else navigator.clipboard?.writeText(link);showStatus('لینک دعوت آماده اشتراک است')}return}if(t.id==='miniReferralJump'){openMiniReferralCenter();return}if(['miniCreditTopup','miniCreditTopup2','miniCreditTopupEmpty','miniCreditTopupHistory','miniCreditTopupHistoryEmpty','miniCreditTopupHome'].includes(t.id)){openMiniCreditTopup();return}if(t.dataset.miniTopupPay){const topup=(state.credit_topups||[]).find(x=>Number(x.id)===Number(t.dataset.miniTopupPay));if(!topup){showStatus('درخواست شارژ پیدا نشد؛ صفحه را تازه‌سازی کن','error');return}if(topup.status!=='pending_payment'){showStatus('این درخواست در وضعیت انتظار پرداخت نیست؛ وضعیت فعلی را از تاریخچه بررسی کن','error');return}const method=String(topup.payment_method||'').toLowerCase();if(method==='card'){openMiniTopupCard(topup);return}if(method==='crypto'){if(topup.payment_details?.address&&topup.payment_details?.expected_amount)openMiniTopupCryptoPay(topup);else openMiniTopupCryptoChoose(topup);return}if(method==='stars'){try{const r=await api('credit_topup_start_stars',{topup_id:Number(topup.id)});state=r;openMiniTopupDone(r.topup,'فاکتور Stars ارسال شد؛ پرداخت را در تلگرام کامل کن.')}catch(e){showStatus(e.message||'ادامه پرداخت Stars انجام نشد','error')}return}openMiniTopupMethods(topup);return}if(t.dataset.miniTopupCancel){if(await (BlueGateUI.confirmCentered||BlueGateUI.confirm)({eyebrow:'BLUEGATE CREDIT',icon:'!',title:'لغو درخواست شارژ؟',message:'این درخواست شارژ لغو می‌شود. اگر رسید یا TXID فرستاده‌ای، دیگر بررسی نخواهد شد.',confirmText:'بله، لغو شود',cancelText:'برگشت',danger:true})){try{state=await api('cancel_credit_topup',{topup_id:Number(t.dataset.miniTopupCancel)});renderWallet();showStatus('درخواست شارژ لغو شد')}catch(e){showStatus(e.message||'لغو درخواست انجام نشد','error')}}return}if(t.dataset.miniTopupChange){if(await (BlueGateUI.confirmCentered||BlueGateUI.confirm)({eyebrow:'BLUEGATE CREDIT',icon:'↻',title:'تغییر روش پرداخت؟',message:'درخواست فعلی بسته می‌شود و درخواست تازه‌ای با همان مبلغ ساخته می‌شود تا روش پرداخت جدید را انتخاب کنی.',confirmText:'انتخاب روش جدید',cancelText:'ادامه با روش فعلی'})){try{const r=await api('credit_topup_change_method',{topup_id:Number(t.dataset.miniTopupChange)});state=r;renderWallet();openMiniTopupMethods(r.topup);showStatus('روش پرداخت جدید را انتخاب کن')}catch(e){showStatus(e.message||'تغییر روش پرداخت انجام نشد','error')}}return}if(t.id==='miniTrialBtn'){if(!await BlueGateUI.confirm({title:'فعال‌سازی تست رایگان',message:'تست رایگان روی یکی از Providerهای سالم BlueGate ساخته شود؟',confirmText:'فعال کن'}))return;try{const r=await api('trial_request',{});if(r.service){state.services=[r.service,...(state.services||[]).filter(x=>Number(x.id)!==Number(r.service.id))]}state.trial=r.trial||{eligible:false};renderUser();showStatus('تست رایگان فعال شد','success')}catch(e){showStatus(e.message||'ساخت تست رایگان انجام نشد','error')}return}if(t.dataset.supportTicketNew!==undefined){newMiniSupportTicket();return}if(t.dataset.supportTicket){openMiniSupportTicket(Number(t.dataset.supportTicket));return}if(t.dataset.supportTicketReply){const id=Number(t.dataset.supportTicketReply);openDialog('پاسخ به تیکت','پیامت را بنویس.','متن پاسخ',async(message)=>{if(!message)return;try{await api('support_ticket_reply',{ticket_id:id,message});showStatus('پاسخ ارسال شد','success');openMiniSupportTicket(id)}catch(e){showStatus(e.message||'ارسال پاسخ ناموفق بود','error')}});return  }if(t.id==='miniSupportBtn'){const url=miniSupportUrl();if(tg?.openTelegramLink)tg.openTelegramLink(url);else window.open(url,'_blank','noopener');return}if(t.id==='miniNotificationsBtn'){openNotifications();return}if(t.dataset.myService){currentServiceOrderId=Number(t.dataset.myService);currentTab='home';renderUser();miniScrollTop();return}if(t.dataset.myServiceBack!==undefined){currentServiceOrderId=null;currentTab='home';renderUser();miniScrollTop();return}if(t.dataset.vpnDetailBack!==undefined){if(t.dataset.vpnDetailBack==='orders'){currentOrderId=null;currentTab='orders'}else{currentServiceOrderId=null;currentTab='home'}renderUser();miniScrollTop();return}if(t.dataset.serviceQr){const u=String(t.dataset.serviceUrl||'').trim();if(!u){showStatus('لینک اشتراک برای ساخت QR موجود نیست','error');return}prepareMiniLayer('previewSheet');const pv=$('previewSheet');if(!pv)return;pv.innerHTML=`<div class="preview-sheet-inner vpn-qr-sheet"><button type="button" class="vpn-qr-close" data-close-preview aria-label="بستن"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button><div class="vpn-qr-heading"><span class="vpn-qr-symbol"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v2M14 20h2M19 19h2v2h-2z"/></svg></span><div><h3>QR لینک اشتراک</h3><p>با Happ یا دوربین دستگاه اسکن کن</p></div></div><div class="vpn-qr-imagebox">${qrCodeImg(u,280)}</div><code class="vpn-qr-url">${esc(u)}</code><button type="button" class="primary vpn-qr-copy" data-service-copy-link="${t.dataset.serviceQr}" data-service-url="${esc(u)}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>کپی لینک اشتراک</button></div>`;pv.classList.add('open');pv.querySelectorAll('[data-close-preview]').forEach(x=>x.addEventListener('click',closePreviewSheet));return}if(t.dataset.serviceHistory){try{const r=await api('service_usage_history',{service_id:Number(t.dataset.serviceHistory),days:30});prepareMiniLayer('previewSheet');const pv=$('previewSheet');const rows=r.history||[];const max=Math.max(1,...rows.map(x=>Number(x.traffic_used_bytes||0)));pv.innerHTML=`<div class="preview-sheet-inner"><div class="preview-sheet-handle" data-close-preview></div><h3>📈 مصرف ۳۰ روز اخیر</h3><div style="display:flex;align-items:end;gap:5px;height:190px;margin:20px 0;overflow-x:auto">${rows.map(x=>`<div title="${esc(x.created_at)}" style="min-width:12px;height:${Math.max(4,Math.round(Number(x.traffic_used_bytes||0)*170/max))}px;background:var(--tg-theme-button-color,#4c8dff);border-radius:5px"></div>`).join('')||'<div class="u-empty">هنوز Snapshot مصرف ثبت نشده.</div>'}</div><div class="bg-admin-list">${rows.slice(-12).reverse().map(x=>`<div class="account-menu-row"><div><b>${esc(x.created_at)}</b><small>${(Number(x.traffic_used_bytes||0)/1073741824).toFixed(2)} GB</small></div></div>`).join('')}</div></div>`;pv.classList.add('open');pv.querySelectorAll('[data-close-preview]').forEach(x=>x.addEventListener('click',closePreviewSheet))}catch(e){showStatus(e.message||'تاریخچه مصرف در دسترس نیست','error')}return}if(t.dataset.serviceEvents){try{const r=await api('service_event_history',{service_id:Number(t.dataset.serviceEvents)});prepareMiniLayer('previewSheet');const pv=$('previewSheet');pv.innerHTML=`<div class="preview-sheet-inner"><div class="preview-sheet-handle" data-close-preview></div><h3>🕘 رویدادهای سرویس</h3><div class="bg-admin-list">${(r.events||[]).map(x=>`<article class="my-service-info-card"><div><span>${esc(x.event_type)}</span><small>${esc(x.created_at)}</small></div><b>${esc(x.title)}</b></article>`).join('')||'<div class="u-empty">رویدادی ثبت نشده.</div>'}</div></div>`;pv.classList.add('open');pv.querySelectorAll('[data-close-preview]').forEach(x=>x.addEventListener('click',closePreviewSheet))}catch(e){showStatus(e.message||'رویدادها در دسترس نیست','error')}return}if(t.dataset.serviceSync){try{const r=await api('service_sync',{service_id:Number(t.dataset.serviceSync)});const idx=(state.services||[]).findIndex(x=>Number(x.id)===Number(t.dataset.serviceSync));if(idx>=0)state.services[idx]=r.service;renderUser();showStatus('سرویس همگام شد','success')}catch(e){showStatus(e.message||'Sync ناموفق بود','error')}return}if(t.dataset.serviceRenew){try{const r=await api('service_renew',{service_id:Number(t.dataset.serviceRenew)});const targetOrderId=Number(r.order?.id||0);if(!targetOrderId){showStatus('شناسه سفارش تمدید از سرور دریافت نشد؛ سفارش قبلی باز نشد.','error');return}state=r;currentServiceOrderId=null;currentTab='orders';currentOrderId=targetOrderId;renderUser();showStatus(r.renewal_reused?'این سرویس سفارش تمدید باز دارد؛ همان سفارش نمایش داده شد.':'سفارش تمدید جدید ساخته شد','success')}catch(e){showStatus(e.message||'تمدید انجام نشد','error')}return}if(t.dataset.serviceAddTraffic){const gb=Number(prompt('چند GB حجم اضافه؟')||0);if(!gb)return;try{const r=await api('service_add_traffic',{service_id:Number(t.dataset.serviceAddTraffic),gb});state=r;currentServiceOrderId=null;currentTab='orders';currentOrderId=Number(r.order?.id||0);renderUser();showStatus('سفارش حجم اضافه ساخته شد','success')}catch(e){showStatus(e.message||'ثبت حجم اضافه انجام نشد','error')}return}if(t.dataset.serviceAddDays){const days=Number(prompt('چند روز اضافه؟')||0);if(!days)return;try{const r=await api('service_add_days',{service_id:Number(t.dataset.serviceAddDays),days});state=r;currentServiceOrderId=null;currentTab='orders';currentOrderId=Number(r.order?.id||0);renderUser();showStatus('سفارش زمان اضافه ساخته شد','success')}catch(e){showStatus(e.message||'ثبت زمان اضافه انجام نشد','error')}return}if(t.dataset.renewOrder){try{const r=await api('renew_order',{order_id:Number(t.dataset.renewOrder)});state=r;_enhancementsHydrated=false;scheduleMiniEnhancementsHydration();currentTab='orders';currentOrderId=Number(r.order?.id||0);if(!currentOrderId){showStatus('سفارش تمدید از سرور برنگشت؛ سفارش قبلی باز نشد.','error');return;}renderUser();showStatus('🔄 سفارش تمدید ساخته شد','success')}catch(e){showStatus(e.message||'تمدید انجام نشد','error')}return}if(t.dataset.color){localStorage.setItem('blue_ref_color',t.dataset.color);applyTheme({...state,theme_color:t.dataset.color});showStatus('رنگ تغییر کرد')}if(t.id==='resetColor'){localStorage.removeItem('blue_ref_color');applyTheme(state);showStatus('رنگ پیش‌فرض برگشت')}if(t.id==='applyCustomColor'){const c=$('userCustomColor')?.value||'#8b5cf6';localStorage.setItem('blue_ref_color',c);applyTheme({...state,theme_color:c});showStatus('رنگ دلخواه اعمال شد')}if(t.dataset.cat){activeCategory=t.dataset.cat;document.querySelectorAll('.cat-pill').forEach(el=>el.classList.toggle('active',el.dataset.cat===activeCategory));renderShopSections()}if(t.dataset.shopSort!==undefined){shopSort=t.dataset.shopSort;document.querySelectorAll('[data-shop-sort]').forEach(el=>el.classList.toggle('active',el.dataset.shopSort===shopSort));renderShopSections()}  if(t.dataset.shopToggle!==undefined){if(t.dataset.shopToggle==='featured')shopFilterFeatured=!shopFilterFeatured;else if(t.dataset.shopToggle==='wishlist'){shopFilterWishlist=!shopFilterWishlist;t.textContent=shopFilterWishlist?'❤️':'🤍'}t.classList.toggle('active');renderShopSections()}if(t.dataset.clearFilters!==undefined){searchTerm='';activeCategory='all';shopSort='newest';shopFilterFeatured=false;shopFilterWishlist=false;renderShop()}if(t.id==='searchInput')return;if(t.dataset.product)showProduct(t.dataset.product);if(t.dataset.productPreview)showProduct(t.dataset.productPreview);if(t.dataset.backShop!==undefined){currentTab='shop';renderUser();miniScrollTop()}// Purchase actions are handled exclusively by the single capture-phase validated handler below (avoids duplicate listeners/API calls).
if(t.dataset.walletOrder){openWalletConfirmSheet(t.dataset.walletOrder);return}if(t.dataset.selectCard){await loadAfterAction('select_payment_method',{order_id:t.dataset.selectCard,method:'card',details:{}});currentTab='orders';currentOrderId=t.dataset.selectCard;renderUser();showStatus('کارت به کارت انتخاب شد')}if(t.dataset.selectCryptoTab){await loadAfterAction('select_payment_method',{order_id:t.dataset.selectCryptoTab,method:'crypto',details:{}});currentTab='orders';currentOrderId=t.dataset.selectCryptoTab;renderUser();showStatus('پرداخت رمزارز انتخاب شد');return}if(t.dataset.resetPaymentMethod){const oid=t.dataset.resetPaymentMethod;await loadAfterAction('select_payment_method',{order_id:oid,method:'none',details:{}});const o=orderById(oid);if(o){o.payment_method='';o.payment_method_fa='انتخاب نشده';}currentTab='orders';currentOrderId=oid;renderOrders();showStatus('انتخاب روش پرداخت بازنشانی شد');return}if(t.dataset.payStars){const starsOrder=orderById(Number(t.dataset.payStars));if(!starsOrder){showStatus('سفارش پیدا نشد. صفحه را تازه‌سازی کن.','error');return}const starsCfg=(state.payment_methods||{}).stars||{},starsCount=Math.max(1,Math.ceil(Number(starsOrder.final_amount||0)/Number(starsCfg.rate_toman||3200)));const confirmStars=BlueGateUI.confirmCentered||BlueGateUI.confirm;const accepted=await confirmStars({title:'ساخت فاکتور Telegram Stars',message:`برای سفارش #${nf(starsOrder.id)} فاکتور پرداخت تلگرام به مبلغ ${nf(starsCount)} ⭐ ساخته و در تلگرام نمایش داده می‌شود. پس از تأیید، باید پرداخت را در پنجره تلگرام کامل کنی. تا زمانی که «ادامه» را نزنی، فاکتوری ساخته نمی‌شود.`,icon:'⭐',confirmText:'بله، ادامه و ساخت فاکتور',cancelText:'نه، فعلاً نه'});if(!accepted)return;await loadAfterAction('start_stars_invoice',{order_id:t.dataset.payStars});currentTab='orders';currentOrderId=t.dataset.payStars;renderUser();showStatus('فاکتور Stars داخل تلگرام ارسال شد')}if(t.dataset.selectCrypto){const [oid,wid]=t.dataset.selectCrypto.split(':');await loadAfterAction('select_crypto_wallet',{order_id:oid,wallet_id:wid});currentTab='orders';currentOrderId=oid;renderUser();showStatus('کیف پول رمزارز انتخاب شد')}if(t.dataset.showCrypto){showStatus('کمی پایین‌تر کیف پول رمزارز را انتخاب کن')}if(t.dataset.cryptoHash){openDialog('ثبت TXID / Hash',`هش تراکنش رمزارز سفارش #${t.dataset.cryptoHash} را وارد کن.`, 'TXID / Hash', async(txt)=>{await loadAfterAction('submit_crypto_hash',{order_id:t.dataset.cryptoHash,tx_hash:txt});currentTab='orders';currentOrderId=t.dataset.cryptoHash;renderUser();showStatus('هش ثبت شد و در صف بررسی قرار گرفت')})}if(t.dataset.checkCrypto){await loadAfterAction('check_crypto_payment',{order_id:t.dataset.checkCrypto});currentTab='orders';currentOrderId=t.dataset.checkCrypto;renderUser();showStatus('بررسی پرداخت انجام شد')}
  if(t.id==='openQrHome'||t.id==='openQrWallet'){openQrSheet();return}if(t.id==='openReferralShareMini'){openReferralShareMini();return}if(t.id==='openCustomReferralCode'){openCustomReferralCodeMini();return}if(t.id==='shareInviteEmpty'){openReferralShareMini();return}if(t.id==='openPromoSheetBtn'){openPromoSheet();return}if(t.id==='adminOrderSearchBtn'){adminOrderSearch=$('adminOrderSearchInput')?.value||'';adminOrderStatusFilter=$('adminOrderStatusSelect')?.value||'all';adminSearchOrdersNow();return}if(t.id==='adminOrderResetBtn'){adminOrderSearch='';adminOrderStatusFilter='all';adminSearchOrdersNow();return}if(t.id==='bulkClearBtn'){selectedOrderIds.clear();renderAdmin();return}if(t.dataset.bulkAction){bulkOrderAction(t.dataset.bulkAction);return}if(t.dataset.reorder){const [type,id,dir]=t.dataset.reorder.split(':');reorderItem(type,Number(id),dir);return}if(t.dataset.customer360){BlueGateUI?.closeSheet?.();openCustomer360(Number(t.dataset.customer360));return}if(t.dataset.chatUser){openUserChat(t.dataset.chatUser);return}if(t.dataset.editRole){const r=(adminState.admin_roles||[]).find(x=>Number(x.id)===Number(t.dataset.editRole));if(!r)return;openEdit(`ویرایش نقش ${esc(r.display_name||'')}`,[{title:'سطح دسترسی',fields:[{id:'erl_name',label:'نام نمایشی',value:r.display_name||''},{id:'erl_role',label:'نوع دسترسی',type:'select',options:`<option value="full" ${r.role==='full'?'selected':''}>ادمین کامل</option><option value="orders" ${r.role==='orders'?'selected':''}>فقط سفارش‌ها</option><option value="products" ${r.role==='products'?'selected':''}>فقط محصولات</option><option value="finance" ${r.role==='finance'?'selected':''}>فقط مالی</option>`}]}],async()=>adminAction('admin_set_role',{telegram_id:r.telegram_id,role:val('erl_role'),display_name:val('erl_name')}));return}if(t.dataset.adminRemoveRole&&await BlueGateUI.confirm({title:'حذف نقش',message:'نقش مدیریتی این کاربر حذف شود؟',confirmText:'حذف نقش',danger:true})){adminAction('admin_remove_role',{telegram_id:Number(t.dataset.adminRemoveRole)});return}
if(t.dataset.creditTopupReceipt){loadCreditTopupReceipt(Number(t.dataset.creditTopupReceipt));return}if(t.dataset.creditTopupTx){navigator.clipboard?.writeText(t.dataset.creditTopupTx);showStatus('TXID کپی شد');return}if(t.dataset.creditTopupApprove){if(await BlueGateUI.confirm({title:'تأیید شارژ',message:'این شارژ تأیید و به اعتبار کاربر اضافه شود؟',confirmText:'تأیید شارژ'}))adminAction('admin_credit_topup_approve',{topup_id:Number(t.dataset.creditTopupApprove)});return}if(t.dataset.creditTopupReject){if(await BlueGateUI.confirm({title:'رد شارژ',message:'این درخواست شارژ رد شود؟',confirmText:'رد درخواست',danger:true}))adminAction('admin_credit_topup_reject',{topup_id:Number(t.dataset.creditTopupReject)});return}if(t.dataset.contactWallet){openDialog('افزایش/کاهش اعتبار',`مبلغی که می‌خواهید به اعتبار کاربر با ID ${t.dataset.contactWallet} اضافه شود را وارد کنید. برای کاهش، عدد منفی وارد کنید.`,'مثلا 50000 یا -20000',async(txt)=>{const amount=Number(txt);if(isNaN(amount)||!amount)return showStatus('مبلغ نامعتبر است','error');const ok=await adminAction('admin_add_balance',{telegram_id:t.dataset.contactWallet,amount});if(ok){showStatus('اعتبار تغییر کرد');closeCustomer360();setTimeout(()=>openCustomer360(t.dataset.contactWallet),500)}});return}if(t.dataset.contactBan){if(await BlueGateUI.confirm({title:'مسدود کردن کاربر',message:'دسترسی این کاربر مسدود شود؟',confirmText:'مسدود کن',danger:true})){const ok=await adminAction('admin_ban_user',{telegram_id:t.dataset.contactBan});if(ok)showStatus('کاربر مسدود شد')}return}if(t.closest('[data-catalog-guide]')){openCatalogGuide();return}if(t.dataset.catalogApplyOne!==undefined){const legacyId=Number(t.dataset.catalogApplyOne||0);if(legacyId&&await BlueGateUI.confirm({title:'نگاشت مورد قدیمی',message:'این مورد Needs Review به کاتالوگ جدید نگاشت شود؟',confirmText:'نگاشت'}))adminAction('admin_catalog_apply_one',{legacy_product_id:legacyId,confirm:'APPLY'});return}if(t.dataset.catalogPreview!==undefined){adminAction('admin_catalog_preview');return}if(t.dataset.catalogApply!==undefined){if(await BlueGateUI.confirm({title:'Migration کاتالوگ',message:'Migration کاتالوگ اعمال شود؟ هیچ محصول یا سفارش قدیمی حذف نمی‌شود.',confirmText:'اعمال Migration'}))adminAction('admin_catalog_apply',{confirm:'APPLY'});return}if(t.dataset.catalogMoveGroup!==undefined){openCatalogMoveGroup();return}if(t.dataset.catalogMovePlan!==undefined){openCatalogMovePlan();return}if(t.dataset.catalogAddService!==undefined){openCatalogAddService();return}if(t.dataset.catalogAddGroup!==undefined){openCatalogAddGroup();return}if(t.dataset.catalogAddPlan!==undefined){openCatalogAddPlan();return}if(t.dataset.advTrial!==undefined){openAdminAdvancedTrial();return}if(t.dataset.advAddons!==undefined){openAdminAdvancedAddons();return}if(t.dataset.advMonitor!==undefined){await adminAction('admin_monitoring_run',{});return}if(t.dataset.advRouting!==undefined){openAdminAdvancedRouting();return}if(t.dataset.advEconomics){openAdminAdvancedEconomics(Number(t.dataset.advEconomics));return}if(t.dataset.proFeature){showProUpgrade(t.dataset.proFeature);return}if(t.dataset.proActive){showProActive(t.dataset.proActive);return}if(t.dataset.infraAdd!==undefined){openInfraProvider(0);return}if(t.dataset.infraEdit){openInfraProvider(Number(t.dataset.infraEdit));return}if(t.dataset.infraInbounds){await openInfraInbounds(Number(t.dataset.infraInbounds));return}if(t.dataset.infraClients){openInfraClientTools(Number(t.dataset.infraClients));return}if(t.dataset.infraClientAction){openInfraClientAction(t.dataset.infraClientAction,Number(t.dataset.providerId));return}if(t.dataset.infraMonitorSettings!==undefined){openAdminMonitoringSettings();return}if(t.dataset.infraMapAdd!==undefined){openInfraMap(0);return}if(t.dataset.infraMapEdit){openInfraMap(Number(t.dataset.infraMapEdit));return}if(t.dataset.infraMapDelete){if(await BlueGateUI.confirm({title:'حذف اتصال پلن',message:'این اتصال از پلن حذف شود؟',confirmText:'حذف',danger:true})){await adminAction('admin_plan_provider_map_delete',{map_id:Number(t.dataset.infraMapDelete)})}return}if(t.dataset.infraRefresh!==undefined){adminState=await api('admin_summary');renderAdmin();showStatus('اطلاعات زیرساخت بروزرسانی شد');return}if(t.dataset.infraRunMonitor!==undefined){await adminAction('admin_monitoring_run',{});return}if(t.dataset.infraRunQueue!==undefined){await adminAction('admin_provisioning_run',{limit:20});return}if(t.dataset.infraTest){const r=await api('admin_provider_test',{provider_id:Number(t.dataset.infraTest)});showStatus(r?.result?.message||r?.message||'تست پنل انجام شد',r?.ok===false?'error':'success');adminState=await api('admin_summary');renderAdmin();return}if(t.dataset.infraToggle){await adminAction('admin_provider_toggle',{provider_id:Number(t.dataset.infraToggle),is_active:Number(t.dataset.active)?0:1});return}if(t.dataset.infraRetry){await adminAction('admin_provisioning_retry',{job_id:Number(t.dataset.infraRetry)});return}if(t.dataset.adminTab){setAdminTab(t.dataset.adminTab);return}if(t.id==='reloadAdmin')loadAdmin();if(t.id==='adminSendInAppNotification'){sendAdminInAppNotification();return}if(t.id==='openCmdPalette'){openCommandPalette();return}if(t.dataset.editInventory)editInventory(t.dataset.editInventory);if(t.dataset.adminDeleteInventory&&await BlueGateUI.confirm({title:'حذف امن آیتم',message:'این آیتم از انبار به‌صورت امن حذف شود؟',confirmText:'حذف',danger:true}))adminAction('admin_delete_inventory',{inventory_id:t.dataset.adminDeleteInventory});if(t.dataset.adminHardDeleteInventory&&await BlueGateUI.confirm({title:'حذف کامل آیتم',message:'این آیتم برای همیشه حذف شود؟ این عملیات قابل برگشت نیست.',confirmText:'حذف کامل',danger:true}))adminAction('admin_hard_delete_inventory',{inventory_id:t.dataset.adminHardDeleteInventory});if(t.dataset.adminStatus){const [id,status]=t.dataset.adminStatus.split(':');adminAction('admin_order_status',{order_id:id,status})}if(t.dataset.adminOrderNote){BlueGateUI?.closeSheet?.();const id=t.dataset.adminOrderNote;const o=(adminState.orders||[]).find(x=>Number(x.id)===Number(id));if(o)openEdit(`یادداشت داخلی #${id}`,[{title:'یادداشت داخلی (مخفی)',fields:[{id:'adm_note',label:'متن یادداشت',type:'textarea',placeholder:'فقط شما می‌بینید...',value:o.admin_note||''}]}],async()=>adminAction('admin_order_note',{order_id:id,note:val('adm_note')}))}if(t.dataset.adminArchiveOrder&&await BlueGateUI.confirm({title:'آرشیو سفارش',message:'این سفارش آرشیو شود؟',confirmText:'آرشیو'}))adminAction('admin_archive_order',{order_id:t.dataset.adminArchiveOrder});if(t.dataset.adminDeleteOrder&&await BlueGateUI.confirm({title:'حذف کامل سفارش',message:'این عملیات قابل برگشت نیست.',confirmText:'حذف کامل',danger:true}))adminAction('admin_delete_order',{order_id:t.dataset.adminDeleteOrder});if(t.dataset.adminCleanup&&await BlueGateUI.confirm({title:'پاکسازی سفارش‌ها',message:'سفارش‌های لغو و ردشده پاکسازی شوند؟',confirmText:'پاکسازی',danger:true}))adminAction('admin_cleanup_orders',{older_days:t.dataset.adminCleanup==='all'?null:t.dataset.adminCleanup});if(t.dataset.adminProvision){BlueGateUI?.closeSheet?.();const oid=Number(t.dataset.adminProvision);if(await BlueGateUI.confirm({title:'ساخت و ارسال سرویس',message:'Client روی پنل ساخته شود و لینک Subscription برای مشتری فعال شود؟',confirmText:'ساخت و ارسال'})){const r=await api('admin_order_provision_now',{order_id:oid});showStatus(r.message||'ساخت سرویس اجرا شد','success');adminState=await api('admin_summary');renderAdmin();}return}if(t.dataset.adminService){BlueGateUI?.closeSheet?.();const oid=t.dataset.adminService;const o=(adminState.orders||[]).find(x=>Number(x.id)===Number(oid))||{};openEdit(`لینک سرویس #${oid}`,[{title:'دسترسی سرویس',fields:[{id:'svc_url',label:'لینک HTTPS پنل / Subscription',placeholder:'https://...',value:o.delivery_url||''},{id:'svc_title',label:'عنوان دکمه برای مشتری',value:o.delivery_title||'مدیریت سرویس'},{id:'svc_note',label:'پیام تحویل',type:'textarea',value:o.delivery_text||'سرویس شما آماده است. از سفارش‌ها می‌توانید لینک سرویس را باز یا کپی کنید.'}]}],async()=>{const ok=await adminAction('admin_set_service_delivery',{order_id:oid,delivery_url:val('svc_url'),delivery_title:val('svc_title'),delivery_note:val('svc_note')});if(ok){currentAdminTab='orders';showStatus('لینک مستقیم سرویس ثبت شد')}});return}if(t.dataset.adminDeliver){const oid=t.dataset.adminDeliver;openDialog('تحویل سفارش',`متن تحویل سفارش #${oid} را وارد کن.`, 'ایمیل/پسورد، لینک ساب یا کد', async(txt)=>{const ok=await adminAction('admin_deliver_order',{order_id:oid,delivery:txt});if(ok){currentAdminTab='orders';showStatus('تحویل ثبت شد و برای کاربر ارسال شد')}})}if(t.dataset.viewReceipt!==undefined){loadReceiptImage(t.dataset.viewReceipt)}if(t.dataset.adminSaveSettings!==undefined){syncPaymentBuilders();adminAction('admin_save_settings',{brand_name:val('as_brand_name'),default_base_currency:val('as_default_base_currency'),theme_color:val('as_theme'),button_colors_enabled:val('as_btn_enabled')?1:0,require_contact_auth:val('as_require_contact')?1:0,notify_new_user:val('as_notify_new')?1:0,resend_api_key:val('as_resend_api_key'),resend_from_email:val('as_resend_from_email'),require_email_verification:val('as_require_email_verif')?1:0,button_colors:{primary:val('as_primary'),secondary:val('as_secondary'),success:val('as_success'),warning:val('as_warning'),danger:val('as_danger')},payment_instructions:val('as_payment'),payment_methods_enabled:{wallet:val('as_pay_wallet')?1:0,card:val('as_pay_card')?1:0,stars:val('as_pay_stars')?1:0,crypto:val('as_pay_crypto')?1:0},credit_topup_enabled:val('as_topup_enabled')?1:0,credit_topup_min:val('as_topup_min'),credit_topup_max:val('as_topup_max'),credit_topup_presets:val('as_topup_presets'),credit_topup_methods:{card:val('as_topup_card')?1:0,stars:val('as_topup_stars')?1:0,crypto:val('as_topup_crypto')?1:0},card_accounts_text:val('as_cards'),stars_rate_manual_toman:val('as_stars_rate'),stars_rate_mode:val('as_stars_mode'),stars_base_usdt:val('as_stars_base_usdt'),stars_rate_markup_percent:val('as_stars_markup'),crypto_manual_rates_text:val('as_crypto_rates'),crypto_rate_source:val('as_crypto_source'),crypto_rate_provider_priority:'wallex,ramzinex,nobitex',crypto_rate_markup_percent:val('as_crypto_markup'),crypto_rate_refresh_interval_seconds:val('as_crypto_refresh_interval'),crypto_notify_rate_fail:val('as_crypto_notify')?1:0,start_reward:val('as_start_reward'),purchase_reward:val('as_purchase_reward'),custom_code_min_referrals:val('as_custom_code_min'),spin_referrals_per_chance:val('as_spin_every'),spin_rewards_text:val('as_spin_rewards')})}
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
  // Keep both order-note entry points on the same centered popup and the same save/API flow.
  BlueGateUI?.closeSheet?.();
  const oid = Number(t.dataset.customerNote);
  if(!orderById(oid)) return;
  openOrderMoreActions(oid);
  renderOrderMorePopup('note');
  return;
}
// BUG-4: Removed duplicate [data-coupon] handler — the dedicated standalone listener below handles it correctly via openDialog(). Having both caused two dialogs to open on one click.
if(t.dataset.cancel){
  BlueGateUI?.closeSheet?.();
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
if(t.dataset.editCoupon){const cp=(adminState.coupons||[]).find(x=>Number(x.id)===Number(t.dataset.editCoupon));if(!cp)return;openEdit(`ویرایش کد ${esc(cp.code)}`,[{title:'مشخصات تخفیف',fields:[{id:'ecp_code',label:'کد',value:cp.code},{id:'ecp_type',label:'نوع',type:'select',options:`<option value="percent" ${cp.type==='percent'?'selected':''}>درصدی</option><option value="fixed" ${cp.type==='fixed'?'selected':''}>مبلغ ثابت</option>`},{id:'ecp_value',label:'مقدار',type:'number',props:'inputmode="numeric" min="1"',value:cp.value||0},{id:'ecp_min',label:'حداقل مبلغ سفارش',type:'number',props:'inputmode="numeric" min="0"',value:cp.min_order_amount||0}]},{title:'محدودیت‌ها',fields:[{id:'ecp_max',label:'حداکثر استفاده',type:'number',props:'inputmode="numeric" min="0"',value:cp.max_uses||0},{id:'ecp_per_user',label:'سقف هر کاربر',type:'number',props:'inputmode="numeric" min="1"',value:cp.max_uses_per_user||1},{id:'ecp_cat',label:'دسته‌بندی',type:'select',options:catOptions(cp.category_id||'')},{id:'ecp_expires',label:'تاریخ انقضا',type:'datetime-local',value:cp.expires_at?String(cp.expires_at).slice(0,16):''},{id:'ecp_active',label:'فعال باشد؟',type:'checkbox',value:Number(cp.is_active)}]}],async()=>{const type=val('ecp_type'),value=Number(val('ecp_value')||0),code=String(val('ecp_code')||'').trim().toUpperCase();if(!code||!value)throw new Error('کد و مقدار تخفیف الزامی است.');if(type==='percent'&&value>100)throw new Error('تخفیف درصدی نمی‌تواند بیشتر از ۱۰۰٪ باشد.');return adminAction('admin_update_coupon',{coupon_id:cp.id,code,type,value,min_order_amount:Number(val('ecp_min')||0),max_uses:Number(val('ecp_max')||0),max_uses_per_user:Math.max(1,Number(val('ecp_per_user')||1)),category_id:val('ecp_cat')||null,expires_at:val('ecp_expires'),is_active:document.getElementById('ecp_active')?.checked?1:0})});return}if(t.dataset.adminToggleCoupon){const cp=(adminState.coupons||[]).find(x=>Number(x.id)===Number(t.dataset.adminToggleCoupon));if(cp)adminAction('admin_update_coupon',{coupon_id:cp.id,is_active:Number(cp.is_active)?0:1});return}if(t.dataset.adminDeleteCoupon&&await BlueGateUI.confirm({title:'حذف کد تخفیف',message:'این کد تخفیف حذف شود؟',confirmText:'حذف',danger:true})){adminAction('admin_delete_coupon',{coupon_id:Number(t.dataset.adminDeleteCoupon)});return}});

document.addEventListener('input',e=>{if(e.target.id==='searchInput'){searchTerm=e.target.value;const clear=$('clearShopSearch');if(clear){clear.hidden=!searchTerm;clear.classList.toggle('is-visible',Boolean(searchTerm));}clearTimeout(searchTimeout);searchTimeout=setTimeout(renderShopSections,220)}if(e.target.id==='ai_product'){const sel=$('ai_variant'); if(sel) sel.innerHTML=variantOptions('', e.target.value)}if(e.target.dataset.colorMirror){const id=e.target.dataset.colorMirror;if($(id))$(id).value=e.target.value}if(e.target.type==='color'&&$(e.target.id+'_text'))$(e.target.id+'_text').value=e.target.value;if(e.target.id==='cmdInput'&&$('cmdPalette')?.classList.contains('open')){openCommandPalette()}})
document.addEventListener('change',e=>{if(e.target.classList?.contains('bulk-check')){const id=Number(e.target.dataset.bulkCheck);if(e.target.checked)selectedOrderIds.add(id);else selectedOrderIds.delete(id);if(selectedOrderIds.size>0&&currentAdminTab==='orders'){const bar=document.querySelector('.bulk-action-bar h3');if(bar)bar.textContent=`${nf(selectedOrderIds.size)} سفارش انتخاب شده`;else renderAdmin()}}})
document.addEventListener('keydown',e=>{if(isAdminMode&&(e.metaKey||e.ctrlKey)&&e.key==='k'&&canUseCommandPalette()){e.preventDefault();openCommandPalette()}if(e.key==='Escape'){if(closeTopMiniLayer()){e.preventDefault();syncTelegramBackButton()}}if($('cmdPalette')?.classList.contains('open')){const cp=$('cmdPalette');if(e.key==='Enter'){const first=cp.querySelector('[data-cmd-idx]');if(first){const idx=Number(first.dataset.cmdIdx);cp._cmds?.[idx]?.action?.();closeCommandPalette()}}if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const items=[...cp.querySelectorAll('[data-cmd-idx]')];const cur=cp.querySelector('[data-cmd-idx].selected');let i=cur?items.indexOf(cur):-1;i+=e.key==='ArrowDown'?1:-1;if(i<0)i=items.length-1;if(i>=items.length)i=0;items.forEach(el=>el.classList.remove('selected'));items[i]?.classList.add('selected');items[i]?.scrollIntoView({block:'nearest'})}}})
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


document.addEventListener('click',e=>{const b=e.target.closest?.('[data-mc-goto]');if(!b||!mobileCatalogWizard)return;mcCollect();const target=Number(b.dataset.mcGoto||0);if(target>mobileCatalogStep){const err=mcValidate(mobileCatalogStep);if(err){showStatus(err,'error');return}}mobileCatalogStep=Math.max(0,Math.min(4,target));renderCatalogMobileWizard()});
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
  prepareMiniLayer('authModal');
  const modal = $('authModal');
  if (!modal) return;
  if (modal.open && typeof modal.close === 'function') {
    try { modal.close(); } catch (_) {}
  }
  switchAuthTab(tab);
  if (typeof modal.showModal === 'function') {
    try {
      modal.showModal();
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
    } catch (e) {
      modal.setAttribute('open', '');
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
    }
  } else {
    modal.setAttribute('open', '');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }
}

function closeAuthModal() {
  const modal = $('authModal');
  if (!modal) return;
  if (typeof modal.close === 'function') {
    try { modal.close(); } catch (_) {}
  }
  modal.removeAttribute('open');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
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

function setAuthFormBusy(form, busy, label) {
  if (!form) return;
  form.setAttribute('aria-busy', busy ? 'true' : 'false');
  form.querySelectorAll('button').forEach(button => {
    if (busy) {
      button.dataset.authOriginalLabel = button.textContent;
      button.disabled = true;
    } else {
      button.disabled = false;
      if (button.dataset.authOriginalLabel) {
        button.textContent = button.dataset.authOriginalLabel;
        delete button.dataset.authOriginalLabel;
      }
    }
  });
  const submit = form.querySelector('button[type="submit"]');
  if (submit && busy) submit.textContent = label || 'در حال پردازش…';
}

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
  $('authModal')?.addEventListener('cancel', (e) => {
    e.preventDefault();
    closeAuthModal();
  });
  $('authModal')?.addEventListener('close', () => {
    const modal = $('authModal');
    modal?.classList.remove('open');
    modal?.setAttribute('aria-hidden', 'true');
  });
  $('authModal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeAuthModal();
  });

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

    setAuthFormBusy(e.currentTarget, true, 'در حال ورود…');
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
    } finally {
      setAuthFormBusy(e.currentTarget, false);
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

    setAuthFormBusy(e.currentTarget, true, 'در حال ساخت حساب…');
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
    } finally {
      setAuthFormBusy(e.currentTarget, false);
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

    setAuthFormBusy(e.currentTarget, true, 'در حال تأیید…');
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
    } finally {
      setAuthFormBusy(e.currentTarget, false);
    }
  });

  $('resendOtpBtn')?.addEventListener('click', async (e) => {
    if (!pendingVerifUserId) return;
    const button = e.currentTarget;
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = 'در حال ارسال…';
    try {
      await api('resend_email_otp', { user_id: pendingVerifUserId });
      showStatus('کد تایید جدید ارسال شد 📩');
    } catch (err) {
      alert(err.message || 'خطا در ارسال مجدد کد');
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
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
