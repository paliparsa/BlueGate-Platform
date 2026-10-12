/* BlueGate shared AI live translation fallback for unknown Persian UI text. */
(function(){
'use strict';
const KEY='bluegate_language';
const isMini=!!window.BlueGateI18n;
const browser=(navigator.language||'').toLowerCase();
function getLang(){
  if(isMini)return window.BlueGateI18n.language;
  const saved=localStorage.getItem(KEY);
  if(saved==='fa'||saved==='en')return saved;
  return browser==='fa'||browser.startsWith('fa-')?'fa':'en';
}
function setLang(next){
  if(next!=='fa'&&next!=='en')return;
  if(isMini&&window.BlueGateI18n?.setLanguage){window.BlueGateI18n.setLanguage(next);return;}
  localStorage.setItem(KEY,next);location.reload();
}
function setupToggle(){
  if(isMini||document.getElementById('bgAiLanguageToggle'))return;
  const host=document.querySelector('.header-actions');
  if(!host)return;
  const b=document.createElement('button');
  b.id='bgAiLanguageToggle';b.type='button';b.className='bg-account-btn';
  b.style.whiteSpace='nowrap';b.style.minHeight='38px';
  b.addEventListener('click',()=>setLang(getLang()==='en'?'fa':'en'));
  host.prepend(b);
  const paint=()=>{b.textContent=getLang()==='en'?'🇮🇷 فارسی':'🇬🇧 EN';b.setAttribute('aria-label',getLang()==='en'?'Switch to Persian':'Switch to English');};
  paint();
}
const attempted=new WeakSet();
const skip='script,style,textarea,pre,code,input,select,option,[contenteditable="true"],[data-no-translate],#bluegateLanguageToggle,#bgAiLanguageToggle';
const hasPersian=s=>/[\u0600-\u06FF]/.test(s||'');
let queue=new Map(), timer=0, running=false;
function addNode(node){
  if(!node||node.nodeType!==Node.TEXT_NODE||attempted.has(node))return;
  const value=node.nodeValue||'';
  if(!value.trim()||!hasPersian(value))return;
  if(node.parentElement?.closest(skip))return;
  attempted.add(node);queue.set(node,value);
}
function scan(root){
  if(getLang()!=='en'||!root)return;
  if(root.nodeType===Node.TEXT_NODE){addNode(root);schedule();return;}
  if(root.nodeType!==Node.ELEMENT_NODE&&root!==document)return;
  if(root.nodeType===Node.ELEMENT_NODE&&root.closest?.(skip))return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  while(walker.nextNode())addNode(walker.currentNode);
  schedule();
}
function schedule(){if(timer||running||!queue.size)return;timer=window.setTimeout(flush,120);}
async function flush(){
  timer=0;if(running||!queue.size||getLang()!=='en')return;
  running=true;
  try{
    while(queue.size&&getLang()==='en'){
      const entries=Array.from(queue.entries()).slice(0,20);
      for(const [node] of entries)queue.delete(node);
      const texts=Array.from(new Set(entries.map(x=>x[1])));
      try{
        const res=await fetch('/api.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({action:'translate_text',target:'en',context:'ui',texts})});
        if(!res.ok)continue;
        const data=await res.json(), translations=data.translations||{};
        for(const [node,source] of entries){
          const translated=translations[source];
          if(typeof translated==='string'&&translated.trim()&&translated!==source&&node.isConnected&&node.nodeValue===source)node.nodeValue=translated;
        }
      }catch(_){/* Keep source text if translation is unavailable. */}
    }
  }finally{running=false;if(queue.size)schedule();}
}
function init(){
  setupToggle();
  if(!isMini){
    const lang=getLang();document.documentElement.lang=lang;document.documentElement.dir=lang==='fa'?'rtl':'ltr';
    document.body.classList.toggle('bluegate-lang-en',lang==='en');
  }
  if(getLang()==='en')scan(document.body);
  const observer=new MutationObserver(records=>{
    if(getLang()!=='en')return;
    for(const record of records){
      if(record.type==='childList')record.addedNodes.forEach(n=>scan(n));
      else if(record.type==='characterData')addNode(record.target);
    }
    schedule();
  });
  observer.observe(document.body,{subtree:true,childList:true,characterData:true});
  if(isMini&&window.BlueGateI18n){
    const prior=window.BlueGateI18n.refresh;
    window.BlueGateI18n.refresh=()=>{try{prior?.()}finally{scan(document.body)}};
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();