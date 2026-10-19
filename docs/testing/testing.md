# Testing

Unit tests run on [Vitest](https://vitest.dev) with React Testing Library and
jsdom. Playwright covers the cross-page journeys. For complete, itemized test
inventories see [`onboarding-tests.md`](onboarding-tests.md),
[`auth-testing.md`](auth-testing.md),
[`settings-test.md`](settings-test.md),
[`header-sidebar-tests.md`](header-sidebar-tests.md),
[`dashboard-test.md`](dashboard-test.md), and
[`documents-tests.md`](documents-tests.md).

## Commands

| Command              | Purpose                                         |
| -------------------- | ----------------------------------------------- |
| `pnpm test`          | Run the whole unit suite once                   |
| `pnpm test:watch`    | Re-run changed unit tests on save               |
| `pnpm test:coverage` | Run once and print a V8 coverage report         |
| `pnpm exec vitest run <path>` | Run a single unit file or directory    |
| `pnpm test:onboarding` | Every onboarding unit suite (30 files, 412 tests) |
| `pnpm test:onboarding:watch` | Onboarding unit tests in watch mode      |
| `pnpm test:onboarding:coverage` | Onboarding unit tests + coverage     |
| `pnpm test:onboarding:e2e` | Onboarding Playwright journeys only      |
| `pnpm test:onboarding:all` | Onboarding unit + E2E                    |
| `pnpm test:auth`     | Every auth unit suite (18 files, 161 tests)     |
| `pnpm test:auth:watch` | Auth unit tests in watch mode                |
| `pnpm test:auth:coverage` | Auth unit tests + coverage               |
| `pnpm test:auth:e2e` | Auth Playwright journeys only                  |
| `pnpm test:auth:all` | Auth unit + E2E                                |
| `pnpm test:settings` | Every Settings unit suite (1 file, 87 tests)    |
| `pnpm test:settings:watch` | Settings unit tests in watch mode          |
| `pnpm test:settings:coverage` | Settings unit tests + coverage         |
| `pnpm test:header-sidebar` | Header + Sidebar suites (2 files, 52 tests) |
| `pnpm test:header-sidebar:watch` | Header/Sidebar tests in watch mode  |
| `pnpm test:header-sidebar:coverage` | Header/Sidebar tests + coverage  |
| `pnpm test:dashboard` | Dashboard suite (3 files, 105 tests)       |
| `pnpm test:dashboard:watch` | Dashboard tests in watch mode        |
| `pnpm test:dashboard:coverage` | Dashboard tests + coverage        |
| `pnpm test:documents` | Documents suite (16 files, 305 tests)     |
| `pnpm test:documents:watch` | Documents tests in watch mode      |
| `pnpm test:documents:coverage` | Documents tests + coverage      |
| `pnpm test:e2e`      | Run Playwright E2E                              |
| `pnpm test:e2e:ui`   | Run Playwright in UI mode                       |
| `pnpm test:e2e:install` | Install the Chromium browser binary          |

The onboarding-only scripts are backed by
[`vitest.onboarding.config.mts`](../../vitest.onboarding.config.mts), which
keeps the default environment and aliases but narrows `include` to the
onboarding suites. The orchestrator is
[`scripts/tests/run-onboarding-tests.mjs`](../../scripts/tests/run-onboarding-tests.mjs).
The auth-only scripts follow the same pattern with
[`vitest.auth.config.mts`](../../vitest.auth.config.mts) and
[`scripts/tests/run-auth-tests.mjs`](../../scripts/tests/run-auth-tests.mjs).
Settings does the same with
[`vitest.settings.config.mts`](../../vitest.settings.config.mts) and
[`scripts/tests/run-settings-tests.mjs`](../../scripts/tests/run-settings-tests.mjs).
The chrome suites use
[`vitest.header-sidebar.config.mts`](../../vitest.header-sidebar.config.mts) and
[`scripts/tests/run-header-sidebar-tests.mjs`](../../scripts/tests/run-header-sidebar-tests.mjs).
The dashboard uses
[`vitest.dashboard.config.mts`](../../vitest.dashboard.config.mts) and
[`scripts/tests/run-dashboard-tests.mjs`](../../scripts/tests/run-dashboard-tests.mjs).
Documents does the same with
[`vitest.documents.config.mts`](../../vitest.documents.config.mts) and
[`scripts/tests/run-documents-tests.mjs`](../../scripts/tests/run-documents-tests.mjs).

Coverage is written to `coverage/` (already gitignored).

## Inventory document structure

Every test inventory in this folder follows the same order so the docs stay
scannable:

1. `## Summary` — suite counts, runner, and E2E requirements.
2. `## Running these tests` — the scoped commands first, then the shared ones.
3. `## End-to-end tests` — spec file, environment requirements, and journeys.
4. `## Test inventory` — the suite/file/test-count/focus table.
5. `## Unit test inventory` — every test title, grouped by describe block.
6. Coverage notes (security regressions, mocking, boundaries), remaining gaps,
   and any hardening findings.

## Layout

- [`vitest.config.mts`](../../vitest.config.mts) wires the `@/*` and
  `@video-steps/*` aliases from `tsconfig.json`, jsdom, and coverage.
- [`vitest.setup.ts`](../../vitest.setup.ts) loads `jest-dom`, unmounts trees
  between tests, and stubs browser APIs jsdom does not implement
  (`matchMedia`, `ResizeObserver`, `IntersectionObserver`,
  `scrollIntoView`).
- Tests live in a `__tests__` folder next to the code they cover and use the
  `*.test.ts` / `*.test.tsx` suffix.

## Conventions

- Import `describe` / `it` / `expect` / `vi` explicitly from `vitest`. Globals
  are intentionally disabled so test files stay self-contained and typed.
- Use `screen` queries from Testing Library and assert on accessible roles,
  labels, and text rather than CSS classes or component internals.
- Prefer `findBy*` / `waitFor` for anything that resolves after an effect or
  promise.
- Keep tests deterministic. Mock network calls and timers; never hit the real
  API, database, or auth provider.

## Page-level pattern (onboarding)

[`app/(dashboard)/onboarding/__tests__/page.test.tsx`](../../app/(dashboard)/onboarding/__tests__/page.test.tsx)
covers the onboarding route with the following strategy:

1. **Mock the boundary, not the page.** `next-auth/react`, `next/navigation`,
   the wizard store, and the page's hooks are mocked so the test controls
   initialization, session, and navigation without a server.
2. **Replace heavy children with stubs.** `OnboardingWizard`, the five step
   components, `DesktopOnlyGate`, and the navigate-away dialog are lightweight
   test doubles that expose only the props the page wires up.
3. **Assert integration points.** Examples: the status request redirects to
   `/dashboard` when complete, the page title is set, the current step
   component renders, Step 5 validation reaches the wizard, and the leave
   guard's `onSaveAndExit` persists summary data.
4. **Cover failure paths.** A non-OK status response and a rejected request
   must both leave the user on the wizard instead of a blank screen.

State shared by `vi.mock` factories must be created with `vi.hoisted` because
`vi.mock` calls are lifted above imports.

Pure helpers, such as
[`lib/__tests__/onboarding-wizard-dirty.test.ts`](../../lib/__tests__/onboarding-wizard-dirty.test.ts),
can be tested directly without React.

## Step component pattern

Each onboarding step has a co-located suite under
`components/wizard/steps/__tests__/`:

| File | Focus |
| ---- | ----- |
| `step-1-user-profile.test.tsx` | progressive disclosure of Team Size, prefill/normalization, error propagation |
| `step-2-services.test.tsx` | server-loaded selections, service/custom-service saves, insurance flag, failure handling |
| `step-3-branding.test.tsx` | card wiring, welcome-statement merge fields, branding/client-profile persistence, background upload/removal, color saves |
| `step-4-user-setup.test.tsx` | server/session fallbacks, phone + designation normalization, immediate saves, blur validation, unmount flush |
| `step-5-onboarding.test.tsx` | sub-stepper gating (solo vs. team), routing, validity forwarding |
| `step-5a-summary.test.tsx` | review values, edit-from-review entry points, summary payload mapping |
| `step-5b-disclosures.test.tsx` | intro vs. editor, skip attestation, recommended/custom copy persistence, limits |
| `step-5c-team.test.tsx` | seat meter/cap, row add/remove, per-field validation, duplicate/self emails, role updates |

The store is mocked as a small reactive store backed by
`useSyncExternalStore`, with a mutable `state` object and a `notify()` helper.
That lets a test mutate `teamInvites` / `step5SubStep` and observe the component
re-render exactly as it would against Zustand, while every action
(`saveStepData`, `setTeamInvites`, …) stays a spy.

Heavy section components (`UserProfileSection`, `ServicesSection`,
`BrandingSetupCard`, `UserSetupSection`, …) are replaced with stubs that render
the props they receive and expose buttons for the callbacks. Assertions then
target the contract between a step and its sections: what data is passed down,
which callback fires, and what payload is persisted.

## Wider unit coverage

Beyond the step suites, these cover the rest of the onboarding flow:

| File | Focus |
| ---- | ----- |
| `lib/__tests__/wizard-validation.test.ts` | every step schema and `validateCurrentStep` field mapping |
| `lib/__tests__/onboarding-wizard-store.test.ts` | navigation, review-edit mode, saves/loads, validation actions, completion, reset, persistence |
| `components/wizard/__tests__/wizard.test.tsx` | Next/Previous, Step 1 ordering, Step 2 parallel saves, Step 4 DOM normalization, Step 5 routing, skip/confirm/invite flows, completion |
| `hooks/__tests__/use-navigate-away-guard.test.tsx`, `components/ui/__tests__/navigate-away-warning-dialog.test.tsx` | link interception, popstate, save/discard/stay, two-step discard |
| `hooks/__tests__/useOnboardingResumeEmail.test.tsx`, `components/__tests__/desktop-only-gate.test.tsx` | resume-email throttling and device gating |
| `hooks/__tests__/useWizardInit.test.tsx`, `use-scroll-to-error-field.test.tsx`, `useMediaQuery.test.tsx` | initialization, error scrolling, media queries |
| `components/wizard/steps/__tests__/*-section.test.tsx` | the real form sections that the step suites stub |
| `app/api/onboarding-wizard/__tests__/routes.test.ts` | every onboarding route handler with mocked Prisma, auth, email, and tokens |

## Auth flow coverage

| File | Focus |
| ---- | ----- |
| `lib/__tests__/form-schema.test.ts` | shared password policy, sign-up/reset/sign-in schemas |
| `lib/__tests__/sign-in-redirect.test.ts` | callbackUrl parsing, onboarding collapse, post-sign-in landing, no `/signin` loop |
| `app/(dashboard)/signin/__tests__/page.test.tsx` | sign-in route shell |
| `components/pages/sign-in/__tests__/sign-in.test.tsx` | sign-in screen: form/resume link, themes, logo, authenticated redirect wiring |
| `components/forms/__tests__/user-auth-form.test.tsx` | credentials sign-in: reveal timing, validation, callback/default landing, error mapping, loading, links |
| `components/forms/__tests__/google-auth-button.test.tsx` | Google OAuth default landing and middleware deep-link preservation |
| `components/forms/__tests__/user-signup-form.test.tsx` | sign-up: validation, password match, email availability, auto sign-in, API errors, loading, visibility |
| `app/(dashboard)/signup/__tests__/page.test.tsx` | sign-up route shell, theme toggle, logo |
| `components/forms/__tests__/forget-password-form.test.tsx` | forgot password: validation, neutral request, errors, loading, auto-clear |
| `app/(dashboard)/forget/__tests__/page.test.tsx` | forgot-password route shell, heading, copyright, themes |
| `components/forms/__tests__/reset-pass-form.test.tsx` | reset password: shared policy, match, verified-token POST, errors, loading |
| `app/(dashboard)/reset-password/__tests__/page.test.tsx` | reset-password route shell, heading, copyright, themes |
| `lib/__tests__/reset-token.server.test.ts` | signed reset tokens: round-trip, tampering, expiry, missing secret |
| `components/forms/__tests__/verify-code-form.test.tsx` | 6-digit validation, verification, reset-password redirect with token, errors, loading |
| `app/(dashboard)/verify-code/__tests__/page.test.tsx` | verify-code route shell, heading, copyright, themes |
| `components/forms/__tests__/resume-onboarding-link.test.tsx` | resume dialog: open, opaque submit, failure, cancel/reset |
| `lib/__tests__/middleware.test.ts` | route protection: portal/static/API bypass, sign-in redirect, onboarding gate, cookie names |
| `app/api/__tests__/auth-routes.test.ts` | forget, verify-code, reset-password, signup sanitization, check-email handlers |

## Settings page coverage

| File | Focus |
| ---- | ----- |
| `app/(dashboard)/settings/__tests__/page.test.tsx` | tab shell and role gating, Profile/Branding/Organization saves, disclosures fan-out, unsaved-changes guard, People & Access lazy mount, Billing placeholder, Delete Profile dialogs |

See [`settings-test.md`](settings-test.md) for the itemized inventory and the remaining section/route-handler gaps.

## Layout chrome coverage

| File | Focus |
| ---- | ----- |
| `components/layout/__tests__/header.test.tsx` | title/company split, stepper and editor overlay, header tab portal, theme toggle, scroll chrome |
| `components/layout/__tests__/sidebar.test.tsx` | persisted rail state, responsive widths, access skeleton, collaborator nav filtering, logos, editor collapse, wizard step-2 width |

See [`header-sidebar-tests.md`](header-sidebar-tests.md) for the itemized inventory and remaining gaps.

## Dashboard coverage

| File | Focus |
| ---- | ----- |
| `components/pages/dashboard/__tests__/dashboard.test.tsx` | identity precedence, avatar resolution/cancellation, loading skeleton, stats overlay, role-based actions/panels, insight detail mapping |
| `components/pages/dashboard/__tests__/panels.test.tsx` | Active Plans, Meetings, Needs Attention, Recent Activity, Upcoming Meetings, Team, Task List |
| `app/api/dashboard/__tests__/routes.test.ts` | stats, plans/meetings/attention, tasks CRUD, upcoming meetings, recent activity |

See [`dashboard-test.md`](dashboard-test.md) for the itemized inventory and remaining gaps.

## Documents coverage

| File | Focus |
| ---- | ----- |
| `app/(dashboard)/documents/__tests__/page.test.tsx` | plan picker and sticky selection, URL/company deep links, brute-force plan fetches, review-date alerts and dismissal, list/cards/calendar/preview views, filters and sorting, upload tab and leave guard, bulk/single delete, preview/download/edit with the R2 fallback, preview order persistence |
| `app/api/documents/__tests__/routes.test.ts` | all nine document handlers: list/create/patch/delete/view, batch, client-scoped list, expiring, reorder |
| `components/pages/documents/components/__tests__/*.test.tsx` | compliance upload staging, edit modal validation/file replacement, preview modal blob/download/revocation |
| `components/pages/documents/tabs/__tests__/*.test.tsx`, `views/__tests__/*.test.tsx` | list/preview tabs, table sorting/actions/category editing, cards editing events, 15-month calendar and review-date drawer |
| `lib/__tests__/{compliance-document-utils,document-category,document-expirations,document-sort,notification-date-keys,portal-document-language}.test.ts` | category scoring/inference, custom ordering, reminder tiers, day-key math, EN/ES normalization |

See [`documents-tests.md`](documents-tests.md) for the itemized inventory and remaining gaps.

## End-to-end (Playwright)

The E2E suite lives in `e2e/` and is driven by environment variables:

- `E2E_BASE_URL` — an already-running app (default `http://localhost:3000`);
- `E2E_START_SERVER=1` — let Playwright run `pnpm dev` itself;
- `E2E_EMAIL` / `E2E_PASSWORD` — a **fresh, not-yet-onboarded** account for
  the onboarding journeys, or any working account for the authenticated
  sign-in journeys;
- `E2E_PLAN_ID` — an active plan id or slug for the plan-scoped Documents
  journeys.

```bash
pnpm test:e2e:install            # once per machine
E2E_START_SERVER=1 E2E_EMAIL=... E2E_PASSWORD=... pnpm test:e2e
```

Without `E2E_BASE_URL`/`E2E_START_SERVER`, the E2E tests skip instead of
failing. The happy-path test completes onboarding and redirects to the
dashboard, so reset that account's wizard data before re-running it.

Covered onboarding journeys (`e2e/onboarding.spec.ts`):

- anonymous `/onboarding` redirects to `/signin`;
- a phone viewport shows the desktop-only notice;
- an empty Step 1 blocks Next and shows the named-field toast, then accepts the
  same form once filled;
- the leave guard intercepts an in-app link and Stay returns to the wizard;
- the full flow (branding upload, disclosures, invite-later) reaches the
  dashboard.

Covered auth journeys (`e2e/auth.spec.ts`):

- anonymous `/dashboard` and `/settings/profile` visits land on `/signin` with
  the original path in `callbackUrl`;
- sign-in exposes credentials, Google, sign-up, and forgot-password, validates
  an invalid email, and maps bad credentials to a friendly message;
- sign-up enforces the shared password policy and forgot-password validates its
  email;
- the reset API refuses a request without a signed token and forgot-password
  returns a neutral response for unknown emails;
- with credentials, a valid sign-in leaves `/signin`, honours a `callbackUrl`
  deep link, and an already signed-in visitor skips the form.

Covered documents journeys (`e2e/documents.spec.ts`):

- `/documents` loads the page heading and plan picker;
- `/documents?planId=…&tab=upload` opens the Upload surface and its 10-file guidance;
- with a plan selected, the Calendar and Preview view modes render.
