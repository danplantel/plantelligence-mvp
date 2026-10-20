# Browse Benefits Testing

This document is the test inventory for [`app/(dashboard)/benefits/page.tsx`](<../../app/(dashboard)/benefits/page.tsx:116>), the Server Component that resolves the organization strip and renders [`BenefitsListPage`](../../components/pages/benefits/benefits-list.tsx:230).

It covers the server-side organization-category resolution, the client plan picker and its state ladder, the per-plan benefit rows, publish/hide toggles, drafts and completeness, the collaborator variants, and the `/api/benefits` contract the page depends on.

## Summary

- **Dedicated unit tests:** 174 passing in 13 files.
- **Indirect unit coverage:** 3 additional suites touch adjacent behaviour (service-category mapping, `/benefits` middleware redirect, Benefits nav gating).
- **Dedicated E2E:** 6 Playwright tests in [`e2e/benefits.spec.ts`](../../e2e/benefits.spec.ts:1), env-gated.
- **Runner:** Vitest + React Testing Library + jsdom; Playwright for E2E.

The page changed shape in a way the suites pin: the "Your organization offers" strip is resolved **on the server** ([`getOrgServiceCategories`](<../../app/(dashboard)/benefits/page.tsx:77>)) so its chips are part of the first paint, while everything below it remains a client component with its own SWR loading ladder. The inventory is split into server-page, client-page, strip, picker, API, visibility-write, assignment-read, and pure-helper suites.

## Running these tests

There is no scoped Benefits script yet. Run the new suites directly:

```bash
pnpm exec vitest run "app/(dashboard)/benefits/__tests__"
pnpm exec vitest run "components/pages/benefits/__tests__"
pnpm exec vitest run "components/plan-selector/__tests__"
pnpm exec vitest run "app/api/benefits/__tests__"
pnpm exec vitest run "app/api/clients/[id]/__tests__/route.visibility.test.ts"
pnpm exec vitest run "app/api/teammates/plan-assignments/__tests__"
pnpm exec vitest run lib/__tests__/service-categories.test.ts lib/__tests__/plan-selector-storage.test.ts lib/__tests__/active-client-status.test.ts lib/__tests__/benefit-category-slug.test.ts lib/__tests__/benefit-draft.test.ts lib/__tests__/portal-surface.test.ts
```

All tests:

```bash
pnpm test                 # whole unit suite
pnpm test:watch           # unit tests in watch mode
pnpm test:coverage        # unit tests + V8 coverage
pnpm test:e2e:install     # install Chromium once
pnpm test:e2e             # Playwright E2E
pnpm test:e2e:ui          # Playwright UI mode
```

The Benefits E2E spec skips itself unless an app and credentials are present:

```bash
E2E_BASE_URL=http://localhost:3000 \
E2E_EMAIL=advisor@example.com \
E2E_PASSWORD=... \
E2E_PLAN_NAME="Acme Corp" \
E2E_SECOND_PLAN_NAME="Beta LLC" \
pnpm test:e2e e2e/benefits.spec.ts
```

`E2E_PLAN_NAME` gates the selected-plan journeys, `E2E_SECOND_PLAN_NAME` gates the no-refetch journey, `E2E_COLLABORATOR_EMAIL` / `E2E_COLLABORATOR_PASSWORD` gate the collaborator journey, and `E2E_BENEFIT_TOGGLE=1` gates the mutating publish/hide journey.

## Test inventory

