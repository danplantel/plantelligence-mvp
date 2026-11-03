"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PortalEditorActionBar } from "@/components/portal-editing/portal-editor-action-bar";
import { PortalEditorShell } from "@/components/portal-editing/portal-editor-shell";
import { SectionHeader } from "@/components/wizard/new-client-steps/sections/components/editor-panel-wrapper";
import { BrandImagesSection } from "@/components/wizard/new-client-steps/sections/brand-images-section";
import { usePortalEditing } from "@/components/portal-editing/portal-editing-provider";
import { useClientPortal } from "@/contexts/client-portal-context";
import type {
  BrandImageData,
  BrandImagesData,
} from "@/types/new-client-wizard";

const fetcher = (url: string) => fetch(url).then((response) => response.json());

/** Every cached public-assets key — the portal's own copies of these rows. */
const PUBLIC_ASSETS_PREFIX = "/api/marketing/assets/public";

interface MarketingAssetDraft {
  id: string;
  type: string;
  status: string;
  headline: string;
  body: string;
  ctaText: string;
}

/** Turn a legacy URL/name pair into the BrandImageData shape the cards read. */
function brandImageFromLegacy(
  url?: string | null,
  fileName?: string | null,
): BrandImageData | null {
  if (!url) return null;
  return {
    url,
    fileName: fileName ?? "",
    fileSize: 0,
    width: 0,
    height: 0,
    recommendedSize: "1440×400 px",
    status: "ok",
    warnings: [],
  };
}

/** The plan's brand images, in the shape `BrandImagesSection` expects. */
function brandImagesFromClient(
  clientData: Record<string, any> | null,
): BrandImagesData {
  const raw = (clientData?.brandImages ?? {}) as Record<string, any>;
  return {
    header:
      raw.header ??
      brandImageFromLegacy(
        clientData?.backgroundImg,
        clientData?.backgroundImgName,
      ),
    thumbnail:
      raw.thumbnail ??
      brandImageFromLegacy(
        clientData?.thumbnailImg,
        clientData?.thumbnailImgName,
      ),
    secondaryBanner:
      raw.secondaryBanner ??
      brandImageFromLegacy(
        clientData?.secondaryBannerImg,
        clientData?.secondaryBannerImgName,
      ),
    favicon: raw.favicon ?? null,
    employeeResourcesHero: raw.employeeResourcesHero ?? null,
  } as BrandImagesData;
}

/**
 * News & Events editor — the page's hero background, then the published
 * notices, pop-ups and news posts.
 *
 * The whole panel is a DRAFT, like the Home and benefit-hub panels: the page
 * beside it repaints on every change (the hero through `patchClientData`, the
 * rows through the public-assets cache), but nothing is written until Save.
 * Cancel revalidates both sources, which is what puts the saved values back.
 *
 * The hero background is the plan's "Page Image Header" Brand Images slot — the
 * same control Create Client Step 1 shows, so the upload / Choose Default Image /
 * crop flow and the News & Events preview are identical. Saving goes through the
 * same plan PUT the Home editor uses, where the route converts an uploaded data
 * URL to an R2 object and writes the legacy `secondaryBannerImg` column this page
 * reads.
 */
