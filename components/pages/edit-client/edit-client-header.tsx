"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
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
import {
  getBenefitsHubAbsoluteUrl,
  getBenefitsHubPath,
} from "@/lib/marketing/hub-url";

interface EditClientHeaderProps {
  clientStatus: string;
  onStatusChange: (status: string) => void;
  onBackClick: () => void;
  hasClient: boolean;
  isFormValid: boolean;
  clientId?: string;
  slug?: string;
}

export function EditClientHeader({
  clientStatus,
  onStatusChange,
  onBackClick,
  hasClient,
  isFormValid,
  clientId,
  slug,
}: EditClientHeaderProps) {
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const jsonFetcher = (url: string) => fetch(url).then((r) => r.json());
  const { data: profileData } = useSWR("/api/profile", jsonFetcher, {
    keepPreviousData: true,
    dedupingInterval: 60_000,
    revalidateOnFocus: false,
  });
  const userSubdomain: string | undefined =
    profileData?.subdomain || undefined;

  const handleOpenPortal = () => {
    if (clientId) {
      const resolvedSlug = slug || clientId;
      const url =
        process.env.NODE_ENV === "development"
          ? `${window.location.origin}${getBenefitsHubPath(resolvedSlug)}`
          : getBenefitsHubAbsoluteUrl(resolvedSlug, userSubdomain);
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
        throw new Error("Failed to delete client");
      }

      const result = await response.json();
      if (result.success) {
        toast.success("Client deleted successfully");
        setDeleteDialogOpen(false);
        router.push("/new/clients");
      } else {
        throw new Error(result.error || "Failed to delete client");
      }
    } catch (err) {
      console.error("Error deleting client:", err);
      toast.error("Failed to delete client");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex items-center justify-between mx-auto max-w-5xl ">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBackClick} className="p-2">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <p className="text-muted-foreground">
            Update plan information and settings
          </p>
        </div>
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
            <SelectTrigger className="w-32 h-10 font-medium border-2 border-accent-blue bg-white dark:bg-gray-800 dark:text-gray-100 hover:bg-accent-blue/5 dark:hover:bg-accent-blue/10 focus:ring-2 focus:ring-accent-blue/20">
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
          onClick={handleOpenPortal}
          disabled={!hasClient || !clientId}
          className="font-medium px-6"
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Open Portal
        </Button>

        <Button
          variant="outline"
          onClick={() => setDeleteDialogOpen(true)}
          disabled={!hasClient || !clientId || isDeleting}
          className="font-medium px-6 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteClient}
        title="Delete Client?"
        description="Are you sure you want to delete this client? This action cannot be undone and will also delete all associated documents, meetings, and other data."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        isLoading={isDeleting}
      />
    </div>
  );
}
