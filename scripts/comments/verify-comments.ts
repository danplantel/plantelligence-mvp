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
 *   8. resolve/reopen and moderation;
 *   9. soft-deleting a message and deleting a thread;
 *  10. benefit threads scoped and normalized by category;
 *  11. plan deletion cascading its threads and messages.
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
  listMentionableUsers,
  setCommentThreadResolved,
} from "../../lib/comments/comments.server";
import { normalizeBenefitCategoryKey } from "../../lib/comments/types";

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

    await createCommentThread({
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
    const mentionable = await listMentionableUsers({ organizationId });
    check(
      "the mentionable list includes the active teammate",
      mentionable.some((user) => user.userId === mentioneeLogin.id),
      `${mentionable.length} candidate(s)`,
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
    console.log("9. Resolve/Reopen and moderation");
    const resolved = await setCommentThreadResolved({
      organizationId,
      userId: owner.id,
      threadId: sectionThread.id,
      resolved: true,
    });
    check("the author resolves the thread", resolved.resolvedAt !== null);
    const reopened = await setCommentThreadResolved({
      organizationId,
      userId: owner.id,
      threadId: sectionThread.id,
      resolved: false,
    });
    check("the author reopens the thread", reopened.resolvedAt === null);
    check(
      "a non-author teammate cannot resolve someone else's thread",
      (await refusalCode(() =>
        setCommentThreadResolved({
          organizationId,
          userId: mentioneeLogin.id,
          threadId: sectionThread.id,
          resolved: true,
        }),
      )) === "comment_forbidden",
    );

    /* ── 10. Deleting a message and a thread ──────────────────────── */

    console.log("");
    console.log("10. Deleting messages and threads");
    const collabMessage = replied.messages.find(
      (message) => message.authorUserId === collabLogin.id,
    );
    if (!collabMessage) throw new Error("fixture: collaborator reply missing");
    await deleteCommentMessage({
      organizationId,
      userId: collabLogin.id,
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
