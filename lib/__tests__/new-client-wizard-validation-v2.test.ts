import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  validateCompanyBasics,
  validateComplianceDocuments,
  validateKeyContacts,
  validateNewClientCurrentStepV2,
  validateWelcomeStatement,
} from "../new-client-wizard-validation-v2";

/**
 * Create Plan validation (`validateNewClientCurrentStepV2`).
 *
 * This is the gate behind every Next and Complete click. The tests are
 * table-driven where the rule is simple, and assert the *shape* of the result
 * (`isValid`, `errorFields`, `errors`) because the wizard uses `errorFields` to
 * focus a field — a message change that silently drops the field name is a bug.
 */

const mocks = vi.hoisted(() => ({
  slideIndex: undefined as number | undefined,
  resolveHeadline: vi.fn(() => "Welcome" as string | null),
  resolveBody: vi.fn(() => "x".repeat(300) as string | null),
}));

vi.mock("@/lib/new-client-wizard-store", () => ({
  useNewClientWizardStore: {
    getState: () => ({ step3SlideIndex: mocks.slideIndex }),
  },
}));

vi.mock("@/lib/wizard-effective-content", () => ({
  resolveStoredWelcomeHeadline: mocks.resolveHeadline,
  resolveStoredWelcomeBody: mocks.resolveBody,
}));

const LONG_BODY = "Lorem ipsum ".repeat(30); // 330 characters

function validBasics(overrides: Record<string, unknown> = {}) {
  return {
    companyName: "Acme Corp",
    planType: "group",
    portalUrl: "acme",
    primaryColor: "#112233",
    secondaryColor: "#445566",
    ...overrides,
  };
}

function validStep1(overrides: Record<string, unknown> = {}) {
  return { companyBasics: validBasics(overrides) };
}

function validStep2() {
  return {
    companyBasics: {
      missionHeadline: "Our mission",
      missionBody: LONG_BODY,
      brandImages: { header: { url: "https://cdn.test/header.png" } },
    },
  };
}

function completeContact(id: string, category: string) {
  return {
    id,
    firstName: "Ada",
    lastName: "Lovelace",
    email: `${id}@acme.test`,
    benefitsCategories: [category],
  };
}

beforeEach(() => {
  mocks.slideIndex = undefined;
  mocks.resolveHeadline.mockReset().mockReturnValue("Welcome");
  mocks.resolveBody.mockReset().mockReturnValue("x".repeat(300));
});

describe("validateCompanyBasics", () => {
  it("accepts a complete record", () => {
    expect(validateCompanyBasics(validBasics() as any)).toBe(true);
  });

  it.each([
    ["companyName", { companyName: "" }],
    ["companyName", { companyName: "   " }],
    ["primaryColor", { primaryColor: "" }],
    ["secondaryColor", { secondaryColor: "" }],
    ["portalUrl", { portalUrl: "" }],
  ])("reports %s for %o", (field, overrides) => {
    expect(() =>
      validateCompanyBasics(validBasics(overrides) as any),
    ).toThrow();
    try {
      validateCompanyBasics(validBasics(overrides) as any);
    } catch (error) {
      const parsed = JSON.parse((error as Error).message);
      expect(parsed).toEqual(
        expect.arrayContaining([expect.objectContaining({ field })]),
      );
    }
  });

  it.each(["acme.test", "https://acme.test/path?q=1", "sub.acme.test"])(
    "accepts the website %s",
    (companyWebsite) => {
      expect(
        validateCompanyBasics(validBasics({ companyWebsite }) as any),
      ).toBe(true);
    },
  );

  it.each(["not a website", "acme", "http://"])(
    "rejects the website %s",
    (companyWebsite) => {
      expect(() =>
        validateCompanyBasics(validBasics({ companyWebsite }) as any),
      ).toThrow(/valid website URL/);
    },
  );

  it("ignores a blank organization type", () => {
    expect(
      validateCompanyBasics(validBasics({ organizationType: "" }) as any),
    ).toBe(true);
  });
});