export function PortalNewsEditor() {
  const {
    planId,
    beginSave,
    finishSave,
    failSave,
    resetSave,
    patchClientData,
    refetchPortal,
  } = usePortalEditing();
  const { clientData } = useClientPortal();
  const { mutate } = useSWRConfig();
  const key = planId ? `/api/marketing/assets?clientId=${planId}` : null;
  const { data, mutate: mutateList } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
  });
  const assets: MarketingAssetDraft[] = Array.isArray(data?.data)
    ? data.data
    : [];

  const [drafts, setDrafts] = useState<Record<string, MarketingAssetDraft>>({});
  const [isDirty, setIsDirty] = useState(false);

  // The hero draft, and the flags the Save/Cancel handlers read. Refs because
  // the handlers are called from the action bar, outside the render that last
  // changed a field.
  const savedBrandImages = useMemo(
    () => brandImagesFromClient(clientData as Record<string, any> | null),
    [clientData],
  );
  const [brandImages, setBrandImages] = useState<BrandImagesData>(
    savedBrandImages,
  );
  const brandImagesRef = useRef<BrandImagesData>(savedBrandImages);
  const heroDirtyRef = useRef(false);
  const dirtyAssetsRef = useRef<Set<string>>(new Set());
  const draftsRef = useRef<Record<string, MarketingAssetDraft>>({});
  draftsRef.current = drafts;

  // Re-seed the hero from the plan whenever it reloads and nothing is drafted.
  // Guarded by the serialized value: a caller that hands us an equal-but-new
  // object every render (or a context that re-creates it) must not re-render
  // forever.
  const seededHeroRef = useRef<string>("");
  useEffect(() => {
    const json = JSON.stringify(savedBrandImages);
    if (heroDirtyRef.current) {
      seededHeroRef.current = json;
      return;
    }
    if (seededHeroRef.current === json) return;
    seededHeroRef.current = json;
    brandImagesRef.current = savedBrandImages;
    setBrandImages(savedBrandImages);
  }, [savedBrandImages]);

  // Re-seed each row from the server list, keeping rows the advisor has edited.
  useEffect(() => {
    setDrafts((previous) => {
      const next: Record<string, MarketingAssetDraft> = {};
      let changed = Object.keys(previous).length !== assets.length;
      assets.forEach((asset) => {
        const draft = previous[asset.id];
        if (draft && dirtyAssetsRef.current.has(asset.id)) {
          next[asset.id] = draft;
          return;
        }
        next[asset.id] = { ...asset };
        if (
          !draft ||
          draft.headline !== asset.headline ||
          draft.body !== asset.body ||
          draft.ctaText !== asset.ctaText ||
          draft.status !== asset.status
        ) {
          changed = true;
        }
      });
      return changed ? next : previous;
    });
  }, [assets]);

  /** Repaint the portal's copy of one asset from the draft (no save). */
  const patchPublicAssets = useCallback(
    (id: string, patch: Partial<MarketingAssetDraft>) => {
      void mutate(
        (cacheKey: string | null) =>
          typeof cacheKey === "string" &&
          cacheKey.startsWith(PUBLIC_ASSETS_PREFIX),
        (current: any) =>
          Array.isArray(current?.data)
            ? {
                ...current,
                data: current.data.map((asset: any) =>
                  asset?.id === id ? { ...asset, ...patch } : asset,
                ),
              }
            : current,
        { revalidate: false },
      );
    },
    [mutate],
  );

  const update = useCallback(
    (id: string, patch: Partial<MarketingAssetDraft>) => {
      dirtyAssetsRef.current.add(id);
      setIsDirty(true);
      setDrafts((previous) => ({
        ...previous,
        [id]: { ...previous[id], ...patch },
      }));
      patchPublicAssets(id, patch);
    },
    [patchPublicAssets],
  );

  /** Live-preview the Page Image Header while the advisor adjusts it. */
  const changeBrandImages = useCallback(
    async (next: BrandImagesData) => {
      const banner = next.secondaryBanner ?? null;
      brandImagesRef.current = next;
      heroDirtyRef.current = true;
      setIsDirty(true);
      setBrandImages(next);
      patchClientData({
        brandImages: next,
        secondaryBannerImg: banner?.url ?? "",
        secondaryBannerImgName: banner?.fileName ?? "",
      });
    },
    [patchClientData],
  );

  /** Persist the drafted hero + every edited row. Only the bar calls this. */
  const save = useCallback(async () => {
    if (!planId) return;
    const heroDirty = heroDirtyRef.current;
    const assetIds = Array.from(dirtyAssetsRef.current);
    if (!heroDirty && assetIds.length === 0) return;

    beginSave();
    try {
      if (heroDirty) {
        const response = await fetch(`/api/clients/${planId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          // The route turns the uploaded data URL into an R2 object and writes
          // the legacy `secondaryBannerImg` column this page reads.
          body: JSON.stringify({ brandImages: brandImagesRef.current }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || "Could not save the header image.");
        }
      }

      for (const id of assetIds) {
        const draft = draftsRef.current[id];
        if (!draft) continue;
        const response = await fetch(`/api/marketing/assets/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            headline: draft.headline,
            body: draft.body,
            ctaText: draft.ctaText,
            status: draft.status,
          }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || "Could not save this asset.");
        }
      }

      heroDirtyRef.current = false;
      dirtyAssetsRef.current.clear();
      setIsDirty(false);
      finishSave();

      // The saved rows are the source of truth now.
      if (key) await mutateList();
      await mutate((cacheKey: string | null) =>
        typeof cacheKey === "string"
          ? cacheKey.startsWith(PUBLIC_ASSETS_PREFIX)
          : false,
      );
      if (heroDirty) await refetchPortal();
    } catch (error) {
      // Keep the draft and its preview so the advisor can retry.
      failSave(
        error instanceof Error ? error.message : "Could not save these changes.",
      );
    }
  }, [planId, key, mutateList, mutate, beginSave, finishSave, failSave, refetchPortal]);

  /** Throw the draft away: revalidate both sources and re-seed from them. */
  const cancel = useCallback(async () => {
    heroDirtyRef.current = false;
    dirtyAssetsRef.current.clear();
    setIsDirty(false);
    resetSave();

    await refetchPortal();
    if (key) await mutateList();
    await mutate((cacheKey: string | null) =>
      typeof cacheKey === "string"
        ? cacheKey.startsWith(PUBLIC_ASSETS_PREFIX)
        : false,
    );
  }, [key, mutateList, mutate, refetchPortal, resetSave]);

  return (
    <PortalEditorShell
      footer={
        <PortalEditorActionBar
          isDirty={isDirty}
          onSave={() => void save()}
          onCancel={() => void cancel()}
        />
      }
    >
      <div className="space-y-8">
        {/* The page's hero background — the same "Page Image Header" slot Create
            Client Step 1 offers, with the same upload / gallery / crop flow. */}
        <section className="space-y-4">
          <SectionHeader number={1} title="Hero Background" />
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            The image behind this page&rsquo;s &ldquo;News & Events&rdquo;
            title. It fills a band 400&nbsp;px tall on a desktop screen
            (1440&times;400 is the recommended image), so keep the subject
            centred — shorter screens crop the edges. This is the plan&rsquo;s
            Page Image Header, so it is also the default header on the
            portal&rsquo;s other interior pages.
          </p>
          <div className="rounded-lg border border-muted bg-white p-4 dark:bg-gray-800">
            <BrandImagesSection
              brandImages={brandImages}
              visibleSlots={["secondaryBanner"]}
              onBrandImagesChange={changeBrandImages}
              logoUrl={clientData?.companyLogo ?? null}
              companyName={clientData?.companyName}
              // The live page is already beside this panel, so the "Preview in
              // News & Events Header" mock-up (and its dialog) is redundant.
              showNewsEventsPreview={false}
            />
          </div>
        </section>

        {assets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This plan has no portal notices, pop-ups or news posts yet.
          </p>
        ) : (
          assets.map((asset, index) => {
            const draft = drafts[asset.id] ?? asset;
            return (
              <section key={asset.id}>
                {/* Section 1 is the hero background. */}
                <SectionHeader
                  number={index + 2}
                  title={`${asset.type} · ${asset.status}`}
                />
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Headline</Label>
                    <Input
                      value={draft.headline}
                      onChange={(event) =>
                        update(asset.id, { headline: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Body</Label>
                    <Textarea
                      value={draft.body}
                      onChange={(event) =>
                        update(asset.id, { body: event.target.value })
                      }
                      rows={4}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Button text</Label>
                    <Input
                      value={draft.ctaText}
                      onChange={(event) =>
                        update(asset.id, { ctaText: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Status</Label>
                    <select
                      value={draft.status}
                      onChange={(event) =>
                        update(asset.id, { status: event.target.value })
                      }
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="Draft">Draft</option>
                      <option value="Published">Published</option>
                      <option value="Archived">Archived</option>
                    </select>
                  </div>
                </div>
              </section>
            );
          })
        )}
      </div>
    </PortalEditorShell>
  );
}
