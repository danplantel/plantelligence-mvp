import { describe, expect, it } from "vitest";
import {
  buildTopicUrl,
  readHashTopicSlug,
  readOptionParam,
  topicHashSlug,
  topicMatchesHash,
} from "@/lib/topics/deep-link";
import { resolveTopicHref } from "@/lib/topics/link-href";

describe("topicHashSlug", () => {
  it("strips the storage namespace", () => {
    expect(topicHashSlug("sys.rollovers-distributions")).toBe(
      "rollovers-distributions",
    );
  });

  it("leaves an org topic's slug alone", () => {
    expect(topicHashSlug("org.org-1.acme-perks")).toBe("org.org-1.acme-perks");
  });
});

describe("readHashTopicSlug", () => {
  it("accepts a hash with or without the # and decodes it", () => {
    expect(readHashTopicSlug("#401k-loans")).toBe("401k-loans");
    expect(readHashTopicSlug("401k-loans")).toBe("401k-loans");
    expect(readHashTopicSlug("#naming%20a%20trust")).toBe("naming a trust");
  });

  it("returns an empty string for no hash", () => {
    expect(readHashTopicSlug("")).toBe("");
    expect(readHashTopicSlug(null)).toBe("");
  });
});

describe("topicMatchesHash", () => {
  it("matches the published slug and the namespaced one", () => {
    const topic = { slug: "sys.401k-loans" };
    expect(topicMatchesHash(topic, "#401k-loans")).toBe(true);
    expect(topicMatchesHash(topic, "#sys.401k-loans")).toBe(true);
  });

  it("is case-insensitive, so an edited URL still lands", () => {
    expect(topicMatchesHash({ slug: "sys.401k-loans" }, "#401K-Loans")).toBe(true);
  });

  it("does not match a different topic or an empty hash", () => {
    expect(topicMatchesHash({ slug: "sys.401k-loans" }, "#hardship")).toBe(false);
    expect(topicMatchesHash({ slug: "sys.401k-loans" }, "")).toBe(false);
  });
});

describe("readOptionParam", () => {
  it("reads the option with or without the leading question mark", () => {
    expect(readOptionParam("?option=ira")).toBe("ira");
    expect(readOptionParam("option=ira")).toBe("ira");
    expect(readOptionParam("?forPortal=1&option=ira")).toBe("ira");
  });

  it("returns an empty string when there is no option", () => {
    expect(readOptionParam("?forPortal=1")).toBe("");
    expect(readOptionParam("")).toBe("");
    expect(readOptionParam(null)).toBe("");
  });
});

describe("buildTopicUrl", () => {
  it("sets the hash and keeps the existing query", () => {
    expect(
      buildTopicUrl("https://portal.test/acme/retirement?forPortal=1", "sys.401k-loans"),
    ).toBe("/acme/retirement?forPortal=1#401k-loans");
  });

  it("carries the option for an Options Compare answer", () => {
    expect(
      buildTopicUrl(
        "https://portal.test/acme/retirement",
        "sys.rollovers-distributions",
        "ira",
      ),
    ).toBe("/acme/retirement?option=ira#rollovers-distributions");
  });

  it("clears both the hash and the option when there is no slug", () => {
    expect(
      buildTopicUrl(
        "https://portal.test/acme/retirement?option=ira#rollovers",
        null,
        null,
      ),
    ).toBe("/acme/retirement");
  });
});

describe("resolveTopicHref", () => {
  it("keeps an internal path inside the plan", () => {
    expect(resolveTopicHref("/retirement", "/acme")).toEqual({
      href: "/acme/retirement",
      external: false,
    });
  });

  it("opens an absolute URL in a new tab", () => {
    expect(resolveTopicHref("https://voya.com/login", "/acme")).toEqual({
      href: "https://voya.com/login",
      external: true,
    });
  });

  it("treats a bare hostname as external", () => {
    expect(resolveTopicHref("voya.com/login", "/acme")).toEqual({
      href: "https://voya.com/login",
      external: true,
    });
  });

  it("leaves hash, mailto and tel links in place", () => {
    expect(resolveTopicHref("#documents", "/acme")).toEqual({
      href: "#documents",
      external: false,
    });
    expect(resolveTopicHref("mailto:hr@acme.com", "/acme").external).toBe(false);
    expect(resolveTopicHref("tel:+15550001", "/acme").external).toBe(false);
  });

  it("renders nothing for an empty destination", () => {
    expect(resolveTopicHref("", "/acme")).toEqual({ href: "", external: false });
    expect(resolveTopicHref(null, "/acme")).toEqual({ href: "", external: false });
  });
});
