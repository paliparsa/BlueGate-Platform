<?php
/** BlueGate Service Engine - Phase 8: 3x-ui + official Marzban/Remnawave connectors. */
interface BlueGateServiceProviderInterface {
    public function driver(): string;
    public function testConnection(): array;
    public function listInbounds(): array;
    public function getClient(string $externalId): array;
    public function createService(array $request): array;
    public function updateService(string $externalId,array $request): array;
    public function renewService(array $request): array;
    public function suspendService(string $externalId): bool;
    public function resumeService(string $externalId): bool;
    public function deleteService(string $externalId): bool;
    public function getUsage(string $externalId): array;
    public function getSubscription(string $externalId,array $context=[]): array;
}

abstract class BlueGateAbstractProvider implements BlueGateServiceProviderInterface {
    protected array $provider;
    public function __construct(array $provider){ $this->provider=$provider; }
    protected function unavailable(): never { throw new RuntimeException('PROVIDER_DRIVER_NOT_IMPLEMENTED'); }
    public function listInbounds(): array { $this->unavailable(); }
    public function getClient(string $externalId): array { $this->unavailable(); }
    public function createService(array $request): array { $this->unavailable(); }
    public function updateService(string $externalId,array $request): array { $this->unavailable(); }
    public function renewService(array $request): array { $this->unavailable(); }
    public function suspendService(string $externalId): bool { $this->unavailable(); }
    public function resumeService(string $externalId): bool { $this->unavailable(); }
    public function deleteService(string $externalId): bool { $this->unavailable(); }
    public function getUsage(string $externalId): array { $this->unavailable(); }
    public function getSubscription(string $externalId,array $context=[]): array { $this->unavailable(); }
}

final class BlueGatePlaceholderProvider extends BlueGateAbstractProvider {
    public function driver(): string { return strtolower((string)($this->provider['driver']??'placeholder')); }
    public function testConnection(): array { return ['ok'=>false,'status'=>'not_implemented','latency_ms'=>null,'message'=>'Driver registered; live connector is scheduled for a later phase.']; }
}

require_once __DIR__.'/providers/XuiProvider.php';
require_once __DIR__.'/providers/MarzbanProvider.php';
require_once __DIR__.'/providers/RemnawaveProvider.php';

final class BlueGateProviderRegistry {
    public static function supportedDrivers(): array { return [
        'xui'=>['label'=>'3x-ui','phase'=>2,'live'=>true],
        'marzban'=>['label'=>'Marzban','phase'=>8,'live'=>true],
        'remnawave'=>['label'=>'Remnawave','phase'=>8,'live'=>true],
        'manual'=>['label'=>'Manual','phase'=>1,'live'=>false],
    ]; }
    public static function make(array $provider): BlueGateServiceProviderInterface {
        $driver=strtolower(trim((string)($provider['driver']??'')));
        if(!isset(self::supportedDrivers()[$driver])) throw new RuntimeException('UNSUPPORTED_PROVIDER_DRIVER');
        return match($driver){'xui'=>new BlueGateXuiProvider($provider),'marzban'=>new BlueGateMarzbanProvider($provider),'remnawave'=>new BlueGateRemnawaveProvider($provider),default=>new BlueGatePlaceholderProvider($provider)};
    }
}

