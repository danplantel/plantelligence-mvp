# Settings Testing

This document is the test inventory for [`app/(dashboard)/settings/page.tsx`](<../../app/(dashboard)/settings/page.tsx>). It covers the tab shell, every Settings section (Profile, Branding, Organization, People & Access, Billing), the unsaved-changes guard, and the Delete Profile flow.

## Summary

- **Unit tests:** 91 passing in 1 file
- **E2E:** 7 Playwright journeys in [`e2e/settings.spec.ts`](../../e2e/settings.spec.ts) — they need only a reachable app and provision their own account
- **Runner:** Vitest + React Testing Library + jsdom, and Playwright + Chromium

## Running these tests

Settings-only commands:

```bash
pnpm test:settings           # all Settings unit suites (91 tests)
pnpm test:settings:watch     # Settings unit tests in watch mode
pnpm test:settings:coverage  # Settings unit tests + V8 coverage
pnpm test:settings:e2e       # the 7 Playwright Settings journeys
pnpm test:settings:all       # Settings unit + E2E
```

These are backed by `vitest.settings.config.mts` and
`scripts/tests/run-settings-tests.mjs`. The config currently lists the page
suite explicitly; add each `components/pages/settings` or
`components/settings` section suite to it as it lands.

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

File: `e2e/settings.spec.ts`

These require only an app: `E2E_BASE_URL`, or `E2E_START_SERVER=1` to let
Playwright start `pnpm dev`. They skip cleanly when neither is set, and an
all-skipped run exits 0. No credentials are needed.

**Self-provisioning.** `beforeAll` creates a unique account through `/signup`
(`settings-e2e+<stamp>@plantelligence.test`) and then completes onboarding
through the wizard's own API — `POST /api/onboarding-wizard/session` followed by
`POST /api/onboarding-wizard/complete`. That is what opens the middleware's
gate: `/settings` only renders for a user with a completed `WizardSession`, and
the next sign-in recomputes the `onboardingComplete` JWT latch from the
database. `afterAll` signs in and calls
`DELETE /api/profile/delete?confirmOrganization=true`. Set `E2E_KEEP_USER=1` to
keep the account for inspection.

**Early Access gate.** Every page is behind
[`InviteCodeProvider`](../../components/providers/invite-code-provider.tsx:15),
which accepts the code **`22222`**. `enterEarlyAccessCode(page, ready)` takes
the locator the destination shows once the app is past the gate — the email
field on `/signin`, the tab bar on `/settings` — and races it against the modal,
so a page that is already past the gate does not wait out both timeouts.

**Two Playwright traps this suite documents.** `getByText` is a substring match,
so "Unsaved Changes" and "Delete Your Profile?" each also match the dialog's
description; the journeys scope those to `getByRole("heading")`. And
`waitForURL` waits for the navigation's `load` event, which the dev server can
leave pending after the URL already matches, so the sign-in helper asserts with
`expect(page).toHaveURL` instead.

```powershell
cd "C:\Users\eddie\OneDrive\Desktop\Upwork Projects\plantelligence-dev"
$env:E2E_START_SERVER = "1"
pnpm test:settings:e2e
```

- **settings access**
  - an anonymous settings visit is sent to sign-in with a `callbackUrl`
- **settings**
  - an owner sees every tab and the Billing placeholder
  - a tab deep link opens that tab and an unknown one is ignored
  - saving the Profile tab persists across a reload
  - leaving a dirty Profile tab prompts, and Discard reverts the edit
  - Save & Continue stays on the tab when the save cannot validate
  - the Delete Profile dialog stays locked until the phrase is typed

Still uncovered, because they need accounts this spec cannot mint on its own: a
Collaborator (one Profile surface, no tab bar), a Viewer (no Branding or
Organization tab, including via `?tab=`), the successor handover, and the
owner-without-successor warning with its live counts.

## Test inventory

