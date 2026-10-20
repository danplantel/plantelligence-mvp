import React from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PlanSearchBar,
  type PlanSearchBarPlan,
} from "@/components/plan-selector/plan-search-bar";

const mocks = vi.hoisted(() => ({
  recentIds: [] as string[],
  persist: vi.fn(),
  open: vi.fn(),
}));

vi.mock("@/lib/plan-selector-storage", () => ({
  getRecentPlanIds: () => mocks.recentIds,
  persistPlanSelection: mocks.persist,
}));

vi.mock("@/lib/marketing/hub-url", () => ({
  getBenefitsHubOpenPortalUrl: (slug: string) => `https://hub.test/${slug}`,
}));

const plans: PlanSearchBarPlan[] = [
  { id: "plan-active", companyName: "Acme Corp", slug: "acme", status: "Active" },
  { id: "plan-draft", companyName: "Draft Co", slug: "draft-co", status: "Draft" },
  {
    id: "plan-archived",
    companyName: "Archived Co",
    slug: "archived-co",
    status: "Archived",
  },
  { id: "plan-legacy", companyName: "Legacy Co", slug: null, status: null },
];

function renderPicker(
  overrides: Partial<React.ComponentProps<typeof PlanSearchBar>> = {},
) {
  const onChange = overrides.onChange ?? vi.fn();
  render(
    <PlanSearchBar
      plans={plans}
      value=""
      onChange={onChange}
      title="Benefits"
      module="benefits"
      {...overrides}
    />,
  );
  return { onChange };
}

beforeEach(() => {
  mocks.recentIds = [];
  mocks.persist.mockReset();
  mocks.open.mockReset();
  window.open = mocks.open as unknown as typeof window.open;
});

describe("PlanSearchBar", () => {
  it("offers only active plans by default", async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole("textbox", { name: "Search plans" }));

    expect(screen.getByRole("option", { name: "Acme Corp" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Legacy Co" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Draft Co" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Archived Co" }),
    ).not.toBeInTheDocument();
  });

  it("keeps Draft plans selectable when activeOnly is false", async () => {
    const user = userEvent.setup();
    renderPicker({ activeOnly: false });

    await user.click(screen.getByRole("textbox", { name: "Search plans" }));

    expect(screen.getByRole("option", { name: "Draft Co" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Archived Co" }),
    ).toBeInTheDocument();
  });

  it("shows recent chips only for plans in the current list", () => {
    mocks.recentIds = [
      "plan-draft",
      "plan-active",
      "plan-archived",
      "plan-legacy",
      "missing",
    ];
    renderPicker({ activeOnly: false });

    expect(screen.getByRole("button", { name: "Draft Co" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Acme Corp" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archived Co" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Legacy Co" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "missing" })).not.toBeInTheDocument();
  });

  it("selects a recent chip and persists the choice for the module", async () => {
    const user = userEvent.setup();
    mocks.recentIds = ["plan-active"];
    const { onChange } = renderPicker();

    await user.click(screen.getByRole("button", { name: "Acme Corp" }));

    expect(mocks.persist).toHaveBeenCalledWith("benefits", "plan-active");
    expect(onChange).toHaveBeenCalledWith("plan-active");
  });

  it("filters the dropdown case-insensitively", async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.type(screen.getByRole("textbox", { name: "Search plans" }), "acme");

    expect(screen.getByRole("option", { name: "Acme Corp" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Legacy Co" })).not.toBeInTheDocument();
    expect(screen.getByText("1 plan found")).toBeInTheDocument();
  });

  it("shows the no-match and no-plans messages", async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.type(
      screen.getByRole("textbox", { name: "Search plans" }),
      "zzz",
    );
    expect(screen.getByText("No plans match your search.")).toBeInTheDocument();
  });

  it("shows No plans available when the list is empty", async () => {
    const user = userEvent.setup();
    renderPicker({ plans: [] });

    await user.click(screen.getByRole("textbox", { name: "Search plans" }));

    expect(screen.getByText("No plans available.")).toBeInTheDocument();
  });

  it("supports arrow keys and Enter", async () => {
    const user = userEvent.setup();
    const { onChange } = renderPicker();

    const input = screen.getByRole("textbox", { name: "Search plans" });
    await user.click(input);
    await user.keyboard("{ArrowDown}{Enter}");

    // No recents: company names sort to Acme Corp, Draft Co filters out, so the
    // first option is Acme and the second is Legacy Co.
    expect(onChange).toHaveBeenCalledWith("plan-legacy");
    expect(mocks.persist).toHaveBeenCalledWith("benefits", "plan-legacy");
  });

  it("closes the dropdown on Escape", async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole("textbox", { name: "Search plans" }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes the dropdown on an outside click", async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole("textbox", { name: "Search plans" }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.click(document.body);

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("opens the selected plan's portal with the Comments rail", async () => {
    const user = userEvent.setup();
    renderPicker({ value: "plan-active" });

    await user.click(screen.getByRole("button", { name: /Open Portal/ }));

    expect(mocks.open).toHaveBeenCalledWith(
      "https://hub.test/acme?comments=on",
      "_blank",
    );
  });

  it("falls back to the plan id when the selected plan has no slug", async () => {
    const user = userEvent.setup();
    renderPicker({ value: "plan-legacy" });

    await user.click(screen.getByRole("button", { name: /Open Portal/ }));

    expect(mocks.open).toHaveBeenCalledWith(
      "https://hub.test/plan-legacy?comments=on",
      "_blank",
    );
  });

  it("exposes combobox and option semantics", async () => {
    const user = userEvent.setup();
    renderPicker({ value: "plan-active" });

    const input = screen.getByRole("textbox", { name: "Search plans" });
    expect(input).toHaveAttribute("aria-haspopup", "listbox");
    expect(input).toHaveAttribute("aria-expanded", "false");

    await user.click(input);

    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("option", { name: "Acme Corp" }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("disables the search input when there are no selectable plans", () => {
    renderPicker({ plans: [], disabled: true });

    expect(screen.getByRole("textbox", { name: "Search plans" })).toBeDisabled();
  });
});
