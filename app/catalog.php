<?php
/**
 * BlueGate Catalog v2
 * New source-of-truth model: Store Category -> Service -> Service Group -> Service Plan.
 * Legacy products/product_variants remain intact for backwards-compatible checkout and order history.
 */

function catalog_enabled(): bool {
    return setting_bool('catalog_v2_storefront_enabled', false) && table_exists('services') && table_exists('service_groups') && table_exists('service_plans');
}

function catalog_slugify(string $value, string $fallback='item'): string {
    $value = trim(mb_strtolower($value));
    $value = preg_replace('/[^\p{L}\p{N}]+/u', '-', $value) ?: '';
    $value = trim($value, '-');
    return $value !== '' ? mb_substr($value, 0, 120) : $fallback.'-'.bin2hex(random_bytes(3));
}

function catalog_unique_slug(string $table, string $base, string $fallback='item', ?int $excludeId=null): string {
    if (!in_array($table, ['store_categories','services','service_groups','products'], true)) throw new RuntimeException('INVALID_CATALOG_TABLE');
    $base = catalog_slugify($base, $fallback);
    $slug = $base; $i = 2;
    while (true) {
        $sql = 'SELECT id FROM '.$table.' WHERE slug=?'.($excludeId ? ' AND id<>?' : '').' LIMIT 1';
        $q = db()->prepare($sql); $args=[$slug]; if($excludeId)$args[]=$excludeId; $q->execute($args);
        if (!$q->fetch()) return $slug;
        $slug = mb_substr($base, 0, 112).'-'.$i++;
    }
}

function catalog_store_categories(bool $activeOnly=false): array {
    if (!table_exists('store_categories')) return [];
    $sql='SELECT * FROM store_categories'.($activeOnly?' WHERE is_active=1':'').' ORDER BY sort_order ASC,id ASC';
    return db()->query($sql)->fetchAll();
}

function catalog_tree(bool $activeOnly=false): array {
    if (!table_exists('services') || !table_exists('service_groups') || !table_exists('service_plans')) return [];
    $where=$activeOnly?' WHERE s.is_active=1 AND (c.id IS NULL OR c.is_active=1)':'';
    $services=db()->query('SELECT s.*,c.title category_title,c.emoji category_emoji,c.legacy_category_id FROM services s LEFT JOIN store_categories c ON c.id=s.category_id'.$where.' ORDER BY s.sort_order ASC,s.id ASC')->fetchAll();
    $gq=db()->query('SELECT * FROM service_groups'.($activeOnly?' WHERE is_active=1':'').' ORDER BY sort_order ASC,id ASC')->fetchAll();
    $pq=db()->query('SELECT * FROM service_plans'.($activeOnly?' WHERE is_active=1':'').' ORDER BY sort_order ASC,id ASC')->fetchAll();
    $groupsBy=[];$plansBy=[];
    foreach($pq as $p){$plansBy[(int)$p['group_id']][]=$p;}
    foreach($gq as $g){$g['plans']=$plansBy[(int)$g['id']]??[];$groupsBy[(int)$g['service_id']][]=$g;}
    foreach($services as &$s){$s['groups']=$groupsBy[(int)$s['id']]??[];} unset($s);
    return $services;
}

function catalog_public_payload(): array {
    $out=[];
    foreach(catalog_tree(true) as $s){
        $groups=[];
        foreach($s['groups'] as $g){
            $plans=[];
            foreach($g['plans'] as $p){
                $plans[]=[
                    'id'=>(int)$p['id'],'title'=>$p['title'],'price'=>(int)$p['price'],'price_currency'=>$p['price_currency'],
                    'price_usd'=>$p['price_usd']!==null?(float)$p['price_usd']:null,'duration_days'=>(int)$p['duration_days'],
                    'discount_percent'=>(float)$p['discount_percent'],'description'=>$p['description']??'',
                    'delivery_type'=>$p['delivery_type'],'commission_type'=>$p['commission_type'],'commission_value'=>(int)$p['commission_value'],
                    'legacy_product_id'=>$p['legacy_product_id']!==null?(int)$p['legacy_product_id']:null,
                    'legacy_variant_id'=>$p['legacy_variant_id']!==null?(int)$p['legacy_variant_id']:null,
                    'sort_order'=>(int)$p['sort_order']
                ];
            }
            $groups[]=['id'=>(int)$g['id'],'name'=>$g['name'],'slug'=>$g['slug'],'description'=>$g['description']??'','image_url'=>$g['image_url']??null,'is_default'=>(int)$g['is_default'],'legacy_product_id'=>$g['legacy_product_id']!==null?(int)$g['legacy_product_id']:null,'sort_order'=>(int)$g['sort_order'],'plans'=>$plans];
        }
        $out[]=['id'=>(int)$s['id'],'name'=>$s['name'],'slug'=>$s['slug'],'description'=>$s['description']??'','image_url'=>$s['image_url']??null,'theme'=>$s['theme']??null,'badge'=>$s['badge']??null,'is_featured'=>(int)$s['is_featured'],'legacy_product_id'=>$s['legacy_product_id']!==null?(int)$s['legacy_product_id']:null,'category'=>['id'=>$s['category_id']!==null?(int)$s['category_id']:null,'title'=>$s['category_title']??null,'emoji'=>$s['category_emoji']??null,'legacy_category_id'=>$s['legacy_category_id']!==null?(int)$s['legacy_category_id']:null],'groups'=>$groups];
    }
    return ['enabled'=>catalog_enabled(),'applied_at'=>setting('catalog_v2_applied_at',''),'services'=>$out];
}

