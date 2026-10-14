## 5.1.49 - Category and filter button visual parity

- Made the Store's category picker and filter/sort control a consistent paired component: equal width and height, shared grid alignment, matching icon tiles, typography, borders, surface and spacing.
- Kept category labels and active-filter count readable with wrapping/clamping; active filters still use the existing indicator.
- Added compact-width handling and focus-visible / reduced-motion states.
- Preserved existing button IDs, markup, click handlers, category selection, filter/sort state and filtering logic.
- Registered the new stylesheet after existing design layers and added PHP filemtime cache-busting.
- Source-level review: stylesheet braces balanced; both controls share the same selectors and geometry; IDs and JS event wiring untouched. Live Telegram WebView visual testing remains outstanding.

## 5.1.48 - Product details popup redesign

- Added a dedicated final-layer stylesheet for the product details / purchase popup, with a true-black surface, centered layout on mobile and desktop, cleaner header, and clearer close control.
- Rebuilt plan options into consistent selectable cards with stronger selected-state contrast, readable long plan names, and better handling of discounted and variable prices.
- Reorganized price summary, product/delivery metadata, description, coupon input, secondary actions, and checkout controls into distinct low-noise sections.
- Improved internal scrolling, sticky checkout actions, narrow-screen spacing, short viewport behavior, focus visibility, safe-area handling, and reduced-motion support.
- Preserved the existing purchase.js markup, plan selection, coupon preview/application, cart/share actions, and order submission handlers.
- Loop 1 reviewed component hierarchy, selected-plan affordance, and separation of price/metadata/actions. Loop 2 checked CSS cascade order, narrow widths/heights, long text and price wrapping, asset registration/cache-busting, and preserved interaction selectors.
- Source-level checks only; live Telegram WebView visual and tap testing remains outstanding.

## 5.1.47 - Unified product card layout redesign

- Introduced a dedicated final-layer stylesheet for the Mini App product cards: true-black surfaces, consistent media framing, stronger name/price hierarchy, compact two-column grid, and responsive spacing.
- Reserved independent corners for the exact discount percentage and wishlist control; hid the decorative fire glyph to keep the discount badge concise and consistent.
- Standardized image containment, long-name wrapping, variable-price wrapping, keyboard focus, hover feedback, and reduced-motion behavior.
- Registered the stylesheet in the existing PHP filemtime cache-busting pipeline.
- Preserved product-card DOM hooks, product preview, discount calculations, wishlist state/actions, and purchase/plan selection logic.
- Loop 1 review focused on card hierarchy, badge/heart collision, and variable text lengths. Loop 2 checked cascade order, narrow mobile widths, CSS delimiters, asset registration, and unchanged interaction hooks.
- Source-level checks only; live Telegram WebView screenshot and tap testing remain outstanding.

## 5.1.46 - Product card redesign and discount badge correction

- Reworked product cards with flexible content heights so the price and card details cannot be clipped by the previous fixed 242px/86px sizing.
- Gave the wishlist button and discount badge independent, reserved top corners; the heart remains visible on discounted products.
- Discount badges now show only the percentage (for example, `25٪`) without a plan/product name or extra label.
- Refined the black card surface, responsive image frame, readable price panel, and two-column catalog grid; retained product preview and wishlist data hooks.
- Loop 1 identified fixed catalog heights and competing width rules as the source of hidden content; Loop 2 checked selector order, small-screen sizing, badge text, and interaction hooks.
- Automated source checks passed; live Telegram WebView screenshot and tap testing remain outstanding.

## 5.1.45 - Product card black theme and price clarity

- Corrected product card surfaces to true black, including the image frame and content area.
- Rebuilt the price panel as a dedicated high-contrast block with a larger, bold price on its own line so it remains obvious on narrow screens.
- Preserved the existing image frame ratio (`1 / 0.88`), `object-fit: contain`, inner image padding, card sizing behavior, product data, discount badges, wishlist, and product preview hooks.
- Loop 2 regression checks verify the image geometry and existing interaction markup remain unchanged.
- Live Telegram WebView visual/tap testing remains outstanding.

## 5.1.44 - Product cards visual rebuild

- Rebuilt product-card surfaces with a cleaner deep-navy treatment, quieter borders, clearer image framing, and stronger price hierarchy.
- Preserved the existing image frame aspect ratio (`1 / 0.88`), responsive image padding, `object-fit: contain`, and card width behavior.
- Kept the existing product-card DOM hooks and event-bearing controls intact, including discount/featured badges, wishlist, product preview, and price content.
- Improved long-name and long-price wrapping, compact-screen spacing, focus-visible states, and reduced-motion behavior.
- Loop 2 review checked responsive overrides and verified that card interaction markup was not changed; live browser screenshot/tap testing remains outstanding.

## 5.1.43 - Five-tab bottom navigation redesign

- Rebalanced all five bottom tabs into equal-width touch targets with consistent icon and label alignment.
- Added a restrained active-tab surface, clearer selected-state indicator, and keyboard-visible focus styling.
- Replaced the support tab emoji with a matching inline SVG icon for a consistent icon system.
- Improved safe-area spacing, small-screen sizing, reduced-motion behavior, and desktop visibility rules without changing tab identifiers or navigation behavior.
- Source review completed; final appearance and tap testing in the live Telegram WebView remains outstanding.

## 5.1.42 - Product card integrity and responsive polish

- Tightened product-card title and price overflow handling to prevent clipped or uneven price rows.
- Standardized discount badge contrast, spacing, and truncation so badges remain legible beside wishlist controls.
- Added consistent focus-visible affordances for wishlist/open controls and subtle featured-state border support.
- Kept the existing product data, discount calculation, favorite state behavior, and purchase flow unchanged.
- Source-level review completed; live Telegram WebView visual and interaction testing remains outstanding.

## 5.1.41 - Premium product cards redesign

- Rebuilt storefront product cards with a balanced media area, dark graphite/blue glass styling, clearer two-line titles, and a consistent price footer.
- Replaced product-card wishlist and missing-image emoji with consistent inline SVG icons; wishlist state remains accessible and updates in place.
- Refined discount badge placement, touch feedback, and narrow-screen sizing while preserving existing product preview, pricing, and wishlist behavior.
- Refreshed Mini App asset cache keys. Source-level checks completed; visual testing in the live Telegram WebView remains outstanding.

