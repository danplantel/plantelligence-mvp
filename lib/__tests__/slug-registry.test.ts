import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ensureRegistryForClient,
  isSlugTaken,
  listClientSlugs,
  registerClientSlug,
  releaseClientSlug,
  renameClientSlug,
  resolvePortalSlug,
} from "../slug-registry";

/**
 * The portal-slug registry is the only thing keeping a printed QR code working
 * after a plan's URL is renamed.
 *
 * The invariant it enforces: every slug a plan has ever used stays in
 * `PortalSlug`, globally unique, so a retired slug still resolves to its
 * original plan and cannot be claimed by another advisor. These tests pin the
 * lifecycle — register, rename (demote → promote), release (alias only),
 * resolve — plus the legacy `Client.slug` fallbacks that exist because plans
 * predate the table.
 */

const mocks = vi.hoisted(() => ({
  prisma: {
    portalSlug: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    client: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  default: mocks.prisma,
  prisma: mocks.prisma,
}));

const PLAN = "plan-1";
const OTHER = "plan-2";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.portalSlug.findFirst.mockResolvedValue(null);
  mocks.prisma.portalSlug.findUnique.mockResolvedValue(null);
  mocks.prisma.portalSlug.findMany.mockResolvedValue([]);
  mocks.prisma.portalSlug.create.mockResolvedValue({});
  mocks.prisma.portalSlug.update.mockResolvedValue({});
  mocks.prisma.portalSlug.updateMany.mockResolvedValue({ count: 0 });
  mocks.prisma.portalSlug.delete.mockResolvedValue({});
  mocks.prisma.client.findUnique.mockResolvedValue({ slug: "acme" });
  mocks.prisma.client.findFirst.mockResolvedValue(null);
});

describe("ensureRegistryForClient", () => {
  it("does nothing when the plan already has a current row", async () => {
    mocks.prisma.portalSlug.findFirst.mockResolvedValue({ id: "row-1" });

    await ensureRegistryForClient(PLAN);

    expect(mocks.prisma.client.findUnique).not.toHaveBeenCalled();
    expect(mocks.prisma.portalSlug.create).not.toHaveBeenCalled();
  });

  it("does nothing for a plan with no slug yet", async () => {
    mocks.prisma.client.findUnique.mockResolvedValue({ slug: "   " });

    await ensureRegistryForClient(PLAN);

    expect(mocks.prisma.portalSlug.create).not.toHaveBeenCalled();
  });

  it("registers the legacy Client.slug", async () => {
    await ensureRegistryForClient(PLAN);

    expect(mocks.prisma.portalSlug.create).toHaveBeenCalledWith({
      data: { slug: "acme", clientId: PLAN, isCurrent: true },
    });
  });

  it("promotes an existing row this plan already owns", async () => {
    mocks.prisma.portalSlug.findUnique.mockResolvedValue({ clientId: PLAN });

    await ensureRegistryForClient(PLAN);

    expect(mocks.prisma.portalSlug.update).toHaveBeenCalledWith({
      where: { slug: "acme" },
      data: { isCurrent: true, retiredAt: null, replacedBy: null },
    });
    expect(mocks.prisma.portalSlug.create).not.toHaveBeenCalled();
  });

  it("never steals a row owned by another plan", async () => {
    mocks.prisma.portalSlug.findUnique.mockResolvedValue({ clientId: OTHER });

    await ensureRegistryForClient(PLAN);

    expect(mocks.prisma.portalSlug.update).not.toHaveBeenCalled();
    expect(mocks.prisma.portalSlug.create).not.toHaveBeenCalled();
  });
});

describe("isSlugTaken", () => {
  it("is true when the registry row belongs to another plan", async () => {
    mocks.prisma.portalSlug.findUnique.mockResolvedValue({ clientId: OTHER });

    expect(await isSlugTaken("acme", PLAN)).toBe(true);
  });

  it("is false when the caller already owns the row", async () => {
    mocks.prisma.portalSlug.findUnique.mockResolvedValue({ clientId: PLAN });

    expect(await isSlugTaken("acme", PLAN)).toBe(false);
  });

  it("is true when no plan is excluded and the slug is registered", async () => {
    mocks.prisma.portalSlug.findUnique.mockResolvedValue({ clientId: OTHER });

    expect(await isSlugTaken("acme")).toBe(true);
  });

  it("falls back to Client.slug for a plan missing from the registry", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue({ id: OTHER });

    expect(await isSlugTaken("acme", PLAN)).toBe(true);
  });

  it("treats a legacy slug owned by the caller as free for the caller", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue({ id: PLAN });

    expect(await isSlugTaken("acme", PLAN)).toBe(false);
  });

  it("is false when nothing claims the slug", async () => {
    expect(await isSlugTaken("nobody-home", PLAN)).toBe(false);
  });
});

