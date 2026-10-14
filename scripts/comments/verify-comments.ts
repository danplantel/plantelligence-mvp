/**
 * Comments verification — Figma-style Plan/Benefit comment threads.
 *
 *   npx tsx scripts/comments/verify-comments.ts [--keep]
 *
 * Exercises the REAL data layer end-to-end:
 *
 *   1. section + text-range threads on a Draft plan (owner);
 *   2. anchor and body validation;
 *   3. implicit-by-View commenting, including a Collaborator;
 *   4. category scope enforcement (assigned vs not);
 *   5. an unassigned plan / unrelated user refused;
 *   6. replies and the notification fan-out (reply + new thread + mention);
 *   7. @mentions with a deep link;
 *   8. moderation — resolve/reopen is Owner/Admin only, NEVER the author;
 *   9. deleting a message and a thread (Owner/Admin only, with the author refused);
 *  10. benefit threads scoped and normalized by category;
 *  11. plan deletion cascading its threads and messages;
 *  12. "currently typing" — per thread, per person, named, self-expiring, cleared on reply;
 *  13. the persistent composer's SURFACE-scoped typing, and its one-row-per-person invariant;
 *  14. a LANDED comment retiring the mark it makes a lie, so the pill and the composer line can
 *      never contradict each other on screen;
 *  15. an author's IDENTITY from their seat — a teammate's picture and name, with the owner's login
 *      as the case that has no seat at all;
 *  16. assigning work — who may be handed it on each surface, and which derived tasks may be
 *      delegated;
 *  17. the assignment WRITE — one task, one kinded message and one notification, completion showing
 *      in the thread, withdrawal, and the refusals (a Collaborator on a plan thread, a directly
 *      posted id for a task that cannot be delegated);
 *  18. the DASHBOARD's side of it — one row per unit of work, with the derived row suppressed for the
 *      assignee alone and the assigned row carrying its identity.
 *
 * Fixtures are `tcm-verify-*` and are cleaned up unless `--keep` is passed.
 */
import { check, createPrisma, failureCount, summary } from "../teammates/shared";
import { getOrCreateOrganizationForUser } from "../../lib/organization";
import { listAccessiblePlanIds } from "../../lib/teammates/access.server";
import { deletePlansAndScopedDataForUser } from "../../lib/delete-user-plans-and-scoped-data";
import { createTeammateProfile } from "../../lib/teammates/profiles.server";
import { upsertAssignment } from "../../lib/teammates/assignments.server";
import { TeammateDataError } from "../../lib/teammates/errors";
import { getPersonCard } from "../../lib/teammates/person-card.server";
import {
  addCommentMessage,
  assignTask,
  createCommentThread,
  deleteCommentMessage,
  deleteCommentThread,
  listAssignable,
  listAssignableNeedsAttention,
  listAssignableUsers,
  listCommentThreads,
  listCommentTyping,
  listMentionableUsers,
  markCommentTyping,
  markSurfaceTyping,
  resolveCommentAttachmentAccess,
  setCommentThreadResolved,
  withdrawAssignment,
} from "../../lib/comments/comments.server";
import {
  listManualTasks,
  listSystemTasks,
  suppressedDerivedRows,
} from "../../lib/dashboard-tasks.server";
import {
  COMMENT_NOTIFICATION_TYPES,
  MAX_COMMENT_LENGTH,
  liveTypingPeople,
  newestMessageAt,
  normalizeBenefitCategoryKey,
  typingMarkStands,
} from "../../lib/comments/types";

const KEEP_FIXTURES = process.argv.includes("--keep");
const STAMP = Date.now();

/** Run an expected refusal and report its stable code. */
async function refusalCode(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return "(no error)";
  } catch (error) {
    if (error instanceof TeammateDataError) {
      return error.code ?? String(error.status);
    }
    return `unexpected: ${(error as Error).message}`;
  }
}

