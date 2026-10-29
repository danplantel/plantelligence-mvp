<p align="center">
  <img src="public/plantelligence-logos/pt_web_light.png" alt="PlanTelligence Logo" width="50%">
</p>

<p align="center">
  <i>Benefits communication, plan workspaces, and a participant portal in one platform.</i>
</p>

## Overview

**PlanTelligence** is a benefits communication platform for the people who
administer and support employer benefit plans. It gives advisors, TPAs, and
plan sponsors one place to set up a plan, build its benefits content, publish a
branded participant portal, and keep the communication around that plan
current.

The product is built with Next.js (App Router), TypeScript, Tailwind CSS,
Prisma/PostgreSQL, and NextAuth. Participant-facing files are stored in
Cloudflare R2. The public marketing site is served on its own origin,
[`plantel.ai`](https://plantel.ai), while the dashboard and participant portals
remain on [`plantel.pro`](https://plantel.pro).

## Product surface

### Plan workspaces

- Guided plan creation for company basics, key contacts, compliance documents,
  and disclosures.
- Plan-level branding: logo, hero imagery, favicon, brand colors, and
  typography themes.
- Live desktop and mobile previews of the participant experience.
- Employee Resources as a plan-level surface, independent of the four benefit
  categories.
- Plan visibility controls and participant-facing disclaimers.

### Benefits builder

- Dedicated hubs for Retirement, Group Health, Group Life, and a custom
  benefit.
- A reusable topic library with Featured cards, grouped Quick Answers, and
  action-hub panels.
- Plan documents, plan videos, key contacts, and landing cards attached to the
  benefit category where participants need them.
- AI-assisted suggestions for brand colors, naming, typography, document
  names, and flyer copy. Suggestions are applied by the advisor.
- Benefit completion tracking and category-level visibility.

### Participant portal

- A branded hub home with benefits, announcements, and team contacts.
- News and Events, Employee Resources, and Webinars and Replays.
- My Benefits Team with contact cards and a public contact form.
- Portal notices, pop-ups, and news posts.
- Installable progressive-web-app experience for participants.
- Configurable disclaimers and disclosures on participant surfaces.
- Participant-facing video sections that present plan videos; PlanTelligence
  does not currently generate videos with Synthesia or HeyGen.
- A guided chat surface in the portal. Automated answer generation is not part
  of the current release.

### Communications

- Meetings calendar with scheduling and reminder support.
- Webinars and replays published into the portal.
- Meeting-based and topical flyers, including QR codes that link to the plan's
  portal.
- A plan-level asset library for flyers, portal notices, pop-ups, and news
  posts.
- AI-assisted flyer copy with advisor review before publishing.

### Documents and team

- A searchable document library with categories and plan-level organization.
- Secure uploads and signed access for participant-facing files.
- Owner, team member, and collaborator roles.
- Collaborator access scoped by benefit category and permission level.
- Invitations, seat management, and ownership transfer.
- Direct messages, comment threads, attachments, and task assignment.
- A dashboard with active plans, tasks, meetings, needs-attention signals,
  recent activity, and team overview.

## Marketing site

The public marketing page is a single-scroll site at the root of
`https://plantel.ai`. It uses anchor navigation (`#features`, `#portal`,
`#communications`, `#team`, `#faq`) and sends all account actions to the app
origin.

Host behaviour is enforced in [`middleware.ts`](middleware.ts) with helpers in
[`lib/marketing/host.ts`](lib/marketing/host.ts):

| Request | Result |
| --- | --- |
| `plantel.ai/` | Marketing landing page |
| `plantel.ai/{anything}` | 308 redirect to `plantel.pro/{anything}` |
| `www.plantel.ai/` | 308 redirect to `plantel.ai/` |
| `plantel.pro/` | 307 redirect to `/signin` |
| `plantel.pro/{plan-slug}` | Participant portal, unchanged |

The page copy and feature inventory live in
[`config/marketing.ts`](config/marketing.ts). The visual sections live in
[`components/marketing`](components/marketing). Deployment and local-preview
details are in [`docs/marketing-site.md`](docs/marketing-site.md).

## Architecture

- **Framework:** Next.js 14 App Router, React 18, TypeScript
- **Styling:** Tailwind CSS with shadcn/Radix primitives
- **Database:** PostgreSQL through Prisma
- **Authentication:** NextAuth (credentials and Google)
- **File storage:** Cloudflare R2 (S3-compatible)
- **AI helpers:** Google Gemini for brand, naming, typography, document-name,
  and flyer-copy suggestions
- **Email:** SMTP / Resend integrations for notifications and contact forms
- **Testing:** Vitest + Testing Library, Playwright for E2E

### Repository structure

```text
app/                    Next.js routes (dashboard, portal, API, marketing root)
components/             Shared UI, portal sections, wizards, marketing sections
config/                 Onboarding and marketing content
contexts/               Client portal and loading providers
lib/                    Domain logic, Prisma helpers, R2, marketing host helpers
prisma/                 Schema and migrations
public/                 Brand assets, fonts, PWA icons
scripts/                Backfills, verification scripts, test runners
types/                  Shared TypeScript types
docs/                   Implementation and testing notes
e2e/                    Playwright specs
```

## Getting started

1. Clone the repository and install dependencies:

   ```bash
   pnpm install
   ```

2. Create `.env.local` with the values for your environment. At minimum:

   ```bash
   DATABASE_URL=postgresql://...
   DIRECT_URL=postgresql://...
   NEXTAUTH_SECRET=...
   NEXTAUTH_URL=http://localhost:3000
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   NEXT_PUBLIC_ROOT_DOMAIN=localhost
   ROOT_DOMAIN=localhost
   ```

3. Start the development server:

   ```bash
   pnpm dev
   ```

4. Open [http://localhost:3000/signin](http://localhost:3000/signin).

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Pooled PostgreSQL connection used by the app |
| `DIRECT_URL` | Direct PostgreSQL connection used by Prisma migrations |
| `VAPID_PUBLIC_KEY` | Web push signing key, public half (server). Falls back to `NEXT_PUBLIC_VAPID_PUBLIC_KEY` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | The same public key, inlined into the browser bundle so it can subscribe |
| `VAPID_PRIVATE_KEY` | Web push signing key, private half. Never exposed to the client |
| `VAPID_SUBJECT` | `mailto:` or origin URL identifying the push sender |
| `NEXTAUTH_SECRET` | NextAuth JWT/session secret |
| `NEXTAUTH_URL` | App origin used by NextAuth |
| `NEXT_PUBLIC_APP_URL` | Public app origin used by links and portals |
| `NEXT_PUBLIC_ROOT_DOMAIN` / `ROOT_DOMAIN` | Portal URL root |
| `NEXT_PUBLIC_MARKETING_URL` | Canonical marketing origin (`https://plantel.ai`) |
| `MARKETING_HOSTS` | Comma-separated marketing host allowlist |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `GEMINI_API_KEY` | AI suggestion helpers |
| `R2_*` | Cloudflare R2 bucket, endpoint, and credentials |
| `MAIL_*` / email provider keys | Outbound email |

Do not commit real secrets. `.env` is a local/production-default file for the
maintainers; deployment values belong in the hosting project's environment
settings.

Web push is **disabled, not broken**, when its VAPID variables are unset: the sender logs one
warning per process and returns, so notifications and messages keep working and only the push is
skipped. Generate a pair with `npx web-push generate-vapid-keys` — one pair **per environment**,
kept permanently, because every stored subscription is bound to the key that created it. Rotating the
pair invalidates every subscription and every reader has to opt in again. `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
is read at **build** time, so a key added after a build needs a redeploy rather than a restart. See
[`docs/testing/push-tests.md`](docs/testing/push-tests.md).

## Testing

```bash
pnpm test                 # Vitest, all suites
pnpm test:watch           # Vitest in watch mode
pnpm test:coverage        # Vitest with V8 coverage
pnpm exec tsc --noEmit    # type check
pnpm lint                 # Next.js lint
pnpm test:e2e             # Playwright
```

Focused suites keep their own Vitest configs, for example
`pnpm test:marketing`, `pnpm test:portal-landing`, and `pnpm test:webinars`.
The marketing site has dedicated unit coverage in
[`lib/marketing/__tests__/host.test.ts`](lib/marketing/__tests__/host.test.ts),
[`config/__tests__/marketing.test.ts`](config/__tests__/marketing.test.ts), and
[`components/marketing/__tests__`](components/marketing/__tests__), plus
[`e2e/marketing-site.spec.ts`](e2e/marketing-site.spec.ts).

## Portal URLs

Participant portals are public and slug-based at the environment root:

- Production: `https://plantel.pro/{plan-slug}`
- Development: `https://dev.plantel.pro/{plan-slug}`

The owning advisor is resolved from the globally unique `Client.slug`. See
[`docs/slug-based-plan-urls.md`](docs/slug-based-plan-urls.md) and
[`lib/portal-access.ts`](lib/portal-access.ts).

## Current limitations

- PlanTelligence presents plan videos; it does not generate videos with
  Synthesia or HeyGen.
- The participant chat surface is UI-only; automated answers are not shipped.
- Life Events entry points exist, but the full guided-checklist destination is
  not part of the current release.
- The topic framework is rolled out through the `TOPIC_FRAMEWORK_PLANS`
  allowlist; copy should describe the capability rather than promising it to
  every plan.
- No customer logos, testimonials, usage metrics, pricing, or compliance
  certifications are published on the marketing site without verified source
  material.

## License

This project is not yet licensed, and the source code is proprietary.
Unauthorized distribution, modification, or use of this code is prohibited.
Access is limited to authorized personnel only, and any use outside of granted
permissions is strictly forbidden. For inquiries regarding permissions or
potential licensing, please contact the project owner via email: Ty Rogers,
ty at waypointfas.com.
