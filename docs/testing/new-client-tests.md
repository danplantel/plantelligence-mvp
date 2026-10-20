# Create Plan (New Client) Testing

This document is the test inventory for [`app/(dashboard)/new-client/page.tsx`](<../../app/(dashboard)/new-client/page.tsx:40>), the page that hosts the five-step Create Plan wizard, and for the layers below it: the wizard chrome, the step screens, the wizard store's serializers, the validation module, the resume helpers and the wizard APIs.

## Summary

- **Unit tests:** 288 passing in 13 files
- **E2E:** 4 Playwright tests in [`e2e/new-client.spec.ts`](../../e2e/new-client.spec.ts), env-gated
- **Runner:** Vitest + React Testing Library + jsdom; Playwright for E2E

The suites are layered on purpose. The page suite mocks the store and the step screens and asserts orchestration; the chrome suite mocks the store and the validation module; the step suites mock their child sections; the API suites mock Prisma. A failure therefore points at one layer instead of "the wizard".

## Running these tests

Create Plan-only commands:

```bash
pnpm test:new-client           # all 13 suites (288 tests)
pnpm test:new-client:watch     # watch mode
pnpm test:new-client:coverage  # suite + V8 coverage
```

These are backed by [`vitest.new-client.config.mts`](../../vitest.new-client.config.mts) and [`scripts/tests/run-new-client-tests.mjs`](../../scripts/tests/run-new-client-tests.mjs), which list every suite explicitly so the command cannot pick up unrelated tests.

All tests:

```bash
pnpm test                 # whole unit suite
pnpm test:watch           # unit tests in watch mode
pnpm test:coverage        # unit tests + V8 coverage
pnpm test:e2e             # Playwright E2E
```

The Create Plan E2E file skips itself unless credentials are present:

```bash
E2E_BASE_URL=http://localhost:3000 \
E2E_EMAIL=advisor@example.com \
E2E_PASSWORD=... \
E2E_DRAFT_NAME="Acme Corp" \
E2E_ALLOW_CREATE=1 \
pnpm test:e2e
```

`E2E_ALLOW_CREATE=1` is required for the journey that actually writes a draft, so a normal run never leaves data behind. `E2E_DRAFT_NAME` gates the resume journey.

## Test inventory

| #   | Suite                                                                               | Tests | Focus                                                                                                           |
| --- | ----------------------------------------------------------------------------------- | ----: | --------------------------------------------------------------------------------------------------------------- |
| 1   | `app/(dashboard)/new-client/__tests__/page.test.tsx`                                |    50 | Page orchestration: init/resume, Save Draft, Complete, autosave, leave guard, step wiring                       |
| 2   | `components/wizard/__tests__/new-client-wizard.test.tsx`                            |    19 | Footer bar, step-3 gates, validation error UX, duplicate-name dialog, comment surface                           |
| 3   | `components/wizard/new-client-steps/__tests__/step-1-company-basics.test.tsx`       |     7 | Plan type, company-name → portal slug, manual-edit latch, website normalisation, pre-Next flush                 |
| 4   | `components/wizard/new-client-steps/__tests__/step-3-key-contacts.test.tsx`         |    11 | Slide routing (prompt → form → categories → preview), persisted transitions, backward-only dots, invite refresh |
| 5   | `components/wizard/new-client-steps/__tests__/step-4-compliance-documents.test.tsx` |     9 | Server document load, Skip for now, upload→list switch, delete confirmation, category persistence               |
| 6   | `components/wizard/new-client-steps/__tests__/step-5-disclaimer.test.tsx`           |     7 | Disclaimer source priority, default seed, debounced inline save, footer background                              |
| 7   | `components/wizard/new-client-steps/sections/utils/__tests__/utils.test.ts`         |    25 | Hero/thumbnail auto-crops, brand-image conversions, R2 URL resolution, full-resolution export                   |
| 8   | `lib/__tests__/new-client-wizard-resume.test.ts`                                    |    34 | Snapshot ownership, pending pointer, `lookupDraft` three-state answer, saved-at formatting                      |
| 9   | `lib/__tests__/new-client-wizard-validation-v2.test.ts`                             |    52 | Per-step validation, error fields/messages, step-3b contact rules, plan category limits, portal visibility      |
| 10  | `lib/__tests__/new-client-wizard-store.test.ts`                                     |    20 | `enqueueDraftSave` serialization, transition flag, `getCompanyBasicsSubStep`, `saveAsDraft` duplicate/retry     |
| 11  | `app/api/new-client-wizard/save-draft/__tests__/route.test.ts`                      |    20 | Draft persistence contract: sub-record upserts, client create/update, duplicate names, documents                |
| 12  | `app/api/new-client-wizard/__tests__/session-lifecycle.test.ts`                     |    29 | Session GET/POST/PUT, `load-draft` transforms, `list-drafts`, `delete-draft`, `cleanup`                         |
| 13  | `app/api/new-client-wizard/complete-v2/__tests__/route.test.ts`                     |     5 | Publish guards: auth, missing session/data, session reopen after a failed publish                               |
| 14  | `e2e/new-client.spec.ts`                                                            |     4 | Step-1 shell, portal-slug derivation, opt-in Save Draft → All Plans, resume dialog                              |

