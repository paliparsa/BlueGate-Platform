(function(){
'use strict';
let busy=false,current=null,modal=null;
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const fmt=v=>Number(v||0).toLocaleString('en-US');
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));

function normalize(data){
  const variants=(data.variants||[]).map(v=>({
    id:Number(v.id||v.variant_id||0),
    title:String(v.title||v.label||'پلن'),
    price:Number(v.price??v.price_toman??0),
    duration_days:Number(v.duration_days||0),
    description:String(v.description||''),
    old_price:Number(v.old_price||0),
    discount_percent:Number(v.discount_percent||0)
  })).filter(v=>v.id);
  let selectedId=Number(data.variantId||data.selectedVariantId||0)||null;
  if(!selectedId&&variants.length) selectedId=variants[0].id;
  return {
    scope:String(data.scope||'generic'),productId:Number(data.productId||0),product:String(data.product||'محصول BlueGate'),
    image:String(data.image||data.image_url||''),icon:String(data.icon||'⚡'),badge:String(data.badge||'BlueGate Service'),
    description:String(data.description||''),delivery:String(data.delivery||data.delivery_type_fa||'تحویل و پیگیری از حساب BlueGate'),
    variants,selectedId,basePrice:Number(data.toman||data.price||0),
    starsCount:Number(data.starsCount||0),starsMin:Number(data.starsMin||50),starsMax:Number(data.starsMax||10000),starsStep:Number(data.starsStep||25),
    starsPresets:(data.starsPresets||[]).map(Number).filter(Boolean),settings:data.settings||null,rates:data.rates||null
  };
}
function selectedVariant(){return current?.variants.find(v=>v.id===Number(current.selectedId))||null}
function starPrice(count){
  if(window.BGPricing?.stars&&current.settings) return Number(BGPricing.stars(count,current.settings,current.rates||{usdt_toman:Number(current.settings.fallback_usdt_toman||0)}));
  if(current.starsCount&&current.basePrice) return Math.round(current.basePrice*(count/current.starsCount));
  return current.basePrice;
}
function currentPrice(){return current.scope==='stars'?starPrice(current.starsCount):Number(selectedVariant()?.price??current.basePrice??0)}
function currentTitle(){return current.scope==='stars'?`${fmt(current.starsCount)} Stars`:(selectedVariant()?.title||current.delivery||'سفارش مستقیم')}
function durationText(v){if(!v)return current.scope==='stars'?'تحویل دیجیتال':'—';return v.duration_days>0?`${fmt(v.duration_days)} روز`:'دائمی / بدون انقضا'}

