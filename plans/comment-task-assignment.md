# Assigning dashboard Tasks from Comments

Status: **implemented.** All six phases landed, and the suite covers them in
`npm run comments:verify` §17–§20 (92 assertions). Two things were settled during the build and are
recorded where they were decided: the derived task's destination link lives on the DASHBOARD row rather
than on the comment card (§4), and there is no "open the thread" action on that row because the URL is
built by the comments module, which already imports the dashboard module (§5). One refinement to §1's
lifecycle: deleting a plan takes only the tasks ASSIGNED against it, leaving a self-authored task that
merely links to the plan alone — that one is the advisor's own note.

Goal: an Owner or Admin can assign a task to a person from inside a comment thread. The
assignment becomes real work on the assignee's dashboard, a specialised entry in the thread,
and a notification in their Bell. Everything is traceable back to the conversation that
created it.

## 1. What is being assigned (decided)

The dashboard has two task sources, and they are structurally different:

- **Automated** (`SystemTask`) — **derived on every read, never stored**.
  `listSystemTasks(accessiblePlanIds)` recomputes them from plan state for whoever can reach
  the plan. Kinds: `incomplete-benefit`, `uncategorized-documents`, `missing-disclaimers`,
  `ready-to-publish`. Their identity is a synthetic id, `system-{kind}-{planId}-{category}`
  (and `system-ready-to-publish-{planId}`), which means **a derived task IS its
  `(kind, planId, category)` triple**.
- **Manual** (`Task`) — stored, `userId` + `title` + `done` + optional `clientId`, read by
  `listManualTasks(userId, …)`. A task belongs to one advisor's own dashboard.

So an assignment is always a **stored `Task` row owned by the assignee** — that is the only
mechanism that puts work on someone else's dashboard. The assigner may either:

- pick one of the plan's **automated** tasks (the picker lists the derived tasks for the
  thread's plan), or
- **type a title**.

Either way it materialises as a stored row. A row that came from an automated task carries the
kind, icon and destination link, so it renders exactly like the derived row it stands in for.

### The de-duplication invariant

> **One row per unit of work.** While a live assignment covers `(clientId, derivedKind,
> benefitCategory)`, the derived row for that triple is **suppressed** for the reader it is
> assigned to, and the assigned row carries that row's icon and its "fix it here" link.

Without this, a plan-wide reader (the Owner, a Team Member, a plan-wide Collaborator) sees the
derived row *and* the assigned copy. With it, the assigned row is a **superset**: same icon, same
destination link, plus a checkbox, an "Assigned by Dana" byline and a link to the thread.

Suppression is **per reader and only for the assignee** — every other reader keeps their derived
row, because for them the task is not theirs to complete.

## 2. Permission matrix

| Action | Who |
| --- | --- |
| See the Assign control | `canModerate` — Owner, Admin. The same gate resolve/reopen uses (`assertCanModerate`), reused rather than re-derived, so the comments panel cannot develop a second idea of who moderates. |
| Assign on a **Plan/Client** thread | Assignee must be the Owner, an Admin or a Team Member. **A Collaborator can never be assigned on a plan thread.** |
| Assign on a **Benefit category** thread | The same, plus Collaborators **who hold that category** — the rule `listMentionableUsers` already enforces for `@mentions`, so a Collaborator can only be handed work in a category they can open. |
| Complete the task | The assignee only (it is their dashboard row). |
| Withdraw the assignment | The assigner, or any Owner/Admin. |

The assignee picker is therefore: **the mentionable list for this surface** (which is already
category-scoped and already proves "can this person open this plan"), filtered by seat kind —
`collaborator` excluded on a plan thread. Seat kind comes from
[`loadPersonIdentities`](../lib/teammates/identity.server.ts), the resolver added for the avatar
fix, so the picker and the thread's bylines agree about who everyone is.

## 3. Data model

### `Task` gains provenance

```
assignedByUserId String?   // null for the advisor's own tasks; set when it came from a comment
sourceThreadId   String?   // the conversation it was assigned in (plain scalar)
sourceMessageId  String?   // the message that announced it
derivedKind      String?   // "incomplete-benefit" | "uncategorized-documents" | …
                           //   | "missing-disclaimers" | "ready-to-publish"
benefitCategory  String?   // normalized key, for a benefit-scoped derived task
dueAt            DateTime? // reserved; no UI in phase 1
```

