import { describe, expect, it } from "vitest";

import {
  EMPTY_EMPLOYEE_RESOURCES_HELP,
  readEmployeeResourcesHelp,
} from "@/lib/employee-resources-help";

/**
 * The Employee Resources hub keeps its Account Access + card-layout settings on the
 * plan (`employeePortalPreview.employeeResourcesHelp`) because it has no `Benefit`
 * row. These tests pin the read: absent / legacy blobs normalise to the empty shape,
 * and a populated blob round-trips the values the Editing Panel writes.
 */
describe("readEmployeeResourcesHelp", () => {
  it("returns the empty shape for a missing plan or blob", () => {
    expect(readEmployeeResourcesHelp(null)).toEqual(
      EMPTY_EMPLOYEE_RESOURCES_HELP,
    );
    expect(readEmployeeResourcesHelp(undefined)).toEqual(
      EMPTY_EMPLOYEE_RESOURCES_HELP,
    );
    expect(readEmployeeResourcesHelp({})).toEqual(
      EMPTY_EMPLOYEE_RESOURCES_HELP,
    );
    // A plan with a preview but no Help blob yet is still "nothing set".
    expect(
      readEmployeeResourcesHelp({ employeePortalPreview: {} }),
    ).toEqual(EMPTY_EMPLOYEE_RESOURCES_HELP);
  });

  it("reads the values the Editing Panel stores in the plan preview", () => {
    const settings = readEmployeeResourcesHelp({
      employeePortalPreview: {
        employeeResourcesHeroImage: "org/1/branding/hero.png",
        employeeResourcesHelp: {
          insurancePlanId: "1234-5678-9012",
          insuranceLoginUrl: "https://portal.example.com/login",
          providerContact: {
            companyName: "Empower",
            contactName: "Dana Rep",
            phone: "5551234567",
          },
          helpCards: [
            { id: "account-access", primary: true },
            { id: "understand-coverage", enabled: false },
          ],
          helpCardColumns: 4,
        },
      },
    });

    expect(settings.insurancePlanId).toBe("1234-5678-9012");
    expect(settings.insuranceLoginUrl).toBe("https://portal.example.com/login");
    expect(settings.providerContact?.companyName).toBe("Empower");
    expect(settings.helpCards).toEqual([
      { id: "account-access", primary: true },
      { id: "understand-coverage", enabled: false },
    ]);
    expect(settings.helpCardColumns).toBe(4);
  });

  it("drops malformed help-card entries and non-positive columns", () => {
    const settings = readEmployeeResourcesHelp({
      employeePortalPreview: {
        employeeResourcesHelp: {
          // Not an array — ignored.
          helpCards: "nope",
          // Zero / garbage fall back to "unset" (the panel's default of 3).
          helpCardColumns: 0,
        },
      },
    });

    expect(settings.helpCards).toEqual([]);
    expect(settings.helpCardColumns).toBeNull();

    const mixed = readEmployeeResourcesHelp({
      employeePortalPreview: {
        employeeResourcesHelp: {
          helpCards: [{ id: "account-access" }, {}, null, { title: "no id" }],
        },
      },
    });
    expect(mixed.helpCards).toEqual([{ id: "account-access" }]);
  });
});
