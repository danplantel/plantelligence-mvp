# Portal News & Events Testing

This document is the test inventory for [`app/(portal)/[id]/news-events/page.tsx`](<../../app/(portal)/[id]/news-events/page.tsx:10>) and the three surfaces it composes: the header, the published news-post list and the webinars section.

The page is a composition layer. It reads the portal's plan context, chooses brand colors and the plan id, resolves the header background, and mounts the header, published news posts and webinars. The child suites cover the rendering those sections own.

## Summary

- **Unit tests:** 54 passing across 6 files.
  - page composition: 12
  - page + real header integration: 8
  - `NewsPostList`: 19
  - `NewsEventsHeader`: 5
  - `WebinarsDashboard`: 3
  - `useMarketingAssets` / `useNewsPostAssets`: 7
- **E2E:** none dedicated for this route.
- **Runner:** Vitest + React Testing Library + jsdom.

## Running these tests

```bash
pnpm exec vitest run "app/(portal)/[id]/news-events/__tests__"
pnpm exec vitest run "components/pages/client-portal/sections/__tests__/news-post-list.test.tsx"
pnpm exec vitest run "components/pages/client-portal/sections/__tests__/news-events-header.test.tsx"
pnpm exec vitest run "components/pages/client-portal/sections/__tests__/webinars-dashboard.test.tsx"
pnpm exec vitest run "hooks/__tests__/useMarketingAssets.test.ts"
```

All tests:

```bash
pnpm test
pnpm test:watch
pnpm test:coverage
```

## Test inventory

| #   | Suite                                                                           | Tests | Focus                                                                                      |
| --- | ------------------------------------------------------------------------------- | ----: | ------------------------------------------------------------------------------------------ |
| 1   | `app/(portal)/[id]/news-events/__tests__/page.test.tsx`                         |    12 | Composition, brand forwarding, header background input/output, white surface               |
| 2   | `app/(portal)/[id]/news-events/__tests__/integration.test.tsx`                  |     8 | Real header default/resolved background, absolute/data URLs, color fallbacks, one `h1`     |
| 3   | `components/pages/client-portal/sections/__tests__/news-post-list.test.tsx`     |    19 | Loading/empty/sort, headline, category, dates, background map, CTA, brand color, client id |
| 4   | `components/pages/client-portal/sections/__tests__/news-events-header.test.tsx` |     5 | Default/custom title and background, empty background, plain `<img>`, overlay              |
| 5   | `components/pages/client-portal/sections/__tests__/webinars-dashboard.test.tsx` |     3 | Only `WebinarsSection`, prop forwarding, `enableEditing` not forwarded                     |
| 6   | `hooks/__tests__/useMarketingAssets.test.ts`                                    |     7 | No-client key, public feed URL, options, payload shape, error/loading, type filters        |

## Page composition

### `page.test.tsx`

- renders the header, news posts and webinars
- does not render the commented-out resources section
- forwards `clientId`, `brandColor` and `secondaryColor` to both lists
- falls back to `#1F3A60` / `#6B7280` without client data
- fills each missing color independently
- passes the stored `secondaryBannerImg` to `useBrandingImageUrl`
- trims surrounding whitespace
- passes `null` for empty and whitespace-only banners
- hands the resolved URL to the header
- passes `undefined` when no URL resolves
- renders on the white portal surface inside `<main>`

### `integration.test.tsx` (real header)

- default `/news-events-default-bg.webp` when no URL resolves
- resolved header background
- absolute banner URL passed through
- data URL passed through
- portal default colors when `clientData` is undefined
- only the missing brand color falls back
- only the missing secondary color falls back
- exactly one `h1`

## `NewsPostList`

### `news-post-list.test.tsx`

