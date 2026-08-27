<?php
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');
header('Expires: Mon, 26 Jul 1997 05:00:00 GMT');

$assets = ['app.js','style.css','ui-system.js','unified.css'];
$mtimes = [];
foreach ($assets as $asset) {
    $path = __DIR__ . '/' . $asset;
    $mtimes[] = file_exists($path) ? filemtime($path) : time();
}
$version = 'v281-telegram-boot-' . max($mtimes);

$html = file_get_contents(__DIR__ . '/index.html');
foreach ($assets as $asset) {
    $quoted = preg_quote($asset, '/');
    $html = preg_replace('/' . $quoted . '(\?v=[^"\'\s>]+)?/', $asset . '?v=' . $version, $html);
}

echo $html;
