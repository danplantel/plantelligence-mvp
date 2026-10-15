/**
 * notifications.server — persisted in-app notifications.
 *
 * The header bell's other two sources (meeting reminders, expiring documents) are
 * DERIVED from plan state on every fetch and dismissed in the browser. These are
 * persisted rows addressed to a specific `User`, each with its own read state, so a
 * notification survives a reload and is per-person rather than per-device.
 *
 * That difference is also why DELETING one is a write here rather than a browser dismissal: a derived
 * reminder cannot be deleted — it would be recomputed on the very next fetch, which is why the bell
 * can only close it locally — whereas a notification is a row that can genuinely go.
 *
 * Server-only.
 */

import prisma from "@/lib/prisma";

/** The one notification kind shipped today; the UI keys its icon/group off it. */
export const TEAM_MEMBER_ACCEPTED_TYPE = "team_member_accepted";

/** Somebody deleted their own account and an Owner/Admin has yet to confirm it. */
export const PROFILE_SELF_DELETED_TYPE = "profile_self_deleted";

/** Where a "team member accepted" notification sends the reader. */
const MEMBERS_DEEP_LINK = "/settings?tab=members";

/**
 * Where a self-deleted COLLABORATOR is confirmed.
 *
 * The page rather than the plan, deliberately: a collaborator can hold assignments on several
 * plans and the marker is per PERSON, so a single-target link would be right for exactly one of
 * them. The Bell is a pointer to the surface; the card on each plan's Contacts step is where the
 * work actually is.
 */
const BENEFITS_DEEP_LINK = "/benefits";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  /** ISO string, or null when unread. */
  readAt: string | null;
  createdAt: string;
}

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 50;

function toItem(row: {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
}): NotificationItem {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    href: row.href,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createNotification(input: {
  organizationId: string;
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  href?: string | null;
  profileId?: string | null;
  actorUserId?: string | null;
}): Promise<void> {
  await prisma.notification.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
      profileId: input.profileId ?? null,
      actorUserId: input.actorUserId ?? null,
    },
  });
}

/** The caller's own notifications, newest first, plus their unread count. */
export async function listNotifications(input: {
  userId: string;
  organizationId: string;
  limit?: number;
}): Promise<{ items: NotificationItem[]; unreadCount: number }> {
  const take = Math.min(
    Math.max(input.limit ?? DEFAULT_LIST_LIMIT, 1),
    MAX_LIST_LIMIT,
  );

  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: input.userId, organizationId: input.organizationId },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        href: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({
      where: {
        userId: input.userId,
        organizationId: input.organizationId,
        readAt: null,
      },
    }),
  ]);

  return { items: rows.map(toItem), unreadCount };
}

/** Mark one notification read. Scoped by `userId` so nobody can read another's. */
export async function markNotificationRead(input: {
  id: string;
  userId: string;
}): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { id: input.id, userId: input.userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}

/**
 * Delete one notification. Scoped by `userId`, so a row addressed to somebody else is simply not
 * found — the same rule `markNotificationRead` follows, and the reason this uses `deleteMany` rather
 * than `delete`: an id that is not the caller's answers "0 removed" instead of throwing.
 *
 * Returns the number of rows removed (0 when it was not theirs, or already gone).
 */
export async function deleteNotification(input: {
  id: string;
  userId: string;
}): Promise<number> {
  const result = await prisma.notification.deleteMany({
    where: { id: input.id, userId: input.userId },
  });
  return result.count;
}

/** Mark every unread notification for this user read. */
export async function markAllNotificationsRead(input: {
  userId: string;
  organizationId: string;
}): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: {
      userId: input.userId,
      organizationId: input.organizationId,
      readAt: null,
    },
    data: { readAt: new Date() },
  });
  return result.count;
}

/**
 * Tell the organization's internal members that an invited person accepted.
 *
 * Recipients are the Owner plus every ACTIVE Team Member who can sign in — the four
 * internal roles (Owner/Admin/Editor/Viewer). Collaborators are excluded by `type`
 * (they are outside the organization), deactivated members are excluded (no access),
 * and the person who just accepted is excluded — nobody needs a notification about
 * themselves.
 *
 * @returns how many notifications were written (0 for a Collaborator acceptance).
 */
