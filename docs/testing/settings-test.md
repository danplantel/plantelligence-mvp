# Settings Testing

This document is the test inventory for [`app/(dashboard)/settings/page.tsx`](../../app/(dashboard)/settings/page.tsx). It covers the tab shell, every Settings section (Profile, Branding, Organization, People & Access, Billing), the unsaved-changes guard, and the Delete Profile flow.

## Summary

- **Unit tests:** 87 passing in 1 file
- **Runner:** Vitest + React Testing Library + jsdom
- **E2E:** none yet — see [End-to-end tests](#end-to-end-tests)

## Running these tests

Settings-only commands:

```bash
pnpm test:settings           # all Settings unit suites (87 tests)
pnpm test:settings:watch     # Settings unit tests in watch mode
pnpm test:settings:coverage  # Settings unit tests + V8 coverage
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

There is no `e2e/settings.spec.ts` yet. The page-level suite covers the orchestration; the journeys still worth adding against a live app are:

- an owner edits Profile, Branding, and Organization and sees the changes persist after reload;
- a Collaborator sees only the Profile tab and cannot reach another tab by URL;
- a Viewer cannot reach Branding or Organization, including through `?tab=` deep links;
- an owner hands the organization to a successor and is signed out;
- an owner with no successor sees the deletion warning and its counts.

## Test inventory

| # | Suite | Tests | Focus |
| - | ----- | ----: | ----- |
| 1 | `app/(dashboard)/settings/__tests__/page.test.tsx` | 87 | Tab shell and role gating, Profile/Branding/Organization population and saves, disclosures fan-out, tab caching, portal wiring, unsaved-changes guard, People & Access lazy mount, Billing placeholder and deep-link guard, Delete Profile dialogs and in-flight states |

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

- Discard restores Branding from the store
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

| Candidate | Why it matters |
| --------- | -------------- |
| `components/pages/settings/profile-settings-section.tsx` | Passes `headshotFirst`, `emailChangeMode`, `alwaysShowDesignations`, and the collaborator's `hideDesignations` into `UserSetupSection`; assert those contracts directly. |
| `components/pages/settings/branding-settings-section.tsx` | Logo/background upload, R2 deletion, color extraction, and the preview wiring. |
| `components/pages/settings/organization-settings-section.tsx` | Organization type / team size / primary service categories controls and their blur validation. |
| `components/pages/settings/disclaimers-settings-section.tsx` | Recommended vs. custom disclosures, character limits, dirty state, `save(validate)`, attestation, and the ledger refresh. |
| `components/pages/settings/team-members-section.tsx` | Roster load, seat meter, invite/edit/deactivate/remove dialogs, and permission gating — the largest remaining surface. |
| `components/settings/ownership-successor-dialog.tsx` | Selection reset on close, blocked dismissal while submitting, and confirm payload. |
| `/api/profile`, `/api/profile/update-profile`, `/api/profile/delete`, `/api/profile/delete-impact` | Route-handler tests with mocked Prisma/session, mirroring the onboarding and auth API suites. |
| Settings Playwright journeys | Persistence across reloads, role-based tab visibility, and the owner deletion handover. |

## Closed gaps

- **Billing deep link** — `activeTab` is now forced back to Profile whenever the profile has answered and the viewer is not the organization owner. Covered by non-owner, owner, and profile-less deep-link tests.
- **Post-delete redirect** — the 3-second callback now calls the extracted `redirectToSignIn()` helper, so the destination is asserted directly.

See [`testing.md`](testing.md) for shared conventions, [`onboarding-tests.md`](onboarding-tests.md) for the onboarding inventory, and [`auth-testing.md`](auth-testing.md) for the auth inventory.
