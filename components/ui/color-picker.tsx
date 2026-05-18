"use client";

import { useState, useRef, useEffect } from "react";
import { Palette, Layers } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  onApply?: (color: string) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  destructive?: boolean;
}

const solidColors = [
  "#000000",
  "#1F3A60",
  "#6B7280",
  "#E5E7EB",
  "#FFFFFF",
  "#1CA5A8",
  "#2E7D32",
  "#F2994A",
  "#FFD700",
  "#6C5CE7",
  "#C0392B",
  "#5DADE2",
  "#2C3E50",
];

const gradientOptions = [
  {
    id: "gradient1",
    name: "Blue Anchor",
    value: "linear-gradient(135deg, #1F3A60 0%, #1F3A60 100%)",
  },
  {
    id: "gradient2",
    name: "Deep Marine",
    value: "linear-gradient(135deg, #2C3E50 0%, #00695C 100%)",
  },
  {
    id: "gradient3",
    name: "Trustwave",
    value: "linear-gradient(135deg, #1F3A60 0%, #5DADE2 100%)",
  },
  {
    id: "gradient4",
    name: "Slate → Teal",
    value: "linear-gradient(135deg, #34495E 0%, #1CA5A8 100%)",
  },
  {
    id: "gradient5",
    name: "Executive Night",
    value: "linear-gradient(135deg, #1F3A60 0%, #2C3E50 50%, #34495E 100%)",
  },
  {
    id: "gradient6",
    name: "Growth Focus",
    value: "linear-gradient(135deg, #00695C 0%, #2E7D32 100%)",
  },
  {
    id: "gradient7",
    name: "Calm Metric",
    value: "linear-gradient(135deg, #E5E7EB 0%, #6B7280 100%)",
  },
  {
    id: "gradient8",
    name: "Blue → Purple",
    value: "linear-gradient(135deg, #1F3A60 0%, #6C5CE7 100%)",
  },
  {
    id: "gradient9",
    name: "Taupe → Beige",
    value: "linear-gradient(135deg, #8B8589 0%, #F5DEB3 100%)",
  },
  {
    id: "gradient10",
    name: "Executive Red",
    value: "linear-gradient(135deg, #C0392B 0%, #6C5CE7 100%)",
  },
];

