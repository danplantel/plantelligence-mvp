import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "../manifest/route";

/**
 * `GET /api/pwa/manifest` — per-plan install identity.
 *
 * The installed app must start at the plan's portal and carry the plan's name.
 * The name is read from the database when a slug is present, because the
 * browser's first manifest fetch can happen before the portal has loaded the
 * client row and filled in `?name=`.
 */

const mocks = vi.hoisted(() => ({
  prisma: {
    client: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({
  default: mocks.prisma,
  prisma: mocks.prisma,
}));

function manifestRequest(query = "") {
  return new NextRequest(
    new URL(`/api/pwa/manifest${query}`, "http://localhost"),
  );
}

async function bodyOf(response: Response) {
  return response.json();
}

describe("GET /api/pwa/manifest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.client.findFirst.mockResolvedValue(null);
  });

  it("returns the brand-level manifest with the platform icons when no plan is named", async () => {
    const response = await GET(manifestRequest());
    const body = await bodyOf(response);

    expect(body.name).toBe("PlanTelligence Benefits");
    expect(body.start_url).toBe("/");
    expect(body.icons.map((icon: any) => icon.src)).toEqual([
      "/pwa/icon-192.png",
      "/pwa/icon-512.png",
      "/pwa/icon-maskable-512.png",
    ]);
    expect(mocks.prisma.client.findFirst).not.toHaveBeenCalled();
  });

  it("names the plan from the database and points its icons at the plan icon route", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue({
      companyName: "Team Seat LLC",
    });

    const response = await GET(
      manifestRequest("?slug=acme&name=Wrong%20Name"),
    );
    const body = await bodyOf(response);

    expect(body.name).toBe("Team Seat LLC");
    // The home-screen label keeps every word, not just "Team".
    expect(body.short_name).toBe("Team Seat LLC");
    expect(body.start_url).toBe("/acme");
    expect(body.icons).toEqual([
      expect.objectContaining({
        src: "/api/pwa/icon?slug=acme&size=192",
        sizes: "192x192",
        purpose: "any",
      }),
      expect.objectContaining({
        src: "/api/pwa/icon?slug=acme&size=512",
        sizes: "512x512",
        purpose: "any",
      }),
      expect.objectContaining({
        src: "/api/pwa/icon?slug=acme&size=512",
        sizes: "512x512",
        purpose: "maskable",
      }),
    ]);
  });

  it("falls back to the query name when the slug names no plan", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue(null);

    const response = await GET(
      manifestRequest("?slug=unknown-unit&name=Query%20Co"),
    );
    const body = await bodyOf(response);

    expect(body.name).toBe("Query Co");
    expect(body.start_url).toBe("/unknown-unit");
    expect(body.icons[0].src).toBe(
      "/api/pwa/icon?slug=unknown-unit&size=192",
    );
  });
});
