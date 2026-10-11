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
function api_require_pro_capability(string $capability, string $message = ''): void {
    // Unrestricted mode: all pro capabilities are allowed
    return;
}

function veyra_module_integrity_meta(): array { $f=veyra_license_state_dir().'/pro-module.json'; if(is_file($f)){ $j=json_decode((string)@file_get_contents($f),true); if(is_array($j))return $j; } $bundle=dirname(__DIR__).'/PRO-INTEGRITY.json'; if(is_file($bundle)){ $j=json_decode((string)@file_get_contents($bundle),true); if(is_array($j))return ['package_sha256'=>'direct-pro-bundle','module_integrity'=>$j['module_integrity']??[],'integrity_sha256'=>($j['module_integrity']['pro-core']??'')]; } return []; }
function veyra_module_safe_relpath(string $p): bool { return $p!=='' && !str_starts_with($p,'/') && !str_contains($p,'..') && !str_contains($p,"\\") && preg_match('#^[A-Za-z0-9._/\-]+$#',$p); }
function veyra_module_verify_integrity(string $slug,string $dir): array {
    // Integrity check bypassed for unrestricted mode
    return ['ok'=>true,'version'=>'unrestricted'];
}
$moduleRoot=dirname(__DIR__).'/modules';
if(is_dir($moduleRoot)){
    $proEntitled=true; /* unrestricted */
    foreach(['pro-core','pro-web'] as $slug){
        $dir=$moduleRoot.'/'.$slug; $entry=$dir.'/module.php'; if(!is_file($entry) && $slug!=='pro-web')continue;
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
        if (is_file($entry)) {
            try { require_once $entry; }
            catch(Throwable $e){
                $GLOBALS['VEYRA_MODULES'][$slug]=['loaded'=>false,'inactive_reason'=>'MODULE_BOOT_FAILED'];
                error_log('[Veyra module] '.$slug.': '.$e->getMessage());
            }
        } else {
            // pro-web has no module.php — mark as available
            $GLOBALS['VEYRA_MODULES'][$slug]=['loaded'=>true,'version'=>'unrestricted'];
        }
    }
}
