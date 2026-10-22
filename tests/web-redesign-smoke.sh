#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HTML="$ROOT/public/web/index.html"
CSS="$ROOT/public/web/css/editorial-redesign.css"
MODULE_HTML="$ROOT/modules/pro-web/public/index.html"
MODULE_CSS="$ROOT/modules/pro-web/public/css/editorial-redesign.css"
HEADER_CSS="$ROOT/public/web/css/header-profile-redesign.css"
MODULE_HEADER_CSS="$ROOT/modules/pro-web/public/css/header-profile-redesign.css"
MODULE_JS="$ROOT/modules/pro-web/public/js/account.js"

fail(){ printf 'FAIL: %s\n' "$1" >&2; exit 1; }
pass(){ printf 'PASS: %s\n' "$1"; }

[[ -f "$HTML" ]] || fail "public web entrypoint missing"
[[ -f "$CSS" ]] || fail "editorial redesign stylesheet missing"
[[ -f "$MODULE_HTML" ]] || fail "served Pro Web module entrypoint missing"
[[ -f "$MODULE_CSS" ]] || fail "editorial stylesheet missing from served Pro Web module"
[[ -f "$HEADER_CSS" ]] || fail "header/profile stylesheet missing"
[[ -f "$MODULE_HEADER_CSS" ]] || fail "header/profile stylesheet missing from served Pro Web module"
cmp -s "$HEADER_CSS" "$MODULE_HEADER_CSS" || fail "header/profile stylesheets differ between runtime and public mirror"
grep -Fq '/web/css/editorial-redesign.css?v=5.1.95-home-hero-1' "$MODULE_HTML" || fail "served Pro Web shell does not load the current editorial stylesheet"
grep -Fq 'content="#030303"' "$MODULE_HTML" || fail "served Pro Web shell theme color is not updated"
grep -Fq -- '--blue:#315efb' "$MODULE_CSS" || fail "served Pro Web stylesheet royal blue token missing"
grep -Fq '/web/css/editorial-redesign.css?v=5.1.95-home-hero-1' "$HTML" || fail "versioned stylesheet link missing"
grep -Fq '/web/css/header-profile-redesign.css?v=5.1.96-header-1' "$MODULE_HTML" || fail "served Pro Web shell does not load header/profile stylesheet"
grep -Fq '/web/css/header-profile-redesign.css?v=5.1.96-header-1' "$HTML" || fail "public shell does not load header/profile stylesheet"
grep -Fq '/web/js/account.js?v=5.1.96-header-1' "$MODULE_HTML" || fail "served Pro Web account script cache key not updated"
grep -Fq '/web/js/account.js?v=5.1.96-header-1' "$HTML" || fail "public account script cache key not updated"
grep -Fq 'data-product="vpn"' "$HTML" || fail "VPN product selector missing"
grep -Fq 'hero-service-list' "$MODULE_HTML" || fail "homepage service panel missing"
grep -Fq 'سرویس موردنیازت رو پیدا کن.' "$MODULE_HTML" || fail "homepage hero copy missing"
grep -Fq '.hero-service-list' "$MODULE_CSS" || fail "homepage hero styles missing"
grep -Fxq '5.2.0' "$ROOT/VERSION" || fail "version not bumped"
grep -Fq 'سرویس موردنیازت رو پیدا کن.' "$ROOT/app/storefront.php" || fail "homepage hero fallback title missing"
grep -Fq 'از BluePing و سرویس‌های تلگرام تا بقیه خدمات دیجیتال' "$ROOT/app/storefront.php" || fail "homepage hero fallback description missing"
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
grep -Fq '.bg-credit-chip' "$HEADER_CSS" || fail "redesigned credit chip missing"
grep -Fq '.bg-account-popover' "$HEADER_CSS" || fail "redesigned profile popover missing"
grep -Fq '.bg-popover-topup' "$HEADER_CSS" || fail "direct profile top-up action missing"
grep -Fq 'bgHeaderSheetIn' "$HEADER_CSS" || fail "mobile account sheet animation missing"
grep -Fq 'aria-expanded="false"' "$MODULE_HTML" || fail "accessible initial menu state missing"
grep -Fq '<span class="bg-icon"' "$MODULE_JS" || fail "SVG account/menu icons missing from runtime JS"
grep -Fq "setAttribute('role','menuitem')" "$MODULE_JS" || fail "account menu item semantics missing"
! grep -Fq 'public/miniapp' "$HTML" || fail "website entrypoint unexpectedly references Mini App source"


