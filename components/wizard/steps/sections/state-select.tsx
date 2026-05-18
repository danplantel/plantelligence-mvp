"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const usStates = [
  "Outside US",
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
];

interface StateSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  disabledStates: string[];
}

export function StateSelect({
  value,
  onValueChange,
  disabledStates,
}: StateSelectProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredStates = usStates.filter((state) =>
    state.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (state: string) => {
    onValueChange(state);
    setIsOpen(false);
    setSearchTerm("");
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="w-32 justify-between h-9 px-3 bg-white"
      >
        <span className="truncate">{value}</span>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </Button>

      {isOpen && (
        <div
          className="fixed z-[9999] mt-1 bg-background border border-input rounded-md shadow-md max-h-60 w-64"
          style={{
            top: dropdownRef.current
              ? dropdownRef.current.getBoundingClientRect().bottom +
                window.scrollY +
                4
              : 0,
            left: dropdownRef.current
              ? dropdownRef.current.getBoundingClientRect().left +
                window.scrollX
              : 0,
          }}
        >
          <div className="border-b">
            <div className="relative">
              <Search className="absolute left-2 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Search states..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-10 bg-background border-input rounded-md"
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredStates.length > 0 ? (
              filteredStates.map((stateOption) => (
                <button
                  key={stateOption}
                  onClick={() => handleSelect(stateOption)}
                  disabled={disabledStates.includes(stateOption)}
                  className={cn(
                    "w-full px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground flex items-center justify-between",
                    disabledStates.includes(stateOption) &&
                      "opacity-50 cursor-not-allowed",
                    value === stateOption && "bg-accent",
                  )}
                >
                  <span>{stateOption}</span>
                  {value === stateOption && <Check className="h-4 w-4" />}
                </button>
              ))
            ) : (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                No states found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