## 5.1.40 - Balanced storefront controls

- Matched category and filter control widths and heights to restore symmetry under the search field.
- Reduced icon and label sizing consistently, with an additional compact-screen adjustment.
- Updated storefront cache token to ensure the new styles are picked up.

## 5.1.39 - Storefront layout and filter refinement

- Replaced decorative Unicode/emoji marks in the storefront discovery area and category picker with consistent inline SVG icons; localized category labels remain supported.
- Redesigned the filter popup with grouped panels, selected sort controls, clearer featured/wishlist toggles, and explicit reset/apply actions.
- Fixed the search-to-controls row with constrained grid columns, `min-width: 0`, text overflow handling, and narrow-screen sizing to prevent the controls card from overflowing or breaking.
- Added a consistent empty-results state and refreshed storefront cache keys.
- Source-level regression assertions performed; live Telegram/WebView visual testing remains outstanding.

## 5.1.38 - Storefront discovery and filters redesign

- Reworked the space between the Mini App header and product cards into a compact storefront intro, focused search field, live result count, and category/filter controls.
- Moved category browsing into the existing action-sheet system with selected-state feedback; added clear-search and expanded filter toggles for featured items and wishlist.
- Preserved product-card rendering and existing search/catalog filtering logic; refreshed Mini App asset cache keys.
- Source-level checks performed; live Telegram/WebView visual and interaction testing remains outstanding.

## 5.1.37 - Mini App language picker redesign

- Replaced the one-tap language confirmation with a centered, accessible language-selection modal matching BlueGate's graphite surfaces and blue accents.
- Added explicit Persian/English selection states, apply/cancel actions, keyboard navigation, Escape/backdrop close, reduced-motion support, and responsive sizing.
- Kept the existing language persistence and reload behavior; refreshed Mini App asset cache keys.
- Static source checks only; live Telegram/browser interaction testing remains outstanding.

## 5.1.36 - Mini App notification popup redesign

- Redesigned notification rows with clearer title/body/time hierarchy, distinct unread markers, and type-aware icon surfaces.
- Improved empty state, count summary, text wrapping, tap feedback, and compact mobile layout.
- Preserved the existing notification read API, badge updates, and action routing to related orders/sections.
- Refreshed Mini App asset cache keys. Source-level checks only; live Telegram/browser visual regression testing remains outstanding.

## 5.1.35 - Mini App header redesign

- Rebuilt the Mini App header with the BlueGate symbol, clearer greeting/title hierarchy, compact graphite surfaces, and royal-blue accents.
- Tuned spacing, controls, safe-area offsets, and narrow-screen behavior while preserving existing header IDs, language switcher, notification/auth controls, and navigation hooks.
- Refreshed Mini App asset cache keys to load the updated markup and styles.
- Source-level checks only; live Telegram/browser visual regression testing remains outstanding.

## 5.1.34 - Component accent fallback cleanup

- Removed the final legacy violet fallback values from shared Mini App component-parity rules.
- Refreshed Mini App and web cache keys and bumped the release version.
- No JavaScript or backend logic was changed. Static CSS checks are complete; interactive browser flow tests remain unavailable in this environment.

## 5.1.33 - Final accent normalization

- Normalized remaining violet/purple accent values in the Mini App core, unified component, parity, and web-admin CSS to the royal-blue accent or neutral graphite borders.
- Kept semantic warning, error, success, discount, and segmented-wheel colors intact; preserved the VPN subscription progress visualization.
- Refreshed static cache keys after the final CSS pass.
- No JavaScript or backend business-logic files changed. Validation remains source-level; interactive browser smoke tests require an available browser/test runner.

## 5.1.32 - Legacy visual ownership cleanup

- Replaced decorative legacy gradients in the Mini App core, unified components, parity layers, order surfaces, and web-admin layers with semantic royal-blue/deep-black design tokens.
- Removed duplicate decorative shadows from the migrated surface rules while preserving layout declarations, responsive breakpoints, modal stacking/positioning, and interaction selectors.
- Kept semantic success/warning/danger treatments, discount badges, the segmented prize wheel, animated shine, and data-bearing progress rings; normalized the VPN subscription progress ring to the royal-blue accent.
- Refreshed Mini App and web cache keys. PHP filemtime registration for all new design-system stylesheets remains present: verified.
- Business logic and JavaScript files were not modified. Source checks covered CSS delimiter balance, stylesheet links, palette remnants, and the preservation of progress-ring gradients.
- Automated end-to-end purchase/payment/wallet/login/admin tests and live-browser visual regression were not available; those flows still require a browser/device smoke test before claiming full release verification.

## 5.1.31 - Legacy palette conflict cleanup

- Audited the actual loaded Mini App and web-admin CSS chains and identified old navy, cyan, and violet palette declarations in the legacy foundation, parity, and admin stylesheets.
- Replaced the Mini App root palette and base canvas with deep black/graphite surfaces and royal blue; normalized legacy accent literals in the Mini App core stylesheet.
- Updated in-app admin parity tokens and neutralized old sheet/tab visual treatments while preserving their layout and interaction rules.
- Scoped the web-admin token contract to the admin shell and aligned admin-v18/admin-unified palette values and navigation accents with royal blue.
- Refreshed Mini App and web-admin cache keys. Purchase, payment, wallet, authentication, API, and admin business logic were not changed.
- Verification: re-read modified files from main; checked stylesheet references, CSS brace balance and palette-token remnants. Live browser regression and automated CI tests were not available.

## 5.1.30 - Root-level royal blue design system

