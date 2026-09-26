/**
 * invites.server — T4: invite a Collaborator from Create Benefits.
 *
 * Spec parts this module owns (T4 Part B):
 *  1. "Who is this?" → preset. The table lives in `types/teammate.ts` so the
 *     dialog and this writer share one mapping.
 *  2. The domain guess: an address on the plan sponsor's own domain suggests
 *     "Plan Sponsor HR".
 *  3. The invite email deep-links to the assigned section and lists the fields
 *     that are still missing — computed with the SAME completeness check the
 *     category card renders, so the email cannot describe a different section
 *     state than the card the advisor clicked.
 *  5. An email that already has a profile in this organization reuses it.
 *
 * Three things it deliberately never does:
 *  - it never runs the T3 seat check. Only Team Members consume seats, and this
 *    entry point is collaborator-only;
 *  - it never widens the plan scope. The invite is pinned to the ONE plan and the
 *    ONE category it was raised from (T4 Part A item 2), and All Plans stays out
 *    of reach because T2a hides it for Collaborators;
 *  - it never converts a Team Member. That email already holds a seat, so the
 *    invite is refused with a pointer at Settings → Team Members rather than
 *    quietly changing someone's access from a benefits screen.
 *
 * Server-only. Every function takes an explicit `organizationId`.
 */

import prisma from "@/lib/prisma";
import { TeammateDataError } from "./errors";
import { recordTeammateAuditEvent } from "./audit.server";
import { getAssignment, upsertAssignment } from "./assignments.server";
import {
  createTeammateProfile,
  findProfileByEmail,
  upgradeContactToInvited,
} from "./profiles.server";
import { emailDomain } from "./seats.server";
import { getBenefitCompleteness } from "@/lib/benefit-completeness";
import { categoryToSlug } from "@/lib/benefit-category-slug";
import { sendCollaboratorInviteEmail } from "@/lib/email";
import {
  labelForWhoIsThisContext,
  roleForWhoIsThisContext,
  type TeammateAssignmentRole,
  type TeammateCategoryScope,
  type TeammatePersonType,
  type TeammateProfileState,
  type WhoIsThisContext,
} from "@/types/teammate";

/**
 * Read the T4 invite columns off an assignment row.
 *
 * `inviteNote` / `inviteDueDate` are real columns — added to `PlanAssignment` with
 * T4 and present in the generated client (`npx prisma generate` has run, and
 * `node_modules/.prisma/client/index.d.ts` declares both). Reading them straight off
 * the row nevertheless fails to type-check for a TS server still holding the
 * pre-generate copy of `@prisma/client`, and TypeScript does not watch
 * `node_modules`, so that copy survives until the editor reloads.
 *
 * The parameter is therefore `unknown` and the values are narrowed at runtime,
 * which makes this correct under EITHER the stale or the fresh client:
 *  - a stale row has neither property → both resolve to `null`;
 *  - a fresh row has a `string | null` and a `Date | null` → they pass through.
 *
 * `unknown` (rather than an all-optional object shape) is deliberate: an
 * all-optional parameter type is a "weak type" in TypeScript, so passing a row type
 * that shares no properties with it is an error — which is exactly the stale-client
 * case this exists to survive.
 */
function inviteMetaOf(row: unknown): {
  inviteNote: string | null;
  inviteDueDate: Date | null;
} {
  const value = (row ?? {}) as { inviteNote?: unknown; inviteDueDate?: unknown };
  return {
    inviteNote: typeof value.inviteNote === "string" ? value.inviteNote : null,
    inviteDueDate:
      value.inviteDueDate instanceof Date ? value.inviteDueDate : null,
  };
}

/** Matches the normalization `/api/benefits` uses to pair a card with its Benefit row. */
function normalizeCategory(value: string | null | undefined): string {
  return (value || "").toLowerCase().trim().replace(/\s+/g, " ");
}

/** Same precedence as the rest of the mailers (see lib/email.ts). */
function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    ""
  ).replace(/\/$/, "");
}

/** `yyyy-mm-dd` from a date input → a UTC date at midnight. Null when absent/invalid. */
function parseDueDate(value: string | null | undefined): Date | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * The plan, scoped to the organization. Throws rather than returning null: every
 * caller here would otherwise have to invent 404 handling.
 *
 * No `select` — `getBenefitCompleteness` reads many columns off the row, and
 * `/api/benefits` passes the full client for the same reason.
 */
