"use client";

import { forwardRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings, RotateCcw } from "lucide-react";
import { useEffect } from "react";

interface BannerOverlaySettingsCardProps {
  backgroundOpacity: number;
  containerBlockOpacity: number;
  containerInverted: boolean;
  backgroundInverted: boolean;
  useGradient: boolean;
  onSettingsChange: (settings: {
    backgroundOpacity?: number;
    containerBlockOpacity?: number;
    containerInverted?: boolean;
    backgroundInverted?: boolean;
    useGradient?: boolean;
  }) => void;
  isHighlighted?: boolean;
}

export const BannerOverlaySettingsCard = forwardRef<
  HTMLDivElement,
  BannerOverlaySettingsCardProps
>(function BannerOverlaySettingsCard(
  {
    backgroundOpacity,
    containerBlockOpacity,
    containerInverted,
    backgroundInverted,
    useGradient,
    onSettingsChange,
    isHighlighted = false,
  },
  ref,
) {
  return (
    <div
      ref={ref}
      className={`transition-all duration-500 grid grid-cols-1 gap-4 ${isHighlighted ? "bg-white ring-2 box-border ring-accent-blue/40 rounded-lg p-4 shadow-sm" : ""
        }`}
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Background Opacity</Label>
          <span className="text-xs text-muted-foreground">
            {Math.round(backgroundOpacity * 100)}%
          </span>
        </div>
        <Slider
          value={[backgroundOpacity]}
          onValueChange={([value]) => {
            onSettingsChange({ backgroundOpacity: value });
          }}
          min={0}
          max={1}
          step={0.01}
          className="w-full"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Container Block Opacity</Label>
          <span className="text-xs text-muted-foreground">
            {Math.round(containerBlockOpacity * 100)}%
          </span>
        </div>
        <Slider
          value={[containerBlockOpacity]}
          onValueChange={([value]) => {
            onSettingsChange({ containerBlockOpacity: value });
          }}
          min={0}
          max={1}
          step={0.01}
          className="w-full"
        />
      </div>

      {/* Invert Container */}
      <div className="flex items-center justify-between">
        <Label className="text-sm">Invert Container</Label>
        <Button
          type="button"
          variant={containerInverted ? "default" : "outline"}
          size="sm"
          onClick={() => {
            onSettingsChange({ containerInverted: !containerInverted });
          }}
          className="flex items-center gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          {containerInverted ? "Inverted" : "Normal"}
        </Button>
      </div>

      {/* Invert Background */}
      <div className="flex items-center justify-between">
        <Label className="text-sm">Invert Background</Label>
        <Button
          type="button"
          variant={backgroundInverted ? "default" : "outline"}
          size="sm"
          onClick={() => {
            onSettingsChange({ backgroundInverted: !backgroundInverted });
          }}
          className="flex items-center gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          {backgroundInverted ? "Inverted" : "Normal"}
        </Button>
      </div>

      {/* Gradient Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <Label className="text-sm">Gradient from Top</Label>
          <p className="text-xs text-muted-foreground">
            Gradient from transparent (top) to opaque (bottom)
          </p>
        </div>
        <Checkbox
          checked={useGradient}
          onCheckedChange={(checked) => {
            onSettingsChange({ useGradient: checked === true });
          }}
        />
      </div>
    </div>
  );
});
