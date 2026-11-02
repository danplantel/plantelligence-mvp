"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SectionHeader } from "@/components/wizard/new-client-steps/sections/components/editor-panel-wrapper";
import { useClientPortal } from "@/contexts/client-portal-context";
import {
  normalizeTypographyThemeId,
  TYPOGRAPHY_THEME_LIST,
} from "@/lib/typography-themes";
import { usePortalEditing } from "@/components/portal-editing/portal-editing-provider";

interface HomeDraft {
  companyName: string;
  companyWebsite: string;
  brandColor: string;
  secondaryColor: string;
  typographyTheme: string;
  heroTitle: string;
  heroDescription: string;
  missionHeadline: string;
  missionBody: string;
  appointmentLink: string;
  disclaimers: string;
}

function draftFromClient(clientData: Record<string, any> | null): HomeDraft {
  return {
    companyName: String(clientData?.companyName ?? ""),
    companyWebsite: String(clientData?.companyWebsite ?? ""),
    brandColor: String(clientData?.brandColor ?? "#1F3A60"),
    secondaryColor: String(clientData?.secondaryColor ?? "#6B7280"),
    typographyTheme: normalizeTypographyThemeId(
      clientData?.typographyTheme,
    ),
    heroTitle: String(clientData?.heroTitle ?? ""),
    heroDescription: String(clientData?.heroDescription ?? ""),
    missionHeadline: String(clientData?.missionHeadline ?? ""),
    missionBody: String(clientData?.missionBody ?? ""),
    appointmentLink: String(clientData?.appointmentLink ?? ""),
    disclaimers: String(clientData?.disclaimers ?? ""),
  };
}

/**
 * Home page editor — plan-level branding, hero and mission copy.
 *
 * Every keystroke patches the portal context so the live page repaints at once;
 * the PUT is debounced and the saved row remains the source of truth. A failed
 * save reverts the optimistic patch by refetching the portal.
 */
export function PortalHomeEditor() {
  const { clientData } = useClientPortal();
  const {
    planId,
    beginSave,
    finishSave,
    failSave,
    saveState,
    saveError,
    patchClientData,
    refetchPortal,
  } = usePortalEditing();

  const [draft, setDraft] = useState<HomeDraft>(() =>
    draftFromClient(clientData as Record<string, any> | null),
  );
  const hydratedIdRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);

  // Seed once per plan. Later `clientData` changes are the optimistic patches this
  // editor itself wrote, so resetting here would fight the user's typing.
  useEffect(() => {
    const id = clientData?.id ?? null;
    if (!id || hydratedIdRef.current === id) return;
    hydratedIdRef.current = id;
    setDraft(draftFromClient(clientData as Record<string, any>));
  }, [clientData]);

  const update = useCallback(
    <K extends keyof HomeDraft>(field: K, value: HomeDraft[K]) => {
      dirtyRef.current = true;
      setDraft((previous) => ({ ...previous, [field]: value }));
      patchClientData({ [field]: value });
    },
    [patchClientData],
  );

  const save = useCallback(async () => {
    if (!planId) return;
    beginSave();
    try {
      const response = await fetch(`/api/clients/${planId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Could not save this page.");
      }
      finishSave();
    } catch (error) {
      failSave(
        error instanceof Error ? error.message : "Could not save this page.",
      );
      // The server is the source of truth — pull the rejected values back.
      await refetchPortal();
    }
  }, [planId, draft, beginSave, finishSave, failSave, refetchPortal]);

  // Debounced autosave. The first render is not dirty, so opening the panel never
  // writes a no-op update.
  useEffect(() => {
    if (!dirtyRef.current) return;
    const timer = setTimeout(() => {
      dirtyRef.current = false;
      void save();
    }, 700);
    return () => clearTimeout(timer);
  }, [draft, save]);

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
        <SectionHeader number={1} title="Plan identity" />
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Company name</Label>
            <Input
              value={draft.companyName}
              onChange={(event) => update("companyName", event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Company website</Label>
            <Input
              value={draft.companyWebsite}
              onChange={(event) =>
                update("companyWebsite", event.target.value)
              }
              placeholder="https://example.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Primary colour</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Primary colour"
                  value={draft.brandColor}
                  onChange={(event) =>
                    update("brandColor", event.target.value)
                  }
                  className="h-8 w-10 cursor-pointer rounded border border-input bg-transparent"
                />
                <Input
                  value={draft.brandColor}
                  onChange={(event) =>
                    update("brandColor", event.target.value)
                  }
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Secondary colour</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Secondary colour"
                  value={draft.secondaryColor}
                  onChange={(event) =>
                    update("secondaryColor", event.target.value)
                  }
                  className="h-8 w-10 cursor-pointer rounded border border-input bg-transparent"
                />
                <Input
                  value={draft.secondaryColor}
                  onChange={(event) =>
                    update("secondaryColor", event.target.value)
                  }
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Typography</Label>
            <select
              value={draft.typographyTheme}
              onChange={(event) =>
                update("typographyTheme", event.target.value)
              }
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              {TYPOGRAPHY_THEME_LIST.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section>
        <SectionHeader number={2} title="Hero" />
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Hero title</Label>
            <Input
              value={draft.heroTitle}
              onChange={(event) => update("heroTitle", event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Hero description</Label>
            <Textarea
              value={draft.heroDescription}
              onChange={(event) =>
                update("heroDescription", event.target.value)
              }
              rows={3}
            />
          </div>
        </div>
      </section>

      <section>
        <SectionHeader number={3} title="Mission" />
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Mission headline</Label>
            <Input
              value={draft.missionHeadline}
              onChange={(event) =>
                update("missionHeadline", event.target.value)
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Mission body</Label>
            <Textarea
              value={draft.missionBody}
              onChange={(event) => update("missionBody", event.target.value)}
              rows={4}
            />
          </div>
        </div>
      </section>

      <section>
        <SectionHeader number={4} title="Calls to action" />
        <div className="space-y-1">
          <Label className="text-xs">Appointment link</Label>
          <Input
            value={draft.appointmentLink}
            onChange={(event) =>
              update("appointmentLink", event.target.value)
            }
            placeholder="https://calendly.com/..."
          />
        </div>
      </section>

      <section>
        <SectionHeader number={5} title="Disclosures" />
        <div className="space-y-1">
          <Label className="text-xs">Footer disclaimers</Label>
          <Textarea
            value={draft.disclaimers}
            onChange={(event) => update("disclaimers", event.target.value)}
            rows={6}
          />
        </div>
      </section>
    </div>
  );
}
