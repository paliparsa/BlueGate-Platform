## 5.4.1 — Homepage smoke-test alignment
- Corrected stale website redesign smoke assertions to validate the current 5.4.0 Blue Gate assets and the current release version.
- No storefront, checkout, pricing, API, or Mini App runtime behavior changed.
- Validation: GitHub Actions will rerun the repository checks against this fix.

## 5.4.0 — The Blue Gate cinematic intro
- Refined the homepage hero into a short, cinematic gateway sequence: a thin electric-blue beam and portal form first, then the BlueGate mark and headline, followed by the VPN, Telegram Premium, and Stars cues.
- Added restrained desktop pointer parallax with requestAnimationFrame; it is disabled for coarse pointers and respects live reduced-motion preference changes.
- Updated the hero CTA to “مشاهده سرویس‌ها” and point directly to the flagship purchase configurators. Core services remain available immediately; no blocking intro or loading screen was added.
- Kept mobile effects lighter and retained the same brand identity, responsive layout, and prefers-reduced-motion behavior.
- Preserved pricing, product data, search/sort/categories, account, checkout, API handlers, and Telegram Mini App files. Public website and served Pro Web mirrors stay synchronized.
- Validation: source assertions added for sequence timing, CTA target, service labels, script/style mirrors, pointer accessibility gates, and reduced motion. Real-browser and authenticated checkout testing still require runtime access.

## 5.3.0 — Brand Gateway and flagship services first
- Reordered the homepage so BluePing VPN, Telegram Stars, and Telegram Premium purchase configurators appear immediately after the brand hero and before the general services catalog.
- Added a restrained BlueGate gateway motion treatment: electric-blue portal rings, a single light beam, staggered hero reveal, and subtle featured-service card interactions.
- Preserved the complete dynamic catalog, search/sort/category controls, reference rates, product data, account/navigation behavior, and existing checkout handlers.
- Added a website-only stylesheet mirrored across the public shell and served Pro Web module; respected reduced-motion preferences and responsive layouts. Telegram Mini App files and logic remain unchanged.
- Updated the web redesign smoke checks to assert the new flagship-first section order and motion stylesheet parity.
- Validation: source-level checks updated; full local test execution and real-browser/authenticated checkout testing still require a repository runtime/browser environment.

## 5.2.1 — Integrated services heading and catalog controls
- Moved the “OUR SERVICES / سرویس موردنظرت رو انتخاب کن” heading into the live catalog so the title, search, sorting, categories and products read as one cohesive section.
- Removed the duplicate heading from the featured VPN/Stars/Premium configurators and the redundant catalog intro, reducing visual separation and excess vertical space.
- Refined desktop and mobile hierarchy with a restrained royal-blue editorial edge, clearer heading scale, and search/filter controls grouped directly below the title.
- Preserved catalog data, search/sort/category behavior, product cards, pricing, BGCheckout, featured configurators, and the Telegram Mini App.
- Kept public website and served Pro Web HTML/CSS mirrors synchronized; updated the web redesign smoke assertions and bumped the version.
- Validation: source-level checks and mirror parity assertions updated; runtime browser/device and authenticated checkout verification still require execution in a deployed/browser environment.

## 5.2.0 — Catalog discovery and product-card refresh
- Added live client-side search across service names, descriptions, categories and plan names, with an accessible clear action and result count.
- Added sorting by featured services, price and name, and made “all services” the default category so the full active catalog is discoverable immediately.
- Refined product cards with category context, optional descriptions, featured/discount cues, lazy-loaded product art, clearer price/action hierarchy and keyboard activation.
- Improved empty-result messaging, mobile category navigation, compact two-column product cards and visible focus/reduced-motion behavior.
- Preserved storefront API data, catalog IDs, pricing and the existing BGCheckout order path; no Mini App or backend behavior changed.
- Kept public website and served Pro Web HTML, JavaScript and CSS mirrors synchronized; added smoke assertions and bumped the version.
- Validation: source-level mirror and feature assertions are included in the smoke test; the smoke test was not executed in this session. Live browser/device and authenticated checkout verification still require runtime access.