| #   | Suite                                              | Tests | Focus                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | -------------------------------------------------- | ----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `app/(dashboard)/settings/__tests__/page.test.tsx` |    91 | Tab shell and role gating, Profile/Branding/Organization population and saves, disclosures fan-out, tab caching, portal wiring, unsaved-changes guard (including failed saves that must not switch tabs), discard-to-baseline for seat- and organization-sourced values, People & Access lazy mount, Billing placeholder and deep-link guard, Delete Profile dialogs and in-flight states |

## Unit test inventory

### `app/(dashboard)/settings/__tests__/page.test.tsx`

**Settings page shell**

- sets the page title and the organization subtitle
- prefers the wizard branding organization name for the subtitle
- uses the organization source name for a teammate
- falls back to the organization type and clears the subtitle on unmount
- renders all five tabs for an organization owner
- hides Billing for a non-owner
- hides Billing until ownership resolves
- hides organization-level tabs for a read-only viewer and returns to Profile
- gives a Collaborator a single Profile surface with no tab bar
- ignores a deep link to another tab for a Collaborator
- opens People & Access from a `?tab=members` deep link
- ignores an unknown tab deep link
- shows the loading state until the profile resolves
- toasts when the profile cannot be loaded

**Profile section**

- populates from the wizard session and forwards the auth provider
- falls back to the invited seat for phone, title, designations, and photo
- falls back to the organization's shared email
- shows the save bar when the profile becomes dirty
- saves the profile to the wizard session and the User row
- requires an organization email before saving
- rejects a malformed organization email
- reports a failed wizard-session save
- still succeeds when the User-row write fails
- resets the profile back to the loaded baseline

**Branding section**

- populates from the completed branding session
- falls back to the organization source for a teammate
- saves branding to the User row, the wizard session, and the store
- clears the wizard userSetup background when the branding background is removed
- does not rewrite the userSetup background when one is still set
- still saves when the User-row write fails
- still succeeds when the wizard-session branding save fails
- resets branding edits back to the baseline

**Organization section**

- populates from the canonical User row
- falls back to the organization source for a teammate
- falls back to the stored onboarding session values
- derives primary service categories from the Step 2 answer
- saves the organization to `/api/profile` and refreshes
- refuses to save without an account id
- shows the API error when the organization save is rejected
- shows a generic error when the organization request throws
- marks the Organization tab dirty when the disclosures section is dirty
- saves disclosures and organization changes with one Save
- saves only disclosures when the organization form is clean
- resets both the organization form and the disclosures section

**Unsaved-changes guard**

- switches tabs immediately when nothing is dirty
- prompts before leaving a dirty Profile tab
- Cancel keeps the user on the current tab
- Discard reverts the edits and switches tabs
- Save & Continue saves the Profile tab before switching
- Save & Continue saves Branding before switching
- Save & Continue validates and saves disclosures, then organization
- keeps the user on Organization when disclosure validation fails
- keeps the user on Profile when Save & Continue cannot validate it
- keeps the user on Organization when Save & Continue is rejected

**People & Access section**

- does not mount the roster until the tab is first opened
- mounts the roster when the tab is opened
- keeps the roster mounted after leaving the tab
- offers no save bar on People & Access

**Billing section**

- shows the coming-soon placeholder for the owner
- offers no save bar on Billing

**Delete Profile**

- keeps the confirm button locked until the phrase is typed
- refuses to delete when the impact check fails
- deletes a non-owner immediately
- offers the successor picker to an owner and transfers the organization
- warns an owner without successors and sends the acknowledgement
- uses the empty-organization wording when there is nothing to lose
- reports a failed deletion and unlocks the dialog
- clears the typed phrase when the dialog is cancelled

**Settings page edge cases**

