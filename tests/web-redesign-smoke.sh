#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPECTED_VERSION="$(sed -n 's/^## \([0-9][^ ]*\) .*/\1/p' "$ROOT/CHANGELOG.md" | head -1)"
[[ -n "$EXPECTED_VERSION" ]] || { printf 'FAIL: latest changelog version missing\n' >&2; exit 1; }
grep -Fxq "$EXPECTED_VERSION" "$ROOT/VERSION" || { printf 'FAIL: VERSION does not match latest CHANGELOG release (%s)\n' "$EXPECTED_VERSION" >&2; exit 1; }
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
grep -Fq '<section class="hero shell hero--gateway"' "$MODULE_HTML" || fail "homepage Living Gateway hero missing"
grep -Fq 'از یک <em>دروازه</em>.' "$MODULE_HTML" || fail "homepage hero copy missing"
grep -Fq '.hero-service-list' "$MODULE_CSS" || fail "homepage hero styles missing"
: # Version is validated against the latest CHANGELOG release above
grep -Fq 'خدمات دیجیتال، از یک دروازه.' "$ROOT/app/storefront.php" || fail "homepage hero fallback title missing"
grep -Fq 'BluePing VPN، اشتراک تلگرام پرمیوم، تلگرام استارز و بقیه سرویس‌های فعال' "$ROOT/app/storefront.php" || fail "homepage hero fallback description missing"
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
grep -Fq '<span class="kicker">OUR SERVICES</span><h2>سرویس موردنظرت رو انتخاب کن</h2>' "$HTML" || fail "services heading not integrated into catalog toolbar"
grep -Fq '<span class="kicker">OUR SERVICES</span><h2>سرویس موردنظرت رو انتخاب کن</h2>' "$MODULE_HTML" || fail "served services heading not integrated into catalog toolbar"
! grep -Fq '<div class="section-head center-head"><span class="kicker">OUR SERVICES</span>' "$HTML" || fail "duplicate services heading remains above featured configurators"
grep -Fq 'v5.5.0 — editorial catalog (Direction A)' "$ROOT/public/web/css/homepage-experience-redesign.css" || fail "editorial catalog stylesheet layer missing"
grep -Fq 'function genericSearchMatch' "$ROOT/public/web/js/app.js" || fail "catalog search logic missing"
grep -Fq 'function genericSortedProducts' "$ROOT/public/web/js/app.js" || fail "catalog sort logic missing"
grep -Fq '.generic-product-card:has(.generic-card-action:focus-visible)' "$ROOT/public/web/css/homepage-experience-redesign.css" || fail "catalog card keyboard focus styling missing"
grep -Fq '#reviewsGrid.reviews-carousel' "$MODULE_BOTTOM_CSS" || fail "review carousel responsive styling missing"
grep -Fq '#faq .faq-item summary:focus-visible' "$MODULE_BOTTOM_CSS" || fail "FAQ keyboard focus styling missing"
grep -Fq 'prefers-reduced-motion:reduce' "$MODULE_BOTTOM_CSS" || fail "lower homepage reduced-motion support missing"
grep -Fq 'scrollbar-width:thin' "$MODULE_BOTTOM_CSS" || fail "local overflow styling missing"
: # Version is validated against the latest CHANGELOG release above

pass "web redesign smoke checks"