## Unit test inventory

### 1. Page orchestration (50)

- **Shell / initialization:** title, loading spinner, session gate, foreign-snapshot discard, fresh-session path, local-typing preservation, init errors
- **Draft detection:** hand-off pointer `missing`/`exists`/`unknown`, snapshot `exists`/`missing`/`unknown`
- **Resume actions:** Continue honours `?step=` or the saved step, recovers a missing `draftClientId`, Create-a-new-plan keeps the server draft
- **Save Draft:** missing name guard, success toast + `/clients`, busy state, duplicate silence, generic failure
- **Complete Setup:** publish toast + navigation, **Saving Your Plan** overlay, failure handling
- **Autosave:** 3 s debounce payload, `clientId` capture, transition skip, duplicate/error/throw handling, resumed-draft baseline
- **Leave guard:** clean/dirty, saved snapshot, Save-and-exit, Discard delete + reset, failed discard, 404 tolerance

### 2. Wizard chrome (19)

- Previous disabled on the first step; Save Draft hidden without a handler, disabled without data, busy label
- Next runs validation → `nextStep` → `clearErrorFields` → `onNext`; step-1 pre-save marker and background save
- Invalid validation: `setErrorFields`, mapped field labels in the toast, delayed field focus
- Dedicated toasts for a missing primary contact and a Contact Form CTA without an email
- Step-3b errors grouped per contact; Next stays enabled on step-3 slides (the slide flow delegates), Save Contact gated by a reachable method
- Complete Setup path, no double-complete while loading, duplicate-name dialog actions, duplicate rejection swallowed
- Step-4 background compliance + draft save; comment surface only once a draft id exists

### 3. Step 1 — company basics (7)

- Plan type radios and company fields render
- Choosing Prospect persists `planType`
- Company name derives `portalUrl` until the user edits the URL by hand
- Website blur strips the scheme (`https://www.acme.com` → `www.acme.com`)
- `window.__step1FlushFormToStore` persists the live form and is removed on unmount
- UI-only colour-picker state is never persisted

### 4. Step 3 — key contacts (11)

- New plan opens the first-contact prompt and syncs the store index
- "I am the main contact" seeds an empty form with the Plan Sponsor category; "Someone else" starts a free form
- Form continue clears the legacy `step3a` category and opens the explorer
- Category select resets `step3b` and returns to the form with that category
- Explorer continue → preview → back; Back from the explorer edits an existing main contact or returns to the prompt
- Existing main contact resumes on the explorer
- Dots only navigate backwards
- Inviting a collaborator opens the dialog and bumps the explorer's refresh key

### 5. Step 4 — compliance documents (9)

