(()=>{
  const selectors='.category-strip,.h-scroll,.product-grid-wrap,.admin-tabs,.catalog-mobile-categories,[data-horizontal-scroll]';
  function enhance(root=document){
    root.querySelectorAll(selectors).forEach(el=>{
      if(el.dataset.vyWheel==='1')return; el.dataset.vyWheel='1';
      el.addEventListener('wheel',e=>{
        if(Math.abs(e.deltaY)<=Math.abs(e.deltaX) || el.scrollWidth<=el.clientWidth)return;
        e.preventDefault(); el.scrollLeft += e.deltaY;
      },{passive:false});
      let down=false,startX=0,startLeft=0;
      el.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;down=true;startX=e.clientX;startLeft=el.scrollLeft;el.setPointerCapture?.(e.pointerId)});
      el.addEventListener('pointermove',e=>{if(!down)return;const dx=e.clientX-startX;if(Math.abs(dx)>3){el.scrollLeft=startLeft-dx}});
      const end=()=>down=false;el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
    });
  }
  document.addEventListener('DOMContentLoaded',()=>{enhance();new MutationObserver(()=>enhance()).observe(document.body,{childList:true,subtree:true})});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.querySelector('[data-close-sheet],.app-sheet.open [data-close]')?.click?.()}});
})();
