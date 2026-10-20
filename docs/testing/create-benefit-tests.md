# Create Benefit Testing

This document is the test inventory for [`app/(dashboard)/new-benefits/page.tsx`](<../../app/(dashboard)/new-benefits/page.tsx:68>), the Create Benefit wizard page.

It covers the page's orchestration around the wizard: deep-link hydration, step validation, Previous/leave prompts, Cancel and row purge, publishing attestation and save, the organization-logo sync, the header/comment surface, and the leave guard.

## Summary

- **Unit tests:** 103 passing in 1 file.
- **Scoped scripts:** `pnpm test:create-benefit`, `pnpm test:create-benefit:watch`, `pnpm test:create-benefit:coverage`.
- **E2E:** none dedicated; the page is not yet in a Playwright spec.
- **Runner:** Vitest + React Testing Library + jsdom.

The page is mostly orchestration, so the suite mocks the wizard store, the five step screens, the wizard chrome, the three dialogs, the leave guard, `saveBenefit`, `purgeDraftBenefit`, `fetchProfileOnce`, and the comment surface. The assertions therefore target the page's own decisions rather than the internals of the steps.

## Running these tests

```bash
pnpm test:create-benefit           # the Create Benefit suite (103 tests)
pnpm test:create-benefit:watch     # watch mode
pnpm test:create-benefit:coverage  # suite + V8 coverage
```

These are backed by [`vitest.create-benefit.config.mts`](../../vitest.create-benefit.config.mts) and [`scripts/tests/run-create-benefit-tests.mjs`](../../scripts/tests/run-create-benefit-tests.mjs).

All tests:

```bash
pnpm test                 # whole unit suite
pnpm test:watch           # unit tests in watch mode
pnpm test:coverage        # unit tests + V8 coverage
pnpm test:e2e             # Playwright E2E
```

## Test inventory

| #   | Group                     | Tests | Focus                                                                                                   |
| --- | ------------------------- | ----: | ------------------------------------------------------------------------------------------------------- |
| 1   | Shell                     |    17 | Title, step rendering, picker visibility, footer flags, subtitle, comment surface, scroll reset         |
| 2   | Deep-link initialization  |     8 | Rehydrate-first, URL plan/category, Custom blank name, plan-only clear, resume, empty reset, guard gate |
| 3   | Step validation           |     8 | Step 1/2 field lists and editor events, Step 3 contact requirement, unconditional Steps 4–5             |
| 4   | Previous and leave prompt |     5 | In-wizard back, clean exit, dirty prompt, save-and-exit, discard draft                                  |
| 5   | Cancel                    |     5 | Confirm dialog, session-created purge, pre-existing benefit, failed purge, no-target skip               |
| 6   | Publish                   |     5 | Attestation gate, success/complete/leave, save failure, thrown request, missing plan                    |
| 7   | Organization-logo sync    |     6 | Changed logo, Custom/Other primary match, non-primary, same snapshot, no target, profile failure        |
| 8   | Leave guard               |     1 | Dirty state and the no-op save handler                                                                  |
| 9   | Rehydration failures      |     2 | Rejected hydration still starts the page and still applies a deep link                                  |
| 10  | Deep-link edge cases      |     9 | URL decoding, category-only/empty plan, resume matching, loaded-category dedupe, re-apply timers        |
| 11  | Header/comment edge cases |     6 | Lowercase Custom, whitespace/literal placeholders, later store selection, URL category fallback         |
| 12  | Validation edge cases     |     9 | Single-field reports, event fallbacks, missing/null/empty/disabled contacts, one enabled contact        |
| 13  | Leave/cancel edge cases   |     7 | Draft kept on clean Previous, Previous never purges, Stay, dialog contracts, cancelling state           |
| 14  | Publish edge cases        |     7 | Attestation close, delayed leave, timer cleanup, Benefit fallback, 5s error, undefined result           |
| 15  | Org-logo edge cases       |     8 | advisorLogo/session fallback, whitespace/non-array skip, case matching, row snapshot, unmount cancel    |

## Unit test inventory

### `app/(dashboard)/new-benefits/__tests__/page.test.tsx`

**Shell**

- sets the page title to **Create Benefits**
- renders the step matching `currentStep` (each of 1–5)
- pins the Step 1 category picker only when the URL carries `category`
- keeps the picker for a plan-only deep link
- passes `isFirstStep`, `isLastStep`, `isLoading` and `isCancelling` to the wizard
- shows `Plan - Category` in the subtitle
- uses the Custom benefit's saved name in the subtitle
- suppresses the storage label as a Custom name
- clears the subtitle when no plan is selected
- registers the comment surface from the live Step 1 plan/category
- falls back to URL params for the comment surface
- canonicalizes `Custom` to `Company / Plan Sponsor` for comments
- registers no surface without a plan or category
- scrolls to the top when `currentStep` changes

