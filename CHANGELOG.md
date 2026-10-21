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