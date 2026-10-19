# Meetings Testing

This document is the test inventory for the Meetings surface:

- [`app/(dashboard)/communications/meetings/page.tsx`](../../app/(dashboard)/communications/meetings/page.tsx)
- the meeting API routes under [`app/api/meetings`](../../app/api/meetings) and [`app/api/user/[id]/custom-meetings`](../../app/api/user/[id]/custom-meetings)
- the meeting/date helpers and Zustand stores under [`lib`](../../lib)
- the calendar, day drawer, and plan-scoped schedule form under [`components/meetings`](../../components/meetings)

## Summary

- **Unit tests:** 224 passing in 12 files
- **Runner:** Vitest + React Testing Library + jsdom
- **E2E:** [`e2e/meetings.spec.ts`](../../e2e/meetings.spec.ts) — skips unless `E2E_BASE_URL` (or `E2E_START_SERVER=1`) and `E2E_EMAIL` / `E2E_PASSWORD` are set; plan journeys also need `E2E_PLAN_NAME`.

## Running these tests

Meetings-only commands:

```bash
pnpm test:meetings           # all Meetings unit suites (224 tests)
pnpm test:meetings:watch     # Meetings unit tests in watch mode
pnpm test:meetings:coverage  # Meetings unit tests + V8 coverage
```

These are backed by [`vitest.meetings.config.mts`](../../vitest.meetings.config.mts) and [`scripts/tests/run-meetings-tests.mjs`](../../scripts/tests/run-meetings-tests.mjs). The config lists every Meetings suite explicitly so unrelated tests cannot leak into the scoped run.

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

[`e2e/meetings.spec.ts`](../../e2e/meetings.spec.ts) signs in, opens `/communications/meetings`, and covers:

- the plan picker and Meetings workspace shell;
- opening the schedule dialog at its defaults and closing it with Escape;
- switching between Cards, Calendar, and the portal Preview;
- restoring the sticky plan (and its picker value) after a reload.

Environment requirements:

- `E2E_BASE_URL` (or `E2E_START_SERVER=1`);
- `E2E_EMAIL` / `E2E_PASSWORD`;
- `E2E_PLAN_NAME` — the company name exactly as the plan picker renders it.

The live journeys still worth adding: create → reload persistence, edit/status persistence, duplicate into a new slot, delete, and a conflict confirmation.

## Test inventory

| # | Suite | Tests | Focus |
| - | ----- | ----: | ----- |
| 1 | `app/(dashboard)/communications/meetings/__tests__/page.test.tsx` | 58 | Plan picker and sticky selection, URL deep links, plan-change loading (including the 6s cap), meeting cards, filters/sorting, calendar + drawer, preview, schedule/edit/duplicate validation and submission, drafts, delete, post-save duplicate flow, edge branches |
| 2 | `app/api/meetings/__tests__/routes.test.ts` | 48 | POST/GET meetings, PUT/PATCH/DELETE by id, reminders, custom meeting types |
| 3 | `lib/__tests__/meeting-reminders.test.ts` | 14 | Reminder tiers/constants, day-key math, formatting, ordering |
| 4 | `lib/__tests__/meeting-schedule-shared.test.ts` | 19 | Date/time formatting, duration pickers, RSVP fallback, shared validation, payload mapping, default form |
| 5 | `lib/__tests__/date-schedule-day.test.ts` | 11 | Day-key conversion, display, day math, US scheduling "today" and DST |
| 6 | `lib/__tests__/meeting-start-at.test.ts` | 13 | Timezone-aware start instants, legacy fallback, stored-field precedence |
| 7 | `lib/__tests__/meeting-display.test.ts` | 7 | Dashboard time/day labels without timezone drift |
| 8 | `lib/__tests__/meeting-store.test.ts` | 12 | Custom meeting types: fetch/defaults/localStorage fallback, add/delete, reset |
| 9 | `lib/__tests__/meeting-debug-store.test.ts` | 8 | Saved-type dedupe, delete/clear, rebase merge and rollback |
| 10 | `components/meetings/__tests__/meetings-calendar-view.test.tsx` | 11 | 12-month window, slide navigation, today ring, quick-add/View hover menu, draft chips |
| 11 | `components/meetings/__tests__/meeting-day-drawer.test.tsx` | 11 | Day heading, scheduling gate, empty states, sorted rows, detail expansion, actions |
| 12 | `components/meetings/__tests__/plan-meeting-schedule-form.test.tsx` | 12 | Plan meeting list, load failure, validation, conflict confirmation, create/edit/cancel, archive, hub toggle, custom type save |