describe("registerClientSlug", () => {
  it("ignores a blank slug", async () => {
    await registerClientSlug(PLAN, "   ");

    expect(mocks.prisma.portalSlug.findUnique).not.toHaveBeenCalled();
    expect(mocks.prisma.portalSlug.create).not.toHaveBeenCalled();
  });

  it("throws when another plan already owns the slug", async () => {
    mocks.prisma.portalSlug.findUnique.mockResolvedValue({ clientId: OTHER });

    await expect(registerClientSlug(PLAN, "acme")).rejects.toThrow(
      'Slug "acme" is already taken',
    );
    expect(mocks.prisma.portalSlug.create).not.toHaveBeenCalled();
  });

  it("demotes the plan's other current rows before creating the new one", async () => {
    await registerClientSlug(PLAN, "  acme  ");

    expect(mocks.prisma.portalSlug.updateMany).toHaveBeenCalledWith({
      where: { clientId: PLAN, isCurrent: true, NOT: { slug: "acme" } },
      data: {
        isCurrent: false,
        retiredAt: expect.any(Date),
        replacedBy: "acme",
      },
    });
    expect(mocks.prisma.portalSlug.create).toHaveBeenCalledWith({
      data: { slug: "acme", clientId: PLAN, isCurrent: true },
    });
  });

  it("revives the plan's own existing row instead of duplicating it", async () => {
    mocks.prisma.portalSlug.findUnique.mockResolvedValue({ clientId: PLAN });

    await registerClientSlug(PLAN, "acme");

    expect(mocks.prisma.portalSlug.update).toHaveBeenCalledWith({
      where: { slug: "acme" },
      data: { isCurrent: true, retiredAt: null, replacedBy: null },
    });
    expect(mocks.prisma.portalSlug.create).not.toHaveBeenCalled();
  });
});

describe("renameClientSlug", () => {
  it("ignores a blank slug", async () => {
    await renameClientSlug(PLAN, "");

    expect(mocks.prisma.portalSlug.findFirst).not.toHaveBeenCalled();
  });

  it("does nothing when the slug is unchanged", async () => {
    mocks.prisma.portalSlug.findFirst.mockResolvedValue({ slug: "acme" });

    await renameClientSlug(PLAN, "acme");

    expect(mocks.prisma.portalSlug.updateMany).not.toHaveBeenCalled();
  });

  it("refuses a slug owned by another plan", async () => {
    mocks.prisma.portalSlug.findFirst.mockResolvedValue({ slug: "acme" });
    mocks.prisma.portalSlug.findUnique.mockResolvedValue({ clientId: OTHER });

    await expect(renameClientSlug(PLAN, "acme-holdings")).rejects.toThrow(
      'Slug "acme-holdings" is already taken',
    );
    expect(mocks.prisma.portalSlug.create).not.toHaveBeenCalled();
  });

  it("demotes the old slug to an alias and creates the new current row", async () => {
    mocks.prisma.portalSlug.findFirst.mockResolvedValue({ slug: "acme" });

    await renameClientSlug(PLAN, "acme-holdings");

    expect(mocks.prisma.portalSlug.updateMany).toHaveBeenCalledWith({
      where: { clientId: PLAN, isCurrent: true },
      data: {
        isCurrent: false,
        retiredAt: expect.any(Date),
        replacedBy: "acme-holdings",
      },
    });
    expect(mocks.prisma.portalSlug.create).toHaveBeenCalledWith({
      data: { slug: "acme-holdings", clientId: PLAN, isCurrent: true },
    });
    // The old row is demoted, never deleted — old links keep resolving.
    expect(mocks.prisma.portalSlug.delete).not.toHaveBeenCalled();
  });

  it("revives the plan's earlier alias when the URL is restored", async () => {
    mocks.prisma.portalSlug.findFirst.mockResolvedValue({ slug: "acme" });
    mocks.prisma.portalSlug.findUnique.mockResolvedValue({ clientId: PLAN });

    await renameClientSlug(PLAN, "acme-old");

    expect(mocks.prisma.portalSlug.update).toHaveBeenCalledWith({
      where: { slug: "acme-old" },
      data: { isCurrent: true, retiredAt: null, replacedBy: null },
    });
    expect(mocks.prisma.portalSlug.create).not.toHaveBeenCalled();
  });

  it("registers a legacy plan's slug before demoting it", async () => {
    // No current row, so the registry is backfilled from Client.slug first.
    mocks.prisma.portalSlug.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    await renameClientSlug(PLAN, "acme-holdings");

    expect(mocks.prisma.client.findUnique).toHaveBeenCalledWith({
      where: { id: PLAN },
      select: { slug: true },
    });
  });
});

