"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";

interface EditClientLoadingProps {
  onBackClick: () => void;
}

export function EditClientLoading({ onBackClick }: EditClientLoadingProps) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex items-center gap-2">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span>Loading client data...</span>
      </div>
    </div>
  );
}

interface EditClientErrorProps {
  error: string;
  onBackClick: () => void;
}

export function EditClientError({ error, onBackClick }: EditClientErrorProps) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Client Not Found
        </h2>
        <p className="text-gray-600 mb-6">{error}</p>
        <Button onClick={onBackClick}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Clients
        </Button>
      </div>
    </div>
  );
}
