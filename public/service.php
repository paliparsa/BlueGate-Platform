<?php
if(isset($_GET['sub']) && trim((string)$_GET['sub'])!==''){
    require_once __DIR__.'/../app/bootstrap.php';
    require_once __DIR__.'/../app/service_engine.php';
    try {
        $payload=bluegate_service_subscription_payload(trim((string)$_GET['sub']));
        $lines=$payload['links']??[];
        if(!$lines){
            foreach(($payload['urls']??[]) as $u){
                $u=trim((string)$u);if($u==='')continue;
                $ctx=stream_context_create(['http'=>['timeout'=>8,'ignore_errors'=>true,'user_agent'=>'BlueGate/0.7 Subscription Aggregator'],'ssl'=>['verify_peer'=>true,'verify_peer_name'=>true]]);
                $body=@file_get_contents($u,false,$ctx);if($body===false||trim($body)==='')continue;
                $decoded=base64_decode(trim($body),true);
                $text=$decoded!==false&&preg_match('/(?:vless|vmess|trojan|ss|wireguard|hysteria|tuic):\/\//i',$decoded)?$decoded:$body;
                foreach(preg_split('/\R+/',trim($text))?:[] as $ln){$ln=trim($ln);if($ln!=='')$lines[]=$ln;}
            }
        }
        $lines=array_values(array_unique($lines));if(!$lines)throw new RuntimeException('SUBSCRIPTION_EMPTY');
        header('Content-Type: text/plain; charset=utf-8');header('Cache-Control: no-store, max-age=0');header('X-BlueGate-Subscription: aggregate');
        echo base64_encode(implode("\n",$lines)."\n");exit;
    } catch(Throwable $e){http_response_code(404);header('Content-Type: text/plain; charset=utf-8');echo 'Subscription unavailable';exit;}
}
// Compatibility tombstone for the retired viewer route.
http_response_code(410);header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');header('Content-Type: text/html; charset=utf-8');
?><!doctype html><html lang="fa" dir="rtl"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>BlueGate</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07111e;color:#eef6ff;font-family:Tahoma,Arial,sans-serif;padding:24px;box-sizing:border-box}.box{max-width:430px;border:1px solid #20364f;background:#0c1828;border-radius:24px;padding:28px;text-align:center}p{color:#9eb1c9;line-height:1.9}a{color:#54aaff}</style></head><body><div class="box"><h2>Viewer قدیمی بازنشسته شده</h2><p>برای باز کردن لینک مستقیم سرویس، به صفحه سفارش‌های خودت برگرد و روی «باز کردن سرویس» بزن.</p><a href="/orders">رفتن به سفارش‌ها</a></div></body></html>
