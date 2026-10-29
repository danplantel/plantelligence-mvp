# Portal Landing Page Testing

This document is the test specification for [`app/(portal)/[id]/page.tsx`](<../../app/(portal)/[id]/page.tsx:11>) — the page a participant lands on at `/{plan}`: the plan's hero, mission, benefit hubs, life-event shortcuts and footer.

Unlike Edit Plan, this page owns almost no UI of its own. It is a **projection**: it reads the plan from [`useClientPortal()`](../../contexts/client-portal-context.tsx:76), decides which contacts a participant may see, resolves the footer colour, and hands the result to [`ClientPortal`](../../components/pages/client-portal/client-portal.tsx:152) with `hideHeader` and `hideFooter` set (the real header and disclosures come from [`layout.tsx`](<../../app/(portal)/[id]/layout.tsx:44>)). Most of what can go wrong here is therefore data shaping, and that is what the tests should target.

## Summary

- **Unit tests:** 115 passing in 6 files
- **E2E:** none yet — see [Remaining coverage](#remaining-coverage)
- **Runner:** Vitest + React Testing Library + jsdom

| Layer           | Where                                                                                                            | Owns                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Landing page    | [`app/(portal)/[id]/page.tsx`](<../../app/(portal)/[id]/page.tsx:11>)                                            | Contact filtering, visibility fallback, footer preference, prop projection                   |
| Portal context  | [`contexts/client-portal-context.tsx`](../../contexts/client-portal-context.tsx:84)                              | Fetch `?forPortal=1`, archived/alias handling, skeleton, Page Not Found, refetch events      |
| Portal layout   | [`app/(portal)/[id]/layout.tsx`](<../../app/(portal)/[id]/layout.tsx:44>)                                        | Header, footer disclosures, banner notice, comments rail, typography, light-mode enforcement |
| Portal renderer | [`components/pages/client-portal/client-portal.tsx`](../../components/pages/client-portal/client-portal.tsx:152) | Hero, mission, benefit cards, life-event shortcuts                                           |
| Portal API      | [`app/api/clients/[id]/route.ts`](../../app/api/clients/[id]/route.ts:79)                                        | `forPortal=1` scoping, alias metadata, published documents, benefit hubs                     |

## Running these tests

```bash
pnpm test:portal-landing           # all Portal Landing suites (115 tests)
pnpm test:portal-landing:watch     # watch mode
pnpm test:portal-landing:coverage  # suites + V8 coverage
```

Backed by [`config/vitest/vitest.portal-landing.config.mts`](../../config/vitest/vitest.portal-landing.config.mts) and [`scripts/tests/run-portal-landing-tests.mjs`](../../scripts/tests/run-portal-landing-tests.mjs), which list the suites explicitly so the command cannot pick up unrelated tests.

## Test inventory

| #   | Suite                                                                            | Tests | Focus                                                                               |
| --- | -------------------------------------------------------------------------------- | ----: | ----------------------------------------------------------------------------------- |
| 1   | `app/(portal)/[id]/__tests__/page.test.tsx`                                      |    17 | Contact projection, visibility fallback, footer preference, props to `ClientPortal` |
| 2   | `contexts/__tests__/client-portal-context.test.tsx`                              |    14 | `forPortal` fetch, archived/alias, error states, profile, refetch events            |
| 3   | `components/pages/client-portal/sections/__tests__/portal-benefits.test.tsx`     |    21 | Four hub cards, visibility, partner branding, completeness gate                     |
| 4   | `components/pages/client-portal/sections/__tests__/portal-hero-mission.test.tsx` |    16 | Hero/mission copy fallbacks and the preview-only edit affordances                   |
| 5   | `lib/__tests__/benefit-completeness.test.ts`                                     |    24 | The completeness matrix behind the "finish this benefit" dialog                     |
| 6   | `lib/__tests__/disclaimer-constants.test.ts`                                     |    23 | Footer text, placeholder resolution, disclaimer-envelope shapes                     |

## Remaining coverage

| #   | Target                                                                            | Why it is still worth writing                                                           |
| --- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| P3  | `app/(portal)/[id]/__tests__/layout.test.tsx`                                     | The footer disclaimer precedence chain and the light-mode enforcement                   |
| P8  | `components/pages/client-portal/sections/__tests__/portal-header.test.tsx`        | Which hub links a participant sees (`benefitHubs` × visibility), the mobile menu        |
| P9  | `app/api/clients/[id]/__tests__/portal-get.test.ts`                               | The server contract behind every assertion above: `forPortal=1` scoping, alias metadata |
| P10 | `components/pages/client-portal/sections/__tests__/portal-popup-overlay.test.tsx` | Pop-up targeting and the `showEveryVisit` dismissal semantics                           |
| P11 | `components/pages/client-portal/sections/__tests__/portal-install-app.test.tsx`   | Platform detection and per-plan dismiss persistence                                     |
| P12 | `e2e/portal.spec.ts`                                                              | The only layer that can prove a real portal renders, redirects and filters              |

### What the landed suites assert

**Landing page (`page.test.tsx`)** — the skeleton and the `null` branch; `showOnPortal` filtering; the `{ contacts }` envelope; a JSON-string contact payload being dropped; hub-based contact filtering; the all-hidden exception; the `employeePortalPreview` visibility fallback; JSON-string visibility; secondary/custom footer backgrounds; plain-text and malformed `disclaimers`; `clientId`/`hideHeader`/`hideFooter`; `secondaryBannerImg`/`documents`/`employeePortalPreview` passthrough; advisor-over-plan disclaimer precedence; and the `""` defaults.

**Portal context (`client-portal-context.test.tsx`)** — `?forPortal=1` + `cache: "no-store"`; the profile request and its non-fatal failure; the skeleton staying up until both requests settle; 404/500/`success:false` → **Page Not Found**; **Archived** hidden, **Draft** previewed; alias redirect preserving the sub-path; refetch with `&t=`, and both window events filtered by `clientId`.

**Benefits (`portal-benefits.test.tsx`)** — four default cards; category-based slot filling; a hidden hub and the all-hidden `null`; the stale-`isEnabled` rule; grid sizing; hub links vs the preview CTA; partner name from the assigned/primary contact; the image precedence chain; the 75-character copy cap; category default copy; the chevron split; `onEdit`; the placeholder card; the dialog's missing-info list and wizard link; and the preview bypass.

**Hero and mission (`portal-hero-mission.test.tsx`)** — saved and fallback copy; `role="button"` only when a handler exists; Enter/Space activation; body clicks not reaching the headline handler; the thumbnail vs stock photo; both scroll behaviours; the hero's company-name headline and `--------` fallback; and the benefits question search.

**Completeness (`benefit-completeness.test.ts`)** — category aliasing and normalization; the nested-then-root benefits lookup; each of the four sections; logo from card/contact/plan (including `{ url }` and placeholder rejection); `image` vs `backgroundImage`; title and description (not the plan's mission); contact categories and the `{ contacts }` envelope; archived documents; the nested `companyData` merge; and the full missing-info list.

**Disclaimer constants (`disclaimer-constants.test.ts`)** — the org-only vs hub variants of the default text; placeholder resolution on arbitrary text; removing a company clause without a dangling comma; trademark normalization; and every shape `resolveDisclaimerText` accepts (string, JSON string, array, envelope, legacy `text`, broken JSON, empty).

## Behaviour: landing page projection

The page's own logic, in order:

1. **Loading branch.** `if (!clientData)`: renders a hero/benefit/footer skeleton while `loading`, otherwise `null`.
2. **Hero and mission.** `heroTitle` / `heroDescription` are read from the top level of `clientData`.
3. **Contacts.** `keyContacts` may be an array or a `{ contacts: [...] }` envelope. Both are filtered to `showOnPortal !== false`.
4. **Category visibility.** `categoryPortalVisibility` is read from the plan, falling back to `employeePortalPreview.categoryPortalVisibility`, then normalized with `getCategoryPortalVisibility`, then `filterContactsByPortalVisibility` applies the hub rules.
5. **Footer preference.** `disclaimers` may be a JSON string or object; `footerBackground` is extracted when it is an object, and a parse failure must not throw.
6. **Projection.** Everything is passed to `ClientPortal` with `hideHeader`, `hideFooter`, `clientId`, plus `secondaryBannerImg`, `documents`, `employeePortalPreview` and the normalized `categoryPortalVisibility`.

Tests to write:

- **Contacts**
  - an array of contacts is filtered by `showOnPortal` (`false` removed, missing kept)
  - the `{ contacts }` envelope is unwrapped before filtering
  - a contact whose hub is hidden is removed; non-hub contacts (Company / Plan Sponsor, Recordkeeper) survive
  - every contact survives when all four hubs are hidden (a new plan's default)
  - `categoryPortalVisibility` is used when present
  - the `employeePortalPreview.categoryPortalVisibility` fallback is used when the top-level field is missing
  - a JSON-string visibility payload is normalized before filtering
- **Footer preference**
  - `{ footerBackground: { mode: "secondary" } }` reaches `ClientPortal` intact
  - `{ mode: "custom", customColor: "#123456" }` is passed through
  - plain-text `disclaimers` yields `footerBackground: undefined` instead of throwing
  - malformed JSON yields `undefined`
- **Projection**
  - `clientId` comes from the route param, not `clientData.id`
  - `hideHeader` and `hideFooter` are both `true`
  - `secondaryBannerImg`, `documents`, `employeePortalPreview` and `categoryPortalVisibility` are forwarded
  - `advisorDisclaimer` wins over the plan's `disclaimers` for the `companyData.disclaimers` field
  - hero/mission fields fall back to `""` when absent
- **Branches**
  - no `clientData` + `loading` → the skeleton
  - no `clientData` + not loading → renders nothing

## Behaviour: portal context

[`ClientPortalProvider`](../../contexts/client-portal-context.tsx:84) is where a plan becomes visible or invisible, so its rules matter more than the page's:

- fetches `GET /api/clients/{id}?forPortal=1`; a silent refetch appends `&t=<timestamp>` and `cache: "no-store"`
- `404` → **Client not found**; any other non-OK → **Failed to load client data**
- `success: false` → **Failed to load client data**
- an `Archived` plan → **Client not found** (Archived stays hidden from participants)
- a Draft plan is **allowed** — the same URL is the wizard/flyer preview
- `isAlias` + `canonicalSlug` → `router.replace("/<canonical><suffix>")`, preserving the sub-path so `/old-slug/retirement` lands on `/new-slug/retirement`
- the profile request (`/api/profile?forPortal=1&clientSlug=…`) is best-effort: a failure leaves `profile` null without failing the page
- `loading` only flips false after **both** the plan and the profile settle
- while loading, the provider renders its own skeleton and the children never mount
- on error, the provider renders **Page Not Found**
- `plan-documents-persisted` and `benefits-updated` window events refetch only when `detail.clientId` matches

## Behaviour: portal layout (not yet tested)

The layout supplies the chrome and the disclosures, so its precedence chain is the most test-worthy thing on this surface:

1. per-category disclaimer (`disclaimers.byCategory[category]`)
2. on the landing page only: a disclaimer located at **Home Page** or **Global**, or one with `apply_all_benefits_categories`
3. the advisor's profile disclaimer (`advisorDisclaimer`)
4. disclaimers matching the current category
5. disclaimers with `apply_all_benefits_categories`
6. the universal default text (`resolveDefaultDisclosuresText`), or `useDefaultDisclosures`

Also:

- `[Organization Name]` and `[Company Name]` are resolved; hub pages include the company name, the landing page resolves the organization name only
- literal `\n`, `\r\n` and `\r` are normalized to real newlines
- duplicate disclaimer texts are removed case-insensitively
- the footer colour resolves `footers.footerBackground` → secondary / custom / primary
- the organization name falls back `branding.organizationName` → session → plan company name
- the layout removes `html.dark` on mount and restores it on unmount (portals never go dark)
- a published `portal-notice` banner is fetched by `clientId`

## Behaviour: preview vs public (covered by the context suite)

- a Draft plan renders at the same URL for preview
- an Archived plan and an unknown slug render the same **Page Not Found** state (no existence leak)
- a retired alias redirects to the canonical slug before the page renders

## Behaviour: disclaimer constants

[`lib/disclaimer-constants`](../../lib/disclaimer-constants.ts) is pure and shared by the layout, the landing page and the dashboard:

- `resolveDefaultDisclosuresText(org, company, isCategoryHub)` includes the company name only for hub pages
- `resolveOrgOnlyDisclaimerText(text, org)` strips the company name for the landing page
- placeholders are replaced once and never left literal when a name is blank

## Planned E2E (`e2e/portal.spec.ts`)

Prerequisites: `E2E_BASE_URL` (or `E2E_START_SERVER=1`) and `E2E_PORTAL_SLUG` naming a published plan.

1. the landing page renders the company name, hero headline and benefit cards
2. a hidden hub has no card
3. a contact in a hidden hub is absent; a plan-sponsor contact is still present
4. `/{retired-slug}` lands on `/{current-slug}` with the path preserved
5. `?comments=on` opens the Comments rail for an advisor

## What renders on the landing page

Because the page passes `hideHeader` and `hideFooter`, `ClientPortal` renders only:

- [`PortalHero`](../../components/pages/client-portal/sections/portal-hero.tsx) — banner image, headline, description, opacity/inversion settings
- [`PortalMission`](../../components/pages/client-portal/sections/portal-mission.tsx) — mission headline and body
- [`PortalBenefits`](../../components/pages/client-portal/sections/portal-benefits.tsx) — the benefit hub cards, filtered by visibility
- `SomethingChanged` — the eight life-event shortcuts (presentational today)

The header, footer disclosures, install prompt, pop-up notice and comments rail come from the layout.

## Manual checklist

### 1. Access and redirects

- [ ] `/{slug}` loads the plan; `/{object-id}` loads the same plan.
- [ ] A retired alias redirects to the current slug, keeping the sub-path.
- [ ] An archived plan and a nonexistent slug both show **Page Not Found**.
- [ ] A draft plan still previews (the wizard's eye icon).
- [ ] The browser tab title reflects the plan.

### 2. Branding and hero

- [ ] Logo, primary/secondary colours and typography theme match Edit Plan.
- [ ] The hero background image, opacity, inversion and gradient settings match the saved values.
- [ ] A missing hero background falls back to the header brand image.
- [ ] The layout never switches to dark mode, even with the dashboard's dark preference on.

### 3. Benefits

- [ ] Only hubs with a published benefit appear as cards.
- [ ] Hiding a hub in Edit Plan removes its card on refresh.
- [ ] Benefit cards link to `/{slug}/retirement`, `/health-insurance`, `/life-insurance`, `/wellness-programs` (or the custom hub slug).
- [ ] The life-event shortcuts render in two rows of four on desktop and one column on phones.

### 4. Contacts

- [ ] A contact with **Show on portal** off is absent.
- [ ] A contact in a hidden hub is absent, unless every hub is hidden.
- [ ] Plan sponsor / recordkeeper / external HR contacts survive hiding **Other**.
- [ ] The selected contact layout style renders as configured.

### 5. Footer and disclosures

- [ ] The footer colour follows the saved preference (primary / secondary / custom).
- [ ] The landing page shows the **Home Page** disclaimer, then the advisor's, then the universal text.
- [ ] Placeholders (`[Organization Name]`, `[Company Name]`) never render literally.
- [ ] Line breaks are preserved.

### 6. Portal extras

- [ ] A published portal notice banner shows, can be dismissed, and a countdown banner counts down.
- [ ] The install prompt appears for a PWA-eligible browser.
- [ ] `?comments=on` opens the Comments rail for an advisor and is absent for participants.
- [ ] `/{slug}/news-events` and the hub pages keep the same header and footer.

## Known gaps

Observations from the current implementation, to pin with tests or fix:

1. **The page's skeleton is unreachable.** [`ClientPortalProvider`](../../contexts/client-portal-context.tsx:213) returns its own skeleton whenever `loading`, so the page's `if (!clientData) { if (loading) … }` branch never renders for a real load. Only a provider-less render reaches it, which is exactly what a unit test does — so the test must assert the branch as rendered, not as reached.
2. **`return null` is equally unreachable** for the same reason: the provider renders **Page Not Found** for `error || (!clientData && !loading)`.
3. **The contact envelope's display styles are dropped.** The page unwraps `{ contacts, displayStyle, mobileDisplayStyle }` and filters the array, but `ClientPortal` only receives `keyContacts`; the plan's chosen contact layout styles never reach the landing page.
4. **A JSON-string `keyContacts` is silently dropped.** The page handles an array or an object, not a string — unlike [`useEditClient`](../../hooks/useEditClient.ts:384), which parses it. Legacy rows that stored the array as text render no contacts.
5. **`hideFooter` means `companyData.disclaimers` is unused on this page.** The value is computed (`advisorDisclaimer || disclaimers`) and passed into a `PortalDisclaimers` that never renders; the layout's own resolution is what participants see. Harmless, but it makes the projection look load-bearing when it is not.
6. **`brandImages._meta` hero fallbacks are dead here.** `ClientPortal` falls back to `companyData.brandImages._meta.heroTitle/heroDescription`, but the page never forwards `brandImages`.
7. **The visibility read is duplicated.** [`page.tsx`](<../../app/(portal)/[id]/page.tsx:86>) chains `(clientData as any)?.categoryPortalVisibility ?? clientData?.categoryPortalVisibility ?? employeePortalPreview…`; the second term is the same property, so it can never contribute and the only real fallback is `employeePortalPreview`. The test should assert the fallback, not the redundant link.
8. **`baselineBackgroundColor` is read off an array.** [`ClientPortal`](../../components/pages/client-portal/client-portal.tsx:282) passes `(data?.keyContacts as any)?.cardBackgroundColor` to `PortalBenefits`, but `keyContacts` is an array, so it is always `undefined` — and only the commented-out `PortalTeam` ever read that prop.
9. **The hero nests a `<div>` inside a `<p>`.** [`portal-hero.tsx`](../../components/pages/client-portal/sections/portal-hero.tsx) renders the description's pencil chip inside the description paragraph, which React reports as `validateDOMNesting: <div> cannot appear as a descendant of <p>` whenever a preview handler is passed. Browsers close the `<p>` early, so this is a hydration hazard, not just a warning. The hero suite surfaces it; moving the chip beside the `<p>` would clear it.
10. **Four default hub cards are always rendered.** [`PortalBenefits`](../../components/pages/client-portal/sections/portal-benefits.tsx:220) maps over its own defaults, so a plan with no Benefit rows still shows four cards (with placeholder copy and stock images) until a hub is hidden. That is deliberate for the preview, but it means "no benefits configured" is indistinguishable from "benefits configured" on the live portal whenever the hubs are visible.
11. **A published hub overrides the per-benefit switch.** `syncBenefitsWithCategoryVisibility` re-enables `isEnabled: false` before the filter runs, so the Step 5 benefit switch has no effect while its category is visible — pinned by the benefits suite.

## Related documentation

- [`docs/testing/edit-client-tests.md`](edit-client-tests.md) — where the plan's branding, visibility, contacts and footer preference are authored.
- [`docs/testing/new-client-tests.md`](new-client-tests.md) — the wizard that creates the plan and its disclosures.
- [`docs/testing/settings-test.md`](settings-test.md) — the reference format for a page-level suite.
