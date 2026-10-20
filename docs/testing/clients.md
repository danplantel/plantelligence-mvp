# All Plans (View Clients) Testing

This document is the test inventory for [`app/(dashboard)/clients/page.tsx`](<../../app/(dashboard)/clients/page.tsx>), which renders [`ClientsListDashboardPage`](../../components/pages/clients-list-dashboard.tsx:112).

It covers the search/filter/sort shell, the plans table and its row actions, pagination, the delete flow, and the `/api/clients?view=table` contract the page depends on.

## Summary

- **Unit tests:** 67 passing in 4 files
- **E2E:** 6 Playwright tests in [`e2e/clients.spec.ts`](../../e2e/clients.spec.ts), env-gated
- **Runner:** Vitest + React Testing Library + jsdom; Playwright for E2E

The unit suites cover the All Plans page's SWR query contract, table rendering, every row action, pagination boundaries (including the post-delete page clamp), the request failure state, both delete outcomes, and the two endpoints the table depends on: `GET /api/clients` and `DELETE /api/clients/[id]`. The manual checklist below remains the source of truth for permission-scoped journeys that need real data.

## Running these tests

All Plans-only commands:

```bash
pnpm test:clients           # page + API suites (67 tests)
pnpm test:clients:watch     # watch mode
pnpm test:clients:coverage  # suite + V8 coverage
```

These are backed by [`vitest.clients.config.mts`](../../vitest.clients.config.mts) and [`scripts/tests/run-clients-tests.mjs`](../../scripts/tests/run-clients-tests.mjs), which list the four suites explicitly so the command cannot pick up unrelated tests.

All tests:

```bash
pnpm test                 # whole unit suite
pnpm test:watch           # unit tests in watch mode
pnpm test:coverage        # unit tests + V8 coverage
pnpm test:e2e:install     # install Chromium once
pnpm test:e2e             # Playwright E2E
pnpm test:e2e:ui          # Playwright UI mode
```

The All Plans E2E file skips itself unless credentials are present:

```bash
E2E_BASE_URL=http://localhost:3000 \
E2E_EMAIL=advisor@example.com \
E2E_PASSWORD=... \
E2E_PLAN_NAME="Acme Corp" \
pnpm test:e2e
```

`E2E_PLAN_NAME` gates the two row journeys (contacts tab, delete dialog); the four toolbar journeys only need `E2E_EMAIL` / `E2E_PASSWORD`.

## Test inventory

| #   | Suite                                                      | Tests | Focus                                                                                                                |
| --- | ---------------------------------------------------------- | ----: | -------------------------------------------------------------------------------------------------------------------- |
| 1   | `app/(dashboard)/clients/__tests__/page.test.tsx`          |    37 | SWR query construction, table content (incl. failure state), row actions, pagination/clamp, refresh, delete outcomes |
| 2   | `app/(dashboard)/clients/__tests__/page.debounce.test.tsx` |     2 | The real `useDebounceValue` window: no query while typing, one settled query per burst                               |
| 3   | `app/api/clients/__tests__/route.test.ts`                  |    18 | `GET /api/clients` auth, plan scoping, `view=table`/`summary` projections, filters, pagination, sorting, 500         |
| 4   | `app/api/clients/[id]/__tests__/route.test.ts`             |    10 | `DELETE /api/clients/[id]` auth, 404/403, cascading cleanup order, wizard-draft cleanup, 500                         |
| 5   | `e2e/clients.spec.ts`                                      |     6 | Toolbar shell, empty search, filter/reset/sort request params, refresh, contacts tab, delete dialog cancel           |

## Unit test inventory

**`app/(dashboard)/clients/__tests__/page.test.tsx`**

**Query construction**

- requests `view=table` with the default `search`, `status`, `type`, `page`, `limit`, `sortColumn` and `sortDirection`
- sends the typed search term and resets to page 1
- filters by plan type with the quick buttons and resets the page
- filters by status from the Advanced Filter menu
- toggles a sortable column between ascending and descending
- sorts by Status, Type, Created and Updated, each resetting to page 1
- clears both filters from **Reset filters**
- changes the page size (Radix Select) and returns to page 1

**Table content**

- renders logos, brand-coloured initial tiles, status/type badges, `mm/dd/yy` dates and contact counts
- falls back to a neutral badge for an archived status
- renders five skeleton rows while the first page loads
- renders the empty state when there are no plans
- renders the failure state ("Couldn't load plans…") with a working **Try again** instead of the empty state
- counts contacts from `keyContactsCount`, `keyContacts[]` and `keyContacts.contacts[]`, and treats malformed JSON as 0
- renders an "Untitled plan" placeholder and a neutral tile for a legacy row without a name or brand colour

**Row actions**

- opens the Hub, Documents, Meetings and Edit destinations
- keeps Marketing as an informational toast
- links the contact count to the plan's contacts tab
- limits a draft to Delete and a resume path, storing the draft and opening the persisted step
- falls back to `/new-client` for a missing or out-of-range `currentStep`
- falls back to the plan id for the Hub link when the plan has no slug

**Pagination, refresh and delete**

