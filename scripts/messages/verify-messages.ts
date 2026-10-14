/**
 * Direct message verification — the private 1:1 rail.
 *
 *   npx tsx scripts/messages/verify-messages.ts [--keep]
 *
 * Exercises the REAL data layer end-to-end (`lib/messages/*`), which is where every rule lives:
 *
 *   1. the directory — who may be messaged, and who may not;
 *   2. the gate — membership, participation with NO admin override, self-threads;
 *   3. one thread per pair, whichever order the two ids arrive in, enforced by a CHECK;
 *   4. unread — the read watermark, in both directions;
 *   5. the coalesced Bell row — five messages, one row;
 *   6. send validation and the body limit's exact boundary;
 *   7. withdrawal — author only, leaving a placeholder;
 *   8. the attachment guard, which must never defer to the object route's org-level fallback;
 *   9. account deletion cascading the conversation away;
 *  10. "load earlier" paging — the page boundary, the cursor, and the exhausted tail;
 *  11. "currently typing" — the peer's side only, self-expiry, and cleared on send;
 *  12. the conversation list's typing poll — every conversation at once, never the reader's own;
 *  13. the MARK beside the bit — a peer's own message retiring dots a poll would still show.
 *
 * Fixtures are `tdm-verify-*` and are cleaned up unless `--keep` is passed.
 */
import {
  check,
  createPrisma,
  failureCount,
  installFixtureGuards,
  summary,
  sweepStaleFixtures,
} from "../teammates/shared";
import { getOrCreateOrganizationForUser } from "../../lib/organization";
import { createTeammateProfile } from "../../lib/teammates/profiles.server";
import { upsertAssignment } from "../../lib/teammates/assignments.server";
import { TeammateDataError } from "../../lib/teammates/errors";
import {
  DIRECT_MESSAGE_NOTIFICATION_TYPE,
  MAX_DIRECT_MESSAGE_LENGTH,
  directAttachmentPrefix,
  newestMessageAt,
  typingMarkStands,
} from "../../lib/messages/types";
import { listDirectDirectory } from "../../lib/messages/directory.server";
import {
  getDirectThread,
  getDirectTyping,
  listDirectThreads,
  listTypingThreadIds,
  markDirectThreadRead,
  markDirectTyping,
  openDirectThread,
  resolveDirectAttachmentAccess,
  sendDirectMessage,
  withdrawDirectMessage,
} from "../../lib/messages/messages.server";

const KEEP_FIXTURES = process.argv.includes("--keep");
const STAMP = Date.now();

/**
 * Run an expected refusal and report its stable code.
 *
 * Anything that is not a `TeammateDataError` is reported as `unexpected: …` rather than counted as
 * a pass — a connection blip must never look like a refusal. That mistake has already been made
 * once in this feature's short life (see the plan's phase 1 findings).
 */
async function refusalCode(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return "(no error)";
  } catch (error) {
    if (error instanceof TeammateDataError) return error.code ?? String(error.status);
    return `unexpected: ${(error as Error).message}`;
  }
}

/** Does this directory entry exist as selectable? */
function isSelectable(
  entries: { userId: string | null; selectable: boolean }[],
  userId: string,
): boolean {
  return entries.some((entry) => entry.userId === userId && entry.selectable);
}

