"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Palette, Maximize2 } from "lucide-react";
import { ColorPicker } from "@/components/ui/color-picker";
import { Slider } from "@/components/ui/slider";

interface BrandColorsSectionProps {
  backgroundColor: string;
  /** Brand/default color; when user picks a color different from this, onApply is used (confirmation flow) */
  defaultBrandColor?: string;
  logoScale: number;
  onBackgroundColorChange: (color: string) => void;
  onApply?: (color: string) => void;
  onLogoScaleChange: (scale: number) => void;
  isBackgroundColorPickerOpen: boolean;
  onBackgroundColorPickerOpenChange: (open: boolean) => void;
}

export function BrandColorsSection({
  backgroundColor,
  defaultBrandColor,
  logoScale,
  onBackgroundColorChange,
  onApply,
  onLogoScaleChange,
  isBackgroundColorPickerOpen,
  onBackgroundColorPickerOpenChange,
}: BrandColorsSectionProps) {
  const brand = (defaultBrandColor ?? backgroundColor)?.toLowerCase?.() || "";
  const applyOrConfirm = (color: string) => {
    if (onApply && color?.toLowerCase?.() !== brand) {
      onApply(color);
    } else {
      onBackgroundColorChange(color);
    }
  };
  return (
    <div className="rounded-lg p-4">
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-6 pt-2">
          {/* Background Color */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-gray-600" />
              <Label className="text-sm font-semibold text-gray-900">
                Card Background
              </Label>
            </div>
            <div className="space-y-2 relative">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onBackgroundColorPickerOpenChange(!isBackgroundColorPickerOpen)
                  }
                  className="h-9 px-2.5 border-gray-300 hover:bg-white"
                >
                  <div
                    className="w-5 h-5 rounded border-2 border-white shadow-sm"
                    style={{ background: backgroundColor }}
                  />
                </Button>
                <span className="text-xs font-mono text-gray-600">
                  {backgroundColor}
                </span>
              </div>
              <div className="flex gap-1.5 mt-2">
                {[
                  { name: "White", value: "#ffffff" },
                  { name: "Navy", value: "#1F3A60" },
                  { name: "Dark Gray", value: "#374151" },
                  { name: "Black", value: "#000000" },
                ].map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    className={`w-5 h-5 rounded-full border-2 border-gray-300 shadow-sm transition-transform hover:scale-110 ${backgroundColor === preset.value
                      ? "ring-2 ring-accent-blue ring-offset-1"
                      : ""
                      }`}
                    style={{ backgroundColor: preset.value }}
                    title={preset.name}
                    onClick={() => applyOrConfirm(preset.value)}
                  />
                ))}
              </div>
              <ColorPicker
                value={backgroundColor}
                onChange={onBackgroundColorChange}
                onApply={(c) => applyOrConfirm(c)}
                isOpen={isBackgroundColorPickerOpen}
                onOpenChange={onBackgroundColorPickerOpenChange}
              />
            </div>
          </div>

          {/* Logo Scale */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Maximize2 className="w-4 h-4 text-gray-600" />
              <Label className="text-sm font-semibold text-gray-900">
                Logo Scale
              </Label>
            </div>
            <div className="space-y-4">
              <Slider
                value={[logoScale]}
                onValueChange={([value]) => onLogoScaleChange(value)}
                min={0.5}
                max={2}
                step={0.05}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                <span>0.5x</span>
                <span>{logoScale.toFixed(2)}x</span>
                <span>2.0x</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

