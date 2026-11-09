import { useState } from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PortalFooterDialog,
  type PortalFooterDialogProps,
} from "@/components/portal-editing/portal-footer-dialog";
import {
  resolveDefaultDisclosuresText,
  stripDisclaimerCopyright,
} from "@/lib/disclaimer-constants";

/**
 * The panel's Disclosure section is a compact card; the editor opens in a
 * full-width dialog built from Create Client Step 5's `DisclosureFooterEditor`.
 *
 * That is the whole point of the change: with the Editing Panel (and possibly the
 * Comments rail) taking the viewport, the live footer is a sliver, so the legal
 * copy cannot be proof-read. These tests pin the two halves — the card alone is
 * not the editor, and the editor's textarea lives inside the real footer as it
 * does in Step 5.
 */

const editing = vi.hoisted(() => ({
  focusRequest: null as { id: string; nonce: number } | null,
}));

vi.mock("@/components/portal-editing/portal-editing-provider", () => ({
  useOptionalPortalEditing: () => editing,
}));

// `DisclosureFooterEditor` renders the home footer via `PortalDisclaimers` and a
// benefit hub's via `Footer`. Both only need to expose the colour they were
// handed and the editor node they were given.
vi.mock("@/components/pages/client-portal/sections/portal-disclaimers", () => ({
  PortalDisclaimers: ({ brandColor, disclosureNode }: any) => (
    <footer data-testid="footer-preview" data-bg={brandColor}>
      {disclosureNode}
    </footer>
  ),
}));

vi.mock("@/components/layout/footer", () => ({
  Footer: ({ brandColor, disclosureNode }: any) => (
    <footer data-testid="footer-preview" data-bg={brandColor}>
      {disclosureNode}
    </footer>
  ),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: any) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}));

const storedEnvelope = {
  disclaimers: [
    {
      id: "home-1",
      text: "Existing landing disclosure.",
      locations: ["Home Page"],
      scope: "plan",
    },
    {
      id: "ret-1",
      text: "Retirement only.",
      locations: ["Retirement"],
    },
  ],
  byCategory: { Retirement: { text: "Per-benefit retirement" } },
  footerBackground: { mode: "primary", customColor: "" },
};

function lastEnvelope(spy: ReturnType<typeof vi.fn>) {
  return spy.mock.calls[spy.mock.calls.length - 1][0] as any;
}

/** A controlled harness, so the editor follows the value the host would patch. */
function Harness({
  initial = {},
  onChange,
  onCancel,
  onSave,
  scope,
  fallbackText = "Advisor default text.",
}: {
  initial?: unknown;
  onChange: (next: any) => void;
  onCancel?: () => void | Promise<void>;
  onSave?: () => void | Promise<void>;
  scope?: PortalFooterDialogProps["scope"];
  fallbackText?: string;
}) {
  const [value, setValue] = useState<unknown>(initial);
  return (
    <PortalFooterDialog
      value={value}
      fallbackText={fallbackText}
      organizationName="Acme Benefits"
      companyName="Acme Corp"
      brandColor="#0D315F"
      secondaryColor="#C89B5B"
      scope={scope}
      onChange={(next) => {
        onChange(next);
        setValue(next);
      }}
      onCancel={onCancel}
      onSave={onSave}
    />
  );
}

const openButton = () =>
  screen.getByRole("button", { name: /Open footer editor/i });

