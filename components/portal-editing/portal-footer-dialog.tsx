"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil } from "lucide-react";

import {
  resolvePortalDisclosureText,
  type PortalDisclosureSectionProps,
} from "@/components/portal-editing/portal-disclosure-section";
import { useOptionalPortalEditing } from "@/components/portal-editing/portal-editing-provider";
import {
  DisclosureFooterEditor,
  type DisclosureEditorMode,
  type FooterBackgroundMode,
} from "@/components/wizard/steps/sections/disclosure-footer-editor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  resolveDefaultDisclosuresText,
  stripDisclaimerCopyright,
} from "@/lib/disclaimer-constants";
import { PORTAL_SECTION_IDS } from "@/lib/portal-editor-sections";
import { parseFooterBackgroundPreference } from "@/lib/portal-footer-color";
import {
  withBenefitDisclosureText,
  withFooterBackground,
  withLandingDisclosureText,
} from "@/lib/portal-disclosures";

export interface PortalFooterDialogProps extends PortalDisclosureSectionProps {
  /**
   * The panel section that should open this dialog on arrival.
   *
   * The portal's blue affordances (the footer band's own "Edit footer", and the
   * "Edit footer" links on My Benefits Team, News & Events and Employee
   * Resources) ask the provider for `PORTAL_SECTION_IDS.disclosure`. Matching that
   * request here means the advisor lands directly in the full-width footer editor
   * instead of having to click a second time.
   */
  sectionId?: string;
  /**
   * Discard the draft from inside the dialog.
   *
   * The Editing Panel's Cancel throws the whole draft away and refetches the saved
   * plan; the dialog's Cancel delegates to that same handler so the footer cannot
   * have a second, weaker idea of what "cancel" means. When the host passes
   * nothing the button still closes the dialog.
   */
  onCancel?: () => void | Promise<void>;
  /**
   * Persist the draft from inside the dialog.
   *
   * The Home panel keeps its own Save bar outside the dialog, so it passes
   * nothing and **Done** simply closes. Panels with no general footer draft
   * (News & Events, My Benefits Team, Employee Resources) pass the plan PUT here,
   * which makes **Done** the save. A rejection keeps the dialog open so the
   * advisor can retry.
   */
  onSave?: () => void | Promise<void>;
}

/**
 * The portal's **footer editor**, as a full-width dialog.
 *
 * The Editing Panel reserves a column on the left and the Comments rail one on
 * the right, so the live footer at the bottom of the page is only a sliver while
 * the panel is open — the words an advisor is editing are impossible to proof.
 * The panel therefore keeps a compact preview card, and the editor opens over the
 * page at full width.
 *
 * The editor itself is Create Client Step 5's
 * [`DisclosureFooterEditor`](../../wizard/steps/sections/disclosure-footer-editor.tsx:67),
 * deliberately: the footer-background choices, "Use Default" / "Add my own", and
 * the textarea embedded inside the *real* footer are the arrangement advisors
 * already know from the wizard. The only difference is that this host writes the
 * portal's `disclaimers` envelope (landing row or `byCategory` row) instead of
 * the wizard store, and nothing reaches the API until the panel's Save.
 */
