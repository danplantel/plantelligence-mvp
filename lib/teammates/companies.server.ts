/**
 * companies.server — Partner Company data access (spec T1 Part B item 2).
 *
 * "Fields: name, logo, branding. Entity type: Partner/Provider. Must never
 * appear in Plan Sponsor pickers. One company can have many profiles."
 *
 * Server-only. Every function takes `organizationId`; there is no session read
 * here, which is what makes the acceptance criterion "Two collaborators from ABC
 * Benefits share one company record" testable in isolation.
 */

import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { TeammateDataError } from "./errors";
import { recordTeammateAuditEvent } from "./audit.server";

/** The only entity type partner companies may have. */
export const PARTNER_COMPANY_ENTITY_TYPE = "partner_provider" as const;

export interface UpsertPartnerCompanyInput {
  organizationId: string;
  name: string;
  logo?: string | null;
  branding?: Prisma.InputJsonValue | null;
  /** Actor for the audit trail when a company is created. */
  actorUserId?: string | null;
}

/** Case-insensitive lookup by name within an organization. */
export async function findPartnerCompanyByName(
  organizationId: string,
  name: string,
) {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return null;
  return prisma.teammateCompany.findFirst({
    where: {
      organizationId,
      name: { equals: trimmed, mode: "insensitive" },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getPartnerCompany(id: string, organizationId: string) {
  return prisma.teammateCompany.findFirst({ where: { id, organizationId } });
}

export async function listPartnerCompanies(
  organizationId: string,
  options?: { search?: string; limit?: number },
) {
  const search = options?.search?.trim();
  return prisma.teammateCompany.findMany({
    where: {
      organizationId,
      ...(search
        ? { name: { contains: search, mode: "insensitive" } }
        : {}),
    },
    orderBy: { name: "asc" },
    take: Math.min(Math.max(options?.limit ?? 50, 1), 200),
  });
}

/**
 * Reuse the organization's company record when the name already exists, so two
 * collaborators from the same firm never create two companies. Fills in a
 * missing logo/branding on the existing row instead of overwriting it.
 */
export async function findOrCreatePartnerCompany(
  input: UpsertPartnerCompanyInput,
) {
  const name = (input.name ?? "").trim();
  if (!name) {
    throw new TeammateDataError("A company name is required.", 400);
  }

  const existing = await findPartnerCompanyByName(input.organizationId, name);
  if (existing) {
    const needsLogo = !existing.logo && !!input.logo;
    const needsBranding = !existing.branding && !!input.branding;
    if (!needsLogo && !needsBranding) return existing;

    return prisma.teammateCompany.update({
      where: { id: existing.id },
      data: {
        ...(needsLogo ? { logo: input.logo ?? null } : {}),
        ...(needsBranding
          ? { branding: input.branding as Prisma.InputJsonValue }
          : {}),
      },
    });
  }

  const created = await prisma.teammateCompany.create({
    data: {
      organizationId: input.organizationId,
      name,
      logo: input.logo ?? null,
      branding: (input.branding ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
    },
  });

  if (input.actorUserId) {
    await recordTeammateAuditEvent({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: "company_created",
      details: { companyId: created.id, name: created.name },
    });
  }

  return created;
}

export async function updatePartnerCompany({
  id,
  organizationId,
  name,
  logo,
  branding,
  actorUserId,
}: {
  id: string;
  organizationId: string;
  name?: string;
  logo?: string | null;
  branding?: Prisma.InputJsonValue | null;
  actorUserId?: string | null;
}) {
  const existing = await getPartnerCompany(id, organizationId);
  if (!existing) {
    throw new TeammateDataError("Partner company not found.", 404);
  }

  const updated = await prisma.teammateCompany.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(logo !== undefined ? { logo } : {}),
      ...(branding !== undefined
        ? { branding: branding as Prisma.InputJsonValue }
        : {}),
    },
  });

  if (actorUserId) {
    await recordTeammateAuditEvent({
      organizationId,
      actorUserId,
      action: "company_updated",
      details: { companyId: updated.id },
    });
  }

  return updated;
}
