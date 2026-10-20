import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  GET as getSession,
  POST as createSession,
  PUT as updateSession,
} from "../session/route";
import { GET as loadDraft } from "../load-draft/route";
import { GET as listDrafts } from "../list-drafts/route";
import { DELETE as deleteDraft } from "../delete-draft/route";
import { POST as cleanupSessions } from "../cleanup/route";

/**
 * Create Plan wizard session lifecycle.
 *
 * These five routes are what makes a draft resumable: opening a session,
 * loading its step data (including the legacy `step3SubStep` extraction and the
 * preview flattening), listing drafts, and deleting them. `cleanup` owns the
 * housekeeping deletes.
 */

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  mergeContacts: vi.fn((contacts: any[]) => contacts),
  prisma: {
    newClientWizardSession: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      delete: vi.fn(),
    },
    newClientCompanyBasics: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    newClientWelcomeStatement: { findFirst: vi.fn(), deleteMany: vi.fn() },
    newClientKeyContacts: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    newClientContactBuilder: { findUnique: vi.fn(), deleteMany: vi.fn() },
    newClientComplianceDocuments: { findFirst: vi.fn(), deleteMany: vi.fn() },
    newClientEmployeePortalPreview: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    client: { findMany: vi.fn(), deleteMany: vi.fn() },
    user: { findUnique: vi.fn() },
  },
  cleanupDeleteMany: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getSession }));
vi.mock("@/lib/auth-options", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  default: mocks.prisma,
  prisma: mocks.prisma,
}));
vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    newClientWizardSession = { deleteMany: mocks.cleanupDeleteMany };
  },
}));

vi.mock("@/lib/seed-onboarding-advisor-contacts", () => ({
  mergeOnboardingAdvisorContactsIntoKeyContacts: mocks.mergeContacts,
}));
vi.mock("@/lib/effective-wizard-user-setup", () => ({
  getEffectiveWizardUserSetup: vi.fn(async () => null),
}));
vi.mock("@/lib/resolve-user-primary-service-categories", () => ({
  resolveUserPrimaryServiceCategoryLabels: vi.fn(async () => []),
  userPrimaryServicesMapToBenefitsCategory: vi.fn(() => false),
}));
vi.mock("@/lib/wizard-onboarding-background", () => ({
  getOnboardingAdvisorBackgroundImage: vi.fn(async () => null),
}));

const prisma = mocks.prisma;

function putRequest(body: unknown) {
  return new NextRequest(
    new URL("/api/new-client-wizard/session", "http://localhost"),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function deleteRequest() {
  return new NextRequest(
    new URL("/api/new-client-wizard/delete-draft", "http://localhost"),
    { method: "DELETE" },
  );
}

async function payload(response: Response) {
  return response.json();
}

function sessionRecord(withData = true) {
  return {
    id: "sess-1",
    userId: "user-1",
    currentStep: 3,
    completed: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    companyBasics: withData ? { companyName: "Acme", brandImages: null } : null,
    welcomeStatement: withData ? { headline: "Welcome!" } : null,
    keyContacts: withData
      ? { contacts: { contacts: [], step3SubStep: "step3c" } }
      : null,
    complianceDocuments: withData ? { spdFile: null } : null,
    employeePortalPreview: withData
      ? {
          previewData: {
            step5SubStep: "disclaimers",
            disclaimers: [{ id: "d1" }],
          },
        }
      : null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });

  prisma.newClientWizardSession.findFirst.mockResolvedValue(null);
  prisma.newClientWizardSession.create.mockResolvedValue({ id: "sess-new" });
  prisma.newClientWizardSession.update.mockResolvedValue({ id: "sess-1" });
  prisma.newClientWizardSession.updateMany.mockResolvedValue({ count: 1 });
  prisma.newClientWizardSession.deleteMany.mockResolvedValue({ count: 1 });
  prisma.newClientWizardSession.delete.mockResolvedValue({ id: "sess-1" });

  prisma.newClientCompanyBasics.findFirst.mockResolvedValue(null);
  prisma.newClientCompanyBasics.upsert.mockResolvedValue({});
  prisma.newClientWelcomeStatement.findFirst.mockResolvedValue(null);
  prisma.newClientKeyContacts.findFirst.mockResolvedValue(null);
  prisma.newClientKeyContacts.upsert.mockResolvedValue({});
  prisma.newClientContactBuilder.findUnique.mockResolvedValue(null);
  prisma.newClientComplianceDocuments.findFirst.mockResolvedValue(null);
  prisma.newClientEmployeePortalPreview.findUnique.mockResolvedValue(null);
  prisma.newClientEmployeePortalPreview.upsert.mockResolvedValue({});
  prisma.client.findMany.mockResolvedValue([]);
  prisma.client.deleteMany.mockResolvedValue({ count: 1 });
  prisma.user.findUnique.mockResolvedValue(null);
  mocks.mergeContacts.mockImplementation((contacts: any[]) => contacts);
  mocks.cleanupDeleteMany
    .mockReset()
    .mockResolvedValueOnce({ count: 2 })
    .mockResolvedValueOnce({ count: 3 });
});

