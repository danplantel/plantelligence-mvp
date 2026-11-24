"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";

import { PortalEditorActionBar } from "@/components/portal-editing/portal-editor-action-bar";
import { PortalEditorShell } from "@/components/portal-editing/portal-editor-shell";
import { usePortalDirtyReport } from "@/components/portal-editing/portal-draft-badge";
import { usePortalAutosave } from "@/components/portal-editing/use-portal-autosave";
import { PortalEmployeeResourcesVisibilityToggle } from "@/components/portal-editing/portal-employee-resources-visibility-toggle";
import { PortalFooterSection } from "@/components/portal-editing/portal-footer-section";
import { brandImagesFromClient } from "@/components/portal-editing/portal-brand-images";
import { SectionHeader } from "@/components/wizard/new-client-steps/sections/components/editor-panel-wrapper";
import { BrandImagesSection } from "@/components/wizard/new-client-steps/sections/brand-images-section";
import { TypographySection } from "@/components/wizard/new-client-steps/sections/typography-section";
import {
  normalizeTypographyThemeId,
  type TypographyThemeId,
} from "@/lib/typography-themes";
import { sameDraft } from "@/lib/portal-draft-compare";
import {
  MOVEMENT_TOAST_DURATION,
  QuickAnswersBuilder,
  QuickAnswersDestinationDialog,
  demoteFeaturedCard,
  reorderFeaturedCards,
  restoreTopicBoard,
  saveTopicText,
  scrollToQuickAnswersTopic,
  useTopicBoard,
  type BoardPayload,
} from "@/components/wizard/benefits-steps/quick-answers-builder";
import {
  overridesFromTextValues,
  previewTopicFromValues,
  replaceTopicInBoard,
} from "@/lib/topics/text-overrides";
import { HelpCardLayoutEditor } from "@/components/wizard/benefits-steps/help-card-layout-editor";
import { usePortalEditing } from "@/components/portal-editing/portal-editing-provider";
import { usePortalPublishAccess } from "@/components/portal-editing/portal-visibility-switch";
import { useClientPortal } from "@/contexts/client-portal-context";
import {
  ACCOUNT_ACCESS_CARD_ID,
  getHelpCardContent,
  helpCardCatalogFor,
} from "@/lib/help-card-defaults";
import {
  isHelpCardEnabled,
  normalizeHelpCardColumns,
  setHelpCardEnabled,
} from "@/lib/help-card-layout";
import { UNGROUPED_TOPIC_GROUP_ID } from "@/lib/topics/ungrouped";
import {
  readEmployeeResourcesHelp,
  type EmployeeResourcesHelpSettings,
} from "@/lib/employee-resources-help";
import {
  PORTAL_SECTION_IDS,
  portalEditAnchor,
} from "@/lib/portal-editor-sections";
import {
  formatPhoneNumber,
  normalizePhoneNumber,
} from "@/components/wizard/steps/sections/user-setup-section/user-setup-section.funcs";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BrandImagesData } from "@/types/new-client-wizard";
import type { HelpCardContent, ProviderContact } from "@/types/benefit";
import type { TopicLocation } from "@/types/topic";

/**
 * Employee Resources editor — whether the page is published, the plan's typography
 * theme, the page's hero background, then the two sections the page itself renders:
 * "How Can We Help You Today?" and "Quick Answers".
 *
 * Visibility is Section 1 because the hub is opt-in per plan: an advisor arranging
 * questions on a hidden page has to see that first. Typography follows, because the
 * theme is the whole page's frame — the same picker Create/Edit Client and Edit Benefit
 * show — and it is a PLAN-level value (`Client.typographyTheme`), not something this hub
 * owns. It drafts and saves with the hero: the page and header beside the panel repaint
 * through `patchClientData`, and the value is written on Save.
 *
 * The hero is the "Employee Resources Header" Brand Images slot, the same
 * control Create Client Step 1 shows. That slot has no Client column: the save
 * route stores it inside `employeePortalPreview.employeeResourcesHeroImage`,
 * which is exactly what the page reads — then a default of its own. It does NOT
 * fall back to the Page Image Header: that belongs to the interior benefit pages
 * and to News & Events, and borrowing it made a News & Events hero silently
 * replace this page's default.
 *
 * "How Can We Help You Today?" mirrors a Benefit Hub's Section — the Account Access
 * card switch first, then the Plan / Group ID, the Register / Log In URL and the
 * provider, and finally the Card Layout. A benefit keeps those on its `Benefit` row;
 * this hub has no row, so they live in `employeePortalPreview.employeeResourcesHelp`
 * (see `lib/employee-resources-help.ts`) and are written with the hero on Save.
 *
 * "Quick Answers" is the other half of the SAME placement board. Each builder instance
 * edits only its own half and still saves the complete board, so neither can drop the
 * other's work.
 */

