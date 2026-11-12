import React from "react";

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ASSISTANT_ASK_EVENT,
  ASSISTANT_INPUT_FOCUS_EVENT,
} from "@/lib/topics/assistant";

import { CHAT_SESSION_MS, PortalChatbot } from "../portal-chatbot";

/**
 * The portal's floating "Ask a question" assistant.
 *
 * The shell tests pin open/close, the greeting, sending and Escape. The assistant
 * tests pin what the sheet does now that `lib/topics/assistant` is wired in: it reads
 * the plan index once, answers from a placed topic with its steps/CTA/deep link,
 * shows the plan's published hubs, offers suggestions instead of inventing an answer,
 * and closes when a reply link is followed.
 *
 * SWR is mocked (the index is a network read) and `next/link` is rendered as a plain
 * anchor, so the assertions stay about the transcript.
 */

const BASE_CLIENT = {
  id: "plan-1",
  companyName: "Acme Co",
  brandColor: "#123456",
  secondaryColor: "#abcdef",
  insuranceLoginUrl: "https://recordkeeper.example/sign-in",
  appointmentLink: "https://cal.example/jordan",
  keyContacts: [{ email: "jordan@example.com", phone: "555-0100" }],
  benefitHubs: [
    { category: "Retirement", isEnabled: true, title: "Retirement" },
    { category: "Group Health", isEnabled: true, title: "Group Health" },
  ],
  categoryPortalVisibility: {
    Retirement: true,
    "Group Health": true,
    "Group Life": false,
    Other: false,
  },
  employeeResourcesEnabled: false,
};

const mocks = vi.hoisted(() => ({
  clientData: undefined as Record<string, unknown> | undefined,
  profile: undefined as Record<string, unknown> | undefined,
}));

