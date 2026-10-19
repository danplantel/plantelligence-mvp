import { describe, expect, it } from "vitest";

import {
  OrganizationType,
  ServiceType,
  TeamSize,
} from "@/types/wizard";
import {
  brandingSchema,
  clientProfileSchema,
  insuranceLicensingSchema,
  servicesSchema,
  teamSizeSchema,
  userSetupSchema,
  validateCurrentStep,
} from "../wizard-validation";

const validUserSetup = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  organizationEmail: "org@example.com",
  phone: "2135888888",
  title: "Advisor",
};

describe("wizard validation schemas", () => {
  describe("clientProfileSchema", () => {
    it("accepts a known organization type", () => {
      expect(
        clientProfileSchema.safeParse({
          organizationType: OrganizationType.FINANCIAL_ADVISOR_RIA,
        }).success,
      ).toBe(true);
    });

    it("requires a description when Other is selected", () => {
      const result = clientProfileSchema.safeParse({
        organizationType: OrganizationType.OTHER,
        customOrganization: "   ",
      });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0].path).toEqual(["customOrganization"]);
    });

    it("accepts Other with a description", () => {
      expect(
        clientProfileSchema.safeParse({
          organizationType: OrganizationType.OTHER,
          customOrganization: "A niche firm",
        }).success,
      ).toBe(true);
    });
  });

  describe("teamSizeSchema", () => {
    it("accepts a current band", () => {
      expect(
        teamSizeSchema.safeParse({ teamSize: TeamSize.TWO_FIVE }).success,
      ).toBe(true);
    });

    it("rejects an unknown band", () => {
      expect(teamSizeSchema.safeParse({ teamSize: "huge" }).success).toBe(
        false,
      );
    });
  });

  describe("servicesSchema", () => {
    it("requires at least one service", () => {
      expect(servicesSchema.safeParse({ services: [] }).success).toBe(false);
    });

    it("caps selections at four", () => {
      expect(
        servicesSchema.safeParse({
          services: [
            ServiceType.RETIREMENT,
            ServiceType.GROUP_HEALTH,
            ServiceType.GROUP_LIFE_DISABILITY,
            ServiceType.SUPPLEMENTAL_HEALTH,
            ServiceType.OTHER,
          ],
          customService: "Something else",
        }).success,
      ).toBe(false);
    });

    it("requires custom text when Other is selected", () => {
      const result = servicesSchema.safeParse({
        services: [ServiceType.OTHER],
        customService: " ",
      });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0].path).toEqual(["customService"]);
    });

    it("limits custom text to 50 characters", () => {
      expect(
        servicesSchema.safeParse({
          services: [ServiceType.OTHER],
          customService: "x".repeat(51),
        }).success,
      ).toBe(false);
    });

    it("accepts a valid selection", () => {
      expect(
        servicesSchema.safeParse({
          services: [ServiceType.RETIREMENT, ServiceType.GROUP_HEALTH],
          customService: "",
        }).success,
      ).toBe(true);
    });
  });

  describe("insuranceLicensingSchema", () => {
    it("accepts a pass-through payload", () => {
      expect(
        insuranceLicensingSchema.safeParse({
          offersInsurance: false,
          attestation: false,
        }).success,
      ).toBe(true);
    });

    it("rejects an invalid license type", () => {
      expect(
        insuranceLicensingSchema.safeParse({
          offersInsurance: true,
          licenses: [
            {
              id: "1",
              state: "CA",
              type: "not-a-license",
              number: "123",
            },
          ],
        }).success,
      ).toBe(false);
    });

    it("rejects a license number with unsupported characters", () => {
      expect(
        insuranceLicensingSchema.safeParse({
          offersInsurance: true,
          licenses: [
            {
              id: "1",
              state: "CA",
              type: "life",
              number: "12 34",
            },
          ],
        }).success,
      ).toBe(false);
    });

    it("requires customType for an Other license", () => {
      // The schema's refinement throws deliberately so the caller receives the
      // license-specific message rather than a generic refinement error.
      expect(() =>
        insuranceLicensingSchema.parse({
          offersInsurance: true,
          licenses: [
            {
              id: "1",
              state: "CA",
              type: "other",
              number: "123",
            },
          ],
        }),
      ).toThrow("Please specify the license type");
    });
  });

  describe("brandingSchema", () => {
    it("accepts a domain without a protocol", () => {
      expect(
        brandingSchema.safeParse({ website: "example.com" }).success,
      ).toBe(true);
    });

    it("accepts a full https URL", () => {
      expect(
        brandingSchema.safeParse({ website: "https://example.com/path" })
          .success,
      ).toBe(true);
    });

    it("rejects a bare word as a website", () => {
      expect(brandingSchema.safeParse({ website: "not a url" }).success).toBe(
        false,
      );
    });

    it("allows an empty website", () => {
      expect(brandingSchema.safeParse({ website: "" }).success).toBe(true);
    });
  });

  describe("userSetupSchema", () => {
    it("accepts a complete profile", () => {
      expect(userSetupSchema.safeParse(validUserSetup).success).toBe(true);
    });

    it("accepts a formatted phone with a country code", () => {
      expect(
        userSetupSchema.safeParse({
          ...validUserSetup,
          phone: "+1 (213) 588-8888",
        }).success,
      ).toBe(true);
    });

    it("accepts an extension on the phone field", () => {
      expect(
        userSetupSchema.safeParse({
          ...validUserSetup,
          phone: "(213) 588-8888 x123",
        }).success,
      ).toBe(true);
    });

    it("rejects a phone shorter than seven digits", () => {
      const result = userSetupSchema.safeParse({
        ...validUserSetup,
        phone: "12345",
      });

      expect(result.success).toBe(false);
      expect(result.error?.issues.some((issue) => issue.path[0] === "phone")).toBe(
        true,
      );
    });

    it("requires the organization email separately from the login email", () => {
      const result = userSetupSchema.safeParse({
        ...validUserSetup,
        organizationEmail: "",
      });

      expect(result.success).toBe(false);
      expect(
        result.error?.issues.some(
          (issue) => issue.path[0] === "organizationEmail",
        ),
      ).toBe(true);
    });
  });

  describe("clientProfileSchema organization ids", () => {
    it("accepts every current organization type", () => {
      for (const value of Object.values(OrganizationType)) {
        expect(
          clientProfileSchema.safeParse({
            organizationType: value,
            customOrganization: value === OrganizationType.OTHER ? "Other" : "",
          }).success,
        ).toBe(true);
      }
    });
  });
});