# Catalog-first homepage hierarchy
for PAGE in "$HTML" "$MODULE_HTML"; do
  grep -Fq 'id="genericProductsSection"' "$PAGE" || fail "dynamic service catalog missing"
  grep -Fq 'id="genericProductsGrid"' "$PAGE" || fail "dynamic catalog product grid missing"
  grep -Fq 'href="#genericProductsSection"' "$PAGE" || fail "homepage navigation does not lead to the catalog"
  HERO_POS=$(grep -En '<section class="hero shell[ "]' "$PAGE" | head -1 | cut -d: -f1)
  CATALOG_POS=$(grep -n '<section id="genericProductsSection"' "$PAGE" | head -1 | cut -d: -f1)
  PRODUCTS_POS=$(grep -n '<section id="products"' "$PAGE" | head -1 | cut -d: -f1)
  RATES_POS=$(grep -n '<section class="shell live-strip"' "$PAGE" | head -1 | cut -d: -f1)
  CONVERSION_POS=$(grep -n '<section class="shell conversion-strip"' "$PAGE" | head -1 | cut -d: -f1)
  [[ "$HERO_POS" -lt "$PRODUCTS_POS" && "$PRODUCTS_POS" -lt "$CONVERSION_POS" && "$CONVERSION_POS" -lt "$CATALOG_POS" && "$CATALOG_POS" -lt "$RATES_POS" ]] || fail "homepage order must prioritize featured products before the dynamic catalog"
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
grep -Fq '/web/css/homepage-experience-redesign.css?v=5.5.0-catalog-editorial-1' "$MODULE_HTML" || fail "served Pro Web shell does not load current catalog discovery stylesheet"
grep -Fq '/web/css/homepage-experience-redesign.css?v=5.5.0-catalog-editorial-1' "$HTML" || fail "public shell does not load current catalog discovery stylesheet"
grep -Fq '#products .product-tabs' "$EXPERIENCE_CSS" || fail "featured product tabs redesign missing"
grep -Fq 'prefers-reduced-motion:reduce' "$EXPERIENCE_CSS" || fail "homepage experience reduced-motion support missing"
! grep -Fq 'class="conversion-icon">⚡' "$MODULE_HTML" || fail "static conversion icon still uses emoji"
! grep -Fq 'class="conversion-icon">🎧' "$MODULE_HTML" || fail "static support icon still uses emoji"

pass "catalog-first homepage checks"

# Brand Gateway + flagship-first homepage
BRAND_MOTION_CSS="$ROOT/public/web/css/homepage-brand-motion.css"
MODULE_BRAND_MOTION_CSS="$ROOT/modules/pro-web/public/css/homepage-brand-motion.css"
[[ -f "$BRAND_MOTION_CSS" && -f "$MODULE_BRAND_MOTION_CSS" ]] || fail "Brand Gateway motion stylesheet missing"
cmp -s "$BRAND_MOTION_CSS" "$MODULE_BRAND_MOTION_CSS" || fail "Brand Gateway stylesheets differ between runtime and public mirror"
grep -Fq '@keyframes bgGatewayForm' "$BRAND_MOTION_CSS" || fail "gateway signature motion missing"
grep -Fq 'prefers-reduced-motion:reduce' "$BRAND_MOTION_CSS" || fail "gateway reduced-motion support missing"
grep -Fq '/web/css/homepage-brand-motion.css?v=5.6.0-living-gateway-1' "$MODULE_HTML" || fail "served Pro Web shell does not load Brand Gateway motion stylesheet"
grep -Fq '/web/css/homepage-brand-motion.css?v=5.6.0-living-gateway-1' "$HTML" || fail "public shell does not load Brand Gateway motion stylesheet"
pass "Brand Gateway and flagship-first checks"


# The Blue Gate cinematic intro (v5.4.0)
GATE_JS="$ROOT/public/web/js/homepage-brand-motion.js"
MODULE_GATE_JS="$ROOT/modules/pro-web/public/js/homepage-brand-motion.js"
[[ -f "$GATE_JS" && -f "$MODULE_GATE_JS" ]] || fail "Brand Gateway pointer-motion helper missing"
cmp -s "$GATE_JS" "$MODULE_GATE_JS" || fail "Brand Gateway JS differs between runtime and public mirror"
grep -Fq 'href="#genericProductsSection"><span>مشاهده همه سرویس‌ها</span>' "$HTML" || fail "hero CTA does not point to the full catalog"
grep -Fq '<b>Premium</b>' "$HTML" || fail "Premium marker missing from Brand Gateway"
grep -Fq '<b>Stars</b>' "$HTML" || fail "Stars marker missing from Brand Gateway"
grep -Fq 'bgGatewayForm' "$BRAND_MOTION_CSS" || fail "gateway formation animation missing"
grep -Fq '@keyframes bgGatewayNode' "$BRAND_MOTION_CSS" || fail "flagship node reveal sequence missing"
grep -Fq '#products .product-tab{animation:none}' "$BRAND_MOTION_CSS" || fail "real purchase configurators must not be delayed by the hero animation"
grep -Fq 'requestAnimationFrame' "$GATE_JS" || fail "pointer motion is not frame-coalesced"
grep -Fq 'prefers-reduced-motion:reduce' "$BRAND_MOTION_CSS" || fail "gateway reduced-motion support missing"
grep -Fq '/web/js/homepage-brand-motion.js?v=5.6.0-living-gateway-1' "$MODULE_HTML" || fail "served Pro Web shell does not load gateway pointer helper"
grep -Fq '/web/js/homepage-brand-motion.js?v=5.6.0-living-gateway-1' "$HTML" || fail "public shell does not load gateway pointer helper"
pass "The Blue Gate cinematic intro checks"