- portals the tab bar into the header and still switches tabs
- loads a non-profile tab once and reuses it when revisited
- toasts when a non-profile tab cannot load
- saves the profile without a User-row id
- still saves the profile when the local store write fails
- still saves branding when the local store write fails
- keeps the organization dirty after a rejected save
- still saves the organization when disclosures return false
- sends a non-owner away from a billing deep link
- keeps the owner on a billing deep link
- does not leave a profile-less visitor on billing

**Settings page in-flight states**

- shows Checking while the delete impact loads
- disables the delete dialog while the deletion runs
- reports a thrown impact request
- reports a thrown delete request and unlocks the dialog

**Delete Profile edge cases**

- uses singular counts in the owner warning
- blocks Enter while the confirmation phrase is incomplete
- redirects to sign-in three seconds after a successful delete

**Unsaved-changes edge cases**

- Discard restores Branding to the loaded baseline
- Discard keeps the organization's branding for a teammate
- Discard keeps an invited teammate's seat values on Profile
- Discard restores Organization and resets disclosures
- reports a thrown save when leaving with Save & Continue

## Mocking strategy

- **Real forms, stubbed sections.** The page creates three real `react-hook-form` instances and passes them to the child sections. The section stubs edit those forms through `setValue`, so dirty tracking, the sticky save bar, and every save handler run against production code.
- **Section contracts.** `ProfileSettingsSection`, `BrandingSettingsSection`, `OrganizationSettingsSection`, `TeamAndDisclaimersSection`, `TeamMembersSection`, and `OwnershipSuccessorDialog` are stubbed. `TeamAndDisclaimersSection` exposes the same imperative handle (`isDirty` / `save` / `reset`) the page drives, and receives `disclaimersRef` as a **prop**, exactly like the real component.
- **`swr`** — `useSWR` returns the test profile and records `mutate`.
- **`@/lib/fetch-profile`** — `fetchProfileOnce` and `invalidateProfileCache` are spies, so the page's profile read and post-save refresh can be deferred or failed.
- **`@/lib/onboarding-wizard-store`** — a hoisted store supplies `stepData`, `saveStepDataToServer`, and `saveStepDataLocally`.
- **`@/hooks/useViewerAccess` and `@/hooks/usePageTitleContext`** — control collaborator gating and record `setTitle` / `setSubtitle`.
- **Deep links** — read from `window.history`; the page no longer uses a navigation hook, so there is no router stub.
- **`sonner`** — `success`, `error`, and `info` are asserted directly.
- **`fetch`** — one dispatcher covers `/api/profile`, `/api/profile/update-profile`, `/api/profile/delete-impact`, and `/api/profile/delete`. Tests assert method, URL query, and JSON bodies.
- **`@/lib/redirect-to-signin`** — the post-delete navigation is a named helper (`redirectToSignIn`), mocked so the 3-second callback can be run and asserted without jsdom's non-configurable `location`.
- **Delete redirect timer** — a selective `setTimeout` spy swallows (or captures) only delays of 3 seconds or more, so `waitFor` still works and jsdom never attempts the navigation.

## Coverage boundaries

- The page's child sections are stubbed. Their internal rendering, validation, upload, and roster behavior belongs in dedicated section suites (see below).
- The route handlers behind the page (`/api/profile`, `/api/profile/update-profile`, `/api/profile/delete`, `/api/profile/delete-impact`) are not exercised here.
- Billing is a placeholder by design, so only its owner-only tab entry, copy, deep-link guard, and lack of a save bar are asserted.
- The successful delete redirect is asserted through the extracted `redirectToSignIn` helper, not by driving a real browser navigation.
- Radix marks the background `aria-hidden` while the unsaved-changes dialog is open, so those tests assert retained content by `data-testid` rather than querying roles behind the modal.

## Remaining test gaps

