"use client";

/**
 * "How Can We Help You Today?" — heading only, for now.
 *
 * The three-card body that used to live here (title, optional bold intro, a
 * paragraph and a CTA button) is being redesigned, and its editor counterpart in
 * `components/wizard/benefits-steps/benefits-editor-panel.tsx` has been emptied at
 * the same time so the two sides cannot drift. The new design will be dropped into
 * both. Every portal surface still renders this section, so the heading and its
 * spacing stay exactly where they were.
 *
 * `HelpCardData` and the card/CTA props are kept so the call sites (the four benefit
 * hubs, the custom hub, and the wizard previews) keep compiling unchanged while the
 * body is rebuilt.
 */

export interface HelpCardData {
  id: string;
  title: string;
  introBold?: string;
  paragraphs: string[];
  cta: string;
  href?: string;
}

interface HowCanWeHelpSectionProps {
  brandColor?: string;
  secondaryColor?: string;
  clientId?: string;
  /** Custom cards from the wizard. */
  cards?: HelpCardData[];
  /** Click handler for editing a specific card. Receives the card's ID. */
  onCardEdit?: (cardId: string) => void;
}

export function HowCanWeHelpSection({
  brandColor = "#002B5B",
}: HowCanWeHelpSectionProps) {
  return (
    <section className="bg-white py-16 lg:py-20">
      <h2
        className="mb-14 text-center text-2xl font-dm-serif sm:text-2xl lg:text-5xl"
        style={{ color: brandColor }}
      >
        How Can We Help You Today?
      </h2>
    </section>
  );
}
