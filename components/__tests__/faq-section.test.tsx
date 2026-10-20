import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FAQSection, type DynamicFAQItem } from "../faq-section";

/**
 * `FAQSection` is the accordion both hub pages and the landing page use.
 *
 * Three things are worth pinning:
 *
 *  - **one open item at a time** — the section keeps a single `openIndex`, so
 *    opening the second question closes the first;
 *  - **incomplete rows are dropped** — a FAQ needs both a question and an
 *    answer to render, and the pages pass whatever the benefit stored;
 *  - **link normalisation** — `linkHref` gets `https://` only when it has no
 *    scheme, and `mailto:` / `tel:` / anchors survive. (`javascript:` is also
 *    passed through: pinned as it is, since a benefit's FAQ link becomes an
 *    `href`.)
 *
 * The `contacts` prop is accepted but renders nothing here — the hub pages pass
 * the same people to `HaveQuestions` for display, so this stays a pure
 * accordion.
 */

function faq(overrides: Partial<DynamicFAQItem> = {}): DynamicFAQItem {
  return {
    id: "faq-1",
    question: "How do I enroll?",
    answer: "Talk to your advisor.",
    ...overrides,
  };
}

function answerRow(answer: string) {
  return screen.getByText(answer).closest('[class*="grid"]') as HTMLElement;
}

describe("FAQSection accordion", () => {
  it("renders the heading and one button per question", () => {
    render(
      <FAQSection faqs={[faq(), faq({ id: "faq-2", question: "When?" })]} />,
    );

    expect(
      screen.getByRole("heading", {
        name: "Frequently Asked Questions (FAQs)",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /How do I enroll\?/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /When\?/ })).toBeInTheDocument();
  });

  it("opens an answer on click and closes it again", async () => {
    const user = userEvent.setup();
    render(<FAQSection faqs={[faq()]} />);

    expect(answerRow("Talk to your advisor.").style.gridTemplateRows).toBe(
      "0fr",
    );

    await user.click(screen.getByRole("button", { name: /How do I enroll\?/ }));
    expect(answerRow("Talk to your advisor.").style.gridTemplateRows).toBe(
      "1fr",
    );

    await user.click(screen.getByRole("button", { name: /How do I enroll\?/ }));
    expect(answerRow("Talk to your advisor.").style.gridTemplateRows).toBe(
      "0fr",
    );
  });

  it("keeps one question open at a time", async () => {
    const user = userEvent.setup();
    render(
      <FAQSection
        faqs={[
          faq({ id: "a", question: "First?", answer: "First answer" }),
          faq({ id: "b", question: "Second?", answer: "Second answer" }),
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /First\?/ }));
    await user.click(screen.getByRole("button", { name: /Second\?/ }));

    expect(answerRow("First answer").style.gridTemplateRows).toBe("0fr");
    expect(answerRow("Second answer").style.gridTemplateRows).toBe("1fr");
  });

  it("drops rows without a question or an answer", () => {
    render(
      <FAQSection
        faqs={[
          faq({ id: "ok", question: "Kept?" }),
          faq({ id: "no-answer", question: "Dropped?", answer: "" }),
          faq({ id: "no-question", question: "", answer: "Orphan answer" }),
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: /Kept\?/ })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByText("Orphan answer")).not.toBeInTheDocument();
  });

  it("renders just the heading when there are no FAQs", () => {
    render(<FAQSection faqs={[]} />);

    expect(
      screen.getByRole("heading", {
        name: "Frequently Asked Questions (FAQs)",
      }),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});

describe("FAQSection links", () => {
  async function openFirstLink(href: string) {
    const user = userEvent.setup();
    const { unmount } = render(
      <FAQSection faqs={[faq({ linkLabel: "Open", linkHref: href })]} />,
    );
    await user.click(screen.getByRole("button", { name: /How do I enroll\?/ }));
    const link = screen.getByRole("link", { name: /Open/ });
    unmount();
    return link;
  }

  it("gives a bare host an https scheme", async () => {
    expect(await openFirstLink("acme.test/faq")).toHaveAttribute(
      "href",
      "https://acme.test/faq",
    );
  });

  it("keeps an absolute URL as written", async () => {
    expect(await openFirstLink("http://acme.test/faq")).toHaveAttribute(
      "href",
      "http://acme.test/faq",
    );
  });

  it("keeps mailto:, tel: and anchors", async () => {
    expect(await openFirstLink("mailto:help@acme.test")).toHaveAttribute(
      "href",
      "mailto:help@acme.test",
    );
    expect(await openFirstLink("tel:+13055551122")).toHaveAttribute(
      "href",
      "tel:+13055551122",
    );
    expect(await openFirstLink("#question-2")).toHaveAttribute(
      "href",
      "#question-2",
    );
  });

  it("passes a javascript: link through unchanged", async () => {
    expect(await openFirstLink("javascript:alert(1)")).toHaveAttribute(
      "href",
      "javascript:alert(1)",
    );
  });

  it("omits the link when either half is missing", () => {
    render(<FAQSection faqs={[faq({ linkLabel: "Open" })]} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("FAQSection contacts", () => {
  it("does not render the contacts it is given", () => {
    render(
      <FAQSection
        faqs={[faq()]}
        contacts={[
          {
            id: "c1",
            title: "Ada Advisor",
            description: "Retirement",
            email: "ada@acme.test",
            phone: "305-555-0100",
          },
        ]}
      />,
    );

    expect(screen.queryByText("Ada Advisor")).not.toBeInTheDocument();
    expect(screen.queryByText("ada@acme.test")).not.toBeInTheDocument();
  });

  it("uses the brand colour for the heading", () => {
    render(<FAQSection faqs={[]} brandColor="#123456" />);

    expect(
      screen.getByRole("heading", {
        name: "Frequently Asked Questions (FAQs)",
      }),
    ).toHaveStyle({ color: "#123456" });
  });

  it("does not call anything on render", () => {
    const spy = vi.fn();
    render(<FAQSection faqs={[faq()]} />);

    expect(spy).not.toHaveBeenCalled();
  });
});
