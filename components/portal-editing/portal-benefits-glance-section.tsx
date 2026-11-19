"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BrandImageUpload } from "@/components/ui/brand-image-upload";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ModalGallery } from "@/components/ui/modalGallery";
import { SimpleImageEditorModal } from "@/components/ui/simple-image-editor-modal";
import { Textarea } from "@/components/ui/textarea";
import { usePortalEditing } from "@/components/portal-editing/portal-editing-provider";
import { useClientPortal } from "@/contexts/client-portal-context";
import {
  EMPLOYEE_RESOURCES_LANDING_CARD_BODY,
  getDefaultLandingCardBody,
} from "@/lib/landing-card-defaults";
import {
  EMPLOYEE_RESOURCES_LANDING_CARD_BODY_KEY,
  EMPLOYEE_RESOURCES_LANDING_CARD_IMAGE_KEY,
  readEmployeeResourcesLandingCard,
} from "@/lib/employee-resources-landing-card";
import {
  EMPLOYEE_RESOURCES_DEFAULT_BG,
  getCategoryDefaultInnerImageUrl,
} from "@/lib/portal-category-hero-background";
import type { BrandImageData } from "@/types/new-client-wizard";

/**
 * "Your Benefits at a Glance" — the landing page's four cards, edited in place.
 *
 * Each card is drawn from a BENEFIT row (`landingCardImage` / `landingCardBody`),
 * so this section is the portal's copy of Create/Edit Benefit → Step 1 →
 * Branding → "Your Benefits at a Glance Card": one accordion per category, the
 * same two fields, and the category's suggested copy one press away.
 *
 * Four rules shape it:
 *
 *  - **A missing benefit cannot be created from here.** The portal only edits
 *    Benefit rows; creating one is Step 1's job (it seeds the category's default
 *    topics, headings and contacts). So a category with no row gets an explanation
 *    and a link to Create Benefit for that plan + category — an in-app link that
 *    navigates THIS window, because the advisor is going there to build the
 *    benefit, not to compare two screens side by side.
 *  - **These saves are their own.** The panel's Save bar writes the PLAN; these
 *    cards live on Benefit rows, so each one has its own Save, sent with
 *    `?updateOnly=1` (never upsets a row that does not exist, never creates one).
 *  - **Typing previews LIVE**, like every other section of this panel: the draft is
 *    mirrored into the portal's `employeePortalPreview.benefits`, which is what the
 *    cards beside the panel render from. Nothing is written until a card's Save.
 *  - **The image is the same control as the Featured Image.** `BrandImageUpload`
 *    gives Choose File / Choose Default Image while empty, then Edit / New / Delete
 *    once one is set — one uploader, one cropper, no second set of rules.
 */

/**
 * The fifth card's key. It is not a Benefit category, so it never comes from
 * `loadRows`; it is appended from the plan while the hub is published.
 */
const EMPLOYEE_RESOURCES_ROW_KEY = "Employee Resources";

/** The four cards, in the order the landing page draws them. */
const CARD_CATEGORIES = [
  {
    /** Stored Benefit category (what the API addresses). */
    apiCategory: "Retirement",
    /** What the Create Benefit deep link calls it. */
    createCategory: "Retirement",
    /** Fallback label when the plan has no Custom name of its own. */
    fallbackLabel: "Retirement",
  },
  {
    apiCategory: "Group Health",
    createCategory: "Group Health",
    fallbackLabel: "Group Health",
  },
  {
    apiCategory: "Group Life",
    createCategory: "Group Life",
    fallbackLabel: "Group Life",
  },
  {
    apiCategory: "Company / Plan Sponsor",
    // The deep link's alias for the sponsor hub (see `new-benefits/page.tsx`).
    createCategory: "Custom",
    fallbackLabel: "Custom",
  },
] as const;

/** The card's shape, shared with Create/Edit Benefit's own picker (1200×800). */
const CARD_IMAGE_WIDTH = 1200;
const CARD_IMAGE_HEIGHT = 800;

interface GlanceBenefit {
  id: string;
  landingCardImage?: string | null;
  landingCardBody?: string | null;
}

interface GlanceRow {
  apiCategory: string;
  createCategory: string;
  label: string;
  benefit: GlanceBenefit | null;
  /** The fifth hub's card is stored on the PLAN, not on a Benefit row. */
  kind?: "benefit" | "employee-resources";
}

