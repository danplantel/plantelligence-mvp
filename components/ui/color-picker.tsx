"use client";

import { useState, useRef, useEffect } from "react";
import { Palette } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  onApply?: (color: string) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  destructive?: boolean;
  title?: string;
}

const solidColors = [
  "#000000",
  "#1F3A60",
  "#6B7280",
  "#E5E7EB",
  "#0F6D66",
  "#2C5F2D",
  "#3A6EA5",
  "#D71E28",
];

function ColorPicker({
  value,
  onChange,
  onApply,
  isOpen,
  onOpenChange,
  destructive = false,
  title,
}: ColorPickerProps) {
  const [customColor, setCustomColor] = useState(value);
  const colorInputRef = useRef<HTMLInputElement>(null);

  // Sync internal customColor when external value changes (e.g. from preset dots)
  useEffect(() => {
    setCustomColor(value);
  }, [value]);

  const handleColorSelect = (color: string) => {
    setCustomColor(color);
    // Immediately apply preset color selections so the consumer sees the
    // change right away.  The old two-step flow (preset → local state only,
    // then "Select Color" to commit) was confusing — users expected the
    // color to update the moment they clicked a preset swatch.
    onChange(color);
  };

  const handleCustomColorChange = (color: string) => {
    setCustomColor(color);
  };

  if (!isOpen) return null;

  return (
    <div className="absolute bottom-full left-0 mb-2 bg-background border border-input rounded-lg shadow-lg z-50 p-4 w-96 max-h-96 overflow-y-auto">
      {title && (
        <h3 className="text-sm font-semibold mb-3">{title}</h3>
      )}
      <div className="space-y-3">
        {/* Preset Colors */}
        <div>
          <h4 className="text-sm font-medium mb-2">Preset Colors</h4>
          <div className="grid grid-cols-8 gap-1.5">
            {solidColors.map((color, index) => (
              <Button
                key={`solid-${index}-${color}`}
                onClick={() => handleColorSelect(color)}
                variant="outline"
                size="sm"
                className={`w-6 h-6 p-0 rounded-full border-2 ${
                  value === color
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-gray-400"
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        {/* Custom Color */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Custom Color</h4>
          <div className="flex items-center space-x-2">
            <Input
              type="text"
              value={customColor}
              onChange={(e) => handleCustomColorChange(e.target.value)}
              placeholder="#1F3A60"
              className="flex-1"
            />
            <input
              type="color"
              value={customColor}
              onChange={(e) => handleCustomColorChange(e.target.value)}
              className="w-10 h-10 border rounded cursor-pointer"
              ref={colorInputRef}
            />
          </div>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="px-0 text-primary font-medium"
            onClick={() => colorInputRef.current?.click()}
          >
            Color Selector
          </Button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-2 mt-4 pt-4 border-t">
        <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">
          Cancel
        </Button>
        <Button
          onClick={() => {
            if (onApply) {
              onApply(customColor);
            } else {
              onChange(customColor);
            }
            onOpenChange(false);
          }}
          className="bg-accent-blue hover:bg-accent-blue/90"
          size="sm"
        >
          Select Color
        </Button>
      </div>
    </div>
  );
}

export { ColorPicker };
