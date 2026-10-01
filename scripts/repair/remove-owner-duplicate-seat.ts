/**
 * Repair — remove the Organization owner's duplicate Team seat.
 *
 *   npx tsx scripts/repair/remove-owner-duplicate-seat.ts [profileId] [--apply] [--release-allowance]
 *
 * Why this needs its own path: the owner is **not a teammate**. Their canonical
 * representation is `Organization.ownerUserId`, and `listOrgPeople` synthesizes their row
 * from it — so a `TeammateProfile` carrying the owner's own address can only be a
 * duplicate. It consumes a seat, and it renders a second time in Settings → People &
 * Access next to the synthesized owner row. The easiest way to create one was the "Give
 * Team Seat" button before it learned to skip the owner.
 *
 * The app refuses to remove it, correctly: `assertProfileIsNotOrganizationOwner` answers
 * 409 `owner_reserved_seat` ("The Owner's seat is reserved and cannot be removed") because
 * no *writer* may delete the owner. This is the repair path for a row that should never
 * have existed, not a supported user action.
 *
 * Defaults to a DRY RUN. `--apply` deletes the profile's assignments and then the profile
 * itself, after writing a JSON dump of every row it is about to remove to
 * `scripts/repair/backups/`, so the repair is reversible.
 *
 * Audit rows are deliberately KEPT. They are the record of what happened — "a seat was
 * granted on this date", "the allowance was raised" — and they carry plain scalar ids, so
 * they stay readable after the profile is gone. Only the seat and its plan access go.
 *
 * `--release-allowance` also lowers `Organization.seatsIncluded` by the number of seats
 * released. A confirmed over-limit add permanently raised it (`assertSeatAvailable` raises
 * it by one so the meter stays honest), and deleting the profile frees the seat but leaves
 * the allowance raised — so a 5-seat plan that confirmed an upgrade reads "1 of 6 used"
 * afterwards. Bounded by the seats actually in use, so it can never leave the meter
 * over-limit.
 *
 * What it refuses to touch, and why:
 *  - a profile whose email is not the owner's (that is a real teammate — use the app);
 *  - a profile linked to somebody else's login (`loginUserId` that is not the owner's);
 *  - a profile holding the organization's only `role: "owner"` assignment, which is the
 *    one-Owner invariant `removeAssignment` also protects.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { createPrisma, PROJECT_ROOT } from "../teammates/shared";

const ARGS = process.argv.slice(2);
const APPLY = ARGS.includes("--apply");
const RELEASE_ALLOWANCE = ARGS.includes("--release-allowance");
/** The profile to remove. Omitted means "report every owner duplicate there is". */
const TARGET_PROFILE_ID = ARGS.find((arg) => !arg.startsWith("--")) ?? null;

/**
 * Mirrors the constants in `lib/teammates/seats.server.ts`.
 *
 * Repeated rather than imported because that module constructs the app's Prisma client at
 * import time, and a script that is only reading two numbers should not open a second
 * connection it then has to remember to close.
 */
const INVITE_SEAT_HOLD_DAYS = 14;
const DEFAULT_SEATS_INCLUDED = 5;
const OWNER_CONSUMES_SEAT = true;

const BACKUP_DIR = path.join(PROJECT_ROOT, "scripts", "repair", "backups");

interface SeatSnapshot {
  seatsIncluded: number;
  seatsUsed: number;
  seatsAvailable: number;
  ownerSeat: number;
  seatsActive: number;
  seatsPending: number;
  atLimit: boolean;
}

/**
 * The seat meter for one organization, computed from the same rows `getSeatUsage` reads:
 * the owner counts as one, `type: "team_member"` rows count while live, and a pending
 * invite holds its seat for `INVITE_SEAT_HOLD_DAYS`.
 */
