<?php
/**
 * BlueGate Storefront integration helpers.
 * Keeps the BlueReferral commerce engine as the source of truth while exposing
 * the dedicated BlueGate V9 storefront catalog and dynamic Stars ordering.
 */

function storefront_json($value, array $fallback=[]): array {
    if (is_array($value)) return $value;
    $decoded = json_decode((string)$value, true);
    return is_array($decoded) ? $decoded : $fallback;
}

function storefront_settings_payload(): array {
    $manual = crypto_manual_rates();
    $usdt = crypto_rate_toman('USDT', false);
    if ($usdt <= 0) $usdt = (float)($manual['USDT'] ?? 0);
    if ($usdt <= 0) $usdt = (float)setting('storefront_fallback_usdt_toman', '192000');

    return [
        'brand_name' => setting('brand_name', app_config('BRAND_NAME', 'BlueGate')),
        'brand_subtitle' => setting('storefront_brand_subtitle', 'Digital Services'),
        'hero_title' => setting('storefront_hero_title', 'سرویس‌های دیجیتال، ساده و سریع'),
        'hero_text' => setting('storefront_hero_text', 'VPN، تلگرام استارز و تلگرام پرمیوم با قیمت شفاف و سفارش مستقیم.'),
        'telegram_support' => setting('support_username', app_config('SUPPORT_USERNAME', 'BlueGateSupport')),
        'telegram_channel' => setting('storefront_telegram_channel', app_config('CHANNEL_USERNAME', 'BllueGate')),
        'announcement_enabled' => setting_bool('storefront_announcement_enabled', true),
        'announcement_text' => setting('storefront_announcement_text', 'سرویس موردنظرت رو انتخاب کن؛ سفارش داخل حساب BlueGate ثبت و پیگیری می‌شود.'),
        'footer_text' => setting('storefront_footer_text', 'سرویس‌های دیجیتال با پشتیبانی واقعی.'),
        'stars_price_basis' => setting('storefront_stars_price_basis', 'toman'),
        'star_sell_per_unit_usdt' => (float)setting('storefront_star_sell_per_unit_usdt', '0.018'),
        'star_sell_per_unit_toman' => (float)setting('storefront_star_sell_per_unit_toman', '3456'),
        'slider_min' => max(1, setting_int('storefront_stars_min', 50)),
        'slider_max' => max(1, setting_int('storefront_stars_max', 10000)),
        'slider_step' => max(1, setting_int('storefront_stars_step', 25)),
        'slider_presets' => storefront_json(setting('storefront_stars_presets', '[100,500,1000,2500,5000]'), [100,500,1000,2500,5000]),
        'smart_rounding_enabled' => setting_bool('storefront_smart_rounding_enabled', true),
        'round_small' => setting_int('storefront_round_small', 5000),
        'round_medium' => setting_int('storefront_round_medium', 10000),
        'round_large' => setting_int('storefront_round_large', 20000),
        'fallback_usdt_toman' => $usdt,
        'show_reviews' => setting_bool('storefront_show_reviews', true),
        'show_tutorials' => setting_bool('storefront_show_tutorials', false),
        'show_comparison' => setting_bool('storefront_show_comparison', true),
    ];
}

function storefront_rates_payload(): array {
    $usdtMeta = crypto_rate_meta('USDT');
    $trxMeta = crypto_rate_meta('TRX');
    $tonMeta = crypto_rate_meta('TON');
    $usdt = (float)($usdtMeta['rate'] ?? 0);
    if ($usdt <= 0) $usdt = (float)setting('storefront_fallback_usdt_toman', '192000');
    $trxToman = (float)($trxMeta['rate'] ?? 0);
    $tonToman = (float)($tonMeta['rate'] ?? 0);
    return [
        'usdt_toman' => $usdt,
        'trx_usd' => ($trxToman > 0 && $usdt > 0) ? $trxToman / $usdt : null,
        'ton_usd' => ($tonToman > 0 && $usdt > 0) ? $tonToman / $usdt : null,
        'source' => (string)($usdtMeta['source'] ?? 'manual'),
        'checked_at' => $usdtMeta['updated_at'] ?? date('c'),
        'stale' => empty($usdtMeta['is_live']),
    ];
}

