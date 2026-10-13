/* BlueGate shared live UI translation. Provider credentials stay server-side. */
(function(){
'use strict';
const KEY='bluegate_language';
const isMini=!!document.getElementById('userApp')||!!document.getElementById('adminApp')||!!window.BlueGateI18n;
function getLang(){
 if(isMini)return window.BlueGateI18n?.language||'fa';
 try{const saved=localStorage.getItem(KEY);if(saved==='fa'||saved==='en')return saved;}catch(_){}
 return 'fa';
}
function setLang(next){
 if(next!=='fa'&&next!=='en')return;
 if(isMini&&window.BlueGateI18n?.setLanguage){window.BlueGateI18n.setLanguage(next);return;}
 try{localStorage.setItem(KEY,next);}catch(_){}
 location.reload();
}
function setupToggle(){
 if(isMini)return;
 let b=document.getElementById('bgAiLanguageToggle');
 const host=document.querySelector('.header-actions');
 if(!b&&host){b=document.createElement('button');b.id='bgAiLanguageToggle';b.type='button';b.className='bg-account-btn';host.prepend(b);}
 if(!b)return;
 b.classList.add('bg-language-toggle');b.type='button';
 if(b.dataset.languageBound!=='1'){b.dataset.languageBound='1';b.addEventListener('click',()=>setLang(getLang()==='en'?'fa':'en'));}
 const lang=getLang();
 const iranLionSun='<img class="bg-lang-flag-ir" src="https://flagofiran.com/files/flag-of-iran-emoji-toss-face.svg" width="28" height="28" alt="Iran Lion and Sun flag" style="display:block;width:28px;height:28px;object-fit:contain" onerror="this.onerror=null;this.src=\'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b7/Lion_and_Sun_flag_%28emoji%29.svg/960px-Lion_and_Sun_flag_%28emoji%29.svg.png\';this.onerror=function(){this.replaceWith(document.createTextNode(\'🦁☀️\'))}" />'
 b.innerHTML=lang==='en'?iranLionSun:'<span class="bg-lang-flag-us" role="img" aria-label="United States flag">🇺🇸</span>';
 b.style.minWidth='46px';b.style.width='46px';b.style.justifyContent='center';b.style.paddingInline='6px';
 b.setAttribute('aria-label',lang==='en'?'Switch to Persian':'Switch to English');
 b.title=lang==='en'?'Switch to Persian':'Switch to English';
}
const attemptedNodes=new WeakMap(),attemptedAttrs=new WeakMap();
const skip='script,style,textarea,pre,code,[contenteditable="true"],[data-no-translate],[data-private],[data-user-content],.support-message,.ticket-message,.chat-message,.user-message,.customer-message,.review-content,.review-text,.user-content,#bluegateLanguageToggle,#bgAiLanguageToggle,[data-language-toggle]';
const hasPersian=s=>/[\u0600-\u06FF]/.test(s||'');
let queue=new Map(),timer=0,running=false;
function splitSource(source){
 if(source.length<=480)return [source];
 const parts=[];let rest=source;
 while(rest.length>480){let cut=rest.lastIndexOf(' ',480);if(cut<180)cut=480;parts.push(rest.slice(0,cut).trim());rest=rest.slice(cut).trim();}
 if(rest)parts.push(rest);
 return parts.filter(Boolean);
}
function makeTask(source,apply,previous){return {source,parts:splitSource(source),apply,retries:previous?.source===source?(previous.retries||0):0};}
function addNode(node){
 if(!node||node.nodeType!==Node.TEXT_NODE)return;
 const source=node.nodeValue||'',prior=attemptedNodes.get(node);
 if(!source.trim()||!hasPersian(source)||node.parentElement?.closest(skip)||prior?.source===source)return;
 const task=makeTask(source,translated=>{if(node.isConnected&&node.nodeValue===source)node.nodeValue=translated;},prior);
 attemptedNodes.set(node,task);queue.set(node,task);schedule();
}
function addAttributes(root){
 if(!root||root.nodeType!==Node.ELEMENT_NODE||root.closest?.(skip))return;
 const nodes=[root,...root.querySelectorAll('[placeholder],[aria-label],[title],[alt],input[type="button"][value],input[type="submit"][value]')];
 for(const el of nodes){
  if(el.closest?.(skip))continue;
  for(const attr of ['placeholder','aria-label','title','alt','value']){
   if(!el.hasAttribute(attr))continue;
   if(attr==='value'&&!/^(button|submit)$/i.test(el.getAttribute('type')||''))continue;
   const source=el.getAttribute(attr)||'';
   if(!source.trim()||!hasPersian(source))continue;
   let seen=attemptedAttrs.get(el);if(!seen){seen=new Map();attemptedAttrs.set(el,seen);}
   const prior=seen.get(attr);if(prior?.source===source)continue;
   const task=makeTask(source,translated=>{if(el.isConnected&&el.getAttribute(attr)===source)el.setAttribute(attr,translated);},prior);
   seen.set(attr,task);queue.set(task,task);
  }
 }
}
function scan(root){
 if(getLang()!=='en'||!root)return;
 if(root.nodeType===Node.TEXT_NODE){addNode(root);return;}
 if(root.nodeType!==Node.ELEMENT_NODE&&root!==document)return;
 if(root.nodeType===Node.ELEMENT_NODE&&root.closest?.(skip))return;
 if(root.nodeType===Node.ELEMENT_NODE)addAttributes(root);
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 while(walker.nextNode())addNode(walker.currentNode);
 schedule();
}
function schedule(delay=140){if(timer||running||!queue.size)return;timer=window.setTimeout(flush,delay);}
async function requestTranslations(texts){
 const res=await fetch('/api.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({action:'translate_text',target:'en',context:'ui',texts})});
 let data={};try{data=await res.json();}catch(_){}
 const retryAfter=Math.max(0,Number(data.retry_after||res.headers.get('Retry-After')||0)||0);
 if(!res.ok){const err=new Error('translation_http_'+res.status);err.status=res.status;err.retryAfter=retryAfter;requestTranslations.lastRetryAfter=retryAfter;throw err;}
 requestTranslations.lastRetryAfter=retryAfter;
 return data;
}
function retryTask(task,key){
 task.retries=(task.retries||0)+1;
 if(task.retries>8){console.warn('[BlueGate translation] Translation skipped after 8 attempts; switch language or reload to retry.');return;}
 queue.set(key,task);
}
async function flush(){
 timer=0;if(running||!queue.size||getLang()!=='en')return;
 running=true;let retryDelay=220;
 try{
  while(queue.size&&getLang()==='en'){
   const entries=Array.from(queue.entries()).slice(0,20);
   for(const [key] of entries)queue.delete(key);
   const tasks=entries.map(([key,task])=>({key,task}));
   const pieces=[];for(const entry of tasks)entry.task.parts.forEach((source,index)=>pieces.push({source,index,entry}));
   const unique=Array.from(new Set(pieces.map(x=>x.source)));
   const translations={};let failed=false;
   for(let offset=0;offset<unique.length;offset+=20){
    try{const data=await requestTranslations(unique.slice(offset,offset+20));Object.assign(translations,data.translations||{});if(data.provider_configured===false)console.warn('[BlueGate translation] No AI provider is configured on the server.');}
    catch(err){failed=true;retryDelay=err?.retryAfter>0?Math.min(1800000,err.retryAfter*1000):((err?.status===429||err?.status===503)?Math.min(60000,Math.max(5000,retryDelay*2)):Math.min(30000,Math.max(retryDelay,1500)));console.warn('[BlueGate translation] Request failed (HTTP '+(err?.status||'network')+'); retry scheduled.');break;}
   }
   if(failed){tasks.forEach(({key,task})=>retryTask(task,key));if(queue.size)await new Promise(resolve=>setTimeout(resolve,retryDelay));continue;}
   const failedTasks=new Set();
   for(const {key,task} of tasks){
    const translatedParts=task.parts.map(part=>translations[part]);
    if(translatedParts.some(value=>typeof value!=='string'||!value.trim()||hasPersian(value))){failedTasks.add(key);continue;}
    const translated=translatedParts.join(' ');
    if(translated.trim()&&translated!==task.source)task.apply(translated);
   }
   for(const {key,task} of tasks)if(failedTasks.has(key))retryTask(task,key);
   if(failedTasks.size){
    retryDelay=Math.max(retryDelay,900);
    if(requestTranslations.lastRetryAfter>0)retryDelay=Math.min(1800000,Math.max(retryDelay,requestTranslations.lastRetryAfter*1000));
    await new Promise(resolve=>setTimeout(resolve,retryDelay));
   }
  }
 }finally{running=false;if(queue.size)schedule(retryDelay);}
}
function init(){
 setupToggle();
 if(!isMini){const lang=getLang();document.documentElement.lang=lang;document.documentElement.dir=lang==='fa'?'rtl':'ltr';document.body.classList.toggle('bluegate-lang-en',lang==='en');}
 if(getLang()==='en')scan(document.body);
 const observer=new MutationObserver(records=>{
  if(getLang()!=='en')return;
  for(const record of records){if(record.type==='childList')record.addedNodes.forEach(n=>scan(n));else if(record.type==='characterData')addNode(record.target);else if(record.type==='attributes')scan(record.target);}
  schedule();
 });
 observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','aria-label','title','alt','value']});
 if(isMini&&window.BlueGateI18n){const prior=window.BlueGateI18n.refresh;window.BlueGateI18n.refresh=()=>{try{prior?.()}finally{scan(document.body)}};}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();