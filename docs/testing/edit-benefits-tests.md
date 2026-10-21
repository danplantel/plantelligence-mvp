# Edit Benefit Testing

This document is the test inventory for the Edit Benefit feature: the route gate at [`app/(dashboard)/edit-benefit/[planId]/[category]/page.tsx`](<../../app/(dashboard)/edit-benefit/[planId]/[category]/page.tsx:10>), the editor at [`BenefitEditPage`](../../components/pages/benefits/benefit-edit-page.tsx:95), and the benefit-category API the editor reads and writes.

The route is deliberately small. It decides between the restricted notice, a loading frame and the editor. The editor owns hydration, tabs, the Custom benefit name, save/delete, the portal link and the preview layout. The API owns the row, the legacy mirror and the purge contract.

## Summary

- **Unit tests:** 206 passing across 9 files.
  - route gate: 26
  - editor: 42
  - Preview tab (`EditBenefitPreviewSection`): 13
  - shared Step 1: 18
  - shared Step 3 (Contacts / FAQs tabs): 32
  - shared Step 4 (Documents tab): 23
  - shared Step 5 (Disclaimers tab): 19
  - `InviteCollaboratorDialog`: 19
  - benefit-category API: 14
- **E2E:** none dedicated; the route/editor have no Playwright spec yet.
- **Runner:** Vitest + React Testing Library + jsdom.
- **Scoped scripts:** `pnpm test:edit-benefit`, `pnpm test:edit-benefit:watch`, `pnpm test:edit-benefit:coverage`.

## Running these tests

```bash
pnpm test:edit-benefit           # route + editor + preview + steps + API (206 tests)
pnpm test:edit-benefit:watch     # watch mode
pnpm test:edit-benefit:coverage  # suite + V8 coverage
```

These are backed by [`vitest.edit-benefit.config.mts`](../../vitest.edit-benefit.config.mts) and [`scripts/tests/run-edit-benefit-tests.mjs`](../../scripts/tests/run-edit-benefit-tests.mjs), which list the nine suites explicitly so the command cannot pick up unrelated tests.

All tests:

```bash
pnpm test
pnpm test:watch
pnpm test:coverage
```

## Test inventory

| #   | Suite                                                                       | Tests | Focus                                                                              |
| --- | --------------------------------------------------------------------------- | ----: | ---------------------------------------------------------------------------------- |
| 1   | `app/(dashboard)/edit-benefit/[planId]/[category]/__tests__/page.test.tsx`  |    26 | Params, slug decoding, access lookup, loading/denied/allowed, extra gate cases     |
| 2   | `components/pages/benefits/__tests__/benefit-edit-page.test.tsx`            |    42 | Hydration/chrome, tabs, Custom name, save, delete, portal link, preview layout     |
| 3   | `components/pages/benefits/__tests__/edit-benefit-preview-section.test.tsx` |    13 | Editor auto-open/toggle, header events, desktop/mobile, plan fallback, typography  |
| 4   | `components/wizard/benefits-steps/__tests__/step-1.test.tsx`                |    18 | Plan gate, edit-mode picker hiding, messaging, signature, primary contact          |
| 5   | `components/wizard/benefits-steps/__tests__/step-3.test.tsx`                |    32 | Contact roster/cap/writes, collaborators, FAQ add/edit/remove/save, section tabs   |
| 6   | `components/wizard/benefits-steps/__tests__/step-4.test.tsx`                |    23 | Document load/merge, filters, upload, delete branches, inline edit, reorder, sort  |
| 7   | `components/wizard/benefits-steps/__tests__/step-5.test.tsx`                |    19 | Disclosure seeding, category mapping, debounced saves, apply-all, timer cleanup    |
| 8   | `components/pages/benefits/__tests__/invite-collaborator-dialog.test.tsx`   |    19 | Scope chips, submit payload, domain suggestion, existing search, toast branches    |
| 9   | `app/api/clients/[id]/benefits/[category]/__tests__/route.test.ts`          |    14 | GET/PUT/DELETE auth, updateOnly, R2 signing, soft-disable, purge, dual-write, 500s |

## Route gate inventory

### `app/(dashboard)/edit-benefit/[planId]/[category]/__tests__/page.test.tsx`

The real [`slugToCategory`](../../lib/benefit-category-slug.ts:38) is used; `usePlanAccess`, `BenefitEditPage` and `NoAccessNotice` are mocked.

