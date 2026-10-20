import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "../route";

/**
 * `GET /api/check-portal-url` — the debounced availability check behind the
 * Portal URL field in Edit Plan (and Create Plan's Step 1).
 *
 * A `false` answer is expensive: it either blocks a save or lets an advisor
 * claim a URL that belongs to another plan. The rules are subtle on purpose:
 *
 *  - The submitted value is sanitized exactly like the save path does
 *    (lowercase, `[^a-z0-9-]` → `-`, collapse, trim, 30-char cap), so the answer
 *    describes the slug that would actually be written.
 *  - The plan being edited excludes itself, whether it is passed as an ObjectId
 *    or as a slug — otherwise renaming a plan flags its own URL as taken.
 *  - The caller's current draft wizard session is excluded too, and the
 *    registry is consulted because RETIRED aliases stay permanently reserved.
 */

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  prisma: {
    client: { findFirst: vi.fn() },
    newClientWizardSession: { findFirst: vi.fn() },
    newClientCompanyBasics: { findFirst: vi.fn() },
    portalSlug: { findUnique: vi.fn() },
  },
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getSession }));
vi.mock("@/lib/auth-options", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  default: mocks.prisma,
  prisma: mocks.prisma,
}));

const OWNER_ID = "user-1";
const PLAN_ID = "507f1f77bcf86cd799439011";
const SESSION_ID = "507f1f77bcf86cd799439012";

function callCheck(query: string) {
  const request = new NextRequest(
    new URL(`/api/check-portal-url${query}`, "http://localhost"),
  );
  return GET(request);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.getSession.mockResolvedValue({ user: { id: OWNER_ID } });
  mocks.prisma.client.findFirst.mockResolvedValue(null);
  mocks.prisma.newClientWizardSession.findFirst.mockResolvedValue(null);
  mocks.prisma.newClientCompanyBasics.findFirst.mockResolvedValue(null);
  mocks.prisma.portalSlug.findUnique.mockResolvedValue(null);
});

describe("auth and validation", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    const response = await callCheck("?slug=acme");

    expect(response.status).toBe(401);
    expect(mocks.prisma.client.findFirst).not.toHaveBeenCalled();
  });

  it("requires a slug", async () => {
    const missing = await callCheck("");
    const blank = await callCheck("?slug=%20%20");

    expect(missing.status).toBe(400);
    expect(await missing.json()).toEqual({
      error: "Missing or invalid slug parameter",
    });
    expect(blank.status).toBe(400);
  });

  it("rejects a value with no usable characters", async () => {
    const response = await callCheck("?slug=!!!");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Slug contains no valid characters",
    });
  });

  it("checks the sanitized form of what was typed", async () => {
    const response = await callCheck("?slug=%20My%20Plan%2F2024%20");
    const body = await response.json();

    expect(body.slug).toBe("my-plan-2024");
    expect(mocks.prisma.client.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "my-plan-2024" } }),
    );
  });

  it("caps the slug at 30 characters like the save path", async () => {
    const response = await callCheck(`?slug=${"a".repeat(40)}`);

    expect((await response.json()).slug).toBe("a".repeat(30));
  });
});

