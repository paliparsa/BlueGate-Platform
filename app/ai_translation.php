<?php
/**
 * BlueGate shared AI translation layer.
 * Uses an OpenAI-compatible Chat Completions endpoint when configured.
 * Never expose provider credentials to browser clients.
 */
function bg_ai_translation_enabled(): bool {
    return trim((string)app_config('TRANSLATION_AI_API_KEY', app_config('OPENAI_API_KEY', ''))) !== '';
}
function bg_ai_translation_ensure_cache(): void {
    static $ready = false;
    if ($ready) return;
    db()->exec("CREATE TABLE IF NOT EXISTS ai_translation_cache (
        cache_key CHAR(64) NOT NULL PRIMARY KEY,
        source_text TEXT NOT NULL,
        target_language VARCHAR(8) NOT NULL,
        context_label VARCHAR(80) NOT NULL DEFAULT 'ui',
        translated_text TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_ai_translation_target (target_language)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    db()->exec("CREATE TABLE IF NOT EXISTS ai_translation_user_languages (
        telegram_id BIGINT NOT NULL PRIMARY KEY,
        language_code VARCHAR(16) NOT NULL DEFAULT 'fa',
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $ready = true;
}
function bg_ai_set_telegram_language(int $telegramId, string $languageCode): void {
    if ($telegramId <= 0) return;
    $raw = strtolower(trim($languageCode));
    $language = ($raw === 'fa' || str_starts_with($raw, 'fa-')) ? 'fa' : (($raw === '' || $raw === 'und') ? 'fa' : 'en');
    try {
        bg_ai_translation_ensure_cache();
        db()->prepare('INSERT INTO ai_translation_user_languages(telegram_id,language_code) VALUES(?,?) ON DUPLICATE KEY UPDATE language_code=VALUES(language_code),updated_at=CURRENT_TIMESTAMP')->execute([$telegramId,$language]);
    } catch (Throwable $e) { error_log('[BlueGate translation language] '.$e->getMessage()); }
}
function bg_ai_telegram_language(int $telegramId): string {
    if ($telegramId <= 0) return 'fa';
    try {
        bg_ai_translation_ensure_cache();
        $q=db()->prepare('SELECT language_code FROM ai_translation_user_languages WHERE telegram_id=? LIMIT 1');
        $q->execute([$telegramId]); $v=strtolower(trim((string)$q->fetchColumn()));
        return $v === 'en' ? 'en' : 'fa';
    } catch (Throwable $e) { return 'fa'; }
}
function bg_ai_translation_cache_key(string $source, string $target, string $context): string {
    return hash('sha256', strtolower($target)."\0".$context."\0".trim(preg_replace('/\s+/u', ' ', $source) ?? $source));
}
function bg_ai_translation_protect(string $text): array {
    $tokens = [];
    $pattern = '~</?[a-zA-Z][^>]*>|https?://[^\s<>]+|www\.[^\s<>]+|\{[^{}]{1,100}\}|\$[A-Za-z_][A-Za-z0-9_]*|%[sdif]|@[A-Za-z0-9_]{4,}|[0-9][0-9,.:/%-]*~u';
    $safe = preg_replace_callback($pattern, function($m) use (&$tokens) {
        $token = 'BGPH'.count($tokens).'X';
        $tokens[$token] = $m[0];
        return $token;
    }, $text);
    return [(string)$safe, $tokens];
}
function bg_ai_translation_restore(string $text, array $tokens): string {
    foreach ($tokens as $token => $original) {
        if (!str_contains($text, $token)) return '';
        $text = str_replace($token, $original, $text);
    }
    return trim($text);
}
function bg_ai_translate_batch(array $texts, string $target='en', string $context='ui'): array {
    $target = strtolower(trim($target)) === 'fa' ? 'fa' : 'en';
    $context = preg_replace('/[^a-z0-9_-]/i', '', $context) ?: 'ui';
    $context = substr($context, 0, 80);
    $texts = array_values(array_unique(array_slice(array_filter(array_map(function($v) {
        return is_string($v) ? trim($v) : '';
    }, $texts), fn($v) => $v !== '' && mb_strlen($v) <= 500), 0, 20)));
    if (!$texts) return [];
    bg_ai_translation_ensure_cache();
    $out = []; $missing = [];
    $q = db()->prepare('SELECT translated_text FROM ai_translation_cache WHERE cache_key=? LIMIT 1');
    foreach ($texts as $text) {
        $key = bg_ai_translation_cache_key($text, $target, $context);
        $q->execute([$key]); $cached = $q->fetchColumn();
        if (is_string($cached) && trim($cached) !== '') $out[$text] = trim($cached);
        else $missing[] = $text;
    }
    if (!$missing) return $out;
    $apiKey = trim((string)app_config('TRANSLATION_AI_API_KEY', app_config('OPENAI_API_KEY', '')));
    $base = rtrim(trim((string)app_config('TRANSLATION_AI_BASE_URL', app_config('OPENAI_BASE_URL', 'https://api.openai.com/v1'))), '/');
    $model = trim((string)app_config('TRANSLATION_AI_MODEL', 'gpt-4o-mini'));
    if ($apiKey !== '' && function_exists('curl_init')) {
        $prepared = []; $protected = [];
        foreach ($missing as $i => $text) {
            [$safe, $tokens] = bg_ai_translation_protect($text);
            $prepared[] = ['id'=>$i, 'text'=>$safe]; $protected[$i] = ['source'=>$text, 'tokens'=>$tokens];
        }
        $languageName = $target === 'en' ? 'natural, concise English' : 'natural Persian (Farsi)';
        $system = 'You are the BlueGate product UI translator. Translate each item into '.$languageName.'. Context: '.$context.'. Preserve every BGPH<number>X token exactly, do not translate tokens, preserve meaning, product names, numbers, URLs, Telegram handles and markup. Return ONLY valid JSON in the exact shape {"translations":[{"id":0,"text":"..."}]}. Do not add explanations.';
        $payload = json_encode(['model'=>$model,'temperature'=>0,'response_format'=>['type'=>'json_object'],'messages'=>[['role'=>'system','content'=>$system],['role'=>'user','content'=>json_encode($prepared, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]]], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
        try {
            $ch = curl_init($base.'/chat/completions');
            curl_setopt_array($ch, [CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>$payload,CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>3,CURLOPT_TIMEOUT=>12,CURLOPT_HTTPHEADER=>['Authorization: Bearer '.$apiKey,'Content-Type: application/json']]);
            $raw = curl_exec($ch); $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
            if ($raw !== false && $status >= 200 && $status < 300) {
                $response = json_decode((string)$raw, true);
                $content = (string)($response['choices'][0]['message']['content'] ?? '');
                $json = json_decode($content, true);
                foreach (($json['translations'] ?? []) as $item) {
                    $id = (int)($item['id'] ?? -1); $translated = trim((string)($item['text'] ?? ''));
                    if (!isset($protected[$id]) || $translated === '') continue;
                    $translated = bg_ai_translation_restore($translated, $protected[$id]['tokens']);
                    if ($translated === '' || ($target === 'en' && preg_match('/[\x{0600}-\x{06FF}]/u', $translated))) continue;
                    $source = $protected[$id]['source']; $key = bg_ai_translation_cache_key($source, $target, $context);
                    db()->prepare('INSERT INTO ai_translation_cache(cache_key,source_text,target_language,context_label,translated_text) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE translated_text=VALUES(translated_text),updated_at=CURRENT_TIMESTAMP')->execute([$key,$source,$target,$context,$translated]);
                    $out[$source] = $translated;
                }
            } else {
                error_log('[BlueGate AI translation] Provider HTTP status '.$status);
            }
        } catch (Throwable $e) {
            error_log('[BlueGate AI translation] '.$e->getMessage());
        }
    }
    // Keep the existing catalog provider chain as a graceful Persian-to-English fallback.
    if ($target === 'en' && function_exists('catalog_translate_text')) {
        foreach ($missing as $source) {
            // The legacy provider chain is safe only for plain, single-line labels.
            // Never send HTML, placeholders, or multiline Telegram messages through it.
            if (!empty($out[$source]) || str_contains($source, '<') || str_contains($source, '>') || str_contains($source, "\n") || str_contains($source, "\r")) continue;
            if (!in_array($context, ['ui','telegram-button','telegram-alert','catalog'], true)) continue;
            try { $fallback = catalog_translate_text($source); if ($fallback !== '') $out[$source] = $fallback; } catch (Throwable $e) {}
        }
    }
    return $out;
}
function bg_ai_translate_text(string $text, string $target='en', string $context='ui'): string {
    $text = trim($text);
    if ($text === '') return $text;
    $result = bg_ai_translate_batch([$text], $target, $context);
    return (string)($result[$text] ?? $text);
}
function bg_ai_translate_telegram_markup(?string $markup, string $target='en'): ?string {
    if ($markup === null || $markup === '') return $markup;
    $data = json_decode($markup, true);
    if (!is_array($data)) return $markup;
    $paths = []; $texts = [];
    foreach (['inline_keyboard','keyboard'] as $key) {
        if (!isset($data[$key]) || !is_array($data[$key])) continue;
        foreach ($data[$key] as $ri => $row) {
            if (!is_array($row)) continue;
            foreach ($row as $bi => $button) {
                if (!is_array($button) || !isset($button['text']) || !is_string($button['text'])) continue;
                $paths[] = [$key,$ri,$bi]; $texts[] = $button['text'];
            }
        }
    }
    if (!$texts) return $markup;
    $translated = bg_ai_translate_batch($texts, $target, 'telegram-button');
    foreach ($paths as $i => [$key,$ri,$bi]) if (!empty($translated[$texts[$i]])) $data[$key][$ri][$bi]['text'] = $translated[$texts[$i]];
    return json_encode($data, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES) ?: $markup;
}