async function readSeatUsage(
  prisma: PrismaClient,
  organizationId: string,
): Promise<SeatSnapshot> {
  const [organization, profiles] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { ownerUserId: true, seatsIncluded: true },
    }),
    prisma.teammateProfile.findMany({
      where: { organizationId, type: "team_member" },
      select: { state: true, invitedAt: true, deactivatedAt: true },
    }),
  ]);

  const seatsIncluded = organization?.seatsIncluded ?? DEFAULT_SEATS_INCLUDED;
  const now = Date.now();
  const heldMs = INVITE_SEAT_HOLD_DAYS * 24 * 60 * 60 * 1000;
  let seatsActive = 0;
  let seatsPending = 0;

  for (const profile of profiles) {
    if (profile.deactivatedAt) continue;
    if (profile.state === "active") {
      seatsActive += 1;
      continue;
    }
    if (
      profile.state === "invited" &&
      profile.invitedAt &&
      now - profile.invitedAt.getTime() < heldMs
    ) {
      seatsPending += 1;
    }
  }

  const ownerSeat =
    OWNER_CONSUMES_SEAT && organization?.ownerUserId ? 1 : 0;
  const seatsUsed = ownerSeat + seatsActive + seatsPending;

  return {
    seatsIncluded,
    seatsUsed,
    seatsAvailable: Math.max(seatsIncluded - seatsUsed, 0),
    ownerSeat,
    seatsActive,
    seatsPending,
    atLimit: seatsUsed >= seatsIncluded,
  };
}

function seatLine(label: string, usage: SeatSnapshot): string {
  return (
    `  ${label.padEnd(7)} ${usage.seatsUsed} of ${usage.seatsIncluded} used ` +
    `(owner ${usage.ownerSeat}, active ${usage.seatsActive}, pending ${usage.seatsPending})` +
    `${usage.atLimit ? "  AT LIMIT" : ""}`
  );
}

interface OrganizationOwner {
  organizationId: string;
  organizationName: string;
  ownerUserId: string | null;
  ownerName: string;
  ownerEmails: string[];
}

/** Every organization with the owner's addresses, the same pair the mirror skips on. */
async function readOrganizationOwners(
  prisma: PrismaClient,
  organizationId?: string,
): Promise<OrganizationOwner[]> {
  const organizations = await prisma.organization.findMany({
    where: organizationId ? { id: organizationId } : undefined,
    select: { id: true, name: true, ownerUserId: true },
  });

  const ownerIds = organizations
    .map((organization) => organization.ownerUserId)
    .filter((id): id is string => Boolean(id));

  const owners =
    ownerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: ownerIds } },
          select: { id: true, name: true, email: true, organizationEmail: true },
        })
      : [];
  const ownerById = new Map(owners.map((owner) => [owner.id, owner]));

  return organizations.map((organization) => {
    const owner = organization.ownerUserId
      ? ownerById.get(organization.ownerUserId)
      : undefined;
    const ownerEmails = [owner?.email, owner?.organizationEmail]
      .filter((address): address is string => Boolean(address))
      .map((address) => address.trim().toLowerCase());
    return {
      organizationId: organization.id,
      organizationName: organization.name ?? "(unnamed)",
      ownerUserId: organization.ownerUserId,
      ownerName: owner?.name ?? "(owner User row missing)",
      ownerEmails: [...new Set(ownerEmails)],
    };
  });
}

interface Refusal {
  reason: string;
}

/**
 * Is this profile the owner's duplicate? Returns the refusal reason when it is anything
 * else, so the script never deletes a profile that merely looks suspicious.
 */
