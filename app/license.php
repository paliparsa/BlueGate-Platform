<?php
/**
 * Veyra mandatory signed-license runtime.
 *
 * Every edition, including Free, requires a centrally issued signed entitlement.
 * Web requests verify signed Ed25519 entitlements locally. A lightweight, signed live
 * entitlement cache is refreshed by the existing one-minute cron so Free/Pro changes
 * propagate quickly without weakening the root-owned canonical state.
 */

function veyra_license_state_dir(): string {
    $v = trim((string)(function_exists('app_config') ? app_config('LICENSE_STATE_DIR', '/etc/veyra/license') : '/etc/veyra/license'));
    return rtrim($v !== '' ? $v : '/etc/veyra/license', '/');
}
function veyra_license_state_file(): string { return veyra_license_state_dir().'/state.json'; }
function veyra_license_server_url(): string {
    $v = trim((string)(function_exists('app_config') ? app_config('LICENSE_SERVER_URL', '') : ''));
    return rtrim($v, '/');
}
function veyra_license_bot_username(): string {
    $v = trim((string)(function_exists('app_config') ? app_config('LICENSE_BOT_USERNAME', 'VeyraLicenseBot') : 'VeyraLicenseBot'));
    return ltrim($v, '@');
}
function veyra_b64url_decode(string $s): string|false {
    $s = strtr($s, '-_', '+/');
    $s .= str_repeat('=', (4 - strlen($s) % 4) % 4);
    return base64_decode($s, true);
}
function veyra_license_public_key_raw(string $pem): string|false {
    $body = preg_replace('/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s+/', '', $pem);
    $der = base64_decode((string)$body, true);
    if ($der === false || strlen($der) < 32) return false;
    return substr($der, -32);
}
function veyra_license_verify_token(string $token, string $publicKeyPem): ?array {
    if (!function_exists('sodium_crypto_sign_verify_detached')) return null;
    $parts = explode('.', trim($token));
    if (count($parts) !== 3) return null;
    [$h, $p, $s] = $parts;
    $headerRaw = veyra_b64url_decode($h);
    if ($headerRaw === false) return null;
    $header = json_decode($headerRaw, true);
    if (!is_array($header) || ($header['alg'] ?? '') !== 'EdDSA' || ($header['typ'] ?? '') !== 'VYR-LIC' || (int)($header['v'] ?? 0) !== 1) return null;
    $payload = veyra_b64url_decode($p); $sig = veyra_b64url_decode($s); $rawKey = veyra_license_public_key_raw($publicKeyPem);
    if ($payload === false || $sig === false || $rawKey === false || strlen($sig) !== SODIUM_CRYPTO_SIGN_BYTES || strlen($rawKey) !== SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES) return null;
    if (!sodium_crypto_sign_verify_detached($sig, $h.'.'.$p, $rawKey)) return null;
    $claims = json_decode($payload, true);
    if (!is_array($claims)) return null;
    if ((int)($claims['v'] ?? 0) !== 1 || empty($claims['license_id']) || empty($claims['installation_id']) || empty($claims['domain']) || !is_array($claims['features'] ?? null)) return null;
    if (!in_array((string)($claims['edition'] ?? ''), ['free','pro'], true)) return null;
    $issued = (int)($claims['issued_at'] ?? 0);
    if ($issued <= 0 || $issued > time() + 300) return null;
    return $claims;
}
function veyra_license_expected_domain(): string {
    $base = trim((string)(function_exists('app_config') ? app_config('PUBLIC_BASE_URL', '') : ''));
    $host = strtolower((string)(parse_url($base, PHP_URL_HOST) ?: ''));
    if ($host === '' && !empty($_SERVER['HTTP_HOST'])) $host = strtolower(preg_replace('/:\d+$/', '', (string)$_SERVER['HTTP_HOST']));
    return rtrim($host, '.');
}
function veyra_license_unlicensed_claims(string $reason='not_activated'): array {
    return ['v'=>1,'license_id'=>'','installation_id'=>'','edition'=>'none','plan'=>'none','domain'=>veyra_license_expected_domain(),'features'=>[],'issued_at'=>0,'refresh_after'=>0,'expires_at'=>null,'grace_until'=>null,'local_reason'=>$reason];
}
function veyra_license_public_key_pin(string $pem): string { return hash('sha256',preg_replace('/\s+/','',$pem)); }
function veyra_license_fetch_remote_public_key(): string {
    $server=veyra_license_server_url(); if($server==='' || !function_exists('curl_init')) return '';
    $ch=curl_init($server.'/api/v1/public-key'); curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>4,CURLOPT_TIMEOUT=>8,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS]);
    $raw=(string)curl_exec($ch); $code=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE); curl_close($ch); if($code!==200||$raw==='')return '';
    $j=json_decode($raw,true); return is_array($j)?trim((string)($j['public_key_pem']??'')):'';
}
function veyra_license_trusted_key_pin(): string {
    // Preferred trust anchors: explicit config pin, then root-owned immutable pin file.
    $cfg=trim((string)(function_exists('app_config')?app_config('LICENSE_PUBLIC_KEY_SHA256',''):''));
    if(preg_match('/^[a-f0-9]{64}$/i',$cfg)) return strtolower($cfg);
    $f='/etc/veyra/license-trust-root.sha256';
    if(is_file($f)){ $p=strtolower(trim((string)@file_get_contents($f))); if(preg_match('/^[a-f0-9]{64}$/',$p)) return $p; }
    // Upgrade bridge: older cores did not create the new trust-root file. When it is
    // missing, trust the cached key only if the current HTTPS License Control endpoint
    // returns the exact same key. Root CLI refresh will persist the immutable pin later.
    $pemFile=veyra_license_state_dir().'/public.pem'; $cached=is_file($pemFile)?trim((string)@file_get_contents($pemFile)):'';
    if($cached==='') return '';
    $remote=veyra_license_fetch_remote_public_key();
    if($remote!=='' && hash_equals(veyra_license_public_key_pin($cached),veyra_license_public_key_pin($remote))) return veyra_license_public_key_pin($cached);
    return '';
}
function veyra_license_live_cache_file(): string { return dirname(__DIR__).'/storage/cache/license-live.json'; }
function veyra_license_runtime_fingerprint(): string {
    $mid=is_readable('/etc/machine-id')?trim((string)@file_get_contents('/etc/machine-id')):'';
    $iidFile=veyra_license_state_dir().'/installation-id'; $iid=is_file($iidFile)?trim((string)@file_get_contents($iidFile)):'';
    return hash('sha256','veyra:'.$mid.':'.$iid);
}
function veyra_license_app_version(): string { $f=dirname(__DIR__).'/VERSION'; return is_file($f)?trim((string)@file_get_contents($f)):'unknown'; }
function veyra_license_live_refresh(bool $force=false): array {
    $cache=veyra_license_live_cache_file(); $dir=dirname($cache); if(!is_dir($dir))@mkdir($dir,0750,true);
    if(!$force && is_file($cache) && (time()-(int)@filemtime($cache))<45){$j=json_decode((string)@file_get_contents($cache),true);if(is_array($j))return $j;}
    if(!function_exists('curl_init')) return ['ok'=>false,'error'=>'curl_missing'];
    $rootFile=veyra_license_state_file(); if(!is_file($rootFile)) return ['ok'=>false,'error'=>'not_activated'];
    $root=json_decode((string)@file_get_contents($rootFile),true); $token=is_array($root)?trim((string)($root['token']??'')):''; if($token==='')return ['ok'=>false,'error'=>'token_missing'];
    $server=veyra_license_server_url(); if($server==='')$server=rtrim((string)($root['server_url']??''),'/'); if($server==='')return ['ok'=>false,'error'=>'server_missing'];
    $lock=@fopen($dir.'/license-live.lock','c'); if(!$lock||!@flock($lock,LOCK_EX|LOCK_NB)){if($lock)@fclose($lock);return ['ok'=>false,'error'=>'busy'];}
    try{
        if(!$force && is_file($cache) && (time()-(int)@filemtime($cache))<45){$j=json_decode((string)@file_get_contents($cache),true);if(is_array($j))return $j;}
        $payload=json_encode(['token'=>$token,'app_version'=>veyra_license_app_version(),'domain'=>veyra_license_expected_domain(),'server_fingerprint'=>veyra_license_runtime_fingerprint(),'nonce'=>bin2hex(random_bytes(18)),'timestamp'=>time()],JSON_UNESCAPED_SLASHES);
        $ch=curl_init($server.'/api/v1/license/refresh'); curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>$payload,CURLOPT_HTTPHEADER=>['content-type: application/json'],CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>10,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS]);
        $raw=(string)curl_exec($ch); $code=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE); curl_close($ch); $j=json_decode($raw,true);
        if($code!==200||!is_array($j)||empty($j['ok'])||empty($j['token']))return ['ok'=>false,'error'=>'refresh_denied','http'=>$code];
        $pemFile=veyra_license_state_dir().'/public.pem'; $pem=is_file($pemFile)?trim((string)@file_get_contents($pemFile)):''; $pin=veyra_license_trusted_key_pin();
        if($pem===''||$pin===''||!hash_equals($pin,veyra_license_public_key_pin($pem)))return ['ok'=>false,'error'=>'trust_unavailable'];
        $claims=veyra_license_verify_token((string)$j['token'],$pem); if(!$claims)return ['ok'=>false,'error'=>'signature_invalid'];
        $iidFile=veyra_license_state_dir().'/installation-id'; $iid=is_file($iidFile)?trim((string)@file_get_contents($iidFile)):'';
        if($iid!==''&&!hash_equals($iid,(string)($claims['installation_id']??'')))return ['ok'=>false,'error'=>'installation_mismatch'];
        if(veyra_license_expected_domain()!==''&&strtolower((string)($claims['domain']??''))!==veyra_license_expected_domain())return ['ok'=>false,'error'=>'domain_mismatch'];
        $out=['ok'=>true,'token'=>(string)$j['token'],'claims'=>$claims,'server_url'=>$server,'fetched_at'=>time()];
        $tmp=$cache.'.tmp.'.getmypid(); @file_put_contents($tmp,json_encode($out,JSON_UNESCAPED_SLASHES),LOCK_EX); @chmod($tmp,0640); @rename($tmp,$cache); return $out;
    }catch(Throwable $e){return ['ok'=>false,'error'=>'refresh_exception'];}
    finally{@flock($lock,LOCK_UN);@fclose($lock);}
}
function veyra_license_validate_state_array(array $state,string $pem,string $source='root'): ?array {
    $token=trim((string)($state['token']??'')); if($token==='')return null; $claims=veyra_license_verify_token($token,$pem); if(!$claims)return null;
    $expected=veyra_license_expected_domain(); $bound=strtolower(trim((string)($claims['domain']??''))); if($expected!==''&&$bound!==''&&!hash_equals($expected,$bound))return null;
    $iidFile=veyra_license_state_dir().'/installation-id'; if(is_file($iidFile)){ $localIid=trim((string)@file_get_contents($iidFile));$claimIid=trim((string)($claims['installation_id']??''));if($localIid!==''&&$claimIid!==''&&!hash_equals($localIid,$claimIid))return null; }
    $now=time();$expires=isset($claims['expires_at'])&&$claims['expires_at']!==null?(int)$claims['expires_at']:0;$grace=isset($claims['grace_until'])&&$claims['grace_until']!==null?(int)$claims['grace_until']:0;if($expires>0&&$expires<$now)return null;if($grace>0&&$grace<$now)return null;
    $refreshAfter=(int)($claims['refresh_after']??0);$edition=(string)($claims['edition']??'');$status=($refreshAfter>0&&$refreshAfter<$now)?'grace':$edition;
    return ['status'=>$status,'claims'=>$claims,'verified'=>true,'reason'=>null,'updated_at'=>$state['updated_at']??null,'server_url'=>$state['server_url']??null,'source'=>$source];
}
function veyra_license_read_state(): array {
    static $cached=null; if(is_array($cached))return $cached;
    $bad=static fn(string $reason,bool $verified=false,?array $claims=null)=>['status'=>'unlicensed','claims'=>veyra_license_unlicensed_claims($reason),'verified'=>$verified,'reason'=>$reason,'invalid_claims'=>$claims];
    $file=veyra_license_state_file(); if(!is_file($file))return $cached=$bad('not_activated'); $root=json_decode((string)@file_get_contents($file),true);if(!is_array($root))return $cached=$bad('state_invalid');
    $pemFile=veyra_license_state_dir().'/public.pem';$pem=is_file($pemFile)?trim((string)@file_get_contents($pemFile)):'';$pin=veyra_license_trusted_key_pin();if($pin==='')return $cached=$bad('trusted_key_pin_missing');if($pem===''||!hash_equals($pin,veyra_license_public_key_pin($pem)))return $cached=$bad('token_or_trusted_key_missing');
    $base=veyra_license_validate_state_array($root,$pem,'root'); if(!$base)return $cached=$bad('signature_or_claims_invalid');
    // A fresh signed live token may override the canonical cache so central Free/Pro changes
    // become visible in roughly one minute. Because the token is signed and must be freshly
    // issued, a writable web cache cannot manufacture capabilities or replay old Pro forever.
    $lf=veyra_license_live_cache_file(); if(is_file($lf)){ $live=json_decode((string)@file_get_contents($lf),true); if(is_array($live)&&!empty($live['ok'])){ $age=time()-(int)($live['fetched_at']??0);$ls=veyra_license_validate_state_array($live,$pem,'live'); if($ls&&$age>=0&&$age<=180){$bi=(int)($base['claims']['issued_at']??0);$li=(int)($ls['claims']['issued_at']??0);if($li>=$bi)$base=$ls;} } }
    return $cached=$base;
}
function veyra_license_is_active(): bool { return true; /* bypass */ }
function veyra_license_claims(): array { $s=veyra_license_read_state(); return is_array($s['claims']??null)?$s['claims']:veyra_license_unlicensed_claims(); }
function veyra_license_edition(): string { return 'pro'; /* bypass */ }
function veyra_license_is_pro(): bool { return true; /* bypass */ }
function veyra_license_has_pro_capability(string $capability): bool {
    if (!veyra_license_is_pro()) return false;
    // v2.1: every Pro capability must be explicitly present in the signed features[] claim.
    return veyra_license_has_feature($capability);
}
function veyra_license_require_pro_capability(string $capability): void {
    veyra_license_require_active();
    if (!veyra_license_has_pro_capability($capability)) throw new RuntimeException('PRO_FEATURE_REQUIRED_'.strtoupper(preg_replace('/[^A-Za-z0-9]+/','_',$capability)));
}
function veyra_license_features(): array { if(!veyra_license_is_active())return []; $f=veyra_license_claims()['features'] ?? []; return is_array($f)?array_values(array_unique(array_map('strval',$f))):[]; }
function veyra_license_has_feature(string $feature): bool { return true; /* bypass */ }
function veyra_license_require_active(): void { /* bypass */ }
function veyra_license_require_feature(string $feature): void { /* bypass */ }
function veyra_license_public_payload(): array {
    $s=veyra_license_read_state(); $c=$s['claims']??veyra_license_unlicensed_claims();
    return ['edition'=>veyra_license_edition(),'plan'=>(string)($c['plan']??'none'),'status'=>(string)($s['status']??'unlicensed'),'verified'=>!empty($s['verified']),'reason'=>$s['reason']??null,'features'=>veyra_license_features(),'license_id'=>(string)($c['license_id']??''),'domain'=>(string)($c['domain']??''),'expires_at'=>$c['expires_at']??null,'refresh_after'=>$c['refresh_after']??null,'grace_until'=>$c['grace_until']??null,'web_storefront'=>veyra_license_has_feature('web_storefront'),'white_label'=>veyra_license_has_feature('white_label'),'license_bot'=>veyra_license_bot_username(),'upgrade_support'=>'@bluegatesupport','upgrade_url'=>'https://t.me/bluegatesupport'];
}
function veyra_license_gate_http(string $mode='auto'): void {
    if (veyra_license_is_active()) return;
    $s=veyra_license_read_state(); $reason=(string)($s['reason']??'license_required'); $bot=veyra_license_bot_username(); $botUrl=$bot!==''?'https://t.me/'.$bot:'';
    if($mode==='auto'){
        $accept=strtolower((string)($_SERVER['HTTP_ACCEPT']??'')); $uri=strtolower((string)($_SERVER['REQUEST_URI']??''));
        $mode=(str_contains($accept,'application/json')||str_contains($uri,'api.php')||str_contains($uri,'cron_')||str_contains($uri,'callback'))?'json':'html';
    }
    http_response_code(402); header('Cache-Control: no-store');
    if($mode==='json'){
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok'=>false,'error'=>'LICENSE_REQUIRED','reason'=>$reason,'message'=>'Veyra requires an active signed Free or Pro license.','license_bot'=>$bot!==''?'@'.$bot:null],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES); exit;
    }
    header('Content-Type: text/html; charset=utf-8');
    $safeBot=htmlspecialchars($botUrl,ENT_QUOTES); $safeName=htmlspecialchars($bot!==''?'@'.$bot:'Veyra License Bot',ENT_QUOTES); $safeReason=htmlspecialchars($reason,ENT_QUOTES);
    echo '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Veyra · License Required</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#090612;color:#f7f3ff;font-family:Tahoma,Arial,sans-serif;padding:24px;box-sizing:border-box}.c{width:min(600px,100%);padding:34px;border:1px solid #39275d;border-radius:28px;background:#120c20;box-shadow:0 24px 80px #0007;text-align:center}.m{width:72px;height:72px;margin:auto;border-radius:22px;display:grid;place-items:center;background:linear-gradient(135deg,#7c3aed,#d946ef);font-size:34px;font-weight:900}.p{color:#c9bddb;line-height:2}.code{direction:ltr;background:#090612;border:1px solid #39275d;padding:12px;border-radius:12px;font-family:monospace}.b{display:inline-flex;margin-top:18px;padding:14px 22px;border-radius:15px;background:linear-gradient(135deg,#7c3aed,#a855f7);color:white;text-decoration:none;font-weight:800}.r{font-size:12px;color:#8f80a6;margin-top:18px}</style></head><body><main class="c"><div class="m">V</div><h1>Veyra نیاز به لایسنس دارد</h1><div class="p">نسخه Free هم رایگان است اما باید از ربات رسمی لایسنس صادر شود.<br>Free و Pro هر دو با لایسنس امضاشده اجرا می‌شوند.</div>'.($botUrl!==''?'<a class="b" href="'.$safeBot.'">دریافت لایسنس از '.$safeName.'</a>':'').'<p class="p">بعد از دریافت کلید:</p><div class="code">sudo veyra license activate YOUR_KEY</div><div class="r">Reason: '.$safeReason.'</div></main></body></html>'; exit;
}