**Deep-link initialization**

- rehydrates before applying `planId` + `category`
- persists the plan selection under the `benefits` module
- starts a `Custom` deep link with a blank custom name
- starts a `Company / Plan Sponsor` deep link with a blank custom name
- clears category, title, contact and logo for a plan-only deep link
- resumes a matching draft without overwriting its title or logo, and marks the category as loaded
- resets the wizard only when the rehydrated store is empty
- keeps a persisted draft when there is no deep link
- keeps the leave guard disabled until hydration completes

**Step validation**

- Step 1 collects every missing required field and calls the registered scroll handler
- Step 1 advances with `completeStep(1)` + `nextStep()`
- Step 2 collects `companyLogo`, `brandImages.header`, `benefitTitle`, `shortDescription` and `insuranceLoginUrl`
- Step 2 opens the editor fallback and blocks advancement
- Step 2 advances when complete
- Step 3 blocks without an enabled support contact
- Step 3 advances with an enabled contact
- Steps 4 and 5 advance unconditionally

**Previous and leave prompt**

- Previous inside the wizard calls `previousStep()`
- a clean Step 1 Previous leaves without a prompt
- a dirty Step 1 Previous opens the dedicated leave prompt
- **Save and exit** leaves without discarding
- **Discard without saving** clears the persisted draft and leaves

**Cancel**

- Cancel opens the **Discard this benefit?** dialog without purging
- confirming purges the row only when `sessionCreatedBenefitRow` says this session created it
- a pre-existing benefit is never purged
- a failed purge reports **Could not fully discard the benefit** and still lets the advisor leave
- no plan/category skips the purge entirely
- the persisted draft is removed on every confirmed cancel

**Publish**

- **Complete** opens the Publishing Attestation dialog before saving
- confirming calls `saveBenefit(stepData)`, toasts `${category} benefits created successfully!`, completes the step, rewinds to Step 1 and leaves
- `{ success: false }` reports the error and stays on the page
- a thrown request reports the error and stays on the page
- a missing `planId` reports **Plan ID missing. Cannot complete setup.** and never saves

**Organization-logo sync**

- copies a changed `advisorLogoUrl` into `companyLogo`, `orgLogoSnapshot` and the read-once Benefit row
- treats a primary `Other` category as matching the Custom hub
- leaves a non-primary category untouched
- does nothing when the snapshot already matches
- does nothing without a selected plan/category
- ignores a profile request failure

**Leave guard**

- passes the page's dirty state and a no-op `onSaveAndExit` to `useNavigateAwayGuard`

**Rehydration failures**

- a rejected `rehydrate()` still clears initial loading, resets an empty wizard and enables the guard
- a rejected `rehydrate()` still applies the URL's plan/category

**Deep-link edge cases**

- decodes `+` and `%20` in the category
- ignores a category without a plan
- treats `planId=` as no deep link
- resumes a draft with case/whitespace differences
- does not resume a draft for another plan
- does not resume a draft for another category
- de-duplicates `benefitFieldsLoadedCategories` on resume
- re-applies the URL after a late store write
- clears the re-apply timers on unmount

**Header/comment edge cases**

- lowercases the `custom` hub for the subtitle
- treats a whitespace custom name as empty
- treats the literal **Custom** label as a placeholder
- lets a later store selection win over the entry URL
- uses the URL category when the store has only a plan
- canonicalizes uppercase **CUSTOM** for comments

**Validation edge cases**

- reports only the missing short description
- reports only a whitespace benefit title
- falls back to the Step 1 validation event
- reports only the missing insurance login URL on Step 2
- falls back to the Step 2 editor event
- blocks Step 3 for undefined, null and empty contact lists
- advances when one of several contacts is enabled

**Leave/cancel edge cases**

- a clean Step 1 leaves with the persisted draft intact
- Step 1 Previous discards the draft but never purges a row
- **Stay and keep editing** closes the prompt and keeps the draft
- wires the leave guard's dialog callbacks
- passes the destructive Cancel dialog contract
- shows `isCancelling` while the purge is in flight
- reports a thrown session-created check and still leaves

**Publish edge cases**

- closes the attestation without saving
- does not leave before the 1.5s delay
- clears the success delay on unmount
- falls back to **Benefit** in the success toast
- uses a 5s error toast
- treats an undefined save result as a failure
- disables the leave guard while publishing

**Organization-logo edge cases**

- uses `advisorLogo` when `advisorLogoUrl` is absent
- falls back to the wizard session branding logo
- ignores a whitespace logo
- ignores a non-array primary-category list
- matches primary categories case- and whitespace-insensitively
- keeps an absent row snapshot absent
- only rewrites `partnerLogo` on an existing row
- does not write after unmounting before the profile resolves

## Manual checklist

### 1. Entry and deep links