# Phase 1 web fixes: catalog price, card semantics, shared number formatter, console errors, ARIA (v5.4.3)
for R in "$ROOT/public/web" "$ROOT/modules/pro-web/public"; do
  [[ -f "$R/css/orders-v9.css" ]] || fail "orders-v9.css missing in $R (linked from the shell)"
  grep -Fq 'const BLUEGATE_WEB_WELCOME_VERSION=' "$R/js/dashboard.js" || fail "web welcome version constant missing in $R"
  grep -Fq 'window.BGFormat=' "$R/js/pricing.js" || fail "shared number formatter missing in $R"
  ! grep -Fq "toLocaleString('fa-IR'" "$R/js/dashboard.js" || fail "dashboard still mixes numeral systems in $R"
  grep -Fq 'function genericLowestOffer' "$R/js/app.js" || fail "catalog lowest-price helper missing in $R"
  grep -Fq 'generic-card-price-old' "$R/js/app.js" || fail "discounted original price not struck through in $R"
  ! grep -Fq "card.setAttribute('role','button')" "$R/js/app.js" || fail "catalog card still uses role=button in $R"
  grep -Fq '<button type="button" class="generic-card-action">' "$R/js/app.js" || fail "catalog card real button missing in $R"
  ! grep -Fq 'class="product-tabs" role="tablist"' "$R/index.html" || fail "product selector still declares an empty tablist in $R"
  grep -Fq 'id="productsHeading"' "$R/index.html" || fail "products section heading missing in $R"
  grep -Fq '/web/js/app.js?v=5.6.0-living-gateway-1' "$R/index.html" || fail "app.js cache key not bumped in $R"
done
cmp -s "$ROOT/public/web/js/pricing.js" "$ROOT/modules/pro-web/public/js/pricing.js" || fail "pricing/format JS mirrors differ"
cmp -s "$ROOT/public/web/css/orders-v9.css" "$ROOT/modules/pro-web/public/css/orders-v9.css" || fail "orders-v9.css mirrors differ"
cmp -s "$ROOT/public/web/css/homepage-experience-redesign.css" "$ROOT/modules/pro-web/public/css/homepage-experience-redesign.css" || fail "catalog stylesheet mirrors differ"
pass "Phase 1 web bug and accessibility checks"

# Editorial catalog redesign (v5.5.0): presentation only, mirrors identical
EXP="$ROOT/public/web/css/homepage-experience-redesign.css"
cmp -s "$ROOT/public/web/css/ui-overhaul.css" "$ROOT/modules/pro-web/public/css/ui-overhaul.css" || fail "ui-overhaul.css mirrors differ"
for R in "$ROOT/public/web" "$ROOT/modules/pro-web/public"; do
  grep -Fq '/web/css/ui-overhaul.css?v=5.5.0-catalog-editorial-1' "$R/index.html" || fail "ui-overhaul.css cache key not bumped in $R"
  ! grep -Fq "setProperty('--generic-accent'" "$R/js/app.js" || fail "catalog cards still rotate accent colours by index in $R"
  ! grep -Fq '/* v3.0.1 reference-style web catalog cards */' "$R/css/ui-overhaul.css" || fail "superseded v3.0.1 catalog card block still present in $R"
  grep -Fq 'class="generic-card-side"' "$R/js/app.js" || fail "catalog card side column missing in $R"
  grep -Fq 'BGCheckout.open({scope:'"'"'generic'"'"'' "$R/js/app.js" || fail "catalog checkout entry point changed in $R"
done
grep -Fq 'grid-template-columns:repeat(2,minmax(0,1fr))!important' "$EXP" || fail "editorial catalog two-column grid missing"
grep -Fq 'border-inline-start:3px solid var(--cat-blue)' "$EXP" || fail "joined catalog panel blue edge missing"
grep -Fq '.generic-category-chip[aria-pressed="true"]::after' "$EXP" || fail "catalog underline tab state missing"
grep -Fq '.generic-products-empty::before' "$EXP" || fail "catalog empty-state icon missing"
grep -Fq 'generic-card-action-more' "$EXP" || fail "mobile short CTA label styling missing"
grep -Fq '.generic-product-card:hover .generic-card-action b{transform:none!important;transition:none!important}' "$EXP" || fail "catalog reduced-motion overrides missing"
grep -Fq '#8a91a0' "$EXP" || fail "catalog faint text token must stay at the AA-safe value"
pass "editorial catalog redesign checks"

