<?php
require_once __DIR__ . '/bootstrap.php';
// Do not run migrations on every webhook/API request. Use install.php or blue-ref.

function handle_update(array $update): void {
    if (isset($update['pre_checkout_query'])) {
        handle_pre_checkout($update['pre_checkout_query']);
        return;
    }
    if (isset($update['callback_query'])) {
        handle_callback($update['callback_query']);
        return;
    }
    if (isset($update['message'])) {
        handle_message($update['message']);
        return;
    }
}


function handle_pre_checkout(array $q): void {
    tg('answerPreCheckoutQuery', ['pre_checkout_query_id'=>$q['id'], 'ok'=>true]);
}
function handle_successful_payment(int $chat_id, array $payment): void {
    $payload=(string)($payment['invoice_payload'] ?? '');
    $order=confirm_stars_payment($payload, $payment);
    if ($order) {
        send_msg($chat_id, "✅ پرداخت Stars سفارش <code>#{$order['id']}</code> تایید شد.\nسفارش شما برای آماده‌سازی ثبت شد.", main_menu_keyboard(is_admin($chat_id)));
        notify_admins("⭐️ پرداخت Telegram Stars تایید شد\nسفارش: <code>#{$order['id']}</code>\nکاربر: <code>{$chat_id}</code>\nمبلغ: <b>{$order['stars_amount']} Stars</b>");
    }
}

