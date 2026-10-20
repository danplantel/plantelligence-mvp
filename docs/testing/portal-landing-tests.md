# Portal Landing Page Testing

This document is the test specification for [`app/(portal)/[id]/page.tsx`](<../../app/(portal)/[id]/page.tsx:11>) — the page a participant lands on at `/{plan}`: the plan's hero, mission, benefit hubs, life-event shortcuts and footer.

Unlike Edit Plan, this page owns almost no UI of its own. It is a **projection**: it reads the plan from [`useClientPortal()`](../../contexts/client-portal-context.tsx:76), decides which contacts a participant may see, resolves the footer colour, and hands the result to [`ClientPortal`](../../components/pages/client-portal/client-portal.tsx:152) with `hideHeader` and `hideFooter` set (the real header and disclosures come from [`layout.tsx`](<../../app/(portal)/[id]/layout.tsx:44>)). Most of what can go wrong here is therefore data shaping, and that is what the tests should target.

## Summary

- **Unit tests:** none yet — this document is the specification the suite is written from
- **E2E:** none yet
- **Runner:** Vitest + React Testing Library + jsdom (planned)

| Layer | Where | Owns |
| ----- | ----- | ---- |
| Landing page | [`app/(portal)/[id]/page.tsx`](<../../app/(portal)/[id]/page.tsx:11>) | Contact filtering, visibility fallback, footer preference, prop projection |
| Portal context | [`contexts/client-portal-context.tsx`](../../contexts/client-portal-context.tsx:84) | Fetch `?forPortal=1`, archived/alias handling, skeleton, Page Not Found, refetch events |
| Portal layout | [`app/(portal)/[id]/layout.tsx`](<../../app/(portal)/[id]/layout.tsx:44>) | Header, footer disclosures, banner notice, comments rail, typography, light-mode enforcement |
| Portal renderer | [`components/pages/client-portal/client-portal.tsx`](../../components/pages/client-portal/client-portal.tsx:152) | Hero, mission, benefit cards, life-event shortcuts |
| Portal API | [`app/api/clients/[id]/route.ts`](../../app/api/clients/[id]/route.ts:79) | `forPortal=1` scoping, alias metadata, published documents, benefit hubs |

## Running these tests

The suites do not exist yet. When they land they should follow the pattern used by the other surfaces:

```bash
pnpm test:portal           # planned — landing page + context + layout suites
pnpm test:portal:watch
pnpm test:portal:coverage
```

They should be backed by a `vitest.portal.config.mts` that lists the suites explicitly (so `pnpm test:portal` cannot pick up unrelated tests) and a `scripts/tests/run-portal-tests.mjs`, exactly like [`vitest.edit-client.config.mts`](../../vitest.edit-client.config.mts) and [`scripts/tests/run-edit-client-tests.mjs`](../../scripts/tests/run-edit-client-tests.mjs).

## Planned inventory

| # | Suite | Tests | Focus |
| - | ----- | ----: | ----- |
| P1 | `app/(portal)/[id]/__tests__/page.test.tsx` | ~14 | Contact projection, visibility fallback, footer preference, props to `ClientPortal` |
| P2 | `contexts/__tests__/client-portal-context.test.tsx` | ~12 | `forPortal` fetch, archived/alias, error states, profile, refetch events |
| P3 | `app/(portal)/[id]/__tests__/layout.test.tsx` | ~12 | Footer disclaimer precedence, footer colour, org name, light mode, banner |
| P4 | `app/(portal)/[id]/__tests__/page.preview.test.tsx` | ~6 | Draft plans still preview; archived/404 do not |
| P5 | `lib/__tests__/disclaimer-constants.test.ts` | ~10 | Placeholder resolution for hub vs landing page |
| P6 | `e2e/portal.spec.ts` | ~5 | Real portal renders, hides unpublished hubs, filters contacts, redirects aliases |

## P1 — Landing page projection

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

## P2 — Portal context

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

## P3 — Portal layout

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

## P4 — Preview vs public

- a Draft plan renders at the same URL for preview
- an Archived plan and an unknown slug render the same **Page Not Found** state (no existence leak)
- a retired alias redirects to the canonical slug before the page renders

## P5 — Disclaimer constants

[`lib/disclaimer-constants`](../../lib/disclaimer-constants.ts) is pure and shared by the layout, the landing page and the dashboard:

- `resolveDefaultDisclosuresText(org, company, isCategoryHub)` includes the company name only for hub pages
- `resolveOrgOnlyDisclaimerText(text, org)` strips the company name for the landing page
- placeholders are replaced once and never left literal when a name is blank

## P6 — E2E (`e2e/portal.spec.ts`)

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

## Related documentation

- [`docs/testing/edit-client-tests.md`](edit-client-tests.md) — where the plan's branding, visibility, contacts and footer preference are authored.
- [`docs/testing/new-client-tests.md`](new-client-tests.md) — the wizard that creates the plan and its disclosures.
- [`docs/testing/settings-test.md`](settings-test.md) — the reference format for a page-level suite.
