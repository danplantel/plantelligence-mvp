# Teammates Module

Source spec: `Team_Collaborator_Access_Developer_Spec (1).pdf`
T1 design + rationale: [`plans/teammates-t1-data-model.md`](../plans/teammates-t1-data-model.md)

This document covers the data foundation (ticket **T1**) that the rest of the
Team & Collaborator Access feature builds on: T2 (enforcement), T2a (Custom role
grid), T3-T8.

---

## 1. Where things live

| Concern | Location |
|---|---|
| Permission-grid contract (pure) | [`types/teammate.ts`](../types/teammate.ts) |
| Permission rules engine (pure) | [`lib/teammates/permissions.ts`](../lib/teammates/permissions.ts) |
| Role descriptions for the UI (pure, derived from the grids) | [`lib/teammates/role-summary.ts`](../lib/teammates/role-summary.ts) |
| Company-picker scope rule (pure) | [`lib/teammates/company-scope.ts`](../lib/teammates/company-scope.ts) |
| Teammate data access (server) | [`lib/teammates/`](../lib/teammates) |
| Organization helpers (server) | [`lib/organization.ts`](../lib/organization.ts) |
| Session/org resolution | [`lib/organization-session.ts`](../lib/organization-session.ts) |
| Verification + ops scripts | [`scripts/teammates/`](../scripts/teammates) |

The data-access modules are named `*.server.ts` deliberately: they import Prisma
and must never be pulled into a client bundle.

---

## 2. Data model

```mermaid
erDiagram
    User ||--o| Organization : owns
    Organization ||--o{ TeammateCompany : has
    Organization ||--o{ TeammateProfile : has
    Organization ||--o{ Client : has
    TeammateCompany ||--o{ TeammateProfile : employs
    TeammateProfile ||--o{ PlanAssignment : holds
    Client ||--o{ PlanAssignment : scoped_to
    TeammateProfile ||--o{ TeammateAuditEvent : logged_for
    PlanAssignment ||--o{ TeammateAuditEvent : logged_for
```

- **`Organization`** — tenancy root. One per advisor `User` (`ownerUserId`),
  created at signup or by the backfill script.
  Its `name`, `organizationEmail`, `branding` and the **firm profile**
  (`organizationType`, `customOrganization`, `teamSize`) are a **derived mirror** of the
  owner's `User` row, kept current by `syncOrganizationIdentity` in
  [`lib/organization.ts`](../lib/organization.ts), which all three profile write paths call
  (`app/api/profile`, `app/api/profile/update-profile`, and `app/api/onboarding-wizard/user-setup`).
  The `User` stays the single source; if you add another writer of those fields, call the sync
  there too — `verify-organization-sync` asserts the whole mirror
  (`npm run teammates:verify-org`).

  Why it matters, precisely: `Organization.name` is what every invitation email greets the
  recipient with, so a mirror frozen at signup means renamed organizations keep sending the
  old name. The T3 domain guess (via `getOrganizationDomains`) unions this mirror with the
  owner's own row, so it was **never** actually affected by staleness — the email mirror is
  kept true because it is the organization-level copy of that address.

  Settings → Organization writes the firm profile to the **`User` row**, not to
  `wizardSessions[0]`: a wizard session is one advisor's onboarding draft, so an
  organization-level setting saved there was invisible to the organization (and to a second
  admin). That tab is also the reason these three columns exist on `Organization` at all —
  they are the organization-owned copy of data that previously lived only in the owner's
  session.
- **`TeammateCompany`** — Partner Company (spec Part B item 2). Always
  `entityType = partner_provider`. One company serves many profiles.
- **`TeammateProfile`** — the reusable person (spec Part B item 1): identity,
  contact details, specialty, optional partner company, optional global
  `loginUserId`, and the Team-Member-only `allPlans` flag.
- **`PlanAssignment`** — one record per person per plan (spec Part B item 3):
  category scope, role, the full `permissionSet` grid, and the hub-visibility
  toggle.
- **`TeammateAuditEvent`** — who changed what, when, and which soft warnings were
  confirmed.

### Org anchoring is additive by design

`User.id` remains the anchor for every pre-existing query (300+ call sites across
`app/api`). T1 adds `organizationId` *alongside* the legacy `userId` on `User`
and `Client` rather than renaming it:

- `Client.userId` is untouched, so nothing that already works breaks.
- New teammate code scopes exclusively by `organizationId`, obtained via
  [`lib/organization.ts`](../lib/organization.ts) — never from the session
  directly.
- `Client.organizationId` is nullable; helpers that need it tolerate an unstamped
  plan by falling back to the owner comparison (see
  `assertPlanInOrganization` in [`lib/teammates/assignments.server.ts`](../lib/teammates/assignments.server.ts)).

Teammate collections intentionally use plain scalar `organizationId` fields
instead of Prisma `@relation`s: the Mongo connector requires both sides of a
relation to be declared and adds referential-action semantics that an additive
migration does not want.

---

## 3. Permission grid

[`types/teammate.ts`](../types/teammate.ts) is the single source of truth for the
14 grid functions from spec T2a:

`plan_details_branding`, `create_benefits`, `key_contacts`, `documents`,
`meetings`, `marketing`, `video`, `disclaimers_compliance`,
`benefits_hub_preview`, `publish`, `invite`, `delete`, `org_settings`, `billing`.

Levels are `no_access | view | edit` for content rows and
`not_allowed | allowed` for `publish`, `invite`, `delete` (see
`permissionOptionsFor`).

**Preset grids** (`PRESET_PERMISSION_GRIDS`) — Owner (everything), Admin
(everything except Billing), Editor (create/edit, no publish/invite/delete/org/
billing), Contributor (category-scoped edit for collaborators), Viewer and
Reviewer (read-only).

**Collaborator hard blocks** (`COLLABORATOR_LOCKED_FUNCTIONS`) — Publish, Invite,
Delete, Org Settings, Billing. These can never be granted, including by a direct
API call: [`upsertAssignment`](../lib/teammates/assignments.server.ts) finalizes
the grid and then *validates* the caller's raw input, rejecting a request that
tried to smuggle a locked permission through.

Per spec T2a, the full grid is always stored on the assignment, never a reference
to a preset — so editing a preset later cannot alter existing Custom users.

---

## 4. Rules engine

[`lib/teammates/permissions.ts`](../lib/teammates/permissions.ts) exports:

- `resolveAssignmentGrid` / `finalizePermissionSet` — preset lookup plus
  normalization, auto-enforced rules, and hard blocks.
- `applyAutoEnforcedRules` — Edit implies View; Publish requires Disclaimers View;
  Delete requires Edit on at least one content function.
- `applyHardBlocks` / `lockedFunctionViolations` — collaborator hard blocks.
- `validatePermissionSet` — structural violations (including
  `collaborator_all_plans` when a plan scope is supplied).
- `evaluateSoftWarnings` — all ten spec soft warnings, checked per plan.
- `summarizePermissionSet` — the plan-aware line from T2a Step 3,
  e.g. `Custom · Edits Documents on Ayres · Views Precision Optical`.
- `matchPreset` — backs the "This matches [Editor]. Use the preset instead?" warning.

---

## 5. Scripts

