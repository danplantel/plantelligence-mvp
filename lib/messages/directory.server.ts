/**
 * directory.server — who a member may start a Direct Message with.
 *
 * THE ONE PREDICATE. The picker lists exactly what this module returns, and a thread can only be
 * opened with someone it returns as `selectable` — `canMessageUser` is defined as a lookup in that
 * same list rather than as a second implementation of the rule. That is deliberate: a picker that
 * offers someone the API then refuses is the exact failure the @mention candidate list already had
 * to close once (see `listMentionableUsers` in lib/comments/comments.server.ts), and the fix then
 * was the same — one predicate, two callers.
 *
 * The rule (plans/direct-messages.md, decision 2):
 *
 *  - an INTERNAL member — the organization's Owner, or anyone holding a `team_member` seat — may
 *    message anyone in the organization;
 *  - a COLLABORATOR may message the Owner and every Team Member, plus any other Collaborator who
 *    shares at least one accessible plan with them.
 *
 * The plan-sharing test is what stops a Collaborator opening a conversation with a stranger: two
 * external providers can reach each other only when they are working on the same plan. It is
 * `listAccessiblePlanIds` for the viewer's side — the same "which plans may I see" call every plan
 * picker in the app uses — rather than a fresh reading of the assignment table.
 *
 * Server-only.
 */

import prisma from "@/lib/prisma";
import { listAccessiblePlanIds } from "@/lib/teammates/access.server";
import type {
  TeammateAssignmentRole,
  TeammatePersonType,
  TeammateProfileState,
} from "@/types/teammate";
import {
  DIRECT_PERSON_KIND_LABELS,
  type DirectDirectoryEntry,
  type DirectPersonKind,
} from "./types";

/**
 * A seat, as this module needs it.
 *
 * `loginUserId` is the whole point of the type: a seat without one is a person who has been
 * invited but has no account yet, and there is nobody to deliver a message to. They are still
 * listed (see `listDirectDirectory`) so the advisor can see why.
 */
interface SeatRow {
  id: string;
  type: TeammatePersonType;
  loginUserId: string | null;
  role: TeammateAssignmentRole | null;
  state: TeammateProfileState;
  deactivatedAt: Date | null;
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  email: string;
  headshot: string | null;
}

const SEAT_SELECT = {
  id: true,
  type: true,
  loginUserId: true,
  role: true,
  state: true,
  deactivatedAt: true,
  firstName: true,
  lastName: true,
  jobTitle: true,
  email: true,
  headshot: true,
} as const;

/**
 * A MEMBER: accepted, and not deactivated.
 *
 * The roster's own definition — the same conditions `listMentionableUsers` filters on, so a person
 * who cannot appear in an @mention list is not a member here either. This is what decides whether
 * the viewer may use messages at all, and who they may SEND to. A deactivated person keeps the
 * threads they are already in (history is not theirs to lose) but cannot be messaged anew.
 */
function isMemberSeat(seat: Pick<SeatRow, "state" | "deactivatedAt">): boolean {
  return seat.state === "active" && !seat.deactivatedAt;
}

/**
 * A DIRECTORY seat: someone this organization has INVITED or accepted.
 *
 * Deliberately wider than a member and much narrower than "every profile". An outstanding
 * invitation (state `invited`) is LISTED — greyed as "Invite pending" — because the alternative is
 * an advisor who just invited somebody wondering why the directory does not know them.
 *
 * `contact` is deliberately EXCLUDED: those profiles are the plan contacts the contacts mirror
 * creates (plan-sponsor HR, provider reps, recordkeeper teams). Listing them would turn a message
 * directory into a list of people who have no account and were never invited anywhere.
 */
function isDirectorySeat(seat: Pick<SeatRow, "state" | "deactivatedAt">): boolean {
  if (seat.deactivatedAt) return false;
  return seat.state === "active" || seat.state === "invited";
}