describe("GET /api/new-client-wizard/session", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    const response = await getSession();

    expect(response.status).toBe(401);
    expect(await payload(response)).toEqual({ error: "Unauthorized" });
  });

  it("returns the active session with its step records", async () => {
    prisma.newClientWizardSession.findFirst.mockResolvedValue(sessionRecord());

    const response = await getSession();
    const body = await payload(response);

    expect(body.session.id).toBe("sess-1");
    expect(prisma.newClientWizardSession.findFirst).toHaveBeenCalledWith({
      where: { userId: "user-1", completed: false },
      include: {
        companyBasics: true,
        welcomeStatement: true,
        keyContacts: true,
        complianceDocuments: true,
        employeePortalPreview: true,
      },
    });
  });

  it("returns 500 when the lookup fails", async () => {
    prisma.newClientWizardSession.findFirst.mockRejectedValue(
      new Error("db down"),
    );

    const response = await getSession();

    expect(response.status).toBe(500);
    expect(await payload(response)).toEqual({ error: "Internal server error" });
  });
});

describe("POST /api/new-client-wizard/session", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    const response = await createSession();

    expect(response.status).toBe(401);
    expect(prisma.newClientWizardSession.create).not.toHaveBeenCalled();
  });

  it("reuses the caller's active session", async () => {
    prisma.newClientWizardSession.findFirst.mockResolvedValue({ id: "sess-1" });

    const response = await createSession();

    expect(await payload(response)).toEqual({ session: { id: "sess-1" } });
    expect(prisma.newClientWizardSession.create).not.toHaveBeenCalled();
  });

  it("creates a first-step session when none is active", async () => {
    const response = await createSession();

    expect(prisma.newClientWizardSession.create).toHaveBeenCalledWith({
      data: { userId: "user-1", currentStep: 1, completed: false },
    });
    expect(await payload(response)).toEqual({ session: { id: "sess-new" } });
  });

  it("returns 500 when creation fails", async () => {
    prisma.newClientWizardSession.create.mockRejectedValue(
      new Error("db down"),
    );

    const response = await createSession();

    expect(response.status).toBe(500);
  });
});

describe("PUT /api/new-client-wizard/session", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    const response = await updateSession(putRequest({ currentStep: 2 }));

    expect(response.status).toBe(401);
  });

  it("returns 404 without an active session", async () => {
    const response = await updateSession(putRequest({ currentStep: 2 }));

    expect(response.status).toBe(404);
    expect(await payload(response)).toEqual({
      error: "No active wizard session",
    });
  });

  it("persists the current step", async () => {
    prisma.newClientWizardSession.findFirst.mockResolvedValue({ id: "sess-1" });

    const response = await updateSession(putRequest({ currentStep: 4 }));

    expect(prisma.newClientWizardSession.update).toHaveBeenCalledWith({
      where: { id: "sess-1" },
      data: { currentStep: 4 },
    });
    expect(await payload(response)).toEqual({ session: { id: "sess-1" } });
  });

  it("returns 500 when the update fails", async () => {
    prisma.newClientWizardSession.findFirst.mockResolvedValue({ id: "sess-1" });
    prisma.newClientWizardSession.update.mockRejectedValue(
      new Error("db down"),
    );

    const response = await updateSession(putRequest({ currentStep: 4 }));

    expect(response.status).toBe(500);
  });
});