function catalog_legacy_products_index(): array {
    $rows=db()->query('SELECT p.*,c.title category_title,c.emoji category_emoji FROM products p LEFT JOIN product_categories c ON c.id=p.category_id ORDER BY p.sort_order ASC,p.id ASC')->fetchAll();
    $out=[];foreach($rows as $p)$out[(int)$p['id']]=$p;return $out;
}


function catalog_scan_legacy(): array {
    $products=catalog_legacy_products_index();
    $children=[];$roots=[];$orphans=[];
    foreach($products as $p){
        $pid=(int)$p['id'];$parent=(int)($p['parent_id']??0);
        if($parent>0 && isset($products[$parent])) $children[$parent][]=$p;
        elseif($parent>0) {$orphans[]=$p;$roots[]=$p;}
        else $roots[]=$p;
    }
    usort($roots,fn($a,$b)=>(int)($a['sort_order']??0)<=>(int)($b['sort_order']??0) ?: (int)$a['id']<=>(int)$b['id']);
    $mapped=[];if(table_exists('services')){foreach(db()->query('SELECT legacy_product_id FROM services WHERE legacy_product_id IS NOT NULL')->fetchAll() as $m)$mapped[(int)$m['legacy_product_id']]=true;}
    $proposals=[];$counts=['services'=>0,'groups'=>0,'plans'=>0,'high'=>0,'medium'=>0,'review'=>0,'mapped'=>count($mapped),'legacy_products'=>count($products),'legacy_variants'=>0,'orphans'=>count($orphans)];
    foreach($products as $p){$counts['legacy_variants']+=count(product_variants((int)$p['id'],false));}
    $containerTypes=['service_group','group','container'];
    foreach($roots as $root){
        $rid=(int)$root['id'];$kids=$children[$rid]??[];$rootVars=product_variants($rid,false);$groups=[];$needsReview=false;
        if($kids){
            if($rootVars){$groups[]=['name'=>'Default Group','is_default'=>1,'legacy_product_id'=>$rid,'plans'=>catalog_scan_plans_for_product($root,$rootVars)];}
            foreach($kids as $child){
                $vars=product_variants((int)$child['id'],false);
                $plans=catalog_scan_plans_for_product($child,$vars);
                if(!$plans)$needsReview=true;
                $groups[]=['name'=>$child['name'],'is_default'=>0,'legacy_product_id'=>(int)$child['id'],'plans'=>$plans];
            }
            $confidence=$needsReview?'medium':'high';
        } else {
            $plans=catalog_scan_plans_for_product($root,$rootVars);
            $isContainer=in_array(strtolower((string)($root['product_type']??'normal')),$containerTypes,true);
            if(!$plans && $isContainer){$confidence='review';$needsReview=true;} else $confidence=$rootVars?'medium':'medium';
            $groups[]=['name'=>'Default Group','is_default'=>1,'legacy_product_id'=>$rid,'plans'=>$plans];
        }
        if(in_array($root,$orphans,true)){$confidence='review';$needsReview=true;}
        $planCount=0;foreach($groups as $g)$planCount+=count($g['plans']);
        $counts['services']++;$counts['groups']+=count($groups);$counts['plans']+=$planCount;$counts[$confidence]++;
        $proposals[]=[
            'legacy_product_id'=>$rid,'service_name'=>$root['name'],'category_id'=>(int)($root['category_id']??0),'category_title'=>$root['category_title']??'بدون دسته',
            'confidence'=>$confidence,'needs_review'=>$needsReview,'mapped'=>isset($mapped[$rid]),'groups'=>$groups,'plan_count'=>$planCount,
            'reason'=>$confidence==='high'?'والد و زیرمحصول‌ها با ساختار روشن شناسایی شدند.':($confidence==='medium'?'محصول مستقل/پلن‌ها قابل نگاشت هستند؛ بهتر است Preview را بررسی کنی.':'ساختار مبهم یا والد از دست‌رفته است و نیاز به بررسی دستی دارد.')
        ];
    }
    return ['version'=>'2.0','safe'=>true,'preview_only'=>true,'counts'=>$counts,'proposals'=>$proposals,'storefront_currently_enabled'=>catalog_enabled()];
}

