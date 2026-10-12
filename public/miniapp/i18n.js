/* BlueGate Mini App bilingual UI. Offline dictionary; no third-party translation requests. */
(function(){
'use strict';
const KEY='bluegate_language';
const translations={
'سلام':'Hello','سلام 👋':'Hello 👋','فروشگاه':'Shop','محصولات و سرویس‌ها':'Products & Services','سرویس موردنظرت رو سریع پیدا کن.':'Find the service you need.','جستجوی سرویس یا اشتراک...':'Search services or subscriptions...','همه':'All','ویژه':'Featured','مشاهده پلن‌ها':'View plans','سفارش':'Orders','سفارش‌ها':'Orders','حساب کاربری':'Account','پشتیبانی':'Support','کیف پول':'Wallet','اعتبار BlueGate':'BlueGate Balance','موجودی':'Balance','تراکنش‌ها':'Transactions','دعوت دوستان':'Refer Friends','ماموریت‌ها':'Missions','دستاوردها':'Achievements','اعلان‌ها':'Notifications','تنظیمات':'Settings','ورود':'Sign in','خروج':'Sign out','ثبت‌نام':'Create account','ورود به حساب':'Sign in','ایجاد حساب کاربری':'Create account','نام کاربری':'Username','ایمیل':'Email','رمز عبور':'Password','نام':'Name','کد معرف':'Referral code','کد تخفیف':'Discount code','اختیاری':'Optional','ثبت کد':'Apply code','اعمال شد ✓':'Applied ✓','پلن مناسب رو انتخاب کن':'Choose your plan','انتخاب پلن':'Choose a plan','گزینه':'options','سرویس انتخابی':'Selected service','پلن':'Plan','نوع تحویل':'Delivery method','مدت اعتبار':'Duration','روز':'days','بدون مدت مشخص':'No fixed duration','توضیحات':'Description','مبلغ قابل پرداخت':'Amount due','مبلغ نهایی بعد از تخفیف':'Final amount after discount','تومان':'IRR','تخفیف':'discount','سفارش از داخل حساب BlueGate قابل پیگیری است.':'Track your order from your BlueGate account.','تایید و ثبت سفارش':'Confirm order','بازگشت':'Back','بستن':'Close','در حال ثبت سفارش…':'Submitting order…','در حال ثبت…':'Submitting…','محصول BlueGate':'BlueGate product','سرویس‌ها':'Services','دسته‌بندی':'Category','فیلتر':'Filter','مرتب‌سازی':'Sort','جدیدترین':'Newest','ارزان‌ترین':'Lowest price','گران‌ترین':'Highest price','اعمال فیلتر':'Apply filters','پاک کردن':'Clear','View All':'View all','سفارش مجدد / رفرش':'Order again / refresh','روش پرداخت':'Payment method','انتخاب نشده':'Not selected','یکی از روش‌های زیر را برای پرداخت انتخاب کن:':'Choose a payment method:','کارت به کارت':'Bank transfer','پرداخت دستی با رسید':'Manual payment with receipt','Telegram Stars':'Telegram Stars','رمزارز':'Cryptocurrency','انتخاب روش پرداخت':'Choose payment method','پرداخت':'Payment','پرداخت موفق':'Payment successful','ثبت سفارش':'Place order','لغو سفارش':'Cancel order','مهلت پرداخت:':'Payment time left:','مهلت پرداخت این سفارش به پایان رسیده است':'This order has expired','زمان مجاز برای تکمیل پرداخت ۲۰ دقیقه بود که به اتمام رسید. برای ادامه می‌توانید سفارش جدیدی ثبت کنید.':'The 20-minute payment window has expired. Place a new order to continue.','اعتبار کیف پول':'Wallet balance','افزایش موجودی':'Add funds','شارژ کیف پول':'Top up wallet','مبلغ':'Amount','مبلغ دقیق:':'Exact amount:','ارسال رسید':'Submit receipt','ارسال رسید و بررسی ادمین':'Upload receipt for review','ولت مقصد را انتخاب کن.':'Choose a destination wallet.','انتخاب رمزارز':'Choose cryptocurrency','در حال ارسال…':'Sending…','در حال بررسی…':'Checking…','تایید':'Confirm','تایید و ورود به حساب':'Confirm and sign in','کد تایید ایمیل 📩':'Email verification code 📩','کد ۶ رقمی به ایمیل':'A 6-digit code was sent to','ارسال مجدد کد تایید':'Resend verification code','ارسال مجدد کد':'Resend code','کد تایید جدید ارسال شد 📩':'A new verification code was sent 📩','ایمیل شما تایید شد! 🎉':'Your email has been verified! 🎉','خطا':'Error','موفق':'Success','لغو':'Cancel','ذخیره':'Save','ویرایش':'Edit','حذف':'Delete','جزئیات':'Details','وضعیت':'Status','تاریخ':'Date','نام محصول':'Product name','قیمت':'Price','قیمت دلاری':'USD price','تخفیف ویژه':'Special offer','تحویل سریع':'Fast delivery','پشتیبانی مستقیم':'Direct support','پرداخت یکپارچه':'Unified checkout','کیف پول و رفرال':'Wallet & referrals','سرویس‌های دیجیتال، ساده و سریع':'Digital services, simple and fast','پشتیبانی از حساب BlueGate':'BlueGate account support','استعلام مستقیم از پشتیبانی':'Contact support','⚠️ استعلام موجودی و تایید سفارش از پشتیبانی':'⚠️ Confirm availability with support','قبل از انجام هرگونه پرداخت (کارت به کارت، اعتبار BlueGate، کریپتو)، حتماً از طریق پشتیبانی موجودی و امکان تحویل فوری محصول را استعلام و تایید کنید.':'Before paying, contact support to confirm availability and immediate delivery.','رسید ثبت شد و منتظر بررسی است.':'Receipt submitted and awaiting review.','برای ثبت سفارش اول وارد حساب شو.':'Please sign in before placing an order.','پلن انتخاب‌شده معتبر نیست. دوباره انتخاب کن.':'The selected plan is invalid. Please choose again.','اول پلن موردنظرت رو انتخاب کن.':'Choose a plan first.','محصول یا پلن پیدا نشد یا غیرفعال است.':'Product or plan not found or inactive.','در حال بارگذاری…':'Loading…','بارگذاری مجدد':'Reload','صفحه اصلی':'Home','صفحه قبل':'Previous page','صفحه بعد':'Next page','بیشتر':'More','کمتر':'Less','ناموفق':'Failed','منتظر پرداخت':'Awaiting payment','در انتظار بررسی':'Pending review','تکمیل‌شده':'Completed','تکمیل شده':'Completed','رد شده':'Rejected','در حال آماده‌سازی':'Preparing','تحویل شده':'Delivered','در حال پردازش':'Processing','فعال':'Active','غیرفعال':'Inactive','کپی شد':'Copied','کپی':'Copy','تغییر زبان':'Change language','English':'English','فارسی':'فارسی','دلار':'USD','درصد':'percent','اعتبار':'Balance','راهنما':'Help','سوالات متداول':'FAQ','نظرات کاربران':'Customer reviews','مشاهده همه':'View all','پیگیری سفارش':'Track order','ثبت و پیگیری سفارش':'Place and track orders','خرید سریع':'Quick purchase','سبد خرید':'Cart','افزودن به سبد':'Add to cart','اشتراک‌گذاری':'Share','کد را وارد کن و «ثبت کد» را بزن.':'Enter the code and tap Apply.','کد تخفیف معتبر نیست.':'Invalid discount code.','کد تخفیف را وارد کن.':'Enter a discount code.','ارسال مجدد کد تایید':'Resend verification code','انتخاب محصول':'Choose a product','محصولات':'Products','فروشگاه دیجیتال':'Digital store','برای ادامه وارد حساب شو':'Sign in to continue','حساب من':'My account','مرکز اعتبار':'Balance center','دعوت و پاداش':'Referrals & rewards','راهنمای استفاده':'How it works','پیام‌ها':'Messages','پاسخ پشتیبانی':'Support reply','ارسال پیام':'Send message','موضوع':'Subject','متن پیام':'Message','ثبت تیکت':'Create ticket','بستن تیکت':'Close ticket','باز':'Open','بسته':'Closed','پاسخ جدید':'New reply','امتیاز':'Rating','نفر':'people','مورد':'items','امروز':'Today','دیروز':'Yesterday','ناموجود':'Unavailable','انتخاب':'Select','ادامه':'Continue','تایید نهایی':'Confirm','ثبت تغییرات':'Save changes','ذخیره تغییرات':'Save changes','در حال ذخیره…':'Saving…','جستجو':'Search','جستجو...':'Search...','هیچ موردی پیدا نشد':'No items found','هنوز سفارشی ثبت نکرده‌ای.':'You have no orders yet.','سفارشی ثبت نشده است.':'No orders yet.','برای مشاهده سفارش‌ها وارد حساب شو.':'Sign in to view orders.'
};
const pairs=Object.entries(translations).sort((a,b)=>b[0].length-a[0].length);
function detectInternational(){
 const country=String(window.BlueGateRegion||'').toUpperCase();
 if(country) return country!=='IR';
 const lang=String(window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code||navigator.language||'').toLowerCase();
 return !(lang==='fa'||lang.startsWith('fa-')||lang==='fa_ir');
}
function getLanguage(){
 const saved=localStorage.getItem(KEY);if(saved==='fa'||saved==='en')return saved;
 const tgLang=String(window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code||'').toLowerCase();
 const browser=String(navigator.language||'').toLowerCase();
 return (tgLang==='fa'||tgLang.startsWith('fa-')||browser==='fa'||browser.startsWith('fa-'))?'fa':'en';
}
let language=getLanguage(), translating=false;
function translateString(value){
 let s=String(value??''); if(language!=='en')return s;
 for(const [fa,en] of pairs){if(s===fa)return en;}
 for(const [fa,en] of pairs){if(fa.length>=4&&s.includes(fa))s=s.split(fa).join(en);}
 return s;
}
function translateElement(root){
 if(language!=='en'||!root||translating)return;
 translating=true;
 try{
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let nodes=[];
  while(walker.nextNode())nodes.push(walker.currentNode);
  for(const node of nodes){if(node.parentElement?.closest('#bluegateLanguageToggle,script,style,textarea,pre,code,[data-no-translate]'))continue;const old=node.nodeValue;if(old&&old.trim()){const next=translateString(old);if(next!==old)node.nodeValue=next;}}
  root.querySelectorAll?.('input[placeholder],textarea[placeholder],[aria-label],[title]').forEach(el=>{for(const attr of ['placeholder','aria-label','title'])if(el.hasAttribute(attr)){const old=el.getAttribute(attr),next=translateString(old);if(next!==old)el.setAttribute(attr,next);}});
 } finally {translating=false;}
}
function apply(){
 language=localStorage.getItem(KEY)||language;
 document.documentElement.lang=language;document.documentElement.dir=language==='fa'?'rtl':'ltr';
 document.body.classList.toggle('bluegate-lang-en',language==='en');
 const b=document.getElementById('bluegateLanguageToggle');if(b){b.textContent=language==='fa'?'🇬🇧 EN':'🇮🇷 فارسی';b.setAttribute('aria-label',language==='fa'?'Switch to English':'تغییر به فارسی');}
 if(language==='en')translateElement(document.body);
 else location.reload();
}
function setLanguage(next){if(next!=='fa'&&next!=='en')return;localStorage.setItem(KEY,next);language=next;location.reload();}
function init(){
 if(!document.body)return;
 const top=document.querySelector('.topbar');
 if(top&&!document.getElementById('bluegateLanguageToggle')){
  const b=document.createElement('button');b.id='bluegateLanguageToggle';b.type='button';b.className='bluegate-language-toggle';b.textContent=language==='fa'?'🇬🇧 EN':'🇮🇷 فارسی';b.title='Change language';b.onclick=()=>setLanguage(language==='fa'?'en':'fa');top.appendChild(b);
 }
 document.documentElement.lang=language;document.documentElement.dir=language==='fa'?'rtl':'ltr';document.body.classList.toggle('bluegate-lang-en',language==='en');
 if(language==='en')translateElement(document.body);
 const mo=new MutationObserver(records=>{if(language!=='en')return;for(const r of records){if(r.type==='childList'){r.addedNodes.forEach(n=>{if(n.nodeType===Node.TEXT_NODE){const v=translateString(n.nodeValue);if(v!==n.nodeValue)n.nodeValue=v;}else if(n.nodeType===Node.ELEMENT_NODE)translateElement(n);});}else if(r.type==='characterData'){const v=translateString(r.target.nodeValue);if(v!==r.target.nodeValue)r.target.nodeValue=v;}}});
 mo.observe(document.body,{subtree:true,childList:true,characterData:true});
 window.BlueGateI18n={get language(){return language;},setLanguage,isInternational:detectInternational,translate:translateString,refresh:()=>translateElement(document.body)};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();