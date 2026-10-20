import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "../route";

/**
 * `POST /api/new-client-wizard/complete-v2` guards.
 *
 * The full publish (slug, R2 uploads, benefits, documents) is exercised
 * end-to-end in the manual checklist; these tests pin the contract at the edges
 * where a bug strands the user: auth, a missing session, missing step data, and
 * the "reopen the session" behaviour after a failed publish.
 */

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  ensureUniqueSlug: vi.fn(async () => "acme"),
  generateUniquePlanSlug: vi.fn(async () => "acme"),
  registerClientSlug: vi.fn(async () => {}),
  deleteClientAndScopedData: vi.fn(async () => {}),
  prisma: {
    newClientWizardSession: {
      findFirst: vi.fn(),
      update: vi.fn(async () => ({})),
      updateMany: vi.fn(async () => ({ count: 0 })),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    newClientCompanyBasics: {
      findFirst: vi.fn(),
      deleteMany: vi.fn(async () => ({})),
    },
    newClientWelcomeStatement: {
      findFirst: vi.fn(),
      deleteMany: vi.fn(async () => ({})),
    },
    newClientKeyContacts: {
      findFirst: vi.fn(),
      deleteMany: vi.fn(async () => ({})),
    },
    newClientContactBuilder: {
      findUnique: vi.fn(),
      deleteMany: vi.fn(async () => ({})),
    },
    newClientComplianceDocuments: {
      findFirst: vi.fn(),
      deleteMany: vi.fn(async () => ({})),
    },
    newClientEmployeePortalPreview: {
      findUnique: vi.fn(),
      deleteMany: vi.fn(async () => ({})),
    },
    client: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
    document: { create: vi.fn(), deleteMany: vi.fn() },
  },
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getSession }));
vi.mock("@/lib/auth-options", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  default: mocks.prisma,
  prisma: mocks.prisma,
}));
vi.mock("@/lib/resolve-user-primary-service-categories", () => ({
  resolveUserPrimaryServiceCategoryLabels: vi.fn(async () => []),
  userPrimaryServicesMapToBenefitsCategory: vi.fn(() => false),
}));
vi.mock("@/lib/r2", () => ({
  isR2Configured: vi.fn(() => false),
  buildBrandingKey: vi.fn(() => "key"),
  putObjectBuffer: vi.fn(async () => {}),
  getObjectFromR2: vi.fn(async () => null),
}));
vi.mock("@/lib/document-category", () => ({
  resolvePersistedDocumentCategory: vi.fn(() => "retirement"),
}));
vi.mock("@/lib/wizard-onboarding-background", () => ({
  getOnboardingAdvisorBackgroundImage: vi.fn(async () => null),
}));
vi.mock("@/lib/slug", () => ({
  generateUniquePlanSlug: mocks.generateUniquePlanSlug,
  ensureUniqueSlug: mocks.ensureUniqueSlug,
}));
vi.mock("@/lib/slug-registry", () => ({
  registerClientSlug: mocks.registerClientSlug,
}));
vi.mock("@/lib/delete-client-scoped-data", () => ({
  deleteClientAndScopedData: mocks.deleteClientAndScopedData,
}));

const prisma = mocks.prisma;

