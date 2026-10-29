# Marketing Site (`plantel.ai`)

The public marketing page is served by the same Next.js deployment as the
dashboard and participant portals, but it owns a separate origin:
`https://plantel.ai`. The app stays on `https://plantel.pro`.

## Host behaviour

| Request | Result |
| --- | --- |
| `plantel.ai/` | Renders the marketing landing page. |
| `plantel.ai/{anything}` | 308 redirect to `plantel.pro/{anything}`. App and portal URLs are never duplicated on the marketing host. |
| `www.plantel.ai/` | 308 redirect to the canonical apex `plantel.ai/`. |
| `plantel.pro/` | 307 redirect to `/signin`, as before. |
| `plantel.pro/{plan-slug}` | Participant portal, unchanged. |
| `localhost:3000/` (or `127.0.0.1:3000/`) | Renders the marketing landing page. A loopback host previews both sites from one origin. |
| `localhost:3000/{anything}` | App or portal page, unchanged — `/signin`, `/dashboard`, and `/{plan-slug}` are **not** redirected onto another host. |

The logic lives in [`middleware.ts`](../middleware.ts) and the host helpers in
[`lib/marketing/host.ts`](../lib/marketing/host.ts).

Metadata routes (`/opengraph-image`, `/twitter-image`, `/icon`,
`/apple-icon`) are allowed through on the marketing host so social previews and
icons resolve. `robots.txt` and `sitemap.xml` are host-aware: the marketing
origin is crawlable, every other host returns `Disallow: /`.

## Environment variables

Set these in the Vercel project that serves `plantel.ai` (and in `.env.local`
for a local preview):

```bash
NEXT_PUBLIC_MARKETING_URL=https://plantel.ai
MARKETING_HOSTS=plantel.ai,www.plantel.ai
NEXT_PUBLIC_APP_URL=https://plantel.pro
NEXTAUTH_URL=https://plantel.pro
```

`NEXT_PUBLIC_MARKETING_URL` is the canonical origin. `MARKETING_HOSTS` is a
comma-separated allowlist; the `www.` variant is derived automatically for a
two-label apex. `NEXT_PUBLIC_APP_URL` (falling back to `NEXTAUTH_URL`) is where
Sign In and Go to Dashboard point.

## Local preview

A loopback host (`localhost`, `127.0.0.1`, `[::1]`, `*.localhost`) needs no
marketing configuration: middleware claims only the root path for the marketing
page and leaves every other path to the app. Run `pnpm dev` and open
`http://localhost:3000/`.

```bash
pnpm dev
# http://localhost:3000/        → marketing landing page
# http://localhost:3000/signin  → app sign-in
# http://localhost:3000/acme    → participant portal
```

While the request is on a loopback host, [`app/page.tsx`](../app/page.tsx)
also resolves both the app and marketing origins to that same loopback origin
(see `getMarketingPageOrigins`), so "Sign in", "Go to dashboard", and canonical
URLs stay on `localhost` instead of jumping to `plantel.pro`.

`MARKETING_HOSTS` can still list `localhost` explicitly; that keeps the whole
origin in marketing mode (including `app/layout.tsx`'s provider-free render) and
is only useful when you want to inspect the marketing-only shell without the app
providers mounted.

## Vercel and DNS checklist

1. Add `plantel.ai` and `www.plantel.ai` as domains on the Vercel project.
2. Create the DNS records Vercel shows for the apex and `www`.
3. Add the environment variables above to the Production environment (and to
   Preview if preview deployments should serve marketing).
4. Redeploy so middleware reads the new environment.
5. Verify:
   - `curl -I https://plantel.ai/` → `200`
   - `curl -I https://www.plantel.ai/` → `308` to `https://plantel.ai/`
   - `curl -I https://plantel.ai/dashboard` → `308` to
     `https://plantel.pro/dashboard`
   - `curl -I https://plantel.pro/` → `307` to `/signin`
   - `curl https://plantel.ai/robots.txt` → marketing sitemap and
     `Disallow` rules for app paths
   - `curl https://plantel.ai/sitemap.xml` → the marketing root only

## Session behaviour

Session cookies are host-only (see [`lib/auth-options.ts`](../lib/auth-options.ts)).
A `plantel.pro` session is therefore not visible to `plantel.ai`. The header
always offers a **Go to dashboard** link to `plantel.pro/dashboard`; if the
visitor is not signed in there, the app redirects them to sign-in. When a
same-host session does exist (for example a local preview), the primary CTA
swaps to **Go to dashboard** automatically.

## Content guardrails

The page copy lives in [`config/marketing.ts`](../config/marketing.ts). It
deliberately does not claim:

- Synthesia or HeyGen video generation (the FAQ says this explicitly);
- an answering participant chatbot (the chat surface is UI-only);
- completed Life Events checklists;
- customer logos, testimonials, usage metrics, or compliance certifications.

Update the config, not the section components, when the shipped feature set
changes.