/** The organization's own record of a person's name, with the login as the fallback. */
function seatName(
  seat: SeatRow,
  login: { name: string | null; email: string } | undefined,
): string {
  const fromProfile = [seat.firstName, seat.lastName]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return fromProfile || login?.name?.trim() || login?.email || seat.email;
}

interface DirectorySnapshot {
  ownerUserId: string | null;
  seats: SeatRow[];
  viewerSeat: SeatRow | null;
  /** True when the viewer is the Owner or holds a `team_member` seat. */
  viewerIsInternal: boolean;
}

/**
 * The two reads every question in this module starts from: who owns the organization, and what
 * seats it has.
 *
 * Loaded whole rather than filtered in SQL because an organization's roster is small (the same
 * reasoning `listMentionableUsers` gives), and because the viewer's own standing has to be decided
 * from the same rows that decide everyone else's.
 */
async function loadSnapshot(input: {
  organizationId: string;
  viewerUserId: string;
}): Promise<DirectorySnapshot> {
  const [organization, seats] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { ownerUserId: true },
    }),
    prisma.teammateProfile.findMany({
      where: { organizationId: input.organizationId },
      select: SEAT_SELECT,
    }),
  ]);

  const ownerUserId = organization?.ownerUserId ?? null;
  const viewerSeat =
    seats
      .filter(isMemberSeat)
      .find((seat) => seat.loginUserId === input.viewerUserId) ?? null;

  return {
    ownerUserId,
    // Directory seats, not member seats: an outstanding invitation belongs in the list (see the
    // note on `isDirectorySeat`), while `viewerSeat` above stays on the stricter member test.
    seats: seats.filter(isDirectorySeat),
    viewerSeat,
    viewerIsInternal:
      ownerUserId === input.viewerUserId || viewerSeat?.type === "team_member",
  };
}

/**
 * Is this login a member of the organization — the Owner, or the holder of a live seat?
 *
 * Rule 1 of `resolveDirectAccess`. Exported on its own because "may you use messages at all?" and
 * "may you message THIS person?" are different questions, and a refusal should say which one it
 * was.
 */
export async function isDirectOrgMember(input: {
  organizationId: string;
  userId: string;
}): Promise<boolean> {
  const snapshot = await loadSnapshot({
    organizationId: input.organizationId,
    viewerUserId: input.userId,
  });
  return snapshot.viewerIsInternal || snapshot.viewerSeat !== null;
}

/**
 * Everyone this viewer may start a conversation with, plus the seats they may not yet.
 *
 * The Owner comes from `Organization.ownerUserId` rather than from a seat, because the Owner holds
 * none — the same asymmetry `/api/profile/header` and `listMentionableUsers` both handle.
 */
