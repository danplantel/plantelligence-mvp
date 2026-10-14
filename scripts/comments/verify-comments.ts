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
 *  13. the persistent composer's SURFACE-scoped typing, and its one-row-per-person invariant.
 *
 * Fixtures are `tcm-verify-*` and are cleaned up unless `--keep` is passed.
 */
import { check, createPrisma, failureCount, summary } from "../teammates/shared";
import { getOrCreateOrganizationForUser } from "../../lib/organization";
import { createTeammateProfile } from "../../lib/teammates/profiles.server";
import { upsertAssignment } from "../../lib/teammates/assignments.server";
import { TeammateDataError } from "../../lib/teammates/errors";
import {
  addCommentMessage,
  createCommentThread,
  deleteCommentMessage,
  deleteCommentThread,
  listCommentThreads,
  listCommentTyping,
  listMentionableUsers,
  markCommentTyping,
  markSurfaceTyping,
  resolveCommentAttachmentAccess,
  setCommentThreadResolved,
} from "../../lib/comments/comments.server";
import {
  MAX_COMMENT_LENGTH,
  normalizeBenefitCategoryKey,
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
  } finally {
    if (!KEEP_FIXTURES) {
      await prisma.notification.deleteMany({
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
