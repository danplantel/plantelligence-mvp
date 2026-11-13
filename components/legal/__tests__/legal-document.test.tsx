import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LegalDocument } from "@/components/legal/legal-document";

describe("LegalDocument", () => {
  it("renders the headings, bold spans and lists the policy text uses", () => {
    render(
      <LegalDocument
        markdown={
          "# Platform Policy\n\n" +
          "**Effective Date:** [DATE]  \n**Last Updated:** [DATE]\n\n" +
          "### A. Subsection\n\n" +
          "- First item\n" +
          "- **Second item**"
        }
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Platform Policy" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "A. Subsection" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Second item").tagName).toBe("STRONG");
    // The `##`/`###` markers must never survive into the rendered text.
    expect(document.body.textContent).not.toContain("###");
  });
});