/** One draft per category, holding only the fields the advisor has touched. */
interface CardDraft {
  image?: string | null;
  body?: string;
}

/** The crop editor's subject: one category's image, before it is applied. */
interface EditorTarget {
  apiCategory: string;
  url: string;
  fileName: string;
}

const fetcher = (url: string) => fetch(url).then((response) => response.json());

async function loadRows(
  planId: string,
  customBenefitName: string | null,
): Promise<GlanceRow[]> {
  return Promise.all(
    CARD_CATEGORIES.map(async (entry) => ({
      apiCategory: entry.apiCategory,
      createCategory: entry.createCategory,
      label:
        entry.apiCategory === "Company / Plan Sponsor"
          ? customBenefitName || entry.fallbackLabel
          : entry.fallbackLabel,
      benefit:
        ((await fetcher(
          `/api/clients/${planId}/benefits/${encodeURIComponent(
            entry.apiCategory,
          )}?forPortal=1`,
        ).catch(() => null))?.benefit as GlanceBenefit | undefined) ?? null,
    })),
  );
}

export interface PortalBenefitsGlanceSectionProps {
  /** The plan whose Benefit rows these cards belong to. */
  planId: string;
  /** The advisor's own name for the Custom benefit, when they have named one. */
  customBenefitName?: string | null;
}

