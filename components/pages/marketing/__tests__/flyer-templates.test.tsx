import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useBrandingImageUrl", () => ({
  useBrandingImageUrl: (url?: string | null) => ({ url: url ?? null }),
}));

import {
  FLYER_TEMPLATE_BENEFITS_CATEGORY,
  FlyerPreview,
  MeetingTemplate1,
  TemplateThumbnail,
  TopicalTemplate1,
  TopicalTemplate2,
  TopicalTemplate3,
  adjustColor,
  hasUserBullets,
  parseBodySegments,
  renderBodyParts,
  renderFormattedText,
  truncateText,
  wrapSingleLine,
  type BodyPart,
  type FlyerPreviewProps,
} from "../flyer-templates";

const baseProps: FlyerPreviewProps = {
  headline: "Hi",
  body: "Body",
  ctaText: "",
  bgColor: "#111111",
  startDate: "2026-07-29",
  planName: "Acme",
  flyerTemplate: "TopicalTemplate1",
};

function renderFormatted(line: string) {
  const { container, unmount } = render(
    <svg>
      <text>{renderFormattedText(line)}</text>
    </svg>,
  );
  const text = container.querySelector("text");
  const html = text?.innerHTML ?? "";
  const content = text?.textContent ?? "";
  unmount();
  return { html, content };
}

describe("flyer template shared helpers", () => {
  it("returns short text untouched and truncates long text with an ellipsis", () => {
    expect(truncateText("Short", 10)).toBe("Short");
    expect(truncateText("Hello world", 8)).toBe("Hello...");
    expect(truncateText("Hello world", 5)).toBe("He...");
  });

  it("lightens and darkens hex colors while clamping channels", () => {
    expect(adjustColor("#000000", 20)).toBe("#141414");
    expect(adjustColor("#ffffff", -20)).toBe("#ebebeb");
    expect(adjustColor("#ffffff", 50)).toBe("#ffffff");
    expect(adjustColor("#000000", -50)).toBe("#000000");
    expect(adjustColor("#23919c", 0)).toBe("#23919c");
  });

  it("declares the benefits category for every template", () => {
    expect(FLYER_TEMPLATE_BENEFITS_CATEGORY).toEqual({
      TopicalTemplate1: "Retirement",
      TopicalTemplate2: "Retirement",
      TopicalTemplate3: "Retirement",
      MeetingTemplate1: "Retirement",
    });
  });

  it("detects user bullet markers only for dash-prefixed lines", () => {
    expect(hasUserBullets("")).toBe(false);
    expect(hasUserBullets("Plain body")).toBe(false);
    expect(hasUserBullets("* star bullet")).toBe(false);
    expect(hasUserBullets("First line\n  - nested bullet")).toBe(true);
  });

  it("parses body text into text, bullet, and blank segments", () => {
    expect(parseBodySegments("")).toEqual([]);
    expect(parseBodySegments("Intro\n\n- First\n  - Second")).toEqual<BodyPart[]>([
      { kind: "text", text: "Intro" },
      { kind: "text", text: "" },
      { kind: "bullet", text: "First" },
      { kind: "bullet", text: "Second" },
    ]);
  });

  it("wraps a single line at the requested width", () => {
    expect(wrapSingleLine("one two three four", 9)).toEqual(["one two", "three", "four"]);
    expect(wrapSingleLine("short", 20)).toEqual(["short"]);
    expect(wrapSingleLine("", 20)).toEqual([""]);
  });

  it("returns plain text as a single node", () => {
    const { html, content } = renderFormatted("Plain headline");

    expect(content).toBe("Plain headline");
    expect(html).toBe("Plain headline");
  });

  it("renders bold markers as a bold tspan", () => {
    const { html, content } = renderFormatted("Save **more** today");

    expect(content).toBe("Save more today");
    expect(html).toContain('font-weight="bold"');
    expect(html).toContain("more");
  });

  it("renders color markers as a filled tspan", () => {
    const { html, content } = renderFormatted("Get {#ffcb0a}gold{/} now");

    expect(content).toBe("Get gold now");
    expect(html).toContain('fill="#ffcb0a"');
    expect(html).toContain("gold");
  });

  it("renders bullet parts with a marker and indented continuation lines", () => {
    const { container } = render(
      <svg>
        {renderBodyParts(
          [
            { kind: "text", text: "Intro" },
            { kind: "bullet", text: "A long bullet line that needs wrapping" },
            { kind: "text", text: "" },
          ],
          {
            x: 10,
            startY: 20,
            lineHeight: 10,
            maxChars: 20,
            bulletColor: "#cc0000",
            maxLines: 6,
          },
        )}
      </svg>,
    );

    const markers = container.querySelectorAll("polygon");
    expect(markers).toHaveLength(1);
    expect(markers[0].getAttribute("fill")).toBe("#cc0000");
    expect(container.textContent).toContain("Intro");
    expect(container.textContent).toContain("A long bullet line");
  });

  it("stops rendering body parts at the max line count", () => {
    const parts: BodyPart[] = Array.from({ length: 10 }, (_, i) => ({
      kind: "text",
      text: `Line ${i}`,
    }));
    const { container } = render(
      <svg>
        {renderBodyParts(parts, {
          x: 0,
          startY: 0,
          lineHeight: 10,
          maxChars: 40,
          maxLines: 3,
        })}
      </svg>,
    );

    expect(container.querySelectorAll("text")).toHaveLength(3);
    expect(container.textContent).not.toContain("Line 3");
  });
});