describe("GET /api/new-client-wizard/load-draft", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    const response = await loadDraft(deleteRequest() as any);

    expect(response.status).toBe(401);
  });

  it("reports no draft when the caller has no active session", async () => {
    const response = await loadDraft(deleteRequest() as any);
    const body = await payload(response);

    expect(body).toMatchObject({ success: true, data: null });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("builds step data and defaults an empty hero title", async () => {
    const record = sessionRecord();
    // No stored hero copy anywhere: not on companyBasics, not in _meta, not on
    // the welcome mirror.
    record.welcomeStatement = {} as any;
    prisma.newClientWizardSession.findFirst.mockResolvedValue(record);

    const response = await loadDraft(deleteRequest() as any);
    const body = await payload(response);

    expect(body.data.stepData.companyBasics.heroTitle).toBe(
      "Welcome to the Acme Benefits Hub!",
    );
    expect(body.data.stepData.companyBasics.brandImages._meta.heroTitle).toBe(
      "Welcome to the Acme Benefits Hub!",
    );
    expect(body.data.stepData.welcomeStatement).toEqual({});
    expect(body.data.currentStep).toBe(3);
    expect(body.data.sessionId).toBe("sess-1");
  });

  it("keeps a hero title supplied by the welcome statement", async () => {
    const record = sessionRecord();
    record.companyBasics = { companyName: "Acme", brandImages: null } as any;
    record.welcomeStatement = { headline: "Already set" } as any;
    prisma.newClientWizardSession.findFirst.mockResolvedValue(record);

    const response = await loadDraft(deleteRequest() as any);
    const body = await payload(response);

    expect(body.data.stepData.companyBasics.heroTitle).toBeUndefined();
    expect(body.data.stepData.welcomeStatement).toEqual({
      headline: "Already set",
    });
  });

  it("lifts the legacy step3SubStep out of keyContacts", async () => {
    prisma.newClientWizardSession.findFirst.mockResolvedValue(sessionRecord());

    const response = await loadDraft(deleteRequest() as any);
    const body = await payload(response);

    expect(body.data.stepData.step3SubStep).toEqual({ step3SubStep: "step3c" });
    expect(body.data.stepData.keyContacts.contacts).toEqual([]);
  });

  it("flattens the portal preview and surfaces its disclaimers", async () => {
    prisma.newClientWizardSession.findFirst.mockResolvedValue(sessionRecord());

    const response = await loadDraft(deleteRequest() as any);
    const body = await payload(response);

    expect(body.data.stepData.employeePortalPreview).toEqual({
      step5SubStep: "disclaimers",
      disclaimers: [{ id: "d1" }],
    });
    expect(body.data.stepData.disclaimers).toEqual({
      disclaimers: [{ id: "d1" }],
    });
  });

  it("persists corrected contacts when onboarding seeding adds one", async () => {
    const record = sessionRecord();
    record.keyContacts = { contacts: { contacts: [] } } as any;
    prisma.newClientWizardSession.findFirst.mockResolvedValue(record);
    mocks.mergeContacts.mockReturnValue([{ id: "seeded", name: "Advisor" }]);

    const response = await loadDraft(deleteRequest() as any);
    const body = await payload(response);

    expect(prisma.newClientKeyContacts.upsert).toHaveBeenCalledWith({
      where: { sessionId: "sess-1" },
      update: {
        contacts: { contacts: [{ id: "seeded", name: "Advisor" }] },
      },
      create: {
        sessionId: "sess-1",
        contacts: { contacts: [{ id: "seeded", name: "Advisor" }] },
      },
    });
    expect(body.data.stepData.keyContacts.contacts).toEqual([
      { id: "seeded", name: "Advisor" },
    ]);
  });

  it("returns 500 when loading fails", async () => {
    prisma.newClientWizardSession.findFirst.mockRejectedValue(
      new Error("db down"),
    );

    const response = await loadDraft(deleteRequest() as any);

    expect(response.status).toBe(500);
    expect(await payload(response)).toEqual({ error: "Failed to load draft" });
  });
});