- reports the visible range, pages forward, and disables Next on the final page
- clamps back to the new last page once a shrinking total invalidates the current page
- leaves the current page alone when a filter simply matches nothing
- revalidates the current query from Refresh without rebuilding the SWR key
- asserts the SWR options (`keepPreviousData`, `dedupingInterval`, `revalidateOnFocus`)
- confirms deletion only after the dialog, deletes, revalidates, and clears the wizard draft
- reports a failed deletion, keeps the row, and closes the dialog
- disables both dialog buttons and shows **Deleting** while the request is in flight
- reports a thrown delete request and unlocks the dialog

**`app/(dashboard)/clients/__tests__/page.debounce.test.tsx`**

This file is the only one that does not mock `usehooks-ts`; it runs the real
300 ms debounce on real timers.

- typing keeps SWR on the previous search term until the window elapses
- a burst of keystrokes settles into a single query, with no intermediate terms

**`app/api/clients/__tests__/route.test.ts`**

- returns `401` with no session
- scopes both `findMany` and `count` to `listAccessiblePlanIds(userId)`
- returns no rows for a caller with no accessible plans
- `view=table`: strips `keyContacts` in favour of `keyContactsCount` for array, object and null shapes
- `view=table`: selects the slim projection and never `employeePortalPreview`, `documents` or the legacy image columns
- `summary=1`: returns the picker contract without the table transform
- passes status/type filters and a case-insensitive name search; omits them for `all`
- computes `skip`/`take` and the pagination metadata; defaults to page 1 with 25 rows
- orders by each sortable column and falls back to `createdAt desc` for an unknown column
- normalizes brand images and reports `documentCount` on the full projection
- returns `500` when the query fails

**`app/api/clients/[id]/__tests__/route.test.ts`**

- returns `401` with no session and touches no rows
- returns `404` when neither the id nor the slug resolves
- resolves a slug with a lookup scoped to the caller and uses the canonical id for cleanup
- returns `403` when the plan belongs to another advisor
- deletes webinars (scoped to the user), benefits, documents, meetings, marketing assets, flyers and videos, then the client
- keeps the legacy company-name meeting cleanup for orphaned rows
- removes benefits before the client row (the P2014 guard)
- deletes every wizard draft row that claims the plan by name or slug, deduplicating session ids
- skips wizard cleanup when there are no drafts
- returns `500` and leaves the client row alone when a cleanup step fails

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
- [ ] Deleting the only row on the last page moves the table to the new last page instead of leaving `Page N of M` pointing past the end (the `useEffect` clamp does this).

### 10. Empty and error states

- [ ] With no plans at all, the table shows **No plans found.**
- [ ] With filters that match nothing, the same empty row is shown and pagination is hidden.
- [ ] A failed `/api/clients` request shows **Couldn't load plans. Please try again.** with a **Try again** button, not the empty state.
- [ ] **Try again** refetches the current query.
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

1. **Delete is owner-only.** `DELETE /api/clients/[id]` returns `403` when `client.userId` is not the caller — even for an organization teammate who can edit the plan — yet the UI shows Delete on every visible row. The API suite pins the current behaviour; the product has to decide whether teammates should be allowed.
2. **Filters live in memory.** A reload of `/clients` returns to the default filters, sort and page; there is no query-string state to deep-link or restore.
3. **Archived plans.** The quick filters expose only Active and Draft; archived rows appear under "All statuses" and rely on the badge fallback.
4. **Dead helpers.** `getPlanTypeBadge()` and `handleViewClient()` are defined but not used by the current table; the Hub link builds its own slug-aware URL. They should be removed or wired up deliberately.
5. **Marketing is a placeholder.** The button only fires a toast; tests assert the toast, not navigation.

## Future coverage

### Additional unit cases

- a plan created by the wizard appearing after a revalidation;
- team-member / collaborator row scoping in the UI (the API suite covers the `listAccessiblePlanIds` clause, not the rendering scope).

### E2E (Playwright)

[`e2e/clients.spec.ts`](../../e2e/clients.spec.ts) currently covers:

- the toolbar, quick filters and sortable headers render on `/clients`;
- a search that cannot match shows **No plans found.** and never the failure state;
- the quick type filter, Advanced Filter status, **Reset filters** and Plan sorting each issue the expected `/api/clients` params (`view=table`, `status`, `type`, `sortColumn`, `sortDirection`, page reset);
- **Refresh** revalidates the table projection;
- with `E2E_PLAN_NAME`: the contact count opens the plan's contacts tab, and cancelling a delete closes the dialog and keeps the row.

Still worth adding:

- a plan created by the Create Plan wizard appears under All Plans and can be searched;
- a scoped teammate sees only their assigned plans;
- deleting a disposable draft removes it and does not resume it in the wizard (gate behind an explicit env flag so the suite never destroys real data);
- a teammate's delete attempt surfacing the API's `403`.

## Related documentation

- [`docs/testing/settings-test.md`](settings-test.md) — the reference format for a page-level suite.
- [`docs/testing/dashboard-test.md`](dashboard-test.md) — dashboard shell and navigation.
- [`docs/teammates-module.md`](../teammates-module.md) — plan-scoping rules behind `listAccessiblePlanIds`.