async function main(): Promise<void> {
  const prisma = createPrisma();

  installFixtureGuards(prisma, { exceptStamps: [STAMP] });
  await sweepStaleFixtures(prisma, { exceptStamps: [STAMP] });

  const created = {
    userIds: [] as string[],
    profileIds: [] as string[],
    clientIds: [] as string[],
    organizationIds: [] as string[],
  };

  try {
    console.log("Messages verification — direct messages");
    console.log("");

    /* ── Fixtures ─────────────────────────────────────────────────── */

    const owner = await prisma.user.create({
      data: {
        name: `TDM Verify Advisor ${STAMP}`,
        email: `tdm-verify-owner-${STAMP}@example.test`,
        organizationName: `TDM Verify Org ${STAMP}`,
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
        companyName: `TDM Plan A ${STAMP}`,
        slug: `tdm-verify-a-${STAMP}`,
        status: "Active",
        keyContacts: [],
      },
      select: { id: true },
    });
    const planB = await prisma.client.create({
      data: {
        userId: owner.id,
        organizationId,
        companyName: `TDM Plan B ${STAMP}`,
        slug: `tdm-verify-b-${STAMP}`,
        status: "Active",
        keyContacts: [],
      },
      select: { id: true },
    });
    created.clientIds.push(planA.id, planB.id);

    /** A user + an active seat, which is the shape every member needs. */
    const seat = async (input: {
      label: string;
      type: "collaborator" | "team_member";
      plans?: { clientId: string; role: "contributor" | "viewer" | "editor" }[];
      role?: "contributor" | "viewer";
    }) => {
      const login = await prisma.user.create({
        data: {
          name: `TDM ${input.label} ${STAMP}`,
          email: `tdm-verify-${input.label.toLowerCase()}-${STAMP}@example.test`,
        },
        select: { id: true },
      });
      created.userIds.push(login.id);

      const profile = await createTeammateProfile({
        organizationId,
        actorUserId: owner.id,
        type: input.type,
        role: input.role ?? null,
        email: `tdm-verify-${input.label.toLowerCase()}-${STAMP}@abbenefits.test`,
        firstName: input.label,
        lastName: "TDM",
        loginUserId: login.id,
      });
      created.profileIds.push(profile.id);

      // `createTeammateProfile` leaves a new seat unaccepted; the directory only lists ACTIVE
      // seats, so every fixture has to be activated exactly as acceptance would.
      await prisma.teammateProfile.update({
        where: { id: profile.id },
        data: { state: "active" },
      });

      for (const assignment of input.plans ?? []) {
        await upsertAssignment({
          organizationId,
          profileId: profile.id,
          clientId: assignment.clientId,
          actorUserId: owner.id,
          role: assignment.role,
          categoryScope: "all",
        });
      }

      return { loginId: login.id, profileId: profile.id };
    };

    // Two collaborators who SHARE plan A, one who is only on plan B, and an internal teammate.
    const cora = await seat({
      label: "Cora",
      type: "collaborator",
      plans: [{ clientId: planA.id, role: "contributor" }],
    });
    const carl = await seat({
      label: "Carl",
      type: "collaborator",
      plans: [{ clientId: planA.id, role: "viewer" }],
    });
    const dana = await seat({
      label: "Dana",
      type: "collaborator",
      plans: [{ clientId: planB.id, role: "viewer" }],
    });
    const tara = await seat({ label: "Tara", type: "team_member" });

    // A seat that has been invited but has no login yet, and one that has been deactivated.
    const pendingProfile = await createTeammateProfile({
      organizationId,
      actorUserId: owner.id,
      type: "collaborator",
      email: `tdm-verify-pending-${STAMP}@abbenefits.test`,
      firstName: "Pat",
      lastName: "Pending",
    });
    created.profileIds.push(pendingProfile.id);
    // `invited` is the realistic state of an outstanding invitation — and the one the directory
    // lists greyed. (`contact` is deliberately NOT listed; see `isDirectorySeat`.)
    await prisma.teammateProfile.update({
      where: { id: pendingProfile.id },
      data: { state: "invited" },
    });

    const gary = await seat({
      label: "Gary",
      type: "collaborator",
      plans: [{ clientId: planA.id, role: "contributor" }],
    });
    await prisma.teammateProfile.update({
      where: { id: gary.profileId },
      data: { deactivatedAt: new Date() },
    });

    /* ── 1. The directory ─────────────────────────────────────────── */

    console.log("1. Who may be messaged");

    const ownerDirectory = await listDirectDirectory({
      organizationId,
      viewerUserId: owner.id,
    });
    check(
      "the owner may reach every active seat with a login",
      isSelectable(ownerDirectory, cora.loginId) &&
        isSelectable(ownerDirectory, carl.loginId) &&
        isSelectable(ownerDirectory, dana.loginId) &&
        isSelectable(ownerDirectory, tara.loginId),
    );
    check(
      "…and is not offered themselves",
      !ownerDirectory.some((entry) => entry.userId === owner.id),
    );
    check(
      "a seat with no login is LISTED but not selectable, so the picker can explain itself",
      ownerDirectory.some(
        (entry) => entry.name.startsWith("Pat") && entry.selectable === false,
      ),
    );
    check(
      "a deactivated seat is not in the directory at all",
      !ownerDirectory.some((entry) => entry.userId === gary.loginId),
    );

    const coraDirectory = await listDirectDirectory({
      organizationId,
      viewerUserId: cora.loginId,
    });
    check(
      "a Collaborator may reach the owner and the firm's Team Member",
      isSelectable(coraDirectory, owner.id) && isSelectable(coraDirectory, tara.loginId),
    );
    check(
      "…and another Collaborator who SHARES a plan",
      isSelectable(coraDirectory, carl.loginId),
    );
    check(
      "…but NOT one who is only on a plan they cannot see",
      !isSelectable(coraDirectory, dana.loginId),
    );

    const danaDirectory = await listDirectDirectory({
      organizationId,
      viewerUserId: dana.loginId,
    });
    check(
      "and the test is mutual: Dana cannot reach Cora either",
      !isSelectable(danaDirectory, cora.loginId),
    );

    /* ── 2. The gate ──────────────────────────────────────────────── */

    console.log("");
    console.log("2. The gate — membership, participation, and no admin override");

    const coraCarl = await openDirectThread({
      organizationId,
      userId: cora.loginId,
      otherUserId: carl.loginId,
    });
    check("two Collaborators sharing a plan can open a conversation", Boolean(coraCarl.threadId));

    check(
      "a thread with yourself is refused",
      (await refusalCode(() =>
        openDirectThread({
          organizationId,
          userId: cora.loginId,
          otherUserId: cora.loginId,
        }),
      )) === "self_thread",
    );
    check(
      "opening a conversation with someone outside the directory is refused",
      (await refusalCode(() =>
        openDirectThread({
          organizationId,
          userId: cora.loginId,
          otherUserId: dana.loginId,
        }),
      )) === "not_in_directory",
    );

    // THE assertion this feature turns on. The owner is the organization's Owner — `assertCanModerate`
    // would let them resolve or delete any comment thread — and they still cannot read this one.
    check(
      "the organization's OWNER is refused a thread between two other people",
      (await refusalCode(() =>
        getDirectThread({
          organizationId,
          userId: owner.id,
          threadId: coraCarl.threadId,
        }),
      )) === "not_a_participant",
    );
    check(
      "…and cannot send into it either",
      (await refusalCode(() =>
        sendDirectMessage({
          organizationId,
          userId: owner.id,
          threadId: coraCarl.threadId,
          body: "not mine to read",
        }),
      )) === "not_a_participant",
    );
    check(
      "…nor withdraw somebody else's message from it",
      (await refusalCode(() =>
        withdrawDirectMessage({
          organizationId,
          userId: owner.id,
          messageId: "any-id-at-all",
        }),
      )) === "message_not_found",
    );

    // An unrelated login with no seat at all cannot tell a real thread from an invented one.
    const stranger = await prisma.user.create({
      data: {
        name: `TDM Stranger ${STAMP}`,
        email: `tdm-verify-stranger-${STAMP}@example.test`,
      },
      select: { id: true },
    });
    created.userIds.push(stranger.id);
    check(
      "a login with no seat in the organization is refused as a non-member",
      (await refusalCode(() =>
        getDirectThread({
          organizationId,
          userId: stranger.id,
          threadId: coraCarl.threadId,
        }),
      )) === "not_a_member",
    );

    /* ── 3. One thread per pair ───────────────────────────────────── */

    console.log("");
    console.log("3. One conversation per pair, whichever order the ids arrive in");

    const swapped = await openDirectThread({
      organizationId,
      userId: carl.loginId,
      otherUserId: cora.loginId,
    });
    check(
      "opening from the other side finds the SAME thread",
      swapped.threadId === coraCarl.threadId,
      `${swapped.threadId} vs ${coraCarl.threadId}`,
    );

    let duplicateRefusal = "";
    try {
      const [userAId, userBId] = [cora.loginId, carl.loginId].sort();
      await prisma.directThread.create({
        data: { organizationId, userAId, userBId },
      });
    } catch (error) {
      duplicateRefusal = (error as { code?: string }).code ?? "";
    }
    check(
      "the compound unique refuses a second row for the same pair",
      duplicateRefusal === "P2002",
      duplicateRefusal,
    );

    // The CHECK constraint, and why the identification matters: Prisma leaves a CHECK violation as
    // an UNMAPPED driver error, so no P-code can confirm it — only the constraint's own name can.
    let unorderedRefusal = "";
    try {
      const [userAId, userBId] = [cora.loginId, carl.loginId].sort();
      await prisma.directThread.create({
        data: { organizationId, userAId: userBId, userBId: userAId },
      });
      unorderedRefusal = "(the write was ALLOWED)";
    } catch (error) {
      const message = (error as Error).message ?? "";
      unorderedRefusal = message.includes("DirectThread_pair_order_check")
        ? "CHECK"
        : (error as { code?: string }).code || (error as Error).name;
    }
    check(
      "a NON-CANONICAL pair is refused by the CHECK constraint, by name",
      unorderedRefusal === "CHECK",
      unorderedRefusal,
    );

    /* ── 4. Sending, unread, and the watermark ────────────────────── */

    console.log("");
    console.log("4. Sending, unread, and the read watermark");

    check(
      "an empty body with no attachments is refused",
      (await refusalCode(() =>
        sendDirectMessage({
          organizationId,
          userId: cora.loginId,
          threadId: coraCarl.threadId,
          body: "   ",
        }),
      )) === "message_empty",
    );

    const boundaryBody = "x".repeat(MAX_DIRECT_MESSAGE_LENGTH);
    check(
      `exactly ${MAX_DIRECT_MESSAGE_LENGTH} characters is accepted`,
      Boolean(
        (
          await sendDirectMessage({
            organizationId,
            userId: cora.loginId,
            threadId: coraCarl.threadId,
            body: boundaryBody,
          })
        ).id,
      ),
    );
    check(
      "one character more is refused",
      (await refusalCode(() =>
        sendDirectMessage({
          organizationId,
          userId: cora.loginId,
          threadId: coraCarl.threadId,
          body: `${boundaryBody}x`,
        }),
      )) === "message_too_long",
    );

    await sendDirectMessage({
      organizationId,
      userId: cora.loginId,
      threadId: coraCarl.threadId,
      body: "second",
    });
    await sendDirectMessage({
      organizationId,
      userId: cora.loginId,
      threadId: coraCarl.threadId,
      body: "third",
    });
    await sendDirectMessage({
      organizationId,
      userId: cora.loginId,
      threadId: coraCarl.threadId,
      body: "fourth",
    });
    await sendDirectMessage({
      organizationId,
      userId: cora.loginId,
      threadId: coraCarl.threadId,
      body: "fifth",
    });

    const carlInbox = await listDirectThreads({
      organizationId,
      userId: carl.loginId,
    });
    const carlConversation = carlInbox.conversations.find(
      (conversation) => conversation.threadId === coraCarl.threadId,
    );
    check(
      "the recipient sees every message as unread",
      carlConversation?.unreadCount === 5,
      String(carlConversation?.unreadCount),
    );
    check(
      "and the inbox total matches",
      carlInbox.unreadTotal === 5,
      String(carlInbox.unreadTotal),
    );
    check(
      "the conversation list carries the preview and the newest sender",
      carlConversation?.lastMessagePreview === "fifth" &&
        carlConversation?.lastMessageByUserId === cora.loginId,
      String(carlConversation?.lastMessagePreview),
    );

    const coraInbox = await listDirectThreads({
      organizationId,
      userId: cora.loginId,
    });
    check(
      "the SENDER has nothing unread — their own messages never count for them",
      coraInbox.unreadTotal === 0,
      String(coraInbox.unreadTotal),
    );

    await markDirectThreadRead({
      organizationId,
      userId: carl.loginId,
      threadId: coraCarl.threadId,
    });
    const afterRead = await listDirectThreads({
      organizationId,
      userId: carl.loginId,
    });
    check(
      "marking read clears the count",
      afterRead.unreadTotal === 0,
      String(afterRead.unreadTotal),
    );

    await sendDirectMessage({
      organizationId,
      userId: cora.loginId,
      threadId: coraCarl.threadId,
      body: "after the watermark",
    });
    const afterNewMessage = await listDirectThreads({
      organizationId,
      userId: carl.loginId,
    });
    check(
      "…and only the message sent AFTER the watermark counts",
      afterNewMessage.unreadTotal === 1,
      String(afterNewMessage.unreadTotal),
    );

    /* ── 5. The coalesced Bell row ────────────────────────────────── */

    console.log("");
    console.log("5. One Bell row per conversation, not one per message");

    // A FRESH conversation, with deliberately no read in between. The invariant is "at most one
    // UNREAD row per conversation", and reading in the middle legitimately starts a new one — that
    // is the feature, not a leak: you want a fresh alert once you have read up to date. Measuring
    // the thread above would test that earlier read rather than the coalescing.
    const ownerTara = await openDirectThread({
      organizationId,
      userId: owner.id,
      otherUserId: tara.loginId,
    });
    for (const line of ["one", "two", "three", "four", "five"]) {
      await sendDirectMessage({
        organizationId,
        userId: owner.id,
        threadId: ownerTara.threadId,
        body: line,
      });
    }

    const rowsBeforeRead = await prisma.notification.findMany({
      where: { userId: tara.loginId, type: DIRECT_MESSAGE_NOTIFICATION_TYPE },
      orderBy: { createdAt: "desc" },
      select: { body: true, href: true, readAt: true },
    });
    check(
      "five messages produced exactly ONE row",
      rowsBeforeRead.length === 1,
      String(rowsBeforeRead.length),
    );
    check(
      "and it previews the NEWEST message rather than the first",
      rowsBeforeRead[0]?.body === "five",
      String(rowsBeforeRead[0]?.body),
    );
    check(
      "the row deep-links to that conversation",
      rowsBeforeRead[0]?.href === `/?messages=${ownerTara.threadId}`,
      String(rowsBeforeRead[0]?.href),
    );

    await markDirectThreadRead({
      organizationId,
      userId: tara.loginId,
      threadId: ownerTara.threadId,
    });
    const unreadBells = await prisma.notification.count({
      where: {
        userId: tara.loginId,
        type: DIRECT_MESSAGE_NOTIFICATION_TYPE,
        readAt: null,
      },
    });
    check(
      "reading the conversation clears its Bell row",
      unreadBells === 0,
      String(unreadBells),
    );

    // …and a message sent AFTER that read is a NEW row, because the previous one is spent.
    await sendDirectMessage({
      organizationId,
      userId: owner.id,
      threadId: ownerTara.threadId,
      body: "after reading",
    });
    const rowsAfterSecond = await prisma.notification.findMany({
      where: { userId: tara.loginId, type: DIRECT_MESSAGE_NOTIFICATION_TYPE },
      orderBy: { createdAt: "desc" },
      select: { body: true, readAt: true },
    });
    check(
      "a message sent after a read starts a fresh unread row",
      rowsAfterSecond.length === 2 && rowsAfterSecond[0]?.readAt === null,
      `${rowsAfterSecond.length} rows, newest read=${String(rowsAfterSecond[0]?.readAt)}`,
    );

    /* ── 6. Withdrawal ────────────────────────────────────────────── */

    console.log("");
    console.log("6. Withdrawal is author-only");

    const toWithdraw = await sendDirectMessage({
      organizationId,
      userId: cora.loginId,
      threadId: coraCarl.threadId,
      body: "delete me",
    });
    check(
      "another participant cannot withdraw it",
      (await refusalCode(() =>
        withdrawDirectMessage({
          organizationId,
          userId: carl.loginId,
          messageId: toWithdraw.id,
        }),
      )) === "not_the_author",
    );

    await withdrawDirectMessage({
      organizationId,
      userId: cora.loginId,
      messageId: toWithdraw.id,
    });
    const withdrawn = await getDirectThread({
      organizationId,
      userId: cora.loginId,
      threadId: coraCarl.threadId,
    });
    const withdrawnView = withdrawn.messages.find((m) => m.id === toWithdraw.id);
    check(
      "the author's withdrawal leaves a placeholder rather than a hole",
      Boolean(withdrawnView?.deletedAt) && withdrawnView?.body === "",
      String(withdrawnView?.body),
    );
    check(
      "…and the thread still reads as a conversation",
      withdrawn.messages.length > 5,
      String(withdrawn.messages.length),
    );
    const previewAfterWithdraw = await prisma.directThread.findUnique({
      where: { id: coraCarl.threadId },
      select: { lastMessagePreview: true },
    });
    check(
      "withdrawing the NEWEST message recomputes the stored preview",
      previewAfterWithdraw?.lastMessagePreview === "Message deleted",
      String(previewAfterWithdraw?.lastMessagePreview),
    );

    /* ── 7. The attachment guard ──────────────────────────────────── */

    console.log("");
    console.log("7. Attachment reads follow participation, never the org fallback");

    const key = `${directAttachmentPrefix(organizationId, coraCarl.threadId)}${STAMP}-report.pdf`;
    check(
      "a participant is allowed the object",
      (await resolveDirectAttachmentAccess({ userId: carl.loginId, key }))?.allowed === true,
    );
    const ownerAttachment = await resolveDirectAttachmentAccess({ userId: owner.id, key });
    check(
      "the organization's owner is REFUSED it — the generic path would have allowed them",
      ownerAttachment?.allowed === false && ownerAttachment.reason === "not_a_participant",
      JSON.stringify(ownerAttachment),
    );
    check(
      "a key naming no thread is refused rather than passed along",
      (await resolveDirectAttachmentAccess({
        userId: owner.id,
        key: `org/${organizationId}/messages/no-such-thread/file.pdf`,
      }))?.allowed === false,
    );
    check(
      "a comment key is left alone for the generic check",
      (await resolveDirectAttachmentAccess({
        userId: owner.id,
        key: `org/${owner.id}/plans/${planA.id}/comments/file.pdf`,
      })) === null,
    );

    /* ── 8. Cascade ───────────────────────────────────────────────── */

    console.log("");
    console.log("8. Deleting a login takes the conversation with it");

    const doomed = await prisma.user.create({
      data: {
        name: `TDM Doomed ${STAMP}`,
        email: `tdm-verify-doomed-${STAMP}@example.test`,
      },
      select: { id: true },
    });
    const doomedThread = await prisma.directThread.create({
      data: {
        organizationId,
        ...(() => {
          const [userAId, userBId] = [doomed.id, owner.id].sort();
          return { userAId, userBId };
        })(),
        messages: { create: { authorUserId: doomed.id, body: "hello" } },
      },
      select: { id: true },
    });
    await prisma.user.delete({ where: { id: doomed.id } });
    const survivingThreads = await prisma.directThread.count({
      where: { id: doomedThread.id },
    });
    const survivingMessages = await prisma.directMessage.count({
      where: { threadId: doomedThread.id },
    });
    check(
      "the thread and its messages are gone",
      survivingThreads === 0 && survivingMessages === 0,
      `${survivingThreads} / ${survivingMessages}`,
    );

    /* ── 9. "Load earlier" paging ─────────────────────────────────── */

    console.log("");
    console.log("9. Load earlier — the page boundary and the cursor");

    // A dedicated conversation with MORE than one page, seeded directly so the timestamps are
    // deterministic: 55 rows, one second apart. Driving this through `sendDirectMessage` would be 55
    // round trips and could cluster messages into the same millisecond, which the strict
    // `createdAt <` cursor would then skip.
    const paging = await openDirectThread({
      organizationId,
      userId: owner.id,
      otherUserId: carl.loginId,
    });
    const PAGE_SEED = 55;
    const seedBase = Date.now() - PAGE_SEED * 1000;
    await prisma.directMessage.createMany({
      data: Array.from({ length: PAGE_SEED }, (_, index) => ({
        threadId: paging.threadId,
        authorUserId: carl.loginId,
        body: `page-${index}`,
        createdAt: new Date(seedBase + index * 1000),
      })),
    });

    const firstPage = await getDirectThread({
      organizationId,
      userId: owner.id,
      threadId: paging.threadId,
    });
    check(
      "a conversation longer than one page returns exactly the page size and says there is more",
      firstPage.messages.length === 50 && firstPage.hasEarlier === true,
      `${firstPage.messages.length} / hasEarlier=${firstPage.hasEarlier}`,
    );

    // The cursor continues from the OLDEST message shown — the first element of an oldest-first page.
    const oldestShown = firstPage.messages[0];
    const secondPage = await getDirectThread({
      organizationId,
      userId: owner.id,
      threadId: paging.threadId,
      before: oldestShown.createdAt,
    });
    check(
      "the cursor returns the remainder and reports the history exhausted",
      secondPage.messages.length === PAGE_SEED - 50 && secondPage.hasEarlier === false,
      `${secondPage.messages.length} / hasEarlier=${secondPage.hasEarlier}`,
    );

    const firstIds = new Set(firstPage.messages.map((message) => message.id));
    check(
      "the two pages do not overlap, and together they are the whole conversation",
      secondPage.messages.every((message) => !firstIds.has(message.id)) &&
        firstIds.size + secondPage.messages.length === PAGE_SEED,
      `${firstIds.size} + ${secondPage.messages.length}`,
    );

    const beforeEverything = await getDirectThread({
      organizationId,
      userId: owner.id,
      threadId: paging.threadId,
      before: new Date(seedBase - 60_000).toISOString(),
    });
    check(
      "a cursor older than the whole conversation is an empty, exhausted page",
      beforeEverything.messages.length === 0 && beforeEverything.hasEarlier === false,
      `${beforeEverything.messages.length} / hasEarlier=${beforeEverything.hasEarlier}`,
    );

    /* ── 10. "Currently typing" ───────────────────────────────────── */

    console.log("");
    console.log("10. Currently typing — the peer's side only, self-expiring");

    await markDirectTyping({
      organizationId,
      userId: carl.loginId,
      threadId: paging.threadId,
    });
    check(
      "a typing ping lights the OTHER participant's indicator, and not the sender's own",
      (await getDirectTyping({ organizationId, userId: owner.id, threadId: paging.threadId }))
        .typing === true &&
        (await getDirectTyping({ organizationId, userId: carl.loginId, threadId: paging.threadId }))
          .typing === false,
    );

    // The BIT is the TTL's answer; the MARK is what lets the rail retire dots that a message has
    // already made a lie. Both travel, because the polls are not in step — without the mark the
    // "N new messages" pill can appear above a bubble still claiming its author is typing.
    const peerTypingRead = await getDirectTyping({
      organizationId,
      userId: owner.id,
      threadId: paging.threadId,
    });
    check(
      "the typing read carries the MARK as well as the bit",
      peerTypingRead.typing === true &&
        typeof peerTypingRead.typingAt === "string" &&
        !Number.isNaN(new Date(peerTypingRead.typingAt).getTime()),
      JSON.stringify(peerTypingRead),
    );

    const readWithMark = await getDirectThread({
      organizationId,
      userId: owner.id,
      threadId: paging.threadId,
    });
    check(
      "…and the thread read carries it too, for the polls that have not answered yet",
      readWithMark.peerTyping === true && typeof readWithMark.peerTypingAt === "string",
      JSON.stringify({
        peerTyping: readWithMark.peerTyping,
        peerTypingAt: readWithMark.peerTypingAt,
      }),
    );

    // The timestamp IS the mechanism, so an old one must read as "not typing" — that is what makes
    // the indicator self-healing with no "stopped typing" event. Both sides are set so the
    // assertion does not depend on which of the pair the fixture's login turned out to be.
    await prisma.directThread.update({
      where: { id: paging.threadId },
      data: {
        aTypingAt: new Date(Date.now() - 60_000),
        bTypingAt: new Date(Date.now() - 60_000),
      },
    });
    check(
      "the signal expires on its own once the timestamp is stale",
      (await getDirectTyping({ organizationId, userId: owner.id, threadId: paging.threadId }))
        .typing === false,
    );

    await markDirectTyping({
      organizationId,
      userId: carl.loginId,
      threadId: paging.threadId,
    });
    await sendDirectMessage({
      organizationId,
      userId: carl.loginId,
      threadId: paging.threadId,
      body: "typing ends here",
    });
    check(
      "sending a message clears the sender's own typing signal",
      (await getDirectTyping({ organizationId, userId: owner.id, threadId: paging.threadId }))
        .typing === false,
    );

    // The rule the rail applies across the two reads at once: a message of theirs newer than the mark
    // retires them, whatever the polls happen to be showing. Synthetic timestamps, so the assertion
    // cannot be sensitive to clock skew between the application and the database.
    const markAt = new Date(Date.now() - 5_000).toISOString();
    check(
      "a peer message newer than their mark retires the dots; an older one leaves them standing",
      typingMarkStands(
        markAt,
        newestMessageAt(
          [{ authorUserId: carl.loginId, createdAt: new Date().toISOString() }],
          carl.loginId,
        ),
      ) === false &&
        typingMarkStands(
          markAt,
          newestMessageAt(
            [
              {
                authorUserId: carl.loginId,
                createdAt: new Date(Date.now() - 10_000).toISOString(),
              },
            ],
            carl.loginId,
          ),
        ) === true,
    );

    check(
      "a non-participant cannot write the typing signal",
      (await refusalCode(() =>
        markDirectTyping({
          organizationId,
          userId: owner.id,
          threadId: coraCarl.threadId,
        }),
      )) === "not_a_participant",
    );
    check(
      "…nor read it",
      (await refusalCode(() =>
        getDirectTyping({
          organizationId,
          userId: owner.id,
          threadId: coraCarl.threadId,
        }),
      )) === "not_a_participant",
    );

    /* ── 11. The conversation list's typing poll ──────────────────── */

    console.log("");
    console.log("11. Currently typing — the conversation list");

    await markDirectTyping({
      organizationId,
      userId: carl.loginId,
      threadId: paging.threadId,
    });
    check(
      "the list marks the conversation whose PEER is typing",
      (await listTypingThreadIds({ organizationId, userId: owner.id })).includes(
        paging.threadId,
      ),
    );
    check(
      "…and never one the READER is typing in — your own ping cannot paint your own list",
      !(await listTypingThreadIds({ organizationId, userId: carl.loginId })).includes(
        paging.threadId,
      ),
    );

    await prisma.directThread.update({
      where: { id: paging.threadId },
      data: {
        aTypingAt: new Date(Date.now() - 60_000),
        bTypingAt: new Date(Date.now() - 60_000),
      },
    });
    check(
      "an expired ping drops out of the list",
      !(await listTypingThreadIds({ organizationId, userId: owner.id })).includes(
        paging.threadId,
      ),
    );

    check(
      "a non-member is refused the list",
      (await refusalCode(() =>
        listTypingThreadIds({ organizationId, userId: stranger.id }),
      )) === "not_a_member",
    );
  } finally {
    if (!KEEP_FIXTURES) {
      await prisma.directThread.deleteMany({
        where: { organizationId: { in: created.organizationIds } },
      });
      await prisma.notification.deleteMany({
        where: { userId: { in: created.userIds } },
      });
      await prisma.planAssignment.deleteMany({
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
      console.log(`Fixtures kept (--keep). Stamp: ${STAMP}`);
    }

    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    summary("Messages verification");
    if (failureCount() > 0) process.exitCode = 1;
  })
  .catch((error) => {
    console.error("Messages verification crashed:", error);
    process.exitCode = 1;
  });
