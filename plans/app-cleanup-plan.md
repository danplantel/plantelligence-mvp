# Plantelligence `/app` Folder Cleanup Plan

**Date:** 2026-08-31
**Scope:** Next.js App Router `/app` folder — removing previous-version routes while keeping the new app (`/new`), auth, and API intact.
**Status:** Analysis complete — nothing deleted yet.

---

## Summary

All folders outside [`/new`](app/new) (besides `(auth)` and `api`) belong to the previous version of the app. **None of them are worth keeping** — no folder is referenced by `/new`, `(auth)`, `/api`, or [`middleware.ts`](middleware.ts). `/new` is fully self-contained: it only imports from the shared `@/components`, `@/lib`, `@/hooks`, etc. (all outside `app/`), and internally links only to `/new/*` paths.

---

## KEEP (all verified as needed)

| Item | Reason |
|---|---|
| [`new/`](app/new) | Entire new app (layout, dashboard, clients, documents, onboarding, settings, videos, `view/[id]/*` portal) |
| [`(auth)/`](app/(auth)) | Sign-in/signup/forget/reset/verify flow — root [`page.tsx`](app/page.tsx:9) redirects `/` → `/signin` |
| [`api/`](app/api) | All backend route handlers that `/new` calls (auth, clients, plans, documents, wizard, uploadthing, r2, etc.) |
| [`layout.tsx`](app/layout.tsx) | Root layout with providers, fonts, session — wraps every route |
| [`globals.css`](app/globals.css) | Global styles imported by root layout |
| [`page.tsx`](app/page.tsx) | Root route redirect to `/signin` |
| [`not-found.tsx`](app/not-found.tsx) | Global 404; used by [`middleware.ts`](middleware.ts:55) subdomain rewrites; links to `/new/dashboard` |

---

## DELETE (previous-version folders, safe to remove)

- [`(dashboard)/`](app/(dashboard)) — old dashboard group (dashboard, content-library, documents, my-profile, plan-analytics) — all replaced by `/new` equivalents
- [`view/`](app/view) and [`view-video/`](app/view-video) — old public portals, replaced by [`/new/view/[id]`](app/new/view)
- [`create-new-plan/`](app/create-new-plan) — old
- [`edit-plan/`](app/edit-plan) — old
- [`loading-plan/`](app/loading-plan) — old
- [`plan-specs/`](app/plan-specs) — old
- [`profile/`](app/profile) — old
- [`advisor-messages/`](app/advisor-messages) — old
- [`test-modals/`](app/test-modals) — old/testing
- [`content-library-old/`](app/content-library-old) — explicitly marked old
- [`documents-old/`](app/documents-old) — explicitly marked old
- [`my-profile-old/`](app/my-profile-old) — explicitly marked old
- `view-plans.css` — **unused** (0 imports anywhere in the entire project)

---

## Verification performed

1. Searched all `.tsx`/`.ts` in `app/` for references to each old folder — matches were only inside the old folders themselves or shared `@/components` imports.
2. `(auth)` contains no `router.push/replace`, `href`, or `redirect` calls at all.
3. `/api` redirects only to external signed URLs (R2/S3), never to internal app routes.
4. [`middleware.ts`](middleware.ts:43) is fully aligned with `/new`: subdomain portal → `/new/view/*`, apex portal redirect → `/new/dashboard`, onboarding gate → `/new/onboarding`.
5. [`not-found.tsx`](app/not-found.tsx:33) correctly targets `/new/dashboard`.

---

## Optional cleanup (not required)

- [`middleware.ts`](middleware.ts:131) matcher still lists old `/dashboard/:path*` and `/onboarding/:path*` — harmless to leave, removable for tidiness.
- After deleting the old app folders, the old-version components they imported become dead code (e.g. `components/pages/plan-specs`, `components/pages/advisor-messages`), **except** `components/pages/view-video/` which is still imported by [`/new/view/[id]/*`](app/new/view) — that one must stay. A full dead-code sweep of `components/` would be a separate task.