**Access lookup**

- calls `usePlanAccess({ planId, category, permission: "create_benefits", level: "view" })`
- passes the route plan id unchanged
- passes empty strings for non-string params
- passes an empty plan id when `planId` is missing
- keeps an empty `requestedCategory` from a denial
- recomputes the lookup input when the params change

**Slug decoding**

- `retirement` → `Retirement`
- `group-health` → `Group Health`
- `group-life` → `Group Life`
- `company-plan-sponsor` → `Company / Plan Sponsor`
- uppercase slugs resolve case-insensitively
- percent-encoded slugs decode
- a decoded literal slash is passed through unchanged
- unknown slugs pass through unchanged
- the decoded label reaches `BenefitEditPage`

**Loading**

- renders **Checking your access…**
- renders neither the editor nor the refusal

**Denied**

- passes `message`, `reason`, `planId`, organization, plan name, category, assigned categories and owner
- prefers the denial's `requestedCategory`
- falls back to the URL category when the denial names none
- defaults the context fields when the denial is absent
- never renders the editor

**Allowed**

- renders the editor with decoded props
- renders no refusal or spinner
- an unknown status falls through to the editor

## Editor inventory

### `components/pages/benefits/__tests__/benefit-edit-page.test.tsx`

The wizard store, steps, preview, delete dialog, save/purge helpers, router and page-title context are mocked.

**Hydration and chrome (11)**

- rehydrates once and seeds Step 1 with the route plan/category
- preserves an existing draft title
- shows **Loading benefit...** until hydration finishes
- sets the title and `Plan - Category` subtitle
- clears the subtitle on unmount
- cancellation: unmount before hydration → no store write
- portals the tab bar into `#header-tabs-portal`
- falls back to an inline tab bar without the target
- `?tab=documents` opens Documents; unknown tabs are ignored
- registers the comment surface

**Tabs (3)**

- Branding renders a visible Step 1 in edit mode
- other tabs keep a hidden Step 1 mounted
- Contacts, FAQs, Documents, Disclosures and Preview each render their section

**Custom name (7)**

- field appears only for the Custom hub
- hidden for standard categories
- prefills from the draft
- falls back to the persisted row's title
- treats the storage label as no name
- every edit writes `benefitTitle` to the store and updates the counter
- `maxLength` is 35

**Save (8)**

- missing plan id → **Plan ID missing. Cannot save benefit.**
- success → **Benefit saved successfully!** and **Saved**
- **Saved** resets after 2.5s
- `{ success: false }` → error toast with description and 5s duration
- a thrown request → error toast
- both footer buttons disabled while saving
- Custom name is re-asserted and the `/api/benefits` cache is patched for the matching plan/category only
- a blank Custom name is not written

**Delete (7)**

- disabled until hydration
- opens the type-to-confirm dialog with the display category
- confirm unlocks after **delete benefit** is typed and performs purge + forget + cache invalidation + toast + navigation
- failure toast keeps the editor
- closing clears the typed phrase
- Custom hub is named by the advisor's name
- no plan id returns early without a request

**Portal link (4)**

- category portal page with the Comments rail
- Custom name slug
- legacy `wellness-programs` for an unnamed hub
- plan id fallback when the plan has no slug

**Preview layout (2)**

- `step5EditorStateChange { isOpen: true }` aligns the tab strip to the editor
- closing restores the centered strip

## API inventory

### `app/api/clients/[id]/benefits/[category]/__tests__/route.test.ts`

**GET**

- `401` without a session
- `404` when the plan does not resolve
- `403` when plan access is denied
- returns `benefit: null` when no row exists
- signs a stored `planVideo` when R2 is configured

**PUT**

- `403` when the caller may view but not edit
- `?updateOnly=1` skips when no row exists and returns `skipped: true`
- `?updateOnly=1` updates an existing row
- writes `isEnabled: false` and mirrors the rows into `employeePortalPreview`
- `500` when the upsert fails

**DELETE**

- default soft-disables via `updateMany`
- `?purge=1` hard-deletes, deletes the category's comment threads, removes collaborator scope and filters the legacy mirror
- a failed access cleanup is non-fatal and still returns success
- `500` when the delete fails

## Manual checklist

### 1. Route and category segment