function completeRequest(body: unknown = {}) {
  return new NextRequest(
    new URL("/api/new-client-wizard/complete-v2", "http://localhost"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

async function payload(response: Response) {
  return response.json();
}

function completeSession() {
  return {
    id: "sess-1",
    userId: "user-1",
    currentStep: 5,
    completed: false,
    companyBasics: {
      companyName: "Acme",
      portalUrl: "acme",
      primaryColor: "#111",
      secondaryColor: "#222",
    },
    welcomeStatement: { headline: "Welcome", bodyText: "Body" },
    keyContacts: { contacts: [] },
    complianceDocuments: null,
    employeePortalPreview: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});

  mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
  mocks.ensureUniqueSlug.mockResolvedValue("acme");
  mocks.generateUniquePlanSlug.mockResolvedValue("acme");
  mocks.registerClientSlug.mockResolvedValue(undefined);

  prisma.newClientWizardSession.findFirst.mockResolvedValue(null);
  prisma.newClientCompanyBasics.findFirst.mockResolvedValue(null);
  prisma.newClientWelcomeStatement.findFirst.mockResolvedValue(null);
  prisma.newClientKeyContacts.findFirst.mockResolvedValue(null);
  prisma.newClientContactBuilder.findUnique.mockResolvedValue(null);
  prisma.newClientComplianceDocuments.findFirst.mockResolvedValue(null);
  prisma.newClientEmployeePortalPreview.findUnique.mockResolvedValue(null);
  prisma.client.create.mockResolvedValue({
    id: "plan-1",
    slug: "acme",
    organizationId: "org-1",
  });
  prisma.client.findFirst.mockResolvedValue(null);
  prisma.document.create.mockResolvedValue({ id: "doc-1" });
});

describe("POST /api/new-client-wizard/complete-v2", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    const response = await POST(completeRequest());

    expect(response.status).toBe(401);
    expect(await payload(response)).toEqual({ error: "Unauthorized" });
    expect(prisma.newClientWizardSession.findFirst).not.toHaveBeenCalled();
  });

  it("returns 404 when the caller has no active wizard session", async () => {
    const response = await POST(completeRequest());

    expect(response.status).toBe(404);
    expect(await payload(response)).toEqual({
      error: "No active wizard session",
    });
  });

  it("returns 400 and names the missing step records", async () => {
    prisma.newClientWizardSession.findFirst.mockResolvedValue({
      id: "sess-1",
      userId: "user-1",
      currentStep: 5,
      completed: false,
      companyBasics: null,
      welcomeStatement: null,
      keyContacts: null,
      complianceDocuments: null,
      employeePortalPreview: null,
    });

    const response = await POST(completeRequest());
    const body = await payload(response);

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "Missing required wizard data",
      details:
        "Missing required data: company basics, welcome statement, key contacts. Please complete all required steps before finishing the wizard.",
    });
    // The session is closed up-front, which is exactly why the error path must
    // reopen it (covered by the failure test below).
    expect(prisma.newClientWizardSession.update).toHaveBeenCalledWith({
      where: { id: "sess-1" },
      data: {
        completed: true,
        currentStep: 5,
        updatedAt: expect.any(Date),
      },
    });
  });

  it("closes the other incomplete sessions in parallel", async () => {
    prisma.newClientWizardSession.findFirst.mockResolvedValue({
      id: "sess-1",
      userId: "user-1",
      currentStep: 5,
      completed: false,
      companyBasics: null,
      welcomeStatement: null,
      keyContacts: null,
      complianceDocuments: null,
      employeePortalPreview: null,
    });

    await POST(completeRequest());

    expect(prisma.newClientWizardSession.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", completed: false, id: { not: "sess-1" } },
      data: { completed: true, updatedAt: expect.any(Date) },
    });
  });

  it("reopens the session after a failed publish and returns the error", async () => {
    prisma.newClientWizardSession.findFirst.mockResolvedValue(
      completeSession(),
    );
    prisma.client.create.mockRejectedValue(new Error("boom"));

    const response = await POST(completeRequest({ draftClientId: "plan-1" }));
    const body = await payload(response);

    expect(response.status).toBe(500);
    expect(body.error).toBe("Failed to create client");
    expect(body.details).toBe("boom");
    // The first updateMany closes sibling sessions; the reopen targets this one.
    expect(prisma.newClientWizardSession.updateMany).toHaveBeenCalledWith({
      where: { id: "sess-1", userId: "user-1" },
      data: { completed: false },
    });
    expect(mocks.registerClientSlug).not.toHaveBeenCalled();
  });
});
