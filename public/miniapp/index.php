<?php
header('Cache-Control: no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

$assets = ['app.js','style.css','ui-system.js','unified.css','purchase.js','purchase.css','web-parity.css','mobile-v292.css','contrast-guard.css','layer-stack.css','motion.css','design-sync.css','component-parity.css','motion.js'];
$mtimes = [];
foreach ($assets as $asset) {
    $path = __DIR__ . '/' . $asset;
    $mtimes[] = file_exists($path) ? filemtime($path) : time();
}
$version = 'v480-component-parity-' . max($mtimes);

$html = file_get_contents(__DIR__ . '/index.html');
foreach ($assets as $asset) {
    $quoted = preg_quote($asset, '/');
    $html = preg_replace('/' . $quoted . '(\?v=[^"\'\s>]+)?/', $asset . '?v=' . $version, $html);
}

echo $html;