function catalog_scan_plans_for_product(array $product, array $variants): array {
    $out=[];
    if($variants){
        foreach($variants as $v)$out[]=['title'=>$v['title'],'legacy_product_id'=>(int)$product['id'],'legacy_variant_id'=>(int)$v['id'],'price'=>(int)$v['price'],'is_active'=>(int)$v['is_active']];
    } else {
        $isContainer=in_array(strtolower((string)($product['product_type']??'normal')),['service_group','group','container'],true);
        if(!$isContainer)$out[]=['title'=>$product['name'],'legacy_product_id'=>(int)$product['id'],'legacy_variant_id'=>null,'price'=>(int)$product['price'],'is_active'=>(int)$product['is_active']];
    }
    return $out;
}

function catalog_upsert_store_category(?int $legacyCategoryId): int {
    if($legacyCategoryId){
        $q=db()->prepare('SELECT * FROM product_categories WHERE id=?');$q->execute([$legacyCategoryId]);$c=$q->fetch();
        if($c){
            $find=db()->prepare('SELECT id FROM store_categories WHERE legacy_category_id=? LIMIT 1');$find->execute([$legacyCategoryId]);$r=$find->fetch();
            if($r){db()->prepare('UPDATE store_categories SET title=?,emoji=?,image_url=?,sort_order=?,is_active=? WHERE id=?')->execute([$c['title'],$c['emoji'],$c['image_url']??null,(int)$c['sort_order'],(int)$c['is_active'],(int)$r['id']]);return (int)$r['id'];}
            db()->prepare('INSERT INTO store_categories (legacy_category_id,title,slug,emoji,image_url,sort_order,is_active) VALUES (?,?,?,?,?,?,?)')->execute([$legacyCategoryId,$c['title'],catalog_unique_slug('store_categories',$c['title'],'category'),$c['emoji'],$c['image_url']??null,(int)$c['sort_order'],(int)$c['is_active']]);return (int)db()->lastInsertId();
        }
    }
    $q=db()->query('SELECT id FROM store_categories WHERE legacy_category_id IS NULL AND slug="other" LIMIT 1');$r=$q->fetch();if($r)return (int)$r['id'];
    db()->prepare('INSERT INTO store_categories (legacy_category_id,title,slug,emoji,sort_order,is_active) VALUES (NULL,"سایر","other","🛍️",999,1)')->execute();return (int)db()->lastInsertId();
}