export function PortalBenefitsGlanceSection({
  planId,
  customBenefitName = null,
}: PortalBenefitsGlanceSectionProps) {
  const {
    beginSave,
    finishSave,
    failSave,
    saveState,
    refetchPortal,
    patchClientData,
  } = usePortalEditing();
  const { clientData } = useClientPortal();

  const { data: rows, isLoading, mutate } = useSWR(
    planId ? `portal-glance-cards:${planId}:${customBenefitName ?? ""}` : null,
    () => loadRows(planId, customBenefitName),
    { revalidateOnFocus: false },
  );

  const [drafts, setDrafts] = useState<Record<string, CardDraft>>({});
  const [savingCategory, setSavingCategory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Which category's default-image gallery is open. */
  const [galleryCategory, setGalleryCategory] = useState<string | null>(null);
  /** Which category's crop editor is open, and on which image. */
  const [editor, setEditor] = useState<EditorTarget | null>(null);

  /**
   * Mirror a draft onto the live page.
   *
   * The cards beside the panel render from `employeePortalPreview.benefits`, so
   * that is the array to move. Only an EXISTING row is patched: pushing one would
   * conjure a card for a category the plan has no benefit for. A category the
   * mirror has not caught up with simply previews on the next save + refetch.
   */
  const previewCard = useCallback(
    (apiCategory: string, patch: CardDraft) => {
      const current = (clientData as Record<string, any> | null)
        ?.employeePortalPreview;

      // Employee Resources has no Benefit row and no `benefits[]` entry: its
      // draft is the plan's own envelope fields, which is what the card beside
      // the panel reads.
      if (apiCategory === EMPLOYEE_RESOURCES_ROW_KEY) {
        patchClientData({
          employeePortalPreview: {
            ...(current ?? {}),
            ...(patch.image !== undefined
              ? { [EMPLOYEE_RESOURCES_LANDING_CARD_IMAGE_KEY]: patch.image }
              : {}),
            ...(patch.body !== undefined
              ? { [EMPLOYEE_RESOURCES_LANDING_CARD_BODY_KEY]: patch.body }
              : {}),
          },
        });
        return;
      }

      const benefits = Array.isArray(current?.benefits)
        ? [...current.benefits]
        : [];
      const key = apiCategory.trim().toLowerCase();
      const index = benefits.findIndex(
        (entry: any) =>
          String(entry?.category ?? "").trim().toLowerCase() === key,
      );
      if (index < 0) return;

      const next = { ...benefits[index] };
      if (patch.image !== undefined) next.landingCardImage = patch.image;
      if (patch.body !== undefined) next.landingCardBody = patch.body;
      benefits[index] = next;

      patchClientData({
        employeePortalPreview: { ...(current ?? {}), benefits },
      });
    },
    [clientData, patchClientData],
  );

  const patchDraft = useCallback(
    (apiCategory: string, patch: CardDraft) => {
      setDrafts((previous) => ({
        ...previous,
        [apiCategory]: { ...previous[apiCategory], ...patch },
      }));
      // Real time: the card repaints as the advisor types, not on Save.
      previewCard(apiCategory, patch);
    },
    [previewCard],
  );

  /** Save one card: the two fields the landing page reads, nothing else. */
  const saveCard = useCallback(
    async (row: GlanceRow) => {
      const draft = drafts[row.apiCategory] || {};
      setSavingCategory(row.apiCategory);
      setError(null);
      beginSave();
      try {
        // Employee Resources is a PLAN value, not a Benefit row: the two fields
        // ride the portal envelope, merged over what is already stored so the
        // hub's header image and the rest of the JSON stay put.
        const response =
          row.kind === "employee-resources"
            ? await fetch(`/api/clients/${planId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  employeePortalPreview: {
                    ...((clientData as Record<string, any> | null)
                      ?.employeePortalPreview ?? {}),
                    ...(draft.image !== undefined
                      ? {
                          [EMPLOYEE_RESOURCES_LANDING_CARD_IMAGE_KEY]:
                            draft.image,
                        }
                      : {}),
                    ...(draft.body !== undefined
                      ? { [EMPLOYEE_RESOURCES_LANDING_CARD_BODY_KEY]: draft.body }
                      : {}),
                  },
                }),
              })
            : await fetch(
                `/api/clients/${planId}/benefits/${encodeURIComponent(
                  row.apiCategory,
                )}?updateOnly=1`,
                {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  // `undefined` leaves a column untouched; "" clears it. JSON drops
                  // the keys the advisor did not touch, exactly that contract.
                  body: JSON.stringify({
                    landingCardImage: draft.image,
                    landingCardBody: draft.body,
                  }),
                },
              );
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error || "Could not save this card.");
        }

        setDrafts((previous) => {
          const next = { ...previous };
          delete next[row.apiCategory];
          return next;
        });
        finishSave();
        // The saved row is the truth now, and the page beside the panel repaints
        // from the portal read.
        await mutate();
        await refetchPortal();
      } catch (saveFailure) {
        const message =
          saveFailure instanceof Error
            ? saveFailure.message
            : "Could not save this card.";
        setError(message);
        failSave(message);
      } finally {
        setSavingCategory(null);
      }
    },
    [
      beginSave,
      clientData,
      drafts,
      failSave,
      finishSave,
      mutate,
      planId,
      refetchPortal,
    ],
  );

  const saving = savingCategory !== null;
  const busy = saving || saveState === "saving";

  /**
   * The fifth card, when the plan has published the hub.
   *
   * It is appended rather than loaded: there is no Benefit row to read, so its
   * image and copy come from the plan's envelope (see
   * `readEmployeeResourcesLandingCard`). Everything else — the uploader, the
   * suggested text, the per-card Save — is the same control the four cards use.
   */
  const glanceRows = useMemo<GlanceRow[]>(() => {
    const base = rows ?? [];
    const enabled =
      (clientData as { employeeResourcesEnabled?: boolean } | null)
        ?.employeeResourcesEnabled === true;
    if (!enabled) return base;

    const stored = readEmployeeResourcesLandingCard(
      (clientData as Record<string, any> | null)?.employeePortalPreview,
    );
    return [
      ...base,
      {
        apiCategory: EMPLOYEE_RESOURCES_ROW_KEY,
        createCategory: EMPLOYEE_RESOURCES_ROW_KEY,
        label: "Employee Resources",
        kind: "employee-resources",
        benefit: {
          id: "employee-resources",
          // Empty until the advisor picks one, so the uploader reads "Choose
          // Image" and the hint names the bundled default the page is using.
          landingCardImage: stored.image || "",
          landingCardBody: stored.body,
        },
      },
    ];
  }, [rows, clientData]);

  const createHref = useMemo(
    () => (row: GlanceRow) =>
      `/new-benefits?planId=${encodeURIComponent(planId)}&category=${encodeURIComponent(
        row.createCategory,
      )}`,
    [planId],
  );

  if (!planId) return null;

  return (
    <div className="space-y-4">
      <p className="text-[12px] leading-relaxed text-muted-foreground">
        The cards participants click from this page. Each benefit card is a field of
        its benefit, so it is edited here or in{" "}
        <span className="font-semibold">
          Create Benefit / Edit Benefit → Step 1 → Branding → Your Benefits at a
          Glance Card
        </span>
        . The Employee Resources card — shown once that hub is published — has no
        benefit behind it, so its image and text are the plan&rsquo;s own and are
        saved here. A card saves on its own; the panel&rsquo;s Save button writes the
        plan, not the cards.
      </p>

      {isLoading && !rows ? (
        <div className="flex items-center gap-2 rounded-lg border border-muted bg-white p-4 text-[12px] text-muted-foreground dark:bg-gray-800">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Reading this plan&rsquo;s benefits…
        </div>
      ) : (
        <Accordion
          type="multiple"
          className="space-y-2"
          data-testid="glance-cards-accordion"
        >
          {glanceRows.map((row) => {
            const rowId =
              row.kind === "employee-resources"
                ? "employee-resources"
                : row.apiCategory;
            const draft = drafts[row.apiCategory] || {};
            const image =
              draft.image !== undefined
                ? draft.image || ""
                : row.benefit?.landingCardImage || "";
            const body =
              draft.body !== undefined
                ? draft.body
                : row.benefit?.landingCardBody || "";
            const isDirty =
              draft.image !== undefined || draft.body !== undefined;
            const suggested =
              row.kind === "employee-resources"
                ? EMPLOYEE_RESOURCES_LANDING_CARD_BODY
                : getDefaultLandingCardBody(row.apiCategory);
            // The uploader wants a complete `BrandImageData`; only `url` and the
            // filename matter for showing (and re-opening) a saved card image, so
            // the measurements it would carry from a fresh upload are filled with
            // the card's own target size.
            const currentImage: BrandImageData | undefined = image
              ? {
                  url: image,
                  fileName: `card-${row.label}.png`,
                  fileSize: 0,
                  width: CARD_IMAGE_WIDTH,
                  height: CARD_IMAGE_HEIGHT,
                  recommendedSize: `${CARD_IMAGE_WIDTH}×${CARD_IMAGE_HEIGHT}`,
                  status: "ok",
                  warnings: [],
                }
              : undefined;

            return (
              <AccordionItem
                key={rowId}
                value={rowId}
                className="rounded-none border bg-card px-4"
                data-testid={`glance-card-${rowId}`}
              >
                <AccordionTrigger className="py-3 text-left text-sm hover:no-underline">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-semibold">{row.label}</span>
                    {/* "Active" wears the panel's accent colour on a filled chip —
                        `accent-blue-light` is a mode-aware token (pale teal in light,
                        deep teal in dark), so the fill follows the theme; the label
                        flips to white on the dark fill, as the other accent chips do.
                        A category with no benefit yet stays neutral: there is nothing
                        live to point at until one is created. */}
                    <span
                      className={
                        row.benefit
                          ? "shrink-0 rounded-full bg-accent-blue-light px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-blue dark:text-white"
                          : "shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                      }
                    >
                      {row.benefit ? "Active" : "Not created"}
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  {!row.benefit ? (
                    <div className="space-y-2 text-[12px] leading-relaxed text-muted-foreground">
                      <p>
                        This plan has no {row.label} benefit yet, so there is no
                        card to edit — and a card cannot be created from here,
                        because a benefit also brings its own pages, questions and
                        contacts.
                      </p>
                      {/* Same window, on purpose: this link is the way to go
                          and build the benefit. `Link` keeps it a client-side
                          navigation (no `target="_blank"`, no extra tab). */}
                      <Link
                        href={createHref(row)}
                        className="inline-flex items-center gap-1.5 font-semibold text-accent-blue underline"
                      >
                        Create the {row.label} benefit
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* The same uploader the Featured Image uses: Choose File /
                          Choose Default Image while empty, then Edit / New / Delete.
                          Its own crop editor applies the slot's 3:2 frame. */}
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-foreground">
                          Card Image
                        </Label>
                        <BrandImageUpload
                          slotKey={`glance-card-${rowId}`}
                          slot={{
                            // No title: the label above already names the field, and
                            // `BrandImageUpload` skips the heading entirely when the
                            // title is empty.
                            title: "",
                            description: `The photograph on the “${row.label}” card participants click from this page.`,
                            recommendedSize: `${CARD_IMAGE_WIDTH}×${CARD_IMAGE_HEIGHT} px`,
                            accept: ".png,.jpg,.jpeg,.webp",
                            required: false,
                            previewAspectRatio: CARD_IMAGE_WIDTH / CARD_IMAGE_HEIGHT,
                            previewLabel: "Card preview",
                            defaultPhoteButton: true,
                            helperText: `3:2 landscape (${CARD_IMAGE_WIDTH}×${CARD_IMAGE_HEIGHT} px). Left empty, the card uses this category's default image.`,
                          }}
                          currentImage={currentImage}
                          previewObjectFit="cover"
                          onImageChange={(data) =>
                            patchDraft(row.apiCategory, {
                              image: data.url || "",
                            })
                          }
                          onImageRemove={() =>
                            patchDraft(row.apiCategory, { image: "" })
                          }
                          onDefaultPhotoClick={() =>
                            setGalleryCategory(row.apiCategory)
                          }
                          onFileSelect={(data) =>
                            setEditor({
                              apiCategory: row.apiCategory,
                              url: data.url || "",
                              fileName:
                                data.fileName || `card-${row.label}.png`,
                            })
                          }
                          onEditClick={() =>
                            setEditor({
                              apiCategory: row.apiCategory,
                              url: image,
                              fileName: `card-${row.label}.png`,
                            })
                          }
                        />
                        {!image && (
                          <p className="text-[11px] leading-relaxed text-muted-foreground">
                            Showing the {row.label} default image:{" "}
                            <span className="italic">
                              {(row.kind === "employee-resources"
                                ? EMPLOYEE_RESOURCES_DEFAULT_BG
                                : getCategoryDefaultInnerImageUrl(row.apiCategory)
                              )
                                .split("/")
                                .pop()}
                            </span>
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <Label className="text-xs font-bold text-foreground">
                            Card text
                          </Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 px-2 text-[11px]"
                            onClick={() =>
                              patchDraft(row.apiCategory, { body: suggested })
                            }
                          >
                            <Sparkles className="h-3 w-3" />
                            Use the suggested text
                          </Button>
                        </div>
                        <Textarea
                          value={body}
                          rows={4}
                          placeholder={suggested}
                          aria-label={`${row.label} card text`}
                          className="text-sm"
                          onChange={(event) =>
                            patchDraft(row.apiCategory, {
                              body: event.target.value,
                            })
                          }
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Leave this empty and the card falls back to the text above.
                        </p>
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        {error && savingCategory === null && (
                          <span className="mr-auto text-[11px] text-red-500">
                            {error}
                          </span>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          className="h-8"
                          disabled={!isDirty || busy}
                          onClick={() => void saveCard(row)}
                        >
                          {savingCategory === row.apiCategory ? (
                            <>
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              Saving…
                            </>
                          ) : (
                            "Save card"
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {/* The default-image library, one dialog shared by all four cards. Choosing
          an image opens the crown editor so it is framed to the card's 3:2 shape
          before it is applied — the same two steps the Featured Image takes. */}
      <ModalGallery
        open={galleryCategory !== null}
        onOpenChange={(open) => {
          if (!open) setGalleryCategory(null);
        }}
        onSelect={(url) => {
          const apiCategory = galleryCategory;
          setGalleryCategory(null);
          if (!apiCategory) return;
          setEditor({ apiCategory, url, fileName: "card-image.png" });
        }}
      />

      {editor && (
        <SimpleImageEditorModal
          isOpen
          modalTitle="Your Benefits at a Glance Card Image"
          modalDescription={`Frame the image to the card's 3:2 shape (${CARD_IMAGE_WIDTH}×${CARD_IMAGE_HEIGHT} px).`}
          value={editor.url}
          fileName={editor.fileName}
          onChange={(value: string) => {
            const category = editor.apiCategory;
            setEditor(null);
            patchDraft(category, { image: value });
          }}
          onRemove={() => setEditor(null)}
          onClose={() => setEditor(null)}
          saveButtonText="Save Card Image"
          canvasWidth={600}
          canvasHeight={400}
          exportScale={2}
        />
      )}
    </div>
  );
}
