# T9 — Invite acceptance (linking a collaborator to a login)

**Not a spec ticket.** The spec's own tickets T1–T8 are done (T8 deferred by decision).
This is the **missing second half of the invitation** that T4 and T5 assume: the inviter's
side is built, the invitee's side is not.

Status: **planning**. Blocks: nothing. Blocked by: nothing.

---

## 1. Why this ticket exists

Access is resolved by **login**, not by profile. `resolvePlanAccess()` takes a session
`userId`, finds the `TeammateProfile` whose **`loginUserId`** equals it, and reads that
profile's assignments. So a collaborator can only use the access the advisor granted once
an account exists **and** the profile points at it.

Today nothing creates that link in the app:

| Evidence | Finding |
|---|---|
| `profiles.server.ts` | `activateProfile()` ("Acceptance of an invite. Links the global login when supplied") and `linkLoginUserId()` both exist |
| grep across `app/api` | **no route calls either** — they are referenced only inside `profiles.server.ts` |
| grep for `accept-invite` / `join-organization` | **no such page exists** |
| `lib/auth-options.ts` | contains no reference to `teammateProfile` or `loginUserId`, so **signing up with the invited email does not link** |
| `verify-t2`, `verify-t2a`, `verify-t6`, `verify-t7` | every suite creates the `loginUserId` link **by hand**, which is why they can test enforcement at all |

**The invite email deep-links to an authenticated route** (`/edit-benefit/{planId}/{slug}`
or `/benefits`). A collaborator clicking it with no account hits the sign-in wall; if they
sign up, they still see nothing.

Consequence: the profile state model's last step, `invited → active on acceptance`
(T1 profile states, T5 Part B item 1), is unreachable. Several acceptance criteria are
therefore demonstrable only by the automated suites, not by hand.

---

## 2. What already exists and should be reused

Do **not** invent a parallel identity system. This is mostly wiring.

- [`activateProfile()`](lib/teammates/profiles.server.ts:345) — moves the state to
  `active` **and** calls `linkLoginUserId`. Already correct.
- [`linkLoginUserId()`](lib/teammates/profiles.server.ts:372) — writes the link and audits
  `profile_login_linked`.
- [`setProfileState()`](lib/teammates/profiles.server.ts:284) — the only state writer.
- `INVITE_SEAT_HOLD_DAYS` + [`expireStaleInvites()`](lib/teammates/seats.server.ts:132) —
  an unaccepted invite returns to `contact` after 14 days. **The invite's validity window
  already exists**; the token does not need its own expiry concept.
- The existing **signup + email-code** pattern (`app/(dashboard)/signup/page.tsx`,
  `components/forms/user-signup-form.tsx`, `app/api/signup/route.ts`, the `verify-code`
  pages, `sendEmailVerificationCode`) — the app already proves "email X controls mailbox
  X". The accept flow can lean on the same idea rather than adding a new trust mechanism.
- [`appBaseUrl()`](lib/teammates/invites.server.ts:89) and `sendCollaboratorInviteEmail()` —
  where the email's links are composed.

---

## 3. Landmines found during reconnaissance

These are the reasons this is a ticket and not a one-file patch.

### 3.1 The onboarding gate would bounce a collaborator

`middleware.ts` protects an allow-list (`/dashboard`, `/benefits`, `/edit-benefit`, …) and,
for any signed-in user whose JWT lacks `onboardingComplete`, redirects to `/onboarding` —
the **advisor's** onboarding wizard. A collaborator has no business there and cannot
complete it.

Anything not in `APP_ROUTES` falls through to the `(portal)` group, so a **new
`/accept-invite/[token]` route is public by default** — convenient, but the *post-accept*
destination still has to survive the onboarding check.

### 3.2 Every new sign-in creates an Organization

`lib/auth-options.ts` → `signIn` calls `getOrCreateOrganizationForUser()` whenever it
creates a User. So a collaborator who signs up silently becomes the owner of their own
empty Organization. That is not obviously wrong — it is in fact close to T8 Part B item 3
("converting a collaborator into a paying customer creates a new User Organization") — but
it must be a **decision**, and it means a collaborator's session has two organization
contexts: their own, and the orgs they are assigned in.

### 3.3 No token exists

The invite email carries no token, so there is nothing today that proves "you are the
person this invite was for". Options in §5.

### 3.4 A collaborator's own dashboard is empty

