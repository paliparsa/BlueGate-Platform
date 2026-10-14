<?php
header('Cache-Control: no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

$assets = ['app.js','i18n.js','../translation.js','style.css','ui-system.js','unified.css','purchase.js','purchase.css','web-parity.css','mobile-v292.css','contrast-guard.css','layer-stack.css','motion.css','design-sync.css','component-parity.css','motion.js','bluegate-theme.css','admin-web-parity.css','final-polish.css','final-polish.js','design-system.css','tokens.css','responsive-v3.css','overlay-safety-v3.css','interaction-v5.css','accessibility-v6.css','performance-v7.css','catalog-consistency-v8.css','catalog-cards-v9.css','orders-v9.css','design-tokens.css','design-base.css','design-surfaces.css','design-components.css','design-overlays.css','design-responsive.css','product-popup-v10.css'];
$html = (string)file_get_contents(__DIR__ . '/index.html');
$assets[] = 'foundation.css';
foreach ($assets as $asset) {
    // design-system.css lives one level up (public/), everything else sits next to this file.
    $path = (in_array($asset, ['design-system.css', '../translation.js'], true) ? dirname(__DIR__) : __DIR__) . '/' . ($asset === '../translation.js' ? 'translation.js' : $asset);
    $version = is_file($path) ? (string)filemtime($path) : '0';
    $quoted = preg_quote($asset, '/');
    $html = preg_replace('/' . $quoted . '(\?v=[^"\'\s>]+)?/', $asset . '?v=' . $version, $html);
}

echo $html;
