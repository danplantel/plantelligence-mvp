import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

const sendResetEmail = vi.hoisted(() =>
  vi.fn(async (_email: string, _code: string, _baseUrl: string) => true),
);
const createResetToken = vi.hoisted(() => vi.fn(() => "reset-token"));
const verifyResetToken = vi.hoisted(() => vi.fn());
const genSaltSync = vi.hoisted(() => vi.fn(() => "salt"));
const hashSync = vi.hoisted(() => vi.fn(() => "hashed-password"));

vi.mock("@prisma/client", () => ({
  // `new PrismaClient()` must be constructible; a plain vi.fn arrow is not.
  PrismaClient: class {
    user = prisma.user;
  },
}));
vi.mock("@/lib/prisma", () => ({ default: prisma }));
vi.mock("@/lib/sendResetEmail", () => ({ default: sendResetEmail }));
vi.mock("@/lib/reset-token.server", () => ({
  createResetToken,
  verifyResetToken,
}));
vi.mock("bcryptjs", () => ({
  default: { genSaltSync, hashSync },
}));

import { POST as forgetPost } from "../forget/route";
import { POST as verifyCodePost } from "../verify-code/route";
import { POST as resetPasswordPost } from "../reset-password/route";
import { POST as signupPost } from "../signup/route";
import { GET as checkEmailGet } from "../check-email/route";