Indexes: `@@index([assignedByUserId])`, `@@index([sourceThreadId])`, and
`@@index([userId, clientId, derivedKind])` for the de-duplication read.

Plain scalars for the thread/message ids, matching `CommentMessage.authorUserId` and the
existing cross-feature id style: **an assignment must not disappear because a thread was
deleted**, and a comment thread outlives a deleted login by design.

### `CommentMessage` gains a kind

```
kind   String  @default("comment")   // "comment" | "task_assignment"
taskId String?                        // the Task this message announces
```

`body` still carries a **plain-text fallback** — *"Assigned a task to Carl: Complete the
Retirement benefit"* — so the notification, the deep link, any non-rich consumer and the
verification suite read sensibly without special-casing the kind.

## 4. The specialised message

Rendered as a **card**, not a sentence, wherever a message row is drawn (the thread card face, the
open thread, and the reply list):

- the task title, and the plan (or benefit category) it is scoped to;
- **assigned by X to Y**, using the identity resolver;
- the derived KIND as a labelled chip — "Incomplete benefit · Group Health" — when it came from an
  automated task. The destination LINK stays on the dashboard row (§5), where the derived row already
  carries it: the thread's job is to say who was asked for what, and the assignee acts from their own
  dashboard rather than from inside a conversation. (This reverses what §4 first said; settled when
  phase 4 was built.)
- the task's **state**, read live: ticking it off on the dashboard turns the card into
  "Completed" with who and when. The state is joined at read time from `Task.done`/`doneAt` —
  one batched `task.findMany` per thread list, never a per-message query;
- a **withdraw** control for the assigner/moderators, which clears the task and leaves the card
  reading "Withdrawn" rather than vanishing (the same reasoning as a withdrawn message keeping
  its place).

## 5. The dashboard contract

`ManualTask` gains: `assignedByName: string | null`, `assignedByUserId: string | null`,
`derivedKind: string | null`, `href: string | null`, `sourceThreadId: string | null`.

`ManualTaskRow` renders an assigned row with the derived row's icon, the derived task's destination
("Fix it here", read from the same `issueDestination` the derived row links through) and an
"Assigned by Dana" byline. Rename and delete are **not offered on an assigned row** — the assignee
may complete the work, but the record of who asked for it is the assignment's, not theirs to edit or
erase. Completion stays where it is: the checkbox.

**Two deviations from what §5 first said, both settled in phase 5.** There is no "Open thread" action:
that URL is built by the comments module, and this reader already imports IT (`listSystemTasks`), so
reaching back the other way would make the two modules circular for a link a reader already has in
their Bell notification. And the byline says "Assigned by Dana" rather than distinguishing a comment
origin explicitly — the provenance IS an assignment, so saying so twice adds nothing.

`listSystemTasks` takes the reader's live assignments and suppresses the derived rows they cover
(§1). `listManualTasks` resolves `assignedByName` through the same batched identity resolver.

## 6. Notification

One `Notification` row for the assignee, through the existing `createNotification`:

- `type: "comment_task_assigned"` (added to `COMMENT_NOTIFICATION_TYPES`);
- title/body naming the assigner, the task and the plan;
- `href` = the existing comment deep link the rail already opens (`?comment={threadId}`), so
  clicking it lands on the thread.

## 7. Lifecycle

| Event | Assignment message | Stored `Task` |
| --- | --- | --- |
| Plan deleted | cascades with its threads | **deleted** (meaningless without the plan) — added to the plan-delete path |
| Thread deleted | cascades | **kept**: the work exists independently of the conversation; the dashboard row loses its thread link and keeps everything else |
| Login deleted | kept (author ids are scalars) | **deleted** with the user, via `deletePlansAndScopedDataForUser` — `Task.userId` is a real relation |
| Teammate profile removed | kept | **deleted** in the same path |
| Task completed | card reads "Completed" | row stays, ticked |
| Assignment withdrawn | card reads "Withdrawn" | row deleted; the derived row reappears |

## 8. API surface

Routes stay thin and go through `mapCommentError`, as the comments routes already do.