function assess(
  profile: {
    id: string;
    email: string;
    loginUserId: string | null;
    type: string;
    state: string;
    deactivatedAt: Date | null;
  },
  owner: OrganizationOwner,
): Refusal | null {
  const email = profile.email.trim().toLowerCase();
  const matchedEmail = owner.ownerEmails.includes(email);
  const matchedLogin =
    !!owner.ownerUserId && profile.loginUserId === owner.ownerUserId;

  if (!matchedEmail && !matchedLogin) {
    return {
      reason:
        `email ${profile.email} is not the owner's (${owner.ownerEmails.join(", ") || "none on file"}) ` +
        `and the profile is not linked to the owner's login. This is a real teammate — remove it in the app.`,
    };
  }

  if (profile.loginUserId && profile.loginUserId !== owner.ownerUserId) {
    return {
      reason:
        `the profile is linked to login ${profile.loginUserId}, which is not the organization's owner. ` +
        `Deleting it would remove somebody else's account link.`,
    };
  }

  return null;
}

async function describeTarget(
  prisma: PrismaClient,
  profileId: string,
): Promise<{ owner: OrganizationOwner; refusal: Refusal | null } | null> {
  const profile = await prisma.teammateProfile.findUnique({
    where: { id: profileId },
    select: { organizationId: true },
  });
  if (!profile) return null;

  const [owner] = await readOrganizationOwners(prisma, profile.organizationId);
  if (!owner) return null;

  const full = await prisma.teammateProfile.findUnique({
    where: { id: profileId },
    select: {
      id: true,
      email: true,
      loginUserId: true,
      type: true,
      state: true,
      deactivatedAt: true,
    },
  });
  if (!full) return null;

  return { owner, refusal: assess(full, owner) };
}

/** The connected host, so a wrong-database run is obvious rather than mysterious. */
function databaseHost(): string {
  const url = process.env.DATABASE_URL ?? "";
  const match = url.match(/@([^/:?]+)/);
  return match ? match[1] : "(unparsed)";
}

/** Every teammate table that could own the id a caller pasted, counted. */
async function locateId(
  prisma: PrismaClient,
  id: string,
): Promise<Record<string, number>> {
  const [organization, user, teammateCompany, teammateProfile, planAssignment, teammateAuditEvent] =
    await Promise.all([
      prisma.organization.count({ where: { id } }),
      prisma.user.count({ where: { id } }),
      prisma.teammateCompany.count({ where: { id } }),
      prisma.teammateProfile.count({ where: { id } }),
      prisma.planAssignment.count({ where: { id } }),
      prisma.teammateAuditEvent.count({ where: { id } }),
    ]);
  return {
    organization,
    user,
    teammateCompany,
    teammateProfile,
    planAssignment,
    teammateAuditEvent,
  };
}

/**
 * The profile the caller means.
 *
 * An id pasted from the UI is as likely to be an assignment id as a profile id — the
 * Collaborators list is built from assignments — so an assignment is followed to its
 * `profileId` rather than reported as "not found".
 */
async function resolveTargetProfileId(
  prisma: PrismaClient,
  id: string,
): Promise<{ profileId: string; via: string } | null> {
  const profile = await prisma.teammateProfile.findUnique({
    where: { id },
    select: { id: true },
  });
  if (profile) return { profileId: profile.id, via: "TeammateProfile.id" };

  const assignment = await prisma.planAssignment.findUnique({
    where: { id },
    select: { profileId: true },
  });
  if (assignment) {
    return {
      profileId: assignment.profileId,
      via: `PlanAssignment.id (plan ${assignment.profileId} belongs to a profile)`,
    };
  }

  return null;
}

