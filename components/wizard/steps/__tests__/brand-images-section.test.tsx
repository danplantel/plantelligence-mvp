import React from "react";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { BrandImagesData } from "@/types/new-client-wizard";

import { BrandImagesSection } from "@/components/wizard/new-client-steps/sections/brand-images-section";

vi.mock("@/hooks/useBrandingImageUrl", () => ({
  useBrandingImageUrl: () => ({ url: null }),
}));

vi.mock("@/components/ui/modalGallery", () => ({
  ModalGallery: () => null,
}));

vi.mock("@/components/ui/simple-image-editor-modal", () => ({
  SimpleImageEditorModal: () => null,
}));

vi.mock("@/components/ui/brand-image-upload", () => ({
  BrandImageUpload: ({
    slot,
    currentImage,
  }: {
    slot: { key: string; title: string };
    currentImage?: { url?: string };
  }) => (
    <div
      data-testid={`upload-${slot.key}`}
      data-has-image={String(!!currentImage)}
    >
      {slot.title}
    </div>
  ),
}));

const emptyImages: BrandImagesData = {
  header: null,
  thumbnail: null,
  secondaryBanner: null,
  favicon: null,
};

describe("BrandImagesSection", () => {
  it("renders every slot when no visibleSlots filter is supplied", () => {
    render(
      <BrandImagesSection
        brandImages={emptyImages}
        onBrandImagesChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("upload-header")).toBeInTheDocument();
    expect(screen.getByTestId("upload-thumbnail")).toBeInTheDocument();
    expect(screen.getByTestId("upload-secondaryBanner")).toBeInTheDocument();
    expect(screen.getByText("Hero Banner Image")).toBeInTheDocument();
    expect(screen.getByText("Featured Image")).toBeInTheDocument();
    expect(screen.getByText("Page Image Header")).toBeInTheDocument();
  });

  it("renders only the requested slots", () => {
    render(
      <BrandImagesSection
        brandImages={emptyImages}
        onBrandImagesChange={vi.fn()}
        visibleSlots={["header"]}
      />,
    );

    expect(screen.getByTestId("upload-header")).toBeInTheDocument();
    expect(screen.queryByTestId("upload-thumbnail")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("upload-secondaryBanner"),
    ).not.toBeInTheDocument();
  });

  it("tells the upload slot whether an image is already present", () => {
    render(
      <BrandImagesSection
        brandImages={{
          ...emptyImages,
          header: {
            url: "r2/header.jpg",
            fileName: "header.jpg",
          } as never,
        }}
        onBrandImagesChange={vi.fn()}
        visibleSlots={["header"]}
      />,
    );

    expect(screen.getByTestId("upload-header")).toHaveAttribute(
      "data-has-image",
      "true",
    );
  });
});
