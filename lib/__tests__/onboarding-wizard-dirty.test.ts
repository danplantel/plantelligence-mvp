import { describe, expect, it } from "vitest";

import { hasUnsavedOnboardingWork } from "../onboarding-wizard-dirty";

type Snapshot = Parameters<typeof hasUnsavedOnboardingWork>[0];

/**
 * The real `stepData` is strongly typed per step; these tests intentionally
 * probe arbitrary shapes (arrays, primitives, nulls), so build the snapshot
 * through a single loose helper instead of fighting the production types.
 */
function snapshot(overrides: {
  currentStep?: number;
  isCompleted?: boolean;
  stepData?: Record<string, unknown>;
} = {}): Snapshot {
  return {
    currentStep: 1,
    isCompleted: false,
    stepData: {},
    ...overrides,
  } as unknown as Snapshot;
}

describe("hasUnsavedOnboardingWork", () => {
  it("returns false for a pristine, incomplete wizard", () => {
    expect(hasUnsavedOnboardingWork(snapshot())).toBe(false);
  });

  it("returns true once the user has advanced past step 1", () => {
    expect(
      hasUnsavedOnboardingWork(snapshot({ currentStep: 2 })),
    ).toBe(true);
  });

  it("returns false for a completed wizard even with saved data", () => {
    expect(
      hasUnsavedOnboardingWork(
        snapshot({
          currentStep: 5,
          isCompleted: true,
          stepData: { clientProfile: { name: "Ada" } },
        }),
      ),
    ).toBe(false);
  });

  it("returns true when step data contains non-empty strings", () => {
    expect(
      hasUnsavedOnboardingWork(
        snapshot({ stepData: { clientProfile: { name: "Ada Lovelace" } } }),
      ),
    ).toBe(true);
  });

  it("ignores whitespace-only strings", () => {
    expect(
      hasUnsavedOnboardingWork(
        snapshot({
          stepData: { clientProfile: { name: "   " }, services: [] },
        }),
      ),
    ).toBe(false);
  });

  it("detects content nested in arrays and objects", () => {
    expect(
      hasUnsavedOnboardingWork(
        snapshot({
          stepData: {
            services: {
              selected: [],
              custom: [{ name: "Custom benefit" }],
            },
          },
        }),
      ),
    ).toBe(true);
  });

  it("treats numbers and booleans as meaningful content", () => {
    expect(
      hasUnsavedOnboardingWork(snapshot({ stepData: { teamSize: 5 } })),
    ).toBe(true);

    expect(
      hasUnsavedOnboardingWork(
        snapshot({ stepData: { disclaimers: { accepted: false } } }),
      ),
    ).toBe(true);
  });

  it("ignores null and undefined values", () => {
    expect(
      hasUnsavedOnboardingWork(
        snapshot({
          stepData: {
            clientProfile: null,
            services: undefined,
          },
        }),
      ),
    ).toBe(false);
  });
});