export async function listDirectDirectory(input: {
  organizationId: string;
  viewerUserId: string;
}): Promise<DirectDirectoryEntry[]> {
  const snapshot = await loadSnapshot(input);
  const { ownerUserId, seats, viewerIsInternal } = snapshot;

  // Not a member at all: an empty directory, and `resolveDirectAccess` refuses before this is
  // ever rendered. Answering with the list rather than throwing keeps this function usable as a
  // plain "what would I see" read.
  const isMember = viewerIsInternal || snapshot.viewerSeat !== null;
  if (!isMember) return [];

  // EVERY directory seat except the viewer — including the ones with no login, which are listed so
  // the picker can show them greyed. Filtering them out here would make `selectable: false`
  // unreachable and hide exactly the case the greyed row exists to explain.
  const candidates = seats.filter(
    (seat) => seat.loginUserId !== input.viewerUserId,
  );

  // A Collaborator needs the VIEWER's plan list to answer "does this person share a plan?" — and
  // an internal viewer needs none of this, so neither query runs for them.
  let viewerPlanIds = new Set<string>();
  let plansBySeatId = new Map<string, Set<string>>();

  if (!viewerIsInternal) {
    const collaboratorIds = candidates
      .filter((seat) => seat.type === "collaborator")
      .map((seat) => seat.id);

    const [planIds, assignments] = await Promise.all([
      listAccessiblePlanIds(input.viewerUserId),
      collaboratorIds.length > 0
        ? prisma.planAssignment.findMany({
            where: { profileId: { in: collaboratorIds } },
            select: { profileId: true, clientId: true },
          })
        : Promise.resolve([] as { profileId: string; clientId: string }[]),
    ]);

    viewerPlanIds = new Set(planIds);
    plansBySeatId = new Map<string, Set<string>>();
    for (const assignment of assignments) {
      const plans = plansBySeatId.get(assignment.profileId) ?? new Set<string>();
      plans.add(assignment.clientId);
      plansBySeatId.set(assignment.profileId, plans);
    }
  }

  /** May the viewer message this seat? Internals may reach everyone; a Collaborator may not. */
  const seatIsSelectable = (seat: SeatRow): boolean => {
    if (viewerIsInternal) return true;
    if (seat.type === "team_member") return true;
    const shared = plansBySeatId.get(seat.id);
    if (!shared) return false;
    for (const planId of shared) {
      if (viewerPlanIds.has(planId)) return true;
    }
    return false;
  };

  // One query for every name, headshot and email this list needs — the logins, not the profiles,
  // because the mail is addressed to an account.
  const loginUserIds = candidates
    .map((seat) => seat.loginUserId)
    .filter((id): id is string => Boolean(id));
  const logins = new Map<string, { name: string | null; email: string; headshot: string | null }>();
  if (loginUserIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: loginUserIds } },
      select: { id: true, name: true, email: true, headshot: true },
    });
    for (const user of users) {
      logins.set(user.id, {
        name: user.name,
        email: user.email,
        headshot: user.headshot,
      });
    }
  }

  const entries: DirectDirectoryEntry[] = [];

  // The Owner first — they hold no seat, so they are not in `candidates`.
  if (ownerUserId && ownerUserId !== input.viewerUserId) {
    const owner = await prisma.user.findUnique({
      where: { id: ownerUserId },
      select: { name: true, email: true, headshot: true },
    });
    if (owner) {
      entries.push({
        userId: ownerUserId,
        name: owner.name?.trim() || owner.email,
        email: owner.email,
        headshot: owner.headshot ?? null,
        kind: "owner",
        label: DIRECT_PERSON_KIND_LABELS.owner,
        selectable: true,
      });
    }
  }

  for (const seat of candidates) {
    const login = seat.loginUserId ? logins.get(seat.loginUserId) : undefined;
    // A seat whose login row has gone missing is treated like an unaccepted invitation: the seat
    // is real, the account is not.
    const kind: DirectPersonKind =
      seat.type === "team_member" ? "team_member" : "collaborator";
    entries.push({
      // Null when there is nobody to deliver to — an invitation that has not been accepted. The
      // picker renders these as "Invite pending" and cannot offer them.
      userId: login ? seat.loginUserId : null,
      name: seatName(seat, login),
      email: login?.email ?? seat.email,
      headshot: login?.headshot ?? seat.headshot ?? null,
      kind,
      label: DIRECT_PERSON_KIND_LABELS[kind],
      selectable: Boolean(login) && seatIsSelectable(seat),
    });
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * May `viewerUserId` open a conversation with `otherUserId`?
 *
 * Defined by ASKING THE DIRECTORY rather than by re-deriving the rule, so the picker and the gate
 * cannot answer differently. It costs one directory build per thread opened, which is a handful of
 * indexed reads against a roster that fits in one page.
 */
export async function canMessageUser(input: {
  organizationId: string;
  viewerUserId: string;
  otherUserId: string;
}): Promise<boolean> {
  if (!input.otherUserId || input.otherUserId === input.viewerUserId) return false;

  const directory = await listDirectDirectory({
    organizationId: input.organizationId,
    viewerUserId: input.viewerUserId,
  });

  return directory.some(
    (entry) => entry.selectable && entry.userId === input.otherUserId,
  );
}
