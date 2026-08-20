<?php
// Secure service/subscription viewer helpers for BlueGate Platform.
// Requires app/bootstrap.php to be loaded first.

function bg_sv_b64e(string $raw): string {
    return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
}
function bg_sv_b64d(string $raw): string|false {
    $pad = strlen($raw) % 4;
    if ($pad) $raw .= str_repeat('=', 4 - $pad);
    return base64_decode(strtr($raw, '-_', '+/'), true);
}
function bg_sv_secret(): string {
    return hash('sha256', (string)app_config('BOT_TOKEN','').'|'.(string)app_config('WEBHOOK_SECRET','bluegate').'|'.(string)app_config('DB_NAME','bluegate'), true);
}
function bg_sv_issue_ticket(int $orderId, int $userId, int $ttl=900): string {
    $payload = [
        'o'=>$orderId,
        'u'=>$userId,
        'e'=>time()+max(120,min(1800,$ttl)),
        'n'=>bin2hex(random_bytes(6)),
    ];
    $body = bg_sv_b64e(json_encode($payload, JSON_UNESCAPED_SLASHES));
    $sig = bg_sv_b64e(hash_hmac('sha256', $body, bg_sv_secret(), true));
    return $body.'.'.$sig;
}
function bg_sv_verify_ticket(string $ticket): ?array {
    if (!str_contains($ticket,'.')) return null;
    [$body,$sig] = explode('.', $ticket, 2);
    $calc = bg_sv_b64e(hash_hmac('sha256', $body, bg_sv_secret(), true));
    if (!hash_equals($calc,$sig)) return null;
    $raw = bg_sv_b64d($body);
    $p = $raw ? json_decode($raw,true) : null;
    if (!is_array($p) || (int)($p['e']??0) < time() || (int)($p['o']??0)<=0 || (int)($p['u']??0)<=0) return null;
    return $p;
}
function bg_sv_public_view_url(int $orderId, int $userId): string {
    $base = rtrim(public_base_url(), '/');
    if ($base === '') $base = rtrim((string)app_config('PUBLIC_BASE_URL',''), '/');
    return $base.'/service.php?ticket='.rawurlencode(bg_sv_issue_ticket($orderId,$userId));
}

