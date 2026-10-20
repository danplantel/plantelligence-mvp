import React from "react";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import EditBenefitRoute from "../page";

/**
 * Edit Benefit route gate.
 *
 * The real `slugToCategory` is used, so the tests also pin the URL-safe
 * category segment the route relies on. The access hook and both possible
 * screens are mocked; the suite asserts which one wins for each access state.
 */

const mocks = vi.hoisted(() => ({
  params: {} as Record<string, unknown>,
  access: { status: "allowed" } as any,
  accessInput: null as any,
  noticeProps: null as any,
  editorProps: null as any,
}));

vi.mock("next/navigation", () => ({
  useParams: () => mocks.params,
}));

vi.mock("@/hooks/usePlanAccess", () => ({
  usePlanAccess: (input: any) => {
    mocks.accessInput = input;
    return mocks.access;
  },
}));

vi.mock("@/components/pages/benefits/benefit-edit-page", () => ({
  BenefitEditPage: (props: any) => {
    mocks.editorProps = props;
    return (
      <div
        data-testid="edit-benefit"
        data-plan-id={props.planId}
        data-category={props.category}
      />
    );
  },
}));

vi.mock("@/components/pages/no-access-notice", () => ({
  NoAccessNotice: (props: any) => {
    mocks.noticeProps = props;
    return (
      <div
        data-testid="no-access-notice"
        data-message={props.message ?? ""}
        data-reason={props.reason ?? ""}
        data-plan-id={props.planId ?? ""}
        data-organization={props.organizationName ?? ""}
        data-plan-name={props.planCompanyName ?? ""}
        data-category={props.category ?? ""}
        data-assigned={JSON.stringify(props.assignedCategories ?? [])}
        data-owner={props.ownerUserId ?? ""}
      />
    );
  },
}));

function setParams(planId: unknown, category: unknown) {
  mocks.params = { planId, category };
}

function renderRoute() {
  return render(<EditBenefitRoute />);
}

beforeEach(() => {
  mocks.params = { planId: "plan-1", category: "retirement" };
  mocks.access = { status: "allowed" };
  mocks.accessInput = null;
  mocks.noticeProps = null;
  mocks.editorProps = null;
});

