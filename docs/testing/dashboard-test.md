# Dashboard Testing

This document is the test inventory for the dashboard surface: [`components/pages/dashboard/dashboard.tsx`](../../components/pages/dashboard/dashboard.tsx), its six detail panels, and the `/api/dashboard/*` route handlers.

## Summary

- **Unit tests:** 105 passing across 3 files
- **Dashboard page:** 34
- **Panels:** 39
- **API routes:** 32
- **Runner:** Vitest + React Testing Library + jsdom
- **E2E:** 3 Playwright journeys in `e2e/dashboard.spec.ts` (skipped unless configured)

## Running these tests

Dashboard-only commands:

```bash
pnpm test:dashboard           # dashboard suite (105 tests)
pnpm test:dashboard:watch     # watch mode
pnpm test:dashboard:coverage  # suite + V8 coverage
```

These are backed by `vitest.dashboard.config.mts` and
`scripts/tests/run-dashboard-tests.mjs`.

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

File: `e2e/dashboard.spec.ts`

These require `E2E_BASE_URL` (or `E2E_START_SERVER=1`) plus `E2E_EMAIL` / `E2E_PASSWORD`. The Viewer journey also needs `E2E_VIEWER_EMAIL` / `E2E_VIEWER_PASSWORD`. They skip cleanly when unconfigured.

- **dashboard**
  - shows the owner identity, insights, actions, and team panel
  - opens the Active Plans insight
- **dashboard as a Viewer**
  - withholds write actions and the team panel

Still worth adding: an invited-teammate identity journey and a failed-stats rendering journey.

## Test inventory

| # | Suite | Tests | Focus |
| - | ----- | ----: | ----- |
| 1 | `components/pages/dashboard/__tests__/dashboard.test.tsx` | 34 | Title, identity precedence, avatar resolution/cancellation, loading skeleton, stats overlay, role-based actions/panels, insight detail mapping |
| 2 | `components/pages/dashboard/__tests__/panels.test.tsx` | 39 | Active Plans, Meetings, Needs Attention, Recent Activity, Upcoming Meetings, Dashboard Team, Task List, Tasks & Meetings |
| 3 | `app/api/dashboard/__tests__/routes.test.ts` | 32 | Stats, active plans, meetings, needs attention, tasks GET/POST/PATCH/DELETE, upcoming meetings, recent activity |

## Unit test inventory

### `components/pages/dashboard/__tests__/dashboard.test.tsx`

**Dashboard**

- sets the page title
- renders the default identity before the profile arrives
- prefers the wizard setup and branding for identity
- falls back to the profile name and the organization logo
- falls back to the invited seat for title, role, and photo
- prefers the reader's own headshot over the seat photo
- falls back to the userSetup preview image
- uses the raw avatar when resolution returns null
- shows the identity skeleton while the profile loads
- overlays live stats onto the insight tiles
- uses an em dash when a live stat is missing
- uses an em dash when the stats payload is null
- forwards the stats loading state to Quick Insights
- gives an owner every action, the team panel, and publish rights
- gives an admin the team panel and publish rights
- withholds write entry points from a read-only viewer
- lets an editor keep the write actions but not publish or manage the team
- renders the recent activity panel
- maps each insight detail to its panel
- passes read-only mode into the insight panels for a viewer
- does not render a role badge when nothing is known
- falls back to the raw avatar when resolution rejects
- ignores a resolved avatar after the raw avatar changes
- keeps owner privileges even when a viewer seat is present
- renders zero as a real statistic
- falls back to advisorLogoUrl for the organization mark
- falls back to the generic identity for an empty profile
- keeps the default permissions before a profile exists
- renders the contributor role label
- renders the reviewer role label
- renders the custom role label
- uses the seat title when the wizard setup has only a name
- keeps previous stats visible while revalidating
- passes the identity name as the headshot monogram and resolves null without an avatar

### `components/pages/dashboard/__tests__/panels.test.tsx`

**ActivePlansPanel**

- shows a loading skeleton
- shows an error message
- shows the empty state
- renders plan rows with View/Edit by default
- uses the read-only label for a Viewer

**MeetingsThisWeekPanel**

- shows a loading skeleton
- shows an error message
- shows the empty state
- prefers the plan record and shows the In Progress chip
- omits the plan when no client is attached

**NeedsAttentionPanel**

- shows a loading skeleton
- shows an error message
- shows the empty state
- renders capped issue chips and the default actions
- offers only the read destination to a Viewer
- shows the disclosures alert only for an unreviewed org the reader can review

**RecentActivity**

- shows a loading skeleton
- shows an error message
- shows the empty state
- groups and renders activity rows

**UpcomingMeetingsList**

- shows a loading skeleton
- shows an error message
- offers the scheduling CTA in the empty state
- hides the scheduling CTA for a read-only Viewer
- renders meeting rows and the view-all link

**DashboardTeam**

- shows the loading avatars
- shows the empty state
- caps the avatar stack and summarises the remainder
- links to People & Access

