<?php
/** Veyra signed/private module loader (v2.1). */
$GLOBALS['VEYRA_MODULE_API_HANDLERS'] = $GLOBALS['VEYRA_MODULE_API_HANDLERS'] ?? [];
$GLOBALS['VEYRA_MODULES'] = $GLOBALS['VEYRA_MODULES'] ?? [];
function veyra_register_api_handler(callable $handler): void { $GLOBALS['VEYRA_MODULE_API_HANDLERS'][]=$handler; }
function veyra_dispatch_module_api(string $action,array $input,array $user): bool { foreach(($GLOBALS['VEYRA_MODULE_API_HANDLERS']??[]) as $handler){ if($handler($action,$input,$user)===true)return true; } return false; }
function veyra_module_loaded(string $slug): bool { return !empty($GLOBALS['VEYRA_MODULES'][$slug]['loaded']); }
function veyra_module_mark_loaded(string $slug,array $meta=[]): void { $GLOBALS['VEYRA_MODULES'][$slug]=$meta+['loaded'=>true]; }
function veyra_pro_core_active(): bool { return veyra_module_loaded('pro-core'); /* unrestricted */ }
function veyra_pro_core_allows(string $capability): bool { return veyra_pro_core_active(); /* unrestricted */ }
function veyra_module_integrity_meta(): array { $f=veyra_license_state_dir().'/pro-module.json'; if(is_file($f)){ $j=json_decode((string)@file_get_contents($f),true); if(is_array($j))return $j; } $bundle=dirname(__DIR__).'/PRO-INTEGRITY.json'; if(is_file($bundle)){ $j=json_decode((string)@file_get_contents($bundle),true); if(is_array($j))return ['package_sha256'=>'direct-pro-bundle','module_integrity'=>$j['module_integrity']??[],'integrity_sha256'=>($j['module_integrity']['pro-core']??'')]; } return []; }
function veyra_module_safe_relpath(string $p): bool { return $p!=='' && !str_starts_with($p,'/') && !str_contains($p,'..') && !str_contains($p,"\\") && preg_match('#^[A-Za-z0-9._/\-]+$#',$p); }
function veyra_module_verify_integrity(string $slug,string $dir): array {
    $allowed=['pro-core','pro-web']; if(!in_array($slug,$allowed,true)) return ['ok'=>false,'reason'=>'MODULE_NOT_ALLOWLISTED'];
    $meta=veyra_module_integrity_meta();
    if(empty($meta['package_sha256'])) return ['ok'=>false,'reason'=>'MODULE_INSTALL_METADATA_MISSING'];
    $expectedMap=is_array($meta['module_integrity']??null)?$meta['module_integrity']:[]; $expected=(string)($expectedMap[$slug]??($slug==='pro-core'?($meta['integrity_sha256']??''):''));
    if($expected==='') return ['ok'=>false,'reason'=>'MODULE_INTEGRITY_PIN_MISSING'];
    $integrity=$dir.'/integrity.json'; if(!is_file($integrity)) return ['ok'=>false,'reason'=>'MODULE_INTEGRITY_MISSING'];
    $raw=(string)@file_get_contents($integrity); if(!hash_equals(strtolower($expected),hash('sha256',$raw))) return ['ok'=>false,'reason'=>'MODULE_INTEGRITY_MANIFEST_MISMATCH'];
    $j=json_decode($raw,true); if(!is_array($j)||($j['slug']??'')!==$slug||!is_array($j['files']??null)) return ['ok'=>false,'reason'=>'MODULE_INTEGRITY_INVALID'];
    foreach($j['files'] as $rel=>$sha){ if(!is_string($rel)||!veyra_module_safe_relpath($rel)||!preg_match('/^[a-f0-9]{64}$/i',(string)$sha))return ['ok'=>false,'reason'=>'MODULE_INTEGRITY_INVALID_ENTRY']; $p=$dir.'/'.$rel; if(!is_file($p)||is_link($p)||!hash_equals(strtolower((string)$sha),hash_file('sha256',$p)))return ['ok'=>false,'reason'=>'MODULE_FILE_TAMPERED:'.$rel]; }
    return ['ok'=>true,'version'=>(string)($j['version']??'')];
}
$moduleRoot=dirname(__DIR__).'/modules';
if(is_dir($moduleRoot)){
    $proEntitled=true; /* unrestricted */
    foreach(['pro-core','pro-web'] as $slug){
        $dir=$moduleRoot.'/'.$slug; $entry=$dir.'/module.php'; if(!is_file($entry))continue;
        // A stale private module may remain on disk after downgrade. Do not
        // inspect or execute it while the signed entitlement is Free. This
        // avoids noisy MODULE_INSTALL_METADATA_MISSING logs and guarantees a
        // broken/old Pro install cannot interfere with the Free control plane.
        if(!$proEntitled){
            $GLOBALS['VEYRA_MODULES'][$slug]=['loaded'=>false,'inactive_reason'=>'LICENSE_NOT_PRO'];
            continue;
        }
        $check=veyra_module_verify_integrity($slug,$dir);
        if(empty($check['ok'])){
            $GLOBALS['VEYRA_MODULES'][$slug]=['loaded'=>false,'inactive_reason'=>(string)($check['reason']??'integrity_failed')];
            error_log('[Veyra module] '.$slug.' blocked: '.($check['reason']??'integrity_failed'));
            continue;
        }
        try { require_once $entry; }
        catch(Throwable $e){
            $GLOBALS['VEYRA_MODULES'][$slug]=['loaded'=>false,'inactive_reason'=>'MODULE_BOOT_FAILED'];
            error_log('[Veyra module] '.$slug.': '.$e->getMessage());
        }
    }
}