describe("validateWelcomeStatement", () => {
  it("accepts a 250–2000 character body", () => {
    expect(
      validateWelcomeStatement({ headline: "Hi", bodyText: LONG_BODY } as any),
    ).toBe(true);
  });

  it("requires the headline", () => {
    expect(() =>
      validateWelcomeStatement({ headline: " ", bodyText: LONG_BODY } as any),
    ).toThrow(/Welcome headline is required/);
  });

  it("requires the body", () => {
    expect(() =>
      validateWelcomeStatement({ headline: "Hi", bodyText: "" } as any),
    ).toThrow(/Welcome message body is required/);
  });

  it.each([249, 2001])("rejects a %i character body", (length) => {
    expect(() =>
      validateWelcomeStatement({
        headline: "Hi",
        bodyText: "x".repeat(length),
      } as any),
    ).toThrow(/between 250-2000 characters/);
  });
});

describe("validateKeyContacts", () => {
  it("requires at least one contact", () => {
    expect(() => validateKeyContacts({ contacts: [] } as any)).toThrow(
      /At least one key contact is required/,
    );
  });

  it("requires every field of a contact", () => {
    expect(() =>
      validateKeyContacts({
        contacts: [
          {
            id: "c1",
            name: "",
            email: "not-an-email",
            orgType: "",
            organization: "",
            description: "",
            phone: "",
            headshot: "",
          },
        ],
      } as any),
    ).toThrow();
  });

  it("accepts a complete contact", () => {
    expect(
      validateKeyContacts({
        contacts: [
          {
            id: "c1",
            name: "Ada Lovelace",
            email: "ada@acme.test",
            orgType: "Advisor",
            organization: "Acme",
            description: "Advisor",
            phone: "5551234567",
            headshot: "https://cdn.test/ada.png",
          },
        ],
      } as any),
    ).toBe(true);

    expect(() =>
      validateKeyContacts({
        contacts: [
          {
            id: "c1",
            name: "Ada Lovelace",
            email: "ada@acme.test",
            orgType: "Recordkeeper",
            organization: "Acme",
            description: "Advisor",
            phone: "5551234567",
            headshot: "https://cdn.test/ada.png",
          },
        ],
      } as any),
    ).toThrow(/Recordkeeper Name is required/);
  });

  it("caps descriptions at 240 characters", () => {
    expect(() =>
      validateKeyContacts({
        contacts: [
          {
            id: "c1",
            name: "Ada",
            email: "ada@acme.test",
            orgType: "Advisor",
            organization: "Acme",
            description: "x".repeat(241),
            phone: "5551234567",
            headshot: "https://cdn.test/ada.png",
          },
        ],
      } as any),
    ).toThrow(/240 characters or less/);
  });
});

describe("validateComplianceDocuments", () => {
  it("passes with no documents", () => {
    expect(validateComplianceDocuments({} as any)).toBe(true);
  });

  it("passes when every document has a category", () => {
    expect(
      validateComplianceDocuments({
        retirementPlanDocuments: [
          { name: "A", category: "Retirement" },
          { name: "B", category: "Health" },
        ],
      } as any),
    ).toBe(true);
  });

  it("counts uncategorized documents", () => {
    expect(() =>
      validateComplianceDocuments({
        retirementPlanDocuments: [
          { name: "A", category: null },
          { name: "B", category: "" },
          { name: "C", category: "Retirement" },
        ],
      } as any),
    ).toThrow(/2 document\(s\) need to be categorized/);
  });
});