async function main(): Promise<void> {
  const prisma = createPrisma();

  const created = {
    userIds: [] as string[],
    profileIds: [] as string[],
    clientIds: [] as string[],
    organizationIds: [] as string[],
  };

  try {
    console.log("Comments verification — plan/benefit comment threads");
    console.log("");

    /* ── Fixtures ─────────────────────────────────────────────────── */

    const owner = await prisma.user.create({
      data: {
        name: `TCM Verify Advisor ${STAMP}`,
        email: `tcm-verify-owner-${STAMP}@example.test`,
        organizationName: `TCM Verify Org ${STAMP}`,
      },
      select: { id: true },
    });
    created.userIds.push(owner.id);
    const organizationId = await getOrCreateOrganizationForUser(owner.id);
    created.organizationIds.push(organizationId);

    const planA = await prisma.client.create({
      data: {
        userId: owner.id,
        organizationId,
        companyName: `TCM Plan A ${STAMP}`,
        slug: `tcm-verify-a-${STAMP}`,
        status: "Draft",
        keyContacts: [],
      },
      select: { id: true },
    });
    created.clientIds.push(planA.id);

    const planB = await prisma.client.create({
      data: {
        userId: owner.id,
        organizationId,
        companyName: `TCM Plan B ${STAMP}`,
        slug: `tcm-verify-b-${STAMP}`,
        status: "Active",
        keyContacts: [],
      },
      select: { id: true },
    });
    created.clientIds.push(planB.id);

    const collabLogin = await prisma.user.create({
      data: {
        name: `TCM Collaborator ${STAMP}`,
        email: `tcm-verify-collab-${STAMP}@example.test`,
      },
      select: { id: true },
    });
    created.userIds.push(collabLogin.id);
    const collab = await createTeammateProfile({
      organizationId,
      actorUserId: owner.id,
      type: "collaborator",
      email: `tcm-verify-collab-${STAMP}@abbenefits.test`,
      firstName: "Cora",
      lastName: "Collab",
      loginUserId: collabLogin.id,
    });
    created.profileIds.push(collab.id);
    await prisma.teammateProfile.update({
      where: { id: collab.id },
      data: { state: "active" },
    });
    await upsertAssignment({
      organizationId,
      profileId: collab.id,
      clientId: planA.id,
      actorUserId: owner.id,
      role: "viewer",
      categoryScope: "selected",
      categories: ["Group Health"],
    });

    const mentioneeLogin = await prisma.user.create({
      data: {
        name: `Zelda Mention ${STAMP}`,
        email: `tcm-verify-mentionee-${STAMP}@example.test`,
      },
      select: { id: true },
    });
    created.userIds.push(mentioneeLogin.id);
    const mentionee = await createTeammateProfile({
      organizationId,
      actorUserId: owner.id,
      type: "team_member",
      email: `tcm-verify-mentionee-${STAMP}@abbenefits.test`,
      firstName: "Zelda",
      lastName: "Mention",
      loginUserId: mentioneeLogin.id,
    });
    created.profileIds.push(mentionee.id);
    await prisma.teammateProfile.update({
      where: { id: mentionee.id },
      data: { state: "active" },
    });
    await upsertAssignment({
      organizationId,
      profileId: mentionee.id,
      clientId: planA.id,
      actorUserId: owner.id,
      role: "viewer",
      categoryScope: "all",
    });

    // A teammate holding the Admin preset — the "Admin" half of "Owner/Admin only",
    // which is why the rule cannot be satisfied by `Client.userId` alone.
    const adminLogin = await prisma.user.create({
      data: {
        name: `TCM Admin ${STAMP}`,
        email: `tcm-verify-admin-${STAMP}@example.test`,
      },
      select: { id: true },
    });
    created.userIds.push(adminLogin.id);
    const admin = await createTeammateProfile({
      organizationId,
      actorUserId: owner.id,
      type: "team_member",
      email: `tcm-verify-admin-${STAMP}@abbenefits.test`,
      firstName: "Ada",
      lastName: "Admin",
      loginUserId: adminLogin.id,
    });
    created.profileIds.push(admin.id);
    await prisma.teammateProfile.update({
      where: { id: admin.id },
      data: { state: "active" },
    });
    await upsertAssignment({
      organizationId,
      profileId: admin.id,
      clientId: planA.id,
      actorUserId: owner.id,
      role: "admin",
      categoryScope: "all",
    });

    const stranger = await prisma.user.create({
      data: {
        name: `TCM Stranger ${STAMP}`,
        email: `tcm-verify-stranger-${STAMP}@example.test`,
      },
      select: { id: true },
    });
    created.userIds.push(stranger.id);

    /* ── 1. Section thread on a Draft plan ────────────────────────── */

    console.log("1. Section comments on a Draft plan (owner)");
    const sectionThread = await createCommentThread({
      organizationId,
      userId: owner.id,
      clientIdOrSlug: planA.id,
      targetType: "plan",
      anchor: { anchorKind: "section", sectionKey: "company" },
      body: "Please review the company details.",
    });
    check(
      "a Draft plan accepts a section thread",
      sectionThread.anchorKind === "section" &&
        sectionThread.sectionKey === "company",
      `${sectionThread.anchorKind} / ${sectionThread.sectionKey}`,
    );
    let list = await listCommentThreads({
      organizationId,
      userId: owner.id,
      clientIdOrSlug: planA.id,
      targetType: "plan",
    });
    check("the thread lists back", list.threads.length === 1, `${list.threads.length}`);

    /* ── 2. Text-range anchor ─────────────────────────────────────── */

    console.log("");
    console.log("2. Text-range anchor with a quote");
    const textThread = await createCommentThread({
      organizationId,
      userId: owner.id,
      clientIdOrSlug: planA.id,
      targetType: "plan",
      anchor: {
        anchorKind: "text",
        sectionKey: "branding",
        fieldKey: "missionStatement",
        rangeStart: 4,
        rangeEnd: 12,
        quote: "Helping ",
      },
      body: "Tighten this wording.",
    });
    check(
      "a text thread stores its field, range and quote",
      textThread.anchorKind === "text" &&
        textThread.fieldKey === "missionStatement" &&
        textThread.rangeStart === 4 &&
        textThread.rangeEnd === 12 &&
        textThread.quote === "Helping ",
      `${textThread.fieldKey} / ${textThread.rangeStart}-${textThread.rangeEnd} / "${textThread.quote}"`,
    );

    /* ── 3. Validation ────────────────────────────────────────────── */

    console.log("");
    console.log("3. Validation");
    check(
      "an empty body is refused",
      (await refusalCode(() =>
        createCommentThread({
          organizationId,
          userId: owner.id,
          clientIdOrSlug: planA.id,
          targetType: "plan",
          anchor: { anchorKind: "section", sectionKey: "company" },
          body: "   ",
        }),
      )) === "comment_empty",
    );
    check(
      "a text anchor without a field is refused",
      (await refusalCode(() =>
        createCommentThread({
          organizationId,
          userId: owner.id,
          clientIdOrSlug: planA.id,
          targetType: "plan",
          anchor: { anchorKind: "text", sectionKey: "branding" },
          body: "hi",
        }),
      )) === "comment_bad_anchor",
    );

    // The body limit is a shared constant enforced server-side, and the boundary is EXACT:
    // at the limit is fine, one character over is not. Pinning both ends is what stops the
    // number drifting silently — the composer's `maxLength` is only a courtesy, and this is
    // the rule an API caller actually hits. Thrown on `planB` so the thread counts the other
    // sections assert for `planA` stay exactly as they are.
    const atLimitThread = await createCommentThread({
      organizationId,
      userId: owner.id,
      clientIdOrSlug: planB.id,
      targetType: "plan",
      anchor: { anchorKind: "section", sectionKey: "company" },
      body: "x".repeat(MAX_COMMENT_LENGTH),
    });
    check(
      `a body of exactly the limit is accepted (${MAX_COMMENT_LENGTH.toLocaleString()} chars)`,
      atLimitThread.messages[0]?.body.length === MAX_COMMENT_LENGTH,
      `${atLimitThread.messages[0]?.body.length ?? 0}`,
    );
    check(
      "one character over the limit is refused",
      (await refusalCode(() =>
        createCommentThread({
          organizationId,
          userId: owner.id,
          clientIdOrSlug: planB.id,
          targetType: "plan",
          anchor: { anchorKind: "section", sectionKey: "company" },
          body: "x".repeat(MAX_COMMENT_LENGTH + 1),
        }),
      )) === "comment_too_long",
    );

    /* ── 4. Implicit by View (Collaborator) ───────────────────────── */

    console.log("");
    console.log("4. Implicit by View (Collaborator)");
    const collabList = await listCommentThreads({
      organizationId,
      userId: collabLogin.id,
      clientIdOrSlug: planA.id,
      targetType: "plan",
    });
    check(
      "a Collaborator with View sees the threads",
      collabList.threads.length === 2,
      `${collabList.threads.length}`,
    );

    /* ── 5. Category scope ────────────────────────────────────────── */

    console.log("");
    console.log("5. Category scope is enforced");
    check(
      "a plan thread carries no category, so it is allowed",
      (await refusalCode(() =>
        createCommentThread({
          organizationId,
          userId: collabLogin.id,
          clientIdOrSlug: planA.id,
          targetType: "plan",
          anchor: { anchorKind: "section", sectionKey: "contacts" },
          body: "ok",
        }),
      )) === "(no error)",
    );
    check(
      "a category the Collaborator does not hold is refused",
      (await refusalCode(() =>
        listCommentThreads({
          organizationId,
          userId: collabLogin.id,
          clientIdOrSlug: planA.id,
          targetType: "benefit",
          category: "Retirement",
        }),
      )) === "category_not_assigned",
    );
    check(
      "the held category is allowed",
      (await refusalCode(() =>
        listCommentThreads({
          organizationId,
          userId: collabLogin.id,
          clientIdOrSlug: planA.id,
          targetType: "benefit",
          category: "Group Health",
        }),
      )) === "(no error)",
    );

    /* ── 6. Access denied ─────────────────────────────────────────── */

    console.log("");
    console.log("6. An unassigned plan / unrelated user is refused");
    check(
      "plan B is refused for the Collaborator",
      (await refusalCode(() =>
        listCommentThreads({
          organizationId,
          userId: collabLogin.id,
          clientIdOrSlug: planB.id,
          targetType: "plan",
        }),
      )) === "not_assigned",
    );
    check(
      "an unrelated user is refused",
      (await refusalCode(() =>
        listCommentThreads({
          organizationId,
          userId: stranger.id,
          clientIdOrSlug: planA.id,
          targetType: "plan",
        }),
      )) === "not_assigned",
    );

    /* ── 7. Replies and notifications ─────────────────────────────── */

    console.log("");
    console.log("7. Replies and notifications");
    const replied = await addCommentMessage({
      organizationId,
      userId: collabLogin.id,
      threadId: sectionThread.id,
      body: "Looks good to me.",
    });
    check(
      "a reply appends to the thread",
      replied.messages.length === 2,
      `${replied.messages.length}`,
    );
    const ownerReplies = await prisma.notification.count({
      where: { userId: owner.id, type: "comment_reply" },
    });
    check("the thread author is notified of the reply", ownerReplies >= 1, `${ownerReplies}`);

    // Thrown by the Collaborator (a Viewer) so §9 can prove AUTHORSHIP IS NOT ENOUGH.
    const collabThread = await createCommentThread({
      organizationId,
      userId: collabLogin.id,
      clientIdOrSlug: planA.id,
      targetType: "plan",
      anchor: { anchorKind: "section", sectionKey: "documents" },
      body: "Upload the SBC please.",
    });
    const ownerCreated = await prisma.notification.count({
      where: { userId: owner.id, type: "comment_thread_created" },
    });
    check("the plan owner is notified of a new thread", ownerCreated >= 1, `${ownerCreated}`);

    /* ── 8. Mentions ──────────────────────────────────────────────── */

    console.log("");
    console.log("8. @mentions notify the mentioned teammate");
    const mentionable = await listMentionableUsers({
      organizationId,
      clientIdOrSlug: planA.id,
    });
    check(
      "the mentionable list includes the active teammate",
      mentionable.some((user) => user.userId === mentioneeLogin.id),
      `${mentionable.length} candidate(s)`,
    );

    // A mention notifies, and the notification carries the comment's text, so the candidate list
    // is limited to people who can open the surface. The Collaborator holds Group Health only.
    const ghMentionable = await listMentionableUsers({
      organizationId,
      clientIdOrSlug: planA.id,
      category: "Group Health",
    });
    check(
      "the Collaborator is mentionable on the category they hold",
      ghMentionable.some((user) => user.userId === collabLogin.id),
    );
    const retirementMentionable = await listMentionableUsers({
      organizationId,
      clientIdOrSlug: planA.id,
      category: "Retirement",
    });
    check(
      "...but not on a category they do not hold",
      !retirementMentionable.some((user) => user.userId === collabLogin.id),
    );
    const planBMentionable = await listMentionableUsers({
      organizationId,
      clientIdOrSlug: planB.id,
    });
    check(
      "...nor on a plan they are not assigned to",
      !planBMentionable.some((user) => user.userId === collabLogin.id),
    );

    // End to end: the owner mentions them on planB, where they hold no assignment. The mention is
    // not even recognised, so nothing reaches their inbox — the leak closed at the source rather
    // than at the notification.
    const mentionsBefore = await prisma.notification.count({
      where: { userId: collabLogin.id, type: "comment_mention" },
    });
    await createCommentThread({
      organizationId,
      userId: owner.id,
      clientIdOrSlug: planB.id,
      targetType: "plan",
      anchor: { anchorKind: "section", sectionKey: "company" },
      body: `@TCM Collaborator ${STAMP} can you look at this?`,
    });
    const mentionsAfter = await prisma.notification.count({
      where: { userId: collabLogin.id, type: "comment_mention" },
    });
    check(
      "mentioning someone who cannot open the plan notifies nobody",
      mentionsAfter === mentionsBefore,
      `before=${mentionsBefore} after=${mentionsAfter}`,
    );
    await createCommentThread({
      organizationId,
      userId: owner.id,
      clientIdOrSlug: planA.id,
      targetType: "plan",
      anchor: { anchorKind: "section", sectionKey: "documents" },
      body: `Can you check this, @Zelda Mention ${STAMP}?`,
    });
    const mentionNotes = await prisma.notification.count({
      where: { userId: mentioneeLogin.id, type: "comment_mention" },
    });
    check("the mentioned teammate is notified", mentionNotes >= 1, `${mentionNotes}`);
    const mentionNotification = await prisma.notification.findFirst({
      where: { userId: mentioneeLogin.id, type: "comment_mention" },
      select: { href: true },
    });
    check(
      "the notification deep-links to the plan",
      (mentionNotification?.href ?? "").startsWith(`/edit-client/${planA.id}`),
      mentionNotification?.href ?? "null",
    );

    /* ── 9. Resolve/reopen + moderation ───────────────────────────── */

    console.log("");
    console.log("9. Resolve/Reopen — Owner/Admin only");
    const ownerView = await listCommentThreads({
      organizationId,
      userId: owner.id,
      clientIdOrSlug: planA.id,
      targetType: "plan",
    });
    check(
      "the owner is told they may moderate",
      ownerView.canModerate === true,
      `${ownerView.canModerate}`,
    );
    const collabView = await listCommentThreads({
      organizationId,
      userId: collabLogin.id,
      clientIdOrSlug: planA.id,
      targetType: "plan",
    });
    check(
      "a Viewer is told they may not",
      collabView.canModerate === false,
      `${collabView.canModerate}`,
    );

    const resolved = await setCommentThreadResolved({
      organizationId,
      userId: owner.id,
      threadId: sectionThread.id,
      resolved: true,
    });
    check("the plan owner resolves the thread", resolved.resolvedAt !== null);
    const reopened = await setCommentThreadResolved({
      organizationId,
      userId: owner.id,
      threadId: sectionThread.id,
      resolved: false,
    });
    check("the owner reopens the thread", reopened.resolvedAt === null);

    const adminResolved = await setCommentThreadResolved({
      organizationId,
      userId: adminLogin.id,
      threadId: sectionThread.id,
      resolved: true,
    });
    check("an Admin resolves someone else's thread", adminResolved.resolvedAt !== null);
    await setCommentThreadResolved({
      organizationId,
      userId: owner.id,
      threadId: sectionThread.id,
      resolved: false,
    });

    check(
      "an author who is neither Owner nor Admin cannot resolve their OWN thread",
      (await refusalCode(() =>
        setCommentThreadResolved({
          organizationId,
          userId: collabLogin.id,
          threadId: collabThread.id,
          resolved: true,
        }),
      )) === "comment_forbidden",
    );
    check(
      "a Viewer cannot resolve a thread they did not write",
      (await refusalCode(() =>
        setCommentThreadResolved({
          organizationId,
          userId: mentioneeLogin.id,
          threadId: sectionThread.id,
          resolved: true,
        }),
      )) === "comment_forbidden",
    );
    check(
      "an unassigned user is stopped by the access layer, not the moderation rule",
      (await refusalCode(() =>
        setCommentThreadResolved({
          organizationId,
          userId: stranger.id,
          threadId: sectionThread.id,
          resolved: true,
        }),
      )) === "not_assigned",
    );

    /* ── 10. Deleting a message and a thread ──────────────────────── */

    console.log("");
    console.log("10. Deleting messages and threads — Owner/Admin only");
    const collabMessage = replied.messages.find(
      (message) => message.authorUserId === collabLogin.id,
    );
    if (!collabMessage) throw new Error("fixture: collaborator reply missing");
    check(
      "an author cannot delete their own message",
      (await refusalCode(() =>
        deleteCommentMessage({
          organizationId,
          userId: collabLogin.id,
          messageId: collabMessage.id,
        }),
      )) === "comment_forbidden",
    );
    await deleteCommentMessage({
      organizationId,
      userId: owner.id,
      messageId: collabMessage.id,
    });
    const afterDelete = await listCommentThreads({
      organizationId,
      userId: owner.id,
      clientIdOrSlug: planA.id,
      targetType: "plan",
    });
    const deletedMessage = afterDelete.threads
      .find((thread) => thread.id === sectionThread.id)
      ?.messages.find((message) => message.id === collabMessage.id);
    check(
      "a withdrawn message keeps its place but drops its text",
      Boolean(deletedMessage?.deletedAt) && deletedMessage?.body === "",
      `deletedAt=${deletedMessage?.deletedAt ?? "null"} body="${deletedMessage?.body ?? "?"}"`,
    );

    check(
      "an author cannot delete their own thread",
      (await refusalCode(() =>
        deleteCommentThread({
          organizationId,
          userId: collabLogin.id,
          threadId: collabThread.id,
        }),
      )) === "comment_forbidden",
    );

    await deleteCommentThread({
      organizationId,
      userId: owner.id,
      threadId: textThread.id,
    });
    const afterThreadDelete = await listCommentThreads({
      organizationId,
      userId: owner.id,
      clientIdOrSlug: planA.id,
      targetType: "plan",
    });
    check(
      "deleting a thread removes it and its messages",
      !afterThreadDelete.threads.some((thread) => thread.id === textThread.id),
    );

    /* ── 11. Benefit category scoping ─────────────────────────────── */

    console.log("");
    console.log("11. Benefit threads are scoped and normalized by category");
    const ghThread = await createCommentThread({
      organizationId,
      userId: owner.id,
      clientIdOrSlug: planA.id,
      targetType: "benefit",
      category: "Group Health",
      anchor: { anchorKind: "section", sectionKey: "faqs" },
      body: "Add an FAQ about deductibles.",
    });
    check(
      "the stored benefit key is normalized",
      ghThread.benefitCategory === normalizeBenefitCategoryKey("Group Health"),
      String(ghThread.benefitCategory),
    );
    const ghList = await listCommentThreads({
      organizationId,
      userId: owner.id,
      clientIdOrSlug: planA.id,
      targetType: "benefit",
      category: "Group Health",
    });
    check(
      "the Group Health list shows its thread",
      ghList.threads.length === 1 && ghList.threads[0].id === ghThread.id,
      `${ghList.threads.length}`,
    );
    const retList = await listCommentThreads({
      organizationId,
      userId: owner.id,
      clientIdOrSlug: planA.id,
      targetType: "benefit",
      category: "Retirement",
    });
    check("another category's list is empty", retList.threads.length === 0, `${retList.threads.length}`);
    const planList = await listCommentThreads({
      organizationId,
      userId: owner.id,
      clientIdOrSlug: planA.id,
      targetType: "plan",
    });
    check(
      "plan threads never include benefit threads",
      planList.threads.every((thread) => thread.benefitCategory === null),
      planList.threads.map((thread) => thread.benefitCategory).join(","),
    );

    /* ── 11b. Attachment reads follow the thread's scope ──────────── */

    // Comment attachments flow through the generic R2 proxy, which authorizes a plan-shaped key at
    // PLAN level. That is coarser than the comments API: a Collaborator scoped to Group Health
    // passes it for any object under the plan, so the read path re-checks a comment key against the
    // scope of the thread that owns it.
    const ghKey = `org/${owner.id}/plans/${planA.id}/comments/${STAMP}/gh-summary.png`;
    const retKey = `org/${owner.id}/plans/${planA.id}/comments/${STAMP}/ret-summary.png`;
    await addCommentMessage({
      organizationId,
      userId: owner.id,
      threadId: ghThread.id,
      body: "Attaching the summary.",
      attachments: [{ key: ghKey, name: "gh-summary.png", type: "image/png", size: 1024 }],
    });
    await createCommentThread({
      organizationId,
      userId: owner.id,
      clientIdOrSlug: planA.id,
      targetType: "benefit",
      category: "Retirement",
      anchor: { anchorKind: "section", sectionKey: "faqs" },
      body: "Retirement notes.",
      attachments: [{ key: retKey, name: "ret-summary.png", type: "image/png", size: 1024 }],
    });

    const ghAttachment = await resolveCommentAttachmentAccess({
      userId: collabLogin.id,
      key: ghKey,
    });
    check(
      "a Collaborator reads an attachment on a category they hold",
      ghAttachment?.allowed === true,
      JSON.stringify(ghAttachment),
    );
    const retAttachment = await resolveCommentAttachmentAccess({
      userId: collabLogin.id,
      key: retKey,
    });
    check(
      "...but not one on a category they do not hold",
      retAttachment?.allowed === false,
      JSON.stringify(retAttachment),
    );
    const ownerAttachment = await resolveCommentAttachmentAccess({
      userId: owner.id,
      key: retKey,
    });
    check("the plan owner reads either", ownerAttachment?.allowed === true, JSON.stringify(ownerAttachment));
    const unclaimedAttachment = await resolveCommentAttachmentAccess({
      userId: collabLogin.id,
      key: `org/${owner.id}/plans/${planA.id}/comments/${STAMP}/never-attached.png`,
    });
    check(
      "an unclaimed comments/ key falls back to the plan-level check",
      unclaimedAttachment === null,
      JSON.stringify(unclaimedAttachment),
    );
    const documentAttachment = await resolveCommentAttachmentAccess({
      userId: collabLogin.id,
      key: `org/${owner.id}/plans/${planA.id}/documents/${STAMP}/sbc.pdf`,
    });
    check(
      "a non-comments key is left to the generic proxy",
      documentAttachment === null,
      JSON.stringify(documentAttachment),
    );

    /* ── 12. Plan deletion cascades ───────────────────────────────── */

    console.log("");
    console.log("12. Deleting a plan removes its comment threads");
    const planC = await prisma.client.create({
      data: {
        userId: owner.id,
        organizationId,
        companyName: `TCM Plan C ${STAMP}`,
        slug: `tcm-verify-c-${STAMP}`,
        status: "Draft",
        keyContacts: [],
      },
      select: { id: true },
    });
    created.clientIds.push(planC.id);
    await createCommentThread({
      organizationId,
      userId: owner.id,
      clientIdOrSlug: planC.id,
      targetType: "plan",
      anchor: { anchorKind: "section", sectionKey: "company" },
      body: "temp",
    });
    check(
      "the throwaway plan has a thread",
      (await prisma.commentThread.count({ where: { clientId: planC.id } })) === 1,
    );
    await prisma.client.delete({ where: { id: planC.id } });
    created.clientIds = created.clientIds.filter((id) => id !== planC.id);
    check(
      "the FK cascade removed the plan's threads",
      (await prisma.commentThread.count({ where: { clientId: planC.id } })) === 0,
    );
    check(
      "and their messages",
      (await prisma.commentMessage.count({
        where: { thread: { clientId: planC.id } },
      })) === 0,
    );

    /* ── 13. "Currently typing" ───────────────────────────────────── */

    console.log("");
    console.log("13. Currently typing — per thread, per person, named");

    await markCommentTyping({
      organizationId,
      userId: collabLogin.id,
      threadId: sectionThread.id,
    });
    const ownerSeesTyping = await listCommentTyping({
      organizationId,
      userId: owner.id,
      clientIdOrSlug: planA.id,
      targetType: "plan",
    });
    check(
      "another participant is told WHO is typing in the thread",
      ownerSeesTyping.byThread[sectionThread.id]?.length === 1 &&
        ownerSeesTyping.byThread[sectionThread.id]?.[0]?.userId === collabLogin.id,
      JSON.stringify(ownerSeesTyping.byThread[sectionThread.id]),
    );
    const collabSeesTyping = await listCommentTyping({
      organizationId,
      userId: collabLogin.id,
      clientIdOrSlug: planA.id,
      targetType: "plan",
    });
    check(
      "…and the typer is never shown their own typing",
      collabSeesTyping.byThread[sectionThread.id] === undefined,
      JSON.stringify(collabSeesTyping.byThread[sectionThread.id]),
    );

    // The timestamp IS the mechanism, so an old one must read as "not typing" — this is what makes
    // the indicator self-healing with no "stopped typing" event. The read prunes as it goes, so this
    // also covers the row actually leaving the table.
    await prisma.commentTyping.updateMany({
      where: { threadId: sectionThread.id },
      data: { pingedAt: new Date(Date.now() - 60_000) },
    });
    check(
      "the signal expires on its own once stale",
      (
        await listCommentTyping({
          organizationId,
          userId: owner.id,
          clientIdOrSlug: planA.id,
          targetType: "plan",
        })
      ).byThread[sectionThread.id] === undefined,
    );

    await markCommentTyping({
      organizationId,
      userId: collabLogin.id,
      threadId: sectionThread.id,
    });
    await addCommentMessage({
      organizationId,
      userId: collabLogin.id,
      threadId: sectionThread.id,
      body: "Replying clears my own typing signal.",
    });
    check(
      "posting a reply clears the author's own typing signal",
      (
        await listCommentTyping({
          organizationId,
          userId: owner.id,
          clientIdOrSlug: planA.id,
          targetType: "plan",
        })
      ).byThread[sectionThread.id] === undefined,
    );

    /* ── 14. The persistent composer's SURFACE-scoped signal ──────── */

    console.log("");
    console.log("14. Currently typing — the rail's persistent composer");

    // The case that was missed on the first pass: the big composer at the bottom of the panel
    // composes a NEW thread, so the signal has no thread to hang on and is scoped to the surface.
    await markSurfaceTyping({
      organizationId,
      userId: collabLogin.id,
      clientIdOrSlug: planA.id,
      targetType: "plan",
    });
    const surfaceTyping = await listCommentTyping({
      organizationId,
      userId: owner.id,
      clientIdOrSlug: planA.id,
      targetType: "plan",
    });
    check(
      "a new comment being typed is reported as a COMPOSER typer, not against a thread",
      surfaceTyping.composers.length === 1 &&
        surfaceTyping.composers[0]?.userId === collabLogin.id &&
        Object.keys(surfaceTyping.byThread).length === 0,
      JSON.stringify(surfaceTyping),
    );

    // The invariant the single non-null `scopeKey` unique exists for: pinging again moves the row
    // rather than adding a second one. (The DM's canonical-pair lesson, applied before it bit.)
    await markSurfaceTyping({
      organizationId,
      userId: collabLogin.id,
      clientIdOrSlug: planA.id,
      targetType: "plan",
    });
    const surfaceRows = await prisma.commentTyping.count({
      where: { scopeKey: `surface:${planA.id}:plan:`, userId: collabLogin.id },
    });
    check(
      "pinging twice keeps ONE surface row per person, not two",
      surfaceRows === 1,
      `${surfaceRows}`,
    );

    // Posting the comment clears the surface row too — otherwise the rail would show the author
    // still composing for the rest of the TTL after their comment is visibly in the list.
    await addCommentMessage({
      organizationId,
      userId: collabLogin.id,
      threadId: sectionThread.id,
      body: "Posting clears my composer signal as well.",
    });
    check(
      "posting a comment clears the author's SURFACE signal as well as the thread's",
      (
        await listCommentTyping({
          organizationId,
          userId: owner.id,
          clientIdOrSlug: planA.id,
          targetType: "plan",
        })
      ).composers.length === 0,
    );

    check(
      "someone with no access to the plan cannot ping the surface either",
      (await refusalCode(() =>
        markSurfaceTyping({
          organizationId,
          userId: stranger.id,
          clientIdOrSlug: planA.id,
          targetType: "plan",
        }),
      )) === "not_assigned",
    );

    check(
      "someone with no access to the plan cannot ping a thread",
      (await refusalCode(() =>
        markCommentTyping({
          organizationId,
          userId: stranger.id,
          threadId: sectionThread.id,
        }),
      )) === "not_assigned",
    );
    check(
      "…nor be told who is typing on it",
      (await refusalCode(() =>
        listCommentTyping({
          organizationId,
          userId: stranger.id,
          clientIdOrSlug: planA.id,
          targetType: "plan",
        }),
      )) === "not_assigned",
    );

    /* ── 15. A landed comment retires the mark it makes a lie ─────── */

    console.log("");
    console.log("15. Typing stops when the comment LANDS — the pill can never beat the line");

    // The reported bug, exactly: the rail's persistent composer pings the SURFACE, and creating a
    // thread has to clear that row the way a reply already did. Without the clear the count (which
    // spans the surface) raises the pill for the new thread while the composer line still names its
    // author as typing, which is what a reader saw.
    await markSurfaceTyping({
      organizationId,
      userId: collabLogin.id,
      clientIdOrSlug: planA.id,
      targetType: "plan",
    });
    const composingWhileSending = await listCommentTyping({
      organizationId,
      userId: owner.id,
      clientIdOrSlug: planA.id,
      targetType: "plan",
    });
    const composerMark = composingWhileSending.composers[0]?.typingAt ?? "";
    check(
      "the mark travels with the typer, so a reader can tell when a message has overtaken it",
      composerMark !== "" && !Number.isNaN(new Date(composerMark).getTime()),
      JSON.stringify(composingWhileSending.composers),
    );

    const composerThread = await createCommentThread({
      organizationId,
      userId: collabLogin.id,
      clientIdOrSlug: planA.id,
      targetType: "plan",
      anchor: { anchorKind: "section", sectionKey: "company" },
      body: "My comment, so my typing signal goes with it.",
    });
    check(
      "creating a thread clears the composer's typing signal — the missing clear that let the pill beat the line",
      (
        await listCommentTyping({
          organizationId,
          userId: owner.id,
          clientIdOrSlug: planA.id,
          targetType: "plan",
        })
      ).composers.length === 0 && composerThread.messages.length === 1,
    );

    // The other half of the guarantee, and the reason it cannot be left to the write path alone: the
    // pill and the typing line arrive on polls that are not in step, so a reader can hold two stale
    // but individually correct answers at once. The rule applied at render time is a comparison of
    // timestamps — synthetic here, so the assertion cannot be sensitive to clock skew.
    const afterMark = new Date(new Date(composerMark).getTime() + 1000).toISOString();
    const beforeMark = new Date(new Date(composerMark).getTime() - 1000).toISOString();
    check(
      "a message newer than the mark retires it, and one older than it does not",
      typingMarkStands(
        composerMark,
        newestMessageAt(
          [{ authorUserId: collabLogin.id, createdAt: afterMark }],
          collabLogin.id,
        ),
      ) === false &&
        typingMarkStands(
          composerMark,
          newestMessageAt(
            [{ authorUserId: collabLogin.id, createdAt: beforeMark }],
            collabLogin.id,
          ),
        ) === true,
    );

    check(
      "…and only the typer's OWN messages retire them — somebody else's comment does not",
      liveTypingPeople(composingWhileSending.composers, [
        { authorUserId: owner.id, createdAt: afterMark },
      ]).length === 1,
    );

    /* ── 16. A seat's picture and name reach the comments UI ──────── */

    console.log("");
    console.log("16. A Collaborator's seat picture reaches the comments UI");

    // The reported bug. A teammate's picture and name live on their SEAT — the self-service profile —
    // and the resolvers here read the login alone, so every Collaborator drew as a monogram while the
    // DM rail (which did fall back to the seat) drew their picture. The owner is the exception that
    // hid it: they hold no seat and keep theirs on the login.
    // The login's own picture wins by design, so it is cleared first: this asserts the FALLBACK to the
    // seat, which is the half that never existed here.
    await prisma.user.update({
      where: { id: collabLogin.id },
      data: { headshot: null },
    });
    await prisma.teammateProfile.updateMany({
      where: { organizationId, loginUserId: collabLogin.id },
      data: {
        headshot: "https://example.test/dana.png",
        firstName: "Dana",
        lastName: "Scully",
      },
    });

    const withSeatPictures = await listCommentThreads({
      organizationId,
      userId: owner.id,
      clientIdOrSlug: planA.id,
      targetType: "plan",
    });
    const seatPicturedAuthor = withSeatPictures.threads
      .flatMap((thread) => thread.messages)
      .find((message) => message.authorUserId === collabLogin.id)?.author;
    check(
      "a Collaborator's SEAT picture renders on their comment, not a monogram",
      seatPicturedAuthor?.headshot === "https://example.test/dana.png",
      JSON.stringify(seatPicturedAuthor ?? null),
    );
    check(
      "…and their name comes from the seat too, the same rule the DM rail applies",
      seatPicturedAuthor?.name === "Dana Scully",
      JSON.stringify(seatPicturedAuthor ?? null),
    );
    check(
      "the owner, who holds no seat, still renders from their own login",
      withSeatPictures.threads
        .flatMap((thread) => thread.messages)
        .find((message) => message.authorUserId === owner.id)?.author?.userId === owner.id,
    );

    /* ── 17. Assigning work — the permission matrix ───────────────── */

    console.log("");
    console.log("17. Assigning from a thread — who, and where");

    const heldCategory = normalizeBenefitCategoryKey("Group Health");

    // A PLAN thread is internal work: the Collaborator can comment on it — implicit by View — but
    // can never be handed it. This is the rule the whole feature turns on.
    const planCandidates = await listAssignableUsers({
      organizationId,
      userId: owner.id,
      clientIdOrSlug: planA.id,
      targetType: "plan",
    });
    check(
      "a Collaborator is never an assignee on a PLAN thread",
      !planCandidates.some((person) => person.userId === collabLogin.id),
      JSON.stringify(planCandidates),
    );
    check(
      "…while the firm's own people are — a Team Member and an Admin",
      planCandidates.some((person) => person.userId === mentioneeLogin.id) &&
        planCandidates.some((person) => person.userId === adminLogin.id),
      JSON.stringify(planCandidates.map((person) => person.userId)),
    );
    check(
      "…and the assigner is not offered themselves",
      !planCandidates.some((person) => person.userId === owner.id),
      JSON.stringify(planCandidates.map((person) => person.userId)),
    );

    // A BENEFIT-category thread may be handed to a Collaborator, and the category scope is what
    // decides WHICH — the same list the @mention picker resolves, so the two cannot disagree.
    const benefitCandidates = await listAssignableUsers({
      organizationId,
      userId: owner.id,
      clientIdOrSlug: planA.id,
      targetType: "benefit",
      category: heldCategory,
    });
    check(
      "a Collaborator IS assignable on a benefit thread for a category they hold",
      benefitCandidates.some(
        (person) =>
          person.userId === collabLogin.id && person.kind === "collaborator",
      ),
      JSON.stringify(benefitCandidates),
    );

    // The derived tasks offered must be THIS plan's, and never the one that cannot be delegated:
    // publishing is Owner/Admin work with its own attestation, so a task row for it would be a
    // promise the assignee could not keep.
    const ownerPlans = await listAccessiblePlanIds(owner.id);
    const derivedSource = await listSystemTasks(ownerPlans);
    const offered = await listAssignableNeedsAttention({
      organizationId,
      userId: owner.id,
    });
    check(
      "each offer is ONE INNER task of an issue — never the headline, and never publish",
      offered.length > 0 &&
        offered.every((task) => task.title.length > 0 && task.groupLabel.length > 0) &&
        offered.every((task) => task.id.includes("::")) &&
        offered.every((task) => task.kind !== "ready-to-publish"),
      `${offered.length} offer(s) from ${derivedSource.length} derived row(s)`,
    );
    check(
      "…and every offer belongs to an issue the dashboard is actually reporting",
      offered.every((task) =>
        derivedSource.some(
          (issue) => issue.clientId === task.clientId && issue.kind === task.kind,
        ),
      ),
      JSON.stringify(offered.map((task) => [task.kind, task.clientId])),
    );

    // …narrowed by WHO it is for: work is worth handing over only if the other person can act on it.
    const collabPlans = await listAccessiblePlanIds(collabLogin.id);
    const forCollab = await listAssignableNeedsAttention({
      organizationId,
      userId: owner.id,
      assigneeUserId: collabLogin.id,
    });
    check(
      "…and narrowed by the ASSIGNEE's reach, so nobody is offered a plan they cannot open",
      forCollab.length <= offered.length &&
        forCollab.every((task) => collabPlans.includes(task.clientId)),
      `${forCollab.length} for the Collaborator, of ${offered.length}`,
    );

    check(
      "a Collaborator cannot even be OFFERED the assign dialog",
      (await refusalCode(() =>
        listAssignable({
          organizationId,
          userId: collabLogin.id,
          clientIdOrSlug: planA.id,
          targetType: "plan",
        }),
      )) === "comment_forbidden",
    );
    check(
      "…while the owner is handed the same candidates the list resolved",
      (
        await listAssignable({
          organizationId,
          userId: owner.id,
          clientIdOrSlug: planA.id,
          targetType: "plan",
        })
      ).users.length === planCandidates.length,
    );
    check(
      "an outsider cannot be offered it either",
      (await refusalCode(() =>
        listAssignable({
          organizationId,
          userId: stranger.id,
          clientIdOrSlug: planA.id,
          targetType: "plan",
        }),
      )) === "not_assigned",
    );

    // An ordinary comment is not an assignment, and the read says so rather than leaving the rail to
    // infer it from an absent field.
    const plainThread = await listCommentThreads({
      organizationId,
      userId: owner.id,
      clientIdOrSlug: planA.id,
      targetType: "plan",
    });
    check(
      'a plain comment reads as kind "comment" with no task attached',
      plainThread.threads
        .flatMap((thread) => thread.messages)
        .every((message) => message.kind === "comment" && message.task === null),
      JSON.stringify(
        plainThread.threads.flatMap((thread) => thread.messages).map((m) => m.kind),
      ),
    );

    /* ── 18. Assigning, and taking it back ────────────────────────── */

    console.log("");
    console.log("18. Assigning a task — the write, and the traces it leaves");

    const assigned = await assignTask({
      organizationId,
      userId: owner.id,
      threadId: sectionThread.id,
      assigneeUserId: mentioneeLogin.id,
      title: "Review the company details",
    });
    const card = assigned.messages[assigned.messages.length - 1];
    check(
      "the assignment lands as a KINDED message carrying the task's live state",
      card.kind === "task_assignment" &&
        card.task !== null &&
        card.task.done === false &&
        card.task.assignedToUserId === mentioneeLogin.id &&
        card.task.assignedByUserId === owner.id,
      JSON.stringify(card.task),
    );
    check(
      "…and its plain-text body says what happened, for the notification and the eye",
      card.body.includes("Review the company details"),
      card.body,
    );

    const taskRow = card.task
      ? await prisma.task.findUnique({ where: { id: card.task.id } })
      : null;
    check(
      "ONE stored task, owned by the assignee, stamped with who asked and which conversation",
      taskRow?.userId === mentioneeLogin.id &&
        taskRow?.assignedByUserId === owner.id &&
        taskRow?.clientId === planA.id &&
        taskRow?.sourceThreadId === sectionThread.id &&
        taskRow?.sourceMessageId === card.id,
      JSON.stringify(taskRow),
    );
    check(
      "…which is work the assignee can already see on their own dashboard",
      (await listManualTasks(mentioneeLogin.id, [planA.id])).some(
        (task) => task.id === taskRow?.id && task.planName !== null,
      ),
    );

    const assignmentNotification = await prisma.notification.findFirst({
      where: {
        userId: mentioneeLogin.id,
        type: COMMENT_NOTIFICATION_TYPES.taskAssigned,
      },
      select: { href: true },
    });
    check(
      "and exactly ONE notification, deep-linking the thread it came from",
      Boolean(assignmentNotification?.href?.includes(sectionThread.id)) &&
        (await prisma.notification.count({
          where: {
            userId: mentioneeLogin.id,
            type: COMMENT_NOTIFICATION_TYPES.taskAssigned,
          },
        })) === 1,
      JSON.stringify(assignmentNotification),
    );

    // The rule from the WRITE side. A Collaborator is absent from a plan thread's candidate list, so
    // this one membership test refuses them — there is no second copy of the rule to drift.
    check(
      "a Collaborator cannot be assigned work on a PLAN thread",
      (await refusalCode(() =>
        assignTask({
          organizationId,
          userId: owner.id,
          threadId: sectionThread.id,
          assigneeUserId: collabLogin.id,
          title: "Not allowed on a plan thread",
        }),
      )) === "assignee_not_allowed",
    );
    check(
      "…but on a benefit thread they hold, the same call is accepted",
      (
        await assignTask({
          organizationId,
          userId: owner.id,
          threadId: ghThread.id,
          assigneeUserId: collabLogin.id,
          title: "Check the Group Health summary",
        })
      ).messages.some((message) => message.task?.assignedToUserId === collabLogin.id),
    );

    // A derived id is accepted only if the freshly derived list offers it — so the one task this
    // feature refuses to delegate cannot be smuggled in by naming it directly.
    check(
      "an undelegable derived task is refused even when its id is posted directly",
      (await refusalCode(() =>
        assignTask({
          organizationId,
          userId: owner.id,
          threadId: sectionThread.id,
          assigneeUserId: mentioneeLogin.id,
          derivedTaskId: `system-ready-to-publish-${planA.id}`,
        }),
      )) === "derived_task_not_offered",
    );
    check(
      "a Collaborator cannot assign at all",
      (await refusalCode(() =>
        assignTask({
          organizationId,
          userId: collabLogin.id,
          threadId: ghThread.id,
          assigneeUserId: adminLogin.id,
          title: "I am not a moderator",
        }),
      )) === "comment_forbidden",
    );

    // Completion belongs to the assignee, and the thread reports it — work it asked for is never
    // silently stale.
    if (taskRow) {
      await prisma.task.update({
        where: { id: taskRow.id },
        data: { done: true, doneAt: new Date() },
      });
    }
    const afterCompletion = await listCommentThreads({
      organizationId,
      userId: owner.id,
      clientIdOrSlug: planA.id,
      targetType: "plan",
    });
    check(
      "ticking the task off makes the thread's card read as completed",
      afterCompletion.threads
        .flatMap((thread) => thread.messages)
        .find((message) => message.id === card.id)?.task?.done === true,
    );

    // The assignee owns the task but not the request. Letting them withdraw would let somebody
    // quietly erase what they were asked for.
    check(
      "the assignee cannot withdraw the assignment they were given",
      (await refusalCode(() =>
        withdrawAssignment({
          organizationId,
          userId: mentioneeLogin.id,
          messageId: card.id,
        }),
      )) === "comment_forbidden",
    );

    check(
      "the assigner can — which deletes the task",
      (
        await withdrawAssignment({
          organizationId,
          userId: owner.id,
          messageId: card.id,
        })
      ).threadId === sectionThread.id &&
        (await prisma.task.count({ where: { id: taskRow?.id ?? "none" } })) === 0,
    );
    const afterWithdrawal = await listCommentThreads({
      organizationId,
      userId: owner.id,
      clientIdOrSlug: planA.id,
      targetType: "plan",
    });
    check(
      "…and the card stays where it was, reporting that there is nothing to report",
      afterWithdrawal.threads
        .flatMap((thread) => thread.messages)
        .find((message) => message.id === card.id)?.task === null,
    );

    /* ── 19. One row per unit of work ─────────────────────────────── */

    console.log("");
    console.log("19. The dashboard keeps ONE row per unit of work");

    // The test needs a REAL derived task to be worth anything, so the fixture is checked first: with
    // none to delegate, de-duplication would pass by having nothing to de-duplicate, and a green tick
    // that means nothing is worse than a red one.
    // Deliberately NOT pinned to a particular plan: the offer is the organisation's Needs Attention
    // work, and which plan it lands on is the fixture's business, not the rule's.
    const delegable = await listAssignableNeedsAttention({
      organizationId,
      userId: owner.id,
      assigneeUserId: mentioneeLogin.id,
    });
    const target = delegable[0];
    // A Draft plan is not "needing attention" — that panel is about LIVE plans — so nothing derived
    // is offered from one by design. Asserted rather than assumed: it is the behaviour a reader will
    // notice ("why is the list empty on my draft?") and the reason this section's own scenario below
    // does not depend on the offer existing.
    check(
      "a DRAFT plan reports no Needs Attention work, so nothing derived is offered from one",
      delegable.every((task) => task.clientId !== planA.id),
      JSON.stringify(delegable.map((task) => task.clientId)),
    );

    if (target) {
      await assignTask({
        organizationId,
        userId: owner.id,
        threadId: sectionThread.id,
        assigneeUserId: mentioneeLogin.id,
        derivedTaskId: target.id,
      });

      const assigneeRows = await listManualTasks(mentioneeLogin.id, [
        target.clientId,
      ]);
      check(
        "the assigned row carries the derived task's identity, so nothing is lost by suppressing it",
        assigneeRows.some(
          (task) => task.derivedKind === target.kind && task.href !== null,
        ),
        JSON.stringify(assigneeRows.map((task) => [task.derivedKind, task.href])),
      );

      // The assignee has plan access, so they can already see the derived row for this issue. The
      // assignment has to REPLACE it, not sit beside it.
      const forAssignee = await listSystemTasks(
        [target.clientId],
        await suppressedDerivedRows(mentioneeLogin.id),
      );
      check(
        "…and the derived row is suppressed FOR THEM — one row per unit of work",
        !forAssignee.some(
          (task) => task.kind === target.kind && task.clientId === target.clientId,
        ),
        JSON.stringify(forAssignee.map((task) => [task.kind, task.clientId])),
      );

      const forOwner = await listSystemTasks([target.clientId]);
      check(
        "…while everybody else still sees it, because for them it is not work they were given",
        forOwner.some(
          (task) => task.kind === target.kind && task.clientId === target.clientId,
        ),
        JSON.stringify(forOwner.map((task) => [task.kind, task.clientId])),
      );

      // A typed-title assignment stands in for no derived row, so it must suppress none — which is
      // what keeps the rule about inheritance rather than about assignments in general.
      await assignTask({
        organizationId,
        userId: owner.id,
        threadId: sectionThread.id,
        assigneeUserId: adminLogin.id,
        title: "Covers no derived row",
      });
      const adminSuppressions = await suppressedDerivedRows(adminLogin.id);
      check(
        "a task assigned with a TYPED title suppresses nothing — it stands in for nothing",
        adminSuppressions.size === 0,
        JSON.stringify([...adminSuppressions]),
      );
    }

    /* ── 20. Lifecycle: the work follows the login ────────────────── */

    console.log("");
    console.log("20. Deleting a login takes the work assigned to it");

    // Made HERE rather than borrowed from the section above: that one only runs when the organization
    // has Needs Attention work, and this section has to be able to prove what it claims either way.
    await assignTask({
      organizationId,
      userId: owner.id,
      threadId: sectionThread.id,
      assigneeUserId: adminLogin.id,
      title: "Holds no derived row, but is still this login's work",
    });

    // Guarded so it cannot pass by having nothing to delete — and it must run last, because it takes
    // this login's plans and tasks away with it.
    const adminTaskCount = await prisma.task.count({
      where: { userId: adminLogin.id },
    });
    await deletePlansAndScopedDataForUser(adminLogin.id);
    check(
      "…and the tasks it held go with it, before the user row could block the delete",
      adminTaskCount > 0 &&
        (await prisma.task.count({ where: { userId: adminLogin.id } })) === 0,
      `${adminTaskCount} before`,
    );

    /* ── 21. Assigning from the PANEL, mirroring your own work ─────── */

    console.log("");
    console.log("21. From the panel — the thread it creates, and a mirrored task");

    // One of the reader's OWN tasks on this plan: the row the modal offers as "your tasks".
    const ownedTask = await prisma.task.create({
      data: { userId: owner.id, title: "Draft the summary email", clientId: planA.id },
    });
    const beforePanel = await listCommentThreads({
      organizationId,
      userId: owner.id,
      clientIdOrSlug: planA.id,
      targetType: "plan",
    });

    const fromPanel = await assignTask({
      organizationId,
      userId: owner.id,
      // No `threadId`: this is the panel's path, and the assignment has to make its own thread.
      surface: { clientIdOrSlug: planA.id, targetType: "plan" },
      assigneeUserId: adminLogin.id,
      sourceTaskId: ownedTask.id,
      // Ignored on purpose: a mirrored task brings its own title.
      title: "this title does not win",
    });

    check(
      "assigning with no thread open CREATES the thread, with the card as its opening message",
      fromPanel.messages.length === 1 &&
        fromPanel.messages[0].kind === "task_assignment" &&
        fromPanel.messages[0].task?.title === "Draft the summary email",
      JSON.stringify(fromPanel.messages.map((message) => message.kind)),
    );
    check(
      "…and it is a real thread on that surface, one more than before",
      fromPanel.clientId === planA.id &&
        (
          await listCommentThreads({
            organizationId,
            userId: owner.id,
            clientIdOrSlug: planA.id,
            targetType: "plan",
          })
        ).threads.length ===
          beforePanel.threads.length + 1,
    );
    check(
      "the task it mirrored is still MINE — assigning hands over a copy, never the row",
      (await prisma.task.findUnique({ where: { id: ownedTask.id } }))?.userId ===
        owner.id,
    );
    check(
      "…and the assignee holds their own, stamped with who asked and which thread",
      (
        await prisma.task.findFirst({
          where: { userId: adminLogin.id, sourceThreadId: fromPanel.id },
        })
      )?.assignedByUserId === owner.id,
    );
    check(
      "a task that is not yours cannot be mirrored out from under its owner",
      (await refusalCode(() =>
        assignTask({
          organizationId,
          userId: owner.id,
          surface: { clientIdOrSlug: planA.id, targetType: "plan" },
          assigneeUserId: adminLogin.id,
          sourceTaskId: "not-a-task-of-mine",
        }),
      )) === "source_task_not_yours",
    );

    /* ── §22. The profile card: who may be looked up, and what it shows ── */

    // A login with NO seat in this organization. Their `User` row exists — which is exactly the
    // point: `loadPersonIdentities` resolves them happily, so it is the ORGANIZATION gate (and not a
    // missing account) that has to refuse them.
    const outsiderLogin = await prisma.user.create({
      data: {
        name: `TCM Outsider ${STAMP}`,
        email: `tcm-verify-outsider-${STAMP}@example.test`,
      },
      select: { id: true },
    });
    created.userIds.push(outsiderLogin.id);

    // A second Collaborator who shares NO plan with the first: listed in the directory, and not
    // selectable. The card must still describe them — only the button goes.
    const lonelyLogin = await prisma.user.create({
      data: {
        name: `TCM Lonely ${STAMP}`,
        email: `tcm-verify-lonely-${STAMP}@example.test`,
      },
      select: { id: true },
    });
    created.userIds.push(lonelyLogin.id);
    const lonely = await createTeammateProfile({
      organizationId,
      actorUserId: owner.id,
      type: "collaborator",
      email: `tcm-verify-lonely-${STAMP}@abbenefits.test`,
      firstName: "Lena",
      lastName: "Lonely",
      loginUserId: lonelyLogin.id,
    });
    created.profileIds.push(lonely.id);
    await prisma.teammateProfile.update({
      where: { id: lonely.id },
      data: { state: "active" },
    });

    // The two sources hold DIFFERENT values, so the precedence is asserted rather than assumed: the
    // seat is the organization's record, and the login's stale copy must not win.
    await prisma.teammateProfile.update({
      where: { id: mentionee.id },
      data: {
        jobTitle: "Senior Advisor",
        phone: "(555) 010-2030",
        phoneExtension: "412",
        designations: ["CFP"],
      },
    });
    await prisma.user.update({
      where: { id: mentioneeLogin.id },
      data: {
        title: "stale login title",
        phone: "(555) 999-9999",
        designations: ["STALE"],
      },
    });
    // The Owner holds NO seat, so their details exist only on the login row — the case that used to
    // render a blank card.
    await prisma.user.update({
      where: { id: owner.id },
      data: {
        title: "Principal",
        phone: "(555) 010-1010",
        phoneExtension: "7",
        designations: ["AIF"],
      },
    });
    await prisma.organization.update({
      where: { id: organizationId },
      data: { organizationEmail: `firm-${STAMP}@abbenefits.test` },
    });

    const mentioneeCard = await getPersonCard({
      organizationId,
      viewerUserId: adminLogin.id,
      userId: mentioneeLogin.id,
    });
    check(
      "the card names a teammate from their SEAT, with the standing that decided their eligibility",
      mentioneeCard?.name === "Zelda Mention" &&
        mentioneeCard.standingLabel === "Team Member" &&
        mentioneeCard.isSelf === false,
      JSON.stringify(mentioneeCard),
    );
    check(
      "…and takes their title, phone, extension and designations from the seat, NOT the login's stale copy",
      mentioneeCard?.jobTitle === "Senior Advisor" &&
        mentioneeCard.phone === "(555) 010-2030" &&
        mentioneeCard.phoneExtension === "412" &&
        mentioneeCard.designations.join() === "CFP",
      JSON.stringify(mentioneeCard),
    );

    const ownerCard = await getPersonCard({
      organizationId,
      viewerUserId: adminLogin.id,
      userId: owner.id,
    });
    check(
      "the OWNER — who holds no seat — still shows a title, phone and credentials, from their login row",
      ownerCard?.jobTitle === "Principal" &&
        ownerCard.phone === "(555) 010-1010" &&
        ownerCard.phoneExtension === "7" &&
        ownerCard.designations.join() === "AIF",
      JSON.stringify(ownerCard),
    );
    check(
      "…and is chipped Owner, with the organization's shared address carried alongside their own",
      ownerCard?.standingLabel === "Owner" &&
        ownerCard.roleLabel === "Owner" &&
        ownerCard.organizationEmail === `firm-${STAMP}@abbenefits.test` &&
        ownerCard.email === `tcm-verify-owner-${STAMP}@example.test`,
      JSON.stringify(ownerCard),
    );

    const selfCard = await getPersonCard({
      organizationId,
      viewerUserId: owner.id,
      userId: owner.id,
    });
    check(
      "your OWN card opens even though the directory excludes you — and offers no Message button",
      selfCard?.isSelf === true && selfCard.canMessage === false,
      JSON.stringify(selfCard),
    );

    check(
      "a login holding no seat in THIS organization is not somebody this card will describe",
      (await getPersonCard({
        organizationId,
        viewerUserId: owner.id,
        userId: outsiderLogin.id,
      })) === null &&
        (await prisma.user.findUnique({ where: { id: outsiderLogin.id } })) !== null,
      "the row exists, so the refusal is the organization gate rather than a missing account",
    );

    const lonelyCard = await getPersonCard({
      organizationId,
      viewerUserId: collabLogin.id,
      userId: lonelyLogin.id,
    });
    check(
      "a Collaborator sees a colleague they may NOT message: the card renders, the button does not",
      lonelyCard?.name === "Lena Lonely" &&
        lonelyCard.standingLabel === "Collaborator" &&
        lonelyCard.canMessage === false,
      JSON.stringify(lonelyCard),
    );
    check(
      "…and the same card offers a Team Member, because a Collaborator may always reach one",
      (
        await getPersonCard({
          organizationId,
          viewerUserId: collabLogin.id,
          userId: mentioneeLogin.id,
        })
      )?.canMessage === true,
    );
  } finally {
    if (!KEEP_FIXTURES) {
      await prisma.notification.deleteMany({
        where: { userId: { in: created.userIds } },
      });
      // Assigned tasks point at fixture LOGINS, and `Task.userId` is a real relation with no cascade —
      // so they have to go before the users, or the cleanup fails on the foreign key.
      await prisma.task.deleteMany({
        where: { userId: { in: created.userIds } },
      });
      await prisma.commentThread.deleteMany({
        where: { organizationId: { in: created.organizationIds } },
      });
      await prisma.planAssignment.deleteMany({
        where: { organizationId: { in: created.organizationIds } },
      });
      await prisma.teammateAuditEvent.deleteMany({
        where: { organizationId: { in: created.organizationIds } },
      });
      await prisma.teammateProfile.deleteMany({
        where: { id: { in: created.profileIds } },
      });
      await prisma.client.deleteMany({ where: { id: { in: created.clientIds } } });
      await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
      await prisma.organization.deleteMany({
        where: { id: { in: created.organizationIds } },
      });
      console.log("");
      console.log("Fixtures cleaned up.");
    } else {
      console.log("");
      console.log("Fixtures kept (--keep).");
    }

    summary("Comments verification");
    if (failureCount() > 0) process.exitCode = 1;
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Comments verification crashed:", error);
  process.exitCode = 1;
});
