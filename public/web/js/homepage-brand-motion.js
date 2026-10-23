/* BlueGate Web — Living Gateway hero helpers, v5.6.0.
   1) "یا مستقیم:" shortcuts open the matching flagship card (works for every user; plain #products link without JS).
   2) Pointer parallax for the gateway layers (the primary CTA keeps the shared motion.js magnet).
   No dependencies; transform-only, rAF-coalesced, disabled for touch/coarse pointers and reduced motion. */
(function () {
  'use strict';
  var doc = document;
  var hero = doc.querySelector('#top .hero--gateway');
  if (!hero) return;

  Array.prototype.forEach.call(hero.querySelectorAll('[data-hero-service]'), function (chip) {
    chip.addEventListener('click', function (event) {
      var tab = doc.querySelector('#products .product-tab[data-product="' + chip.getAttribute('data-hero-service') + '"]');
      if (!tab) return;
      event.preventDefault();
      tab.click();
    });
  });

  if (!window.matchMedia) return;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!finePointer.matches || reducedMotion.matches) return;

  var stage = hero.querySelector('[data-hero-parallax]');
  if (stage) {
    var frame = 0;
    var nextX = 0;
    var nextY = 0;
    stage.addEventListener('pointermove', function (event) {
      if (event.pointerType && event.pointerType !== 'mouse') return;
      var rect = stage.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      nextX = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - .5) * 2));
      nextY = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - .5) * 2));
      if (frame) return;
      frame = window.requestAnimationFrame(function () {
        stage.style.setProperty('--px', nextX.toFixed(3));
        stage.style.setProperty('--py', nextY.toFixed(3));
        frame = 0;
      });
    }, { passive: true });
    stage.addEventListener('pointerleave', function () {
      stage.style.setProperty('--px', '0');
      stage.style.setProperty('--py', '0');
    }, { passive: true });
  }

  function onMotionPreferenceChange(event) {
    if (!event.matches) return;
    if (stage) { stage.style.setProperty('--px', '0'); stage.style.setProperty('--py', '0'); }
  }
  if (typeof reducedMotion.addEventListener === 'function') {
    reducedMotion.addEventListener('change', onMotionPreferenceChange);
  } else if (typeof reducedMotion.addListener === 'function') {
    reducedMotion.addListener(onMotionPreferenceChange);
  }
})();