function catalog_apply_proposal(array $proposal): int {
    $legacyId=(int)$proposal['legacy_product_id'];$product=shop_product($legacyId);if(!$product)return 0;
    $catId=catalog_upsert_store_category(!empty($product['category_id'])?(int)$product['category_id']:null);
    $cfg=storefront_product_config($product);
    $find=db()->prepare('SELECT id FROM services WHERE legacy_product_id=? LIMIT 1');$find->execute([$legacyId]);$sr=$find->fetch();
    $serviceSlug=$sr ? catalog_unique_slug('services',(string)($product['slug']?:$product['name']),'service',(int)$sr['id']) : catalog_unique_slug('services',(string)($product['slug']?:$product['name']),'service');
    $serviceArgs=[$catId,$product['name'],$serviceSlug,$product['full_description']?:$product['short_description'],$product['image_url']??null,$cfg['theme']??null,$cfg['badge']??null,json_encode($cfg,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),(int)($product['is_featured']??0),(int)$product['is_active'],(int)($product['sort_order']??0)];
    if($sr){$serviceId=(int)$sr['id'];db()->prepare('UPDATE services SET category_id=?,name=?,slug=?,description=?,image_url=?,theme=?,badge=?,config_json=?,is_featured=?,is_active=?,sort_order=? WHERE id=?')->execute([...$serviceArgs,$serviceId]);}
    else{db()->prepare('INSERT INTO services (category_id,legacy_product_id,name,slug,description,image_url,theme,badge,config_json,is_featured,is_active,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')->execute([$catId,$legacyId,$product['name'],$serviceSlug,$product['full_description']?:$product['short_description'],$product['image_url']??null,$cfg['theme']??null,$cfg['badge']??null,json_encode($cfg,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),(int)($product['is_featured']??0),(int)$product['is_active'],(int)($product['sort_order']??0)]);$serviceId=(int)db()->lastInsertId();}
    foreach($proposal['groups'] as $gi=>$gp){
        $legacyGroupId=(int)$gp['legacy_product_id'];$groupProduct=shop_product($legacyGroupId)?:$product;
        $findG=db()->prepare('SELECT id FROM service_groups WHERE service_id=? AND legacy_product_id=? AND is_default=? LIMIT 1');$findG->execute([$serviceId,$legacyGroupId,!empty($gp['is_default'])?1:0]);$gr=$findG->fetch();
        $gname=!empty($gp['is_default'])?'Default Group':$groupProduct['name'];
        $gslug=!empty($gp['is_default'])?'default':($gr?catalog_unique_slug('service_groups',$groupProduct['name'],'group',(int)$gr['id']):catalog_unique_slug('service_groups',$groupProduct['name'],'group'));
        if($gr){$groupId=(int)$gr['id'];db()->prepare('UPDATE service_groups SET name=?,slug=?,description=?,image_url=?,config_json=?,is_default=?,is_active=?,sort_order=? WHERE id=?')->execute([$gname,$gslug,$groupProduct['full_description']?:$groupProduct['short_description'],$groupProduct['image_url']??null,$groupProduct['config_json']??null,!empty($gp['is_default'])?1:0,(int)$groupProduct['is_active'],(int)($groupProduct['sort_order']??$gi),$groupId]);}
        else{db()->prepare('INSERT INTO service_groups (service_id,legacy_product_id,name,slug,description,image_url,config_json,is_default,is_active,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)')->execute([$serviceId,$legacyGroupId,$gname,$gslug,$groupProduct['full_description']?:$groupProduct['short_description'],$groupProduct['image_url']??null,$groupProduct['config_json']??null,!empty($gp['is_default'])?1:0,(int)$groupProduct['is_active'],(int)($groupProduct['sort_order']??$gi)]);$groupId=(int)db()->lastInsertId();}
        $variants=product_variants($legacyGroupId,false);
        if($variants){foreach($variants as $vi=>$v)catalog_upsert_plan_from_legacy($groupId,$groupProduct,$v,$vi);}
        else if(!in_array(strtolower((string)($groupProduct['product_type']??'normal')),['service_group','group','container'],true))catalog_upsert_plan_from_legacy($groupId,$groupProduct,null,0);
    }
    return $serviceId;
}

function catalog_backfill_order_snapshots(): int {
    if(!table_exists('orders')||!column_exists('orders','variant_id')||!column_exists('orders','catalog_plan_id'))return 0;
    $total=0;
    $sql='UPDATE orders o JOIN service_plans p ON p.legacy_variant_id=o.variant_id JOIN service_groups g ON g.id=p.group_id JOIN services s ON s.id=g.service_id SET o.catalog_service_id=s.id,o.catalog_group_id=g.id,o.catalog_plan_id=p.id,o.service_name_snapshot=s.name,o.group_name_snapshot=IF(g.is_default=1,"",g.name),o.plan_name_snapshot=p.title WHERE o.catalog_plan_id IS NULL AND o.variant_id IS NOT NULL';
    $total+=(int)db()->exec($sql);
    $sql='UPDATE orders o JOIN service_plans p ON p.legacy_product_id=o.product_id AND p.legacy_variant_id IS NULL JOIN service_groups g ON g.id=p.group_id JOIN services s ON s.id=g.service_id SET o.catalog_service_id=s.id,o.catalog_group_id=g.id,o.catalog_plan_id=p.id,o.service_name_snapshot=s.name,o.group_name_snapshot=IF(g.is_default=1,"",g.name),o.plan_name_snapshot=p.title WHERE o.catalog_plan_id IS NULL AND o.variant_id IS NULL';
    $total+=(int)db()->exec($sql);
    return $total;
}

function catalog_apply_legacy_mapping(): array {
    $scan=catalog_scan_legacy();$applied=0;$skipped=[];
    db()->beginTransaction();
    try{
        foreach($scan['proposals'] as $proposal){
            if(($proposal['confidence']??'review')==='review'){$skipped[]=['legacy_product_id'=>(int)$proposal['legacy_product_id'],'service_name'=>$proposal['service_name']];continue;}
            if(catalog_apply_proposal($proposal)>0)$applied++;
        }
        $backfilled=catalog_backfill_order_snapshots();
        set_setting('catalog_v2_storefront_enabled','1');set_setting('catalog_v2_applied_at',date('Y-m-d H:i:s'));set_setting('catalog_v2_last_scan',date('Y-m-d H:i:s'));
        db()->commit();
    }catch(Throwable $e){if(db()->inTransaction())db()->rollBack();throw $e;}
    return ['ok'=>true,'message'=>'کاتالوگ v2 بدون حذف دیتای Legacy اعمال شد.','applied_services'=>$applied,'needs_review'=>$skipped,'orders_backfilled'=>$backfilled,'scan'=>$scan,'catalog'=>catalog_public_payload()];
}

