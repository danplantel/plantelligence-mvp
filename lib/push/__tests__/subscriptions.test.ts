import { describe, expect, it, vi } from "vitest";

// The validators are pure, but the module imports the Prisma client at load time.
vi.mock("@/lib/prisma", () => ({ default: {}, prisma: {} }));

import { readPushEndpoint, readPushKey } from "@/lib/push/subscriptions.server";

/**
 * Input validation for the one endpoint that writes a bearer capability into the database.
 *
 * Both of these run BEFORE the session is even consulted, so they are the first line of defence
 * against a caller using the table as arbitrary storage — or handing `web-push` a value it will
 * happily encrypted-POST to.
 */
describe("readPushEndpoint", () => {
  const valid = "https://fcm.googleapis.com/fcm/send/abc123:def";

  it("accepts a push service URL", () => {
    expect(readPushEndpoint(valid)).toBe(valid);
  });

  it("trims surrounding whitespace", () => {
    expect(readPushEndpoint(`  ${valid}  `)).toBe(valid);
  });

  it("rejects anything that is not an https URL", () => {
    // A relative or javascript: endpoint would be handed to web-push verbatim.
    expect(readPushEndpoint("http://example.test/x")).toBeNull();
    expect(readPushEndpoint("javascript:alert(1)")).toBeNull();
    expect(readPushEndpoint("/relative/path")).toBeNull();
    expect(readPushEndpoint("not a url")).toBeNull();
  });

  it("rejects non-strings, blanks and absurd lengths", () => {
    expect(readPushEndpoint(null)).toBeNull();
    expect(readPushEndpoint(42)).toBeNull();
    expect(readPushEndpoint("   ")).toBeNull();
    expect(readPushEndpoint(`https://example.test/${"a".repeat(4000)}`)).toBeNull();
  });
});

describe("readPushKey", () => {
  it("accepts a base64url key", () => {
    expect(readPushKey("BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM")).toBe(
      "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
    );
  });

  it("rejects values that are not base64url", () => {
    expect(readPushKey("has spaces in it — definitely not a key")).toBeNull();
    expect(readPushKey("has+plus/and=slash")).toBeNull();
  });

  it("rejects values too short to be a key", () => {
    expect(readPushKey("abc")).toBeNull();
    expect(readPushKey("")).toBeNull();
  });

  it("rejects non-strings", () => {
    expect(readPushKey(undefined)).toBeNull();
    expect(readPushKey({})).toBeNull();
  });
});
