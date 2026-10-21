# Onboarding Test Inventory

This document lists every automated test associated with the onboarding flow. It is generated from the Vitest JSON report and the Playwright spec.

## Summary

- **Unit tests:** 582 passing across 40 files
- **End-to-end tests:** 7 Playwright tests
- **Unit runner:** Vitest + React Testing Library + jsdom
- **E2E runner:** Playwright + Chromium

## Running the suites

Onboarding-only commands:

```bash
pnpm test:onboarding           # all 40 onboarding unit suites (582 tests)
pnpm test:onboarding:watch     # onboarding unit tests in watch mode
pnpm test:onboarding:coverage  # onboarding unit tests + V8 coverage
pnpm test:onboarding:e2e       # the 7 Playwright onboarding journeys
pnpm test:onboarding:all       # onboarding unit + E2E
```

These are backed by `vitest.onboarding.config.mts` and
`scripts/tests/run-onboarding-tests.mjs`.

All tests:

```bash
pnpm test                 # whole unit suite
pnpm test:watch           # unit tests in watch mode
pnpm test:coverage        # unit tests + V8 coverage
pnpm test:e2e:install     # install Chromium once
pnpm test:e2e             # Playwright E2E
pnpm test:e2e:ui          # Playwright UI mode
```

## End-to-end tests

File: `e2e/onboarding.spec.ts`

These require only an app: `E2E_BASE_URL`, or `E2E_START_SERVER=1` to let Playwright start `pnpm dev`. They skip cleanly when neither is set, and an all-skipped run exits 0.

**Self-provisioning.** `test.beforeAll` passes the Early Access gate, creates a unique user through `/signup` (`e2e+<stamp>@plantelligence.test`), and verifies Step 1 renders. `test.afterAll` signs in as that user and calls `DELETE /api/profile/delete?confirmOrganization=true`, the app's own cascade (plans, wizard sessions, organization, then the user). The spec does not read `E2E_EMAIL` / `E2E_PASSWORD`, so a stale shell value cannot reuse an old account. Set `E2E_KEEP_USER=1` to keep the account for inspection; its credentials are printed.

