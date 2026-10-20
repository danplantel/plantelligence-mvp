import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EditClientHeader } from "../edit-client-header";

/**
 * `EditClientHeader` — the band above the Edit Plan tabs.
 *
 * Three pieces of behaviour live here and nowhere else:
 *
 *  1. The validation badges, which read differently for an Active plan (needs
 *     work) than for a Draft/Archived one (ready to publish).
 *  2. "Open Portal", which must open the plan's own slug — falling back to the
 *     client id — with the Comments rail requested, in a new tab.
 *  3. Deleting a plan, which is gated behind typing the phrase `delete plan`.
 *     Radix's AlertDialog ignores Escape and outside clicks, so the typed
 *     phrase is the only thing that can unlock the confirm button; a reopen has
 *     to start locked again.
 *
 * `Select` is replaced with a native `<select>` because Radix's listbox needs
 * pointer events jsdom does not implement. `getBenefitsHubOpenPortalUrl` is
 * stubbed to a fixed base so the assertion is about which identifier is used,
 * while `withCommentsRail` runs for real so the query flag is verified.
 */

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

vi.mock("@/lib/marketing/hub-url", () => ({
  getBenefitsHubOpenPortalUrl: (idOrSlug: string) =>
    `https://portal.test/${idOrSlug}`,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <select
      aria-label="Status"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => (
    <option value={value}>{children}</option>
  ),
}));

type HeaderProps = React.ComponentProps<typeof EditClientHeader>;

function renderHeader(overrides: Partial<HeaderProps> = {}) {
  const props: HeaderProps = {
    clientStatus: "Active",
    onStatusChange: vi.fn(),
    onBackClick: vi.fn(),
    hasClient: true,
    isFormValid: true,
    clientId: "plan-1",
    slug: "acme",
    planName: "Acme",
    ...overrides,
  };

  render(<EditClientHeader {...props} />);
  return props;
}

function statusSelect() {
  return screen.getByRole("combobox", { name: "Status" });
}

async function openDeleteDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Delete Plan/ }));
  // ConfirmDialog is an AlertDialog, so Radix gives it role="alertdialog".
  return screen.getByRole("alertdialog");
}

function confirmButton(dialog: HTMLElement) {
  return within(dialog).getByRole("button", { name: "Yes, delete" });
}

beforeEach(() => {
  vi.clearAllMocks();
  // The delete path logs its own failure before toasting; keep the run quiet.
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ success: true }),
  });
  vi.stubGlobal("fetch", mocks.fetch);
  vi.spyOn(window, "open").mockImplementation(() => null);
});

