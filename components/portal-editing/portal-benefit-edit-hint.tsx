"use client";

import { Info } from "lucide-react";

import { useOptionalPortalEditing } from "@/components/portal-editing/portal-editing-provider";

export interface PortalBenefitEditHintProps {
  /** The benefit this card stands for, so the message can name it. */
  benefitName?: string;
}

/**
 * The hover note on a "Your Benefits at a Glance" card.
 *
 * Those cards are NOT part of the Landing Page's own panel — each one is drawn
 * from a Benefit row, so its image, title and copy are edited on the dashboard at
 * Create Benefit / Edit Benefit → Branding → Your Benefits at a Glance Card.
 * Without saying so, an advisor opens the panel, finds no card controls, and
 * assumes the card is
 * broken; the note is the answer to "where do I change this?" placed exactly where
 * the question is asked.
 *
 * It renders only for someone who may edit the portal, and it never intercepts
 * the click that opens the benefit's hub.
 */
export function PortalBenefitEditHint({
  benefitName,
}: PortalBenefitEditHintProps) {
  const editing = useOptionalPortalEditing();
  if (!editing?.canEdit) return null;

  const name = (benefitName || "").trim() || "This card";

  return (
    <div
      data-testid="benefit-edit-hint"
      // Informational only, and the card underneath must stay clickable.
      aria-hidden
      className="pointer-events-none absolute inset-x-2 bottom-2 z-20 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100"
    >
      <p className="flex items-start gap-1.5 rounded-lg bg-gray-900/90 px-2.5 py-2 text-left font-red-hat text-[11px] leading-snug text-white shadow-lg">
        <Info className="mt-px h-3 w-3 shrink-0" />
        <span>
          <span className="font-semibold">{name}</span> is edited on the dashboard,
          not from this panel — open Create Benefit or Edit Benefit →{" "}
          <span className="font-semibold">
            Branding → Your Benefits at a Glance Card
          </span>{" "}
          for
          this benefit to change the image, title and copy in &ldquo;Your Benefits
          at a Glance&rdquo;.
        </span>
      </p>
    </div>
  );
}