describe("validateNewClientCurrentStepV2 — step 1", () => {
  it("passes a complete step 1", async () => {
    await expect(
      validateNewClientCurrentStepV2(1, validStep1()),
    ).resolves.toEqual({ isValid: true, errors: [], errorFields: [] });
  });

  it("lists the missing required fields", async () => {
    const result = await validateNewClientCurrentStepV2(1, {
      companyBasics: { companyName: "", planType: "", portalUrl: "" },
    });

    expect(result.isValid).toBe(false);
    expect(result.errorFields).toEqual([
      "companyName",
      "planType",
      "portalUrl",
    ]);
    expect(result.errors[0].message).toBe(
      "Please complete the following fields: companyName, planType, portalUrl",
    );
  });

  it("falls through to the colour/website rules once the required fields exist", async () => {
    const result = await validateNewClientCurrentStepV2(
      1,
      validStep1({
        primaryColor: "",
        secondaryColor: "",
        companyWebsite: "nope",
      }),
    );

    expect(result.isValid).toBe(false);
    expect(result.errorFields).toEqual(
      expect.arrayContaining([
        "companyWebsite",
        "primaryColor",
        "secondaryColor",
      ]),
    );
  });
});

describe("validateNewClientCurrentStepV2 — step 2", () => {
  it("passes a complete step 2", async () => {
    await expect(
      validateNewClientCurrentStepV2(2, validStep2()),
    ).resolves.toMatchObject({ isValid: true, errorFields: [] });
  });

  it("caps the mission headline at 60 characters", async () => {
    const step = validStep2();
    step.companyBasics.missionHeadline = "x".repeat(61);

    const result = await validateNewClientCurrentStepV2(2, step);

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        {
          field: "missionHeadline",
          message: "Mission Headline must be 60 characters or less",
        },
      ]),
    );
  });

  it("requires a 250-character mission body", async () => {
    const step = validStep2();
    step.companyBasics.missionBody = "x".repeat(249);

    const result = await validateNewClientCurrentStepV2(2, step);

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        {
          field: "missionBody",
          message: "Mission Statement must be at least 250 characters",
        },
      ]),
    );
  });

  it("requires the hero banner image", async () => {
    const step = validStep2();
    (step.companyBasics.brandImages as any).header.url = "   ";

    const result = await validateNewClientCurrentStepV2(2, step);

    expect(result.isValid).toBe(false);
    expect(result.errorFields).toContain("brandImages.header");
    expect(result.errors).toEqual(
      expect.arrayContaining([
        {
          field: "brandImages.header",
          message: "Hero Banner Image is required",
        },
      ]),
    );
  });

  it("reports a missing stored welcome headline and body", async () => {
    mocks.resolveHeadline.mockReturnValue(null);
    mocks.resolveBody.mockReturnValue(null);

    const result = await validateNewClientCurrentStepV2(2, validStep2());

    expect(result.isValid).toBe(false);
    expect(result.errorFields).toEqual(
      expect.arrayContaining(["headline", "bodyText"]),
    );
    expect(result.errors).toEqual(
      expect.arrayContaining([
        {
          field: "headline",
          message:
            "Welcome headline is required (banner title, welcome headline, or stored hero copy)",
        },
        { field: "bodyText", message: "Welcome message body is required" },
      ]),
    );
  });

  it("rejects a stored body outside the 250–2000 window", async () => {
    mocks.resolveBody.mockReturnValue("x".repeat(2001));

    const result = await validateNewClientCurrentStepV2(2, validStep2());

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        {
          field: "bodyText",
          message: "Welcome message body must be between 250-2000 characters",
        },
      ]),
    );
  });
});