## Unit test inventory

### `app/(dashboard)/communications/meetings/__tests__/page.test.tsx`

**Meetings page shell**

- shows the plan skeleton until the client list arrives
- renders the plan picker with active clients and no selection
- sets the page title
- restores the sticky communications plan and publishes its subtitle
- disables the picker when there are no clients
- honors a planId deep link and persists the selection
- resolves a client query param case-insensitively
- applies the status query param to the request and the list
- writes the active plan and client filter back to the URL
- opens the plan loading dialog and closes it once meetings settle
- caps the plan loading dialog at six seconds

**Meetings list**

- shows the empty state with two Add Meeting actions
- renders meeting details, statuses, language, and formats
- hides the filter row when the selected plan has no meetings
- filters by status
- filters by benefits category
- sorts meetings by furthest date
- switches to the calendar view and opens the day drawer
- quick-adds a meeting on the chosen calendar day
- forwards drawer edit and delete actions
- switches to the portal preview with the plan brand colors

**Schedule meeting dialog**

- opens with the selected plan and default copy
- enables the end time after a start time and derives the duration
- reveals the custom meeting type input
- switches conditional fields by format
- fills the address from the address picker
- requires the required fields before submitting
- creates a meeting, refreshes, and offers a duplicate
- reports a rejected create and keeps the dialog open
- reports a thrown create
- saves a draft with sensible defaults
- reports a rejected draft save
- reports a thrown draft save
- edits an existing meeting and sends a PUT
- closes an edit without saving and resets on reopen
- duplicates a meeting with prefilled details and warns about the slot
- deletes a meeting after confirmation
- reports a rejected delete
- tracks meaningful edits for the leave guard

**Post-save duplicate flow**

- closes without duplicating when No is chosen
- inherits the snapshot and requires date/time/end before duplicating
- creates the duplicate and closes the dialog
- returns from the duplicate view with Back

**Meetings page edge cases**

- submits a custom meeting type by its typed name
- requires and sends a custom platform for Other
- requires an address for In-Person and sends the address parts
- keeps the previous date when the date picker is cancelled
- parses compact typed times and restores an invalid value on blur
- limits the end-time list to later slots and shows each duration
- autofills the description and tracks its length
- hides Save as Draft while editing
- shows a deleting overlay while the delete request is pending
- accepts a clientId deep link alias
- does nothing (and shows no loader) when the same plan is selected
- leaves the picker empty for an unknown planId
- forwards the drawer duplicate action
- renders the no-link, TBA, and hybrid-link branches
- maps Completed and Cancelled statuses to Past

### `app/api/meetings/__tests__/routes.test.ts`

Real `NextRequest` objects, mocked `next-auth`, `@/lib/prisma`, and `computeStartAtUtc`.

- **`POST /api/meetings`** — 401, core-field 400, non-owned `clientId` 400, owned plan + `startAtUtc` + `maxAttendees`, company-name fallback, no-client creation, nullable defaults, explicit title/status, 500.
- **`GET /api/meetings`** — 401, search/client/type/status filters, `"all"` skips, Scheduled→In Progress, In Progress→Completed, the `"2 hours"`-as-two-minutes behavior, Draft untouched, 500.
- **`PUT /api/meetings/[id]`** — 401, 404, non-owned plan, clearing `clientId`, invalid date, invalid `maxAttendees`, successful update + derived instant, stored-schedule fallback, 500.
- **`PATCH /api/meetings/[id]`** — 401, status whitelist before lookup, 404, success, 500.
- **`DELETE /api/meetings/[id]`** — 401, 404, success payload, 500.
- **`GET /api/meetings/reminders`** — 401, padded window/excluded statuses, exact 0/2/7 tiers, day-then-time sort, 20-item cap, invalid-`today` fallback, 500.
- **`/api/user/[id]/custom-meetings`** — list, list 500, replace (deleteMany + create), save 500, delete requires `meetingId`, delete success.