function post(body: unknown, url = "http://localhost/api/test") {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function bodyOf(response: Response) {
  return response.json();
}

describe("auth API routes", () => {
  const originalNextAuthUrl = process.env.NEXTAUTH_URL;

  beforeEach(() => {
    process.env.NEXTAUTH_URL = "https://app.example";
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: "user-1",
      name: "Ada",
      email: "ada@example.com",
      password: "hashed-password",
      resetCode: null,
      resetCodeExpiry: null,
    });
    prisma.user.update.mockResolvedValue({});
    sendResetEmail.mockReset();
    sendResetEmail.mockResolvedValue(true);
    createResetToken.mockReset();
    createResetToken.mockReturnValue("reset-token");
    verifyResetToken.mockReset();
    verifyResetToken.mockReturnValue(null);
    genSaltSync.mockClear();
    hashSync.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NEXTAUTH_URL = originalNextAuthUrl;
  });

  describe("POST /api/forget", () => {
    it("rejects a missing email", async () => {
      const response = await forgetPost(post({}));

      expect(response.status).toBe(400);
      expect(await bodyOf(response)).toEqual({
        error: "Email field is required",
      });
    });

    it("returns a neutral response for an unknown account", async () => {
      const response = await forgetPost(post({ email: "nobody@example.com" }));

      expect(response.status).toBe(200);
      expect(sendResetEmail).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("emails a six-digit code and stores its expiry", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "ada@example.com",
      });

      const before = Date.now();
      const response = await forgetPost(post({ email: "ada@example.com" }));

      expect(response.status).toBe(200);
      expect(sendResetEmail).toHaveBeenCalledTimes(1);

      const [email, code, baseUrl] = sendResetEmail.mock.calls[0];
      expect(email).toBe("ada@example.com");
      expect(code).toMatch(/^\d{6}$/);
      expect(baseUrl).toBe("https://app.example");

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { email: "ada@example.com" },
        data: {
          resetCode: code,
          resetCodeExpiry: expect.any(Date),
        },
      });

      const expiry = prisma.user.update.mock.calls[0][0].data
        .resetCodeExpiry as Date;
      expect(expiry.getTime()).toBeGreaterThan(before + 23 * 60 * 60 * 1000);
      expect(expiry.getTime()).toBeLessThan(before + 25 * 60 * 60 * 1000);
    });

    it("returns 500 when the email cannot be sent and does not store a code", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "ada@example.com",
      });
      sendResetEmail.mockResolvedValue(false);

      const response = await forgetPost(post({ email: "ada@example.com" }));

      expect(response.status).toBe(500);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/verify-code", () => {
    it("rejects missing fields", async () => {
      const response = await verifyCodePost(post({ email: "a@b.com" }));

      expect(response.status).toBe(400);
    });

    it("returns 404 for an unknown account", async () => {
      const response = await verifyCodePost(
        post({ email: "nobody@example.com", code: "123456" }),
      );

      expect(response.status).toBe(404);
    });

    it("rejects a wrong code", async () => {
      prisma.user.findUnique.mockResolvedValue({
        email: "ada@example.com",
        resetCode: "111111",
        resetCodeExpiry: new Date(Date.now() + 60_000),
      });

      const response = await verifyCodePost(
        post({ email: "ada@example.com", code: "222222" }),
      );

      expect(response.status).toBe(401);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("rejects an expired code", async () => {
      prisma.user.findUnique.mockResolvedValue({
        email: "ada@example.com",
        resetCode: "123456",
        resetCodeExpiry: new Date(Date.now() - 1),
      });

      const response = await verifyCodePost(
        post({ email: "ada@example.com", code: "123456" }),
      );

      expect(response.status).toBe(401);
    });

    it("clears the code and issues a reset token on success", async () => {
      prisma.user.findUnique.mockResolvedValue({
        email: "ada@example.com",
        resetCode: "123456",
        resetCodeExpiry: new Date(Date.now() + 60_000),
      });

      const response = await verifyCodePost(
        post({ email: "ada@example.com", code: "123456" }),
      );

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { email: "ada@example.com" },
        data: { resetCode: null, resetCodeExpiry: null },
      });
      expect(createResetToken).toHaveBeenCalledWith("ada@example.com");
      expect(await bodyOf(response)).toEqual({
        message: "Verification successful",
        resetToken: "reset-token",
      });
    });
  });

  describe("POST /api/reset-password", () => {
    it("rejects missing fields", async () => {
      const response = await resetPasswordPost(post({ email: "a@b.com" }));

      expect(response.status).toBe(400);
    });

    it("rejects a missing or invalid reset token before touching the user", async () => {
      const response = await resetPasswordPost(
        post({
          email: "ada@example.com",
          newPassword: "Password1!",
          resetToken: "bad",
        }),
      );

      expect(response.status).toBe(401);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("rejects a token issued for a different email", async () => {
      verifyResetToken.mockReturnValue("someone-else@example.com");

      const response = await resetPasswordPost(
        post({
          email: "ada@example.com",
          newPassword: "Password1!",
          resetToken: "token",
        }),
      );

      expect(response.status).toBe(401);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("returns 404 when the verified account no longer exists", async () => {
      verifyResetToken.mockReturnValue("ada@example.com");

      const response = await resetPasswordPost(
        post({
          email: "ada@example.com",
          newPassword: "Password1!",
          resetToken: "token",
        }),
      );

      expect(response.status).toBe(404);
    });

    it("rejects a password shorter than eight characters", async () => {
      verifyResetToken.mockReturnValue("ada@example.com");
      prisma.user.findUnique.mockResolvedValue({ email: "ada@example.com" });

      const response = await resetPasswordPost(
        post({
          email: "ada@example.com",
          newPassword: "short",
          resetToken: "token",
        }),
      );

      expect(response.status).toBe(400);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("hashes and stores the new password", async () => {
      verifyResetToken.mockReturnValue("ada@example.com");
      prisma.user.findUnique.mockResolvedValue({ email: "ada@example.com" });

      const response = await resetPasswordPost(
        post({
          email: "ada@example.com",
          newPassword: "Password1!",
          resetToken: "token",
        }),
      );

      expect(hashSync).toHaveBeenCalledWith("Password1!", "salt");
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { email: "ada@example.com" },
        data: { password: "hashed-password" },
      });
      expect(await bodyOf(response)).toEqual({
        message: "Password reset successful",
      });
    });

    it("returns 500 when the update fails", async () => {
      verifyResetToken.mockReturnValue("ada@example.com");
      prisma.user.findUnique.mockResolvedValue({ email: "ada@example.com" });
      prisma.user.update.mockRejectedValue(new Error("db down"));

      const response = await resetPasswordPost(
        post({
          email: "ada@example.com",
          newPassword: "Password1!",
          resetToken: "token",
        }),
      );

      expect(response.status).toBe(500);
    });
  });

  describe("POST /api/signup", () => {
    it("rejects missing fields", async () => {
      const response = await signupPost(post({ email: "a@b.com" }));

      expect(response.status).toBe(400);
    });

    it("rejects a duplicate email", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "existing" });

      const response = await signupPost(
        post({
          name: "Ada",
          email: "ada@example.com",
          password: "Password1!",
        }),
      );

      expect(response.status).toBe(409);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it("hashes the password and never returns it", async () => {
      const response = await signupPost(
        post({
          name: "Ada",
          email: "ada@example.com",
          password: "Password1!",
        }),
      );

      expect(hashSync).toHaveBeenCalledWith("Password1!", "salt");
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          name: "Ada",
          email: "ada@example.com",
          password: "hashed-password",
        },
      });

      const body = await bodyOf(response);
      expect(body.user).toEqual({
        id: "user-1",
        name: "Ada",
        email: "ada@example.com",
      });
      expect(body.user).not.toHaveProperty("password");
      expect(body.user).not.toHaveProperty("resetCode");
      expect(body.user).not.toHaveProperty("resetCodeExpiry");
    });

    it("returns 500 on an unexpected error", async () => {
      prisma.user.create.mockRejectedValue(new Error("db down"));

      const response = await signupPost(
        post({
          name: "Ada",
          email: "ada@example.com",
          password: "Password1!",
        }),
      );

      expect(response.status).toBe(500);
    });
  });

  describe("GET /api/check-email", () => {
    function check(email?: string) {
      const url = email
        ? `http://localhost/api/check-email?email=${encodeURIComponent(email)}`
        : "http://localhost/api/check-email";
      return checkEmailGet(new Request(url) as any);
    }

    it("rejects a missing email", async () => {
      const response = await check();

      expect(response.status).toBe(400);
    });

    it("rejects a malformed email", async () => {
      const response = await check("not-an-email");

      expect(response.status).toBe(400);
    });

    it("lowercases and trims the email before lookup", async () => {
      const response = await check("  ADA@Example.com  ");

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          email: { equals: "ada@example.com", mode: "insensitive" },
        },
        select: { id: true },
      });
      expect(await bodyOf(response)).toEqual({
        exists: false,
        available: true,
      });
    });

    it("reports an existing email as unavailable", async () => {
      prisma.user.findFirst.mockResolvedValue({ id: "user-1" });

      const response = await check("ada@example.com");

      expect(await bodyOf(response)).toEqual({
        exists: true,
        available: false,
      });
    });

    it("returns 500 when the lookup fails", async () => {
      prisma.user.findFirst.mockRejectedValue(new Error("db down"));

      const response = await check("ada@example.com");

      expect(response.status).toBe(500);
    });
  });
});