function catalog_apply_legacy_product(int $legacyProductId): array {
    $scan=catalog_scan_legacy();$proposal=null;foreach($scan['proposals'] as $p){if((int)$p['legacy_product_id']===$legacyProductId){$proposal=$p;break;}}
    if(!$proposal)throw new RuntimeException('LEGACY_PRODUCT_NOT_FOUND');
    db()->beginTransaction();
    try{$serviceId=catalog_apply_proposal($proposal);$backfilled=catalog_backfill_order_snapshots();set_setting('catalog_v2_storefront_enabled','1');if(!setting('catalog_v2_applied_at',''))set_setting('catalog_v2_applied_at',date('Y-m-d H:i:s'));db()->commit();}
    catch(Throwable $e){if(db()->inTransaction())db()->rollBack();throw $e;}
    return ['ok'=>true,'service_id'=>$serviceId,'orders_backfilled'=>$backfilled];
}

function catalog_upsert_plan_from_legacy(int $groupId,array $product,?array $variant,int $sort): int {
    $legacyProductId=(int)$product['id'];$legacyVariantId=$variant?(int)$variant['id']:null;$row=$variant?:$product;
    $found=null;
    if($legacyVariantId){$q=db()->prepare('SELECT id FROM service_plans WHERE legacy_variant_id=? LIMIT 1');$q->execute([$legacyVariantId]);$found=$q->fetch();}
    else{$q=db()->prepare('SELECT id FROM service_plans WHERE group_id=? AND legacy_product_id=? AND legacy_variant_id IS NULL LIMIT 1');$q->execute([$groupId,$legacyProductId]);$found=$q->fetch();}
    $title=$variant?$variant['title']:$product['name'];$discount=(float)($variant['discount_percent']??0);$description=$variant?($variant['description']??''):($product['full_description']?:$product['short_description']);
    $args=[$groupId,$legacyProductId,$legacyVariantId,$title,(int)$row['price'],$row['price_currency']??'IRT',$row['price_usd']??null,$row['price_rate_toman']??null,$row['price_rate_source']??null,$row['price_rate_updated_at']??null,(int)($row['duration_days']??0),$discount,$description,$product['delivery_type']??'manual',$product['commission_type']??'none',(int)($product['commission_value']??0),(int)($row['is_active']??1),(int)($row['sort_order']??$sort)];
    if($found){$id=(int)$found['id'];db()->prepare('UPDATE service_plans SET group_id=?,legacy_product_id=?,legacy_variant_id=?,title=?,price=?,price_currency=?,price_usd=?,price_rate_toman=?,price_rate_source=?,price_rate_updated_at=?,duration_days=?,discount_percent=?,description=?,delivery_type=?,commission_type=?,commission_value=?,is_active=?,sort_order=? WHERE id=?')->execute([...$args,$id]);return $id;}
    db()->prepare('INSERT INTO service_plans (group_id,legacy_product_id,legacy_variant_id,title,price,price_currency,price_usd,price_rate_toman,price_rate_source,price_rate_updated_at,duration_days,discount_percent,description,delivery_type,commission_type,commission_value,is_active,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')->execute($args);return (int)db()->lastInsertId();
}

function storefront_shop_products(): array {
    $legacy=shop_products(null,true);if(!catalog_enabled())return $legacy;
    $legacyBy=[];foreach($legacy as $p)$legacyBy[(int)$p['id']]=$p;
    $out=[];$used=[];
    foreach(catalog_tree(true) as $s){
        $serviceLegacy=(int)($s['legacy_product_id']??0);if(!$serviceLegacy||!isset($legacyBy[$serviceLegacy]))continue;
        $groups=$s['groups']??[];$planCount=0;foreach($groups as $gg)$planCount+=count($gg['plans']??[]);if($planCount===0){$used[$serviceLegacy]=true;foreach($groups as $gg)if(!empty($gg['legacy_product_id']))$used[(int)$gg['legacy_product_id']]=true;continue;}
        $visible=array_values(array_filter($groups,fn($g)=>(int)$g['is_default']===0 && count($g['plans']??[])>0));$default=null;foreach($groups as $g)if((int)$g['is_default']===1){$default=$g;break;}
        $root=$legacyBy[$serviceLegacy];$root['name']=$s['name'];$root['parent_id']=0;$root['parent_name']=null;$root['child_count']=count($visible);$root['__catalog_variant_ids']=[];
        if(!empty($s['legacy_category_id']))$root['category_id']=(int)$s['legacy_category_id'];
        $root['category_title']=$s['category_title']??($root['category_title']??null);$root['category_emoji']=$s['category_emoji']??($root['category_emoji']??null);
        $root['is_featured']=(int)($s['is_featured']??($root['is_featured']??0));
        if($visible){$root['product_type']='service_group';}
        elseif($default){$root['__catalog_variant_ids']=array_values(array_filter(array_map(fn($p)=>(int)($p['legacy_variant_id']??0),$default['plans']??[])));}
        $root['variant_count']=count($root['__catalog_variant_ids']);
        $out[]=$root;$used[$serviceLegacy]=true;
        foreach($visible as $g){
            $gid=(int)($g['legacy_product_id']??0);if(!$gid||!isset($legacyBy[$gid]))continue;
            $row=$legacyBy[$gid];$row['name']=$g['name'];$row['parent_id']=$serviceLegacy;$row['parent_name']=$s['name'];$row['child_count']=0;
            if(!empty($s['legacy_category_id']))$row['category_id']=(int)$s['legacy_category_id'];
            $row['category_title']=$s['category_title']??($row['category_title']??null);$row['category_emoji']=$s['category_emoji']??($row['category_emoji']??null);$row['is_featured']=(int)($s['is_featured']??($row['is_featured']??0));
            $row['__catalog_variant_ids']=array_values(array_filter(array_map(fn($p)=>(int)($p['legacy_variant_id']??0),$g['plans']??[])));
            $row['variant_count']=count($row['__catalog_variant_ids']);
            $out[]=$row;$used[$gid]=true;
        }
    }
    // Keep anything not mapped yet visible until the admin explicitly resolves Needs Review.
    foreach($legacy as $p)if(!isset($used[(int)$p['id']]))$out[]=$p;
    return $out ?: $legacy;
}

