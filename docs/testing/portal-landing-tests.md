Portal Landing Page Testing

This document is the test specification for [`app/(portal)/[id]/page.tsx`](<../../app/(portal)/[id]/page.tsx:11>) — the page a participant lands on at `/{plan}`: the plan's hero, mission, benefit hubs, life-event shortcuts and footer.

Unlike Edit Plan, this page owns almost no UI of its own. It is a **projection**: it reads the plan from [`useClientPortal()`](../../contexts/client-portal-context.tsx:76), decides which contacts a participant may see, resolves the footer colour, and hands the result to [`ClientPortal`](../../components/pages/client-portal/client-portal.tsx:152) with `hideHeader` and `hideFooter` set (the real header and disclosures come from [`layout.tsx`](<../../app/(portal)/[id]/layout.tsx:44>)). Most of what can go wrong here is therefore data shaping, and that is what the tests should target.

## Summary

- **Unit tests:** 236 passing in 16 files
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
pnpm test:portal-landing           # all Portal Landing suites (236 tests)
pnpm test:portal-landing:watch     # watch mode
pnpm test:portal-landing:coverage  # suites + V8 coverage
```

Backed by [`config/vitest/vitest.portal-landing.config.mts`](../../config/vitest/vitest.portal-landing.config.mts) and [`scripts/tests/run-portal-landing-tests.mjs`](../../scripts/tests/run-portal-landing-tests.mjs), which list the suites explicitly so the command cannot pick up unrelated tests.

## Test inventory

| #   | Suite                                                                            | Tests | Focus                                                                               |
| --- | -------------------------------------------------------------------------------- | ----: | ----------------------------------------------------------------------------------- |
| 1   | `app/(portal)/[id]/__tests__/page.test.tsx`                                      |    17 | Contact projection, visibility fallback, footer preference, props to `ClientPortal` |
| 2   | `contexts/__tests__/client-portal-context.test.tsx`                              |    14 | `forPortal` fetch, archived/alias, error states, profile, refetch events            |
| 3   | `components/pages/client-portal/sections/__tests__/portal-benefits.test.tsx`     |    26 | Four hub cards, count-driven widths, visibility, publish switch, partner branding, editing-only completeness cards |
| 4   | `components/pages/client-portal/sections/__tests__/portal-hero-mission.test.tsx` |    36 | Hero/mission copy, phone stacking vs the desktop column, edit affordances, and the library-backed Ask bar with its focus lift |
| 5   | `lib/__tests__/benefit-completeness.test.ts`                                     |    24 | The completeness matrix behind the "finish this benefit" dialog                     |
| 6   | `lib/__tests__/disclaimer-constants.test.ts`                                     |    30 | Footer text, placeholder resolution, disclaimer-envelope shapes                     |
| 7   | `lib/__tests__/portal-disclosures.test.ts`                                       |    22 | Which footer row each scope reads (landing and per-benefit), and the writes          |
| 8   | `components/portal-editing/__tests__/portal-disclosure-section.test.tsx`         |    12 | The Disclosure section: both scopes, the text, the footer background, its notices     |
| 9   | `components/portal-editing/editors/__tests__/portal-home-editor-live-preview.test.tsx` | 2 | Every panel edit previews live, and Disclosure rides as the last section        |
| 10  | `app/(portal)/[id]/__tests__/page-edit-affordances.test.tsx`                             | 4 | Hero → Hero Content and the Hero Banner Image, mission → Mission Statement      |
| 11  | `lib/__tests__/portal-editor-sections.test.ts`                                          | 11 | The section ids the page and the panel agree on, and the in-section anchors     |
| 12  | `components/wizard/new-client-steps/sections/__tests__/editor-panel-focus.test.tsx`     | 7 | The panel scrolling itself to a section — or to an anchor inside one            |
| 13  | `components/portal-editing/__tests__/portal-section-edit-button.test.tsx`               | 7 | The blue button: hidden for participants, opens in place or navigates           |
| 14  | `components/portal-editing/__tests__/portal-benefits-glance-section.test.tsx`           | 9 | Section 5: four card accordions, their saves, preview, and the Create Benefit link |

## The Edit Panel's "Your Benefits at a Glance" section

Section **5** of the Landing panel. Each of the page's four cards is drawn from a
BENEFIT row (`landingCardImage` / `landingCardBody`), so this section is the
portal's copy of Create/Edit Benefit → Step 1 → Branding → **Your Benefits at a
Glance Card** — one accordion per category, the same two fields, plus a one-press
"use the suggested text".

| Piece | Where | Owns |
| --- | --- | --- |
| The section | [`portal-benefits-glance-section.tsx`](../../components/portal-editing/portal-benefits-glance-section.tsx:1) | Four accordions, four independent saves |
| The rows | `GET /api/clients/:id/benefits/:category?forPortal=1` | Whether each category HAS a benefit, and its card fields |
| The write | `PUT …?updateOnly=1` | `landingCardImage` + `landingCardBody` only |

Three decisions are load-bearing:

1. **A missing benefit cannot be created here.** A Benefit row brings its own
   pages, topics and contacts — that is Step 1's job — so a category with no row
   gets an explanation and a link to
   `/new-benefits?planId=…&category=…` (opened in a new tab, so the portal being
   edited stays put). The Custom card links with `category=Custom`, the deep
   link's alias for the sponsor hub.
2. **`?updateOnly=1`.** The route upserts by default; the card editor must never
   re-create a Benefit the advisor deleted, so it asks for the update-only path.
   `undefined` leaves a column untouched and `""` clears it — which is exactly
   what `JSON.stringify` does with the fields the advisor did not touch.
3. **These saves are their own.** The panel's Save bar writes the PLAN; the cards
   live on Benefit rows. Each card has its own Save, and after a successful write
   the section re-reads its rows and refetches the portal, so the cards beside the
   panel repaint.
4. **The image is the Featured Image's control.** `BrandImageUpload` gives Choose
   File / Choose Default Image while empty, then Edit / New / Delete once set, with
   the same 3:2 (1200×800) crop editor and the default-image gallery. One uploader,
   one set of rules.

**Live preview.** Typing or choosing an image mirrors the draft into
`employeePortalPreview.benefits` — the array the cards beside the panel render from
— so the page repaints before anything is saved. Only an EXISTING mirror row is
patched: pushing one would conjure a card for a category the plan has no benefit
for. Nothing is written until that card's Save.

The section is inserted BEFORE the disclosure, which is why the footer is now
Section 6.

## The Edit Panel's Disclosure section

The Landing Page Edit Panel ends with **Disclosure** (the panel numbers it, so it
is the last `Section N`). It edits the very record Create Plan's **Step 5
(Disclosures)** and Edit Client's **Disclosures** tab write — but in place, beside
the footer it paints.

| Piece | Where | Owns |
| --- | --- | --- |
| The section | [`portal-disclosure-section.tsx`](../../components/portal-editing/portal-disclosure-section.tsx:1) | The textarea, the footer background choice, and the scope notice |
| The record | [`lib/portal-disclosures.ts`](../../lib/portal-disclosures.ts:1) | Which row the four non-hub footers read, and the two writes |
| The host | [`portal-home-editor.tsx`](../../components/portal-editing/editors/portal-home-editor.tsx:1) | Live preview (`patchClientData`) and the queued `disclaimers` PUT |

**Which footers it changes.** This section edits the **landing** scope: one
disclosure covers the four **non-hub** portal pages — the Landing Page, My
Benefits Team, News & Events and Employee Resources. The identical section is
mounted on every benefit hub with the *benefit* scope, editing that hub's
`byCategory` row instead; see
[`portal-benefit-hub-tests.md`](portal-benefit-hub-tests.md).
[`layout.tsx`](<../../app/(portal)/[id]/layout.tsx:332>) picks their text with one
rule: the first row whose location is "Home Page" or "Global", or that applies to
every benefit category. `findLandingDisclosure` mirrors that rule exactly, so the
panel edits the row that is actually on the page — and it appends one when the plan
has none. The benefit hubs keep the disclosure set per benefit in
`disclaimers.byCategory`; this section never touches it, which the suite pins by
asserting `byCategory` survives every write. The section says all of this in its
notice, because "one edit, four pages" is not guessable from the field alone.

**How it saves.** The section is fully controlled: the text and the preference are
derived from `clientData.disclaimers` on every render. An edit patches the portal
context (so the footer band repaints on the keystroke) and queues
`{ disclaimers: <envelope> }`; the panel's Save PUTs that to
`/api/clients/:id`, where `mergeDisclaimersPayload` merges it into the stored
envelope. Cancel refetches, which reverts both the field and the footer.

**What the suites pin.** `portal-disclosures.test.ts`: the envelope parse (object,
JSON string, legacy plain text, array, broken JSON); the row the layout reads
(Home Page, Global, apply-all, text-before-empty ordering, a benefit row being
ignored); updating that row while keeping its id and every other key; appending one
when there is none; and the footer-background write.
`portal-disclosure-section.test.tsx`: the scope notice naming all four pages,
the stored text, the advisor-text prefill, typing into the Home Page row, the
organization-only default, and the three background choices.
`portal-home-editor-live-preview.test.tsx`: the section is carried as the panel's
last one, and typing in it emits a `disclaimers` patch whose first row is
`Home Page`.

## Blue edit affordances

The page behaves like Create/Edit Client and Benefits Step 2: the advisor clicks
the part of the page they want to change and the panel opens on the section that
owns it.

| Region | Affordance | Opens |
| --- | --- | --- |
| Hero copy (title, description) | hover ring + blue pencil (from `PortalHero`) | `hero-content` |
| **Hero photograph** | blue **Edit Hero Banner Image** button (top-left, always visible) | the Hero Banner Image card (`hero-background`) |
| Mission copy | hover ring + blue pencil (from `PortalMission`) | `mission-statement` |
| **Featured image** | blue **Edit featured image** button | the Featured Image card |
| **Footer** | blue **Edit footer** button (rendered by the layout, so every portal page has it) | `disclosure` — or, from another portal page, a trip here (below) |
| **Your Benefits at a Glance** section | blue **Edit benefits at a glance** button (top-right) | `your-benefits-at-a-glance` — the panel's Section 5, below |

**The photograph is named.** Its button reads **Edit Hero Banner Image** rather
than "Edit image" or a bare pencil: the region edited is a card two levels inside
the panel (the second card of *Images*), so the label has to carry that. The whole
photograph stays clickable too (hover ring) — both paths call the provider's
`focusSection` with `hero-background`.

**One button for the whole section.** "Your Benefits at a Glance" draws a single
blue button for the SECTION rather than one per card, because the four cards are
edited together in the panel's **Section 5** (below) — a per-card button would open
the same accordion list four times. The cards themselves keep their own click
(each still links to its hub page), so the button sits above them. Its id is
derived from the section title the panel gives it
(`portalSectionId("Your Benefits at a Glance")`), so the page and the panel cannot
disagree about the spelling. The old advisor-only hover note was retired when that
section landed — the panel now says where a card comes from, and repeating it over
the card itself only fought with the card's own click.

**How it works.** [`PortalSectionEditButton`](../../components/portal-editing/portal-section-edit-button.tsx:1)
calls `focusSection(id)` on the editing provider, which opens the panel and stores
`{ id, nonce }`; `nonce` is what makes a second click on the same region scroll
again. [`EditorPanelWrapper`](../../components/wizard/new-client-steps/sections/components/editor-panel-wrapper.tsx:25)
renders every section as `[data-section-id={portalSectionId(title)}]` and scrolls
its own body to that element.

**Sections vs anchors.** Some regions are a CARD inside a section, not a section:
the Featured Image is the first item of "Mission Statement", while the "Images"
section holds Company Logo and the Hero Banner. Pointing the image's button at
`images` therefore landed on Company Logo — the bug that produced
`portalEditAnchor`. The same trap sits on the hero: the photograph is "Hero Banner
Image", the second card of "Images", NOT the "Hero Content" section (which holds
the welcome statement and the banner-overlay settings). The wrapper looks for
`[data-section-id]` first and then for `[data-edit-anchor]`, and the two cards
carry `data-edit-anchor="featured-image"` and `data-edit-anchor="hero-background"`.

**The red "Live" badge.** Every portal panel wears the same badge in its header
([`portal-editor-shell.tsx`](../../components/portal-editing/portal-editor-shell.tsx:52)),
and it is red (`bg-red-500`, white uppercase text) rather than neutral grey: the
badge means "these edits change the LIVE page", and that is a warning colour. The
Home panel overrides only the *company-name* badge beside the title, never this one.

## Editing the footer from another page

The footer is **one record shared by four pages** — the Landing Page, My Benefits
Team, News & Events and Employee Resources — and only the Landing Page's panel
edits it. So on the other three, the same blue **Edit footer** button does not open
a panel; it **navigates to the Landing Page** with the intent in the URL, closes the
Comments rail, opens the panel and scrolls it to Disclosure.

| Step | Where | What happens |
| --- | --- | --- |
| 1 | the page the advisor is on | the button builds `/{plan}?edit=true&editSection=disclosure&editFrom=…` ([`lib/portal-editor-intent.ts`](../../lib/portal-editor-intent.ts:42)) and assigns it |
| 2 | `PortalCommentsRail` | `?edit=true` **arms** the editing chrome (without it there is no provider and no panel), while `hasPortalEditIntent` opens the rail with comments **OFF** |
| 3 | `PortalEditingProvider` | reads `?editSection=`, calls `setMode("off")`, `focusSection("disclosure")`, and toasts which page the advisor came from — once per `pathname:section` |
| 4 | `EditorPanelWrapper` | opens on the Disclosure section, retrying for ~0.5 s because the panel body can mount a commit after the request |

The toast is the part that stops the page change reading as a bug: *"The footer is
edited on the Landing Page — News & Events has no footer of its own…"*.

`buildPortalEditHref` **forces** `edit=true` even though the intent asks for no
rail: the flag is the gate, not a preference. Dropping it was the bug behind three
earlier attempts — the page loaded as a plain portal, with neither provider nor
panel, and the toast was all the advisor saw.

Everything here is inert for a participant: the hook is the OPTIONAL variant, so
no provider (and no edit permission) means no rings, no buttons, no handlers — the
suite asserts a participant gets `showEditIndicators={false}` and no buttons.

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

**Benefits (`portal-benefits.test.tsx`)** — four default cards; category-based slot filling; a hidden hub and the all-hidden `null`; a Benefit row whose own `isEnabled` is `false` removing its card (the publish switch, which the portal header and assistant read too — it wins over a visible category and the legacy mirror); the stale-`isEnabled` rule; **count-driven card widths** (one card = half the row, two = halves, three = thirds, four = quarters, partial rows centred); hub links vs the preview CTA; partner name from the assigned/primary contact; the image precedence chain; the 75-character copy cap; category default copy; the chevron split; `onEdit`; the "INCOMPLETE" placeholder card — the same skeleton as a live card (title block + `min-h-[130px]` footer) so heights match, rendered **only** in the editing view (`?edit=true`) and omitted for participants; the dialog's missing-info list and wizard link; and the preview bypass.

**Hero and mission (`portal-hero-mission.test.tsx`)** — saved and fallback copy; `role="button"` only when a handler exists; Enter/Space activation; body clicks not reaching the headline handler; the phone stacking order (header → image → statement) versus the desktop column that groups header and statement into one grid cell (so a taller image cannot open a gap under the headline) and never drops the statement under the image; the thumbnail vs stock photo; both scroll behaviours; the hero's company-name headline and `--------` fallback; and the benefits question search — typing queries the shipped topic library, the dropdown names each topic's hub/group, and submitting the field or a suggestion dispatches `ASSISTANT_ASK_EVENT` for the chatbot to answer. The sheet opens on that question, pinned so the answer reads from its first line. Focusing the field lifts the bar below the fixed banner + header (marked `data-portal-header`), with a 10px gap, and reports the focus so the chatbot's pill steps aside on a phone. On a phone the headline, copy and Ask bar share one full-width column; from `sm` up they keep the classic 900px card with the headline and copy at 4/5. The phone placeholder is "Ask a question", and the scroll arrow is hidden on phones (`hidden sm:block`). The card stays inside the hero, under the field; on a phone the hero grows a five-row reserve around it only once matches exist, with the height animated, and a longer list (up to a dozen matches) scrolls inside the card. An `IntersectionObserver` reports whether the hero is on screen, so the assistant's floating pill stays hidden until it is scrolled past. The mission section stacks header → featured image → statement on phones; from `lg` up the image returns to the left column with the header and statement stacked on the right.

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
5. `?edit=true` opens the Comments rail for an advisor

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
- [ ] `?edit=true` opens the Comments rail for an advisor and is absent for participants.
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
