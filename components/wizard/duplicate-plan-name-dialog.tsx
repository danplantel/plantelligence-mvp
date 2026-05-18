"use client";

import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { suggestPlanNameAlternatives } from "@/lib/suggest-plan-name";
import { toast } from "sonner";

interface DuplicatePlanNameDialogProps {
  open: boolean;
  companyName: string;
  onCancel: () => void;
  onOverwrite: () => Promise<void>;
  onSaveAsNew: (name: string) => Promise<void>;
}

export function DuplicatePlanNameDialog({
  open,
  companyName,
  onCancel,
  onOverwrite,
  onSaveAsNew,
}: DuplicatePlanNameDialogProps) {
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState<"overwrite" | "saveAsNew" | null>(null);

  useEffect(() => {
    if (open) {
      const suggestions = suggestPlanNameAlternatives(companyName);
      setNewName(suggestions[0] || "");
      setBusy(null);
    }
  }, [open, companyName]);

  const handleOverwrite = async () => {
    setBusy("overwrite");
    try {
      await onOverwrite();
      toast.success("Draft saved", {
        description:
          "The existing plan was updated with your current wizard data.",
      });
    } catch (e: any) {
      toast.error("Could not save", {
        description: e?.message || "Try again or contact support.",
      });
    } finally {
      setBusy(null);
    }
  };

  const handleSaveAsNew = async () => {
    const t = newName.trim();
    if (!t) {
      toast.error("Enter a plan name");
      return;
    }
    setBusy("saveAsNew");
    try {
      await onSaveAsNew(t);
      toast.success("Draft saved", {
        description: `Saved as "${t}".`,
      });
    } catch (e: any) {
      toast.error("Could not save", {
        description: e?.message || "That name may still be in use.",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && !busy && onCancel()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Plan name already in use</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                A plan named{" "}
                <span className="font-medium text-foreground">
                  &quot;{companyName}&quot;
                </span>{" "}
                already exists. Continuing with{" "}
                <strong className="text-foreground">Overwrite</strong> replaces
                that plan and its saved data (including documents you upload in
                this session) with what you have in the wizard now.
              </p>
              <p>
                Choose <strong className="text-foreground">Save as new</strong>{" "}
                to keep the existing plan and store this one under a different
                name.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="duplicate-plan-new-name">New plan name</Label>
          <Input
            id="duplicate-plan-new-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Ayres Hotel Copy"
            disabled={!!busy}
          />
        </div>

        <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <div className="flex w-full flex-wrap gap-2 justify-end">
            <AlertDialogCancel disabled={!!busy} onClick={onCancel}>
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={!!busy}
              onClick={() => void handleOverwrite()}
            >
              {busy === "overwrite" ? "Saving…" : "Overwrite existing plan"}
            </Button>
            <Button
              type="button"
              disabled={!!busy}
              onClick={() => void handleSaveAsNew()}
            >
              {busy === "saveAsNew" ? "Saving…" : "Save as new"}
            </Button>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
