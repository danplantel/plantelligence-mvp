# Portal Navbar / Chrome Testing

This document is the test specification for [`app/(portal)/[id]/layout.tsx`](<../../app/(portal)/[id]/layout.tsx:44>) — the chrome every portal page renders inside: the fixed header and its navigation, the published top banner, the trust-bar footer and its disclosures, the Comments rail, the pop-up overlay and the install prompt.

The landing page hides `ClientPortal`'s own header and footer, so **this file is the only place those exist**. A regression here affects every portal route at once, which is why the behaviours below are worth pinning even though the component is mostly composition.

## Summary

- **Unit tests:** 116 passing in 9 files
- **E2E:** none yet (see [Remaining coverage](#remaining-coverage))
- **Runner:** Vitest + React Testing Library + jsdom

| Piece          | Where                                                                                                                                                               | Owns                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Layout content | [`layout.tsx`](<../../app/(portal)/[id]/layout.tsx:44>)                                                                                                             | Header height, banner, back-to-dashboard overlay, typography vars, light mode, disclosures resolution |
| Header / nav   | [`portal-header.tsx`](../../components/pages/client-portal/sections/portal-header.tsx:105)                                                                          | Logo, hub links (by `benefitHubs` × visibility), news, team, mobile menu                              |
| Footer         | [`footer.tsx`](../../components/layout/footer.tsx:29)                                                                                                               | Trust bar, quick links, disclaimer text, copyright line                                               |
| Comments rail  | [`portal-comments-rail.tsx`](../../components/comments/portal-comments-rail.tsx) + [`portal-comments-zoom.tsx`](../../components/comments/portal-comments-zoom.tsx) | `?comments=on` arming, advisor-only, the rail's column                                                |
| Pop-ups        | [`portal-popup-overlay.tsx`](../../components/pages/client-portal/sections/portal-popup-overlay.tsx:1)                                                              | Targeting, dismissal persistence                                                                      |
| Install prompt | [`portal-install-app.tsx`](../../components/pages/client-portal/sections/portal-install-app.tsx:1)                                                                  | Platform detection, per-plan dismissal                                                                |

## Composition

The default export wraps everything in this order — worth asserting because each wrapper is load-bearing:

1. `ClientPortalProvider` (fetches the plan; owns the skeleton and **Page Not Found**)
2. `PortalCommentsRail` (arms only for `?comments=on` + a signed-in advisor on desktop)
3. `PortalCommentsZoom` (scales the portal instead of reflowing it while the rail is open)
4. `ClientViewLayoutContent` (the chrome itself, with `children`)
5. `PortalInstallApp` — **outside** both the rail and the zoom, so the Comments preview neither scales nor scrolls it away

## Running these tests

```bash
pnpm test:portal-navbar           # all chrome suites (116 tests)
pnpm test:portal-navbar:watch     # watch mode
pnpm test:portal-navbar:coverage  # suites + V8 coverage
```

Backed by [`config/vitest/vitest.portal-navbar.config.mts`](../../config/vitest/vitest.portal-navbar.config.mts) and [`scripts/tests/run-portal-navbar-tests.mjs`](../../scripts/tests/run-portal-navbar-tests.mjs).

## Test inventory

| #   | Suite                                                         | Tests | Focus                                                                     |
| --- | ------------------------------------------------------------- | ----: | ------------------------------------------------------------------------- |
| 1   | `app/(portal)/[id]/__tests__/layout.test.tsx`                 |    30 | Composition, banner, back links, light mode, comment surface, disclosures |
| 2   | `components/comments/__tests__/portal-comments-rail.test.tsx` |    11 | The three arming gates and the on/off control                             |
| 3   | `components/comments/__tests__/portal-comments-zoom.test.tsx` |    10 | Scale clamp, height division, inset override, observer lifecycle          |
| 4   | `components/layout/__tests__/footer.test.tsx`                 |    13 | Trust bar, disclosure text, copyright, text colour                        |
| 5   | `lib/__tests__/portal-banner.test.ts`                         |    10 | CTA normalisation and countdown arithmetic                                |
| 6   | `lib/__tests__/benefit-custom-name.test.ts`                   |    20 | Custom hub naming, placeholders, route segment                            |
| 7   | `lib/__tests__/typography-themes.test.ts`                     |     9 | CSS variables, Classic fallback, apply/restore                            |
| 8   | `lib/__tests__/light-surface-text-color.test.ts`              |     7 | Footer text colour vs maximum contrast                                    |
| 9   | `app/(portal)/[id]/not-found/__tests__/page.test.tsx`         |     6 | The portal's own 404, inside this chrome                                  |

## Remaining coverage

| #   | Target                                                                     | Why it is still worth writing                                                         |
| --- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| N3  | `components/pages/client-portal/sections/__tests__/portal-header.test.tsx` | Hub links from `benefitHubs` × visibility, the custom hub title, the mobile menu      |
| P9  | `app/api/clients/[id]/__tests__/portal-get.test.ts`                        | The server contract supplying `benefitHubs`, `advisorDisclaimer` and alias metadata   |
| P10 | `.../portal-popup-overlay.test.tsx`                                        | Pop-up targeting and the `showEveryVisit` persistence rules                           |
| P11 | `.../portal-install-app.test.tsx`                                          | Platform detection and the per-plan dismiss key                                       |
| N5  | `e2e/portal-navbar.spec.ts`                                                | Banner dismiss across navigation, the rail's column, footer disclaimer on a real plan |

### What the landed suites assert

**Layout** — provider → rail → zoom → content → install composition; header props (logo, colours, `clientId`, visibility, `benefitHubs`); `--brand-color`/`--secondary-color`; the banner fetch URL, first-asset rule, dismiss, CTA link vs inert text (a `mailto:` survives), and the countdown reaching **Expired**; the back buttons appearing only with the `sessionStorage` flag (and consuming it); `html.dark` removed and restored; the comment surface for the landing page, a hub, the custom hub (plus `benefitPagePaths`) and `null` elsewhere; the footer receiving resolved names, colour and disclaimer; and the typography variables on `.portal-root`. The disclosure chain is asserted end to end: per-category → Home Page → advisor → category row → apply-all → universal, including the landing page's early return for any Home Page / Global / apply-all row and the case-insensitive de-duplication.

**Comments rail** — plain portal without the flag, with `?comments=1`, without a session, while the session loads, and below desktop; armed with all three; `--comments-rail-top` set and removed; `initialMode="on"`; the three button labels, `aria-pressed`, disabled state and right-offset.

**Comments zoom** — pass-through without a provider and while closed; `(width − 384) / width` with the `0.5…1` clamp; a zero-width viewport ignored; resize recompute; reset when closed; `--comments-inset: 0px` inside the subtree; wrapper height `offsetHeight × scale` with `100dvh`; observer observe/disconnect.

**Footer** — trust bar and quick links; placeholder resolution; blank lines → paragraphs, single newlines → `<br>`; the copyright appended exactly once (and not doubled); `disclosureNode` replacing the disclosures; the LPL fallback and built-in advisor name; the brand colour painted with the light-surface text rule.

**Banner helpers** — `https://` added only to a bare host, with `mailto:`/`tel:`/site paths untouched; countdown split into days/hours/minutes/seconds with rollover, `Date`/number/ISO input and `expired` at the boundary.

**Helpers** — Custom hub spellings, placeholders (`"Company / Plan Sponsor"`, `"Welcome to …"`), slugification and the legacy `wellness-programs` alias; typography CSS vars and the Classic fallback with apply/restore; the light-surface rule and its deliberate divergence from `bestTextColor`.

**Not-found** — copy, the plan-named CTA, the brand colour, the default identity, navigation to the hub, and the plan materials footer.

## Behaviour: the fixed header

- wrapped in a fixed container whose `right` is `var(--comments-inset, 0px)`, so it shortens to the rail's edge while the rail is open and is full width otherwise
- `PortalHeader` receives the plan logo, `brandColor`, `secondaryColor`, `clientId`, the raw `categoryPortalVisibility` and the plan's `benefitHubs`
- the measured height is applied to the content wrapper as `paddingTop`, so content never slides under the header
- measurement runs on mount, on `resize`, and once more after **300 ms** (font/image reflow)
- the measurement effect re-runs when the banner appears or is dismissed
- `--brand-color` and `--secondary-color` are set on the content wrapper

## Behaviour: the published banner

- fetches `GET /api/marketing/assets/public?clientId={id}&type=portal-notice` once per `clientId`
- ignores a failed fetch silently, and ignores `success: false` or an empty `data`
- renders **only the first** asset as the top banner, above the header
- uses the asset's `bgColor`, falling back to `#23919c`
- **countdown mode** (`data.noticeType === "countdown"` + `data.countdownTarget`): renders `d` `hh:mm:ss`, ticks every second, and shows **Expired** once the target passes; an unparseable target disables the ticker but leaves the headline
- headline falls back to `"Countdown"` in countdown mode and `"Announcement"` otherwise
- CTA: `ctaText` is rendered as a link when `data.portalCtaUrl` exists (prefixed with `https://` when scheme-less, `target="_blank"` + `rel="noopener noreferrer"`), otherwise as inert text
- the dismiss button (`aria-label="Dismiss banner"`) hides the banner **for this mount only**

## Behaviour: the back-to-dashboard overlay

- reads `sessionStorage.previousPage` on mount; the flag is consumed (`removeItem`) when present
- `previousPage` starts `true`, so the two floating buttons can paint once before the effect flips it to `false` — a visible flash worth knowing about
- when shown, it renders **← Go back to dashboard** (`window.location.href = "/dashboard"`) and **← Go back to editing** (`/edit-client/{id}`)

## Behaviour: footer disclosures

`getDisclosuresText()` resolves in this order, and the first match wins:

1. **Per-category** — `disclaimers.byCategory[Retirement | "Group Health" | "Group Life" | Other]`, only on a hub page
2. **Home Page** — on the landing page only, the first row whose `locations` include `Home Page` or `Global`, or that has `apply_all_benefits_categories`
3. **Advisor profile** — `clientData.advisorDisclaimer` (resolved server-side), org-only on non-hub pages
4. **Category-specific rows** — `!apply_all_benefits_categories` and a matching `locations` entry
5. **Apply-all rows** — `apply_all_benefits_categories === true`
6. **Universal text** — `resolveDefaultDisclosuresText(org, company, isCategoryHub)`, also used when `useDefaultDisclosures` is set or nothing else matched

Plus:

- if the plan has **no** `disclaimers`, the advisor's `advisorDisclaimer` is used, else the universal text
- a `disclaimers` **string** is parsed as JSON; on failure it is rendered verbatim; a non-string non-object yields the universal text
- every chosen text has `[Organization Name]` / `[Company Name]` resolved and `\n`, `\r\n`, `\r` normalized to real newlines
- combined texts are trimmed, de-duplicated case-insensitively, and joined with a blank line
- the legacy `disclosuresText` is returned when there are no rows at all
- the page label comes from the pathname: `retirement` → **Retirement Plan**, `health-insurance` → **Group Health / Dental / Vision**, `life-insurance` → **Group Life / Disability**, `wellness-programs` (or the custom hub slug) → **Wellness Programs**, anything else → **Benefits Hub / Client Website** (no category key)
- `organizationName` falls back `branding.organizationName` → `session.user.organizationName` → `companyName` → `""`
- footer colour: `disclaimers.footerBackground` → `secondary` / `custom` (`#rrggbb`) / primary `brandColor`
- [`Footer`](../../components/layout/footer.tsx:29) then re-resolves both placeholders, appends the PlanTelligence copyright line, and falls back to **Lighthouse Financial Advisors** / `[Company Name]` when names are missing

## Behaviour: light mode and typography

- on mount the layout removes `html.dark`, sets `colorScheme: "light"`, and on unmount restores exactly what it found
- `getTypographyCssVars(theme)` is spread onto the root, and `fontFamily: "var(--font-ui)"` is applied so UI chrome always uses Outfit while headlines keep their own utilities
- the root reserves `paddingRight: var(--comments-inset, 0px)`

## Behaviour: the comment surface

- `portalCommentsSurface({ pathname, planSlug: clientId, customHubSlug })` decides the surface; the layout registers `{ clientId, targetType, category }` (or `null`)
- `useCommentSurface` is called **unconditionally** so hook order never changes; the provider decides whether anything listens
- the custom hub slug is derived from the `benefitHubs` row whose category maps to **Other**, ignoring placeholder names (`"Company / Plan Sponsor"`, `"Welcome to …"`), then slugified

## Endpoints

```bash
GET /api/marketing/assets/public?clientId=…&type=portal-notice   # top banner
GET /api/clients/:id?forPortal=1                                 # plan + advisorDisclaimer + benefitHubs
GET /api/profile?forPortal=1&clientSlug=…                        # advisor signature (via the provider)
GET /api/clients/:id/comments                                    # only when the rail is armed
```

## Manual checklist

### 1. Header and navigation

- [ ] The header is fixed, spans the viewport, and content starts below it (no overlap, no gap).
- [ ] The plan logo, brand colours and typography theme match Edit Plan.
- [ ] Only hubs with a published benefit appear in the nav; hiding a hub removes its link on refresh.
- [ ] A published Custom hub shows its own name (not "Wellness Programs") and links to its slug.
- [ ] The mobile menu opens, lists the same links, and closes on navigation.
- [ ] Resizing the window keeps the content offset correct; rotating a phone does too.

### 2. Banner

- [ ] A published `portal-notice` asset shows above the header with its own colour.
- [ ] A countdown asset counts down, then reads **Expired**.
- [ ] A CTA renders as a link in a new tab; a bare domain becomes `https://…`.
- [ ] Dismissing hides it — and it returns after a reload (see gaps).

### 3. Back to the dashboard

- [ ] Arriving from the dashboard shows the two floating buttons; a direct visit does not.
- [ ] Both buttons navigate correctly.

### 4. Footer disclosures

- [ ] The landing page shows the **Home Page** disclaimer; each hub shows its own.
- [ ] With no per-category text, the advisor's profile disclaimer is used.
- [ ] Placeholders never render literally; line breaks survive.
- [ ] The footer colour follows primary/secondary/custom and the text stays readable.
- [ ] A plan with no disclaimer at all still shows the universal text.

### 5. Comments and pop-ups

- [ ] `?comments=on` shows the rail for an advisor on desktop; the header shortens, content is not reflowed.
- [ ] A participant (no session) never sees the rail.
- [ ] A published pop-up appears, can be dismissed, and respects its target pages.

## Known gaps

Observations from the implementation, worth either pinning or fixing:

**Fixed while writing these suites:** the CTA normaliser now lives in
[`lib/portal-banner.ts`](../../lib/portal-banner.ts:1). It used to prefix
`https://` to anything that was not `http(s)`, which mangled
`mailto:advice@acme.com` into `https://mailto:advice@acme.com` and a
same-site `/contact` into `https://contact`. A value with a scheme, a `/path`
or a `#anchor` now passes through; only a bare host gains `https://`. The
countdown arithmetic moved there too, so both rules are unit-tested instead of
only being reachable through the whole chrome.

1. **The banner's dismissal is not persisted.** `bannerDismissed` is component state, so the banner returns on every navigation and reload — unlike pop-ups, which persist dismissals in `sessionStorage`.
2. **The back-to-dashboard buttons can flash.** `previousPage` initialises to `true` and is corrected in an effect, so a direct visit renders both buttons for one paint.
3. **Category detection matches anywhere in the pathname.** `pathname.includes("/retirement")` means a plan whose slug is `/retirement-plan` (or `/my-health-insurance-hub`) is treated as that hub page — wrong footer disclaimer, wrong comment target.
4. **Sub-pages are treated as the landing page.** `/news-events` and `/my-benefits-team` return **Benefits Hub / Client Website**, so they inherit the Home Page disclaimer from step 2.
5. **Header height is measured, not observed.** `offsetHeight` on mount + `resize` + a 300 ms timer misses a banner that wraps to two lines on a narrow phone or a webfont that swaps in later, leaving a gap under the fixed header.
6. **Disclosure placeholders are resolved twice.** `getDisclosuresText()` resolves them, then [`Footer`](../../components/layout/footer.tsx:47) resolves them again and appends the copyright. Correct today, but two sources of truth for the same rule.
7. **Two different organization-name fallbacks.** The layout falls back to the plan's company name; `Footer` falls back to **Lighthouse Financial Advisors**. A plan with no advisor org therefore reads differently in the two places.
8. **`benefitPagePaths` covers only the custom hub.** Pop-ups scoped to benefit pages get the custom hub's path, but not `/retirement`, `/health-insurance`, `/life-insurance` or `/wellness-programs`.
9. **The layout is a client component with no metadata.** Titles/OG tags for portal routes have to come from elsewhere; nothing here sets them.
10. **The portal has no `<main>` landmark.** `{children}` render in a plain `div` inside `AnimatePresence`, wrapped in another `div`, so the page has `header`/`footer` landmarks but no main region.
11. **The comments flag is read once.** `PortalCommentsRail` reads `window.location.search` in a mount effect, so a client-side navigation that adds `?comments=on` does not arm the rail until a reload.
12. **The countdown interval never stops.** Once the target passes, every tick still calls `setCountdown` with a fresh object, so the banner re-renders once a second indefinitely.

## Future coverage

- extract the disclosure resolver (`getDisclosuresText`) and the path → category mapping into `lib/`, then unit-test them without rendering the chrome;
- add an axe-style role/label pass once an accessibility dependency is added — today the assertions are role/label based only;
- E2E: banner dismissal across navigation, the comments rail's column on a real advisor session, and pop-up targeting on a hub page.

## Related documentation

- [`docs/testing/portal-landing-tests.md`](portal-landing-tests.md) — the page this chrome wraps, and the portal test config/runner.
- [`docs/testing/edit-client-tests.md`](edit-client-tests.md) — where the header's branding, visibility and footer preference are authored.
- [`docs/testing/header-sidebar-tests.md`](header-sidebar-tests.md) — the dashboard's own header, for the shared logo/band conventions.
