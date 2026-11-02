"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SectionHeader } from "@/components/wizard/new-client-steps/sections/components/editor-panel-wrapper";
import { usePortalEditing } from "@/components/portal-editing/portal-editing-provider";
import {
  KEY_CONTACT_CARD_STYLE_CHOICES,
  normalizeKeyContactCardStyle,
} from "@/lib/key-contact-card-style";

const fetcher = (url: string) => fetch(url).then((response) => response.json());

/** The stored API category for a hub route. A custom hub is the Plan Sponsor row. */
export function portalBenefitApiCategory(category: string | null): string {
  return category === "Other" ? "Company / Plan Sponsor" : category || "";
}

interface BenefitDraft {
  title: string;
  shortDescription: string;
  journeyHeader: string;
  journeySubtitle: string;
  journeyBodyText: string;
  insurancePlanId: string;
  insuranceLoginUrl: string;
  planVideo: string;
  planVideoLabel: string;
  planVideoVisible: boolean;
  keyContactCardStyle: "default" | "highlighted";
}

function draftFromBenefit(benefit: Record<string, any> | null): BenefitDraft {
  return {
    title: String(benefit?.title ?? ""),
    shortDescription: String(benefit?.shortDescription ?? ""),
    journeyHeader: String(benefit?.journeyHeader ?? ""),
    journeySubtitle: String(benefit?.journeySubtitle ?? ""),
    journeyBodyText: String(benefit?.journeyBodyText ?? ""),
    insurancePlanId: String(benefit?.insurancePlanId ?? ""),
    insuranceLoginUrl: String(benefit?.insuranceLoginUrl ?? ""),
    planVideo: String(benefit?.planVideo ?? ""),
    planVideoLabel: String(benefit?.planVideoLabel ?? ""),
    planVideoVisible: benefit?.planVideoVisible !== false,
    keyContactCardStyle: normalizeKeyContactCardStyle(
      benefit?.keyContactCardStyle,
    ),
  };
}

/**
 * Benefit hub editor — the page's own copy, materials and video source.
 *
 * The hub page reads the benefit through SWR, so an optimistic `mutate` of that
 * same key repaints the live page while typing. The PUT remains the save.
 */
export function PortalBenefitEditor() {
  const { target, planId, canEditFunction, beginSave, finishSave, failSave, saveState, saveError } =
    usePortalEditing();
  const { mutate } = useSWRConfig();
  const category = target?.category ?? null;
  const apiCategory = portalBenefitApiCategory(category);
  const benefitKey = useMemo(
    () =>
      planId && apiCategory
        ? `/api/clients/${planId}/benefits/${encodeURIComponent(apiCategory)}?forPortal=1&withTopics=1`
        : null,
    [planId, apiCategory],
  );
  const { data } = useSWR(benefitKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const [draft, setDraft] = useState<BenefitDraft>(() =>
    draftFromBenefit(data?.benefit ?? null),
  );
  const hydratedRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!benefitKey || !data?.benefit) return;
    if (hydratedRef.current === benefitKey) return;
    hydratedRef.current = benefitKey;
    setDraft(draftFromBenefit(data.benefit));
  }, [benefitKey, data]);

  const patchBenefit = useCallback(
    (patch: Partial<BenefitDraft>) => {
      dirtyRef.current = true;
      setDraft((previous) => ({ ...previous, ...patch }));
      if (benefitKey) {
        void mutate(
          benefitKey,
          (current: any) =>
            current?.benefit
              ? {
                  ...current,
                  benefit: { ...current.benefit, ...patch },
                }
              : current,
          { revalidate: false },
        );
      }
    },
    [benefitKey, mutate],
  );

  const save = useCallback(async () => {
    if (!planId || !apiCategory) return;
    beginSave();
    try {
      const response = await fetch(
        `/api/clients/${planId}/benefits/${encodeURIComponent(apiCategory)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Could not save this benefit.");
      }
      finishSave();
      if (benefitKey) await mutate(benefitKey);
    } catch (error) {
      failSave(
        error instanceof Error ? error.message : "Could not save this benefit.",
      );
      if (benefitKey) await mutate(benefitKey);
    }
  }, [
    planId,
    apiCategory,
    draft,
    benefitKey,
    mutate,
    beginSave,
    finishSave,
    failSave,
  ]);

  useEffect(() => {
    if (!dirtyRef.current) return;
    const timer = setTimeout(() => {
      dirtyRef.current = false;
      void save();
    }, 700);
    return () => clearTimeout(timer);
  }, [draft, save]);

  // The video fields save through the benefit row, so they need both the
  // benefit-edit gate and the video grant. A video-only viewer gets the read-only
  // page rather than a control whose save would be refused.
  const canEditVideo =
    canEditFunction("video") && canEditFunction("create_benefits");

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

      <section>
        <SectionHeader number={1} title="Hub copy" />
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Benefit title</Label>
            <Input
              value={draft.title}
              onChange={(event) => patchBenefit({ title: event.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Short description</Label>
            <Textarea
              value={draft.shortDescription}
              onChange={(event) =>
                patchBenefit({ shortDescription: event.target.value })
              }
              rows={3}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Journey header</Label>
            <Input
              value={draft.journeyHeader}
              onChange={(event) =>
                patchBenefit({ journeyHeader: event.target.value })
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Journey subtitle</Label>
            <Input
              value={draft.journeySubtitle}
              onChange={(event) =>
                patchBenefit({ journeySubtitle: event.target.value })
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Journey body</Label>
            <Textarea
              value={draft.journeyBodyText}
              onChange={(event) =>
                patchBenefit({ journeyBodyText: event.target.value })
              }
              rows={4}
            />
          </div>
        </div>
      </section>

      <section>
        <SectionHeader number={2} title="Access & materials" />
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Plan / Group ID</Label>
            <Input
              value={draft.insurancePlanId}
              onChange={(event) =>
                patchBenefit({ insurancePlanId: event.target.value })
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Login URL</Label>
            <Input
              value={draft.insuranceLoginUrl}
              onChange={(event) =>
                patchBenefit({ insuranceLoginUrl: event.target.value })
              }
              placeholder="https://..."
            />
          </div>
        </div>
      </section>

      <section>
        <SectionHeader number={3} title="Have Questions? card style" />
        <select
          value={draft.keyContactCardStyle}
          onChange={(event) =>
            patchBenefit({
              keyContactCardStyle: event.target.value as
                | "default"
                | "highlighted",
            })
          }
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
        >
          {KEY_CONTACT_CARD_STYLE_CHOICES.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      </section>

      {canEditVideo && (
        <section>
          <SectionHeader number={4} title="Video" />
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Video URL</Label>
              <Input
                value={draft.planVideo}
                onChange={(event) =>
                  patchBenefit({ planVideo: event.target.value })
                }
                placeholder="https://..."
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Video label</Label>
              <Input
                value={draft.planVideoLabel}
                onChange={(event) =>
                  patchBenefit({ planVideoLabel: event.target.value })
                }
              />
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={draft.planVideoVisible}
                onChange={(event) =>
                  patchBenefit({ planVideoVisible: event.target.checked })
                }
              />
              Show the video section
            </label>
          </div>
        </section>
      )}
    </div>
  );
}
