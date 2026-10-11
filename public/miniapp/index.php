<?php
header('Cache-Control: no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

$assets = ['app.js','foundation.css','style.css','ui-system.js','unified.css','purchase.js','purchase.css','web-parity.css','mobile-v292.css','contrast-guard.css','layer-stack.css','motion.css','design-sync.css','component-parity.css','motion.js','bluegate-theme.css','admin-web-parity.css','final-polish.css','final-polish.js','design-system.css'];
$mtimes = [];
foreach ($assets as $asset) {
    // design-system.css lives one level up (public/), everything else sits next to this file.
    $path = ($asset === 'design-system.css' ? dirname(__DIR__) : __DIR__) . '/' . $asset;
    $mtimes[] = file_exists($path) ? filemtime($path) : time();
}
$version = 'v500-gesture-render-stability-' . max($mtimes);

$html = file_get_contents(__DIR__ . '/index.html');
foreach ($assets as $asset) {
    $quoted = preg_quote($asset, '/');
    $html = preg_replace('/' . $quoted . '(\?v=[^"\'\s>]+)?/', $asset . '?v=' . $version, $html);
}

echo $html;
