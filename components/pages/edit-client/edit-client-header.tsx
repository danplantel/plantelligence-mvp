"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Eye } from "lucide-react";

interface EditClientHeaderProps {
  clientStatus: string;
  onStatusChange: (status: string) => void;
  onPreviewClick: () => void;
  onBackClick: () => void;
  hasClient: boolean;
  isFormValid: boolean;
}

export function EditClientHeader({
  clientStatus,
  onStatusChange,
  onPreviewClick,
  onBackClick,
  hasClient,
  isFormValid,
}: EditClientHeaderProps) {
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
            className="text-sm font-semibold text-gray-700"
          >
            Status:
          </Label>
          <Select value={clientStatus} onValueChange={onStatusChange}>
            <SelectTrigger className="w-32 h-10 font-medium border-2 border-accent-blue bg-white hover:bg-accent-blue/5 focus:ring-2 focus:ring-accent-blue/20">
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
          onClick={onPreviewClick}
          disabled={!hasClient}
          className="font-medium px-6"
        >
          <Eye className="mr-2 h-4 w-4" />
          Preview Portal
        </Button>
      </div>
    </div>
  );
}
