<?php
// web_gate is a direct entry point, so it must load the same bootstrap and
// module registry as the API before checking Pro capabilities.
require_once __DIR__.'/../app/bootstrap.php';
veyra_license_gate_http('json');
if(!veyra_license_has_feature('web_storefront') || !veyra_pro_core_active()){http_response_code(403);header('Content-Type: application/json; charset=UTF-8');echo json_encode(['ok'=>false,'error'=>'PRO_FEATURE_REQUIRED_WEB_STOREFRONT','message'=>'Veyra Web Storefront requires an active Pro entitlement and Pro module.','upgrade_url'=>'https://t.me/bluegatesupport','upgrade_support'=>'@bluegatesupport'],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);exit;}
$uri=(string)(parse_url($_SERVER['REQUEST_URI']??'/web/',PHP_URL_PATH)?:'/web/');
$rel=preg_replace('#^/web/?#','',$uri); if($rel==='')$rel='index.html';
$rel=rawurldecode($rel);
if(str_contains($rel,"\0")||str_contains($rel,'..')||str_starts_with($rel,'/')){http_response_code(400);exit('Bad path');}
$base=dirname(__DIR__).'/modules/pro-web/public';
$file=$base.'/'.$rel;
$realBase=realpath($base);$real=is_file($file)?realpath($file):false;
if(!$realBase||!$real||!str_starts_with($real,$realBase.DIRECTORY_SEPARATOR)){http_response_code(404);exit('Not found');}
// When the web shell is requested through this gate, rewrite every asset key
// from the asset's own mtime before returning HTML. Other files remain immutable.
if ($rel === 'index.html') {
    $html = (string)@file_get_contents($real);
    $html = preg_replace_callback(
        '#((?:href|src)=[\"\'])([^?\"\']+)(?:\?v=[^\"\']*)?([\"\'])#',
        function (array $m) use ($base): string {
            $path = parse_url($m[2], PHP_URL_PATH) ?: $m[2];
            if ($path === '/design-system.css') $asset = __DIR__ . '/design-system.css';
            elseif (str_starts_with($path, '/web/')) $asset = $base . '/' . substr($path, 5);
            else return $m[0];
            return is_file($asset) ? $m[1] . $m[2] . '?v=' . filemtime($asset) . $m[3] : $m[0];
        }, $html
    );
    header('Content-Type: text/html; charset=UTF-8');
    header('Cache-Control: no-cache, must-revalidate, max-age=0');
    echo $html;
    exit;
}
// nginx serves the verified file from an internal-only alias.
header('X-Accel-Redirect: /_veyra_pro_web/'.$rel);
$ext=strtolower(pathinfo($real,PATHINFO_EXTENSION));
$types=['html'=>'text/html; charset=UTF-8','css'=>'text/css; charset=UTF-8','js'=>'application/javascript; charset=UTF-8','json'=>'application/json; charset=UTF-8','png'=>'image/png','jpg'=>'image/jpeg','jpeg'=>'image/jpeg','webp'=>'image/webp','svg'=>'image/svg+xml','ico'=>'image/x-icon','woff'=>'font/woff','woff2'=>'font/woff2'];
header('Content-Type: '.($types[$ext]??'application/octet-stream'));
if($rel==='sw.js'||$ext==='html')header('Cache-Control: no-cache, must-revalidate, max-age=0');else header('Cache-Control: public, max-age=2592000, immutable');
exit;
