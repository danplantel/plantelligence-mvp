# Teammates — self-service profile (follow-up ticket)

**Status:** not started. Recorded here so it is a ticket rather than a good intention.

**Origin:** raised while building the People & Access "New Contact" slide. The question was
"doesn't this workflow send an invite for the Contact to fill out information themselves?" —
and the honest answer was that the invite exists but collects almost nothing, so the advisor
has to type everything.

## The problem

An invited person **cannot enter or correct their own details**. Two facts combine:

1. **The invite collects a name and a password, and nothing else.** The acceptance form
   posts `{ token, name, password }` to `/api/teammates/accept-invite`. There is no job
   title, phone, headshot or company field, and the T9 acceptance service creates the login
   from that payload alone.

2. **No teammate-facing profile writer exists.** The teammate API surface is
   `accept-invite`, `plan-access`, `plan-assignments`, `seats`, `team`, `team/[profileId]`,
   `assignments/[assignmentId]`, `invite-collaborator`, `collaborators/search` and
   `contacts/search`. Every one that writes a profile is gated on `org_settings`, i.e. it is
   an Owner or Admin editing *somebody else*. There is no `/api/teammates/me`.

The consequences are easy to miss and worth stating:

- Whatever the advisor types is the only version of that person's details that will ever
  exist. If their title changes, or the phone number was wrong, only an admin can fix it.
- The advisor is the bottleneck for data that the person themselves already knows.
- Nothing here is a *bug* in the invite: the invite's "still needed" list describes a
  **benefit section's** missing fields (`missingFieldsForCategory`), never the person's own
  card. The two were easy to conflate when this was raised.

## What this ticket should add

1. **A self-service route**, e.g. `PATCH /api/teammates/me`, resolving the caller's own
   profile through `loginUserId` rather than by id — so a caller can only ever edit the
   profile their own login is linked to, in the organization the session names.
2. **A "your details" surface** for a signed-in teammate, reachable from the post-acceptance
   landing and from Settings.
3. **An optional prompt at acceptance.** The acceptance form is the moment the person is
   already typing; asking for a job title and phone there turns a follow-up task into a
   two-field addition.

## Decisions this ticket has to make

- **Which fields a teammate may edit.** Job title, phone, extension, headshot and company
  are clearly theirs. Role, plan scope, category scope and seat type are clearly not — those
  are an organisation's grants and must stay owner/admin-only. Where the line sits for
  `benefitsSpecialty` needs a decision, since it is currently derived from the advisor's
  access choices.
- **What happens to a value the advisor already entered.** A teammate overwriting an
  advisor's entry is fine for their own phone number, but the audit trail should record who
  changed what (`profile_updated` already exists and carries a `fields` list).
- **Whether acceptance should require anything.** If a required field is added to the
  acceptance form, an invite can no longer be accepted in one step; that is a real product
  trade-off, not a detail.
- **Whether the invite email should say so.** Today it says only "choose a password".

## Explicit non-goals

- Not the Key Contact card payload. The card-only fields (`contactType`, the CTA group,
  `contactFormTopics`, `displayEmail`/`displayPhone`, `companyLogo`, `isPrimary`) have no
  column on `TeammateProfile`, so they are out of scope for both this ticket and the
  "New Contact" slide. That is a separate schema decision — see the note in
  `docs/teammates-module.md` §9.
- Not a change to who may invite, deactivate or scope access.

## Why it is worth doing

It removes the advisor from a loop they should not be in, and it gives a teammate a way to
correct their own record — which today is impossible without an admin. It also makes the
advisor's form a *seed* rather than the final word, which is the only way the New Contact
slide can stay as small as the schema allows without becoming the place data goes to die.

## Dependencies

- Needs `NEXTAUTH_SECRET`-signed sessions only, so no new infrastructure.
- Interacts with, but does not block, the deferred `contactCard` payload work: both change
  what a profile can hold, and if the payload lands first the teammate surface should be
  able to edit the same fields the advisor can.
