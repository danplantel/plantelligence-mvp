import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildContactFormHref } from "../contact-form-link";

/**
 * The Contact Form CTA's URL.
 *
 * The CTA opens the first-party `/contact` page with the contact's identity in
 * the query string, so a link saved months ago still shows the right person. Two
 * details matter:
 *
 *  - `data:` images are **skipped** — a base64 headshot is far too large for a
 *    URL (the async resolver uploads it to R2 instead);
 *  - an **empty** topics array is carried as `topics=` on purpose, because the
 *    page must not fall back to defaults after the advisor turned every topic
 *    off. No topics at all (`undefined`) omits the parameter.
 */

vi.mock("@/lib/upload-to-r2", () => ({
  uploadFileToR2: vi.fn(),
}));

vi.mock("@/lib/contact-form-topics", () => ({
  encodeContactFormTopics: (topics: string[]) => topics.join("|"),
  getActiveContactFormTopicLabels: vi.fn(() => []),
  normalizeContactTopicCategory: (value: string) => value,
  resolveContactFormTopics: vi.fn(() => []),
}));

function params(href: string) {
  return new URL(href).searchParams;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildContactFormHref", () => {
  it("points at /contact on this origin with only the recipient", () => {
    const href = buildContactFormHref("ada@acme.test");

    expect(href.startsWith(`${window.location.origin}/contact?`)).toBe(true);
    expect(params(href).get("to")).toBe("ada@acme.test");
    expect([...params(href).keys()]).toEqual(["to"]);
  });

  it("carries the contact's identity and context", () => {
    const href = buildContactFormHref(
      "ada@acme.test",
      "Acme",
      "Ada Advisor",
      "https://cdn.test/ada.png",
      "https://cdn.test/logo.png",
      "Retirement Specialist",
      undefined,
      "Retirement",
      "plan-1",
    );

    const query = params(href);
    expect(query.get("company")).toBe("Acme");
    expect(query.get("name")).toBe("Ada Advisor");
    expect(query.get("avatar")).toBe("https://cdn.test/ada.png");
    expect(query.get("logo")).toBe("https://cdn.test/logo.png");
    expect(query.get("title")).toBe("Retirement Specialist");
    expect(query.get("category")).toBe("Retirement");
    expect(query.get("plan")).toBe("plan-1");
  });

  it("skips base64 images that are too large for a URL", () => {
    const href = buildContactFormHref(
      "ada@acme.test",
      undefined,
      undefined,
      "data:image/png;base64,AAAA",
      "data:image/png;base64,BBBB",
    );

    expect(params(href).has("avatar")).toBe(false);
    expect(params(href).has("logo")).toBe(false);
  });

  it("encodes the topic list", () => {
    const href = buildContactFormHref(
      "ada@acme.test",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      ["Retirement", "Rollovers"],
    );

    expect(params(href).get("topics")).toBe("Retirement|Rollovers");
  });

  it("carries an explicit empty topic list", () => {
    const href = buildContactFormHref(
      "ada@acme.test",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      [],
    );

    expect(params(href).has("topics")).toBe(true);
    expect(params(href).get("topics")).toBe("");
  });

  it("omits the parameter when no topics were supplied", () => {
    expect(
      params(buildContactFormHref("ada@acme.test")).has("topics"),
    ).toBe(false);
    expect(
      params(
        buildContactFormHref(
          "ada@acme.test",
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          "   ",
        ),
      ).has("topics"),
    ).toBe(false);
  });

  it("omits every empty field", () => {
    const href = buildContactFormHref("", "", "", "", "");

    expect(href).toBe(`${window.location.origin}/contact`);
    expect([...params(href).keys()]).toEqual([]);
  });

  it("URL-encodes values that need it", () => {
    const href = buildContactFormHref(
      "ada@acme.test",
      "Acme & Sons",
      undefined,
      undefined,
      undefined,
      "Head of People / Ops",
    );

    expect(href).toContain("company=Acme+%26+Sons");
    expect(params(href).get("title")).toBe("Head of People / Ops");
  });
});