- New plan renders the tabs and does not call the document APIs
- Existing plan loads both APIs and converts server rows
- Skip for now advances and marks the step complete; invalid validation focuses the fields; thrown skip re-enables the button
- An upload switches to the list tab
- Delete asks first, then removes the R2 object and the row
- A category change persists locally, PATCHes a saved document, and skips PATCH for an unsaved one

### 6. Step 5 — footer disclosure (7)

- Seeded profile disclaimer wins on mount and is persisted with Home Page scope
- A saved draft disclaimer is shown without fetching the profile
- Onboarding disclaimer is inherited when the plan and profile have none
- Platform default is seeded when every source is empty
- Inline edit saves locally immediately and to the server after the 600 ms debounce
- Custom mode and footer background choices are applied/persisted

### 7. Brand-image utilities (25)

- 1920×1080 hero constants; logo ↔ brand-image conversion including transparency detection and crop originals
- Hero auto-crop exports 580×240; thumbnail auto-crop exports 900×1000
- `resolveBrandImageUrl` passes loadable URLs through and proxies R2 keys (BOM/leading slash normalised)
- Full-resolution export re-encodes JPEG at original dimensions

### 8. Resume helpers (34)

- Owner sentinel round-trip, no-op for a missing id, storage-failure tolerance
- `clearWizardBrowserState` clears snapshot, timestamp, owner and hand-off pointer
- `wizardBlobBelongsTo` refuses no blob, no owner, foreign owner and no user
- `lookupDraft`: `ok → exists`, `404 → missing`, `401/403/500/throw → unknown`
- Saved-at formatting/fallbacks, `hasMeaningfulLocalWork` per field group

### 9. Validation v2 (52)

- `validateCompanyBasics` / `validateWelcomeStatement` / `validateKeyContacts` / `validateComplianceDocuments` unit rules
- Step 1 required fields, website format, colours; step 2 mission length, hero image, stored welcome copy
- Step 3a/3c category rules, step-3b contact form rules (names, title, email/phone, CTAs, hub documents), slide-mode skip, 1–4 category limits
- Step 4 document categorisation; step 5 all-hidden portal refusal; unknown step mapping

### 10. Store internals (20)

- `getCompanyBasicsSubStep` shapes; transition flag toggling
- `enqueueDraftSave` runs one save at a time, in order, and recovers after a failure
- `saveAsDraft` payload cleanup, client-id capture, existing id preservation, duplicate dialog/suppression, missing-session retry, error messages, concurrent serialization

### 11. `POST /save-draft` (20)

- 401 / 400 malformed JSON / 400 missing stepData / 404 no session
- Session sub-record upserts (company basics gating, welcome mirror without advisor fields, contacts, contact builder, compliance, preview merge + disclaimers)
- Client create with trimmed name, Draft status, brand image legacy mirrors, logo removal, contact-builder merge, mission fallback, org stamp + contact mirroring
- Update by `clientId` (no create, no org fetch), duplicate published/draft names, same-name fallback, document replacement
- R2 vs legacy document creation, data-URL prefixing, empty payload skip, invalid expiration, 500 details

### 12. Session lifecycle (29)

- `session`: GET auth/session includes/500; POST reuse/create/500; PUT auth/404/update/500
- `load-draft`: auth, no-draft, hero-title default, stored headline, `step3SubStep` extraction, preview flattening + disclaimers, contact seeding upsert, 500
- `list-drafts`: auth, newest-first contract, 500
- `delete-draft`: auth, no-op, full transactional cleanup, 500
- `cleanup`: auth, completed + stale counts, 500

### 13. `complete-v2` guards (5)

- 401 / 404 / 400 naming the missing records
- Sibling incomplete sessions are closed in parallel
- A failed publish reopens the session and returns `Failed to create client` with the error detail

## Running the page

```bash
pnpm dev
```

1. Sign in as an advisor.
2. Open `/new-client` (dashboard **Create Plan**).
3. Confirm the page title is **Create Plan** and the wizard renders step 1.
4. To exercise the resume dialog, start a draft, leave, then return to `/new-client` (or open it from **All Plans → Finish Setup**).

