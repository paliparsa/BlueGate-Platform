(function(){
'use strict';
let busy=false;

async function open(data){
  if(!data||busy)return null;
  const spec={
    productId:Number(data.productId||0),
    variantId:data.variantId?Number(data.variantId):null,
    starsCount:data.starsCount?Number(data.starsCount):null
  };
  if(!spec.productId){
    window.BGAccount?.toast?.('محصول معتبر نیست.','error');
    return null;
  }
  busy=true;
  try{
    // v1.3+: no intermediate confirmation modal. A valid selection creates the
    // order directly; guests are sent through the existing auth flow and the
    // pending order is continued automatically after login/register.
    return await window.BGAccount?.submitOrder?.(spec,'');
  } finally {
    busy=false;
  }
}

function close(){ /* compatibility no-op: checkout confirmation modal removed */ }
window.BGCheckout={open,close};
})();
