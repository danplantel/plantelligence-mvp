import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/benefits/route";

/**
 * `GET /api/benefits` contract.
 *
 * The route builds every row Browse Benefits renders: one row per accessible
 * plan x category, with visibility, completeness and the plan's Key Contact.
 * These tests pin authorization/scoping and the row derivation rules rather than
 * the Prisma internals that a mock would only echo back.
 */

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  listAccessiblePlanIds: vi.fn(),
  listOwnCategoryScopedPlans: vi.fn(),
  categoryWithinScope: vi.fn(),
  getBenefitCompleteness: vi.fn(),
  keyContactForCategory: vi.fn(),
  contactDisplayName: vi.fn(),
  prisma: {
    client: { findMany: vi.fn() },
    benefit: { findMany: vi.fn() },
    document: { findMany: vi.fn() },
  },
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getSession }));
vi.mock("@/lib/auth-options", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  default: mocks.prisma,
  prisma: mocks.prisma,
}));
vi.mock("@/lib/teammates/access.server", () => ({
  listAccessiblePlanIds: mocks.listAccessiblePlanIds,
  listOwnCategoryScopedPlans: mocks.listOwnCategoryScopedPlans,
  categoryWithinScope: mocks.categoryWithinScope,
}));
vi.mock("@/lib/benefit-completeness", () => ({
  getBenefitCompleteness: mocks.getBenefitCompleteness,
}));
vi.mock("@/lib/benefit-contacts", () => ({
  keyContactForCategory: mocks.keyContactForCategory,
  contactDisplayName: mocks.contactDisplayName,
}));

function client(overrides: Record<string, unknown> = {}) {
  return {
    id: "plan-1",
    companyName: "Acme Corp",
    slug: "acme",
    status: "Active",
    categoryPortalVisibility: {
      Retirement: true,
      "Group Health": true,
      "Group Life": true,
      Other: true,
    },
    companyLogo: null,
    keyContacts: [],
    ...overrides,
  };
}

function benefit(overrides: Record<string, unknown> = {}) {
  return {
    clientId: "plan-1",
    category: "Retirement",
    title: "Retirement Plan Benefits",
    shortDescription: "Plan for retirement.",
    partnerLogo: null,
    backgroundImage: "https://cdn.test/header.png",
    providerContact: null,
    isEnabled: true,
    ...overrides,
  };
}

async function payload(response: Response) {
  return response.json();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});

  mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
  mocks.listAccessiblePlanIds.mockResolvedValue(["plan-1"]);
  mocks.listOwnCategoryScopedPlans.mockResolvedValue(new Map());
  mocks.categoryWithinScope.mockReturnValue(true);
  mocks.getBenefitCompleteness.mockReturnValue({
    isComplete: true,
    missingInfo: [],
    sections: {
      branding: true,
      messaging: true,
      contacts: true,
      documents: true,
    },
  });
  mocks.keyContactForCategory.mockReturnValue(null);
  mocks.contactDisplayName.mockReturnValue("Ada Lovelace");

  mocks.prisma.client.findMany.mockResolvedValue([client()]);
  mocks.prisma.benefit.findMany.mockResolvedValue([]);
  mocks.prisma.document.findMany.mockResolvedValue([]);
});