describe("validateNewClientCurrentStepV2 — step 3 (legacy sub-steps)", () => {
  it("requires a benefits category on step3a", async () => {
    const result = await validateNewClientCurrentStepV2(3, {
      step3a: {},
      keyContacts: { contacts: [] },
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual([
      {
        field: "benefitsCategory",
        message: "Please select a benefits category",
      },
    ]);
  });

  it("requires the free-text type for Other Benefits", async () => {
    const result = await validateNewClientCurrentStepV2(3, {
      step3a: { benefitsCategory: "Other Benefits" },
    });

    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toEqual({
      field: "otherBenefitsText",
      message: "Please specify the benefit type",
    });
  });

  it("passes step3a with a category and no otherBenefitsText requirement", async () => {
    await expect(
      validateNewClientCurrentStepV2(3, {
        step3a: { benefitsCategory: "Retirement" },
      }),
    ).resolves.toMatchObject({ isValid: true });
  });

  it("validates the unsaved contact form on step3b", async () => {
    const result = await validateNewClientCurrentStepV2(3, {
      step3SubStep: "step3b",
      keyContacts: { contacts: [] },
      step3b: {
        contactType: "individual",
        firstName: "",
        lastName: "",
        title: "",
        email: "ada@acme.test",
        benefitsCategories: ["Retirement"],
      },
    });

    expect(result.isValid).toBe(false);
    expect(result.errorFields).toEqual(
      expect.arrayContaining(["firstName", "lastName", "title"]),
    );
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "firstName",
          message: '"Contact 1": Please enter the first name',
        }),
      ]),
    );
  });

  it("accepts a valid individual contact with only a phone number", async () => {
    await expect(
      validateNewClientCurrentStepV2(3, {
        step3SubStep: "step3b",
        keyContacts: { contacts: [] },
        step3b: {
          contactType: "individual",
          firstName: "Ada",
          lastName: "Lovelace",
          title: "Advisor",
          email: "",
          phone: "(555) 123-4567",
          benefitsCategories: ["Retirement"],
        },
      }),
    ).resolves.toMatchObject({ isValid: true });
  });

  it("requires a scheduling URL for the Schedule Appt. CTA", async () => {
    const result = await validateNewClientCurrentStepV2(3, {
      step3SubStep: "step3b",
      keyContacts: { contacts: [] },
      step3b: {
        contactType: "individual",
        firstName: "Ada",
        lastName: "Lovelace",
        title: "Advisor",
        email: "ada@acme.test",
        benefitsCategories: ["Retirement"],
        enableContactButton: true,
        ctaType: "schedule",
      },
    });

    expect(result.isValid).toBe(false);
    expect(result.errorFields).toContain("schedulingUrl");
  });

  it("requires a valid email for the Contact Form CTA", async () => {
    const result = await validateNewClientCurrentStepV2(3, {
      step3SubStep: "step3b",
      keyContacts: { contacts: [] },
      step3b: {
        contactType: "individual",
        firstName: "Ada",
        lastName: "Lovelace",
        title: "Advisor",
        email: "not-an-email",
        phone: "5551234567",
        benefitsCategories: ["Retirement"],
        enableContactButton: true,
        ctaType: "contact",
      },
    });

    expect(result.isValid).toBe(false);
    expect(result.errorFields).toEqual(
      expect.arrayContaining(["email", "contactFormCtaEmail"]),
    );
  });

  it("requires a category on every R2-backed hub document", async () => {
    const result = await validateNewClientCurrentStepV2(3, {
      step3SubStep: "step3b",
      keyContacts: { contacts: [] },
      step3b: {
        contactType: "individual",
        firstName: "Ada",
        lastName: "Lovelace",
        title: "Advisor",
        email: "ada@acme.test",
        benefitsCategories: ["Retirement"],
      },
      complianceDocuments: {
        retirementPlanDocuments: [
          { name: "SPD", storageKey: "clients/1/spd.pdf" },
        ],
      },
    });

    expect(result.isValid).toBe(false);
    expect(result.errorFields).toContain("hubDocumentsCategory");
  });
});

