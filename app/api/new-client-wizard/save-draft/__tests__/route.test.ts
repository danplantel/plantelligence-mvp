import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "../route";

/**
 * `POST /api/new-client-wizard/save-draft` contract.
 *
 * Every autosave, explicit Save Draft and wizard transition funnels through
 * this route, so the assertions target the two things that must never drift:
 * what is written to the wizard-session sub-records, and when a Draft client
 * row is created versus updated (including the duplicate-name refusals).
 */

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getCategoryPortalVisibility: vi.fn((value: unknown) => value),
  resolvePersistedDocumentCategory: vi.fn(() => "retirement"),
  getOrCreateOrganizationForUser: vi.fn(async () => "org-1"),
  mirrorPlanContactsSafely: vi.fn(async () => {}),
  prisma: {
    newClientWizardSession: {
      findFirst: vi.fn(),
      update: vi.fn(async () => ({})),
    },
    newClientCompanyBasics: { upsert: vi.fn(async () => ({})) },
    newClientWelcomeStatement: { upsert: vi.fn(async () => ({})) },
    newClientKeyContacts: { upsert: vi.fn(async () => ({})) },
    newClientContactBuilder: { upsert: vi.fn(async () => ({})) },
    newClientComplianceDocuments: { upsert: vi.fn(async () => ({})) },
    newClientEmployeePortalPreview: {
      findUnique: vi.fn(),
      upsert: vi.fn(async () => ({})),
    },
    client: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    document: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
      create: vi.fn(async () => ({ id: "doc-1" })),
    },
  },
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getSession }));
vi.mock("@/lib/auth-options", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  default: mocks.prisma,
  prisma: mocks.prisma,
}));
vi.mock("@/lib/portal-category-visibility", () => ({
  getCategoryPortalVisibility: mocks.getCategoryPortalVisibility,
}));
vi.mock("@/lib/document-category", () => ({
  resolvePersistedDocumentCategory: mocks.resolvePersistedDocumentCategory,
}));
vi.mock("@/lib/duplicate-plan-name-error", () => ({
  DUPLICATE_PLAN_NAME_CODE: "DUPLICATE_PLAN_NAME",
}));
vi.mock("@/lib/organization", () => ({
  getOrCreateOrganizationForUser: mocks.getOrCreateOrganizationForUser,
}));
vi.mock("@/lib/teammates/contact-mirror.server", () => ({
  mirrorPlanContactsSafely: mocks.mirrorPlanContactsSafely,
}));

function saveRequest(body: unknown) {
  return new NextRequest(
    new URL("/api/new-client-wizard/save-draft", "http://localhost"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function malformedRequest() {
  return new NextRequest(
    new URL("/api/new-client-wizard/save-draft", "http://localhost"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    },
  );
}

async function payload(response: Response) {
  return response.json();
}

function companyBody(
  companyBasics: Record<string, unknown>,
  extra: Record<string, unknown> = {},
  currentStep = 1,
) {
  return { stepData: { companyBasics }, currentStep, ...extra };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});

  mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
  mocks.getCategoryPortalVisibility.mockImplementation((value) => value);
  mocks.resolvePersistedDocumentCategory.mockReturnValue("retirement");
  mocks.getOrCreateOrganizationForUser.mockResolvedValue("org-1");
  mocks.mirrorPlanContactsSafely.mockResolvedValue(undefined);

  mocks.prisma.newClientWizardSession.findFirst.mockResolvedValue({
    id: "sess-1",
  });
  mocks.prisma.newClientWizardSession.update.mockResolvedValue({});
  mocks.prisma.newClientCompanyBasics.upsert.mockResolvedValue({});
  mocks.prisma.newClientWelcomeStatement.upsert.mockResolvedValue({});
  mocks.prisma.newClientKeyContacts.upsert.mockResolvedValue({});
  mocks.prisma.newClientContactBuilder.upsert.mockResolvedValue({});
  mocks.prisma.newClientComplianceDocuments.upsert.mockResolvedValue({});
  mocks.prisma.newClientEmployeePortalPreview.findUnique.mockResolvedValue(
    null,
  );
  mocks.prisma.newClientEmployeePortalPreview.upsert.mockResolvedValue({});
  mocks.prisma.client.findFirst.mockResolvedValue(null);
  mocks.prisma.client.create.mockResolvedValue({
    id: "plan-new",
    organizationId: "org-1",
  });
  mocks.prisma.client.update.mockResolvedValue({
    id: "plan-existing",
    organizationId: "org-1",
  });
  mocks.prisma.document.deleteMany.mockResolvedValue({ count: 0 });
  mocks.prisma.document.create.mockResolvedValue({ id: "doc-1" });
});

