# Portal "My Benefits Team" Testing

This document is the test specification for [`app/(portal)/[id]/my-benefits-team/page.tsx`](<../../app/(portal)/[id]/my-benefits-team/page.tsx:90>) — the portal page that lists the plan's people as cards.

The page is two things at once, and that is what the tests have to separate:

1. **A normaliser.** It accepts `keyContacts` in either stored shape (a bare array, or the `{ contacts, displayStyle, mobileDisplayStyle, … }` envelope), drops hidden contacts, drops contacts whose hub is hidden, synthesises names, resolves the advisor's own card against their _current_ profile, and marks the primary card.
2. **A layout switcher.** Four desktop layouts (`displayStyle` 0 / 2 / 3 / 4) and three mobile ones (0 / 1 / 2), all rendered through the one shared [`BenefitContactCard`](../../components/pages/client-portal/sections/benefit-contact-card.tsx:1) the category pages also use.

## Summary

- **Unit tests:** 162 across 12 suites (`pnpm test:portal-team`), all passing
- **E2E:** 3, env-gated on `E2E_BASE_URL` + `E2E_PORTAL_SLUG` (`e2e/portal-team.spec.ts`)
- **Runner:** `pnpm test:portal-team` / `:watch` / `:coverage` — [`vitest.portal-team.config.mts`](../../vitest.portal-team.config.mts:1) driven by [`scripts/tests/run-portal-team-tests.mjs`](../../scripts/tests/run-portal-team-tests.mjs:1)
- Four card defects were found and fixed while writing the suites (see [Fixed while writing these suites](#fixed-while-writing-these-suites))

## Commands

```bash
pnpm test:portal-team             # all 162 unit tests in the scoped config
pnpm test:portal-team:watch
pnpm test:portal-team:coverage
E2E_BASE_URL=… E2E_PORTAL_SLUG=… pnpm exec playwright test e2e/portal-team.spec.ts
```

| Piece      | Where                                                                                                  | Owns                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Page       | [`my-benefits-team/page.tsx`](<../../app/(portal)/[id]/my-benefits-team/page.tsx:90>)                  | Contact selection, identity resolution, primary marking, layout choice                    |
| Card       | [`benefit-contact-card.tsx`](../../components/pages/client-portal/sections/benefit-contact-card.tsx:1) | The card itself, shared with the category pages (`placement="team"` vs `"category"`)      |
| Visibility | [`portal-category-visibility.ts`](../../lib/portal-category-visibility.ts:267)                         | `isContactVisibleInPortal`, `getContactCategories` (already covered in the landing suite) |
| Identity   | [`resolve-contact-company-name.ts`](../../lib/resolve-contact-company-name.ts:1)                       | Whose company name a card shows, and whether the row is the viewer's own                  |
| Profile    | [`fetch-profile.ts`](../../lib/fetch-profile.ts:1)                                                     | Single-flight profile read with a cache the Settings saves invalidate                     |

## What the page computes

**Contacts**

- `keyContacts` as an array → used directly; as an object → `contacts` (or the legacy `Contacts`) plus `displayStyle`, `mobileDisplayStyle`, `cardBackgroundColor`, `logoScale`
- both shapes drop `showOnPortal === false`
- every remaining contact is filtered again by `isContactVisibleInPortal(getContactCategories(contact), visibility)`
- visibility comes from `clientData.categoryPortalVisibility`, then `employeePortalPreview.categoryPortalVisibility`, normalised to the four canonical keys
- each surviving contact gets: `planId` (from `clientData.id`), a `name` synthesised from `firstName`/`lastName` when missing, `cardBackgroundColor`, and `logoScale` (contact → envelope → `1`)
- the first visible contact is marked `isPrimary: true` and the rest `false`

**Identity**

- `matchEmails` = the portal-resolved advisor email, the session email, the session organization email and the two from `/api/profile`, all trimmed, lower-cased and de-duplicated
- a **Company / Plan Sponsor** card always shows the **plan's** company name and logo, even when the row is the advisor's own
- every other card resolves its company name with `resolveContactCompanyName(contact, matchEmails, ownOrgName)`, where `ownOrgName` prefers the portal advisor profile over the session snapshot
- the viewer's **own** card takes the _current_ organization logo from `/api/profile` (the stored row was seeded with a copy)
- the viewer's own card falls back to their current designations only when the stored row has **none** — clearing the pills in the wizard is not undone
- `/api/profile` is only fetched when the viewer is signed in (there are session emails), keyed on the joined emails, and cancelled on unmount

**Layout**

| `displayStyle` | Desktop                                                                                   |
| -------------- | ----------------------------------------------------------------------------------------- |
| `null` / `0`   | `DefaultLayout` — a primary card (white background override `#ffffffea`) then a 4-up grid |
| `2`            | `Layout2` — compact cards in a 2-column grid                                              |
| `3`            | `Layout3` — compact cards in a 2→3→4 column grid                                          |
| `4`            | `Layout4` — 2 cards on top, the rest in a 3-up row                                        |

| `mobileDisplayStyle` | Mobile (`md:hidden`)                               |
| -------------------- | -------------------------------------------------- |
| `0` (default)        | stacked, one per row                               |
| `1`                  | 2-column grid                                      |
| `2`                  | first card full-width, the rest in a 2-column grid |

`normalizeDisplayStyle` maps `null`/`""`/non-numeric to "no preference", keeps `2`/`3`/`4`, and folds anything else numeric (including legacy `1`) to `0`. `normalizeMobileDisplayStyle` keeps `1`/`2` and folds everything else to `0`.

Colours default to `#0D315F` / `#C89B5B`, and `appointmentLink` defaults to a hard-coded OnceHub URL.

## Landed inventory

| Suite                                                                                                                                  | Tests | Focus                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------- | ----: | ------------------------------------------------------------------------------ |
| [`lib/__tests__/portal-primary-contact.test.ts`](../../lib/__tests__/portal-primary-contact.test.ts:1)                                 |    12 | Which contact the portal promotes to "primary" (the ladder the page ignores)   |
| [`lib/__tests__/benefit-contact-categories.test.ts`](../../lib/__tests__/benefit-contact-categories.test.ts:1)                         |     9 | `canonicalContactCategory` and `mergeContactCategoryLists`                     |
| [`lib/__tests__/resolve-contact-company-name.test.ts`](../../lib/__tests__/resolve-contact-company-name.test.ts:1)                     |     8 | Whose company name wins, and the own-row email match                           |
| [`lib/__tests__/contact-form-link.test.ts`](../../lib/__tests__/contact-form-link.test.ts:1)                                           |     8 | The first-party `/contact` CTA URL (topics, avatar, company, plan)             |
| [`lib/__tests__/fetch-profile.test.ts`](../../lib/__tests__/fetch-profile.test.ts:1)                                                   |     6 | Single-flight, 60 s cache, `invalidateProfileCache`                            |
| [`config/onboarding/__tests__/designations.test.ts`](../../config/onboarding/__tests__/designations.test.ts:1)                         |    22 | Designation chips: ® / ™ rules, free-text passthrough, title → group routing |
| [`.../sections/__tests__/benefit-contact-card.test.tsx`](../../components/pages/client-portal/sections/benefit-contact-card.tsx:1)     |    11 | The shared entry point: `asPrimary`, `compact`, team vs category placement     |
| [`.../my-benefits-team/__tests__/small-vertical-card.test.tsx`](../../components/pages/my-benefits-team/small-vertical-card.tsx:1)     |    32 | The compact card, its two render paths, preview placeholders                   |
| [`.../my-benefits-team/__tests__/primary-contact-card.test.tsx`](../../components/pages/my-benefits-team/primary-contact-card.tsx:1)   |    22 | The wide primary card                                                          |
| [`.../my-benefits-team/__tests__/large-horizontal-card.test.tsx`](../../components/pages/my-benefits-team/large-horizontal-card.tsx:1) |    19 | The one-contact-per-row card                                                   |
| [`.../my-benefits-team/__tests__/contact-avatar.test.tsx`](../../components/pages/my-benefits-team/contact-avatar.tsx:1)               |     7 | Circular slot: headshot / `teamImage` / company logo / support icon            |
| [`.../my-benefits-team/__tests__/primary-visual.test.tsx`](../../components/pages/my-benefits-team/primary-visual.tsx:1)               |     6 | Large circular slot on the primary card                                        |
| [`e2e/portal-team.spec.ts`](../../e2e/portal-team.spec.ts:1)                                                                           |     3 | Real plan: heading, cards, and only well-formed `tel:`/`mailto:` links         |

### Not yet written

The page-level suites below remain the specification for future work; everything
they cover is still untested at the page level (the card layer is covered).

| #   | Suite                                                        | Tests | Focus                                                                        |
| --- | ------------------------------------------------------------ | ----: | ---------------------------------------------------------------------------- |
| T1  | `app/(portal)/[id]/my-benefits-team/__tests__/page.test.tsx` |   ~18 | Contact selection, visibility, name synthesis, primary marking, layout props |
| T2  | `.../page.identity.test.tsx`                                 |   ~12 | Own-card org name/logo/designations, plan-sponsor branch, `matchEmails`      |
| T3  | `.../page.layouts.test.tsx`                                  |   ~12 | The seven layout branches, defensive filters, defaults                       |
| T4  | `.../page.lifecycle.test.tsx`                                |    ~8 | Mount refetch, profile fetch gating/cancellation, skeleton and null branches |

## T1 — Selection and normalisation

`BenefitContactCard` is stubbed to a JSON dump, so the assertions are about what the page decided.

- **Shapes**
  - an array payload is used as-is, minus `showOnPortal: false`
  - the `{ contacts }` envelope is unwrapped, and the legacy `{ Contacts }` key still works
  - an unknown payload shape renders no cards rather than throwing
- **Visibility**
  - a contact whose hub is hidden is dropped; a non-hub contact survives
  - every contact survives when all four hubs are hidden (the `isContactVisibleInPortal` rule)
  - the `employeePortalPreview` fallback is used when the top-level visibility is missing
- **Enrichment**
  - `planId` is copied from `clientData.id`
  - `name` is built from `firstName`/`lastName` when absent, and an existing `name` is kept
  - `cardBackgroundColor` is per contact; `logoScale` is contact → envelope → `1`
- **Primary**
  - the first visible contact is `isPrimary: true` and the others `false`
  - a hidden first contact promotes the next one

## T2 — Identity resolution

- **Plan sponsor cards** show the plan's company name and logo even when the row's own company differs (and even when it is the advisor's row)
- **Other cards** show their own company name; the advisor's card shows the organization name from the portal profile, falling back to the live profile value, then the session snapshot
- **The viewer's own card** takes the live organization logo; a row with a stored logo keeps it when the viewer is someone else
- **Designations**: a stored row keeps its own pills; an empty row falls back to the live profile designations; an empty profile leaves the row empty
- **Matching** uses all resolved emails, so a seeded row that stores the organization address still matches
- **Company logo fallback**: a non-sponsor row with only `companyLogo` also sets `logo`

## T3 — Layouts

- each `displayStyle` renders its own layout, driven by a stubbed `BenefitContactCard` count and `isPrimary` flags
- `null` and `0` both render the default layout
- the default layout gives the primary card the `#ffffffea` background override
- `Layout4` puts the primary and the next contact in the top row and the remainder below
- the mobile tree renders for `0`, `1` and `2`, with `2` splitting the first card out of the grid
- every desktop layout re-filters by visibility (defensive)
- the brand/accent defaults and the appointment-link default are applied when the plan has none

## T4 — Lifecycle

- `refetch()` is called once on mount and again only when the provider hands over a new callback
- `/api/profile` is **not** fetched for an anonymous viewer
- it is fetched for a signed-in viewer, and its logo/org name/designations/emails are applied
- a rejected profile fetch leaves the page unchanged (no crash)
- the fetch is cancelled on unmount
- `!clientData && loading` renders the skeleton; `!clientData && !loading` renders nothing

## What the landed suites pin

- **`BenefitContactCard`**: `asPrimary` → `PrimaryContactCard`, otherwise `SmallVerticalCard`; `compact` wins over `placement`, and `placement="category"` is compact by default; the benefit-category tag is produced only for `placement="team"`, with `categoryLabel` joining the list and `categoryList` carried for the tooltip.
- **`SmallVerticalCard`**: name from `firstName`/`lastName` then stored `name`; team cards use `displayName`, drop the role line and designation chips, and show the support icon instead of a person avatar; designations render as acronyms with blanks filtered; phone/email order follows `contactInfoOrder` (default phone first); phone display keeps the extension while the `tel:` link drops it; CTA construction for `calendar`/`phone`/`email`/`url` and the legacy display flags; the fallback "Schedule Appt." button; the inert contact-form CTA in previews; logo scale via `transform` in the animated path and via the box height in the no-animation path; background `contact → baseline → #ffffff`; `[First & Last Name]`/`[Job Title]`/`[Company / Organization]`/`[Email]`/`[Phone]`/`[Upload Company Logo]`/`[Headshot]` placeholders.
- **`PrimaryContactCard`**: `name` (or `displayName` for a support line), title, company, designation chips, email/phone links honouring the display flags, support hours, the CTA labels (`Schedule Appt.` fallback, `Call Now`, `Send Email`, `Contact`, legacy `Contact`), background `contact → baseline → secondary`, and the logo height `48px × contact.logoScale` capped at `60px`.
- **`LargeHorizontalCard`**: the same identity/contact/CTA/background rules, with its logo slot at `120px × (contact.logoScale ?? baselineLogoScale ?? 1)`.
- **`ContactAvatar` / `PrimaryVisual`**: person → headshot (`ContactAvatar` also accepts the legacy `teamImage`), otherwise initials; support line → company logo, otherwise the chosen support icon. `PrimaryVisual` never reads `teamImage`.
- **`designationAcronym` / `designationLabel` / `resolveDesignationId`**: known ids and legacy labels map both ways; typed acronyms with or without the mark resolve in any case; CFA, CIPM, GBA, RPA and QPA keep no symbol; the HRCI international credentials keep ™; unknown free text passes through unchanged and never gains a mark; `getRelevantDesignations` routes recordkeeper/TPA/compliance titles first, then HR, then benefits, then advisor/planner/wealth, returns nothing for relationship/client-success roles, and falls back to the whole dictionary.
- **`buildContactFormHref`**: carries `to`, `company`, `name`, `title`, `avatar`, `logo`, `category` and `plan`; skips `data:` images; encodes the topic list; an explicit empty `topics=` is preserved while an absent one is omitted.
- **`canonicalContactCategory` / `mergeContactCategoryLists`**: `"Other"` → `"Other Benefits"`, blank → `""`, unknown values trimmed and kept; merging unions case-insensitively in canonical order, unknown categories last, dropping blanks.
- **`resolveContactCompanyName`**: the viewer's own row (matched on any supplied email, trimmed and lower-cased) returns the organization name, falling back to the contact's own `companyName` when that is blank; otherwise the contact's `companyName` trimmed. It returns a string — `""` when there is nothing — and knows nothing about plan sponsors (the page branches on that first). `isLoggedInUserContact` is false for a row with no email.
- **`resolvePortalPrimaryContact`**: reads `readPortalContacts` shapes (bare array, `contacts`, legacy `Contacts`), then applies the ladder _category-primary → any category match → plan-level primary → first visible contact_, excluding `showOnPortal === false`. This is a different rule from the page's "first visible contact", and the suite pins that difference.
- **`fetchProfileOnce`**: concurrent callers share one in-flight request; a resolved profile is served from memory for 60 s; a `!ok` response or a rejection resolves `null` and caches nothing (so the next call retries); `invalidateProfileCache` drops both this cache and the header's slim cache so the next call hits the network.

## Fixed while writing these suites

The card suites exposed defects that would have shipped to participants. These are now fixed and covered by the assertions above:

1. **Doubled `tel:` scheme.** [`getBasePhoneForDialing`](../../lib/phone-utils.ts:59) already returns `tel:+1…`, but [`PrimaryContactCard`](../../components/pages/my-benefits-team/primary-contact-card.tsx:377) wrapped it in another `tel:` for the phone link, and all three cards did the same for the "Call Now" CTA — producing `tel:tel:+1555…`, which dials nothing. The phone link and every "Call Now" CTA now use the helper's value unchanged.
2. **The legacy "Schedule Appt." fallback never rendered.** All three cards computed `hasAnyButton` _before_ pushing the fallback button, then gated the whole button list on that stale flag. The flag is now computed after the fallback, so a contact with no CTA configuration gets the plan's appointment link as documented.
3. **The live `SmallVerticalCard` dropped designation chips and the logo placeholder.** Both existed only in the `disableAnimation` branch, so the portal (animated) cards showed neither the advisor's credentials nor the wizard's `[Upload Company Logo]` hint. Both blocks were added to the animated branch.
4. **`PrimaryContactCard` drew dead buttons.** It rendered its "Schedule Appointment" fallback even when `enableContactButton` was explicitly `false`, and rendered a CTA whose URL could not be built (e.g. "Call Now" with no number). It now renders only buttons with a URL and only falls back when no CTA config exists at all.

## Endpoints

```bash
GET /api/clients/:id?forPortal=1     # plan + keyContacts (via the portal provider)
GET /api/profile?forPortal=1&clientSlug=…   # advisor signature (provider)
GET /api/profile                     # current user's logo/org/designations (this page, signed in)
```

## Manual checklist

### 1. Content

- [ ] Every contact the plan shows appears once, with the right name, title and designations.
- [ ] A contact with **Show on portal** off is absent.
- [ ] A contact in a hidden hub is absent; hiding every hub keeps them all.
- [ ] The first card is the primary one and reads differently from the rest.

### 2. Identity

- [ ] The advisor's own card shows their **current** organization name and logo after a Settings → Branding change.
- [ ] A Company / Plan Sponsor card shows the plan's company, not the advisor's.
- [ ] Clearing the designations in the wizard keeps them cleared on the portal.

### 3. Layouts

- [ ] Each of the four desktop layouts renders as chosen in the wizard.
- [ ] Each of the three mobile layouts renders below `md`, and nothing double-renders at the breakpoint.
- [ ] Fewer contacts than the layout expects leave no empty slots that look broken.

### 4. CTAs

- [ ] Email opens the mail client; the phone row dials.
- [ ] "Schedule" uses the plan's appointment link, or the default when unset.
- [ ] The contact-form CTA resolves this plan's topics.

## Known gaps

Observations from the implementation, worth pinning or fixing:

1. **Both early-return branches are unreachable in the app.** [`ClientPortalProvider`](../../contexts/client-portal-context.tsx:213) renders its own skeleton while loading and **Page Not Found** on error, so `!clientData && loading` (this page's skeleton) and `!clientData && !loading` (`null`) can only happen in a test or a provider-less render.
2. **The page mutates its own derived contacts during render.** It assigns `primaryContact.isPrimary = true` and `rest.forEach(c => c.isPrimary = false)` on objects inside a memoised array — a render-phase mutation that is visible to anything holding those objects.
3. **The main memo recomputes on every render.** `visibleContacts` depends on `contacts`, which is rebuilt on each render from `clientData.keyContacts`, so nothing is actually memoised.
4. **`refetch()` runs on mount, on top of the provider's own fetch.** Opening the page issues a second plan request immediately; the provider's initial load already had the data.
5. **The mobile layout does not re-filter by visibility**, while all four desktop layouts do — the two paths differ in their defensive behaviour (harmless today because the page filters first).
6. **The appointment link default is a hard-coded OnceHub URL** (`WFAParticipantInquiry`), so every plan without its own link sends participants to another firm's scheduling page.
7. **`displayStyle: null` and `0` are indistinguishable** in the output, so an unset layout cannot be reported or migrated differently from the default.
8. **Only session emails gate the profile fetch.** An anonymous viewer never gets the live org name/logo — correct for their own card (there is none), but it also means the org-name fallback chain stops at the portal advisor profile.
9. **`SmallVerticalCard`'s animated branch ignores `displayEmail`/`displayPhone`.** The `disableAnimation` branch checks both flags; the live portal branch renders any stored email and phone. Pinned as a known divergence by the suite (one test asserts the leak explicitly); the compact/wizard card hides them correctly.
10. **`PrimaryContactCard` declares a `logoScale` prop it never destructures.** Only `contact.logoScale` sizes the logo, so a caller passing `logoScale` changes nothing. Pinned by a test that passes `logoScale={4}` and still expects `48px × contact.logoScale`.
11. **`ContactAvatar` and `PrimaryVisual` disagree on `teamImage`.** The compact avatar shows a legacy team image; the primary card's large visual does not, so a contact migrated with only `teamImage` shows their photo in one layout and initials in another. Pinned as-is.
12. **Two different definitions of "primary".** The page marks `visibleContacts[0]` as primary, while [`resolvePortalPrimaryContact`](../../lib/portal-primary-contact.ts:46) (used by the landing page and hubs) applies a category-primary → category → plan-primary → first-visible ladder. The same plan can name two different people as its "main" contact, and only the ladder-based one respects the advisor's per-category choices.
13. **The three cards duplicate their CTA builders, labels and colour maths.** The suites pin the current labels (`Schedule Appt.`, `Call Now`, `Send Email`, `Contact`, `Visit Website` / `Visit Support Site`), so any divergence between variants is now visible but still maintained in three places.
14. **Images, avatars and the category badge are stubbed in the card suites.** R2 signing/proxying (`BrandingImage`, `Headshot`, `useBrandingImageUrl`) and the `ContactCategoryBadge` tooltip are covered — if at all — by their own suites, not by these.

## Future coverage

- extract the selection/identity block into a `useTeamContacts(clientData, session, profile)` hook and test it directly, which would collapse T1–T3 into one suite;
- a visual/DOM suite for the four desktop layouts once the card design review settles;
- E2E: change the card layout in the wizard, then confirm the portal renders the same arrangement.

## Related documentation

- [`docs/testing/portal-navbar-tests.md`](portal-navbar-tests.md) — the chrome this page renders inside.
- [`docs/testing/portal-benefit-hub-tests.md`](portal-benefit-hub-tests.md) — the category pages that share `BenefitContactCard`.
- [`docs/testing/portal-landing-tests.md`](portal-landing-tests.md) — where contact visibility is first applied.
