import { describe, expect, it } from "vitest";

import {
  SUPPORT_CARD_MAX_PER_ROW,
  supportCardColumnClass,
  supportCardRowSlots,
  supportCardSize,
  supportContactShowsCta,
} from "@/lib/support-card-layout";

/**
 * The "Have Questions?" cards size themselves from the number of support
 * contacts: a full four shares the row as quarters, three as thirds, two as
 * halves, and a lone card keeps a HALF — never the whole row.
 *
 * The same count picks the element tier, so fewer cards means bigger cards and
 * bigger headshot/type rather than a wider empty box.
 */

describe("supportCardRowSlots", () => {
  it("splits a full row into four", () => {
    expect(supportCardRowSlots(4)).toBe(4);
  });

  it("splits three and two contacts into thirds and halves", () => {
    expect(supportCardRowSlots(3)).toBe(3);
    expect(supportCardRowSlots(2)).toBe(2);
  });

  it("lays a lone card out as a half, so it never spans the row", () => {
    expect(supportCardRowSlots(1)).toBe(2);
  });

  it("caps at four slots so extra contacts wrap instead of shrinking", () => {
    expect(supportCardRowSlots(SUPPORT_CARD_MAX_PER_ROW + 3)).toBe(
      SUPPORT_CARD_MAX_PER_ROW,
    );
  });

  it("treats nonsense counts as the empty row", () => {
    expect(supportCardRowSlots(0)).toBe(2);
    expect(supportCardRowSlots(-2)).toBe(2);
    expect(supportCardRowSlots(Number.NaN)).toBe(2);
    expect(supportCardRowSlots(2.7)).toBe(2);
  });
});

describe("supportCardSize", () => {
  it("uses the compact tier for a full row of four", () => {
    expect(supportCardSize(4)).toBe("sm");
    expect(supportCardSize(6)).toBe("sm");
  });

  it("steps up for three", () => {
    expect(supportCardSize(3)).toBe("md");
  });

  it("uses the largest tier for two and for a lone card", () => {
    expect(supportCardSize(2)).toBe("lg");
    expect(supportCardSize(1)).toBe("lg");
  });
});

describe("supportContactShowsCta", () => {
  it("needs both the advisor's flag and a button type", () => {
    expect(supportContactShowsCta({})).toBe(false);
    expect(
      supportContactShowsCta({ enableContactButton: true }),
    ).toBe(false);
    expect(
      supportContactShowsCta({
        enableContactButton: true,
        contactButtonType: "calendar",
        schedulingUrl: "https://book.test/a",
      }),
    ).toBe(true);
  });

  it("counts a calendar CTA that books to the plan's link", () => {
    expect(
      supportContactShowsCta(
        { enableContactButton: true, contactButtonType: "calendar" },
        "https://plan.test/schedule",
      ),
    ).toBe(true);
  });

  it("ignores a button with no target", () => {
    expect(
      supportContactShowsCta({
        enableContactButton: true,
        contactButtonType: "phone",
        phone: "",
      }),
    ).toBe(false);
    expect(
      supportContactShowsCta({
        enableContactButton: true,
        contactButtonType: "email",
      }),
    ).toBe(false);
    expect(
      supportContactShowsCta({
        enableContactButton: true,
        contactButtonType: "url",
      }),
    ).toBe(false);
  });

  it("ignores unknown button types", () => {
    expect(
      supportContactShowsCta({
        enableContactButton: true,
        contactButtonType: "carrier-pigeon",
        phone: "5551234567",
      }),
    ).toBe(false);
  });
});

describe("supportCardColumnClass", () => {
  it("stacks on phones and pairs on tablets whatever the count", () => {
    [1, 2, 3, 4].forEach((count) => {
      const className = supportCardColumnClass(count);
      expect(className).toContain("w-full");
      expect(className).toContain("min-w-0");
      expect(className).toContain("sm:w-[calc((100%-1.5rem)/2)]");
    });
  });

  it("gives a lone card a half from `lg`, not the whole row", () => {
    expect(supportCardColumnClass(1)).toContain(
      "lg:w-[calc((100%-1.5rem)/2)]",
    );
  });

  it("gives two cards a half each", () => {
    expect(supportCardColumnClass(2)).toContain(
      "lg:w-[calc((100%-1.5rem)/2)]",
    );
  });

  it("gives three cards a third each (two 1.5rem gaps)", () => {
    expect(supportCardColumnClass(3)).toContain("lg:w-[calc((100%-3rem)/3)]");
  });

  it("gives four cards a quarter each (three 1.5rem gaps)", () => {
    expect(supportCardColumnClass(4)).toContain(
      "lg:w-[calc((100%-4.5rem)/4)]",
    );
  });

  it("keeps the four-up width for surplus contacts", () => {
    expect(supportCardColumnClass(5)).toBe(supportCardColumnClass(4));
  });
});
