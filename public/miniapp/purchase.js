(function(){
'use strict';
let overlay=null,current=null,busy=false;
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const fmt=v=>Number(v||0).toLocaleString('en-US');
const couponCode=v=>String(v||'').trim().toUpperCase().replace(/[^A-Z0-9_-]/g,'');
function normalize(data){
  const variants=(data.variants||[]).map(v=>({
    id:Number(v.id||v.variant_id||0),title:String(v.title||v.label||'پلن'),price:Number(v.price??v.price_toman??0),
    duration_days:Number(v.duration_days||0),description:String(v.description||''),old_price:Number(v.old_price||0),
    discount_percent:Number(v.discount_percent||0),product_id:Number(v.product_id||0)
  })).filter(v=>v.id);
  let selectedId=Number(data.variantId||data.selectedVariantId||0)||null;
  if(selectedId&&!variants.some(v=>v.id===selectedId))selectedId=null;if(!selectedId&&variants.length)selectedId=variants[0].id;
  return {
    productId:Number(data.productId||0),product:String(data.product||'محصول BlueGate'),description:String(data.description||''),
    image:String(data.image||data.image_url||''),icon:String(data.icon||'⚡'),badge:String(data.badge||'BlueGate Service'),
    delivery:String(data.delivery||data.delivery_type_fa||'تحویل و پیگیری از حساب BlueGate'),variants,selectedId,
    basePrice:Number(data.price||data.toman||0),onSubmit:data.onSubmit,onCart:data.onCart,onShare:data.onShare,onError:data.onError,
    onCouponPreview:data.onCouponPreview,coupon:null,couponInput:''
  };
}
function selected(){return current?.variants.find(v=>v.id===Number(current.selectedId))||null}
function price(){return Number(selected()?.price??current?.basePrice??0)}
function payablePrice(){return current?.coupon?Number(current.coupon.final_amount??price()):price()}
function title(){return selected()?.title||current?.delivery||'سفارش مستقیم'}
function duration(){const v=selected();return v?.duration_days>0?`${fmt(v.duration_days)} روز`:'بدون مدت مشخص'}
function originalPrice(v){if(!v)return 0;if(v.old_price>v.price)return v.old_price;if(v.discount_percent>0&&v.discount_percent<100)return Math.round(v.price/(1-v.discount_percent/100));return 0}
function clearCoupon(){if(current)current.coupon=null}
function plans(){if(!current.variants.length)return '';return `<section class="purchase-plan-step"><div class="purchase-step-head"><div><span>انتخاب پلن</span><h4>پلن مناسب رو انتخاب کن</h4></div><b>${current.variants.length} گزینه</b></div><div class="purchase-plan-grid">${current.variants.map(v=>`<button type="button" class="purchase-plan-option ${v.id===Number(current.selectedId)?'active':''}" data-mini-purchase-variant="${v.id}"><span>${esc(v.title)}</span><strong>${fmt(v.price)} <small>تومان</small></strong>${v.discount_percent?`<em>${fmt(v.discount_percent)}٪ تخفیف</em>`:''}<i>✓</i></button>`).join('')}</div></section>`}
function render(){
  if(!overlay||!current)return;const v=selected(),p=price(),payable=payablePrice(),orig=originalPrice(v),coupon=current.coupon;
  overlay.innerHTML=`<div class="purchase-confirm-card mini-purchase-card" role="dialog" aria-modal="true" aria-label="خرید ${esc(current.product)}">
    <div class="mini-purchase-grabber" aria-hidden="true"></div>
    <div class="purchase-confirm-header"><button class="purchase-confirm-close" type="button" data-mini-purchase-close aria-label="بستن">✕</button><div class="purchase-confirm-brand"><div><h3>${esc(current.product)}</h3><p>${esc(current.badge)}</p></div><div class="purchase-confirm-avatar">${current.image?`<img src="${esc(current.image)}" alt="">`:`<span>${esc(current.icon)}</span>`}</div></div></div>
    ${plans()}
    <div class="purchase-confirm-specs"><div><span>سرویس انتخابی</span><b class="cyan">${esc(current.product)}</b></div><div><span>پلن</span><b>${esc(title())}</b></div><div><span>نوع تحویل</span><b>${esc(current.delivery)}</b></div><div><span>مدت اعتبار</span><b class="green">${esc(duration())}</b></div></div>
    ${(v?.description||current.description)?`<div class="purchase-confirm-desc"><b>توضیحات</b><p>${esc(v?.description||current.description)}</p></div>`:''}
    <div class="purchase-confirm-price"><span>${coupon?'مبلغ بعد از تخفیف':'مبلغ قابل پرداخت'}</span><div>${coupon?`<s>${fmt(p)}</s>`:(orig?`<s>${fmt(orig)}</s>`:'')}<strong>${fmt(payable)}</strong><small>تومان</small></div></div>
    <div class="purchase-confirm-guarantee">🛡️ سفارش از داخل حساب BlueGate قابل پیگیری است.</div>
    <div class="purchase-confirm-coupon"><span>کد تخفیف <small>اختیاری</small></span><div class="purchase-coupon-row"><input id="miniPurchaseCoupon" autocomplete="off" value="${esc(current.couponInput||coupon?.code||'')}" placeholder="مثلاً WELCOME10"><button type="button" data-mini-purchase-coupon>${coupon?'اعمال شد ✓':'ثبت کد'}</button></div><div class="purchase-coupon-feedback ${coupon?'success':''}">${coupon?`کد ${esc(coupon.code)} فعال شد؛ ${fmt(coupon.discount_amount)} تومان تخفیف.`:'کد را وارد کن و «ثبت کد» را بزن.'}</div></div>
    <div class="mini-purchase-secondary-actions">${typeof current.onShare==='function'?'<button type="button" data-mini-purchase-share>↗ اشتراک‌گذاری</button>':''}${typeof current.onCart==='function'?'<button type="button" data-mini-purchase-cart>＋ افزودن به سبد</button>':''}</div>
    <div class="purchase-confirm-actions"><button type="button" class="purchase-confirm-submit" data-mini-purchase-submit>⚡ تایید و ثبت سفارش (${fmt(payable)})</button><button type="button" class="purchase-confirm-cancel" data-mini-purchase-close>بازگشت</button></div>
  </div>`;bind();
}
function bind(){
  overlay.querySelectorAll('[data-mini-purchase-close]').forEach(b=>b.onclick=close);
  overlay.querySelectorAll('[data-mini-purchase-variant]').forEach(b=>b.onclick=()=>{const id=Number(b.dataset.miniPurchaseVariant);if(current.variants.some(v=>v.id===id)){current.selectedId=id;clearCoupon();render();try{window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light')}catch(_){}}});
  overlay.querySelector('#miniPurchaseCoupon')?.addEventListener('input',e=>{current.couponInput=e.target.value;if(current.coupon&&couponCode(e.target.value)!==current.coupon.code)current.coupon=null});
  overlay.querySelector('[data-mini-purchase-coupon]')?.addEventListener('click',applyCouponPreview);
  overlay.querySelector('[data-mini-purchase-share]')?.addEventListener('click',()=>current.onShare?.({productId:current.productId,variantId:selected()?.id||null}));
  overlay.querySelector('[data-mini-purchase-cart]')?.addEventListener('click',()=>{current.onCart?.({productId:current.productId,variantId:selected()?.id||null});close()});
  overlay.querySelector('[data-mini-purchase-submit]')?.addEventListener('click',submit);
}
async function applyCouponPreview(){
  if(busy)return false;const code=couponCode(overlay?.querySelector('#miniPurchaseCoupon')?.value||current.couponInput||'');if(!code){current.onError?.(new Error('کد تخفیف را وارد کن.'));return false}
  const btn=overlay?.querySelector('[data-mini-purchase-coupon]');if(btn){btn.disabled=true;btn.textContent='بررسی…'}
  try{if(typeof current.onCouponPreview!=='function')throw new Error('بررسی کد تخفیف آماده نیست.');const v=selected();const r=await current.onCouponPreview({code,productId:Number(v?.product_id||current.productId),variantId:v?.id||null});current.couponInput=code;current.coupon=r?.coupon||r;render();return true}
  catch(e){current.coupon=null;const fb=overlay?.querySelector('.purchase-coupon-feedback');if(fb){fb.className='purchase-coupon-feedback error';fb.textContent=e.message||'کد تخفیف معتبر نیست.'}try{current.onError?.(e)}catch(_){}if(btn){btn.disabled=false;btn.textContent='ثبت کد'}return false}
}
async function submit(){
  if(busy)return;const v=selected();if(current.variants.length&&!v)return;current.couponInput=overlay?.querySelector('#miniPurchaseCoupon')?.value?.trim()||current.couponInput||'';const typed=couponCode(current.couponInput);if(typed&&current.coupon?.code!==typed){const ok=await applyCouponPreview();if(!ok)return}
  const btn=overlay?.querySelector('[data-mini-purchase-submit]');busy=true;if(btn){btn.disabled=true;btn.textContent='در حال ثبت سفارش…'}
  try{if(typeof current.onSubmit!=='function')throw new Error('مسیر ثبت سفارش آماده نیست.');await current.onSubmit({productId:current.productId,variantId:v?.id||null,orderProductId:Number(v?.product_id||current.productId),coupon:current.coupon?.code||''});close()}
  catch(e){if(btn&&overlay){btn.disabled=false;btn.textContent=`⚡ تایید و ثبت سفارش (${fmt(payablePrice())})`}try{current?.onError?.(e)}catch(_){}}
  finally{busy=false}
}
function open(data){if(busy)return null;current=normalize(data||{});if(!current.productId)return null;close(false);overlay=document.createElement('div');overlay.id='miniPurchaseOverlay';overlay.className='purchase-confirm-overlay mini-purchase-overlay';document.body.appendChild(overlay);document.documentElement.classList.add('purchase-confirm-open');document.body.classList.add('purchase-confirm-open');overlay.addEventListener('click',e=>{if(e.target===overlay)close()});render();requestAnimationFrame(()=>overlay.classList.add('open'));return overlay}
function close(reset=true){if(overlay){overlay.classList.remove('open');const old=overlay;overlay=null;setTimeout(()=>old.remove(),160)}document.documentElement.classList.remove('purchase-confirm-open');document.body.classList.remove('purchase-confirm-open');if(reset)current=null}
window.BlueGatePurchase={open,close};
})();
