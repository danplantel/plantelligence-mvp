import prisma from "@/lib/prisma";

/**
 * Global portal-slug registry helpers.
 *
 * Every slug a plan has ever used lives in the `PortalSlug` table with a single
 * global `@unique` index, covering both the CURRENT slug and every retired
 * ("alias") slug. That index is the real guard: a retired alias still occupies
 * the name, so another advisor cannot claim it — which is what keeps a printed
 * QR code pointing at the original plan.
 *
 * Lifecycle:
 *   • create/complete  → registerClientSlug()  (one current row)
 *   • rename           → renameClientSlug()    (demote old → alias, promote new)
 *   • release (manual) → releaseClientSlug()   (delete the alias row → free)
 */

export interface PortalSlugRecord {
  slug: string;
  clientId: string;
  isCurrent: boolean;
  retiredAt: Date | null;
  replacedBy: string | null;
  createdAt: Date;
}

export interface ResolvedPortalSlug {
  clientId: string;
  isCurrent: boolean;
  /** The owner's current slug — differs from the requested slug for an alias. */
  currentSlug: string | null;
}

/**
 * Backfill the registry from `Client.slug` when a row is missing (legacy plans
 * created before the registry existed). Safe to call repeatedly.
 */
export async function ensureRegistryForClient(clientId: string): Promise<void> {
  const existing = await prisma.portalSlug.findFirst({
    where: { clientId, isCurrent: true },
    select: { id: true },
  });
  if (existing) return;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { slug: true },
  });
  const slug = client?.slug?.trim();
  if (!slug) return;

  const owner = await prisma.portalSlug.findUnique({
    where: { slug },
    select: { clientId: true },
  });
  if (owner) {
    // Slug already registered — only promote it if this client owns it.
    if (owner.clientId === clientId) {
      await prisma.portalSlug.update({
        where: { slug },
        data: { isCurrent: true, retiredAt: null, replacedBy: null },
      });
    }
    return;
  }

  await prisma.portalSlug.create({ data: { slug, clientId, isCurrent: true } });
}

/**
 * True when `slug` is already owned (current OR alias) by a different plan.
 * Falls back to `Client.slug` for legacy plans not yet in the registry.
 */
export async function isSlugTaken(
  slug: string,
  excludeClientId?: string,
): Promise<boolean> {
  const row = await prisma.portalSlug.findUnique({
    where: { slug },
    select: { clientId: true },
  });
  if (row) return row.clientId !== excludeClientId;

  const legacy = await prisma.client.findFirst({
    where: { slug },
    select: { id: true },
  });
  return !!legacy && legacy.id !== excludeClientId;
}

/** Register a plan's current slug (used at plan creation). */
export async function registerClientSlug(
  clientId: string,
  slug: string,
): Promise<void> {
  const clean = slug?.trim();
  if (!clean) return;

  const row = await prisma.portalSlug.findUnique({
    where: { slug: clean },
    select: { clientId: true },
  });
  if (row && row.clientId !== clientId) {
    throw new Error(`Slug "${clean}" is already taken`);
  }

  // Demote any other current rows for this client first (there should be at
  // most one, but this keeps the invariant strict).
  await prisma.portalSlug.updateMany({
    where: { clientId, isCurrent: true, NOT: { slug: clean } },
    data: { isCurrent: false, retiredAt: new Date(), replacedBy: clean },
  });

  if (row) {
    await prisma.portalSlug.update({
      where: { slug: clean },
      data: { isCurrent: true, retiredAt: null, replacedBy: null },
    });
  } else {
    await prisma.portalSlug.create({
      data: { slug: clean, clientId, isCurrent: true },
    });
  }
}

/**
 * Rename a plan's current slug. The old slug is demoted to a permanent alias
 * (never deleted) so existing links keep resolving; the new slug becomes
 * current. Throws when the target is owned by another plan.
 */
export async function renameClientSlug(
  clientId: string,
  newSlug: string,
): Promise<void> {
  const clean = newSlug?.trim();
  if (!clean) return;

  const current = await prisma.portalSlug.findFirst({
    where: { clientId, isCurrent: true },
    select: { slug: true },
  });
  if (current?.slug === clean) return;

  const target = await prisma.portalSlug.findUnique({
    where: { slug: clean },
    select: { clientId: true },
  });
  if (target && target.clientId !== clientId) {
    throw new Error(`Slug "${clean}" is already taken`);
  }

  // Make sure the client's existing slug is registered before we demote it —
  // otherwise a legacy plan would lose its old slug instead of aliasing it.
  await ensureRegistryForClient(clientId);

  await prisma.portalSlug.updateMany({
    where: { clientId, isCurrent: true },
    data: { isCurrent: false, retiredAt: new Date(), replacedBy: clean },
  });

  if (target) {
    // Reclaiming a slug this client used before — revive the existing row.
    await prisma.portalSlug.update({
      where: { slug: clean },
      data: { isCurrent: true, retiredAt: null, replacedBy: null },
    });
  } else {
    await prisma.portalSlug.create({
      data: { slug: clean, clientId, isCurrent: true },
    });
  }
}

/** All slugs (current + aliases) for a plan, current first. */
export async function listClientSlugs(
  clientId: string,
): Promise<PortalSlugRecord[]> {
  await ensureRegistryForClient(clientId);
  return prisma.portalSlug.findMany({
    where: { clientId },
    orderBy: [{ isCurrent: "desc" }, { retiredAt: "desc" }],
    select: {
      slug: true,
      clientId: true,
      isCurrent: true,
      retiredAt: true,
      replacedBy: true,
      createdAt: true,
    },
  });
}

/**
 * Explicitly release a retired alias so the slug returns to the pool. Refuses
 * to release the current slug or a slug owned by another plan.
 */
export async function releaseClientSlug(
  clientId: string,
  slug: string,
): Promise<boolean> {
  const row = await prisma.portalSlug.findUnique({
    where: { slug },
    select: { clientId: true, isCurrent: true },
  });
  if (!row || row.clientId !== clientId || row.isCurrent) return false;

  await prisma.portalSlug.delete({ where: { slug } });
  return true;
}

/**
 * Resolve a requested slug to its owner. For an alias, also returns the owner's
 * current slug so the caller can redirect to the canonical URL.
 */
export async function resolvePortalSlug(
  slug: string,
): Promise<ResolvedPortalSlug | null> {
  const clean = slug?.trim();
  if (!clean) return null;

  const row = await prisma.portalSlug.findUnique({
    where: { slug: clean },
    select: { clientId: true, isCurrent: true },
  });

  if (row) {
    if (row.isCurrent) {
      return { clientId: row.clientId, isCurrent: true, currentSlug: clean };
    }
    const currentRow = await prisma.portalSlug.findFirst({
      where: { clientId: row.clientId, isCurrent: true },
      select: { slug: true },
    });
    let currentSlug = currentRow?.slug ?? null;
    if (!currentSlug) {
      const client = await prisma.client.findUnique({
        where: { id: row.clientId },
        select: { slug: true },
      });
      currentSlug = client?.slug ?? null;
    }
    return { clientId: row.clientId, isCurrent: false, currentSlug };
  }

  // Legacy: not in the registry but is an existing Client.slug.
  const client = await prisma.client.findFirst({
    where: { slug: clean },
    select: { id: true },
  });
  if (client) {
    return { clientId: client.id, isCurrent: true, currentSlug: clean };
  }
  return null;
}
