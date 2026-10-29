# Header & Sidebar Testing

This document is the test inventory for [`components/layout/header.tsx`](../../components/layout/header.tsx) and [`components/layout/sidebar.tsx`](../../components/layout/sidebar.tsx): the fixed app chrome, its editor/portal modes, the responsive rail, role-based nav filtering, and persisted collapse state.

## Summary

- **Unit tests:** 58 passing across 3 files
- **Header:** 21 tests
- **Sidebar:** 31 tests
- **Layout client:** 6 tests
- **Runner:** Vitest + React Testing Library + jsdom
- **E2E:** 4 Playwright journeys in `e2e/header-sidebar.spec.ts` (skipped unless configured)

## Running these tests

Chrome-only commands:

```bash
pnpm test:header-sidebar           # Header + Sidebar + layout suites (58 tests)
pnpm test:header-sidebar:watch     # watch mode
pnpm test:header-sidebar:coverage  # suites + V8 coverage
```

These are backed by `config/vitest/vitest.header-sidebar.config.mts` and
`scripts/tests/run-header-sidebar-tests.mjs`.

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

File: `e2e/header-sidebar.spec.ts`

These require `E2E_BASE_URL` (or `E2E_START_SERVER=1`) plus `E2E_EMAIL` / `E2E_PASSWORD`. The collaborator journey also needs `E2E_COLLABORATOR_EMAIL` / `E2E_COLLABORATOR_PASSWORD`. They skip cleanly when unconfigured.

- **sidebar**
  - keeps the collapsed rail across a reload
  - collapses beside the preview editor without losing the saved preference
- **header**
  - portals the Settings tab strip into the header
- **collaborator chrome**
  - only shows destinations the collaborator may reach

Still worth adding: a Viewer-specific nav journey and a real Edit Plan/Edit Benefit panel journey.

## Test inventory

| #   | Suite                                                | Tests | Focus                                                                                                                                                                                                        |
| --- | ---------------------------------------------------- | ----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `components/layout/__tests__/header.test.tsx`        |    21 | Title/subtitle/company split, stepper/editor modes, header tab portal detection and mode switching, theme toggle, scroll chrome, listener cleanup                                                            |
| 2   | `components/layout/__tests__/sidebar.test.tsx`       |    31 | Persisted rail state (including storage failures), responsive widths, `--sidebar-width`, access skeleton, reactive access/media changes, collaborator filtering, logos, editor collapse, wizard step-2 width |
| 3   | `components/layout/__tests__/layout-client.test.tsx` |     6 | Standalone onboarding/auth chrome, wizard steppers, path refusal, and the onboarding → dashboard hook-order transition                                                                                       |

## Unit test inventory

### `components/layout/__tests__/header.test.tsx`

**Header**

- renders the page title, subtitle, step title, and action cluster
- renders nothing for the title group when title, subtitle, and step are empty
- splits a company name out of the page title
- keeps a title with no company separator intact
- renders a subtitle separator
- shows the in-flow stepper when the editor is closed
- moves the stepper into the overlay and hides the title while editing
- reacts to the step-2 editor event and restores the bar when it closes
- detects a page tab strip portalled into the header
- collapses the tab-strip allowance when the portalled content is removed
- toggles from light to dark
- toggles from dark to light
- adds the scrolled chrome only after the window scrolls
- removes the scrolled chrome when the page returns to the top
- splits on the first separator only
- treats an unresolved theme as light and toggles to dark
- hides the step title while editing too
- compacts the user menu and left-aligns portalled tabs while editing
- clears the tab-strip allowance when switching to a stepper
- closes the editor mode when the event has no detail
- removes its window listeners on unmount

### `components/layout/__tests__/sidebar.test.tsx`

**Sidebar**

- defaults to an open rail
- restores a collapsed preference from localStorage
- restores an open preference from localStorage
- falls back to open when the saved value is not true/false
- collapses, persists the preference, and swaps the toggle label
- expands again and persists the preference
- uses the narrower rail between 1024 and 1280px
- writes the rail width to `--sidebar-width`
- shows the nav skeleton while the access summary loads
- shows every item to a non-collaborator
- filters a collaborator's disallowed top-level items
- filters a collaborator's disallowed children
- drops a group whose every child was filtered out
- passes the collaborator gate and permission checker to `mayUsePath`
- uses the dark logos for the dark theme
- shows the icon logo when the rail is collapsed
- rail-collapses while the preview editor is open without changing the preference
- restores the user's rail state when the preview editor closes
- keeps the wizard's 36rem width while step 2 is active
- restores the rail width after leaving step 2
- opens normally when `localStorage.getItem` throws
- still toggles when `localStorage.setItem` throws
- restores the rail when the preview event has no detail
- follows a viewport change while mounted
- uses the light logos when the theme resolves to system
- re-filters when the access summary changes
- renders an empty nav when a collaborator may reach nothing
- writes 4rem to `--sidebar-width` when collapsed
- keeps a top-level item that has no href
- opens the logo in a new tab
- removes its preview-layout listener on unmount