function render(){
  const v=selectedVariant(),price=currentPrice();
  const orig=v&&(v.old_price>v.price?v.old_price:(v.discount_percent>0?Math.round(v.price/(1-v.discount_percent/100)):0));
  const variantPicker=current.scope==='stars'?starsPicker():variantPickerHtml();
  modal.innerHTML=`<div class="purchase-confirm-card" role="document" aria-label="تایید سفارش">
    <div class="purchase-confirm-header">
      <button class="purchase-confirm-close" type="button" data-pc-close aria-label="بستن">✕</button>
      <div class="purchase-confirm-brand"><div><h3>فاکتور رسمی خرید BlueGate</h3><p>پیش‌نمایش سفارش قبل از ثبت نهایی</p></div><div class="purchase-confirm-avatar">${current.image?`<img src="${esc(current.image)}" alt="">`:`<span>${esc(current.icon)}</span>`}</div></div>
    </div>
    ${variantPicker}
    <div class="purchase-confirm-specs">
      <div><span>📚 سرویس انتخابی</span><b class="cyan">${esc(current.product)}</b></div>
      <div><span>📐 پلن / مقدار</span><b>${esc(currentTitle())}</b></div>
      <div><span>⚡ نوع تحویل</span><b>${esc(current.delivery)}</b></div>
      <div><span>📅 مدت اعتبار</span><b class="green">${esc(durationText(v))}</b></div>
    </div>
    ${(v?.description||current.description)?`<div class="purchase-confirm-desc"><b>📝 توضیحات سفارش</b><p>${esc(v?.description||current.description)}</p></div>`:''}
    <div class="purchase-confirm-price"><span>مبلغ کل قابل پرداخت</span><div>${orig?`<s>${fmt(orig)}</s>`:''}<strong>${fmt(price)}</strong><small>تومان</small></div></div>
    <div class="purchase-confirm-guarantee">🛡️ شامل ضمانت بازگشت وجه طبق شرایط سرویس</div>
    <label class="purchase-confirm-coupon"><span>🎟 کد تخفیف <small>اختیاری</small></span><input id="purchaseCoupon" autocomplete="off" placeholder="مثلاً WELCOME10"></label>
    <div class="purchase-confirm-actions"><button type="button" class="purchase-confirm-submit" data-pc-submit>⚡ تایید و ثبت سفارش (${fmt(price)})</button><button type="button" class="purchase-confirm-cancel" data-pc-close>بازگشت و ویرایش انتخاب</button></div>
  </div>`;
  bindModal();
}
function variantPickerHtml(){
  if(!current.variants.length)return '';
  return `<section class="purchase-plan-step"><div class="purchase-step-head"><div><span>مرحله انتخاب پلن</span><h4>${current.scope==='vpn'?'پکیج موردنظرت رو انتخاب کن':'پلن نهایی رو انتخاب کن'}</h4></div><b>${current.variants.length} گزینه</b></div><div class="purchase-plan-grid">${current.variants.map((v,i)=>`<button type="button" class="purchase-plan-option ${v.id===Number(current.selectedId)?'active':''}" data-pc-variant="${v.id}"><span>${esc(v.title)}</span><strong>${fmt(v.price)} <small>تومان</small></strong>${i===current.variants.length-1&&current.scope==='vpn'&&current.variants.length>2?'<em>محبوب</em>':''}<i>✓</i></button>`).join('')}</div></section>`;
}
function starsPicker(){
  const presets=current.starsPresets.length?current.starsPresets:[100,500,1000,2500,5000];
  return `<section class="purchase-plan-step stars-step"><div class="purchase-step-head"><div><span>تعداد Telegram Stars</span><h4>مقدار نهایی رو قبل از خرید تنظیم کن</h4></div><b>${fmt(current.starsCount)} ⭐</b></div><div class="purchase-stars-counter"><button type="button" data-pc-stars="minus">−</button><input id="purchaseStarsInput" inputmode="numeric" type="number" min="${current.starsMin}" max="${current.starsMax}" step="${current.starsStep}" value="${current.starsCount}"><button type="button" data-pc-stars="plus">+</button></div><input id="purchaseStarsRange" class="purchase-stars-range" type="range" min="${current.starsMin}" max="${current.starsMax}" step="${current.starsStep}" value="${current.starsCount}"><div class="purchase-stars-presets">${presets.map(n=>`<button type="button" data-pc-preset="${n}" class="${Number(n)===Number(current.starsCount)?'active':''}">${fmt(n)}</button>`).join('')}</div></section>`;
}
function setStars(v){
  const step=Math.max(1,current.starsStep),base=current.starsMin;
  v=clamp(Number(v||base),current.starsMin,current.starsMax);v=base+Math.round((v-base)/step)*step;current.starsCount=clamp(v,current.starsMin,current.starsMax);render();
}
function bindModal(){
  modal.querySelectorAll('[data-pc-close]').forEach(b=>b.onclick=close);
  modal.querySelectorAll('[data-pc-variant]').forEach(b=>b.onclick=()=>{current.selectedId=Number(b.dataset.pcVariant);render()});
  modal.querySelector('[data-pc-stars="minus"]')?.addEventListener('click',()=>setStars(current.starsCount-current.starsStep));
  modal.querySelector('[data-pc-stars="plus"]')?.addEventListener('click',()=>setStars(current.starsCount+current.starsStep));
  modal.querySelectorAll('[data-pc-preset]').forEach(b=>b.onclick=()=>setStars(Number(b.dataset.pcPreset)));
  modal.querySelector('#purchaseStarsInput')?.addEventListener('change',e=>setStars(e.target.value));
  modal.querySelector('#purchaseStarsRange')?.addEventListener('change',e=>setStars(e.target.value));
  modal.querySelector('[data-pc-submit]').onclick=confirm;
}
async function confirm(){
  if(busy)return;
  const v=selectedVariant();
  if(current.variants.length&&!v){window.BGAccount?.toast?.('اول یک پلن انتخاب کن.','warn');return}
  const spec={productId:current.productId,variantId:v?.id||null,starsCount:current.scope==='stars'?current.starsCount:null};
  const coupon=modal.querySelector('#purchaseCoupon')?.value?.trim()||'';
  busy=true;const btn=modal.querySelector('[data-pc-submit]');if(btn){btn.disabled=true;btn.textContent='در حال ثبت سفارش…'}
  try{
    const logged=window.BGAccount?.isLogged?.();
    if(!logged) close();
    await window.BGAccount?.submitOrder?.(spec,coupon);
  }catch(e){window.BGAccount?.toast?.(e.message||'ثبت سفارش انجام نشد.','error');if(modal&&document.body.contains(modal)){btn.disabled=false;btn.textContent=`⚡ تایید و ثبت سفارش (${fmt(currentPrice())})`}}
  finally{busy=false}
}
function open(data){
  if(!data||busy)return null;
  current=normalize(data);if(!current.productId){window.BGAccount?.toast?.('محصول معتبر نیست.','error');return null}
  if(current.scope==='stars'&&!current.starsCount)current.starsCount=current.starsMin;
  close();modal=document.createElement('dialog');modal.id='purchaseConfirmModal';modal.className='purchase-confirm-overlay';document.body.appendChild(modal);document.documentElement.classList.add('purchase-confirm-open');document.body.classList.add('purchase-confirm-open');render();
  if(typeof modal.showModal==='function')modal.showModal();else modal.setAttribute('open','');
  modal.addEventListener('cancel',e=>{e.preventDefault();close()});modal.addEventListener('click',e=>{if(e.target===modal)close()});
  return modal;
}
function close(){if(modal){try{modal.close()}catch{};modal.remove();modal=null}document.documentElement.classList.remove('purchase-confirm-open');document.body.classList.remove('purchase-confirm-open')}
window.BGCheckout={open,close};
})();
