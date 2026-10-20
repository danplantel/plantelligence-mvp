import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BenefitsHubWebinarsSection } from "../benefits-hub-webinars-section";

/**
 * The "Webinars" band on a benefit hub.
 *
 * Its two design decisions are what the tests pin:
 *
 *  - the plan is taken from the **route segment**, not the portal context, so the
 *    fetch starts on the first render instead of waiting behind the context's own
 *    profile request (a waterfall this section used to sit at the end of);
 *  - `includeVideoFiles=0` is sent because without it the response carried every
 *    video's base64 payload, and a visitor waited for the whole account's videos
 *    before the first card appeared. The card fetches its file only on play.
 *
 * A plan with no videos renders **nothing** — an empty band mid-page is worse
 * than no band — and while loading it reserves three card-shaped skeletons on
 * desktop (the third is hidden below `lg`).
 */

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  params: { id: "plan-1" } as Record<string, unknown>,
}));

vi.mock("next/navigation", () => ({
  useParams: () => mocks.params,
}));

vi.mock("../webinars-section", () => ({
  WebinarReplayCard: ({
    replay,
  }: {
    replay: { id: string; title: string };
  }) => <div data-testid={`replay-${replay.id}`}>{replay.title}</div>,
  guessLanguageFromWebinar: (webinar: { language?: string }) =>
    webinar.language === "ES" ? "ES" : "EN",
}));

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body };
}

function renderSection(
  props: Partial<React.ComponentProps<typeof BenefitsHubWebinarsSection>> = {},
) {
  return render(
    <BenefitsHubWebinarsSection placement="retirement" {...props} />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.params = { id: "plan-1" };
  mocks.fetch.mockResolvedValue(jsonResponse({ success: true, data: [] }));
  vi.stubGlobal("fetch", mocks.fetch);
});

describe("BenefitsHubWebinarsSection request", () => {
  it("asks for this plan's videos on this page, without the files", async () => {
    renderSection();

    await waitFor(() => expect(mocks.fetch).toHaveBeenCalled());
    expect(mocks.fetch).toHaveBeenCalledWith(
      "/api/webinars?clientId=plan-1&placement=retirement&includeVideoFiles=0",
      { cache: "no-store" },
    );
  });

  it("uses the placement it was given", async () => {
    renderSection({ placement: "wellness-programs" });

    await waitFor(() => expect(mocks.fetch).toHaveBeenCalled());
    expect(String(mocks.fetch.mock.calls[0][0])).toContain(
      "placement=wellness-programs",
    );
  });

  it("does not fetch without a plan segment", async () => {
    mocks.params = {};
    renderSection();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("refetches when the placement changes", async () => {
    const { rerender } = renderSection();
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));

    rerender(<BenefitsHubWebinarsSection placement="life-insurance" />);

    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2));
  });
});

describe("BenefitsHubWebinarsSection render", () => {
  it("reserves three card skeletons while loading", () => {
    mocks.fetch.mockReturnValue(new Promise(() => {}));
    const { container } = renderSection();

    const grid = container.querySelector('[aria-busy="true"]');
    expect(grid).not.toBeNull();
    expect(grid?.querySelectorAll(".rounded-xl")).toHaveLength(3);
    expect(screen.getByText("Loading videos…")).toBeInTheDocument();
  });

  it("renders one card per published video", async () => {
    mocks.fetch.mockResolvedValue(
      jsonResponse({
        success: true,
        data: [
          { id: "w1", webinarTitle: "Retirement Basics", clientId: "plan-1" },
          { id: "w2", webinarTitle: "Investing 101", clientId: "plan-1" },
        ],
      }),
    );
    renderSection();

    expect(await screen.findByTestId("replay-w1")).toHaveTextContent(
      "Retirement Basics",
    );
    expect(screen.getByTestId("replay-w2")).toHaveTextContent("Investing 101");
    expect(screen.queryByText("Loading videos…")).not.toBeInTheDocument();
  });

  it("renders nothing when the plan has no videos", async () => {
    const { container } = renderSection();

    await waitFor(() => expect(mocks.fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the request fails", async () => {
    mocks.fetch.mockResolvedValue(jsonResponse({}, false));
    const { container } = renderSection();

    await waitFor(() => expect(mocks.fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("treats a non-success payload as no videos", async () => {
    mocks.fetch.mockResolvedValue(
      jsonResponse({ success: false, data: [{ id: "w1" }] }),
    );
    const { container } = renderSection();

    await waitFor(() => expect(mocks.fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the default heading, or the one it was given", async () => {
    mocks.fetch.mockResolvedValue(
      jsonResponse({
        success: true,
        data: [{ id: "w1", webinarTitle: "One" }],
      }),
    );
    const { unmount } = renderSection();

    expect(
      await screen.findByRole("heading", { name: "Webinars" }),
    ).toBeInTheDocument();
    unmount();

    renderSection({ title: "Watch and learn" });
    expect(
      await screen.findByRole("heading", { name: "Watch and learn" }),
    ).toBeInTheDocument();
  });
});