### `components/layout/__tests__/layout-client.test.tsx`

**NewLayoutClient**

- renders onboarding standalone, without the dashboard chrome
- renders auth pages standalone
- moves from onboarding to the benefits wizard without changing hook order
- moves from sign-in to the new-client wizard without changing hook order
- shows no stepper outside the wizard routes
- renders the refusal instead of the page when the path is not allowed

## Source changes required by the tests

- **Both navs have accessible names.** Header is `aria-label="Primary"`, Sidebar is `aria-label="Main"`.
- **Sidebar toggle has an accessible name.** The collapse/expand button carries `aria-label="Collapse sidebar"` / `"Expand sidebar"`.
- **Corrupted persistence falls back to open.** An unrecognised `sidebar-is-open` value previously evaluated to `false` and locked the rail collapsed; it now defaults to open.
- **Storage failures are contained.** Both `getItem` (initializer) and `setItem` (toggle + persistence effect) are wrapped; disabled/quota-blocked storage can no longer crash the layout or abort the toggle.
- **Stepper mode clears the tab-strip allowance.** Switching from a portalled tab strip to a stepper no longer leaves `portalHasContent` latched, so `UserNav` returns to its normal details breakpoint.
- **All hooks run before the layout's early returns.** `NewLayoutClient` used to subscribe to the wizard stores only after returning early for `/onboarding` and the auth pages. Moving from one of those routes to a dashboard route changed the hook count and crashed with "Rendered more hooks than during the previous render"; the subscriptions now sit above every return, and `layout-client.test.tsx` pins the transition.

## Mocking strategy

**Header**

- `@/hooks/usePageTitleContext` supplies the title/subtitle.
- `next-themes` supplies `resolvedTheme` and records `setTheme`.
- `MessagesToggle`, `CommentsToggle`, `NotificationsMenu`, and `UserNav` are contract stubs; `UserNav` records `compact` / `detailsFrom`.
- The header renders its own `#header-tabs-portal`; the test appends/removes children so the real `MutationObserver` drives `portalHasContent`.
- `window.scrollY` is redefined and `scroll` events are dispatched to exercise the scrolled chrome.
- Editor state is driven through the real `step5EditorStateChange` / `step2EditorStateChange` window events.

**Sidebar**

- `@/hooks/useViewerAccess` is a `useSyncExternalStore`-backed fake so access changes re-filter the nav without remounting.
- `@/hooks/useMediaQuery` is also reactive, so a 16rem → 13rem viewport change is exercised.
- `@/lib/new-client-wizard-store` is a `useSyncExternalStore`-backed fake so `currentStep` changes re-render the memoised sidebar.
- `@/lib/teammates/nav-access` records `mayUsePath` calls and filters by an allow-list.
- `@/constants/data` supplies a small nav tree; `@/components/ui/dashboard-nav` records the filtered items and `isOpen`.
- `localStorage` is cleared per test; `Storage.prototype.getItem`/`setItem` are spied to throw in the robustness tests.
- `--sidebar-width` is reset on `documentElement`.
- The preview editor event is dispatched using the real `PREVIEW_EDITOR_LAYOUT_EVENT` constant.

## Coverage boundaries

- The child controls (`NotificationsMenu`, the comments/messages toggles, `UserNav`, `DashboardNav`, `Skeleton`) are stubbed; their own behavior belongs in dedicated suites.
- Header portal coverage simulates a page portal by appending a `[role="tablist"]`; it does not mount Settings/Edit Plan.
- Sidebar filtering is tested against `mayUsePath` mocked with an allow-list, not the real permission grid.
- Width assertions use the inline `style.width` value; responsive CSS breakpoints themselves are not rendered by jsdom.
- The Playwright spec exercises persistence, editor collapse, the Settings tab strip, and collaborator nav against a real app when credentials are supplied.

## Remaining test gaps

| Candidate                                                                            | Why it matters                                                                    |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `components/layout/notifications-menu.tsx`                                           | Bell popover, unread badges, fetch/refresh behavior.                              |
| `components/layout/user-nav.tsx`                                                     | Avatar/name breakpoints, menu actions, sign-out, `compact` variants.              |
| `components/comments/comments-toggle.tsx`, `components/messages/messages-toggle.tsx` | Toggle state, badges, panel wiring.                                               |
| `components/ui/dashboard-nav.tsx`                                                    | Link rendering, groups/accordions, active-route highlighting, collapsed tooltips. |
| `lib/teammates/nav-access.ts`                                                        | The real `mayUsePath` matrix, including parent/child group rules.                 |
| Viewer nav journey                                                                   | A Viewer must not see Branding/Organization while the chrome stays usable.        |
| Per-editor E2E                                                                       | Edit Plan and Edit Benefit panels, not just the synthetic layout event.           |

See [`testing.md`](testing.md) for shared conventions, plus the onboarding, auth, and settings inventories in that folder.