## 5.1.99 — Homepage service-index redesign
- Refined the website homepage into a clearer product-led service index: calmer hero hierarchy, less duplicated brand copy, more legible dynamic catalog controls, and stronger separation between the full catalog and featured purchase configurators.
- Replaced homepage reassurance and featured-product emoji icons with inline SVGs for a consistent interface icon language.
- Simplified product selection presentation, removed the static non-progressing purchase-step strip from view, and improved responsive category/product grids while retaining every underlying control and purchase flow.
- Added a website-only CSS layer; storefront API data, pricing calculations, account/navigation actions, checkout behavior, and Telegram Mini App assets remain unchanged.
- Validation: HTML mirror checks, icon-replacement assertions, source-level smoke checks and PHP/JavaScript checks are intended for CI. Live browser/device and authenticated checkout verification require runtime access.

## 5.1.98 — Catalog-first homepage and clearer brand introduction
- Reordered the website homepage so the dynamic, active-products catalog appears immediately after the hero, followed by reassurance cues, featured VPN/Stars/Premium purchase flows, and then the crypto reference-rate strip.
- Removed the collapsed “More Services” interaction: catalog categories and products are visible on page load, remain sourced from the live storefront API, and keep the existing product checkout path.
- Replaced generic AI-like hero copy with a short, plain-language service-discovery message; legacy default copy is normalized while custom admin-written hero copy remains respected.
- Repositioned USDT/Toman, TRX/USD, and TON/USD reference rates after the main product selection and clarified that order totals are shown before checkout.
- Updated desktop/mobile navigation and hero CTA to lead to the full catalog; preserved the featured product panels, pricing engine, account flows, and Mini App isolation.
- Kept served Pro Web and public mirror HTML, JavaScript, and CSS in sync; bumped version and added smoke assertions for catalog visibility, section order, and rate placement.
- Validation: source assertions, mirror parity checks, and PHP/JavaScript syntax checks are intended for CI. Real browser visual checks and authenticated checkout flows still require runtime access.

## 5.1.97 — Lower homepage sections redesign
- Introduced a website-only editorial layer for More Services, feature benefits, conditional plan comparison, customer reviews, connection guides, FAQ, and footer.
- Refined responsive grids, mobile category navigation and review-carousel scrolling, local table overflow, disclosure states, keyboard focus, reduced-motion handling, and safe-area spacing without changing existing content IDs or business logic.
- Loaded the stylesheet in both the served Pro Web module and public mirror; documented the lower-homepage design contract and expanded smoke assertions.
- Validation: source-level parity and repository smoke checks are included in the PR; browser/device visual checks and authenticated commerce flows require runtime access.

## 5.1.96 — Unified website header, profile and credit menus
- Rebuilt the website header as a compact black-and-royal-blue navigation system across the served Pro Web shell and public mirror, with responsive navigation, calmer account controls, and consistent SVG UI icons.
- Restyled the existing account/profile popover and credit quick-view into a shared surface language; desktop credit menu anchors to its own trigger and mobile account menus become safe-area-aware bottom sheets.
- Replaced account/mobile navigation emoji icons with inline SVGs, improved menu expanded-state semantics, and preserved existing account, wallet top-up, notifications, orders, support, and admin actions.
- Added website-only header stylesheet, kept Mini App assets and logic out of scope, and extended web redesign smoke assertions.
- Validation: repository smoke test and source-level parity checks; browser visual review and live authenticated wallet/top-up flows still require runtime verification.

## 5.1.95 — Homepage redesign, phase 1
- Rebuilt the storefront first fold with clearer Persian value proposition, one dominant service-selection CTA, and compact trust cues; updated fallback hero copy while preserving admin-configured overrides.
- Replaced the generic floating-card hero illustration with a structured BlueGate service panel for BluePing VPN, Telegram Stars, and Telegram Premium, using inline SVG icons.
- Refined desktop and mobile hero composition with responsive spacing and reduced-motion compatibility.
- Kept product IDs, routes, pricing, checkout, account, and Mini App behavior unchanged.

## 5.1.94 — Web redesign deployment fix
- Register the Premium Editorial stylesheet in the actual Pro Web module shell served at `/`.
- Mirror the stylesheet into `modules/pro-web/public/css`, which is the asset root used by the web gate and versioned shell.
- Align the route boot screen and browser theme color with the new black/royal-blue design.

