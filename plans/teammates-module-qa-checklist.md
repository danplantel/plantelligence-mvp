# Teammates Module — manual QA checklist

Derived from `Team_Collaborator_Access_Developer_Spec (1).pdf`, organised by ticket, for
checking the built module by hand.

Each item is `- [ ]` with the **action** and then the **expected result**. Acceptance
criteria from the spec are marked **[spec]**; items that exist because of how the module
was actually built are marked **[impl]**.

The automated suite already covers the rules and the write paths — see
[Pre-flight](#pre-flight). What a person has to check is the *UI*, the flows that cross
screens, and the things a script cannot see (copy, ordering, layout, an email arriving).

---

## Pre-flight

Run these first. They prove the data layer is healthy before you go looking for a bug in
the UI, and they leave the database clean.

```bash
# 0. Prove the app is on the new database at all — run these two before anything else.
npx prisma migrate status              # expect: "Database schema is up to date!"
npm run check:no-mongo                 # expect: "no MongoDB coupling remains"

npm run teammates:verify-backfill     # 7 assertions  — every User/Client has an org
npm run teammates:verify              # 24 assertions — T1 data model
npm run teammates:verify-t2           # 35 assertions — enforcement layer
npm run teammates:verify-t2a          # 25 assertions — Custom grid
npm run teammates:verify-t3           # 53 assertions — team management + seats
npm run teammates:verify-t4           # 62 assertions — invite from Create Benefits
npm run teammates:verify-t5           # 38 assertions — Key Contacts entry point
npm run teammates:verify-t6           # 35 assertions — Assignment management screen
npm run teammates:verify-t7           # 26 assertions — hub contact display
npm run teammates:verify-t9           # 41 assertions — invite acceptance (collaborator login)
```

- [ ] All ten suites report **all assertions passed**.
- [ ] `npx tsc --noEmit` exits 0, and `npm run lint` reports no warnings.
- [ ] **`npm run check:no-mongo` is clean.** Until it is, the surfaces it names are known
      broken — read [Known gaps](#known-gaps--do-not-report-these-as-bugs) **before** filing
      anything about benefits, videos, webinars, documents or plan creation.
- [ ] If a suite fails with a **foreign-key error (`P2003`)** while cleaning up its fixtures,
      that is the new foreign keys doing their job — Postgres enforces relations that Prisma
      only emulated before. Report it; do not work around it.
- [ ] If a suite fails on "every User has an organizationId", a previous interrupted run
      left a fixture behind: `npm run repair:purge-verification-fixtures -- --apply`.
- [ ] If a suite fails on "every Client whose owner still exists is stamped", run
      `npm run teammates:backfill`.
- [ ] Note that on a **fresh database** `verify-backfill` passes trivially (0 users, 0 plans).
      That proves the connection, not the invariants — run it again after creating a plan.

### Accounts you need

Several checks require a login that is **not** the owner.

| Account | Role | Why |
|---|---|---|
| Owner | owns the organization | everything |
| Collaborator login | external, assigned to one plan + one category | the access-denial and hub checks |
| Unassigned login | no assignment at all | the "no access" checks |

- [ ] Have at least these three before starting, or the access-denial items cannot be
      tested.

**How to get a Collaborator login (T9).** Before T9 there was no way to turn an invitation
into a login — this account had to be inserted into the database by hand. It is now a flow,
and it is the account every access-denial check in T2 depends on: invite a mailbox you can
open (an alias is fine), open the **accept link** from the email, choose a password, and you
are signed in as that collaborator, landing on the section they were invited to. The full
flow — including expired, revoked, already-accepted and wrong-mailbox refusals — is
[T9 — Invite acceptance](#t9--invite-acceptance-creating-the-collaborator-login).

---

## Create Plan — the draft-resume flow

The wizard may only offer to resume a plan that **exists on the server**. Browser storage is a
cache of typing, never evidence that a plan exists — that rule lives in
[`lib/new-client-wizard-resume.ts`](../lib/new-client-wizard-resume.ts:1), and the reasoning is
in [§P5a of the migration plan](./postgres-migration.md). These five checks are the ones that
were failing.

- [ ] With **no drafts on the server at all** (a fresh database), open **Create Plan**. You go
      straight into a blank wizard — **no "You have an in-progress plan" dialog**. This is the
      bug that prompted the rebuild.
- [ ] Save a draft, confirm it appears in **View Plans**, delete it there, then revisit
      **Create Plan**. You are **not** offered to resume the deleted plan.
- [ ] **A second advisor on the same browser:** sign out, sign in as a different account, open
      **Create Plan**. You must **not** see the first advisor's company name, contacts or
      images. The snapshot is attributed to a user and discarded when it is not yours.
- [ ] Type a company name and navigate away **within about three seconds**, before autosave
      fires. Returning to the wizard **keeps your typing** and does **not** prompt — there is no
      server draft yet, so there is nothing to resume.
- [ ] Now let autosave run, navigate away and return: you **are** offered the resume dialog,
      naming the company and the last-saved time.

Two behaviours worth not reporting as bugs:

- **The first load after deploying this change discards the existing browser snapshot**, because
  the snapshot written before the rebuild carries no owner and therefore cannot be attributed.
  It happens **once per browser** and starts the wizard clean. If a tester reports "my
  half-finished plan vanished on first load", that is this.
- **A network failure never clears local work.** Only an explicit "draft not found" does — so
  losing connectivity mid-wizard should leave your typing untouched.

---

## T1 — Data model

Mostly invisible, but two things are observable.

- [ ] Open a plan, give a person a phone number, then open a **second** plan they are
      also on. The phone number is the same on both. **[spec T1]** "One profile, reused
      everywhere."
- [ ] Edit that person's job title from the second plan. The first plan shows the new
      title too — same profile, not a copy.
- [ ] A person who collaborates with **two different organizations** appears as two
      separate profiles and does not leak between them. **[spec]** "Editing Jane's profile
      in Org A does not change her profile in Org B."
- [ ] A Partner/Provider company (e.g. "ABC Benefits") **never** appears in a Plan
      Sponsor picker. **[spec]** "Partner companies never appear in Plan Sponsor search."
- [ ] Two people from the same firm share **one** company record — check by adding two
      collaborators with the same company name and confirming the company is listed
      once. **[spec]**

---

## T2 — Permission enforcement

- [ ] As the **collaborator login** (assigned to Ayres → Group Health), open Ayres →
      Group Health. It opens.
- [ ] Navigate directly to **Ayres → Retirement** by URL. You see "You don't have access
      to this plan/section" with a link back to the dashboard. **[spec]**
- [ ] The notice does **not** flash for a moment before content loads when the user *does*
      have access. (This was a fixed bug; re-check it, especially on a cold load.)
- [ ] As a **Viewer**, the save controls are hidden or disabled, and saving by any route
      is refused. **[spec]** "A Viewer cannot save edits."
- [ ] As an **unassigned** login, a signed document URL is refused. **[spec]**
- [ ] Confirm the last Owner cannot be removed: try to deactivate or demote the only
      Owner. It is refused with a message about keeping an Owner.
- [ ] As a collaborator, confirm you cannot see organization settings or billing at all.

---

## T2a — Custom role (plan-first grid)

Reached from **Settings → People & Access → click a person → any assignment's Role
dropdown → `Custom…`**.

- [ ] The screen opens at **Step 1: Plans**, pre-filled with the person's current plan.
      **[spec]** "Pre-filled with the current plan."
- [ ] As a **Collaborator**, **All Plans does not appear** — instead a line says it is
      available to Team Members only. **[spec]** "All Plans never appears for a
      Collaborator."
- [ ] As a **Team Member**, All Plans **does** appear, and choosing it shows
      "Includes plans created in the future." **[spec]**
- [ ] Step 2 shows "Same categories on all plans" **on** by default; turning it off gives
      each plan its own picker. **[spec]**
- [ ] Step 3 shows "Same permissions on all selected plans" **on** by default; turning it
      off gives each plan its own tab. **[spec]**
- [ ] Every grid row offers `No Access / View / Edit`, except Publish, Invite and Delete
      which offer `Not Allowed / Allowed`, and Benefits Hub Preview which offers only
      `No Access / View`. **[spec]**
- [ ] As a **Collaborator**, the rows **Publish, Invite, Delete, Org Settings and Billing**
      show a lock and cannot be selected, with the copy "Not available for external
      collaborators." **[spec]**
- [ ] A summary line sits above the steps and reads like a Custom summary naming the plan,
      e.g. "Custom · Edits Documents on Ayres". **[spec]**
- [ ] Making a selection that warrants a warning shows it **inline** immediately.
      **[spec]**
- [ ] Saving with warnings open shows **one** confirm listing everything flagged; the save
      completes after confirming. **[spec]**
- [ ] After saving, reopen the person: each plan's Role shows **Custom**, and the
      per-plan grids are the ones you set.
- [ ] With "same permissions" on, both plans end up with **identical** grids. **[spec]**
- [ ] With it off, Edit on one plan and View on the other are enforced independently —
      verify by signing in as that collaborator and checking both plans. **[spec]**
- [ ] A Custom grid that matches a preset exactly raises the "matches [Editor]. Use the
      preset instead?" warning. **[spec]**

**Observation to record:** granting Custom at *invite* time is deliberately not wired (see
[Known gaps](#known-gaps--do-not-report-these-as-bugs)), so this screen is the only place
Custom access is set.

---

## T3 — Team Member management + seats

Open **Settings → People & Access**.

- [ ] The seat line reads "X of Y seats used", with pending invites shown separately.
      **[spec]**
- [ ] The **i** icon opens "How seats work" and the reserved-seat line is **true for who
      you are signed in as**: it says *"Your own seat is counted"* for the owner, and
      *"The owner's seat is always counted"* naming them for anyone else. **[impl]**
- [ ] The owner appears as the **first** Team Member, with their headshot on the card.
      **[spec]** "The owner appears as the first Team Member."
- [ ] Adding a Team Member fills a seat; the counter goes up without a page reload.
      **[spec]**
- [ ] Adding beyond the included seats shows an **upgrade confirm**, not a hard block.
      **[spec]**
- [ ] An invite that is never accepted releases its seat after the hold period (14 days) —
      verify the counter treats a pending invite as held.
- [ ] The **Roles & permissions** button opens an explainer where every accordion starts
      **closed**. **[impl]**
- [ ] Opening one accordion gives its content a distinct background so the open section
      reads apart from the rest. **[impl]**
- [ ] Role labels in the explainer are consistently **dark grey**, not accent-blue.
      **[impl]**
- [ ] Add Collaborator uses the same modal as Add Team Member but is pinned to the
      Collaborator type, and **All Plans is not offered**. **[impl]**
- [ ] The Settings header reads **"Settings / {Organization Name}"** with the organization
      in accent-blue. **[impl]**

---

## T4 — Invite Collaborator from a benefit

- [ ] On **/benefits**, each existing benefit row has an **Invite Collaborator** button
      next to Edit, and a chip showing the assignment (e.g. "Assigned to Jane · 3 fields
      missing") when someone is assigned. **[spec]** "The card shows the assignment."
- [ ] Opening it from Ayres → Group Health shows the plan and category as **locked chips**,
      not fields. **[spec]** "An invite from Ayres → Group Health is scoped to exactly
      that; the user is not asked again."
- [ ] "Who is this?" offers exactly four answers: Plan Sponsor HR, Outside Advisor /
      Specialist, Provider Rep, Reviewer only. **[spec]**
- [ ] Typing an address on a **plan sponsor's domain** pre-selects Plan Sponsor HR and
      explains why; you can override it and the guess stops fighting you. **[spec]**
- [ ] Optional note and due date are both accepted. **[spec]**
- [ ] "Add Existing Collaborator" search finds a person by name, email or company, and
      selecting one fills their saved details instead of creating a duplicate. **[spec]**
- [ ] The invite email arrives, names the section, deep-links to it, and lists the missing
      fields. **[spec]**
- [ ] A second invite to the same person on **another plan** adds an assignment and does
      **not** create a second profile. **[spec]**
- [ ] Re-inviting on the same plan re-sends without wiping a previously set note or due
      date. **[impl]** (a bug fixed during T4)
- [ ] The "Customize access" link is present but **disabled**, and says why. **[impl]**
      (deliberate — see Known gaps)

---

## T5 — Key Contacts entry point

Create Plan → **Step 3: Key Contacts**.

- [ ] The opening prompt offers **two** options: "Company / Plan Sponsor" and
      **"Invite Collaborator to Complete Profile"**. **[spec]**
- [ ] The invite option opens a dialog that defaults to **This Plan**, and lets you pick
      the categories. **[spec]**
- [ ] "Add Existing Contact / Collaborator" searches by person or company. **[spec]**
- [ ] In the Category Explorer, every existing contact has an **Invite** action, and it
      opens the dialog pre-filled with that contact's name, email and categories.
      **[spec]** "Invite to collaborate on any existing Contact."
- [ ] Inviting before the plan is saved still works — the wizard saves the draft on demand,
      and refuses cleanly rather than inviting into nothing if it cannot. **[impl]**
- [ ] A contact created with **Complete Profile Myself** appears on the hub with **no**
      invite sent. **[spec]**
- [ ] Upgrading that contact to a Collaborator keeps the same profile (the person's history
      and assignments are not replaced by a new row). **[spec]**
- [ ] Inviting a **Team Member's** email as a Collaborator is refused with a clear message
      rather than creating a duplicate. **[impl]**

---

## T6 — Assignment management screen

Open **Settings → People & Access** and click a person (a seat card or a Collaborator row).
The owner row keeps its own read-only dialog — that is expected. **[impl]**

- [ ] The screen shows the **profile at the top** and assignments **listed below by
      plan**. **[spec]**
- [ ] Plan access offers **Certain Plans** (searchable checklist) and **All Plans**, and
      All Plans is **absent for a Collaborator**. **[spec]**
- [ ] Benefits access offers **All / Certain**, pre-filled from what the person already
      holds. **[spec]**
- [ ] Each assignment row has its own **role dropdown** and **Show on Benefits Hub**
      toggle. **[spec]**
- [ ] Changing a role on one row leaves the other rows untouched — one screen, independent
      rows. **[impl]**
- [ ] Changing display on one row does not change its role. **[impl]**
- [ ] **Remove** on a row drops that plan immediately, and the person's access to it is
      gone on the next page load. **[spec]**
- [ ] Removing/changing stops for a moment with a spinner on that row rather than the whole
      screen. **[impl]**
- [ ] The three person-level actions are present and separate: **Remove Assignment** (per
      row), **Deactivate**, **Delete Profile**. **[spec]**
- [ ] Deactivate keeps the profile (it reappears with a "Deactivated" badge) and offers
      **Reactivate**. **[spec]**
- [ ] **Delete Profile is disabled while assignments remain**, with an explanation
      naming how many are left. **[spec]**
- [ ] After removing every assignment, Delete becomes available and works. **[spec]**
- [ ] Deleting a profile does **not** delete plans or content the person created.
      **[spec]**
- [ ] A deactivated person cannot be given a new plan until reactivated. **[impl]**
- [ ] Every change you make here appears in the audit trail with who and when (the suite
      asserts this; spot-check via any audit view you have). **[spec]**

---

## T7 — Benefits Hub contact display

Open a plan's **public hub** (My Benefits Team and a benefit category page).

- [ ] A person assigned to that plan **with display on** appears in **both** places: the
      team list and the category page. **[spec]**
- [ ] They do **not** appear on any other plan's hub. **[spec]**
- [ ] Each card shows **headshot, name, title, designation, company logo, email, phone**
      — whatever the profile holds. **[spec]**
- [ ] Turning **Show on Benefits Hub off** for that assignment makes them disappear from
      the hub. **[spec]**
- [ ] While display is off, they can **still edit** the plan they are assigned to.
      **[spec]** "Display off keeps their admin access."
- [ ] Hiding a **category** removes that category's contacts from the hub. **[spec]**
- [ ] Changing the person's **phone number in their profile** updates **every** hub they
      appear on, without touching either plan. **[spec]** — this is the point of T7.
- [ ] A plan's hub still shows its contacts after the T7 migration — **check at least one
      plan you did not edit during testing**, because the hub's data source changed.
      **[impl]**
- [ ] Contacts with no email address still appear (they cannot become profiles, so they are
      passed through). **[impl]**

---

## T9 — Invite acceptance (creating the collaborator login)

The step that used to be missing. An invitation is only a promise until someone redeems it:
access is resolved by looking up the login on a profile (`TeammateProfile.loginUserId`), so
until the accept link is used, an invited person still cannot sign in.

- [ ] Invite a mailbox you control from **Add Benefit → Contacts → Invite Collaborator**. The
      email's **primary button says "Accept the invitation"**; the "open the section" link is
      now a secondary line rather than the button. **[impl]**
- [ ] Open the accept link. Before asking for anything, the page says **who** invited you,
      **which plan and section** it is about, and shows the invited address as a **locked,
      read-only** field. **[spec]** "The user is not asked again."
- [ ] Submitting a password lands you **on the invited section** (single-category invite) or
      on the plan list (all-sections invite). **[impl]**
- [ ] You are a real login afterwards: sign out, sign in at `/signin` with the same email and
      password, and land in the same place. **[spec]** "…an ordinary credentials user
      afterwards."
- [ ] You are **not** dropped into the advisor onboarding wizard. (A collaborator has no
      `wizardSession`, so the old gate would have sent them there.) **[impl]**
- [ ] As that collaborator, the plan list shows **only** the plan(s) assigned to you — none of
      the owner's other plans. **[spec]**
- [ ] **Already accepted:** open the same accept link a second time. It says the invitation was
      already accepted and points at **sign in** — not at an error. **[impl]**
- [ ] **Deactivated:** deactivate the person in Settings → People & Access → Collaborators, then
      reopen the link. It is refused with the deactivated copy. (Re-activate to tidy up.)
      **[impl]**
- [ ] **Wrong mailbox:** open the accept link from a different mailbox. It is refused — the
      mailbox is the identity, not the link. **[impl]**
- [ ] An **expired** invite (past the 14-day hold) is refused as expired, and its seat has
      already been released. **[spec]**
- [ ] The login this creates owns an Organization, like every other `User` — the T1 invariant
      `verify-backfill` asserts. This was the defect T9 first shipped with. **[impl]**

---

## Cross-cutting checks

- [ ] **Invite emails** arrive once per invite, from the right sender, with a working deep
      link, and the copy reads correctly for a **multi-section** invite ("the Retirement,
      Group Health sections" vs one section). **[impl]**
- [ ] **No duplicate profiles**: after inviting, re-inviting, and editing, search Settings
      for the person — exactly one row. **[spec]**
- [ ] **Seat accounting is unaffected by collaborators**: adding a Collaborator, a Contact
      or a mirrored hub contact never moves the seat counter. **[spec]**
- [ ] **Completeness copy matches reality**: the "N fields missing" count on an invite chip
      matches the missing fields the invite email lists. **[impl]**
- [ ] **Dark mode** pass over Settings → People & Access, the Plan Access screen, the Custom
      grid and the invite dialog.
- [ ] **Narrow viewport** pass over the same four surfaces — long plan and company names
      truncate rather than overflow.
- [ ] **Deployment targets the new database.** `.env` is gitignored and **Vercel does not read
      it** — the dev and production projects each need `DATABASE_URL` (pooled, including
      `pgbouncer=true`) and `DIRECT_URL` set in their dashboards. Until that is done those
      deploys still write to MongoDB, so check it before investigating any "my data
      disappeared" report.
- [ ] **A brand-new signup works end to end** against the new database: the account saves, an
      Organization is created for it, and that account can create a plan.

---

## Known gaps — do NOT report these as bugs

These are deliberate, recorded decisions. Reporting them wastes a cycle.

- **T8 (collaborator gating + upgrade previews) is not built at all.** The spec marks it
  `Deferred pending pricing`, and two Open Decisions block it (cap numbers per tier; tier
  breakpoints and pricing). Nothing about caps or upgrade screens exists yet — that is
  intentional.
- **A deactivated person's *login* is not refused by the auth layer.** Every plan
  disappears from their list and every organization-scoped read is refused, but refusing
  the credential itself is the auth layer's job and it does not yet consult
  `deactivatedAt`. Test the authorization half, not a login screen.
- **"Customize access" in the invite dialog (T4) is disabled on purpose.** A Custom grid
  must be written onto an assignment, and at invite time the person may have no profile or
  assignment yet. Configure Custom from Settings → People & Access after the invite.
- **A Team Member with All Plans does not automatically get access to a plan created
  later.** Unwired; listed in the module docs.
- **Plan creation stamping** is now wired, but a plan created by an **older build** (before
  that fix) can still be unstamped. `npm run teammates:backfill` is the remedy, and
  `verify-backfill` prints the offending plan by name.
- **Contacts with no email cannot become profiles**, so they are excluded from the teammate
  layer and passed through to the hub unchanged. They will not appear in Settings →
  Collaborators.
- **The `plans/` file "Save as role template"** from T2a is marked Optional (Low) in the
  spec and is not built.
- **The accepted collaborator owns an empty Organization.** Every `User` gets one — it is
  the T1 invariant and exactly what `signIn` does for any new account — so a collaborator
  invited into *someone else's* organization also has a personal, planless one. It grants
  nothing (plan access is resolved from their profile's assignments, never from that
  organization) and it is not a leak. Do not report it.
- **The MongoDB → PostgreSQL migration is not finished, so some surfaces are expected to be
  broken.** `npm run check:no-mongo` still reports findings in ~30 files. While it does, treat
  these as known and stop: **Edit Benefit**, **renaming a plan's portal URL**, **opening a plan
  video**, **webinars by id**, **plan creation that attaches a video**, **marketing flyer
  rendering**, **viewing a document**, and the client-side "is this a persisted document id"
  checks in the benefits and documents wizards.
  The cause is uniform — a 24-hex "looks like a Mongo id?" test that no longer matches cuid
  ids — so the symptom is a **missing record or a silently dropped file** rather than an error.
  `npm run check:no-mongo` is the authoritative list, and the remaining work is tracked in
  [plans/postgres-migration.md](./postgres-migration.md). Anything **not** on that list is fair
  game to report.

---

## Reporting a bug

Include, so it can be reproduced without a second round trip:

1. The ticket above (e.g. T6) and the exact steps.
2. Which account/role you were signed in as, and whether you were on the owner's own row.
3. The plan and category involved.
4. What you expected versus what happened.
5. Whether the ten `verify-*` suites still pass, and whether `npm run check:no-mongo` is clean.
   If either fails, paste the failing line — both usually name the cause directly.