| Command | What it does |
|---|---|
| `npm run teammates:check-schema` | Verifies the 5 T1 collections and 15 indexes exist. |
| `npm run teammates:indexes` | Applies the T1 indexes directly (idempotent). |
| `npm run teammates:backfill` | Creates one Organization per existing User and stamps `organizationId` onto User + Client rows. Supports `--dry-run`. |
| `npm run teammates:verify` | Runs the 24-assertion T1 acceptance suite against the real data layer with self-cleaning fixtures. |
| `npm run teammates:verify-t2` | Runs the 35-assertion T2 enforcement suite (the three T2 acceptance criteria, the one-Owner invariant, plan lists, and the route guard). |
| `npm run teammates:verify-t3` | Runs the 53-assertion T3 suite (seat metering, invite expiry, the upgrade-confirm gate, the owner-first team list, onboarding pre-fill, editing a member, and the roles explainer). |
| `npm run teammates:verify-backfill` | Asserts the post-backfill invariants (every User/Client org'd, legacy `Client.userId` intact). |
| `npm run teammates:verify-t4` | Runs the 62-assertion T4 suite (the invite path, the category merge, the deep link, the Who-is-this presets, the sponsor-domain guess, the search, and the audit row). |
| `npm run teammates:verify-t5` | Runs the 38-assertion T5 suite (contact → invited without duplication, the plan-scoped section choice, the Contributor default, the source on the audit row, and the merge on re-invite). |
| `npm run repair:unique-conflicts` | Finds (and with `--apply`, removes) duplicate session rows that block unique-index builds. |
| `npm run repair:partial-indexes` | Re-applies the partial unique index on `Client.slug`. |
| `npm run repair:purge-orphaned-user` | Inventories (dry run) then with `--apply` removes everything left behind by a deleted User account. |
| `npm run teammates:verify-t6` | Runs the 35-assertion T6 suite (the four acceptance criteria, per-assignment role and visibility, the Delete guard, the audit trail, and All Plans staying Team-Member-only). |
| `npm run teammates:verify-t2a` | Runs the 25-assertion T2a suite (per-function Custom enforcement, same-vs-per-plan grids, the locked-row refusal, All Plans, the missing-grid refusal, soft warnings and their audit trail, and the summary line). |
| `npm run teammates:verify-t7` | Runs the 26-assertion T7 suite (the three acceptance criteria, display-vs-access, the mirror's idempotency and removals, hidden categories, and the unmirrorable-contact residue). |
| `npm run teammates:verify-t9` | Runs the 41-assertion T9 suite (the signed token and its refusals, the mailbox guard, the profile guards, acceptance creating vs reusing a login, the seat conversion, replay, both audit rows, and the tenancy invariant). |
| `npm run teammates:backfill-contacts` | Projects every plan's `keyContacts` onto profiles + assignments (T7). Idempotent; `--dry-run` to count without writing. Run it before the hub reader switch and after adding a new contacts writer. |
| `npm run repair:purge-verification-fixtures` | Removes fixtures stranded by an interrupted verify run (dry run; `--apply` to delete). See §7.7. |

Each verify script also **sweeps stranded fixtures before it asserts** and installs a
SIGINT/SIGTERM handler that sweeps before exiting (§7.7), so an interrupted run is
self-healing rather than something you have to notice and repair. Do not run two
verifications concurrently — each sweep removes the other's rows, because a foreign
stamp is indistinguishable from a stranded one.

### Toolchain prerequisites

- **pnpm** is the declared package manager (`packageManager: pnpm@10.22.0`), but
  Node does not bundle it. Install it once with `npm install -g pnpm@10.22.0`
  (or `corepack enable pnpm`). pnpm reads `nodeLinker: hoisted` from
  `pnpm-workspace.yaml` — that setting must not move back into `.npmrc`, where
  npm warns about it on every command.
- **Windows PowerShell** refuses npm's `.ps1` shims under the default
  `Restricted` execution policy, producing
  `pnpm : ... cannot be loaded because running scripts is disabled`.
  `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` fixes it
  without admin rights.

`prisma db push` now completes cleanly and reports "already in sync" on a second
run. The `teammates:indexes` script remains as a fallback for the case where a
push aborts part-way and leaves new collections without their indexes.

---

## 6. T1 status

Status: **implemented and verified** (not yet reviewed/accepted).

Acceptance criteria from the spec, all asserted by
[`scripts/teammates/verify-t1.ts`](../scripts/teammates/verify-t1.ts):

| Criterion | Result |
|---|---|
| Jane holds assignments on three plans from one profile | Pass |
| Editing Jane's profile in Org A does not change her profile in Org B | Pass |
| Partner companies never appear in Plan Sponsor search | Pass |
| Two collaborators from ABC Benefits share one company record | Pass |

Extra assertions cover the compound unique (one assignment per person per plan),
full-grid persistence, the collaborator Publish hard block surviving a DB round
trip, reuse-or-create by email, and cross-organization isolation of both profiles
and companies.

### Verifying locally

```bash
npx prisma generate
npm run teammates:check-schema
npm run teammates:verify-backfill
npm run teammates:verify
npm run teammates:verify-t2
```

All of these must pass. As of the last run: schema check OK (5 collections, 15
indexes); backfill verification all assertions passed; T1 acceptance suite 24/24;
T2 enforcement suite 23/23; `npx tsc --noEmit` and `npx next lint` both clean.

---

## 7. Database repairs applied

`npx prisma db push` was blocked by pre-existing data / schema problems unrelated
to T1. Because MongoDB pushes are not transactional, each blocker revealed the
next one. All are now resolved, and a push reports "already in sync".

### 7.1 Duplicate session rows (14 removed)

Several wizard step models declare `sessionId @unique`, but the wizard writes
those rows with a read-then-write pattern (`findFirst` → update or create), so a
retried or concurrent step save leaves a second row for the same session. One such
duplicate aborts the entire push, skipping every index after it.

Removed: 1 `WizardClientProfile`, 5 `WizardTeamSize`, 2 `WizardServices`,
2 `WizardUserSetup`, 4 `NewClientKeyContacts` — the most recently updated row per
session is kept. Backups:

- `scripts/repair/backups/wizard-client-profile-<ts>.json`
- `scripts/repair/backups/unique-conflicts-<ts>.json`

`npm run repair:unique-conflicts` re-checks this (dry run by default). It also
scans `Client.slug`, `PortalSlug.slug`, and `Benefit(clientId, category)` and
**reports** conflicts there without deleting anything — a duplicate in primary
business data is a decision, not a repair. That scan currently reports none.

### 7.2 `Client.slug` — `@unique` removed

`slug String? @unique` is unsatisfiable on MongoDB once two plans have no slug: a
Mongo unique index treats every null as a real key, so the build fails with
`dup key: { slug: null }`. Three plans currently have a null slug.

Resolution:

- `@unique` removed from `Client.slug` in [`prisma/schema.prisma`](../prisma/schema.prisma)
  (the only affected call site, `findUnique` in
  [`app/api/check-portal-url/route.ts`](../app/api/check-portal-url/route.ts), was
  switched to `findFirst`).
- Global slug uniqueness is unaffected: it is guaranteed by `PortalSlug.slug`
  (`@unique`, non-null), which registers every current **and retired** slug.
- A partial unique index (`partialFilterExpression: { slug: { $type: "string" } }`)
  is additionally applied to `Client.slug` so real slugs stay unique at the
  database level. Prisma cannot express this declaratively, so it is managed by
  `npm run repair:partial-indexes` and survives `db push`.

### 7.3 Prisma/MongoDB `null` filter semantics (important)

On this Prisma + MongoDB combination, `{ field: null }` matches **only explicit
nulls — never absent fields**. This silently broke plan stamping in the first
backfill run (`plans stamped: 0`) and the `listTeammateProfiles` deactivation
filter.

Any "not yet set" filter must therefore cover both shapes:

```ts
where: {
  OR: [{ field: null }, { field: { isSet: false } }],
}
```

All occurrences are fixed: [`stampPlansWithOrganization`](../lib/organization.ts),
the backfill script, [`listTeammateProfiles`](../lib/teammates/profiles.server.ts)
and [`listAllPlansTeamMembers`](../lib/teammates/profiles.server.ts).

### 7.5 Duplicate-profile guard at the writer

`TeammateProfile(organizationId, email)` carries no unique constraint, and only
[`findOrCreateProfile`](../lib/teammates/profiles.server.ts) was de-duplicating —
so a caller using [`createTeammateProfile`](../lib/teammates/profiles.server.ts)
directly could create the duplicate the spec forbids. The guard now lives at
`createTeammateProfile`, the only writer: it refuses with
`profile_email_exists` (409), or `profile_email_deactivated` when the existing
row is deactivated and should be reactivated instead. Covered by two assertions
in `verify-t1`.

### 7.4 Orphaned rows from a deleted account — purged

Two plans (`Gloomis`, `Loading LLC`) and their content were owned by
`userId=6a9b1976b81208c857a6922b`, an account deleted during this work. Deleting a
`User` only removes the `User` row, so everything that referenced it survived as
unattributable data — the backfill could not assign it an Organization, and
teammate assignment on those plans would have been refused.

```
npm run repair:purge-orphaned-user            # dry run: inventory only
npm run repair:purge-orphaned-user -- --apply # delete
```

Removed **20 rows across 13 tables**: 2 plans, 4 documents, 2 benefits, 2 meetings,
4 meeting custom types, 2 wizard sessions + their step rows, 1 new-client wizard
session, plus the plan-scoped portal slugs and videos the cascade owns. Full dump
written first to
`scripts/repair/backups/purged-user-6a9b1976b81208c857a6922b-<ts>.json`.

Deletion reuses the app's own cascades
([`deleteClientAndScopedData`](../lib/delete-client-scoped-data.ts) and
[`deletePlansAndScopedDataForUser`](../lib/delete-user-plans-and-scoped-data.ts)),
so plan-scoped children are removed in the order their required relations demand.
The script refuses to run while the `User` still exists, and verifies zero
remaining references afterwards. `verify-backfill` now reports no orphans.

### 7.6 Plan creation now stamps `organizationId` — fixed

Every teammate read filters plans by `organizationId`, and **no** creation path used to
set it. All four wrote `userId` only:

| Route | Was |
|---|---|
| [`POST /api/clients`](../app/api/clients/route.ts) | `{ ...body, userId }` |
| [`POST /api/clients/create`](../app/api/clients/create/route.ts) | explicit field list, no org |
| [`POST /api/new-client-wizard/complete`](../app/api/new-client-wizard/complete/route.ts) | explicit field list, no org |
| [`POST /api/new-client-wizard/save-draft`](../app/api/new-client-wizard/save-draft/route.ts) | `{ ...clientUpdateData, userId }` behind an `as any` |

The consequence was not theoretical: a plan created after the last backfill run was
**invisible to the org-scoped layer** — `listAccessiblePlanIds` would not return it,
`assertPlanInOrganization` would refuse teammate assignment on it, and the T5 invite
raised against a draft id would fail. It surfaced during this work as one unstamped
client, and `verify-backfill` reported it as "every Client whose owner still exists is
stamped with an organizationId".

Each route now calls the existing idempotent
[`getOrCreateOrganizationForUser(actorUserId)`](../lib/organization.ts) and writes the
result, **after** any object spread so a caller-supplied value cannot place a plan in
another organization. In `save-draft` only the create branch stamps — the update branch
leaves the column alone, because re-stamping on every autosave would be pointless work
on a row this route already stamped.

The existing drifted row was fixed with `npm run teammates:backfill` (1 plan stamped).
`verify-backfill` now also prints the offending plan's name and id, plus the remedy for
each of the two causes, because "1 unstamped" alone does not say whether to re-run the
backfill or to sweep a fixture.

### 7.7 Interrupted verify runs no longer strand fixtures — fixed

`verify-t1` … `verify-t9` build isolated fixtures, assert, and delete them unless
`--keep` is passed. A Ctrl-C, a dropped connection or a crash skipped the cleanup, and a
stranded fixture owner has no Organization — which fails the NEXT `verify-backfill` on
two assertions that read like code regressions and are not.

Two mechanisms now make that self-healing, both in
[`scripts/teammates/shared.ts`](../scripts/teammates/shared.ts):

- **`sweepStaleFixtures()` runs at the start of every verify script**, so an interrupted
  run's rows are gone before anything is asserted. `exceptStamps` spares the current
  run.
- **`installFixtureGuards()` sweeps on SIGINT/SIGTERM** before exiting, so Ctrl-C leaves
  the database clean rather than waiting for the next run.

Selection is deliberately narrow. Owners must match
`/^t[a-z0-9]{1,3}-verify-…@<domain>\.test$/i` — the `t<n>-verify-` prefix is asserted on
every fixture account and no real address carries it. Because `verify-t2` deliberately
creates an organization whose `ownerUserId` is a *fabricated* id (it asserts the "owner User
is gone" case) and a plan inside it, rows are also matched by name against
`/^t\d[ -]verify-/i`. The Prisma `contains`/`endsWith` filters are coarse pre-cuts — the
typed API has no `$regex` — and the JS regexes are what decide, so they can only narrow the
set. `npm run repair:purge-verification-fixtures` is the same sweep as a manual command,
dry-run by default.

**Two things that narrow must not:** the ticket tag is any `t`-stamped one (`t1`, `t2a`,
`t9`, …), and the mailbox may sit on any reserved `.test` domain — fixtures also use
`@abbenefits.test`, `@abc.test`, `@other.test` and `@elsewhere.test`. An earlier version
restricted both (`t[1-5]` and `@example\.test`), which is precisely how a stranded T9 login
survived a sweep and broke the next `verify-backfill`.

Two implementation notes worth keeping:

- **No `"__none__"` sentinels.** `id` and `profileId` are ObjectIds and Prisma validates
  every value in an `in` list, so a placeholder string raises `P2023 Malformed ObjectID`.
  An empty `in: []` already matches nothing.
- **"Nothing to purge" must check every count, not just users.** A run can have zero
  stranded users and still leave an organization and its audit rows behind.

Verified end-to-end twice. `npm run teammates:verify-t2 -- --keep` (deliberately stranding
4 users plus the ghost org and plan) followed by `npm run teammates:verify-backfill` printed
`Swept 4 fixture user(s)…` and passed all 7 assertions; before the fix the same sequence
failed 3. Later, a T9 run that left two accepted logins behind — one on `@abbenefits.test` —
was invisible to the old pattern and made `verify-backfill` report `2 missing`; the widened
pattern now finds and removes both.

---

## 8. T2 — Permission enforcement layer

Implemented. The engine is [`lib/teammates/access.server.ts`](../lib/teammates/access.server.ts);
the pure, client-safe half is [`lib/teammates/permission-levels.ts`](../lib/teammates/permission-levels.ts).

### The single decision function

`resolvePlanAccess({ userId, clientIdOrSlug, category?, permission?, level? })`
returns a discriminated result, so the API can map it to a status and the UI can
render the right refusal:

| Outcome | When | API mapping |
|---|---|---|
| `kind: "owner"` | `Client.userId` is the caller, or the plan's Organization is owned by them | allow |
| `kind: "teammate"` | profile for this org + assignment for this plan, category and function all satisfied | allow |
| `not_assigned` | no profile in the org, or no assignment for this plan | 403 |
| `profile_deactivated` | profile exists but is deactivated | 403 |
| `category_not_assigned` | assigned, but not to the requested category | 403 |
| `permission_denied` | assigned, but the grid denies the function/level | 403 |
| `plan_not_found` | plan doesn't resolve | 404 |

Two deliberate design points:

- **Owner detection checks `Client.userId` first.** An owner whose Organization
  row has not been backfilled yet is never locked out of their own plans.
- **Hard blocks are re-applied on top of the stored grid** (`effectivePermissionSet`),
  so a Custom grid that somehow carries Publish/Invite/Delete/Org Settings/Billing
  still cannot be exercised by a collaborator. This is T2's "hard rule, including
  for Custom roles".

### Signed URLs (Part B item 3)

R2 keys are `org/{orgId}/plans/{planId}/{documents|branding|uploads}/…`
([`lib/r2.ts`](../lib/r2.ts)). `parseR2Key` extracts the **plan** segment, so a
signed-URL request is checked against the caller's assignment rather than the bare
`org/{userId}/` prefix match the routes used before. Legacy org-level keys (no
plan segment) still fall back to an ownership check.

### UI (Part A)

- [`components/pages/no-access-notice.tsx`](../components/pages/no-access-notice.tsx)
  — the restricted-page state, using the spec's copy verbatim.
- [`app/api/teammates/plan-access/route.ts`](../app/api/teammates/plan-access/route.ts)
  — returns the same decision the mutating routes enforce, plus the effective
  `permissionSet` so controls can be hidden/disabled.
- [`hooks/usePlanAccess.ts`](../hooks/usePlanAccess.ts) — client hook over that
  endpoint, with a fail-closed `can(fn, level)`.
- Reference wiring: [`app/(dashboard)/edit-benefit/[planId]/[category]/page.tsx`](../app/(dashboard)/edit-benefit/[planId]/[category]/page.tsx)
  renders `NoAccessNotice` instead of the editor when denied.
- **`loading` is not `denied`** — a distinction that had to be made explicit, twice.

  1. A falsy `planId` (exactly what `useParams()` returns on the first client render
     of a dynamic route) was reported as `denied`, so the notice flashed with
     `Reference: unknown` — no server decision had been made at all.
  2. With that fixed it still flashed, because of an **abort race**: the effect's
     cleanup aborts the in-flight request when the inputs change, and they *do* change
     right after mount (the plan arrives, then the category). An aborted fetch still
     runs its `.finally`, which cleared `loading` while `state` was still `null` — so
     the hook fell through to `denied` for as long as the *replacement* request took
     (~1s on a cold route).

  Both are fixed in [`usePlanAccess`](../hooks/usePlanAccess.ts): an `active` flag now
  guards **every** state write from a run, including the `.finally`, so a superseded
  request publishes nothing; and the decision ladder is
  `!planId → loading`, `loading → loading`, `!state → loading`, and only a real
  response body can produce `denied`. The no-reason fallback is `lookup_incomplete`
  rather than `unknown`. The page renders a spinner for the loading state instead of
  `null`, so the wait reads as a wait. Fail-closed is unchanged where it matters:
  `can()` returns false while loading, and a failed lookup is still refused — the hook
  simply never *claims* a refusal that no one issued.

The UI check is presentation only. The API is the enforcement point — a client
that ignores the hook still gets refused by the server.

### Route coverage

Adoption goes through [`lib/teammates/plan-guard.server.ts`](../lib/teammates/plan-guard.server.ts):

- `authorizePlan(...)` — decision only.
- `getAuthorizedClient(...)` — the drop-in for
  `prisma.client.findFirst({ where: { id: clientId, userId } })`, returning the
  full `Client` row when the actor owns the plan **or** holds an assignment for
  it. One query: the row is loaded once and authorized in place.

| Route | Enforced |
|---|---|
| `GET /api/clients` | scoped to `listAccessiblePlanIds` — see "Plan lists" below |
| `GET /api/r2/signed-url` | plan assignment + documents/branding permission |
| `GET /api/r2/object` | same rule (portal path resolves the plan owner) |
| `GET /api/documents/[id]/view` | `documents: view` + category scope (dashboard); anonymous portal path unchanged |
| `GET/POST /api/documents` | `documents: view` per plan; list scoped by accessible plans; uploads need `documents: edit` |
| `PATCH/DELETE /api/documents/[id]` | `documents: edit` on the document's plan |
| `POST /api/documents/reorder` | `documents: edit` per plan (was a `client: { userId }` relation filter) |
| `GET /api/clients/[id]` | assignment required to read the plan |
| `GET/PUT /api/clients/[id]/benefits/[category]` | `create_benefits` at `view` / `edit` + category scope |
| `PUT /api/clients/[id]` | assignment required, then `create_benefits: edit` **or** `plan_details_branding: edit` — the plan-level half of the Benefits save and the Edit Plan save. Was `Client.userId`, which 403'd every teammate |
| `GET/POST /api/clients/[id]/meetings` | `meetings: view` (replaced the local `assertClientOwner`) |
| `PATCH/DELETE /api/clients/[id]/meetings/[meetingId]` | `meetings: view` (replaced the `userId` column filter) |
| `GET/POST /api/marketing/assets` | `marketing: edit` |
| `/api/marketing/flyers/{render,generate-copy,[id],[id]/file}` | `marketing` via `getAuthorizedPlanClient` / `resolvePlanAccess` |
| `GET/POST /api/webinars` | `marketing` at `view` / `edit`; list scoped by accessible plans |
| `/api/dashboard/{stats,active-plans,needs-attention,tasks}` | client reads scoped by `listAccessiblePlanIds` (was `userId`, so a teammate saw zeros) |
| `/api/dashboard/{meetings-this-week,upcoming-meetings,recent-activity}` | meetings matched by `OR [{ userId }, { clientId in accessiblePlanIds }]` |

### Plan lists

"Collaborators never see unassigned plans" is implemented **at the API source,
not per component**: every plan picker in the app reads `GET /api/clients`
(Documents, Marketing, Meetings, Videos, Webinars, Benefits Step 1, the clients
dashboard), and that route now scopes its `where` to
[`listAccessiblePlanIds`](../lib/teammates/access.server.ts) — owned plans plus
assigned teammate plans — instead of `userId` alone. A teammate is therefore
structurally unable to select a plan they have no assignment for, and a
deactivated teammate's plans drop out of the list.

The **dashboard** follows the same rule, because a teammate's `User.id` owns no
`Client` rows, so keying on `userId` made every tile read zero for anyone but the
owner. `stats`, `active-plans`, `needs-attention` and `tasks` now read
`id: { in: accessiblePlanIds }`, and the meeting feeds (`meetings-this-week`,
`upcoming-meetings`, `recent-activity`) match
`OR [{ userId }, { clientId: { in: accessiblePlanIds } }]` — which keeps an
owner's planless meetings visible while letting a teammate see the owner's
meetings on the plans they share (a teammate's own `userId` owns neither the plan
nor its meetings). Recent Activity's marketing assets use the same `OR`. Manual
tasks stay the reader's own to-do list; only their plan-name lookup is resolved
against the accessible set.

### Still owner-scoped

- `/api/webinars/[id]` (PATCH/DELETE) and `/api/webinars/bulk-delete`
- `/api/documents/{batch,expiring,client/[clientId]}`
- `/api/clients/[id]/{slugs,portal-data}`
- `/api/videos/*` and the legacy `/api/plans/*`

The first three are the same mechanical swap to `getAuthorizedClient` /
`resolvePlanAccess`, and remain owner-only until then — so a teammate is refused
rather than over-permitted. The risk is under-access, not leakage.

The last group is **not** mechanical and is deliberately out of T2. Videos and
legacy plans are scoped by the `Plan` model (`plan: { userId }`), which teammate
assignments do not model at all: an assignment is `Client`-scoped. Migrating them
requires deciding whether an assignment should also grant access to a `Plan` row —
a product question, not a refactor.

### Verification

```
npm run teammates:verify-t2     ->  23/23 assertions passed
```

Covers: the Contributor is allowed Ayres → Group Health and denied Ayres →
Retirement (`category_not_assigned`) and Precision Optical (`not_assigned`); the
throwing form returns 403 with the spec copy; the Viewer can read but not save
edits or publish; a signed document URL is refused to an unassigned user, allowed
to an assigned Viewer, and refused across plans because the key's plan segment is
enforced; and the one-Owner invariant refuses removing the last Owner.

---

## 9. T3 — Team Member management + seat counter

Implemented. Seat logic lives in [`lib/teammates/seats.server.ts`](../lib/teammates/seats.server.ts);
team management in [`lib/teammates/team.server.ts`](../lib/teammates/team.server.ts);
the onboarding prefill in [`lib/teammates/onboarding-owner.ts`](../lib/teammates/onboarding-owner.ts).

### Seat rules

| Rule | Behaviour |
|---|---|
| Who holds a seat | The owner, Active Team Members, and unexpired pending invites. Contacts and Collaborators never do (spec Part B item 1). |
| Invite hold | A pending invite reserves a seat for 14 days, then stops counting. The meter ignores stale invites immediately, and a sweep moves them back to `Contact` so the stored state is truthful — the profile is kept, never deleted. |
| At the limit | A 409 with code `seat_limit`, not a hard block, so the UI shows an upgrade confirm (Part B item 3). Confirming requires Owner/Admin (`isOwnerOrAdminOfOrganization`), otherwise 403 `seat_limit_owner_only`. |
| Domain guess | A matching email domain defaults to Team Member, anything else to Collaborator (Part B item 4). It is only a default — the API returns it and the UI can override. |

### Two decisions the spec left open

Both are centralised so they are one-line changes:

- **The owner occupies a seat** — `OWNER_CONSUMES_SEAT` in [`seats.server.ts`](../lib/teammates/seats.server.ts).
  The spec says only Team Members use seats and that the owner is the first Team
  Member, so the owner counts. Set it to `false` to give the owner a free seat.
- **A confirmed over-limit add raises `seatsIncluded` by one**, standing in for "they
  moved to a bigger tier" until pricing exists. It keeps the meter honest rather
  than showing "6 of 5 used". `DEFAULT_SEATS_INCLUDED` (5) and
  `PLACEHOLDER_PLAN_TIER` are the other placeholders.

### API

| Route | Purpose |
|---|---|
| `GET /api/teammates/team` | The Settings → Team list (`team`) plus the seat meter. The response also carries a `collaborators` array, which no surface renders now that Settings manages Team Members only. Sweeps expired invites first. |
| `POST /api/teammates/team` | Add a Team Member: seat check, then profile + one assignment per plan. Settings always sends `type: "team_member"`; the endpoint still accepts a `type` for other callers. |
| `GET /api/teammates/seats` | The meter alone. Nothing renders it at present — its only caller was the dashboard meter, which has been removed (see the seats note in §9). |
| `PATCH /api/teammates/team/[profileId]` | Edit a membership (name, role, plan access, benefits access), or `action: "deactivate" \\| "reactivate"` for the spec T6 state transition. |

All three are gated on the `org_settings` permission, which is what produces the
spec's "Owner/Admin only" outcome — a Collaborator can never hold Org Settings
(hard block), so they cannot list or add Team Members at all.

### UI

- Settings gains a **Team Members** tab built around **one card per seat**: an
  occupied card shows the person (headshot, name, email, role, status, plan and
  category access) and opens the **Edit Team Member** modal; an open card opens the
  **Add Team Member** modal. The grid is `max(seatsIncluded, members)` wide, so if
  the organization is over its allowance no member is hidden. Usage and the pending
  invite count sit above the grid, with the upgrade-confirm dialog on a
  seat-limited add.
- **Collaborators are not managed here.** Per the spec's Core Concepts, a Collaborator
  is *"created from: Inside a plan: Create Benefits or Key Contacts"* — Settings → Team
  is a Team-Members surface (T3 Part A item 1). So the tab offers no Collaborators
  accordion and no "Add Collaborator": a Collaborator enters as a plan-scoped **Contact**
  ("Complete Profile Myself") or through an **invite**, from a plan screen. An earlier
  build carried a Settings Collaborators list plus a silent "Add Collaborator" (and even
  a Settings invite); all three were removed to match the spec — see §9d.
- **The Team Members list is plain content, not an accordion.** With Collaborators gone it
  is the tab's only list, so a one-item accordion would be chrome that hides the thing it
  exists to show; the seat grid and its "Add Team Member" header render directly.
- `listCollaborators` / `listOrgPeople` remain in the data layer (each list filters on
  `TeammateProfile.type`, and only `listTeamMembers` synthesizes the owner row), and the
  team endpoint still returns a `collaborators` array. The Settings tab no longer renders
  it; the plan-scoped screens read a plan's assignments directly.
- `AccessFields` keeps its `roles` and `allowAllPlans` props (spec T2a: "All Plans is
  shown for Team Members only"), so it can be reused wherever a teammate is scoped. The
  Settings add/edit pickers now always pass `TEAM_MEMBER_ROLES` and allow All Plans,
  because this surface no longer creates Collaborators.
- `updateTeamMember` was widened from Team-Member-only to **any membership**. The
  old `type !== "team_member"` rejection was redundant rather than protective: the
  permission grid already refuses a role the person's type may not hold, and the
  last-Owner guard lives in the assignment writers. Two rules stayed type-aware —
  `allPlans` is never set on a Collaborator, and a newly created assignment
  defaults to Contributor for one (Editor for a Team Member), matching
  `addTeamMember`.
- **Edit** reconciles rather than replaces: the desired plan set is computed from
  the requested scope, assignments for dropped plans are removed, and the survivors
  are upserted with the new role and category scope. It reuses `upsertAssignment` /
  `removeAssignment`, so the permission grid, the collaborator hard blocks and the
  never-remove-the-last-Owner guard all still apply to an edit.
- A **roles explainer** sits where the decision is made: a "What can this role do?"
  popover beside the Role field describes the *currently selected* role, and a
  "Roles & permissions" dialog lists Team Members and Collaborators as an
  **accordion per role** — the header shows a one-line gist (e.g. "Edits 8 · views
  1 · can publish, invite, delete") so the whole list scans without expanding.
- The dialog's accordions are **controlled and always start collapsed**: opening
  the dialog clears both sections, so a reader never sees a stale expansion. An
  open row tints its own background (`primary/[0.04]`) and the capability detail
  sits on a `bg-muted` panel, so the detail is unambiguously attached to its role.
- Proximity refinements: each row is a bordered card with `space-y-2` gaps (not a
  hairline-divided list); a **per-role left accent colour** reserves a transparent
  2px border so nothing shifts on open and the accent simply fades in; rows are
  grouped under headings that carry a role count; and the two groups are separated
  by a rule. Role colours are literal Tailwind classes in `ROLE_ACCENT_BORDER`, so
  they survive JIT purging.
- The role chip's `Badge` variant is chosen by **section**, not by the role's own
  audience: `variant="default"` under Team Members, `variant="secondary"` under
  Collaborators. Viewer appears in both lists, so deriving the variant from the
  role made the Collaborators > Viewer chip render solid while its two neighbours
  rendered muted — the chip must match the list it sits in.
- The **owner's card** opens the same modal in a read-only state, pointing at the
  Profile tab — their access always covers every plan, so there is nothing to scope.
- **Settings header** — the page sets the organization name as the page-title
  `subtitle`, so the shared header renders `Settings / {Organization Name}` with the
  name in `text-accent-blue`. The precedence mirrors the Branding tab's own
  resolution (wizard branding → `User.organizationName` → `User.organizationType`)
  so the header can never disagree with what that tab displays. The effect is
  declared *after* the `setTitle` effect because `setTitle` clears the subtitle.
- **Fixed a stale-profile snapshot on the Settings page** (found while wiring the
  header). `userProfile` was populated by a `profileSyncedRef` latch that copied
  `cachedProfile` only on the *first* sync, so every `userProfile?.…` fallback
  (branding's `organizationName`/`website`, the organization tab, the header) kept
  reading a pre-save object — a renamed organization, or a logo that had just been
  cleared, could be resurrected from it. Three changes: the latch is now a plain
  mirror (`useEffect(() => { if (cachedProfile) setUserProfile(cachedProfile) })`),
  the page uses SWR's `mutate` through a new `refreshProfile()` helper so a save
  actually re-reads the profile, and the three save handlers call
  `await refreshProfile()` where they used to call `invalidateProfileCache()`.

  Why `mutate` was required: SWR is configured with `dedupingInterval: 60_000` and
  `revalidateOnFocus: false`, so it never refetches on its own — clearing the
  module-level cache in [`lib/fetch-profile.ts`](../lib/fetch-profile.ts) alone did
  **not** reach `cachedProfile`, which is SWR's own store. `refreshProfile()`
  clears the module cache first and only then triggers the revalidation, so the
  fetcher hits the network instead of being served the value just invalidated. The
  mirror is safe to widen because the populate effect still prefers the wizard
  store (`stepData`) for every field the forms edit, so an in-progress edit is not
  overwritten by a refetch.

### The explainer cannot drift from enforcement

[`lib/teammates/role-summary.ts`](../lib/teammates/role-summary.ts) computes each
role's capability lists from `PRESET_PERMISSION_GRIDS` — the same table the API
checks — so changing a preset updates the UI text automatically. Only the
one-line summaries are authored, because no grid can express "and ownership
transfer". `verify-t3` asserts the explainer is complete (every one of the 14
functions lands in exactly one bucket per role), that Owner has no No-Access rows,
that Editor/Viewer get no publish or delete, and that **no collaborator preset is
described as allowed to publish, invite or delete**.
- **Seat cards carry the person's headshot.** `listTeamMembers` returns a `headshot`
  per row: `TeammateProfile.headshot` for teammates, and for the synthesized owner
  the chain `latest session userSetup.headshot` → `User.headshot` →
  `branding.aiAvatar`, mirroring [`/api/profile`](../app/api/profile/route.ts:143)
  and [`/api/profile/header`](../app/api/profile/header/route.ts:59) so the card
  cannot disagree with the header avatar. The value is returned **as stored** — an
  R2 `org/…` key or an absolute/data URL, never a signed URL, which would expire
  inside a list payload. The card renders it through
  [`components/ui/headshot.tsx`](../components/ui/headshot.tsx), which resolves the
  R2 proxy, retries once on error, and falls back to a monogram of the name, so a
  member with no photo still renders something. That also replaced this section's
  local `initialsOf` helper, which is now removed.
- An **ⓘ "How seats work" dialog** sits beside the "N of M seats used" line. It is
  driven by the same `getSeatUsage` payload the meter renders, so its four figures
  (used / active / pending / available) are live rather than restated, and it
  surfaces an amber callout when `atLimit` is true. Each rule it states is one the
  server enforces in [`lib/teammates/seats.server.ts`](../lib/teammates/seats.server.ts):
  only Team Members hold a seat, the owner's seat is always counted
  (`OWNER_CONSUMES_SEAT`), an invite holds a seat for 14 days and then releases
  back to a Contact (`INVITE_SEAT_HOLD_DAYS`, `expireStaleInvites`), deactivating
  frees the seat, and the limit produces an upgrade confirm rather than a block
  (`assertSeatAvailable`).
- The dialog's **reserved-seat rule is viewer-aware**, because the reserved seat
  belongs to the *organization* (`Organization.ownerUserId`), not to the reader —
  an Admin reaches this tab (they hold `org_settings`) without owning the
  organization, so a static "your own seat is counted" would be false for them.
  The row for the owner in the team list supplies both the id and the name: the
  dialog says "Your own seat is counted" only when `ownerRow.userId` matches
  `session.user.id`, otherwise it names the owner ("**{name}** is the organization
  owner and always the first Team Member…"), and falls back to an unnamed version
  while the list or the session is still resolving. All three variants are true —
  only the grammatical person changes.
- The **dashboard no longer shows the seat meter.** Spec T3 Part A item 3 asks for it in
  both places, so this is a deliberate product decision overriding half that sentence, not an
  oversight — the reason is recorded at the top of
  [`components/pages/dashboard/dashboard.tsx`](../components/pages/dashboard/dashboard.tsx:33)
  so the next reader of the spec finds it. Nothing was discarded to achieve it: `SeatMeter` and
  `useSeatUsage` are still in
  [`components/pages/seat-meter.tsx`](../components/pages/seat-meter.tsx:26) (currently
  referenced by nothing else), and the dialog Settings renders is the shared
  [`components/teammates/seats/seat-usage-info-dialog.tsx`](../components/teammates/seats/seat-usage-info-dialog.tsx:40),
  so restoring the zone is a re-wire rather than a rebuild. The seats UI lives only in
  Settings → People & Access.
- **The Add modal's "New Contact" slide collects only what a profile can store.** Create Plan
  → Key Contacts gathers about thirty values; `TeammateProfile` has columns for roughly eight
  of them. Rather than render inputs whose values `POST /api/teammates/team` has nowhere to
  put, the slide asks for first and last name, job title, email, phone and extension,
  headshot, and company — the Key Contact fields with a home — and derives
  `benefitsSpecialty` from the categories the access fields already select, so there is one
  category picker rather than two that could disagree. Deliberately **not** collected yet,
  because no column exists: `contactType` (individual vs team/support),
  `displayName`/`supportIcon`/`departmentLabel`, the **email and phone visibility toggles**,
  the whole CTA group (`enableContactButton`, `ctaType`, `schedulingUrl`, `websiteUrl`),
  `contactFormTopics`, the contact's own **`companyLogo`**, the card colours, and
  `isPrimary`. A contact added here therefore renders a **plainer card** than one authored in
  the wizard. That is a known gap, not a fault: it closes when a profile-to-plan writer and
  a `contactCard` payload (or typed columns) land, which is its own decision.
- **Only the advisor can enter a person's details, and only an admin can correct them.** The
  invite collects a name and a password and nothing else, and every teammate profile writer
  is gated on `org_settings` — there is no `/api/teammates/me`. So the advisor's form is the
  sole source of a job title or phone number. Making it optional is a follow-up ticket, kept
  in `plans/teammates-self-service-profile.md`.
- **Onboarding**: the invite step opens with the owner pre-filled as the first
  member, and the step is skippable.

Two things to know about the onboarding piece:

1. The owner's canonical representation is the Organization's `ownerUserId`. The
   Settings → Team list **synthesizes** the owner's row from it rather than storing
   a TeammateProfile, so there is no second copy to drift, and the owner is
   guaranteed to be the first row.
2. The pre-fill reads the owner's name/email from the wizard store's user-setup
   step, which runs *after* the invite step — so on a first pass the row appears as
   soon as that identity is known, and is immediately present on any revisit.
   `withOwnerPrefill` is reference-stable, so re-running it never loops.

### Acceptance

```
npm run teammates:verify-t3     ->  53/53 assertions passed
```

Covers all three criteria: an invite fills a seat and an aged invite releases it
(both in the meter and via the sweep, with the profile kept); the team list works
with no onboarding team-step data and an empty step passes validation, so
onboarding cannot depend on it; and the owner is the first Team Member with the
Owner role and Active status. Plus the domain guess, that a Collaborator consumes
no seat, the upgrade-confirm gate refusing a non-owner, the onboarding pre-fill
(owner first, idempotent, no-op without an identity), and the edit path narrowing
All Plans to a single plan — removing the dropped assignment, flipping the
`allPlans` flag off, and applying the new role and category scope to the survivor.

---

## 9b. T4 — Invite Collaborator from Create Benefits

Shipped: **A1, A2, A3, A5, A6 + B1, B2, B3, B5.** Two items are deferred on purpose
— see "Deferred" at the end of this section.

### Where it lives

| Piece | File |
|---|---|
| Invite writer, plan-assignment reader, collaborator search | [`lib/teammates/invites.server.ts`](../lib/teammates/invites.server.ts) |
| "Who is this?" table + preset mapping (shared with the dialog) | [`types/teammate.ts`](../types/teammate.ts) |
| Invite email template | [`sendCollaboratorInviteEmail`](../lib/email.ts:745) |
| Dialog | [`invite-collaborator-dialog.tsx`](../components/pages/benefits/invite-collaborator-dialog.tsx) |
| Card button + "Assigned to …" chip | [`benefits-list.tsx`](../components/pages/benefits/benefits-list.tsx) |
| Contacts-step accordion (invite lives here) | [`step-3.tsx`](../components/wizard/benefits-steps/step-3.tsx) |

### Entry points — the Create / Edit benefits workflow

1. **Browse Benefits** (`/benefits`): next to Edit on each created category card, with
   the "Assigned to …" line directly above it.
2. **Contacts step** — the one place that serves **both** the Edit Benefit Contacts tab
   (`<BenefitsStep3 section="contacts" />`) and Create Benefits Step 3
   (`<BenefitsStep3 />`), so a single implementation covers both workflows. It renders
   two **accordion sections**, both open by default:
   - **Support Contacts** — the existing behaviour (the plan's people, capped per
     benefit), now collapsible with a "N of MAX" badge in its header.
   - **Collaborators** — who is assigned to this plan, each row showing headshot, name,
     email, partner company, role, state (or "Deactivated") and a "This section" /
     "Other sections" badge derived from whether that assignment covers the category
     being edited. **Invite Collaborator** lives here, and the invite section is
     disabled until Step 1 has both a plan and a category, because those two things are
     what the invite is scoped by — the dialog never asks for them.

   The invite deliberately moved off the page footers: an earlier pass put it in the
   Edit Benefit bottom action bar and the wizard footer, which made it a page-level
   action competing with Cancel/Save rather than something about *who helps with this
   section*. The `BenefitsWizard.extraActions` slot added for that is gone again.

### API

| Route | Purpose |
|---|---|
| `POST /api/teammates/invite-collaborator` | Resolve/reuse the person, merge the assignment, audit, then email. |
| `GET /api/teammates/invite-collaborator?clientId=&email=` | The domain guess for the address being typed. |
| `GET /api/teammates/plan-assignments?planId=` | Who is assigned to a plan, for the card chips. |
| `GET /api/teammates/collaborators/search?q=` | "Add Existing Collaborator" typeahead. |

`POST` is gated on `org_settings: edit`, which is the Open Decision's "Can Editors
invite Collaborators? **No: Owner/Admin only**" expressed as one rule — a Collaborator
can never hold that row (hard block) and an Editor's grid does not include it. The
two GETs are gated on `org_settings: view`, except `plan-assignments`, which checks
the caller's own access to *that plan* because it is read from a plan screen.

### The rules, and where they come from

1. **Scope is pinned, never asked for.** The dialog receives `planId` and `category`
   from the card it was opened on and shows them as locked chips, so an invite from
   Ayres → Group Health writes exactly one assignment for exactly that plan and
   category (the acceptance criterion).
2. **"Who is this?" → preset lives in `types/teammate.ts`** as data
   (`WHO_IS_THIS_OPTIONS` / `roleForWhoIsThisContext`), so the dialog and the writer
   cannot disagree: Plan Sponsor HR, Outside Advisor/Specialist and Provider Rep →
   Contributor; Reviewer only → Reviewer. An unknown answer is refused rather than
   defaulted.
3. **The domain guess is a pre-selection, not a correction.** An address on the plan
   sponsor's domain pre-selects "Plan Sponsor HR" and explains why; once the advisor
   answers the field themselves the guess stops overwriting them. Sponsor domains are
   the plan's `companyWebsite` plus its key contacts' email domains — deliberately
   *not* `getOrganizationDomains`, which describes the advisor's own firm and drives
   the T3 Team-Member guess.
4. **No seat check.** Only Team Members consume seats, so this path never calls
   `assertSeatAvailable`.
5. **No All Plans.** One plan wide, and `allPlans` is never set on the created
   profile (T2a hides All Plans for Collaborators).
6. **Re-inviting merges.** `upsertAssignment` writes the category list verbatim, so
   the writer unions the new category into the existing list instead of replacing it.
   An existing assignment also keeps its role — a second invite for a different
   category is not a role change — and the response reports `roleApplied: false`.
7. **Team Members are refused** with `already_a_team_member` (409) and a pointer at
   Settings → Team Members: that email already holds a seat, and silently rewriting
   their access from a benefits screen is the wrong surface for it.
8. **Order: person → assignment → state → audit → email.** The email is last and
   non-fatal, so a mail failure can neither leave an unaudited grant behind nor roll
   back a grant the advisor asked for. The dialog reports that case as a warning
   ("the invite was saved, but the email could not be sent") rather than an error.
9. **The missing-field list is shared, not re-derived.** The writer calls the same
   `getBenefitCompleteness` that `/api/benefits` calls, with the same inputs, so the
   email and the card's amber chips cannot disagree; the card's
   "Assigned to Jane · 3 fields missing" reads the count straight off that row. The
   deep link is `/edit-benefit/{planId}/{categorySlug}` — the section the invite is
   scoped to.
10. **Search matches in JS on purpose.** Prisma's MongoDB connector has no
    case-insensitive `contains` (the SQL-only `mode: "insensitive"`), so a filter
    would miss "jane" → "Jane Smith". One organization's external collaborators is a
    small set, so it is loaded and filtered. Deactivated people are excluded —
    reactivating them is a Settings decision, not something an invite should do.

### Data added

`PlanAssignment.inviteNote` and `PlanAssignment.inviteDueDate`, both nullable.
`upsertAssignment` treats `undefined` as "leave it alone", so an ordinary edit from
Settings cannot wipe the invite's note or deadline. The new audit action
`collaborator_invited` records the source (`create_benefits`), the plan, the category,
the "Who is this?" label, whether the profile was reused, and the due date.

**An invite only writes the metadata it was given.** `verify-t4` caught the first
version clearing it: re-inviting the same person for a *different* category on the
same plan passed `inviteNote: null` / `inviteDueDate: null` into `upsertAssignment`,
which overwrote the note and deadline the first invite had set. The writer now
includes the pair only when the advisor actually supplied a note or a date — a plain
"add another category" re-invite leaves the original invite intact, while a
deliberately filled form still writes exactly what it shows.

### Acceptance

```
npm run teammates:verify-t4     ->  62/62 assertions passed
```

Covers the reachable criteria: an invite writes exactly the plan and category it was
raised from; a second invite on another plan adds an assignment and reuses the
profile; re-inviting the same plan merges the category, keeps the role and keeps the
original note and due date; the deep link's pieces resolve; the "Who is this?"
mapping and the sponsor-domain guess behave (including that the advisor's own domain
is not the sponsor); no seat is consumed; All Plans is never set on a collaborator; a
Team Member's email is refused; the card rows are scoped per plan; the
existing-collaborator search matches name, email and company case-insensitively while
hiding deactivated people; and every invite is audited. It also asserts the
**deferral** for criterion 4 — `PlanAssignment` has no review column — so the gap is
recorded rather than implied. No email leaves the machine: every invite in the script
passes `skipEmail: true`.

### Deferred, with the reason

- **A4 "Customize access" → the T2a plan-first grid.** T2a is a separate ticket. The
  affordance is rendered **visible but disabled** with a line explaining that the grid
  arrives with custom roles, rather than being a doorway into a screen that does not
  exist. When T2a lands this becomes a link, and the invite gains a
  `customPermissionSet` argument that `upsertAssignment` already accepts.
- **B4 "Ready for Review" → Approve / Send Back.** Needs a review state
  `PlanAssignment` does not have (it carries only `showOnBenefitsHub`, `invitedBy*`,
  `lastChangedBy*`) plus a notification channel — the header notifications today are
  derived from documents and meetings, there is no inbox. Its own ticket.

---

## 9c. T5 — Key Contacts entry point

Shipped as the **invite path only**, which is the scope decision recorded here:
contacts keep living in `Client.keyContacts` (the array the hub already renders), and
inviting is what creates a profile. Nothing about the hub's data source changed.

### Where it lives

| Piece | File |
|---|---|
| The step (4 slides: prompt → details → categories → preview) | [`step-3-key-contacts.tsx`](../components/wizard/new-client-steps/step-3-key-contacts/step-3-key-contacts.tsx) |
| The two options on the opening prompt | [`first-contact-prompt.tsx`](../components/wizard/new-client-steps/step-3-key-contacts/slides/first-contact-prompt.tsx) |
| Per-contact "Invite" action (Part A item 4) | [`category-explorer.tsx`](../components/wizard/new-client-steps/step-3-key-contacts/slides/category-explorer.tsx) |
| The invite dialog | [`invite-collaborator-dialog.tsx`](../components/teammates/invite-collaborator-dialog.tsx) — shared with the other entry points since §9d |
| The shared invite itself | [`inviteCollaboratorToPlan`](../lib/teammates/invites.server.ts) |

### One invite, two entry points

`inviteCollaboratorToCategory` was widened and renamed to
**`inviteCollaboratorToPlan`**, and `POST /api/teammates/invite-collaborator` now
serves both tickets:

- `category` (one) → the T4 category card that was clicked;
- `categories` (one or more), no `whoIsThis` → the T5 Key Contacts invite, which
  defaults to the Contributor preset because that flow never asks "Who is this?".

Everything downstream is shared: the profile-reuse rule, the Team-Member refusal,
the deactivation guard, the category merge on re-invite, the invite-metadata rule
(only what was supplied is written), the audit row and the email. Adding a second
entry point therefore did not add a second set of rules to keep in step.

Two consequences worth knowing:

- **The audit row now records `categories: string[]`** instead of a single
  `category`, and `source` distinguishes `create_benefits` from `key_contacts`. A T4
  invite is the one-element case of the same field.
- **Two pages deep-link differently**: one category opens its own section
  (`/edit-benefit/{plan}/{slug}`), several open `/benefits`, because there is no
  single section to land on. The email copy says "the Group Health section" or lists
  the sections accordingly.

### The rules this entry point follows

1. **Scope is This Plan** — the invite writes exactly one assignment, for the plan
   the wizard is building, carrying the categories the advisor ticked. A second plan
   in the same organization is never touched (asserted).
2. **The invite needs a saved plan.** Key Contacts runs before the plan is
   completed, so the step persists the wizard draft on demand (`ensurePlanId`) and
   refuses to invite if that fails, rather than inviting into nothing.
3. **No seat, no Team Member, no All Plans** — all inherited from the shared core.
4. **The person is reused, not duplicated.** Picking someone from the
   "Add Existing Contact / Collaborator" search fills their saved profile in, and
   inviting by email reuses whatever profile exists for that address (Part B item 5).

### Acceptance, and one honest caveat

`verify-t5` covers the three criteria: a Contact sends no invite and has no
assignment while still appearing in the plan's own contact data (what the hub
renders); inviting it reuses the same profile and moves it Contact → Invited; and two
collaborators from one firm share a single `TeammateCompany` row.

The caveat: because the approved scope leaves plain contacts in `Client.keyContacts`,
"I invite the contact I already typed in" reuses the *profile that exists for that
email* — and there may be none yet, in which case the invite creates it. What is
guaranteed, and asserted, is that **no second profile is ever created for an email
that already has one**, and that the plan's contact data is left alone. Making every
contact a profile from the moment it is saved is the T6/T7 step that also moves the
hub onto profile + assignment.

---

## 9d. Invite entry points — one dialog, three surfaces

The invite is a single verb ("put this person on this plan's sections and email
them"), so it now has a single UI. Every entry point mounts
[`InviteCollaboratorDialog`](components/teammates/invite-collaborator-dialog.tsx) and
POSTs to `/api/teammates/invite-collaborator`, which lands on
[`inviteCollaboratorToPlan()`](lib/teammates/invites.server.ts). There is no second
rule set to drift.

| Surface | How it opens | Plan resolution | `source` |
|---|---|---|---|
| **Create Plan → Key Contacts** (T5) | second prompt card, or per-contact "Invite" in the Category Explorer | draft persisted on demand (`ensurePlanId`) | `key_contacts` |
| **Edit Client → Key Contacts** | tab header button, or the row action on any contact | the saved plan (`clientId`) | `edit_client` |
| **Add / Edit Benefit → Contacts** | section header button | the plan being edited | `create_benefits` / `edit_benefit` |

Settings → Team Members is deliberately **not** a surface: the spec creates a Collaborator
from inside a plan (Create Benefits / Key Contacts), so the tab's old "Invite Collaborator"
and "Add Collaborator" were removed (see §9). The remaining callers are the three above.

### How the plan is resolved

One prop decides, never a fallback chain that could pick the wrong plan:

1. `planId` — a plan the caller already holds (Edit Client, Add/Edit Benefit);
2. `ensurePlanId()` — the wizard's draft-on-demand resolution.

If none yields a plan the invite is **refused** rather than written against nothing.
`planOptions` (a plan picker) remains on the dialog for a caller with no plan in context,
but the Settings surface that used it is gone, so no current caller passes it.

### Why the source is recorded

`InviteCollaboratorDialog` renders in the Create *and* Edit benefit flows, and there
are three places an invite can come from. `INVITE_SOURCES` is a named union, the
endpoint validates the incoming value with `isInviteSource()` instead of accepting any
string, and the audit row records which surface asked. Without it "where do invites
come from?" is unanswerable, and a Guest-list problem in one surface would be
invisible. (`settings` remains a valid source value for audit rows written before the
Settings surface was removed.)

### Two deliberate distinctions

- **Collaborators are invited from a plan, not created in Settings.** The spec's Core
  Concepts create a Collaborator *inside a plan* (Create Benefits / Key Contacts), as a
  plan-scoped Contact or through an invite, and Settings → Team is a Team-Members surface.
  A Settings "Add/Invite Collaborator" pair was removed for exactly that reason (§9).
- **The dialog's sections are the canonical categories plus the plan's Custom benefits.**
  It shows the canonical categories from
  [`BENEFIT_CONTACT_CATEGORIES`](lib/benefit-contacts.ts) with the `Company / Plan Sponsor`
  hub key dropped, each plan's own Custom benefit titles by name (so the reader recognises
  "Wellness Programs", not the storage label), and any pre-filled category that is not
  among them (a contact filed under "Third Party Contact", say). Filtering the extras out —
  as the T5-only version did — would tick nothing for a contact the advisor explicitly
  asked to invite.

### Files

- Dialog: `components/teammates/invite-collaborator-dialog.tsx`. The old T5 path
  (`components/wizard/new-client-steps/step-3-key-contacts/invite-collaborator-dialog.tsx`)
  is a re-export shim only; nothing imports it.
- Server: `INVITE_SOURCES` / `isInviteSource()` in `lib/teammates/invites.server.ts`;
  `source` accepted on `POST /api/teammates/invite-collaborator`.

---

## 9e. T6 — Assignment Management screen

Spec page 11. The screen exists because access is **per assignment**, not per person:
one person can be an Editor on Ayres and a Viewer on Precision Optical, and a single
form cannot express that.

### Where it lives

| Piece | File |
|---|---|
| The screen | [`person-access-screen.tsx`](../components/teammates/person-access-screen.tsx) |
| Opened from | Settings → Team Members — the seat cards and the Collaborator rows |
| The screen's single read | `GET /api/teammates/team/[profileId]` → `getMembershipDetail()` in `lib/teammates/team.server.ts` |
| The per-assignment controls | `PATCH` / `DELETE` `/api/teammates/assignments/[assignmentId]` → `updateAssignment()` / `removeAssignment()` |
| The set-level access save | `PATCH /api/teammates/team/[profileId]` → `updateTeamMember()` |
| Deactivate / Delete | the same route, `action: "deactivate" \| "reactivate" \| "delete"` |

### What T6 actually added

Most of T6 already existed: `removeAssignment`, `setAssignmentShowOnBenefitsHub`,
`deactivateTeammateProfile` and `deleteTeammateProfile` were written during T1/T3 and
annotated with their T6 item numbers, and `upsertAssignment` already owns the grid, the
collaborator hard blocks, the last-Owner guard and the audit rows. What was missing was
**exposure and a screen**:

- `updateAssignment` — per-assignment role and hub visibility. Built ON TOP of
  `upsertAssignment` rather than beside it, so a per-assignment edit re-runs every
  validation a create does. It preserves the invite metadata and any field the caller
  did not supply, which is what makes a role-only edit safe.
- `getMembershipDetail` — profile + assignments (with plan NAMES) + the plan list + the
  seat meter + `canDeleteProfile`, in one read, so the header, the checklist and the
  rows cannot disagree while the screen is open.
- The three missing HTTP verbs: an assignment can now be patched and deleted, and a
  profile deleted.

### Part A, item by item

1. **Per-person screen, assignments by plan** — profile card on top, one row per plan.
2. **Plan access** — Certain Plans (searchable checklist) or All Plans. All Plans is
   hidden for a Collaborator and the server refuses to set the flag for one, which is
   the spec's own Open Decision ("Can Owners/Admins grant All Plans to a Collaborator,
   with a warning? **No**").
3. **Benefits access** — All / Certain, pre-filled from what the person already holds
   (All only when every assignment already covers everything).
4. **Per-assignment controls** — a role dropdown and a Show on Benefits Hub toggle.
5. **Three separate actions** — Remove Assignment (per row), Deactivate, Delete Profile.

### Two interaction choices

- **Rows apply immediately; the access block is saved deliberately.** A row edits one
  assignment, so there is nothing to reconcile and instant feedback matches T6 Part B
  item 1 ("access ends immediately"). The Plan/Benefits block changes *which*
  assignments exist — the server reconciles that by removing the ones that drop out —
  so it gets an explicit Save rather than firing as the advisor ticks boxes.
- **`Custom` is rendered but not selectable.** It needs T2a's plan-first grid. The
  server refuses the role too (`custom_role_unavailable`), so the disabled entry
  documents a real gap instead of opening a dead end.

### The three actions, and their guards

| Action | Ends | Keeps | Guard |
|---|---|---|---|
| Remove Assignment | access to that plan, immediately | everything the person created | the last-Owner guard still applies |
| Deactivate | all access to the organization | the profile | a deactivated person cannot be given a new plan (`profile_deactivated`) |
| Delete Profile | everything | nothing | refused with `profile_has_assignments` while any assignment remains |

The Delete guard lives in `deleteTeammateProfile`, not in the screen, so the client's
disabled button with its explanation is a courtesy rather than the enforcement.

### Verification

`verify-t6` asserts all four acceptance criteria and Part B's five rules: one save adds
Jane to Precision Optical without a second profile (criterion 1); a removed assignment
is denied on the very next `resolvePlanAccess` call and leaves her plan list (criterion
2); a deactivated profile keeps its row while every plan disappears from the login
(criterion 3, see the caveat); and Delete is refused with `profile_has_assignments`
until the last assignment is gone (criterion 4). It also checks the two new functions
directly — a role-only edit leaves the category scope alone, a visibility-only edit
leaves the role alone and audits `assignment_visibility_changed`, and `custom` is
refused — plus that each of the six relevant audit actions is written with the acting
user and a timestamp.

**The one honest caveat:** criterion 3 says "a deactivated user cannot log in to that
organization". What T6 and the enforcement layer guarantee, and what is asserted, is
that every organization-scoped read is refused and every plan disappears from their
list — the authorization half. Refusing the *credential* itself belongs to the auth
layer, which does not yet consult `TeammateProfile.deactivatedAt`.

### Not T6's to build

Per-plan custom permissions remain T2a's (the `custom` role, and the plan-first grid
behind it). T6 stores and displays whatever grid an assignment already holds; it does
not author one.

---

## 9f. T7 — Benefits Hub contact display

Spec page 12. This is the ticket that changes the hub's **source of truth**.

### The scope decision

The spec says plainly: *"The hub renders from profile + assignment. One source of truth;
contact details are never duplicated."* The hub rendered `Client.keyContacts` — an array
read in six surfaces across 168 references, where contacts had no profile and no
assignment. Two ways to satisfy that line were possible: render a deduped union of both
sources (safe, but still two sources), or make profile + assignment genuinely
authoritative. **The user chose the migration**, so contacts are now projected onto the
teammate layer and the hub reads only that.

### Three pieces

| Piece | File | Job |
|---|---|---|
| The mirror (write) | `lib/teammates/contact-mirror.server.ts` | Projects a plan's `keyContacts` onto profiles + assignments |
| The reader (read) | `lib/teammates/hub-contacts.server.ts` | Builds the hub's cards from assignments joined to profiles |
| The backfill (existing data) | `scripts/teammates/backfill-plan-contacts.ts` | Runs the mirror over every plan once |

### One choke point, not six rewrites

The portal's readers all consume the payload from
`GET /api/clients/[id]?forPortal=1`. Rebuilding `keyContacts` **there** — from profile +
assignment — means the six readers, the card layouts and the CSS keep working unchanged,
while the data underneath changes. Nothing was rewritten that did not have to be.

Three details make the swap safe:

- **The card keeps the contact's own id.** `Benefit.supportContacts[].contactId` already
  references the id the advisor's contact carried, so the assignment stores it as
  `PlanAssignment.contactId` (the one schema addition) and the reader emits it as the card
  id. Every existing cross-reference resolves without touching the benefit rows.
- **`showOnPortal` is derived from `showOnBenefitsHub`** (Part B item 2 — display off
  hides a person but keeps their admin access). The readers already filter on
  `showOnPortal`, so they keep working.
- **Category scope is expanded, not invented.** An assignment scoped to `all` reports
  every benefit category, which is what the category-visibility filter (Part B item 3)
  and the per-category readers expect.

### The mirror's four rules

1. **A Contact becomes a profile in the `contact` state with no login.** It holds no seat
   (`getSeatUsage` counts only non-contact Team Members) and grants no access (the
   permission layer resolves people by login, and there is none).
2. **Person type follows the organization's own domain rule** — the same
   `guessPersonTypeForEmail` the invite flow uses.
3. **A `contact`-state profile is synced from the contact; anything else is left alone.**
   Once someone is invited or active, T5 Part B item 2 applies: the collaborator controls
   their own info, the advisor controls assignments and display. Overwriting an active
   person's job title from a stale contact row is exactly the drift this removes.
4. **The mirror writes no audit events and never changes a role.** It is a projection of
   the advisor's own contact data, not an access decision. Access changes stay audited
   where they are made (T4, T6).

A plan-sponsor contact whose company **is** the client is deliberately left without a
`companyId`: creating a Partner/Provider row for an employer is what T1 forbids, and the
card falls back to the plan's own branding. Only genuinely external firms become
companies.

### The safety net, and why it exists

A `TeammateProfile` requires an email, and **3 of the 8 real plans' contacts had none**.
Rather than let a live hub lose those cards, `buildPortalKeyContacts` passes through any
stored contact whose id is absent from the derived cards. The switch is therefore
non-destructive **by construction** rather than by having migrated everything perfectly.
It is residue, not a second source: nothing is read from it for a contact that did mirror,
and the set shrinks to empty as coverage grows.

### What the tests caught

`verify-t7` found a real bug in the removal logic. It filtered orphaned assignments with
`!seenProfileIds.has(profileId) && !byProfileId.has(profileId)` — but `byProfileId` is
keyed by every existing assignment, so the second clause was **vacuous** and a removed
contact's assignment was never deleted. The profile-state guard below it is what protects
real access, and it now has to be the only thing that does.

Two further failures were the test's own fault and are worth recording: the sponsor check
mirrored into the wrong plan (where that company legitimately *is* a different firm), and
the hidden-category check hid a category the contact was not in, so it could never have
filtered anything.

### Verification

`verify-t7` asserts the three acceptance criteria — she appears on the Ayres hub in both
places (the team array and, through `resolveCategoryContacts`, the category page) and on
no other hub; display off removes her while a logged-in person with display off can still
edit; and a phone-number change on the profile reaches **both** hubs she is on — plus the
mirror's idempotency, its non-destruction of an invited person's assignment, the
sponsor-company rule, hidden categories, and the residue guarantee.

```
npm run teammates:backfill-contacts   -> 5 profiles, 7 assignments created
npm run teammates:backfill-contacts   -> 0 created, 0 removed (idempotent)
```

### What is not done

The **authoring** surfaces still write `keyContacts` and rely on the mirror being called;
a new writer that forgets it will drift until the backfill runs. Those choke points are
listed in §10.8. Making the mirror a Prisma extension on `Client` writes would remove the
obligation, but it changes the shared client's type and was judged riskier than explicit
calls plus a documented remedy.

---

## 9g. T2a — Custom role (plan-first grid)

Spec pages 5-8. The ticket that makes the `custom` role real.

### What was already there

Almost all of T2a's **Part B** existed before this ticket, because T1 built it and T2a
"needs no schema change":

| Already implemented | Where |
|---|---|
| The 14-function grid, its labels, options and binary rows | `types/teammate.ts` |
| Auto-enforced rules (Edit ⇒ View; Delete requires Edit; Publish requires Disclaimers View) | `applyAutoEnforcedRules` |
| Collaborator hard blocks, with a locked value per function | `finalizePermissionSet` / `lockedFunctionViolations` |
| `validatePermissionSet` — the 400 a direct API call gets | `permissions.ts` |
| **All ten soft warnings**, checked per plan | `evaluateSoftWarnings` |
| The plan-aware summary line ("Custom · …") | `summarizePermissionSet` |
| "All Plans is Team-Member-only" as a rule | `isPlanScopeAllowed` |
| `custom_access_set` audit with `warningsConfirmed` | `upsertAssignment` |

So the work was the **write path and the UI** — not the rules.

### What T2a added

- [`updateAssignment`](../lib/teammates/assignments.server.ts) now accepts
  `customPermissionSet` and `warningsConfirmed`. The one guard that replaced T6's old
  refusal: **`custom` without a grid is refused** (`custom_permission_set_required`),
  because the fallback would be an all-denied grid — silently stripping access the
  advisor never meant to remove.
- The assignments API carries both fields through.
- [`custom-role-screen.tsx`](../components/teammates/custom-role-screen.tsx) — the
  three-step screen.
- [`getMembershipDetail`](../lib/teammates/team.server.ts) now returns each assignment's
  stored grid, so the screen can start from what the person actually has.
- T6's `Custom…` entry is enabled and opens the grid instead of writing a role.

### Part A, item by item

1. **Three steps, top to bottom:** Plans → Benefits categories → Functions, with a step
   indicator that also doubles as navigation. It starts from
   `finalizePermissionSet(presetPermissionSet(currentRole))`, so the grid is **never
   blank** as the spec requires.
2. **Plans** — This Plan / Certain Plans (searchable checklist) / All Plans. All Plans is
   **hidden for a Collaborator**, with a line saying why, and the server refuses the flag
   for one anyway. Choosing it shows "Includes plans created in the future."
3. **Benefits categories** — "Same categories on all plans" is on by default; off gives
   each plan its own picker.
4. **Functions** — "Same permissions on all selected plans" is on by default; off shows
   per-plan tabs. Each row is a radio group (`No Access / View / Edit`, or
   `Not Allowed / Allowed`). Locked rows render with a **lock icon** and
   "Not available for external collaborators." rather than being hidden.
5. **The summary line** is rendered live above the steps.
6. **Warnings appear inline** as selections are made, and again on Save as one confirm
   listing everything flagged; the confirmed codes are sent with the save.

### How the save works, without a bespoke endpoint

Two passes over the routes that already exist, rather than a new bulk endpoint:

1. `PATCH /api/teammates/team/[profileId]` materialises the plan set — that is what
   creates and removes assignments.
2. Read the person back, then `PATCH /api/teammates/assignments/[id]` **per plan** with
   that plan's grid, category scope and confirmed warnings.

That is what makes "same permissions on" write two identical grids and "off" write two
independent ones, and it means the hard blocks, the auto-enforced rules and the
last-Owner guard all apply on every write — the screen cannot bypass them, and neither
can a direct API call.

### Verification

`verify-t2a` asserts the acceptance criteria that live at the enforcement layer: a
Documents-Edit/everything-else-View user **can** edit documents and **cannot** edit any
other module (and the denial names the permission, not the plan); "same permissions on"
produces two identical assignments while "off" enforces Edit on one plan and View on the
other; a locked permission supplied directly is **refused** with
`collaborator_locked_function` rather than silently dropped; a Collaborator never carries
All Plans; `custom` with no grid is refused; a soft warning fires on its condition (and
one that is not true does not), and the confirmed codes land on the audit row — which is
how an Owner sees them; and the stored grid is a full grid, not a reference to a preset.

### Deferred, with the reason

- **T4's "Customize access" link** is still disabled. It is not a wiring gap: the invite
  dialog may be inviting someone who has **no profile yet**, and a Custom grid has to be
  written onto an assignment that does not exist until the invite is accepted. Granting
  Custom access at invite time therefore needs a decision the spec does not make — create
  the profile and assignment first and then open the grid, or configure Custom from
  Settings → Team Members after the invite. The grid itself is now reachable from T6.
- **"Save as role template"** is marked Optional (Low) in the spec.
- **Auto-assignment for a new plan** when a Team Member holds All Plans (T1 Part B item 4)
  remains unwired — it is listed in §10.
- **No test covers the screen's own rendering.** The suite tests the rules and the write
  path it uses; there is no component test for the three steps.

---

## 9h. T9 — Invite acceptance

Not a spec ticket: the missing second half of T4/T5. T4 and T5 send an invitation email, but
nothing turned it into access — and access is resolved **by login**, because
`resolvePlanAccess` finds the `TeammateProfile` whose `loginUserId` equals the session's
`userId`. Every verify suite before T9 created that link by hand. T9 is the caller
`activateProfile` never had.

### The flow

1. `inviteCollaboratorToPlan` mints a signed token from the profile's own `invitedAt` and
   puts it in the email's primary CTA.
2. `GET /accept-invite/[token]` renders `loadInvitation(token)`: who invited you, which plan
   and section it is about, and the invited mailbox as a locked, read-only field.
3. `POST /api/teammates/accept-invite` runs `acceptInvitation`, which re-validates from
   scratch (a link can be replayed or edited between render and submit), creates or reuses
   the login, and activates the profile.

### Three landmines it had to clear

- **The onboarding gate.** `middleware.ts` sends any signed-in user without an
  `onboardingComplete` latch to `/onboarding`. A collaborator never has a `wizardSession`, so
  the old gate would have dropped them into the advisor wizard. The `jwt` callback now also
  latches a user who holds an active teammate profile — including the
  `{ deactivatedAt: null }`-vs-absent trap, which needs the explicit two-branch `OR`.
- **`signIn` creates an Organization for every new User.** Acceptance creates a User *outside*
  `signIn`, so it has to do the same, or the accepted login is the one User in the database
  with no `organizationId` — exactly what `verify-backfill` asserts against. `acceptInvitation`
  now calls `getOrCreateOrganizationForUser`. It grants nothing extra: access comes from the
  profile's assignments, never from that organization, so the personal, planless Organization
  is invisible to authorization. (Recorded in the QA checklist as a non-bug, because it looks
  surprising in the database.)
- **No token existed.** Nothing on the profile can prove "this link is ours" — `profileId` is
  an ObjectId, not a secret. T9 signs `{ profileId, organizationId, email, invitedAt }` with
  `NEXTAUTH_SECRET` and lets it expire with the 14-day invite hold, so revocation needs no
  bookkeeping: deactivate the person, remove the assignment, or let the hold lapse, and the
  link stops working.

### The governing rule: never trust the token, trust the profile

The token proves the link was minted by us and has not expired. Everything else — still
invited, not deactivated, not already accepted, right mailbox — is decided by re-reading the
profile. Two consequences worth keeping:

- An **already-accepted** invite reports `already_accepted` and points at sign-in. Collapsing
  that into "revoked" would tell a returning invitee their invitation was withdrawn when in
  fact it worked.
- A **forwarded** link is refused unless the mailbox matches, because the mailbox is the
  identity here.

### Failure vocabulary

One status union, shared by the page and the API: `ok`, `invalid`, `expired`,
`already_accepted`, `deactivated`, `revoked`, mapped to 200 / 400 / 409 / 410.

### Files

| File | Role |
|---|---|
| `lib/teammates/invite-token.server.ts` | `signInviteToken` / `verifyInviteToken`, the accept URL, and a constant-time compare over `TextEncoder` bytes (avoids `crypto.timingSafeEqual`'s Buffer typing). |
| `lib/teammates/invite-acceptance.server.ts` | `loadInvitation` (read-only, safe to call on render) and `acceptInvitation` (the write). |
| `app/api/teammates/accept-invite/route.ts` | Public GET/POST, status→HTTP mapping, and a best-effort per-IP throttle that is documented as non-durable. |
| `app/accept-invite/[token]/page.tsx` + `components/teammates/invite-accept-form.tsx` | The summary-then-credentials screen, reusing the existing credentials form. |
| `lib/email.ts` | "Accept the invitation" as the primary CTA; the section link demoted to a secondary line so an already-active person still has a way in. |
| `lib/auth-options.ts` | The onboarding latch also accepts an active, non-deactivated teammate profile. |

The route is intentionally public: `middleware.ts` gates only the paths on its `APP_ROUTES`
allow-list, and `/accept-invite/...` is not on it — which is required, since redeeming the
invite is how the login comes to exist.

### Verification

`npm run teammates:verify-t9` — 41 assertions: the token round-trip and its three refusals
(tampered, malformed, past the hold), the mailbox guard, the four profile guards
(missing/Contact/deactivated/never-invited), acceptance creating *and* reusing a login without
overwriting an existing password or name, the seat conversion (`seatsUsed` unchanged), replay,
the weak-password refusal, both audit rows, and the tenancy invariant that every login the
flow creates owns an Organization.

No mail leaves the machine: the invite is raised with `skipEmail: true` and the token is minted
exactly as `invites.server.ts` mints it.

**Retrospective.** T9 shipped its own version of the stranded-fixture bug: the logins it
creates are made *inside* `acceptInvitation`, so `verify-t9`'s cleanup list did not include
them, and the fixture sweep could not see them either (its pattern stopped at `t5` and
`@example.test`). The fix has two halves — the service now gives the login an Organization, and
the suite tracks and removes every login the flow creates — plus the widened sweep in §7.7.
That is the case that made `verify-backfill` fail on `2 missing`, and it is why the tenancy
invariant is now an assertion rather than an assumption.

---

## 10. Residual migration debt

Tracked, deliberately **not** part of T1:

1. **`userId` → `organizationId` across ~300 call sites.** New code must use
   `lib/organization.ts`; the T2 enforcement layer in particular should read only
   org-scoped helpers.
2. **R2 key prefixes.** Object keys are `org/{userId}/…` and validated by prefix
   (`app/api/r2/signed-url`, `r2/delete`, `r2/presign-upload`, and the
   `buildUploadKey({ orgId })` callers). Moving to a stable organization id
   invalidates existing keys, so it needs a copy/alias plan.
3. **Portal owner resolution.** `lib/portal-access.ts` derives the owning advisor
   from `Client.userId`; it should resolve through `organizationId`.
4. **Organization membership.** `Organization` currently models a single
   `ownerUserId`. If a firm ever needs multiple owners/admins at the org level,
   that belongs on `Organization` rather than on this feature's models.
5. **New-plan auto-assignment.** Spec Part B item 4 ("All Plans" generates an
   assignment for every new plan) has its data support (`listAllPlansTeamMembers`)
   but is not yet wired into plan creation — that lands with T3/T6.
6. **The contact mirror is called explicitly, not automatically.** Every server-side
   writer of `Client.keyContacts` calls `mirrorPlanContactsSafely` after its write, and a
   writer added later must do the same or the hub will drift until the backfill runs.
   Current choke points: `POST /api/clients`, `POST /api/clients/create`,
   `PUT /api/clients/[id]` — which also covers the Benefits wizard, since
   `lib/save-benefit.ts` PUTs to it — `POST /api/new-client-wizard/complete` and
   `POST /api/new-client-wizard/save-draft`.
   `npm run teammates:backfill-contacts` is the remedy.

Two problems found while building the invite entry points were **fixed, not
deferred**: plan creation now stamps `organizationId` at all four creation paths
(§7.6), and verify runs sweep stranded fixtures and clean up on Ctrl-C (§7.7).

---

## 11. Next tickets

**T8 (Collaborator gating + upgrade previews) remains deliberately unbuilt.** The spec
marks it `Status: Deferred pending pricing`, and the Open Decisions table names two
blockers it cannot close itself: the collaborator cap numbers per tier, and the tier
breakpoints and pricing. Two further pieces are blocked rather than pending — Part A item
3 ("Preview your branded hub") waits on the WEP pipeline *"once built"*, and Part B item 3
(converting a collaborator into a paying customer creates a new Organization) is the
signup/billing path. Reconnaissance found nothing built for caps or upgrade screens yet,
and one gap would need a schema addition first: the upgrade screen differs by collaborator
**type**, but that type is currently recorded only on the audit row (`whoIsThis` /
`inviteContext`), never on the profile. If T8 is picked up before pricing lands, the
buildable subset is: caps as configuration, locked-but-visible gating on the three named
surfaces, the three type-tailored upgrade screens, and view/click tracking — with the
pricing-dependent pieces rendered visible-but-disabled the way T4 did with "Customize
access".

- **T2a follow-up** — decide how Custom access is granted at *invite* time (the invite
  may create the profile, so there is no assignment to write a grid onto yet — see §9g),
  and the Optional "Save as role template".
- **T4 follow-ups** — wire "Customize access" once T2a lands; build the
  Ready-for-Review / Approve / Send-Back workflow (needs a review state on
  `PlanAssignment` and a notification channel).
- **T5 follow-up** — make a contact a profile the moment it is saved (state
  `contact`, no login, no cap) so "upgrade keeps the same profile" holds literally,
  which is the same change that moves the hub onto profile + assignment (T7).
- **T6 follow-up** — per-plan custom permissions stay blocked on T2a (the screen shows
  an assignment's stored grid but does not author one), and the "cannot log in" half of
  the deactivate criterion belongs to the auth layer, which does not yet consult
  `TeammateProfile.deactivatedAt`.
- **T7 follow-up** — two loose ends, both recorded in §9f: the mirror is called
  explicitly rather than by a Prisma extension on `Client` writes (so a future writer can
  forget it — §10.6), and the authoring surfaces still store contacts in
  `Client.keyContacts`, so that array remains a write surface even though it is no longer
  a read source.
- **T2 follow-up** — migrate the remaining owner-scoped routes to
  `requirePlanAccess` (see the coverage table in §8) and wire
  `listAccessiblePlanIds` into the plan selector.
- **T9 follow-up** — the accept route's per-IP throttle is in-process and non-durable (it
  resets on redeploy and does not span instances); a shared store is the real fix if abuse
  ever matters. And there is no dedicated **resend invitation** action — resending means
  re-inviting the same person from the same surface, which merges onto their existing
  profile rather than creating a second one (T5's rule).
