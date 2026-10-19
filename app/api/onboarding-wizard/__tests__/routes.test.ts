import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => {
  const fn = () => vi.fn();
  return {
    wizardSession: {
      findFirst: fn(),
      findMany: fn(),
      create: fn(),
      update: fn(),
    },
    wizardClientProfile: { upsert: fn(), findUnique: fn() },
    wizardTeamSize: { upsert: fn(), findUnique: fn() },
    wizardServices: { upsert: fn(), findUnique: fn() },
    wizardInsuranceLicensing: { upsert: fn(), findUnique: fn() },
    wizardBranding: { upsert: fn(), findUnique: fn() },
    wizardUserSetup: { upsert: fn(), findUnique: fn() },
    wizardDisclaimers: { upsert: fn(), findUnique: fn() },
    wizardTeamMembers: { upsert: fn(), findUnique: fn() },
    wizardBenefitTypes: { upsert: fn(), findFirst: fn() },
    wizardEmployerScope: { upsert: fn(), findFirst: fn() },
    user: { findUnique: fn(), findFirst: fn(), update: fn() },
    futureContact: { findFirst: fn(), create: fn() },
  };
});

const getServerSession = vi.hoisted(() => vi.fn());
const syncOrganizationIdentity = vi.hoisted(() => vi.fn(async () => {}));
const completeWizardOnboarding = vi.hoisted(() =>
  vi.fn(async () => ({ updatedFields: ["organizationName"] })),
);
const sendSignUpConfirmationEmail = vi.hoisted(() =>
  vi.fn(async () => undefined),
);
const sendOnboardingResumeEmail = vi.hoisted(() =>
  vi.fn(async () => undefined),
);
const createOnboardingResumeToken = vi.hoisted(() =>
  vi.fn(async () => "resume-token"),
);
const verifyOnboardingResumeToken = vi.hoisted(() => vi.fn());
const encode = vi.hoisted(() => vi.fn(async () => "session-jwt"));

vi.mock("@/lib/prisma", () => ({ default: prisma }));
vi.mock("next-auth", () => ({ getServerSession }));
vi.mock("@/lib/auth-options", () => ({ authOptions: {} }));
vi.mock("@/lib/organization", () => ({ syncOrganizationIdentity }));
vi.mock("@/lib/wizard-completion", () => ({ completeWizardOnboarding }));
vi.mock("@/lib/email", () => ({
  sendSignUpConfirmationEmail,
  sendOnboardingResumeEmail,
}));
vi.mock("@/lib/onboarding-resume-token.server", () => ({
  createOnboardingResumeToken,
  verifyOnboardingResumeToken,
}));
vi.mock("next-auth/jwt", () => ({ encode }));

import { POST as completePost } from "../complete/route";
import { POST as sendResumeEmailPost } from "../send-resume-email/route";
import { POST as requestResumeLinkPost } from "../request-resume-link/route";
import { GET as resumeGet } from "../resume/route";
import {
  GET as sessionGet,
  POST as sessionPost,
  PATCH as sessionPatch,
} from "../session/route";
import { GET as statusGet } from "../onboarding-status/route";
import {
  GET as clientProfileGet,
  POST as clientProfilePost,
} from "../client-profile/route";
import {
  GET as teamSizeGet,
  POST as teamSizePost,
} from "../team-size/route";
import {
  GET as servicesGet,
  POST as servicesPost,
} from "../services/route";
import {
  GET as insuranceGet,
  POST as insurancePost,
} from "../insurance-licensing/route";
import {
  GET as brandingGet,
  POST as brandingPost,
} from "../branding/route";
import {
  GET as userSetupGet,
  POST as userSetupPost,
} from "../user-setup/route";
import {
  GET as disclaimersGet,
  POST as disclaimersPost,
} from "../disclaimers/route";
import {
  GET as teamMembersGet,
  POST as teamMembersPost,
} from "../team-members/route";
import {
  GET as benefitTypesGet,
  POST as benefitTypesPost,
} from "../benefit-types/route";
import {
  GET as employerScopeGet,
  POST as employerScopePost,
} from "../employer-scope/route";

