/**
 * organization-disclosures.server — the Organization's disclosures-review status
 * and the confirmation audit trail.
 *
 * Server-only. The status lives on `Organization` (org-wide, not per-user)
 * because the dashboard alert applies to the whole organization; every
 * confirmation also writes a `DisclosureAttestation` row recording who/when,
 * which template + attestation versions, and the context it came from.
 */

import prisma from "@/lib/prisma";
import { resolveOrganizationId } from "@/lib/organization";
import { isOwnerOrAdminOfOrganization } from "@/lib/teammates/access.server";
import {
  ATTESTATION_VERSION,
  DISCLOSURE_TEMPLATE_VERSION,
} from "@/config/onboarding/disclosures";
import {
  PLATFORM_DISCLOSURE_TEXT,
  splitDisclosureText,
} from "@/lib/disclaimer-constants";

/** Roles that may review/confirm the organization's disclosures. */
const REVIEWER_ROLES = ["owner", "admin", "editor"] as const;

/** Where a confirmation was made. */
export type DisclosureAttestationContext = "onboarding" | "settings" | "plan";

const VALID_CONTEXTS: readonly DisclosureAttestationContext[] = [
  "onboarding",
  "settings",
  "plan",
];

export function isDisclosureAttestationContext(
  value: unknown,
): value is DisclosureAttestationContext {
  return (
    typeof value === "string" &&
    (VALID_CONTEXTS as readonly string[]).includes(value)
  );
}

/**
 * May this viewer review the organization's disclosures? True for the Owner or an
 * Admin (via the shared helper), or a teammate holding an assignment at Editor
 * rank or above.
 */
export async function canReviewOrganizationDisclosures(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  if (await isOwnerOrAdminOfOrganization({ userId, organizationId })) return true;

  const profiles = await prisma.teammateProfile.findMany({
    where: { loginUserId: userId },
    select: { id: true },
  });
  if (profiles.length === 0) return false;

  const assignment = await prisma.planAssignment.findFirst({
    where: {
      profileId: { in: profiles.map((profile) => profile.id) },
      role: { in: [...REVIEWER_ROLES] },
    },
    select: { id: true },
  });
  return Boolean(assignment);
}

export interface OrganizationDisclosuresReview {
  organizationId: string;
  /** Has the organization's disclosure set been reviewed/confirmed? */
  reviewed: boolean;
  /** When it was last confirmed, if ever. */
  reviewedAt: string | null;
  /** May the current viewer review it? (Owner / Admin / Editor) */
  canReview: boolean;
}

/** Read the current review status and the viewer's eligibility. */
export async function getOrganizationDisclosuresReview(
  userId: string,
): Promise<OrganizationDisclosuresReview> {
  const organizationId = await resolveOrganizationId(userId);
  const [organization, canReview] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { disclosuresReviewed: true, disclosuresReviewedAt: true },
    }),
    canReviewOrganizationDisclosures(userId, organizationId),
  ]);
  return {
    organizationId,
    reviewed: Boolean(organization?.disclosuresReviewed),
    reviewedAt: organization?.disclosuresReviewedAt?.toISOString() ?? null,
    canReview,
  };
}

/**
 * Record a confirmation (attestation).
 *
 * When `disclosures` is supplied, a NEW `DisclosureVersion` (the revision being
 * confirmed) is written FIRST, then the organization is marked reviewed against
 * that revision. Without `disclosures`, the current revision is re-attested
 * (e.g. a plan-level reconfirmation).
 *
 * Returns false when the viewer may not review.
 */
export async function markOrganizationDisclosuresReviewed(
  userId: string,
  opts: {
    context: DisclosureAttestationContext;
    planId?: string | null;
    disclosures?: unknown;
  },
): Promise<boolean> {
  const organizationId = await resolveOrganizationId(userId);
  if (!(await canReviewOrganizationDisclosures(userId, organizationId))) {
    return false;
  }

  let version = await currentDisclosureVersion(organizationId);
  if (opts.disclosures !== undefined) {
    version = await writeDisclosureVersion(userId, organizationId, {
      disclosures: opts.disclosures,
      context: opts.context,
      planId: opts.planId ?? null,
    });
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.organization.update({
      where: { id: organizationId },
      data: { disclosuresReviewed: true, disclosuresReviewedAt: now },
    }),
    prisma.disclosureAttestation.create({
      data: {
        organizationId,
        userId,
        context: opts.context,
        planId: opts.planId ?? null,
        // The disclosure REVISION confirmed (see `DisclosureVersion`).
        disclosureVersion: version,
        attestationVersion: ATTESTATION_VERSION,
      },
    }),
  ]);
  return true;
}

/**
 * Record a disclosure EDIT as a new immutable revision and clear the reviewed
 * flag (re-attestation required). Returns the new version number, or null when
 * the viewer may not edit.
 */
export async function recordDisclosureVersion(
  userId: string,
  opts: {
    disclosures: unknown;
    context: DisclosureAttestationContext;
    planId?: string | null;
  },
): Promise<number | null> {
  const organizationId = await resolveOrganizationId(userId);
  if (!(await canReviewOrganizationDisclosures(userId, organizationId))) {
    return null;
  }
  return writeDisclosureVersion(userId, organizationId, {
    disclosures: opts.disclosures,
    context: opts.context,
    planId: opts.planId ?? null,
  });
}