The endpoints the page calls:

```bash
POST /api/new-client-wizard/save-draft    # autosave + Save Draft (through the store)
GET  /api/new-client-wizard/session       # active session + sub-records
POST /api/new-client-wizard/session       # open a session (retry path)
PUT  /api/new-client-wizard/session       # persist currentStep
GET  /api/new-client-wizard/load-draft    # hydrate step data from a draft
GET  /api/new-client-wizard/list-drafts   # draft plans for the picker
DELETE /api/new-client-wizard/delete-draft# discard the wizard draft
POST /api/new-client-wizard/complete-v2   # publish the plan
GET  /api/clients/:id                     # draft verification + saved-at
DELETE /api/clients/:id                   # "Discard without saving"
GET  /api/clients?status=Draft&search=…   # recover a missing draftClientId
```

## Test data

Prepare these before running the manual checklist:

- an advisor with a saved **Draft** plan visible in **All Plans**;
- a second browser profile (or a cleared snapshot) to exercise a snapshot owned by another user;
- a draft whose server row has been deleted while the browser snapshot remains;
- a company name that already exists as a plan (duplicate-name path);
- a company name long enough to make the resume dialog wrap.

## Manual test checklist

### 1. Shell and initialization

- [ ] The page title is **Create Plan**.
- [ ] **Loading your plan...** shows while the session and snapshot resolve; the wizard never flashes first.
- [ ] A signed-out visitor is redirected to sign-in rather than initializing the wizard.
- [ ] A snapshot written by a different user is discarded before rehydration (no inherited company name, contacts or images).
- [ ] With no draft and no local typing, the page opens a fresh session and step 1.

### 2. Step 1 — company basics

- [ ] Choosing Client or Prospect persists the plan type.
- [ ] Typing a company name fills the Portal URL with a slug; editing the URL by hand stops further updates.
- [ ] The website field strips the scheme on blur and keeps `www.`.
- [ ] Missing company name, portal URL or brand colours block Next with a field-specific toast.
- [ ] The pre-Next flush (`__step1FlushFormToStore`) means returning from a later step still validates the visible values.

### 3. Step 2 — welcome and mission

- [ ] Mission headline (≤60 chars) and body (250–2000 chars) are enforced.
- [ ] A hero banner image is required.
- [ ] Next saves in the background and does not stall on the editor close animation.

### 4. Step 3 — key contacts

- [ ] A new plan opens the first-contact prompt; "I am the main contact" and "Someone else" both lead to the form.
- [ ] The contact form requires first/last name, title, and an email or phone; CTAs require their URL/email.
- [ ] The explorer allows adding/editing contacts, invites a collaborator, and shows a pending invite after sending.
- [ ] Preview → Back returns to the explorer; Back from the explorer edits the main contact when one exists.
- [ ] A plan cannot leave step 3 with more than four benefit categories, nor with complete contacts that have none.

### 5. Step 4 — compliance documents

- [ ] A new plan shows the upload tab without loading server documents; a resumed plan loads both document APIs.
- [ ] Uploading a document switches to the list tab.
- [ ] Deleting asks first, removes the R2 object, and updates the draft.
- [ ] Categorising a saved document PATCHes it; an unsaved document is only updated locally.
- [ ] **Skip for now** advances and toasts that documents can be added later.

### 6. Step 5 — footer disclosure

- [ ] A saved plan disclaimer is shown; otherwise the profile disclaimer, then the onboarding text, then the platform default.
- [ ] Inline edits persist locally at once and to the server after the debounce.
- [ ] Default/Custom mode and the footer background choice persist.
- [ ] Finishing with every portal category hidden is refused during validation.

### 7. Save Draft

- [ ] With neither a company name nor a plan type, Save Draft explains what is missing.
- [ ] Otherwise it saves, toasts **Draft saved**, and returns to All Plans with the draft listed.
- [ ] The button shows its busy state and blocks a double submit.
- [ ] A duplicate name opens the duplicate-plan dialog instead of an error toast.