Because access comes from assignments, a collaborator signing in sees their **own** empty
workspace, not the inviting advisor's. Their granted plans appear in the plan list (T2's
`listAccessiblePlanIds`), which may be most of what they need — but the landing experience
is a product decision, not a technical one.

---

## 4. Scope

**In scope**

1. A public `/accept-invite/[token]` page that identifies the invitation (org, inviter,
   plan and section, what is being asked) **before** asking anything of the invitee.
2. Reusing the invitation's 14-day window as the token's validity window.
3. Two paths on that page: **create an account** (email pre-filled and locked to the
   invited address) or **sign in** (when an account already exists for that email).
4. Linking: `activateProfile({ ..., loginUserId })` on success, so the profile moves
   `invited → active` and the login is linked — no new profile is ever created.
5. Pointing the invite email at the accept page instead of a dashboard route.
6. A sensible landing after acceptance (their assigned plan, or `/benefits`).
7. Failing loudly and usefully for: an expired invite, a revoked/removed profile, a token
   for a different email, an already-accepted invite, and a deactivated profile.

**Out of scope**

- **T8** (caps, gating, upgrade screens) — still deferred.
- Turning a collaborator into a paying customer (T8 Part B item 3).
- A collaborator-facing "my access" page beyond the plan list they already get.
- Per-invite revocation UI beyond what deactivate/remove already does.

---

## 5. The one design decision: how the token works

### Option A — signed token (recommended)

Encode `{ profileId, organizationId, email, exp }` in an HMAC signed with
`NEXTAUTH_SECRET`. No schema change, no migration, nothing to clean up.

- Validity is symmetric with the invite: `exp` mirrors `invitedAt + 14 days`, so the token
  and the seat hold expire together — one concept, not two.
- Revocation is handled by the **state check**, which we need anyway: the route loads the
  profile and refuses unless `state === "invited"` and `deactivatedAt` is null. Deactivate,
  remove the assignment, or let the invite expire, and the token stops working with no
  extra bookkeeping.
- Weakness: the token cannot be invalidated *individually* while the invite is otherwise
  healthy. Re-inviting (`inviteCollaboratorToPlan`) would need to rotate the link — which it
  effectively does, because a fresh `invitedAt` produces a different signed token.

### Option B — stored random token

