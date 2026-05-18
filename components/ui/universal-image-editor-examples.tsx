"use client";

import { UniversalImageEditorModal } from "./universal-image-editor-modal";

// Example 1: Headshot for onboarding (replaces HeadshotUploaderModal)
export function HeadshotEditorExample() {
  const handleChange = (value: string, fileName: string) => {};

  const handleRemove = () => {};

  return (
    <UniversalImageEditorModal
      type="headshot"
      onChange={handleChange}
      onRemove={handleRemove}
      placeholder="Upload Headshot"
    />
  );
}

// Example 2: Logo for onboarding (replaces LogoUploaderModal)
export function LogoEditorExample() {
  const handleChange = (value: string, fileName: string) => {};

  const handleRemove = () => {};

  return (
    <UniversalImageEditorModal
      type="logo"
      onChange={handleChange}
      onRemove={handleRemove}
      placeholder="Upload Logo"
    />
  );
}

// Example 3: Logo normalizer (replaces LogoNormalizerModal)
export function LogoNormalizerExample() {
  const handleChange = (value: string, fileName: string) => {};

  const handleRemove = () => {};

  return (
    <UniversalImageEditorModal
      type="normalizer"
      onChange={handleChange}
      onRemove={handleRemove}
      placeholder="Upload Logo"
    />
  );
}

// Example 4: Custom configuration
export function CustomImageEditorExample() {
  const handleChange = (value: string, fileName: string) => {};

  const handleRemove = () => {};

  return (
    <UniversalImageEditorModal
      type="custom"
      customConfig={{
        canvasWidth: 600,
        canvasHeight: 400,
        previewFormats: ["rectangular"],
        previewSizes: {
          rectangular: { width: 400, height: 300 },
        },
        allowFlipping: true,
        allowScaling: true,
        minResolution: 300,
        maxFileSize: 10 * 1024 * 1024,
        acceptedTypes: [".jpg", ".jpeg", ".png", ".webp", ".svg"],
        modalTitle: "Edit Custom Image",
        modalDescription:
          "Upload and edit your custom image with advanced options.",
        buttonText: "Upload Custom Image",
        saveButtonText: "Save Custom Image",
        showFileDetails: true,
        showWarnings: true,
      }}
      onChange={handleChange}
      onRemove={handleRemove}
      placeholder="Upload Custom Image"
    />
  );
}

// Example 5: Multiple preview formats
export function MultiPreviewExample() {
  const handleChange = (value: string, fileName: string) => {};

  const handleRemove = () => {};

  return (
    <UniversalImageEditorModal
      type="custom"
      customConfig={{
        canvasWidth: 500,
        canvasHeight: 500,
        previewFormats: ["circle", "square", "rectangular"],
        previewSizes: {
          circle: { width: 150, height: 150 },
          square: { width: 200, height: 200 },
          rectangular: { width: 300, height: 200 },
        },
        allowFlipping: true,
        allowScaling: true,
        modalTitle: "Edit Multi-Format Image",
        modalDescription:
          "Upload an image and see how it looks in different formats.",
        buttonText: "Upload Image",
        saveButtonText: "Save Image",
      }}
      onChange={handleChange}
      onRemove={handleRemove}
      placeholder="Upload Multi-Format Image"
    />
  );
}

// Example 6: Minimal configuration
export function MinimalImageEditorExample() {
  const handleChange = (value: string, fileName: string) => {};

  const handleRemove = () => {};

  return (
    <UniversalImageEditorModal
      type="custom"
      customConfig={{
        canvasWidth: 300,
        canvasHeight: 300,
        previewFormats: ["rectangular"],
        previewSizes: {
          rectangular: { width: 200, height: 200 },
        },
        allowFlipping: false,
        allowScaling: true,
        modalTitle: "Simple Image Editor",
        modalDescription: "Basic image editing with minimal options.",
        buttonText: "Upload Image",
        saveButtonText: "Save Image",
        showFileDetails: false,
        showWarnings: false,
      }}
      onChange={handleChange}
      onRemove={handleRemove}
      placeholder="Upload Simple Image"
    />
  );
}
