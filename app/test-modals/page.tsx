"use client";

import { useState } from "react";
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function TestModalsPage() {
  const [headshot, setHeadshot] = useState<string>("");
  const [headshotFileName, setHeadshotFileName] = useState<string>("");
  const [logo, setLogo] = useState<string>("");
  const [logoFileName, setLogoFileName] = useState<string>("");
  const [normalizedLogo, setNormalizedLogo] = useState<string>("");
  const [normalizedLogoFileName, setNormalizedLogoFileName] =
    useState<string>("");
  const [customImage, setCustomImage] = useState<string>("");
  const [customImageFileName, setCustomImageFileName] = useState<string>("");

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">
          Universal Image Editor Modal - Test Page
        </h1>
        <p className="text-gray-600">Testing a universal image editing tool</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Headshot Modal Test */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="outline">type=&quot;headshot&quot;</Badge>
              Headshot Editor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Headshot Upload</label>
              <UniversalImageEditorModal
                type="headshot"
                value={headshot}
                fileName={headshotFileName}
                onChange={(value, fileName) => {
                  setHeadshot(value);
                  setHeadshotFileName(fileName);
                }}
                onRemove={() => {
                  setHeadshot("");
                  setHeadshotFileName("");
                }}
                placeholder="Upload Headshot"
              />
            </div>

            {headshot && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Preview</label>
                <div className="flex gap-4">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-gray-300">
                    <img
                      src={headshot}
                      alt="Headshot"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="w-20 h-20 rounded-lg overflow-hidden border-2 border-gray-300">
                    <img
                      src={headshot}
                      alt="Headshot Square"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  File: {headshotFileName}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Logo Modal Test */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="outline">type=&quot;logo&quot;</Badge>
              Logo Editor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Logo Upload</label>
              <UniversalImageEditorModal
                type="logo"
                value={logo}
                fileName={logoFileName}
                onChange={(value, fileName) => {
                  setLogo(value);
                  setLogoFileName(fileName);
                }}
                onRemove={() => {
                  setLogo("");
                  setLogoFileName("");
                }}
                placeholder="Upload Logo"
              />
            </div>

            {logo && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Preview</label>
                <div className="w-32 h-24 rounded-lg overflow-hidden border-2 border-gray-300">
                  <img
                    src={logo}
                    alt="Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <p className="text-xs text-gray-500">File: {logoFileName}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Logo Normalizer Test */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="outline">type=&quot;normalizer&quot;</Badge>
              Logo Normalizer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Logo Normalizer</label>
              <UniversalImageEditorModal
                type="normalizer"
                value={normalizedLogo}
                fileName={normalizedLogoFileName}
                onChange={(value, fileName) => {
                  setNormalizedLogo(value);
                  setNormalizedLogoFileName(fileName);
                }}
                onRemove={() => {
                  setNormalizedLogo("");
                  setNormalizedLogoFileName("");
                }}
                placeholder="Upload Logo for Normalization"
              />
            </div>

            {normalizedLogo && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Normalized Preview
                </label>
                <div className="w-32 h-24 rounded-lg overflow-hidden border-2 border-gray-300">
                  <img
                    src={normalizedLogo}
                    alt="Normalized Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  File: {normalizedLogoFileName}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Custom Modal Test */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="outline">type=&quot;custom&quot;</Badge>
              Custom Image Editor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Custom Image Upload</label>
              <UniversalImageEditorModal
                type="custom"
                customConfig={{
                  canvasWidth: 500,
                  canvasHeight: 400,
                  previewFormats: ["rectangular"],
                  previewSizes: {
                    rectangular: { width: 300, height: 200 },
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
                value={customImage}
                fileName={customImageFileName}
                onChange={(value, fileName) => {
                  setCustomImage(value);
                  setCustomImageFileName(fileName);
                }}
                onRemove={() => {
                  setCustomImage("");
                  setCustomImageFileName("");
                }}
                placeholder="Upload Custom Image"
              />
            </div>

            {customImage && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Custom Preview</label>
                <div className="w-32 h-24 rounded-lg overflow-hidden border-2 border-gray-300">
                  <img
                    src={customImage}
                    alt="Custom Image"
                    className="w-full h-full object-contain"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  File: {customImageFileName}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Multi-Format Test */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Badge variant="outline">Multi-Format</Badge>
            Multi-Format Image Editor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Multi-Format Image Upload
            </label>
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
                buttonText: "Upload Multi-Format Image",
                saveButtonText: "Save Multi-Format Image",
              }}
              onChange={(value, fileName) => {
                
              }}
              onRemove={() => {
              }}
              placeholder="Upload Multi-Format Image"
            />
          </div>
        </CardContent>
      </Card>

      {/* Minimal Test */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Badge variant="outline">Minimal</Badge>
            Minimal Image Editor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Minimal Image Upload</label>
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
                buttonText: "Upload Simple Image",
                saveButtonText: "Save Simple Image",
                showFileDetails: false,
                showWarnings: false,
              }}
              onChange={(value, fileName) => {
                
              }}
              onRemove={() => {
              }}
              placeholder="Upload Simple Image"
            />
          </div>
        </CardContent>
      </Card>

      {/* Reset All Button */}
      <div className="flex justify-center">
        <Button
          variant="outline"
          onClick={() => {
            setHeadshot("");
            setHeadshotFileName("");
            setLogo("");
            setLogoFileName("");
            setNormalizedLogo("");
            setNormalizedLogoFileName("");
            setCustomImage("");
            setCustomImageFileName("");
          }}
        >
          Reset All
        </Button>
      </div>
    </div>
  );
}
