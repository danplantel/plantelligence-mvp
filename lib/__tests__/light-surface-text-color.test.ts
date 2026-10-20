import { describe, expect, it } from "vitest";

import { bestTextColor, lightSurfaceTextColor } from "../color-utils";

/**
 * `lightSurfaceTextColor` is the rule the portal footer (and the Disclosures
 * editor) use to keep copy readable on a colour the advisor picked.
 *
 * It is deliberately **not** `bestTextColor`: that maximises contrast, so a
 * vivid yellow or amber brand colour would get black text even though it was
 * chosen as a colour rather than as a light surface. The rule here is
 * HSL-based — near-white is a light surface, everything else keeps white text —
 * and the divergence is pinned below so neither function is "fixed" into the
 * other.
 */

describe("lightSurfaceTextColor", () => {
  it("puts dark text on white and near-white surfaces", () => {
    expect(lightSurfaceTextColor("#FFFFFF")).toBe("#000000");
    expect(lightSurfaceTextColor("#fff")).toBe("#000000");
    expect(lightSurfaceTextColor("#FAFAF6")).toBe("#000000");
  });

  it("puts dark text on a pale neutral grey", () => {
    expect(lightSurfaceTextColor("#EEEEEE")).toBe("#000000");
  });

  it("keeps white text on dark colours", () => {
    expect(lightSurfaceTextColor("#000000")).toBe("#FFFFFF");
    expect(lightSurfaceTextColor("#1F3A60")).toBe("#FFFFFF");
    expect(lightSurfaceTextColor("#23919C")).toBe("#FFFFFF");
  });

  it("keeps white text on a saturated bright colour", () => {
    expect(lightSurfaceTextColor("#FFD700")).toBe("#FFFFFF");
    expect(lightSurfaceTextColor("#FF0000")).toBe("#FFFFFF");
  });

  it("falls back to white text for an unreadable value", () => {
    expect(lightSurfaceTextColor("")).toBe("#FFFFFF");
    expect(lightSurfaceTextColor("not-a-colour")).toBe("#FFFFFF");
    // Callers pass hex (brand colours and the footer preference are stored that
    // way); anything else is treated as "no usable colour" rather than guessed.
    expect(lightSurfaceTextColor("rgb(255, 255, 255)")).toBe("#FFFFFF");
  });
});

describe("lightSurfaceTextColor vs bestTextColor", () => {
  it("differs on vivid colours by design", () => {
    // Maximum contrast would flip amber to black…
    expect(bestTextColor("#FFD700")).toBe("#000000");
    // …while the portal keeps the white text the advisor expects on a colour.
    expect(lightSurfaceTextColor("#FFD700")).toBe("#FFFFFF");
  });

  it("agrees on genuine light and dark surfaces", () => {
    expect(bestTextColor("#FFFFFF")).toBe(lightSurfaceTextColor("#FFFFFF"));
    expect(bestTextColor("#1F3A60")).toBe(lightSurfaceTextColor("#1F3A60"));
  });
});
