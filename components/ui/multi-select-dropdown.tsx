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
  /** When true, shows Cancel/OK buttons in the popover footer. Selections
   *  are staged locally and only applied when the user clicks OK. */
  showActionButtons?: boolean;
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
  showActionButtons = false,
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // When showActionButtons is true, selections are staged locally until the
  // user clicks OK.  pendingSelections is initialised from selectedValues
  // each time the popover opens.
  const [pendingSelections, setPendingSelections] = useState<string[]>(selectedValues);

  // Sync pendingSelections with selectedValues when popover opens
  // and when selectedValues changes externally while closed.
  const prevOpenRef = useRef(isOpen);
  if (isOpen && !prevOpenRef.current) {
    // Popover just opened — initialise pending from actual values
    // eslint-disable-next-line react-hooks/rules-of-hooks -- intentional sync, not a hook call
    setPendingSelections(selectedValues);
  }
  if (prevOpenRef.current !== isOpen) {
    prevOpenRef.current = isOpen;
  }

  // Resolve the effective values: pending when popover is open with action buttons,
  // otherwise the official selectedValues.
  const effectiveValues = showActionButtons && isOpen ? pendingSelections : selectedValues;

  // Filter options based on search term
  const filteredOptions = options.filter(
    (option) =>
      option.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !effectiveValues.includes(option),
  );

  const handleToggleOption = (option: string, checked: boolean) => {
    if (checked) {
      if (maxSelections && effectiveValues.length >= maxSelections) {
        return;
      }
      if (showActionButtons && isOpen) {
        setPendingSelections([...pendingSelections, option]);
      } else {
        onSelectionChange([...selectedValues, option]);
      }
    } else {
      if (showActionButtons && isOpen) {
        setPendingSelections(pendingSelections.filter((v) => v !== option));
      } else {
        onSelectionChange(selectedValues.filter((v) => v !== option));
      }
    }
  };

  const handleRemoveValue = (value: string) => {
    if (showActionButtons && isOpen) {
      setPendingSelections(pendingSelections.filter((v) => v !== value));
    } else {
      onSelectionChange(selectedValues.filter((v) => v !== value));
    }
  };

  const handleCustomInputSubmit = () => {
    const trimmed = customInput.trim();
    if (trimmed && !effectiveValues.includes(trimmed)) {
      if (maxSelections && effectiveValues.length >= maxSelections) {
        return;
      }
      if (showActionButtons && isOpen) {
        setPendingSelections([...pendingSelections, trimmed]);
      } else {
        onSelectionChange([...selectedValues, trimmed]);
      }
      setCustomInput("");
      if (!showActionButtons) {
        setIsOpen(false);
      }
    }
  };

  const handleApply = () => {
    onSelectionChange(pendingSelections);
    setIsOpen(false);
    setSearchTerm("");
    setCustomInput("");
  };

  const handleCancel = () => {
    setPendingSelections(selectedValues);
    setIsOpen(false);
    setSearchTerm("");
    setCustomInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (allowCustomInput && customInput.trim()) {
        handleCustomInputSubmit();
      }
    } else if (e.key === "Escape") {
      if (showActionButtons) {
        handleCancel();
      } else {
        setIsOpen(false);
        setSearchTerm("");
        setCustomInput("");
      }
    }
  };

  const handleDeselectAll = () => {
    if (showActionButtons && isOpen) {
      setPendingSelections([]);
    } else {
      onSelectionChange([]);
    }
  };

  // Show all options (including selected ones) for multi-select
  const displayOptions = options.filter((option) =>
    option.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className={cn("relative", className)}>
      {/* Selected values as chips - show above when displayMode is "chips" */}
      {effectiveValues.length > 0 && displayMode === "chips" && (
        <div className="mb-3">
          <div className="flex flex-wrap gap-2">
            {effectiveValues.map((value) => (
              <Badge
                key={value}
                variant="secondary"
                className="flex items-center gap-1 px-2 py-1 text-xs"
              >
                {value}
                {(!showActionButtons || !isOpen) && (
                  <button
                    type="button"
                    onClick={() => handleRemoveValue(value)}
                    className="ml-1 hover:bg-background rounded-full p-0.5 transition-colors"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Popover open={isOpen && !disabled} onOpenChange={(open) => {
        if (!disabled) {
          setIsOpen(open);
          if (!open) {
            setSearchTerm("");
            setCustomInput("");
          }
        }
      }}>
        <PopoverTrigger asChild>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={disabled}
              className={cn(
                "flex h-9 flex-1 items-center justify-between rounded-lg border bg-white dark:bg-gray-800 px-3 py-1 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-50 !border-gray-300 dark:!border-gray-600 focus:!border-accent-blue dark:focus:!border-accent-blue focus:ring-accent-blue/20 dark:focus:ring-accent-blue/30",
                className,
              )}
            >
              <span
                className={cn(
                  effectiveValues.length === 0 && "text-muted-foreground",
                )}
              >
                {effectiveValues.length === 0
                  ? placeholder
                  : displayMode === "comma"
                  ? effectiveValues.join(", ")
                  : `${effectiveValues.length} selected`}
              </span>
              <CaretSortIcon className="h-4 w-4 opacity-50" />
            </button>
            {selectedValues.length > 0 && displayMode === "chips" && !isOpen && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => { e.stopPropagation(); handleDeselectAll(); }}
                className="text-xs h-9 px-3 font-medium flex-shrink-0 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/60 hover:bg-red-50 dark:hover:bg-red-950/40 hover:border-red-300 dark:hover:border-red-700/70 transition-colors"
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
                const isSelected = effectiveValues.includes(option);
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
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-800"
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
                    effectiveValues.includes(customInput.trim())
                  }
                  className="px-2"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Action buttons (Cancel / OK) */}
          {showActionButtons && (
            <div className="flex items-center justify-end gap-2 p-2 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCancel}
                className="text-xs h-8 px-3"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleApply}
                className="text-xs h-8 px-3"
              >
                OK
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
