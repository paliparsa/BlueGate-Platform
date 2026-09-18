<?php
/** Official Marzban REST API connector (Phase 8). */
final class BlueGateMarzbanProvider extends BlueGateAbstractProvider {
    private string $base; private array $meta; private ?string $token=null;
    public function __construct(array $provider){parent::__construct($provider);$this->base=rtrim((string)($provider['base_url']??''),'/');$this->meta=json_decode((string)($provider['metadata_json']??'{}'),true)?:[];}
    public function driver(): string{return 'marzban';}
    private function verifyTls(): bool{return ($this->meta['verify_tls']??true)!==false;}
    private function curl(string $method,string $path,$body=null,array $headers=[],bool $form=false): array{
        if(!function_exists('curl_init'))throw new RuntimeException('PHP_CURL_REQUIRED');$ch=curl_init($this->base.$path);$h=['Accept: application/json'];
        if($this->token)$h[]='Authorization: Bearer '.$this->token;foreach($headers as $x)$h[]=$x;
        curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_HTTPHEADER=>$h,CURLOPT_CONNECTTIMEOUT=>(int)($this->meta['connect_timeout']??8),CURLOPT_TIMEOUT=>(int)($this->meta['request_timeout']??20),CURLOPT_SSL_VERIFYPEER=>$this->verifyTls(),CURLOPT_SSL_VERIFYHOST=>$this->verifyTls()?2:0]);
        if($body!==null){if($form){curl_setopt($ch,CURLOPT_POSTFIELDS,http_build_query($body));$h[]='Content-Type: application/x-www-form-urlencoded';curl_setopt($ch,CURLOPT_HTTPHEADER,$h);}else{$h[]='Content-Type: application/json';curl_setopt($ch,CURLOPT_HTTPHEADER,$h);curl_setopt($ch,CURLOPT_POSTFIELDS,json_encode($body,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE));}}
        $raw=curl_exec($ch);$err=curl_error($ch);$code=(int)curl_getinfo($ch,CURLINFO_RESPONSE_CODE);curl_close($ch);if($raw===false||$err)throw new RuntimeException('MARZBAN_NETWORK:'.$err);$json=json_decode($raw,true);if($code<200||$code>=300)throw new RuntimeException('MARZBAN_HTTP_'.$code.':'.mb_substr(is_array($json)?json_encode($json):$raw,0,600));return is_array($json)?$json:['raw'=>$raw];
    }
    private function auth(): void{
        if($this->token)return;$stored=bluegate_decrypt_secret($this->provider['api_token_encrypted']??null);if($stored){$this->token=$stored;return;}
        $u=(string)($this->provider['username']??'');$p=(string)(bluegate_decrypt_secret($this->provider['secret_encrypted']??null)??'');if($u===''||$p==='')throw new RuntimeException('MARZBAN_CREDENTIALS_REQUIRED');
        $r=$this->curl('POST','/api/admin/token',['grant_type'=>'password','username'=>$u,'password'=>$p],[],true);$this->token=(string)($r['access_token']??'');if($this->token==='')throw new RuntimeException('MARZBAN_TOKEN_MISSING');
    }
    private function req(string $method,string $path,$body=null): array{$this->auth();return $this->curl($method,$path,$body);}
    public function testConnection(): array{$t=microtime(true);try{$r=$this->req('GET','/api/system');return['ok'=>true,'status'=>'online','latency_ms'=>(int)round((microtime(true)-$t)*1000),'message'=>'Connected via official Marzban REST API','details'=>$r];}catch(Throwable $e){return['ok'=>false,'status'=>'offline','latency_ms'=>(int)round((microtime(true)-$t)*1000),'message'=>$e->getMessage()];}}
    public function listInbounds(): array{
        // Official user model exposes protocol/inbound tags. The core config endpoint changed across Marzban versions,
        // so use OpenAPI when available, otherwise expose configured mapping targets through user-compatible protocol/tag semantics.
        try{$r=$this->req('GET','/api/core');$raw=$r['config']??$r['xray_config']??$r;$ins=is_array($raw)?($raw['inbounds']??[]):[];$out=[];foreach($ins as $i){if(!is_array($i))continue;$tag=(string)($i['tag']??'');$protocol=(string)($i['protocol']??'');if($tag!=='')$out[]=['id'=>$tag,'tag'=>$tag,'remark'=>$tag,'protocol'=>$protocol,'port'=>$i['port']??null];}if($out)return$out;}catch(Throwable $ignore){}
        return [['id'=>'AUTO','tag'=>'AUTO','remark'=>'Marzban automatic enabled inbounds','protocol'=>'auto','note'=>'Use mapping config proxies/inbounds for exact selection.']];
    }
    private function unwrap(array $r): array{return isset($r['response'])&&is_array($r['response'])?$r['response']:$r;}
    public function getClient(string $externalId): array{$r=$this->unwrap($this->req('GET','/api/user/'.rawurlencode($externalId)));$r['external_username']=$r['username']??$externalId;return$r;}
    private function payload(array $q,bool $create): array{
        $username=trim((string)($q['email']??$q['external_username']??''));if($username==='')throw new RuntimeException('MARZBAN_USERNAME_REQUIRED');
        $meta=is_array($q['provider_config']??null)?$q['provider_config']:[];
        if($create){
            $exp=0;if(!empty($q['expires_at'])){$exp=is_numeric($q['expires_at'])?(int)$q['expires_at']:(int)strtotime((string)$q['expires_at']);}
            $proxies=$meta['proxies']??($q['proxies']??['vless'=>[]]);$inbounds=$meta['inbounds']??($q['inbounds']??[]);
            return ['username'=>$username,'proxies'=>$proxies,'inbounds'=>$inbounds,'status'=>!empty($q['enable'])||!array_key_exists('enable',$q)?'active':'disabled','expire'=>$exp>0?$exp:0,'data_limit'=>max(0,(int)($q['traffic_limit_bytes']??0)),'data_limit_reset_strategy'=>(string)($meta['data_limit_reset_strategy']??'no_reset'),'note'=>(string)($q['comment']??'BlueGate')];
        }
        $p=[];
        if(array_key_exists('enable',$q))$p['status']=!empty($q['enable'])?'active':'disabled';
        if(array_key_exists('expires_at',$q)){$exp=$q['expires_at']? (is_numeric($q['expires_at'])?(int)$q['expires_at']:(int)strtotime((string)$q['expires_at'])):0;$p['expire']=$exp>0?$exp:0;}
        if(array_key_exists('traffic_limit_bytes',$q))$p['data_limit']=max(0,(int)$q['traffic_limit_bytes']);
        if(array_key_exists('data_limit_reset_strategy',$meta))$p['data_limit_reset_strategy']=(string)$meta['data_limit_reset_strategy'];
        if(array_key_exists('proxies',$meta))$p['proxies']=$meta['proxies'];
        if(array_key_exists('inbounds',$meta))$p['inbounds']=$meta['inbounds'];
        if(array_key_exists('comment',$q))$p['note']=(string)$q['comment'];
        if(!$p)throw new RuntimeException('MARZBAN_UPDATE_EMPTY');
        return$p;
    }
    private function isNotFound(Throwable $e): bool{return str_contains($e->getMessage(),'MARZBAN_HTTP_404');}
    public function createService(array $request): array{$u=(string)($request['email']??$request['external_username']??'');try{$old=$this->getClient($u);if($old)return $this->normalize($old);}catch(Throwable $e){if(!$this->isNotFound($e))throw $e;}$r=$this->unwrap($this->req('POST','/api/user',$this->payload($request,true)));return$this->normalize($r);}
    private function normalize(array $u): array{$username=(string)($u['username']??$u['external_username']??'');$sub=(string)($u['subscription_url']??'');return['ok'=>true,'external_client_id'=>$username,'external_username'=>$username,'sub_id'=>$u['subscription_url']??null,'subscription'=>['url'=>$sub,'primary_link'=>$sub,'links'=>$sub?[$sub]:[]],'provider_response'=>$u]+$u;}
    public function updateService(string $externalId,array $request): array{$r=$this->unwrap($this->req('PUT','/api/user/'.rawurlencode($externalId),$this->payload($request,false)));return$this->normalize($r);}
    public function renewService(array $request): array{return$this->updateService((string)($request['external_username']??$request['email']??''),$request);}
    public function suspendService(string $externalId): bool{$this->updateService($externalId,['email'=>$externalId,'enable'=>false]);return true;}
    public function resumeService(string $externalId): bool{$this->updateService($externalId,['email'=>$externalId,'enable'=>true]);return true;}
    public function deleteService(string $externalId): bool{$this->req('DELETE','/api/user/'.rawurlencode($externalId));return true;}
    public function getUsage(string $externalId): array{$u=$this->getClient($externalId);return['used_bytes'=>(int)($u['used_traffic']??0),'traffic_limit_bytes'=>(int)($u['data_limit']??0),'expires_at'=>!empty($u['expire'])?date('Y-m-d H:i:s',(int)$u['expire']):null,'status'=>(string)($u['status']??'unknown'),'raw'=>$u];}
    public function getSubscription(string $externalId,array $context=[]): array{$u=$this->getClient($externalId);$url=(string)($u['subscription_url']??'');return['url'=>$url,'primary_link'=>$url,'links'=>$url?[$url]:[]];}
}