- [ ] Opening `/new-benefits` with no draft starts a clean Step 1.
- [ ] Reopening with a persisted draft resumes at the saved step with its fields intact.
- [ ] `?planId=…&category=Retirement` preselects both and hides the category picker.
- [ ] `?planId=…` alone preselects the plan and keeps the category picker visible.
- [ ] `?planId=…&category=Custom` starts with a blank Custom Category Name.
- [ ] `?planId=…&category=Company / Plan Sponsor` also starts blank.
- [ ] A matching draft is resumed without losing a custom title or logo.
- [ ] The header subtitle reads `Plan - Category`, `Plan - Custom Name`, or just `Plan` for an unnamed Custom hub.
- [ ] The comment surface follows the live Step 1 selection, not only the URL.

### 2. Validation

- [ ] Step 1 blocks Next and scrolls to every missing field.
- [ ] Step 2 blocks Next without the provider logo, header image, headline, message or login URL.
- [ ] Step 3 blocks Next without an enabled support contact.
- [ ] Steps 4 and 5 always advance.
- [ ] The toast copy matches the fields that are actually missing.

### 3. Leaving and cancelling

- [ ] Previous on Step 1 with no work leaves for `/benefits` without a prompt.
- [ ] Previous on Step 1 with unsaved work opens **Leave this setup?**
- [ ] **Save and exit** keeps the draft; **Discard without saving** removes it.
- [ ] Cancel always opens **Discard this benefit?**
- [ ] Confirming Cancel removes the draft and, only for a row created in this session, the Benefit row.
- [ ] A pre-existing benefit opened in this wizard is never deleted by Cancel.
- [ ] A failed purge still navigates away and reports the failure.
- [ ] A sidebar navigation with unsaved work opens the leave guard.
- [ ] Cancel and Previous on Step 1 both return to `/benefits`.

### 4. Publishing

- [ ] Complete opens the attestation dialog; nothing is saved before confirmation.
- [ ] Both attestations must be checked before publishing.
- [ ] A successful save toasts, completes Step 5, rewinds the wizard to Step 1 and leaves for `/benefits`.
- [ ] A failed save reports the error and stays on Step 5.
- [ ] A missing plan id reports the error and does not call the save API.

### 5. Organization logo

- [ ] Changing Settings → Branding updates the benefit logo for a primary category.
- [ ] A non-primary category keeps its own logo.
- [ ] A deliberately chosen provider logo is not overwritten when the org logo has not changed.
- [ ] The read-once Benefit-row snapshot is updated alongside the draft, so Step 1 cannot re-read the old image.
- [ ] A profile request failure leaves the draft untouched.

## Known gaps

1. **Navigation is asserted through the leave guard state, not `location.assign`.** jsdom makes `window.location.assign` non-configurable, so the suite asserts that the guard is disabled after the page decides to leave. The destination string is covered by the source but not by a spy.
2. **The double-confirm window is not covered.** Calling the attestation `onConfirm` twice before `isLoading` re-renders is hard to drive through the dialog stub; the save handler itself has no re-entry guard.
3. **Whitespace `contactId` is not treated as missing.** The suite pins the current Step 1 behavior; if the product wants a trimmed contact id, the page and test both need updating.
4. **A profile logo arriving after user interaction** is not asserted against the internal baseline; only the draft write itself is covered.
5. **No E2E journey.** The real wizard, the real store rehydration, the attestation checkboxes and the document navigation are not exercised in a browser.

## Future coverage

### Unit cases to add

- rapid double-confirm on the attestation dialog, asserting one save request;
- a profile logo arriving after the user has started editing, asserting the baseline is not absorbed;
- localStorage `removeItem` throwing during Cancel and Step 1 Discard;
- a runtime `saveBenefit` that never settles (timeout/abort), asserting the footer unlocks;
- the Step 1 prompt's pointerdown discard-suppression path.

### E2E (Playwright)

A future `e2e/create-benefit.spec.ts` should cover:

- a fresh plan + category deep link through Steps 1–5;
- the attestation gate and successful publish landing on `/benefits`;
- Cancel removing a session-created benefit and its draft;
- resuming a persisted draft after a reload;
- the Step 1 leave prompt for both Save and Discard.

Mutating journeys should run against a disposable plan or be gated behind an explicit env flag.

## Related documentation

- [`docs/testing/benefits-tests.md`](benefits-tests.md) — Browse Benefits, which links into this wizard.
- [`docs/testing/edit-benefits-tests.md`](edit-benefits-tests.md) — the Edit Benefit route, editor and API.
- [`docs/testing/onboarding-tests.md`](onboarding-tests.md) — the shared wizard/step testing patterns.
- [`docs/testing/settings-test.md`](settings-test.md) — where the organization logo and primary categories are edited.
- [`docs/testing/testing.md`](testing.md) — the shared runner, conventions and inventory structure.
