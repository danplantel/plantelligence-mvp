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
  /** Horizontally center the image inside the guide (its current height is kept). */
  onCenter: () => void;
  /** Bring the image's top edge onto the guide's top edge. */
  onAlignTop: () => void;
  /** Bring the image's bottom edge onto the guide's bottom edge. */
  onAlignBottom: () => void;
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
  /**
   * Optional extra button(s) rendered after Auto-size, inside the same button
   * row (e.g. the logo Remove Background action).
   */
  actions?: React.ReactNode;
}

/**
 * Shared Scale slider + alignment/Reset/Auto-size control row used by both image
 * editor modals. Keeps the scale math and button behavior in a single place so
 * fixes (e.g. the Align Center button) don't need to be applied to two files.
 *
 * The three alignment buttons move the artwork, never the frame: the guide is
 * stationary, so each one changes a single axis of the object's position and
 * leaves its scale alone. They are separate callbacks rather than one
 * `onAlign(edge)` so each modal can refresh whatever it tracks after a move
 * (the universal modal also recomputes its previews).
 */
export function ImageEditorControls({
  scale,
  baseScale,
  minScale,
  maxScale,
  onScaleChange,
  onScaleCommit,
  onCenter,
  onAlignTop,
  onAlignBottom,
  onReset,
  onAutoSize,
  disabled = false,
  showScale = true,
  children,
  actions,
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

      {/* flex-wrap: three alignment buttons plus Reset/Auto-size (and, in the
          universal modal, Remove Background) no longer fit one line on a narrow
          modal. Without wrapping the trailing buttons are clipped by the modal's
          `overflow-hidden` wrapper. */}
      <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 md:gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onCenter}
          disabled={disabled}
          title="Center the image horizontally"
          className="flex-1 text-[9px] sm:text-[10px] md:text-xs h-7 sm:h-8 md:h-9 whitespace-nowrap"
        >
          Align Center
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onAlignTop}
          disabled={disabled}
          title="Align the image's top edge with the guide"
          className="flex-1 text-[9px] sm:text-[10px] md:text-xs h-7 sm:h-8 md:h-9 whitespace-nowrap"
        >
          Align Top
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onAlignBottom}
          disabled={disabled}
          title="Align the image's bottom edge with the guide"
          className="flex-1 text-[9px] sm:text-[10px] md:text-xs h-7 sm:h-8 md:h-9 whitespace-nowrap"
        >
          Align Bottom
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          disabled={disabled}
          className="flex-1 text-[9px] sm:text-[10px] md:text-xs h-7 sm:h-8 md:h-9 whitespace-nowrap"
        >
          Reset
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onAutoSize}
          disabled={disabled}
          className="flex-1 text-[9px] sm:text-[10px] md:text-xs h-7 sm:h-8 md:h-9 min-w-[80px] sm:min-w-[90px] md:min-w-[100px] whitespace-nowrap"
        >
          Auto-size
        </Button>
        {actions}
      </div>
    </div>
  );
}