- Added a dedicated Mini App design architecture: semantic tokens, base typography/reset, surfaces, controls, overlays, and responsive/reduced-motion guardrails.
- Applied the royal-blue accent (#315EFB), deep-black canvas, graphite surfaces, controlled corner radii, and shared user/admin component rules.
- Added a dedicated web-admin visual contract for navigation, data surfaces, controls, and form focus states.
- Removed the former final palette override from the Mini App load chain; the new design layers now own final visual tokens and shared component styling.
- Registered the new Mini App stylesheets in PHP filemtime cache-busting and refreshed static cache keys.
- Kept feature-specific layout, purchase/payment flows, wallet logic, authentication, APIs, and admin behavior untouched.
- Verification: source-level CSS/HTML/PHP checks; no live browser visual regression run was available in this workflow.

## 5.1.29 - Mini App design system rebuild

- Rebuilt the final Mini App visual layer as one source of truth for deep-black surfaces, graphite borders, typography, controls, cards, navigation and overlays.
- Standardized the brand accent to blue; removed violet as a second decorative accent while retaining semantic success, warning and error colors.
- Replaced the Mini App brand stylesheet's conflicting page gradients and button glow with structural-only helpers.
- Unified radius, spacing and elevation tokens; retained responsive layouts, stacking, animations, and feature-specific CSS behavior.
- Refreshed static Mini App cache keys and retained PHP filemtime cache-busting for the final design layer.
- Visual-only refactor; no purchase, payment, wallet, authentication, API, or admin business logic changed.

## 5.1.28 - Unified Yekan + Inter typography

- Load Yekan as the preferred Persian typeface and Inter for Latin text/numerals, with Vazirmatn and system fallbacks.
- Force the typography stack across user/admin screens, buttons, forms, dialogs, popups, placeholders, and inline-styled content; preserve dedicated legacy icon fonts.
- Refresh Mini App local asset cache keys and add the final palette stylesheet to the PHP runtime cache-busting list.
- Typography-only UI change; no business logic or purchase/auth flows changed.

## 5.1.27 - Deep-black Mini App palette

- Set the global page background to deep black (#030303), with near-black cards, panels, inputs, and popup surfaces.
- Remove decorative gradients and pseudo-element glows from product cards and key promotional surfaces; retain only a very subtle interaction glow on primary actions.
- Standardize popup backdrops and panels across language, Telegram Stars, wallet/top-up, product, and confirmation flows with very subtle gray borders.
- Preserve blue primary actions, violet only where existing semantic selection requires it, and existing success/warning/error colors.
- Refresh local CSS/JS cache keys and the browser theme color. Visual-only changes; no business logic or application flow changes.

## 5.1.26 - Complete Mini App palette normalization

- Standardize the home page, catalog/product cards, wallet/credit/payment methods, tabs, menu states, and order indicators around a near-black surface, white text, blue primary actions, and restrained violet selection accents.
- Unify language, Telegram Stars, credit/top-up, product details, and purchase confirmation overlays with subtle borders, consistent card surfaces, spacing, and lightweight backdrop blur.
- Reduce strong card gradients and keep success, warning, and error status colors semantically distinct.
- Keep legacy layout/behavior stylesheets, but make the centralized final palette layer authoritative; refresh every local CSS/JS asset cache key.

## 5.1.25 - Fix legacy palette override and stale asset cache

- Remove legacy `!important` locks from accent tokens in `bluegate-theme.css` that blocked the Mini App's runtime palette.
- Apply runtime accent, primary, and user-accent variables with inline priority as a rollout safeguard against stale cached styles.
- Refresh cache keys for the legacy theme, centralized palette, and Mini App JavaScript so clients fetch the corrected assets.

## 5.1.24 - User-customizable Mini App accent and primary buttons

- Make the device-local palette choice drive both accent styling and primary button backgrounds, including focus and selected-state accents.
- Remove `!important` from runtime-controlled accent/primary CSS tokens so `applyTheme()` can update them reliably.
- Keep the black/white base and semantic status colors intact; preserve admin-configured defaults when no local preference exists.
- Replace the duplicate purple swatch with the intended blue default and refresh app/palette cache keys.

## 5.1.23 - Unified Mini App palette redesign

- Introduce a centralized black-first, white-text palette with restrained blue actions and violet accents.
- Apply a final visual-only theme layer across user and admin screens, catalog cards, navigation, forms, wallet, orders, and modal surfaces.
- Keep success, warning, and error colors semantically distinct; preserve application behavior and data flows.
- Refresh design-system and palette stylesheet cache keys.

## 5.1.22 - Product details popup redesign

- Reworked the Mini App product/order popup into a centered modal on mobile and desktop.
- Put the selected plan price directly after plan selection, followed by a clearer specification list.
- Improved spacing, readable line-height, mobile sizing, and a scrollable long-description area.
- Reduced the backdrop blur to a subtle 3px while keeping the existing order, coupon, share, and cart handlers intact.

# BlueGate Platform v5.1.21 — modal spacing and lightweight blur

- Normalize modal card padding, borders, and text/button spacing across centered confirmation, Stars/order popups, and credit top-up flows.
- Add a subtle 3px backdrop blur with modest saturation to modal overlays, avoiding heavy blur.
- Improve narrow-screen wrapping and action-button spacing.
- Refresh Mini App stylesheet cache key.

# BlueGate Platform v5.1.20 — credit top-up modal polish

- Redesign the add-credit and payment-method steps as centered, scrollable dialogs with consistent hierarchy and mobile sizing.
- Improve pending top-up rows and their change-method/cancel controls.
- Use the centered confirmation modal for changing payment method and cancelling a top-up, with clearer actions and warning copy.
- Preserve existing top-up API and payment processing flows; refresh stylesheet cache key.

# BlueGate Platform v5.1.19 — order payment action bar redesign

- Redesign the order payment bottom action rail with a compact glass surface, clearer primary/secondary actions, a dedicated More control, and mobile/safe-area spacing.
- Keep existing order note, more-options, service, and renewal handlers unchanged.
- Refresh Mini App stylesheet cache key.

# BlueGate Platform v5.1.18 — centered language popup and stable loading overlay

- Use the same centered order-more style confirmation modal for language switching.
- Keep the shared loading overlay visible from the first tracked request until all overlapping requests finish; stop cycling status copy and avoid restarting the overlay during overlapping requests.
- Refresh Mini App asset cache keys.

# BlueGate Platform v5.1.17 — Stars invoice confirmation and crypto payment polish

- Add a confirmation dialog before creating/sending a Telegram Stars invoice; canceling leaves the invoice uncreated.
- Restyle crypto wallet selection and invoice details to align with the centered popup and refreshed payment action-bar design.
- Reduce heavy crypto card blur/shadows and improve address, amount, network, and TXID readability on mobile.
- Refresh Mini App CSS/JS cache keys.
- Version bump: 5.1.16 → 5.1.17 (PATCH).

# BlueGate Platform v5.1.16 — language confirmation and payment bar polish

- Ask users to confirm before switching Mini App language; cancel leaves the current language unchanged.
- Restyle the sticky order/payment action bar with the centered popup's rounded card, spacing, restrained border/shadow, and mobile-safe sizing.
- Refresh CSS and language script cache keys.
- Version bump: 5.1.15 → 5.1.16 (PATCH).

# BlueGate Platform v5.1.15 — initial boot and payment-method loader

- Show the command loader during the initial Mini App boot sequence exactly once per page load, and release it when boot completes or fails.
- Include payment-method selection/reset in the explicit loader allowlist.
- Keep read-only refreshes, navigation, and background polling excluded from the loader.
- Bust Mini App JavaScript cache key.
- Version bump: 5.1.14 → 5.1.15 (PATCH).

# BlueGate Platform v5.1.14 — centered order actions popup

- Replace the old order-more sheet and separate legacy dialogs with one centered modal for order note, coupon code, and order cancellation.
- Keep each action's form/confirmation inside the same popup instead of dismissing it and opening the old dialog UI.
- Refresh Mini App asset cache keys for the new UI.
- Version bump: 5.1.13 → 5.1.14 (PATCH).

# BlueGate Platform v5.1.13 — scoped, lightweight Mini App loader

- Replace the loader's denylist with an explicit allowlist of deliberate mutating/long-running actions, preventing it from appearing on automatic refreshes, page navigation, and ordinary read-only requests.
- Reduce mobile rendering cost by removing backdrop blur and glow filters, slowing the inner ring animation, and shrinking the spinner on small screens.
- Bust Mini App CSS/JS cache keys.
- Version bump: 5.1.12 → 5.1.13 (PATCH).

# BlueGate Platform v5.1.12 — repeat renewal navigation fix

- Resolve managed VPN service identity through prior renewal-order ancestry so renewals continue to deduplicate against the same service.
- Return the exact fresh/reused renewal order explicitly from both service-page and order-page renewal APIs.
- Remove UI fallback to the first order in the list; if the API fails to provide an order ID, do not navigate to a stale checkout.
- Bust Mini App asset cache keys.
- Version bump: 5.1.11 → 5.1.12 (PATCH).

# BlueGate Platform v5.1.11 — stop idle loader animation

- Stop the status-message timer and all loader activity when the last tracked API request settles.
- Hide the idle overlay explicitly and prevent decorative spinner/progress animations from continuing while hidden.
- Bust Mini App CSS and JavaScript cache keys so clients receive the fix.
- Version bump: 5.1.10 → 5.1.11 (PATCH).

# BlueGate Platform v5.1.10 — request-synchronized loader timing

- Remove the artificial minimum loader display delay; the overlay now hides as soon as the final tracked API request settles, while CSS keeps only its short visual fade.
- Keep the loader active across overlapping tracked requests and stop only after the last one finishes.
- Version bump: 5.1.9 → 5.1.10 (PATCH).

# BlueGate Platform v5.1.9 — robust completed-job detection

- Detect completed provisioning jobs using parsed JSON `order_id`, avoiding fragile string-pattern matching when deciding whether a prior renewal checkout can be reused.
- Version bump: 5.1.8 → 5.1.9 (PATCH).

# BlueGate Platform v5.1.8 — allow subsequent VPN renewals

- Do not reuse an old renewal checkout when its provisioning job is already completed, even if a legacy order status is stale.
- Continue reusing active unpaid/in-progress renewal orders, while allowing a new order after the previous renewal has actually completed.
- The Mini App service renewal API passes the managed service ID into the renewal factory.
- Version bump: 5.1.7 → 5.1.8 (PATCH).

# BlueGate Platform v5.1.7 — Mini App loading and transitions

- Add a reusable full-screen animated command loader with a circular orbit, rotating status messages, glass panel, backdrop blur, and interaction blocking while meaningful API commands run.
- Keep routine background/read-only polling quiet to avoid flashing the loader during automatic refreshes.
- Add subtle page-entry transitions and respect reduced-motion preferences.
- Bust Mini App CSS and JavaScript cache keys so deployed clients load the new UI.
- Version bump: 5.1.6 → 5.1.7 (PATCH).

# BlueGate Platform v5.1.6 — atomic renewal deduplication

- Acquire a MySQL advisory lock per user and managed VPN service before checking or creating a renewal checkout.
- Reuse active renewal orders by both source order and managed service ID, covering service renewal flows where the source order ID can differ.
- Treat receipt-submitted and review states as active renewal checkouts, preventing a second order while payment is being reviewed.
- Pass the managed service ID into the backend renewal factory from the service renewal API.
- Version bump: 5.1.5 → 5.1.6 (PATCH).

# BlueGate Platform v5.1.5 — reliable Iran flag display

- Use the requested Toss Face Lion and Sun SVG for Persian language toggles on web and Mini App.
- Add an image fallback to the Wikimedia Lion and Sun PNG, then a visible lion/sun glyph fallback if external image loading fails.
- Version bump: 5.1.4 → 5.1.5 (PATCH).

# BlueGate Platform v5.1.4 — language flag image fix

- Replace the hand-drawn Persian lion-and-sun toggle icon with the user-provided Wikimedia image URL in the web and Mini App language switchers.
- Keep the US flag for English.
- Version bump: 5.1.3 → 5.1.4 (PATCH).

# BlueGate Platform v5.1.3 — renewal checkout and duplicate job protection

- Reuse the same active renewal order when a customer taps renew repeatedly; return them to the existing checkout instead of creating a second order.
- Tell Telegram users when a renewal checkout already exists and show that same order invoice; expose reuse state to the web/Mini App API.
- Serialize VPN service actions per order and service instance, and mark concurrent/duplicate jobs as ignored so the same purchase cannot extend service twice.
- Replace language-toggle text with flag-only controls: Iran lion-and-sun style for Persian and the United States flag for English.
- Version bump: 5.1.2 → 5.1.3 (PATCH).

# BlueGate Platform v5.1.2 — x-ui allowedIPs renewal fix

- Normalize the official x-ui Client.allowedIPs field to a JSON string array before sending update requests.
- Accept array values and JSON/comma-separated string representations from existing panel client data.
- Fixes renewal/update failures caused by Go JSON decoding a string into []string.
- Version bump: 5.1.1 → 5.1.2 (PATCH).

# BlueGate Platform v5.1.1 — VPN renewal and payment reliability

- Notify Telegram admins when an order is fully paid using the wallet in the bot.
- Surface VPN service-action queue failures and provider execution errors to admins with job identifiers and diagnostic details.
- Report the start of paid service renewal/add-on operations instead of silently leaving failures in logs.
- Version bump: 5.1.0 → 5.1.1 (PATCH; backward-compatible bug fixes).

# BlueGate Platform v5.1.0 — Dual-currency wallet (IRT + USD)

- Add an independent USD wallet balance without rewriting existing IRT balances.
- Use the existing USDT/Toman provider to snapshot USD top-up quotes and USD wallet checkout conversions.
- Keep USD principal fixed as rates move; only its IRT display equivalent changes.
- Record currency and exchange-rate metadata for wallet transactions, top-ups, and orders; old ledger rows remain IRT.
- Add safe additive migrations and English Mini App wallet/top-up display support.
- USD top-ups use existing payment methods and settle at the quoted Toman equivalent; card-to-card remains unavailable in English mode.

# BlueGate Platform v5.0.55 — Translation reliability and admin refresh fix

- Stop automatically starting the catalog translation batch every time the web admin mounts or refreshes; keep explicit translation actions and catalog-related flows available.
- Respect provider retry-after hints and use bounded backoff for HTTP 429/503 translation errors.
- Retain failed UI translation tasks for up to eight attempts instead of dropping them after three failures.
- Validation: PHP syntax, JavaScript syntax, and SQL translation-column uniqueness checks passed in GitHub Actions.

## Versioning policy

BlueGate Platform uses Semantic Versioning for the core release: `MAJOR.MINOR.PATCH`.
- **MAJOR**: incompatible changes, breaking migrations, or major architectural changes.
- **MINOR**: backward-compatible features and functionality.
- **PATCH**: backward-compatible bug fixes, reliability improvements, and small corrections.
- The core version is recorded in `VERSION`; the Pro modules have their own version and are not automatically bumped with core releases.
- Every release must update `VERSION` and add a new entry at the top of this changelog. Formal release tags use the `v` prefix (for example, `v5.0.55`).

---

# BlueGate Platform v5.0.54 — Shared AI Live Translation

- Add a shared OpenAI-compatible AI translation service with server-side cache and protected placeholders, links, numbers, and markup.
- Add a rate-limited public translation endpoint for unknown UI strings.
- Add browser-side live translation fallback for Mini App, website, and web admin, including a website language toggle.
- Localize Telegram bot messages and visible keyboard labels according to Telegram's detected language while preserving callback payloads.
- Add optional server-side AI provider settings; existing catalog providers remain a fallback.
- Extend CI syntax checks for the new translation components.

# BlueGate Platform v5.0.53 — Automatic translation worker and complete account UI localization

- Add DeepL API and Google Cloud Translation provider support, then fall back to Google Translate web endpoint and MyMemory; all translations remain cached server-side.
- Start a bounded background translation worker automatically when the admin panel opens and after catalog saves; the Translate button resumes the worker instead of doing just one isolated batch.
- Expand English dictionary coverage for account completion, Telegram connection, account details, balance center, top-ups, profile/security, VPN services, referrals, and support.
- Normalize Persian spacing/zero-width characters before dictionary matching and translate relevant input values, placeholders, labels, and titles.
- Add provider configuration examples; existing Persian text remains unchanged and saved manual translations are preserved.

# BlueGate Platform v5.0.52 — Editable automatic English catalog translations

- Add persisted English translation fields for categories, products, variants, services, service groups, and plans, including descriptions.
- Add cached Persian-to-English translation using optional configured LibreTranslate and a MyMemory fallback; translation failures safely fall back to Persian.
- Add a bounded batch translation endpoint and a web-admin translation editor for manual overrides and backfilling existing catalog entries.
- Return saved English fields in API catalog payloads and display them in English Mini App category/product/service/plan views.
- Add additive migrations for existing installations; no existing Persian source text or identifiers are overwritten.

# BlueGate Platform v5.0.51 — Bilingual international Mini App

- Add a persistent Persian/English language toggle with automatic browser/Telegram locale selection and RTL/LTR layout switching.
- Add an offline translation dictionary and dynamic DOM translation for common storefront, account, order, checkout, wallet, support, and authentication UI labels.
- Display product-card and purchase-sheet prices in USD for English storefront users using explicit product USD prices where available, otherwise an approximate conversion from the current USDT/Toman rate (with a documented fallback).
- Hide card-to-card payment choices in the English storefront and reject card payment-method selection and card top-ups server-side when the request is in English mode.
- Preserve Persian mode and existing order amount/checkout calculations; USD display is a presentation conversion, not a new settlement currency.

---

# BlueGate Platform v5.0.50 — Visual admin settings controls

- Convert legacy card-account and manual crypto-rate line editors into structured visual forms while preserving existing storage/API formats.
- Convert Stars quantity presets into add/remove visual controls.
- Convert crypto rate-provider priority into ordered selectors backed by the existing comma-separated setting.
- Align the pro-web admin wheel reward cards and VIP tier threshold/multiplier controls with the main web admin.
- Preserve existing setting keys and API payload compatibility; bump web admin JavaScript cache keys.

---

# Changelog

# BlueGate Platform v5.0.49 — Web visual wheel and VIP editors

- Replace the web admin wheel prize line editor with add/remove prize cards matching the Mini App workflow.
- Replace the VIP JSON editor with per-tier threshold and commission multiplier fields matching Mini App.
- Save wheel prizes through shared settings and VIP rates through the dedicated API.

---

# BlueGate Platform v5.0.48 — Mobile auth drawer hardening

- Fix mobile login/register dialog positioning and overflow using a viewport-bounded centered dialog with explicit closed/open visibility states.
- Ensure the account drawer and backdrop are dismissed after successful login, including the pending-action path, preventing a blank “BlueGate Account” panel from remaining open.
- Refresh auth CSS and JavaScript cache keys for web and pro-web.

---

# BlueGate Platform v5.0.47 — Referral reward settings UI

- Add visible settings in Mini App and web admin for valid-invite reward, referred-purchase base reward, custom referral-code threshold and wheel chances.
- Keep wheel prize editing as visual cards in Mini App and explain the supported line format in web admin.
- Persist these values through the shared admin API and return them in admin settings payload.

---

# BlueGate Platform v5.0.46 — Admin mobile ticket navigation

- Add a visible “تیکت‌های پشتیبانی” entry to the admin mobile “بیشتر” menu so the support tab is reachable on phones when the desktop sidebar is hidden.
- Refresh admin JavaScript cache keys for web and pro-web.

---

# BlueGate Platform v5.0.45 — Center mobile login/register dialog

- Center the home-page login/register dialog on phone screens instead of using a bottom sheet.
- Constrain the dialog to the visible viewport with internal scrolling, safe-area padding and a small-screen width limit.
- Keep the dialog header visible while scrolling and refresh account CSS cache keys for both web and pro-web.

---

# BlueGate Platform v5.0.44 — Mobile web ticket creation sheet

- Fix the new-ticket popup on phones with a bottom-aligned, viewport-bounded sheet, internal scrolling, safe-area padding, sticky header and responsive fields/file input.
- Use dynamic viewport units with a `100vh` fallback to avoid browser chrome/keyboard viewport sizing issues.

---

# BlueGate Platform v5.0.43 — Web/Mini App ticketing parity

- Match web user/admin ticket statuses to Mini App with consistent green/yellow/red badges and summary counts.
- Make resolved/closed user conversations read-only in the web UI while retaining message history and keeping backend enforcement.
- Add image attachment previews, delivery/read ticks, live message polling and live status/composer updates to web ticket chats.
- Add full admin status controls (open, waiting for support, waiting for customer, resolved, closed), customer identity details and live message polling.
- Refresh web asset cache keys so the ticketing updates are loaded immediately after deployment.

---

# BlueGate Platform v5.0.42 — Close ticket creation sheet after submit

- Close the new-ticket creation sheet after successful submission (including duplicate-detection recovery) before opening the exact ticket chat, reducing overlapping screens and confusion.

---

# BlueGate Platform v5.0.41 — Closed ticket restrictions and status colors

- Prevent user replies and re-opening for resolved/closed tickets in the backend.
- Show a read-only closed-ticket notice instead of the reply composer while preserving access to the conversation history.
- Color ticket statuses consistently: open green, waiting for a reply yellow, and resolved/closed red.
- Keep message polling active for read-only closed conversations.

---

# BlueGate Platform v5.0.40 — Ticket WebApp buttons

- Use Telegram inline WebApp buttons for ticket notifications and target the configured Mini App URL with the exact ticket ID, avoiding browser launches without Telegram `initData`.

---

# BlueGate Platform v5.0.39 — Support composer spacing and admin controls

- Add bottom clearance and a distinct composer surface for user/admin ticket chats so attachment and send controls no longer sit flush against the screen edge.
- Keep ticket messages as the independently scrollable region and reorganize admin status actions into a consistent, touch-friendly two-column grid.
- Improve wrapping of admin support page action buttons on narrow screens.

---

# BlueGate Platform v5.0.38 — Telegram ticket notifications

- Add a direct Mini App ticket button to admin Telegram notifications, with customer name, username, internal user ID and Telegram ID where available.
- Notify the ticket owner when support replies or the ticket status changes, including the current status and a direct button back to that exact ticket.
- Support `ticket_<id>` Mini App deep links for both customer and authenticated admin views.

---

# BlueGate Platform v5.0.37 — Admin ticket sheet sizing

- Fix admin ticket conversation sizing to fit the available viewport, keep the message area scrollable, respect device safe areas, and prevent composer/status controls from overflowing on narrow screens.

---

# BlueGate Platform v5.0.36 — Admin ticketing and duplicate prevention

- Redesigned the admin Mini App ticket list and conversation view to match the customer support UI, with ticket stats, status badges, mobile layouts, attachment previews, and clearer reply/status controls.
- Prevented repeat submissions in the ticket form and added server-side short-window idempotency for identical ticket creation requests, including concurrent requests.

---

# BlueGate Platform v5.0.35 — Mini App ticketing UI

- Redesigned the Mini App support ticket list with clearer ticket cards, localized status labels, and an improved empty state.
- Improved the new-ticket form and support chat header.
- Refined chat bubbles, message composer, status badges, and responsive layouts for small mobile screens.
- Added responsive and reduced-motion styling for the ticketing experience.

---

# BlueGate Platform v5.0.32 — Support chat fixes

- چت Mini App در موبایل به پنل تمام‌قد با ارتفاع و اسکرول داخلی پایدار تبدیل شد.
- صفحه چت ادمین Mini App از نمایش کارت‌های پراکنده به گفت‌وگوی کامل با polling و پاسخ مستقیم تبدیل شد.
- تصویر پیوست داخل lightbox داخلی Mini App پیش‌نمایش می‌شود و به لینک خام عکس منتقل نمی‌شود.
- فایل انتخاب‌نشده دیگر به‌صورت MIME خالی به API ارسال نمی‌شود؛ ارسال پیام بدون پیوست اصلاح شد.
- پاسخ فقط‌پیوست نیز معتبر است و پیام خالی واقعی همچنان رد می‌شود.

---

# BlueGate Platform v5.0.31 — Live support chat

- صفحه ساخت تیکت در Mini App و وب به composer حرفه‌ای گفت‌وگو تبدیل شد.
- پیام‌ها به شکل bubbleهای دوطرفه با تیک تحویل و تیک دوم خوانده‌شدن نمایش داده می‌شوند.
- بازخوانی خودکار گفت‌وگو هر ۵ ثانیه در Mini App و وب اضافه شد.
- ارسال و نمایش پیوست‌های JPEG، PNG، WebP، PDF و TXT تا سقف ۵ مگابایت اضافه شد.
- خواندن پیام‌های طرف مقابل هنگام بازکردن گفتگو ثبت می‌شود و وضعیت read برای هر پیام برمی‌گردد.
- نسخه‌های کپی وب و manifest integrity پس از تغییرات همگام شدند.

---

# BlueGate Platform v5.0.30 — Performance hardening

- پاسخ Webhook تلگرام پیش از اجرای handlerهای سنگین flush می‌شود تا تأخیر Provider یا اعلان، صف Telegram را کند نکند.
- timeout پیش‌فرض و سقف timeout ارتباط با Providerهای X-UI، Marzban و Remnawave کوتاه و قابل‌کنترل شد.
- `connect_timeout` و `request_timeout` هنگام ذخیره تنظیمات Provider محدود و normalize می‌شوند.
- `web_gate.php` اکنون bootstrap کامل را load می‌کند و خطای `veyra_pro_core_active()` در entry point مستقیم رفع شده است.
- نسخه هسته پلتفرم به `5.0.30-performance-hardening` و نسخه manifest ماژول Pro Core به `2.1.6` همگام شد.

---

# Mini App design unification — v5.0.16

یکدست‌سازی زبان طراحی Mini App (فقط `public/miniapp/`؛ وب، ماژول‌ها و `integrity.json` دست‌نخورده‌اند).

- فایل جدید `miniapp/tokens.css` (بعد از `design-system.css` لود می‌شود): مقیاس شعاع (`--r-sm/md/lg/xl/xxl`)، فاصله، سایه و استایل واحد آیکون (`.bg-ico`).
- `border-radius` از ۱۰ تا ۳۰ پیکسل (۵۲۵ مورد) روی ۵ پله ۱۲/۱۶/۲۰/۲۴/۲۸ جمع شد. مقدارهای ≤۹، `999` و ≥۳۱ دست‌نخورده‌اند.
- `font-size` های اعشاری (۱۱.۵، ۱۲.۵، ۱۳.۵، ۱۴.۵، ۱۶.۵) به عدد صحیح گرد شدند (۲۸۶ مورد).
- رنگ‌های پراکنده (`#00f2fe`, `#45c8ff`, `#58ddff`, `#4ade80`, `#86efac`, `#6ee7a0`, `#22c55e`, `#f59e0b`, `#fbbf24`, `#8b5cf6`, `#1d9bf0`) به توکن‌های `--bgds-*` / `--accent` وصل شدند (۷۹ مورد؛ نسخه‌های آلفا مثل `#22c55e33` دست‌نخورده ماندند).
- آیکون ناوبری (کاربر + ادمین)، سبد خرید و اعلان‌ها از یونیکد/اموجی به SVG هم‌سبک تبدیل شد.
- فونت Inter و preconnect به Google Fonts حذف شد (Vazirmatn از `design-system.css` به‌صورت محلی لود می‌شود).
- `tokens.css` به لیست asset های `miniapp/index.php` اضافه شد (cache-busting خودکار).
- تم روشن اضافه نشد: بسیاری از گرادیان‌ها رنگ ثابت تیره دارند و نیمه‌کاره‌بودنش بدتر از تم تیره یکدست است.
- تست نشده: PHP روی محیط ساخت نبود (`php -l` اجرا نشده).

---

# Stars stats (admin only) — v5.0.15

نمایش موجودی بات و مجموع خریدهای Telegram Stars در داشبورد ادمین (Mini App و وب).

- API: اکشن `admin_stars_stats` (مجوز `dashboard`، rate limit: ۳۰ درخواست در دقیقه). پارامتر `refresh=1` موجودی را از تلگرام دوباره می‌گیرد (حداقل فاصله ۱۰ ثانیه).
- موجودی بات: `getMyStarBalance`، کش ۶۰ ثانیه‌ای در `settings.stars_balance_cache`. در صورت خطا فقط در لاگ سرور ثبت می‌شود.
- مجموع فروش: رکوردهای `orders` و `credit_topups` که `stars_charge_id` دارند.
- ستون جدید `stars_paid_at` در هر دو جدول (migration + backfill خودکار با `bluegate update` یا `bluegate migrate`). تا قبل از migration، آمار بازه‌ای از `created_at`/`credited_at` حساب می‌شود.
- ثبت `stars_paid_at` بعد از commit تراکنش پرداخت و best-effort انجام می‌شود تا مسیر پرداخت را تحت تأثیر قرار ندهد.
- فرانت: کارت در `public/miniapp/app.js` و `modules/pro-web/public/js/admin.js` (کپی در `public/web/js/admin.js`).
- بعد از آپدیت: `bluegate update` (یا `bluegate migrate`) و بعد یک بار رفرش کامل Mini App/وب.
- تست نشده: PHP روی محیط ساخت نبود؛ قبل از پروداکشن `find . -name '*.php' -exec php -l {} \;`.

---

# BlueGate v5.0.14 — Security hardening (بر پایه v5.0.13)

دست‌نخورده: `app/license.php`، `app/module_loader.php`، `integrity.json`ها، CLI لایسنس.

## تغییرات
1. **Rate limit** (`bootstrap.php`, `api.php`): پارامتر `$failClosed`. برای register / login / OTP / forgot+reset password / telegram_login+link / email_change_* اگر جدول `rate_limits` نباشد یا DB خطا بدهد، درخواست رد می‌شود (پیام RATE_LIMITED). بقیه bucketها مثل قبل.
2. **IP واقعی**: `TRUSTED_PROXIES` در config (پیش‌فرض خالی). فقط اگر `REMOTE_ADDR` در این لیست باشد از `CF-Connecting-IP` یا `X-Forwarded-For` (از راست، اولین IP غیرمعتمد) استفاده می‌شود. پشتیبانی IPv4/IPv6 و CIDR.
3. **توکن در بدنه POST حذف شد** (فرانت‌اند هرگز `authToken` در body نمی‌فرستاد). فقط کوکی `nx_session` یا هدر `X-Web-Token`.
4. **اکشن‌های ادمین**: همه اکشن‌های غیر `admin_` بررسی شدند؛ همه مخصوص کاربر خودش هستند. یک لایه دفاعی اضافه شد: هر اکشن غیر `admin_` که نامش شامل broadcast/backup/restore/provisioning/routing/monitoring/vip_rates/set_role/remove_role باشد، نیاز به ادمین کامل دارد.
5. **`is_admin`**: فقط `is_full_admin` می‌تواند آن را عوض کند؛ حذف ادمین خود و حذف آخرین ادمین ممنوع. کوئری‌های تشخیص ادمین دیگر `users.id` را با `telegram_id` قاطی نمی‌کنند (فقط `telegram_id`).
6. **توکن رسید**: فرمت `<expiry>.<hmac>` با HMAC-SHA256، متصل به type+id+user_id+expiry، اعتبار ۱۵ دقیقه، `hash_equals`، بدون secret پیش‌فرض ثابت (اگر `WEBHOOK_SECRET` خالی باشد توکن ساخته نمی‌شود). پاسخ رسید: `Cache-Control: private, no-store`، `Referrer-Policy: no-referrer`، فقط image/jpeg|png|webp، CSP sandbox.
7. **نشت خطا**: به کلاینت فقط پیام فارسیِ دستی‌نوشته و بدون نشانه فنی (SQL، مسیر، URL، HTTP_FAILED، token…) می‌رسد؛ بقیه فقط در لاگ سرور. شامل global handler، `admin_provision_now`، health check.
8. **`verify_webapp_init_data`** (بازبینی + سخت‌سازی): الگوریتم HMAC درست بود. اضافه شد: رد کردن BOT_TOKEN خالی، hash غیررشته‌ای، `auth_date` اجباری و غیرآینده، سقف طول ورودی.
9. **وب‌سرور**: regex اشتباه `.htaccess` اصلاح شد (`config.php` را نمی‌گرفت)؛ nginx: رد `.sql/.log/.bak/.sh/.env/.ini`، رد `config*.php`/`app/`/`modules/`، اجرای PHP در `/uploads/` ممنوع، هدرهای nosniff/Referrer-Policy/HSTS. `public/uploads/.htaccess` جدید.
10. **Cron** (`cron_provisioning.php`): کلید `WEBHOOK_SECRET` و پارامتر `?secret=` حذف شد (WEBHOOK_SECRET کلید مادر secretهای مشتق‌شده است). `CRON_KEY` با مقدار `CHANGE_ME…` پذیرفته نمی‌شود. متن خطا دیگر برنمی‌گردد.
11. **endpoint سلامت providerها**: rate limit + سقف زمان، بدون نشت متن خطا.

## قبل از استفاده
- اگر کرون HTTP شما با `?key=<WEBHOOK_SECRET>` یا `?secret=` صدا زده می‌شود، به `CRON_KEY` یا هدر `X-Cron-Key` تغییرش دهید (کرون نصب‌کننده CLI است و تغییری لازم ندارد).
- پشت Cloudflare/پروکسی هستید؟ `$TRUSTED_PROXIES` را در `config.php` پر کنید.
- برای اعمال nginx جدید: `bluegate update` یا `bluegate repair`.
- لینک‌های رسید حالا ۱۵ دقیقه اعتبار دارند (با باز کردن دوباره رسید، لینک جدید ساخته می‌شود).
- پیام‌های خطای انگلیسی RuntimeException دیگر به کاربر نمی‌رسند (در لاگ هستند).

## تست نشده
PHP روی محیط ساخت نصب نبود؛ `php -l` اجرا نشده. فقط تعادل نحوی، شبیه‌سازی heredoc nginx و منطق CIDR بررسی شد. قبل از پروداکشن: `find . -name '*.php' -exec php -l {} \;`

---

# BlueGate Platform v5.0.1 — BlueGate Pro Modules Integration

This package is based on BlueGate Platform v5.0.0 with the following additions from BlueGate Platform Pro v2.1.6:

## Added Components
- Full modular Pro system: `modules/pro-core/` and `modules/pro-web/`
- License runtime: `app/license.php` + `cli/lib/license.sh`
- Module loader with integrity verification: `app/module_loader.php`
- Capabilities metadata: `manifest/capabilities.json` and `installer-schema.json`
- Mini App improvements: updated `public/miniapp/app.js`, `final-polish.css/js`, `bluegate-theme.css`, `admin-web-parity.css`
- Public entry points: `public/web_gate.php`, updated `public/index.php`
- CLI support for `bluegate license ...` commands

## Integration Notes
- `app/bootstrap.php` now loads `license.php` and `module_loader.php`
- Existing BlueGate features (`advanced_features.php` with `bluegate_*` functions) remain intact and continue to work
- Pro modules load only when a valid signed Pro entitlement is present (fail-closed otherwise)
- License paths are currently BlueGate-oriented (`/etc/bluegate/license`). Adjust `LICENSE_STATE_DIR` in config if needed for BlueGate deployments
- No breaking changes to core Free/BlueGate functionality

## Version
5.0.1-pro-modules

## Visual & Functional Additions (v5.0.2)

- Mini App now uses BlueGate's resilient Telegram bridge (`waitForTelegramBridge`)
- Full Pro feature locking UI: `proBadge()`, `showProUpgrade()`, `BLUEGATE_PRO_FEATURES`
- Admin panel tiles with Free/Pro distinction and upgrade prompts
- Pro CSS styles (badges, upsell sheets, locked tiles) from `component-parity.css`
- All polish layers (final-polish, bluegate-theme, admin-web-parity) loaded

These are user-visible improvements in the Telegram Mini App.
## 5.0.33 - Notification deduplication

- Added a persistent Telegram dispatch guard for admin and user messages.
- Delivery notifications are now idempotent across Bot, Mini App, web, and retry paths.
- Order admin notifications use order/event keys to prevent duplicate sends.
- Removed noisy per-attempt provisioning retry notifications; only the final failure is sent.
## 5.0.34 - Backup timeout fix

- Prevented update step 2/9 from waiting indefinitely on `mysqldump` or file archiving.
- Added bounded database and application-file backup operations with explicit failure messages.
- Enabled streaming database dumps and skipped disposable dependency binaries that can unnecessarily slow backups.
