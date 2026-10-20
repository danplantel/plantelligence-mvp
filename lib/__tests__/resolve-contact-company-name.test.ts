import { describe, expect, it } from "vitest";

import {
  isLoggedInUserContact,
  resolveContactCompanyName,
} from "../resolve-contact-company-name";

/**
 * Whose name a contact card shows.
 *
 * The advisor's own card must read the advisor's **Organization Name**, not the
 * `organizationType` that was stored on the seeded row (`"independent"`, etc.),
 * and the match has to work off every email we can resolve — the seeded row
 * carries the *organization* address while the session carries the login one.
 */

describe("isLoggedInUserContact", () => {
  it("matches on the login email, case- and whitespace-insensitively", () => {
    expect(
      isLoggedInUserContact({ email: "  Ada@Acme.test " }, ["ada@acme.test"]),
    ).toBe(true);
  });

  it("matches any email in the list", () => {
    expect(
      isLoggedInUserContact({ email: "org@acme.test" }, [
        "ada@acme.test",
        "org@acme.test",
      ]),
    ).toBe(true);
  });

  it("accepts a single email as well as a list", () => {
    expect(isLoggedInUserContact({ email: "ada@acme.test" }, "ada@acme.test")).toBe(
      true,
    );
  });

  it("is false for another contact, a missing email or no candidates", () => {
    expect(isLoggedInUserContact({ email: "grace@acme.test" }, ["ada@acme.test"])).toBe(
      false,
    );
    expect(isLoggedInUserContact({ email: "" }, ["ada@acme.test"])).toBe(false);
    expect(isLoggedInUserContact({}, ["ada@acme.test"])).toBe(false);
    expect(isLoggedInUserContact({ email: "ada@acme.test" }, null)).toBe(false);
  });
});

describe("resolveContactCompanyName", () => {
  it("shows the organization name on the viewer's own card", () => {
    expect(
      resolveContactCompanyName(
        { email: "org@acme.test", companyName: "independent" },
        ["ada@acme.test", "org@acme.test"],
        "Acme Advisory",
      ),
    ).toBe("Acme Advisory");
  });

  it("falls back to the stored company name when the org name is blank", () => {
    expect(
      resolveContactCompanyName(
        { email: "ada@acme.test", companyName: "Stored Co" },
        ["ada@acme.test"],
        "   ",
      ),
    ).toBe("Stored Co");
  });

  it("shows another contact's own company name", () => {
    expect(
      resolveContactCompanyName(
        { email: "grace@acme.test", companyName: "Grace LLC" },
        ["ada@acme.test"],
        "Acme Advisory",
      ),
    ).toBe("Grace LLC");
  });

  it("trims the stored value and returns an empty string when there is none", () => {
    expect(
      resolveContactCompanyName({ email: "grace@acme.test", companyName: "  Acme  " }),
    ).toBe("Acme");
    expect(resolveContactCompanyName({ email: "grace@acme.test" })).toBe("");
  });
});
