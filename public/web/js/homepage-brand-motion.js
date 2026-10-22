/* BlueGate Web — subtle pointer parallax for the Brand Gateway.
   No dependencies; disabled for touch/coarse pointers and reduced-motion users. */
(function () {
  'use strict';
  var hero = document.querySelector('#top .hero-visual');
  if (!hero || !window.matchMedia) return;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!finePointer.matches || reducedMotion.matches) return;
  var frame = 0;
  var nextX = 0;
  var nextY = 0;
  function reset() {
    hero.style.setProperty('--bg-gateway-x', '0px');
    hero.style.setProperty('--bg-gateway-y', '0px');
  }
  hero.addEventListener('pointermove', function (event) {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    var rect = hero.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    nextX = Math.max(-10, Math.min(10, ((event.clientX - rect.left) / rect.width - .5) * 20));
    nextY = Math.max(-8, Math.min(8, ((event.clientY - rect.top) / rect.height - .5) * 16));
    if (frame) return;
    frame = window.requestAnimationFrame(function () {
      hero.style.setProperty('--bg-gateway-x', nextX.toFixed(1) + 'px');
      hero.style.setProperty('--bg-gateway-y', nextY.toFixed(1) + 'px');
      frame = 0;
    });
  }, { passive: true });
  hero.addEventListener('pointerleave', reset, { passive: true });
  function onMotionPreferenceChange(event) {
    if (event.matches) reset();
  }
  if (typeof reducedMotion.addEventListener === 'function') {
    reducedMotion.addEventListener('change', onMotionPreferenceChange);
  } else if (typeof reducedMotion.addListener === 'function') {
    reducedMotion.addListener(onMotionPreferenceChange);
  }
})();