function catalog_order_snapshot(int $orderId,int $legacyProductId,?int $legacyVariantId): void {
    if(!table_exists('service_plans')||!column_exists('orders','catalog_plan_id'))return;
    if($legacyVariantId){$q=db()->prepare('SELECT p.id plan_id,p.title plan_title,g.id group_id,g.name group_name,s.id service_id,s.name service_name FROM service_plans p JOIN service_groups g ON g.id=p.group_id JOIN services s ON s.id=g.service_id WHERE p.legacy_variant_id=? LIMIT 1');$q->execute([$legacyVariantId]);}
    else{$q=db()->prepare('SELECT p.id plan_id,p.title plan_title,g.id group_id,g.name group_name,s.id service_id,s.name service_name FROM service_plans p JOIN service_groups g ON g.id=p.group_id JOIN services s ON s.id=g.service_id WHERE p.legacy_product_id=? AND p.legacy_variant_id IS NULL LIMIT 1');$q->execute([$legacyProductId]);}
    $r=$q->fetch();if(!$r)return;
    db()->prepare('UPDATE orders SET catalog_service_id=?,catalog_group_id=?,catalog_plan_id=?,service_name_snapshot=?,group_name_snapshot=?,plan_name_snapshot=? WHERE id=?')->execute([(int)$r['service_id'],(int)$r['group_id'],(int)$r['plan_id'],$r['service_name'],((string)$r['group_name']==='Default Group'?'':$r['group_name']),$r['plan_title'],$orderId]);
}

function catalog_move_group(int $groupId,int $serviceId): void {
    $q=db()->prepare('SELECT is_default FROM service_groups WHERE id=?');$q->execute([$groupId]);$g=$q->fetch();if(!$g)throw new RuntimeException('GROUP_NOT_FOUND');if((int)$g['is_default']===1)throw new RuntimeException('DEFAULT_GROUP_CANNOT_MOVE');
    $q=db()->prepare('SELECT id FROM services WHERE id=?');$q->execute([$serviceId]);if(!$q->fetch())throw new RuntimeException('SERVICE_NOT_FOUND');
    db()->prepare('UPDATE service_groups SET service_id=? WHERE id=?')->execute([$serviceId,$groupId]);
}
function catalog_move_plan(int $planId,int $groupId): void {
    $q=db()->prepare('SELECT id FROM service_plans WHERE id=?');$q->execute([$planId]);if(!$q->fetch())throw new RuntimeException('PLAN_NOT_FOUND');
    $q=db()->prepare('SELECT id FROM service_groups WHERE id=?');$q->execute([$groupId]);if(!$q->fetch())throw new RuntimeException('GROUP_NOT_FOUND');
    db()->prepare('UPDATE service_plans SET group_id=? WHERE id=?')->execute([$groupId,$planId]);
}

