import React from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrgServiceCategories } from "@/components/pages/benefits/org-service-categories";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

beforeEach(() => {
  mocks.push.mockReset();
  mocks.fetch.mockReset();
  vi.stubGlobal("fetch", mocks.fetch);
});

describe("OrgServiceCategories", () => {
  it("renders one chip per category in the given order", () => {
    render(
      <OrgServiceCategories
        categories={["Retirement", "Group Health", "Group Life"]}
      />,
    );

    expect(screen.getByText("Your organization offers")).toBeInTheDocument();
    expect(screen.getByText("Retirement")).toBeInTheDocument();
    expect(screen.getByText("Group Health")).toBeInTheDocument();
    expect(screen.getByText("Group Life")).toBeInTheDocument();
  });

  it("states that no categories are selected for an empty list", () => {
    render(<OrgServiceCategories categories={[]} />);

    expect(
      screen.getByText("No service categories selected yet."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Retirement")).not.toBeInTheDocument();
  });

  it("offers Edit in Settings when categories exist", async () => {
    const user = userEvent.setup();
    render(<OrgServiceCategories categories={["Retirement"]} />);

    await user.click(screen.getByRole("button", { name: /Edit in Settings/ }));

    expect(mocks.push).toHaveBeenCalledWith("/settings");
  });

  it("offers Add in Settings when the list is empty", async () => {
    const user = userEvent.setup();
    render(<OrgServiceCategories categories={[]} />);

    await user.click(screen.getByRole("button", { name: /Add in Settings/ }));

    expect(mocks.push).toHaveBeenCalledWith("/settings");
  });

  it("renders the server-supplied list without fetching", () => {
    render(<OrgServiceCategories categories={["Retirement"]} />);

    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
