"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CaretSortIcon } from "@radix-ui/react-icons";
import { X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface MultiSelectDropdownProps {
  options: string[];
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  placeholder?: string;
  allowCustomInput?: boolean;
  customInputPlaceholder?: string;
  className?: string;
  maxSelections?: number;
  displayMode?: "chips" | "comma";
  disabled?: boolean;
}

export function MultiSelectDropdown({
  options,
  selectedValues = [],
  onSelectionChange,
  placeholder = "Select options...",
  allowCustomInput = true,
  customInputPlaceholder = "Add custom option",
  className,
  maxSelections,
  displayMode = "chips",
  disabled = false,
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter options based on search term
  const filteredOptions = options.filter(
    (option) =>
      option.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !selectedValues.includes(option),
  );

  const handleToggleOption = (option: string, checked: boolean) => {
    if (checked) {
      // Check if we've reached the maximum selections
      if (maxSelections && selectedValues.length >= maxSelections) {
        return;
      }
      onSelectionChange([...selectedValues, option]);
      // Don't close popover - allow multiple selections
    } else {
      onSelectionChange(selectedValues.filter((v) => v !== option));
    }
  };

  const handleRemoveValue = (value: string) => {
    onSelectionChange(selectedValues.filter((v) => v !== value));
  };

  const handleCustomInputSubmit = () => {
    if (customInput.trim() && !selectedValues.includes(customInput.trim())) {
      // Check if we've reached the maximum selections
      if (maxSelections && selectedValues.length >= maxSelections) {
        return;
      }
      onSelectionChange([...selectedValues, customInput.trim()]);
      setCustomInput("");
      setIsOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (allowCustomInput && customInput.trim()) {
        handleCustomInputSubmit();
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setSearchTerm("");
      setCustomInput("");
    }
  };

  const handleDeselectAll = () => {
    onSelectionChange([]);
  };

  // Show all options (including selected ones) for multi-select
  const displayOptions = options.filter((option) =>
    option.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className={cn("relative", className)}>
      {/* Selected values as chips - show above when displayMode is "chips" */}
      {selectedValues.length > 0 && displayMode === "chips" && (
        <div className="mb-3">
          <div className="flex flex-wrap gap-2">
            {selectedValues.map((value) => (
              <Badge
                key={value}
                variant="secondary"
                className="flex items-center gap-1 px-2 py-1 text-xs"
              >
                {value}
                <button
                  type="button"
                  onClick={() => handleRemoveValue(value)}
                  className="ml-1 hover:bg-background rounded-full p-0.5 transition-colors"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Popover open={isOpen && !disabled} onOpenChange={(open) => {
        if (!disabled) {
          setIsOpen(open);
        }
      }}>
        <PopoverTrigger asChild>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={disabled}
              className={cn(
                "flex h-9 flex-1 items-center justify-between rounded-lg border bg-transparent px-3 py-1 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-50 !border-gray-300 dark:!border-gray-600 focus:!border-accent-blue focus:ring-accent-blue/20",
                className,
              )}
            >
              <span
                className={cn(
                  selectedValues.length === 0 && "text-muted-foreground",
                )}
              >
                {selectedValues.length === 0
                  ? placeholder
                  : displayMode === "comma"
                  ? selectedValues.join(", ")
                  : `${selectedValues.length} selected`}
              </span>
              <CaretSortIcon className="h-4 w-4 opacity-50" />
            </button>
            {selectedValues.length > 0 && displayMode === "chips" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDeselectAll}
                className="text-xs h-9 px-3 font-medium flex-shrink-0 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Clear All
              </Button>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="w-80 p-0"
          align="start"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
        >
          {/* Search input */}
          <div className="p-2 border-b">
            <Input
              ref={inputRef}
              placeholder="Search options..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8"
            />
          </div>

          {/* Options list */}
          <div className="max-h-48 overflow-y-auto p-1">
            {displayOptions.length > 0 ? (
              displayOptions.map((option) => {
                const isSelected = selectedValues.includes(option);
                return (
                  <div
                    key={option}
                    className={cn(
                      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-2 text-sm outline-none hover:bg-accent",
                      isSelected && "bg-accent"
                    )}
                    onClick={() => handleToggleOption(option, !isSelected)}
                  >
                    <div className="flex items-center space-x-2 flex-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300"
                      />
                      <span className="flex-1">{option}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                {searchTerm
                  ? "No options found"
                  : "No options available"}
              </div>
            )}
          </div>

          {/* Custom input */}
          {allowCustomInput && (
            <div className="p-2 border-t">
              <div className="flex gap-2">
                <Input
                  placeholder={customInputPlaceholder}
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-8"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCustomInputSubmit}
                  disabled={
                    !customInput.trim() ||
                    selectedValues.includes(customInput.trim())
                  }
                  className="px-2"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
