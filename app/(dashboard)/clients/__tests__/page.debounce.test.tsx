import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ClientsListDashboardPage } from "@/components/pages/clients-list-dashboard";

/**
 * The search debounce integration.
 *
 * `page.test.tsx` mocks `useDebounceValue` so every other test sees a settled
 * value synchronously. This file deliberately does NOT mock it: it proves the
 * 300 ms window is actually wired up — while typing, SWR keeps querying the old
 * term, and only the final value is requested once typing pauses.
 */

const mocks = vi.hoisted(() => ({
  swrKeys: [] as string[],
  swrData: {
    success: true,
    data: [],
    pagination: { page: 1, limit: 25, total: 0, pages: 0 },
  },
  mutate: vi.fn(),
}));

vi.mock("swr", () => ({
  default: (key: string) => {
    mocks.swrKeys.push(key);
    return {
      data: mocks.swrData,
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: mocks.mutate,
    };
  },
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: null }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    prefetch: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: any) => (
    <a href={typeof href === "string" ? href : String(href)}>{children}</a>
  ),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/draft-utils", () => ({
  storePendingDraftSelection: vi.fn(),
}));

vi.mock("@/lib/marketing/hub-url", () => ({
  getBenefitsHubOpenPortalUrl: (slug: string) => slug,
}));

vi.mock("@/lib/comments/portal-surface", () => ({
  withCommentsRail: (url: string) => url,
}));

vi.mock("@/lib/new-client-wizard-store", () => ({
  useNewClientWizardStore: { getState: () => ({ resetWizard: vi.fn() }) },
}));

vi.mock("@/components/ui/branding-image", () => ({
  BrandingImage: () => null,
}));

function latestSearchTerm(): string | null {
  const key = mocks.swrKeys[mocks.swrKeys.length - 1] ?? "";
  return new URL(key, "http://localhost").searchParams.get("search");
}

function everySearchTerm(): Array<string | null> {
  return mocks.swrKeys.map((key) =>
    new URL(key, "http://localhost").searchParams.get("search"),
  );
}

beforeEach(() => {
  mocks.swrKeys.length = 0;
});

describe("ClientsListDashboardPage search debounce", () => {
  it("does not query until the 300 ms window elapses", async () => {
    const user = userEvent.setup();
    render(<ClientsListDashboardPage />);

    expect(latestSearchTerm()).toBe("");

    await user.type(screen.getByPlaceholderText("Search plans..."), "Acme");

    // Still inside the debounce window: the input holds the text, SWR does not.
    expect(latestSearchTerm()).toBe("");

    await waitFor(() => expect(latestSearchTerm()).toBe("Acme"), {
      timeout: 3_000,
    });
  });

  it("issues one settled query for a burst of keystrokes", async () => {
    const user = userEvent.setup();
    render(<ClientsListDashboardPage />);

    await user.type(screen.getByPlaceholderText("Search plans..."), "Acme");
    await waitFor(() => expect(latestSearchTerm()).toBe("Acme"), {
      timeout: 3_000,
    });

    // Only the settled value reached SWR; no "A", "Ac" or "Acm" requests.
    const partialTerms = everySearchTerm().filter(
      (term) => term && term !== "Acme",
    );
    expect(partialTerms).toEqual([]);
  });
});