| #   | Suite                                                                 |      Tests | Status      | Focus                                                                                                              |
| --- | --------------------------------------------------------------------- | ---------: | ----------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | `app/(dashboard)/benefits/__tests__/page.test.tsx`                    |         15 | Implemented | Session lookup, own-category precedence, wizard-session fallback, organization-owner fallback, failure degradation |
| 2   | `components/pages/benefits/__tests__/benefits-list.test.tsx`          |         51 | Implemented | SWR keys, plan selection, state ladder, rows, drafts, toggles, roles, assignees, empty/failure states              |
| 3   | `components/pages/benefits/__tests__/org-service-categories.test.tsx` |          5 | Implemented | Chips, empty copy, Settings edit/add affordance, server-fed rendering                                              |
| 4   | `components/plan-selector/__tests__/plan-search-bar.test.tsx`         |         14 | Implemented | Active-only filtering, Draft retention for collaborators, recents, search, keyboard, portal link                   |
| 5   | `app/api/benefits/__tests__/route.test.ts`                            |         20 | Implemented | Auth, accessible-plan scoping, category scoping, row shape, visibility, completeness, 500                          |
| 6   | `app/api/clients/[id]/__tests__/route.visibility.test.ts`             |          8 | Implemented | Full-map visibility write, auth gate, normalization, omission preserves stored map                                 |
| 7   | `app/api/teammates/plan-assignments/__tests__/route.test.ts`          |          7 | Implemented | Auth, required planId, view refusal, real-id lookup after slug entry                                               |
| 8   | `lib/__tests__/service-categories.test.ts`                            |          9 | Implemented | `normalizePrimaryServiceCategories`, Step 2 ↔ category mapping, canonical ordering                                |
| 9   | `lib/__tests__/plan-selector-storage.test.ts`                         |          7 | Implemented | Per-module sticky keys, MRU, corrupt storage, clear-on-logout                                                      |
| 10  | `lib/__tests__/active-client-status.test.ts`                          |          9 | Implemented | Active/active casing, blank legacy status, Draft/Archived                                                          |
| 11  | `lib/__tests__/benefit-category-slug.test.ts`                         |         10 | Implemented | Category ↔ slug round-trips, Custom alias, fallback, encoded input                                                |
| 12  | `lib/__tests__/benefit-draft.test.ts`                                 |          7 | Implemented | Category key normalization, Custom→API mapping, persisted draft parsing                                            |
| 13  | `lib/__tests__/portal-surface.test.ts`                                |         12 | Implemented | Comments-rail flag, portal surface mapping, Custom hub segment                                                     |
| 14  | `lib/__tests__/onboarding-wizard-store.test.ts`                       | (existing) | Indirect    | Uses `step2ServicesToCategories` in the Step 2 save path                                                           |
| 15  | `lib/__tests__/middleware.test.ts`                                    | (existing) | Indirect    | Unauthenticated `/benefits?…` redirects to `/signin` with `callbackUrl`                                            |
| 16  | `components/layout/__tests__/sidebar.test.tsx`                        | (existing) | Indirect    | Benefits nav visibility for owners, teammates and collaborators                                                    |
| 17  | `e2e/benefits.spec.ts`                                                |          6 | Implemented | Shell, plan switch without refetch, reload persistence, View, opt-in toggle, collaborator chrome                   |

## Unit test inventory

### `app/(dashboard)/benefits/__tests__/page.test.tsx`

Server Component test: mock `getServerSession`, `prisma`, and `BenefitsListPage`, then assert the props the page passes down. `serviceCategoriesForUser` and `getOrgServiceCategories` are module-private, so they are exercised through [`BenefitsPage`](<../../app/(dashboard)/benefits/page.tsx:116>).

**Session and first paint**

- renders `BenefitsListPage` with `orgCategories` resolved before render
- passes `[]` when there is no session, without querying Prisma
- passes `[]` when the `User` row no longer exists
- exports `dynamic = "force-dynamic"` so the session-scoped read is never statically baked

**Own categories win**

- returns `User.primaryServiceCategories` when present
- trims, de-duplicates, and orders categories canonically (`Retirement`, `Group Health`, `Group Life`, `Other`, then unknown labels)
- keeps an unknown-but-stored label instead of dropping it
- never reads the latest wizard session when the stored column is non-empty
- never reads the organization or owner when the viewer already has categories

**Wizard-session fallback**

- falls back to the **latest** wizard session's Step 2 `services` when the column is empty
- maps Step 2 enum values to labels (`retirement` → `Retirement`, `supplemental_health` → `Other`)
- drops unknown Step 2 values that have no category label
- passes `[]` when the fallback session has no services