| Route | Verb | Purpose |
| --- | --- | --- |
| `/api/comments/threads/[threadId]/assignable` | GET | `{ users, derivedTasks }` for this thread's surface. `users` = the filtered mentionable list; `derivedTasks` = the plan's derived tasks, category-filtered on a benefit thread. |
| `/api/comments/threads/[threadId]/assignments` | POST | `{ assigneeUserId, title? , derivedTaskId? }` → creates the `Task` + the message + the notification, returns the updated thread. |
| `/api/comments/assignments/[messageId]` | DELETE | Withdraw: deletes the `Task`, marks the card withdrawn. |

**The derived task is accepted as the picker's own opaque id and re-derived server-side** —
`listSystemTasks([thread.clientId])`, matched by id — never as client-supplied
`kind`/`planId`/`category`. That is the same rule the DM directory follows ("the picker lists
exactly what the module returns, and the API accepts exactly that"), and it means a forged
kind cannot be smuggled into a task row.

## 9. Phases

1. **Schema + migration.** `Task` provenance, `CommentMessage.kind`/`taskId`, indexes.
   `prisma migrate deploy`, `prisma generate`. Acceptance: the suite still passes untouched.
2. **Server: reads.** `assertCanAssign`, `listAssignableUsers` (mentionable ∩ seat-kind rule),
   `listAssignableDerivedTasks`, and the thread read carrying each message's task state.
   Acceptance: the suite gains refusals — a Collaborator not assignable on a plan thread, a
   Collaborator assignable only on a held category, a non-moderator refused.
3. **Server: writes.** `assignTask` (task + message + notification in one transaction),
   `withdrawAssignment`. Acceptance: an assignment creates exactly one task, one message and one
   notification; a forged `derivedTaskId` is refused.
4. **Comments UI.** Assign control behind `canModerate`, the picker dialog (person + derived
   task or typed title), the card, optimistic insert, withdrawal. Acceptance: the panel shows the
   card on send without a refetch, and the mention picker's rule matches the server's.
5. **Dashboard.** `ManualTask` fields, de-duplication against derived rows, the assigned row's
   byline/icon/link, rename and delete withheld. Acceptance: an assignee with plan access sees
   ONE row for the work, carrying the derived icon and link.
6. **Lifecycle + docs.** Plan deletion and user/profile removal clean up assigned tasks;
   `docs/teammates-module.md` gains the section (permission matrix, the de-duplication invariant,
   the card, the lifecycle table); this plan is reconciled.

## 10. Verification

Extend `npm run comments:verify` with an **assignment** section, plus the dashboard de-dup in the
same suite (it can call `listSystemTasks`/`listManualTasks` directly):

- the moddy gate: a Team Member cannot assign, an Owner can;
- a Collaborator is **refused** as an assignee on a plan thread (stable code);
- a Collaborator is **accepted** on a benefit thread for a category they hold, and refused for one
  they do not;
- an assignment creates one `Task` owned by the assignee with `assignedByUserId` and the plan link;
- the thread returns a `task_assignment` message with the title and the task id, and its plain-text
  body reads sensibly;
- the assignee gets exactly ONE notification of the right type whose href deep-links the thread;
- ticking the task off makes the thread card read "Completed";
- the assignee's task list shows ONE row for a derived task they can already see, carrying that
  row's `kind` and `href`;
- withdrawal deletes the task, marks the card withdrawn, and the derived row returns;
- a non-member cannot read the assignable list, and an outsider cannot assign into the thread.

## 11. Open questions

- **Due dates.** `dueAt` is reserved in the schema but has no UI; adding a date picker to the
  assign dialog is a natural follow-up once the core flow is in use.
- **Re-assignment.** Phase 1 assigns once; re-pointing an existing assignment to somebody else
  should probably withdraw and re-assign (two cards, honest history) rather than mutate the row.
- **Derived tasks with no category.** `uncategorized-documents` and `missing-disclaimers` are
  plan-wide, so on a benefit thread they are not offered — only `incomplete-benefit` for that
  category is, since that is the work a category-scoped person can actually do.
- **`ready-to-publish` is NOT assignable.** Settled in phase 2 and enforced in
  `listAssignableDerivedTasks`: publishing is a capability (Owner/Admin, with its own attestation
  dialog), so a task row for it would be a promise the assignee cannot keep. Every other derived
  task is work somebody can do with the access they already have — which is the real test for
  whether a task may be delegated at all.
