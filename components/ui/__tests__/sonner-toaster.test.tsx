import React from "react";

import { act, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "../sonner";

/**
 * Sonner takes a `theme` PROP and stamps its own `data-theme` on the list, so it
 * cannot read the `.dark` class the portal layout strips. The toaster therefore
 * follows the class the page is actually rendered with — otherwise the dashboard
 * preference painted dark confirmations over a light portal.
 */
const captured = vi.hoisted(() => ({
  props: [] as Record<string, unknown>[],
}));

// next-themes reports the ADVISOR'S stored preference, which stays "dark" even
// while a portal page is rendered light.
vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "dark" }) }));

vi.mock("sonner", () => ({
  Toaster: (props: Record<string, unknown>) => {
    captured.props.push(props);
    return null;
  },
}));

function lastTheme(): unknown {
  return captured.props[captured.props.length - 1]?.theme;
}

afterEach(() => {
  document.documentElement.classList.remove("dark");
  captured.props.length = 0;
});

describe("Toaster theme", () => {
  it("uses light confirmations on a light page, whatever next-themes says", () => {
    render(<Toaster />);

    expect(lastTheme()).toBe("light");
  });

  it("keeps the dashboard's dark theme while <html> is dark", async () => {
    document.documentElement.classList.add("dark");
    render(<Toaster />);

    await waitFor(() => expect(lastTheme()).toBe("dark"));
  });

  it("goes back to light when a portal page strips the class", async () => {
    document.documentElement.classList.add("dark");
    render(<Toaster />);
    await waitFor(() => expect(lastTheme()).toBe("dark"));

    // What the portal layout does on mount, and what it undoes on the way out.
    await act(async () => {
      document.documentElement.classList.remove("dark");
    });
    await waitFor(() => expect(lastTheme()).toBe("light"));

    await act(async () => {
      document.documentElement.classList.add("dark");
    });
    await waitFor(() => expect(lastTheme()).toBe("dark"));
  });
});
