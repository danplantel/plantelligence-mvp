# Web Push Testing

This document is the test inventory for web push: the service worker handlers in [`public/sw.js`](../../public/sw.js), the client helpers in [`lib/pwa/push.ts`](../../lib/pwa/push.ts), the subscription API at [`app/api/push/subscribe/route.ts`](../../app/api/push/subscribe/route.ts), the sender in [`lib/push/push.server.ts`](../../lib/push/push.server.ts), and the dashboard→portal link resolver in [`lib/push/portal-href.ts`](../../lib/push/portal-href.ts).

## Summary

- **Unit tests:** 63 passing in 6 files
- **Verification script:** [`scripts/push/verify-push.ts`](../../scripts/push/verify-push.ts) — real database, real data layer
- **Runner:** Vitest + jsdom, plus a `node:vm` sandbox for the service worker
- **No E2E:** a real push requires a browser with a push service, so the browser half is covered by unit tests and the manual checklist below

## Running these tests

```bash
pnpm test:push           # all push unit suites (63 tests)
pnpm test:push:watch     # watch mode
pnpm test:push:coverage  # with V8 coverage
```

Backed by [`config/vitest/vitest.push.config.mts`](../../config/vitest/vitest.push.config.mts) and [`scripts/tests/run-push-tests.mjs`](../../scripts/tests/run-push-tests.mjs).

Database verification (needs a reachable database and `DATABASE_URL`):

```bash
npx tsx scripts/push/verify-push.ts          # cleans up its fixtures
npx tsx scripts/push/verify-push.ts --keep   # leaves them for inspection
```

## What each file covers

| File | What it pins |
|---|---|
| [`lib/push/__tests__/types.test.ts`](../../lib/push/__tests__/types.test.ts) | Notification type → preference category. Four comment events, one switch. Unknown types return null, which the sender reads as "do not push". |
| [`lib/push/__tests__/portal-href.test.ts`](../../lib/push/__tests__/portal-href.test.ts) | The dashboard→portal translation, including the two vocabularies (`group-health` → `health-insurance`) and the refusal to invent a portal page for a direct message. |
| [`lib/push/__tests__/subscriptions.test.ts`](../../lib/push/__tests__/subscriptions.test.ts) | Endpoint and key validation: https only, base64url only, bounded length. |
| [`app/api/push/subscribe/__tests__/route.test.ts`](../../app/api/push/subscribe/__tests__/route.test.ts) | Session scoping on every verb; endpoint upsert; plan resolution; preference validation that refuses to wipe opt-outs on a contract mismatch. |
| [`lib/push/__tests__/push.server.test.ts`](../../lib/push/__tests__/push.server.test.ts) | The allowlist, per-surface destination, same-origin enforcement, tag/topic collapse, opt-out filtering, 410 pruning vs 500 counting, and that the sender never throws into the write that triggered it. |
| [`public/__tests__/service-worker.test.ts`](../../public/__tests__/service-worker.test.ts) | The worker evaluated in a VM: the `fetch` listener stays a pass-through, payloads are parsed defensively, off-origin destinations are refused, and a click either focuses a window or opens one. |

## The service worker harness

[`public/__tests__/service-worker.test.ts`](../../public/__tests__/service-worker.test.ts) reads the real file and runs it with `node:vm` against a stubbed `self`, so the tests exercise the shipped source rather than a copy. Two things it deliberately refuses to regress:

1. **`fetch` never calls `respondWith`.** The portal's data is live and per-participant; serving a cached copy of somebody's benefits is worse than the browser's offline page.
2. **A notification tap cannot leave the origin.** A tap is a navigation the reader never typed, so an off-origin `url` collapses to `/`.

## Manual checklist

Automated tests cannot see a real push service. Before shipping a release that touches this feature:

1. **Android/Chrome, installed PWA** — install a portal, tap "Turn on", accept the permission, send a DM from another account, confirm the notification arrives with the app closed, and that tapping it opens `/{slug}`.
2. **iOS 16.4+, installed PWA** — Add to Home Screen first, then opt in from inside the installed app (a Safari tab cannot subscribe). Confirm the notification arrives with the app closed.
3. **iOS, Safari tab** — confirm the opt-in bar does NOT appear, and that the dashboard Settings card explains the Home Screen requirement instead of offering a dead button.
4. **Collapse** — send five messages in one thread; expect one notification on the tray, not five.
5. **Opt-out** — turn "Comments" off in Settings → Profile, have someone reply in a thread, and confirm the bell updates while no notification arrives.
6. **Permission revoked** — after subscribing, block notifications in browser settings, reload, and confirm the card explains the block rather than claiming success.
7. **No VAPID keys** — with `VAPID_PRIVATE_KEY` unset, confirm the app still writes notifications and sends messages normally, and only the push is skipped.

## Environment

Push is disabled, not broken, when these are unset — the sender logs one warning per process and returns:

| Variable | Purpose |
|---|---|
| `VAPID_PUBLIC_KEY` | Server-side public key. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is the fallback. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | The key the browser passes to `pushManager.subscribe`. |
| `VAPID_PRIVATE_KEY` | Signs the send. Never exposed to the client. |
| `VAPID_SUBJECT` | A `mailto:` or origin URL identifying the sender; defaults to `mailto:support@plantel.pro`. |

Generate one pair per environment with `npx web-push generate-vapid-keys`. Treat the pair as permanent: **rotating the keys invalidates every stored subscription**, so a rotation means clearing `PushSubscription` and having every reader opt in again.

## Related

- Plan: [`plans/web-push-notifications.md`](../../plans/web-push-notifications.md)
- Bell and notification rows: [`lib/notifications/notifications.server.ts`](../../lib/notifications/notifications.server.ts)
- PWA install flow: [`components/pages/client-portal/sections/portal-install-app.tsx`](../../components/pages/client-portal/sections/portal-install-app.tsx)
