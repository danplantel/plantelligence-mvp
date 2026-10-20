import React from "react";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WebinarsDashboard } from "@/components/pages/client-portal/sections/webinars-dashboard";

const mocks = vi.hoisted(() => ({
  webinarsProps: null as any,
  questionsRendered: false,
  documentsRendered: false,
}));

vi.mock(
  "@/components/pages/client-portal/sections/webinars-section",
  () => ({
    WebinarsSection: (props: any) => {
      mocks.webinarsProps = props;
      return <div data-testid="webinars-section" />;
    },
  }),
);

vi.mock(
  "@/components/pages/client-portal/sections/have-questions-section",
  () => ({
    HaveQuestionsSection: () => {
      mocks.questionsRendered = true;
      return <div data-testid="have-questions-section" />;
    },
  }),
);

vi.mock(
  "@/components/pages/client-portal/sections/documents-section",
  () => ({
    DocumentsSection: () => {
      mocks.documentsRendered = true;
      return <div data-testid="documents-section" />;
    },
  }),
);

beforeEach(() => {
  mocks.webinarsProps = null;
  mocks.questionsRendered = false;
  mocks.documentsRendered = false;
});

describe("WebinarsDashboard", () => {
  it("renders only the webinars section", () => {
    render(<WebinarsDashboard />);

    expect(screen.getByTestId("webinars-section")).toBeInTheDocument();
    expect(
      screen.queryByTestId("have-questions-section"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("documents-section"),
    ).not.toBeInTheDocument();
    expect(mocks.questionsRendered).toBe(false);
    expect(mocks.documentsRendered).toBe(false);
  });

  it("forwards brand, secondary and client id", () => {
    render(
      <WebinarsDashboard
        brandColor="#123456"
        secondaryColor="#654321"
        clientId="plan-1"
      />,
    );

    expect(mocks.webinarsProps).toEqual({
      brandColor: "#123456",
      secondaryColor: "#654321",
      clientId: "plan-1",
    });
  });

  it("does not forward enableEditing to the section", () => {
    render(<WebinarsDashboard enableEditing />);

    expect(mocks.webinarsProps).not.toHaveProperty("enableEditing");
  });
});