function storefront_content_payload(): array {
    return [
        'features' => storefront_json(setting('storefront_features', ''), [
            ['icon'=>'⚡','title'=>'تحویل سریع','text'=>'سفارش در سیستم ثبت می‌شود و وضعیت آن را از حساب کاربری پیگیری می‌کنی.'],
            ['icon'=>'🎧','title'=>'پشتیبانی مستقیم','text'=>'قبل و بعد از خرید به پشتیبانی BlueGate دسترسی داری.'],
            ['icon'=>'💰','title'=>'کیف پول و رفرال','text'=>'اعتبار کیف پول و پورسانت دعوت دوستان روی همان حساب قابل استفاده است.'],
            ['icon'=>'✓','title'=>'پرداخت یکپارچه','text'=>'کارت، کیف پول و روش‌های فعال دیگر از یک سفارش واقعی استفاده می‌کنند.'],
        ]),
        'faq' => storefront_json(setting('storefront_faq', ''), [
            ['q'=>'بعد از ثبت سفارش چه اتفاقی می‌افتد؟','a'=>'سفارش با شماره واقعی در حساب شما ثبت می‌شود؛ روش پرداخت را انتخاب می‌کنی و وضعیت را تا تحویل می‌بینی.'],
            ['q'=>'برای خرید باید حساب داشته باشم؟','a'=>'بله؛ حساب باعث می‌شود سفارش، کیف پول و پاداش رفرال روی یک پروفایل واحد ذخیره شوند.'],
            ['q'=>'اعتبار BlueGate قابل استفاده است؟','a'=>'بله؛ اگر روش اعتبار فعال باشد، می‌توانی بخشی یا تمام مبلغ سفارش را با اعتبار حساب خود پرداخت کنی.'],
        ]),
        'reviews' => storefront_json(setting('storefront_reviews', ''), [
            ['name'=>'مشتری BlueGate','rating'=>5,'text'=>'ثبت و پیگیری سفارش خیلی واضح‌تر شده و همه چیز داخل حساب می‌ماند.'],
            ['name'=>'کاربر BluePing','rating'=>5,'text'=>'انتخاب پلن سریع است و وضعیت سفارش بعد از پرداخت قابل مشاهده است.'],
            ['name'=>'مشتری Telegram','rating'=>5,'text'=>'قیمت و جزئیات قبل از ثبت مشخص است و خرید داخل همان حساب انجام می‌شود.'],
        ]),
        'tutorials' => storefront_json(setting('storefront_tutorials', ''), []),
        'comparison' => storefront_json(setting('storefront_comparison', ''), []),
    ];
}

function storefront_product_config(array $product): array {
    return storefront_json($product['config_json'] ?? '', []);
}

function storefront_round_amount(float $amount): int {
    if (!setting_bool('storefront_smart_rounding_enabled', true)) return (int)ceil($amount);
    if ($amount < 1000000) $step = max(1, setting_int('storefront_round_small', 5000));
    elseif ($amount <= 10000000) $step = max(1, setting_int('storefront_round_medium', 10000));
    else $step = max(1, setting_int('storefront_round_large', 20000));
    return (int)(ceil(($amount - 0.0000001) / $step) * $step);
}

function storefront_stars_amount(int $stars): int {
    $min = max(1, setting_int('storefront_stars_min', 50));
    $max = max($min, setting_int('storefront_stars_max', 10000));
    $step = max(1, setting_int('storefront_stars_step', 25));
    if ($stars < $min || $stars > $max || (($stars - $min) % $step !== 0 && $stars !== $max)) {
        throw new RuntimeException('INVALID_STARS_AMOUNT');
    }
    // Always follow the same USDT/Toman provider chain used by crypto rates.
    // The old Toman value stays as a last-resort fallback only.
    $meta = storefront_star_rate_meta();
    $unit = (float)($meta['rate'] ?? 0);
    if ($unit <= 0) throw new RuntimeException('STARS_RATE_NOT_AVAILABLE');
    return storefront_round_amount($stars * $unit);
}

function storefront_quote_amount(int $productId, ?int $variantId=null, ?int $starsCount=null): array {
    $p=shop_product($productId);
    if(!$p||(int)$p['is_active']!==1)throw new RuntimeException('PRODUCT_NOT_FOUND');
    $type=strtolower((string)($p['product_type']??'normal'));
    if(in_array($type,['service_group','group','container'],true))throw new RuntimeException('PRODUCT_IS_CONTAINER');
    if($type==='stars'){
        $stars=(int)($starsCount??0);
        return ['product_id'=>$productId,'variant_id'=>null,'amount'=>storefront_stars_amount($stars),'stars_count'=>$stars];
    }
    $variants=product_variants($productId,true);
    $variant=null;
    if($variantId){
        foreach($variants as $v){if((int)$v['id']===(int)$variantId){$variant=$v;break;}}
        if(!$variant)throw new RuntimeException('VARIANT_NOT_FOUND');
    }elseif($variants){
        throw new RuntimeException('VARIANT_REQUIRED');
    }
    $meta=price_runtime_meta($variant?:$p);
    return ['product_id'=>$productId,'variant_id'=>$variant?(int)$variant['id']:null,'amount'=>(int)($meta['toman']??0),'stars_count'=>null];
}