async function loadPlan(organizationId: string, clientId: string) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId },
  });
  if (!client) {
    throw new TeammateDataError("Plan not found in this organization.", 404);
  }
  return client;
}

/* ─────────────────────────── Domain guess ─────────────────────────── */

/**
 * Domains that identify the PLAN SPONSOR (spec Part B item 2): the plan's own
 * website, plus the domains of its key contacts — an HR contact's address is the
 * sponsor's domain in practice even when no website was entered.
 *
 * Distinct from `getOrganizationDomains`, which describes the ADVISOR's firm and
 * drives the T3 Team-Member guess. A sponsor domain must never make someone a
 * Team Member.
 */
export async function planSponsorDomains({
  organizationId,
  clientId,
}: {
  organizationId: string;
  clientId: string;
}): Promise<string[]> {
  const plan = await prisma.client.findFirst({
    where: { id: clientId, organizationId },
    select: { companyWebsite: true, keyContacts: true },
  });
  if (!plan) return [];

  const domains = new Set<string>();

  const website = (plan.companyWebsite ?? "").trim();
  if (website) {
    const host = website
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split(/[/?#]/)[0];
    // Reuse the same domain parsing the seat guess uses, so both agree on what a
    // domain is (`emailDomain` lower-cases and rejects malformed addresses).
    const domain = emailDomain(`x@${host}`);
    if (domain) domains.add(domain);
  }

  const contacts = Array.isArray(plan.keyContacts)
    ? (plan.keyContacts as unknown as Record<string, unknown>[])
    : [];
  for (const contact of contacts) {
    const value = typeof contact?.email === "string" ? contact.email : null;
    const domain = emailDomain(value);
    if (domain) domains.add(domain);
  }

  return [...domains];
}

/**
 * T4 Part B item 2, as data rather than copy: the dialog pre-selects the answer
 * and shows the reason, so the advisor can always override the guess.
 */
export async function suggestWhoIsThisContext({
  organizationId,
  clientId,
  email,
}: {
  organizationId: string;
  clientId: string;
  email: string;
}): Promise<{ context: WhoIsThisContext; reason: string } | null> {
  const domain = emailDomain(email);
  if (!domain) return null;

  const sponsorDomains = await planSponsorDomains({ organizationId, clientId });
  if (sponsorDomains.includes(domain)) {
    return {
      context: "plan_sponsor_hr",
      reason: `That address is on the plan sponsor's domain (${domain}).`,
    };
  }

  return null;
}

/* ───────────────────── What the section is missing ───────────────────── */

/**
 * The completeness verdict for one plan + category, fed exactly the way
 * `/api/benefits` feeds it so the email and the category card agree.
 */
async function completenessForCategory({
  organizationId,
  clientId,
  category,
}: {
  organizationId: string;
  clientId: string;
  category: string;
}) {
  const [client, benefits, documents] = await Promise.all([
    loadPlan(organizationId, clientId),
    prisma.benefit.findMany({
      where: { clientId },
      select: {
        clientId: true,
        category: true,
        title: true,
        shortDescription: true,
        partnerLogo: true,
        backgroundImage: true,
        providerContact: true,
        isEnabled: true,
      },
    }),
    // Only the fields the check reads — never the base64 `file`.
    //
    // Deliberately NOT filtered on `archivedAt` in the query: on MongoDB a
    // `null` filter matches only an explicit null, so every document uploaded
    // before soft-archiving existed (field absent) would be excluded and each
    // category would report "Plan documents missing". Archived rows are dropped
    // in JS instead — the same fix `/api/benefits` carries.
    prisma.document.findMany({
      where: { clientId },
      select: {
        clientId: true,
        type: true,
        category: true,
        storageKey: true,
        archivedAt: true,
      },
    }),
  ]);

  const wanted = normalizeCategory(category);
  const row =
    benefits.find((benefit) => normalizeCategory(benefit.category) === wanted) ??
    null;

  return getBenefitCompleteness(category as never, {
    ...client,
    // Only the authoritative Benefit row: the legacy mirror can hold a stale
    // array that `getBenefitsArrayFromPortalPreview` would prefer.
    employeePortalPreview: { benefits: row ? [row] : [] },
    keyContacts: client.keyContacts,
    documents: documents.filter((document) => !document.archivedAt),
  });
}

/** The fields still missing on one category — the card's chips, for the email. */
export async function missingFieldsForCategory({
  organizationId,
  clientId,
  category,
}: {
  organizationId: string;
  clientId: string;
  category: string;
}): Promise<string[]> {
  const completeness = await completenessForCategory({
    organizationId,
    clientId,
    category,
  });
  return completeness.missingInfo;
}

/* ───────────────────────────── The invite ───────────────────────────── */

export interface InviteCollaboratorInput {
  organizationId: string;
  actorUserId: string;
  /** The plan the invite is pinned to — never widened here. */
  clientId: string;
  /** The single benefit category it is scoped to (Part A item 2). */
  category: string;
  email: string;
  whoIsThis: WhoIsThisContext;
  name?: string | null;
  note?: string | null;
  /** `yyyy-mm-dd` from the dialog's date field, or null. */
  dueDate?: string | null;
  /** Set when the advisor chose an existing person from the search. */
  profileId?: string | null;
  /** Skip the email (used by verification, which must not send mail). */
  skipEmail?: boolean;
}

export interface InviteCollaboratorResult {
  profileId: string;
  assignmentId: string;
  reusedProfile: boolean;
  /** False when the person already had an assignment on this plan. */
  createdAssignment: boolean;
  /** False when an existing assignment's role was kept instead of the invite's. */
  roleApplied: boolean;
  role: TeammateAssignmentRole;
  /** The assignment's full category scope after the merge. */
  categories: string[];
  categoryScope: TeammateCategoryScope;
  missingFields: string[];
  emailSent: boolean;
  emailError: string | null;
}

/**
 * Invite someone to complete ONE benefit category of ONE plan.
 *
 * Order matters: the person is resolved/created first, then the assignment is
 * merged, then the state moves to Invited, then the audit row is written, and only
 * then is the email attempted. A mail failure therefore cannot leave an unaudited
 * assignment behind, and it cannot roll back a grant the advisor asked for.
 */
export async function inviteCollaboratorToCategory(
  input: InviteCollaboratorInput,
): Promise<InviteCollaboratorResult> {
  const email = (input.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new TeammateDataError(
      "Enter a valid email address.",
      400,
      "email_invalid",
    );
  }

  const category = (input.category ?? "").trim();
  if (!category) {
    throw new TeammateDataError(
      "A benefit category is required.",
      400,
      "category_required",
    );
  }

  const plan = await loadPlan(input.organizationId, input.clientId);

  // The person: an explicit pick from the search wins, else the email decides.
  // Either route reuses an existing profile (Part B item 5).
  const picked = input.profileId
    ? await prisma.teammateProfile.findFirst({
        where: { id: input.profileId, organizationId: input.organizationId },
      })
    : null;
  let profile = picked ?? (await findProfileByEmail(input.organizationId, email));
  const reusedProfile = Boolean(profile);

  if (profile?.deactivatedAt) {
    throw new TeammateDataError(
      "This collaborator is deactivated. Reactivate them in Settings → Team Members first.",
      409,
      "profile_deactivated",
    );
  }
  if (profile && profile.type !== "collaborator") {
    throw new TeammateDataError(
      "That email already belongs to a Team Member. Widen their plan access from Settings → Team Members instead.",
      409,
      "already_a_team_member",
    );
  }

  if (!profile) {
    const trimmed = (input.name ?? "").trim();
    const [firstName, ...restName] = trimmed.split(/\s+/).filter(Boolean);
    profile = await createTeammateProfile({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      type: "collaborator",
      email,
      firstName: firstName ?? null,
      lastName: restName.length > 0 ? restName.join(" ") : null,
      // All Plans is a Team-Member concept (T2a hides it for Collaborators), so a
      // collaborator never carries the follow-on flag.
      allPlans: false,
    });
  }

  const existing = await getAssignment({
    profileId: profile.id,
    clientId: input.clientId,
    organizationId: input.organizationId,
  });

  // Being re-invited to another category on the same plan must ADD, not replace:
  // `upsertAssignment` writes the category list verbatim, so the union is computed
  // here. Same reason an existing assignment keeps its role — a second invite for a
  // different category is not a role change.
  const role: TeammateAssignmentRole = existing
    ? existing.role
    : roleForWhoIsThisContext(input.whoIsThis);
  const categoryScope: TeammateCategoryScope =
    existing?.categoryScope === "all" ? "all" : "selected";
  const categories =
    categoryScope === "all"
      ? []
      : [...new Set([...(existing?.categories ?? []), category])];

  const dueDate = parseDueDate(input.dueDate);
  const note = (input.note ?? "").trim();

  // Only write the invite metadata that was actually supplied.
  //
  // `upsertAssignment` treats `undefined` as "leave it alone", so this is what
  // stops a re-invite for ANOTHER category on the same plan from silently erasing
  // the note and deadline the first invite set. Once the advisor supplies either
  // field the pair is written verbatim — the dialog shows both, so what is in the
  // form is what gets saved, including a deliberate clear.
  const inviteMeta =
    note.length > 0 || dueDate !== null
      ? { inviteNote: note || null, inviteDueDate: dueDate }
      : {};

  const assignment = await upsertAssignment({
    organizationId: input.organizationId,
    profileId: profile.id,
    clientId: input.clientId,
    actorUserId: input.actorUserId,
    role,
    categoryScope,
    categories,
    showOnBenefitsHub: existing?.showOnBenefitsHub ?? true,
    ...inviteMeta,
  });

  // Contact → Invited keeps the profile and its history (T1 profile states).
  if (profile.state === "contact") {
    await upgradeContactToInvited({
      id: profile.id,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
    });
  }

  const missingFields = await missingFieldsForCategory({
    organizationId: input.organizationId,
    clientId: input.clientId,
    category,
  });

  await recordTeammateAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: "collaborator_invited",
    profileId: profile.id,
    assignmentId: assignment.id,
    details: {
      source: "create_benefits",
      clientId: input.clientId,
      category,
      whoIsThis: input.whoIsThis,
      whoIsThisLabel: labelForWhoIsThisContext(input.whoIsThis),
      reusedProfile,
      dueDate: dueDate ? dueDate.toISOString() : null,
    },
  });

  let emailSent = false;
  let emailError: string | null = null;

  if (!input.skipEmail) {
    // Resolved here rather than passed in: `OrgSession` carries only the ids, and
    // the email needs a human name to open with.
    const [organization, actor] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: input.organizationId },
        select: { name: true },
      }),
      prisma.user.findUnique({
        where: { id: input.actorUserId },
        select: { name: true },
      }),
    ]);

    try {
      await sendCollaboratorInviteEmail({
        to: email,
        collaboratorName:
          [profile.firstName, profile.lastName].filter(Boolean).join(" ") || null,
        inviterName: actor?.name ?? null,
        organizationName: organization?.name ?? null,
        planName: plan.companyName,
        category,
        inviteContext: labelForWhoIsThisContext(input.whoIsThis),
        sectionUrl: `${appBaseUrl()}/edit-benefit/${input.clientId}/${categoryToSlug(
          category,
        )}`,
        missingFields,
        note: input.note ?? null,
        dueDate,
      });
      emailSent = true;
    } catch (error) {
      emailError = error instanceof Error ? error.message : "Unknown email error";
      console.error("[teammates/invite] invite email failed", error);
    }
  }

  return {
    profileId: profile.id,
    assignmentId: assignment.id,
    reusedProfile,
    createdAssignment: !existing,
    roleApplied: !existing,
    role,
    categories,
    categoryScope,
    missingFields,
    emailSent,
    emailError,
  };
}

