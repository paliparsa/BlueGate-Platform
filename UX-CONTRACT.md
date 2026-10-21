# BlueGate Web UX Contract

## Scope
This contract covers the public website, customer account routes, and web admin shell. Telegram Mini App behavior and styling are outside the website-only redesign layer.

## Critical invariants
- Do not change checkout API requests, product IDs, selected plan values, pricing calculations, payment provider logic, order state transitions, wallet handling, account/session handling, permissions, or admin mutations as part of a visual refresh.
- Keep the current DOM IDs, data attributes, route selectors, and JavaScript entrypoints stable unless a separate behavior change is explicitly reviewed.
- Never make a purchase CTA appear successful before the existing checkout flow confirms it.
- Do not disable or hide an action based only on visual styling; preserve existing permission and state logic.
- Keep customer/account content separate from the public storefront without changing route dispatch.

## Navigation and feedback
- Preserve current hash navigation and `data-member-route` routing.
- Keep the existing account drawer, product selectors, sticky checkout, toast, admin modal, and form feedback as the canonical UI behaviors.
- Visual updates may change spacing, colors, typography, and icon presentation; they must not add competing overlays or new navigation mechanisms.
- Icon-only controls need accessible names; decorative SVGs should be hidden from assistive technology.

## Responsive behavior
- At widths up to 768px, keep controls tappable, cards readable, and primary actions available without horizontal page overflow.
- Preserve safe-area insets and the existing sticky checkout interaction.
- At 420px and below, avoid clipped navigation and price/action overlap.
- Reduced-motion preferences must suppress decorative animation without hiding content or state.

## Verification expectations
- Static checks: stylesheet link, token presence, responsive breakpoints, reduced-motion override, and unchanged checkout script references.
- Runtime checks before production release: storefront tab changes, VPN plan/package selection, Stars amount/price updates, Premium plan selection, checkout submission and error recovery, login/register drawer, member route changes, admin navigation and dialogs.
- Run at least desktop and narrow-mobile viewport checks; keyboard focus and reduced motion should also be inspected.
- If browser or provider credentials are unavailable, report those tests as not run rather than implying success.