- loading: pulse skeleton, no section heading
- empty: renders `null`
- sorts by `createdAt` descending
- empty headline falls back to **Announcement**
- category badge + `flyerSubtitle`
- body copy
- created date as `MMM d, yyyy`
- start–end date range
- start-only window omits the separator
- `bg_01`–`bg_04` map to their public paths
- an unknown `bgImage` shows the brand gradient and no image
- CTA with a bare URL normalizes to `https://`
- CTA with an explicit `https://` is preserved
- CTA text without a URL is a non-link
- no CTA text renders no CTA
- brand color on the section heading
- `data: null` falls back without crashing
- client id passed to the hook
- no client id passed as `undefined`

## `NewsEventsHeader`

### `news-events-header.test.tsx`

- default title, background and alt
- custom title, background and alt
- empty background omits the image
- a plain `<img>` keeps an R2 proxy URL as-is
- the dark overlay stays behind the heading

## `WebinarsDashboard`

### `webinars-dashboard.test.tsx`

- renders only `WebinarsSection`
- forwards `brandColor`, `secondaryColor` and `clientId`
- does not forward `enableEditing`

## `useMarketingAssets`

### `useMarketingAssets.test.ts`

- no client id → `null` SWR key and an empty list
- public news-post feed URL and 30s dedupe/no-focus-revalidate options
- returns the payload's `data` array
- `data: null` → empty array
- error and loading flags pass through
- pop-up type filter
- portal-notice type filter

## Manual checklist

- [ ] `/acme/news-events` renders the News & Events header.
- [ ] Published Marketing news posts appear below the header.
- [ ] Upcoming webinars appear below the posts.
- [ ] A plan with a Page Image Header shows that image behind the header.
- [ ] A plan without one shows the bundled news-events default background.
- [ ] An R2 key (`org/...`) in `secondaryBannerImg` resolves to a usable image URL rather than a relative `/org/...` request.
- [ ] The plan's brand color styles the post and webinar sections.
- [ ] A plan with no brand colors uses the portal defaults.
- [ ] A post with a category badge, subtitle, body and CTA renders all four.
- [ ] A post without a background image uses the brand gradient.
- [ ] A bare CTA URL becomes a working `https://` link.
- [ ] The Resources section stays absent while its JSX is commented out.
- [ ] The page keeps its white surface and bottom padding on mobile and desktop.

## Known gaps

1. **`WebinarsSection` itself is not covered here.** Its loading/empty/failure, upcoming/past grouping, cards, registration links, hover preview and on-demand video are a separate suite.
2. **`useBrandingImageUrl` is mocked.** The page suite proves the input and output wiring; R2-key resolution and the `/api/r2/object` proxy have their own coverage.
3. **`NewsPostList` uses a mocked `framer-motion`.** Animation timing and viewport triggers are not asserted.
4. **No E2E.** A browser journey would prove the portal context, the R2 background and the published posts/webinars together.

## Future coverage

### Webinars

- `WebinarsSection` loading/empty/failure
- upcoming vs. past grouping
- registration/join link
- hover preview and video playback
- missing `clientId` short-circuit

### Page and posts

- a post with `startDate` only and `endDate` only
- a CTA URL with `http://`
- a CTA URL with an unsupported scheme
- `clientData` present but `id` missing
- a context whose `secondaryBannerImg` is a whitespace string with surrounding content

### E2E (Playwright)

A future `portal-news-events.spec.ts` should cover:

- a seeded plan's `/news-events` page showing the header, at least one post and one webinar;
- the header background resolving from an R2 key;
- a post CTA opening its external URL in a new tab;
- a plan with no posts/webinars showing the child empty states;
- the page at a mobile viewport.

## Related documentation

- [`docs/testing/testing.md`](testing.md) — the shared runner, conventions and inventory structure.
- [`docs/testing/documents-tests.md`](documents-tests.md) — the portal-facing document lists.
- [`docs/testing/marketing-tests.md`](marketing-tests.md) — the Marketing module that publishes news posts.
- [`docs/testing/webinars-tests.md`](webinars-tests.md) — the webinar data rendered here.