# Living Gateway hero (v5.6.0): presentation + copy defaults only, mirrors identical
cmp -s "$ROOT/public/web/js/app.js" "$ROOT/modules/pro-web/public/js/app.js" || fail "app.js mirrors differ"
for R in "$ROOT/public/web" "$ROOT/modules/pro-web/public"; do
  H="$R/index.html"
  grep -Fq '<h1 id="heroTitle"><span class="bg-hero-ln"><span>خدمات دیجیتال، </span></span><span class="bg-hero-ln"><span>از یک <em>دروازه</em>.</span></span></h1>' "$H" || fail "Living Gateway headline markup missing in $R"
  grep -Fq '<p class="bg-hero-slogan">به امید آینده‌ی آزاد</p>' "$H" || fail "brand slogan must stay in the hero in $R"
  grep -Fq 'class="bg-hero-edge"' "$H" || fail "blue edge line above the headline missing in $R"
  grep -Fq 'data-hero-service="vpn"' "$H" && grep -Fq 'data-hero-service="premium"' "$H" && grep -Fq 'data-hero-service="stars"' "$H" || fail "hero direct service shortcuts missing in $R"
  grep -Fq 'id="heroServiceCount" class="bg-hero-count is-pending"' "$H" || fail "live service counter must start pending (filled from storefront data) in $R"
  ! grep -Eq 'data-hero-count[^>]*>[1-9]' "$H" || fail "hero service counter must not be hardcoded in $R"
  grep -Fq '<h2 id="productsHeading">سرویس‌های اصلی BlueGate</h2>' "$H" || fail "visible flagship heading missing in $R"
  grep -Fq '<span class="tab-badge purple">3، 6، 12 ماهه</span>' "$H" || fail "Premium duration badge not normalised in $R"
  grep -Fq 'id="announcement" class="announcement is-pending" role="region"' "$H" || fail "announcement space reservation (CLS) missing in $R"
  ! grep -Fq 'انتخاب سرویس تا ثبت سفارش، یک‌جا' "$H" || fail "retired hero microcopy still present in $R"
  ! grep -Fq 'آماده سفارش' "$H" || fail "unbound ready-to-order status still present in $R"
  ! grep -Fq 'class="brand-stage-copy"' "$H" || fail "duplicate gateway headline still present in $R"
  grep -Fq 'function renderHeroServiceCount' "$R/js/app.js" || fail "storefront-driven service counter missing in $R"
  grep -Fq 'state.genericProducts||[]).length' "$R/js/app.js" || fail "service counter must use real storefront products in $R"
  grep -Fq 'const LEGACY_HERO_TITLES=' "$R/js/app.js" || fail "legacy hero default mapping missing in $R"
  grep -Fq 'function setHeroCopy(el,value){if(el&&el.textContent!==value)' "$R/js/app.js" || fail "hero copy must only be rewritten when it differs in $R"
  grep -Fq "data-hero-service" "$R/js/homepage-brand-motion.js" || fail "hero shortcut handler missing in $R"
done
grep -Fq "seed_setting('storefront_hero_title', 'خدمات دیجیتال، از یک دروازه.')" "$ROOT/app/bootstrap.php" || fail "new-install hero title seed not updated"
grep -Fq "setting('storefront_hero_title','خدمات دیجیتال، از یک دروازه.')" "$ROOT/public/api.php" || fail "admin hero title fallback not updated"
grep -Fq '@keyframes bgGatewayBeam{from{opacity:0;transform:scaleX(.05)}' "$BRAND_MOTION_CSS" || fail "gateway beam keyframe must animate transform"
! grep -Eq '@keyframes bgGateway[A-Za-z]*\{[^}]*(width|height|top|left|right|bottom|margin|padding|filter|box-shadow)[:]' "$BRAND_MOTION_CSS" || fail "gateway keyframes must stay transform/opacity only"
grep -Fq '@media (prefers-reduced-motion:no-preference)' "$BRAND_MOTION_CSS" || fail "gateway motion must be opt-in for reduced-motion users"
grep -Fq '@supports (animation-timeline:view())' "$BRAND_MOTION_CSS" || fail "scroll-driven hero exit must be progressive"
grep -Fq '#products .product-tab:hover>b' "$BRAND_MOTION_CSS" || fail "flagship card hover arrow missing"
pass "Living Gateway hero checks"