describe("listClientSlugs", () => {
  it("backfills the registry and returns current slugs first", async () => {
    mocks.prisma.portalSlug.findMany.mockResolvedValue([
      { slug: "acme", isCurrent: true },
      { slug: "old-acme", isCurrent: false },
    ]);

    const slugs = await listClientSlugs(PLAN);

    expect(slugs).toEqual([
      { slug: "acme", isCurrent: true },
      { slug: "old-acme", isCurrent: false },
    ]);
    expect(mocks.prisma.portalSlug.findMany).toHaveBeenCalledWith({
      where: { clientId: PLAN },
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
  });
});

describe("releaseClientSlug", () => {
  it("refuses a slug that is not registered", async () => {
    expect(await releaseClientSlug(PLAN, "ghost")).toBe(false);
    expect(mocks.prisma.portalSlug.delete).not.toHaveBeenCalled();
  });

  it("refuses the plan's current slug", async () => {
    mocks.prisma.portalSlug.findUnique.mockResolvedValue({
      clientId: PLAN,
      isCurrent: true,
    });

    expect(await releaseClientSlug(PLAN, "acme")).toBe(false);
    expect(mocks.prisma.portalSlug.delete).not.toHaveBeenCalled();
  });

  it("refuses a slug owned by another plan", async () => {
    mocks.prisma.portalSlug.findUnique.mockResolvedValue({
      clientId: OTHER,
      isCurrent: false,
    });

    expect(await releaseClientSlug(PLAN, "acme")).toBe(false);
    expect(mocks.prisma.portalSlug.delete).not.toHaveBeenCalled();
  });

  it("deletes a retired alias owned by this plan", async () => {
    mocks.prisma.portalSlug.findUnique.mockResolvedValue({
      clientId: PLAN,
      isCurrent: false,
    });

    expect(await releaseClientSlug(PLAN, "old-acme")).toBe(true);
    expect(mocks.prisma.portalSlug.delete).toHaveBeenCalledWith({
      where: { slug: "old-acme" },
    });
  });
});

describe("resolvePortalSlug", () => {
  it("returns null for a blank slug", async () => {
    expect(await resolvePortalSlug("  ")).toBeNull();
  });

  it("resolves a current slug to itself", async () => {
    mocks.prisma.portalSlug.findUnique.mockResolvedValue({
      clientId: PLAN,
      isCurrent: true,
    });

    expect(await resolvePortalSlug("acme")).toEqual({
      clientId: PLAN,
      isCurrent: true,
      currentSlug: "acme",
    });
  });

  it("resolves an alias to the owner's current slug", async () => {
    mocks.prisma.portalSlug.findUnique.mockResolvedValue({
      clientId: PLAN,
      isCurrent: false,
    });
    mocks.prisma.portalSlug.findFirst.mockResolvedValue({ slug: "acme" });

    expect(await resolvePortalSlug("old-acme")).toEqual({
      clientId: PLAN,
      isCurrent: false,
      currentSlug: "acme",
    });
  });

  it("falls back to Client.slug when the plan has no current row", async () => {
    mocks.prisma.portalSlug.findUnique.mockResolvedValue({
      clientId: PLAN,
      isCurrent: false,
    });
    mocks.prisma.portalSlug.findFirst.mockResolvedValue(null);
    mocks.prisma.client.findUnique.mockResolvedValue({ slug: "acme" });

    expect(await resolvePortalSlug("old-acme")).toEqual({
      clientId: PLAN,
      isCurrent: false,
      currentSlug: "acme",
    });
  });

  it("resolves a legacy Client.slug that is not in the registry", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue({ id: PLAN });

    expect(await resolvePortalSlug("acme")).toEqual({
      clientId: PLAN,
      isCurrent: true,
      currentSlug: "acme",
    });
  });

  it("returns null for a slug nobody owns", async () => {
    expect(await resolvePortalSlug("nobody-home")).toBeNull();
  });
});
