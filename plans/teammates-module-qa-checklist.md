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
#   Fresh database or a new Neon branch: npx prisma migrate deploy, then npx prisma generate.

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
- [ ] **No two suites were run at the same time.** Every suite now sweeps stranded fixtures
      *before* it asserts and again on Ctrl-C, and another run's in-flight rows are
      indistinguishable from stranded ones, so a concurrent run deletes them.
- [ ] **`npm run check:no-mongo` is clean.** As of the last run it reports **80 findings in
      28 files** — 63 `ObjectId` references and 17 hand-written 24-hex shape tests. While it is
      not clean, the surfaces it names are known broken: read
      [Known gaps](#known-gaps--do-not-report-these-as-bugs) **before** filing anything about
      benefits, documents, videos, webinars, marketing flyers, contact-form topics or plan
      creation.
- [ ] If a suite fails with a **foreign-key error (`P2003`)** while cleaning up its fixtures,
      that is the new foreign keys doing their job — Postgres enforces relations that Prisma
      only emulated before. Report it; do not work around it.
- [ ] If a suite fails on "every User has an organizationId", a previous interrupted run
      left a fixture behind: `npm run repair:purge-verification-fixtures -- --apply`. A hard
      kill (closing the terminal) skips the Ctrl-C sweep, so this is still reachable.
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
| Admin | a Team Member holding Org Settings, and **not** the owner | the Settings tab from a non-owner's side: the reserved-seat copy, and the `seat_limit_owner_only` refusal |

- [ ] Have at least the first three before starting, or the access-denial items cannot be
      tested. The fourth is optional, but it is the only way to see the reserved-seat line and
      the seat-limit confirm behave correctly for someone who is not the owner.

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
- [ ] As a collaborator, every plan picker (Documents, Marketing, Meetings, Videos,
      Webinars, Benefits step 1) lists **only** the plans assigned to you — never the
      owner's other plans. **[spec]** "Collaborators never see unassigned plans."
- [ ] A **deactivated** teammate's plans drop out of their picker and every org-scoped read
      is refused. Their *login* still works — that half belongs to the auth layer, see
      [Known gaps](#known-gaps--do-not-report-these-as-bugs). **[impl]**

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
- [ ] The tab is labelled **People & Access** (its internal value is still `members`), and the
      seats UI lives **only** here — the dashboard shows **no seat meter**. Spec T3 asks for it
      in both places; dropping the dashboard zone is a deliberate decision, not an oversight.
      **[impl]**
- [ ] The **i** "How seats work" dialog is driven by the live meter: its four figures (used /
      active / pending / available) match the line above it, and the amber callout appears only
      when the organization is at its limit. **[impl]**
- [ ] **Remove from seat** on an occupied card asks first, then releases the seat and says
      which of the two things happened: an **un-accepted invite returns to Contact** (fully
      reversible, profile and notes kept), an **accepted member is deactivated** (access to
      every plan ends). Either way the counter drops by one and the person is still listed.
      **[impl]**
- [ ] **Remove from seat is absent on the owner's card and on a deactivated row.** The owner's
      seat is reserved, and a deactivated member holds none. **[impl]**
- [ ] **Team Members** and **Collaborators** are two peer accordion sections, **both open** by
      default, each with its own live count. Collapsing one leaves the other alone (the older
      layout had a single collapsible Collaborators block, so this is the check that it is now
      one accordion with two independent sections). **[impl]**
- [ ] The seat meter and the "How seats work" ⓘ sit **above** both sections, not inside one —
      the meter counts seats, and only Team Members hold one — with **Roles & permissions**
      beside them. **[impl]**
- [ ] Each section's action is **in its header**, so it is reachable without scrolling the
      list: **Add Team Member** in the Team Members header, **Add Collaborator** in the
      Collaborators header — and the two are **the same width**, so the headers read as one
      column rather than two buttons sized to their own labels. **[impl]**
- [ ] **Collapse a section, then press its header action:** the section expands and the modal
      opens. Pressing a header action must not *only* toggle the accordion, and pressing the
      header itself — anywhere outside that button — must still toggle it. **[impl]**
- [ ] The Collaborators section lists people as **rows** (a seat is what they do not consume),
      shows each person's partner company and status, and states that a Collaborator is free
      and holds no seat. **[impl]**
- [ ] **Add Collaborator** opens the modal, and that modal's **first slide** offers
      **Invite Collaborator** as a full-width row under the two contact tiles (New Contact /
      Existing Contact). It appears **only** for a Collaborator: adding a Team Member must not
      offer it (an invite always creates a Collaborator). **[impl]**
- [ ] **The modal's footer has no Invite Collaborator** on the New Contact or Existing Contact
      slides — walking a path through the form ends in Add, and inviting is a separate choice
      made on the first slide. **[impl]**
- [ ] **Press that first-slide invite row:** the modal closes and the invite dialog opens empty
      — no person has been established yet, so its own who-is-this, plan and category fields are
      what collect the invite. The two dialogs must never stack. **[impl]**
- [ ] With **no plans**, that invite row is disabled and its tooltip says to create a plan first
      (an invite is scoped to one plan). **[impl]**
- [ ] The Add modal puts **access first** on both of its slides, and its **New Contact** slide
      asks only for fields a profile can store (name, job title, email, phone + extension,
      headshot, company). See [Known gaps](#known-gaps--do-not-report-these-as-bugs) for the
      card fields it cannot yet carry. **[impl]**

---

## T4 — Invite Collaborator from a benefit

- [ ] On **/benefits**, each existing benefit row has an **Invite Collaborator** button
      next to Edit, and a chip showing the assignment (e.g. "Assigned to Jane · 3 fields
      missing") when someone is assigned. **[spec]** "The card shows the assignment."
- [ ] Opening it from Ayres → Group Health shows the plan and category as **locked chips**,
      not fields. **[spec]** "An invite from Ayres → Group Health is scoped to exactly
      that; the user is not asked again."
- [ ] In **Add Benefit** and **Edit Benefit** the invite lives on the **Contacts section
      header**, not inside the Collaborators accordion, and it stays disabled with "Save the
      plan first, then invite a collaborator" until there is both a plan and a category —
      those two things are what the invite is scoped by. **[impl]**
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

## Invite entry points — where the button is

One intent ("put this person on these sections and email them") is reached from five places in
the current build. Every one of them POSTs to `/api/teammates/invite-collaborator` and lands on
`inviteCollaboratorToPlan()`, so the guards are shared: no seat check, no Team-Member email, no
All Plans, the category merge on re-invite, the invite-metadata rule, the audit row and the
email. What differs is **how the plan is resolved** and what the audit row records as the
`source`.

| Surface | How it opens | Plan resolution | `source` |
|---|---|---|---|
| **/benefits** category card | "Invite Collaborator" beside Edit | the card's plan | `create_benefits` (the default) |
| **Create Benefit → Contacts** | header button on the Contacts step | the plan being built | `create_benefits` |
| **Edit Benefit → Contacts tab** | the same header button | the plan being edited | `edit_benefit` |
| **Create Plan → Key Contacts** | the second prompt card, or per-contact "Invite" in the Category Explorer | the wizard draft, persisted on demand | `key_contacts` |
| **Settings → People & Access → Collaborators** | "Invite Collaborator", beside "Add Collaborator" | chosen in the dialog's own plan picker | `settings` |

- [ ] Each surface opens the invite dialog, and each writes the surface it came from onto the
      audit row. Raise at least two from different surfaces and confirm the audit entries
      differ. **[impl]**
- [ ] From **Settings** the dialog offers a **plan picker** (there is no plan in context); from
      a benefit card or a contact it shows the plan as a **locked chip**. Neither asks for a
      plan the caller already knows. **[impl]**
- [ ] The dialog's category list shows the four canonical categories **plus** any category
      pre-filled from the contact it was opened from, so a contact filed under a non-canonical
      category (e.g. Third Party Contact) still arrives ticked. **[impl]**
- [ ] Opening it from Key Contacts pre-fills the person's name, email and their categories.
      **[spec]** "Invite to collaborate on any existing Contact."
- [ ] If no plan can be resolved — nothing picked, no plan in context, and the wizard draft
      cannot be saved — the invite is **refused** rather than written against nothing. **[impl]**

**Not in this build:** `edit_client` exists in the source union and in the dialog's prop types,
and the module docs describe an **Edit Client → Key Contacts** invite, but nothing under
`components/pages/edit-client/` renders an invite action, and no component passes
`source="edit_client"`. Do not file "Edit Client invite is missing" as a bug — it is unwired.

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
- [ ] The Plan/Benefits block changes nothing until **Save access** is pressed (rows apply
      immediately, this does not), and a save that drops a plan removes that assignment.
      **[impl]**
- [ ] **Delete Profile removes the person outright, plans and all.** The confirm names how many
      plans' access goes with them and the toast repeats the count. The old rule — refuse while
      any assignment remains — is no longer what the button does: the UI sends
      `remove_from_organization`, which drops the assignments first, then deletes the profile
      through the same guarded writer. (The server's strict `delete` still refuses with
      `profile_has_assignments`, which is why the count is in the confirmation.) **[spec]** /
      **[impl]**
- [ ] Deactivate, by contrast, keeps the profile and its history, and its dialog points at
      Delete as the difference. **[spec]**
- [ ] The helper copy under **Person-level actions** must not still claim Delete is "only
      possible with no plans left" — that sentence describes the retired behaviour. If it is
      still there, report it as a copy bug; the dialog itself is correct. **[impl]**
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
- [ ] A person who reaches the hub through a **mirrored Key Contact** holds **no login and no
      seat**: adding or removing their plan's contacts must never move the seat counter.
      **[impl]**
- [ ] A plan-sponsor contact whose company **is the plan's own client** does not create a
      Partner company row, and their card falls back to the plan's own branding. **[impl]**
- [ ] Edit a contact through one of the surfaces that writes `keyContacts` (Create Plan,
      `/api/clients` create/update — which the benefits wizard PUTs through — and the
      new-client wizard's complete / save-draft) and confirm the hub reflects it. The mirror is
      called **explicitly** by each writer, not by a database trigger, so a writer that forgets
      it drifts until `npm run teammates:backfill-contacts` runs. **[impl]**
- [ ] Deleting a mirrored **Contact** profile alone does not stick: saving that plan's contacts
      again recreates it, because the mirror reconciles the stored `keyContacts` onto profiles.
      Removing the contact from the plan's own contact list is what makes it stay gone.
      **[impl]**

---

## T9 — Invite acceptance (creating the collaborator login)

The step that used to be missing. An invitation is only a promise until someone redeems it:
access is resolved by looking up the login on a profile (`TeammateProfile.loginUserId`), so
until the accept link is used, an invited person still cannot sign in.

- [ ] Invite a mailbox you control from any of the invite surfaces — the simplest is
      **Settings → People & Access → Collaborators → Invite Collaborator**. The email's
      **primary button says "Accept the invitation"**; the "open the section" link is now a
      secondary line rather than the button. **[impl]**
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
      or a mirrored hub contact never moves the seat counter, and **Remove from seat** gives
      back exactly one. **[spec]**
- [ ] **Completeness copy matches reality**: the "N fields missing" count on an invite chip
      matches the missing fields the invite email lists. **[impl]**
- [ ] **Dark mode** pass over Settings → People & Access, the Plan Access screen, the Custom
      grid and the invite dialog.
- [ ] **Narrow viewport** pass over the same four surfaces — long plan and company names
      truncate rather than overflow.
- [ ] **Deployment targets the new database.** `.env` is gitignored and **Vercel does not read
      it** — the dev and production projects each need `DATABASE_URL` (the pooled Neon endpoint,
      including `pgbouncer=true`) **and** `DIRECT_URL` (unpooled, used only by `prisma migrate`)
      set in their dashboards. The Prisma datasource is now `postgresql` only, so a project
      missing them cannot connect at all: it fails loudly rather than quietly writing to the
      old Mongo database. Check it first when someone reports "my data disappeared".
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
- **"Save as role template"** (T2a) is marked Optional (Low) in the spec and is not built.
- **The accepted collaborator owns an empty Organization.** Every `User` gets one — it is
  the T1 invariant and exactly what `signIn` does for any new account — so a collaborator
  invited into *someone else's* organization also has a personal, planless one. It grants
  nothing (plan access is resolved from their profile's assignments, never from that
  organization) and it is not a leak. Do not report it.
- **The MongoDB → PostgreSQL migration is not finished, so some surfaces are expected to be
  broken.** `npm run check:no-mongo` currently reports **80 findings in 28 files**. While it
  does, treat these as known and stop: **Edit Benefit** (the edit-client page's 24-hex guards),
  **renaming a plan's portal URL** (`clients/[id]/slugs`), **opening or generating a plan
  video** (the whole `videos/*` group, including generate-from-previews, get-by-placement, the
  HeyGen webhook and `create-video` / `create-video-template`), **webinars by id**,
  **plan creation that attaches a video**, the legacy `/api/plans/*` routes, **marketing flyer
  rendering**, **viewing a document** (`documents/[id]/view`), the client-side "is this a
  persisted document id" checks in the benefits and documents wizards, the hub's
  **benefit-document section**, **contact-form topics** (`lib/plan-contact-form-topics.ts`) and
  the hub's **document mapper** (`lib/map-plan-documents-for-benefit-hub.ts`).
  The cause is uniform — a 24-hex "looks like a Mongo id?" test that no longer matches cuid
  ids — so the symptom is a **missing record or a silently dropped file** rather than an error.
  `npm run check:no-mongo` is the authoritative list, and the remaining work is tracked in
  [plans/postgres-migration.md](./postgres-migration.md). Anything **not** on that list is fair
  game to report.
- **Edit Client → Key Contacts has no invite action yet.** The `edit_client` invite source and
  its dialog prop exist, and the module docs describe the surface, but nothing renders it. The
  five working surfaces are listed under
  [Invite entry points](#invite-entry-points--where-the-button-is).
- **The Add modal's "New Contact" slide cannot carry the card-only fields**, so a contact added
  from Settings → People & Access renders a plainer hub card than one authored in the Create
  Plan wizard. Deliberately not collected yet, because no column exists for them:
  `contactType`, `displayName` / `supportIcon` / `departmentLabel`, the email and phone
  visibility toggles, the CTA group (`enableContactButton`, `ctaType`, `schedulingUrl`,
  `websiteUrl`), `contactFormTopics`, the contact's own `companyLogo`, the card colours and
  `isPrimary`. This closes when a profile-to-plan writer and a card payload (or typed columns)
  land.
- **There is no self-service profile.** An invited person fills in a name and a password and
  nothing else; every teammate profile writer is gated on Org Settings, and there is no
  `/api/teammates/me`. So the advisor's form is the only source of a job title or a phone
  number, and only an Owner/Admin can correct one. Tracked in
  [plans/teammates-self-service-profile.md](./plans/teammates-self-service-profile.md).
- **There is no dedicated "resend invitation".** Resending means re-inviting the same person
  from the same surface, which merges onto their existing profile instead of creating a second
  one — the intended behaviour, not a duplicate.
- **The accept-invite route's per-IP throttle is in-process and non-durable** (it resets on
  redeploy and does not span instances). It is a speed bump, not a rate limiter; do not report
  it as one.

---

## Reporting a bug

Include, so it can be reproduced without a second round trip:

1. The ticket above (e.g. T6) and the exact steps.
2. Which account/role you were signed in as, and whether you were on the owner's own row.
3. The plan and category involved.
4. What you expected versus what happened.
5. If the bug is about an invite, **which surface you raised it from** (benefits card, Create/
   Edit Benefit Contacts, Create Plan Key Contacts, or Settings → Collaborators) — the audit
   row records it, so it can be found afterwards.
6. Whether the ten `verify-*` suites still pass, and whether `npm run check:no-mongo` is clean.
   If either fails, paste the failing line — both usually name the cause directly.
