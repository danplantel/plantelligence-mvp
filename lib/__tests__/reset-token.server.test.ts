import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createResetToken,
  verifyResetToken,
} from "../reset-token.server";

const originalSecret = process.env.RESET_PASSWORD_SECRET;

describe("reset token", () => {
  beforeEach(() => {
    process.env.RESET_PASSWORD_SECRET = "test-reset-secret";
  });

  afterEach(() => {
    process.env.RESET_PASSWORD_SECRET = originalSecret;
  });

  it("round-trips a normalized email", () => {
    const token = createResetToken("  ADA@Example.com  ");

    expect(verifyResetToken(token)).toBe("ada@example.com");
  });

  it("rejects a malformed token", () => {
    expect(verifyResetToken("not-a-token")).toBeNull();
    expect(verifyResetToken("")).toBeNull();
    expect(verifyResetToken(null)).toBeNull();
  });

  it("rejects a token signed with another secret", () => {
    const token = jwt.sign(
      { email: "ada@example.com", purpose: "password-reset" },
      "other-secret",
      { expiresIn: "5m" },
    );

    expect(verifyResetToken(token)).toBeNull();
  });

  it("rejects a token with the wrong purpose", () => {
    const token = jwt.sign(
      { email: "ada@example.com", purpose: "something-else" },
      "test-reset-secret",
      { expiresIn: "5m" },
    );

    expect(verifyResetToken(token)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = jwt.sign(
      { email: "ada@example.com", purpose: "password-reset" },
      "test-reset-secret",
      { expiresIn: -1 },
    );

    expect(verifyResetToken(token)).toBeNull();
  });

  it("refuses to create a token without a configured secret", () => {
    delete process.env.RESET_PASSWORD_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    delete process.env.JWT_SECRET;

    expect(() => createResetToken("ada@example.com")).toThrow(
      "No secret configured",
    );
    expect(verifyResetToken("anything")).toBeNull();
  });
});