async function currentDisclosureVersion(organizationId: string): Promise<number> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { disclosuresCurrentVersion: true },
  });
  return organization?.disclosuresCurrentVersion ?? 0;
}

/** Write the next immutable revision and clear the reviewed flag. */
async function writeDisclosureVersion(
  userId: string,
  organizationId: string,
  opts: {
    disclosures: unknown;
    context: DisclosureAttestationContext;
    planId: string | null;
  },
): Promise<number> {
  const next = (await currentDisclosureVersion(organizationId)) + 1;
  await prisma.$transaction([
    prisma.disclosureVersion.create({
      data: {
        organizationId,
        version: next,
        disclosures: opts.disclosures as any,
        templateVersion: DISCLOSURE_TEMPLATE_VERSION,
        createdByUserId: userId,
        context: opts.context,
        planId: opts.planId,
      },
    }),
    prisma.organization.update({
      where: { id: organizationId },
      data: {
        disclosuresCurrentVersion: next,
        // An edit invalidates the previous confirmation until re-attested.
        disclosuresReviewed: false,
        disclosuresReviewedAt: null,
      },
    }),
  ]);
  return next;
}

/**
 * Clear the reviewed flag (skip / an edit that needs re-attestation). Returns
 * false when the viewer may not review.
 */
export async function clearOrganizationDisclosuresReviewed(
  userId: string,
): Promise<boolean> {
  const organizationId = await resolveOrganizationId(userId);
  if (!(await canReviewOrganizationDisclosures(userId, organizationId))) {
    return false;
  }
  await prisma.organization.update({
    where: { id: organizationId },
    data: { disclosuresReviewed: false, disclosuresReviewedAt: null },
  });
  return true;
}

/**
 * The disclosure surfaces an advisor maintains, with the platform text that has
 * to be stripped to recover the "Your Disclosure" an advisor authored. Kept in
 * step with the two editor sections (Step 5b / Settings › Disclaimers).
 */
const LEDGER_SURFACES = [
  {
    location: "Benefits Hub / Client Website",
    label: "Benefits Hub Footer",
    platformText: PLATFORM_DISCLOSURE_TEXT as string,
  },
  {
    location: "Marketing Materials",
    label: "Flyer & Marketing",
    platformText: "Powered by PlanTelligence®",
  },
] as const;

export interface DisclosureLedgerSurface {
  /** The stored location this surface is keyed by. */
  location: string;
  label: string;
  /** The advisor-authored ("Your Disclosure") text for this surface. */
  text: string;
}

/** One token of a revision diff — a word, or a run of whitespace. */
export interface DisclosureDiffSegment {
  type: "added" | "removed" | "context";
  text: string;
}

/** The diff for one surface between a revision and the one before it. */
export interface DisclosureSurfaceChange {
  label: string;
  segments: DisclosureDiffSegment[];
  /** Changed non-whitespace tokens (word-level), for the +/- summary. */
  added: number;
  removed: number;
}

export interface DisclosureLedgerEntry {
  version: number;
  createdAt: string;
  context: DisclosureAttestationContext;
  planId: string | null;
  templateVersion: number;
  createdByName: string | null;
  /** When this revision was confirmed, if it ever was. */
  attestedAt: string | null;
  attestedByName: string | null;
  attestationVersion: number | null;
  /** The revision's full ("raw") text per surface. */
  surfaces: DisclosureLedgerSurface[];
  /** What this revision added/removed versus the previous one (git-commit style). */
  changes: DisclosureSurfaceChange[];
}

/**
 * A WORD-level LCS diff — git-commit style for the ledger, but granular enough
 * that changing a single word highlights only that word rather than the whole
 * paragraph. Whitespace runs travel as their own tokens so line breaks survive.
 *
 * An empty `previous` (the first revision) marks every token as added, which is
 * exactly what an initial commit looks like.
 */
const DIFF_TOKEN_PATTERN = /\s+|\S+/g;

function tokenizeForDiff(text: string): string[] {
  if (!text) return [];
  return text.match(DIFF_TOKEN_PATTERN) ?? [];
}

function buildWordDiff(
  previous: string,
  next: string,
): DisclosureDiffSegment[] {
  const a = tokenizeForDiff(previous);
  const b = tokenizeForDiff(next);
  const n = a.length;
  const m = b.length;

  // dp[i][j] = length of the LCS of a[i..] and b[j..]
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const segments: DisclosureDiffSegment[] = [];
  const push = (type: DisclosureDiffSegment["type"], text: string) => {
    // Never flag pure whitespace: an invisible highlight is worse than none, and
    // it keeps the spacing between two changed words from collapsing.
    segments.push({ type: text.trim() === "" ? "context" : type, text });
  };

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push("context", a[i]);
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push("removed", a[i]);
      i += 1;
    } else {
      push("added", b[j]);
      j += 1;
    }
  }
  while (i < n) {
    push("removed", a[i]);
    i += 1;
  }
  while (j < m) {
    push("added", b[j]);
    j += 1;
  }
  return segments;
}