describe("POST /api/new-client-wizard/save-draft", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    const response = await POST(
      saveRequest(companyBody({ companyName: "Acme" })),
    );

    expect(response.status).toBe(401);
    expect(await payload(response)).toEqual({ error: "Unauthorized" });
    expect(
      mocks.prisma.newClientWizardSession.findFirst,
    ).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed JSON body", async () => {
    const response = await POST(malformedRequest());

    expect(response.status).toBe(400);
    expect(await payload(response)).toMatchObject({
      error: "Invalid request body",
    });
  });

  it("returns 400 when stepData is missing", async () => {
    const response = await POST(saveRequest({ currentStep: 2 }));

    expect(response.status).toBe(400);
    expect(await payload(response)).toEqual({ error: "Missing step data" });
  });

  it("returns 404 when the caller has no active wizard session", async () => {
    mocks.prisma.newClientWizardSession.findFirst.mockResolvedValue(null);

    const response = await POST(
      saveRequest(companyBody({ companyName: "Acme" })),
    );

    expect(response.status).toBe(404);
    expect(await payload(response)).toEqual({
      error: "No active wizard session found",
    });
  });

  it("saves session sub-records without creating a client when there is no name yet", async () => {
    const response = await POST(
      saveRequest({
        stepData: {
          welcomeStatement: {
            headline: "Hello",
            bodyText: "Body",
            advisorName: "Advisor",
            advisorAvatar: "avatar.png",
          },
        },
        currentStep: 2,
      }),
    );

    const body = await payload(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      message: "Draft saved successfully",
      sessionId: "sess-1",
    });
    expect(body).not.toHaveProperty("clientId");
    expect(mocks.prisma.newClientWelcomeStatement.upsert).toHaveBeenCalledWith({
      where: { sessionId: "sess-1" },
      update: { headline: "Hello", bodyText: "Body" },
      create: {
        sessionId: "sess-1",
        headline: "Hello",
        bodyText: "Body",
      },
    });
    expect(mocks.prisma.newClientWizardSession.update).toHaveBeenCalledWith({
      where: { id: "sess-1" },
      data: {
        completed: false,
        currentStep: 2,
        updatedAt: expect.any(Date),
      },
    });
    expect(mocks.prisma.client.create).not.toHaveBeenCalled();
  });

  it("creates a Draft client from the company basics", async () => {
    const response = await POST(
      saveRequest(
        companyBody(
          {
            companyName: "  Acme Corp  ",
            planType: "prospect",
            companyWebsite: "acme.test",
            primaryColor: "#112233",
            secondaryColor: "#445566",
            missionHeadline: "Our mission",
          },
          {},
          3,
        ),
      ),
    );

    const body = await payload(response);

    expect(body).toMatchObject({
      success: true,
      sessionId: "sess-1",
      clientId: "plan-new",
    });
    expect(mocks.prisma.newClientCompanyBasics.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionId: "sess-1" },
        update: expect.objectContaining({
          companyName: "  Acme Corp  ",
          planType: "prospect",
        }),
      }),
    );
    expect(mocks.getOrCreateOrganizationForUser).toHaveBeenCalledWith("user-1");
    expect(mocks.prisma.client.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyName: "Acme Corp",
        status: "Draft",
        type: "prospect",
        currentStep: 3,
        brandColor: "#112233",
        secondaryColor: "#445566",
        missionHeadline: "Our mission",
        userId: "user-1",
        organizationId: "org-1",
      }),
    });
    expect(mocks.mirrorPlanContactsSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        actorUserId: "user-1",
        clientId: "plan-new",
      }),
    );
  });

  it("falls back to the welcome statement text for the mission copy", async () => {
    await POST(
      saveRequest({
        stepData: {
          companyBasics: { companyName: "Acme" },
          welcomeStatement: { headline: "Welcome!", bodyText: "Body copy" },
        },
        currentStep: 2,
      }),
    );

    expect(mocks.prisma.client.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        missionHeadline: "Welcome!",
        missionBody: "Body copy",
      }),
    });
  });

  it("mirrors brand images onto the legacy columns and keeps crop data", async () => {
    await POST(
      saveRequest(
        companyBody({
          companyName: "Acme",
          brandImages: {
            header: {
              url: "https://cdn.test/header.png",
              fileName: "header.png",
              cropData: { x: 1 },
            },
            thumbnail: {
              url: "https://cdn.test/thumb.png",
              fileName: "thumb.png",
            },
          },
        }),
      ),
    );

    expect(mocks.prisma.client.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        backgroundImg: "https://cdn.test/header.png",
        backgroundImgName: "header.png",
        thumbnailImg: "https://cdn.test/thumb.png",
        thumbnailImgName: "thumb.png",
        brandImagesCropData: {
          header: { x: 1 },
          thumbnail: null,
          secondaryBanner: null,
          favicon: null,
        },
      }),
    });
  });

  it("persists logo removal as null instead of omitting the column", async () => {
    await POST(
      saveRequest(
        companyBody({
          companyName: "Acme",
          companyLogo: null,
        }),
      ),
    );

    expect(mocks.prisma.newClientCompanyBasics.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          companyLogo: null,
          logoFileName: null,
        }),
      }),
    );
    expect(mocks.prisma.client.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyLogo: null,
        logoFileName: null,
        companyLogoCropData: null,
      }),
    });
  });

  it("normalizes contacts and merges the contact builder into them", async () => {
    await POST(
      saveRequest({
        stepData: {
          companyBasics: { companyName: "Acme" },
          keyContacts: {
            contacts: [{ id: "c1", name: "Existing" }],
            displayStyle: 2,
            cardBackgroundColor: "#fff",
            logoScale: 110,
          },
          contactBuilder: {
            id: "c2",
            fullName: "New Person",
            title: "HR Director",
            customRole: "hr",
            email: "hr@acme.test",
            phone: "555",
            showOnPortal: true,
            enableContactButton: true,
            meetingLink: "",
          },
          step3SubStep: "step3d",
        },
        currentStep: 3,
      }),
    );

    // The session record keeps the raw contact list; the contact-builder entry is
    // merged into the *client* row only.
    expect(mocks.prisma.newClientKeyContacts.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          contacts: expect.objectContaining({
            contacts: [{ id: "c1", name: "Existing" }],
            displayStyle: 2,
            step3SubStep: "step3d",
            cardBackgroundColor: "#fff",
            logoScale: 110,
          }),
        },
      }),
    );
    expect(mocks.prisma.client.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        keyContacts: expect.objectContaining({
          contacts: [
            { id: "c1", name: "Existing" },
            expect.objectContaining({ id: "c2", name: "New Person" }),
          ],
          displayStyle: 2,
        }),
      }),
    });
  });

  it("merges employee portal preview, disclaimers and category visibility", async () => {
    mocks.prisma.newClientEmployeePortalPreview.findUnique.mockResolvedValue({
      previewData: { existing: true, step5SubStep: "old" },
    });

    await POST(
      saveRequest({
        stepData: {
          companyBasics: { companyName: "Acme" },
          employeePortalPreview: {
            previewData: { newKey: "value" },
            categoryPortalVisibility: { retirement: true },
            step5SubStep: "disclaimers",
          },
          disclaimers: {
            disclaimers: [{ id: "d1" }],
            disclosuresText: "Text",
            useDefaultDisclosures: false,
          },
        },
        currentStep: 5,
      }),
    );

    expect(
      mocks.prisma.newClientEmployeePortalPreview.findUnique,
    ).toHaveBeenCalledWith({ where: { sessionId: "sess-1" } });
    expect(mocks.getCategoryPortalVisibility).toHaveBeenCalledWith({
      retirement: true,
    });
    expect(
      mocks.prisma.newClientEmployeePortalPreview.upsert,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionId: "sess-1" },
        update: {
          previewData: {
            existing: true,
            step5SubStep: "disclaimers",
            newKey: "value",
            categoryPortalVisibility: { retirement: true },
            disclaimers: [{ id: "d1" }],
            disclosuresText: "Text",
            useDefaultDisclosures: false,
          },
        },
      }),
    );
    expect(mocks.prisma.client.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        categoryPortalVisibility: { retirement: true },
        disclaimers: expect.objectContaining({ disclosuresText: "Text" }),
      }),
    });
  });

  it("updates the client resolved by clientId instead of creating one", async () => {
    mocks.prisma.client.findFirst.mockResolvedValueOnce({
      id: "plan-existing",
      organizationId: "org-1",
    });

    const response = await POST(
      saveRequest({
        ...companyBody({ companyName: "Acme" }),
        clientId: "plan-existing",
      }),
    );

    expect(await payload(response)).toMatchObject({
      clientId: "plan-existing",
    });
    expect(mocks.prisma.client.create).not.toHaveBeenCalled();
    expect(mocks.getOrCreateOrganizationForUser).not.toHaveBeenCalled();
    expect(mocks.prisma.client.update).toHaveBeenCalledWith({
      where: { id: "plan-existing" },
      data: expect.objectContaining({ companyName: "Acme", status: "Draft" }),
    });
  });

  it("refuses a name that belongs to a published plan", async () => {
    mocks.prisma.client.findFirst
      .mockResolvedValueOnce(null) // non-draft blocking lookup
      .mockResolvedValueOnce({ id: "plan-live", companyName: "Acme" });

    const response = await POST(
      saveRequest(companyBody({ companyName: "Acme" })),
    );

    expect(response.status).toBe(200);
    expect(await payload(response)).toEqual({
      success: false,
      error:
        "A plan with this name already exists. Cancel, use a different name, or confirm overwrite.",
      code: "DUPLICATE_PLAN_NAME",
      existingClientId: "plan-live",
      companyName: "Acme",
    });
    expect(mocks.prisma.client.create).not.toHaveBeenCalled();
    expect(mocks.prisma.client.update).not.toHaveBeenCalled();
  });

  it("refuses a name that belongs to an existing draft", async () => {
    mocks.prisma.client.findFirst
      .mockResolvedValueOnce(null) // no published plan with the name
      .mockResolvedValueOnce({ id: "plan-draft", companyName: "Acme" });

    const response = await POST(
      saveRequest(companyBody({ companyName: "Acme" })),
    );

    expect(await payload(response)).toMatchObject({
      success: false,
      code: "DUPLICATE_PLAN_NAME",
      existingClientId: "plan-draft",
    });
  });

  it("falls back to the same-name draft when the supplied clientId no longer resolves", async () => {
    mocks.prisma.client.findFirst
      .mockResolvedValueOnce(null) // by id
      .mockResolvedValueOnce({ id: "plan-draft", organizationId: "org-1" }); // legacy same-name draft

    const response = await POST(
      saveRequest({
        ...companyBody({ companyName: "Acme" }),
        clientId: "plan-gone",
      }),
    );

    expect(await payload(response)).toMatchObject({
      clientId: "plan-existing",
    });
    expect(mocks.prisma.client.create).not.toHaveBeenCalled();
    expect(mocks.prisma.client.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "plan-draft" } }),
    );
  });

  it("clears old documents before updating a draft with new documents", async () => {
    mocks.prisma.client.findFirst.mockResolvedValueOnce({
      id: "plan-existing",
      organizationId: "org-1",
    });

    await POST(
      saveRequest({
        stepData: {
          companyBasics: { companyName: "Acme" },
          complianceDocuments: {
            spdFile: {
              name: "SPD",
              originalFileName: "spd.pdf",
              fileUrl: "data:application/pdf;base64,AAAA",
            },
          },
        },
        clientId: "plan-existing",
        currentStep: 4,
      }),
    );

    expect(mocks.prisma.document.deleteMany).toHaveBeenCalledWith({
      where: { clientId: "plan-existing" },
    });
  });

  it("creates R2-backed documents without a file URL", async () => {
    await POST(
      saveRequest({
        stepData: {
          companyBasics: { companyName: "Acme" },
          complianceDocuments: {
            spdFile: {
              name: "SPD",
              originalFileName: "spd.pdf",
              storageKey: "clients/plan/spd.pdf",
              expirationDate: "2026-01-01",
            },
            retirementPlanDocuments: [
              { name: "Plan Doc", fileUrl: "/api/documents/x/view" },
            ],
            otherDocuments: [{ name: "SBC", file: "raw-base64" }],
          },
        },
        currentStep: 4,
      }),
    );

    expect(mocks.prisma.document.create).toHaveBeenCalledTimes(3);
    expect(mocks.prisma.document.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        type: "SPD",
        storageKey: "clients/plan/spd.pdf",
        fileUrl: "r2:stored",
        expirationDate: new Date("2026-01-01"),
        category: "retirement",
      }),
    });
    expect(mocks.prisma.document.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        type: "Document",
        fileUrl: "/api/documents/x/view",
        expirationDate: null,
      }),
    });
    expect(mocks.prisma.document.create).toHaveBeenNthCalledWith(3, {
      data: expect.objectContaining({
        type: "SBC",
        fileUrl: "data:application/pdf;base64,raw-base64",
      }),
    });
    expect(mocks.resolvePersistedDocumentCategory).toHaveBeenCalledTimes(3);
  });

  it("skips documents with no file payload", async () => {
    await POST(
      saveRequest({
        stepData: {
          companyBasics: { companyName: "Acme" },
          complianceDocuments: {
            spdFile: { name: "SPD" },
            otherDocuments: [{ name: "Empty", fileUrl: "   " }],
          },
        },
      }),
    );

    expect(mocks.prisma.document.create).not.toHaveBeenCalled();
  });

  it("rejects an invalid expiration date by storing null", async () => {
    await POST(
      saveRequest({
        stepData: {
          companyBasics: { companyName: "Acme" },
          complianceDocuments: {
            spdFile: {
              name: "SPD",
              fileUrl: "data:application/pdf;base64,AAAA",
              expirationDate: "not-a-date",
            },
          },
        },
      }),
    );

    expect(mocks.prisma.document.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ expirationDate: null }),
    });
  });

  it("returns 500 with the failure details", async () => {
    mocks.prisma.newClientWizardSession.findFirst.mockRejectedValue(
      new Error("db down"),
    );

    const response = await POST(
      saveRequest(companyBody({ companyName: "Acme" })),
    );

    expect(response.status).toBe(500);
    expect(await payload(response)).toEqual({
      error: "Failed to save draft",
      details: "db down",
      name: "Error",
    });
  });
});