Add `inviteTokenHash String?` + `inviteTokenExpiresAt DateTime?` to `TeammateProfile`.
Per-invite revocation becomes explicit, at the cost of a schema addition, a write on every
invite, and a nullable-unique/`{field: null}` trap this codebase has already been bitten by
(see the module docs' notes on Mongo null semantics).

**Recommendation: Option A.** It adds no schema, it cannot drift from the invite's real
state, and the state check is a guard we must write regardless.

---

## 6. Flow

```
invite email  ──►  /accept-invite/[token]            (public; not in APP_ROUTES)
                     │
                     ├─ verify token signature + exp
                     ├─ load profile; require state=invited, deactivatedAt=null
                     ├─ require token.email === profile.email
                     ├─ show: inviter, org, plan, section, what's asked
                     │
                     ├─ account exists for this email?  ──► "Sign in to accept"
                     │                                      (then link)
                     └─ no account                      ──► sign-up form,
                                                            email pre-filled + locked
                     │
                     └─ POST /api/teammates/accept-invite
                          activateProfile({ id, organizationId, actorUserId, loginUserId })
                          ──► active  +  loginUserId linked  +  audited
                                    │
                                    └─► redirect to their plan (or /benefits)
```

**Two API routes**, both public (they authenticate by token + email match, not session):

- `GET /api/teammates/accept-invite?token=…` → the invitation summary the page renders.
  Returns org name, inviter name, plan name, section name, and whether an account already
  exists for that email. It must **not** leak the token's contents beyond what the invitee
  needs.
- `POST /api/teammates/accept-invite` → `{ token, password? }`. Creates the account when
  needed (reusing the existing signup path), signs the invitee in, calls
  `activateProfile`, and returns the landing URL.

**Email change** in `invites.server.ts`: build an `acceptUrl` alongside the existing
`sectionUrl` and lead with it. Keep the section link as a second link, because an
*already-active* collaborator receiving a second invite should go straight to the work.

**Landing**: after acceptance, send them to the plan/section the invite was about. If it is
gone by then, fall back to `/benefits`.

---

## 7. State and seat transitions (must be asserted)

Seats are counted only for `type: "team_member"` profiles.

| From | Event | To | Seats |
|---|---|---|---|
| `contact` | invite sent (T4/T5) | `invited` | Team Member: `seatsPending +1`, `seatsUsed +1`. Collaborator: **no change** |
| `invited` | **acceptance (this ticket)** | `active` | `seatsPending −1`, `seatsActive +1`, **`seatsUsed` unchanged** |
| `invited` | 14 days elapse | `contact` | `seatsPending −1`, `seatsUsed −1`; token must stop working |
| `invited` | profile deactivated | unchanged state | seat released (deactivated profiles are skipped) |
| any | profile deleted | row removed | link is gone with it |

Two invariants to assert explicitly:

1. **Acceptance never changes `seatsUsed`** — it converts a held seat into an occupied one.
2. **Acceptance never creates a profile** — it links the existing one. A second invite to
   the same person on another plan must still reuse the same profile after acceptance.

---

## 8. Security rules

- Refuse unless **token signature valid**, **not expired**, **`state === "invited"`**,
  **`deactivatedAt` null**, and **`token.email === profile.email`**.
- The email is **pre-filled and locked** on the accept form. Letting it be edited would
  let one invite be redeemed by a different account.
- A token is **effectively single-use**: the first acceptance moves the state to `active`,
  so a replay fails the state check.
- Do not reveal whether an email exists in the system beyond the invitation the invitee
  already holds.
- Rate-limit the `POST` (the codebase has no shared limiter — reuse or add a minimal
  per-IP guard, and note the choice).
- The audit trail already records `profile_login_linked` and the state change; confirm both
  land.

---

## 9. The onboarding-gate problem, and the fix

`middleware.ts` sends any signed-in user without `onboardingComplete` to `/onboarding`.
A collaborator must not be sent through the advisor wizard. Two candidate fixes:

1. **Set the flag in the JWT callback** when the user has an `active` TeammateProfile —
   i.e. "a collaborator is not an onboardable advisor". One place, and it also fixes the
   next sign-in rather than only the first.
2. Exempt `/accept-invite` in middleware and set the flag on first accept only.

**Recommendation: (1)**, plus exempting `/accept-invite` from the gate (it is public
anyway, but being explicit documents the intent). Whichever is chosen, the JWT callback
change must not accidentally mark a *brand-new advisor* as complete — the condition has to
be "has an active teammate profile", not "signed up via an invite".

---

## 10. Verification

- **`verify-t9.ts`** (new, joins the battery): token signing/verification round trip;
  expiry refused; wrong email refused; deactivated profile refused; non-invited state
  refused; acceptance links the login, sets `active`, leaves `seatsUsed` unchanged, creates
  no second profile; replay refused; a Collaborator acceptance changes no seat at all;
  a Team Member acceptance converts pending → active; audit rows exist for both the state
  change and the link.
- **Manual**: update `plans/teammates-module-qa-checklist.md` — the "Collaborator login"
  account becomes obtainable, so the T2 / T2a / T7 items currently marked suite-only become
  hand-testable. That checklist change is part of this ticket's definition of done.
- **Regression**: the nine existing suites must stay green; T4/T5 assert the invite side and
  must not change behaviour except for the added email link.

---

## 11. Open decisions for you

1. **Token mechanism** — signed (recommended, no schema change) vs stored random token?
2. **Does a collaborator get their own Organization?** Today `signIn` creates one for every
   new user. Keep it (aligns with T8's future conversion) or suppress it for invited
   collaborators?
3. **Where does an accepted collaborator land** — the plan/section the invite was about, or
   `/benefits`?
4. **Password on accept, or magic-link only?** The codebase has both patterns (credentials
   + email codes). Reusing credentials signup is less new code; a code-first flow is
   friendlier for an external person who will rarely return.

---

## 12. Suggested implementation order

1. Token helper (sign/verify) with the invite's 14-day window, plus unit-level assertions
   in the new suite.
2. `GET`/`POST` `/api/teammates/accept-invite`, delegating to `activateProfile` +
   `linkLoginUserId`.
3. The public `/accept-invite/[token]` page: invitation summary, then create-or-sign-in.
4. Email change: lead with `acceptUrl`, keep the section link for already-active people.
5. Onboarding-gate fix in the JWT callback (+ explicit `/accept-invite` exemption).
6. Landing redirect.
7. Failure states and copy (expired, revoked, already accepted, deactivated, wrong email).
8. `verify-t9` + full battery.
9. Docs: a new section in `docs/teammates-module.md` and the checklist update.