describe("EditBenefitRoute", () => {
  describe("access lookup", () => {
    it("asks for view access to the decoded plan and category", () => {
      setParams("plan-1", "group-health");
      renderRoute();

      expect(mocks.accessInput).toEqual({
        planId: "plan-1",
        category: "Group Health",
        permission: "create_benefits",
        level: "view",
      });
    });

    it("uses the route's plan id unchanged", () => {
      setParams("plan-slug", "retirement");
      renderRoute();

      expect(mocks.accessInput.planId).toBe("plan-slug");
    });

    it("passes empty strings when params are not strings", () => {
      setParams(42, { slug: "retirement" });
      renderRoute();

      expect(mocks.accessInput).toEqual({
        planId: "",
        category: "",
        permission: "create_benefits",
        level: "view",
      });
    });

    it("passes an empty plan id when planId is missing", () => {
      mocks.params = { category: "retirement" };
      renderRoute();

      expect(mocks.accessInput.planId).toBe("");
      expect(mocks.accessInput.category).toBe("Retirement");
    });
  });

  describe("category slug decoding", () => {
    it.each([
      ["retirement", "Retirement"],
      ["group-health", "Group Health"],
      ["group-life", "Group Life"],
      ["company-plan-sponsor", "Company / Plan Sponsor"],
      ["GROUP-HEALTH", "Group Health"],
      ["group%2Dhealth", "Group Health"],
      ["dental-vision", "dental-vision"],
    ])("maps %s to %s", (slug, category) => {
      setParams("plan-1", slug);
      renderRoute();

      expect(mocks.accessInput.category).toBe(category);
    });

    it("passes the decoded category to the editor", () => {
      setParams("plan-1", "company-plan-sponsor");
      renderRoute();

      expect(mocks.editorProps).toEqual({
        planId: "plan-1",
        category: "Company / Plan Sponsor",
      });
    });
  });

  describe("loading", () => {
    it("shows the access-checking spinner", () => {
      mocks.access = { status: "loading" };
      renderRoute();

      expect(screen.getByText("Checking your access…")).toBeInTheDocument();
    });

    it("does not render the editor or the refusal while loading", () => {
      mocks.access = { status: "loading" };
      renderRoute();

      expect(screen.queryByTestId("edit-benefit")).not.toBeInTheDocument();
      expect(screen.queryByTestId("no-access-notice")).not.toBeInTheDocument();
    });
  });

  describe("denied", () => {
    it("renders the refusal with the denial context", () => {
      mocks.access = {
        status: "denied",
        message: "No access to this section",
        reason: "category_not_assigned",
        denial: {
          organizationName: "Acme Wealth",
          planCompanyName: "Acme Corp",
          requestedCategory: "Group Health",
          assignedCategories: ["Retirement"],
          ownerUserId: "owner-1",
        },
      };
      renderRoute();

      expect(screen.getByTestId("no-access-notice")).toHaveAttribute(
        "data-message",
        "No access to this section",
      );
      expect(mocks.noticeProps).toMatchObject({
        message: "No access to this section",
        reason: "category_not_assigned",
        planId: "plan-1",
        organizationName: "Acme Wealth",
        planCompanyName: "Acme Corp",
        category: "Group Health",
        assignedCategories: ["Retirement"],
        ownerUserId: "owner-1",
      });
    });

    it("prefers the denial's requested category over the URL category", () => {
      mocks.access = {
        status: "denied",
        message: "No access",
        reason: "denied",
        denial: {
          requestedCategory: "Group Life",
          assignedCategories: [],
        },
      };
      setParams("plan-1", "retirement");
      renderRoute();

      expect(mocks.noticeProps.category).toBe("Group Life");
    });

    it("falls back to the URL category when the denial names none", () => {
      mocks.access = {
        status: "denied",
        message: "No access",
        reason: "denied",
        denial: { assignedCategories: ["Retirement"] },
      };
      setParams("plan-1", "group-health");
      renderRoute();

      expect(mocks.noticeProps.category).toBe("Group Health");
    });

    it("defaults the context fields when the denial is absent", () => {
      mocks.access = {
        status: "denied",
        message: "No access",
        reason: "lookup_failed",
      };
      setParams("plan-1", "retirement");
      renderRoute();

      expect(mocks.noticeProps).toMatchObject({
        planId: "plan-1",
        category: "Retirement",
        assignedCategories: [],
      });
      expect(mocks.noticeProps.organizationName).toBeUndefined();
      expect(mocks.noticeProps.planCompanyName).toBeUndefined();
      expect(mocks.noticeProps.ownerUserId).toBeUndefined();
    });

    it("never renders the editor while denied", () => {
      mocks.access = {
        status: "denied",
        message: "No access",
        reason: "denied",
        denial: {},
      };
      renderRoute();

      expect(screen.queryByTestId("edit-benefit")).not.toBeInTheDocument();
      expect(screen.getByTestId("no-access-notice")).toBeInTheDocument();
    });
  });

  describe("allowed", () => {
    it("renders the editor with the decoded inputs", () => {
      setParams("plan-1", "group-health");
      renderRoute();

      expect(screen.getByTestId("edit-benefit")).toHaveAttribute(
        "data-plan-id",
        "plan-1",
      );
      expect(screen.getByTestId("edit-benefit")).toHaveAttribute(
        "data-category",
        "Group Health",
      );
      expect(mocks.editorProps).toEqual({
        planId: "plan-1",
        category: "Group Health",
      });
    });

    it("does not render the refusal or spinner", () => {
      renderRoute();

      expect(screen.queryByTestId("no-access-notice")).not.toBeInTheDocument();
      expect(
        screen.queryByText("Checking your access…"),
      ).not.toBeInTheDocument();
    });

    it("renders the editor for an unknown status after a real answer", () => {
      mocks.access = { status: "something-new" };
      renderRoute();

      expect(screen.getByTestId("edit-benefit")).toBeInTheDocument();
    });
  });

  describe("additional gate cases", () => {
    it("passes a decoded literal slash through unchanged", () => {
      setParams("plan-1", "group%2Fhealth");
      renderRoute();

      expect(mocks.accessInput.category).toBe("group/health");
    });

    it("passes an empty planId through to the hook", () => {
      setParams("", "retirement");
      renderRoute();

      expect(mocks.accessInput).toMatchObject({
        planId: "",
        category: "Retirement",
      });
    });

    it("keeps an empty requestedCategory from the denial", () => {
      mocks.access = {
        status: "denied",
        message: "No access",
        reason: "denied",
        denial: { requestedCategory: "" },
      };
      setParams("plan-1", "retirement");
      renderRoute();

      expect(mocks.noticeProps.category).toBe("");
    });

    it("recomputes the lookup input when the params change", () => {
      const view = renderRoute();
      setParams("plan-2", "group-life");
      view.rerender(<EditBenefitRoute />);

      expect(mocks.accessInput).toMatchObject({
        planId: "plan-2",
        category: "Group Life",
      });
    });
  });
});