| Candidate                                                                                          | Why it matters                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/pages/settings/profile-settings-section.tsx`                                           | Passes `headshotFirst`, `emailChangeMode`, `alwaysShowDesignations`, and the collaborator's `hideDesignations` into `UserSetupSection`; assert those contracts directly.                                              |
| `components/pages/settings/branding-settings-section.tsx`                                          | Logo/background upload, R2 deletion, color extraction, and the preview wiring.                                                                                                                                        |
| `components/pages/settings/organization-settings-section.tsx`                                      | Organization type / team size / primary service categories controls and their blur validation.                                                                                                                        |
| `components/pages/settings/disclaimers-settings-section.tsx`                                       | Recommended vs. custom disclosures, character limits, dirty state, `save(validate)`, attestation, and the ledger refresh.                                                                                             |
| `components/pages/settings/team-members-section.tsx`                                               | Roster load, seat meter, invite/edit/deactivate/remove dialogs, and permission gating — the largest remaining surface.                                                                                                |
| `components/settings/ownership-successor-dialog.tsx`                                               | Selection reset on close, blocked dismissal while submitting, and confirm payload.                                                                                                                                    |
| `/api/profile`, `/api/profile/update-profile`, `/api/profile/delete`, `/api/profile/delete-impact` | Route-handler tests with mocked Prisma/session, mirroring the onboarding and auth API suites.                                                                                                                         |
| Settings Playwright roles                                                                          | The owner journeys are covered by `e2e/settings.spec.ts`; a Collaborator (single Profile surface), a Viewer (no organization-level tabs) and the successor handover still need accounts the spec cannot create alone. |

## Closed gaps

- **Billing deep link** — `activeTab` is now forced back to Profile whenever the profile has answered and the viewer is not the organization owner. Covered by non-owner, owner, and profile-less deep-link tests.
- **Post-delete redirect** — the 3-second callback now calls the extracted `redirectToSignIn()` helper, so the destination is asserted directly.
- **Save & Continue after a failed save** — the three save handlers now return a boolean, and the dialog only switches tabs when the active tab actually saved. Previously a validation failure or a rejected request toasted and returned, the dialog still switched, and returning to Profile re-populated the form from the server — silently dropping the edit. Covered by the Profile-validation and Organization-rejection tests.
- **Discard reverting to the wrong source** — Discard now restores `initialUserSetup` / `initialBranding`, the same snapshot `Reset` uses, instead of the wizard store. The Organization branch already worked this way; Profile and Branding still read the store, so for an invited teammate (whose values come from the seat and the organization source, not the store) Discard blanked phone, title, designations, photo, and the organization's branding. Covered by the two teammate discard tests.

## Open findings

Behaviour the audit found but deliberately did not change — each needs a product call first.

| Finding                                                                                        | Why it is not simply a bug                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Designations and primary service categories cannot be cleared to empty for an invited teammate | `firstNonEmptyList` skips `[]`, so after the teammate saves an empty list the seat's original designations come back. Making an empty array authoritative is right for their own row, but it would also let an onboarding draft of `[]` hide real values on the row, which is the case the helper was written for. Needs a precedence decision. |
| `onSave` / `isSaving` are still passed to the three section components                         | The sticky bar owns saving, so the sections no longer render a save control and `onSave={noopSave}` is decorative (the page even admits it is "kept for compatibility but unused by UI"). Removing the props touches four files for no behavioural gain, so it is cleanup rather than a defect.                                                 |
| The Organization panel is force-mounted on first paint                                         | Deliberate: it stops the Disclosures editor showing its skeleton on arrival. The side effect is that its `/api/profile` read also runs for a read-only Viewer, whose tab entry is removed. Cheap, and the alternative is the skeleton it was added to remove.                                                                                   |
| The post-delete redirect timer is never cleared                                                | It only ever fires 3 seconds after a successful account deletion, when the page is being left. Worth clearing if the success screen ever becomes cancelable.                                                                                                                                                                                    |

See [`testing.md`](testing.md) for shared conventions, [`onboarding-tests.md`](onboarding-tests.md) for the onboarding inventory, and [`auth-testing.md`](auth-testing.md) for the auth inventory.
