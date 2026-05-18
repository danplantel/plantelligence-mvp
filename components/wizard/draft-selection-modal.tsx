"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Calendar, Loader2, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { BrandingImage } from "@/components/ui/branding-image";

export interface Draft {
  id: string;
  companyName: string;
  companyWebsite: string | null;
  companyLogo: string | null;
  brandColor: string | null;
  secondaryColor: string | null;
  updatedAt: string;
  createdAt: string;
}

interface DraftSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDraft: (draftId: string) => void;
  prefetchedDrafts?: Draft[];
  headline?: string;
  description?: string;
  onContinueNewPlan?: () => void;
  continueLabel?: string;
  onRefreshDrafts?: () => Promise<Draft[]>;
}

export function DraftSelectionModal({
  isOpen,
  onClose,
  onSelectDraft,
  prefetchedDrafts,
  headline = "Load Draft",
  description = "Select a draft to continue working on it",
  onContinueNewPlan,
  continueLabel = "Continue to new plan",
  onRefreshDrafts,
}: DraftSelectionModalProps) {
  const [drafts, setDrafts] = useState<Draft[]>(prefetchedDrafts || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (prefetchedDrafts) {
      setDrafts(prefetchedDrafts);
    }
  }, [prefetchedDrafts]);

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/new-client-wizard/list-drafts");
      const data = await response.json();

      if (data.success) {
        setDrafts(data.drafts);
        return data.drafts as Draft[];
      } else {
        setError("Failed to load drafts");
        return [];
      }
    } catch (err) {
      console.error("Error fetching drafts:", err);
      setError("Failed to load drafts");
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    if (onRefreshDrafts) {
      setLoading(true);
      setError(null);
      try {
        const latest = await onRefreshDrafts();
        if (Array.isArray(latest)) {
          setDrafts(latest);
        }
      } catch (err) {
        console.error("Error refreshing drafts:", err);
        setError("Failed to load drafts");
      } finally {
        setLoading(false);
      }
      return;
    }

    await fetchDrafts();
  }, [fetchDrafts, onRefreshDrafts]);

  useEffect(() => {
    if (!isOpen) return;
    if (prefetchedDrafts && prefetchedDrafts.length >= 0) {
      // Use prefetched drafts when provided; allow manual refresh if needed
      if (prefetchedDrafts.length === 0) {
        fetchDrafts();
      }
      return;
    }
    fetchDrafts();
  }, [fetchDrafts, isOpen, prefetchedDrafts]);

  const handleSelectDraft = (draftId: string) => {
    onSelectDraft(draftId);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{headline}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex justify-end pb-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                loading ? "animate-spin text-muted-foreground" : ""
              }`}
            />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-destructive">{error}</div>
        ) : drafts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No drafts found</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px] pr-4">
            <div className="space-y-3">
              {drafts.map((draft) => (
                <div
                  key={draft.id}
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        {draft.companyLogo && (
                          <BrandingImage
                            src={draft.companyLogo}
                            alt={draft.companyName}
                            className="w-10 h-10 object-contain rounded"
                          />
                        )}
                        <div className="min-w-0 flex-1 max-w-[350px]">
                          <div className="font-semibold text-lg truncate">
                            {draft.companyName}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>
                            Updated{" "}
                            {formatDistanceToNow(new Date(draft.updatedAt), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={() => handleSelectDraft(draft.id)}
                      size="sm"
                    >
                      Select
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <div className="flex flex-col gap-2 pt-4 border-t sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {drafts.length} draft{drafts.length === 1 ? "" : "s"} found
          </span>
          <div className="flex flex-wrap gap-2 justify-end">
            {onContinueNewPlan && (
              <Button variant="secondary" onClick={onContinueNewPlan}>
                {continueLabel}
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