function send_home_message(int $chat_id, array $user, bool $withKeyboard=true): void {
    send_msg($chat_id, main_text($user), miniapp_inline_keyboard(is_admin($chat_id)));
    if ($withKeyboard) send_msg($chat_id, 'منوی پایین همیشه در دسترسه 👇', main_menu_keyboard(is_admin($chat_id)));
}
function save_user_contact_from_message(int $chat_id, array $message): bool {
    if (empty($message['contact']) || !is_array($message['contact'])) return false;
    $contact = $message['contact'];
    $contactUserId = (int)($contact['user_id'] ?? 0);
    if ($contactUserId && $contactUserId !== $chat_id) return false;
    $phone = trim((string)($contact['phone_number'] ?? ''));
    if ($phone === '') return false;
    db()->prepare('UPDATE users SET phone_number=?, phone_verified_at=NOW() WHERE telegram_id=?')->execute([$phone, $chat_id]);
    return true;
}
function contact_required_for_user(array $user): bool {
    return setting_bool('require_contact_auth', false) && empty($user['phone_number']);
}
function maybe_notify_new_start(array $user): void {
    if (!setting_bool('notify_new_user', true)) return;
    if ((int)($user['start_notified'] ?? 0) === 1) return;
    $ref = 'بدون معرف';
    if (!empty($user['referrer_id'])) { $r = get_user_by_id((int)$user['referrer_id']); if ($r) $ref = '@'.($r['username'] ?: 'بدون یوزرنیم').' | <code>'.$r['telegram_id'].'</code>'; }
    $name = trim(($user['first_name'] ?? '').' '.($user['last_name'] ?? '')) ?: 'بدون نام';
    $username = !empty($user['username']) ? '@'.$user['username'] : 'بدون یوزرنیم';
    $phone = !empty($user['phone_number']) ? $user['phone_number'] : 'ثبت نشده';
    notify_admins("🆕 <b>عضو جدید ربات</b>

نام: <b>".h($name)."</b>
یوزرنیم: <b>".h($username)."</b>
آیدی: <code>{$user['telegram_id']}</code>
شماره: <code>".h($phone)."</code>
کد دعوت: <code>".h($user['ref_code'])."</code>
معرف: {$ref}
موجودی: <b>".money((int)$user['balance'])."</b>
تاریخ عضویت: <code>{$user['created_at']}</code>");
    db()->prepare('UPDATE users SET start_notified=1 WHERE id=?')->execute([(int)$user['id']]);
}

function handle_message(array $message): void {
    $chat_id = (int)($message['chat']['id'] ?? 0);
    $from = $message['from'] ?? [];
    if (!$chat_id || !$from) return;
    if (!empty($message['successful_payment']) && is_array($message['successful_payment'])) {
        handle_successful_payment($chat_id, $message['successful_payment']);
        return;
    }
    $text = trim((string)($message['text'] ?? ''));

    $ref = null;
    if (str_starts_with($text, '/start')) {
        $parts = explode(' ', $text, 2);
        $payload = $parts[1] ?? '';
        if (str_starts_with($payload, 'ref_')) $ref = substr($payload, 4);
        elseif ($payload !== '') $ref = $payload;
    }

    $user = create_or_update_user($from, $ref);

    if (is_admin($chat_id) && in_array(strtolower($text), ['/backup','backup','/adminbackup'], true)) {
        try { $b = blue_backup_send_to_admin($chat_id); send_msg($chat_id, "✅ بکاپ ساخته و همینجا ارسال شد.
فایل: <code>".h($b['filename'])."</code>", admin_keyboard()); }
        catch (Throwable $e) { send_msg($chat_id, '❌ ساخت/ارسال بکاپ شکست خورد: <code>'.h($e->getMessage()).'</code>', admin_keyboard()); }
        return;
    }
    if (is_admin($chat_id) && in_array(strtolower($text), ['/restore_backup','restore_backup','restore'], true)) {
        set_step($chat_id, 'admin_restore_backup');
        send_msg($chat_id, "⚠️ Restore بکاپ همه دیتابیس فعلی را جایگزین می‌کند.
قبل از restore، سیستم خودکار یک safety backup می‌سازد.

فایل <code>.json.gz</code> بکاپ را همینجا به صورت Document بفرست.", admin_keyboard());
        return;
    }
    if (is_admin($chat_id) && ($user['step'] ?? '') === 'admin_restore_backup' && !empty($message['document']['file_id'])) {
        $tmp = blue_backup_dir() . '/telegram-restore-' . date('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.json.gz';
        try {
            if (!telegram_download_file((string)$message['document']['file_id'], $tmp)) throw new RuntimeException('TELEGRAM_FILE_DOWNLOAD_FAILED');
            $res = blue_backup_restore_from_file($tmp, true);
            @unlink($tmp);
            clear_step($chat_id);
            send_msg($chat_id, "✅ Restore انجام شد.
Tables: <b>{$res['tables']}</b>
Rows: <b>{$res['restored_rows']}</b>", admin_keyboard());
        } catch (Throwable $e) {
            @unlink($tmp);
            clear_step($chat_id);
            send_msg($chat_id, '❌ Restore شکست خورد: <code>'.h($e->getMessage()).'</code>', admin_keyboard());
        }
        return;
    }

    if (save_user_contact_from_message($chat_id, $message)) {
        $user = get_user_by_tid($chat_id);
        maybe_notify_new_start($user);
        send_msg($chat_id, '✅ شماره شما ثبت شد. خوش آمدی!', main_menu_keyboard(is_admin($chat_id)));
    }

    if (contact_required_for_user($user)) {
        send_msg($chat_id, '📱 برای ادامه، لطفاً شماره موبایل تلگرام خودت را با دکمه زیر ارسال کن.', contact_request_keyboard());
        return;
    }

    if (!is_joined_channel($chat_id)) {
        send_msg($chat_id, "برای فعال شدن رفرال، اول داخل کانال عضو شو و بعد دکمه «عضو شدم» رو بزن 👇", force_join_keyboard());
        return;
    }
    try_reward_referrer(get_user_by_tid($chat_id));
    $user = get_user_by_tid($chat_id);

    if (str_starts_with($text, '/start')) {
        clear_step($chat_id);
        $user = get_user_by_tid($chat_id);
        maybe_notify_new_start($user);
        send_home_message($chat_id, $user);
        return;
    }

    // No public command flow. Any free text is interpreted only when a button has opened an input step.
    if (!empty($user['step'])) {
        handle_step_message($chat_id, $user, $message);
        return;
    }

    if (handle_keyboard_text($chat_id, $user, $text)) return;

    send_msg($chat_id, "برای استفاده از امکانات ربات لطفاً مینی اپلیکیشن را باز کنید 👇", main_menu_keyboard(is_admin($chat_id)));
}


function handle_keyboard_text(int $chat_id, array $user, string $text): bool {
    $map = [
        '🏠 صفحه اول'=>'main', '🛒 فروشگاه'=>'u_shop', '🧾 سفارش‌های من'=>'u_orders', '👤 پروفایل و کیف پول'=>'u_wallet',
        '👥 دعوت و درآمد'=>'u_ref', '🏆 لیدربورد'=>'u_leaderboard', '🎯 مأموریت‌ها'=>'u_missions', '🎡 گردونه شانس'=>'u_spin',
        '🏧 برداشت'=>'u_withdraw', '📞 پشتیبانی'=>'u_support',
    ];
    $adminMap = [
        '⚙️ پنل ادمین'=>'adm_home', '🛒 مدیریت فروشگاه'=>'adm_shop', '📈 آمار کل'=>'adm_stats', '🏧 برداشت‌ها'=>'adm_withdrawals',
        '💸 تغییر موجودی'=>'adm_balance', '🎁 پاداش خرید'=>'adm_purchase', '⚙️ تنظیمات پاداش‌ها'=>'adm_settings', '🎨 تنظیم رنگ‌ها'=>'adm_theme',
        '📢 پیام همگانی'=>'adm_broadcast', '🏆 لیدربورد ادمین'=>'adm_leaderboard', '💾 بکاپ'=>'adm_backup',
    ];
    if (isset($map[$text])) {
        if ($map[$text] === 'main') { clear_step($chat_id); send_home_message($chat_id, get_user_by_tid($chat_id), false); return true; }
        handle_user_callback($chat_id, null, $user, $map[$text]); return true;
    }
    if (is_admin($chat_id) && isset($adminMap[$text])) { handle_admin_callback($chat_id, null, $user, $adminMap[$text]); return true; }
    return false;
}

function handle_callback(array $cb): void {
    $id = $cb['id'];
    $data = (string)($cb['data'] ?? '');
    $from = $cb['from'] ?? [];
    $chat_id = (int)($cb['message']['chat']['id'] ?? $from['id'] ?? 0);
    $message_id = $cb['message']['message_id'] ?? null;
    if (!$chat_id || !$from) return;
    answer_cb($id);
    $user = create_or_update_user($from, null);

    if ($data === 'check_join') {
        if (!is_joined_channel($chat_id)) {
            send_msg($chat_id, "هنوز عضویت شما تأیید نشد. بعد از عضویت دوباره امتحان کن.", force_join_keyboard());
            return;
        }
        try_reward_referrer(get_user_by_tid($chat_id));
        $user = get_user_by_tid($chat_id);
        maybe_notify_new_start($user);
        send_msg($chat_id, "✅ عضویت تأیید شد. خوش اومدی!", main_menu_keyboard(is_admin($chat_id)));
        send_home_message($chat_id, $user, false);
        return;
    }

    if (!is_joined_channel($chat_id)) {
        send_msg($chat_id, "برای فعال شدن رفرال، اول داخل کانال عضو شو و بعد دکمه «عضو شدم» رو بزن 👇", force_join_keyboard());
        return;
    }
    try_reward_referrer($user);
    $user = get_user_by_tid($chat_id);

    if ($data === 'main') { clear_step($chat_id); send_or_edit($chat_id, $message_id, main_text($user), miniapp_inline_keyboard(is_admin($chat_id))); return; }
    if (str_starts_with($data, 'u_') || str_starts_with($data, 'shop_') || str_starts_with($data, 'order_')) { handle_user_callback($chat_id, $message_id, $user, $data); return; }
    if (str_starts_with($data, 'adm_') || str_starts_with($data, 'set_') || str_starts_with($data, 'theme_') || str_starts_with($data, 'wd_') || str_starts_with($data, 'prod_') || str_starts_with($data, 'cat_') || str_starts_with($data, 'coupon_') || str_starts_with($data, 'ord_') || str_starts_with($data, 'prodwiz_') || str_starts_with($data, 'catwiz_') || str_starts_with($data, 'varwiz_') || str_starts_with($data, 'invwiz_') || str_starts_with($data, 'inv_') || str_starts_with($data, 'variant_') || str_starts_with($data, 'edit_') || str_starts_with($data, 'hard_') || str_starts_with($data, 'toggle_')) {
        if (!is_admin($chat_id)) { send_msg($chat_id, 'دسترسی ادمین ندارید.'); return; }
        handle_admin_callback($chat_id, $message_id, $user, $data); return;
    }
}

function send_or_edit(int $chat_id, $message_id, string $text, ?string $markup=null): void {
    $decoded = $markup ? json_decode($markup, true) : null;
    if ($message_id && is_array($decoded) && isset($decoded['keyboard'])) {
        send_msg($chat_id, $text, $markup);
        return;
    }
    if ($message_id) edit_msg($chat_id, $message_id, $text, $markup);
    else send_msg($chat_id, $text, $markup);
}

function handle_user_callback(int $chat_id, $message_id, array $user, string $data): void {
    if ($data === 'u_ref') {
        $link = referral_link($user);
        $spinEvery = setting_int('spin_referrals_per_chance', 5);
        $txt = "👥 <b>لینک دعوت اختصاصی شما</b>\n\n<code>{$link}</code>\n\n💰 پاداش هر دعوت معتبر: <b>".money(setting_int('start_reward', 2000))."</b>\n🎡 هر <b>{$spinEvery}</b> دعوت معتبر = ۱ شانس گردونه\n\nاین لینک را برای دوستات بفرست؛ ورود با لینک شما، زیرمجموعه شما ثبت می‌شود.";
        send_or_edit($chat_id, $message_id, $txt, back_main_keyboard()); return;
    }
    if ($data === 'u_wallet') {
        $txt = "💰 <b>کیف پول شما</b>\n\nموجودی قابل برداشت: <b>".money($user['balance'])."</b>\nکل درآمد: <b>".money($user['total_earned'])."</b>\nکل برداشت موفق: <b>".money($user['total_withdrawn'])."</b>\nشانس گردونه: <b>{$user['spin_balance']}</b>\n\n".vip_line($user);
        send_or_edit($chat_id, $message_id, $txt, json_markup(['inline_keyboard'=>[[['text'=>'🏧 ثبت برداشت', 'callback_data'=>'u_withdraw']], [['text'=>'🔙 بازگشت', 'callback_data'=>'main']]]])); return;
    }
    if ($data === 'u_stats') {
        $today = today_referrals((int)$user['id']);
        $txt = "📊 <b>آمار همکاری شما</b>\n\nکل زیرمجموعه‌ها: <b>{$user['referrals_count']}</b>\nدعوت‌های امروز: <b>{$today}</b>\nموجودی: <b>".money($user['balance'])."</b>\nشانس گردونه: <b>{$user['spin_balance']}</b>\n\n".vip_line($user);
        send_or_edit($chat_id, $message_id, $txt, back_main_keyboard()); return;
    }
    if ($data === 'u_leaderboard') {
        $rows = top_users(10); $out = "🏆 <b>لیدربورد همکاری</b>\n\n"; $i=1;
        foreach ($rows as $r) { $medal = $i===1?'🥇':($i===2?'🥈':($i===3?'🥉':$i.'.')); $out .= "{$medal} ".display_name($r)." — <b>{$r['referrals_count']}</b> دعوت | ".money($r['total_earned'])."\n"; $i++; }
        if (!$rows) $out .= 'هنوز کسی وارد لیدربورد نشده.';
        send_or_edit($chat_id, $message_id, $out, back_main_keyboard()); return;
    }
    if ($data === 'u_missions') {
        [$todayCount, $claimed] = claim_available_missions($user);
        $user = get_user_by_tid($chat_id);
        $today = date('Y-m-d');
        $out = "🎯 <b>مأموریت روزانه</b>\n\nدعوت‌های امروز شما: <b>{$todayCount}</b>\n\n";
        foreach (mission_rows() as $m) {
            if ($m['target'] <= 0 || $m['reward'] <= 0) continue;
            $done = $todayCount >= $m['target'];
            $claimedBefore = is_mission_claimed((int)$user['id'], $today, (int)$m['target']);
            $icon = $claimedBefore ? '✅' : ($done ? '🎁' : '⏳');
            $out .= "{$icon} {$m['target']} دعوت امروز = <b>".money($m['reward'])."</b>" . ($claimedBefore ? ' | دریافت شد' : '') . "\n";
        }
        if ($claimed) $out .= "\n🔥 پاداش‌های جدید به کیف پولت اضافه شد.";
        else $out .= "\nهر روز از نو شروع می‌شود؛ دعوت‌های امروزت را زیاد کن.";
        send_or_edit($chat_id, $message_id, $out, back_main_keyboard()); return;
    }
    if ($data === 'u_spin') {
        $user = get_user_by_tid($chat_id);
        if ((int)$user['spin_balance'] <= 0) {
            $spinEvery = setting_int('spin_referrals_per_chance', 5);
            send_or_edit($chat_id, $message_id, "🎡 فعلاً شانس گردونه نداری.\nهر <b>{$spinEvery}</b> دعوت معتبر = ۱ بار گردونه.", back_main_keyboard()); return;
        }
        $reward = weighted_spin_reward();
        $title = $reward['title'] ?? 'جایزه گردونه'; $amount = (int)($reward['amount'] ?? 0);
        db()->prepare('UPDATE users SET spin_balance=spin_balance-1 WHERE id=? AND spin_balance>0')->execute([$user['id']]);
        db()->prepare('INSERT INTO spin_logs (user_id, prize_title, prize_amount) VALUES (?,?,?)')->execute([$user['id'], $title, $amount]);
        if ($amount > 0) add_balance($user['id'], $amount, 'spin_reward', $title, null);
        if (!empty($reward['notify_admin'])) notify_admins("🎡 جایزه نیازمند بررسی\nکاربر: <code>{$chat_id}</code>\nجایزه: <b>".h($title)."</b>");
        $remain = max(0, (int)$user['spin_balance'] - 1);
        $txt = "🎡 گردونه چرخید...\n\nبرنده شدی: <b>".h($title)."</b>\nشانس باقی‌مانده: <b>{$remain}</b>" . ($amount > 0 ? "\n✅ مبلغ به کیف پولت اضافه شد." : "\nادمین برای تحویل جایزه بررسی می‌کند.");
        send_or_edit($chat_id, $message_id, $txt, back_main_keyboard()); return;
    }
    if ($data === 'u_custom_code') {
        $min = setting_int('custom_code_min_referrals', 3);
        if ((int)$user['referrals_count'] < $min) {
            send_or_edit($chat_id, $message_id, "🔥 کد دعوت اختصاصی وقتی باز می‌شود که حداقل <b>{$min}</b> زیرمجموعه داشته باشی.\nالان داری: <b>{$user['referrals_count']}</b>", back_main_keyboard()); return;
        }
        set_step($chat_id, 'custom_ref_code');
        send_msg($chat_id, "کد اختصاصی دلخواهت را بفرست.\nمثال: <code>parsa_blue</code>\n\nفقط حروف انگلیسی، عدد و _ | طول ۴ تا ۲۰ کاراکتر", back_main_keyboard()); return;
    }
    if ($data === 'u_promo') {
        $link = referral_link($user);
        $caption = "💙 با BlueGate هم اینترنت آزاد داشته باش، هم از دعوت دوستات درآمد بگیر!\n\n👥 با لینک من وارد ربات شو؛ فعالیتت زیرمجموعه من حساب می‌شه.\n🎁 پاداش دعوت، کیف پول، گردونه شانس و برداشت نقدی فعال است.\n\n🔗 {$link}";
        $txt = "📣 <b>متن آماده تبلیغ شما</b>\n\n<code>".h($caption)."</code>\n\nلینک اختصاصی:\n<code>{$link}</code>";
        send_or_edit($chat_id, $message_id, $txt, back_main_keyboard()); return;
    }
    if ($data === 'u_withdraw') {
        $user = get_user_by_tid($chat_id);
        $min = setting_int('min_withdraw', 50000);
        if ((int)$user['balance'] < $min) { send_or_edit($chat_id, $message_id, 'حداقل برداشت <b>'.money($min).'</b> است. موجودی شما: <b>'.money($user['balance']).'</b>', back_main_keyboard()); return; }
        $pending = db()->prepare('SELECT COUNT(*) c FROM withdrawals WHERE user_id=? AND status="pending"');
        $pending->execute([$user['id']]);
        if ((int)$pending->fetch()['c'] > 0) { send_or_edit($chat_id, $message_id, 'شما یک درخواست برداشت در انتظار دارید. بعد از بررسی دوباره می‌توانید درخواست ثبت کنید.', back_main_keyboard()); return; }
        set_step($chat_id, 'withdraw_card');
        send_msg($chat_id, "شماره کارت/شبا و نام صاحب حساب را در یک پیام بفرست.\nمبلغ قابل برداشت: <b>".money($user['balance'])."</b>", back_main_keyboard()); return;
    }

    if ($data === 'u_shop') { show_shop_home($chat_id, $message_id); return; }
    if ($data === 'u_orders') { show_user_orders($chat_id, $message_id, (int)$user['id']); return; }
    if ($data === 'shop_featured') { show_shop_category($chat_id, $message_id, 0, true); return; }
    if (str_starts_with($data, 'shop_cat_')) { show_shop_category($chat_id, $message_id, (int)substr($data, 9)); return; }
    if (str_starts_with($data, 'shop_prod_')) { show_shop_product($chat_id, $message_id, (int)substr($data, 10)); return; }
    if (str_starts_with($data, 'shop_buyv_')) {
        $parts = explode('_', substr($data, 10));
        $pid = (int)($parts[0] ?? 0); $vid = (int)($parts[1] ?? 0);
        try {
            $order = create_shop_order((int)$user['id'], $pid, $vid);
            show_order_invoice($chat_id, $message_id, $order);
            notify_admins("🧾 سفارش جدید ثبت شد\nسفارش: <code>#{$order['id']}</code>\nکاربر: <code>{$chat_id}</code>\nمحصول: <b>".h($order['product_name'].(!empty($order['variant_title'])?' - '.$order['variant_title']:'' ))."</b>\nمبلغ: <b>".money($order['final_amount'])."</b>");
        } catch (Throwable $e) { send_or_edit($chat_id, $message_id, 'محصول/پلن پیدا نشد یا غیرفعال است.', back_main_keyboard()); }
        return;
    }
    if (str_starts_with($data, 'shop_buy_')) {
        $pid=(int)substr($data, 9);
        try {
            $order = create_shop_order((int)$user['id'], $pid, null);
            show_order_invoice($chat_id, $message_id, $order);
            notify_admins("🧾 سفارش جدید ثبت شد\nسفارش: <code>#{$order['id']}</code>\nکاربر: <code>{$chat_id}</code>\nمحصول: <b>".h($order['product_name'])."</b>\nمبلغ: <b>".money($order['final_amount'])."</b>");
        } catch (Throwable $e) {
            if ($e->getMessage()==='VARIANT_REQUIRED') show_shop_product($chat_id, $message_id, $pid);
            else send_or_edit($chat_id, $message_id, 'محصول پیدا نشد یا غیرفعال است.', back_main_keyboard());
        }
        return;
    }
    if (str_starts_with($data, 'order_view_')) {
        $order = order_by_id((int)substr($data, 11));
        if (!$order || (int)$order['user_id'] !== (int)$user['id']) { send_or_edit($chat_id, $message_id, 'سفارش پیدا نشد.', back_main_keyboard()); return; }
        show_order_invoice($chat_id, $message_id, $order); return;
    }
    if (str_starts_with($data, 'order_pay_wallet_')) {
        $oid=(int)substr($data, 17);
        try { $order=apply_wallet_to_order($oid, (int)$user['id']); show_order_invoice($chat_id, $message_id, $order); }
        catch (Throwable $e) { send_msg($chat_id, 'امکان پرداخت از کیف پول برای این سفارش نیست.', main_menu_keyboard(is_admin($chat_id))); }
        return;
    }
    if (str_starts_with($data, 'order_pay_card_')) {
        $oid=(int)substr($data, 15);
        try { $order=order_set_payment_method($oid, (int)$user['id'], 'card', []); show_order_invoice($chat_id, $message_id, $order); }
        catch (Throwable $e) { send_msg($chat_id, 'امکان انتخاب کارت به کارت نیست.', main_menu_keyboard(is_admin($chat_id))); }
        return;
    }
    if (str_starts_with($data, 'order_pay_stars_')) {
        $oid=(int)substr($data, 16);
        try { $order=order_set_payment_method($oid, (int)$user['id'], 'stars', []); $res=send_stars_invoice_for_order($order); show_order_invoice($chat_id, $message_id, order_by_id($oid)); if (empty($res['ok'])) send_msg($chat_id, 'ارسال فاکتور Stars ممکن نشد. شاید پرداخت Stars برای بات فعال نیست.'); }
        catch (Throwable $e) { send_msg($chat_id, 'امکان پرداخت با Stars برای این سفارش نیست.', main_menu_keyboard(is_admin($chat_id))); }
        return;
    }
    if (str_starts_with($data, 'order_pay_crypto_')) {
        $oid=(int)substr($data, 17);
        $wallets = crypto_wallets(true);
        if (!$wallets) { send_msg($chat_id, 'فعلاً کیف پول رمزارز فعالی تعریف نشده است.', main_menu_keyboard(is_admin($chat_id))); return; }
        $rows=[]; foreach($wallets as $w){ $rows[] = [['text'=>'🪙 '.($w['title'] ?: ($w['asset'].' '.$w['network'])), 'callback_data'=>'order_crypto_wallet_'.$oid.'_'.$w['id']]]; }
        $rows[]=[['text'=>'🔙 بازگشت', 'callback_data'=>'order_view_'.$oid]];
        send_msg($chat_id, 'کیف پول رمزارز را انتخاب کن:', json_markup(['inline_keyboard'=>$rows]));
        return;
    }
    if (str_starts_with($data, 'order_crypto_wallet_')) {
        $parts=explode('_',$data); $oid=(int)($parts[3]??0); $wid=(int)($parts[4]??0);
        try { $order=start_crypto_payment($oid, (int)$user['id'], $wid); show_order_invoice($chat_id, $message_id, $order); }
        catch(Throwable $e){ send_msg($chat_id, 'امکان انتخاب کیف پول رمزارز نیست. نرخ یا ولت را در پنل ادمین بررسی کن.', main_menu_keyboard(is_admin($chat_id))); }
        return;
    }
    if (str_starts_with($data, 'order_crypto_hash_')) {
        $oid=(int)substr($data, 18);
        set_step($chat_id, 'order_crypto_hash', (string)$oid);
        send_msg($chat_id, "TXID / Hash پرداخت رمزارز سفارش <code>#{$oid}</code> را ارسال کن.", back_main_keyboard()); return;
    }
    if (str_starts_with($data, 'order_check_crypto_')) {
        $oid=(int)substr($data, 19);
        try { crypto_verify_order($oid); show_order_invoice($chat_id, $message_id, order_by_id($oid)); }
        catch(Throwable $e){ send_msg($chat_id, 'بررسی پرداخت رمزارز انجام نشد؛ کمی بعد دوباره امتحان کن.', main_menu_keyboard(is_admin($chat_id))); }
        return;
    }
    if (str_starts_with($data, 'order_receipt_')) {
        $oid = (int)substr($data, 14);
        $order = order_by_id($oid);
        if (!$order || (int)$order['user_id'] !== (int)$user['id']) { send_or_edit($chat_id, $message_id, 'سفارش پیدا نشد.', back_main_keyboard()); return; }
        set_step($chat_id, 'order_receipt', (string)$oid);
        send_msg($chat_id, "رسید پرداخت سفارش <code>#{$oid}</code> را بفرست.\nمی‌تواند متن، توضیح پرداخت یا عکس رسید باشد.", back_main_keyboard()); return;
    }
    if (str_starts_with($data, 'order_coupon_')) {
        $oid = (int)substr($data, 13);
        $order = order_by_id($oid);
        if (!$order || (int)$order['user_id'] !== (int)$user['id'] || normalize_order_status($order['status']) !== 'pending_payment') { send_or_edit($chat_id, $message_id, 'برای این سفارش نمی‌شود کد تخفیف ثبت کرد.', back_main_keyboard()); return; }
        set_step($chat_id, 'order_coupon', (string)$oid);
        send_msg($chat_id, "کد تخفیف سفارش <code>#{$oid}</code> را بفرست.", back_main_keyboard()); return;
    }
    if (str_starts_with($data, 'order_cancel_')) {
        $oid = (int)substr($data, 13);
        $order = order_by_id($oid);
        if ($order && (int)$order['user_id'] === (int)$user['id'] && normalize_order_status($order['status']) === 'pending_payment') {
            cancel_order($oid, 'لغو توسط کاربر');
            send_or_edit($chat_id, $message_id, "سفارش <code>#{$oid}</code> لغو شد.", back_main_keyboard()); return;
        }
        send_or_edit($chat_id, $message_id, 'امکان لغو این سفارش نیست.', back_main_keyboard()); return;
    }
    if (str_starts_with($data, 'order_hide_')) {
        $oid = (int)substr($data, 11);
        if (hide_user_order($oid, (int)$user['id'])) { show_user_orders($chat_id, $message_id, (int)$user['id']); return; }
        send_or_edit($chat_id, $message_id, 'فقط سفارش‌های لغوشده، ردشده یا مرجوع‌شده قابل حذف از لیست هستند.', back_main_keyboard()); return;
    }
    if ($data === 'order_clear_canceled') {
        $count = hide_user_cleanup_orders((int)$user['id']);
        show_user_orders($chat_id, $message_id, (int)$user['id']);
        send_msg($chat_id, "🧹 {$count} سفارش لغوشده/ردشده از لیست شما مخفی شد.", main_menu_keyboard(is_admin($chat_id)));
        return;
    }

    if (str_starts_with($data, 'order_note_')) {
        $oid = (int)substr($data, 11);
        $order = order_by_id($oid);
        if (!$order || (int)$order['user_id'] !== (int)$user['id']) { send_or_edit($chat_id, $message_id, 'سفارش پیدا نشد.', back_main_keyboard()); return; }
        set_step($chat_id, 'customer_order_note', (string)$oid);
        send_msg($chat_id, "📝 یادداشت سفارش <code>#{$oid}</code> را بفرست.\nایمیل، رمز، یوزرنیم یا توضیح لازم برای آماده‌سازی اکانت را همینجا ارسال کن.", back_main_keyboard()); return;
    }

    if (str_starts_with($data, 'order_timeline_')) {
        $oid = (int)substr($data, 15);
        $order = order_by_id($oid);
        if (!$order || (int)$order['user_id'] !== (int)$user['id']) { send_or_edit($chat_id, $message_id, 'سفارش پیدا نشد.', back_main_keyboard()); return; }
        $timeline = order_timeline_text($oid, true) ?: 'هنوز تایم‌لاین جداگانه‌ای ثبت نشده.';
        send_or_edit($chat_id, $message_id, "🧾 <b>تایم‌لاین سفارش #{$oid}</b>

{$timeline}", order_user_keyboard($order)); return;
    }

    if ($data === 'u_support') {
        $support = app_config('SUPPORT_USERNAME', 'BlueGateSupport');
        send_or_edit($chat_id, $message_id, "📞 پشتیبانی: @{$support}", back_main_keyboard()); return;
    }
}

function handle_admin_callback(int $chat_id, $message_id, array $user, string $data): void {
    if ($data === 'adm_home') { clear_step($chat_id); send_or_edit($chat_id, $message_id, '⚙️ <b>پنل ادمین</b>\nهمه مدیریت‌ها با دکمه انجام می‌شود.', admin_keyboard()); return; }
    if (handle_shop_admin_v2_callback($chat_id, $message_id, $user, $data)) return;
    if ($data === 'adm_stats') {
        $u = db()->query('SELECT COUNT(*) c, COALESCE(SUM(balance),0) b, COALESCE(SUM(total_earned),0) e, COALESCE(SUM(referrals_count),0) r, COALESCE(SUM(spin_balance),0) s FROM users')->fetch();
        $w = db()->query('SELECT COUNT(*) c FROM withdrawals WHERE status="pending"')->fetch();
        $m = db()->query('SELECT COALESCE(SUM(reward_amount),0) s FROM mission_claims WHERE mission_date=CURDATE()')->fetch();
        $txt = "📈 <b>آمار کل</b>\n\nکاربران: <b>{$u['c']}</b>\nکل دعوت‌ها: <b>{$u['r']}</b>\nموجودی کل کاربران: <b>".money($u['b'])."</b>\nکل درآمد ثبت‌شده: <b>".money($u['e'])."</b>\nشانس‌های فعال گردونه: <b>{$u['s']}</b>\nپاداش مأموریت امروز: <b>".money($m['s'])."</b>\nبرداشت‌های در انتظار: <b>{$w['c']}</b>";
        send_or_edit($chat_id, $message_id, $txt, admin_keyboard()); return;
    }
    if ($data === 'adm_withdrawals') {
        $rows = db()->query('SELECT w.*, u.telegram_id, u.username FROM withdrawals w JOIN users u ON u.id=w.user_id WHERE w.status="pending" ORDER BY w.id DESC LIMIT 20')->fetchAll();
        if (!$rows) { send_or_edit($chat_id, $message_id, 'برداشت در انتظار نداریم.', admin_keyboard()); return; }
        send_or_edit($chat_id, $message_id, '🏧 <b>برداشت‌های در انتظار</b>\nدر پیام‌های بعدی هر برداشت را جدا می‌بینی.', admin_keyboard());
        foreach ($rows as $w) {
            send_msg($chat_id, "#{$w['id']} | @".h($w['username'])." | <code>{$w['telegram_id']}</code>\nمبلغ: <b>".money($w['amount'])."</b>\n".h($w['card_info']), json_markup(['inline_keyboard'=>[[['text'=>'✅ پرداخت شد','callback_data'=>'wd_paid_'.$w['id']], ['text'=>'❌ رد شود','callback_data'=>'wd_reject_'.$w['id']]]]]));
        }
        return;
    }
    if ($data === 'adm_balance') { set_step($chat_id, 'admin_balance'); send_msg($chat_id, "آیدی عددی تلگرام، مبلغ و توضیح را در یک پیام بفرست.\nمثال:\n<code>497837519 20000 پاداش دستی</code>", admin_keyboard()); return; }
    if ($data === 'adm_purchase') { set_step($chat_id, 'admin_purchase'); send_msg($chat_id, "برای ثبت پاداش خرید، آیدی عددی خریدار و مبلغ پایه را بفرست.\nمثال:\n<code>497837519 10000</code>\nضریب VIP معرف روی مبلغ اعمال می‌شود.", admin_keyboard()); return; }
    if ($data === 'adm_broadcast') { set_step($chat_id, 'admin_broadcast'); send_msg($chat_id, "متن پیام همگانی را بفرست.\nHTML ساده مثل <b>bold</b> پشتیبانی می‌شود.", admin_keyboard()); return; }
    if ($data === 'adm_leaderboard') {
        $rows = top_users(20); $out = "🏆 <b>لیدربورد ادمین</b>\n\n"; $i=1;
        foreach ($rows as $r) { $vip = vip_info((int)$r['referrals_count']); $out .= "{$i}. ".display_name($r)." | <code>{$r['telegram_id']}</code> | {$vip['emoji']} {$vip['fa']} | {$r['referrals_count']} دعوت | ".money($r['total_earned'])."\n"; $i++; }
        if (!$rows) $out .= 'هنوز داده‌ای نداریم.';
        send_or_edit($chat_id, $message_id, $out, admin_keyboard()); return;
    }

    if ($data === 'adm_backup') {
        $rows = blue_backup_list();
        $txt = "💾 <b>Backup / Restore</b>

دکمه بکاپ، فایل را روی سرور ذخیره می‌کند و همینجا هم برایت به عنوان فایل تلگرام می‌فرستد.
برای Restore از دستور <code>/restore_backup</code> استفاده کن و فایل بکاپ را به همین چت بفرست.

بکاپ‌های روی سرور: <b>".count($rows)."</b>";
        $kb = [[['text'=>'📦 ساخت بکاپ و ارسال در چت','callback_data'=>'adm_backup_create_send']],[['text'=>'♻️ راهنمای Restore','callback_data'=>'adm_backup_restore_prompt']],[['text'=>'🔙 پنل ادمین','callback_data'=>'adm_home']]];
        send_or_edit($chat_id, $message_id, $txt, json_markup(['inline_keyboard'=>$kb])); return;
    }
    if ($data === 'adm_backup_create_send') {
        try { $b = blue_backup_send_to_admin($chat_id); send_or_edit($chat_id, $message_id, "✅ بکاپ ساخته شد و به چت ارسال شد.
فایل: <code>".h($b['filename'])."</code>
Rows: <b>{$b['rows']}</b>", admin_keyboard()); }
        catch (Throwable $e) { send_or_edit($chat_id, $message_id, '❌ ساخت/ارسال بکاپ شکست خورد: <code>'.h($e->getMessage()).'</code>', admin_keyboard()); }
        return;
    }
    if ($data === 'adm_backup_restore_prompt') {
        set_step($chat_id, 'admin_restore_backup');
        send_or_edit($chat_id, $message_id, "⚠️ برای Restore فایل <code>.json.gz</code> بکاپ را به همین چت بفرست.
قبل از Restore، سیستم یک safety backup می‌سازد.

یا دستور <code>/restore_backup</code> را بزن.", admin_keyboard()); return;
    }

    if ($data === 'adm_shop') { show_admin_shop_home($chat_id, $message_id); return; }
    if ($data === 'adm_products') { show_admin_products($chat_id, $message_id); return; }
    if ($data === 'adm_variants') { show_admin_variants($chat_id, $message_id); return; }
    if ($data === 'adm_inventory') { show_admin_inventory($chat_id, $message_id); return; }
    if ($data === 'adm_sales_report') { show_sales_report($chat_id, $message_id); return; }
    if ($data === 'adm_order_search') { set_step($chat_id, 'admin_order_search'); send_msg($chat_id, "🔎 شماره سفارش، آیدی عددی کاربر، یوزرنیم یا نام محصول را بفرست.", admin_shop_keyboard()); return; }
    if ($data === 'adm_add_inventory') { set_step($chat_id, 'admin_add_inventory'); send_msg($chat_id, "📥 افزودن انبار دستی
خط اول: ID محصول یا ID محصول:ID پلن
خط‌های بعدی: هر آیتم یک خط

مثال:
<code>12:3
email1@test.com | pass1
email2@test.com | pass2</code>", admin_shop_keyboard()); return; }
    if ($data === 'adm_add_variant_manual') { set_step($chat_id, 'admin_add_variant'); send_msg($chat_id, "🧩 افزودن پلن
هر مورد را در یک خط بفرست:

<code>ID محصول
نام پلن
قیمت تومان
مدت روزانه یا 0</code>", admin_shop_keyboard()); return; }
    if ($data === 'adm_add_product') { set_step($chat_id, 'admin_add_product'); send_msg($chat_id, "➕ افزودن محصول
هر مورد را در یک خط بفرست:

<code>نام محصول
قیمت تومان
دسته‌بندی یا ID دسته
نوع تحویل: manual/account/vpn/code/file
پورسانت: none یا fixed:20000 یا percent:10
عکس محصول یا -
مدت روزانه یا 0
توضیح کوتاه
توضیح کامل اختیاری</code>", admin_shop_keyboard()); return; }
    if ($data === 'adm_categories') { show_admin_categories($chat_id, $message_id); return; }
    if ($data === 'adm_add_category') { set_step($chat_id, 'admin_add_category'); send_msg($chat_id, "نام دسته را بفرست. مثال:\n<code>🤖 هوش مصنوعی</code>", admin_shop_keyboard()); return; }
    if ($data === 'adm_coupons') { show_admin_coupons($chat_id, $message_id); return; }
    if ($data === 'adm_add_coupon') { set_step($chat_id, 'admin_add_coupon'); send_msg($chat_id, "🎟 افزودن کد تخفیف\nهر مورد را در یک خط بفرست:\n\n<code>BLUE10\npercent\n10\n100</code>\n\nخط چهارم حداکثر استفاده است؛ 0 یعنی نامحدود. برای تخفیف مبلغی به جای percent بنویس fixed.", admin_shop_keyboard()); return; }
    if ($data === 'adm_orders') { show_admin_order_filters($chat_id, $message_id); return; }
    if ($data === 'adm_cleanup_orders') { show_admin_cleanup_confirm($chat_id, $message_id); return; }
    if ($data === 'adm_cleanup_delete_all') { $count=hard_delete_cleanup_orders(); send_or_edit($chat_id, $message_id, "✅ {$count} سفارش لغو/رد/مرجوع‌شده کامل حذف شد.", admin_shop_keyboard()); return; }
    if ($data === 'adm_cleanup_delete_7') { $count=hard_delete_cleanup_orders(7); send_or_edit($chat_id, $message_id, "✅ {$count} سفارش قدیمی‌تر از ۷ روز حذف شد.", admin_shop_keyboard()); return; }
    if ($data === 'adm_cleanup_delete_30') { $count=hard_delete_cleanup_orders(30); send_or_edit($chat_id, $message_id, "✅ {$count} سفارش قدیمی‌تر از ۳۰ روز حذف شد.", admin_shop_keyboard()); return; }
    if (str_starts_with($data, 'adm_orders_')) { show_admin_orders($chat_id, $message_id, substr($data, 11)); return; }
    if ($data === 'adm_payment') { set_step($chat_id, 'admin_payment_instructions'); send_msg($chat_id, "متن راهنمای پرداخت را بفرست. این متن زیر فاکتور خرید نمایش داده می‌شود.", admin_shop_keyboard()); return; }
    if (str_starts_with($data, 'adm_add_variant_')) { $pid=(int)substr($data,16); set_step($chat_id, 'admin_add_variant', (string)$pid); send_msg($chat_id, "🧩 پلن جدید برای محصول #{$pid}\nنام پلن، قیمت و مدت را خط‌به‌خط بفرست:\n\n<code>10GB - 30 روزه\n150000\n30</code>", admin_shop_keyboard()); return; }
    if (str_starts_with($data, 'prod_toggle_')) { $pid=(int)substr($data,12); db()->prepare('UPDATE products SET is_active=1-is_active WHERE id=?')->execute([$pid]); show_admin_products($chat_id, $message_id); return; }
    if (str_starts_with($data, 'ord_view_')) { show_admin_order($chat_id, $message_id, (int)substr($data,9)); return; }
    if (str_starts_with($data, 'prod_delete_')) { $pid=(int)substr($data,12); db()->prepare('UPDATE products SET is_active=0 WHERE id=?')->execute([$pid]); send_msg($chat_id, "محصول #{$pid} غیرفعال شد.", admin_shop_keyboard()); return; }
    if (str_starts_with($data, 'ord_archive_')) { $oid=(int)substr($data,12); $o=archive_order($oid); if ($o) send_or_edit($chat_id,$message_id,"📦 سفارش #{$oid} آرشیو شد.",admin_shop_keyboard()); else send_or_edit($chat_id,$message_id,'سفارش پیدا نشد.',admin_shop_keyboard()); return; }
    if (str_starts_with($data, 'ord_delete_')) { $oid=(int)substr($data,11); $o=order_by_id($oid); if (!$o) { send_or_edit($chat_id,$message_id,'سفارش پیدا نشد.',admin_shop_keyboard()); return; } if (!is_cleanup_order_status($o['status'])) { send_or_edit($chat_id,$message_id,'حذف کامل فقط برای سفارش‌های لغو/رد/مرجوع‌شده مجاز است.',admin_order_keyboard($oid)); return; } send_or_edit($chat_id,$message_id,"⚠️ سفارش <code>#{$oid}</code> کامل حذف شود؟ این عملیات قابل برگشت نیست.", json_markup(['inline_keyboard'=>[[['text'=>'✅ بله، حذف کامل', 'callback_data'=>'ord_confirm_delete_'.$oid]],[['text'=>'❌ لغو', 'callback_data'=>'ord_view_'.$oid]]]])); return; }
    if (str_starts_with($data, 'ord_confirm_delete_')) { $oid=(int)substr($data,19); if (hard_delete_order($oid,true)) send_or_edit($chat_id,$message_id,"✅ سفارش #{$oid} کامل حذف شد.",admin_shop_keyboard()); else send_or_edit($chat_id,$message_id,'حذف انجام نشد. فقط سفارش‌های لغو/رد/مرجوع‌شده قابل حذف کامل هستند.',admin_shop_keyboard()); return; }
    if (str_starts_with($data, 'ord_review_')) { $oid=(int)substr($data,11); $o=update_order_status($oid, 'reviewing', 'سفارش در حال بررسی است'); if ($o) { send_msg($o['telegram_id'], "👀 سفارش <code>#{$oid}</code> در حال بررسی است.", main_menu_keyboard(is_admin($o['telegram_id']))); show_admin_order($chat_id, $message_id, $oid); } return; }
    if (str_starts_with($data, 'ord_paid_')) { $oid=(int)substr($data,9); $o=mark_order_paid($oid); if ($o) { send_msg($o['telegram_id'], "✅ پرداخت سفارش <code>#{$oid}</code> تایید شد.
بعد از آماده شدن، اطلاعات تحویل برای شما ارسال می‌شود.", main_menu_keyboard(is_admin($o['telegram_id']))); show_admin_order($chat_id, $message_id, $oid); } return; }
    if (str_starts_with($data, 'ord_prepare_')) { $oid=(int)substr($data,12); $o=mark_order_preparing($oid); if ($o) { send_msg($o['telegram_id'], "📦 سفارش <code>#{$oid}</code> در حال آماده‌سازی است.", main_menu_keyboard(is_admin($o['telegram_id']))); show_admin_order($chat_id, $message_id, $oid); } return; }
    if (str_starts_with($data, 'ord_auto_deliver_')) { $oid=(int)substr($data,17); $o=auto_deliver_order($oid); if ($o) { send_msg($o['telegram_id'], "📦 سفارش شما تحویل داده شد.
سفارش: <code>#{$oid}</code>
محصول: <b>".h($o['product_name'].(!empty($o['variant_title'])?' - '.$o['variant_title']:'' ))."</b>

اطلاعات تحویل:
<code>".h($o['delivery_text'])."</code>", main_menu_keyboard(is_admin($o['telegram_id']))); show_admin_order($chat_id, $message_id, $oid); } else send_msg($chat_id, 'موجودی آماده برای این سفارش پیدا نشد. از تحویل دستی استفاده کن.', admin_order_keyboard($oid)); return; }
    if (str_starts_with($data, 'ord_reject_')) { $oid=(int)substr($data,11); $o=reject_order($oid); if ($o) { send_msg($o['telegram_id'], "❌ سفارش <code>#{$oid}</code> رد شد. برای پیگیری با پشتیبانی ارتباط بگیر.", main_menu_keyboard(is_admin($o['telegram_id']))); show_admin_order($chat_id, $message_id, $oid); } return; }
    if (str_starts_with($data, 'ord_deliver_')) { $oid=(int)substr($data,12); set_step($chat_id, 'admin_deliver_order', (string)$oid); send_msg($chat_id, "📩 متن تحویل سفارش <code>#{$oid}</code> را بفرست.
مثلاً ایمیل/پسورد، لینک ساب VPN، کد گیفت یا توضیحات تحویل. قالب مناسب محصول خودکار اعمال می‌شود.", admin_shop_keyboard()); return; }
    if (str_starts_with($data, 'ord_note_')) { $oid=(int)substr($data,9); set_step($chat_id, 'admin_order_note', (string)$oid); send_msg($chat_id, "📝 یادداشت داخلی سفارش <code>#{$oid}</code> را بفرست. فقط ادمین می‌بیند.", admin_shop_keyboard()); return; }
    if (str_starts_with($data, 'ord_timeline_')) { $oid=(int)substr($data,13); $timeline=order_timeline_text($oid, false) ?: 'تایم‌لاین خالی است.'; send_or_edit($chat_id, $message_id, "🧾 <b>تایم‌لاین سفارش #{$oid}</b>

{$timeline}", admin_order_keyboard($oid)); return; }

    if ($data === 'adm_settings') {
        $txt = "⚙️ <b>تنظیمات پاداش‌ها</b>\n\nپاداش دعوت: <b>".money(setting_int('start_reward', 2000))."</b>\nحداقل برداشت: <b>".money(setting_int('min_withdraw', 50000))."</b>\nپاداش پایه خرید: <b>".money(setting_int('purchase_reward', 10000))."</b>\nهر چند دعوت یک گردونه: <b>".setting_int('spin_referrals_per_chance', 5)."</b>\nحداقل دعوت برای کد اختصاصی: <b>".setting_int('custom_code_min_referrals', 3)."</b>";
        $kb = json_markup(['inline_keyboard'=>[
            [['text'=>'پاداش دعوت', 'callback_data'=>'set_start_reward'], ['text'=>'حداقل برداشت', 'callback_data'=>'set_min_withdraw']],
            [['text'=>'پاداش خرید', 'callback_data'=>'set_purchase_reward'], ['text'=>'هر چند دعوت گردونه', 'callback_data'=>'set_spin_every']],
            [['text'=>'حداقل کد اختصاصی', 'callback_data'=>'set_custom_code_min']],
            [['text'=>(setting_bool('require_contact_auth', false)?'غیرفعال‌کردن احراز شماره':'فعال‌کردن احراز شماره'), 'callback_data'=>'toggle_require_contact_auth'], ['text'=>(setting_bool('notify_new_user', true)?'خاموش‌کردن اعلان عضو جدید':'روشن‌کردن اعلان عضو جدید'), 'callback_data'=>'toggle_notify_new_user']],
            [['text'=>'مأموریت ۱', 'callback_data'=>'set_mission1'], ['text'=>'مأموریت ۲', 'callback_data'=>'set_mission2'], ['text'=>'مأموریت ۳', 'callback_data'=>'set_mission3']],
            [['text'=>'🔙 پنل ادمین', 'callback_data'=>'adm_home']],
        ]]);
        send_or_edit($chat_id, $message_id, $txt, $kb); return;
    }
    if ($data === 'toggle_require_contact_auth') { set_setting('require_contact_auth', setting_bool('require_contact_auth', false) ? '0' : '1'); handle_admin_callback($chat_id, $message_id, $user, 'adm_settings'); return; }
    if ($data === 'toggle_notify_new_user') { set_setting('notify_new_user', setting_bool('notify_new_user', true) ? '0' : '1'); handle_admin_callback($chat_id, $message_id, $user, 'adm_settings'); return; }
    if ($data === 'adm_theme') {
        $txt = "🎨 <b>رنگ اصلی Mini App</b>\nرنگ فعلی: <code>".h(setting('theme_color', '#1d9bf0'))."</code>\n\nیک رنگ انتخاب کن یا دکمه «رنگ دلخواه» را بزن.";
        $kb = json_markup(['inline_keyboard'=>[
            [['text'=>'آبی', 'callback_data'=>'theme_#1d9bf0'], ['text'=>'بنفش', 'callback_data'=>'theme_#8b5cf6'], ['text'=>'سبز', 'callback_data'=>'theme_#22c55e']],
            [['text'=>'قرمز', 'callback_data'=>'theme_#ef4444'], ['text'=>'نارنجی', 'callback_data'=>'theme_#f97316'], ['text'=>'صورتی', 'callback_data'=>'theme_#ec4899']],
            [['text'=>'رنگ دلخواه HEX', 'callback_data'=>'set_theme_custom']],
            [['text'=>'🔙 پنل ادمین', 'callback_data'=>'adm_home']],
        ]]);
        send_or_edit($chat_id, $message_id, $txt, $kb); return;
    }
    if (str_starts_with($data, 'theme_')) {
        $color = substr($data, 6);
        $valid = validate_theme_color($color);
        if ($valid) set_setting('theme_color', $valid);
        send_or_edit($chat_id, $message_id, "✅ رنگ Mini App تغییر کرد: <code>{$valid}</code>", admin_keyboard()); return;
    }
    if ($data === 'set_theme_custom') { set_step($chat_id, 'admin_set_setting', 'theme_color'); send_msg($chat_id, "کد رنگ HEX را بفرست. مثال: <code>#1d9bf0</code>", admin_keyboard()); return; }
    $setMap = [
        'set_start_reward'=>'start_reward', 'set_min_withdraw'=>'min_withdraw', 'set_purchase_reward'=>'purchase_reward', 'set_spin_every'=>'spin_referrals_per_chance', 'set_custom_code_min'=>'custom_code_min_referrals',
        'set_mission1'=>'mission_1', 'set_mission2'=>'mission_2', 'set_mission3'=>'mission_3'
    ];
    if (isset($setMap[$data])) {
        set_step($chat_id, 'admin_set_setting', $setMap[$data]);
        if (str_starts_with($setMap[$data], 'mission_')) send_msg($chat_id, "برای مأموریت، هدف و پاداش را بفرست. مثال:\n<code>3 10000</code>", admin_keyboard());
        else send_msg($chat_id, "عدد جدید را بفرست.", admin_keyboard());
        return;
    }
    if (str_starts_with($data, 'wd_paid_') || str_starts_with($data, 'wd_reject_')) {
        $isPaid = str_starts_with($data, 'wd_paid_');
        $wid = (int)preg_replace('/\D/', '', $data);
        $q = db()->prepare('SELECT w.*, u.telegram_id FROM withdrawals w JOIN users u ON u.id=w.user_id WHERE w.id=? AND w.status="pending"');
        $q->execute([$wid]); $w = $q->fetch();
        if (!$w) { send_msg($chat_id, 'این برداشت قبلاً بررسی شده یا پیدا نشد.', admin_keyboard()); return; }
        if ($isPaid) {
            db()->prepare('UPDATE withdrawals SET status="paid" WHERE id=?')->execute([$wid]);
            db()->prepare('UPDATE users SET total_withdrawn=total_withdrawn+? WHERE id=?')->execute([$w['amount'], $w['user_id']]);
            send_msg($w['telegram_id'], "✅ برداشت شما پرداخت شد.\nمبلغ: <b>".money($w['amount'])."</b>", main_menu_keyboard(is_admin($w['telegram_id'])));
            send_msg($chat_id, "✅ برداشت #{$wid} پرداخت شد.", admin_keyboard());
        } else {
            db()->prepare('UPDATE withdrawals SET status="rejected" WHERE id=?')->execute([$wid]);
            db()->prepare('UPDATE users SET balance=balance+? WHERE id=?')->execute([$w['amount'], $w['user_id']]);
            send_msg($w['telegram_id'], "❌ برداشت شما رد شد و مبلغ به کیف پول برگشت.\nمبلغ: <b>".money($w['amount'])."</b>", main_menu_keyboard(is_admin($w['telegram_id'])));
            send_msg($chat_id, "❌ برداشت #{$wid} رد شد و مبلغ برگشت خورد.", admin_keyboard());
        }
        return;
    }
}


function handle_step_message(int $chat_id, array $user, array $message): void {
    $step = (string)($user['step'] ?? '');
    if ($step === 'admin_restore_backup') {
        if (!is_admin($chat_id)) { clear_step($chat_id); send_msg($chat_id, 'دسترسی ادمین لازم است.', main_menu_keyboard(false)); return; }
        if (empty($message['document']['file_id'])) { send_msg($chat_id, 'لطفاً فایل بکاپ .json.gz را به صورت Document ارسال کن، نه متن یا عکس.', admin_keyboard()); return; }
        $tmp = blue_backup_dir() . '/telegram-restore-' . date('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.json.gz';
        try {
            if (!telegram_download_file((string)$message['document']['file_id'], $tmp)) throw new RuntimeException('TELEGRAM_FILE_DOWNLOAD_FAILED');
            $res = blue_backup_restore_from_file($tmp, true);
            @unlink($tmp);
            clear_step($chat_id);
            send_msg($chat_id, "✅ Restore انجام شد.
Tables: <b>{$res['tables']}</b>
Rows: <b>{$res['restored_rows']}</b>", admin_keyboard());
        } catch (Throwable $e) {
            @unlink($tmp);
            clear_step($chat_id);
            send_msg($chat_id, '❌ Restore شکست خورد: <code>'.h($e->getMessage()).'</code>', admin_keyboard());
        }
        return;
    }
    if ($step === 'customer_order_note') {
        $oid=(int)$user['step_payload'];
        $note=trim((string)($message['text'] ?? $message['caption'] ?? ''));
        if ($note==='') { send_msg($chat_id, 'لطفاً متن یادداشت را ارسال کن.', back_main_keyboard()); return; }
        try {
            $order=update_order_customer_note($oid, (int)$user['id'], $note);
            clear_step($chat_id);
            send_msg($chat_id, "✅ یادداشت سفارش <code>#{$oid}</code> ثبت شد.", main_menu_keyboard(is_admin($chat_id)));
            notify_admins("📝 یادداشت مشتری برای سفارش <code>#{$oid}</code>\nکاربر: <code>{$chat_id}</code>\n\n".h($note));
        } catch (Throwable $e) { clear_step($chat_id); send_msg($chat_id, 'ثبت یادداشت ممکن نشد. سفارش پیدا نشد.', main_menu_keyboard(is_admin($chat_id))); }
        return;
    }

    if ($step === 'order_crypto_hash') {
        $oid=(int)$user['step_payload'];
        $text=trim((string)($message['text'] ?? $message['caption'] ?? ''));
        if ($text==='') { send_msg($chat_id, 'لطفاً TXID / Hash را به صورت متن ارسال کن.', back_main_keyboard()); return; }
        try {
            $order=submit_crypto_hash($oid, (int)$user['id'], $text);
            clear_step($chat_id);
            show_order_invoice($chat_id, null, $order);
        } catch(Throwable $e) {
            send_msg($chat_id, 'هش قابل ثبت نیست یا قبلاً استفاده شده است. دوباره بررسی کن و بفرست.', back_main_keyboard());
        }
        return;
    }

    if ($step === 'order_receipt') {
        $oid = (int)$user['step_payload'];
        $note = trim((string)($message['caption'] ?? $message['text'] ?? ''));
        $fileId = null;
        if (!empty($message['photo']) && is_array($message['photo'])) {
            $last = end($message['photo']);
            $fileId = $last['file_id'] ?? null;
        }
        if ($note === '' && !$fileId) { send_msg($chat_id, 'لطفاً متن رسید یا عکس رسید را ارسال کن.', back_main_keyboard()); return; }
        try {
            $order = submit_order_receipt($oid, (int)$user['id'], $note, $fileId);
            clear_step($chat_id);
            send_msg($chat_id, "✅ رسید سفارش <code>#{$oid}</code> ثبت شد.\nوضعیت: <b>".order_status_fa($order['status'])."</b>\nبعد از بررسی ادمین اطلاع داده می‌شود.", main_menu_keyboard(is_admin($chat_id)));
            $msg = order_admin_card($order) . "\n\nرسید/توضیح پرداخت:\n" . h($note ?: 'عکس رسید ارسال شده است.');
            foreach (app_config('ADMIN_IDS', []) as $aid) {
                if ($fileId) tg('sendPhoto', ['chat_id'=>$aid, 'photo'=>$fileId, 'caption'=>$msg, 'parse_mode'=>'HTML', 'reply_markup'=>admin_order_keyboard((int)$order['id'])]);
                else send_msg($aid, $msg, admin_order_keyboard((int)$order['id']));
            }
        } catch (Throwable $e) { clear_step($chat_id); send_msg($chat_id, 'ثبت رسید ممکن نشد. سفارش پیدا نشد یا قابل پرداخت نیست.', main_menu_keyboard(is_admin($chat_id))); }
        return;
    }
    if ($step === 'order_customer_note') {
        $oid = (int)$user['step_payload'];
        $text = trim((string)($message['text'] ?? $message['caption'] ?? ''));
        if ($text === '') { send_msg($chat_id, 'لطفاً متن یادداشت را ارسال کن.', back_main_keyboard()); return; }
        try {
            $order = update_order_customer_note($oid, (int)$user['id'], $text);
            clear_step($chat_id);
            send_msg($chat_id, "✅ یادداشت سفارش <code>#{$oid}</code> ثبت شد.", order_user_keyboard($order));
            notify_admins("📝 یادداشت جدید مشتری برای سفارش <code>#{$oid}</code>
کاربر: <code>{$chat_id}</code>

".h($text));
        } catch (Throwable $e) { clear_step($chat_id); send_msg($chat_id, 'ثبت یادداشت ممکن نشد. سفارش پیدا نشد.', main_menu_keyboard(is_admin($chat_id))); }
        return;
    }
    if (handle_shop_admin_v2_message($chat_id, $user, $message)) return;
    handle_step_input($chat_id, $user, trim((string)($message['text'] ?? '')));
}

function handle_step_input(int $chat_id, array $user, string $text): void {
    $step = $user['step'];
    if ($text === '' && $step !== 'admin_broadcast') { send_msg($chat_id, 'لطفاً متن معتبر بفرست.', main_menu_keyboard(is_admin($chat_id))); return; }

    if ($step === 'withdraw_card') {
        $user = get_user_by_tid($chat_id); $amount = (int)$user['balance'];
        $min = setting_int('min_withdraw', 50000);
        if ($amount < $min) { clear_step($chat_id); send_msg($chat_id, 'موجودی شما دیگر به حداقل برداشت نمی‌رسد.', main_menu_keyboard(is_admin($chat_id))); return; }
        db()->prepare('INSERT INTO withdrawals (user_id, amount, card_info) VALUES (?,?,?)')->execute([$user['id'], $amount, $text]);
        db()->prepare('UPDATE users SET balance=0 WHERE id=?')->execute([$user['id']]);
        clear_step($chat_id);
        send_msg($chat_id, "✅ درخواست برداشت ثبت شد.\nمبلغ: <b>".money($amount)."</b>\nبعد از بررسی ادمین اطلاع داده می‌شود.", main_menu_keyboard(is_admin($chat_id)));
        notify_admins("🏧 برداشت جدید\nکاربر: <code>{$chat_id}</code>\nمبلغ: <b>".money($amount)."</b>\nاطلاعات:\n".h($text));
        return;
    }
    if ($step === 'custom_ref_code') {
        $code = normalize_ref_code($text);
        if (strlen($code) < 4 || strlen($code) > 20) { send_msg($chat_id, 'کد باید بین ۴ تا ۲۰ کاراکتر باشد.', back_main_keyboard()); return; }
        $exists = get_user_by_ref($code);
        if ($exists && (int)$exists['id'] !== (int)$user['id']) { send_msg($chat_id, 'این کد قبلاً گرفته شده. یک کد دیگر بفرست.', back_main_keyboard()); return; }
        db()->prepare('UPDATE users SET ref_code=? WHERE id=?')->execute([$code, $user['id']]);
        clear_step($chat_id); $user = get_user_by_tid($chat_id);
        send_msg($chat_id, "✅ کد اختصاصی ثبت شد.\nلینک جدید شما:\n<code>".referral_link($user)."</code>", main_menu_keyboard(is_admin($chat_id))); return;
    }


    if ($step === 'order_coupon') {
        $oid = (int)$user['step_payload'];
        try {
            $order = apply_coupon_to_order($oid, (int)$user['id'], $text);
            clear_step($chat_id);
            send_msg($chat_id, "✅ کد تخفیف اعمال شد.\nتخفیف: <b>".money($order['discount_amount'])."</b>\nمبلغ نهایی: <b>".money($order['final_amount'])."</b>", order_user_keyboard($order));
        } catch (Throwable $e) { send_msg($chat_id, 'کد تخفیف معتبر نیست یا برای این سفارش قابل استفاده نیست.', back_main_keyboard()); }
        return;
    }

    if (!is_admin($chat_id)) { clear_step($chat_id); send_msg($chat_id, 'این مرحله فقط برای ادمین است.', main_menu_keyboard(false)); return; }

    if ($step === 'admin_balance') {
        $parts = preg_split('/\s+/', $text, 3);
        if (count($parts) < 2) { send_msg($chat_id, 'فرمت درست نیست. مثال: <code>497837519 20000 پاداش دستی</code>', admin_keyboard()); return; }
        [$tid, $amount] = [$parts[0], (int)$parts[1]]; $desc = $parts[2] ?? 'تغییر موجودی توسط ادمین';
        $target = get_user_by_tid((int)$tid);
        if (!$target) { send_msg($chat_id, 'کاربر پیدا نشد.', admin_keyboard()); return; }
        add_balance($target['id'], $amount, 'admin_adjust', $desc, null);
        clear_step($chat_id);
        send_msg($chat_id, '✅ موجودی تغییر کرد.', admin_keyboard());
        send_msg($target['telegram_id'], "💸 موجودی شما تغییر کرد.\nمبلغ: <b>".money($amount)."</b>\nتوضیح: ".h($desc), main_menu_keyboard(is_admin($target['telegram_id'])));
        return;
    }
    if ($step === 'admin_purchase') {
        $parts = preg_split('/\s+/', $text, 2);
        if (count($parts) < 2) { send_msg($chat_id, 'فرمت درست نیست. مثال: <code>497837519 10000</code>', admin_keyboard()); return; }
        $buyer = get_user_by_tid((int)$parts[0]); $base = (int)$parts[1];
        if (!$buyer || empty($buyer['referrer_id'])) { clear_step($chat_id); send_msg($chat_id, 'این خریدار معرف ثبت‌شده ندارد یا پیدا نشد.', admin_keyboard()); return; }
        $referrer = get_user_by_id((int)$buyer['referrer_id']);
        $vip = vip_info((int)$referrer['referrals_count']);
        $amount = (int)round($base * (float)$vip['multiplier']);
        add_balance($referrer['id'], $amount, 'purchase_reward', 'پورسانت خرید زیرمجموعه با ضریب VIP', $buyer['id']);
        clear_step($chat_id);
        send_msg($chat_id, "✅ پاداش خرید ثبت شد.\nمعرف: ".display_name($referrer)."\nمبلغ نهایی: <b>".money($amount)."</b>", admin_keyboard());
        send_msg($referrer['telegram_id'], "🎁 زیرمجموعه شما خرید انجام داد.\nپورسانت: <b>".money($amount)."</b>\nسطح: {$vip['emoji']} {$vip['fa']}", main_menu_keyboard(is_admin($referrer['telegram_id'])));
        return;
    }

    if ($step === 'admin_add_category') {
        $line = trim($text); $emoji='🛒'; $title=$line;
        if (preg_match('/^(.{1,4})\s+(.+)$/u', $line, $m)) { $emoji=$m[1]; $title=$m[2]; }
        db()->prepare('INSERT INTO product_categories (emoji,title,sort_order) VALUES (?,?,99)')->execute([$emoji,$title]);
        clear_step($chat_id); send_msg($chat_id, '✅ دسته اضافه شد.', admin_shop_keyboard()); return;
    }
    if ($step === 'admin_add_coupon') {
        $lines = array_values(array_filter(array_map('trim', preg_split('/\R/', $text))));
        if (count($lines) < 3) { send_msg($chat_id, 'فرمت کافی نیست. کد، نوع، مقدار و حداکثر استفاده را خط‌به‌خط بفرست.', admin_shop_keyboard()); return; }
        $code=normalize_coupon_code($lines[0]); $type=strtolower($lines[1])==='fixed'?'fixed':'percent'; $value=max(0,(int)$lines[2]); $max=max(0,(int)($lines[3] ?? 0));
        if ($code==='' || $value<=0) { send_msg($chat_id, 'کد یا مقدار تخفیف معتبر نیست.', admin_shop_keyboard()); return; }
        db()->prepare('INSERT INTO coupons (code,type,value,max_uses) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE type=VALUES(type), value=VALUES(value), max_uses=VALUES(max_uses), is_active=1')->execute([$code,$type,$value,$max]);
        clear_step($chat_id); send_msg($chat_id, "✅ کد تخفیف <code>{$code}</code> ذخیره شد.", admin_shop_keyboard()); return;
    }
    if ($step === 'admin_order_search') {
        $orders = admin_orders(null, 20, trim($text));
        clear_step($chat_id);
        if (!$orders) { send_msg($chat_id, 'سفارشی با این عبارت پیدا نشد.', admin_shop_keyboard()); return; }
        $out = "🔎 <b>نتیجه جستجوی سفارش</b>

"; $kb=[];
        foreach ($orders as $o) {
            $name = $o['product_name'].(!empty($o['variant_title']) ? ' - '.$o['variant_title'] : '');
            $out .= "#{$o['id']} | @".h($o['username'] ?: '---')." | ".h($name)." | ".order_status_fa($o['status'])."
";
            $kb[] = [['text'=>'مدیریت #'.$o['id'], 'callback_data'=>'ord_view_'.$o['id']]];
        }
        $kb[] = [['text'=>'🔙 فروشگاه ادمین', 'callback_data'=>'adm_shop']];
        send_msg($chat_id, $out, json_markup(['inline_keyboard'=>$kb])); return;
    }
    if ($step === 'admin_add_variant') {
        $lines = array_values(array_filter(array_map('trim', preg_split('/\R/', $text))));
        $payload = trim((string)($user['step_payload'] ?? ''));
        if ($payload !== '') { $productId=(int)$payload; $title=$lines[0] ?? ''; $price=max(0,(int)preg_replace('/\D/','',$lines[1] ?? '0')); $duration=max(0,(int)preg_replace('/\D/','',$lines[2] ?? '0')); }
        else { if (count($lines)<4) { send_msg($chat_id, 'فرمت پلن کامل نیست.', admin_shop_keyboard()); return; } $productId=(int)$lines[0]; $title=$lines[1]; $price=max(0,(int)preg_replace('/\D/','',$lines[2])); $duration=max(0,(int)preg_replace('/\D/','',$lines[3])); }
        if ($productId<=0 || $title==='' || $price<=0) { send_msg($chat_id, 'ID محصول، نام پلن یا قیمت معتبر نیست.', admin_shop_keyboard()); return; }
        db()->prepare('INSERT INTO product_variants (product_id,title,price,duration_days,sort_order) VALUES (?,?,?,?,99)')->execute([$productId,$title,$price,$duration]);
        clear_step($chat_id); send_msg($chat_id, "✅ پلن اضافه شد.
محصول: <code>#{$productId}</code>
پلن: <b>".h($title)."</b>
قیمت: <b>".money($price)."</b>", admin_shop_keyboard()); return;
    }
    if ($step === 'admin_add_inventory') {
        $lines = array_values(array_filter(array_map('trim', preg_split('/\R/', $text))));
        if (count($lines) < 2) { send_msg($chat_id, 'حداقل ID محصول و یک آیتم لازم است.', admin_shop_keyboard()); return; }
        $target = array_shift($lines);
        $productId=0; $variantId=null;
        if (str_contains($target, ':')) { [$productId,$variantId]=array_map('intval', explode(':',$target,2)); }
        else $productId=(int)$target;
        if ($productId<=0) { send_msg($chat_id, 'ID محصول معتبر نیست.', admin_shop_keyboard()); return; }
        $q=db()->prepare('INSERT INTO inventory_items (product_id, variant_id, content) VALUES (?,?,?)'); $count=0;
        foreach ($lines as $item) { if (trim($item)==='') continue; $q->execute([$productId, $variantId ?: null, $item]); $count++; }
        clear_step($chat_id); send_msg($chat_id, "✅ {$count} آیتم به انبار محصول #{$productId} اضافه شد.", admin_shop_keyboard()); return;
    }
    if ($step === 'admin_order_note') {
        $oid=(int)$user['step_payload'];
        db()->prepare('UPDATE orders SET admin_note=? WHERE id=?')->execute([$text,$oid]);
        add_order_event($oid, 'note', 'یادداشت داخلی ثبت شد', $text, false);
        clear_step($chat_id); send_msg($chat_id, "✅ یادداشت داخلی سفارش #{$oid} ذخیره شد.", admin_shop_keyboard()); return;
    }
    if ($step === 'admin_add_product') {
        $lines = array_map('trim', preg_split('/\R/', $text));
        $lines = array_values(array_filter($lines, fn($v)=>$v!==''));
        if (count($lines) < 8) { send_msg($chat_id, 'فرمت محصول کامل نیست. حداقل ۸ خط لازم است.', admin_shop_keyboard()); return; }
        $name=$lines[0]; $price=max(0,(int)preg_replace('/\D/','',$lines[1])); $catId=find_or_create_category($lines[2]); $delivery=normalize_delivery_type($lines[3]);
        $commission='none'; $commissionValue=0; $c=strtolower($lines[4]);
        if (str_starts_with($c,'fixed:')) { $commission='fixed'; $commissionValue=max(0,(int)preg_replace('/\D/','',substr($c,6))); }
        elseif (str_starts_with($c,'percent:')) { $commission='percent'; $commissionValue=max(0,min(100,(int)preg_replace('/\D/','',substr($c,8)))); }
        $imageUrl = trim($lines[5]); if ($imageUrl==='-' || !preg_match('/^https?:\/\//i', $imageUrl)) $imageUrl=null;
        $duration=max(0,(int)preg_replace('/\D/','',$lines[6]));
        $short=$lines[7]; $full=$lines[8] ?? $short;
        db()->prepare('INSERT INTO products (category_id,name,price,short_description,full_description,image_url,delivery_type,commission_type,commission_value,duration_days) VALUES (?,?,?,?,?,?,?,?,?,?)')->execute([$catId,$name,$price,$short,$full,$imageUrl,$delivery,$commission,$commissionValue,$duration]);
        clear_step($chat_id); send_msg($chat_id, "✅ محصول اضافه شد.
نام: <b>".h($name)."</b>
قیمت: <b>".money($price)."</b>", admin_shop_keyboard()); return;
    }
    if ($step === 'admin_deliver_order') {
        $oid=(int)$user['step_payload'];
        $order=deliver_order($oid, $text);
        clear_step($chat_id);
        if (!$order) { send_msg($chat_id, 'سفارش پیدا نشد.', admin_shop_keyboard()); return; }
        send_msg($order['telegram_id'], "📦 سفارش شما تحویل داده شد.\nسفارش: <code>#{$oid}</code>\nمحصول: <b>".h($order['product_name'])."</b>\n\nاطلاعات تحویل:\n<code>".h($order['delivery_text'])."</code>", main_menu_keyboard(is_admin($order['telegram_id'])));
        send_msg($chat_id, "✅ سفارش #{$oid} تحویل شد.\nپورسانت معرف: <b>".money($order['referrer_reward_amount'])."</b>", admin_shop_keyboard()); return;
    }
    if ($step === 'admin_payment_instructions') {
        set_setting('payment_instructions', $text);
        clear_step($chat_id); send_msg($chat_id, '✅ متن پرداخت ذخیره شد.', admin_shop_keyboard()); return;
    }

    if ($step === 'admin_broadcast') {
        clear_step($chat_id);
        $ids = db()->query('SELECT telegram_id FROM users')->fetchAll(PDO::FETCH_COLUMN);
        $sent=0;
        foreach ($ids as $tid) { tg('sendMessage', ['chat_id'=>$tid, 'text'=>$text, 'parse_mode'=>'HTML', 'disable_web_page_preview'=>true]); $sent++; usleep(45000); }
        send_msg($chat_id, "✅ پیام همگانی ارسال شد.\nتعداد: <b>{$sent}</b>", admin_keyboard()); return;
    }
    if ($step === 'admin_set_setting') {
        $key = (string)$user['step_payload'];
        if ($key === 'theme_color') {
            $color = validate_theme_color($text);
            if (!$color) { send_msg($chat_id, 'رنگ معتبر نیست. مثال: <code>#1d9bf0</code>', admin_keyboard()); return; }
            set_setting('theme_color', $color); clear_step($chat_id); send_msg($chat_id, "✅ رنگ ثبت شد: <code>{$color}</code>", admin_keyboard()); return;
        }
        if (str_starts_with($key, 'mission_')) {
            $parts = preg_split('/\s+/', $text);
            if (count($parts) < 2) { send_msg($chat_id, 'هدف و پاداش را با فاصله بفرست. مثال: <code>3 10000</code>', admin_keyboard()); return; }
            $idx = substr($key, -1); set_setting("mission_{$idx}_target", max(0, (int)$parts[0])); set_setting("mission_{$idx}_reward", max(0, (int)$parts[1]));
            clear_step($chat_id); send_msg($chat_id, '✅ مأموریت ذخیره شد.', admin_keyboard()); return;
        }
        $map = ['start_reward'=>'start_reward','min_withdraw'=>'min_withdraw','purchase_reward'=>'purchase_reward','spin_referrals_per_chance'=>'spin_referrals_per_chance','custom_code_min_referrals'=>'custom_code_min_referrals'];
        if (!isset($map[$key])) { clear_step($chat_id); send_msg($chat_id, 'تنظیم ناشناخته بود.', admin_keyboard()); return; }
        set_setting($map[$key], max(0, (int)$text)); clear_step($chat_id); send_msg($chat_id, '✅ تنظیمات ذخیره شد.', admin_keyboard()); return;
    }

    clear_step($chat_id);
    send_msg($chat_id, 'مرحله ناشناخته بود؛ به منوی اصلی برگشتیم.', main_menu_keyboard(is_admin($chat_id)));
}

function show_admin_cleanup_confirm(int $chat_id, $message_id=null): void {
    $all = cleanup_orders_count();
    $d7 = cleanup_orders_count(7);
    $d30 = cleanup_orders_count(30);
    $txt = "🧹 <b>پاکسازی سفارش‌های لغو/رد شده</b>\n\n".
        "قابل حذف کامل: <b>{$all}</b> سفارش\n".
        "قدیمی‌تر از ۷ روز: <b>{$d7}</b> سفارش\n".
        "قدیمی‌تر از ۳۰ روز: <b>{$d30}</b> سفارش\n\n".
        "⚠️ حذف کامل قابل برگشت نیست. سفارش‌های تحویل‌شده، پرداخت‌شده یا درحال بررسی حذف نمی‌شوند.";
    send_or_edit($chat_id, $message_id, $txt, json_markup(['inline_keyboard'=>[
        [['text'=>'🧹 حذف همه لغو/رد شده‌ها', 'callback_data'=>'adm_cleanup_delete_all']],
        [['text'=>'حذف قدیمی‌تر از ۷ روز', 'callback_data'=>'adm_cleanup_delete_7'], ['text'=>'حذف قدیمی‌تر از ۳۰ روز', 'callback_data'=>'adm_cleanup_delete_30']],
        [['text'=>'🔙 سفارش‌ها', 'callback_data'=>'adm_orders'], ['text'=>'🛒 فروشگاه ادمین', 'callback_data'=>'adm_shop']],
    ]]));
}

function handle_shop_admin_v2_callback(int $chat_id, $message_id, array $user, string $data): bool {
    if ($data === 'adm_add_product') {
        clear_step($chat_id);
        set_step_payload($chat_id, 'admin_product_wizard', ['stage'=>'category']);
        $rows = category_rows_keyboard('prodwiz_cat_');
        $rows[] = [['text'=>'➕ اول دسته جدید بساز', 'callback_data'=>'adm_add_category']];
        $rows[] = [['text'=>'❌ لغو', 'callback_data'=>'adm_shop']];
        send_or_edit($chat_id, $message_id, "➕ <b>افزودن محصول مرحله‌ای</b>\n\nاول انتخاب کن محصول داخل کدام دسته‌بندی باشد:", json_markup(['inline_keyboard'=>$rows]));
        return true;
    }
    if ($data === 'adm_add_category') {
        set_step_payload($chat_id, 'admin_category_wizard', ['stage'=>'title']);
        send_msg($chat_id, "📂 <b>افزودن دسته مرحله‌ای</b>\n\nاسم دسته را بفرست.\nمثال: <code>گیفت‌کارت‌ها</code>", shop_cancel_keyboard());
        return true;
    }
    if ($data === 'adm_add_variant_manual') {
        set_step_payload($chat_id, 'admin_variant_wizard', ['stage'=>'product']);
        $rows = product_rows_keyboard('varwiz_product_', true);
        $rows[] = [['text'=>'❌ لغو', 'callback_data'=>'adm_shop']];
        send_or_edit($chat_id, $message_id, "🧩 <b>افزودن پلن مرحله‌ای</b>\n\nاول محصول را انتخاب کن:", json_markup(['inline_keyboard'=>$rows]));
        return true;
    }
    if ($data === 'adm_add_inventory') {
        set_step_payload($chat_id, 'admin_inventory_wizard', ['stage'=>'product','count'=>0]);
        $rows = product_rows_keyboard('invwiz_product_', true);
        $rows[] = [['text'=>'❌ لغو', 'callback_data'=>'adm_shop']];
        send_or_edit($chat_id, $message_id, "📥 <b>افزودن انبار دستی مرحله‌ای</b>\n\nاول محصول را انتخاب کن:", json_markup(['inline_keyboard'=>$rows]));
        return true;
    }
    if (str_starts_with($data, 'prodwiz_cat_')) {
        $catId=(int)substr($data,12);
        set_step_payload($chat_id, 'admin_product_wizard', ['stage'=>'name','category_id'=>$catId ?: null]);
        send_msg($chat_id, "نام محصول را بفرست.\nمثال: <code>تلگرام پریمیوم ۳ ماهه</code>", shop_cancel_keyboard());
        return true;
    }
    if (str_starts_with($data, 'prodwiz_delivery_')) {
        $payload=step_payload_array(get_user_by_tid($chat_id));
        $payload['delivery_type']=substr($data,17);
        $payload['stage']='commission_type';
        set_step_payload($chat_id, 'admin_product_wizard', $payload);
        send_msg($chat_id, "نوع پورسانت معرف را انتخاب کن:", json_markup(['inline_keyboard'=>[
            [['text'=>'بدون پورسانت', 'callback_data'=>'prodwiz_commission_none']],
            [['text'=>'مبلغ ثابت', 'callback_data'=>'prodwiz_commission_fixed'], ['text'=>'درصدی', 'callback_data'=>'prodwiz_commission_percent']],
            [['text'=>'❌ لغو', 'callback_data'=>'adm_shop']],
        ]]));
        return true;
    }
    if (str_starts_with($data, 'prodwiz_commission_')) {
        $type=substr($data,19);
        $payload=step_payload_array(get_user_by_tid($chat_id));
        $payload['commission_type']=$type;
        if ($type==='none') {
            $payload['commission_value']=0; $payload['stage']='duration';
            set_step_payload($chat_id, 'admin_product_wizard', $payload);
            send_msg($chat_id, "مدت محصول به روز را بفرست. اگر مدت ندارد، <code>0</code> بفرست.", shop_cancel_keyboard());
        } else {
            $payload['stage']='commission_value';
            set_step_payload($chat_id, 'admin_product_wizard', $payload);
            $label = $type==='fixed' ? 'مبلغ ثابت پورسانت به تومان' : 'درصد پورسانت از مبلغ سفارش';
            send_msg($chat_id, "{$label} را بفرست.\nمثال: <code>20000</code> یا <code>10</code>", shop_cancel_keyboard());
        }
        return true;
    }
    if ($data === 'prodwiz_skip_image') {
        $payload=step_payload_array(get_user_by_tid($chat_id));
        $payload['image_url']=null; $payload['stage']='featured';
        set_step_payload($chat_id, 'admin_product_wizard', $payload);
        send_msg($chat_id, "محصول ویژه باشد؟", json_markup(['inline_keyboard'=>[
            [['text'=>'⭐ بله ویژه باشد', 'callback_data'=>'prodwiz_featured_1'], ['text'=>'معمولی باشد', 'callback_data'=>'prodwiz_featured_0']],
            [['text'=>'❌ لغو', 'callback_data'=>'adm_shop']],
        ]]));
        return true;
    }
    if (str_starts_with($data, 'prodwiz_featured_')) {
        $payload=step_payload_array(get_user_by_tid($chat_id));
        $payload['is_featured']=(int)substr($data,17) ? 1 : 0;
        $pid=create_product_from_wizard($payload);
        clear_step($chat_id);
        send_msg($chat_id, "✅ محصول مرحله‌ای ساخته شد.\nمحصول: <code>#{$pid}</code>\nنام: <b>".h($payload['name'] ?? '')."</b>", admin_shop_keyboard());
        show_admin_products($chat_id);
        return true;
    }
    if ($data === 'catwiz_skip_image') {
        $payload=step_payload_array(get_user_by_tid($chat_id));
        $payload['image_url']=null;
        $cid=create_category_from_wizard($payload);
        clear_step($chat_id);
        send_msg($chat_id, "✅ دسته ساخته شد: <code>#{$cid}</code>", admin_shop_keyboard());
        return true;
    }
    if (str_starts_with($data, 'varwiz_product_')) {
        $pid=(int)substr($data,15);
        set_step_payload($chat_id, 'admin_variant_wizard', ['stage'=>'title','product_id'=>$pid]);
        send_msg($chat_id, "نام پلن را بفرست.\nمثال: <code>۱۰ گیگ - ۳۰ روزه</code>", shop_cancel_keyboard());
        return true;
    }
    if (str_starts_with($data, 'invwiz_product_')) {
        $pid=(int)substr($data,15);
        set_step_payload($chat_id, 'admin_inventory_wizard', ['stage'=>'variant','product_id'=>$pid,'count'=>0]);
        $rows=variant_rows_keyboard($pid, 'invwiz_variant_');
        $rows[]=[['text'=>'❌ لغو', 'callback_data'=>'adm_shop']];
        send_msg($chat_id, "اگر این آیتم انبار برای یک پلن خاص است، پلن را انتخاب کن؛ وگرنه «بدون پلن» را بزن.", json_markup(['inline_keyboard'=>$rows]));
        return true;
    }
    if (str_starts_with($data, 'invwiz_variant_')) {
        $vid=(int)substr($data,15);
        $payload=step_payload_array(get_user_by_tid($chat_id));
        $payload['variant_id']=$vid ?: null; $payload['stage']='content'; $payload['count']=$payload['count'] ?? 0;
        set_step_payload($chat_id, 'admin_inventory_wizard', $payload);
        send_msg($chat_id, "حالا آیتم انبار را بفرست.\nمثال برای اکانت: <code>email@test.com | pass123</code>\nمثال برای VPN: <code>https://sub...</code>\n\nهر پیام = یک آیتم. برای پایان دکمه «تمام» را بزن.", json_markup(['inline_keyboard'=>[[['text'=>'✅ تمام', 'callback_data'=>'invwiz_finish']], [['text'=>'❌ لغو', 'callback_data'=>'adm_shop']]]]));
        return true;
    }
    if ($data === 'invwiz_finish') {
        $payload=step_payload_array(get_user_by_tid($chat_id));
        $count=(int)($payload['count'] ?? 0);
        clear_step($chat_id);
        send_msg($chat_id, "✅ افزودن انبار تمام شد.\nتعداد آیتم‌های اضافه‌شده: <b>{$count}</b>", admin_shop_keyboard());
        return true;
    }

    // Full CRUD management menus
    if (str_starts_with($data, 'prod_manage_')) {
        $pid=(int)substr($data,12); $p=shop_product($pid);
        if(!$p){ send_or_edit($chat_id,$message_id,'محصول پیدا نشد.',admin_shop_keyboard()); return true; }
        $txt="📦 <b>محصول #{$pid}</b>\nنام: <b>".h($p['name'])."</b>\nقیمت: <b>".product_price_label($p)."</b>\nدسته: <b>".h(($p['category_emoji']?:'').' '.($p['category_title']?:'بدون دسته'))."</b>\nوضعیت: <b>".((int)$p['is_active']?'فعال':'غیرفعال')."</b>\nویژه: <b>".((int)($p['is_featured']??0)?'بله':'خیر')."</b>";
        $kb=json_markup(['inline_keyboard'=>[
            [['text'=>'✏️ ویرایش کامل', 'callback_data'=>'prod_edit_'.$pid], ['text'=>'🖼 عکس', 'callback_data'=>'prod_image_'.$pid]],
            [['text'=>((int)$p['is_active']?'⛔️ غیرفعال کن':'✅ فعال کن'), 'callback_data'=>'prod_toggle_'.$pid], ['text'=>'🧩 پلن جدید', 'callback_data'=>'adm_add_variant_'.$pid]],
            [['text'=>'🗑 حذف کامل', 'callback_data'=>'hard_product_'.$pid], ['text'=>'🫥 حذف/غیرفعال', 'callback_data'=>'prod_delete_'.$pid]],
            [['text'=>'🔙 محصولات', 'callback_data'=>'adm_products']],
        ]]);
        send_or_edit($chat_id,$message_id,$txt,$kb); return true;
    }
    if (str_starts_with($data, 'prod_edit_')) {
        $pid=(int)substr($data,10);
        $rows=[
            [['text'=>'نام', 'callback_data'=>'edit_product_'.$pid.'_name'], ['text'=>'قیمت', 'callback_data'=>'edit_product_'.$pid.'_price']],
            [['text'=>'دسته‌بندی', 'callback_data'=>'edit_product_'.$pid.'_category_id'], ['text'=>'نوع تحویل', 'callback_data'=>'edit_product_'.$pid.'_delivery_type']],
            [['text'=>'نوع پورسانت', 'callback_data'=>'edit_product_'.$pid.'_commission_type'], ['text'=>'مقدار پورسانت', 'callback_data'=>'edit_product_'.$pid.'_commission_value']],
            [['text'=>'مدت', 'callback_data'=>'edit_product_'.$pid.'_duration_days'], ['text'=>'توضیح کوتاه', 'callback_data'=>'edit_product_'.$pid.'_short_description']],
            [['text'=>'توضیح کامل', 'callback_data'=>'edit_product_'.$pid.'_full_description'], ['text'=>'عکس', 'callback_data'=>'prod_image_'.$pid]],
            [['text'=>'ویژه/معمولی', 'callback_data'=>'edit_product_'.$pid.'_is_featured'], ['text'=>'فعال/غیرفعال', 'callback_data'=>'prod_toggle_'.$pid]],
            [['text'=>'🔙 محصول', 'callback_data'=>'prod_manage_'.$pid]],
        ];
        send_or_edit($chat_id,$message_id,"✏️ کدام بخش محصول <code>#{$pid}</code> ویرایش شود؟",json_markup(['inline_keyboard'=>$rows])); return true;
    }
    if (preg_match('/^edit_product_(\d+)_(.+)$/', $data, $m)) {
        $pid=(int)$m[1]; $field=$m[2];
        if ($field==='category_id') { $rows=category_rows_keyboard('editprodcat_'.$pid.'_'); $rows[]=[['text'=>'🔙 محصول', 'callback_data'=>'prod_manage_'.$pid]]; send_or_edit($chat_id,$message_id,'دسته جدید محصول را انتخاب کن:',json_markup(['inline_keyboard'=>$rows])); return true; }
        if ($field==='delivery_type') { $rows=[[['text'=>'دستی','callback_data'=>'editval_product_'.$pid.'_delivery_type_manual'],['text'=>'اکانت','callback_data'=>'editval_product_'.$pid.'_delivery_type_account']],[['text'=>'VPN','callback_data'=>'editval_product_'.$pid.'_delivery_type_vpn'],['text'=>'کد/گیفت','callback_data'=>'editval_product_'.$pid.'_delivery_type_code']],[['text'=>'فایل/متن','callback_data'=>'editval_product_'.$pid.'_delivery_type_file']],[['text'=>'🔙 محصول','callback_data'=>'prod_manage_'.$pid]]]; send_or_edit($chat_id,$message_id,'نوع تحویل جدید را انتخاب کن:',json_markup(['inline_keyboard'=>$rows])); return true; }
        if ($field==='commission_type') { $rows=[[['text'=>'بدون','callback_data'=>'editval_product_'.$pid.'_commission_type_none'],['text'=>'ثابت','callback_data'=>'editval_product_'.$pid.'_commission_type_fixed'],['text'=>'درصدی','callback_data'=>'editval_product_'.$pid.'_commission_type_percent']],[['text'=>'🔙 محصول','callback_data'=>'prod_manage_'.$pid]]]; send_or_edit($chat_id,$message_id,'نوع پورسانت را انتخاب کن:',json_markup(['inline_keyboard'=>$rows])); return true; }
        if ($field==='is_featured') { $p=shop_product($pid); update_product_field($pid,'is_featured', empty($p['is_featured'])?1:0); send_or_edit($chat_id,$message_id,'✅ وضعیت ویژه تغییر کرد.', json_markup(['inline_keyboard'=>[[['text'=>'بازگشت به محصول','callback_data'=>'prod_manage_'.$pid]]]])); return true; }
        set_step_payload($chat_id,'admin_edit_entity',['type'=>'product','id'=>$pid,'field'=>$field]);
        send_msg($chat_id,"مقدار جدید برای <code>{$field}</code> محصول <code>#{$pid}</code> را بفرست.",shop_cancel_keyboard()); return true;
    }
    if (preg_match('/^editprodcat_(\d+)_(\d+)$/',$data,$m)) { update_product_field((int)$m[1],'category_id',(int)$m[2]); send_or_edit($chat_id,$message_id,'✅ دسته‌بندی محصول تغییر کرد.',json_markup(['inline_keyboard'=>[[['text'=>'بازگشت به محصول','callback_data'=>'prod_manage_'.$m[1]]]]])); return true; }
    if (preg_match('/^editval_product_(\d+)_(delivery_type|commission_type)_(.+)$/',$data,$m)) { update_product_field((int)$m[1],$m[2],$m[3]); send_or_edit($chat_id,$message_id,'✅ تغییر ذخیره شد.',json_markup(['inline_keyboard'=>[[['text'=>'بازگشت به محصول','callback_data'=>'prod_manage_'.$m[1]]]]])); return true; }
    if (str_starts_with($data, 'hard_product_')) { $pid=(int)substr($data,13); $ok=hard_delete_product($pid); send_or_edit($chat_id,$message_id,$ok?"✅ محصول #{$pid} کامل حذف شد.":"این محصول سفارش ثبت‌شده دارد؛ برای حفظ سوابق فقط غیرفعال‌سازی امن است.", admin_shop_keyboard()); return true; }

    if (str_starts_with($data, 'cat_manage_')) {
        $cid=(int)substr($data,11); $q=db()->prepare('SELECT * FROM product_categories WHERE id=?'); $q->execute([$cid]); $c=$q->fetch();
        if(!$c){send_or_edit($chat_id,$message_id,'دسته پیدا نشد.',admin_shop_keyboard());return true;}
        $txt="📂 <b>دسته #{$cid}</b>\n".h(($c['emoji']?:'🛒').' '.$c['title'])."\nوضعیت: <b>".((int)$c['is_active']?'فعال':'غیرفعال')."</b>";
        $rows=[[['text'=>'نام','callback_data'=>'edit_category_'.$cid.'_title'],['text'=>'اموجی','callback_data'=>'edit_category_'.$cid.'_emoji']],[['text'=>'عکس','callback_data'=>'cat_image_'.$cid],['text'=>((int)$c['is_active']?'غیرفعال':'فعال'),'callback_data'=>'edit_category_'.$cid.'_is_active']],[['text'=>'🗑 حذف کامل','callback_data'=>'hard_category_'.$cid],['text'=>'🫥 حذف/غیرفعال','callback_data'=>'cat_delete_'.$cid]],[['text'=>'🔙 دسته‌بندی‌ها','callback_data'=>'adm_categories']]];
        send_or_edit($chat_id,$message_id,$txt,json_markup(['inline_keyboard'=>$rows])); return true;
    }
    if (preg_match('/^edit_category_(\d+)_(.+)$/',$data,$m)) { $cid=(int)$m[1]; $field=$m[2]; if($field==='is_active'){ $q=db()->prepare('SELECT is_active FROM product_categories WHERE id=?');$q->execute([$cid]);$r=$q->fetch(); update_category_field($cid,'is_active',empty($r['is_active'])?1:0); send_or_edit($chat_id,$message_id,'✅ وضعیت دسته تغییر کرد.',json_markup(['inline_keyboard'=>[[['text'=>'بازگشت','callback_data'=>'cat_manage_'.$cid]]]])); return true;} set_step_payload($chat_id,'admin_edit_entity',['type'=>'category','id'=>$cid,'field'=>$field]); send_msg($chat_id,"مقدار جدید <code>{$field}</code> دسته <code>#{$cid}</code> را بفرست.",shop_cancel_keyboard()); return true; }
    if (str_starts_with($data,'hard_category_')) { $cid=(int)substr($data,14); $ok=hard_delete_category($cid); send_or_edit($chat_id,$message_id,$ok?"✅ دسته #{$cid} کامل حذف شد.":"حذف کامل دسته انجام نشد.",admin_shop_keyboard()); return true; }

    if (str_starts_with($data, 'variant_manage_')) {
        $vid=(int)substr($data,15); $v=product_variant($vid); if(!$v){send_or_edit($chat_id,$message_id,'پلن پیدا نشد.',admin_shop_keyboard());return true;}
        $rows=[[['text'=>'نام پلن','callback_data'=>'edit_variant_'.$vid.'_title'],['text'=>'قیمت','callback_data'=>'edit_variant_'.$vid.'_price']],[['text'=>'مدت','callback_data'=>'edit_variant_'.$vid.'_duration_days'],['text'=>((int)$v['is_active']?'غیرفعال':'فعال'),'callback_data'=>'edit_variant_'.$vid.'_is_active']],[['text'=>'🗑 حذف کامل','callback_data'=>'hard_variant_'.$vid],['text'=>'🫥 حذف/غیرفعال','callback_data'=>'variant_delete_'.$vid]],[['text'=>'🔙 پلن‌ها','callback_data'=>'adm_variants']]];
        send_or_edit($chat_id,$message_id,"🧩 <b>پلن #{$vid}</b>\nمحصول: <b>".h($v['product_name'])."</b>\nنام: <b>".h($v['title'])."</b>\nقیمت: <b>".money($v['price'])."</b>",json_markup(['inline_keyboard'=>$rows])); return true;
    }
    if (preg_match('/^edit_variant_(\d+)_(.+)$/',$data,$m)) { $vid=(int)$m[1]; $field=$m[2]; if($field==='is_active'){ $v=product_variant($vid); update_variant_field($vid,'is_active',empty($v['is_active'])?1:0); send_or_edit($chat_id,$message_id,'✅ وضعیت پلن تغییر کرد.',json_markup(['inline_keyboard'=>[[['text'=>'بازگشت','callback_data'=>'variant_manage_'.$vid]]]])); return true;} set_step_payload($chat_id,'admin_edit_entity',['type'=>'variant','id'=>$vid,'field'=>$field]); send_msg($chat_id,"مقدار جدید <code>{$field}</code> پلن <code>#{$vid}</code> را بفرست.",shop_cancel_keyboard()); return true; }
    if (str_starts_with($data,'hard_variant_')) { $vid=(int)substr($data,13); $ok=hard_delete_variant($vid); send_or_edit($chat_id,$message_id,$ok?"✅ پلن #{$vid} کامل حذف شد.":"این پلن سفارش ثبت‌شده دارد؛ برای حفظ سوابق فقط غیرفعال شدنی است.",admin_shop_keyboard()); return true; }

    if (str_starts_with($data, 'inv_manage_')) {
        $iid=(int)substr($data,11); $q=db()->prepare('SELECT i.*, p.name product_name, v.title variant_title FROM inventory_items i JOIN products p ON p.id=i.product_id LEFT JOIN product_variants v ON v.id=i.variant_id WHERE i.id=?'); $q->execute([$iid]); $i=$q->fetch();
        if(!$i){send_or_edit($chat_id,$message_id,'آیتم انبار پیدا نشد.',admin_shop_keyboard());return true;}
        $txt="📥 <b>آیتم انبار #{$iid}</b>\nمحصول: <b>".h($i['product_name'])."</b>\nپلن: <b>".h($i['variant_title']?:'ندارد')."</b>\nوضعیت: <b>".h($i['status'])."</b>\n\n<code>".h($i['content'])."</code>";
        $rows=[[['text'=>'ویرایش محتوا','callback_data'=>'edit_inventory_'.$iid.'_content'],['text'=>'وضعیت','callback_data'=>'edit_inventory_'.$iid.'_status']],[['text'=>'🗑 حذف کامل','callback_data'=>'hard_inventory_'.$iid],['text'=>'حذف امن','callback_data'=>'inv_delete_'.$iid]],[['text'=>'🔙 انبار','callback_data'=>'adm_inventory']]];
        send_or_edit($chat_id,$message_id,$txt,json_markup(['inline_keyboard'=>$rows])); return true;
    }
    if (preg_match('/^edit_inventory_(\d+)_(.+)$/',$data,$m)) { $iid=(int)$m[1]; $field=$m[2]; if($field==='status'){ $rows=[[['text'=>'available','callback_data'=>'editval_inventory_'.$iid.'_status_available'],['text'=>'disabled','callback_data'=>'editval_inventory_'.$iid.'_status_disabled']],[['text'=>'reserved','callback_data'=>'editval_inventory_'.$iid.'_status_reserved'],['text'=>'delivered','callback_data'=>'editval_inventory_'.$iid.'_status_delivered']],[['text'=>'🔙 آیتم','callback_data'=>'inv_manage_'.$iid]]]; send_or_edit($chat_id,$message_id,'وضعیت جدید آیتم را انتخاب کن:',json_markup(['inline_keyboard'=>$rows])); return true;} set_step_payload($chat_id,'admin_edit_entity',['type'=>'inventory','id'=>$iid,'field'=>$field]); send_msg($chat_id,"مقدار جدید <code>{$field}</code> آیتم <code>#{$iid}</code> را بفرست.",shop_cancel_keyboard()); return true; }
    if (preg_match('/^editval_inventory_(\d+)_status_(.+)$/',$data,$m)) { update_inventory_field((int)$m[1],'status',$m[2]); send_or_edit($chat_id,$message_id,'✅ وضعیت آیتم تغییر کرد.',json_markup(['inline_keyboard'=>[[['text'=>'بازگشت','callback_data'=>'inv_manage_'.$m[1]]]]])); return true; }
    if (str_starts_with($data,'hard_inventory_')) { $iid=(int)substr($data,15); $ok=hard_delete_inventory($iid); send_or_edit($chat_id,$message_id,$ok?"✅ آیتم #{$iid} کامل حذف شد.":"حذف انجام نشد.",admin_shop_keyboard()); return true; }

    if (str_starts_with($data, 'prod_image_')) {
        $pid=(int)substr($data,11);
        set_step($chat_id, 'admin_product_image', (string)$pid);
        send_msg($chat_id, "🖼 عکس جدید محصول <code>#{$pid}</code> را بفرست.\nمی‌توانی عکس را همینجا آپلود کنی یا لینک عکس را بفرستی.", json_markup(['inline_keyboard'=>[[['text'=>'حذف عکس', 'callback_data'=>'prod_image_clear_'.$pid]], [['text'=>'❌ لغو', 'callback_data'=>'adm_products']]]]));
        return true;
    }
    if (str_starts_with($data, 'prod_image_clear_')) {
        $pid=(int)substr($data,17); set_product_image($pid, null); clear_step($chat_id); send_msg($chat_id, "✅ عکس محصول #{$pid} حذف شد.", admin_shop_keyboard()); return true;
    }
    if (str_starts_with($data, 'cat_image_')) {
        $cid=(int)substr($data,10);
        set_step($chat_id, 'admin_category_image', (string)$cid);
        send_msg($chat_id, "🖼 عکس جدید دسته <code>#{$cid}</code> را بفرست.\nمی‌توانی عکس را آپلود کنی یا لینک عکس را بفرستی.", json_markup(['inline_keyboard'=>[[['text'=>'حذف عکس', 'callback_data'=>'cat_image_clear_'.$cid]], [['text'=>'❌ لغو', 'callback_data'=>'adm_categories']]]]));
        return true;
    }
    if (str_starts_with($data, 'cat_image_clear_')) {
        $cid=(int)substr($data,16); set_category_image($cid, null); clear_step($chat_id); send_msg($chat_id, "✅ عکس دسته #{$cid} حذف شد.", admin_shop_keyboard()); return true;
    }
    if (str_starts_with($data, 'prod_delete_')) { $pid=(int)substr($data,12); soft_delete_product($pid); send_msg($chat_id, "✅ محصول #{$pid} از فروشگاه حذف/غیرفعال شد؛ سفارش‌های قبلی حفظ شدند.", admin_shop_keyboard()); return true; }
    if (str_starts_with($data, 'cat_delete_')) { $cid=(int)substr($data,11); soft_delete_category($cid); send_msg($chat_id, "✅ دسته #{$cid} از فروشگاه پنهان شد.", admin_shop_keyboard()); return true; }
    if (str_starts_with($data, 'inv_delete_')) { $iid=(int)substr($data,11); $ok=delete_available_inventory($iid); send_msg($chat_id, $ok ? "✅ آیتم انبار #{$iid} حذف شد." : "این آیتم قابل حذف نیست یا قبلاً تحویل شده.", admin_shop_keyboard()); return true; }
    if (str_starts_with($data, 'variant_delete_')) { $vid=(int)substr($data,15); soft_delete_variant($vid); send_msg($chat_id, "✅ پلن #{$vid} حذف/غیرفعال شد.", admin_shop_keyboard()); return true; }
    return false;
}

function handle_shop_admin_v2_message(int $chat_id, array $user, array $message): bool {
    $step=(string)($user['step'] ?? '');
    if (!in_array($step, ['admin_product_wizard','admin_category_wizard','admin_variant_wizard','admin_inventory_wizard','admin_product_image','admin_category_image','admin_edit_entity'], true)) return false;
    if (!is_admin($chat_id)) { clear_step($chat_id); send_msg($chat_id, 'این مرحله فقط برای ادمین است.', main_menu_keyboard(false)); return true; }
    $text=trim((string)($message['text'] ?? $message['caption'] ?? ''));
    $payload=step_payload_array($user);

    if ($step === 'admin_edit_entity') {
        $type=$payload['type'] ?? ''; $id=(int)($payload['id'] ?? 0); $field=(string)($payload['field'] ?? '');
        $ok=false;
        if ($type==='product') $ok=update_product_field($id,$field,$text);
        elseif ($type==='category') $ok=update_category_field($id,$field,$text);
        elseif ($type==='variant') $ok=update_variant_field($id,$field,$text);
        elseif ($type==='inventory') $ok=update_inventory_field($id,$field,$text);
        clear_step($chat_id);
        send_msg($chat_id, $ok ? "✅ ویرایش ذخیره شد." : "ویرایش انجام نشد؛ فیلد معتبر نیست.", admin_shop_keyboard());
        return true;
    }

    if ($step === 'admin_product_image') {
        $pid=(int)$user['step_payload']; $url=image_url_from_message($message, 'products');
        if (!$url) { send_msg($chat_id, 'عکس یا لینک معتبر دریافت نشد. دوباره بفرست یا لغو کن.', shop_cancel_keyboard()); return true; }
        set_product_image($pid, $url); clear_step($chat_id); send_msg($chat_id, "✅ عکس محصول #{$pid} ذخیره شد.", admin_shop_keyboard()); return true;
    }
    if ($step === 'admin_category_image') {
        $cid=(int)$user['step_payload']; $url=image_url_from_message($message, 'categories');
        if (!$url) { send_msg($chat_id, 'عکس یا لینک معتبر دریافت نشد. دوباره بفرست یا لغو کن.', shop_cancel_keyboard()); return true; }
        set_category_image($cid, $url); clear_step($chat_id); send_msg($chat_id, "✅ عکس دسته #{$cid} ذخیره شد.", admin_shop_keyboard()); return true;
    }
    if ($step === 'admin_category_wizard') {
        $stage=$payload['stage'] ?? 'title';
        if ($stage==='title') { if ($text==='') { send_msg($chat_id, 'اسم دسته خالی است.', shop_cancel_keyboard()); return true; } $payload['title']=$text; $payload['stage']='emoji'; set_step_payload($chat_id,$step,$payload); send_msg($chat_id, "اموجی دسته را بفرست. اگر نمی‌خوای، <code>-</code> بفرست.", shop_cancel_keyboard()); return true; }
        if ($stage==='emoji') { $payload['emoji']=($text==='-'||$text==='')?'🛒':mb_substr($text,0,4); $payload['stage']='image'; set_step_payload($chat_id,$step,$payload); send_msg($chat_id, "عکس دسته را بفرست یا لینک عکس بده. اگر عکس نمی‌خوای دکمه زیر را بزن.", json_markup(['inline_keyboard'=>[[['text'=>'بدون عکس ادامه بده', 'callback_data'=>'catwiz_skip_image']], [['text'=>'❌ لغو', 'callback_data'=>'adm_shop']]]])); return true; }
        if ($stage==='image') { $url=image_url_from_message($message, 'categories'); if (!$url) { send_msg($chat_id, 'لطفاً عکس/لینک معتبر بفرست یا دکمه بدون عکس را بزن.', shop_cancel_keyboard()); return true; } $payload['image_url']=$url; $cid=create_category_from_wizard($payload); clear_step($chat_id); send_msg($chat_id, "✅ دسته ساخته شد: <code>#{$cid}</code>", admin_shop_keyboard()); return true; }
    }
    if ($step === 'admin_product_wizard') {
        $stage=$payload['stage'] ?? 'name';
        if ($stage==='name') { if ($text==='') { send_msg($chat_id, 'نام محصول خالی است.', shop_cancel_keyboard()); return true; } $payload['name']=$text; $payload['stage']='price'; set_step_payload($chat_id,$step,$payload); send_msg($chat_id, 'قیمت پایه محصول را به تومان بفرست. مثال: <code>276000</code>', shop_cancel_keyboard()); return true; }
        if ($stage==='price') { $amount=parse_amount($text); if($amount<=0){send_msg($chat_id,'قیمت معتبر نیست.',shop_cancel_keyboard()); return true;} $payload['price']=$amount; $payload['stage']='delivery'; set_step_payload($chat_id,$step,$payload); send_msg($chat_id, 'نوع تحویل را انتخاب کن:', json_markup(['inline_keyboard'=>[
            [['text'=>'دستی', 'callback_data'=>'prodwiz_delivery_manual'], ['text'=>'اکانت', 'callback_data'=>'prodwiz_delivery_account']],
            [['text'=>'VPN / لینک ساب', 'callback_data'=>'prodwiz_delivery_vpn'], ['text'=>'کد/گیفت', 'callback_data'=>'prodwiz_delivery_code']],
            [['text'=>'فایل/متن', 'callback_data'=>'prodwiz_delivery_file']],
            [['text'=>'❌ لغو', 'callback_data'=>'adm_shop']],
        ]])); return true; }
        if ($stage==='commission_value') { $val=parse_amount($text); if(($payload['commission_type']??'')==='percent') $val=min(100,$val); $payload['commission_value']=$val; $payload['stage']='duration'; set_step_payload($chat_id,$step,$payload); send_msg($chat_id, 'مدت محصول به روز را بفرست. اگر مدت ندارد، <code>0</code> بفرست.', shop_cancel_keyboard()); return true; }
        if ($stage==='duration') { $payload['duration_days']=parse_amount($text); $payload['stage']='short'; set_step_payload($chat_id,$step,$payload); send_msg($chat_id, 'توضیح کوتاه محصول را بفرست. این متن روی کارت محصول نمایش داده می‌شود.', shop_cancel_keyboard()); return true; }
        if ($stage==='short') { $payload['short_description']=$text; $payload['stage']='full'; set_step_payload($chat_id,$step,$payload); send_msg($chat_id, 'توضیح کامل محصول را بفرست. اگر همان توضیح کوتاه کافی است، <code>-</code> بفرست.', shop_cancel_keyboard()); return true; }
        if ($stage==='full') { $payload['full_description']=($text==='-'||$text==='')?($payload['short_description']??''):$text; $payload['stage']='image'; set_step_payload($chat_id,$step,$payload); send_msg($chat_id, 'عکس محصول را بفرست یا لینک عکس بده. اگر عکس نمی‌خوای دکمه زیر را بزن.', json_markup(['inline_keyboard'=>[[['text'=>'بدون عکس ادامه بده', 'callback_data'=>'prodwiz_skip_image']], [['text'=>'❌ لغو', 'callback_data'=>'adm_shop']]]])); return true; }
        if ($stage==='image') { $url=image_url_from_message($message, 'products'); if (!$url) { send_msg($chat_id, 'لطفاً عکس/لینک معتبر بفرست یا دکمه بدون عکس را بزن.', shop_cancel_keyboard()); return true; } $payload['image_url']=$url; $payload['stage']='featured'; set_step_payload($chat_id,$step,$payload); send_msg($chat_id, 'محصول ویژه باشد؟', json_markup(['inline_keyboard'=>[[['text'=>'⭐ بله ویژه باشد', 'callback_data'=>'prodwiz_featured_1'], ['text'=>'معمولی باشد', 'callback_data'=>'prodwiz_featured_0']], [['text'=>'❌ لغو', 'callback_data'=>'adm_shop']]]])); return true; }
    }
    if ($step === 'admin_variant_wizard') {
        $stage=$payload['stage'] ?? 'title';
        if ($stage==='title') { $payload['title']=$text; $payload['stage']='price'; set_step_payload($chat_id,$step,$payload); send_msg($chat_id, 'قیمت این پلن را بفرست.', shop_cancel_keyboard()); return true; }
        if ($stage==='price') { $amount=parse_amount($text); if($amount<=0){send_msg($chat_id,'قیمت معتبر نیست.',shop_cancel_keyboard());return true;} $payload['price']=$amount; $payload['stage']='duration'; set_step_payload($chat_id,$step,$payload); send_msg($chat_id, 'مدت این پلن به روز را بفرست. اگر ندارد 0 بفرست.', shop_cancel_keyboard()); return true; }
        if ($stage==='duration') { $duration=parse_amount($text); db()->prepare('INSERT INTO product_variants (product_id,title,price,duration_days,sort_order) VALUES (?,?,?,?,99)')->execute([(int)$payload['product_id'], $payload['title'], (int)$payload['price'], $duration]); $vid=(int)db()->lastInsertId(); clear_step($chat_id); send_msg($chat_id, "✅ پلن ساخته شد: <code>#{$vid}</code>", admin_shop_keyboard()); return true; }
    }
    if ($step === 'admin_inventory_wizard') {
        $stage=$payload['stage'] ?? 'content';
        if ($stage==='content') {
            if ($text==='') { send_msg($chat_id, 'آیتم خالی است. متن/لینک/ایمیل‌پسورد را بفرست یا تمام کن.', shop_cancel_keyboard()); return true; }
            $items = array_values(array_filter(array_map('trim', preg_split('/\R/u', $text))));
            $q=db()->prepare('INSERT INTO inventory_items (product_id, variant_id, content) VALUES (?,?,?)'); $added=0;
            foreach ($items as $item) { if ($item==='') continue; $q->execute([(int)$payload['product_id'], !empty($payload['variant_id'])?(int)$payload['variant_id']:null, $item]); $added++; }
            $payload['count']=(int)($payload['count'] ?? 0)+$added; set_step_payload($chat_id,$step,$payload);
            send_msg($chat_id, "✅ {$added} آیتم ذخیره شد. مجموع این مرحله: <b>{$payload['count']}</b>\nآیتم بعدی را بفرست یا تمام کن.", json_markup(['inline_keyboard'=>[[['text'=>'✅ تمام', 'callback_data'=>'invwiz_finish']], [['text'=>'❌ لغو', 'callback_data'=>'adm_shop']]]]));
            return true;
        }
    }
    return false;
}
