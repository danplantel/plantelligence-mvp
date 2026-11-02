"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SectionHeader } from "@/components/wizard/new-client-steps/sections/components/editor-panel-wrapper";
import { usePortalEditing } from "@/components/portal-editing/portal-editing-provider";

const fetcher = (url: string) => fetch(url).then((response) => response.json());

interface MarketingAssetDraft {
  id: string;
  type: string;
  status: string;
  headline: string;
  body: string;
  ctaText: string;
}

/**
 * News & Events editor — the published notices, pop-ups and news posts.
 *
 * Each row saves on blur through the existing marketing-asset PATCH, then the
 * portal's public asset keys are revalidated so the page shows the new copy.
 */
export function PortalNewsEditor() {
  const { planId, beginSave, finishSave, failSave, saveState, saveError } =
    usePortalEditing();
  const { mutate } = useSWRConfig();
  const key = planId ? `/api/marketing/assets?clientId=${planId}` : null;
  const { data, mutate: mutateList } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
  });
  const assets: MarketingAssetDraft[] = Array.isArray(data?.data)
    ? data.data
    : [];

  const [drafts, setDrafts] = useState<Record<string, MarketingAssetDraft>>({});
  const dirtyRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setDrafts((previous) => {
      const next = { ...previous };
      assets.forEach((asset) => {
        if (!next[asset.id]) next[asset.id] = { ...asset };
      });
      return next;
    });
  }, [assets]);

  const saveAsset = useCallback(
    async (id: string) => {
      const draft = drafts[id];
      if (!draft) return;
      beginSave();
      try {
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
        finishSave();
        if (key) await mutateList();
        await mutate(
          (cacheKey) =>
            typeof cacheKey === "string" &&
            cacheKey.startsWith("/api/marketing/assets/public"),
        );
      } catch (error) {
        failSave(
          error instanceof Error ? error.message : "Could not save this asset.",
        );
      }
    },
    [drafts, beginSave, finishSave, failSave, key, mutateList, mutate],
  );

  const update = useCallback((id: string, patch: Partial<MarketingAssetDraft>) => {
    dirtyRef.current.add(id);
    setDrafts((previous) => ({
      ...previous,
      [id]: { ...previous[id], ...patch },
    }));
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
        {saveState === "saving" && (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving…
          </>
        )}
        {saveState === "saved" && <span>Saved</span>}
        {saveState === "error" && (
          <span className="text-red-500">{saveError || "Save failed"}</span>
        )}
      </div>

      {assets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          This plan has no portal notices, pop-ups or news posts yet.
        </p>
      ) : (
        assets.map((asset, index) => {
          const draft = drafts[asset.id] ?? asset;
          return (
            <section key={asset.id}>
              <SectionHeader
                number={index + 1}
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
                    onBlur={() => {
                      if (dirtyRef.current.delete(asset.id)) {
                        void saveAsset(asset.id);
                      }
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Body</Label>
                  <Textarea
                    value={draft.body}
                    onChange={(event) =>
                      update(asset.id, { body: event.target.value })
                    }
                    onBlur={() => {
                      if (dirtyRef.current.delete(asset.id)) {
                        void saveAsset(asset.id);
                      }
                    }}
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
                    onBlur={() => {
                      if (dirtyRef.current.delete(asset.id)) {
                        void saveAsset(asset.id);
                      }
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <select
                    value={draft.status}
                    onChange={(event) => {
                      update(asset.id, { status: event.target.value });
                      if (dirtyRef.current.delete(asset.id)) {
                        void saveAsset(asset.id);
                      }
                    }}
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
  );
}