vi.mock("@/contexts/client-portal-context", () => ({
  useOptionalClientPortal: () => ({
    clientData: mocks.clientData,
    profile: mocks.profile,
  }),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "acme" }),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const swr = vi.hoisted(() => ({
  calls: [] as unknown[][],
  data: undefined as unknown,
  error: undefined as unknown,
  isLoading: false,
}));

vi.mock("swr", () => ({
  __esModule: true,
  default: (...args: unknown[]) => {
    swr.calls.push(args);
    return {
      data: swr.data,
      error: swr.error,
      isLoading: swr.isLoading,
      mutate: vi.fn(),
    };
  },
}));

const PLACED_LOAN = {
  slug: "sys.401k-loans",
  location: "retirement",
  title: "Can I take a loan?",
  summary: null,
  bodyBlocks: [
    {
      type: "quick_answer",
      text: "You can borrow up to 50% of your vested balance.",
    },
    {
      type: "steps",
      steps: [
        "Log in to your recordkeeper account.",
        "Review your available loan amount.",
        "Select a loan type.",
        "Submit your request.",
      ],
    },
  ],
  tags: ["loan", "borrow"],
  group: "Loans & Withdrawals",
  displayMode: "quick_answers",
  isActionHub: false,
  cta: { label: "Request a Loan", actionType: "external_url" },
};

async function openSheet() {
  const user = userEvent.setup();
  render(<PortalChatbot />);
  await user.click(screen.getByRole("button", { name: "Ask a question" }));
  return user;
}

async function ask(
  user: ReturnType<typeof userEvent.setup>,
  question: string,
) {
  const input = screen.getByRole("textbox", { name: "Type your question" });
  await user.type(input, question);
  await user.click(screen.getByRole("button", { name: "Send your question" }));
}

const GREETING_MESSAGE = {
  id: 0,
  role: "assistant",
  text: "Hi! I'm your benefits assistant. Ask me anything about your plan — coverage, enrollment, claims, or your retirement account.",
};

/** Seed a conversation for this plan, with the clock already running. */
function seedSession(startedAt: number, messages: unknown[]) {
  window.sessionStorage.setItem(
    "portal-chatbot-session:v1:acme",
    JSON.stringify({ startedAt, messages }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  document.body.removeAttribute("style");
  swr.calls.length = 0;
  swr.data = { success: true, topics: [], hiddenSlugs: [] };
  swr.error = undefined;
  swr.isLoading = false;
  mocks.clientData = { ...BASE_CLIENT };
  mocks.profile = { name: "Jordan Lee" };
});

describe("PortalChatbot", () => {
  it("starts as a closed floating action button", () => {
    render(<PortalChatbot />);

    const fab = screen.getByRole("button", { name: "Ask a question" });
    expect(fab).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("reads 'Ask a question' beside the icon, as one pill", () => {
    render(<PortalChatbot />);

    const fab = screen.getByRole("button", { name: "Ask a question" });
    const label = screen.getByTestId("portal-chatbot-fab-label");
    expect(label).toHaveTextContent("Ask a question");
    // Inside the button, so the whole pill is a single click target — and wide,
    // since it now carries a label rather than being a bare circle.
    expect(fab).toContainElement(label);
    expect(fab.className).toContain("px-5");
    expect(fab.className).not.toContain("w-14");
    // Dismissing the install prompt clears the inset and drops the pill down.
    expect(fab.className).toContain("--portal-install-inset");
  });

  it("collapses to the close icon while the sheet is open", async () => {
    const user = await openSheet();

    // The label would describe the opposite of what the button now does.
    expect(
      screen.queryByTestId("portal-chatbot-fab-label"),
    ).not.toBeInTheDocument();
    const close = screen.getByRole("button", { name: "Close chat" });
    expect(close.className).toContain("w-14");
    expect(close.className).not.toContain("px-5");
    // The phone sheet covers the screen, so the pill gives way to the header's X.
    expect(close.className).toContain("hidden");
    expect(close.className).toContain("md:flex");

    await user.keyboard("{Escape}");
  });

  it("opens with the greeting and the plan's published hubs", async () => {
    await openSheet();

    const dialog = screen.getByRole("dialog", { name: "Benefits assistant" });
    expect(dialog).toBeInTheDocument();
    // Fullscreen on a phone; the floating card returns from `md` up.
    expect(dialog.className).toContain("inset-0");
    expect(dialog.className).toContain("h-full");
    expect(dialog.className).toContain("md:rounded-2xl");
    expect(
      screen.getByText(/I'm your benefits assistant/i),
    ).toBeInTheDocument();
    // The hubs are conversation starters (buttons), not navigational links.
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(
      screen.getByRole("button", { name: "Retirement" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Group Health" }),
    ).toBeInTheDocument();
    // Group Life is hidden in this plan's portal visibility.
    expect(
      screen.queryByRole("button", { name: "Group Life" }),
    ).not.toBeInTheDocument();

    // The FAB becomes the "close" affordance and reports the open state.
    expect(screen.getByRole("button", { name: "Close chat" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("starts a conversation about a hub instead of leaving the chat", async () => {
    const user = await openSheet();

    await user.click(screen.getByRole("button", { name: "Retirement" }));

    await waitFor(() =>
      expect(
        screen.getByText(/Here's what I can help with in Retirement/i),
      ).toBeInTheDocument(),
    );
    // The hub's own topics are offered in the sheet, and nothing navigated away.
    expect(
      screen.getByRole("button", { name: "Update My Beneficiary" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: "Benefits assistant" }),
    ).toBeInTheDocument();
  });

  it("answers a topic chosen from a hub", async () => {
    const user = await openSheet();

    await user.click(screen.getByRole("button", { name: "Retirement" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Update My Beneficiary" }),
      ).toBeInTheDocument(),
    );

    await user.click(
      screen.getByRole("button", { name: "Update My Beneficiary" }),
    );

    await waitFor(() =>
      expect(
        screen.getByText(/beneficiary designation/i),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("dialog", { name: "Benefits assistant" }),
    ).toBeInTheDocument();
  });

  it("appends what the visitor types", async () => {
    const user = await openSheet();

    const input = screen.getByRole("textbox", { name: "Type your question" });
    await user.type(input, "How do I enroll?");
    await user.click(screen.getByRole("button", { name: "Send your question" }));

    expect(screen.getByText("How do I enroll?")).toBeInTheDocument();
    // The composer clears so the next question can be typed.
    expect(input).toHaveValue("");

    await waitFor(() =>
      expect(screen.queryByTestId("portal-chatbot-typing")).not.toBeInTheDocument(),
    );
  });

  it("ignores an empty draft", async () => {
    await openSheet();

    expect(
      screen.getByRole("button", { name: "Send your question" }),
    ).toBeDisabled();
  });

  it("closes on Escape", async () => {
    const user = await openSheet();
    await user.keyboard("{Escape}");

    // AnimatePresence keeps the sheet mounted for its exit animation.
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("locks page scrolling while the fullscreen sheet is open", async () => {
    const user = await openSheet();

    // The phone sheet owns the screen: the page behind it cannot scroll and its
    // scrollbar is gone.
    expect(document.body.style.position).toBe("fixed");
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body.style.width).toBe("100%");

    await user.keyboard("{Escape}");

    await waitFor(() => expect(document.body.style.position).toBe(""));
    expect(document.body.style.overflow).toBe("");
    expect(document.body.style.width).toBe("");
  });

  it("closes from its header button", async () => {
    const user = await openSheet();
    await user.click(
      screen.getByRole("button", { name: "Close the benefits assistant" }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: "Ask a question" }),
    ).toBeInTheDocument();
  });

  it("wears the plan's brand colour", () => {
    render(<PortalChatbot />);

    expect(
      screen.getByRole("button", { name: "Ask a question" }),
    ).toHaveStyle({ backgroundColor: "#123456" });
  });

  it("falls back to the portal defaults outside a plan context", () => {
    mocks.clientData = undefined;
    render(<PortalChatbot />);

    expect(
      screen.getByRole("button", { name: "Ask a question" }),
    ).toHaveStyle({ backgroundColor: "#1F3A60" });

    mocks.clientData = { ...BASE_CLIENT };
  });
});

describe("PortalChatbot assistant", () => {
  it("reads the plan index for this client once the sheet opens", async () => {
    await openSheet();

    await waitFor(() => expect(swr.calls.length).toBeGreaterThan(0));
    expect(swr.calls.at(-1)?.[0]).toBe(
      "/api/clients/acme/portal/assistant?forPortal=1",
    );
  });

  it("answers from the plan's own topic with steps, CTA and a deep link", async () => {
    swr.data = { success: true, topics: [PLACED_LOAN], hiddenSlugs: [] };
    const user = await openSheet();

    await ask(user, "How do I take a loan?");

    await waitFor(() =>
      expect(screen.getByText(/borrow up to 50%/)).toBeInTheDocument(),
    );
    // Only the first three steps, so a long answer does not take over the sheet.
    expect(
      screen.getByText("Log in to your recordkeeper account."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Submit your request.")).not.toBeInTheDocument();
    const deepLink = screen.getByRole("link", {
      name: /open on your plan page/i,
    });
    expect(deepLink).toHaveAttribute("href", "/acme/retirement#401k-loans");
    // Inner controls are white with the plan's colour on the border.
    expect(deepLink).toHaveStyle({
      backgroundColor: "#ffffff",
      borderColor: "#123456",
    });
    // A navigational button says where it goes.
    expect(
      screen.getByText("Goes to your Retirement page and opens this answer"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /request a loan/i }),
    ).toHaveAttribute("href", "https://recordkeeper.example/sign-in");
    expect(
      screen.getByText("Opens recordkeeper.example in a new tab"),
    ).toBeInTheDocument();
  });

  it("shows a typing indicator until the answer is ready", async () => {
    const user = await openSheet();

    await ask(user, "How do I take a loan?");

    expect(
      screen.getByTestId("portal-chatbot-typing"),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByTestId("portal-chatbot-typing"),
      ).not.toBeInTheDocument(),
    );
  });

  it("offers suggestions rather than inventing an answer", async () => {
    const user = await openSheet();

    await ask(user, "zzzxcvbnm");

    await waitFor(() =>
      expect(
        screen.getByText(/could not find that in your plan's answers/i),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: "Can I take a loan?" }),
    ).toBeInTheDocument();
  });

  it("answers a suggestion chip's question", async () => {
    const user = await openSheet();

    await ask(user, "zzzxcvbnm");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Can I take a loan?" }),
      ).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Can I take a loan?" }));

    await waitFor(() =>
      expect(screen.getByText(/If your plan allows loans/i)).toBeInTheDocument(),
    );
    // A chip asks a question; it must never dismiss the conversation.
    expect(
      screen.getByRole("dialog", { name: "Benefits assistant" }),
    ).toBeInTheDocument();
  });

  it("hands a request for a person to the advisor", async () => {
    const user = await openSheet();

    await ask(user, "I need to talk to a person");

    await waitFor(() =>
      expect(
        screen.getByRole("link", {
          name: /book a time with your benefits team/i,
        }),
      ).toHaveAttribute("href", "https://cal.example/jordan"),
    );
    expect(
      screen.getByText("Opens cal.example in a new tab"),
    ).toBeInTheDocument();
  });

  it("keeps the sheet open when a reply link is followed", async () => {
    const user = await openSheet();

    await ask(user, "Where can I see the news?");

    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: /news & events/i }),
      ).toHaveAttribute("href", "/acme/news-events"),
    );
    expect(
      screen.getByText("Goes to the News & Events page"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: /news & events/i }));

    // The link opens its destination; the conversation stays on screen.
    expect(
      screen.getByRole("dialog", { name: "Benefits assistant" }),
    ).toBeInTheDocument();
  });

  it("notes when an answer is not on the plan's page yet", async () => {
    const user = await openSheet();

    await ask(user, "How do I take a loan?");

    await waitFor(() =>
      expect(
        screen.getByText(/not on your plan's page yet/i),
      ).toBeInTheDocument(),
    );
    // With no placement there is no anchor to offer, only the hub.
    expect(
      screen.queryByRole("link", { name: /open on your plan page/i }),
    ).not.toBeInTheDocument();
  });

  it("pins the visitor's question instead of the end of the answer", async () => {
    swr.data = { success: true, topics: [PLACED_LOAN], hiddenSlugs: [] };
    const user = await openSheet();

    await ask(user, "How do I take a loan?");

    const transcript = screen.getByTestId("portal-chatbot-transcript");
    const question = transcript.querySelector<HTMLElement>(
      '[data-message-role="user"]',
    );
    expect(question).not.toBeNull();
    // The transcript is `relative`, so the question's offsetTop is its place in the
    // scrolled content: 300px down, pinned 12px below the transcript's top.
    Object.defineProperty(question as HTMLElement, "offsetTop", {
      configurable: true,
      value: 300,
    });
    const scrollTo = vi.fn();
    transcript.scrollTo = scrollTo as unknown as typeof transcript.scrollTo;

    await waitFor(() =>
      expect(screen.getByText(/borrow up to 50%/)).toBeInTheDocument(),
    );

    await waitFor(() =>
      expect(scrollTo).toHaveBeenCalledWith({ top: 288, behavior: "smooth" }),
    );
  });
});

describe("PortalChatbot handoff", () => {
  it("answers a question handed over by the landing page's Ask bar", async () => {
    render(<PortalChatbot />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent(ASSISTANT_ASK_EVENT, {
          detail: { question: "What does COBRA stand for?" },
        }),
      );
    });

    // The sheet opens by itself and asks there, with the plan's own index.
    expect(
      await screen.findByRole("dialog", { name: "Benefits assistant" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByText(/Consolidated Omnibus Budget Reconciliation Act/),
      ).toBeInTheDocument(),
    );
  });

  it("pins the handed-over question when the Ask bar opens the sheet", async () => {
    render(<PortalChatbot />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent(ASSISTANT_ASK_EVENT, {
          detail: { question: "What does COBRA stand for?" },
        }),
      );
    });

    const transcript = screen.getByTestId("portal-chatbot-transcript");
    const question = transcript.querySelector<HTMLElement>(
      '[data-message-role="user"]',
    );
    expect(question).not.toBeNull();
    Object.defineProperty(question as HTMLElement, "offsetTop", {
      configurable: true,
      value: 240,
    });
    const scrollTo = vi.fn();
    transcript.scrollTo = scrollTo as unknown as typeof transcript.scrollTo;

    await waitFor(() =>
      expect(
        screen.getByText(/Consolidated Omnibus Budget Reconciliation Act/),
      ).toBeInTheDocument(),
    );

    // 240px down the transcript, pinned 12px below its top — the sheet opens on
    // the visitor's question, so the answer is read from its first line.
    await waitFor(() =>
      expect(scrollTo).toHaveBeenCalledWith({ top: 228, behavior: "smooth" }),
    );
  });

  it("hides the floating button on a phone while the landing Ask field is focused", () => {
    render(<PortalChatbot />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent(ASSISTANT_INPUT_FOCUS_EVENT, {
          detail: { focused: true },
        }),
      );
    });

    const hidden = screen.getByRole("button", { name: "Ask a question" });
    // Hidden on a phone, still the labelled pill from `md` up.
    expect(hidden.className).toContain("hidden");
    expect(hidden.className).toContain("md:flex");

    act(() => {
      window.dispatchEvent(
        new CustomEvent(ASSISTANT_INPUT_FOCUS_EVENT, {
          detail: { focused: false },
        }),
      );
    });

    expect(
      screen.getByRole("button", { name: "Ask a question" }).className,
    ).toContain("flex px-5");
  });
});

describe("PortalChatbot session", () => {
  it("restores a conversation less than an hour old", async () => {
    seedSession(Date.now() - 5 * 60 * 1000, [
      GREETING_MESSAGE,
      { id: 1, role: "user", text: "How do I enroll?" },
      { id: 2, role: "assistant", text: "An enrollment answer from earlier." },
    ]);

    await openSheet();

    expect(screen.getByText("How do I enroll?")).toBeInTheDocument();
    expect(
      screen.getByText("An enrollment answer from earlier."),
    ).toBeInTheDocument();
  });

  it("starts fresh when the stored session is over an hour old", async () => {
    seedSession(Date.now() - CHAT_SESSION_MS - 1000, [
      GREETING_MESSAGE,
      { id: 1, role: "user", text: "Old question" },
    ]);

    await openSheet();

    expect(screen.queryByText("Old question")).not.toBeInTheDocument();
    expect(
      screen.getByText(/I'm your benefits assistant/i),
    ).toBeInTheDocument();
  });

  it("resets the conversation when the hour is up", async () => {
    seedSession(Date.now() - CHAT_SESSION_MS + 80, [
      GREETING_MESSAGE,
      { id: 1, role: "user", text: "Old question" },
    ]);

    await openSheet();
    expect(screen.getByText("Old question")).toBeInTheDocument();

    await waitFor(
      () => expect(screen.queryByText("Old question")).not.toBeInTheDocument(),
      { timeout: 2000 },
    );
    expect(
      screen.getByText(/I'm your benefits assistant/i),
    ).toBeInTheDocument();
  });
});