function bluegate_uuid_v4(): string { $d=random_bytes(16);$d[6]=chr((ord($d[6])&0x0f)|0x40);$d[8]=chr((ord($d[8])&0x3f)|0x80);return vsprintf('%s%s-%s-%s-%s-%s%s%s',str_split(bin2hex($d),4)); }
function bluegate_service_key(): string { $raw=trim((string)app_config('SERVICE_ENCRYPTION_KEY', app_config('APP_ENCRYPTION_KEY','')));if($raw===''){ $master=trim((string)app_config('WEBHOOK_SECRET','')); if($master==='') throw new RuntimeException('SERVICE_ENCRYPTION_KEY_REQUIRED'); $raw=hash('sha256','bluegate-service-engine:'.$master); } return hash('sha256',$raw,true); }
function bluegate_encrypt_secret(?string $plain): ?string { if($plain===null||$plain==='')return null;$key=bluegate_service_key();if(function_exists('sodium_crypto_secretbox')){$nonce=random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);return 'sbox1:'.base64_encode($nonce.sodium_crypto_secretbox($plain,$nonce,$key));}$iv=random_bytes(12);$tag='';$cipher=openssl_encrypt($plain,'aes-256-gcm',$key,OPENSSL_RAW_DATA,$iv,$tag,'bluegate-service-engine');if($cipher===false)throw new RuntimeException('SECRET_ENCRYPTION_FAILED');return 'gcm1:'.base64_encode($iv.$tag.$cipher); }
function bluegate_decrypt_secret(?string $payload): ?string { if($payload===null||$payload==='')return null;$key=bluegate_service_key();[$v,$b64]=array_pad(explode(':',$payload,2),2,'');$bin=base64_decode($b64,true);if($bin===false)throw new RuntimeException('SECRET_PAYLOAD_INVALID');if($v==='sbox1'){$n=SODIUM_CRYPTO_SECRETBOX_NONCEBYTES;$plain=sodium_crypto_secretbox_open(substr($bin,$n),substr($bin,0,$n),$key);if($plain===false)throw new RuntimeException('SECRET_DECRYPTION_FAILED');return $plain;}if($v==='gcm1'){$plain=openssl_decrypt(substr($bin,28),'aes-256-gcm',$key,OPENSSL_RAW_DATA,substr($bin,0,12),substr($bin,12,16),'bluegate-service-engine');if($plain===false)throw new RuntimeException('SECRET_DECRYPTION_FAILED');return $plain;}throw new RuntimeException('SECRET_VERSION_UNSUPPORTED'); }
function bluegate_provider_safe(array $p): array { $hasSecret=!empty($p['secret_encrypted']);$hasToken=!empty($p['api_token_encrypted']);unset($p['secret_encrypted'],$p['api_token_encrypted']);$p['has_secret']=$hasSecret;$p['has_api_token']=$hasToken;$p['metadata']=json_decode((string)($p['metadata_json']??'{}'),true)?:[];return $p; }
function bluegate_providers(bool $activeOnly=false): array { if(!table_exists('service_providers'))return[];$sql='SELECT * FROM service_providers'.($activeOnly?' WHERE is_active=1':'').' ORDER BY priority ASC,id DESC';return array_map('bluegate_provider_safe',db()->query($sql)->fetchAll()?:[]); }
function bluegate_provider(int $id,bool $withSecrets=false): ?array { if(!table_exists('service_providers'))return null;$q=db()->prepare('SELECT * FROM service_providers WHERE id=?');$q->execute([$id]);$p=$q->fetch();if(!$p)return null;return $withSecrets?$p:bluegate_provider_safe($p); }
function bluegate_save_provider(array $input): int {
    $id=max(0,(int)($input['provider_id']??0));$name=trim((string)($input['name']??''));$driver=strtolower(trim((string)($input['driver']??'')));$base=trim((string)($input['base_url']??''));$auth=strtolower(trim((string)($input['auth_type']??'none')));
    if($name===''||!isset(BlueGateProviderRegistry::supportedDrivers()[$driver]))throw new RuntimeException('INVALID_PROVIDER');if($base!==''&&!preg_match('#^https?://#i',$base))throw new RuntimeException('INVALID_PROVIDER_URL');
    if($driver==='xui'&&!in_array($auth,['token','legacy','basic'],true))throw new RuntimeException('INVALID_XUI_AUTH_TYPE');
    if($driver==='marzban'&&!in_array($auth,['token','legacy','basic'],true))throw new RuntimeException('INVALID_MARZBAN_AUTH_TYPE');
    if($driver==='remnawave'&&$auth!=='token')throw new RuntimeException('REMNAWAVE_TOKEN_AUTH_REQUIRED');
    $secret=array_key_exists('secret',$input)&&trim((string)$input['secret'])!==''?bluegate_encrypt_secret((string)$input['secret']):null;
    $token=array_key_exists('api_token',$input)&&trim((string)$input['api_token'])!==''?bluegate_encrypt_secret((string)$input['api_token']):null;
    $meta=is_array($input['metadata']??null)?$input['metadata']:[];
    foreach(['verify_tls','subscription_base_url','subscription_path','default_inbound_id','connect_timeout','request_timeout','api_version'] as $k) if(array_key_exists($k,$input))$meta[$k]=$input[$k];
    if(isset($meta['verify_tls']))$meta['verify_tls']=filter_var($meta['verify_tls'],FILTER_VALIDATE_BOOLEAN,FILTER_NULL_ON_FAILURE)??true;
    $metaJson=json_encode($meta,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    if($id>0){$old=bluegate_provider($id,true);if(!$old)throw new RuntimeException('PROVIDER_NOT_FOUND');$q=db()->prepare('UPDATE service_providers SET name=?,driver=?,base_url=?,auth_type=?,username=?,secret_encrypted=?,api_token_encrypted=?,status=?,priority=?,weight=?,max_clients=?,metadata_json=?,is_active=? WHERE id=?');$q->execute([$name,$driver,$base?:null,$auth,trim((string)($input['username']??''))?:null,$secret??$old['secret_encrypted'],$token??$old['api_token_encrypted'],trim((string)($input['status']??$old['status'])),max(0,(int)($input['priority']??100)),max(0,(int)($input['weight']??100)),($input['max_clients']??'')===''?null:max(0,(int)$input['max_clients']),$metaJson,!empty($input['is_active'])?1:0,$id]);return$id;}
    $q=db()->prepare('INSERT INTO service_providers (name,driver,base_url,auth_type,username,secret_encrypted,api_token_encrypted,status,priority,weight,max_clients,metadata_json,is_active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');$q->execute([$name,$driver,$base?:null,$auth,trim((string)($input['username']??''))?:null,$secret,$token,trim((string)($input['status']??'disabled')),max(0,(int)($input['priority']??100)),max(0,(int)($input['weight']??100)),($input['max_clients']??'')===''?null:max(0,(int)$input['max_clients']),$metaJson,!empty($input['is_active'])?1:0]);return(int)db()->lastInsertId();
}
function bluegate_provider_driver(int $id): BlueGateServiceProviderInterface { $p=bluegate_provider($id,true);if(!$p)throw new RuntimeException('PROVIDER_NOT_FOUND');return BlueGateProviderRegistry::make($p); }
function bluegate_test_provider(int $id): array { $start=microtime(true);$r=bluegate_provider_driver($id)->testConnection();$lat=$r['latency_ms']??(int)round((microtime(true)-$start)*1000);$status=(string)($r['status']??(!empty($r['ok'])?'online':'offline'));$msg=mb_substr((string)($r['message']??''),0,500);db()->prepare('UPDATE service_providers SET status=?,last_health_status=?,last_health_message=?,last_health_latency_ms=?,last_health_check=NOW() WHERE id=?')->execute([$status,$status,$msg,$lat,$id]);db()->prepare('INSERT INTO provider_health_logs (provider_id,health_status,latency_ms,message,details_json) VALUES (?,?,?,?,?)')->execute([$id,$status,$lat,$msg,json_encode($r,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);return$r+['latency_ms'=>$lat]; }
function bluegate_provider_inbounds(int $id): array { return bluegate_provider_driver($id)->listInbounds(); }
function bluegate_provider_client(int $id,string $externalId): array { return bluegate_provider_driver($id)->getClient($externalId); }
function bluegate_provider_create_client(int $id,array $request): array { return bluegate_provider_driver($id)->createService($request); }
function bluegate_provider_update_client(int $id,string $externalId,array $request): array { return bluegate_provider_driver($id)->updateService($externalId,$request); }
function bluegate_provider_delete_client(int $id,string $externalId): bool { return bluegate_provider_driver($id)->deleteService($externalId); }
function bluegate_provider_usage(int $id,string $externalId): array { return bluegate_provider_driver($id)->getUsage($externalId); }
function bluegate_provider_subscription(int $id,string $externalId,array $context=[]): array { return bluegate_provider_driver($id)->getSubscription($externalId,$context); }
function bluegate_infrastructure_summary(): array { $providers=bluegate_providers(false);$counts=['providers'=>count($providers),'active'=>0,'online'=>0,'queued_jobs'=>0,'services'=>0];foreach($providers as$p){if(!empty($p['is_active']))$counts['active']++;if(($p['last_health_status']??'')==='online')$counts['online']++;}if(table_exists('provisioning_jobs'))$counts['queued_jobs']=(int)db()->query("SELECT COUNT(*) c FROM provisioning_jobs WHERE status IN ('queued','retry')")->fetch()['c'];if(table_exists('user_services'))$counts['services']=(int)db()->query("SELECT COUNT(*) c FROM user_services WHERE status NOT IN ('deleted','canceled')")->fetch()['c'];if(table_exists('provider_incidents'))$counts['open_incidents']=(int)db()->query("SELECT COUNT(*) FROM provider_incidents WHERE status='open'")->fetchColumn();else $counts['open_incidents']=0;return['providers'=>$providers,'drivers'=>BlueGateProviderRegistry::supportedDrivers(),'counts'=>$counts,'phase'=>8,'routing'=>function_exists('bluegate_routing_dashboard')?bluegate_routing_dashboard():[]]; }


/* ---------------- Phase 3: plan mapping + auto provisioning ---------------- */
function bluegate_json_array($value): array { if(is_array($value)) return $value; if(!is_string($value)||trim($value)==='') return []; $d=json_decode($value,true); return is_array($d)?$d:[]; }
function bluegate_plan_provider_maps(?int $planId=null): array {
    if(!table_exists('service_plan_provider_map')) return [];
    $sql='SELECT m.*,p.name provider_name,p.driver,p.status provider_status,p.is_active provider_active,sp.title plan_title,sp.duration_days,sp.delivery_type FROM service_plan_provider_map m JOIN service_providers p ON p.id=m.provider_id JOIN service_plans sp ON sp.id=m.service_plan_id';$params=[];
    if($planId){$sql.=' WHERE m.service_plan_id=?';$params[]=$planId;}$sql.=' ORDER BY m.service_plan_id,m.priority ASC,m.id ASC';$q=db()->prepare($sql);$q->execute($params);$rows=$q->fetchAll()?:[];foreach($rows as &$r)$r['config']=bluegate_json_array($r['config_json']??null);return $rows;
}
function bluegate_save_plan_provider_map(array $in): int {
    $id=max(0,(int)($in['map_id']??0));
    $plan=(int)($in['service_plan_id']??0);
    $provider=(int)($in['provider_id']??0);
    if($plan<=0||$provider<=0) throw new RuntimeException('PLAN_PROVIDER_REQUIRED');

    $p=bluegate_provider($provider,true);
    if(!$p) throw new RuntimeException('PROVIDER_NOT_FOUND');
    $driver=strtolower((string)($p['driver']??''));

    $cfg=is_array($in['config']??null)?$in['config']:[];
    // Human-friendly GB input used by the simplified mapping wizard.
    if(array_key_exists('traffic_gb',$in) && $in['traffic_gb']!=='') {
        $gb=max(0,(float)$in['traffic_gb']);
        $cfg['traffic_limit_bytes']=(int)round($gb*1073741824);
    }
    foreach(['traffic_limit_bytes','duration_days','email_prefix','flow','limit_ip','limit_hwid','sub_id_prefix','inbound_ids','traffic_limit_strategy','data_limit_reset_strategy'] as $k) {
        if(array_key_exists($k,$in)&&$in[$k]!=='') $cfg[$k]=$in[$k];
    }
    if(isset($cfg['inbound_ids'])) {
        $ids=is_array($cfg['inbound_ids'])?$cfg['inbound_ids']:preg_split('/\s*,\s*/',(string)$cfg['inbound_ids'],-1,PREG_SPLIT_NO_EMPTY);
        $ids=array_values(array_unique(array_filter(array_map(fn($x)=>trim((string)$x),$ids),fn($x)=>$x!=='')));
        $cfg['inbound_ids']=$ids;
    } else $ids=[];

    foreach(['proxies_json'=>'proxies','inbounds_json'=>'inbounds','active_internal_squads_json'=>'active_internal_squads'] as $src=>$dst) {
        if(array_key_exists($src,$in)&&trim((string)$in[$src])!=='') {
            $d=json_decode((string)$in[$src],true);
            if(!is_array($d)) throw new RuntimeException('INVALID_'.strtoupper($src));
            $cfg[$dst]=$d;
        }
    }

    $target=trim((string)($in['remote_target_id']??''));
    if($target==='' && !empty($ids)) $target=(string)$ids[0];
    if($target==='') throw new RuntimeException($driver==='xui'?'XUI_INBOUND_REQUIRED':'PLAN_PROVIDER_TARGET_REQUIRED');

    // 3x-ui mode is inferred; normal admins never need to understand provisioning modes.
    $mode=trim((string)($in['provisioning_mode']??''));
    if($driver==='xui') $mode=count($ids)>1?'panel_bundle':'single';
    elseif($mode==='') $mode='single';

    // Normalize the simple limits.
    if(isset($cfg['duration_days'])) $cfg['duration_days']=max(0,(int)$cfg['duration_days']);
    if(isset($cfg['limit_ip'])) $cfg['limit_ip']=max(0,(int)$cfg['limit_ip']);
    if(isset($cfg['traffic_limit_bytes'])) $cfg['traffic_limit_bytes']=max(0,(int)$cfg['traffic_limit_bytes']);

    $json=json_encode($cfg,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    $name=trim((string)($in['remote_target_name']??''))?:null;
    $priority=max(0,(int)($in['priority']??100));
    $weight=max(0,(int)($in['weight']??100));
    $active=!empty($in['is_active'])?1:0;
    if($id){
        $q=db()->prepare('UPDATE service_plan_provider_map SET service_plan_id=?,provider_id=?,remote_target_id=?,remote_target_name=?,provisioning_mode=?,priority=?,weight=?,config_json=?,is_active=? WHERE id=?');
        $q->execute([$plan,$provider,$target,$name,$mode,$priority,$weight,$json,$active,$id]);
        return $id;
    }
    $q=db()->prepare('INSERT INTO service_plan_provider_map (service_plan_id,provider_id,remote_target_id,remote_target_name,provisioning_mode,priority,weight,config_json,is_active) VALUES (?,?,?,?,?,?,?,?,?)');
    $q->execute([$plan,$provider,$target,$name,$mode,$priority,$weight,$json,$active]);
    return (int)db()->lastInsertId();
}
function bluegate_delete_plan_provider_map(int $id): bool {$q=db()->prepare('DELETE FROM service_plan_provider_map WHERE id=?');$q->execute([$id]);return $q->rowCount()>0;}
function bluegate_map_inbound_ids(array $m): array {
    $cfg=array_merge(bluegate_json_array($m['config_json']??null),$m['config']??[]);$ids=$cfg['inbound_ids']??$cfg['target_ids']??[];
    if(!is_array($ids))$ids=preg_split('/\s*,\s*/',(string)$ids,-1,PREG_SPLIT_NO_EMPTY)?:[];
    if(!$ids&&!empty($m['remote_target_id']))$ids=[(string)$m['remote_target_id']];
    return array_values(array_unique(array_filter(array_map(fn($x)=>trim((string)$x),$ids),fn($x)=>$x!=='')));
}
function bluegate_instance_targets(int $instanceId): array {
    if(!table_exists('service_instance_targets'))return[];$q=db()->prepare('SELECT * FROM service_instance_targets WHERE service_instance_id=? ORDER BY id');$q->execute([$instanceId]);return $q->fetchAll()?:[];
}
function bluegate_sync_instance_targets(int $instanceId,array $targetIds,array $names=[]): void {
    if(!table_exists('service_instance_targets'))return;$ids=array_values(array_unique(array_filter(array_map(fn($x)=>trim((string)$x),$targetIds),fn($x)=>$x!=='')));$pdo=db();
    if(!$ids){$pdo->prepare('DELETE FROM service_instance_targets WHERE service_instance_id=?')->execute([$instanceId]);return;}
    $marks=implode(',',array_fill(0,count($ids),'?'));$pdo->prepare('DELETE FROM service_instance_targets WHERE service_instance_id=? AND remote_target_id NOT IN ('.$marks.')')->execute(array_merge([$instanceId],$ids));
    $q=$pdo->prepare('INSERT INTO service_instance_targets (service_instance_id,remote_target_id,remote_target_name,target_type,status) VALUES (?,?,?,"target","active") ON DUPLICATE KEY UPDATE remote_target_name=VALUES(remote_target_name),status="active"');
    foreach($ids as $id)$q->execute([$instanceId,$id,$names[$id]??null]);
}
function bluegate_instance_inbound_ids(array $instance): array {
    $rows=bluegate_instance_targets((int)($instance['id']??0));if($rows)return array_values(array_map(fn($x)=>(string)$x['remote_target_id'],$rows));
    $meta=bluegate_json_array($instance['metadata_json']??null);$ids=$meta['inbound_ids']??$meta['target_ids']??[];if(!is_array($ids))$ids=[];if(!$ids&&!empty($instance['remote_target_id']))$ids=[(string)$instance['remote_target_id']];return array_values(array_unique(array_filter(array_map(fn($x)=>trim((string)$x),$ids),fn($x)=>$x!=='')));
}
function bluegate_provider_target_names(int $providerId,array $targetIds): array {
    $ids=array_values(array_unique(array_filter(array_map(fn($x)=>trim((string)$x),$targetIds),fn($x)=>$x!==''))); if(!$ids)return[];
    try{$driver=bluegate_provider_driver($providerId);$rows=$driver->listInbounds();$out=[];foreach($rows as $r){$id=trim((string)($r['id']??''));if($id===''||!in_array($id,$ids,true))continue;$name=trim((string)($r['remark']??$r['name']??$r['tag']??''));if($name!=='')$out[$id]=$name;}return$out;}catch(Throwable $e){return[];}
}
function bluegate_routing_settings(): array {
    $d=['strategy'=>'priority_weighted','allow_degraded'=>1,'capacity_reserve'=>0,'circuit_failure_threshold'=>3,'circuit_open_seconds'=>300];
    if(!table_exists('routing_settings')) return $d;
    try{$r=db()->query('SELECT * FROM routing_settings WHERE id=1')->fetch();return $r?array_merge($d,$r):$d;}catch(Throwable $e){return $d;}
}
function bluegate_save_routing_settings(array $in): array {
    $strategy=strtolower(trim((string)($in['strategy']??'priority_weighted')));if(!in_array($strategy,['priority','weighted','capacity','priority_weighted'],true))$strategy='priority_weighted';
    $q=db()->prepare('INSERT INTO routing_settings (id,strategy,allow_degraded,capacity_reserve,circuit_failure_threshold,circuit_open_seconds) VALUES (1,?,?,?,?,?) ON DUPLICATE KEY UPDATE strategy=VALUES(strategy),allow_degraded=VALUES(allow_degraded),capacity_reserve=VALUES(capacity_reserve),circuit_failure_threshold=VALUES(circuit_failure_threshold),circuit_open_seconds=VALUES(circuit_open_seconds)');
    $q->execute([$strategy,!empty($in['allow_degraded'])?1:0,max(0,min(100000,(int)($in['capacity_reserve']??0))),max(1,min(20,(int)($in['circuit_failure_threshold']??3))),max(30,min(86400,(int)($in['circuit_open_seconds']??300)))]);return bluegate_routing_settings();
}
function bluegate_provider_route_state(int $providerId): array {
    $d=['provider_id'=>$providerId,'consecutive_failures'=>0,'circuit_state'=>'closed','open_until'=>null];if(!table_exists('provider_route_state'))return $d;
    $q=db()->prepare('SELECT * FROM provider_route_state WHERE provider_id=?');$q->execute([$providerId]);$r=$q->fetch();if(!$r)return $d;if(($r['circuit_state']??'closed')==='open'&&!empty($r['open_until'])&&strtotime((string)$r['open_until'])<=time()){$r['circuit_state']='half_open';}return array_merge($d,$r);
}
function bluegate_route_provider_success(int $providerId): void {if(!table_exists('provider_route_state'))return;db()->prepare('INSERT INTO provider_route_state (provider_id,consecutive_failures,circuit_state,last_success_at,last_error) VALUES (?,0,"closed",NOW(),NULL) ON DUPLICATE KEY UPDATE consecutive_failures=0,circuit_state="closed",open_until=NULL,last_success_at=NOW(),last_error=NULL')->execute([$providerId]);}
function bluegate_route_provider_failure(int $providerId,string $error): array {
    if(!table_exists('provider_route_state'))return ['opened'=>false];$cfg=bluegate_routing_settings();$state=bluegate_provider_route_state($providerId);$n=(int)$state['consecutive_failures']+1;$open=$n>=(int)$cfg['circuit_failure_threshold'];$until=$open?date('Y-m-d H:i:s',time()+(int)$cfg['circuit_open_seconds']):null;
    db()->prepare('INSERT INTO provider_route_state (provider_id,consecutive_failures,circuit_state,open_until,last_failure_at,last_error) VALUES (?,?,?, ?,NOW(),?) ON DUPLICATE KEY UPDATE consecutive_failures=VALUES(consecutive_failures),circuit_state=VALUES(circuit_state),open_until=VALUES(open_until),last_failure_at=NOW(),last_error=VALUES(last_error)')->execute([$providerId,$n,$open?'open':'closed',$until,mb_substr($error,0,1000)]);return ['opened'=>$open,'failures'=>$n,'open_until'=>$until];
}
function bluegate_provider_capacity(int $providerId,?int $maxClients=null): array {
    $q=db()->prepare("SELECT COUNT(*) FROM service_instances WHERE provider_id=? AND status IN ('active','pending','suspended')");$q->execute([$providerId]);$active=(int)$q->fetchColumn();$max=$maxClients===null?null:max(0,$maxClients);$usedRatio=($max&&$max>0)?min(1,$active/$max):0.0;return ['active'=>$active,'max'=>$max,'free'=>$max===null?null:max(0,$max-$active),'utilization'=>$usedRatio];
}
function bluegate_route_candidates(int $planId,?array $mapIds=null): array {
    $maps=bluegate_plan_provider_maps($planId);$wanted=$mapIds?array_flip(array_map('intval',$mapIds)):null;$cfg=bluegate_routing_settings();$out=[];
    foreach($maps as $m){if(empty($m['is_active'])||empty($m['provider_active']))continue;if($wanted!==null&&!isset($wanted[(int)$m['id']]))continue;$pid=(int)$m['provider_id'];$p=bluegate_provider($pid);if(!$p)continue;$driverMeta=BlueGateProviderRegistry::supportedDrivers()[(string)$p['driver']]??[];if(empty($driverMeta['live']))continue;$econ=function_exists('bluegate_provider_economics')?bluegate_provider_economics($pid):[];if(!empty($econ['maintenance_mode']))continue;$state=bluegate_provider_route_state($pid);if(($state['circuit_state']??'closed')==='open'&&!empty($state['open_until'])&&strtotime((string)$state['open_until'])>time())continue;$health=strtolower((string)($p['last_health_status']??$p['status']??'unknown'));if($health==='offline')continue;if($health==='degraded'&&empty($cfg['allow_degraded']))continue;$cap=bluegate_provider_capacity($pid,$p['max_clients']===null?null:(int)$p['max_clients']);$reserve=(int)$cfg['capacity_reserve'];if($cap['max']!==null&&$cap['free']<=$reserve)continue;if($cap['max']!==null&&!empty($econ['soft_capacity_percent'])&&($cap['utilization']*100)>=(int)$econ['soft_capacity_percent'])continue;$m['provider']=$p;$m['route_state']=$state;$m['capacity']=$cap;$m['health']=$health;$m['economics']=$econ;$out[]=$m;}
    return $out;
}
function bluegate_weighted_pick(array $items,callable $weightFn): ?array {if(!$items)return null;$sum=0;$weights=[];foreach($items as $k=>$x){$w=max(1,(int)round($weightFn($x)));$weights[$k]=$w;$sum+=$w;}$r=random_int(1,max(1,$sum));foreach($items as $k=>$x){$r-=$weights[$k];if($r<=0)return$x;}return end($items)?:null;}
function bluegate_route_order(array $order,array $plan,?array $mapIds=null): array {
    $cfg=bluegate_routing_settings();$c=bluegate_route_candidates((int)$plan['id'],$mapIds);if(!$c)throw new RuntimeException('NO_HEALTHY_ROUTE');$strategy=(string)$cfg['strategy'];$ordered=[];
    if($strategy==='capacity'){usort($c,fn($a,$b)=>[$a['capacity']['utilization'],(int)$a['priority'],(int)$a['id']]<=>[$b['capacity']['utilization'],(int)$b['priority'],(int)$b['id']]);$ordered=$c;}
    elseif($strategy==='priority'){usort($c,fn($a,$b)=>[(int)$a['priority'],$a['capacity']['utilization'],(int)$a['id']]<=>[(int)$b['priority'],$b['capacity']['utilization'],(int)$b['id']]);$ordered=$c;}
    else {if($strategy==='priority_weighted'){$min=min(array_map(fn($x)=>(int)$x['priority'],$c));$pool=array_values(array_filter($c,fn($x)=>(int)$x['priority']===$min));}else{$pool=$c;}$first=bluegate_weighted_pick($pool,function($x){$mapW=max(1,(int)($x['weight']??100));$providerW=max(1,(int)($x['provider']['weight']??100));$freeFactor=$x['capacity']['max']===null?1.0:max(.05,1.0-(float)$x['capacity']['utilization']);$healthFactor=$x['health']==='degraded'?.25:1.0;return $mapW*$providerW*$freeFactor*$healthFactor;});if($first){$ordered[]=$first;$rest=array_values(array_filter($c,fn($x)=>(int)$x['id']!==(int)$first['id']));usort($rest,fn($a,$b)=>[(int)$a['priority'],$a['capacity']['utilization'],-(int)$a['weight']]<=>[(int)$b['priority'],$b['capacity']['utilization'],-(int)$b['weight']]);$ordered=array_merge($ordered,$rest);}else $ordered=$c;}
    $decision=['strategy'=>$strategy,'candidate_count'=>count($ordered),'candidates'=>array_map(fn($m)=>['map_id'=>(int)$m['id'],'provider_id'=>(int)$m['provider_id'],'target'=>(string)$m['remote_target_id'],'priority'=>(int)$m['priority'],'weight'=>(int)$m['weight'],'health'=>$m['health'],'capacity'=>$m['capacity']],$ordered)];return ['ordered'=>$ordered,'decision'=>$decision];
}
function bluegate_record_route_decision(array $order,array $plan,int $serviceId,int $jobId,array $decision): int {if(!table_exists('routing_decisions'))return 0;$q=db()->prepare('INSERT INTO routing_decisions (order_id,user_service_id,job_id,service_plan_id,strategy,decision_json) VALUES (?,?,?,?,?,?)');$q->execute([(int)$order['id'],$serviceId,$jobId,(int)$plan['id'],(string)$decision['strategy'],json_encode($decision,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);return(int)db()->lastInsertId();}
function bluegate_record_route_attempt(int $decisionId,int $jobId,array $m,string $outcome,?string $error=null,int $latency=0): void {if(!table_exists('routing_attempts'))return;db()->prepare('INSERT INTO routing_attempts (routing_decision_id,job_id,map_id,provider_id,remote_target_id,outcome,error_message,latency_ms) VALUES (?,?,?,?,?,?,?,?)')->execute([$decisionId?:null,$jobId,(int)$m['id'],(int)$m['provider_id'],(string)$m['remote_target_id'],$outcome,$error?mb_substr($error,0,1000):null,$latency?:null]);}
function bluegate_order_auto_plan(array $order): ?array { $pid=(int)($order['catalog_plan_id']??0);if($pid<=0)return null;$q=db()->prepare('SELECT sp.*,sg.name group_name,s.name service_name FROM service_plans sp JOIN service_groups sg ON sg.id=sp.group_id JOIN services s ON s.id=sg.service_id WHERE sp.id=? LIMIT 1');$q->execute([$pid]);$p=$q->fetch();if(!$p)return null;$maps=array_values(array_filter(bluegate_plan_provider_maps($pid),fn($m)=>!empty($m['is_active'])&&!empty($m['provider_active'])));if(!$maps)return null;$p['maps']=$maps;return $p; }
function bluegate_client_suffix(int $len=5): string { $alphabet='abcdefghjkmnpqrstuvwxyz23456789';$out='';for($i=0;$i<$len;$i++)$out.=$alphabet[random_int(0,strlen($alphabet)-1)];return$out; }
function bluegate_service_username(array $order,array $cfg=[],int $serviceId=0): string {
    if($serviceId>0){$q=db()->prepare('SELECT metadata_json FROM user_services WHERE id=?');$q->execute([$serviceId]);$meta=bluegate_json_array($q->fetchColumn()?:null);$saved=trim((string)($meta['client_username']??''));if($saved!=='')return$saved;}
    $uid=max(0,(int)($order['user_id']??0));$tg=max(0,(int)($order['telegram_id']??0));$username=$uid.'_'.$tg.'_'.bluegate_client_suffix(5);
    if($serviceId>0){$q=db()->prepare('SELECT metadata_json FROM user_services WHERE id=?');$q->execute([$serviceId]);$meta=bluegate_json_array($q->fetchColumn()?:null);$meta['client_username']=$username;$meta['client_username_format']='userId_telegramId_random5';db()->prepare('UPDATE user_services SET metadata_json=? WHERE id=?')->execute([json_encode($meta,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),$serviceId]);}
    return$username;
}
function bluegate_create_service_shell(array $order,array $plan): int {
    $q=db()->prepare('SELECT id FROM user_services WHERE order_id=? LIMIT 1');$q->execute([(int)$order['id']]);if($x=$q->fetchColumn())return (int)$x;
    $days=max(0,(int)($plan['duration_days']??0));$expires=$days>0?date('Y-m-d H:i:s',time()+$days*86400):null;$token=bin2hex(random_bytes(32));$name=trim(($plan['service_name']??'').' '.($plan['group_name']??'').' '.($plan['title']??''));
    $clientUsername=max(0,(int)$order['user_id']).'_'.max(0,(int)($order['telegram_id']??0)).'_'.bluegate_client_suffix(5);$meta=['phase'=>3,'source'=>'paid_order','client_username'=>$clientUsername,'client_username_format'=>'userId_telegramId_random5'];
    $q=db()->prepare('INSERT INTO user_services (user_id,order_id,service_plan_id,service_type,display_name,status,started_at,expires_at,subscription_token,metadata_json) VALUES (?,?,?,"managed",?,"pending",NOW(),?,?,?)');$q->execute([(int)$order['user_id'],(int)$order['id'],(int)$plan['id'],$name?:('Service #'.$order['id']),$expires,$token,json_encode($meta,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);return (int)db()->lastInsertId();
}
function bluegate_finalize_initial_provisioning(int $orderId,int $serviceId): ?array {
    $q=db()->prepare('SELECT COUNT(*) FROM provisioning_jobs WHERE user_service_id=? AND job_type="create" AND status<>"completed"');$q->execute([$serviceId]);if((int)$q->fetchColumn()>0)return null;
    $s=bluegate_service_record($serviceId);if(!$s)return null;$pub=bluegate_service_public($s);$url=trim((string)($pub['subscription_url']??''));if($url==='')return null;
    $title='لینک Subscription';$note='سرویس VPN شما با موفقیت ساخته شد. لینک Subscription از بخش «سرویس‌های من» قابل باز کردن و کپی است.';
    $order=set_order_service_delivery($orderId,$url,$title,$note,true);if($order){add_order_event($orderId,'delivered','ساخت و ارسال خودکار سرویس','Client روی پنل ساخته شد و لینک Subscription برای مشتری فعال شد.',true);}
    return$order;
}
function bluegate_queue_order_provisioning(int $orderId,bool $runNow=true): array {
    $order=order_by_id($orderId);if(!$order)throw new RuntimeException('ORDER_NOT_FOUND');if(!in_array(normalize_order_status((string)$order['status']),['payment_confirmed','preparing','delivered'],true))return ['eligible'=>false,'reason'=>'ORDER_NOT_PAID'];
    $plan=bluegate_order_auto_plan($order);if(!$plan)return ['eligible'=>false,'reason'=>'NO_AUTOMATED_MAPPING'];$sid=bluegate_create_service_shell($order,$plan);$created=[];$mode=strtolower((string)($plan['maps'][0]['provisioning_mode']??'single'));$provisionAll=$mode==='all';
    if(!$provisionAll){$key='order:'.(int)$order['id'].':plan:'.(int)$plan['id'].':route';$q=db()->prepare('SELECT id FROM provisioning_jobs WHERE idempotency_key=?');$q->execute([$key]);$old=(int)($q->fetchColumn()?:0);if($old)$created[]=$old;else{$firstCfg=$plan['maps'][0]['config']??[];$req=['order_id'=>(int)$order['id'],'service_plan_id'=>(int)$plan['id'],'candidate_map_ids'=>array_map(fn($m)=>(int)$m['id'],$plan['maps']),'traffic_limit_bytes'=>max(0,(int)($firstCfg['traffic_limit_bytes']??0)),'duration_days'=>max(0,(int)($firstCfg['duration_days']??$plan['duration_days']??0)),'flow'=>(string)($firstCfg['flow']??''),'limit_ip'=>max(0,(int)($firstCfg['limit_ip']??0)),'limit_hwid'=>max(0,(int)($firstCfg['limit_hwid']??0))];$q=db()->prepare('INSERT INTO provisioning_jobs (idempotency_key,job_type,user_service_id,provider_id,status,max_attempts,available_at,request_json) VALUES (? ,"create",?,NULL,"queued",3,NOW(),?)');$q->execute([$key,$sid,json_encode($req,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE)]);$created[]=(int)db()->lastInsertId();}}
    else foreach($plan['maps'] as $m){$key='order:'.(int)$order['id'].':plan:'.(int)$plan['id'].':map:'.(int)$m['id'];$q=db()->prepare('SELECT id FROM provisioning_jobs WHERE idempotency_key=?');$q->execute([$key]);$old=(int)($q->fetchColumn()?:0);if($old){$created[]=$old;continue;}$cfg=$m['config']??[];$req=['order_id'=>(int)$order['id'],'map_id'=>(int)$m['id'],'service_plan_id'=>(int)$plan['id'],'traffic_limit_bytes'=>max(0,(int)($cfg['traffic_limit_bytes']??0)),'duration_days'=>max(0,(int)($cfg['duration_days']??$plan['duration_days']??0)),'flow'=>(string)($cfg['flow']??''),'limit_ip'=>max(0,(int)($cfg['limit_ip']??0)),'limit_hwid'=>max(0,(int)($cfg['limit_hwid']??0))];$q=db()->prepare('INSERT INTO provisioning_jobs (idempotency_key,job_type,user_service_id,provider_id,status,max_attempts,available_at,request_json) VALUES (? ,"create",?,? ,"queued",3,NOW(),?)');$q->execute([$key,$sid,(int)$m['provider_id'],json_encode($req,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE)]);$created[]=(int)db()->lastInsertId();}
    if($created&&normalize_order_status((string)$order['status'])==='payment_confirmed')update_order_status($orderId,'preparing','سرویس در حال ساخت است','Routing و Provisioning خودکار BlueGate شروع شد.',true);if($runNow)foreach($created as $jid){try{bluegate_run_provisioning_job($jid);}catch(Throwable $e){error_log('[BlueGate provisioning #'.$jid.'] '.$e->getMessage());}}return ['eligible'=>true,'user_service_id'=>$sid,'jobs'=>$created];
}
function bluegate_claim_job(int $jobId): array {$pdo=db();$pdo->beginTransaction();try{$q=$pdo->prepare('SELECT * FROM provisioning_jobs WHERE id=? FOR UPDATE');$q->execute([$jobId]);$j=$q->fetch();if(!$j)throw new RuntimeException('PROVISIONING_JOB_NOT_FOUND');if($j['status']==='completed'){$pdo->commit();return ['completed'=>true,'job'=>$j];}if($j['status']==='running')throw new RuntimeException('PROVISIONING_JOB_LOCKED');if((int)$j['attempt_count']>=(int)$j['max_attempts']&&$j['status']==='failed')throw new RuntimeException('PROVISIONING_MAX_ATTEMPTS');$attempt=(int)$j['attempt_count']+1;$pdo->prepare('UPDATE provisioning_jobs SET status="running",attempt_count=?,locked_at=NOW(),locked_by=? WHERE id=?')->execute([$attempt,gethostname()?:'php',$jobId]);$pdo->commit();$j['attempt_count']=$attempt;return ['completed'=>false,'job'=>$j];}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw$e;}}
function bluegate_create_on_route(array $j,array $req,array $order,array $plan,array $m,int $decisionId): array {
    $cfg=array_merge(bluegate_json_array($m['config_json']??null),$m['config']??[]);$email=bluegate_service_username($order,$cfg,(int)$j['user_service_id']);$days=max(0,(int)(array_key_exists('duration_days',$cfg)?$cfg['duration_days']:($req['duration_days']??$plan['duration_days']??0)));$expires=$days>0?date('Y-m-d H:i:s',time()+$days*86400):null;$payload=['email'=>$email,'external_username'=>$email,'inbound_ids'=>bluegate_map_inbound_ids($m),'inbound_id'=>(string)(bluegate_map_inbound_ids($m)[0]??$m['remote_target_id']),'remote_target_id'=>(string)(bluegate_map_inbound_ids($m)[0]??$m['remote_target_id']),'provider_config'=>$cfg,'traffic_limit_bytes'=>max(0,(int)(array_key_exists('traffic_limit_bytes',$cfg)?$cfg['traffic_limit_bytes']:($req['traffic_limit_bytes']??0))),'expires_at'=>$expires,'flow'=>(string)(array_key_exists('flow',$cfg)?$cfg['flow']:($req['flow']??'')),'limit_ip'=>(int)(array_key_exists('limit_ip',$cfg)?$cfg['limit_ip']:($req['limit_ip']??0)),'limit_hwid'=>(int)(array_key_exists('limit_hwid',$cfg)?$cfg['limit_hwid']:($req['limit_hwid']??0)),'tg_id'=>(int)($order['telegram_id']??0),'comment'=>'BlueGate order #'.(int)$order['id']];$pid=(int)$m['provider_id'];db()->prepare('UPDATE provisioning_jobs SET provider_id=? WHERE id=?')->execute([$pid,(int)$j['id']]);$start=microtime(true);$driver=bluegate_provider_driver($pid);$r=null;
    try{$existing=$driver->getClient($email);if($existing){$wanted=$payload['inbound_ids']??[];$have=array_values(array_unique(array_map('intval',$existing['inbound_ids']??[])));$missing=array_values(array_diff(array_map('intval',$wanted),$have));if($missing&&method_exists($driver,'ensureServiceTargets')){$ens=$driver->ensureServiceTargets(['existing'=>$existing,'email'=>$email,'inbound_ids'=>$wanted,'traffic_limit_bytes'=>$payload['traffic_limit_bytes'],'expires_at'=>$payload['expires_at'],'flow'=>$payload['flow'],'limit_ip'=>$payload['limit_ip'],'limit_hwid'=>$payload['limit_hwid']]);$existing=$driver->getClient($email);}$sub0=$driver->getSubscription($email,['sub_id'=>$existing['subId']??$existing['sub_id']??'']);$r=['ok'=>true,'external_client_id'=>(string)($existing['id']??$existing['uuid']??''),'external_username'=>$email,'sub_id'=>(string)($existing['subId']??$existing['sub_id']??''),'inbound_ids'=>$existing['inbound_ids']??$wanted,'subscription'=>$sub0,'adopted_existing'=>true,'provider_response'=>$existing];}}catch(Throwable $ignore){}
    try{if(!$r)$r=$driver->createService($payload);}catch(Throwable $e){$ambiguous=preg_match('/timeout|timed out|connection reset|empty response|network|curl/i',$e->getMessage());if($ambiguous){try{$existing=$driver->getClient($email);if($existing){$sub0=$driver->getSubscription($email,[]);$r=['ok'=>true,'external_client_id'=>(string)($existing['id']??''),'external_username'=>$email,'subscription'=>$sub0,'adopted_after_error'=>true,'provider_response'=>$existing];}}catch(Throwable $reconcile){bluegate_record_route_attempt($decisionId,(int)$j['id'],$m,'ambiguous',$e->getMessage(),(int)round((microtime(true)-$start)*1000));throw new RuntimeException('ROUTE_AMBIGUOUS_RETRY_REQUIRED:'.$e->getMessage());}}if(!$r){bluegate_record_route_attempt($decisionId,(int)$j['id'],$m,'failed',$e->getMessage(),(int)round((microtime(true)-$start)*1000));bluegate_route_provider_failure($pid,$e->getMessage());throw$e;}}
    $ext=(string)($r['external_client_id']??'');$extUser=(string)($r['external_username']??$email);$sub=is_array($r['subscription']??null)?$r['subscription']:[];$url=trim((string)($sub['url']??$sub['primary_link']??''));$pdo=db();$pdo->beginTransaction();try{$q=$pdo->prepare('SELECT id FROM service_instances WHERE user_service_id=? AND provider_id=? AND remote_target_id=? LIMIT 1');$q->execute([(int)$j['user_service_id'],$pid,(string)$m['remote_target_id']]);$iid=(int)($q->fetchColumn()?:0);$inboundIds=$payload['inbound_ids']??[(int)$m['remote_target_id']];$meta=json_encode(['sub_id'=>$r['sub_id']??null,'links'=>$sub['links']??[],'map_id'=>(int)$m['id'],'routing_decision_id'=>$decisionId,'inbound_ids'=>$inboundIds,'subscription_mode'=>count($inboundIds)>1?($driver->driver()==='xui'?'xui_native_multi_inbound':'provider_multi_target'):'native'],JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);if($iid){$pdo->prepare('UPDATE service_instances SET external_client_id=?,external_username=?,status="active",subscription_url=?,traffic_limit_bytes=?,expires_at=?,metadata_json=?,last_sync_at=NOW() WHERE id=?')->execute([$ext?:null,$extUser,$url?:null,(int)$payload['traffic_limit_bytes'],$expires,$meta,$iid]);}else{$pdo->prepare('INSERT INTO service_instances (user_service_id,provider_id,external_client_id,external_username,remote_target_id,status,subscription_url,traffic_limit_bytes,expires_at,last_sync_at,metadata_json) VALUES (?,?,?,?,?,"active",?,?,?,NOW(),?)')->execute([(int)$j['user_service_id'],$pid,$ext?:null,$extUser,(string)$m['remote_target_id'],$url?:null,(int)$payload['traffic_limit_bytes'],$expires,$meta]);$iid=(int)$pdo->lastInsertId();}$targetNames=bluegate_provider_target_names($pid,$inboundIds);bluegate_sync_instance_targets($iid,$inboundIds,$targetNames);$pdo->prepare('UPDATE user_services SET status="active",traffic_limit_bytes=?,started_at=COALESCE(started_at,NOW()),expires_at=COALESCE(?,expires_at),last_sync_at=NOW() WHERE id=?')->execute([(int)$payload['traffic_limit_bytes'],$expires,(int)$j['user_service_id']]);$result=['ok'=>true,'service_instance_id'=>$iid,'external_client_id'=>$ext,'external_username'=>$extUser,'subscription_url'=>$url,'provider_id'=>$pid,'map_id'=>(int)$m['id'],'inbound_ids'=>$inboundIds,'subscription_mode'=>count($inboundIds)>1?($driver->driver()==='xui'?'xui_native_multi_inbound':'provider_multi_target'):'native','provider_result'=>$r];$pdo->prepare('UPDATE provisioning_jobs SET provider_id=?,status="completed",result_json=?,last_error_code=NULL,last_error_message=NULL,completed_at=NOW(),locked_at=NULL,locked_by=NULL WHERE id=?')->execute([$pid,json_encode($result,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),(int)$j['id']]);$pdo->prepare('INSERT INTO service_events (user_service_id,service_instance_id,event_type,title,details_json) VALUES (?,? ,"provisioned","Service provisioned",?)')->execute([(int)$j['user_service_id'],$iid,json_encode(['order_id'=>(int)$order['id'],'provider_id'=>$pid,'map_id'=>(int)$m['id'],'routing_decision_id'=>$decisionId],JSON_UNESCAPED_SLASHES)]);$pdo->commit();bluegate_route_provider_success($pid);if($decisionId>0&&table_exists('routing_decisions'))db()->prepare('UPDATE routing_decisions SET selected_map_id=?,selected_provider_id=?,selected_target_id=? WHERE id=?')->execute([(int)$m['id'],$pid,(string)$m['remote_target_id'],$decisionId]);bluegate_record_route_attempt($decisionId,(int)$j['id'],$m,'success',null,(int)round((microtime(true)-$start)*1000));try{bluegate_finalize_initial_provisioning((int)$order['id'],(int)$j['user_service_id']);}catch(Throwable $fx){error_log('[BlueGate finalize delivery #'.(int)$order['id'].'] '.$fx->getMessage());}return$result;}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw$e;}
}
function bluegate_run_provisioning_job(int $jobId): array {
    $claim=bluegate_claim_job($jobId);$j=$claim['job'];if(!empty($claim['completed']))return bluegate_json_array($j['result_json']);$req=bluegate_json_array($j['request_json']??null);$order=order_by_id((int)($req['order_id']??0));if(!$order)throw new RuntimeException('ORDER_NOT_FOUND');$planId=(int)($req['service_plan_id']??0);$q=db()->prepare('SELECT sp.*,sg.name group_name,s.name service_name FROM service_plans sp JOIN service_groups sg ON sg.id=sp.group_id JOIN services s ON s.id=sg.service_id WHERE sp.id=?');$q->execute([$planId]);$plan=$q->fetch();if(!$plan)throw new RuntimeException('SERVICE_PLAN_NOT_FOUND');
    $maps=[];$decisionId=0;try{if(!empty($req['map_id'])){$all=bluegate_plan_provider_maps($planId);$maps=array_values(array_filter($all,fn($x)=>(int)$x['id']===(int)$req['map_id']));if(!$maps)throw new RuntimeException('PLAN_PROVIDER_MAP_NOT_FOUND');$decision=['strategy'=>'fixed','candidate_count'=>1,'candidates'=>[['map_id'=>(int)$maps[0]['id'],'provider_id'=>(int)$maps[0]['provider_id']]]];}else{$route=bluegate_route_order($order,$plan,$req['candidate_map_ids']??null);$maps=$route['ordered'];$decision=$route['decision'];}$decisionId=bluegate_record_route_decision($order,$plan,(int)$j['user_service_id'],$jobId,$decision);$errors=[];foreach($maps as $m){try{return bluegate_create_on_route($j,$req,$order,$plan,$m,$decisionId);}catch(Throwable $e){if(str_starts_with($e->getMessage(),'ROUTE_AMBIGUOUS_RETRY_REQUIRED:'))throw$e;$errors[]=['map_id'=>(int)$m['id'],'provider_id'=>(int)$m['provider_id'],'error'=>$e->getMessage()];continue;}throw new RuntimeException('ALL_ROUTES_FAILED:'.json_encode($errors,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));}
    }catch(Throwable $e){$attempt=(int)$j['attempt_count'];$max=(int)$j['max_attempts'];$final=$attempt>=$max;$delay=max(1,(int)min(900,30*(2**max(0,$attempt-1))));db()->prepare('UPDATE provisioning_jobs SET status=?,available_at=DATE_ADD(NOW(),INTERVAL '.$delay.' SECOND),last_error_code=?,last_error_message=?,locked_at=NULL,locked_by=NULL WHERE id=?')->execute([$final?'failed':'retry',substr(preg_replace('/:.*/','',$e->getMessage()),0,128),mb_substr($e->getMessage(),0,1000),$jobId]);if($final){db()->prepare('UPDATE user_services SET status="provisioning_failed" WHERE id=?')->execute([(int)$j['user_service_id']]);add_order_event((int)$order['id'],'preparing','ساخت خودکار سرویس نیاز به بررسی دارد','تمام مسیرهای Routing ناموفق بودند؛ سفارش تحویل‌نشده باقی ماند.',false);}throw$e;}
}
function bluegate_run_job(int $id): array {$q=db()->prepare('SELECT job_type FROM provisioning_jobs WHERE id=?');$q->execute([$id]);$t=(string)($q->fetchColumn()?:'create');return in_array($t,['renew','add_traffic','add_days'],true)?bluegate_run_service_action_job($id):bluegate_run_provisioning_job($id);}
function bluegate_run_due_provisioning_jobs(int $limit=20): array {$limit=max(1,min(100,$limit));$rows=db()->query("SELECT id FROM provisioning_jobs WHERE status IN ('queued','retry') AND available_at<=NOW() ORDER BY available_at,id LIMIT ".$limit)->fetchAll(PDO::FETCH_COLUMN)?:[];$ok=0;$failed=0;foreach($rows as$id){try{bluegate_run_job((int)$id);$ok++;}catch(Throwable $e){$failed++;}}return ['processed'=>count($rows),'completed'=>$ok,'failed'=>$failed];}
function bluegate_after_order_paid(int $orderId): void {try{if(function_exists('bluegate_after_order_paid_phase4')&&bluegate_after_order_paid_phase4($orderId))return;bluegate_queue_order_provisioning($orderId,true);}catch(Throwable $e){error_log('[BlueGate paid-order hook #'.$orderId.'] '.$e->getMessage());}}
function bluegate_provisioning_jobs(int $limit=50): array {$limit=max(1,min(200,$limit));return db()->query('SELECT j.*,p.name provider_name,us.order_id,us.display_name FROM provisioning_jobs j LEFT JOIN service_providers p ON p.id=j.provider_id LEFT JOIN user_services us ON us.id=j.user_service_id ORDER BY j.id DESC LIMIT '.$limit)->fetchAll()?:[];}
function bluegate_retry_provisioning_job(int $id,bool $runNow=true): array {db()->prepare('UPDATE provisioning_jobs SET status="queued",attempt_count=0,available_at=NOW(),last_error_code=NULL,last_error_message=NULL,locked_at=NULL,locked_by=NULL WHERE id=? AND status<>"completed"')->execute([$id]);return $runNow?bluegate_run_job($id):['queued'=>true];}
function bluegate_admin_provision_order_now(int $orderId): array {
    $order=order_by_id($orderId);if(!$order)throw new RuntimeException('ORDER_NOT_FOUND');
    if(!in_array(normalize_order_status((string)$order['status']),['payment_confirmed','preparing','delivered'],true))throw new RuntimeException('ORDER_NOT_PAID');
    if(!empty($order['service_action'])&&in_array((string)$order['service_action'],['renew','add_traffic','add_days'],true)) return bluegate_queue_service_action($orderId,true);
    $plan=bluegate_order_auto_plan($order);if(!$plan)throw new RuntimeException('NO_AUTOMATED_MAPPING');
    $existing=db()->prepare('SELECT j.id,j.status,j.attempt_count,j.max_attempts FROM provisioning_jobs j JOIN user_services us ON us.id=j.user_service_id WHERE us.order_id=? AND j.job_type="create" ORDER BY j.id');$existing->execute([$orderId]);
    foreach($existing->fetchAll()?:[] as $j){if(in_array((string)$j['status'],['failed','retry'],true)||(int)$j['attempt_count']>=(int)$j['max_attempts'])db()->prepare('UPDATE provisioning_jobs SET status="queued",attempt_count=0,available_at=NOW(),last_error_code=NULL,last_error_message=NULL,locked_at=NULL,locked_by=NULL WHERE id=? AND status<>"completed"')->execute([(int)$j['id']]);}
    $r=bluegate_queue_order_provisioning($orderId,true);if(empty($r['eligible']))throw new RuntimeException((string)($r['reason']??'PROVISIONING_NOT_ELIGIBLE'));
    $sid=(int)($r['user_service_id']??0);if($sid>0)bluegate_finalize_initial_provisioning($orderId,$sid);
    $fresh=order_by_id($orderId);if($fresh&&normalize_order_status((string)$fresh['status'])==='delivered'&&!empty($fresh['delivery_url']))return ['ok'=>true,'state'=>'delivered','order'=>$fresh,'result'=>$r];
    $q=db()->prepare('SELECT status,last_error_code,last_error_message,attempt_count,max_attempts FROM provisioning_jobs WHERE user_service_id=? AND job_type="create" ORDER BY id');$q->execute([$sid]);$jobs=$q->fetchAll()?:[];
    $failed=array_values(array_filter($jobs,fn($j)=>(string)$j['status']==='failed'));
    if($failed){$last=end($failed);throw new RuntimeException('PROVISIONING_FAILED: '.trim((string)($last['last_error_message']?:$last['last_error_code']?:'UNKNOWN')));}
    return ['ok'=>true,'state'=>'queued','order'=>$fresh,'result'=>$r,'jobs'=>$jobs];
}

/* ---------------- Phase 4: My Services + Renewal + Add-ons ---------------- */
function bluegate_service_by_order(int $orderId, ?int $userId=null): ?array {
    if(!table_exists('user_services')) return null;
    $sql='SELECT * FROM user_services WHERE order_id=?';$params=[$orderId];if($userId!==null){$sql.=' AND user_id=?';$params[]=$userId;}$sql.=' LIMIT 1';$q=db()->prepare($sql);$q->execute($params);$r=$q->fetch();return $r?:null;
}
function bluegate_service_record(int $serviceId,int $userId=0): ?array {
    $sql='SELECT us.*,sp.title plan_title,sp.duration_days,sp.extra_traffic_price_per_gb,sp.extra_day_price,sp.addon_min_gb,sp.addon_max_gb,sp.addon_min_days,sp.addon_max_days,sg.name group_name,s.name service_name FROM user_services us LEFT JOIN service_plans sp ON sp.id=us.service_plan_id LEFT JOIN service_groups sg ON sg.id=sp.group_id LEFT JOIN services s ON s.id=sg.service_id WHERE us.id=?';$args=[$serviceId];if($userId>0){$sql.=' AND us.user_id=?';$args[]=$userId;}$q=db()->prepare($sql);$q->execute($args);$r=$q->fetch();return $r?:null;
}
function bluegate_service_instances(int $serviceId): array {
    if(!table_exists('service_instances'))return [];$q=db()->prepare('SELECT si.*,sp.name provider_name,sp.driver FROM service_instances si JOIN service_providers sp ON sp.id=si.provider_id WHERE si.user_service_id=? ORDER BY si.id');$q->execute([$serviceId]);$rows=$q->fetchAll()?:[];foreach($rows as &$r)$r['metadata']=bluegate_json_array($r['metadata_json']??null);return $rows;
}
function bluegate_service_aggregate_url(array $service): ?string {
    $token=trim((string)($service['subscription_token']??''));if($token==='')return null;$base=function_exists('public_base_url')?trim((string)public_base_url()):trim((string)app_config('PUBLIC_BASE_URL',''));if($base===''){$mini=trim((string)app_config('MINIAPP_URL',''));if($mini!==''&&preg_match('#^https?://#i',$mini)){$parts=parse_url($mini);if(is_array($parts)&&!empty($parts['scheme'])&&!empty($parts['host']))$base=$parts['scheme'].'://'.$parts['host'].(isset($parts['port'])?':'.$parts['port']:'');}}if($base==='')return '/service.php?sub='.rawurlencode($token);return rtrim($base,'/').'/service.php?sub='.rawurlencode($token);
}
function bluegate_service_subscription_payload(string $token): array {
    $q=db()->prepare('SELECT * FROM user_services WHERE subscription_token=? LIMIT 1');$q->execute([$token]);$s=$q->fetch();if(!$s||!in_array((string)$s['status'],['active','degraded','suspended'],true))throw new RuntimeException('SUBSCRIPTION_NOT_FOUND');$instances=bluegate_service_instances((int)$s['id']);$urls=[];$links=[];
    foreach($instances as $i){if(!in_array((string)$i['status'],['active','degraded','suspended'],true))continue;$meta=bluegate_json_array($i['metadata_json']??null);foreach(($meta['links']??[]) as $ln)if(is_string($ln)&&trim($ln)!=='')$links[]=trim($ln);if(!empty($i['subscription_url']))$urls[]=(string)$i['subscription_url'];}
    return ['service'=>$s,'urls'=>array_values(array_unique($urls)),'links'=>array_values(array_unique($links))];
}
function bluegate_service_addon_settings(): array {
    return [
        'traffic_price_per_gb'=>max(0,setting_int('service_addon_traffic_price_per_gb',0)),
        'day_price'=>max(0,setting_int('service_addon_day_price',0)),
        'min_gb'=>max(1,setting_int('service_addon_min_gb',1)),
        'max_gb'=>max(1,setting_int('service_addon_max_gb',500)),
        'min_days'=>max(1,setting_int('service_addon_min_days',1)),
        'max_days'=>max(1,setting_int('service_addon_max_days',365)),
    ];
}
function bluegate_save_service_addon_settings(array $in): array {
    $cfg=[
        'traffic_price_per_gb'=>max(0,(int)($in['traffic_price_per_gb']??$in['extra_traffic_price_per_gb']??0)),
        'day_price'=>max(0,(int)($in['day_price']??$in['extra_day_price']??0)),
        'min_gb'=>max(1,(int)($in['min_gb']??$in['addon_min_gb']??1)),
        'max_gb'=>max(1,(int)($in['max_gb']??$in['addon_max_gb']??500)),
        'min_days'=>max(1,(int)($in['min_days']??$in['addon_min_days']??1)),
        'max_days'=>max(1,(int)($in['max_days']??$in['addon_max_days']??365)),
    ];
    if($cfg['max_gb']<$cfg['min_gb'])$cfg['max_gb']=$cfg['min_gb'];
    if($cfg['max_days']<$cfg['min_days'])$cfg['max_days']=$cfg['min_days'];
    set_setting('service_addon_traffic_price_per_gb',(string)$cfg['traffic_price_per_gb']);
    set_setting('service_addon_day_price',(string)$cfg['day_price']);
    set_setting('service_addon_min_gb',(string)$cfg['min_gb']);
    set_setting('service_addon_max_gb',(string)$cfg['max_gb']);
    set_setting('service_addon_min_days',(string)$cfg['min_days']);
    set_setting('service_addon_max_days',(string)$cfg['max_days']);
    return $cfg;
}
function bluegate_service_public(array $s,bool $withEvents=false): array {
    $instances=bluegate_service_instances((int)$s['id']);foreach($instances as &$ix){
        $ix['targets']=bluegate_instance_targets((int)$ix['id']);$ix['inbound_ids']=bluegate_instance_inbound_ids($ix);
        $needNames=false;foreach(($ix['targets']??[]) as $t)if(trim((string)($t['remote_target_name']??''))===''){$needNames=true;break;}
        if($needNames&&$ix['inbound_ids']){ $names=bluegate_provider_target_names((int)$ix['provider_id'],$ix['inbound_ids']); if($names){bluegate_sync_instance_targets((int)$ix['id'],$ix['inbound_ids'],$names);$ix['targets']=bluegate_instance_targets((int)$ix['id']);} }
        $stored=trim((string)($ix['subscription_url']??''));
        if($stored!==''&&preg_match('#^(vless|vmess|trojan|ss|wireguard|wg|hysteria2?|hy2|tuic)://#i',$stored)){
            try{$driver=bluegate_provider_driver((int)$ix['provider_id']);$meta=bluegate_json_array($ix['metadata_json']??null);$sub=$driver->getSubscription((string)($ix['external_username']?:$ix['external_client_id']),['sub_id'=>$meta['sub_id']??'']);$fresh=trim((string)($sub['url']??''));if($fresh!==''&&!preg_match('#^(vless|vmess|trojan|ss|wireguard|wg|hysteria2?|hy2|tuic)://#i',$fresh)){db()->prepare('UPDATE service_instances SET subscription_url=? WHERE id=?')->execute([$fresh,(int)$ix['id']]);$ix['subscription_url']=$fresh;}}catch(Throwable $ignore){}
        }
    }unset($ix);$urls=[];foreach($instances as $i){$u=trim((string)($i['subscription_url']??''));if($u!==''&&!preg_match('#^(vless|vmess|trojan|ss|wireguard|wg|hysteria2?|hy2|tuic)://#i',$u))$urls[]=$u;}$urls=array_values(array_unique($urls));$nativeSingleUrl=count($urls)===1;$aggregateUrl=count($urls)>1?bluegate_service_aggregate_url($s):null;$primaryUrl=$nativeSingleUrl?($urls[0]??null):($aggregateUrl?:($urls[0]??null));
    $limit=(int)($s['traffic_limit_bytes']??0);$used=(int)($s['traffic_used_bytes']??0);$remaining=$limit>0?max(0,$limit-$used):null;
    $out=['id'=>(int)$s['id'],'order_id'=>$s['order_id']!==null?(int)$s['order_id']:null,'service_plan_id'=>$s['service_plan_id']!==null?(int)$s['service_plan_id']:null,'display_name'=>$s['display_name']?:trim(($s['service_name']??'').' '.($s['group_name']??'').' '.($s['plan_title']??'')),'status'=>(string)$s['status'],'traffic_limit_bytes'=>$limit,'traffic_used_bytes'=>$used,'remaining_bytes'=>$remaining,'started_at'=>$s['started_at'],'expires_at'=>$s['expires_at'],'last_sync_at'=>$s['last_sync_at'],'subscription_url'=>$primaryUrl,'subscription_urls'=>$urls,'subscription_mode'=>$nativeSingleUrl?'native':(count($urls)>1?'bluegate_aggregate':'none'),'qr_text'=>$primaryUrl,'service_card_url'=>((function_exists('public_base_url')?rtrim((string)public_base_url(),'/'):'').'/service_card.php?token='.rawurlencode((string)($s['subscription_token']??''))),'instances'=>array_map(fn($i)=>['id'=>(int)$i['id'],'provider_id'=>(int)$i['provider_id'],'provider_name'=>$i['provider_name'],'driver'=>$i['driver'],'external_username'=>$i['external_username'],'remote_target_id'=>$i['remote_target_id'],'inbound_ids'=>$i['inbound_ids']??[],'targets'=>array_map(fn($x)=>['id'=>(int)$x['id'],'remote_target_id'=>$x['remote_target_id'],'remote_target_name'=>$x['remote_target_name'],'status'=>$x['status']],$i['targets']??[]),'status'=>$i['status'],'subscription_url'=>$i['subscription_url'],'traffic_limit_bytes'=>(int)($i['traffic_limit_bytes']??0),'traffic_used_bytes'=>(int)($i['traffic_used_bytes']??0),'expires_at'=>$i['expires_at'],'last_sync_at'=>$i['last_sync_at']],$instances),'renewable'=>true,'addons'=>bluegate_service_addon_settings()];
    if($withEvents){$q=db()->prepare('SELECT event_type,title,details_json,created_at FROM service_events WHERE user_service_id=? ORDER BY id DESC LIMIT 30');$q->execute([(int)$s['id']]);$out['events']=$q->fetchAll()?:[];if(table_exists('service_usage_snapshots')){$q=db()->prepare('SELECT traffic_used_bytes,traffic_limit_bytes,remaining_bytes,expires_at,status,created_at FROM service_usage_snapshots WHERE user_service_id=? ORDER BY id DESC LIMIT 48');$q->execute([(int)$s['id']]);$out['usage_history']=$q->fetchAll()?:[];}}
    return $out;
}
function bluegate_user_services(int $userId,int $limit=50): array {
    if(!table_exists('user_services'))return [];$limit=max(1,min(100,$limit));$q=db()->prepare('SELECT us.*,sp.title plan_title,sp.duration_days,sp.extra_traffic_price_per_gb,sp.extra_day_price,sp.addon_min_gb,sp.addon_max_gb,sp.addon_min_days,sp.addon_max_days,sg.name group_name,s.name service_name FROM user_services us LEFT JOIN service_plans sp ON sp.id=us.service_plan_id LEFT JOIN service_groups sg ON sg.id=sp.group_id LEFT JOIN services s ON s.id=sg.service_id WHERE us.user_id=? ORDER BY us.id DESC LIMIT '.$limit);$q->execute([$userId]);return array_map(fn($r)=>bluegate_service_public($r),$q->fetchAll()?:[]);
}
function bluegate_sync_service(int $serviceId,bool $recordSnapshot=true): array {
    $s=bluegate_service_record($serviceId);if(!$s)throw new RuntimeException('SERVICE_NOT_FOUND');$instances=bluegate_service_instances($serviceId);if(!$instances)throw new RuntimeException('SERVICE_INSTANCE_NOT_FOUND');$sumUsed=0;$sumLimit=0;$latestExpiry=null;$active=0;$expired=0;$syncErrors=0;
    foreach($instances as $i){try{
        $u=bluegate_provider_usage((int)$i['provider_id'],(string)($i['external_username']?:$i['external_client_id']));
        $used=max(0,(int)($u['used_bytes']??0));
        $limit=max(0,(int)($u['traffic_limit_bytes']??$u['total_bytes']??$i['traffic_limit_bytes']??0));
        $expiry=null;$expiryMs=(int)($u['expiry_ms']??0);if($expiryMs>0)$expiry=date('Y-m-d H:i:s',(int)floor($expiryMs/1000));elseif(!empty($u['expires_at'])){$ts=strtotime((string)$u['expires_at']);if($ts>0)$expiry=date('Y-m-d H:i:s',$ts);}if(!$expiry)$expiry=$i['expires_at']??null;
        $rawStatus=strtolower(trim((string)($u['status']??'')));
        if(array_key_exists('enable',$u))$st=!empty($u['enable'])?'active':'suspended';
        elseif(in_array($rawStatus,['active','enabled','online'],true))$st='active';
        elseif(in_array($rawStatus,['expired'],true))$st='expired';
        elseif(in_array($rawStatus,['disabled','suspended','limited','blocked'],true))$st='suspended';
        else $st=(string)($i['status']??'active');
        if($expiry&&strtotime($expiry)<time())$st='expired';
        $subUrl=(string)($i['subscription_url']??'');
        try{$driver=bluegate_provider_driver((int)$i['provider_id']);$meta=bluegate_json_array($i['metadata_json']??null);$sub=$driver->getSubscription((string)($i['external_username']?:$i['external_client_id']),['sub_id'=>$meta['sub_id']??'']);$freshSub=trim((string)($sub['url']??''));if($freshSub!=='')$subUrl=$freshSub;}catch(Throwable $ignore){}
        $targetIds=bluegate_instance_inbound_ids($i);$targetNames=bluegate_provider_target_names((int)$i['provider_id'],$targetIds);if($targetIds)bluegate_sync_instance_targets((int)$i['id'],$targetIds,$targetNames);
        db()->prepare('UPDATE service_instances SET traffic_used_bytes=?,traffic_limit_bytes=?,expires_at=?,status=?,subscription_url=?,last_sync_at=NOW() WHERE id=?')->execute([$used,$limit,$expiry,$st,$subUrl?:null,(int)$i['id']]);
        if($recordSnapshot&&table_exists('service_usage_snapshots'))db()->prepare('INSERT INTO service_usage_snapshots (user_service_id,service_instance_id,traffic_used_bytes,traffic_limit_bytes,remaining_bytes,expires_at,status,raw_json) VALUES (?,?,?,?,?,?,?,?)')->execute([$serviceId,(int)$i['id'],$used,$limit,$limit>0?max(0,$limit-$used):null,$expiry,$st,json_encode($u,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
        $sumUsed+=$used;$sumLimit+=$limit;if($expiry&&(!$latestExpiry||strtotime($expiry)>strtotime($latestExpiry)))$latestExpiry=$expiry;if($st==='active')$active++;if($st==='expired')$expired++;
    }catch(Throwable $e){$syncErrors++;db()->prepare('UPDATE service_instances SET status="degraded",last_sync_at=NOW() WHERE id=?')->execute([(int)$i['id']]);}}
    $status=$syncErrors>0?'degraded':($active>0?'active':($expired===count($instances)?'expired':'suspended'));if($latestExpiry&&strtotime($latestExpiry)<time())$status='expired';db()->prepare('UPDATE user_services SET traffic_used_bytes=?,traffic_limit_bytes=?,expires_at=COALESCE(?,expires_at),status=?,last_sync_at=NOW() WHERE id=?')->execute([$sumUsed,$sumLimit,$latestExpiry,$status,$serviceId]);$fresh=bluegate_service_record($serviceId);return bluegate_service_public($fresh?:$s,true);
}
function bluegate_service_action_order(int $userId,int $serviceId,string $action,int $quantity=0): array {
    $s=bluegate_service_record($serviceId,$userId);if(!$s)throw new RuntimeException('SERVICE_NOT_FOUND');if(!in_array($action,['add_traffic','add_days'],true))throw new RuntimeException('INVALID_SERVICE_ACTION');$baseOrder=$s['order_id']?order_by_id((int)$s['order_id']):null;if(!$baseOrder)throw new RuntimeException('SERVICE_ORDER_NOT_FOUND');
    $addon=bluegate_service_addon_settings();$min=$action==='add_traffic'?(int)$addon['min_gb']:(int)$addon['min_days'];$max=$action==='add_traffic'?(int)$addon['max_gb']:(int)$addon['max_days'];$price=$action==='add_traffic'?(int)$addon['traffic_price_per_gb']:(int)$addon['day_price'];if($price<=0)throw new RuntimeException('SERVICE_ADDON_DISABLED');$quantity=max($min,min($max,$quantity));if($quantity<=0)throw new RuntimeException('INVALID_QUANTITY');
    $o=create_storefront_order($userId,(int)$baseOrder['product_id'],!empty($baseOrder['variant_id'])?(int)$baseOrder['variant_id']:null,null);$amount=$price*$quantity;$payload=$action==='add_traffic'?['gb'=>$quantity,'bytes'=>$quantity*1073741824]:['days'=>$quantity];db()->prepare('UPDATE orders SET amount=?,discount_amount=0,wallet_amount=0,final_amount=?,is_renewal=1,renewal_of_order_id=?,user_service_id=?,service_action=?,service_action_json=? WHERE id=?')->execute([$amount,$amount,(int)$baseOrder['id'],$serviceId,$action,json_encode($payload,JSON_UNESCAPED_SLASHES),(int)$o['id']]);add_order_event((int)$o['id'],'pending_payment',$action==='add_traffic'?'خرید حجم اضافه':'خرید زمان اضافه',($action==='add_traffic'?$quantity.' GB':$quantity.' روز').' برای سرویس #'.$serviceId,true);return order_by_id((int)$o['id']);
}
function bluegate_queue_service_action(int $orderId,bool $runNow=true): array {
    $o=order_by_id($orderId);if(!$o)throw new RuntimeException('ORDER_NOT_FOUND');$sid=(int)($o['user_service_id']??0);$action=(string)($o['service_action']??'');if($sid<=0||!in_array($action,['renew','add_traffic','add_days'],true))return ['eligible'=>false,'reason'=>'NOT_SERVICE_ACTION'];$s=bluegate_service_record($sid,(int)$o['user_id']);if(!$s)throw new RuntimeException('SERVICE_NOT_FOUND');$payload=bluegate_json_array($o['service_action_json']??null);$ids=[];
    $instances=bluegate_service_instances($sid);if(!$instances)throw new RuntimeException('SERVICE_INSTANCE_NOT_FOUND');foreach($instances as $i){$key='service-action:'.$orderId.':instance:'.(int)$i['id'].':'.$action;$q=db()->prepare('SELECT id FROM provisioning_jobs WHERE idempotency_key=?');$q->execute([$key]);$jid=(int)($q->fetchColumn()?:0);if(!$jid){$req=['order_id'=>$orderId,'service_id'=>$sid,'instance_id'=>(int)$i['id'],'action'=>$action,'payload'=>$payload];$q=db()->prepare('INSERT INTO provisioning_jobs (idempotency_key,job_type,user_service_id,service_instance_id,provider_id,status,max_attempts,available_at,request_json) VALUES (?,?,?,?,?,"queued",3,NOW(),?)');$q->execute([$key,$action,$sid,(int)$i['id'],(int)$i['provider_id'],json_encode($req,JSON_UNESCAPED_SLASHES)]);$jid=(int)db()->lastInsertId();}$ids[]=$jid;}
    if($ids&&normalize_order_status((string)$o['status'])==='payment_confirmed')update_order_status($orderId,'preparing','در حال اعمال روی سرویس','BlueGate در حال بروزرسانی سرویس فعلی است.',true);if($runNow)foreach($ids as $jid){try{bluegate_run_service_action_job($jid);}catch(Throwable $e){error_log('[BlueGate service action #'.$jid.'] '.$e->getMessage());}}return ['eligible'=>true,'service_id'=>$sid,'jobs'=>$ids];
}
function bluegate_run_service_action_job(int $jobId): array {
    $pdo=db();$pdo->beginTransaction();try{$q=$pdo->prepare('SELECT * FROM provisioning_jobs WHERE id=? FOR UPDATE');$q->execute([$jobId]);$j=$q->fetch();if(!$j)throw new RuntimeException('JOB_NOT_FOUND');if($j['status']==='completed'){$pdo->commit();return bluegate_json_array($j['result_json']);}if($j['status']==='running')throw new RuntimeException('JOB_LOCKED');$attempt=(int)$j['attempt_count']+1;$pdo->prepare('UPDATE provisioning_jobs SET status="running",attempt_count=?,locked_at=NOW(),locked_by=? WHERE id=?')->execute([$attempt,gethostname()?:'php',$jobId]);$j['attempt_count']=$attempt;$pdo->commit();}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
    try{$req=bluegate_json_array($j['request_json']);$o=order_by_id((int)$req['order_id']);$s=bluegate_service_record((int)$j['user_service_id']);$q=db()->prepare('SELECT * FROM service_instances WHERE id=? AND user_service_id=?');$q->execute([(int)$j['service_instance_id'],(int)$j['user_service_id']]);$i=$q->fetch();if(!$o||!$s||!$i)throw new RuntimeException('SERVICE_ACTION_CONTEXT_MISSING');$action=(string)$req['action'];$pl=bluegate_json_array($req['payload']??[]);$currentLimit=max(0,(int)($i['traffic_limit_bytes']??0));$currentExp=!empty($i['expires_at'])?strtotime((string)$i['expires_at']):time();if($currentExp<time())$currentExp=time();$newLimit=$currentLimit;$newExp=$currentExp;
        if($action==='renew'){$days=max(1,(int)($s['duration_days']??30));$newExp=$currentExp+$days*86400;}elseif($action==='add_traffic'){$newLimit=$currentLimit+max(0,(int)($pl['bytes']??0));}elseif($action==='add_days'){$newExp=$currentExp+max(0,(int)($pl['days']??0))*86400;}else throw new RuntimeException('INVALID_SERVICE_ACTION');
        $driver=bluegate_provider_driver((int)$i['provider_id']);$instanceInboundIds=bluegate_instance_inbound_ids($i);$upd=['external_username'=>$i['external_username'],'email'=>$i['external_username'],'external_client_id'=>$i['external_client_id'],'id'=>$i['external_client_id'],'inbound_ids'=>$instanceInboundIds,'inbound_id'=>(string)($instanceInboundIds[0]??$i['remote_target_id']),'remote_target_id'=>$i['remote_target_id'],'provider_config'=>[],'traffic_limit_bytes'=>$newLimit,'expires_at'=>date('Y-m-d H:i:s',$newExp),'enable'=>true];$r=$driver->renewService($upd);db()->prepare('UPDATE service_instances SET traffic_limit_bytes=?,expires_at=?,status="active",last_sync_at=NOW() WHERE id=?')->execute([$newLimit,date('Y-m-d H:i:s',$newExp),(int)$i['id']]);$res=['ok'=>true,'action'=>$action,'traffic_limit_bytes'=>$newLimit,'expires_at'=>date('Y-m-d H:i:s',$newExp),'provider_result'=>$r];db()->prepare('UPDATE provisioning_jobs SET status="completed",result_json=?,completed_at=NOW(),locked_at=NULL,locked_by=NULL,last_error_code=NULL,last_error_message=NULL WHERE id=?')->execute([json_encode($res,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),$jobId]);db()->prepare('INSERT INTO service_events (user_service_id,service_instance_id,event_type,title,details_json) VALUES (?,?,?,?,?)')->execute([(int)$s['id'],(int)$i['id'],$action,$action==='renew'?'Service renewed':($action==='add_traffic'?'Traffic added':'Days added'),json_encode(['order_id'=>(int)$o['id'],'result'=>$res],JSON_UNESCAPED_SLASHES)]);
        $q=db()->prepare('SELECT COUNT(*) FROM provisioning_jobs WHERE request_json LIKE ? AND status<>"completed"');$q->execute(['%"order_id":'.(int)$o['id'].',%']);if((int)$q->fetchColumn()===0){bluegate_sync_service((int)$s['id'],false);$fresh=bluegate_service_record((int)$s['id']);$sub=bluegate_service_public($fresh?:$s);db()->prepare('UPDATE orders SET delivery_url=?,delivery_title=? WHERE id=?')->execute([$sub['subscription_url']??null,'مدیریت سرویس',(int)$o['id']]);update_order_status((int)$o['id'],'delivered','سرویس بروزرسانی شد',$action==='renew'?'تمدید روی همان سرویس اعمال شد.':'افزونه روی همان سرویس اعمال شد.',true);}return $res;
    }catch(Throwable $e){$attempt=(int)$j['attempt_count'];$max=(int)$j['max_attempts'];$final=$attempt>=$max;$delay=min(900,30*(2**max(0,$attempt-1)));$delay=max(1,(int)$delay);db()->prepare('UPDATE provisioning_jobs SET status=?,available_at=DATE_ADD(NOW(),INTERVAL '.$delay.' SECOND),last_error_code=?,last_error_message=?,locked_at=NULL,locked_by=NULL WHERE id=?')->execute([$final?'failed':'retry',substr($e->getMessage(),0,128),mb_substr($e->getMessage(),0,1000),$jobId]);if($final)db()->prepare('UPDATE user_services SET status="degraded" WHERE id=?')->execute([(int)$j['user_service_id']]);throw $e;}
}
function bluegate_after_order_paid_phase4(int $orderId): bool {$o=order_by_id($orderId);if(!$o)return false;if(!empty($o['user_service_id'])&&in_array((string)($o['service_action']??''),['renew','add_traffic','add_days'],true)){bluegate_queue_service_action($orderId,true);return true;}return false;}

/* ---------------- Phase 6: routing + failover dashboard ---------------- */
/* Phase 8 keeps Phase 7 multi-target behavior and extends target IDs to UUID/string provider targets. */
function bluegate_routing_dashboard(): array {
    $out=['settings'=>bluegate_routing_settings(),'providers'=>[],'recent_decisions'=>[],'recent_attempts'=>[],'stats'=>['open_circuits'=>0,'full_providers'=>0]];
    foreach(bluegate_providers(false) as $p){$cap=bluegate_provider_capacity((int)$p['id'],$p['max_clients']===null?null:(int)$p['max_clients']);$state=bluegate_provider_route_state((int)$p['id']);if(($state['circuit_state']??'closed')==='open'&&!empty($state['open_until'])&&strtotime((string)$state['open_until'])>time())$out['stats']['open_circuits']++;if($cap['max']!==null&&$cap['free']<=0)$out['stats']['full_providers']++;$out['providers'][]=['id'=>(int)$p['id'],'name'=>$p['name'],'health'=>$p['last_health_status']??$p['status'],'capacity'=>$cap,'route_state'=>$state];}
    if(table_exists('routing_decisions'))$out['recent_decisions']=db()->query('SELECT rd.*,sp.name selected_provider_name FROM routing_decisions rd LEFT JOIN service_providers sp ON sp.id=rd.selected_provider_id ORDER BY rd.id DESC LIMIT 30')->fetchAll()?:[];
    if(table_exists('routing_attempts'))$out['recent_attempts']=db()->query('SELECT ra.*,sp.name provider_name FROM routing_attempts ra LEFT JOIN service_providers sp ON sp.id=ra.provider_id ORDER BY ra.id DESC LIMIT 50')->fetchAll()?:[];return$out;
}

/* ---------------- Phase 5: monitoring + automation ---------------- */
function bluegate_monitoring_settings(): array {
    $d=['service_sync_enabled'=>1,'provider_health_enabled'=>1,'expire_suspend_enabled'=>1,'telegram_alerts_enabled'=>1,'usage_thresholds'=>'80,90,100','expiry_days'=>'3,1,0','provider_degraded_latency_ms'=>2000,'service_batch_size'=>100];
    if(!table_exists('monitoring_settings')) return $d;
    try{$r=db()->query('SELECT * FROM monitoring_settings WHERE id=1')->fetch();return $r?array_merge($d,$r):$d;}catch(Throwable $e){return $d;}
}
function bluegate_save_monitoring_settings(array $in): array {
    if(!table_exists('monitoring_settings')) throw new RuntimeException('MONITORING_SCHEMA_MISSING');
    $thresholds=array_values(array_unique(array_filter(array_map('intval',preg_split('/[^0-9]+/',(string)($in['usage_thresholds']??'80,90,100'))),fn($v)=>$v>=1&&$v<=100)));sort($thresholds);if(!$thresholds)$thresholds=[80,90,100];
    $days=array_values(array_unique(array_filter(array_map('intval',preg_split('/[^0-9]+/',(string)($in['expiry_days']??'3,1,0'))),fn($v)=>$v>=0&&$v<=365)));rsort($days);if(!$days)$days=[3,1,0];
    $q=db()->prepare('INSERT INTO monitoring_settings (id,service_sync_enabled,provider_health_enabled,expire_suspend_enabled,telegram_alerts_enabled,usage_thresholds,expiry_days,provider_degraded_latency_ms,service_batch_size) VALUES (1,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE service_sync_enabled=VALUES(service_sync_enabled),provider_health_enabled=VALUES(provider_health_enabled),expire_suspend_enabled=VALUES(expire_suspend_enabled),telegram_alerts_enabled=VALUES(telegram_alerts_enabled),usage_thresholds=VALUES(usage_thresholds),expiry_days=VALUES(expiry_days),provider_degraded_latency_ms=VALUES(provider_degraded_latency_ms),service_batch_size=VALUES(service_batch_size)');
    $q->execute([!empty($in['service_sync_enabled'])?1:0,!empty($in['provider_health_enabled'])?1:0,!empty($in['expire_suspend_enabled'])?1:0,!empty($in['telegram_alerts_enabled'])?1:0,implode(',',$thresholds),implode(',',$days),max(250,min(30000,(int)($in['provider_degraded_latency_ms']??2000))),max(10,min(1000,(int)($in['service_batch_size']??100)))]);return bluegate_monitoring_settings();
}
function bluegate_monitor_begin(string $type): int { if(!table_exists('monitoring_runs'))return 0;$q=db()->prepare('INSERT INTO monitoring_runs (run_type,status) VALUES (? ,"running")');$q->execute([$type]);return(int)db()->lastInsertId(); }
function bluegate_monitor_finish(int $id,array $s,array $details=[]): void { if($id<=0||!table_exists('monitoring_runs'))return;db()->prepare('UPDATE monitoring_runs SET status=?,scanned_count=?,success_count=?,warning_count=?,error_count=?,details_json=?,completed_at=NOW() WHERE id=?')->execute([($s['errors']??0)>0?'completed_with_errors':'completed',(int)($s['scanned']??0),(int)($s['success']??0),(int)($s['warnings']??0),(int)($s['errors']??0),json_encode($details,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),$id]); }
function bluegate_monitor_notify_user(int $userId,string $title,string $body,int $serviceId,string $key): void {
    notify_user_event($userId,'service',$title,$body,null,'service',(string)$serviceId);
    $cfg=bluegate_monitoring_settings();if(empty($cfg['telegram_alerts_enabled']))return;
    try{$u=get_user_by_id($userId);if($u&&!empty($u['telegram_id']))send_msg((int)$u['telegram_id'],"🔔 <b>".h($title)."</b>\n\n".h($body));}catch(Throwable $e){error_log('[BlueGate monitor notify] '.$e->getMessage());}
}
function bluegate_alert_once(int $serviceId,string $key,string $cycle,string $value,array $meta,callable $send): bool {
    if(!table_exists('service_alert_states')){$send();return true;}$q=db()->prepare('SELECT * FROM service_alert_states WHERE user_service_id=? AND alert_key=? LIMIT 1');$q->execute([$serviceId,$key]);$old=$q->fetch();if($old&&hash_equals((string)$old['cycle_key'],$cycle)&&empty($old['resolved_at']))return false;$send();
    db()->prepare('INSERT INTO service_alert_states (user_service_id,alert_key,cycle_key,last_value,sent_at,resolved_at,metadata_json) VALUES (?,?,?,?,NOW(),NULL,?) ON DUPLICATE KEY UPDATE cycle_key=VALUES(cycle_key),last_value=VALUES(last_value),sent_at=NOW(),resolved_at=NULL,metadata_json=VALUES(metadata_json)')->execute([$serviceId,$key,$cycle,$value,json_encode($meta,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);return true;
}
function bluegate_resolve_alert(int $serviceId,string $key): void {if(table_exists('service_alert_states'))db()->prepare('UPDATE service_alert_states SET resolved_at=NOW() WHERE user_service_id=? AND alert_key=? AND resolved_at IS NULL')->execute([$serviceId,$key]);}
function bluegate_monitor_service_alerts(array $svc): array {
    $out=['sent'=>0,'expired'=>false];$id=(int)$svc['id'];$uid=(int)$svc['user_id'];$name=trim((string)($svc['display_name']??''))?:('Service #'.$id);$limit=(int)($svc['traffic_limit_bytes']??0);$used=(int)($svc['traffic_used_bytes']??0);$cfg=bluegate_monitoring_settings();
    if($limit>0){$pct=min(100,(int)floor(($used/$limit)*100));$thresholds=array_values(array_unique(array_map('intval',explode(',',(string)$cfg['usage_thresholds']))));sort($thresholds);$hit=null;foreach($thresholds as $t){$k='usage_'.$t;if($pct<$t)bluegate_resolve_alert($id,$k);elseif($hit===null||$t>$hit)$hit=$t;}if($hit!==null){$k='usage_'.$hit;$cycle='limit:'.$limit;if(bluegate_alert_once($id,$k,$cycle,(string)$pct,['percent'=>$pct,'limit'=>$limit,'used'=>$used],function()use($uid,$name,$id,$hit,$pct){bluegate_monitor_notify_user($uid,'هشدار مصرف سرویس',"مصرف {$name} به {$pct}٪ رسیده است (آستانه {$hit}٪).",$id,'usage_'.$hit);}))$out['sent']++;}}
    $exp=$svc['expires_at']??null;if($exp){$seconds=strtotime((string)$exp)-time();$days=(int)ceil($seconds/86400);$cycle='exp:'.(string)$exp;if($seconds<=0){$out['expired']=true;$k='expired';if(bluegate_alert_once($id,$k,$cycle,'expired',['expires_at'=>$exp],function()use($uid,$name,$id){bluegate_monitor_notify_user($uid,'سرویس منقضی شد',"سرویس {$name} منقضی شده است.",$id,'expired');}))$out['sent']++;}else{$thresholds=array_values(array_unique(array_map('intval',explode(',',(string)$cfg['expiry_days']))));sort($thresholds);$hit=null;foreach($thresholds as $d){if($d>0&&$seconds<=($d*86400)){$hit=$d;break;}}if($hit!==null){$k='expiry_'.$hit;if(bluegate_alert_once($id,$k,$cycle,(string)$days,['expires_at'=>$exp,'days'=>$days],function()use($uid,$name,$id,$hit){bluegate_monitor_notify_user($uid,'یادآوری انقضای سرویس',"تا انقضای {$name} حدود {$hit} روز باقی مانده است.",$id,'expiry_'.$hit);}))$out['sent']++;}}
    }
    return $out;
}
function bluegate_suspend_expired_service(int $serviceId): array {
    $cfg=bluegate_monitoring_settings();if(empty($cfg['expire_suspend_enabled']))return ['suspended'=>0];$s=bluegate_service_record($serviceId);if(!$s||empty($s['expires_at'])||strtotime((string)$s['expires_at'])>time())return ['suspended'=>0];
    $q=db()->prepare("SELECT * FROM service_instances WHERE user_service_id=? AND status NOT IN ('deleted','expired')");$q->execute([$serviceId]);$n=0;$errors=[];foreach($q->fetchAll()?:[] as $i){try{$external=(string)($i['external_username']?:$i['external_client_id']);if($external==='')continue;bluegate_provider_driver((int)$i['provider_id'])->suspendService($external);db()->prepare('UPDATE service_instances SET status="expired" WHERE id=?')->execute([(int)$i['id']]);$n++;}catch(Throwable $e){$errors[]=['instance_id'=>(int)$i['id'],'error'=>$e->getMessage()];}}
    db()->prepare('UPDATE user_services SET status="expired" WHERE id=?')->execute([$serviceId]);if($n>0)db()->prepare('INSERT INTO service_events (user_service_id,event_type,title,details_json) VALUES (?,"expired_automated","Service expired automatically",?)')->execute([$serviceId,json_encode(['suspended_instances'=>$n,'errors'=>$errors],JSON_UNESCAPED_SLASHES)]);return ['suspended'=>$n,'errors'=>$errors];
}
function bluegate_run_service_monitor(int $limit=0): array {
    $cfg=bluegate_monitoring_settings();if(empty($cfg['service_sync_enabled']))return ['disabled'=>true,'scanned'=>0,'success'=>0,'warnings'=>0,'errors'=>0];$limit=$limit>0?$limit:(int)$cfg['service_batch_size'];$limit=max(1,min(1000,$limit));$rid=bluegate_monitor_begin('services');$s=['scanned'=>0,'success'=>0,'warnings'=>0,'errors'=>0,'alerts'=>0,'expired'=>0];$errs=[];
    $rows=db()->query("SELECT id FROM user_services WHERE status IN ('active','pending','degraded','suspended') ORDER BY COALESCE(last_sync_at,'2000-01-01') ASC,id ASC LIMIT ".$limit)->fetchAll(PDO::FETCH_COLUMN)?:[];
    foreach($rows as $sid){$s['scanned']++;try{$pub=bluegate_sync_service((int)$sid,true);$rec=bluegate_service_record((int)$sid);if(!$rec)throw new RuntimeException('SERVICE_NOT_FOUND_AFTER_SYNC');$a=bluegate_monitor_service_alerts($rec);$s['alerts']+=(int)$a['sent'];if(!empty($a['expired'])){$x=bluegate_suspend_expired_service((int)$sid);$s['expired']++;if(!empty($x['errors']))$s['warnings']++;}$s['success']++;}catch(Throwable $e){$s['errors']++;$errs[]=['service_id'=>(int)$sid,'error'=>$e->getMessage()];}}
    bluegate_monitor_finish($rid,$s,['alerts'=>$s['alerts'],'expired'=>$s['expired'],'errors'=>array_slice($errs,0,20)]);return $s+['run_id'=>$rid];
}
function bluegate_provider_health_sample_state(array $health,int $degradedMs): string {if(empty($health['ok']))return 'offline';return (int)($health['latency_ms']??0)>$degradedMs?'degraded':'online';}
function bluegate_provider_health_streak(int $providerId,int $degradedMs): array {
    $q=db()->prepare('SELECT health_status,latency_ms FROM provider_health_logs WHERE provider_id=? ORDER BY id DESC LIMIT 4');$q->execute([$providerId]);$rows=$q->fetchAll()?:[];$states=[];
    foreach($rows as $r){$raw=strtolower((string)($r['health_status']??''));$ok=in_array($raw,['online','healthy','ok'],true);$states[]=$ok?(((int)($r['latency_ms']??0)>$degradedMs)?'degraded':'online'):'offline';}
    $bad=0;$good=0;foreach($states as $st){if($st==='online'){if($bad===0)$good++;else break;}else{if($good===0)$bad++;else break;}}
    return ['states'=>$states,'bad_streak'=>$bad,'good_streak'=>$good];
}
function bluegate_provider_incident_update(array $provider,array $health,int $degradedMs): array {
    if(!table_exists('provider_incidents'))return ['changed'=>false];$pid=(int)$provider['id'];$lat=(int)($health['latency_ms']??0);$sample=bluegate_provider_health_sample_state($health,$degradedMs);$streak=bluegate_provider_health_streak($pid,$degradedMs);$prev=strtolower((string)($provider['last_health_status']??$provider['status']??'unknown'));
    $q=db()->prepare("SELECT * FROM provider_incidents WHERE provider_id=? AND status='open' ORDER BY id DESC LIMIT 1");$q->execute([$pid]);$open=$q->fetch();
    // Hysteresis: two consecutive bad checks before degraded/offline; two good checks before recovery.
    if($sample==='online'){$state=($streak['good_streak']>=2||!in_array($prev,['offline','degraded'],true))?'online':$prev;if($state==='online'&&$open&&$streak['good_streak']>=2){db()->prepare('UPDATE provider_incidents SET status="resolved",resolved_at=NOW(),last_seen_at=NOW() WHERE id=?')->execute([(int)$open['id']]);notify_admins("✅ <b>اتصال پنل پایدار شد</b>\n".h((string)$provider['name'])."\nLatency: <code>{$lat} ms</code>");db()->prepare('UPDATE service_providers SET last_health_status="online",status="online" WHERE id=?')->execute([$pid]);return ['changed'=>true,'state'=>'recovered','incident_id'=>(int)$open['id'],'streak'=>$streak];}db()->prepare('UPDATE service_providers SET last_health_status=?,status=? WHERE id=?')->execute([$state,$state,$pid]);return ['changed'=>false,'state'=>$state,'pending_recovery'=>$state!=='online','streak'=>$streak];}
    if($streak['bad_streak']<2){$state=in_array($prev,['online','healthy'],true)?'online':$prev;db()->prepare('UPDATE service_providers SET last_health_status=?,status=? WHERE id=?')->execute([$state,$state,$pid]);return ['changed'=>false,'state'=>$state,'pending_confirmation'=>true,'sample'=>$sample,'streak'=>$streak];}
    $state=$sample;$sev=$state==='offline'?'critical':'warning';$msg=mb_substr((string)($health['message']??$state),0,1000);db()->prepare('UPDATE service_providers SET last_health_status=?,status=? WHERE id=?')->execute([$state,$state,$pid]);
    if($open){db()->prepare('UPDATE provider_incidents SET severity=?,last_seen_at=NOW(),occurrence_count=occurrence_count+1,message=?,metadata_json=? WHERE id=?')->execute([$sev,$msg,json_encode(['health'=>$health,'streak'=>$streak],JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE),(int)$open['id']]);return ['changed'=>false,'state'=>$state,'incident_id'=>(int)$open['id'],'streak'=>$streak];}
    $q=db()->prepare('INSERT INTO provider_incidents (provider_id,severity,status,title,message,metadata_json) VALUES (?,?,"open",?,?,?)');$q->execute([$pid,$sev,'Provider '.$state,$msg,json_encode(['health'=>$health,'streak'=>$streak],JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE)]);$iid=(int)db()->lastInsertId();notify_admins(($state==='offline'?'🚨':'⚠️')." <b>وضعیت پنل {$state}</b>\n".h((string)$provider['name'])."\nدو بررسی متوالی مشکل را تایید کردند.".($lat?"\nLatency: <code>{$lat} ms</code>":''));return ['changed'=>true,'state'=>$state,'incident_id'=>$iid,'streak'=>$streak];
}
function bluegate_run_provider_monitor(): array {
    $cfg=bluegate_monitoring_settings();if(empty($cfg['provider_health_enabled']))return ['disabled'=>true,'scanned'=>0,'success'=>0,'warnings'=>0,'errors'=>0];$rid=bluegate_monitor_begin('providers');$s=['scanned'=>0,'success'=>0,'warnings'=>0,'errors'=>0,'incidents_changed'=>0];$details=[];
    foreach(bluegate_providers(true) as $p){$driverMeta=BlueGateProviderRegistry::supportedDrivers()[(string)$p['driver']]??[];if(empty($driverMeta['live']))continue;$s['scanned']++;try{$h=bluegate_test_provider((int)$p['id']);if(empty($h['ok'])){usleep(250000);$h=bluegate_test_provider((int)$p['id']);$h['retried']=true;}$i=bluegate_provider_incident_update($p,$h,(int)$cfg['provider_degraded_latency_ms']);if(!empty($i['changed']))$s['incidents_changed']++;if(!empty($h['ok'])&&(int)($h['latency_ms']??0)<=(int)$cfg['provider_degraded_latency_ms'])$s['success']++;else $s['warnings']++;$details[]=['provider_id'=>(int)$p['id'],'health'=>$h,'incident'=>$i];}catch(Throwable $e){$s['errors']++;$h=['ok'=>false,'status'=>'offline','message'=>$e->getMessage(),'latency_ms'=>null];$i=bluegate_provider_incident_update($p,$h,(int)$cfg['provider_degraded_latency_ms']);if(!empty($i['changed']))$s['incidents_changed']++;$details[]=['provider_id'=>(int)$p['id'],'error'=>$e->getMessage(),'incident'=>$i];}}
    bluegate_monitor_finish($rid,$s,['providers'=>$details]);return $s+['run_id'=>$rid];
}
function bluegate_run_monitoring(int $serviceLimit=0): array {return ['providers'=>bluegate_run_provider_monitor(),'services'=>bluegate_run_service_monitor($serviceLimit)];}
function bluegate_monitoring_dashboard(): array {
    $out=['settings'=>bluegate_monitoring_settings(),'open_incidents'=>[],'recent_runs'=>[],'recent_alerts'=>[],'stats'=>['open_incidents'=>0,'degraded_services'=>0,'expired_services'=>0]];
    if(table_exists('provider_incidents')){$out['open_incidents']=db()->query("SELECT i.*,p.name provider_name,p.driver FROM provider_incidents i JOIN service_providers p ON p.id=i.provider_id WHERE i.status='open' ORDER BY FIELD(i.severity,'critical','warning'),i.opened_at DESC LIMIT 50")->fetchAll()?:[];$out['stats']['open_incidents']=count($out['open_incidents']);}
    if(table_exists('monitoring_runs'))$out['recent_runs']=db()->query('SELECT * FROM monitoring_runs ORDER BY id DESC LIMIT 30')->fetchAll()?:[];
    if(table_exists('service_alert_states'))$out['recent_alerts']=db()->query('SELECT a.*,s.display_name,u.telegram_id FROM service_alert_states a JOIN user_services s ON s.id=a.user_service_id JOIN users u ON u.id=s.user_id ORDER BY a.sent_at DESC LIMIT 30')->fetchAll()?:[];
    if(table_exists('user_services')){$out['stats']['degraded_services']=(int)db()->query("SELECT COUNT(*) FROM user_services WHERE status='degraded'")->fetchColumn();$out['stats']['expired_services']=(int)db()->query("SELECT COUNT(*) FROM user_services WHERE status='expired'")->fetchColumn();}
    return $out;
}

/* Phase 10 advanced feature module */
require_once __DIR__.'/advanced_features.php';
