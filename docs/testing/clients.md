# All Plans (View Clients) Testing

This document is the test inventory for [`app/(dashboard)/clients/page.tsx`](<../../app/(dashboard)/clients/page.tsx>), which renders [`ClientsListDashboardPage`](../../components/pages/clients-list-dashboard.tsx:112).

It covers the search/filter/sort shell, the plans table and its row actions, pagination, the delete flow, and the `/api/clients?view=table` contract the page depends on.

## Summary

- **Unit tests:** 18 passing in 1 file
- **Runner:** Vitest + React Testing Library + jsdom
- **E2E:** none yet — see [Future coverage](#future-coverage)

The unit suite covers the SWR query contract (filters/sort/page), table rendering, every row action, pagination boundaries, refresh, and both delete outcomes. The manual checklist below remains the source of truth for the API contract and permission-scoped journeys.

## Running these tests

All Plans-only commands:

```bash
pnpm test:clients           # the page suite (18 tests)
pnpm test:clients:watch     # watch mode
pnpm test:clients:coverage  # suite + V8 coverage
```

These are backed by [`vitest.clients.config.mts`](../../vitest.clients.config.mts) and [`scripts/tests/run-clients-tests.mjs`](../../scripts/tests/run-clients-tests.mjs), which include the page suite explicitly so the command cannot pick up unrelated tests. Add future `components/pages/clients*` suites to that config.

All tests:

```bash
pnpm test                 # whole unit suite
pnpm test:watch           # unit tests in watch mode
pnpm test:coverage        # unit tests + V8 coverage
pnpm test:e2e:install     # install Chromium once
pnpm test:e2e             # Playwright E2E
pnpm test:e2e:ui          # Playwright UI mode
```

## Test inventory

| #   | Suite                                             | Tests | Focus                                                                                                                             |
| --- | ------------------------------------------------- | ----: | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `app/(dashboard)/clients/__tests__/page.test.tsx` |    18 | SWR query construction, table content, row actions, draft gating, contact-count link, pagination, refresh, delete success/failure |

## Unit test inventory

**`app/(dashboard)/clients/__tests__/page.test.tsx`**

**Query construction**

- requests `view=table` with the default `search`, `status`, `type`, `page`, `limit`, `sortColumn` and `sortDirection`
- sends the typed search term and resets to page 1
- filters by plan type with the quick buttons and resets the page
- filters by status from the Advanced Filter menu
- toggles a sortable column between ascending and descending

**Table content**

- renders logos, brand-coloured initial tiles, status/type badges, `mm/dd/yy` dates and contact counts
- falls back to a neutral badge for an archived status
- renders five skeleton rows while the first page loads
- renders the empty state when there are no plans

**Row actions**

- opens the Hub, Documents, Meetings and Edit destinations
- keeps Marketing as an informational toast
- links the contact count to the plan's contacts tab
- limits a draft to Delete and a resume path, storing the draft and opening the persisted step

**Pagination, refresh and delete**

- reports the visible range, pages forward, and disables Next on the final page
- revalidates the current query from Refresh
- confirms deletion only after the dialog, deletes, revalidates, and clears the wizard draft
- reports a failed deletion, keeps the row, and closes the dialog

## Running the page

```bash
pnpm dev
```

1. Sign in as an advisor with at least one plan.
2. Open `/clients` (the sidebar entry is **All Plans**).
3. Confirm the page header reads **All Plans** — set by [`app/(dashboard)/clients/page.tsx`](<../../app/(dashboard)/clients/page.tsx:10>).

The API can be exercised directly while signed in:

```bash
GET /api/clients?view=table&search=&status=all&type=all&page=1&limit=25&sortColumn=updatedAt&sortDirection=desc
```

## Test data

Prepare these before running the checklist:

- one **Active client** with a logo and at least one key contact;
- one **Draft plan** whose `currentStep` is between 1 and 5;
- one **Prospect** (`type: "prospect"`);
- one plan **without a logo** (to exercise the initial tile);
- one **Archived** plan (to exercise the status fallback);
- more than 25 plans (to exercise pagination), including a long company name.
- an account with a **scoped Team Member/Collaborator** (to verify the list is narrowed by `listAccessiblePlanIds`).

## Manual test checklist

### 1. Page shell and permissions

- [ ] The title is **All Plans** and the subtitle context comes from the dashboard header.
- [ ] An unauthenticated request to `/api/clients` returns `401 Unauthorized`.
- [ ] An owner sees every plan they own (legacy `userId` and `Organization.ownerUserId`).
- [ ] A Team Member with **All Plans** sees every plan in the organization.
- [ ] A Team Member or Collaborator with per-plan assignments sees **only** those plans.
- [ ] An account with no accessible plans sees the empty table state rather than an error.

### 2. Loading and refresh

- [ ] On first load, five skeleton rows render in place of the table; no "No plans found." flashes.
- [ ] Changing a filter or page keeps the previous rows visible while the next payload loads (`keepPreviousData`), rather than blanking the table.
- [ ] **Refresh** refetches the list and leaves the current filters/sort/page intact.
- [ ] Returning to the browser tab refetches (`revalidateOnFocus`) and a plan saved elsewhere appears.
- [ ] A plan created in another tab appears after the refresh or focus revalidation without a hard reload.

### 3. Search

- [ ] The input shows the placeholder **Search plans...** and has a leading magnifier icon.
- [ ] Typing filters by `companyName` (case-insensitive contains) after the 300 ms debounce.
- [ ] Search runs on every keystroke only after the debounce has elapsed — rapid typing produces one request, not one per character.
- [ ] Searching resets the table to page 1.
- [ ] A query matching nothing shows the empty state.
- [ ] Clearing the search restores the full list and page 1.

### 4. Filters

- [ ] **Advanced Filter** opens a menu with **Status** (All statuses / Active / Draft), **Plan Type** (All plans / Client / Prospect), and **Reset filters**.
- [ ] Choosing a status or type narrows the table and resets it to page 1.
- [ ] **Reset filters** returns both radio groups to their defaults and restores the unfiltered list.
- [ ] The quick **All / Client / Prospect** buttons mirror the Plan Type selection; the active button is filled (Client green, Prospect orange, All default).
- [ ] Combining search + status + type shows only rows satisfying all three.
- [ ] Status and type filters survive a sort or page-size change.
- [ ] A **Draft prospect** appears under both `status=draft` and `type=prospect`.
- [ ] An **Archived** plan is absent from Active and Draft but present under All statuses, with a gray **Archived** badge.

### 5. Sorting

- [ ] **Plan**, **Status**, **Type**, **Created**, and **Updated** headers are sortable.
- [ ] Clicking a header initially sorts ascending; clicking the active header toggles ascending/descending.
- [ ] Sorting resets the table to page 1.
- [ ] Sorting is server-side (`sortColumn` / `sortDirection` in the request), not just a re-order of the current page.
- [ ] Unknown sort columns fall back to `createdAt`.
- [ ] The chevron icon is present on every sortable header.

### 6. Table content

- [ ] A plan with `companyLogo` renders the image; a plan without one renders its first initial on a tile using `brandColor`.
- [ ] A missing `brandColor` does not crash the row (the tile falls back to the default palette).
- [ ] Long company names wrap to at most two lines (`line-clamp-2`) without breaking the row height.
- [ ] The **Status** badge is green for Active, orange for Draft, and gray for any other stored status.
- [ ] The **Type** badge is green for Client and orange for Prospect.
- [ ] **Created** and **Updated** render as `mm/dd/yy`.
- [ ] **Key Contacts** shows the count. `view=table` sends `keyContactsCount`, and the JSON fallbacks (`keyContacts[]` and `keyContacts.contacts[]`) render the same number.
- [ ] Clicking the contact count opens `/edit-client/{id}?tab=contacts` for that row.
- [ ] Rows do not expose `employeePortalPreview`, documents, or base64 headshots in the network payload (the table projection strips them).

### 7. Row actions

For an **Active client**:

- [ ] **Hub** opens the plan portal in a new tab using the plan slug when present, with the Comments rail link preserved.
- [ ] **Documents** navigates to `/documents?company={companyName}`.
- [ ] **Meetings** navigates to `/communications?client={companyName}&clientId={id}`.
- [ ] **Marketing** currently shows the informational toast "Marketing feature will be implemented soon".
- [ ] **Edit** navigates to `/edit-client/{id}` (and prefetches it).
- [ ] **Delete** opens the confirmation dialog (below).

For a **Draft plan**:

- [ ] Only **Delete** and **Finish Setup** are shown; Hub, Documents, Meetings, Marketing, and Edit are hidden.
- [ ] **Finish Setup** stores the pending draft selection and opens `/new-client?step={currentStep}` when `currentStep` is 1–5, otherwise `/new-client`.

Every action button should have a tooltip naming it (Hub, Documents, Meetings, Marketing, Edit, Delete).

### 8. Pagination

- [ ] Pagination is hidden when the filtered total is 0.
- [ ] **Show** offers 25 / 50 / 100 per page, and changing it resets to page 1.
- [ ] The summary reads `Showing X to Y of N plans` and clamps correctly on the last page.
- [ ] **Previous** is disabled on page 1; **Next** is disabled on the last page.
- [ ] `Page N of M` matches the API `pagination.pages`.
- [ ] Changing search, status, type, or sort returns to page 1.

### 9. Delete flow

- [ ] Clicking **Delete** names the plan in the dialog: "Are you sure you want to delete **{name}**?" and warns that associated documents are deleted too.
- [ ] **Cancel** closes the dialog without a request.
- [ ] **Delete** shows the spinner + **Deleting** label and disables both buttons while in flight.
- [ ] On success: a `Client deleted successfully` toast appears, the row disappears, and the list revalidates without a full reload.
- [ ] The Create Plan wizard's persisted draft and in-memory state are cleared, so `/new-client` does not resume the deleted plan.
- [ ] On failure (e.g. API 500): a `Failed to delete client` toast appears, the dialog closes, and the row remains.
- [ ] Deleting the only row on the last page does not leave `Page N of M` pointing past the end (see [Known gaps](#known-gaps)).

### 10. Empty and error states

- [ ] With no plans at all, the table shows **No plans found.**
- [ ] With filters that match nothing, the same empty row is shown and pagination is hidden.
- [ ] A failed `/api/clients` request is distinguishable from "no plans" (currently it is not — see below).
- [ ] The page does not crash when `pagination` is missing from the response.

### 11. API contract checks

Run these against `/api/clients` while signed in:

| Check                                      | Expected                                                                                                                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `view=table`                               | Rows contain `id`, `slug`, `companyName`, `companyLogo`, `brandColor`, `status`, `type`, `createdAt`, `updatedAt`, `currentStep`, `keyContactsCount` — and **no** `keyContacts` JSON. |
| `status=active` / `draft`                  | Only that status; `all` applies no status predicate.                                                                                                                                  |
| `type=client` / `prospect`                 | Only that type; `all` applies no type predicate.                                                                                                                                      |
| `search=acme`                              | Case-insensitive `companyName` contains match.                                                                                                                                        |
| `page=2&limit=25`                          | `skip = 25`, `take = 25`, correct `total`/`pages`.                                                                                                                                    |
| `sortColumn=companyName&sortDirection=asc` | Ordered by company name ascending.                                                                                                                                                    |
| Unknown `sortColumn`                       | Falls back to `createdAt`.                                                                                                                                                            |
| No session                                 | `401 Unauthorized`.                                                                                                                                                                   |
| Scoped user                                | Response contains only plans returned by `listAccessiblePlanIds`.                                                                                                                     |

### 12. Accessibility and keyboard

- [ ] The search input is reachable by Tab and has a visible focus ring.
- [ ] Sort headers and filter controls are operable with Enter/Space.
- [ ] The Advanced Filter menu traps focus while open and closes on Escape.
- [ ] The delete dialog traps focus, closes on Escape/Cancel, and returns focus to the Delete button.
- [ ] Icon-only action buttons expose accessible names (via tooltip/`aria-label`).

## Known gaps

These are observations from the current implementation, not release blockers unless the product decides otherwise:

1. **No E2E coverage.** The page's unit suite covers its orchestration, but no Playwright journey proves the Create Plan → All Plans flow, permission scoping, or persistence against a live API.
2. **Errors look like an empty list.** `swrData?.data ?? []` means a failed request renders "No plans found." with no error or retry affordance. A user can mistake an outage for having no plans.
3. **Page clamp after deleting the last row.** `currentPage` is not reduced when a delete makes it larger than `totalPages`, so the table can show an empty page while the footer says `Page 3 of 2`.
4. **Archived plans.** The quick filters expose only Active and Draft; archived rows appear under "All statuses" and rely on the badge fallback.
5. **Dead helpers.** `getPlanTypeBadge()` and `handleViewClient()` are defined but not used by the current table; the Hub link builds its own slug-aware URL. They should be removed or wired up deliberately.
6. **Marketing is a placeholder.** The button only fires a toast; tests should assert the toast, not navigation.

## Future coverage

### Additional unit cases

- the real `useDebounceValue` timing (the suite mocks the hook and asserts the settled query);
- choosing 50/100 per page through the Radix Select, which also resets to page 1;
- an API error state once the page grows one (today a failed request renders as "No plans found.");
- the page clamp after deleting the last row on a page, once that behaviour is fixed.

### E2E (Playwright)

Add `e2e/clients.spec.ts` for:

- a plan created by the Create Plan wizard appears under All Plans and can be searched;
- a scoped teammate sees only their assigned plans;
- sort + filter + paginate, then refresh the page and confirm the URL state is reproducible;
- deleting a draft from its row removes it and does not resume it in the wizard.

## Related documentation

- [`docs/testing/settings-test.md`](settings-test.md) — the reference format for a page-level suite.
- [`docs/testing/dashboard-test.md`](dashboard-test.md) — dashboard shell and navigation.
- [`docs/teammates-module.md`](../teammates-module.md) — plan-scoping rules behind `listAccessiblePlanIds`.