export interface OrganizationDisclosureLedger {
  organizationId: string;
  currentVersion: number;
  reviewed: boolean;
  reviewedAt: string | null;
  canReview: boolean;
  /** Newest revision first. Empty when the viewer may not review. */
  entries: DisclosureLedgerEntry[];
}

/**
 * The Disclaimer Ledger: every immutable disclosure revision, with the
 * confirmation (attestation) that covers it, for Settings › Disclaimers.
 *
 * A revision is written on every EDIT and an attestation on every CONFIRMATION,
 * so pairing them by `disclosureVersion` answers the two questions the ledger
 * exists for — "what did we publish, and when?" and "who confirmed it, and when?".
 */
export async function listOrganizationDisclosureLedger(
  userId: string,
): Promise<OrganizationDisclosureLedger> {
  const organizationId = await resolveOrganizationId(userId);
  const [organization, canReview] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        disclosuresReviewed: true,
        disclosuresReviewedAt: true,
        disclosuresCurrentVersion: true,
      },
    }),
    canReviewOrganizationDisclosures(userId, organizationId),
  ]);

  const base: OrganizationDisclosureLedger = {
    organizationId,
    currentVersion: organization?.disclosuresCurrentVersion ?? 0,
    reviewed: Boolean(organization?.disclosuresReviewed),
    reviewedAt: organization?.disclosuresReviewedAt?.toISOString() ?? null,
    canReview,
    entries: [],
  };
  // The ledger is audit detail; a viewer who cannot review reads only the status.
  if (!canReview) return base;

  const [versions, attestations] = await Promise.all([
    prisma.disclosureVersion.findMany({
      where: { organizationId },
      orderBy: { version: "desc" },
      take: 100,
    }),
    prisma.disclosureAttestation.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const userIds = new Set<string>();
  for (const version of versions) userIds.add(version.createdByUserId);
  for (const attestation of attestations) userIds.add(attestation.userId);
  const users =
    userIds.size > 0
      ? await prisma.user.findMany({
          where: { id: { in: [...userIds] } },
          select: { id: true, name: true, email: true },
        })
      : [];
  const nameById = new Map(
    users.map((user) => [user.id, (user.name || "").trim() || user.email || null]),
  );

  // The LATEST confirmation of each revision is the one worth showing.
  const attestationByVersion = new Map<
    number,
    (typeof attestations)[number]
  >();
  for (const attestation of attestations) {
    if (!attestationByVersion.has(attestation.disclosureVersion)) {
      attestationByVersion.set(attestation.disclosureVersion, attestation);
    }
  }

  // Resolve every revision's surfaces first, so each can be diffed against the
  // one before it — the NEXT item in this newest-first array.
  const surfacesByVersion = new Map<number, DisclosureLedgerSurface[]>();
  for (const version of versions) {
    const stored = Array.isArray(version.disclosures)
      ? (version.disclosures as any[])
      : [];
    surfacesByVersion.set(
      version.version,
      LEDGER_SURFACES.map((surface) => {
        const found = stored.find(
          (row) =>
            row &&
            Array.isArray(row.locations) &&
            row.locations.includes(surface.location),
        );
        const text =
          found && typeof found.text === "string"
            ? splitDisclosureText(found.text, surface.platformText).your
            : "";
        return { location: surface.location, label: surface.label, text };
      }),
    );
  }

  const entries: DisclosureLedgerEntry[] = versions.map((version, index) => {
    const attestation = attestationByVersion.get(version.version) ?? null;
    const surfaces = surfacesByVersion.get(version.version) ?? [];
    const previousVersion = versions[index + 1];
    const previousSurfaces = previousVersion
      ? surfacesByVersion.get(previousVersion.version) ?? []
      : [];

    const changes: DisclosureSurfaceChange[] = surfaces.map((surface) => {
      const previous = previousSurfaces.find(
        (row) => row.location === surface.location,
      );
      const segments = buildWordDiff(previous?.text ?? "", surface.text);
      return {
        label: surface.label,
        segments,
        // Count only real words, so re-wrapping a paragraph does not read as a
        // wall of changes in the summary.
        added: segments.filter(
          (segment) => segment.type === "added" && segment.text.trim() !== "",
        ).length,
        removed: segments.filter(
          (segment) => segment.type === "removed" && segment.text.trim() !== "",
        ).length,
      };
    });

    return {
      version: version.version,
      createdAt: version.createdAt.toISOString(),
      context: version.context as DisclosureAttestationContext,
      planId: version.planId ?? null,
      templateVersion: version.templateVersion,
      createdByName: nameById.get(version.createdByUserId) ?? null,
      attestedAt: attestation?.createdAt.toISOString() ?? null,
      attestedByName: attestation
        ? nameById.get(attestation.userId) ?? null
        : null,
      attestationVersion: attestation?.attestationVersion ?? null,
      surfaces,
      changes,
    };
  });

  return { ...base, entries };
}