describe("GET /api/benefits", () => {
  it("returns 401 without a session and runs no queries", async () => {
    mocks.getSession.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(await payload(response)).toEqual({
      success: false,
      error: "Unauthorized",
    });
    expect(mocks.prisma.client.findMany).not.toHaveBeenCalled();
  });

  it("scopes the plan read to the caller's accessible plans", async () => {
    mocks.listAccessiblePlanIds.mockResolvedValue(["plan-1", "plan-2"]);
    mocks.prisma.client.findMany.mockResolvedValue([
      client(),
      client({ id: "plan-2", companyName: "Beta" }),
    ]);

    await GET();

    expect(mocks.listAccessiblePlanIds).toHaveBeenCalledWith("user-1");
    expect(mocks.prisma.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["plan-1", "plan-2"] } },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
    );
  });

  it("returns no rows and skips the dependent reads when there are no plans", async () => {
    mocks.listAccessiblePlanIds.mockResolvedValue([]);
    mocks.prisma.client.findMany.mockResolvedValue([]);

    const response = await GET();
    const body = await payload(response);

    expect(body).toEqual({ success: true, benefits: [] });
    expect(mocks.prisma.benefit.findMany).not.toHaveBeenCalled();
    expect(mocks.prisma.document.findMany).not.toHaveBeenCalled();
  });

  it("selects only the completeness inputs and never the legacy preview mirror", async () => {
    await GET();

    const query = mocks.prisma.client.findMany.mock.calls[0][0];
    expect(query.select).toMatchObject({
      id: true,
      companyName: true,
      slug: true,
      status: true,
      categoryPortalVisibility: true,
      companyLogo: true,
      keyContacts: true,
    });
    expect(query.select.employeePortalPreview).toBeUndefined();
  });

  it("returns exactly four category rows per plan with the API labels", async () => {
    const response = await GET();
    const body = await payload(response);

    expect(body.benefits).toHaveLength(4);
    expect(body.benefits.map((row: any) => row.category)).toEqual([
      "Retirement",
      "Group Health",
      "Group Life",
      "Company / Plan Sponsor",
    ]);
    expect(body.benefits.map((row: any) => row.label)).toEqual([
      "Retirement Plan Benefits",
      "Health Insurance",
      "Life Insurance",
      "Wellness Programs",
    ]);
    expect(body.benefits.map((row: any) => row.visibilityKey)).toEqual([
      "Retirement",
      "Group Health",
      "Group Life",
      "Other",
    ]);
  });

  it("applies the caller's category scope to a collaborator", async () => {
    mocks.listOwnCategoryScopedPlans.mockResolvedValue(
      new Map([["plan-1", ["Group Health"]]]),
    );
    mocks.categoryWithinScope.mockImplementation(
      (scope: string[], category: string) => scope.includes(category),
    );

    const response = await GET();
    const body = await payload(response);

    expect(body.benefits).toHaveLength(1);
    expect(body.benefits[0].category).toBe("Group Health");
  });

  it("marks a missing Benefit row as not created and not published", async () => {
    const response = await GET();
    const body = await payload(response);
    const retirement = body.benefits.find(
      (row: any) => row.category === "Retirement",
    );

    expect(retirement.exists).toBe(false);
    expect(retirement.isEnabled).toBe(false);
    expect(retirement.title).toBe("Retirement Plan Benefits");
    expect(retirement.partnerLogo).toBeNull();
  });

  it("requires an existing row to be published", async () => {
    mocks.prisma.benefit.findMany.mockResolvedValue([
      benefit({ category: "Retirement", isEnabled: true }),
    ]);

    const body = await (await GET()).json();
    const retirement = body.benefits.find(
      (row: any) => row.category === "Retirement",
    );

    expect(retirement.exists).toBe(true);
    expect(retirement.isEnabled).toBe(true);
  });

  it("treats the plan visibility map and the benefit flag as independent hides", async () => {
    mocks.prisma.client.findMany.mockResolvedValue([
      client({
        categoryPortalVisibility: {
          Retirement: false,
          "Group Health": true,
          "Group Life": true,
          Other: true,
        },
      }),
    ]);
    mocks.prisma.benefit.findMany.mockResolvedValue([
      benefit({ category: "Retirement", isEnabled: true }),
      benefit({ category: "Group Health", isEnabled: false }),
      benefit({ category: "Group Life", isEnabled: true }),
    ]);

    const body = await (await GET()).json();
    const byCategory = Object.fromEntries(
      body.benefits.map((row: any) => [row.category, row.isEnabled]),
    );

    expect(byCategory.Retirement).toBe(false);
    expect(byCategory["Group Health"]).toBe(false);
    expect(byCategory["Group Life"]).toBe(true);
  });

  it("treats an absent visibility key as visible for an existing row", async () => {
    mocks.prisma.client.findMany.mockResolvedValue([
      client({ categoryPortalVisibility: {} }),
    ]);
    mocks.prisma.benefit.findMany.mockResolvedValue([
      benefit({ category: "Retirement", isEnabled: true }),
    ]);

    const body = await (await GET()).json();
    const retirement = body.benefits.find(
      (row: any) => row.category === "Retirement",
    );

    expect(retirement.isEnabled).toBe(true);
  });

  it("does not crash when visibility is null, a string or an array", async () => {
    for (const categoryPortalVisibility of [null, "not-json", [true]]) {
      mocks.prisma.client.findMany.mockResolvedValue([
        client({ categoryPortalVisibility }),
      ]);
      mocks.prisma.benefit.findMany.mockResolvedValue([
        benefit({ category: "Retirement", isEnabled: true }),
      ]);

      const response = await GET();
      expect(response.status).toBe(200);
      const body = await payload(response);
      expect(body.benefits).toHaveLength(4);
    }
  });

  it("falls back to the category label when the row title is empty", async () => {
    mocks.prisma.benefit.findMany.mockResolvedValue([
      benefit({ category: "Retirement", title: "" }),
    ]);

    const body = await (await GET()).json();
    const retirement = body.benefits.find(
      (row: any) => row.category === "Retirement",
    );

    expect(retirement.title).toBe("Retirement Plan Benefits");
  });

  it("maps a missing company name to Untitled plan", async () => {
    mocks.prisma.client.findMany.mockResolvedValue([
      client({ companyName: "" }),
    ]);

    const body = await (await GET()).json();

    expect(body.benefits[0].planName).toBe("Untitled plan");
  });

  it("drops soft-archived documents before the completeness check", async () => {
    mocks.prisma.document.findMany.mockResolvedValue([
      {
        clientId: "plan-1",
        type: "Document",
        category: "Retirement",
        storageKey: "org/plan-1/retirement.pdf",
        archivedAt: null,
      },
      {
        clientId: "plan-1",
        type: "Document",
        category: "Retirement",
        storageKey: "org/plan-1/archived.pdf",
        archivedAt: new Date(),
      },
    ]);

    await GET();

    const completenessInput = mocks.getBenefitCompleteness.mock.calls[0][1];
    expect(completenessInput.documents).toHaveLength(1);
    expect(completenessInput.documents[0].storageKey).toBe(
      "org/plan-1/retirement.pdf",
    );
  });

  it("resolves the plan's Key Contact for the matching category", async () => {
    mocks.keyContactForCategory.mockReturnValue({
      id: "contact-1",
      name: "Ada Lovelace",
      headshot: "",
      teamImage: " https://cdn.test/ada.png ",
    });

    const body = await (await GET()).json();
    const retirement = body.benefits.find(
      (row: any) => row.category === "Retirement",
    );

    expect(retirement.keyContact).toEqual({
      id: "contact-1",
      name: "Ada Lovelace",
      headshot: "https://cdn.test/ada.png",
    });
  });

  it("reports keyContact=null when the plan has no contact for the category", async () => {
    const body = await (await GET()).json();

    expect(body.benefits[0].keyContact).toBeNull();
  });

  it("keeps the last row when duplicate normalized categories exist", async () => {
    mocks.prisma.benefit.findMany.mockResolvedValue([
      benefit({ category: "Retirement", title: "First" }),
      benefit({ category: " retirement ", title: "Second" }),
    ]);

    const body = await (await GET()).json();
    const retirement = body.benefits.find(
      (row: any) => row.category === "Retirement",
    );

    expect(retirement.title).toBe("Second");
  });

  it("returns 500 when the plan query fails", async () => {
    mocks.prisma.client.findMany.mockRejectedValue(new Error("db down"));

    const response = await GET();

    expect(response.status).toBe(500);
    expect(await payload(response)).toEqual({
      success: false,
      error: "db down",
    });
  });

  it("returns 500 when the benefits query fails", async () => {
    mocks.prisma.benefit.findMany.mockRejectedValue(new Error("benefits down"));

    const response = await GET();

    expect(response.status).toBe(500);
    expect((await payload(response)).error).toBe("benefits down");
  });

  it("returns 500 when the documents query fails", async () => {
    mocks.prisma.document.findMany.mockRejectedValue(new Error("docs down"));

    const response = await GET();

    expect(response.status).toBe(500);
    expect((await payload(response)).error).toBe("docs down");
  });
});