describe("availability", () => {
  it("reports a free slug", async () => {
    const response = await callCheck("?slug=acme");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      available: true,
      taken: false,
      slug: "acme",
      ownedByCurrentUser: false,
    });
  });

  it("flags a plan that already uses the slug", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue({
      id: PLAN_ID,
      userId: "someone-else",
    });

    const body = await (await callCheck("?slug=acme")).json();

    expect(body.taken).toBe(true);
    expect(body.available).toBe(false);
    expect(body.ownedByCurrentUser).toBe(false);
  });

  it("reports when the caller owns the plan holding the slug", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue({
      id: PLAN_ID,
      userId: OWNER_ID,
    });

    const body = await (await callCheck("?slug=acme")).json();

    expect(body.taken).toBe(true);
    expect(body.ownedByCurrentUser).toBe(true);
  });

  it("excludes the plan being edited when it is passed as an ObjectId", async () => {
    await callCheck(`?slug=acme&clientId=${PLAN_ID}`);

    expect(mocks.prisma.client.findFirst).toHaveBeenCalledWith({
      where: { slug: "acme", id: { not: PLAN_ID } },
      select: { id: true, userId: true },
    });
  });

  it("resolves a slug-form clientId before excluding it", async () => {
    mocks.prisma.client.findFirst
      .mockResolvedValueOnce({ id: PLAN_ID })
      .mockResolvedValueOnce(null);

    await callCheck("?slug=acme&clientId=acme-old");

    expect(mocks.prisma.client.findFirst).toHaveBeenNthCalledWith(1, {
      where: { OR: [{ slug: "acme-old" }, { id: "acme-old" }] },
      select: { id: true },
    });
    expect(mocks.prisma.client.findFirst).toHaveBeenNthCalledWith(2, {
      where: { slug: "acme", id: { not: PLAN_ID } },
      select: { id: true, userId: true },
    });
  });

  it("flags a URL claimed by another of the caller's drafts", async () => {
    mocks.prisma.newClientWizardSession.findFirst.mockResolvedValue({
      id: SESSION_ID,
    });
    mocks.prisma.newClientCompanyBasics.findFirst.mockResolvedValue({
      id: "basics-1",
    });

    const body = await (await callCheck("?slug=acme")).json();

    expect(body.taken).toBe(true);
    expect(mocks.prisma.newClientCompanyBasics.findFirst).toHaveBeenCalledWith({
      where: {
        portalUrl: "acme",
        session: { userId: OWNER_ID, id: { not: SESSION_ID } },
      },
      select: { id: true },
    });
  });

  it("excludes the caller's newest incomplete wizard session", async () => {
    await callCheck("?slug=acme");

    expect(mocks.prisma.newClientWizardSession.findFirst).toHaveBeenCalledWith({
      where: { userId: OWNER_ID, completed: false },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
  });

  it("uses an explicit session id instead of looking one up", async () => {
    await callCheck(`?slug=acme&sessionId=${SESSION_ID}`);

    expect(
      mocks.prisma.newClientWizardSession.findFirst,
    ).not.toHaveBeenCalled();
    expect(mocks.prisma.newClientCompanyBasics.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          session: { userId: OWNER_ID, id: { not: SESSION_ID } },
        }),
      }),
    );
  });

  it("flags a retired alias reserved to another plan", async () => {
    mocks.prisma.portalSlug.findUnique.mockResolvedValue({
      clientId: "another-plan",
    });

    const body = await (await callCheck("?slug=old-acme")).json();

    expect(body.taken).toBe(true);
    expect(mocks.prisma.portalSlug.findUnique).toHaveBeenCalledWith({
      where: { slug: "old-acme" },
      select: { clientId: true },
    });
  });

  it("treats the caller's own alias as free for that plan", async () => {
    mocks.prisma.portalSlug.findUnique.mockResolvedValue({ clientId: PLAN_ID });

    const body = await (
      await callCheck(`?slug=old-acme&clientId=${PLAN_ID}`)
    ).json();

    expect(body.available).toBe(true);
    expect(body.taken).toBe(false);
  });

  it("skips the draft check once a plan already owns the slug", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue({
      id: PLAN_ID,
      userId: "someone-else",
    });

    await callCheck("?slug=acme");

    expect(
      mocks.prisma.newClientCompanyBasics.findFirst,
    ).not.toHaveBeenCalled();
  });

  it("returns 500 when the lookup fails", async () => {
    mocks.prisma.client.findFirst.mockRejectedValue(new Error("db down"));

    const response = await callCheck("?slug=acme");

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Failed to check portal URL availability",
    });
  });
});