function preview_storefront_coupon(int $userId,string $code,int $productId,?int $variantId=null,?int $starsCount=null): array {
    $code=normalize_coupon_code($code);
    if($code==='')throw new RuntimeException('کد تخفیف را وارد کن.');
    $quote=storefront_quote_amount($productId,$variantId,$starsCount);
    $coupon=coupon_by_code($code);
    $discount=calculate_coupon_discount($coupon,(int)$quote['amount'],$userId,$productId);
    return [
        'code'=>(string)$coupon['code'],
        'amount'=>(int)$quote['amount'],
        'discount_amount'=>$discount,
        'final_amount'=>max(0,(int)$quote['amount']-$discount),
    ];
}

function create_storefront_order(int $userId, int $productId, ?int $variantId=null, ?int $starsCount=null): array {
    $p = shop_product($productId);
    if (!$p || (int)$p['is_active'] !== 1) throw new RuntimeException('PRODUCT_NOT_FOUND');
    $type = strtolower((string)($p['product_type'] ?? 'normal'));
    if (in_array($type, ['service_group','group','container'], true)) throw new RuntimeException('PRODUCT_IS_CONTAINER');
    if ($type !== 'stars') return create_shop_order($userId, $productId, $variantId);

    cancel_expired_orders();
    $stars = (int)($starsCount ?? 0);
    $amount = storefront_stars_amount($stars);
    $paymentExpiresAt = date('Y-m-d H:i:s', time() + setting_int('order_expiry_minutes', 20) * 60);
    db()->prepare('INSERT INTO orders (user_id, product_id, variant_id, amount, final_amount, price_currency, status, stars_amount, payment_expires_at, customer_note) VALUES (?,?,?,?,?,?,?,?,?,?)')
        ->execute([$userId,$productId,null,$amount,$amount,'IRT','pending_payment',$stars,$paymentExpiresAt,$stars.' Telegram Stars']);
    $orderId = (int)db()->lastInsertId();
    if (function_exists('catalog_order_snapshot')) {
        try { catalog_order_snapshot($orderId, $productId, null); } catch (Throwable $e) {}
    }
    add_order_event($orderId, 'pending_payment', 'سفارش Stars ثبت شد', number_format($stars).' Stars / '.money($amount));
    return order_by_id($orderId);
}

function storefront_find_or_create_category(string $title, string $emoji, int $sort): int {
    $q = db()->prepare('SELECT id FROM product_categories WHERE title=? LIMIT 1');
    $q->execute([$title]);
    $id = (int)($q->fetchColumn() ?: 0);
    if ($id) {
        db()->prepare('UPDATE product_categories SET emoji=?, sort_order=?, is_active=1 WHERE id=?')->execute([$emoji,$sort,$id]);
        return $id;
    }
    db()->prepare('INSERT INTO product_categories (title,emoji,sort_order,is_active) VALUES (?,?,?,1)')->execute([$title,$emoji,$sort]);
    return (int)db()->lastInsertId();
}