async function main(): Promise<void> {
  const prisma = createPrisma();

  try {
    console.log("Remove the Organization owner's duplicate Team seat");
    console.log("");
    console.log(`  database : ${databaseHost()}`);
    console.log(`  target   : ${TARGET_PROFILE_ID ?? "(every owner duplicate)"}`);
    console.log(`  mode     : ${APPLY ? "APPLY (deletes)" : "dry run"}`);
    console.log(`  allowance: ${RELEASE_ALLOWANCE ? "release freed seats" : "leave as is"}`);
    console.log("");

    /* ── Which profiles are the owner's duplicate? ─────────────────────────────── */

    const owners = await readOrganizationOwners(prisma);
    const candidates: { profileId: string; owner: OrganizationOwner; refusal: Refusal | null }[] = [];

    if (TARGET_PROFILE_ID) {
      const resolved = await resolveTargetProfileId(prisma, TARGET_PROFILE_ID);
      if (!resolved) {
        console.error(`  ABORT: ${TARGET_PROFILE_ID} is not a row in any teammate table here.`);
        const located = await locateId(prisma, TARGET_PROFILE_ID);
        const elsewhere = Object.entries(located).filter(([, count]) => count > 0);
        if (elsewhere.length === 0) {
          console.error(
            "         It matches nothing on this database either — check that DATABASE_URL " +
              "points at the environment you saw the row in (a `.env.local` is NOT read here).",
          );
        } else {
          for (const [table, count] of elsewhere) {
            console.error(`         ${table}: ${count}`);
          }
        }
        process.exitCode = 1;
        return;
      }
      if (resolved.via !== "TeammateProfile.id") {
        console.log(`  note: ${TARGET_PROFILE_ID} is a ${resolved.via}`);
        console.log(`        → using profile ${resolved.profileId}`);
        console.log("");
      }
      const described = await describeTarget(prisma, resolved.profileId);
      if (!described) {
        console.error(`  ABORT: no TeammateProfile ${resolved.profileId} in any organization.`);
        process.exitCode = 1;
        return;
      }
      candidates.push({ profileId: resolved.profileId, ...described });
    } else {
      for (const owner of owners) {
        if (owner.ownerEmails.length === 0 && !owner.ownerUserId) continue;
        const profiles = await prisma.teammateProfile.findMany({
          where: {
            organizationId: owner.organizationId,
            OR: [
              ...owner.ownerEmails.map((address) => ({
                email: { equals: address, mode: "insensitive" as const },
              })),
              ...(owner.ownerUserId ? [{ loginUserId: owner.ownerUserId }] : []),
            ],
          },
          select: {
            id: true,
            email: true,
            loginUserId: true,
            type: true,
            state: true,
            deactivatedAt: true,
          },
        });
        for (const profile of profiles) {
          candidates.push({
            profileId: profile.id,
            owner,
            refusal: assess(profile, owner),
          });
        }
      }
    }

    if (candidates.length === 0) {
      const organizations = await prisma.organization.count();
      console.log("  Nothing to do: no profile carries an organization owner's address.");
      console.log(
        `  (${organizations} organization(s) on this database — if that count is not what you expect, DATABASE_URL is pointing somewhere else.)`,
      );
      return;
    }

    /* ── Report, and refuse anything that is not unmistakably a duplicate ──────── */

    let removedSeats = 0;
    let appliedCount = 0;

    for (const candidate of candidates) {
      const profile = await prisma.teammateProfile.findUnique({
        where: { id: candidate.profileId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          type: true,
          state: true,
          loginUserId: true,
          invitedAt: true,
          deactivatedAt: true,
          createdAt: true,
        },
      });
      if (!profile) continue;

      const name =
        [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
        profile.email;
      console.log(`  ── ${profile.id}`);
      console.log(`     ${name} <${profile.email}>`);
      console.log(
        `     type=${profile.type} state=${profile.state} ` +
          `login=${profile.loginUserId ?? "none"} ` +
          `invited=${profile.invitedAt?.toISOString() ?? "never"} ` +
          `deactivated=${profile.deactivatedAt?.toISOString() ?? "no"}`,
      );
      console.log(`     organization: ${candidate.owner.organizationName} (${candidate.owner.organizationId})`);
      console.log(`     owner:        ${candidate.owner.ownerName}`);

      if (candidate.refusal) {
        console.error(`     REFUSED: ${candidate.refusal.reason}`);
        process.exitCode = 1;
        console.log("");
        continue;
      }

      const assignments = await prisma.planAssignment.findMany({
        where: { profileId: profile.id },
        select: { id: true, clientId: true, role: true, categoryScope: true },
      });

      // The one-Owner invariant: `removeAssignment` refuses to drop the last
      // role="owner" assignment, and so does this.
      const ownerAssignments = assignments.filter((row) => row.role === "owner");
      if (ownerAssignments.length > 0) {
        const otherOwnerAssignments = await prisma.planAssignment.count({
          where: {
            organizationId: candidate.owner.organizationId,
            role: "owner",
            profileId: { not: profile.id },
          },
        });
        if (otherOwnerAssignments === 0) {
          console.error(
            "     REFUSED: this profile holds the organization's only Owner assignment. " +
              "Transfer ownership in the app first.",
          );
          process.exitCode = 1;
          console.log("");
          continue;
        }
      }

      const auditRows = await prisma.teammateAuditEvent.findMany({
        where: { profileId: profile.id },
        select: { id: true, action: true, createdAt: true },
      });

      console.log(`     assignments:  ${assignments.length}`);
      for (const assignment of assignments) {
        console.log(
          `       ${assignment.id}  plan ${assignment.clientId}  role ${assignment.role}  ${assignment.categoryScope}`,
        );
      }
      console.log(`     audit rows:   ${auditRows.length} (kept)`);

      const before = await readSeatUsage(prisma, candidate.owner.organizationId);
      console.log(seatLine("before", before));

      // The seats this row will free: only a live team_member holds one.
      const holdsSeat =
        profile.type === "team_member" && !profile.deactivatedAt;
      console.log(`     seat held: ${holdsSeat ? "yes" : "no"}`);

      if (!APPLY) {
        console.log("     dry run — re-run with --apply to remove it");
        console.log("");
        continue;
      }

      /* ── Back up, then delete ─────────────────────────────────────────────────── */

      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      const backupPath = path.join(
        BACKUP_DIR,
        `owner-duplicate-seat-${profile.id}-${Date.now()}.json`,
      );
      fs.writeFileSync(
        backupPath,
        JSON.stringify(
          {
            removedAt: new Date().toISOString(),
            reason:
              "TeammateProfile carrying an Organization owner's address (owner duplicates)",
            organization: candidate.owner,
            profile,
            assignments,
            auditRows,
            seatsBefore: before,
          },
          null,
          2,
        ),
        "utf-8",
      );
      console.log(`     backed up → ${path.relative(PROJECT_ROOT, backupPath)}`);

      const deletedAssignments = await prisma.planAssignment.deleteMany({
        where: { profileId: profile.id },
      });
      await prisma.teammateProfile.delete({ where: { id: profile.id } });
      console.log(
        `     deleted: ${deletedAssignments.count} assignment(s) and the profile`,
      );

      const after = await readSeatUsage(prisma, candidate.owner.organizationId);
      console.log(seatLine("after", after));

      if (RELEASE_ALLOWANCE && holdsSeat && before.seatsUsed > after.seatsUsed) {
        // Never below what is now in use: the meter must not read over-limit as a result
        // of a repair.
        const released = before.seatsUsed - after.seatsUsed;
        const target = Math.max(after.seatsUsed, before.seatsIncluded - released);
        if (target < before.seatsIncluded) {
          await prisma.organization.update({
            where: { id: candidate.owner.organizationId },
            data: { seatsIncluded: target },
          });
          console.log(
            `     allowance: ${before.seatsIncluded} → ${target} (released ${released})`,
          );
        } else {
          console.log("     allowance: already at the seats in use — left unchanged");
        }
      }

      if (holdsSeat) removedSeats += 1;
      appliedCount += 1;
      console.log("");
    }

    console.log(
      APPLY
        ? `  Done. ${appliedCount} profile(s) removed, ${removedSeats} seat(s) released.`
        : "  Dry run finished. Nothing was changed.",
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error("Repair failed:", error);
  process.exitCode = 1;
});