export async function notifyTeamMemberAccepted(input: {
  organizationId: string;
  profileId: string;
  actorUserId: string;
}): Promise<number> {
  const [organization, profile] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { ownerUserId: true },
    }),
    prisma.teammateProfile.findFirst({
      where: { id: input.profileId, organizationId: input.organizationId },
      select: {
        id: true,
        type: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    }),
  ]);

  // Only Team Member acceptances notify; a Collaborator is outside the organization.
  if (!profile || profile.type !== "team_member") return 0;

  const memberName =
    [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim() ||
    profile.email;

  const teammates = await prisma.teammateProfile.findMany({
    where: {
      organizationId: input.organizationId,
      type: "team_member",
      state: "active",
      deactivatedAt: null,
      loginUserId: { not: null },
    },
    select: { loginUserId: true },
  });

  const recipients = new Set<string>();
  if (organization?.ownerUserId) recipients.add(organization.ownerUserId);
  for (const teammate of teammates) {
    if (teammate.loginUserId) recipients.add(teammate.loginUserId);
  }
  recipients.delete(input.actorUserId);
  if (recipients.size === 0) return 0;

  await prisma.notification.createMany({
    data: [...recipients].map((userId) => ({
      organizationId: input.organizationId,
      userId,
      type: TEAM_MEMBER_ACCEPTED_TYPE,
      title: `${memberName} accepted their invitation`,
      body: `${memberName} is now a Team Member of your organization.`,
      href: MEMBERS_DEEP_LINK,
      profileId: profile.id,
      actorUserId: input.actorUserId,
    })),
  });

  return recipients.size;
}

/**
 * Tell the organization's Owner and Admins that somebody deleted their own account.
 *
 * OWNER + ADMIN, and nobody else. The confirmation this asks for is a management action —
 * `org_settings` — so notifying an Editor or a Viewer would point them at a screen they cannot
 * act on. "Admin" is the same rule `isOwnerOrAdminOfOrganization` applies (an assignment carrying
 * the Owner or Admin preset), read here in ONE pass over the candidates rather than asked per
 * person, because the roster is small and every recipient needs the same answer.
 *
 * Written for BOTH kinds: a Team Member's seat and a Collaborator's assignment set are each left
 * behind by a self-deletion, and each is confirmed on the surface that owns the person — so the
 * deep link differs, and the body says which review is being asked for.
 *
 * @returns how many notifications were written (0 when there is nobody to tell).
 */
export async function notifySelfDeletedProfile(input: {
  organizationId: string;
  profileId: string;
  actorUserId?: string | null;
}): Promise<number> {
  const [organization, profile] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { ownerUserId: true },
    }),
    prisma.teammateProfile.findFirst({
      where: { id: input.profileId, organizationId: input.organizationId },
      select: {
        id: true,
        type: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    }),
  ]);
  if (!profile) return 0;

  const memberName =
    [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim() ||
    profile.email;

  // The candidates: every live Team Member with a login. Collaborators are excluded by `type`
  // (they cannot act on this), deactivated members by their marker, and a seat with no login by
  // having nobody to deliver to — the same three filters the acceptance notification applies.
  const candidates = await prisma.teammateProfile.findMany({
    where: {
      organizationId: input.organizationId,
      type: "team_member",
      state: "active",
      deactivatedAt: null,
      loginUserId: { not: null },
    },
    select: { id: true, loginUserId: true },
  });

  const adminRows =
    candidates.length > 0
      ? await prisma.planAssignment.findMany({
          where: {
            organizationId: input.organizationId,
            profileId: { in: candidates.map((candidate) => candidate.id) },
            role: { in: ["owner", "admin"] },
          },
          select: { profileId: true },
        })
      : [];
  const adminProfileIds = new Set(adminRows.map((row) => row.profileId));

  const recipients = new Set<string>();
  if (organization?.ownerUserId) recipients.add(organization.ownerUserId);
  for (const candidate of candidates) {
    if (adminProfileIds.has(candidate.id) && candidate.loginUserId) {
      recipients.add(candidate.loginUserId);
    }
  }
  // Nobody needs telling about themselves. The two cannot overlap in the deletion flow (the
  // actor's login is being removed), but a repair script can pass any acting user it likes.
  if (input.actorUserId) recipients.delete(input.actorUserId);
  if (recipients.size === 0) return 0;

  const kind = profile.type === "collaborator" ? "Collaborator" : "Team Member";

  await prisma.notification.createMany({
    data: [...recipients].map((userId) => ({
      organizationId: input.organizationId,
      userId,
      type: PROFILE_SELF_DELETED_TYPE,
      title: `${memberName} deleted their profile`,
      body: `Their access is still in place. Confirm the deletion to remove them as a ${kind}.`,
      href:
        profile.type === "collaborator" ? BENEFITS_DEEP_LINK : MEMBERS_DEEP_LINK,
      profileId: profile.id,
      actorUserId: input.actorUserId ?? null,
    })),
  });

  return recipients.size;
}
