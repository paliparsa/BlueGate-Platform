<?php

function veyra_pro_catalog_scan_legacy(): array {
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


function veyra_pro_catalog_scan_plans_for_product(array $product, array $variants): array {
    $out=[];
    if($variants){
        foreach($variants as $v)$out[]=['title'=>$v['title'],'legacy_product_id'=>(int)$product['id'],'legacy_variant_id'=>(int)$v['id'],'price'=>(int)$v['price'],'is_active'=>(int)$v['is_active']];
    } else {
        $isContainer=in_array(strtolower((string)($product['product_type']??'normal')),['service_group','group','container'],true);
        if(!$isContainer)$out[]=['title'=>$product['name'],'legacy_product_id'=>(int)$product['id'],'legacy_variant_id'=>null,'price'=>(int)$product['price'],'is_active'=>(int)$product['is_active']];
    }
    return $out;
}


function veyra_pro_catalog_upsert_store_category(?int $legacyCategoryId): int {
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


function veyra_pro_catalog_apply_proposal(array $proposal): int {
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
        if($gr){$groupId=(int)$gr['id'];db()->prepare('UPDATE service_groups SET name=?,slug=?,description=?,image_url=?,config_json=?,is_default=?,is_active=?,is_archived=0,sort_order=? WHERE id=?')->execute([$gname,$gslug,$groupProduct['full_description']?:$groupProduct['short_description'],$groupProduct['image_url']??null,$groupProduct['config_json']??null,!empty($gp['is_default'])?1:0,(int)$groupProduct['is_active'],(int)($groupProduct['sort_order']??$gi),$groupId]);}
        else{db()->prepare('INSERT INTO service_groups (service_id,legacy_product_id,name,slug,description,image_url,config_json,is_default,is_active,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)')->execute([$serviceId,$legacyGroupId,$gname,$gslug,$groupProduct['full_description']?:$groupProduct['short_description'],$groupProduct['image_url']??null,$groupProduct['config_json']??null,!empty($gp['is_default'])?1:0,(int)$groupProduct['is_active'],(int)($groupProduct['sort_order']??$gi)]);$groupId=(int)db()->lastInsertId();}
        $variants=product_variants($legacyGroupId,false);
        if($variants){foreach($variants as $vi=>$v)catalog_upsert_plan_from_legacy($groupId,$groupProduct,$v,$vi);}
        else if(!in_array(strtolower((string)($groupProduct['product_type']??'normal')),['service_group','group','container'],true))catalog_upsert_plan_from_legacy($groupId,$groupProduct,null,0);
    }
    return $serviceId;
}


function veyra_pro_catalog_backfill_order_snapshots(): int {
    if(!table_exists('orders')||!column_exists('orders','variant_id')||!column_exists('orders','catalog_plan_id'))return 0;
    $total=0;
    $sql='UPDATE orders o JOIN service_plans p ON p.legacy_variant_id=o.variant_id JOIN service_groups g ON g.id=p.group_id JOIN services s ON s.id=g.service_id SET o.catalog_service_id=s.id,o.catalog_group_id=g.id,o.catalog_plan_id=p.id,o.service_name_snapshot=s.name,o.group_name_snapshot=IF(g.is_default=1,"",g.name),o.plan_name_snapshot=p.title WHERE o.catalog_plan_id IS NULL AND o.variant_id IS NOT NULL';
    $total+=(int)db()->exec($sql);
    $sql='UPDATE orders o JOIN service_plans p ON p.legacy_product_id=o.product_id AND p.legacy_variant_id IS NULL JOIN service_groups g ON g.id=p.group_id JOIN services s ON s.id=g.service_id SET o.catalog_service_id=s.id,o.catalog_group_id=g.id,o.catalog_plan_id=p.id,o.service_name_snapshot=s.name,o.group_name_snapshot=IF(g.is_default=1,"",g.name),o.plan_name_snapshot=p.title WHERE o.catalog_plan_id IS NULL AND o.variant_id IS NULL';
    $total+=(int)db()->exec($sql);
    return $total;
}


function veyra_pro_catalog_apply_legacy_mapping(): array {
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


function veyra_pro_catalog_apply_legacy_product(int $legacyProductId): array {
    $scan=catalog_scan_legacy();$proposal=null;foreach($scan['proposals'] as $p){if((int)$p['legacy_product_id']===$legacyProductId){$proposal=$p;break;}}
    if(!$proposal)throw new RuntimeException('LEGACY_PRODUCT_NOT_FOUND');
    db()->beginTransaction();
    try{$serviceId=catalog_apply_proposal($proposal);$backfilled=catalog_backfill_order_snapshots();set_setting('catalog_v2_storefront_enabled','1');if(!setting('catalog_v2_applied_at',''))set_setting('catalog_v2_applied_at',date('Y-m-d H:i:s'));db()->commit();}
    catch(Throwable $e){if(db()->inTransaction())db()->rollBack();throw $e;}
    return ['ok'=>true,'service_id'=>$serviceId,'orders_backfilled'=>$backfilled];
}


function veyra_pro_catalog_upsert_plan_from_legacy(int $groupId,array $product,?array $variant,int $sort): int {
    $legacyProductId=(int)$product['id'];$legacyVariantId=$variant?(int)$variant['id']:null;$row=$variant?:$product;
    $found=null;
    if($legacyVariantId){$q=db()->prepare('SELECT id FROM service_plans WHERE legacy_variant_id=? LIMIT 1');$q->execute([$legacyVariantId]);$found=$q->fetch();}
    else{$q=db()->prepare('SELECT id FROM service_plans WHERE group_id=? AND legacy_product_id=? AND legacy_variant_id IS NULL LIMIT 1');$q->execute([$groupId,$legacyProductId]);$found=$q->fetch();}
    $title=$variant?$variant['title']:$product['name'];$discount=(float)($variant['discount_percent']??0);$description=$variant?($variant['description']??''):($product['full_description']?:$product['short_description']);
    $args=[$groupId,$legacyProductId,$legacyVariantId,$title,(int)$row['price'],$row['price_currency']??'IRT',$row['price_usd']??null,$row['price_rate_toman']??null,$row['price_rate_source']??null,$row['price_rate_updated_at']??null,(int)($row['duration_days']??0),$discount,$description,$product['delivery_type']??'manual',$product['commission_type']??'none',(int)($product['commission_value']??0),(int)($row['is_active']??1),(int)($row['sort_order']??$sort)];
    if($found){$id=(int)$found['id'];db()->prepare('UPDATE service_plans SET group_id=?,legacy_product_id=?,legacy_variant_id=?,title=?,price=?,price_currency=?,price_usd=?,price_rate_toman=?,price_rate_source=?,price_rate_updated_at=?,duration_days=?,discount_percent=?,description=?,delivery_type=?,commission_type=?,commission_value=?,is_active=?,is_archived=0,sort_order=? WHERE id=?')->execute([...$args,$id]);return $id;}
    db()->prepare('INSERT INTO service_plans (group_id,legacy_product_id,legacy_variant_id,title,price,price_currency,price_usd,price_rate_toman,price_rate_source,price_rate_updated_at,duration_days,discount_percent,description,delivery_type,commission_type,commission_value,is_active,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')->execute($args);return (int)db()->lastInsertId();
}


function veyra_pro_catalog_move_group(int $groupId,int $serviceId): void {
    $q=db()->prepare('SELECT * FROM service_groups WHERE id=?');$q->execute([$groupId]);$g=$q->fetch();if(!$g)throw new RuntimeException('زیرسرویس پیدا نشد.');if((int)$g['is_default']===1)throw new RuntimeException('پلن‌های مستقیم قابل انتقال به عنوان زیرسرویس نیستند.');
    $q=db()->prepare('SELECT * FROM services WHERE id=?');$q->execute([$serviceId]);$s=$q->fetch();if(!$s)throw new RuntimeException('سرویس مقصد پیدا نشد.');
    db()->prepare('UPDATE service_groups SET service_id=? WHERE id=?')->execute([$serviceId,$groupId]);
    if(!empty($g['legacy_product_id'])){
        $legacyCat=catalog_ensure_legacy_category((int)$s['category_id']);
        db()->prepare('UPDATE products SET parent_id=?,category_id=? WHERE id=?')->execute([(int)$s['legacy_product_id'],$legacyCat,(int)$g['legacy_product_id']]);
    }
}


function veyra_pro_catalog_move_plan(int $planId,int $groupId): void {
    $q=db()->prepare('SELECT * FROM service_plans WHERE id=?');$q->execute([$planId]);$p=$q->fetch();if(!$p)throw new RuntimeException('پلن پیدا نشد.');
    $q=db()->prepare('SELECT g.*,s.legacy_product_id service_legacy_product FROM service_groups g JOIN services s ON s.id=g.service_id WHERE g.id=?');$q->execute([$groupId]);$g=$q->fetch();if(!$g)throw new RuntimeException('زیرسرویس مقصد پیدا نشد.');
    $legacyProduct=(int)($g['legacy_product_id']?:$g['service_legacy_product']);
    db()->prepare('UPDATE service_plans SET group_id=?,legacy_product_id=? WHERE id=?')->execute([$groupId,$legacyProduct,$planId]);
    if(!empty($p['legacy_variant_id']))db()->prepare('UPDATE product_variants SET product_id=? WHERE id=?')->execute([$legacyProduct,(int)$p['legacy_variant_id']]);
}

