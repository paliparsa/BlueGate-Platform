<?php
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');
header('Expires: Mon, 26 Jul 1997 05:00:00 GMT');

$appMtime = file_exists(__DIR__ . '/app.js') ? filemtime(__DIR__ . '/app.js') : time();
$cssMtime = file_exists(__DIR__ . '/style.css') ? filemtime(__DIR__ . '/style.css') : time();
$version = 'v107-fix-profile-topbar-btn-' . max($appMtime, $cssMtime);

$html = file_get_contents(__DIR__ . '/index.html');
$html = preg_replace('/style\.css(\?v=[^"\'\s>]+)?/', 'style.css?v=' . $version, $html);
$html = preg_replace('/app\.js(\?v=[^"\'\s>]+)?/', 'app.js?v=' . $version, $html);

echo $html;
