<?php
/**
 * BlueGate 3x-ui provider (Phase 2).
 * Supports modern Bearer-token API and legacy username/password session API.
 */
final class BlueGateXuiProvider extends BlueGateAbstractProvider {
    private array $meta;
    private ?string $token = null;
    private ?string $secret = null;
    private ?string $cookieFile = null;

    public function __construct(array $provider) {
        parent::__construct($provider);
        $m = json_decode((string)($provider['metadata_json'] ?? '{}'), true);
        $this->meta = is_array($m) ? $m : [];
        if (!empty($provider['api_token_encrypted'])) $this->token = bluegate_decrypt_secret((string)$provider['api_token_encrypted']);
        if (!empty($provider['secret_encrypted'])) $this->secret = bluegate_decrypt_secret((string)$provider['secret_encrypted']);
    }

    public function __destruct() {
        if ($this->cookieFile && is_file($this->cookieFile)) @unlink($this->cookieFile);
    }

    public function driver(): string { return 'xui'; }

    private function base(): string {
        $base = rtrim(trim((string)($this->provider['base_url'] ?? '')), '/');
        if ($base === '' || !preg_match('#^https?://#i', $base)) throw new RuntimeException('XUI_BASE_URL_REQUIRED');
        return $base;
    }

    private function mode(): string {
        $auth = strtolower(trim((string)($this->provider['auth_type'] ?? '')));
        if (in_array($auth, ['token','bearer'], true) && $this->token) return 'token';
        if (in_array($auth, ['basic','legacy','password'], true) && !empty($this->provider['username']) && $this->secret) return 'legacy';
        if ($this->token) return 'token';
        if (!empty($this->provider['username']) && $this->secret) return 'legacy';
        throw new RuntimeException('XUI_CREDENTIALS_REQUIRED');
    }

    private function cookieFile(): string {
        if ($this->cookieFile) return $this->cookieFile;
        $this->cookieFile = tempnam(sys_get_temp_dir(), 'bluegate_xui_');
        if (!$this->cookieFile) throw new RuntimeException('XUI_COOKIE_INIT_FAILED');
        @chmod($this->cookieFile, 0600);
        return $this->cookieFile;
    }

