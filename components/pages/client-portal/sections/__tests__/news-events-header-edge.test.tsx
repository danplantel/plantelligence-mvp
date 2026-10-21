import React from "react";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NewsEventsHeader } from "../news-events-header";

/**
 * `NewsEventsHeader` edge cases: the page trims the stored banner before it
 * gets here, but the component is also rendered directly (previews, meetings),
 * so it must not turn a whitespace value into an image request.
 */

describe("NewsEventsHeader edge cases", () => {
  it("treats a whitespace-only background as no background", () => {
    render(<NewsEventsHeader backgroundImage="   " />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "News & Events" }),
    ).toBeInTheDocument();
  });

  it("keeps the overlay and heading when there is no image at all", () => {
    const { container } = render(<NewsEventsHeader backgroundImage="" />);

    expect(container.querySelector(".bg-black\\/40")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("renders only one h1 and uses the custom title", () => {
    render(<NewsEventsHeader title="Plan Updates" />);

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("Plan Updates");
    // The bundled default background is still used when only the title is set.
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "/news-events-default-bg.webp",
    );
  });
});
