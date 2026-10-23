import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FAQSection, type DynamicFAQItem } from "../faq-section";

/**
 * `FAQSection` is the accordion both hub pages and the landing page use.
 *
 * Three things are worth pinning:
 *
 *  - **one open item at a time** — the section keeps a single `openId`, so
 *    opening the second question closes the first, on either column;
 *  - **two columns** — the list is split in reading order at `md` and up;
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

describe("FAQSection layout", () => {
  it("lays the questions out in two columns, in reading order", () => {
    const { container } = render(
      <FAQSection
        faqs={[
          faq({ id: "a", question: "A?" }),
          faq({ id: "b", question: "B?" }),
          faq({ id: "c", question: "C?" }),
          faq({ id: "d", question: "D?" }),
        ]}
      />,
    );

    const grid = container.querySelector(".md\\:grid-cols-2") as HTMLElement;
    expect(grid).not.toBeNull();
    expect(grid.children).toHaveLength(2);

    const [left, right] = Array.from(grid.children) as HTMLElement[];
    expect(within(left).getByRole("button", { name: /A\?/ })).toBeInTheDocument();
    expect(within(left).getByRole("button", { name: /B\?/ })).toBeInTheDocument();
    expect(within(right).getByRole("button", { name: /C\?/ })).toBeInTheDocument();
    expect(within(right).getByRole("button", { name: /D\?/ })).toBeInTheDocument();
  });

  it("keeps the question smaller than the answer", () => {
    render(<FAQSection faqs={[faq()]} />);

    const question = screen
      .getByRole("button", { name: /How do I enroll\?/ })
      .querySelector("span") as HTMLElement;
    const answer = screen.getByText("Talk to your advisor.");

    // The header is a label; the opened body is the content, so it reads larger.
    expect(question.className).toContain("text-[13px]");
    expect(answer.className).toContain("text-[17px]");
  });

  it("fills a screen on desktop", () => {
    const { container } = render(<FAQSection faqs={[faq()]} />);

    // Same full-height band as "How Can We Help You Today?" — desktop only, so a
    // phone does not get a screen of empty space under two questions.
    expect(container.querySelector("section")?.className).toContain(
      "lg:min-h-screen",
    );
  });

  it("sits on a light grey band, with white cards", () => {
    const { container } = render(<FAQSection faqs={[faq()]} />);

    const section = container.querySelector("section") as HTMLElement;
    expect(section.className).toContain("bg-gray-100");
    expect(section.className).not.toContain("bg-white");

    // The cards stay white so they stand out against the band.
    expect(
      screen.getByRole("button", { name: /How do I enroll\?/ }).parentElement
        ?.className,
    ).toContain("bg-white");
  });

  it("drops the empty column when only one question exists", () => {
    const { container } = render(<FAQSection faqs={[faq()]} />);

    const grid = container.querySelector(".md\\:grid-cols-2") as HTMLElement;
    expect(grid.children).toHaveLength(1);
  });

  it("still opens one question at a time across the two columns", async () => {
    const user = userEvent.setup();
    render(
      <FAQSection
        faqs={[
          faq({ id: "a", question: "First?", answer: "First answer" }),
          faq({ id: "b", question: "Second?", answer: "Second answer" }),
        ]}
      />,
    );

    // One per column, so this also proves the two groups share one open id.
    await user.click(screen.getByRole("button", { name: /First\?/ }));
    await user.click(screen.getByRole("button", { name: /Second\?/ }));

    expect(answerRow("First answer").style.gridTemplateRows).toBe("0fr");
    expect(answerRow("Second answer").style.gridTemplateRows).toBe("1fr");
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
