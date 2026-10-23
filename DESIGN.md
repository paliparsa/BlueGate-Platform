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

## Homepage experience refinement (v5.2.1)
- Treat the homepage as a service index first: a concise brand introduction, discoverable dynamic catalog, compact purchase reassurance, then featured purchase configurators and lower editorial content.
- Avoid repeating the same value proposition in both hero columns. The visual panel should support discovery, not compete with the main headline.
- Interface icons use inline SVG; emoji may remain in customer-generated product content but should not be introduced as static interface chrome.
- Do not display a static numbered purchase strip as a progress indicator unless its state reflects the user's actual progress.
- Keep catalog, product cards, tabs and configurators readable at desktop, tablet and narrow mobile widths; preserve all existing IDs, API sources and action handlers.
- The catalog defaults to all active services and supports client-side search across service/category/plan text plus sorting by featured status, price, and name. Search clear, result count, no-results copy, keyboard card activation, focus and reduced-motion behavior are part of the catalog contract.
- Product cards may show catalog-sourced category, description, image, featured state, discount and starting price; never hard-code service categories or prices. Continue using the existing BGCheckout path.

## Change discipline
1. Change this document when an approved, durable design decision changes.
2. Update the website token adapter and affected components in the same change.
3. Preserve business logic and selectors used by `app.js`, `checkout.js`, `account.js`, `dashboard.js`, and `admin.js`.
4. Verify desktop, narrow mobile, keyboard focus, and reduced motion before declaring the UI done.

## Lower homepage sections (v5.1.97)
- The lower homepage is a single editorial sequence: optional More Services catalog, compact benefits grid, optional VPN comparison, customer reviews, connection guides, FAQ, then footer.
- Keep the signature treatment restrained: thin royal-blue rules on benefit cards, dark layered surfaces, quiet borders, and clear Persian typography. Avoid heavy gradients, oversized glow, and decorative emoji as new UI chrome.
- Dynamic sections retain their current IDs, data sources, and visibility rules. CSS must not force hidden comparison, review, or tutorial content visible or alter product and checkout behavior.
- Mobile owns horizontal overflow locally for category chips, reviews, and the comparison table; the document remains naturally scrollable. Respect reduced motion, visible keyboard focus, and bottom safe-area padding.


## Homepage hierarchy (v5.1.98)
- The first fold introduces BlueGate in plain Persian and avoids generic AI-style brand language.
- Place the live catalog immediately after the hero. Categories and active products come from the existing storefront API and remain visible without an accordion or extra reveal click.
- Place compact reassurance cues after the catalog, then the existing featured VPN, Telegram Stars, and Telegram Premium purchase configurators.
- Place USDT/Toman, TRX/USD, and TON/USD reference rates after the featured purchase area and before lower editorial content. Label them as reference rates and clarify that each order's final amount is shown before payment.
- Keep all category, product, and checkout data dynamic; never hard-code categories or create a parallel checkout. Keep website HTML, JavaScript, and CSS mirrors aligned; do not modify Telegram Mini App assets.


## Integrated service catalog heading (v5.2.1)
- The “OUR SERVICES / سرویس موردنظرت رو انتخاب کن” heading belongs to the live catalog section, directly above its search, sort, category filters, and dynamic product grid.
- Do not repeat this heading above the separate featured VPN, Stars, and Premium configurators; those controls remain a secondary purchase path after the catalog.
- Keep the heading and catalog controls visually joined as one surface, with a restrained royal-blue edge, compact vertical rhythm, and responsive search/filter layout.
- Public website and served Pro Web HTML/CSS must remain synchronized for these shared homepage sections. Telegram Mini App files and logic remain out of scope.


## Brand Gateway homepage (v5.3.0)
- Homepage order is intentional: brand hero, the three core purchase configurators (BluePing VPN, Telegram Stars, Telegram Premium), purchase reassurance, then the complete live services catalog, reference rates, and lower editorial content.
- VPN, Stars, and Premium are the business's flagship services and must appear before the general catalog without removing or hiding other active catalog products.
- The hero signature is a restrained electric-blue gateway: layered circular light, one thin moving beam, staggered text/service reveal, and subtle card interactions. Keep the page predominantly near-black; the gate supports the brand rather than becoming a large gradient background.
- Use CSS-only motion with no interaction-blocking intro. Honor `prefers-reduced-motion`; never hide essential content while waiting for animation. Keep HTML/CSS mirrored between `public/web` and `modules/pro-web/public`. Mini App assets are out of scope.


## The Blue Gate cinematic intro (v5.4.0)
- The hero opens with a single thin blue beam resolving into the portal; the BlueGate mark follows, then headline/copy, then VPN, Telegram Premium, and Stars markers with short staggered delays.
- The primary CTA reads “مشاهده سرویس‌ها” and scrolls to the existing flagship configurators at #products; do not insert a blocking splash or delay the product interface for a long animation.
- Desktop pointer parallax is limited to a small offset, coalesced with requestAnimationFrame, and disabled on touch/coarse pointers or when reduced motion is requested. The CSS-only composition remains the fallback if the helper script fails.
- Keep mobile motion lighter, all content available without waiting, and all catalog, pricing, account, API, checkout, and Telegram Mini App behavior unchanged.
- Public web and served Pro Web HTML/CSS/JS mirrors must stay synchronized.

