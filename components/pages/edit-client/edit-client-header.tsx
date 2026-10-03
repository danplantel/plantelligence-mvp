"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Trash2 } from "lucide-react";
import { getBenefitsHubOpenPortalUrl } from "@/lib/marketing/hub-url";

/**
 * Phrase the advisor must type to unlock Delete Plan. Deleting removes the whole plan — its
 * benefit pages, documents, contacts and meetings — so a single click is too cheap a
 * confirmation. Mirrors the Delete Benefit dialog's gate; the phrase names the thing being
 * deleted so the two cannot be confused when both are open in different tabs.
 */
const DELETE_PLAN_PHRASE = "delete plan";

interface EditClientHeaderProps {
  clientStatus: string;
  onStatusChange: (status: string) => void;
  onBackClick: () => void;
  hasClient: boolean;
  isFormValid: boolean;
  clientId?: string;
  slug?: string;
  /** The plan being edited — this band's own title, beside the back button. */
  planName?: string;
}

export function EditClientHeader({
  clientStatus,
  onStatusChange,
  onBackClick,
  hasClient,
  isFormValid,
  clientId,
  slug,
  planName,
}: EditClientHeaderProps) {
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // Type-to-confirm gate for the delete dialog.
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  // Trimmed + case-insensitive: forgiving about a pasted trailing space, but still
  // requires the phrase to be typed rather than merely acknowledged.
  const isDeleteConfirmed =
    deleteConfirmText.trim().toLowerCase() === DELETE_PLAN_PHRASE;

  const handleOpenPortal = () => {
    if (clientId) {
      const resolvedSlug = slug || clientId;
      const url = getBenefitsHubOpenPortalUrl(resolvedSlug);
      window.open(url, "_blank");
    }
  };

  const handleDeleteClient = async () => {
    if (!clientId) return;
    try {
      setIsDeleting(true);
      const response = await fetch(`/api/clients/${clientId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete plan");
      }

      const result = await response.json();
      if (result.success) {
        toast.success("Plan deleted successfully");
        setDeleteDialogOpen(false);
        router.push("/clients");
      } else {
        throw new Error(result.error || "Failed to delete plan");
      }
    } catch (err) {
      console.error("Error deleting plan:", err);
      toast.error("Failed to delete plan");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    /**
     * A muted, bordered band so the row reads as the page's header rather than as loose
     * text above the tab panels — every panel below is a white/card surface on the page
     * background. No bottom margin: the page already spaces this from the tabs.
     */
    <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 rounded-xl border bg-muted/40 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/60">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          variant="ghost"
          onClick={onBackClick}
          className="p-2 shrink-0"
          title="Back to Plans"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        {/* The band's own title: which plan is being edited. The sticky bar above carries
            the full "Edit Plan - <company>", so this names the plan rather than repeating
            that prefix — it is what makes this band read as the page's header instead of a
            bare control strip. Truncated so a long company name cannot squeeze the status
            and action controls on the right. */}
        {planName ? (
          <h1 className="min-w-0 truncate text-lg font-semibold text-foreground">
            {planName}
          </h1>
        ) : null}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          {clientStatus === "Active" && !isFormValid && (
            <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200">
              Form incomplete
            </div>
          )}
          {clientStatus !== "Active" && isFormValid && (
            <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded border border-green-200">
              Ready to activate
            </div>
          )}
          <Label
            htmlFor="status-select"
            className="text-sm font-semibold text-gray-700 dark:text-gray-200"
          >
            Status:
          </Label>
          <Select value={clientStatus} onValueChange={onStatusChange}>
            <SelectTrigger className="w-32 h-8 text-sm font-medium border-2 border-accent-blue bg-white dark:bg-gray-800 dark:text-gray-100 hover:bg-accent-blue/5 dark:hover:bg-accent-blue/10 focus:ring-2 focus:ring-accent-blue/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Draft">Draft</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="default"
          size="sm"
          onClick={handleOpenPortal}
          disabled={!hasClient || !clientId}
          className="font-medium w-32 justify-center"
        >
          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
          Open Portal
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setDeleteDialogOpen(true)}
          disabled={!hasClient || !clientId || isDeleting}
          className="font-medium w-32 justify-center text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Delete Plan
        </Button>
      </div>

      {/* Deleting a plan is destructive and irreversible, so it asks first and requires the
          advisor to type the phrase — Radix's AlertDialog ignores Escape and outside clicks,
          so the answer is explicit. Mirrors the Delete Benefit dialog. */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          // Clear the typed phrase on every close, so a reopen starts locked again
          // instead of leaving the button already unlocked.
          if (!open) setDeleteConfirmText("");
        }}
        onConfirm={handleDeleteClient}
        title="Delete Plan?"
        description="This removes this plan — its benefit pages, documents, contacts and meetings — and cannot be undone."
        confirmText="Yes, delete"
        cancelText="No, keep it"
        variant="destructive"
        isLoading={isDeleting}
        loadingText="Deleting..."
        confirmDisabled={!isDeleteConfirmed}
      >
        <div className="mt-1 space-y-1.5">
          <Label
            htmlFor="delete-plan-confirm"
            className="text-xs font-normal text-muted-foreground"
          >
            Type{" "}
            <span className="font-mono font-semibold text-foreground">
              {DELETE_PLAN_PHRASE}
            </span>{" "}
            to confirm
          </Label>
          <Input
            id="delete-plan-confirm"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder={DELETE_PLAN_PHRASE}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}
