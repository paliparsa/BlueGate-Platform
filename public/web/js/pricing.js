(function(){
  function roundStep(amount,s){if(!s.smart_rounding_enabled)return 1;if(amount<1_000_000)return Number(s.round_small||5000);if(amount<=10_000_000)return Number(s.round_medium||10000);return Number(s.round_large||20000)}
  function roundUp(amount,s){const step=Math.max(1,roundStep(amount,s));return Math.ceil((Number(amount)-Number.EPSILON)/step)*step}
  function marked(base,markup){return Number(base)*(1+Number(markup||0)/100)}
  function stars(stars,s,r){const raw=s.stars_price_basis==="usdt"?Number(stars)*Number(s.star_sell_per_unit_usdt)*Number(r.usdt_toman):Number(stars)*Number(s.star_sell_per_unit_toman);return roundUp(raw,s)}
  function premium(plan,s,r){return roundUp(marked(plan.base_usdt,plan.markup_override==null?s.premium_markup:plan.markup_override)*Number(r.usdt_toman),s)}
  function vpn(pkg){return Number(pkg.price_toman)}
  function afterDiscount(amount,pct){return Math.max(0,Math.round(Number(amount)*(1-Number(pct||0)/100)))}
  window.BGPricing={roundUp,marked,stars,premium,vpn,afterDiscount};
  // Shared web number formatter for catalog and services: prices, counters, percentages and volumes.
  // One numeral system everywhere: Latin digits with en-US grouping, matching prices, checkout and order IDs.
  const NUMBER_LOCALE='en-US';
  function number(v,digits=0){const n=Number(v);return (Number.isFinite(n)?n:0).toLocaleString(NUMBER_LOCALE,{maximumFractionDigits:digits})}
  function money(v){return number(v)+' تومان'}
  function percent(v,digits=0){return number(v,digits)+'٪'}
  function gigabytes(bytes,digits=1){return number(Number(bytes||0)/1073741824,digits)+' GB'}
  window.BGFormat={locale:NUMBER_LOCALE,number,money,percent,gigabytes};
})();
