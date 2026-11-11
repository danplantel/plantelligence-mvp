import { describe, expect, it } from "vitest";
import { splitTextLinks, textHasNoLinks } from "@/lib/text/linkify";

describe("splitTextLinks", () => {
  it("links a bare host and leaves the sentence's full stop outside", () => {
    expect(
      splitTextLinks(
        "You can see your personal estimate at ssa.gov/myaccount.",
      ),
    ).toEqual([
      { type: "text", value: "You can see your personal estimate at " },
      {
        type: "link",
        value: "ssa.gov/myaccount",
        href: "https://ssa.gov/myaccount",
      },
      { type: "text", value: "." },
    ]);
  });

  it("keeps a full URL as written", () => {
    expect(splitTextLinks("Log in at https://portal.example.com/login.")).toEqual([
      { type: "text", value: "Log in at " },
      {
        type: "link",
        value: "https://portal.example.com/login",
        href: "https://portal.example.com/login",
      },
      { type: "text", value: "." },
    ]);
  });

  it("turns an email into a mailto link", () => {
    expect(splitTextLinks("Email benefits@example.com today")).toEqual([
      { type: "text", value: "Email " },
      { type: "link", value: "benefits@example.com", href: "mailto:benefits@example.com" },
      { type: "text", value: " today" },
    ]);
  });

  it("adds https to a www host", () => {
    expect(splitTextLinks("Visit www.ssa.gov")).toEqual([
      { type: "text", value: "Visit " },
      { type: "link", value: "www.ssa.gov", href: "https://www.ssa.gov" },
    ]);
  });

  it("returns the copy untouched when there is nothing to link", () => {
    expect(splitTextLinks("You can claim as early as 62.")).toEqual([
      { type: "text", value: "You can claim as early as 62." },
    ]);
    expect(textHasNoLinks("You can claim as early as 62.")).toBe(true);
  });

  it("never matches an unfilled token or a plain abbreviation", () => {
    expect(splitTextLinks("Log in at {{recordkeeper_url}}.")).toEqual([
      { type: "text", value: "Log in at {{recordkeeper_url}}." },
    ]);
    expect(textHasNoLinks("Roth vs. Pre-Tax, e.g. for high earners")).toBe(true);
  });
});