function bg_sv_is_public_ipv4(string $ip): bool {
    if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) return false;
    $n=ip2long($ip); if($n===false)return false; $n=(int)sprintf('%u',$n);
    $blocked=[
        ['100.64.0.0','100.127.255.255'], ['192.0.0.0','192.0.0.255'], ['192.0.2.0','192.0.2.255'],
        ['198.18.0.0','198.19.255.255'], ['198.51.100.0','198.51.100.255'], ['203.0.113.0','203.0.113.255']
    ];
    foreach($blocked as [$a,$b]){ $aa=(int)sprintf('%u',ip2long($a)); $bb=(int)sprintf('%u',ip2long($b)); if($n>=$aa&&$n<=$bb)return false; }
    return true;
}
function bg_sv_resolve_public_ipv4(string $host): ?string {
    if (filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) return bg_sv_is_public_ipv4($host) ? $host : null;
    $lh = strtolower(rtrim($host,'.'));
    if ($lh === 'localhost' || str_ends_with($lh,'.local') || str_ends_with($lh,'.internal')) return null;
    $ips = @gethostbynamel($host) ?: [];
    foreach ($ips as $ip) if (bg_sv_is_public_ipv4($ip)) return $ip;
    return null;
}
function bg_sv_validate_url(string $url): array {
    $url = trim($url);
    if ($url === '' || strlen($url) > 4096) throw new RuntimeException('SERVICE_URL_INVALID');
    $p = @parse_url($url);
    if (!is_array($p) || strtolower((string)($p['scheme']??'')) !== 'https' || empty($p['host'])) throw new RuntimeException('SERVICE_URL_HTTPS_REQUIRED');
    if (!empty($p['user']) || !empty($p['pass'])) throw new RuntimeException('SERVICE_URL_USERINFO_BLOCKED');
    $host = strtolower((string)$p['host']);
    $ip = bg_sv_resolve_public_ipv4($host);
    if (!$ip) throw new RuntimeException('SERVICE_URL_HOST_BLOCKED');
    $port = isset($p['port']) ? (int)$p['port'] : 443;
    if ($port < 1 || $port > 65535) throw new RuntimeException('SERVICE_URL_PORT_INVALID');
    return ['url'=>$url,'host'=>$host,'ip'=>$ip,'port'=>$port,'parts'=>$p];
}
function bg_sv_seal_url(string $url, int $orderId, int $expires): string {
    if (!function_exists('openssl_encrypt')) throw new RuntimeException('OPENSSL_REQUIRED');
    $iv = random_bytes(12); $tag='';
    $plain = json_encode(['u'=>$url,'e'=>$expires], JSON_UNESCAPED_SLASHES);
    $cipher = openssl_encrypt($plain, 'aes-256-gcm', bg_sv_secret(), OPENSSL_RAW_DATA, $iv, $tag, 'order:'.$orderId, 16);
    if ($cipher === false) throw new RuntimeException('SEAL_FAILED');
    return bg_sv_b64e($iv.$tag.$cipher);
}
function bg_sv_unseal_url(string $token, int $orderId): ?string {
    if (!function_exists('openssl_decrypt')) return null;
    $raw = bg_sv_b64d($token);
    if ($raw === false || strlen($raw) < 29) return null;
    $iv=substr($raw,0,12); $tag=substr($raw,12,16); $cipher=substr($raw,28);
    $plain=openssl_decrypt($cipher,'aes-256-gcm',bg_sv_secret(),OPENSSL_RAW_DATA,$iv,$tag,'order:'.$orderId);
    $p=$plain?json_decode($plain,true):null;
    if(!is_array($p)||(int)($p['e']??0)<time()||empty($p['u'])) return null;
    return (string)$p['u'];
}
function bg_sv_abs_url(string $base, string $rel): ?string {
    $rel=trim(html_entity_decode($rel,ENT_QUOTES|ENT_HTML5,'UTF-8'));
    if ($rel==='' || str_starts_with($rel,'#') || preg_match('#^(data:|blob:|javascript:|mailto:|tel:)#i',$rel)) return null;
    if (preg_match('#^https://#i',$rel)) return $rel;
    if (str_starts_with($rel,'//')) return 'https:'.$rel;
    if (preg_match('#^[a-z][a-z0-9+.-]*:#i',$rel)) return null;
    $bp=parse_url($base); if(!$bp||empty($bp['host'])) return null;
    $origin='https://'.$bp['host'].(isset($bp['port'])?':'.$bp['port']:'');
    if(str_starts_with($rel,'?')) return $origin.($bp['path']??'/').$rel;
    $path = str_starts_with($rel,'/') ? $rel : preg_replace('#/[^/]*$#','/',($bp['path']??'/')).$rel;
    $query=''; if(str_contains($path,'?')) [$path,$query]=explode('?',$path,2);
    $out=[]; foreach(explode('/',$path) as $seg){ if($seg===''||$seg==='.')continue; if($seg==='..'){array_pop($out);continue;} $out[]=$seg; }
    return $origin.'/'.implode('/',$out).($query!==''?'?'.$query:'');
}
function bg_sv_proxy_url(string $remote, string $ticket, int $orderId, int $expires): string {
    $p=@parse_url($remote);
    if(!is_array($p) || strtolower((string)($p['scheme']??''))!=='https' || empty($p['host']) || !empty($p['user']) || !empty($p['pass'])) return '#';
    return '/service.php?ticket='.rawurlencode($ticket).'&r='.rawurlencode(bg_sv_seal_url($remote,$orderId,$expires));
}
function bg_sv_rewrite_css(string $css, string $base, string $ticket, int $orderId, int $expires): string {
    $css = preg_replace_callback('#url\(\s*(["\']?)([^)"\']+)\1\s*\)#i', function($m) use($base,$ticket,$orderId,$expires){
        $abs=bg_sv_abs_url($base,$m[2]); if(!$abs)return $m[0]; $p=bg_sv_proxy_url($abs,$ticket,$orderId,$expires); return $p==='#'?$m[0]:'url("'.$p.'")';
    }, $css) ?? $css;
    $css = preg_replace_callback('#@import\s+(["\'])([^"\']+)\1#i', function($m) use($base,$ticket,$orderId,$expires){
        $abs=bg_sv_abs_url($base,$m[2]); if(!$abs)return $m[0]; $p=bg_sv_proxy_url($abs,$ticket,$orderId,$expires); return $p==='#'?$m[0]:'@import "'.$p.'"';
    }, $css) ?? $css;
    return $css;
}
function bg_sv_rewrite_html(string $html, string $base, string $ticket, int $orderId, int $expires): string {
    if (!class_exists('DOMDocument')) return $html;
    $prev=libxml_use_internal_errors(true); $dom=new DOMDocument();
    $ok=$dom->loadHTML('<?xml encoding="utf-8" ?>'.$html, LIBXML_HTML_NOIMPLIED|LIBXML_HTML_NODEFDTD);
    libxml_clear_errors(); libxml_use_internal_errors($prev); if(!$ok)return $html;
    foreach(iterator_to_array($dom->getElementsByTagName('base')) as $baseEl){ $baseEl->parentNode?->removeChild($baseEl); }
    $map=['a'=>'href','link'=>'href','script'=>'src','img'=>'src','source'=>'src','video'=>'src','audio'=>'src','iframe'=>'src','form'=>'action'];
    foreach($map as $tag=>$attr){
        foreach(iterator_to_array($dom->getElementsByTagName($tag)) as $el){
            if(!$el->hasAttribute($attr))continue; $v=$el->getAttribute($attr); $abs=bg_sv_abs_url($base,$v); if(!$abs)continue;
            $prox=bg_sv_proxy_url($abs,$ticket,$orderId,$expires); if($prox!=='#')$el->setAttribute($attr,$prox);
            if($tag==='a'){$el->setAttribute('target','_self');$el->setAttribute('rel','noreferrer');}
        }
    }
    foreach(iterator_to_array($dom->getElementsByTagName('img')) as $el){
        if(!$el->hasAttribute('srcset'))continue; $parts=[];
        foreach(explode(',',$el->getAttribute('srcset')) as $item){$bits=preg_split('/\s+/',trim($item),2);$abs=bg_sv_abs_url($base,$bits[0]??'');if($abs){$prox=bg_sv_proxy_url($abs,$ticket,$orderId,$expires);$parts[]=($prox==='#'?$bits[0]:$prox).(!empty($bits[1])?' '.$bits[1]:'');}}
        if($parts)$el->setAttribute('srcset',implode(', ',$parts));
    }
    foreach(iterator_to_array($dom->getElementsByTagName('style')) as $el){$el->nodeValue=bg_sv_rewrite_css($el->textContent,$base,$ticket,$orderId,$expires);}
    foreach(iterator_to_array($dom->getElementsByTagName('*')) as $el){ if($el->hasAttribute('style')) $el->setAttribute('style', bg_sv_rewrite_css($el->getAttribute('style'),$base,$ticket,$orderId,$expires)); }
    foreach(iterator_to_array($dom->getElementsByTagName('meta')) as $el){ $equiv=strtolower($el->getAttribute('http-equiv')); if($equiv==='refresh' && preg_match('/^\s*(\d+)\s*;\s*url=(.+)$/i',$el->getAttribute('content'),$mm)){ $abs=bg_sv_abs_url($base,trim($mm[2]," \"'")); if($abs){$prox=bg_sv_proxy_url($abs,$ticket,$orderId,$expires); if($prox!=='#')$el->setAttribute('content',$mm[1].';url='.$prox);}} }
    $out=$dom->saveHTML() ?: $html;
    return preg_replace('/^<\?xml[^>]+>\s*/','',$out) ?: $out;
}
function bg_sv_fetch(string $url, int $maxBytes=6_000_000): array {
    $current=$url;
    for($hop=0;$hop<4;$hop++){
        $m=bg_sv_validate_url($current); $body=''; $headers=[];
        $ch=curl_init($current);
        $resolve=$m['host'].':'.$m['port'].':'.$m['ip'];
        curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>false,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>15,CURLOPT_ENCODING=>'',CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_USERAGENT=>'BlueGate-ServiceViewer/1.0',CURLOPT_HTTPHEADER=>['Accept: text/html,application/xhtml+xml,text/css,application/javascript,image/*,*/*;q=0.7','Cookie:'],CURLOPT_RESOLVE=>[$resolve],CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS]);
        curl_setopt($ch,CURLOPT_HEADERFUNCTION,function($ch,$line)use(&$headers){$len=strlen($line);$p=strpos($line,':');if($p!==false){$k=strtolower(trim(substr($line,0,$p)));$headers[$k]=trim(substr($line,$p+1));}return $len;});
        curl_setopt($ch,CURLOPT_WRITEFUNCTION,function($ch,$chunk)use(&$body,$maxBytes){if(strlen($body)+strlen($chunk)>$maxBytes)return 0;$body.=$chunk;return strlen($chunk);});
        $ok=curl_exec($ch);$err=curl_error($ch);$code=(int)curl_getinfo($ch,CURLINFO_RESPONSE_CODE);$ctype=(string)(curl_getinfo($ch,CURLINFO_CONTENT_TYPE)?:($headers['content-type']??''));curl_close($ch);
        if($ok===false && strlen($body)>=$maxBytes) throw new RuntimeException('SERVICE_RESPONSE_TOO_LARGE');
        if($ok===false) throw new RuntimeException('SERVICE_FETCH_FAILED:'.$err);
        if($code>=300&&$code<400&&!empty($headers['location'])){$next=bg_sv_abs_url($current,$headers['location']);if(!$next)throw new RuntimeException('SERVICE_REDIRECT_BLOCKED');$current=$next;continue;}
        if($code<200||$code>=400) throw new RuntimeException('SERVICE_REMOTE_HTTP_'.$code);
        return ['body'=>$body,'content_type'=>$ctype?:'text/html; charset=utf-8','url'=>$current,'status'=>$code];
    }
    throw new RuntimeException('SERVICE_TOO_MANY_REDIRECTS');
}

function bg_sv_set_order_delivery(int $orderId, string $url, string $title='', string $note='', bool $markDelivered=true): ?array {
    $order=order_by_id($orderId); if(!$order)return null;
    $url=trim($url); if($url!=='') bg_sv_validate_url($url);
    $title=trim($title); if($title==='')$title='مدیریت سرویس';
    if(mb_strlen($title)>120)$title=mb_substr($title,0,120);
    db()->prepare('UPDATE orders SET delivery_url=?, delivery_title=? WHERE id=?')->execute([$url?:null,$url?$title:null,$orderId]);
    if($markDelivered && $url!==''){
        $fresh=order_by_id($orderId);
        if(normalize_order_status((string)$fresh['status'])!=='delivered'){
            $note=trim($note); if($note==='')$note='سرویس شما آماده است. برای مشاهده و مدیریت سرویس از دکمه «باز کردن سرویس» در جزئیات سفارش استفاده کنید.';
            $fresh=deliver_order($orderId,$note);
        }
    }
    add_order_event($orderId,'delivered','لینک مدیریت سرویس ثبت شد','دسترسی امن سرویس برای مشتری فعال شد',true);
    return order_by_id($orderId);
}
