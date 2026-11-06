import { useState } from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  PortalDisclosureSection,
  type PortalDisclosureSectionProps,
} from "@/components/portal-editing/portal-disclosure-section";

/**
 * "Section N — Disclosure" in the Landing Page Edit Panel.
 *
 * It edits the row the four non-hub footers render (`disclaimers` → the Home Page
 * row) plus the footer background preference, and the notice has to say so: one
 * edit changes four pages, while the benefits keep their own.
 */

/** A controlled harness, so the textarea behaves as it does under the real host. */
function Harness({
  initial = {},
  onChange,
  fallbackText = "Advisor default text.",
}: {
  initial?: unknown;
  onChange: (next: any) => void;
  fallbackText?: string;
}) {
  const [value, setValue] = useState<unknown>(initial);
  return (
    <PortalDisclosureSection
      value={value}
      fallbackText={fallbackText}
      organizationName="Acme Benefits"
      companyName="Acme Corp"
      brandColor="#0D315F"
      secondaryColor="#C89B5B"
      onChange={(next) => {
        onChange(next);
        setValue(next);
      }}
    />
  );
}

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

describe("PortalDisclosureSection — the footer disclosure", () => {
  it("says where the disclosure appears", () => {
    render(<Harness onChange={vi.fn()} />);

    expect(screen.getByText(/Where this disclosure appears/i)).toBeInTheDocument();
    expect(screen.getByText(/Landing Page/)).toBeInTheDocument();
    expect(screen.getByText(/My Benefits Team/)).toBeInTheDocument();
    expect(screen.getByText(/News & Events/)).toBeInTheDocument();
    expect(screen.getByText(/Employee Resources/)).toBeInTheDocument();
    // …and that the benefit pages keep their own.
    expect(
      screen.getByText(/keep their own disclosure, set per benefit/i),
    ).toBeInTheDocument();
  });

  it("shows the stored disclosure", () => {
    render(<Harness initial={storedEnvelope} onChange={vi.fn()} />);

    expect(screen.getByLabelText("Footer disclosure")).toHaveValue(
      "Existing landing disclosure.",
    );
  });

  it("prefills the advisor's text while the plan has none", () => {
    render(<Harness initial={{}} onChange={vi.fn()} />);

    expect(screen.getByLabelText("Footer disclosure")).toHaveValue(
      "Advisor default text.",
    );
  });

  it("writes the text into the Home Page row, leaving the benefit's alone", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness initial={storedEnvelope} onChange={onChange} />);

    await user.clear(screen.getByLabelText("Footer disclosure"));
    await user.type(screen.getByLabelText("Footer disclosure"), "New footer.");

    const envelope = lastEnvelope(onChange);
    expect(envelope.disclaimers[0]).toMatchObject({
      id: "home-1",
      text: "New footer.",
      locations: ["Home Page"],
    });
    expect(envelope.disclaimers[1]).toEqual(storedEnvelope.disclaimers[1]);
    expect(envelope.byCategory).toEqual(storedEnvelope.byCategory);
  });

  it("fills the default disclosure, with the organization name only", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness initial={{}} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /Use the default/i }));

    const text = (lastEnvelope(onChange).disclaimers as any[])[0].text as string;
    expect(text).toContain("Acme Benefits");
    // These four pages use the organization name only, exactly as the layout does.
    expect(text).not.toContain("Acme Corp");
    expect(text).not.toContain("[Organization Name]");
  });

  it("writes the footer background without touching the disclosures", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness initial={storedEnvelope} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /Secondary/i }));

    const envelope = lastEnvelope(onChange);
    expect(envelope.footerBackground).toEqual({
      mode: "secondary",
      customColor: "",
    });
    expect(envelope.disclaimers).toEqual(storedEnvelope.disclaimers);
    expect(envelope.byCategory).toEqual(storedEnvelope.byCategory);
  });

  it("offers a hex field for a custom footer colour", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness initial={storedEnvelope} onChange={onChange} />);

    expect(
      screen.queryByLabelText("Custom footer colour hex"),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Custom/i }));

    // The choice alone already sets the mode…
    expect(lastEnvelope(onChange).footerBackground).toEqual({
      mode: "custom",
      customColor: "",
    });

    // …and the hex field then carries the colour.
    await user.type(screen.getByLabelText("Custom footer colour hex"), "123456");
    expect(lastEnvelope(onChange).footerBackground.mode).toBe("custom");
    expect(lastEnvelope(onChange).footerBackground.customColor).toBe("123456");
  });

  it("reads the stored background preference", () => {
    render(
      <Harness
        initial={{
          ...storedEnvelope,
          footerBackground: { mode: "secondary", customColor: "" },
        }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Secondary/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /Primary/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
