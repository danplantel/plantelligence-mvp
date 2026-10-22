import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "../icon/route";

/**
 * `GET /api/pwa/icon` — the installed app's plan logo.
 *
 * The route must render a square PNG at the manifest's declared size, read the
 * logo from every storage shape the app uses, and fall back to the platform
 * icon rather than serving a broken image.
 */

const mocks = vi.hoisted(() => {
  const toBuffer = vi.fn(async () => Buffer.from("png-bytes"));
  const png = vi.fn(() => ({ toBuffer }));
  const resize = vi.fn(() => ({ png }));
  const sharp = vi.fn(() => ({ resize }));
  return {
    prisma: {
      client: { findFirst: vi.fn() },
    },
    isR2Configured: vi.fn(() => false),
    getObjectFromR2: vi.fn(),
    sharp,
    resize,
    png,
    toBuffer,
  };
});

vi.mock("@/lib/prisma", () => ({
  default: mocks.prisma,
  prisma: mocks.prisma,
}));

vi.mock("@/lib/r2", () => ({
  isR2Configured: mocks.isR2Configured,
  getObjectFromR2: mocks.getObjectFromR2,
}));

vi.mock("sharp", () => ({ default: mocks.sharp }));

function iconRequest(query = "?slug=acme&size=192") {
  return new NextRequest(
    new URL(`/api/pwa/icon${query}`, "http://localhost"),
  );
}

describe("GET /api/pwa/icon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isR2Configured.mockReturnValue(false);
    mocks.prisma.client.findFirst.mockResolvedValue({
      id: "plan-1",
      userId: "user-1",
      companyLogo: "data:image/png;base64,AAAA",
    });
  });

  it("renders the plan logo at the requested square size", async () => {
    const response = await GET(iconRequest()); // size=192

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(mocks.resize).toHaveBeenCalledWith(192, 192, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    });
  });

  it("renders the 512px variant declared by the manifest", async () => {
    await GET(iconRequest("?slug=acme&size=512"));

    expect(mocks.resize).toHaveBeenCalledWith(512, 512, expect.any(Object));
  });

  it("reads an R2-keyed logo server-side", async () => {
    mocks.isR2Configured.mockReturnValue(true);
    mocks.getObjectFromR2.mockResolvedValue({
      body: new Uint8Array([1, 2, 3]),
      contentType: "image/png",
    });
    mocks.prisma.client.findFirst.mockResolvedValue({
      id: "plan-1",
      userId: "user-1",
      companyLogo: "org/user-1/plans/plan-1/branding/logo/logo.png",
    });

    const response = await GET(iconRequest());

    expect(response.status).toBe(200);
    expect(mocks.getObjectFromR2).toHaveBeenCalledWith(
      "org/user-1/plans/plan-1/branding/logo/logo.png",
    );
  });

  it("redirects to the platform icon when the plan has no logo", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue({
      id: "plan-1",
      userId: "user-1",
      companyLogo: null,
    });

    const response = await GET(iconRequest("?slug=acme&size=192"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toMatch(
      /\/pwa\/icon-192\.png$/,
    );
  });

  it("redirects to the 512 fallback when no size is supplied", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue(null);

    const response = await GET(iconRequest("?slug=acme"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toMatch(
      /\/pwa\/icon-512\.png$/,
    );
  });
});