const CATEGORY = "Employee Resources";
/** The fifth hub's placement location — not a benefit category. */
const LOCATION: TopicLocation = "employee_resources";

export function PortalEmployeeResourcesEditor() {
  const {
    planId,
    beginSave,
    finishSave,
    failSave,
    resetSave,
    patchClientData,
    refetchPortal,
    employeeResourcesReadKey,
  } = usePortalEditing();
  const { clientData } = useClientPortal();
  const { mutate } = useSWRConfig();

  // The draft effects need the newest plan without re-subscribing on every patch.
  const clientDataRef = useRef(clientData);
  clientDataRef.current = clientData;

  /**
   * Whether the "Visibility" section is offered at all, and therefore whether every
   * section below it moves down one. The same decision the switch itself makes — a
   * viewer who may not publish does not see an empty section 1.
   */
  const { mayPublish } = usePortalPublishAccess();
  const sectionNumber = (index: number) => index + (mayPublish ? 1 : 0);

  /**
   * This page answers from its own read, not from the board the builders below edit.
   * Both builders hand back the whole board the moment a question moves, so the page
   * beside the panel repaints in the same frame instead of waiting for this read to
   * come back.
   *
   * The read is the BUILDER payload, not the participant `?forPortal=1` one: that
   * answers `topics: null` while the hub is unpublished, so a patch would repaint
   * nothing and the page's Quick Answers section would stay empty until publishing.
   * The page reads this same key in an armed edit view (and the dashboard preview
   * supplies its own via the provider), so this patch and the page share one cache
   * entry and the board is visible even while the hub is unpublished.
   */
  const topicsKey = planId
    ? employeeResourcesReadKey ??
      `/api/clients/${planId}/employee-resources`
    : null;
  const patchTopics = useCallback(
    (board: BoardPayload) => {
      if (!topicsKey) return;
      void mutate(
        topicsKey,
        (current: { topics?: Record<string, unknown> } | undefined) =>
          current
            ? {
                ...current,
                topics: {
                  ...(current.topics ?? {}),
                  featured: board.featured,
                  groups: board.groups,
                  hiddenCount: board.hidden.length,
                },
              }
            : current,
        { revalidate: false },
      );
    },
    [mutate, topicsKey],
  );

  /**
   * The placement board, shared by SWR key with both builders. The Card Layout needs
   * the SAME Featured cards the builder lists, or an advisor could arrange a card that
   * is not on the page — and a promoted question would not appear here at all.
   */
  const topicBoard = useTopicBoard(planId, LOCATION);
  const boardPayload = topicBoard.data?.board;
  /**
   * The cards the Card Layout arranges: Account Access plus the Featured placements.
   * With no placements yet this stays `undefined`, and the editor falls back to the
   * category's catalog exactly as the page does.
   */
  const featuredCardCatalog = useMemo<HelpCardContent[] | undefined>(() => {
    const featured = boardPayload?.featured ?? [];
    if (featured.length === 0) return undefined;
    const catalog = helpCardCatalogFor(CATEGORY);
    const access = getHelpCardContent(ACCOUNT_ACCESS_CARD_ID, catalog);
    const topicCards: HelpCardContent[] = featured.map((topic) => ({
      id: topic.slug.replace(/^sys\./, ""),
      title: topic.title,
      paragraphs: [],
      cta: topic.cta?.label ?? "",
      ...(topic.summary ? { body: topic.summary } : {}),
    }));
    return [...(access ? [access] : []), ...topicCards];
  }, [boardPayload]);

  const savedBrandImages = useMemo(
    () => brandImagesFromClient(clientData as Record<string, any> | null),
    [clientData],
  );
  const [brandImages, setBrandImages] =
    useState<BrandImagesData>(savedBrandImages);
  const brandImagesRef = useRef<BrandImagesData>(savedBrandImages);
  const heroDirtyRef = useRef(false);
  /**
   * What this panel LOADED, for "is this actually a change?".
   *
   * `savedBrandImages` follows the live portal context, which this editor patches
   * on every upload, so it cannot serve as the baseline. This snapshot changes only
   * when the draft is (re)seeded or saved — which is what makes a revert to the
   * original image read as clean again.
   */
  const baselineBrandImagesRef = useRef<BrandImagesData>(savedBrandImages);

  /**
   * Section 1 — the plan's typography theme.
   *
   * `Client.typographyTheme`, like Create/Edit Client and Edit Benefit: the theme frames
   * the whole portal page, so it is drafted here and written with the hero on Save.
   */
  const savedTheme = useMemo(
    () =>
      normalizeTypographyThemeId(
        clientData?.typographyTheme,
      ) as TypographyThemeId,
    [clientData?.typographyTheme],
  );
  const [themeDraft, setThemeDraft] =
    useState<TypographyThemeId>(savedTheme);
  const themeDirtyRef = useRef(false);
  /** The theme the panel loaded — same role as the hero baseline above. */
  const baselineThemeRef = useRef<TypographyThemeId>(savedTheme);
  /** The draft itself, for "did the advisor pick another one mid-request?". */
  const themeDraftRef = useRef<TypographyThemeId>(themeDraft);
  themeDraftRef.current = themeDraft;
  /**
   * Moves on every edit so the autosave debounce restarts on each keystroke —
   * `isDirty` is already true for the second one and would not.
   */
  const [draftVersion, setDraftVersion] = useState(0);

  // ── "How Can We Help You Today?" — Account Access + card layout ──
  // A benefit hub keeps these on its Benefit row; this hub keeps them in the plan's
  // `employeePortalPreview.employeeResourcesHelp`. Drafted and written with the hero.
  const savedHelp = useMemo(
    () => readEmployeeResourcesHelp(clientData),
    [clientData],
  );
  const [helpDraft, setHelpDraft] =
    useState<EmployeeResourcesHelpSettings>(savedHelp);
  const helpDraftRef = useRef<EmployeeResourcesHelpSettings>(savedHelp);
  const helpDirtyRef = useRef(false);
  const baselineHelpRef = useRef<EmployeeResourcesHelpSettings>(savedHelp);
  /** The value last read from the plan, so an equal-but-new object never reseeds. */
  const seededHelpRef = useRef<string>(JSON.stringify(savedHelp));

  /**
   * The badge follows the DRAFT, not the click: pick a value, pick the original
   * back, and this is false again. Nothing else has to remember to clear it.
   */
  const themeDirty = themeDraft !== baselineThemeRef.current;
  const heroDirty = !sameDraft(brandImages, baselineBrandImagesRef.current);
  const helpDirty = !sameDraft(helpDraft, baselineHelpRef.current);
  const isDirty = themeDirty || heroDirty || helpDirty;
  usePortalDirtyReport(isDirty);

  // Re-seed from the plan whenever it reloads and the advisor has not picked one.
  useEffect(() => {
    if (themeDirtyRef.current) return;
    baselineThemeRef.current = savedTheme;
    setThemeDraft(savedTheme);
  }, [savedTheme]);

  /** Live-preview the theme: the page and the header read it from the context. */
  const changeTheme = useCallback(
    (id: TypographyThemeId) => {
      themeDirtyRef.current = true;
      setThemeDraft(id);
      patchClientData({ typographyTheme: id } as any);
      setDraftVersion((value) => value + 1);
    },
    [patchClientData],
  );

  // Re-seed from the plan whenever it reloads and nothing is drafted. Guarded by
  // the serialized value so an equal-but-new object cannot re-render forever.
  const seededHeroRef = useRef<string>("");
  useEffect(() => {
    const json = JSON.stringify(savedBrandImages);
    if (heroDirtyRef.current) {
      seededHeroRef.current = json;
      return;
    }
    if (seededHeroRef.current === json) return;
    seededHeroRef.current = json;
    baselineBrandImagesRef.current = savedBrandImages;
    brandImagesRef.current = savedBrandImages;
    setBrandImages(savedBrandImages);
  }, [savedBrandImages]);

  // Re-seed the Account Access / card-layout draft the same way, and never clobber an
  // in-flight edit with the optimistic patch this editor just published.
  useEffect(() => {
    const json = JSON.stringify(savedHelp);
    if (helpDirtyRef.current) {
      seededHelpRef.current = json;
      return;
    }
    if (seededHelpRef.current === json) return;
    seededHelpRef.current = json;
    baselineHelpRef.current = savedHelp;
    helpDraftRef.current = savedHelp;
    setHelpDraft(savedHelp);
  }, [savedHelp]);

  /** Live-preview the header band while the advisor adjusts it. */
  const changeBrandImages = useCallback(
    async (next: BrandImagesData) => {
      const hero = next.employeeResourcesHero ?? null;
      const currentPlan = (clientDataRef.current ?? {}) as Record<string, any>;
      brandImagesRef.current = next;
      heroDirtyRef.current = true;
      setBrandImages(next);
      // `employeePortalPreview` is merged here: `patchClientData` replaces the
      // key it is given, and this hub's image lives inside that blob.
      patchClientData({
        brandImages: next,
        employeePortalPreview: {
          ...((currentPlan.employeePortalPreview as Record<string, unknown>) ??
            {}),
          employeeResourcesHeroImage: hero?.url ?? "",
        },
      });
      setDraftVersion((value) => value + 1);
    },
    [patchClientData],
  );

  /** Draft a "How Can We Help" field and live-preview it through the plan blob. */
  const updateHelp = useCallback(
    (patch: Partial<EmployeeResourcesHelpSettings>) => {
      const next = { ...helpDraftRef.current, ...patch };
      helpDraftRef.current = next;
      helpDirtyRef.current = true;
      setHelpDraft(next);
      const currentPlan = (clientDataRef.current ?? {}) as Record<string, any>;
      patchClientData({
        employeePortalPreview: {
          ...((currentPlan.employeePortalPreview as Record<string, unknown>) ??
            {}),
          employeeResourcesHelp: next,
        },
      });
      setDraftVersion((value) => value + 1);
    },
    [patchClientData],
  );

  /**
   * Whether the Account Access card is on the page at all — the layout's own
   * `enabled` flag, the same one the Card Layout's per-card checkbox writes, so the
   * two controls can never disagree.
   */
  const accountAccessVisible = isHelpCardEnabled(
    helpDraft.helpCards.find((entry) => entry.id === ACCOUNT_ACCESS_CARD_ID),
  );

  /**
   * Show or hide the Account Access card from beside its own fields. Hiding is not
   * deleting: the card keeps its slot and the fields below stay saved.
   */
  const setAccountAccessVisible = (visible: boolean) => {
    const next = setHelpCardEnabled(
      helpDraft.helpCards,
      ACCOUNT_ACCESS_CARD_ID,
      visible,
      {
        catalog: featuredCardCatalog,
        columns: normalizeHelpCardColumns(helpDraft.helpCardColumns),
      },
    );
    updateHelp({ helpCards: next });
  };

  /** Format the Plan / Group ID the same way the Card Access card prints it. */
  const handlePlanIdChange = (value: string) => {
    const raw = value
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 12);
    const groups: string[] = [];
    for (let i = 0; i < raw.length; i += 4) {
      groups.push(raw.slice(i, i + 4));
    }
    updateHelp({ insurancePlanId: groups.join("-") });
  };

  const updateProvider = (patch: Partial<ProviderContact>) =>
    updateHelp({
      providerContact: { ...(helpDraft.providerContact || {}), ...patch },
    });

  /**
   * The Card Layout's reorder. The page's Featured cards follow the SAME order the
   * board writes, so a drag here reaches the placements too — otherwise the grid
   * beside the panel only re-orders after a reload.
   */
  const handleLayoutChange = (
    helpCards: EmployeeResourcesHelpSettings["helpCards"],
  ) => {
    updateHelp({ helpCards });

    const board = boardPayload;
    if (!board || board.featured.length === 0 || !planId) return;
    const topicIdBySlug = new Map(
      board.featured.map((topic) => [
        topic.slug.replace(/^sys\./, ""),
        topic.topicId,
      ]),
    );
    const orderedTopicIds = helpCards
      .map((entry) => topicIdBySlug.get(entry.id))
      .filter((topicId): topicId is string => Boolean(topicId));
    if (orderedTopicIds.length !== board.featured.length) return;

    // Only a real reorder reaches the placements; a show/hide, a new primary or an
    // edge flip is layout-only (the same guard as the Benefit Hub's `onChange`),
    // and writing those here shuffled the Featured cards after an unrelated tweak.
    const layoutPrimaryId = helpCards.find((entry) => entry.primary)?.id ?? "";
    const primaryTopicId = topicIdBySlug.get(layoutPrimaryId);
    const withoutPrimary = (ids: (string | undefined)[]) =>
      ids.filter((id): id is string => Boolean(id) && id !== primaryTopicId);
    const nextRest = withoutPrimary(orderedTopicIds);
    const currentRest = withoutPrimary(
      board.featured.map((topic) => topic.topicId),
    );
    const orderChanged =
      nextRest.length !== currentRest.length ||
      nextRest.some((id, index) => id !== currentRest[index]);
    if (!orderChanged) return;

    void reorderFeaturedCards({
      planId,
      location: LOCATION,
      board,
      orderedTopicIds,
      onBoardChange: patchTopics,
    }).catch((error: unknown) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not save the card order.",
      );
    });
  };

  /**
   * A card the advisor asked to send back to Quick Answers. Held until they pick a
   * section — the SAME dialog the Quick Answers builder shows.
   */
  const [pendingDemotion, setPendingDemotion] = useState<{
    topicId: string;
    title: string;
  } | null>(null);
  const [demotingCardId, setDemotingCardId] = useState<string | null>(null);

  const demotionGroups = useMemo(
    () =>
      (boardPayload?.groups ?? []).filter(
        (group) => group.id !== UNGROUPED_TOPIC_GROUP_ID,
      ),
    [boardPayload],
  );

  /** Card Layout's "Move to Quick Answers" — find the Featured placement behind it. */
  const moveCardToQuickAnswers = (cardId: string) => {
    const board = boardPayload;
    if (!board) return;
    const topic = board.featured.find(
      (entry) => entry.slug.replace(/^sys\./, "") === cardId,
    );
    if (!topic) {
      toast.error("That card is not a Featured question, so it cannot move.");
      return;
    }
    setPendingDemotion({ topicId: topic.topicId, title: topic.title });
  };

  /** Answer the section picker with the builder's own demote write. */
  const moveIntoQuickAnswers = (groupId: string) => {
    const board = boardPayload;
    const pending = pendingDemotion;
    setPendingDemotion(null);
    if (!board || !pending || !planId) return;
    const groupName =
      board.groups.find((group) => group.id === groupId)?.name ??
      "Quick Answers";
    const cardId = board.featured
      .find((topic) => topic.topicId === pending.topicId)
      ?.slug.replace(/^sys\./, "");
    if (cardId) setDemotingCardId(cardId);

    toast.success(`${pending.title} moved to Quick Answers`, {
      description: `It now sits in ${groupName}.`,
      // Movement confirmations stay up twice as long — they carry two actions.
      duration: MOVEMENT_TOAST_DURATION,
      // Undo re-sends the board exactly as it was before this move.
      cancel: {
        label: "Undo",
        onClick: () => {
          void restoreTopicBoard({
            planId,
            location: LOCATION,
            board,
            onBoardChange: patchTopics,
          }).catch((error: unknown) => {
            toast.error(
              error instanceof Error
                ? error.message
                : "Could not undo that move.",
            );
          });
        },
      },
      // Jump the panel down to the row the card now occupies in Quick Answers —
      // the same "View" action the Benefit Hub's Card Layout offers.
      action: {
        label: "View",
        onClick: () => {
          scrollToQuickAnswersTopic(pending.topicId);
        },
      },
    });

    void demoteFeaturedCard({
      planId,
      location: LOCATION,
      board,
      topicId: pending.topicId,
      groupId,
      onBoardChange: patchTopics,
    })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not move the card to Quick Answers.",
        );
      })
      .finally(() => setDemotingCardId(null));
  };

  /**
   * Re-seed the drafts AND their baselines from the saved plan.
   *
   * Save and Cancel both land here: the optimistic draft may have patched the
   * context, so "equal to what the server now holds" has to be re-established, not
   * assumed. That is what leaves the header badge clean afterwards.
   */
  const reseedFromPlan = useCallback((plan: Record<string, any> | null) => {
    const nextTheme = normalizeTypographyThemeId(
      plan?.typographyTheme,
    ) as TypographyThemeId;
    const nextBrandImages = brandImagesFromClient(plan);
    baselineThemeRef.current = nextTheme;
    setThemeDraft(nextTheme);
    baselineBrandImagesRef.current = nextBrandImages;
    brandImagesRef.current = nextBrandImages;
    setBrandImages(nextBrandImages);
    seededHeroRef.current = JSON.stringify(nextBrandImages);

    const nextHelp = readEmployeeResourcesHelp(plan);
    baselineHelpRef.current = nextHelp;
    helpDraftRef.current = nextHelp;
    setHelpDraft(nextHelp);
    seededHelpRef.current = JSON.stringify(nextHelp);
    helpDirtyRef.current = false;
  }, []);

  /**
   * Persist the drafted hero, theme, Account Access fields and card layout.
   *
   * The autosave calls this a beat after the last edit and reports whether the
   * server accepted it, so a failure stops the loop instead of retrying the same
   * draft forever.
   */
  const save = useCallback(async (): Promise<boolean> => {
    if (!planId) return false;
    if (!isDirty) return true;

    // What this pass sends. Captured now because every one of these refs moves
    // with the advisor's next click, and one may land while the upload is running.
    const sentTheme = themeDraft;
    const sentHelp = helpDraftRef.current;
    const sentHeroDraft = brandImagesRef.current;

    beginSave();
    try {
      let payload = brandImagesRef.current;
      const hero = payload.employeeResourcesHero ?? null;

      // The plan route stores this slot's URL as-is (no base64 pass), so the
      // upload has to become an R2 object before it is sent.
      if (hero?.url?.startsWith("data:")) {
        const { uploadBrandingToR2 } = await import("@/lib/branding-r2");
        const key = await uploadBrandingToR2({
          dataUrlOrFile: hero.url,
          fileName: hero.fileName || "employee-resources-header.png",
          clientId: planId,
          slot: "employeeResourcesHero",
        });
        if (key) {
          payload = {
            ...payload,
            employeeResourcesHero: { ...hero, url: key },
          };
        }
      }

      const response = await fetch(`/api/clients/${planId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // The theme travels with the hero: both are plan-level values this panel drafts.
        // The "How Can We Help" settings ride the same `employeePortalPreview` blob.
        body: JSON.stringify({
          brandImages: payload,
          typographyTheme: themeDraft,
          employeePortalPreview: {
            employeeResourcesHelp: helpDraftRef.current,
          },
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "Could not save the header image.");
      }

      // Only what this pass SENT becomes the baseline. A theme, hero or card the
      // advisor changed again while the request was in flight keeps its draft —
      // and its dirty flag — and goes out on the autosave's next pass instead of
      // being swallowed here.
      const advanced =
        brandImagesRef.current !== sentHeroDraft ||
        helpDraftRef.current !== sentHelp ||
        themeDraftRef.current !== sentTheme;
      baselineThemeRef.current = sentTheme;
      baselineBrandImagesRef.current = payload;
      baselineHelpRef.current = sentHelp;
      heroDirtyRef.current = advanced;
      themeDirtyRef.current = advanced;
      helpDirtyRef.current = advanced;
      finishSave();
      if (!advanced) {
        // The stored value replaces the optimistic data URL (and the R2 key the
        // upload produced), so the drafts are re-seeded from the saved plan.
        const fresh = await refetchPortal();
        reseedFromPlan(fresh as Record<string, any> | null);
      }
      return true;
    } catch (error) {
      failSave(
        error instanceof Error
          ? error.message
          : "Could not save the header image.",
      );
      return false;
    }
  }, [
    planId,
    isDirty,
    themeDraft,
    beginSave,
    finishSave,
    failSave,
    refetchPortal,
    reseedFromPlan,
  ]);

  // No Save button: every edit previews at once and writes a beat later.
  usePortalAutosave({ isDirty, version: draftVersion, save });

  /** Throw the draft away; the portal refetch restores the saved band. */
  const cancel = useCallback(async () => {
    heroDirtyRef.current = false;
    themeDirtyRef.current = false;
    helpDirtyRef.current = false;
    resetSave();
    const fresh = await refetchPortal();
    reseedFromPlan(fresh as Record<string, any> | null);
  }, [refetchPortal, resetSave, reseedFromPlan]);

  return (
    <PortalEditorShell footer={<PortalEditorActionBar isDirty={isDirty} />}>
      <div className="space-y-8">
        {/* Section 1 — can employees reach this page at all? The hub is opt-in per
            plan, so its state belongs at the top: an advisor who sets up questions on
            a hidden hub has to know they are not live yet. */}
        {mayPublish ? (
          <section className="space-y-4">
            <SectionHeader number={1} title="Visibility" />
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Whether employees can reach this page. Publishing adds Employee
              Resources to the plan&rsquo;s portal header; hiding it removes the link - nothing is deleted.
            </p>
            <PortalEmployeeResourcesVisibilityToggle />
          </section>
        ) : null}

        {/* This panel renders its sections as children rather than through the
            wrapper's `sections` list, so each one carries its own anchor — the
            address the page's three blue buttons scroll to. */}
        <section className="space-y-4">
          <SectionHeader number={sectionNumber(1)} title="Typography Theme" />
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            The fonts and corner treatment for this plan&rsquo;s whole portal. It is
            the same PLAN-level setting Create Plan → Step 2, Edit Plan and the benefit
            panels edit, so changing it here changes every portal page.
          </p>
          <div className="rounded-lg border border-muted bg-white p-4 dark:bg-gray-800">
            <TypographySection
              value={themeDraft}
              onChange={changeTheme}
              // The panel is narrow: one card per row.
              compact
              enableAiSuggestion
              websiteUrl={clientData?.companyWebsite}
              companyName={clientData?.companyName}
            />
          </div>
        </section>

        <section
          className="space-y-4"
          data-edit-anchor={portalEditAnchor.employeeResourcesHero}
        >
          <SectionHeader number={sectionNumber(2)} title="Hero Background" />
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            The image behind this page&rsquo;s &ldquo;Employee Resources&rdquo;
            title. It fills a band 400&nbsp;px tall on a desktop screen
            (1440&times;400 is the recommended image), so keep the subject
            centred. When none is set, this page uses its own bundled default
            &mdash; the Page Image Header is not borrowed.
          </p>
          <div className="rounded-lg border border-muted bg-white p-4 dark:bg-gray-800">
            <BrandImagesSection
              brandImages={brandImages}
              visibleSlots={["employeeResourcesHero"]}
              onBrandImagesChange={changeBrandImages}
              logoUrl={clientData?.companyLogo ?? null}
              companyName={clientData?.companyName}
              // The live page is already beside this panel.
              showNewsEventsPreview={false}
            />
          </div>
        </section>

        {/* "How Can We Help You Today?" — the SAME structure a Benefit Hub's editor
            shows: the Account Access switch first, then its fields, then the layout. */}
        <section
          className="space-y-4"
          data-edit-anchor={portalEditAnchor.employeeResourcesHelp}
        >
          <SectionHeader
            number={sectionNumber(3)}
            title="How Can We Help You Today?"
          />
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Start with the Plan / Group ID the Account Access card prints, where
            its &ldquo;Register or Log In&rdquo; button sends participants, and who
            administers the benefit &mdash; then arrange the card layout below.
          </p>

          <div className="space-y-4 rounded-lg border border-muted bg-white p-4 dark:bg-gray-800">
            {/* Show the Account Access card — the FIRST control in the section, so
                the advisor decides whether it is on the page before filling it in. */}
            <div className="flex items-start gap-2.5 rounded-md border border-muted bg-muted/20 p-3">
              <Checkbox
                id="employee-resources-account-access-visible"
                data-testid="employee-resources-account-access-visible"
                checked={accountAccessVisible}
                onCheckedChange={(checked) =>
                  setAccountAccessVisible(checked === true)
                }
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <Label
                  htmlFor="employee-resources-account-access-visible"
                  className="text-xs font-bold text-foreground"
                >
                  Show the Account Access card
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Untick to take the card off the page. The fields below stay
                  saved and the card keeps its place, so ticking it again brings
                  it straight back &mdash; and the remaining cards re-fill the rows
                  while it is hidden.
                </p>
              </div>
            </div>

            {/* The Plan / Group ID, login URL and provider describe the Account
                Access card, so they hide with it — a short height/fade animation
                keeps the toggle from jumping the panel. */}
            <AnimatePresence initial={false}>
              {accountAccessVisible && (
                <motion.div
                  key="account-access-fields"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{
                    duration: 0.25,
                    ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
                  }}
                  className="overflow-hidden"
                >
                  <div className="space-y-4 pt-1">
            {/* Plan / Group ID — printed as "PLAN / GROUP ID: …" on the card. */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground">
                Plan / Group ID
              </Label>
              <Input
                value={helpDraft.insurancePlanId}
                onChange={(e) => handlePlanIdChange(e.target.value)}
                placeholder="xxxx-xxxx-xxxx"
                className="h-11 shadow-sm border-muted font-mono tracking-wider"
              />
              <p className="text-[11px] text-muted-foreground">
                This appears as &ldquo;PLAN / GROUP ID: [value]&rdquo; on the
                Account Access card.
              </p>
            </div>

            {/* Where the Account Access card's "Register or Log In" button goes. */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground">
                Register or Log In Button URL{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Input
                value={helpDraft.insuranceLoginUrl}
                onChange={(e) =>
                  updateHelp({ insuranceLoginUrl: e.target.value })
                }
                placeholder="e.g. https://portal.empower.com/auth/login"
                type="url"
                className="h-11 shadow-sm border-muted"
              />
              <p className="text-[11px] text-muted-foreground">
                Where the &ldquo;Register or Log In&rdquo; button sends
                participants.
              </p>
            </div>

            {/* Provider / Recordkeeper — the "Administered by …" line. */}
            <div className="space-y-3 border-t pt-4">
              <div>
                <Label className="text-xs font-bold text-foreground">
                  Provider / Recordkeeper
                </Label>
                <p className="text-[11px] text-muted-foreground mt-1">
                  The company that administers this benefit &mdash; the card shows
                  it as &ldquo;Administered by …&rdquo;.
                </p>
              </div>
              <Input
                value={helpDraft.providerContact?.companyName || ""}
                onChange={(e) =>
                  updateProvider({ companyName: e.target.value })
                }
                placeholder="e.g. Voya, Empower, Principal, Fidelity"
                className="h-11 shadow-sm border-muted"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  value={helpDraft.providerContact?.contactName || ""}
                  onChange={(e) =>
                    updateProvider({ contactName: e.target.value })
                  }
                  placeholder="Provider contact (optional)"
                  className="h-11 shadow-sm border-muted"
                />
                <Input
                  type="tel"
                  // Capped at a formatted 10-digit US number.
                  maxLength={14}
                  value={formatPhoneNumber(
                    helpDraft.providerContact?.phone || "",
                  )}
                  onChange={(e) => {
                    const digits = normalizePhoneNumber(e.target.value);
                    if (digits.length > 10) return;
                    updateProvider({ phone: digits });
                  }}
                  placeholder="Provider phone (optional)"
                  className="h-11 shadow-sm border-muted"
                />
              </div>
            </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Card layout — the SAME control a Benefit Hub's Section 6 shows: order,
              primary, per-card show/hide, cards per row and "Move to Quick Answers". */}
          <div className="rounded-lg border border-muted bg-white p-4 dark:bg-gray-800">
            <HelpCardLayoutEditor
              value={helpDraft.helpCards}
              columns={helpDraft.helpCardColumns}
              onColumnsChange={(helpCardColumns) =>
                updateHelp({ helpCardColumns })
              }
              category={CATEGORY}
              catalog={featuredCardCatalog}
              // Ticked cards stay on the page; the Account Access switch above writes
              // this same flag, so the two cannot disagree.
              showEnabledToggle
              // Only a Featured placement can go back to Quick Answers.
              onMoveToQuickAnswers={
                featuredCardCatalog ? moveCardToQuickAnswers : undefined
              }
              movingCardId={demotingCardId}
              // This plan's Featured placements, so each row can edit its own text
              // (title / card line / answer), saved per plan.
              topics={boardPayload?.featured}
              media={topicBoard.data?.media}
              // AWAIT the write: the dialog must not close until the cache holds the
              // saved copy, or reopening it within the round trip shows the old text.
              onSaveText={async (topic, values) => {
                if (!planId) return;
                const overrides = overridesFromTextValues(topic, values);
                if (Object.keys(overrides).length === 0) return;
                try {
                  await saveTopicText({
                    planId,
                    location: LOCATION,
                    topicId: topic.topicId,
                    overrides,
                    onBoardChange: patchTopics,
                  });
                } catch (error: unknown) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Could not save that text.",
                  );
                  // Re-throw so the dialog stays open and the edit is not lost.
                  throw error;
                }
              }}
              // Live preview while the text editor is open: an added/removed step
              // (or any text change) reaches the page beside the panel at once.
              onPreviewText={(topic, values) => {
                if (!boardPayload) return;
                patchTopics(
                  replaceTopicInBoard(
                    boardPayload,
                    previewTopicFromValues(topic, values),
                  ),
                );
              }}
              onChange={handleLayoutChange}
            />

            <QuickAnswersDestinationDialog
              open={pendingDemotion !== null}
              topicTitle={pendingDemotion?.title ?? ""}
              groups={demotionGroups}
              onPick={moveIntoQuickAnswers}
              onCancel={() => setPendingDemotion(null)}
            />
          </div>
        </section>

        <section
          className="space-y-4"
          data-edit-anchor={portalEditAnchor.employeeResourcesQuickAnswers}
        >
          <SectionHeader number={sectionNumber(4)} title="Quick Answers" />
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            The grouped questions below the cards &mdash; the same board as above, so
            a question is always in exactly one place.
          </p>
          <div className="rounded-lg border border-muted bg-white p-4 dark:bg-gray-800">
            <QuickAnswersBuilder
              planId={planId}
              location={LOCATION}
              mode="answers"
              onBoardChange={patchTopics}
            />
          </div>
        </section>

        {/* The footer disclosure shared by the four non-hub pages. */}
        <section
          className="space-y-4"
          data-edit-anchor={PORTAL_SECTION_IDS.disclosure}
        >
          <SectionHeader number={sectionNumber(5)} title="Disclosure" />
          <PortalFooterSection />
        </section>
      </div>
    </PortalEditorShell>
  );
}
