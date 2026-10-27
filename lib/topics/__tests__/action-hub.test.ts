import { describe, expect, it } from "vitest";

import {
  normalizeActionHubHref,
  resolveActionHubPanel,
  resolveActionHubRow,
  resolveActionHubRows,
  type ActionHubCandidate,
} from "@/lib/topics/action-hub";
import type { ActionHubRow } from "@/types/topic";

/**
 * TF-5 · Action Hubs (handoff §6).
 *
 * The acceptance cases are the last three blocks: a plan that holds beneficiaries in
 * two benefits shows two rows, hiding one benefit removes its row, and a plan with a
 * single row links straight at it instead of opening a one-item panel.
 */

function candidate(
  overrides: Partial<ActionHubCandidate> = {},
): ActionHubCandidate {
  return { location: "retirement", ...overrides };
}

function row(overrides: Partial<ActionHubRow> = {}): ActionHubRow {
  return {
    location: "retirement",
    label: "Retirement",
    href: "https://voya.test/beneficiaries",
    external: true,
    source: "provider",
    ...overrides,
  };
}

describe("normalizeActionHubHref", () => {
  it("leaves an absolute URL alone", () => {
    expect(normalizeActionHubHref("https://voya.test/beneficiaries")).toBe(
      "https://voya.test/beneficiaries",
    );
  });

  it("adds https:// to a bare host the advisor typed", () => {
    expect(normalizeActionHubHref("voya.com/beneficiaries")).toBe(
      "https://voya.com/beneficiaries",
    );
  });

  it("turns a bare address into a mailto: link", () => {
    expect(normalizeActionHubHref("beneficiaries@voya.test")).toBe(
      "mailto:beneficiaries@voya.test",
    );
  });

  it("keeps tel:, mailto:, #fragment and in-portal paths as written", () => {
    expect(normalizeActionHubHref("tel:+15550001")).toBe("tel:+15550001");
    expect(normalizeActionHubHref("mailto:a@b.test")).toBe("mailto:a@b.test");
    expect(normalizeActionHubHref("#beneficiaries")).toBe("#beneficiaries");
    expect(normalizeActionHubHref("/acme/life-insurance")).toBe(
      "/acme/life-insurance",
    );
  });

  it("returns nothing for an empty value", () => {
    expect(normalizeActionHubHref("   ")).toBe("");
    expect(normalizeActionHubHref(null)).toBe("");
  });
});

describe("resolveActionHubRow priority", () => {
  it("uses the advisor's sub-link first", () => {
    const resolved = resolveActionHubRow(
      candidate({
        link: { label: "Voya Retirement", url: "voya.test/beneficiaries" },
        providerUrl: "https://provider.test",
        contactUrl: "help@provider.test",
      }),
    );

    expect(resolved).toEqual({
      location: "retirement",
      label: "Voya Retirement",
      href: "https://voya.test/beneficiaries",
      external: true,
      source: "placement",
    });
  });

  it("falls back to the category's provider portal", () => {
    const resolved = resolveActionHubRow(
      candidate({ providerUrl: "https://provider.test/portal", contactUrl: "help@provider.test" }),
    );

    expect(resolved?.source).toBe("provider");
    expect(resolved?.href).toBe("https://provider.test/portal");
  });

  it("falls back to the contact when the plan has no provider portal", () => {
    const resolved = resolveActionHubRow(
      candidate({ contactUrl: "help@provider.test" }),
    );

    expect(resolved?.source).toBe("contact");
    expect(resolved?.href).toBe("mailto:help@provider.test");
    // A mailto: stays in the tab — opening a mail client in a new tab is noise.
    expect(resolved?.external).toBe(false);
  });

  it("names the row after the hub when the sub-link has no label", () => {
    const resolved = resolveActionHubRow(
      candidate({ location: "group_life", providerUrl: "https://metlife.test" }),
    );

    expect(resolved?.label).toBe("Group Life");
  });

  it("drops a row with no destination at all", () => {
    expect(resolveActionHubRow(candidate())).toBeNull();
    expect(resolveActionHubRow(candidate({ link: { label: "Only a label" } }))).toBeNull();
  });

  it("drops a row whose category is hidden, even with a sub-link", () => {
    expect(
      resolveActionHubRow(
        candidate({ visible: false, link: { url: "https://voya.test" } }),
      ),
    ).toBeNull();
  });

  it("treats an unknown visibility as visible", () => {
    expect(
      resolveActionHubRow(candidate({ providerUrl: "https://voya.test" })),
    ).not.toBeNull();
  });

  it("keeps an in-portal destination in the same tab", () => {
    const resolved = resolveActionHubRow(
      candidate({ link: { url: "/acme/life-insurance#beneficiaries" } }),
    );

    expect(resolved?.external).toBe(false);
  });
});

describe("resolveActionHubRows", () => {
  const retirement = candidate({
    location: "retirement",
    providerUrl: "https://voya.test/beneficiaries",
  });
  const groupLife = candidate({
    location: "group_life",
    providerUrl: "https://metlife.test/beneficiaries",
  });

  it("lists every benefit that holds the action", () => {
    const rows = resolveActionHubRows([retirement, groupLife]);

    expect(rows.map((entry) => entry.label)).toEqual(["Retirement", "Group Life"]);
    expect(rows.map((entry) => entry.href)).toEqual([
      "https://voya.test/beneficiaries",
      "https://metlife.test/beneficiaries",
    ]);
  });

  it("sorts by canonical hub order, not by the order it was handed", () => {
    const rows = resolveActionHubRows([groupLife, retirement]);

    expect(rows.map((entry) => entry.location)).toEqual([
      "retirement",
      "group_life",
    ]);
  });

  it("removes only the row whose category was switched off", () => {
    const rows = resolveActionHubRows([retirement, { ...groupLife, visible: false }]);

    expect(rows.map((entry) => entry.location)).toEqual(["retirement"]);
  });

  it("keeps one row per location", () => {
    const rows = resolveActionHubRows([
      retirement,
      { ...retirement, providerUrl: "https://other.test" },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].href).toBe("https://voya.test/beneficiaries");
  });

  it("lets a later candidate supply the row when the first had no link", () => {
    const rows = resolveActionHubRows([
      { location: "retirement" },
      { location: "retirement", providerUrl: "https://voya.test" },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe("provider");
  });

  it("returns nothing when no candidate can link anywhere", () => {
    expect(resolveActionHubRows([candidate(), candidate({ location: "group_life" })])).toEqual([]);
  });
});

describe("resolveActionHubPanel", () => {
  it("draws nothing with no rows", () => {
    expect(resolveActionHubPanel([])).toEqual({ mode: "none" });
  });

  it("links straight at the only row instead of opening a one-item panel", () => {
    const only = row();
    expect(resolveActionHubPanel([only])).toEqual({ mode: "direct", row: only });
  });

  it("opens a panel as soon as there is a choice", () => {
    const rows = [row(), row({ location: "group_life", label: "Group Life" })];
    expect(resolveActionHubPanel(rows)).toEqual({ mode: "panel", rows });
  });
});