function storefront_upsert_product(array $data): int {
    $slug = (string)$data['slug'];
    $name = (string)$data['name'];
    $q = db()->prepare('SELECT id FROM products WHERE slug=? OR (slug IS NULL AND name=?) ORDER BY id ASC LIMIT 1');
    $q->execute([$slug,$name]);
    $id = (int)($q->fetchColumn() ?: 0);
    $config = json_encode($data['config'] ?? [], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    if ($id) {
        db()->prepare('UPDATE products SET category_id=?, parent_id=?, slug=?, product_type=?, config_json=?, name=?, price=?, short_description=?, full_description=?, delivery_type=?, is_active=1, is_featured=?, sort_order=? WHERE id=?')
            ->execute([$data['category_id'],$data['parent_id']??null,$slug,$data['product_type'],$config,$name,(int)($data['price']??1),$data['short_description']??'', $data['full_description']??'', $data['delivery_type']??'manual',(int)($data['is_featured']??0),(int)($data['sort_order']??0),$id]);
        return $id;
    }
    db()->prepare('INSERT INTO products (category_id,parent_id,slug,product_type,config_json,name,price,short_description,full_description,delivery_type,is_active,is_featured,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,1,?,?)')
        ->execute([$data['category_id'],$data['parent_id']??null,$slug,$data['product_type'],$config,$name,(int)($data['price']??1),$data['short_description']??'', $data['full_description']??'', $data['delivery_type']??'manual',(int)($data['is_featured']??0),(int)($data['sort_order']??0)]);
    return (int)db()->lastInsertId();
}

function storefront_sync_variants(int $productId, array $variants): void {
    foreach ($variants as $idx=>$v) {
        $title = (string)$v['title'];
        $q=db()->prepare('SELECT id FROM product_variants WHERE product_id=? AND title=? LIMIT 1');
        $q->execute([$productId,$title]);
        $id=(int)($q->fetchColumn() ?: 0);
        $price=(int)($v['price']??0);
        $currency=strtoupper((string)($v['price_currency']??'IRT'));
        $usd=isset($v['price_usd'])?(float)$v['price_usd']:null;
        if ($id) {
            db()->prepare('UPDATE product_variants SET price=?, price_currency=?, price_usd=?, duration_days=?, description=?, sort_order=?, is_active=1 WHERE id=?')
                ->execute([$price,$currency,$usd,(int)($v['duration_days']??0),$v['description']??'',(int)($v['sort_order']??($idx+1)),$id]);
        } else {
            db()->prepare('INSERT INTO product_variants (product_id,title,price,price_currency,price_usd,duration_days,description,sort_order,is_active) VALUES (?,?,?,?,?,?,?,?,1)')
                ->execute([$productId,$title,$price,$currency,$usd,(int)($v['duration_days']??0),$v['description']??'',(int)($v['sort_order']??($idx+1))]);
        }
    }
}

function seed_bluegate_storefront_catalog(): void {
    if (!table_exists('products') || !column_exists('products','slug')) return;

    $vpnCat = storefront_find_or_create_category('VPN', '🛡️', 10);
    $tgCat = storefront_find_or_create_category('Telegram', '✈️', 20);

    // v1.8 hierarchy migration runs once. After that MySQL/Admin is the source of truth.
    if (!setting_bool('storefront_catalog_hierarchy_v2', false)) {
        $blueping = storefront_upsert_product([
            'category_id'=>$vpnCat,'parent_id'=>null,'slug'=>'blueping','product_type'=>'service_group','name'=>'BluePing','price'=>0,'sort_order'=>5,'is_featured'=>1,
            'short_description'=>'سرویس VPN BlueGate با زیرسرویس‌ها و پلن‌های قابل مدیریت از پنل',
            'full_description'=>'زیرسرویس‌های BluePing مثل Standard و Pro محصول مستقل هستند و از دیتابیس خوانده می‌شوند.',
            'delivery_type'=>'vpn','config'=>['service_kind'=>'vpn','theme'=>'blue','icon'=>'🛡️','badge'=>'BluePing VPN','benefits'=>['زیرسرویس‌های قابل مدیریت','پلن‌های دیتابیس‌محور','مدیریت از حساب BlueGate']]
        ]);
        db()->prepare('UPDATE products SET parent_id=?, category_id=? WHERE product_type="vpn" AND id<>? AND (parent_id IS NULL OR parent_id=0)')->execute([$blueping,$vpnCat,$blueping]);
        set_setting('storefront_catalog_hierarchy_v2', '1');
    }

    // Legacy fresh-install seed for non-VPN core services only. VPN children are always admin/data driven.
    if (!setting_bool('storefront_catalog_seeded_v1', false)) {
        storefront_upsert_product([
            'category_id'=>$tgCat,'parent_id'=>null,'slug'=>'telegram-stars','product_type'=>'stars','name'=>'Telegram Stars','price'=>3456,'sort_order'=>40,'is_featured'=>1,
            'short_description'=>'تعداد دلخواه با محاسبه قیمت سمت سرور','full_description'=>'مقدار Stars هنگام ثبت سفارش انتخاب می‌شود و مبلغ نهایی در بک‌اند محاسبه می‌شود.','delivery_type'=>'manual','config'=>['icon'=>'⭐']
        ]);
        $premium = storefront_upsert_product([
            'category_id'=>$tgCat,'parent_id'=>null,'slug'=>'telegram-premium','product_type'=>'premium','name'=>'Telegram Premium','price'=>1,'sort_order'=>50,
            'short_description'=>'اشتراک رسمی ۳، ۶ و ۱۲ ماهه تلگرام','full_description'=>'انتخاب مدت اشتراک و ثبت سفارش در حساب BlueGate.','delivery_type'=>'manual','config'=>['icon'=>'✈️']
        ]);
        storefront_sync_variants($premium, [
            ['title'=>'3 ماهه','price'=>0,'price_currency'=>'USD','price_usd'=>14.388,'duration_days'=>90],
            ['title'=>'6 ماهه','price'=>0,'price_currency'=>'USD','price_usd'=>19.188,'duration_days'=>180],
            ['title'=>'12 ماهه','price'=>0,'price_currency'=>'USD','price_usd'=>34.788,'duration_days'=>365],
        ]);
        set_setting('storefront_catalog_seeded_v1', '1');
    }
}