function catalog_save_category(array $d): int {
    $id=(int)($d['id']??$d['category_id']??0);$title=trim((string)($d['title']??''));if($title==='')throw new RuntimeException('CATEGORY_TITLE_REQUIRED');
    $emoji=trim((string)($d['emoji']??'🛍️'))?:'🛍️';$image=trim((string)($d['image_url']??''))?:null;$sort=(int)($d['sort_order']??99);$active=array_key_exists('is_active',$d)?(!empty($d['is_active'])?1:0):1;
    $existing=null;if($id>0){$q=db()->prepare('SELECT * FROM store_categories WHERE id=?');$q->execute([$id]);$existing=$q->fetch();if(!$existing)throw new RuntimeException('CATEGORY_NOT_FOUND');}
    $slug=catalog_unique_slug('store_categories',(string)($d['slug']??$title),'category',$id>0?$id:null);
    $legacyId=(int)($existing['legacy_category_id']??0);
    if($legacyId>0){db()->prepare('UPDATE product_categories SET title=?,emoji=?,image_url=?,sort_order=?,is_active=? WHERE id=?')->execute([$title,$emoji,$image,$sort,$active,$legacyId]);}
    else{db()->prepare('INSERT INTO product_categories (title,emoji,image_url,sort_order,is_active) VALUES (?,?,?,?,?)')->execute([$title,$emoji,$image,$sort,$active]);$legacyId=(int)db()->lastInsertId();}
    if($existing){db()->prepare('UPDATE store_categories SET legacy_category_id=?,title=?,slug=?,emoji=?,image_url=?,sort_order=?,is_active=? WHERE id=?')->execute([$legacyId,$title,$slug,$emoji,$image,$sort,$active,$id]);return $id;}
    db()->prepare('INSERT INTO store_categories (legacy_category_id,title,slug,emoji,image_url,sort_order,is_active) VALUES (?,?,?,?,?,?,?)')->execute([$legacyId,$title,$slug,$emoji,$image,$sort,$active]);return (int)db()->lastInsertId();
}

function catalog_ensure_legacy_category(int $storeCategoryId): int {
    $q=db()->prepare('SELECT * FROM store_categories WHERE id=?');$q->execute([$storeCategoryId]);$c=$q->fetch();if(!$c)throw new RuntimeException('CATEGORY_NOT_FOUND');
    if(!empty($c['legacy_category_id']))return (int)$c['legacy_category_id'];
    db()->prepare('INSERT INTO product_categories (title,emoji,image_url,sort_order,is_active) VALUES (?,?,?,?,?)')->execute([$c['title'],$c['emoji']?:'🛒',$c['image_url']??null,(int)$c['sort_order'],(int)$c['is_active']]);$legacy=(int)db()->lastInsertId();db()->prepare('UPDATE store_categories SET legacy_category_id=? WHERE id=?')->execute([$legacy,$storeCategoryId]);return $legacy;
}

function catalog_create_service(array $d): int {
    $name=trim((string)($d['name']??''));if($name==='')throw new RuntimeException('SERVICE_NAME_REQUIRED');
    $categoryId=(int)($d['category_id']??0);if($categoryId<=0){$legacyCat=!empty($d['legacy_category_id'])?(int)$d['legacy_category_id']:null;$categoryId=catalog_upsert_store_category($legacyCat);}
    $legacyCat=catalog_ensure_legacy_category($categoryId);
    db()->prepare('INSERT INTO products (category_id,parent_id,slug,product_type,config_json,name,price,short_description,full_description,delivery_type,is_active,is_featured,sort_order) VALUES (?,NULL,?,"normal",?,?,0,?,?,"manual",1,?,?)')->execute([$legacyCat,catalog_unique_slug('products',$name,'service'),json_encode(['theme'=>$d['theme']??'blue','badge'=>$d['badge']??''],JSON_UNESCAPED_UNICODE),$name,$d['description']??'',$d['description']??'',!empty($d['is_featured'])?1:0,(int)($d['sort_order']??99)]);$legacyProductId=(int)db()->lastInsertId();
    db()->prepare('INSERT INTO services (category_id,legacy_product_id,name,slug,description,image_url,theme,badge,is_featured,is_active,sort_order) VALUES (?,?,?,?,?,?,?,?,?,1,?)')->execute([$categoryId,$legacyProductId,$name,catalog_unique_slug('services',$name,'service'),$d['description']??'',trim((string)($d['image_url']??''))?:null,$d['theme']??'blue',$d['badge']??'',!empty($d['is_featured'])?1:0,(int)($d['sort_order']??99)]);$serviceId=(int)db()->lastInsertId();
    if(empty($d['skip_default_group']))catalog_create_group(['service_id'=>$serviceId,'name'=>'Default Group','is_default'=>1]);
    return $serviceId;
}

