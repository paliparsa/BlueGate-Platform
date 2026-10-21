#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HTML="$ROOT/public/web/index.html"
CSS="$ROOT/public/web/css/editorial-redesign.css"
MODULE_HTML="$ROOT/modules/pro-web/public/index.html"
MODULE_CSS="$ROOT/modules/pro-web/public/css/editorial-redesign.css"

fail(){ printf 'FAIL: %s\n' "$1" >&2; exit 1; }
pass(){ printf 'PASS: %s\n' "$1"; }

[[ -f "$HTML" ]] || fail "public web entrypoint missing"
[[ -f "$CSS" ]] || fail "editorial redesign stylesheet missing"
[[ -f "$MODULE_HTML" ]] || fail "served Pro Web module entrypoint missing"
[[ -f "$MODULE_CSS" ]] || fail "editorial stylesheet missing from served Pro Web module"
grep -Fq '/web/css/editorial-redesign.css?v=5.1.95-home-hero-1' "$MODULE_HTML" || fail "served Pro Web shell does not load the current editorial stylesheet"
grep -Fq 'content="#030303"' "$MODULE_HTML" || fail "served Pro Web shell theme color is not updated"
grep -Fq -- '--blue:#315efb' "$MODULE_CSS" || fail "served Pro Web stylesheet royal blue token missing"
grep -Fq '/web/css/editorial-redesign.css?v=5.1.95-home-hero-1' "$HTML" || fail "versioned stylesheet link missing"
grep -Fq 'data-product="vpn"' "$HTML" || fail "VPN product selector missing"
grep -Fq 'hero-service-list' "$MODULE_HTML" || fail "homepage service panel missing"
grep -Fq 'سرویس‌های دیجیتال، با انتخابی ساده‌تر' "$MODULE_HTML" || fail "homepage hero copy missing"
grep -Fq '.hero-service-list' "$MODULE_CSS" || fail "homepage hero styles missing"
grep -Fq '5.1.95' "$ROOT/VERSION" || fail "version not bumped"
grep -Fq 'سرویس‌های دیجیتال، با انتخابی ساده‌تر' "$ROOT/app/storefront.php" || fail "homepage hero fallback title missing"
grep -Fq 'BluePing VPN، تلگرام استارز و پرمیوم رو یک‌جا ببین' "$ROOT/app/storefront.php" || fail "homepage hero fallback description missing"
grep -Fq 'id="starsInput"' "$HTML" || fail "Stars amount input missing"
grep -Fq 'id="premiumPlans"' "$HTML" || fail "Premium plan container missing"
grep -Fq 'id="stickyBuy"' "$HTML" || fail "sticky checkout action missing"
grep -Fq '/web/js/checkout.js' "$HTML" || fail "checkout entrypoint missing"
grep -Fq '/web/js/account.js' "$HTML" || fail "account entrypoint missing"
grep -Fq '/web/js/dashboard.js' "$HTML" || fail "member dashboard entrypoint missing"
grep -Fq '/web/js/admin.js' "$HTML" || fail "admin entrypoint missing"
grep -Fq -- '--blue:#315efb' "$CSS" || fail "royal blue token missing"
grep -Fq '@media(max-width:768px)' "$CSS" || fail "mobile breakpoint missing"
grep -Fq 'prefers-reduced-motion:reduce' "$CSS" || fail "reduced-motion support missing"
grep -Fq '.bg-admin-shell' "$CSS" || fail "admin token scope missing"
grep -Fq '.bg-icon svg' "$CSS" || fail "SVG icon baseline missing"
! grep -Fq 'public/miniapp' "$HTML" || fail "website entrypoint unexpectedly references Mini App source"

pass "web redesign smoke checks"