- [ ] `/edit-benefit/plan-1/retirement` opens the Retirement editor.
- [ ] `group-health`, `group-life` and `company-plan-sponsor` resolve to their labels.
- [ ] An uppercase segment resolves to the same category.
- [ ] An unknown segment is passed through rather than failing the route.
- [ ] While the access lookup is in flight, **Checking your access…** is shown and no editor appears.
- [ ] A refused plan/section shows the notice with the organization, plan and section.
- [ ] The notice offers **Go to {covered section}** when another section is covered.
- [ ] An allowed viewer reaches the editor with the right plan/category.
- [ ] A missing `planId` stays in loading rather than flashing a refusal.

### 2. Editor hydration and chrome

- [ ] The page shows **Loading benefit...** until the persisted draft is rehydrated.
- [ ] The title is **Edit Benefit** and the subtitle is `Plan - Category`.
- [ ] The tab bar renders in the fixed header.
- [ ] Refreshing the page keeps the same plan/category and active tab.
- [ ] The Custom hub shows the advisor's name, not the storage label.

### 3. Tabs and sections

- [ ] Branding shows Step 1's accordions.
- [ ] Contacts shows only the support team.
- [ ] FAQs shows the category's FAQs.
- [ ] Documents shows its own section.
- [ ] Disclosures shows the disclosure editor.
- [ ] Preview shows the portal preview and the inline editing panel.
- [ ] Switching tabs keeps the same populated store.

### 4. Custom benefit name

- [ ] The name field appears only for the Custom hub.
- [ ] It prefills from the draft, then the stored row.
- [ ] The 35-character cap is enforced and counted.
- [ ] Saving re-asserts the typed name and Browse Benefits shows the rename without a reload.

### 5. Save, delete and portal

- [ ] Save without a plan id reports the error and writes nothing.
- [ ] A successful save shows **Saved** for 2.5 seconds.
- [ ] A failed save reports the error and keeps the editor.
- [ ] Delete requires typing **delete benefit**.
- [ ] Delete removes the row, the draft and the category's comments, then returns to `/benefits`.
- [ ] A failed delete reports the error and keeps the editor.
- [ ] Open Portal uses the plan slug/id and the category's segment, with the Comments rail.
- [ ] An unnamed Custom hub opens the legacy `wellness-programs` segment.

## Known gaps

1. **The real `usePlanAccess` fetch is not exercised.** The route suite mocks the hook; its abort/lookup-failure behavior belongs to the hook's own coverage.
2. **The real `NoAccessNotice` actions are not clicked.** The stub verifies props; “Go to section” and “Message Organization” are outside this route's suite.
3. **`BenefitsEditorPanel` internals are stubbed.** `EditBenefitPreviewSection` is covered, but the panel's field wiring, validation scroll targets, image editing and help-card editor are not driven here.
4. **The API suite mocks `resolveClient`'s dependencies**, so the portal/dev-loopback and inline-image R2 branches are not exercised here.
5. **No E2E.** The route segment, access cookie and editor requests are not proven together in a browser.

## Future coverage

### Editor and subcomponents

- `BenefitsEditorPanel` field wiring, validation scroll targets, image editing and help-card editing
- the 2.5s `Saved` timer cleanup on unmount (currently not cleared)

### API

- portal (`forPortal=1`) and local-dev-loopback branches
- R2 upload for inline benefit images
- partial-update semantics for every omitted field
- the dual-write failure path (non-fatal)

### E2E (Playwright)

A future `e2e/edit-benefit.spec.ts` should cover:

- an owner renaming a Custom benefit and seeing it on `/benefits`;
- deleting a disposable benefit through the type-to-confirm dialog;
- a collaborator opening their section and being refused another;
- the refusal's **Go to {covered section}** action;
- a reload preserving the route's plan/category;
- the Preview tab's panel and fixed action bar.

## Related documentation

- [`docs/testing/create-benefit-tests.md`](create-benefit-tests.md) — the Create Benefit wizard that writes these rows.
- [`docs/testing/benefits-tests.md`](benefits-tests.md) — Browse Benefits, which links into this route.
- [`docs/testing/settings-test.md`](settings-test.md) — the shared tab-shell and save patterns used by the editor.
- [`docs/testing/testing.md`](testing.md) — the shared runner, conventions and inventory structure.