function ColorPicker({
  value,
  onChange,
  onApply,
  isOpen,
  onOpenChange,
  destructive = false,
}: ColorPickerProps) {
  const [activeTab, setActiveTab] = useState<"solid" | "gradient">("solid");
  const [customColor, setCustomColor] = useState(value);
  const [customGradient, setCustomGradient] = useState(value);
  const [gradientColors, setGradientColors] = useState<
    { color: string; position: number }[]
  >([
    { color: "#667eea", position: 0 },
    { color: "#764ba2", position: 100 },
  ]);
  const [gradientDirection, setGradientDirection] = useState("135deg");

  const isGradient = value.includes("gradient");
  const colorInputRef = useRef<HTMLInputElement>(null);

  // Sync internal customColor when external value changes (e.g. from preset dots)
  useEffect(() => {
    setCustomColor(value);
  }, [value]);

  const handleColorSelect = (color: string) => {
    setCustomColor(color);
  };

  const handleCustomColorChange = (color: string) => {
    setCustomColor(color);
  };

  const handleCustomGradientChange = (gradient: string) => {
    setCustomGradient(gradient);
  };

  const addGradientColor = () => {
    if (gradientColors.length < 4) {
      const newColor = { color: "#000000", position: 50 };
      const newColors = [...gradientColors, newColor];
      setGradientColors(newColors);
      // Auto-apply gradient
      const sortedColors = [...newColors].sort(
        (a, b) => a.position - b.position,
      );
      const gradientString = `linear-gradient(${gradientDirection}, ${sortedColors
        .map((c) => `${c.color} ${c.position}%`)
        .join(", ")})`;
      setCustomGradient(gradientString);
    }
  };

  const removeGradientColor = (index: number) => {
    if (gradientColors.length > 2) {
      const newColors = gradientColors.filter((_, i) => i !== index);
      setGradientColors(newColors);
      // Regenerate gradient with remaining colors
      const sortedColors = [...newColors].sort(
        (a, b) => a.position - b.position,
      );
      const gradientString = `linear-gradient(${gradientDirection}, ${sortedColors
        .map((c) => `${c.color} ${c.position}%`)
        .join(", ")})`;
      setCustomGradient(gradientString);
    }
  };

  const updateGradientColor = (index: number, color: string) => {
    const newColors = [...gradientColors];
    newColors[index].color = color;
    setGradientColors(newColors);
    // Auto-apply gradient
    const sortedColors = [...newColors].sort((a, b) => a.position - b.position);
    const gradientString = `linear-gradient(${gradientDirection}, ${sortedColors
      .map((c) => `${c.color} ${c.position}%`)
      .join(", ")})`;
    setCustomGradient(gradientString);
  };

  const updateGradientPosition = (index: number, position: number) => {
    const newColors = [...gradientColors];
    newColors[index].position = Math.max(0, Math.min(100, position));
    setGradientColors(newColors);
    // Auto-apply gradient
    const sortedColors = [...newColors].sort((a, b) => a.position - b.position);
    const gradientString = `linear-gradient(${gradientDirection}, ${sortedColors
      .map((c) => `${c.color} ${c.position}%`)
      .join(", ")})`;
    setCustomGradient(gradientString);
  };

  if (!isOpen) return null;

  return (
    <div
      className={`absolute top-full left-0 mt-2 bg-background border border-input rounded-lg shadow-lg z-50 p-4 ${
        activeTab === "gradient" ? "w-[32rem]" : "w-96"
      }`}
    >
      {/* Tabs */}
      <div className="flex space-x-1 mb-4">
        <Button
          variant={activeTab === "solid" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("solid")}
          className={`flex items-center space-x-2 ${
            activeTab === "solid" ? "bg-accent-blue" : ""
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>Solid</span>
        </Button>
        <Button
          variant={activeTab === "gradient" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("gradient")}
          className={`flex items-center space-x-2 ${
            activeTab === "gradient" ? "bg-accent-blue" : ""
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Gradient</span>
        </Button>
      </div>

      {/* Content */}
      {activeTab === "solid" ? (
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
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            {/* Left Column - Preset Gradients & Manual Input */}
            <div className="space-y-3">
              {/* Preset Gradients */}
              <div>
                <h4 className="text-sm font-medium mb-2">Preset Gradients</h4>
                <div className="grid grid-cols-2 gap-1.5">
                  {gradientOptions.map((gradient) => (
                    <Button
                      key={gradient.id}
                      onClick={() => handleColorSelect(gradient.value)}
                      variant="outline"
                      size="sm"
                      className={`p-2 h-auto ${
                        value === gradient.value
                          ? "border-primary"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="w-full">
                        <div
                          className="w-full h-5 rounded mb-1"
                          style={{ background: gradient.value }}
                        />
                        <p className="text-xs text-center">{gradient.name}</p>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Manual Input */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Manual Input</h4>
                <Input
                  type="text"
                  value={customGradient}
                  onChange={(e) => handleCustomGradientChange(e.target.value)}
                  placeholder="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                />
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-muted-foreground">
                    Preview:
                  </span>
                  <div
                    className="w-12 h-6 border rounded"
                    style={{ background: customGradient }}
                  />
                </div>
              </div>
            </div>

            {/* Right Column - Gradient Builder */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Gradient Builder</h4>

              {/* Direction */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">
                  Direction
                </label>
                <select
                  value={gradientDirection}
                  onChange={(e) => {
                    setGradientDirection(e.target.value);
                    // Auto-apply gradient
                    const sortedColors = [...gradientColors].sort(
                      (a, b) => a.position - b.position,
                    );
                    const gradientString = `linear-gradient(${
                      e.target.value
                    }, ${sortedColors
                      .map((c) => `${c.color} ${c.position}%`)
                      .join(", ")})`;
                    setCustomGradient(gradientString);
                  }}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
                >
                  <option value="0deg">Top to Bottom</option>
                  <option value="90deg">Left to Right</option>
                  <option value="135deg">Top-Left to Bottom-Right</option>
                  <option value="45deg">Top-Right to Bottom-Left</option>
                  <option value="180deg">Bottom to Top</option>
                  <option value="270deg">Right to Left</option>
                </select>
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Preview</label>
                <div
                  className="w-full h-8 border rounded"
                  style={{
                    background: `linear-gradient(${gradientDirection}, ${gradientColors
                      .map((c) => `${c.color} ${c.position}%`)
                      .join(", ")})`,
                  }}
                />
              </div>

              {/* Color Stops */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground">
                    Color Stops
                  </label>
                  <span className="text-xs text-muted-foreground">
                    {gradientColors.length}/4 colors (min: 2)
                  </span>
                </div>
                <div className="space-y-1.5">
                  {gradientColors.map((colorStop, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={colorStop.color}
                        onChange={(e) =>
                          updateGradientColor(index, e.target.value)
                        }
                        className="w-5 h-5 border rounded cursor-pointer flex-shrink-0"
                      />
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={colorStop.position}
                        onChange={(e) =>
                          updateGradientPosition(
                            index,
                            parseInt(e.target.value),
                          )
                        }
                        className="flex-1"
                      />
                      <span className="text-xs w-5 text-center flex-shrink-0">
                        {colorStop.position}%
                      </span>
                      {gradientColors.length > 2 ? (
                        <Button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            removeGradientColor(index);
                          }}
                          variant="outline"
                          size="sm"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs flex-shrink-0 w-5 h-5 p-0 rounded-full"
                          title="Remove color"
                        >
                          ×
                        </Button>
                      ) : (
                        <div
                          className="text-gray-300 text-xs flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                          title="Cannot remove - minimum 2 colors required"
                        >
                          ×
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  onClick={addGradientColor}
                  variant="outline"
                  className="w-full border-dashed"
                  size="sm"
                  disabled={gradientColors.length >= 4}
                >
                  {gradientColors.length >= 4 ? "Max 4 colors" : "+ Add Color"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}

      <div className="flex justify-end space-x-2 mt-4 pt-4 border-t">
        <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">
          Cancel
        </Button>
        <Button
          onClick={() => {
            const colorToApply = activeTab === "solid" ? customColor : customGradient;
            if (onApply) {
              onApply(colorToApply);
            } else {
              onChange(colorToApply);
            }
            onOpenChange(false);
          }}
          className="bg-accent-blue hover:bg-accent-blue/90"
          size="sm"
        >
          Apply
        </Button>
      </div>
    </div>
  );
}

export { ColorPicker };
