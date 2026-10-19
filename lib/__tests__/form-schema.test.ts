import { describe, expect, it } from "vitest";

import {
  passwordSchema,
  resetPasswordSchema,
  signinSchema,
  signupSchema,
} from "../form-schema";

const VALID_PASSWORD = "Str0ng!Pass";

function messages(result: {
  success: boolean;
  error?: { issues: { message: string; path: (string | number)[] }[] };
}) {
  return result.error?.issues.map((issue) => issue.message) ?? [];
}

describe("passwordSchema", () => {
  it("accepts a password with all four character classes", () => {
    expect(passwordSchema.safeParse(VALID_PASSWORD).success).toBe(true);
  });

  it("accepts exactly 8 characters", () => {
    expect(passwordSchema.safeParse("Aa1!aaaa").success).toBe(true);
  });

  it("rejects passwords shorter than 8 characters", () => {
    const result = passwordSchema.safeParse("Aa1!aaa");
    expect(result.success).toBe(false);
    expect(messages(result)).toContain(
      "Password must be at least 8 characters",
    );
  });

  it("rejects passwords longer than 128 characters", () => {
    const result = passwordSchema.safeParse(`Aa1!${"a".repeat(126)}`);
    expect(result.success).toBe(false);
    expect(messages(result)).toContain(
      "Password must be less than 128 characters",
    );
  });

  it.each([
    ["uppercase", "str0ng!pass", "Password must contain at least one uppercase letter"],
    ["lowercase", "STR0NG!PASS", "Password must contain at least one lowercase letter"],
    ["number", "Strong!Pass", "Password must contain at least one number"],
    ["special", "StrongPass1", "Password must contain at least one special character"],
  ])("requires at least one %s character", (_label, value, message) => {
    const result = passwordSchema.safeParse(value);
    expect(result.success).toBe(false);
    expect(messages(result)).toContain(message);
  });
});

describe("signupSchema", () => {
  const base = {
    name: "Ada Lovelace",
    email: "ada@example.com",
    password: VALID_PASSWORD,
    confirmPassword: VALID_PASSWORD,
  };

  it("accepts a complete, matching sign-up payload", () => {
    expect(signupSchema.safeParse(base).success).toBe(true);
  });

  it("requires a name", () => {
    const result = signupSchema.safeParse({ ...base, name: "" });
    expect(result.success).toBe(false);
    expect(messages(result)).toContain("Name is required");
  });

  it("caps the name at 100 characters", () => {
    const result = signupSchema.safeParse({ ...base, name: "a".repeat(101) });
    expect(result.success).toBe(false);
    expect(messages(result)).toContain("Name must be 100 characters or less");
  });

  it("rejects an invalid email", () => {
    const result = signupSchema.safeParse({ ...base, email: "not-an-email" });
    expect(result.success).toBe(false);
    expect(messages(result)).toContain("Enter a valid email address");
  });

  it("caps the email at 254 characters", () => {
    const result = signupSchema.safeParse({
      ...base,
      email: `${"a".repeat(245)}@example.com`,
    });
    expect(result.success).toBe(false);
    expect(messages(result)).toContain("Email must be 254 characters or less");
  });

  it("applies the shared password policy", () => {
    const result = signupSchema.safeParse({
      ...base,
      password: "weak",
      confirmPassword: "weak",
    });
    expect(result.success).toBe(false);
    expect(messages(result)).toContain(
      "Password must be at least 8 characters",
    );
  });

  it("reports a password mismatch on confirmPassword", () => {
    const result = signupSchema.safeParse({
      ...base,
      confirmPassword: "Different1!",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"]);
    expect(messages(result)).toContain("Passwords must match");
  });

  it("requires the confirmation field", () => {
    const result = signupSchema.safeParse({ ...base, confirmPassword: "" });
    expect(result.success).toBe(false);
    expect(messages(result)).toContain("Please confirm your password");
  });
});

describe("resetPasswordSchema", () => {
  it("accepts matching passwords that satisfy the policy", () => {
    expect(
      resetPasswordSchema.safeParse({
        password: VALID_PASSWORD,
        confirmPassword: VALID_PASSWORD,
      }).success,
    ).toBe(true);
  });

  it("enforces the password policy", () => {
    const result = resetPasswordSchema.safeParse({
      password: "short",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
    expect(messages(result)).toContain(
      "Password must be at least 8 characters",
    );
  });

  it("rejects a mismatch on confirmPassword", () => {
    const result = resetPasswordSchema.safeParse({
      password: VALID_PASSWORD,
      confirmPassword: "Different1!",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"]);
    expect(messages(result)).toContain("Passwords must match");
  });

  it("rejects an empty confirmation", () => {
    const result = resetPasswordSchema.safeParse({
      password: VALID_PASSWORD,
      confirmPassword: "",
    });
    expect(result.success).toBe(false);
    expect(messages(result)).toContain("Passwords must match");
  });
});

describe("signinSchema", () => {
  it("accepts a valid email and a non-empty password", () => {
    expect(
      signinSchema.safeParse({
        email: "ada@example.com",
        password: "anything",
      }).success,
    ).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = signinSchema.safeParse({
      email: "ada",
      password: "anything",
    });
    expect(result.success).toBe(false);
    expect(messages(result)).toContain("Enter a valid email address");
  });

  it("requires a password", () => {
    const result = signinSchema.safeParse({
      email: "ada@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
    expect(messages(result)).toContain("Password is required");
  });

  it("does not apply the password policy at sign-in time", () => {
    expect(
      signinSchema.safeParse({
        email: "ada@example.com",
        password: "short",
      }).success,
    ).toBe(true);
  });
});
