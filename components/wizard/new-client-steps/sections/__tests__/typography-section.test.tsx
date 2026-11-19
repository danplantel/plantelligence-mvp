import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TypographySection } from "@/components/wizard/new-client-steps/sections/typography-section";

/**
 * The theme picker's EXAMPLE CARDS have to demonstrate the theme they select.
 *
 * Each card is itself a `<button>`, and the sample inside it is the participant's
 * view of the theme. The shape (sharp / round) is published as `--portal-radius`,
 * which the `rounded-*` utilities read — so it must be scoped to the card, not just
 * the sample: otherwise every card wears the host's radius and the Sharp examples
 * still look rounded.
 */

function exampleCards(markup: string) {
  return (
    markup.match(/<button[^>]*aria-label="[^"]+ typography theme"[^>]*>/g) ?? []
  );
}

describe("TypographySection example cards", () => {
  it("scopes each theme's corner treatment to its own card", () => {
    const html = renderToStaticMarkup(
      <TypographySection value="classic" onChange={() => {}} />,
    );
    const cards = exampleCards(html);

    expect(cards).toHaveLength(4);
    // Library order: Classic (sharp), Modern (round), Editorial (round),
    // Contemporary (sharp).
    expect(cards[0]).toContain("--portal-radius:0px");
    expect(cards[1]).toContain("--portal-radius:0.75rem");
    expect(cards[2]).toContain("--portal-radius:0.75rem");
    expect(cards[3]).toContain("--portal-radius:0px");
  });

  it("states the card's and the sample button's radius inline", () => {
    const html = renderToStaticMarkup(
      <TypographySection value="classic" onChange={() => {}} />,
    );
    const cards = exampleCards(html);

    // `rounded-xl` on the card and `rounded-md` on the "View Details" sample are
    // also written inline, so no stylesheet can re-pin them to a fixed radius.
    for (const card of cards) {
      expect(card).toContain(
        "border-radius:calc(var(--portal-radius, var(--radius)) * 1.5)",
      );
    }
    expect(html).toContain(
      "border-radius:calc(var(--portal-radius, var(--radius)) * 0.75)",
    );
  });

  it("keeps the selected theme's fonts on its own card", () => {
    const html = renderToStaticMarkup(
      <TypographySection value="modern" onChange={() => {}} />,
    );
    const cards = exampleCards(html);

    expect(cards[1]).toContain("--font-headline:var(--font-sora");
    expect(cards[1]).toContain("--font-body:var(--font-outfit");
  });
});