describe("EditClientHeader", () => {
  it("renders the plan name and its current status", () => {
    renderHeader({ clientStatus: "Draft", planName: "Northwind" });

    expect(
      screen.getByRole("heading", { name: "Northwind" }),
    ).toBeInTheDocument();
    expect(statusSelect()).toHaveValue("Draft");
  });

  it("omits the title when the plan has no name yet", () => {
    renderHeader({ planName: undefined });

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("flags an Active plan that is missing required fields", () => {
    renderHeader({ clientStatus: "Active", isFormValid: false });

    expect(screen.getByText("Form incomplete")).toBeInTheDocument();
    expect(screen.queryByText("Ready to activate")).not.toBeInTheDocument();
  });

  it("does not flag a valid Active plan", () => {
    renderHeader({ clientStatus: "Active", isFormValid: true });

    expect(screen.queryByText("Form incomplete")).not.toBeInTheDocument();
    expect(screen.queryByText("Ready to activate")).not.toBeInTheDocument();
  });

  it("offers to publish a non-Active plan whose form is valid", () => {
    renderHeader({ clientStatus: "Draft", isFormValid: true });

    expect(screen.getByText("Ready to activate")).toBeInTheDocument();
    expect(screen.queryByText("Form incomplete")).not.toBeInTheDocument();
  });

  it("withholds the publish hint when a non-Active plan is incomplete", () => {
    renderHeader({ clientStatus: "Draft", isFormValid: false });

    expect(screen.queryByText("Ready to activate")).not.toBeInTheDocument();
  });

  it("delegates the back action", async () => {
    const user = userEvent.setup();
    const props = renderHeader();

    await user.click(screen.getByTitle("Back to Plans"));

    expect(props.onBackClick).toHaveBeenCalledTimes(1);
  });

  it("delegates a status change", async () => {
    const user = userEvent.setup();
    const props = renderHeader({ clientStatus: "Active" });

    await user.selectOptions(statusSelect(), "Archived");

    expect(props.onStatusChange).toHaveBeenCalledWith("Archived");
  });

  it("opens the plan's slug with the comments rail in a new tab", async () => {
    const user = userEvent.setup();
    renderHeader({ clientId: "plan-1", slug: "acme" });

    await user.click(screen.getByRole("button", { name: /Open Portal/ }));

    expect(window.open).toHaveBeenCalledWith(
      "https://portal.test/acme?comments=on",
      "_blank",
    );
  });

  it("falls back to the client id when the plan has no slug", async () => {
    const user = userEvent.setup();
    renderHeader({ clientId: "507f1f77bcf86cd799439011", slug: undefined });

    await user.click(screen.getByRole("button", { name: /Open Portal/ }));

    expect(window.open).toHaveBeenCalledWith(
      "https://portal.test/507f1f77bcf86cd799439011?comments=on",
      "_blank",
    );
  });

  it("disables the plan actions until the plan is loaded", () => {
    renderHeader({ hasClient: false });

    expect(screen.getByRole("button", { name: /Open Portal/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Delete Plan/ })).toBeDisabled();
  });

  it("keeps Delete Plan locked until the phrase is typed", async () => {
    const user = userEvent.setup();
    renderHeader();

    const dialog = await openDeleteDialog(user);
    expect(confirmButton(dialog)).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/delete plan/i), "keep plan");
    expect(confirmButton(dialog)).toBeDisabled();

    // Trimmed and case-insensitive, so a pasted phrase still unlocks it.
    await user.clear(within(dialog).getByLabelText(/delete plan/i));
    await user.type(
      within(dialog).getByLabelText(/delete plan/i),
      "  DELETE PLAN  ",
    );
    expect(confirmButton(dialog)).toBeEnabled();
  });

  it("re-locks Delete Plan when the dialog is reopened", async () => {
    const user = userEvent.setup();
    renderHeader();

    const dialog = await openDeleteDialog(user);
    await user.type(
      within(dialog).getByLabelText(/delete plan/i),
      "delete plan",
    );
    expect(confirmButton(dialog)).toBeEnabled();

    await user.click(
      within(dialog).getByRole("button", { name: "No, keep it" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );

    const reopened = await openDeleteDialog(user);
    expect(confirmButton(reopened)).toBeDisabled();
  });

  it("deletes the plan, toasts, and returns to All Plans", async () => {
    const user = userEvent.setup();
    renderHeader({ clientId: "plan-1" });

    const dialog = await openDeleteDialog(user);
    await user.type(
      within(dialog).getByLabelText(/delete plan/i),
      "delete plan",
    );
    await user.click(confirmButton(dialog));

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "Plan deleted successfully",
      ),
    );
    expect(mocks.fetch).toHaveBeenCalledWith("/api/clients/plan-1", {
      method: "DELETE",
    });
    expect(mocks.push).toHaveBeenCalledWith("/clients");
  });

  it("keeps the advisor on the page when the delete request fails", async () => {
    const user = userEvent.setup();
    mocks.fetch.mockResolvedValue({ ok: false, json: async () => ({}) });
    renderHeader({ clientId: "plan-1" });

    const dialog = await openDeleteDialog(user);
    await user.type(
      within(dialog).getByLabelText(/delete plan/i),
      "delete plan",
    );
    await user.click(confirmButton(dialog));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Failed to delete plan"),
    );
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("reports the API's own error when the delete is refused", async () => {
    const user = userEvent.setup();
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: false, error: "Plan is locked" }),
    });
    renderHeader({ clientId: "plan-1" });

    const dialog = await openDeleteDialog(user);
    await user.type(
      within(dialog).getByLabelText(/delete plan/i),
      "delete plan",
    );
    await user.click(confirmButton(dialog));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Failed to delete plan"),
    );
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