describe("PortalFooterDialog — the panel card", () => {
  beforeEach(() => {
    editing.focusRequest = null;
  });

  it("keeps the Step 5 editor out of the narrow panel until it is opened", () => {
    render(<Harness initial={storedEnvelope} onChange={vi.fn()} />);

    expect(openButton()).toBeInTheDocument();
    // The background choices, the radios and the textarea all belong to the
    // dialog — the panel column only carries the preview card.
    expect(screen.queryByLabelText("Disclosure Text")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("radio", { name: /Use Default/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("footer-preview")).not.toBeInTheDocument();
  });

  it("does not repeat the footer preview inside the narrow panel column", () => {
    render(<Harness initial={storedEnvelope} onChange={vi.fn()} />);

    expect(
      screen.queryByText("Existing landing disclosure."),
    ).not.toBeInTheDocument();
  });
});

describe("PortalFooterDialog — the Create Client Step 5 editor", () => {
  beforeEach(() => {
    editing.focusRequest = null;
  });

  it("opens the real footer, with the textarea inside it, at full width", async () => {
    const user = userEvent.setup();
    render(<Harness initial={storedEnvelope} onChange={vi.fn()} />);

    await user.click(openButton());

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Applies to:/i)).toBeInTheDocument();

    // Step 5's arrangement: background choices, the two mode radios, and the
    // editable text living inside the footer itself.
    expect(
      screen.getByRole("radio", { name: /Use Default/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /Add my own/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("footer-preview")).toContainElement(
      screen.getByLabelText("Disclosure Text"),
    );
    expect(screen.getByLabelText("Disclosure Text")).toHaveValue(
      "Existing landing disclosure.",
    );
    // A disclosure that is not the platform copy opens on "Add my own", with the
    // stored words in the box.
    expect(screen.getByRole("radio", { name: /Add my own/i })).toBeChecked();
  });

  it("loads a stored disclosure that equals the platform default", async () => {
    const defaultLandingText = stripDisclaimerCopyright(
      resolveDefaultDisclosuresText("Acme Benefits", "Acme Corp", false),
    );
    const user = userEvent.setup();
    render(
      <Harness
        initial={{
          disclaimers: [
            {
              id: "home-default",
              text: defaultLandingText,
              locations: ["Home Page"],
            },
          ],
        }}
        onChange={vi.fn()}
      />,
    );

    await user.click(openButton());

    // The footer is already live, so its copy must be in the box — even when it
    // is the platform default Step 5 would leave unselected for a new plan.
    expect(screen.getByLabelText("Disclosure Text")).toHaveValue(
      defaultLandingText,
    );
    expect(screen.getByRole("radio", { name: /Use Default/i })).toBeChecked();
  });

  it("writes every keystroke through the host's envelope", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness initial={storedEnvelope} onChange={onChange} />);

    await user.click(openButton());
    await user.clear(screen.getByLabelText("Disclosure Text"));
    await user.type(screen.getByLabelText("Disclosure Text"), "New footer.");

    expect(screen.getByLabelText("Disclosure Text")).toHaveValue("New footer.");

    // The same envelope the panel would save, with only the Home Page row changed.
    const envelope = lastEnvelope(onChange);
    expect(envelope.disclaimers[0]).toMatchObject({
      id: "home-1",
      text: "New footer.",
      locations: ["Home Page"],
    });
    expect(envelope.disclaimers[1]).toEqual(storedEnvelope.disclaimers[1]);

    // The controlled editor is already showing the words it will save.
    expect(screen.getByLabelText("Disclosure Text")).toHaveValue("New footer.");
  });

  it("Use Default fills the platform copy without touching the benefit rows", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness initial={storedEnvelope} onChange={onChange} />);

    await user.click(openButton());
    await user.click(screen.getByRole("radio", { name: /Use Default/i }));

    const envelope = lastEnvelope(onChange);
    expect(envelope.disclaimers[0].text).toContain("Acme Benefits");
    // The four non-hub pages use the organization name only.
    expect(envelope.disclaimers[0].text).not.toContain("Acme Corp");
    expect(envelope.byCategory).toEqual(storedEnvelope.byCategory);
  });

  it("repaints the footer background when the preference changes", async () => {
    const user = userEvent.setup();
    render(<Harness initial={storedEnvelope} onChange={vi.fn()} />);

    await user.click(openButton());
    await user.click(screen.getByRole("button", { name: /Secondary/i }));

    expect(screen.getByTestId("footer-preview")).toHaveAttribute(
      "data-bg",
      "#C89B5B",
    );
  });

  it("Cancel discards through the host and closes the dialog", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <Harness
        initial={storedEnvelope}
        onChange={vi.fn()}
        onCancel={onCancel}
      />,
    );

    await user.click(openButton());
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Disclosure Text")).not.toBeInTheDocument();
  });

  it("Done saves through the host, then closes", async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(
      <Harness initial={storedEnvelope} onChange={vi.fn()} onSave={onSave} />,
    );

    await user.click(openButton());
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Disclosure Text")).not.toBeInTheDocument();
  });

  it("shows a spinner and ignores repeat Done presses while saving", async () => {
    let finishSave: (() => void) | undefined;
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishSave = resolve;
        }),
    );
    const user = userEvent.setup();
    render(
      <Harness initial={storedEnvelope} onChange={vi.fn()} onSave={onSave} />,
    );

    await user.click(openButton());
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const savingButton = screen.getByRole("button", { name: /Saving/i });
    expect(savingButton).toBeDisabled();

    // A second press while the PUT is in flight is ignored — one save, one toast.
    await user.click(savingButton);
    expect(onSave).toHaveBeenCalledTimes(1);

    finishSave?.();
    await waitFor(() =>
      expect(
        screen.queryByLabelText("Disclosure Text"),
      ).not.toBeInTheDocument(),
    );
  });

  it("keeps the dialog open when the host's save rejects", async () => {
    const onSave = vi.fn(async () => {
      throw new Error("Could not save the footer.");
    });
    const user = userEvent.setup();
    render(
      <Harness initial={storedEnvelope} onChange={vi.fn()} onSave={onSave} />,
    );

    await user.click(openButton());
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.getByLabelText("Disclosure Text")).toBeInTheDocument();
  });

  it("opens on arrival when the panel asks for the Disclosure section", () => {
    editing.focusRequest = { id: "disclosure", nonce: 1 };
    render(<Harness initial={storedEnvelope} onChange={vi.fn()} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Disclosure Text")).toBeInTheDocument();
  });

  it("reads a benefit's own row when the scope names a hub", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={{
          disclaimers: storedEnvelope.disclaimers,
          byCategory: { Retirement: { text: "Retirement footer." } },
        }}
        scope={{ kind: "benefit", category: "Retirement", label: "Retirement" }}
        onChange={vi.fn()}
      />,
    );

    // The card names the page it paints…
    expect(screen.getByText("Retirement page")).toBeInTheDocument();

    // …and the dialog edits that row, not the portal-wide one.
    await user.click(openButton());
    expect(screen.getByLabelText("Disclosure Text")).toHaveValue(
      "Retirement footer.",
    );
  });
});