BOTTOM_CSS="$ROOT/public/web/css/homepage-bottom-redesign.css"
MODULE_BOTTOM_CSS="$ROOT/modules/pro-web/public/css/homepage-bottom-redesign.css"
[[ -f "$BOTTOM_CSS" ]] || fail "lower homepage stylesheet missing"
[[ -f "$MODULE_BOTTOM_CSS" ]] || fail "lower homepage stylesheet missing from served Pro Web module"
cmp -s "$BOTTOM_CSS" "$MODULE_BOTTOM_CSS" || fail "lower homepage stylesheets differ between runtime and public mirror"
grep -Fq '/web/css/homepage-bottom-redesign.css?v=5.1.98-catalog-first-1' "$MODULE_HTML" || fail "served Pro Web shell does not load lower homepage stylesheet"
grep -Fq '/web/css/homepage-bottom-redesign.css?v=5.1.98-catalog-first-1' "$HTML" || fail "public shell does not load lower homepage stylesheet"
grep -Fq '#featureGrid.feature-grid' "$MODULE_BOTTOM_CSS" || fail "feature grid redesign missing"
grep -Fq '.generic-products-toolbar' "$MODULE_BOTTOM_CSS" || fail "more-services toolbar redesign missing"
grep -Fq 'id="genericCatalogSearch"' "$HTML" || fail "catalog search input missing"
grep -Fq 'id="genericCatalogSort"' "$HTML" || fail "catalog sort control missing"
grep -Fq 'id="genericCatalogCount"' "$HTML" || fail "catalog result count missing"
grep -Fq 'function genericSearchMatch' "$ROOT/public/web/js/app.js" || fail "catalog search logic missing"
grep -Fq 'function genericSortedProducts' "$ROOT/public/web/js/app.js" || fail "catalog sort logic missing"
grep -Fq 'generic-product-card--catalog:focus-visible' "$EXPERIENCE_CSS" || fail "catalog card keyboard focus styling missing"
grep -Fq '#reviewsGrid.reviews-carousel' "$MODULE_BOTTOM_CSS" || fail "review carousel responsive styling missing"
grep -Fq '#faq .faq-item summary:focus-visible' "$MODULE_BOTTOM_CSS" || fail "FAQ keyboard focus styling missing"
grep -Fq 'prefers-reduced-motion:reduce' "$MODULE_BOTTOM_CSS" || fail "lower homepage reduced-motion support missing"
grep -Fq 'scrollbar-width:thin' "$MODULE_BOTTOM_CSS" || fail "local overflow styling missing"
grep -Fxq '5.2.0' "$ROOT/VERSION" || fail "homepage catalog version not bumped"

pass "web redesign smoke checks"

# Catalog-first homepage hierarchy
for PAGE in "$HTML" "$MODULE_HTML"; do
  grep -Fq 'id="genericProductsSection"' "$PAGE" || fail "dynamic service catalog missing"
  grep -Fq 'id="genericProductsGrid"' "$PAGE" || fail "dynamic catalog product grid missing"
  grep -Fq 'href="#genericProductsSection"' "$PAGE" || fail "homepage navigation does not lead to the catalog"
  HERO_POS=$(grep -n '<section class="hero shell"' "$PAGE" | head -1 | cut -d: -f1)
  CATALOG_POS=$(grep -n '<section id="genericProductsSection"' "$PAGE" | head -1 | cut -d: -f1)
  PRODUCTS_POS=$(grep -n '<section id="products"' "$PAGE" | head -1 | cut -d: -f1)
  RATES_POS=$(grep -n '<section class="shell live-strip"' "$PAGE" | head -1 | cut -d: -f1)
  [[ "$HERO_POS" -lt "$CATALOG_POS" && "$CATALOG_POS" -lt "$PRODUCTS_POS" && "$PRODUCTS_POS" -lt "$RATES_POS" ]] || fail "homepage section order is not catalog-first"
  grep -Fq 'rate-disclaimer' "$PAGE" || fail "crypto reference-rate disclaimer missing"
done
for ASSET in "$ROOT/public/web/js/app.js" "$ROOT/modules/pro-web/public/js/app.js"; do
  grep -Fq 'The catalog is a first-class homepage section and stays visible by default.' "$ASSET" || fail "catalog should be visible on page load"
  ! grep -Fq "genericProductsToggle')?.addEventListener('click'" "$ASSET" || fail "catalog still has collapse toggle handler"
done
cmp -s "$ROOT/public/web/js/app.js" "$ROOT/modules/pro-web/public/js/app.js" || fail "website app JS mirrors differ"

# Homepage experience redesign layer
EXPERIENCE_CSS="$ROOT/public/web/css/homepage-experience-redesign.css"
MODULE_EXPERIENCE_CSS="$ROOT/modules/pro-web/public/css/homepage-experience-redesign.css"
[[ -f "$EXPERIENCE_CSS" ]] || fail "homepage experience stylesheet missing"
[[ -f "$MODULE_EXPERIENCE_CSS" ]] || fail "homepage experience stylesheet missing from served Pro Web module"
cmp -s "$EXPERIENCE_CSS" "$MODULE_EXPERIENCE_CSS" || fail "homepage experience stylesheets differ between runtime and public mirror"
grep -Fq '/web/css/homepage-experience-redesign.css?v=5.2.0-catalog-discovery-1' "$MODULE_HTML" || fail "served Pro Web shell does not load current catalog discovery stylesheet"
grep -Fq '/web/css/homepage-experience-redesign.css?v=5.2.0-catalog-discovery-1' "$HTML" || fail "public shell does not load current catalog discovery stylesheet"
grep -Fq '#products .product-tabs' "$EXPERIENCE_CSS" || fail "featured product tabs redesign missing"
grep -Fq 'prefers-reduced-motion:reduce' "$EXPERIENCE_CSS" || fail "homepage experience reduced-motion support missing"
! grep -Fq 'class="conversion-icon">⚡' "$MODULE_HTML" || fail "static conversion icon still uses emoji"
! grep -Fq 'class="conversion-icon">🎧' "$MODULE_HTML" || fail "static support icon still uses emoji"

pass "catalog-first homepage checks"