**TasksAndMeetings**

- renders both cards and forwards their props

**TaskList**

- shows a loading skeleton
- shows an error message
- shows the empty state
- filters the publish task when the reader cannot publish
- toggles a manual task
- renames a manual task
- deletes a manual task
- adds a task and clears the draft
- surfaces an add-task API error

### `app/api/dashboard/__tests__/routes.test.ts`

**GET /api/dashboard/stats**

- returns 401 without a session
- counts accessible plans, this week's meetings, and needs-attention plans
- returns 500 when the aggregate query fails

**GET /api/dashboard/active-plans**

- returns 401 without a session
- returns the minified active plans

**GET /api/dashboard/meetings-this-week**

- returns 401 without a session
- returns the week's meetings

**GET /api/dashboard/needs-attention**

- returns 401 without a session
- maps flagged plans to the panel shape

**GET /api/dashboard/tasks**

- returns 401 without a session
- returns derived and manual tasks

**POST /api/dashboard/tasks**

- returns 401 without a session
- requires a title
- caps the title length
- rejects a plan the reader cannot reach
- creates the task with a reachable plan
- creates a task with no plan link

**PATCH /api/dashboard/tasks/[id]**

- returns 401 without a session
- returns 404 when the task is not the reader's
- rejects an empty update
- caps a renamed title
- ticks a task off and stamps doneAt
- renames a task

**DELETE /api/dashboard/tasks/[id]**

- returns 401 without a session
- returns 404 when the task is not the reader's
- deletes the task

**GET /api/dashboard/upcoming-meetings**

- returns 401 without a session
- filters past meetings and keeps at most four
- keeps an in-progress meeting and an underivable row
- returns the debug summary with `?debug=1`

**GET /api/dashboard/recent-activity**

- returns 401 without a session
- returns 500 when the source query fails

## Mocking strategy

**Dashboard page**
- **`swr`** — `/api/profile` and `/api/dashboard/stats` are read from hoisted state, so load/loading/missing/null cases are independent.
- **`@/lib/branding-image-url`** — `resolveBrandingImageUrl` is a spy; resolved, `null`, rejection, and cancellation (deferred promise) are covered.
- **UI contracts** — `QuickActions`, `QuickInsights`, `Headshot`, and `BrandingImage` are stubs; `QuickInsights` exposes `renderDetail` buttons.
- **Panels** — all six dashboard panels are stubs that expose the props the page forwards.

**Panels**
- **`swr`** — keyed hoisted state for every panel endpoint, with per-key loading/error sets.
- **`next/link`** — rendered as a plain anchor (Next's Link needs `IntersectionObserver`).
- **`@/lib/meeting-display`, `@/lib/date`** — deterministic day/time labels.
- **`@/lib/plan-attention-actions`** — returns the real routes (`/benefits`, `/documents?planId=…`) for editable vs. read-only.
- **`@/lib/recent-activity`** — deterministic day grouping.
- **`Headshot`** — a stub exposing `src`, `alt`, and monogram.
- **`fetch`** — mocked for task POST/PATCH/DELETE and add-task errors.

**API routes**
- **`next-auth`** — `getServerSession` is controlled per test.
- **`@/lib/prisma`** — one shared mock for client/meeting/task calls.
- **Access + derivations** — `listAccessiblePlanIds`, `meetingsThisWeekWhere`, `listPlansNeedingAttention`, `countPlansNeedingAttention`, `listSystemTasks`, `listManualTasks`, `suppressedDerivedRows`, `upcomingMeetingsWhere`, and `resolveMeetingStartMs` are spies.
- **Requests** — real `NextRequest` objects; route context params are passed directly.

## Coverage boundaries

- The page suite stubs the panels; their behavior is covered by the panel suite.
- The panel suite stubs the `/api/dashboard/*` endpoints; the route suite covers the handlers with mocked Prisma/session.
- `GET /api/dashboard/recent-activity` covers auth and failure only; the multi-source merge/ordering is not asserted.
- The upcoming-meetings debug branch is covered, but the non-debug per-row time filter is tested through mocked `resolveMeetingStartMs` rather than real dates.
- Role behavior is tested from the payload the page consumes, not by re-running the permission grid.

## Remaining test gaps

| Candidate | Why it matters |
| --------- | -------------- |
| `GET /api/dashboard/recent-activity` success path | Merging plans/documents/meetings/marketing, day grouping, and the 12-item cap. |
| `TaskList` assigned/derived rows | `assignedByUserId` rendering, "Fix it here", and the suppression contract with `derivedKind`. |
| Dashboard teammate journey | Invited-seat title/role/photo and organization logo against a real app. |
| Failed-stats E2E | Prove the page renders em dashes rather than fabricated counts when the endpoint fails. |
| `DashboardTeam` permission boundary E2E | An Editor/Viewer must never see the roster. |

See [`testing.md`](testing.md) for shared conventions, plus the onboarding, auth, settings, and chrome inventories.