**Early Access gate.** [`InviteCodeProvider`](../../components/providers/invite-code-provider.tsx:15) blocks every page until the invite-code modal accepts the hardcoded code **`22222`**. The helper fills the five inputs and clicks **Enter Code**; two dedicated tests assert that a wrong code is rejected and that `22222` reveals the sign-in form. Because the provider renders only the modal (the app's Toaster is not mounted yet), [`InviteCodeModal`](../../components/modals/invite-code-modal.tsx:13) owns an inline `role="alert"` for the error in addition to its sonner toast.

**Serial wizard.** The three wizard journeys are `serial` and share the one provisioned account: the first two stage data, the last completes onboarding. If one fails, the rest are reported as "did not run". The account is deleted afterwards, so every run starts fresh.

**Cleanup scope.** The deletion cascade removes database rows. The Step 3 logo is uploaded to R2, which that cascade does not track, so the object may remain in the bucket.

```powershell
cd "C:\Users\eddie\OneDrive\Desktop\Upwork Projects\plantelligence-dev"
$env:E2E_START_SERVER = "1"
pnpm test:onboarding:e2e
```

- **onboarding authentication**
  - redirects an anonymous visitor to sign-in
  - rejects an incorrect Early Access code
  - accepts 22222 and reveals the sign-in form
- **onboarding on a phone**
  - shows the desktop-only notice instead of the wizard
- **onboarding wizard** (serial)
  - blocks Next on an empty Step 1, then accepts the same form once filled
  - guards in-app navigation while there are unsaved changes
  - completes the full flow and reaches the dashboard

See [`testing.md`](testing.md) for conventions and the mocking strategy.

---

| #   | Suite                                                                               | Tests | Focus                                                                                           |
| --- | ----------------------------------------------------------------------------------- | ----: | ----------------------------------------------------------------------------------------------- |
| 1   | `app/(dashboard)/onboarding/__tests__/page.test.tsx`                                |    17 | Route shell: loading, status redirect, step rendering, leave-guard wiring, resume email         |
| 2   | `components/wizard/steps/__tests__/step-1-user-profile.test.tsx`                    |     6 | Step 1 orchestration: team-size reveal, prefill/normalization, error propagation                |
| 3   | `components/wizard/steps/__tests__/step-2-services.test.tsx`                        |     9 | Step 2 orchestration: server load, service saves, insurance flag, failure handling              |
| 4   | `components/wizard/steps/__tests__/step-3-branding.test.tsx`                        |    11 | Step 3 orchestration: branding/client-profile saves, previews, background upload/removal        |
| 5   | `components/wizard/steps/__tests__/step-4-user-setup.test.tsx`                      |     8 | Step 4 orchestration: server/session fallbacks, immediate saves, blur validation, unmount flush |
| 6   | `components/wizard/steps/__tests__/step-5-onboarding.test.tsx`                      |     9 | Step 5 sub-stepper: solo vs. team gating, navigation, validity forwarding                       |
| 7   | `components/wizard/steps/__tests__/step-5a-summary.test.tsx`                        |     6 | 5a Review: values, edit entry points, summary payload mapping                                   |
| 8   | `components/wizard/steps/__tests__/step-5b-disclosures.test.tsx`                    |     8 | 5b Disclosures: intro/editor, skip attestation, recommended/custom saves, limits                |
| 9   | `components/wizard/steps/__tests__/step-5c-team.test.tsx`                           |    14 | 5c Team: seat cap, row edits, email validation, duplicate/self checks, roles                    |
| 10  | `components/wizard/steps/__tests__/user-profile-section.test.tsx`                   |    10 | Real organization picker: saves, Other description, errors, blur                                |
| 11  | `components/wizard/steps/__tests__/team-size-section.test.tsx`                      |     8 | Real team-size picker: saves, errors, blur                                                      |
| 12  | `components/wizard/steps/__tests__/services-section.test.tsx`                       |     9 | Real service categories: mapping, toggle fallback, Other input, limits                          |
| 13  | `components/wizard/steps/__tests__/user-setup-section.test.tsx`                     |    14 | Real user form: field blur, phone formatting, contact toggle, designations, headshot            |
| 14  | `components/wizard/steps/__tests__/branding-setup-card.test.tsx`                    |    10 | Real branding card: name/website, logo upload, color extraction, background removal             |
| 15  | `components/wizard/steps/__tests__/brand-colors-section.test.tsx`                   |     9 | Real color controls: edits, swap, extraction availability, errors                               |
| 16  | `components/wizard/steps/__tests__/brand-images-section.test.tsx`                   |     3 | Real image slots: rendering and visibleSlots filtering                                          |
| 17  | `components/wizard/steps/__tests__/summary-edit-modal.test.tsx`                     |     6 | Summary edit modal: normalized payload, tab edits, cancel                                       |
| 18  | `components/wizard/steps/__tests__/attestation-modals.test.tsx`                     |     7 | Attestation dialogs: gating, confirm, back, reset                                               |
| 19  | `components/wizard/__tests__/wizard.test.tsx`                                       |    25 | Wizard shell: next/previous, saves, Step 5 routing, invites, completion, labels                 |
| 20  | `lib/__tests__/wizard-validation.test.ts`                                           |    40 | Schemas and validateCurrentStep field mapping                                                   |
| 21  | `lib/__tests__/onboarding-wizard-store.test.ts`                                     |    46 | Store state machine, persistence, validation actions, summary saves                             |
| 22  | `lib/__tests__/onboarding-wizard-dirty.test.ts`                                     |     8 | Dirty-state detection                                                                           |
| 23  | `hooks/__tests__/use-navigate-away-guard.test.tsx`                                  |    17 | Leave guard: beforeunload, link interception, popstate, save/discard/stay                       |
| 24  | `components/ui/__tests__/navigate-away-warning-dialog.test.tsx`                     |    11 | Warning dialog: actions, two-step discard, loading, Escape                                      |
| 25  | `hooks/__tests__/useOnboardingResumeEmail.test.tsx`                                 |     9 | Resume email: throttle, storage failures, response handling                                     |
| 26  | `components/__tests__/desktop-only-gate.test.tsx`                                   |     6 | Desktop gate: desktop/mobile rendering and block callbacks                                      |
| 27  | `hooks/__tests__/useWizardInit.test.tsx`                                            |     3 | Wizard initialization: load, error reset, idempotence                                           |
| 28  | `hooks/__tests__/use-scroll-to-error-field.test.tsx`                                |     7 | Error scrolling: document order, blur exclusion, focus, cleanup                                 |
| 29  | `hooks/__tests__/useMediaQuery.test.tsx`                                            |     5 | Media query: match state, updates, SSR fallback, unsubscribe                                    |
| 30  | `app/api/onboarding-wizard/__tests__/routes.test.ts`                                |    71 | All 17 route handlers with mocked Prisma/auth/email/tokens                                      |
| 31  | `components/wizard/__tests__/new-client-wizard.test.tsx`                            |    19 | New-client wizard chrome: step labels, next/previous, validation blocking                       |
| 32  | `components/wizard/new-client-steps/__tests__/step-1-company-basics.test.tsx`       |     7 | Plan type, company fields, portal-slug derivation, website normalization                        |
| 33  | `components/wizard/new-client-steps/__tests__/step-3-key-contacts.test.tsx`         |    11 | Key-contact routing: main contact, explorer, preview, back prompts                              |
| 34  | `components/wizard/new-client-steps/__tests__/step-4-compliance-documents.test.tsx` |     9 | Documents tabs, skip validation, delete confirmation, R2 cleanup                                |
| 35  | `components/wizard/new-client-steps/__tests__/step-5-disclaimer.test.tsx`           |     7 | Disclaimer seeding, inheritance, inline save, footer background                                 |
| 36  | `components/wizard/new-client-steps/sections/utils/__tests__/utils.test.ts`         |    25 | Wizard section utilities                                                                        |
| 37  | `components/wizard/benefits-steps/__tests__/step-1.test.tsx`                        |    18 | Shared benefit Step 1 (also covered by the Create Benefit suite)                                |
| 38  | `components/wizard/benefits-steps/__tests__/step-3.test.tsx`                        |    32 | Shared benefit Step 3: contacts, collaborators, FAQs                                            |
| 39  | `components/wizard/benefits-steps/__tests__/step-4.test.tsx`                        |    23 | Shared benefit Step 4: documents                                                                |
| 40  | `components/wizard/benefits-steps/__tests__/step-5.test.tsx`                        |    19 | Shared benefit Step 5: footer disclosures                                                       |

## Unit tests

### `app/(dashboard)/onboarding/__tests__/page.test.tsx`

**OnboardingPage**

- shows the loading screen before the wizard initializes
- shows the loading screen while the onboarding status is being checked
- redirects to the dashboard when onboarding is already complete
- renders the wizard after initialization and an incomplete status check
- skips the status request and still renders when there is no signed-in user
- renders step 1 of the wizard
- renders step 2 of the wizard
- renders step 3 of the wizard
- renders step 4 of the wizard
- renders step 5 of the wizard
- falls back to step 1 for an unknown step number
- passes the Step 5 validation result up to the wizard
- enables the leave guard and saves summary data on save-and-exit
- requests a resume email when the desktop gate blocks small screens
- reflects the leave-guard dialog state in the warning dialog
- renders the wizard when the status request fails
- renders the wizard when the status request throws

### `components/wizard/steps/__tests__/step-1-user-profile.test.tsx`

**Step1UserProfile**

- renders the profile section and hides team size until an organization type is chosen
- reveals the team size section after an organization type is selected
- prefills the form from stored step data
- normalizes legacy organization type and team size ids
- passes error fields to both sections
- resyncs the form when the store receives newer step data

### `components/wizard/steps/__tests__/step-2-services.test.tsx`

**Step2Services**

- seeds the section from stored services, custom service, and licenses
- loads services from the server when the store has none
- does not reload services when the store already has a selection
- saves a non-insurance selection and resets the insurance flag
- marks the organization as offering insurance for health services
- clears custom service text when Other is deselected
- keeps the custom service text when Other remains selected
- persists custom service edits with the current selection
- logs a failed services save without crashing

### `components/wizard/steps/__tests__/step-3-branding.test.tsx`

**Step3Branding**

- renders every branding surface and forwards error fields
- clears stale error fields when the step mounts
- seeds the default welcome statement with the organization name
- updates the welcome statement when the organization name changes
- mirrors organization name and website edits into client profile data
- persists background changes locally and to the server
- records a logo preview without extracting colors
- persists primary and secondary color choices as branding data
- deletes the stored background when the slot is cleared
- uploads a data-url background to R2 and persists the returned key
- clears the logo and persists the removal

### `components/wizard/steps/__tests__/step-4-user-setup.test.tsx`

**Step4UserSetup**

- loads server data, normalizes the phone, and resolves designations
- falls back to session data when the server has none
- falls back to session data when loading throws
- forwards error fields and clears stale errors on mount
- saves name edits immediately, then reloads the server copy
- validates a field on blur with the live form values
- batches headshot edits into a single server save
- flushes edited values when the step unmounts

### `components/wizard/steps/__tests__/step-5-onboarding.test.tsx`

**Step5Onboarding**

- shows only review and disclosures for a solo organization
- shows the team sub-step for organizations larger than one person
- returns to a completed sub-step without walking through the footer
- does not allow jumping to a future sub-step
- passes organization name, scope, errors, and the skip handler to 5b
- forwards 5b validity to the wizard
- renders 5c and forwards its validity when the team step applies
- falls back to disclosures when the team step does not apply
- omits the skip handler when the wizard does not provide one

### `components/wizard/steps/__tests__/step-5a-summary.test.tsx`

**Step5aSummary**

- loads every section's data when it mounts
- renders the stored review values
- opens each section in edit-from-review mode
- saves edited values as one summary payload
- logs a failed summary save
- renders placeholders for missing values

### `components/wizard/steps/__tests__/step-5b-disclosures.test.tsx`

**Step5bDisclosures**

- starts with the two-action intro and reports the step as invalid
- opens the disclosure editor from Add Now and reports the step as valid
- hands the skip action to the wizard when onSkipForNow is provided
- opens the skip attestation without a skip handler and persists recommended defaults on confirm
- persists the recommended copy when Use Default is selected
- debounces and persists custom disclosure text
- restores a saved custom disclosure and selects custom mode
- caps custom text at the section limit

### `components/wizard/steps/__tests__/step-5c-team.test.tsx`

**Step5cTeam**

- shows the seat meter and how many teammates can be invited
- adds invite rows on demand
- caps invite rows at the number of open seats
- blocks adding rows when no seats are open
- falls back to the default allowance when the seat request fails
- reports validity as rows become complete
- shows the missing-email error only after the email field is touched
- shows the missing-name error for a row with only an email
- rejects malformed email addresses
- rejects the owner's own email
- rejects duplicate emails across rows
- forces errors on every row when the wizard reports teamInvites
- removes a row
- updates the role for a staged invite

### `components/wizard/steps/__tests__/user-profile-section.test.tsx`

**UserProfileSection**

- renders every organization option and no custom field by default
- preselects a stored legacy organization type
- saves the selected type and clears its stale error
- reveals the description field for Other and persists its text
- clears custom text when switching away from Other
- does not autosave when disableAutoSave is set
- shows required-field errors
- validates the organization type on blur outside the radio group
- ignores blur moving between radios
- renders without the card heading when hideCard is set

### `components/wizard/steps/__tests__/team-size-section.test.tsx`

**TeamSizeSection**

- renders every band and the helper copy
- preselects the stored band
- saves the selected band
- does not autosave when disableAutoSave is set
- shows the required error
- validates the band on blur outside the group
- ignores blur moving between radios
- renders without the card heading when hideCard is set

### `components/wizard/steps/__tests__/services-section.test.tsx`

**ServicesSection**

- maps selected services to category values
- emits ServiceType values when categories change
- falls back to onServiceToggle when no bulk handler is provided
- toggles off services removed from the selection
- shows the custom field only when Other is selected
- counts and caps custom text at 50 characters
- validates services and the custom field on blur
- shows both required errors and marks the selector destructive
- renders without the card heading when hideCard is set

### `components/wizard/steps/__tests__/user-setup-section.test.tsx`

**UserSetupSection**

- renders the profile fields and defaults Save as Contact on
- reports name changes on blur
- persists title edits immediately and validates on blur
- persists the organization email on blur
- formats and normalizes the phone number
- toggles the Save as Contact preference
- renders the designations picker and live preview when relevant
- hides designations when hideDesignations is set
- shows designations for titles with no suggestions when alwaysShowDesignations is set
- persists designation selections and updates the preview
- forwards headshot changes and removals
- renders the settings-only email/password blocks in emailChangeMode
- shows the Google account block for Google accounts
- renders without the card copy when hideCard is set

### `components/wizard/steps/__tests__/branding-setup-card.test.tsx`

**BrandingSetupCard**

- renders the organization fields, logo, colors, and background
- emits organization name and website changes
- shows an inline error for a malformed website
- regenerates the default welcome statement on mount when it is stale
- saves logo changes, extracts colors, and reports the preview
- skips automatic color extraction when disabled
- removes the logo through R2 and notifies the parent
- saves background changes
- removes the background through R2
- hides colors and background when requested

### `components/wizard/steps/__tests__/brand-colors-section.test.tsx`

**BrandColorsSection**

- renders both colors and the swap action
- emits color edits
- swaps the two colors
- disables Extract Colors without a logo or website
- enables Extract Colors with a website
- enables Extract Colors with only a logo
- shows required errors when the colors are empty
- shows a hex-format error for invalid values
- does not show errors for untouched fields

### `components/wizard/steps/__tests__/brand-images-section.test.tsx`

**BrandImagesSection**

- renders every slot when no visibleSlots filter is supplied
- renders only the requested slots
- tells the upload slot whether an image is already present

### `components/wizard/steps/__tests__/summary-edit-modal.test.tsx`

**SummaryEditModal**

- renders nothing while closed
- renders the tabbed editor with the stored organization values
- saves the normalized edit payload
- edits the organization name before saving
- edits the user name before saving
- Cancel closes without saving

### `components/wizard/steps/__tests__/attestation-modals.test.tsx`

**AddNowAttestationModal**

- gates Continue on accepting the attestation
- Go Back closes the modal
- resets the attestation each time it reopens

**SkipAttestationModal**

- confirms the skip
- supports going back

**InviteLaterModal**

- confirms inviting later
- supports going back

### `components/wizard/__tests__/wizard.test.tsx`

**OnboardingWizard › rendering and step labels**

- renders the current step, title, and disables Previous on step 1
- uses the Step 5 sub-step title
- labels 5a as review
- labels 5b with confirm and skip actions
- labels 5c with the number of filled invites
- labels 5c as Finish when no invites are staged

**OnboardingWizard › steps 1-4 navigation**

- blocks advancement and reports the named fields when validation fails
- saves Step 1 client profile before team size, then advances
- aborts Step 1 when the client profile save fails
- saves Step 2 services and insurance together
- normalizes Step 4 DOM values before validating and saving
- saves and returns to Review when editing from Step 5a
- Previous in edit-from-review returns to Review without saving
- Previous on a normal step walks back

**OnboardingWizard › Step 5 routing**

- moves from 5a to 5b
- blocks 5b when the step is not valid
- opens the confirm attestation on a valid 5b and advances to 5c
- skipping 5b deletes the reviewed flag and advances to 5c
- the in-step skip action uses the same flow
- completes onboarding after a solo organization skips 5b

**OnboardingWizard › Step 5c invites**

- sends each filled invite, ignores blank rows, then completes
- aborts completion when an invite fails
- Invite Later confirms and completes without sending invites
- finishes immediately when there are no filled invites

**OnboardingWizard › external handlers**

- prefers externally supplied navigation handlers

### `lib/__tests__/wizard-validation.test.ts`

**wizard validation schemas › clientProfileSchema**

- accepts a known organization type
- requires a description when Other is selected
- accepts Other with a description

**wizard validation schemas › teamSizeSchema**

- accepts a current band
- rejects an unknown band

**wizard validation schemas › servicesSchema**

- requires at least one service
- caps selections at four
- requires custom text when Other is selected
- limits custom text to 50 characters
- accepts a valid selection

**wizard validation schemas › insuranceLicensingSchema**

- accepts a pass-through payload
- rejects an invalid license type
- rejects a license number with unsupported characters
- requires customType for an Other license

**wizard validation schemas › brandingSchema**

- accepts a domain without a protocol
- accepts a full https URL
- rejects a bare word as a website
- allows an empty website

**wizard validation schemas › userSetupSchema**

- accepts a complete profile
- accepts a formatted phone with a country code
- accepts an extension on the phone field
- rejects a phone shorter than seven digits
- requires the organization email separately from the login email

**wizard validation schemas › clientProfileSchema organization ids**

- accepts every current organization type

**validateCurrentStep**

- reports both required Step 1 fields when empty
- requires a description for an Other organization in Step 1
- normalizes legacy Step 1 ids before validating
- accepts a complete Step 1
- requires at least one service in Step 2
- requires custom text when Other is selected in Step 2
- accepts a valid Step 2 selection
- validates insurance licenses when the organization offers insurance
- reports every required Step 3 field when empty
- rejects an invalid hex brand color in Step 3
- accepts a complete Step 3
- reports missing Step 4 fields
- accepts a complete Step 4
- rejects an invalid Step 4 phone
- treats Step 5 as valid — its sub-screens own validation
- rejects an unknown step number

### `lib/__tests__/onboarding-wizard-store.test.ts`

**onboarding wizard store › step navigation**

- advances one step, clears errors, and persists the step
- does not advance past the last step
- entering Step 5 always resets the sub-step to review
- walks Step 5 backwards through its sub-steps before leaving
- does not go below step 1
- ignores out-of-range goToStep values
- jumps to a valid step and resets Step 5 to review
- marks a step complete

**onboarding wizard store › review edit mode**

- opens steps 1-4 in edit-from-review mode
- ignores steps outside 1-4
- returns to Review and clears edit mode

**onboarding wizard store › error fields**

- stores errors and their source
- clears one field without touching the rest
- clears all errors and the source
- a sub-step change clears stale errors

**onboarding wizard store › saveStepData**

- merges data locally without calling the server when saveToServer is false
- merges locally and posts to the matching endpoint when saveToServer is true
- maps insuranceLicensing to the kebab-case endpoint
- normalizes the website protocol before saving
- syncs services into userSetup.primaryServiceCategories

**onboarding wizard store › saveStepDataToServer**

- returns true for an OK response
- returns false for a non-OK response
- returns false when the request throws

**onboarding wizard store › loadStepData**

- returns cached data without fetching
- fetches, stores, and returns data
- force reloads even when cached data exists
- shares one in-flight request between callers
- returns null on a non-OK response
- returns null when the request throws

**onboarding wizard store › loadAllWizardData**

- returns cached data when the store already has step data
- loads every section, restores the server step, and marks completed steps
- creates a session when none exists, then loads data
- returns an empty object and clears loading when loading throws
- shares one load between concurrent callers

**onboarding wizard store › completion and reset**

- marks the wizard complete and posts to the complete endpoint
- refreshes the session after a successful completion
- resetWizard clears navigation, data, errors, invites, and loading

**onboarding wizard store › validation actions**

- validates the current step and tags errors as next
- validates an explicit step instead of the current one
- clears errors when validation passes
- surfaces only the blurred field and marks the source as blur
- does not paint unrelated fields when the blurred field is valid

**onboarding wizard store › saveSummaryData**

- posts each supplied section and merges it into the store
- skips failed requests but still updates local data
- rethrows network errors

**onboarding wizard store › persistence**

- writes step data to localStorage and strips base64 images

### `lib/__tests__/onboarding-wizard-dirty.test.ts`

**hasUnsavedOnboardingWork**

- returns false for a pristine, incomplete wizard
- returns true once the user has advanced past step 1
- returns false for a completed wizard even with saved data
- returns true when step data contains non-empty strings
- ignores whitespace-only strings
- detects content nested in arrays and objects
- treats numbers and booleans as meaningful content
- ignores null and undefined values

### `hooks/__tests__/use-navigate-away-guard.test.tsx`

**useNavigateAwayGuard**

- registers beforeunload only while there are unsaved changes
- does nothing when the guard is disabled
- intercepts an internal link and opens the dialog
- ignores modifier clicks
- ignores non-primary buttons
- ignores external links, new tabs, downloads, and the current URL
- honors shouldIgnoreHref
- intercepts data-nav-href buttons
- ignores malformed or current data-nav-href values
- stay closes the dialog and keeps editing
- closing through dialogOnOpenChange behaves like Stay
- suppressStayOnNextClose keeps the dialog open for a discard
- save-and-exit saves, then navigates to the pending href
- keeps the dialog open and toasts when saving fails
- discard runs onDiscard and navigates
- keeps the dialog open and toasts when discard fails
- guards browser back and resumes history when discarded

### `components/ui/__tests__/navigate-away-warning-dialog.test.tsx`

**NavigateAwayWarningDialog**

- renders nothing while closed
- renders the warning and its actions
- calls onSaveAndExit
- calls onStay
- requires a second click before discarding
- cancel returns to the first step of the discard confirmation
- runs the discard pointer-down hook
- shows the saving state and disables every action
- shows the discarding state and disables every action
- reports Escape closes through onDialogOpenChange
- resets the discard confirmation when the dialog closes

### `hooks/__tests__/useOnboardingResumeEmail.test.tsx`

**useOnboardingResumeEmail**

- does nothing without a signed-in user
- posts the resume-email request and records the send time
- suppresses a second send inside the throttle window
- sends again once the throttle window has passed
- does not record a send when the response is not OK
- swallows a failed request
- sends even when reading localStorage throws
- does not throw when writing localStorage fails
- throttles per account

### `components/__tests__/desktop-only-gate.test.tsx`

**DesktopOnlyGate**

- renders children on desktop and does not report a block
- renders the onboarding notice and reports the block on mobile
- uses the dashboard copy for the dashboard variant
- works without an onBlocked callback
- reports a block when the viewport shrinks after mount
- reports again when a new onBlocked callback arrives while blocked

### `hooks/__tests__/useWizardInit.test.tsx`

**useWizardInit**

- loads data once and reports initialization
- resets the wizard when loading fails
- does not load twice across re-renders

### `hooks/__tests__/use-scroll-to-error-field.test.tsx`

**useScrollToErrorField**

- scrolls to and focuses the first errored field in document order
- does nothing when the error belongs to another step
- does nothing for blur-sourced errors
- does nothing without errors
- does nothing when the field is not in the document
- focuses a nested input rather than the wrapper
- clears its timer on unmount

### `hooks/__tests__/useMediaQuery.test.tsx`

**useMediaQuery**

- returns the current match state
- updates when the media query changes
- falls back when matchMedia is unavailable
- honors a custom server fallback
- unsubscribes on unmount

### `app/api/onboarding-wizard/__tests__/routes.test.ts`

**onboarding API routes › auth guard**

- client profile POST returns 401 without a session
- client profile GET returns 401 without a session
- team size POST returns 401 without a session
- services POST returns 401 without a session
- insurance POST returns 401 without a session
- branding POST returns 401 without a session
- user setup POST returns 401 without a session
- disclaimers POST returns 401 without a session
- team members POST returns 401 without a session
- benefit types POST returns 401 without a session
- employer scope POST returns 401 without a session
- complete POST returns 401 without a session
- session GET returns 401 without a session
- session POST returns 401 without a session
- status GET returns 401 without a session
- send resume email POST returns 401 without a session

**onboarding API routes › session route**

- GET returns the active session
- POST reuses an existing session
- POST creates a session when none exists
- PATCH rejects an out-of-range step
- PATCH returns 404 without an active session
- PATCH updates the current step

**onboarding API routes › onboarding-status route**

- reports completion from a completed session
- reports incomplete when no completed session exists

**onboarding API routes › client-profile route**

- POST rejects an invalid organization type
- POST creates a session when needed and upserts the profile
- GET returns null data without a session
- GET returns the stored profile

**onboarding API routes › team-size route**

- POST upserts the band
- GET returns null without a session
- GET returns the stored band

**onboarding API routes › services route**

- POST upserts the selected services
- POST creates a session when none exists
- GET returns null without a session
- GET returns the stored services

**onboarding API routes › insurance-licensing route**

- POST applies defaults for missing arrays
- GET returns null without a session
- GET returns the stored licensing data

**onboarding API routes › branding route**

- POST rejects an invalid website
- POST normalizes proxy URLs back to R2 keys and derives brandColor
- GET falls back to the most recent completed session
- GET returns null when no session exists

**onboarding API routes › user-setup route**

- POST merges partial data with the existing row
- POST normalizes proxy image URLs and mirrors the user fields
- GET falls back to another session's user setup
- GET returns null without a session

**onboarding API routes › disclaimers route**

- POST upserts the disclaimer array
- GET returns null without a session
- GET returns the stored disclaimers

**onboarding API routes › team-members route**

- POST defaults members to an empty array
- GET returns null without a session
- GET returns the stored members

**onboarding API routes › benefit-types and employer-scope routes**

- benefit types POST uses the supplied session id
- benefit types GET queries by the user id
- employer scope POST defaults the flag to false
- employer scope GET returns the stored value

**onboarding API routes › complete route**

- returns 404 when no incomplete session exists
- returns 404 when the user record is missing
- completes using the session with the most related data
- creates a future contact when requested and none exists
- does not duplicate an existing future contact
- does not save a contact when the preference is off

**onboarding API routes › resume email routes**

- send-resume-email creates a token and sends the link
- send-resume-email returns 500 when the mail fails
- request-resume-link is always neutral for an unknown address
- request-resume-link sends only when an unfinished session exists
- request-resume-link swallows email failures
- request-resume-link tolerates an invalid JSON body

**onboarding API routes › resume route**

- redirects to sign-in for an invalid token
- redirects to sign-in when the user is missing
- establishes the session and redirects to onboarding
