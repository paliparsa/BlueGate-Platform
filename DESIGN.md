# BlueGate Web Design Contract

## Product and audience
BlueGate is a Persian-first digital-services storefront for customers buying VPN plans, Telegram Stars/Premium, subscriptions, and related digital products. The web experience must make product choice, final price, checkout state, account access, and support clear before it tries to look impressive.

## Approved visual direction
**Premium Dark + Editorial + frictionless commerce.** The visual signature is a restrained royal-blue vertical edge and editorial type hierarchy against near-black surfaces. Keep the brand recognizable through typography, spacing, product content, and the BlueGate mark—not ambient effects or floating decorative cards.

### Palette (normative)
- Ink / page: `#030303`
- Raised page: `#07080B`
- Surface: `#0D0F13`
- Raised surface: `#12151B`
- Highest surface: `#191E27`
- Primary action: `#315EFB`
- Primary soft / focus: `#7894FF`
- Text: `#F5F7FB`
- Secondary text: `#A1A8B5`
- Quiet border: `rgba(255,255,255,.085)`
- Success: `#65D6AA`
- Warning: `#E8C878`
- Danger: `#FF8595`

### Typography
- Persian and general UI: current self-hosted `Vazirmatn` stack.
- Use heavy weights for short display headings only; body copy remains readable and calm.
- The repository currently bundles Vazirmatn but not Yekan/Yekan Bakh. Do not reference an absent font file; add a licensed, versioned font asset before changing the default stack.
- Price and quantity figures should remain visually stable and clearly separated from explanatory copy.

### Layout and components
- Desktop content width: approximately 1240px; mobile gutters: 14px.
- Prefer asymmetric hero composition, short copy, one dominant CTA, and real product information.
- Cards use 12–18px radii, subtle borders, flat surfaces, and little or no shadow.
- Use royal blue for actions, selected states, and focus—not as a large decorative gradient.
- Reuse the existing selectors and behavior; do not introduce parallel checkout, auth, routing, toast, or modal implementations.
- Inline SVGs are the preferred static interface icon format. Product artwork supplied by the catalog remains content, not UI chrome.

### Motion and accessibility
- Motion should communicate state or affordance; no perpetual CTA shine or ambient drift.
- Honor `prefers-reduced-motion`, provide visible `:focus-visible` rings, and retain clear disabled states.
- Maintain RTL and mobile layout behavior, including safe-area insets and sticky checkout spacing.

## Runtime mapping
The website-only adapters are `public/web/css/editorial-redesign.css` followed by `public/web/css/header-profile-redesign.css`, loaded last by both the public mirror and the served Pro Web shell. They map legacy storefront variables and shared `--bgds-*` values to the palette above and scope admin-specific tokens to `.bg-admin-shell`. The Telegram Mini App does not load this stylesheet and remains on its existing shared design system.

## Shared website / Mini App interaction language
- The website should feel like the same BlueGate product as the Telegram Mini App through its black/royal-blue palette, SVG icon family, compact account controls, and consistent panel/button states, while retaining a website-specific desktop navigation layout.
- Header, profile popover, and credit quick-view use the website-only `header-profile-redesign.css` layer, loaded after `editorial-redesign.css` in both the served Pro Web shell and the public mirror. Keep the copies identical.
- On desktop, the profile menu is a compact anchored popover and the credit view anchors to the credit trigger. On narrow screens, account/credit popovers use a bottom sheet with safe-area padding, bounded viewport height, and reduced-motion support.
- Keep the existing `account.js` handlers and `BGDashboard` routes as the source of truth for account, notifications, orders, wallet top-up, transactions, profile, and admin actions. Do not create parallel payment or authentication flows. The Telegram Mini App must not load website-only styles.

## Change discipline
1. Change this document when an approved, durable design decision changes.
2. Update the website token adapter and affected components in the same change.
3. Preserve business logic and selectors used by `app.js`, `checkout.js`, `account.js`, `dashboard.js`, and `admin.js`.
4. Verify desktop, narrow mobile, keyboard focus, and reduced motion before declaring the UI done.
