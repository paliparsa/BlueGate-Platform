(function(){
  const cfg=()=>window.BG_CONFIG||{};
  function token(){return ''}
  function setToken(_v){localStorage.removeItem('bg_web_token');sessionStorage.removeItem('bg_web_token_session')}
  async function call(action,body={},method='POST'){
    const url=new URL(cfg().API_URL||'../api.php',location.href);
    const headers={'Accept':'application/json','Content-Type':'application/json'};
    const t='';
    let opts={method,headers,cache:'no-store',credentials:'include'};
    if(method==='GET') Object.entries({action,...body}).forEach(([k,v])=>url.searchParams.set(k,String(v)));
    else opts.body=JSON.stringify({action,...body,is_web:1});
    const r=await fetch(url,opts); let data={};
    try{data=await r.json()}catch(_){data={ok:false,message:'پاسخ نامعتبر از سرور'}}
    if(!r.ok||data.ok===false){const e=new Error(data.message||data.error||('HTTP '+r.status));e.code=data.error;e.data=data;throw e}
    return data;
  }
  window.BGApi={configured:()=>true,call,token,setToken,me:()=>call('me',{},'GET'),storefront:()=>call('storefront',{},'GET'),login:(identifier,password,remember=true)=>call('login',{identifier,password,remember:remember?1:0}),register:(x)=>call('register',x),logout:async()=>{try{await call('logout')}finally{setToken('')}},createOrder:(x)=>call('create_order',x),applyCoupon:(id,code)=>call('apply_coupon',{order_id:id,code}),applyWallet:(id)=>call('apply_wallet',{order_id:id}),selectPayment:(id,method,details={})=>call('select_payment_method',{order_id:id,method,details}),submitReceipt:(id,note,receipt_b64=null)=>call('submit_receipt',{order_id:id,note,receipt_b64}),myOrders:()=>call('my_orders',{},'GET')};
})();