function catalog_create_group(array $d): int {
    $serviceId=(int)($d['service_id']??0);$name=trim((string)($d['name']??''));$isDefault=!empty($d['is_default']);if(!$serviceId||$name==='')throw new RuntimeException('GROUP_DATA_REQUIRED');
    $q=db()->prepare('SELECT * FROM services WHERE id=?');$q->execute([$serviceId]);$s=$q->fetch();if(!$s)throw new RuntimeException('SERVICE_NOT_FOUND');
    $legacyService=(int)$s['legacy_product_id'];
    if($isDefault){$legacyProduct=$legacyService;$name='Default Group';$slug='default';}
    else{
        db()->prepare('UPDATE products SET product_type="service_group" WHERE id=?')->execute([$legacyService]);
        $root=shop_product($legacyService);db()->prepare('INSERT INTO products (category_id,parent_id,slug,product_type,name,price,short_description,full_description,delivery_type,is_active,is_featured,sort_order) VALUES (?,?,?,"normal",?,0,?,?,"manual",1,0,?)')->execute([(int)($root['category_id']??0)?:null,$legacyService,catalog_unique_slug('products',$name,'group'),$name,$d['description']??'',$d['description']??'',(int)($d['sort_order']??99)]);$legacyProduct=(int)db()->lastInsertId();$slug=catalog_unique_slug('service_groups',$name,'group');
    }
    $check=db()->prepare('SELECT id FROM service_groups WHERE service_id=? AND is_default=? LIMIT 1');$check->execute([$serviceId,$isDefault?1:0]);$existing=$isDefault?$check->fetch():false;if($existing)return (int)$existing['id'];
    db()->prepare('INSERT INTO service_groups (service_id,legacy_product_id,name,slug,description,is_default,is_active,sort_order) VALUES (?,?,?,?,?,?,1,?)')->execute([$serviceId,$legacyProduct,$name,$slug,$d['description']??'',$isDefault?1:0,(int)($d['sort_order']??99)]);return (int)db()->lastInsertId();
}

function catalog_create_plan(array $d): int {
    $groupId=(int)($d['group_id']??0);$title=trim((string)($d['title']??''));if(!$groupId||$title==='')throw new RuntimeException('PLAN_DATA_REQUIRED');
    $q=db()->prepare('SELECT g.*,s.legacy_product_id service_legacy_product FROM service_groups g JOIN services s ON s.id=g.service_id WHERE g.id=?');$q->execute([$groupId]);$g=$q->fetch();if(!$g)throw new RuntimeException('GROUP_NOT_FOUND');
    $legacyProduct=(int)($g['legacy_product_id']?:$g['service_legacy_product']);
    $price=max(0,(int)($d['price']??0));if($price<=0)throw new RuntimeException('PLAN_PRICE_REQUIRED');
    db()->prepare('INSERT INTO product_variants (product_id,title,price,price_currency,duration_days,discount_percent,description,sort_order,is_active) VALUES (?,?,?,"IRT",?,?,?,?,1)')->execute([$legacyProduct,$title,$price,max(0,(int)($d['duration_days']??0)),max(0,min(100,(float)($d['discount_percent']??0))),$d['description']??'',(int)($d['sort_order']??99)]);$legacyVariant=(int)db()->lastInsertId();
    $product=shop_product($legacyProduct);$variant=product_variant($legacyVariant);return catalog_upsert_plan_from_legacy($groupId,$product,$variant,(int)($d['sort_order']??99));
}

function catalog_fast_create(array $d): array {
    $serviceId=catalog_create_service(['name'=>$d['service_name']??'','category_id'=>(int)($d['category_id']??0),'description'=>$d['description']??'','theme'=>$d['theme']??'blue','badge'=>$d['badge']??'','skip_default_group'=>1]);
    $text=trim((string)($d['groups_text']??''));$lines=array_values(array_filter(array_map('trim',preg_split('/\R/u',$text))));
    if(!$lines)$lines=['Default: '.(string)($d['plans_text']??'')];
    $made=['groups'=>0,'plans'=>0];
    foreach($lines as $line){
        $parts=preg_split('/\s*:\s*/u',$line,2);$groupName=trim($parts[0]??'Default');$planText=trim($parts[1]??'');$isDefault=in_array(mb_strtolower($groupName),['default','plans','پلن','پلن‌ها'],true);
        $gid=catalog_create_group(['service_id'=>$serviceId,'name'=>$isDefault?'Default Group':$groupName,'is_default'=>$isDefault?1:0]);$made['groups']++;
        foreach(array_values(array_filter(array_map('trim',preg_split('/\s*,\s*/u',$planText)))) as $spec){
            $pp=preg_split('/\s*=\s*/u',$spec,2);$title=trim($pp[0]??'');$price=(int)preg_replace('/\D+/','',$pp[1]??'0');if($title!==''&&$price>0){catalog_create_plan(['group_id'=>$gid,'title'=>$title,'price'=>$price]);$made['plans']++;}
        }
    }
    set_setting('catalog_v2_storefront_enabled','1');set_setting('catalog_v2_applied_at',date('Y-m-d H:i:s'));
    return ['ok'=>true,'service_id'=>$serviceId]+$made;
}
