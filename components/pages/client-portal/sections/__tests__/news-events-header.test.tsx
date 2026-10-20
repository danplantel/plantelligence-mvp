import React from "react";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NewsEventsHeader } from "@/components/pages/client-portal/sections/news-events-header";

describe("NewsEventsHeader", () => {
  it("renders the default title, background and alt", () => {
    render(<NewsEventsHeader />);

    expect(
      screen.getByRole("heading", { level: 1, name: "News & Events" }),
    ).toBeInTheDocument();
    const image = screen.getByRole("img", { name: "Audience at event" });
    expect(image).toHaveAttribute("src", "/news-events-default-bg.webp");
    expect(image).toHaveClass("object-cover");
  });

  it("renders a custom title and background", () => {
    render(
      <NewsEventsHeader
        title="Firm Updates"
        backgroundImage="https://cdn.test/header.webp"
        backgroundImageAlt="Team meeting"
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Firm Updates" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Team meeting" })).toHaveAttribute(
      "src",
      "https://cdn.test/header.webp",
    );
  });

  it("omits the image when the background is an empty string", () => {
    render(<NewsEventsHeader backgroundImage="" />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "News & Events" }),
    ).toBeInTheDocument();
  });

  it("uses a plain img so an R2 proxy URL is resolved as-is", () => {
    const { container } = render(
      <NewsEventsHeader backgroundImage="/api/r2/object?key=org%2Fheader.webp" />,
    );

    const img = container.querySelector("img");
    expect(img).toHaveAttribute(
      "src",
      "/api/r2/object?key=org%2Fheader.webp",
    );
  });

  it("keeps the dark overlay behind the heading", () => {
    const { container } = render(<NewsEventsHeader />);

    expect(container.querySelector(".bg-black\\/40")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "News & Events" }),
    ).toBeInTheDocument();
  });
});