    private function request(string $method, string $path, ?array $json=null, bool $loginIfNeeded=true, bool $form=false): array {
        if (!function_exists('curl_init')) throw new RuntimeException('PHP_CURL_REQUIRED');
        $mode = $this->mode();
        if ($mode === 'legacy' && $loginIfNeeded) $this->loginLegacy();
        $url = $this->base() . '/' . ltrim($path, '/');
        $ch = curl_init($url);
        $headers = ['Accept: application/json', 'X-Requested-With: XMLHttpRequest'];
        if ($mode === 'token') $headers[] = 'Authorization: Bearer ' . $this->token;
        $payload = null;
        if ($json !== null) {
            if ($form) {
                $payload = http_build_query($json, '', '&', PHP_QUERY_RFC3986);
                $headers[] = 'Content-Type: application/x-www-form-urlencoded';
            } else {
                $payload = json_encode($json, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
                if ($payload === false) throw new RuntimeException('XUI_JSON_ENCODE_FAILED');
                $headers[] = 'Content-Type: application/json';
            }
        }
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER=>true,
            CURLOPT_HEADER=>true,
            CURLOPT_CUSTOMREQUEST=>strtoupper($method),
            CURLOPT_CONNECTTIMEOUT=>max(2,(int)($this->meta['connect_timeout'] ?? 5)),
            CURLOPT_TIMEOUT=>max(4,(int)($this->meta['request_timeout'] ?? 12)),
            CURLOPT_FOLLOWLOCATION=>false,
            CURLOPT_MAXREDIRS=>0,
            CURLOPT_HTTPHEADER=>$headers,
            CURLOPT_SSL_VERIFYPEER=>!array_key_exists('verify_tls',$this->meta) || (bool)$this->meta['verify_tls'],
            CURLOPT_SSL_VERIFYHOST=>(!array_key_exists('verify_tls',$this->meta) || (bool)$this->meta['verify_tls']) ? 2 : 0,
        ]);
        if ($mode === 'legacy') {
            curl_setopt($ch, CURLOPT_COOKIEFILE, $this->cookieFile());
            curl_setopt($ch, CURLOPT_COOKIEJAR, $this->cookieFile());
        }
        if ($payload !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        $start = microtime(true);
        $raw = curl_exec($ch);
        $elapsed = (int)round((microtime(true)-$start)*1000);
        if ($raw === false) {
            $err = curl_error($ch); curl_close($ch);
            throw new RuntimeException('XUI_HTTP_ERROR:'.preg_replace('/\s+/',' ',(string)$err));
        }
        $status=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);
        $headerSize=(int)curl_getinfo($ch,CURLINFO_HEADER_SIZE);
        $body=substr((string)$raw,$headerSize);
        curl_close($ch);
        $decoded=json_decode($body,true);
        $okHttp=$status>=200&&$status<300;
        $success=is_array($decoded)&&array_key_exists('success',$decoded)?(bool)$decoded['success']:$okHttp;
        $message=is_array($decoded)?(string)($decoded['msg']??$decoded['message']??''):' ';
        $result=['ok'=>$okHttp&&$success,'http_status'=>$status,'latency_ms'=>$elapsed,'body'=>$decoded,'raw_body'=>is_array($decoded)?null:mb_substr($body,0,2000),'message'=>trim($message)];
        if (!$result['ok']) {
            $code='XUI_API_FAILED';
            if (in_array($status,[401,403],true)) $code='XUI_AUTH_FAILED';
            elseif ($status===404) $code='XUI_ENDPOINT_NOT_FOUND';
            $result['error_code']=$code;
        }
        return $result;
    }

    private function loginLegacy(): void {
        $file=$this->cookieFile();
        if (is_file($file) && filesize($file)>0 && (time()-filemtime($file))<600) return;
        if (!function_exists('curl_init')) throw new RuntimeException('PHP_CURL_REQUIRED');
        $url=$this->base().'/login';
        $ch=curl_init($url);
        curl_setopt_array($ch,[
            CURLOPT_RETURNTRANSFER=>true,
            CURLOPT_HEADER=>true,
            CURLOPT_POST=>true,
            CURLOPT_POSTFIELDS=>http_build_query(['username'=>(string)$this->provider['username'],'password'=>(string)$this->secret],'','&',PHP_QUERY_RFC3986),
            CURLOPT_COOKIEJAR=>$file,
            CURLOPT_COOKIEFILE=>$file,
            CURLOPT_HTTPHEADER=>['Accept: application/json','Content-Type: application/x-www-form-urlencoded'],
            CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>10,CURLOPT_FOLLOWLOCATION=>false,
            CURLOPT_SSL_VERIFYPEER=>!array_key_exists('verify_tls',$this->meta)||(bool)$this->meta['verify_tls'],
            CURLOPT_SSL_VERIFYHOST=>(!array_key_exists('verify_tls',$this->meta)||(bool)$this->meta['verify_tls'])?2:0,
        ]);
        $raw=curl_exec($ch);$status=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);
        if($raw===false){$e=curl_error($ch);curl_close($ch);throw new RuntimeException('XUI_LOGIN_HTTP_ERROR:'.$e);} curl_close($ch);
        if($status<200||$status>=400) throw new RuntimeException('XUI_AUTH_FAILED');
        if(!is_file($file)||filesize($file)===0) throw new RuntimeException('XUI_AUTH_COOKIE_MISSING');
        @touch($file);
    }

    private function requireOk(array $r, string $fallback='XUI_API_FAILED'): array {
        if (empty($r['ok'])) throw new RuntimeException((string)($r['error_code']??$fallback).(($r['message']??'')!==''?':'.$r['message']:''));
        return $r;
    }

    private function obj(array $r) {
        $b=$r['body']??null;
        return is_array($b)&&array_key_exists('obj',$b)?$b['obj']:$b;
    }

    public function testConnection(): array {
        $start=microtime(true);
        try {
            $items=$this->listInbounds();
            $modern=false;
            try {
                $probe=$this->request('GET','/panel/api/clients/list/paged?page=1&pageSize=1');
                $modern=!empty($probe['ok']);
            } catch(Throwable $ignored) { $modern=false; }
            return [
                'ok'=>true,
                'status'=>'online',
                'latency_ms'=>(int)round((microtime(true)-$start)*1000),
                'message'=>$modern?'اتصال برقرار است؛ API جدید Client در 3x-ui فعال است.':'اتصال برقرار است؛ BlueGate در حالت سازگاری Legacy کار می‌کند.',
                'auth_mode'=>$this->mode(),
                'api_mode'=>$modern?'mhsanaei_client_api':'legacy_compat',
                'modern_client_api'=>$modern,
                'inbounds_count'=>count($items)
            ];
        } catch(Throwable $e) {
            return ['ok'=>false,'status'=>'offline','latency_ms'=>(int)round((microtime(true)-$start)*1000),'message'=>$e->getMessage(),'auth_mode'=>($this->provider['auth_type']??'unknown'),'api_mode'=>'unknown'];
        }
    }

    public function listInbounds(): array {
        $r=$this->requireOk($this->request('GET','/panel/api/inbounds/list'));
        $obj=$this->obj($r); if(!is_array($obj)) return [];
        $out=[];
        foreach($obj as $in){ if(!is_array($in)) continue; $settings=$in['settings']??[]; if(is_string($settings)){$d=json_decode($settings,true);$settings=is_array($d)?$d:[];}
            $clients=is_array($settings['clients']??null)?$settings['clients']:[];
            $out[]=['id'=>(string)($in['id']??''),'remark'=>(string)($in['remark']??''),'protocol'=>(string)($in['protocol']??''),'port'=>(int)($in['port']??0),'enable'=>(bool)($in['enable']??true),'client_count'=>count($clients),'up'=>(int)($in['up']??0),'down'=>(int)($in['down']??0),'total'=>(int)($in['total']??0),'expiry_time'=>(int)($in['expiryTime']??0)];
        }
        return $out;
    }

    /** Modern MHSanaei 3x-ui Client API (3.x). All /panel/api/* endpoints support Bearer token or authenticated session. */
    private function modernClient(string $email): ?array {
        $r=$this->request('GET','/panel/api/clients/get/'.rawurlencode($email));
        if(empty($r['ok'])) {
            if(($r['http_status']??0)===404 || ($r['error_code']??'')==='XUI_ENDPOINT_NOT_FOUND') return null;
            $this->requireOk($r);
        }
        $obj=$this->obj($r); if(!is_array($obj)) return [];
        $client=is_array($obj['client']??null)?$obj['client']:$obj;
        if(!is_array($client))$client=[];
        $ids=$obj['inboundIds']??$obj['inbound_ids']??$client['inboundIds']??[];
        if(!is_array($ids))$ids=[];
        $client['inbound_ids']=array_values(array_unique(array_filter(array_map('intval',$ids),fn($v)=>$v>0)));
        return $client;
    }

    private function modernTraffic(string $email): ?array {
        $r=$this->request('GET','/panel/api/clients/traffic/'.rawurlencode($email));
        if(empty($r['ok'])) {
            if(($r['http_status']??0)===404 || ($r['error_code']??'')==='XUI_ENDPOINT_NOT_FOUND') return null;
            return null;
        }
        $obj=$this->obj($r); return is_array($obj)?$obj:[];
    }

    private function modernClientPayload(array $request, ?array $existing=null): array {
        $src=is_array($existing)?$existing:[];
        foreach($request as $k=>$v){
            if(in_array($k,['inbound_ids','inboundIds','inbound_id','remote_target_id','traffic_limit_bytes','expires_at','expiry_ms','limit_ip','limit_hwid','existing','external_client_id','external_username','username'],true))continue;
            if($v!==null)$src[$k]=$v;
        }
        $email=trim((string)($request['email']??$request['external_username']??$request['username']??$src['email']??''));
        if($email==='')throw new RuntimeException('XUI_CLIENT_EMAIL_REQUIRED');
        $src['email']=$email;
        if(array_key_exists('traffic_limit_bytes',$request))$src['totalGB']=max(0,(int)$request['traffic_limit_bytes']);
        if(array_key_exists('totalGB',$request))$src['totalGB']=max(0,(int)$request['totalGB']);
        if(array_key_exists('limit_ip',$request))$src['limitIp']=max(0,(int)$request['limit_ip']);
        if(array_key_exists('limitIp',$request))$src['limitIp']=max(0,(int)$request['limitIp']);
        if(array_key_exists('limit_hwid',$request))$src['limitHwid']=max(0,(int)$request['limit_hwid']);
        if(array_key_exists('limitHwid',$request))$src['limitHwid']=max(0,(int)$request['limitHwid']);
        if(array_key_exists('tg_id',$request))$src['tgId']=(int)$request['tg_id'];
        if(array_key_exists('enable',$request))$src['enable']=filter_var($request['enable'],FILTER_VALIDATE_BOOLEAN,FILTER_NULL_ON_FAILURE)??((int)$request['enable']===1);
        if(array_key_exists('expires_at',$request) && trim((string)$request['expires_at'])!==''){$ts=is_numeric($request['expires_at'])?(int)$request['expires_at']:strtotime((string)$request['expires_at']);if($ts>0)$src['expiryTime']=$ts*1000;}
        elseif(array_key_exists('expiry_ms',$request))$src['expiryTime']=(int)$request['expiry_ms'];
        elseif(array_key_exists('expiryTime',$request))$src['expiryTime']=(int)$request['expiryTime'];
        if(!isset($src['totalGB']))$src['totalGB']=0;
        if(!isset($src['expiryTime']))$src['expiryTime']=0;
        if(!isset($src['limitIp']))$src['limitIp']=0;
        if(!isset($src['limitHwid']))$src['limitHwid']=0;
        if(!isset($src['tgId']))$src['tgId']=0;
        if(!isset($src['enable']))$src['enable']=true;
        if(empty($src['subId']))$src['subId']=trim((string)($request['sub_id']??''))?:bin2hex(random_bytes(8));
        // Remove response-only / BlueGate-only fields before sending the official client schema.
        foreach(['inbound_ids','inboundIds','traffic','up','down','total','uuid','createdAt','updatedAt','lastOnline','externalLinks','tunnelAllowedIPs'] as $k)unset($src[$k]);
        return $src;
    }

    public function getClient(string $externalId): array {
        $externalId=trim($externalId); if($externalId==='') throw new RuntimeException('XUI_CLIENT_ID_REQUIRED');
        // New official Client API first. It works with Bearer tokens and logged-in sessions.
        try{
            $modern=$this->modernClient($externalId);
            if($modern!==null){
                $traffic=$this->modernTraffic($externalId); if(is_array($traffic))$modern=array_merge($modern,$traffic);
                return $modern;
            }
        }catch(Throwable $e){ if(!str_contains($e->getMessage(),'ENDPOINT_NOT_FOUND')) throw $e; }
        // Compatibility fallback for older 3x-ui releases.
        $r=$this->request('GET','/panel/api/inbounds/getClientTraffics/'.rawurlencode($externalId));
        if(empty($r['ok']) && preg_match('/^[0-9a-f-]{16,}$/i',$externalId)) $r=$this->request('GET','/panel/api/inbounds/getClientTrafficsById/'.rawurlencode($externalId));
        $this->requireOk($r); $obj=$this->obj($r); $client=is_array($obj)?$obj:[];$ids=[];$detail=null;
        try{$lr=$this->requireOk($this->request('GET','/panel/api/inbounds/list'));$list=$this->obj($lr);if(is_array($list)){foreach($list as $in){if(!is_array($in))continue;$settings=$in['settings']??[];if(is_string($settings)){$d=json_decode($settings,true);$settings=is_array($d)?$d:[];}foreach(($settings['clients']??[]) as $c){if(!is_array($c))continue;$match=strcasecmp((string)($c['email']??''),$externalId)===0||strcasecmp((string)($c['id']??''),$externalId)===0;if($match){$iid=(int)($in['id']??0);if($iid>0)$ids[]=$iid;if($detail===null)$detail=$c;break;}}}}}catch(Throwable $ignore){}
        if(is_array($detail))$client=array_merge($detail,$client);$client['inbound_ids']=array_values(array_unique($ids));return $client;
    }

    public function ensureServiceTargets(array $request): array {
        $existing=is_array($request['existing']??null)?$request['existing']:[];$email=trim((string)($request['email']??$existing['email']??''));if($email==='')throw new RuntimeException('XUI_CLIENT_EMAIL_REQUIRED');
        $wanted=$request['inbound_ids']??[];if(!is_array($wanted))$wanted=preg_split('/\s*,\s*/',(string)$wanted,-1,PREG_SPLIT_NO_EMPTY)?:[];$wanted=array_values(array_unique(array_filter(array_map('intval',$wanted),fn($v)=>$v>0)));$have=array_values(array_unique(array_map('intval',$existing['inbound_ids']??[])));$missing=array_values(array_diff($wanted,$have));if(!$missing)return ['ok'=>true,'added'=>[],'existing'=>$have];
        $client=$this->normalizedClient(array_merge($existing,$request,['email'=>$email,'id'=>$existing['id']??$existing['uuid']??$request['external_client_id']??'','subId'=>$existing['subId']??$existing['sub_id']??$request['sub_id']??'']),false);
        // normalizedClient creates a new id/subId only when absent; for reconciliation preserve existing identity whenever the panel exposed it.
        if(!empty($existing['id']))$client['id']=$existing['id'];if(!empty($existing['subId']))$client['subId']=$existing['subId'];
        $added=[];
        $modern=$this->request('POST','/panel/api/clients/'.rawurlencode($email).'/attach',['inboundIds'=>$missing]);
        if(!empty($modern['ok'])){$added=$missing;}
        elseif(($modern['http_status']??0)===404 || ($modern['error_code']??'')==='XUI_ENDPOINT_NOT_FOUND'){try{foreach($missing as $iid){$this->requireOk($this->request('POST','/panel/api/inbounds/addClient',['id'=>$iid,'settings'=>json_encode(['clients'=>[$client]],JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE)]));$added[]=$iid;}}catch(Throwable $e){foreach(array_reverse($added) as $iid){try{$this->request('POST','/panel/api/inbounds/'.$iid.'/delClientByEmail/'.rawurlencode($email),[]);}catch(Throwable $ignore){}}throw$e;}}
        else $this->requireOk($modern);
        return ['ok'=>true,'added'=>$added,'existing'=>$have];
    }

    private function normalizedClient(array $request, bool $forUpdate=false): array {
        $email=trim((string)($request['email']??$request['username']??$request['external_username']??''));
        if($email==='') throw new RuntimeException('XUI_CLIENT_EMAIL_REQUIRED');
        if($forUpdate){
            $c=['email'=>$email];
            $id=trim((string)($request['id']??$request['uuid']??$request['external_client_id']??'')); if($id!=='')$c['id']=$id;
            if(array_key_exists('traffic_limit_bytes',$request)||array_key_exists('totalGB',$request))$c['totalGB']=max(0,(int)($request['traffic_limit_bytes']??$request['totalGB']));
            if(array_key_exists('enable',$request))$c['enable']=filter_var($request['enable'],FILTER_VALIDATE_BOOLEAN,FILTER_NULL_ON_FAILURE)??((int)$request['enable']===1);
            if(array_key_exists('expires_at',$request)&&trim((string)$request['expires_at'])!==''){$ts=is_numeric($request['expires_at'])?(int)$request['expires_at']:strtotime((string)$request['expires_at']);if($ts>0)$c['expiryTime']=$ts*1000;}
            elseif(array_key_exists('expiry_ms',$request)||array_key_exists('expiryTime',$request))$c['expiryTime']=(int)($request['expiry_ms']??$request['expiryTime']);
            foreach(['subId','reset','comment','flow','security','password','auth','privateKey','publicKey','preSharedKey','secret','adTag','group','reverse'] as $k){$src=$k==='subId'?($request['subId']??$request['sub_id']??null):($request[$k]??null);if($src!==null&&$src!=='')$c[$k]=$src;}
            if(array_key_exists('limit_ip',$request)||array_key_exists('limitIp',$request))$c['limitIp']=max(0,(int)($request['limit_ip']??$request['limitIp']));
            if(array_key_exists('limit_hwid',$request)||array_key_exists('limitHwid',$request))$c['limitHwid']=max(0,(int)($request['limit_hwid']??$request['limitHwid']));
            return $c;
        }
        $id=trim((string)($request['id']??$request['uuid']??$request['external_client_id']??'')); if($id==='')$id=bluegate_uuid_v4();
        $subId=trim((string)($request['sub_id']??$request['subId']??'')); if($subId==='')$subId=bin2hex(random_bytes(8));
        $limit=max(0,(int)($request['traffic_limit_bytes']??$request['totalGB']??0));
        $expiry=$request['expiry_ms']??$request['expiryTime']??null;
        if($expiry===null && !empty($request['expires_at'])) { $ts=is_numeric($request['expires_at'])?(int)$request['expires_at']:strtotime((string)$request['expires_at']); $expiry=$ts>0?$ts*1000:0; }
        if($expiry===null) $expiry=0;
        $c=['id'=>$id,'email'=>$email,'totalGB'=>$limit,'expiryTime'=>(int)$expiry,'enable'=>array_key_exists('enable',$request)?(bool)$request['enable']:true,'tgId'=>(int)($request['tg_id']??0),'subId'=>$subId,'reset'=>(int)($request['reset']??0),'comment'=>(string)($request['comment']??'')];
        foreach(['flow','security','password','auth','privateKey','publicKey','preSharedKey','secret','adTag','group','reverse'] as $k) if(array_key_exists($k,$request)&&$request[$k]!==''&&$request[$k]!==null)$c[$k]=$request[$k];
        if(array_key_exists('limit_ip',$request)||array_key_exists('limitIp',$request))$c['limitIp']=max(0,(int)($request['limit_ip']??$request['limitIp']));
        if(array_key_exists('limit_hwid',$request)||array_key_exists('limitHwid',$request))$c['limitHwid']=max(0,(int)($request['limit_hwid']??$request['limitHwid']));
        return $c;
    }

    public function createService(array $request): array {
        $ids=$request['inbound_ids']??$request['inboundIds']??($request['inbound_id']??$request['remote_target_id']??null);
        if(!is_array($ids)) $ids=preg_split('/\s*,\s*/',(string)$ids,-1,PREG_SPLIT_NO_EMPTY)?:[];
        $ids=array_values(array_unique(array_filter(array_map('intval',$ids),fn($x)=>$x>0))); if(!$ids) throw new RuntimeException('XUI_INBOUND_REQUIRED');
        // Official 3x-ui 3.x first-class Client API. Server generates protocol-specific secrets when omitted.
        $client=$this->modernClientPayload($request,null);
        $r=$this->request('POST','/panel/api/clients/add',['client'=>$client,'inboundIds'=>$ids]);
        if(empty($r['ok']) && (($r['http_status']??0)===404 || ($r['error_code']??'')==='XUI_ENDPOINT_NOT_FOUND')){
            // Old Sanaei API fallback.
            $legacy=$this->normalizedClient($request,false);$added=[];$r=null;
            try { foreach($ids as $iid){$r=$this->requireOk($this->request('POST','/panel/api/inbounds/addClient',['id'=>$iid,'settings'=>json_encode(['clients'=>[$legacy]],JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE)]));$added[]=$iid;} }
            catch(Throwable $e){ foreach(array_reverse($added) as $iid){try{$this->request('POST','/panel/api/inbounds/'.$iid.'/delClientByEmail/'.rawurlencode((string)$legacy['email']),[]);}catch(Throwable $ignore){}} throw $e; }
            $client=$legacy;
        } else $this->requireOk($r);
        // Read back because modern API may generate UUID/password/auth/WireGuard keys server-side.
        try{$fresh=$this->getClient((string)$client['email']);if(is_array($fresh)&&$fresh)$client=array_merge($client,$fresh);}catch(Throwable $ignore){}
        $subId=(string)($client['subId']??$client['sub_id']??'');
        $subscription=$this->getSubscription((string)$client['email'],['sub_id'=>$subId]);
        return ['ok'=>true,'external_client_id'=>(string)($client['id']??$client['uuid']??$client['email']),'external_username'=>(string)$client['email'],'sub_id'=>$subId,'inbound_ids'=>$ids,'subscription'=>$subscription,'provider_response'=>$this->obj($r?:[])];
    }

    public function updateService(string $externalId, array $request): array {
        $email=trim((string)($request['email']??$request['username']??$externalId)); if($email==='')throw new RuntimeException('XUI_CLIENT_EMAIL_REQUIRED');
        // Official update is replacement semantics; hydrate first so fields not edited by BlueGate are preserved.
        $existing=null;try{$existing=$this->modernClient($externalId);}catch(Throwable $ignore){}
        if(is_array($existing)){
            $client=$this->modernClientPayload(array_merge($request,['email'=>$email]),$existing);
            $r=$this->request('POST','/panel/api/clients/update/'.rawurlencode($externalId),$client);
            if(!empty($r['ok']))return ['ok'=>true,'external_username'=>$email,'provider_response'=>$this->obj($r)];
            if(($r['http_status']??0)!==404 && ($r['error_code']??'')!=='XUI_ENDPOINT_NOT_FOUND')$this->requireOk($r);
        }
        // Older 3x-ui compatibility path.
        $request['email']=$email;$client=$this->normalizedClient($request,true); if(empty($client['id'])) unset($client['id']);
        $uuid=trim((string)($request['id']??$request['uuid']??$request['external_client_id']??'')); if($uuid==='') { $old=$this->getClient($externalId);$uuid=trim((string)($old['id']??$old['uuid']??'')); }
        if($uuid==='') throw new RuntimeException('XUI_CLIENT_UUID_REQUIRED_FOR_LEGACY_UPDATE');
        $ids=$request['inbound_ids']??($request['inbound_id']??$request['remote_target_id']??null);if(!is_array($ids))$ids=preg_split('/\s*,\s*/',(string)$ids,-1,PREG_SPLIT_NO_EMPTY)?:[];$ids=array_values(array_unique(array_filter(array_map('intval',$ids),fn($v)=>$v>0)));if(!$ids)$ids=$this->legacyInboundIdsForEmail($externalId);if(!$ids)throw new RuntimeException('XUI_INBOUND_REQUIRED_FOR_LEGACY_UPDATE');
        $r=null;foreach($ids as $inbound)$r=$this->requireOk($this->request('POST','/panel/api/inbounds/updateClient/'.rawurlencode($uuid),['id'=>$inbound,'settings'=>json_encode(['clients'=>[$client]],JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE)]));
        return ['ok'=>true,'external_username'=>$email,'provider_response'=>$this->obj($r)];
    }

    public function renewService(array $request): array {
        $external=(string)($request['external_username']??$request['email']??''); if($external==='') throw new RuntimeException('XUI_CLIENT_EMAIL_REQUIRED');
        return $this->updateService($external,$request);
    }
    private function legacyInboundIdsForEmail(string $email): array {
        $r=$this->requireOk($this->request('GET','/panel/api/inbounds/list'));$obj=$this->obj($r);$ids=[];if(!is_array($obj))return$ids;
        foreach($obj as $in){if(!is_array($in))continue;$settings=$in['settings']??[];if(is_string($settings)){$d=json_decode($settings,true);$settings=is_array($d)?$d:[];}foreach(($settings['clients']??[]) as $c){if(is_array($c)&&strcasecmp((string)($c['email']??''),$email)===0){$iid=(int)($in['id']??0);if($iid>0)$ids[]=$iid;break;}}}return array_values(array_unique($ids));
    }
    public function suspendService(string $externalId): bool { $this->updateService($externalId,['email'=>$externalId,'enable'=>false]); return true; }
    public function resumeService(string $externalId): bool { $this->updateService($externalId,['email'=>$externalId,'enable'=>true]); return true; }
    public function deleteService(string $externalId): bool {
        $r=$this->request('POST','/panel/api/clients/del/'.rawurlencode($externalId).'?keepTraffic=0',[]);
        if(!empty($r['ok']))return true;
        if(($r['http_status']??0)!==404 && ($r['error_code']??'')!=='XUI_ENDPOINT_NOT_FOUND')$this->requireOk($r);
        $ids=$this->legacyInboundIdsForEmail($externalId);if(!$ids){$fallback=(int)($this->meta['default_inbound_id']??0);if($fallback>0)$ids=[$fallback];}if(!$ids)throw new RuntimeException('XUI_CLIENT_INBOUNDS_NOT_FOUND');$ok=false;foreach($ids as $inbound){$r=$this->request('POST','/panel/api/inbounds/'.$inbound.'/delClientByEmail/'.rawurlencode($externalId),[]);if(!empty($r['ok']))$ok=true;}if(!$ok)throw new RuntimeException('XUI_DELETE_FAILED');return true;
    }
    public function getUsage(string $externalId): array {
        $c=$this->getClient($externalId);
        $up=(int)($c['up']??0);$down=(int)($c['down']??0);$total=(int)($c['total']??$c['totalGB']??0);$expiry=(int)($c['expiryTime']??0);
        return ['external_id'=>$externalId,'up_bytes'=>$up,'down_bytes'=>$down,'used_bytes'=>$up+$down,'total_bytes'=>$total,'remaining_bytes'=>$total>0?max(0,$total-$up-$down):null,'expiry_ms'=>$expiry,'enable'=>(bool)($c['enable']??true),'raw'=>$c];
    }
    private function panelSettings(): array {
        try {
            $r=$this->request('POST','/panel/api/setting/all',[]);
            if(!empty($r['ok'])) { $obj=$this->obj($r); return is_array($obj)?$obj:[]; }
        } catch(Throwable $ignore) {}
        return [];
    }

    private function officialSubscriptionUrl(string $subId): ?string {
        $subId=trim($subId); if($subId==='') return null;
        $settings=$this->panelSettings();
        $metaBase=trim((string)($this->meta['subscription_base_url']??''));
        $metaPath=trim((string)($this->meta['subscription_path']??''));
        // Explicit admin override stays supported, but new panels can be discovered automatically from official settings.
        if($metaBase!=='') {
            $path=$metaPath!==''?$metaPath:'/sub/';
            if(str_contains($path,'{subId}')) return rtrim($metaBase,'/').'/'.ltrim(str_replace('{subId}',rawurlencode($subId),$path),'/');
            return rtrim($metaBase,'/').'/'.trim($path,'/').'/'.rawurlencode($subId);
        }
        $subUri=trim((string)($settings['subURI']??$settings['subUri']??''));
        if($subUri!=='') return rtrim($subUri,'/').'/'.rawurlencode($subId);
        $panel=parse_url($this->base());
        $host=trim((string)($settings['subDomain']??''));
        if($host==='') $host=(string)($panel['host']??'');
        if($host==='') return null;
        $tls=trim((string)($settings['subCertFile']??''))!=='' && trim((string)($settings['subKeyFile']??''))!=='';
        $scheme=$tls?'https':'http';
        $port=(int)($settings['subPort']??2096);
        $path=trim((string)($settings['subPath']??'/sub/')); if($path==='')$path='/sub/';
        $path='/'.trim($path,'/').'/';
        $portPart=(($scheme==='https'&&$port===443)||($scheme==='http'&&$port===80))?'':':'.$port;
        return $scheme.'://'.$host.$portPart.$path.rawurlencode($subId);
    }

    public function getSubscription(string $externalId, array $context=[]): array {
        $email=trim($externalId);$links=[];
        // Share links are individual configs only; they must never be exposed as the main subscription URL.
        try {
            $r=$this->request('GET','/panel/api/clients/links/'.rawurlencode($email));
            if(!empty($r['ok'])) { $obj=$this->obj($r); $links=bluegate_xui_extract_links($obj); }
        } catch(Throwable $ignore) {}
        $subId=trim((string)($context['sub_id']??''));
        if($subId==='') {
            try { $c=$this->getClient($email); $subId=trim((string)($c['subId']??$c['sub_id']??'')); } catch(Throwable $ignore) {}
        }
        $url=$this->officialSubscriptionUrl($subId);
        return ['url'=>$url,'links'=>$links,'primary_link'=>$url,'qr_text'=>$url,'sub_id'=>$subId];
    }
}

function bluegate_xui_extract_links($obj): array {
    $c=[];
    $walk=function($v) use (&$walk,&$c){
        if(is_string($v)){foreach(preg_split('/\R+/',trim($v))?:[] as $line){$line=trim($line);if(preg_match('#^(vless|vmess|trojan|ss|wireguard|wg|hysteria2?|hy2|tuic|tg)://#i',$line))$c[]=$line;}}
        elseif(is_array($v)){foreach($v as $x)$walk($x);}
    };$walk($obj);return array_values(array_unique($c));
}