### `lib/__tests__/meeting-reminders.test.ts`

- tiers, window, limit, excluded statuses, and labels.
- exact offset mapping to `today` / `in_2days` / `in_week`.
- `isDateKey`, `toMeetingDateKey`, `daysBetweenDateKeys`, `formatDateKey`, `dateKeyToUtcDate`.
- reminder ordering by days then time.
- `formatMeetingReminderWhen` for today, future, no timezone, no time.

### `lib/__tests__/meeting-schedule-shared.test.ts`

- `parseLocalDate` bare keys and timestamps.
- timezone abbreviations and fallbacks.
- 12-hour formatting incl. midnight/noon.
- duration picker parsing.
- RSVP preference/fallback.
- shared validation: client optional flag, custom type, Virtual platform/Other, In-Person address, RSVP fallback, all core fields.
- payload helpers: meeting-type resolution, hub location, platform-for-DB.
- default form seeding.

### `lib/__tests__/date-schedule-day.test.ts`

- bare keys, instants, missing/invalid inputs.
- local-midnight round-trip and `MM/DD/YYYY` formatting.
- day differences across months/leap year.
- US scheduling "today" and both DST boundaries.

### `lib/__tests__/meeting-start-at.test.ts`

- New York winter/summer conversions, other US zones.
- default timezone and whitespace handling.
- seconds-bearing 24-hour times.
- `"1:30 PM"` parsed as 01:30 (current behavior).
- `legacyMeetingInstantMs` local interpretation and invalid inputs.
- `getMeetingSortInstantMs` preference/fallback.
- `resolveMeetingStartMs` stored vs derived vs null.

### `lib/__tests__/meeting-display.test.ts`

- dashboard time labels with/without timezone.
- midnight, noon, unknown zone, missing minutes, unparseable hours.
- Today/Tomorrow/other day labels and invalid inputs.

### `lib/__tests__/meeting-store.test.ts`

- fetch saved types, seed defaults, localStorage fallback, empty fallback.
- add with server response, rollback on rejection/throw.
- delete unknown/no-op, success, rollback.
- reset success and rollback.

### `lib/__tests__/meeting-debug-store.test.ts`

- append, dedupe, skip built-ins.
- delete + clear.
- rebase merge/clear, PUT rejection rollback, thrown PUT rollback.

### `components/meetings/__tests__/meetings-calendar-view.test.tsx`

- empty tag, 3-month pages, disabled previous.
- in-window counts, out-of-window exclusion.
- today ring, day selection.
- next/previous paging and dot jumps.
- draft chip styling + tooltip.
- hover quick-add and View Meetings.

### `components/meetings/__tests__/meeting-day-drawer.test.tsx`

- closed/open, day heading, tomorrow-onward gate.
- future vs past empty states.
- time sorting and status mapping.
- virtual details + normalized link; in-person address; missing link.
- edit/duplicate/delete forwarding and collapse.

### `components/meetings/__tests__/plan-meeting-schedule-form.test.tsx`

- list loading + row rendering, empty state, load failure.
- disabled form without a plan, required-field validation.
- virtual create payload + reload.
- conflict confirmation (picker disables occupied slots; date-first override).
- edit/cancel, archive, hub toggle, custom-type save dialog, AI placeholder.

## What is mocked