## Catalog and services correctness and accessibility (v5.4.3)
- Numbers in the web catalog and services (prices, counters, percentages, traffic volumes, remaining days) use one shared formatter, `window.BGFormat` in `js/pricing.js`: Latin digits with en-US thousands grouping, the Persian percent sign `٪`, and `تومان`/`GB` units. Latin digits are already used by every price, checkout amount, wallet value, and order ID on the web, so they remain the single numeral system; do not reintroduce `fa-IR` digits next to Latin ones.
- A catalog card's “از …” price is the lowest active plan price. When that plan is discounted, its original price is shown struck through before the sale price.
- Catalog cards are plain `article` elements. The visible “مشاهده پلن‌ها و خرید” control is a real `button` whose hit area is stretched over the card, and its accessible name starts with the visible text followed by the product name.
- The flagship VPN/Stars/Premium selector is a labelled group of toggle buttons (`aria-pressed`), not a tablist; the section's `h2` labels the group so headings do not skip levels (visible since v5.6.0).

## Editorial catalog (v5.5.0)
- The services catalog follows the editorial direction. Its heading, result count, search, sort and category tabs are one `#07080B` panel with a quiet border and a 3px royal-blue inline-start edge. The product grid sits below the panel, outside it.
- Category filters are underline tabs. The selected tab is white text with a 3px blue underline and a blue count pill. On narrow screens the row scrolls horizontally without a visible scrollbar.
- Catalog cards are flat horizontal rows on `#0D0F13`, laid out as icon tile, copy and side column. Use two columns above 1100px and one column at or below it. Mobile cards stack the tile and copy, then show a bordered price row and a full-width CTA.
- Card tiles are neutral (raised surface and quiet border). Do not rotate accent colours by index.
  - Blue is reserved for the CTA on hover/focus, the selected tab and focus rings.
  - Green is reserved for offer badges.
  - Gold is reserved for the featured marker.
- Each card has exactly one focusable control, the CTA button. Its hit area may cover the card. Keyboard focus outlines the whole card with `#7894FF`.
- Hover moves the card by at most 2px. All catalog transforms and transitions are disabled under `prefers-reduced-motion`.
- Muted text uses `#A1A8B5`. Faint text must not be darker than `#8A91A0`.

## Living Gateway hero (v5.6.0)
- The homepage hero is the "Living Gateway" (`<section class="hero shell hero--gateway">`). It supersedes the v5.3.0/v5.4.0 brand-stage panel. The copy column is on the inline-start side and the gateway visual is on the other side. On screens at or below 860px, the gateway sits above the copy at 210px tall.
- **Copy:** «خدمات دیجیتال، از یک دروازه.» with a short intro paragraph that names BluePing VPN, Telegram Premium and Telegram Stars.
  - Only the word «دروازه» is coloured (`#7894FF`). The h1 has plain text colour, not gradient text.
  - The static markup splits the headline into two clipped lines. `renderShell` rewrites `#heroTitle`/`#heroText` only when the storefront value differs from the current text, so the default markup and its motion stay intact.
  - Admin-customised copy renders as plain text.
  - Known older built-in defaults (`LEGACY_HERO_TITLES`/`LEGACY_HERO_TEXTS` in `js/app.js`) map to the new copy.
- **Order inside the copy column:**
  1. Eyebrow: a 3×26px royal-blue edge, then «BLUEGATE خدمات دیجیتال».
  2. h1.
  3. Intro paragraph.
  4. One primary CTA, «مشاهده همه سرویس‌ها», which goes to `#genericProductsSection`, plus the support CTA.
  5. «یا مستقیم:» shortcuts to the three flagship cards.
  6. Proof row.
  7. The brand slogan «به امید آینده‌ی آزاد».
- **The slogan stays.** It is a quiet signature line with a short blue rule, and it is not hidden from assistive technology.
- **Proof row:** only real facts.
  - Premium durations are «3، 6، 12». Use Latin digits per `BGFormat`.
  - Toman pricing has USDT/TRX/TON equivalents.
  - The live service count comes from `state.genericProducts.length`, the same number as the catalog's «همه سرویس‌ها» chip. It is the last cell and is reserved invisibly until storefront data arrives, so revealing it causes no layout shift. It is removed when there are no products. Never hardcode it.
- **Gateway visual:**
  - three rings, one with a dashed spin-in;
  - a one-shot sweep;
  - a thin beam;
  - the BlueGate mark on `#03091B` behind two opening doors;
  - a halo;
  - VPN, Premium and Stars nodes.
  - The visual is decorative (`aria-hidden`). Desktop pointer parallax moves the layers by depth through the individual `translate` property. It runs only for fine pointers and is disabled under reduced motion.
- **Motion:**
  - The entrance runs once, finishes within about 1.3s, and never blocks content. All keyframes animate only `transform`/`opacity` (`rotate`/`scale` included).
  - Motion lives inside `@media (prefers-reduced-motion:no-preference)`. Reduced motion shows the final state with no doors, parallax or scroll coupling.
  - Scroll-linked effects use CSS scroll-driven animations inside `@supports (animation-timeline:view())`:
    - the copy lifts and dims as the hero exits;
    - the gateway scales and opens;
    - the flagship heading edge draws in.
  - Mobile skips the sweep and uses shorter delays.
- **Flagship section (`#products`):** the h2 «سرویس‌های اصلی BlueGate» is visible, with a «FEATURED» kicker, a one-line subtitle and a 3px blue inline-start edge.
  - Flagship cards use the Direction 2 row affordance. A 3px blue inline-start edge scales in on hover, keyboard focus and the active card, and the CTA arrow moves 6px toward the reading direction.
  - The Premium badge reads «3، 6، 12 ماهه» and does not wrap.
- **Announcement:** the bar is rendered `is-pending` and keeps one line until storefront settings arrive, so the hero does not jump.
  - The last rendered text, or an empty value for a disabled bar, is remembered in `localStorage` (`bg_announcement`). Later visits paint it, or collapse the bar, before first paint.
  - A first visit whose announcement wraps to two lines on a narrow phone can still shift once.