**Invited-teammate fallback**

- reads `User.organizationId` for a viewer with no categories
- reads the organization's `ownerUserId`
- returns the owner's stored categories when the viewer is not the owner
- returns the owner's wizard-session categories when the owner's column is empty
- does **not** re-read the same row when `ownerUserId === userId`
- returns `[]` when the viewer has no `organizationId`
- returns `[]` when the organization has no `ownerUserId`
- does **not** call `resolveOrganizationId` (rendering the strip must not create an organization)

**Failure degradation**

- catches a Prisma rejection, logs `[benefits] org service categories`, and passes `[]`
- still renders the page when the organization lookup throws

### `components/pages/benefits/__tests__/benefits-list.test.tsx`

Mock the boundary (`next/navigation`, `sonner`, `useViewerAccess`, `usePageTitleContext`, `plan-selector-storage`, `benefits-wizard-store`, the browsers' storage) and stub `PlanSearchBar` / `OrgServiceCategories` where the assertion is about the page, not the picker.

**Reads**

- requests `/api/benefits` with a key that does not include the selected plan
- configures the benefits read with `dedupingInterval: 0`, `revalidateOnMount: true`, `revalidateOnFocus: false`
- requests the picker list from `/api/clients?status=all&limit=500&sortColumn=companyName&sortDirection=asc&summary=1`
- configures the picker read with `keepPreviousData`, a 60s dedupe window, and no focus revalidation
- does not request plan assignments until a plan is selected
- sets the page title to **Benefits**

**Plan selection**

- restores the sticky plan from `getLastPlanId("benefits")` when it is selectable
- falls back to the first selectable plan in the shared MRU when the sticky plan is gone
- falls back to the first selectable plan when neither memory source matches
- persists a new selection with `persistPlanSelection("benefits", id)`
- shows only Active plans for an advisor
- shows every assigned plan (Draft included) for a Collaborator and passes `activeOnly={false}`

**State ladder**

- renders the plan-card skeleton while the plan list is still loading
- renders the skeleton while a plan is known but auto-selection has not run yet (no empty-state flash)
- renders **Couldn't load your plans** with a working **Try again** when the plan list fails and nothing is cached
- keeps the previous plan list usable when a later plan-list revalidation fails (`keepPreviousData`)
- renders **No plans yet. Create a plan first, then add its benefits.** only after the plan list has settled
- renders the collaborator no-plans copy instead of the advisor's Create Plan prompt
- renders **No active plans** with **View Plans** when every plan is Draft/Archived
- renders **Couldn't load this plan's benefits** with **Try again** when `/api/benefits` fails after the plan list succeeded
- never shows the benefits failure card in place of a plan list that failed first
- renders the plan card only when both reads have settled and a plan is selected

**Plan card and rows**

- titles the card with the selected plan's `planName`, falling back to **Plan Benefits**
- shows the owner subtitle "Publish, hide, and edit this plan's benefit pages."
- shows the collaborator subtitle "The benefit sections you have access to on this plan."
- renders only rows whose `planId` matches the selected plan
- renders **No benefits found for this plan.** when the selected plan has no rows
- renders the benefit's own `label` as the headline, not the wizard's intro `title`
- keeps a genuinely custom title as a secondary note
- suppresses a `Welcome to …` title and a title equal to the label/category
- renders **Custom** for the plan-sponsor hub when no custom name is saved
- renders the saved custom hub name as the headline
- renders a partner logo when present and a dash placeholder when absent
- renders **Complete** in green and **Incomplete** in amber when the row exists
- renders one amber chip per `missingInfo` entry, and none for a complete row
- renders **Assigned to …** with overlapping headshots from plan assignments plus the category Key Contact
- de-duplicates assignees by assignment id
- includes an “all categories” assignment on every card
- excludes a mirrored Key Contact assignment (`state: "contact"`) from the assignee list
- caps overlapping headshots at three and renders a `+N` overflow chip
- appends `· N field(s) missing` only when the row exists, is incomplete, and has assignees

**Row actions and publish state**

- for an existing benefit, renders **Published**/**Hidden** plus a Switch for an owner
- for an existing benefit viewed by a Collaborator, renders **Published**/**Hidden** as text with no Switch
- opens `/edit-benefit/{planId}/{categorySlug}` from **View**
- opens the portal deep link from **Open Portal** for a Collaborator, using the plan slug or id, the category segment, and the Comments rail
- omits **Open Portal** when the benefit does not exist
- renders **Not created** and an **Add** button for a missing benefit an owner may create
- renders **Draft** and a **Continue** button when a persisted draft matches this plan + category
- recognizes the wizard's `Custom` category as the API's `Company / Plan Sponsor` when matching a draft
- does not label a row **Draft** when a published row already exists
- hides **Add** for a Collaborator
- hides **Add** when `can("create_benefits", "edit")` is false

**Toggle**

- optimistically flips the row before the requests resolve
- PUTs `categoryPortalVisibility` to `/api/clients/{planId}` and `{ isEnabled }` to `/api/clients/{planId}/benefits/{category}`
- preserves the other visibility keys when writing the toggled key
- shows the spinner and disables the Switch while the pair is in flight
- toasts `{label} published` / `{label} hidden` on success and revalidates `/api/benefits`
- toasts **Failed to save visibility** and revalidates when the client PUT fails
- keeps the request “successful” when only the benefit `isEnabled` PUT fails (current behaviour: warning only)
- clears the in-flight flag after success and after failure

**Cross-page updates**

- subscribes to the `benefits-updated` window event and calls `mutate`
- removes the listener on unmount
- revalidates when the Event fires (a benefit renamed in another tab)

### `components/pages/benefits/__tests__/org-service-categories.test.tsx`

- renders the **Your organization offers** label and one chip per category
- renders **No service categories selected yet.** for an empty array
- renders **Edit in Settings** when categories exist and **Add in Settings** when empty
- navigates to `/settings` from either button
- renders categories passed in without fetching (no SWR/`fetch` call)

### `app/api/benefits/__tests__/route.test.ts`

- returns `401` with no session and runs no queries
- scopes `client.findMany` to `listAccessiblePlanIds(userId)`
- returns `{ success: true, benefits: [] }` when the caller has no accessible plans
- applies category scoping from `listOwnCategoryScopedPlans`; an unrestricted caller gets all four rows
- returns exactly four rows per plan: Retirement, Group Health, Group Life, Company / Plan Sponsor
- normalizes `categoryPortalVisibility` when it is `null`
- computes `isEnabled` as row exists **and** `isEnabled !== false` **and** visibility key is not `false`
- reports `isEnabled: false` for a category with no Benefit row
- reports `exists: false` and the default label title for a missing row
- selects only the completeness fields from documents and ignores soft-archived rows
- never selects `employeePortalPreview` (the base64 legacy mirror) from `Client`
- resolves `keyContact` from the plan's authored contacts for the matching category, including display-name and headshot handling
- returns `null` `keyContact` for the Custom hub/unknown categories
- maps a missing `companyName` to **Untitled plan**
- returns `500` when a query fails

### `lib/__tests__/service-categories.test.ts`

- `normalizePrimaryServiceCategories` returns `[]` for non-arrays and empty values
- trims and de-duplicates repeated labels
- orders canonical labels by the display order and keeps unknown labels after them
- `step2ServicesToCategories` maps each supported enum and de-duplicates
- `step2ServicesToCategories` drops unmapped values
- `categoriesToStep2Services` maps labels back to enum values deterministically

## Existing indirect coverage

These suites are already green and pin parts of the page's dependency surface:

| File                                                                                                       | What it already protects                                                                           |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [`lib/__tests__/onboarding-wizard-store.test.ts`](../../lib/__tests__/onboarding-wizard-store.test.ts:303) | The Step 2 services → category-label mapping the teammate fallback reuses.                         |
| [`lib/__tests__/middleware.test.ts`](../../lib/__tests__/middleware.test.ts:84)                            | An unauthenticated `/benefits?tab=plans&page=2` redirect preserves the full path in `callbackUrl`. |
| [`components/layout/__tests__/sidebar.test.tsx`](../../components/layout/__tests__/sidebar.test.tsx:22)    | The **Benefits** nav entry exists and is filtered for restricted collaborators.                    |

They do not exercise the server page, the client list, the organization strip, or `/api/benefits`.

## Running the page

```bash
pnpm dev
```

1. Sign in as an advisor with at least one Active plan.
2. Open `/benefits` (the sidebar entry is **Benefits**).
3. Confirm the page title is **Benefits**, set by [`BenefitsListPage`](../../components/pages/benefits/benefits-list.tsx:272).

The two reads can be exercised directly while signed in:

```bash
GET /api/benefits
GET /api/clients?status=all&limit=500&sortColumn=companyName&sortDirection=asc&summary=1
```

Toggling a benefit issues:

```bash
PUT /api/clients/{planId}
PUT /api/clients/{planId}/benefits/{category}
```

## Test data

Prepare these before running the checklist:

- an advisor with `primaryServiceCategories` set to several labels, including a duplicate and an unknown label;
- an advisor whose column is empty but whose latest wizard session has Step 2 services (the legacy fallback);
- an invited teammate with an empty `primaryServiceCategories` whose organization owner **does** have categories (the owner fallback);
- one **Active** plan with all four benefit rows published;
- one Active plan with a mix of `exists` and missing rows;
- one benefit that is **Incomplete** with several `missingInfo` entries;
- one benefit with a partner logo and one without;
- one plan with a **Custom** hub that has a saved custom name;
- one plan with at least four collaborators assigned to the same category (the `+N` chip);
- one Active plan with a persisted Benefits wizard draft in `localStorage` (the **Draft → Continue** state);
- one **Draft** plan and one **Archived** plan (advisor: hidden from the picker; collaborator: still selectable if assigned);
- a Collaborator account invited to one Draft plan and one Active plan.

## Manual test checklist

### 1. Server-rendered organization strip

- [ ] The **Your organization offers** strip is visible on first paint, before the plan card resolves.
- [ ] Its chips never appear _after_ the plan's benefit rows on a cold load.
- [ ] The chips match `User.primaryServiceCategories`, trimmed, de-duplicated and in canonical order.
- [ ] An unknown stored label is still shown, after the canonical labels.
- [ ] With an empty column but a latest wizard session, the Step 2 services appear as labels.
- [ ] An invited teammate with no categories sees the organization owner's categories.
- [ ] A teammate who filled in their own profile sees their own categories, not the owner's.
- [ ] A viewer with no categories and no owner fallback sees **No service categories selected yet.**
- [ ] **Edit in Settings** / **Add in Settings** opens `/settings`.
- [ ] A Collaborator does **not** see the strip at all.
- [ ] A Prisma failure in the strip's lookup leaves the page rendered (the page does not throw).

### 2. Plan picker

- [ ] The picker heading is **Benefits** and the input placeholder is **Search for a plan**.
- [ ] An advisor sees only **Active** plans.
- [ ] A Collaborator sees assigned plans regardless of status, including Draft and Archived.
- [ ] Recent-plan chips appear and selecting one changes the plan.
- [ ] Typing filters by company name; **No plans match your search.** appears for no match.
- [ ] Arrow keys move the highlight, Enter selects, Escape closes and clears the query.
- [ ] The last-used Benefits plan is restored on return; the shared MRU is only the fallback.
- [ ] **Open Portal** opens the selected plan's Benefits Hub in a new tab with the Comments rail.
- [ ] The picker is disabled when there are no selectable plans.

### 3. Loading, empty and failure states

- [ ] A cold load shows the route skeleton ([`loading.tsx`](<../../app/(dashboard)/benefits/loading.tsx:15>)) and then the plan-card skeleton, with no empty-state flash.
- [ ] The plan-card skeleton mirrors the card's header + four rows.
- [ ] With no plans, an advisor sees **No plans yet. Create a plan first, then add its benefits.** plus **Create Plan** and **Create Benefit**.
- [ ] With no plans, a Collaborator sees the invitation copy and no Create Plan action.
- [ ] With only Draft/Archived plans, an advisor sees **No active plans** and **View Plans** opens `/clients`.
- [ ] A failed plan list shows **Couldn't load your plans** and **Try again** refetches that read.
- [ ] A failed benefits read (with a successful plan list) shows **Couldn't load this plan's benefits** and **Try again** refetches `/api/benefits`.
- [ ] Neither failure card ever replaces a plan list that already loaded.

### 4. Benefit rows

- [ ] Only the selected plan's four rows render.
- [ ] A plan with no rows shows **No benefits found for this plan.**
- [ ] The headline is the benefit's own name; a customized title appears as a secondary note.
- [ ] A `Welcome to …` title is not shown as a customization.
- [ ] The plan-sponsor hub reads **Custom** unless a custom name was saved.
- [ ] A partner logo renders; a missing logo renders the dash placeholder.
- [ ] **Complete** is green; **Incomplete** is amber.
- [ ] Each missing item is its own amber chip; a complete row has none.
- [ ] **Assigned to …** lists every collaborator assigned to the category plus the Key Contact.
- [ ] A collaborator assigned to _all_ categories appears on every card.
- [ ] Key Contacts are not listed as if they were benefit assignees.
- [ ] More than three avatars collapse to three plus a `+N` chip.
- [ ] The missing-field count matches the amber chips for the same row.

### 5. Publish, hide and row actions

- [ ] An existing benefit shows **Published** with the Switch on.
- [ ] Toggling off flips the label optimistically, shows the spinner, and then shows **Hidden**.
- [ ] A success toast names the benefit and says it is now hidden/visible on the Benefits Hub.
- [ ] The plan's other `categoryPortalVisibility` keys are unchanged by the toggle.
- [ ] A failed client PUT reverts the row after revalidation and shows **Failed to save visibility**.
- [ ] A Collaborator sees **Published**/**Hidden** without a Switch and cannot publish.
- [ ] **View** opens `/edit-benefit/{planId}/{categorySlug}`.
- [ ] A Collaborator sees **Open Portal**, which opens the plan's section page in a new tab.
- [ ] **Open Portal** is absent for a benefit that does not exist.
- [ ] A missing benefit shows **Not created** and **Add**, opening `/new-benefits?planId=…&category=…`.
- [ ] After starting and leaving the wizard, the row shows **Draft** and **Continue** to the same URL.
- [ ] A draft for another plan or category does not label this row.
- [ ] A published row never shows **Draft**.
- [ ] A Collaborator sees no **Add** action on missing rows.
- [ ] A read-only viewer with `create_benefits` below edit sees no **Add** action.

### 6. Cross-page refresh

- [ ] With `/benefits` open in a second tab, renaming a benefit in Edit Benefit updates the open list without a manual reload (the `benefits-updated` event).
- [ ] Returning to `/benefits` after editing a benefit shows the new name immediately rather than the previous SWR payload (the `dedupingInterval: 0` read).
- [ ] Switching the selected plan does **not** refetch `/api/benefits` (the key is endpoint-only).

### 7. API contract checks

| Check                               | Expected                                                                                                                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/benefits` with no session | `401`                                                                                                                                                                                            |
| Accessible plans                    | Rows only for `listAccessiblePlanIds(userId)`                                                                                                                                                    |
| Category-scoped collaborator        | Only the granted categories for that plan                                                                                                                                                        |
| Row shape                           | `planId`, `planName`, `planSlug`, `planStatus`, `category`, `label`, `visibilityKey`, `title`, `partnerLogo`, `isEnabled`, `exists`, `planVisibility`, `isComplete`, `missingInfo`, `keyContact` |
| Missing Benefit row                 | `exists: false`, `isEnabled: false`, default label title                                                                                                                                         |
| Missing company name                | `planName: "Untitled plan"`                                                                                                                                                                      |
| Soft-archived document              | Not counted toward `missingInfo`                                                                                                                                                                 |
| Response payload                    | No `employeePortalPreview` / base64 images                                                                                                                                                       |
| Query failure                       | `500` with `success: false`                                                                                                                                                                      |

### 8. Accessibility and keyboard

- [ ] The plan search input has the accessible name **Search plans**, `aria-expanded`, and `aria-haspopup="listbox"`.
- [ ] The dropdown exposes `role="listbox"` / `role="option"` with `aria-selected` on the current plan.
- [ ] The plan-card skeleton is announced as busy (`aria-busy`, `aria-live="polite"`).
- [ ] Each Switch exposes its checked state, and is disabled while its toggle is in flight.
- [ ] The collaborator **Open Portal** button has an accessible name naming the benefit.
- [ ] The organization strip's chips are readable as a list of labels, not just colour.

## Known gaps

These are observations from the current implementation, not release blockers unless the product decides otherwise:

1. **The benefits read is capped at 100 plans.** `/api/benefits` uses `take: 100` on the accessible clients, while the picker fetches up to 500 (`limit=500`). An account with more than 100 accessible plans can select a plan that has no rows in the response and see **No benefits found for this plan.**
2. **The toggle is two writes, not one transaction.** The client visibility PUT and the benefit `isEnabled` PUT are independent. If the first succeeds and the second fails, the UI only warns and revalidates to a state where the hub is hidden but the benefit still says enabled.
3. **Draft state is local.** `readPersistedBenefitsDraft()` reads `localStorage` once on mount, so **Draft** / **Continue** does not follow the advisor to another browser.
4. **The organization strip disappears for collaborators.** That is deliberate (the labels belong to the owner, and the plan card already states what the plan has), but it means the strip's server fallback is never exercised for a collaborator.
5. **The strip degrades silently.** Every failure is logged and converted to `[]`, which is indistinguishable from “nothing selected”. The server page intentionally prefers a degraded header to a failed page.
6. **Plan-list failure is masked when cached data exists.** `keepPreviousData` keeps the picker usable, so a revalidation failure after a successful first load is not surfaced anywhere.

## Future coverage

### Unit cases to add next

- two rows toggling at the same time: only the active row spins, and the second row is not disabled;
- a selected plan that disappears from the plan list after a revalidation (pin or fix the stale selection);
- the `create_benefits: view` + non-collaborator case, which currently still receives a publish Switch;
- the `/api/benefits` `take: 100` truncation against a picker list of 500;
- a malformed `/api/benefits` row missing `planVisibility` (the toggle must not throw).

### E2E (Playwright)

[`e2e/benefits.spec.ts`](../../e2e/benefits.spec.ts:1) now covers:

- the picker, organization strip, and plan card render;
- switching plans does not re-request `/api/benefits`;
- with `E2E_PLAN_NAME`, the selected plan survives a reload;
- **View** opens an Edit Benefit route;
- with `E2E_BENEFIT_TOGGLE=1`, a disposable benefit toggles off and back on;
- a collaborator sees no organization strip and no publish Switch.

Still worth adding:

- a collaborator with a category-scoped assignment sees only that section;
- the plan picker's search narrows the dropdown (the unit suite covers it, the browser journey does not);
- a failed `/api/benefits` response renders **Couldn't load this plan's benefits** with a working retry.

## Related documentation

- [`docs/testing/clients-tests.md`](clients-tests.md) — the All Plans page behind the plan picker, and the accessible-plan scoping model.
- [`docs/testing/edit-client-tests.md`](edit-client-tests.md) — Key Contacts and plan settings that feed the row's contacts.
- [`docs/testing/settings-test.md`](settings-test.md) — where `primaryServiceCategories` is edited.
- [`docs/teammates-module.md`](../teammates-module.md) — collaborator and category-scoping rules used by `/api/benefits`.
- [`docs/testing/testing.md`](testing.md) — the shared runner, conventions and inventory structure.