const session = {
  user: { id: "user-1", email: "ada@example.com", name: "Ada" },
};

const req = {} as any;

function jsonRequest(body: unknown, url = "http://localhost/api/test"): any {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function rawRequest(body: string, url = "http://localhost/api/test") {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

function patchRequest(body: unknown): any {
  return new Request("http://localhost/api/onboarding-wizard/session", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function bodyOf(response: Response) {
  return response.json();
}

function signIn() {
  getServerSession.mockResolvedValue(session);
}

function signOut() {
  getServerSession.mockResolvedValue(null);
}

describe("onboarding API routes", () => {
  beforeEach(() => {
    signIn();
    prisma.wizardSession.findFirst.mockResolvedValue({ id: "session-1" });
    prisma.wizardSession.findMany.mockResolvedValue([{ id: "session-1" }]);
    prisma.wizardSession.create.mockResolvedValue({ id: "created-session" });
    prisma.wizardSession.update.mockResolvedValue({
      id: "session-1",
      currentStep: 3,
    });
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
    });
    prisma.user.findFirst.mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
    });
    prisma.user.update.mockResolvedValue({});
    prisma.futureContact.findFirst.mockResolvedValue(null);
    prisma.futureContact.create.mockResolvedValue({});
  });

  describe("auth guard", () => {
    it.each([
      ["client profile POST", () => clientProfilePost(jsonRequest({}))],
      ["client profile GET", () => clientProfileGet()],
      ["team size POST", () => teamSizePost(jsonRequest({}))],
      ["services POST", () => servicesPost(jsonRequest({}))],
      ["insurance POST", () => insurancePost(jsonRequest({}))],
      ["branding POST", () => brandingPost(jsonRequest({}))],
      ["user setup POST", () => userSetupPost(jsonRequest({}))],
      ["disclaimers POST", () => disclaimersPost(jsonRequest({}))],
      ["team members POST", () => teamMembersPost(jsonRequest({}))],
      ["benefit types POST", () => benefitTypesPost(jsonRequest({}))],
      ["employer scope POST", () => employerScopePost(jsonRequest({}))],
      ["complete POST", () => completePost(jsonRequest({}))],
      ["session GET", () => sessionGet()],
      ["session POST", () => sessionPost()],
      ["status GET", () => statusGet(req)],
      ["send resume email POST", () => sendResumeEmailPost(new Request("http://localhost/api/test"))],
    ])("%s returns 401 without a session", async (_name, invoke) => {
      signOut();

      const response = await invoke();

      expect(response.status).toBe(401);
      expect(await bodyOf(response)).toEqual({ error: "Unauthorized" });
    });
  });

  describe("session route", () => {
    it("GET returns the active session", async () => {
      const response = await sessionGet();

      expect(response.status).toBe(200);
      expect(await bodyOf(response)).toEqual({
        session: { id: "session-1" },
      });
    });

    it("POST reuses an existing session", async () => {
      const response = await sessionPost();

      expect(await bodyOf(response)).toEqual({
        session: { id: "session-1" },
      });
      expect(prisma.wizardSession.create).not.toHaveBeenCalled();
    });

    it("POST creates a session when none exists", async () => {
      prisma.wizardSession.findFirst.mockResolvedValue(null);

      const response = await sessionPost();

      expect(prisma.wizardSession.create).toHaveBeenCalledWith({
        data: { userId: "user-1", currentStep: 1, completed: false },
      });
      expect(await bodyOf(response)).toEqual({
        session: { id: "created-session" },
      });
    });

    it("PATCH rejects an out-of-range step", async () => {
      const response = await sessionPatch(patchRequest({ currentStep: 6 }));

      expect(response.status).toBe(400);
      expect(prisma.wizardSession.update).not.toHaveBeenCalled();
    });

    it("PATCH returns 404 without an active session", async () => {
      prisma.wizardSession.findFirst.mockResolvedValue(null);

      const response = await sessionPatch(patchRequest({ currentStep: 3 }));

      expect(response.status).toBe(404);
    });

    it("PATCH updates the current step", async () => {
      const response = await sessionPatch(patchRequest({ currentStep: 3 }));

      expect(response.status).toBe(200);
      expect(prisma.wizardSession.update).toHaveBeenCalledWith({
        where: { id: "session-1" },
        data: { currentStep: 3 },
      });
    });
  });

  describe("onboarding-status route", () => {
    it("reports completion from a completed session", async () => {
      prisma.wizardSession.findFirst.mockResolvedValue({ id: "completed" });

      const response = await statusGet(req);

      expect(await bodyOf(response)).toEqual({ completed: true });
      expect(prisma.wizardSession.findFirst).toHaveBeenCalledWith({
        where: { userId: "user-1", completed: true },
      });
    });

    it("reports incomplete when no completed session exists", async () => {
      prisma.wizardSession.findFirst.mockResolvedValue(null);

      const response = await statusGet(req);

      expect(await bodyOf(response)).toEqual({ completed: false });
    });
  });

  describe("client-profile route", () => {
    it("POST rejects an invalid organization type", async () => {
      const response = await clientProfilePost(
        jsonRequest({ organizationType: "not-a-type" }),
      );

      expect(response.status).toBe(400);
      expect(prisma.wizardClientProfile.upsert).not.toHaveBeenCalled();
    });

    it("POST creates a session when needed and upserts the profile", async () => {
      prisma.wizardSession.findFirst.mockResolvedValue(null);
      prisma.wizardClientProfile.upsert.mockResolvedValue({
        organizationType: "financial_advisor_ria",
      });

      const response = await clientProfilePost(
        jsonRequest({ organizationType: "financial_advisor_ria" }),
      );

      expect(prisma.wizardSession.create).toHaveBeenCalled();
      expect(prisma.wizardClientProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sessionId: "created-session" },
          create: expect.objectContaining({
            sessionId: "created-session",
            organizationType: "financial_advisor_ria",
          }),
        }),
      );
      expect(response.status).toBe(200);
    });

    it("GET returns null data without a session", async () => {
      prisma.wizardSession.findFirst.mockResolvedValue(null);

      const response = await clientProfileGet();

      expect(await bodyOf(response)).toEqual({ clientProfile: null });
    });

    it("GET returns the stored profile", async () => {
      prisma.wizardClientProfile.findUnique.mockResolvedValue({
        organizationType: "other",
      });

      const response = await clientProfileGet();

      expect(await bodyOf(response)).toEqual({
        clientProfile: { organizationType: "other" },
      });
    });
  });

  describe("team-size route", () => {
    it("POST upserts the band", async () => {
      prisma.wizardTeamSize.upsert.mockResolvedValue({ teamSize: "2_5" });

      const response = await teamSizePost(jsonRequest({ teamSize: "2_5" }));

      expect(prisma.wizardTeamSize.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sessionId: "session-1" },
          create: { sessionId: "session-1", teamSize: "2_5" },
        }),
      );
      expect(await bodyOf(response)).toEqual({
        teamSize: { teamSize: "2_5" },
      });
    });

    it("GET returns null without a session", async () => {
      prisma.wizardSession.findFirst.mockResolvedValue(null);

      const response = await teamSizeGet();

      expect(await bodyOf(response)).toEqual({ teamSize: null });
    });

    it("GET returns the stored band", async () => {
      prisma.wizardTeamSize.findUnique.mockResolvedValue({ teamSize: "solo" });

      const response = await teamSizeGet();

      expect(await bodyOf(response)).toEqual({
        teamSize: { teamSize: "solo" },
      });
    });
  });

  describe("services route", () => {
    it("POST upserts the selected services", async () => {
      prisma.wizardServices.upsert.mockResolvedValue({
        services: ["retirement"],
      });

      const response = await servicesPost(
        jsonRequest({ services: ["retirement"] }),
      );

      expect(prisma.wizardServices.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sessionId: "session-1" },
          create: { sessionId: "session-1", services: ["retirement"] },
        }),
      );
      expect(response.status).toBe(200);
    });

    it("POST creates a session when none exists", async () => {
      prisma.wizardSession.findFirst.mockResolvedValue(null);
      prisma.wizardServices.upsert.mockResolvedValue({ services: [] });

      await servicesPost(jsonRequest({ services: [] }));

      expect(prisma.wizardSession.create).toHaveBeenCalledWith({
        data: { userId: "user-1" },
      });
    });

    it("GET returns null without a session", async () => {
      prisma.wizardSession.findFirst.mockResolvedValue(null);

      const response = await servicesGet();

      expect(await bodyOf(response)).toEqual({ services: null });
    });

    it("GET returns the stored services", async () => {
      prisma.wizardServices.findUnique.mockResolvedValue({
        services: ["group_health"],
      });

      const response = await servicesGet();

      expect(await bodyOf(response)).toEqual({
        services: { services: ["group_health"] },
      });
    });
  });

  describe("insurance-licensing route", () => {
    it("POST applies defaults for missing arrays", async () => {
      prisma.wizardInsuranceLicensing.upsert.mockResolvedValue({
        offersInsurance: false,
      });

      await insurancePost(jsonRequest({ offersInsurance: false }));

      expect(prisma.wizardInsuranceLicensing.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            licenseTypes: [],
            statesLicensed: [],
            licenseNumbers: {},
            attestation: false,
          }),
        }),
      );
    });

    it("GET returns null without a session", async () => {
      prisma.wizardSession.findFirst.mockResolvedValue(null);

      const response = await insuranceGet(req);

      expect(await bodyOf(response)).toEqual({ insuranceLicensing: null });
    });

    it("GET returns the stored licensing data", async () => {
      prisma.wizardInsuranceLicensing.findUnique.mockResolvedValue({
        offersInsurance: true,
      });

      const response = await insuranceGet(req);

      expect(await bodyOf(response)).toEqual({
        insuranceLicensing: { offersInsurance: true },
      });
    });
  });

  describe("branding route", () => {
    it("POST rejects an invalid website", async () => {
      const response = await brandingPost(
        jsonRequest({ website: "not a url" }),
      );

      expect(response.status).toBe(400);
      expect(prisma.wizardBranding.upsert).not.toHaveBeenCalled();
    });

    it("POST normalizes proxy URLs back to R2 keys and derives brandColor", async () => {
      prisma.wizardBranding.upsert.mockResolvedValue({ id: "branding-1" });

      await brandingPost(
        jsonRequest({
          logo: "/api/r2/object?key=org%2Flogo.png",
          primaryColor: "#111111",
          secondaryColor: "#222222",
          website: "acme.example",
        }),
      );

      const payload = prisma.wizardBranding.upsert.mock.calls[0][0];
      expect(payload.create.logo).toBe("org/logo.png");
      expect(payload.create.brandColor).toBe("#111111");
    });

    it("GET falls back to the most recent completed session", async () => {
      prisma.wizardSession.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "completed-session" });
      prisma.wizardBranding.findUnique.mockResolvedValue({
        organizationName: "Acme",
      });

      const response = await brandingGet(req);

      expect(prisma.wizardBranding.findUnique).toHaveBeenCalledWith({
        where: { sessionId: "completed-session" },
      });
      expect(await bodyOf(response)).toEqual({
        branding: { organizationName: "Acme" },
      });
    });

    it("GET returns null when no session exists", async () => {
      prisma.wizardSession.findFirst.mockResolvedValue(null);

      const response = await brandingGet(req);

      expect(await bodyOf(response)).toEqual({ branding: null });
    });
  });

  describe("user-setup route", () => {
    it("POST merges partial data with the existing row", async () => {
      prisma.wizardUserSetup.findUnique.mockResolvedValue({
        name: "Old Name",
        email: "old@example.com",
        organizationEmail: "org@example.com",
        phone: "1112223333",
        phoneExtension: null,
        title: "Advisor",
        designations: ["CFP"],
        headshot: "",
        headshotData: null,
        backgroundImage: null,
        backgroundFileName: null,
        saveAsContact: true,
      });
      prisma.wizardUserSetup.upsert.mockResolvedValue({ name: "New Name" });

      await userSetupPost(jsonRequest({ name: "New Name" }));

      const payload = prisma.wizardUserSetup.upsert.mock.calls[0][0];
      expect(payload.update).toMatchObject({
        name: "New Name",
        email: "old@example.com",
        title: "Advisor",
      });
    });

    it("POST normalizes proxy image URLs and mirrors the user fields", async () => {
      prisma.wizardUserSetup.findUnique.mockResolvedValue(null);
      prisma.wizardUserSetup.upsert.mockResolvedValue({});
      syncOrganizationIdentity.mockClear();

      await userSetupPost(
        jsonRequest({
          headshot: "/api/r2/object?key=org%2Fhead.png",
          name: "Ada",
          phone: "2135888888",
          organizationEmail: "org@example.com",
        }),
      );

      expect(prisma.wizardUserSetup.upsert.mock.calls[0][0].create.headshot).toBe(
        "org/head.png",
      );
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-1" },
          data: expect.objectContaining({
            phone: "2135888888",
            organizationEmail: "org@example.com",
          }),
        }),
      );
      expect(syncOrganizationIdentity).toHaveBeenCalledWith("user-1");
    });

    it("GET falls back to another session's user setup", async () => {
      prisma.wizardUserSetup.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ name: "Recovered" });
      prisma.wizardSession.findMany.mockResolvedValue([
        { id: "session-1" },
        { id: "session-2" },
      ]);

      const response = await userSetupGet(req);

      expect(await bodyOf(response)).toEqual({
        userSetup: { name: "Recovered" },
      });
    });

    it("GET returns null without a session", async () => {
      prisma.wizardSession.findFirst.mockResolvedValue(null);

      const response = await userSetupGet(req);

      expect(await bodyOf(response)).toEqual({ userSetup: null });
    });
  });

  describe("disclaimers route", () => {
    it("POST upserts the disclaimer array", async () => {
      const disclaimers = [{ id: "1", text: "copy" }];

      await disclaimersPost(jsonRequest({ disclaimers }));

      expect(prisma.wizardDisclaimers.upsert).toHaveBeenCalledWith({
        where: { sessionId: "session-1" },
        update: { disclaimers },
        create: { sessionId: "session-1", disclaimers },
      });
    });

    it("GET returns null without a session", async () => {
      prisma.wizardSession.findFirst.mockResolvedValue(null);

      const response = await disclaimersGet(req);

      expect(await bodyOf(response)).toEqual({ disclaimers: null });
    });

    it("GET returns the stored disclaimers", async () => {
      prisma.wizardDisclaimers.findUnique.mockResolvedValue({
        disclaimers: [],
      });

      const response = await disclaimersGet(req);

      expect(await bodyOf(response)).toEqual({
        disclaimers: { disclaimers: [] },
      });
    });
  });

  describe("team-members route", () => {
    it("POST defaults members to an empty array", async () => {
      prisma.wizardTeamMembers.upsert.mockResolvedValue({ members: [] });

      await teamMembersPost(jsonRequest({}));

      expect(prisma.wizardTeamMembers.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: { sessionId: "session-1", members: [] },
        }),
      );
    });

    it("GET returns null without a session", async () => {
      prisma.wizardSession.findFirst.mockResolvedValue(null);

      const response = await teamMembersGet(req);

      expect(await bodyOf(response)).toEqual({ teamMembers: null });
    });

    it("GET returns the stored members", async () => {
      prisma.wizardTeamMembers.findUnique.mockResolvedValue({ members: [] });

      const response = await teamMembersGet(req);

      expect(await bodyOf(response)).toEqual({
        teamMembers: { members: [] },
      });
    });
  });

  describe("benefit-types and employer-scope routes", () => {
    it("benefit types POST uses the supplied session id", async () => {
      prisma.wizardBenefitTypes.upsert.mockResolvedValue({});

      await benefitTypesPost(
        jsonRequest({ sessionId: "other-session", benefitTypes: ["401k"] }),
      );

      expect(prisma.wizardBenefitTypes.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sessionId: "other-session" },
          create: expect.objectContaining({
            sessionId: "other-session",
            benefitTypes: ["401k"],
          }),
        }),
      );
    });

    it("benefit types GET queries by the user id", async () => {
      prisma.wizardBenefitTypes.findFirst.mockResolvedValue({ id: "b1" });

      const response = await benefitTypesGet(req);

      expect(prisma.wizardBenefitTypes.findFirst).toHaveBeenCalledWith({
        where: { sessionId: "user-1" },
      });
      expect(await bodyOf(response)).toEqual({ benefitTypes: { id: "b1" } });
    });

    it("employer scope POST defaults the flag to false", async () => {
      prisma.wizardEmployerScope.upsert.mockResolvedValue({});

      await employerScopePost(jsonRequest({ sessionId: "s-2" }));

      expect(prisma.wizardEmployerScope.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: { sessionId: "s-2", servesMultipleEmployers: false },
        }),
      );
    });

    it("employer scope GET returns the stored value", async () => {
      prisma.wizardEmployerScope.findFirst.mockResolvedValue({
        servesMultipleEmployers: true,
      });

      const response = await employerScopeGet(req);

      expect(await bodyOf(response)).toEqual({
        employerScope: { servesMultipleEmployers: true },
      });
    });
  });

  describe("complete route", () => {
    it("returns 404 when no incomplete session exists", async () => {
      prisma.wizardSession.findMany.mockResolvedValue([]);

      const response = await completePost(jsonRequest({}));

      expect(response.status).toBe(404);
    });

    it("returns 404 when the user record is missing", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const response = await completePost(jsonRequest({}));

      expect(response.status).toBe(404);
    });

    it("completes using the session with the most related data", async () => {
      prisma.wizardSession.findMany.mockResolvedValue([
        {
          id: "sparse",
          createdAt: new Date(),
          clientProfile: {},
          teamSize: null,
          services: null,
          insuranceLicensing: null,
          teamMembers: null,
          branding: null,
          benefitTypes: null,
          employerScope: null,
          userSetup: null,
        },
        {
          id: "rich",
          createdAt: new Date(),
          clientProfile: {},
          teamSize: {},
          services: {},
          insuranceLicensing: null,
          teamMembers: null,
          branding: {},
          benefitTypes: null,
          employerScope: null,
          userSetup: {},
        },
      ]);

      const response = await completePost(jsonRequest({}));

      expect(completeWizardOnboarding).toHaveBeenCalledWith({
        userId: "user-1",
        wizardSessionId: "rich",
      });
      expect(sendSignUpConfirmationEmail).toHaveBeenCalledWith(
        "ada@example.com",
        "Ada",
      );
      expect(response.status).toBe(200);
      expect(await bodyOf(response)).toMatchObject({
        success: true,
        updatedFields: ["organizationName"],
      });
    });

    it("creates a future contact when requested and none exists", async () => {
      await completePost(
        jsonRequest({
          finalData: {
            userSetup: {
              saveAsContact: true,
              name: "Ada Lovelace",
              email: "ada@example.com",
              phone: "2135888888",
              title: "Advisor",
              headshot: "",
            },
          },
        }),
      );

      expect(prisma.futureContact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-1",
          firstName: "Ada",
          lastName: "Lovelace",
          role: "Advisor/Specialist",
          displayScope: "futureUse",
        }),
      });
    });

    it("does not duplicate an existing future contact", async () => {
      prisma.futureContact.findFirst.mockResolvedValue({ id: "contact-1" });

      await completePost(
        jsonRequest({
          finalData: {
            userSetup: {
              saveAsContact: true,
              name: "Ada Lovelace",
              email: "ada@example.com",
              phone: "",
              title: "Advisor",
              headshot: "",
            },
          },
        }),
      );

      expect(prisma.futureContact.create).not.toHaveBeenCalled();
    });

    it("does not save a contact when the preference is off", async () => {
      await completePost(
        jsonRequest({
          finalData: {
            userSetup: {
              saveAsContact: false,
              name: "Ada",
              email: "ada@example.com",
            },
          },
        }),
      );

      expect(prisma.futureContact.create).not.toHaveBeenCalled();
    });
  });

  describe("resume email routes", () => {
    it("send-resume-email creates a token and sends the link", async () => {
      const response = await sendResumeEmailPost(
        new Request("http://localhost/api/onboarding-wizard/send-resume-email"),
      );

      expect(createOnboardingResumeToken).toHaveBeenCalledWith("user-1");
      expect(sendOnboardingResumeEmail).toHaveBeenCalledWith(
        "ada@example.com",
        expect.stringContaining(
          "/api/onboarding-wizard/resume?token=resume-token",
        ),
      );
      expect(await bodyOf(response)).toEqual({ ok: true });
    });

    it("send-resume-email returns 500 when the mail fails", async () => {
      sendOnboardingResumeEmail.mockRejectedValueOnce(new Error("smtp down"));

      const response = await sendResumeEmailPost(
        new Request("http://localhost/api/onboarding-wizard/send-resume-email"),
      );

      expect(response.status).toBe(500);
    });

    it("request-resume-link is always neutral for an unknown address", async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      const response = await requestResumeLinkPost(
        new Request("http://localhost/api/onboarding-wizard/request-resume-link", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "nobody@example.com" }),
        }),
      );

      expect(await bodyOf(response)).toEqual({ ok: true });
      expect(sendOnboardingResumeEmail).not.toHaveBeenCalled();
    });

    it("request-resume-link sends only when an unfinished session exists", async () => {
      prisma.wizardSession.findFirst.mockResolvedValue({ id: "session-1" });

      const response = await requestResumeLinkPost(
        new Request("http://localhost/api/onboarding-wizard/request-resume-link", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "ada@example.com" }),
        }),
      );

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: { equals: "ada@example.com", mode: "insensitive" } },
        select: { id: true, email: true },
      });
      expect(sendOnboardingResumeEmail).toHaveBeenCalled();
      expect(await bodyOf(response)).toEqual({ ok: true });
    });

    it("request-resume-link swallows email failures", async () => {
      prisma.wizardSession.findFirst.mockResolvedValue({ id: "session-1" });
      sendOnboardingResumeEmail.mockRejectedValueOnce(new Error("smtp down"));

      const response = await requestResumeLinkPost(
        new Request("http://localhost/api/onboarding-wizard/request-resume-link", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "ada@example.com" }),
        }),
      );

      expect(await bodyOf(response)).toEqual({ ok: true });
    });

    it("request-resume-link tolerates an invalid JSON body", async () => {
      const response = await requestResumeLinkPost(
        rawRequest("{not-json"),
      );

      expect(await bodyOf(response)).toEqual({ ok: true });
    });
  });

  describe("resume route", () => {
    const originalSecret = process.env.NEXTAUTH_SECRET;

    beforeEach(() => {
      process.env.NEXTAUTH_SECRET = "test-secret";
      verifyOnboardingResumeToken.mockResolvedValue("user-1");
    });

    afterEach(() => {
      process.env.NEXTAUTH_SECRET = originalSecret;
    });

    it("redirects to sign-in for an invalid token", async () => {
      verifyOnboardingResumeToken.mockResolvedValue(null);

      const response = await resumeGet(
        new Request("http://localhost/api/onboarding-wizard/resume?token=bad"),
      );

      expect(response.headers.get("location")).toContain("/signin");
      expect(encode).not.toHaveBeenCalled();
    });

    it("redirects to sign-in when the user is missing", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const response = await resumeGet(
        new Request("http://localhost/api/onboarding-wizard/resume?token=ok"),
      );

      expect(response.headers.get("location")).toContain("/signin");
    });

    it("establishes the session and redirects to onboarding", async () => {
      const response = await resumeGet(
        new Request("http://localhost/api/onboarding-wizard/resume?token=ok"),
      );

      expect(encode).toHaveBeenCalledWith(
        expect.objectContaining({
          token: expect.objectContaining({
            id: "user-1",
            email: "ada@example.com",
            provider: "onboarding-resume",
          }),
          secret: "test-secret",
        }),
      );
      expect(response.headers.get("location")).toBe(
        "http://localhost/onboarding",
      );
      expect(response.headers.get("set-cookie")).toContain(
        "next-auth.session-token=session-jwt",
      );
    });
  });
});
