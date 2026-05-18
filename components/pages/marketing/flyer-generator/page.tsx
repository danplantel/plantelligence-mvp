"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  RefreshCw,
  Sparkles,
  Download,
  Archive,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FLYER_MODES,
  FLYER_MODE_LABELS,
  type FlyerMode,
} from "@/lib/marketing/flyer-modes";
import { StickyPlanCombobox } from "@/components/plan-selector/sticky-plan-combobox";
import {
  persistPlanSelection,
  resolveStickyPlanId,
} from "@/lib/plan-selector-storage";

interface ClientOption {
  id: string;
  companyName: string;
  status?: string;
}

interface FlyerLibraryRow {
  id: string;
  mode: string;
  headline: string;
  title: string | null;
  hubUrlSnapshot: string;
  createdAt: string;
  archivedAt: string | null;
}

const HUB_CATEGORY_OPTIONS = [
  "Retirement",
  "Group Health",
  "Group Life",
  "Other Benefits",
] as const;

export function MarketingFlyerGeneratorPage() {
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const marketingStickyInit = useRef(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [clientId, setClientId] = useState<string>("");

  const [mode, setMode] = useState<FlyerMode>("hub_promo_general");
  const [category, setCategory] = useState<string>("Retirement");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingDetail, setMeetingDetail] = useState("");
  const [userHint, setUserHint] = useState("");

  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [cta, setCta] = useState("");
  const [flyerTitle, setFlyerTitle] = useState("");

  const [loadingCopy, setLoadingCopy] = useState(false);
  const [loadingRender, setLoadingRender] = useState(false);

  const [flyers, setFlyers] = useState<FlyerLibraryRow[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);

  const [archiveTarget, setArchiveTarget] = useState<FlyerLibraryRow | null>(
    null,
  );

  const hubDisplayUrl = useMemo(() => {
    if (!clientId || typeof window === "undefined") return "";
    const base =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      window.location.origin;
    return `${base}/new/view/${clientId}`;
  }, [clientId]);

  const modeOptionsPayload = useMemo(() => {
    if (mode === "hub_promo_category") {
      return { category };
    }
    if (mode === "meetings_invite" || mode === "meetings_reminder") {
      const o: Record<string, string> = {};
      if (meetingTitle.trim()) o.meetingTitle = meetingTitle.trim();
      if (meetingDetail.trim()) o.meetingDetail = meetingDetail.trim();
      return Object.keys(o).length ? o : undefined;
    }
    return undefined;
  }, [mode, category, meetingTitle, meetingDetail]);

  const fetchClients = useCallback(async () => {
    try {
      setLoadingClients(true);
      const res = await fetch("/api/clients?limit=200&status=all");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to load plans");
      const list = (json.data || []).filter(
        (c: ClientOption) =>
          c.status === "Active" ||
          c.status === "Draft" ||
          !c.status,
      ) as ClientOption[];
      setClients(list);
    } catch (e) {
      console.error(e);
      toast({
        title: "Could not load plans",
        variant: "destructive",
      });
    } finally {
      setLoadingClients(false);
    }
  }, [toast]);

  const fetchLibrary = useCallback(async () => {
    if (!clientId) {
      setFlyers([]);
      return;
    }
    try {
      setLoadingLibrary(true);
      const params = new URLSearchParams({ clientId });
      if (includeArchived) params.set("includeArchived", "1");
      const res = await fetch(`/api/marketing/flyers?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        const hint =
          typeof json.details === "string" ? json.details : json.error;
        throw new Error(hint || "Failed to load flyers");
      }
      setFlyers(Array.isArray(json.data) ? json.data : []);
    } catch (e) {
      console.error(e);
      toast({
        title: "Could not load flyer library",
        description:
          e instanceof Error
            ? e.message
            : "Run prisma db push if the MarketingFlyer collection is missing.",
        variant: "destructive",
      });
      setFlyers([]);
    } finally {
      setLoadingLibrary(false);
    }
  }, [clientId, includeArchived, toast]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  // Sticky plan + ?planId= (lastPlanId_marketing)
  useEffect(() => {
    if (clients.length === 0 || marketingStickyInit.current) return;
    const urlPlan = searchParams.get("planId")?.trim();
    if (urlPlan && clients.some((c) => c.id === urlPlan)) {
      setClientId(urlPlan);
      persistPlanSelection("marketing", urlPlan);
      marketingStickyInit.current = true;
      return;
    }
    const resolved = resolveStickyPlanId(clients, "marketing", null);
    if (resolved) setClientId(resolved);
    marketingStickyInit.current = true;
  }, [clients, searchParams]);

  const handleMarketingPlanChange = (id: string) => {
    setClientId(id);
    const params = new URLSearchParams(window.location.search);
    params.set("planId", id);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleGenerateCopy = async () => {
    if (!clientId) {
      toast({ title: "Select a plan first", variant: "destructive" });
      return;
    }
    setLoadingCopy(true);
    try {
      const res = await fetch("/api/marketing/flyers/generate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          mode,
          modeOptions: modeOptionsPayload ?? null,
          userHint: userHint.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Copy generation failed");
      const d = json.data;
      setHeadline(d.headline);
      setBody(d.body);
      setCta(d.cta);
      toast({
        title: "Copy ready",
        description: d.aiModel
          ? `Model: ${d.aiModel}`
          : "Using built-in placeholder copy (set OPENAI_API_KEY for AI).",
      });
    } catch (e) {
      toast({
        title: "Generation failed",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setLoadingCopy(false);
    }
  };

  const handleRender = async () => {
    if (!clientId) {
      toast({ title: "Select a plan first", variant: "destructive" });
      return;
    }
    if (!headline.trim() || !body.trim() || !cta.trim()) {
      toast({
        title: "Headline, body, and CTA are required",
        variant: "destructive",
      });
      return;
    }
    setLoadingRender(true);
    try {
      const res = await fetch("/api/marketing/flyers/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          mode,
          modeOptions: modeOptionsPayload ?? null,
          headline: headline.trim(),
          body: body.trim(),
          cta: cta.trim(),
          title: flyerTitle.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Render failed");
      toast({
        title: "Flyer saved",
        description: "PDF and PNG are in your library below.",
      });
      await fetchLibrary();
    } catch (e) {
      toast({
        title: "Could not generate flyer",
        description:
          e instanceof Error ? e.message : "Check NEXT_PUBLIC_APP_URL / R2",
        variant: "destructive",
      });
    } finally {
      setLoadingRender(false);
    }
  };

  const downloadUrl = (flyerId: string, format: "pdf" | "png") =>
    `/api/marketing/flyers/${flyerId}/file?format=${format}`;

  const handleArchive = async () => {
    if (!archiveTarget) return;
    try {
      const res = await fetch(`/api/marketing/flyers/${archiveTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Archive failed");
      toast({ title: "Archived" });
      setArchiveTarget(null);
      await fetchLibrary();
    } catch (e) {
      toast({
        title: "Archive failed",
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-8 max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent-blue" />
            Benefits Hub flyer generator
          </CardTitle>
          <CardDescription>
            Generate AI-assisted copy, embed a QR code to this plan&apos;s
            Benefits Hub, and save PDF + PNG to your library.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2 max-w-md">
            <StickyPlanCombobox
              module="marketing"
              plans={clients}
              value={clientId}
              onChange={handleMarketingPlanChange}
              disabled={loadingClients}
              label="Plan"
              placeholder={
                loadingClients ? "Loading plans…" : "Select a plan"
              }
              id="marketing-flyer-plan"
            />
          </div>

          {clientId ? (
            <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
              <p className="text-sm font-medium">Benefits Hub URL (QR target)</p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="text-xs break-all rounded bg-background px-2 py-1 border flex-1 min-w-[200px]">
                  {hubDisplayUrl}
                </code>
                <Button variant="outline" size="sm" asChild>
                  <a href={hubDisplayUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open
                  </a>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Scans use the same URL the server encodes (requires{" "}
                <code className="text-[10px]">NEXT_PUBLIC_APP_URL</code> or{" "}
                <code className="text-[10px]">NEXTAUTH_URL</code> on the server).
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Flyer mode</Label>
              <Select
                value={mode}
                onValueChange={(v) => setMode(v as FlyerMode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {FLYER_MODES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {FLYER_MODE_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {mode === "hub_promo_category" ? (
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HUB_CATEGORY_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {mode === "meetings_invite" || mode === "meetings_reminder" ? (
              <>
                <div className="space-y-2">
                  <Label>Meeting title (optional)</Label>
                  <Input
                    value={meetingTitle}
                    onChange={(e) => setMeetingTitle(e.target.value)}
                    placeholder="e.g. Annual enrollment webinar"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Details (optional)</Label>
                  <Input
                    value={meetingDetail}
                    onChange={(e) => setMeetingDetail(e.target.value)}
                    placeholder="Date, time, or link — passed to AI as context"
                  />
                </div>
              </>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Extra instructions for AI (optional)</Label>
            <Textarea
              value={userHint}
              onChange={(e) => setUserHint(e.target.value)}
              placeholder="Tone, audience, dates to mention…"
              rows={2}
              className="resize-none"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleGenerateCopy()}
              disabled={!clientId || loadingCopy}
            >
              {loadingCopy ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Generate / refresh copy
            </Button>
          </div>

          <div className="space-y-4 border-t pt-6">
            <div className="space-y-2">
              <Label htmlFor="fly-headline">Headline</Label>
              <Input
                id="fly-headline"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Short headline"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fly-body">Body</Label>
              <Textarea
                id="fly-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder="Supporting copy"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fly-cta">Call to action</Label>
                <Input
                  id="fly-cta"
                  value={cta}
                  onChange={(e) => setCta(e.target.value)}
                  placeholder="Button label"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fly-title">
                  Library title{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="fly-title"
                  value={flyerTitle}
                  onChange={(e) => setFlyerTitle(e.target.value)}
                  placeholder="Defaults to headline"
                />
              </div>
            </div>

            <Button
              type="button"
              onClick={() => void handleRender()}
              disabled={!clientId || loadingRender}
              className="w-full sm:w-auto"
            >
              {loadingRender ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Generate PDF + PNG & save to library
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between space-y-0">
          <div>
            <CardTitle>Flyer library</CardTitle>
            <CardDescription>
              Downloads open in a new tab (same session).
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="arch"
                checked={includeArchived}
                onCheckedChange={(v) =>
                  setIncludeArchived(v === true)
                }
              />
              <Label htmlFor="arch" className="text-sm font-normal">
                Show archived
              </Label>
            </div>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => void fetchLibrary()}
              disabled={!clientId || loadingLibrary}
            >
              <RefreshCw
                className={`h-4 w-4 mr-1 ${loadingLibrary ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!clientId ? (
            <p className="text-sm text-muted-foreground">
              Select a plan to see saved flyers.
            </p>
          ) : loadingLibrary ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-8">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : flyers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6">
              No flyers yet for this plan.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flyers.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {f.title || f.headline}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {f.mode in FLYER_MODE_LABELS
                        ? FLYER_MODE_LABELS[f.mode as FlyerMode]
                        : f.mode}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {new Date(f.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 flex-wrap">
                        <Button variant="ghost" size="sm" asChild>
                          <a
                            href={downloadUrl(f.id, "pdf")}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Download className="h-4 w-4 mr-1" />
                            PDF
                          </a>
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <a
                            href={downloadUrl(f.id, "png")}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Download className="h-4 w-4 mr-1" />
                            PNG
                          </a>
                        </Button>
                        {!f.archivedAt ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            className="text-destructive"
                            onClick={() => setArchiveTarget(f)}
                          >
                            <Archive className="h-4 w-4 mr-1" />
                            Archive
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground px-2 py-1">
                            Archived
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!archiveTarget}
        onOpenChange={(o) => !o && setArchiveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this flyer?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be hidden from the default library list. Files remain in
              storage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleArchive()}>
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
