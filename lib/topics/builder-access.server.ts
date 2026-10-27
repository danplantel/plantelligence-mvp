import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { planIdOrSlug } from "@/lib/plan-lookup";
import {
  resolvePlanAccess,
  type RequiredLevel,
} from "@/lib/teammates/access.server";

/**
 * Authorization for the topic builder (TF-3).
 *
 * The builder is a DASHBOARD surface only — no anonymous portal caller — so this is
 * deliberately narrower than the benefit route's `resolveClient`: session first, then
 * the plan by id-or-slug WITHOUT the legacy `userId` filter (a Collaborator is not the
 * owner and must still reach their assigned plan), then the assignment check.
 *
 * The permission is `create_benefits`, the section the cards belong to, scoped to the
 * category that owns the location. That is what keeps a teammate granted only
 * Retirement from reordering Group Health.
 */

export type BuilderAccess =
  | { ok: true; clientId: string; organizationId: string | null }
  | { ok: false; response: NextResponse };

export async function resolveBuilderClient(params: {
  id: string;
  level: RequiredLevel;
  category?: string | null;
}): Promise<BuilderAccess> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const client = await prisma.client.findFirst({
    where: planIdOrSlug(params.id),
    select: { id: true, organizationId: true },
  });

  if (!client) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Client not found" }, { status: 404 }),
    };
  }

  const access = await resolvePlanAccess({
    userId,
    clientIdOrSlug: client.id,
    category: params.category ?? null,
    permission: "create_benefits",
    level: params.level,
  });

  if (!access.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: access.message, code: access.reason },
        { status: access.reason === "plan_not_found" ? 404 : 403 },
      ),
    };
  }

  return { ok: true, clientId: client.id, organizationId: client.organizationId };
}
