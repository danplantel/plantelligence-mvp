"use client";

import { Button } from "@/components/ui/button";
import { RefreshCw, Plus, LayoutGrid, List } from "lucide-react";
import Link from "next/link";

interface DocumentsHeaderProps {
  viewMode: "table" | "cards";
  onViewModeChange: (mode: "table" | "cards") => void;
  onRefresh: () => void;
}

export function DocumentsHeader({
  viewMode,
  onViewModeChange,
  onRefresh,
}: DocumentsHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">All Documents</h1>
        <p className="text-gray-600">
          View and manage all uploaded documents across all clients
        </p>
      </div>
      <div className="flex items-center space-x-2">
        <Button
          onClick={() => {
            const newMode = viewMode === "table" ? "cards" : "table";
            onViewModeChange(newMode);
            localStorage.setItem("documentsViewMode", newMode);
          }}
          variant="outline"
          title={
            viewMode === "table"
              ? "Switch to cards view"
              : "Switch to table view"
          }
        >
          {viewMode === "table" ? (
            <>
              <LayoutGrid className="mr-2 h-4 w-4" />
              Cards
            </>
          ) : (
            <>
              <List className="mr-2 h-4 w-4" />
              Table
            </>
          )}
        </Button>
        <Button onClick={onRefresh} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
        <Link href="/documents?tab=upload">
          <Button className="bg-accent-blue hover:bg-accent-blue/90 text-white">
            <Plus className="h-4 w-4 mr-2" />
            Upload Documents
          </Button>
        </Link>
      </div>
    </div>
  );
}
