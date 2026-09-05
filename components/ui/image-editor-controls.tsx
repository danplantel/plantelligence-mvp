"use client";

import { Button } from "./button";
import { Label } from "./label";
import { Slider } from "./slider";

interface ImageEditorControlsProps {
  /** Current scale applied to the active image object. */
  scale: number;
  /** Base scale the percentage readout is computed against. */
  baseScale: number;
  minScale: number;
  maxScale: number;
  /**
   * Fired while the slider is dragged. Receives the already-computed target
   * scale (`minScale + (percent / 100) * (maxScale - minScale)`). The caller
   * is responsible for applying it to the Fabric object and refreshing its own
   * guideline/preview state.
   */
  onScaleChange: (newScale: number) => void;
  /** Optional callback fired when the user releases the slider thumb. */
  onScaleCommit?: () => void;
  onCenter: () => void;
  onReset: () => void;
  onAutoSize: () => void;
  disabled?: boolean;
  /** Hide the Scale slider (e.g. when a type config disables scaling). */
  showScale?: boolean;
  /**
   * Optional content rendered between the scale slider and the action buttons
   * (e.g. a "Show Guidelines" checkbox).
   */
  children?: React.ReactNode;
}

/**
 * Shared Scale slider + Center/Reset/Auto-size control row used by both image
 * editor modals. Keeps the scale math and button behavior in a single place so
 * fixes (e.g. the Center button) don't need to be applied to two files.
 */
export function ImageEditorControls({
  scale,
  baseScale,
  minScale,
  maxScale,
  onScaleChange,
  onScaleCommit,
  onCenter,
  onReset,
  onAutoSize,
  disabled = false,
  showScale = true,
  children,
}: ImageEditorControlsProps) {
  const range = maxScale - minScale;
  const rangeIsValid = Number.isFinite(range) && range !== 0;
  const percentValue = rangeIsValid
    ? Math.max(0, Math.min(100, ((scale - minScale) / range) * 100))
    : 50;

  return (
    <div className="flex items-center gap-4">
      {showScale && (
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Label className="text-[10px] sm:text-xs md:text-sm">Scale</Label>
          <Slider
            value={[percentValue]}
            onValueChange={([percent]) => {
              const newScale =
                minScale + (percent / 100) * (maxScale - minScale);
              onScaleChange(newScale);
            }}
            onValueCommit={() => onScaleCommit?.()}
            min={0}
            max={100}
            step={0.25}
            className="w-20 sm:w-24 md:w-32"
          />

          <span className="text-[9px] sm:text-[10px] md:text-xs text-muted-foreground w-8 sm:w-10 md:w-12">
            {Math.round((scale / baseScale) * 100)}%
          </span>
        </div>
      )}

      {children}

      <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onCenter}
          disabled={disabled}
          className="flex-1 text-[9px] sm:text-[10px] md:text-xs h-7 sm:h-8 md:h-9"
        >
          Center
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          disabled={disabled}
          className="flex-1 text-[9px] sm:text-[10px] md:text-xs h-7 sm:h-8 md:h-9"
        >
          Reset
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onAutoSize}
          disabled={disabled}
          className="flex-1 text-[9px] sm:text-[10px] md:text-xs h-7 sm:h-8 md:h-9 min-w-[80px] sm:min-w-[90px] md:min-w-[100px]"
        >
          Auto-size
        </Button>
      </div>
    </div>
  );
}