# BlueGate Platform v5.1.93 — Premium Editorial Web refresh

- Introduced a website-only Premium Dark + Editorial visual layer with a single mapped token set for storefront, customer account, and web admin surfaces.
- Reduced ambient glow, excessive gradients, oversized corner radii, and decorative motion; clarified page hierarchy, product selection, prices, and customer dashboard surfaces.
- Replaced primary static storefront emoji icons with inline SVGs and added consistent keyboard focus, mobile spacing, and reduced-motion behavior.
- Added the stylesheet as the final web-only layer; purchase, checkout, account, admin, API, and Telegram Mini App logic remain unchanged.
- Validation: static smoke checks and source-level HTML/CSS checks; full browser/device, checkout-provider, authenticated customer, and production deployment tests remain required.

---

# BlueGate Platform v5.1.92 — Safely replace untouched renewal checkouts

- Allow a customer selecting a different VPN renewal plan to replace an existing renewal only when it is still `pending_payment` and has no payment method/details, receipt, payment note, Stars charge, coupon/discount, or wallet contribution.
- Serialize the replacement under the existing per-service renewal lock and use a conditional database update; if the old order changes concurrently or payment/review has begun, preserve it and return it unchanged.
- Keep payment/review-stage renewals protected from plan mutation and avoid refund logic because eligible replacements have no wallet contribution.
- Validation: source-level assertions performed; PHP syntax checks and live Mini App/database/payment-provider tests remain to be run in a deployed test environment.

---

# BlueGate Platform v5.1.91 — Preserve existing renewal orders safely

- Prevented a new plan selection from rewriting an already-open renewal order for the same service.
- Preserve the existing order's payment method, wallet/discount accounting, selected plan, and amount; the Mini App returns the existing order with a clear message instead of overwriting payment state.
- Validation: PHP/JavaScript syntax and repository workflow checks; live payment and Mini App testing remain necessary.

# BlueGate Platform v5.1.90 — Customizable in-place VPN renewal

- Added a branded Mini App renewal flow to choose an eligible subservice and plan before creating a renewal order, with price, duration, and configured quota preview.
- Added server-side ownership, catalog activity, same-service, provider-map and remote-target compatibility validation; incompatible provider migrations are excluded instead of silently changing the existing VPN client destination.
- Renewal orders retain the existing service identity and use the selected plan's server-side price, duration, quota settings, and catalog snapshot. The active service's plan/name is updated only after service-action jobs finish successfully.
- Preserved the 3x-ui live usage check, reset confirmation, reset-after-payment behavior, and idempotent target expiry/quota handling.
- Validation: source-level review only; PHP syntax checks, CI, and live provider/Telegram Mini App testing remain required.
# BlueGate Platform v5.1.88 — Native VPN renewal confirmation modal

- Replaced the browser `window.confirm` prompt with a branded, responsive Mini App modal aligned with BlueGate's dark surfaces and royal-blue action style.
- Shows remaining traffic and remaining time in separate stat cards, clearly explains the irreversible reset, and states that the reset only happens after successful payment.
- Added explicit confirm/cancel actions, backdrop and Escape cancellation, focus handling, reduced-motion support, and Telegram haptic feedback.
- Updated Mini App asset cache keys and bumped the project version.

# BlueGate Platform v5.1.87 — Smart VPN renewal with verified full reset

- Added a live server-side renewal preview for 3x-ui clients. If any finite client has less than 1 GiB remaining or less than 72 hours remaining, the renewal uses the automatic full-reset path; otherwise the Mini App requires explicit confirmation before creating a renewal order.
- The warning displays live remaining traffic and time. Cancelling creates no order and changes no client. Confirmation is revalidated against live panel data and persisted in the order action payload.
- Renewal resets the quota to the existing plan quota, resets traffic counters through the 3x-ui client API (with legacy inbound fallback), and starts a fresh plan duration from the renewal execution time.
- Persisted absolute target expiry/quota values prevent retries from extending the service twice. The worker verifies expiry, quota, and zero traffic counters before marking the action complete.