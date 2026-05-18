"use client";

import { Palette } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  SummaryBrandingSectionProps,
  defaultBrandColor,
} from "./summary-branding-section.funcs";

export function SummaryBrandingSection({
  brandColor = defaultBrandColor,
}: SummaryBrandingSectionProps) {
  return (
    <div className="space-y-3 px-4">
      <div className="flex items-center gap-2 mb-3">
        <Palette className="w-4 h-4" />
        <h3 className="font-semibold text-base">Branding</h3>
      </div>
      <div>
        <label className="font-medium text-muted-foreground text-sm">
          Brand Color
        </label>
        <div className="flex items-center space-x-3 mt-1">
          <button
            className="flex justify-center items-center border rounded w-12 h-12 cursor-default"
            style={{
              background: brandColor,
            }}
          >
            <div className="border border-white/20 rounded w-6 h-6" />
          </button>
          <Input
            type="text"
            value={brandColor}
            placeholder="#1F3A60"
            className="flex-1"
            readOnly
          />
        </div>
      </div>
    </div>
  );
}
