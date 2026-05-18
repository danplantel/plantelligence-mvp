"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { User, Users } from "lucide-react";
import { ContactType } from "@/types/new-client-wizard";
import { cn } from "@/lib/utils";

interface ContactTypeSelectorProps {
  value: ContactType;
  onChange: (value: ContactType) => void;
  disabled?: boolean;
}

export function ContactTypeSelector({
  value,
  onChange,
  disabled = false,
}: ContactTypeSelectorProps) {
  return (
    <div className="flex flex-row items-center justify-between space-y-2">
      <Label>Contact Type : </Label>
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={value === "individual" ? "default" : "outline"}
          onClick={() => !disabled && onChange("individual")}
          disabled={disabled}
          className={cn(
            "flex items-center justify-center gap-2 h-8 px-4",
            value === "individual"
              ? "bg-accent-blue text-white hover:opacity-90"
              : "bg-white text-gray-700 hover:bg-gray-50",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          <User className="w-4 h-4" />
          Individual
        </Button>
        <Button
          type="button"
          variant={value === "team_support" ? "default" : "outline"}
          onClick={() => !disabled && onChange("team_support")}
          disabled={disabled}
          className={cn(
            "flex items-center justify-center gap-2 h-8 px-4",
            value === "team_support"
              ? "bg-accent-blue text-white hover:opacity-90"
              : "bg-white text-gray-700 hover:bg-gray-50",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          <Users className="w-4 h-4" />
          Team/Support Line
        </Button>
      </div>
    </div>
  );
}
