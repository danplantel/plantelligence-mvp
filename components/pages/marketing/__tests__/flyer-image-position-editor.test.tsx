import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FlyerImagePositionEditor } from "../flyer-image-position-editor";

function canvas(container: HTMLElement): HTMLElement {
  const element = container.querySelector<HTMLElement>(
    'div[style*="touch-action: none"]',
  );
  if (!element) throw new Error("Image canvas not found");
  return element;
}

function screenArea(container: HTMLElement): HTMLElement {
  const element = Array.from(container.querySelectorAll<HTMLElement>("div")).find(
    (el) => el.style.width === "320px" && el.style.height !== "",
  );
  if (!element) throw new Error("Screen area not found");
  return element;
}

function drag(
  element: HTMLElement,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  fireEvent.pointerDown(element, { pointerId: 1, clientX: from.x, clientY: from.y });
  fireEvent.pointerMove(element, { pointerId: 1, clientX: to.x, clientY: to.y });
  fireEvent.pointerUp(element, { pointerId: 1, clientX: to.x, clientY: to.y });
}

beforeEach(() => {
  // jsdom does not implement pointer capture.
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("FlyerImagePositionEditor", () => {
  it("shows the placeholder and disables Reset without an image", () => {
    render(<FlyerImagePositionEditor position={{ x: 50, y: 50 }} onPositionChange={vi.fn()} />);

    expect(screen.getByText("No custom image")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
    expect(screen.queryByAltText("Flyer header preview")).not.toBeInTheDocument();
  });

  it("renders the image at the supplied focal point", () => {
    render(
      <FlyerImagePositionEditor
        imageUrl="https://cdn.example/photo.png"
        position={{ x: 25, y: 75 }}
        onPositionChange={vi.fn()}
      />,
    );

    const image = screen.getByAltText("Flyer header preview");
    expect(image).toHaveAttribute("src", "https://cdn.example/photo.png");
    expect(image).toHaveStyle({ objectPosition: "25% 75%" });
    expect(screen.getByText("X: 25.0%")).toBeInTheDocument();
    expect(screen.getByText("Y: 75.0%")).toBeInTheDocument();
    expect(screen.getByText("Drag to reposition")).toBeInTheDocument();
  });

  it("resets the focal point to the center", () => {
    const onPositionChange = vi.fn();
    render(
      <FlyerImagePositionEditor
        imageUrl="https://cdn.example/photo.png"
        position={{ x: 10, y: 90 }}
        onPositionChange={onPositionChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(onPositionChange).toHaveBeenCalledWith({ x: 50, y: 50 });
  });

  it("moves the focal point opposite to the drag direction", () => {
    const onPositionChange = vi.fn();
    const { container } = render(
      <FlyerImagePositionEditor
        imageUrl="https://cdn.example/photo.png"
        position={{ x: 50, y: 50 }}
        onPositionChange={onPositionChange}
      />,
    );

    drag(canvas(container), { x: 100, y: 100 }, { x: 125, y: 75 });

    expect(onPositionChange).toHaveBeenCalledWith({ x: 40, y: 60 });
  });

  it("rounds the focal point to one decimal place", () => {
    const onPositionChange = vi.fn();
    const { container } = render(
      <FlyerImagePositionEditor
        imageUrl="https://cdn.example/photo.png"
        position={{ x: 50, y: 50 }}
        onPositionChange={onPositionChange}
      />,
    );

    drag(canvas(container), { x: 0, y: 0 }, { x: 3, y: 7 });

    expect(onPositionChange).toHaveBeenCalledWith({ x: 48.8, y: 47.2 });
  });

  it("clamps the focal point to the 0-100 range", () => {
    const onPositionChange = vi.fn();
    const { container } = render(
      <FlyerImagePositionEditor
        imageUrl="https://cdn.example/photo.png"
        position={{ x: 50, y: 50 }}
        onPositionChange={onPositionChange}
      />,
    );

    drag(canvas(container), { x: 0, y: 0 }, { x: 1000, y: 1000 });
    expect(onPositionChange).toHaveBeenLastCalledWith({ x: 0, y: 0 });

    drag(canvas(container), { x: 0, y: 0 }, { x: -1000, y: -1000 });
    expect(onPositionChange).toHaveBeenLastCalledWith({ x: 100, y: 100 });
  });

  it("ignores drags when no image is available", () => {
    const onPositionChange = vi.fn();
    const { container } = render(
      <FlyerImagePositionEditor position={{ x: 50, y: 50 }} onPositionChange={onPositionChange} />,
    );

    drag(canvas(container), { x: 0, y: 0 }, { x: 50, y: 50 });

    expect(onPositionChange).not.toHaveBeenCalled();
  });

  it("ignores drags when disabled", () => {
    const onPositionChange = vi.fn();
    const { container } = render(
      <FlyerImagePositionEditor
        imageUrl="https://cdn.example/photo.png"
        position={{ x: 50, y: 50 }}
        onPositionChange={onPositionChange}
        disabled
      />,
    );

    drag(canvas(container), { x: 0, y: 0 }, { x: 50, y: 50 });

    expect(onPositionChange).not.toHaveBeenCalled();
    expect(screen.getByText("No custom image")).toBeInTheDocument();
  });

  it("stops tracking after the pointer leaves the canvas", () => {
    const onPositionChange = vi.fn();
    const { container } = render(
      <FlyerImagePositionEditor
        imageUrl="https://cdn.example/photo.png"
        position={{ x: 50, y: 50 }}
        onPositionChange={onPositionChange}
      />,
    );

    const element = canvas(container);
    fireEvent.pointerDown(element, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerLeave(element, { pointerId: 1 });
    fireEvent.pointerMove(element, { pointerId: 1, clientX: 50, clientY: 50 });

    expect(onPositionChange).not.toHaveBeenCalled();
  });

  it("derives the canvas height from the aspect ratio", () => {
    const { container, unmount } = render(
      <FlyerImagePositionEditor
        imageUrl="https://cdn.example/photo.png"
        position={{ x: 50, y: 50 }}
        onPositionChange={vi.fn()}
        aspectRatio={2}
      />,
    );
    expect(screenArea(container).style.height).toBe("160px");
    unmount();

    const { container: tall } = render(
      <FlyerImagePositionEditor
        imageUrl="https://cdn.example/photo.png"
        position={{ x: 50, y: 50 }}
        onPositionChange={vi.fn()}
        aspectRatio={10}
      />,
    );
    expect(screenArea(tall).style.height).toBe("80px");
  });

  it("falls back to the 16:9 canvas when the aspect ratio is invalid", () => {
    const { container } = render(
      <FlyerImagePositionEditor
        imageUrl="https://cdn.example/photo.png"
        position={{ x: 50, y: 50 }}
        onPositionChange={vi.fn()}
        aspectRatio={0}
      />,
    );

    expect(screenArea(container).style.height).toBe("180px");
  });
});