describe("validateNewClientCurrentStepV2 — step 3 (slide flow + limits)", () => {
  it("skips the legacy step3a category requirement while slides are active", async () => {
    mocks.slideIndex = 0;

    await expect(
      validateNewClientCurrentStepV2(3, {
        step3SlideIndex: 0,
        keyContacts: { contacts: [] },
      }),
    ).resolves.toMatchObject({ isValid: true });
  });

  it("refuses a plan with more than four categories", async () => {
    mocks.slideIndex = 0;

    const result = await validateNewClientCurrentStepV2(3, {
      step3SlideIndex: 0,
      keyContacts: {
        contacts: [
          completeContact("a", "Retirement"),
          completeContact("b", "Group Health"),
          completeContact("c", "Group Life"),
          completeContact("d", "Other"),
          completeContact("e", "Wellness"),
        ],
      },
    });

    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toEqual({
      field: "benefitsCategories",
      message:
        "Plan cannot have more than 4 benefit categories. Remove a category from a contact.",
    });
  });

  it("refuses complete contacts with no category at all", async () => {
    mocks.slideIndex = 0;

    const result = await validateNewClientCurrentStepV2(3, {
      step3SlideIndex: 0,
      keyContacts: {
        contacts: [
          {
            id: "a",
            firstName: "Ada",
            lastName: "Lovelace",
            email: "ada@acme.test",
            benefitsCategories: [],
          },
        ],
      },
    });

    expect(result.isValid).toBe(false);
    expect(result.errors[0].message).toBe(
      "Plan must have at least one benefit category. Add a contact with a category.",
    );
  });
});

describe("validateNewClientCurrentStepV2 — steps 4 and 5", () => {
  it("validates categorised documents on step 4", async () => {
    const result = await validateNewClientCurrentStepV2(4, {
      complianceDocuments: {
        retirementPlanDocuments: [{ name: "A" }],
      },
    });

    expect(result.isValid).toBe(false);
    expect(result.errors[0].message).toBe(
      "1 document(s) need to be categorized before proceeding.",
    );

    await expect(
      validateNewClientCurrentStepV2(4, {
        complianceDocuments: {
          retirementPlanDocuments: [{ name: "A", category: "Retirement" }],
        },
      }),
    ).resolves.toMatchObject({ isValid: true });
  });

  it("refuses to finish when every portal category is hidden", async () => {
    const result = await validateNewClientCurrentStepV2(5, {
      employeePortalPreview: {
        categoryPortalVisibility: {
          Retirement: false,
          "Group Health": false,
          "Group Life": false,
          Other: false,
        },
      },
    });

    expect(result.isValid).toBe(false);
    expect(result.errorFields).toEqual(["categoryPortalVisibility"]);
    expect(result.errors[0].message).toMatch(/At least one benefit category/);
  });

  it("reads visibility from the nested previewData shape too", async () => {
    const result = await validateNewClientCurrentStepV2(5, {
      employeePortalPreview: {
        previewData: {
          categoryPortalVisibility: {
            Retirement: false,
            "Group Health": false,
            "Group Life": false,
            Other: false,
          },
        },
      },
    });

    expect(result.isValid).toBe(false);
  });

  it("passes when at least one category is visible", async () => {
    await expect(
      validateNewClientCurrentStepV2(5, {
        employeePortalPreview: {
          categoryPortalVisibility: { Retirement: true, Other: false },
        },
      }),
    ).resolves.toMatchObject({ isValid: true });
  });

  it("passes step 5 when visibility was never set (safe default)", async () => {
    await expect(validateNewClientCurrentStepV2(5, {})).resolves.toMatchObject({
      isValid: true,
    });
  });
});

describe("validateNewClientCurrentStepV2 — unknown steps", () => {
  it("reports an invalid step without crashing", async () => {
    const result = await validateNewClientCurrentStepV2(9, {});

    expect(result.isValid).toBe(false);
    expect(result.errorFields).toEqual([]);
    expect(result.errors).toEqual([
      { field: "unknown", message: "Invalid step number: 9" },
    ]);
  });

  it("maps a plain-text error onto known field names", async () => {
    // Step 1's required-fields message is plain text, not JSON.
    const result = await validateNewClientCurrentStepV2(1, {
      companyBasics: { companyName: "Acme" },
    });

    expect(result.errorFields).toEqual(
      expect.arrayContaining(["planType", "portalUrl"]),
    );
  });
});