export function PortalFooterDialog({
  sectionId = PORTAL_SECTION_IDS.disclosure,
  scope = { kind: "landing" },
  value,
  fallbackText = "",
  organizationName,
  companyName,
  brandColor,
  secondaryColor,
  onChange,
  onCancel,
  onSave,
}: PortalFooterDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // Kept above the open handlers so opening can reset it in the same render —
  // otherwise a previous "Use Default" choice flashed beside a custom disclosure.
  const [customModeChosen, setCustomModeChosen] = useState<boolean | null>(
    null,
  );
  const editing = useOptionalPortalEditing();
  const focusRequest = editing?.focusRequest;

  /** Open, re-deriving the radios from the stored disclosure each time. */
  const openEditor = () => {
    setCustomModeChosen(null);
    setOpen(true);
  };

  // The panel was already asked to edit the Disclosure section: open with it.
  useEffect(() => {
    if (!focusRequest?.id || focusRequest.id !== sectionId) return;
    setCustomModeChosen(null);
    setOpen(true);
  }, [focusRequest?.id, focusRequest?.nonce, sectionId]);

  const handleCancel = async () => {
    if (saving) return;
    try {
      await onCancel?.();
    } finally {
      setOpen(false);
    }
  };

  const handleDone = async () => {
    // The plan PUT takes a moment; without this guard the advisor can press Done
    // repeatedly and fire the save (and its toast) once per click.
    if (saving) return;
    if (!onSave) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      await onSave();
      setOpen(false);
    } catch {
      // The host already reported the API error; keep the dialog open so the
      // advisor can retry instead of closing over a rejected draft.
    } finally {
      setSaving(false);
    }
  };

  const isBenefit = scope.kind === "benefit";

  // ── The same editor state Step 5 derives ──
  const defaultText = stripDisclaimerCopyright(
    resolveDefaultDisclosuresText(organizationName, companyName, isBenefit),
  );
  // NOT `stripDisclaimerCopyright` here: that helper `trimEnd()`s, and this value
  // is the controlled textarea on every keystroke — a trailing space would be
  // deleted the moment it is typed. The footer renderer appends the copyright
  // idempotently, so leaving the stored text untouched is safe.
  const editorText = resolvePortalDisclosureText(value, scope, fallbackText);
  // Step 5 leaves BOTH radios unselected when the saved copy is the platform
  // default (its editor is a fresh disclosure being created). The portal is
  // editing a footer that is ALREADY live: an existing disclosure — default or
  // custom — must load into the textarea. So a stored/fallback value selects
  // `default` when it matches the platform copy, `custom` otherwise, and only a
  // genuinely empty footer leaves both radios unselected.
  const derivedMode: DisclosureEditorMode | null = !editorText.trim()
    ? null
    : editorText.trim() === defaultText.trim()
    ? "default"
    : "custom";
  const mode: DisclosureEditorMode | null =
    customModeChosen === null
      ? derivedMode
      : customModeChosen
      ? "custom"
      : "default";

  // The footer background is plan-wide and lives beside the text in the envelope.
  const storedBackground = parseFooterBackgroundPreference(value) ?? {};
  const footerBgMode =
    (storedBackground.mode as FooterBackgroundMode) || "primary";
  const footerBgCustomColor = storedBackground.customColor || "";

  /** One typed character → the next envelope, previewed and queued by the host. */
  const writeText = (next: string) => {
    onChange(
      isBenefit
        ? withBenefitDisclosureText(value, scope.category, next)
        : withLandingDisclosureText(value, next),
    );
  };

  const setBackground = (
    nextMode: FooterBackgroundMode,
    nextCustomColor = footerBgCustomColor,
  ) => {
    onChange(
      withFooterBackground(value, {
        mode: nextMode,
        customColor: nextCustomColor,
      }),
    );
  };

  // ── The compact panel card ──
  const scopeSummary = isBenefit ? (
    <>
      The footer of the{" "}
      <strong className="font-semibold text-gray-900 dark:text-gray-100">
        {scope.label} page
      </strong>{" "}
      only — the band under &ldquo;Have Questions?&rdquo;.
    </>
  ) : (
    <>
      The footer at the bottom of the{" "}
      <strong className="font-semibold text-gray-900 dark:text-gray-100">
        Landing Page, My Benefits Team, News & Events and Employee Resources
      </strong>
      .
    </>
  );

  return (
    <>
      {/* The panel column only carries the section's heading and the way in;
          the footer itself is proof-read in the full-width dialog. */}
      <div className="space-y-3 rounded-lg border bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Footer disclosure
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {scopeSummary}
          </p>
        </div>

        <Button type="button" className="w-full gap-2" onClick={openEditor}>
          <Pencil className="h-4 w-4" />
          Open footer editor
        </Button>
      </div>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          // The overlay / X must not close over an in-flight save.
          if (!next && saving) return;
          setOpen(next);
        }}
      >
        {/* Above the inline Editing Panel (`z-[51]`). The overlay has to rise with
            it, or the panel stays bright above the scrim and reads as clickable. */}
        <DialogContent
          overlayClassName="z-[110]"
          // `m-10`-worth of breathing room on every side (2.5rem each): the dialog
          // is capped 5rem below the viewport height and 5rem inside its width
          // from `sm` up, so the portal stays visible around it. Phones keep 1rem
          // side gutters. `md:w-[…]` deliberately overrides the shared dialog's
          // `md:w-full`, which otherwise made it span the whole viewport again.
          // The content column scrolls; the button bar does not.
          className="z-[110] flex max-h-[calc(100vh-5rem)] w-[calc(100vw-2rem)] max-w-[110rem] flex-col gap-0 overflow-hidden p-0 sm:w-[calc(100vw-5rem)] md:w-[calc(100vw-5rem)]"
        >
          {/* Extra top padding keeps the content below the dialog's own close (X),
              so the X sits above the "Applies to:" row rather than on top of it. */}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-12">
            {/* Radix needs a title/description for screen readers; the visible
                content is Create Client Step 5's disclosure editor. */}
            <DialogHeader className="sr-only">
              <DialogTitle>Footer Disclosure</DialogTitle>
              <DialogDescription>{scopeSummary}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Applies to:
                </span>
                <span className="inline-flex items-center rounded-full bg-[#23919C]/10 px-2 py-0.5 text-[10px] font-semibold text-[#23919C]">
                  {isBenefit
                    ? scope.label
                    : "Landing Page, My Benefits Team, News & Events, Employee Resources"}
                </span>
              </div>

              {/* Create Client Step 5's editor: background choices, then the real
                  footer with the textarea living inside it. */}
              <DisclosureFooterEditor
                footer={isBenefit ? "benefit" : "home"}
                primaryColor={brandColor}
                secondaryColor={secondaryColor}
                footerBgMode={footerBgMode}
                footerBgCustomColor={footerBgCustomColor}
                onFooterBgModeChange={(nextMode) => setBackground(nextMode)}
                onFooterBgCustomColorChange={(nextColor) =>
                  setBackground("custom", nextColor)
                }
                text={mode === null ? "" : editorText}
                onTextChange={writeText}
                mode={mode}
                onModeChange={(nextMode) =>
                  setCustomModeChosen(nextMode === "custom")
                }
                defaultText={defaultText}
                companyName={companyName}
                organizationName={organizationName}
                previewLabel={
                  isBenefit
                    ? `${scope.label} — Employee Portal`
                    : "Landing Page — Employee Portal"
                }
              />
            </div>
          </div>

          {/* Fixed bar: the dialog body scrolls above it. */}
          <DialogFooter className="shrink-0 border-t bg-background px-6 py-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleCancel()}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleDone()}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Done"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