### 8. Complete Setup

- [ ] Publishing shows the **Saving Your Plan** overlay and disables the leave guard.
- [ ] Success toasts **Plan published** and lands on All Plans with the new plan visible.
- [ ] A failure reopens the wizard session (retry is possible) and toasts the reason.

### 9. Autosave

- [ ] Typing a company name creates/updates a Draft row roughly 3 s after the last edit.
- [ ] A resumed draft is not re-saved until it is edited.
- [ ] Autosave never stacks a request on top of Save Draft / Next / Complete.

### 10. Leave guard

- [ ] Editing and leaving asks Save and exit / Discard / Stay.
- [ ] **Discard without saving** deletes the draft row and starts a clean plan.
- [ ] Resuming a draft and leaving without edits does not prompt.

### 11. API contract checks

| Check                                    | Expected                                                                                           |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `POST /save-draft` without a session     | `401`                                                                                              |
| `POST /save-draft` with no `stepData`    | `400 Missing step data`                                                                            |
| `POST /save-draft` without a session row | `404 No active wizard session found`                                                               |
| Duplicate plan name                      | `200` + `{ success: false, code: "DUPLICATE_PLAN_NAME", existingClientId, companyName }`           |
| `DELETE /delete-draft`                   | Removes the session sub-records, the session and the caller's Draft clients                        |
| `POST /complete-v2` with missing data    | `400 Missing required wizard data` naming the missing records                                      |
| `POST /complete-v2` publish failure      | `500` and the session is reopened (`completed: false`) only when no plan row was created           |
| `GET /load-draft` with a legacy session  | `step3SubStep` is lifted out of `keyContacts` and `employeePortalPreview.previewData` is flattened |

## Known gaps

These are observations from the current implementation, not release blockers unless the product decides otherwise:

1. **`delete-draft` is broader than its name.** The transaction calls `client.deleteMany({ userId, status: "Draft" })`, so discarding one wizard draft deletes **every** draft the user owns, not just the one being edited. The lifecycle suite pins the current behaviour; the product has to decide whether that is intended.
2. **Publish has no visibility gate by design.** `complete-v2` intentionally does not refuse an all-hidden portal; the Benefits wizard publishes hubs explicitly. Step-5 validation still refuses all-hidden, so the two layers disagree.
3. **Step 3's Next is never disabled by contacts.** The footer button stays enabled on step-3 slides and the slide flow validates; only the contact-form slide is gated (by a reachable method).
4. **`www.` is preserved.** `normalizeCleanDomain` strips the scheme but not `www.`, so `https://www.acme.com` is stored as `www.acme.com`.
5. **`save-draft` keeps the contact builder out of the session record.** The builder contact is merged into the Draft client row only; the wizard-session `keyContacts` row keeps the raw list until the client is created.
6. **Legacy validation module is dead code.** `lib/new-client-wizard-validation.ts` has no importers (only `-v2` is used); it should be removed rather than tested.
7. **Complete-v2's success path is only covered manually.** The unit suite covers the guards and the failed-publish reopen; slug/R2/benefit creation are exercised by the E2E draft journey and the manual checklist.

## Future coverage

- a `complete-v2` success-path unit suite once slug/R2/benefit creation is extracted into testable helpers;
- the upload routes (`company-basics`, `key-contacts`, `compliance-documents`, `optional-documents`) — currently only `save-draft`, the session routes and `complete-v2` are unit-tested;
- the real onboarding-profile seeding inside `load-draft` (the merge is mocked here);
- a publish E2E that completes all five steps against seeded data and checks the portal.

## Related documentation

- [`docs/testing/clients-tests.md`](clients-tests.md) — the All Plans table the draft appears in.
- [`docs/testing/onboarding-tests.md`](onboarding-tests.md) — the advisor onboarding wizard, which shares store/draft patterns.
- [`docs/testing/settings-test.md`](settings-test.md) — the reference format for a page-level suite.