describe("TemplateThumbnail", () => {
  it.each([
    "TopicalTemplate1",
    "TopicalTemplate2",
    "TopicalTemplate3",
    "MeetingTemplate1",
  ])("renders an SVG thumbnail for %s", (id) => {
    const { container } = render(<TemplateThumbnail id={id} bgColor="#23919c" />);

    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe("0 0 60 80");
  });

  it("returns nothing for an unknown template", () => {
    const { container } = render(<TemplateThumbnail id="Unknown" bgColor="#23919c" />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe("FlyerPreview router", () => {
  it.each([
    ["TopicalTemplate1", TopicalTemplate1],
    ["TopicalTemplate2", TopicalTemplate2],
    ["TopicalTemplate3", TopicalTemplate3],
    ["MeetingTemplate1", MeetingTemplate1],
  ] as const)("routes %s to its template", (template, Component) => {
    const { container, unmount } = render(
      <FlyerPreview {...baseProps} flyerTemplate={template} />,
    );
    const routed = container.innerHTML;
    unmount();

    const { container: direct } = render(
      <Component {...baseProps} flyerTemplate={template} />,
    );

    expect(direct.innerHTML).toBe(routed);
  });

  it("falls back to the first topical template for an unknown id", () => {
    const { container, unmount } = render(
      <FlyerPreview {...baseProps} flyerTemplate={"Unknown" as any} />,
    );
    const routed = container.innerHTML;
    unmount();

    const { container: direct } = render(
      <TopicalTemplate1 {...baseProps} flyerTemplate={"Unknown" as any} />,
    );

    expect(direct.innerHTML).toBe(routed);
  });
});

describe("TopicalTemplate1", () => {
  it("uppercases and truncates the headline", () => {
    render(<TopicalTemplate1 {...baseProps} headline="Retirement Planning" />);

    expect(screen.getByText("RETIREM...")).toBeInTheDocument();
  });

  it("renders the default body copy when no body is provided", () => {
    const { container } = render(<TopicalTemplate1 {...baseProps} body="" />);

    expect(container.textContent).toContain("Retirement Savings");
    expect(container.textContent).toContain("From Your Former Employer");
  });

  it("renders a custom flyer image instead of the default piggy bank", () => {
    const { container } = render(
      <TopicalTemplate1 {...baseProps} flyerImage="https://cdn.example/photo.png" />,
    );

    expect(
      container.querySelector('image[href="https://cdn.example/photo.png"]'),
    ).toBeInTheDocument();
  });

  it("renders bullet polygons and bullet text for user bullets", () => {
    const { container } = render(
      <TopicalTemplate1 {...baseProps} body={"Intro\n- First benefit\n- Second benefit"} />,
    );

    expect(container.querySelectorAll("polygon")).toHaveLength(2);
    expect(container.textContent).toContain("First benefit");
    expect(container.textContent).toContain("Second benefit");
  });

  it("renders an inline QR data URL when provided", () => {
    const { container } = render(
      <TopicalTemplate1 {...baseProps} flyerQrDataUrl="data:image/png;base64,AAA" />,
    );

    expect(
      container.querySelector('image[href="data:image/png;base64,AAA"]'),
    ).toBeInTheDocument();
  });

  it("falls back to the QR service when only a destination URL exists", () => {
    const { container } = render(
      <TopicalTemplate1 {...baseProps} flyerQrUrl="https://hub.example/x?a=1" />,
    );

    const qr = container.querySelector('image[href*="api.qrserver.com"]');
    expect(qr).toBeInTheDocument();
    expect(qr?.getAttribute("href")).toContain(
      encodeURIComponent("https://hub.example/x?a=1"),
    );
  });

  it("renders a dashed placeholder when no QR data exists", () => {
    const { container } = render(<TopicalTemplate1 {...baseProps} />);

    const placeholder = container.querySelector('rect[stroke-dasharray="4,4"]');
    expect(placeholder).toBeInTheDocument();
  });

  it("prefers the organization logo in the footer but keeps the plan logo in the hero", () => {
    const { container } = render(
      <TopicalTemplate1
        {...baseProps}
        planLogo="https://cdn.example/plan.png"
        organizationLogo="https://cdn.example/org.png"
      />,
    );

    const org = container.querySelector('image[href="https://cdn.example/org.png"]');
    expect(org).toBeInTheDocument();
    expect(org?.getAttribute("width")).toBe("120");

    const plan = container.querySelector('image[href="https://cdn.example/plan.png"]');
    expect(plan).toBeInTheDocument();
    expect(plan?.getAttribute("width")).toBe("157");
  });

  it("uses the Spanish footer labels when the flyer language is es", () => {
    const { container } = render(
      <TopicalTemplate1 {...baseProps} flyerLanguage="es" />,
    );

    expect(container.textContent).toContain("Escanea este código QR");
    expect(container.textContent).toContain("y programe una consulta.");
  });

  it("renders the provided disclaimer text", () => {
    const { container } = render(
      <TopicalTemplate1 {...baseProps} disclaimerText="Custom disclosure line" />,
    );

    expect(container.textContent).toContain("Custom disclosure line");
  });
});

describe("MeetingTemplate1", () => {
  it("formats the date, time, and location", () => {
    const { container } = render(
      <MeetingTemplate1
        {...baseProps}
        flyerTemplate="MeetingTemplate1"
        startDate="2026-07-29"
        meetingTime="14:30"
        meetingLocation="Room 12"
      />,
    );

    expect(container.textContent).toContain("Wednesday, July 29, 2026 at 2:30 PM");
    expect(container.textContent).toContain("Room 12");
    expect(container.textContent).toContain("Acme");
  });

  it("falls back to TBD details when dates and location are missing", () => {
    const { container } = render(
      <MeetingTemplate1
        {...baseProps}
        flyerTemplate="MeetingTemplate1"
        startDate=""
        meetingLocation=""
      />,
    );

    expect(container.textContent).toContain("Date & time TBD");
    expect(container.textContent).toContain("Virtual via Zoom");
  });

  it("uses the default hero image unless a custom one is provided", () => {
    const { container, unmount } = render(
      <MeetingTemplate1 {...baseProps} flyerTemplate="MeetingTemplate1" />,
    );
    expect(
      container.querySelector(
        'image[href="/create-flyer-images/meeting/template_04/counting_money.jpg"]',
      ),
    ).toBeInTheDocument();
    unmount();

    const { container: custom } = render(
      <MeetingTemplate1
        {...baseProps}
        flyerTemplate="MeetingTemplate1"
        flyerImage="https://cdn.example/custom.jpg"
      />,
    );
    expect(
      custom.querySelector('image[href="https://cdn.example/custom.jpg"]'),
    ).toBeInTheDocument();
  });
});