describe("validateCurrentStep", () => {
  it("reports both required Step 1 fields when empty", async () => {
    const result = await validateCurrentStep(1, {});

    expect(result.isValid).toBe(false);
    expect(result.errorFields).toEqual(
      expect.arrayContaining(["organizationType", "teamSize"]),
    );
  });

  it("requires a description for an Other organization in Step 1", async () => {
    const result = await validateCurrentStep(1, {
      clientProfile: { organizationType: OrganizationType.OTHER },
      teamSize: { teamSize: TeamSize.SOLO },
    });

    expect(result.isValid).toBe(false);
    expect(result.errorFields).toContain("customOrganization");
  });

  it("normalizes legacy Step 1 ids before validating", async () => {
    const result = await validateCurrentStep(1, {
      clientProfile: { organizationType: "ria" },
      teamSize: { teamSize: "just_me" },
    });

    expect(result.isValid).toBe(true);
  });

  it("accepts a complete Step 1", async () => {
    const result = await validateCurrentStep(1, {
      clientProfile: {
        organizationType: OrganizationType.FINANCIAL_ADVISOR_RIA,
      },
      teamSize: { teamSize: TeamSize.TWO_FIVE },
    });

    expect(result.isValid).toBe(true);
  });

  it("requires at least one service in Step 2", async () => {
    const result = await validateCurrentStep(2, {});

    expect(result.isValid).toBe(false);
    expect(result.errorFields).toContain("services");
  });

  it("requires custom text when Other is selected in Step 2", async () => {
    const result = await validateCurrentStep(2, {
      services: { services: [ServiceType.OTHER], customService: " " },
    });

    expect(result.isValid).toBe(false);
    expect(result.errorFields).toContain("customService");
  });

  it("accepts a valid Step 2 selection", async () => {
    const result = await validateCurrentStep(2, {
      services: {
        services: [ServiceType.RETIREMENT],
        customService: "",
      },
    });

    expect(result.isValid).toBe(true);
  });

  it("validates insurance licenses when the organization offers insurance", async () => {
    const result = await validateCurrentStep(2, {
      services: { services: [ServiceType.GROUP_HEALTH] },
      insuranceLicensing: {
        offersInsurance: true,
        licenses: [
          {
            id: "1",
            state: "CA",
            type: "life",
            number: "",
          },
        ],
      },
    });

    expect(result.isValid).toBe(false);
  });

  it("reports every required Step 3 field when empty", async () => {
    const result = await validateCurrentStep(3, {});

    expect(result.isValid).toBe(false);
    expect(result.errorFields).toEqual(
      expect.arrayContaining([
        "logo",
        "organizationName",
        "website",
        "primaryColor",
        "secondaryColor",
      ]),
    );
  });

  it("rejects an invalid hex brand color in Step 3", async () => {
    const result = await validateCurrentStep(3, {
      branding: {
        logo: "r2/logo.png",
        organizationName: "Acme",
        website: "acme.example",
        primaryColor: "not-a-color",
        secondaryColor: "#222222",
      },
    });

    expect(result.isValid).toBe(false);
    expect(result.errorFields).toContain("primaryColor");
  });

  it("accepts a complete Step 3", async () => {
    const result = await validateCurrentStep(3, {
      branding: {
        logo: "r2/logo.png",
        organizationName: "Acme",
        website: "acme.example",
        primaryColor: "#111111",
        secondaryColor: "#222222",
      },
    });

    expect(result.isValid).toBe(true);
  });

  it("reports missing Step 4 fields", async () => {
    const result = await validateCurrentStep(4, {});

    expect(result.isValid).toBe(false);
    // The composite message contains "organizationEmail", which maps to that
    // field; the plain "email" field is intentionally not also reported.
    expect(result.errorFields).toEqual(
      expect.arrayContaining([
        "name",
        "organizationEmail",
        "phone",
        "title",
      ]),
    );
  });

  it("accepts a complete Step 4", async () => {
    const result = await validateCurrentStep(4, {
      userSetup: validUserSetup,
    });

    expect(result.isValid).toBe(true);
  });

  it("rejects an invalid Step 4 phone", async () => {
    const result = await validateCurrentStep(4, {
      userSetup: { ...validUserSetup, phone: "123" },
    });

    expect(result.isValid).toBe(false);
    expect(result.errorFields).toContain("phone");
  });

  it("treats Step 5 as valid — its sub-screens own validation", async () => {
    await expect(validateCurrentStep(5, {})).resolves.toMatchObject({
      isValid: true,
    });
  });

  it("rejects an unknown step number", async () => {
    const result = await validateCurrentStep(99, {});

    expect(result.isValid).toBe(false);
    expect(result.errorFields).toEqual(["unknown"]);
  });
});