- **SWR** is keyed by URL on the page suite (`/api/clients`, `/api/meetings…`), with every requested key recorded.
- **Zustand stores** are replaced by stable selector state; stable array identities are required to avoid the page's `setAllMeetingTypes` effect looping.
- **Child surfaces** are prop-capturing stubs: `PlanSearchBar`, `MeetingsCalendarView`, `MeetingDayDrawer`, `WebinarsSection`, `ScaledPreviewFrame`, `AddressSearch`, `PlanChangeLoadingDialog`, `NavigateAwayWarningDialog`, `ConfirmDialog`, and `Switch`.
- **Dialog, Select, Popover, DropdownMenu** are lightweight DOM stand-ins. `Popover` tracks its controlled `open` prop through context; `Select` renders a native `<select>`; the dropdown renders items as buttons.
- **`@/components/ui/calendar`** reports a deterministic `2027-05-10`.
- **`next-auth`, `@/lib/prisma`, `computeStartAtUtc`, `fetch`, and `sonner`** are stubbed in the API/page/component suites.
- API handlers use real `NextRequest` objects; `[id]` handlers receive `{ params: { id } }`.

## Coverage notes

- Sticky selection is scoped to `"communications"`; URL params win and selecting a plan also sets the client filter and rewrites the URL.
- `Scheduled`/`Confirmed` display as **Upcoming**, and `Completed`/`Cancelled` display as **Past**.
- The status request key follows the filter; category and sort are applied client-side.
- The end-time picker is disabled until a valid start exists and only offers later slots, each with its derived duration.
- Typed times accept compact forms (`2pm`, `1330`, `9:05`); an invalid value restores the last valid formatted time on blur.
- The plan-scoped form disables occupied hour/minute/AM-PM combinations once a date exists; the submit-level confirmation is still reachable by changing the date after choosing a time.
- Draft saves fill every API requirement with defaults.
- The calendar renders a fixed 12-month window in 3-month slides and gates quick-add to tomorrow onward.

## Findings and hardening backlog

API/helper findings:

- **Auto-status uses the wrong duration.** `GET /api/meetings` derives the end from `parseInt(duration.replace(/\D/g,""))`, so `"2 hours"` becomes 2 **minutes** and `"1.5 hours"` becomes 15 minutes; `Scheduled` meetings complete almost immediately.
- **PUT overwrites the title.** `meeting: meetingType` replaces the meeting title on every edit.
- **Reads mutate rows.** `GET /api/meetings` persists status transitions while serving a list request (sequential updates per row).
- **12-hour times are parsed as AM.** `computeStartAtUtc` tries `H:mm` before `h:mm A`, so `"1:30 PM"` becomes 01:30.
- **`rebaseCustomMeeting` can throw before its try.** The session fetch sits outside the try/catch, so a session failure rejects instead of rolling back.
- **Custom meeting types have no auth/ownership check.** `GET`/`PUT`/`DELETE /api/user/[id]/custom-meetings` trust the URL's user id.
- **POST accepts an unparseable date** and returns a Prisma-driven 500 instead of a 400.
- **The `client` API filter is case-sensitive**, unlike the POST company-name fallback and the page's client-side filter.

Page/UI findings:

- **The leave guard is never surfaced.** `useNavigateAwayGuard` runs and dirty state is computed, but `leaveGuard`/`NavigateAwayWarningDialog` are never rendered, so the prompt cannot appear and `onSaveAndExit` is dead.
- **Dirty tracking ignores key fields.** `hasMeaningfulMeetingChanges` omits `meetingType`, `description`, `maxAttendees`, `client`, and `clientId`.
- **Status filtering disagrees with the badge.** The list shows `Scheduled`/`Confirmed` as Upcoming, but filtering compares raw statuses and hides them.
- **Duplicate always warns about a self-conflict.** `checkTimeConflict` is called without excluding the original meeting, and the warning fires before a duplicate exists.
- **Footer Cancel is not `handleCancelEdit`.** It only closes the dialog; the reset runs on the next open.
- **Manual time selection never warns about conflicts** on the page (only the plan form checks on selection).
- **Dead code:** `handleGenerateWithAI`, `handleDeleteCusromTypeMeeting`, `StickyPlanCombobox`, and the `deleteCustomMeeting` selector are unused on the page.
- **Unscoped list.** `sortedMeetings` starts from every client's meetings and relies on `clientFilter` being set to the plan name.
- **Equal-date sort is unstable** (returns `-1` for equal values in both directions).

See [`testing.md`](testing.md) for shared conventions, plus the onboarding, auth, settings, chrome, dashboard, documents, and marketing inventories.
