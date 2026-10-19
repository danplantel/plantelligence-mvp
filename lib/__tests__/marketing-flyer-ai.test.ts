import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
}));

import { generateFlyerCopy } from "@/lib/marketing/flyer-ai";
import type { FlyerBrandSnapshot } from "@/lib/marketing/flyer-brand";

const brand: FlyerBrandSnapshot = {
  sponsor: {
    companyName: "Acme",
    brandColor: "#111111",
    secondaryColor: "#222222",
    companyLogo: null,
  },
  organization: {
    organizationType: "RIA",
    name: "Advisor",
    advisorLogo: null,
    advisorLogoUrl: null,
  },
};

const input = {
  mode: "hub_promo_general" as const,
  modeOptions: { topic: "Retirement" },
  brand,
  userHint: "friendly",
};

function completion(content: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] }),
    text: async () => "",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_FLYER_MODEL;
  vi.stubGlobal("fetch", mocks.fetch);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("generateFlyerCopy", () => {
  it("returns deterministic fallback copy without an API key", async () => {
    const result = await generateFlyerCopy(input);

    expect(result).toEqual({
      headline: "Hub promo — general",
      body: expect.stringContaining("Acme: everything you need"),
      cta: "Visit your Benefits Hub",
      aiModel: null,
      aiPromptVersion: "flyer-copy-v1",
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("calls OpenAI and returns the parsed copy", async () => {
    process.env.OPENAI_API_KEY = "key";
    mocks.fetch.mockResolvedValue(
      completion(
        JSON.stringify({
          headline: "  Your benefits  ",
          body: "  Body copy  ",
          cta: "  Open  ",
        }),
      ),
    );

    const result = await generateFlyerCopy(input);

    expect(result).toEqual({
      headline: "Your benefits",
      body: "Body copy",
      cta: "Open",
      aiModel: "gpt-4o-mini",
      aiPromptVersion: "flyer-copy-v1",
    });
    const request = mocks.fetch.mock.calls[0][1];
    expect(request.headers.Authorization).toBe("Bearer key");
    const payload = JSON.parse(request.body);
    expect(payload.model).toBe("gpt-4o-mini");
    expect(payload.messages[1].content).toContain("Plan sponsor / employer: Acme");
    expect(payload.messages[1].content).toContain("Additional instructions from user: friendly");
  });

  it("uses the configured model", async () => {
    process.env.OPENAI_API_KEY = "key";
    process.env.OPENAI_FLYER_MODEL = "gpt-custom";
    mocks.fetch.mockResolvedValue(completion(JSON.stringify({})));

    const result = await generateFlyerCopy(input);

    expect(result.aiModel).toBe("gpt-custom");
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body).model).toBe(
      "gpt-custom",
    );
  });

  it("fills blank fields from the fallback", async () => {
    process.env.OPENAI_API_KEY = "key";
    mocks.fetch.mockResolvedValue(
      completion(JSON.stringify({ headline: "", body: "", cta: "" })),
    );

    const result = await generateFlyerCopy(input);

    expect(result.headline).toBe("Hub promo — general");
    expect(result.body).toContain("Acme");
    expect(result.cta).toBe("Visit your Benefits Hub");
  });

  it("falls back on an HTTP error", async () => {
    process.env.OPENAI_API_KEY = "key";
    mocks.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "nope",
      json: async () => ({}),
    });

    const result = await generateFlyerCopy(input);

    expect(result.aiModel).toBeNull();
    expect(result.headline).toBe("Hub promo — general");
  });

  it("falls back when the response has no content", async () => {
    process.env.OPENAI_API_KEY = "key";
    mocks.fetch.mockResolvedValue(completion(""));

    await expect(generateFlyerCopy(input)).resolves.toEqual(
      expect.objectContaining({ aiModel: null }),
    );
  });

  it("falls back on invalid JSON or a thrown request", async () => {
    process.env.OPENAI_API_KEY = "key";
    mocks.fetch.mockResolvedValue(completion("not json"));
    await expect(generateFlyerCopy(input)).resolves.toEqual(
      expect.objectContaining({ aiModel: null }),
    );

    mocks.fetch.mockRejectedValue(new Error("network"));
    await expect(generateFlyerCopy(input)).resolves.toEqual(
      expect.objectContaining({ aiModel: null }),
    );
  });
});
