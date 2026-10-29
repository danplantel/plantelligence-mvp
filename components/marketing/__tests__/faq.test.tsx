import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarketingFaq } from "@/components/marketing/faq";
import { MARKETING_FAQS } from "@/config/marketing";

describe("MarketingFaq", () => {
  it("reveals the answer when a question is opened", async () => {
    render(<MarketingFaq appOrigin="https://plantel.pro" />);

    const question = MARKETING_FAQS[0].question;
    const answer = MARKETING_FAQS[0].answer;

    fireEvent.click(screen.getByRole("button", { name: question }));

    expect(await screen.findByText(answer)).toBeVisible();
  });

  it("links to sign in on the app origin", () => {
    render(<MarketingFaq appOrigin="https://plantel.pro" />);

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "https://plantel.pro/signin",
    );
  });
});
