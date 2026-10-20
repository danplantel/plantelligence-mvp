import React from "react";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import BenefitsPage, {
  dynamic as benefitsPageDynamic,
} from "@/app/(dashboard)/benefits/page";

/**
 * Server half of Browse Benefits.
 *
 * `getOrgServiceCategories` is module-private, so these tests drive it through
 * the page's default export and pin the props handed to `BenefitsListPage`.
 * Prisma is mocked at the query shape level, which is where the fallback ladder
 * actually lives.
 */

type UserRow = {
  categories?: unknown;
  sessions?: string[][];
  organizationId?: string | null;
};

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  prisma: {
    user: { findUnique: vi.fn() },
    organization: { findUnique: vi.fn() },
  },
  listProps: null as { orgCategories: string[] } | null,
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getSession }));
vi.mock("@/lib/auth-options", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  default: mocks.prisma,
  prisma: mocks.prisma,
}));
vi.mock("@/components/pages/benefits/benefits-list", () => ({
  BenefitsListPage: (props: { orgCategories: string[] }) => {
    mocks.listProps = props;
    return <div data-testid="benefits-list" />;
  },
}));

const users = new Map<string, UserRow>();
const organizations = new Map<string, { ownerUserId: string | null }>();

function setUser(id: string, row: UserRow) {
  users.set(id, row);
}

function setOrganization(id: string, ownerUserId: string | null) {
  organizations.set(id, { ownerUserId });
}

async function renderPage() {
  render(await BenefitsPage());
}

function categories(): string[] {
  return mocks.listProps?.orgCategories ?? [];
}

beforeEach(() => {
  users.clear();
  organizations.clear();
  mocks.listProps = null;
  mocks.getSession.mockReset().mockResolvedValue({ user: { id: "viewer" } });
  vi.spyOn(console, "error").mockImplementation(() => {});

  mocks.prisma.user.findUnique.mockImplementation((args: any) => {
    const row = users.get(args?.where?.id);
    if (!row) return Promise.resolve(null);

    // The viewer's organization read selects only `organizationId`.
    if (args?.select?.organizationId) {
      return Promise.resolve({
        organizationId: row.organizationId ?? null,
      });
    }

    return Promise.resolve({
      primaryServiceCategories: row.categories ?? [],
      wizardSessions: (row.sessions ?? []).map((services) => ({
        services: { services },
      })),
    });
  });

  mocks.prisma.organization.findUnique.mockImplementation((args: any) =>
    Promise.resolve(organizations.get(args?.where?.id) ?? null),
  );
});

describe("BenefitsPage (server component)", () => {
  it("is session-scoped and force-dynamic", () => {
    expect(benefitsPageDynamic).toBe("force-dynamic");
  });

  it("renders the list with no categories when there is no session", async () => {
    mocks.getSession.mockResolvedValue(null);

    await renderPage();

    expect(screen.getByTestId("benefits-list")).toBeInTheDocument();
    expect(categories()).toEqual([]);
    expect(mocks.prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("uses the viewer's own stored categories", async () => {
    setUser("viewer", { categories: ["Retirement", "Group Health"] });

    await renderPage();

    expect(categories()).toEqual(["Retirement", "Group Health"]);
    expect(mocks.prisma.organization.findUnique).not.toHaveBeenCalled();
    // One read for the viewer's categories — the owner fallback is never entered.
    expect(mocks.prisma.user.findUnique).toHaveBeenCalledTimes(1);
  });

  it("normalizes duplicates, whitespace and canonical order", async () => {
    setUser("viewer", {
      categories: ["Other", " Retirement ", "Retirement", "Dental"],
    });

    await renderPage();

    expect(categories()).toEqual(["Retirement", "Other", "Dental"]);
  });

  it("selects only the fields the strip needs", async () => {
    setUser("viewer", { categories: ["Retirement"] });

    await renderPage();

    expect(mocks.prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "viewer" },
      select: {
        primaryServiceCategories: true,
        wizardSessions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { services: { select: { services: true } } },
        },
      },
    });
  });

  it("falls back to the latest wizard session's Step 2 services", async () => {
    setUser("viewer", {
      categories: [],
      sessions: [["group_health", "retirement"]],
    });

    await renderPage();

    expect(categories()).toEqual(["Retirement", "Group Health"]);
    expect(mocks.prisma.user.findUnique).toHaveBeenCalledTimes(1);
  });

  it("drops unknown Step 2 values in the wizard fallback", async () => {
    setUser("viewer", {
      categories: [],
      sessions: [["not-a-service", "supplemental_health"]],
    });

    await renderPage();

    expect(categories()).toEqual(["Other"]);
  });

  it("falls back to the organization owner's categories for an invited teammate", async () => {
    setUser("viewer", { categories: [], organizationId: "org-1" });
    setUser("owner", { categories: ["Group Life", "Group Health"] });
    setOrganization("org-1", "owner");

    await renderPage();

    expect(categories()).toEqual(["Group Health", "Group Life"]);
    expect(mocks.prisma.organization.findUnique).toHaveBeenCalledWith({
      where: { id: "org-1" },
      select: { ownerUserId: true },
    });
  });

  it("uses the owner's wizard session when the owner's column is empty", async () => {
    setUser("viewer", { categories: [], organizationId: "org-1" });
    setUser("owner", { categories: [], sessions: [["group_life_disability"]] });
    setOrganization("org-1", "owner");

    await renderPage();

    expect(categories()).toEqual(["Group Life"]);
  });

  it("never lets the owner fallback overwrite a viewer's own answer", async () => {
    setUser("viewer", {
      categories: ["Retirement"],
      organizationId: "org-1",
    });
    setUser("owner", { categories: ["Group Health"] });
    setOrganization("org-1", "owner");

    await renderPage();

    expect(categories()).toEqual(["Retirement"]);
    expect(mocks.prisma.organization.findUnique).not.toHaveBeenCalled();
  });

  it("returns no categories when the viewer has no organization", async () => {
    setUser("viewer", { categories: [], organizationId: null });

    await renderPage();

    expect(categories()).toEqual([]);
    expect(mocks.prisma.organization.findUnique).not.toHaveBeenCalled();
  });

  it("returns no categories when the organization has no owner", async () => {
    setUser("viewer", { categories: [], organizationId: "org-1" });
    setOrganization("org-1", null);

    await renderPage();

    expect(categories()).toEqual([]);
  });

  it("does not re-read the viewer's row when they own the organization", async () => {
    setUser("viewer", { categories: [], organizationId: "org-1" });
    setOrganization("org-1", "viewer");

    await renderPage();

    expect(categories()).toEqual([]);
    expect(mocks.prisma.user.findUnique).toHaveBeenCalledTimes(2);
  });

  it("returns no categories when the viewer's User row is missing", async () => {
    mocks.getSession.mockResolvedValue({ user: { id: "deleted-user" } });

    await renderPage();

    expect(categories()).toEqual([]);
  });

  it("degrades to an empty strip when the read throws", async () => {
    mocks.prisma.user.findUnique.mockRejectedValue(new Error("db down"));

    await renderPage();

    expect(screen.getByTestId("benefits-list")).toBeInTheDocument();
    expect(categories()).toEqual([]);
    expect(console.error).toHaveBeenCalledWith(
      "[benefits] org service categories",
      expect.any(Error),
    );
  });
});