describe("GET /api/new-client-wizard/list-drafts", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    const response = await listDrafts(deleteRequest() as any);

    expect(response.status).toBe(401);
  });

  it("lists the caller's drafts newest first", async () => {
    prisma.client.findMany.mockResolvedValue([
      { id: "d1", companyName: "Acme" },
      { id: "d2", companyName: "Beta" },
    ]);

    const response = await listDrafts(deleteRequest() as any);
    const body = await payload(response);

    expect(prisma.client.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", status: "Draft" },
      orderBy: { updatedAt: "desc" },
      select: expect.objectContaining({
        id: true,
        companyName: true,
        updatedAt: true,
      }),
    });
    expect(body).toMatchObject({ success: true, count: 2 });
    expect(body.drafts).toHaveLength(2);
  });

  it("returns 500 when the query fails", async () => {
    prisma.client.findMany.mockRejectedValue(new Error("db down"));

    const response = await listDrafts(deleteRequest() as any);

    expect(response.status).toBe(500);
    expect(await payload(response)).toEqual({
      error: "Failed to fetch drafts",
    });
  });
});

describe("DELETE /api/new-client-wizard/delete-draft", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    const response = await deleteDraft(deleteRequest());

    expect(response.status).toBe(401);
  });

  it("succeeds with a no-op when there is no draft", async () => {
    const response = await deleteDraft(deleteRequest());

    expect(await payload(response)).toEqual({
      success: true,
      message: "No draft found to delete",
    });
    expect(prisma.client.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes every session record and the caller's draft clients", async () => {
    prisma.newClientWizardSession.findFirst.mockResolvedValue({ id: "sess-1" });
    (prisma as any).$transaction = vi.fn(async (fn: any) => fn(prisma));

    const response = await deleteDraft(deleteRequest());

    expect(await payload(response)).toEqual({
      success: true,
      message: "Draft deleted successfully",
    });
    expect(prisma.newClientCompanyBasics.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: "sess-1" },
    });
    expect(prisma.newClientWelcomeStatement.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: "sess-1" },
    });
    expect(prisma.newClientKeyContacts.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: "sess-1" },
    });
    expect(prisma.newClientContactBuilder.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: "sess-1" },
    });
    expect(prisma.newClientComplianceDocuments.deleteMany).toHaveBeenCalledWith(
      {
        where: { sessionId: "sess-1" },
      },
    );
    expect(
      prisma.newClientEmployeePortalPreview.deleteMany,
    ).toHaveBeenCalledWith({
      where: { sessionId: "sess-1" },
    });
    expect(prisma.newClientWizardSession.delete).toHaveBeenCalledWith({
      where: { id: "sess-1" },
    });
    expect(prisma.client.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", status: "Draft" },
    });
  });

  it("returns 500 when the transaction fails", async () => {
    prisma.newClientWizardSession.findFirst.mockResolvedValue({ id: "sess-1" });
    (prisma as any).$transaction = vi.fn(async () => {
      throw new Error("tx failed");
    });

    const response = await deleteDraft(deleteRequest());

    expect(response.status).toBe(500);
    expect(await payload(response)).toEqual({
      error: "Failed to delete draft",
    });
  });
});

describe("POST /api/new-client-wizard/cleanup", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    const response = await cleanupSessions(deleteRequest());

    expect(response.status).toBe(401);
  });

  it("reports how many completed and stale sessions were removed", async () => {
    const response = await cleanupSessions(deleteRequest());

    expect(mocks.cleanupDeleteMany).toHaveBeenCalledTimes(2);
    expect(mocks.cleanupDeleteMany.mock.calls[0][0]).toMatchObject({
      where: { userId: "user-1", completed: true },
    });
    expect(mocks.cleanupDeleteMany.mock.calls[1][0].where).toMatchObject({
      userId: "user-1",
      createdAt: { lt: expect.any(Date) },
    });
    expect(await payload(response)).toEqual({
      success: true,
      message: "Cleaned up 2 completed sessions and 3 old sessions",
    });
  });

  it("returns 500 when cleanup fails", async () => {
    mocks.cleanupDeleteMany.mockReset().mockRejectedValue(new Error("db down"));

    const response = await cleanupSessions(deleteRequest());

    expect(response.status).toBe(500);
    expect(await payload(response)).toEqual({ error: "Internal server error" });
  });
});