/* ─────────────────── What the category cards render ─────────────────── */

/**
 * A person's assignment on one plan, flattened for the Create Benefits cards.
 *
 * Flattened on purpose: the card needs the PERSON (name, headshot, company) and
 * the ASSIGNMENT (role, categories, due date) in one object, and the client should
 * not have to join two payloads to render an avatar and a status.
 */
export interface PlanAssignmentRow {
  assignmentId: string;
  profileId: string;
  name: string;
  email: string;
  headshot: string | null;
  personType: TeammatePersonType;
  companyName: string | null;
  role: TeammateAssignmentRole;
  categoryScope: TeammateCategoryScope;
  categories: string[];
  showOnBenefitsHub: boolean;
  state: TeammateProfileState;
  deactivatedAt: Date | null;
  inviteNote: string | null;
  inviteDueDate: Date | null;
}

/** Everyone assigned to one plan, for the category cards' "Assigned to …". */
export async function listPlanAssignments({
  organizationId,
  clientId,
}: {
  organizationId: string;
  clientId: string;
}): Promise<PlanAssignmentRow[]> {
  const assignments = await prisma.planAssignment.findMany({
    where: { organizationId, clientId },
    orderBy: { createdAt: "asc" },
  });
  if (assignments.length === 0) return [];

  const profiles = await prisma.teammateProfile.findMany({
    where: {
      organizationId,
      id: { in: [...new Set(assignments.map((row) => row.profileId))] },
    },
  });
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  const companyIds = [
    ...new Set(
      profiles
        .map((profile) => profile.companyId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const companies =
    companyIds.length > 0
      ? await prisma.teammateCompany.findMany({
          where: { id: { in: companyIds } },
          select: { id: true, name: true },
        })
      : [];
  const companyNameById = new Map(
    companies.map((company) => [company.id, company.name]),
  );

  return assignments.flatMap((assignment) => {
    const profile = profileById.get(assignment.profileId);
    // An assignment whose profile is gone is skipped rather than rendered as a
    // nameless row — deletes are supposed to clean these up (see
    // deleteTeammateProfile, which refuses while assignments remain).
    if (!profile) return [];

    const inviteMeta = inviteMetaOf(assignment);

    return [
      {
        assignmentId: assignment.id,
        profileId: profile.id,
        name:
          [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
          profile.email,
        email: profile.email,
        headshot: profile.headshot ?? null,
        personType: profile.type,
        companyName: profile.companyId
          ? (companyNameById.get(profile.companyId) ?? null)
          : null,
        role: assignment.role,
        categoryScope: assignment.categoryScope,
        categories: assignment.categories ?? [],
        showOnBenefitsHub: assignment.showOnBenefitsHub,
        state: profile.state,
        deactivatedAt: profile.deactivatedAt ?? null,
        inviteNote: inviteMeta.inviteNote,
        inviteDueDate: inviteMeta.inviteDueDate,
      },
    ];
  });
}

/* ────────────────── "Add Existing Collaborator" search ────────────────── */

export interface CollaboratorSearchRow {
  profileId: string;
  name: string;
  email: string;
  headshot: string | null;
  companyName: string | null;
  state: TeammateProfileState;
}

/**
 * Search this organization's collaborators by person OR company name.
 *
 * The matching is done in JS, deliberately: Prisma's MongoDB connector has no
 * case-insensitive `contains` (SQL-only `mode: "insensitive"`), so a `contains`
 * filter would be case-sensitive and a collaborator typed as "jane" would never
 * find "Jane Smith". The candidate set is one organization's external
 * collaborators, so loading it and filtering is cheap and correct.
 */
export async function searchCollaborators({
  organizationId,
  query,
  limit = 8,
}: {
  organizationId: string;
  query: string;
  limit?: number;
}): Promise<CollaboratorSearchRow[]> {
  const needle = (query ?? "").trim().toLowerCase();
  if (needle.length < 2) return [];

  const [profiles, companies] = await Promise.all([
    prisma.teammateProfile.findMany({
      where: {
        organizationId,
        type: "collaborator",
        // `deactivatedAt: null` matches only an EXPLICIT null on MongoDB, and
        // every pre-existing row has the field ABSENT — so a live profile has to
        // be asked for in both shapes. (Same trap documented in team.server.ts.)
        // Deactivated people are excluded from the picker on purpose: reactivating
        // them is a Settings decision, not something an invite should do.
        AND: [
          { OR: [{ deactivatedAt: null }, { deactivatedAt: { isSet: false } }] },
        ],
      },
      take: 200,
    }),
    prisma.teammateCompany.findMany({
      where: { organizationId },
      select: { id: true, name: true },
      take: 200,
    }),
  ]);

  const companyNameById = new Map(
    companies.map((company) => [company.id, company.name]),
  );

  return profiles
    .map((profile) => {
      const companyName = profile.companyId
        ? (companyNameById.get(profile.companyId) ?? null)
        : null;
      return {
        profileId: profile.id,
        name:
          [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
          profile.email,
        email: profile.email,
        headshot: profile.headshot ?? null,
        companyName,
        state: profile.state,
      };
    })
    .filter(
      (row) =>
        row.name.toLowerCase().includes(needle) ||
        row.email.toLowerCase().includes(needle) ||
        (row.companyName ?? "").toLowerCase().includes(needle),
    )
    .slice(0, limit);
}
