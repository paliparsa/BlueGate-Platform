(function(){
  function ceil(v,d=2){const p=10**d;return Math.ceil((Number(v)-Number.EPSILON)*p)/p}
  function amounts(toman,r){const usdt=Number(toman)/Math.max(1,Number(r.usdt_toman||1));return {usdt:ceil(usdt,2),trx:r.trx_usd?ceil(usdt/Number(r.trx_usd),2):null,ton:r.ton_usd?ceil(usdt/Number(r.ton_usd),3):null}}
  async function fetchRates(fallback){try{const d=await BGApi.storefront();return d.storefront_rates||{usdt_toman:fallback,stale:true,source:'fallback'}}catch(_){return {usdt_toman:Number(fallback||192000),trx_usd:null,ton_usd:null,stale:true,source:'fallback'}}}
  window.BGRates={fetchRates,amounts};
})();
